import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import { useNavigate } from 'react-router-dom';
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

function formatTimeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
}

export default function NGOs() {
  const navigate = useNavigate();
  const { loading: authLoading, isSignedIn, user, getToken } = useAuth();
  const [ngos, setNgos] = useState([]);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState('board');
  const [levelFilter, setLevelFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skip, setSkip] = useState(0);
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
  const [expandedDescIds, setExpandedDescIds] = useState(new Set());
  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handleChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const DESC_PREVIEW_LEN = 180;
  const toggleDesc = (id) => {
    setExpandedDescIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getAuthHeaders = useCallback(async (headers = {}) => {
    const token = await getToken();
    if (!token) throw new Error('Unable to acquire auth token');
    return { ...headers, Authorization: `Bearer ${token}` };
  }, [getToken]);

  const authFetch = useCallback(async (url, options = {}) => {
    const headers = await getAuthHeaders(options.headers || {});
    return fetch(url, { ...options, headers });
  }, [getAuthHeaders]);

  const fetchNgos = useCallback(async (skipCount = 0, append = false, viewMode = 'board') => {
    try {
      if (skipCount === 0) setLoading(true);
      else setLoadingMore(true);
      if (viewMode === 'my') {
        const res = await authFetch(`${API_BASE_URL}/api/ngos/my/submissions`);
        if (!res.ok) throw new Error('Failed to fetch your submissions');
        const list = await res.json();
        setNgos(Array.isArray(list) ? list : []);
        setTotal(Array.isArray(list) ? list.length : 0);
        setSkip(list.length);
      } else {
        const params = new URLSearchParams({ limit: 10, skip: skipCount });
        if (levelFilter) params.set('level', levelFilter);
        const res = await authFetch(`${API_BASE_URL}/api/ngos?${params}`);
        if (!res.ok) throw new Error('Failed to fetch NGOs');
        const data = await res.json();
        if (append) {
          setNgos((prev) => [...prev, ...(data.ngos || [])]);
        } else {
          setNgos(data.ngos || []);
        }
        setTotal(data.total ?? 0);
        setSkip(skipCount + (data.ngos?.length || 0));
      }
    } catch (err) {
      setError(err.message || 'Could not load NGOs');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [authFetch, levelFilter]);

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, isSignedIn, navigate]);

  useEffect(() => {
    if (!isSignedIn || authLoading) return;
    setSkip(0);
    fetchNgos(0, false, view);
  }, [isSignedIn, authLoading, view, levelFilter, fetchNgos]);

  const handleWhatTheyDoToggle = (option) => {
    setForm((f) => ({
      ...f,
      whatTheyDo: f.whatTheyDo.includes(option)
        ? f.whatTheyDo.filter((x) => x !== option)
        : [...f.whatTheyDo, option]
    }));
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
    if (!logoFile && !logoPreview) {
      setError('NGO image/logo is required.');
      return;
    }
    setSubmitting(true);
    try {
      let logoUrl = '';
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
      const res = await authFetch(`${API_BASE_URL}/api/ngos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          level: form.level,
          foundInYear: form.foundInYear.trim() ? parseInt(form.foundInYear, 10) : undefined,
          numberOfCities: form.numberOfCities.trim() ? Math.max(0, parseInt(form.numberOfCities, 10)) : undefined,
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
          authorName: user?.fullName || user?.email || 'Anonymous'
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit NGO');
      }
      setSuccess('NGO submitted successfully!');
      setMobileFormOpen(false);
      setForm({
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
        whatTheyDo: [],
        otherWhatTheyDo: '',
        aboutDescription: '',
        founderName: '',
        founderCity: ''
      });
      removeLogo();
      setSkip(0);
      fetchNgos(0, false, view);
    } catch (err) {
      setError(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadMore = () => {
    fetchNgos(skip, true);
  };

  const handleVote = async (ngoId) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/ngos/${ngoId}/vote`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to vote');
      const data = await res.json();
      setNgos((prev) =>
        prev.map((n) =>
          n._id === ngoId ? { ...n, upvotes: data.upvotes, hasVoted: data.hasVoted } : n
        )
      );
    } catch (err) {
      setError(err.message || 'Could not update vote');
    }
  };

  const handleDeleteNgo = async (ngoId) => {
    if (!window.confirm('Delete this NGO? This cannot be undone.')) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/ngos/${ngoId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete NGO');
      }
      setNgos((prev) => prev.filter((n) => n._id !== ngoId));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      setError(err.message || 'Could not delete NGO');
    }
  };

  const instagramUrl = (username) => {
    if (!username) return '';
    const u = username.replace(/^@/, '').trim();
    return u ? `https://www.instagram.com/${u}` : '';
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
        <div className="ngos-layout">
          <aside className="ngos-aside">
            <div className="ngos-form-card">
              {isMobile && !mobileFormOpen ? (
                <button
                  type="button"
                  className="ngos-mobile-submit-btn"
                  onClick={() => setMobileFormOpen(true)}
                >
                  <span className="material-icons-round" aria-hidden="true">add_box</span>
                  Submit an NGO
                </button>
              ) : (
                <>
                  <div className="ngos-form-header-row">
                    <h2 className="ngos-form-title">Submit an NGO</h2>
                    {isMobile && (
                      <button
                        type="button"
                        className="ngos-form-close-mobile"
                        onClick={() => setMobileFormOpen(false)}
                        aria-label="Close form"
                      >
                        <span className="material-icons-round">close</span>
                      </button>
                    )}
                  </div>
                  <p className="ngos-form-desc">Share details of an NGO so others can discover and connect.</p>
                  <form className="ngos-form" onSubmit={handleSubmit}>
                <div className="ngos-field">
                  <label className="ngos-label">NGO name <span className="ngos-required">*</span></label>
                  <input
                    type="text"
                    className="ngos-input"
                    placeholder="Name of the NGO"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
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
                  <span className="material-icons-round" aria-hidden="true">add_box</span>
                  Submit NGO
                </button>
              </form>
                </>
              )}
              <div className="ngos-quick-links">
                <h3 className="ngos-quick-links-title">Quick Links</h3>
                <button
                  type="button"
                  className={`ngos-quick-link ${view === 'my' ? 'active' : ''}`}
                  onClick={() => setView('my')}
                >
                  <span className="material-icons-round" aria-hidden="true">history</span>
                  My Submissions
                </button>
                <button
                  type="button"
                  className={`ngos-quick-link ${view === 'board' ? 'active' : ''}`}
                  onClick={() => setView('board')}
                >
                  <span className="material-icons-round" aria-hidden="true">volunteer_activism</span>
                  All NGOs
                </button>
              </div>
            </div>
          </aside>

          <section className="ngos-board" id="board">
            <div className="ngos-board-header">
              <div className="ngos-board-title-wrap">
                <h2 className="ngos-board-title">
                  {view === 'my' ? 'My NGO Submissions' : 'NGOs'}
                </h2>
                <span className="ngos-board-count">{total}</span>
              </div>
              {view === 'board' && (
                <div className="ngos-level-tabs">
                  <button
                    type="button"
                    className={`ngos-level-tab ${!levelFilter ? 'active' : ''}`}
                    onClick={() => setLevelFilter('')}
                  >
                    All
                  </button>
                  {NGO_LEVELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      className={`ngos-level-tab ${levelFilter === l ? 'active' : ''}`}
                      onClick={() => setLevelFilter(l)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loading ? (
              <div className="ngos-loading">Loading NGOs...</div>
            ) : (
              <div className="ngos-list">
                {ngos.map((n) => {
                  const hasVoted = n.hasVoted === true;
                  const upvotes = n.upvotes ?? 0;
                  return (
                  <article key={n._id} className="ngos-card">
                    <div className="ngos-card-logo-wrap">
                      <div className="ngos-card-logo">
                        {n.logoUrl ? (
                          <img src={n.logoUrl} alt="" className="ngos-card-logo-img" />
                        ) : (
                          <span className="ngos-card-logo-placeholder">
                            <span className="material-icons-round">business</span>
                          </span>
                        )}
                      </div>
                      <div className="ngos-card-vote">
                        <button
                          type="button"
                          className={`ngos-vote-btn ${hasVoted ? 'voted' : ''}`}
                          onClick={() => handleVote(n._id)}
                          aria-label={hasVoted ? 'Remove like' : 'Like this NGO'}
                        >
                          <span className="material-icons-round">favorite</span>
                          <span className="ngos-vote-count">{upvotes}</span>
                        </button>
                      </div>
                    </div>
                    <div className="ngos-card-body">
                      <div className="ngos-card-head">
                        <h3 className="ngos-card-title">{n.name}</h3>
                        <div className="ngos-card-head-right">
                          <span className="ngos-level-pill">{n.level}</span>
                          {(user?.role === 'admin' || n.authorId === user?.id) && (
                            <button
                              type="button"
                              className="ngos-delete-btn"
                              onClick={() => handleDeleteNgo(n._id)}
                              aria-label="Delete NGO"
                              title="Delete NGO"
                            >
                              <span className="material-icons-round">delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                      {(n.foundInYear != null || (n.numberOfCities != null && n.numberOfCities > 0)) && (
                        <p className="ngos-card-extra">
                          {n.foundInYear != null && <span>Founded {n.foundInYear}</span>}
                          {n.foundInYear != null && n.numberOfCities != null && n.numberOfCities > 0 && ' · '}
                          {n.numberOfCities != null && n.numberOfCities > 0 && (
                            <span>Operates in {n.numberOfCities} {n.numberOfCities === 1 ? 'city' : 'cities'}</span>
                          )}
                        </p>
                      )}
                      {n.aboutDescription && (
                        <div className="ngos-card-desc-wrap">
                          <p className="ngos-card-desc">
                            {expandedDescIds.has(n._id) || n.aboutDescription.length <= DESC_PREVIEW_LEN ? (
                              n.aboutDescription
                            ) : (
                              <>
                                {n.aboutDescription.slice(0, DESC_PREVIEW_LEN).trim()}
                                …{' '}
                                <button
                                  type="button"
                                  className="ngos-show-more-btn"
                                  onClick={() => toggleDesc(n._id)}
                                >
                                  Read more
                                </button>
                              </>
                            )}
                            {n.aboutDescription.length > DESC_PREVIEW_LEN && expandedDescIds.has(n._id) && (
                              <>
                                {' '}
                                <button
                                  type="button"
                                  className="ngos-show-more-btn"
                                  onClick={() => toggleDesc(n._id)}
                                >
                                  Read less
                                </button>
                              </>
                            )}
                          </p>
                        </div>
                      )}
                      {n.whatTheyDo && n.whatTheyDo.length > 0 && (
                        <div className="ngos-card-tags">
                          {n.whatTheyDo.slice(0, 5).map((w) => (
                            <span key={w} className="ngos-tag">{w}</span>
                          ))}
                          {n.whatTheyDo.length > 5 && (
                            <span className="ngos-tag">+{n.whatTheyDo.length - 5}</span>
                          )}
                        </div>
                      )}
                      {(n.founder?.name || n.founder?.city) && (
                        <p className="ngos-card-founder">
                          Founder: {[n.founder.name, n.founder.city].filter(Boolean).join(', ')}
                        </p>
                      )}
                      <div className="ngos-card-meta">
                        <div className="ngos-card-links">
                          {n.socialMedia?.website && (
                            <a href={n.socialMedia.website} target="_blank" rel="noopener noreferrer" className="ngos-link" title="Website">🌐</a>
                          )}
                          {n.socialMedia?.instagram && (
                            <a href={instagramUrl(n.socialMedia.instagram)} target="_blank" rel="noopener noreferrer" className="ngos-link" title="Instagram">📷</a>
                          )}
                          {n.socialMedia?.linkedin && (
                            <a href={n.socialMedia.linkedin.startsWith('http') ? n.socialMedia.linkedin : `https://linkedin.com/company/${n.socialMedia.linkedin}`} target="_blank" rel="noopener noreferrer" className="ngos-link" title="LinkedIn">in</a>
                          )}
                          {n.socialMedia?.facebook && (
                            <a href={n.socialMedia.facebook.startsWith('http') ? n.socialMedia.facebook : `https://facebook.com/${n.socialMedia.facebook}`} target="_blank" rel="noopener noreferrer" className="ngos-link" title="Facebook">f</a>
                          )}
                        </div>
                        <span className="ngos-time">{formatTimeAgo(n.createdAt)}</span>
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>
            )}

            {!loading && view === 'board' && ngos.length > 0 && ngos.length < total && (
              <div className="ngos-load-more-wrap">
                <button
                  type="button"
                  className="ngos-load-more-btn"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading...' : 'Load more NGOs'}
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
