import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaMapPin, FaThumbsUp, FaComment } from 'react-icons/fa';
import { API_BASE_URL } from '../config';
import './UserProfile.css';

export default function UserProfile() {
  const navigate = useNavigate();
  const { loading: authLoading, isSignedIn, user, getToken } = useAuth();
  const [stats, setStats] = useState({ contributions: 0, totalUpvotes: 0, totalComments: 0 });
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
    const fetchStats = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/api/users/stats`, { headers });
        if (!response.ok) throw new Error('Failed to fetch profile stats');
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err.message || 'Could not load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [isSignedIn, authLoading, getAuthHeaders]);

  const loadingState = authLoading;

  if (loadingState) {
    return (
      <div className="user-profile-page app-loading">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isSignedIn) return null;

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

        {loading ? (
          <div className="profile-stats-loading">Loading stats...</div>
        ) : (
          <div className="profile-stats">
            <div className="stat-card contributions">
              <div className="stat-icon">
                <FaMapPin aria-hidden="true" />
              </div>
              <div className="stat-content">
                <span className="stat-value">{stats.contributions}</span>
                <span className="stat-label">User contributions</span>
              </div>
            </div>
            <div className="stat-card upvotes">
              <div className="stat-icon">
                <FaThumbsUp aria-hidden="true" />
              </div>
              <div className="stat-content">
                <span className="stat-value">{stats.totalUpvotes}</span>
                <span className="stat-label">Total upvotes</span>
              </div>
            </div>
            <div className="stat-card comments">
              <div className="stat-icon">
                <FaComment aria-hidden="true" />
              </div>
              <div className="stat-content">
                <span className="stat-value">{stats.totalComments}</span>
                <span className="stat-label">Total comments</span>
              </div>
            </div>
          </div>
        )}

        <p className="profile-helper">
          User contributions = pins you reported. Total upvotes = upvotes received on your pins. Total comments = comments you posted.
        </p>
      </div>
    </div>
  );
}
