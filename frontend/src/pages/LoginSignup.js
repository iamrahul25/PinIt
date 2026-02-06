import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import './LoginSignup.css';

const TICKER_ITEMS = [
  { dot: 'rose', strong: 'Broken Streetlight', text: ' reported in Downtown' },
  { dot: 'blue', strong: 'Pothole', text: ' fixed on 5th Avenue' },
  { dot: 'rose', strong: 'Graffiti Removal', text: ' requested at Park St.' },
  { dot: 'amber', strong: 'Clogged Drain', text: ' reported by @citizenX' },
  { dot: 'red', strong: 'Illegal Parking', text: ' reported in Suburbia' },
];

function LoginContent() {
  const navigate = useNavigate();
  const { isSignedIn, login } = useAuth();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      navigate('/', { replace: true });
    }
  }, [isSignedIn, navigate]);

  const handleSuccess = async (credentialResponse) => {
    const credential = credentialResponse?.credential;
    if (!credential) {
      setError('No credential received from Google');
      return;
    }
    setPending(true);
    setError('');
    try {
      await login(credential);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setPending(false);
    }
  };

  const handleError = () => {
    setError('Google sign in was cancelled or failed');
    setPending(false);
  };

  return (
    <div className="login-page">
      <div className="login-background-decor">
        <div className="login-decor-item item-1">
          <span className="material-icons-round login-glow-pin">location_on</span>
        </div>
        <div className="login-decor-item item-2">
          <span className="material-icons-round login-glow-pin">location_on</span>
        </div>
        <div className="login-decor-item item-3">
          <span className="material-icons-round login-glow-pin">location_on</span>
        </div>
        <div className="login-decor-item item-4">
          <span className="material-icons-round login-glow-pin">location_on</span>
        </div>
      </div>

      <main className="login-main-container">
        <div className="login-card">
          <div className="login-logo-box">
            <span className="material-icons-round login-logo-icon">push_pin</span>
          </div>
          <h1 className="login-brand-title">Pin-It</h1>
          <p className="login-brand-tagline">
            Report and track civic issues effortlessly in your neighborhood.
          </p>

          <div className="login-auth-section">
            <p className="login-auth-label">Sign up or sign in</p>
            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}
            <div className="login-google-wrap">
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={handleError}
                useOneTap={false}
                render={(renderProps) => (
                  <button
                    type="button"
                    className="login-google-btn"
                    onClick={renderProps.onClick}
                    disabled={renderProps.disabled || pending}
                  >
                    <svg viewBox="0 0 48 48" aria-hidden="true">
                      <path
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        fill="#EA4335"
                      />
                      <path
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        fill="#4285F4"
                      />
                      <path
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        fill="#34A853"
                      />
                    </svg>
                    <span className="login-btn-text">
                      {pending ? 'Signing in…' : 'Sign in with Google'}
                    </span>
                  </button>
                )}
              />
            </div>
          </div>
        </div>
      </main>

      <footer className="login-ticker-footer">
        <div className="login-ticker-container">
          <div className="login-ticker-scroll">
            <div className="login-ticker-content">
              {TICKER_ITEMS.map((item, i) => (
                <span key={`a-${i}`} className="login-ticker-item">
                  <i className={`login-ticker-dot ${item.dot}`} />
                  <span>
                    <strong>{item.strong}</strong>
                    {item.text}
                  </span>
                </span>
              ))}
            </div>
            <div className="login-ticker-content">
              {TICKER_ITEMS.map((item, i) => (
                <span key={`b-${i}`} className="login-ticker-item">
                  <i className={`login-ticker-dot ${item.dot}`} />
                  <span>
                    <strong>{item.strong}</strong>
                    {item.text}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function LoginSignup() {
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return (
      <div className="login-page">
        <div className="login-main-container">
          <div className="login-card">
            <div className="login-error" role="alert">
              Missing REACT_APP_GOOGLE_CLIENT_ID. Add it to frontend/.env
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <LoginContent />
    </GoogleOAuthProvider>
  );
}
