import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaThumbsUp, FaThumbsDown, FaComment } from 'react-icons/fa';
import './PinDetails.css';

const PinDetails = ({ pin, onClose, userId, onUpdate }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [voteStatus, setVoteStatus] = useState({ hasVoted: false, voteType: null, upvotes: pin.upvotes, downvotes: pin.downvotes });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

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
      const response = await axios.get(`/api/votes/${pin._id}/${userId}`);
      setVoteStatus(response.data);
    } catch (error) {
      console.error('Error fetching vote status:', error);
    }
  };

  const fetchImages = async () => {
    if (pin.images && pin.images.length > 0) {
      const imageUrls = pin.images.map(id => `/api/images/${id}`);
      setImages(imageUrls);
    }
  };

  const handleVote = async (voteType) => {
    try {
      await axios.post('/api/votes', {
        pinId: pin._id,
        userId,
        voteType
      });
      fetchVoteStatus();
      onUpdate();
    } catch (error) {
      console.error('Error voting:', error);
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

  const getProblemIconColor = (problemType) => {
    const colors = {
      'Trash Pile': '#ff6b6b',
      'Pothole': '#4ecdc4',
      'Broken Pipe': '#45b7d1',
      'Fuse Street Light': '#f9ca24',
      'Other': '#95a5a6'
    };
    return colors[problemType] || colors['Other'];
  };

  return (
    <div className="pin-details-overlay" onClick={onClose}>
      <div className="pin-details-container" onClick={(e) => e.stopPropagation()}>
        <div className="pin-details-header" style={{ borderLeft: `5px solid ${getProblemIconColor(pin.problemType)}` }}>
          <div>
            <h2>{pin.problemType}</h2>
            <p className="pin-meta">
              Severity: <span className="severity-badge">{pin.severity}/10</span>
              {pin.name && <span> • Reported by: {pin.name}</span>}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
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
                  <img key={index} src={url} alt={`Problem ${index + 1}`} />
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
                    <div className="comment-header">
                      <strong>{comment.author}</strong>
                      <span className="comment-date">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="comment-text">{comment.text}</p>
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
  );
};

export default PinDetails;
