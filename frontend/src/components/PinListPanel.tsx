import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FaMapMarkerAlt, FaThumbsUp, FaComment, FaChevronRight, FaChevronLeft, FaShareAlt, FaBookmark, FaUser, FaThLarge, FaList, FaLocationArrow } from 'react-icons/fa';
import { API_BASE_URL } from '../config';
import { getProblemTypeMarkerHtml, PROBLEM_TYPE_COLORS } from '../utils/problemTypeIcons';
import { getFullImageUrl } from '../utils/cloudinaryUrls';
import { getPinImageSrc } from '../utils/pinImageEntry';
import { distanceToPinKm, formatDistanceKm } from '../utils/geoDistance';
import Toast from './Toast';
import './PinListPanel.css';

// Verification score helpers (same as PinDetails)
const VERIFICATION_ROLE_SCORES = { user: 10, reviewer: 30, ngo: 50, admin: 60 };
const getVerificationScore = (pv) => (pv || []).reduce((s, v) => s + (VERIFICATION_ROLE_SCORES[v.role] || 10), 0);
const getVerificationStatus = (score) => {
  if (score >= 121) return { label: 'Highly Verified', emoji: '🔵', className: 'highly-verified' };
  if (score >= 81) return { label: 'Verified', emoji: '🟢', className: 'verified' };
  if (score >= 41) return { label: 'Partially Verified', emoji: '🟡', className: 'partially-verified' };
  return { label: 'Unverified', emoji: '🔴', className: 'unverified' };
};

const VERIFICATION_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'unverified', label: 'Unverified' },
  { value: 'partially-verified', label: 'Partially Verified' },
  { value: 'verified', label: 'Verified' },
  { value: 'highly-verified', label: 'Highly Verified' }
];

const PROBLEM_TYPES = [
  { value: 'Trash Pile', label: 'Trash Pile' },
  { value: 'Pothole', label: 'Pothole' },
  { value: 'Broken Pipe', label: 'Broken Pipe' },
  { value: 'Fuse Street Light', label: 'Fuse Street Light' },
  { value: 'Other', label: 'Other' }
];

function getSeverityLabel(severity) {
  const v = severity ?? 5;
  if (v <= 3) return 'Low';
  if (v <= 6) return 'Medium';
  return 'High';
}

function getSeverityClass(severity) {
  const v = severity ?? 5;
  if (v <= 3) return 'severity-low';
  if (v <= 6) return 'severity-medium';
  return 'severity-high';
}

function pinHasUserUpvote(pin, userId) {
  if (!userId || !Array.isArray(pin?.votes)) return false;
  const v = pin.votes.find((x) => String(x.userId) === String(userId));
  return v?.voteType === 'upvote';
}

