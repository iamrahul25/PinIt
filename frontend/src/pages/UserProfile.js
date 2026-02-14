import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaMapPin, FaThumbsUp, FaComment, FaMapMarkerAlt, FaChevronRight, FaHandHoldingHeart, FaCalendarAlt, FaLightbulb } from 'react-icons/fa';
import { API_BASE_URL } from '../config';
import { getThumbnailUrl } from '../utils/cloudinaryUrls';
import './UserProfile.css';

export default function UserProfile() {
  const navigate = useNavigate();
  const { loading: authLoading, isSignedIn, user, getToken } = useAuth();
  const [stats, setStats] = useState({ pinsCreated: 0, commentsMade: 0, votesCast: 0, ngosCreated: 0, eventsCreated: 0, suggestionsMade: 0 });
  const [activityTab, setActivityTab] = useState('pins'); // 'pins', 'saved', 'comments', 'ngos', 'events'
  const [activityData, setActivityData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getAuthHeaders = useCallback(async (headers = {}) => {
    const token = await getToken();
    if (!token) {
      throw new Error('Unable to acquire auth token');
    }
    return {
      ...headers,
      Authorization: `Bearer ${token}`
    };
  }, [getToken]);

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, isSignedIn, navigate]);

  useEffect(() => {
    if (!isSignedIn || authLoading) return;

    const fetchProfileData = async () => {
      try {
        const headers = await getAuthHeaders();

        const [statsResponse, pinsResponse, savedPinsResponse, commentsResponse, ngosResponse, eventsResponse, suggestionsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users/stats`, { headers }),
          fetch(`${API_BASE_URL}/api/users/me/pins`, { headers }),
          fetch(`${API_BASE_URL}/api/users/me/saved-pins`, { headers }),
          fetch(`${API_BASE_URL}/api/users/me/comments`, { headers }),
          fetch(`${API_BASE_URL}/api/ngos/my/submissions`, { headers }),
          fetch(`${API_BASE_URL}/api/events/my/submissions`, { headers }),
          fetch(`${API_BASE_URL}/api/suggestions/my/submissions`, { headers }),
        ]);

        if (!statsResponse.ok) throw new Error('Failed to fetch profile stats');
        if (!pinsResponse.ok) throw new Error('Failed to fetch created pins');
        if (!savedPinsResponse.ok) throw new Error('Failed to fetch saved pins');
        if (!commentsResponse.ok) throw new Error('Failed to fetch comments');
        if (!ngosResponse.ok) throw new Error('Failed to fetch created NGOs');
        if (!eventsResponse.ok) throw new Error('Failed to fetch created events');
        if (!suggestionsResponse.ok) throw new Error('Failed to fetch created suggestions');

        const statsData = await statsResponse.json();
        const pinsData = await pinsResponse.json();
        const savedPinsData = await savedPinsResponse.json();
        const commentsData = await commentsResponse.json();
        const ngosData = await ngosResponse.json();
        const eventsData = await eventsResponse.json();
        const suggestionsData = await suggestionsResponse.json();

        setStats({ ...statsData, ngosCreated: ngosData.length, eventsCreated: eventsData.length, suggestionsMade: suggestionsData.length });
        setActivityData({
          pins: pinsData,
          saved: savedPinsData,
          comments: commentsData,
          ngos: ngosData,
          events: eventsData,
          suggestions: suggestionsData,
        });

      } catch (err) {
        setError(err.message || 'Could not load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [isSignedIn, authLoading, getAuthHeaders]);

  const loadingState = authLoading || loading;

  const formatJoinDate = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const options = { year: 'numeric', month: 'long' };
    return date.toLocaleDateString('en-US', options);
  };

  const formatDate = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  if (loadingState) {
    return (
      <div className="user-profile-page">
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!isSignedIn) return null;

  const getSeverityLabel = (severity) => {
    if (severity >= 9) return { label: `Critical (${severity}/10)`, className: 'pin-severity-critical' };
    if (severity >= 7) return { label: `High (${severity}/10)`, className: 'pin-severity-strong' };
    if (severity >= 5) return { label: `Medium (${severity}/10)`, className: 'pin-severity-medium' };
    if (severity >= 3) return { label: `Low (${severity}/10)`, className: 'pin-severity-low' };
    return { label: `Minor (${severity}/10)`, className: 'pin-severity-minor' };
  };

  const renderActivityContent = () => {
    if (loading) return <div className="activity-loading">Loading activity...</div>;
  
    const data = activityData[activityTab];
  
    if (!data || data.length === 0) {
      const message = {
        pins: 'No pins created yet.',
        saved: 'No saved pins yet.',
        comments: 'No comments made yet.',
        ngos: 'No NGOs created yet.',
        events: 'No events created yet.',
      };
      return <div className="activity-empty">{message[activityTab]}</div>;
    }
  
    switch (activityTab) {
      case 'pins':
      case 'saved':
        return (
          <div className="activity-list">
            {data.map((pin) => {
              const severity = getSeverityLabel(pin.severity);
              return (
                <div key={pin._id} className="activity-pin-card">
                  <div className="activity-pin-card-thumb">
                    {pin.images && pin.images.length > 0 ? (
                      <img src={getThumbnailUrl(pin.images[0])} alt={pin.problemHeading || 'Pin image'} />
                    ) : (
                      <div className="activity-pin-card-no-image"><FaMapPin /></div>
                    )}
                  </div>
                  <div className="activity-pin-card-content">
                    <div className="activity-pin-card-head">
                      <h3 className="activity-pin-card-title">{pin.problemHeading || 'Untitled Pin'}</h3>
                      <span className={`activity-pin-card-severity small ${severity.className}`}>{severity.label}</span>
                    </div>
                    <p className="activity-pin-card-desc">
                      {pin.description ? (pin.description.substring(0, 70) + (pin.description.length > 70 ? '...' : '')) : 'No description.'}
                    </p>
                    <div className="activity-pin-card-location">
                      <FaMapMarkerAlt /> <span>{pin.location?.address ? (pin.location.address.substring(0, 35) + (pin.location.address.length > 35 ? '...' : '')) : 'No address'}</span>
                    </div>
                    <div className="activity-pin-card-stats">
                      <span><FaThumbsUp /> {pin.upvotes || 0}</span>
                      <span><FaComment /> {pin.comments?.length || 0}</span>
                    </div>
                    <a href={`/pin/${pin._id}`} className="activity-pin-card-full-details">
                      Full details <FaChevronRight className="activity-pin-card-full-details-icon" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        );
      case 'comments':
        return (
          <div className="activity-list">
            {data.map((comment) => (
              <div key={comment._id} className="comment-card">
                <a href={`/pin/${comment.pinId}`} className="comment-card-link">
                  <div className="comment-card-content">
                    <p className="comment-card-text">"{comment.text}"</p>
                    <p className="comment-card-meta">
                      Commented on {new Date(comment.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </a>
              </div>
            ))}
          </div>
        );
      case 'ngos':
        return (
          <div className="activity-list">
            {data.map((ngo) => (
              <div key={ngo._id} className="activity-ngo-card">
                <div className="activity-ngo-card-thumb">
                  <img src={getThumbnailUrl(ngo.logoUrl)} alt={`${ngo.name} logo`} />
                </div>
                <div className="activity-ngo-card-content">
                  <h3 className="activity-ngo-card-title">{ngo.name}</h3>
                  <p className="activity-ngo-card-meta">Added on {formatDate(ngo.createdAt)}</p>
                </div>
                <a href={`/ngos/${ngo._id}`} className="activity-ngo-card-details">
                  View <FaChevronRight />
                </a>
              </div>
            ))}
          </div>
        );
      case 'events':
        return (
          <div className="activity-list">
            {data.map((event) => (
              <div key={event._id} className="activity-event-card">
                <div className="activity-event-card-content">
                  <h3 className="activity-event-card-title">{event.title}</h3>
                  <p className="activity-event-card-meta">
                    Event on {formatDate(event.date)}
                  </p>
                </div>
                <a href={`/events/${event._id}`} className="activity-event-card-details">
                  View <FaChevronRight />
                </a>
              </div>
            ))}
          </div>
        );
      case 'suggestions':
        return (
          <div className="activity-list">
            {data.map((suggestion) => (
              <div key={suggestion._id} className="activity-suggestion-card">
                <div className="activity-suggestion-card-content">
                  <h3 className="activity-suggestion-card-title">{suggestion.title}</h3>
                  <p className="activity-suggestion-card-meta">
                    Suggested on {formatDate(suggestion.createdAt)}
                  </p>
                </div>
                <a href={`/suggestions/${suggestion._id}`} className="activity-suggestion-card-details">
                  View <FaChevronRight />
                </a>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="user-profile-page">
      <div className="user-profile-card">
        <div className="user-profile-header">
          <div className="user-avatar" aria-hidden="true">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              (user?.fullName?.[0] || user?.email?.[0] || '?').toUpperCase()
            )}
          </div>
          <div className="user-profile-info">
            <h1>{user?.fullName || user?.email || 'User'}</h1>
            <div className="user-profile-meta">
              {user?.createdAt && <span>Joined {formatJoinDate(user.createdAt)}</span>}
              {user?.role === 'admin' && <span className="user-role-badge">Admin</span>}
            </div>
            {user?.email && (
              <p className="user-email">{user.email}</p>
            )}
          </div>
          <button
            type="button"
            className="profile-back-btn"
            onClick={() => navigate('/')}
            title="Back to map"
          >
            ← Back
          </button>
        </div>

        {error && (
          <div className="profile-error" role="alert">
            {error}
          </div>
        )}

        <div className="profile-stats">
          <div className="stat-card contributions">
            <div className="stat-icon"><FaMapPin aria-hidden="true" /></div>
            <div className="stat-content">
              <span className="stat-value">{stats.pinsCreated}</span>
              <span className="stat-label">Pins Created</span>
            </div>
          </div>
          <div className="stat-card comments">
            <div className="stat-icon"><FaComment aria-hidden="true" /></div>
            <div className="stat-content">
              <span className="stat-value">{stats.commentsMade}</span>
              <span className="stat-label">Comments Made</span>
            </div>
          </div>
          <div className="stat-card upvotes">
            <div className="stat-icon"><FaThumbsUp aria-hidden="true" /></div>
            <div className="stat-content">
              <span className="stat-value">{stats.votesCast}</span>
              <span className="stat-label">Votes Cast</span>
            </div>
          </div>
          <div className="stat-card contributions-ngo-events">
            <div className="stat-icon"><FaHandHoldingHeart aria-hidden="true" /></div>
            <div className="stat-content">
              <span className="stat-value">{stats.ngosCreated}</span>
              <span className="stat-label">NGOs Created</span>
            </div>
          </div>
          <div className="stat-card events">
            <div className="stat-icon"><FaCalendarAlt aria-hidden="true" /></div>
            <div className="stat-content">
              <span className="stat-value">{stats.eventsCreated}</span>
              <span className="stat-label">Events Created</span>
            </div>
          </div>
          <div className="stat-card suggestions">
            <div className="stat-icon"><FaLightbulb aria-hidden="true" /></div>
            <div className="stat-content">
              <span className="stat-value">{stats.suggestionsMade}</span>
              <span className="stat-label">Suggestions</span>
            </div>
          </div>
        </div>

        <div className="user-activity-section">
          <div className="activity-tabs">
            <button
              className={`activity-tab ${activityTab === 'pins' ? 'active' : ''}`}
              onClick={() => setActivityTab('pins')}
            >
              Created Pins
            </button>
            <button
              className={`activity-tab ${activityTab === 'saved' ? 'active' : ''}`}
              onClick={() => setActivityTab('saved')}
            >
              Saved Pins
            </button>
            <button
              className={`activity-tab ${activityTab === 'comments' ? 'active' : ''}`}
              onClick={() => setActivityTab('comments')}
            >
              Recent Comments
            </button>
            <button
              className={`activity-tab ${activityTab === 'ngos' ? 'active' : ''}`}
              onClick={() => setActivityTab('ngos')}
            >
              NGOs
            </button>
            <button
              className={`activity-tab ${activityTab === 'events' ? 'active' : ''}`}
              onClick={() => setActivityTab('events')}
            >
              Events
            </button>
            <button
              className={`activity-tab ${activityTab === 'suggestions' ? 'active' : ''}`}
              onClick={() => setActivityTab('suggestions')}
            >
              Suggestions
            </button>
          </div>
          <div className="activity-content-container">
            {renderActivityContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
