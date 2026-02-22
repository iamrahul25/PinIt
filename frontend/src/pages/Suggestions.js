import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import './Suggestions.css';

const SUGGESTIONS_QUERY_KEY = ['suggestions'];
const STALE_TIME_MS = 5 * 60 * 1000;

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

// ─────────────────────────────────────────────────────────────────────────────
// Reusable form fields component – used for both Post and Edit
// Props:
//   form            { title, category, details }
//   setForm         setter
//   imagePreviews   string[]   – data-URLs for new uploads OR existing https:// URLs
//   compressing     bool
//   onFileChange    async (e) => void
//   onRemoveImage   (index) => void
//   imageInputRef   ref
// ─────────────────────────────────────────────────────────────────────────────
function SuggestionFormFields({
  form,
  setForm,
  imagePreviews,
  compressing,
  onFileChange,
  onRemoveImage,
  imageInputRef
}) {
  const wordCount = form.details.trim().split(/\s+/).filter(Boolean).length;
  const totalImages = imagePreviews.length;

  return (
    <>
      {/* Title */}
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

      {/* Category */}
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

      {/* Details */}
      <div className="suggestions-field">
        <label className="suggestions-label">
          Details
          <span className={`suggestions-word-count ${wordCount > MAX_DETAILS_WORDS ? 'over-limit' : ''}`}>
            {wordCount} / {MAX_DETAILS_WORDS} words
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

      {/* Images */}
      <div className="suggestions-field">
        <label className="suggestions-label">
          Images
          <span className="suggestions-word-count">{totalImages} / {MAX_IMAGES} max</span>
        </label>
        <div
          className={`suggestions-upload-area ${totalImages >= MAX_IMAGES || compressing ? 'disabled' : ''}`}
          onClick={() => (totalImages < MAX_IMAGES && !compressing) && imageInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && totalImages < MAX_IMAGES && !compressing) {
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
            {compressing ? 'Compressing...' : 'Click to add images (max 3)'}
          </span>
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onFileChange}
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
                  onClick={() => onRemoveImage(index)}
                  aria-label={`Remove image ${index + 1}`}
                >
                  <span className="material-icons-round">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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

// Client-side filter: match backend stateMap (including legacy status values)
function matchesState(s, stateFilter) {
  if (!stateFilter) return true;
  const status = s.status || 'new';
  if (stateFilter === 'main_issue') {
    const closedStatuses = ['done', 'completed', 'cancelled', 'in_review', 'hold'];
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

export default function Suggestions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { loading: authLoading, isSignedIn, user, getToken } = useAuth();

  // ── Board / filter state ─────────────────────────────────────────
  const [sort, setSort] = useState('top');
  const [stateFilter, setStateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [view, setView] = useState('board'); // 'board' | 'my'
  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1024
  );

  // ── "Post a suggestion" form state ───────────────────────────────
  const [form, setForm] = useState({ title: '', category: 'Feature Request', details: '' });
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [compressingImages, setCompressingImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // ── Toast notification state ─────────────────────────────────────
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const showToast = useCallback((message, type = 'info') => {
    setToast({ visible: true, message, type });
  }, []);
  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);
  
  const imageInputRef = useRef(null);

  // ── Comment state ────────────────────────────────────────────────
  const [expandedCommentsId, setExpandedCommentsId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');

  // ── Edit modal state ─────────────────────────────────────────────
  // Images in the edit form are tracked as { src: string, file?: File }[]
  // where src is a data-URL (new upload) or an https:// URL (existing).
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', category: 'Feature Request', details: '' });
  // editImages: array of { src: string (preview/URL), file?: File (only for new uploads) }
  const [editImages, setEditImages] = useState([]);
  const [editCompressing, setEditCompressing] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const editImageInputRef = useRef(null);

  // ── Responsive listener ──────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handleChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  // ── Auth helpers ─────────────────────────────────────────────────
  const getAuthHeaders = useCallback(async (headers = {}) => {
    const token = await getToken();
    if (!token) throw new Error('Unable to acquire auth token');
    return { ...headers, Authorization: `Bearer ${token}` };
  }, [getToken]);

  const authFetch = useCallback(async (url, options = {}) => {
    const headers = await getAuthHeaders(options.headers || {});
    return fetch(url, { ...options, headers });
  }, [getAuthHeaders]);

  // ── React-Query fetchers ─────────────────────────────────────────
  const fetchMySuggestions = useCallback(async () => {
    const res = await authFetch(`${API_BASE_URL}/api/suggestions/my/submissions`);
    if (!res.ok) throw new Error('Failed to fetch your submissions');
    const list = await res.json();
    return Array.isArray(list) ? list : [];
  }, [authFetch]);

  const fetchBoardPage = useCallback(async ({ pageParam = 0 }) => {
    const params = new URLSearchParams({ limit: PAGE_SIZE, skip: pageParam });
    const res = await authFetch(`${API_BASE_URL}/api/suggestions?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch suggestions');
    const data = await res.json();
    return { suggestions: data.suggestions || [], total: data.total ?? 0 };
  }, [authFetch]);

  const enabled = Boolean(isSignedIn && !authLoading);

  const myQuery = useQuery({
    queryKey: [...SUGGESTIONS_QUERY_KEY, 'my'],
    queryFn: fetchMySuggestions,
    enabled: enabled && view === 'my',
    staleTime: STALE_TIME_MS,
  });

  const boardQuery = useInfiniteQuery({
    queryKey: [...SUGGESTIONS_QUERY_KEY, 'board'],
    queryFn: fetchBoardPage,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + (p.suggestions?.length ?? 0), 0);
      return loaded < (lastPage.total ?? 0) ? loaded : undefined;
    },
    enabled: enabled && view === 'board',
    staleTime: STALE_TIME_MS,
  });

  const suggestions = view === 'my'
    ? (myQuery.data ?? [])
    : (boardQuery.data?.pages?.flatMap((p) => p.suggestions ?? []) ?? []);
  const total = view === 'my'
    ? (myQuery.data?.length ?? 0)
    : (boardQuery.data?.pages?.[0]?.total ?? 0);
  const loading = view === 'my' ? myQuery.isLoading : boardQuery.isLoading;
  const loadingMore = view === 'board' && boardQuery.isFetchingNextPage;
  const fetchError = view === 'my' ? myQuery.error : boardQuery.error;

  // ── Effects ──────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) navigate('/login', { replace: true });
  }, [authLoading, isSignedIn, navigate]);

  useEffect(() => {
    if (fetchError) setError(fetchError.message || 'Could not load suggestions');
    else setError('');
  }, [fetchError]);

  // ── Shared image compression helper ─────────────────────────────
  /**
   * Compress files and build { src, file } entries.
   * Returns array of { src: dataURL, file: File }.
   */
  const compressToEntries = useCallback(async (files) => {
    const compressed = await Promise.all(
      files.map((f) => imageCompression(f, COMPRESSION_OPTIONS))
    );
    return await Promise.all(
      compressed.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ src: reader.result, file });
            reader.readAsDataURL(file);
          })
      )
    );
  }, []);

  // ── "Post" form image handlers ───────────────────────────────────
  const handleImageChange = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_IMAGES - imageFiles.length;
    const toAdd = files.slice(0, remaining);
    if (!toAdd.length) return;
    if (toAdd.length < files.length) showToast(`Maximum ${MAX_IMAGES} images allowed.`, 'warning');
    if (e.target) e.target.value = '';
    setCompressingImages(true);
    try {
      const entries = await compressToEntries(toAdd);
      setImageFiles((prev) => [...prev, ...entries.map((e) => e.file)]);
      setImagePreviews((prev) => [...prev, ...entries.map((e) => e.src)]);
    } catch {
      showToast('Failed to process images. Please try again.', 'error');
    } finally {
      setCompressingImages(false);
    }
  }, [imageFiles, compressToEntries, showToast]);

  const removeSuggestionImage = (index) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    setError('');
  };

  // ── Upload helper: upload a File, return its URL ─────────────────
  const uploadFile = useCallback(async (file) => {
    const multipart = new FormData();
    multipart.append('image', file);
    const res = await axios.post(
      `${API_BASE_URL}/api/images/upload`,
      multipart,
      { headers: await getAuthHeaders({ 'Content-Type': 'multipart/form-data' }) }
    );
    return res.data?.url || null;
  }, [getAuthHeaders]);

  // ── "Post a suggestion" submit ───────────────────────────────────
  const handleSubmitSuggestion = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.title.trim()) { showToast('Title is required.', 'error'); return; }
    const wordCount = form.details.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > MAX_DETAILS_WORDS) {
      showToast(`Details must be ${MAX_DETAILS_WORDS} words or fewer (currently ${wordCount}).`, 'error');
      return;
    }
    setSubmitting(true);
    try {
      const imageUrls = [];
      for (const file of imageFiles) {
        const url = await uploadFile(file);
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
      showToast('Suggestion submitted successfully!', 'success');
      setForm({ title: '', category: 'Feature Request', details: '' });
      setImageFiles([]);
      setImagePreviews([]);
      setMobileFormOpen(false);
      queryClient.invalidateQueries({ queryKey: SUGGESTIONS_QUERY_KEY });
    } catch (err) {
      showToast(err.message || 'Failed to submit suggestion', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Cache updater ────────────────────────────────────────────────
  const updateSuggestionInCache = useCallback((suggestionId, updater) => {
    queryClient.setQueryData([...SUGGESTIONS_QUERY_KEY, 'my'], (prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((s) => (s._id === suggestionId ? updater(s) : s));
    });
    queryClient.setQueryData([...SUGGESTIONS_QUERY_KEY, 'board'], (prev) => {
      if (!prev?.pages) return prev;
      return {
        ...prev,
        pages: prev.pages.map((page) => ({
          ...page,
          suggestions: (page.suggestions ?? []).map((s) =>
            s._id === suggestionId ? updater(s) : s
          ),
        })),
      };
    });
  }, [queryClient]);

  // ── Vote / state-change / delete / load-more ─────────────────────
  const handleVote = async (suggestionId) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/suggestions/${suggestionId}/vote`, { method: 'POST' });
      if (!res.ok) return;
      const updated = await res.json();
      updateSuggestionInCache(suggestionId, (s) => ({ ...s, upvotes: updated.upvotes, hasVoted: !s.hasVoted }));
    } catch (_) { }
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
      updateSuggestionInCache(suggestionId, (s) => ({ ...s, status: updated.status }));
      showToast('State updated successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Could not update state', 'error');
    }
  };

  const handleDelete = async (suggestionId) => {
    if (!window.confirm('Delete this suggestion? This cannot be undone.')) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/suggestions/${suggestionId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete');
      }
      queryClient.setQueryData([...SUGGESTIONS_QUERY_KEY, 'my'], (prev) =>
        Array.isArray(prev) ? prev.filter((s) => s._id !== suggestionId) : prev
      );
      queryClient.setQueryData([...SUGGESTIONS_QUERY_KEY, 'board'], (prev) => {
        if (!prev?.pages) return prev;
        const firstTotal = prev.pages[0]?.total ?? 0;
        return {
          ...prev,
          pages: prev.pages.map((page, i) => ({
            ...page,
            suggestions: (page.suggestions ?? []).filter((s) => s._id !== suggestionId),
            total: i === 0 ? Math.max(0, firstTotal - 1) : page.total,
          })),
        };
      });
      showToast('Suggestion deleted successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Could not delete suggestion', 'error');
    }
  };

  const handleLoadMore = () => boardQuery.fetchNextPage();

  // ── Edit modal handlers ──────────────────────────────────────────
  const openEditModal = (suggestion) => {
    setEditTarget(suggestion);
    setEditForm({
      title: suggestion.title || '',
      category: suggestion.category || 'Feature Request',
      details: suggestion.details || ''
    });
    // Pre-load existing images as URL entries (no File object = already uploaded)
    const existingEntries = (suggestion.images || []).map((src) => ({ src }));
    setEditImages(existingEntries);
    setEditError('');
  };

  const closeEditModal = () => {
    setEditTarget(null);
    setEditImages([]);
    setEditError('');
  };

  // Handle file selection inside the edit form
  const handleEditImageChange = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_IMAGES - editImages.length;
    const toAdd = files.slice(0, remaining);
    if (!toAdd.length) return;
    setEditError(toAdd.length < files.length ? `Maximum ${MAX_IMAGES} images allowed.` : '');
    if (e.target) e.target.value = '';
    setEditCompressing(true);
    try {
      const entries = await compressToEntries(toAdd);
      setEditImages((prev) => [...prev, ...entries]);
    } catch {
      setEditError('Failed to process images. Please try again.');
    } finally {
      setEditCompressing(false);
    }
  }, [editImages, compressToEntries]);

  const removeEditImage = (index) => {
    setEditImages((prev) => prev.filter((_, i) => i !== index));
    setEditError('');
  };

  const handleEditSuggestion = async (e) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError('');
    if (!editForm.title.trim()) { setEditError('Title is required.'); return; }
    const wordCount = editForm.details.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > MAX_DETAILS_WORDS) {
      setEditError(`Details must be ${MAX_DETAILS_WORDS} words or fewer (currently ${wordCount}).`);
      return;
    }
    setEditSubmitting(true);
    try {
      // Upload any new images (those with a .file property); keep existing URLs as-is
      const finalImageUrls = [];
      for (const entry of editImages) {
        if (entry.file) {
          const url = await uploadFile(entry.file);
          if (url) finalImageUrls.push(url);
        } else {
          // existing URL
          finalImageUrls.push(entry.src);
        }
      }

      const res = await authFetch(`${API_BASE_URL}/api/suggestions/${editTarget._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          category: editForm.category,
          details: editForm.details.trim(),
          images: finalImageUrls
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update suggestion');
      }
      const updated = await res.json();
      updateSuggestionInCache(editTarget._id, (s) => ({
        ...s,
        title: updated.title,
        category: updated.category,
        details: updated.details,
        images: updated.images
      }));
      showToast('Suggestion updated successfully!', 'success');
      closeEditModal();
    } catch (err) {
      showToast(err.message || 'Could not update suggestion', 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── Comments ─────────────────────────────────────────────────────
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
      updateSuggestionInCache(suggestionId, (s) => ({ ...s, comments: updated.comments || s.comments }));
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

  // ── Derived list ─────────────────────────────────────────────────
  const displayedSuggestions = useMemo(() => {
    const filtered = suggestions.filter(
      (s) => matchesState(s, stateFilter) && matchesCategory(s, categoryFilter)
    );
    switch (sort) {
      case 'new': return [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      case 'oldest': return [...filtered].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      case 'top': return [...filtered].sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0));
      // ── "My Suggestions" ─ client-side filter only, no extra API call ──
      case 'mine': return [...filtered]
        .filter((s) => s.authorId === user?.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      default: return filtered;
    }
  }, [suggestions, stateFilter, categoryFilter, sort, user?.id]);

  // ── Guards ────────────────────────────────────────────────────────
  if (authLoading) {
    return <div className="suggestions-page"><p>Loading...</p></div>;
  }
  if (!isSignedIn) return null;

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="suggestions-page">
      <main className="suggestions-main">
        <div className="suggestions-layout">

          {/* ── Sidebar ───────────────────────────────────────────── */}
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
                    <SuggestionFormFields
                      form={form}
                      setForm={setForm}
                      imagePreviews={imagePreviews}
                      compressing={compressingImages}
                      onFileChange={handleImageChange}
                      onRemoveImage={removeSuggestionImage}
                      imageInputRef={imageInputRef}
                    />
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

          {/* ── Board ─────────────────────────────────────────────── */}
          <section className="suggestions-board" id="board">
            <div className="suggestions-board-header">
              <div className="suggestions-board-title-wrap">
                <h2 className="suggestions-board-title">
                  {view === 'my' ? 'My Submissions' : 'Community Board'}
                </h2>
                <span className="suggestions-board-count">{displayedSuggestions.length}</span>
                <button
                  type="button"
                  className="suggestions-refresh-btn"
                  onClick={() => (view === 'my' ? myQuery.refetch() : boardQuery.refetch())}
                  disabled={view === 'my' ? myQuery.isFetching : boardQuery.isFetching}
                  aria-label="Refresh list"
                  title="Refresh list"
                >
                  <span className="material-icons-round" aria-hidden="true">refresh</span>
                </button>
              </div>

              {view === 'board' && (
                <div className="suggestions-board-controls">
                  <div className="suggestions-board-filters">
                    <div className="suggestions-sort-filter">
                      <label className="suggestions-sort-filter-label">Sort by:</label>
                      <select className="suggestions-sort-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
                        <option value="top">Top</option>
                        <option value="new">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="mine">My Suggestions</option>
                      </select>
                    </div>
                    <div className="suggestions-state-filter">
                      <label className="suggestions-state-filter-label">State:</label>
                      <select className="suggestions-state-select" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} aria-label="Filter by state">
                        {SUGGESTION_STATES.map((opt) => (
                          <option key={opt.key || 'all'} value={opt.key}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="suggestions-state-filter suggestions-category-filter">
                      <label className="suggestions-state-filter-label">Category:</label>
                      <select className="suggestions-state-select suggestions-category-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category">
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

                            {/* Edit button – author only, only when ticket is 'new' */}
                            {s.authorId === user?.id && (s.status === 'new' || !s.status) && (
                              <button
                                type="button"
                                className="suggestions-edit-btn"
                                onClick={() => openEditModal(s)}
                                aria-label="Edit suggestion"
                                title="Edit suggestion (only available while status is New)"
                              >
                                <span className="material-icons-round">edit</span>
                              </button>
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
                              <img src={s.authorImageUrl} alt="" className="suggestions-avatar" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="suggestions-avatar-placeholder">
                                {(s.authorName || '?').charAt(0).toUpperCase()}
                              </span>
                            )}
                            <span className="suggestions-time">{formatTimeAgo(s.createdAt)}</span>
                          </div>
                        </div>

                        {/* First comment preview */}
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
                                    <img src={first.authorImageUrl} alt="" className="suggestions-first-comment-avatar" referrerPolicy="no-referrer" />
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

                        {/* Expanded comments */}
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
                                      <img src={c.authorImageUrl} alt="" className="suggestions-comment-avatar" referrerPolicy="no-referrer" />
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

                      <div className="suggestions-card-vote">
                        <button
                          type="button"
                          className={`suggestions-vote-btn ${hasVoted ? 'voted' : ''} ${isClosed ? 'completed' : ''}`}
                          onClick={() => !isClosed && handleVote(s._id)}
                          disabled={isClosed}
                          aria-label={hasVoted ? 'Remove vote' : 'Upvote'}
                        >
                          <span className="material-icons-round" aria-hidden="true">
                            {isClosed ? 'check_circle' : hasVoted ? 'check_circle' : 'expand_less'}
                          </span>
                          <span className="suggestions-vote-text">Upvote</span>
                          <span className="suggestions-vote-count"> - ({upvotes})</span>
                        </button>
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

      {/* ── Edit Suggestion Modal ────────────────────────────────── */}
      {editTarget && (
        <div
          className="suggestions-edit-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Edit suggestion"
          onClick={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}
        >
          <div className="suggestions-edit-modal">
            {/* Header */}
            <div className="suggestions-edit-modal-header">
              <h2 className="suggestions-edit-modal-title">
                <span className="material-icons-round" aria-hidden="true">edit</span>
                Edit Suggestion
              </h2>
              <button
                type="button"
                className="suggestions-edit-modal-close"
                onClick={closeEditModal}
                aria-label="Close edit modal"
              >
                <span className="material-icons-round">close</span>
              </button>
            </div>

            {/* Info note */}
            <p className="suggestions-edit-modal-note">
              <span className="material-icons-round" aria-hidden="true">info</span>
              Editing is only available while the suggestion is in <strong>New</strong> status.
            </p>

            {/* ── Reused form fields ── */}
            <form className="suggestions-form" onSubmit={handleEditSuggestion}>
              <SuggestionFormFields
                form={editForm}
                setForm={setEditForm}
                imagePreviews={editImages.map((e) => e.src)}
                compressing={editCompressing}
                onFileChange={handleEditImageChange}
                onRemoveImage={removeEditImage}
                imageInputRef={editImageInputRef}
              />

              {editError && (
                <div className="suggestions-msg suggestions-msg-error" role="alert">{editError}</div>
              )}

              <div className="suggestions-edit-modal-actions">
                <button
                  type="button"
                  className="suggestions-edit-cancel-btn"
                  onClick={closeEditModal}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="suggestions-edit-save-btn"
                  disabled={editSubmitting || editCompressing}
                >
                  <span className="material-icons-round" aria-hidden="true">save</span>
                  {editSubmitting ? 'Saving...' : editCompressing ? 'Compressing...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* ── Toast Notification ──────────────────────────────────────── */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />
    </div>
  );
}
