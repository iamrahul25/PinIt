import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import exifr from 'exifr';
import { useAuth } from '../context/AuthContext';
import imageCompression from 'browser-image-compression';
import { API_BASE_URL } from '../config';
import { getProblemTypeMarkerHtml, PROBLEM_TYPE_COLORS } from '../utils/problemTypeIcons';
import { reverseGeocode } from '../utils/geocode';
import Toast from './Toast';
import './PinForm.css';

const LOCATION_SOURCE_PIN = 'pin';
const LOCATION_SOURCE_IMAGE = 'image';
const LOCATION_SOURCE_GPS = 'gps';

// Compress image in frontend before upload (reduces size sent to Cloudinary)
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.6,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: undefined, // keep original type when possible
  initialQuality: 0.75,
  alwaysKeepResolution: false
};

const PROBLEM_TYPES = [
  { value: 'Trash Pile', label: 'Trash Pile' },
  { value: 'Pothole', label: 'Pothole' },
  { value: 'Broken Pipe', label: 'Broken Pipe' },
  { value: 'Fuse Street Light', label: 'Street Light' },
  { value: 'Other', label: 'Other' }
];

const MAX_IMAGES_PER_SECTION = 10;

const getSeverityClass = (value) => {
  const v = parseInt(value, 10);
  if (v <= 3) return 'severity-low';
  if (v <= 6) return 'severity-medium';
  if (v <= 8) return 'severity-high';
  return 'severity-critical';
};

