/**
 * Badge System for Pin-It
 * All badges are computed on-the-fly from user stats and activity data.
 * Each badge has: id, name, description, icon, category, tier, criteria, and progress calculation.
 */

// Badge tier levels for visual distinction
export const BADGE_TIERS = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  DIAMOND: 'diamond',
};

// Badge categories for grouping
export const BADGE_CATEGORIES = {
  PINS: 'Pins',
  ENGAGEMENT: 'Engagement',
  VOTING: 'Voting',
  VERIFICATION: 'Verification',
  NGO_EVENTS: 'NGO & Events',
  SUGGESTIONS: 'Suggestions',
  STREAK: 'Streak',
  SPECIAL: 'Special',
  ROLE: 'Role',
  LEADERBOARD: 'Leaderboard',
  MILESTONE: 'Milestone',
  IMPACT: 'Impact',
};

/**
 * Badge definitions with criteria and progress calculation functions.
 * Each badge has:
 * - id: unique identifier
 * - name: display name
 * - description: what the badge is for
 * - icon: emoji or icon name
 * - category: BADGE_CATEGORIES key
 * - tier: BADGE_TIERS key
 * - criteria: the threshold value needed
 * - getProgress: function to calculate current progress (returns { current, max, percentage })
 */
export const BADGE_DEFINITIONS = [
  // ==================== PIN CREATION BADGES ====================
  {
    id: 'first_step',
    name: 'First Step',
    description: 'Created your first pin',
    icon: '🌱',
    category: BADGE_CATEGORIES.PINS,
    tier: BADGE_TIERS.BRONZE,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.pinsCreated || 0, max: 1 }),
  },
  {
    id: 'pin_dropper',
    name: 'Pin Dropper',
    description: 'Created 5 pins',
    icon: '📌',
    category: BADGE_CATEGORIES.PINS,
    tier: BADGE_TIERS.BRONZE,
    criteria: 5,
    getProgress: (stats) => ({ current: stats.pinsCreated || 0, max: 5 }),
  },
  {
    id: 'map_maker',
    name: 'Map Maker',
    description: 'Created 25 pins',
    icon: '🗺️',
    category: BADGE_CATEGORIES.PINS,
    tier: BADGE_TIERS.SILVER,
    criteria: 25,
    getProgress: (stats) => ({ current: stats.pinsCreated || 0, max: 25 }),
  },
  {
    id: 'civic_champion',
    name: 'Civic Champion',
    description: 'Created 50 pins',
    icon: '🏙️',
    category: BADGE_CATEGORIES.PINS,
    tier: BADGE_TIERS.GOLD,
    criteria: 50,
    getProgress: (stats) => ({ current: stats.pinsCreated || 0, max: 50 }),
  },
  {
    id: 'community_hero',
    name: 'Community Hero',
    description: 'Created 100 pins',
    icon: '🌟',
    category: BADGE_CATEGORIES.PINS,
    tier: BADGE_TIERS.DIAMOND,
    criteria: 100,
    getProgress: (stats) => ({ current: stats.pinsCreated || 0, max: 100 }),
  },
  {
    id: 'legend',
    name: 'Legend',
    description: 'Created 250 pins',
    icon: '👑',
    category: BADGE_CATEGORIES.PINS,
    tier: BADGE_TIERS.DIAMOND,
    criteria: 250,
    getProgress: (stats) => ({ current: stats.pinsCreated || 0, max: 250 }),
  },

  // ==================== ENGAGEMENT BADGES ====================
  {
    id: 'voice',
    name: 'Voice',
    description: 'Posted your first comment',
    icon: '💭',
    category: BADGE_CATEGORIES.ENGAGEMENT,
    tier: BADGE_TIERS.BRONZE,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.commentsMade || 0, max: 1 }),
  },
  {
    id: 'conversationalist',
    name: 'Conversationalist',
    description: 'Made 10 comments',
    icon: '🗣️',
    category: BADGE_CATEGORIES.ENGAGEMENT,
    tier: BADGE_TIERS.BRONZE,
    criteria: 10,
    getProgress: (stats) => ({ current: stats.commentsMade || 0, max: 10 }),
  },
  {
    id: 'community_voice',
    name: 'Community Voice',
    description: 'Made 50 comments',
    icon: '📢',
    category: BADGE_CATEGORIES.ENGAGEMENT,
    tier: BADGE_TIERS.SILVER,
    criteria: 50,
    getProgress: (stats) => ({ current: stats.commentsMade || 0, max: 50 }),
  },
  {
    id: 'insightful',
    name: 'Insightful',
    description: 'Made 100 comments',
    icon: '🎯',
    category: BADGE_CATEGORIES.ENGAGEMENT,
    tier: BADGE_TIERS.GOLD,
    criteria: 100,
    getProgress: (stats) => ({ current: stats.commentsMade || 0, max: 100 }),
  },

  // ==================== VOTING BADGES ====================
  {
    id: 'voter',
    name: 'Voter',
    description: 'Cast your first vote',
    icon: '👆',
    category: BADGE_CATEGORIES.VOTING,
    tier: BADGE_TIERS.BRONZE,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.votesCast || 0, max: 1 }),
  },
  {
    id: 'fair_judge',
    name: 'Fair Judge',
    description: 'Cast 25 votes',
    icon: '⚖️',
    category: BADGE_CATEGORIES.VOTING,
    tier: BADGE_TIERS.BRONZE,
    criteria: 25,
    getProgress: (stats) => ({ current: stats.votesCast || 0, max: 25 }),
  },
  {
    id: 'civic_judge',
    name: 'Civic Judge',
    description: 'Cast 100 votes',
    icon: '🎖️',
    category: BADGE_CATEGORIES.VOTING,
    tier: BADGE_TIERS.SILVER,
    criteria: 100,
    getProgress: (stats) => ({ current: stats.votesCast || 0, max: 100 }),
  },
  {
    id: 'voice_of_people',
    name: 'Voice of the People',
    description: 'Cast 500 votes',
    icon: '⭐',
    category: BADGE_CATEGORIES.VOTING,
    tier: BADGE_TIERS.GOLD,
    criteria: 500,
    getProgress: (stats) => ({ current: stats.votesCast || 0, max: 500 }),
  },

  // ==================== VERIFICATION BADGES ====================
  {
    id: 'verifier',
    name: 'Verifier',
    description: 'Verified your first pin',
    icon: '🔍',
    category: BADGE_CATEGORIES.VERIFICATION,
    tier: BADGE_TIERS.BRONZE,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.verificationsMade || 0, max: 1 }),
  },
  {
    id: 'trusted_eye',
    name: 'Trusted Eye',
    description: 'Verified 10 pins',
    icon: '✅',
    category: BADGE_CATEGORIES.VERIFICATION,
    tier: BADGE_TIERS.BRONZE,
    criteria: 10,
    getProgress: (stats) => ({ current: stats.verificationsMade || 0, max: 10 }),
  },
  {
    id: 'guardian',
    name: 'Guardian',
    description: 'Verified 50 pins',
    icon: '🛡️',
    category: BADGE_CATEGORIES.VERIFICATION,
    tier: BADGE_TIERS.SILVER,
    criteria: 50,
    getProgress: (stats) => ({ current: stats.verificationsMade || 0, max: 50 }),
  },
  {
    id: 'truth_seeker',
    name: 'Truth Seeker',
    description: 'Verified 100 pins',
    icon: '🏆',
    category: BADGE_CATEGORIES.VERIFICATION,
    tier: BADGE_TIERS.GOLD,
    criteria: 100,
    getProgress: (stats) => ({ current: stats.verificationsMade || 0, max: 100 }),
  },

  // ==================== NGO & EVENT BADGES ====================
  {
    id: 'connector',
    name: 'Connector',
    description: 'Added your first NGO',
    icon: '🤝',
    category: BADGE_CATEGORIES.NGO_EVENTS,
    tier: BADGE_TIERS.BRONZE,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.ngosCreated || 0, max: 1 }),
  },
  {
    id: 'network_builder',
    name: 'Network Builder',
    description: 'Added 5 NGOs',
    icon: '🏛️',
    category: BADGE_CATEGORIES.NGO_EVENTS,
    tier: BADGE_TIERS.SILVER,
    criteria: 5,
    getProgress: (stats) => ({ current: stats.ngosCreated || 0, max: 5 }),
  },
  {
    id: 'event_organizer',
    name: 'Event Organizer',
    description: 'Created your first event',
    icon: '📅',
    category: BADGE_CATEGORIES.NGO_EVENTS,
    tier: BADGE_TIERS.BRONZE,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.eventsCreated || 0, max: 1 }),
  },
  {
    id: 'community_builder',
    name: 'Community Builder',
    description: 'Created 5 events',
    icon: '🎉',
    category: BADGE_CATEGORIES.NGO_EVENTS,
    tier: BADGE_TIERS.SILVER,
    criteria: 5,
    getProgress: (stats) => ({ current: stats.eventsCreated || 0, max: 5 }),
  },
  {
    id: 'change_maker',
    name: 'Change Maker',
    description: 'Added 10 NGOs',
    icon: '🌍',
    category: BADGE_CATEGORIES.NGO_EVENTS,
    tier: BADGE_TIERS.GOLD,
    criteria: 10,
    getProgress: (stats) => ({ current: stats.ngosCreated || 0, max: 10 }),
  },

  // ==================== SUGGESTION BADGES ====================
  {
    id: 'idea_spark',
    name: 'Idea Spark',
    description: 'Submitted your first suggestion',
    icon: '💭',
    category: BADGE_CATEGORIES.SUGGESTIONS,
    tier: BADGE_TIERS.BRONZE,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.suggestionsMade || 0, max: 1 }),
  },
  {
    id: 'innovator',
    name: 'Innovator',
    description: 'Submitted 5 suggestions',
    icon: '💡',
    category: BADGE_CATEGORIES.SUGGESTIONS,
    tier: BADGE_TIERS.BRONZE,
    criteria: 5,
    getProgress: (stats) => ({ current: stats.suggestionsMade || 0, max: 5 }),
  },
  {
    id: 'visionary',
    name: 'Visionary',
    description: 'Submitted 15 suggestions',
    icon: '🚀',
    category: BADGE_CATEGORIES.SUGGESTIONS,
    tier: BADGE_TIERS.SILVER,
    criteria: 15,
    getProgress: (stats) => ({ current: stats.suggestionsMade || 0, max: 15 }),
  },
  {
    id: 'product_shaper',
    name: 'Product Shaper',
    description: 'Submitted 25 suggestions',
    icon: '🎯',
    category: BADGE_CATEGORIES.SUGGESTIONS,
    tier: BADGE_TIERS.GOLD,
    criteria: 25,
    getProgress: (stats) => ({ current: stats.suggestionsMade || 0, max: 25 }),
  },
  {
    id: 'implemented',
    name: 'Implemented',
    description: 'Your suggestion was built!',
    icon: '⭐',
    category: BADGE_CATEGORIES.SUGGESTIONS,
    tier: BADGE_TIERS.DIAMOND,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.suggestionsImplemented || 0, max: 1 }),
  },

  // ==================== STREAK BADGES ====================
  {
    id: 'on_fire',
    name: 'On Fire',
    description: '7-day activity streak',
    icon: '🔥',
    category: BADGE_CATEGORIES.STREAK,
    tier: BADGE_TIERS.BRONZE,
    criteria: 7,
    getProgress: (stats) => ({ current: stats.currentStreak || 0, max: 7 }),
  },
  {
    id: 'unstoppable',
    name: 'Unstoppable',
    description: '30-day activity streak',
    icon: '💪',
    category: BADGE_CATEGORIES.STREAK,
    tier: BADGE_TIERS.SILVER,
    criteria: 30,
    getProgress: (stats) => ({ current: stats.currentStreak || 0, max: 30 }),
  },
  {
    id: 'supercharged',
    name: 'Supercharged',
    description: '100-day activity streak',
    icon: '⚡',
    category: BADGE_CATEGORIES.STREAK,
    tier: BADGE_TIERS.DIAMOND,
    criteria: 100,
    getProgress: (stats) => ({ current: stats.currentStreak || 0, max: 100 }),
  },

  // ==================== SPECIAL ACHIEVEMENT BADGES ====================
  {
    id: 'problem_solver',
    name: 'Problem Solver',
    description: 'Had a pin marked as resolved',
    icon: '🎯',
    category: BADGE_CATEGORIES.SPECIAL,
    tier: BADGE_TIERS.SILVER,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.pinsResolved || 0, max: 1 }),
  },
  {
    id: 'high_impact',
    name: 'High Impact',
    description: 'Pin received 50+ upvotes',
    icon: '🌟',
    category: BADGE_CATEGORIES.SPECIAL,
    tier: BADGE_TIERS.GOLD,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.pinsWith50Upvotes || 0, max: 1 }),
  },
  {
    id: 'critical_reporter',
    name: 'Critical Reporter',
    description: 'Reported a critical issue (severity 9+)',
    icon: '🚨',
    category: BADGE_CATEGORIES.SPECIAL,
    tier: BADGE_TIERS.SILVER,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.criticalPins || 0, max: 1 }),
  },
  {
    id: 'photo_journalist',
    name: 'Photo Journalist',
    description: 'Added images to 10 pins',
    icon: '📸',
    category: BADGE_CATEGORIES.SPECIAL,
    tier: BADGE_TIERS.SILVER,
    criteria: 10,
    getProgress: (stats) => ({ current: stats.pinsWithImages || 0, max: 10 }),
  },
  {
    id: 'local_hero',
    name: 'Local Hero',
    description: '10 pins in the same city',
    icon: '📍',
    category: BADGE_CATEGORIES.SPECIAL,
    tier: BADGE_TIERS.SILVER,
    criteria: 10,
    getProgress: (stats) => ({ current: stats.maxPinsInCity || 0, max: 10 }),
  },
  {
    id: 'city_explorer',
    name: 'City Explorer',
    description: 'Reported issues in 5+ cities',
    icon: '🌐',
    category: BADGE_CATEGORIES.SPECIAL,
    tier: BADGE_TIERS.SILVER,
    criteria: 5,
    getProgress: (stats) => ({ current: stats.citiesWithPins || 0, max: 5 }),
  },

  // ==================== ROLE-BASED BADGES ====================
  {
    id: 'verified_user',
    name: 'Verified User',
    description: 'Email verified',
    icon: '👤',
    category: BADGE_CATEGORIES.ROLE,
    tier: BADGE_TIERS.BRONZE,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.emailVerified ? 1 : 0, max: 1 }),
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    description: 'Appointed as reviewer',
    icon: '🎖️',
    category: BADGE_CATEGORIES.ROLE,
    tier: BADGE_TIERS.SILVER,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.role === 'reviewer' ? 1 : 0, max: 1 }),
  },
  {
    id: 'ngo_partner',
    name: 'NGO Partner',
    description: 'NGO account',
    icon: '🏢',
    category: BADGE_CATEGORIES.ROLE,
    tier: BADGE_TIERS.SILVER,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.role === 'ngo' ? 1 : 0, max: 1 }),
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Platform administrator',
    icon: '👑',
    category: BADGE_CATEGORIES.ROLE,
    tier: BADGE_TIERS.DIAMOND,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.role === 'admin' ? 1 : 0, max: 1 }),
  },

  // ==================== LEADERBOARD BADGES ====================
  {
    id: 'weekly_champion',
    name: 'Weekly Champion',
    description: '#1 on weekly leaderboard',
    icon: '🥇',
    category: BADGE_CATEGORIES.LEADERBOARD,
    tier: BADGE_TIERS.GOLD,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.weeklyRank === 1 ? 1 : 0, max: 1 }),
  },
  {
    id: 'weekly_star',
    name: 'Weekly Star',
    description: '#2 on weekly leaderboard',
    icon: '🥈',
    category: BADGE_CATEGORIES.LEADERBOARD,
    tier: BADGE_TIERS.SILVER,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.weeklyRank === 2 ? 1 : 0, max: 1 }),
  },
  {
    id: 'weekly_rising',
    name: 'Weekly Rising',
    description: '#3 on weekly leaderboard',
    icon: '🥉',
    category: BADGE_CATEGORIES.LEADERBOARD,
    tier: BADGE_TIERS.BRONZE,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.weeklyRank === 3 ? 1 : 0, max: 1 }),
  },
  {
    id: 'top_10',
    name: 'Top 10',
    description: 'Top 10 contributor',
    icon: '📊',
    category: BADGE_CATEGORIES.LEADERBOARD,
    tier: BADGE_TIERS.SILVER,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.weeklyRank <= 10 && stats.weeklyRank > 0 ? 1 : 0, max: 1 }),
  },

  // ==================== MILESTONE BADGES ====================
  {
    id: 'birthday',
    name: 'Birthday',
    description: '1 year on Pin-It',
    icon: '🎂',
    category: BADGE_CATEGORIES.MILESTONE,
    tier: BADGE_TIERS.SILVER,
    criteria: 365,
    getProgress: (stats) => ({ current: stats.accountAgeDays || 0, max: 365 }),
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: '2 years on Pin-It',
    icon: '🏅',
    category: BADGE_CATEGORIES.MILESTONE,
    tier: BADGE_TIERS.GOLD,
    criteria: 730,
    getProgress: (stats) => ({ current: stats.accountAgeDays || 0, max: 730 }),
  },
  {
    id: 'century',
    name: 'Century',
    description: '100 total points',
    icon: '💯',
    category: BADGE_CATEGORIES.MILESTONE,
    tier: BADGE_TIERS.BRONZE,
    criteria: 100,
    getProgress: (stats) => ({ current: stats.totalPoints || 0, max: 100 }),
  },
  {
    id: '500_club',
    name: '500 Club',
    description: '500 total points',
    icon: '🎯',
    category: BADGE_CATEGORIES.MILESTONE,
    tier: BADGE_TIERS.SILVER,
    criteria: 500,
    getProgress: (stats) => ({ current: stats.totalPoints || 0, max: 500 }),
  },
  {
    id: 'hall_of_fame',
    name: 'Hall of Fame',
    description: '1000+ total points',
    icon: '🏆',
    category: BADGE_CATEGORIES.MILESTONE,
    tier: BADGE_TIERS.DIAMOND,
    criteria: 1000,
    getProgress: (stats) => ({ current: stats.totalPoints || 0, max: 1000 }),
  },

  // ==================== COMMUNITY IMPACT BADGES ====================
  {
    id: 'helpful',
    name: 'Helpful',
    description: 'Comment received 10+ likes',
    icon: '❤️',
    category: BADGE_CATEGORIES.IMPACT,
    tier: BADGE_TIERS.SILVER,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.commentsWith10Likes || 0, max: 1 }),
  },
  {
    id: 'collaborator',
    name: 'Collaborator',
    description: 'Pin received 10+ comments',
    icon: '🤝',
    category: BADGE_CATEGORIES.IMPACT,
    tier: BADGE_TIERS.SILVER,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.pinsWith10Comments || 0, max: 1 }),
  },
  {
    id: 'influencer',
    name: 'Influencer',
    description: 'Pin saved by 10+ users',
    icon: '📢',
    category: BADGE_CATEGORIES.IMPACT,
    tier: BADGE_TIERS.GOLD,
    criteria: 1,
    getProgress: (stats) => ({ current: stats.pinsWith10Saves || 0, max: 1 }),
  },
];

