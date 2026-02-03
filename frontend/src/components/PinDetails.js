import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { FaThumbsUp, FaThumbsDown, FaComment, FaShareAlt, FaBookmark, FaRegBookmark } from 'react-icons/fa';
import { API_BASE_URL } from '../config';
import { getProblemTypeMarkerHtml } from '../utils/problemTypeIcons';
import { getFullImageUrl } from '../utils/cloudinaryUrls';
import './PinDetails.css';

const PinDetails = ({ pin, onClose, user, onUpdate, shareUrl, isSaved, onSave, onUnsave }) => {
  const { isLoaded: authLoaded, getToken } = useAuth();
  const userId = user?.id ?? null;
  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Anonymous';
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [voteStatus, setVoteStatus] = useState({ hasVoted: false, voteType: null, upvotes: pin.upvotes, downvotes: pin.downvotes });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoaded) return;
    fetchComments();
    fetchVoteStatus();
    fetchImages();
  }, [authLoaded, getToken, pin._id, userId]);
  useEffect(() => {
    setVoteStatus((prev) => ({ ...prev, upvotes: pin.upvotes, downvotes: pin.downvotes }));
  }, [pin.upvotes, pin.downvotes]);

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
    if (!authLoaded) return;
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
    if (!authLoaded) return;
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
      // New pins: Cloudinary base URLs → apply full-size transformation; legacy: GridFS IDs → /api/images/:id
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
    if (!authLoaded) return;
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
    if (!authLoaded) return;

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

  const openImageModal = (imageSrc) => {
    setSelectedImage(imageSrc);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const handleShare = async () => {
    const url = shareUrl || `${window.location.origin}/pin/${pin._id}`;
    const title = `Pin-It: ${pin.problemType}`;
    const text = pin.description
      ? `${pin.problemType} - ${pin.description.substring(0, 100)}${pin.description.length > 100 ? '...' : ''}`
      : pin.problemType;

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
    if (!authLoaded) return;
    setSaving(true);
    try {
      const config = await getAuthConfig();
      if (isSaved) {
        await axios.delete(`${API_BASE_URL}/api/pins/${pin._id}/save`, config);
        onUnsave?.(pin);
      } else {
        await axios.post(`${API_BASE_URL}/api/pins/${pin._id}/save`, {}, config);
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

  return (
    <>
      <div className="pin-details-overlay" onClick={onClose}>
        <div className="pin-details-container" onClick={(e) => e.stopPropagation()}>
          <div className="pin-details-header">
            <div className="pin-details-header-content">
              <div
                className="pin-type-icon-detail"
                dangerouslySetInnerHTML={{ __html: getProblemTypeMarkerHtml(pin.problemType, 40) }}
              />
              <div>
                <h2>{pin.problemType}</h2>
                <p className="pin-meta">
                  Severity: <span className="severity-badge">{pin.severity}/10</span>
                  {(pin.contributor_name || pin.name) && <span> • Reported by: {pin.contributor_name || pin.name}</span>}
                  {user && (
                    <span className={`saved-badge ${isSaved ? 'saved' : ''}`}>
                      {isSaved ? <FaBookmark /> : <FaRegBookmark />}
                      {isSaved ? ' Saved' : ' Not saved'}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="pin-details-header-actions">
              {user && (
                <button
                  type="button"
                  className={`save-pin-btn ${isSaved ? 'saved' : ''}`}
                  onClick={handleSaveToggle}
                  disabled={saving}
                  title={isSaved ? 'Unsave this pin' : 'Save this pin'}
                >
                  {isSaved ? <FaBookmark /> : <FaRegBookmark />}
                  {saving ? '...' : isSaved ? 'Saved' : 'Save'}
                </button>
              )}
              <button
                type="button"
                className={`share-btn ${shareCopied ? 'copied' : ''}`}
                onClick={handleShare}
                title="Share this pin"
              >
                <FaShareAlt /> {shareCopied ? 'Copied!' : 'Share'}
              </button>
              <button className="close-btn" onClick={onClose}>×</button>
            </div>
          </div>

        <div className="pin-details-content">
          {pin.description && (
            <div className="pin-description">
              <h3>Description</h3>
              <p>{pin.description}</p>
            </div>
          )}

          {pin.location.address && (
            <div className="pin-location">
              <h3>Location</h3>
              <p>{pin.location.address}</p>
            </div>
          )}

          {images.length > 0 && (
            <div className="pin-images">
              <h3>Images</h3>
              <div className="images-grid">
                {images.map((url, index) => (
                  <img 
                    key={index} 
                    src={url} 
                    alt={`Problem ${index + 1}`}
                    onClick={() => openImageModal(url)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="pin-votes">
            <button
              className={`vote-btn upvote ${voteStatus.voteType === 'upvote' ? 'active' : ''}`}
              onClick={() => handleVote('upvote')}
            >
              <FaThumbsUp /> {voteStatus.upvotes}
            </button>
            <button
              className={`vote-btn downvote ${voteStatus.voteType === 'downvote' ? 'active' : ''}`}
              onClick={() => handleVote('downvote')}
            >
              <FaThumbsDown /> {voteStatus.downvotes}
            </button>
          </div>

          <div className="pin-comments">
            <h3>
              <FaComment /> Comments ({comments.length})
            </h3>

            <div className="comments-list">
              {comments.length === 0 ? (
                <p className="no-comments">No comments yet. Be the first to comment!</p>
              ) : (
                comments.map(comment => (
                  <div key={comment._id} className="comment-item">
                    <div className="comment-author">{comment.author}</div>
                    <div className="comment-text">{comment.text}</div>
                    <div className="comment-date">
                      {formatDate(comment.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleCommentSubmit} className="comment-form">
              {user && (
                <div className="comment-author-display">Posting as <strong>{displayName}</strong></div>
              )}
              <div className="comment-input-group">
                <textarea
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows="3"
                  className="comment-text-input"
                />
                <button type="submit" disabled={loading || !newComment.trim()} className="comment-submit-btn">
                  {loading ? 'Posting...' : 'Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      </div>

      {/* Image Modal */}
      <div 
        className={`image-modal ${selectedImage ? 'active' : ''}`}
        onClick={closeImageModal}
      >
        <button className="image-modal-close" onClick={closeImageModal}>×</button>
        {selectedImage && (
          <img 
            src={selectedImage} 
            alt="Full size" 
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </>
  );
};

export default PinDetails;
