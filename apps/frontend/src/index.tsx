import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App';

// Silence benign ResizeObserver loop errors in dev (Chrome)
const isResizeObserverLoopError = (value: unknown) => {
  if (!value) return false;
  if (typeof value === 'string') {
    return value.toLowerCase().includes('resizeobserver loop');
  }
  if (value instanceof Error) {
    return value.message.toLowerCase().includes('resizeobserver loop');
  }
  if (typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message.toLowerCase().includes('resizeobserver loop');
    }
  }
  return false;
};

const swallowResizeObserverError = (event: Event | PromiseRejectionEvent) => {
  if (event instanceof ErrorEvent && isResizeObserverLoopError(event.message)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (event instanceof PromiseRejectionEvent && isResizeObserverLoopError(event.reason)) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
};

window.addEventListener('error', swallowResizeObserverError, true);
window.addEventListener('unhandledrejection', swallowResizeObserverError, true);

// Some overlays hook window.onerror directly.
const originalOnError = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  if (isResizeObserverLoopError(message) || isResizeObserverLoopError(error)) {
    return true;
  }
  return originalOnError ? originalOnError(message, source, lineno, colno, error) : false;
};

// CRA's dev overlay can surface this via console.error.
const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  if (args.some(isResizeObserverLoopError)) {
    return;
  }
  originalConsoleError(...args);
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1f2937',
              color: '#fff',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
