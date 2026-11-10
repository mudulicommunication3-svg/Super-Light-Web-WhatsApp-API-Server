import { Product } from '../types';
import { ORIGINAL_CDN_MAP, getOriginalCdnUrl } from '../data/initialData';
import { formatDirectImageUrl, resolveProductImage } from './imageHelper';

export const getSiteDomain = (): string => {
  return 'https://www.munagrocery.in';
};

/**
 * Robust EAN/SKU extractor that strips any version suffixes like _rst_yuq6z, _v2, -v2
 * from query string values or raw EAN tokens.
 */
export const extractCleanBaseEan = (str: string): string => {
  if (!str) return '';
  let s = String(str).trim();
  try {
    s = decodeURIComponent(s);
  } catch {}
  const itemMatch = s.match(/[?&](?:item|ean|product|id)=([^&#\s]+)/i);
  if (itemMatch && itemMatch[1]) {
    s = itemMatch[1];
  }
  s = s.replace(/^EAN-/i, '').trim();
  const underscoreIdx = s.indexOf('_');
  if (underscoreIdx > 0) {
    s = s.substring(0, underscoreIdx);
  }
  return s.trim();
};

/**
 * Extracts the single clean primary EAN token from a product or comma-separated EAN string.
 * Prevents multi-EAN strings like "490000038, 132487249" from breaking short URLs.
 */
export const getPrimaryCleanEan = (productOrEan: Product | string | number | undefined | null): string => {
  if (!productOrEan) return '';
  let raw = '';
  if (typeof productOrEan === 'object') {
    raw =
      (productOrEan as any).primary_ean ||
      productOrEan.ean ||
      (productOrEan.ean_list && productOrEan.ean_list[0]) ||
      (productOrEan as any).id ||
      '';
  } else {
    raw = String(productOrEan);
  }
  return extractCleanBaseEan(raw);
};

/**
 * Global Link Reset Version Token (updated when Admin clicks "1-Click Reset All Products Links").
 */
export const getGlobalShareLinkVersion = (): string => {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem('munna_global_link_version');
      if (v && v.trim()) return v.trim();
      const savedSettings = localStorage.getItem('SHOP_SETTINGS') || localStorage.getItem('munna_shop_config');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        const cfgV = parsed.shareLinkVersion || parsed.share_link_version;
        if (cfgV && String(cfgV).trim()) return String(cfgV).trim();
      }
    }
  } catch {}
  return '';
};

export const setGlobalShareLinkVersion = (version: string): void => {
  try {
    if (typeof localStorage !== 'undefined' && version) {
      localStorage.setItem('munna_global_link_version', version.trim());
    }
  } catch {}
};

/**
 * Ensures any image URL (local relative path or bare filename)
 * is converted to a fully qualified absolute HTTPS URL required by WhatsApp & Meta crawlers.
 */
