import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaThumbsUp, FaThumbsDown, FaComment, FaShareAlt } from 'react-icons/fa';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { getProblemTypeMarkerHtml } from '../utils/problemTypeIcons';
import './PinDetails.css';

const PinDetails = ({ pin, onClose, userId, onUpdate, shareUrl }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [voteStatus, setVoteStatus] = useState({ hasVoted: false, voteType: null, upvotes: pin.upvotes, downvotes: pin.downvotes });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    fetchComments();
    fetchVoteStatus();
    fetchImages();
  }, [pin._id, userId]);

  const fetchComments = async () => {
    try {
      const response = await axios.get(`/api/comments/pin/${pin._id}`);
      setComments(response.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchVoteStatus = async () => {
    try {
      const deviceFingerprint = getDeviceFingerprint();
      const response = await axios.get(`/api/votes/${pin._id}/${userId}`, {
        params: { deviceFingerprint }
      });
      setVoteStatus(response.data);
    } catch (error) {
      console.error('Error fetching vote status:', error);
    }
  };

  const fetchImages = () => {
    if (pin.images && pin.images.length > 0) {
      // New pins: images are Cloudinary URLs; legacy pins: GridFS IDs → /api/images/:id
      const urls = pin.images.map(entry =>
        entry.startsWith('http') ? entry : `/api/images/${entry}`
      );
      setImages(urls);
    }
  };

  const handleVote = async (voteType) => {
    try {
      const deviceFingerprint = getDeviceFingerprint();
      await axios.post('/api/votes', {
        pinId: pin._id,
        userId,
        voteType,
        deviceFingerprint
      });
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

    setLoading(true);
    try {
      await axios.post('/api/comments', {
        pinId: pin._id,
        author: commentAuthor || 'Anonymous',
        text: newComment
      });
      setNewComment('');
      setCommentAuthor('');
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
                  {pin.name && <span> • Reported by: {pin.name}</span>}
                </p>
              </div>
            </div>
            <div className="pin-details-header-actions">
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
              <input
                type="text"
                placeholder="Your name (optional)"
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                className="comment-author-input"
              />
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
