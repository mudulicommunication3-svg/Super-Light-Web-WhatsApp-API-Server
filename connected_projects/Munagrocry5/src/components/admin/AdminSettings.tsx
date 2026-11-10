import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Banner, ShopConfig, CustomerNotice } from '../../types';
import {
  Settings,
  Store,
  Truck,
  Ticket,
  Flame,
  Image,
  Link,
  Plus,
  Trash2,
  Save,
  Check,
  Upload,
  AlertCircle,
  RefreshCw,
  Clock,
  CreditCard,
  ShoppingBag,
  Download,
  Info,
  Database,
  ExternalLink,
  Copy,
  FileCode,
  CheckCircle2,
  BellRing,
  Lock,
  UserCheck,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  Pause,
  Play
} from 'lucide-react';
import {
  saveConfigToSheet,
  pushConfigKeyToSheet,
  fetchSheetConfig,
  getWebhookUrl,
  setWebhookUrl,
  getGoogleSheetId,
  setGoogleSheetId,
  getSpreadsheetUrl,
  uploadImageToImgbb,
  APP_CONFIG,
  isStoreOpenNow,
  isStorePickupActive,
  isCodDeliveryActive,
  isUpiPaymentActive,
  saveShareFormatToConfigSheet,
  resetAllProductShareLinks,
  fixAndForceRefreshWhatsAppLinkCache
} from '../../services/api';
import {
  DEFAULT_WHATSAPP_SHARE_FORMAT,
  DEFAULT_LINK_PASTE_CAPTION_FORMAT,
  getConfiguredShareFormat,
  getConfiguredLinkCaptionFormat,
  formatProductWithTemplate,
  formatLinkPreviewCaption,
  resolveProductFromShortLink,
  getProductBestShareImage,
  getPrimaryCleanEan,
  getDynamicShareUrl
} from '../../utils/shareUtils';
import { playOrderAlertChime } from '../../utils/audioAlert';
import { showToast } from '../Toast';