export const toAbsoluteImageUrl = (rawUrl?: string): string => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  if (!url) return '';

  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  if (url.startsWith('http://')) {
    return url.replace(/^http:\/\//i, 'https://');
  }
  if (url.startsWith('https://')) {
    return url;
  }

  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${getSiteDomain()}${cleanPath}`;
};

/**
 * Resolves the genuine, working HTTP/HTTPS image URL for sharing.
 * Crucial fix: Checks all primary + additional EAN tokens and gallery images so
 * a local /products/... path never breaks WhatsApp link preview cards.
 */
export const getProductBestShareImage = (product: Product): string => {
  const allEanTokens = `${(product as any).primary_ean || ''},${product.ean || ''},${product.additional_eans || ''},${(product.ean_list || []).join(',')}`
    .split(/[,;|\s]+/)
    .map((s) => extractCleanBaseEan(s))
    .filter(Boolean);

  const rawImg = (product.image_url || (product as any).image || '').trim();
  const rawBackup = (product.backup_image_url || '').trim();

  // 1. If backup_image_url is a real working external CDN link, prioritize it over local /products/ paths
  if (rawBackup.startsWith('http://') || rawBackup.startsWith('https://')) {
    return formatDirectImageUrl(rawBackup);
  }

  // 2. If rawImg is a real working external CDN link (and NOT a local /products/ path)
  if ((rawImg.startsWith('http://') || rawImg.startsWith('https://')) && !rawImg.includes('/products/')) {
    return formatDirectImageUrl(rawImg);
  }

  // 3. Check gallery_images / additional_images for a valid HTTPS CDN image
  const gallery = product.gallery_images || [];
  for (const g of gallery) {
    if (g && (g.startsWith('https://') || g.startsWith('http://')) && !g.includes('/products/')) {
      return formatDirectImageUrl(g);
    }
  }

  // 4. Fallback to known original CDN for any of this product's EAN tokens
  for (const tk of allEanTokens) {
    if (ORIGINAL_CDN_MAP[tk]) {
      return formatDirectImageUrl(ORIGINAL_CDN_MAP[tk]);
    }
  }
  const orig = getOriginalCdnUrl(product.ean || product.additional_eans);
  if (orig) {
    return formatDirectImageUrl(orig);
  }

  // 5. Try resolveProductImage helper
  const resolved = resolveProductImage(product);
  if (resolved && (resolved.startsWith('http://') || resolved.startsWith('https://')) && !resolved.startsWith('data:') && !resolved.includes('/products/')) {
    return formatDirectImageUrl(resolved);
  }

  // 6. If it's a real absolute URL and not a dummy /products/ path
  if (rawImg && !rawImg.includes('/products/') && !rawImg.startsWith('data:')) {
    return toAbsoluteImageUrl(rawImg);
  }

  // 7. Default store banner
  return 'https://www.munagrocery.in/banner.jpg';
};

/**
 * RFC3986-safe URI component encoder that also encodes ', (, ), *, !, ~
 * so WhatsApp's URL linkifier never splits links containing apostrophes (e.g. "Johnson's") or parentheses.
 */
export const safeEncodeUrlParam = (str: string): string => {
  return encodeURIComponent(str).replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
};

/**
 * Universal dynamic WhatsApp share URL generator with auto cache-busting.
 * Embeds version tag directly into item parameter (`item=${productId}_s${stockQty}_${verTag}`)
 * so WhatsApp server URL normalizer cannot strip it and is forced to fetch fresh HTML metadata.
 */
export const getDynamicShareUrl = (product: Product, customPrice?: number | string, forceTimeHash?: string): string => {
  const activePrice = Number(customPrice ?? (product as any).price ?? product.selling_price ?? 0);
  const mrp = Number(product.mrp || activePrice);
  const rawStock = (product as any).stock_qty ?? (product as any).stock ?? (product as any).quantity ?? 0;
  const stockQty = typeof rawStock === 'number' ? rawStock : parseInt(String(rawStock || '0'), 10) || 0;

  const timeHash = forceTimeHash || Date.now().toString(36).slice(-4);
  const cleanEan = getPrimaryCleanEan(product);
  const globalVer = getGlobalShareLinkVersion();
  const verTag = globalVer ? globalVer : `v${timeHash}`;

  // Embed stock quantity directly into the item parameter (e.g. 490000038_s8_v3x2a)
  // so WhatsApp server treats stock changes as a brand new URL, forcing fresh unfurling
  const itemWithVersion = `${cleanEan}_s${stockQty}_${verTag}`;

  // If the product is already in the edge media index (ORIGINAL_CDN_MAP), keep the URL clean & compact like Aashirvaad Atta
  const isKnownMediaEan = Boolean(ORIGINAL_CDN_MAP[cleanEan]);
  const productName = String(product.product_name || (product as any).name || '').replace(/\s+/g, ' ').trim();
  const nameParam = !isKnownMediaEan && productName ? `&n=${safeEncodeUrlParam(productName)}` : '';

  const bestImg = getProductBestShareImage(product);
  const imgParam =
    !isKnownMediaEan &&
    bestImg &&
    (bestImg.startsWith('http://') || bestImg.startsWith('https://')) &&
    !bestImg.includes('/products/')
      ? `&img=${safeEncodeUrlParam(bestImg)}`
      : '';

  return `${getSiteDomain()}/?item=${safeEncodeUrlParam(itemWithVersion)}${nameParam}&sp=${activePrice}&mrp=${mrp}&stk=${stockQty}${imgParam}&v=${activePrice}_s${stockQty}_${verTag}`;
};

/**
 * Backwards-compatible alias for getDynamicShareUrl
 */
export const getProductShareUrl = (product: Product, customPrice?: number | string): string => {
  return getDynamicShareUrl(product, customPrice);
};

/**
 * Parses any pasted WhatsApp short link (e.g. https://www.munagrocery.in/?item=490000038_rst_yuq6z&sp=235&mrp=283)
 * or barcode string and resolves the matching Product + price/MRP overrides so the Admin Panel
 * Chat Board Preview Tester can immediately show the exact product image & caption.
 */
export const resolveProductFromShortLink = (
  inputUrlOrCode: string,
  allProducts: Product[]
): Product | null => {
  const raw = String(inputUrlOrCode || '').trim();
  if (!raw) return null;

  let itemCode = extractCleanBaseEan(raw);
  let spOverride: number | undefined;
  let mrpOverride: number | undefined;
  let nameOverride = '';
  let imgOverride = '';

  const spMatch = raw.match(/[?&](?:sp|price|p)=([0-9.]+)/i);
  if (spMatch && spMatch[1]) {
    const num = Number(spMatch[1]);
    if (!isNaN(num) && num > 0) spOverride = num;
  }

  const mrpMatch = raw.match(/[?&](?:mrp|m)=([0-9.]+)/i);
  if (mrpMatch && mrpMatch[1]) {
    const num = Number(mrpMatch[1]);
    if (!isNaN(num) && num > 0) mrpOverride = num;
  }

  const nMatch = raw.match(/[?&](?:n|name)=([^&#\s]+)/i);
  if (nMatch && nMatch[1]) {
    try {
      nameOverride = decodeURIComponent(nMatch[1]).trim();
    } catch {}
  }

  const imgMatch = raw.match(/[?&](?:img|image)=([^&#\s]+)/i);
  if (imgMatch && imgMatch[1]) {
    try {
      imgOverride = decodeURIComponent(imgMatch[1]).trim();
    } catch {}
  }

  let stkOverride: number | undefined;
  const itemStockMatch = raw.match(/_s(\d+)_/i) || raw.match(/_stk(\d+)_/i);
  const stkParamMatch = raw.match(/[?&](?:stk|stock|sq)=(\d+)/i);
  if (itemStockMatch && itemStockMatch[1]) {
    stkOverride = Number(itemStockMatch[1]);
  } else if (stkParamMatch && stkParamMatch[1]) {
    stkOverride = Number(stkParamMatch[1]);
  }

  const cleanLower = itemCode.toLowerCase();
  const matched = allProducts.find((p) => {
    const pCleanEan = getPrimaryCleanEan(p).toLowerCase();
    if (pCleanEan && pCleanEan === cleanLower) return true;

    const tokens = `${(p as any).primary_ean || ''},${p.ean || ''},${p.additional_eans || ''},${(p.ean_list || []).join(',')}`
      .split(/[,;|\s]+/)
      .map((s) => extractCleanBaseEan(s).toLowerCase())
      .filter(Boolean);
    if (tokens.includes(cleanLower)) return true;

    if (p.rowIndex && (`row-${p.rowIndex}` === cleanLower || String(p.rowIndex) === cleanLower)) return true;
    if (cleanLower.length >= 6) {
      const bkp = String(p.backup_image_url || '').toLowerCase();
      const pri = String(p.image_url || '').toLowerCase();
      if (bkp.includes(cleanLower) || pri.includes(cleanLower)) return true;
    }
    return false;
  }) || null;

  if (matched) {
    return {
      ...matched,
      product_name: matched.product_name || nameOverride,
      selling_price: matched.selling_price ?? spOverride ?? 0,
      mrp: matched.mrp ?? mrpOverride ?? matched.selling_price ?? 0,
      stock_qty: matched.stock_qty !== undefined ? matched.stock_qty : (stkOverride ?? 0),
      image_url: matched.image_url || imgOverride
    };
  }

  const fallbackImg = imgOverride || getOriginalCdnUrl(itemCode) || 'https://www.munagrocery.in/banner.jpg';

  if (nameOverride || imgOverride || spOverride !== undefined || stkOverride !== undefined) {
    return {
      ean: itemCode,
      product_name: nameOverride || `Item #${itemCode}`,
      selling_price: spOverride ?? 0,
      mrp: mrpOverride ?? spOverride ?? 0,
      stock_qty: stkOverride ?? 0,
      image_url: fallbackImg,
      backup_image_url: fallbackImg,
      category: 'Grocery'
    };
  }

  return null;
};

