import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function Recharge() {
    const [amount, setAmount] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [upiId, setUpiId] = useState('');
    const [qrImage, setQrImage] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-4">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-2xl font-bold">Recharge</h1>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-4">

                {/* Promotional Banner */}
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg shadow-lg p-6 mb-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="text-3xl">🎉</span>

                        <h2 className="text-2xl font-bold text-white">
                            First Recharge Bonus!
                        </h2>

                        <span className="text-3xl">🎉</span>
                    </div>

                    <p className="text-white text-lg font-semibold mb-2">
                        Get 20% Bonus on Your First Recharge!
                    </p>

                    <div className="bg-white bg-opacity-20 rounded-lg p-3 inline-block">
                        <p className="text-white text-xl font-bold">
                            ₹10000 → ₹12,000
                        </p>
                    </div>

                    <p className="text-white text-sm mt-2 opacity-90">
                        Double your first deposit instantly!
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-lg shadow-md p-6">

                    {/* UPI Payment Section */}
                    <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-300">

                        <p className="text-sm text-gray-600 mb-3 text-center font-semibold">
                            💳 Send Payment To:
                        </p>

                        {/* UPI ID */}
                        <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-blue-400">
                            <p className="text-center">
                                <span className="text-xs text-gray-500 block mb-1">
                                    UPI ID
                                </span>

                                <span className="text-2xl font-bold text-blue-600 break-all select-all">
                                    {upiId}
                                </span>
                            </p>
                        </div>

                        {/* QR Code */}
                        <div className="mt-5 flex flex-col items-center">

                            <p className="text-sm font-semibold text-gray-700 mb-3">
                                📱 Scan QR Code to Pay
                            </p>

                            <div className="bg-white p-3 rounded-lg shadow-md border-2 border-blue-300">
                                <img
                                    src={qrImage || "/image/qr.png"}
                                    alt="UPI QR Code"
                                    className="w-56 h-56 object-contain"
                                />
                            </div>

                        </div>

                        <p className="text-sm text-gray-600 mt-4 text-center">
                            📝 After payment, enter transaction details below
                        </p>
                    </div>

                    {/* Success Message */}
                    {message && (
                        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                            {message}
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                            {error}
                        </div>
                    )}

                    {/* Recharge Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Amount */}
                        <div>
                            <label className="block text-gray-700 mb-2">
                                Amount
                            </label>

                            <input
                                type="number"
                                value={amount}
                                onChange={(e) =>
                                    setAmount(e.target.value)
                                }
                                placeholder="Enter amount"
                                min="1"
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>

                        {/* Transaction ID */}
                        <div>
                            <label className="block text-gray-700 mb-2">
                                Transaction ID
                            </label>

                            <input
                                type="text"
                                value={transactionId}
                                onChange={(e) =>
                                    setTransactionId(e.target.value)
                                }
                                placeholder="Enter UPI transaction ID"
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition"
                        >
                            {loading
                                ? 'Submitting...'
                                : 'Submit Request'}
                        </button>

                    </form>

                    {/* Back to Game */}
                    <Link
                        to="/game"
                        className="block mt-4 text-center text-blue-600 hover:underline"
                    >
                        Back to Game
                    </Link>

                </div>
            </div>
        </div>
    );
}
