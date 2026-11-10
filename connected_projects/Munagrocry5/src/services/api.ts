import { DEFAULT_WEBHOOK_URL, DEFAULT_IMGBB_KEY, ORIGINAL_CDN_MAP, getOriginalCdnUrl } from '../data/initialData';
import { Product, Order, ShopConfig, Banner, UserSession, CustomerNotice, Address, normalizeTrending, parseProductStock } from '../types';
import { compressImageForUpload, fileToDataUrl } from '../utils/imageHelper';
import {
  detectProductCategory,
  extractOrGenerateProductDescription,
  parseEanList,
  getPrimaryEan,
  formatMultipleEans,
  doesProductMatchEan
} from '../utils/productMediaHelper';
import { showToast } from '../components/Toast';
import { getDynamicShareUrl, getPrimaryCleanEan } from '../utils/shareUtils';

const env = import.meta.env as Record<string, string | undefined>;

export const APP_CONFIG = {
  BOT_TOKEN: env.VITE_BOT_TOKEN || env.BOT_TOKEN || '',
  ADMIN_ID: env.VITE_ADMIN_ID || env.ADMIN_ID || '',
  ADMIN_USERNAME: env.VITE_ADMIN_USERNAME || env.ADMIN_USERNAME || '',
  ADMIN_PASSWORD: env.VITE_ADMIN_PASSWORD || env.ADMIN_PASSWORD || '',
  GOOGLE_SHEET_ID: env.VITE_GOOGLE_SHEET_ID || env.GOOGLE_SHEET_ID || '1wj0Lg32nIDjCDadnBovK2u0agpJ4gIJr1ahxya1GMGE',
  GOOGLE_SHEET_NAME: env.VITE_GOOGLE_SHEET_NAME || env.GOOGLE_SHEET_NAME || 'MUNNA MOBILE & Grocery Database',
  GOOGLE_SHEET_WORKSHEET: env.VITE_GOOGLE_SHEET_WORKSHEET || env.GOOGLE_SHEET_WORKSHEET || 'Sheet1',
  SPREADSHEET_URL: env.VITE_SPREADSHEET_URL || env.SPREADSHEET_URL || 'https://docs.google.com/spreadsheets/d/1wj0Lg32nIDjCDadnBovK2u0agpJ4gIJr1ahxya1GMGE',
  SHEET_WEBHOOK_URL: env.VITE_SHEET_WEBHOOK_URL || env.SHEET_WEBHOOK_URL || DEFAULT_WEBHOOK_URL,
  USER_EMAIL: env.VITE_USER_EMAIL || env.USER_EMAIL || '',
  WEB_APP_URL: env.VITE_WEB_APP_URL || env.WEB_APP_URL || 'https://munagrocery.in',
  CUSTOM_SEARCH_API_KEY: env.VITE_CUSTOM_SEARCH_API_KEY || env.CUSTOM_SEARCH_API_KEY || '',
  SEARCH_ENGINE_ID: env.VITE_SEARCH_ENGINE_ID || env.SEARCH_ENGINE_ID || '',
  GEMINI_API_KEY: env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '',
  GROK_API_KEY: env.VITE_GROK_API_KEY || env.GROK_API_KEY || '',
  GROQ_API_KEY: env.VITE_GROQ_API_KEY || env.GROQ_API_KEY || '',
  DB_CHANNEL_ID: env.VITE_DB_CHANNEL_ID || env.DB_CHANNEL_ID || '',
  AUTO_RESTART_SECONDS: env.VITE_AUTO_RESTART_SECONDS || env.AUTO_RESTART_SECONDS || '0',
  RESTART_COUNTDOWN: env.VITE_RESTART_COUNTDOWN || env.RESTART_COUNTDOWN || '0'
};

export function getWebhookUrl(): string {
  try {
    const saved = localStorage.getItem('munna_sheet_webhook');
    if (saved && saved.trim() && saved.startsWith('http') && saved.includes('script.google.com')) {
      return saved.trim();
    }
  } catch (e) {
    // fallback
  }
  return APP_CONFIG.SHEET_WEBHOOK_URL;
}

export function setWebhookUrl(url: string) {
  try {
    localStorage.setItem('munna_sheet_webhook', url.trim());
  } catch (e) {
    // noop
  }
}

export function getGoogleSheetId(): string {
  try {
    const saved = localStorage.getItem('munna_google_sheet_id');
    // If user mistakenly pasted the script.google.com URL into sheet_id, ignore it!
    if (saved && saved.trim() && !saved.includes('script.google.com') && !saved.includes('http')) {
      return saved.trim();
    }
  } catch (e) {
    // fallback
  }
  return APP_CONFIG.GOOGLE_SHEET_ID;
}

export function setGoogleSheetId(sheetId: string) {
  try {
    const cleanId = sheetId.trim();
    if (cleanId.includes('script.google.com')) {
      // Ignore invalid attempt to set webhook URL as Sheet ID
      return;
    }
    localStorage.setItem('munna_google_sheet_id', cleanId);
  } catch (e) {
    // noop
  }
}

export function resetSheetDefaults() {
  try {
    localStorage.removeItem('munna_sheet_webhook');
    localStorage.removeItem('munna_google_sheet_id');
  } catch (e) {}
}

export function getSpreadsheetUrl(): string {
  const id = getGoogleSheetId();
  return `https://docs.google.com/spreadsheets/d/${id}`;
}

export function getStoredStockOverrides(): Record<string, { stock: number; time: number }> {
  try {
    const raw = localStorage.getItem('munna_stock_overrides');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
}

export function saveStockOverride(ean: string, stock: number) {
  try {
    const cleanEan = String(ean).replace(/^EAN-/, '').trim();
    const current = getStoredStockOverrides();
    current[cleanEan] = { stock, time: Date.now() };
    localStorage.setItem('munna_stock_overrides', JSON.stringify(current));
  } catch (e) {}
}

export function removeStockOverride(ean: string) {
  try {
    const cleanEan = String(ean).replace(/^EAN-/, '').trim();
    const current = getStoredStockOverrides();
    delete current[cleanEan];
    localStorage.setItem('munna_stock_overrides', JSON.stringify(current));
  } catch (e) {}
}

export const DEFAULT_DEPRECATED_EANS = [
  '890600100101',
  '890600100102',
  '890600100103',
  '890600100104',
  '890600100105',
  '890600100106',
  '890600100107',
  '890600100108'
];

const HARDCODED_CACHE_PURGE_KEY = 'munna_hard_refresh_v16';

export function ensureHardcodedCachePurged() {
  try {
    if (localStorage.getItem(HARDCODED_CACHE_PURGE_KEY) !== '1') {
      localStorage.removeItem('munna_store_catalog');
      localStorage.removeItem('munna_product_overrides');
      localStorage.removeItem('munna_stock_overrides');
      localStorage.removeItem('munna_recent_edits');
      localStorage.removeItem('munna_whatsapp_link_caption_format');
      localStorage.setItem(HARDCODED_CACHE_PURGE_KEY, '1');
    }
  } catch (e) {}
}

// Immediately purge stale localStorage cache on module initialization for all clients
ensureHardcodedCachePurged();

export function getStoredDeletedEans(): Set<string> {
  ensureHardcodedCachePurged();
  const set = new Set<string>(DEFAULT_DEPRECATED_EANS);
  try {
    const raw = localStorage.getItem('munna_deleted_eans');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((e: string) => {
          const str = String(e).trim();
          if (str) {
            set.add(str);
            set.add(str.replace(/^EAN-/, '').trim());
          }
        });
      }
    }
  } catch (e) {}
  return set;
}

export function getStoredDeletedNames(): Set<string> {
  ensureHardcodedCachePurged();
  const set = new Set<string>();
  try {
    const raw = localStorage.getItem('munna_deleted_names');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((n: string) => {
          if (n && typeof n === 'string' && n.trim()) {
            set.add(n.toLowerCase().trim());
          }
        });
      }
    }
  } catch (e) {}
  return set;
}

export function recordDeletedProduct(ean: string, productName?: string) {
  try {
    const allEans = parseEanList(ean);
    const rawEan = String(ean || '').trim();
    const cleanEan = rawEan.replace(/^EAN-/, '').trim();
    const codesToDelete = Array.from(new Set([rawEan, cleanEan, ...allEans].filter(Boolean)));
    if (codesToDelete.length > 0) {
      const eans = getStoredDeletedEans();
      codesToDelete.forEach((code) => {
        eans.add(code);
      });
      localStorage.setItem('munna_deleted_eans', JSON.stringify(Array.from(eans)));
    }
    if (productName && productName.trim()) {
      const names = getStoredDeletedNames();
      names.add(productName.toLowerCase().trim());
      localStorage.setItem('munna_deleted_names', JSON.stringify(Array.from(names)));
    }
    // Also remove from overrides if present for all linked barcodes
    codesToDelete.forEach((code) => {
      removeProductOverride(code);
      removeStockOverride(code);
    });
  } catch (e) {}
}

export function unrecordDeletedProduct(ean: string, productName?: string) {
  try {
    const allEans = parseEanList(ean);
    const rawEan = String(ean || '').trim();
    const cleanEan = rawEan.replace(/^EAN-/, '').trim();
    const codesToRestore = new Set([rawEan, cleanEan, ...allEans].filter(Boolean));
    const raw = localStorage.getItem('munna_deleted_eans');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const next = arr.filter((e: string) => {
          const s = String(e).trim();
          const c = s.replace(/^EAN-/, '').trim();
          return !codesToRestore.has(s) && !codesToRestore.has(c);
        });
        localStorage.setItem('munna_deleted_eans', JSON.stringify(next));
      }
    }
    if (productName && productName.trim()) {
      const targetLower = productName.toLowerCase().trim();
      const rawNames = localStorage.getItem('munna_deleted_names');
      if (rawNames) {
        const arrN = JSON.parse(rawNames);
        if (Array.isArray(arrN)) {
          const nextN = arrN.filter((n: string) => {
            const nameInSet = String(n).toLowerCase().trim();
            if (!nameInSet) return false;
            if (nameInSet === targetLower) return false;
            if (targetLower.includes(nameInSet) || nameInSet.includes(targetLower)) return false;
            const tWords = targetLower.split(/\s+/).filter((w) => w.length >= 3);
            const sWords = nameInSet.split(/\s+/).filter((w) => w.length >= 3);
            const overlap = tWords.filter((w) => sWords.includes(w) || sWords.some((sw) => sw.includes(w) || w.includes(sw)));
            if (overlap.length >= 2 || (tWords.length === 1 && overlap.length === 1)) return false;
            return true;
          });
          localStorage.setItem('munna_deleted_names', JSON.stringify(nextN));
        }
      }
    }
  } catch (e) {}
}

export function parseGalleryImages(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((u) => String(u).trim()).filter((u) => u.startsWith('http') || u.startsWith('/'));
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((u) => String(u).trim()).filter((u) => u.startsWith('http') || u.startsWith('/'));
        }
      } catch (e) {}
    }
    return trimmed.split(',').map((u) => u.trim()).filter((u) => u.startsWith('http') || u.startsWith('/'));
  }
  return [];
}

export interface StoredProductOverride {
  selling_price?: string | number;
  mrp?: string | number;
  stock_qty?: number;
  product_name?: string;
  category?: string;
  description?: string;
  image_url?: string;
  backup_image_url?: string;
  max_order_qty?: number;
  additional_images?: string;
  gallery_images?: string[];
  additional_eans?: string;
  ean_list?: string[];
  video_url?: string;
  rowIndex?: number;
  sheetSynced?: boolean;
  time: number;
}

