import React, { useState, useMemo } from 'react';
import { Club, CLUB_ICONS, DEFAULT_CLUB_ICON, SchoolLevel } from '../types';
import { submitSignup } from '../services/storage';
import {
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  User,
  GraduationCap,
  X,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StudentFormProps {
  clubs: Club[];
  seatCounts: Record<string, number>;
  schoolLevel: SchoolLevel;
  onSubmitted: () => void | Promise<void>;
}

type Step = 'DETAILS' | 'CLUB';

const clubIcon = (clubId: string) => CLUB_ICONS[clubId] ?? DEFAULT_CLUB_ICON;

export const StudentForm: React.FC<StudentFormProps> = ({ clubs, seatCounts, schoolLevel, onSubmitted }) => {
  const [step, setStep] = useState<Step>('DETAILS');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: string; lastName?: string; class?: string }>({});
  const [search, setSearch] = useState('');
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedData, setSubmittedData] = useState<{
    firstName: string;
    lastName: string;
    class: string;
    clubId: string;
    clubName: string;
    ts: string;
  } | null>(null);

  const getClubCount = (clubId: string) => seatCounts[clubId] ?? 0;
  const spotsLeft = (club: Club) => Math.max(0, club.capacity - getClubCount(club.id));

  // Available clubs first, then full ones - students shouldn't have to scroll
  // past closed clubs to find one they can actually join.
  const visibleClubs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clubs
      .filter(c => !query || c.name.toLowerCase().includes(query))
      .slice()
      .sort((a, b) => {
        const aFull = spotsLeft(a) === 0;
        const bFull = spotsLeft(b) === 0;
        if (aFull !== bFull) return aFull ? 1 : -1;
        return 0;
      });
  }, [clubs, search, seatCounts]);

  const selectedClub = clubs.find(c => c.id === selectedClubId) ?? null;

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!firstName.trim()) errors.firstName = 'Please enter your first name.';
    if (!lastName.trim()) errors.lastName = 'Please enter your last name.';
    if (!studentClass.trim()) errors.class = 'Please enter your class.';

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setErrorMessage('');
    setStep('CLUB');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    setErrorMessage('');

    if (!selectedClubId) {
      setErrorMessage('Please choose a club to continue.');
      return;
    }

    const club = clubs.find(c => c.id === selectedClubId);
    if (!club) {
      setErrorMessage('The selected club could not be found.');
      return;
    }

    setIsSubmitting(true);

    try {
      // The database enforces capacity limits and duplicate-name blocking
      // atomically, so this is race-condition safe even with many students
      // submitting from different devices at once.
      const result = await submitSignup({
        schoolLevel,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        studentClass: studentClass.trim(),
        clubId: selectedClubId,
        clubName: club.name
      });

      await onSubmitted();

      if (result.ok === false) {
        setErrorMessage(result.message);
        if (result.reason === 'full') setSelectedClubId(null);
        setIsSubmitting(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setSubmittedData({
        firstName: result.submission.firstName,
        lastName: result.submission.lastName,
        class: result.submission.class,
        clubId: result.submission.clubId,
        clubName: result.submission.clubName,
        ts: result.submission.ts
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Error submitting form:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedData(null);
    setFirstName('');
    setLastName('');
    setStudentClass('');
    setSelectedClubId(null);
    setSearch('');
    setFieldErrors({});
    setErrorMessage('');
    setStep('DETAILS');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---------------------------------------------------------------- Success
  if (submittedData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-sm text-center max-w-lg mx-auto"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          className="w-20 h-20 bg-brand-emerald-100 text-brand-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <CheckCircle2 className="w-11 h-11" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <h2 className="text-2xl font-bold text-brand-emerald-900 mb-1">
            You're all set, {submittedData.firstName}!
          </h2>
          <p className="text-brand-emerald-600 mb-6 text-sm">
            Your place in the club below has been saved.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.28 }}
          className="bg-brand-emerald-900 text-white rounded-2xl p-6 mb-5"
        >
          <div className="text-5xl mb-2" aria-hidden="true">{clubIcon(submittedData.clubId)}</div>
          <div className="text-xl font-bold">{submittedData.clubName}</div>
          <div className="text-brand-turmeric-400 text-xs font-semibold uppercase tracking-widest mt-1">
            Registered
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.34 }}
          className="bg-stone-50 rounded-xl p-4 border border-stone-200/80 text-left mb-6 space-y-2.5 text-sm"
        >
          <div className="flex justify-between items-center gap-3">
            <span className="text-brand-emerald-500 font-medium">Name</span>
            <span className="font-semibold text-brand-emerald-900 text-right">
              {submittedData.firstName} {submittedData.lastName}
            </span>
          </div>
          <div className="flex justify-between items-center gap-3">
            <span className="text-brand-emerald-500 font-medium">Class</span>
            <span className="font-semibold text-brand-emerald-900 text-right">{submittedData.class}</span>
          </div>
          <div className="flex justify-between items-center gap-3">
            <span className="text-brand-emerald-500 font-medium">Registered at</span>
            <span className="text-brand-emerald-600 text-xs">
              {new Date(submittedData.ts).toLocaleString([], {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </motion.div>

        <p className="text-xs text-brand-emerald-500 mb-4">
          Take a screenshot of this page for your records.
        </p>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          type="button"
          onClick={handleResetForm}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-brand-emerald-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer w-full"
        >
          <RefreshCw className="w-4 h-4" />
          Sign up another student
        </motion.button>
      </motion.div>
    );
  }

  // ---------------------------------------------------------------- Wizard
  return (
    <div className="pb-28 md:pb-0">
      {/* Progress steps */}
      <ol className="flex items-center gap-2 mb-5 max-w-md mx-auto" aria-label="Progress">
        {(
          [
            { key: 'DETAILS', label: 'Your details' },
            { key: 'CLUB', label: 'Pick a club' }
          ] as const
        ).map((s, idx) => {
          const isDone = step === 'CLUB' && s.key === 'DETAILS';
          const isCurrent = step === s.key;
          return (
            <li key={s.key} className="flex items-center gap-2 flex-1">
              <div
                className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-xl border-2 transition-colors ${
                  isCurrent
                    ? 'border-brand-emerald-900 bg-white'
                    : isDone
                    ? 'border-brand-emerald-200 bg-brand-emerald-50'
                    : 'border-stone-200 bg-white/60'
                }`}
              >
                <span
                  className={`w-6 h-6 shrink-0 rounded-full grid place-items-center text-[11px] font-bold ${
                    isDone
                      ? 'bg-brand-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-brand-emerald-900 text-white'
                      : 'bg-stone-200 text-brand-emerald-600'
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </span>
                <span
                  className={`text-xs font-bold truncate ${
                    isCurrent ? 'text-brand-emerald-900' : 'text-brand-emerald-600'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm mb-4"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------ Step 1: details */}
      {step === 'DETAILS' && (
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-8 shadow-xs"
        >
          <h2 className="text-xl font-bold text-brand-emerald-900">Tell us who you are</h2>
          <p className="text-brand-emerald-500 text-sm mt-1 mb-6">
            You'll pick your club on the next step.
          </p>

          <form onSubmit={handleContinue} className="space-y-5" noValidate>
            <div>
              <label htmlFor="firstName" className="text-xs font-semibold text-brand-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-brand-emerald-400" />
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                autoComplete="given-name"
                autoCapitalize="words"
                value={firstName}
                onChange={e => {
                  setFirstName(e.target.value);
                  if (fieldErrors.firstName) setFieldErrors({ ...fieldErrors, firstName: undefined });
                }}
                placeholder="e.g. Sarah"
                aria-invalid={!!fieldErrors.firstName}
                className={`w-full px-4 py-3 rounded-xl border text-brand-emerald-900 placeholder:text-brand-emerald-300 text-base transition-all focus:ring-2 focus:ring-brand-emerald-800/10 ${
                  fieldErrors.firstName
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-stone-300 focus:border-brand-emerald-800'
                }`}
              />
              {fieldErrors.firstName && (
                <p className="text-xs text-red-600 mt-1.5 font-medium">{fieldErrors.firstName}</p>
              )}
            </div>

            <div>
              <label htmlFor="lastName" className="text-xs font-semibold text-brand-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-brand-emerald-400" />
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                autoComplete="family-name"
                autoCapitalize="words"
                value={lastName}
                onChange={e => {
                  setLastName(e.target.value);
                  if (fieldErrors.lastName) setFieldErrors({ ...fieldErrors, lastName: undefined });
                }}
                placeholder="e.g. Ahmad"
                aria-invalid={!!fieldErrors.lastName}
                className={`w-full px-4 py-3 rounded-xl border text-brand-emerald-900 placeholder:text-brand-emerald-300 text-base transition-all focus:ring-2 focus:ring-brand-emerald-800/10 ${
                  fieldErrors.lastName
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-stone-300 focus:border-brand-emerald-800'
                }`}
              />
              {fieldErrors.lastName && (
                <p className="text-xs text-red-600 mt-1.5 font-medium">{fieldErrors.lastName}</p>
              )}
            </div>

            <div>
              <label htmlFor="studentClass" className="text-xs font-semibold text-brand-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-brand-emerald-400" />
                Class / Form <span className="text-red-500">*</span>
              </label>
              <input
                id="studentClass"
                type="text"
                autoCapitalize="words"
                value={studentClass}
                onChange={e => {
                  setStudentClass(e.target.value);
                  if (fieldErrors.class) setFieldErrors({ ...fieldErrors, class: undefined });
                }}
                placeholder="e.g. 5 Cemerlang"
                aria-invalid={!!fieldErrors.class}
                className={`w-full px-4 py-3 rounded-xl border text-brand-emerald-900 placeholder:text-brand-emerald-300 text-base transition-all focus:ring-2 focus:ring-brand-emerald-800/10 ${
                  fieldErrors.class
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-stone-300 focus:border-brand-emerald-800'
                }`}
              />
              {fieldErrors.class && (
                <p className="text-xs text-red-600 mt-1.5 font-medium">{fieldErrors.class}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-4 px-6 rounded-xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm bg-brand-emerald-900 hover:bg-brand-emerald-800 active:scale-[0.99]"
            >
              Continue to clubs
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      )}

      {/* --------------------------------------------------- Step 2: club */}
      {step === 'CLUB' && (
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-brand-emerald-900">
                  Hi {firstName.trim()} — pick your club
                </h2>
                <p className="text-brand-emerald-500 text-sm mt-1">
                  Choose <strong className="text-brand-emerald-700">one</strong> club. Tap a card to select it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('DETAILS');
                  setErrorMessage('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-brand-emerald-600 hover:text-brand-emerald-900 px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-emerald-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search clubs..."
                aria-label="Search clubs"
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-stone-300 focus:border-brand-emerald-800 focus:ring-2 focus:ring-brand-emerald-800/10 text-brand-emerald-900 placeholder:text-brand-emerald-300 text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-emerald-400 hover:text-brand-emerald-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {visibleClubs.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-stone-200 rounded-xl">
                <p className="text-brand-emerald-600 text-sm font-medium">No clubs match “{search}”.</p>
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-xs text-brand-turmeric-700 underline font-semibold mt-1.5 cursor-pointer"
                >
                  Show all clubs
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {visibleClubs.map(club => {
                  const left = spotsLeft(club);
                  const isFull = left === 0;
                  const isSelected = selectedClubId === club.id;
                  const almostFull = !isFull && left <= 5;

                  return (
                    <button
                      key={club.id}
                      type="button"
                      disabled={isFull}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedClubId(club.id);
                        setErrorMessage('');
                      }}
                      className={`relative text-left p-3.5 rounded-xl border-2 transition-all duration-150 flex items-center gap-3 ${
                        isFull
                          ? 'bg-stone-50 border-stone-200 opacity-55 cursor-not-allowed'
                          : isSelected
                          ? 'bg-brand-emerald-50 border-brand-emerald-900 shadow-sm cursor-pointer'
                          : 'bg-white border-stone-200 hover:border-brand-emerald-400 hover:bg-brand-emerald-50/40 cursor-pointer'
                      }`}
                    >
                      <span className="text-2xl shrink-0" aria-hidden="true">
                        {clubIcon(club.id)}
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="font-semibold text-brand-emerald-900 text-sm block leading-tight">
                          {club.name}
                        </span>
                        <span
                          className={`text-[11px] font-bold mt-0.5 block ${
                            isFull
                              ? 'text-rose-700'
                              : almostFull
                              ? 'text-brand-turmeric-700'
                              : 'text-brand-emerald-600'
                          }`}
                        >
                          {isFull ? 'FULL — no spots left' : `${left} of ${club.capacity} spots left`}
                        </span>
                      </span>

                      <span
                        className={`w-5 h-5 shrink-0 rounded-full border-2 grid place-items-center transition-colors ${
                          isSelected
                            ? 'border-brand-emerald-900 bg-brand-emerald-900'
                            : 'border-stone-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desktop submit (mobile uses the sticky bar below) */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedClubId}
            className={`hidden md:flex w-full mt-4 py-4 px-6 rounded-xl font-bold text-base text-white items-center justify-center gap-2 transition-all shadow-sm ${
              isSubmitting || !selectedClubId
                ? 'bg-stone-300 cursor-not-allowed text-stone-500'
                : 'bg-brand-emerald-900 hover:bg-brand-emerald-800 active:scale-[0.99] cursor-pointer'
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving your place...
              </>
            ) : selectedClub ? (
              <>
                Confirm — {selectedClub.name}
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              'Select a club above'
            )}
          </button>

          {/* Mobile sticky action bar - keeps the button reachable without
              scrolling back past 15 club cards. */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-stone-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
            {selectedClub && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-lg" aria-hidden="true">{clubIcon(selectedClub.id)}</span>
                <span className="text-xs font-bold text-brand-emerald-900 truncate">
                  {selectedClub.name}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedClubId}
              className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all ${
                isSubmitting || !selectedClubId
                  ? 'bg-stone-300 cursor-not-allowed text-stone-500'
                  : 'bg-brand-emerald-900 active:scale-[0.99] cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving your place...
                </>
              ) : selectedClubId ? (
                <>
                  Confirm Sign-Up
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                'Select a club to continue'
              )}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
