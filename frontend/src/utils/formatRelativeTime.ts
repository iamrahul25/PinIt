/**
 * Human-readable relative time for a past date (e.g. "4 days ago", "1 hour ago").
 * For dates older than 7 days, returns a short locale date.
 */
export function formatRelativeTimeAgo(isoDate: string | Date | null | undefined): string {
  if (isoDate == null) return '—';
  const date = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
  if (Number.isNaN(date.getTime())) return '—';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) {
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  const diffInSeconds = Math.floor(diffMs / 1000);
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) {
    const m = Math.floor(diffInSeconds / 60);
    return m === 1 ? '1 minute ago' : `${m} minutes ago`;
  }
  if (diffInSeconds < 86400) {
    const h = Math.floor(diffInSeconds / 3600);
    return h === 1 ? '1 hour ago' : `${h} hours ago`;
  }

  const days = Math.floor(diffInSeconds / 86400);
  if (diffInSeconds < 604800) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }

  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString(undefined, opts);
}
