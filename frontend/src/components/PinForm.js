import React, { useState } from 'react';
import axios from 'axios';
import './PinForm.css';

const PinForm = ({ location, onClose, onSubmit, userId }) => {
  const [formData, setFormData] = useState({
    problemType: 'Trash Pile',
    severity: 5,
    name: '',
    description: '',
    images: []
  });
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const problemTypes = ['Trash Pile', 'Pothole', 'Broken Pipe', 'Fuse Street Light', 'Other'];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + imageFiles.length > 5) {
      setError('Maximum 5 images allowed');
      return;
    }

    const newFiles = [...imageFiles, ...files];
    setImageFiles(newFiles);

    // Create previews
    const newPreviews = [];
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result);
        if (newPreviews.length === newFiles.length) {
          setImagePreviews([...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    const newFiles = imageFiles.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Upload images first
      const imageIds = [];
      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append('image', file);
        const uploadResponse = await axios.post('/api/images/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        imageIds.push(uploadResponse.data.fileId);
      }

      // Create pin
      const pinData = {
        problemType: formData.problemType,
        severity: parseInt(formData.severity),
        location: {
          latitude: location.lat,
          longitude: location.lng,
          address: location.address || ''
        },
        images: imageIds,
        name: formData.name,
        description: formData.description
      };

      await axios.post('/api/pins', pinData);
      onSubmit();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create pin. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="pin-form-overlay" onClick={onClose}>
      <div className="pin-form-container" onClick={(e) => e.stopPropagation()}>
        <div className="pin-form-header">
          <h2>Report a Problem</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="pin-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>Problem Type *</label>
            <select
              name="problemType"
              value={formData.problemType}
              onChange={handleInputChange}
              required
            >
              {problemTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Severity (1-10) *</label>
            <input
              type="range"
              name="severity"
              min="1"
              max="10"
              value={formData.severity}
              onChange={handleInputChange}
              required
            />
            <div className="severity-value">{formData.severity}/10</div>
          </div>

          <div className="form-group">
            <label>Your Name (Optional)</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter your name"
            />
          </div>

          <div className="form-group">
            <label>Description (Optional)</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe the problem..."
              rows="4"
            />
          </div>

          <div className="form-group">
            <label>Attach Images (Max 5)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              disabled={imageFiles.length >= 5}
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
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PinForm;
