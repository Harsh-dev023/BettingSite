import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { connectDB, User, Bet, RechargeRequest, WithdrawalRequest } from './utils/db.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}

const SITE_URL = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:5173';

const headers = {
    'Access-Control-Allow-Origin': SITE_URL,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    await connectDB();

    const path = event.path.replace('/.netlify/functions/bets', '');

    try {
        // Verify JWT
        const cookies = cookie.parse(event.headers.cookie || '');
        const token = cookies.token;

        if (!token) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Not authenticated' }),
            };
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'User not found' }),
            };
        }

        // POST /recharge - Submit recharge request
        if (event.httpMethod === 'POST' && path === '/recharge') {
            let amount, transactionId;
            try { ({ amount, transactionId } = JSON.parse(event.body || '{}')); }
            catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) }; }
            const parsedAmount = parseFloat(amount);

            // Enforce minimum recharge of 10 and valid transactionId
            if (!parsedAmount || parsedAmount < 10 || !transactionId || !transactionId.trim()) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Minimum recharge amount is ₹10 and transaction ID is required' }),
                };
            }

            await RechargeRequest.create({
                userId: user._id,
                amount: parsedAmount,
                transactionId: transactionId.trim(),
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true }),
            };
        }

        // POST /withdraw - Submit withdrawal request
        if (event.httpMethod === 'POST' && path === '/withdraw') {
            let amount;
            try { ({ amount } = JSON.parse(event.body || '{}')); }
            catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) }; }

            if (!amount || amount <= 0) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid amount' }),
                };
            }

            if (amount > user.balance) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Insufficient balance' }),
                };
            }

            if (!user.bankDetails || !user.bankDetails.accountNumber) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Please save bank details first' }),
                };
            }

            // Create the record FIRST (no money moved yet)
            // Then deduct atomically. If deduct somehow fails, record exists but
            // balance is intact — admin can manually void if needed. This is far
            // safer than deducting first and losing money if create fails.
            let withdrawalRecord;
            try {
                withdrawalRecord = await WithdrawalRequest.create({
                    userId: user._id,
                    amount,
                });
            } catch (createErr) {
                console.error('WithdrawalRequest.create failed:', createErr);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: 'Failed to submit withdrawal, no money deducted' }),
                };
            }

            // Now safely deduct
            const updated = await User.findByIdAndUpdate(
                user._id,
                { $inc: { balance: -amount } },
                { new: true }
            ).select('balance').lean();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, balance: updated.balance }),
            };
        }

        // POST /save-bank - Save bank details
        if (event.httpMethod === 'POST' && path === '/save-bank') {
            let accountNumber, ifsc, accountHolder;
            try { ({ accountNumber, ifsc, accountHolder } = JSON.parse(event.body || '{}')); }
            catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) }; }

            if (!accountNumber || !ifsc || !accountHolder) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'All fields required' }),
                };
            }

            user.bankDetails = { accountNumber, ifsc, accountHolder };
            await user.save();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true }),
            };
        }

        // GET /history - User's bet history
        if (event.httpMethod === 'GET' && path === '/history') {
            const bets = await Bet.find({ userId: user._id })
                .sort({ createdAt: -1 })
                .limit(50);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ bets }),
            };
        }

        // GET /transactions - Recharge/withdrawal history
        if (event.httpMethod === 'GET' && path === '/transactions') {
            const recharges = await RechargeRequest.find({ userId: user._id })
                .sort({ createdAt: -1 })
                .limit(20);

            const withdrawals = await WithdrawalRequest.find({ userId: user._id })
                .sort({ createdAt: -1 })
                .limit(20);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ recharges, withdrawals }),
            };
        }

        // GET /round-bets?roundId=X - Get user's bets for a specific round
        if (event.httpMethod === 'GET' && path.startsWith('/round-bets')) {
            const params = new URLSearchParams(event.queryStringParameters || {});
            const roundId = parseInt(params.get('roundId'));

            if (!roundId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Round ID required' }),
                };
            }

            const bets = await Bet.find({ userId: user._id, roundId })
                .sort({ createdAt: -1 });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ bets }),
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Not found' }),
        };
    } catch (error) {
        console.error('Bets error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
};
