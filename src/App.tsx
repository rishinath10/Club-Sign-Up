import { useState, useEffect, useCallback } from 'react';
import { Club, SchoolLevel } from './types';
import { loadClubsConfig, loadClubSeatCounts } from './services/storage';
import { getTeacherSession, onTeacherAuthStateChange, signOutTeacher } from './services/auth';
import { StudentForm } from './components/StudentForm';
import { TeacherTools } from './components/TeacherTools';
import { TeacherLoginModal } from './components/TeacherLoginModal';
import { GraduationCap, ShieldCheck, UserCheck, Sparkles, RefreshCw, Backpack, School } from 'lucide-react';

function readSchoolLevelFromUrl(): SchoolLevel | null {
  const path = window.location.pathname.replace(/^\/|\/$/g, '').toLowerCase();
  if (path === 'primary' || path === 'secondary') return path;
  // Older ?school=primary links stay working alongside the clean /primary path.
  const value = new URLSearchParams(window.location.search).get('school');
  return value === 'primary' || value === 'secondary' ? value : null;
}

export default function App() {
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel | null>(() => readSchoolLevelFromUrl());
  const [clubs, setClubs] = useState<Club[]>([]);
  const [seatCounts, setSeatCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState(false);
  // Teacher entry points (nav pill + footer link) stay hidden from students by default.
  // Visiting the site with ?teacher in the URL (or already being logged in) reveals them.
  const [teacherAccessRevealed, setTeacherAccessRevealed] = useState(false);
  const showTeacherAccess = teacherAccessRevealed || isTeacherAuthenticated;

  const handleTeacherViewClick = () => {
    setActiveView('TEACHER');
  };

  const handleTeacherLoginSuccess = () => {
    setIsTeacherAuthenticated(true);
    setActiveView('TEACHER');
  };

  const handleTeacherLogout = async () => {
    await signOutTeacher();
    setIsTeacherAuthenticated(false);
    setActiveView('STUDENT');
  };

  const chooseSchoolLevel = (level: SchoolLevel) => {
    setSchoolLevel(level);
    // Make the choice a real, shareable/bookmarkable/refreshable link from here on.
    const url = new URL(window.location.href);
    url.pathname = `/${level}`;
    url.search = '';
    window.history.replaceState({}, '', url);
  };

  // Public data (club list + live seat counts) for the currently chosen
  // school level - safe for anonymous students.
  const refreshPublicData = useCallback(async () => {
    if (!schoolLevel) return;
    const [loadedClubs, loadedCounts] = await Promise.all([loadClubsConfig(schoolLevel), loadClubSeatCounts()]);
    setClubs(loadedClubs);
    setSeatCounts(loadedCounts);
  }, [schoolLevel]);

  useEffect(() => {
    const path = window.location.pathname.replace(/^\/|\/$/g, '').toLowerCase();
    // Older ?teacher links stay working alongside the clean /teacher path.
    if (path === 'teacher' || new URLSearchParams(window.location.search).has('teacher')) {
      setTeacherAccessRevealed(true);
    }
    // /teacher is a destination, not a hint: go straight to the sign-in rather
    // than dropping a teacher on the student's "which school section?" question.
    // ?teacher stays a reveal-only flag, so /primary?teacher still shows the form.
    if (path === 'teacher') {
      setActiveView('TEACHER');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const session = await getTeacherSession();
        setIsTeacherAuthenticated(!!session);
        await refreshPublicData();
      } finally {
        // Whatever happens above, students must not be left on the spinner -
        // the club list falls back to defaults when the backend is unreachable.
        setIsLoading(false);
      }
    })();

    const unsubscribe = onTeacherAuthStateChange((session, event) => {
      setIsTeacherAuthenticated(!!session);
      // Only a real sign-out sends the teacher back to the student view. This
      // listener also fires once on subscribe with no session, which would
      // otherwise immediately undo landing on /teacher.
      if (event === 'SIGNED_OUT') setActiveView('STUDENT');
    });

    // Background sync every 5 seconds to catch live seat updates from other devices
    const intervalId = setInterval(() => {
      refreshPublicData();
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [refreshPublicData]);

  const levelLabel = schoolLevel === 'primary' ? 'Primary School' : schoolLevel === 'secondary' ? 'Secondary School' : null;

  return (
    <div className="min-h-screen bg-brand-cream text-brand-emerald-900 font-sans antialiased selection:bg-brand-turmeric-200 selection:text-brand-emerald-900">
      {/* Top Banner Accent */}
      <div className="h-2 bg-gradient-to-r from-brand-emerald-900 via-brand-emerald-700 to-brand-turmeric-500" />

      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <header className="border-b-2 border-stone-200 pb-6 mb-8">
          {/* School identity */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6">
            <img
              src="stars-crest.png"
              alt=""
              aria-hidden="true"
              className="h-14 sm:h-20 w-auto shrink-0"
            />
            <img
              src="stars-wordmark.png"
              alt="Stars International School"
              className="h-9 sm:h-12 w-auto shrink-0"
            />
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-brand-turmeric-600 mb-1">
                <GraduationCap className="w-4 h-4" />
                Cocurricular Sign-Up{levelLabel && activeView === 'STUDENT' ? ` — ${levelLabel}` : ''}
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-brand-emerald-950 tracking-tight">
                {activeView === 'STUDENT' ? 'Choose Your Club' : 'Teacher Dashboard'}
              </h1>
              <p className="text-brand-emerald-600 text-sm md:text-base mt-1.5">
                {activeView === 'STUDENT'
                  ? 'Sign up in two quick steps. Clubs close automatically once they fill up.'
                  : 'Configure club capacities, monitor real-time submissions, and export records.'}
              </p>
            </div>

          {/* Mode Navigation Pills - hidden from students; only shown once teacher access is revealed */}
          {showTeacherAccess && (
            <div className="flex items-center gap-1 bg-stone-200/80 p-1 rounded-xl shrink-0 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setActiveView('STUDENT')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeView === 'STUDENT'
                    ? 'bg-white text-brand-emerald-900 shadow-xs'
                    : 'text-brand-emerald-600 hover:text-brand-emerald-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Student View
              </button>
              <button
                type="button"
                onClick={handleTeacherViewClick}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeView === 'TEACHER'
                    ? 'bg-brand-emerald-900 text-white shadow-xs'
                    : 'text-brand-emerald-600 hover:text-brand-emerald-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-brand-turmeric-400" />
                Teacher Tools
              </button>
            </div>
            )}
          </div>
        </header>

        {/* Content Body */}
        {activeView === 'TEACHER' ? (
          !isTeacherAuthenticated ? (
            <TeacherLoginModal
              onLoginSuccess={handleTeacherLoginSuccess}
              onCancel={() => setActiveView('STUDENT')}
            />
          ) : (
            <TeacherTools onLogout={handleTeacherLogout} />
          )
        ) : !schoolLevel ? (
          <SchoolLevelChooser onChoose={chooseSchoolLevel} />
        ) : isLoading ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center my-8 shadow-xs">
            <RefreshCw className="w-8 h-8 text-brand-emerald-400 animate-spin mx-auto mb-3" />
            <p className="text-brand-emerald-600 font-medium text-sm">Loading clubs and live seating...</p>
          </div>
        ) : (
          <StudentForm clubs={clubs} seatCounts={seatCounts} schoolLevel={schoolLevel} onSubmitted={refreshPublicData} />
        )}

        {/* Bottom Footer - the teacher toggle link only appears once teacher access is revealed */}
        <footer className="mt-12 pt-6 border-t border-stone-200 text-center">
          {showTeacherAccess && (
            <button
              type="button"
              onClick={() => {
                if (activeView === 'TEACHER') {
                  setActiveView('STUDENT');
                } else {
                  handleTeacherViewClick();
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs text-brand-emerald-500 hover:text-brand-emerald-900 underline font-medium cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-turmeric-500" />
              {activeView === 'STUDENT' ? 'Teacher tools & management' : 'Switch back to student form'}
            </button>
          )}
          <p className="text-[11px] text-brand-emerald-400 mt-2">
            Stars International School &bull; Cocurricular Club Sign-Up
          </p>
          <p className="text-[11px] text-brand-emerald-400/90 mt-3 flex items-center justify-center gap-x-1.5 gap-y-1 flex-wrap">
            <span>Powered by</span>
            <a
              href="https://hubiform.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-brand-emerald-600 hover:text-brand-emerald-900 transition-colors"
            >
              HubiForm
            </a>
            <span aria-hidden="true">&middot;</span>
            <span>A product of Art Engine My Solutions</span>
          </p>
        </footer>
      </main>
    </div>
  );
}

function SchoolLevelChooser({ onChoose }: { onChoose: (level: SchoolLevel) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-xs max-w-lg mx-auto text-center">
      <h2 className="text-xl font-bold text-brand-emerald-900">Which school section are you in?</h2>
      <p className="text-brand-emerald-500 text-sm mt-1 mb-6">Pick one to see the right club list for you.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChoose('primary')}
          className="flex flex-col items-center gap-2.5 p-6 rounded-xl border-2 border-stone-200 bg-white hover:border-brand-emerald-900 hover:bg-brand-emerald-50/40 transition-all cursor-pointer"
        >
          <Backpack className="w-9 h-9 text-brand-emerald-700" />
          <span className="font-bold text-brand-emerald-900">Primary School</span>
        </button>
        <button
          type="button"
          onClick={() => onChoose('secondary')}
          className="flex flex-col items-center gap-2.5 p-6 rounded-xl border-2 border-stone-200 bg-white hover:border-brand-emerald-900 hover:bg-brand-emerald-50/40 transition-all cursor-pointer"
        >
          <School className="w-9 h-9 text-brand-emerald-700" />
          <span className="font-bold text-brand-emerald-900">Secondary School</span>
        </button>
      </div>
    </div>
  );
}
