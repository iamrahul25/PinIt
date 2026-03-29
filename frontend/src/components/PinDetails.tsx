import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import { getProblemTypeMarkerHtml } from '../utils/problemTypeIcons';
import { compressImageWithPreset } from '../utils/imageCompression';
import { uploadImageFile } from '../utils/imageUploadApi';
import {
  getPinImageDisplayUrl,
  getPinImageMeta,
  pinImageFromUploadResponse
} from '../utils/pinImageEntry';
import EditPinDetails from './EditPinDetails';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import {
  Calendar, Bookmark, Share2, X, ChevronLeft, ChevronRight,
  ThumbsUp, ThumbsDown, MapPin, Copy, Check, ExternalLink,
  AlertTriangle, Flag, ShieldCheck, Clock, CalendarDays,
  CheckCircle2, MessageSquare, Send, Edit3, Trash2, Plus,
  ImagePlus, Info, ChevronDown, ChevronUp, Undo2, Map,
  User, Users, Building2, ShieldAlert, Loader2, Eye, ZoomIn, ZoomOut
} from 'lucide-react';
import './PinDetails.css';

const MAX_IMAGES_PER_SECTION = 10;

const VERIFICATION_ROLE_SCORES = { user: 10, reviewer: 30, ngo: 50, admin: 60 };
const VERIFICATION_ROLE_LABELS = { user: 'Users', reviewer: 'Reviewers', ngo: 'NGOs', admin: 'Admins' };
const VERIFICATION_ROLE_ICONS = { user: <User size={14} />, reviewer: <ShieldCheck size={14} />, ngo: <Building2 size={14} />, admin: <ShieldAlert size={14} /> };

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

const truncateReplyText = (text, max = 60) =>
  text && text.length > max ? `${text.slice(0, max)}…` : (text || '…');

const flattenDeepReplies = (parentId, parentText, repliesMap) => {
  const children = repliesMap[parentId] || [];
  const result = [];
  for (const child of children) {
    result.push({ ...child, replyingToText: parentText });
    result.push(...flattenDeepReplies(child._id, child.text, repliesMap));
  }
  return result;
};

