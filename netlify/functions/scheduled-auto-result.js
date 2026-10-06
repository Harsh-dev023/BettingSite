import { connectDB, Round, Bet } from './utils/db.js';
import { getColor, getSize, calculateWinnings } from './utils/game-helpers.js';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// This is the scheduled function that runs every minute
export const handler = async (event) => {
    const previousRoundId = Math.floor(Date.now() / 60000) - 1;
    console.log('Scheduled auto-result triggered at:', new Date().toISOString(), '| Round:', previousRoundId);

    await connectDB();

    try {
        // ─── FAST PATH: Check if this round already has a result ──────────────
        // Uses lean() + only fetches the result field — extremely cheap query.
        // 99% of the time this will be true (admin already set result),
        // so we exit immediately without doing any heavy work.
        const existingResult = await Round.findOne(
            { roundId: previousRoundId, result: { $ne: null } },
            { result: 1 }          // only fetch the result field
        ).lean();                  // plain JS object, skips Mongoose overhead

        if (existingResult) {
            console.log('✓ Round already resolved, result:', existingResult.result, '— skipping.');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    message: 'Round already has result',
                    roundId: previousRoundId,
                    result: existingResult.result,
                }),
            };
        }

        // ─── SLOW PATH: Round has no result yet — auto-generate one ──────────
        const randomResult = Math.floor(Math.random() * 10);
        const color = getColor(randomResult);
        const size = getSize(randomResult);

        console.log('Auto-generating result:', randomResult, color, size);

        // Fetch full doc only when we actually need to write
        const existingRound = await Round.findOne({ roundId: previousRoundId });

        if (!existingRound) {
            await Round.create({
                roundId: previousRoundId,
                result: randomResult,
                color,
                size,
                endedAt: new Date(),
            });
        } else {
            existingRound.result = randomResult;
            existingRound.color = color;
            existingRound.size = size;
            existingRound.endedAt = new Date();
            await existingRound.save();
        }

        // Calculate and credit winnings for this round
        await calculateWinnings(previousRoundId, randomResult);

        // ─── CLEANUP: Only run every 10th round to save DB ops ───────────────
        // previousRoundId is a unix-minute timestamp. Modulo 10 means cleanup
        // runs roughly every 10 minutes instead of every minute — same result,
        // 90% fewer cleanup queries.
        if (previousRoundId % 10 === 0) {
            console.log('Running periodic cleanup...');

            const recentRounds = await Round.find()
                .sort({ roundId: -1 })
                .limit(20)
                .select('roundId')
                .lean();

            const recentRoundIds = recentRounds.map(r => r.roundId);

            const [deletedRounds, deletedBets] = await Promise.all([
                Round.deleteMany({ roundId: { $nin: recentRoundIds } }),
                Bet.deleteMany({ roundId: { $nin: recentRoundIds } }),
            ]);

            console.log(`Cleanup: removed ${deletedRounds.deletedCount} rounds, ${deletedBets.deletedCount} bets`);
        }

        console.log('✓ Auto result set successfully for round', previousRoundId);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Scheduled auto result generated',
                roundId: previousRoundId,
                result: randomResult,
            }),
        };
    } catch (error) {
        console.error('Scheduled auto result error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', details: error.message }),
        };
    }
};
