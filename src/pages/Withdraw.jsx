import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function Withdraw() {
    const [user, setUser] = useState(null);
    const [amount, setAmount] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [ifsc, setIfsc] = useState('');
    const [accountHolder, setAccountHolder] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [savingBank, setSavingBank] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        try {
            const data = await api.getMe();
            if (data.error) {
                navigate('/login');
            } else {
                setUser(data.user);
                if (data.user.bankDetails) {
                    setAccountNumber(data.user.bankDetails.accountNumber || '');
                    setIfsc(data.user.bankDetails.ifsc || '');
                    setAccountHolder(data.user.bankDetails.accountHolder || '');
                }
            }
        } catch (err) {
            navigate('/login');
        }
    };

    const handleSaveBank = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setSavingBank(true);

        try {
            const data = await api.saveBankDetails(accountNumber, ifsc, accountHolder);
            if (data.error) {
                setError(data.error);
            } else {
                setMessage('Bank details saved successfully!');
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (err) {
            setError('Failed to save bank details');
        } finally {
            setSavingBank(false);
        }
    };

    const handleWithdraw = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            const data = await api.submitWithdrawal(parseFloat(amount));
            if (data.error) {
                setError(data.error);
            } else {
                setMessage('Withdrawal request submitted! Balance deducted.');
                setUser({ ...user, balance: data.balance });
                setAmount('');
            }
        } catch (err) {
            setError('Failed to submit withdrawal');
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-amber-300 font-serif-gold tracking-widest text-lg">LOADING...</p>
                </div>
            </div>
        );
    }

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
                                WITHDRAWAL
                            </h1>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
                                Secure Bank Transfer
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

                {/* Balance Card */}
                <div className="bg-[#12111a] border border-amber-500/30 rounded-2xl p-5 shadow-xl flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wider text-gray-400">Available Balance</p>
                        <p className="text-2xl font-black font-num text-amber-300 mt-0.5">
                            ₹{user.balance.toFixed(2)}
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-lg">
                        ₹
                    </div>
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

                {/* Bank Details Card */}
                <div className="bg-[#12111a] border border-[#2a2538] rounded-2xl shadow-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                        <span className="text-amber-400">🏦</span>
                        <h2 className="text-base font-bold font-serif-gold text-amber-300 tracking-wider uppercase">
                            Bank Account Details
                        </h2>
                    </div>

                    <form onSubmit={handleSaveBank} className="space-y-3.5">
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 tracking-wider uppercase mb-1">
                                Account Number
                            </label>
                            <input
                                type="text"
                                value={accountNumber}
                                onChange={(e) => setAccountNumber(e.target.value)}
                                placeholder="Enter your bank account number"
                                required
                                className="w-full px-4 py-2.5 rounded-xl bg-[#161422] border border-[#302c40] text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 font-num text-sm transition"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-300 tracking-wider uppercase mb-1">
                                IFSC Code
                            </label>
                            <input
                                type="text"
                                value={ifsc}
                                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                                placeholder="e.g. SBIN0001234"
                                required
                                className="w-full px-4 py-2.5 rounded-xl bg-[#161422] border border-[#302c40] text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 font-num uppercase text-sm transition"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-300 tracking-wider uppercase mb-1">
                                Account Holder Name
                            </label>
                            <input
                                type="text"
                                value={accountHolder}
                                onChange={(e) => setAccountHolder(e.target.value)}
                                placeholder="Name as per bank records"
                                required
                                className="w-full px-4 py-2.5 rounded-xl bg-[#161422] border border-[#302c40] text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 text-sm transition"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={savingBank}
                            className="w-full py-2.5 rounded-xl font-bold tracking-wider uppercase text-amber-300 bg-[#1e1b2c] border border-amber-500/40 hover:bg-[#252237] active:scale-98 disabled:opacity-50 transition text-xs mt-1"
                        >
                            {savingBank ? 'SAVING BANK DETAILS...' : 'SAVE BANK DETAILS'}
                        </button>
                    </form>
                </div>

                {/* Request Withdrawal Card */}
                <div className="bg-[#12111a] border border-[#2a2538] rounded-2xl shadow-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                        <span className="text-amber-400">💸</span>
                        <h2 className="text-base font-bold font-serif-gold text-amber-300 tracking-wider uppercase">
                            Request Withdrawal
                        </h2>
                    </div>

                    <form onSubmit={handleWithdraw} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 tracking-wider uppercase mb-1.5">
                                Withdrawal Amount (₹)
                            </label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Enter amount to withdraw"
                                min="1"
                                max={user.balance}
                                required
                                className="w-full px-4 py-3 rounded-xl bg-[#161422] border border-[#302c40] text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-num font-semibold text-base transition"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !accountNumber || !user.balance || user.balance <= 0}
                            className="w-full py-4 rounded-xl font-extrabold tracking-widest uppercase text-black bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed transition duration-150"
                        >
                            {loading ? 'SUBMITTING WITHDRAWAL...' : 'SUBMIT WITHDRAWAL'}
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
                        className="flex flex-col items-center py-1 px-3 text-gray-400 hover:text-amber-300 transition"
                    >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-300 text-lg">
                            💳
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Deposit</span>
                    </button>

                    <button
                        onClick={() => navigate('/withdraw')}
                        className="flex flex-col items-center py-1 px-3 text-amber-400 relative"
                    >
                        <span className="absolute -top-2 w-10 h-0.5 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]"></span>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-400 text-lg">
                            🏦
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Withdraw</span>
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
