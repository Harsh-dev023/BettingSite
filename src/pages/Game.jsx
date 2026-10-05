import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function Game() {
    const [user, setUser] = useState(null);
    const [roundId, setRoundId] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60);
    const [lastResults, setLastResults] = useState([]);
    const [betType, setBetType] = useState('');
    const [betValue, setBetValue] = useState(null);
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showResultPopup, setShowResultPopup] = useState(false);
    const [lastRoundResult, setLastRoundResult] = useState(null);
    const [userRoundBets, setUserRoundBets] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const navigate = useNavigate();

    // Refs to track state smoothly without skips or lag
    const lastShownRoundIdRef = useRef(null);
    const fetchTimeoutRef = useRef(null);
    const tickIntervalRef = useRef(null);
    const serverOffsetRef = useRef(null);

    const scheduleNextFetch = (delay) => {
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = setTimeout(async () => {
            await fetchGameData();
        }, delay);
    };

    useEffect(() => {
        fetchUser();
        fetchNotifications();

        // Initial game data fetch
        fetchGameData();

        // Smooth client-side countdown tick every 1 second (no jitter/back-and-forth)
        tickIntervalRef.current = setInterval(() => {
            const clientTimeLeft = 60 - (Math.floor(Date.now() / 1000) % 60);
            const offset = serverOffsetRef.current !== null ? serverOffsetRef.current : 0;
            
            let adjustedTimeLeft = clientTimeLeft + offset;
            if (adjustedTimeLeft <= 0) {
                adjustedTimeLeft = 60 + (adjustedTimeLeft % 60);
            } else if (adjustedTimeLeft > 60) {
                adjustedTimeLeft = ((adjustedTimeLeft - 1) % 60) + 1;
            }
            
            setTimeLeft(adjustedTimeLeft);
        }, 1000);

        return () => {
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
            clearInterval(tickIntervalRef.current);
        };
    }, []);

    const fetchNotifications = async () => {
        try {
            const data = await api.getNotifications();
            if (!data.error) {
                setNotifications(data.notifications || []);
            }
        } catch (err) {
            console.error('Failed to load notifications');
        }
    };

    const fetchUser = async () => {
        const data = await api.getMe();
        if (data.error) {
            navigate('/login');
        } else {
            setUser(data.user);
        }
    };

    const fetchGameData = async () => {
        try {
            const data = await api.getCurrentRound();
            if (!data.roundId) {
                scheduleNextFetch(5000);
                return;
            }

            // Sync server offset (ignore network latency jitter unless drift is > 2 seconds)
            const clientTimeLeft = 60 - (Math.floor(Date.now() / 1000) % 60);
            const calculatedOffset = data.timeLeft - clientTimeLeft;
            if (serverOffsetRef.current === null || Math.abs(serverOffsetRef.current - calculatedOffset) > 2) {
                serverOffsetRef.current = calculatedOffset;
            }

            // Initialize lastShownRoundIdRef to the previous round on first load
            if (lastShownRoundIdRef.current === null) {
                lastShownRoundIdRef.current = data.roundId - 1;
            }

            // Check if there is a new result that we haven't shown a popup for yet
            const latestResult = data.lastResults && data.lastResults.length > 0 ? data.lastResults[0] : null;
            if (latestResult && latestResult.roundId > lastShownRoundIdRef.current) {
                // Ensure the result is for a round that has already ended relative to the server
                if (latestResult.roundId < data.roundId) {
                    lastShownRoundIdRef.current = latestResult.roundId;

                    // Fetch user's bets for this completed round and trigger the popup
                    const betsData = await api.getRoundBets(latestResult.roundId);
                    setUserRoundBets(betsData.bets || []);
                    setLastRoundResult(latestResult);
                    setShowResultPopup(true);
                    
                    // Refresh user balance
                    fetchUser();
                }
            }

            setRoundId(data.roundId);
            setLastResults(data.lastResults || []);

            const isWaitingForResult = latestResult === null || latestResult.roundId < (data.roundId - 1);

            if (data.timeLeft <= 3 || isWaitingForResult) {
                scheduleNextFetch(1000);
            } else {
                scheduleNextFetch(5000);
            }
        } catch (err) {
            console.error('Failed to fetch game data');
            scheduleNextFetch(5000);
        }
    };

    const handleBet = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const data = await api.placeBet(betType, betValue, parseFloat(amount));
            if (data.error) {
                setError(data.error);
            } else {
                setSuccess('Bet placed successfully!');
                setUser({ ...user, balance: data.balance });
                setAmount('');
                setBetType('');
                setBetValue(null);
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch (err) {
            setError('Failed to place bet');
        } finally {
            setLoading(false);
        }
    };

    const closePopup = () => {
        setShowResultPopup(false);
        setLastRoundResult(null);
        setUserRoundBets([]);
    };

    const calculateProfitLoss = () => {
        let totalBetAmount = 0;
        let totalPayout = 0;

        userRoundBets.forEach(bet => {
            totalBetAmount += bet.amount;
            if (bet.won) {
                totalPayout += bet.payout;
            }
        });

        return {
            totalBetAmount,
            totalPayout,
            profitLoss: totalPayout - totalBetAmount,
            hasWon: totalPayout > 0
        };
    };

    const handleDismissNotification = async (id) => {
        try {
            await api.dismissNotification(id);
            setNotifications(notifications.filter(n => n._id !== id));
        } catch (err) {
            console.error('Failed to dismiss notification');
        }
    };

    const isLocked = timeLeft <= 15;
    // Circular timer calculations (r=38, circ=238.76)
    const strokeDashoffset = 238.76 - (238.76 * (timeLeft / 60));
    const timerStrokeColor = timeLeft <= 15 ? '#ef4444' : timeLeft <= 25 ? '#f59e0b' : '#eab308';

    if (!user) return (
        <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-amber-300 font-serif-gold tracking-widest text-lg">LOADING VNCLUB...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#08080c] text-gray-200 pb-28 pt-3 px-3 sm:px-6">
            {/* Result Popup */}
            {showResultPopup && lastRoundResult && (() => {
                const { totalBetAmount, totalPayout, profitLoss, hasWon } = calculateProfitLoss();
                const hasBets = userRoundBets.length > 0;

                return (
                    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={closePopup}>
                        <div className="bg-[#12111a] border border-amber-500/30 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-black relative" onClick={(e) => e.stopPropagation()}>
                            <div className="text-center mb-6">
                                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 mb-2">
                                    ROUND #{lastRoundResult.roundId}
                                </span>
                                <h2 className="text-2xl font-bold font-serif-gold text-amber-300 tracking-wider">ROUND RESULT</h2>
                            </div>

                            <div className="text-center mb-6">
                                <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-5xl font-black font-num shadow-2xl mb-4 border-2 border-white/20"
                                     style={{
                                         backgroundColor: lastRoundResult.color === 'green' ? '#059669' : lastRoundResult.color === 'red' ? '#dc2626' : '#7c3aed',
                                         boxShadow: `0 0 35px ${lastRoundResult.color === 'green' ? 'rgba(16,185,129,0.5)' : lastRoundResult.color === 'red' ? 'rgba(239,68,68,0.5)' : 'rgba(124,58,237,0.5)'}`
                                     }}>
                                    {lastRoundResult.result}
                                </div>
                                <div className="flex justify-center gap-3">
                                    <span className="px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase text-white shadow"
                                          style={{ backgroundColor: lastRoundResult.color === 'green' ? '#059669' : lastRoundResult.color === 'red' ? '#dc2626' : '#7c3aed' }}>
                                        {lastRoundResult.color}
                                    </span>
                                    <span className="px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase bg-[#201d2d] text-amber-300 border border-amber-500/30">
                                        {lastRoundResult.size}
                                    </span>
                                </div>
                            </div>

                            {/* Win/Loss Information */}
                            {hasBets && (
                                <div className="mb-6 space-y-3">
                                    <div className={`p-4 rounded-xl text-center border ${hasWon ? 'bg-emerald-950/40 border-emerald-500/50' : 'bg-red-950/40 border-red-500/50'}`}>
                                        <p className={`text-xl font-bold font-serif-gold mb-1 ${hasWon ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {hasWon ? '🎉 YOU WON!' : '😔 YOU LOST'}
                                        </p>
                                        <p className={`text-3xl font-bold font-num ${hasWon ? 'text-emerald-300' : 'text-red-300'}`}>
                                            {profitLoss >= 0 ? '+' : ''}₹{profitLoss.toFixed(2)}
                                        </p>
                                    </div>

                                    <div className="bg-[#171622] border border-white/5 p-4 rounded-xl text-sm">
                                        <div className="flex justify-between mb-1.5">
                                            <span className="text-gray-400">Total Bet:</span>
                                            <span className="font-semibold text-gray-200">₹{totalBetAmount.toFixed(2)}</span>
                                        </div>
                                        {hasWon && (
                                            <div className="flex justify-between mb-1.5">
                                                <span className="text-gray-400">Total Payout:</span>
                                                <span className="font-semibold text-emerald-400 font-num">₹{totalPayout.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="border-t border-white/10 pt-2.5 mt-2 space-y-1.5">
                                            <p className="text-xs text-amber-400 font-semibold tracking-wider">YOUR BETS:</p>
                                            {userRoundBets.map((bet, idx) => (
                                                <div key={idx} className="flex justify-between text-xs">
                                                    <span className={bet.won ? 'text-emerald-400 font-medium' : 'text-gray-400'}>
                                                        {bet.betType === 'number' ? `Number ${bet.betValue}` : bet.betType.toUpperCase()}
                                                    </span>
                                                    <span className={bet.won ? 'text-emerald-400 font-semibold font-num' : 'text-gray-400 font-num'}>
                                                        ₹{bet.amount.toFixed(2)} {bet.won ? `→ ₹${bet.payout.toFixed(2)}` : ''}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!hasBets && (
                                <div className="mb-6 p-4 bg-[#171622] border border-white/5 rounded-xl text-center">
                                    <p className="text-gray-400 text-sm">You didn't place any bets this round</p>
                                </div>
                            )}

                            <button
                                onClick={closePopup}
                                className="w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-black py-3 rounded-xl font-bold tracking-wider hover:brightness-110 active:scale-98 transition shadow-lg shadow-amber-500/20"
                            >
                                CLOSE
                            </button>
                        </div>
                    </div>
                );
            })()}

            <div className="max-w-4xl mx-auto space-y-4">
                {/* Notifications */}
                {notifications.length > 0 && (
                    <div className="space-y-2">
                        {notifications.map((notification) => (
                            <div key={notification._id} className="bg-[#1f1b2e] border border-amber-500/40 rounded-xl p-3 shadow-lg flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 text-sm">
                                    <span className="text-xl">📢</span>
                                    <p className="text-amber-200">{notification.message}</p>
                                </div>
                                <button
                                    onClick={() => handleDismissNotification(notification._id)}
                                    className="text-gray-400 hover:text-white font-bold text-lg ml-3 px-2"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Top Bar Header (Matches reference image) */}
                <div className="flex items-center justify-between py-1">
                    {/* Brand Left */}
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/game')}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-black font-serif-gold font-black text-xl">
                            ⚜
                        </div>
                        <div>
                            <h1 className="text-xl font-black font-serif-gold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 tracking-wider">
                                VNCLUB
                            </h1>
                            <p className="text-[10px] uppercase tracking-widest text-amber-500/80 font-semibold -mt-1">
                                WIN GO 1 MIN
                            </p>
                        </div>
                    </div>

                    {/* Balance Right */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-[#14131d] border border-amber-500/30 px-3 py-1.5 rounded-full shadow-inner">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-amber-400 to-yellow-600 flex items-center justify-center text-black font-bold text-xs shadow">
                                ₹
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] uppercase tracking-wider text-gray-400 leading-none">BALANCE</p>
                                <p className="text-sm font-bold font-num text-amber-300 leading-tight">
                                    ₹{user.balance.toFixed(2)}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/recharge')}
                            className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black font-bold text-lg shadow-md hover:brightness-110 active:scale-95 transition"
                            title="Deposit"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Game Round / Countdown Card (Matches Reference Image) */}
                <div className="bg-[#12111a] border border-[#2a2538] rounded-2xl p-5 shadow-2xl relative overflow-hidden">
                    {/* Background glow effect */}
                    <div className="absolute -top-12 -left-12 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="flex items-center justify-between gap-4">
                        {/* Left Details */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-3 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase border border-amber-500/40 text-amber-400 bg-amber-500/5">
                                    CLASSIC 60S
                                </span>
                                <span className={`px-3 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase border flex items-center gap-1.5 ${
                                    isLocked 
                                        ? 'border-red-500/40 text-red-400 bg-red-500/10' 
                                        : 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'}`}></span>
                                    {isLocked ? 'BETTING LOCKED' : 'BETTING OPEN'}
                                </span>
                            </div>

                            <div>
                                <h2 className="text-2xl sm:text-3xl font-extrabold font-serif-gold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500">
                                    WIN GO 1 MINUTE
                                </h2>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Round Period: <span className="font-num text-amber-400 font-bold">#{roundId}</span>
                                </p>
                            </div>
                        </div>

                        {/* Right Circular Countdown Timer Widget */}
                        <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="38"
                                    className="stroke-[#1f1d2b]"
                                    strokeWidth="6"
                                    fill="transparent"
                                />
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="38"
                                    stroke={timerStrokeColor}
                                    strokeWidth="6"
                                    strokeDasharray="238.76"
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                    fill="transparent"
                                    className="transition-all duration-1000 ease-linear"
                                />
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center">
                                <span className="text-2xl font-black font-num tracking-tight transition-colors duration-300"
                                      style={{ color: timerStrokeColor }}>
                                    {timeLeft}
                                </span>
                                <span className="text-[9px] uppercase tracking-wider text-gray-400 -mt-1 font-semibold">
                                    SECONDS
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Locked Banner Notification */}
                    {isLocked && (
                        <div className="mt-4 py-2 px-3 rounded-lg bg-red-950/40 border border-red-900/60 text-center text-xs text-red-300 font-medium flex items-center justify-center gap-1.5">
                            <span>🔒</span>
                            <span>Betting is closed for this round. Calculating winning number...</span>
                        </div>
                    )}
                </div>

                {/* SELECT YOUR PREDICTION SECTION (Matches Reference Image) */}
                <div className="bg-[#12111a] border border-[#2a2538] rounded-2xl p-5 shadow-2xl space-y-5">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-white/5">
                        <div className="flex items-center gap-2">
                            <span className="text-amber-400 text-lg">⚜</span>
                            <h3 className="text-base sm:text-lg font-bold font-serif-gold text-amber-300 tracking-wider">
                                SELECT YOUR PREDICTION
                            </h3>
                        </div>
                        <div className="text-xs text-gray-400">
                            Balance: <span className="text-amber-400 font-bold font-num">₹{user.balance.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="bg-red-950/60 border border-red-600/50 text-red-300 px-4 py-2.5 rounded-xl text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="bg-emerald-950/60 border border-emerald-600/50 text-emerald-300 px-4 py-2.5 rounded-xl text-sm">
                            {success}
                        </div>
                    )}

                    {/* 1. ROYAL COLORS */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-gray-300 tracking-wider uppercase">ROYAL COLORS</span>
                            <span className="text-amber-400/80 font-medium">Green 2x • Violet 4.5x • Red 2x</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                            {/* EMERALD */}
                            <button
                                type="button"
                                onClick={() => { setBetType('green'); setBetValue(null); }}
                                className={`py-4 px-2 rounded-xl text-center transition-all duration-200 border ${
                                    betType === 'green'
                                        ? 'bg-gradient-to-b from-[#059669] to-[#047857] border-emerald-300 ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/30 scale-[1.02]'
                                        : 'bg-gradient-to-b from-[#065f46] to-[#044e39] border-emerald-600/40 hover:brightness-110 active:scale-98'
                                }`}
                            >
                                <p className="font-extrabold text-white text-sm sm:text-base tracking-wider">EMERALD</p>
                                <p className="text-[10px] text-emerald-200 font-semibold tracking-wider mt-0.5">2X PAYOUT</p>
                            </button>

                            {/* VIOLET */}
                            <button
                                type="button"
                                onClick={() => { setBetType('violet'); setBetValue(null); }}
                                className={`py-4 px-2 rounded-xl text-center transition-all duration-200 border ${
                                    betType === 'violet'
                                        ? 'bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] border-purple-300 ring-2 ring-purple-400 shadow-lg shadow-purple-500/30 scale-[1.02]'
                                        : 'bg-gradient-to-b from-[#581c87] to-[#3b0764] border-purple-600/40 hover:brightness-110 active:scale-98'
                                }`}
                            >
                                <p className="font-extrabold text-white text-sm sm:text-base tracking-wider">VIOLET</p>
                                <p className="text-[10px] text-purple-200 font-semibold tracking-wider mt-0.5">4.5X PAYOUT</p>
                            </button>

                            {/* CRIMSON */}
                            <button
                                type="button"
                                onClick={() => { setBetType('red'); setBetValue(null); }}
                                className={`py-4 px-2 rounded-xl text-center transition-all duration-200 border ${
                                    betType === 'red'
                                        ? 'bg-gradient-to-b from-[#dc2626] to-[#991b1b] border-red-300 ring-2 ring-red-400 shadow-lg shadow-red-500/30 scale-[1.02]'
                                        : 'bg-gradient-to-b from-[#881337] to-[#4c0519] border-red-600/40 hover:brightness-110 active:scale-98'
                                }`}
                            >
                                <p className="font-extrabold text-white text-sm sm:text-base tracking-wider">CRIMSON</p>
                                <p className="text-[10px] text-red-200 font-semibold tracking-wider mt-0.5">2X PAYOUT</p>
                            </button>
                        </div>
                    </div>

                    {/* 2. DIRECT NUMBER */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-gray-300 tracking-wider uppercase">DIRECT NUMBER</span>
                            <span className="text-amber-400/80 font-medium">8X JACKPOT</span>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                                const isSelected = betType === 'number' && betValue === num;
                                return (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => { setBetType('number'); setBetValue(num); }}
                                        className={`py-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                                            isSelected
                                                ? 'bg-[#221f33] border-amber-400 ring-2 ring-amber-400/70 shadow-lg shadow-amber-500/20 scale-[1.03]'
                                                : 'bg-[#151420] border-[#292639] hover:border-amber-400/50 hover:bg-[#1a1828] active:scale-95'
                                        }`}
                                    >
                                        <span className="text-lg font-black font-num text-white leading-tight">
                                            {num}
                                        </span>
                                        {/* Colored indicator dot */}
                                        <div className="flex items-center gap-1 mt-1">
                                            {num === 0 && (
                                                <>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                </>
                                            )}
                                            {num === 5 && (
                                                <>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                </>
                                            )}
                                            {[1, 3, 7, 9].includes(num) && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                            )}
                                            {[2, 4, 6, 8].includes(num) && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 3. SIZE DIVISION */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-gray-300 tracking-wider uppercase">SIZE DIVISION</span>
                            <span className="text-amber-400/80 font-medium">2X Payout (Big 6-9 • Small 0-4)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => { setBetType('small'); setBetValue(null); }}
                                className={`py-3.5 rounded-xl font-bold tracking-wider text-sm transition-all border ${
                                    betType === 'small'
                                        ? 'bg-gradient-to-r from-blue-900/80 to-indigo-900/80 border-blue-400 ring-2 ring-blue-400/50 text-blue-200 shadow-lg shadow-blue-500/20'
                                        : 'bg-[#151420] border-[#292639] text-gray-300 hover:border-blue-500/40 hover:text-white'
                                }`}
                            >
                                SMALL (0-4)
                            </button>
                            <button
                                type="button"
                                onClick={() => { setBetType('big'); setBetValue(null); }}
                                className={`py-3.5 rounded-xl font-bold tracking-wider text-sm transition-all border ${
                                    betType === 'big'
                                        ? 'bg-gradient-to-r from-amber-950/80 to-yellow-950/80 border-amber-400 ring-2 ring-amber-400/50 text-amber-300 shadow-lg shadow-amber-500/20'
                                        : 'bg-[#151420] border-[#292639] text-gray-300 hover:border-amber-500/40 hover:text-white'
                                }`}
                            >
                                BIG (6-9)
                            </button>
                        </div>
                    </div>

                    {/* Quick Amount & Bet Form */}
                    <form onSubmit={handleBet} className="pt-3 border-t border-white/5 space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-semibold text-gray-300 tracking-wider uppercase">
                                    QUICK AMOUNT
                                </label>
                                {betType && (
                                    <span className="text-xs text-amber-400 font-semibold uppercase">
                                        Selected: {betType === 'number' ? `Number ${betValue}` : betType}
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                {[10, 50, 100, 500, 1000].map((preset) => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setAmount(String(preset))}
                                        className={`py-2 rounded-lg font-num text-xs font-bold transition border ${
                                            amount === String(preset)
                                                ? 'bg-amber-400 text-black border-amber-300 shadow-md'
                                                : 'bg-[#181624] text-amber-300/90 border-[#2f2b3f] hover:border-amber-500/50'
                                        }`}
                                    >
                                        ₹{preset}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Amount Input */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 tracking-wider uppercase mb-1.5">
                                BET AMOUNT (₹)
                            </label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Enter custom amount"
                                required
                                min="1"
                                max={user.balance}
                                className="w-full px-4 py-3 rounded-xl bg-[#161422] border border-[#302c40] text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-num font-semibold text-base transition"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading || !betType || isLocked}
                            className="w-full py-4 rounded-xl font-extrabold tracking-widest uppercase text-black bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale transition duration-150"
                        >
                            {loading ? 'PLACING BET...' : isLocked ? 'BETTING CLOSED' : 'PLACE BET'}
                        </button>
                    </form>
                </div>

                {/* Last Results Section */}
                <div className="bg-[#12111a] border border-[#2a2538] rounded-2xl p-5 shadow-2xl space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                        <h3 className="text-sm font-bold font-serif-gold text-amber-300 tracking-wider uppercase">
                            LAST 20 RESULTS
                        </h3>
                        <span className="text-xs text-gray-500">Live Sync</span>
                    </div>

                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5 pt-1">
                        {lastResults.map((r, i) => (
                            <div key={i} className="text-center group">
                                <div
                                    className="w-11 h-11 rounded-full flex items-center justify-center font-black font-num text-white text-base mx-auto mb-1 shadow-lg transition-transform group-hover:scale-110 border border-white/20"
                                    style={{
                                        backgroundColor: r.color === 'green' ? '#059669' : r.color === 'red' ? '#dc2626' : '#7c3aed',
                                        boxShadow: `0 0 12px ${r.color === 'green' ? 'rgba(5,150,105,0.4)' : r.color === 'red' ? 'rgba(220,38,38,0.4)' : 'rgba(124,58,237,0.4)'}`
                                    }}
                                >
                                    {r.result}
                                </div>
                                <p className="text-[10px] text-gray-500 font-num">#{r.roundId % 1000}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Navigation Bar (Matches Reference Image) */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0c14]/95 backdrop-blur-xl border-t border-[#252233] px-4 py-2">
                <div className="max-w-md mx-auto flex items-center justify-around">
                    {/* Games Tab */}
                    <button
                        onClick={() => navigate('/game')}
                        className="flex flex-col items-center py-1 px-3 text-amber-400 relative"
                    >
                        <span className="absolute -top-2 w-10 h-0.5 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]"></span>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-400 text-lg">
                            🎮
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Games</span>
                    </button>

                    {/* Deposit Tab */}
                    <button
                        onClick={() => navigate('/recharge')}
                        className="flex flex-col items-center py-1 px-3 text-gray-400 hover:text-amber-300 transition"
                    >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-300 text-lg">
                            💳
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Deposit</span>
                    </button>

                    {/* Withdraw Tab */}
                    <button
                        onClick={() => navigate('/withdraw')}
                        className="flex flex-col items-center py-1 px-3 text-gray-400 hover:text-amber-300 transition"
                    >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-300 text-lg">
                            🏦
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Withdraw</span>
                    </button>

                    {/* VIP Profile Tab */}
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