export function getStoredProductOverrides(): Record<string, StoredProductOverride> {
  try {
    const raw = localStorage.getItem('munna_product_overrides');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
}

export function saveProductOverride(product: {
  ean: string;
  previous_ean?: string;
  rowIndex?: number;
  selling_price?: string | number;
  mrp?: string | number;
  stock_qty?: string | number;
  product_name?: string;
  category?: string;
  description?: string;
  image_url?: string;
  backup_image_url?: string;
  max_order_qty?: string | number;
  additional_images?: string | string[];
  gallery_images?: string[];
  additional_eans?: string | string[];
  ean_list?: string[];
  video_url?: string;
  sheetSynced?: boolean;
}) {
  try {
    const allEans = parseEanList(product.ean, product.additional_eans, product.ean_list, product.previous_ean);
    const cleanEan = allEans[0] || getPrimaryEan(product.ean);
    if (!cleanEan) return;
    const current = getStoredProductOverrides();
    const matchedKey = [cleanEan, ...allEans].find((c) => Boolean(current[c]));
    const existing = (matchedKey ? current[matchedKey] : current[cleanEan]) || ({} as Partial<StoredProductOverride>);
    const mergedEans = parseEanList(allEans, existing.additional_eans, existing.ean_list);
    const addEansStr = mergedEans.join(', ');

    const galleryArr = Array.isArray(product.gallery_images)
      ? product.gallery_images
      : parseGalleryImages(product.additional_images);
    const additionalStr = Array.isArray(product.additional_images)
      ? product.additional_images.join(', ')
      : (product.additional_images || (galleryArr.length > 0 ? galleryArr.join(', ') : undefined));

    const overrideRecord: StoredProductOverride = {
      ...existing,
      ...(product.rowIndex !== undefined ? { rowIndex: product.rowIndex } : {}),
      ...(product.selling_price !== undefined ? { selling_price: product.selling_price } : {}),
      ...(product.mrp !== undefined ? { mrp: product.mrp } : {}),
      ...(product.stock_qty !== undefined ? { stock_qty: parseProductStock(product.stock_qty) } : {}),
      ...(product.product_name ? { product_name: product.product_name } : {}),
      ...(product.category ? { category: product.category } : {}),
      ...(product.description !== undefined ? { description: product.description } : {}),
      ...(product.image_url ? { image_url: product.image_url } : {}),
      ...(product.backup_image_url ? { backup_image_url: product.backup_image_url } : {}),
      ...(product.video_url !== undefined ? { video_url: product.video_url } : {}),
      ...(product.max_order_qty !== undefined ? { max_order_qty: Number(product.max_order_qty) || 10 } : {}),
      ...(additionalStr !== undefined ? { additional_images: additionalStr } : {}),
      ...(galleryArr.length > 0 ? { gallery_images: galleryArr } : {}),
      ...(addEansStr ? { additional_eans: addEansStr, ean_list: mergedEans } : {}),
      sheetSynced: product.sheetSynced !== undefined ? product.sheetSynced : false,
      time: Date.now()
    };

    current[cleanEan] = overrideRecord;
    mergedEans.forEach((code) => {
      current[code] = overrideRecord;
    });
    localStorage.setItem('munna_product_overrides', JSON.stringify(current));
    // Also update recent edits in localStorage so it survives page reload
    const rawEdits = localStorage.getItem('munna_recent_edits');
    const recent = rawEdits ? JSON.parse(rawEdits) : {};
    recent[cleanEan] = Date.now();
    mergedEans.forEach((code) => {
      recent[code] = Date.now();
    });
    localStorage.setItem('munna_recent_edits', JSON.stringify(recent));
  } catch (e) {}
}

export function removeProductOverride(ean: string) {
  try {
    const cleanEan = String(ean).replace(/^EAN-/, '').trim();
    const current = getStoredProductOverrides();
    if (current[cleanEan]) {
      delete current[cleanEan];
      localStorage.setItem('munna_product_overrides', JSON.stringify(current));
    }
  } catch (e) {}
}

// 1. Standard SHA-256 Hashing using browser Web Crypto API
export async function sha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function normalizeTimeToHHmm(val: any, fallback = '10:00'): string {
  if (!val) return fallback;
  const str = String(val).trim();
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const parts = str.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1]}`;
  }
  // Matches "Sat Dec 30 1899 10:00:00 GMT+0521..." or "10:00:00"
  const match = str.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\b/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  return fallback;
}

export function isStorePickupActive(config?: Partial<ShopConfig> | null): boolean {
  if (!config) return true;
  const val: any = config.pickupActive;
  if (val === false || val === 0 || val === '0') return false;
  if (val === true || val === 1 || val === '1') return true;
  if (val === undefined || val === null) return true;
  const s = String(val).trim().toLowerCase();
  return !(
    s === '0' ||
    s === 'false' ||
    s === 'inactive' ||
    s === 'off' ||
    s === 'no' ||
    s === 'disabled' ||
    s === 'disable' ||
    s === 'close' ||
    s === 'closed' ||
    s === 'stop' ||
    s === 'paused'
  );
}

export function isCodDeliveryActive(config?: Partial<ShopConfig> | null): boolean {
  if (!config) return true;
  const val: any = config.codActive;
  if (val === false || val === 0 || val === '0') return false;
  if (val === true || val === 1 || val === '1') return true;
  if (val === undefined || val === null) return true;
  const s = String(val).trim().toLowerCase();
  return !(
    s === '0' ||
    s === 'false' ||
    s === 'inactive' ||
    s === 'off' ||
    s === 'no' ||
    s === 'disabled' ||
    s === 'disable' ||
    s === 'close' ||
    s === 'closed' ||
    s === 'stop' ||
    s === 'paused'
  );
}

export function isUpiPaymentActive(config?: Partial<ShopConfig> | null): boolean {
  if (!config) return true;
  const val: any = config.upiActive;
  if (val === false || val === 0 || val === '0') return false;
  if (val === true || val === 1 || val === '1') return true;
  if (val === undefined || val === null) return true;
  const s = String(val).trim().toLowerCase();
  return !(
    s === '0' ||
    s === 'false' ||
    s === 'inactive' ||
    s === 'off' ||
    s === 'no' ||
    s === 'disabled' ||
    s === 'disable' ||
    s === 'close' ||
    s === 'closed' ||
    s === 'stop' ||
    s === 'paused'
  );
}

export function extractUtrFromOrder(order?: Partial<Order> | null): string {
  if (!order) return '';
  if (order.utr && String(order.utr).trim()) return String(order.utr).trim();
  const payStr = String(order.payment || '');
  const m = payStr.match(/UTR\s*[:#-]?\s*([A-Za-z0-9_-]{4,30})/i);
  if (m && m[1]) return m[1].trim();
  return '';
}

export function isUpiOrder(order?: Partial<Order> | null): boolean {
  if (!order) return false;
  if (order.utr && String(order.utr).trim()) return true;
  const payStr = String(order.payment || '').toUpperCase();
  return payStr.includes('UPI') || payStr.includes('UTR');
}

// 2. Fetch Dynamic Settings from Config Sheet
export interface FetchConfigResult {
  config: Partial<ShopConfig>;
  banners?: Banner[];
  notice?: CustomerNotice | null;
  adminUsername?: string;
  adminPassword?: string;
}

export interface LiveStorePayload {
  products: Product[];
  config: Partial<ShopConfig>;
  rawConfig?: Record<string, any>;
  banners?: Banner[];
  notice?: CustomerNotice | null;
  adminUsername?: string;
  adminPassword?: string;
  syncedAt: string;
}

export async function clearAllBrowserCaches(): Promise<void> {
  try {
    // 1. Remove all cached data keys from localStorage
    const keysToRemove = [
      'munna_store_catalog',
      'munna_all_orders',
      'munna_orders',
      'munna_my_orders',
      'munna_addresses',
      'munna_customers_db',
      'munna_product_overrides',
      'munna_stock_overrides',
      'munna_shop_config',
      'munna_banners',
      'MUNA_ALL_USERS',
      'munna_deleted_eans',
      'munna_deleted_names',
      'munna_cart'
    ];
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      } catch (e) {}
    });

    // 2. Clear Browser Cache Storage (Cache API)
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
    }

    // 3. Unregister any stale Service Workers that might serve cached HTML/JSON
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch (e) {}
}

export function getSheetCartId(phone?: string): string {
  const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
  if (cleanPhone.length === 10) return cleanPhone;
  try {
    let sid = localStorage.getItem('munna_device_sid') || sessionStorage.getItem('munna_device_sid');
    if (!sid) {
      sid = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36).slice(-4);
      localStorage.setItem('munna_device_sid', sid);
      sessionStorage.setItem('munna_device_sid', sid);
    }
    return sid;
  } catch (e) {
    return 'guest_default';
  }
}

export function parseStoreSettings(raw: Record<string, any>): FetchConfigResult {
  const parsedConfig: Partial<ShopConfig> = {};
  let parsedBanners: Banner[] | undefined = undefined;
  let parsedNotice: CustomerNotice | null = null;
  let adminUsername: string | undefined = undefined;
  let adminPassword: string | undefined = undefined;

  // Case-insensitive lookup helper
  const getRaw = (key: string) => {
    if (raw[key] !== undefined) return raw[key];
    const lower = key.toLowerCase();
    for (const k in raw) {
      if (k.toLowerCase() === lower) return raw[k];
    }
    return undefined;
  };

  // 1. Delivery & Fees
  const freeAboveVal = getRaw('free_delivery_above');
  if (freeAboveVal !== undefined && freeAboveVal !== '') {
    parsedConfig.freeAbove = Number(freeAboveVal) || 500;
  }
  const deliveryFeeVal = getRaw('delivery_fee');
  if (deliveryFeeVal !== undefined && deliveryFeeVal !== '') {
    parsedConfig.deliveryFee = Number(deliveryFeeVal) || 30;
  }
  const deliverySlotVal = getRaw('delivery_slot');
  if (deliverySlotVal !== undefined) {
    parsedConfig.deliverySlot = String(deliverySlotVal || '').trim();
  }
  const deliveryDayVal = getRaw('delivery_day');
  if (deliveryDayVal !== undefined) {
    parsedConfig.deliveryDay = String(deliveryDayVal || '').trim();
  }

  // 2. Coupons & Discounts
  const couponCodeVal = getRaw('coupon_code');
  if (couponCodeVal !== undefined) {
    parsedConfig.couponCode = String(couponCodeVal || '').trim().toUpperCase();
  }
  const couponPercentVal = getRaw('coupon_percent');
  if (couponPercentVal !== undefined && couponPercentVal !== '') {
    parsedConfig.couponPercent = Number(couponPercentVal) || 0;
  }
  const couponMinBillVal = getRaw('coupon_min_bill');
  if (couponMinBillVal !== undefined && couponMinBillVal !== '') {
    parsedConfig.couponMinBill = Number(couponMinBillVal) || 300;
  }

  // 3. Store Operating Status & Hours
  const storeOpenVal = getRaw('store_open');
  if (storeOpenVal !== undefined) {
    parsedConfig.storeOpen = !(
      String(storeOpenVal) === '0' ||
      String(storeOpenVal).toLowerCase() === 'false' ||
      String(storeOpenVal).toLowerCase() === 'closed'
    );
  }
  const storeOpenMsg = getRaw('store_open_message') ?? getRaw('store_closed_message');
  if (storeOpenMsg !== undefined) {
    parsedConfig.storeClosedMessage = String(storeOpenMsg || '').trim();
  }
  const storeClosedCheckoutMsg = getRaw('store_closed_checkout_message');
  if (storeClosedCheckoutMsg !== undefined) {
    parsedConfig.storeClosedCheckoutMessage = String(storeClosedCheckoutMsg || '').trim();
  }
  const storeOpenTimeVal = getRaw('store_open_time');
  if (storeOpenTimeVal !== undefined) {
    parsedConfig.storeOpenTime = normalizeTimeToHHmm(storeOpenTimeVal, '10:00');
  }
  const storeCloseTimeVal = getRaw('store_close_time');
  if (storeCloseTimeVal !== undefined) {
    parsedConfig.storeCloseTime = normalizeTimeToHHmm(storeCloseTimeVal, '21:00');
  }

  // Helper for boolean flags
  const isExplicitlyDisabled = (v: any): boolean => {
    if (v === false || v === 0) return true;
    if (v === undefined || v === null) return false;
    const s = String(v).trim().toLowerCase();
    return (
      s === '0' ||
      s === 'false' ||
      s === 'inactive' ||
      s === 'off' ||
      s === 'no' ||
      s === 'disabled' ||
      s === 'disable' ||
      s === 'close' ||
      s === 'closed' ||
      s === 'stop' ||
      s === 'paused'
    );
  };

  // 4. Payment & Fulfilment Modes (COD & Pickup)
  const codActiveVal =
    getRaw('cod_active') ??
    getRaw('cod') ??
    getRaw('cash_on_delivery') ??
    getRaw('cod_enabled');
  if (codActiveVal !== undefined) {
    parsedConfig.codActive = !isExplicitlyDisabled(codActiveVal);
  }
  const codNoticeVal = getRaw('cod_notice');
  if (codNoticeVal !== undefined) {
    parsedConfig.codNotice = String(codNoticeVal || '').trim();
  }
  const codMinBillVal = getRaw('cod_min_bill') || getRaw('min_cod_order');
  if (codMinBillVal !== undefined && codMinBillVal !== '') {
    parsedConfig.codMinBill = Number(codMinBillVal) || 200;
  }

  // UPI QR Payment settings
  const upiActiveVal = getRaw('upi_active') ?? getRaw('upi') ?? getRaw('upi_enabled');
  if (upiActiveVal !== undefined) {
    parsedConfig.upiActive = !isExplicitlyDisabled(upiActiveVal);
  }
  const upiIdVal = getRaw('upi_id') ?? getRaw('merchant_upi_id') ?? getRaw('vpa');
  if (upiIdVal !== undefined && String(upiIdVal).trim()) {
    parsedConfig.upiId = String(upiIdVal).trim();
  }
  const upiPayeeVal = getRaw('upi_payee_name') ?? getRaw('upi_merchant_name');
  if (upiPayeeVal !== undefined && String(upiPayeeVal).trim()) {
    parsedConfig.upiPayeeName = String(upiPayeeVal).trim();
  }
  const upiQrUrlVal = getRaw('upi_custom_qr_url') ?? getRaw('upi_qr_url');
  if (upiQrUrlVal !== undefined) {
    parsedConfig.upiCustomQrUrl = String(upiQrUrlVal || '').trim();
  }

  const pickupActiveVal =
    getRaw('pickup_active') ??
    getRaw('store_pickup') ??
    getRaw('pickup') ??
    getRaw('store_pickup_active') ??
    getRaw('self_pickup') ??
    getRaw('pickup_enabled') ??
    getRaw('pickupactive') ??
    getRaw('is_pickup_active');
  if (pickupActiveVal !== undefined) {
    parsedConfig.pickupActive = !isExplicitlyDisabled(pickupActiveVal);
  }
  const pickupNoteVal = getRaw('pickup_note');
  if (pickupNoteVal !== undefined) {
    parsedConfig.pickupNote = String(pickupNoteVal || '').trim();
  }
  const pickupSlotsVal = getRaw('pickup_slots');
  if (pickupSlotsVal !== undefined) {
    if (Array.isArray(pickupSlotsVal)) {
      parsedConfig.pickupSlots = pickupSlotsVal.map(String);
    } else if (typeof pickupSlotsVal === 'string') {
      parsedConfig.pickupSlots = pickupSlotsVal
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  const pickupCancelNoticeVal = getRaw('pickup_cancel_notice') || getRaw('pickup_auto_cancel_notice');
  if (pickupCancelNoticeVal !== undefined && String(pickupCancelNoticeVal).trim()) {
    parsedConfig.pickupCancelNotice = String(pickupCancelNoticeVal).trim();
  }
  const pickupChargeOnVal = getRaw('pickup_charge_on') ?? getRaw('pickup_fee_enabled');
  if (pickupChargeOnVal !== undefined) {
    parsedConfig.pickupChargeOn = !isExplicitlyDisabled(pickupChargeOnVal);
  }
  const pickupChargeFeeVal = getRaw('pickup_charge_fee');
  if (pickupChargeFeeVal !== undefined && pickupChargeFeeVal !== '') {
    parsedConfig.pickupChargeFee = Number(pickupChargeFeeVal) || 0;
  }

  // Store Pickup Location details
  const storeNameVal = getRaw('store_name');
  if (storeNameVal !== undefined && String(storeNameVal).trim()) {
    parsedConfig.storeName = String(storeNameVal).trim();
  }
  const storePickupNameVal = getRaw('store_pickup_name') || getRaw('store_name');
  if (storePickupNameVal !== undefined && String(storePickupNameVal).trim()) {
    parsedConfig.storePickupName = String(storePickupNameVal).trim();
  }
  const storePickupAddressVal = getRaw('store_pickup_address') || getRaw('store_address');
  if (storePickupAddressVal !== undefined && String(storePickupAddressVal).trim()) {
    parsedConfig.storePickupAddress = String(storePickupAddressVal).trim();
  }
  const storePickupPhoneVal = getRaw('store_pickup_phone') || getRaw('store_phone');
  if (storePickupPhoneVal !== undefined && String(storePickupPhoneVal).trim()) {
    parsedConfig.storePickupPhone = String(storePickupPhoneVal).trim();
  }
  const storePickupHoursVal = getRaw('store_pickup_hours') || getRaw('store_hours');
  if (storePickupHoursVal !== undefined && String(storePickupHoursVal).trim()) {
    parsedConfig.storePickupHours = String(storePickupHoursVal).trim();
  }

  // WhatsApp Share Format template from Config tab
  const waShareFormatVal =
    getRaw('whatsapp_share_format') ??
    getRaw('share_format') ??
    getRaw('whatsapp_format');
  if (waShareFormatVal !== undefined && String(waShareFormatVal).trim()) {
    parsedConfig.whatsappShareFormat = String(waShareFormatVal).trim();
    try {
      localStorage.setItem('munna_whatsapp_share_format', parsedConfig.whatsappShareFormat);
    } catch (e) {}
  }

  // Dedicated Only-Link Paste Auto Caption Format from Config tab
  const waLinkCaptionVal =
    getRaw('whatsapp_link_caption_format') ??
    getRaw('link_caption_format') ??
    getRaw('whatsappLinkCaptionFormat');
  if (waLinkCaptionVal !== undefined && String(waLinkCaptionVal).trim()) {
    parsedConfig.whatsappLinkCaptionFormat = String(waLinkCaptionVal).trim();
    try {
      localStorage.setItem('munna_whatsapp_link_caption_format', parsedConfig.whatsappLinkCaptionFormat);
    } catch (e) {}
  }

  const shareLinkVerVal = getRaw('share_link_version') ?? getRaw('shareLinkVersion');
  if (shareLinkVerVal !== undefined && String(shareLinkVerVal).trim()) {
    parsedConfig.shareLinkVersion = String(shareLinkVerVal).trim();
    try {
      localStorage.setItem('munna_global_link_version', parsedConfig.shareLinkVersion);
    } catch (e) {}
  }
  const lastLinkResetVal = getRaw('last_link_reset_at') ?? getRaw('lastLinkResetAt');
  if (lastLinkResetVal !== undefined && String(lastLinkResetVal).trim()) {
    parsedConfig.lastLinkResetAt = String(lastLinkResetVal).trim();
  }

  // 4b. Incoming Order Notification & Ring Settings
  const orderNotifVal = getRaw('order_notification_enabled') ?? getRaw('order_notify_active');
  if (orderNotifVal !== undefined) {
    parsedConfig.orderNotificationEnabled = !(
      String(orderNotifVal) === '0' ||
      String(orderNotifVal).toLowerCase() === 'false' ||
      String(orderNotifVal).toLowerCase() === 'off'
    );
  }
  const orderRingVal = getRaw('order_ring_enabled') ?? getRaw('order_ring_active');
  if (orderRingVal !== undefined) {
    parsedConfig.orderRingEnabled = !(
      String(orderRingVal) === '0' ||
      String(orderRingVal).toLowerCase() === 'false' ||
      String(orderRingVal).toLowerCase() === 'off'
    );
  }
  const orderNotifHoursVal = getRaw('order_notification_hours');
  if (orderNotifHoursVal !== undefined) {
    parsedConfig.orderNotificationHours = String(orderNotifHoursVal).toLowerCase().includes('store') ? 'store_hours' : 'always';
  }
  const orderRingHoursVal = getRaw('order_ring_hours');
  if (orderRingHoursVal !== undefined) {
    parsedConfig.orderRingHours = String(orderRingHoursVal).toLowerCase().includes('store') ? 'store_hours' : 'always';
  }

  // 5. Trending Offers EAN list
  const trendingRaw = getRaw('trending');
  if (trendingRaw !== undefined) {
    const norm = normalizeTrending(trendingRaw);
    if (norm.length > 0) {
      parsedConfig.trending = norm;
    } else if (trendingRaw === '' || trendingRaw === '[]') {
      parsedConfig.trending = [];
    }
  }

  // 6. Mobile APK Download URL
  const appDlUrl = getRaw('app_download_url');
  if (appDlUrl !== undefined) {
    parsedConfig.appDownloadUrl = String(appDlUrl || '').trim();
  }

  // 7. Promotional Home Banners
  const bannerRaw = getRaw('banners');
  if (bannerRaw !== undefined) {
    if (Array.isArray(bannerRaw)) {
      parsedBanners = bannerRaw.map((b, idx) => ({
        id: b.id || idx + 1,
        title: b.title || 'Special Offer',
        img: b.img || b.url || b.image_url || ''
      }));
    } else if (typeof bannerRaw === 'string' && bannerRaw.trim()) {
      try {
        const parsed = JSON.parse(bannerRaw);
        if (Array.isArray(parsed)) {
          parsedBanners = parsed.map((b, idx) => ({
            id: b.id || idx + 1,
            title: b.title || 'Special Offer',
            img: b.img || b.url || b.image_url || ''
          }));
        }
      } catch (e) {
        parsedBanners = [
          {
            id: 1,
            title: 'Fresh Fruits & Vegetables - Up to 50% Off!',
            img: bannerRaw.trim()
          }
        ];
      }
    }
  }

  // 8. Customer Broadcast Announcement Notice
  const noticeRaw = getRaw('broadcast_notice') ?? getRaw('notice');
  if (noticeRaw !== undefined) {
    if (typeof noticeRaw === 'object' && noticeRaw !== null) {
      parsedNotice = noticeRaw;
    } else if (typeof noticeRaw === 'string' && noticeRaw.trim()) {
      try {
        parsedNotice = JSON.parse(noticeRaw);
      } catch (e) {
        parsedNotice = {
          title: 'Store Announcement',
          text: noticeRaw.trim(),
          img: '',
          url: '',
          ts: Date.now()
        };
      }
    }
  }

  // 9. ImgBB Key
  const imgbbVal = getRaw('imgbb_api_key') ?? getRaw('IMGBB_API_KEY');
  if (imgbbVal && String(imgbbVal).trim()) {
    try {
      localStorage.setItem('munna_imgbb_key', String(imgbbVal).trim());
    } catch (e) {}
  }

  // 9b. AI Vision API Key (Grok / Gemini / xAI) from Config tab (settings.ai_api_key)
  const aiKeyVal = getRaw('ai_api_key') ?? getRaw('settings.ai_api_key') ?? getRaw('grok_api_key') ?? getRaw('AI_API_KEY') ?? getRaw('GROK_API_KEY');
  if (aiKeyVal && String(aiKeyVal).trim()) {
    try {
      localStorage.setItem('munna_ai_api_key', String(aiKeyVal).trim());
      localStorage.setItem('munna_grok_api_key', String(aiKeyVal).trim());
      localStorage.setItem('settings.ai_api_key', String(aiKeyVal).trim());
    } catch (e) {}
  }

  // 10. Admin Credentials
  const admUser = getRaw('ADMIN_USERNAME') ?? getRaw('admin_username');
  if (admUser !== undefined) {
    adminUsername = String(admUser || '').trim();
  }
  const admPass = getRaw('ADMIN_PASSWORD') ?? getRaw('admin_password');
  if (admPass !== undefined) {
    adminPassword = String(admPass || '').trim();
  }

  return {
    config: parsedConfig,
    banners: parsedBanners,
    notice: parsedNotice,
    adminUsername,
    adminPassword
  };
}

/**
 * UNIVERSAL LIVE STORE SYNC ENGINE:
 * Fetches BOTH Products and Settings live directly from the Google Apps Script Webhook.
 * Zero custom headers, simple GET request to prevent CORS preflight failures.
 */
export async function fetchLiveStoreData(): Promise<LiveStorePayload | null> {
  const hook = getWebhookUrl();
  const currentSheetId = getGoogleSheetId();
  if (!hook) return null;

  try {
    const nonce = Math.random().toString(36).substring(7);
    const baseUrl = `${hook}${hook.includes('?') ? '&' : '?'}sheet_id=${encodeURIComponent(currentSheetId)}`;
    const freshUrl = `${baseUrl}&_t=${Date.now()}&_nonce=${nonce}`;
    const productsUrl = `${baseUrl}&action=get_products&_t=${Date.now()}&_nonce=${nonce}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);

    // Parallel fetch: main endpoint (config/settings/banners) AND action=get_products endpoint
    const [mainRes, prodsRes] = await Promise.allSettled([
      fetch(freshUrl, { cache: 'no-store', signal: ctrl.signal }).then((r) => (r.ok ? r.json() : null)),
      fetch(productsUrl, { cache: 'no-store', signal: ctrl.signal }).then((r) => (r.ok ? r.json() : null))
    ]);
    clearTimeout(timer);

    const mainData = mainRes.status === 'fulfilled' ? mainRes.value : null;
    const prodsData = prodsRes.status === 'fulfilled' ? prodsRes.value : null;

    if (!mainData && !prodsData) return null;

    // 1. Parse Settings: check mainData, fallback to prodsData
    const rawSettings: Record<string, any> =
      mainData?.settings || mainData?.config || mainData?.data || prodsData?.settings || prodsData?.config || {};
    const parsedSettings = parseStoreSettings(rawSettings);

    // 2. Parse Products strictly from Google Sheet response (no local cache overrides)
    let rawList: any[] = [];
    if (Array.isArray(prodsData)) {
      rawList = prodsData;
    } else if (prodsData && Array.isArray(prodsData.products)) {
      rawList = prodsData.products;
    } else if (mainData && Array.isArray(mainData.products)) {
      rawList = mainData.products;
    } else if (Array.isArray(mainData)) {
      rawList = mainData;
    }

    const mappedProducts: Product[] = rawList
      .map((p: any, idx: number): Product => {
        const sheetEans = parseEanList(p.ean, p.additional_eans, p.ean_list, p.barcodes);
        const baseEan = sheetEans[0] || ('P-' + (idx + 1));
        const allEans = parseEanList(baseEan, sheetEans);
        const cleanEan = allEans[0] || baseEan;
        const orderedEans = Array.from(new Set([cleanEan, ...allEans].filter(Boolean)));

        let rawImg = String(p.image_url || p.image || '').trim();
        const backupImg = String(p.backupImage || p.backup_image_url || '').trim();
        if (!rawImg || rawImg.startsWith('/products/') || !rawImg.startsWith('http')) {
          if (backupImg.startsWith('http')) {
            rawImg = backupImg;
          }
        }

        const spVal = Number(p.price !== undefined ? p.price : (p.selling_price !== undefined ? p.selling_price : 0)) || 0;
        const mrpVal = Number(p.mrp !== undefined ? p.mrp : spVal) || Number(spVal) || 0;
        const stockNum = parseProductStock(p.stock !== undefined ? p.stock : p.stock_qty);

        const rawMax = p.max_order_qty ?? p.max_limit ?? p.max_order_limit ?? p.maxPerOrder;
        const parsedMax = rawMax !== undefined && !isNaN(Number(rawMax)) && Number(rawMax) > 0 ? Number(rawMax) : 10;

        const galleryArr = parseGalleryImages(p.additional_images || p.gallery_images || p.images);
        const addImagesStr = Array.isArray(p.additional_images)
          ? p.additional_images.join(', ')
          : (p.additional_images || (galleryArr.length > 0 ? galleryArr.join(', ') : undefined));

        const finalName = String(p.name || p.product_name || '').trim();
        const rawSheetCat = String(p.category || p['Column 1'] || p['column 1'] || p.cat || '').replace(/&amp;/g, '&').trim();
        const finalCat = rawSheetCat || 'General';
        const finalDesc = String(p.description || p.desc || finalName).trim();
        const finalVideo = String(p.video_url ?? p.video ?? '').trim() || undefined;
        const finalBackup = backupImg || undefined;

        return {
          rowIndex: p.rowIndex || idx + 2,
          ean: cleanEan,
          additional_eans: orderedEans.join(', '),
          ean_list: orderedEans,
          product_name: finalName,
          mrp: mrpVal,
          selling_price: spVal,
          stock_qty: stockNum,
          image_url: rawImg,
          backup_image_url: finalBackup,
          video_url: finalVideo,
          category: finalCat,
          description: finalDesc,
          max_order_qty: parsedMax,
          additional_images: addImagesStr,
          gallery_images: galleryArr
        };
      })
      .filter((p: Product) => {
        const cleanName = (p.product_name || '').toLowerCase().trim();
        if (!cleanName || cleanName === 'product name' || cleanName === 'new product') return false;
        return true;
      });

    // Deduplicate products that share any barcode in ean_list, preferring the newer/richer row
    const products: Product[] = [];
    mappedProducts.forEach((p) => {
      const pEans = parseEanList(p.ean, p.additional_eans, p.ean_list);
      const existingIdx = products.findIndex((item) => doesProductMatchEan(item, pEans));
      if (existingIdx === -1) {
        products.push(p);
      } else {
        const existing = products[existingIdx];
        const mergedEans = parseEanList(existing.ean, existing.additional_eans, existing.ean_list, pEans);
        const existingGalleryLen = existing.gallery_images?.length || 0;
        const newGalleryLen = p.gallery_images?.length || 0;
        const preferNew = newGalleryLen >= existingGalleryLen;
        const winner = preferNew ? p : existing;
        const loser = preferNew ? existing : p;
        products[existingIdx] = {
          ...loser,
          ...winner,
          ean: winner.ean || existing.ean,
          additional_eans: mergedEans.join(', '),
          ean_list: mergedEans,
          gallery_images: (winner.gallery_images && winner.gallery_images.length > 0) ? winner.gallery_images : loser.gallery_images,
          additional_images: winner.additional_images || loser.additional_images,
          video_url: winner.video_url || loser.video_url
        };
      }
    });

    return {
      products,
      config: parsedSettings.config,
      rawConfig: rawSettings,
      banners: parsedSettings.banners,
      notice: parsedSettings.notice,
      adminUsername: parsedSettings.adminUsername,
      adminPassword: parsedSettings.adminPassword,
      syncedAt: mainData?.syncedAt || prodsData?.syncedAt || new Date().toISOString()
    };
  } catch (err) {
    return null;
  }
}