const PinDetails = ({ pin, pins = [], onSelectPin, onClose, onViewOnMap, onRequestRepositionPin, onCancelReposition, newLocationForEdit, onConsumeNewLocation, isRepositioningPin, user, onUpdate, onPinUpdated, shareUrl, isSaved, onSave, onUnsave }) => {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [loading, setLoading] = useState(false);
  const [addingImageType, setAddingImageType] = useState(null);
  const addBeforeInputRef = useRef(null);
  const addAfterInputRef = useRef(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [scheduledEvents, setScheduledEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const imageModalRef = useRef(null);
  const imageViewerViewportRef = useRef(null);
  const [imageViewerZoom, setImageViewerZoom] = useState(1);
  const [imageViewerPan, setImageViewerPan] = useState({ x: 0, y: 0 });
  const [imageViewerDragging, setImageViewerDragging] = useState(false);
  const imageZoomRef = useRef(1);
  const imagePanRef = useRef({ x: 0, y: 0 });
  const imageViewerPinchRef = useRef(null);
  const imageViewerLastTouchRef = useRef({ x: 0, y: 0 });
  const imageViewerMouseDragRef = useRef(false);
  const commentsSectionRef = useRef(null);
  const newCommentTextareaRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [copiedLocation, setCopiedLocation] = useState(null);
  const [expandedReplies, setExpandedReplies] = useState(new Set());
  const [resolving, setResolving] = useState(false);
  const [verificationBreakdownExpanded, setVerificationBreakdownExpanded] = useState(false);
  const [resolveBreakdownExpanded, setResolveBreakdownExpanded] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    fetchComments();
    fetchVoteStatus();
  }, [authLoading, getToken, pin._id, userId, pin.images, pin.imagesAfter]);

  useEffect(() => {
    if (location.state?.focusComments !== true || isEditing) return;
    const run = () => {
      commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => {
        newCommentTextareaRef.current?.focus({ preventScroll: true });
        navigate(
          { pathname: location.pathname, search: location.search, hash: location.hash },
          { replace: true, state: {} }
        );
      }, 450);
    };
    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    return () => cancelAnimationFrame(id);
  }, [pin._id, location.state, isEditing, navigate, location.pathname, location.search, location.hash]);

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

  useEffect(() => {
    imageZoomRef.current = imageViewerZoom;
  }, [imageViewerZoom]);

  useEffect(() => {
    imagePanRef.current = imageViewerPan;
  }, [imageViewerPan]);

  useEffect(() => {
    setImageViewerZoom(1);
    setImageViewerPan({ x: 0, y: 0 });
    imageViewerPinchRef.current = null;
    imageViewerMouseDragRef.current = false;
    setImageViewerDragging(false);
  }, [selectedImageIndex]);

  useEffect(() => {
    if (imageViewerZoom === 1) {
      setImageViewerPan({ x: 0, y: 0 });
      imageViewerMouseDragRef.current = false;
      setImageViewerDragging(false);
    }
  }, [imageViewerZoom]);

  useEffect(() => {
    const el = imageViewerViewportRef.current;
    if (!el || selectedImageIndex == null) return;
    const onWheel = (ev) => {
      ev.preventDefault();
      const zoomFactor = ev.deltaY > 0 ? 0.92 : 1.08;
      setImageViewerZoom((prev) => Math.min(5, Math.max(1, prev * zoomFactor)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [selectedImageIndex]);

  useEffect(() => {
    const el = imageViewerViewportRef.current;
    if (!el || selectedImageIndex == null) return;
    const onTouchMove = (ev) => {
      if (ev.touches.length === 2) {
        ev.preventDefault();
        return;
      }
      if (ev.touches.length === 1 && imageViewerMouseDragRef.current && imageZoomRef.current > 1) {
        ev.preventDefault();
      }
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
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

  const imagesBefore = useMemo(
    () => (pin.images && Array.isArray(pin.images) ? pin.images : []).map((e) => getPinImageDisplayUrl(e, 'full')),
    [pin.images]
  );
  const imagesAfter = useMemo(
    () => (pin.imagesAfter && Array.isArray(pin.imagesAfter) ? pin.imagesAfter : []).map((e) => getPinImageDisplayUrl(e, 'full')),
    [pin.imagesAfter]
  );
  const imageViewerEntries = useMemo(() => {
    const before = (pin.images && Array.isArray(pin.images) ? pin.images : []).map((entry) => ({
      displayUrl: getPinImageDisplayUrl(entry, 'full'),
      meta: getPinImageMeta(entry)
    }));
    const after = (pin.imagesAfter && Array.isArray(pin.imagesAfter) ? pin.imagesAfter : []).map((entry) => ({
      displayUrl: getPinImageDisplayUrl(entry, 'full'),
      meta: getPinImageMeta(entry)
    }));
    return [...before, ...after];
  }, [pin.images, pin.imagesAfter]);

  const images = imageViewerEntries.map((e) => e.displayUrl);
  const beforeCount = imagesBefore.length;
  const afterCount = imagesAfter.length;
  const selectedImageMeta = selectedImageIndex != null ? imageViewerEntries[selectedImageIndex]?.meta : null;

  const handleVerify = async () => {
    if (!userId) { alert('Please log in to verify pins.'); return; }
    if (authLoading) return;
    setVerifying(true);
    try {
      const config = await getAuthConfig({ 'Content-Type': 'application/json' });
      const response = await axios.post(`${API_BASE_URL}/api/pins/${pin._id}/verify`, {}, config);
      onPinUpdated?.(response.data);
      onUpdate?.();
    } catch (error) {
      console.error('Error verifying pin:', error);
      if (error.response?.data?.error) alert(error.response.data.error);
    } finally {
      setVerifying(false);
    }
  };

  const handleVote = async (voteType) => {
    if (!userId) { alert('Please log in to vote.'); return; }
    if (authLoading) return;
    try {
      const config = await getAuthConfig();
      await axios.post(`${API_BASE_URL}/api/votes`, { pinId: pin._id, voteType }, config);
      fetchVoteStatus();
      onUpdate();
    } catch (error) {
      console.error('Error voting:', error);
      if (error.response?.data?.error) alert(error.response.data.error);
    }
  };

  const handleResolve = async () => {
    if (!userId) { alert('Please log in.'); return; }
    if (authLoading) return;
    setResolving(true);
    try {
      const config = await getAuthConfig({ 'Content-Type': 'application/json' });
      const response = await axios.post(`${API_BASE_URL}/api/pins/${pin._id}/resolve`, {}, config);
      onPinUpdated?.(response.data);
      onUpdate?.();
    } catch (error) {
      console.error('Error resolving pin:', error);
      const msg = error.response?.data?.error || 'Failed to update resolve status.';
      alert(msg);
    } finally {
      setResolving(false);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (!userId) { alert('Please log in to comment.'); return; }
    if (authLoading) return;
    setLoading(true);
    try {
      const config = await getAuthConfig({ 'Content-Type': 'application/json' });
      await axios.post(`${API_BASE_URL}/api/comments`, { pinId: pin._id, author: displayName, text: newComment }, config);
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
    if (!userId) { alert('Please log in to reply.'); return; }
    if (authLoading) return;
    const parentId = replyingTo;
    setCommentActionLoading(parentId);
    try {
      const config = await getAuthConfig({ 'Content-Type': 'application/json' });
      await axios.post(`${API_BASE_URL}/api/comments`, { pinId: pin._id, author: displayName, text: replyText.trim(), parentId }, config);
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
    if (!userId) { alert('Please log in to like.'); return; }
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
    if (!userId) { alert('Please log in to dislike.'); return; }
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
      repliesMap[pid].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });
    return { topLevel, repliesMap };
  }, [comments]);

  const openImageModal = (index) => setSelectedImageIndex(index);
  const closeImageModal = () => setSelectedImageIndex(null);

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

  const touchDistance = (a, b) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

  const handleImageViewerTouchStart = (e) => {
    if (e.touches.length === 2) {
      imageViewerMouseDragRef.current = false;
      setImageViewerDragging(false);
      const d = touchDistance(e.touches[0], e.touches[1]);
      imageViewerPinchRef.current = { initialDist: d, initialScale: imageZoomRef.current };
      return;
    }
    if (e.touches.length === 1 && imageZoomRef.current > 1) {
      imageViewerLastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      imageViewerMouseDragRef.current = true;
      setImageViewerDragging(true);
    }
  };

  const handleImageViewerTouchMove = (e) => {
    if (e.touches.length === 2 && imageViewerPinchRef.current) {
      e.preventDefault();
      const { initialDist, initialScale } = imageViewerPinchRef.current;
      const d = touchDistance(e.touches[0], e.touches[1]);
      if (initialDist < 1) return;
      const next = Math.min(5, Math.max(1, initialScale * (d / initialDist)));
      setImageViewerZoom(next);
      return;
    }
    if (e.touches.length === 1 && imageViewerMouseDragRef.current && imageZoomRef.current > 1) {
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - imageViewerLastTouchRef.current.x;
      const dy = t.clientY - imageViewerLastTouchRef.current.y;
      imageViewerLastTouchRef.current = { x: t.clientX, y: t.clientY };
      setImageViewerPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  };

  const handleImageViewerTouchEnd = (e) => {
    if (e.touches.length < 2) imageViewerPinchRef.current = null;
    if (e.touches.length === 0) {
      imageViewerMouseDragRef.current = false;
      setImageViewerDragging(false);
    }
  };

  const handleImageViewerPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if (imageZoomRef.current <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    imageViewerMouseDragRef.current = true;
    setImageViewerDragging(true);
    imageViewerLastTouchRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleImageViewerPointerMove = (e) => {
    if (!imageViewerMouseDragRef.current || e.pointerType !== 'mouse') return;
    const dx = e.clientX - imageViewerLastTouchRef.current.x;
    const dy = e.clientY - imageViewerLastTouchRef.current.y;
    imageViewerLastTouchRef.current = { x: e.clientX, y: e.clientY };
    setImageViewerPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  const handleImageViewerPointerUp = (e) => {
    if (e.pointerType !== 'mouse') return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
    imageViewerMouseDragRef.current = false;
    setImageViewerDragging(false);
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
        await navigator.share({ title, text, url });
      } catch (err) {
        if (err.name !== 'AbortError') copyToClipboard(url);
      }
    } else {
      copyToClipboard(url);
    }
  };

  const handleSaveToggle = async () => {
    if (!userId) { alert('Please log in to save pins.'); return; }
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

  const handleAddPinImageClick = (type) => {
    if (type === 'before' && addBeforeInputRef.current) addBeforeInputRef.current.click();
    if (type === 'after' && addAfterInputRef.current) addAfterInputRef.current.click();
  };

  const handleAddPinImageFile = useCallback(async (e, type) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (e.target) e.target.value = '';
    const current = type === 'before' ? beforeCount : afterCount;
    if (current >= MAX_IMAGES_PER_SECTION) return;
    setAddingImageType(type);
    try {
      const file = files[0];
      const compressed = await compressImageWithPreset(file as File, 'pin');
      const uploadData = await uploadImageFile(compressed, {
        getAuthHeaders: async (extra) => (await getAuthConfig(extra)).headers,
        exifSourceFile: file as File
      });
      const url = uploadData?.url;
      if (!url) throw new Error('No URL returned');
      const imageEntry = pinImageFromUploadResponse(uploadData);
      const payloadConfig = await getAuthConfig({ 'Content-Type': 'application/json' });
      const response = await axios.post(
        `${API_BASE_URL}/api/pins/${pin._id}/images`,
        { type, imageEntry },
        payloadConfig
      );
      onPinUpdated?.(response.data);
      onUpdate?.();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to add image.';
      alert(msg);
    } finally {
      setAddingImageType(null);
    }
  }, [pin._id, beforeCount, afterCount, getToken, onPinUpdated, onUpdate]);

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
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  /** DD/MM/YY for image info (no time) */
  const formatImageMetaDateDDMMYY = (dateLike) => {
    if (!dateLike) return null;
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const handleImageViewerZoomIn = () => {
    setImageViewerZoom((prev) => Math.min(5, prev * 1.15));
  };

  const handleImageViewerZoomOut = () => {
    setImageViewerZoom((prev) => Math.max(1, prev / 1.15));
  };

  const formatImageMetaGps = (gps) => {
    if (!gps) return null;
    const lat = Number(gps.latitude);
    const lon = Number(gps.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }
    return `${gps.latitude}, ${gps.longitude}`;
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

  /* ─────────────── Render helper: Comment ─────────────── */
  const renderComment = (comment, isNested = false, parentAuthor?: string) => {
    const isReplyingThis = replyingTo === comment._id;
    const isLoading = commentActionLoading === comment._id;
    const avatarUrl = comment.authorImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author)}&background=e2e8f0&color=64748b`;

    return (
      <div className={`flex gap-3 ${isNested ? '' : ''}`}>
        <img alt="" className={`rounded-full shrink-0 bg-muted ${isNested ? 'size-6' : 'size-9'}`} src={avatarUrl} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
            <span className="text-[13px] font-semibold">{comment.author}</span>
            <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
          </div>
          {parentAuthor && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Undo2 size={12} />
              <span className="truncate">Replied to {parentAuthor}</span>
            </div>
          )}
          <p className="text-sm leading-relaxed break-words mb-1">{comment.text}</p>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" className={`h-7 px-2 gap-1 text-xs ${comment.userLiked ? 'text-primary' : 'text-muted-foreground'}`} onClick={() => handleCommentLike(comment._id)} disabled={!userId || isLoading}>
              <ThumbsUp className={`size-3.5 ${comment.userLiked ? 'fill-current' : ''}`} />
              {comment.likes > 0 && <span>{comment.likes}</span>}
            </Button>
            <Button variant="ghost" size="sm" className={`h-7 px-2 gap-1 text-xs ${comment.userDisliked ? 'text-destructive' : 'text-muted-foreground'}`} onClick={() => handleCommentDislike(comment._id)} disabled={!userId || isLoading}>
              <ThumbsDown className={`size-3.5 ${comment.userDisliked ? 'fill-current' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-semibold text-muted-foreground" onClick={() => setReplyingTo(isReplyingThis ? null : comment._id)} disabled={!userId}>
              Reply
            </Button>
          </div>
          {isReplyingThis && (
            <div className="flex gap-2 mt-2">
              <img alt="" className="size-6 rounded-full shrink-0" src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=ec4899&color=fff`} />
              <form className="flex-1 space-y-2" onSubmit={handleReplySubmit}>
                <Textarea placeholder={`Reply to ${comment.author}...`} value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={1} className="min-h-[36px] text-sm resize-none" autoFocus />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setReplyingTo(null); setReplyText(''); }}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={commentActionLoading === comment._id || !replyText.trim()}>Reply</Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[1100] flex p-1 md:p-4 ${isRepositioningPin ? 'items-end justify-center bg-transparent pointer-events-none pb-6' : 'items-center justify-center bg-black/60 backdrop-blur-sm'}`}
        style={{ animation: 'pinFadeIn 0.3s ease-out' }}
        onClick={isRepositioningPin ? undefined : onClose}
      >
        <div
          className={`relative flex w-full ${isRepositioningPin ? 'items-end justify-center max-w-[36rem] pointer-events-auto' : 'items-center justify-center md:flex-row gap-0 md:gap-3 max-w-[54rem]'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {isRepositioningPin ? (
            <Card className="w-full shadow-lg">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="size-5 text-primary shrink-0" />
                  Click on the map to drop the pin at the new location.
                </p>
                {onCancelReposition && (
                  <Button variant="outline" size="sm" onClick={onCancelReposition}>Cancel</Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {prevPin && (
                <Button
                  variant="outline"
                  size="icon"
                  className="hidden md:flex rounded-full h-11 w-11 shrink-0 shadow-md"
                  onClick={handlePrev}
                  aria-label="Previous pin"
                >
                  <ChevronLeft className="size-5" />
                </Button>
              )}

              {prevPin && (
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden absolute left-2 top-1/2 -translate-y-1/2 z-50 rounded-full h-10 w-10 shadow-lg bg-background"
                  onClick={handlePrev}
                  aria-label="Previous pin"
                >
                  <ChevronLeft className="size-5" />
                </Button>
              )}

              {/* Main Container */}
              <div
                className="relative w-full max-w-3xl max-h-[100vh] flex flex-col bg-background rounded-xl border shadow-2xl overflow-hidden"
                style={{ animation: 'pinSlideUp 0.4s ease-out', transform: 'scale(0.9)', transformOrigin: 'center center' }}
              >
                {/* Header */}
                <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex items-center justify-center size-10 rounded-lg bg-primary/10 border border-primary/20 shrink-0 [&>div]:flex [&>div]:items-center [&>div]:justify-center"
                      dangerouslySetInnerHTML={{ __html: getProblemTypeMarkerHtml(pin.problemType, 32) }}
                    />
                    <h2 className="text-base font-bold tracking-tight truncate">{pin.problemType}</h2>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {user && (
                      <Button
                        variant={isSaved ? "default" : "outline"}
                        size="sm"
                        onClick={handleSaveToggle}
                        disabled={saving}
                        className={`gap-1.5 ${isSaved ? 'bg-pink-600 hover:bg-pink-700 text-white' : ''}`}
                      >
                        <Bookmark className={`size-4 ${isSaved ? 'fill-current' : ''}`} />
                        <span className="hidden sm:inline">{saving ? '...' : isSaved ? 'Saved' : 'Save'}</span>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
                      <Share2 className="size-4" />
                      <span className="hidden sm:inline">{shareCopied ? 'Copied!' : 'Share'}</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 rounded-full text-muted-foreground" onClick={onClose} aria-label="Close">
                      <X className="size-4" />
                    </Button>
                  </div>
                </header>

                {/* Main Content */}
                <main className={`flex-1 overflow-y-auto px-5 space-y-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-track]:bg-transparent ${isEditing ? 'pt-0 pb-5' : 'py-5'}`}>
                  {isEditing ? (
                    <EditPinDetails
                      pin={pin}
                      onCancel={() => setIsEditing(false)}
                      onSaved={(updatedPin) => {
                        onPinUpdated?.(updatedPin);
                        onUpdate?.();
                        setIsEditing(false);
                      }}
                      onRequestRepositionPin={onRequestRepositionPin}
                      onCancelReposition={onCancelReposition}
                      isRepositioningPin={isRepositioningPin}
                      newLocationForEdit={newLocationForEdit}
                      onConsumeNewLocation={onConsumeNewLocation}
                    />
                  ) : (
                    <>
                      {/* ── Problem Heading ── */}
                      {pin.problemHeading && (
                        <Card className="border-l-4 border-l-primary">
                          <CardHeader className="pb-1">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <Flag className="size-4" />
                              Problem Heading
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-[15px] font-medium leading-relaxed">{pin.problemHeading}</p>
                          </CardContent>
                        </Card>
                      )}

                      {/* ── Description ── */}
                      {pin.description && (
                        <Card className="border-l-4 border-l-muted-foreground/30">
                          <CardHeader className="pb-1">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <Info className="size-4" />
                              Description
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{pin.description}</p>
                          </CardContent>
                        </Card>
                      )}

                      {/* ── Before Images ── */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <AlertTriangle className="size-4 text-rose-500" />
                              Before (before fix)
                            </CardTitle>
                            <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                              {beforeCount} attachments
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {imagesBefore.map((url, index) => (
                              <div key={`before-${index}`} className="aspect-square rounded-lg overflow-hidden cursor-pointer border bg-muted transition-all hover:ring-2 hover:ring-primary/50" onClick={() => openImageModal(index)}>
                                <img src={url} alt={`Before ${index + 1}`} className="size-full object-cover transition-transform hover:scale-110" />
                              </div>
                            ))}
                            {user && beforeCount < MAX_IMAGES_PER_SECTION && (
                              <div
                                role="button"
                                tabIndex={0}
                                className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors cursor-pointer hover:border-primary hover:text-primary ${addingImageType === 'before' ? 'opacity-50 pointer-events-none' : ''}`}
                                onClick={() => !addingImageType && handleAddPinImageClick('before')}
                                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !addingImageType && handleAddPinImageClick('before')}
                                aria-label="Add before image"
                              >
                                <ImagePlus className="size-6" />
                                <span className="text-xs font-medium">{addingImageType === 'before' ? 'Uploading…' : 'Add image'}</span>
                              </div>
                            )}
                          </div>
                          {beforeCount >= MAX_IMAGES_PER_SECTION && user && (
                            <p className="text-xs text-muted-foreground mt-2">Max {MAX_IMAGES_PER_SECTION} images.</p>
                          )}
                          <input ref={addBeforeInputRef} type="file" accept="image/*" className="sr-only" aria-hidden="true" onChange={(e) => handleAddPinImageFile(e, 'before')} />
                        </CardContent>
                      </Card>

                      {/* ── After Images ── */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <CheckCircle2 className="size-4 text-emerald-500" />
                              After (after fixing)
                            </CardTitle>
                            <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                              {afterCount} attachments
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {imagesAfter.map((url, index) => (
                              <div key={`after-${index}`} className="aspect-square rounded-lg overflow-hidden cursor-pointer border bg-muted transition-all hover:ring-2 hover:ring-emerald-500/50" onClick={() => openImageModal(beforeCount + index)}>
                                <img src={url} alt={`After ${index + 1}`} className="size-full object-cover transition-transform hover:scale-110" />
                              </div>
                            ))}
                            {user && afterCount < MAX_IMAGES_PER_SECTION && (
                              <div
                                role="button"
                                tabIndex={0}
                                className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors cursor-pointer hover:border-emerald-500 hover:text-emerald-500 ${addingImageType === 'after' ? 'opacity-50 pointer-events-none' : ''}`}
                                onClick={() => !addingImageType && handleAddPinImageClick('after')}
                                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !addingImageType && handleAddPinImageClick('after')}
                                aria-label="Add after image"
                              >
                                <ImagePlus className="size-6" />
                                <span className="text-xs font-medium">{addingImageType === 'after' ? 'Uploading…' : 'Add image'}</span>
                              </div>
                            )}
                          </div>
                          {afterCount >= MAX_IMAGES_PER_SECTION && user && (
                            <p className="text-xs text-muted-foreground mt-2">Max {MAX_IMAGES_PER_SECTION} images.</p>
                          )}
                          <input ref={addAfterInputRef} type="file" accept="image/*" className="sr-only" aria-hidden="true" onChange={(e) => handleAddPinImageFile(e, 'after')} />
                        </CardContent>
                      </Card>

                      {/* ── Stats Grid ── */}
                      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                        <Card>
                          <CardContent className="pt-4 pb-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Severity Score</p>
                            <div className="flex items-end gap-2">
                              <span className={`text-3xl font-black tabular-nums leading-none ${
                                getSeverityLabel(pin.severity) === 'CRITICAL' || getSeverityLabel(pin.severity) === 'HIGH' ? 'text-red-600 dark:text-red-400' :
                                getSeverityLabel(pin.severity) === 'MEDIUM' ? 'text-amber-500 dark:text-amber-400' :
                                getSeverityLabel(pin.severity) === 'LOW' ? 'text-slate-600 dark:text-slate-400' : 'text-emerald-600 dark:text-emerald-400'
                              }`}>{pin.severity}/10</span>
                              <Badge variant={getSeverityLabel(pin.severity) === 'CRITICAL' || getSeverityLabel(pin.severity) === 'HIGH' ? 'destructive' : 'secondary'} className="mb-0.5 text-[10px]">
                                {getSeverityLabel(pin.severity)}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="pt-4 pb-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Community Response</p>
                            <div className="flex gap-2">
                              <Button
                                variant={voteStatus.voteType === 'upvote' ? 'default' : 'outline'}
                                size="sm"
                                className={`gap-1.5 ${voteStatus.voteType === 'upvote' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                                onClick={() => handleVote('upvote')}
                              >
                                <ThumbsUp className={`size-4 ${voteStatus.voteType === 'upvote' ? 'fill-current' : ''}`} />
                                {voteStatus.upvotes}
                              </Button>
                              <Button
                                variant={voteStatus.voteType === 'downvote' ? 'default' : 'outline'}
                                size="sm"
                                className={`gap-1.5 ${voteStatus.voteType === 'downvote' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
                                onClick={() => handleVote('downvote')}
                              >
                                <ThumbsDown className={`size-4 ${voteStatus.voteType === 'downvote' ? 'fill-current' : ''}`} />
                                {voteStatus.downvotes}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="pt-4 pb-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Reported By</p>
                            <div className="flex items-center gap-2.5">
                              <img alt={`${reporterName} Avatar`} className="size-8 rounded-full border-2 border-background shadow-sm" src={reporterAvatar} />
                              <span className="text-sm font-bold truncate">{reporterName}</span>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="pt-4 pb-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Published</p>
                            <div className="flex items-center gap-2 text-sm font-bold">
                              <Calendar className="size-4 text-muted-foreground shrink-0" />
                              {formatDate(pin.createdAt)}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* ── Verification Status ── */}
                      {(() => {
                        const verifications = pin.pinVerification || [];
                        const vScore = getVerificationScore(verifications);
                        const vStatus = getVerificationStatus(vScore);
                        const roleCounts = getVerificationRoleCounts(verifications);
                        const hasVerified = verifications.some((v) => String(v.userId) === String(userId));
                        const maxScore = 180;
                        const progressPct = Math.min((vScore / maxScore) * 100, 100);
                        return (
                          <Card className="overflow-visible">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                  <ShieldCheck className="size-4" />
                                  Verification Status
                                </CardTitle>
                                <div className="group relative">
                                  <Info className="size-4 text-muted-foreground cursor-help transition-colors group-hover:text-primary" />
                                  <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all absolute right-0 bottom-full mb-2 w-max max-w-[18rem] p-3 bg-popover text-popover-foreground border rounded-lg shadow-lg text-xs z-50">
                                    <p className="font-semibold mb-1">Verification Levels</p>
                                    <div className="space-y-0.5 text-muted-foreground">
                                      <p>🔵 Highly Verified (Score ≥ 121)</p>
                                      <p>🟢 Verified (Score 81 – 120)</p>
                                      <p>🟡 Partially Verified (Score 41–80)</p>
                                      <p>🔴 Unverified (Score ≤ 40)</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-lg">{vStatus.emoji}</span>
                                <span className="text-sm font-bold" style={{ color: vStatus.color }}>{vStatus.label}</span>
                                <Badge variant="secondary" className="ml-auto text-[10px] tabular-nums">Score: {vScore}</Badge>
                              </div>
                              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: vStatus.color }} />
                              </div>
                              <div className="flex items-center gap-2 flex-wrap pt-1">
                                {user && (
                                  <Button variant={hasVerified ? 'default' : 'outline'} size="sm" className={`gap-1.5 ${hasVerified ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`} onClick={handleVerify} disabled={verifying}>
                                    <ShieldCheck className={`size-4 ${hasVerified ? 'fill-current' : ''}`} />
                                    {verifying ? '...' : hasVerified ? 'Verified ✓' : 'Verify'}
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setVerificationBreakdownExpanded((v) => !v)} aria-expanded={verificationBreakdownExpanded}>
                                  {verificationBreakdownExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                  {verificationBreakdownExpanded ? 'Hide' : 'Breakdown'}
                                </Button>
                              </div>
                              {verificationBreakdownExpanded && (
                                <div className="space-y-2 pt-2 border-t">
                                  <div className="grid grid-cols-2 gap-2">
                                    {(['user', 'reviewer', 'ngo', 'admin'] as const).map((role) => (
                                      <div key={role} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 text-xs">
                                        <span className="text-muted-foreground shrink-0">{VERIFICATION_ROLE_ICONS[role]}</span>
                                        <span className="font-semibold flex-1">{VERIFICATION_ROLE_LABELS[role]}</span>
                                        <span className="font-bold text-sm">{roleCounts[role]}</span>
                                        <span className="text-[10px] text-muted-foreground">({VERIFICATION_ROLE_SCORES[role]}pts)</span>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-xs font-semibold text-muted-foreground text-right">Total verifiers: {verifications.length}</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })()}

                      {/* ── Fix Status Timeline ── */}
                      <Card className="fix-status-card border">
                        <CardHeader className="pb-2">
                          <CardTitle className="fix-status-title text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                            <Clock className="size-4 text-blue-400 dark:text-blue-300" />
                            Fix Status
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {(() => {
                            const vScore = getVerificationScore(pin.pinVerification);
                            const isVerified = vScore > 80;
                            const isScheduled = scheduledEvents.length > 0;
                            const resolves = pin.resolveVerification || [];
                            const resolveScore = resolves.reduce((s, v) => s + (VERIFICATION_ROLE_SCORES[v.role] || 10), 0);
                            const isResolved = resolveScore > 80;
                            const fmtDate = (d) => {
                              if (!d) return '';
                              const dt = new Date(d);
                              return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' - ' + dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                            };
                            const nextEventDate = scheduledEvents.length > 0
                              ? scheduledEvents.reduce((earliest, ev) => { const d = new Date(ev.date); return d < earliest ? d : earliest; }, new Date(scheduledEvents[0].date))
                              : null;
                            const steps = [
                              { key: 'reported', label: 'Reported', icon: <Flag size={16} />, active: true, date: fmtDate(pin.createdAt) },
                              { key: 'verified', label: 'Verified', icon: <ShieldCheck size={16} />, active: isVerified, date: isVerified && pin.fixStatus?.verifiedAt ? fmtDate(pin.fixStatus.verifiedAt) : (isVerified ? 'Score > 80' : 'Score ≤ 80') },
                              { key: 'awaiting', label: 'Awaiting Action', icon: <Clock size={16} />, active: isVerified, date: '' },
                              { key: 'scheduled', label: 'Scheduled', icon: <CalendarDays size={16} />, active: isScheduled, date: nextEventDate ? `Estimated: ${nextEventDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : '' },
                              { key: 'resolved', label: 'Resolved', icon: <CheckCircle2 size={16} />, active: isResolved, date: isResolved && pin.fixStatus?.resolvedAt ? fmtDate(pin.fixStatus.resolvedAt) : (resolveScore > 0 ? `Score: ${resolveScore}/81` : '') }
                            ];
                            return (
                              <div className="flex flex-col">
                                {steps.map((step, i) => (
                                  <div key={step.key} className="flex items-start gap-3 relative min-h-[3.25rem] last:min-h-0">
                                    {i > 0 && (
                                      <div className={`absolute left-[17px] -top-1 w-0.5 h-4 rounded-full transition-colors ${steps[i - 1].active && step.active ? 'fix-status-connector-active bg-blue-500 dark:bg-blue-400' : 'fix-status-connector-inactive bg-slate-200 dark:bg-slate-700'}`} />
                                    )}
                                    <div className={`shrink-0 size-9 rounded-full flex items-center justify-center border-2 z-[1] transition-all ${step.active ? 'fix-status-circle-active bg-blue-500/15 dark:bg-blue-400/20 border-blue-500 dark:border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.35)]' : 'fix-status-circle-inactive bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'}`}>
                                      <span className={step.active ? 'fix-status-step-active-icon text-blue-500 dark:text-blue-400' : 'fix-status-step-inactive-icon text-slate-400 dark:text-slate-500'}>{step.icon}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5 pt-1.5">
                                      <span className={`text-sm font-bold transition-colors ${step.active ? 'fix-status-step-label-active text-slate-800 dark:text-slate-100' : 'fix-status-step-label-inactive text-slate-400 dark:text-slate-500'}`}>{step.label}</span>
                                      {step.date && <span className={`text-xs transition-colors ${step.active ? 'fix-status-step-date-active text-slate-500 dark:text-slate-400' : 'fix-status-step-date-inactive text-slate-300 dark:text-slate-600'}`}>{step.date}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </CardContent>
                      </Card>

                      {/* ── Mark as Resolved ── */}
                      <Card className="overflow-visible">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <CheckCircle2 className="size-4 text-emerald-500" />
                              Mark as Resolved
                            </CardTitle>
                            <div className="group relative">
                              <Info className="size-4 text-muted-foreground cursor-help transition-colors group-hover:text-primary" />
                              <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all absolute right-0 bottom-full mb-2 w-max max-w-[16rem] p-3 bg-popover text-popover-foreground border rounded-lg shadow-lg text-xs z-50">
                                <div className="space-y-0.5 text-muted-foreground">
                                  <p>✅ Resolved (Score &gt; 80)</p>
                                  <p>⏳ Not resolved (Score ≤ 80)</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {(() => {
                            const resolves = pin.resolveVerification || [];
                            const resolveScore = resolves.reduce((s, v) => s + (VERIFICATION_ROLE_SCORES[v.role] || 10), 0);
                            const isResolved = resolveScore > 80;
                            const hasVotedResolve = resolves.some((v) => String(v.userId) === String(userId));
                            const resolveRoleCounts = { user: 0, reviewer: 0, ngo: 0, admin: 0 };
                            resolves.forEach((v) => { resolveRoleCounts[v.role] = (resolveRoleCounts[v.role] || 0) + 1; });
                            const maxScore = 180;
                            const progressPct = Math.min((resolveScore / maxScore) * 100, 100);
                            const resolveStatus = isResolved ? { label: 'Resolved', emoji: '✅', color: '#10b981' } : { label: 'Not resolved', emoji: '⏳', color: '#94a3b8' };
                            return (
                              <>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-lg">{resolveStatus.emoji}</span>
                                  <span className="text-sm font-bold" style={{ color: resolveStatus.color }}>{resolveStatus.label}</span>
                                  <Badge variant="secondary" className="ml-auto text-[10px] tabular-nums">Score: {resolveScore}</Badge>
                                </div>
                                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: resolveStatus.color }} />
                                </div>
                                <div className="flex items-center gap-2 flex-wrap pt-1">
                                  {user && (
                                    <Button variant={hasVotedResolve ? 'default' : 'outline'} size="sm" className={`gap-1.5 ${hasVotedResolve ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`} onClick={handleResolve} disabled={resolving}>
                                      {hasVotedResolve ? <Undo2 className="size-4" /> : <CheckCircle2 className="size-4" />}
                                      {resolving ? '...' : hasVotedResolve ? 'Voted ✓' : 'Vote Resolved'}
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setResolveBreakdownExpanded((v) => !v)} aria-expanded={resolveBreakdownExpanded}>
                                    {resolveBreakdownExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                    {resolveBreakdownExpanded ? 'Hide' : 'Breakdown'}
                                  </Button>
                                </div>
                                {resolveBreakdownExpanded && (
                                  <div className="space-y-2 pt-2 border-t">
                                    <div className="grid grid-cols-2 gap-2">
                                      {(['user', 'reviewer', 'ngo', 'admin'] as const).map((role) => (
                                        <div key={role} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 text-xs">
                                          <span className="text-muted-foreground shrink-0">{VERIFICATION_ROLE_ICONS[role]}</span>
                                          <span className="font-semibold flex-1">{VERIFICATION_ROLE_LABELS[role]}</span>
                                          <span className="font-bold text-sm">{resolveRoleCounts[role]}</span>
                                          <span className="text-[10px] text-muted-foreground">({VERIFICATION_ROLE_SCORES[role]}pts)</span>
                                        </div>
                                      ))}
                                    </div>
                                    <p className="text-xs font-semibold text-muted-foreground text-right">Total resolvers: {resolves.length}</p>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </CardContent>
                      </Card>

                      {/* ── Precise Location ── */}
                      {(pin.location?.address || (pin.location?.latitude != null && pin.location?.longitude != null)) && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <MapPin className="size-4 text-rose-500" />
                              Precise Location
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {pin.location?.address && (
                              <p className="text-sm font-medium">{pin.location.address}</p>
                            )}
                            {pin.location?.latitude != null && pin.location?.longitude != null && (
                              <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                                <span>LAT: {pin.location.latitude.toFixed(5)}° N</span>
                                <span>LONG: {pin.location.longitude.toFixed(5)}° E</span>
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {pin.location?.address && (
                                <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => {
                                  let text = `Location: ${pin.location.address || '—'}`;
                                  if (pin.location.latitude != null && pin.location.longitude != null) {
                                    text += `\nLatitude: ${pin.location.latitude.toFixed(5)} & Longitude: ${pin.location.longitude.toFixed(5)}`;
                                  }
                                  copyLocationToClipboard(text, 'location');
                                }}>
                                  {copiedLocation === 'location' ? <Check className="size-4" /> : <Copy className="size-4" />}
                                  {copiedLocation === 'location' ? 'Copied!' : 'Copy'}
                                </Button>
                              )}
                              {onViewOnMap && pin.location?.latitude != null && pin.location?.longitude != null && (
                                <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => onViewOnMap(pin)}>
                                  <Map className="size-4" />
                                  View on map
                                </Button>
                              )}
                              {pin.location?.latitude != null && pin.location?.longitude != null && (
                                <Button asChild variant="outline" size="sm" className="gap-1.5 h-8 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-600 dark:hover:bg-blue-500/20">
                                  <a href={`https://www.google.com/maps?q=${pin.location.latitude},${pin.location.longitude}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="size-4" />
                                    Google Maps
                                  </a>
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* ── Edit / Delete Buttons ── */}
                      {(user?.role === 'admin' || pin.contributor_id === user?.id || pin.reportedByMe) && (
                        <div className="flex gap-3">
                          <Button variant="outline" className="flex-1 gap-1.5" onClick={() => setIsEditing(true)}>
                            <Edit3 className="size-4" />
                            <span className="hidden sm:inline">Edit this Pin</span>
                          </Button>
                          <Button variant="destructive" className="flex-1 gap-1.5" onClick={handleDelete} disabled={deleting}>
                            <Trash2 className="size-4" />
                            <span className="hidden sm:inline">{deleting ? 'Deleting…' : 'Delete this Pin'}</span>
                          </Button>
                        </div>
                      )}

                      {/* ── Scheduled Events ── */}
                      {(eventsLoading || scheduledEvents.length > 0) && (
                        <Card className="border-l-4 border-l-indigo-500">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <CalendarDays className="size-4 text-indigo-500" />
                              Scheduled Events
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {eventsLoading ? (
                              <p className="text-sm text-muted-foreground">Loading events...</p>
                            ) : (
                              <div className="space-y-3">
                                {scheduledEvents.map((ev) => (
                                  <div key={ev._id} className="pb-3 border-b last:border-0 last:pb-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <span className="text-xs font-semibold">{formatEventDate(ev.date)}</span>
                                      {(ev.startTime || ev.endTime || ev.durationHours) && (
                                        <span className="text-xs text-muted-foreground">{formatEventTime(ev.startTime, ev.endTime, ev.durationHours)}</span>
                                      )}
                                    </div>
                                    <p className="text-sm font-semibold mb-1.5">{ev.title}</p>
                                    <Link to={`/events/${ev._id}`} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline" onClick={() => onClose()}>
                                      View full event details
                                    </Link>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* ── Comments ── */}
                      <div ref={commentsSectionRef} id="pin-details-comments-section" className="pt-2 scroll-mt-4">
                        <Separator className="mb-5" />
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-4">
                          <MessageSquare className="size-4" />
                          {comments.length} Comments
                        </h3>

                        <div className="space-y-5">
                          {comments.length === 0 ? (
                            <Card className="bg-muted/50 border-dashed">
                              <CardContent className="py-6 text-center">
                                <p className="text-sm text-muted-foreground italic">No comments yet. Be the first to comment!</p>
                              </CardContent>
                            </Card>
                          ) : (
                            commentTree.topLevel.map((comment) => {
                              const replies = commentTree.repliesMap[comment._id] || [];
                              const isExpanded = expandedReplies.has(comment._id);
                              const toggleReplies = () =>
                                setExpandedReplies((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(comment._id)) next.delete(comment._id);
                                  else next.add(comment._id);
                                  return next;
                                });

                              return (
                                <div key={comment._id} className="space-y-0">
                                  {renderComment(comment)}

                                  {replies.length > 0 && (
                                    <div className="ml-12 mt-1 pl-4 border-l-2 border-border/50 hover:border-primary/30 transition-colors">
                                      <Button variant="ghost" size="sm" className="gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 h-7 px-2 mb-1" onClick={toggleReplies}>
                                        {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                                        {isExpanded ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                                      </Button>

                                      {isExpanded && (
                                        <div className="space-y-3 pt-1">
                                          {replies.map((reply) => {
                                            const replyReplies = commentTree.repliesMap[reply._id] || [];
                                            const flatDeepReplies = replyReplies.flatMap((nr) =>
                                              flattenDeepReplies(nr._id, nr.text, commentTree.repliesMap)
                                            );

                                            return (
                                              <div key={reply._id} className="space-y-0">
                                                {renderComment(reply, true)}

                                                {(replyReplies.length > 0 || flatDeepReplies.length > 0) && (
                                                  <div className="ml-8 mt-2 pl-3 border-l-2 border-border/30 hover:border-muted-foreground/30 transition-colors space-y-3">
                                                    {replyReplies.map((nestedReply) => (
                                                      <div key={nestedReply._id}>{renderComment(nestedReply, true)}</div>
                                                    ))}
                                                    {flatDeepReplies.map((deepReply) => (
                                                      <div key={deepReply._id}>{renderComment(deepReply, true, deepReply.replyingToText ? truncateReplyText(deepReply.replyingToText, 40) : undefined)}</div>
                                                    ))}
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
                      </div>

                      {/* ── Comment Form Footer ── */}
                      <div className="pt-4 border-t">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                          Posting as <span className="text-primary">{displayName}</span>
                        </p>
                        <form onSubmit={handleCommentSubmit} className="space-y-3 pb-2">
                          <Textarea
                            ref={newCommentTextareaRef}
                            placeholder="Add a comment..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            rows={2}
                            className="resize-none"
                          />
                          <div className="flex justify-end">
                            <Button type="submit" disabled={loading || !newComment.trim()} className="gap-1.5">
                              <Send className="size-4" />
                              Post Note
                            </Button>
                          </div>
                        </form>
                      </div>
                    </>
                  )}
                </main>
              </div>

              {nextPin && (
                <Button
                  variant="outline"
                  size="icon"
                  className="hidden md:flex rounded-full h-11 w-11 shrink-0 shadow-md"
                  onClick={handleNext}
                  aria-label="Next pin"
                >
                  <ChevronRight className="size-5" />
                </Button>
              )}

              {nextPin && (
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 z-50 rounded-full h-10 w-10 shadow-lg bg-background"
                  onClick={handleNext}
                  aria-label="Next pin"
                >
                  <ChevronRight className="size-5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Image Modal ── */}
      <div
        ref={imageModalRef}
        className={`fixed inset-0 z-[2000] bg-black/90 ${selectedImageIndex != null ? 'block' : 'hidden'}`}
        style={{ animation: 'pinFadeIn 0.2s' }}
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
        {/* Full-screen zoom/pan region (same bounds as this overlay) */}
        <div
          ref={imageViewerViewportRef}
          className={`absolute inset-0 z-0 flex touch-none select-none items-center justify-center overflow-hidden ${imageViewerZoom > 1 ? (imageViewerDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleImageViewerTouchStart}
          onTouchMove={handleImageViewerTouchMove}
          onTouchEnd={handleImageViewerTouchEnd}
          onTouchCancel={handleImageViewerTouchEnd}
          onPointerDown={handleImageViewerPointerDown}
          onPointerMove={handleImageViewerPointerMove}
          onPointerUp={handleImageViewerPointerUp}
          onPointerCancel={handleImageViewerPointerUp}
          role="presentation"
        >
          <div
            className="flex max-h-full max-w-full items-center justify-center will-change-transform"
            style={{
              transform: `translate(${imageViewerPan.x}px, ${imageViewerPan.y}px) scale(${imageViewerZoom})`,
              transformOrigin: 'center center',
            }}
          >
            {images.map((img, idx) => (
              <img
                key={`modal-${idx}`}
                draggable={false}
                className={`max-h-[100dvh] max-w-[100vw] object-contain rounded-xl shadow-2xl ${idx === selectedImageIndex ? 'block' : 'hidden'}`}
                src={img}
                alt={`Full view ${idx + 1}`}
              />
            ))}
          </div>
        </div>
        <button type="button" className="absolute top-6 right-6 z-20 bg-white/20 backdrop-blur-sm text-white p-2 rounded-full hover:bg-white/30 transition-colors" onClick={closeImageModal}>
          <X className="size-6" />
        </button>
        {selectedImageIndex != null && (
          <div
            className="absolute z-30 flex flex-col gap-1.5 right-4 bottom-24 sm:right-6 sm:bottom-28 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Zoom in"
              disabled={imageViewerZoom >= 5}
              className="flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white p-2 hover:bg-white/30 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleImageViewerZoomIn}
            >
              <ZoomIn className="size-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              disabled={imageViewerZoom <= 1}
              className="flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white p-2 hover:bg-white/30 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleImageViewerZoomOut}
            >
              <ZoomOut className="size-4" strokeWidth={2} />
            </button>
          </div>
        )}
        {images.length > 1 && (
          <>
            <button type="button" className="absolute left-6 top-1/2 z-20 -translate-y-1/2 bg-white/20 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 transition-colors" onClick={goToPrevImage} aria-label="Previous image">
              <ChevronLeft className="size-8" />
            </button>
            <button type="button" className="absolute right-6 top-1/2 z-20 -translate-y-1/2 bg-white/20 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 transition-colors" onClick={goToNextImage} aria-label="Next image">
              <ChevronRight className="size-8" />
            </button>
          </>
        )}
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 max-w-[min(92vw,28rem)] -translate-x-1/2 rounded-2xl bg-black/50 px-3 py-2 text-center text-sm font-medium text-white">
          {selectedImageIndex != null && (
            <>
              <span className="block">
                {selectedImageIndex < beforeCount
                  ? `Before ${selectedImageIndex + 1} / ${beforeCount}`
                  : `After ${selectedImageIndex - beforeCount + 1} / ${afterCount}`}
              </span>
              {selectedImageMeta && (
                <span className="mt-2 block border-t border-white/15 pt-2 text-left text-[11px] font-normal leading-snug text-white/80">
                  {formatImageMetaDateDDMMYY(selectedImageMeta.imageCreatedAt) && (
                    <span className="block">
                      Photo taken: {formatImageMetaDateDDMMYY(selectedImageMeta.imageCreatedAt)}
                    </span>
                  )}
                  {formatImageMetaDateDDMMYY(selectedImageMeta.uploadedAt) && (
                    <span className="block">
                      Uploaded: {formatImageMetaDateDDMMYY(selectedImageMeta.uploadedAt)}
                    </span>
                  )}
                  {selectedImageMeta.gps && (
                    <span className="block">
                      Photo GPS: {formatImageMetaGps(selectedImageMeta.gps)}
                    </span>
                  )}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default PinDetails;
