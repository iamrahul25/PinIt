import React, { useState, useEffect } from 'react';
import MapView from './components/MapView';
import PinForm from './components/PinForm';
import PinDetails from './components/PinDetails';
import PinListPanel from './components/PinListPanel';
import { reverseGeocode } from './utils/geocode';
import './App.css';

function App() {
  const [pins, setPins] = useState([]);
  const [selectedPin, setSelectedPin] = useState(null);
  const [focusedPinId, setFocusedPinId] = useState(null); // which pin is highlighted on map (panel click = focus + fly)
  const [hoveredPinId, setHoveredPinId] = useState(null); // which pin card is hovered in panel (highlight on map only, no fly)
  const [showForm, setShowForm] = useState(false);
  const [formLocation, setFormLocation] = useState(null);
  const [isAddPinMode, setIsAddPinMode] = useState(false);
  const [tempPinLocation, setTempPinLocation] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [userId] = useState(() => {
    // Generate or retrieve user ID (in production, use proper auth)
    let id = localStorage.getItem('userId');
    if (!id) {
      id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('userId', id);
    }
    return id;
  });

  useEffect(() => {
    fetchPins();
  }, []);

  const fetchPins = async () => {
    try {
      const response = await fetch('/api/pins');
      const data = await response.json();
      setPins(data);
    } catch (error) {
      console.error('Error fetching pins:', error);
    }
  };

  const handleAddButtonClick = () => {
    if (isAddPinMode) {
      // Clicking X cancels add-pin mode
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
    setSelectedPin(null);
    setIsAddPinMode(false);
    setFocusedPinId(null);
  };

  const handleTogglePanel = () => {
    setIsPanelOpen(prev => !prev);
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>📍 Pin-It</h1>
        <p>Report civic issues in your area</p>
      </header>
      <div className="map-container">
        <MapView
          pins={pins}
          onMapClick={handleMapClick}
          onPinClick={handlePinClick}
          highlightedPinId={focusedPinId || hoveredPinId}
          hoveredPinId={hoveredPinId}
          flyToPinId={focusedPinId}
          userId={userId}
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
            userId={userId}
          />
        )}
        {selectedPin && (
          <PinDetails
            pin={selectedPin}
            onClose={handleDetailsClose}
            userId={userId}
            onUpdate={fetchPins}
          />
        )}
        <PinListPanel
          pins={pins}
          focusedPinId={focusedPinId}
          hoveredPinId={hoveredPinId}
          onPinFocus={handlePinFocus}
          onShowDetails={handleShowDetails}
          onPinHover={handlePinHover}
          onPinHoverEnd={handlePinHoverEnd}
          isOpen={isPanelOpen}
          onToggle={handleTogglePanel}
        />
      </div>
    </div>
  );
}

export default App;
