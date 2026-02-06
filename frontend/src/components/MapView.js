import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle as LeafletCircle, useMapEvents, useMap } from 'react-leaflet';
import { GoogleMap, LoadScript, InfoWindow, Circle as GoogleCircle } from '@react-google-maps/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getProblemTypeMarkerHtml } from '../utils/problemTypeIcons';

// Static libraries array for Google Maps LoadScript to prevent unnecessary reloads
const GOOGLE_MAPS_LIBRARIES = ['places', 'marker'];

// Default map ID for AdvancedMarkerElement (can be customized in Google Cloud Console)
const DEFAULT_MAP_ID = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

// 20x20 SVG pin for cursor-following placement (tip at bottom center)
const PinIconSvg = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 0C6.134 0 3 3.134 3 7c0 4.5 7 13 7 13s7-8.5 7-13c0-3.866-3.134-7-7-7z"
      fill="black"
      stroke="white"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <circle cx="10" cy="7" r="2.5" fill="white" />
  </svg>
);

// Stable HTML for temp pin so marker isn't updated on every parent re-render
const TEMP_PIN_MARKER_HTML = `
  <div style="
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: #6366f1;
    border: 3px solid white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  "></div>
`;

// Custom AdvancedMarker component to replace deprecated Marker
// Uses refs for content/onClick so we only create/destroy when map or position changes,
// avoiding marker flicker when parent re-renders (e.g. on pan/zoom).
const AdvancedMarker = ({ position, map, content, onClick }) => {
  const markerRef = useRef(null);
  const contentRef = useRef(content);
  const onClickRef = useRef(onClick);
  const [markerLibrary, setMarkerLibrary] = useState(null);

  contentRef.current = content;
  onClickRef.current = onClick;

  useEffect(() => {
    if (!map || !window.google) return;

    // Dynamically import the marker library
    const loadMarkerLibrary = async () => {
      try {
        const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker');
        setMarkerLibrary({ AdvancedMarkerElement });
      } catch (error) {
        console.error('Error loading marker library:', error);
      }
    };

    loadMarkerLibrary();
  }, [map]);

  // Depend on position by value (lat/lng), not object reference, so pan/zoom
  // doesn't retrigger this effect and recreate markers (which caused flicker).
  const lat = position?.lat ?? position?.latitude;
  const lng = position?.lng ?? position?.longitude;

  useEffect(() => {
    if (!map || !markerLibrary || position == null || lat == null || lng == null) return;

    const pos = { lat: Number(lat), lng: Number(lng) };
    const currentContent = contentRef.current;

    // Create marker element
    const markerElement = document.createElement('div');
    markerElement.style.cssText = 'display: flex; align-items: center; justify-content: center;';
    
    if (currentContent) {
      if (typeof currentContent === 'string') {
        markerElement.innerHTML = currentContent;
      } else if (currentContent instanceof HTMLElement) {
        markerElement.appendChild(currentContent);
      } else {
        markerElement.appendChild(currentContent);
      }
    }

    // Create AdvancedMarkerElement
    const advancedMarker = new markerLibrary.AdvancedMarkerElement({
      map,
      position: pos,
      content: markerElement,
    });

    // Use ref so listener always calls latest callback without recreating marker
    advancedMarker.addListener('gmp-click', () => {
      if (onClickRef.current) onClickRef.current();
    });

    markerRef.current = advancedMarker;

    // Cleanup
    return () => {
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
    };
  }, [map, markerLibrary, lat, lng]);

  // Update marker content in place when content prop changes (e.g. pin problemType edit)
  useEffect(() => {
    if (!markerRef.current || !content) return;
    const el = markerRef.current.content;
    if (el && typeof content === 'string') {
      el.innerHTML = content;
    }
  }, [content]);

  return null;
};

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