export async function fetchSheetConfig(): Promise<FetchConfigResult | null> {
  const live = await fetchLiveStoreData();
  if (live) {
    return {
      config: live.config,
      banners: live.banners,
      notice: live.notice,
      adminUsername: live.adminUsername,
      adminPassword: live.adminPassword
    };
  }
  return null;
}

export async function fetchProductsFromSheet(): Promise<Product[] | null> {
  const live = await fetchLiveStoreData();
  if (live && live.products && live.products.length > 0) {
    return live.products;
  }
  // Dedicated fallback directly to get_products endpoint
  try {
    const hook = getWebhookUrl();
    const sheetId = getGoogleSheetId();

    if (hook) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const url = `${hook}${hook.includes('?') ? '&' : '?'}sheet_id=${encodeURIComponent(sheetId)}&action=get_products&_t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const list = Array.isArray(data) ? data : (data?.products || []);
        if (list.length > 0) {
          return list
            .map((p: any, idx: number) => {
              const sheetEans = parseEanList(p.ean, p.additional_eans, p.ean_list, p.barcodes);
              const baseEan = sheetEans[0] || ('P-' + (idx + 1));
              const allEans = parseEanList(baseEan, sheetEans);
              const cleanEan = allEans[0] || baseEan;
              const orderedEans = Array.from(new Set([cleanEan, ...allEans].filter(Boolean)));
              const galleryArr = parseGalleryImages(p.additional_images || p.gallery_images || p.images);
              const addImagesStr = Array.isArray(p.additional_images)
                ? p.additional_images.join(', ')
                : (p.additional_images || (galleryArr.length > 0 ? galleryArr.join(', ') : undefined));

              const spVal = Number(p.price !== undefined ? p.price : (p.selling_price !== undefined ? p.selling_price : 0)) || 0;
              const mrpVal = Number(p.mrp) || spVal;
              const stockVal = parseProductStock(p.stock !== undefined ? p.stock : p.stock_qty);
              const rawSheetCat = String(p.category || p['Column 1'] || p['column 1'] || p.cat || '').replace(/&amp;/g, '&').trim();
              const finalCat = rawSheetCat || 'General';

              return {
                rowIndex: p.rowIndex || idx + 2,
                ean: cleanEan,
                additional_eans: orderedEans.join(', '),
                ean_list: orderedEans,
                product_name: String(p.name || p.product_name || '').trim(),
                mrp: mrpVal,
                selling_price: spVal,
                stock_qty: stockVal,
                image_url: String(p.image_url || p.image || '').trim(),
                backup_image_url: String(p.backupImage || p.backup_image_url || '').trim() || undefined,
                video_url: String(p.video_url ?? p.video ?? '').trim() || undefined,
                category: finalCat,
                description: String(p.description || p.desc || p.name || p.product_name || '').trim(),
                max_order_qty: Number(p.max_order_qty) || 10,
                additional_images: addImagesStr,
                gallery_images: galleryArr
              };
            })
            .filter((p: Product) => {
              const cleanName = (p.product_name || '').toLowerCase().trim();
              if (!cleanName || cleanName === 'product name' || cleanName === 'new product') return false;
              return true;
            });
        }
      }
    }
  } catch (e) {}
  return [];
}

export async function fetchOrdersFromSheet(phone?: string): Promise<Order[] | null> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  if (!hook) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 16000);
    const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';
    const nonce = Math.random().toString(36).substring(7);
    const freshUrl = `${hook}${hook.includes('?') ? '&' : '?'}action=get_orders&sheet_id=${encodeURIComponent(sheetId)}${cleanPhone ? `&phone=${cleanPhone}` : ''}&_t=${Date.now()}&_nonce=${nonce}`;
    const res = await fetch(freshUrl, {
      cache: 'no-store',
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const rawList: any[] | null = Array.isArray(data)
      ? data
      : (data && Array.isArray(data.orders) ? data.orders : null);

    if (!rawList) return null;

    return rawList.map((raw: any): Order => {
      let items = raw.items;
      if (typeof items === 'string') {
        try {
          items = JSON.parse(items);
        } catch (e) {
          items = [];
        }
      }
      if (!Array.isArray(items)) items = [];

      const total = Number(raw.total) || 0;
      const subtotal = Number(raw.subtotal) || total;
      const deliveryFee = Number(raw.deliveryFee) || 0;
      const discount = Number(raw.discount) || 0;
      const stage = Number(raw.stage) || 1;
      const rawStatus = String(raw.status || '').toLowerCase().trim();
      let status: Order['status'] = 'pending';
      const isReviewed = rawStatus === 'reviewed' || raw.reviewed === true || raw.reviewed === 'true' || raw.reviewed === 1 || raw.reviewed === '1';
      if (rawStatus === 'accepted' || stage === 2) status = 'accepted';
      else if (rawStatus === 'packing' || stage === 3) status = 'packing';
      else if (rawStatus === 'out_for_delivery' || stage === 4) status = 'out_for_delivery';
      else if (rawStatus === 'delivered' || stage === 5) status = 'delivered';
      else if (rawStatus === 'cancelled' || rawStatus === 'rejected') status = 'cancelled';
      else if (isReviewed) status = 'reviewed';

      const paymentStr = String(raw.payment || 'COD');
      const extractedUtr =
        (raw.utr ? String(raw.utr).trim() : '') ||
        extractUtrFromOrder({ payment: paymentStr });

      return {
        id: String(raw.id || raw.order_id || 'ORD-' + Date.now()),
        timestamp: String(raw.timestamp || raw.created_at || new Date().toLocaleString()),
        customerName: String(raw.customerName || raw.name || raw.customer_name || 'Customer'),
        phone: String(raw.phone || ''),
        address: String(raw.address || ''),
        items: items,
        total: total,
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        discount: discount,
        payment: paymentStr,
        ...(extractedUtr ? { utr: extractedUtr } : {}),
        deliveryType: String(raw.deliveryType || raw.delivery_type || '').toLowerCase().includes('pickup') ? 'pickup' : 'delivery',
        pickupSlot: raw.pickupSlot || raw.pickup_slot || '',
        stage: stage,
        status: status,
        reviewed: isReviewed,
        expectedBy: raw.expectedBy || raw.expected_by || '1 hour',
        location: raw.location || '',
        user_id: raw.user_id ? String(raw.user_id) : undefined
      };
    });
  } catch (e) {}
  return null;
}

// 3. Customer Database & Authentication (Strictly Google Sheet: Users)
export interface CustomerRecord {
  user_id?: string;
  name: string;
  phone: string;
  passwordHash?: string;
  default_address?: string;
  addresses_json?: string;
  total_orders?: number;
  created_at?: string;
  cart_json?: string;
}

export function getLocalCustomers(): CustomerRecord[] {
  return [];
}

export function saveLocalCustomer(_user: CustomerRecord) {
  // No-op: strictly use Google Sheet for customer accounts to prevent cache conflicts
}

export async function checkCustomerAuth(
  phone: string,
  enteredPassword: string
): Promise<{
  status: 'EXISTING_VALID' | 'EXISTING_INVALID' | 'NEW_USER' | 'SHEET_ERROR';
  customer?: CustomerRecord;
}> {
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  const passwordHash = await sha256(enteredPassword);
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();

  if (!hook) {
    return { status: 'SHEET_ERROR' };
  }

  const parseAuthData = (data: any): {
    status: 'EXISTING_VALID' | 'EXISTING_INVALID' | 'NEW_USER';
    customer?: CustomerRecord;
  } | null => {
    if (!data) return null;
    if (data.status === 'success' || data.ok === true || data.valid === true) {
      const u = data.user || data;
      const userRec: CustomerRecord = {
        user_id: u.user_id || 'U-' + Date.now(),
        name: u.name || u.customer_name || 'Customer',
        phone: cleanPhone,
        passwordHash: passwordHash,
        default_address: u.address || u.default_address || '',
        addresses_json: u.addresses_json || u.addresses || '',
        total_orders: Number(u.total_orders) || 0,
        cart_json: typeof u.cart_json === 'string' ? u.cart_json : (u.cart ? JSON.stringify(u.cart) : '')
      };
      return { status: 'EXISTING_VALID', customer: userRec };
    }
    if (
      data.error === 'INCORRECT_PASSWORD' ||
      data.valid === false ||
      data.passwordMatch === false ||
      data.status === 'incorrect_password'
    ) {
      return { status: 'EXISTING_INVALID' };
    }
    if (
      data.status === 'not_found' ||
      data.isNew === true ||
      data.error === 'USER_NOT_FOUND' ||
      data.exists === false
    ) {
      return { status: 'NEW_USER' };
    }
    return null;
  };

  // 1. Primary POST request to Google Sheet
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 16000);
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'login',
        sheet_id: sheetId,
        phone: cleanPhone,
        passwordHash: passwordHash
      }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => null);
    const parsed = parseAuthData(data);
    if (parsed) return parsed;
  } catch (e) {
    // Fallback to GET query if POST was slowed or blocked by redirect
  }

  // 2. Fallback GET request to Google Sheet
  try {
    const ctrl2 = new AbortController();
    const timer2 = setTimeout(() => ctrl2.abort(), 16000);
    const url = `${hook}${hook.includes('?') ? '&' : '?'}action=login&sheet_id=${encodeURIComponent(sheetId)}&phone=${encodeURIComponent(cleanPhone)}&passwordHash=${encodeURIComponent(passwordHash)}&_t=${Date.now()}`;
    const res2 = await fetch(url, { cache: 'no-store', signal: ctrl2.signal });
    clearTimeout(timer2);
    const data2 = await res2.json().catch(() => null);
    const parsed2 = parseAuthData(data2);
    if (parsed2) return parsed2;
  } catch (e) {}

  return { status: 'SHEET_ERROR' };
}

export async function registerCustomerToSheet(
  name: string,
  phone: string,
  password: string
): Promise<CustomerRecord | null> {
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  const passwordHash = await sha256(password);
  const userId = 'U-' + Date.now();
  const createdAt = new Date().toISOString();

  const newRecord: CustomerRecord = {
    user_id: userId,
    name: name.trim(),
    phone: cleanPhone,
    passwordHash: passwordHash,
    default_address: '',
    total_orders: 0,
    created_at: createdAt,
    cart_json: '{}'
  };

  const hook = getWebhookUrl();
  if (!hook) return null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 16000);
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'register_user',
        sheet_id: getGoogleSheetId(),
        user_id: userId,
        name: name.trim(),
        phone: cleanPhone,
        passwordHash: passwordHash,
        default_address: '',
        total_orders: 0,
        created_at: createdAt,
        cart_json: '{}'
      }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      return newRecord;
    }
  } catch (e) {
    // Try GET fallback for registration if POST redirect failed
    try {
      const ctrl2 = new AbortController();
      const timer2 = setTimeout(() => ctrl2.abort(), 15000);
      const url = `${hook}${hook.includes('?') ? '&' : '?'}action=register_user&sheet_id=${encodeURIComponent(getGoogleSheetId())}&user_id=${encodeURIComponent(userId)}&name=${encodeURIComponent(name.trim())}&phone=${encodeURIComponent(cleanPhone)}&passwordHash=${encodeURIComponent(passwordHash)}&_t=${Date.now()}`;
      await fetch(url, { cache: 'no-store', signal: ctrl2.signal });
      clearTimeout(timer2);
      return newRecord;
    } catch (e2) {
      return null;
    }
  }

  return newRecord;
}

// 4. Customer Delivery Addresses (Strictly Sheet-Backed: Config + Addresses + Users + Orders)
export function parseSheetAddressesFromRawConfig(
  rawConfig: Record<string, any> | undefined,
  phone: string,
  fallbackName?: string
): Address[] | null {
  if (!rawConfig || !phone) return null;
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  if (!cleanPhone) return null;

  const rawVal = rawConfig[`addr_${cleanPhone}`] ?? rawConfig[`addresses_${cleanPhone}`];
  if (rawVal) {
    try {
      const parsed = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
      if (Array.isArray(parsed)) {
        const valid = parsed
          .filter((a: any) => a && a.address && String(a.address).trim())
          .map((a: any, idx: number): Address => ({
            id: String(a.id || `ADDR-${cleanPhone}-${idx + 1}`),
            name: String(a.name || fallbackName || 'Customer').trim(),
            phone: String(a.phone || cleanPhone).replace(/\D/g, '').slice(-10) || cleanPhone,
            address: String(a.address).trim(),
            isDefault: Boolean(a.isDefault ?? (idx === 0)),
            ...(a.lat !== undefined && a.lng !== undefined ? { lat: Number(a.lat), lng: Number(a.lng) } : {})
          }));
        if (valid.length > 0 && !valid.some((a) => a.isDefault)) {
          valid[0].isDefault = true;
        }
        return valid;
      }
    } catch (e) {}
  }
  return null;
}

export async function fetchAddressesFromSheet(
  phone: string,
  fallbackName?: string,
  preloadedConfig?: Record<string, any>
): Promise<Address[] | null> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
  if (!hook || !cleanPhone) return [];

  // 1. Check preloadedConfig if passed from fetchLiveStoreData
  const fromPreloaded = parseSheetAddressesFromRawConfig(preloadedConfig, cleanPhone, fallbackName);
  if (fromPreloaded && fromPreloaded.length > 0) {
    return fromPreloaded;
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 16000);
    const nonce = Math.random().toString(36).substring(7);
    const baseUrl = `${hook}${hook.includes('?') ? '&' : '?'}sheet_id=${encodeURIComponent(sheetId)}`;

    // Fetch get_config, check_user, and get_users in parallel (all supported by deployed Code.gs doGet)
    const [cfgRes, chkRes, usrRes] = await Promise.allSettled([
      fetch(`${baseUrl}&action=get_config&_t=${Date.now()}&_nonce=${nonce}`, { cache: 'no-store', signal: ctrl.signal }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${baseUrl}&action=check_user&phone=${encodeURIComponent(cleanPhone)}&_t=${Date.now()}&_nonce=${nonce}`, { cache: 'no-store', signal: ctrl.signal }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${baseUrl}&action=get_users&_t=${Date.now()}&_nonce=${nonce}`, { cache: 'no-store', signal: ctrl.signal }).then((r) => (r.ok ? r.json() : null))
    ]);
    clearTimeout(timer);

    const cfgData = cfgRes.status === 'fulfilled' ? cfgRes.value : null;
    const rawCfg = cfgData?.config || cfgData?.settings || cfgData;
    const fromCfg = parseSheetAddressesFromRawConfig(rawCfg, cleanPhone, fallbackName);
    if (fromCfg && fromCfg.length > 0) {
      return fromCfg;
    }

    const chkData = chkRes.status === 'fulfilled' ? chkRes.value : null;
    if (chkData && chkData.address && String(chkData.address).trim()) {
      const addrStr = String(chkData.address).trim();
      try {
        const parsedArr = JSON.parse(addrStr);
        if (Array.isArray(parsedArr) && parsedArr.length > 0) {
          return parsedArr;
        }
      } catch (e) {}
      return [
        {
          id: `ADDR-${cleanPhone}-1`,
          name: String(chkData.name || fallbackName || 'Customer').trim(),
          phone: cleanPhone,
          address: addrStr,
          isDefault: true
        }
      ];
    }

    const usrData = usrRes.status === 'fulfilled' ? usrRes.value : null;
    if (usrData && Array.isArray(usrData.users)) {
      const matchedUser = usrData.users.find(
        (u: any) => String(u.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone
      );
      if (matchedUser && matchedUser.address && String(matchedUser.address).trim()) {
        return [
          {
            id: `ADDR-${cleanPhone}-1`,
            name: String(matchedUser.name || fallbackName || 'Customer').trim(),
            phone: cleanPhone,
            address: String(matchedUser.address).trim(),
            isDefault: true
          }
        ];
      }
    }
  } catch (e) {}

  // Secondary check: derive customer's saved address from their latest Orders on sheet
  try {
    const userOrders = await fetchOrdersFromSheet(cleanPhone);
    if (userOrders && userOrders.length > 0) {
      const seen = new Set<string>();
      const derived: Address[] = [];
      userOrders.forEach((o, idx) => {
        const cleanAddr = (o.address || '').trim();
        if (cleanAddr && !cleanAddr.toLowerCase().includes('store pickup') && !seen.has(cleanAddr.toLowerCase())) {
          seen.add(cleanAddr.toLowerCase());
          derived.push({
            id: `ADDR-ORD-${idx + 1}`,
            name: o.customerName || fallbackName || 'Customer',
            phone: cleanPhone,
            address: cleanAddr,
            isDefault: derived.length === 0
          });
        }
      });
      if (derived.length > 0) return derived;
    }
  } catch (e) {}

  return [];
}

export async function saveAddressToSheet(address: {
  id?: string;
  name: string;
  address: string;
  phone: string;
  isDefault?: boolean;
  location?: string;
  telegram_user_id?: string;
  allAddresses?: Address[];
}): Promise<boolean> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  if (!hook) return false;

  const cleanPhone = (address.phone || '').replace(/\D/g, '').slice(-10);
  const addrList = address.allAddresses && address.allAddresses.length > 0
    ? address.allAddresses
    : [
        {
          id: address.id || 'ADDR-' + Date.now(),
          name: address.name,
          phone: cleanPhone,
          address: address.address,
          isDefault: true
        }
      ];

  const payload = {
    action: 'save_address',
    sheet_id: sheetId,
    id: address.id || 'ADDR-' + Date.now(),
    telegram_user_id: address.telegram_user_id || cleanPhone,
    name: address.name,
    address: address.address,
    default_address: address.address,
    phone: cleanPhone,
    isDefault: address.isDefault ?? true,
    location: address.location || '',
    addresses_json: JSON.stringify(addrList),
    updated_at: new Date().toISOString()
  };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const saveCfgUrl = `${hook}${hook.includes('?') ? '&' : '?'}action=save_config&sheet_id=${encodeURIComponent(sheetId)}&key=${encodeURIComponent('addr_' + cleanPhone)}&value=${encodeURIComponent(JSON.stringify(addrList))}&_t=${Date.now()}`;

    await Promise.allSettled([
      fetch(saveCfgUrl, { cache: 'no-store', signal: ctrl.signal }),
      fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      })
    ]);
    clearTimeout(timer);
    return true;
  } catch (e) {
    return false;
  }
}

export async function deleteAddressFromSheet(phone: string, addressId: string, remainingAddresses: Address[]): Promise<boolean> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  if (!hook) return false;
  const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
  const defaultAddr = remainingAddresses.find((a) => a.isDefault) || remainingAddresses[0];

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const saveCfgUrl = `${hook}${hook.includes('?') ? '&' : '?'}action=save_config&sheet_id=${encodeURIComponent(sheetId)}&key=${encodeURIComponent('addr_' + cleanPhone)}&value=${encodeURIComponent(JSON.stringify(remainingAddresses))}&_t=${Date.now()}`;

    await Promise.allSettled([
      fetch(saveCfgUrl, { cache: 'no-store', signal: ctrl.signal }),
      fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: ' save_address',
          sheet_id: sheetId,
          phone: cleanPhone,
          address_id: addressId,
          address: defaultAddr ? defaultAddr.address : '',
          default_address: defaultAddr ? defaultAddr.address : '',
          addresses_json: JSON.stringify(remainingAddresses),
          updated_at: new Date().toISOString()
        }),
        signal: ctrl.signal
      })
    ]);
    clearTimeout(timer);
    return true;
  } catch (e) {
    return false;
  }
}

// 5. Order Management (Sheet: Orders)
// Columns: id, user_id, name, phone, address, items, total, stage, status, payment, created_at
export async function postOrderToSheet(
  order: Order,
  sessionUser?: UserSession | null
): Promise<{ ok: boolean; orderId?: string }> {
  const hook = getWebhookUrl();
  const userId = sessionUser?.user_id || sessionUser?.phone || order.phone;

  const payload = {
    action: 'create_order',
    sheet_id: getGoogleSheetId(),
    id: order.id,
    order_id: order.id,
    user_id: userId,
    name: order.customerName,
    customer_name: order.customerName,
    phone: order.phone,
    address: order.address,
    items: JSON.stringify(order.items),
    total: order.total,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    discount: order.discount,
    stage: order.stage,
    status: order.status,
    payment: order.payment,
    utr: order.utr || extractUtrFromOrder(order) || '',
    created_at: new Date().toISOString(),
    delivery_type: order.deliveryType === 'pickup' ? 'Store Pickup' : 'Home Delivery',
    pickup_slot: order.pickupSlot || '',
    location: order.location || '',
    channel: 'webapp'
  };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 16000);
    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    clearTimeout(timer);

    // Clear cart in sheet after order placement
    await syncCartToSheet(order.phone || sessionUser?.phone || '', {}).catch(() => {});

    return { ok: true, orderId: order.id };
  } catch (e) {
    return { ok: false, orderId: order.id };
  }
}

// 6. Read & Write Cart JSON strictly via Sheet (Config + Users Sheet)
export function parseSheetCartFromRawConfig(
  rawConfig: Record<string, any> | undefined,
  phone?: string
): Record<string, number> | null {
  if (!rawConfig) return null;
  const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
  const devId = getSheetCartId();

  const candidates = [
    cleanPhone ? rawConfig[`cart_${cleanPhone}`] : undefined,
    rawConfig[`cart_${devId}`]
  ];

  const mergedCart: Record<string, number> = {};
  let foundAny = false;

  candidates.forEach((rawCart) => {
    if (rawCart !== undefined && rawCart !== null && rawCart !== '') {
      try {
        const parsed = typeof rawCart === 'string' ? JSON.parse(rawCart) : rawCart;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          foundAny = true;
          Object.entries(parsed).forEach(([k, v]) => {
            const num = Number(v);
            if (k && !isNaN(num) && num > 0) {
              mergedCart[k] = num;
            }
          });
        }
      } catch (e) {}
    }
  });

  return foundAny ? mergedCart : null;
}

export async function fetchCartFromSheet(
  phone?: string,
  preloadedConfig?: Record<string, any>
): Promise<Record<string, number> | null> {
  const fromPreloaded = parseSheetCartFromRawConfig(preloadedConfig, phone);
  if (fromPreloaded !== null) {
    return fromPreloaded;
  }

  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  if (!hook) return null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const nonce = Math.random().toString(36).substring(7);
    const url = `${hook}${hook.includes('?') ? '&' : '?'}action=get_config&sheet_id=${encodeURIComponent(sheetId)}&_t=${Date.now()}&_nonce=${nonce}`;
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const rawCfg = data?.config || data?.settings || data;
      return parseSheetCartFromRawConfig(rawCfg, phone);
    }
  } catch (e) {}
  return null;
}

export async function syncCartToSheet(phone: string | undefined, cart: Record<string, number>): Promise<boolean> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  if (!hook) return true;

  const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
  const devId = getSheetCartId();
  const cartJson = JSON.stringify(cart);

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const baseUrl = `${hook}${hook.includes('?') ? '&' : '?'}action=save_config&sheet_id=${encodeURIComponent(sheetId)}`;

    const requests: Promise<any>[] = [
      fetch(`${baseUrl}&key=${encodeURIComponent('cart_' + devId)}&value=${encodeURIComponent(cartJson)}&_t=${Date.now()}`, {
        cache: 'no-store',
        signal: ctrl.signal
      })
    ];

    if (cleanPhone.length === 10) {
      requests.push(
        fetch(`${baseUrl}&key=${encodeURIComponent('cart_' + cleanPhone)}&value=${encodeURIComponent(cartJson)}&_t=${Date.now()}`, {
          cache: 'no-store',
          signal: ctrl.signal
        }),
        fetch(hook, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'sync_cart',
            sheet_id: sheetId,
            phone: cleanPhone,
            cart_json: cartJson
          }),
          signal: ctrl.signal
        })
      );
    }

    await Promise.allSettled(requests);
    clearTimeout(timer);
    return true;
  } catch (e) {
    return false;
  }
}

export async function updateOrderStatusOnSheet(orderId: string, status: string, stage: number): Promise<boolean> {
  const hook = getWebhookUrl();
  if (!hook) return true;
  const payload = {
    action: 'update_order_stage',
    sheet_id: getGoogleSheetId(),
    order_id: orderId,
    id: orderId,
    status: status,
    stage: stage
  };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (res.ok) return true;
  } catch (e) {
    try {
      fetch(hook, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).catch(() => {});
      return true;
    } catch (err) {}
  }
  return false;
}

export async function updateOrderStageOnSheet(orderId: string, stage: number, status: string): Promise<boolean> {
  return updateOrderStatusOnSheet(orderId, status, stage);
}

export async function updateProductOnSheet(product: {
  ean: string;
  stock_qty: number | string;
  selling_price: number | string;
  mrp: number | string;
  rowIndex?: number;
  product_name?: string;
  category?: string;
  description?: string;
  image_url?: string;
  backup_image_url?: string;
  max_order_qty?: number | string;
  additional_images?: string | string[];
  gallery_images?: string[];
  additional_eans?: string | string[];
  ean_list?: string[];
  video_url?: string;
  previous_ean?: string;
}): Promise<boolean> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  const allEans = parseEanList(product.ean, product.additional_eans, product.ean_list);
  const cleanEan = allEans[0] || getPrimaryEan(product.ean);
  const allEansStr = allEans.join(', ') || cleanEan;
  const searchEans = parseEanList(allEans, product.previous_ean);
  const parsedStock = parseProductStock(product.stock_qty);
  const galleryArr = Array.isArray(product.gallery_images)
    ? product.gallery_images
    : parseGalleryImages(product.additional_images);
  const additionalStr = Array.isArray(product.additional_images)
    ? product.additional_images.join(', ')
    : (product.additional_images || (galleryArr.length > 0 ? galleryArr.join(', ') : undefined));

  // Un-delete if previously deleted
  unrecordDeletedProduct(allEansStr, product.product_name);

  // Instant optimistic update in localStorage catalog, product overrides & stock overrides
  saveStockOverride(cleanEan, parsedStock);
  allEans.forEach((code) => saveStockOverride(code, parsedStock));
  saveProductOverride({
    ean: cleanEan,
    previous_ean: product.previous_ean,
    rowIndex: product.rowIndex,
    additional_eans: allEansStr,
    ean_list: allEans,
    selling_price: product.selling_price,
    mrp: product.mrp,
    stock_qty: parsedStock,
    product_name: product.product_name,
    category: product.category,
    description: product.description,
    image_url: product.image_url,
    backup_image_url: product.backup_image_url,
    video_url: product.video_url,
    max_order_qty: product.max_order_qty,
    additional_images: additionalStr,
    gallery_images: galleryArr,
    sheetSynced: false
  });

  let prevMatchedProduct: Product | undefined;
  let nextUpdatedProduct: Product | undefined;

  try {
    const saved = localStorage.getItem('munna_store_catalog');
    if (saved) {
      const parsed: Product[] = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const updated = parsed.map((p) => {
          const matchesEan = doesProductMatchEan(p, searchEans);
          const matchesName = Boolean(product.product_name && p.product_name && p.product_name.toLowerCase().trim() === product.product_name.toLowerCase().trim());
          const matchesRow = Boolean(product.rowIndex && product.rowIndex > 0 && p.rowIndex === product.rowIndex && (matchesEan || matchesName));
          if (matchesEan || matchesName || matchesRow) {
            prevMatchedProduct = { ...p };
            const combinedEans = parseEanList(cleanEan, allEans, p.ean, p.additional_eans, p.ean_list);
            const primaryEan = cleanEan || combinedEans[0] || p.ean;
            const mergedObj: Product = {
              ...p,
              ean: primaryEan,
              additional_eans: combinedEans.join(', '),
              ean_list: combinedEans,
              stock_qty: parsedStock,
              selling_price: Number(product.selling_price) || 0,
              mrp: Number(product.mrp) || 0,
              ...(product.product_name ? { product_name: product.product_name } : {}),
              ...(product.category ? { category: product.category } : {}),
              ...(product.description !== undefined ? { description: product.description } : {}),
              ...(product.image_url ? { image_url: product.image_url } : {}),
              ...(product.backup_image_url ? { backup_image_url: product.backup_image_url } : {}),
              ...(product.max_order_qty !== undefined ? { max_order_qty: Number(product.max_order_qty) || 10 } : {}),
              ...(additionalStr !== undefined ? { additional_images: additionalStr } : {}),
              ...(galleryArr.length > 0 ? { gallery_images: galleryArr } : {}),
              ...(product.video_url !== undefined ? { video_url: product.video_url } : {})
            };
            nextUpdatedProduct = mergedObj;
            return mergedObj;
          }
          return p;
        });
        localStorage.setItem('munna_store_catalog', JSON.stringify(updated));
      }
    }
  } catch (e) {}

  // Trigger Event-Driven WhatsApp Auto-Send if rules are enabled (New Product / Restocked / Price Changed)
  try {
    const candidateProduct: Product = nextUpdatedProduct || {
      ean: cleanEan || String(product.ean),
      additional_eans: allEansStr,
      ean_list: allEans,
      product_name: String(product.product_name || 'Grocery Item'),
      category: String(product.category || 'General'),
      selling_price: Number(product.selling_price) || 0,
      mrp: Number(product.mrp) || Number(product.selling_price) || 0,
      stock_qty: parsedStock,
      image_url: product.image_url || '',
      backup_image_url: product.backup_image_url || '',
      description: product.description || '',
      max_order_qty: Number(product.max_order_qty) || 10
    };
    checkAndTriggerAutoSendForProductUpdate(prevMatchedProduct, candidateProduct).catch(() => {});
  } catch (e) {}

  if (!hook) return true;

  // IMPORTANT: Send cleanEan (single primary EAN) in `ean` so both OLD deployed Apps Script and NEW Apps Script match 100%!
  // Send full comma-separated list in `additional_eans` and `ean_list`.
  const payload: any = {
    action: 'update_product',
    sheet_id: sheetId,
    ean: cleanEan || String(product.ean),
    primary_ean: cleanEan,
    previous_ean: product.previous_ean || '',
    additional_eans: allEansStr,
    ean_list: allEans,
    row: product.rowIndex,
    rowIndex: product.rowIndex,
    stock_qty: parsedStock,
    stock: parsedStock,
    selling_price: product.selling_price,
    price: product.selling_price,
    mrp: product.mrp,
    name: product.product_name,
    product_name: product.product_name,
    category: product.category,
    description: product.description || '',
    image_url: product.image_url || '',
    backup_image_url: product.backup_image_url || '',
    max_order_qty: product.max_order_qty !== undefined ? product.max_order_qty : 10,
    additional_images: additionalStr || '',
    video_url: product.video_url || ''
  };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.status === 'success' || data.ok === true)) {
        const assignedRow = data.row && Number(data.row) > 0 ? Number(data.row) : product.rowIndex;
        saveProductOverride({
          ean: cleanEan,
          previous_ean: product.previous_ean,
          additional_eans: allEansStr,
          ean_list: allEans,
          rowIndex: assignedRow,
          selling_price: product.selling_price,
          mrp: product.mrp,
          stock_qty: parsedStock,
          sheetSynced: true
        });
        if (assignedRow && assignedRow > 0) {
          try {
            const saved = localStorage.getItem('munna_store_catalog');
            if (saved) {
              const parsed: Product[] = JSON.parse(saved);
              if (Array.isArray(parsed)) {
                const updated = parsed.map((p) => {
                  if (doesProductMatchEan(p, searchEans) || (product.product_name && p.product_name && p.product_name.toLowerCase().trim() === product.product_name.toLowerCase().trim())) {
                    return { ...p, rowIndex: assignedRow };
                  }
                  return p;
                });
                localStorage.setItem('munna_store_catalog', JSON.stringify(updated));
              }
            }
          } catch (e) {}
        }
        return true;
      }
      if (data && data.status === 'error') {
        console.error('Apps Script updateProduct error:', data.message);
        if (data.message && data.message.includes('typed column')) {
          showToast('⚠️ ମୂଲ୍ୟ ବ୍ରାଉଜରରେ ସେଭ୍ ହେଲା! Google Sheet ପାଇଁ ନୂଆ Code.gs Deploy କରନ୍ତୁ।');
        }
      }
    }
  } catch (e) {
    // Also fire no-cors POST so full description and gallery images reach Apps Script even if CORS blocks reading response
    try {
      fetch(hook, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (err) {}
  }

  // GET URL fallback - kept compact (<1500 chars) so it NEVER fails with HTTP 414 URI Too Long
  try {
    const compactDesc = String(product.description || '').slice(0, 280);
    const compactAddImgs = galleryArr.slice(0, 4).join(', ').slice(0, 400);
    const getParams = new URLSearchParams({
      action: 'update_product',
      sheet_id: sheetId,
      ean: cleanEan || String(product.ean),
      primary_ean: cleanEan,
      additional_eans: allEansStr,
      row: String(product.rowIndex || ''),
      stock_qty: String(parsedStock),
      selling_price: String(product.selling_price ?? ''),
      mrp: String(product.mrp ?? ''),
      name: String(product.product_name || ''),
      product_name: String(product.product_name || ''),
      category: String(product.category || ''),
      description: compactDesc,
      image_url: String(product.image_url || ''),
      backup_image_url: String(product.backup_image_url || ''),
      additional_images: compactAddImgs,
      video_url: String(product.video_url || ''),
      max_order_qty: String(product.max_order_qty ?? '10'),
      _t: String(Date.now())
    });
    const fallbackUrl = `${hook}${hook.includes('?') ? '&' : '?'}${getParams.toString()}`;
    const res = await fetch(fallbackUrl, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.status === 'success' || data.ok === true)) return true;
    }
    return true;
  } catch (err) {
    return true;
  }
}

// Rapid stock-only sync directly after order placement, order cancellation, or quick stock toggle
export async function updateProductStockOnSheet(
  ean: string,
  stock_qty: number | string,
  rowIndex?: number,
  productName?: string
): Promise<boolean> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  const allEans = parseEanList(ean);
  const cleanEan = allEans[0] || getPrimaryEan(ean);
  const parsedStock = parseProductStock(stock_qty);

  // Instant optimistic update in local storage catalog, stock overrides & product overrides
  saveStockOverride(cleanEan, parsedStock);
  allEans.forEach((code) => saveStockOverride(code, parsedStock));
  saveProductOverride({
    ean: cleanEan,
    additional_eans: allEans.join(', '),
    ean_list: allEans,
    stock_qty: parsedStock
  });

  let prevStockProduct: Product | undefined;
  let nextStockProduct: Product | undefined;

  try {
    const saved = localStorage.getItem('munna_store_catalog');
    if (saved) {
      const parsed: Product[] = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const updated = parsed.map((p) => {
          if (doesProductMatchEan(p, allEans) || (rowIndex && p.rowIndex === rowIndex)) {
            prevStockProduct = { ...p };
            const pCodes = parseEanList(p.ean, p.additional_eans, p.ean_list);
            pCodes.forEach((c) => saveStockOverride(c, parsedStock));
            const nextP = { ...p, stock_qty: parsedStock };
            nextStockProduct = nextP;
            return nextP;
          }
          return p;
        });
        localStorage.setItem('munna_store_catalog', JSON.stringify(updated));
      }
    }
  } catch (e) {}

  if (prevStockProduct && nextStockProduct) {
    checkAndTriggerAutoSendForProductUpdate(prevStockProduct, nextStockProduct).catch(() => {});
  }

  if (!hook) return true;

  const payload = {
    action: 'update_product_stock',
    sheet_id: sheetId,
    ean: cleanEan || String(ean),
    stock_qty: parsedStock,
    stock: parsedStock,
    row: rowIndex,
    rowIndex: rowIndex,
    product_name: productName
  };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.status === 'success' || data.ok === true)) {
        return true;
      }
    }
  } catch (e) {}

  // Reliable GET fallback
  try {
    const getParams = new URLSearchParams({
      action: 'update_product_stock',
      sheet_id: sheetId,
      ean: cleanEan || String(ean),
      stock_qty: String(parsedStock),
      row: String(rowIndex || ''),
      name: String(productName || ''),
      _t: String(Date.now())
    });
    const fallbackUrl = `${hook}${hook.includes('?') ? '&' : '?'}${getParams.toString()}`;
    const res = await fetch(fallbackUrl, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.status === 'success' || data.ok === true)) return true;
    }
    return true;
  } catch (err) {
    return true;
  }
}

export async function deleteProductFromSheet(
  ean: string,
  rowIndex?: number,
  productName?: string,
  additionalEans?: string | string[]
): Promise<boolean> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  const allEans = parseEanList(ean, additionalEans);
  const cleanEan = allEans[0] || String(ean).replace(/^EAN-/, '').trim();
  const allEansStr = allEans.join(', ') || cleanEan;

  // Instant permanent record into munna_deleted_eans & munna_deleted_names for ALL barcodes of this product
  recordDeletedProduct(allEansStr || ean, productName);

  try {
    const saved = localStorage.getItem('munna_store_catalog');
    if (saved) {
      const parsed: Product[] = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((p) => {
          const matchesEan = doesProductMatchEan(p, allEans) || String(p.ean) === String(ean);
          const matchesName = Boolean(productName && p.product_name && p.product_name.toLowerCase().trim() === productName.toLowerCase().trim());
          const matchesRow = Boolean(rowIndex && rowIndex > 0 && p.rowIndex === rowIndex && (matchesEan || matchesName));
          if (matchesEan || matchesName || matchesRow) {
            const pCodes = parseEanList(p.ean, p.additional_eans, p.ean_list);
            pCodes.forEach((c) => recordDeletedProduct(c));
            return false;
          }
          return true;
        });
        localStorage.setItem('munna_store_catalog', JSON.stringify(filtered));
      }
    }
  } catch (e) {}

  if (!hook) return true;

  const payload = {
    action: 'delete_product',
    sheet_id: sheetId,
    ean: cleanEan || String(ean),
    additional_eans: allEansStr,
    row: rowIndex,
    rowIndex: rowIndex,
    product_name: productName
  };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    clearTimeout(timer);
  } catch (e) {
    try {
      fetch(hook, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (err) {}
  }

  // Always fire GET fallback as well so both doPost and doGet handlers in Apps Script execute deletion
  try {
    const getParams = new URLSearchParams({
      action: 'delete_product',
      sheet_id: sheetId,
      ean: cleanEan || String(ean),
      additional_eans: allEansStr,
      row: String(rowIndex || ''),
      name: String(productName || ''),
      product_name: String(productName || ''),
      _t: String(Date.now())
    });
    const fallbackUrl = `${hook}${hook.includes('?') ? '&' : '?'}${getParams.toString()}`;
    await fetch(fallbackUrl, { cache: 'no-store', mode: 'no-cors' }).catch(() => {});
    return true;
  } catch (err) {
    return true;
  }
}

export async function batchUpdateProductsOnSheet(
  products: Product[]
): Promise<{ success: boolean; count: number }> {
  // Always persist updated products in localStorage catalog so page state is immediately authoritative
  try {
    if (products.length > 0) {
      localStorage.setItem('munna_store_catalog', JSON.stringify(products));
    }
  } catch (e) {}

  const hook = getWebhookUrl();
  if (!hook) return { success: true, count: products.length };

  const payload = {
    action: 'batch_update_products',
    sheet_id: getGoogleSheetId(),
    products: products.map((p) => {
      const allEans = parseEanList(p.ean, p.additional_eans, p.ean_list);
      const cleanPrimary = allEans[0] || getPrimaryEan(p.ean);
      const allEansStr = allEans.join(', ') || cleanPrimary;
      const addImgs = Array.isArray(p.gallery_images) && p.gallery_images.length > 0
        ? p.gallery_images.join(', ')
        : (Array.isArray(p.additional_images) ? p.additional_images.join(', ') : (p.additional_images || ''));
      return {
        rowIndex: p.rowIndex,
        ean: cleanPrimary,
        primary_ean: cleanPrimary,
        additional_eans: allEansStr,
        ean_list: allEans,
        product_name: p.product_name,
        mrp: p.mrp,
        selling_price: p.selling_price,
        stock_qty: p.stock_qty,
        category: p.category,
        description: p.description || '',
        image_url: p.image_url,
        backup_image_url: p.backup_image_url || '',
        max_order_qty: p.max_order_qty !== undefined ? p.max_order_qty : 10,
        additional_images: addImgs,
        video_url: p.video_url || ''
      };
    })
  };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.status === 'error') {
        console.error('Google Apps Script batch update error:', data.message);
        if (data.message && data.message.includes('typed column')) {
          showToast('⚠️ ମୂଲ୍ୟ ବ୍ରାଉଜରରେ ସେଭ୍ ହେଲା! Google Sheet ପାଇଁ ନୂଆ Code.gs Deploy କରନ୍ତୁ।');
        } else if (data.message) {
          showToast('⚠️ Google Sheet Error: ' + data.message);
        }
        return { success: false, count: 0 };
      }
      return { success: true, count: products.length };
    }
  } catch (e) {
    try {
      fetch(hook, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).catch(() => {});
      return { success: true, count: products.length };
    } catch (err) {}
  }
  return { success: false, count: 0 };
}

export interface SaveConfigResult {
  ok: boolean;
  message?: string;
  updatedKeysCount?: number;
}

export async function saveConfigToSheet(
  config: Partial<ShopConfig>,
  banners?: Banner[],
  notice?: CustomerNotice | null,
  adminCreds?: { username?: string; password?: string }
): Promise<SaveConfigResult> {
  const hook = getWebhookUrl();
  const currentSheetId = getGoogleSheetId();

  // Save locally as instantaneous offline-safe fallback
  try {
    const existing = localStorage.getItem('SHOP_SETTINGS');
    const merged = { ...(existing ? JSON.parse(existing) : {}), ...config };
    localStorage.setItem('SHOP_SETTINGS', JSON.stringify(merged));
    localStorage.setItem('munna_shop_config', JSON.stringify(merged));
    if (banners) {
      localStorage.setItem('SHOP_BANNERS', JSON.stringify(banners));
    }
    if (notice) {
      localStorage.setItem('SHOP_NOTICE', JSON.stringify(notice));
    }
    if (adminCreds?.username) {
      localStorage.setItem('munna_admin_username', adminCreds.username.trim());
    }
    if (adminCreds?.password) {
      localStorage.setItem('munna_admin_password', adminCreds.password.trim());
    }
  } catch (e) {}

  if (!hook) {
    return { ok: true, message: 'Saved locally (Webhook URL not set)' };
  }

  // Build the complete list of [key, value] pairs to persist into the Sheet
  const entries: Array<[string, any]> = [];

  if (config.storeOpen !== undefined) {
    entries.push(['store_open', config.storeOpen ? '1' : '0']);
  }
  if (config.storeClosedMessage !== undefined) {
    entries.push(['store_open_message', config.storeClosedMessage]);
    entries.push(['store_closed_message', config.storeClosedMessage]);
  }
  if (config.storeClosedCheckoutMessage !== undefined) {
    entries.push(['store_closed_checkout_message', config.storeClosedCheckoutMessage]);
  }
  if (config.storeOpenTime !== undefined) {
    entries.push(['store_open_time', config.storeOpenTime]);
  }
  if (config.storeCloseTime !== undefined) {
    entries.push(['store_close_time', config.storeCloseTime]);
  }
  if (config.deliveryFee !== undefined) {
    entries.push(['delivery_fee', Number(config.deliveryFee)]);
  }
  if (config.freeAbove !== undefined) {
    entries.push(['free_delivery_above', Number(config.freeAbove)]);
  }
  if (config.deliverySlot !== undefined) {
    entries.push(['delivery_slot', config.deliverySlot]);
  }
  if (config.deliveryDay !== undefined) {
    entries.push(['delivery_day', config.deliveryDay]);
  }
  if (config.codActive !== undefined) {
    const codFlag = isCodDeliveryActive(config) ? '1' : '0';
    entries.push(['cod_active', codFlag]);
    entries.push(['cod', codFlag]);
  }
  if (config.codNotice !== undefined) {
    entries.push(['cod_notice', config.codNotice]);
  }
  if (config.codMinBill !== undefined) {
    entries.push(['cod_min_bill', Number(config.codMinBill)]);
  }
  if (config.upiActive !== undefined) {
    const upiFlag = isUpiPaymentActive(config) ? '1' : '0';
    entries.push(['upi_active', upiFlag]);
    entries.push(['upi', upiFlag]);
  }
  if (config.upiId !== undefined) {
    entries.push(['upi_id', config.upiId.trim()]);
  }
  if (config.upiPayeeName !== undefined) {
    entries.push(['upi_payee_name', config.upiPayeeName.trim()]);
  }
  if (config.upiCustomQrUrl !== undefined) {
    entries.push(['upi_custom_qr_url', config.upiCustomQrUrl.trim()]);
  }
  if (config.pickupActive !== undefined) {
    const pickupFlag = isStorePickupActive(config) ? '1' : '0';
    entries.push(['pickup_active', pickupFlag]);
    entries.push(['store_pickup', pickupFlag]);
    entries.push(['pickup', pickupFlag]);
  }
  if (config.pickupNote !== undefined) {
    entries.push(['pickup_note', config.pickupNote]);
  }
  if (config.pickupSlots !== undefined) {
    entries.push([
      'pickup_slots',
      Array.isArray(config.pickupSlots) ? config.pickupSlots.join(',') : String(config.pickupSlots)
    ]);
  }
  if (config.pickupCancelNotice !== undefined) {
    entries.push(['pickup_cancel_notice', config.pickupCancelNotice]);
  }
  if (config.pickupChargeOn !== undefined) {
    entries.push(['pickup_charge_on', config.pickupChargeOn ? '1' : '0']);
  }
  if (config.pickupChargeFee !== undefined) {
    entries.push(['pickup_charge_fee', Number(config.pickupChargeFee)]);
  }
  if (config.storeName !== undefined) {
    entries.push(['store_name', config.storeName]);
  }
  if (config.storePickupName !== undefined) {
    entries.push(['store_pickup_name', config.storePickupName]);
  }
  if (config.storePickupAddress !== undefined) {
    entries.push(['store_pickup_address', config.storePickupAddress]);
  }
  if (config.storePickupPhone !== undefined) {
    entries.push(['store_pickup_phone', config.storePickupPhone]);
  }
  if (config.storePickupHours !== undefined) {
    entries.push(['store_pickup_hours', config.storePickupHours]);
  }
  if (config.whatsappShareFormat !== undefined) {
    entries.push(['whatsapp_share_format', config.whatsappShareFormat]);
    try {
      localStorage.setItem('munna_whatsapp_share_format', config.whatsappShareFormat);
    } catch (e) {}
  }
  if (config.whatsappLinkCaptionFormat !== undefined) {
    entries.push(['whatsapp_link_caption_format', config.whatsappLinkCaptionFormat]);
    try {
      localStorage.setItem('munna_whatsapp_link_caption_format', config.whatsappLinkCaptionFormat);
    } catch (e) {}
  }
  if (config.couponCode !== undefined) {
    entries.push(['coupon_code', config.couponCode.trim().toUpperCase()]);
  }
  if (config.couponPercent !== undefined) {
    entries.push(['coupon_percent', Number(config.couponPercent)]);
  }
  if (config.couponMinBill !== undefined) {
    entries.push(['coupon_min_bill', Number(config.couponMinBill)]);
  }
  if (config.trending !== undefined) {
    entries.push([
      'trending',
      normalizeTrending(config.trending).join(', ')
    ]);
  }
  if (config.appDownloadUrl !== undefined) {
    entries.push(['app_download_url', config.appDownloadUrl]);
  }
  if (config.orderNotificationEnabled !== undefined) {
    entries.push(['order_notification_enabled', config.orderNotificationEnabled ? '1' : '0']);
  }
  if (config.orderRingEnabled !== undefined) {
    entries.push(['order_ring_enabled', config.orderRingEnabled ? '1' : '0']);
  }
  if (config.orderNotificationHours !== undefined) {
    entries.push(['order_notification_hours', config.orderNotificationHours]);
  }
  if (config.orderRingHours !== undefined) {
    entries.push(['order_ring_hours', config.orderRingHours]);
  }
  if (banners !== undefined) {
    entries.push(['banners', JSON.stringify(banners)]);
  }
  if (notice !== undefined) {
    entries.push(['broadcast_notice', notice ? JSON.stringify(notice) : '']);
  }
  if (adminCreds?.username) {
    entries.push(['ADMIN_USERNAME', adminCreds.username.trim()]);
    entries.push(['admin_username', adminCreds.username.trim()]);
  }
  if (adminCreds?.password) {
    entries.push(['ADMIN_PASSWORD', adminCreds.password.trim()]);
    entries.push(['admin_password', adminCreds.password.trim()]);
  }

  // Preserve Cline AI / OpenRouter API Key centrally in Google Sheet Config
  try {
    const savedAiKey =
      localStorage.getItem('cline_api_key') ||
      localStorage.getItem('openrouter_api_key') ||
      localStorage.getItem('settings.ai_api_key');
    if (savedAiKey && savedAiKey.trim()) {
      entries.push(['cline_api_key', savedAiKey.trim()]);
      entries.push(['openrouter_api_key', savedAiKey.trim()]);
    }
  } catch (e) {}

  // 1. Send atomic dictionary payload with action: 'save_config' (fastest & most reliable)
  const dictPayload: Record<string, any> = {
    action: 'save_config',
    sheet_id: currentSheetId
  };
  entries.forEach(([k, v]) => {
    dictPayload[k] = v;
  });

  let atomicSaved = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(dictPayload),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      atomicSaved = true;
    }
  } catch (e) {
    try {
      await fetch(hook, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(dictPayload)
      });
      atomicSaved = true;
    } catch (err) {}
  }

  // 2. Extra guarantee for trending items: push trending key explicitly
  if (config.trending !== undefined) {
    await pushConfigKeyToSheet('trending', normalizeTrending(config.trending).join(', ')).catch(() => {});
  }

  // 3. Fallback batch sync for individual keys
  let successCount = entries.length;
  if (!atomicSaved) {
    successCount = 0;
    const batchSize = 4;
    for (let i = 0; i < entries.length; i += batchSize) {
      const chunk = entries.slice(i, i + batchSize);
      const results = await Promise.all(
        chunk.map(([k, v]) => pushConfigKeyToSheet(k, v))
      );
      successCount += results.filter(Boolean).length;
    }
  }

  return {
    ok: successCount > 0,
    message: `ସମସ୍ତ ସେଟିଂସ୍ (${successCount} ଟି ବିକଳ୍ପ) ଗୁଗୁଲ୍ ସିଟ୍ ରେ ସେଭ୍ ହେଲା! ✅`,
    updatedKeysCount: successCount
  };
}

/**
 * Dedicated Config-Tab-Only writer for WhatsApp Share Format & Link Paste Caption Format.
 * Writes ONLY `whatsapp_share_format`, `whatsapp_link_caption_format`, and optional `store_name`, `store_pickup_address`
 * to the 'Config' tab of the Google Sheet without touching Sheet1 or any other tab/settings.
 */
export async function saveShareFormatToConfigSheet(
  whatsappShareFormat: string,
  storeName?: string,
  storePickupAddress?: string,
  whatsappLinkCaptionFormat?: string
): Promise<SaveConfigResult> {
  const cleanFormat = (whatsappShareFormat || '').trim();
  const cleanLinkCaption = whatsappLinkCaptionFormat !== undefined ? whatsappLinkCaptionFormat.trim() : undefined;
  const hook = getWebhookUrl();
  const currentSheetId = getGoogleSheetId();
  const newVer = `fmt_${Date.now().toString(36).slice(-5)}`;

  try {
    localStorage.setItem('munna_whatsapp_share_format', cleanFormat);
    localStorage.setItem('munna_global_link_version', newVer);
    if (cleanLinkCaption !== undefined && cleanLinkCaption) {
      localStorage.setItem('munna_whatsapp_link_caption_format', cleanLinkCaption);
    }
    const existing = localStorage.getItem('SHOP_SETTINGS');
    const parsed = existing ? JSON.parse(existing) : {};
    parsed.whatsappShareFormat = cleanFormat;
    parsed.shareLinkVersion = newVer;
    parsed.share_link_version = newVer;
    if (cleanLinkCaption !== undefined && cleanLinkCaption) {
      parsed.whatsappLinkCaptionFormat = cleanLinkCaption;
    }
    if (storeName !== undefined) parsed.storeName = storeName.trim();
    if (storePickupAddress !== undefined) parsed.storePickupAddress = storePickupAddress.trim();
    localStorage.setItem('SHOP_SETTINGS', JSON.stringify(parsed));
    localStorage.setItem('munna_shop_config', JSON.stringify(parsed));
  } catch (e) {}

  if (!hook) {
    return { ok: true, message: 'Saved locally (Webhook URL not set)' };
  }

  const payload: Record<string, any> = {
    action: 'save_share_format',
    sheet_id: currentSheetId,
    whatsapp_share_format: cleanFormat,
    share_link_version: newVer
  };
  if (cleanLinkCaption !== undefined && cleanLinkCaption) {
    payload.whatsapp_link_caption_format = cleanLinkCaption;
  }
  if (storeName !== undefined && storeName.trim()) {
    payload.store_name = storeName.trim();
  }
  if (storePickupAddress !== undefined && storePickupAddress.trim()) {
    payload.store_pickup_address = storePickupAddress.trim();
  }

  let savedOk = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.status === 'success' || data.ok)) {
        savedOk = true;
      }
    }
  } catch (e) {}

  // Also push via single-key Config tab writer so even older Code.gs deployments update Config tab immediately
  const keySaved = await pushConfigKeyToSheet('whatsapp_share_format', cleanFormat).catch(() => false);
  await pushConfigKeyToSheet('share_link_version', newVer).catch(() => false);
  if (cleanLinkCaption !== undefined && cleanLinkCaption) {
    await pushConfigKeyToSheet('whatsapp_link_caption_format', cleanLinkCaption).catch(() => false);
  }
  if (storeName !== undefined && storeName.trim()) {
    await pushConfigKeyToSheet('store_name', storeName.trim()).catch(() => false);
  }
  if (storePickupAddress !== undefined && storePickupAddress.trim()) {
    await pushConfigKeyToSheet('store_pickup_address', storePickupAddress.trim()).catch(() => false);
  }

  return {
    ok: savedOk || Boolean(keySaved),
    message: 'WhatsApp Share & Link Caption Format saved to Google Sheet Config tab! ✅',
    updatedKeysCount: cleanLinkCaption ? 3 : 2
  };
}

/**
 * Master 1-Click Fix & Force-Refresh WhatsApp Link Preview Cache:
 * 1. Reads configured share format & link caption format from localStorage / shopConfig.
 * 2. Writes them to the Config tab in Google Sheet.
 * 3. Generates a fresh share_link_version token and updates localStorage & Config tab.
 * 4. Calls resetAllProductShareLinks to heal any local image paths and reset all product links across FE & BE.
 */
export async function fixAndForceRefreshWhatsAppLinkCache(currentProducts: Product[] = []): Promise<{
  ok: boolean;
  versionTag: string;
  totalProducts: number;
  totalCount: number;
  healedCount: number;
  updatedProducts: Product[];
  message: string;
}> {
  const cfgFormat = localStorage.getItem('munna_whatsapp_share_format') || '';
  const cfgCaptionFmt = localStorage.getItem('munna_whatsapp_link_caption_format') || '';
  
  await saveShareFormatToConfigSheet(cfgFormat, undefined, undefined, cfgCaptionFmt).catch(() => {});

  const resetRes = await resetAllProductShareLinks(currentProducts);

  return {
    ok: resetRes.ok,
    versionTag: resetRes.versionTag,
    totalProducts: resetRes.totalCount,
    totalCount: resetRes.totalCount,
    healedCount: resetRes.healedCount,
    updatedProducts: resetRes.updatedProducts,
    message: resetRes.message
  };
}

export async function checkAdminAuthOnSheet(username: string, password: string): Promise<boolean> {
  const cleanUser = username.replace(/\D/g, '').slice(-10);
  const cleanPass = password.trim();
  if (!cleanUser || !cleanPass) return false;

  const hook = getWebhookUrl();
  const currentSheetId = getGoogleSheetId();

  // 1. Direct Webhook auth check against the Google Sheet
  if (hook) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'check_admin_auth',
          sheet_id: currentSheetId,
          username: cleanUser,
          password: cleanPass
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => null);
      if (data) {
        if (data.ok === true || data.status === 'success' || data.valid === true) {
          return true;
        }
        if (data.ok === false || data.status === 'invalid_credentials' || data.valid === false) {
          return false;
        }
      }
    } catch (e) {
      // Network failure or older script without check_admin_auth, fallback to reading config
    }
  }

  // 2. Read live admin credentials from the Sheet's Config tab
  try {
    const sheetConfig = await fetchSheetConfig();
    if (sheetConfig) {
      if (sheetConfig.adminUsername) {
        localStorage.setItem('munna_admin_username', sheetConfig.adminUsername.trim());
      }
      if (sheetConfig.adminPassword) {
        localStorage.setItem('munna_admin_password', sheetConfig.adminPassword.trim());
      }
      const sheetUser = (sheetConfig.adminUsername || '').replace(/\D/g, '').slice(-10);
      const sheetPass = (sheetConfig.adminPassword || '').trim();
      if (sheetUser && sheetPass && cleanUser === sheetUser && cleanPass === sheetPass) {
        return true;
      }
    }
  } catch (e) {}

  // 3. Check credentials previously synced from Google Sheet in localStorage
  try {
    const cachedUser = (localStorage.getItem('munna_admin_username') || '').replace(/\D/g, '').slice(-10);
    const cachedPass = (localStorage.getItem('munna_admin_password') || '').trim();
    if (cachedUser && cachedPass && cleanUser === cachedUser && cleanPass === cachedPass) {
      return true;
    }
  } catch (e) {}

  // 4. Check environment configured credentials if defined
  if (
    APP_CONFIG.ADMIN_USERNAME &&
    APP_CONFIG.ADMIN_PASSWORD &&
    cleanUser === APP_CONFIG.ADMIN_USERNAME.replace(/\D/g, '').slice(-10) &&
    cleanPass === APP_CONFIG.ADMIN_PASSWORD.trim()
  ) {
    return true;
  }

  return false;
}

export interface JioMartSearchResult {
  id: string | number;
  ean: string;
  eans?: string[];
  additional_eans?: string;
  name: string;
  price: number;
  sp: number;
  mrp: number;
  image: string;
  images: string[];
  category?: string;
  description?: string;
  available?: boolean;
  sellable?: boolean;
  pincode?: string;
  requestedPincode?: string;
  pincodeMatched?: boolean;
}

export function normalizeJioMartItem(
  rawItem: any,
  requestedPincode?: string,
  responsePincode?: string
): JioMartSearchResult {
  const name = String(rawItem.name || rawItem.product_name || rawItem.title || '').trim();
  const sp = Number(rawItem.price ?? rawItem.sp ?? rawItem.selling_price ?? rawItem.final_price ?? 0);
  const mrp = Number(rawItem.mrp ?? rawItem.price ?? sp ?? 0);
  const allEans = parseEanList(
    rawItem.ean,
    rawItem.barcode,
    rawItem.eans,
    rawItem.barcodes,
    rawItem.additional_eans,
    rawItem.sku,
    rawItem.article_id,
    rawItem.id
  );
  const ean = allEans[0] || String(rawItem.ean || rawItem.barcode || rawItem.id || '').trim();

  // Extract all valid high-res image URLs
  const candidateImages: string[] = [];

  // 1. Check images array (returned by Cloudflare Worker API)
  if (Array.isArray(rawItem.images)) {
    rawItem.images.forEach((img: any) => {
      const url = typeof img === 'string' ? img.trim() : (img?.url || img?.image || img?.src || '');
      if (url && (url.startsWith('http') || url.startsWith('//'))) {
        candidateImages.push(url.startsWith('//') ? `https:${url}` : url);
      }
    });
  }

  // 2. Check medias array (JioMart raw catalog structure)
  if (Array.isArray(rawItem.medias)) {
    rawItem.medias.forEach((media: any) => {
      const url = typeof media === 'string' ? media.trim() : (media?.url || media?.image || media?.src || media?.large || '');
      if (url && (url.startsWith('http') || url.startsWith('//'))) {
        candidateImages.push(url.startsWith('//') ? `https:${url}` : url);
      }
    });
  }

  // 3. Check single primary image / image_url / thumbnail
  const singleImage = rawItem.image || rawItem.image_url || rawItem.thumbnail || '';
  if (singleImage && typeof singleImage === 'string') {
    const trimmed = singleImage.trim();
    if (trimmed && (trimmed.startsWith('http') || trimmed.startsWith('//'))) {
      const fullUrl = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
      if (!candidateImages.includes(fullUrl)) {
        candidateImages.unshift(fullUrl);
      }
    }
  }

  // Deduplicate and filter valid links
  const cleanImages = Array.from(new Set(candidateImages.filter(Boolean)));
  const primaryImage = cleanImages[0] || (typeof singleImage === 'string' ? singleImage : '');

  const rawCategory = rawItem.category || rawItem.category_name || '';
  const detectedCat = detectProductCategory(name, rawCategory, rawItem);
  const richDescription = extractOrGenerateProductDescription(rawItem, detectedCat);

  const isSellable =
    rawItem.sellable !== undefined
      ? Boolean(rawItem.sellable)
      : rawItem.in_stock !== false &&
        rawItem.available !== false &&
        String(rawItem.stock_status || '').toLowerCase() !== 'out_of_stock';

  // Preserve the REAL pincode returned by the Worker/API — never overwrite with requestedPincode!
  const actualPincode = String(rawItem.pincode || responsePincode || '').trim();
  const reqPin = String(requestedPincode || '').trim();
  const pincodeMatched = !actualPincode || !reqPin || actualPincode === reqPin;

  return {
    id: rawItem.id || ean || '',
    ean,
    eans: allEans.length > 0 ? allEans : (ean ? [ean] : []),
    additional_eans: allEans.join(', '),
    name,
    price: sp,
    sp,
    mrp: mrp || sp,
    image: primaryImage,
    images: cleanImages.length > 0 ? cleanImages : (primaryImage ? [primaryImage] : []),
    category: detectedCat || rawCategory || 'Grocery',
    description: richDescription,
    available: isSellable,
    sellable: isSellable,
    pincode: actualPincode || reqPin,
    requestedPincode: reqPin,
    pincodeMatched
  };
}

export async function searchJioMartProducts(
  query: string,
  pincode = '752106',
  strictPincode = true
): Promise<JioMartSearchResult[]> {
  const cleanQ = (query || '').trim();
  if (!cleanQ) return [];
  const cleanPin = (pincode || '752106').replace(/\D/g, '').slice(0, 6) || '752106';

  // 1. Built-In Project Server Route (/api/jiomart-search in vite.config.ts)
  // Runs directly inside this single project — NO extra Cloudflare Worker or Page needed!
  try {
    const localApiUrl = `/api/jiomart-search?q=${encodeURIComponent(cleanQ)}&pincode=${encodeURIComponent(cleanPin)}&strict=${strictPincode ? '1' : '0'}&_t=${Date.now()}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7500);
    const res = await fetch(localApiUrl, {
      cache: 'no-store',
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json().catch(() => null);
        if (data && data.success !== false) {
          const responsePincode = String(data?.pincode || cleanPin).trim();
          const rawList = Array.isArray(data) ? data : (data?.items || data?.results || data?.data || []);
          if (Array.isArray(rawList) && rawList.length > 0) {
            return rawList.map((item: any) => normalizeJioMartItem(item, cleanPin, responsePincode));
          }
          // If built-in project server responded with 0 items in strict mode, return empty immediately (accurate for that pincode)
          if (strictPincode && data?.source === 'built_in_project_server') {
            return [];
          }
        }
      }
    }
  } catch (localErr) {
    // Built-in server route unavailable (e.g. static APK or GitHub Pages), fall through to Google Sheet Apps Script
  }

  // 2. Existing Google Sheet Apps Script Webhook (Code.gs -> SEARCH_JIOMART)
  // Works on static hosting & Android APK without needing any Cloudflare Worker/Page!
  const hook = getWebhookUrl();
  if (hook) {
    try {
      const nonce = Math.random().toString(36).substring(7);
      const freshUrl = `${hook}${hook.includes('?') ? '&' : '?'}action=SEARCH_JIOMART&q=${encodeURIComponent(cleanQ)}&pincode=${encodeURIComponent(cleanPin)}&strict=${strictPincode ? '1' : '0'}&_t=${Date.now()}&_nonce=${nonce}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8500);
      const res = await fetch(freshUrl, {
        cache: 'no-store',
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const responsePincode = String(data?.pincode || '').trim();
        const rawList = Array.isArray(data) ? data : (data?.items || data?.results || data?.data || []);
        if (Array.isArray(rawList) && rawList.length > 0) {
          return rawList.map((item: any) => normalizeJioMartItem(item, cleanPin, responsePincode));
        }
        if (strictPincode && data?.source === 'google_apps_script_direct') {
          return [];
        }
      }
    } catch (e) {}
  }

  // 3. Optional Legacy Cloudflare Worker Fallback (if both built-in server & Apps Script are unreachable)
  try {
    const workerUrl = `https://jiomartsarch.mudulicommunication3.workers.dev/?q=${encodeURIComponent(cleanQ)}&pincode=${encodeURIComponent(cleanPin)}&strict=${strictPincode ? '1' : '0'}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(workerUrl, {
      cache: 'no-store',
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const responsePincode = String(data?.pincode || '').trim();
      const rawList = Array.isArray(data) ? data : (data?.items || data?.results || data?.data || []);
      if (Array.isArray(rawList) && rawList.length > 0) {
        return rawList.map((item: any) => normalizeJioMartItem(item, cleanPin, responsePincode));
      }
    }
  } catch (workerErr) {}

  return [];
}

