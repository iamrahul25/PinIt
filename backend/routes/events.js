const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// Helper: add hasAttending and volunteerCount to event list
function withAttendance(events, userId) {
  return events.map(({ attendees, ...e }) => ({
    ...e,
    volunteerCount: Array.isArray(attendees) ? attendees.length : 0,
    hasAttending: userId && Array.isArray(attendees) && attendees.some((a) => a.userId === userId)
  }));
}

// List upcoming events (paginated, filter by date and city)
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
    const city = (req.query.city || '').trim();
    const dateFilter = req.query.date; // YYYY-MM-DD optional
    const pinId = (req.query.pinId || '').trim();
    const userId = req.auth?.userId;

    const query = {};
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (pinId) {
      query.pinId = pinId;
    }

    if (dateFilter) {
      const [y, m, d] = dateFilter.split('-').map(Number);
      if (y && m && d) {
        const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
        query.date = { $gte: start, $lte: end };
      } else {
        query.date = { $gte: today };
      }
    } else if (!pinId) {
      query.date = { $gte: today };
    }
    // When filtering by pinId only, include all events (upcoming and past) for that pin

    if (city) {
      query['location.city'] = new RegExp(city, 'i');
    }

    const raw = await Event.find(query)
      .sort({ date: 1, startTime: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const total = await Event.countDocuments(query);
    const events = withAttendance(raw, userId);
    res.json({ events, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create event
router.post('/', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const {
      title,
      description,
      location,
      driveType,
      otherDriveName,
      foundationId,
      foundationName,
      foundationLogoUrl,
      pinId,
      pinLink,
      bannerUrl,
      date,
      startTime,
      endTime,
      durationHours,
      authorName
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Event title is required' });
    }
    const foundationNameVal = (foundationName && String(foundationName).trim()) || '';
    if (!foundationNameVal) {
      return res.status(400).json({ error: 'Foundation name is required. Please verify a foundation.' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Event date is required' });
    }

    const eventDate = new Date(date);
    if (isNaN(eventDate.getTime())) {
      return res.status(400).json({ error: 'Invalid event date' });
    }

    const driveTypeVal = (driveType && String(driveType).trim()) || '';
    const otherName = (otherDriveName && String(otherDriveName).trim()) || '';
    let pinIdVal = (pinId && String(pinId).trim()) || '';
    if (!pinIdVal && pinLink && String(pinLink).trim()) {
      const match = String(pinLink).trim().match(/\/pin\/([a-zA-Z0-9_-]+)/i);
      if (match) pinIdVal = match[1];
    }
    const bannerUrlVal = (bannerUrl && String(bannerUrl).trim()) || '';

    const event = new Event({
      title: String(title).trim(),
      description: description ? String(description).trim() : '',
      foundationId: (foundationId && String(foundationId).trim()) || '',
      foundationName: foundationNameVal,
      foundationLogoUrl: (foundationLogoUrl && String(foundationLogoUrl).trim()) || '',
      location: {
        address: (location?.address || '').trim(),
        city: (location?.city || '').trim(),
        state: (location?.state || '').trim(),
        mapUrl: (location?.mapUrl || '').trim()
      },
      driveType: driveTypeVal,
      otherDriveName: otherName,
      pinId: pinIdVal,
      bannerUrl: bannerUrlVal,
      date: eventDate,
      startTime: (startTime != null && startTime !== '') ? String(startTime).trim() : '',
      endTime: (endTime != null && endTime !== '') ? String(endTime).trim() : '',
      durationHours: durationHours != null && durationHours >= 1 && durationHours <= 10 ? parseInt(durationHours, 10) : null,
      attendees: [],
      authorId: userId,
      authorName: authorName || 'Anonymous'
    });
    await event.save();
    const out = event.toObject();
    res.status(201).json(withAttendance([out], userId)[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get current user's created events
router.get('/my/submissions', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const raw = await Event.find({ authorId: userId })
      .sort({ date: 1, startTime: 1 })
      .lean();
    res.json(withAttendance(raw, userId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle attendance (I'll join / I won't join)
router.post('/:id/attend', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const existingIndex = (event.attendees || []).findIndex((a) => a.userId === userId);
    if (existingIndex !== -1) {
      event.attendees.splice(existingIndex, 1);
    } else {
      event.attendees.push({ userId });
    }
    event.updatedAt = new Date();
    await event.save();
    const hasAttending = event.attendees.some((a) => a.userId === userId);
    res.json({
      volunteerCount: event.attendees.length,
      hasAttending
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get single event
router.get('/:id', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const event = await Event.findById(req.params.id).lean();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const [out] = withAttendance([event], userId);
    res.json(out);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
