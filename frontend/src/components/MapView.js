import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { GoogleMap, LoadScript, Marker as GoogleMarker, InfoWindow } from '@react-google-maps/api';
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
    // Ensure map is ready and has getContainer method
    if (!map || typeof map.getContainer !== 'function') {
      return;
    }

    let container;
    try {
      container = map.getContainer();
      if (!container) {
        return;
      }
    } catch (error) {
      console.warn('Map container not ready:', error);
      return;
    }

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
  const [mapType, setMapType] = useState('osm'); // 'osm' or 'google'
  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

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

  const toggleMapType = () => {
    setMapType(prev => prev === 'osm' ? 'google' : 'osm');
  };

  const handleGoogleMapClick = (e) => {
    if (isAddPinMode && e.latLng) {
      const location = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      onMapClick({ latlng: { lat: location.lat, lng: location.lng } });
    }
  };

  // Google Maps component with search
  const GoogleMapComponent = () => {
    const [map, setMap] = useState(null);
    const [googleMapCenter, setGoogleMapCenter] = useState({ lat: center[0], lng: center[1] });
    const [googleMapZoom, setGoogleMapZoom] = useState(zoom);

    useEffect(() => {
      setGoogleMapCenter({ lat: center[0], lng: center[1] });
      setGoogleMapZoom(zoom);
      if (map) {
        map.setCenter({ lat: center[0], lng: center[1] });
        map.setZoom(zoom);
      }
    }, [center, zoom, map]);

    const onLoad = (mapInstance) => {
      setMap(mapInstance);
    };

    const onUnmount = () => {
      setMap(null);
    };

    if (!googleMapsApiKey) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          background: '#f5f5f5',
          color: '#666',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div>Google Maps API key not configured</div>
          <div style={{ fontSize: '12px' }}>
            Please set REACT_APP_GOOGLE_MAPS_API_KEY in your .env file
          </div>
        </div>
      );
    }

    return (
      <div style={{ position: 'relative', height: '100%', width: '100%' }}>
        <LoadScript 
          googleMapsApiKey={googleMapsApiKey}
          libraries={['places']}
        >
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={googleMapCenter}
            zoom={googleMapZoom}
            onLoad={onLoad}
            onUnmount={onUnmount}
            onClick={handleGoogleMapClick}
            options={{
              disableDefaultUI: false,
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: true,
              fullscreenControl: true,
            }}
          >
            {tempPinLocation && window.google && (
              <GoogleMarker
                position={{ lat: tempPinLocation.lat, lng: tempPinLocation.lng }}
                icon={{
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg width="30" height="30" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="15" cy="15" r="12" fill="#667eea" stroke="white" stroke-width="2"/>
                    </svg>
                  `),
                  scaledSize: new window.google.maps.Size(30, 30),
                  anchor: new window.google.maps.Point(15, 15),
                }}
              />
            )}
            {pins.map((pin) => (
              <GoogleMarker
                key={pin._id}
                position={{ lat: pin.location.latitude, lng: pin.location.longitude }}
                icon={window.google ? {
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg width="30" height="30" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15 0 L30 30 L0 30 Z" fill="${getProblemIcon(pin.problemType)}" stroke="white" stroke-width="2"/>
                    </svg>
                  `),
                  scaledSize: new window.google.maps.Size(30, 30),
                  anchor: new window.google.maps.Point(15, 30),
                } : undefined}
                onClick={() => onPinClick(pin)}
              />
            ))}
          </GoogleMap>
        </LoadScript>
        <GoogleMapSearch map={map} onLocationFound={handleLocationFound} />
      </div>
    );
  };

  // Google Maps Search Component
  const GoogleMapSearch = ({ map, onLocationFound }) => {
    useEffect(() => {
      // Ensure map is ready and has getContainer method
      if (!map || typeof map.getContainer !== 'function') {
        return;
      }

      let container;
      try {
        container = map.getContainer();
        if (!container) {
          return;
        }
      } catch (error) {
        console.warn('Google Map container not ready:', error);
        return;
      }

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

      if (!window.google || !window.google.maps || !window.google.maps.places) {
        return;
      }

      const autocomplete = new window.google.maps.places.Autocomplete(searchInput, {
        types: ['geocode'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
          const location = place.geometry.location;
          const lat = location.lat();
          const lng = location.lng();
          map.setCenter({ lat, lng });
          map.setZoom(15);
          onLocationFound({ lat, lng, address: place.formatted_address });
          clearButton.style.display = 'flex';
        }
      });

      clearButton.addEventListener('click', (e) => {
        e.stopPropagation();
        searchInput.value = '';
        searchInput.focus();
        clearButton.style.display = 'none';
      });

      searchInput.addEventListener('input', (e) => {
        if (e.target.value.length > 0) {
          clearButton.style.display = 'flex';
        } else {
          clearButton.style.display = 'none';
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
              map.setCenter({ lat: latitude, lng: longitude });
              map.setZoom(15);
              onLocationFound({ lat: latitude, lng: longitude });
            },
            (error) => {
              alert('Unable to get your location. Please enable location services.');
            }
          );
        }
      };

      inputWrapper.appendChild(searchInput);
      inputWrapper.appendChild(clearButton);
      searchContainer.appendChild(inputWrapper);

      container.appendChild(searchContainer);
      container.appendChild(currentLocationBtn);

      return () => {
        if (searchContainer.parentNode) {
          searchContainer.parentNode.removeChild(searchContainer);
        }
        if (currentLocationBtn.parentNode) {
          currentLocationBtn.parentNode.removeChild(currentLocationBtn);
        }
      };
    }, [map, onLocationFound]);

    return null;
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Map Type Toggle Button */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        display: 'flex',
        gap: '5px',
        background: 'white',
        borderRadius: '5px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        overflow: 'hidden'
      }}>
        <button
          onClick={toggleMapType}
          style={{
            padding: '8px 15px',
            border: 'none',
            background: mapType === 'osm' ? '#667eea' : 'white',
            color: mapType === 'osm' ? 'white' : '#333',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          OpenStreetMap
        </button>
        <button
          onClick={toggleMapType}
          style={{
            padding: '8px 15px',
            border: 'none',
            background: mapType === 'google' ? '#667eea' : 'white',
            color: mapType === 'google' ? 'white' : '#333',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          Google Maps
        </button>
      </div>
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
      {mapType === 'osm' ? (
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
      ) : (
        <GoogleMapComponent />
      )}
    </div>
  );
};

export default MapView;
