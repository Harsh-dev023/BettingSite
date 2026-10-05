import { useState, useEffect, useRef } from 'react';
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
    const [durationMinutes, setDurationMinutes] = useState('');
    const [notificationsList, setNotificationsList] = useState([]);
    const [editingNotificationId, setEditingNotificationId] = useState(null);
    const [editNotificationMessage, setEditNotificationMessage] = useState('');
    const [editTargetUserPhone, setEditTargetUserPhone] = useState('');
    const [editDurationMinutes, setEditDurationMinutes] = useState('');
    const [notificationLoading, setNotificationLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [editingUserId, setEditingUserId] = useState(null);
    const [editBalanceAmount, setEditBalanceAmount] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const upiData = await api.getUPI();
            setUpiId(upiData.upiId || '');
            setQrImage(upiData.qrImage || null);

            const usersData = await api.getUsers();
            if (!usersData.error) setUsers(usersData.users);

            const rechargesData = await api.getRecharges();
            if (!rechargesData.error) setRecharges(rechargesData.requests);

            const withdrawalsData = await api.getWithdrawals();
            if (!withdrawalsData.error) setWithdrawals(withdrawalsData.requests);

            const betsData = await api.getCurrentBets();
            if (!betsData.error) setBets(betsData.bets);

            const notifsData = await api.getAdminNotifications();
            if (!notifsData.error) setNotificationsList(notifsData.notifications || []);
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
        if (!notificationMessage.trim()) {
            setError('Notification message cannot be empty');
            return;
        }
        setError('');
        setMessage('');
        setNotificationLoading(true);
        try {
            const data = await api.createNotification(notificationMessage, targetUserPhone, durationMinutes || '0');
            if (data.error) {
                setError(data.error);
            } else {
                setMessage('Notification sent successfully!');
                setNotificationMessage('');
                setTargetUserPhone('');
                setDurationMinutes('');
                const notifsData = await api.getAdminNotifications();
                if (!notifsData.error) setNotificationsList(notifsData.notifications || []);
            }
        } catch (err) {
            setError('Failed to create notification');
        } finally {
            setNotificationLoading(false);
        }
    };

    const handleStartEditNotification = (notif) => {
        setEditingNotificationId(notif._id);
        setEditNotificationMessage(notif.message);
        setEditTargetUserPhone(notif.targetUsers && notif.targetUsers.length > 0 ? notif.targetUsers[0].phone || '' : '');
        // Calculate remaining minutes if expiresAt exists
        if (notif.expiresAt) {
            const remaining = Math.max(0, Math.round((new Date(notif.expiresAt) - Date.now()) / 60000));
            setEditDurationMinutes(String(remaining));
        } else {
            setEditDurationMinutes('');
        }
    };

    const handleCancelEditNotification = () => {
        setEditingNotificationId(null);
        setEditNotificationMessage('');
        setEditTargetUserPhone('');
        setEditDurationMinutes('');
    };

    const handleSaveEditNotification = async () => {
        if (!editNotificationMessage.trim()) {
            setError('Notification message cannot be empty');
            return;
        }
        setError('');
        setMessage('');
        setNotificationLoading(true);
        try {
            const data = await api.updateNotification(editingNotificationId, editNotificationMessage, editTargetUserPhone, editDurationMinutes || '0');
            if (data.error) {
                setError(data.error);
            } else {
                setMessage('Notification updated successfully!');
                handleCancelEditNotification();
                const notifsData = await api.getAdminNotifications();
                if (!notifsData.error) setNotificationsList(notifsData.notifications || []);
            }
        } catch (err) {
            setError('Failed to update notification');
        } finally {
            setNotificationLoading(false);
        }
    };

    const handleDeleteNotification = async (notificationId) => {
        if (!window.confirm('Are you sure you want to delete this notification?')) return;
        setError('');
        setMessage('');
        try {
            const data = await api.deleteNotification(notificationId);
            if (data.error) {
                setError(data.error);
            } else {
                setMessage('Notification deleted successfully!');
                setNotificationsList(notificationsList.filter(n => n._id !== notificationId));
            }
        } catch (err) {
            setError('Failed to delete notification');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 text-gray-900">
            <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white p-4 shadow-md">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-wide">Admin Dashboard</h1>
                        <p className="text-xs text-gray-300 mt-0.5">Control Center & System Management</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="bg-red-600 px-4 py-2 rounded-lg hover:bg-red-700 transition font-semibold text-sm shadow"
                    >
                        Logout
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 space-y-5">
                {message && (
                    <div className="bg-green-100 border border-green-500 text-green-900 px-4 py-3 rounded-lg font-medium shadow-sm">
                        {message}
                    </div>
                )}
                {error && (
                    <div className="bg-red-100 border border-red-500 text-red-900 px-4 py-3 rounded-lg font-medium shadow-sm">
                        {error}
                    </div>
                )}

                {/* Set Result */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-bold mb-4 text-gray-900">Set Winning Number</h2>
                    <div className="space-y-4">
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                                let btnColor = 'bg-purple-600 hover:bg-purple-700';
                                let ringColor = 'ring-purple-400';
                                let activeColor = 'bg-purple-700 ring-4';
                                if ([1, 3, 7, 9].includes(num)) {
                                    btnColor = 'bg-green-600 hover:bg-green-700';
                                    ringColor = 'ring-green-400';
                                    activeColor = 'bg-green-700 ring-4';
                                } else if ([2, 4, 6, 8].includes(num)) {
                                    btnColor = 'bg-red-600 hover:bg-red-700';
                                    ringColor = 'ring-red-400';
                                    activeColor = 'bg-red-700 ring-4';
                                }
                                const isSelected = parseInt(result, 10) === num;
                                return (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => setResult(String(num))}
                                        className={`py-3 rounded-lg font-bold text-white transition text-lg shadow-sm ${isSelected ? `${activeColor} ${ringColor} scale-105 shadow-md` : `${btnColor} opacity-85 hover:opacity-100`}`}
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

                {/* UPI Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-bold mb-4 text-gray-900">UPI Settings</h2>
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={upiId}
                                onChange={(e) => setUpiId(e.target.value)}
                                placeholder="Enter UPI ID"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white font-medium"
                            />
                            <button
                                onClick={handleUpdateUPI}
                                disabled={isUpdatingUPI || isProcessingQR}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-semibold shadow-sm"
                            >
                                {isUpdatingUPI ? 'Updating...' : 'Update UPI & QR'}
                            </button>
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm font-semibold text-gray-800 mb-2">QR Code Image</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleQrUpload}
                                disabled={isProcessingQR || isUpdatingUPI}
                                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                            />
                            {isProcessingQR && (
                                <p className="text-sm text-blue-600 mt-2 font-medium">Processing and optimizing QR code image...</p>
                            )}
                            {qrImage ? (
                                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg inline-block">
                                    <p className="text-xs text-gray-700 mb-2 font-semibold">Active / Selected QR Preview:</p>
                                    <img src={qrImage} alt="QR Code Preview" className="w-36 h-36 object-contain border rounded bg-white p-1" />
                                    <button
                                        type="button"
                                        onClick={handleRemoveQr}
                                        className="text-red-600 text-sm mt-2 block hover:underline font-semibold"
                                    >
                                        Remove QR (Revert to default)
                                    </button>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-600 mt-2">No custom QR set. Default QR image (/image/qr.png) will be shown to users.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Notification Management */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">📢 Notification Center</h2>
                            <p className="text-xs text-gray-600 font-medium">Manage site-wide notices and user-specific announcements</p>
                        </div>
                        <span className="text-xs bg-yellow-100 text-yellow-900 border border-yellow-300 font-bold px-3 py-1 rounded-full">
                            {notificationsList.length} Active {notificationsList.length === 1 ? 'Notice' : 'Notices'}
                        </span>
                    </div>

                    {/* Create or Edit Form */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">
                            {editingNotificationId ? '✏️ Edit Notification' : '➕ Add New Notification'}
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                                    Message <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={editingNotificationId ? editNotificationMessage : notificationMessage}
                                    onChange={(e) =>
                                        editingNotificationId
                                            ? setEditNotificationMessage(e.target.value)
                                            : setNotificationMessage(e.target.value)
                                    }
                                    placeholder="Enter notification message to display on the game banner..."
                                    rows="2"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm text-gray-900 placeholder-gray-500 bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                                    Target User Phone (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={editingNotificationId ? editTargetUserPhone : targetUserPhone}
                                    onChange={(e) =>
                                        editingNotificationId
                                            ? setEditTargetUserPhone(e.target.value)
                                            : setTargetUserPhone(e.target.value)
                                    }
                                    placeholder="Leave empty for all users, or enter 10-digit phone number"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm text-gray-900 placeholder-gray-500 bg-white"
                                />
                                <p className="text-[11px] text-gray-600 mt-1 font-medium">
                                    Empty = All users will see this notification banner
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                                    Duration (minutes) — 0 or empty = never expires
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        value={editingNotificationId ? editDurationMinutes : durationMinutes}
                                        onChange={(e) =>
                                            editingNotificationId
                                                ? setEditDurationMinutes(e.target.value)
                                                : setDurationMinutes(e.target.value)
                                        }
                                        placeholder="0"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm text-gray-900 placeholder-gray-500 bg-white font-medium"
                                    />
                                    {[30, 60, 360, 1440].map((mins) => (
                                        <button
                                            key={mins}
                                            type="button"
                                            onClick={() =>
                                                editingNotificationId
                                                    ? setEditDurationMinutes(String(mins))
                                                    : setDurationMinutes(String(mins))
                                            }
                                            className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-md text-xs font-bold text-gray-700 transition shadow-sm"
                                        >
                                            {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-gray-600 mt-1 font-medium">
                                    Quick: 30m · 1h · 6h · 24h — Notification auto-disappears after this time
                                </p>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                {editingNotificationId ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleSaveEditNotification}
                                            disabled={notificationLoading}
                                            className="bg-green-600 text-white px-5 py-2 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition shadow-sm"
                                        >
                                            {notificationLoading ? 'Saving...' : 'Save Changes'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCancelEditNotification}
                                            className="bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-700 transition"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleCreateNotification}
                                        disabled={notificationLoading}
                                        className="bg-yellow-600 text-white px-6 py-2 rounded-lg font-semibold text-sm hover:bg-yellow-700 disabled:opacity-50 transition shadow-sm"
                                    >
                                        {notificationLoading ? 'Publishing...' : 'Publish Notification'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Current Notifications List */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">
                            📋 Current Notifications
                        </h3>
                        {notificationsList.length === 0 ? (
                            <div className="text-center py-6 border border-dashed border-gray-300 rounded-lg text-gray-600 text-sm font-medium">
                                No active notifications. Use the form above to add a new notification banner.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {notificationsList.map((notif) => {
                                    const isTargetSpecific = notif.targetUsers && notif.targetUsers.length > 0;
                                    const targetPhone = isTargetSpecific ? notif.targetUsers[0].phone || 'Specific User' : 'All Users';
                                    const isEditingThis = editingNotificationId === notif._id;

                                    return (
                                        <div
                                            key={notif._id}
                                            className={`p-4 rounded-xl border transition shadow-sm ${
                                                isEditingThis
                                                    ? 'bg-yellow-50 border-yellow-400 ring-2 ring-yellow-400'
                                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                        <span
                                                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                                isTargetSpecific
                                                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                                                    : 'bg-green-100 text-green-800 border border-green-200'
                                                            }`}
                                                        >
                                                            {isTargetSpecific ? `📱 To: ${targetPhone}` : '🌍 All Users'}
                                                        </span>
                                                        {notif.expiresAt && (
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                                                new Date(notif.expiresAt) > new Date()
                                                                    ? 'bg-orange-100 text-orange-800 border-orange-200'
                                                                    : 'bg-gray-100 text-gray-600 border-gray-300 line-through'
                                                            }`}>
                                                                ⏱ {new Date(notif.expiresAt) > new Date()
                                                                    ? `Expires ${new Date(notif.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${new Date(notif.expiresAt).toLocaleDateString()}`
                                                                    : 'Expired'
                                                                }
                                                            </span>
                                                        )}
                                                        {!notif.expiresAt && (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                                                ∞ No Expiry
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-gray-500 font-medium">
                                                            {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-900 text-sm font-semibold break-words">
                                                        {notif.message}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStartEditNotification(notif)}
                                                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-300 rounded-md text-xs font-bold transition"
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteNotification(notif._id)}
                                                        className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-300 rounded-md text-xs font-bold transition"
                                                    >
                                                        🗑️ Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Users */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-bold mb-4 text-gray-900">Users</h2>
                    <div className="flex gap-4 mb-4">
                        <input
                            type="text"
                            value={searchPhone}
                            onChange={(e) => setSearchPhone(e.target.value)}
                            placeholder="Search by phone"
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-900 placeholder-gray-500 bg-white font-medium"
                        />
                        <button
                            onClick={handleSearchUsers}
                            className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition font-semibold"
                        >
                            Search
                        </button>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 border-b border-gray-200">
                                <tr>
                                    <th className="p-3 text-left font-bold text-gray-800">Phone</th>
                                    <th className="p-3 text-left font-bold text-gray-800">Balance</th>
                                    <th className="p-3 text-left font-bold text-gray-800">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {users.map((user) => (
                                    <tr key={user._id} className="hover:bg-gray-50 transition">
                                        <td className="p-3 font-semibold text-gray-900">{user.phone}</td>
                                        <td className="p-3 font-bold text-emerald-700">₹{user.balance}</td>
                                        <td className="p-3 space-x-2">
                                            {editingUserId === user._id ? (
                                                <div className="flex items-center space-x-2">
                                                    <input
                                                        type="number"
                                                        value={editBalanceAmount}
                                                        onChange={(e) => setEditBalanceAmount(e.target.value)}
                                                        placeholder="e.g. 500 or -200"
                                                        className="px-2 py-1 border border-gray-400 rounded text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 bg-white font-semibold"
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
                                                        className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 font-bold shadow-sm"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditingUserId(null);
                                                            setEditBalanceAmount('');
                                                        }}
                                                        className="bg-gray-500 text-white px-3 py-1 rounded text-xs hover:bg-gray-600 font-bold"
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
                                                    className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs hover:bg-blue-700 font-semibold shadow-sm"
                                                >
                                                    Update Balance
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="p-4 text-center text-gray-600 font-medium">No users found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recharge Requests */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-bold mb-4 text-gray-900">Recharge Requests</h2>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 border-b border-gray-200">
                                <tr>
                                    <th className="p-3 text-left font-bold text-gray-800">Phone</th>
                                    <th className="p-3 text-left font-bold text-gray-800">Amount</th>
                                    <th className="p-3 text-left font-bold text-gray-800">Transaction ID</th>
                                    <th className="p-3 text-left font-bold text-gray-800">Status</th>
                                    <th className="p-3 text-left font-bold text-gray-800">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {recharges.map((req) => (
                                    <tr key={req._id} className="hover:bg-gray-50 transition">
                                        <td className="p-3 font-semibold text-gray-900">{req.userId?.phone}</td>
                                        <td className="p-3 font-bold text-emerald-700">₹{req.amount}</td>
                                        <td className="p-3 font-mono text-gray-800 text-xs font-medium">{req.transactionId}</td>
                                        <td className="p-3">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                                req.status === 'approved' ? 'bg-green-100 text-green-800 border-green-200' :
                                                req.status === 'rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                                                'bg-yellow-100 text-yellow-800 border-yellow-200'
                                            }`}>
                                                {req.status ? req.status.toUpperCase() : 'PENDING'}
                                            </span>
                                        </td>
                                        <td className="p-3 space-x-2">
                                            {req.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApproveRecharge(req._id, true)}
                                                        className="bg-green-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-green-700 shadow-sm"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleApproveRecharge(req._id, false)}
                                                        className="bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-red-700 shadow-sm"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {recharges.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="p-4 text-center text-gray-600 font-medium">No recharge requests</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Withdrawal Requests */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-bold mb-4 text-gray-900">Withdrawal Requests</h2>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 border-b border-gray-200">
                                <tr>
                                    <th className="p-3 text-left font-bold text-gray-800">Phone</th>
                                    <th className="p-3 text-left font-bold text-gray-800">Amount</th>
                                    <th className="p-3 text-left font-bold text-gray-800">Bank Details</th>
                                    <th className="p-3 text-left font-bold text-gray-800">Status</th>
                                    <th className="p-3 text-left font-bold text-gray-800">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {withdrawals.map((req) => (
                                    <tr key={req._id} className="hover:bg-gray-50 transition">
                                        <td className="p-3 font-semibold text-gray-900">{req.userId?.phone}</td>
                                        <td className="p-3 font-bold text-red-600">₹{req.amount}</td>
                                        <td className="p-3 text-xs text-gray-800 font-medium leading-relaxed">
                                            {req.userId?.bankDetails ? (
                                                <>
                                                    <span className="font-bold text-gray-900">A/C:</span> {req.userId.bankDetails.accountNumber}<br />
                                                    <span className="font-bold text-gray-900">IFSC:</span> {req.userId.bankDetails.ifsc}<br />
                                                    <span className="font-bold text-gray-900">Name:</span> {req.userId.bankDetails.accountHolder}
                                                </>
                                            ) : (
                                                <span className="text-gray-500">N/A</span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                                req.status === 'approved' ? 'bg-green-100 text-green-800 border-green-200' :
                                                req.status === 'rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                                                'bg-yellow-100 text-yellow-800 border-yellow-200'
                                            }`}>
                                                {req.status ? req.status.toUpperCase() : 'PENDING'}
                                            </span>
                                        </td>
                                        <td className="p-3 space-x-2">
                                            {req.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApproveWithdrawal(req._id, true)}
                                                        className="bg-green-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-green-700 shadow-sm"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleApproveWithdrawal(req._id, false)}
                                                        className="bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-red-700 shadow-sm"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {withdrawals.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="p-4 text-center text-gray-600 font-medium">No withdrawal requests</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Current Round Bets */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-bold mb-4 text-gray-900">Current Round Bets</h2>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 border-b border-gray-200">
                                <tr>
                                    <th className="p-3 text-left font-bold text-gray-800">Phone</th>
                                    <th className="p-3 text-left font-bold text-gray-800">Type</th>
                                    <th className="p-3 text-left font-bold text-gray-800">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {bets.map((bet) => (
                                    <tr key={bet._id} className="hover:bg-gray-50 transition">
                                        <td className="p-3 font-semibold text-gray-900">{bet.userId?.phone}</td>
                                        <td className="p-3 font-semibold text-gray-900">{bet.betType}{bet.betValue !== null ? ` (${bet.betValue})` : ''}</td>
                                        <td className="p-3 font-bold text-emerald-700">₹{bet.amount}</td>
                                    </tr>
                                ))}
                                {bets.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="p-4 text-center text-gray-600 font-medium">No bets placed in the current round</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
