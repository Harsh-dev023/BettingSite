import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import bcrypt from 'bcryptjs';
import { connectDB, User, Round, Bet, RechargeRequest, WithdrawalRequest, Setting, Notification } from './utils/db.js';
import { getColor, getSize, calculateWinnings } from './utils/game-helpers.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}

// Use specific origin for credentials to work correctly with cookies
const SITE_URL = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:5173';

const headers = {
    'Access-Control-Allow-Origin': SITE_URL,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
};

// getColor, getSize, calculateWinnings are imported from utils/game-helpers.js

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    await connectDB();

    const path = event.path.replace('/.netlify/functions/admin', '');

    try {
        // POST /login - Admin login (now checks database)
        if (event.httpMethod === 'POST' && path === '/login') {
            let body;
            try { body = JSON.parse(event.body || '{}'); }
            catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) }; }
            const phone = (body.phone || '').trim();
            const password = body.password;

            // Validate phone
            if (!phone || !/^\d{10}$/.test(phone)) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid phone number' }),
                };
            }

            // Find user in database
            const user = await User.findOne({ phone });
            if (!user) {
                console.log('User not found for phone:', phone);
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Invalid credentials' }),
                };
            }

            // Check if user is admin
            if (!user.isAdmin) {
                console.log('User is not an admin:', phone);
                return {
                    statusCode: 403,
                    headers,
                    body: JSON.stringify({ error: 'Not authorized as admin' }),
                };
            }

            console.log('Admin user found, checking password...');

            // Check password
            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) {
                console.log('Invalid password for admin:', phone);
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Invalid credentials' }),
                };
            }

            console.log('Admin login successful for phone:', phone);

            // Generate JWT with admin flag
            const token = jwt.sign({ userId: user._id, phone, isAdmin: true }, JWT_SECRET, {
                expiresIn: '7d',
            });

            const cookieHeader = cookie.serialize('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60,
                path: '/',
            });

            return {
                statusCode: 200,
                headers: {
                    ...headers,
                    'Set-Cookie': cookieHeader,
                },
                body: JSON.stringify({ success: true, phone }),
            };
        }

        // GET /upi - Get UPI ID (Public endpoint - no auth required)
        if (event.httpMethod === 'GET' && path === '/upi') {
            // Fetch both settings in ONE query instead of two
            const settings = await Setting.find({ key: { $in: ['upiId', 'qrImage'] } }).lean();
            const upiId = settings.find(s => s.key === 'upiId')?.value || '';
            const qrImage = settings.find(s => s.key === 'qrImage')?.value || null;
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ upiId, qrImage }),
            };
        }

        // Verify admin for all other routes
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
        if (!decoded.isAdmin) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Not authorized' }),
            };
        }

        // POST /set-result - Set winning number
        if (event.httpMethod === 'POST' && path === '/set-result') {
            let body;
            try { body = JSON.parse(event.body || '{}'); }
            catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) }; }
            const result = parseInt(body.result, 10);

            // Must be a valid integer between 0-9
            if (!Number.isInteger(result) || result < 0 || result > 9) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Result must be an integer 0-9' }),
                };
            }

            // Check if more than 5 seconds left in current round
            const timeLeft = 60 - (Math.floor(Date.now() / 1000) % 60);
            if (timeLeft <= 5) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Cannot set result in last 5 seconds' }),
                };
            }

            const currentRoundId = Math.floor(Date.now() / 60000);
            const color = getColor(result);
            const size = getSize(result);

            // Check if round already has result
            let round = await Round.findOne({ roundId: currentRoundId });
            if (round && round.result !== null && round.result !== undefined) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Round already has result' }),
                };
            }

            // Create or update round
            if (!round) {
                round = new Round({ roundId: currentRoundId });
            }
            round.result = result;
            round.color = color;
            round.size = size;
            round.endedAt = new Date();
            await round.save();

            // Calculate winnings
            await calculateWinnings(currentRoundId, result);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true }),
            };
        }

        // GET /users - List all users
        if (event.httpMethod === 'GET' && path.startsWith('/users')) {
            const params = new URLSearchParams(event.queryStringParameters || {});
            const rawSearch = (params.get('search') || '').trim().slice(0, 20);

            let query = {};
            if (rawSearch) {
                // Escape special regex chars to prevent ReDoS attacks
                const escapedSearch = rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                query.phone = { $regex: `^${escapedSearch}` };
            }

            const users = await User.find(query)
                .select('phone balance createdAt')
                .sort({ createdAt: -1 })
                .limit(100);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ users }),
            };
        }

        // POST /update-balance - Add/reduce user balance
        if (event.httpMethod === 'POST' && path === '/update-balance') {
            let userId, amount;
            try { ({ userId, amount } = JSON.parse(event.body || '{}')); }
            catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) }; }

            const user = await User.findById(userId);
            if (!user) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'User not found' }),
                };
            }

            user.balance += amount;
            if (user.balance < 0) user.balance = 0;
            await user.save();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, balance: user.balance }),
            };
        }

        // GET /recharges - List recharge requests (pending first, then recent approved/rejected)
        if (event.httpMethod === 'GET' && path === '/recharges') {
            const statusFilter = event.queryStringParameters?.status;
            let requests;

            if (statusFilter && statusFilter !== 'all') {
                requests = await RechargeRequest.find({ status: statusFilter })
                    .populate('userId', 'phone')
                    .sort({ createdAt: -1 })
                    .limit(100)
                    .lean();
            } else {
                // Fetch ALL pending requests so they never get pushed out by limit,
                // followed by the most recent processed requests
                const [pending, processed] = await Promise.all([
                    RechargeRequest.find({ status: 'pending' })
                        .populate('userId', 'phone')
                        .sort({ createdAt: -1 })
                        .lean(),
                    RechargeRequest.find({ status: { $ne: 'pending' } })
                        .populate('userId', 'phone')
                        .sort({ createdAt: -1 })
                        .limit(100)
                        .lean(),
                ]);
                requests = [...pending, ...processed];
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ requests }),
            };
        }

        // POST /approve-recharge - Approve/reject recharge
        if (event.httpMethod === 'POST' && path === '/approve-recharge') {
            let requestId, approve;
            try { ({ requestId, approve } = JSON.parse(event.body || '{}')); }
            catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) }; }

            const request = await RechargeRequest.findById(requestId);
            if (!request) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'Request not found' }),
                };
            }

            if (request.status !== 'pending') {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Request already processed' }),
                };
            }

            if (approve) {
                request.status = 'approved';
                await request.save();

                // Add balance
                await User.findByIdAndUpdate(request.userId, {
                    $inc: { balance: request.amount },
                });
            } else {
                request.status = 'rejected';
                await request.save();
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true }),
            };
        }

        // GET /withdrawals - List withdrawal requests (pending first, then recent approved/rejected)
        if (event.httpMethod === 'GET' && path === '/withdrawals') {
            const statusFilter = event.queryStringParameters?.status;
            let requests;

            if (statusFilter && statusFilter !== 'all') {
                requests = await WithdrawalRequest.find({ status: statusFilter })
                    .populate('userId', 'phone bankDetails')
                    .sort({ createdAt: -1 })
                    .limit(100)
                    .lean();
            } else {
                // Fetch ALL pending requests so they never get pushed out by limit,
                // followed by the most recent processed requests
                const [pending, processed] = await Promise.all([
                    WithdrawalRequest.find({ status: 'pending' })
                        .populate('userId', 'phone bankDetails')
                        .sort({ createdAt: -1 })
                        .lean(),
                    WithdrawalRequest.find({ status: { $ne: 'pending' } })
                        .populate('userId', 'phone bankDetails')
                        .sort({ createdAt: -1 })
                        .limit(100)
                        .lean(),
                ]);
                requests = [...pending, ...processed];
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ requests }),
            };
        }

        // POST /approve-withdrawal - Approve/reject withdrawal
        if (event.httpMethod === 'POST' && path === '/approve-withdrawal') {
            let requestId, approve;
            try { ({ requestId, approve } = JSON.parse(event.body || '{}')); }
            catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) }; }

            const request = await WithdrawalRequest.findById(requestId);
            if (!request) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'Request not found' }),
                };
            }

            if (request.status !== 'pending') {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Request already processed' }),
                };
            }

            if (approve) {
                request.status = 'approved';
            } else {
                request.status = 'rejected';
                // Refund balance if rejected
                await User.findByIdAndUpdate(request.userId, {
                    $inc: { balance: request.amount },
                });
            }
            await request.save();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true }),
            };
        }

        // GET /bets - All bets for current round (lean + field-select for fast live refresh)
        if (event.httpMethod === 'GET' && path === '/bets') {
            const currentRoundId = Math.floor(Date.now() / 60000);
            const bets = await Bet.find({ roundId: currentRoundId })
                .populate('userId', 'phone')   // only need phone
                .select('userId betType betValue amount createdAt') // skip won/payout during live round
                .sort({ createdAt: -1 })
                .lean();                        // plain JS objects — skips Mongoose overhead

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ bets }),
            };
        }

        // POST /update-upi - Update UPI ID
        if (event.httpMethod === 'POST' && path === '/update-upi') {
            let upiId, qrImage;
            try { ({ upiId, qrImage } = JSON.parse(event.body || '{}')); }
            catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) }; }

            await Setting.findOneAndUpdate(
                { key: 'upiId' },
                { value: upiId },
                { upsert: true }
            );

            if (qrImage !== undefined) {
                await Setting.findOneAndUpdate(
                    { key: 'qrImage' },
                    { value: qrImage },
                    { upsert: true }
                );
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true }),
            };
        }

        // POST /create-notification - Create notification
        if (event.httpMethod === 'POST' && path === '/create-notification') {
            let message, targetUserPhone;
            try { ({ message, targetUserPhone } = JSON.parse(event.body || '{}')); }
            catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) }; }

            if (!message) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Message is required' }),
                };
            }

            const notificationData = {
                message,
                targetUsers: [],
                createdBy: decoded.userId || null,
            };

            // If targetUserPhone is provided, find that user
            if (targetUserPhone && targetUserPhone.trim()) {
                const targetUser = await User.findOne({ phone: targetUserPhone.trim() });
                if (!targetUser) {
                    return {
                        statusCode: 404,
                        headers,
                        body: JSON.stringify({ error: 'User not found' }),
                    };
                }
                notificationData.targetUsers = [targetUser._id];
            }
            // Otherwise, empty array means all users

            await Notification.create(notificationData);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true }),
            };
        }

        // GET /notifications - List all notifications
        if (event.httpMethod === 'GET' && path === '/notifications') {
            const notifications = await Notification.find()
                .populate('targetUsers', 'phone')
                .sort({ createdAt: -1 })
                .limit(50);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ notifications }),
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Not found' }),
        };
    } catch (error) {
        console.error('Admin error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
};
