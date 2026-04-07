import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import { searchParamValueToBoolean } from './game/utility/useGpuTier.ts';
import './index.css';

const searchParams = new URLSearchParams(window.location.search);
const strict = searchParamValueToBoolean(searchParams, "strict") ?? true;

console.debug("Strict mode:", strict);

const root = createRoot(document.getElementById('root')!);

if (strict) {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  )
} else {
  root.render(
    <App />
  )
}
