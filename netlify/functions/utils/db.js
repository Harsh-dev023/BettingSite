import mongoose from 'mongoose';

// Ensure bufferCommands is false so operations fail fast rather than hanging 10s if disconnected
mongoose.set('bufferCommands', false);

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
    if (mongoose.connection.readyState === 1) {
        return mongoose;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('Please define MONGODB_URI environment variable');
    }

    if (!cached.promise || mongoose.connection.readyState === 0) {
        const opts = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };

        cached.promise = mongoose.connect(uri, opts).then((m) => m);
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

// User Schema
const userSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    isAdmin: { type: Boolean, default: false },
    bankDetails: {
        accountNumber: String,
        ifsc: String,
        accountHolder: String,
    },
    createdAt: { type: Date, default: Date.now },
});

// Round Schema
const roundSchema = new mongoose.Schema({
    roundId: { type: Number, required: true, unique: true },
    result: { type: Number, min: 0, max: 9 },
    color: { type: String, enum: ['green', 'red', 'violet'] },
    size: { type: String, enum: ['big', 'small', 'violet'] },
    endedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
});

// Bet Schema — with indexes for fast user history and per-round queries
const betSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roundId: { type: Number, required: true },
    betType: { type: String, required: true }, // 'green', 'red', 'violet', 'big', 'small', 'number'
    betValue: { type: Number }, // 0-9 for number bets
    amount: { type: Number, required: true },
    won: { type: Boolean, default: false },
    payout: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
});

// Indexes for common query patterns
betSchema.index({ userId: 1, createdAt: -1 }); // GET /history
betSchema.index({ roundId: 1 });                // GET /round-bets, calculateWinnings
betSchema.index({ userId: 1, roundId: 1 });     // GET /round-bets for specific user+round

// Recharge Request Schema
const rechargeRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    transactionId: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
});

rechargeRequestSchema.index({ userId: 1, createdAt: -1 });
rechargeRequestSchema.index({ status: 1, createdAt: -1 }); // Admin listing by status

// Withdrawal Request Schema
const withdrawalRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
});

withdrawalRequestSchema.index({ userId: 1, createdAt: -1 });
withdrawalRequestSchema.index({ status: 1, createdAt: -1 }); // Admin listing

// Setting Schema
const settingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
});

// Notification Schema
const notificationSchema = new mongoose.Schema({
    message: { type: String, required: true },
    targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Empty = all users
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dismissedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users who dismissed
    createdAt: { type: Date, default: Date.now },
});

notificationSchema.index({ createdAt: -1 });

// Models
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Round = mongoose.models.Round || mongoose.model('Round', roundSchema);
const Bet = mongoose.models.Bet || mongoose.model('Bet', betSchema);
const RechargeRequest = mongoose.models.RechargeRequest || mongoose.model('RechargeRequest', rechargeRequestSchema);
const WithdrawalRequest = mongoose.models.WithdrawalRequest || mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export { connectDB, User, Round, Bet, RechargeRequest, WithdrawalRequest, Setting, Notification };