/**
 * Compute all badges for a user based on their stats.
 * Returns an array of badge objects with earned status and progress.
 * 
 * @param {Object} stats - User statistics object
 * @returns {Array} Array of badge objects with earned status and progress
 */
export function computeBadges(stats = {}) {
  return BADGE_DEFINITIONS.map((badge) => {
    const progress = badge.getProgress(stats);
    const earned = progress.current >= progress.max;
    const percentage = Math.min(100, Math.round((progress.current / progress.max) * 100));

    return {
      ...badge,
      earned,
      progress: {
        ...progress,
        percentage,
      },
    };
  });
}

/**
 * Get only earned badges for a user.
 * 
 * @param {Object} stats - User statistics object
 * @returns {Array} Array of earned badge objects
 */
export function getEarnedBadges(stats = {}) {
  return computeBadges(stats).filter((badge) => badge.earned);
}

/**
 * Get badges grouped by category.
 * 
 * @param {Object} stats - User statistics object
 * @returns {Object} Badges grouped by category
 */
export function getBadgesByCategory(stats = {}) {
  const badges = computeBadges(stats);
  const grouped = {};

  Object.values(BADGE_CATEGORIES).forEach((category) => {
    grouped[category] = badges.filter((badge) => badge.category === category);
  });

  return grouped;
}

