import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import exifr from 'exifr';
import { useAuth } from '../context/AuthContext';
import imageCompression from 'browser-image-compression';
import { API_BASE_URL } from '../config';
import { getProblemTypeMarkerHtml, PROBLEM_TYPE_COLORS } from '../utils/problemTypeIcons';
import { reverseGeocode } from '../utils/geocode';
import Toast from './Toast';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import {
  MapPin,
  Navigation,
  Image as ImageIcon,
  CloudUpload,
  Camera,
  X,
  AlertTriangle,
  ChevronDown,
  Check,
  Loader2,
  Send,
  Eye,
  EyeOff,
  FileWarning
} from 'lucide-react';

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
  { value: 'Fuse Street Light', label: 'Fuse Street Light' },
  { value: 'Other', label: 'Other' }
];

const MAX_IMAGES_PER_SECTION = 10;

const getSeverityLabel = (value) => {
  const v = parseInt(value, 10);
  if (v <= 2) return { text: 'Low', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', darkColor: 'dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700' };
  if (v <= 4) return { text: 'Moderate', color: 'bg-amber-100 text-amber-700 border-amber-200', darkColor: 'dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700' };
  if (v <= 6) return { text: 'Medium', color: 'bg-orange-100 text-orange-700 border-orange-200', darkColor: 'dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700' };
  if (v <= 8) return { text: 'High', color: 'bg-red-100 text-red-700 border-red-200', darkColor: 'dark:bg-red-900/40 dark:text-red-300 dark:border-red-700' };
  return { text: 'Critical', color: 'bg-red-200 text-red-800 border-red-300', darkColor: 'dark:bg-red-900/50 dark:text-red-200 dark:border-red-600' };
};

const getSliderGradient = (value) => {
  const percent = ((value - 1) / 9) * 100;
  return `linear-gradient(to right, #22c55e 0%, #eab308 40%, #ef4444 100%)`;
};

const getThumbColor = (value) => {
  const v = parseInt(value, 10);
  if (v <= 3) return '#22c55e';
  if (v <= 6) return '#eab308';
  return '#ef4444';
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

  const severityInfo = getSeverityLabel(formData.severity);
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

  // Compute displayed address
  const displayAddress = imageLocationLoading
    ? 'Reading image GPS…'
    : gpsLocationLoading
      ? 'Detecting your location…'
      : locationSource === LOCATION_SOURCE_IMAGE && imageLocation
        ? (imageLocation.address || 'Address not found')
        : locationSource === LOCATION_SOURCE_GPS && gpsLocation
          ? (gpsLocation.address || 'Address not found')
          : location.address !== undefined
            ? (location.address || 'Address not found')
            : 'Loading address...';

  // Compute coordinates
  const coordLat = locationSource === LOCATION_SOURCE_IMAGE && imageLocation
    ? imageLocation.lat
    : locationSource === LOCATION_SOURCE_GPS && gpsLocation
      ? gpsLocation.lat
      : location?.lat;
  const coordLng = locationSource === LOCATION_SOURCE_IMAGE && imageLocation
    ? imageLocation.lng
    : locationSource === LOCATION_SOURCE_GPS && gpsLocation
      ? gpsLocation.lng
      : location?.lng;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[92vh] bg-background dark:bg-card rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 dark:from-violet-600 dark:via-purple-600 dark:to-indigo-600" />

        {/* Header */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 dark:from-violet-600 dark:to-purple-700 text-white shadow-lg shadow-violet-200 dark:shadow-violet-900/50">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                Report a Problem
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Help improve your neighborhood
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full -mt-1 -mr-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <Separator className="opacity-50" />

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(92vh-140px)] px-4 sm:px-6 py-4 space-y-5">
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

          {/* ── Location Section ── */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
              Location Source
            </Label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                <select
                  className="w-full h-9 pl-9 pr-8 rounded-lg border border-input bg-muted/50 dark:bg-muted/30 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer transition-all font-medium"
                  value={locationSource}
                  onChange={handleLocationSourceChange}
                  disabled={imageLocationLoading || gpsLocationLoading}
                  aria-label="Choose location from pin, GPS, or image"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.5rem center',
                    backgroundSize: '1rem'
                  }}
                >
                  <option value={LOCATION_SOURCE_PIN}>📍 Pin location</option>
                  <option value={LOCATION_SOURCE_IMAGE}>🖼️ Image GPS</option>
                  <option value={LOCATION_SOURCE_GPS}>📡 My GPS</option>
                </select>
              </div>
              {(imageLocationLoading || gpsLocationLoading) && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {imageLocationLoading ? 'Reading GPS…' : 'Locating…'}
                </span>
              )}
            </div>

            {/* Address display */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400 dark:text-violet-500 pointer-events-none" />
              <Input
                type="text"
                className="pl-9 h-9 bg-muted/50 dark:bg-muted/30 text-sm text-muted-foreground cursor-default border-input"
                value={displayAddress}
                readOnly
                aria-readonly="true"
              />
            </div>

            {locationSource === LOCATION_SOURCE_GPS && gpsLocation && !gpsLocationLoading && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                Using your current GPS location
              </p>
            )}

            {coordLat != null && coordLng != null && (
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground font-mono">
                <span className="bg-muted/50 dark:bg-muted/30 px-2 py-1 rounded-md border border-border">
                  LAT: {Number(coordLat).toFixed(5)}° {Number(coordLat) >= 0 ? 'N' : 'S'}
                </span>
                <span className="bg-muted/50 dark:bg-muted/30 px-2 py-1 rounded-md border border-border">
                  LNG: {Number(coordLng).toFixed(5)}° {Number(coordLng) >= 0 ? 'E' : 'W'}
                </span>
              </div>
            )}
          </div>

          {/* ── Problem Type & Severity Grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Problem Type */}
            <div className="space-y-2" ref={typeDropdownRef}>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Problem Type <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <button
                  type="button"
                  className={`w-full flex items-center gap-2.5 h-10 px-3 rounded-lg border text-sm font-medium text-foreground transition-all text-left ${typeDropdownOpen
                    ? 'border-primary ring-2 ring-primary/20 dark:ring-primary/30 bg-background shadow-sm'
                    : 'border-input bg-background hover:border-muted-foreground/50 dark:hover:border-muted-foreground/30 hover:shadow-sm'
                    }`}
                  onClick={() => setTypeDropdownOpen((o) => !o)}
                  aria-label="Choose problem type"
                  aria-expanded={typeDropdownOpen}
                  aria-haspopup="listbox"
                >
                  <span
                    className="inline-flex items-center shrink-0"
                    dangerouslySetInnerHTML={{ __html: getProblemTypeMarkerHtml(formData.problemType, 22) }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate">
                    {PROBLEM_TYPES.find((t) => t.value === formData.problemType)?.label || formData.problemType}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${typeDropdownOpen ? 'rotate-180' : ''
                      }`}
                  />
                </button>
                {typeDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover dark:bg-card border border-border rounded-lg shadow-lg overflow-hidden animate-in slide-in-from-top-1 fade-in duration-150">
                    {PROBLEM_TYPES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        role="option"
                        aria-selected={formData.problemType === value}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors text-left ${formData.problemType === value
                          ? 'bg-primary/10 dark:bg-primary/20 text-primary'
                          : 'text-foreground hover:bg-muted'
                          }`}
                        style={{ borderLeft: `3px solid ${PROBLEM_TYPE_COLORS[value] || PROBLEM_TYPE_COLORS['Other']}` }}
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, problemType: value }));
                          setTypeDropdownOpen(false);
                        }}
                      >
                        <span
                          className="inline-flex items-center shrink-0"
                          dangerouslySetInnerHTML={{ __html: getProblemTypeMarkerHtml(value, 20) }}
                          aria-hidden="true"
                        />
                        <span className="flex-1">{label}</span>
                        {formData.problemType === value && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Severity <span className="text-destructive">*</span>
                </Label>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${severityInfo.color} ${severityInfo.darkColor || ''}`}
                >
                  {formData.severity}/10 · {severityInfo.text}
                </span>
              </div>
              <div className="pt-2 pb-1">
                <div className="relative">
                  <input
                    type="range"
                    name="severity"
                    min="1"
                    max="10"
                    value={formData.severity}
                    onChange={handleInputChange}
                    required
                    className="severity-range w-full h-2 rounded-full appearance-none cursor-pointer outline-none"
                    style={{
                      background: `linear-gradient(to right, #22c55e 0%, #eab308 50%, #ef4444 100%)`,
                      // Custom thumb via CSS
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground font-medium">
                  <span>LOW</span>
                  <span>MED</span>
                  <span>HIGH</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Problem Heading ── */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Problem Heading <span className="text-destructive">*</span>
            </Label>
            <Input
              type="text"
              name="problemHeading"
              value={formData.problemHeading}
              onChange={handleInputChange}
              placeholder="e.g. Garbage pile near the park"
              className="h-10 text-sm border-input focus:border-primary focus:ring-primary/20"
              required
            />
          </div>

          {/* ── Description ── */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Description <span className="text-muted-foreground normal-case text-[10px]">(optional)</span>
            </Label>
            <Textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe the problem in detail..."
              rows={3}
              className="text-sm border-input focus:border-primary focus:ring-primary/20 resize-y min-h-[80px]"
            />
          </div>

          {/* ── Post as ── */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              {postAsAnonymous ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-primary" />}
              Post as
            </Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPostAsAnonymous(true)}
                className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium transition-all border ${postAsAnonymous
                  ? 'bg-primary/10 dark:bg-primary/20 border-primary/40 text-primary shadow-sm'
                  : 'bg-muted/30 dark:bg-muted/20 border-border text-muted-foreground hover:border-muted-foreground/50'
                  }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                Anonymous
              </button>
              <button
                type="button"
                onClick={() => setPostAsAnonymous(false)}
                className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium transition-all border ${!postAsAnonymous
                  ? 'bg-primary/10 dark:bg-primary/20 border-primary/40 text-primary shadow-sm'
                  : 'bg-muted/30 dark:bg-muted/20 border-border text-muted-foreground hover:border-muted-foreground/50'
                  }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Public
              </button>
            </div>
          </div>

          {/* ── Before Images ── */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-orange-400 dark:text-orange-500" />
              Before Images <span className="text-destructive">*</span>
              <span className="text-muted-foreground normal-case text-[10px] ml-1">(min 1, max {MAX_IMAGES_PER_SECTION})</span>
            </Label>

            <div className="grid grid-cols-2 gap-2">
              {/* Upload button */}
              <div
                role="button"
                tabIndex={0}
                className={`group relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer ${uploadDisabled
                  ? 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
                  : 'border-input bg-muted/20 dark:bg-muted/10 hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 hover:shadow-sm'
                  }`}
                onClick={() => !uploadDisabled && fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !uploadDisabled) {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                aria-label="Click to upload before images"
              >
                <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CloudUpload className="w-5 h-5 text-violet-500 dark:text-violet-400" />
                </div>
                <p className="text-xs font-semibold text-foreground text-center">
                  {compressingImages ? 'Compressing…' : 'Upload'}
                </p>
                <p className="text-[10px] text-muted-foreground">{imageFiles.length}/{MAX_IMAGES_PER_SECTION}</p>
              </div>

              {/* Camera button */}
              <div
                role="button"
                tabIndex={0}
                className={`group relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer ${uploadDisabled
                  ? 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
                  : 'border-input bg-muted/20 dark:bg-muted/10 hover:border-blue-500/50 dark:hover:border-blue-400/50 hover:bg-blue-500/5 dark:hover:bg-blue-400/10 hover:shadow-sm'
                  }`}
                onClick={handleCameraClick}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !uploadDisabled) {
                    e.preventDefault();
                    handleCameraClick();
                  }
                }}
                aria-label="Click to take photos from camera"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                </div>
                <p className="text-xs font-semibold text-foreground text-center">
                  {compressingImages ? 'Compressing…' : 'Camera'}
                </p>
                <p className="text-[10px] text-muted-foreground">{imageFiles.length}/{MAX_IMAGES_PER_SECTION}</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="hidden"
              aria-hidden="true"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture
              multiple
              onChange={handleImageChange}
              className="hidden"
              aria-hidden="true"
            />

            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group rounded-lg overflow-hidden border border-border shadow-sm aspect-square">
                    <img src={preview} alt={`Before ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/90 dark:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600 dark:hover:bg-red-500"
                      onClick={() => removeImage(index)}
                      aria-label={`Remove image ${index + 1}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent px-1.5 py-0.5">
                      <span className="text-[9px] text-white font-medium">{index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── After Images ── */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-500" />
              After Images
              <span className="text-muted-foreground normal-case text-[10px] ml-1">(optional, max {MAX_IMAGES_PER_SECTION})</span>
            </Label>

            <div
              role="button"
              tabIndex={0}
              className={`group flex items-center justify-center gap-3 p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer ${uploadAfterDisabled
                ? 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
                : 'border-input bg-muted/20 dark:bg-muted/10 hover:border-emerald-500/50 dark:hover:border-emerald-400/50 hover:bg-emerald-500/5 dark:hover:bg-emerald-400/10 hover:shadow-sm'
                }`}
              onClick={() => !uploadAfterDisabled && fileInputAfterRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !uploadAfterDisabled) {
                  e.preventDefault();
                  fileInputAfterRef.current?.click();
                }
              }}
              aria-label="Click to upload after images"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                <CloudUpload className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {compressingImages ? 'Compressing…' : 'Upload after-fix images'}
                </p>
                <p className="text-[10px] text-muted-foreground">{imagePreviewsAfter.length}/{MAX_IMAGES_PER_SECTION} images</p>
              </div>
            </div>

            <input
              ref={fileInputAfterRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageAfterChange}
              className="hidden"
              aria-hidden="true"
            />

            {imagePreviewsAfter.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                {imagePreviewsAfter.map((preview, index) => (
                  <div key={`after-${index}`} className="relative group rounded-lg overflow-hidden border border-border shadow-sm aspect-square">
                    <img src={preview} alt={`After ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/90 dark:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600 dark:hover:bg-red-500"
                      onClick={() => removeImageAfter(index)}
                      aria-label={`Remove after image ${index + 1}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent px-1.5 py-0.5">
                      <span className="text-[9px] text-white font-medium">{index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <Separator className="opacity-50" />
          <div className="flex gap-3 pt-1 pb-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-10 text-sm font-semibold rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 dark:from-violet-600 dark:to-purple-700 text-white shadow-lg shadow-violet-200/50 dark:shadow-violet-900/40 hover:shadow-violet-300/50 dark:hover:shadow-violet-700/30 hover:from-violet-600 hover:to-purple-700 dark:hover:from-violet-500 dark:hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-0"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {submitPhase === 'uploading' ? 'Uploading…' : 'Submitting…'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Submit Report
                </span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PinForm;
