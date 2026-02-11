import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import './Suggestions.css';

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
  initialQuality: 0.8
};

const MAX_IMAGES = 3;

const CATEGORIES = ['Feature Request', 'Bug Report', 'Improvement', 'UI/UX Suggestion', 'Other'];

const CATEGORY_CONFIG = {
  'Bug Report': { icon: 'bug_report', color: '#dc2626', bg: '#fef2f2' },
  'Feature Request': { icon: 'lightbulb_outline', color: '#ca8a04', bg: '#fefce8' },
  'Improvement': { icon: 'trending_up', color: '#059669', bg: '#ecfdf5' },
  'UI/UX Suggestion': { icon: 'brush', color: '#7c3aed', bg: '#f5f3ff' },
  'Other': { icon: 'apps', color: '#64748b', bg: '#f1f5f9' }
};


const SUGGESTION_STATES = [
  { key: '', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'todo', label: 'To-do' },
  { key: 'in_progress', label: 'In-progress' },
  { key: 'hold', label: 'Hold' },
  { key: 'in_review', label: 'In-Review' },
  { key: 'done', label: 'Done' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'main_issue', label: '- Main Issues' },
];

const CATEGORY_FILTER_OPTIONS = [
  { key: '', label: 'All categories' },
  ...CATEGORIES.map((c) => ({ key: c, label: c }))
];

const STATUS_LABELS = {
  new: 'New',
  todo: 'To-do',
  in_progress: 'In-progress',
  hold: 'Hold',
  in_review: 'In-Review',
  done: 'Done',
  cancelled: 'Cancelled',
  planned: 'To-do',
  under_review: 'In-Review',
  completed: 'Done'
};

const STATUS_CLASS = {
  new: 'status-new',
  todo: 'status-todo',
  in_progress: 'status-progress',
  hold: 'status-hold',
  in_review: 'status-review',
  done: 'status-done',
  cancelled: 'status-cancelled',
  planned: 'status-todo',
  under_review: 'status-review',
  completed: 'status-done'
};

const PAGE_SIZE = 50;
const MAX_DETAILS_WORDS = 1000;
const DETAILS_PREVIEW_LENGTH = 200;
const FIRST_COMMENT_PREVIEW_LENGTH = 80;

// Client-side filter: match backend stateMap (including legacy status values)
function matchesState(s, stateFilter) {
  if (!stateFilter) return true;
  const status = s.status || 'new';
  if (stateFilter === 'main_issue') {
    const closedStatuses = ['done', 'completed', 'cancelled','in_review','hold'];
    return !closedStatuses.includes(status);
  }
  const stateMap = {
    new: ['new'],
    todo: ['todo', 'planned'],
    in_progress: ['in_progress'],
    hold: ['hold'],
    in_review: ['in_review', 'under_review'],
    done: ['done', 'completed'],
    cancelled: ['cancelled']
  };
  return stateMap[stateFilter] && stateMap[stateFilter].includes(status);
}

