import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import { searchParamValueToBoolean } from './game/utility/useGpuTier.ts';
import './index.css';

const searchParams = new URLSearchParams(window.location.search);
const strict = searchParamValueToBoolean(searchParams, "strict") ?? true;

createRoot(document.getElementById('root')!).render(
  strict ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App />
  )
)
