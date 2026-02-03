import React from 'react';
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import './LoginSignup.css';

/**
 * Renders on the route that OAuth redirects back to (redirectUrl).
 * Completes the OAuth flow and redirects to signInFallbackRedirectUrl ('/') when done.
 */
export default function OAuthCallback() {
  return (
    <div className="login-page">
      <div className="login-card">
        <p className="login-helper-text">Completing sign in…</p>
        <AuthenticateWithRedirectCallback
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
        />
      </div>
    </div>
  );
}
