import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Purge legacy service workers and caches on mount to eliminate shell locks & force live cricket-score sync
if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});
  }
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name).catch(() => {});
      });
    }).catch(() => {});
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
