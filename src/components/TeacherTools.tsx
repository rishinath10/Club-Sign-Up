import React, { useState } from 'react';
import { Club, Submission, DEFAULT_CLUBS } from '../types';
import { saveClubsConfig, saveSubmissions, exportSubmissionsToExcel, exportSubmissionsToCsv } from '../services/storage';
import {
  Settings,
  Download,
  Trash2,
  Plus,
  Search,
  Users,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Check,
  Building,
  BarChart3,
  X,
  FileSpreadsheet,
  LogOut,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TeacherToolsProps {
  clubs: Club[];
  submissions: Submission[];
  onClubsUpdated: (clubs: Club[]) => void;
  onSubmissionsUpdated: (submissions: Submission[]) => void;
  onLogout?: () => void;
}

export const TeacherTools: React.FC<TeacherToolsProps> = ({
  clubs,
  submissions,
  onClubsUpdated,
  onSubmissionsUpdated,
  onLogout
}) => {
  const [editedClubs, setEditedClubs] = useState<Club[]>(JSON.parse(JSON.stringify(clubs)));
  const [isSavingClubs, setIsSavingClubs] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClubFilter, setSelectedClubFilter] = useState('ALL');

  // Confirmation Modals
  const [showResetModalStep1, setShowResetModalStep1] = useState(false);
  const [showResetModalStep2, setShowResetModalStep2] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');

  // Handle saving club changes
  const handleSaveClubs = async () => {
    setIsSavingClubs(true);
    setSaveSuccessMsg('');

    // Ensure valid capacities
    const sanitizedClubs = editedClubs.map(c => ({
      ...c,
      name: c.name.trim() || 'Untitled Club',
      capacity: Math.max(1, Number(c.capacity) || 1)
    }));

    const ok = await saveClubsConfig(sanitizedClubs);
    if (ok) {
      onClubsUpdated(sanitizedClubs);
      setEditedClubs(sanitizedClubs);
      setSaveSuccessMsg('Club configurations saved successfully!');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    }
    setIsSavingClubs(false);
  };

  // Add new club
  const handleAddClub = () => {
    const newId = `club-${Date.now()}`;
    const newClub: Club = {
      id: newId,
      name: 'New Club',
      capacity: 25,
      description: 'Activity description...'
    };
    setEditedClubs([...editedClubs, newClub]);
  };

  // Delete a club from config
  const handleDeleteClub = (clubId: string) => {
    const studentCount = submissions.filter(s => s.clubId === clubId).length;
    if (studentCount > 0) {
      if (!confirm(`Warning: ${studentCount} student(s) are signed up for this club. Deleting this club will remove it from future choices. Continue?`)) {
        return;
      }
    }
    setEditedClubs(editedClubs.filter(c => c.id !== clubId));
  };

  // Reset all submissions (Double confirmation)
  const handlePerformResetSubmissions = async () => {
    if (resetConfirmInput.trim().toLowerCase() !== 'reset') {
      alert('Please type RESET to confirm.');
      return;
    }
    const ok = await saveSubmissions([]);
    if (ok) {
      onSubmissionsUpdated([]);
      setShowResetModalStep1(false);
      setShowResetModalStep2(false);
      setResetConfirmInput('');
      alert('All student submissions have been cleared successfully.');
    } else {
      alert('Failed to reset submissions.');
    }
  };

  // Delete an individual submission
  const handleDeleteSingleSubmission = async (submissionId: string, studentName: string) => {
    if (!confirm(`Remove registration entry for "${studentName}"? This will free up 1 spot in their club.`)) {
      return;
    }
    const updated = submissions.filter(s => s.id !== submissionId);
    const ok = await saveSubmissions(updated);
    if (ok) {
      onSubmissionsUpdated(updated);
    }
  };

  // Restore default clubs
  const handleRestoreDefaults = async () => {
    if (confirm('Restore default clubs list (Book Club, Futsal, Entrepreneurship, Coding)? This will overwrite your current club list.')) {
      const ok = await saveClubsConfig(DEFAULT_CLUBS);
      if (ok) {
        onClubsUpdated(DEFAULT_CLUBS);
        setEditedClubs(JSON.parse(JSON.stringify(DEFAULT_CLUBS)));
        setSaveSuccessMsg('Default clubs restored.');
        setTimeout(() => setSaveSuccessMsg(''), 3000);
      }
    }
  };

  // Filter submissions
  const filteredSubmissions = submissions.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.class.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.clubName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClub = selectedClubFilter === 'ALL' || s.clubId === selectedClubFilter;
    return matchesSearch && matchesClub;
  });

  // Analytics Metrics
  const totalSubmissionsCount = submissions.length;
  const totalCapacity = clubs.reduce((acc, c) => acc + c.capacity, 0);
  const fillPercentage = totalCapacity > 0 ? Math.round((totalSubmissionsCount / totalCapacity) * 100) : 0;
  
  const fullClubsCount = clubs.filter(c => {
    const count = submissions.filter(s => s.clubId === c.id).length;
    return count >= c.capacity;
  }).length;

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-amber-400 text-xs font-semibold uppercase tracking-wider">
                <Settings className="w-3.5 h-3.5" />
                Teacher Control Panel
              </div>
              <span className="text-xs text-slate-400 bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 rounded-full flex items-center gap-1 font-medium">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                pgaayathri96@gmail.com
              </span>
            </div>
            <h2 className="text-2xl font-bold">Manage Clubs & Responses</h2>
            <p className="text-slate-400 text-sm mt-1">
              Configure capacities, view student sign-ups, and export records directly to Excel (.xlsx).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => exportSubmissionsToExcel(submissions, clubs)}
              disabled={submissions.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-slate-950 font-bold text-sm transition-colors cursor-pointer shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export to Excel (.xlsx)
            </button>

            <button
              type="button"
              onClick={() => exportSubmissionsToCsv(submissions)}
              disabled={submissions.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-200 text-xs font-semibold transition-colors cursor-pointer"
                title="Log out from Teacher Tools"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                Log Out
              </button>
            )}
          </div>
        </div>

        {/* Quick Analytics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800 text-sm">
          <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-800">
            <span className="text-slate-400 text-xs block font-medium">Total Sign-Ups</span>
            <span className="text-xl font-bold text-white mt-0.5 block">{totalSubmissionsCount}</span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-800">
            <span className="text-slate-400 text-xs block font-medium">Total Spots Capacity</span>
            <span className="text-xl font-bold text-white mt-0.5 block">{totalCapacity}</span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-800">
            <span className="text-slate-400 text-xs block font-medium">Overall Fill Rate</span>
            <span className="text-xl font-bold text-amber-400 mt-0.5 block">{fillPercentage}%</span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-800">
            <span className="text-slate-400 text-xs block font-medium">Clubs at Max Limit</span>
            <span className="text-xl font-bold text-rose-400 mt-0.5 block">
              {fullClubsCount} / {clubs.length}
            </span>
          </div>
        </div>
      </div>

      {/* Club Configuration Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 md:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-600" />
              Club Names & Capacity Limits
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Adjust maximum student capacity or edit club titles without touching code.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-stone-200 hover:border-stone-300 font-medium transition-colors"
            >
              Restore Defaults
            </button>
            <button
              type="button"
              onClick={handleAddClub}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-slate-900 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Club
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {editedClubs.map((club, idx) => {
            const currentSignedUp = submissions.filter(s => s.clubId === club.id).length;
            const isAtCap = currentSignedUp >= club.capacity;

            return (
              <div
                key={club.id}
                className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-6">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                      Club Name
                    </label>
                    <input
                      type="text"
                      value={club.name}
                      onChange={e => {
                        const next = [...editedClubs];
                        next[idx].name = e.target.value;
                        setEditedClubs(next);
                      }}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white font-medium text-slate-900"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                      Capacity Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={club.capacity}
                      onChange={e => {
                        const next = [...editedClubs];
                        next[idx].capacity = parseInt(e.target.value, 10) || 1;
                        setEditedClubs(next);
                      }}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white font-medium text-slate-900"
                    />
                  </div>

                  <div className="md:col-span-3 text-xs text-slate-500 pt-2 md:pt-4">
                    <span className="font-semibold text-slate-700">{currentSignedUp}</span> of{' '}
                    <span className="font-semibold text-slate-700">{club.capacity}</span> taken
                    {isAtCap && (
                      <span className="ml-2 text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                        Full
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteClub(club.id)}
                  title="Remove Club"
                  className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <AnimatePresence>
            {saveSuccessMsg ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-emerald-700 font-medium text-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {saveSuccessMsg}
              </motion.div>
            ) : <div />}
          </AnimatePresence>

          <button
            type="button"
            onClick={handleSaveClubs}
            disabled={isSavingClubs}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-all cursor-pointer shadow-xs"
          >
            {isSavingClubs ? 'Saving...' : 'Save Capacities'}
          </button>
        </div>
      </div>

      {/* Submissions Table Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 md:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              Student Responses ({submissions.length})
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Live submission log updated as students complete their sign-ups.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search student..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-300 focus:outline-none focus:border-slate-800"
              />
            </div>

            {/* Filter Dropdown */}
            <select
              value={selectedClubFilter}
              onChange={e => setSelectedClubFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-1.5 text-xs rounded-xl border border-stone-300 bg-white font-medium text-slate-700"
            >
              <option value="ALL">All Clubs</option>
              {clubs.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-stone-200 rounded-xl">
            <Users className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm font-medium">No student sign-ups recorded yet.</p>
            <p className="text-slate-400 text-xs mt-1">
              Submissions will appear here automatically when students fill out the form.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100/80 text-slate-600 font-semibold uppercase tracking-wider border-b border-stone-200">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Club Selected</th>
                  <th className="p-3">Submitted At</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-slate-800">
                {filteredSubmissions.map((sub, index) => (
                  <tr key={sub.id || index} className="hover:bg-stone-50/80 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{index + 1}</td>
                    <td className="p-3 font-bold text-slate-900">{sub.name}</td>
                    <td className="p-3 font-medium text-slate-700">{sub.class}</td>
                    <td className="p-3">
                      <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-md font-semibold">
                        {sub.clubName}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">
                      {sub.ts ? new Date(sub.ts).toLocaleString() : 'N/A'}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteSingleSubmission(sub.id, sub.name)}
                        title="Remove student submission"
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="mt-6 pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Showing <span className="font-bold text-slate-800">{filteredSubmissions.length}</span> of{' '}
            <span className="font-bold text-slate-800">{submissions.length}</span> total entries
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => exportSubmissionsToExcel(submissions, clubs)}
              disabled={submissions.length === 0}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export to Excel (.xlsx)
            </button>

            <button
              type="button"
              onClick={() => setShowResetModalStep1(true)}
              disabled={submissions.length === 0}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset All Submissions
            </button>
          </div>
        </div>
      </div>

      {/* Step 1 Reset Confirmation Modal */}
      {showResetModalStep1 && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200"
          >
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-900">Reset All Submissions?</h3>
            </div>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              This action will permanently delete all <strong className="text-slate-900">{submissions.length}</strong> student sign-up records. Your club names and capacity limits will remain saved.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetModalStep1(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetModalStep1(false);
                  setShowResetModalStep2(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer"
              >
                Yes, Continue
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Step 2 Double Confirmation Modal */}
      {showResetModalStep2 && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-slate-900">Final Confirmation</h3>
              <button
                type="button"
                onClick={() => setShowResetModalStep2(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-600 text-sm mb-4">
              To prevent accidental deletion, please type <strong className="font-mono text-rose-600">RESET</strong> in the box below to erase all responses:
            </p>
            <input
              type="text"
              value={resetConfirmInput}
              onChange={e => setResetConfirmInput(e.target.value)}
              placeholder="Type RESET here"
              className="w-full px-4 py-2 text-sm rounded-xl border border-stone-300 mb-6 font-mono focus:border-rose-600"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowResetModalStep2(false);
                  setResetConfirmInput('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePerformResetSubmissions}
                disabled={resetConfirmInput.trim().toLowerCase() !== 'reset'}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 cursor-pointer"
              >
                Permanently Delete All Responses
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
