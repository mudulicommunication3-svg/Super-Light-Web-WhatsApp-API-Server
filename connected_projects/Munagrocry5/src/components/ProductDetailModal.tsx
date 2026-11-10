import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import {
  ChevronLeft,
  ChevronRight,
  Share2,
  Heart,
  Star,
  Plus,
  Minus,
  Zap,
  Check,
  ShieldCheck,
  RotateCcw,
  Maximize2,
  Play,
  X,
  Copy,
  Search,
  BadgePercent,
  Store,
  LayoutGrid,
  ShoppingBag
} from 'lucide-react';
import { Product, parseProductStock } from '../types';
import { recordPageView, parseGalleryImages } from '../services/api';
import { handleProductImageError, resolveProductImage } from '../utils/imageHelper';
import { handleShareProduct as triggerNativeShare } from '../utils/shareHelper';
import { getPrimaryCleanEan } from '../utils/shareUtils';
import { getVideoEmbedInfo, extractOrGenerateProductDescription, doesProductMatchEan } from '../utils/productMediaHelper';
import { ProductVideoModal } from './ProductVideoModal';

interface ProductDetailContentProps {
  product: Product;
}

const extractPackUnit = (name: string, fallbackUnit?: string): string => {
  if (fallbackUnit && String(fallbackUnit).trim()) return String(fallbackUnit).trim();
  const match = String(name || '').match(
    /(\d+(?:\.\d+)?\s*(?:kg|g|gm|gms|ml|l|ltr|litre|pc|pcs|pack|packet|sachet|box|bottle|pouch|roll|pair|set|tablet|tab|cap)s?)\b/i
  );
  return match ? match[1] : '1 Pack';
};

const extractBrandKeyword = (name: string): string => {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  return words[0] || 'Store';
};

