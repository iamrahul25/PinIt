/**
 * Backend API base URL.
 * Set VITE_BACKEND_URL in .env to point to your backend.
 * Leave empty or unset to use relative URLs (works with Vite proxy in dev).
 */
export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || '';

/** Discord invite URL for "Join Discussion". Set VITE_DISCORD_INVITE in .env. */
export const DISCORD_INVITE_URL = import.meta.env.VITE_DISCORD_INVITE || 'https://discord.gg/fSYyytuszp'
