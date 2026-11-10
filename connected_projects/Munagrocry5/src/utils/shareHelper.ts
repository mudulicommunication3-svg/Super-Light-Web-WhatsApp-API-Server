import { Product } from '../types';
import {
  getSiteDomain,
  getDynamicShareUrl,
  getProductShareUrl,
  handleWhatsAppShare,
  handleShareProduct,
  getProductShareText,
  DEFAULT_WHATSAPP_SHARE_FORMAT,
  DEFAULT_LINK_PASTE_CAPTION_FORMAT,
  getConfiguredShareFormat,
  getConfiguredLinkCaptionFormat,
  getConfiguredStoreInfo,
  formatProductWithTemplate,
  formatLinkPreviewCaption,
  toUnicodeStrike
} from './shareUtils';

export {
  getSiteDomain,
  getDynamicShareUrl,
  getProductShareUrl,
  handleWhatsAppShare,
  handleShareProduct,
  getProductShareText,
  DEFAULT_WHATSAPP_SHARE_FORMAT,
  DEFAULT_LINK_PASTE_CAPTION_FORMAT,
  getConfiguredShareFormat,
  getConfiguredLinkCaptionFormat,
  getConfiguredStoreInfo,
  formatProductWithTemplate,
  formatLinkPreviewCaption,
  toUnicodeStrike
};

/**
 * Legacy version token helper maintaining compatibility
 */
export const getProductVersionToken = (product: Product): string => {
  const activePrice = Number((product as any).price || product.selling_price || 0);
  const timeHash = Date.now().toString(36).slice(-4);
  return `${activePrice}_${timeHash}`;
};

/**
 * Returns formatted text sharing wishlist products using the exact 4-line + link format
 */
export const getWishlistShareText = (products: Product[], _isEnglish = true): string => {
  return products
    .map((p) => getProductShareText(p))
    .join('\n\n');
};

/**
 * Share all wishlist products in one click
 */
export const handleShareWishlist = async (products: Product[], isEnglish = true) => {
  if (!products || products.length === 0) return;

  const shareText = getWishlistShareText(products, isEnglish);

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareText).catch(() => {});
    }
  } catch {}

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        text: shareText
      });
      return;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
    }
  }

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  if (typeof window !== 'undefined') {
    window.open(whatsappUrl, '_blank');
  }
};

/**
 * Copy all wishlist details to clipboard
 */
export const copyWishlistToClipboard = async (products: Product[], isEnglish = true): Promise<boolean> => {
  const text = getWishlistShareText(products, isEnglish);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

/**
 * Returns formatted broadcast catalog text for admin to share multiple selected products
 */
export const getAdminBulkShareText = (
  products: Product[],
  _customNote = '',
  _isEnglish = true
): string => {
  return products
    .map((p) => getProductShareText(p))
    .join('\n\n');
};

/**
 * Returns WhatsApp click-to-chat URL for an individual product
 */
export const getIndividualWhatsAppShareUrl = (
  product: Product,
  phone = '',
  _customNote = ''
): string => {
  const text = getProductShareText(product);
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  const targetParam = cleanPhone ? `phone=91${cleanPhone}&` : '';
  return `https://api.whatsapp.com/send?${targetParam}text=${encodeURIComponent(text)}`;
};

/**
 * Admin triggers bulk sharing
 */
export const handleAdminBulkShare = async (
  products: Product[],
  customNote = '',
  isEnglish = true
) => {
  if (!products || products.length === 0) return;

  const shareText = getAdminBulkShareText(products, customNote, isEnglish);

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareText).catch(() => {});
    }
  } catch {}

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        text: shareText
      });
      return;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
    }
  }

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  if (typeof window !== 'undefined') {
    window.open(whatsappUrl, '_blank');
  }
};

