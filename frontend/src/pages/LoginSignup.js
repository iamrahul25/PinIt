import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignIn, useUser } from '@clerk/clerk-react';
import './LoginSignup.css';

const SOCIAL_PROVIDERS = [
  { label: 'Continue with Google', strategy: 'oauth_google', key: 'google' },
  { label: 'Continue with Apple', strategy: 'oauth_apple', key: 'apple' },
  { label: 'Continue with Microsoft', strategy: 'oauth_microsoft', key: 'microsoft' }
];

export default function LoginSignup() {
  const navigate = useNavigate();
  const { isSignedIn } = useUser();
  const { signIn, isLoaded } = useSignIn();
  const [error, setError] = useState('');
  const [pendingProvider, setPendingProvider] = useState('');

  useEffect(() => {
    if (isSignedIn) {
      navigate('/', { replace: true });
    }
  }, [isSignedIn, navigate]);

  const handleSocialSignIn = async (strategy, key) => {
    setError('');
    setPendingProvider(key);
    if (!isLoaded || !signIn) {
      setError('Authentication service is not ready. Please try again.');
      setPendingProvider('');
      return;
    }
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/'
      });
    } catch (err) {
      const message =
        err?.errors?.[0]?.longMessage ||
        err?.message ||
        'Unable to continue with that provider right now.';
      setError(message);
      setPendingProvider('');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon" aria-hidden="true">📍</div>
          <div>
            <h1>Pin-It</h1>
            <p>Report and track civic issues effortlessly.</p>
          </div>
        </div>

        <p className="login-helper-text">
          Sign up or sign in using your preferred account.
        </p>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <div className="login-buttons">
          {SOCIAL_PROVIDERS.map(({ label, strategy, key }) => (
            <button
              key={key}
              type="button"
              className="login-provider-btn"
              onClick={() => handleSocialSignIn(strategy, key)}
              disabled={!!pendingProvider}
            >
              <img
                src={`${process.env.PUBLIC_URL || ''}/icons/${key}-icon.svg`}
                alt=""
                className="login-provider-icon"
                width={24}
                height={24}
              />
              {pendingProvider === key ? 'Redirecting…' : label}
            </button>
          ))}
        </div>

        <p className="login-disclaimer">
          Only Google, Apple, or Microsoft accounts are supported.
        </p>
      </div>
    </div>
  );
}
