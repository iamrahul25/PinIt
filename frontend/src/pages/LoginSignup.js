import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import './LoginSignup.css';

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
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon" aria-hidden="true">📍</div>
          <div>
            <h1>Pin-It</h1>
            <p>Report and track civic issues effortlessly.</p>
          </div>
        </div>

        <p className="login-helper-text">
          Sign up or sign in with your Google account.
        </p>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <div className="login-buttons">
          <div className="login-google-wrap">
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={handleError}
              useOneTap={false}
              render={(renderProps) => (
                <button
                  type="button"
                  className="login-provider-btn"
                  onClick={renderProps.onClick}
                  disabled={renderProps.disabled || pending}
                >
                  <img
                    src={`${process.env.PUBLIC_URL || ''}/icons/google-icon.svg`}
                    alt=""
                    className="login-provider-icon"
                    width={24}
                    height={24}
                  />
                  {pending ? 'Signing in…' : 'Continue with Google'}
                </button>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginSignup() {
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-error" role="alert">
            Missing REACT_APP_GOOGLE_CLIENT_ID. Add it to frontend/.env
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
