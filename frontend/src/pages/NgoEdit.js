import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import './NGOs.css';

const NGO_LEVELS = ['International', 'National', 'State', 'City'];

const WHAT_THEY_DO_OPTIONS = [
  'Cleanup drives',
  'Plantation drives',
  'Painting drive',
  'Awareness drive',
  'Pothole fix drive',
  'Education drive',
  'Other'
];

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 800,
  useWebWorker: true,
  initialQuality: 0.8
};

export default function NgoEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { loading: authLoading, isSignedIn, user, getToken } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    level: 'City',
    foundInYear: '',
    numberOfCities: '',
    website: '',
    instagram: '',
    linkedin: '',
    facebook: '',
    otherSocial: '',
    instagramFollowers: '',
    whatTheyDo: [],
    otherWhatTheyDo: '',
    aboutDescription: '',
    founderName: '',
    founderCity: ''
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState('');
  const fileInputRef = useRef(null);

  const getAuthHeaders = useCallback(async (headers = {}) => {
    const token = await getToken();
    if (!token) throw new Error('Unable to acquire auth token');
    return { ...headers, Authorization: `Bearer ${token}` };
  }, [getToken]);

  const authFetch = useCallback(async (url, options = {}) => {
    const headers = await getAuthHeaders(options.headers || {});
    return fetch(url, { ...options, headers });
  }, [getAuthHeaders]);

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) {
      navigate('/login', { replace: true });
      return;
    }

    const fetchNgoData = async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/ngos/${id}`);
        if (!res.ok) throw new Error('Failed to fetch NGO data');
        const data = await res.json();
        setForm({
          name: data.name || '',
          email: data.email || '',
          level: data.level || 'City',
          foundInYear: data.foundInYear || '',
          numberOfCities: data.numberOfCities || '',
          website: data.socialMedia?.website || '',
          instagram: data.socialMedia?.instagram || '',
          linkedin: data.socialMedia?.linkedin || '',
          facebook: data.socialMedia?.facebook || '',
          otherSocial: data.socialMedia?.other || '',
          instagramFollowers: data.socialMedia?.instagramFollowers || '',
          whatTheyDo: data.whatTheyDo || [],
          otherWhatTheyDo: '',
          aboutDescription: data.aboutDescription || '',
          founderName: data.founder?.name || '',
          founderCity: data.founder?.city || ''
        });
        setLogoPreview(data.logoUrl || '');
      } catch (err) {
        setError(err.message || 'Could not load NGO data');
      }
    };

    fetchNgoData();
  }, [id, authLoading, isSignedIn, navigate, authFetch]);

  const handleWhatTheyDoToggle = (option) => {
    setForm((f) => ({
      ...f,
      whatTheyDo: f.whatTheyDo.includes(option)
        ? f.whatTheyDo.filter((x) => x !== option)
        : [...f.whatTheyDo, option]
    }));
  };

  const handleNameChange = (e) => {
    setForm((f) => ({ ...f, name: e.target.value }));
    setVerificationResult('');
  };

  const handleVerify = async () => {
    if (!form.name.trim()) {
      setVerificationResult('');
      return;
    }
    setVerifying(true);
    setVerificationResult('');
    try {
      const res = await authFetch(`${API_BASE_URL}/api/ngos/verify?name=${encodeURIComponent(form.name.trim())}`);
      const data = await res.json();
      if (data.found && data.ngo._id !== id) {
        setVerificationResult('Taken');
      } else {
        setVerificationResult('Available');
      }
    } catch (err) {
      setVerificationResult('Error');
    } finally {
      setVerifying(false);
    }
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (e.g. JPG, PNG).');
      return;
    }
    setError('');
    try {
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
      setLogoFile(compressed);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result);
      reader.readAsDataURL(compressed);
    } catch {
      setError('Failed to process image.');
    }
    if (e.target) e.target.value = '';
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.name.trim()) {
      setError('NGO name is required.');
      return;
    }
    if (form.name.trim() && verificationResult === 'Taken') {
        setError('This NGO name is already taken. Please choose another.');
        return;
    }
    if (!logoPreview) {
      setError('NGO image/logo is required.');
      return;
    }
    setSubmitting(true);
    try {
      let logoUrl = logoPreview;
      if (logoFile) {
        const formData = new FormData();
        formData.append('image', logoFile);
        const uploadRes = await axios.post(
          `${API_BASE_URL}/api/images/upload`,
          formData,
          { headers: await getAuthHeaders({ 'Content-Type': 'multipart/form-data' }) }
        );
        logoUrl = uploadRes.data?.url || '';
      }
      if (!logoUrl) {
        throw new Error('Image upload failed. Please try again.');
      }
      const whatTheyDoList = [...form.whatTheyDo];
      if (form.otherWhatTheyDo.trim()) whatTheyDoList.push(form.otherWhatTheyDo.trim());
      const instagramInput = form.instagram.trim();
      const instagramUsername = instagramInput.match(/instagram\.com\/([^/?]+)/i)
        ? instagramInput.replace(/^.*instagram\.com\/([^/?]+).*$/i, '$1').replace(/^@/, '')
        : instagramInput.replace(/^@/, '');
      const res = await authFetch(`${API_BASE_URL}/api/ngos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          level: form.level,
          foundInYear: form.foundInYear.toString().trim() ? parseInt(form.foundInYear, 10) : undefined,
          numberOfCities: form.numberOfCities.toString().trim() ? Math.max(0, parseInt(form.numberOfCities, 10)) : undefined,
          socialMedia: {
            website: form.website.trim() || '',
            instagram: instagramUsername,
            linkedin: form.linkedin.trim() || '',
            facebook: form.facebook.trim() || '',
            other: form.otherSocial.trim() || ''
          },
          whatTheyDo: whatTheyDoList,
          aboutDescription: form.aboutDescription.trim(),
          founder: {
            name: form.founderName.trim() || undefined,
            city: form.founderCity.trim() || undefined
          },
          logoUrl,
          instagramFollowers: form.instagramFollowers.toString().trim() ? parseInt(form.instagramFollowers, 10) : undefined
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update NGO');
      }
      setSuccess('NGO updated successfully!');
      setTimeout(() => navigate('/ngos'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="ngos-page">
        <p>Loading...</p>
      </div>
    );
  }
  if (!isSignedIn) return null;

  return (
    <div className="ngos-page">
      <main className="ngos-main">
        <div className="ngos-form-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 className="ngos-form-title">Edit NGO</h2>
            <p className="ngos-form-desc">Update the details of the NGO.</p>
            <form className="ngos-form" onSubmit={handleSubmit}>
          <div className="ngos-field">
            <label className="ngos-label">NGO name <span className="ngos-required">*</span></label>
            <div className="ngos-input-wrap">
              <input
                type="text"
                className="ngos-input"
                placeholder="Name of the NGO"
                value={form.name}
                onChange={handleNameChange}
              />
              <button
                type="button"
                className="ngos-verify-btn"
                onClick={handleVerify}
                disabled={verifying}
              >
                {verifying ? '...' : 'Verify'}
              </button>
            </div>
            {verificationResult && (
              <div className={`ngos-verification-result ${verificationResult.toLowerCase()}`}>
                {verificationResult}
              </div>
            )}
          </div>
          <div className="ngos-field">
            <label className="ngos-label">NGO email <span className="ngos-optional">(optional)</span></label>
            <input
              type="email"
              className="ngos-input"
              placeholder="contact@ngo.org"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="ngos-field">
            <label className="ngos-label">NGO level</label>
            <select
              className="ngos-input ngos-select"
              value={form.level}
              onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
            >
              {NGO_LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className="ngos-field">
            <label className="ngos-label">Found in Year <span className="ngos-optional">(optional)</span></label>
            <input
              type="number"
              className="ngos-input"
              placeholder="e.g. 2015"
              min="1900"
              max={new Date().getFullYear()}
              value={form.foundInYear}
              onChange={(e) => setForm((f) => ({ ...f, foundInYear: e.target.value }))}
            />
          </div>
          <div className="ngos-field">
            <label className="ngos-label">No. of cities it operates in <span className="ngos-optional">(optional)</span></label>
            <input
              type="number"
              className="ngos-input"
              placeholder="e.g. 10"
              min="0"
              value={form.numberOfCities}
              onChange={(e) => setForm((f) => ({ ...f, numberOfCities: e.target.value }))}
            />
          </div>

          <div className="ngos-field-group">
            <span className="ngos-group-label">Social media</span>
            <div className="ngos-field">
              <label className="ngos-label">Website</label>
              <input
                type="url"
                className="ngos-input"
                placeholder="https://..."
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              />
            </div>
            <div className="ngos-field">
              <label className="ngos-label">Instagram username only</label>
              <input
                type="text"
                className="ngos-input"
                placeholder="e.g. vrikshitfoundation (link: https://www.instagram.com/vrikshitfoundation)"
                value={form.instagram}
                onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
              />
            </div>
            <div className="ngos-field">
              <label className="ngos-label">No. of followers on Instagram <span className="ngos-optional">(optional)</span></label>
              <input
                type="number"
                className="ngos-input"
                placeholder="e.g. 15000"
                min="0"
                value={form.instagramFollowers}
                onChange={(e) => setForm((f) => ({ ...f, instagramFollowers: e.target.value }))}
              />
            </div>
            <div className="ngos-field">
              <label className="ngos-label">LinkedIn</label>
              <input
                type="text"
                className="ngos-input"
                placeholder="URL or profile"
                value={form.linkedin}
                onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
              />
            </div>
            <div className="ngos-field">
              <label className="ngos-label">Facebook</label>
              <input
                type="text"
                className="ngos-input"
                placeholder="URL or page name"
                value={form.facebook}
                onChange={(e) => setForm((f) => ({ ...f, facebook: e.target.value }))}
              />
            </div>
            <div className="ngos-field">
              <label className="ngos-label">Other</label>
              <input
                type="text"
                className="ngos-input"
                placeholder="Other social media"
                value={form.otherSocial}
                onChange={(e) => setForm((f) => ({ ...f, otherSocial: e.target.value }))}
              />
            </div>
          </div>

          <div className="ngos-field">
            <label className="ngos-label">What they do</label>
            <div className="ngos-checkbox-group">
              {WHAT_THEY_DO_OPTIONS.map((opt) => (
                <label key={opt} className="ngos-checkbox-wrap">
                  <input
                    type="checkbox"
                    checked={form.whatTheyDo.includes(opt)}
                    onChange={() => handleWhatTheyDoToggle(opt)}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
            <input
              type="text"
              className="ngos-input ngos-input-small"
              placeholder="Other (e.g. Health drive, Women empowerment)"
              value={form.otherWhatTheyDo}
              onChange={(e) => setForm((f) => ({ ...f, otherWhatTheyDo: e.target.value }))}
            />
          </div>

          <div className="ngos-field">
            <label className="ngos-label">About the NGO</label>
            <textarea
              className="ngos-input ngos-textarea"
              placeholder="Brief description of the NGO..."
              rows={4}
              value={form.aboutDescription}
              onChange={(e) => setForm((f) => ({ ...f, aboutDescription: e.target.value }))}
            />
          </div>

          <div className="ngos-field-group">
            <span className="ngos-group-label">Founder detail <span className="ngos-optional">(optional)</span></span>
            <div className="ngos-field">
              <label className="ngos-label">Name</label>
              <input
                type="text"
                className="ngos-input"
                placeholder="Founder name"
                value={form.founderName}
                onChange={(e) => setForm((f) => ({ ...f, founderName: e.target.value }))}
              />
            </div>
            <div className="ngos-field">
              <label className="ngos-label">City</label>
              <input
                type="text"
                className="ngos-input"
                placeholder="City"
                value={form.founderCity}
                onChange={(e) => setForm((f) => ({ ...f, founderCity: e.target.value }))}
              />
            </div>
          </div>

          <div className="ngos-field">
            <label className="ngos-label">Image / Logo of NGO <span className="ngos-required">*</span></label>
            <div className="ngos-logo-upload">
              {logoPreview ? (
                <div className="ngos-logo-preview-wrap">
                  <img src={logoPreview} alt="NGO logo preview" className="ngos-logo-preview" />
                  <button type="button" className="ngos-logo-remove" onClick={removeLogo} aria-label="Remove logo">
                    <span className="material-icons-round">close</span>
                  </button>
                </div>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="ngos-file-input"
                    aria-label="Upload NGO logo"
                  />
                  <button
                    type="button"
                    className="ngos-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="material-icons-round">add_photo_alternate</span>
                    Upload image (1 only)
                  </button>
                </>
              )}
            </div>
          </div>

          {error && <div className="ngos-msg ngos-msg-error" role="alert">{error}</div>}
          {success && <div className="ngos-msg ngos-msg-success">{success}</div>}
          <button type="submit" className="ngos-submit-btn" disabled={submitting}>
            Save Changes
          </button>
        </form>
        </div>
      </main>
    </div>
  );
}
