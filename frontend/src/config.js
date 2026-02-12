/**
 * Backend API base URL.
 * Set REACT_APP_BACKEND_URL in .env to point to your backend.
 * Leave empty or unset to use relative URLs (works with package.json proxy in dev).
 */
export const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

/** Discord invite URL for "Join Discussion". Set REACT_APP_DISCORD_INVITE in .env. */
export const DISCORD_INVITE_URL = process.env.REACT_APP_DISCORD_INVITE || 'https://discord.gg/pinit';
