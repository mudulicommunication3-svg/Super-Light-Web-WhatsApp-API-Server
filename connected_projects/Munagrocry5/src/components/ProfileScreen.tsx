import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import {
  ArrowLeft,
  User,
  Globe,
  Receipt,
  MapPin,
  ShieldCheck,
  CreditCard,
  LockKeyhole,
  LogOut,
  LogIn,
  Heart,
  Download,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { isNativeAndroidApp } from '../utils/device';
import { getDirectApkDownloadUrl } from './PWAInstallButton';
import { showToast } from './Toast';

export const ProfileScreen: React.FC = () => {
  const {
    sessionUser,
    setSessionUser,
    isAdminLoggedIn,
    logoutAdmin,
    setShowLoginModal,
    setShowAdminPinModal,
    setActiveScreen,
    goBackScreen,
    myOrders,
    addresses,
    wishlistCount,
    setShowPermissionModal,
    setShowPaymentPolicyModal,
    shopConfig,
    isRefreshingOrders,
    isLoadingAddresses,
    refreshOrders,
    refreshAddresses
  } = useApp();

  const { language, setLanguage, isEnglish, setIsEnglish, t } = useLanguage();

  useEffect(() => {
    refreshOrders(false);
    if (sessionUser?.phone) {
      refreshAddresses();
    }
  }, [sessionUser?.phone]);

  const handleSelectLang = (lang: 'en' | 'or') => {
    setLanguage(lang);
    setIsEnglish(lang === 'en');
  };

  const userOrders = myOrders.filter((o) => {
    if (!sessionUser) return false;
    const cleanUser = sessionUser.phone ? sessionUser.phone.replace(/\D/g, '').slice(-10) : '';
    const cleanOrder = String(o.phone || '').replace(/\D/g, '').slice(-10);
    if (cleanUser && cleanOrder === cleanUser) return true;
    if (sessionUser.user_id && o.user_id && String(sessionUser.user_id) === String(o.user_id)) return true;
    return false;
  });

  const isSheetBusy = isRefreshingOrders || isLoadingAddresses;

  return (
    <div className="fixed inset-0 z-30 bg-[#f1f3f6] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0c2340] text-white px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveScreen('home')}
            className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center cursor-pointer hover:bg-white/25 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div>
            <h3 className="font-extrabold text-sm leading-tight">
              {t('profile')}
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            refreshOrders(false);
            if (sessionUser?.phone) refreshAddresses();
          }}
          disabled={isSheetBusy}
          className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="max-w-md mx-auto p-3.5 pb-28 space-y-3">
        {/* Profile Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-[#ffd43b] text-slate-900 font-black text-2xl flex items-center justify-center shadow-xs shrink-0">
            {sessionUser?.name ? sessionUser.name.charAt(0).toUpperCase() : 'M'}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-black text-slate-800 text-sm truncate">
              {sessionUser?.name || t('welcomeGuest')}
            </h4>
            <p className="text-xs text-slate-500 truncate">
              {sessionUser?.phone ? `📞 ${sessionUser.phone}` : 'No phone linked'}
            </p>
            <p className="text-[10px] text-slate-400">
              {sessionUser ? 'Verified Store Account' : 'Login to save orders & cart'}
            </p>
          </div>
        </div>

        {/* Auth Row */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5">
          {sessionUser ? (
            <button
              onClick={() => {
                if (confirm(isEnglish ? 'Are you sure you want to logout?' : 'ଲଗଆଉଟ୍ କରିବାକୁ ଚାହାଁନ୍ତି କି?')) {
                  setSessionUser(null);
                }
              }}
              className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('logout')}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="w-full py-2.5 rounded-xl bg-[#0c2340] hover:bg-blue-950 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{t('loginSignUp')}</span>
            </button>
          )}
        </div>

        {/* Dedicated Order History Section when logged in */}
        {sessionUser && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>{isEnglish ? 'My Order History' : 'ମୋ ଅର୍ଡର ଇତିହାସ'}</span>
              </div>
              <button
                onClick={() => setActiveScreen('orders')}
                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
              >
                {isEnglish ? 'View All' : 'ସବୁ ଦେଖନ୍ତୁ'}
              </button>
            </div>

            {userOrders.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2.5">
                {isEnglish ? 'No orders placed yet with this account.' : 'କୌଣସି ଅର୍ଡର ଏପର୍ଯ୍ୟନ୍ତ ହୋଇନାହିଁ।'}
              </p>
            ) : (
              <div className="space-y-2">
                {userOrders.slice(0, 3).map((o) => (
                  <div
                    key={o.id}
                    onClick={() => setActiveScreen('orders')}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div>
                      <p className="font-extrabold text-slate-800">{o.id}</p>
                      <p className="text-[10px] text-slate-400">{o.timestamp}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-900 block">Rs.{o.total}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                        {o.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* App Language Selector Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Globe className="w-4 h-4 text-emerald-600" />
            <span>App Language / ଭାଷା ଚୟନ</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleSelectLang('en')}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                language === 'en'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>English</span>
              {language === 'en' && <span className="text-[10px]">✓</span>}
            </button>
            <button
              onClick={() => handleSelectLang('or')}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                language === 'or'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>ଓଡ଼ିଆ</span>
              {language === 'or' && <span className="text-[10px]">✓</span>}
            </button>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100">
          <button
            onClick={() => setActiveScreen('wishlist')}
            className="w-full flex items-center justify-between p-3.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              <span>{t('myWishlist')}</span>
            </div>
            <span className="text-[11px] text-slate-400 font-semibold">{wishlistCount}</span>
          </button>

          <button
            onClick={() => setActiveScreen('orders')}
            className="w-full flex items-center justify-between p-3.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Receipt className="w-4 h-4 text-[#0c2340]" />
              <span>{t('myOrders')}</span>
            </div>
            <span className="text-[11px] text-slate-400 font-semibold">{myOrders.length}</span>
          </button>

          <button
            onClick={() => setActiveScreen('address')}
            className="w-full flex items-center justify-between p-3.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-[#0c2340]" />
              <span>{t('savedAddresses')}</span>
            </div>
            <span className="text-[11px] text-slate-400 font-semibold">{addresses.length}</span>
          </button>

          {/* Device & Hardware Permissions Manager */}
          <button
            onClick={() => setShowPermissionModal(true)}
            className="w-full flex items-center justify-between p-3.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{isEnglish ? 'Device Hardware Permissions' : 'ଡିଭାଇସ୍ ଓ ହାର୍ଡୱେର୍ ଅନୁମତି'}</span>
            </div>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-extrabold border border-emerald-200">
              GPS · Camera · Alerts
            </span>
          </button>

          {/* Payment & Refund Policy */}
          <button
            onClick={() => setShowPaymentPolicyModal(true)}
            className="w-full flex items-center justify-between p-3.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-4 h-4 text-[#1864ab]" />
              <span>Payment & Refund Policy (ପେମେଣ୍ଟ୍ ଓ ରିଫଣ୍ଡ୍ ନିୟମ)</span>
            </div>
            <span className="text-[10px] text-[#1864ab] bg-blue-50 px-2 py-0.5 rounded-full font-extrabold border border-blue-200">
              PhonePe · GPay · UPI
            </span>
          </button>

          {/* Direct Android APK Download (Only on web browser, not inside app) */}
          {!isNativeAndroidApp() && (
            <a
              href={getDirectApkDownloadUrl(shopConfig.appDownloadUrl)}
              download="munagrocery.apk"
              target={getDirectApkDownloadUrl(shopConfig.appDownloadUrl).startsWith('http') ? '_blank' : undefined}
              rel={getDirectApkDownloadUrl(shopConfig.appDownloadUrl).startsWith('http') ? 'noopener noreferrer' : undefined}
              onClick={() => showToast(isEnglish ? '⬇️ Starting App Download...' : '⬇️ ଆପ୍ ଡାଉନଲୋଡ୍ ଆରମ୍ଭ ହେଉଛି...')}
              className="w-full flex items-center justify-between p-3.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Download className="w-4 h-4 text-emerald-600" />
                <span>{isEnglish ? 'Download Android App (APK)' : 'ମୋବାଇଲ୍ ଆପ୍ ଡାଉନଲୋଡ୍ (APK)'}</span>
              </div>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-extrabold border border-emerald-200">
                Direct Download
              </span>
            </a>
          )}

          {isAdminLoggedIn && (
            <button
              onClick={() => setActiveScreen('admin')}
              className="w-full flex items-center justify-between p-3.5 text-left text-xs font-bold text-[#0c2340] bg-blue-50/50 hover:bg-blue-50 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#0c2340]" />
                <span>Admin Panel Dashboard</span>
              </div>
              <span className="text-[10px] font-black bg-[#0c2340] text-white px-2 py-0.5 rounded-full">
                ACTIVE
              </span>
            </button>
          )}
        </div>

        {/* Admin Login Portal Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-black text-slate-700">
            <LockKeyhole className="w-4 h-4 text-amber-500" />
            <span>Admin Management Portal</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-snug">
            {isEnglish
              ? 'Authorized store administrator login for catalog, orders, and shop controls.'
              : '10-ଅଙ୍କ Username / Password ଦେଇ ଆଡମିନ୍ ପ୍ୟାନେଲ୍ ଖୋଲନ୍ତୁ।'}
          </p>

          {!isAdminLoggedIn ? (
            <button
              onClick={() => setShowAdminPinModal(true)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin Login</span>
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setActiveScreen('admin')}
                className="flex-1 py-2.5 rounded-xl bg-[#0c2340] hover:bg-blue-950 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Open Admin Panel</span>
              </button>
              <button
                onClick={logoutAdmin}
                className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-extrabold"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 text-[11px] text-slate-500 space-y-1">
          <div className="flex justify-between">
            <span>Total Orders Placed:</span>
            <span className="font-black text-slate-800">{myOrders.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Saved Locations:</span>
            <span className="font-black text-slate-800">{addresses.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