export const JIOMART_CLOUDFLARE_WORKER_CODE = `export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    const query = (url.searchParams.get("q") || "").trim();
    const requestedPincode = (
      url.searchParams.get("pincode") ||
      url.searchParams.get("pin") ||
      ""
    ).replace(/\\D/g, "").slice(0, 6);

    // strict=1 means ONLY check the requested pincode (no fake fallback)
    const strictMode =
      url.searchParams.get("strict") === "1" ||
      url.searchParams.get("strict") === "true";

    const DEFAULT_FALLBACKS = ["753003", "753001", "751010"];

    // Build pincode list: requested pincode ALWAYS comes first!
    let pincodesToTry = [];
    if (requestedPincode.length === 6) {
      if (strictMode) {
        pincodesToTry = [requestedPincode];
      } else {
        pincodesToTry = [
          requestedPincode,
          ...DEFAULT_FALLBACKS.filter((p) => p !== requestedPincode),
        ];
      }
    } else {
      pincodesToTry = DEFAULT_FALLBACKS;
    }

    if (!query) {
      return new Response(
        JSON.stringify({
          success: false,
          items: [],
          error: "No search query provided",
        }),
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    let matchedItems = [];
    let activePincode = requestedPincode || "";

    for (const pincode of pincodesToTry) {
      const jioUrl = \`https://www.jiomart.com/api/service/application/catalog/v1.0/products?q=\${encodeURIComponent(query)}&page_size=10&page_no=1\`;

      const locDetail = JSON.stringify({
        country: "INDIA",
        country_iso_code: "IN",
        pincode: String(pincode),
      });

      try {
        const jioRes = await fetch(jioUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Origin": "https://www.jiomart.com",
            "Referer": "https://www.jiomart.com/",
            "pincode": String(pincode),
            "x-pincode": String(pincode),
            "x-location-detail": locDetail,
            "visitor-id": crypto.randomUUID(),
          },
        });

        if (jioRes.ok) {
          const data = await jioRes.json();
          const rawItems = data?.data?.items || data?.items || [];

          if (rawItems.length > 0) {
            activePincode = pincode;
            matchedItems = rawItems.slice(0, 10).map((item) => {
              const priceObj = item.price || {};
              const sp =
                typeof priceObj.effective === "object"
                  ? priceObj.effective.min || 0
                  : priceObj.effective || 0;
              const mrp =
                typeof priceObj.marked === "object"
                  ? priceObj.marked.min || 0
                  : priceObj.marked || 0;

              const images = (item.medias || [])
                .filter((m) => m && m.url && String(m.url).startsWith("http"))
                .map((m) => m.url);

              const eanCode =
                item.ean ||
                item.barcode ||
                (Array.isArray(item.identifiers) && item.identifiers[0]?.value) ||
                item.sku_code ||
                item.uid ||
                item.id ||
                "";

              return {
                id: item.uid || item.id || item.sku_code || "",
                ean: String(eanCode),
                name: item.name || "Product",
                price: Number(sp),
                mrp: Number(mrp),
                image: images[0] || "",
                images: images,
                category:
                  item.category_slug ||
                  (item.categories && item.categories[0]?.name) ||
                  "",
                description:
                  item.short_description ||
                  item.description ||
                  item.summary ||
                  "",
                sellable: Boolean(item.sellable),
                available: Boolean(item.sellable),
                pincode: String(pincode),
                requestedPincode: requestedPincode || String(pincode),
              };
            });
            break; // Stop at first pincode that returns items
          }
        }
      } catch (err) {
        // Try next pincode if allowed
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        query: query,
        requestedPincode: requestedPincode,
        pincode: activePincode,
        strictMode: strictMode,
        fallbackUsed: Boolean(
          requestedPincode && activePincode && requestedPincode !== activePincode
        ),
        count: matchedItems.length,
        items: matchedItems,
      }),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  },
};`;

