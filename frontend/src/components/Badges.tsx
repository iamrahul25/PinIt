import React, { useState, useMemo, useRef, useCallback } from 'react';
import { 
  BADGE_CATEGORIES, 
  BADGE_TIERS, 
  computeBadges, 
  getBadgeCounts,
  getNextBadgeToEarn 
} from '../utils/badges';
import './Badges.css';

const BADGES_INITIAL_COUNT = 6; // Show 6 badges initially, then "Show more" for the rest

/**
 * Badges Component
 * Displays a grid of badges with earned/locked states and progress indicators.
 * Supports filtering by category and shows detailed progress for each badge.
 */
export default function Badges({ stats = {}, loading = false }) {
  const [selectedCategory, setSelectedCategory] = useState('earned');
  const [hoveredBadge, setHoveredBadge] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const categoryScrollRef = useRef(null);

  const scrollCategory = useCallback((direction) => {
    const el = categoryScrollRef.current;
    if (!el) return;
    const step = 200;
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
  }, []);

  // Compute badges from stats
  const badges = useMemo(() => computeBadges(stats), [stats]);
  const badgeCounts = useMemo(() => getBadgeCounts(stats), [stats]);
  const nextBadge = useMemo(() => getNextBadgeToEarn(stats), [stats]);

  // Filter options: Earned (only earned), All, then category filters
  const categories = useMemo(() => {
    return ['earned', 'all', ...Object.values(BADGE_CATEGORIES)];
  }, []);

  // Filter badges by selected category or earned-only
  const filteredBadges = useMemo(() => {
    if (selectedCategory === 'earned') return badges.filter((badge) => badge.earned);
    if (selectedCategory === 'all') return badges;
    return badges.filter((badge) => badge.category === selectedCategory);
  }, [badges, selectedCategory]);

  // Reset expanded when category changes
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setExpanded(false);
  };

  const visibleBadges = expanded ? filteredBadges : filteredBadges.slice(0, BADGES_INITIAL_COUNT);
  const hasMore = filteredBadges.length > BADGES_INITIAL_COUNT;
  const remainingCount = filteredBadges.length - BADGES_INITIAL_COUNT;

  // Get tier CSS class
  const getTierClass = (tier) => {
    switch (tier) {
      case BADGE_TIERS.BRONZE:
        return 'badge-tier-bronze';
      case BADGE_TIERS.SILVER:
        return 'badge-tier-silver';
      case BADGE_TIERS.GOLD:
        return 'badge-tier-gold';
      case BADGE_TIERS.DIAMOND:
        return 'badge-tier-diamond';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="badges-section">
        <div className="badges-loading">
          <div className="badges-loader"></div>
          <span>Loading badges...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="badges-section">
      {/* Header with counts */}
      <div className="badges-header">
        <div className="badges-title-row">
          <h2 className="badges-title">
            <span className="badges-title-icon">🏅</span>
            Badges
          </h2>
          <div className="badges-count">
            <span className="badges-earned-count">{badgeCounts.earned}</span>
            <span className="badges-total-count"> / {badgeCounts.total}</span>
            <span className="badges-count-label"> earned</span>
          </div>
        </div>

        {/* Tier breakdown */}
        <div className="badges-tier-breakdown">
          <span className={`tier-count bronze ${badgeCounts.byTier.bronze > 0 ? 'has-badges' : ''}`}>
            🥉 {badgeCounts.byTier.bronze}
          </span>
          <span className={`tier-count silver ${badgeCounts.byTier.silver > 0 ? 'has-badges' : ''}`}>
            🥈 {badgeCounts.byTier.silver}
          </span>
          <span className={`tier-count gold ${badgeCounts.byTier.gold > 0 ? 'has-badges' : ''}`}>
            🥇 {badgeCounts.byTier.gold}
          </span>
          <span className={`tier-count diamond ${badgeCounts.byTier.diamond > 0 ? 'has-badges' : ''}`}>
            💎 {badgeCounts.byTier.diamond}
          </span>
        </div>

        {/* Next badge to earn */}
        {nextBadge && (
          <div className="badges-next-goal">
            <span className="next-goal-label">Next goal:</span>
            <span className="next-goal-badge">
              {nextBadge.icon} {nextBadge.name}
            </span>
            <span className="next-goal-progress">
              ({nextBadge.progress.current}/{nextBadge.progress.max})
            </span>
          </div>
        )}
      </div>

      {/* Category filter with left/right scroll arrows */}
      <div className="badges-category-filter-wrap">
        <button
          type="button"
          className="badges-category-scroll-btn left"
          onClick={() => scrollCategory('left')}
          aria-label="Scroll tags left"
        >
          ‹
        </button>
        <div className="badges-category-filter" ref={categoryScrollRef}>
          <div className="badges-category-scroll">
            {categories.map((category) => {
            const count = category === 'earned'
              ? badgeCounts.earned
              : category === 'all'
                ? badgeCounts.total
                : badgeCounts.byCategory[category] || 0;
            const label = category === 'earned' ? 'Earned' : category === 'all' ? 'All' : category;
            return (
              <button
                key={category}
                className={`category-filter-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => handleCategoryChange(category)}
              >
                {label}
                <span className="category-count">{count}</span>
              </button>
            );
          })}
          </div>
        </div>
        <button
          type="button"
          className="badges-category-scroll-btn right"
          onClick={() => scrollCategory('right')}
          aria-label="Scroll tags right"
        >
          ›
        </button>
      </div>

      {/* Badges grid */}
      <div className={`badges-grid ${expanded ? 'badges-grid-expanded' : ''}`}>
        {visibleBadges.map((badge) => (
          <div
            key={badge.id}
            className={`badge-card ${badge.earned ? 'earned' : 'locked'} ${getTierClass(badge.tier)}`}
            onMouseEnter={() => setHoveredBadge(badge.id)}
            onMouseLeave={() => setHoveredBadge(null)}
          >
            {/* Badge icon */}
            <div className="badge-icon-wrapper">
              <span className="badge-icon">{badge.icon}</span>
              {!badge.earned && <div className="badge-lock-overlay"></div>}
            </div>

            {/* Badge info */}
            <div className="badge-info">
              <h3 className="badge-name">{badge.name}</h3>
              <p className="badge-description">{badge.description}</p>
            </div>

            {/* Progress bar (for locked badges) */}
            {!badge.earned && badge.progress.percentage > 0 && (
              <div className="badge-progress">
                <div className="badge-progress-bar">
                  <div 
                    className="badge-progress-fill" 
                    style={{ width: `${badge.progress.percentage}%` }}
                  ></div>
                </div>
                <span className="badge-progress-text">
                  {badge.progress.current} / {badge.progress.max}
                </span>
              </div>
            )}

            {/* Earned indicator */}
            {badge.earned && (
              <div className="badge-earned-indicator">
                <span className="earned-check">✓</span>
              </div>
            )}

            {/* Hover tooltip */}
            {hoveredBadge === badge.id && (
              <div className="badge-tooltip">
                <div className="tooltip-header">
                  <span className="tooltip-icon">{badge.icon}</span>
                  <span className="tooltip-name">{badge.name}</span>
                </div>
                <p className="tooltip-description">{badge.description}</p>
                <div className="tooltip-meta">
                  <span className={`tooltip-tier ${badge.tier}`}>
                    {badge.tier.charAt(0).toUpperCase() + badge.tier.slice(1)}
                  </span>
                  <span className="tooltip-category">{badge.category}</span>
                </div>
                <div className="tooltip-progress">
                  <span>Progress: {badge.progress.current} / {badge.progress.max}</span>
                  <span className="tooltip-percentage">{badge.progress.percentage}%</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Show more / Show less */}
      {filteredBadges.length > 0 && hasMore && (
        <div className="badges-show-more-wrap">
          <button
            type="button"
            className="badges-show-more-btn"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            {expanded
              ? 'Show less'
              : `Show more (+${remainingCount} ${remainingCount === 1 ? 'badge' : 'badges'})`}
          </button>
        </div>
      )}

      {/* Empty state */}
      {filteredBadges.length === 0 && (
        <div className="badges-empty">
          <span className="empty-icon">🏆</span>
          <p>No badges in this category yet.</p>
        </div>
      )}
    </div>
  );
}