import React, { useState, useEffect } from 'react';
import MapView from './components/MapView';
import PinForm from './components/PinForm';
import PinDetails from './components/PinDetails';
import './App.css';

function App() {
  const [pins, setPins] = useState([]);
  const [selectedPin, setSelectedPin] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formLocation, setFormLocation] = useState(null);
  const [isAddPinMode, setIsAddPinMode] = useState(false);
  const [tempPinLocation, setTempPinLocation] = useState(null);
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
    setIsAddPinMode(true);
    setSelectedPin(null);
    setShowForm(false);
  };

  const handleMapClick = (e) => {
    if (isAddPinMode) {
      const location = { lat: e.latlng.lat, lng: e.latlng.lng };
      setTempPinLocation(location);
      setFormLocation(location);
      setShowForm(true);
      setIsAddPinMode(false);
      setSelectedPin(null);
    }
  };

  const handlePinClick = (pin) => {
    setSelectedPin(pin);
    setShowForm(false);
    setIsAddPinMode(false);
    setTempPinLocation(null);
  };

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
      </div>
    </div>
  );
}

export default App;