export const DEFAULT_WHATSAPP_SHARE_FORMAT = `*[Product Name with Weight]*
*Rs [Offer Price]* ~*MRP [MRP]*~ (*[Discount %]% OFF*)
[Store Name]
[Address]
[Product Link]`;

export const DEFAULT_LINK_PASTE_CAPTION_FORMAT = `[Product Name with Weight] Rs [Offer Price]
*Rs [Offer Price]* ~*MRP [MRP]*~ ([Discount %]% OFF) [Stock Status]
[Store Name], [Address] odisha call-9040585726`;

export const getConfiguredShareFormat = (): string => {
  try {
    if (typeof localStorage !== 'undefined') {
      const direct = localStorage.getItem('munna_whatsapp_share_format');
      if (direct && direct.trim()) return direct.trim();

      const savedSettings = localStorage.getItem('SHOP_SETTINGS') || localStorage.getItem('munna_shop_config');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        const fmt = parsed.whatsappShareFormat || parsed.whatsapp_share_format;
        if (fmt && String(fmt).trim()) {
          return String(fmt).trim();
        }
      }
    }
  } catch {}
  return DEFAULT_WHATSAPP_SHARE_FORMAT;
};

export const getConfiguredLinkCaptionFormat = (): string => {
  try {
    if (typeof localStorage !== 'undefined') {
      const direct = localStorage.getItem('munna_whatsapp_link_caption_format');
      if (direct && direct.trim()) return direct.trim();

      const savedSettings = localStorage.getItem('SHOP_SETTINGS') || localStorage.getItem('munna_shop_config');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        const fmt = parsed.whatsappLinkCaptionFormat || parsed.whatsapp_link_caption_format;
        if (fmt && String(fmt).trim()) {
          return String(fmt).trim();
        }
      }
    }
  } catch {}
  return DEFAULT_LINK_PASTE_CAPTION_FORMAT;
};

