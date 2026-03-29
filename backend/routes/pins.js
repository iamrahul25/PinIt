const express = require('express');
const router = express.Router();
const Pin = require('../models/Pin');
const Comment = require('../models/Comment');
const UserData = require('../models/UserData');
const { deleteFromCloudinaryByUrls } = require('../utils/cloudinary');
const { sanitizePinForResponse } = require('../utils/sanitizePin');
const { normalizePinImageFromBody, normalizePinImagesArrayFromBody } = require('../utils/pinImageEntry');

const MAX_IMAGES_PER_SECTION = 10;

// Get all pins (optional query: createdBy=contributor_id for user-contributed pins)
router.get('/', async (req, res) => {
  try {
    const { createdBy } = req.query;
    const filter = createdBy ? { contributor_id: createdBy } : {};
    const pins = await Pin.find(filter).populate('comments').sort({ createdAt: -1 });
    const userId = req.auth?.userId;
    const sanitized = pins.map((p) => sanitizePinForResponse(p, userId));
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get saved pin IDs for a user (from UserData – personal data per user, not on Pin)
router.get('/saved', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const doc = await UserData.findOne({ userId }).lean();
    res.json({ pinIds: doc ? (doc.pinIds || []) : [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/pins/analytics
 * Aggregated stats for the analytics dashboard: counts by problem type, resolution status,
 * severity, recent activity, and a short list of latest issues.
 */
router.get('/analytics', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [facetRow] = await Pin.aggregate([
      {
        $facet: {
          totalPins: [{ $count: 'count' }],
          byProblemType: [
            { $group: { _id: '$problemType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          resolved: [
            { $match: { 'fixStatus.resolvedAt': { $ne: null } } },
            { $count: 'count' }
          ],
          inProgress: [
            {
              $match: {
                $and: [
                  { 'fixStatus.verifiedAt': { $ne: null } },
                  {
                    $or: [
                      { 'fixStatus.resolvedAt': null },
                      { 'fixStatus.resolvedAt': { $exists: false } }
                    ]
                  }
                ]
              }
            },
            { $count: 'count' }
          ],
          open: [
            {
              $match: {
                $and: [
                  {
                    $or: [
                      { 'fixStatus.resolvedAt': null },
                      { 'fixStatus.resolvedAt': { $exists: false } }
                    ]
                  },
                  {
                    $or: [
                      { fixStatus: { $exists: false } },
                      { 'fixStatus.verifiedAt': null }
                    ]
                  }
                ]
              }
            },
            { $count: 'count' }
          ],
          pinsLast30Days: [
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            { $count: 'count' }
          ],
          pinsLast7Days: [
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            { $count: 'count' }
          ],
          avgSeverity: [
            { $group: { _id: null, avg: { $avg: '$severity' } } }
          ],
          totalUpvotes: [
            { $group: { _id: null, total: { $sum: '$upvotes' } } }
          ],
          distinctReporters: [
            { $match: { contributor_id: { $nin: ['', null] } } },
            { $group: { _id: '$contributor_id' } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    const f = facetRow || {};
    const totalPins = f.totalPins?.[0]?.count ?? 0;
    const resolvedCount = f.resolved?.[0]?.count ?? 0;
    const inProgressCount = f.inProgress?.[0]?.count ?? 0;
    const openCount = f.open?.[0]?.count ?? 0;
    const pinsLast30Days = f.pinsLast30Days?.[0]?.count ?? 0;
    const pinsLast7Days = f.pinsLast7Days?.[0]?.count ?? 0;
    const avgSeverity = f.avgSeverity?.[0]?.avg != null
      ? Math.round(f.avgSeverity[0].avg * 10) / 10
      : 0;
    const totalUpvotes = f.totalUpvotes?.[0]?.total ?? 0;
    const distinctReporters = f.distinctReporters?.[0]?.count ?? 0;

    const rawTypes = f.byProblemType || [];
    const byProblemType = rawTypes.map((row) => ({
      problemType: row._id || 'Other',
      count: row.count,
      percentage: totalPins > 0 ? Math.round((row.count / totalPins) * 1000) / 10 : 0
    }));

    const recentDocs = await Pin.find({})
      .select('problemHeading problemType location fixStatus createdAt severity images upvotes')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    function statusLabel(pin) {
      const fs = pin.fixStatus || {};
      if (fs.resolvedAt) return 'resolved';
      if (fs.verifiedAt) return 'in_progress';
      return 'open';
    }

    const recentPins = recentDocs.map((p) => ({
      _id: p._id,
      problemHeading: p.problemHeading || '',
      problemType: p.problemType || 'Other',
      address: (p.location && p.location.address) || '',
      severity: p.severity ?? 5,
      upvotes: typeof p.upvotes === 'number' ? p.upvotes : 0,
      status: statusLabel(p),
      createdAt: p.createdAt,
      firstImage: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null
    }));

    res.json({
      totalPins,
      resolvedCount,
      inProgressCount,
      openCount,
      pinsLast30Days,
      pinsLast7Days,
      avgSeverity,
      totalUpvotes,
      distinctReporters,
      resolutionRatePercent: totalPins > 0
        ? Math.round((resolvedCount / totalPins) * 1000) / 10
        : 0,
      byProblemType,
      recentPins
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const MS_DAY = 86400000;

function truncDayUTC(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

function addDaysUTC(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function addMonthUTC(d) {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + 1);
  return x;
}

function monthStartUTC(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * Align Mongo $dateTrunc bucket keys with a dense timeline for the chart.
 */
function buildDenseActivitySeries(start, end, unit, reportedAgg, resolvedAgg) {
  const rep = new Map();
  for (const r of reportedAgg) {
    rep.set(new Date(r._id).getTime(), r.reported);
  }
  const res = new Map();
  for (const r of resolvedAgg) {
    res.set(new Date(r._id).getTime(), r.resolved);
  }

  const series = [];
  if (unit === 'day') {
    let cur = truncDayUTC(new Date(start));
    const endDay = truncDayUTC(new Date(end));
    while (cur.getTime() <= endDay.getTime()) {
      const t = cur.getTime();
      series.push({
        t: cur.toISOString(),
        reported: rep.get(t) || 0,
        resolved: res.get(t) || 0
      });
      cur = addDaysUTC(cur, 1);
    }
  } else {
    let cur = monthStartUTC(new Date(start));
    const endM = monthStartUTC(new Date(end));
    while (cur.getTime() <= endM.getTime()) {
      const t = cur.getTime();
      series.push({
        t: cur.toISOString(),
        reported: rep.get(t) || 0,
        resolved: res.get(t) || 0
      });
      cur = addMonthUTC(cur);
    }
  }
  return series;
}

/**
 * GET /api/pins/analytics/activity?range=7d|30d|365d|all
 * Time series: issues reported (by createdAt) vs resolved (by fixStatus.resolvedAt) per bucket.
 */
router.get('/analytics/activity', async (req, res) => {
  try {
    const range = req.query.range;
    const allowed = ['7d', '30d', '365d', 'all'];
    if (!allowed.includes(range)) {
      return res.status(400).json({ error: 'Invalid range. Use 7d, 30d, 365d, or all.' });
    }

    const end = new Date();
    let start;
    let unit;

    if (range === '7d') {
      unit = 'day';
      start = new Date(end.getTime() - 7 * MS_DAY);
    } else if (range === '30d') {
      unit = 'day';
      start = new Date(end.getTime() - 30 * MS_DAY);
    } else if (range === '365d') {
      unit = 'day';
      start = new Date(end.getTime() - 365 * MS_DAY);
    } else {
      unit = 'month';
      const first = await Pin.findOne().sort({ createdAt: 1 }).select('createdAt').lean();
      start = first?.createdAt ? new Date(first.createdAt) : new Date(end.getTime() - 365 * MS_DAY);
      start = monthStartUTC(start);
    }

    const truncUnit = unit;

    const [reportedAgg, resolvedAgg] = await Promise.all([
      Pin.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: { $dateTrunc: { date: '$createdAt', unit: truncUnit, timezone: 'UTC' } },
            reported: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Pin.aggregate([
        {
          $match: {
            'fixStatus.resolvedAt': { $gte: start, $lte: end, $ne: null, $exists: true }
          }
        },
        {
          $group: {
            _id: { $dateTrunc: { date: '$fixStatus.resolvedAt', unit: truncUnit, timezone: 'UTC' } },
            resolved: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    const series = buildDenseActivitySeries(start, end, unit, reportedAgg, resolvedAgg);

    res.json({ range, unit, series });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save a pin for a user (store in UserData only; Pin DB unchanged)
router.post('/:id/save', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const pinId = req.params.id;
    const pin = await Pin.findById(pinId);
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }
    const { email, username } = req.body || {};
    let doc = await UserData.findOne({ userId });
    if (!doc) {
      doc = new UserData({
        userId,
        pinIds: [],
        ...(email !== undefined && { email: email || '' }),
        ...(username !== undefined && { username: username || '' })
      });
    } else {
      if (email !== undefined) doc.email = email || '';
      if (username !== undefined) doc.username = username || '';
    }
    const pinIds = doc.pinIds || [];
    if (pinIds.includes(pinId)) {
      doc.updatedAt = new Date();
      await doc.save();
      return res.json({ ok: true, pinIds: doc.pinIds });
    }
    doc.pinIds = [...pinIds, pinId];
    doc.updatedAt = new Date();
    await doc.save();
    res.json({ ok: true, pinIds: doc.pinIds });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Unsave a pin for a user (remove from UserData only)
router.delete('/:id/save', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const doc = await UserData.findOne({ userId });
    if (!doc) {
      return res.json({ ok: true, pinIds: [] });
    }
    doc.pinIds = (doc.pinIds || []).filter((id) => id !== req.params.id);
    doc.updatedAt = new Date();
    await doc.save();
    res.json({ ok: true, pinIds: doc.pinIds });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Verification role scores (must match frontend)
const ROLE_SCORES = { user: 10, reviewer: 30, ngo: 50, admin: 60 };

// Toggle verification for a pin
// Adds or removes the user from pinVerification array, storing their role
router.post('/:id/verify', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const pin = await Pin.findById(req.params.id);
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    // Get the user's role from UserData
    const userDoc = await UserData.findOne({ userId }).select('role').lean();
    const role = userDoc?.role || 'user';

    const verifications = pin.pinVerification || [];
    const idx = verifications.findIndex((v) => String(v.userId) === String(userId));

    if (idx >= 0) {
      // Remove verification (unverify)
      pin.pinVerification.splice(idx, 1);
    } else {
      // Add verification
      pin.pinVerification.push({ userId, role });
    }

    // Compute verification score after toggle
    const score = (pin.pinVerification || []).reduce(
      (sum, v) => sum + (ROLE_SCORES[v.role] || 10), 0
    );

    // Auto-set fixStatus dates when score crosses 80 threshold
    if (!pin.fixStatus) pin.fixStatus = {};
    if (score > 80 && !pin.fixStatus.verifiedAt) {
      pin.fixStatus.verifiedAt = new Date();
      pin.fixStatus.awaitingActionAt = new Date();
    }
    // If score drops back below threshold, clear the dates
    if (score <= 80 && pin.fixStatus.verifiedAt) {
      pin.fixStatus.verifiedAt = null;
      pin.fixStatus.awaitingActionAt = null;
    }

    pin.updatedAt = new Date();
    pin.markModified('fixStatus');
    await pin.save();

    const populated = await Pin.findById(pin._id).populate('comments');
    res.json(sanitizePinForResponse(populated, userId));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Toggle resolve vote for a pin (score-based, same mechanism as verification)
// Any user can vote; role-weighted score determines resolved status
router.post('/:id/resolve', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const pin = await Pin.findById(req.params.id);
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    // Get the user's role from UserData
    const userDoc = await UserData.findOne({ userId }).select('role').lean();
    const role = userDoc?.role || 'user';

    const resolves = pin.resolveVerification || [];
    const idx = resolves.findIndex((v) => String(v.userId) === String(userId));

    if (idx >= 0) {
      pin.resolveVerification.splice(idx, 1);
    } else {
      pin.resolveVerification.push({ userId, role });
    }

    // Compute resolve score
    const score = (pin.resolveVerification || []).reduce(
      (sum, v) => sum + (ROLE_SCORES[v.role] || 10), 0
    );

    // Auto-set fixStatus.resolvedAt when score crosses 80
    if (!pin.fixStatus) pin.fixStatus = {};
    if (score > 80 && !pin.fixStatus.resolvedAt) {
      pin.fixStatus.resolvedAt = new Date();
    }
    if (score <= 80 && pin.fixStatus.resolvedAt) {
      pin.fixStatus.resolvedAt = null;
    }

    pin.updatedAt = new Date();
    pin.markModified('fixStatus');
    await pin.save();

    const populated = await Pin.findById(pin._id).populate('comments');
    res.json(sanitizePinForResponse(populated, userId));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add one image to pin (before or after) — any authenticated user
router.post('/:id/images', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const pin = await Pin.findById(req.params.id);
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }
    const body = req.body || {};
    const { type, url, imageEntry } = body;
    let entry = null;
    if (imageEntry && typeof imageEntry === 'object') {
      entry = normalizePinImageFromBody(imageEntry);
    } else if (url && typeof url === 'string' && url.trim()) {
      entry = normalizePinImageFromBody({ src: url.trim() });
    }
    if (!entry) {
      return res.status(400).json({ error: 'Image url or imageEntry with src is required.' });
    }
    if (type !== 'before' && type !== 'after') {
      return res.status(400).json({ error: 'type must be "before" or "after".' });
    }
    if (type === 'before') {
      const before = pin.images || [];
      if (before.length >= MAX_IMAGES_PER_SECTION) {
        return res.status(400).json({ error: `Maximum ${MAX_IMAGES_PER_SECTION} before images allowed.` });
      }
      pin.images = [...before, entry];
    } else {
      const after = pin.imagesAfter || [];
      if (after.length >= MAX_IMAGES_PER_SECTION) {
        return res.status(400).json({ error: `Maximum ${MAX_IMAGES_PER_SECTION} after images allowed.` });
      }
      pin.imagesAfter = [...after, entry];
    }
    pin.updatedAt = new Date();
    await pin.save();
    const populated = await Pin.findById(pin._id).populate('comments');
    res.json(sanitizePinForResponse(populated, userId));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get pin by ID
router.get('/:id', async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.id).populate('comments');
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }
    res.json(sanitizePinForResponse(pin, req.auth?.userId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new pin
router.post('/', async (req, res) => {
  try {
    const { problemType, severity, location, images, imagesAfter, problemHeading, contributor_name, description, anonymous } = req.body;
    const contributorId = req.auth?.userId;
    if (!contributorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const heading = (problemHeading && String(problemHeading).trim()) || '';
    if (!heading) {
      return res.status(400).json({ error: 'Problem Heading is required.' });
    }
    const imageList = normalizePinImagesArrayFromBody(Array.isArray(images) ? images : []);
    if (imageList.length === 0) {
      return res.status(400).json({ error: 'At least one before image is required.' });
    }
    if (imageList.length > MAX_IMAGES_PER_SECTION) {
      return res.status(400).json({ error: `Maximum ${MAX_IMAGES_PER_SECTION} before images allowed.` });
    }
    const imageListAfter = normalizePinImagesArrayFromBody(Array.isArray(imagesAfter) ? imagesAfter : []);
    if (imageListAfter.length > MAX_IMAGES_PER_SECTION) {
      return res.status(400).json({ error: `Maximum ${MAX_IMAGES_PER_SECTION} after images allowed.` });
    }

    const pin = new Pin({
      problemType,
      severity,
      location,
      images: imageList,
      imagesAfter: imageListAfter,
      problemHeading: heading,
      contributor_id: contributorId,
      contributor_name: contributor_name || '',
      anonymous: anonymous !== false,
      description: description || ''
    });

    const savedPin = await pin.save();
    res.status(201).json(sanitizePinForResponse(savedPin, contributorId));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update pin (admin or pin creator only)
const ALLOWED_UPDATE_FIELDS = ['problemType', 'severity', 'location', 'images', 'imagesAfter', 'problemHeading', 'contributor_name', 'description', 'anonymous'];
router.put('/:id', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const existingPin = await Pin.findById(req.params.id).select('contributor_id').lean();
    if (!existingPin) {
      return res.status(404).json({ error: 'Pin not found' });
    }
    const isAdmin = (await UserData.findOne({ userId }).select('role').lean())?.role === 'admin';
    const isCreator = existingPin.contributor_id === userId;
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Forbidden: only admin or the pin creator can update this pin' });
    }
    if (Array.isArray(req.body.images)) {
      if (req.body.images.length === 0) {
        return res.status(400).json({ error: 'At least one before image is required.' });
      }
      if (req.body.images.length > MAX_IMAGES_PER_SECTION) {
        return res.status(400).json({ error: `Maximum ${MAX_IMAGES_PER_SECTION} before images allowed.` });
      }
    }
    if (Array.isArray(req.body.imagesAfter) && req.body.imagesAfter.length > MAX_IMAGES_PER_SECTION) {
      return res.status(400).json({ error: `Maximum ${MAX_IMAGES_PER_SECTION} after images allowed.` });
    }
    const updates = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Array.isArray(updates.images)) {
      updates.images = normalizePinImagesArrayFromBody(updates.images);
    }
    if (Array.isArray(updates.imagesAfter)) {
      updates.imagesAfter = normalizePinImagesArrayFromBody(updates.imagesAfter);
    }
    // When admin edits, preserve existing contributor_name if body sent empty (admin doesn't receive it due to sanitize)
    if (isAdmin && (updates.contributor_name === '' || (typeof updates.contributor_name === 'string' && !updates.contributor_name.trim()))) {
      delete updates.contributor_name;
    }
    updates.updatedAt = new Date();
    const pin = await Pin.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }
    res.json(sanitizePinForResponse(pin, userId));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete pin (admin or pin creator only)
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const existingPin = await Pin.findById(req.params.id).select('contributor_id images imagesAfter').lean();
    if (!existingPin) {
      return res.status(404).json({ error: 'Pin not found' });
    }
    const isAdmin = (await UserData.findOne({ userId }).select('role').lean())?.role === 'admin';
    const isCreator = existingPin.contributor_id === userId;
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Forbidden: only admin or the pin creator can delete this pin' });
    }
    // Delete images from Cloudinary before removing the pin
    const allImageUrls = [...(existingPin.images || []), ...(existingPin.imagesAfter || [])];
    await deleteFromCloudinaryByUrls(allImageUrls);
    const pin = await Pin.findByIdAndDelete(req.params.id);
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }
    // Delete associated comments
    await Comment.deleteMany({ pinId: req.params.id });
    res.json({ message: 'Pin deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
