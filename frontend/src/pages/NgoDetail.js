import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaInstagram, FaLinkedin, FaFacebookF, FaGlobe } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import './NgoDetail.css';

function formatTimeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
}

function instagramUrl(username) {
  if (!username) return '';
  const u = String(username).replace(/^@/, '').trim();
  return u ? `https://www.instagram.com/${u}` : '';
}

function socialUrl(value, baseUrl, prefix = '') {
  if (!value || !String(value).trim()) return '';
  const s = String(value).trim();
  return s.startsWith('http') ? s : `${baseUrl}${prefix}${s}`;
}

export default function NgoDetail() {
  const location = useLocation();
  const ngoId = (location.pathname.match(/^\/ngo\/([^/]+)$/) || [])[1] || null;
  const navigate = useNavigate();
  const { loading: authLoading, isSignedIn, user, getToken } = useAuth();
  const [ngo, setNgo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [voting, setVoting] = useState(false);

  const getAuthHeaders = useCallback(async (headers = {}) => {
    const token = await getToken();
    if (!token) throw new Error('Unable to acquire auth token');
    return { ...headers, Authorization: `Bearer ${token}` };
  }, [getToken]);

  const authFetch = useCallback(async (url, options = {}) => {
    const headers = await getAuthHeaders(options.headers || {});
    return fetch(url, { ...options, headers });
  }, [getAuthHeaders]);

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) {
      navigate('/login', { replace: true });
      return;
    }
    if (!ngoId) {
      setError('Invalid NGO');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/ngos/${ngoId}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error('NGO not found');
          throw new Error('Failed to load NGO');
        }
        const data = await res.json();
        if (!cancelled) setNgo(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load NGO');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ngoId, isSignedIn, authLoading, navigate, authFetch]);

  const handleVote = async () => {
    if (!ngo || voting) return;
    setVoting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/ngos/${ngoId}/vote`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to vote');
      const data = await res.json();
      setNgo((prev) => (prev ? { ...prev, upvotes: data.upvotes, hasVoted: data.hasVoted } : prev));
    } catch (err) {
      setError(err.message || 'Could not update vote');
    } finally {
      setVoting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this NGO? This cannot be undone.')) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/ngos/${ngoId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete NGO');
      }
      navigate('/ngos');
    } catch (err) {
      setError(err.message || 'Could not delete NGO');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="ngo-detail-page">
        <p className="ngo-detail-loading">Loading NGO...</p>
      </div>
    );
  }

  if (error && !ngo) {
    return (
      <div className="ngo-detail-page">
        <p className="ngo-detail-error">{error}</p>
        <button type="button" className="ngo-detail-back-btn" onClick={() => navigate('/ngos')}>
          Back to NGOs
        </button>
      </div>
    );
  }

  if (!ngo) return null;

  const hasVoted = ngo.hasVoted === true;
  const upvotes = ngo.upvotes ?? 0;
  const canEdit = user?.role === 'admin' || ngo.authorId === user?.id;

  return (
    <div className="ngo-detail-page">
      <div className="ngo-detail-card">
        <div className="ngo-detail-header">
          <button
            type="button"
            className="ngo-detail-back-btn"
            onClick={() => navigate('/ngos')}
            aria-label="Back to NGOs"
          >
            <span className="material-icons-round">arrow_back</span>
            Back to NGOs
          </button>
          {canEdit && (
            <div className="ngo-detail-header-actions">
              <button
                type="button"
                className="ngo-detail-edit-btn"
                onClick={() => navigate(`/ngos/${ngoId}/edit`)}
                aria-label="Edit NGO"
                title="Edit NGO"
              >
                <span className="material-icons-round">edit</span>
                Edit
              </button>
              <button
                type="button"
                className="ngo-detail-delete-btn"
                onClick={handleDelete}
                aria-label="Delete NGO"
                title="Delete NGO"
              >
                <span className="material-icons-round">delete</span>
                Delete
              </button>
            </div>
          )}
        </div>

        <div className="ngo-detail-hero">
          <div className="ngo-detail-logo-wrap">
            {ngo.logoUrl ? (
              <img src={ngo.logoUrl} alt="" className="ngo-detail-logo" />
            ) : (
              <span className="ngo-detail-logo-placeholder">
                <span className="material-icons-round">business</span>
              </span>
            )}
          </div>
          <div className="ngo-detail-hero-meta">
            <h1 className="ngo-detail-title">{ngo.name}</h1>
            <span className="ngo-detail-level-pill">{ngo.level}</span>
            <div className="ngo-detail-vote-row">
              <button
                type="button"
                className={`ngo-detail-vote-btn ${hasVoted ? 'voted' : ''}`}
                onClick={handleVote}
                disabled={voting}
                aria-label={hasVoted ? 'Remove like' : 'Like this NGO'}
              >
                <span className="material-icons-round">favorite</span>
                <span className="ngo-detail-vote-count">{upvotes}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="ngo-detail-body">
          {(ngo.foundInYear != null || (ngo.numberOfCities != null && ngo.numberOfCities > 0) || (ngo.cities && ngo.cities.length > 0)) && (
            <section className="ngo-detail-section ngo-detail-meta-row">
              {ngo.foundInYear != null && <span className="ngo-detail-meta-item">Founded {ngo.foundInYear}</span>}
              {ngo.numberOfCities != null && ngo.numberOfCities > 0 && (
                <span className="ngo-detail-meta-item">
                  Operates in {ngo.numberOfCities} {ngo.numberOfCities === 1 ? 'city' : 'cities'}
                </span>
              )}
              {ngo.cities && ngo.cities.length > 0 && (
                <span className="ngo-detail-meta-item">Cities: {ngo.cities.join(', ')}</span>
              )}
            </section>
          )}

          {ngo.aboutDescription && (
            <section className="ngo-detail-section">
              <h2 className="ngo-detail-section-title">About</h2>
              <p className="ngo-detail-description">{ngo.aboutDescription}</p>
            </section>
          )}

          {ngo.whatTheyDo && ngo.whatTheyDo.length > 0 && (
            <section className="ngo-detail-section">
              <h2 className="ngo-detail-section-title">What they do</h2>
              <div className="ngo-detail-tags">
                {ngo.whatTheyDo.map((w) => (
                  <span key={w} className="ngo-detail-tag">{w}</span>
                ))}
              </div>
            </section>
          )}

          {(ngo.founder?.name || ngo.founder?.city) && (
            <section className="ngo-detail-section">
              <h2 className="ngo-detail-section-title">Founder</h2>
              <p className="ngo-detail-founder">
                {[ngo.founder.name, ngo.founder.city].filter(Boolean).join(', ')}
              </p>
            </section>
          )}

          {ngo.email && (
            <section className="ngo-detail-section">
              <h2 className="ngo-detail-section-title">Contact</h2>
              <a href={`mailto:${ngo.email}`} className="ngo-detail-email">
                {ngo.email}
              </a>
            </section>
          )}

          {(ngo.socialMedia?.website || ngo.socialMedia?.instagram || ngo.socialMedia?.linkedin || ngo.socialMedia?.facebook || ngo.socialMedia?.other) && (
            <section className="ngo-detail-section">
              <h2 className="ngo-detail-section-title">Social media</h2>
              <div className="ngo-detail-social">
                {ngo.socialMedia.website && (
                  <a href={socialUrl(ngo.socialMedia.website, 'https://')} target="_blank" rel="noopener noreferrer" className="ngo-detail-link ngo-detail-link-website" title="Website" aria-label="Website">
                    <FaGlobe />
                    <span>Website</span>
                  </a>
                )}
                {ngo.socialMedia.instagram && (
                  <a href={instagramUrl(ngo.socialMedia.instagram)} target="_blank" rel="noopener noreferrer" className="ngo-detail-link ngo-detail-link-instagram" title="Instagram" aria-label="Instagram">
                    <FaInstagram />
                    <span>Instagram</span>
                  </a>
                )}
                {ngo.socialMedia.linkedin && (
                  <a href={socialUrl(ngo.socialMedia.linkedin, 'https://linkedin.com/company/', '')} target="_blank" rel="noopener noreferrer" className="ngo-detail-link ngo-detail-link-linkedin" title="LinkedIn" aria-label="LinkedIn">
                    <FaLinkedin />
                    <span>LinkedIn</span>
                  </a>
                )}
                {ngo.socialMedia.facebook && (
                  <a href={socialUrl(ngo.socialMedia.facebook, 'https://facebook.com/')} target="_blank" rel="noopener noreferrer" className="ngo-detail-link ngo-detail-link-facebook" title="Facebook" aria-label="Facebook">
                    <FaFacebookF />
                    <span>Facebook</span>
                  </a>
                )}
                {ngo.socialMedia.other && (
                  <a href={socialUrl(ngo.socialMedia.other, 'https://')} target="_blank" rel="noopener noreferrer" className="ngo-detail-link ngo-detail-link-other" title="Other" aria-label="Other">
                    <FaGlobe />
                    <span>Other</span>
                  </a>
                )}
              </div>
              {ngo.socialMedia?.instagramFollowers != null && ngo.socialMedia.instagramFollowers > 0 && (
                <p className="ngo-detail-followers">Instagram followers: {ngo.socialMedia.instagramFollowers.toLocaleString()}</p>
              )}
            </section>
          )}

          <p className="ngo-detail-author">
            Added by {ngo.authorName || 'Anonymous'}
            {ngo.createdAt && <span className="ngo-detail-time"> · {formatTimeAgo(ngo.createdAt)}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
