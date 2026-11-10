import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import {
  X,
  Phone,
  Lock,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  UserPlus,
  Check,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { checkCustomerAuth, registerCustomerToSheet } from '../services/api';

export const AuthModal: React.FC = () => {
  const {
    showLoginModal,
    setShowLoginModal,
    setSessionUser,
    authNoticeMessage,
    setAuthNoticeMessage,
    pendingCheckout,
    setPendingCheckout,
    setActiveScreen
  } = useApp();
  const { t, isEnglish } = useLanguage();

  // Step 1: Phone & Password. Step 2: New User Registration (Name & Confirm Password)
  const [step, setStep] = useState<1 | 2>(1);

  // Form Fields
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (showLoginModal) {
      setStep(1);
      setPhone('');
      setPassword('');
      setName('');
      setConfirmPassword('');
      setError(null);
      setSuccessMsg(null);
      setLoading(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [showLoginModal]);

  if (!showLoginModal) return null;

  const handleClose = () => {
    if (loading) return;
    setShowLoginModal(false);
    setAuthNoticeMessage(null);
  };

  const handleSuccessRedirect = () => {
    const isPending = pendingCheckout;
    if (isPending) {
      setPendingCheckout(false);
      setAuthNoticeMessage(null);
      setActiveScreen('cart');
    }
    setShowLoginModal(false);
  };

  // STEP 1 SUBMIT: Strictly check Users sheet on Google Sheet & verify SHA-256 PasswordHash
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setError(t('enterValidPhone'));
      return;
    }

    if (!password || password.length < 6) {
      setError(t('passwordMinLength'));
      return;
    }

    setLoading(true);

    try {
      const result = await checkCustomerAuth(cleanPhone, password);

      if (result.status === 'EXISTING_VALID') {
        const customer = result.customer;
        const sessionPayload = {
          user_id: customer?.user_id,
          phone: cleanPhone,
          name: customer?.name || 'Customer',
          address: customer?.default_address || '',
          total_orders: customer?.total_orders || 0,
          isLoggedIn: true
        };

        setSessionUser(sessionPayload);
        setSuccessMsg(t('loginSuccess'));

        setTimeout(() => {
          handleSuccessRedirect();
        }, 700);
      } else if (result.status === 'EXISTING_INVALID') {
        setError(t('incorrectPassword'));
      } else if (result.status === 'NEW_USER') {
        setStep(2);
        setConfirmPassword('');
      } else {
        setError(
          isEnglish
            ? 'Server is responding slowly. Please tap Continue again to retry.'
            : 'ସର୍ଭର୍ ଧୀରେ ଚାଲୁଛି। ଦୟାକରି ପୁଣି ଥରେ Continue ଦବାନ୍ତୁ।'
        );
      }
    } catch (err) {
      setError(
        isEnglish
          ? 'Could not connect. Please check internet connection and try again.'
          : 'ସଂଯୋଗ ହୋଇପାରିଲା ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।'
      );
    } finally {
      setLoading(false);
    }
  };

  // STEP 2 SUBMIT: Register new user
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError(t('enterFullName'));
      return;
    }

    if (!confirmPassword) {
      setError(t('confirmPassword'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    setLoading(true);

    try {
      const newRec = await registerCustomerToSheet(trimmedName, cleanPhone, password);
      if (!newRec) {
        setError(
          isEnglish
            ? 'Took too long to save your account. Please tap Create Account again.'
            : 'ଆକାଉଣ୍ଟ ସେଭ୍ ହେବାରେ ବିଳମ୍ବ ହେଲା। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।'
        );
        return;
      }

      const sessionPayload = {
        user_id: newRec.user_id,
        phone: cleanPhone,
        name: trimmedName,
        address: '',
        total_orders: 0,
        isLoggedIn: true
      };

      setSessionUser(sessionPayload);
      setSuccessMsg(t('accountCreated'));
      setTimeout(() => {
        handleSuccessRedirect();
      }, 900);
    } catch (err) {
      setError(
        isEnglish
          ? 'Error saving account. Please try again.'
          : 'ଆକାଉଣ୍ଟ ସେଭ୍ କରିବାରେ ତ୍ରୁଟି ହେଲା। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      {/* Modern Card Container */}
      <div className="rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-100 max-w-sm w-full mx-auto relative overflow-hidden animate-fadeIn">
        {/* Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-[#ffd43b] to-[#0c2340]" />

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-3 mt-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#0c2340] text-yellow-300 flex items-center justify-center font-black text-sm shadow-xs">
              M
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                {t('loginSignUp')}
              </h3>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Simple Round Spinner Only */}
        {loading && (
          <div className="mb-3.5 flex items-center justify-center py-2">
            <div className="w-7 h-7 rounded-full border-3 border-slate-200 border-t-emerald-600 animate-spin" />
          </div>
        )}

        {/* Friendly Checkout Notice Banner when checkout guard triggers */}
        {authNoticeMessage && (
          <div className="mb-3.5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-start gap-2 shadow-2xs animate-fadeIn">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{authNoticeMessage}</span>
          </div>
        )}

        {/* Success Alert Banner */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-800 text-xs font-bold animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-700 text-xs font-bold animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* STEP 1: PHONE & PASSWORD CHECK (against Users sheet) */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-3.5">
            <div className="bg-slate-50/80 rounded-2xl p-2.5 border border-slate-100 text-slate-600 text-xs font-medium">
              <p className="leading-snug">
                {isEnglish
                  ? 'Enter your mobile number and password. We will verify your account or help you register.'
                  : 'ଆପଣଙ୍କ ମୋବାଇଲ୍ ନମ୍ବର ଓ ପାସୱାର୍ଡ ଦିଅନ୍ତୁ। ଯଦି ନୂଆ ୟୁଜର୍, ତୁରନ୍ତ ଆକାଉଣ୍ଟ୍ ଖୋଲିପାରିବେ।'}
              </p>
            </div>

            {/* Mobile Number Field */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                {t('mobileNumber')}
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400 flex items-center pointer-events-none">
                  <Phone className="w-4 h-4" />
                </div>
                <div className="absolute left-9 text-xs font-bold text-slate-400 select-none border-r border-slate-200 pr-2">
                  +91
                </div>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                    if (error) setError(null);
                  }}
                  placeholder="9876543210"
                  className="w-full pl-20 pr-4 py-3 bg-white text-slate-900 text-sm font-bold rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-300"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                {t('password')}
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-400 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-white text-slate-900 text-sm font-bold rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 pl-1">
                {isEnglish ? 'Minimum 6 characters' : 'ଅନ୍ତତଃ ୬ ଅକ୍ଷର'}
              </p>
            </div>

            {/* Action Button: Continue */}
            <button
              type="submit"
              disabled={loading || phone.length < 10 || password.length < 6}
              className="w-full py-3.5 mt-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              {loading ? (
                <span>{t('checkingAccount')}</span>
              ) : (
                <>
                  <span>{t('continueBtn')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: REGISTRATION FOR NEW USER */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-3.5 animate-fadeIn">
            {/* New User Alert */}
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-amber-200/80 flex items-center justify-center shrink-0 mt-0.5 text-amber-800">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black leading-tight">
                  {t('newUserDetected')}
                </p>
                <p className="text-[10px] text-amber-700 mt-0.5 leading-snug">
                  {isEnglish
                    ? 'Enter your name and confirm password to finish creating your account.'
                    : 'ଆପଣଙ୍କ ନାମ ଓ ପାସୱାର୍ଡ ନିଶ୍ଚିତ କରି ଆକାଉଣ୍ଟ୍ ଖୋଲନ୍ତୁ।'}
                </p>
              </div>
            </div>

            {/* Read-only Phone (from Step 1) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-extrabold text-slate-700">
                  {t('mobileNumber')}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError(null);
                  }}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>{t('backToStep1')}</span>
                </button>
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400 pointer-events-none">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  disabled
                  value={`+91 ${phone}`}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-2xl border border-slate-200 cursor-not-allowed select-none"
                />
              </div>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                {t('fullName')} <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={isEnglish ? 'e.g. Ramesh Sahoo' : 'ଆପଣଙ୍କ ସମ୍ପୂର୍ଣ୍ଣ ନାମ'}
                  className="w-full pl-9 pr-4 py-2.5 bg-white text-slate-900 text-sm font-bold rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-300"
                />
              </div>
            </div>

            {/* Masked Password (from Step 1) */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                {t('password')}
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-11 py-2.5 bg-white text-slate-900 text-sm font-bold rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                {t('confirmPassword')} <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={isEnglish ? 'Re-enter your password' : 'ପାସୱାର୍ଡ ନିଶ୍ଚିତ କରନ୍ତୁ'}
                  className="w-full pl-9 pr-11 py-2.5 bg-white text-slate-900 text-sm font-bold rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Action Button: Create Account */}
            <button
              type="submit"
              disabled={loading || !name.trim() || !confirmPassword}
              className="w-full py-3.5 mt-2 rounded-2xl bg-[#0c2340] hover:bg-slate-900 disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              {loading ? (
                <span>{t('creatingAccount')}</span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 text-yellow-300" />
                  <span>{t('createAccount')}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Bottom Trust Note */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
          <Lock className="w-3 h-3 text-emerald-600" />
          <span>
            {isEnglish
              ? 'Secure Encrypted Account'
              : 'ସୁରକ୍ଷିତ ଏନକ୍ରିପ୍ଟେଡ୍ ଆକାଉଣ୍ଟ'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