export const AdminSettings: React.FC = () => {
  const {
    catalog,
    setCatalog,
    shopConfig,
    updateShopConfig,
    banners,
    updateBanners,
    adminNotice,
    setAdminNotice,
    hasUnsavedAdminChanges,
    setHasUnsavedAdminChanges,
    isSyncPaused,
    pauseSyncRemainingSec,
    pauseBackgroundSync,
    resumeBackgroundSync
  } = useApp();
  const { isEnglish } = useLanguage();

  // 1. Store Operation & Timings
  const [storeOpen, setStoreOpen] = useState(shopConfig.storeOpen ?? true);
  const [closedMessage, setClosedMessage] = useState(
    shopConfig.storeClosedMessage ||
      'ALL ORDER DELIVERY ON AFTER 10 AM'
  );
  const [closedCheckoutMessage, setClosedCheckoutMessage] = useState(
    shopConfig.storeClosedCheckoutMessage || ''
  );
  const [storeOpenTime, setStoreOpenTime] = useState(shopConfig.storeOpenTime || '10:00');
  const [storeCloseTime, setStoreCloseTime] = useState(shopConfig.storeCloseTime || '21:00');

  // Staged toggle helpers (MANUAL SAVE ONLY - no auto-push on click)
  const handleToggleStoreOpen = () => {
    const next = !storeOpen;
    setStoreOpen(next);
    updateShopConfig({ storeOpen: next });
    setHasUnsavedAdminChanges(true);
    showToast(next ? '🟢 Store OPEN (Staged • Click "Save All Settings" to publish)' : '🔴 Store CLOSED (Staged • Click "Save All Settings" to publish)');
  };
  const handleToggleCod = () => {
    const next = !isCodDeliveryActive({ codActive });
    setCodActive(next);
    updateShopConfig({ codActive: next });
    setHasUnsavedAdminChanges(true);
    showToast(next ? '✅ Cash on Delivery (COD) turned ON (Staged)' : '⛔ Cash on Delivery (COD) turned OFF (Staged)');
  };
  const handleToggleUpi = () => {
    const next = !isUpiPaymentActive({ upiActive });
    setUpiActive(next);
    updateShopConfig({ upiActive: next });
    setHasUnsavedAdminChanges(true);
    showToast(next ? '✅ UPI QR Payment turned ON (Staged)' : '⛔ UPI QR Payment turned OFF (Staged)');
  };
  const handleTogglePickup = () => {
    const next = !isStorePickupActive({ pickupActive });
    setPickupActive(next);
    updateShopConfig({ pickupActive: next });
    setHasUnsavedAdminChanges(true);
    showToast(next ? '✅ Store Pickup turned ON (Staged)' : '⛔ Store Pickup turned OFF (Staged)');
  };
  const handleTogglePickupCharge = () => {
    const next = !pickupChargeOn;
    setPickupChargeOn(next);
    updateShopConfig({ pickupChargeOn: next });
    setHasUnsavedAdminChanges(true);
    showToast(next ? `💵 Pickup Charge Fee ON (₹${pickupChargeFee}) (Staged)` : '🆓 Store Pickup is now 100% FREE (Staged)');
  };

  // 1b. Incoming Order Notification & Ring Settings
  const [orderNotificationEnabled, setOrderNotificationEnabled] = useState(
    shopConfig.orderNotificationEnabled ?? true
  );
  const [orderRingEnabled, setOrderRingEnabled] = useState(
    shopConfig.orderRingEnabled ?? true
  );
  const [orderNotificationHours, setOrderNotificationHours] = useState<'always' | 'store_hours'>(
    shopConfig.orderNotificationHours || 'always'
  );
  const [orderRingHours, setOrderRingHours] = useState<'always' | 'store_hours'>(
    shopConfig.orderRingHours || 'always'
  );

  const handleToggleOrderNotification = () => {
    const next = !orderNotificationEnabled;
    setOrderNotificationEnabled(next);
    updateShopConfig({ orderNotificationEnabled: next });
    setHasUnsavedAdminChanges(true);
    showToast(next ? '✅ Incoming Order Notifications turned ON (Staged)' : '⛔ Incoming Order Notifications turned OFF (Staged)');
  };

  const handleToggleOrderRing = () => {
    const next = !orderRingEnabled;
    setOrderRingEnabled(next);
    updateShopConfig({ orderRingEnabled: next });
    setHasUnsavedAdminChanges(true);
    showToast(next ? '🔊 Incoming Order Ring & Vibration turned ON (Staged)' : '🔇 Incoming Order Ring turned OFF (Staged)');
  };

  const handleChangeNotificationHours = (mode: 'always' | 'store_hours') => {
    setOrderNotificationHours(mode);
    updateShopConfig({ orderNotificationHours: mode });
    setHasUnsavedAdminChanges(true);
    showToast(mode === 'store_hours' ? '⏰ Notifications: Store Open Hours only (Staged)' : '🌐 Notifications: 24x7 Always (Staged)');
  };

  const handleChangeRingHours = (mode: 'always' | 'store_hours') => {
    setOrderRingHours(mode);
    updateShopConfig({ orderRingHours: mode });
    setHasUnsavedAdminChanges(true);
    showToast(mode === 'store_hours' ? '⏰ Ring audio: Store Open Hours only (Staged)' : '🌐 Ring audio: 24x7 Always (Staged)');
  };

  const handleTestRing = () => {
    playOrderAlertChime();
    showToast(isEnglish ? '🔊 Playing test incoming order chime & vibration!' : '🔊 ରିଙ୍ଗ୍ ଟୋନ୍ ଓ ଭାଇବ୍ରେସନ୍ ପରୀକ୍ଷା ଚାଲିଛି!');
  };

  // 2. Delivery & Thresholds
  const [deliveryFee, setDeliveryFee] = useState(shopConfig.deliveryFee ?? 30);
  const [freeAbove, setFreeAbove] = useState(shopConfig.freeAbove ?? 500);
  const [deliverySlot, setDeliverySlot] = useState(shopConfig.deliverySlot || '1 hour');
  const [deliveryDay, setDeliveryDay] = useState(shopConfig.deliveryDay || 'Today');

  const [codActive, setCodActive] = useState(isCodDeliveryActive(shopConfig));
  const [codNotice, setCodNotice] = useState(shopConfig.codNotice || 'Cash on Delivery Available');
  const [codMinBill, setCodMinBill] = useState(shopConfig.codMinBill ?? 200);
  const [upiActive, setUpiActive] = useState(isUpiPaymentActive(shopConfig));
  const [upiId, setUpiId] = useState(shopConfig.upiId || '9040585726@ybl');
  const [upiPayeeName, setUpiPayeeName] = useState(shopConfig.upiPayeeName || 'Munna Mobile & Grocery');
  const [upiCustomQrUrl, setUpiCustomQrUrl] = useState(shopConfig.upiCustomQrUrl || '');
  const [isUploadingUpiQr, setIsUploadingUpiQr] = useState(false);
  const [pickupActive, setPickupActive] = useState(isStorePickupActive(shopConfig));
  const [pickupNote, setPickupNote] = useState(shopConfig.pickupNote || 'Free Store Pickup');
  const [pickupSlotsInput, setPickupSlotsInput] = useState(
    Array.isArray(shopConfig.pickupSlots)
      ? shopConfig.pickupSlots.join(', ')
      : typeof shopConfig.pickupSlots === 'string'
      ? shopConfig.pickupSlots
      : '30 min, 1 hour, 2 hour'
  );
  const [pickupChargeOn, setPickupChargeOn] = useState(shopConfig.pickupChargeOn ?? false);
  const [pickupChargeFee, setPickupChargeFee] = useState(shopConfig.pickupChargeFee ?? 0);
  const [pickupCancelNotice, setPickupCancelNotice] = useState(
    shopConfig.pickupCancelNotice ||
      'If the items are not picked up within the selected pickup time, the order will be automatically cancelled by the seller. (ସୂଚନା: ନିର୍ଦ୍ଧାରିତ ସମୟ ମଧ୍ୟରେ ଅର୍ଡର ସଂଗ୍ରହ ନକଲେ ବିକ୍ରେତାଙ୍କ ଦ୍ୱାରା ଅର୍ଡର ସ୍ୱୟଂଚାଳିତ ଭାବେ ବାତିଲ୍ ହୋଇଯିବ।)'
  );

  // Store Pickup Location & Contact details (Editable with default upper name Munna Grocery & Mobile)
  const [shareStoreName, setShareStoreName] = useState(
    shopConfig.storeName || 'Munna Mobile & Grocery'
  );
  const [storePickupName, setStorePickupName] = useState(
    shopConfig.storePickupName || 'Munna Grocery & Mobile'
  );
  const [storePickupAddress, setStorePickupAddress] = useState(
    shopConfig.storePickupAddress || 'Cinema Hall Road, Niali'
  );
  const [storePickupPhone, setStorePickupPhone] = useState(
    shopConfig.storePickupPhone || '9040585726'
  );
  const [storePickupHours, setStorePickupHours] = useState(
    shopConfig.storePickupHours || '10:00 AM - 09:00 PM (Daily)'
  );
  const [whatsappShareFormat, setWhatsappShareFormat] = useState(
    shopConfig.whatsappShareFormat || getConfiguredShareFormat()
  );
  const [whatsappLinkCaptionFormat, setWhatsappLinkCaptionFormat] = useState(
    shopConfig.whatsappLinkCaptionFormat || getConfiguredLinkCaptionFormat()
  );
  const [isSavingShareFormat, setIsSavingShareFormat] = useState(false);
  const [isResettingAllLinks, setIsResettingAllLinks] = useState(false);
  const [shortLinkTestInput, setShortLinkTestInput] = useState('');

  const handleResetAllLinksFrontendAndBackend = async () => {
    setIsResettingAllLinks(true);
    try {
      const res = await resetAllProductShareLinks(catalog);
      if (res.updatedProducts && res.updatedProducts.length > 0) {
        setCatalog(res.updatedProducts);
      }
      updateShopConfig({
        shareLinkVersion: res.versionTag,
        lastLinkResetAt: new Date().toISOString()
      });
      const msg = isEnglish
        ? `✅ All ${res.totalCount} product links reset (Frontend + Backend)! ${res.healedCount} photo links healed to HTTPS CDN.`
        : `✅ ସମସ୍ତ ${res.totalCount} ଟି ସାମଗ୍ରୀର ଲିଙ୍କ୍ (Frontend + Backend) ରିସେଟ୍ ହେଲା! (${res.healedCount} ଟି ଫଟୋ CDN ଲିଙ୍କ୍ ସଜଡ଼ାଗଲା)`;
      showToast(msg);
      setFeedbackMsg({ text: msg, ok: true });
    } catch (e: any) {
      showToast('Error resetting all product links');
    } finally {
      setIsResettingAllLinks(false);
    }
  };

  const [isFixingPreviewCache, setIsFixingPreviewCache] = useState(false);

  const handleFixWhatsAppPreviewCache = async () => {
    setIsFixingPreviewCache(true);
    setFeedbackMsg(null);
    try {
      const cleanFmt = (whatsappShareFormat || '').trim() || DEFAULT_WHATSAPP_SHARE_FORMAT;
      const cleanLinkCap = (whatsappLinkCaptionFormat || '').trim() || DEFAULT_LINK_PASTE_CAPTION_FORMAT;
      const cleanStore = (shareStoreName || '').trim() || 'Munna Mobile & Grocery';
      const cleanAddr = (storePickupAddress || '').trim() || 'Cinema Hall Road, Niali';

      await saveShareFormatToConfigSheet(cleanFmt, cleanStore, cleanAddr, cleanLinkCap);
      const res = await fixAndForceRefreshWhatsAppLinkCache(catalog);

      if (res.updatedProducts && res.updatedProducts.length > 0) {
        setCatalog(res.updatedProducts);
      }
      updateShopConfig({
        shareLinkVersion: res.versionTag,
        whatsappShareFormat: cleanFmt,
        whatsappLinkCaptionFormat: cleanLinkCap,
        storeName: cleanStore,
        storePickupAddress: cleanAddr
      });

      const msg = isEnglish
        ? `⚡ WhatsApp Link Preview Cache Busted (Token: v=${res.versionTag})! Caption template saved to Sheet & all ${res.totalProducts || res.totalCount} product links refreshed!`
        : `⚡ WhatsApp ଲିଙ୍କ୍ ପ୍ରିଭ୍ୟୁ କ୍ୟାଶ୍ ରିସେଟ୍ ହେଲା (Token: v=${res.versionTag})! Sheet Config ଟ୍ୟାବ୍‌ରେ କ୍ୟାପସନ୍ ସେଭ୍ ହେଲା ଓ ସବୁ ଲିଙ୍କ୍ ରିଫ୍ରେଶ୍ ହେଲା!`;

      showToast(msg);
      setFeedbackMsg({ text: msg, ok: true });
    } catch (e: any) {
      showToast('Error fixing WhatsApp preview cache');
    } finally {
      setIsFixingPreviewCache(false);
    }
  };

  // 4. Coupons & Discounts
  const [couponCode, setCouponCode] = useState(shopConfig.couponCode ?? 'MUNNA10');
  const [couponPercent, setCouponPercent] = useState(shopConfig.couponPercent ?? 10);
  const [couponMinBill, setCouponMinBill] = useState(shopConfig.couponMinBill ?? 300);

  // 5. Trending Offers EAN barcodes
  const [trendingInput, setTrendingInput] = useState(
    Array.isArray(shopConfig.trending)
      ? shopConfig.trending.join(', ')
      : (shopConfig.trending || '7533476, 7533478')
  );

  // 6. Mobile App Download URL
  const [appDownloadUrl, setAppDownloadUrl] = useState(shopConfig.appDownloadUrl || '/munagrocery.apk');

  // 7. Banners local state
  const [bannerList, setBannerList] = useState<Banner[]>(banners);
  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerImg, setNewBannerImg] = useState('');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // 8. Broadcast Announcement Notice (Displays on customer Home screen)
  const [noticeActive, setNoticeActive] = useState(
    Boolean(adminNotice && (adminNotice.title || adminNotice.text || adminNotice.img))
  );
  const [noticeTitle, setNoticeTitle] = useState(adminNotice?.title || '📢 ନୂତନ ଅଫର୍ / ଅପଡେଟ୍');
  const [noticeText, setNoticeText] = useState(
    adminNotice?.text || 'Fresh Fruits & Vegetables just arrived today! Get up to 40% discount.'
  );
  const [noticeImg, setNoticeImg] = useState(adminNotice?.img || '');
  const [noticeUrl, setNoticeUrl] = useState(adminNotice?.url || '');
  const [isUploadingNoticeImg, setIsUploadingNoticeImg] = useState(false);

  // 9. Admin Credentials
  const [adminUsername, setAdminUsername] = useState(
    localStorage.getItem('munna_admin_username') || APP_CONFIG.ADMIN_USERNAME || ''
  );
  const [adminPassword, setAdminPassword] = useState(
    localStorage.getItem('munna_admin_password') || APP_CONFIG.ADMIN_PASSWORD || ''
  );

  // 10. Google Sheet ID & Webhook settings
  const [sheetId, setSheetIdState] = useState(getGoogleSheetId());
  const [webhookUrl, setWebhookUrlState] = useState(getWebhookUrl());
  const [testResult, setTestResult] = useState<string | null>(null);
  const [dbSetupStatus, setDbSetupStatus] = useState<string | null>(null);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Save feedback state
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Sync internal state when external shopConfig updates (ONLY if user has no staged unsaved changes)
  useEffect(() => {
    if (hasUnsavedAdminChanges) return;
    setStoreOpen(shopConfig.storeOpen ?? true);
    if (shopConfig.storeClosedMessage) setClosedMessage(shopConfig.storeClosedMessage);
    if (shopConfig.storeClosedCheckoutMessage !== undefined) setClosedCheckoutMessage(shopConfig.storeClosedCheckoutMessage);
    if (shopConfig.storeOpenTime) setStoreOpenTime(shopConfig.storeOpenTime);
    if (shopConfig.storeCloseTime) setStoreCloseTime(shopConfig.storeCloseTime);
    if (shopConfig.deliveryFee !== undefined) setDeliveryFee(shopConfig.deliveryFee);
    if (shopConfig.freeAbove !== undefined) setFreeAbove(shopConfig.freeAbove);
    if (shopConfig.deliverySlot) setDeliverySlot(shopConfig.deliverySlot);
    if (shopConfig.deliveryDay) setDeliveryDay(shopConfig.deliveryDay);
    if (shopConfig.codActive !== undefined) setCodActive(isCodDeliveryActive(shopConfig));
    if (shopConfig.codNotice) setCodNotice(shopConfig.codNotice);
    if (shopConfig.upiActive !== undefined) setUpiActive(isUpiPaymentActive(shopConfig));
    if (shopConfig.upiId) setUpiId(shopConfig.upiId);
    if (shopConfig.upiPayeeName) setUpiPayeeName(shopConfig.upiPayeeName);
    if (shopConfig.upiCustomQrUrl !== undefined) setUpiCustomQrUrl(shopConfig.upiCustomQrUrl);
    if (shopConfig.pickupActive !== undefined) setPickupActive(isStorePickupActive(shopConfig));
    if (shopConfig.pickupNote) setPickupNote(shopConfig.pickupNote);
    if (shopConfig.pickupCancelNotice) setPickupCancelNotice(shopConfig.pickupCancelNotice);
    if (shopConfig.couponCode) setCouponCode(shopConfig.couponCode);
    if (shopConfig.couponPercent !== undefined) setCouponPercent(shopConfig.couponPercent);
    if (shopConfig.couponMinBill !== undefined) setCouponMinBill(shopConfig.couponMinBill);
    if (shopConfig.appDownloadUrl) setAppDownloadUrl(shopConfig.appDownloadUrl);
    if (shopConfig.orderNotificationEnabled !== undefined) setOrderNotificationEnabled(shopConfig.orderNotificationEnabled);
    if (shopConfig.orderRingEnabled !== undefined) setOrderRingEnabled(shopConfig.orderRingEnabled);
    if (shopConfig.orderNotificationHours) setOrderNotificationHours(shopConfig.orderNotificationHours);
    if (shopConfig.orderRingHours) setOrderRingHours(shopConfig.orderRingHours);
    if (shopConfig.storeName) setShareStoreName(shopConfig.storeName);
    if (shopConfig.storePickupAddress) setStorePickupAddress(shopConfig.storePickupAddress);
    if (shopConfig.whatsappShareFormat) setWhatsappShareFormat(shopConfig.whatsappShareFormat);
    if (shopConfig.whatsappLinkCaptionFormat) setWhatsappLinkCaptionFormat(shopConfig.whatsappLinkCaptionFormat);
  }, [shopConfig, hasUnsavedAdminChanges]);

  // Dedicated Config-Tab-Only Save for WhatsApp Link Paste Caption & Optional Text Share Format
  const handleSaveShareFormatOnly = async () => {
    setIsSavingShareFormat(true);
    setFeedbackMsg(null);
    const cleanFmt = (whatsappShareFormat || '').trim() || DEFAULT_WHATSAPP_SHARE_FORMAT;
    const cleanLinkCap = (whatsappLinkCaptionFormat || '').trim() || DEFAULT_LINK_PASTE_CAPTION_FORMAT;
    const cleanStore = (shareStoreName || '').trim() || 'Munna Mobile & Grocery';
    const cleanAddr = (storePickupAddress || '').trim() || 'Cinema Hall Road, Niali';

    updateShopConfig({
      whatsappShareFormat: cleanFmt,
      whatsappLinkCaptionFormat: cleanLinkCap,
      storeName: cleanStore,
      storePickupAddress: cleanAddr
    });

    try {
      const res = await saveShareFormatToConfigSheet(cleanFmt, cleanStore, cleanAddr, cleanLinkCap);
      resumeBackgroundSync(false);
      if (res.ok) {
        showToast(isEnglish ? '✅ Link Caption & Share Format saved to Config tab!' : '✅ ଲିଙ୍କ୍ କ୍ୟାପସନ୍ ଓ ସେୟାର୍ ଫର୍ମାଟ୍ Config ଟ୍ୟାବ୍‌ରେ ସେଭ୍ ହେଲା!');
        setFeedbackMsg({
          text: isEnglish
            ? 'Only-Link Paste Auto Caption & Optional Share Format saved to Google Sheet Config tab! Auto-sync resumed. ✅'
            : 'କେବଳ ଲିଙ୍କ୍ ପେଷ୍ଟ ଅଟୋ-କ୍ୟାପସନ୍ ଓ ସେୟାର୍ ଫର୍ମାଟ୍ Google Sheet ର Config ଟ୍ୟାବ୍‌ରେ ସେଭ୍ ହେଲା! ✅',
          ok: true
        });
      } else {
        setFeedbackMsg({
          text: res.message || 'Saved locally, could not reach Sheet.',
          ok: false
        });
      }
    } catch (e: any) {
      setFeedbackMsg({
        text: 'Saved locally. Sheet error: ' + (e?.message || 'Failed'),
        ok: false
      });
    } finally {
      setIsSavingShareFormat(false);
    }
  };

  // Master Save Function
  const handleSaveAll = async () => {
    setIsSaving(true);
    setFeedbackMsg(null);

    const parsedTrending = trendingInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const parsedPickupSlots = pickupSlotsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const updatedConfig: Partial<ShopConfig> = {
      storeOpen,
      storeClosedMessage: closedMessage,
      storeClosedCheckoutMessage: closedCheckoutMessage,
      storeOpenTime,
      storeCloseTime,
      deliveryFee: Number(deliveryFee) || 0,
      freeAbove: Number(freeAbove) || 0,
      deliverySlot,
      deliveryDay,
      codActive,
      codNotice,
      codMinBill: Number(codMinBill) || 200,
      upiActive,
      upiId: upiId.trim() || '9040585726@ybl',
      upiPayeeName: upiPayeeName.trim() || 'Munna Mobile & Grocery',
      upiCustomQrUrl: upiCustomQrUrl.trim(),
      pickupActive,
      pickupNote,
      pickupSlots: parsedPickupSlots.length ? parsedPickupSlots : ['30 min', '1 hour', '2 hour'],
      pickupCancelNotice: pickupCancelNotice.trim(),
      pickupChargeOn,
      pickupChargeFee: Number(pickupChargeFee) || 0,
      couponCode: couponCode.trim().toUpperCase(),
      couponPercent: Number(couponPercent) || 0,
      couponMinBill: Number(couponMinBill) || 0,
      trending: parsedTrending,
      appDownloadUrl: appDownloadUrl.trim(),
      storeName: shareStoreName.trim() || 'Munna Mobile & Grocery',
      storePickupName: storePickupName.trim(),
      storePickupAddress: storePickupAddress.trim(),
      storePickupPhone: storePickupPhone.trim(),
      storePickupHours: storePickupHours.trim(),
      whatsappShareFormat: whatsappShareFormat.trim() || DEFAULT_WHATSAPP_SHARE_FORMAT,
      whatsappLinkCaptionFormat: whatsappLinkCaptionFormat.trim() || DEFAULT_LINK_PASTE_CAPTION_FORMAT,
      orderNotificationEnabled,
      orderRingEnabled,
      orderNotificationHours,
      orderRingHours
    };

    const updatedNotice: CustomerNotice | null = noticeActive
      ? {
          title: noticeTitle.trim(),
          text: noticeText.trim(),
          img: noticeImg.trim(),
          url: noticeUrl.trim(),
          ts: Date.now()
        }
      : null;

    // Update app context & local storage immediately
    updateShopConfig(updatedConfig);
    updateBanners(bannerList);
    setAdminNotice(updatedNotice);
    setWebhookUrl(webhookUrl);
    setGoogleSheetId(sheetId);

    try {
      localStorage.setItem('munna_admin_username', adminUsername.trim());
      localStorage.setItem('munna_admin_password', adminPassword.trim());
    } catch (e) {}

    // Send complete payload to Google Sheet Config tab
    try {
      const result = await saveConfigToSheet(
        updatedConfig,
        bannerList,
        updatedNotice,
        { username: adminUsername, password: adminPassword }
      );

      if (result.ok) {
        setHasUnsavedAdminChanges(false);
        resumeBackgroundSync(false);
        setFeedbackMsg({
          text: result.message || 'Saved and synced to Google Sheet successfully! ✅',
          ok: true
        });
      } else {
        setFeedbackMsg({
          text: result.message || 'Saved locally, but Google Sheet webhook returned error.',
          ok: false
        });
      }
    } catch (err: any) {
      setFeedbackMsg({
        text: 'Saved in app memory. Could not sync with Sheet: ' + (err?.message || 'Network error'),
        ok: false
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        setFeedbackMsg((prev) => (prev?.ok ? null : prev));
      }, 5000);
    }
  };

  // Pull fresh config from Google Sheet
  const handleRefreshFromSheet = async () => {
    setIsRefreshing(true);
    setFeedbackMsg(null);
    try {
      const sheetData = await fetchSheetConfig();
      if (sheetData) {
        if (sheetData.config) {
          updateShopConfig(sheetData.config);
        }
        if (sheetData.banners && sheetData.banners.length > 0) {
          setBannerList(sheetData.banners);
          updateBanners(sheetData.banners);
        }
        if (sheetData.notice) {
          setAdminNotice(sheetData.notice);
          setNoticeActive(true);
          setNoticeTitle(sheetData.notice.title || '');
          setNoticeText(sheetData.notice.text || '');
          setNoticeImg(sheetData.notice.img || '');
          setNoticeUrl(sheetData.notice.url || '');
        }
        if (sheetData.adminUsername) setAdminUsername(sheetData.adminUsername);
        if (sheetData.adminPassword) setAdminPassword(sheetData.adminPassword);

        setFeedbackMsg({
          text: 'Loaded latest configuration live from Google Sheet! ✅',
          ok: true
        });
      } else {
        setFeedbackMsg({
          text: 'Unable to fetch from Sheet. Check Webhook URL and Sheet ID.',
          ok: false
        });
      }
    } catch (e: any) {
      setFeedbackMsg({
        text: 'Error reading from Sheet: ' + (e?.message || 'Failed'),
        ok: false
      });
    } finally {
      setIsRefreshing(false);
      setTimeout(() => {
        setFeedbackMsg((prev) => (prev?.ok ? null : prev));
      }, 5000);
    }
  };

  const handleAddBanner = () => {
    if (!newBannerImg.trim()) return;
    const nextBanner: Banner = {
      id: Date.now(),
      title: newBannerTitle.trim() || 'Store Special Offer',
      img: newBannerImg.trim()
    };
    setBannerList([...bannerList, nextBanner]);
    setNewBannerTitle('');
    setNewBannerImg('');
  };

  const handleDeleteBanner = (idx: number) => {
    setBannerList(bannerList.filter((_, i) => i !== idx));
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploadingBanner(true);
    const url = await uploadImageToImgbb(e.target.files[0]);
    setIsUploadingBanner(false);
    if (url) {
      setNewBannerImg(url);
    } else {
      setFeedbackMsg({
        text: 'Failed to upload image. Please try again or provide an image link.',
        ok: false
      });
    }
  };

  const handleNoticeImgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploadingNoticeImg(true);
    const url = await uploadImageToImgbb(e.target.files[0]);
    setIsUploadingNoticeImg(false);
    if (url) {
      setNoticeImg(url);
    } else {
      setFeedbackMsg({
        text: 'Failed to upload notice image.',
        ok: false
      });
    }
  };

  const handleTestWebhook = async () => {
    setTestResult(isEnglish ? 'Testing connection...' : 'ସଂଯୋଗ ଯାଞ୍ଚ ହେଉଛି...');
    try {
      const freshUrl = `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}action=get_config&sheet_id=${encodeURIComponent(sheetId)}&_t=${Date.now()}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(freshUrl, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        },
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        setTestResult(isEnglish ? 'Connected successfully! ✅' : 'ସଂଯୋଗ ସଫଳ ହେଲା! ✅');
      } else {
        setTestResult(isEnglish ? 'Connection failed (HTTP Error) ⚠️' : 'ସଂଯୋଗ ବିଫଳ (HTTP Error) ⚠️');
      }
    } catch (e) {
      setTestResult(isEnglish ? 'Unable to reach Webhook URL ❌' : 'ୱେବହୁକ୍ ୟୁଆରଏଲ୍ ପହଞ୍ଚିପାରୁନାହିଁ ❌');
    }
  };

  const handleSetupDatabase = async () => {
    setDbSetupStatus(isEnglish ? 'Setting up 5 sheets...' : '୫ଟି ସିଟ୍ ପ୍ରସ୍ତୁତ ହେଉଛି...');
    try {
      const freshUrl = `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}action=setup_database&sheet_id=${encodeURIComponent(sheetId)}&_t=${Date.now()}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(freshUrl, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        },
        signal: ctrl.signal
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => null);
      if (data && data.status === 'success') {
        setDbSetupStatus(isEnglish ? 'All 5 Sheets Initialized! ✅' : 'ସମସ୍ତ ୫ଟି ସିଟ୍ ପ୍ରସ୍ତୁତ ହୋଇଗଲା! ✅');
      } else {
        setDbSetupStatus(isEnglish ? 'Auto-setup triggered ✅' : 'ଡାଟାବେସ୍ ସେଟଅପ୍ ସଫଳ ହେଲା ✅');
      }
    } catch (e) {
      setDbSetupStatus(isEnglish ? 'Setup request sent (Check Sheet)' : 'ଅନୁରୋଧ ପଠାଗଲା (ସିଟ୍ ଦେଖନ୍ତୁ)');
    }
    setTimeout(() => setDbSetupStatus(null), 5000);
  };

  const [fullAppsScriptCode, setFullAppsScriptCode] = useState<string>('Loading full Google Apps Script (/google-apps-script/Code.gs)...');

  useEffect(() => {
    fetch(`/google-apps-script/Code.gs?_t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => {
        if (text && text.trim().length > 100) {
          setFullAppsScriptCode(text);
        }
      })
      .catch(() => {});
  }, [showScriptModal]);

  const handleCopyScript = async () => {
    let codeToCopy = fullAppsScriptCode;
    if (!codeToCopy || codeToCopy.startsWith('Loading')) {
      try {
        const res = await fetch(`/google-apps-script/Code.gs?_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          codeToCopy = await res.text();
          setFullAppsScriptCode(codeToCopy);
        }
      } catch (e) {}
    }
    navigator.clipboard.writeText(codeToCopy);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Top Bar with Master Save & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs sticky top-0 z-20">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <span>Store Configuration & Controls (ଦୋକାନ ସେଟିଂସ୍)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEnglish
              ? 'Real-time sync with Google Sheet Config tab (Timings, Delivery, Pickup, COD, Notice, Coupons, Banners)'
              : 'ଗୁଗୁଲ୍ ସିଟ୍ Config ଟ୍ୟାବ୍ ସହ ସମସ୍ତ ସେଟିଂସ୍ (ସମୟ, ଡେଲିଭରୀ, COD, ନୋଟିସ୍, କୁପନ୍) ଲାଇଭ୍ ସିଙ୍କ୍'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (isSyncPaused) {
                resumeBackgroundSync(true);
              } else {
                pauseBackgroundSync(5);
              }
            }}
            className={`px-3 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
              isSyncPaused
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-2 ring-amber-200'
                : 'bg-slate-800 hover:bg-slate-900 text-white'
            }`}
            title="Pause background sync for 5 minutes while editing; auto-resumes after 5m or when Save is clicked"
          >
            {isSyncPaused ? <Play className="w-3.5 h-3.5 fill-slate-950" /> : <Pause className="w-3.5 h-3.5" />}
            <span>
              {isSyncPaused
                ? `▶️ Resume (${Math.floor(pauseSyncRemainingSec / 60)}:${String(pauseSyncRemainingSec % 60).padStart(2, '0')})`
                : '⏸️ Pause Sync (5m)'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleRefreshFromSheet}
            disabled={isRefreshing || isSaving}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Reload settings from Google Sheet"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Reading...' : 'Fetch Sheet'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Saving to Sheet...' : 'Save All Settings (ସେଭ୍ କରନ୍ତୁ)'}</span>
          </button>
        </div>
      </div>

      {/* Save Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${
            feedbackMsg.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-xs px-2 py-0.5 rounded hover:bg-black/5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dedicated Section: Only-Link Paste Auto Caption + Optional Text Format (Config Tab Only Sync) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-emerald-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">
                🔗
              </span>
              <span>
                {isEnglish
                  ? 'WhatsApp Only-Link Paste Auto Caption & Optional Text Format (Config Tab Sync)'
                  : 'WhatsApp କେବଳ ଲିଙ୍କ୍ ପେଷ୍ଟ ଅଟୋ-କ୍ୟାପସନ୍ ଓ ଟେକ୍ସଟ୍ ଫର୍ମାଟ୍ (Config ଟ୍ୟାବ୍ ସିଙ୍କ୍)'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isEnglish
                ? 'When you paste ONLY a product link in WhatsApp (no text copy), Field 1 automatically fills the photo card caption! Field 2 is optional for full text copy-paste.'
                : 'ଯେତେବେଳେ ଆପଣ WhatsApp ରେ କେବଳ ଲିଙ୍କ୍ ପେଷ୍ଟ କରିବେ (ବିନା କୌଣସି ଟେକ୍ସଟ୍ କପି), Field 1 ଅନୁଯାୟୀ ଫଟୋ କାର୍ଡ ତଳେ ଆପେ ଆପେ ନାମ, ଦର ଓ ଠିକଣା ଦେଖାଇବ!'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setWhatsappLinkCaptionFormat(DEFAULT_LINK_PASTE_CAPTION_FORMAT);
                setWhatsappShareFormat(DEFAULT_WHATSAPP_SHARE_FORMAT);
                setShareStoreName('Munna Mobile & Grocery');
                setStorePickupAddress('Cinema Hall Road, Niali');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition-colors"
            >
              ↺ {isEnglish ? 'Reset Defaults' : 'ଡିଫଲ୍ଟ ଫର୍ମାଟ୍'}
            </button>

            <button
              type="button"
              onClick={handleSaveShareFormatOnly}
              disabled={isSavingShareFormat}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSavingShareFormat ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>
                {isSavingShareFormat
                  ? (isEnglish ? 'Writing to Config...' : 'Config ରେ ସେଭ୍ ହେଉଛି...')
                  : (isEnglish ? '💾 Save Formats to Config Tab' : '💾 Config ଟ୍ୟାବ୍‌ରେ ସେଭ୍ କରନ୍ତୁ')}
              </span>
            </button>
          </div>
        </div>

        {/* Store Name & Address used in [Store Name] and [Address] */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              [Store Name] Value (ଦୋକାନ ନାମ)
            </label>
            <input
              type="text"
              value={shareStoreName}
              onChange={(e) => setShareStoreName(e.target.value)}
              placeholder="Munna Mobile & Grocery"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              [Address] Value (ଦୋକାନ ଠିକଣା)
            </label>
            <input
              type="text"
              value={storePickupAddress}
              onChange={(e) => setStorePickupAddress(e.target.value)}
              placeholder="Cinema Hall Road, Niali"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold"
            />
          </div>
        </div>

        {/* FIELD 1: Extra Editable Field for ONLY LINK PASTE Auto Caption (OpenGraph Card) */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black">
                  PRIMARY • ONLY LINK PASTE
                </span>
                <span>
                  {isEnglish
                    ? '1. Only-Link Paste Auto Caption Format (whatsapp_link_caption_format)'
                    : '୧. କେବଳ ଲିଙ୍କ୍ ପେଷ୍ଟ ଅଟୋ-କ୍ୟାପସନ୍ ଫର୍ମାଟ୍ (ବିନା ଟେକ୍ସଟ୍ କପିରେ କାର୍ଡ ଭିତର ଲେଖା)'}
                </span>
              </span>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                {isEnglish
                  ? 'Line 1 becomes the Bold Card Title. Lines 2+ become the Card Subtitle (anything inside ~...~ is automatically converted into real strikethrough M̶R̶P̶).'
                  : 'ପ୍ରଥମ ଧାଡ଼ିଟି ଆପେ ଆପେ Bold ହେଡିଂ ହେବ ଏବଂ ୨ୟ/୩ୟ ଧାଡ଼ି ତଳେ ଲେଖାଯିବ (~MRP~ ଦେଲେ ଆପେ ଆପେ କଟା ଗାର M̶R̶P̶ ହୋଇଯିବ)।'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              '[Product Name with Weight]',
              'Rs [Offer Price]',
              '~MRP [MRP]~',
              '[Stock Qty]',
              '[Stock Status]',
              '[Store Name]',
              '[Address]',
              '[Discount %]% OFF'
            ].map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => setWhatsappLinkCaptionFormat((prev) => `${prev}${prev.endsWith('\n') || !prev ? '' : ' '}${token}`)}
                className="px-2 py-1 rounded-lg bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-mono font-bold cursor-pointer transition-colors"
              >
                + {token}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-emerald-200">
            <div className="flex-1 min-w-[220px] space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-[11px] font-black text-emerald-900 block">
                  {isEnglish
                    ? '🧪 Select Any Sheet Product or Paste Link to Preview Card:'
                    : '🧪 ସିଟ୍‌ର ଯେକୌଣସି ସାମଗ୍ରୀ ବାଛନ୍ତୁ ବା ଲିଙ୍କ୍ ପେଷ୍ଟ କରି କାର୍ଡ ପ୍ରିଭ୍ୟୁ ଦେଖନ୍ତୁ:'}
                </label>
                {catalog.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      const chosen = catalog.find((p) => getPrimaryCleanEan(p) === e.target.value);
                      if (chosen) {
                        setShortLinkTestInput(getDynamicShareUrl(chosen));
                      }
                    }}
                    className="text-[11px] font-bold bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-lg px-2 py-1 outline-none cursor-pointer"
                  >
                    <option value="">
                      {isEnglish ? `📂 Pick from ${catalog.length} Live Sheet Products...` : `📂 ${catalog.length} ଟି ସିଟ୍ ସାମଗ୍ରୀରୁ ବାଛନ୍ତୁ...`}
                    </option>
                    {catalog.map((p, idx) => {
                      const cEan = getPrimaryCleanEan(p);
                      return (
                        <option key={`${cEan}-${idx}`} value={cEan}>
                          {p.product_name} — ₹{p.selling_price} (MRP ₹{p.mrp} • Stock: {p.stock_qty ?? 0})
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
              <input
                type="text"
                value={shortLinkTestInput}
                onChange={(e) => setShortLinkTestInput(e.target.value)}
                placeholder={
                  catalog[0]
                    ? getDynamicShareUrl(catalog.find((p) => getPrimaryCleanEan(p) === '490000038') || catalog[0])
                    : 'https://www.munagrocery.in/?item=...'
                }
                className="w-full text-xs font-mono px-3 py-1.5 bg-emerald-50/50 border border-emerald-300 rounded-lg outline-none focus:border-emerald-600 text-slate-900 font-semibold"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleFixWhatsAppPreviewCache}
                disabled={isFixingPreviewCache}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                title="Saves caption format to Sheet Config tab, bumps version token, and forces WhatsApp to fetch new preview card"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFixingPreviewCache ? 'animate-spin' : ''}`} />
                <span>
                  {isFixingPreviewCache
                    ? (isEnglish ? 'Fixing WhatsApp Preview Cache...' : 'କ୍ୟାଶ୍ ରିସେଟ୍ ହେଉଛି...')
                    : (isEnglish ? '⚡ 1-Click Fix WhatsApp Preview Cache' : '⚡ ୧-କ୍ଲିକ୍ ୱାଟ୍ସଆପ୍ ପ୍ରିଭ୍ୟୁ କ୍ୟାଶ୍ ଫିକ୍ସ')}
                </span>
              </button>

              <button
                type="button"
                onClick={handleResetAllLinksFrontendAndBackend}
                disabled={isResettingAllLinks}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                title="1-Click Reset All Products Links across Frontend and Backend"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResettingAllLinks ? 'animate-spin' : ''}`} />
                <span>
                  {isResettingAllLinks
                    ? (isEnglish ? 'Resetting All Links...' : 'ରିସେଟ୍ ହେଉଛି...')
                    : (isEnglish ? '🔄 Reset All Product Links (FE+BE)' : '🔄 ସବୁ ପ୍ରୋଡକ୍ଟ ଲିଙ୍କ୍ ରିସେଟ୍')}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {isEnglish ? 'Editable Link-Paste Card Caption Template:' : 'କେବଳ ଲିଙ୍କ୍ ପେଷ୍ଟ କ୍ୟାପସନ୍ ଟେମ୍ପଲେଟ୍:'}
              </label>
              <textarea
                rows={4}
                value={whatsappLinkCaptionFormat}
                onChange={(e) => setWhatsappLinkCaptionFormat(e.target.value)}
                placeholder={DEFAULT_LINK_PASTE_CAPTION_FORMAT}
                className="w-full text-xs font-mono p-3 border border-emerald-300 rounded-xl outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-white leading-relaxed"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {isEnglish ? 'Live WhatsApp Chat Board Short-Link Preview:' : 'କେବଳ ଲିଙ୍କ୍ ପେଷ୍ଟ କଲେ WhatsApp ରେ ଏପରି ଫଟୋ ଓ ତଥ୍ୟ ଦେଖାଯିବ:'}
              </label>
              {(() => {
                const defaultSheetProd =
                  catalog.find((p) => getPrimaryCleanEan(p) === '490000038') ||
                  catalog[0];
                const matchedProd =
                  (shortLinkTestInput.trim() ? resolveProductFromShortLink(shortLinkTestInput, catalog) : null) ||
                  defaultSheetProd;

                if (!matchedProd) {
                  return (
                    <div className="rounded-xl bg-[#1f2c34] text-slate-300 p-4 text-xs border border-slate-700">
                      Loading live product data from Google Sheet...
                    </div>
                  );
                }

                // Always read live price from the Google Sheet product
                const activeSp = Number(matchedProd.selling_price || 0);
                const previewImg = getProductBestShareImage(matchedProd);
                const liveShareUrl = shortLinkTestInput.trim() || getDynamicShareUrl(matchedProd);
                const { ogTitle, ogDescription } = formatLinkPreviewCaption(
                  whatsappLinkCaptionFormat,
                  matchedProd,
                  activeSp,
                  shareStoreName,
                  storePickupAddress
                );
                return (
                  <div className="rounded-xl bg-[#1f2c34] text-white overflow-hidden border border-slate-700 shadow-xs">
                    <div className="w-full h-36 bg-white flex items-center justify-center p-2 relative">
                      <img
                        src={previewImg}
                        alt={matchedProd.product_name}
                        className="w-full h-full object-contain"
                      />
                      <span className="absolute top-2 right-2 text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded">
                        EAN: {getPrimaryCleanEan(matchedProd)}
                      </span>
                    </div>
                    <div className="bg-[#121b22] p-2.5 border-l-4 border-emerald-500 space-y-1">
                      <p className="text-xs font-black text-white leading-snug">{ogTitle}</p>
                      <p className="text-[11px] text-slate-300 leading-snug">{ogDescription}</p>
                      <p className="text-[10px] text-slate-400 font-mono">🔗 munagrocery.in</p>
                    </div>
                    <div className="px-3 py-1.5 bg-[#005c4b] text-[11px] text-[#53bdeb] font-mono break-all">
                      {liveShareUrl}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* FIELD 2: Optional Full Text Copy-Paste Format */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-black">
                OPTIONAL TEXT COPY
              </span>
              <span>
                {isEnglish
                  ? '2. Optional Full Text Copy-Paste Format (whatsapp_share_format)'
                  : '୨. ଇଚ୍ଛାଧୀନ ସମ୍ପୂର୍ଣ୍ଣ ଟେକ୍ସଟ୍ କପି-ପେଷ୍ଟ ଫର୍ମାଟ୍ (Optional)'}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <textarea
                rows={5}
                value={whatsappShareFormat}
                onChange={(e) => setWhatsappShareFormat(e.target.value)}
                placeholder={DEFAULT_WHATSAPP_SHARE_FORMAT}
                className="w-full text-xs font-mono p-3 border border-slate-300 rounded-xl outline-none focus:border-emerald-500 bg-white leading-relaxed"
              />
            </div>

            <div>
              <div className="p-3 rounded-xl bg-[#dcf8c6]/50 border border-emerald-300 font-mono text-xs text-slate-900 whitespace-pre-wrap break-all leading-relaxed min-h-[112px]">
                {(() => {
                  const sampleProd =
                    (shortLinkTestInput.trim() ? resolveProductFromShortLink(shortLinkTestInput, catalog) : null) ||
                    catalog.find((p) => getPrimaryCleanEan(p) === '490000038') ||
                    catalog[0];
                  if (!sampleProd) return 'Loading live product from Google Sheet...';
                  return formatProductWithTemplate(
                    whatsappShareFormat,
                    sampleProd,
                    getDynamicShareUrl(sampleProd),
                    sampleProd.selling_price,
                    shareStoreName,
                    storePickupAddress
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Store Operating Status & Hours */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Store className="w-4 h-4 text-emerald-600" />
          <span>1. Store Operating Status & Hours (ଦୋକାନ କାର୍ଯ୍ୟ ସ୍ଥିତି ଓ ସମୟ)</span>
        </h3>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <span className="text-xs font-black text-slate-800 block">
              Current Status: {storeOpen ? 'STORE OPEN (ଅର୍ଡର ଗ୍ରହଣ ଚାଲିଛି)' : 'STORE CLOSED (ଦୋକାନ ବନ୍ଦ ଅଛି)'}
            </span>
            <span className="text-[11px] text-slate-500">
              {isEnglish
                ? 'When closed, checkout is locked and customer is informed with closed notice.'
                : 'ଦୋକାନ ବନ୍ଦ ଥିଲେ ଗ୍ରାହକ ଅର୍ଡର ଦେଇପାରିବେ ନାହିଁ ଏବଂ ବନ୍ଦ ସୂଚନା ଦେଖାଯିବ।'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleStoreOpen}
            className={`px-4 py-2 rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer shrink-0 ${
              storeOpen
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-rose-600 text-white hover:bg-rose-700'
            }`}
          >
            {storeOpen ? '● OPEN FOR ORDERS' : '● STORE CLOSED'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Store Opening Time (ଖୋଲିବା ସମୟ)
            </label>
            <input
              type="text"
              value={storeOpenTime}
              onChange={(e) => setStoreOpenTime(e.target.value)}
              placeholder="e.g. 10:00"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Store Closing Time (ବନ୍ଦ ହେବା ସମୟ)
            </label>
            <input
              type="text"
              value={storeCloseTime}
              onChange={(e) => setStoreCloseTime(e.target.value)}
              placeholder="e.g. 21:00"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Store Closed Notice Message (ଦୋକାନ ବନ୍ଦ ଥିବା ସମୟର ସୂଚନା)
            </label>
            <input
              type="text"
              value={closedMessage}
              onChange={(e) => setClosedMessage(e.target.value)}
              placeholder="e.g. ALL ORDER DELIVERY ON AFTER 10 AM"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Checkout Page Closed Notice (ଚେକଆଉଟ୍ ବନ୍ଦ ସୂଚନା)
            </label>
            <input
              type="text"
              value={closedCheckoutMessage}
              onChange={(e) => setClosedCheckoutMessage(e.target.value)}
              placeholder="e.g. Store closed. Delivery starts tomorrow morning."
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Section 1b: Incoming Order Notification & Ring Settings */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <BellRing className="w-4 h-4 text-rose-600 animate-pulse" />
              <span>Incoming Order Notification & Ring Settings (ନୂତନ ଅର୍ଡର ସୂଚନା ଓ ରିଙ୍ଗ୍ ସେଟିଂସ୍)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEnglish
                ? 'Configure popups, sound alarms, and operating hour restrictions for incoming customer orders.'
                : 'ଗ୍ରାହକ ନୂଆ ଅର୍ଡର ଦେଲାବେଳେ ପପ୍-ଅପ୍ ନୋଟିଫିକେସନ୍, ରିଙ୍ଗ୍ ଟୋନ୍ ଓ ଦୋକାନ ଖୋଲା ସମୟ ନିୟନ୍ତ୍ରଣ।'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestRing}
            className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
            title="Test ring sound and phone vibration"
          >
            <Volume2 className="w-3.5 h-3.5 text-rose-600" />
            <span>{isEnglish ? '🔊 Test Ring Sound' : '🔊 ରିଙ୍ଗ୍ ପରୀକ୍ଷା (Test)'}</span>
          </button>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Card 1: Notification Toggle (On / Off) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  {orderNotificationEnabled ? (
                    <Bell className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <BellOff className="w-4 h-4 text-slate-400" />
                  )}
                  <span>1. Notification Toggle (ନୋଟିଫିକେସନ୍ On/Off)</span>
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    orderNotificationEnabled
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {orderNotificationEnabled ? 'ON ✅' : 'OFF ⛔'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {isEnglish
                  ? 'Enable or disable screen popup alert when a new customer order arrives.'
                  : 'ଗ୍ରାହକ ଅର୍ଡର ଦେଲେ ସ୍କ୍ରିନ୍ ଉପରେ Incoming Order ପପ୍-ଅପ୍ ଦେଖାଯିବ।'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleOrderNotification}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs ${
                orderNotificationEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
            >
              <span>{orderNotificationEnabled ? '● NOTIFICATION ON (ଚାଲୁ ଅଛି)' : '○ NOTIFICATION OFF (ବନ୍ଦ ଅଛି)'}</span>
            </button>
          </div>

          {/* Card 2: Notification Schedule (Always / Only Store Open Hours) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>2. Notification Hours (ନୋଟିଫିକେସନ୍ ସମୟ)</span>
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {orderNotificationHours === 'store_hours' ? 'Store Hours Only' : 'Always (24x7)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {isEnglish
                  ? 'Choose if notifications appear 24/7 or only when store is open.'
                  : 'ସବୁବେଳେ ନୋଟିଫିକେସନ୍ ଆସିବ ନା କେବଳ ଦୋକାନ ଖୋଲା ଥିବାବେଳେ ଆସିବ।'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleChangeNotificationHours('always')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  orderNotificationHours === 'always'
                    ? 'bg-[#1864ab] text-white border-[#1864ab] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{isEnglish ? 'Always (24x7)' : 'ସବୁବେଳେ (24x7)'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleChangeNotificationHours('store_hours')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  orderNotificationHours === 'store_hours'
                    ? 'bg-[#1864ab] text-white border-[#1864ab] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{isEnglish ? 'Only Store Open' : 'କେବଳ ଦୋକାନ ଖୋଲା'}</span>
              </button>
            </div>
          </div>

          {/* Card 3: Ring Audio Toggle (On / Off) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  {orderRingEnabled ? (
                    <Volume2 className="w-4 h-4 text-amber-600" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  )}
                  <span>3. Ring Audio Toggle (ରିଙ୍ଗ୍ On/Off)</span>
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    orderRingEnabled
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {orderRingEnabled ? 'RING ON 🔊' : 'RING OFF 🔇'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {isEnglish
                  ? 'Play chime ringtone audio and vibrate phone for new customer orders.'
                  : 'ନୂଆ ଅର୍ଡର ଆସିଲେ ଫୋନ୍‌ରେ ଲାଉଡ୍ ରିଙ୍ଗ୍ ବାଜିବ ଓ ଭାଇବ୍ରେସନ୍ ହେବ।'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleOrderRing}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs ${
                orderRingEnabled
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
            >
              <span>{orderRingEnabled ? '● RING ON (ରିଙ୍ଗ୍ ବାଜିବ 🔊)' : '○ RING OFF (ମ୍ୟୁଟ୍ ରହିବ 🔇)'}</span>
            </button>
          </div>

          {/* Card 4: Ring Timing Schedule (Allows Ring Always / Only Store Open Hours) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span>4. Ring Hours (ରିଙ୍ଗ୍ ସମୟ ନିୟନ୍ତ୍ରଣ)</span>
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-900">
                  {orderRingHours === 'store_hours' ? 'Store Hours Only' : 'Allows Ring (Always)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {isEnglish
                  ? 'Allow ring anytime or only during store operating hours.'
                  : 'ରାତିରେ ଦୋକାନ ବନ୍ଦ ଥିବାବେଳେ ରିଙ୍ଗ୍ ନବାଜି ନିରବ (Silent) ରହିବ।'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleChangeRingHours('always')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  orderRingHours === 'always'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{isEnglish ? 'Allows Ring Always' : 'ସବୁବେଳେ ରିଙ୍ଗ୍'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleChangeRingHours('store_hours')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  orderRingHours === 'store_hours'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{isEnglish ? 'Only Store Open' : 'କେବଳ ଦୋକାନ ଖୋଲା'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Status Diagnostic Strip */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">Current Status:</span>
            <span
              className={`px-2 py-0.5 rounded-full font-black text-[10px] uppercase ${
                isStoreOpenNow(shopConfig)
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {isStoreOpenNow(shopConfig) ? 'Store is OPEN' : 'Store is CLOSED'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-bold text-slate-700">
            <span>
              Notification:{' '}
              <strong className={orderNotificationEnabled && (orderNotificationHours === 'always' || isStoreOpenNow(shopConfig)) ? 'text-emerald-700' : 'text-slate-500'}>
                {orderNotificationEnabled && (orderNotificationHours === 'always' || isStoreOpenNow(shopConfig)) ? 'Active ✅' : 'Suppressed ⛔'}
              </strong>
            </span>
            <span>•</span>
            <span>
              Ring Audio:{' '}
              <strong className={orderRingEnabled && (orderRingHours === 'always' || isStoreOpenNow(shopConfig)) ? 'text-amber-700' : 'text-slate-500'}>
                {orderRingEnabled && (orderRingHours === 'always' || isStoreOpenNow(shopConfig)) ? 'Audible 🔊' : 'Silent 🔇'}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Section 2: Delivery Fees & Slots */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Truck className="w-4 h-4 text-blue-600" />
          <span>2. Delivery Fees & Slots (ଡେଲିଭରୀ ଫି ଏବଂ ସମୟ ସ୍ଲଟ୍)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Delivery Fee (Rs.)</label>
            <input
              type="number"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold"
            />
            <p className="text-[10px] text-slate-400 mt-1">Charged on orders below free threshold.</p>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Free Delivery Above (Rs.)</label>
            <input
              type="number"
              value={freeAbove}
              onChange={(e) => setFreeAbove(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold"
            />
            <p className="text-[10px] text-slate-400 mt-1">Free Delivery applied above this.</p>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Default Delivery Slot</label>
            <input
              type="text"
              value={deliverySlot}
              onChange={(e) => setDeliverySlot(e.target.value)}
              placeholder="e.g. 1 hour"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold"
            />
            <p className="text-[10px] text-slate-400 mt-1">Timeframe shown to customer.</p>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Delivery Day</label>
            <input
              type="text"
              value={deliveryDay}
              onChange={(e) => setDeliveryDay(e.target.value)}
              placeholder="Today"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold"
            />
            <p className="text-[10px] text-slate-400 mt-1">e.g. Today / Same Day.</p>
          </div>
        </div>
      </div>

      {/* Section 3: Payment & Fulfilment Modes (COD, UPI QR & Pickup) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-600" />
          <span>3. Payment Modes: Cash on Delivery (COD), UPI QR & Store Pickup (ପେମେଣ୍ଟ ଓ ପିକଅପ୍ ସେଟିଂସ୍)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* COD Toggle & Notice */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-800 block">Cash on Delivery (COD)</span>
                <span className="text-[11px] text-slate-500">Allow customers to pay cash at delivery</span>
              </div>
              <button
                type="button"
                onClick={handleToggleCod}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                  codActive ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                }`}
              >
                {codActive ? 'ENABLED (ସକ୍ରିୟ)' : 'DISABLED (ନିଷ୍କ୍ରିୟ)'}
              </button>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">COD Display Notice / Subtitle</label>
              <input
                type="text"
                value={codNotice}
                onChange={(e) => {
                  setCodNotice(e.target.value);
                  updateShopConfig({ codNotice: e.target.value });
                  setHasUnsavedAdminChanges(true);
                }}
                placeholder="e.g. Cash on Delivery Available"
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Minimum Order for COD (Rs. - Default: 200)
              </label>
              <input
                type="number"
                value={codMinBill}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setCodMinBill(val);
                  updateShopConfig({ codMinBill: val });
                  setHasUnsavedAdminChanges(true);
                }}
                placeholder="200"
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none font-bold"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Orders below this cannot choose COD.</p>
            </div>
          </div>

          {/* Store Pickup Toggle & Notice */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-800 block">Self Store Pickup (ଦୋକାନରୁ ସଂଗ୍ରହ)</span>
                <span className="text-[11px] text-slate-500">Allow customers to collect directly at counter</span>
              </div>
              <button
                type="button"
                onClick={handleTogglePickup}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                  pickupActive ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                }`}
              >
                {pickupActive ? 'ENABLED (ସକ୍ରିୟ)' : 'DISABLED (ନିଷ୍କ୍ରିୟ)'}
              </button>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Pickup Note / Subtitle</label>
              <input
                type="text"
                value={pickupNote}
                onChange={(e) => {
                  setPickupNote(e.target.value);
                  updateShopConfig({ pickupNote: e.target.value });
                  setHasUnsavedAdminChanges(true);
                }}
                placeholder="e.g. Free Store Pickup - Zero Delivery Fee"
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none"
              />
            </div>
          </div>
        </div>

        {/* UPI QR Payment Auto-Generator & UTR Verification Setup Card */}
        <div className="p-4 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/50 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs sm:text-sm font-black text-indigo-950 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-black">
                  AUTO UPI QR + UTR
                </span>
                <span>UPI QR Payment & UTR Verification (ଅଟୋ UPI QR ପେମେଣ୍ଟ)</span>
              </span>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {isEnglish
                  ? 'Automatically generates a dynamic UPI Payment QR code for the exact cart total. Customer enters UTR ID & order stays ON HOLD until Seller confirms.'
                  : 'ଗ୍ରାହକଙ୍କ ବିଲ୍ ଟଙ୍କା ଅନୁଯାୟୀ ଆପେ ଆପେ UPI QR ତିଆରି ହେବ। ଗ୍ରାହକ UTR ନମ୍ବର ଦେଇ Confirm Paid କଲେ ଅର୍ଡର ON HOLD ରହିବ ଏବଂ ଆପଣ Confirm/Cancel କରିପାରିବେ।'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleUpi}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer shrink-0 shadow-xs ${
                upiActive ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-300 text-slate-700'
              }`}
            >
              {upiActive ? '● UPI QR ENABLED (ସକ୍ରିୟ)' : '○ UPI QR DISABLED (ନିଷ୍କ୍ରିୟ)'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-start">
            <div className="md:col-span-2 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Merchant UPI ID (VPA) * (ଆପଣଙ୍କ UPI ID)
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => {
                      setUpiId(e.target.value);
                      updateShopConfig({ upiId: e.target.value.trim() });
                      setHasUnsavedAdminChanges(true);
                    }}
                    placeholder="e.g. 9040585726@ybl or store@okaxis"
                    className="w-full text-xs px-3 py-2 bg-white border border-indigo-200 rounded-xl outline-none focus:border-indigo-600 font-mono font-bold text-slate-900"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    PhonePe / Google Pay / Paytm / BHIM UPI ID where money will be received.
                  </p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    UPI Payee / Store Name (ଦୋକାନ ନାମ)
                  </label>
                  <input
                    type="text"
                    value={upiPayeeName}
                    onChange={(e) => {
                      setUpiPayeeName(e.target.value);
                      updateShopConfig({ upiPayeeName: e.target.value });
                      setHasUnsavedAdminChanges(true);
                    }}
                    placeholder="Munna Mobile & Grocery"
                    className="w-full text-xs px-3 py-2 bg-white border border-indigo-200 rounded-xl outline-none focus:border-indigo-600 font-bold text-slate-900"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Shown inside customer's UPI app when scanning QR.
                  </p>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Optional Custom QR Image URL (ଇଚ୍ଛାଧୀନ କଷ୍ଟମ୍ QR ଫଟୋ - ଖାଲି ରଖିଲେ ଅଟୋ QR ତିଆରି ହେବ)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={upiCustomQrUrl}
                    onChange={(e) => {
                      setUpiCustomQrUrl(e.target.value);
                      updateShopConfig({ upiCustomQrUrl: e.target.value.trim() });
                      setHasUnsavedAdminChanges(true);
                    }}
                    placeholder="Leave blank for Auto Dynamic Amount QR (Recommended)"
                    className="flex-1 text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-600"
                  />
                  <label className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingUpiQr ? 'Uploading...' : 'Upload QR'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        if (!e.target.files || e.target.files.length === 0) return;
                        setIsUploadingUpiQr(true);
                        const url = await uploadImageToImgbb(e.target.files[0]);
                        setIsUploadingUpiQr(false);
                        if (url) {
                          setUpiCustomQrUrl(url);
                          updateShopConfig({ upiCustomQrUrl: url });
                          setHasUnsavedAdminChanges(true);
                          showToast('✅ Custom UPI QR uploaded! Click Save All Settings.');
                        }
                      }}
                    />
                  </label>
                  {upiCustomQrUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setUpiCustomQrUrl('');
                        updateShopConfig({ upiCustomQrUrl: '' });
                        setHasUnsavedAdminChanges(true);
                      }}
                      className="px-2.5 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold cursor-pointer"
                      title="Use Auto Dynamic QR"
                    >
                      Auto QR
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Live QR Preview Box */}
            <div className="bg-white p-3 rounded-2xl border border-indigo-200 flex flex-col items-center justify-center text-center shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full mb-2">
                Live UPI QR Preview (₹100 Sample)
              </span>
              <img
                src={
                  upiCustomQrUrl.trim()
                    ? upiCustomQrUrl.trim()
                    : `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=6&data=${encodeURIComponent(
                        `upi://pay?pa=${(upiId || '9040585726@ybl').trim()}&pn=${encodeURIComponent(
                          (upiPayeeName || 'Munna Mobile & Grocery').trim()
                        )}&am=100&cu=INR`
                      )}`
                }
                alt="UPI QR Preview"
                className="w-28 h-28 object-contain rounded-xl border border-slate-100 p-1 bg-white"
              />
              <span className="text-[11px] font-mono font-bold text-slate-800 mt-1.5 break-all">
                {upiId || '9040585726@ybl'}
              </span>
              <span className="text-[10px] text-emerald-700 font-bold mt-0.5">
                {upiCustomQrUrl.trim() ? 'Static Custom QR' : '⚡ Auto Bill Amount QR'}
              </span>
            </div>
          </div>
        </div>

        {/* Pickup Slots & Pickup Charge */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="sm:col-span-2">
            <label className="font-bold text-slate-700 block mb-1">
              Available Pickup Slots (ଦୋକାନରୁ ଉଠାଇବା ପାଇଁ ଉପଲବ୍ଧ ସମୟ ସ୍ଲଟ୍ - Comma Separated)
            </label>
            <input
              type="text"
              value={pickupSlotsInput}
              onChange={(e) => setPickupSlotsInput(e.target.value)}
              placeholder="30 min, 1 hour, 2 hour"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">Read by Cart page for customers to select their pickup timeframe.</p>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Pickup Handling Fee (Rs.)
            </label>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={handleTogglePickupCharge}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold shrink-0 ${
                  pickupChargeOn ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {pickupChargeOn ? 'Charge ON' : 'Free'}
              </button>
              <input
                type="number"
                disabled={!pickupChargeOn}
                value={pickupChargeFee}
                onChange={(e) => setPickupChargeFee(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none font-bold disabled:bg-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Store Pickup Auto-Cancel Disclaimer Message (Editable in Admin Panel) */}
        <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <label className="font-extrabold text-amber-950 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Store Pickup Auto-Cancel Policy Message (ଅର୍ଡର ସ୍ୱୟଂଚାଳିତ ବାତିଲ୍ ସୂଚନା ବାର୍ତ୍ତା)</span>
            </label>
            <span className="text-[10px] font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full border border-amber-300">
              Cart Page Banner
            </span>
          </div>
          <p className="text-[11px] text-amber-800 leading-snug">
            {isEnglish
              ? 'This message is shown to customers on the Cart page when Store Pickup is selected. It notifies them that if the order is not picked up within the selected timeframe, it will be automatically cancelled by the seller.'
              : 'ଗ୍ରାହକ Store Pickup ବାଛିବା ପରେ କାର୍ଟ ପେଜ୍‌ରେ ଏହି ସୂଚନା ପ୍ରଦର୍ଶିତ ହେବ। ମନୋନୀତ ସମୟ ଭିତରେ ସଉଦା ନନେଲେ ଅର୍ଡର ସ୍ୱୟଂଚାଳିତ ଭାବେ ବାତିଲ୍ ହେବା ବିଷୟରେ ଗ୍ରାହକଙ୍କୁ ସଚେତନ କରିବ।'}
          </p>
          <textarea
            rows={2}
            value={pickupCancelNotice}
            onChange={(e) => setPickupCancelNotice(e.target.value)}
            placeholder="If the items are not picked up within the selected pickup time, the order will be automatically cancelled by the seller."
            className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl outline-none focus:border-amber-600 font-medium text-xs leading-relaxed"
          />
          <div className="p-2.5 bg-white/90 rounded-lg border border-amber-200 text-[11px] text-amber-950 flex items-start gap-2 shadow-2xs">
            <span className="font-black text-amber-700 shrink-0">Live Cart Preview:</span>
            <span className="italic leading-snug text-slate-800">"{pickupCancelNotice}"</span>
          </div>
        </div>

        {/* Store Pickup Location Details (Customizable) */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <span className="text-xs font-black text-slate-800 block">
            Store Pickup Location Details (ଦୋକାନ ଠିକଣା ଓ ଯୋଗାଯୋଗ ନମ୍ବର)
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Store Name (ଦୋକାନ ନାମ - Default: Munna Grocery & Mobile)
              </label>
              <input
                type="text"
                value={storePickupName}
                onChange={(e) => setStorePickupName(e.target.value)}
                placeholder="Munna Grocery & Mobile"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Store Phone (ଫୋନ୍ ନମ୍ବର - Default: 9040585726)
              </label>
              <input
                type="tel"
                value={storePickupPhone}
                onChange={(e) => setStorePickupPhone(e.target.value)}
                placeholder="9040585726"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">
                Store Pickup Address (ଦୋକାନ ଠିକଣା)
              </label>
              <input
                type="text"
                value={storePickupAddress}
                onChange={(e) => setStorePickupAddress(e.target.value)}
                placeholder="Cinema Hall Road, Niali, Cuttack, PIN - 754004"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Promotional Coupons */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Ticket className="w-4 h-4 text-purple-600" />
          <span>4. Store Discount Coupon (କୁପନ୍ କୋଡ୍ ଓ ରିହାତି)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Coupon Code (କୁପନ୍ କୋଡ୍)</label>
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="MUNNA10"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-purple-500 uppercase font-black"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Discount Percent (%) (ରିହାତି %)</label>
            <input
              type="number"
              value={couponPercent}
              onChange={(e) => setCouponPercent(parseFloat(e.target.value) || 0)}
              placeholder="10"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-purple-500 font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Minimum Bill (Rs.) (ସର୍ବନିମ୍ନ ବିଲ୍)</label>
            <input
              type="number"
              value={couponMinBill}
              onChange={(e) => setCouponMinBill(parseFloat(e.target.value) || 0)}
              placeholder="300"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-purple-500 font-bold"
            />
          </div>
        </div>
      </div>

      {/* Section 5: Trending Offers List */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-500" />
          <span>5. Trending Offers (ଟ୍ରେଣ୍ଡିଂ ଅଫର ଉତ୍ପାଦ EAN ବାରକୋଡ୍)</span>
        </h3>

        <p className="text-xs text-slate-500">
          Enter comma-separated product EAN barcodes to spotlight in the &ldquo;Trending Offers&rdquo; row on the home screen.
        </p>

        <textarea
          rows={2}
          value={trendingInput}
          onChange={(e) => setTrendingInput(e.target.value)}
          placeholder="7533476, 7533478, 890123456789"
          className="w-full text-xs font-mono p-3 border border-slate-200 rounded-xl outline-none focus:border-amber-500"
        />

        {trendingInput.trim() && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {trendingInput
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((ean, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200"
                >
                  <Flame className="w-3 h-3 text-amber-500" />
                  {ean}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Section 6: Banners Management */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Image className="w-4 h-4 text-emerald-600" />
          <span>6. Promotional Home Banners (ମୁଖ୍ୟ ବ୍ୟାନର ସମୂହ)</span>
        </h3>

        {/* Existing Banners List */}
        <div className="space-y-2">
          {bannerList.map((banner, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3"
            >
              <img
                src={banner.img}
                alt={banner.title}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                className="w-16 h-10 object-cover rounded-lg bg-white border border-slate-200 shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400';
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{banner.title}</p>
                <p className="text-[10px] text-slate-400 truncate">{banner.img}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteBanner(idx)}
                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                title="Remove Banner"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Banner Form */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
          <span className="text-xs font-bold text-slate-800 block">+ Add New Banner (ନୂଆ ବ୍ୟାନର ଯୋଡ଼ନ୍ତୁ)</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <input
              type="text"
              value={newBannerTitle}
              onChange={(e) => setNewBannerTitle(e.target.value)}
              placeholder="Banner Title (e.g. Mega Grocery Sale - Up to 40% Off)"
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none"
            />
            <div className="flex gap-2">
              <input
                type="url"
                value={newBannerImg}
                onChange={(e) => setNewBannerImg(e.target.value)}
                placeholder="Image URL https://..."
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none"
              />
              <label className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  className="hidden"
                />
                <span>{isUploadingBanner ? '...' : 'Upload'}</span>
              </label>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddBanner}
            disabled={!newBannerImg.trim()}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40"
          >
            + Add to Carousel (କ୍ୟାରୋସେଲରେ ଯୋଡ଼ନ୍ତୁ)
          </button>
        </div>
      </div>

      {/* Section 7: Broadcast Customer Announcement Notice */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-amber-500" />
            <span>7. Broadcast Customer Notice (ମୁଖ୍ୟ ପୃଷ୍ଠାର ସୂଚନା ବ୍ୟାନର)</span>
          </h3>
          <button
            type="button"
            onClick={() => setNoticeActive(!noticeActive)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-colors ${
              noticeActive ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {noticeActive ? 'PUBLISHED (ପ୍ରକାଶିତ)' : 'HIDDEN (ଅଦୃଶ୍ୟ)'}
          </button>
        </div>

        <p className="text-xs text-slate-500">
          This notice appears prominently below the carousel on the home page for all visiting customers.
        </p>

        <div className="space-y-2 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Notice Headline</label>
            <input
              type="text"
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.target.value)}
              placeholder="📢 ନୂତନ ଅଫର୍ / ଅପଡେଟ୍"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Notice Description</label>
            <textarea
              rows={2}
              value={noticeText}
              onChange={(e) => setNoticeText(e.target.value)}
              placeholder="Notice description details..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Optional Banner Image</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={noticeImg}
                  onChange={(e) => setNoticeImg(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl outline-none text-xs"
                />
                <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleNoticeImgUpload}
                    className="hidden"
                  />
                  <span>{isUploadingNoticeImg ? '...' : 'Upload'}</span>
                </label>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Optional Click URL Link</label>
              <input
                type="url"
                value={noticeUrl}
                onChange={(e) => setNoticeUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 8: Admin Login Credentials */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Lock className="w-4 h-4 text-rose-600" />
          <span>8. Admin Login Credentials (ଆଡମିନ୍ ପ୍ୟାନେଲ୍ ପାସୱାର୍ଡ)</span>
        </h3>

        <p className="text-xs text-slate-500">
          Saved in Google Sheet Config (<code>admin_username</code> &amp; <code>admin_password</code>) to authenticate admin sessions.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Admin Username / Phone (10 digits)</label>
            <input
              type="text"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              placeholder="10-digit username"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none font-mono font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Admin Password</label>
            <input
              type="text"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none font-mono font-bold"
            />
          </div>
        </div>
      </div>

      {/* Section 9: Mobile App Download URL */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Download className="w-4 h-4 text-emerald-600" />
          <span>9. Mobile APK Download URL (ଆପ୍ ଡାଉନଲୋଡ୍ ଲିଙ୍କ୍)</span>
        </h3>

        <p className="text-xs text-slate-500">
          Direct link to Android APK download displayed in header and mobile install prompt.
        </p>

        <input
          type="text"
          value={appDownloadUrl}
          onChange={(e) => setAppDownloadUrl(e.target.value)}
          placeholder="/munagrocery.apk"
          className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
        />
      </div>

      {/* Section 10: Google Sheet ID & Database Connection */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            <span>10. Google Sheet ID & Apps Script Backend (ଗୁଗୁଲ୍ ସିଟ୍ ଆଇଡି ଓ ଡାଟାବେସ୍)</span>
          </h3>

          <a
            href={getSpreadsheetUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer w-fit"
          >
            <span>Open Connected Sheet (ସିଟ୍ ଖୋଲନ୍ତୁ)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Part A: Google Sheet ID Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">
              Your Google Sheet ID (ଆପଣଙ୍କ Google Sheet ID)
            </label>
            <span className="text-[11px] text-slate-400 font-mono">
              Spreadsheet: MUNNA MOBILE & Grocery Database
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={sheetId}
              onChange={(e) => setSheetIdState(e.target.value)}
              placeholder="e.g. 1wj0Lg32nIDjCDadnBovK2u0agpJ4gIJr1ahxya1GMGE"
              className="flex-1 text-xs font-mono px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold bg-slate-50"
            />
            <button
              type="button"
              onClick={handleSetupDatabase}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Auto-Setup 5 Tables</span>
            </button>
          </div>

          {dbSetupStatus && (
            <p className="text-xs font-bold text-emerald-700 bg-emerald-50 p-2 rounded-lg">
              {dbSetupStatus}
            </p>
          )}

          <p className="text-[11px] text-slate-500">
            {isEnglish
              ? 'Your Google Apps Script uses SpreadsheetApp.openById(SHEET_ID) to read and write Users, Orders, Config, Products, and Addresses sheets.'
              : 'ଏହି Sheet ID ବ୍ୟବହାର କରି Google Apps Script ସିଧାସଳଖ ଆପଣଙ୍କ Google Sheet ସହିତ ସଂଯୁକ୍ତ ହୋଇ ଡାଟା ଲୋଡ୍ ଓ ସେଭ୍ କରେ।'}
          </p>
        </div>

        {/* Part B: Apps Script Code Quick Access */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-blue-600" />
              <span>Google Apps Script Backend Code (Code.gs)</span>
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Configured with Sheet ID: <code className="font-mono text-slate-700 font-bold">{sheetId.slice(0, 10)}...</code>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyScript}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
            >
              {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedScript ? 'Copied! ✅' : 'Copy Code'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowScriptModal(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View Code</span>
            </button>
          </div>
        </div>

        {/* Part C: Webhook URL Endpoint */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-bold text-slate-700 block">
            Google Apps Script Webhook URL (ଡିପ୍ଲୟମେଣ୍ଟ ୱେବ୍-ଆପ୍ ୟୁଆରଏଲ୍ - /exec)
          </label>
          <textarea
            rows={2}
            value={webhookUrl}
            onChange={(e) => setWebhookUrlState(e.target.value)}
            className="w-full text-xs font-mono p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white"
          />

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleTestWebhook}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
            >
              Test Connection (ସଂଯୋଗ ଯାଞ୍ଚ କରନ୍ତୁ)
            </button>
            {testResult && (
              <span className="text-xs font-bold text-slate-700">
                {testResult}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Google Apps Script Code Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Google Apps Script (Code.gs)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Connected using Sheet ID: <code className="font-mono text-emerald-700 font-bold">{sheetId}</code>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 text-sm font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Instructions */}
            <div className="p-4 bg-amber-50/60 border-b border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>କିପରି Google Apps Script ରେ ସଂଯୋଗ କରିବେ (How to Deploy):</span>
              </p>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-amber-800 pl-1">
                <li><a href="https://script.google.com" target="_blank" rel="noreferrer" className="underline font-bold">script.google.com</a> ଖୋଲନ୍ତୁ ଏବଂ New Project ଉପରେ କ୍ଲିକ୍ କରନ୍ତୁ।</li>
                <li>ତଳେ ଥିବା କୋଡ୍ କୁ Copy କରି <code className="font-mono bg-white px-1 py-0.5 rounded">Code.gs</code> ରେ Paste କରନ୍ତୁ।</li>
                <li>ଉପରେ ଥିବା <strong>Deploy &gt; New deployment &gt; Web app</strong> ଚୟନ କରନ୍ତୁ।</li>
                <li>Execute as: <strong>&ldquo;Me&rdquo;</strong> ଏବଂ Who has access: <strong>&ldquo;Anyone&rdquo;</strong> ରଖନ୍ତୁ।</li>
                <li>Deploy କ୍ଲିକ୍ କରି Web App URL କୁ Copy କରନ୍ତୁ ଏବଂ ଏଠାରେ Webhook URL ରେ ପେଷ୍ଟ କରନ୍ତୁ।</li>
              </ol>
            </div>

            {/* Code Box */}
            <div className="p-4 flex-1 overflow-y-auto bg-slate-900 text-slate-100 font-mono text-xs">
              <pre className="whitespace-pre-wrap leading-relaxed select-all">
                {fullAppsScriptCode}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                File located in repo: <code className="font-mono text-slate-800 font-bold">google-apps-script/Code.gs</code>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                >
                  {copiedScript ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedScript ? 'Code Copied! ✅' : 'Copy Full Script'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowScriptModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
