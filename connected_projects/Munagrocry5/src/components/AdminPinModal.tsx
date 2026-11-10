import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, X, Eye, EyeOff, Lock, User } from 'lucide-react';
import { checkAdminAuthOnSheet } from '../services/api';

export const AdminPinModal: React.FC = () => {
  const { showAdminPinModal, setShowAdminPinModal, loginAdmin, setActiveScreen, isEnglish } = useApp();

  // Zero prefill - explicitly start empty to prevent saved password autofill
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Clear inputs whenever modal opens
  useEffect(() => {
    if (showAdminPinModal) {
      setUsername('');
      setPassword('');
      setError('');
      setShowPassword(false);
    }
  }, [showAdminPinModal]);

  if (!showAdminPinModal) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.replace(/\D/g, '').slice(-10);
    const cleanPass = password.trim();

    if (cleanUser.length !== 10) {
      setError(isEnglish ? 'Username must be a 10-digit number' : 'Username 10-ଅଙ୍କ ବିଶିଷ୍ଟ ହେବା ଆବଶ୍ୟକ।');
      return;
    }

    if (!cleanPass) {
      setError(isEnglish ? 'Please enter your password' : 'ଦୟାକରି Password ଲେଖନ୍ତୁ।');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isValid = await checkAdminAuthOnSheet(cleanUser, cleanPass);
      if (isValid) {
        loginAdmin();
        setShowAdminPinModal(false);
        setActiveScreen('admin');
        return;
      } else {
        setError(
          isEnglish
            ? '❌ Invalid Username or Password!'
            : '❌ ଭୁଲ୍ Username କିମ୍ବା Password!'
        );
      }
    } catch (err) {
      setError(
        isEnglish
          ? '❌ Error verifying credentials. Please try again.'
          : '❌ ଯାଞ୍ଚ କରିବାରେ ତ୍ରୁଟି ହେଲା। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[85] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-xs rounded-3xl p-5 shadow-2xl text-center relative border border-slate-100 animate-scaleUp">
        <button
          onClick={() => setShowAdminPinModal(false)}
          className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-2 shadow-xs">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="font-extrabold text-slate-900 text-sm">
          {isEnglish ? 'Admin Security Login' : 'Admin Login (ଆଡମିନ୍)'}
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {isEnglish ? 'Enter authorized credentials' : '10-ଅଙ୍କ Username ଓ Password ଦିଅନ୍ତୁ'}
        </p>

        {/* Form with anti-autofill controls */}
        <form
          onSubmit={handleVerify}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          data-lpignore="true"
          className="mt-3.5 space-y-3"
        >
          {/* Dummy hidden inputs to absorb browser autofill heuristics */}
          <div style={{ display: 'none' }} aria-hidden="true">
            <input type="text" name="fake_autofill_user" tabIndex={-1} autoComplete="off" />
            <input type="password" name="fake_autofill_pass" tabIndex={-1} autoComplete="new-password" />
          </div>

          {/* Username Input */}
          <div className="text-left">
            <label className="text-[10px] font-bold text-slate-500 block mb-1 flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400" />
              <span>Username (10 digits)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                name="store_admin_id"
                id="adminUsernameInput"
                required
                maxLength={10}
                inputMode="numeric"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="10-digit number"
                className="w-full text-center tracking-widest text-sm font-bold py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="text-left">
            <label className="text-[10px] font-bold text-slate-500 block mb-1 flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Password</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="store_admin_key"
                id="adminPasswordInput"
                required
                maxLength={20}
                autoComplete="new-password"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-center tracking-widest text-sm font-bold py-2 pl-3 pr-9 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[10px] text-rose-600 font-bold bg-rose-50 p-1.5 rounded-lg border border-rose-100">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAdminPinModal(false)}
              className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-1/2 py-2.5 rounded-xl bg-[#0c2340] hover:bg-blue-950 text-white text-xs font-black shadow-sm cursor-pointer active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? (isEnglish ? 'Checking...' : 'ଯାଞ୍ଚ...') : (isEnglish ? 'Login' : 'ଲଗଇନ୍')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
