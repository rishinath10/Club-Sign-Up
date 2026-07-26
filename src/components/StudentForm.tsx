import React, { useState } from 'react';
import { Club, Submission } from '../types';
import { loadSubmissions, saveSubmissions } from '../services/storage';
import { CheckCircle2, AlertCircle, Users, Sparkles, User, GraduationCap, ArrowRight, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StudentFormProps {
  clubs: Club[];
  submissions: Submission[];
  onSubmissionsUpdated: (newSubmissions: Submission[]) => void;
}

export const StudentForm: React.FC<StudentFormProps> = ({
  clubs,
  submissions,
  onSubmissionsUpdated
}) => {
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedData, setSubmittedData] = useState<{
    name: string;
    class: string;
    clubName: string;
    ts: string;
  } | null>(null);

  // Calculate spots count for a club
  const getClubCount = (clubId: string) => {
    return submissions.filter(s => s.clubId === clubId).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedName = studentName.trim();
    const trimmedClass = studentClass.trim();

    if (!trimmedName || !trimmedClass) {
      setErrorMessage('Please enter both your full name and class.');
      return;
    }

    if (!selectedClubId) {
      setErrorMessage('Please select a club to continue.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Re-fetch latest submissions from storage to prevent race condition & check for duplicate student sign-up
      const latestSubmissions = await loadSubmissions();

      // Check if this student (case-insensitive name match) has already submitted
      const normalizedName = trimmedName.toLowerCase();
      const existingSubmission = latestSubmissions.find(
        s => s.name.trim().toLowerCase() === normalizedName
      );

      if (existingSubmission) {
        onSubmissionsUpdated(latestSubmissions);
        setErrorMessage(
          `Duplicate Submission Blocked: A sign-up for "${existingSubmission.name}" (${existingSubmission.class}) is already registered for "${existingSubmission.clubName}". Each student may only sign up once.`
        );
        setIsSubmitting(false);
        return;
      }

      const club = clubs.find(c => c.id === selectedClubId);

      if (!club) {
        setErrorMessage('The selected club could not be found.');
        setIsSubmitting(false);
        return;
      }

      const currentCount = latestSubmissions.filter(s => s.clubId === selectedClubId).length;

      if (currentCount >= club.capacity) {
        // Club is now full
        onSubmissionsUpdated(latestSubmissions);
        setErrorMessage(`"${club.name}" just reached maximum capacity (${club.capacity} students). Please choose another club.`);
        setSelectedClubId(null);
        setIsSubmitting(false);
        return;
      }

      const newSubmission: Submission = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: trimmedName,
        class: trimmedClass,
        clubId: selectedClubId,
        clubName: club.name,
        ts: new Date().toISOString()
      };

      const updatedList = [...latestSubmissions, newSubmission];
      const savedOk = await saveSubmissions(updatedList);

      if (!savedOk) {
        setErrorMessage('Failed to save your submission. Please try again.');
        setIsSubmitting(false);
        return;
      }

      onSubmissionsUpdated(updatedList);
      setSubmittedData({
        name: trimmedName,
        class: trimmedClass,
        clubName: club.name,
        ts: newSubmission.ts
      });
    } catch (err) {
      console.error('Error submitting form:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedData(null);
    setStudentName('');
    setStudentClass('');
    setSelectedClubId(null);
    setErrorMessage('');
  };

  if (submittedData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-2xl border border-stone-200 p-8 shadow-sm text-center max-w-lg mx-auto"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <CheckCircle2 className="w-9 h-9" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <h2 className="text-2xl font-bold text-slate-900 mb-2">You're Signed Up!</h2>
          <p className="text-slate-600 mb-6">
            Your club choice has been registered successfully.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.28 }}
          className="bg-stone-50 rounded-xl p-5 border border-stone-200/80 text-left mb-6 space-y-3 text-sm shadow-2xs"
        >
          <div className="flex justify-between items-center py-1 border-b border-stone-200/60">
            <span className="text-slate-500 font-medium">Student Name</span>
            <span className="font-semibold text-slate-900">{submittedData.name}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-stone-200/60">
            <span className="text-slate-500 font-medium">Class</span>
            <span className="font-semibold text-slate-900">{submittedData.class}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-stone-200/60">
            <span className="text-slate-500 font-medium">Club Selected</span>
            <span className="font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
              {submittedData.clubName}
            </span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 font-medium">Registration Time</span>
            <span className="text-slate-600 text-xs">
              {new Date(submittedData.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          type="button"
          onClick={handleResetForm}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-slate-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer w-full"
        >
          <RefreshCw className="w-4 h-4" />
          Submit Another Response
        </motion.button>
      </motion.div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6 md:p-8 shadow-xs">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          Student Information
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Please fill in your details and choose 1 club below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm"
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Student Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={studentName}
              onChange={e => setStudentName(e.target.value)}
              placeholder="e.g. Sarah Ahmad"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10 text-slate-900 placeholder:text-slate-400 text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
              Class / Form <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={studentClass}
              onChange={e => setStudentClass(e.target.value)}
              placeholder="e.g. 5 Cemerlang"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10 text-slate-900 placeholder:text-slate-400 text-sm transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              Select Cocurricular Club <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-slate-500 font-medium">Max 1 club per student</span>
          </div>

          <div className="space-y-3">
            {clubs.map(club => {
              const count = getClubCount(club.id);
              const isFull = count >= club.capacity;
              const isSelected = selectedClubId === club.id;
              const percentage = Math.min(100, Math.round((count / club.capacity) * 100));

              return (
                <div
                  key={club.id}
                  onClick={() => {
                    if (!isFull) {
                      setSelectedClubId(club.id);
                      setErrorMessage('');
                    }
                  }}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-150 select-none ${
                    isFull
                      ? 'bg-stone-50/80 border-stone-200 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-slate-50/80 border-slate-900 shadow-xs cursor-pointer'
                      : 'bg-white border-stone-200 hover:border-slate-400 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'border-slate-900 bg-slate-900'
                            : 'border-stone-300 bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900 text-base block leading-tight">
                          {club.name}
                        </span>
                        {club.description && (
                          <span className="text-xs text-slate-500 block mt-0.5">
                            {club.description}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isFull ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          Full
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-600 bg-stone-100 px-2.5 py-1 rounded-md border border-stone-200">
                          {count}/{club.capacity} spots taken
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden mt-3">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        isFull
                          ? 'bg-rose-500'
                          : percentage > 80
                          ? 'bg-amber-500'
                          : 'bg-slate-800'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !selectedClubId}
          className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
            isSubmitting || !selectedClubId
              ? 'bg-stone-300 cursor-not-allowed text-stone-500'
              : 'bg-slate-900 hover:bg-slate-800 active:scale-[0.99]'
          }`}
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Verifying availability & submitting...
            </>
          ) : (
            <>
              Confirm Club Sign-Up
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
