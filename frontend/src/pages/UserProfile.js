import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaMapPin, FaThumbsUp, FaComment, FaMapMarkerAlt, FaChevronRight } from 'react-icons/fa';
import { API_BASE_URL } from '../config';
import { getThumbnailUrl } from '../utils/cloudinaryUrls';
import './UserProfile.css';

export default function UserProfile() {
  const navigate = useNavigate();
  const { loading: authLoading, isSignedIn, user, getToken } = useAuth();
  const [stats, setStats] = useState({ pinsCreated: 0, commentsMade: 0, votesCast: 0 });
  const [activityTab, setActivityTab] = useState('pins'); // 'pins', 'saved', 'comments'
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

        const [statsResponse, pinsResponse, savedPinsResponse, commentsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users/stats`, { headers }),
          fetch(`${API_BASE_URL}/api/users/me/pins`, { headers }),
          fetch(`${API_BASE_URL}/api/users/me/saved-pins`, { headers }),
          fetch(`${API_BASE_URL}/api/users/me/comments`, { headers }),
        ]);

        if (!statsResponse.ok) throw new Error('Failed to fetch profile stats');
        if (!pinsResponse.ok) throw new Error('Failed to fetch created pins');
        if (!savedPinsResponse.ok) throw new Error('Failed to fetch saved pins');
        if (!commentsResponse.ok) throw new Error('Failed to fetch comments');

        const statsData = await statsResponse.json();
        const pinsData = await pinsResponse.json();
        const savedPinsData = await savedPinsResponse.json();
        const commentsData = await commentsResponse.json();

        setStats(statsData);
        setActivityData({
          pins: pinsData,
          saved: savedPinsData,
          comments: commentsData,
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
  
    const data = activityData[activityTab === 'pins' ? 'pins' : activityTab === 'saved' ? 'saved' : 'comments'];
  
    if (!data || data.length === 0) {
      const message = {
        pins: 'No pins created yet.',
        saved: 'No saved pins yet.',
        comments: 'No comments made yet.',
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
          </div>
          <div className="activity-content-container">
            {renderActivityContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
