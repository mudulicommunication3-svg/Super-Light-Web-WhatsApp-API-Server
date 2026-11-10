import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Product,
  Order,
  Address,
  UserSession,
  Banner,
  CustomerNotice,
  ShopConfig,
  normalizeTrending,
  parseProductStock
} from '../types';
import {
  DEFAULT_BANNERS,
  INITIAL_SHOP_CONFIG,
  STORE_LAT,
  STORE_LNG,
  ORIGINAL_CDN_MAP
} from '../data/initialData';
import {
  postOrderToSheet,
  updateOrderStatusOnSheet,
  fetchSheetConfig,
  fetchProductsFromSheet,
  fetchLiveStoreData,
  fetchOrdersFromSheet,
  fetchAddressesFromSheet,
  saveAddressToSheet,
  deleteAddressFromSheet,
  fetchCartFromSheet,
  syncCartToSheet,
  parseSheetCartFromRawConfig,
  parseSheetAddressesFromRawConfig,
  clearAllBrowserCaches,
  isStoreOpenNow,
  updateProductStockOnSheet,
  deleteProductFromSheet,
  isStorePickupActive,
  isCodDeliveryActive,
  getStoredStockOverrides,
  saveStockOverride,
  removeStockOverride,
  getStoredProductOverrides,
  saveProductOverride,
  removeProductOverride,
  getStoredDeletedEans,
  getStoredDeletedNames,
  recordDeletedProduct,
  unrecordDeletedProduct,
  checkAndTriggerAutoSendForProductUpdate,
  ensureSheetAutoForwardBaselineInitialized,
  checkSheetChangesEvery5MinAndForward,
  getStoredWaSettings
} from '../services/api';
import { showToast } from '../components/Toast';
import {
  parseEanList,
  getPrimaryEan,
  doesProductMatchEan
} from '../utils/productMediaHelper';
import { formatLinkPreviewCaption } from '../utils/shareUtils';

interface AppContextType {
  catalog: Product[];
  cart: Record<string, number>;
  appliedCoupon: string;
  banners: Banner[];
  shopConfig: ShopConfig;
  activeScreen: 'home' | 'cart' | 'orders' | 'address' | 'profile' | 'admin' | 'wishlist';
  activeCategory: string;
  searchQuery: string;
  selectedProduct: Product | null;
  isEnglish: boolean;
  sessionUser: UserSession | null;
  addresses: Address[];
  myOrders: Order[];
  allOrders: Order[];
  isAdminLoggedIn: boolean;
  showLoginModal: boolean;
  authNoticeMessage: string | null;
  pendingCheckout: boolean;
  showAdminPinModal: boolean;
  showScanner: boolean;
  showPermissionModal: boolean;
  showPaymentPolicyModal: boolean;
  scannerMode: 'customer' | 'admin' | 'quickbill';
  incomingOrderAlert: Order | null;
  adminNotice: CustomerNotice | null;
  wishlist: string[];
  wishlistCount: number;

  // Sheet Loading States (Strict Google Sheet Read/Write)
  isInitialSheetLoading: boolean;
  isSheetSlowWarning: boolean;
  retryInitialSheetLoad: () => Promise<void>;
  isLoadingAddresses: boolean;
  isSavingAddress: boolean;
  isSyncingCart: boolean;
  isAnySheetReading: boolean;
  refreshAddresses: () => Promise<Address[]>;
  refreshCartFromSheet: () => Promise<void>;

  // Actions
  setShowPermissionModal: (show: boolean) => void;
  setShowPaymentPolicyModal: (show: boolean) => void;
  setAuthNoticeMessage: (msg: string | null) => void;
  setPendingCheckout: (pending: boolean) => void;
  setActiveScreen: (screen: 'home' | 'cart' | 'orders' | 'address' | 'profile' | 'admin' | 'wishlist') => void;
  goBackScreen: () => void;
  toggleWishlist: (ean: string) => void;
  isWishlisted: (ean: string) => boolean;
  setActiveCategory: (cat: string) => void;
  setSearchQuery: (query: string) => void;
  setSelectedProduct: (product: Product | null) => void;
  setIsEnglish: (isEn: boolean) => void;
  setAppliedCoupon: (code: string) => void;

  setQty: (ean: string, qty: number) => void;
  clearCart: () => void;
  cartBilling: (deliveryType?: 'delivery' | 'pickup' | null) => {
    subtotal: number;
    delivery: number;
    pickup: number;
    discount: number;
    total: number;
  };

  placeOrder: (orderData: Omit<Order, 'id' | 'timestamp' | 'stage' | 'status'>) => Promise<Order>;
  cancelOrder: (orderId: string) => Promise<boolean>;
  updateOrderStage: (orderId: string, stage: number, status: Order['status']) => Promise<boolean>;
  linkOrderToDevice: (orderId: string, phone: string) => boolean;

  saveAddress: (address: Omit<Address, 'id'>, id?: string) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;

  setSessionUser: (user: UserSession | null) => void;
  loginAdmin: () => void;
  logoutAdmin: () => void;
  setShowLoginModal: (show: boolean) => void;
  setShowAdminPinModal: (show: boolean) => void;
  setShowScanner: (show: boolean, mode?: 'customer' | 'admin' | 'quickbill') => void;
  setIncomingOrderAlert: (order: Order | null) => void;
  markOrderAlerted: (orderId: string) => void;
  setAdminNotice: (notice: CustomerNotice | null) => void;

