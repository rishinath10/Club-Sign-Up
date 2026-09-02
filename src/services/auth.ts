import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export async function signInTeacher(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    return { ok: false, message: 'Invalid teacher credentials. Please check your email and password.' };
  }
  return { ok: true };
}

export async function signOutTeacher(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getTeacherSession(): Promise<Session | null> {
  // Must not throw: this runs during first paint, and an unhandled rejection
  // there strands the page on its loading state.
  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch (err) {
    console.error('getTeacherSession error:', err);
    return null;
  }
}

// The event is passed through deliberately: this fires once on subscribe with
// INITIAL_SESSION, so callers can't treat "no session" as "just signed out".
export function onTeacherAuthStateChange(
  callback: (session: Session | null, event: AuthChangeEvent) => void
): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(session, event));
  return () => data.subscription.unsubscribe();
}