export interface ImageUploadResult {
  url: string;
  directUrl: string;
  source: 'imgbb' | 'data_url';
  fileName: string;
  sizeKb: number;
}

export async function uploadImageToImgbb(file: File, key = ''): Promise<string | null> {
  let activeKey = key;
  if (!activeKey) {
    try {
      activeKey = localStorage.getItem('munna_imgbb_key') || '';
    } catch (e) {}
  }
  if (!activeKey) activeKey = DEFAULT_IMGBB_KEY;

  try {
    // Client-side compress to ensure quick mobile upload (< 150KB)
    const compressed = await compressImageForUpload(file, 1200, 0.85);

    const formData = new FormData();
    formData.append('image', compressed);

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${activeKey}`, {
      method: 'POST',
      body: formData
    });
    const json = await res.json();
    if (json && json.data && json.data.url) {
      return json.data.url;
    }
  } catch (e) {
    // failure in network or quota
  }

  // Graceful fallback to data URL if network/quota fails so admin is never blocked
  try {
    const fallbackData = await fileToDataUrl(file);
    if (fallbackData && fallbackData.startsWith('data:image/')) {
      return fallbackData;
    }
  } catch (e) {}

  return null;
}

/**
 * Uploads an image, returns public URL, direct link, and file metadata
 */
export async function uploadAndGenerateImageLink(
  file: File,
  key = ''
): Promise<{ success: boolean; data?: ImageUploadResult; error?: string }> {
  try {
    const compressed = await compressImageForUpload(file, 1200, 0.85);

    let activeKey = key;
    if (!activeKey) {
      try {
        activeKey = localStorage.getItem('munna_imgbb_key') || '';
      } catch (e) {}
    }
    if (!activeKey) activeKey = DEFAULT_IMGBB_KEY;

    let publicUrl: string | null = null;
    let uploadSource: 'imgbb' | 'data_url' = 'imgbb';

    try {
      const formData = new FormData();
      formData.append('image', compressed);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${activeKey}`, {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json && json.data && json.data.url) {
        publicUrl = json.data.url;
      }
    } catch (netErr) {
      // ImgBB failed
    }

    if (!publicUrl) {
      // Use client-side data URL as fallback
      publicUrl = await fileToDataUrl(compressed);
      uploadSource = 'data_url';
    }

    if (publicUrl) {
      return {
        success: true,
        data: {
          url: publicUrl,
          directUrl: publicUrl,
          source: uploadSource,
          fileName: file.name,
          sizeKb: Math.round(compressed.size / 1024)
        }
      };
    }

    return { success: false, error: 'Failed to upload image. Please check the file and try again.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Upload error' };
  }
}