  addProduct: (product: Product) => void;
  updateProduct: (product: Product, previousEan?: string) => void;
  deleteProduct: (ean: string, rowIndex?: number, productName?: string, additionalEans?: string | string[]) => void;
  updateShopConfig: (cfg: Partial<ShopConfig>) => void;
  updateBanners: (banners: Banner[]) => void;
  setCatalog: (catalog: Product[]) => void;
  isRefreshingOrders: boolean;
  refreshOrders: (notifyNew?: boolean) => Promise<Order[]>;
  lastStockSyncTime: number;
  isSyncingStock: boolean;
  syncLiveStockWithServer: (force?: boolean) => Promise<void>;
  hasUnsavedAdminChanges: boolean;
  setHasUnsavedAdminChanges: (dirty: boolean) => void;
  isSyncPaused: boolean;
  pauseSyncRemainingSec: number;
  pauseBackgroundSync: (minutes?: number) => void;
  resumeBackgroundSync: (triggerImmediateSync?: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 0. Initial Full-Page Google Sheet Loading State (No hardcoded page shown before sheet finishes reading)
  const [isInitialSheetLoading, setIsInitialSheetLoading] = useState<boolean>(true);
  const [isSheetSlowWarning, setIsSheetSlowWarning] = useState<boolean>(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState<boolean>(false);
  const [isSavingAddress, setIsSavingAddress] = useState<boolean>(false);
  const [isSyncingCart, setIsSyncingCart] = useState<boolean>(false);

  // Clean up all browser caches, service workers, and legacy conflicting local caches on mount
  useEffect(() => {
    void clearAllBrowserCaches();
  }, []);

  // 1. Catalog (Starts empty until live Google Sheet read completes — zero hardcoded products)
  const [catalog, setCatalogState] = useState<Product[]>([]);

  // Guarantee that setCatalog ALWAYS deduplicates across all multiple EANs
  const setCatalog = React.useCallback((updater: Product[] | ((prev: Product[]) => Product[])) => {
    setCatalogState((prev) => {
      const rawNext = typeof updater === 'function' ? updater(prev) : updater;
      if (!Array.isArray(rawNext)) return prev;
      const dedupedList: Product[] = [];
      rawNext.forEach((p) => {
        const cleanName = String(p.product_name || '').toLowerCase().trim();
        if (!cleanName || cleanName === 'product name' || cleanName === 'new product') return;
        const pEans = parseEanList(p.ean, p.additional_eans, p.ean_list);
        const cleanEan = pEans[0] || String(p.ean).replace(/^EAN-/, '').trim();
        const allCodes = parseEanList(cleanEan, pEans);
        const existingIdx = dedupedList.findIndex((item) => doesProductMatchEan(item, allCodes));
        if (existingIdx === -1) {
          dedupedList.push({
            ...p,
            ean: cleanEan,
            additional_eans: allCodes.join(', '),
            ean_list: allCodes
          });
        } else {
          const existing = dedupedList[existingIdx];
          const mergedEans = parseEanList(existing.ean, existing.additional_eans, existing.ean_list, allCodes);
          const existingGalleryLen = existing.gallery_images?.length || 0;
          const newGalleryLen = p.gallery_images?.length || 0;
          const preferNew = newGalleryLen >= existingGalleryLen;
          const winner = preferNew ? p : existing;
          const loser = preferNew ? existing : p;
          dedupedList[existingIdx] = {
            ...loser,
            ...winner,
            ean: winner.ean || existing.ean || cleanEan,
            additional_eans: mergedEans.join(', '),
            ean_list: mergedEans,
            gallery_images: (winner.gallery_images && winner.gallery_images.length > 0) ? winner.gallery_images : loser.gallery_images,
            additional_images: winner.additional_images || loser.additional_images,
            video_url: winner.video_url || loser.video_url
          };
        }
      });
      return dedupedList;
    });
  }, []);

  // 2. Cart (Strictly synced with Google Sheet)
  const [cart, setCart] = useState<Record<string, number>>({});
  const [appliedCoupon, setAppliedCoupon] = useState<string>('');

  // 3. Banners & Notice (Populated strictly from Sheet — no hardcoded banners before sheet load)
  const [banners, setBanners] = useState<Banner[]>([]);
  const [adminNotice, setAdminNoticeState] = useState<CustomerNotice | null>(null);

  const setAdminNotice = (notice: CustomerNotice | null) => {
    setAdminNoticeState(notice);
  };

  // 4. Shop Config (Populated from Google Sheet)
  const [shopConfig, setShopConfig] = useState<ShopConfig>({
    ...INITIAL_SHOP_CONFIG,
    pickupActive: isStorePickupActive(INITIAL_SHOP_CONFIG),
    codActive: isCodDeliveryActive(INITIAL_SHOP_CONFIG),
    trending: normalizeTrending(INITIAL_SHOP_CONFIG.trending)
  });

  // 5. Navigation & UI State
  const [activeScreen, setActiveScreenState] = useState<'home' | 'cart' | 'orders' | 'address' | 'profile' | 'admin' | 'wishlist'>('home');
  const activeScreenRef = React.useRef(activeScreen);
  activeScreenRef.current = activeScreen;

  const [hasUnsavedAdminChanges, setHasUnsavedAdminChangesState] = useState<boolean>(false);
  const hasUnsavedAdminChangesRef = React.useRef<boolean>(false);
  const setHasUnsavedAdminChanges = (dirty: boolean) => {
    hasUnsavedAdminChangesRef.current = dirty;
    setHasUnsavedAdminChangesState(dirty);
  };

  // Manual 5-Minute Pause Sync for Editing (auto-resumes after 5 min or immediately on any Save click)
  const [syncPausedUntil, setSyncPausedUntil] = useState<number>(0);
  const syncPausedUntilRef = React.useRef<number>(0);
  const [pauseSyncRemainingSec, setPauseSyncRemainingSec] = useState<number>(0);
  const isSyncPaused = pauseSyncRemainingSec > 0;

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('user_wishlist');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const toggleWishlist = (ean: string) => {
    setWishlist((prev) => {
      const exists = prev.includes(ean);
      const next = exists ? prev.filter((id) => id !== ean) : [...prev, ean];
      try {
        localStorage.setItem('user_wishlist', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const isWishlisted = (ean: string): boolean => {
    return wishlist.includes(ean);
  };

  const wishlistCount = wishlist.length;

  // Deep-linking check for shared product URL (?item=EAN)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const itemEan = params.get('item') || params.get('product') || params.get('ean') || params.get('id');
      if (itemEan && catalog.length > 0) {
        const cleanItem = itemEan.split('_')[0].replace(/^EAN-/i, '').trim();
        const found = catalog.find((p) => doesProductMatchEan(p, cleanItem));
        if (found) {
          setSelectedProduct(found);
        }
      }
    } catch (e) {}
  }, [catalog]);

  // Synchronize active selectedProduct with live catalog updates (ensures price updates from Google Sheet reflect immediately)
  useEffect(() => {
    if (!selectedProduct) return;
    const cleanSelEan = String(selectedProduct.ean).replace(/^EAN-/, '').trim();
    const cleanSelName = String(selectedProduct.product_name || '').toLowerCase().trim();

    const latest = catalog.find((p) => {
      const pClean = String(p.ean).replace(/^EAN-/, '').trim();
      const pName = String(p.product_name || '').toLowerCase().trim();
      return pClean === cleanSelEan || (cleanSelName && pName === cleanSelName);
    });

    if (latest) {
      if (
        String(latest.selling_price) !== String(selectedProduct.selling_price) ||
        String(latest.mrp) !== String(selectedProduct.mrp) ||
        latest.stock_qty !== selectedProduct.stock_qty ||
        latest.ean !== selectedProduct.ean ||
        latest.description !== selectedProduct.description ||
        latest.video_url !== selectedProduct.video_url
      ) {
        setSelectedProduct(latest);
      }
    }
  }, [catalog, selectedProduct]);

  // Synchronize document title and OpenGraph metadata when product is active
  useEffect(() => {
    try {
      if (selectedProduct) {
        const sp = typeof selectedProduct.selling_price === 'number' ? selectedProduct.selling_price : parseFloat(selectedProduct.selling_price || '0');
        const { ogTitle: title, ogDescription: desc } = formatLinkPreviewCaption(
          shopConfig.whatsappLinkCaptionFormat,
          selectedProduct,
          sp,
          shopConfig.storeName,
          shopConfig.storePickupAddress
        );
        const img = selectedProduct.image_url || `${window.location.origin}/icon-512.png`;

        document.title = title;

        const setMetaTag = (property: string, content: string, isName = false) => {
          const selector = isName ? `meta[name="${property}"]` : `meta[property="${property}"]`;
          let meta = document.querySelector(selector) as HTMLMetaElement | null;
          if (!meta) {
            meta = document.createElement('meta');
            if (isName) meta.name = property;
            else meta.setAttribute('property', property);
            document.head.appendChild(meta);
          }
          meta.content = content;
        };

        setMetaTag('og:title', title);
        setMetaTag('og:description', desc);
        setMetaTag('og:image', img);
        setMetaTag('og:image:secure_url', img);
        setMetaTag('twitter:title', title, true);
        setMetaTag('twitter:description', desc, true);
        setMetaTag('twitter:image', img, true);
      } else {
        document.title = 'Munna Mobile & Grocery';
      }
    } catch (e) {}
  }, [selectedProduct, shopConfig.whatsappLinkCaptionFormat, shopConfig.storeName, shopConfig.storePickupAddress]);

  const [isEnglish, setIsEnglish] = useState<boolean>(() => {
    const saved = localStorage.getItem('user_lang');
    if (saved) return saved === 'en';
    const legacy = localStorage.getItem('munna_lang');
    if (legacy) return legacy === 'en';
    return true;
  });

  // 6. User & Auth (Session identity only; user profile, cart, addresses, and orders are strictly read from Google Sheet)
  const [sessionUser, setSessionUserState] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('session_user') || localStorage.getItem('active_store_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('isAdminLoggedIn') === '1';
  });

  // 7. Saved Addresses (Strictly read & written from Google Sheet — starts empty)
  const [addresses, setAddresses] = useState<Address[]>([]);

  // 8. Orders Store (Strictly read & written from Google Sheet — starts empty)
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [deviceOrderIds, setDeviceOrderIds] = useState<string[]>([]);
  const [, setDevicePhone] = useState<string>('');

  // Strict User-Wise Order Isolation:
  // Admin sees all orders; normal customers ONLY see their own personal orders from Google Sheet!
  const myOrders = React.useMemo(() => {
    if (isAdminLoggedIn) {
      return allOrders;
    }
    const cleanUserPhone = sessionUser?.phone ? sessionUser.phone.replace(/\D/g, '').slice(-10) : '';
    const userId = sessionUser?.user_id;

    return allOrders.filter((order) => {
      if (deviceOrderIds.includes(order.id)) {
        return true;
      }
      if (cleanUserPhone) {
        const cleanOrderPhone = String(order.phone || '').replace(/\D/g, '').slice(-10);
        if (cleanOrderPhone && cleanOrderPhone === cleanUserPhone) {
          return true;
        }
      }
      if (userId && order.user_id && String(userId) === String(order.user_id)) {
        return true;
      }
      return false;
    });
  }, [allOrders, isAdminLoggedIn, sessionUser, deviceOrderIds]);

  const [isRefreshingOrders, setIsRefreshingOrders] = useState<boolean>(false);
  const alertedOrderIdsRef = React.useRef<Set<string>>(new Set());

  const markOrderAlerted = (orderId: string) => {
    alertedOrderIdsRef.current.add(orderId);
  };

  const sessionUserRef = React.useRef<UserSession | null>(sessionUser);
  sessionUserRef.current = sessionUser;

  const isAdminLoggedInRef = React.useRef<boolean>(isAdminLoggedIn);
  isAdminLoggedInRef.current = isAdminLoggedIn;

  const shopConfigRef = React.useRef<ShopConfig>(shopConfig);
  shopConfigRef.current = shopConfig;

  const isEnglishRef = React.useRef<boolean>(isEnglish);
  isEnglishRef.current = isEnglish;

  const allOrdersRef = React.useRef<Order[]>(allOrders);
  allOrdersRef.current = allOrders;

  const myOrdersRef = React.useRef<Order[]>(myOrders);
  myOrdersRef.current = myOrders;

  // Fetch customer's saved addresses strictly from Google Sheet
  const refreshAddresses = React.useCallback(async (overridePhone?: string, overrideName?: string): Promise<Address[]> => {
    const curUser = sessionUserRef.current;
    const targetPhone = overridePhone ?? curUser?.phone;
    const targetName = overrideName ?? curUser?.name;
    if (!targetPhone) {
      setAddresses((prev) => (prev.length === 0 ? prev : []));
      return [];
    }
    setIsLoadingAddresses(true);
    try {
      const sheetAddresses = await fetchAddressesFromSheet(targetPhone, targetName);
      if (sheetAddresses && sheetAddresses.length > 0) {
        setAddresses(sheetAddresses);
        return sheetAddresses;
      } else if (curUser?.address && curUser.address.trim()) {
        const fallbackAddr: Address = {
          id: `ADDR-${targetPhone.replace(/\D/g, '').slice(-10)}-1`,
          name: targetName || 'Customer',
          phone: targetPhone.replace(/\D/g, '').slice(-10),
          address: curUser.address.trim(),
          isDefault: true
        };
        setAddresses([fallbackAddr]);
        return [fallbackAddr];
      } else {
        setAddresses((prev) => (prev.length === 0 ? prev : []));
        return [];
      }
    } catch (e) {
      return [];
    } finally {
      setIsLoadingAddresses(false);
    }
  }, []);

  // Fetch customer's saved cart strictly from Sheet (supports both logged-in user and guest device ID)
  const refreshCartFromSheet = React.useCallback(async (overridePhone?: string): Promise<void> => {
    const targetPhone = overridePhone ?? sessionUserRef.current?.phone;
    setIsSyncingCart(true);
    try {
      const sheetCart = await fetchCartFromSheet(targetPhone);
      if (sheetCart && Object.keys(sheetCart).length > 0) {
        setCart((prevCart) => {
          const merged = { ...sheetCart, ...prevCart };
          const prevKeys = Object.keys(prevCart);
          const mergedKeys = Object.keys(merged);
          if (
            prevKeys.length === mergedKeys.length &&
            mergedKeys.every((k) => prevCart[k] === merged[k])
          ) {
            return prevCart;
          }
          return merged;
        });
      }
    } catch (e) {
      // ignore
    } finally {
      setIsSyncingCart(false);
    }
  }, []);

  // Strictly fetches fresh orders from Google Sheet without merging conflicting local cache
  const refreshOrders = React.useCallback(async (notifyNew = false): Promise<Order[]> => {
    setIsRefreshingOrders(true);
    try {
      const sheetOrders = await fetchOrdersFromSheet();
      if (sheetOrders) {
        const sortedOrders = [...sheetOrders].sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime() || 0;
          const timeB = new Date(b.timestamp).getTime() || 0;
          return timeB - timeA;
        });
        setAllOrders(sortedOrders);

        // 1. Cross-phone synchronization:
        setIncomingOrderAlert((currentAlert) => {
          if (!currentAlert) return null;
          const updatedInSheet = sortedOrders.find((so) => so.id === currentAlert.id);
          if (updatedInSheet) {
            const isHandled =
              updatedInSheet.status !== 'pending' ||
              updatedInSheet.stage > 1 ||
              updatedInSheet.reviewed === true;
            if (isHandled) {
              markOrderAlerted(updatedInSheet.id);
              const actionText =
                updatedInSheet.status === 'accepted' || updatedInSheet.stage > 1 ? 'ସ୍ୱୀକୃତ' :
                updatedInSheet.status === 'cancelled' ? 'ବାତିଲ୍' : 'ସମୀକ୍ଷିତ';
              showToast(`ଅନ୍ୟ ଫୋନ୍‌ରେ ଅର୍ଡର #${updatedInSheet.id} ${actionText} ହୋଇଛି, ରିଙ୍ଗ୍ ବନ୍ଦ ହେଲା ✅`);
              return null;
            }
          }
          return currentAlert;
        });

        // 2. Only ring for genuinely pending, unhandled, unreviewed orders when notification settings permit
        const checkAdmin = isAdminLoggedInRef.current || notifyNew;
        const curCfg = shopConfigRef.current;
        const isNotifEnabled = curCfg.orderNotificationEnabled !== false;
        const notifHours = curCfg.orderNotificationHours || 'always';
        const isStoreOpen = isStoreOpenNow(curCfg);
        const canNotify = isNotifEnabled && (notifHours === 'always' || isStoreOpen);

        if (checkAdmin && canNotify) {
          const unhandledPending = sortedOrders.filter(
            (o) => o.stage === 1 && o.status === 'pending' && !o.reviewed && !alertedOrderIdsRef.current.has(o.id)
          );

          if (unhandledPending.length > 0) {
            const latest = unhandledPending[0];
            markOrderAlerted(latest.id);
            setIncomingOrderAlert(latest);
            showToast(`🔔 ନୂଆ ଅର୍ଡର #${latest.id} (${latest.customerName}) ଆସିଛି! ସ୍ୱୀକାର କରନ୍ତୁ ✅`);
          }
        }

        return sortedOrders;
      }
    } catch (err) {
      console.warn('Error fetching orders from Google Sheet:', err);
    } finally {
      setIsRefreshingOrders(false);
    }
    return isAdminLoggedInRef.current ? allOrdersRef.current : myOrdersRef.current;
  }, []);

  // Instant cross-window/cross-tab broadcast sync
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('munna_order_sync_channel');
      channel.onmessage = (e) => {
        const data = e.data;
        if (!data) return;

        if (data.type === 'STOCK_UPDATED' && Array.isArray(data.stocks)) {
          setCatalog((prev) => {
            return prev.map((p) => {
              const match = data.stocks.find((s: any) => String(s.ean) === String(p.ean));
              if (match) {
                return { ...p, stock_qty: match.newStock };
              }
              return p;
            });
          });

          setCart((prevCart) => {
            let changed = false;
            const nextCart = { ...prevCart };
            data.stocks.forEach((s: any) => {
              const userQty = prevCart[s.ean];
              if (userQty !== undefined && userQty > s.newStock) {
                changed = true;
                if (s.newStock <= 0) {
                  delete nextCart[s.ean];
                } else {
                  nextCart[s.ean] = s.newStock;
                }
              }
            });
            return changed ? nextCart : prevCart;
          });
          return;
        }

        if (data.orderId) {
          markOrderAlerted(data.orderId);
          setIncomingOrderAlert((curr) => {
            if (curr && curr.id === data.orderId) {
              const actionLabel =
                data.action === 'accept' ? 'ସ୍ୱୀକାର' :
                data.action === 'decline' ? 'ବାତିଲ୍' : 'ସମୀକ୍ଷା';
              showToast(`ଅନ୍ୟ ଆଡମିନ୍ ଅର୍ଡର #${data.orderId} ${actionLabel} କରିଛନ୍ତି, ରିଙ୍ଗ୍ ବନ୍ଦ ହେଲା ✅`);
              return null;
            }
            return curr;
          });
          refreshOrders(false);
        }
      };
      return () => {
        channel.close();
      };
    } catch (e) {}
  }, [refreshOrders]);

  // 9. Modals
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [authNoticeMessage, setAuthNoticeMessage] = useState<string | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<boolean>(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState<boolean>(false);
  const [showScanner, setShowScannerState] = useState<boolean>(false);
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const [showPaymentPolicyModal, setShowPaymentPolicyModal] = useState<boolean>(false);
  const [scannerMode, setScannerMode] = useState<'customer' | 'admin' | 'quickbill'>('customer');
  const [incomingOrderAlert, setIncomingOrderAlert] = useState<Order | null>(null);

  useEffect(() => {
    localStorage.setItem('user_lang', isEnglish ? 'en' : 'or');
    localStorage.setItem('munna_lang', isEnglish ? 'en' : 'od');
  }, [isEnglish]);

  const setSessionUser = React.useCallback((user: UserSession | null) => {
    sessionUserRef.current = user;
    setSessionUserState(user);
    if (user) {
      const sessionData = { ...user, isLoggedIn: true };
      localStorage.setItem('session_user', JSON.stringify(sessionData));
      localStorage.setItem('active_store_user', JSON.stringify(sessionData));
      // Immediately read user's addresses, cart, and orders from Google Sheet
      void refreshAddresses(user.phone, user.name);
      void refreshCartFromSheet(user.phone);
      void refreshOrders(false);
    } else {
      localStorage.removeItem('session_user');
      localStorage.removeItem('active_store_user');
      setAddresses([]);
      setCart({});
    }
  }, [refreshAddresses, refreshCartFromSheet, refreshOrders]);

  // Screen navigation history stack for hardware and UI Back navigation
  const screenHistoryRef = React.useRef<Array<'home' | 'cart' | 'orders' | 'address' | 'profile' | 'admin' | 'wishlist'>>([]);

  // Referentially stable screen setter (prevents URL navigation useEffect loops and records previous screen)
  const setActiveScreen = React.useCallback(
    (screen: 'home' | 'cart' | 'orders' | 'address' | 'profile' | 'admin' | 'wishlist') => {
      setActiveScreenState((prev) => {
        if (prev === screen) return prev;
        if (screen === 'home') {
          screenHistoryRef.current = [];
        } else {
          const stack = screenHistoryRef.current;
          if (stack[stack.length - 1] !== prev) {
            stack.push(prev);
          }
        }
        return screen;
      });
    },
    []
  );

  // Navigate back to the previous screen in history (defaults to 'home')
  const goBackScreen = React.useCallback(() => {
    setActiveScreenState((prev) => {
      if (prev === 'home') return 'home';
      const stack = screenHistoryRef.current;
      while (stack.length > 0) {
        const last = stack.pop()!;
        if (last !== prev) {
          return last;
        }
      }
      return 'home';
    });
  }, []);

  // 10. Background polling for live orders from Google Sheet
  useEffect(() => {
    if (isInitialSheetLoading) return;
    const pollInterval = isAdminLoggedIn ? 6000 : 30000;
    const timer = setInterval(() => {
      refreshOrders(isAdminLoggedIn);
    }, pollInterval);
    return () => clearInterval(timer);
  }, [isAdminLoggedIn, isInitialSheetLoading, refreshOrders]);

  const loginAdmin = () => {
    isAdminLoggedInRef.current = true;
    setIsAdminLoggedIn(true);
    localStorage.setItem('isAdminLoggedIn', '1');
    localStorage.setItem('muna_admin_logged_in', 'true');
    refreshOrders(true);
  };

  const logoutAdmin = () => {
    isAdminLoggedInRef.current = false;
    setIsAdminLoggedIn(false);
    localStorage.removeItem('isAdminLoggedIn');
    localStorage.removeItem('muna_admin_logged_in');
  };

  const setShowScanner = (show: boolean, mode: 'customer' | 'admin' | 'quickbill' = 'customer') => {
    setScannerMode(mode);
    setShowScannerState(show);
  };

  // 11. Live Stock & Store Settings Sync with Google Sheet
  const [lastStockSyncTime, setLastStockSyncTime] = useState<number>(Date.now());
  const [isSyncingStock, setIsSyncingStock] = useState<boolean>(false);
  const isSyncingStockRef = React.useRef<boolean>(false);
  const recentEditsRef = React.useRef<Record<string, number>>({});

  const applyLiveStorePayload = React.useCallback((liveData: NonNullable<Awaited<ReturnType<typeof fetchLiveStoreData>>>) => {
    setLastStockSyncTime(Date.now());

    // 1. Live Store Settings & Delivery Rules Sync from Sheet
    if (liveData.config && Object.keys(liveData.config).length > 0) {
      setShopConfig((prev) => ({
        ...prev,
        ...liveData.config,
        ...(liveData.config.pickupActive !== undefined ? { pickupActive: isStorePickupActive(liveData.config) } : {}),
        ...(liveData.config.codActive !== undefined ? { codActive: isCodDeliveryActive(liveData.config) } : {}),
        ...(liveData.config.trending !== undefined ? { trending: normalizeTrending(liveData.config.trending) } : {})
      }));
    }

    // 2. Live Hero Banners Sync from Sheet
    if (liveData.banners && liveData.banners.length > 0) {
      setBanners(liveData.banners);
    }

    // 3. Live Broadcast Notice Sync from Sheet
    if (liveData.notice !== undefined) {
      setAdminNoticeState(liveData.notice);
    }

    // 4. Live Admin Credentials Sync
    if (liveData.adminUsername) {
      try {
        localStorage.setItem('munna_admin_username', liveData.adminUsername.trim());
      } catch (e) {}
    }
    if (liveData.adminPassword) {
      try {
        localStorage.setItem('munna_admin_password', liveData.adminPassword.trim());
      } catch (e) {}
    }

    // 5. Restore Cart & Addresses directly from Sheet Config if present
    if (liveData.rawConfig) {
      const curUser = sessionUserRef.current;
      const sheetCart = parseSheetCartFromRawConfig(liveData.rawConfig, curUser?.phone);
      if (sheetCart && Object.keys(sheetCart).length > 0) {
        setCart((prevCart) => {
          const merged = { ...sheetCart, ...prevCart };
          const prevKeys = Object.keys(prevCart);
          const mergedKeys = Object.keys(merged);
          if (prevKeys.length === mergedKeys.length && mergedKeys.every((k) => prevCart[k] === merged[k])) {
            return prevCart;
          }
          return merged;
        });
      }
      if (curUser?.phone) {
        const sheetAddrs = parseSheetAddressesFromRawConfig(liveData.rawConfig, curUser.phone, curUser.name);
        if (sheetAddrs && sheetAddrs.length > 0) {
          setAddresses(sheetAddrs);
        }
      }
    }

    // 6. Live Products Catalog Sync from Sheet1 (100% Authoritative)
    const serverProducts = liveData.products;
    if (serverProducts && serverProducts.length > 0) {
      ensureSheetAutoForwardBaselineInitialized(serverProducts);
      setCatalog(serverProducts);

      // Live Auto-Manage User's Cart against Server Stock
      setCart((prevCart) => {
        let cartChanged = false;
        const nextCart = { ...prevCart };

        Object.keys(prevCart).forEach((cartEan) => {
          const cleanEan = String(cartEan).replace(/^EAN-/, '').trim();
          const serverItem = serverProducts.find(
            (p) => String(p.ean).replace(/^EAN-/, '').trim() === cleanEan
          );
          if (!serverItem) return;

          const curStock = typeof serverItem.stock_qty === 'number'
            ? serverItem.stock_qty
            : parseInt(String(serverItem.stock_qty || '0'), 10);
          const curMax = serverItem.max_order_qty && serverItem.max_order_qty > 0
            ? serverItem.max_order_qty
            : 10;
          const allowedMax = Math.min(Math.max(0, curStock), curMax);

          const userCartQty = prevCart[cartEan];

          if (userCartQty > allowedMax) {
            cartChanged = true;
            if (allowedMax <= 0) {
              delete nextCart[cartEan];
              showToast(
                isEnglishRef.current
                  ? `⚠️ "${serverItem.product_name}" is now OUT OF STOCK! Removed from cart.`
                  : `⚠️ "${serverItem.product_name}" ର ଷ୍ଟକ୍ ସରିଗଲା (Out of Stock)! କାର୍ଟରୁ ହଟାଗଲା।`
              );
            } else {
              nextCart[cartEan] = allowedMax;
              showToast(
                isEnglishRef.current
                  ? `⚠️ "${serverItem.product_name}" only ${allowedMax} available in stock! Cart updated.`
                  : `⚠️ "${serverItem.product_name}" କେବଳ ${allowedMax} ଟି ଷ୍ଟକ୍ ଅଛି! କାର୍ଟ ସଂଶୋଧିତ ହେଲା।`
              );
            }
          }
        });

        return cartChanged ? nextCart : prevCart;
      });
    }
  }, [setCatalog]);

  // Initial Full-Page Load from Sheet (Runs when user opens the app)
  const retryInitialSheetLoad = React.useCallback(async (): Promise<void> => {
    setIsInitialSheetLoading(true);
    setIsSheetSlowWarning(false);
    isSyncingStockRef.current = true;
    setIsSyncingStock(true);

    const slowTimer = setTimeout(() => {
      setIsSheetSlowWarning(true);
    }, 5500);

    try {
      const curUser = sessionUserRef.current;
      const [liveData] = await Promise.all([
        fetchLiveStoreData(),
        refreshOrders(isAdminLoggedInRef.current),
        refreshCartFromSheet(curUser?.phone),
        ...(curUser?.phone ? [refreshAddresses(curUser.phone, curUser.name)] : [])
      ]);

      if (liveData) {
        applyLiveStorePayload(liveData);
      } else {
        // Fallback direct products fetch if main endpoint was slow
        const fallbackProducts = await fetchProductsFromSheet();
        if (fallbackProducts && fallbackProducts.length > 0) {
          setCatalog(fallbackProducts);
        }
      }
    } catch (err) {
      console.warn('Initial sheet load error:', err);
    } finally {
      clearTimeout(slowTimer);
      isSyncingStockRef.current = false;
      setIsSyncingStock(false);
      setIsSheetSlowWarning(false);
      setIsInitialSheetLoading(false);
    }
  }, [applyLiveStorePayload, refreshAddresses, refreshCartFromSheet, refreshOrders, setCatalog]);

  useEffect(() => {
    void retryInitialSheetLoad();
  }, [retryInitialSheetLoad]);

  const syncLiveStockWithServer = React.useCallback(async (force = false): Promise<void> => {
    if (isSyncingStockRef.current) return;
    if (!force && (hasUnsavedAdminChangesRef.current || syncPausedUntilRef.current > Date.now())) {
      return;
    }
    isSyncingStockRef.current = true;
    setIsSyncingStock(true);

    try {
      const liveData = await fetchLiveStoreData();
      if (liveData) {
        applyLiveStorePayload(liveData);
      }
    } catch (err) {
      console.warn('Live store background sync error:', err);
    } finally {
      isSyncingStockRef.current = false;
      setIsSyncingStock(false);
    }
  }, [applyLiveStorePayload]);

  // Refresh home stock when navigating back to home after initial load
  const prevScreenRef = React.useRef<string>(activeScreen);
  useEffect(() => {
    if (isInitialSheetLoading) return;
    if (prevScreenRef.current === activeScreen) return;
    prevScreenRef.current = activeScreen;
    if (activeScreen === 'home') {
      void syncLiveStockWithServer(true);
    }
  }, [activeScreen, isInitialSheetLoading, syncLiveStockWithServer]);

  const pauseBackgroundSync = (minutes = 5) => {
    const durationMs = Math.max(1, minutes) * 60 * 1000;
    const until = Date.now() + durationMs;
    syncPausedUntilRef.current = until;
    setSyncPausedUntil(until);
    setPauseSyncRemainingSec(Math.round(durationMs / 1000));
    showToast(
      isEnglish
        ? `⏸️ Background Sync paused for ${minutes} minutes for safe editing! Will auto-resume in ${minutes}m or when you click Save.`
        : `⏸️ ଏଡିଟିଂ ପାଇଁ ବ୍ୟାକଗ୍ରାଉଣ୍ଡ ସିଙ୍କ୍ ${minutes} ମିନିଟ୍ ପାଇଁ ବନ୍ଦ ହେଲା! ${minutes} ମିନିଟ୍ ପରେ କିମ୍ବା Save କ୍ଲିକ୍ କଲେ ଆପେ ଆପେ ଚାଲୁ ହେବ।`
    );
  };

  const resumeBackgroundSync = (triggerImmediateSync = false) => {
    const wasPaused = syncPausedUntilRef.current > Date.now() || pauseSyncRemainingSec > 0;
    syncPausedUntilRef.current = 0;
    setSyncPausedUntil(0);
    setPauseSyncRemainingSec(0);
    if (wasPaused) {
      showToast(
        isEnglish
          ? '▶️ Background Sync resumed automatically!'
          : '▶️ ବ୍ୟାକଗ୍ରାଉଣ୍ଡ ସିଙ୍କ୍ ପୁଣି ସ୍ୱୟଂଚାଳିତ ଭାବେ ଚାଲୁ ହେଲା!'
      );
    }
    if (triggerImmediateSync) {
      void syncLiveStockWithServer(true);
    }
  };

  // 1-second countdown timer while 5-minute Pause Sync is active; auto-resumes when timer hits 0
  useEffect(() => {
    if (!syncPausedUntil) return;
    const tick = setInterval(() => {
      const remMs = syncPausedUntilRef.current - Date.now();
      if (remMs <= 0) {
        syncPausedUntilRef.current = 0;
        setSyncPausedUntil(0);
        setPauseSyncRemainingSec(0);
        showToast(
          isEnglish
            ? '⏰ 5 minutes completed — Background Sync auto-resumed!'
            : '⏰ ୫ ମିନିଟ୍ ଶେଷ ହେଲା — ବ୍ୟାକଗ୍ରାଉଣ୍ଡ ସିଙ୍କ୍ ଆପେ ଆପେ ଚାଲୁ ହେଲା!'
        );
        void syncLiveStockWithServer(true);
      } else {
        setPauseSyncRemainingSec(Math.ceil(remMs / 1000));
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [syncPausedUntil, isEnglish, syncLiveStockWithServer]);

  // Periodic storefront live stock & price sync (runs every 15s; paused while admin is editing or 5-min Pause is active)
  useEffect(() => {
    const intervalTimer = setInterval(() => {
      if (!hasUnsavedAdminChangesRef.current && syncPausedUntilRef.current <= Date.now()) {
        void syncLiveStockWithServer();
      }
    }, 15000);

    const onFocus = () => {
      if (!hasUnsavedAdminChangesRef.current && syncPausedUntilRef.current <= Date.now()) {
        void syncLiveStockWithServer();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !hasUnsavedAdminChangesRef.current && syncPausedUntilRef.current <= Date.now()) {
        void syncLiveStockWithServer();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(intervalTimer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [syncLiveStockWithServer]);

  // Dedicated 5-Minute Google Sheet Watcher for Auto-Forward Toggles (300,000 ms = 5 mins)
  useEffect(() => {
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const fiveMinTimer = setInterval(() => {
      if (hasUnsavedAdminChangesRef.current || syncPausedUntilRef.current > Date.now()) {
        return;
      }
      const waCfg = getStoredWaSettings();
      if (
        waCfg.AUTO_SEND_NEW_PRODUCTS ||
        waCfg.AUTO_SEND_RESTOCKED_PRODUCTS ||
        waCfg.AUTO_SEND_PRICE_CHANGED_PRODUCTS
      ) {
        checkSheetChangesEvery5MinAndForward().catch(() => {});
      }
    }, FIVE_MINUTES_MS);

    return () => clearInterval(fiveMinTimer);
  }, []);

  // Cart operations (strictly synced to Google Sheet on user edits)
  const setQty = (ean: string, qty: number) => {
    const p = catalog.find(x => String(x.ean) === String(ean));
    const maxStock = p ? (typeof p.stock_qty === 'number' ? p.stock_qty : parseInt(p.stock_qty || '0', 10)) : 10;
    const maxOrderLimit = p?.max_order_qty && p.max_order_qty > 0 ? p.max_order_qty : 10;
    const effectiveLimit = Math.min(maxStock, maxOrderLimit);

    if (qty > maxOrderLimit) {
      showToast(
        isEnglish
          ? `⚠️ Max limit for "${p?.product_name || 'Item'}" is ${maxOrderLimit} units per order!`
          : `⚠️ "${p?.product_name || 'Item'}" ପାଇଁ ଗୋଟିଏ ଅର୍ଡରରେ ସର୍ବାଧିକ ${maxOrderLimit} ଟି ନେଇପାରିବେ!`
      );
    } else if (qty > maxStock) {
      showToast(
        isEnglish
          ? `⚠️ Only ${maxStock} units available in stock for "${p?.product_name || 'Item'}"!`
          : `⚠️ "${p?.product_name || 'Item'}" — କେବଳ ${maxStock} ଟି ଷ୍ଟକ୍ ଅଛି!`
      );
    }

    const safeQty = Math.max(0, Math.min(effectiveLimit, qty));

    setCart(prev => {
      const next = { ...prev };
      if (safeQty <= 0) {
        delete next[ean];
      } else {
        next[ean] = safeQty;
      }
      setIsSyncingCart(true);
      syncCartToSheet(sessionUserRef.current?.phone, next)
        .catch(() => {})
        .finally(() => setIsSyncingCart(false));
      return next;
    });
  };

  const clearCart = () => {
    setCart({});
    setAppliedCoupon('');
    setIsSyncingCart(true);
    syncCartToSheet(sessionUserRef.current?.phone, {})
      .catch(() => {})
      .finally(() => setIsSyncingCart(false));
  };

  const cartBilling = (deliveryType?: 'delivery' | 'pickup' | null) => {
    let subtotal = 0;
    Object.keys(cart).forEach(ean => {
      const p = catalog.find(x => String(x.ean) === String(ean));
      if (p) {
        const price = typeof p.selling_price === 'number' ? p.selling_price : parseFloat(p.selling_price || '0');
        subtotal += price * (cart[ean] || 0);
      }
    });

    const isPickup = deliveryType === 'pickup';
    const isDelivery = deliveryType === 'delivery';
    const delivery = (isDelivery && subtotal > 0 && (shopConfig.freeAbove <= 0 || subtotal < shopConfig.freeAbove))
      ? shopConfig.deliveryFee
      : 0;

    const pickup = (isPickup && shopConfig.pickupChargeOn && subtotal > 0)
      ? shopConfig.pickupChargeFee
      : 0;

    let discount = 0;
    if (appliedCoupon.trim().toUpperCase() === shopConfig.couponCode.toUpperCase() && subtotal >= shopConfig.couponMinBill) {
      discount = Math.round((subtotal * shopConfig.couponPercent) / 100);
    }

    const total = Math.max(0, subtotal + delivery + pickup - discount);
    return { subtotal, delivery, pickup, discount, total };
  };

  // Place Order
  const placeOrder = async (orderData: Omit<Order, 'id' | 'timestamp' | 'stage' | 'status'>): Promise<Order> => {
    const id = 'MG-' + Math.floor(100000 + Math.random() * 900000);
    const now = new Date();
    const timestamp = now.toLocaleDateString('or-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    const user_id = sessionUser?.user_id || undefined;
    const newOrder: Order = {
      ...orderData,
      id,
      user_id,
      timestamp,
      stage: 1,
      status: 'pending',
      stockRestored: false,
      expectedBy: orderData.expectedBy || (orderData.deliveryType === 'pickup' ? (orderData.pickupSlot || '30 min') : (shopConfig.deliverySlot || '1 hour'))
    };

    // Deduct stock in catalog
    const deductedItemsForSheet: { ean: string; newStock: number }[] = [];
    setCatalog(prev => {
      return prev.map(p => {
        const item = newOrder.items.find(i => String(i.ean) === String(p.ean) || i.name === p.product_name);
        if (item) {
          const curStock = typeof p.stock_qty === 'number' ? p.stock_qty : parseInt(p.stock_qty || '0', 10);
          const newStock = Math.max(0, curStock - item.qty);
          deductedItemsForSheet.push({ ean: String(p.ean), newStock });
          return {
            ...p,
            stock_qty: newStock
          };
        }
        return p;
      });
    });

    // Push new stock immediately to Google Sheet so other users' 5-sec live sync picks it up
    deductedItemsForSheet.forEach(({ ean, newStock }) => {
      updateProductStockOnSheet(ean, newStock).catch(() => {});
    });

    // Broadcast stock deduction instantly to other browser tabs
    try {
      const channel = new BroadcastChannel('munna_order_sync_channel');
      channel.postMessage({
        type: 'STOCK_UPDATED',
        stocks: deductedItemsForSheet
      });
      channel.close();
    } catch (e) {}

    // Save order in memory and link to current session
    setAllOrders(prev => [newOrder, ...prev]);
    setDeviceOrderIds(prev => [newOrder.id, ...prev.filter(id => id !== newOrder.id)]);
    if (orderData.phone) {
      setDevicePhone(orderData.phone);
    }
    clearCart();

    // Increment user's total_orders in sessionUser if logged in
    if (sessionUser) {
      const updatedUser: UserSession = {
        ...sessionUser,
        total_orders: (sessionUser.total_orders || 0) + 1
      };
      setSessionUserState(updatedUser);
      try {
        localStorage.setItem('session_user', JSON.stringify({ ...updatedUser, isLoggedIn: true }));
        localStorage.setItem('active_store_user', JSON.stringify({ ...updatedUser, isLoggedIn: true }));
      } catch (e) {}
    }

    // Write address and order directly to Google Sheet
    if (orderData.deliveryType === 'delivery') {
      await saveAddressToSheet({
        name: orderData.customerName,
        address: orderData.address,
        phone: orderData.phone,
        location: orderData.location
      }).catch(() => {});
    }

    // Post to Orders sheet matching schema (id, user_id, name, phone, address, items, total, stage, status, payment, created_at)
    await postOrderToSheet(newOrder, sessionUser).catch(() => {});

    // If admin is active or for testing demo ring
    const isNotifEnabled = shopConfig.orderNotificationEnabled !== false;
    const notifHours = shopConfig.orderNotificationHours || 'always';
    const isStoreOpen = isStoreOpenNow(shopConfig);
    const canNotify = isNotifEnabled && (notifHours === 'always' || isStoreOpen);

    if (isAdminLoggedIn && canNotify) {
      setTimeout(() => {
        setIncomingOrderAlert(newOrder);
      }, 500);
    }

    return newOrder;
  };

  const cancelOrder = async (orderId: string): Promise<boolean> => {
    markOrderAlerted(orderId);
    setIncomingOrderAlert((prev) => (prev?.id === orderId ? null : prev));

    // Restore stock in catalog strictly once
    const targetOrder = allOrders.find(o => o.id === orderId);
    if (targetOrder && !targetOrder.stockRestored && targetOrder.status !== 'cancelled') {
      const restoredItemsForSheet: { ean: string; newStock: number }[] = [];
      setCatalog(prev => {
        return prev.map(p => {
          const item = targetOrder.items.find(i => String(i.ean) === String(p.ean) || i.name === p.product_name);
          if (item) {
            const curStock = parseProductStock(p.stock_qty);
            const newStock = curStock + item.qty;
            restoredItemsForSheet.push({ ean: String(p.ean), newStock });
            return {
              ...p,
              stock_qty: newStock
            };
          }
          return p;
        });
      });

      // Push restored stock to Google Sheet
      restoredItemsForSheet.forEach(({ ean, newStock }) => {
        updateProductStockOnSheet(ean, newStock).catch(() => {});
      });

      try {
        const channel = new BroadcastChannel('munna_order_sync_channel');
        channel.postMessage({
          type: 'STOCK_UPDATED',
          stocks: restoredItemsForSheet
        });
        channel.close();
      } catch (e) {}
    }

    setAllOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, status: 'cancelled' as const, stockRestored: true } : o))
    );
    try {
      const channel = new BroadcastChannel('munna_order_sync_channel');
      channel.postMessage({ type: 'ORDER_SYNC', orderId, status: 'cancelled', action: 'decline' });
      channel.close();
    } catch (e) {}
    await updateOrderStatusOnSheet(orderId, 'cancelled', 0);
    return true;
  };

  // Automated background runner: checks expired pickup orders, auto-cancels and restores stock strictly once
  useEffect(() => {
    const checkExpiredPickupOrders = () => {
      const now = Date.now();
      const itemsToRestore: Record<string, number> = {};
      let newlyRestored = false;

      setAllOrders(prevOrders => {
        let modified = false;
        const updated = prevOrders.map(order => {
          if (
            order.deliveryType === 'pickup' &&
            order.pickupExpiryTimestamp &&
            now > order.pickupExpiryTimestamp &&
            order.status !== 'cancelled' &&
            order.status !== 'delivered' &&
            order.stage < 5
          ) {
            modified = true;

            if (!order.stockRestored) {
              newlyRestored = true;
              order.items.forEach(item => {
                const key = String(item.ean || item.name).replace(/^EAN-/, '').trim();
                itemsToRestore[key] = (itemsToRestore[key] || 0) + item.qty;
              });
            }

            try {
              updateOrderStatusOnSheet(order.id, 'cancelled', 0).catch(() => {});
              const channel = new BroadcastChannel('munna_order_sync_channel');
              channel.postMessage({
                type: 'ORDER_SYNC',
                orderId: order.id,
                status: 'cancelled',
                action: 'auto_cancel_pickup_expired'
              });
              channel.close();
            } catch (e) {}

            return {
              ...order,
              status: 'cancelled' as const,
              isAutoCancelled: true,
              autoCancelledReason:
                'Customer did not pick up within designated pickup time. Order auto-cancelled and stock restored. (ସମୟ ଅତିକ୍ରାନ୍ତ ହେବାରୁ ଅର୍ଡର ସ୍ୱୟଂକ୍ରିୟ ବାତିଲ ଓ ଷ୍ଟକ୍ ଫେରସ୍ତ)',
              stockRestored: true
            };
          }
          return order;
        });

        return modified ? updated : prevOrders;
      });

      if (newlyRestored && Object.keys(itemsToRestore).length > 0) {
        setCatalog(prevCatalog => {
          return prevCatalog.map(p => {
            const cleanEan = String(p.ean).replace(/^EAN-/, '').trim();
            const addQty = itemsToRestore[cleanEan] || itemsToRestore[p.product_name] || 0;
            if (addQty > 0) {
              const cur = parseProductStock(p.stock_qty);
              const nextStock = cur + addQty;
              updateProductStockOnSheet(p.ean, nextStock, p.rowIndex, p.product_name).catch(() => {});
              return {
                ...p,
                stock_qty: nextStock
              };
            }
            return p;
          });
        });
        showToast('⚠️ ସମୟ ସରିଯିବାରୁ ପିକଅପ୍ ଅର୍ଡର ସ୍ୱୟଂକ୍ରିୟ ବାତିଲ ହୋଇଛି ଏବଂ ଷ୍ଟକ୍ ଫେରିଆସିଛି (Stock Restored)', 'warning');
      }
    };

    checkExpiredPickupOrders();
    const interval = setInterval(checkExpiredPickupOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const updateOrderStage = async (orderId: string, stage: number, status: Order['status']): Promise<boolean> => {
    markOrderAlerted(orderId);
    setIncomingOrderAlert((prev) => (prev?.id === orderId ? null : prev));
    setAllOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, stage, status, reviewed: status === 'reviewed' ? true : o.reviewed } : o))
    );
    try {
      const channel = new BroadcastChannel('munna_order_sync_channel');
      channel.postMessage({ type: 'ORDER_SYNC', orderId, stage, status, action: status });
      channel.close();
    } catch (e) {}
    await updateOrderStatusOnSheet(orderId, status, stage);
    return true;
  };

  // Secure customer order tracker: allows user to track an order if they supply both Order ID and Phone Number
  const linkOrderToDevice = (orderId: string, phone: string): boolean => {
    const cleanOrderId = orderId.trim().toUpperCase();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanOrderId || !cleanPhone) {
      showToast(isEnglish ? 'Please provide Order ID and 10-digit Phone Number.' : 'ଦୟାକରି ଅର୍ଡର ID ଓ ୧୦-ଅଙ୍କ ଫୋନ୍ ନମ୍ବର ପ୍ରବେଶ କରନ୍ତୁ।', 'warning');
      return false;
    }
    const match = allOrders.find(o => {
      const matchId = String(o.id || '').trim().toUpperCase() === cleanOrderId;
      const matchPhone = String(o.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone;
      return matchId && matchPhone;
    });
    if (match) {
      setDeviceOrderIds(prev => (prev.includes(match.id) ? prev : [match.id, ...prev]));
      showToast(isEnglish ? `✅ Order #${match.id} verified & linked to this device!` : `✅ ଅର୍ଡର #${match.id} ଯାଞ୍ଚ ହୋଇ ଏହି ଡିଭାଇସ୍ ସହ ଯୋଡ଼ାଗଲା!`);
      return true;
    } else {
      showToast(
        isEnglish
          ? '❌ No matching order found. Please check Order ID and Phone Number.'
          : '❌ କୌଣସି ଅର୍ଡର ମିଳିଲା ନାହିଁ। ଅର୍ଡର ID ଓ ଫୋନ୍ ନମ୍ବର ଯାଞ୍ଚ କରନ୍ତୁ।',
        'error'
      );
      return false;
    }
  };

  // Addresses — Strictly Read & Write to Google Sheet
  const saveAddress = async (addrData: Omit<Address, 'id'>, id?: string): Promise<void> => {
    const newId = id || 'addr-' + Date.now();
    const targetAddr: Address = { ...addrData, id: newId };
    let nextList: Address[] = [];

    setAddresses(prev => {
      if (id) {
        nextList = prev.map(a => (a.id === id ? targetAddr : (addrData.isDefault ? { ...a, isDefault: false } : a)));
      } else {
        const sanitized = addrData.isDefault ? prev.map(a => ({ ...a, isDefault: false })) : prev;
        nextList = [targetAddr, ...sanitized];
      }
      return nextList;
    });

    setIsSavingAddress(true);
    try {
      await saveAddressToSheet({
        id: newId,
        name: addrData.name,
        address: addrData.address,
        phone: addrData.phone || sessionUser?.phone || '',
        isDefault: addrData.isDefault,
        location: addrData.lat && addrData.lng ? `${addrData.lat},${addrData.lng}` : '',
        allAddresses: nextList
      });
    } finally {
      setIsSavingAddress(false);
    }
  };

  const deleteAddress = async (id: string): Promise<void> => {
    let nextList: Address[] = [];
    setAddresses(prev => {
      nextList = prev.filter(a => a.id !== id);
      if (nextList.length > 0 && !nextList.some(a => a.isDefault)) {
        nextList[0] = { ...nextList[0], isDefault: true };
      }
      return nextList;
    });

    if (sessionUser?.phone) {
      setIsSavingAddress(true);
      try {
        await deleteAddressFromSheet(sessionUser.phone, id, nextList);
      } finally {
        setIsSavingAddress(false);
      }
    }
  };

  const setDefaultAddress = async (id: string): Promise<void> => {
    let selectedAddr: Address | undefined;
    let nextList: Address[] = [];
    setAddresses(prev => {
      nextList = prev.map(a => {
        const isDef = a.id === id;
        if (isDef) selectedAddr = { ...a, isDefault: true };
        return { ...a, isDefault: isDef };
      });
      return nextList;
    });

    if (selectedAddr) {
      setIsSavingAddress(true);
      try {
        await saveAddressToSheet({
          id: selectedAddr.id,
          name: selectedAddr.name,
          address: selectedAddr.address,
          phone: selectedAddr.phone || sessionUser?.phone || '',
          isDefault: true,
          location: selectedAddr.lat && selectedAddr.lng ? `${selectedAddr.lat},${selectedAddr.lng}` : '',
          allAddresses: nextList
        });
      } finally {
        setIsSavingAddress(false);
      }
    }
  };

  // Catalog management
  const addProduct = (p: Product) => {
    if (syncPausedUntilRef.current > Date.now()) {
      resumeBackgroundSync(false);
    }
    const allEans = parseEanList(p.ean, p.additional_eans, p.ean_list);
    const cleanEan = allEans[0] || getPrimaryEan(p.ean);
    const rawEan = String(p.ean).trim();

    unrecordDeletedProduct(cleanEan || rawEan, p.product_name);
    allEans.forEach((code) => unrecordDeletedProduct(code));

    setCatalog((prev) => {
      const existingMatch = prev.find((item) => doesProductMatchEan(item, allEans));
      const mergedEans = existingMatch
        ? parseEanList(existingMatch.ean, existingMatch.additional_eans, existingMatch.ean_list, allEans)
        : allEans;
      const primaryEan = existingMatch ? existingMatch.ean : (cleanEan || rawEan);

      const finalProduct: Product = {
        ...(existingMatch || {}),
        ...p,
        rowIndex: p.rowIndex || existingMatch?.rowIndex,
        ean: primaryEan,
        additional_eans: mergedEans.join(', '),
        ean_list: mergedEans
      };

      const filtered = prev.filter((item) => !doesProductMatchEan(item, mergedEans));
      return [finalProduct, ...filtered];
    });
  };

  const updateProduct = (p: Product, previousEan?: string) => {
    if (syncPausedUntilRef.current > Date.now()) {
      resumeBackgroundSync(false);
    }
    const allEans = parseEanList(p.ean, p.additional_eans, p.ean_list);
    const cleanEan = allEans[0] || getPrimaryEan(p.ean);
    const rawEan = String(p.ean).trim();
    const searchEans = parseEanList(allEans, previousEan);
    recentEditsRef.current[cleanEan] = Date.now();
    searchEans.forEach((code) => {
      recentEditsRef.current[code] = Date.now();
    });

    unrecordDeletedProduct(allEans.join(', '), p.product_name);
    const safeStock = parseProductStock(p.stock_qty);

    setCatalog((prev) => {
      let matchedAny = false;
      const next = prev.map((item) => {
        const matchesEan = doesProductMatchEan(item, searchEans) || String(item.ean).trim() === rawEan;
        const matchesName = Boolean(p.product_name && item.product_name && item.product_name.toLowerCase().trim() === p.product_name.toLowerCase().trim());
        const matchesRow = Boolean(p.rowIndex && item.rowIndex === p.rowIndex && (matchesEan || matchesName));
        if (matchesEan || matchesName || matchesRow) {
          matchedAny = true;
          const mergedEans = parseEanList(cleanEan, allEans, item.ean, item.additional_eans, item.ean_list);
          return {
            ...item,
            ...p,
            ean: cleanEan || item.ean,
            additional_eans: mergedEans.join(', '),
            ean_list: mergedEans,
            stock_qty: safeStock
          };
        }
        return item;
      });
      return matchedAny
        ? next
        : [
            {
              ...p,
              ean: cleanEan,
              additional_eans: allEans.join(', '),
              ean_list: allEans,
              stock_qty: safeStock
            },
            ...next
          ];
    });
  };

  const deleteProduct = (ean: string, rowIndex?: number, productName?: string, additionalEans?: string | string[]) => {
    const rawEan = String(ean).trim();
    const cleanEan = rawEan.replace(/^EAN-/, '').trim();
    const matchedItem = catalog.find(
      (item) =>
        doesProductMatchEan(item, [ean, cleanEan]) ||
        (productName && item.product_name && item.product_name.toLowerCase().trim() === productName.toLowerCase().trim())
    );
    const targetName = (productName || matchedItem?.product_name || '').trim();
    const allEans = parseEanList(ean, additionalEans, matchedItem?.ean, matchedItem?.additional_eans, matchedItem?.ean_list);
    const allCodesSet = new Set([rawEan, cleanEan, ...allEans].filter(Boolean));

    const remainingProducts = catalog.filter((item) => {
      const matchesName = Boolean(targetName && item.product_name && item.product_name.toLowerCase().trim() === targetName.toLowerCase());
      const matchesPrimaryEan = String(item.ean).replace(/^EAN-/, '').trim() === cleanEan;
      const matchesRow = Boolean(rowIndex && rowIndex > 0 && item.rowIndex === rowIndex && (matchesPrimaryEan || matchesName));
      return !matchesName && !matchesPrimaryEan && !matchesRow;
    });
    const unsharedEans = allEans.filter((code) => !remainingProducts.some((rem) => doesProductMatchEan(rem, code)));
    const unsharedEansStr = unsharedEans.join(', ');

    allCodesSet.forEach((code) => {
      recentEditsRef.current[code] = Date.now();
    });

    recordDeletedProduct(unsharedEansStr || cleanEan, targetName);

    setCatalog((prev) => {
      return prev.filter((item) => {
        const matchesName = Boolean(targetName && item.product_name && item.product_name.toLowerCase().trim() === targetName.toLowerCase());
        const matchesPrimaryEan = String(item.ean).replace(/^EAN-/, '').trim() === cleanEan || String(item.ean).trim() === rawEan;
        const matchesRow = Boolean(rowIndex && rowIndex > 0 && item.rowIndex === rowIndex && (matchesPrimaryEan || matchesName));
        const matchesUnsharedEan = unsharedEans.length > 0 && doesProductMatchEan(item, unsharedEans);
        return !matchesName && !matchesPrimaryEan && !matchesRow && !matchesUnsharedEan;
      });
    });

    setCart((prevCart) => {
      const nextCart = { ...prevCart };
      allCodesSet.forEach((code) => {
        if (nextCart[code] !== undefined) delete nextCart[code];
      });
      return nextCart;
    });

    setWishlist((prevWishlist) => {
      return prevWishlist.filter((id) => !allCodesSet.has(id) && !allCodesSet.has(String(id).replace(/^EAN-/, '').trim()));
    });

    setShopConfig((prev) => {
      const curTrending = normalizeTrending(prev.trending);
      const nextTrending = curTrending.filter((t) => {
        const cleanT = String(t).replace(/^EAN-/, '').trim();
        return !allCodesSet.has(cleanT) && !allCodesSet.has(String(t).trim());
      });
      return { ...prev, trending: nextTrending };
    });

    showToast(
      isEnglish
        ? `🗑️ Deleted "${targetName || cleanEan}" from Store & Google Sheet`
        : `🗑️ "${targetName || cleanEan}" ଷ୍ଟୋର୍ ଓ Google Sheet ରୁ ଡିଲିଟ୍ ହେଲା`
    );

    deleteProductFromSheet(ean, rowIndex, targetName, unsharedEans.length > 0 ? unsharedEans : allEans).catch(() => {});
  };

  const updateShopConfig = (cfg: Partial<ShopConfig>) => {
    setShopConfig((prev) => ({
      ...prev,
      ...cfg,
      ...(cfg.pickupActive !== undefined ? { pickupActive: isStorePickupActive(cfg) } : {}),
      ...(cfg.codActive !== undefined ? { codActive: isCodDeliveryActive(cfg) } : {}),
      ...(cfg.trending !== undefined ? { trending: normalizeTrending(cfg.trending) } : {})
    }));
  };

  const updateBanners = (newBanners: Banner[]) => {
    setBanners(newBanners);
  };

  const isAnySheetReading =
    isSyncingStock ||
    isRefreshingOrders ||
    isLoadingAddresses ||
    isSavingAddress ||
    isSyncingCart;

  return (
    <AppContext.Provider
      value={{
        catalog,
        cart,
        appliedCoupon,
        banners,
        shopConfig,
        activeScreen,
        activeCategory,
        searchQuery,
        selectedProduct,
        isEnglish,
        sessionUser,
        addresses,
        myOrders,
        allOrders,
        isAdminLoggedIn,
        showLoginModal,
        authNoticeMessage,
        pendingCheckout,
        showAdminPinModal,
        showScanner,
        showPermissionModal,
        showPaymentPolicyModal,
        scannerMode,
        incomingOrderAlert,
        adminNotice,
        wishlist,
        wishlistCount,

        isInitialSheetLoading,
        isSheetSlowWarning,
        retryInitialSheetLoad,
        isLoadingAddresses,
        isSavingAddress,
        isSyncingCart,
        isAnySheetReading,
        refreshAddresses,
        refreshCartFromSheet,

        setShowPermissionModal,
        setShowPaymentPolicyModal,

        setAuthNoticeMessage,
        setPendingCheckout,
        setActiveScreen,
        goBackScreen,
        toggleWishlist,
        isWishlisted,
        setActiveCategory,
        setSearchQuery,
        setSelectedProduct,
        setIsEnglish,
        setAppliedCoupon,
        setQty,
        clearCart,
        cartBilling,
        placeOrder,
        cancelOrder,
        updateOrderStage,
        linkOrderToDevice,
        saveAddress,
        deleteAddress,
        setDefaultAddress,
        setSessionUser,
        loginAdmin,
        logoutAdmin,
        setShowLoginModal,
        setShowAdminPinModal,
        setShowScanner,
        setIncomingOrderAlert,
        markOrderAlerted,
        setAdminNotice,
        addProduct,
        updateProduct,
        deleteProduct,
        updateShopConfig,
        updateBanners,
        setCatalog,
        isRefreshingOrders,
        refreshOrders,
        lastStockSyncTime,
        isSyncingStock,
        syncLiveStockWithServer,
        hasUnsavedAdminChanges,
        setHasUnsavedAdminChanges,
        isSyncPaused,
        pauseSyncRemainingSec,
        pauseBackgroundSync,
        resumeBackgroundSync
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
