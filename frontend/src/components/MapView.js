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
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search location...';
    searchInput.style.cssText = `
      position: absolute;
      top: 10px;
      left: 50px;
      z-index: 1000;
      padding: 10px 15px;
      width: 300px;
      border: none;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      font-size: 14px;
    `;

    // Simple geocoding using Nominatim (OpenStreetMap)
    let timeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timeout);
      const query = e.target.value;
      if (query.length > 3) {
        timeout = setTimeout(async () => {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
            );
            const data = await response.json();
            if (data.length > 0) {
              const result = data[0];
              const lat = parseFloat(result.lat);
              const lon = parseFloat(result.lon);
              map.setView([lat, lon], 15);
              onLocationFound({ lat, lng: lon, address: result.display_name });
            }
          } catch (error) {
            console.error('Geocoding error:', error);
          }
        }, 500);
      }
    });

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
    container.appendChild(searchInput);
    container.appendChild(currentLocationBtn);

    return () => {
      if (searchInput.parentNode) {
        searchInput.parentNode.removeChild(searchInput);
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
