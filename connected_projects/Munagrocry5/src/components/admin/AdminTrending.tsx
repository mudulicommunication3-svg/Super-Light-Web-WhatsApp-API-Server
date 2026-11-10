import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Product, normalizeTrending } from '../../types';
import {
  Star,
  Search,
  Flame,
  Check,
  X,
  Plus,
  Trash2,
  Package,
  Layers,
  Sparkles,
  Save,
  ArrowRight
} from 'lucide-react';
import { pushConfigKeyToSheet } from '../../services/api';
import { showToast } from '../Toast';
import { handleProductImageError, resolveProductImage } from '../../utils/imageHelper';

export const AdminTrending: React.FC = () => {
  const { catalog, shopConfig, updateShopConfig, hasUnsavedAdminChanges, setHasUnsavedAdminChanges } = useApp();
  const { isEnglish } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isSaving, setIsSaving] = useState(false);

  const currentTrendingEans = normalizeTrending(shopConfig.trending);

  const isEanTrending = (ean: string | number) => {
    const raw = String(ean).trim();
    const clean = raw.replace(/^EAN-/, '').trim();
    return currentTrendingEans.some((t) => {
      const cleanT = String(t).replace(/^EAN-/, '').trim();
      return cleanT === clean || String(t).trim() === raw;
    });
  };

  // Toggle trending for any product (MANUAL SAVE ONLY - strictly retains staged changes in local state)
  const handleToggleTrending = (ean: string, productName?: string) => {
    const raw = String(ean).trim();
    const clean = raw.replace(/^EAN-/, '').trim();
    const isCurrentlyTrending = isEanTrending(ean);

    const nextTrending = isCurrentlyTrending
      ? currentTrendingEans.filter((x) => {
          const cleanX = String(x).replace(/^EAN-/, '').trim();
          return cleanX !== clean && String(x).trim() !== raw;
        })
      : [...currentTrendingEans, clean || raw];

    updateShopConfig({ trending: nextTrending });
    setHasUnsavedAdminChanges(true);

    if (isCurrentlyTrending) {
      showToast(
        isEnglish
          ? `Removed "${productName || raw}" (Staged • Click "Save" to publish)`
          : `"${productName || raw}" ହଟାଗଲା (ଅପଡେଟ୍ କରିବାକୁ "Save" କ୍ଲିକ୍ କରନ୍ତୁ)`
      );
    } else {
      showToast(
        isEnglish
          ? `⭐ Added "${productName || raw}" to Trending (Staged • Click "Save" to publish)`
          : `⭐ "${productName || raw}" ଟ୍ରେଣ୍ଡିଂରେ ଯୋଡ଼ାଗଲା (ଅପଡେଟ୍ କରିବାକୁ "Save" କ୍ଲିକ୍ କରନ୍ତୁ)`
      );
    }
  };

  const handleManualSync = async () => {
    setIsSaving(true);
    try {
      updateShopConfig({ trending: currentTrendingEans });
      const res = await pushConfigKeyToSheet('trending', currentTrendingEans.join(', '));
      if (res) {
        setHasUnsavedAdminChanges(false);
        showToast(
          isEnglish
            ? `Trending products (${currentTrendingEans.length}) synced with Google Sheet! ✅`
            : `ଟ୍ରେଣ୍ଡିଂ ସାମଗ୍ରୀ (${currentTrendingEans.length} ଟି) ଗୁଗୁଲ୍ ସିଟ୍‌ରେ ସେଭ୍ ହେଲା! ✅`
        );
      }
    } catch (e) {
      showToast('Error syncing with Google Sheet');
    } finally {
      setIsSaving(false);
    }
  };

  // Products currently in trending
  const trendingProducts = catalog.filter((p) => isEanTrending(p.ean));

  // Products available to add (matching search)
  const availableProducts = catalog.filter((p) => {
    if (selectedCategory !== 'All' && (p.category || 'General') !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (p.product_name || '').toLowerCase().includes(q);
      const matchEan = String(p.ean).includes(q);
      const matchCat = (p.category || '').toLowerCase().includes(q);
      return matchName || matchEan || matchCat;
    }
    return true;
  });

  const categories = ['All', ...Array.from(new Set(catalog.map((p) => p.category || 'General')))];

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              {isEnglish ? 'Trending Products Setup' : 'ଟ୍ରେଣ୍ଡିଂ ସାମଗ୍ରୀ ସେଟ୍ଅପ୍ (Hot Deals)'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isEnglish
              ? 'Tap the Star on any product to feature it in the customer home screen "Trending Offers" carousel.'
              : 'ଗ୍ରାହକ ହୋମ୍ ସ୍କ୍ରିନ୍‌ରେ ଟ୍ରେଣ୍ଡିଂ ଅଫର୍ ଦେଖାଇବା ପାଇଁ ଯେକୌଣସି ସାମଗ୍ରୀର ଷ୍ଟାର୍ (Star) ବଟନ୍ ଟଗଲ୍ କରନ୍ତୁ।'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-rose-500 fill-rose-500" />
            <span>{trendingProducts.length} Active Deals</span>
          </div>

          <button
            onClick={handleManualSync}
            disabled={isSaving}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'Syncing...' : '💾 Sync Sheet'}</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Active Trending Deals (Quick Management) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-500 fill-rose-500" />
            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
              {isEnglish ? 'Currently Active Trending Items' : 'ବର୍ତ୍ତମାନ ସକ୍ରିୟ ଥିବା ଟ୍ରେଣ୍ଡିଂ ସାମଗ୍ରୀ'}
            </h3>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {trendingProducts.length}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {isEnglish ? 'Click star to remove' : 'ହଟାଇବା ପାଇଁ ଷ୍ଟାର୍ ଦବାନ୍ତୁ'}
          </span>
        </div>

        {trendingProducts.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Star className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">
              {isEnglish ? 'No trending items selected yet' : 'କୌଣସି ସାମଗ୍ରୀ ଟ୍ରେଣ୍ଡିଂରେ ଯୋଡ଼ାଯାଇନାହିଁ'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isEnglish
                ? 'Scroll down and click the Star on any product below to add it to your Trending carousel.'
                : 'ତଳ ତାଲିକାରୁ ଯେକୌଣସି ସାମଗ୍ରୀ ପାଖରେ ଥିବା ଷ୍ଟାର୍ (Star) ବଟନ୍ ଦବାନ୍ତୁ।'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {trendingProducts.map((p, idx) => (
              <div
                key={`adm-trending-${p.ean}-${p.rowIndex ?? ''}-${idx}`}
                className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2.5 hover:bg-amber-50 transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-lg bg-white border border-amber-100 p-1 flex items-center justify-center shrink-0">
                    <img
                      src={resolveProductImage(p)}
                      alt={p.product_name}
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain"
                      onError={(e) => handleProductImageError(e, p.backup_image_url, p.ean)}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-extrabold text-slate-900 truncate">
                      {p.product_name}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs font-black text-emerald-700">
                        Rs. {p.selling_price}
                      </span>
                      {Number(p.mrp) > Number(p.selling_price) && (
                        <span className="text-[10px] text-slate-400 line-through">
                          Rs. {p.mrp}
                        </span>
                      )}
                      <span className="text-[9px] font-bold text-slate-500 bg-white px-1 py-0.2 rounded border border-slate-100">
                        {p.category}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Star Toggle Button */}
                <button
                  onClick={() => handleToggleTrending(p.ean, p.product_name)}
                  className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shadow-xs shrink-0 active:scale-95 transition-all cursor-pointer"
                  title="Remove from trending (ଟ୍ରେଣ୍ଡିଂରୁ ହଟାନ୍ତୁ)"
                >
                  <Star className="w-5 h-5 fill-white text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Catalog Browser with Star Toggles on Each Product */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span>{isEnglish ? 'All Store Products (Tap Star to Toggle)' : 'ସମସ୍ତ ସାମଗ୍ରୀ (ଷ୍ଟାର୍ ଟଗଲ୍ କରନ୍ତୁ)'}</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isEnglish
                  ? 'Gold Star = Featured in Trending Deals · Gray Star = Not Trending'
                  : 'ସୁନେଲୀ ଷ୍ଟାର୍ = ଟ୍ରେଣ୍ଡିଂରେ ଅଛି · ଧୂସର ଷ୍ଟାର୍ = ସାଧାରଣ'}
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              Showing {availableProducts.length} of {catalog.length} products
            </span>
          </div>

          {/* Search Bar & Category Filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products to toggle trending..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-amber-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {categories.slice(0, 6).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    selectedCategory === cat
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Cards List with Visual Star Toggles */}
        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
          {availableProducts.map((p, idx) => {
            const isTrending = isEanTrending(p.ean);

            return (
              <div
                key={`adm-available-${p.ean}-${p.rowIndex ?? ''}-${idx}`}
                className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-colors ${
                  isTrending ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50'
                }`}
              >
                {/* Left: Star Toggle Button */}
                <button
                  type="button"
                  onClick={() => handleToggleTrending(p.ean, p.product_name)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 cursor-pointer active:scale-110 transition-all ${
                    isTrending
                      ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                      : 'bg-slate-100 hover:bg-amber-100 text-slate-400 hover:text-amber-600 border border-slate-200'
                  }`}
                  title={isTrending ? 'Remove from Trending' : 'Add to Trending'}
                >
                  <Star
                    className={`w-5 h-5 transition-transform ${
                      isTrending ? 'fill-white text-white scale-110' : 'hover:scale-110'
                    }`}
                  />
                </button>

                {/* Center: Image & Name */}
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 p-1 flex items-center justify-center shrink-0">
                  <img
                    src={resolveProductImage(p)}
                    alt={p.product_name}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="w-full h-full object-contain"
                    onError={(e) => handleProductImageError(e, p.backup_image_url, p.ean)}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                      {p.product_name}
                    </h4>
                    {isTrending && (
                      <span className="text-[9px] bg-amber-500 text-white font-black px-1.5 py-0.2 rounded shrink-0">
                        ⭐ HOT
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    EAN: {p.ean} · {p.category || 'General'} · Stock: {p.stock_qty}
                  </p>
                </div>

                {/* Right: Price & Status Indicator */}
                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-slate-900 block">
                    Rs. {p.selling_price}
                  </span>
                  <span
                    className={`text-[10px] font-bold ${
                      isTrending ? 'text-amber-700' : 'text-slate-400'
                    }`}
                  >
                    {isTrending ? 'Featured ⭐' : 'Regular'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