export const getConfiguredStoreInfo = (): { storeName: string; storeAddress: string } => {
  let storeName = 'Munna Mobile & Grocery';
  let storeAddress = 'Cinema Hall Road, Niali';
  try {
    if (typeof localStorage !== 'undefined') {
      const savedSettings = localStorage.getItem('SHOP_SETTINGS') || localStorage.getItem('munna_shop_config');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.storeName && String(parsed.storeName).trim()) {
          storeName = String(parsed.storeName).trim();
        }
        if (parsed.storePickupAddress && String(parsed.storePickupAddress).trim()) {
          storeAddress = String(parsed.storePickupAddress).trim();
        }
      }
    }
  } catch {}
  return { storeName, storeAddress };
};

export const toUnicodeStrike = (str: string): string => {
  if (!str) return '';
  let plain = String(str);
  plain = plain.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, (m) => {
    const code = m.codePointAt(0);
    if (code && code >= 0x1D7CE && code <= 0x1D7ED) return String.fromCharCode(48 + (code - 0x1D7CE)); // Bold 0-9
    if (code && code >= 0x1D5D4 && code <= 0x1D5ED) return String.fromCharCode(65 + (code - 0x1D5D4)); // Bold A-Z
    if (code && code >= 0x1D5EE && code <= 0x1D607) return String.fromCharCode(97 + (code - 0x1D5EE)); // Bold a-z
    return m;
  });
  return Array.from(plain)
    .map((c) => c + '\u0336')
    .join('');
};

