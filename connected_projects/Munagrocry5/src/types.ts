export interface Product {
  rowIndex?: number;
  ean: string;
  additional_eans?: string; // Comma-separated multiple EANs / Barcodes (e.g. JioMart SKU + Original Packet Barcodes)
  ean_list?: string[]; // Parsed array of all unique EANs for this product
  product_name: string;
  mrp: string | number;
  selling_price: string | number;
  stock_qty: string | number;
  image_url: string;
  own_image_url?: string;
  backup_image_url?: string;
  category: string;
  description?: string;
  max_order_qty?: number; // Max units customer can add to cart per item (default 10)
  additional_images?: string | string[];
  gallery_images?: string[];
  video_url?: string; // YouTube or direct video URL for product demos
}

export interface CartItem {
  ean: string;
  product: Product;
  qty: number;
}

export interface OrderItemSummary {
  name: string;
  qty: number;
  price: number;
  ean?: string;
}

export interface Order {
  id: string;
  user_id?: string;
  timestamp: string;
  customerName: string;
  phone: string;
  address: string;
  items: OrderItemSummary[];
  total: number;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  payment: string; // 'COD' | 'STORE_PICKUP' | 'UPI | UTR: ...'
  utr?: string;
  deliveryType: 'delivery' | 'pickup';
  pickupSlot?: string;
  pickupFinalTime?: string;
  pickupExpiryTimestamp?: number;
  isAutoCancelled?: boolean;
  autoCancelledReason?: string;
  stockRestored?: boolean;
  stage: number; // 1: Placed, 2: Accepted, 3: Packing, 4: Out for Delivery, 5: Delivered
  status: 'pending' | 'reviewed' | 'accepted' | 'packing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  reviewed?: boolean;
  expectedBy?: string;
  channel?: string;
  location?: string;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  address: string;
  isDefault: boolean;
  lat?: number;
  lng?: number;
}

export interface UserSession {
  user_id?: string;
  name: string;
  phone: string;
  address?: string;
  total_orders?: number;
  login_token?: string;
  provider?: string;
  isLoggedIn?: boolean;
}

export interface Banner {
  id: number | string;
  title: string;
  img: string;
}

export interface CustomerNotice {
  title: string;
  text: string;
  img: string;
  url: string;
  ts: number;
}

export interface ShopConfig {
  deliveryFee: number;
  freeAbove: number;
  couponCode: string;
  couponPercent: number;
  couponMinBill: number;
  trending: string[];
  codActive: boolean;
  codNotice: string;
  upiActive?: boolean;
  upiId?: string;
  upiPayeeName?: string;
  upiCustomQrUrl?: string;
  pickupActive: boolean;
  pickupNote: string;
  pickupSlots: string[];
  deliveryDay: string;
  deliverySlot: string;
  pickupChargeOn: boolean;
  pickupChargeFee: number;
  storeOpen: boolean;
  storeOpenTime: string;
  storeCloseTime: string;
  storeClosedMessage: string;
  storeClosedCheckoutMessage: string;
  codMinBill?: number;
  pickupCancelNotice?: string;
  storePickupName?: string;
  storePickupAddress?: string;
  storePickupPhone?: string;
  storePickupHours?: string;
  storeName?: string;
  appDownloadUrl?: string;
  appVersion?: string;
  orderNotificationEnabled?: boolean;
  orderRingEnabled?: boolean;
  orderNotificationHours?: 'always' | 'store_hours';
  orderRingHours?: 'always' | 'store_hours';
  whatsappShareFormat?: string;
  whatsappLinkCaptionFormat?: string;
  shareLinkVersion?: string;
  lastLinkResetAt?: string;
}

export function normalizeTrending(trending: any): string[] {
  if (!trending) return [];
  if (Array.isArray(trending)) {
    return trending
      .flatMap((t) => (typeof t === 'string' && (t.includes(',') || t.includes('|')) ? t.split(/[,|]+/) : [t]))
      .map((t) => String(t).replace(/^EAN-/, '').trim())
      .filter((t) => Boolean(t) && !/^\d+\.?\d*e\+\d+$/i.test(t));
  }
  if (typeof trending === 'number') {
    if (isNaN(trending) || !isFinite(trending)) return [];
    const str = String(Math.floor(trending));
    if (/^\d{5,16}$/.test(str)) {
      return [str];
    }
    return [];
  }
  if (typeof trending === 'string') {
    const trimmed = trending.trim();
    if (!trimmed || /^\d+\.?\d*e\+\d+$/i.test(trimmed)) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeTrending(parsed);
    } catch (e) {}
    return trimmed
      .split(/[,|;\n]+/)
      .map((t) => t.replace(/^EAN-/, '').trim())
      .filter((t) => Boolean(t) && !/^\d+\.?\d*e\+\d+$/i.test(t));
  }
  return [];
}

export function parseProductStock(stock_qty: number | string | undefined | null): number {
  if (stock_qty === undefined || stock_qty === null || stock_qty === '') return 0;
  if (typeof stock_qty === 'number') return isNaN(stock_qty) ? 0 : Math.max(0, stock_qty);
  const str = String(stock_qty).trim();
  if (str === '0') return 0;
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
}
