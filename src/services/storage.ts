import { Club, Submission, DEFAULT_CLUBS } from '../types';
import * as XLSX from 'xlsx';

const STORAGE_CONFIG_KEY = 'signup-config-v1';
const STORAGE_SUBMISSIONS_KEY = 'signup-submissions-v1';

// Abstraction for persistent storage supporting window.storage API if available or falling back to localStorage
async function getValue(key: string): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && (window as any).storage?.get) {
      const result = await (window as any).storage.get(key, true);
      return result ? result.value : null;
    }
  } catch (err) {
    console.warn('window.storage.get error, falling back to localStorage:', err);
  }

  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error('localStorage.getItem error:', e);
    return null;
  }
}

async function setValue(key: string, value: string): Promise<boolean> {
  let success = false;
  try {
    if (typeof window !== 'undefined' && (window as any).storage?.set) {
      await (window as any).storage.set(key, value, true);
      success = true;
    }
  } catch (err) {
    console.warn('window.storage.set error, falling back to localStorage:', err);
  }

  try {
    localStorage.setItem(key, value);
    // Dispatch custom event for same-tab reactive updates
    window.dispatchEvent(new CustomEvent('club-storage-update', { detail: { key, value } }));
    return true;
  } catch (e) {
    console.error('localStorage.setItem error:', e);
    return success;
  }
}

export async function loadClubsConfig(): Promise<Club[]> {
  const val = await getValue(STORAGE_CONFIG_KEY);
  if (!val) {
    await saveClubsConfig(DEFAULT_CLUBS);
    return DEFAULT_CLUBS;
  }
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CLUBS;
  } catch (e) {
    return DEFAULT_CLUBS;
  }
}

export async function saveClubsConfig(clubs: Club[]): Promise<boolean> {
  return await setValue(STORAGE_CONFIG_KEY, JSON.stringify(clubs));
}

export async function loadSubmissions(): Promise<Submission[]> {
  const val = await getValue(STORAGE_SUBMISSIONS_KEY);
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export async function saveSubmissions(list: Submission[]): Promise<boolean> {
  return await setValue(STORAGE_SUBMISSIONS_KEY, JSON.stringify(list));
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
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cocurricular-signups-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

