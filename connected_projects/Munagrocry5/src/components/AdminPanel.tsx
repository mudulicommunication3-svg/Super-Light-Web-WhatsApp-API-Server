import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Package,
  Layers,
  Settings,
  Users,
  Store,
  LogOut,
  ArrowLeft,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  Menu,
  X,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Receipt,
  Sparkles,
  Database,
  Eye,
  Save,
  Check,
  Flame,
  Zap,
  Pause,
  Play,
  MessageSquare
} from 'lucide-react';
import { Calculator } from 'lucide-react';
import { AdminAuth } from './admin/AdminAuth';
import { AdminPos } from './admin/AdminPos';
import { AdminOrders } from './admin/AdminOrders';
import { AdminTrending } from './admin/AdminTrending';
import { AdminCatalog } from './admin/AdminCatalog';
import { AdminAiAddProduct } from './admin/AdminAiAddProduct';
import { AdminWhatsAppLoop } from './admin/AdminWhatsAppLoop';
import { AdminSettings } from './admin/AdminSettings';
import { AdminUsers } from './admin/AdminUsers';
import { AdminBanners } from './admin/AdminBanners';
import { AdminSheets } from './admin/AdminSheets';
import { AdminViewers } from './admin/AdminViewers';
import { saveConfigToSheet, fetchSheetConfig } from '../services/api';
import { normalizeTrending } from '../types';

export type AdminTab = 'pos' | 'orders' | 'trending' | 'catalog' | 'ai_add' | 'wa_loop' | 'users' | 'banners' | 'sync' | 'settings' | 'viewers';

