import { useState, useEffect, useCallback } from 'react';
import { Club, Submission } from './types';
import { loadClubsConfig, loadClubSeatCounts, loadSubmissions } from './services/storage';
import { getTeacherSession, onTeacherAuthStateChange, signOutTeacher } from './services/auth';
import { StudentForm } from './components/StudentForm';
import { TeacherTools } from './components/TeacherTools';
import { TeacherLoginModal } from './components/TeacherLoginModal';
import { GraduationCap, ShieldCheck, UserCheck, Sparkles, RefreshCw } from 'lucide-react';

export default function App() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [seatCounts, setSeatCounts] = useState<Record<string, number>>({});
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState(false);
  // Teacher entry points (nav pill + footer link) stay hidden from students by default.
  // Visiting the site with ?teacher in the URL (or already being logged in) reveals them.
  const [teacherAccessRevealed, setTeacherAccessRevealed] = useState(false);
  const showTeacherAccess = teacherAccessRevealed || isTeacherAuthenticated;

  // Handle Teacher View Click
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

  // Public data (club list + live seat counts) - safe for anonymous students
  const refreshPublicData = useCallback(async () => {
    const [loadedClubs, loadedCounts] = await Promise.all([loadClubsConfig(), loadClubSeatCounts()]);
    setClubs(loadedClubs);
    setSeatCounts(loadedCounts);
  }, []);

  // Full submission list - only ever returns rows when logged in as a teacher (enforced by RLS)
  const refreshTeacherData = useCallback(async () => {
    const loadedSubmissions = await loadSubmissions();
    setSubmissions(loadedSubmissions);
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('teacher')) {
      setTeacherAccessRevealed(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const session = await getTeacherSession();
      setIsTeacherAuthenticated(!!session);
      await refreshPublicData();
      setIsLoading(false);
    })();

    const unsubscribe = onTeacherAuthStateChange(session => {
      setIsTeacherAuthenticated(!!session);
      if (!session) setActiveView('STUDENT');
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

  useEffect(() => {
    if (isTeacherAuthenticated && activeView === 'TEACHER') {
      refreshTeacherData();
    }
  }, [isTeacherAuthenticated, activeView, refreshTeacherData]);

  return (
    <div className="min-h-screen bg-brand-cream text-brand-emerald-900 font-sans antialiased selection:bg-brand-turmeric-200 selection:text-brand-emerald-900">
      {/* Top Banner Accent */}
      <div className="h-2 bg-gradient-to-r from-brand-emerald-900 via-brand-emerald-700 to-brand-turmeric-500" />

      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <header className="border-b-2 border-stone-200 pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-brand-turmeric-600 mb-1">
              <GraduationCap className="w-4 h-4" />
              Cocurricular Sign-Up
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-brand-emerald-950 tracking-tight">
              {activeView === 'STUDENT' ? 'Choose Your Club' : 'Teacher Dashboard'}
            </h1>
            <p className="text-brand-emerald-600 text-sm md:text-base mt-1.5">
              {activeView === 'STUDENT'
                ? 'Select one club below. Once a club reaches its seat limit, it closes automatically.'
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
        </header>

        {/* Content Body */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center my-8 shadow-xs">
            <RefreshCw className="w-8 h-8 text-brand-emerald-400 animate-spin mx-auto mb-3" />
            <p className="text-brand-emerald-600 font-medium text-sm">Loading clubs and live seating...</p>
          </div>
        ) : activeView === 'STUDENT' ? (
          <StudentForm clubs={clubs} seatCounts={seatCounts} onSubmitted={refreshPublicData} />
        ) : !isTeacherAuthenticated ? (
          <TeacherLoginModal
            onLoginSuccess={handleTeacherLoginSuccess}
            onCancel={() => setActiveView('STUDENT')}
          />
        ) : (
          <TeacherTools
            clubs={clubs}
            submissions={submissions}
            onClubsUpdated={updated => {
              setClubs(updated);
              refreshPublicData();
            }}
            onSubmissionsUpdated={() => {
              refreshTeacherData();
              refreshPublicData();
            }}
            onLogout={handleTeacherLogout}
          />
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
            Shared persistent storage enabled &bull; Real-time seat updates
          </p>
        </footer>
      </main>
    </div>
  );
}
