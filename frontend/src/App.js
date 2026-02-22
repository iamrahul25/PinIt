import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import MapView from './components/MapView';
import PinForm from './components/PinForm';
import PinDetails from './components/PinDetails';
import Toast from './components/Toast';
import Notification from './components/Notification';
import PinListPanel from './components/PinListPanel';
import UserProfile from './pages/UserProfile';
import Suggestions from './pages/Suggestions';
import NGOs from './pages/NGOs';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import NgoDetail from './pages/NgoDetail';
import NgoEdit from './pages/NgoEdit';
import Leaderboard from './pages/Leaderboard';
import { reverseGeocode } from './utils/geocode';
import { checkGraphicsAcceleration } from './utils/graphics';
import { API_BASE_URL, DISCORD_INVITE_URL } from './config';
import './App.css';

function App() {
  const { loading: authLoading, isSignedIn, user, getToken, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const urlPinId = (location.pathname.match(/^\/pin\/([^/]+)$/) || [])[1];
  const isProfilePage = location.pathname === '/profile';
  const isSuggestionsPage = location.pathname === '/suggestions';
  const isNgosPage = location.pathname === '/ngos';
  const isEventsPage = location.pathname === '/events';
  const isEventDetailPage = location.pathname.startsWith('/events/') && location.pathname !== '/events';
  const isNgoDetailPage = location.pathname.match(/^\/ngo\/[^/]+$/);
  const isNgoEditPage = location.pathname.startsWith('/ngos/') && location.pathname.endsWith('/edit');
  const isLeaderboardPage = location.pathname === '/leaderboard';
  const [pins, setPins] = useState([]);
  const [selectedPin, setSelectedPin] = useState(null);
  const [focusedPinId, setFocusedPinId] = useState(null);
  const [hoveredPinId, setHoveredPinId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formLocation, setFormLocation] = useState(null);
  const [isAddPinMode, setIsAddPinMode] = useState(false);
  const [tempPinLocation, setTempPinLocation] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [savedPinIds, setSavedPinIds] = useState([]);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [notifications, setNotifications] = useState([]);
  const [installPrompt, setInstallPrompt] = useState(null);

  const addNotification = useCallback((type, message) => {
    const id = Date.now();
    setNotifications(prev => {
      // Avoid duplicate messages
      if (prev.some(n => n.message === message)) {
        return prev;
      }
      return [...prev, { id, type, message }];
    });
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const loading = authLoading;

  const showToast = (message, type = 'success', autoHideMs = 4500) => {
    setToast({ visible: true, message, type, autoHideMs: autoHideMs ?? 4500 });
  };
  const hideToast = () => setToast((t) => ({ ...t, visible: false }));

  const getAuthHeaders = useCallback(async (headers = {}) => {
    const token = await getToken();
    if (!token) {
      throw new Error('Unable to acquire auth token');
    }
    return {
      ...headers,
      Authorization: `Bearer ${token}`
    };
  }, [getToken]);

  const authFetch = useCallback(async (url, options = {}) => {
    const headers = await getAuthHeaders(options.headers || {});
    return fetch(url, { ...options, headers });
  }, [getAuthHeaders]);

  const fetchPins = useCallback(async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/pins`);
      if (!response.ok) {
        throw new Error('Failed to fetch pins');
      }
      const data = await response.json();
      setPins(data);
    } catch (error) {
      console.error('Error fetching pins:', error);
    }
  }, [authFetch]);

  const fetchSavedPinIds = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await authFetch(`${API_BASE_URL}/api/pins/saved`);
      if (!response.ok) {
        throw new Error('Failed to fetch saved pins');
      }
      const data = await response.json();
      setSavedPinIds(data.pinIds || []);
    } catch (error) {
      console.error('Error fetching saved pins:', error);
    }
  }, [authFetch, user?.id]);

  const syncUserData = useCallback(async () => {
    if (!user?.id || authLoading) return;
    try {
      const email = user.email ?? '';
      const username = user.fullName || email;
      const response = await authFetch(`${API_BASE_URL}/api/users/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          username,
          emailVerified: true
        })
      });
      if (!response.ok) {
        throw new Error('Failed to sync user data');
      }
    } catch (error) {
      console.error('Error syncing user data:', error);
    }
  }, [authFetch, authLoading, user?.id, user?.email, user?.fullName]);

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, isSignedIn, navigate]);

  useEffect(() => {
    if (!isSignedIn || authLoading) return;
    syncUserData();
    fetchPins();
    fetchSavedPinIds();
  }, [isSignedIn, authLoading, syncUserData, fetchPins, fetchSavedPinIds]);

  useEffect(() => {
    const isAccelerationOn = checkGraphicsAcceleration();
    if (isAccelerationOn === false) { // Can also be true or null
      addNotification(
        'warning',
        'Graphics acceleration is disabled in your browser.'
      );
    }
  }, [addNotification]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('mobile-menu-open');
    } else {
      document.body.classList.remove('mobile-menu-open');
    }
    return () => document.body.classList.remove('mobile-menu-open');
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!isSignedIn || authLoading || !urlPinId) return;
    const existingPin = pins.find((p) => p._id === urlPinId);
    if (existingPin) {
      setSelectedPin(existingPin);
      setFocusedPinId(existingPin._id);
      return;
    }
    const fetchPinById = async () => {
      try {
        const response = await authFetch(`${API_BASE_URL}/api/pins/${urlPinId}`);
        if (!response.ok) return;
        const pin = await response.json();
        setPins((prev) => {
          const alreadyPresent = prev.some((p) => p._id === pin._id);
          return alreadyPresent ? prev : [...prev, pin];
        });
        setSelectedPin(pin);
        setFocusedPinId(pin._id);
      } catch (error) {
        console.error('Error fetching shared pin:', error);
      }
    };
    fetchPinById();
  }, [authFetch, authLoading, isSignedIn, pins, urlPinId]);

  const handleAddButtonClick = () => {
    if (!isSignedIn) {
      navigate('/login');
      return;
    }
    if (isAddPinMode) {
      setIsAddPinMode(false);
      setTempPinLocation(null);
    } else {
      setIsAddPinMode(true);
      setSelectedPin(null);
      setShowForm(false);
    }
  };

  const handleMapClick = (e) => {
    if (isAddPinMode) {
      const location = { lat: e.latlng.lat, lng: e.latlng.lng };
      setTempPinLocation(location);
      setFormLocation(location);
      setShowForm(true);
      setIsAddPinMode(false);
      setSelectedPin(null);
      reverseGeocode(location.lat, location.lng).then((address) => {
        setFormLocation((prev) => (prev ? { ...prev, address } : prev));
      });
    }
  };

  // When user clicks a pin on the map: show full details popup and highlight on map
  const handlePinClick = (pin) => {
    navigate(`/pin/${pin._id}`);
    setSelectedPin(pin);
    setFocusedPinId(pin._id);
    setShowForm(false);
    setIsAddPinMode(false);
    setTempPinLocation(null);
  };

  // When user clicks a pin card in All Pins panel: close full-detail popup, highlight pin and move map
  const handlePinFocus = (pin) => {
    navigate('/');
    setSelectedPin(null);
    setFocusedPinId(pin._id);
    setShowForm(false);
    setIsAddPinMode(false);
  };

  // When user clicks "Full details" in panel: show full details popup (and focus map on that pin)
  const handleShowDetails = (pin) => {
    navigate(`/pin/${pin._id}`);
    setSelectedPin(pin);
    setFocusedPinId(pin._id);
  };

  // When user hovers a pin card in panel: highlight that pin on map (no fly)
  const handlePinHover = (pin) => setHoveredPinId(pin?._id ?? null);
  const handlePinHoverEnd = () => setHoveredPinId(null);

  const handleFormClose = () => {
    setShowForm(false);
    setFormLocation(null);
    setTempPinLocation(null);
    setIsAddPinMode(false);
  };

  const handleFormSubmit = () => {
    showToast('Report submitted successfully!', 'success');
    fetchPins();
    setShowForm(false);
    setFormLocation(null);
    setTempPinLocation(null);
    setIsAddPinMode(false);
  };

  const handleFormError = (message) => {
    showToast(message || 'Failed to create report. Please try again.', 'error');
  };

  const handleDetailsClose = () => {
    navigate('/');
    setSelectedPin(null);
    setIsAddPinMode(false);
    setFocusedPinId(null);
  };

  const handleViewPinOnMap = (pin) => {
    navigate('/');
    setSelectedPin(null);
    setFocusedPinId(pin._id);
    setIsPanelOpen(false);
  };

  const handleTogglePanel = () => {
    setIsPanelOpen(prev => !prev);
  };

  const handleSavePin = (pin) => {
    setSavedPinIds((prev) => (prev.includes(pin._id) ? prev : [...prev, pin._id]));
  };

  const handleUnsavePin = (pin) => {
    setSavedPinIds((prev) => prev.filter((id) => id !== pin._id));
  };

  const handleSharePin = async (pin) => {
    const url = `${window.location.origin}/pin/${pin._id}`;
    const heading = pin.problemHeading || pin.problemType;
    const title = `Pin-It: ${heading}`;
    const text = pin.description
      ? `${heading} - ${pin.description.substring(0, 100)}${pin.description.length > 100 ? '...' : ''}`
      : heading;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
        if (err.name !== 'AbortError') {
          navigator.clipboard?.writeText(url);
        }
      }
    } else {
      navigator.clipboard?.writeText(url);
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    closeMobileMenu();
  };

  if (loading) {
    return (
      <div className="App app-loading">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isSignedIn) return null;

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleNavTo = (path) => {
    navigate(path);
    closeMobileMenu();
  };

  return (
    <div className="App">
      <div className="fixed bottom-0 right-3 z-[9999] flex flex-col-reverse items-end">
        {notifications.map(n => (
          <Notification
            key={n.id}
            type={n.type}
            message={n.message}
            onClose={() => removeNotification(n.id)}
          />
        ))}
      </div>
      <header className="app-header">
        <button
          type="button"
          className="app-brand"
          onClick={() => { navigate('/'); closeMobileMenu(); }}
          title="Home"
        >
          <span className="app-brand-icon" aria-hidden="true">
            <svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="app-brand-text">
            <span className="app-brand-title">Pin-It</span>
            <span className="app-brand-tagline">Report civic issues</span>
          </span>
        </button>

        <button
          type="button"
          className="header-hamburger-btn"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          <span className="header-hamburger-bar" />
          <span className="header-hamburger-bar" />
          <span className="header-hamburger-bar" />
        </button>

        <div className="app-user header-desktop-nav">
          <span className="app-user-name">{user?.fullName || user?.email}</span>
          <button
            type="button"
            className="profile-avatar-btn"
            onClick={() => navigate('/profile')}
            title="Your profile"
            aria-label="Profile"
          >
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" className="app-user-avatar" referrerPolicy="no-referrer" />
            ) : (
              <span className="app-user-avatar-placeholder">
                {(user?.fullName || user?.email || '?').charAt(0).toUpperCase()}
              </span>
            )}
          </button>
          <button
            type="button"
            className="header-nav-btn"
            onClick={() => navigate('/suggestions')}
            title="Suggestions"
          >
            Suggestions
          </button>
          <button
            type="button"
            className="header-nav-btn"
            onClick={() => navigate('/ngos')}
            title="NGO's"
          >
            NGO's
          </button>
          <button
            type="button"
            className="header-nav-btn"
            onClick={() => navigate('/events')}
            title="Events"
          >
            Events
          </button>
          <button
            type="button"
            className="header-nav-btn"
            onClick={() => navigate('/leaderboard')}
            title="Leaderboard"
          >
            🏆 Leaderboard
          </button>
          <button type="button" className="logout-btn" onClick={handleSignOut}>
            <span className="logout-btn-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            Sign out
          </button>
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="header-nav-btn header-discord-btn"
            title="Join Discussion on Discord"
          >
            <span className="header-discord-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </span>
            Join Discussion
          </a>
        </div>
      </header>

      <div
        className={`header-mobile-overlay ${mobileMenuOpen ? 'open' : ''}`}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />
      <nav className={`header-mobile-menu ${mobileMenuOpen ? 'open' : ''}`} aria-label="Main navigation">
        <button
          type="button"
          className="header-mobile-close-btn"
          onClick={closeMobileMenu}
          aria-label="Close menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <button
          type="button"
          className="header-mobile-nav-btn header-mobile-menu-user-btn"
          onClick={() => handleNavTo('/profile')}
          title="Your profile"
          aria-label="Profile"
        >
          <span className="app-user-name">{user?.fullName || user?.email}</span>
          <span className="header-mobile-user-avatar">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="header-mobile-user-avatar-placeholder">
                {(user?.fullName || user?.email || '?').charAt(0).toUpperCase()}
              </span>
            )}
          </span>
        </button>
        <button type="button" className="header-mobile-nav-btn" onClick={() => handleNavTo('/')}>
          Home
        </button>
        <button type="button" className="header-mobile-nav-btn" onClick={() => handleNavTo('/suggestions')}>
          Suggestions
        </button>
        <button type="button" className="header-mobile-nav-btn" onClick={() => handleNavTo('/ngos')}>
          NGO's
        </button>
        <button type="button" className="header-mobile-nav-btn" onClick={() => handleNavTo('/events')}>
          Events
        </button>
        <button type="button" className="header-mobile-nav-btn" onClick={() => handleNavTo('/leaderboard')}>
          🏆 Leaderboard
        </button>
        <a
          href={DISCORD_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="header-mobile-nav-btn header-mobile-discord"
          onClick={closeMobileMenu}
          title="Join Discussion on Discord"
        >
          <span className="header-discord-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </span>
          Join Discussion
        </a>
        {installPrompt && (
          <button
            type="button"
            className="header-mobile-nav-btn header-mobile-install-app"
            onClick={handleInstallApp}
            title="Install Pin-It as app"
          >
            <span className="header-install-app-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </span>
            Install as App
          </button>
        )}
        <button type="button" className="header-mobile-nav-btn header-mobile-logout" onClick={() => { handleSignOut(); closeMobileMenu(); }}>
          <span className="logout-btn-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </span>
          Sign out
        </button>
      </nav>
      {isProfilePage ? (
        <div className="app-profile-container">
          <UserProfile />
        </div>
      ) : isSuggestionsPage ? (
        <div className="app-profile-container">
          <Suggestions />
        </div>
      ) : isNgosPage ? (
        <div className="app-profile-container">
          <NGOs />
        </div>
      ) : isEventDetailPage ? (
        <div className="app-profile-container">
          <EventDetail />
        </div>
      ) : isEventsPage ? (
        <div className="app-profile-container">
          <Events />
        </div>
      ) : isNgoDetailPage ? (
        <div className="app-profile-container">
          <NgoDetail />
        </div>
      ) : isNgoEditPage ? (
        <div className="app-profile-container">
          <NgoEdit />
        </div>
      ) : isLeaderboardPage ? (
        <div className="app-profile-container">
          <Leaderboard />
        </div>
      ) : (
        <div className="map-container">
          <MapView
            pins={pins}
            onMapClick={handleMapClick}
            onPinClick={handlePinClick}
            highlightedPinId={focusedPinId || hoveredPinId}
            hoveredPinId={hoveredPinId}
            flyToPinId={focusedPinId}
            isAddPinMode={isAddPinMode}
            tempPinLocation={tempPinLocation}
            onCancelAddPin={handleAddButtonClick}
          />
          <button
            className={`add-pin-btn ${isAddPinMode ? 'active' : ''}`}
            onClick={handleAddButtonClick}
            title="Add a new problem report"
          >
            <span className="material-icons-round add-pin-btn-icon">add_location</span>
            <span className="add-pin-btn-text">Pin an Issue</span>
          </button>
          {showForm && (
            <PinForm
              location={formLocation}
              onClose={handleFormClose}
              onSubmit={handleFormSubmit}
              onError={handleFormError}
              user={user}
            />
          )}
          <Toast
            visible={toast.visible}
            message={toast.message}
            type={toast.type}
            autoHideMs={toast.autoHideMs ?? 4500}
            onClose={hideToast}
          />
          {selectedPin && (
            <PinDetails
              pin={selectedPin}
              pins={pins}
              onSelectPin={handleShowDetails}
              onClose={handleDetailsClose}
              onViewOnMap={handleViewPinOnMap}
              user={user}
              onUpdate={fetchPins}
              onPinUpdated={setSelectedPin}
              shareUrl={`${window.location.origin}/pin/${selectedPin._id}`}
              isSaved={savedPinIds.includes(selectedPin._id)}
              onSave={handleSavePin}
              onUnsave={handleUnsavePin}
            />
          )}
          <PinListPanel
            pins={pins.map((p) => ({ ...p, saved: savedPinIds.includes(p._id) }))}
            user={user}
            focusedPinId={focusedPinId}
            hoveredPinId={hoveredPinId}
            onPinFocus={handlePinFocus}
            onShowDetails={handleShowDetails}
            onPinHover={handlePinHover}
            onPinHoverEnd={handlePinHoverEnd}
            onSharePin={handleSharePin}
            onSavePin={handleSavePin}
            onUnsavePin={handleUnsavePin}
            isOpen={isPanelOpen}
            onToggle={handleTogglePanel}
          />
        </div>
      )}
    </div>
  );
}

export default App;
