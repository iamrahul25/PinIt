import React from 'react';
import { FaMapMarkerAlt, FaThumbsUp, FaThumbsDown, FaComment, FaChevronRight, FaChevronLeft } from 'react-icons/fa';
import { getProblemTypeMarkerHtml } from '../utils/problemTypeIcons';
import './PinListPanel.css';

const PinListPanel = ({ pins, focusedPinId, hoveredPinId, onPinFocus, onShowDetails, onPinHover, onPinHoverEnd, isOpen, onToggle }) => {
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
                {pins.map((pin) => (
                  <div 
                    key={pin._id} 
                    className={`pin-box ${(focusedPinId === pin._id || hoveredPinId === pin._id) ? 'pin-box-focused' : ''}`}
                    onClick={() => onPinFocus(pin)}
                    onMouseEnter={() => onPinHover?.(pin)}
                    onMouseLeave={() => onPinHoverEnd?.()}
                  >
                    <div className="pin-box-header">
                      <div
                        className="pin-type-icon-panel"
                        dangerouslySetInnerHTML={{ __html: getProblemTypeMarkerHtml(pin.problemType, 32) }}
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

                    <button
                      type="button"
                      className="pin-full-details-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowDetails(pin);
                      }}
                    >
                      Full details
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default PinListPanel;
