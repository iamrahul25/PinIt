import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import './Events.css';

const DRIVE_TYPES = ['Cleanup', 'Plantation', 'Painting', 'Awareness', 'Other'];

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
  initialQuality: 0.8
};

/** Extract pin ID from a Pin-it pin URL (e.g. https://example.com/pin/abc123 or /pin/abc123) */
function extractPinIdFromLink(link) {
  if (!link || typeof link !== 'string') return null;
  const trimmed = link.trim();
  const match = trimmed.match(/\/pin\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

const DURATION_HOURS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function formatEventDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/** Format 24h time string (e.g. "14:30") to AM/PM (e.g. "2:30 PM") */
function formatTimeToAMPM(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const trimmed = timeStr.trim();
  const [h, m] = trimmed.split(':').map((n) => parseInt(n, 10) || 0);
  const hour = h % 24;
  const ampm = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const minStr = String(m).padStart(2, '0');
  return `${hour12}:${minStr} ${ampm}`;
}

function formatEventTime(start, durationHours) {
  if (!start && durationHours == null) return '';
  const startFormatted = start ? formatTimeToAMPM(start) : '';
  if (durationHours != null && durationHours >= 1) {
    const durationText = durationHours === 1 ? '1 hour' : `${durationHours} hours`;
    return startFormatted ? `${startFormatted} · ${durationText}` : durationText;
  }
  return startFormatted;
}

export default function Events() {
  const navigate = useNavigate();
  const { loading: authLoading, isSignedIn, user, getToken } = useAuth();
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState('board');
  const [dateInput, setDateInput] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [appliedDate, setAppliedDate] = useState('');
  const [appliedCity, setAppliedCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [form, setForm] = useState({
    title: '',
    description: '',
    foundationName: '',
    address: '',
    city: '',
    state: '',
    mapUrl: '',
    driveType: '',
    otherDriveName: '',
    pinLink: '',
    date: '',
    startTime: '',
    durationHours: ''
  });
  const [foundationVerified, setFoundationVerified] = useState(null);
  const [verifyingFoundation, setVerifyingFoundation] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const bannerInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedDescIds, setExpandedDescIds] = useState(new Set());

  const DESC_PREVIEW_LEN = 180;
  const toggleDesc = (id) => {
    setExpandedDescIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
        if (appliedCity.trim()) params.set('city', appliedCity.trim());
        if (appliedDate) params.set('date', appliedDate);
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
  }, [authFetch, appliedCity, appliedDate]);

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) navigate('/login', { replace: true });
  }, [authLoading, isSignedIn, navigate]);

  useEffect(() => {
    if (!isSignedIn || authLoading) return;
    setSkip(0);
    fetchEvents(0, false, view);
  }, [isSignedIn, authLoading, view, appliedCity, appliedDate, fetchEvents]);

  const handleFilterSearch = () => {
    setAppliedCity(cityInput);
    setAppliedDate(dateInput);
    setSkip(0);
  };

  const handleFilterReset = () => {
    setCityInput('');
    setDateInput('');
    setAppliedCity('');
    setAppliedDate('');
    setSkip(0);
  };

  const handleVerifyFoundation = async () => {
    const name = form.foundationName.trim();
    if (!name) {
      setError('Enter foundation name.');
      setFoundationVerified(null);
      return;
    }
    setError('');
    setVerifyingFoundation(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/ngos/verify?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.found && data.ngo) {
        setFoundationVerified({ id: data.ngo._id, name: data.ngo.name, logoUrl: data.ngo.logoUrl });
        setSuccess('Foundation verified.');
      } else {
        setFoundationVerified(null);
        setError('Foundation not found. Add the NGO/foundation on the NGO\'s page first.');
      }
    } catch {
      setFoundationVerified(null);
      setError('Could not verify foundation.');
    } finally {
      setVerifyingFoundation(false);
    }
  };

  const handleVerifyPinLink = async () => {
    const pinId = extractPinIdFromLink(form.pinLink);
    if (!pinId) {
      setError('Enter a valid Pin-it link (e.g. https://yoursite.com/pin/abc123).');
      setPinVerified(false);
      return;
    }
    setError('');
    setVerifyingPin(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/pins/${pinId}`);
      if (res.ok) {
        setPinVerified(true);
        setSuccess('Pin link is valid.');
      } else {
        setPinVerified(false);
        setError('This pin was not found. Check the link and try again.');
      }
    } catch {
      setPinVerified(false);
      setError('Could not verify pin link. Check the link and try again.');
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleBannerChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (e.g. JPG, PNG).');
      return;
    }
    setError('');
    try {
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
      setBannerFile(compressed);
      const reader = new FileReader();
      reader.onloadend = () => setBannerPreview(reader.result);
      reader.readAsDataURL(compressed);
    } catch {
      setError('Failed to process image.');
    }
    if (e.target) e.target.value = '';
  };

  const removeBanner = () => {
    setBannerFile(null);
    setBannerPreview('');
  };

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
    if (!foundationVerified) {
      setError('Foundation name is required. Please enter and verify a foundation.');
      return;
    }
    if (form.pinLink.trim() && !pinVerified) {
      setError('Please verify the pin link before submitting, or remove it.');
      return;
    }
    setSubmitting(true);
    try {
      let bannerUrl = '';
      if (bannerFile) {
        const formData = new FormData();
        formData.append('image', bannerFile);
        const uploadRes = await axios.post(
          `${API_BASE_URL}/api/images/upload`,
          formData,
          { headers: await getAuthHeaders({ 'Content-Type': 'multipart/form-data' }) }
        );
        bannerUrl = uploadRes.data?.url || '';
      }
      const pinId = extractPinIdFromLink(form.pinLink.trim()) || undefined;
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
          foundationId: foundationVerified.id,
          foundationName: foundationVerified.name,
          foundationLogoUrl: foundationVerified.logoUrl || undefined,
          pinId,
          pinLink: form.pinLink.trim() || undefined,
          bannerUrl: bannerUrl || undefined,
          date: form.date,
          startTime: form.startTime.trim(),
          durationHours: form.durationHours !== '' ? Number(form.durationHours) : undefined,
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
        foundationName: '',
        address: '',
        city: '',
        state: '',
        mapUrl: '',
        driveType: '',
        otherDriveName: '',
        pinLink: '',
        date: '',
        startTime: '',
        durationHours: ''
      });
      setFoundationVerified(null);
      setPinVerified(false);
      removeBanner();
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
                  <label className="events-label">Foundation Name <span className="events-required">*</span></label>
                  <p className="events-field-hint">NGO / foundation conducting the event. Must exist in the NGO list.</p>
                  <div className="events-pin-link-row">
                    <input
                      type="text"
                      className="events-input"
                      placeholder="e.g. Green Earth Foundation"
                      value={form.foundationName}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, foundationName: e.target.value }));
                        setFoundationVerified(null);
                        setSuccess('');
                      }}
                    />
                    <button
                      type="button"
                      className="events-verify-btn"
                      onClick={handleVerifyFoundation}
                      disabled={verifyingFoundation || !form.foundationName.trim()}
                    >
                      {verifyingFoundation ? 'Checking…' : foundationVerified ? 'Verified ✓' : 'Verify'}
                    </button>
                  </div>
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
                  <label className="events-label">Link to Pin (optional)</label>
                  <p className="events-field-hint">Full URL of a Pin on Pin-it, e.g. https://yoursite.com/pin/abc123</p>
                  <div className="events-pin-link-row">
                    <input
                      type="url"
                      className="events-input"
                      placeholder="https://.../pin/pin-id"
                      value={form.pinLink}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, pinLink: e.target.value }));
                        setPinVerified(false);
                        setSuccess('');
                      }}
                    />
                    <button
                      type="button"
                      className="events-verify-btn"
                      onClick={handleVerifyPinLink}
                      disabled={verifyingPin || !form.pinLink.trim()}
                    >
                      {verifyingPin ? 'Checking…' : pinVerified ? 'Verified ✓' : 'Verify'}
                    </button>
                  </div>
                </div>
                <div className="events-field">
                  <label className="events-label">Banner / drive location photo (max 1)</label>
                  <div className="events-banner-upload">
                    {bannerPreview ? (
                      <div className="events-banner-preview-wrap">
                        <img src={bannerPreview} alt="Banner preview" className="events-banner-preview" />
                        <button type="button" className="events-banner-remove" onClick={removeBanner} aria-label="Remove banner">
                          <span className="material-icons-round">close</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          ref={bannerInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleBannerChange}
                          className="events-file-input"
                          aria-label="Upload banner"
                        />
                        <button
                          type="button"
                          className="events-upload-banner-btn"
                          onClick={() => bannerInputRef.current?.click()}
                        >
                          <span className="material-icons-round">add_photo_alternate</span>
                          Add banner image
                        </button>
                      </>
                    )}
                  </div>
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
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div className="events-field" style={{ flex: '1 1 120px' }}>
                      <label className="events-label">Start time (24h format)</label>
                      <input
                        type="time"
                        className="events-input"
                        value={form.startTime}
                        onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                      />
                    </div>
                    <div className="events-field" style={{ flex: '1 1 120px' }}>
                      <label className="events-label">Duration (hours)</label>
                      <select
                        className="events-input events-select"
                        value={form.durationHours}
                        onChange={(e) => setForm((f) => ({ ...f, durationHours: e.target.value }))}
                      >
                        <option value="">Select</option>
                        {DURATION_HOURS_OPTIONS.map((h) => (
                          <option key={h} value={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>
                        ))}
                      </select>
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
                      value={dateInput}
                      onChange={(e) => setDateInput(e.target.value)}
                      style={{ marginLeft: '0.4rem' }}
                    />
                  </label>
                  <label className="events-filter-label">
                    City:
                    <input
                      type="text"
                      className="events-filter-input"
                      placeholder="Filter by city"
                      value={cityInput}
                      onChange={(e) => setCityInput(e.target.value)}
                      style={{ marginLeft: '0.4rem', minWidth: '120px' }}
                    />
                  </label>
                  <button
                    type="button"
                    className="events-filter-btn"
                    onClick={handleFilterSearch}
                  >
                    <span className="material-icons-round" aria-hidden="true">search</span>
                    Search
                  </button>
                  <button
                    type="button"
                    className="events-filter-btn events-filter-reset-btn"
                    onClick={handleFilterReset}
                  >
                    <span className="material-icons-round" aria-hidden="true">refresh</span>
                    Reset
                  </button>
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
                    {ev.bannerUrl && (
                      <div className="events-card-banner-wrap">
                        <img src={ev.bannerUrl} alt="" className="events-card-banner" />
                      </div>
                    )}
                    <div className="events-card-row">
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
                      {(ev.foundationName || ev.foundationLogoUrl) && (
                        <div className="events-card-foundation">
                          {ev.foundationLogoUrl && (
                            <img src={ev.foundationLogoUrl} alt="" className="events-card-foundation-logo" />
                          )}
                          <span className="events-card-foundation-name">{ev.foundationName}</span>
                        </div>
                      )}
                      {ev.description && (
                        <div className="events-card-desc-wrap">
                          <p className="events-card-desc">
                            {expandedDescIds.has(ev._id) || ev.description.length <= DESC_PREVIEW_LEN ? (
                              ev.description
                            ) : (
                              <>
                                {ev.description.slice(0, DESC_PREVIEW_LEN).trim()}
                                …{' '}
                                <button
                                  type="button"
                                  className="events-show-more-btn"
                                  onClick={() => toggleDesc(ev._id)}
                                >
                                  Show more
                                </button>
                              </>
                            )}
                            {ev.description.length > DESC_PREVIEW_LEN && expandedDescIds.has(ev._id) && (
                              <>
                                {' '}
                                <button
                                  type="button"
                                  className="events-show-more-btn"
                                  onClick={() => toggleDesc(ev._id)}
                                >
                                  Show less
                                </button>
                              </>
                            )}
                          </p>
                        </div>
                      )}
                      {(ev.location?.address || ev.location?.city || ev.location?.state) && (
                        <p className="events-card-location">
                          📍 {[ev.location.address, ev.location.city, ev.location.state].filter(Boolean).join(', ')}
                          {ev.location?.mapUrl && (
                            <> · <a href={ev.location.mapUrl} target="_blank" rel="noopener noreferrer">View on map</a></>
                          )}
                        </p>
                      )}
                      {(ev.startTime || ev.durationHours != null || ev.endTime) && (
                        <p className="events-card-time">
                          🕐 {ev.durationHours != null
                            ? formatEventTime(ev.startTime, ev.durationHours)
                            : ev.startTime && ev.endTime
                              ? `${formatTimeToAMPM(ev.startTime)} – ${formatTimeToAMPM(ev.endTime)}`
                              : formatEventTime(ev.startTime, ev.durationHours)}
                        </p>
                      )}
                      {(ev.driveType || ev.otherDriveName) && (
                        <div className="events-card-tags">
                          <span className="events-tag">
                            {ev.driveType === 'Other' && ev.otherDriveName ? ev.otherDriveName : (ev.driveType || ev.otherDriveName)}
                          </span>
                        </div>
                      )}
                      {ev.pinId && (
                        <p className="events-card-pin-link">
                          <span className="events-card-pin-label">Pin URL: </span>
                          <a
                            href={`${window.location.origin}/pin/${ev.pinId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {`${window.location.origin}/pin/${ev.pinId}`}
                          </a>
                        </p>
                      )}
                      <div className="events-card-meta">
                        <a
                          href={`/events/${ev._id}`}
                          className="events-card-detail-link"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/events/${ev._id}`);
                          }}
                        >
                          View full event details
                        </a>
                        <span>By {ev.authorName || 'Anonymous'}</span>
                      </div>
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
