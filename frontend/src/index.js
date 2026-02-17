import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import BackendHealthChecker from './components/BackendHealthChecker';
import LoginSignup from './pages/LoginSignup';
import App from './App';
import './tailwind.css';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <BackendHealthChecker>
          <Routes>
            <Route path="/login" element={<LoginSignup />} />
            {/* Single route for all app paths so App stays mounted and navbar navigation doesn't reload the page */}
            <Route path="/*" element={<App />} />
          </Routes>
        </BackendHealthChecker>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
