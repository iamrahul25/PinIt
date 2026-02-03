import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import BackendHealthChecker from './components/BackendHealthChecker';
import LoginSignup from './pages/LoginSignup';
import OAuthCallback from './pages/OAuthCallback';
import App from './App';
import './index.css';

const clerkPublishableKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  throw new Error('Missing REACT_APP_CLERK_PUBLISHABLE_KEY environment variable.');
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <BrowserRouter>
        <BackendHealthChecker>
          <Routes>
            <Route path="/login" element={<LoginSignup />} />
            <Route path="/sso-callback" element={<OAuthCallback />} />
            <Route path="/pin/:pinId" element={<App />} />
            <Route path="/" element={<App />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BackendHealthChecker>
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
);
