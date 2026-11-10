import React, { useEffect } from 'react';
import { Product, parseProductStock } from '../types';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { X, Play, ShoppingBag, Plus, Minus, Check } from 'lucide-react';
import { getVideoEmbedInfo } from '../utils/productMediaHelper';
import { getProductDisplayImage } from '../utils/imageUtils';

interface ProductVideoModalProps {
  product: Product;
  onClose: () => void;
}

export const ProductVideoModal: React.FC<ProductVideoModalProps> = ({ product, onClose }) => {
  const { cart, setQty } = useApp();
  const { isEnglish } = useLanguage();

  const embedInfo = getVideoEmbedInfo(product.video_url);
  const qty = cart[product.ean] || 0;
  const stock = parseProductStock(product.stock_qty);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!embedInfo) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden max-w-xl w-full shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-3.5 sm:p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black truncate">{product.product_name}</h3>
              <span className="text-[10px] text-slate-400 block truncate">
                {isEnglish ? 'Product Demo & Unboxing Video' : 'ଉତ୍ପାଦ ଡେମୋ ଓ ବ୍ୟବହାର ଭିଡିଓ'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Close video"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Player Stage */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {embedInfo.isYouTube ? (
            <iframe
              src={embedInfo.embedUrl}
              title={`${product.product_name} video`}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <video
              src={embedInfo.embedUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Bottom Bar with Product Info & Quick Buy */}
        <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-white p-1 shrink-0 overflow-hidden border border-slate-700">
              <img
                src={getProductDisplayImage(product)}
                alt={product.product_name}
                className="w-full h-full object-contain mix-blend-multiply"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{product.product_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-black text-emerald-400">Rs. {product.selling_price}</span>
                {Number(product.mrp) > Number(product.selling_price) && (
                  <span className="text-[10px] text-slate-400 line-through">Rs. {product.mrp}</span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Add To Cart Button */}
          <div className="shrink-0">
            {qty > 0 ? (
              <div className="flex items-center gap-2 bg-emerald-600 text-white rounded-xl px-2 py-1 shadow-sm font-bold text-xs">
                <button
                  type="button"
                  onClick={() => setQty(product.ean, qty - 1)}
                  className="w-6 h-6 rounded-lg bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-1 font-black">{qty} in Cart</span>
                <button
                  type="button"
                  onClick={() => setQty(product.ean, qty + 1)}
                  className="w-6 h-6 rounded-lg bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : stock <= 0 ? (
              <span className="text-xs font-bold text-rose-400 bg-rose-950/60 border border-rose-800 px-3 py-1.5 rounded-xl">
                Out of Stock
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setQty(product.ean, 1)}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{isEnglish ? 'Add to Cart' : 'କାର୍ଟରେ ଯୋଡ଼ନ୍ତୁ'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
