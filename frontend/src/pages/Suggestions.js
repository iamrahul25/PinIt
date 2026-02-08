import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import './Suggestions.css';

const CATEGORIES = ['Feature Request', 'Bug Report', 'Improvement', 'UI/UX Suggestion', 'Other'];

const CATEGORY_CONFIG = {
  'Bug Report': { icon: 'bug_report', color: '#dc2626', bg: '#fef2f2' },
  'Feature Request': { icon: 'lightbulb_outline', color: '#ca8a04', bg: '#fefce8' },
  'Improvement': { icon: 'trending_up', color: '#059669', bg: '#ecfdf5' },
  'UI/UX Suggestion': { icon: 'brush', color: '#7c3aed', bg: '#f5f3ff' },
  'Other': { icon: 'apps', color: '#64748b', bg: '#f1f5f9' }
};
const SORT_OPTIONS = [
  { key: 'top', label: 'Top' },
  { key: 'new', label: 'New' },
  { key: 'planned', label: 'Planned' }
];

const STATUS_LABELS = {
  planned: 'Planned',
  in_progress: 'In Progress',
  under_review: 'Under Review',
  completed: 'Completed'
};

const STATUS_CLASS = {
  planned: 'status-planned',
  in_progress: 'status-progress',
  under_review: 'status-review',
  completed: 'status-completed'
};

const MAX_DETAILS_WORDS = 1000;
const DETAILS_PREVIEW_LENGTH = 200;

