/**
 * Device Fingerprint Utility
 * Creates a unique fingerprint based on browser and device characteristics
 * This helps prevent multiple votes from the same device even in incognito mode
 */

// Simple hash function (since we can't use crypto in browser without additional libraries)
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
};

/**
 * Generates a device fingerprint based on various browser/device characteristics
 * @returns {string} A unique device fingerprint
 */
export const generateDeviceFingerprint = () => {
  const components = [];

  // User Agent
  components.push(navigator.userAgent || 'unknown');

  // Screen properties
  components.push(`${window.screen.width}x${window.screen.height}`);
  components.push(`${window.screen.availWidth}x${window.screen.availHeight}`);
  components.push(window.screen.colorDepth || 'unknown');
  components.push(window.screen.pixelDepth || 'unknown');

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown');

  // Language
  components.push(navigator.language || 'unknown');
  components.push(navigator.languages?.join(',') || 'unknown');

  // Platform
  components.push(navigator.platform || 'unknown');

  // Hardware concurrency (CPU cores)
  components.push(navigator.hardwareConcurrency || 'unknown');

  // Device memory (if available)
  if (navigator.deviceMemory) {
    components.push(navigator.deviceMemory);
  }

  // Canvas fingerprint (basic)
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Device fingerprint', 2, 2);
    components.push(canvas.toDataURL().substring(0, 100));
  } catch (e) {
    components.push('canvas-unsupported');
  }

  // WebGL fingerprint (basic)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
        components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
      }
    }
  } catch (e) {
    components.push('webgl-unsupported');
  }

  // Touch support
  components.push('ontouchstart' in window ? 'touch' : 'no-touch');

  // Local storage support
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
    components.push('localStorage');
  } catch (e) {
    components.push('no-localStorage');
  }

  // Session storage support
  try {
    sessionStorage.setItem('test', 'test');
    sessionStorage.removeItem('test');
    components.push('sessionStorage');
  } catch (e) {
    components.push('no-sessionStorage');
  }

  // Combine all components and create hash
  const fingerprintString = components.join('|');
  
  // Store in localStorage for persistence (even across sessions)
  try {
    let storedFingerprint = localStorage.getItem('deviceFingerprint');
    if (!storedFingerprint) {
      storedFingerprint = simpleHash(fingerprintString);
      localStorage.setItem('deviceFingerprint', storedFingerprint);
    }
    return storedFingerprint;
  } catch (e) {
    // If localStorage fails, return hash directly
    return simpleHash(fingerprintString);
  }
};

/**
 * Gets or generates a device fingerprint
 * Uses cached version if available, otherwise generates new one
 * @returns {string} Device fingerprint
 */
export const getDeviceFingerprint = () => {
  try {
    let fingerprint = localStorage.getItem('deviceFingerprint');
    if (!fingerprint) {
      fingerprint = generateDeviceFingerprint();
    }
    return fingerprint;
  } catch (e) {
    // Fallback if localStorage is not available
    return generateDeviceFingerprint();
  }
};
