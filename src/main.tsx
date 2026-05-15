import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.addEventListener('error', (e) => {
  if (e.message?.includes('FIRESTORE') && e.message?.includes('INTERNAL ASSERTION FAILED')) {
    e.preventDefault();
    console.warn("Caught Firestore internal assertion failure (likely quota related):", e.message);
  }
  if (e.message?.includes('quota') || e.message?.includes('resource-exhausted')) {
    alert("Firebase Quota Exceeded. Please try again tomorrow or upgrade your Firebase plan.");
  }
});

window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || '';
  if (msg.includes('FIRESTORE') && msg.includes('INTERNAL ASSERTION FAILED')) {
    e.preventDefault();
    console.warn("Caught Firestore internal assertion failure in promise:", msg);
  }
  if (msg.includes('quota') || msg.includes('resource-exhausted')) {
    alert("Firebase Quota Exceeded. Please try again tomorrow or upgrade your Firebase plan.");
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
