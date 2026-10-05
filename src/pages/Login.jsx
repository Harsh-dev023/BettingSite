import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function Login() {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = await api.login(phone, password);
            if (data.error) {
                setError(data.error);
            } else {
                navigate('/game');
            }
        } catch (err) {
            setError('Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#08080c] flex items-center justify-center p-4">
            <div className="bg-[#12111a] border border-amber-500/30 rounded-2xl shadow-2xl p-8 w-full max-w-md relative overflow-hidden">
                {/* Glow backdrop */}
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

                {/* Brand Header */}
                <div className="text-center mb-6">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-black font-serif-gold font-black text-2xl mb-3">
                        ⚜
                    </div>
                    <h1 className="text-2xl font-black font-serif-gold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 tracking-wider">
                        VNCLUB
                    </h1>
                    <p className="text-xs uppercase tracking-widest text-gray-400 mt-1">
                        Sign in to your account
                    </p>
                </div>

                {error && (
                    <div className="bg-red-950/60 border border-red-600/50 text-red-300 px-4 py-2.5 rounded-xl text-sm mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-300 tracking-wider uppercase mb-1.5">
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="10 digit phone number"
                            maxLength="10"
                            pattern="\d{10}"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-[#161422] border border-[#302c40] text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-num transition"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-300 tracking-wider uppercase mb-1.5">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-[#161422] border border-[#302c40] text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 rounded-xl font-bold tracking-wider uppercase text-black bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-98 disabled:opacity-50 transition duration-150 mt-2"
                    >
                        {loading ? 'LOGGING IN...' : 'LOGIN'}
                    </button>
                </form>

                <p className="text-center mt-6 text-sm text-gray-400">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-amber-400 font-semibold hover:underline">
                        Register
                    </Link>
                </p>
            </div>
        </div>
    );
}
