import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { App } from './App';
import { ClerkConfigNotice } from './components/ClerkConfigNotice';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

export function isValidClerkPublishableKey(key?: string | null): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (!trimmed.startsWith('pk_test_') && !trimmed.startsWith('pk_live_')) return false;
  if (trimmed === 'pk_test_placeholder_key' || trimmed.includes('placeholder')) return false;
  try {
    const parts = trimmed.split('_');
    if (parts.length !== 3 || !parts[2]) return false;
    const decoded = atob(parts[2]);
    return decoded.endsWith('$') && decoded.length > 1;
  } catch {
    return false;
  }
}

const envKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const savedKey = typeof window !== 'undefined' ? localStorage.getItem('tp_clerk_publishable_key') : null;
const effectiveKey = (isValidClerkPublishableKey(envKey) ? envKey : savedKey) || '';
const isKeyValid = isValidClerkPublishableKey(effectiveKey);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isKeyValid ? (
        <ClerkProvider publishableKey={effectiveKey}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ClerkProvider>
      ) : (
        <ClerkConfigNotice portalName="Superadmin Governance Portal" envFilePath="apps/superadmin/.env" />
      )}
    </ErrorBoundary>
  </React.StrictMode>,
);