const ProductDetailContent: React.FC<ProductDetailContentProps> = ({ product: initialProduct }) => {
  const {
    setSelectedProduct,
    catalog,
    setQty,
    cart,
    setActiveScreen,
    setActiveCategory,
    toggleWishlist,
    isWishlisted,
    shopConfig
  } = useApp();
  const { t, isEnglish } = useLanguage();

  const cleanInitialName = String(initialProduct.product_name || '').toLowerCase().trim();

  // Always bind to latest live catalog data (so Google Sheet price/stock updates render immediately)
  const selectedProduct =
    catalog.find((p) => {
      const pName = String(p.product_name || '').toLowerCase().trim();
      return doesProductMatchEan(p, initialProduct.ean) || (cleanInitialName && pName === cleanInitialName);
    }) || initialProduct;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const similarSectionRef = useRef<HTMLDivElement>(null);
  const lightboxScrollRef = useRef<HTMLDivElement>(null);
  const heroTouchStartX = useRef<number | null>(null);
  const lightboxTouchStartX = useRef<number | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedGalleryImg, setSelectedGalleryImg] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isFullPhotoOpen, setIsFullPhotoOpen] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [activeDescTab, setActiveDescTab] = useState<'description' | 'specs'>('description');
  const [isDescCopied, setIsDescCopied] = useState(false);

  const videoInfo = useMemo(() => getVideoEmbedInfo(selectedProduct.video_url), [selectedProduct.video_url]);

  const richDescription = useMemo(() => {
    const raw = (selectedProduct.description || '').trim();
    if (raw && raw.toLowerCase() !== (selectedProduct.product_name || '').trim().toLowerCase()) {
      return raw;
    }
    return extractOrGenerateProductDescription(
      {
        name: selectedProduct.product_name,
        category: selectedProduct.category,
        mrp: selectedProduct.mrp,
        sp: selectedProduct.selling_price,
        ean: selectedProduct.ean,
        description: selectedProduct.description
      },
      selectedProduct.category
    );
  }, [selectedProduct]);

  const galleryImages = useMemo(() => {
    const list: string[] = [];
    if (Array.isArray(selectedProduct.gallery_images) && selectedProduct.gallery_images.length > 0) {
      list.push(...selectedProduct.gallery_images);
    } else if (selectedProduct.additional_images) {
      list.push(...parseGalleryImages(selectedProduct.additional_images));
    }
    const mainImg = resolveProductImage(selectedProduct);
    if (mainImg && !list.includes(mainImg)) {
      list.unshift(mainImg);
    }
    return Array.from(new Set(list.filter(Boolean)));
  }, [selectedProduct]);

  const goToPhoto = (idx: number) => {
    if (galleryImages.length === 0) return;
    const clamped = Math.max(0, Math.min(galleryImages.length - 1, idx));
    setActivePhotoIndex(clamped);
    setSelectedGalleryImg(galleryImages[clamped]);

    if (lightboxScrollRef.current) {
      const container = lightboxScrollRef.current;
      const targetSlide = container.children[clamped] as HTMLElement;
      if (targetSlide) {
        targetSlide.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  };

  useEffect(() => {
    setSelectedGalleryImg(null);
    setActivePhotoIndex(0);
  }, [selectedProduct.ean]);

  useEffect(() => {
    if (isFullPhotoOpen) {
      setTimeout(() => {
        if (lightboxScrollRef.current) {
          const container = lightboxScrollRef.current;
          const targetSlide = container.children[activePhotoIndex] as HTMLElement;
          if (targetSlide) {
            targetSlide.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
          }
        }
      }, 50);
    }
  }, [isFullPhotoOpen, activePhotoIndex]);

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    if (selectedProduct?.product_name) {
      recordPageView(selectedProduct.product_name);
      try {
        const existing = JSON.parse(localStorage.getItem('munna_user_search_counts_v1') || '{}');
        const key = String(selectedProduct.product_name).trim().toLowerCase();
        if (key) {
          existing[key] = (Number(existing[key]) || 0) + 1;
          localStorage.setItem('munna_user_search_counts_v1', JSON.stringify(existing));
        }
      } catch {}
    }
  }, [selectedProduct.ean, selectedProduct.product_name]);

  const currentCartQty = cart[selectedProduct.ean] || 0;
  const wishlisted = isWishlisted(selectedProduct.ean);

  const mrp = typeof selectedProduct.mrp === 'number' ? selectedProduct.mrp : parseFloat(selectedProduct.mrp || '0');
  const sp =
    typeof selectedProduct.selling_price === 'number'
      ? selectedProduct.selling_price
      : parseFloat(selectedProduct.selling_price || '0');
  const stock = parseProductStock(selectedProduct.stock_qty);
  const discount = mrp > sp ? Math.round(((mrp - sp) / mrp) * 100) : 0;
  const savings = mrp > sp ? mrp - sp : 0;
  const packUnit = extractPackUnit(selectedProduct.product_name);
  const brandName = extractBrandKeyword(selectedProduct.product_name);

  // Live Delivery Timing from Google Sheet
  const liveDeliveryTiming = useMemo(() => {
    const slot = String(shopConfig?.deliverySlot || '').trim();
    const day = String(shopConfig?.deliveryDay || '').trim();
    if (slot) return slot;
    if (day) return day;
    return '15 mins';
  }, [shopConfig?.deliverySlot, shopConfig?.deliveryDay]);

  // Cart items & total count for the floating "View cart" pill bar
  const { totalCartItems, cartPreviewProducts } = useMemo(() => {
    let count = 0;
    const previews: Product[] = [];
    Object.entries(cart).forEach(([ean, q]) => {
      const qtyNum = Number(q) || 0;
      if (qtyNum > 0) {
        count += qtyNum;
        if (previews.length < 3) {
          const found = catalog.find((p) => String(p.ean) === String(ean));
          if (found) previews.push(found);
        }
      }
    });
    return { totalCartItems: count, cartPreviewProducts: previews };
  }, [cart, catalog]);

  // Size / Variant / Same Brand or Category options (like "Size" selector in Screenshot 2)
  const sizeVariantOptions = useMemo(() => {
    const firstWord = brandName.toLowerCase();
    const sameBrand = catalog.filter(
      (p) =>
        String(p.ean) !== String(selectedProduct.ean) &&
        parseProductStock(p.stock_qty) > 0 &&
        String(p.product_name || '').toLowerCase().includes(firstWord)
    );
    const sameCat = catalog.filter(
      (p) =>
        String(p.ean) !== String(selectedProduct.ean) &&
        parseProductStock(p.stock_qty) > 0 &&
        (p.category || 'General').trim() === (selectedProduct.category || 'General').trim()
    );

    const combined: Product[] = [selectedProduct];
    const seen = new Set<string>([String(selectedProduct.ean)]);
    [...sameBrand, ...sameCat].forEach((p) => {
      const k = String(p.ean);
      if (!seen.has(k) && combined.length < 6) {
        seen.add(k);
        combined.push(p);
      }
    });
    return combined;
  }, [catalog, selectedProduct, brandName]);

  // Similar products from same category or fallback to catalog
  const displaySimilar = useMemo(() => {
    const sameCategoryProducts = catalog.filter(
      (p) =>
        (p.category || 'General').trim() === (selectedProduct.category || 'General').trim() &&
        String(p.ean) !== String(selectedProduct.ean)
    );
    const rawSimilar =
      sameCategoryProducts.length > 0
        ? sameCategoryProducts
        : catalog.filter((p) => String(p.ean) !== String(selectedProduct.ean));

    return [...rawSimilar]
      .sort((a, b) => {
        const sA = parseProductStock(a.stock_qty) <= 0 ? 1 : 0;
        const sB = parseProductStock(b.stock_qty) <= 0 ? 1 : 0;
        return sA - sB;
      })
      .slice(0, 12);
  }, [catalog, selectedProduct]);

  const handleShareProduct = async (e?: React.MouseEvent) => {
    await triggerNativeShare(selectedProduct, e);
  };

  const handleToggleWishlist = () => {
    toggleWishlist(selectedProduct.ean);
    setToastMessage(wishlisted ? t('removedFromWishlist') : t('addedToWishlist'));
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleAddToCart = () => {
    if (stock <= 0) return;
    setQty(selectedProduct.ean, 1);
  };

  const handleOpenSearch = () => {
    setSelectedProduct(null);
    setActiveScreen('home');
    setTimeout(() => {
      const input = document.getElementById('searchInput') as HTMLInputElement | null;
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleGoToCart = () => {
    setSelectedProduct(null);
    setActiveScreen('cart');
  };

  return (
    <div
      id="productDetailScreen"
      className="fixed inset-0 z-[50] bg-[#f4f6f8] flex flex-col overflow-hidden"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[80] bg-slate-900/95 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl flex items-center gap-2 animate-fadeIn pointer-events-none">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MAIN SCROLLABLE CONTENT */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto pb-56"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-md mx-auto bg-white">
          {/* 1. HERO IMAGE STAGE WITH FLOATING ACTION BAR (Matches Screenshot 2) */}
          <div className="relative bg-white pt-3 pb-4 px-4 select-none">
            {/* Floating Top Header Buttons: < Back on Left | Heart, Search, Share on Right */}
            <div className="flex items-center justify-between z-20 relative">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-800 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
                aria-label="Back"
              >
                <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleToggleWishlist}
                  className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-800 hover:bg-slate-50 active:scale-90 transition-all cursor-pointer"
                  title={wishlisted ? t('removedFromWishlist') : t('addedToWishlist')}
                  aria-label="Wishlist toggle"
                >
                  <Heart
                    className={`w-5 h-5 transition-colors ${
                      wishlisted ? 'fill-rose-500 text-rose-500' : 'text-slate-700'
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={handleOpenSearch}
                  className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-800 hover:bg-slate-50 active:scale-90 transition-all cursor-pointer"
                  title="Search products"
                  aria-label="Search products"
                >
                  <Search className="w-5 h-5 text-slate-700" />
                </button>

                <button
                  type="button"
                  onClick={handleShareProduct}
                  className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-800 hover:bg-slate-50 active:scale-90 transition-all cursor-pointer"
                  title={t('share')}
                  aria-label="Share product"
                >
                  <Share2 className="w-4.5 h-4.5 text-slate-700" />
                </button>
              </div>
            </div>

            {/* Center Product Image with Swipe & Fullscreen Zoom */}
            <div
              onTouchStart={(e) => {
                heroTouchStartX.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                if (heroTouchStartX.current === null) return;
                const diff = heroTouchStartX.current - e.changedTouches[0].clientX;
                heroTouchStartX.current = null;
                if (Math.abs(diff) > 40) {
                  if (diff > 0) {
                    goToPhoto(activePhotoIndex + 1);
                  } else {
                    goToPhoto(activePhotoIndex - 1);
                  }
                }
              }}
              className="w-full flex flex-col items-center justify-center pt-2 pb-1 relative group"
            >
              {/* Left/Right Gallery Arrows if multiple photos */}
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goToPhoto(activePhotoIndex - 1);
                    }}
                    disabled={activePhotoIndex === 0}
                    className={`absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-slate-900/50 text-white flex items-center justify-center shadow-md cursor-pointer ${
                      activePhotoIndex === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goToPhoto(activePhotoIndex + 1);
                    }}
                    disabled={activePhotoIndex === galleryImages.length - 1}
                    className={`absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-slate-900/50 text-white flex items-center justify-center shadow-md cursor-pointer ${
                      activePhotoIndex === galleryImages.length - 1
                        ? 'opacity-20 cursor-not-allowed'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Main Hero Image */}
              <div
                onClick={() => setIsFullPhotoOpen(true)}
                className="w-full h-64 sm:h-72 flex items-center justify-center cursor-zoom-in relative"
                title="Tap to view full screen photo"
              >
                <img
                  id="pdImage"
                  src={galleryImages[activePhotoIndex] || selectedGalleryImg || resolveProductImage(selectedProduct)}
                  alt={selectedProduct.product_name}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  className="max-h-64 sm:max-h-72 max-w-[82%] object-contain transition-transform duration-300 group-hover:scale-105"
                  onError={(e) =>
                    handleProductImageError(e, selectedGalleryImg || selectedProduct.backup_image_url, selectedProduct.ean)
                  }
                />

                {/* Pack Size Badge on Bottom-Right (like 860ml in Screenshot 2) */}
                <div className="absolute bottom-0 right-1 bg-slate-950 text-white px-2.5 py-1.5 rounded-tl-2xl rounded-br-lg shadow-sm flex flex-col items-center justify-center">
                  <span className="text-[12px] font-black tracking-tight leading-none">{packUnit}</span>
                </div>

                {/* Zoom Full Photo Pill on Bottom-Left */}
                <span className="absolute bottom-1 left-1 bg-slate-900/65 text-white text-[9.5px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-2.5 h-2.5" />
                  <span>Full Photo</span>
                </span>
              </div>

              {/* Pagination Dots */}
              <div className="flex items-center gap-1.5 mt-2">
                {(galleryImages.length > 1 ? galleryImages : [resolveProductImage(selectedProduct)]).map((_, i) => (
                  <button
                    key={`hero-dot-${i}`}
                    type="button"
                    onClick={() => goToPhoto(i)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      i === activePhotoIndex ? 'w-3.5 bg-[#0c6b95]' : 'w-1.5 bg-slate-300'
                    }`}
                    aria-label={`Photo ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Thumbnail strip if multiple gallery photos */}
            {galleryImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1 no-scrollbar">
                {galleryImages.map((img, idx) => (
                  <button
                    key={`pd-thumb-${idx}`}
                    type="button"
                    onClick={() => goToPhoto(idx)}
                    className={`w-12 h-12 rounded-xl border p-1 shrink-0 transition-all cursor-pointer ${
                      activePhotoIndex === idx
                        ? 'border-2 border-[#0c6b95] bg-sky-50/30'
                        : 'border-slate-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img}
                      alt=""
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain"
                      onError={(e) => handleProductImageError(e, img, selectedProduct.ean)}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* WATCH VIDEO BANNER IF AVAILABLE */}
          {videoInfo && (
            <div className="px-4 pb-2">
              <button
                type="button"
                onClick={() => setShowVideoModal(true)}
                className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white rounded-2xl p-2.5 shadow-sm flex items-center justify-between gap-3 cursor-pointer active:scale-98 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white text-red-600 flex items-center justify-center font-black shadow-2xs shrink-0">
                    <Play className="w-4 h-4 fill-red-600 text-red-600 ml-0.5" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-black block text-white">
                      {isEnglish ? 'Watch Product Video Demo' : 'ଉତ୍ପାଦ ଭିଡିଓ ଦେଖନ୍ତୁ'}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-black px-2.5 py-1 bg-white/20 rounded-xl text-white">Play ▶</span>
              </button>
            </div>
          )}

          {/* 2. PRODUCT INFO & SIZE / VARIANT SELECTOR (Matches Screenshot 2) */}
          <div className="px-4 pt-2 pb-4 border-t border-slate-100 space-y-2">
            {/* Delivery in X mins | Star Rating */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[13px] font-extrabold text-slate-900">
                Delivery in {liveDeliveryTiming}
              </span>
              <span className="text-slate-300">|</span>
              <div id="pdRating" className="inline-flex items-center gap-1">
                <div className="flex items-center gap-0.5">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <Star className="w-3.5 h-3.5 fill-amber-400/40 text-amber-400" />
                </div>
                <span className="text-xs font-semibold text-slate-500 ml-0.5">4.8 (120+)</span>
              </div>
              <span id="pdCategory" className="hidden">
                {selectedProduct.category || 'General'}
              </span>
            </div>

            {/* Product Name */}
            <h1 id="pdTitle" className="text-[17px] sm:text-[18px] font-bold text-slate-900 leading-snug">
              {selectedProduct.product_name}
            </h1>

            {/* Pack Size / Unit Line */}
            <p className="text-xs font-medium text-slate-500">{packUnit}</p>

            {/* Price Line: ₹SP  ₹MRP  XX% OFF */}
            <div className="flex items-baseline gap-2 pt-0.5 flex-wrap">
              <span id="pdPrice" className="text-[20px] font-black text-slate-900">
                ₹{sp}
              </span>
              {mrp > sp && (
                <span id="pdMrp" className="text-sm text-slate-400 line-through font-semibold">
                  ₹{mrp}
                </span>
              )}
              {discount > 0 && (
                <span id="pdOffBadge" className="text-sm font-extrabold text-[#008b47]">
                  {discount}% OFF
                </span>
              )}
              {savings > 0 && (
                <span
                  id="pdSavings"
                  className="text-[11px] font-bold text-[#008b47] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70"
                >
                  Save ₹{savings}
                </span>
              )}
            </div>

            {/* Live Stock & Order Limit Pills */}
            <div id="pdStock" className="flex items-center gap-2 flex-wrap pt-1">
              {stock <= 0 ? (
                <span className="text-[11px] font-extrabold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                  Out of Stock
                </span>
              ) : stock <= 5 ? (
                <span className="text-[11px] font-extrabold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                  Only {stock} left in stock
                </span>
              ) : (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200/60">
                  In Stock ({stock} pcs)
                </span>
              )}
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                Max: {selectedProduct.max_order_qty || 10} pcs/order
              </span>
              <span className="text-[10px] font-mono text-slate-400 ml-auto">
                EAN: {getPrimaryCleanEan(selectedProduct)}
              </span>
            </div>

            {/* Size / Options Selector (Matches "Size" strip in Screenshot 2) */}
            {sizeVariantOptions.length > 1 && (
              <div className="pt-3">
                <p className="text-[13px] font-bold text-slate-700 mb-2.5">Size / Options</p>
                <div className="flex items-start gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                  {sizeVariantOptions.map((item) => {
                    const isCurrent = String(item.ean) === String(selectedProduct.ean);
                    const itemUnit = extractPackUnit(item.product_name);
                    const itemSp =
                      typeof item.selling_price === 'number'
                        ? item.selling_price
                        : parseFloat(item.selling_price || '0');
                    return (
                      <button
                        key={`variant-${item.ean}`}
                        type="button"
                        onClick={() => {
                          setSelectedProduct(item);
                          scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex flex-col items-center shrink-0 w-[68px] group cursor-pointer"
                      >
                        <div
                          className={`w-[64px] h-[64px] rounded-2xl p-1.5 flex items-center justify-center bg-white transition-all relative ${
                            isCurrent
                              ? 'border-2 border-[#0c6b95] shadow-xs bg-sky-50/20'
                              : 'border border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <img
                            src={resolveProductImage(item)}
                            alt={item.product_name}
                            referrerPolicy="no-referrer"
                            crossOrigin="anonymous"
                            className="w-full h-full object-contain"
                            onError={(e) => handleProductImageError(e, item.backup_image_url, item.ean)}
                          />
                        </div>
                        <span
                          className={`text-[11px] mt-1.5 leading-tight truncate w-full text-center ${
                            isCurrent ? 'font-extrabold text-[#0c6b95]' : 'font-medium text-slate-500'
                          }`}
                        >
                          {itemUnit !== '1 Pack' ? itemUnit : `₹${itemSp}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3. PROMOTIONS, BRAND & EXPLORE ROWS (Matches Screenshot 2) */}
          <div className="border-t border-slate-100 divide-y divide-slate-100">
            {/* Row 1: Promotions & Coupons */}
            <div
              onClick={handleGoToCart}
              className="px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                  <BadgePercent className="w-5 h-5 text-[#008b47]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-900 leading-tight">Promotions & Coupons</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {shopConfig?.couponCode
                      ? `Use code ${shopConfig.couponCode} • Free delivery above ₹${shopConfig?.freeAbove || 199}`
                      : `Shop for Rs.${shopConfig?.freeAbove || 199} & above and get free delivery`}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </div>

            {/* Row 2: Brand / Category Store */}
            <div
              onClick={() => {
                if (selectedProduct.category) {
                  setActiveCategory(selectedProduct.category);
                }
                setSelectedProduct(null);
                setActiveScreen('home');
              }}
              className="px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5 text-slate-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-900 leading-tight">
                    {selectedProduct.category || brandName}
                  </p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">Explore all products</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </div>

            {/* Row 3: Explore Similar Items */}
            <div
              onClick={() => {
                similarSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <LayoutGrid className="w-5 h-5 text-slate-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-900 leading-tight">
                    Explore {selectedProduct.category || 'Similar Products'}
                  </p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    Compare prices & quick add to cart
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
          </div>
        </div>

        {/* 4. SIMILAR PRODUCTS HORIZONTAL STRIP */}
        <div className="max-w-md mx-auto mt-2.5 space-y-2.5 px-3">
          {displaySimilar.length > 0 && (
            <div ref={similarSectionRef} className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-2xs">
              <h4 className="text-[14px] font-extrabold text-slate-900 mb-3 flex items-center justify-between">
                <span>{t('similarProductsHeading')}</span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {displaySimilar.length} {t('items')}
                </span>
              </h4>
              <div id="pdSimilarRow" className="flex overflow-x-auto gap-2.5 py-1 no-scrollbar">
                {displaySimilar.map((p, idx) => {
                  const sQty = cart[p.ean] || 0;
                  const pMrp = typeof p.mrp === 'number' ? p.mrp : parseFloat(p.mrp || '0');
                  const pSp =
                    typeof p.selling_price === 'number' ? p.selling_price : parseFloat(p.selling_price || '0');
                  const pDiscount = pMrp > pSp ? Math.round(((pMrp - pSp) / pMrp) * 100) : 0;
                  const pStock = parseProductStock(p.stock_qty);

                  return (
                    <div
                      key={`related-${p.ean}-${p.rowIndex ?? ''}-${idx}`}
                      className="w-32 shrink-0 bg-white rounded-2xl p-2.5 border border-slate-100 shadow-2xs flex flex-col justify-between relative group"
                    >
                      <div
                        onClick={() => {
                          setSelectedProduct(p);
                          scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full h-22 rounded-xl bg-[#f4f7fb] flex items-center justify-center p-1.5 cursor-pointer relative"
                      >
                        {pDiscount > 0 && (
                          <span className="absolute top-1 left-1 bg-[#008b47] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md">
                            {pDiscount}% off
                          </span>
                        )}
                        <img
                          src={resolveProductImage(p)}
                          alt={p.product_name}
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          className="w-full h-full object-contain mix-blend-multiply"
                          loading="lazy"
                          onError={(e) => handleProductImageError(e, p.backup_image_url, p.ean)}
                        />
                      </div>

                      <div
                        onClick={() => {
                          setSelectedProduct(p);
                          scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="mt-2 cursor-pointer flex-1 flex flex-col justify-between"
                      >
                        <p className="text-[11px] font-bold text-slate-800 line-clamp-2 leading-tight">
                          {p.product_name}
                        </p>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-xs font-black text-slate-900">₹{pSp}</span>
                          {pMrp > pSp && (
                            <span className="text-[10px] text-slate-400 line-through">₹{pMrp}</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2">
                        {sQty > 0 ? (
                          <div className="flex items-center justify-between bg-[#0c6b95] text-white rounded-full h-7 px-2 shadow-2xs font-bold">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQty(p.ean, sQty - 1);
                              }}
                              className="w-5 h-5 rounded-full flex items-center justify-center active:scale-90 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-[11px] font-extrabold px-1">{sQty}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQty(p.ean, Math.min(pStock, sQty + 1));
                              }}
                              className="w-5 h-5 rounded-full flex items-center justify-center active:scale-90 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQty(p.ean, 1);
                            }}
                            disabled={pStock <= 0}
                            className="w-full h-7 rounded-full border border-slate-300 bg-white text-[#0c6b95] hover:bg-sky-50 text-[11px] font-extrabold flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            ADD
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. PRODUCT DESCRIPTION & SPECIFICATIONS CARD */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveDescTab('description')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                    activeDescTab === 'description'
                      ? 'bg-[#0c6b95] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isEnglish ? 'Product Information' : 'ପ୍ରୋଡକ୍ଟ ବିବରଣୀ'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDescTab('specs')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                    activeDescTab === 'specs'
                      ? 'bg-[#0c6b95] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isEnglish ? 'Specifications' : 'ସବିଶେଷ ତଥ୍ୟ'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  try {
                    navigator.clipboard?.writeText(richDescription);
                    setIsDescCopied(true);
                    setTimeout(() => setIsDescCopied(false), 2000);
                  } catch {}
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[10.5px] font-bold text-slate-600 flex items-center gap-1 cursor-pointer"
              >
                {isDescCopied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {activeDescTab === 'description' ? (
              <div id="pdDesc" className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                {richDescription}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-1.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold">Product Name</span>
                  <span className="text-slate-900 font-bold text-right">{selectedProduct.product_name}</span>
                </div>
                <div className="py-1.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold">Pack / Unit</span>
                  <span className="text-slate-900 font-bold">{packUnit}</span>
                </div>
                <div className="py-1.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold">Category</span>
                  <span className="text-[#0c6b95] bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full font-extrabold text-[11px]">
                    {selectedProduct.category || 'Grocery'}
                  </span>
                </div>
                <div className="py-1.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold">Price / MRP</span>
                  <span className="text-slate-900 font-black">
                    ₹{sp} <span className="text-slate-400 line-through font-normal text-[11px]">₹{mrp}</span>
                  </span>
                </div>
                {selectedProduct.ean && (
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-semibold">EAN / Barcode</span>
                    <span className="text-slate-700 font-mono text-[11px]">{selectedProduct.ean}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 6. STORE DELIVERY & QUALITY HIGHLIGHTS */}
          <div className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-2xs divide-y divide-slate-100">
            <div className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 rounded-full bg-amber-100/80 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 fill-amber-500 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-xs text-slate-900 leading-tight">
                  Delivery in {liveDeliveryTiming}
                </p>
                <p className="text-[10px] text-slate-500 font-medium truncate">
                  Superfast delivery to your doorstep in Niali
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100/80 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-xs text-slate-900 leading-tight">{t('genuineGuarantee')}</p>
                <p className="text-[10px] text-slate-500 font-medium truncate">
                  Directly sourced authentic quality products
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 rounded-full bg-blue-100/80 flex items-center justify-center shrink-0">
                <RotateCcw className="w-4 h-4 text-[#0c6b95]" />
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-xs text-slate-900 leading-tight">{t('storeSupport')}</p>
                <p className="text-[10px] text-slate-500 font-medium truncate">
                  Direct counter pickup & instant help
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. FLOATING "View cart" PILL BUTTON ABOVE BOTTOM BAR (Matches Screenshot 2) */}
      {totalCartItems > 0 && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[65] pointer-events-auto"
          style={{
            bottom: 'calc(8.85rem + env(safe-area-inset-bottom, 0px))'
          }}
        >
          <button
            type="button"
            onClick={handleGoToCart}
            className="bg-[#0c6b95] hover:bg-[#09597d] text-white rounded-full pl-2.5 pr-2 py-1.5 shadow-[0_8px_24px_rgba(12,107,149,0.45)] border border-white/20 flex items-center gap-3 active:scale-95 transition-all cursor-pointer"
          >
            {/* Overlapping Product Thumbnails in Cart */}
            {cartPreviewProducts.length > 0 ? (
              <div className="flex items-center pl-0.5">
                {cartPreviewProducts.map((cp, idx) => (
                  <div
                    key={`cart-pill-thumb-${cp.ean}-${idx}`}
                    className="w-9 h-9 rounded-full bg-white border-2 border-[#0c6b95] p-0.5 flex items-center justify-center overflow-hidden shadow-xs"
                    style={{ marginLeft: idx === 0 ? 0 : -10, zIndex: 10 - idx }}
                  >
                    <img
                      src={resolveProductImage(cp)}
                      alt=""
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain"
                      onError={(e) => handleProductImageError(e, cp.backup_image_url, cp.ean)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
                <ShoppingBag className="w-4.5 h-4.5 text-white" />
              </div>
            )}

            {/* View cart + X items */}
            <div className="text-left pr-1">
              <span className="text-[14px] font-extrabold text-white leading-tight block">View cart</span>
              <span className="text-[11px] font-medium text-sky-100 leading-tight block">
                {totalCartItems} {totalCartItems === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Right White Circle Chevron */}
            <div className="w-9 h-9 rounded-full bg-white text-[#0c6b95] flex items-center justify-center shadow-xs shrink-0">
              <ChevronRight className="w-5 h-5 stroke-[2.5]" />
            </div>
          </button>
        </div>
      )}

      {/* 8. FIXED STICKY BOTTOM BAR (Unit + Price + Inclusive of all taxes on Left | Stepper / Add to Cart Pill on Right) */}
      <div
        className="fixed left-0 right-0 z-[60] bg-white border-t border-slate-200 px-4 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
        style={{
          bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))'
        }}
      >
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          {/* Left: Pack Unit + Selling Price + MRP + % off + Inclusive of all taxes */}
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-700 leading-tight truncate">{packUnit}</p>
            <div className="flex items-baseline gap-1.5 flex-wrap mt-0.5">
              <span className="text-[18px] font-black text-slate-900 leading-none">₹{sp}</span>
              {mrp > sp && (
                <span className="text-xs text-slate-400 line-through font-semibold leading-none">₹{mrp}</span>
              )}
              {discount > 0 && (
                <span className="text-xs font-extrabold text-[#008b47] leading-none">{discount}% off</span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Inclusive of all taxes</p>
          </div>

          {/* Right: Add to Cart or Quantity Stepper Pill */}
          <div id="pdStepperWrap" className="shrink-0">
            {stock <= 0 ? (
              <div className="h-11 px-6 rounded-full bg-rose-50 border border-rose-200 text-rose-600 font-extrabold text-xs flex items-center justify-center">
                Out of Stock
              </div>
            ) : currentCartQty === 0 ? (
              <>
                <button
                  id="pdAddCartBtn"
                  type="button"
                  onClick={handleAddToCart}
                  className="h-12 min-w-[152px] px-7 rounded-full bg-[#0c6b95] hover:bg-[#09597d] text-white font-extrabold text-[15px] flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <span>Add to Cart</span>
                </button>
                <span id="pdQty" className="hidden">
                  0
                </span>
              </>
            ) : (
              <div className="h-12 min-w-[152px] rounded-full bg-[#0c6b95] text-white px-3.5 flex items-center justify-between shadow-md">
                <button
                  type="button"
                  onClick={() => setQty(selectedProduct.ean, Math.max(0, currentCartQty - 1))}
                  className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4.5 h-4.5 stroke-[2.5]" />
                </button>
                <span id="pdQty" className="font-extrabold text-[17px] px-3 text-center">
                  {currentCartQty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(selectedProduct.ean, Math.min(stock, currentCartQty + 1))}
                  className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
                </button>
                <button id="pdAddCartBtn" className="hidden" onClick={handleAddToCart} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FULL PHOTO HIGH-RES ZOOM LIGHTBOX MODAL */}
      {isFullPhotoOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-200 select-none"
            style={{ touchAction: 'pan-x pan-y' }}
          >
            {/* Lightbox Top Bar */}
            <div className="w-full flex items-center justify-between text-white px-4 py-3 bg-gradient-to-b from-black/90 to-transparent z-20 shrink-0">
              <div className="min-w-0 flex-1 pr-3">
                <h3 className="text-xs sm:text-sm font-bold text-slate-200 truncate">
                  {selectedProduct.product_name}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Photo {activePhotoIndex + 1} of {galleryImages.length}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono font-black bg-white/20 text-white px-2 py-0.5 rounded-full">
                  {activePhotoIndex + 1} / {galleryImages.length}
                </span>
                <button
                  type="button"
                  onClick={() => setIsFullPhotoOpen(false)}
                  className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors active:scale-95"
                  title="Close full photo"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Large Side-by-Side Horizontal Scroll / Swipe Stage */}
            <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden min-h-0">
              {galleryImages.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPhoto(activePhotoIndex - 1);
                  }}
                  disabled={activePhotoIndex === 0}
                  className={`absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center shadow-lg cursor-pointer border border-white/20 ${
                    activePhotoIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'opacity-90'
                  }`}
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              {galleryImages.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPhoto(activePhotoIndex + 1);
                  }}
                  disabled={activePhotoIndex === galleryImages.length - 1}
                  className={`absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center shadow-lg cursor-pointer border border-white/20 ${
                    activePhotoIndex === galleryImages.length - 1 ? 'opacity-30 cursor-not-allowed' : 'opacity-90'
                  }`}
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}

              <div
                ref={lightboxScrollRef}
                onScroll={() => {
                  if (!lightboxScrollRef.current) return;
                  const container = lightboxScrollRef.current;
                  const scrollLeft = container.scrollLeft;
                  const width = container.clientWidth;
                  if (width > 0) {
                    const newIdx = Math.round(scrollLeft / width);
                    if (newIdx !== activePhotoIndex && newIdx >= 0 && newIdx < galleryImages.length) {
                      setActivePhotoIndex(newIdx);
                      setSelectedGalleryImg(galleryImages[newIdx]);
                    }
                  }
                }}
                onTouchStart={(e) => {
                  lightboxTouchStartX.current = e.touches[0].clientX;
                }}
                onTouchEnd={(e) => {
                  if (lightboxTouchStartX.current === null) return;
                  const diff = lightboxTouchStartX.current - e.changedTouches[0].clientX;
                  lightboxTouchStartX.current = null;
                  if (Math.abs(diff) > 40) {
                    if (diff > 0) {
                      goToPhoto(activePhotoIndex + 1);
                    } else {
                      goToPhoto(activePhotoIndex - 1);
                    }
                  }
                }}
                className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
              >
                {galleryImages.map((img, idx) => (
                  <div
                    key={`lightbox-slide-${idx}`}
                    className="w-full h-full shrink-0 flex items-center justify-center p-3 sm:p-6 snap-center select-none"
                    onClick={() => setIsFullPhotoOpen(false)}
                  >
                    <img
                      src={img}
                      alt={`${selectedProduct.product_name} photo ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      className="max-w-full max-h-[66vh] sm:max-h-[75vh] object-contain drop-shadow-2xl rounded-2xl select-none"
                      onClick={(e) => e.stopPropagation()}
                      onError={(e) => handleProductImageError(e, selectedProduct.backup_image_url, selectedProduct.ean)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Thumbnail Strip */}
            <div
              className="w-full bg-gradient-to-t from-black via-black/95 to-transparent pt-3 z-30 shrink-0"
              style={{
                paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 16px))'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-w-xl mx-auto px-4">
                <div className="flex items-center gap-2.5 overflow-x-auto py-1 px-0.5 no-scrollbar">
                  {galleryImages.map((img, idx) => {
                    const isActive = activePhotoIndex === idx;
                    return (
                      <button
                        key={`lb-thumb-bar-${idx}`}
                        type="button"
                        onClick={() => goToPhoto(idx)}
                        className={`relative w-14 h-14 rounded-xl bg-white/10 p-1 shrink-0 overflow-hidden border-2 transition-all cursor-pointer ${
                          isActive
                            ? 'border-emerald-400 ring-2 ring-emerald-400 scale-105 bg-white/20'
                            : 'border-white/20 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-contain" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* PRODUCT VIDEO MODAL */}
      {showVideoModal && (
        <ProductVideoModal product={selectedProduct} onClose={() => setShowVideoModal(false)} />
      )}
    </div>
  );
};

export const ProductDetailModal: React.FC = () => {
  const { selectedProduct } = useApp();

  if (!selectedProduct) return null;

  return <ProductDetailContent key={selectedProduct.ean} product={selectedProduct} />;
};