export const toUnicodeBold = (str: string): string => {
  if (!str) return '';
  const charMap: Record<string, string> = {
    '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰',
    '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵',
    'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘',
    'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝',
    'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢',
    'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧',
    'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬',
    'Z': '𝗭',
    'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲',
    'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷',
    'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼',
    'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁',
    'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝗫', 'y': '𝘆',
    'z': '𝘇'
  };
  return String(str).split('').map((c) => charMap[c] || c).join('');
};

export const formatProductWithTemplate = (
  template: string,
  product: Product,
  customUrl?: string,
  customPrice?: number | string,
  customStoreName?: string,
  customStoreAddress?: string
): string => {
  const activePrice = Number(customPrice ?? (product as any).price ?? product.selling_price ?? 0);
  const mrp = Number(product.mrp || activePrice);
  const discountPercent = mrp > activePrice ? Math.round(((mrp - activePrice) / mrp) * 100) : 0;
  const savings = mrp > activePrice ? mrp - activePrice : 0;
  const productName = String(product.product_name || (product as any).name || 'Munna Grocery Special Offer')
    .replace(/\s+/g, ' ')
    .trim();
  const cleanEan = getPrimaryCleanEan(product);
  const category = String(product.category || 'Grocery').trim();
  const shareUrl = customUrl || getDynamicShareUrl(product, activePrice);
  const { storeName: cfgStoreName, storeAddress: cfgAddress } = getConfiguredStoreInfo();
  const finalStoreName = (customStoreName || cfgStoreName || 'Munna Mobile & Grocery').trim();
  const finalAddress = (customStoreAddress || cfgAddress || 'Cinema Hall Road, Niali').trim();

  const rawStock = (product as any).stock_qty ?? (product as any).stock ?? (product as any).quantity ?? 0;
  const stockQty = typeof rawStock === 'number' ? rawStock : parseInt(String(rawStock || '0'), 10) || 0;
  const stockStatusText = stockQty > 0 ? `In Stock (${stockQty}pc)` : 'Out of Stock';
  const stockQtyText = stockQty > 0 ? `${stockQty}pc` : '0pc';

  const rawTemplate = (template && template.trim()) ? template.trim() : DEFAULT_WHATSAPP_SHARE_FORMAT;

  const populated = rawTemplate
    .replace(/\[Product Name with Weight\]|\[Product Name\]|\{product_name\}|\{name\}/gi, productName)
    .replace(/Rs\s*\*?\[Offer Price\]\*?|Rs\s*\*?\[Selling Price\]\*?|Rs\s*\*?\{selling_price\}|Rs\s*\*?\{offer_price\}/gi, `Rs ${activePrice}`)
    .replace(/\*?\[Offer Price\]\*?|\*?\[Selling Price\]\*?|\*?\[Price\]\*?|\{selling_price\}|\{offer_price\}|\{price\}|\{sp\}/gi, String(activePrice))
    .replace(/\[MRP\]|\{mrp\}/gi, String(mrp))
    .replace(/\[Discount %\]|\[Discount\]|\{discount\}/gi, String(discountPercent))
    .replace(/\[Savings\]|\[Save\]|\{savings\}/gi, String(savings))
    .replace(/\[Stock Status\]|\[Stock\]|\{stock_status\}|\{stock_text\}|\{stock\}/gi, stockStatusText)
    .replace(/\[Stock Qty\]|\[Stock Quantity\]|\{stock_qty\}|\{stock_quantity\}/gi, stockQtyText)
    .replace(/\[Store Name\]|\{store_name\}|\{store\}/gi, finalStoreName)
    .replace(/\[Address\]|\[Store Address\]|\{address\}|\{store_address\}/gi, finalAddress)
    .replace(/\[Product Link\]|\[Link\]|\{product_link\}|\{link\}|\{url\}/gi, shareUrl)
    .replace(/\[EAN\]|\[Barcode\]|\{ean\}/gi, cleanEan)
    .replace(/\[Category\]|\{category\}/gi, category);

  return populated.replace(/Rs\s+Rs\s+/gi, 'Rs ');
};

