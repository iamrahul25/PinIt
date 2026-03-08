import React from 'react';
import { useAuth } from '../context/AuthContext';
import Home from './Home';
import App from '../App';

function MainLayout() {
  const { isSignedIn, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{
          fontSize: '1.25rem',
          color: '#64748b',
          fontWeight: '500'
        }}>
          Loading...
        </div>
      </div>
    );
  }

  return isSignedIn ? <App /> : <Home />;
}

export default MainLayout;
