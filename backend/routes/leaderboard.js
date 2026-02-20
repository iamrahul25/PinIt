const express = require('express');
const router = express.Router();

const Pin = require('../models/Pin');
const Ngo = require('../models/Ngo');
const Event = require('../models/Event');
const Comment = require('../models/Comment');
const Suggestion = require('../models/Suggestion');
const UserData = require('../models/UserData');

// Scoring weights per contribution type
const SCORES = {
    pin: 10,
    ngo: 20,
    event: 15,
    comment: 3,
    suggestion: 5,
};

/**
 * GET /api/leaderboard/weekly
 * Returns ALL users ranked by their score for the current week (Mon–Sun).
 * Users with 0 contributions still appear, ranked below active contributors.
 * Response is capped at top 10.
 */
router.get('/weekly', async (req, res) => {
    try {
        // ── 1. Current week window (Monday 00:00:00 UTC → next Monday) ──────────
        const now = new Date();
        const dayOfWeek = now.getUTCDay();          // 0=Sun, 1=Mon … 6=Sat
        const daysFromMonday = (dayOfWeek + 6) % 7; // distance back to last Monday
        const weekStart = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() - daysFromMonday,
            0, 0, 0, 0
        ));
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const timeFilter = { $gte: weekStart, $lt: weekEnd };

        // ── 2. Fetch ALL registered users to seed the map with 0-point entries ──
        const allUsers = await UserData.find({}, { userId: 1, username: 1, email: 1, _id: 0 });

        // Pre-seed every user at zero so they always appear in the leaderboard
        const userMap = {};
        const profileMap = {};
        for (const u of allUsers) {
            userMap[u.userId] = { pins: 0, ngos: 0, events: 0, comments: 0, suggestion: 0, total: 0 };
            profileMap[u.userId] = { username: u.username || u.email || 'Anonymous', email: u.email || '' };
        }

        // ── 3. Aggregate weekly contributions in parallel ────────────────────────
        const [pins, ngos, events, comments, suggestions] = await Promise.all([
            Pin.aggregate([
                { $match: { createdAt: timeFilter, contributor_id: { $ne: '', $exists: true } } },
                { $group: { _id: '$contributor_id', count: { $sum: 1 } } },
            ]),
            Ngo.aggregate([
                { $match: { createdAt: timeFilter, authorId: { $ne: '', $exists: true } } },
                { $group: { _id: '$authorId', count: { $sum: 1 } } },
            ]),
            Event.aggregate([
                { $match: { createdAt: timeFilter, authorId: { $ne: '', $exists: true } } },
                { $group: { _id: '$authorId', count: { $sum: 1 } } },
            ]),
            Comment.aggregate([
                { $match: { createdAt: timeFilter, authorId: { $ne: '', $exists: true } } },
                { $group: { _id: '$authorId', count: { $sum: 1 } } },
            ]),
            // Suggestions made: group by authorId directly
            Suggestion.aggregate([
                { $match: { createdAt: timeFilter, authorId: { $ne: '', $exists: true } } },
                { $group: { _id: '$authorId', count: { $sum: 1 } } },
            ]),
        ]);

        // ── 4. Merge scores into userMap ─────────────────────────────────────────
        // Helper: some contributors may not be in UserData (edge case) — still include them
        const ensure = (uid) => {
            if (!userMap[uid]) {
                userMap[uid] = { pins: 0, ngos: 0, events: 0, comments: 0, suggestion: 0, total: 0 };
            }
        };

        for (const { _id, count } of pins) {
            ensure(_id);
            userMap[_id].pins += count;
            userMap[_id].total += count * SCORES.pin;
        }
        for (const { _id, count } of ngos) {
            ensure(_id);
            userMap[_id].ngos += count;
            userMap[_id].total += count * SCORES.ngo;
        }
        for (const { _id, count } of events) {
            ensure(_id);
            userMap[_id].events += count;
            userMap[_id].total += count * SCORES.event;
        }
        for (const { _id, count } of comments) {
            ensure(_id);
            userMap[_id].comments += count;
            userMap[_id].total += count * SCORES.comment;
        }
        for (const { _id, count } of suggestions) {
            ensure(_id);
            userMap[_id].suggestion += count;
            userMap[_id].total += count * SCORES.suggestion;
        }

        // ── 5. Sort all users by score desc, cap at top 10 ──────────────────────
        const sorted = Object.entries(userMap)
            .sort(([, a], [, b]) => b.total - a.total)
            .slice(0, 10);

        // ── 6. Build ranked response ─────────────────────────────────────────────
        const leaders = sorted.map(([uid, stats], idx) => ({
            rank: idx + 1,
            userId: uid,
            username: profileMap[uid]?.username || 'Anonymous',
            email: profileMap[uid]?.email || '',
            ...stats,
        }));

        return res.json({ leaders, weekStart, weekEnd, scores: SCORES });
    } catch (err) {
        console.error('Leaderboard error:', err);
        return res.status(500).json({ error: 'Failed to compute leaderboard' });
    }
});

module.exports = router;