const PinListPanel = ({
  pins,
  user,
  focusedPinId,
  hoveredPinId,
  onPinFocus,
  onShowDetails,
  onPinHover,
  onPinHoverEnd,
  onSharePin,
  onSavePin,
  onUnsavePin,
  onTogglePinLike,
  likeSubmittingPinId,
  isOpen,
  onToggle
}) => {
  const [typeFilter, setTypeFilter] = useState(null); // null = All
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterSavedOnly, setFilterSavedOnly] = useState(false);
  const [filterContributedOnly, setFilterContributedOnly] = useState(false);
  const [filterVerification, setFilterVerification] = useState(''); // '' = All, or unverified | partially-verified | verified | highly-verified
  const [viewSize, setViewSize] = useState('big'); // 'big' | 'small' — large cards are default
  /** Current device GPS position (WGS84), when geolocation succeeds */
  const [currentLocationGps, setCurrentLocationGps] = useState<{ lat: number; lng: number } | null>(null);
  /** When set, list order is by distance from you (nearest first), not by Sort by / date */
  const [orderByDistance, setOrderByDistance] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'warning' });

  const showToast = useCallback((message, type = 'warning') => {
    setToast({ visible: true, message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast((t) => ({ ...t, visible: false }));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      showToast('Location is not supported by this browser. Distance filtering is unavailable.', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentLocationGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        let msg =
          'Could not get your location. Enable location services to filter pins by distance.';
        if (err.code === err.PERMISSION_DENIED) {
          msg =
            'Location permission denied. Allow location access in your browser settings to filter by distance.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg =
            'Your position could not be determined. Check that GPS or location services are turned on.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out. Try again or check that GPS is enabled.';
        }
        showToast(msg, 'warning');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
  }, [showToast]);

  useEffect(() => {
    if (!currentLocationGps && orderByDistance) {
      setOrderByDistance(false);
    }
  }, [currentLocationGps, orderByDistance]);

  const filteredPins = useMemo(() => {
    let list = pins;
    if (filterSavedOnly) list = list.filter((p) => p.saved);
    if (filterContributedOnly && user?.id) list = list.filter((p) => p.contributor_id === user.id || p.reportedByMe);
    if (typeFilter) list = list.filter((p) => p.problemType === typeFilter);
    if (filterVerification) {
      list = list.filter((p) => {
        const vs = getVerificationStatus(getVerificationScore(p.pinVerification));
        return vs.className === filterVerification;
      });
    }
    return list;
  }, [pins, typeFilter, filterSavedOnly, filterContributedOnly, filterVerification, user?.id]);

  const sortedPins = useMemo(() => {
    const list = [...filteredPins];
    if (orderByDistance && currentLocationGps) {
      const { lat, lng } = currentLocationGps;
      list.sort((a, b) => {
        const da = distanceToPinKm(lat, lng, a) ?? Infinity;
        const db = distanceToPinKm(lat, lng, b) ?? Infinity;
        return da - db;
      });
      return list;
    }
    const mult = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'createdAt') {
      list.sort(
        (a, b) =>
          mult * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      );
    } else if (sortBy === 'severity') {
      list.sort((a, b) => mult * ((a.severity ?? 0) - (b.severity ?? 0)));
    } else if (sortBy === 'upvotes') {
      list.sort((a, b) => mult * ((a.upvotes ?? 0) - (b.upvotes ?? 0)));
    } else if (sortBy === 'comments') {
      list.sort((a, b) => mult * ((a.comments?.length ?? 0) - (b.comments?.length ?? 0)));
    }
    return list;
  }, [filteredPins, sortBy, sortOrder, currentLocationGps, orderByDistance]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const handleSortClick = (field) => {
    setOrderByDistance(false);
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
    }
  };

  const handleOrderByDistanceChange = (e) => {
    const checked = e.target.checked;
    if (checked && !currentLocationGps) {
      showToast(
        'Turn on location or allow permission to order pins by distance from you.',
        'warning'
      );
      return;
    }
    setOrderByDistance(checked);
  };

  const imgUrl = (pin, index = 0) => {
    const entry = pin.images?.[index];
    const src = getPinImageSrc(entry);
    if (!src) return null;
    return src.startsWith('http') ? getFullImageUrl(src) : `${API_BASE_URL}/api/images/${src}`;
  };

  return (
    <>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
        position="bottom-right"
      />
      {/* Toggle button on the left (reference: fixed left) */}
      <button
        type="button"
        className={`pins-sidebar-toggle ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        title={isOpen ? 'Hide Pins' : 'Show Pins'}
        aria-label={isOpen ? 'Close pins sidebar' : 'Open pins sidebar'}
      >
        {isOpen ? <FaChevronRight className="pins-sidebar-toggle-icon" /> : <FaChevronLeft className="pins-sidebar-toggle-icon" />}
      </button>

      {/* Sidebar */}
      <aside className={`pins-sidebar ${isOpen ? 'open' : ''}`}>
        <header className="pins-sidebar-header">
          <h1 className="pins-sidebar-title">
            Pins <span className="pins-sidebar-count">{sortedPins.length}</span>
          </h1>
          <div className="pins-header-actions">
            <div className="pins-view-toggle" role="group" aria-label="Pin card size">
              <button
                type="button"
                className={`pins-view-toggle-btn ${viewSize === 'big' ? 'active' : ''}`}
                onClick={() => setViewSize('big')}
                title="Large cards"
                aria-label="Large cards"
              >
                <FaThLarge />
              </button>
              <button
                type="button"
                className={`pins-view-toggle-btn ${viewSize === 'small' ? 'active' : ''}`}
                onClick={() => setViewSize('small')}
                title="Small cards"
                aria-label="Small cards"
              >
                <FaList />
              </button>
            </div>
            <button type="button" className="pins-sidebar-close" onClick={onToggle} aria-label="Close">
              <span className="pins-sidebar-close-icon" aria-hidden="true">×</span>
            </button>
          </div>
        </header>

        <div className="pins-sidebar-body hide-scrollbar">
          <section className="pins-filters-section">
            <label className="pins-filter-check">
              <input
                type="checkbox"
                checked={filterSavedOnly}
                onChange={(e) => setFilterSavedOnly(e.target.checked)}
              />
              <span className="pins-filter-icon pins-filter-icon-saved" aria-hidden="true"><FaBookmark /></span>
              <span>Saved Pins</span>
            </label>
            {user?.id && (
              <label className="pins-filter-check">
                <input
                  type="checkbox"
                  checked={filterContributedOnly}
                  onChange={(e) => setFilterContributedOnly(e.target.checked)}
                />
                <span className="pins-filter-icon pins-filter-icon-user" aria-hidden="true"><FaUser /></span>
                <span>Contributed Pins</span>
              </label>
            )}
            <label
              className="pins-filter-check"
              title={
                currentLocationGps
                  ? 'Order pins nearest to farthest from your location instead of using Sort by (e.g. date)'
                  : 'Requires your location'
              }
            >
              <input
                type="checkbox"
                checked={orderByDistance}
                onChange={handleOrderByDistanceChange}
                disabled={!currentLocationGps}
              />
              <span className="pins-filter-icon pins-filter-icon-distance" aria-hidden="true">
                <FaLocationArrow />
              </span>
              <span>
                By distance
                {!currentLocationGps && (
                  <span className="pins-filter-distance-gps-hint"> (GPS not detected)</span>
                )}
              </span>
            </label>
          </section>

          <section className="pins-status-filters-section">
            <div className="pins-status-filter-group">
              <h3 className="pins-section-heading">Verification status</h3>
              <select
                className="pins-filter-select"
                value={filterVerification}
                onChange={(e) => setFilterVerification(e.target.value)}
                aria-label="Filter by verification status"
              >
                {VERIFICATION_FILTER_OPTIONS.map(({ value, label }) => (
                  <option key={value || 'all'} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </section>

          <section className="pins-type-section">
            <h3 className="pins-section-heading">Filter by type</h3>
            <div className="pins-type-pills">
              <button
                type="button"
                className={`pins-pill pins-pill-all ${typeFilter === null ? 'active' : ''}`}
                onClick={() => setTypeFilter(null)}
              >
                All
              </button>
              {PROBLEM_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`pins-pill pins-pill-type ${typeFilter === value ? 'active' : ''}`}
                  data-type={value}
                  onClick={() => setTypeFilter(typeFilter === value ? null : value)}
                  style={{
                    ['--pills-type-color']: PROBLEM_TYPE_COLORS[value] || PROBLEM_TYPE_COLORS['Other'],
                  }}
                >
                  <span
                    className="pins-pill-icon-wrap"
                    dangerouslySetInnerHTML={{ __html: getProblemTypeMarkerHtml(value, 20) }}
                    aria-hidden="true"
                  />
                  <span className="pins-pill-label">{label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="pins-sort-section">
            <h3 className="pins-section-heading">Sort by</h3>
            {orderByDistance && (
              <p className="pins-sort-distance-note" role="status">
                Ordering by distance — uncheck &quot;By distance&quot; above to use these sort options.
              </p>
            )}
            <div className="pins-sort-grid">
              <button
                type="button"
                className={`pins-sort-btn ${sortBy === 'createdAt' && !orderByDistance ? 'active' : ''}`}
                onClick={() => handleSortClick('createdAt')}
                disabled={orderByDistance}
              >
                Date <span className="pins-sort-arrow">{sortBy === 'createdAt' && !orderByDistance && (sortOrder === 'desc' ? '↓' : '↑')}</span>
              </button>
              <button
                type="button"
                className={`pins-sort-btn ${sortBy === 'severity' && !orderByDistance ? 'active' : ''}`}
                onClick={() => handleSortClick('severity')}
                disabled={orderByDistance}
              >
                Severity <span className="pins-sort-arrow">{sortBy === 'severity' && !orderByDistance && (sortOrder === 'desc' ? '↓' : '↑')}</span>
              </button>
              <button
                type="button"
                className={`pins-sort-btn ${sortBy === 'upvotes' && !orderByDistance ? 'active' : ''}`}
                onClick={() => handleSortClick('upvotes')}
                disabled={orderByDistance}
              >
                Likes <span className="pins-sort-arrow">{sortBy === 'upvotes' && !orderByDistance && (sortOrder === 'desc' ? '↓' : '↑')}</span>
              </button>
              <button
                type="button"
                className={`pins-sort-btn ${sortBy === 'comments' && !orderByDistance ? 'active' : ''}`}
                onClick={() => handleSortClick('comments')}
                disabled={orderByDistance}
              >
                Comments <span className="pins-sort-arrow">{sortBy === 'comments' && !orderByDistance && (sortOrder === 'desc' ? '↓' : '↑')}</span>
              </button>
            </div>
          </section>

          <div className="pins-list-wrap">
            {sortedPins.length === 0 ? (
              <div className="pins-empty">
                <p>{pins.length === 0 ? 'No pins available' : 'No pins match the selected filter'}</p>
                <p className="pins-empty-sub">
                  {pins.length === 0
                    ? 'Click + on the map to add a new pin'
                    : filterContributedOnly
                      ? "You haven't contributed any pins yet"
                      : filterSavedOnly
                        ? 'Save pins from their full details to see them here'
                        : 'Try changing the filter above'}
                </p>
              </div>
            ) : (
              <div className="pins-list">
                {sortedPins.map((pin) => {
                  const distKm =
                    currentLocationGps != null
                      ? distanceToPinKm(currentLocationGps.lat, currentLocationGps.lng, pin)
                      : null;
                  return (
                  <div
                    key={pin._id}
                    className={`pin-card ${viewSize === 'big' ? 'pin-card-featured' : 'pin-card-compact'} ${(focusedPinId === pin._id || hoveredPinId === pin._id) ? 'focused' : ''}`}
                    onClick={() => onPinFocus(pin)}
                    onMouseEnter={() => onPinHover?.(pin)}
                    onMouseLeave={() => onPinHoverEnd?.()}
                  >
                    {viewSize === 'big' ? (
                      <>
                        <div className="pin-card-media">
                          <div className={`pin-card-media-grid pin-card-media-grid--n${Math.min(pin.images?.length || 0, 5) || 1}`}>
                            {pin.images?.length ? (
                              pin.images.slice(0, 5).map((_, i) => (
                                <div key={i} className="pin-card-media-grid-item">
                                  <img src={imgUrl(pin, i)} alt="" />
                                </div>
                              ))
                            ) : (
                              <div className="pin-card-media-grid-item pin-card-placeholder">
                                <div
                                  className="pin-card-type-icon"
                                  dangerouslySetInnerHTML={{ __html: getProblemTypeMarkerHtml(pin.problemType, 40) }}
                                />
                              </div>
                            )}
                          </div>
                          {pin.saved && (
                            <button
                              type="button"
                              className="pin-card-bookmark saved"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUnsavePin?.(pin);
                              }}
                              aria-label="Unsave"
                            >
                              <FaBookmark />
                            </button>
                          )}
                        </div>
                        <div className="pin-card-body">
                          <div className="pin-card-head">
                            <h2 className="pin-card-title">{pin.problemHeading || pin.problemType}</h2>
                            <div className="pin-card-head-badges">
                              <span className={`pin-card-severity ${getSeverityClass(pin.severity)}`}>
                                {getSeverityLabel(pin.severity)} ({pin.severity ?? 0}/10)
                              </span>
                            </div>
                          </div>
                          {pin.description && (
                            <p className="pin-card-desc">{pin.description}</p>
                          )}
                          {pin.location?.address && (
                            <div className="pin-card-location">
                              <FaMapMarkerAlt className="pin-card-location-icon" />
                              <span className="pin-card-address">{pin.location.address}</span>
                            </div>
                          )}
                          {distKm != null && (
                            <div className="pin-card-distance" title="Straight-line distance from your location">
                              <FaLocationArrow className="pin-card-distance-icon" aria-hidden />
                              <span>{formatDistanceKm(distKm)} from your location</span>
                            </div>
                          )}
                          <div className="pin-card-meta">
                            <div className="pin-card-actions-row">
                              <button
                                type="button"
                                className={`pin-card-meta-btn ${pinHasUserUpvote(pin, user?.id) ? 'pin-card-meta-btn--liked' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTogglePinLike?.(pin);
                                }}
                                disabled={likeSubmittingPinId != null && String(likeSubmittingPinId) === String(pin._id)}
                                aria-pressed={pinHasUserUpvote(pin, user?.id)}
                                aria-label={pinHasUserUpvote(pin, user?.id) ? 'Unlike issue' : 'Like issue'}
                              >
                                <FaThumbsUp /> <span>{pin.upvotes ?? 0}</span>
                              </button>
                              <button
                                type="button"
                                className="pin-card-meta-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onShowDetails?.(pin, { focusComments: true });
                                }}
                                aria-label="View comments"
                              >
                                <FaComment /> <span>{pin.comments?.length ?? 0}</span>
                              </button>
                            </div>
                            <span className="pin-card-time">{formatDate(pin.createdAt)}</span>
                          </div>
                          <div className="pin-card-buttons">
                            <button
                              type="button"
                              className="pin-card-btn pin-card-btn-outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSharePin?.(pin);
                              }}
                            >
                              <FaShareAlt /> Share
                            </button>
                            <button
                              type="button"
                              className="pin-card-btn pin-card-btn-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                onShowDetails(pin);
                              }}
                            >
                              Full details
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="pin-card-compact-thumb">
                          {pin.images?.[0] ? (
                            <img src={imgUrl(pin)} alt="" />
                          ) : (
                            <div
                              className="pin-card-type-icon small"
                              dangerouslySetInnerHTML={{ __html: getProblemTypeMarkerHtml(pin.problemType, 28) }}
                            />
                          )}
                        </div>
                        <div className="pin-card-compact-content">
                          <div className="pin-card-compact-head">
                            <h3 className="pin-card-compact-title">{pin.problemHeading || pin.problemType}</h3>
                            <div className="pin-card-compact-badges">
                              <span className={`pin-card-severity small ${getSeverityClass(pin.severity)}`}>
                                {getSeverityLabel(pin.severity)} ({pin.severity ?? 0}/10)
                              </span>
                            </div>
                          </div>
                          {pin.description && (
                            <p className="pin-card-compact-desc">{pin.description}</p>
                          )}
                          <div className="pin-card-compact-location">
                            <FaMapMarkerAlt /> <span>{(pin.location?.address && pin.location.address.length > 25) ? pin.location.address.slice(0, 25) + '...' : (pin.location?.address || '—')}</span>
                          </div>
                          <div className="pin-card-compact-stats">
                            <button
                              type="button"
                              className={`pin-card-compact-stat-btn ${pinHasUserUpvote(pin, user?.id) ? 'pin-card-compact-stat-btn--liked' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onTogglePinLike?.(pin);
                              }}
                              disabled={likeSubmittingPinId != null && String(likeSubmittingPinId) === String(pin._id)}
                              aria-pressed={pinHasUserUpvote(pin, user?.id)}
                              aria-label={pinHasUserUpvote(pin, user?.id) ? 'Unlike issue' : 'Like issue'}
                            >
                              <FaThumbsUp /> {pin.upvotes ?? 0}
                            </button>
                            <button
                              type="button"
                              className="pin-card-compact-stat-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onShowDetails?.(pin, { focusComments: true });
                              }}
                              aria-label="View comments"
                            >
                              <FaComment /> {pin.comments?.length ?? 0}
                            </button>
                          </div>
                          <button
                            type="button"
                            className="pin-card-compact-full-details"
                            onClick={(e) => {
                              e.stopPropagation();
                              onShowDetails(pin);
                            }}
                          >
                            Full details <FaChevronRight className="pin-card-compact-full-details-icon" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default PinListPanel;
