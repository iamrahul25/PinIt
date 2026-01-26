import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function MapClickHandler({ onMapClick, isAddPinMode }) {
  useMapEvents({
    click: (e) => {
      if (isAddPinMode) {
        onMapClick(e);
      }
    },
  });
  return null;
}

function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

function LocationSearch({ onLocationFound }) {
  const map = useMap();

  useEffect(() => {
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = `
      position: absolute;
      top: 10px;
      left: 50px;
      z-index: 1000;
      width: 300px;
    `;

    const inputWrapper = document.createElement('div');
    inputWrapper.style.cssText = `
      position: relative;
      width: 100%;
    `;

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search location...';
    searchInput.style.cssText = `
      width: 100%;
      padding: 10px 40px 10px 15px;
      border: none;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      font-size: 14px;
      box-sizing: border-box;
    `;

    const clearButton = document.createElement('button');
    clearButton.innerHTML = '×';
    clearButton.style.cssText = `
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      font-size: 24px;
      color: #999;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: none;
      align-items: center;
      justify-content: center;
      line-height: 1;
      transition: color 0.2s;
      z-index: 1002;
    `;
    clearButton.addEventListener('mouseenter', () => {
      clearButton.style.color = '#333';
    });
    clearButton.addEventListener('mouseleave', () => {
      clearButton.style.color = '#999';
    });
    clearButton.addEventListener('click', (e) => {
      e.stopPropagation();
      searchInput.value = '';
      searchInput.focus();
      suggestionsList.innerHTML = '';
      suggestionsList.style.display = 'none';
      clearButton.style.display = 'none';
    });

    const suggestionsList = document.createElement('div');
    suggestionsList.id = 'location-suggestions';
    suggestionsList.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 5px;
      background: white;
      border-radius: 5px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-height: 300px;
      overflow-y: auto;
      display: none;
      z-index: 1001;
    `;

    // Simple geocoding using Nominatim (OpenStreetMap)
    let timeout;
    const handleInput = async (e) => {
      clearTimeout(timeout);
      const query = e.target.value.trim();
      
      // Show/hide clear button based on input
      if (e.target.value.length > 0) {
        clearButton.style.display = 'flex';
      } else {
        clearButton.style.display = 'none';
      }
      
      if (query.length > 2) {
        timeout = setTimeout(async () => {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
            );
            const data = await response.json();
            
            // Clear previous suggestions
            suggestionsList.innerHTML = '';
            
            if (data.length > 0) {
              data.forEach((result, index) => {
                const suggestionItem = document.createElement('div');
                suggestionItem.style.cssText = `
                  padding: 12px 15px;
                  cursor: pointer;
                  border-bottom: 1px solid #f0f0f0;
                  transition: background-color 0.2s;
                `;
                suggestionItem.textContent = result.display_name;
                
                // Hover effect
                suggestionItem.addEventListener('mouseenter', () => {
                  suggestionItem.style.backgroundColor = '#f5f5f5';
                });
                suggestionItem.addEventListener('mouseleave', () => {
                  suggestionItem.style.backgroundColor = 'white';
                });
                
                // Click handler
                suggestionItem.addEventListener('click', () => {
                  const lat = parseFloat(result.lat);
                  const lon = parseFloat(result.lon);
                  map.setView([lat, lon], 15);
                  onLocationFound({ lat, lng: lon, address: result.display_name });
                  searchInput.value = result.display_name;
                  suggestionsList.style.display = 'none';
                  clearButton.style.display = 'flex';
                });
                
                suggestionsList.appendChild(suggestionItem);
              });
              suggestionsList.style.display = 'block';
            } else {
              suggestionsList.style.display = 'none';
            }
          } catch (error) {
            console.error('Geocoding error:', error);
            suggestionsList.style.display = 'none';
          }
        }, 500);
      } else {
        suggestionsList.style.display = 'none';
      }
    };

    searchInput.addEventListener('input', handleInput);
    
    // Hide suggestions when clicking outside
    const handleClickOutside = (e) => {
      if (!searchContainer.contains(e.target)) {
        suggestionsList.style.display = 'none';
      }
    };
    document.addEventListener('click', handleClickOutside);

    inputWrapper.appendChild(searchInput);
    inputWrapper.appendChild(clearButton);
    searchContainer.appendChild(inputWrapper);
    searchContainer.appendChild(suggestionsList);

    const currentLocationBtn = document.createElement('button');
    currentLocationBtn.textContent = '📍 My Location';
    currentLocationBtn.style.cssText = `
      position: absolute;
      top: 10px;
      left: 360px;
      z-index: 1000;
      padding: 10px 15px;
      border: none;
      border-radius: 5px;
      background: white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      cursor: pointer;
      font-size: 14px;
    `;
    currentLocationBtn.onclick = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 15);
            onLocationFound({ lat: latitude, lng: longitude });
          },
          (error) => {
            alert('Unable to get your location. Please enable location services.');
          }
        );
      }
    };

    const container = map.getContainer();
    container.appendChild(searchContainer);
    container.appendChild(currentLocationBtn);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      if (searchContainer.parentNode) {
        searchContainer.parentNode.removeChild(searchContainer);
      }
      if (currentLocationBtn.parentNode) {
        currentLocationBtn.parentNode.removeChild(currentLocationBtn);
      }
    };
  }, [map, onLocationFound]);

  return null;
}

const MapView = ({ pins, onMapClick, onPinClick, userId, isAddPinMode, tempPinLocation }) => {
  const [center, setCenter] = useState([20.5937, 78.9629]); // Default to India center
  const [zoom, setZoom] = useState(5);

  useEffect(() => {
    // Try to get user's location on load
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCenter([latitude, longitude]);
          setZoom(13);
        },
        () => {
          // Use default location if geolocation fails
        }
      );
    }
  }, []);

  const handleLocationFound = (location) => {
    setCenter([location.lat, location.lng]);
    setZoom(15);
  };

  const getProblemIcon = (problemType) => {
    const colors = {
      'Trash Pile': '#ff6b6b',
      'Pothole': '#4ecdc4',
      'Broken Pipe': '#45b7d1',
      'Fuse Street Light': '#f9ca24',
      'Other': '#95a5a6'
    };
    return colors[problemType] || colors['Other'];
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {isAddPinMode && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          pointerEvents: 'none',
          background: 'rgba(102, 126, 234, 0.9)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '5px',
          fontSize: '14px',
          fontWeight: 'bold',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap'
        }}>
          Click on the map to place a pin
        </div>
      )}
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ 
          height: '100%', 
          width: '100%',
          cursor: isAddPinMode ? 'crosshair' : 'default'
        }}
      >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapUpdater center={center} zoom={zoom} />
      <MapClickHandler onMapClick={onMapClick} isAddPinMode={isAddPinMode} />
      <LocationSearch onLocationFound={handleLocationFound} />
      {tempPinLocation && (
        <Marker
          position={[tempPinLocation.lat, tempPinLocation.lng]}
          icon={L.divIcon({
            className: 'temp-pin-icon',
            html: `<div class="temp-pin-marker"></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
          })}
        />
      )}
      {pins.map((pin) => (
        <Marker
          key={pin._id}
          position={[pin.location.latitude, pin.location.longitude]}
          icon={L.divIcon({
            className: 'custom-pin-icon',
            html: `<div style="
              background-color: ${getProblemIcon(pin.problemType)};
              width: 30px;
              height: 30px;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              border: 3px solid white;
              box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
          })}
          eventHandlers={{
            click: () => onPinClick(pin),
          }}
        >
          <Popup>
            <div style={{ textAlign: 'center' }}>
              <strong>{pin.problemType}</strong>
              <br />
              Severity: {pin.severity}/10
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
    </div>
  );
};

export default MapView;
