import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

/** Longest edge of the stored QR. Keeps the base64 small and fast while ensuring scannability. */
const QR_MAX_EDGE = 640;
/** Refuse excessively large files before processing */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Downscales and re-encodes uploaded QR code to a high-contrast, compact PNG data URL.
 * Keeps document small to prevent exceeding Netlify / Mongo payload limits.
 */
async function toDataUrl(file) {
    const source = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read that file.'));
        reader.readAsDataURL(file);
    });

    const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('That file is not a valid image.'));
        img.src = source;
    });

    const scale = Math.min(1, QR_MAX_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process that image.');

    // Ensure white background so transparent QR codes scan reliably
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL('image/png');
}

export default function AdminDashboard() {
    const [result, setResult] = useState('0');
    const [upiId, setUpiId] = useState('');
    const [qrImage, setQrImage] = useState(null);
    const [isUpdatingUPI, setIsUpdatingUPI] = useState(false);
    const [isProcessingQR, setIsProcessingQR] = useState(false);
    const fileInputRef = useRef(null);
    const [users, setUsers] = useState([]);
    const [searchPhone, setSearchPhone] = useState('');
    const [recharges, setRecharges] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]);
    const [bets, setBets] = useState([]);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [targetUserPhone, setTargetUserPhone] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [editingUserId, setEditingUserId] = useState(null);
    const [editBalanceAmount, setEditBalanceAmount] = useState('');
    const betsIntervalRef = useRef(null);
    const slowIntervalRef = useRef(null);
    const navigate = useNavigate();

    // Fast refresh: bets only, every 3 seconds — admin sees live bets instantly
    const refreshBets = useCallback(async () => {
        try {
            const betsData = await api.getCurrentBets();
            if (!betsData.error) setBets(betsData.bets);
        } catch (err) {
            // silent fail — don't disrupt admin UX
        }
    }, []);

    // Slow refresh: recharges + withdrawals every 15 seconds
    const refreshPending = useCallback(async () => {
        try {
            const [rechargesData, withdrawalsData] = await Promise.all([
                api.getRecharges(),
                api.getWithdrawals(),
            ]);
            if (!rechargesData.error) setRecharges(rechargesData.requests);
            if (!withdrawalsData.error) setWithdrawals(withdrawalsData.requests);
        } catch (err) {
            // silent fail
        }
    }, []);

    useEffect(() => {
        loadData();

        // Start live bet polling every 3 seconds
        betsIntervalRef.current = setInterval(refreshBets, 3000);
        // Refresh recharges/withdrawals every 15 seconds
        slowIntervalRef.current = setInterval(refreshPending, 15000);

        return () => {
            clearInterval(betsIntervalRef.current);
            clearInterval(slowIntervalRef.current);
        };
    }, [refreshBets, refreshPending]);

    // Full data load — runs once on mount and after actions like set-result
    // Uses Promise.all so all 5 requests fire in parallel (~3x faster than sequential)
    const loadData = async () => {
        try {
            const [upiData, usersData, rechargesData, withdrawalsData, betsData] = await Promise.all([
                api.getUPI(),
                api.getUsers(),
                api.getRecharges(),
                api.getWithdrawals(),
                api.getCurrentBets(),
            ]);

            setUpiId(upiData.upiId || '');
            setQrImage(upiData.qrImage || null);
            if (!usersData.error) setUsers(usersData.users);
            if (!rechargesData.error) setRecharges(rechargesData.requests);
            if (!withdrawalsData.error) setWithdrawals(withdrawalsData.requests);
            if (!betsData.error) setBets(betsData.bets);
        } catch (err) {
            console.error('Failed to load data');
        }
    };

    const handleSetResult = async () => {
        setError('');
        setMessage('');
        try {
            const data = await api.setResult(parseInt(result));
            if (data.error) {
                setError(data.error);
            } else {
                setMessage('Result set successfully! Winnings calculated.');
                loadData();
            }
        } catch (err) {
            setError('Failed to set result');
        }
    };

    const handleUpdateUPI = async () => {
        setError('');
        setMessage('');
        setIsUpdatingUPI(true);
        try {
            const data = await api.updateUPI(upiId, qrImage);
            if (data.error) {
                setError(data.error);
            } else {
                setMessage('UPI ID and QR updated successfully!');
            }
        } catch (err) {
            setError('Failed to update UPI');
        } finally {
            setIsUpdatingUPI(false);
        }
    };

    const handleQrUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_UPLOAD_BYTES) {
            setError('That image is over 8 MB. Please take a smaller screenshot or photo.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setError('');
        setIsProcessingQR(true);
        try {
            const dataUrl = await toDataUrl(file);
            setQrImage(dataUrl);
            setMessage('QR code processed. Click "Update UPI & QR" to save.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not process image.');
            if (fileInputRef.current) fileInputRef.current.value = '';
        } finally {
            setIsProcessingQR(false);
        }
    };

    const handleRemoveQr = () => {
        setQrImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleUpdateBalance = async (userId, amount) => {
        try {
            await api.updateBalance(userId, amount);
            loadData();
        } catch (err) {
            console.error('Failed to update balance');
        }
    };

    const handleApproveRecharge = async (requestId, approve) => {
        try {
            await api.approveRecharge(requestId, approve);
            loadData();
        } catch (err) {
            console.error('Failed to approve recharge');
        }
    };

    const handleApproveWithdrawal = async (requestId, approve) => {
        try {
            await api.approveWithdrawal(requestId, approve);
            loadData();
        } catch (err) {
            console.error('Failed to approve withdrawal');
        }
    };

    const handleSearchUsers = async () => {
        try {
            const data = await api.getUsers(searchPhone);
            if (!data.error) setUsers(data.users);
        } catch (err) {
            console.error('Failed to search users');
        }
    };

    const handleLogout = async () => {
        await api.logout();
        navigate('/admin');
    };

    const handleCreateNotification = async () => {
        setError('');
        setMessage('');
        try {
            const data = await api.createNotification(notificationMessage, targetUserPhone);
            if (data.error) {
                setError(data.error);
            } else {
                setMessage('Notification sent successfully!');
                setNotificationMessage('');
                setTargetUserPhone('');
            }
        } catch (err) {
            setError('Failed to create notification');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                    <button
                        onClick={handleLogout}
                        className="bg-red-600 px-4 py-2 rounded hover:bg-red-700 transition"
                    >
                        Logout
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 space-y-4">
                {message && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                        {message}
                    </div>
                )}
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                        {error}
                    </div>
                )}

                {/* Set Result */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-bold mb-4">Set Winning Number</h2>
                    <div className="space-y-4">
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                                let btnColor = 'bg-purple-500 hover:bg-purple-600';
                                let ringColor = 'ring-purple-400';
                                let activeColor = 'bg-purple-600';
                                if ([1, 3, 7, 9].includes(num)) {
                                    btnColor = 'bg-green-500 hover:bg-green-600';
                                    ringColor = 'ring-green-400';
                                    activeColor = 'bg-green-600';
                                } else if ([2, 4, 6, 8].includes(num)) {
                                    btnColor = 'bg-red-500 hover:bg-red-600';
                                    ringColor = 'ring-red-400';
                                    activeColor = 'bg-red-600';
                                }
                                const isSelected = parseInt(result, 10) === num;
                                return (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => setResult(String(num))}
                                        className={`py-3 rounded-lg font-bold text-white transition ${isSelected ? `${activeColor} ring-4 ${ringColor} scale-105` : `${btnColor} opacity-70 hover:opacity-100`}`}
                                    >
                                        {num}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={handleSetResult}
                            className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition shadow-md"
                        >
                            Set Winning Number
                        </button>
                    </div>
                </div>

                {/* Live Bets — auto-refreshes every 3s */}
                <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold">Current Round Bets</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">{bets.length} bet{bets.length !== 1 ? 's' : ''} • Pool: ₹{bets.reduce((s, b) => s + b.amount, 0).toFixed(2)}</span>
                            <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block"></span>
                                LIVE
                            </span>
                        </div>
                    </div>
                    {bets.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">No bets placed this round yet.</p>
                    ) : (
                        <div className="overflow-x-auto max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left font-semibold text-gray-600">Phone</th>
                                        <th className="p-2 text-left font-semibold text-gray-600">Type</th>
                                        <th className="p-2 text-left font-semibold text-gray-600">Value</th>
                                        <th className="p-2 text-right font-semibold text-gray-600">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bets.map((bet) => (
                                        <tr key={bet._id} className="border-b hover:bg-gray-50">
                                            <td className="p-2 font-mono text-xs">{bet.userId?.phone || '—'}</td>
                                            <td className="p-2">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${
                                                    bet.betType === 'green' ? 'bg-green-500' :
                                                    bet.betType === 'red' ? 'bg-red-500' :
                                                    bet.betType === 'violet' ? 'bg-purple-500' :
                                                    bet.betType === 'big' ? 'bg-orange-500' :
                                                    bet.betType === 'small' ? 'bg-blue-500' :
                                                    'bg-gray-500'
                                                }`}>{bet.betType.toUpperCase()}</span>
                                            </td>
                                            <td className="p-2">{bet.betType === 'number' ? bet.betValue : '—'}</td>
                                            <td className="p-2 text-right font-semibold">₹{bet.amount.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>


                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-bold mb-4">UPI Settings</h2>
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={upiId}
                                onChange={(e) => setUpiId(e.target.value)}
                                placeholder="Enter UPI ID"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                            />
                            <button
                                onClick={handleUpdateUPI}
                                disabled={isUpdatingUPI || isProcessingQR}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                            >
                                {isUpdatingUPI ? 'Updating...' : 'Update UPI & QR'}
                            </button>
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">QR Code Image</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleQrUpload}
                                disabled={isProcessingQR || isUpdatingUPI}
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                            />
                            {isProcessingQR && (
                                <p className="text-sm text-blue-600 mt-2 font-medium">Processing and optimizing QR code image...</p>
                            )}
                            {qrImage ? (
                                <div className="mt-4 p-3 bg-gray-50 border rounded-lg inline-block">
                                    <p className="text-xs text-gray-500 mb-2 font-medium">Active / Selected QR Preview:</p>
                                    <img src={qrImage} alt="QR Code Preview" className="w-36 h-36 object-contain border rounded bg-white p-1" />
                                    <button
                                        type="button"
                                        onClick={handleRemoveQr}
                                        className="text-red-600 text-sm mt-2 block hover:underline font-medium"
                                    >
                                        Remove QR (Revert to default)
                                    </button>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-500 mt-2">No custom QR set. Default QR image (/image/qr.png) will be shown to users.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Send Notification */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-bold mb-4">📢 Send Notification</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                            <textarea
                                value={notificationMessage}
                                onChange={(e) => setNotificationMessage(e.target.value)}
                                placeholder="Enter notification message..."
                                rows="3"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Target User (Optional)</label>
                            <input
                                type="text"
                                value={targetUserPhone}
                                onChange={(e) => setTargetUserPhone(e.target.value)}
                                placeholder="Enter phone number or leave empty for all users"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Leave empty to send to all users</p>
                        </div>
                        <button
                            onClick={handleCreateNotification}
                            className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 transition"
                        >
                            Send Notification
                        </button>
                    </div>
                </div>

                {/* Users */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-bold mb-4">Users</h2>
                    <div className="flex gap-4 mb-4">
                        <input
                            type="text"
                            value={searchPhone}
                            onChange={(e) => setSearchPhone(e.target.value)}
                            placeholder="Search by phone"
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                        <button
                            onClick={handleSearchUsers}
                            className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition"
                        >
                            Search
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-2 text-left">Phone</th>
                                    <th className="p-2 text-left">Balance</th>
                                    <th className="p-2 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user._id} className="border-b">
                                        <td className="p-2">{user.phone}</td>
                                        <td className="p-2">₹{user.balance}</td>
                                        <td className="p-2 space-x-2">
                                            {editingUserId === user._id ? (
                                                <div className="flex items-center space-x-2">
                                                    <input
                                                        type="number"
                                                        value={editBalanceAmount}
                                                        onChange={(e) => setEditBalanceAmount(e.target.value)}
                                                        placeholder="e.g. 500 or -200"
                                                        className="px-2 py-1 border border-gray-300 rounded text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-500 text-black"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const amount = parseFloat(editBalanceAmount);
                                                            if (!isNaN(amount)) {
                                                                handleUpdateBalance(user._id, amount);
                                                                setEditingUserId(null);
                                                                setEditBalanceAmount('');
                                                            }
                                                        }}
                                                        className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 font-semibold"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditingUserId(null);
                                                            setEditBalanceAmount('');
                                                        }}
                                                        className="bg-gray-400 text-white px-2 py-1 rounded text-xs hover:bg-gray-500 font-semibold"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setEditingUserId(user._id);
                                                        setEditBalanceAmount('');
                                                    }}
                                                    className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 font-semibold"
                                                >
                                                    Update Balance
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recharge Requests */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-bold mb-4">Recharge Requests</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-2 text-left">Phone</th>
                                    <th className="p-2 text-left">Amount</th>
                                    <th className="p-2 text-left">Transaction ID</th>
                                    <th className="p-2 text-left">Status</th>
                                    <th className="p-2 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recharges.map((req) => (
                                    <tr key={req._id} className="border-b">
                                        <td className="p-2">{req.userId?.phone}</td>
                                        <td className="p-2">₹{req.amount}</td>
                                        <td className="p-2">{req.transactionId}</td>
                                        <td className="p-2">{req.status}</td>
                                        <td className="p-2 space-x-2">
                                            {req.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApproveRecharge(req._id, true)}
                                                        className="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleApproveRecharge(req._id, false)}
                                                        className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Withdrawal Requests */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-bold mb-4">Withdrawal Requests</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-2 text-left">Phone</th>
                                    <th className="p-2 text-left">Amount</th>
                                    <th className="p-2 text-left">Bank Details</th>
                                    <th className="p-2 text-left">Status</th>
                                    <th className="p-2 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {withdrawals.map((req) => (
                                    <tr key={req._id} className="border-b">
                                        <td className="p-2">{req.userId?.phone}</td>
                                        <td className="p-2">₹{req.amount}</td>
                                        <td className="p-2 text-xs">
                                            {req.userId?.bankDetails ? (
                                                <>
                                                    {req.userId.bankDetails.accountNumber}<br />
                                                    {req.userId.bankDetails.ifsc}<br />
                                                    {req.userId.bankDetails.accountHolder}
                                                </>
                                            ) : 'N/A'}
                                        </td>
                                        <td className="p-2">{req.status}</td>
                                        <td className="p-2 space-x-2">
                                            {req.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApproveWithdrawal(req._id, true)}
                                                        className="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleApproveWithdrawal(req._id, false)}
                                                        className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Bets are shown in the Live Bets panel above */}
            </div>
        </div>
    );
}
