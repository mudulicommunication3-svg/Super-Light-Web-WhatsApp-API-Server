import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import {
  X,
  Share2,
  RefreshCw,
  Copy,
  Check,
  Send,
  Sparkles,
  Search,
  CheckCircle2,
  Link2,
  Zap
} from 'lucide-react';
import { resolveProductImage } from '../../utils/imageHelper';
import {
  getSiteDomain,
  getProductBestShareImage,
  getPrimaryCleanEan,
  getGlobalShareLinkVersion,
  resolveProductFromShortLink,
  safeEncodeUrlParam,
  DEFAULT_WHATSAPP_SHARE_FORMAT,
  DEFAULT_LINK_PASTE_CAPTION_FORMAT,
  getConfiguredShareFormat,
  getConfiguredLinkCaptionFormat,
  formatProductWithTemplate,
  formatLinkPreviewCaption
} from '../../utils/shareUtils';
import { saveShareFormatToConfigSheet, resetAllProductShareLinks } from '../../services/api';
import { showToast } from '../Toast';

interface AdminProductShareRefreshModalProps {
  product: Product;
  allProducts?: Product[];
  onClose: () => void;
  onSelectProduct?: (product: Product) => void;
  onUpdateAllProducts?: (updatedProducts: Product[]) => void;
}

