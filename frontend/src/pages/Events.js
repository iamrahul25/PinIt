import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import './Events.css';

const DRIVE_TYPES = ['Cleanup', 'Plantation', 'Painting', 'Awareness', 'Other'];

function formatEventDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatEventTime(start, end) {
  if (!start && !end) return '';
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

export default function Events() {
  const navigate = useNavigate();
  const { loading: authLoading, isSignedIn, user, getToken } = useAuth();
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState('board');
  const [filterDate, setFilterDate] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [form, setForm] = useState({
    title: '',
    description: '',
    address: '',
    city: '',
    state: '',
    mapUrl: '',
    driveType: '',
    otherDriveName: '',
    date: '',
    startTime: '',
    endTime: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getAuthHeaders = useCallback(async (headers = {}) => {
    const token = await getToken();
    if (!token) throw new Error('Unable to acquire auth token');
    return { ...headers, Authorization: `Bearer ${token}` };
  }, [getToken]);

  const authFetch = useCallback(async (url, options = {}) => {
    const headers = await getAuthHeaders(options.headers || {});
    return fetch(url, { ...options, headers });
  }, [getAuthHeaders]);

  const fetchEvents = useCallback(async (skipCount = 0, append = false, viewMode = 'board') => {
    try {
      if (skipCount === 0) setLoading(true);
      else setLoadingMore(true);
      if (viewMode === 'my') {
        const res = await authFetch(`${API_BASE_URL}/api/events/my/submissions`);
        if (!res.ok) throw new Error('Failed to fetch your events');
        const list = await res.json();
        setEvents(Array.isArray(list) ? list : []);
        setTotal(Array.isArray(list) ? list.length : 0);
        setSkip(list.length);
      } else {
        const params = new URLSearchParams({ limit: 10, skip: skipCount });
        if (filterCity.trim()) params.set('city', filterCity.trim());
        if (filterDate) params.set('date', filterDate);
        const res = await authFetch(`${API_BASE_URL}/api/events?${params}`);
        if (!res.ok) throw new Error('Failed to fetch events');
        const data = await res.json();
        if (append) {
          setEvents((prev) => [...prev, ...(data.events || [])]);
        } else {
          setEvents(data.events || []);
        }
        setTotal(data.total ?? 0);
        setSkip(skipCount + (data.events?.length || 0));
      }
    } catch (err) {
      setError(err.message || 'Could not load events');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [authFetch, filterCity, filterDate]);

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) navigate('/login', { replace: true });
  }, [authLoading, isSignedIn, navigate]);

  useEffect(() => {
    if (!isSignedIn || authLoading) return;
    setSkip(0);
    fetchEvents(0, false, view);
  }, [isSignedIn, authLoading, view, filterCity, filterDate, fetchEvents]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.title.trim()) {
      setError('Event title is required.');
      return;
    }
    if (!form.date) {
      setError('Event date is required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          location: {
            address: form.address.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            mapUrl: form.mapUrl.trim()
          },
          driveType: form.driveType.trim(),
          otherDriveName: form.driveType === 'Other' ? form.otherDriveName.trim() : '',
          date: form.date,
          startTime: form.startTime.trim(),
          endTime: form.endTime.trim(),
          authorName: user?.fullName || user?.email || 'Anonymous'
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create event');
      }
      setSuccess('Event created successfully!');
      setForm({
        title: '',
        description: '',
        address: '',
        city: '',
        state: '',
        mapUrl: '',
        driveType: '',
        otherDriveName: '',
        date: '',
        startTime: '',
        endTime: ''
      });
      setSkip(0);
      fetchEvents(0, false, view);
    } catch (err) {
      setError(err.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadMore = () => {
    fetchEvents(skip, true);
  };

  const handleAttend = async (eventId) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/events/${eventId}/attend`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to update attendance');
      const data = await res.json();
      setEvents((prev) =>
        prev.map((ev) =>
          ev._id === eventId
            ? { ...ev, volunteerCount: data.volunteerCount, hasAttending: data.hasAttending }
            : ev
        )
      );
    } catch (err) {
      setError(err.message || 'Could not update attendance');
    }
  };

  if (authLoading) {
    return (
      <div className="events-page">
        <p>Loading...</p>
      </div>
    );
  }
  if (!isSignedIn) return null;

  return (
    <div className="events-page">
      <main className="events-main">
        <div className="events-layout">
          <aside className="events-aside">
            <div className="events-form-card">
              <h2 className="events-form-title">Create an Event</h2>
              <p className="events-form-desc">
                Add an upcoming event conducted by an NGO or a group. Others can see it and mark their attendance.
              </p>
              <form className="events-form" onSubmit={handleSubmit}>
                <div className="events-field">
                  <label className="events-label">Title of Event <span className="events-required">*</span></label>
                  <input
                    type="text"
                    className="events-input"
                    placeholder="e.g. Community Cleanup Drive"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="events-field">
                  <label className="events-label">Description of Event</label>
                  <textarea
                    className="events-input events-textarea"
                    placeholder="What will be happening / what will people have to do..."
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="events-field-group">
                  <span className="events-group-label">Location</span>
                  <div className="events-field">
                    <label className="events-label">Complete address</label>
                    <input
                      type="text"
                      className="events-input"
                      placeholder="Street, area, landmark"
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    />
                  </div>
                  <div className="events-field">
                    <label className="events-label">City and State</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="events-input"
                        placeholder="City"
                        value={form.city}
                        onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="text"
                        className="events-input"
                        placeholder="State"
                        value={form.state}
                        onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                  <div className="events-field">
                    <label className="events-label">Exact location (Google Map shared URL)</label>
                    <input
                      type="url"
                      className="events-input"
                      placeholder="https://maps.google.com/..."
                      value={form.mapUrl}
                      onChange={(e) => setForm((f) => ({ ...f, mapUrl: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="events-field">
                  <label className="events-label">Type of drive</label>
                  <select
                    className="events-input events-select"
                    value={form.driveType}
                    onChange={(e) => setForm((f) => ({ ...f, driveType: e.target.value }))}
                  >
                    <option value="">Select type</option>
                    {DRIVE_TYPES.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  {form.driveType === 'Other' && (
                    <input
                      type="text"
                      className="events-input"
                      placeholder="Enter drive name"
                      value={form.otherDriveName}
                      onChange={(e) => setForm((f) => ({ ...f, otherDriveName: e.target.value }))}
                      style={{ marginTop: '0.5rem' }}
                    />
                  )}
                </div>
                <div className="events-field">
                  <label className="events-label">Date <span className="events-required">*</span></label>
                  <input
                    type="date"
                    className="events-input"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="events-field-group">
                  <span className="events-group-label">Time</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div className="events-field" style={{ flex: 1 }}>
                      <label className="events-label">Start time</label>
                      <input
                        type="time"
                        className="events-input"
                        value={form.startTime}
                        onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                      />
                    </div>
                    <div className="events-field" style={{ flex: 1 }}>
                      <label className="events-label">End time</label>
                      <input
                        type="time"
                        className="events-input"
                        value={form.endTime}
                        onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                {error && <div className="events-msg events-msg-error" role="alert">{error}</div>}
                {success && <div className="events-msg events-msg-success">{success}</div>}
                <button type="submit" className="events-submit-btn" disabled={submitting}>
                  <span className="material-icons-round" aria-hidden="true">event</span>
                  Create Event
                </button>
              </form>
              <div className="events-quick-links">
                <h3 className="events-quick-links-title">Quick Links</h3>
                <button
                  type="button"
                  className={`events-quick-link ${view === 'my' ? 'active' : ''}`}
                  onClick={() => setView('my')}
                >
                  <span className="material-icons-round" aria-hidden="true">history</span>
                  My Events
                </button>
                <button
                  type="button"
                  className={`events-quick-link ${view === 'board' ? 'active' : ''}`}
                  onClick={() => setView('board')}
                >
                  <span className="material-icons-round" aria-hidden="true">event_available</span>
                  Upcoming Events
                </button>
              </div>
            </div>
          </aside>

          <section className="events-board" id="board">
            <div className="events-board-header">
              <div className="events-board-title-wrap">
                <h2 className="events-board-title">
                  {view === 'my' ? 'My Events' : 'Upcoming Events'}
                </h2>
                <span className="events-board-count">{total}</span>
              </div>
              {view === 'board' && (
                <div className="events-filters">
                  <label className="events-filter-label">
                    Date:
                    <input
                      type="date"
                      className="events-filter-input"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      style={{ marginLeft: '0.4rem' }}
                    />
                  </label>
                  <label className="events-filter-label">
                    City:
                    <input
                      type="text"
                      className="events-filter-input"
                      placeholder="Filter by city"
                      value={filterCity}
                      onChange={(e) => setFilterCity(e.target.value)}
                      style={{ marginLeft: '0.4rem', minWidth: '120px' }}
                    />
                  </label>
                </div>
              )}
            </div>

            {loading ? (
              <div className="events-loading">Loading events...</div>
            ) : events.length === 0 ? (
              <div className="events-empty">
                {view === 'my' ? 'You haven’t created any events yet.' : 'No upcoming events match your filters.'}
              </div>
            ) : (
              <div className="events-list">
                {events.map((ev) => (
                  <article key={ev._id} className="events-card">
                    <div className="events-card-icon-wrap">
                      <span className="material-icons-round">event</span>
                    </div>
                    <div className="events-card-attend-wrap">
                      <button
                        type="button"
                        className={`events-attend-btn ${ev.hasAttending ? 'attending' : ''}`}
                        onClick={() => handleAttend(ev._id)}
                        aria-label={ev.hasAttending ? "You're attending" : "I'll join"}
                      >
                        <span className="material-icons-round">{ev.hasAttending ? 'check_circle' : 'person_add'}</span>
                        {ev.hasAttending ? "I'm in" : "I'll join"}
                      </button>
                      <span className="events-volunteer-count">{ev.volunteerCount ?? 0} volunteers</span>
                    </div>
                    <div className="events-card-body">
                      <div className="events-card-head">
                        <h3 className="events-card-title">{ev.title}</h3>
                        <span className="events-card-date-pill">{formatEventDate(ev.date)}</span>
                      </div>
                      {ev.description && (
                        <p className="events-card-desc">{ev.description}</p>
                      )}
                      {(ev.location?.address || ev.location?.city || ev.location?.state) && (
                        <p className="events-card-location">
                          📍 {[ev.location.address, ev.location.city, ev.location.state].filter(Boolean).join(', ')}
                          {ev.location?.mapUrl && (
                            <> · <a href={ev.location.mapUrl} target="_blank" rel="noopener noreferrer">View on map</a></>
                          )}
                        </p>
                      )}
                      {(ev.startTime || ev.endTime) && (
                        <p className="events-card-time">🕐 {formatEventTime(ev.startTime, ev.endTime)}</p>
                      )}
                      {(ev.driveType || ev.otherDriveName) && (
                        <div className="events-card-tags">
                          <span className="events-tag">
                            {ev.driveType === 'Other' && ev.otherDriveName ? ev.otherDriveName : (ev.driveType || ev.otherDriveName)}
                          </span>
                        </div>
                      )}
                      <div className="events-card-meta">
                        <span>By {ev.authorName || 'Anonymous'}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {!loading && view === 'board' && events.length > 0 && events.length < total && (
              <div className="events-load-more-wrap">
                <button
                  type="button"
                  className="events-load-more-btn"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading...' : 'Load more events'}
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );  
}
