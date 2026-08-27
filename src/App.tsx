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
    <div className="min-h-screen bg-[#FAF7F0] text-slate-900 font-sans antialiased selection:bg-amber-200 selection:text-slate-900">
      {/* Top Banner Accent */}
      <div className="h-2 bg-gradient-to-r from-slate-900 via-indigo-900 to-amber-600" />

      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <header className="border-b-2 border-stone-200 pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-amber-600 mb-1">
              <GraduationCap className="w-4 h-4" />
              Cocurricular Sign-Up
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
              {activeView === 'STUDENT' ? 'Choose Your Club' : 'Teacher Dashboard'}
            </h1>
            <p className="text-slate-600 text-sm md:text-base mt-1.5">
              {activeView === 'STUDENT'
                ? 'Select one club below. Once a club reaches its seat limit, it closes automatically.'
                : 'Configure club capacities, monitor real-time submissions, and export records.'}
            </p>
          </div>

          {/* Mode Navigation Pills */}
          <div className="flex items-center gap-1 bg-stone-200/80 p-1 rounded-xl shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveView('STUDENT')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'STUDENT'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
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
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Teacher Tools
            </button>
          </div>
        </header>

        {/* Content Body */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center my-8 shadow-xs">
            <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-600 font-medium text-sm">Loading clubs and live seating...</p>
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

        {/* Bottom Footer & Teacher Toggle Link */}
        <footer className="mt-12 pt-6 border-t border-stone-200 text-center">
          <button
            type="button"
            onClick={() => {
              if (activeView === 'TEACHER') {
                setActiveView('STUDENT');
              } else {
                handleTeacherViewClick();
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 underline font-medium cursor-pointer transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            {activeView === 'STUDENT' ? 'Teacher tools & management' : 'Switch back to student form'}
          </button>
          <p className="text-[11px] text-slate-400 mt-2">
            Shared persistent storage enabled &bull; Real-time seat updates
          </p>
        </footer>
      </main>
    </div>
  );
}