function MapUpdater({ center, zoom, onMapMove }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);

  // Sync map movements back to parent
  useEffect(() => {
    if (!onMapMove) return;
    
    const handleMoveEnd = () => {
      const mapCenter = map.getCenter();
      const mapZoom = map.getZoom();
      onMapMove([mapCenter.lat, mapCenter.lng], mapZoom);
    };

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
    };
  }, [map, onMapMove]);

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

    const locationIconImg = '<img src="/icons/location.svg" alt="" width="20" height="20" style="display:block;pointer-events:none">';
    const currentLocationBtn = document.createElement('button');
    currentLocationBtn.type = 'button';
    currentLocationBtn.title = 'My Location';
    currentLocationBtn.innerHTML = locationIconImg;
    currentLocationBtn.style.cssText = `
      position: absolute;
      top: 10px;
      left: 360px;
      z-index: 1000;
      width: 36px;
      height: 36px;
      padding: 0;
      border: none;
      border-radius: 6px;
      background: white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.15);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #374151;
    `;
    currentLocationBtn.onclick = () => {
      if (navigator.geolocation) {
        const locationIconImg = '<img src="/icons/location.svg" alt="" width="20" height="20" style="display:block;pointer-events:none">';
        currentLocationBtn.innerHTML = '<span class="map-location-spinner" style="width:18px;height:18px;border:2px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:mapLocationSpin 0.6s linear infinite"></span>';
        currentLocationBtn.disabled = true;
        currentLocationBtn.style.cursor = 'wait';
        document.body.style.cursor = 'wait';
        const restore = () => {
          currentLocationBtn.innerHTML = locationIconImg;
          currentLocationBtn.disabled = false;
          currentLocationBtn.style.cursor = 'pointer';
          document.body.style.cursor = '';
        };
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            map.setView([latitude, longitude], 15);
            onLocationFound({ lat: latitude, lng: longitude, accuracy: accuracy ?? 100 });
            restore();
          },
          (error) => {
            alert('Unable to get your location. Please enable location services.');
            restore();
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

const MAP_LAYERS = [
  { id: 'standard', label: 'Standard' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'terrain', label: 'Terrain' },
];

const MapView = ({ pins, onMapClick, onPinClick, highlightedPinId, hoveredPinId, flyToPinId, isAddPinMode, tempPinLocation, onCancelAddPin }) => {
  const [center, setCenter] = useState([20.5937, 78.9629]); // Default to India center
  const [zoom, setZoom] = useState(5);
  const [mapType, setMapType] = useState('osm'); // 'osm' or 'google'
  const [mapLayer, setMapLayer] = useState('standard'); // 'standard' | 'satellite' | 'terrain'
  const [layersDropdownOpen, setLayersDropdownOpen] = useState(false);
  const layersDropdownRef = useRef(null);
  const [googleMapInstance, setGoogleMapInstance] = useState(null);
  const [leafletMapInstance, setLeafletMapInstance] = useState(null);
  const [userLocation, setUserLocation] = useState(null); // { lat, lng, accuracy } - accuracy in meters
  const [pointerPosition, setPointerPosition] = useState(null); // { x, y } for following pin when placing
  const mapWrapperRef = useRef(null);
  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

  // Don't auto-move to user location on load (so shared pin links show the pin, not user's location).
  // User location is only fetched and map moved when "My Location" button is clicked.

  // Sync center and zoom to Google Maps when state changes
  useEffect(() => {
    if (googleMapInstance) {
      const currentCenter = googleMapInstance.getCenter();
      const currentZoom = googleMapInstance.getZoom();
      const newCenter = { lat: center[0], lng: center[1] };
      
      // Only update if there's a significant difference to avoid infinite loops
      if (currentCenter && (
        Math.abs(currentCenter.lat() - newCenter.lat) > 0.0001 ||
        Math.abs(currentCenter.lng() - newCenter.lng) > 0.0001 ||
        Math.abs(currentZoom - zoom) > 0.5
      )) {
        googleMapInstance.setCenter(newCenter);
        googleMapInstance.setZoom(zoom);
      }
    }
  }, [center, zoom, googleMapInstance]);

  // Trigger resize when switching to Google Maps
  useEffect(() => {
    if (mapType === 'google' && googleMapInstance && window.google) {
      // Small delay to ensure the map container is visible
      const timer = setTimeout(() => {
        window.google.maps.event.trigger(googleMapInstance, 'resize');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mapType, googleMapInstance]);

  // Update Google Map type when mapLayer changes
  useEffect(() => {
    if (mapType === 'google' && googleMapInstance && window.google) {
      const mapTypeId = mapLayer === 'satellite' ? 'satellite' : mapLayer === 'terrain' ? 'terrain' : 'roadmap';
      googleMapInstance.setMapTypeId(mapTypeId);
    }
  }, [mapType, mapLayer, googleMapInstance]);

  // Handle map movement from Leaflet
  const handleLeafletMapMove = (newCenter, newZoom) => {
    setCenter(newCenter);
    setZoom(newZoom);
  };

  // Handle Google Maps drag/zoom events
  const handleGoogleMapDragEnd = () => {
    if (googleMapInstance) {
      const mapCenter = googleMapInstance.getCenter();
      const mapZoom = googleMapInstance.getZoom();
      setCenter([mapCenter.lat(), mapCenter.lng()]);
      setZoom(mapZoom);
    }
  };

  const handleGoogleMapZoomChanged = () => {
    if (googleMapInstance) {
      const mapZoom = googleMapInstance.getZoom();
      setZoom(mapZoom);
    }
  };

  const handleLocationFound = (location) => {
    setCenter([location.lat, location.lng]);
    setZoom(15);
    // Only set userLocation circle when accuracy is provided (from geolocation, not search)
    if (location.accuracy != null) {
      setUserLocation({ lat: location.lat, lng: location.lng, accuracy: location.accuracy });
    }
  };


  const toggleMapType = () => {
    setMapType(prev => {
      const newType = prev === 'osm' ? 'google' : 'osm';
      // Trigger resize for Google Maps when switching to it
      if (newType === 'google' && googleMapInstance && window.google) {
        setTimeout(() => {
          window.google.maps.event.trigger(googleMapInstance, 'resize');
        }, 100);
      }
      return newType;
    });
  };

  const handleGoogleMapClick = (e) => {
    if (isAddPinMode && e.latLng) {
      const location = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      onMapClick({ latlng: { lat: location.lat, lng: location.lng } });
    }
  };

  const handleGoogleMapLoad = (mapInstance) => {
    setGoogleMapInstance(mapInstance);
  };

  const handleGoogleMapUnmount = () => {
    setGoogleMapInstance(null);
  };

  // Pointer position for following pin when in add-pin mode
  const handlePointerMove = (e) => {
    if (!mapWrapperRef.current) return;
    const rect = mapWrapperRef.current.getBoundingClientRect();
    setPointerPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const handlePointerLeave = () => setPointerPosition(null);

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

      const locationIconImg = '<img src="/icons/location.svg" alt="" width="20" height="20" style="display:block;pointer-events:none">';
      const currentLocationBtn = document.createElement('button');
      currentLocationBtn.type = 'button';
      currentLocationBtn.title = 'My Location';
      currentLocationBtn.innerHTML = locationIconImg;
      currentLocationBtn.style.cssText = `
        position: absolute;
        top: 10px;
        left: 360px;
        z-index: 1000;
        width: 36px;
        height: 36px;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #374151;
      `;
      currentLocationBtn.onclick = () => {
        if (navigator.geolocation) {
          const locationIconImg = '<img src="/icons/location.svg" alt="" width="20" height="20" style="display:block;pointer-events:none">';
          currentLocationBtn.innerHTML = '<span class="map-location-spinner" style="width:18px;height:18px;border:2px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:mapLocationSpin 0.6s linear infinite"></span>';
          currentLocationBtn.disabled = true;
          currentLocationBtn.style.cursor = 'wait';
          document.body.style.cursor = 'wait';
          const restore = () => {
            currentLocationBtn.innerHTML = locationIconImg;
            currentLocationBtn.disabled = false;
            currentLocationBtn.style.cursor = 'pointer';
            document.body.style.cursor = '';
          };
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude, accuracy } = position.coords;
              map.setCenter({ lat: latitude, lng: longitude });
              map.setZoom(15);
              onLocationFound({ lat: latitude, lng: longitude, accuracy: accuracy ?? 100 });
              restore();
            },
            (error) => {
              alert('Unable to get your location. Please enable location services.');
              restore();
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

  // Component to capture Leaflet map instance
  const LeafletMapCapture = () => {
    const map = useMap();
    useEffect(() => {
      setLeafletMapInstance(map);
    }, [map]);
    return null;
  };

  // Clear following pin position when leaving add-pin mode
  useEffect(() => {
    if (!isAddPinMode) setPointerPosition(null);
  }, [isAddPinMode]);

  // Close layers dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (layersDropdownRef.current && !layersDropdownRef.current.contains(e.target)) {
        setLayersDropdownOpen(false);
      }
    };
    if (layersDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [layersDropdownOpen]);

  // When flyToPinId changes (click in All Pins panel or map pin), fly/pan map to that pin (not on hover)
  useEffect(() => {
    if (!flyToPinId || !pins.length) return;
    const pin = pins.find((p) => p._id === flyToPinId);
    if (!pin || pin.location.latitude == null || pin.location.longitude == null) return;
    const lat = pin.location.latitude;
    const lng = pin.location.longitude;
    const zoomTo = 16;
    if (mapType === 'osm' && leafletMapInstance) {
      leafletMapInstance.flyTo([lat, lng], zoomTo, { duration: 0.5 });
      // moveend will update center/zoom state
    }
    if (mapType === 'google' && googleMapInstance) {
      googleMapInstance.panTo({ lat, lng });
      googleMapInstance.setZoom(zoomTo);
      setCenter([lat, lng]);
      setZoom(zoomTo);
    }
  }, [flyToPinId, pins, mapType, leafletMapInstance, googleMapInstance]);

  return (
    <div
      ref={mapWrapperRef}
      style={{ position: 'relative', height: '100%', width: '100%' }}
      onMouseMove={isAddPinMode ? handlePointerMove : undefined}
      onMouseLeave={isAddPinMode ? handlePointerLeave : undefined}
    >
      {/* Map Layers Toggle - after location icon */}
      <div ref={layersDropdownRef} style={{ position: 'absolute', top: '10px', left: '404px', zIndex: 1000 }}>
        <button
          type="button"
          onClick={() => setLayersDropdownOpen((prev) => !prev)}
          title="Map layers"
          style={{
            width: '36px',
            height: '36px',
            padding: 0,
            border: 'none',
            borderRadius: '6px',
            background: 'white',
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#374151',
          }}
        >
          <span className="material-icons-round" style={{ fontSize: '20px' }}>layers</span>
        </button>
        {layersDropdownOpen && (
          <div
            style={{
              position: 'absolute',
              top: '42px',
              left: 0,
              minWidth: '140px',
              background: 'white',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              zIndex: 1001,
            }}
          >
            {MAP_LAYERS.map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => {
                  setMapLayer(layer.id);
                  setLayersDropdownOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  background: mapLayer === layer.id ? '#f3f4f6' : 'white',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: mapLayer === layer.id ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  if (mapLayer !== layer.id) e.currentTarget.style.background = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  if (mapLayer !== layer.id) e.currentTarget.style.background = 'white';
                }}
              >
                <span style={{ width: '20px', height: '20px', borderRadius: '4px', border: '1px solid #e5e7eb', background: mapLayer === layer.id ? '#6366f1' : '#f9fafb' }} />
                {layer.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map Type Toggle Button - matches sidebar toggle theme */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        background: '#fff',
        boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.15)',
        overflow: 'hidden'
      }}>
        <button
          onClick={toggleMapType}
          style={{
            padding: '8px 14px',
            border: 'none',
            background: mapType === 'osm' ? '#6366f1' : 'transparent',
            color: mapType === 'osm' ? '#fff' : '#64748b',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            transition: 'background 0.2s, color 0.2s'
          }}
        >
          OpenStreetMap
        </button>
        <button
          onClick={toggleMapType}
          style={{
            padding: '8px 14px',
            border: 'none',
            background: mapType === 'google' ? '#6366f1' : 'transparent',
            color: mapType === 'google' ? '#fff' : '#64748b',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            transition: 'background 0.2s, color 0.2s'
          }}
        >
          Google Maps
        </button>
      </div>
      {isAddPinMode && (
        <>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
            background: 'rgba(99, 102, 241, 0.75)',
            color: 'white',
            padding: '8px 14px 8px 17px',
            borderRadius: '6px',
            fontSize: '10px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255,255,255,0.25)',
            backdropFilter: 'blur(6px)'
          }}>
            <span style={{ pointerEvents: 'none' }}>Click on the map to place a pin</span>
            {onCancelAddPin && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCancelAddPin(); }}
                aria-label="Cancel"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
              >
                <span className="material-icons-round" style={{ fontSize: '13px' }}>close</span>
              </button>
            )}
          </div>
          {pointerPosition != null && (
            <div
              style={{
                position: 'absolute',
                left: pointerPosition.x - 10,
                top: pointerPosition.y - 20,
                width: 20,
                height: 20,
                zIndex: 1001,
                pointerEvents: 'none',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))'
              }}
              aria-hidden
            >
              <PinIconSvg />
            </div>
          )}
        </>
      )}
      
      {/* OpenStreetMap - Always mounted, shown/hidden via CSS */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: mapType === 'osm' ? 'block' : 'none',
        zIndex: mapType === 'osm' ? 1 : 0
      }}>
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
            key={mapLayer}
            attribution={
              mapLayer === 'standard'
                ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                : mapLayer === 'satellite'
                ? '&copy; <a href="https://www.esri.com/">Esri</a>'
                : '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors'
            }
            url={
              mapLayer === 'standard'
                ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                : mapLayer === 'satellite'
                ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                : 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
            }
          />
          <LeafletMapCapture />
          <MapUpdater center={center} zoom={zoom} onMapMove={handleLeafletMapMove} />
          <MapClickHandler onMapClick={onMapClick} isAddPinMode={isAddPinMode} />
          <LocationSearch onLocationFound={handleLocationFound} />
          {userLocation && (
            <>
              <LeafletCircle
                center={[userLocation.lat, userLocation.lng]}
                radius={userLocation.accuracy}
                pathOptions={{
                  color: '#2196F3',
                  fillColor: '#2196F3',
                  fillOpacity: 0.25,
                  weight: 2,
                }}
              />
              <Marker
                position={[userLocation.lat, userLocation.lng]}
                icon={L.divIcon({
                  className: 'user-location-center-dot',
                  html: '<div style="width:12px;height:12px;background:#2196F3;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>',
                  iconSize: [12, 12],
                  iconAnchor: [6, 6],
                })}
                zIndexOffset={1000}
              />
            </>
          )}
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
          {pins.map((pin) => {
            const isHovered = pin._id === hoveredPinId;
            const isHighlighted = pin._id === highlightedPinId && !isHovered;
            const highlightClass = isHovered ? 'pin-marker-hover' : (isHighlighted ? 'pin-marker-highlighted' : '');
            return (
              <Marker
                key={pin._id}
                position={[pin.location.latitude, pin.location.longitude]}
                icon={L.divIcon({
                  className: `custom-pin-icon ${highlightClass}`.trim(),
                  html: getProblemTypeMarkerHtml(pin.problemType),
                  iconSize: [26, 26],
                  iconAnchor: [13, 26],
                })}
                eventHandlers={{
                  click: () => onPinClick(pin),
                }}
              />
            );
          })}
        </MapContainer>
      </div>

      {/* Google Maps - Always mounted, shown/hidden via CSS */}
      {googleMapsApiKey ? (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: mapType === 'google' ? 'block' : 'none',
          zIndex: mapType === 'google' ? 1 : 0
        }}>
          <LoadScript 
            googleMapsApiKey={googleMapsApiKey}
            libraries={GOOGLE_MAPS_LIBRARIES}
          >
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: center[0], lng: center[1] }}
              zoom={zoom}
              onLoad={handleGoogleMapLoad}
              onUnmount={handleGoogleMapUnmount}
              onClick={handleGoogleMapClick}
              onDragEnd={handleGoogleMapDragEnd}
              onZoomChanged={handleGoogleMapZoomChanged}
              options={{
                mapId: DEFAULT_MAP_ID,
                mapTypeId: mapLayer === 'satellite' ? 'satellite' : mapLayer === 'terrain' ? 'terrain' : 'roadmap',
                disableDefaultUI: false,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
              }}
            >
              {userLocation && (
                <>
                  <GoogleCircle
                    center={{ lat: userLocation.lat, lng: userLocation.lng }}
                    radius={userLocation.accuracy}
                    options={{
                      fillColor: '#2196F3',
                      fillOpacity: 0.25,
                      strokeColor: '#2196F3',
                      strokeWeight: 2,
                    }}
                  />
                  <AdvancedMarker
                    map={googleMapInstance}
                    position={{ lat: userLocation.lat, lng: userLocation.lng }}
                    content={
                      '<div style="width:12px;height:12px;background:#2196F3;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>'
                    }
                  />
                </>
              )}
              {tempPinLocation && googleMapInstance && (
                <AdvancedMarker
                  map={googleMapInstance}
                  position={{ lat: tempPinLocation.lat, lng: tempPinLocation.lng }}
                  content={TEMP_PIN_MARKER_HTML}
                />
              )}
              {pins.map((pin) => {
                const isHovered = pin._id === hoveredPinId;
                const isHighlighted = pin._id === highlightedPinId && !isHovered;
                const baseHtml = getProblemTypeMarkerHtml(pin.problemType);
                let content = baseHtml;
                if (isHovered) {
                  content = `<div class="pin-marker-hover" style="display:inline-flex;align-items:center;justify-content:center;padding:3px;border-radius:50%;border:3px solid #000;box-sizing:border-box;">${baseHtml}</div>`;
                } else if (isHighlighted) {
                  content = `<div class="pin-marker-highlighted" style="display:inline-flex;align-items:center;justify-content:center;padding:4px;border-radius:50%;box-shadow:0 0 0 4px rgba(102,126,234,0.8);">${baseHtml}</div>`;
                }
                return (
                  <AdvancedMarker
                    key={pin._id}
                    map={googleMapInstance}
                    position={{ lat: pin.location.latitude, lng: pin.location.longitude }}
                    content={content}
                    onClick={() => onPinClick(pin)}
                  />
                );
              })}
            </GoogleMap>
            <GoogleMapSearch map={googleMapInstance} onLocationFound={handleLocationFound} />
          </LoadScript>
        </div>
      ) : (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: mapType === 'google' ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f5f5',
          color: '#666',
          flexDirection: 'column',
          gap: '10px',
          zIndex: mapType === 'google' ? 1 : 0
        }}>
          <div>Google Maps API key not configured</div>
          <div style={{ fontSize: '12px' }}>
            Please set REACT_APP_GOOGLE_MAPS_API_KEY in your .env file
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
