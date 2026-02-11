import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import './EventDetail.css';

function formatEventDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

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

function formatEventTime(start, end, durationHours) {
  if (start && end) return `${formatTimeToAMPM(start)} – ${formatTimeToAMPM(end)}`;
  if (start && durationHours != null && durationHours >= 1) {
    const durationText = durationHours === 1 ? '1 hour' : `${durationHours} hours`;
    return `${formatTimeToAMPM(start)} · ${durationText}`;
  }
  if (start) return formatTimeToAMPM(start);
  if (durationHours != null && durationHours >= 1) {
    return durationHours === 1 ? '1 hour' : `${durationHours} hours`;
  }
  return '';
}

export default function EventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { loading: authLoading, isSignedIn, user, getToken } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attending, setAttending] = useState(false);
  const [volunteerCount, setVolunteerCount] = useState(0);

  const getAuthHeaders = useCallback(async (headers = {}) => {
    const token = await getToken();
    if (!token) throw new Error('Unable to acquire auth token');
    return { ...headers, Authorization: `Bearer ${token}` };
  }, [getToken]);

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) {
      navigate('/login', { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE_URL}/api/events/${eventId}`, { headers });
        if (!res.ok) {
          if (res.status === 404) throw new Error('Event not found');
          throw new Error('Failed to load event');
        }
        const data = await res.json();
        if (!cancelled) {
          setEvent(data);
          setAttending(data.hasAttending ?? false);
          setVolunteerCount(data.volunteerCount ?? 0);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load event');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, isSignedIn, authLoading, navigate, getAuthHeaders]);

  const handleAttend = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/events/${eventId}/attend`, {
        method: 'POST',
        headers
      });
      if (!res.ok) throw new Error('Failed to update attendance');
      const data = await res.json();
      setAttending(data.hasAttending);
      setVolunteerCount(data.volunteerCount ?? 0);
    } catch (err) {
      setError(err.message || 'Could not update attendance');
    }
  };

  const handleDeleteEvent = async () => {
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/events/${eventId}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete event');
      }
      navigate('/events');
    } catch (err) {
      setError(err.message || 'Could not delete event');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="event-detail-page">
        <p className="event-detail-loading">Loading event...</p>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="event-detail-page">
        <p className="event-detail-error">{error}</p>
        <button type="button" className="event-detail-back-btn" onClick={() => navigate('/events')}>
          Back to Events
        </button>
      </div>
    );
  }

  if (!event) return null;

  const pinUrl = event.pinId ? `${window.location.origin}/pin/${event.pinId}` : null;

  return (
    <div className="event-detail-page">
      <div className="event-detail-card">
        <div className="event-detail-header">
          <button
            type="button"
            className="event-detail-back-btn"
            onClick={() => navigate('/events')}
            aria-label="Back to Events"
          >
            <span className="material-icons-round">arrow_back</span>
            Back to Events
          </button>
          {(user?.role === 'admin' || event.authorId === user?.id) && (
            <button
              type="button"
              className="event-detail-delete-btn"
              onClick={handleDeleteEvent}
              aria-label="Delete event"
              title="Delete event"
            >
              <span className="material-icons-round">delete</span>
              Delete event
            </button>
          )}
        </div>
        {event.bannerUrl && (
          <div className="event-detail-banner-wrap">
            <img src={event.bannerUrl} alt="" className="event-detail-banner" />
          </div>
        )}
        <div className="event-detail-body">
          <h1 className="event-detail-title">{event.title}</h1>
          <div className="event-detail-meta-row">
            <span className="event-detail-date-pill">{formatEventDate(event.date)}</span>
            {(event.startTime || event.durationHours != null) && (
              <span className="event-detail-time">
                {formatEventTime(event.startTime, event.endTime, event.durationHours)}
              </span>
            )}
          </div>
          {(event.foundationName || event.foundationLogoUrl) && (
            <div className="event-detail-foundation">
              {event.foundationLogoUrl && (
                <img src={event.foundationLogoUrl} alt="" className="event-detail-foundation-logo" />
              )}
              <span className="event-detail-foundation-name">{event.foundationName}</span>
            </div>
          )}
          {event.description && (
            <section className="event-detail-section">
              <h2 className="event-detail-section-title">Description</h2>
              <p className="event-detail-description">{event.description}</p>
            </section>
          )}
          {(event.location?.address || event.location?.city || event.location?.state) && (
            <section className="event-detail-section">
              <h2 className="event-detail-section-title">Location</h2>
              <p className="event-detail-location">
                {[event.location.address, event.location.city, event.location.state].filter(Boolean).join(', ')}
              </p>
              {event.location?.mapUrl && (
                <a href={event.location.mapUrl} target="_blank" rel="noopener noreferrer" className="event-detail-map-link">
                  View on map
                </a>
              )}
            </section>
          )}
          {(event.driveType || event.otherDriveName) && (
            <section className="event-detail-section">
              <h2 className="event-detail-section-title">Type of drive</h2>
              <p>
                {event.driveType === 'Other' && event.otherDriveName ? event.otherDriveName : (event.driveType || event.otherDriveName)}
              </p>
            </section>
          )}
          {pinUrl && (
            <section className="event-detail-section">
              <h2 className="event-detail-section-title">Linked Pin</h2>
              <p className="event-detail-pin-url-label">Pin URL</p>
              <a
                href={pinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="event-detail-pin-link"
                onClick={(e) => {
                  e.preventDefault();
                  window.open(pinUrl, '_blank');
                }}
              >
                {pinUrl}
              </a>
              <span className="event-detail-pin-hint">Opens the Pin detail page for this event&apos;s location.</span>
            </section>
          )}
          <div className="event-detail-actions">
            <button
              type="button"
              className={`event-detail-attend-btn ${attending ? 'attending' : ''}`}
              onClick={handleAttend}
            >
              <span className="material-icons-round">{attending ? 'check_circle' : 'person_add'}</span>
              {attending ? "I'm in" : "I'll join"}
            </button>
            <span className="event-detail-volunteer-count">{volunteerCount} volunteers</span>
          </div>
          <p className="event-detail-author">By {event.authorName || 'Anonymous'}</p>
        </div>
      </div>
    </div>
  );
}
