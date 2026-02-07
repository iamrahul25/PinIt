import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import BackendHealthChecker from './components/BackendHealthChecker';
import LoginSignup from './pages/LoginSignup';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <BackendHealthChecker>
          <Routes>
            <Route path="/login" element={<LoginSignup />} />
            <Route path="/profile" element={<App />} />
            <Route path="/suggestions" element={<App />} />
            <Route path="/pin/:pinId" element={<App />} />
            <Route path="/" element={<App />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BackendHealthChecker>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
