import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import { getProblemTypeMarkerHtml } from '../utils/problemTypeIcons';
import { getFullImageUrl } from '../utils/cloudinaryUrls';
import './PinDetails.css';

const PinDetails = ({ pin, onClose, user, onUpdate, shareUrl, isSaved, onSave, onUnsave }) => {
  const { loading: authLoading, getToken } = useAuth();
  const userId = user?.id ?? null;
  const displayName = user?.fullName || user?.email || 'Anonymous';
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [voteStatus, setVoteStatus] = useState({ hasVoted: false, voteType: null, upvotes: pin.upvotes, downvotes: pin.downvotes });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const imageModalRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    fetchComments();
    fetchVoteStatus();
    fetchImages();
  }, [authLoading, getToken, pin._id, userId]);
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

  return (
    <>
      <div className="pin-details-overlay" onClick={onClose}>
        <div className="pin-details-container" onClick={(e) => e.stopPropagation()}>
          <header className="pin-details-header">
            <div className="pin-details-header-content">
              <div
                className="pin-type-icon-detail"
                dangerouslySetInnerHTML={{ __html: getProblemTypeMarkerHtml(pin.problemType, 40) }}
              />
              <div>
                <div className="pin-details-title-row">
                  <h2 className="pin-details-title">{pin.problemType}</h2>
                  <span className="pin-details-badge">Report</span>
                </div>
                <p className="pin-details-meta">
                  Published {formatDate(pin.createdAt)} • Community Report
                </p>
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
                  {saving ? '...' : isSaved ? 'Saved' : 'Save'}
                </button>
              )}
              <button
                type="button"
                className="pin-details-btn pin-details-btn-secondary"
                onClick={handleShare}
                title="Share this pin"
              >
                <span className="material-icons-round">share</span>
                {shareCopied ? 'Copied!' : 'Share'}
              </button>
              <button className="pin-details-close" onClick={onClose} aria-label="Close">
                <span className="material-icons-round">close</span>
              </button>
            </div>
          </header>

          <main className="pin-details-main">
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
            </div>

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

            {pin.location?.address && (
              <section className="pin-details-section">
                <h3 className="pin-details-section-title">
                  <span className="material-icons-round">pin_drop</span>
                  Precise Location
                </h3>
                <div className="pin-details-location">
                  <p className="location-address">{pin.location.address}</p>
                  {pin.location.latitude != null && pin.location.longitude != null && (
                    <div className="location-coords">
                      <span>LAT: {pin.location.latitude.toFixed(4)}° N</span>
                      <span>LONG: {pin.location.longitude.toFixed(4)}° E</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="pin-details-section pin-details-comments-section">
              <h3 className="pin-details-section-title">
                <span className="material-icons-round">forum</span>
                Comments ({comments.length})
              </h3>
              <div className="pin-details-comments-list">
                {comments.length === 0 ? (
                  <p className="pin-details-no-comments">No comments yet. Be the first to comment!</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment._id} className="pin-details-comment">
                      <img
                        alt=""
                        className="comment-avatar"
                        src={comment.authorImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author)}&background=e2e8f0&color=64748b`}
                      />
                      <div className="comment-body">
                        <div className="comment-header">
                          <span className="comment-author">{comment.author}</span>
                          <span className="comment-date">{formatDate(comment.createdAt)}</span>
                        </div>
                        <p className="comment-text">{comment.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </main>

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