function matchesCategory(s, categoryFilter) {
  if (!categoryFilter) return true;
  return (s.category || '') === categoryFilter;
}

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
  const [stateFilter, setStateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [view, setView] = useState('board'); // 'board' | 'my'
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'Feature Request', details: '' });
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [compressingImages, setCompressingImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedCommentsId, setExpandedCommentsId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  const fetchIdRef = useRef(0);
  const imageInputRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handleChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

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
    const currentId = ++fetchIdRef.current;
    try {
      if (skipCount === 0) setLoading(true);
      else setLoadingMore(true);
      if (viewMode === 'my') {
        const res = await authFetch(`${API_BASE_URL}/api/suggestions/my/submissions`);
        if (currentId !== fetchIdRef.current) return;
        if (!res.ok) throw new Error('Failed to fetch your submissions');
        const list = await res.json();
        setSuggestions(Array.isArray(list) ? list : []);
        setTotal(Array.isArray(list) ? list.length : 0);
      } else {
        const params = new URLSearchParams({ limit: PAGE_SIZE, skip: skipCount });
        const res = await authFetch(`${API_BASE_URL}/api/suggestions?${params.toString()}`);
        if (currentId !== fetchIdRef.current) return;
        if (!res.ok) throw new Error('Failed to fetch suggestions');
        const data = await res.json();
        if (currentId !== fetchIdRef.current) return;
        if (append) {
          setSuggestions((prev) => [...prev, ...(data.suggestions || [])]);
        } else {
          setSuggestions(data.suggestions || []);
        }
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      if (currentId !== fetchIdRef.current) return;
      setError(err.message || 'Could not load suggestions');
    } finally {
      if (currentId !== fetchIdRef.current) return;
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
    fetchSuggestions(sort, 0, false, view);
  }, [isSignedIn, authLoading, view, fetchSuggestions]);

  const handleImageChange = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_IMAGES - imageFiles.length;
    const toAdd = files.slice(0, remaining);
    if (toAdd.length === 0) return;
    setError(toAdd.length < files.length ? `Maximum ${MAX_IMAGES} images allowed. Only the first allowed slots were added.` : '');
    if (e.target) e.target.value = '';

    setCompressingImages(true);
    try {
      const compressed = await Promise.all(
        toAdd.map((file) => imageCompression(file, COMPRESSION_OPTIONS))
      );
      const newFiles = [...imageFiles, ...compressed];
      setImageFiles(newFiles);

      const newPreviews = new Array(newFiles.length);
      let loaded = 0;
      newFiles.forEach((file, i) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews[i] = reader.result;
          loaded += 1;
          if (loaded === newFiles.length) {
            setImagePreviews([...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      });
    } catch (err) {
      setError('Failed to process images. Please try again.');
    } finally {
      setCompressingImages(false);
    }
  }, [imageFiles]);

  const removeSuggestionImage = (index) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    setError('');
  };

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
      const imageUrls = [];
      for (const file of imageFiles) {
        const multipart = new FormData();
        multipart.append('image', file);
        const uploadRes = await axios.post(
          `${API_BASE_URL}/api/images/upload`,
          multipart,
          { headers: await getAuthHeaders({ 'Content-Type': 'multipart/form-data' }) }
        );
        const url = uploadRes.data?.url;
        if (url) imageUrls.push(url);
      }

      const res = await authFetch(`${API_BASE_URL}/api/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category,
          details: form.details.trim(),
          images: imageUrls,
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
      setImageFiles([]);
      setImagePreviews([]);
      setMobileFormOpen(false);
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

  const handleStateChange = async (suggestionId, newState) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/suggestions/${suggestionId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update state');
      }
      const updated = await res.json();
      setSuggestions((prev) =>
        prev.map((s) => (s._id === suggestionId ? { ...s, status: updated.status } : s))
      );
    } catch (err) {
      setError(err.message || 'Could not update state');
    }
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
    fetchSuggestions(sort, suggestions.length, true, view);
  };



  const displayedSuggestions = useMemo(() => {
    const filtered = suggestions.filter(
      (s) => matchesState(s, stateFilter) && matchesCategory(s, categoryFilter)
    );

    switch (sort) {
      case 'new':
        return [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      case 'oldest':
        return [...filtered].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      case 'top':
        return [...filtered].sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0));
      default:
        return filtered;
    }
  }, [suggestions, stateFilter, categoryFilter, sort]);

  const handleAddComment = async (suggestionId) => {
    const text = commentText.trim();
    if (!text) return;
    setCommentError('');
    setCommentSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/suggestions/${suggestionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          authorName: user?.fullName || user?.email || 'Anonymous',
          authorImageUrl: user?.imageUrl || ''
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add comment');
      }
      const updated = await res.json();
      setSuggestions((prev) =>
        prev.map((s) => (s._id === suggestionId ? { ...s, comments: updated.comments || s.comments } : s))
      );
      setCommentText('');
    } catch (err) {
      setCommentError(err.message || 'Could not add comment');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const toggleComments = (suggestionId) => {
    setExpandedCommentsId((prev) => (prev === suggestionId ? null : suggestionId));
    setCommentError('');
    setCommentText('');
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
              {isMobile && !mobileFormOpen ? (
                <button
                  type="button"
                  className="suggestions-mobile-submit-btn"
                  onClick={() => setMobileFormOpen(true)}
                >
                  <span className="material-icons-round" aria-hidden="true">add_box</span>
                  Submit a suggestion
                </button>
              ) : (
                <>
                  <div className="suggestions-form-header-row">
                    <h2 className="suggestions-form-title">Post a Suggestion</h2>
                    {isMobile && (
                      <button
                        type="button"
                        className="suggestions-form-close-mobile"
                        onClick={() => setMobileFormOpen(false)}
                        aria-label="Close form"
                      >
                        <span className="material-icons-round">close</span>
                      </button>
                    )}
                  </div>
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
                <div className="suggestions-field">
                  <label className="suggestions-label">
                    Images
                    <span className="suggestions-word-count">{imageFiles.length} / {MAX_IMAGES} max</span>
                  </label>
                  <div
                    className={`suggestions-upload-area ${imageFiles.length >= MAX_IMAGES || compressingImages ? 'disabled' : ''}`}
                    onClick={() => (imageFiles.length < MAX_IMAGES && !compressingImages) && imageInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && imageFiles.length < MAX_IMAGES && !compressingImages) {
                        e.preventDefault();
                        imageInputRef.current?.click();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Click to upload images"
                  >
                    <span className="material-icons-round suggestions-upload-icon">cloud_upload</span>
                    <span className="suggestions-upload-text">
                      {compressingImages ? 'Compressing...' : 'Click to add images (max 3)'}
                    </span>
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="suggestions-file-input"
                    aria-label="Choose image files"
                  />
                  {imagePreviews.length > 0 && (
                    <div className="suggestions-image-previews">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="suggestions-image-preview">
                          <img src={preview} alt={`Preview ${index + 1}`} />
                          <button
                            type="button"
                            className="suggestions-remove-image"
                            onClick={() => removeSuggestionImage(index)}
                            aria-label={`Remove image ${index + 1}`}
                          >
                            <span className="material-icons-round">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {error && <div className="suggestions-msg suggestions-msg-error" role="alert">{error}</div>}
                {success && <div className="suggestions-msg suggestions-msg-success">{success}</div>}
                <button type="submit" className="suggestions-submit-btn" disabled={submitting || compressingImages}>
                  <span className="material-icons-round" aria-hidden="true">add_box</span>
                  Submit Suggestion
                </button>
              </form>
                </>
              )}
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
                <span className="suggestions-board-count">{displayedSuggestions.length}</span>
              </div>
              {view === 'board' && (
                                <div className="suggestions-board-controls">
                                  <div className="suggestions-board-filters">
                                    <div className="suggestions-sort-filter">
                                      <label className="suggestions-sort-filter-label">Sort by:</label>
                                      <select
                                        className="suggestions-sort-select"
                                        value={sort}
                                        onChange={(e) => setSort(e.target.value)}
                                        aria-label="Sort by"
                                      >
                                        <option value="top">Top</option>
                                        <option value="new">Newest</option>
                                        <option value="oldest">Oldest</option>
                                      </select>
                                    </div>
                                    <div className="suggestions-state-filter">
                                      <label className="suggestions-state-filter-label">State:</label>
                                      <select
                                        className="suggestions-state-select"
                                        value={stateFilter}
                                        onChange={(e) => setStateFilter(e.target.value)}
                                        aria-label="Filter by state"
                                      >
                                        {SUGGESTION_STATES.map((opt) => (
                                          <option key={opt.key || 'all'} value={opt.key}>{opt.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="suggestions-state-filter suggestions-category-filter">
                                      <label className="suggestions-state-filter-label">Category:</label>
                                      <select
                                        className="suggestions-state-select suggestions-category-select"
                                        value={categoryFilter}
                                        onChange={(e) => setCategoryFilter(e.target.value)}
                                        aria-label="Filter by category"
                                      >
                                        {CATEGORY_FILTER_OPTIONS.map((opt) => (
                                          <option key={opt.key || 'all'} value={opt.key}>{opt.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>
              )}
            </div>

            {loading ? (
              <div className="suggestions-loading">Loading suggestions...</div>
            ) : (
              <div className="suggestions-list">
                {displayedSuggestions.map((s) => {
                  const upvotes = s.upvotes ?? 0;
                  const hasVoted = s.hasVoted ?? false;
                  const isClosed = s.status === 'done' || s.status === 'cancelled' || s.status === 'completed';
                  const commentCount = s.comments?.length ?? 0;
                  const currentStatus = s.status || 'new';
                  const dropdownValue = { planned: 'todo', under_review: 'in_review', completed: 'done' }[currentStatus] || currentStatus;
                  return (
                    <article
                      key={s._id}
                      className={`suggestions-card ${isClosed ? 'suggestions-card-completed' : ''}`}
                    >
                      <div className="suggestions-card-vote">
                        <button
                          type="button"
                          className={`suggestions-vote-btn ${hasVoted ? 'voted' : ''} ${isClosed ? 'completed' : ''}`}
                          onClick={() => !isClosed && handleVote(s._id)}
                          disabled={isClosed}
                          aria-label={hasVoted ? 'Remove vote' : 'Upvote'}
                        >
                          {isClosed ? (
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
                            {user?.role === 'admin' ? (
                              <select
                                className="suggestions-state-dropdown"
                                value={dropdownValue}
                                onChange={(e) => handleStateChange(s._id, e.target.value)}
                                aria-label="Change state"
                                title="Change state"
                              >
                                <option value="new">New</option>
                                <option value="todo">To-do</option>
                                <option value="in_progress">In-progress</option>
                                <option value="hold">Hold</option>
                                <option value="in_review">In-Review</option>
                                <option value="done">Done</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            ) : (
                              <span className={`suggestions-status suggestions-status-${STATUS_CLASS[currentStatus] || 'status-new'}`}>
                                {STATUS_LABELS[currentStatus] || 'New'}
                              </span>
                            )}
                            {(user?.role === 'admin' || s.authorId === user?.id) && (
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
                        {s.images && s.images.length > 0 && (
                          <div className="suggestions-card-images">
                            {s.images.slice(0, 3).map((url, idx) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="suggestions-card-image-link"
                              >
                                <img src={url} alt={`Suggestion ${idx + 1}`} className="suggestions-card-image" />
                              </a>
                            ))}
                          </div>
                        )}
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
                            <button
                              type="button"
                              className={`suggestions-comments-count ${expandedCommentsId === s._id ? 'expanded' : ''}`}
                              onClick={() => toggleComments(s._id)}
                              aria-expanded={expandedCommentsId === s._id}
                            >
                              <span className="material-icons-round" aria-hidden="true">chat_bubble</span>
                              {commentCount} comment{commentCount !== 1 ? 's' : ''}
                            </button>
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

                        {/* First comment preview on card – click to expand full comments */}
                        {(s.comments || []).length > 0 && expandedCommentsId !== s._id && (() => {
                          const first = s.comments[0];
                          const previewText = (first.text || '').length > FIRST_COMMENT_PREVIEW_LENGTH
                            ? (first.text || '').slice(0, FIRST_COMMENT_PREVIEW_LENGTH).trim() + '…'
                            : (first.text || '');
                          return (
                            <button
                              type="button"
                              className="suggestions-first-comment-preview"
                              onClick={() => toggleComments(s._id)}
                              aria-expanded="false"
                              aria-label={`View all ${commentCount} comments`}
                            >
                              <div className="suggestions-first-comment-inner">
                                <div className="suggestions-first-comment-avatar-wrap">
                                  {first.authorImageUrl ? (
                                    <img
                                      src={first.authorImageUrl}
                                      alt=""
                                      className="suggestions-first-comment-avatar"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <span className="suggestions-first-comment-avatar-placeholder">
                                      {(first.authorName || '?').charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div className="suggestions-first-comment-body">
                                  <div className="suggestions-first-comment-meta">
                                    <span className="suggestions-first-comment-author">{first.authorName || 'Anonymous'}</span>
                                    <span className="suggestions-first-comment-time">{formatTimeAgo(first.createdAt)}</span>
                                  </div>
                                  <p className="suggestions-first-comment-text">{previewText}</p>
                                </div>
                              </div>
                              <span className="suggestions-expand-comments-label">
                                <span className="material-icons-round" aria-hidden="true">expand_more</span>
                                View all {commentCount} comment{commentCount !== 1 ? 's' : ''}
                              </span>
                            </button>
                          );
                        })()}

                        {expandedCommentsId === s._id && (
                          <div className="suggestions-card-comments">
                            <button
                              type="button"
                              className="suggestions-comments-collapse-btn"
                              onClick={() => toggleComments(s._id)}
                              aria-label="Collapse comments"
                            >
                              <span className="material-icons-round" aria-hidden="true">expand_less</span>
                              Collapse comments
                            </button>
                            <div className="suggestions-comments-list">
                              {(s.comments || []).map((c, idx) => (
                                <div key={idx} className="suggestions-comment">
                                  <div className="suggestions-comment-avatar-wrap">
                                    {c.authorImageUrl ? (
                                      <img
                                        src={c.authorImageUrl}
                                        alt=""
                                        className="suggestions-comment-avatar"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <span className="suggestions-comment-avatar-placeholder">
                                        {(c.authorName || '?').charAt(0).toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  <div className="suggestions-comment-body">
                                    <div className="suggestions-comment-meta">
                                      <span className="suggestions-comment-author">{c.authorName || 'Anonymous'}</span>
                                      <span className="suggestions-comment-time">{formatTimeAgo(c.createdAt)}</span>
                                    </div>
                                    <p className="suggestions-comment-text">{c.text}</p>
                                  </div>
                                </div>
                              ))}
                              {(s.comments || []).length === 0 && (
                                <p className="suggestions-comments-empty">No comments yet. Be the first to comment.</p>
                              )}
                            </div>
                            <div className="suggestions-add-comment">
                              {commentError && expandedCommentsId === s._id && (
                                <div className="suggestions-msg suggestions-msg-error" role="alert">{commentError}</div>
                              )}
                              <div className="suggestions-add-comment-row">
                                <textarea
                                  className="suggestions-input suggestions-comment-input"
                                  placeholder="Write a comment..."
                                  rows={2}
                                  value={expandedCommentsId === s._id ? commentText : ''}
                                  onChange={(e) => setCommentText(e.target.value)}
                                  aria-label="Comment text"
                                />
                                <button
                                  type="button"
                                  className="suggestions-comment-submit-btn"
                                  onClick={() => handleAddComment(s._id)}
                                  disabled={commentSubmitting || !commentText.trim()}
                                >
                                  <span className="material-icons-round" aria-hidden="true">send</span>
                                  {commentSubmitting ? 'Posting...' : 'Post'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}


            {view === 'board' && !loading && suggestions.length > 0 && suggestions.length < total && (
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
