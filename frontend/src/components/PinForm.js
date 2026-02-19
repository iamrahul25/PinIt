import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import imageCompression from 'browser-image-compression';
import { API_BASE_URL } from '../config';
import { getProblemTypeMarkerHtml, PROBLEM_TYPE_COLORS } from '../utils/problemTypeIcons';
import './PinForm.css';

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
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [compressingImages, setCompressingImages] = useState(false);
  const [error, setError] = useState('');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const fileInputRef = useRef(null);
  const typeDropdownRef = useRef(null);

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'severity' ? parseInt(value, 10) : value
    }));
  };

  const handleImageChange = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - imageFiles.length;
    const toAdd = files.slice(0, remaining);
    if (toAdd.length === 0) return;
    setError(toAdd.length < files.length ? 'Maximum 5 images allowed. Only the first allowed slots were added.' : '');
    if (e.target) e.target.value = '';

    setCompressingImages(true);
    try {
      const compressed = await Promise.all(
        toAdd.map((file) => imageCompression(file, COMPRESSION_OPTIONS))
      );
      const newFiles = [...imageFiles, ...compressed];
      setImageFiles(newFiles);

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

  const removeImage = (index) => {
    const newFiles = imageFiles.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
    setError('');
  };

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
      setError('Please add at least one image.');
      return;
    }

    setLoading(true);
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

      const pinData = {
        problemType: formData.problemType,
        severity: parseInt(formData.severity, 10),
        problemHeading: (formData.problemHeading || '').trim(),
        location: {
          latitude: location.lat,
          longitude: location.lng,
          address: location.address || ''
        },
        images: imageUrls,
        contributor_id: user?.id || '',
        contributor_name: formData.contributor_name || '',
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
    }
  };

  const severityClass = getSeverityClass(formData.severity);
  const uploadDisabled = imageFiles.length >= 5 || compressingImages;

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
          {error && <div className="error-message" role="alert">{error}</div>}

          <div className="form-group">
            <label>Address <span className="optional">(from pin location)</span></label>
            <div className="form-input-wrap form-input-with-icon">
              <span className="material-icons-round form-icon">location_on</span>
              <input
                type="text"
                className="form-input address-input"
                value={location.address !== undefined ? (location.address || 'Address not found') : 'Loading address...'}
                readOnly
                aria-readonly="true"
              />
            </div>
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
            <label>Attach Images <span className="required">*</span> (at least 1 required, max 5)</label>
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
              aria-label="Click to upload images"
            >
              <div className="upload-area-icon-wrap">
                <span className="material-icons-round upload-area-icon">cloud_upload</span>
              </div>
              <p className="upload-area-text">{compressingImages ? 'Compressing images...' : 'Click to upload images'}</p>
              <p className="upload-count">{imageFiles.length}/5 images uploaded</p>
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
            {imagePreviews.length > 0 && (
              <div className="image-previews">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="image-preview">
                    <img src={preview} alt={`Preview ${index + 1}`} />
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

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PinForm;
