import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import imageCompression from 'browser-image-compression';
import { API_BASE_URL } from '../config';
import { getProblemTypeMarkerHtml } from '../utils/problemTypeIcons';
import { getFullImageUrl } from '../utils/cloudinaryUrls';
import './PinDetails.css';

const PROBLEM_TYPES = [
  { value: 'Trash Pile', label: 'Trash Pile' },
  { value: 'Pothole', label: 'Pothole' },
  { value: 'Broken Pipe', label: 'Broken Pipe' },
  { value: 'Fuse Street Light', label: 'Street Light' },
  { value: 'Other', label: 'Other' }
];

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.6,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  initialQuality: 0.75
};

// Verification score weights by role
const VERIFICATION_ROLE_SCORES = { user: 10, reviewer: 30, ngo: 50, admin: 60 };
const VERIFICATION_ROLE_LABELS = { user: 'Users', reviewer: 'Reviewers', ngo: 'NGOs', admin: 'Admins' };
const VERIFICATION_ROLE_ICONS = { user: 'person', reviewer: 'rate_review', ngo: 'business', admin: 'admin_panel_settings' };

const getVerificationScore = (pinVerification) => {
  if (!pinVerification || pinVerification.length === 0) return 0;
  return pinVerification.reduce((sum, v) => sum + (VERIFICATION_ROLE_SCORES[v.role] || 10), 0);
};

const getVerificationStatus = (score) => {
  if (score >= 121) return { label: 'Highly Verified', emoji: '🔵', className: 'highly-verified', color: '#3b82f6' };
  if (score >= 81) return { label: 'Verified', emoji: '🟢', className: 'verified', color: '#10b981' };
  if (score >= 41) return { label: 'Partially Verified', emoji: '🟡', className: 'partially-verified', color: '#f59e0b' };
  return { label: 'Unverified', emoji: '🔴', className: 'unverified', color: '#ef4444' };
};

const getVerificationRoleCounts = (pinVerification) => {
  const counts = { user: 0, reviewer: 0, ngo: 0, admin: 0 };
  (pinVerification || []).forEach((v) => { counts[v.role] = (counts[v.role] || 0) + 1; });
  return counts;
};

// Truncate a reply-preview string to keep the badge compact.
const truncateReplyText = (text, max = 60) =>
  text && text.length > max ? `${text.slice(0, max)}…` : (text || '…');

// Recursively collect all descendants beyond level 3, flattened with parent-message info.
// Each returned entry has an extra `replyingToText` field for the "Replied to \"…\"" badge.
const flattenDeepReplies = (parentId, parentText, repliesMap) => {
  const children = repliesMap[parentId] || [];
  const result = [];
  for (const child of children) {
    result.push({ ...child, replyingToText: parentText });
    // Recurse so level-5, 6, … are also captured
    result.push(...flattenDeepReplies(child._id, child.text, repliesMap));
  }
  return result;
};

