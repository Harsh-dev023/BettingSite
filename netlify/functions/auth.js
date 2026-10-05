import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { connectDB, User } from './utils/db.js';

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
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    await connectDB();

    const path = event.path.replace('/.netlify/functions/auth', '');

    try {
        // POST /register
        if (event.httpMethod === 'POST' && path === '/register') {
            const { phone, password } = JSON.parse(event.body);

            // Validate phone (10 digits)
            if (!phone || !/^\d{10}$/.test(phone)) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Phone must be exactly 10 digits' }),
                };
            }

            if (!password || password.length < 6) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Password must be at least 6 characters' }),
                };
            }

            // Check if user exists
            const existingUser = await User.findOne({ phone });
            if (existingUser) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Phone number already registered' }),
                };
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user
            const user = await User.create({
                phone,
                password: hashedPassword,
                balance: 0,
            });

            // Generate JWT
            const token = jwt.sign({ userId: user._id, phone: user.phone }, JWT_SECRET, {
                expiresIn: '7d',
            });

            const host = event.headers.host || '';
            const isSecure = !host.includes('localhost') && !host.includes('127.0.0.1');

            // Set cookie
            const cookieHeader = cookie.serialize('token', token, {
                httpOnly: true,
                secure: isSecure,
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
                body: JSON.stringify({
                    success: true,
                    user: {
                        id: user._id,
                        phone: user.phone,
                        balance: user.balance,
                    },
                }),
            };
        }

        // POST /login
        if (event.httpMethod === 'POST' && path === '/login') {
            const { phone, password } = JSON.parse(event.body);

            // Validate phone
            if (!phone || !/^\d{10}$/.test(phone)) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid phone number' }),
                };
            }

            // Find user
            const user = await User.findOne({ phone });
            if (!user) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Invalid credentials' }),
                };
            }

            // Check password
            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Invalid credentials' }),
                };
            }

            // Generate JWT
            const token = jwt.sign({ userId: user._id, phone: user.phone }, JWT_SECRET, {
                expiresIn: '7d',
            });

            const host = event.headers.host || '';
            const isSecure = !host.includes('localhost') && !host.includes('127.0.0.1');

            // Set cookie
            const cookieHeader = cookie.serialize('token', token, {
                httpOnly: true,
                secure: isSecure,
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
                body: JSON.stringify({
                    success: true,
                    user: {
                        id: user._id,
                        phone: user.phone,
                        balance: user.balance,
                    },
                }),
            };
        }

        // GET /me
        if (event.httpMethod === 'GET' && path === '/me') {
            const cookies = cookie.parse(event.headers.cookie || '');
            const token = cookies.token;

            if (!token) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Not authenticated' }),
                };
            }

            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                const user = await User.findById(decoded.userId);

                if (!user) {
                    return {
                        statusCode: 401,
                        headers,
                        body: JSON.stringify({ error: 'User not found' }),
                    };
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        user: {
                            id: user._id,
                            phone: user.phone,
                            balance: user.balance,
                            bankDetails: user.bankDetails,
                        },
                    }),
                };
            } catch (err) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Invalid token' }),
                };
            }
        }

        // POST /logout
        if (event.httpMethod === 'POST' && path === '/logout') {
            const cookieHeader = cookie.serialize('token', '', {
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                maxAge: 0,
                path: '/',
            });

            return {
                statusCode: 200,
                headers: {
                    ...headers,
                    'Set-Cookie': cookieHeader,
                },
                body: JSON.stringify({ success: true }),
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Not found' }),
        };
    } catch (error) {
        console.error('Auth error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
};