const PinForm = ({ location, onClose, onSubmit, onError, user }) => {
  const { loading: authLoading, getToken } = useAuth();
  const defaultContributorName = user?.fullName || user?.email || '';
  const [formData, setFormData] = useState({
    problemType: 'Trash Pile',
    severity: 5,
    problemHeading: '',
    contributor_name: defaultContributorName,
    description: '',
    images: []
  });
  const [postAsAnonymous, setPostAsAnonymous] = useState(true); // default: Anonymous User
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [imageFilesAfter, setImageFilesAfter] = useState([]);
  const [imagePreviewsAfter, setImagePreviewsAfter] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitPhase, setSubmitPhase] = useState(null); // null | 'uploading' | 'submitting'
  const [compressingImages, setCompressingImages] = useState(false);
  const [error, setError] = useState('');
  const [toastType, setToastType] = useState('error');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [locationSource, setLocationSource] = useState(LOCATION_SOURCE_PIN); // 'pin' | 'image' | 'gps'
  const [imageLocation, setImageLocation] = useState(null); // { lat, lng, address } when from image GPS
  const [imageLocationLoading, setImageLocationLoading] = useState(false);
  const [gpsLocation, setGpsLocation] = useState(null); // { lat, lng, address } when from GPS
  const [gpsLocationLoading, setGpsLocationLoading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const fileInputAfterRef = useRef(null);
  const typeDropdownRef = useRef(null);
  // Keep original "before" image files for EXIF reading (compression strips metadata)
  const originalBeforeFilesRef = useRef([]);

  // Close type dropdown on outside click or Escape
  useEffect(() => {
    if (!typeDropdownOpen) return;
    const handle = (e) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) setTypeDropdownOpen(false);
      if (e.key === 'Escape') setTypeDropdownOpen(false);
    };
    document.addEventListener('click', handle);
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('click', handle);
      document.removeEventListener('keydown', handle);
    };
  }, [typeDropdownOpen]);

  // Keep contributor_name in sync when user prop is available (e.g. after login)
  useEffect(() => {
    const name = user?.fullName || user?.email || '';
    if (name && !formData.contributor_name) setFormData((prev) => ({ ...prev, contributor_name: name }));
  }, [user, formData.contributor_name]);

  // If user had "From image" and removes all before images, revert to pin location
  useEffect(() => {
    if (locationSource === LOCATION_SOURCE_IMAGE && imageFiles.length === 0) {
      setLocationSource(LOCATION_SOURCE_PIN);
      setImageLocation(null);
    }
  }, [locationSource, imageFiles.length]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'severity' ? parseInt(value, 10) : value
    }));
  };

  const handleImageChange = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_IMAGES_PER_SECTION - imageFiles.length;
    const toAdd = files.slice(0, remaining);
    if (toAdd.length === 0) return;
    setError(toAdd.length < files.length ? `Maximum ${MAX_IMAGES_PER_SECTION} before images. Only the first allowed slots were added.` : '');
    if (e.target) e.target.value = '';

    setCompressingImages(true);
    try {
      const compressed = await Promise.all(
        toAdd.map((file) => imageCompression(file, COMPRESSION_OPTIONS))
      );
      const newFiles = [...imageFiles, ...compressed];
      setImageFiles(newFiles);
      originalBeforeFilesRef.current = [...originalBeforeFilesRef.current, ...toAdd];

      const newPreviews = new Array(newFiles.length);
      let loaded = 0;
      newFiles.forEach((file, i) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews[i] = reader.result;
          loaded += 1;
          if (loaded === newFiles.length) {
            setImagePreviews([...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      });
    } catch (err) {
      setError('Failed to process images. Please try again.');
    } finally {
      setCompressingImages(false);
    }
  }, [imageFiles]);

  const handleImageAfterChange = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_IMAGES_PER_SECTION - imageFilesAfter.length;
    const toAdd = files.slice(0, remaining);
    if (toAdd.length === 0) return;
    setError(toAdd.length < files.length ? `Maximum ${MAX_IMAGES_PER_SECTION} after images. Only the first allowed slots were added.` : '');
    if (e.target) e.target.value = '';

    setCompressingImages(true);
    try {
      const compressed = await Promise.all(
        toAdd.map((file) => imageCompression(file, COMPRESSION_OPTIONS))
      );
      const newFiles = [...imageFilesAfter, ...compressed];
      setImageFilesAfter(newFiles);

      const newPreviews = new Array(newFiles.length);
      let loaded = 0;
      newFiles.forEach((file, i) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews[i] = reader.result;
          loaded += 1;
          if (loaded === newFiles.length) {
            setImagePreviewsAfter([...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      });
    } catch (err) {
      setError('Failed to process after images. Please try again.');
    } finally {
      setCompressingImages(false);
    }
  }, [imageFilesAfter]);

  const removeImage = (index) => {
    const newFiles = imageFiles.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    originalBeforeFilesRef.current = originalBeforeFilesRef.current.filter((_, i) => i !== index);
    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
    setError('');
  };

  const removeImageAfter = (index) => {
    const newFiles = imageFilesAfter.filter((_, i) => i !== index);
    const newPreviews = imagePreviewsAfter.filter((_, i) => i !== index);
    setImageFilesAfter(newFiles);
    setImagePreviewsAfter(newPreviews);
    setError('');
  };

  // Extract GPS from first "before" image (EXIF). Returns { lat, lng } or null.
  const extractImageGps = useCallback(async (file) => {
    try {
      const gps = await exifr.gps(file);
      if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
        return { lat: gps.latitude, lng: gps.longitude };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const handleLocationSourceChange = useCallback(async (e) => {
    const value = e.target.value;
    if (value === LOCATION_SOURCE_PIN) {
      setLocationSource(LOCATION_SOURCE_PIN);
      setImageLocation(null);
      setGpsLocation(null);
      setError('');
      return;
    }
    if (value === LOCATION_SOURCE_IMAGE) {
      if (!imageFiles.length) {
        setToastType('warning');
        setError('Add at least one before image first to use image location.');
        return;
      }
      // Use original file for EXIF (compression strips metadata)
      const fileToRead = originalBeforeFilesRef.current[0] ?? imageFiles[0];
      setImageLocationLoading(true);
      setError('');
      try {
        const coords = await extractImageGps(fileToRead);
        if (!coords) {
          setLocationSource(LOCATION_SOURCE_PIN);
          setImageLocation(null);
          setToastType('warning');
          setError('No GPS detail found. Take location from pin drop only.');
          window.alert('No GPS detail found. Take location from pin drop only.');
          return;
        }
        const address = await reverseGeocode(coords.lat, coords.lng);
        setImageLocation({ lat: coords.lat, lng: coords.lng, address: address || 'Address not found' });
        setLocationSource(LOCATION_SOURCE_IMAGE);
      } catch (err) {
        setError('Could not read image location. Use pin location.');
        setLocationSource(LOCATION_SOURCE_PIN);
        setImageLocation(null);
      } finally {
        setImageLocationLoading(false);
      }
      return;
    }
    if (value === LOCATION_SOURCE_GPS) {
      if (!navigator.geolocation) {
        setToastType('warning');
        setError('GPS is not supported in this browser. Use pin location instead.');
        setLocationSource(LOCATION_SOURCE_PIN);
        return;
      }
      setGpsLocationLoading(true);
      setError('');
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          let address = '';
          try {
            address = await reverseGeocode(latitude, longitude);
          } catch (geoErr) {
            console.warn('Reverse geocoding failed for GPS location', geoErr);
          }
          setGpsLocation({
            lat: latitude,
            lng: longitude,
            address: address || 'Address not found'
          });
          setLocationSource(LOCATION_SOURCE_GPS);
          setGpsLocationLoading(false);
        },
        (err) => {
          console.warn('GPS error', err);
          setToastType('warning');
          setError('Unable to get your GPS location. Please enable location services or use pin location.');
          setLocationSource(LOCATION_SOURCE_PIN);
          setGpsLocation(null);
          setGpsLocationLoading(false);
        }
      );
    }
  }, [imageFiles, extractImageGps]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (authLoading) {
      setError('Authentication is still loading. Please wait a moment.');
      return;
    }
    const heading = (formData.problemHeading || '').trim();
    if (!heading) {
      setError('Problem Heading is required.');
      return;
    }
    if (imageFiles.length === 0) {
      setError('Please add at least one before image.');
      return;
    }
    if (imageFiles.length > MAX_IMAGES_PER_SECTION) {
      setError(`Maximum ${MAX_IMAGES_PER_SECTION} before images allowed.`);
      return;
    }
    if (imageFilesAfter.length > MAX_IMAGES_PER_SECTION) {
      setError(`Maximum ${MAX_IMAGES_PER_SECTION} after images allowed.`);
      return;
    }
    // Ensure we respect the chosen location source and do not silently fall back
    if (locationSource === LOCATION_SOURCE_GPS) {
      if (gpsLocationLoading) {
        setError('Detecting your GPS location. Please wait a moment before submitting.');
        return;
      }
      if (!gpsLocation) {
        setError('GPS location is not available. Please try again or switch to pin location.');
        return;
      }
    }
    if (locationSource === LOCATION_SOURCE_IMAGE) {
      if (imageLocationLoading) {
        setError('Reading image GPS location. Please wait a moment before submitting.');
        return;
      }
      if (!imageLocation) {
        setError('Image location is not available. Please try again or switch to pin location.');
        return;
      }
    }

    setLoading(true);
    setSubmitPhase('uploading');
    setError('');

    try {
      const getAuthConfig = async (extraHeaders = {}) => {
        const token = await getToken();
        if (!token) {
          throw new Error('Missing auth token');
        }
        return {
          headers: {
            Authorization: `Bearer ${token}`,
            ...extraHeaders
          }
        };
      };

      const imageUrls = [];
      for (const file of imageFiles) {
        const multipart = new FormData();
        multipart.append('image', file);
        const uploadResponse = await axios.post(
          `${API_BASE_URL}/api/images/upload`,
          multipart,
          await getAuthConfig({ 'Content-Type': 'multipart/form-data' })
        );
        imageUrls.push(uploadResponse.data.url);
      }

      const imageUrlsAfter = [];
      for (const file of imageFilesAfter) {
        const multipart = new FormData();
        multipart.append('image', file);
        const uploadResponse = await axios.post(
          `${API_BASE_URL}/api/images/upload`,
          multipart,
          await getAuthConfig({ 'Content-Type': 'multipart/form-data' })
        );
        imageUrlsAfter.push(uploadResponse.data.url);
      }

      setSubmitPhase('submitting');

      const useImageLocation = locationSource === LOCATION_SOURCE_IMAGE && imageLocation;
      const useGpsLocation = locationSource === LOCATION_SOURCE_GPS && gpsLocation;
      const submitLocation = useGpsLocation
        ? { latitude: gpsLocation.lat, longitude: gpsLocation.lng, address: gpsLocation.address || '' }
        : useImageLocation
          ? { latitude: imageLocation.lat, longitude: imageLocation.lng, address: imageLocation.address || '' }
          : { latitude: location.lat, longitude: location.lng, address: location.address || '' };

      const pinData = {
        problemType: formData.problemType,
        severity: parseInt(formData.severity, 10),
        problemHeading: (formData.problemHeading || '').trim(),
        location: submitLocation,
        images: imageUrls,
        imagesAfter: imageUrlsAfter,
        contributor_id: user?.id || '',
        contributor_name: formData.contributor_name || '',
        anonymous: postAsAnonymous,
        description: formData.description || ''
      };

      await axios.post(`${API_BASE_URL}/api/pins`, pinData, await getAuthConfig({ 'Content-Type': 'application/json' }));
      onSubmit();
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to create report. Please try again.';
      if (onError) onError(message);
      else setError(message);
    } finally {
      setLoading(false);
      setSubmitPhase(null);
    }
  };

  const severityClass = getSeverityClass(formData.severity);
  const uploadDisabled = imageFiles.length >= MAX_IMAGES_PER_SECTION || compressingImages;
  const uploadAfterDisabled = imageFilesAfter.length >= MAX_IMAGES_PER_SECTION || compressingImages;

  const handleCameraClick = () => {
    if (uploadDisabled) return;

    // Whenever the user chooses to take a picture from the camera,
    // automatically switch the location source to GPS.
    handleLocationSourceChange({ target: { value: LOCATION_SOURCE_GPS } });

    const ua = navigator.userAgent || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
    if (!isMobile) {
      setToastType('warning');
      setError('Camera capture is typically not available on desktop devices. Please use "Click to upload before images" or open this page on your mobile device to take photos.');
      return;
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  return (
    <div className="pin-form-overlay" onClick={onClose}>
      <div className="pin-form-container" onClick={(e) => e.stopPropagation()}>
        <div className="pin-form-header">
          <div>
            <h1 className="pin-form-title">
              <span className="material-icons-round pin-form-title-icon">report_problem</span>
              Report a Problem
            </h1>
            <p className="pin-form-subtitle">Help us improve your neighborhood by reporting issues.</p>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            <span className="material-icons-round">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pin-form">
          <Toast
            visible={!!error}
            message={error}
            type={toastType}
            onClose={() => {
              setError('');
              setToastType('error');
            }}
            position="bottom-right"
          />

          <div className="form-group">
            <label className="pin-form-location-choose-label">Choose location from:</label>
            <div className="pin-form-location-source-wrap">
              <div className="pin-form-location-source-field">
                <span className="material-icons-round pin-form-location-source-icon">my_location</span>
                <select
                  className="pin-form-location-source-select"
                  value={locationSource}
                  onChange={handleLocationSourceChange}
                  disabled={imageLocationLoading || gpsLocationLoading}
                  aria-label="Choose location from pin, GPS, or image"
                >
                  <option value={LOCATION_SOURCE_PIN}>From pin location</option>
                  <option value={LOCATION_SOURCE_IMAGE}>From image location</option>
                  <option value={LOCATION_SOURCE_GPS}>From my GPS</option>
                </select>
              </div>
              {(imageLocationLoading || gpsLocationLoading) && (
                <span className="pin-form-location-loading" aria-hidden="true">
                  {imageLocationLoading ? 'Reading image GPS…' : 'Detecting your location…'}
                </span>
              )}
            </div>
            <label className="pin-form-address-sublabel">Address</label>
            <div className="form-input-wrap form-input-with-icon">
              <span className="material-icons-round form-icon">location_on</span>
              <input
                type="text"
                className="form-input address-input"
                value={
                  imageLocationLoading
                    ? 'Reading image GPS…'
                    : gpsLocationLoading
                      ? 'Detecting your location…'
                      : locationSource === LOCATION_SOURCE_IMAGE && imageLocation
                        ? (imageLocation.address || 'Address not found')
                        : locationSource === LOCATION_SOURCE_GPS && gpsLocation
                          ? (gpsLocation.address || 'Address not found')
                          : location.address !== undefined
                            ? (location.address || 'Address not found')
                            : 'Loading address...'
                }
                readOnly
                aria-readonly="true"
              />
            </div>
            {locationSource === LOCATION_SOURCE_GPS && gpsLocation && !gpsLocationLoading && (
              <div className="pin-form-gps-hint">
                We are using your current GPS location for this report.
              </div>
            )}
            {(() => {
              const lat = locationSource === LOCATION_SOURCE_IMAGE && imageLocation
                ? imageLocation.lat
                : locationSource === LOCATION_SOURCE_GPS && gpsLocation
                  ? gpsLocation.lat
                  : location?.lat;
              const lng = locationSource === LOCATION_SOURCE_IMAGE && imageLocation
                ? imageLocation.lng
                : locationSource === LOCATION_SOURCE_GPS && gpsLocation
                  ? gpsLocation.lng
                  : location?.lng;
              if (lat != null && lng != null) {
                const latNum = Number(lat);
                const lngNum = Number(lng);
                return (
                  <div className="pin-form-coords" aria-label="Coordinates">
                    <span>LAT: {latNum.toFixed(5)}° {latNum >= 0 ? 'N' : 'S'}</span>
                    <span>LONG: {lngNum.toFixed(5)}° {lngNum >= 0 ? 'E' : 'W'}</span>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <div className="form-grid">
            <div className="form-group" ref={typeDropdownRef}>
              <label>Problem Type <span className="required">*</span></label>
              <div
                className={`pin-form-type-select ${typeDropdownOpen ? 'open' : ''}`}
                role="combobox"
                aria-expanded={typeDropdownOpen}
                aria-haspopup="listbox"
                aria-label="Problem type"
              >
                <button
                  type="button"
                  className="pin-form-type-trigger"
                  onClick={() => setTypeDropdownOpen((o) => !o)}
                  aria-label="Choose problem type"
                >
                  <span
                    className="pin-form-type-trigger-icon"
                    dangerouslySetInnerHTML={{ __html: getProblemTypeMarkerHtml(formData.problemType, 28) }}
                    aria-hidden="true"
                  />
                  <span className="pin-form-type-trigger-label">
                    {PROBLEM_TYPES.find((t) => t.value === formData.problemType)?.label || formData.problemType}
                  </span>
                  <span className="material-icons-round pin-form-type-chevron">expand_more</span>
                </button>
                <div className="pin-form-type-dropdown" role="listbox">
                  {PROBLEM_TYPES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={formData.problemType === value}
                      className={`pin-form-type-option ${formData.problemType === value ? 'selected' : ''}`}
                      style={{ ['--option-color']: PROBLEM_TYPE_COLORS[value] || PROBLEM_TYPE_COLORS['Other'] }}
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, problemType: value }));
                        setTypeDropdownOpen(false);
                      }}
                    >
                      <span
                        className="pin-form-type-option-icon"
                        dangerouslySetInnerHTML={{ __html: getProblemTypeMarkerHtml(value, 24) }}
                        aria-hidden="true"
                      />
                      <span className="pin-form-type-option-label">{label}</span>
                      {formData.problemType === value && (
                        <span className="material-icons-round pin-form-type-option-check">check</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="form-group">
              <div className="form-group-severity-header">
                <label>Severity (1–10) <span className="required">*</span></label>
                <span className={`severity-badge ${severityClass}`}>{formData.severity}/10</span>
              </div>
              <div className="severity-slider-wrap">
                <input
                  type="range"
                  name="severity"
                  min="1"
                  max="10"
                  value={formData.severity}
                  onChange={handleInputChange}
                  required
                  className={`custom-range ${severityClass}`}
                />
                <div className="severity-labels">
                  <span>LOW</span>
                  <span>HIGH</span>
                </div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Problem Heading <span className="required">*</span></label>
            <input
              type="text"
              name="problemHeading"
              value={formData.problemHeading}
              onChange={handleInputChange}
              placeholder="e.g. Garbage pile near the park"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label>Description <span className="optional">(Optional)</span></label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe the problem in detail..."
              rows="3"
              className="form-input form-textarea"
            />
          </div>

          <div className="form-group">
            <label>Post as</label>
            <select
              value={postAsAnonymous ? 'anonymous' : 'public'}
              onChange={(e) => setPostAsAnonymous(e.target.value === 'anonymous')}
              className="form-input"
              aria-label="Post as Anonymous or Public"
            >
              <option value="anonymous">Anonymous User</option>
              <option value="public">Post Publically</option>
            </select>
          </div>

          <div className="form-group">
            <label>Before images (before fix) <span className="required">*</span> (at least 1 required, max {MAX_IMAGES_PER_SECTION})</label>
            <div
              role="button"
              tabIndex={0}
              className={`upload-area ${uploadDisabled ? 'disabled' : ''}`}
              onClick={() => !uploadDisabled && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !uploadDisabled) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              aria-label="Click to upload before images"
            >
              <div className="upload-area-icon-wrap">
                <span className="material-icons-round upload-area-icon">cloud_upload</span>
              </div>
              <p className="upload-area-text">{compressingImages ? 'Compressing images...' : 'Click to upload before images'}</p>
              <p className="upload-count">{imageFiles.length}/{MAX_IMAGES_PER_SECTION} images</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="file-input-hidden"
              aria-hidden="true"
            />
            <div
              role="button"
              tabIndex={0}
              className={`upload-area upload-area-camera ${uploadDisabled ? 'disabled' : ''}`}
              onClick={handleCameraClick}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !uploadDisabled) {
                  e.preventDefault();
                  handleCameraClick();
                }
              }}
              aria-label="Click to take photos from camera"
            >
              <div className="upload-area-icon-wrap">
                <span className="material-icons-round upload-area-icon">photo_camera</span>
              </div>
              <p className="upload-area-text">
                {compressingImages ? 'Compressing images...' : 'Click images from camera'}
              </p>
              <p className="upload-count">{imageFiles.length}/{MAX_IMAGES_PER_SECTION} images</p>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture
              multiple
              onChange={handleImageChange}
              className="file-input-hidden"
              aria-hidden="true"
            />
            {imagePreviews.length > 0 && (
              <div className="image-previews">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="image-preview">
                    <img src={preview} alt={`Before ${index + 1}`} />
                    <button
                      type="button"
                      className="remove-image"
                      onClick={() => removeImage(index)}
                      aria-label={`Remove image ${index + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group form-group-after-images">
            <label>After images (after fixing) <span className="optional">(optional, max {MAX_IMAGES_PER_SECTION})</span></label>
            <div
              role="button"
              tabIndex={0}
              className={`upload-area upload-area-after ${uploadAfterDisabled ? 'disabled' : ''}`}
              onClick={() => !uploadAfterDisabled && fileInputAfterRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !uploadAfterDisabled) {
                  e.preventDefault();
                  fileInputAfterRef.current?.click();
                }
              }}
              aria-label="Click to upload after images"
            >
              <div className="upload-area-icon-wrap">
                <span className="material-icons-round upload-area-icon">cloud_upload</span>
              </div>
              <p className="upload-area-text">{compressingImages ? 'Compressing...' : 'Click to upload after-fix images'}</p>
              <p className="upload-count">{imageFilesAfter.length}/{MAX_IMAGES_PER_SECTION} images</p>
            </div>
            <input
              ref={fileInputAfterRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageAfterChange}
              className="file-input-hidden"
              aria-hidden="true"
            />
            {imagePreviewsAfter.length > 0 && (
              <div className="image-previews">
                {imagePreviewsAfter.map((preview, index) => (
                  <div key={`after-${index}`} className="image-preview">
                    <img src={preview} alt={`After ${index + 1}`} />
                    <button
                      type="button"
                      className="remove-image"
                      onClick={() => removeImageAfter(index)}
                      aria-label={`Remove after image ${index + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {submitPhase === 'uploading'
                ? 'Uploading...'
                : submitPhase === 'submitting'
                  ? 'Submitting...'
                  : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PinForm;
