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
 * Compute the [start, end) date window for a given period.
 * Uses the requester's timezone offset for daily/weekly so "today" matches local date (fixes IST/UTC mismatch).
 * @param {'daily'|'weekly'|'monthly'|'yearly'} period
 * @param {number} [tzOffsetMinutes] - Timezone offset in minutes (e.g. 330 for IST). If omitted, falls back to UTC.
 * @returns {{ periodStart: Date, periodEnd: Date }}
 */
function getPeriodWindow(period, tzOffsetMinutes = 0) {
    const now = new Date();
    // "Now" in the user's local timezone for date-boundary calculations
    const localNow = new Date(now.getTime() + tzOffsetMinutes * 60 * 1000);
    const y = localNow.getUTCFullYear();
    const m = localNow.getUTCMonth();
    const d = localNow.getUTCDate();
    const dow = localNow.getUTCDay();
    let periodStart, periodEnd;

    if (period === 'daily') {
        // Start of today in user's timezone, expressed as UTC
        periodStart = new Date(Date.UTC(y, m, d) - tzOffsetMinutes * 60 * 1000);
        periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
    } else if (period === 'monthly') {
        periodStart = new Date(Date.UTC(y, m, 1) - tzOffsetMinutes * 60 * 1000);
        periodEnd = new Date(Date.UTC(y, m + 1, 1) - tzOffsetMinutes * 60 * 1000);
    } else if (period === 'yearly') {
        periodStart = new Date(Date.UTC(y, 0, 1) - tzOffsetMinutes * 60 * 1000);
        periodEnd = new Date(Date.UTC(y + 1, 0, 1) - tzOffsetMinutes * 60 * 1000);
    } else {
        // default: weekly (Mon–Sun) in user's timezone
        const daysFromMonday = (dow + 6) % 7;
        const monDate = new Date(Date.UTC(y, m, d - daysFromMonday));
        periodStart = new Date(monDate.getTime() - tzOffsetMinutes * 60 * 1000);
        periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    return { periodStart, periodEnd };
}

/**
 * GET /api/leaderboard?period=weekly|monthly|yearly
 * Returns ALL users ranked by their score for the selected period.
 * Users with 0 contributions still appear (seeded from UserData).
 * Response is capped at top 10.
 */
router.get('/', async (req, res) => {
    try {
        const period = ['daily', 'weekly', 'monthly', 'yearly'].includes(req.query.period)
            ? req.query.period
            : 'weekly';

        // User's timezone offset in minutes (e.g. 330 for IST). Ensures "today" matches local date.
        let tzOffsetMinutes = 0;
        const tzParam = req.query.timezone;
        if (tzParam !== undefined && tzParam !== '') {
            const parsed = parseInt(tzParam, 10);
            if (!isNaN(parsed) && Math.abs(parsed) <= 14 * 60) {
                tzOffsetMinutes = parsed; // e.g. 330 for IST
            }
        }

        const { periodStart, periodEnd } = getPeriodWindow(period, tzOffsetMinutes);
        const timeFilter = { $gte: periodStart, $lt: periodEnd };

        // ── 1. Seed map with every registered user at 0 ───────────────────────
        const allUsers = await UserData.find({}, { userId: 1, username: 1, email: 1, _id: 0 });

        const userMap = {};
        const profileMap = {};
        for (const u of allUsers) {
            userMap[u.userId] = { pins: 0, ngos: 0, events: 0, comments: 0, suggestion: 0, total: 0 };
            profileMap[u.userId] = { username: u.username || u.email || 'Anonymous', email: u.email || '' };
        }

        // ── 2. Aggregate contributions in parallel ────────────────────────────
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
            Suggestion.aggregate([
                { $match: { createdAt: timeFilter, authorId: { $ne: '', $exists: true } } },
                { $group: { _id: '$authorId', count: { $sum: 1 } } },
            ]),
        ]);

        // ── 3. Merge scores — also handles contributors not in UserData ───────
        const ensure = (uid) => {
            if (!userMap[uid]) {
                userMap[uid] = { pins: 0, ngos: 0, events: 0, comments: 0, suggestion: 0, total: 0 };
            }
        };

        for (const { _id, count } of pins) {
            ensure(_id); userMap[_id].pins += count; userMap[_id].total += count * SCORES.pin;
        }
        for (const { _id, count } of ngos) {
            ensure(_id); userMap[_id].ngos += count; userMap[_id].total += count * SCORES.ngo;
        }
        for (const { _id, count } of events) {
            ensure(_id); userMap[_id].events += count; userMap[_id].total += count * SCORES.event;
        }
        for (const { _id, count } of comments) {
            ensure(_id); userMap[_id].comments += count; userMap[_id].total += count * SCORES.comment;
        }
        for (const { _id, count } of suggestions) {
            ensure(_id); userMap[_id].suggestion += count; userMap[_id].total += count * SCORES.suggestion;
        }

        // ── 4. Sort & cap ─────────────────────────────────────────────────────
        const sorted = Object.entries(userMap)
            .sort(([, a], [, b]) => b.total - a.total)
            .slice(0, 10);

        const leaders = sorted.map(([uid, stats], idx) => ({
            rank: idx + 1,
            userId: uid,
            username: profileMap[uid]?.username || 'Anonymous',
            email: profileMap[uid]?.email || '',
            ...stats,
        }));

        return res.json({ leaders, periodStart, periodEnd, period, scores: SCORES });
    } catch (err) {
        console.error('Leaderboard error:', err);
        return res.status(500).json({ error: 'Failed to compute leaderboard' });
    }
});

// Keep the old /weekly path alive for backward compatibility
router.get('/weekly', (req, res) => {
    req.query.period = 'weekly';
    // re-use the main handler via redirect
    res.redirect(`/api/leaderboard?period=weekly`);
});

module.exports = router;
