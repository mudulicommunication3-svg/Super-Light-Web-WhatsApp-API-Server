import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertCircle,
  KeyRound,
  Store
} from 'lucide-react';
import { checkAdminAuthOnSheet } from '../../services/api';

interface AdminAuthProps {
  onSuccess?: () => void;
  onBack?: () => void;
}

export const AdminAuth: React.FC<AdminAuthProps> = ({ onSuccess, onBack }) => {
  const { loginAdmin, setActiveScreen } = useApp();
  const { isEnglish } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.replace(/\D/g, '').slice(-10);
    const cleanPass = password.trim();

    if (cleanUser.length !== 10) {
      setError(isEnglish ? 'Please enter a valid 10-digit username / mobile number.' : 'Username 10-ଅଙ୍କ ବିଶିଷ୍ଟ ହେବା ଆବଶ୍ୟକ।');
      return;
    }

    if (!cleanPass) {
      setError(isEnglish ? 'Please enter your admin password.' : 'ଦୟାକରି ଆଡମିନ୍ ପାସୱାର୍ଡ ଦିଅନ୍ତୁ।');
      return;
    }

    setLoading(true);

    try {
      const isValid = await checkAdminAuthOnSheet(cleanUser, cleanPass);
      if (isValid) {
        loginAdmin();
        if (onSuccess) {
          onSuccess();
        } else {
          setActiveScreen('admin');
        }
      } else {
        setError(
          isEnglish
            ? 'Invalid Admin credentials!'
            : 'ଭୁଲ୍ Username କିମ୍ବା Password!'
        );
      }
    } catch (err) {
      setError(isEnglish ? 'Network error verifying credentials.' : 'ଯାଞ୍ଚ କରିବାରେ ତ୍ରୁଟି ହେଲା। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।');
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = () => {
    if (onBack) {
      onBack();
    } else {
      setActiveScreen('home');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Return to store button */}
      <button
        onClick={handleReturn}
        className="absolute top-5 left-5 text-slate-400 hover:text-white flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 transition-colors z-10 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{isEnglish ? 'Return to Store' : 'ଦୋକାନକୁ ଫେରନ୍ତୁ'}</span>
      </button>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10">
        <div className="text-center space-y-2 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <span>Store Admin Portal</span>
          </h2>
          <p className="text-xs text-slate-400">
            {isEnglish
              ? 'Authorized store administrator login for catalog, orders & settings'
              : 'ମୁନ୍ନା ଗ୍ରୋସରୀ ଆଡମିନ୍ ପୋର୍ଟାଲ୍ ଲଗଇନ୍'}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username (10 digits) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              {isEnglish ? 'Admin Username (10 digits)' : 'ଆଡମିନ୍ Username (୧୦ ଅଙ୍କ)'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                maxLength={10}
                inputMode="numeric"
                autoComplete="off"
                data-lpignore="true"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="10-digit number"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white text-sm font-semibold tracking-wider placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              {isEnglish ? 'Admin Password' : 'ଆଡମିନ୍ Password'}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                data-lpignore="true"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white text-sm font-semibold tracking-wider placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                {isEnglish ? 'Authenticating...' : 'ଯାଞ୍ଚ ହେଉଛି...'}
              </span>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>{isEnglish ? 'Sign In to Dashboard' : 'ଆଡମିନ୍ ପ୍ୟାନେଲ୍ ଖୋଲନ୍ତୁ'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
