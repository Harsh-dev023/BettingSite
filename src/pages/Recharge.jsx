import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function Recharge() {
    const [amount, setAmount] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [upiId, setUpiId] = useState('');
    const [qrImage, setQrImage] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadUPI();
    }, []);

    const loadUPI = async () => {
        try {
            const data = await api.getUPI();
            setUpiId(data.upiId || 'Not set by admin');
            setQrImage(data.qrImage || null);
        } catch (err) {
            console.error('Failed to load UPI');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            const data = await api.submitRecharge(
                parseFloat(amount),
                transactionId
            );

            if (data.error) {
                setError(data.error);
            } else {
                setMessage(
                    'Recharge request submitted! Waiting for admin approval.'
                );
                setAmount('');
                setTransactionId('');
            }
        } catch (err) {
            setError('Failed to submit request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#08080c] text-gray-200 pb-28 pt-4 px-4 sm:px-6">
            <div className="max-w-2xl mx-auto space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between py-2 border-b border-[#252233]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-black font-serif-gold font-black text-xl">
                            ⚜
                        </div>
                        <div>
                            <h1 className="text-xl font-black font-serif-gold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 tracking-wider">
                                DEPOSIT RECHARGE
                            </h1>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
                                Instant Balance Credit
                            </p>
                        </div>
                    </div>
                    <Link
                        to="/game"
                        className="px-3.5 py-1.5 rounded-lg bg-[#181624] border border-amber-500/30 text-amber-300 text-xs font-semibold hover:border-amber-400 transition"
                    >
                        ← Back to Game
                    </Link>
                </div>

                {/* Promotional Bonus Banner */}
                <div className="bg-gradient-to-r from-amber-950/60 via-amber-900/40 to-yellow-950/60 border border-amber-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <span className="text-2xl">🎉</span>
                        <h2 className="text-xl font-bold font-serif-gold text-amber-300 tracking-wide">
                            First Recharge Bonus!
                        </h2>
                        <span className="text-2xl">🎉</span>
                    </div>

                    <p className="text-amber-200/90 text-sm font-medium mb-3">
                        Get 20% Bonus on Your First Recharge!
                    </p>

                    <div className="bg-[#12111a]/80 border border-amber-500/30 rounded-xl px-4 py-2 inline-block">
                        <p className="text-amber-300 text-lg font-black font-num">
                            ₹10000 → ₹12,000
                        </p>
                    </div>

                    <p className="text-gray-400 text-xs mt-2">
                        Double your first deposit instantly!
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-[#12111a] border border-[#2a2538] rounded-2xl shadow-2xl p-6 space-y-5">
                    {/* UPI Payment Section */}
                    <div className="p-5 bg-[#171524] rounded-xl border border-[#322d45] space-y-4">
                        <p className="text-xs font-semibold text-gray-300 text-center uppercase tracking-wider">
                            💳 Send Payment To UPI
                        </p>

                        {/* UPI ID */}
                        <div className="bg-[#0f0e17] rounded-xl p-3.5 border border-amber-500/30 text-center">
                            <span className="text-[10px] text-gray-400 block mb-1 uppercase tracking-wider">
                                Admin UPI ID
                            </span>
                            <span className="text-lg sm:text-xl font-bold font-num text-amber-300 break-all select-all tracking-wide">
                                {upiId}
                            </span>
                        </div>

                        {/* QR Code */}
                        <div className="flex flex-col items-center pt-2">
                            <p className="text-xs font-semibold text-gray-300 mb-3 uppercase tracking-wider">
                                📱 Scan QR Code to Pay
                            </p>
                            <div className="bg-white p-3 rounded-2xl shadow-xl border-4 border-amber-500/40">
                                <img
                                    src={qrImage || "/image/qr.png"}
                                    alt="UPI QR Code"
                                    className="w-52 h-52 object-contain"
                                />
                            </div>
                        </div>

                        <p className="text-xs text-gray-400 text-center pt-1">
                            📝 After payment, enter amount and UPI Ref/UTR number below
                        </p>
                    </div>

                    {/* Messages */}
                    {message && (
                        <div className="bg-emerald-950/60 border border-emerald-600/50 text-emerald-300 px-4 py-3 rounded-xl text-sm font-medium">
                            {message}
                        </div>
                    )}
                    {error && (
                        <div className="bg-red-950/60 border border-red-600/50 text-red-300 px-4 py-3 rounded-xl text-sm font-medium">
                            {error}
                        </div>
                    )}

                    {/* Recharge Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Amount */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 tracking-wider uppercase mb-1.5">
                                Recharge Amount (₹)
                            </label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Enter amount (e.g. 500)"
                                min="1"
                                required
                                className="w-full px-4 py-3 rounded-xl bg-[#161422] border border-[#302c40] text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-num font-semibold text-base transition"
                            />
                        </div>

                        {/* Transaction ID */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 tracking-wider uppercase mb-1.5">
                                Transaction ID / UTR
                            </label>
                            <input
                                type="text"
                                value={transactionId}
                                onChange={(e) => setTransactionId(e.target.value)}
                                placeholder="Enter 12-digit UPI reference number"
                                required
                                className="w-full px-4 py-3 rounded-xl bg-[#161422] border border-[#302c40] text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-num transition"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 rounded-xl font-extrabold tracking-widest uppercase text-black bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-98 disabled:opacity-50 transition duration-150"
                        >
                            {loading ? 'SUBMITTING REQUEST...' : 'SUBMIT RECHARGE REQUEST'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Bottom Navigation Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0c14]/95 backdrop-blur-xl border-t border-[#252233] px-4 py-2">
                <div className="max-w-md mx-auto flex items-center justify-around">
                    <button
                        onClick={() => navigate('/game')}
                        className="flex flex-col items-center py-1 px-3 text-gray-400 hover:text-amber-300 transition"
                    >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-300 text-lg">
                            🎮
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Games</span>
                    </button>

                    <button
                        onClick={() => navigate('/recharge')}
                        className="flex flex-col items-center py-1 px-3 text-amber-400 relative"
                    >
                        <span className="absolute -top-2 w-10 h-0.5 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]"></span>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-400 text-lg">
                            💳
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Deposit</span>
                    </button>

                    <button
                        onClick={() => navigate('/withdraw')}
                        className="flex flex-col items-center py-1 px-3 text-gray-400 hover:text-amber-300 transition"
                    >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-300 text-lg">
                            🏦
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Withdraw</span>
                    </button>

                    <button
                        onClick={() => navigate('/profile')}
                        className="flex flex-col items-center py-1 px-3 text-gray-400 hover:text-amber-300 transition"
                    >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-300 text-lg">
                            👤
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider">VIP Profile</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
