import { connectDB, Round, Bet } from './utils/db.js';
import { getColor, getSize, calculateWinnings } from './utils/game-helpers.js';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// getColor, getSize, calculateWinnings are imported from utils/game-helpers.js

// This is the scheduled function that runs every minute
export const handler = async (event) => {
    console.log('Scheduled auto-result triggered at:', new Date().toISOString());

    await connectDB();

    try {
        // Get the previous round (current time - 1 minute)
        const previousRoundId = Math.floor(Date.now() / 60000) - 1;

        console.log('Checking round:', previousRoundId);

        // Check if this round already has a result
        const existingRound = await Round.findOne({ roundId: previousRoundId });

        if (existingRound && existingRound.result !== null && existingRound.result !== undefined) {
            console.log('Round already has result:', existingRound.result);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    message: 'Round already has result',
                    roundId: previousRoundId,
                    result: existingRound.result
                }),
            };
        }

        // Generate random result (0-9)
        const randomResult = Math.floor(Math.random() * 10);
        const color = getColor(randomResult);
        const size = getSize(randomResult);

        console.log('Auto-generating result:', randomResult);

        // Save the result
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

        // Calculate winnings
        await calculateWinnings(previousRoundId, randomResult);

        // Database cleanup - keep only last 20 rounds
        const totalRounds = await Round.countDocuments();
        if (totalRounds > 20) {
            console.log('Cleaning up old rounds, total:', totalRounds);

            // Get the 20 most recent round IDs
            const recentRounds = await Round.find()
                .sort({ roundId: -1 })
                .limit(20)
                .select('roundId');

            const recentRoundIds = recentRounds.map(r => r.roundId);

            // Delete all rounds not in the recent 20
            const deletedRounds = await Round.deleteMany({
                roundId: { $nin: recentRoundIds }
            });

            // Also cleanup associated bets for deleted rounds
            const deletedBets = await Bet.deleteMany({
                roundId: { $nin: recentRoundIds }
            });

            console.log(`Cleanup complete: Deleted ${deletedRounds.deletedCount} rounds and ${deletedBets.deletedCount} bets`);
        }

        console.log('Scheduled auto result set successfully');

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