export const AdminProductShareRefreshModal: React.FC<AdminProductShareRefreshModalProps> = ({
  product: initialProduct,
  allProducts = [],
  onClose,
  onSelectProduct,
  onUpdateAllProducts
}) => {
  const { isEnglish } = useLanguage();
  const [selectedProduct, setSelectedProduct] = useState<Product>(initialProduct);
  const [searchQuery, setSearchQuery] = useState('');
  const [pastedShortLink, setPastedShortLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResettingAllLinks, setIsResettingAllLinks] = useState(false);
  const [resetAllStatus, setResetAllStatus] = useState<string | null>(null);
  const [customPrice, setCustomPrice] = useState<string>('');
  const [linkCaptionTemplate, setLinkCaptionTemplate] = useState<string>(() => getConfiguredLinkCaptionFormat());
  const [formatTemplate, setFormatTemplate] = useState<string>(() => getConfiguredShareFormat());
  const [showOptionalTextFormat, setShowOptionalTextFormat] = useState(false);
  const [isSavingFormat, setIsSavingFormat] = useState(false);
  const [includeImgParam, setIncludeImgParam] = useState(false);

  // Dynamic time-hash that changes every time "Refresh Link" or "Reset All Links" is clicked
  const [timeHash, setTimeHash] = useState(() => getGlobalShareLinkVersion() || Date.now().toString(36).slice(-5));

  useEffect(() => {
    setSelectedProduct(initialProduct);
    const sp = initialProduct.selling_price || (initialProduct as any).price || 0;
    setCustomPrice(String(sp));
    setLinkCaptionTemplate(getConfiguredLinkCaptionFormat());
    setFormatTemplate(getConfiguredShareFormat());
    setTimeHash(getGlobalShareLinkVersion() || Date.now().toString(36).slice(-5));
  }, [initialProduct]);

  // Auto-resolve when user pastes a short link and always load live Google Sheet price
  const handlePasteShortLinkChange = (val: string) => {
    setPastedShortLink(val);
    const trimmed = val.trim();
    if (!trimmed) return;

    const matched = resolveProductFromShortLink(trimmed, allProducts);
    if (matched) {
      setSelectedProduct(matched);
      setCustomPrice(String(matched.selling_price || 0));
      setTimeHash(Date.now().toString(36).slice(-5));
      if (onSelectProduct) onSelectProduct(matched);
      showToast(
        isEnglish
          ? `✅ Auto-detected "${matched.product_name}" & loaded live Sheet price (Rs.${matched.selling_price})!`
          : `✅ "${matched.product_name}" ଚିହ୍ନଟ ହେଲା ଓ ଅସଲି Sheet ଦାମ୍ (Rs.${matched.selling_price}) ଆସିଗଲା!`
      );
    }
  };

  // Always use clean primary EAN (never comma-separated multi-EANs in ?item=)
  const cleanEan = getPrimaryCleanEan(selectedProduct);
  const activePrice = Number(customPrice || selectedProduct.selling_price || (selectedProduct as any).price || 0);
  const mrp = Number(selectedProduct.mrp || activePrice);
  const discountPercent = mrp > activePrice ? Math.round(((mrp - activePrice) / mrp) * 100) : 0;
  const productName = String(selectedProduct.product_name || (selectedProduct as any).name || 'Grocery Item')
    .replace(/\s+/g, ' ')
    .trim();
  const resolvedImg = getProductBestShareImage(selectedProduct) || resolveProductImage(selectedProduct);

  const rawStockVal = (selectedProduct as any).stock_qty ?? (selectedProduct as any).stock ?? (selectedProduct as any).quantity ?? 0;
  const stockQty = typeof rawStockVal === 'number' ? rawStockVal : parseInt(String(rawStockVal || '0'), 10) || 0;

  // Construct fresh short link or full link with embedded live stock & version tag
  const versionTag = `${activePrice}_s${stockQty}_${timeHash}`;
  const itemToken = `${cleanEan}_s${stockQty}_${timeHash}`;
  const baseDomain = getSiteDomain();

  const generatedUrl = includeImgParam
    ? `${baseDomain}/?item=${safeEncodeUrlParam(itemToken)}&n=${safeEncodeUrlParam(productName)}&img=${safeEncodeUrlParam(resolvedImg)}&sp=${activePrice}&mrp=${mrp}&stk=${stockQty}&v=${versionTag}`
    : `${baseDomain}/?item=${safeEncodeUrlParam(itemToken)}&sp=${activePrice}&mrp=${mrp}&stk=${stockQty}&v=${versionTag}`;

  const { ogTitle, ogDescription } = formatLinkPreviewCaption(
    linkCaptionTemplate,
    selectedProduct,
    activePrice
  );

  const shareMessage = formatProductWithTemplate(
    formatTemplate,
    selectedProduct,
    generatedUrl,
    activePrice
  );

  const handleSaveFormatToConfig = async () => {
    setIsSavingFormat(true);
    try {
      const cleanFmt = (formatTemplate || '').trim() || DEFAULT_WHATSAPP_SHARE_FORMAT;
      const cleanLinkCap = (linkCaptionTemplate || '').trim() || DEFAULT_LINK_PASTE_CAPTION_FORMAT;
      await saveShareFormatToConfigSheet(cleanFmt, undefined, undefined, cleanLinkCap);
      showToast(
        isEnglish
          ? '✅ Link Caption & Share Format saved to Config tab!'
          : '✅ ଲିଙ୍କ୍ କ୍ୟାପସନ୍ ଫର୍ମାଟ୍ Config ଟ୍ୟାବ୍‌ରେ ସେଭ୍ ହେଲା!'
      );
    } catch {
      showToast('Could not save format to Sheet');
    } finally {
      setIsSavingFormat(false);
    }
  };

  const handleRefreshLink = () => {
    setIsRefreshing(true);
    const newHash = Date.now().toString(36).slice(-5);
    setTimeHash(newHash);
    setTimeout(() => {
      setIsRefreshing(false);
      showToast(
        isEnglish
          ? '⚡ Link cache-buster refreshed! WhatsApp will fetch live photo & details.'
          : '⚡ ଲିଙ୍କ୍ ରିଫ୍ରେଶ୍ ହେଲା! WhatsApp ଏବେ ଲାଇଭ୍ ଫଟୋ ଓ ତଥ୍ୟ ଆଣିବ।'
      );
    }, 350);
  };

  // 1-CLICK RESET ALL PRODUCTS LINKS (FRONTEND + BACKEND)
  const handleResetAllProductsLinksClick = async () => {
    setIsResettingAllLinks(true);
    setResetAllStatus(null);
    try {
      const res = await resetAllProductShareLinks(allProducts);
      setTimeHash(res.versionTag);
      if (res.updatedProducts && res.updatedProducts.length > 0) {
        if (onUpdateAllProducts) {
          onUpdateAllProducts(res.updatedProducts);
        }
        const refreshedCurrent = res.updatedProducts.find(
          (p) => getPrimaryCleanEan(p) === cleanEan || p.ean === selectedProduct.ean
        );
        if (refreshedCurrent) {
          setSelectedProduct(refreshedCurrent);
        }
      }
      const msg = isEnglish
        ? `✅ All ${res.totalCount} product links reset (Frontend + Backend)! ${res.healedCount} image links healed to HTTPS CDN.`
        : `✅ ସମସ୍ତ ${res.totalCount} ଟି ସାମଗ୍ରୀର ଲିଙ୍କ୍ (Frontend + Backend) ରିସେଟ୍ ହେଲା! (${res.healedCount} ଟି ଫଟୋ CDN ଲିଙ୍କ୍ ସଜଡ଼ାଗଲା)`;
      setResetAllStatus(msg);
      showToast(msg);
    } catch (e) {
      showToast('Error resetting all product links');
    } finally {
      setIsResettingAllLinks(false);
    }
  };

  // PRIMARY: Copy ONLY the clean link (no extra text)
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopiedLink(true);
      showToast(
        isEnglish
          ? '🔗 Only Link copied! Paste in WhatsApp for auto photo & details card.'
          : '🔗 କେବଳ ଲିଙ୍କ୍ କପି ହେଲା! WhatsApp ରେ ପେଷ୍ଟ କଲେ ଅଟୋ ଫଟୋ ଓ କାର୍ଡ ଆସିବ।'
      );
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      showToast('Could not copy link');
    }
  };

  // OPTIONAL: Copy full 4-line text message
  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopiedMessage(true);
      showToast(isEnglish ? '📋 Optional Full Text Message copied!' : '📋 ସମ୍ପୂର୍ଣ୍ଣ ଟେକ୍ସଟ୍ ମେସେଜ୍ କପି ହେଲା!');
      setTimeout(() => setCopiedMessage(false), 2000);
    } catch {
      showToast('Could not copy message');
    }
  };

  // PRIMARY WHATSAPP SEND: Sends ONLY the clean link so WhatsApp auto-fills the Link Preview Card
  const handleOpenWhatsApp = () => {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(generatedUrl).catch(() => {});
      }
    } catch {}
    const whatsappAppUrl = `whatsapp://send?text=${encodeURIComponent(generatedUrl)}`;
    const whatsappWebUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(generatedUrl)}`;

    if (typeof window !== 'undefined') {
      const opened = window.open(whatsappAppUrl, '_blank');
      if (!opened) {
        window.open(whatsappWebUrl, '_blank');
      }
    }
  };

  const filteredProducts = searchQuery.trim()
    ? allProducts.filter((p) => {
        const directMatch = resolveProductFromShortLink(searchQuery, [p]);
        if (directMatch) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
          (p.product_name || '').toLowerCase().includes(q) ||
          String(p.ean || '').toLowerCase().includes(q) ||
          String(p.additional_eans || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q)
        );
      }).slice(0, 8)
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black leading-tight flex items-center gap-2 flex-wrap">
                <span>{isEnglish ? 'WhatsApp Short-Link Preview & 1-Click Reset Hub' : 'WhatsApp ସର୍ଟ-ଲିଙ୍କ୍ ପ୍ରିଭ୍ୟୁ ଓ ୧-କ୍ଲିକ୍ ରିସେଟ୍'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/30 text-emerald-100 font-extrabold border border-emerald-300/30">
                  Auto HD Image
                </span>
              </h3>
              <p className="text-xs text-emerald-100/90 mt-0.5 font-medium">
                {isEnglish
                  ? 'Paste any short link to test/fix preview, or 1-Click Reset all product links (Frontend & Backend)!'
                  : 'ସର୍ଟ-ଲିଙ୍କ୍ ପେଷ୍ଟ କରି ଫଟୋ ପ୍ରିଭ୍ୟୁ ଦେଖନ୍ତୁ କିମ୍ବା ୧-କ୍ଲିକ୍ ରେ ସବୁ ପ୍ରୋଡକ୍ଟ ଲିଙ୍କ୍ ରିସେଟ୍ କରନ୍ତୁ!'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* 1-Click All Products Reset Banner (Frontend + Backend) */}
          <div className="bg-gradient-to-r from-amber-50 via-emerald-50 to-sky-50 border-2 border-emerald-300 rounded-2xl p-3.5 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-600 fill-amber-500 shrink-0" />
                  <span>
                    {isEnglish
                      ? '1-Click Reset All Products Links (Frontend + Backend)'
                      : '୧-କ୍ଲିକ୍ ସବୁ ପ୍ରୋଡକ୍ଟ ଲିଙ୍କ୍ ରିସେଟ୍ (Frontend + Backend)'}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {isEnglish
                    ? 'Fixes missing short-link photos across all products, heals Sheet1 CDN links, and refreshes WhatsApp cache token.'
                    : 'ସମସ୍ତ ସାମଗ୍ରୀର ସର୍ଟ-ଲିଙ୍କ୍ ଫଟୋ ସମସ୍ୟା ସଜାଡ଼େ ଏବଂ Frontend ଓ Google Sheet Backend ଲିଙ୍କ୍ ଏକାଥରେ ରିସେଟ୍ କରେ।'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetAllProductsLinksClick}
                disabled={isResettingAllLinks}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer shrink-0 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResettingAllLinks ? 'animate-spin' : ''}`} />
                <span>
                  {isResettingAllLinks
                    ? (isEnglish ? 'Resetting All Links...' : 'ସବୁ ଲିଙ୍କ୍ ରିସେଟ୍ ହେଉଛି...')
                    : (isEnglish ? '🔄 Reset All Products Links' : '🔄 ସବୁ ପ୍ରୋଡକ୍ଟ ଲିଙ୍କ୍ ରିସେଟ୍')}
                </span>
              </button>
            </div>
            {resetAllStatus && (
              <div className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{resetAllStatus}</span>
              </div>
            )}
          </div>

          {/* WhatsApp Chat Board Short-Link Paste Input + Product Search */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-emerald-50/70 border border-emerald-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:bg-white transition-all">
              <Link2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <input
                type="text"
                value={pastedShortLink}
                onChange={(e) => handlePasteShortLinkChange(e.target.value)}
                placeholder={
                  isEnglish
                    ? 'Paste WhatsApp Short Link here (e.g. https://www.munagrocery.in/?item=490000038&sp=235) to auto-preview photo...'
                    : 'ଏଠାରେ WhatsApp ସର୍ଟ-ଲିଙ୍କ୍ ପେଷ୍ଟ କରନ୍ତୁ (ଯଥା ?item=490000038) — ତୁରନ୍ତ ଫଟୋ ଓ ତଥ୍ୟ ଦେଖାଇବ...'
                }
                className="w-full text-xs bg-transparent outline-none text-slate-900 font-semibold placeholder:text-slate-500"
              />
              {pastedShortLink && (
                <button
                  onClick={() => setPastedShortLink('')}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {allProducts.length > 1 && (
              <div className="relative">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:bg-white transition-all">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isEnglish ? 'Or search product by Name / EAN barcode...' : 'କିମ୍ବା ସାମଗ୍ରୀର ନାମ / ବାରକୋଡ୍ ଖୋଜନ୍ତୁ...'}
                    className="w-full text-xs bg-transparent outline-none text-slate-800 font-semibold"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.ean}
                        onClick={() => {
                          setSelectedProduct(p);
                          setCustomPrice(String(p.selling_price || 0));
                          setTimeHash(Date.now().toString(36).slice(-5));
                          setSearchQuery('');
                          if (onSelectProduct) onSelectProduct(p);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-emerald-50/70 flex items-center gap-2.5 transition-colors text-xs"
                      >
                        <img
                          src={getProductBestShareImage(p) || resolveProductImage(p)}
                          alt={p.product_name}
                          className="w-7 h-7 object-contain rounded bg-slate-100 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 truncate">{p.product_name}</p>
                          <p className="text-[10px] text-slate-400">
                            EAN: {getPrimaryCleanEan(p)} · ₹{p.selling_price}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Product Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
              <img
                src={resolvedImg}
                alt={productName}
                className="w-full h-full object-contain mix-blend-multiply"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  {selectedProduct.category || 'General'}
                </span>
                <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                  Primary EAN: {cleanEan}
                </span>
              </div>
              <h4 className="font-black text-slate-900 text-sm mt-1 leading-snug line-clamp-2">
                {productName}
              </h4>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-black text-slate-900 text-sm">₹{activePrice}</span>
                {mrp > activePrice && (
                  <span className="text-xs text-slate-400 line-through">₹{mrp}</span>
                )}
                {discountPercent > 0 && (
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">
                    {discountPercent}% OFF
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Live Generated WhatsApp Link Box (ONLY LINK) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isEnglish ? 'Only-Link URL (Copy & Paste in WhatsApp)' : 'କେବଳ ଲିଙ୍କ୍ (କପି କରି WhatsApp ରେ ପେଷ୍ଟ କରନ୍ତୁ)'}</span>
              </label>

              <button
                type="button"
                onClick={handleRefreshLink}
                disabled={isRefreshing}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                title="Generates a new timestamp token so WhatsApp re-scrapes the product preview"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isEnglish ? '🔄 Reset This Link' : '🔄 ଏହି ଲିଙ୍କ୍ ରିସେଟ୍'}</span>
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-emerald-700 break-all select-all font-semibold leading-relaxed">
                {generatedUrl}
              </span>
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shrink-0 flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Link Only'}</span>
              </button>
            </div>

            {/* Toggle: Include direct photo parameter if needed */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeImgCheck"
                  checked={includeImgParam}
                  onChange={(e) => setIncludeImgParam(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="includeImgCheck" className="text-slate-600 font-medium cursor-pointer">
                  {isEnglish
                    ? 'Include explicit photo & name inside URL (&img=...)'
                    : 'ଲିଙ୍କ୍ ଭିତରେ ସିଧା ଫଟୋ ଓ ନାମ ମଧ୍ୟ ଯୋଡ଼ନ୍ତୁ (&img=...)'}
                </label>
              </div>
              <span className="text-[10px] text-emerald-700 font-bold">
                {includeImgParam ? 'Full URL with Photo' : 'Short Link (Edge Indexed ✓)'}
              </span>
            </div>
          </div>

          {/* Simulated WhatsApp Chat Board Short-Link Paste Preview Box */}
          <div className="bg-[#eef2f5] border border-slate-300/80 rounded-2xl p-3.5 space-y-2">
            <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>WhatsApp Chat Board Short-Link Preview</span>
              <span className="text-[10px] text-emerald-700 font-bold normal-case">
                ✓ Live HD Image & Details Fixed
              </span>
            </p>

            <div className="bg-[#1f2c34] text-white rounded-xl overflow-hidden border border-slate-700 shadow-sm max-w-sm">
              <div className="w-full h-40 bg-white flex items-center justify-center p-2 relative">
                <img
                  src={resolvedImg}
                  alt={productName}
                  className="w-full h-full object-contain"
                />
                <span className="absolute top-2 right-2 text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded shadow-2xs">
                  HTTPS CDN Photo
                </span>
              </div>
              <div className="p-3 bg-[#121b22] border-t border-slate-700">
                <h5 className="font-extrabold text-xs text-white leading-tight">
                  {ogTitle}
                </h5>
                <p className="text-[11px] text-slate-300 mt-0.5 font-medium whitespace-pre-line">
                  {ogDescription}
                </p>
                <p className="text-[10px] text-slate-400 font-mono mt-1">🔗 munagrocery.in</p>
              </div>
              <div className="px-3 py-2 bg-[#005c4b] font-mono text-[11px] text-[#53bdeb] break-all leading-relaxed">
                {generatedUrl}
              </div>
            </div>
          </div>

          {/* Extra Editable Field: Only-Link Paste Auto Caption + Optional Text Format */}
          <div className="space-y-3 bg-emerald-50/50 border border-emerald-200 rounded-2xl p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <label className="text-[11px] font-bold text-slate-700 mb-1 block">
                  {isEnglish ? 'Selling Price (₹)' : 'ବିକ୍ରି ମୂଲ୍ୟ (₹)'}
                </label>
                <input
                  type="number"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-4 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setLinkCaptionTemplate(DEFAULT_LINK_PASTE_CAPTION_FORMAT);
                    setFormatTemplate(DEFAULT_WHATSAPP_SHARE_FORMAT);
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold cursor-pointer"
                >
                  ↺ {isEnglish ? 'Default' : 'ଡିଫଲ୍ଟ'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveFormatToConfig}
                  disabled={isSavingFormat}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black cursor-pointer disabled:opacity-50"
                >
                  {isSavingFormat
                    ? (isEnglish ? 'Saving...' : 'ସେଭ୍ ହେଉଛି...')
                    : (isEnglish ? '💾 Save to Config Tab' : '💾 Config ରେ ସେଭ୍')}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black text-emerald-950 mb-1 block">
                {isEnglish
                  ? '🔗 Extra Editable Field: Only-Link Paste Auto Caption (Config Tab):'
                  : '🔗 କେବଳ ଲିଙ୍କ୍ ପେଷ୍ଟ ଅଟୋ-କ୍ୟାପସନ୍ ଫର୍ମାଟ୍ (Config ଟ୍ୟାବ୍ ସିଙ୍କ୍):'}
              </label>
              <textarea
                rows={3}
                value={linkCaptionTemplate}
                onChange={(e) => setLinkCaptionTemplate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
              />
            </div>

            <div className="pt-1 border-t border-emerald-200/70">
              <button
                type="button"
                onClick={() => setShowOptionalTextFormat(!showOptionalTextFormat)}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
              >
                <span>{showOptionalTextFormat ? '▼' : '▶'}</span>
                <span>
                  {isEnglish
                    ? 'Optional: Edit Full Text Copy-Paste Format (whatsapp_share_format)'
                    : 'ଇଚ୍ଛାଧୀନ (Optional): ସମ୍ପୂର୍ଣ୍ଣ ଟେକ୍ସଟ୍ କପି ଫର୍ମାଟ୍ ଏଡିଟ୍ କରନ୍ତୁ'}
                </span>
              </button>

              {showOptionalTextFormat && (
                <textarea
                  rows={4}
                  value={formatTemplate}
                  onChange={(e) => setFormatTemplate(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions: Primary = Link Only, Secondary = Optional Text Copy */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
          >
            {copiedLink ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? (isEnglish ? 'Link Copied! ✅' : 'ଲିଙ୍କ୍ କପି ହେଲା! ✅') : (isEnglish ? '🔗 Copy Link Only' : '🔗 କେବଳ ଲିଙ୍କ୍ କପି')}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyMessage}
            className="px-3 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Optional: Copy full 4-line text + link"
          >
            {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedMessage ? (isEnglish ? 'Text Copied!' : 'ଟେକ୍ସଟ୍ କପି!') : (isEnglish ? '📋 Copy Text (Optional)' : '📋 ଟେକ୍ସଟ୍ କପି (Optional)')}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="flex-1 py-2.5 px-4 bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white font-black text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Send className="w-4 h-4 shrink-0" />
            <span>{isEnglish ? 'Send Link on WhatsApp 🚀' : 'WhatsApp ରେ ଲିଙ୍କ୍ ପଠାନ୍ତୁ 🚀'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