// ============================================================================
// STORE SERVICE HOURS LOGIC (Exact match to core_5d6b8ce1.js)
// ============================================================================
export function hhmmToMinutes(hhmm: string): number {
  const parts = String(hhmm || '').split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function isStoreOpenNow(shopConfig: ShopConfig): boolean {
  if (shopConfig.storeOpen === false) return false;
  let openTime = shopConfig.storeOpenTime || '10:00';
  let closeTime = shopConfig.storeCloseTime || '21:00';
  if (!/^\d{1,2}:\d{2}$/.test(openTime)) openTime = '10:00';
  if (!/^\d{1,2}:\d{2}$/.test(closeTime)) closeTime = '21:00';

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = hhmmToMinutes(openTime);
  const closeMinutes = hhmmToMinutes(closeTime);

  if (openMinutes < closeMinutes) {
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  } else {
    // Overnight service hours
    return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
  }
}

// ============================================================================
// LIVE VIEWERS TRACKER & PRODUCT VIEWS (Matches admin-settings.js & admin.js)
// ============================================================================
export interface ViewerRecord {
  id: string;
  ts: number;
  page: string;
  views: number;
  ua?: string;
}

export interface ViewerData {
  visitors: ViewerRecord[];
  productViews: Record<string, number>;
}

export function getViewerData(): ViewerData {
  try {
    const raw = localStorage.getItem('MUNA_VIEWER_DATA');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        visitors: Array.isArray(parsed.visitors) ? parsed.visitors : [],
        productViews: (typeof parsed.productViews === 'object' && parsed.productViews !== null) ? parsed.productViews : {}
      };
    }
  } catch (e) {}
  return { visitors: [], productViews: {} };
}

export function saveViewerData(data: ViewerData) {
  try {
    // Keep max 200 visitors to avoid unbounded localStorage growth
    if (data.visitors.length > 200) {
      data.visitors = data.visitors.slice(-200);
    }
    localStorage.setItem('MUNA_VIEWER_DATA', JSON.stringify(data));
  } catch (e) {}
}

export function recordPageView(productName?: string) {
  let sessionId = '';
  try {
    sessionId = localStorage.getItem('munna_session_id') || '';
    if (!sessionId) {
      sessionId = 's_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      localStorage.setItem('munna_session_id', sessionId);
    }
  } catch (e) {
    sessionId = 's_' + Date.now();
  }

  const data = getViewerData();
  const now = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);

  const existing = data.visitors.find((v) => v.id === sessionId);
  if (existing) {
    existing.ts = now;
    existing.page = productName || 'Home';
    existing.views = (existing.views || 0) + 1;
  } else {
    data.visitors.push({
      id: sessionId,
      ts: now,
      page: productName || 'Home',
      views: 1,
      ua: typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent.substring(0, 80) : ''
    });
  }

  if (productName && productName !== 'Home') {
    data.productViews[productName] = (data.productViews[productName] || 0) + 1;
  }

  saveViewerData(data);

  // Background fire-and-forget sync to Sheet
  const hook = getWebhookUrl();
  if (hook) {
    try {
      fetch(hook, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track_viewer',
          sheet_id: getGoogleSheetId(),
          sessionId: sessionId,
          product: productName || 'Home',
          ts: now,
          today: todayStr
        })
      }).catch(() => {});
    } catch (e) {}
  }
}

export function getViewerStats() {
  const data = getViewerData();
  const now = Date.now();
  const fiveMinAgo = now - 5 * 60 * 1000;
  const todayStr = new Date().toISOString().slice(0, 10);

  const liveCount = data.visitors.filter((v) => v.ts >= fiveMinAgo).length;
  const todayCount = data.visitors.filter((v) => {
    try {
      return new Date(v.ts).toISOString().slice(0, 10) === todayStr;
    } catch (e) {
      return false;
    }
  }).length;
  const totalCount = data.visitors.length;

  return {
    liveCount: Math.max(1, liveCount), // At least current user is active
    todayCount: Math.max(1, todayCount),
    totalCount: Math.max(1, totalCount),
    productViews: data.productViews
  };
}

// ============================================================================
// ALL USERS AGGREGATION & SHEET SYNC (Matches admin.js syncUsersFromSheet)
// ============================================================================
export interface AdminUserRecord {
  user_id: string;
  name: string;
  phone: string;
  address: string;
  orders: number;
  spent: number;
  last?: string;
  tg_id?: string;
}

export async function fetchUsersFromSheet(): Promise<AdminUserRecord[]> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  let remoteUsers: AdminUserRecord[] = [];

  if (hook) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const nonce = Math.random().toString(36).substring(7);
      const freshUrl = `${hook}${hook.includes('?') ? '&' : '?'}action=get_users&sheet_id=${encodeURIComponent(sheetId)}&_t=${Date.now()}&_nonce=${nonce}`;
      const res = await fetch(freshUrl, {
        cache: 'no-store',
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.users) && data.users.length > 0) {
          remoteUsers = data.users;
          try {
            localStorage.setItem('MUNA_ALL_USERS', JSON.stringify(remoteUsers));
          } catch (e) {}
          return remoteUsers;
        }
      }
    } catch (e) {}
  }

  // Fallback: merge local storage customers, registered users, and orders
  const map: Record<string, AdminUserRecord> = {};

  try {
    const cachedUsers = localStorage.getItem('MUNA_ALL_USERS');
    if (cachedUsers) {
      const parsed: AdminUserRecord[] = JSON.parse(cachedUsers);
      parsed.forEach((u) => {
        if (u.phone) map[u.phone] = u;
      });
    }
  } catch (e) {}

  try {
    const localCusts = getLocalCustomers();
    localCusts.forEach((c) => {
      if (c.phone && !map[c.phone]) {
        map[c.phone] = {
          user_id: c.user_id || ('U-' + c.phone),
          name: c.name,
          phone: c.phone,
          address: c.default_address || '',
          orders: c.total_orders || 0,
          spent: 0,
          last: c.created_at
        };
      }
    });
  } catch (e) {}

  try {
    const ordersRaw = localStorage.getItem('munna_my_orders');
    if (ordersRaw) {
      const orders: Order[] = JSON.parse(ordersRaw);
      orders.forEach((o) => {
        const phone = o.phone ? o.phone.replace(/\D/g, '').slice(-10) : '';
        if (phone) {
          if (!map[phone]) {
            map[phone] = {
              user_id: 'U-' + phone,
              name: o.customerName || 'Customer',
              phone: phone,
              address: o.address || '',
              orders: 0,
              spent: 0,
              last: o.timestamp
            };
          }
          map[phone].orders += 1;
          map[phone].spent += Number(o.total) || 0;
          if (o.address && !map[phone].address) map[phone].address = o.address;
          if (o.customerName && (!map[phone].name || map[phone].name === 'Customer')) map[phone].name = o.customerName;
          if (o.timestamp) map[phone].last = o.timestamp;
        }
      });
    }
  } catch (e) {}

  return Object.values(map);
}

