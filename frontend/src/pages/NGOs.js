import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import { useNavigate } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { FaInstagram, FaLinkedin, FaFacebookF, FaGlobe } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import Toast from '../components/Toast';
import './NGOs.css';

const NGOS_QUERY_KEY = ['ngos'];
const STALE_TIME_MS = 5 * 60 * 1000; // 5 mins – no refetch on route remount when data is fresh
const PAGE_SIZE = 10;

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
  const queryClient = useQueryClient();
  const { loading: authLoading, isSignedIn, user, getToken } = useAuth();
  const [view, setView] = useState('board');
  const [levelFilter, setLevelFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [filterCityInput, setFilterCityInput] = useState('');
  const [allCities, setAllCities] = useState([]);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const cityComboRef = useRef(null);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [form, setForm] = useState({
    name: '',
    email: '',
    level: 'City',
    foundInYear: '',
    numberOfCities: '',
    cities: [],
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
  const [cityInput, setCityInput] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedDescIds, setExpandedDescIds] = useState(new Set());
  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState('');
  const [editingNgo, setEditingNgo] = useState(null);
  const fileInputRef = useRef(null);

  // ── Toast notification state ─────────────────────────────────────
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const showToast = useCallback((message, type = 'info') => {
    setToast({ visible: true, message, type });
  }, []);
  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

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

  const fetchMyNgos = useCallback(async () => {
    const res = await authFetch(`${API_BASE_URL}/api/ngos/my/submissions`);
    if (!res.ok) throw new Error('Failed to fetch your submissions');
    const list = await res.json();
    return Array.isArray(list) ? list : [];
  }, [authFetch]);

  const fetchBoardPage = useCallback(async ({ pageParam = 0 }) => {
    const params = new URLSearchParams({ limit: PAGE_SIZE, skip: pageParam });
    if (levelFilter) params.set('level', levelFilter);
    if (cityFilter.trim()) params.set('city', cityFilter.trim());
    const res = await authFetch(`${API_BASE_URL}/api/ngos?${params}`);
    if (!res.ok) throw new Error('Failed to fetch NGOs');
    const data = await res.json();
    return { ngos: data.ngos || [], total: data.total ?? 0 };
  }, [authFetch, levelFilter, cityFilter]);

  const enabled = Boolean(isSignedIn && !authLoading);
  const myQuery = useQuery({
    queryKey: [...NGOS_QUERY_KEY, 'my'],
    queryFn: fetchMyNgos,
    enabled: enabled && view === 'my',
    staleTime: STALE_TIME_MS,
  });

  const boardQuery = useInfiniteQuery({
    queryKey: [...NGOS_QUERY_KEY, 'board', levelFilter, cityFilter],
    queryFn: fetchBoardPage,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + (p.ngos?.length ?? 0), 0);
      return loaded < (lastPage.total ?? 0) ? loaded : undefined;
    },
    enabled: enabled && view === 'board',
    staleTime: STALE_TIME_MS,
  });

  const ngosRaw = view === 'my'
    ? (myQuery.data ?? [])
    : (boardQuery.data?.pages?.flatMap((p) => p.ngos ?? []) ?? []);
  const ngos = React.useMemo(() => {
    if (!sortBy) return ngosRaw;
    const list = [...ngosRaw];
    const mult = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'foundInYear') {
      list.sort((a, b) => {
        const ay = a.foundInYear ?? 0;
        const by = b.foundInYear ?? 0;
        if (ay !== by) return mult * (ay - by);
        return 0;
      });
    } else if (sortBy === 'followers') {
      list.sort((a, b) => {
        const af = a.socialMedia?.instagramFollowers ?? 0;
        const bf = b.socialMedia?.instagramFollowers ?? 0;
        if (af !== bf) return mult * (af - bf);
        return 0;
      });
    } else if (sortBy === 'numberOfCities') {
      list.sort((a, b) => {
        const ac = a.numberOfCities ?? 0;
        const bc = b.numberOfCities ?? 0;
        if (ac !== bc) return mult * (ac - bc);
        return 0;
      });
    } else if (sortBy === 'upvotes') {
      list.sort((a, b) => {
        const au = a.upvotes ?? 0;
        const bu = b.upvotes ?? 0;
        if (au !== bu) return mult * (au - bu);
        return 0;
      });
    }
    return list;
  }, [ngosRaw, sortBy, sortOrder]);
  const total = view === 'my'
    ? (myQuery.data?.length ?? 0)
    : (boardQuery.data?.pages?.[0]?.total ?? 0);
  const loading = view === 'my' ? myQuery.isLoading : boardQuery.isLoading;

  const handleSort = useCallback((field) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }, [sortBy]);

  const sortIndicator = (field) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };
  const loadingMore = view === 'board' && boardQuery.isFetchingNextPage;
  const fetchError = view === 'my' ? myQuery.error : boardQuery.error;

  // Fetch distinct cities from NGOs
  const fetchCities = useCallback(async () => {
    if (allCities.length > 0) return;
    setCitiesLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/ngos/cities`);
      if (res.ok) {
        const data = await res.json();
        setAllCities(data.cities || []);
      }
    } catch {
      // silently ignore
    } finally {
      setCitiesLoading(false);
    }
  }, [authFetch, allCities.length]);

  // Close city dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (cityComboRef.current && !cityComboRef.current.contains(e.target)) {
        setCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const citySuggestions = useMemo(() => {
    if (!filterCityInput.trim()) return allCities;
    const q = filterCityInput.trim().toLowerCase();
    return allCities.filter((c) => c.toLowerCase().includes(q));
  }, [allCities, filterCityInput]);

  const handleCityFilterReset = () => {
    setFilterCityInput('');
    setCityFilter('');
    setCityDropdownOpen(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, isSignedIn, navigate]);

  useEffect(() => {
    if (fetchError) setError(fetchError.message || 'Could not load NGOs');
    else setError('');
  }, [fetchError]);

  const updateNgoInCache = useCallback((ngoId, updater) => {
    queryClient.setQueryData([...NGOS_QUERY_KEY, 'my'], (prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((n) => (n._id === ngoId ? updater(n) : n));
    });
    queryClient.setQueriesData({ queryKey: [...NGOS_QUERY_KEY, 'board'], exact: false }, (prev) => {
      if (!prev?.pages) return prev;
      return {
        ...prev,
        pages: prev.pages.map((page) => ({
          ...page,
          ngos: (page.ngos ?? []).map((n) => (n._id === ngoId ? updater(n) : n)),
        })),
      };
    });
  }, [queryClient]);

  useEffect(() => {
    if (editingNgo) {
      setForm({
        name: editingNgo.name || '',
        email: editingNgo.email || '',
        level: editingNgo.level || 'City',
        foundInYear: editingNgo.foundInYear || '',
        numberOfCities: editingNgo.numberOfCities || '',
        cities: editingNgo.cities || [],
        website: editingNgo.socialMedia?.website || '',
        instagram: editingNgo.socialMedia?.instagram || '',
        linkedin: editingNgo.socialMedia?.linkedin || '',
        facebook: editingNgo.socialMedia?.facebook || '',
        otherSocial: editingNgo.socialMedia?.other || '',
        instagramFollowers: editingNgo.socialMedia?.instagramFollowers || '',
        whatTheyDo: editingNgo.whatTheyDo || [],
        otherWhatTheyDo: '',
        aboutDescription: editingNgo.aboutDescription || '',
        founderName: editingNgo.founder?.name || '',
        founderCity: editingNgo.founder?.city || ''
      });
      setLogoPreview(editingNgo.logoUrl || '');
      setVerificationResult('Available'); // Assume verified if editing an existing NGO
    } else {
      // Reset form for new NGO creation
      setForm({
        name: '',
        email: '',
        level: 'City',
        foundInYear: '',
        numberOfCities: '',
        cities: [],
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
      setLogoFile(null);
      setLogoPreview('');
      setVerificationResult('');
    }
    setCityInput('');
    setError('');
    setSuccess('');
    setSubmitting(false);
  }, [editingNgo]);

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
    setVerificationResult(''); // Reset verification result on name change
  };

  const handleCityKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const city = cityInput.trim();
      if (city && !form.cities.includes(city)) {
        setForm((f) => ({ ...f, cities: [...f.cities, city] }));
        setCityInput('');
      }
    }
  };

  const handleRemoveCity = (cityToRemove) => {
    setForm((f) => ({ ...f, cities: f.cities.filter((c) => c !== cityToRemove) }));
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
      if (data.found && (!editingNgo || data.ngo._id !== editingNgo._id)) {
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
    if (form.name.trim() && verificationResult !== 'Available') {
      setError('Please verify the NGO name for uniqueness.');
      return;
    }
    if (!logoFile && !logoPreview) {
      setError('NGO image/logo is required.');
      return;
    }
    setSubmitting(true);
    try {
      let logoUrl = logoPreview; // Start with current preview URL (might be existing NGO logo)
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
        throw new Error('NGO image/logo is required and upload failed.');
      }
      const whatTheyDoList = [...form.whatTheyDo];
      if (form.otherWhatTheyDo.trim()) whatTheyDoList.push(form.otherWhatTheyDo.trim());
      const instagramInput = form.instagram.trim();
      const instagramUsername = instagramInput.match(/instagram\.com\/([^/?]+)/i)
        ? instagramInput.replace(/^.*instagram\.com\/([^/?]+).*$/i, '$1').replace(/^@/, '')
        : instagramInput.replace(/^@/, '');
      const method = editingNgo ? 'PUT' : 'POST';
      const url = editingNgo ? `${API_BASE_URL}/api/ngos/${editingNgo._id}` : `${API_BASE_URL}/api/ngos`;

      const res = await authFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          level: form.level,
          foundInYear: form.foundInYear.toString().trim() ? parseInt(form.foundInYear, 10) : undefined,
          numberOfCities: form.numberOfCities.toString().trim() ? Math.max(0, parseInt(form.numberOfCities, 10)) : undefined,
          cities: form.cities,
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
          authorName: user?.fullName || user?.email || 'Anonymous',
          instagramFollowers: form.instagramFollowers.toString().trim() ? parseInt(form.instagramFollowers, 10) : undefined
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to ${editingNgo ? 'update' : 'submit'} NGO`);
      }
      showToast(`NGO ${editingNgo ? 'updated' : 'submitted'} successfully!`, 'success');
      setMobileFormOpen(false);
      setEditingNgo(null); // Exit editing mode
      setForm({
        name: '',
        email: '',
        level: 'City',
        foundInYear: '',
        numberOfCities: '',
        cities: [],
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
      setCityInput('');
      removeLogo();
      queryClient.invalidateQueries({ queryKey: NGOS_QUERY_KEY });
    } catch (err) {
      showToast(err.message || `Failed to ${editingNgo ? 'update' : 'submit'}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadMore = () => {
    boardQuery.fetchNextPage();
  };

  const handleVote = async (ngoId) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/ngos/${ngoId}/vote`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to vote');
      const data = await res.json();
      updateNgoInCache(ngoId, (n) => ({ ...n, upvotes: data.upvotes, hasVoted: data.hasVoted }));
      showToast(data.hasVoted ? 'Liked!' : 'Like removed', 'success');
    } catch (err) {
      showToast(err.message || 'Could not update vote', 'error');
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
      queryClient.setQueryData([...NGOS_QUERY_KEY, 'my'], (prev) =>
        Array.isArray(prev) ? prev.filter((n) => n._id !== ngoId) : prev
      );
      queryClient.setQueriesData({ queryKey: [...NGOS_QUERY_KEY, 'board'], exact: false }, (prev) => {
        if (!prev?.pages) return prev;
        const firstTotal = prev.pages[0]?.total ?? 0;
        return {
          ...prev,
          pages: prev.pages.map((page, i) => ({
            ...page,
            ngos: (page.ngos ?? []).filter((n) => n._id !== ngoId),
            total: i === 0 ? Math.max(0, firstTotal - 1) : page.total,
          })),
        };
      });
      showToast('NGO deleted successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Could not delete NGO', 'error');
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
                    <h2 className="ngos-form-title">{editingNgo ? 'Edit NGO' : 'Submit an NGO'}</h2>
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
                  <p className="ngos-form-desc">{editingNgo ? 'Update the details of the NGO.' : 'Share details of an NGO so others can discover and connect.'}</p>
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
                    <div className="ngos-field">
                      <label className="ngos-label">Name of cities it operates in <span className="ngos-optional">(optional)</span></label>
                      <p className="ngos-field-hint">Type a city name and press Enter to add. Add more cities by pressing Enter after each one.</p>
                      <input
                        type="text"
                        className="ngos-input"
                        placeholder="e.g. Mumbai — press Enter to add"
                        value={cityInput}
                        onChange={(e) => setCityInput(e.target.value)}
                        onKeyDown={handleCityKeyDown}
                      />
                      {form.cities.length > 0 && (
                        <div className="ngos-cities-tags">
                          {form.cities.map((city, index) => (
                            <span key={`${city}-${index}`} className="ngos-city-tag">
                              {city}
                              <button
                                type="button"
                                className="ngos-city-tag-remove"
                                onClick={() => handleRemoveCity(city)}
                                aria-label={`Remove ${city}`}
                              >
                                <span className="material-icons-round">close</span>
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
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
                    <div className="ngos-form-actions">
                      {editingNgo && (
                        <button type="button" className="ngos-cancel-btn" onClick={() => setEditingNgo(null)}>
                          Cancel
                        </button>
                      )}
                      <button type="submit" className="ngos-submit-btn" disabled={submitting}>
                        <span className="material-icons-round" aria-hidden="true">add_box</span>
                        {editingNgo ? 'Save Changes' : 'Submit NGO'}
                      </button>
                    </div>
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
                <button
                  type="button"
                  className="ngos-refresh-btn"
                  onClick={() => (view === 'my' ? myQuery.refetch() : boardQuery.refetch())}
                  disabled={view === 'my' ? myQuery.isFetching : boardQuery.isFetching}
                  aria-label="Refresh list"
                  title="Refresh list"
                >
                  <span className="material-icons-round" aria-hidden="true">refresh</span>
                </button>
              </div>
              {view === 'board' && (
                <div className="ngos-filters-row">
                  <div className="ngos-level-filter-wrap">
                    <label htmlFor="ngos-level-filter" className="ngos-level-filter-label">NGO Level</label>
                    <select
                      id="ngos-level-filter"
                      className="ngos-level-filter-select"
                      value={levelFilter}
                      onChange={(e) => setLevelFilter(e.target.value)}
                      aria-label="NGO level"
                    >
                      <option value="">All</option>
                      <option value="City">City</option>
                      <option value="State">State</option>
                      <option value="National">National</option>
                      <option value="International">International</option>
                    </select>
                  </div>
                  <div className="ngos-city-combobox" ref={cityComboRef}>
                    <div className="ngos-city-combobox-input-wrap">
                      <span className="material-icons-round ngos-city-combobox-icon">location_on</span>
                      <input
                        id="ngos-city-filter"
                        type="text"
                        className="ngos-city-combobox-input"
                        placeholder="Search city..."
                        value={filterCityInput}
                        autoComplete="off"
                        onChange={(e) => {
                          setFilterCityInput(e.target.value);
                          setCityDropdownOpen(true);
                        }}
                        onFocus={() => { setCityDropdownOpen(true); fetchCities(); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setCityDropdownOpen(false);
                          if (e.key === 'Enter') {
                            setCityFilter(filterCityInput);
                            setCityDropdownOpen(false);
                          }
                        }}
                        aria-label="Filter by city"
                        aria-autocomplete="list"
                        aria-expanded={cityDropdownOpen}
                      />
                      {filterCityInput && (
                        <button
                          type="button"
                          className="ngos-city-combobox-clear"
                          onClick={() => { setFilterCityInput(''); setCityDropdownOpen(true); }}
                          aria-label="Clear city"
                        >
                          <span className="material-icons-round">close</span>
                        </button>
                      )}
                    </div>
                    {cityDropdownOpen && (
                      <div className="ngos-city-dropdown" role="listbox" aria-label="City suggestions">
                        {citiesLoading ? (
                          <div className="ngos-city-dropdown-loading">
                            <span className="material-icons-round ngos-city-dropdown-spinner">sync</span>
                            Loading cities…
                          </div>
                        ) : citySuggestions.length === 0 ? (
                          <div className="ngos-city-dropdown-empty">No cities found</div>
                        ) : (
                          citySuggestions.map((city) => (
                            <button
                              key={city}
                              type="button"
                              role="option"
                              className={`ngos-city-option${filterCityInput === city ? ' selected' : ''}`}
                              onClick={() => {
                                setFilterCityInput(city);
                                setCityFilter(city);
                                setCityDropdownOpen(false);
                              }}
                            >
                              <span className="material-icons-round ngos-city-option-icon">place</span>
                              {city}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {(cityFilter || levelFilter) && (
                    <button
                      type="button"
                      className="ngos-filter-reset-btn"
                      onClick={() => { handleCityFilterReset(); setLevelFilter(''); }}
                    >
                      <span className="material-icons-round">close</span>
                      Reset filters
                    </button>
                  )}
                </div>
              )}
              <div className="ngos-sort-wrap">
                <span className="ngos-sort-label">Sort:</span>
                <button
                  type="button"
                  className={`ngos-sort-btn ${sortBy === 'foundInYear' ? 'active' : ''}`}
                  onClick={() => handleSort('foundInYear')}
                  aria-pressed={sortBy === 'foundInYear'}
                  aria-label={sortBy === 'foundInYear' ? `Founding Year ${sortOrder === 'asc' ? 'ascending' : 'descending'}, click to reverse` : 'Sort by Founding Year'}
                >
                  Founding Year{sortIndicator('foundInYear')}
                </button>
                <button
                  type="button"
                  className={`ngos-sort-btn ${sortBy === 'followers' ? 'active' : ''}`}
                  onClick={() => handleSort('followers')}
                  aria-pressed={sortBy === 'followers'}
                  aria-label={sortBy === 'followers' ? `Number of followers ${sortOrder === 'asc' ? 'ascending' : 'descending'}, click to reverse` : 'Sort by Number of followers'}
                >
                  Number of followers{sortIndicator('followers')}
                </button>
                <button
                  type="button"
                  className={`ngos-sort-btn ${sortBy === 'numberOfCities' ? 'active' : ''}`}
                  onClick={() => handleSort('numberOfCities')}
                  aria-pressed={sortBy === 'numberOfCities'}
                  aria-label={sortBy === 'numberOfCities' ? `No. of cities ${sortOrder === 'asc' ? 'ascending' : 'descending'}, click to reverse` : 'Sort by No. of cities it operates'}
                >
                  No. of cities it operates{sortIndicator('numberOfCities')}
                </button>
                <button
                  type="button"
                  className={`ngos-sort-btn ${sortBy === 'upvotes' ? 'active' : ''}`}
                  onClick={() => handleSort('upvotes')}
                  aria-pressed={sortBy === 'upvotes'}
                  aria-label={sortBy === 'upvotes' ? `Number of likes ${sortOrder === 'asc' ? 'ascending' : 'descending'}, click to reverse` : 'Sort by number of likes'}
                >
                  Number of likes{sortIndicator('upvotes')}
                </button>
              </div>
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
                          <h3 className="ngos-card-title">
                            <button
                              type="button"
                              className="ngos-card-title-link"
                              onClick={() => navigate(`/ngo/${n._id}`)}
                            >
                              {n.name}
                            </button>
                          </h3>
                          <div className="ngos-card-head-right">
                            <span className="ngos-level-pill">{n.level}</span>
                            {(user?.role === 'admin' || n.authorId === user?.id) && (
                              <>
                                <button
                                  type="button"
                                  className="ngos-edit-btn"
                                  onClick={() => setEditingNgo(n)}
                                  aria-label="Edit NGO"
                                  title="Edit NGO"
                                >
                                  <span className="material-icons-round">edit</span>
                                </button>
                                <button
                                  type="button"
                                  className="ngos-delete-btn"
                                  onClick={() => handleDeleteNgo(n._id)}
                                  aria-label="Delete NGO"
                                  title="Delete NGO"
                                >
                                  <span className="material-icons-round">delete</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {(n.foundInYear != null || (n.numberOfCities != null && n.numberOfCities > 0) || (n.cities && n.cities.length > 0)) && (
                          <p className="ngos-card-extra">
                            {n.foundInYear != null && <span>Founded {n.foundInYear}</span>}
                            {n.foundInYear != null && (n.numberOfCities != null && n.numberOfCities > 0 || (n.cities && n.cities.length > 0)) && ' · '}
                            {n.numberOfCities != null && n.numberOfCities > 0 && (
                              <span>Operates in {n.numberOfCities} {n.numberOfCities === 1 ? 'city' : 'cities'}</span>
                            )}
                            {n.cities && n.cities.length > 0 && (
                              <span className="ngos-card-cities">
                                {(n.foundInYear != null || (n.numberOfCities != null && n.numberOfCities > 0)) ? ' · ' : ''}
                                Cities: {n.cities.join(', ')}
                              </span>
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
                              <a href={n.socialMedia.website} target="_blank" rel="noopener noreferrer" className="ngos-link ngos-link-website" title="Website" aria-label="Website"><FaGlobe /></a>
                            )}
                            {n.socialMedia?.instagram && (
                              <a href={instagramUrl(n.socialMedia.instagram)} target="_blank" rel="noopener noreferrer" className="ngos-link ngos-link-instagram" title="Instagram" aria-label="Instagram"><FaInstagram /></a>
                            )}
                            {n.socialMedia?.linkedin && (
                              <a href={n.socialMedia.linkedin.startsWith('http') ? n.socialMedia.linkedin : `https://linkedin.com/company/${n.socialMedia.linkedin}`} target="_blank" rel="noopener noreferrer" className="ngos-link ngos-link-linkedin" title="LinkedIn" aria-label="LinkedIn"><FaLinkedin /></a>
                            )}
                            {n.socialMedia?.facebook && (
                              <a href={n.socialMedia.facebook.startsWith('http') ? n.socialMedia.facebook : `https://facebook.com/${n.socialMedia.facebook}`} target="_blank" rel="noopener noreferrer" className="ngos-link ngos-link-facebook" title="Facebook" aria-label="Facebook"><FaFacebookF /></a>
                            )}
                          </div>
                          <span className="ngos-followers">Followers: {n.socialMedia?.instagramFollowers > 0 ? n.socialMedia.instagramFollowers : 'NA'}</span>
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
      
      {/* ── Toast Notification ──────────────────────────────────────── */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />
    </div>
  );
}
