import type { Session } from '@supabase/supabase-js';
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
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onTeacherAuthStateChange(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}
