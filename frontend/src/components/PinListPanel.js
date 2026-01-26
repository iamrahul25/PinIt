import React, { useState, useEffect } from 'react';
import { FaMapMarkerAlt, FaThumbsUp, FaThumbsDown, FaComment, FaChevronRight, FaChevronLeft } from 'react-icons/fa';
import './PinListPanel.css';

const PinListPanel = ({ pins, onPinClick, isOpen, onToggle }) => {
  const [displayedPins, setDisplayedPins] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pinsPerPage = 10;

  useEffect(() => {
    // Reset to first page when pins change or panel opens
    setCurrentPage(1);
    const startIndex = 0;
    const endIndex = 1 * pinsPerPage;
    const newPins = pins.slice(startIndex, endIndex);
    setDisplayedPins(newPins);
  }, [pins, isOpen]);

  const handleLoadMore = () => {
    const nextPage = currentPage + 1;
    const startIndex = 0;
    const endIndex = nextPage * pinsPerPage;
    const newPins = pins.slice(startIndex, endIndex);
    setDisplayedPins(newPins);
    setCurrentPage(nextPage);
  };

  const hasMorePins = displayedPins.length < pins.length;

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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      {/* Toggle Button */}
      <button 
        className={`panel-toggle-btn ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        title={isOpen ? 'Hide Pin List' : 'Show Pin List'}
      >
        {isOpen ? <FaChevronRight /> : <FaChevronLeft />}
      </button>

      {/* Side Panel */}
      <div className={`pin-list-panel ${isOpen ? 'open' : ''}`}>
        <div className="panel-header">
          <h2>Pins ({pins.length})</h2>
          <button className="close-panel-btn" onClick={onToggle}>×</button>
        </div>

        <div className="panel-content">
          {pins.length === 0 ? (
            <div className="no-pins-message">
              <p>No pins available</p>
              <p className="subtext">Click the + button to add a new pin</p>
            </div>
          ) : (
            <>
              <div className="pins-list">
                {displayedPins.map((pin) => (
                  <div 
                    key={pin._id} 
                    className="pin-box"
                    onClick={() => onPinClick(pin)}
                  >
                    <div className="pin-box-header">
                      <div 
                        className="pin-type-indicator"
                        style={{ backgroundColor: getProblemIconColor(pin.problemType) }}
                      />
                      <div className="pin-type-info">
                        <h3 className="pin-problem-type">{pin.problemType}</h3>
                        <span className="pin-severity">Severity: {pin.severity}/10</span>
                      </div>
                    </div>

                    {pin.description && (
                      <p className="pin-description-text">
                        {pin.description.length > 100 
                          ? `${pin.description.substring(0, 100)}...` 
                          : pin.description}
                      </p>
                    )}

                    {pin.location.address && (
                      <div className="pin-location-info">
                        <FaMapMarkerAlt className="location-icon" />
                        <span className="pin-address">
                          {pin.location.address.length > 50
                            ? `${pin.location.address.substring(0, 50)}...`
                            : pin.location.address}
                        </span>
                      </div>
                    )}

                    <div className="pin-stats">
                      <div className="stat-item">
                        <FaThumbsUp className="stat-icon upvote" />
                        <span>{pin.upvotes || 0}</span>
                      </div>
                      <div className="stat-item">
                        <FaThumbsDown className="stat-icon downvote" />
                        <span>{pin.downvotes || 0}</span>
                      </div>
                      <div className="stat-item">
                        <FaComment className="stat-icon comment" />
                        <span>{pin.comments?.length || 0}</span>
                      </div>
                    </div>

                    <div className="pin-meta">
                      {pin.name && <span className="pin-author">By {pin.name}</span>}
                      <span className="pin-date">{formatDate(pin.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {hasMorePins && (
                <div className="load-more-container">
                  <button 
                    className="load-more-btn"
                    onClick={handleLoadMore}
                  >
                    Load More ({pins.length - displayedPins.length} remaining)
                  </button>
                </div>
              )}

              {!hasMorePins && displayedPins.length > 0 && (
                <div className="all-pins-loaded">
                  <p>All pins loaded</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default PinListPanel;
