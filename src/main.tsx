import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const root = createRoot(document.getElementById('root')!);

function renderConfigError(title: string, details: string) {
  root.render(
    <StrictMode>
      <div style={{ maxWidth: 560, margin: '80px auto', padding: 24, fontFamily: 'sans-serif', textAlign: 'center', color: '#0f3a2a' }}>
        <h1 style={{ color: '#a66a00' }}>{title}</h1>
        <p>{details}</p>
        <p style={{ fontSize: 12, marginTop: 16, wordBreak: 'break-all' }}>
          Configured URL: <code>{JSON.stringify(rawUrl)}</code>
        </p>
      </div>
    </StrictMode>
  );
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Creating the Supabase client with a missing/malformed URL or key throws
// synchronously, which would otherwise crash the whole module graph before
// React ever renders anything (a silent blank page). Validate first and show
// a real, specific error - including the literal configured value, so a
// typo'd env var is visible from a screenshot alone, no DevTools needed.
const looksLikeValidUrl = (() => {
  if (!rawUrl) return false;
  try {
    const u = new URL(rawUrl);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.length > 0;
  } catch {
    return false;
  }
})();

if (!rawUrl || !rawKey) {
  renderConfigError(
    'Configuration error',
    'This site is missing its Supabase connection settings (VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY). Add them as environment variables in your hosting provider’s dashboard, then trigger a new deploy.'
  );
} else if (!looksLikeValidUrl) {
  renderConfigError(
    'Configuration error',
    "VITE_SUPABASE_URL is set but does not look like a valid URL (it should be a full URL like https://xxxx.supabase.co or your self-hosted Supabase URL, with no quotes or extra spaces around it). Fix the value in your hosting provider's dashboard, then trigger a new deploy."
  );
} else {
  import('./App.tsx')
    .then(({ default: App }) => {
      root.render(
        <StrictMode>
          <App />
        </StrictMode>
      );
    })
    .catch(err => {
      console.error('Failed to initialize app:', err);
      renderConfigError(
        'Failed to start',
        `The app crashed while starting up: ${err instanceof Error ? err.message : String(err)}`
      );
    });
}
