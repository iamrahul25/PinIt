import React, { useEffect, useRef } from 'react';
import './Toast.css';

/**
 * Reusable toast notification. Fixed bottom-right, auto-hides after duration.
 * @param {boolean} visible - Whether the toast is visible
 * @param {string} message - Message to show
 * @param {'success'|'error'} type - Visual variant
 * @param {number} autoHideMs - Auto-hide after this many ms (default 4500, use 3000-6000)
 * @param {function} onClose - Called when toast is closed (auto or manual)
 */
const Toast = ({ visible, message, type = 'success', autoHideMs = 4500, onClose }) => {
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!visible || !message || !onClose) return;
    timeoutRef.current = setTimeout(() => {
      onClose();
    }, autoHideMs);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [visible, message, autoHideMs, onClose]);

  if (!visible || !message) return null;

  const icon = type === 'success' ? 'check_circle' : 'error';

  return (
    <div
      className={`toast toast-${type}`}
      role="alert"
      aria-live="polite"
    >
      <span className="toast-icon material-icons-round" aria-hidden="true">{icon}</span>
      <p className="toast-message">{message}</p>
      <button
        type="button"
        className="toast-dismiss"
        onClick={onClose}
        aria-label="Dismiss notification"
      >
        <span className="material-icons-round">close</span>
      </button>
    </div>
  );
};

export default Toast;
