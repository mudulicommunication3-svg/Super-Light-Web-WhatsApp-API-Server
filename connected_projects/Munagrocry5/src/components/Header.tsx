import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { Product } from '../types';
import {
  MapPin,
  Zap,
  Lock,
  Truck,
  Store,
  Search,
  Barcode,
  XCircle,
  ShoppingBag,
  Heart,
  Sparkles
} from 'lucide-react';
import { isStoreOpenNow, isStorePickupActive, isCodDeliveryActive } from '../services/api';
import { PWAInstallButton } from './PWAInstallButton';
import { SearchSuggestions } from './SearchSuggestions';

interface HeaderProps {
  isCollapsed?: boolean;
}

export const Header: React.FC<HeaderProps> = () => {
  const {
    cart,
    wishlistCount,
    shopConfig,
    searchQuery,
    setSearchQuery,
    setActiveScreen,
    setShowScanner,
    catalog,
    setActiveCategory,
    setSelectedProduct
  } = useApp();
  const { t, language } = useLanguage();
  const isEnglish = language === 'en';

  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close suggestions on outside tap/click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSuggestionsOpen(false);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const recordUserSearchTerm = (rawTerm: string) => {
    const clean = (rawTerm || '').trim().toLowerCase();
    if (clean.length < 2) return;
    try {
      const existing = JSON.parse(localStorage.getItem('munna_user_search_counts_v1') || '{}');
      existing[clean] = (Number(existing[clean]) || 0) + 1;
      localStorage.setItem('munna_user_search_counts_v1', JSON.stringify(existing));
    } catch {}
  };

  const handleSelectSuggestion = (phrase: string, product?: Product) => {
    recordUserSearchTerm(phrase);
    setSearchQuery(phrase);
    setActiveCategory('All');
    setActiveScreen('home');
    setIsSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    if (product) {
      setSelectedProduct(product);
    }
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsSuggestionsOpen(true);
      setActiveSuggestionIndex((prev) => Math.min(prev + 1, 5));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      recordUserSearchTerm(searchQuery);
      setIsSuggestionsOpen(false);
      setActiveCategory('All');
      setActiveScreen('home');
      if (searchInputRef.current) {
        searchInputRef.current.blur();
      }
    } else if (e.key === 'Escape') {
      setIsSuggestionsOpen(false);
      setActiveSuggestionIndex(-1);
    }
  };

  const totalCartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const storeOpenNow = isStoreOpenNow(shopConfig);

  return (
    <>
      {/* 1. Top Brand, Store Address & Status Bar (Natural scroll flow, scrolls smoothly off-screen) */}
      <div
        id="storeTopBar"
        className="bg-[#0c2340] text-white px-3 pt-3 pb-2.5 w-full select-none"
        style={{
          paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))'
        }}
      >
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          {/* Brand identity: Munna Grocery & Niali, 754004 */}
          <div
            onClick={() => {
              if (window.location.hash) {
                window.history.pushState(null, '', window.location.pathname);
              }
              setActiveScreen('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none min-w-0 flex-1"
          >
            <div className="w-9 h-9 rounded-full bg-[#ffd43b] text-[#0c2340] font-black text-xl flex items-center justify-center shadow-xs shrink-0 border border-white/20">
              M
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <h1
                id="lblStoreName"
                className="m-0 text-base font-extrabold text-white tracking-tight leading-tight truncate"
              >
                {t('storeName')}
              </h1>
              <p
                id="lblStoreSub"
                className="m-0 text-[11px] text-slate-300 font-medium tracking-wide flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block animate-pulse"></span>
                {t('storeLocation')}
              </p>
            </div>
          </div>

          {/* Top Right Actions: App Install, AI Assistant, Wishlist & Cart */}
          <div className="flex items-center gap-1.5 shrink-0">
            <PWAInstallButton />

            {/* AI Assistant Header Button */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-munna-ai-chat'))}
              className="relative h-8 sm:h-9 px-2.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 flex items-center gap-1 transition-colors cursor-pointer shrink-0 active:scale-95"
              title={isEnglish ? 'Ask Store AI' : 'AI ସହାୟକ'}
              aria-label="Open Store AI Assistant"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-[10px] font-black text-white">AI</span>
            </button>

            {/* Wishlist Button */}
            <button
              onClick={() => {
                window.location.hash = 'wishlist';
                setActiveScreen('wishlist');
              }}
              className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-95"
              title={t('wishlist')}
              aria-label={t('wishlist')}
            >
              <Heart className="w-4 h-4 text-white" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white text-[8.5px] font-black flex items-center justify-center border border-[#0c2340] shadow-xs">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Cart Bag Button */}
            <button
              id="navCartHeaderBtn"
              onClick={() => {
                window.location.hash = 'cart';
                setActiveScreen('cart');
              }}
              className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-95 shadow-xs"
              title="View Cart"
              aria-label="View Shopping Cart"
            >
              <ShoppingBag className="w-4 h-4 text-white" />
              {totalCartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#ffd43b] text-[#0c2340] text-[8.5px] font-black flex items-center justify-center border border-[#0c2340] shadow-xs">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Store Address & 3KM Delivery Zone Strip */}
        <div className="max-w-md mx-auto mt-2 bg-white/10 rounded-xl px-2.5 py-1 flex items-center justify-between text-[10px] font-semibold text-slate-200 border border-white/5">
          <span className="flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 text-yellow-300 shrink-0" />
            {t('cinemaHallRoad')}
          </span>
          <span className="text-yellow-300 font-extrabold flex items-center gap-0.5 shrink-0">
            <Zap className="w-3 h-3 fill-yellow-300" /> {t('kmZone')}
          </span>
        </div>

        {/* Store Closed Banner */}
        {!storeOpenNow && (
          <div id="homeStoreClosedBanner" className="max-w-md mx-auto mt-2 rounded-xl bg-orange-50 border border-orange-200 px-3 py-2 flex items-center gap-2.5 shadow-sm text-orange-900">
            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-[11px] font-black leading-tight">{t('storeClosed')}</span>
                <span className="text-[9px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.2 rounded">
                  {shopConfig.storeOpenTime || '10:00 AM'} - {shopConfig.storeCloseTime || '09:00 PM'}
                </span>
              </div>
              <div className="text-[10px] font-bold text-orange-700 leading-tight">
                {shopConfig.storeClosedMessage || (isEnglish ? `Orders accepted • Delivery starts after ${shopConfig.storeOpenTime || '10:00 AM'}` : `ଅର୍ଡର ଗ୍ରହଣ କରାଯାଉଛି • ସକାଳ ${shopConfig.storeOpenTime || '10:00'} ପରେ ଡେଲିଭରୀ ହେବ`)}
              </div>
            </div>
          </div>
        )}

        {/* Delivery / Pickup availability chips (Only shown when store is OPEN) */}
        {storeOpenNow && (() => {
          const isDeliveryOn = isCodDeliveryActive(shopConfig);
          const isPickupOn = isStorePickupActive(shopConfig);
          if (!isDeliveryOn && !isPickupOn) return null;

          return (
            <div id="homeDeliveryPickupBoxes" className={`max-w-md mx-auto grid ${isDeliveryOn && isPickupOn ? 'grid-cols-2' : 'grid-cols-1'} gap-2 w-full mt-2`}>
              {/* Home Delivery Chip */}
              {isDeliveryOn && (
                <div
                  id="homeDeliveryBox"
                  className="bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-white/15 flex items-center gap-2 min-w-0 shadow-xs"
                >
                  <div className="w-7 h-7 shrink-0 rounded-xl bg-white/20 flex items-center justify-center text-white text-sm">
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <span className="text-[11px] font-bold text-white truncate leading-tight">
                      {t('homeDelivery')}
                    </span>
                    <span id="homeBoxTiming" className="text-[10px] text-emerald-300 font-medium truncate leading-tight mt-0.5">
                      {shopConfig.deliveryDay === 'Tomorrow'
                        ? (language === 'or' ? 'ଆସନ୍ତାକାଲି' : 'Tomorrow')
                        : (language === 'or' ? 'ଆଜି' : 'Today')} · {shopConfig.deliverySlot || (language === 'or' ? '୧ ଘଣ୍ଟା' : '1 hr')}
                    </span>
                  </div>
                </div>
              )}

              {/* Store Pickup Chip */}
              {isPickupOn && (
                <div
                  id="homePickupBox"
                  className="bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-white/15 flex items-center gap-2 min-w-0 shadow-xs"
                >
                  <div className="w-7 h-7 shrink-0 rounded-xl bg-white/20 flex items-center justify-center text-white text-sm">
                    <Store className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <span className="text-[11px] font-bold text-white truncate leading-tight">
                      Store Pickup
                    </span>
                    <span id="homePickupState" className="text-[10px] text-emerald-300 font-medium truncate leading-tight mt-0.5">
                      {shopConfig.pickupChargeOn && shopConfig.pickupChargeFee > 0
                        ? `₹${shopConfig.pickupChargeFee} Pickup Fee`
                        : (shopConfig.pickupNote || 'Free Pickup')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* 2. ALWAYS-STICKY SEARCH BAR (Stays pinned at top: 0 with M logo, search bar, and cart bag throughout the entire page scroll!) */}
      <div
        id="stickySearchBar"
        className="sticky top-0 z-40 bg-[#0c2340] text-white px-3 py-2 shadow-md w-full border-t border-white/10"
        style={{
          paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))'
        }}
      >
        <div className="max-w-md mx-auto flex items-center gap-2">
          {/* Compact Munna Logo (Click to scroll to top) */}
          <div
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-8 h-8 rounded-full bg-[#ffd43b] text-[#0c2340] font-black text-base flex items-center justify-center shadow-xs shrink-0 border border-white/20 cursor-pointer active:scale-95 select-none"
            title="Scroll to Top (ମୁଖ୍ୟ ପେଜ୍ ଉପରକୁ ଯାଆନ୍ତୁ)"
          >
            M
          </div>

          {/* Full Search Bar with Suggestions */}
          <div className="relative flex-1 min-w-0" ref={searchContainerRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                id="searchInput"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSuggestionsOpen(true);
                  setActiveSuggestionIndex(-1);
                }}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2) {
                    setIsSuggestionsOpen(true);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder={t('search')}
                autoComplete="off"
                className="w-full pl-8 pr-16 py-2 bg-white text-slate-800 text-xs rounded-full shadow-sm border border-slate-100 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none placeholder:text-slate-400 font-medium transition-all"
              />
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-munna-ai-chat'))}
                title={isEnglish ? 'Ask Store AI' : 'AI ସହାୟକ'}
                className="absolute right-8 top-1/2 -translate-y-1/2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-1.5 py-0.5 rounded-full text-[9px] font-black flex items-center gap-0.5 cursor-pointer transition-colors"
              >
                <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                <span>AI</span>
              </button>
              <button
                onClick={() => setShowScanner(true, 'customer')}
                title="Scan Barcode / QR"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0c2340] p-1 cursor-pointer transition-colors"
              >
                <Barcode className="w-3.5 h-3.5" />
              </button>
              {searchQuery ? (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setIsSuggestionsOpen(false);
                    setActiveSuggestionIndex(-1);
                    if (searchInputRef.current) {
                      searchInputRef.current.focus();
                    }
                  }}
                  className="absolute right-14 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <XCircle className="w-3 h-3" />
                </button>
              ) : null}
            </div>

            {/* Suggestions Dropdown */}
            {isSuggestionsOpen && (
              <SearchSuggestions
                query={searchQuery}
                onSelect={handleSelectSuggestion}
                catalog={catalog}
                activeIndex={activeSuggestionIndex}
                onClose={() => setIsSuggestionsOpen(false)}
              />
            )}
          </div>

          {/* Cart Bag Icon with Live Badge */}
          <button
            onClick={() => {
              window.location.hash = 'cart';
              setActiveScreen('cart');
            }}
            className="relative w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-95 shadow-xs"
            title="View Cart"
            aria-label="View Shopping Cart"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-white" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-[#ffd43b] text-[#0c2340] text-[8px] font-black flex items-center justify-center border border-[#0c2340] shadow-xs">
                {totalCartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
};
