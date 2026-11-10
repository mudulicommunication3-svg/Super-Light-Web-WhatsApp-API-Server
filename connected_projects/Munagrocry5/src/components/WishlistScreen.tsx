import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import {
  ArrowLeft,
  Heart,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Star,
  Sparkles,
  Share2,
  Copy,
  Check,
  Send
} from 'lucide-react';
import { handleProductImageError, resolveProductImage } from '../utils/imageHelper';
import { parseProductStock } from '../types';
import {
  handleShareWishlist,
  copyWishlistToClipboard,
  handleShareProduct
} from '../utils/shareHelper';
import { showToast } from './Toast';

export const WishlistScreen: React.FC = () => {
  const {
    wishlist,
    catalog,
    cart,
    setQty,
    toggleWishlist,
    setSelectedProduct,
    setActiveScreen,
    goBackScreen
  } = useApp();
  const { t, isEnglish } = useLanguage();
  const [copiedAll, setCopiedAll] = useState(false);

  const wishlistedProducts = catalog
    .filter((p) => wishlist.includes(p.ean))
    .sort((a, b) => {
      const sA = parseProductStock(a.stock_qty) <= 0 ? 1 : 0;
      const sB = parseProductStock(b.stock_qty) <= 0 ? 1 : 0;
      return sA - sB;
    });

  const handleShareAllWhatsApp = () => {
    if (wishlistedProducts.length === 0) return;
    handleShareWishlist(wishlistedProducts, isEnglish);
  };

  const handleCopyAll = async () => {
    if (wishlistedProducts.length === 0) return;
    const ok = await copyWishlistToClipboard(wishlistedProducts, isEnglish);
    if (ok) {
      setCopiedAll(true);
      showToast(
        isEnglish
          ? '📋 All wishlist items, images & links copied! Paste anywhere.'
          : '📋 ସମସ୍ତ ୱିସଲିଷ୍ଟ୍ ସାମଗ୍ରୀର ଲିଙ୍କ୍ ଓ ଫଟୋ କପି ହେଲା! WhatsApp ରେ ପଠାନ୍ତୁ।'
      );
      setTimeout(() => setCopiedAll(false), 2500);
    } else {
      showToast('Could not copy to clipboard');
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-[#f1f3f6] overflow-y-auto">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-[#0c2340] text-white px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveScreen('home')}
            className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-sm tracking-tight">
              {t('myWishlist')}
            </h3>
            {wishlistedProducts.length > 0 && (
              <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full">
                {wishlistedProducts.length}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {wishlistedProducts.length > 0 && (
            <button
              onClick={handleShareAllWhatsApp}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
              title="Share All Wishlist Items"
              aria-label="Share All Wishlist Items"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isEnglish ? 'Share All' : 'ସେୟାର୍'}</span>
            </button>
          )}

          <button
            onClick={() => setActiveScreen('cart')}
            className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
            title="View Cart"
            aria-label="View Cart"
          >
            <ShoppingBag className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto p-3.5 pb-28">
        {wishlistedProducts.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center shadow-xs mt-6">
            <div className="w-20 h-20 rounded-full bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Heart className="w-10 h-10 stroke-[1.5]" />
            </div>
            <h4 className="text-base font-extrabold text-slate-800 mb-1">
              {t('emptyWishlist')}
            </h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mb-6 leading-relaxed">
              {t('emptyWishlistDesc')}
            </p>
            <button
              onClick={() => {
                setActiveScreen('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#0c2340] hover:bg-slate-900 text-white text-xs font-black shadow-md active:scale-95 transition-transform cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>{t('exploreProducts')}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 🌟 1-CLICK SHARE ALL WISHLIST PRODUCTS BANNER */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-3.5 rounded-2xl shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Share2 className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-black text-xs sm:text-sm leading-tight text-white">
                      {isEnglish ? 'Share All Wishlist in 1-Click' : '୧-କ୍ଲିକ୍‌ରେ ସମସ୍ତ ୱିସଲିଷ୍ଟ୍ ସେୟାର୍ କରନ୍ତୁ'}
                    </h4>
                    <p className="text-[10px] text-emerald-100 font-medium">
                      {isEnglish
                        ? `Send all ${wishlistedProducts.length} items with photo links, prices & buy links`
                        : `${wishlistedProducts.length} ଟି ସାମଗ୍ରୀର ଫଟୋ, ମୂଲ୍ୟ ଓ ଅର୍ଡର ଲିଙ୍କ୍ ସେୟାର୍ କରନ୍ତୁ`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleShareAllWhatsApp}
                  className="py-2.5 px-3 bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span>{isEnglish ? 'WhatsApp Share All' : 'WhatsApp ରେ ସେୟାର୍'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="py-2.5 px-3 bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs rounded-xl border border-white/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedAll ? <Check className="w-3.5 h-3.5 text-yellow-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAll ? (isEnglish ? 'Copied! ✅' : 'କପି ହେଲା! ✅') : (isEnglish ? 'Copy All Links' : 'ଲିଙ୍କ୍ କପି କରନ୍ତୁ')}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-bold text-slate-600">
                {isEnglish ? 'Items saved for later' : 'ପରେ କିଣିବା ପାଇଁ ସଂରକ୍ଷିତ ସାମଗ୍ରୀ'}
              </p>
              <span className="text-[11px] font-semibold text-slate-400">
                {wishlistedProducts.length} {t('items')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {wishlistedProducts.map((p, idx) => {
                const qty = cart[p.ean] || 0;
                const mrp = typeof p.mrp === 'number' ? p.mrp : parseFloat(p.mrp || '0');
                const sp = typeof p.selling_price === 'number' ? p.selling_price : parseFloat(p.selling_price || '0');
                const stock = parseProductStock(p.stock_qty);
                const discount = mrp > sp ? Math.round(((mrp - sp) / mrp) * 100) : 0;
                const savings = mrp > sp ? mrp - sp : 0;

                return (
                  <div
                    key={`wishlist-${p.ean}-${p.rowIndex ?? ''}-${idx}`}
                    className="bg-white rounded-2xl p-2.5 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col justify-between relative group"
                  >
                    {/* Discount badge */}
                    {discount > 0 && (
                      <div className="absolute top-2 left-2 z-10 bg-emerald-600 text-white text-[9.5px] font-black px-1.5 py-0.5 rounded-md shadow-xs">
                        <span>{discount}% OFF</span>
                      </div>
                    )}

                    {/* Top right buttons: Share & Trash */}
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                      <button
                        onClick={(e) => handleShareProduct(p, e)}
                        className="w-7 h-7 rounded-full bg-white/95 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 shadow-xs border border-slate-100 flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                        title={isEnglish ? 'Share product' : 'ସାମଗ୍ରୀ ସେୟାର୍ କରନ୍ତୁ'}
                        aria-label="Share product"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWishlist(p.ean);
                        }}
                        className="w-7 h-7 rounded-full bg-white/95 hover:bg-rose-50 text-rose-500 shadow-xs border border-slate-100 flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                        title={t('removedFromWishlist')}
                        aria-label="Remove from wishlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Product Image */}
                    <div
                      onClick={() => setSelectedProduct(p)}
                      className="w-full h-32 rounded-xl bg-slate-50/70 flex items-center justify-center overflow-hidden cursor-pointer p-1.5 transition-transform duration-200 group-hover:scale-[1.02]"
                    >
                      <img
                        src={resolveProductImage(p)}
                        alt={p.product_name}
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        className="w-full h-full object-contain mix-blend-multiply"
                        onError={(e) => handleProductImageError(e, p.backup_image_url, p.ean)}
                      />
                    </div>

                    {/* Product Info */}
                    <div
                      onClick={() => setSelectedProduct(p)}
                      className="mt-2 flex-1 flex flex-col justify-between cursor-pointer select-none"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight">
                          {p.product_name}
                        </h4>

                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className="bg-emerald-600 text-white text-[9px] font-black px-1 rounded flex items-center gap-0.5 shadow-xs">
                            4.8 <Star className="w-2 h-2 fill-white text-white" />
                          </span>

                          {stock <= 0 ? (
                            <span className="text-[9px] font-extrabold text-rose-600 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
                              {t('outOfStock')}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">
                              {isEnglish ? `${stock} left` : `ଷ୍ଟକ୍ ${stock}`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 pt-1 border-t border-slate-100">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-black text-slate-900">Rs.{sp}</span>
                          {mrp > sp && (
                            <span className="text-[10px] text-slate-400 line-through font-semibold">
                              Rs.{mrp}
                            </span>
                          )}
                        </div>
                        {savings > 0 && (
                          <span className="inline-block text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-1 rounded mt-0.5">
                            {t('save')} Rs.{savings}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stepper / Add button */}
                    <div className="mt-2">
                      {qty > 0 ? (
                        <div className="flex items-center justify-between bg-emerald-600 text-white rounded-xl p-1 shadow-xs font-extrabold">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setQty(p.ean, qty - 1);
                            }}
                            className="w-6 h-6 rounded-lg bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center text-xs active:scale-90 transition-transform cursor-pointer"
                            title="Decrease quantity"
                          >
                            <Minus className="w-3 h-3 text-white" />
                          </button>
                          <span className="text-xs font-black px-1">{qty}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setQty(p.ean, Math.min(stock, qty + 1));
                            }}
                            className="w-6 h-6 rounded-lg bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center text-xs active:scale-90 transition-transform cursor-pointer"
                            title="Increase quantity"
                          >
                            <Plus className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setQty(p.ean, 1);
                          }}
                          disabled={stock <= 0}
                          className="w-full py-1.5 rounded-xl border border-emerald-600 bg-emerald-50/70 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-black transition-all flex items-center justify-center gap-1 shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                          <span>{t('add')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
