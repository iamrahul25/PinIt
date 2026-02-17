import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import BackendHealthChecker from './components/BackendHealthChecker';
import LoginSignup from './pages/LoginSignup';
import MainLayout from './pages/MainLayout';
import App from './App';
import './tailwind.css';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 60s – avoid refetch on every mount/route change
      gcTime: 5 * 60 * 1000, // 5 min (formerly cacheTime)
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  </React.StrictMode>
);
