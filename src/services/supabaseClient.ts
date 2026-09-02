import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.'
  );
}

// Every request is bounded. Without this an unreachable backend doesn't fail,
// it hangs - and the page sits on "Loading clubs and live seating..." forever
// instead of falling back to the default club list. 10s is generous for a slow
// phone connection while still failing in a human timeframe.
const REQUEST_TIMEOUT_MS = 10_000;

const timeoutFetch: typeof fetch = (input, init) => {
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') {
    return fetch(input, init);
  }

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  // Supabase passes its own signal for cancellation - keep honouring it wherever
  // the browser can combine the two.
  const signal =
    init?.signal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([init.signal, timeout])
      : init?.signal ?? timeout;

  return fetch(input, { ...init, signal });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: timeoutFetch },
});
