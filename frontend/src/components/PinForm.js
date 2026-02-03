import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import { API_BASE_URL } from '../config';
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
  { value: 'Trash Pile', label: '🗑️ Trash Pile' },
  { value: 'Pothole', label: '🕳️ Pothole' },
  { value: 'Broken Pipe', label: '🚰 Broken Pipe' },
  { value: 'Fuse Street Light', label: '💡 Fuse Street Light' },
  { value: 'Other', label: '📋 Other' }
];

const getSeverityClass = (value) => {
  const v = parseInt(value, 10);
  if (v <= 3) return 'severity-low';
  if (v <= 6) return 'severity-medium';
  if (v <= 8) return 'severity-high';
  return 'severity-critical';
};

const HeaderIcon = () => (
  <span className="header-icon" aria-hidden="true">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  </span>
);

const UploadIcon = () => (
  <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const PinForm = ({ location, onClose, onSubmit, user }) => {
  const defaultContributorName = user?.displayName || user?.email || '';
  const [formData, setFormData] = useState({
    problemType: 'Trash Pile',
    severity: 5,
    contributor_name: defaultContributorName,
    description: '',
    images: []
  });
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Keep contributor_name in sync when user prop is available (e.g. after login)
  React.useEffect(() => {
    const name = user?.displayName || user?.email || '';
    if (name && !formData.contributor_name) setFormData((prev) => ({ ...prev, contributor_name: name }));
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'severity' ? parseInt(value, 10) : value
    }));
  };

  const handleImageChange = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - imageFiles.length;
    const toAdd = files.slice(0, remaining);
    if (toAdd.length === 0) return;
    setError(toAdd.length < files.length ? 'Maximum 5 images allowed. Only the first allowed slots were added.' : '');

    const newFiles = [...imageFiles, ...toAdd];
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
    if (e.target) e.target.value = '';
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
    setLoading(true);
    setError('');

    try {
      const imageUrls = [];
      for (const file of imageFiles) {
        const compressedFile = await imageCompression(file, COMPRESSION_OPTIONS);
        const multipart = new FormData();
        multipart.append('image', compressedFile);
        const uploadResponse = await axios.post(`${API_BASE_URL}/api/images/upload`, multipart, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        imageUrls.push(uploadResponse.data.url);
      }

      const pinData = {
        problemType: formData.problemType,
        severity: parseInt(formData.severity, 10),
        location: {
          latitude: location.lat,
          longitude: location.lng,
          address: location.address || ''
        },
        images: imageUrls,
        contributor_id: user?.uid || '',
        contributor_name: formData.contributor_name || '',
        description: formData.description || ''
      };

      await axios.post(`${API_BASE_URL}/api/pins`, pinData);
      onSubmit();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const severityClass = getSeverityClass(formData.severity);
  const uploadDisabled = imageFiles.length >= 5;

  return (
    <div className="pin-form-overlay" onClick={onClose}>
      <div className="pin-form-container" onClick={(e) => e.stopPropagation()}>
        <div className="pin-form-header">
          <h2>
            <HeaderIcon />
            Report a Problem
          </h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pin-form">
          {error && <div className="error-message" role="alert">{error}</div>}

          <div className="form-group">
            <label>Address <span className="optional">(from pin location)</span></label>
            <div className="address-display" aria-readonly="true">
              {location.address !== undefined
                ? (location.address || 'Address not found')
                : 'Loading address...'}
            </div>
          </div>

          <div className="form-group">
            <label>Problem Type <span className="required">*</span></label>
            <select
              name="problemType"
              value={formData.problemType}
              onChange={handleInputChange}
              required
            >
              {PROBLEM_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Severity (1–10) <span className="required">*</span></label>
            <input
              type="range"
              name="severity"
              min="1"
              max="10"
              value={formData.severity}
              onChange={handleInputChange}
              required
            />
            <div className="severity-display">
              <span>Low</span>
              <div className={`severity-value ${severityClass}`}>{formData.severity}/10</div>
              <span>High</span>
            </div>
          </div>

          <div className="form-group">
            <label>Your Name <span className="optional">(Optional)</span></label>
            <input
              type="text"
              name="contributor_name"
              value={formData.contributor_name}
              onChange={handleInputChange}
              placeholder="Enter your name"
            />
          </div>

          <div className="form-group">
            <label>Description <span className="optional">(Optional)</span></label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe the problem in detail..."
              rows="4"
            />
          </div>

          <div className="form-group">
            <label>Attach Images <span className="optional">(Max 5)</span></label>
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
              <UploadIcon />
              <p>Click to upload images</p>
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