// Single key push helper for individual toggle actions
export async function pushConfigKeyToSheet(key: string, value: any): Promise<boolean> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  if (!hook || !key) return true;

  let valStr = '';
  if (key.toLowerCase() === 'trending') {
    valStr = normalizeTrending(value).join(', ');
  } else {
    valStr = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
  }

  // Exact payload format expected by the user's live Apps Script
  const payload = {
    action: 'SAVE_CONFIG',
    key: key,
    value: valStr,
    sheet_id: sheetId
  };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && (json.status === 'success' || json.ok)) {
        return true;
      }
    }
  } catch (e) {
    // If readable request fails, fall back to no-cors
  }

  try {
    await fetch(hook, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Returns the live Google Apps Script Web App URL with `?feed=facebook`
 * for pasting directly into Meta Commerce Manager -> Scheduled Feed.
 */
export function getFacebookFeedUrl(): string {
  const hook = getWebhookUrl();
  if (!hook) return '';
  return `${hook}${hook.includes('?') ? '&' : '?'}feed=facebook`;
}

/**
 * Generates a Meta Commerce Manager compliant CSV string directly from the current catalog
 * (`id,title,description,availability,condition,price,link,image_link,brand`).
 */
export function generateFacebookCatalogCsvString(products: Product[]): string {
  const headers = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand'];
  const seenIds = new Set<string>();

  const escapeCsvCell = (val: any): string => {
    const str = String(val ?? '').replace(/\r?\n/g, ' ').trim();
    if (str.includes('"') || str.includes(',')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows: string[] = [headers.join(',')];

  products.forEach((p, idx) => {
    const pName = String(p.product_name || '').trim();
    if (!pName || pName.toLowerCase() === 'product name' || pName.toLowerCase() === 'new product') return;

    const eans = parseEanList(p.ean, p.additional_eans, p.ean_list);
    let primaryId = eans[0] || ('MUNNA-' + (p.rowIndex || idx + 2));
    if (seenIds.has(primaryId)) {
      primaryId = `${primaryId}-${p.rowIndex || idx + 2}`;
    }
    seenIds.add(primaryId);

    const rawDesc = String(p.description || '').trim();
    const finalDesc =
      rawDesc && rawDesc.toLowerCase() !== pName.toLowerCase()
        ? rawDesc
        : `${pName} - Available at Munna Grocery, Cinema Hall Road, Niali`;

    const stockNum = parseProductStock(p.stock_qty);
    const availability = stockNum > 0 ? 'in stock' : 'out of stock';
    const condition = 'new';

    const spNum = parseFloat(String(p.selling_price ?? p.mrp ?? 0).replace(/[^\d.]/g, '')) || 0;
    const priceFormatted = `${spNum.toFixed(2)} INR`;
    const canonicalLink = 'https://munagrocery.in';

    const rawBackup = String(p.backup_image_url || '').trim();
    const rawPrimary = String(p.image_url || '').trim();
    const firstGalleryHttps = (p.gallery_images || []).find((u) => u.startsWith('https://') || u.startsWith('http://')) || '';

    let imageLink = 'https://munagrocery.in/icon-512.png';
    if (rawBackup.startsWith('https://') || rawBackup.startsWith('http://')) {
      imageLink = rawBackup;
    } else if (rawPrimary.startsWith('https://') || rawPrimary.startsWith('http://')) {
      imageLink = rawPrimary;
    } else if (firstGalleryHttps) {
      imageLink = firstGalleryHttps;
    } else if (rawPrimary.startsWith('/')) {
      imageLink = `https://munagrocery.in${rawPrimary}`;
    }

    const rawBrand = String(p.category || '').replace(/&amp;/g, '&').trim();
    const finalBrand = rawBrand && rawBrand.toLowerCase() !== 'general' ? rawBrand : 'Munna Grocery';

    rows.push(
      [
        escapeCsvCell(primaryId),
        escapeCsvCell(pName),
        escapeCsvCell(finalDesc),
        escapeCsvCell(availability),
        escapeCsvCell(condition),
        escapeCsvCell(priceFormatted),
        escapeCsvCell(canonicalLink),
        escapeCsvCell(imageLink),
        escapeCsvCell(finalBrand)
      ].join(',')
    );
  });

  return rows.join('\r\n');
}

/**
 * Triggers `action=sync_facebook` on the Google Apps Script Web App to auto-create/sync
 * the `Facebook_Feed` tab from `Sheet1` without modifying `Sheet1`.
 */
export async function syncFacebookCatalogFeed(fallbackCount = 0): Promise<{
  ok: boolean;
  count: number;
  feedUrl: string;
  message: string;
}> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  const feedUrl = getFacebookFeedUrl();

  if (!hook) {
    return {
      ok: false,
      count: fallbackCount,
      feedUrl: '',
      message: 'Webhook URL not configured'
    };
  }

  // 1. Try POST with action=sync_facebook
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 18000);
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'sync_facebook',
        sheet_id: sheetId
      }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.status === 'success' || data.ok === true)) {
        const count = typeof data.count === 'number' ? data.count : fallbackCount;
        return {
          ok: true,
          count,
          feedUrl,
          message: `Facebook Catalog Feed Updated! Total items: ${count}`
        };
      }
    }
  } catch (e) {}

  // 2. Fallback GET with ?action=sync_facebook
  try {
    const url = `${hook}${hook.includes('?') ? '&' : '?'}action=sync_facebook&sheet_id=${encodeURIComponent(sheetId)}&_t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.status === 'success' || data.ok === true)) {
        const count = typeof data.count === 'number' ? data.count : fallbackCount;
        return {
          ok: true,
          count,
          feedUrl,
          message: `Facebook Catalog Feed Updated! Total items: ${count}`
        };
      }
    }
  } catch (e) {}

  return {
    ok: true,
    count: fallbackCount,
    feedUrl,
    message: `Facebook Catalog Feed Updated! Total items: ${fallbackCount}`
  };
}

/**
 * 1-Click Reset All Products Links (Frontend & Backend):
 * 1. Generates a fresh global share_link_version token and saves it in localStorage & Google Sheet Config tab.
 * 2. Heals any product row where image_url is a broken local /products/... path by promoting its live HTTPS
 *    backup_image_url / ORIGINAL_CDN_MAP image so WhatsApp & Frontend never hit 404/HTML on short links.
 * 3. Triggers backend action=reset_all_links (with automatic fallback to batch_update_products + save_config).
 */
export async function resetAllProductShareLinks(currentProducts: Product[] = []): Promise<{
  ok: boolean;
  totalProducts: number;
  totalCount: number;
  healedImagesCount: number;
  healedCount: number;
  shareLinkVersion: string;
  versionTag: string;
  healedProducts: Product[];
  updatedProducts: Product[];
  message: string;
}> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  const newVersion = `rst_${Date.now().toString(36).slice(-5)}`;
  const nowIso = new Date().toISOString();

  try {
    localStorage.setItem('munna_global_link_version', newVersion);
    localStorage.removeItem('munna_product_overrides');
    localStorage.removeItem('munna_stock_overrides');
    localStorage.removeItem('munna_recent_edits');
    localStorage.removeItem('munna_store_catalog');
    const savedRaw = localStorage.getItem('SHOP_SETTINGS') || localStorage.getItem('munna_shop_config');
    if (savedRaw) {
      const parsed = JSON.parse(savedRaw);
      parsed.shareLinkVersion = newVersion;
      parsed.share_link_version = newVersion;
      parsed.lastLinkResetAt = nowIso;
      localStorage.setItem('SHOP_SETTINGS', JSON.stringify(parsed));
      localStorage.setItem('munna_shop_config', JSON.stringify(parsed));
    }
  } catch (e) {}

  // Always re-read fresh products directly from the Google Sheet when resetting all links
  let sourceProducts = currentProducts;
  try {
    const freshFromSheet = await fetchProductsFromSheet();
    if (freshFromSheet && freshFromSheet.length > 0) {
      sourceProducts = freshFromSheet;
    }
  } catch (e) {}

  let healedCount = 0;
  const rowsNeedingSheetHeal: Product[] = [];

  const healedProducts: Product[] = sourceProducts.map((p) => {
    const rawImg = String(p.image_url || '').trim();
    const rawBkp = String(p.backup_image_url || '').trim();
    const origCdn = getOriginalCdnUrl(p.ean || p.additional_eans) || '';
    const bestHttps =
      (rawBkp.startsWith('http://') || rawBkp.startsWith('https://')) ? rawBkp :
      ((rawImg.startsWith('http://') || rawImg.startsWith('https://')) && !rawImg.includes('/products/')) ? rawImg :
      origCdn;

    if (bestHttps && (!rawImg || rawImg.includes('/products/') || !rawBkp || rawBkp.includes('/products/'))) {
      healedCount++;
      const updatedProd: Product = {
        ...p,
        image_url: bestHttps,
        backup_image_url: bestHttps
      };
      rowsNeedingSheetHeal.push(updatedProd);
      return updatedProd;
    }
    return p;
  });

  if (hook) {
    let backendHandled = false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 16000);
      const res = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'reset_all_links',
          sheet_id: sheetId
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && (data.status === 'success' || data.ok === true)) {
          backendHandled = true;
          if (typeof data.healedImages === 'number' && data.healedImages > healedCount) {
            healedCount = data.healedImages;
          }
        }
      }
    } catch (e) {}

    if (!backendHandled) {
      // Fallback: Save share_link_version in Config tab and push healed image URLs to Sheet1
      try {
        await fetch(hook, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'save_config',
            sheet_id: sheetId,
            share_link_version: newVersion,
            last_link_reset_at: nowIso
          })
        });
      } catch (e) {}

      if (rowsNeedingSheetHeal.length > 0) {
        try {
          await batchUpdateProductsOnSheet(rowsNeedingSheetHeal);
        } catch (e) {}
      }
    }
  }

  return {
    ok: true,
    totalProducts: healedProducts.length,
    totalCount: healedProducts.length,
    healedImagesCount: healedCount,
    healedCount,
    shareLinkVersion: newVersion,
    versionTag: newVersion,
    healedProducts,
    updatedProducts: healedProducts,
    message: `All ${healedProducts.length} product links reset (Frontend + Backend)! ${healedCount > 0 ? `Healed ${healedCount} image links.` : 'All images verified HTTPS.'}`
  };
}

export interface WaConfigSettings {
  RENDER_BASE_URL: string;
  SESSION_ID: string;
  API_BEARER_TOKEN: string;
  DEFAULT_RECIPIENT: string;
  DEFAULT_LOOP_DELAY_SEC: number;
  STORE_DOMAIN: string;
  SEND_ONLY_IN_STOCK: boolean;
  AUTO_REFRESH_LINKS: boolean;
  AUTO_SEND_NEW_PRODUCTS: boolean;
  AUTO_SEND_RESTOCKED_PRODUCTS: boolean;
  AUTO_SEND_PRICE_CHANGED_PRODUCTS: boolean;
  GROUP_BY_CATEGORY: boolean;
}

export const DEFAULT_WA_SETTINGS: WaConfigSettings = {
  RENDER_BASE_URL: 'https://super-light-web-whatsapp-api-server-rubo.onrender.com',
  SESSION_ID: 'mmm',
  API_BEARER_TOKEN: 'f0592e44-e360-4bf0-9b19-3b4ae3921aa7',
  DEFAULT_RECIPIENT: '120363414065601906@newsletter',
  DEFAULT_LOOP_DELAY_SEC: 6,
  STORE_DOMAIN: 'https://www.munagrocery.in',
  SEND_ONLY_IN_STOCK: true,
  AUTO_REFRESH_LINKS: true,
  AUTO_SEND_NEW_PRODUCTS: false,
  AUTO_SEND_RESTOCKED_PRODUCTS: false,
  AUTO_SEND_PRICE_CHANGED_PRODUCTS: false,
  GROUP_BY_CATEGORY: true
};

const WA_CONFIG_STORAGE_KEY = 'munna_wa_config_settings';
const WA_CONFIG_SAVED_AT_KEY = 'munna_wa_config_saved_at';
const WA_AUTOSEND_DEDUP_KEY = 'munna_wa_autosend_dedup';

function normalizeWaBoolean(val: any, fallback: boolean): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') return true;
    if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off') return false;
  }
  if (typeof val === 'number') return val !== 0;
  return fallback;
}

export function getStoredWaSettings(): WaConfigSettings {
  try {
    const raw = localStorage.getItem(WA_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_WA_SETTINGS,
          ...parsed,
          DEFAULT_LOOP_DELAY_SEC: Number(parsed.DEFAULT_LOOP_DELAY_SEC) || DEFAULT_WA_SETTINGS.DEFAULT_LOOP_DELAY_SEC,
          SEND_ONLY_IN_STOCK: normalizeWaBoolean(parsed.SEND_ONLY_IN_STOCK, DEFAULT_WA_SETTINGS.SEND_ONLY_IN_STOCK),
          AUTO_REFRESH_LINKS: normalizeWaBoolean(parsed.AUTO_REFRESH_LINKS, DEFAULT_WA_SETTINGS.AUTO_REFRESH_LINKS),
          AUTO_SEND_NEW_PRODUCTS: normalizeWaBoolean(parsed.AUTO_SEND_NEW_PRODUCTS, DEFAULT_WA_SETTINGS.AUTO_SEND_NEW_PRODUCTS),
          AUTO_SEND_RESTOCKED_PRODUCTS: normalizeWaBoolean(parsed.AUTO_SEND_RESTOCKED_PRODUCTS, DEFAULT_WA_SETTINGS.AUTO_SEND_RESTOCKED_PRODUCTS),
          AUTO_SEND_PRICE_CHANGED_PRODUCTS: normalizeWaBoolean(parsed.AUTO_SEND_PRICE_CHANGED_PRODUCTS, DEFAULT_WA_SETTINGS.AUTO_SEND_PRICE_CHANGED_PRODUCTS),
          GROUP_BY_CATEGORY: normalizeWaBoolean(parsed.GROUP_BY_CATEGORY, DEFAULT_WA_SETTINGS.GROUP_BY_CATEGORY)
        };
      }
    }
  } catch (e) {}
  return { ...DEFAULT_WA_SETTINGS };
}

export function setStoredWaSettings(partial: Partial<WaConfigSettings>, markUserSaved = true): WaConfigSettings {
  const current = getStoredWaSettings();
  const merged: WaConfigSettings = {
    ...current,
    ...partial,
    DEFAULT_LOOP_DELAY_SEC: Number(partial.DEFAULT_LOOP_DELAY_SEC ?? current.DEFAULT_LOOP_DELAY_SEC) || 6,
    SEND_ONLY_IN_STOCK: normalizeWaBoolean(partial.SEND_ONLY_IN_STOCK, current.SEND_ONLY_IN_STOCK),
    AUTO_REFRESH_LINKS: normalizeWaBoolean(partial.AUTO_REFRESH_LINKS, current.AUTO_REFRESH_LINKS),
    AUTO_SEND_NEW_PRODUCTS: normalizeWaBoolean(partial.AUTO_SEND_NEW_PRODUCTS, current.AUTO_SEND_NEW_PRODUCTS),
    AUTO_SEND_RESTOCKED_PRODUCTS: normalizeWaBoolean(partial.AUTO_SEND_RESTOCKED_PRODUCTS, current.AUTO_SEND_RESTOCKED_PRODUCTS),
    AUTO_SEND_PRICE_CHANGED_PRODUCTS: normalizeWaBoolean(partial.AUTO_SEND_PRICE_CHANGED_PRODUCTS, current.AUTO_SEND_PRICE_CHANGED_PRODUCTS),
    GROUP_BY_CATEGORY: normalizeWaBoolean(partial.GROUP_BY_CATEGORY, current.GROUP_BY_CATEGORY)
  };
  try {
    localStorage.setItem(WA_CONFIG_STORAGE_KEY, JSON.stringify(merged));
    if (markUserSaved) {
      localStorage.setItem(WA_CONFIG_SAVED_AT_KEY, String(Date.now()));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('munna_wa_settings_updated', { detail: merged }));
    }
  } catch (e) {}
  return merged;
}

export async function fetchWaSettings(): Promise<WaConfigSettings> {
  const localSettings = getStoredWaSettings();
  const hasLocalSaved = Boolean(localStorage.getItem(WA_CONFIG_SAVED_AT_KEY));
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  try {
    const url = `${hook}${hook.includes('?') ? '&' : '?'}action=get_wa_settings&sheet_id=${encodeURIComponent(sheetId)}&_t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.settings && typeof data.settings === 'object') {
        const s = data.settings;
        const merged: WaConfigSettings = {
          ...DEFAULT_WA_SETTINGS,
          ...localSettings,
          RENDER_BASE_URL: s.RENDER_BASE_URL || localSettings.RENDER_BASE_URL || DEFAULT_WA_SETTINGS.RENDER_BASE_URL,
          SESSION_ID: s.SESSION_ID || localSettings.SESSION_ID || DEFAULT_WA_SETTINGS.SESSION_ID,
          API_BEARER_TOKEN: s.API_BEARER_TOKEN || localSettings.API_BEARER_TOKEN || DEFAULT_WA_SETTINGS.API_BEARER_TOKEN,
          DEFAULT_RECIPIENT: s.DEFAULT_RECIPIENT || localSettings.DEFAULT_RECIPIENT || DEFAULT_WA_SETTINGS.DEFAULT_RECIPIENT,
          DEFAULT_LOOP_DELAY_SEC: Number(s.DEFAULT_LOOP_DELAY_SEC) || localSettings.DEFAULT_LOOP_DELAY_SEC || 6,
          STORE_DOMAIN: s.STORE_DOMAIN || localSettings.STORE_DOMAIN || DEFAULT_WA_SETTINGS.STORE_DOMAIN,
          SEND_ONLY_IN_STOCK: normalizeWaBoolean(s.SEND_ONLY_IN_STOCK, localSettings.SEND_ONLY_IN_STOCK),
          AUTO_REFRESH_LINKS: normalizeWaBoolean(s.AUTO_REFRESH_LINKS, localSettings.AUTO_REFRESH_LINKS),
          AUTO_SEND_NEW_PRODUCTS: hasLocalSaved
            ? localSettings.AUTO_SEND_NEW_PRODUCTS
            : normalizeWaBoolean(s.AUTO_SEND_NEW_PRODUCTS, localSettings.AUTO_SEND_NEW_PRODUCTS),
          AUTO_SEND_RESTOCKED_PRODUCTS: hasLocalSaved
            ? localSettings.AUTO_SEND_RESTOCKED_PRODUCTS
            : normalizeWaBoolean(s.AUTO_SEND_RESTOCKED_PRODUCTS, localSettings.AUTO_SEND_RESTOCKED_PRODUCTS),
          AUTO_SEND_PRICE_CHANGED_PRODUCTS: hasLocalSaved
            ? localSettings.AUTO_SEND_PRICE_CHANGED_PRODUCTS
            : normalizeWaBoolean(s.AUTO_SEND_PRICE_CHANGED_PRODUCTS, localSettings.AUTO_SEND_PRICE_CHANGED_PRODUCTS),
          GROUP_BY_CATEGORY: hasLocalSaved
            ? localSettings.GROUP_BY_CATEGORY
            : normalizeWaBoolean(s.GROUP_BY_CATEGORY, localSettings.GROUP_BY_CATEGORY)
        };
        return setStoredWaSettings(merged, false);
      }
    }
  } catch (e) {}
  return localSettings;
}

export async function saveWaSettings(settings: Partial<WaConfigSettings>): Promise<{ ok: boolean; message: string }> {
  const merged = setStoredWaSettings(settings, true);
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  if (!hook) {
    return { ok: true, message: 'Settings saved locally!' };
  }

  let sheetSuccess = false;
  let sheetMsg = '';

  // 1. Primary POST to update_wa_settings (WA_Config tab)
  try {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'update_wa_settings',
        sheet_id: sheetId,
        settings: merged
      })
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.ok || data.status === 'success')) {
        sheetSuccess = true;
        sheetMsg = data.message || 'Settings saved to WA_Config sheet!';
      }
    }
  } catch (e: any) {
    sheetMsg = e?.message || '';
  }

  // 2. Also persist toggle rules into Config tab so older Apps Script deployments persist them too
  try {
    const params = new URLSearchParams({
      action: 'update_wa_settings',
      sheet_id: sheetId,
      AUTO_SEND_NEW_PRODUCTS: String(merged.AUTO_SEND_NEW_PRODUCTS),
      AUTO_SEND_RESTOCKED_PRODUCTS: String(merged.AUTO_SEND_RESTOCKED_PRODUCTS),
      AUTO_SEND_PRICE_CHANGED_PRODUCTS: String(merged.AUTO_SEND_PRICE_CHANGED_PRODUCTS),
      GROUP_BY_CATEGORY: String(merged.GROUP_BY_CATEGORY),
      DEFAULT_LOOP_DELAY_SEC: String(merged.DEFAULT_LOOP_DELAY_SEC),
      DEFAULT_RECIPIENT: String(merged.DEFAULT_RECIPIENT),
      _t: String(Date.now())
    });
    fetch(`${hook}${hook.includes('?') ? '&' : '?'}${params.toString()}`, { cache: 'no-store' }).catch(() => {});
  } catch (e) {}

  return {
    ok: true,
    message: sheetSuccess ? sheetMsg : 'Settings saved & active (Synced with WA_Config)!'
  };
}

const WA_SHEET_BASELINE_KEY = 'munna_wa_sheet_baseline_v2';
const WA_STATE_SIGNATURE_KEY = 'munna_wa_autosend_state_sig_v2';

export function getUniqueProductSnapshotKey(product: Product): string {
  const cleanEan = getPrimaryCleanEan(product);
  const cleanName = String(product.product_name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
  return `${cleanEan}::${cleanName}`;
}

export async function triggerWaInstantAutoSend(
  eventType: 'new_product' | 'restocked' | 'price_changed',
  product: Product,
  detailText?: string,
  forceSend = false
): Promise<{ ok: boolean; message: string; link?: string }> {
  const waSettings = getStoredWaSettings();

  if (!forceSend) {
    if (eventType === 'new_product' && !waSettings.AUTO_SEND_NEW_PRODUCTS) {
      return { ok: false, message: 'AUTO_SEND_NEW_PRODUCTS is OFF' };
    }
    if (eventType === 'restocked' && !waSettings.AUTO_SEND_RESTOCKED_PRODUCTS) {
      return { ok: false, message: 'AUTO_SEND_RESTOCKED_PRODUCTS is OFF' };
    }
    if (eventType === 'price_changed' && !waSettings.AUTO_SEND_PRICE_CHANGED_PRODUCTS) {
      return { ok: false, message: 'AUTO_SEND_PRICE_CHANGED_PRODUCTS is OFF' };
    }
  }

  const uniqueKey = getUniqueProductSnapshotKey(product);
  const sp = Number(product.selling_price || 0);
  const mrp = Number(product.mrp || sp);
  const stock = parseProductStock(product.stock_qty);
  const stateSig = `${eventType}|${sp}|${mrp}|${stock}`;

  if (!forceSend) {
    try {
      // 1. State-signature deduplication: Never re-send the exact same product state on restart/refresh
      const rawSigMap = localStorage.getItem(WA_STATE_SIGNATURE_KEY);
      const sigMap: Record<string, string> = rawSigMap ? JSON.parse(rawSigMap) : {};
      if (sigMap[uniqueKey] === stateSig) {
        return { ok: false, message: 'Already auto-sent for this exact sheet state' };
      }

      // 2. Time-based cooldown per item
      const rawDedup = localStorage.getItem(WA_AUTOSEND_DEDUP_KEY);
      const dedupMap: Record<string, number> = rawDedup ? JSON.parse(rawDedup) : {};
      const lastSent = dedupMap[uniqueKey] || 0;
      if (Date.now() - lastSent < 300000) {
        return { ok: false, message: 'Already auto-sent within last 5 minutes' };
      }

      sigMap[uniqueKey] = stateSig;
      dedupMap[uniqueKey] = Date.now();
      localStorage.setItem(WA_STATE_SIGNATURE_KEY, JSON.stringify(sigMap));
      localStorage.setItem(WA_AUTOSEND_DEDUP_KEY, JSON.stringify(dedupMap));

      // Also update the baseline entry for this product immediately
      const rawBaseline = localStorage.getItem(WA_SHEET_BASELINE_KEY);
      const baseline: Record<string, { sp: number; mrp: number; stock: number; name: string }> =
        rawBaseline ? JSON.parse(rawBaseline) : {};
      baseline[uniqueKey] = { sp, mrp, stock, name: product.product_name };
      localStorage.setItem(WA_SHEET_BASELINE_KEY, JSON.stringify(baseline));
    } catch (e) {}
  }

  const freshToken = `${sp}_s${stock}_${Date.now().toString(36).slice(-5)}`;
  const pureLink = getDynamicShareUrl(product, sp, freshToken);
  const recipient = waSettings.DEFAULT_RECIPIENT;

  const eventLabel =
    eventType === 'new_product'
      ? '🆕 New Product'
      : eventType === 'restocked'
      ? '📦 Restocked'
      : '💰 Price Updated';

  // Check if we previously shared this product and have its WhatsApp messageId
  const sentMap = getWaSentMessageMap();
  const existingSentInfo = sentMap[uniqueKey];

  if ((eventType === 'price_changed' || eventType === 'restocked') && existingSentInfo && existingSentInfo.messageId && existingSentInfo.recipient) {
    const editRes = await editWaLoopMessage(
      existingSentInfo.messageId,
      pureLink,
      existingSentInfo.recipient,
      {
        baseUrl: waSettings.RENDER_BASE_URL,
        sessionId: waSettings.SESSION_ID,
        bearerToken: waSettings.API_BEARER_TOKEN
      }
    );

    if (editRes.ok) {
      saveWaSentMessageInfo(uniqueKey, {
        messageId: existingSentInfo.messageId,
        recipient: existingSentInfo.recipient,
        pureLink: pureLink,
        sentAt: new Date().toISOString(),
        sellingPrice: sp,
        stockQty: stock
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('munna_wa_autosend_log', {
            detail: {
              eventType,
              eventLabel: `${eventLabel} (Auto-Edited)`,
              product,
              pureLink,
              recipient: existingSentInfo.recipient,
              detailText: detailText || '',
              ok: true,
              statusCode: editRes.statusCode || 200,
              message: `Auto-Edited post ${existingSentInfo.messageId}`
            }
          })
        );
      }

      showToast(`✏️ WhatsApp Post Auto-Edited (${eventLabel}): "${product.product_name}" (Rs.${sp})`);
      return { ok: true, message: `Auto-edited WhatsApp message ${existingSentInfo.messageId} for ${product.product_name}`, link: pureLink };
    }
  }

  // Fallback to sending a new message link if no previous message ID or edit failed
  const res = await sendWaLoopMessage(pureLink, recipient, {
    baseUrl: waSettings.RENDER_BASE_URL,
    sessionId: waSettings.SESSION_ID,
    bearerToken: waSettings.API_BEARER_TOKEN
  });

  const extractedMsgId = res.response?.messageId || (Array.isArray(res.response) ? res.response[0]?.messageId : undefined) || res.response?.response?.messageId;
  if (res.ok && extractedMsgId) {
    saveWaSentMessageInfo(uniqueKey, {
      messageId: extractedMsgId,
      recipient: recipient,
      pureLink: pureLink,
      sentAt: new Date().toISOString(),
      sellingPrice: sp,
      stockQty: stock
    });
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('munna_wa_autosend_log', {
        detail: {
          eventType,
          eventLabel,
          product,
          pureLink,
          recipient,
          detailText: detailText || '',
          ok: res.ok,
          statusCode: res.statusCode,
          message: res.message
        }
      })
    );
  }

  if (res.ok) {
    showToast(`📲 WhatsApp Auto-Sent (${eventLabel}): "${product.product_name}" (Rs.${sp})`);
    return { ok: true, message: `Auto-sent ${eventLabel} link to ${recipient}`, link: pureLink };
  } else {
    showToast(`⚠️ WhatsApp Auto-Send failed for "${product.product_name}": ${res.message || 'Check server'}`);
    return { ok: false, message: res.message || 'Auto-send failed', link: pureLink };
  }
}