function SuggestionDescription({ text }) {
  const [expanded, setExpanded] = useState(false);
  const displayText = text || 'No description.';
  const isLong = displayText.length > DETAILS_PREVIEW_LENGTH;
  const preview = isLong ? displayText.slice(0, DETAILS_PREVIEW_LENGTH).trim() + '…' : displayText;
  const shown = expanded ? displayText : preview;

  return (
    <div className="suggestions-card-desc-wrap">
      <p className="suggestions-card-desc">{shown}</p>
      {isLong && (
        <button
          type="button"
          className="suggestions-show-more-btn"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

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

export default function Suggestions() {
  const navigate = useNavigate();
  const { loading: authLoading, isSignedIn, user, getToken } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('top');
  const [view, setView] = useState('board'); // 'board' | 'my'
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [form, setForm] = useState({ title: '', category: 'Feature Request', details: '' });
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

  const fetchSuggestions = useCallback(async (sortBy, skipCount = 0, append = false, viewMode = 'board') => {
    try {
      if (skipCount === 0) setLoading(true);
      else setLoadingMore(true);
      if (viewMode === 'my') {
        const res = await authFetch(`${API_BASE_URL}/api/suggestions/my/submissions`);
        if (!res.ok) throw new Error('Failed to fetch your submissions');
        const list = await res.json();
        setSuggestions(Array.isArray(list) ? list : []);
        setTotal(Array.isArray(list) ? list.length : 0);
        setSkip(list.length);
      } else {
        const res = await authFetch(
          `${API_BASE_URL}/api/suggestions?sort=${sortBy}&limit=10&skip=${skipCount}`
        );
        if (!res.ok) throw new Error('Failed to fetch suggestions');
        const data = await res.json();
        if (append) {
          setSuggestions((prev) => [...prev, ...(data.suggestions || [])]);
        } else {
          setSuggestions(data.suggestions || []);
        }
        setTotal(data.total ?? 0);
        setSkip(skipCount + (data.suggestions?.length || 0));
      }
    } catch (err) {
      setError(err.message || 'Could not load suggestions');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, isSignedIn, navigate]);

  useEffect(() => {
    if (!isSignedIn || authLoading) return;
    setSkip(0);
    fetchSuggestions(sort, 0, false, view);
  }, [isSignedIn, authLoading, sort, view, fetchSuggestions]);

  const handleSubmitSuggestion = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    const wordCount = form.details.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > MAX_DETAILS_WORDS) {
      setError(`Details must be ${MAX_DETAILS_WORDS} words or fewer (currently ${wordCount}).`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category,
          details: form.details.trim(),
          authorName: user?.fullName || user?.email || 'Anonymous',
          authorImageUrl: user?.imageUrl || ''
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit suggestion');
      }
      setSuccess('Suggestion submitted!');
      setForm({ title: '', category: 'Feature Request', details: '' });
      setSkip(0);
      fetchSuggestions(sort, 0, false, view);
    } catch (err) {
      setError(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (suggestionId) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/suggestions/${suggestionId}/vote`, {
        method: 'POST'
      });
      if (!res.ok) return;
      const updated = await res.json();
      setSuggestions((prev) =>
        prev.map((s) =>
          s._id === suggestionId
            ? { ...s, upvotes: updated.upvotes, hasVoted: !s.hasVoted }
            : s
        )
      );
    } catch (_) {}
  };

  const handleDelete = async (suggestionId) => {
    if (!window.confirm('Delete this suggestion? This cannot be undone.')) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/suggestions/${suggestionId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete');
      }
      setSuggestions((prev) => prev.filter((s) => s._id !== suggestionId));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      setError(err.message || 'Could not delete suggestion');
    }
  };

  const handleLoadMore = () => {
    fetchSuggestions(sort, skip, true);
  };

  if (authLoading) {
    return (
      <div className="suggestions-page">
        <p>Loading...</p>
      </div>
    );
  }
  if (!isSignedIn) return null;

  return (
    <div className="suggestions-page">
      <main className="suggestions-main">
        <div className="suggestions-layout">
          <aside className="suggestions-aside">
            <div className="suggestions-form-card">
              <h2 className="suggestions-form-title">Post a Suggestion</h2>
              <p className="suggestions-form-desc">Help us prioritize what to build next.</p>
              <form className="suggestions-form" onSubmit={handleSubmitSuggestion}>
                <div className="suggestions-field">
                  <label className="suggestions-label">Title</label>
                  <input
                    type="text"
                    className="suggestions-input"
                    placeholder="Short, descriptive title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="suggestions-field">
                  <label className="suggestions-label">Category</label>
                  <select
                    className="suggestions-input suggestions-select"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="suggestions-field">
                  <label className="suggestions-label">
                    Details
                    <span className={`suggestions-word-count ${(form.details.trim().split(/\s+/).filter(Boolean).length > MAX_DETAILS_WORDS) ? 'over-limit' : ''}`}>
                      {form.details.trim().split(/\s+/).filter(Boolean).length} / {MAX_DETAILS_WORDS} words
                    </span>
                  </label>
                  <textarea
                    className="suggestions-input suggestions-textarea"
                    placeholder="Explain your idea or report the issue..."
                    rows={5}
                    value={form.details}
                    onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                  />
                </div>
                {error && <div className="suggestions-msg suggestions-msg-error" role="alert">{error}</div>}
                {success && <div className="suggestions-msg suggestions-msg-success">{success}</div>}
                <button type="submit" className="suggestions-submit-btn" disabled={submitting}>
                  <span className="material-icons-round" aria-hidden="true">add_box</span>
                  Submit Suggestion
                </button>
              </form>
              <div className="suggestions-quick-links">
                <h3 className="suggestions-quick-links-title">Quick Links</h3>
                <button
                  type="button"
                  className={`suggestions-quick-link ${view === 'my' ? 'active' : ''}`}
                  onClick={() => setView('my')}
                >
                  <span className="material-icons-round" aria-hidden="true">history</span>
                  My Submissions
                </button>
                <button
                  type="button"
                  className={`suggestions-quick-link ${view === 'board' ? 'active' : ''}`}
                  onClick={() => setView('board')}
                >
                  <span className="material-icons-round" aria-hidden="true">article</span>
                  Community Board
                </button>
              </div>
            </div>
          </aside>

          <section className="suggestions-board" id="board">
            <div className="suggestions-board-header">
              <div className="suggestions-board-title-wrap">
                <h2 className="suggestions-board-title">
                  {view === 'my' ? 'My Submissions' : 'Community Board'}
                </h2>
                <span className="suggestions-board-count">{total}</span>
              </div>
              {view === 'board' && (
                <div className="suggestions-sort-tabs">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`suggestions-sort-tab ${sort === opt.key ? 'active' : ''}`}
                      onClick={() => setSort(opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loading ? (
              <div className="suggestions-loading">Loading suggestions...</div>
            ) : (
              <div className="suggestions-list">
                {suggestions.map((s) => {
                  const upvotes = s.upvotes ?? 0;
                  const hasVoted = s.hasVoted ?? false;
                  const isCompleted = s.status === 'completed';
                  const commentCount = s.comments?.length ?? 0;
                  return (
                    <article
                      key={s._id}
                      className={`suggestions-card ${isCompleted ? 'suggestions-card-completed' : ''}`}
                    >
                      <div className="suggestions-card-vote">
                        <button
                          type="button"
                          className={`suggestions-vote-btn ${hasVoted ? 'voted' : ''} ${isCompleted ? 'completed' : ''}`}
                          onClick={() => !isCompleted && handleVote(s._id)}
                          disabled={isCompleted}
                          aria-label={hasVoted ? 'Remove vote' : 'Upvote'}
                        >
                          {isCompleted ? (
                            <span className="material-icons-round">check_circle</span>
                          ) : (
                            <span className="material-icons-round">expand_less</span>
                          )}
                          <span className="suggestions-vote-count">{upvotes}</span>
                        </button>
                      </div>
                      <div className="suggestions-card-body">
                        <div className="suggestions-card-head">
                          <h3 className="suggestions-card-title">{s.title}</h3>
                          <div className="suggestions-card-head-right">
                            <span className={`suggestions-status suggestions-status-${STATUS_CLASS[s.status] || 'planned'}`}>
                              {STATUS_LABELS[s.status] || 'Planned'}
                            </span>
                            {user?.role === 'admin' && (
                              <button
                                type="button"
                                className="suggestions-delete-btn"
                                onClick={() => handleDelete(s._id)}
                                aria-label="Delete suggestion"
                                title="Delete suggestion"
                              >
                                <span className="material-icons-round">delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <SuggestionDescription text={s.details} />
                        <div className="suggestions-card-meta">
                          <div className="suggestions-card-meta-left">
                            <span
                              className="suggestions-category-pill"
                              style={{
                                color: (CATEGORY_CONFIG[s.category] || {}).color || '#475569',
                                backgroundColor: (CATEGORY_CONFIG[s.category] || {}).bg || '#f8fafc'
                              }}
                            >
                              <span className="material-icons-round" aria-hidden="true">
                                {(CATEGORY_CONFIG[s.category] || {}).icon || 'label'}
                              </span>
                              {s.category}
                            </span>
                            <span className="suggestions-comments-count">
                              <span className="material-icons-round" aria-hidden="true">chat_bubble</span>
                              {commentCount} comment{commentCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="suggestions-card-meta-right">
                            {s.authorImageUrl ? (
                              <img
                                src={s.authorImageUrl}
                                alt=""
                                className="suggestions-avatar"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="suggestions-avatar-placeholder">
                                {(s.authorName || '?').charAt(0).toUpperCase()}
                              </span>
                            )}
                            <span className="suggestions-time">{formatTimeAgo(s.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {!loading && suggestions.length > 0 && suggestions.length < total && (
              <div className="suggestions-load-more-wrap">
                <button
                  type="button"
                  className="suggestions-load-more-btn"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading...' : 'Load more suggestions'}
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
