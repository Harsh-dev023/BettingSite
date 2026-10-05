import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function Profile() {
    const [user, setUser] = useState(null);
    const [betHistory, setBetHistory] = useState([]);
    const [transactions, setTransactions] = useState({ recharges: [], withdrawals: [] });
    const navigate = useNavigate();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const userData = await api.getMe();
            if (userData.error) {
                navigate('/login');
                return;
            }
            setUser(userData.user);

            const betsData = await api.getBetHistory();
            if (!betsData.error) {
                setBetHistory(betsData.bets);
            }

            const transData = await api.getTransactions();
            if (!transData.error) {
                setTransactions(transData);
            }
        } catch (err) {
            navigate('/login');
        }
    };

    const handleLogout = async () => {
        await api.logout();
        navigate('/login');
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-amber-300 font-serif-gold tracking-widest text-lg">LOADING PROFILE...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#08080c] text-gray-200 pb-28 pt-4 px-4 sm:px-6">
            <div className="max-w-3xl mx-auto space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between py-2 border-b border-[#252233]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-black font-serif-gold font-black text-xl">
                            ⚜
                        </div>
                        <div>
                            <h1 className="text-xl font-black font-serif-gold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 tracking-wider">
                                VIP PROFILE
                            </h1>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
                                Member Dashboard
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

                {/* User Info Card */}
                <div className="bg-[#12111a] border border-amber-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-black text-3xl shadow-lg shadow-amber-500/20 font-black">
                                👑
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold tracking-wider">
                                        VIP MEMBER
                                    </span>
                                </div>
                                <p className="text-lg font-bold font-num text-white mt-1">
                                    +91 {user.phone}
                                </p>
                                <p className="text-xs text-gray-400">
                                    Account Balance: <span className="text-amber-400 font-black font-num text-sm">₹{user.balance.toFixed(2)}</span>
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="px-5 py-2.5 rounded-xl border border-red-500/40 bg-red-950/40 text-red-300 font-semibold text-xs tracking-wider uppercase hover:bg-red-900/50 transition"
                        >
                            LOGOUT
                        </button>
                    </div>
                </div>

                {/* Bet History */}
                <div className="bg-[#12111a] border border-[#2a2538] rounded-2xl shadow-2xl p-5 space-y-3">
                    <h2 className="text-sm font-bold font-serif-gold text-amber-300 tracking-wider uppercase">
                        Recent Bet History
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-[#171524] text-gray-400 uppercase tracking-wider">
                                <tr>
                                    <th className="p-2.5 text-left rounded-l-lg">Round</th>
                                    <th className="p-2.5 text-left">Type</th>
                                    <th className="p-2.5 text-left">Amount</th>
                                    <th className="p-2.5 text-left">Result</th>
                                    <th className="p-2.5 text-left rounded-r-lg">Payout</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-num">
                                {betHistory.map((bet, idx) => (
                                    <tr key={idx} className="hover:bg-white/5 transition">
                                        <td className="p-2.5 text-amber-400 font-semibold">#{bet.roundId}</td>
                                        <td className="p-2.5 uppercase font-sans text-gray-300">
                                            {bet.betType}{bet.betValue !== null ? ` (${bet.betValue})` : ''}
                                        </td>
                                        <td className="p-2.5 text-gray-300">₹{bet.amount}</td>
                                        <td className="p-2.5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${bet.won ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'}`}>
                                                {bet.won ? 'WON' : 'LOST'}
                                            </span>
                                        </td>
                                        <td className="p-2.5 text-emerald-400 font-semibold">
                                            {bet.payout > 0 ? `+₹${bet.payout}` : '₹0'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {betHistory.length === 0 && (
                            <p className="text-center text-gray-500 py-6 text-xs">No bets placed yet</p>
                        )}
                    </div>
                </div>

                {/* Recharge History */}
                <div className="bg-[#12111a] border border-[#2a2538] rounded-2xl shadow-2xl p-5 space-y-3">
                    <h2 className="text-sm font-bold font-serif-gold text-amber-300 tracking-wider uppercase">
                        Recharge History
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-[#171524] text-gray-400 uppercase tracking-wider">
                                <tr>
                                    <th className="p-2.5 text-left rounded-l-lg">Amount</th>
                                    <th className="p-2.5 text-left">Transaction ID</th>
                                    <th className="p-2.5 text-left rounded-r-lg">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-num">
                                {transactions.recharges.map((req, idx) => (
                                    <tr key={idx} className="hover:bg-white/5 transition">
                                        <td className="p-2.5 text-amber-300 font-semibold">₹{req.amount}</td>
                                        <td className="p-2.5 text-gray-400">{req.transactionId}</td>
                                        <td className="p-2.5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                                req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                                                req.status === 'rejected' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                                                'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                                            }`}>
                                                {req.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {transactions.recharges.length === 0 && (
                            <p className="text-center text-gray-500 py-6 text-xs">No recharge requests yet</p>
                        )}
                    </div>
                </div>

                {/* Withdrawal History */}
                <div className="bg-[#12111a] border border-[#2a2538] rounded-2xl shadow-2xl p-5 space-y-3">
                    <h2 className="text-sm font-bold font-serif-gold text-amber-300 tracking-wider uppercase">
                        Withdrawal History
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-[#171524] text-gray-400 uppercase tracking-wider">
                                <tr>
                                    <th className="p-2.5 text-left rounded-l-lg">Amount</th>
                                    <th className="p-2.5 text-left rounded-r-lg">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-num">
                                {transactions.withdrawals.map((req, idx) => (
                                    <tr key={idx} className="hover:bg-white/5 transition">
                                        <td className="p-2.5 text-amber-300 font-semibold">₹{req.amount}</td>
                                        <td className="p-2.5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                                req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                                                req.status === 'rejected' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                                                'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                                            }`}>
                                                {req.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {transactions.withdrawals.length === 0 && (
                            <p className="text-center text-gray-500 py-6 text-xs">No withdrawal requests yet</p>
                        )}
                    </div>
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
                        className="flex flex-col items-center py-1 px-3 text-gray-400 hover:text-amber-300 transition"
                    >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-300 text-lg">
                            🏦
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Withdraw</span>
                    </button>

                    <button
                        onClick={() => navigate('/profile')}
                        className="flex flex-col items-center py-1 px-3 text-amber-400 relative"
                    >
                        <span className="absolute -top-2 w-10 h-0.5 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]"></span>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-400 text-lg">
                            👤
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">VIP Profile</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
