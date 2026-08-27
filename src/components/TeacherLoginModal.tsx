import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { signInTeacher } from '../services/auth';

interface TeacherLoginModalProps {
  onLoginSuccess: () => void;
  onCancel: () => void;
}

export const TeacherLoginModal: React.FC<TeacherLoginModalProps> = ({
  onLoginSuccess,
  onCancel
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    const result = await signInTeacher(email, password);

    if (result.ok === true) {
      onLoginSuccess();
    } else {
      setErrorMessage(result.message);
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="bg-white rounded-2xl border border-stone-200 p-6 md:p-8 shadow-md max-w-md mx-auto"
    >
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-slate-900 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Teacher Authentication</h2>
        <p className="text-slate-500 text-xs mt-1">
          Restricted access. Only authorized teachers may log in to manage club sign-ups.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>{errorMessage}</div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            Teacher Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="e.g. teacher@school.edu"
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10 text-slate-900 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-stone-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10 text-slate-900 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="pt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl border border-stone-200 hover:bg-stone-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            Back to Student View
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? 'Authenticating...' : 'Log In'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </motion.div>
  );
};
