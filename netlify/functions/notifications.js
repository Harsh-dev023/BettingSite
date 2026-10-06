import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { connectDB, Notification } from './utils/db.js';

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

    const path = event.path.replace('/.netlify/functions/notifications', '');

    try {
        // Verify user authentication
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
        // Use userId directly from JWT — no need to DB-fetch the user
        // since we only need the ID for notification queries
        const userId = decoded.userId;
        if (!userId) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
        }

        // GET / - Get user's active notifications
        if (event.httpMethod === 'GET' && path === '') {
            const notifications = await Notification.find({
                $and: [
                    {
                        $or: [
                            { targetUsers: { $size: 0 } },
                            { targetUsers: userId }
                        ]
                    },
                    { dismissedBy: { $ne: userId } }
                ]
            })
            .select('message createdAt')
            .sort({ createdAt: -1 })
            .lean();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ notifications }),
            };
        }

        // POST /dismiss/:id - Dismiss a notification
        if (event.httpMethod === 'POST' && path.startsWith('/dismiss/')) {
            const notificationId = path.replace('/dismiss/', '');

            const notification = await Notification.findById(notificationId);
            if (!notification) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'Notification not found' }),
                };
            }

            // Use $addToSet to atomically add userId — avoids duplicate check + save round-trip
            await Notification.updateOne(
                { _id: notificationId },
                { $addToSet: { dismissedBy: userId } }
            );

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true }),
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Not found' }),
        };
    } catch (error) {
        console.error('Notifications error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
};
