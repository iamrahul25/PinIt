import React, { useState, useMemo } from 'react';
import { FaMapMarkerAlt, FaThumbsUp, FaThumbsDown, FaComment, FaChevronRight, FaChevronLeft, FaShareAlt } from 'react-icons/fa';
import { getProblemTypeMarkerHtml } from '../utils/problemTypeIcons';
import './PinListPanel.css';

const PROBLEM_TYPES = [
  { value: 'Trash Pile', label: 'Trash Pile' },
  { value: 'Pothole', label: 'Pothole' },
  { value: 'Broken Pipe', label: 'Broken Pipe' },
  { value: 'Fuse Street Light', label: 'Fuse Street Light' },
  { value: 'Other', label: 'Other' }
];

const PinListPanel = ({ pins, focusedPinId, hoveredPinId, onPinFocus, onShowDetails, onPinHover, onPinHoverEnd, onSharePin, isOpen, onToggle }) => {
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const filteredPins = useMemo(() => {
    if (selectedTypes.length === 0) return pins;
    return pins.filter((p) => selectedTypes.includes(p.problemType));
  }, [pins, selectedTypes]);

  const sortedPins = useMemo(() => {
    const list = [...filteredPins];
    const mult = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'createdAt') {
      list.sort((a, b) => mult * (new Date(a.createdAt) - new Date(b.createdAt)));
    } else if (sortBy === 'severity') {
      list.sort((a, b) => mult * ((a.severity ?? 0) - (b.severity ?? 0)));
    } else if (sortBy === 'upvotes') {
      list.sort((a, b) => mult * ((a.upvotes ?? 0) - (b.upvotes ?? 0)));
    } else if (sortBy === 'comments') {
      list.sort((a, b) => mult * ((a.comments?.length ?? 0) - (b.comments?.length ?? 0)));
    }
    return list;
  }, [filteredPins, sortBy, sortOrder]);

  const toggleType = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSortClick = (field) => {
    setSortBy(field);
  };

  const handleSortDoubleClick = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
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
          <h2>Pins ({sortedPins.length}{pins.length !== sortedPins.length ? ` / ${pins.length}` : ''})</h2>
          <button className="close-panel-btn" onClick={onToggle}>×</button>
        </div>

        <div className="panel-filters">
          <div className="filter-section">
            <span className="filter-label">Filter by type</span>
            <div className="filter-checkboxes">
              {PROBLEM_TYPES.map(({ value, label }) => (
                <label key={value} className="filter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(value)}
                    onChange={() => toggleType(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="sort-section">
            <span className="sort-label">Sort by</span>
            <div className="sort-buttons">
              <button
                type="button"
                className={`sort-btn ${sortBy === 'createdAt' ? 'active' : ''}`}
                onClick={() => handleSortClick('createdAt')}
                onDoubleClick={handleSortDoubleClick}
                title="Single click: sort by date. Double click: reverse order."
              >
                Date {sortBy === 'createdAt' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                type="button"
                className={`sort-btn ${sortBy === 'severity' ? 'active' : ''}`}
                onClick={() => handleSortClick('severity')}
                onDoubleClick={handleSortDoubleClick}
                title="Single click: sort by severity. Double click: reverse order."
              >
                Severity {sortBy === 'severity' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                type="button"
                className={`sort-btn ${sortBy === 'upvotes' ? 'active' : ''}`}
                onClick={() => handleSortClick('upvotes')}
                onDoubleClick={handleSortDoubleClick}
                title="Single click: sort by likes. Double click: reverse order."
              >
                Likes {sortBy === 'upvotes' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                type="button"
                className={`sort-btn ${sortBy === 'comments' ? 'active' : ''}`}
                onClick={() => handleSortClick('comments')}
                onDoubleClick={handleSortDoubleClick}
                title="Single click: sort by comments. Double click: reverse order."
              >
                Comments {sortBy === 'comments' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
            </div>
          </div>
        </div>

        <div className="panel-content">
          {sortedPins.length === 0 ? (
            <div className="no-pins-message">
              <p>{pins.length === 0 ? 'No pins available' : 'No pins match the selected filter'}</p>
              <p className="subtext">
                {pins.length === 0 ? 'Click the + button to add a new pin' : 'Check one or more types above to see pins'}
              </p>
            </div>
          ) : (
            <>
              <div className="pins-list">
                {sortedPins.map((pin) => (
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

                    <div className="pin-card-actions">
                      <button
                        type="button"
                        className="pin-share-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSharePin?.(pin);
                        }}
                        title="Share this pin"
                      >
                        <FaShareAlt /> Share
                      </button>
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