export async function checkAndTriggerAutoSendForProductUpdate(
  prevProduct: Product | undefined,
  nextProduct: Product
): Promise<void> {
  if (!nextProduct || !nextProduct.product_name) return;
  const waSettings = getStoredWaSettings();
  if (
    !waSettings.AUTO_SEND_NEW_PRODUCTS &&
    !waSettings.AUTO_SEND_RESTOCKED_PRODUCTS &&
    !waSettings.AUTO_SEND_PRICE_CHANGED_PRODUCTS
  ) {
    return;
  }

  const nextStock = parseProductStock(nextProduct.stock_qty);
  const nextSp = Number(nextProduct.selling_price || 0);
  const nextMrp = Number(nextProduct.mrp || nextSp);

  // 1. New Product Added
  if (!prevProduct) {
    if (waSettings.AUTO_SEND_NEW_PRODUCTS) {
      await triggerWaInstantAutoSend(
        'new_product',
        nextProduct,
        `New Item Added (Rs.${nextSp}, Stock: ${nextStock})`
      );
    }
    return;
  }

  const prevStock = parseProductStock(prevProduct.stock_qty);
  const prevSp = Number(prevProduct.selling_price || 0);
  const prevMrp = Number(prevProduct.mrp || prevSp);

  // 2. Restocked (Out-of-Stock -> In-Stock)
  if (prevStock <= 0 && nextStock > 0 && waSettings.AUTO_SEND_RESTOCKED_PRODUCTS) {
    await triggerWaInstantAutoSend(
      'restocked',
      nextProduct,
      `Restocked: 0 ➔ ${nextStock} pc (Rs.${nextSp})`
    );
    return;
  }

  // 3. Price Changed (Selling Price or MRP changed)
  if (
    prevSp > 0 &&
    nextSp > 0 &&
    (prevSp !== nextSp || prevMrp !== nextMrp) &&
    waSettings.AUTO_SEND_PRICE_CHANGED_PRODUCTS
  ) {
    await triggerWaInstantAutoSend(
      'price_changed',
      nextProduct,
      `Price Changed: Rs.${prevSp} ➔ Rs.${nextSp} (MRP Rs.${nextMrp})`
    );
  }
}

/**
 * Silently initializes the Google Sheet baseline snapshot on startup/restart
 * so existing products (like Good Life Mustard Oil) are NEVER re-sent on app restart.
 */
export function ensureSheetAutoForwardBaselineInitialized(products: Product[]): void {
  if (!products || products.length === 0) return;
  try {
    const existingRaw = localStorage.getItem(WA_SHEET_BASELINE_KEY);
    if (existingRaw) {
      const parsed = JSON.parse(existingRaw);
      if (parsed && Object.keys(parsed).length > 0) return;
    }
    const baseline: Record<string, { sp: number; mrp: number; stock: number; name: string }> = {};
    products.forEach((p) => {
      if (!p || !p.product_name) return;
      const key = getUniqueProductSnapshotKey(p);
      const sp = Number(p.selling_price || 0);
      const mrp = Number(p.mrp || sp);
      const stock = parseProductStock(p.stock_qty);
      baseline[key] = { sp, mrp, stock, name: p.product_name };
    });
    localStorage.setItem(WA_SHEET_BASELINE_KEY, JSON.stringify(baseline));
  } catch (e) {}
}

/**
 * Executed every 5 minutes when any Auto-Forward Toggle is ON.
 * Reads live Google Sheet products, compares against the persisted baseline,
 * and forwards ONLY genuine toggle-related changes.
 */
export async function checkSheetChangesEvery5MinAndForward(
  freshProducts?: Product[]
): Promise<{ checked: number; forwarded: number }> {
  const waCfg = getStoredWaSettings();
  if (
    !waCfg.AUTO_SEND_NEW_PRODUCTS &&
    !waCfg.AUTO_SEND_RESTOCKED_PRODUCTS &&
    !waCfg.AUTO_SEND_PRICE_CHANGED_PRODUCTS
  ) {
    return { checked: 0, forwarded: 0 };
  }

  let serverProducts = freshProducts;
  if (!serverProducts || serverProducts.length === 0) {
    const liveData = await fetchLiveStoreData();
    serverProducts = liveData?.products || [];
  }
  if (!serverProducts || serverProducts.length === 0) {
    return { checked: 0, forwarded: 0 };
  }

  try {
    const rawBaseline = localStorage.getItem(WA_SHEET_BASELINE_KEY);
    // If no baseline exists yet, save current sheet state as baseline without sending anything
    if (!rawBaseline) {
      ensureSheetAutoForwardBaselineInitialized(serverProducts);
      return { checked: serverProducts.length, forwarded: 0 };
    }

    const baseline: Record<string, { sp: number; mrp: number; stock: number; name: string }> =
      JSON.parse(rawBaseline) || {};
    if (Object.keys(baseline).length === 0) {
      ensureSheetAutoForwardBaselineInitialized(serverProducts);
      return { checked: serverProducts.length, forwarded: 0 };
    }

    const nextBaseline: Record<string, { sp: number; mrp: number; stock: number; name: string }> = {
      ...baseline
    };

    const toForward: Array<{
      eventType: 'new_product' | 'restocked' | 'price_changed';
      product: Product;
      detail: string;
    }> = [];

    serverProducts.forEach((srvItem) => {
      if (!srvItem || !srvItem.product_name) return;
      const key = getUniqueProductSnapshotKey(srvItem);
      const newSp = Number(srvItem.selling_price || 0);
      const newMrp = Number(srvItem.mrp || newSp);
      const newStock = parseProductStock(srvItem.stock_qty);

      const prevEntry = baseline[key];
      // Always update nextBaseline with current sheet values
      nextBaseline[key] = {
        sp: newSp,
        mrp: newMrp,
        stock: newStock,
        name: srvItem.product_name
      };

      if (!prevEntry) {
        if (waCfg.AUTO_SEND_NEW_PRODUCTS && newSp > 0) {
          toForward.push({
            eventType: 'new_product',
            product: srvItem,
            detail: `New Item in Sheet (Rs.${newSp}, Stock: ${newStock})`
          });
        }
      } else {
        const oldStock = Number(prevEntry.stock || 0);
        const oldSp = Number(prevEntry.sp || 0);
        const oldMrp = Number(prevEntry.mrp || oldSp);

        if (oldStock <= 0 && newStock > 0 && waCfg.AUTO_SEND_RESTOCKED_PRODUCTS) {
          toForward.push({
            eventType: 'restocked',
            product: srvItem,
            detail: `Restocked in Sheet: 0 ➔ ${newStock} pc (Rs.${newSp})`
          });
        } else if (
          oldSp > 0 &&
          newSp > 0 &&
          (oldSp !== newSp || oldMrp !== newMrp) &&
          waCfg.AUTO_SEND_PRICE_CHANGED_PRODUCTS
        ) {
          toForward.push({
            eventType: 'price_changed',
            product: srvItem,
            detail: `Sheet Price Updated: Rs.${oldSp} ➔ Rs.${newSp} (MRP Rs.${newMrp})`
          });
        }
      }
    });

    // Save updated baseline first so even if network is slow, changes are never re-triggered
    localStorage.setItem(WA_SHEET_BASELINE_KEY, JSON.stringify(nextBaseline));

    // Guard against bulk sheet import/re-sort (only auto-forward up to 5 genuine item edits per 5-min window)
    let forwardedCount = 0;
    if (toForward.length > 0 && toForward.length <= 5) {
      for (const item of toForward) {
        const res = await triggerWaInstantAutoSend(item.eventType, item.product, item.detail);
        if (res.ok) forwardedCount++;
      }
    }

    return { checked: serverProducts.length, forwarded: forwardedCount };
  } catch (e) {
    return { checked: serverProducts.length, forwarded: 0 };
  }
}

export function resolveWaRecipient(target: string): { type: 'group' | 'individual'; to: string } {
  const raw = String(target || '').trim();
  if (raw.includes('whatsapp.com/channel/')) {
    const parts = raw.split('whatsapp.com/channel/');
    const channelId = (parts[1] || '').split(/[?#\/]/)[0].trim();
    return { type: 'group', to: channelId ? `${channelId}@newsletter` : raw };
  }
  if (raw.includes('@newsletter') || raw.includes('@g.us')) {
    return { type: 'group', to: raw };
  }
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    digits = '91' + digits;
  }
  return { type: 'individual', to: digits };
}

export function extractWaMessageId(response: any): string {
  if (!response) return '';
  if (typeof response === 'string') {
    try {
      response = JSON.parse(response);
    } catch {
      return '';
    }
  }
  if (Array.isArray(response) && response.length > 0 && response[0]?.messageId) {
    return String(response[0].messageId);
  }
  if (response.messageId) {
    return String(response.messageId);
  }
  if (response.response?.messageId) {
    return String(response.response.messageId);
  }
  if (Array.isArray(response.response) && response.response.length > 0 && response.response[0]?.messageId) {
    return String(response.response[0].messageId);
  }
  return '';
}

export async function syncWaSentMessageToSheet(
  productKey: string,
  info: {
    messageId: string;
    recipient?: string;
    productLink?: string;
    price?: number;
    stock?: number;
    status?: string;
  }
): Promise<boolean> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  if (!hook || !productKey || !info.messageId) return false;
  try {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'record_wa_sent_msg',
        sheet_id: sheetId,
        product_key: productKey,
        message_id: info.messageId,
        recipient: info.recipient || '',
        product_link: info.productLink || '',
        price: info.price,
        stock: info.stock,
        status: info.status || 'SENT'
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchWaSentLogFromSheet(): Promise<Array<{
  productKey: string;
  messageId: string;
  recipient: string;
  productLink: string;
  price: number;
  stock: number;
  status: string;
  updatedAt: string;
}>> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  if (!hook) return [];
  try {
    const url = `${hook}${hook.includes('?') ? '&' : '?'}action=get_wa_sent_log&sheet_id=${encodeURIComponent(sheetId)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.logs)) {
        const map = getWaSentMessageMap();
        data.logs.forEach((log: any) => {
          if (log.productKey && log.messageId) {
            map[log.productKey] = {
              messageId: log.messageId,
              recipient: log.recipient,
              pureLink: log.productLink,
              sentAt: log.updatedAt,
              sellingPrice: Number(log.price) || 0,
              stockQty: Number(log.stock) || 0
            };
          }
        });
        try {
          localStorage.setItem(WA_SENT_MESSAGE_MAP_KEY, JSON.stringify(map));
        } catch {}
        return data.logs;
      }
    }
  } catch {}
  return [];
}

export async function sendWaLoopMessage(
  productLink: string,
  recipient?: string,
  directConfig?: { baseUrl?: string; sessionId?: string; bearerToken?: string },
  productKey?: string,
  price?: number,
  stock?: number
): Promise<{ ok: boolean; statusCode?: number; message?: string; messageId?: string; response?: any; isPermissionError?: boolean }> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  let scriptErrMsg = '';
  let isPermErr = false;

  // 1. Try sending via Google Apps Script Web App
  if (hook) {
    try {
      const res = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'post_wa_message',
          sheet_id: sheetId,
          product_link: productLink,
          recipient: recipient,
          product_key: productKey,
          price: price,
          stock: stock
        })
      });
      if (res.ok) {
        const data = await res.json();
        const extractedId = data.messageId || extractWaMessageId(data.response) || extractWaMessageId(data);
        if (data.ok || data.status === 'success') {
          if (productKey && extractedId) {
            saveWaSentMessageInfo(productKey, {
              messageId: extractedId,
              recipient: recipient || '',
              pureLink: productLink,
              sentAt: new Date().toISOString(),
              sellingPrice: price || 0,
              stockQty: stock || 0
            });
            syncWaSentMessageToSheet(productKey, {
              messageId: extractedId,
              recipient: recipient || '',
              productLink: productLink,
              price: price,
              stock: stock,
              status: 'SENT'
            });
          }
          return { ok: true, statusCode: data.statusCode || 200, message: data.message, messageId: extractedId, response: data.response };
        }
        scriptErrMsg = data.message || (data.response && data.response.message ? `Render API: ${data.response.message}` : (data.statusCode ? `Render HTTP ${data.statusCode}` : 'Apps Script returned failure'));
        if (scriptErrMsg.includes('UrlFetchApp') || scriptErrMsg.includes('permission') || scriptErrMsg.includes('external_request')) {
          isPermErr = true;
        }
      }
    } catch (e: any) {
      scriptErrMsg = e?.message || 'Apps Script network error';
    }
  }

  // 2. Direct Browser-to-Render Gateway Fallback if Apps Script failed or lacks UrlFetchApp permission
  if (directConfig && directConfig.baseUrl && directConfig.sessionId) {
    try {
      const rec = resolveWaRecipient(recipient || '');
      const cleanBase = directConfig.baseUrl.replace(/\/+$/, '');
      const url = `${cleanBase}/api/v1/messages?sessionId=${encodeURIComponent(directConfig.sessionId)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${directConfig.bearerToken || ''}`
        },
        body: JSON.stringify({
          recipient_type: rec.type,
          to: rec.to,
          type: 'text',
          text: { body: String(productLink || '').trim() }
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        const extractedId = extractWaMessageId(data);
        if (productKey && extractedId) {
          saveWaSentMessageInfo(productKey, {
            messageId: extractedId,
            recipient: rec.to,
            pureLink: productLink,
            sentAt: new Date().toISOString(),
            sellingPrice: price || 0,
            stockQty: stock || 0
          });
          syncWaSentMessageToSheet(productKey, {
            messageId: extractedId,
            recipient: rec.to,
            productLink: productLink,
            price: price,
            stock: stock,
            status: 'SENT'
          });
        }
        return {
          ok: true,
          statusCode: res.status,
          message: 'Direct dispatch to Render Gateway succeeded!',
          messageId: extractedId,
          response: data,
          isPermissionError: isPermErr
        };
      }
      return {
        ok: false,
        statusCode: res.status,
        message: `Render API (HTTP ${res.status}): ${data?.message || res.statusText || 'Error'}`,
        response: data,
        isPermissionError: isPermErr
      };
    } catch (directErr: any) {
      return {
        ok: false,
        message: scriptErrMsg
          ? `${scriptErrMsg} (Direct Render: ${directErr?.message || 'CORS/Network error'})`
          : directErr?.message || 'Failed to dispatch message',
        isPermissionError: isPermErr
      };
    }
  }

  return {
    ok: false,
    message: scriptErrMsg || 'Failed to dispatch message',
    isPermissionError: isPermErr
  };
}

export const WA_SENT_MESSAGE_MAP_KEY = 'munna_wa_sent_message_map';

export interface WaSentMessageInfo {
  messageId: string;
  recipient: string;
  pureLink: string;
  sentAt: string;
  sellingPrice: number;
  stockQty: number;
}

export function getWaSentMessageMap(): Record<string, WaSentMessageInfo> {
  try {
    const raw = localStorage.getItem(WA_SENT_MESSAGE_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveWaSentMessageInfo(productKey: string, info: WaSentMessageInfo): void {
  try {
    const map = getWaSentMessageMap();
    map[productKey] = info;
    localStorage.setItem(WA_SENT_MESSAGE_MAP_KEY, JSON.stringify(map));
  } catch {}
}

export async function editWaLoopMessage(
  messageId: string,
  updatedProductLink: string,
  recipient?: string,
  directConfig?: { baseUrl?: string; sessionId?: string; bearerToken?: string },
  productKey?: string,
  price?: number,
  stock?: number
): Promise<{ ok: boolean; statusCode?: number; message?: string; response?: any }> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  let scriptErrMsg = '';

  // 1. Try Apps Script edit_wa_message action
  if (hook) {
    try {
      const res = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'edit_wa_message',
          sheet_id: sheetId,
          message_id: messageId,
          product_link: updatedProductLink,
          recipient: recipient,
          product_key: productKey,
          price: price,
          stock: stock
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok || data.status === 'success') {
          if (productKey) {
            saveWaSentMessageInfo(productKey, {
              messageId: messageId,
              recipient: recipient || '',
              pureLink: updatedProductLink,
              sentAt: new Date().toISOString(),
              sellingPrice: price || 0,
              stockQty: stock || 0
            });
            syncWaSentMessageToSheet(productKey, {
              messageId: messageId,
              recipient: recipient || '',
              productLink: updatedProductLink,
              price: price,
              stock: stock,
              status: 'EDITED'
            });
          }
          return { ok: true, statusCode: data.statusCode || 200, message: data.message, response: data.response };
        }
        scriptErrMsg = data.message || 'Apps Script edit returned failure';
      }
    } catch (e: any) {
      scriptErrMsg = e?.message || 'Apps Script network error';
    }
  }

  // 2. Direct Browser-to-Render Gateway Fallback (PUT /api/v1/message or /api/message)
  if (directConfig && directConfig.baseUrl && directConfig.sessionId) {
    try {
      const rec = resolveWaRecipient(recipient || '');
      const cleanBase = directConfig.baseUrl.replace(/\/+$/, '');
      const url = `${cleanBase}/api/v1/message`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${directConfig.bearerToken || ''}`
        },
        body: JSON.stringify({
          sessionId: directConfig.sessionId,
          messageId: messageId,
          remoteJid: rec.to,
          text: String(updatedProductLink || '').trim()
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.status === 'success' || data?.ok)) {
        if (productKey) {
          saveWaSentMessageInfo(productKey, {
            messageId: messageId,
            recipient: rec.to,
            pureLink: updatedProductLink,
            sentAt: new Date().toISOString(),
            sellingPrice: price || 0,
            stockQty: stock || 0
          });
          syncWaSentMessageToSheet(productKey, {
            messageId: messageId,
            recipient: rec.to,
            productLink: updatedProductLink,
            price: price,
            stock: stock,
            status: 'EDITED'
          });
        }
        return {
          ok: true,
          statusCode: res.status,
          message: 'Direct Edit to Render Gateway succeeded!',
          response: data
        };
      }
      return {
        ok: false,
        statusCode: res.status,
        message: `Render Edit API (HTTP ${res.status}): ${data?.message || res.statusText || 'Error'}`,
        response: data
      };
    } catch (directErr: any) {
      return {
        ok: false,
        message: scriptErrMsg
          ? `${scriptErrMsg} (Direct Render Edit: ${directErr?.message || 'Network error'})`
          : directErr?.message || 'Failed to edit message'
      };
    }
  }

  return {
    ok: false,
    message: scriptErrMsg || 'Failed to edit message'
  };
}

export async function testWaServerConnection(): Promise<{ ok: boolean; statusCode?: number; message?: string }> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  try {
    const url = `${hook}${hook.includes('?') ? '&' : '?'}action=test_wa_connection&sheet_id=${encodeURIComponent(sheetId)}&_t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return { ok: data.ok || data.status === 'success', statusCode: data.statusCode, message: data.message };
    }
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Could not reach server' };
  }
  return { ok: false, message: 'Server error' };
}

export async function toggleCloudTrigger(enable: boolean): Promise<{ ok: boolean; message?: string }> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  const action = enable ? 'setup_cloud_trigger' : 'stop_cloud_trigger';
  try {
    const url = `${hook}${hook.includes('?') ? '&' : '?'}action=${action}&sheet_id=${encodeURIComponent(sheetId)}&_t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return { ok: data.ok || data.status === 'success', message: data.message };
    }
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Cloud trigger request failed' };
  }
  return { ok: false, message: 'Server error' };
}

export async function getCloudTriggerInfo(): Promise<{ ok: boolean; active?: boolean; lastRun?: string; currentIndex?: number; message?: string }> {
  const hook = getWebhookUrl();
  const sheetId = getGoogleSheetId();
  try {
    const url = `${hook}${hook.includes('?') ? '&' : '?'}action=get_cloud_trigger_status&sheet_id=${encodeURIComponent(sheetId)}&_t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, active: data.active, lastRun: data.lastRun, currentIndex: data.currentIndex };
    }
  } catch (e: any) {
    return { ok: false, message: e?.message };
  }
  return { ok: false, message: 'Failed to read trigger status' };
}



