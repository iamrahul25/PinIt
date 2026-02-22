import React, { useEffect, useRef } from 'react';

/**
 * Reusable toast notification with 4 types and 6 position options.
 *
 * @param {boolean}  visible    - Whether the toast is visible
 * @param {string}   message    - Message to display
 * @param {'success'|'error'|'warning'|'info'} type - Visual variant (default: 'info')
 * @param {number}   autoHideMs - Auto-hide delay in ms (default: 4500)
 * @param {function} onClose    - Callback when toast is dismissed (auto or manual)
 * @param {'top-left'|'top-center'|'top-right'|'bottom-left'|'bottom-center'|'bottom-right'} position
 */
const Toast = ({
  visible,
  message,
  type = 'info',
  autoHideMs = 4500,
  onClose,
  position = 'bottom-right',
}) => {
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!visible || !message || !onClose) return;
    timeoutRef.current = setTimeout(onClose, autoHideMs);
    return () => clearTimeout(timeoutRef.current);
  }, [visible, message, autoHideMs, onClose]);

  if (!visible || !message) return null;

  /* ── position → CSS ───────────────────────────────────────── */
  const [vEdge, hEdge] = position.split('-'); // e.g. 'bottom', 'right'
  const positionStyle = {
    position: 'fixed',
    zIndex: 9999,
    ...(vEdge === 'top' ? { top: '20px' } : { bottom: '20px' }),
    ...(hEdge === 'left'
      ? { left: '20px' }
      : hEdge === 'right'
      ? { right: '20px' }
      : { left: '50%', transform: 'translateX(-50%)' }),
  };

  /* ── type config ──────────────────────────────────────────── */
  const config = {
    success: {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="9 12 11.5 14.5 15.5 9.5" />
        </svg>
      ),
      accent: '#22c55e',
      bg: 'rgba(16,24,16,0.96)',
      ring: 'rgba(34,197,94,0.35)',
      label: 'Success',
    },
    error: {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
      accent: '#ef4444',
      bg: 'rgba(24,12,12,0.96)',
      ring: 'rgba(239,68,68,0.35)',
      label: 'Error',
    },
    warning: {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      accent: '#f59e0b',
      bg: 'rgba(24,20,8,0.96)',
      ring: 'rgba(245,158,11,0.35)',
      label: 'Warning',
    },
    info: {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
      accent: '#3b82f6',
      bg: 'rgba(8,16,24,0.96)',
      ring: 'rgba(59,130,246,0.35)',
      label: 'Info',
    },
  };

  const { icon, accent, bg, ring, label } = config[type] ?? config.info;

  /* ── inline styles (no external CSS needed) ───────────────── */
  const styles = {
    wrapper: {
      ...positionStyle,
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      minWidth: '300px',
      maxWidth: '420px',
      padding: '14px 16px 14px 14px',
      background: bg,
      border: `1px solid ${ring}`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: '12px',
      boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${ring}, inset 0 1px 0 rgba(255,255,255,0.06)`,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      animation: 'toastSlideIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
    },
    iconWrap: {
      flexShrink: 0,
      width: '20px',
      height: '20px',
      color: accent,
      marginTop: '1px',
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    label: {
      display: 'block',
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: accent,
      marginBottom: '2px',
      lineHeight: 1,
    },
    message: {
      margin: 0,
      fontSize: '13.5px',
      lineHeight: '1.5',
      color: 'rgba(255,255,255,0.88)',
      fontWeight: 400,
      wordBreak: 'break-word',
    },
    dismiss: {
      flexShrink: 0,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '2px',
      color: 'rgba(255,255,255,0.35)',
      lineHeight: 1,
      borderRadius: '4px',
      transition: 'color 0.15s, background 0.15s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: '-1px',
    },
    progress: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      height: '2px',
      borderRadius: '0 0 12px 12px',
      background: accent,
      opacity: 0.6,
      animation: `toastProgress ${autoHideMs}ms linear forwards`,
    },
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap');

        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
        .toast-dismiss-btn:hover {
          color: rgba(255,255,255,0.85) !important;
          background: rgba(255,255,255,0.08) !important;
        }
      `}</style>

      <div style={{ ...styles.wrapper, position: 'fixed' }} role="alert" aria-live="polite">
        {/* Accent icon */}
        <span style={styles.iconWrap} aria-hidden="true">
          {icon}
        </span>

        {/* Body */}
        <div style={styles.body}>
          <span style={styles.label}>{label}</span>
          <p style={styles.message}>{message}</p>
        </div>

        {/* Dismiss */}
        <button
          type="button"
          className="toast-dismiss-btn"
          style={styles.dismiss}
          onClick={onClose}
          aria-label="Dismiss notification"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Auto-hide progress bar */}
        <div style={styles.progress} aria-hidden="true" />
      </div>
    </>
  );
};

export default Toast;