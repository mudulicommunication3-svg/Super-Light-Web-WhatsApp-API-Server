import React, { useState, useMemo, useRef } from 'react';
import { Product, parseProductStock } from '../types';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { Plus, Minus, Heart, Share2, Play, Zap } from 'lucide-react';
import { getProductDisplayImage, handleProductImageError } from '../utils/imageUtils';
import { handleShareProduct, getDynamicShareUrl, handleWhatsAppShare, toAbsoluteImageUrl } from '../utils/shareUtils';
import { parseGalleryImages } from '../services/api';
import { getVideoEmbedInfo } from '../utils/productMediaHelper';
import { ProductVideoModal } from './ProductVideoModal';

export { getDynamicShareUrl, handleWhatsAppShare, toAbsoluteImageUrl };

interface ProductCardProps {
  product: Product;
}

const extractUnitLabel = (name: string): string => {
  if (!name) return '1 Pack';
  const multiMatch = name.match(
    /(\d+(?:\.\d+)?\s*(?:kg|g|gm|gms|ml|l|ltr|litre|pc|pcs|unit|units|pack|packs)\s*(?:x|\*)\s*\d+(?:\s*(?:unit|units|pc|pcs|pack))?)/i
  );
  if (multiMatch && multiMatch[1]) return multiMatch[1].trim();
  const singleMatch = name.match(
    /\b(\d+(?:\.\d+)?\s*(?:kg|g|gm|gms|ml|l|ltr|litre|pc|pcs|pack|pouch))\b/i
  );
  if (singleMatch && singleMatch[1]) {
    return singleMatch[1]
      .replace(/gm|gms/i, 'g')
      .replace(/ltr|litre/i, 'L')
      .replace(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/, '$1 $2');
  }
  return '1 Pack';
};

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { cart, setQty, setSelectedProduct, toggleWishlist, isWishlisted, shopConfig } = useApp();
  const { t, isEnglish } = useLanguage();

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const touchStartXRef = useRef<number>(0);

  const qty = cart[product.ean] || 0;
  const wishlisted = isWishlisted(product.ean);
  const mrp = typeof product.mrp === 'number' ? product.mrp : parseFloat(product.mrp || '0');
  const sp = typeof product.selling_price === 'number' ? product.selling_price : parseFloat(product.selling_price || '0');
  const stock = parseProductStock(product.stock_qty);
  const discount = mrp > sp ? Math.round(((mrp - sp) / mrp) * 100) : 0;
  const unitLabel = useMemo(() => extractUnitLabel(product.product_name || ''), [product.product_name]);
  const deliveryTimingLabel = useMemo(() => {
    const slot = String(shopConfig?.deliverySlot || '').trim() || (isEnglish ? '30 min - 1 hr' : '୧ ଘଣ୍ଟା');
    const day = String(shopConfig?.deliveryDay || '').trim();
    if (day && day.toLowerCase() !== 'today') {
      const dayText = day.toLowerCase() === 'tomorrow' ? (isEnglish ? 'Tomorrow' : 'ଆସନ୍ତାକାଲି') : day;
      return `${dayText} · ${slot}`;
    }
    return slot;
  }, [shopConfig?.deliverySlot, shopConfig?.deliveryDay, isEnglish]);

  // Extract all gallery photos for swiping
  const galleryImages = useMemo(() => {
    const list: string[] = [];
    if (Array.isArray(product.gallery_images) && product.gallery_images.length > 0) {
      list.push(...product.gallery_images);
    } else if (product.additional_images) {
      list.push(...parseGalleryImages(product.additional_images));
    }
    const displayImg = getProductDisplayImage(product);
    if (displayImg && !list.includes(displayImg)) {
      list.unshift(displayImg);
    }
    return Array.from(new Set(list.filter(Boolean)));
  }, [product]);

  // Video embed check
  const videoInfo = useMemo(() => getVideoEmbedInfo(product.video_url), [product.video_url]);

  const currentDisplayImg = galleryImages[activePhotoIdx] || getProductDisplayImage(product);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (galleryImages.length <= 1) return;
    const endX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - endX;
    if (Math.abs(diff) > 30) {
      if (diff > 0) {
        setActivePhotoIdx((prev) => (prev < galleryImages.length - 1 ? prev + 1 : 0));
      } else {
        setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : galleryImages.length - 1));
      }
    }
  };

  const dotCount = Math.max(2, Math.min(4, galleryImages.length || 4));

  return (
    <>
      {showVideoModal && (
        <ProductVideoModal
          product={product}
          onClose={() => setShowVideoModal(false)}
        />
      )}

      <div className="flex flex-col min-w-0 w-full select-none group">
        {/* 1. Top Bordered Image Box with Unit Strip & Overlapping ADD Button */}
        <div
          onClick={() => setSelectedProduct(product)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative w-full rounded-2xl border border-slate-200/90 bg-white overflow-hidden cursor-pointer flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
        >
          {/* Video Play Button (if video_url exists) */}
          {videoInfo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowVideoModal(true);
              }}
              className="absolute top-1.5 left-1.5 z-20 bg-rose-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-0.5 cursor-pointer active:scale-95"
              title={isEnglish ? 'Watch video' : 'ଭିଡିଓ ଦେଖନ୍ତୁ'}
            >
              <Play className="w-2 h-2 fill-white text-white" />
              <span>Video</span>
            </button>
          )}

          {/* Top-right subtle Share & Wishlist icons */}
          <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 opacity-85 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => handleShareProduct(product, e)}
              className="w-6 h-6 rounded-full bg-white/90 hover:bg-white text-slate-500 hover:text-slate-800 border border-slate-200/70 flex items-center justify-center cursor-pointer active:scale-90 transition-transform shadow-2xs"
              title={isEnglish ? 'Share product' : 'ସେୟାର୍ କରନ୍ତୁ'}
              aria-label="Share product"
            >
              <Share2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleWishlist(product.ean);
              }}
              className="w-6 h-6 rounded-full bg-white/90 hover:bg-white border border-slate-200/70 flex items-center justify-center cursor-pointer active:scale-90 transition-transform shadow-2xs"
              title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-label="Toggle wishlist"
            >
              <Heart
                className={`w-3 h-3 transition-colors ${
                  wishlisted ? 'fill-rose-500 text-rose-500' : 'text-slate-400 hover:text-rose-500'
                }`}
              />
            </button>
          </div>

          {/* Product Image Stage */}
          <div className="w-full aspect-square p-2 sm:p-2.5 pb-1 flex items-center justify-center relative bg-white">
            <img
              src={currentDisplayImg}
              alt={product.product_name}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              className={`w-full h-full object-contain transition-transform duration-200 group-hover:scale-[1.03] ${
                stock <= 0 ? 'opacity-45 grayscale' : ''
              }`}
              onError={(e) => {
                handleProductImageError(e, product.backup_image_url, product.ean);
              }}
            />

            {/* Carousel Dots at Bottom-Left of Image Stage */}
            <div className="absolute bottom-1 left-2.5 flex items-center gap-1 pointer-events-none">
              {Array.from({ length: dotCount }).map((_, idx) => (
                <span
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    idx === activePhotoIdx % dotCount ? 'bg-slate-800' : 'bg-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Bottom Grey Unit Bar + Overlapping ADD / Stepper Button */}
          <div className="relative w-full bg-slate-100/90 px-2.5 py-1.5 min-h-[30px] flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 truncate pr-14">
              {unitLabel}
            </span>

            {/* ADD / Stepper Button Anchored Bottom-Right */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-1 bottom-1 z-10"
            >
              {qty > 0 ? (
                <div className="flex items-center justify-between bg-[#0c5273] text-white rounded-xl px-1.5 py-1 shadow-xs min-w-[64px] sm:min-w-[72px]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQty(product.ean, qty - 1);
                    }}
                    className="w-5 h-5 rounded-md hover:bg-white/15 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3 h-3 text-white stroke-[2.5]" />
                  </button>
                  <span className="text-xs font-extrabold px-1 tabular-nums">{qty}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQty(product.ean, qty + 1);
                    }}
                    className="w-5 h-5 rounded-md hover:bg-white/15 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3 h-3 text-white stroke-[2.5]" />
                  </button>
                </div>
              ) : stock <= 0 ? (
                <button
                  type="button"
                  disabled
                  className="bg-slate-200 text-slate-500 border border-slate-300 rounded-xl px-2 py-1 text-[9px] font-extrabold uppercase tracking-tight cursor-not-allowed"
                >
                  {isEnglish ? 'Out' : 'ନାହିଁ'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQty(product.ean, 1);
                  }}
                  className="bg-white hover:bg-sky-50 text-[#0c5273] border-[1.5px] border-[#0c5273] rounded-xl px-3 sm:px-3.5 py-1 text-[11px] sm:text-xs font-extrabold tracking-tight shadow-2xs active:scale-95 transition-all cursor-pointer"
                >
                  ADD
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. Below-Card Details: Price + MRP, % Off, Title, and Delivery Time */}
        <div
          onClick={() => setSelectedProduct(product)}
          className="pt-1.5 px-0.5 flex flex-col cursor-pointer min-w-0"
        >
          {/* Selling Price & Strikethrough MRP */}
          <div className="flex items-baseline gap-1 flex-wrap leading-none">
            <span className="text-[14px] sm:text-[15px] font-extrabold text-slate-900 tabular-nums tracking-tight">
              ₹{sp}
            </span>
            {mrp > sp && (
              <span className="text-[10.5px] sm:text-[11px] text-slate-400 line-through font-medium tabular-nums">
                ₹{mrp}
              </span>
            )}
          </div>

          {/* Discount % Off + Live Stock Left */}
          <div className="flex items-center justify-between gap-1 mt-0.5 flex-wrap">
            {discount > 0 ? (
              <span className="text-[10.5px] sm:text-[11px] font-bold text-emerald-700 leading-tight">
                {discount}% off
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-emerald-700 leading-tight">
                {stock > 0 ? (isEnglish ? 'Best Price' : 'ସର୍ବୋତ୍ତମ ଦର') : t('outOfStock')}
              </span>
            )}

            <span
              className={`text-[9.5px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded-md leading-none tabular-nums ${
                stock <= 0
                  ? 'bg-rose-50 text-rose-600 border border-rose-200/80'
                  : stock <= 5
                  ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
              }`}
            >
              {stock <= 0
                ? t('outOfStock')
                : isEnglish
                ? `${stock} left`
                : `ଷ୍ଟକ୍ ${stock}`}
            </span>
          </div>

          {/* Product Name */}
          <h4
            className="text-[11px] sm:text-[12px] font-semibold text-slate-900 leading-[1.25] line-clamp-2 mt-0.5 tracking-tight"
            title={product.product_name}
          >
            {product.product_name}
          </h4>

          {/* Delivery Time & Live Stock */}
          <div className="flex items-center gap-1 mt-1 text-[10px] font-medium text-slate-500">
            <Zap className="w-3 h-3 fill-amber-500 text-amber-600 shrink-0" />
            <span className="truncate" title={`${deliveryTimingLabel} · ${stock} left`}>
              {stock <= 0
                ? t('outOfStock')
                : isEnglish
                ? `${deliveryTimingLabel} · ${stock} left`
                : `${deliveryTimingLabel} · ଷ୍ଟକ୍ ${stock}`}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};


