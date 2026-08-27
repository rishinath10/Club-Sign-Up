import { Club, Submission, DEFAULT_CLUBS } from '../types';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';

export async function loadClubsConfig(): Promise<Club[]> {
  const { data, error } = await supabase
    .from('clubs')
    .select('id, name, capacity, description')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('loadClubsConfig error:', error);
    return DEFAULT_CLUBS;
  }
  return data && data.length > 0 ? data : DEFAULT_CLUBS;
}

// Upserts the given clubs and deletes any club rows that are no longer present.
export async function saveClubsConfig(clubs: Club[]): Promise<boolean> {
  try {
    const { data: existing, error: fetchErr } = await supabase.from('clubs').select('id');
    if (fetchErr) throw fetchErr;

    const keepIds = new Set(clubs.map(c => c.id));
    const toDelete = (existing ?? []).filter(row => !keepIds.has(row.id)).map(row => row.id);

    if (toDelete.length > 0) {
      const { error: deleteErr } = await supabase.from('clubs').delete().in('id', toDelete);
      if (deleteErr) throw deleteErr;
    }

    const { error: upsertErr } = await supabase.from('clubs').upsert(
      clubs.map(c => ({
        id: c.id,
        name: c.name,
        capacity: c.capacity,
        description: c.description ?? null
      }))
    );
    if (upsertErr) throw upsertErr;

    return true;
  } catch (err) {
    console.error('saveClubsConfig error:', err);
    return false;
  }
}

// Full submission list. RLS only allows this for authenticated teachers;
// anonymous callers simply get an empty array back.
export async function loadSubmissions(): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, name, class, club_id, club_name, ts')
    .order('ts', { ascending: true });

  if (error) {
    console.error('loadSubmissions error:', error);
    return [];
  }

  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    class: row.class,
    clubId: row.club_id,
    clubName: row.club_name,
    ts: row.ts
  }));
}

// Public, privacy-safe seat counts per club (no student names exposed).
export async function loadClubSeatCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('club_seat_counts').select('club_id, taken');
  if (error) {
    console.error('loadClubSeatCounts error:', error);
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.club_id] = row.taken;
  }
  return counts;
}

export type SignupResult =
  | { ok: true; submission: Submission }
  | { ok: false; reason: 'duplicate' | 'full' | 'error'; message: string };

export async function submitSignup(input: {
  name: string;
  studentClass: string;
  clubId: string;
  clubName: string;
}): Promise<SignupResult> {
  const { data: alreadyTaken, error: checkErr } = await supabase.rpc('check_name_taken', {
    p_name: input.name
  });
  if (!checkErr && alreadyTaken) {
    return {
      ok: false,
      reason: 'duplicate',
      message: `A sign-up for "${input.name}" is already registered. Each student may only sign up once.`
    };
  }

  const { data, error } = await supabase
    .from('submissions')
    .insert({
      name: input.name,
      class: input.studentClass,
      club_id: input.clubId,
      club_name: input.clubName
    })
    .select('id, name, class, club_id, club_name, ts')
    .single();

  if (error) {
    if (error.message.includes('CLUB_FULL')) {
      return { ok: false, reason: 'full', message: `"${input.clubName}" just reached maximum capacity. Please choose another club.` };
    }
    if (error.code === '23505') {
      return {
        ok: false,
        reason: 'duplicate',
        message: `A sign-up for "${input.name}" is already registered. Each student may only sign up once.`
      };
    }
    console.error('submitSignup error:', error);
    return { ok: false, reason: 'error', message: 'Failed to save your submission. Please try again.' };
  }

  return {
    ok: true,
    submission: {
      id: data.id,
      name: data.name,
      class: data.class,
      clubId: data.club_id,
      clubName: data.club_name,
      ts: data.ts
    }
  };
}

export async function deleteSubmission(id: string): Promise<boolean> {
  const { error } = await supabase.from('submissions').delete().eq('id', id);
  if (error) {
    console.error('deleteSubmission error:', error);
    return false;
  }
  return true;
}

export async function deleteAllSubmissions(): Promise<boolean> {
  const { error } = await supabase.from('submissions').delete().not('id', 'is', null);
  if (error) {
    console.error('deleteAllSubmissions error:', error);
    return false;
  }
  return true;
}

export function exportSubmissionsToExcel(submissions: Submission[], clubs: Club[] = []): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Student Sign-ups
  const studentRows = submissions.map((s, idx) => ({
    '#': idx + 1,
    'Student Name': s.name,
    'Class': s.class,
    'Club Selected': s.clubName,
    'Submitted At': s.ts ? new Date(s.ts).toLocaleString() : ''
  }));

  const studentWs = XLSX.utils.json_to_sheet(
    studentRows.length > 0
      ? studentRows
      : [{ '#': '', 'Student Name': 'No submissions recorded', 'Class': '', 'Club Selected': '', 'Submitted At': '' }]
  );

  // Set column widths for readability
  studentWs['!cols'] = [
    { wch: 6 },
    { wch: 25 },
    { wch: 15 },
    { wch: 25 },
    { wch: 22 }
  ];

  XLSX.utils.book_append_sheet(wb, studentWs, 'Student Sign-ups');

  // Sheet 2: Club Seating Summary
  if (clubs.length > 0) {
    const summaryRows = clubs.map((c, idx) => {
      const taken = submissions.filter(s => s.clubId === c.id).length;
      const remaining = Math.max(0, c.capacity - taken);
      return {
        '#': idx + 1,
        'Club Name': c.name,
        'Capacity Limit': c.capacity,
        'Sign-ups Taken': taken,
        'Spots Remaining': remaining,
        'Status': taken >= c.capacity ? 'FULL' : 'OPEN'
      };
    });

    const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
    summaryWs['!cols'] = [
      { wch: 6 },
      { wch: 25 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, summaryWs, 'Club Summary');
  }

  // Export as .xlsx
  const fileName = `Cocurricular_Club_Signups_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportSubmissionsToCsv(submissions: Submission[]): void {
  const csvEscape = (str: string | number | undefined | null): string => {
    const s = String(str ?? '');
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };

  const header = ['Student Name', 'Class', 'Club Selected', 'Submitted At'];
  const lines = [header.join(',')];

  submissions.forEach(s => {
    const dateStr = s.ts ? new Date(s.ts).toLocaleString() : '';
    lines.push([csvEscape(s.name), csvEscape(s.class), csvEscape(s.clubName), csvEscape(dateStr)].join(','));
  });

  const csv = lines.join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cocurricular-signups-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
