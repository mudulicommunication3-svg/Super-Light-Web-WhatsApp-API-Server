import React from 'react';
import { useApp } from '../context/AppContext';
import { ChevronRight, ShoppingBag } from 'lucide-react';
import { resolveProductImage, handleProductImageError } from '../utils/imageHelper';
import { Product } from '../types';

export const FloatingCartBar: React.FC = () => {
  const { cart, catalog, setActiveScreen, activeScreen, selectedProduct } = useApp();

  // Calculate items and total
  const keys = Object.keys(cart);
  let totalItems = 0;
  let totalPrice = 0;
  const cartPreviewProducts: Product[] = [];

  keys.forEach((ean) => {
    const q = cart[ean] || 0;
    if (q > 0) {
      const p = catalog.find((x) => String(x.ean) === String(ean));
      if (p) {
        const sp = typeof p.selling_price === 'number' ? p.selling_price : parseFloat(p.selling_price || '0');
        totalItems += q;
        totalPrice += sp * q;
        if (cartPreviewProducts.length < 3) {
          cartPreviewProducts.push(p);
        }
      }
    }
  });

  // Only show on 'home' screen and only when items > 0 and modal is closed
  if (activeScreen !== 'home' || totalItems === 0 || selectedProduct) return null;

  return (
    <div
      id="floatingCartBar"
      className="fixed left-1/2 -translate-x-1/2 z-[45] pointer-events-auto"
      style={{
        bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))'
      }}
    >
      <button
        type="button"
        id="homeViewCartPillBtn"
        onClick={() => {
          window.location.hash = 'cart';
          setActiveScreen('cart');
        }}
        className="bg-[#0c6b95] hover:bg-[#09597d] text-white rounded-full pl-2.5 pr-2 py-1.5 shadow-[0_8px_24px_rgba(12,107,149,0.45)] border border-white/20 flex items-center gap-3 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
      >
        {/* Overlapping Product Thumbnails in Cart */}
        {cartPreviewProducts.length > 0 ? (
          <div className="flex items-center pl-0.5">
            {cartPreviewProducts.map((cp, idx) => (
              <div
                key={`home-cart-thumb-${cp.ean}-${idx}`}
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
            {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Right White Circle Chevron */}
        <div className="w-9 h-9 rounded-full bg-white text-[#0c6b95] flex items-center justify-center shadow-xs shrink-0">
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        </div>
      </button>
    </div>
  );
};