export const AdminPanel: React.FC = () => {
  const {
    isAdminLoggedIn,
    logoutAdmin,
    setActiveScreen,
    catalog,
    myOrders,
    shopConfig,
    banners,
    adminNotice,
    updateShopConfig,
    hasUnsavedAdminChanges,
    setHasUnsavedAdminChanges,
    isSyncPaused,
    pauseSyncRemainingSec,
    pauseBackgroundSync,
    resumeBackgroundSync
  } = useApp();
  const { isEnglish } = useLanguage();

  const [activeTab, setActiveTab] = useState<AdminTab>('pos');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [masterSaveToast, setMasterSaveToast] = useState<{ message: string; ok: boolean } | null>(null);

  const formatPauseCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // If not logged in as Admin, show the AdminAuth screen
  if (!isAdminLoggedIn) {
    return <AdminAuth onSuccess={() => setActiveTab('pos')} onBack={() => setActiveScreen('home')} />;
  }

  // Stat Calculations
  const totalRevenue = myOrders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const pendingOrdersCount = myOrders.filter((o) => o.status === 'pending').length;

  const outOfStockCount = catalog.filter((p) => {
    const s = typeof p.stock_qty === 'number' ? p.stock_qty : parseInt(p.stock_qty || '0', 10);
    return s <= 0;
  }).length;

  const activeProductsCount = catalog.length;

  const handleLogout = () => {
    if (
      confirm(
        isEnglish
          ? 'Are you sure you want to log out of the Admin Panel?'
          : 'ଆଡମିନ୍ ପ୍ୟାନେଲ୍‌ରୁ ଲଗ୍ ଆଉଟ୍ କରିବାକୁ ଚାହାଁନ୍ତି କି?'
      )
    ) {
      logoutAdmin();
      setActiveScreen('home');
    }
  };

  // 💾 MASTER SAVE — pushes EVERYTHING (trending + banners + settings + notice)
  // to the shared Google Sheet, verifies via readback, and auto-resumes sync!
  const handleSaveAllToSheet = async () => {
    setIsSavingAll(true);
    setMasterSaveToast(null);

    // Also flush and save any pending product price/MRP/stock row edits in AdminCatalog
    try {
      window.dispatchEvent(new CustomEvent('munna-flush-catalog-edits'));
    } catch (e) {}

    // Snapshot currently staged trending before network push
    const stagedTrending = normalizeTrending(shopConfig.trending);

    try {
      const res = await saveConfigToSheet(shopConfig, banners, adminNotice);

      // Verify read-back safely
      let verified = false;
      try {
        const verifyData = await fetchSheetConfig();
        if (verifyData && verifyData.config) {
          verified = true;
          // CRITICAL: Preserve current trending if verifyData returned empty or was delayed
          const serverTrending = normalizeTrending(verifyData.config.trending);
          const finalTrending = stagedTrending.length > 0 ? stagedTrending : serverTrending;

          updateShopConfig({
            ...verifyData.config,
            trending: finalTrending
          });
        }
      } catch (e) {}

      // Keep local state consistent with what was just saved
      if (stagedTrending.length > 0) {
        updateShopConfig({ trending: stagedTrending });
      }

      setHasUnsavedAdminChanges(false);
      // Automatically re-enable background sync as soon as Save is clicked
      resumeBackgroundSync(false);
      setMasterSaveToast({
        message:
          '✅ ଯାଞ୍ଚ ହୋଇଗଲା — Sheet ରେ ସେଭ୍ ଅଛି ଓ ଅଟୋ-ସିଙ୍କ୍ ପୁଣି ଚାଲୁ ହେଲା!\n🔥 Trending (' +
          stagedTrending.length +
          ') · 🚚 ଡେଲିଭରୀ · 🎟️ କୁପନ୍ · 📢 Banners ସମସ୍ତ ଗ୍ରାହକ ଫୋନ୍ ରେ ଲାଗୁ ହୋଇଛି!',
        ok: true
      });
    } catch (e: any) {
      setMasterSaveToast({
        message: '❌ ସେଭ୍ ତ୍ରୁଟି: ' + (e?.message || 'Network error'),
        ok: false
      });
    } finally {
      setIsSavingAll(false);
      setTimeout(() => setMasterSaveToast(null), 6000);
    }
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: any; count?: number; badgeColor?: string }> = [
    { id: 'pos', label: '🛒 POS Counter', icon: Calculator, badgeColor: 'bg-emerald-500 text-slate-950 font-black' },
    { id: 'orders', label: '📦 Orders', icon: Package, count: pendingOrdersCount, badgeColor: 'bg-amber-500 text-slate-950' },
    { id: 'trending', label: '⭐ Trending', icon: Flame, count: (shopConfig.trending || []).length, badgeColor: 'bg-amber-400 text-slate-950 font-black' },
    { id: 'catalog', label: '🏷️ Catalog', icon: Layers, count: outOfStockCount, badgeColor: 'bg-rose-500 text-white' },
    { id: 'wa_loop', label: '📲 WA Loop', icon: MessageSquare, badgeColor: 'bg-emerald-500 text-slate-950 font-black' },
    { id: 'ai_add', label: '⚡ Cline AI Studio', icon: Zap },
    { id: 'users', label: '👥 Users', icon: Users },
    { id: 'banners', label: '📢 Banners', icon: Sparkles },
    { id: 'sync', label: '⚙️ Sheets', icon: Database },
    { id: 'settings', label: '🛒 Shop', icon: Settings },
    { id: 'viewers', label: '👁️ Viewers', icon: Eye }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#0f172a] text-slate-100 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* ================= DESKTOP & TABLET SIDEBAR ================= */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0">
        {/* Brand / Logo */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-tight">MUNNA STORE</h1>
              <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                Admin Console
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (7 Canonical Tabs) */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1864ab] text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      item.badgeColor || 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={() => setActiveScreen('home')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>View Public Store</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Admin Logout</span>
          </button>
        </div>
      </aside>

      {/* ================= MOBILE HEADER ================= */}
      <header className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-black text-sm text-white">MUNNA STORE ADMIN</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveScreen('home')}
            className="text-xs bg-slate-800 px-2.5 py-1.5 rounded-lg text-slate-300 font-bold hover:text-white cursor-pointer"
          >
            Store
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 text-rose-400 bg-rose-500/10 rounded-lg hover:bg-rose-500/20 cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Horizontal Scrolling Tabs Strip (Matches admin_46921951.html) */}
      <div className="md:hidden bg-white border-b border-slate-200 text-[11px] font-bold text-slate-600 sticky top-0 z-20 overflow-x-auto no-scrollbar flex shrink-0">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`flex-1 py-2.5 px-3 text-center border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'border-[#1864ab] text-[#1864ab] font-black'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span className="ml-1 text-[9px] bg-amber-500 text-slate-950 px-1 py-0.2 rounded-full font-black">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= MAIN DASHBOARD BODY ================= */}
      <main className="flex-1 overflow-y-auto bg-slate-50 text-slate-800 flex flex-col relative">
        {/* Sticky MASTER SAVE & 5-MIN PAUSE SYNC BAR — Pushes EVERYTHING to Google Sheet with Verification */}
        <div className={`border-b px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 sticky top-0 z-30 shadow-xs transition-colors ${
          isSyncPaused
            ? 'bg-indigo-950 text-white border-indigo-800'
            : hasUnsavedAdminChanges
              ? 'bg-amber-100 border-amber-300'
              : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              isSyncPaused
                ? 'bg-amber-400 animate-pulse'
                : hasUnsavedAdminChanges
                  ? 'bg-orange-600 animate-ping'
                  : 'bg-emerald-500'
            }`}></span>
            <span className={`text-xs font-black leading-tight ${isSyncPaused ? 'text-indigo-100' : 'text-amber-950'}`}>
              {isSyncPaused
                ? `⏸️ Sync Paused for Editing (${formatPauseCountdown(pauseSyncRemainingSec)} left) — Auto-resumes in 5m or when you click Save`
                : hasUnsavedAdminChanges
                  ? '⚠️ Unsaved modifications staged (ଅସେଭ୍ ପରିବର୍ତ୍ତନ ଅଛି) — Click "Save All to Sheet"'
                  : '📤 All changes saved • Pause sync for 5m while editing or click Save to publish'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (isSyncPaused) {
                  resumeBackgroundSync(true);
                } else {
                  pauseBackgroundSync(5);
                }
              }}
              className={`px-3 py-1.5 text-xs font-black rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95 ${
                isSyncPaused
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-2 ring-amber-200'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
              title={
                isSyncPaused
                  ? 'Click to resume background sync immediately'
                  : 'Pause background sync for 5 minutes while editing (auto-resumes after 5m or on Save)'
              }
            >
              {isSyncPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  <span>▶️ Resume Sync ({formatPauseCountdown(pauseSyncRemainingSec)})</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>⏸️ Pause Sync (5 Min)</span>
                </>
              )}
            </button>

            <button
              onClick={handleSaveAllToSheet}
              disabled={isSavingAll}
              className={`px-4 py-1.5 text-xs font-black rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-all disabled:opacity-50 active:scale-95 text-white ${
                hasUnsavedAdminChanges || isSyncPaused
                  ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-400/50'
                  : 'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              <Save className={`w-3.5 h-3.5 ${isSavingAll ? 'animate-spin' : ''}`} />
              <span>{isSavingAll ? 'Verifying with Sheet…' : (hasUnsavedAdminChanges ? '💾 Save All Changes to Sheet' : '💾 Save All to Sheet')}</span>
            </button>
          </div>
        </div>

        {/* Master Save Status Notification */}
        {masterSaveToast && (
          <div
            className={`px-4 py-2 text-xs font-bold border-b transition-all flex items-center justify-between ${
              masterSaveToast.ok
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <span className="whitespace-pre-line leading-relaxed">{masterSaveToast.message}</span>
            <button
              onClick={() => setMasterSaveToast(null)}
              className="text-slate-400 hover:text-slate-700 ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* High-Contrast Quick Metrics (always accessible) */}
        <div className="p-3 sm:p-4 bg-slate-900 text-white border-b border-slate-800 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="bg-slate-800/90 border border-slate-700/80 p-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Revenue
            </span>
            <p className="text-lg font-black text-emerald-400 mt-0.5">Rs. {totalRevenue}</p>
          </div>
          <div className="bg-slate-800/90 border border-slate-700/80 p-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Pending Orders
            </span>
            <p className="text-lg font-black text-amber-400 mt-0.5">{pendingOrdersCount}</p>
          </div>
          <div className="bg-slate-800/90 border border-slate-700/80 p-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Out of Stock
            </span>
            <p className="text-lg font-black text-rose-400 mt-0.5">{outOfStockCount}</p>
          </div>
          <div className="bg-slate-800/90 border border-slate-700/80 p-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Catalog
            </span>
            <p className="text-lg font-black text-blue-400 mt-0.5">{activeProductsCount}</p>
          </div>
        </div>

        {/* Tab View Container */}
        <div className="p-3.5 sm:p-5 flex-1 pb-24">
          {activeTab === 'pos' && <AdminPos />}
          {activeTab === 'orders' && <AdminOrders />}
          {activeTab === 'trending' && <AdminTrending />}
          {activeTab === 'catalog' && <AdminCatalog />}
          {activeTab === 'wa_loop' && <AdminWhatsAppLoop />}
          {activeTab === 'ai_add' && <AdminAiAddProduct />}
          {activeTab === 'users' && <AdminUsers />}
          {activeTab === 'banners' && <AdminBanners />}
          {activeTab === 'sync' && <AdminSheets />}
          {activeTab === 'settings' && <AdminSettings />}
          {activeTab === 'viewers' && <AdminViewers />}
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