/**
 * Formats the dedicated "Only-Link Paste Auto Caption" template into OpenGraph
 * og:title (Line 1, auto-bolded by WhatsApp) and og:description (Lines 2+, with
 * ~MRP~ converted to genuine Unicode strikethrough M̶R̶P̶ and * removed so WhatsApp
 * never displays literal * or ~ symbols in the link preview card).
 */
export const formatLinkPreviewCaption = (
  template: string | undefined,
  product: Product,
  customPrice?: number | string,
  customStoreName?: string,
  customStoreAddress?: string
): { ogTitle: string; ogDescription: string } => {
  const activeTemplate = (template && template.trim()) ? template.trim() : getConfiguredLinkCaptionFormat();
  const populated = formatProductWithTemplate(
    activeTemplate,
    product,
    '',
    customPrice,
    customStoreName,
    customStoreAddress
  );

  const sanitized = populated
    .replace(/~([^~\n]+)~/g, (_, inner) => toUnicodeStrike(inner))
    .replace(/\*/g, '');

  const lines = sanitized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('http://') && !l.startsWith('https://'));

  const productName = String(product.product_name || (product as any).name || 'Munna Grocery Special Offer')
    .replace(/\s+/g, ' ')
    .trim();

  const rawStock = (product as any).stock_qty ?? (product as any).stock ?? 0;
  const stockQty = typeof rawStock === 'number' ? rawStock : parseInt(String(rawStock || '0'), 10) || 0;
  const stockText = stockQty > 0 ? `In Stock (${stockQty}pc)` : 'Out of Stock';

  const ogTitle = lines[0] || productName;
  const ogDescription = lines.slice(1).join(' • ') || `Rs ${customPrice ?? product.selling_price} (${stockText}) • Munna Mobile & Grocery, Cinema Hall Road, Niali`;

  return { ogTitle, ogDescription };
};

export const getProductShareText = (
  product: Product,
  customUrl?: string,
  customPrice?: number | string,
  customTemplate?: string
): string => {
  const activeTemplate = customTemplate || getConfiguredShareFormat();
  return formatProductWithTemplate(activeTemplate, product, customUrl, customPrice);
};

export const handleWhatsAppShare = (product: Product, e?: React.MouseEvent, includeFullText = false) => {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  const sharePayload = includeFullText ? getProductShareText(product) : getDynamicShareUrl(product);

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(sharePayload).catch(() => {});
    }
  } catch {}

  const whatsappAppUrl = `whatsapp://send?text=${encodeURIComponent(sharePayload)}`;
  const whatsappWebUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(sharePayload)}`;

  if (typeof window !== 'undefined') {
    const opened = window.open(whatsappAppUrl, '_blank');
    if (!opened) {
      window.open(whatsappWebUrl, '_blank');
    }
  }
};

export const handleShareProduct = async (product: Product, e?: React.MouseEvent, includeFullText = false) => {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  const shareUrl = getDynamicShareUrl(product);
  const sharePayload = includeFullText ? getProductShareText(product, shareUrl) : shareUrl;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(sharePayload).catch(() => {});
    }
  } catch {}

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(
        includeFullText
          ? { text: sharePayload }
          : { url: shareUrl }
      );
      return;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
    }
  }

  handleWhatsAppShare(product, undefined, includeFullText);
};
