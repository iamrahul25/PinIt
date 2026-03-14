import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const TOKEN_KEY = 'pinit_token';
const USER_KEY = 'pinit_user';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionExpiredHandlerRef = useRef(null);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (credential) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Login failed');
    }
    const { token: newToken, user: newUser } = await response.json();
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const getToken = useCallback(() => {
    return Promise.resolve(localStorage.getItem(TOKEN_KEY));
  }, []);

  const getAuthHeaders = useCallback(async (headers = {}) => {
    const t = await getToken();
    if (!t) throw new Error('Unable to acquire auth token');
    return { ...headers, Authorization: `Bearer ${t}` };
  }, [getToken]);

  const handleSessionExpired = useCallback(() => {
    logout();
    sessionExpiredHandlerRef.current?.();
  }, [logout]);

  const authFetch = useCallback(async (url, options = {}) => {
    const headers = await getAuthHeaders(options.headers || {});
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      handleSessionExpired();
      throw new Error('Session expired');
    }
    return res;
  }, [getAuthHeaders, handleSessionExpired]);

  const registerSessionExpiredHandler = useCallback((handler) => {
    sessionExpiredHandlerRef.current = handler;
  }, []);

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err?.response?.status === 401) {
          handleSessionExpired();
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(interceptorId);
  }, [handleSessionExpired]);

  const value = {
    user,
    token,
    loading,
    isSignedIn: !!user,
    login,
    logout,
    getToken,
    getAuthHeaders,
    authFetch,
    registerSessionExpiredHandler,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
