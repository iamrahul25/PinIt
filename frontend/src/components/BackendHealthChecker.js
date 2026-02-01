import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import './BackendHealthChecker.css';

const HEALTH_CHECK_TIMEOUT_MS = 6000;

/**
 * Runs a single health check: GET /api/health, expects 200.
 * Fails on network error, timeout, or non-2xx response.
 */
async function checkBackendHealth() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}

/**
 * On mount, checks backend health in parallel with app load.
 * If backend is not reachable, shows a modal with Reload / Close.
 */
function BackendHealthChecker({ children }) {
  const [backendDown, setBackendDown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkBackendHealth().then((ok) => {
      if (!cancelled && !ok) setBackendDown(true);
    });
    return () => { cancelled = true; };
  }, []);

  const handleReload = () => window.location.reload();
  const handleClose = () => setBackendDown(false);

  return (
    <>
      {children}
      {backendDown && (
        <div className="backend-health-overlay" role="alert" aria-live="assertive">
          <div className="backend-health-modal">
            <p className="backend-health-message">Backend is not running.</p>
            <p className="backend-health-hint">Start the backend server or check your connection.</p>
            <div className="backend-health-actions">
              <button type="button" className="backend-health-btn primary" onClick={handleReload}>
                Reload
              </button>
              <button type="button" className="backend-health-btn secondary" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default BackendHealthChecker;
