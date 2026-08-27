import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const root = createRoot(document.getElementById('root')!);

// Creating the Supabase client with a missing URL/key throws synchronously,
// which would otherwise crash the whole module graph before React ever
// renders anything (a silent blank page). Check first and show a real
// error instead of importing App (which pulls in the Supabase client).
const missingEnv = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

if (missingEnv) {
  root.render(
    <StrictMode>
      <div style={{ maxWidth: 560, margin: '80px auto', padding: 24, fontFamily: 'sans-serif', textAlign: 'center', color: '#0f3a2a' }}>
        <h1 style={{ color: '#a66a00' }}>Configuration error</h1>
        <p>
          This site is missing its Supabase connection settings
          (<code>VITE_SUPABASE_URL</code> and/or <code>VITE_SUPABASE_ANON_KEY</code>).
          Add them as environment variables in your hosting provider's dashboard,
          then trigger a new deploy.
        </p>
      </div>
    </StrictMode>
  );
} else {
  import('./App.tsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
}
