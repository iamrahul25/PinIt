import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import MapView from './components/MapView';
import PinForm from './components/PinForm';
import PinDetails from './components/PinDetails';
import PinListPanel from './components/PinListPanel';
import { reverseGeocode } from './utils/geocode';
import { API_BASE_URL } from './config';
import './App.css';

function App() {
  const { isLoaded: userLoaded, isSignedIn, user } = useUser();
  const { isLoaded: authLoaded, getToken, signOut } = useClerkAuth();
  const { pinId: urlPinId } = useParams();
  const navigate = useNavigate();
  const [pins, setPins] = useState([]);
  const [selectedPin, setSelectedPin] = useState(null);
  const [focusedPinId, setFocusedPinId] = useState(null);
  const [hoveredPinId, setHoveredPinId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formLocation, setFormLocation] = useState(null);
  const [isAddPinMode, setIsAddPinMode] = useState(false);
  const [tempPinLocation, setTempPinLocation] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [savedPinIds, setSavedPinIds] = useState([]);

  const loading = !userLoaded || !authLoaded;

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

  useEffect(() => {
    if (!userLoaded) return;
    if (!isSignedIn) {
      navigate('/login', { replace: true });
    }
  }, [userLoaded, isSignedIn, navigate]);

  useEffect(() => {
    if (!isSignedIn || !authLoaded) return;
    fetchPins();
    fetchSavedPinIds();
  }, [isSignedIn, authLoaded, fetchPins, fetchSavedPinIds]);

  useEffect(() => {
    if (!isSignedIn || !authLoaded || !urlPinId) return;
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
  }, [authFetch, authLoaded, isSignedIn, pins, urlPinId]);

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

  // When user clicks a pin card in All Pins panel: only highlight pin and move map (no popup)
  const handlePinFocus = (pin) => {
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
    fetchPins();
    setShowForm(false);
    setFormLocation(null);
    setTempPinLocation(null);
    setIsAddPinMode(false);
  };

  const handleDetailsClose = () => {
    navigate('/');
    setSelectedPin(null);
    setIsAddPinMode(false);
    setFocusedPinId(null);
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
    const title = `Pin-It: ${pin.problemType}`;
    const text = pin.description
      ? `${pin.problemType} - ${pin.description.substring(0, 100)}${pin.description.length > 100 ? '...' : ''}`
      : pin.problemType;
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

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="App app-loading">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isSignedIn) return null;

  return (
    <div className="App">
      <header className="app-header">
        <div>
          <h1>📍 Pin-It</h1>
          <p>Report civic issues in your area</p>
        </div>
        <div className="app-user">
          <span>{user?.fullName || user?.primaryEmailAddress?.emailAddress}</span>
          <button type="button" className="logout-btn" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>
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
        />
        <button 
          className={`add-pin-btn ${isAddPinMode ? 'active' : ''}`}
          onClick={handleAddButtonClick}
          title="Add a new problem report"
        >
          <span className="add-icon">+</span>
        </button>
        {showForm && (
          <PinForm
            location={formLocation}
            onClose={handleFormClose}
            onSubmit={handleFormSubmit}
            user={user}
          />
        )}
        {selectedPin && (
          <PinDetails
            pin={selectedPin}
            onClose={handleDetailsClose}
            user={user}
            onUpdate={fetchPins}
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
          isOpen={isPanelOpen}
          onToggle={handleTogglePanel}
        />
      </div>
    </div>
  );
}

export default App;
