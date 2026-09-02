import { Club, Classroom, Submission, SchoolLevel, defaultClubsFor } from '../types';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';

export async function loadClubsConfig(level: SchoolLevel): Promise<Club[]> {
  const { data, error } = await supabase
    .from('clubs')
    .select('id, name, capacity, description, school_level')
    .eq('school_level', level)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('loadClubsConfig error:', error);
    return defaultClubsFor(level);
  }
  if (!data || data.length === 0) return defaultClubsFor(level);

  return data.map(row => ({
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    description: row.description ?? undefined,
    schoolLevel: row.school_level
  }));
}

// Upserts the given clubs and deletes any club rows for that school level
// that are no longer present. Never touches the other level's clubs.
export async function saveClubsConfig(level: SchoolLevel, clubs: Club[]): Promise<boolean> {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('clubs')
      .select('id')
      .eq('school_level', level);
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
        description: c.description ?? null,
        school_level: level
      }))
    );
    if (upsertErr) throw upsertErr;

    return true;
  } catch (err) {
    console.error('saveClubsConfig error:', err);
    return false;
  }
}

// Classrooms a student can pick from - same load/save shape as clubs, minus
// capacity, and scoped per school level the same way.
export async function loadClassrooms(level: SchoolLevel): Promise<Classroom[]> {
  const { data, error } = await supabase
    .from('classrooms')
    .select('id, name, school_level')
    .eq('school_level', level)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('loadClassrooms error:', error);
    return [];
  }

  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    schoolLevel: row.school_level
  }));
}

export async function saveClassrooms(level: SchoolLevel, classrooms: Classroom[]): Promise<boolean> {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('classrooms')
      .select('id')
      .eq('school_level', level);
    if (fetchErr) throw fetchErr;

    const keepIds = new Set(classrooms.map(c => c.id));
    const toDelete = (existing ?? []).filter(row => !keepIds.has(row.id)).map(row => row.id);

    if (toDelete.length > 0) {
      const { error: deleteErr } = await supabase.from('classrooms').delete().in('id', toDelete);
      if (deleteErr) throw deleteErr;
    }

    const { error: upsertErr } = await supabase.from('classrooms').upsert(
      classrooms.map(c => ({
        id: c.id,
        name: c.name,
        school_level: level
      }))
    );
    if (upsertErr) throw upsertErr;

    return true;
  } catch (err) {
    console.error('saveClassrooms error:', err);
    return false;
  }
}

// Full submission list across BOTH school levels. RLS only allows this for
// authenticated teachers; anonymous callers simply get an empty array back.
// The teacher dashboard filters by level client-side.
export async function loadSubmissions(): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, school_level, full_name, class, club_id, club_name, ts')
    .order('ts', { ascending: true });

  if (error) {
    console.error('loadSubmissions error:', error);
    return [];
  }

  return (data ?? []).map(row => ({
    id: row.id,
    schoolLevel: row.school_level,
    fullName: row.full_name,
    class: row.class,
    clubId: row.club_id,
    clubName: row.club_name,
    ts: row.ts
  }));
}

// Public, privacy-safe seat counts per club (no student names exposed).
// Keyed by club_id, which already implies a school level, so both levels'
// counts can be fetched together safely.
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

const levelLabel = (level: SchoolLevel) => (level === 'primary' ? 'Primary School' : 'Secondary School');

export async function submitSignup(input: {
  schoolLevel: SchoolLevel;
  fullName: string;
  studentClass: string;
  clubId: string;
  clubName: string;
}): Promise<SignupResult> {
  const duplicateMessage = `"${input.fullName}" is already registered for ${levelLabel(input.schoolLevel)}. If this looks wrong, please contact your teacher.`;

  const { data: alreadyTaken, error: checkErr } = await supabase.rpc('check_name_taken', {
    p_school_level: input.schoolLevel,
    p_full_name: input.fullName
  });
  if (!checkErr && alreadyTaken) {
    return { ok: false, reason: 'duplicate', message: duplicateMessage };
  }

  // Anonymous students have no SELECT permission on submissions (that's what
  // keeps other students' names private), so a plain .insert().select() would
  // fail to read the row back and roll the whole insert back. This RPC does
  // the insert server-side and returns the row directly, sidestepping that.
  const { data, error } = await supabase.rpc('submit_signup', {
    p_school_level: input.schoolLevel,
    p_full_name: input.fullName,
    p_class: input.studentClass,
    p_club_id: input.clubId,
    p_club_name: input.clubName
  });

  if (error) {
    if (error.message.includes('CLUB_FULL')) {
      return { ok: false, reason: 'full', message: `"${input.clubName}" just reached maximum capacity. Please choose another club.` };
    }
    if (error.code === '23505') {
      return { ok: false, reason: 'duplicate', message: duplicateMessage };
    }
    console.error('submitSignup error:', error);
    return { ok: false, reason: 'error', message: 'Failed to save your submission. Please try again.' };
  }

  const row = data?.[0];
  if (!row) {
    console.error('submitSignup error: RPC returned no row');
    return { ok: false, reason: 'error', message: 'Failed to save your submission. Please try again.' };
  }

  return {
    ok: true,
    submission: {
      id: row.id,
      schoolLevel: row.school_level,
      fullName: row.full_name,
      class: row.class,
      clubId: row.club_id,
      clubName: row.club_name,
      ts: row.ts
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

export async function deleteAllSubmissions(level: SchoolLevel): Promise<boolean> {
  const { error } = await supabase.from('submissions').delete().eq('school_level', level);
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
    'Full Name': s.fullName,
    'Class': s.class,
    'Club Selected': s.clubName,
    'Submitted At': s.ts ? new Date(s.ts).toLocaleString() : ''
  }));

  const studentWs = XLSX.utils.json_to_sheet(
    studentRows.length > 0
      ? studentRows
      : [{ '#': '', 'Full Name': 'No submissions recorded', 'Class': '', 'Club Selected': '', 'Submitted At': '' }]
  );

  // Set column widths for readability
  studentWs['!cols'] = [
    { wch: 6 },
    { wch: 28 },
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
  const fileName = `ECA_CCA_Club_Signups_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportSubmissionsToCsv(submissions: Submission[]): void {
  const csvEscape = (str: string | number | undefined | null): string => {
    const s = String(str ?? '');
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };

  const header = ['Full Name', 'Class', 'Club Selected', 'Submitted At'];
  const lines = [header.join(',')];

  submissions.forEach(s => {
    const dateStr = s.ts ? new Date(s.ts).toLocaleString() : '';
    lines.push([csvEscape(s.fullName), csvEscape(s.class), csvEscape(s.clubName), csvEscape(dateStr)].join(','));
  });

  const csv = lines.join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eca-cca-signups-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