/**
 * Get badge counts for a user.
 * 
 * @param {Object} stats - User statistics object
 * @returns {Object} Counts of earned, total, and by tier
 */
export function getBadgeCounts(stats = {}) {
  const badges = computeBadges(stats);
  const earned = badges.filter((b) => b.earned);

  return {
    earned: earned.length,
    total: badges.length,
    byTier: {
      bronze: earned.filter((b) => b.tier === BADGE_TIERS.BRONZE).length,
      silver: earned.filter((b) => b.tier === BADGE_TIERS.SILVER).length,
      gold: earned.filter((b) => b.tier === BADGE_TIERS.GOLD).length,
      diamond: earned.filter((b) => b.tier === BADGE_TIERS.DIAMOND).length,
    },
    byCategory: Object.values(BADGE_CATEGORIES).reduce((acc, category) => {
      acc[category] = earned.filter((b) => b.category === category).length;
      return acc;
    }, {}),
  };
}

/**
 * Get the next badge to earn (closest to completion).
 * 
 * @param {Object} stats - User statistics object
 * @returns {Object|null} The next badge to earn or null if all earned
 */
export function getNextBadgeToEarn(stats = {}) {
  const badges = computeBadges(stats);
  const notEarned = badges
    .filter((b) => !b.earned)
    .sort((a, b) => b.progress.percentage - a.progress.percentage);

  return notEarned[0] || null;
}