const PinDetails = ({ pin, pins = [], onSelectPin, onClose, onViewOnMap, user, onUpdate, onPinUpdated, shareUrl, isSaved, onSave, onUnsave }) => {
  const navigate = useNavigate();
  const { loading: authLoading, getToken } = useAuth();
  const userId = user?.id ?? null;
  const displayName = user?.fullName || user?.email || 'Anonymous';
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [commentActionLoading, setCommentActionLoading] = useState(null);
  const [voteStatus, setVoteStatus] = useState({ hasVoted: false, voteType: null, upvotes: pin.upvotes, downvotes: pin.downvotes });
  const [verifying, setVerifying] = useState(false);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [scheduledEvents, setScheduledEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const imageModalRef = useRef(null);
  // Edit mode (admin or pin creator)
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editImages, setEditImages] = useState([]); // URLs to keep
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [newImagePreviews, setNewImagePreviews] = useState([]);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [compressingNewImages, setCompressingNewImages] = useState(false);
  const [copiedLocation, setCopiedLocation] = useState(null);
  const [expandedReplies, setExpandedReplies] = useState(new Set());
  const editFileInputRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    fetchComments();
    fetchVoteStatus();
    fetchImages();
  }, [authLoading, getToken, pin._id, userId]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const fetchEventsForPin = async () => {
      setEventsLoading(true);
      try {
        const config = await getAuthConfig();
        const response = await axios.get(`${API_BASE_URL}/api/events?pinId=${encodeURIComponent(pin._id)}&limit=20`, config);
        const data = response.data;
        if (!cancelled && data.events) {
          setScheduledEvents(data.events);
        }
      } catch (err) {
        if (!cancelled) setScheduledEvents([]);
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    };
    fetchEventsForPin();
    return () => { cancelled = true; };
  }, [authLoading, pin._id]);
  useEffect(() => {
    setVoteStatus((prev) => ({ ...prev, upvotes: pin.upvotes, downvotes: pin.downvotes }));
  }, [pin.upvotes, pin.downvotes]);

  useEffect(() => {
    if (selectedImageIndex != null && imageModalRef.current) {
      imageModalRef.current.focus();
    }
  }, [selectedImageIndex]);

  const getAuthConfig = async (extraHeaders = {}) => {
    const token = await getToken();
    if (!token) {
      throw new Error('Missing auth token');
    }
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        ...extraHeaders
      }
    };
  };

  const fetchComments = async () => {
    if (authLoading) return;
    try {
      const config = await getAuthConfig();
      const response = await axios.get(`${API_BASE_URL}/api/comments/pin/${pin._id}`, config);
      setComments(response.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchVoteStatus = async () => {
    if (!userId) {
      setVoteStatus({ hasVoted: false, voteType: null, upvotes: pin.upvotes, downvotes: pin.downvotes });
      return;
    }
    if (authLoading) return;
    try {
      const config = await getAuthConfig();
      const response = await axios.get(`${API_BASE_URL}/api/votes/${pin._id}/status`, config);
      setVoteStatus(response.data);
    } catch (error) {
      console.error('Error fetching vote status:', error);
    }
  };

  const fetchImages = () => {
    if (pin.images && pin.images.length > 0) {
      const urls = pin.images.map(entry =>
        entry.startsWith('http')
          ? getFullImageUrl(entry)
          : `${API_BASE_URL}/api/images/${entry}`
      );
      setImages(urls);
    }
  };

  const handleVerify = async () => {
    if (!userId) {
      alert('Please log in to verify pins.');
      return;
    }
    if (authLoading) return;
    setVerifying(true);
    try {
      const config = await getAuthConfig({ 'Content-Type': 'application/json' });
      const response = await axios.post(`${API_BASE_URL}/api/pins/${pin._id}/verify`, {}, config);
      onPinUpdated?.(response.data);
      onUpdate?.();
    } catch (error) {
      console.error('Error verifying pin:', error);
      if (error.response?.data?.error) {
        alert(error.response.data.error);
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleVote = async (voteType) => {
    if (!userId) {
      alert('Please log in to vote.');
      return;
    }
    if (authLoading) return;
    try {
      const config = await getAuthConfig();
      await axios.post(`${API_BASE_URL}/api/votes`, {
        pinId: pin._id,
        voteType
      }, config);
      fetchVoteStatus();
      onUpdate();
    } catch (error) {
      console.error('Error voting:', error);
      if (error.response?.data?.error) {
        alert(error.response.data.error);
      }
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (!userId) {
      alert('Please log in to comment.');
      return;
    }
    if (authLoading) return;

    setLoading(true);
    try {
      const config = await getAuthConfig({ 'Content-Type': 'application/json' });
      await axios.post(`${API_BASE_URL}/api/comments`, {
        pinId: pin._id,
        author: displayName,
        text: newComment
      }, config);
      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !replyingTo) return;
    if (!userId) {
      alert('Please log in to reply.');
      return;
    }
    if (authLoading) return;

    const parentId = replyingTo;
    setCommentActionLoading(parentId);
    try {
      const config = await getAuthConfig({ 'Content-Type': 'application/json' });
      await axios.post(`${API_BASE_URL}/api/comments`, {
        pinId: pin._id,
        author: displayName,
        text: replyText.trim(),
        parentId
      }, config);
      setReplyingTo(null);
      setReplyText('');
      fetchComments();
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setCommentActionLoading(null);
    }
  };

  const handleCommentLike = async (commentId) => {
    if (!userId) {
      alert('Please log in to like.');
      return;
    }
    if (authLoading) return;
    setCommentActionLoading(commentId);
    try {
      const config = await getAuthConfig({ 'Content-Type': 'application/json' });
      await axios.post(`${API_BASE_URL}/api/comments/${commentId}/like`, {}, config);
      fetchComments();
    } catch (error) {
      console.error('Error liking comment:', error);
    } finally {
      setCommentActionLoading(null);
    }
  };

  const handleCommentDislike = async (commentId) => {
    if (!userId) {
      alert('Please log in to dislike.');
      return;
    }
    if (authLoading) return;
    setCommentActionLoading(commentId);
    try {
      const config = await getAuthConfig({ 'Content-Type': 'application/json' });
      await axios.post(`${API_BASE_URL}/api/comments/${commentId}/dislike`, {}, config);
      fetchComments();
    } catch (error) {
      console.error('Error disliking comment:', error);
    } finally {
      setCommentActionLoading(null);
    }
  };

  // Build comment tree: top-level comments and replies grouped by parentId
  const commentTree = React.useMemo(() => {
    const topLevel = comments.filter((c) => !c.parentId);
    const repliesMap = {};
    comments.forEach((c) => {
      if (c.parentId) {
        const pid = typeof c.parentId === 'string' ? c.parentId : c.parentId?._id || c.parentId;
        if (!repliesMap[pid]) repliesMap[pid] = [];
        repliesMap[pid].push(c);
      }
    });
    Object.keys(repliesMap).forEach((pid) => {
      repliesMap[pid].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });
    return { topLevel, repliesMap };
  }, [comments]);

  const openImageModal = (index) => {
    setSelectedImageIndex(index);
  };

  const closeImageModal = () => {
    setSelectedImageIndex(null);
  };

  const goToPrevImage = (e) => {
    e.stopPropagation();
    if (images.length <= 1) return;
    setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const goToNextImage = (e) => {
    e.stopPropagation();
    if (images.length <= 1) return;
    setSelectedImageIndex((prev) => (prev + 1) % images.length);
  };

  const handleShare = async () => {
    const url = shareUrl || `${window.location.origin}/pin/${pin._id}`;
    const heading = pin.problemHeading || pin.problemType;
    const title = `Pin-It: ${heading}`;
    const text = pin.description
      ? `${heading} - ${pin.description.substring(0, 100)}${pin.description.length > 100 ? '...' : ''}`
      : heading;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url
        });
      } catch (err) {
        if (err.name !== 'AbortError') copyToClipboard(url);
      }
    } else {
      copyToClipboard(url);
    }
  };

  const handleSaveToggle = async () => {
    if (!userId) {
      alert('Please log in to save pins.');
      return;
    }
    if (authLoading) return;
    setSaving(true);
    try {
      const config = await getAuthConfig();
      if (isSaved) {
        await axios.delete(`${API_BASE_URL}/api/pins/${pin._id}/save`, config);
        onUnsave?.(pin);
      } else {
        const email = user?.email ?? '';
        const username = user?.fullName || email;
        await axios.post(`${API_BASE_URL}/api/pins/${pin._id}/save`, { email, username }, {
          ...config,
          headers: { ...config.headers, 'Content-Type': 'application/json' }
        });
        onSave?.(pin);
      }
      onUpdate?.();
    } catch (error) {
      console.error('Error toggling save:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this pin? This cannot be undone.')) return;
    if (authLoading) return;
    setDeleting(true);
    try {
      const config = await getAuthConfig();
      await axios.delete(`${API_BASE_URL}/api/pins/${pin._id}`, config);
      onClose();
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting pin:', error);
      const msg = error.response?.data?.error || 'Failed to delete pin.';
      alert(msg);
    } finally {
      setDeleting(false);
    }
  };

  const startEditing = useCallback(() => {
    setEditForm({
      problemType: pin.problemType || 'Other',
      severity: pin.severity ?? 5,
      problemHeading: pin.problemHeading || '',
      description: pin.description || '',
      contributor_name: pin.contributor_name || ''
    });
    setEditImages(pin.images && Array.isArray(pin.images) ? [...pin.images] : []);
    setNewImageFiles([]);
    setNewImagePreviews([]);
    setEditError('');
    setIsEditing(true);
  }, [pin]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditForm(null);
    setEditImages([]);
    setNewImageFiles([]);
    setNewImagePreviews([]);
    setEditError('');
  }, []);

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: name === 'severity' ? parseInt(value, 10) : value
    }));
  };

  const removeEditImage = (index) => {
    setEditImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewEditImage = (index) => {
    setNewImageFiles((prev) => prev.filter((_, i) => i !== index));
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNewEditImages = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    const totalSlots = 5 - editImages.length - newImageFiles.length;
    const toAdd = files.slice(0, Math.max(0, totalSlots));
    if (toAdd.length === 0) return;
    if (e.target) e.target.value = '';
    setCompressingNewImages(true);
    try {
      const compressed = await Promise.all(toAdd.map((f) => imageCompression(f, COMPRESSION_OPTIONS)));
      setNewImageFiles((prev) => [...prev, ...compressed]);
      const start = newImageFiles.length;
      const newPreviews = await Promise.all(
        compressed.map((file) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(file);
          });
        })
      );
      setNewImagePreviews((prev) => [...prev.slice(0, start), ...newPreviews]);
    } catch (err) {
      setEditError('Failed to process new images.');
    } finally {
      setCompressingNewImages(false);
    }
  }, [editImages.length, newImageFiles.length]);

  const getEditImageUrl = (url) => {
    if (!url) return '';
    return url.startsWith('http') ? getFullImageUrl(url) : `${API_BASE_URL}/api/images/${url}`;
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm || authLoading) return;
    const heading = (editForm.problemHeading || '').trim();
    if (!heading) {
      setEditError('Problem heading is required.');
      return;
    }
    const totalImages = editImages.length + newImageFiles.length;
    if (totalImages === 0) {
      setEditError('At least one image is required.');
      return;
    }
    setSavingEdit(true);
    setEditError('');
    try {
      const config = await getAuthConfig({ 'Content-Type': 'application/json' });
      const newUrls = [];
      for (const file of newImageFiles) {
        const formData = new FormData();
        formData.append('image', file);
        const uploadRes = await axios.post(
          `${API_BASE_URL}/api/images/upload`,
          formData,
          await getAuthConfig({ 'Content-Type': 'multipart/form-data' })
        );
        newUrls.push(uploadRes.data.url);
      }
      const allImages = [...editImages, ...newUrls];
      const payload = {
        problemType: editForm.problemType,
        severity: parseInt(editForm.severity, 10),
        problemHeading: heading,
        description: editForm.description || '',
        contributor_name: pin.contributor_name || '',
        location: pin.location || { latitude: 0, longitude: 0, address: '' },
        images: allImages
      };
      const response = await axios.put(`${API_BASE_URL}/api/pins/${pin._id}`, payload, config);
      const updatedPin = response.data;
      onUpdate?.();
      onPinUpdated?.(updatedPin);
      cancelEditing();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to save changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

  const copyLocationToClipboard = (text, field) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedLocation(field);
      setTimeout(() => setCopiedLocation(null), 2000);
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedLocation(field);
      setTimeout(() => setCopiedLocation(null), 2000);
    });
  };

  const formatEventDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatEventTime = (startTime, endTime, durationHours) => {
    if (!startTime && (durationHours == null || durationHours < 1)) return '';
    const format = (t) => {
      if (!t || typeof t !== 'string') return '';
      const [h, m] = t.trim().split(':').map((n) => parseInt(n, 10) || 0);
      const hour = h % 24;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
    };
    if (startTime && endTime) return `${format(startTime)} – ${format(endTime)}`;
    if (startTime && durationHours >= 1) return `${format(startTime)} · ${durationHours}h`;
    return format(startTime) || '';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  const getSeverityLabel = (s) => {
    if (s >= 9) return 'CRITICAL';
    if (s >= 7) return 'HIGH';
    if (s >= 5) return 'MEDIUM';
    if (s >= 3) return 'LOW';
    return 'MINOR';
  };

  const reporterName = pin.contributor_name || pin.name || 'Anonymous';
  const reporterAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(reporterName)}&background=ec4899&color=fff`;

  const currentIndex = pins.findIndex((p) => p._id === pin._id);
  const prevPin = currentIndex > 0 ? pins[currentIndex - 1] : null;
  const nextPin = currentIndex >= 0 && currentIndex < pins.length - 1 ? pins[currentIndex + 1] : null;
  const handlePrev = () => prevPin && onSelectPin && onSelectPin(prevPin);
  const handleNext = () => nextPin && onSelectPin && onSelectPin(nextPin);

  return (
    <>
      <div className="pin-details-overlay" onClick={onClose}>
        <div className="pin-details-wrapper" onClick={(e) => e.stopPropagation()}>
          {prevPin && (
            <button
              type="button"
              className="pin-details-nav pin-details-nav-prev"
              onClick={handlePrev}
              aria-label="Previous pin"
              title="Previous pin"
            >
              <span className="material-icons-round">chevron_left</span>
            </button>
          )}
          <div className="pin-details-container">
            <header className="pin-details-header">
              <div className="pin-details-header-content">
                <div
                  className="pin-type-icon-detail"
                  dangerouslySetInnerHTML={{ __html: getProblemTypeMarkerHtml(pin.problemType, 40) }}
                />
                <div>
                  <div className="pin-details-title-row">
                    <h2 className="pin-details-title">{pin.problemType}</h2>
                    {(() => {
                      const vScore = getVerificationScore(pin.pinVerification);
                      const vStatus = getVerificationStatus(vScore);
                      return (
                        <span className={`pin-details-badge pin-details-verified-badge ${vStatus.className}`}>
                          {vStatus.emoji} {vStatus.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div className="pin-details-header-actions">
                {user && (
                  <button
                    type="button"
                    className={`pin-details-btn pin-details-btn-primary ${isSaved ? 'saved' : ''}`}
                    onClick={handleSaveToggle}
                    disabled={saving}
                    title={isSaved ? 'Unsave this pin' : 'Save this pin'}
                  >
                    <span className="material-icons-round">bookmark</span>
                    <span className="pin-details-btn-label">{saving ? '...' : isSaved ? 'Saved' : 'Save'}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="pin-details-btn pin-details-btn-secondary"
                  onClick={handleShare}
                  title="Share this pin"
                >
                  <span className="material-icons-round">share</span>
                  <span className="pin-details-btn-label">{shareCopied ? 'Copied!' : 'Share'}</span>
                </button>
                <button className="pin-details-close" onClick={onClose} aria-label="Close">
                  <span className="material-icons-round">close</span>
                </button>
              </div>
            </header>

            <main className="pin-details-main">
              {isEditing && editForm ? (
                <form onSubmit={handleSaveEdit} className="pin-details-edit-form">
                  {editError && <div className="pin-details-edit-error" role="alert">{editError}</div>}
                  <div className="pin-details-edit-group">
                    <label>Address <span className="pin-details-edit-optional">(read-only)</span></label>
                    <input
                      type="text"
                      className="pin-details-edit-input"
                      value={pin.location?.address ?? '—'}
                      readOnly
                      aria-readonly="true"
                    />
                  </div>
                  <div className="pin-details-edit-row">
                    <div className="pin-details-edit-group">
                      <label>Problem Type <span className="required">*</span></label>
                      <select
                        name="problemType"
                        value={editForm.problemType}
                        onChange={handleEditInputChange}
                        className="pin-details-edit-input pin-details-edit-select"
                      >
                        {PROBLEM_TYPES.map(({ value, label }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="pin-details-edit-group">
                      <label>Severity (1–10) <span className="required">*</span></label>
                      <div className="pin-details-edit-severity-wrap">
                        <input
                          type="range"
                          name="severity"
                          min="1"
                          max="10"
                          value={editForm.severity}
                          onChange={handleEditInputChange}
                          className="pin-details-edit-severity"
                        />
                        <span className="pin-details-edit-severity-value">{editForm.severity}/10</span>
                      </div>
                    </div>
                  </div>
                  <div className="pin-details-edit-group">
                    <label>Problem Heading <span className="required">*</span></label>
                    <input
                      type="text"
                      name="problemHeading"
                      value={editForm.problemHeading}
                      onChange={handleEditInputChange}
                      placeholder="e.g. Garbage pile near the park"
                      className="pin-details-edit-input"
                      required
                    />
                  </div>
                  <div className="pin-details-edit-group">
                    <label>Description <span className="pin-details-edit-optional">(optional)</span></label>
                    <textarea
                      name="description"
                      value={editForm.description}
                      onChange={handleEditInputChange}
                      placeholder="Describe the problem..."
                      rows={3}
                      className="pin-details-edit-input pin-details-edit-textarea"
                    />
                  </div>
                  <div className="pin-details-edit-group">
                    <label>Images <span className="required">*</span> (at least 1, max 5)</label>
                    <div className="pin-details-edit-images">
                      {editImages.map((url, index) => (
                        <div key={`existing-${index}`} className="pin-details-edit-thumb-wrap">
                          <img src={getEditImageUrl(url)} alt="" />
                          <button type="button" className="pin-details-edit-thumb-remove" onClick={() => removeEditImage(index)} aria-label="Remove image">×</button>
                        </div>
                      ))}
                      {newImagePreviews.map((src, index) => (
                        <div key={`new-${index}`} className="pin-details-edit-thumb-wrap">
                          <img src={src} alt="" />
                          <button type="button" className="pin-details-edit-thumb-remove" onClick={() => removeNewEditImage(index)} aria-label="Remove image">×</button>
                        </div>
                      ))}
                      {editImages.length + newImageFiles.length < 5 && (
                        <div
                          role="button"
                          tabIndex={0}
                          className={`pin-details-edit-add-thumb ${compressingNewImages ? 'disabled' : ''}`}
                          onClick={() => !compressingNewImages && editFileInputRef.current?.click()}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && editFileInputRef.current?.click()}
                          aria-label="Add image"
                        >
                          <span className="material-icons-round">add_photo_alternate</span>
                          {compressingNewImages ? 'Compressing...' : 'Add'}
                        </div>
                      )}
                    </div>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleNewEditImages}
                      className="pin-details-edit-file-hidden"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="pin-details-edit-actions">
                    <button type="button" className="pin-details-btn pin-details-btn-secondary" onClick={cancelEditing} disabled={savingEdit}>
                      Cancel
                    </button>
                    <button type="submit" className="pin-details-btn pin-details-btn-primary" disabled={savingEdit}>
                      {savingEdit ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="pin-details-meta pin-details-published-below">
                    - Published {formatDate(pin.createdAt)}
                  </p>
                  <div className="pin-details-stats">
                    <div className="pin-details-stat-card">
                      <p className="pin-details-stat-label">Severity Score</p>
                      <div className="pin-details-stat-value">
                        <span className={`severity-score severity-${getSeverityLabel(pin.severity).toLowerCase()}`}>{pin.severity}/10</span>
                        <span className={`severity-label severity-${getSeverityLabel(pin.severity).toLowerCase()}`}>
                          {getSeverityLabel(pin.severity)}
                        </span>
                      </div>
                    </div>
                    <div className="pin-details-stat-card">
                      <p className="pin-details-stat-label">Reported By</p>
                      <div className="pin-details-stat-reported">
                        <img alt={`${reporterName} Avatar`} className="reporter-avatar" src={reporterAvatar} />
                        <span className="reporter-name">{reporterName}</span>
                      </div>
                    </div>
                    <div className="pin-details-stat-card pin-details-stat-votes">
                      <p className="pin-details-stat-label">Community Response</p>
                      <div className="pin-details-votes">
                        <button
                          type="button"
                          className={`vote-inline upvote ${voteStatus.voteType === 'upvote' ? 'active' : ''}`}
                          onClick={() => handleVote('upvote')}
                        >
                          <span className="material-icons-round">thumb_up</span>
                          {voteStatus.upvotes}
                        </button>
                        <button
                          type="button"
                          className={`vote-inline downvote ${voteStatus.voteType === 'downvote' ? 'active' : ''}`}
                          onClick={() => handleVote('downvote')}
                        >
                          <span className="material-icons-round">thumb_down</span>
                          {voteStatus.downvotes}
                        </button>
                      </div>
                    </div>
                    {(() => {
                      const verifications = pin.pinVerification || [];
                      const vScore = getVerificationScore(verifications);
                      const vStatus = getVerificationStatus(vScore);
                      const roleCounts = getVerificationRoleCounts(verifications);
                      const hasVerified = verifications.some((v) => String(v.userId) === String(userId));
                      const maxScore = 180; // reasonable max for progress display
                      const progressPct = Math.min((vScore / maxScore) * 100, 100);
                      return (
                        <div className="pin-details-stat-card pin-details-stat-verify pin-details-verification-card">
                          <p className="pin-details-stat-label pin-details-stat-label-with-info">
                            Verification Status
                            <span className="pin-verification-info-wrap">
                              <span className="material-icons-round pin-verification-info-icon" aria-hidden="true">info</span>
                              <span className="pin-verification-info-tooltip" role="tooltip">
                                <span className="pin-verification-info-line">🔵 Highly Verified (Score ≥ 121)</span>
                                <span className="pin-verification-info-line">🟢 Verified (Score 81 – 120)</span>
                                <span className="pin-verification-info-line">🟡 Partially Verified (Score 41–80)</span>
                                <span className="pin-verification-info-line">🔴 Unverified (Score ≤ 40)</span>
                              </span>
                            </span>
                          </p>
                          <div className="pin-verification-status-row">
                            <span className="pin-verification-emoji">{vStatus.emoji}</span>
                            <span className="pin-verification-status-label" style={{ color: vStatus.color }}>{vStatus.label}</span>
                            <span className="pin-verification-score">Score: {vScore}</span>
                          </div>
                          <div className="pin-verification-progress-wrap">
                            <div className="pin-verification-progress-bar">
                              <div
                                className="pin-verification-progress-fill"
                                style={{ width: `${progressPct}%`, background: vStatus.color }}
                              />
                            </div>
                          </div>
                          <div className="pin-verification-breakdown">
                            {['user', 'reviewer', 'ngo', 'admin'].map((role) => (
                              <div key={role} className="pin-verification-role-item">
                                <span className="material-icons-round pin-verification-role-icon">{VERIFICATION_ROLE_ICONS[role]}</span>
                                <span className="pin-verification-role-label">{VERIFICATION_ROLE_LABELS[role]}</span>
                                <span className="pin-verification-role-count">{roleCounts[role]}</span>
                                <span className="pin-verification-role-pts">({VERIFICATION_ROLE_SCORES[role]}pts each)</span>
                              </div>
                            ))}
                          </div>
                          <div className="pin-verification-total">
                            Total verifiers: {verifications.length}
                          </div>
                          {user && (
                            <button
                              type="button"
                              className={`pin-details-verify-btn ${hasVerified ? 'verified' : ''}`}
                              onClick={handleVerify}
                              disabled={verifying}
                              title={hasVerified ? 'Remove your verification' : 'Verify this pin'}
                            >
                              <span className="material-icons-round">
                                {hasVerified ? 'verified' : 'verified_user'}
                              </span>
                              {verifying ? '...' : hasVerified ? 'Verified ✓' : 'Verify'}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {images.length > 0 && (
                    <section className="pin-details-section">
                      <div className="pin-details-section-header">
                        <h3 className="pin-details-section-title">
                          <span className="material-icons-round">photo_library</span>
                          Visual Evidence
                        </h3>
                        <span className="pin-details-attachment-badge">{images.length} ATTACHMENTS</span>
                      </div>
                      <div className="pin-details-images-grid">
                        {images.map((url, index) => (
                          <div
                            key={index}
                            className="pin-details-image-wrap"
                            onClick={() => openImageModal(index)}
                          >
                            <img src={url} alt={`Evidence ${index + 1}`} />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {pin.problemHeading && (
                    <section className="pin-details-section">
                      <h3 className="pin-details-section-title">
                        <span className="material-icons-round">title</span>
                        Problem Heading
                      </h3>
                      <div className="pin-details-problem-heading">
                        <p>{pin.problemHeading}</p>
                      </div>
                    </section>
                  )}

                  {pin.description && (
                    <section className="pin-details-section">
                      <h3 className="pin-details-section-title">
                        <span className="material-icons-round">subject</span>
                        Description
                      </h3>
                      <div className="pin-details-description">
                        <p>{pin.description}</p>
                      </div>
                    </section>
                  )}

                  {(pin.location?.address || (pin.location?.latitude != null && pin.location?.longitude != null)) && (
                    <section className="pin-details-section">
                      <h3 className="pin-details-section-title">
                        <span className="material-icons-round">pin_drop</span>
                        Precise Location
                      </h3>
                      <div className="pin-details-location">
                        {pin.location?.address && (
                          <div className="location-address-row">
                            <p className="location-address">{pin.location.address}</p>
                          </div>
                        )}
                        {pin.location?.latitude != null && pin.location?.longitude != null && (
                          <div className="location-coords">
                            <span>LAT: {pin.location.latitude.toFixed(5)}° N</span>
                            <span>LONG: {pin.location.longitude.toFixed(5)}° E</span>
                          </div>
                        )}
                        <div className="pin-details-location-actions">
                          {pin.location?.address && (
                            <button
                              type="button"
                              className="pin-details-copy-btn"
                              onClick={() => {
                                let text = `Location: ${pin.location.address || '—'}`;
                                if (pin.location.latitude != null && pin.location.longitude != null) {
                                  text += `\nLatitude: ${pin.location.latitude.toFixed(5)} & Longitude: ${pin.location.longitude.toFixed(5)}`;
                                }
                                copyLocationToClipboard(text, 'location');
                              }}
                              title="Copy address and coordinates"
                              aria-label="Copy address and coordinates"
                            >
                              <span className="material-icons-round">{copiedLocation === 'location' ? 'check' : 'content_copy'}</span>
                              {copiedLocation === 'location' ? 'Copied!' : 'Copy'}
                            </button>
                          )}
                          {onViewOnMap && (pin.location?.latitude != null && pin.location?.longitude != null) && (
                            <button
                              type="button"
                              className="pin-details-view-on-map-btn"
                              onClick={() => onViewOnMap(pin)}
                              title="Focus this pin on the map and close this panel"
                              aria-label="View on map"
                            >
                              <span className="material-icons-round">map</span>
                              View on map
                            </button>
                          )}
                        </div>
                      </div>
                    </section>
                  )}

                  {(eventsLoading || scheduledEvents.length > 0) && (
                    <section className="pin-details-section pin-details-events-section">
                      <h3 className="pin-details-section-title">
                        <span className="material-icons-round">event</span>
                        Event scheduled for this pin
                      </h3>
                      {eventsLoading ? (
                        <p className="pin-details-events-loading">Loading events...</p>
                      ) : (
                        <div className="pin-details-events-list">
                          {scheduledEvents.map((ev) => (
                            <div key={ev._id} className="pin-details-event-card">
                              <div className="pin-details-event-meta">
                                <span className="pin-details-event-date">{formatEventDate(ev.date)}</span>
                                {(ev.startTime || ev.endTime || ev.durationHours) && (
                                  <span className="pin-details-event-time">
                                    {formatEventTime(ev.startTime, ev.endTime, ev.durationHours)}
                                  </span>
                                )}
                              </div>
                              <p className="pin-details-event-title">{ev.title}</p>
                              <Link
                                to={`/events/${ev._id}`}
                                className="pin-details-event-link"
                                onClick={() => onClose()}
                              >
                                View full event details
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  <section className="yt-comments-section">
                    <h3 className="yt-comments-title">
                      <span className="material-icons-round">forum</span>
                      {comments.length} Comments
                    </h3>
                    <div className="yt-comments-list">
                      {comments.length === 0 ? (
                        <p className="yt-no-comments">No comments yet. Be the first to comment!</p>
                      ) : (
                        commentTree.topLevel.map((comment) => {
                          const replies = commentTree.repliesMap[comment._id] || [];
                          const isReplyingThis = replyingTo === comment._id;
                          const isLoading = commentActionLoading === comment._id;
                          const isExpanded = expandedReplies.has(comment._id);
                          const toggleReplies = () =>
                            setExpandedReplies((prev) => {
                              const next = new Set(prev);
                              if (next.has(comment._id)) next.delete(comment._id);
                              else next.add(comment._id);
                              return next;
                            });

                          return (
                            <div key={comment._id} className="yt-comment-thread">
                              {/* Top-level comment */}
                              <div className="yt-comment">
                                <img
                                  alt=""
                                  className="yt-avatar yt-avatar-lg"
                                  src={comment.authorImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author)}&background=e2e8f0&color=64748b`}
                                />
                                <div className="yt-comment-content">
                                  <div className="yt-comment-meta">
                                    <span className="yt-comment-author">{comment.author}</span>
                                    <span className="yt-comment-date">{formatDate(comment.createdAt)}</span>
                                  </div>
                                  <p className="yt-comment-text">{comment.text}</p>
                                  <div className="yt-comment-actions">
                                    <button
                                      type="button"
                                      className={`yt-action-btn ${comment.userLiked ? 'active' : ''}`}
                                      onClick={() => handleCommentLike(comment._id)}
                                      disabled={!userId || isLoading}
                                      title="Like"
                                    >
                                      <span className="material-icons-round">thumb_up</span>
                                      {comment.likes > 0 && <span className="yt-action-count">{comment.likes}</span>}
                                    </button>
                                    <button
                                      type="button"
                                      className={`yt-action-btn ${comment.userDisliked ? 'active' : ''}`}
                                      onClick={() => handleCommentDislike(comment._id)}
                                      disabled={!userId || isLoading}
                                      title="Dislike"
                                    >
                                      <span className="material-icons-round">thumb_down</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="yt-reply-btn"
                                      onClick={() => setReplyingTo(isReplyingThis ? null : comment._id)}
                                      disabled={!userId}
                                    >
                                      Reply
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Reply form for top-level */}
                              {isReplyingThis && (
                                <div className="yt-reply-form-wrap">
                                  <img
                                    alt=""
                                    className="yt-avatar yt-avatar-sm"
                                    src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=ec4899&color=fff`}
                                  />
                                  <form className="yt-reply-form" onSubmit={handleReplySubmit}>
                                    <textarea
                                      placeholder={`Reply to ${comment.author}...`}
                                      value={replyText}
                                      onChange={(e) => setReplyText(e.target.value)}
                                      rows={1}
                                      className="yt-reply-textarea"
                                      autoFocus
                                    />
                                    <div className="yt-reply-form-actions">
                                      <button
                                        type="button"
                                        className="yt-form-cancel-btn"
                                        onClick={() => { setReplyingTo(null); setReplyText(''); }}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="submit"
                                        disabled={commentActionLoading === comment._id || !replyText.trim()}
                                        className="yt-form-submit-btn"
                                      >
                                        Reply
                                      </button>
                                    </div>
                                  </form>
                                </div>
                              )}

                              {/* Replies toggle + replies */}
                              {replies.length > 0 && (
                                <div className="yt-replies-section">
                                  <button className="yt-toggle-replies-btn" onClick={toggleReplies}>
                                    <span className="material-icons-round">
                                      {isExpanded ? 'expand_less' : 'expand_more'}
                                    </span>
                                    {isExpanded ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                                  </button>

                                  {isExpanded && (
                                    <div className="yt-replies-list">
                                      {replies.map((reply) => {
                                        const replyIsReplying = replyingTo === reply._id;
                                        const replyLoading = commentActionLoading === reply._id;
                                        const replyReplies = commentTree.repliesMap[reply._id] || [];

                                        // Flatten level 3+ replies
                                        const flatDeepReplies = replyReplies.flatMap((nr) =>
                                          flattenDeepReplies(nr._id, nr.text, commentTree.repliesMap)
                                        );
                                        const replyingToDeep = replyingTo
                                          ? flatDeepReplies.find((r) => r._id === replyingTo) || null
                                          : null;

                                        return (
                                          <div key={reply._id} className="yt-reply-thread">
                                            {/* Level 1 reply */}
                                            <div className="yt-comment yt-reply">
                                              <img
                                                alt=""
                                                className="yt-avatar yt-avatar-sm"
                                                src={reply.authorImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.author)}&background=e2e8f0&color=64748b`}
                                              />
                                              <div className="yt-comment-content">
                                                <div className="yt-comment-meta">
                                                  <span className="yt-comment-author">{reply.author}</span>
                                                  <span className="yt-comment-date">{formatDate(reply.createdAt)}</span>
                                                </div>
                                                <p className="yt-comment-text">{reply.text}</p>
                                                <div className="yt-comment-actions">
                                                  <button
                                                    type="button"
                                                    className={`yt-action-btn ${reply.userLiked ? 'active' : ''}`}
                                                    onClick={() => handleCommentLike(reply._id)}
                                                    disabled={!userId || replyLoading}
                                                    title="Like"
                                                  >
                                                    <span className="material-icons-round">thumb_up</span>
                                                    {reply.likes > 0 && <span className="yt-action-count">{reply.likes}</span>}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className={`yt-action-btn ${reply.userDisliked ? 'active' : ''}`}
                                                    onClick={() => handleCommentDislike(reply._id)}
                                                    disabled={!userId || replyLoading}
                                                    title="Dislike"
                                                  >
                                                    <span className="material-icons-round">thumb_down</span>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="yt-reply-btn"
                                                    onClick={() => setReplyingTo(replyIsReplying ? null : reply._id)}
                                                    disabled={!userId}
                                                  >
                                                    Reply
                                                  </button>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Reply form for level 1 */}
                                            {replyIsReplying && (
                                              <div className="yt-reply-form-wrap yt-reply-form-wrap-nested">
                                                <img
                                                  alt=""
                                                  className="yt-avatar yt-avatar-sm"
                                                  src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=ec4899&color=fff`}
                                                />
                                                <form className="yt-reply-form" onSubmit={handleReplySubmit}>
                                                  <textarea
                                                    placeholder={`Reply to ${reply.author}...`}
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    rows={1}
                                                    className="yt-reply-textarea"
                                                    autoFocus
                                                  />
                                                  <div className="yt-reply-form-actions">
                                                    <button
                                                      type="button"
                                                      className="yt-form-cancel-btn"
                                                      onClick={() => { setReplyingTo(null); setReplyText(''); }}
                                                    >
                                                      Cancel
                                                    </button>
                                                    <button
                                                      type="submit"
                                                      disabled={commentActionLoading === reply._id || !replyText.trim()}
                                                      className="yt-form-submit-btn"
                                                    >
                                                      Reply
                                                    </button>
                                                  </div>
                                                </form>
                                              </div>
                                            )}

                                            {/* Level 2+ replies (nested, all flattened at same indent) */}
                                            {(replyReplies.length > 0 || flatDeepReplies.length > 0) && (
                                              <div className="yt-deep-replies-list">
                                                {replyReplies.map((nestedReply) => {
                                                  const nestedLoading = commentActionLoading === nestedReply._id;
                                                  return (
                                                    <div key={nestedReply._id} className="yt-comment yt-reply">
                                                      <img
                                                        alt=""
                                                        className="yt-avatar yt-avatar-sm"
                                                        src={nestedReply.authorImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(nestedReply.author)}&background=e2e8f0&color=64748b`}
                                                      />
                                                      <div className="yt-comment-content">
                                                        <div className="yt-comment-meta">
                                                          <span className="yt-comment-author">{nestedReply.author}</span>
                                                          <span className="yt-comment-date">{formatDate(nestedReply.createdAt)}</span>
                                                        </div>
                                                        <p className="yt-comment-text">{nestedReply.text}</p>
                                                        <div className="yt-comment-actions">
                                                          <button
                                                            type="button"
                                                            className={`yt-action-btn ${nestedReply.userLiked ? 'active' : ''}`}
                                                            onClick={() => handleCommentLike(nestedReply._id)}
                                                            disabled={!userId || nestedLoading}
                                                            title="Like"
                                                          >
                                                            <span className="material-icons-round">thumb_up</span>
                                                            {nestedReply.likes > 0 && <span className="yt-action-count">{nestedReply.likes}</span>}
                                                          </button>
                                                          <button
                                                            type="button"
                                                            className={`yt-action-btn ${nestedReply.userDisliked ? 'active' : ''}`}
                                                            onClick={() => handleCommentDislike(nestedReply._id)}
                                                            disabled={!userId || nestedLoading}
                                                            title="Dislike"
                                                          >
                                                            <span className="material-icons-round">thumb_down</span>
                                                          </button>
                                                          <button
                                                            type="button"
                                                            className="yt-reply-btn"
                                                            onClick={() => setReplyingTo(replyingTo === nestedReply._id ? null : nestedReply._id)}
                                                            disabled={!userId}
                                                          >
                                                            Reply
                                                          </button>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  );
                                                })}

                                                {/* Level 4+ deep replies */}
                                                {flatDeepReplies.map((deepReply) => {
                                                  const deepLoading = commentActionLoading === deepReply._id;
                                                  return (
                                                    <div key={deepReply._id} className="yt-comment yt-reply">
                                                      <img
                                                        alt=""
                                                        className="yt-avatar yt-avatar-sm"
                                                        src={deepReply.authorImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(deepReply.author)}&background=e2e8f0&color=64748b`}
                                                      />
                                                      <div className="yt-comment-content">
                                                        <div className="yt-comment-meta">
                                                          <span className="yt-comment-author">{deepReply.author}</span>
                                                          <span className="yt-comment-date">{formatDate(deepReply.createdAt)}</span>
                                                        </div>
                                                        <p className="yt-comment-text">{deepReply.text}</p>
                                                        <div className="yt-comment-actions">
                                                          <button
                                                            type="button"
                                                            className={`yt-action-btn ${deepReply.userLiked ? 'active' : ''}`}
                                                            onClick={() => handleCommentLike(deepReply._id)}
                                                            disabled={!userId || deepLoading}
                                                            title="Like"
                                                          >
                                                            <span className="material-icons-round">thumb_up</span>
                                                            {deepReply.likes > 0 && <span className="yt-action-count">{deepReply.likes}</span>}
                                                          </button>
                                                          <button
                                                            type="button"
                                                            className={`yt-action-btn ${deepReply.userDisliked ? 'active' : ''}`}
                                                            onClick={() => handleCommentDislike(deepReply._id)}
                                                            disabled={!userId || deepLoading}
                                                            title="Dislike"
                                                          >
                                                            <span className="material-icons-round">thumb_down</span>
                                                          </button>
                                                          <button
                                                            type="button"
                                                            className="yt-reply-btn"
                                                            onClick={() => setReplyingTo(replyingTo === deepReply._id ? null : deepReply._id)}
                                                            disabled={!userId}
                                                          >
                                                            Reply
                                                          </button>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  );
                                                })}

                                                {/* Unified reply form for level 2+ */}
                                                {replyingTo && (replyReplies.some((r) => r._id === replyingTo) || replyingToDeep) && (
                                                  <div className="yt-reply-form-wrap yt-reply-form-wrap-nested">
                                                    <img
                                                      alt=""
                                                      className="yt-avatar yt-avatar-sm"
                                                      src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=ec4899&color=fff`}
                                                    />
                                                    <form className="yt-reply-form" onSubmit={handleReplySubmit}>
                                                      {replyingToDeep && (
                                                        <div className="yt-reply-context">
                                                          <span className="material-icons-round">reply</span>
                                                          Replying to "{truncateReplyText(replyingToDeep.text)}"
                                                        </div>
                                                      )}
                                                      <textarea
                                                        placeholder="Write a reply..."
                                                        value={replyText}
                                                        onChange={(e) => setReplyText(e.target.value)}
                                                        rows={1}
                                                        className="yt-reply-textarea"
                                                        autoFocus
                                                      />
                                                      <div className="yt-reply-form-actions">
                                                        <button
                                                          type="button"
                                                          className="yt-form-cancel-btn"
                                                          onClick={() => { setReplyingTo(null); setReplyText(''); }}
                                                        >
                                                          Cancel
                                                        </button>
                                                        <button
                                                          type="submit"
                                                          disabled={!replyText.trim()}
                                                          className="yt-form-submit-btn"
                                                        >
                                                          Reply
                                                        </button>
                                                      </div>
                                                    </form>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>

                  {(user?.role === 'admin' || pin.contributor_id === user?.id) && (
                    <div className="pin-details-bottom-actions">
                      <button
                        type="button"
                        className="pin-details-btn pin-details-btn-edit"
                        onClick={startEditing}
                        disabled={savingEdit}
                        title="Edit"
                      >
                        <span className="material-icons-round">edit</span>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="pin-details-btn pin-details-btn-danger"
                        onClick={handleDelete}
                        disabled={deleting}
                        title="Delete"
                      >
                        <span className="material-icons-round">delete</span>
                        {deleting ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </main>

            {!isEditing && (
              <footer className="pin-details-footer">
                <p className="pin-details-footer-label">
                  Posting as <span className="primary-text">{displayName}</span>
                </p>
                <form onSubmit={handleCommentSubmit} className="pin-details-comment-form">
                  <textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    className="pin-details-textarea"
                  />
                  <button
                    type="submit"
                    disabled={loading || !newComment.trim()}
                    className="pin-details-post-btn"
                  >
                    Post Note
                  </button>
                </form>
              </footer>
            )}
          </div>
          {nextPin && (
            <button
              type="button"
              className="pin-details-nav pin-details-nav-next"
              onClick={handleNext}
              aria-label="Next pin"
              title="Next pin"
            >
              <span className="material-icons-round">chevron_right</span>
            </button>
          )}
        </div>
      </div>

      {/* Image Modal */}
      <div
        ref={imageModalRef}
        className={`image-modal ${selectedImageIndex != null ? 'active' : ''}`}
        onClick={closeImageModal}
        onKeyDown={(e) => {
          if (selectedImageIndex == null) return;
          if (e.key === 'Escape') closeImageModal();
          if (e.key === 'ArrowLeft') goToPrevImage(e);
          if (e.key === 'ArrowRight') goToNextImage(e);
        }}
        tabIndex={selectedImageIndex != null ? 0 : -1}
        role="dialog"
        aria-label="Image viewer"
      >
        <button className="image-modal-close" onClick={closeImageModal}>
          <span className="material-icons-round">close</span>
        </button>
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="image-modal-nav image-modal-prev"
              onClick={goToPrevImage}
              aria-label="Previous image"
            >
              <span className="material-icons-round">chevron_left</span>
            </button>
            <button
              type="button"
              className="image-modal-nav image-modal-next"
              onClick={goToNextImage}
              aria-label="Next image"
            >
              <span className="material-icons-round">chevron_right</span>
            </button>
          </>
        )}
        {selectedImageIndex != null && images[selectedImageIndex] && (
          <>
            <img
              src={images[selectedImageIndex]}
              alt={`Image ${selectedImageIndex + 1} of ${images.length}`}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="image-modal-counter">
              {selectedImageIndex + 1} / {images.length}
            </span>
          </>
        )}
      </div>
    </>
  );
};

export default PinDetails;
