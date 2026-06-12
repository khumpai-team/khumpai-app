import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/app/App';
import { hydrateFromServer } from '@/store/appStore';
import '@/styles/globals.css';

// Bootstrap the store from the backend (server is authoritative). Best-effort:
// if the API is unreachable, the app keeps its seeded/cached state.
void hydrateFromServer();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
