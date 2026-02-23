/**
 * Get the end moment of an event as a Date (local time).
 * Uses endTime if set; else startTime + durationHours; else end of event date.
 * @param {Object} ev - Event with date, startTime?, endTime?, durationHours?
 * @returns {Date}
 */
export function getEventEndMoment(ev) {
  if (!ev || !ev.date) return new Date(0);
  const d = new Date(ev.date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  const parseTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const parts = timeStr.trim().split(':').map((n) => parseInt(n, 10) || 0);
    const hours = (parts[0] ?? 0) % 24;
    const minutes = (parts[1] ?? 0) % 60;
    return { hours, minutes };
  };

  // Explicit end time
  if (ev.endTime && ev.endTime.trim()) {
    const t = parseTime(ev.endTime);
    if (t) {
      const end = new Date(year, month, day, t.hours, t.minutes, 59, 999);
      return end;
    }
  }

  // Start time + duration
  if (ev.startTime && ev.startTime.trim() && ev.durationHours != null && ev.durationHours >= 1) {
    const t = parseTime(ev.startTime);
    if (t) {
      const start = new Date(year, month, day, t.hours, t.minutes, 0, 0);
      const end = new Date(start.getTime() + ev.durationHours * 60 * 60 * 1000);
      return end;
    }
  }

  // Start time only: treat as end of that hour
  if (ev.startTime && ev.startTime.trim()) {
    const t = parseTime(ev.startTime);
    if (t) {
      return new Date(year, month, day, t.hours, t.minutes, 59, 999);
    }
  }

  // No time: end of event date
  return new Date(year, month, day, 23, 59, 59, 999);
}

/**
 * Whether the event has already ended (end moment is in the past).
 * @param {Object} ev - Event object
 * @returns {boolean}
 */
export function isEventPast(ev) {
  return getEventEndMoment(ev) < new Date();
}
