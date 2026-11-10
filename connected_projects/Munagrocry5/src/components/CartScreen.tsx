import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { Product, UserSession, parseProductStock, normalizeTrending } from '../types';
import {
  STORE_LAT,
  STORE_LNG,
  MAX_RADIUS_KM
} from '../data/initialData';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  Truck,
  Store,
  MapPin,
  Crosshair,
  ArrowRight,
  CheckCircle,
  Clock,
  Ticket,
  Navigation,
  Compass,
  Loader2,
  Check,
  ShoppingBag,
  AlertCircle,
  Phone,
  User,
  FileText,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Info,
  Edit3,
  RefreshCw,
  Search,
  Zap,
  Percent,
  X,
  QrCode,
  Copy,
  Banknote,
  Smartphone
} from 'lucide-react';
import confetti from 'canvas-confetti';
import L from 'leaflet';
import { isStoreOpenNow, isStorePickupActive, isCodDeliveryActive, isUpiPaymentActive, fetchLiveStoreData } from '../services/api';
import { handleProductImageError, resolveProductImage } from '../utils/imageHelper';
import { calculatePickupSchedule, PickupScheduleInfo } from '../utils/pickupTimeUtils';
import { showToast } from './Toast';
import { useRegisterBackHandler } from '../utils/backButton';

// Fix Leaflet default marker icons in bundlers
try {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
} catch (e) {}

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

export const CartScreen: React.FC = () => {
  const {
    cart,
    catalog,
    setCatalog,
    syncLiveStockWithServer,
    isSyncingStock,
    isLoadingAddresses,
    isSavingAddress,
    isSyncingCart,
    refreshAddresses,
    refreshCartFromSheet,
    setQty,
    clearCart,
    appliedCoupon,
    setAppliedCoupon,
    shopConfig,
    addresses,
    saveAddress,
    sessionUser,
    setActiveScreen,
    goBackScreen,
    setSelectedProduct,
    searchQuery,
    cartBilling,
    placeOrder,
    setShowLoginModal,
    setAuthNoticeMessage,
    pendingCheckout,
    setPendingCheckout,
    setShowPaymentPolicyModal
  } = useApp();
  const { t, isEnglish } = useLanguage();

  useEffect(() => {
    void syncLiveStockWithServer(true);
    void refreshAddresses();
    void refreshCartFromSheet();
  }, [syncLiveStockWithServer, refreshAddresses, refreshCartFromSheet]);

  // Multi-step Checkout: 'checkout' -> 'confirm' -> 'success'
  const [step, setStep] = useState<'checkout' | 'confirm' | 'success'>('checkout');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showAllSuggested, setShowAllSuggested] = useState<boolean>(false);
  const [showCouponBox, setShowCouponBox] = useState<boolean>(false);
  const [showAddressDrawer, setShowAddressDrawer] = useState<boolean>(false);

  // Payment Selection Modal, COD Confirm Popup & Auto UPI QR + UTR state
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentModalView, setPaymentModalView] = useState<'select' | 'cod_confirm' | 'upi_qr'>('select');
  const [utrInput, setUtrInput] = useState<string>('');
  const [utrError, setUtrError] = useState<string>('');
  const [placedPaymentMode, setPlacedPaymentMode] = useState<'COD' | 'UPI' | 'STORE_PICKUP'>('COD');
  const [placedUtrId, setPlacedUtrId] = useState<string>('');
  const [placedOrderTotal, setPlacedOrderTotal] = useState<number>(0);

  // Fulfillment Type: Default Store Pickup vs Home Delivery based on active admin toggles
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>(() => {
    const pickupOn = isStorePickupActive(shopConfig);
    const codOn = isCodDeliveryActive(shopConfig);
    const upiOn = isUpiPaymentActive(shopConfig);
    if (pickupOn && !codOn && !upiOn) return 'pickup';
    if (!pickupOn && (codOn || upiOn)) return 'delivery';
    if (codOn || upiOn) return 'delivery';
    return 'pickup';
  });

  // Keep deliveryType in sync if admin toggles change dynamically
  useEffect(() => {
    const pickupOn = isStorePickupActive(shopConfig);
    const codOn = isCodDeliveryActive(shopConfig);
    const upiOn = isUpiPaymentActive(shopConfig);
    if (pickupOn && !codOn && !upiOn && deliveryType !== 'pickup') {
      setDeliveryType('pickup');
      setSelectedPayment('STORE_PICKUP');
    } else if (!pickupOn && (codOn || upiOn) && deliveryType !== 'delivery') {
      setDeliveryType('delivery');
      setSelectedPayment(codOn ? 'COD' : 'UPI');
    }
  }, [shopConfig.pickupActive, shopConfig.codActive, shopConfig.upiActive, deliveryType]);

  // Helper to read account user from sessionUser or localStorage
  const getAccountUser = (): UserSession | null => {
    if (sessionUser) return sessionUser;
    try {
      const s = localStorage.getItem('session_user') || localStorage.getItem('active_store_user');
      if (s) return JSON.parse(s);
    } catch (e) {}
    return null;
  };
  const accountUser = getAccountUser();
  const isUserLoggedIn = Boolean(accountUser?.phone);

  // Filter real saved customer addresses (or fall back to user profile address if available)
  const validSavedAddresses = useMemo(() => {
    const list = addresses.filter(
      (a) => a.id !== 'addr-default-1' && a.address && a.address.trim().length >= 5
    );
    if (list.length === 0 && accountUser?.address && accountUser.address.trim().length >= 5) {
      return [
        {
          id: 'addr-account-profile',
          name: accountUser.name && accountUser.name !== 'Munna Customer' ? accountUser.name : 'Customer',
          phone: accountUser.phone || '',
          address: accountUser.address,
          isDefault: true,
          lat: STORE_LAT,
          lng: STORE_LNG
        }
      ];
    }
    return list;
  }, [addresses, accountUser]);

  const defaultAddr = validSavedAddresses.find((a) => a.isDefault) || validSavedAddresses[0];
  const [selectedSavedAddrId, setSelectedSavedAddrId] = useState<string | null>(defaultAddr?.id || null);

  // Address setup view state inside drawer
  const [showAddressSetup, setShowAddressSetup] = useState<boolean>(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Step-by-step Hardware Back handler inside Cart & Payment flow
  useRegisterBackHandler(() => {
    if (showPaymentModal) {
      if (paymentModalView === 'upi_qr' || paymentModalView === 'cod_confirm') {
        setPaymentModalView('select');
        setUtrError('');
        return true;
      }
      setShowPaymentModal(false);
      return true;
    }
    if (showAddressDrawer) {
      if (showAddressSetup) {
        setShowAddressSetup(false);
        setEditingAddressId(null);
        return true;
      }
      setShowAddressDrawer(false);
      return true;
    }
    if (showCouponBox) {
      setShowCouponBox(false);
      return true;
    }
    if (step === 'confirm') {
      setStep('checkout');
      return true;
    }
    return false;
  });

  // Customer Contact & Delivery fields
  const [custName, setCustName] = useState<string>(() => {
    if (accountUser?.name && accountUser.name !== 'Munna Customer') return accountUser.name;
    return defaultAddr?.name || '';
  });
  const [custPhone, setCustPhone] = useState<string>(() => {
    if (accountUser?.phone) return accountUser.phone;
    return defaultAddr?.phone || '';
  });
  const [custAddress, setCustAddress] = useState<string>(() => {
    if (accountUser?.address) return accountUser.address;
    return defaultAddr?.address || '';
  });
  const [orderNote, setOrderNote] = useState<string>('');
  const [saveAddressForFuture, setSaveAddressForFuture] = useState<boolean>(true);

  const [selectedPayment, setSelectedPayment] = useState<'COD' | 'UPI' | 'STORE_PICKUP'>(() => {
    const pickupOn = isStorePickupActive(shopConfig);
    const codOn = isCodDeliveryActive(shopConfig);
    if (pickupOn && !codOn) return 'STORE_PICKUP';
    if (!pickupOn && codOn) return 'COD';
    if (codOn) return 'COD';
    return 'STORE_PICKUP';
  });

  // Available Pickup Slots from Google Sheet / shopConfig
  const availablePickupSlots = useMemo(() => {
    const raw = shopConfig.pickupSlots;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    if (typeof raw === 'string' && (raw as string).trim()) {
      return (raw as string).split(',').map((s) => s.trim()).filter(Boolean);
    }
    return ['30 min', '1 hour', '2 hour', '3 hour'];
  }, [shopConfig.pickupSlots]);

  const [selectedPickupSlot, setSelectedPickupSlot] = useState<string>(() => {
    return availablePickupSlots[0] || '30 min';
  });

  useEffect(() => {
    if (availablePickupSlots.length > 0 && !availablePickupSlots.includes(selectedPickupSlot)) {
      setSelectedPickupSlot(availablePickupSlots[0]);
    }
  }, [availablePickupSlots, selectedPickupSlot]);

  const pickupSchedule: PickupScheduleInfo = useMemo(() => {
    return calculatePickupSchedule(shopConfig, selectedPickupSlot, new Date());
  }, [shopConfig, selectedPickupSlot]);

  // Live Delivery Timing read directly from Google Sheet (shopConfig)
  const liveSheetTimingLabel = useMemo(() => {
    const slot = String(shopConfig?.deliverySlot || '').trim() || (isEnglish ? '20 mins' : '୨୦ ମିନିଟ୍');
    const day = String(shopConfig?.deliveryDay || '').trim();
    if (day && day.toLowerCase() !== 'today') {
      const dayText = day.toLowerCase() === 'tomorrow' ? (isEnglish ? 'Tomorrow' : 'ଆସନ୍ତାକାଲି') : day;
      return `${dayText} · ${slot}`;
    }
    return slot;
  }, [shopConfig?.deliverySlot, shopConfig?.deliveryDay, isEnglish]);

  // Map and Geolocation state
  const [customerLat, setCustomerLat] = useState(defaultAddr?.lat || STORE_LAT);
  const [customerLng, setCustomerLng] = useState(defaultAddr?.lng || STORE_LNG);
  const [distanceKm, setDistanceKm] = useState(0);
  const [isWithinRadius, setIsWithinRadius] = useState(true);
  const [distanceNote, setDistanceNote] = useState('');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [detectFeedback, setDetectFeedback] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const autoLocateAttemptedRef = useRef<boolean>(false);

  // Order Result
  const [placedOrderId, setPlacedOrderId] = useState<string>('');
  const [couponInput, setCouponInput] = useState(appliedCoupon);
  const [couponMsg, setCouponMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const billing = cartBilling(deliveryType);

  // Calculate distance
  const calcHaversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  };

  const updateDistance = async (lat: number, lng: number) => {
    setCustomerLat(lat);
    setCustomerLng(lng);
    const straight = calcHaversine(STORE_LAT, STORE_LNG, lat, lng);
    setDistanceKm(straight);

    if (straight <= MAX_RADIUS_KM) {
      setIsWithinRadius(true);
      setDistanceNote(
        isEnglish
          ? `✅ Distance: ${straight} KM (Within 3 KM Delivery Zone)`
          : `✅ ରାସ୍ତା ଦୂରତା: ${straight} KM (୩ କି.ମି. ଭିତରେ ଡେଲିଭରୀ ଉପଲବ୍ଧ)`
      );
    } else {
      setIsWithinRadius(false);
      setDistanceNote(
        isEnglish
          ? `❌ Distance: ${straight} KM (Outside 3 KM - Select Store Pickup)`
          : `❌ ରାସ୍ତା ଦୂରତା: ${straight} KM (୩ କି.ମି. ବାହାରେ - Store Pickup ବାଛନ୍ତୁ)`
      );
    }

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${STORE_LNG},${STORE_LAT};${lng},${lat}?overview=false`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.routes && data.routes[0]) {
        const road = parseFloat((data.routes[0].distance / 1000).toFixed(1));
        setDistanceKm(road);
        if (road <= MAX_RADIUS_KM) {
          setIsWithinRadius(true);
          setDistanceNote(
            isEnglish
              ? `✅ Road distance: ${road} KM (Within 3 KM Zone)`
              : `✅ ରାସ୍ତା ଦୂରତା: ${road} KM (୩ କି.ମି. ଭିତରେ ଡେଲିଭରୀ ଉପଲବ୍ଧ)`
          );
        } else {
          setIsWithinRadius(false);
          setDistanceNote(
            isEnglish
              ? (!isStorePickupActive(shopConfig)
                  ? `❌ Road distance: ${road} KM (Outside 3 KM - Delivery unavailable & Pickup is OFF)`
                  : `❌ Road distance: ${road} KM (Outside 3 KM - Select Store Pickup)`)
              : (!isStorePickupActive(shopConfig)
                  ? `❌ ରାସ୍ତା ଦୂରତା: ${road} KM (୩ କି.ମି. ବାହାରେ ଡେଲିଭରୀ ଅନୁପଲବ୍ଧ ଓ Store Pickup ବନ୍ଦ ଅଛି)`
                  : `❌ ରାସ୍ତା ଦୂରତା: ${road} KM (୩ କି.ମି. ବାହାରେ - Store Pickup ବାଛନ୍ତୁ)`)
          );
        }
      }
    } catch (e) {}
  };

  const updateUserLocationMarker = (map: L.Map, lat: number, lng: number) => {
    const userPinHtml = `
      <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
        <span style="position:absolute; width:34px; height:34px; border-radius:50%; background:rgba(37,99,235,0.28); animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
        <span style="position:absolute; width:22px; height:22px; border-radius:50%; background:rgba(59,130,246,0.38); border:1.5px solid rgba(255,255,255,0.9);"></span>
        <div style="width:14px; height:14px; border-radius:50%; background:#2563eb; border:2.5px solid #ffffff; box-shadow:0 2px 8px rgba(0,0,0,0.45);"></div>
      </div>
    `;

    const userIcon = L.divIcon({
      className: 'user-current-location-marker',
      html: userPinHtml,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([lat, lng]);
    } else {
      userMarkerRef.current = L.marker([lat, lng], {
        icon: userIcon,
        zIndexOffset: 1000
      }).addTo(map);
    }

    userMarkerRef.current
      .bindPopup('<b>📍 ଆପଣଙ୍କ ଲୋକେସନ୍ (Your Delivery Location)</b>')
      .openPopup();
  };

  const reverseGeocodeLocation = async (lat: number, lng: number, updateFullAddress = true) => {
    setIsLocating(true);
    setDetectFeedback(
      isEnglish ? 'Finding road name & PIN code...' : 'ରାସ୍ତା ନାମ ଓ ପିନ୍ କୋଡ୍ ଖୋଜା ଚାଲିଛି...'
    );
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: { 'Accept-Language': 'en,or' },
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};

        const road = addr.road || addr.pedestrian || addr.street || addr.residential || addr.neighbourhood || '';
        const pin = addr.postcode || '754004';
        const house = addr.house_number || addr.building || addr.amenity || '';
        const area = addr.suburb || addr.village || addr.town || addr.hamlet || 'Niali';

        if (updateFullAddress) {
          const parts = [
            house || area,
            road,
            area !== road ? area : '',
            'Niali',
            pin ? `PIN - ${pin}` : ''
          ].filter(Boolean);

          const formatted = parts.join(', ');
          setCustAddress(formatted);
        }

        setDetectFeedback(
          isEnglish
            ? '✅ Road name & PIN code auto-detected!'
            : '✅ ରାସ୍ତା ନାମ ଓ PIN କୋଡ୍ ସଫଳତାର ସହ ପୂରଣ ହେଲା!'
        );
        setIsLocating(false);
        return;
      }
    } catch (e) {}

    try {
      const bdcRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
      );
      if (bdcRes.ok) {
        const bdc = await bdcRes.json();
        const road = bdc.street || '';
        const pin = bdc.postcode || '754004';
        const area = bdc.locality || bdc.city || 'Niali';

        if (updateFullAddress) {
          const formatted = [area, road, 'Niali', pin ? `PIN - ${pin}` : ''].filter(Boolean).join(', ');
          setCustAddress(formatted);
        }

        setDetectFeedback(
          isEnglish
            ? '✅ Location road & PIN detected!'
            : '✅ ଲୋକେସନ୍ ରାସ୍ତା ଓ ପିନ୍ କୋଡ୍ ଚିହ୍ନଟ ହେଲା!'
        );
        setIsLocating(false);
        return;
      }
    } catch (e) {}

    if (updateFullAddress && !custAddress) {
      setCustAddress('Main Road, Niali Bazar, Cuttack - 754004');
    }
    setDetectFeedback(
      isEnglish
        ? '📍 Location placed at Niali. You can edit details below.'
        : '📍 ନିଆଳି ଲୋକେସନ୍ ସେଟ୍ ହେଲା, ଆପଣ ତଳେ ପରିବର୍ତ୍ତନ କରିପାରିବେ।'
    );
    setIsLocating(false);
  };

  const handleAutoLocateGPS = (isInitial = false) => {
    if (!navigator.geolocation) {
      if (!isInitial) {
        alert(isEnglish ? 'Geolocation is not supported by your browser.' : 'ଆପଣଙ୍କ ବ୍ରାଉଜରରେ GPS ସମର୍ଥିତ ନୁହେଁ।');
      }
      return;
    }

    setIsLocating(true);
    setDetectFeedback(
      isEnglish ? 'Locating your current GPS position...' : 'ଆପଣଙ୍କ GPS ଲୋକେସନ୍ ଖୋଜା ଚାଲିଛି...'
    );

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCustomerLat(latitude);
        setCustomerLng(longitude);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 15);
          updateUserLocationMarker(mapInstanceRef.current, latitude, longitude);
        }

        updateDistance(latitude, longitude);
        reverseGeocodeLocation(latitude, longitude, true);
      },
      () => {
        setIsLocating(false);
        if (!isInitial) {
          alert(
            isEnglish
              ? 'GPS permission not granted or location unavailable. Please drag the pin on the map.'
              : 'GPS ଅନୁମତି ମିଳିଲା ନାହିଁ। ଆପଣ ମ୍ୟାପ୍‌ରେ ପିନ୍ ଘୁଞ୍ଚାଇ ରଖନ୍ତୁ।'
          );
        } else {
          setDetectFeedback(
            isEnglish
              ? '💡 Tip: Move map pin or tap GPS button to pinpoint your location.'
              : '💡 ସୂଚନା: ମ୍ୟାପ୍‌ରେ ପିନ୍ ଘୁଞ୍ଚାନ୍ତୁ କିମ୍ବା GPS ବଟନ୍ ଦବାନ୍ତୁ।'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  // Synchronize and auto-fill customer details from user account or saved address
  useEffect(() => {
    const user = sessionUser || (() => {
      try {
        const s = localStorage.getItem('session_user') || localStorage.getItem('active_store_user');
        return s ? JSON.parse(s) : null;
      } catch (e) {
        return null;
      }
    })();

    if (user) {
      if (user.name && user.name !== 'Munna Customer') setCustName(user.name);
      if (user.phone) setCustPhone(user.phone);
      if (user.address && !custAddress) setCustAddress(user.address);
    } else if (validSavedAddresses.length > 0 && selectedSavedAddrId) {
      const addr = validSavedAddresses.find((a) => a.id === selectedSavedAddrId) || validSavedAddresses[0];
      if (addr) {
        if (!custName && addr.name) setCustName(addr.name);
        if (!custPhone && addr.phone) setCustPhone(addr.phone);
        if (!custAddress && addr.address) setCustAddress(addr.address);
        if (addr.lat && addr.lng) {
          setCustomerLat(addr.lat);
          setCustomerLng(addr.lng);
          updateDistance(addr.lat, addr.lng);
        }
      }
    }
  }, [selectedSavedAddrId, sessionUser, validSavedAddresses.length]);

  const handleSelectSavedAddress = (addr: any) => {
    setSelectedSavedAddrId(addr.id);
    if (addr.name) setCustName(addr.name);
    if (addr.phone) setCustPhone(addr.phone);
    if (addr.address) setCustAddress(addr.address);
    if (addr.lat && addr.lng) {
      setCustomerLat(addr.lat);
      setCustomerLng(addr.lng);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([addr.lat, addr.lng], 15);
        updateUserLocationMarker(mapInstanceRef.current, addr.lat, addr.lng);
      }
      updateDistance(addr.lat, addr.lng);
    }
  };

  const handleEditAddressClick = (addr: any) => {
    setEditingAddressId(addr?.id || null);
    setCustName(addr?.name || custName || '');
    setCustPhone(addr?.phone || custPhone || '');
    setCustAddress(addr?.address || custAddress || '');
    if (addr?.lat && addr?.lng) {
      setCustomerLat(addr.lat);
      setCustomerLng(addr.lng);
      updateDistance(addr.lat, addr.lng);
    }
    setShowAddressSetup(true);
    setShowAddressDrawer(true);
  };

  const handleAddNewAddressClick = () => {
    setEditingAddressId(null);
    setCustAddress('');
    setCustomerLat(STORE_LAT);
    setCustomerLng(STORE_LNG);
    updateDistance(STORE_LAT, STORE_LNG);
    setShowAddressSetup(true);
    setShowAddressDrawer(true);
  };

  const handleSaveAndApplyAddress = () => {
    if (!custName.trim() || custName.trim().length < 2) {
      alert(isEnglish ? 'Please enter recipient name.' : 'ଦୟାକରି ଗ୍ରାହକଙ୍କ ପୂରା ନାମ ଲେଖନ୍ତୁ।');
      return;
    }
    const clean = custPhone.replace(/\D/g, '').slice(-10);
    if (clean.length !== 10) {
      alert(isEnglish ? 'Please enter a valid 10-digit mobile number.' : 'ଦୟାକରି ସଠିକ୍ ୧୦-ଅଙ୍କର ମୋବାଇଲ୍ ନମ୍ବର ଦିଅନ୍ତୁ।');
      return;
    }
    if (deliveryType === 'delivery' && (!custAddress.trim() || custAddress.trim().length < 5)) {
      alert(isEnglish ? 'Please enter complete delivery address.' : 'ଦୟାକରି ସମ୍ପୂର୍ଣ୍ଣ ଡେଲିଭରୀ ଠିକଣା ଲେଖନ୍ତୁ।');
      return;
    }

    if (deliveryType === 'delivery') {
      const idToUpdate = editingAddressId && editingAddressId !== 'addr-account-profile' ? editingAddressId : undefined;
      saveAddress(
        {
          name: custName.trim(),
          phone: clean,
          address: custAddress.trim(),
          isDefault: true,
          lat: customerLat,
          lng: customerLng
        },
        idToUpdate
      );
    }

    if (sessionUser) {
      const updatedUser = {
        ...sessionUser,
        name: custName.trim(),
        phone: clean,
        address: custAddress.trim() || sessionUser.address
      };
      try {
        localStorage.setItem('session_user', JSON.stringify(updatedUser));
        localStorage.setItem('active_store_user', JSON.stringify(updatedUser));
      } catch (e) {}
    }

    setShowAddressSetup(false);
    setShowAddressDrawer(false);
    setEditingAddressId(null);
    showToast(isEnglish ? '✅ Delivery details updated!' : '✅ ଠିକଣା ଓ ବିବରଣୀ ସେଭ୍ ହେଲା!', 'success');
  };

  // Initialize and update Leaflet map when Address Setup is open
  useEffect(() => {
    if (step !== 'checkout' || deliveryType !== 'delivery' || !showAddressSetup || !showAddressDrawer) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        userMarkerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          scrollWheelZoom: false
        }).setView([customerLat, customerLng], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap'
        }).addTo(map);

        L.marker([STORE_LAT, STORE_LNG])
          .addTo(map)
          .bindPopup('<b>MUNNA MOBILE & GROCERY</b><br>Cinema Hall Road, Niali')
          .openPopup();

        L.circle([STORE_LAT, STORE_LNG], {
          color: '#16a34a',
          fillColor: '#86efac',
          fillOpacity: 0.18,
          radius: 3000
        }).addTo(map);

        updateUserLocationMarker(map, customerLat, customerLng);

        map.on('moveend', () => {
          const c = map.getCenter();
          updateDistance(c.lat, c.lng);
          if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([c.lat, c.lng]);
          }
        });

        mapInstanceRef.current = map;
      } else {
        mapInstanceRef.current.invalidateSize();
      }

      updateDistance(customerLat, customerLng);

      if (!autoLocateAttemptedRef.current) {
        autoLocateAttemptedRef.current = true;
        handleAutoLocateGPS(true);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [deliveryType, step, showAddressSetup, showAddressDrawer]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        userMarkerRef.current = null;
      }
    };
  }, []);

  const handleApplyCoupon = (customCode?: string) => {
    const code = (customCode ?? couponInput).trim().toUpperCase();
    if (!code) {
      setAppliedCoupon('');
      setCouponMsg(null);
      return;
    }
    if (shopConfig.couponCode && code === shopConfig.couponCode.toUpperCase()) {
      if (billing.subtotal >= shopConfig.couponMinBill) {
        setAppliedCoupon(code);
        setCouponInput(code);
        setCouponMsg({ text: `🎉 କୁପନ୍ ପ୍ରଯୁଜ୍ୟ ହେଲା! ${shopConfig.couponPercent}% ଛାଡ଼`, ok: true });
      } else {
        setCouponMsg({
          text: `⚠️ କୁପନ୍ ପାଇଁ ଅତି କମରେ ₹${shopConfig.couponMinBill} ର ସାମଗ୍ରୀ କିଣନ୍ତୁ`,
          ok: false
        });
      }
    } else {
      setCouponMsg({ text: '❌ ଭୁଲ୍ କୁପନ୍ କୋଡ୍ (Invalid coupon code)', ok: false });
    }
  };

  // Validation
  const cleanPhone = custPhone.replace(/\D/g, '').slice(-10);
  const isNameValid = custName.trim().length >= 2;
  const isPhoneValid = cleanPhone.length === 10;
  const isAddressValid = deliveryType === 'pickup' || custAddress.trim().length >= 5;
  const isWithinZone = deliveryType === 'pickup' || isWithinRadius;
  const codMin = shopConfig.codMinBill ?? 200;
  const isCodEligible = deliveryType === 'pickup' || billing.subtotal >= codMin;
  const isCodOn = isCodDeliveryActive(shopConfig);
  const isUpiOn = isUpiPaymentActive(shopConfig);
  const isPickupOn = isStorePickupActive(shopConfig);
  const isOrderAllowed = isPickupOn || isCodOn || isUpiOn;

  // Auto-resume checkout step if pendingCheckout was set and user is now authenticated
  useEffect(() => {
    const loggedIn = !!sessionUser?.phone || !!localStorage.getItem('session_user');
    const isPending = pendingCheckout || localStorage.getItem('pending_checkout') === 'true';
    if (loggedIn && isPending) {
      localStorage.removeItem('pending_checkout');
      setPendingCheckout(false);
      setAuthNoticeMessage(null);
    }
  }, [sessionUser, pendingCheckout]);

  const handleProceedToConfirm = () => {
    const loggedIn = !!sessionUser?.phone || !!localStorage.getItem('session_user');
    if (!loggedIn) {
      localStorage.setItem('pending_checkout', 'true');
      setPendingCheckout(true);
      setAuthNoticeMessage(
        isEnglish
          ? 'Please log in or create an account to place your order. (ଅର୍ଡର ଦେବା ପାଇଁ ଦୟାକରି ଲଗଇନ୍ କରନ୍ତୁ)'
          : 'ଅର୍ଡର ଦେବା ପାଇଁ ଦୟାକରି ଲଗଇନ୍ କରନ୍ତୁ (Please log in or create an account to place your order)'
      );
      setShowLoginModal(true);
      return;
    }

    if (!isNameValid || !isPhoneValid || (deliveryType === 'delivery' && !isAddressValid)) {
      setShowAddressDrawer(true);
      if (deliveryType === 'delivery' && validSavedAddresses.length === 0) {
        setShowAddressSetup(true);
      }
      showToast(
        isEnglish
          ? 'Please confirm your name, phone number & delivery address.'
          : 'ଦୟାକରି ଆପଣଙ୍କ ନାମ, ଫୋନ୍ ନମ୍ବର ଓ ଠିକଣା ଯାଞ୍ଚ କରନ୍ତୁ।',
        'warning'
      );
      return;
    }

    const pickupAllowed = isStorePickupActive(shopConfig);
    const codAllowed = isCodDeliveryActive(shopConfig);
    const upiAllowed = isUpiPaymentActive(shopConfig);

    if (!pickupAllowed && !codAllowed && !upiAllowed) {
      alert(
        isEnglish
          ? 'Online ordering is temporarily paused by the store administrator.'
          : 'ଦୋକାନୀଙ୍କ ଦ୍ୱାରା ଅର୍ଡର ସାମୟିକ ଭାବେ ବନ୍ଦ କରାଯାଇଛି।'
      );
      return;
    }

    if (deliveryType === 'pickup' && !pickupAllowed) {
      alert(
        isEnglish
          ? 'Store Pickup is currently turned OFF by the store. Please select Home Delivery.'
          : 'Store Pickup ବର୍ତ୍ତମାନ ବନ୍ଦ ଅଛି। ଦୟାକରି Home Delivery ବାଛନ୍ତୁ।'
      );
      return;
    }

    if (deliveryType === 'delivery') {
      if (!codAllowed && !upiAllowed) {
        alert(
          isEnglish
            ? 'Home Delivery is currently turned OFF. Please select Store Pickup.'
            : 'Home Delivery ବର୍ତ୍ତମାନ ବନ୍ଦ ଅଛି। ଦୟାକରି Store Pickup ବାଛନ୍ତୁ।'
        );
        return;
      }
      if (!isWithinRadius) {
        if (!pickupAllowed) {
          alert(
            isEnglish
              ? 'Your delivery location is outside 3 KM. Home delivery is unavailable.'
              : 'ଆପଣଙ୍କ ଲୋକେସନ୍ ୩ କି.ମି. ବାହାରେ ଅଛି। ଘରେ ଡେଲିଭରୀ ଅନୁପଲବ୍ଧ।'
          );
        } else {
          alert(
            isEnglish
              ? 'Your delivery location is outside 3 KM. Please select Store Pickup (Free ₹0).'
              : 'ଦୋକାନରୁ ୩ କି.ମି. ପରିଧି ଭିତରେ ହିଁ ଘରେ ଡେଲିଭରୀ ଉପଲବ୍ଧ। ଆପଣ "Store Pickup" ବାଛିପାରିବେ (ମାଗଣା ₹0)।'
          );
        }
        return;
      }
    }

    // Live stock & Max limit verification
    for (const ean of Object.keys(cart)) {
      const p = catalog.find((x) => String(x.ean) === String(ean));
      if (!p) continue;
      const curStock = parseProductStock(p.stock_qty);
      const curMax = p.max_order_qty && p.max_order_qty > 0 ? p.max_order_qty : 10;
      const qty = cart[ean];

      if (curStock <= 0) {
        alert(
          isEnglish
            ? `⚠️ "${p.product_name}" is currently OUT OF STOCK. Please remove it from your cart.`
            : `⚠️ "${p.product_name}" ର ଷ୍ଟକ୍ ସରିଯାଇଛି (Out of Stock)। ଦୟାକରି ଏହାକୁ କାର୍ଟରୁ ହଟାନ୍ତୁ।`
        );
        return;
      }
      if (qty > curStock) {
        alert(
          isEnglish
            ? `⚠️ "${p.product_name}" has only ${curStock} units in store (Cart has ${qty}). Please adjust quantity.`
            : `⚠️ "${p.product_name}" ର କେବଳ ${curStock} ଟି ଷ୍ଟକ୍ ଅଛି (ଆପଣଙ୍କ କାର୍ଟରେ ${qty} ଟି ଅଛି)। ଦୟାକରି ସଂଖ୍ୟା କମାନ୍ତୁ।`
        );
        return;
      }
      if (qty > curMax) {
        alert(
          isEnglish
            ? `⚠️ "${p.product_name}" maximum limit is ${curMax} units per customer. Please adjust quantity.`
            : `⚠️ "${p.product_name}" ପାଇଁ ଗ୍ରାହକ ପ୍ରତି ସର୍ବାଧିକ ${curMax} ଟି ସୀମା ରହିଛି। ଦୟାକରି ସଂଖ୍ୟା କମାନ୍ତୁ।`
        );
        return;
      }
    }

    // Open Payment Option Modal (Cash on Delivery / UPI QR Payment)
    setUtrError('');
    setPaymentModalView('select');
    setShowPaymentModal(true);
  };

  const handleFinalConfirmOrder = async (modeOverride?: 'COD' | 'UPI', submittedUtr?: string) => {
    if (isSubmitting) return;

    const chosenMode = modeOverride || (selectedPayment === 'UPI' ? 'UPI' : 'COD');
    const cleanUtr = (submittedUtr ?? utrInput).trim();

    if (chosenMode === 'UPI') {
      if (!cleanUtr || cleanUtr.length < 4) {
        setUtrError(
          isEnglish
            ? '⚠️ Please enter your valid UPI UTR / Reference Number (e.g. 12-digit UTR) to confirm payment.'
            : '⚠️ ଦୟାକରି ପେମେଣ୍ଟର ସଠିକ୍ UTR / Ref ନମ୍ବର (୧୨-ଅଙ୍କ UTR) ଲେଖନ୍ତୁ।'
        );
        return;
      }
    }

    if (deliveryType === 'pickup' && shopConfig.pickupActive === false) {
      alert(
        isEnglish
          ? 'Store Pickup is currently turned OFF. Please select Home Delivery.'
          : 'Store Pickup ବର୍ତ୍ତମାନ ବନ୍ଦ ଅଛି। ଦୟାକରି Home Delivery ବାଛନ୍ତୁ।'
      );
      setShowPaymentModal(false);
      setStep('checkout');
      setDeliveryType('delivery');
      return;
    }

    for (const ean of Object.keys(cart)) {
      const p = catalog.find((x) => String(x.ean) === String(ean));
      if (!p) continue;
      const curStock = parseProductStock(p.stock_qty);
      const qty = cart[ean];
      if (curStock <= 0 || qty > curStock) {
        alert(
          isEnglish
            ? `⚠️ Stock just changed! "${p.product_name}" has only ${Math.max(0, curStock)} units left. Please adjust your cart.`
            : `⚠️ ଷ୍ଟକ୍ ପରିବର୍ତ୍ତନ ହୋଇଛି! "${p.product_name}" ର କେବଳ ${Math.max(0, curStock)} ଟି ବଳିଛି। ଦୟାକରି କାର୍ଟ ଯାଞ୍ଚ କରନ୍ତୁ।`
        );
        setShowPaymentModal(false);
        setStep('checkout');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const items = Object.keys(cart)
        .map((ean) => {
          const p = catalog.find((x) => String(x.ean) === String(ean));
          if (!p) return null;
          const price = typeof p.selling_price === 'number' ? p.selling_price : parseFloat(p.selling_price || '0');
          return {
            ean,
            name: p.product_name,
            qty: cart[ean],
            price
          };
        })
        .filter(Boolean) as { ean: string; name: string; qty: number; price: number }[];

      if (items.length === 0) {
        alert(isEnglish ? 'Your cart is empty.' : 'ଆପଣଙ୍କ କାର୍ଟ ଖାଲି ଅଛି।');
        setShowPaymentModal(false);
        setStep('checkout');
        setIsSubmitting(false);
        return;
      }

      if (deliveryType === 'delivery' && saveAddressForFuture && custAddress.trim()) {
        saveAddress({
          name: custName.trim(),
          phone: cleanPhone,
          address: custAddress.trim(),
          isDefault: true,
          lat: customerLat,
          lng: customerLng
        });
      }

      const isOpen = isStoreOpenNow(shopConfig);
      const scheduledTime = !isOpen
        ? `After ${shopConfig.storeOpenTime || '10:00 AM'} (Store Opens)`
        : (deliveryType === 'pickup' ? selectedPickupSlot : (shopConfig.deliverySlot || '1 hour'));

      const pickupAddressText = shopConfig.storePickupName
        ? `${shopConfig.storePickupName} (${shopConfig.storePickupAddress || 'Cinema Hall Road, Niali'})`
        : 'Store Pickup (Munna Grocery Niali)';

      const paymentLabel =
        chosenMode === 'UPI'
          ? `UPI | UTR: ${cleanUtr}`
          : deliveryType === 'pickup'
          ? 'STORE_PICKUP (COD)'
          : 'COD';

      const currentOrderTotal = billing.total;

      const order = await placeOrder({
        customerName: custName.trim(),
        phone: cleanPhone,
        address: deliveryType === 'pickup' ? pickupAddressText : custAddress.trim(),
        items,
        subtotal: billing.subtotal,
        deliveryFee: deliveryType === 'pickup' ? billing.pickup : billing.delivery,
        discount: billing.discount,
        total: currentOrderTotal,
        payment: paymentLabel,
        utr: chosenMode === 'UPI' ? cleanUtr : undefined,
        deliveryType,
        pickupSlot: deliveryType === 'pickup' ? selectedPickupSlot : undefined,
        pickupFinalTime: deliveryType === 'pickup' ? pickupSchedule.pickupFinalFormattedEn : undefined,
        pickupExpiryTimestamp: deliveryType === 'pickup' ? pickupSchedule.pickupFinalTimestamp : undefined,
        expectedBy: deliveryType === 'pickup' ? pickupSchedule.pickupFinalFormattedEn : scheduledTime,
        location: `${customerLat.toFixed(5)}, ${customerLng.toFixed(5)}`
      });

      setPlacedOrderId(order.id);
      setPlacedPaymentMode(chosenMode === 'UPI' ? 'UPI' : deliveryType === 'pickup' ? 'STORE_PICKUP' : 'COD');
      setPlacedUtrId(chosenMode === 'UPI' ? cleanUtr : '');
      setPlacedOrderTotal(currentOrderTotal);
      setUtrInput('');
      setUtrError('');
      setShowPaymentModal(false);
      setStep('success');

      const container = document.getElementById('cartScreen');
      if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      }

      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (e) {}
    } catch (err) {
      console.error('Order placement error:', err);
      alert(isEnglish ? 'Failed to place order. Please try again.' : 'ଅର୍ଡର ରଖିବାରେ ସମସ୍ୟା ହେଲା। ଦୟାକରି ପୁନର୍ବାର ଚେଷ୍ଟା କରନ୍ତୁ।');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Live Refresh Engine
  const [isRefreshingCart, setIsRefreshingCart] = useState<boolean>(false);
  const [refreshTimestamp, setRefreshTimestamp] = useState<number>(Date.now());

  const cartEans = Object.keys(cart);
  const totalItemCount = cartEans.reduce((sum, ean) => sum + (cart[ean] || 0), 0);
  const finalTotal = billing.total;
  const isStoreClosed = !isStoreOpenNow(shopConfig);

  const handleRefreshCartProducts = async () => {
    if (isRefreshingCart) return;
    setIsRefreshingCart(true);
    try {
      const liveData = await fetchLiveStoreData();
      if (liveData && liveData.products && liveData.products.length > 0) {
        const serverProducts = liveData.products;
        setCatalog(serverProducts);
        setRefreshTimestamp(Date.now());
      } else {
        await syncLiveStockWithServer(true);
        setRefreshTimestamp(Date.now());
      }
      await refreshCartFromSheet();
      if (sessionUser?.phone) {
        await refreshAddresses();
      }
    } catch {
      // silent
    } finally {
      setIsRefreshingCart(false);
    }
  };

  // Total MRP & Savings calculation
  const { totalOriginalMrp, totalMrpDiscount } = useMemo(() => {
    let mrpSum = 0;
    let discSum = 0;
    cartEans.forEach((ean) => {
      const p = catalog.find((x) => String(x.ean) === String(ean));
      if (!p) return;
      const price = typeof p.selling_price === 'number' ? p.selling_price : parseFloat(p.selling_price || '0');
      const mrp = typeof p.mrp === 'number' ? p.mrp : parseFloat(p.mrp || '0');
      const effectiveMrp = mrp > price ? mrp : price;
      const qty = cart[ean] || 0;
      mrpSum += effectiveMrp * qty;
      if (effectiveMrp > price) {
        discSum += (effectiveMrp - price) * qty;
      }
    });
    return {
      totalOriginalMrp: Math.round(mrpSum),
      totalMrpDiscount: Math.round(discSum)
    };
  }, [cartEans, catalog, cart]);

  const savings = Math.round(totalMrpDiscount + (billing.discount || 0));

  // Build "You may also like" products:
  // Prioritizes Sugar items + User's most searched/viewed items + Trending In-Stock items for direct add
  const youMayAlsoLikeProducts = useMemo(() => {
    const searchCounts: Record<string, number> = (() => {
      try {
        return JSON.parse(localStorage.getItem('munna_user_search_counts_v1') || '{}');
      } catch {
        return {};
      }
    })();

    const topSearchedTerms = Object.entries(searchCounts)
      .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
      .map(([term]) => term.toLowerCase().trim())
      .filter((term) => term.length >= 2);

    if (searchQuery && searchQuery.trim().length >= 2) {
      topSearchedTerms.unshift(searchQuery.trim().toLowerCase());
    }

    const cleanTrending = normalizeTrending(shopConfig.trending);
    const cleanTrendingSet = new Set(cleanTrending.map((t) => t.replace(/^EAN-/, '').trim()));

    const inStockCatalog = catalog.filter((p) => parseProductStock(p.stock_qty) > 0);

    const scoreProduct = (p: Product): number => {
      let score = 0;
      const nameLower = (p.product_name || '').toLowerCase();
      const catLower = (p.category || '').toLowerCase();
      const cleanEan = String(p.ean || '').replace(/^EAN-/, '').trim();

      // 1. Prioritize items not yet in cart so user can directly add them (still allow cart items at lower priority)
      if (!cart[p.ean]) {
        score += 50;
      }

      // 2. Prioritize Sugar items (as explicitly requested: "shows sugar or user most searched item show in cart page for direct add")
      if (nameLower.includes('sugar') || catLower.includes('sugar') || nameLower.includes('ଚିନି')) {
        score += 500;
      }

      // 3. Prioritize User's Most Searched / Viewed items
      for (let i = 0; i < topSearchedTerms.length; i++) {
        const term = topSearchedTerms[i];
        if (nameLower.includes(term) || catLower.includes(term)) {
          score += Math.max(120, 420 - i * 35);
          break;
        }
      }

      // 4. Prioritize Store Trending & Daily Essentials (Atta, Oil, Tea, Spices, Biscuits)
      if (cleanTrendingSet.has(cleanEan)) {
        score += 90;
      }
      if (
        nameLower.includes('atta') ||
        nameLower.includes('mustard oil') ||
        nameLower.includes('sunflower oil') ||
        nameLower.includes('rice bran') ||
        nameLower.includes('tea') ||
        nameLower.includes('masala')
      ) {
        score += 45;
      }

      return score;
    };

    const seen = new Set<string>();
    const uniqueInStock: Product[] = [];
    inStockCatalog.forEach((p) => {
      const clean = String(p.ean || '').replace(/^EAN-/, '').trim();
      if (!seen.has(clean)) {
        seen.add(clean);
        uniqueInStock.push(p);
      }
    });

    uniqueInStock.sort((a, b) => scoreProduct(b) - scoreProduct(a));
    return uniqueInStock;
  }, [catalog, cart, shopConfig.trending, searchQuery]);

  const visibleSuggestedProducts = showAllSuggested
    ? youMayAlsoLikeProducts.slice(0, 18)
    : youMayAlsoLikeProducts.slice(0, 6);

  const isCartSheetBusy =
    isRefreshingCart ||
    isSyncingStock ||
    isLoadingAddresses ||
    isSavingAddress ||
    isSyncingCart ||
    isSubmitting;

  return (
    <div id="cartScreen" className="fixed inset-0 z-30 bg-[#f4f6f8] overflow-y-auto">
      {/* 1. Clean White Top Checkout Header (Matching Screenshot) */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200/80 px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (step === 'confirm') {
                setStep('checkout');
              } else {
                setActiveScreen('home');
              }
            }}
            className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-800 cursor-pointer active:scale-95 transition-all"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-[17px] text-slate-900 tracking-tight leading-tight">
              {step === 'confirm'
                ? (isEnglish ? 'Confirm Order' : 'ଅର୍ଡର ନିଶ୍ଚିତ କରନ୍ତୁ')
                : (isEnglish ? 'Checkout' : 'ଚେକ୍ ଆଉଟ୍ (Checkout)')}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {step === 'checkout' && (
            <>
              <button
                type="button"
                onClick={handleRefreshCartProducts}
                disabled={isRefreshingCart}
                title={isEnglish ? 'Refresh' : 'ରିଫ୍ରେସ୍'}
                className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 cursor-pointer active:scale-95 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshingCart ? 'animate-spin text-emerald-600' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveScreen('home');
                  setTimeout(() => {
                    const input = document.getElementById('searchInput') as HTMLInputElement | null;
                    if (input) input.focus();
                  }, 100);
                }}
                title={isEnglish ? 'Search products' : 'ସାମଗ୍ରୀ ଖୋଜନ୍ତୁ'}
                className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-800 cursor-pointer active:scale-95 transition-all"
              >
                <Search className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto p-3 pb-64 space-y-3">
        {/* ================= SUCCESS SCREEN ================= */}
        {step === 'success' ? (
          <div id="stepSuccess" className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs text-center space-y-4">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto animate-bounce ${
                placedPaymentMode === 'UPI'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              {placedPaymentMode === 'UPI' ? (
                <QrCode className="w-9 h-9" />
              ) : (
                <CheckCircle className="w-9 h-9" />
              )}
            </div>

            <div>
              <span
                className={`text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                  placedPaymentMode === 'UPI'
                    ? 'text-amber-900 bg-amber-100 border-amber-300'
                    : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                }`}
              >
                {placedPaymentMode === 'UPI'
                  ? (isEnglish ? '⏸️ Order On Hold — Waiting for Seller Confirmation' : '⏸️ ଅର୍ଡର ହୋଲ୍ଡ (On Hold) — ଦୋକାନୀଙ୍କ ଅନୁମୋଦନ ପାଇଁ ଅପେକ୍ଷାରତ')
                  : (isEnglish ? 'Order Placed Successfully' : 'ଅର୍ଡର ସଫଳ ହେଲା')}
              </span>
              <h4 className="font-black text-slate-900 text-lg mt-2">
                {placedPaymentMode === 'UPI'
                  ? (isEnglish ? 'UPI Payment Submitted!' : 'UPI ପେମେଣ୍ଟ ଓ UTR ଦାଖଲ ହେଲା!')
                  : (isEnglish ? 'Thank You For Your Order!' : 'ଆପଣଙ୍କ ଅର୍ଡର ପାଇଁ ଧନ୍ୟବାଦ!')}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                {isEnglish ? 'Order ID: ' : 'ଅର୍ଡର ID: '}
                <span id="successOrderId" className="font-bold text-[#0c5273] font-mono text-sm">
                  {placedOrderId}
                </span>
              </p>
            </div>

            {/* UPI Order On Hold & UTR Banner */}
            {placedPaymentMode === 'UPI' && (
              <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl text-left space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      {isEnglish
                        ? 'Order On Hold (Waiting Seller Confirmation)'
                        : 'ଅର୍ଡର On Hold ଅଛି (ଦୋକାନୀଙ୍କ କନଫର୍ମେସନ୍ ଅପେକ୍ଷାରେ)'}
                    </span>
                  </span>
                </div>
                <div className="bg-white rounded-xl px-3 py-2 border border-amber-200 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600">
                    {isEnglish ? 'Submitted UTR / Ref ID:' : 'ଆପଣଙ୍କ UTR / Ref ନମ୍ବର:'}
                  </span>
                  <span className="font-mono font-black text-xs text-indigo-950 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {placedUtrId}
                  </span>
                </div>
                <p className="text-[11px] text-amber-900 leading-snug font-medium">
                  {isEnglish
                    ? 'Your order and UTR ID have been sent to the seller. As soon as the seller verifies your UPI payment, your order will be confirmed!'
                    : 'ଆପଣଙ୍କ ଅର୍ଡର ଏବଂ UTR ନମ୍ବର ଦୋକାନୀଙ୍କ ପାଖକୁ ପଠାଯାଇଛି। ଦୋକାନୀ ପେମେଣ୍ଟ ଯାଞ୍ଚ କରି କନଫର୍ମ (Confirm) କରିବା ମାତ୍ରେ ଅର୍ଡର ଆଗକୁ ବଢ଼ିବ।'}
                </p>
              </div>
            )}

            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between">
              <span className="text-xs text-slate-700 font-bold">
                {placedPaymentMode === 'UPI'
                  ? (isEnglish ? 'UPI Amount Paid: ' : 'UPI ପେମେଣ୍ଟ ଟଙ୍କା: ')
                  : (isEnglish ? 'Amount to Pay (COD): ' : 'ଦେବାକୁ ଥିବା ଟଙ୍କା (COD): ')}
              </span>
              <span id="successOrderPay" className="font-black text-emerald-800 text-base">
                ₹{placedOrderTotal || billing.total}
              </span>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3.5 space-y-2 text-xs text-left">
              <div className="flex justify-between text-slate-600">
                <span className="font-semibold">👤 {isEnglish ? 'Name:' : 'ନାମ:'}</span>
                <span id="successName" className="font-bold text-slate-900">{custName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-semibold">📞 {isEnglish ? 'Phone:' : 'ଫୋନ୍:'}</span>
                <span className="font-bold text-slate-900">{cleanPhone}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-semibold">💳 {isEnglish ? 'Payment:' : 'ପେମେଣ୍ଟ:'}</span>
                <span className="font-bold text-slate-900">
                  {placedPaymentMode === 'UPI'
                    ? `UPI QR (UTR: ${placedUtrId})`
                    : deliveryType === 'pickup'
                    ? 'Pay at Store Counter (COD)'
                    : 'Cash on Delivery (COD)'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-semibold">📦 {isEnglish ? 'Fulfillment:' : 'ପ୍ରକାର:'}</span>
                <span id="successMethod" className="font-bold text-slate-900">
                  {deliveryType === 'pickup'
                    ? (isEnglish ? `Store Pickup (${selectedPickupSlot})` : `ଷ୍ଟୋର ପିକଅପ୍ (${selectedPickupSlot})`)
                    : `Home Delivery (${liveSheetTimingLabel})`}
                </span>
              </div>
              {deliveryType === 'pickup' ? (
                <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-600">
                  <p className="font-bold text-slate-800">🏪 {shopConfig.storePickupName || 'Munna Grocery & Communication'}</p>
                  <p className="mt-0.5">{shopConfig.storePickupAddress || 'Cinema Hall Road, Niali, Cuttack - 754004'}</p>
                </div>
              ) : (
                <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-600">
                  <p className="font-bold text-slate-800">📍 {isEnglish ? 'Delivery Address:' : 'ଡେଲିଭରୀ ଠିକଣା:'}</p>
                  <p className="mt-0.5">{custAddress}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveScreen('orders')}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs cursor-pointer active:scale-95 transition-all"
              >
                {isEnglish ? 'Track Order' : 'ଅର୍ଡର ଟ୍ରାକ୍ କରନ୍ତୁ'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('checkout');
                  setActiveScreen('home');
                }}
                className="flex-1 py-3 rounded-xl bg-[#0c5273] hover:bg-[#093e57] text-white font-extrabold text-xs cursor-pointer active:scale-95 transition-all"
              >
                {isEnglish ? 'Continue Shopping' : 'ଆହୁରି କିଣନ୍ତୁ'}
              </button>
            </div>
          </div>
        ) : cartEans.length === 0 ? (
          /* ================= EMPTY CART STATE ================= */
          <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-xs text-center space-y-3.5">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h4 className="font-black text-slate-800 text-sm">
              {t('emptyCart')}
            </h4>
            <p className="text-xs text-slate-400">
              {isEnglish ? 'Add groceries or mobile accessories to checkout' : 'ସଉଦା କିମ୍ବା ମୋବାଇଲ୍ ସାମଗ୍ରୀ କାର୍ଟରେ ଯୋଡ଼ନ୍ତୁ'}
            </p>
            <button
              type="button"
              onClick={() => setActiveScreen('home')}
              className="px-5 py-2.5 bg-[#0c5273] hover:bg-[#093e57] text-white font-extrabold text-xs rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
            >
              {t('startShopping')}
            </button>
          </div>
        ) : step === 'confirm' ? (
          /* ================= ORDER CONFIRMATION SCREEN ================= */
          <div id="stepConfirm" className="space-y-3 animate-fadeIn">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {deliveryType === 'pickup'
                      ? (isEnglish ? `Store Pickup in ${selectedPickupSlot}` : `ଷ୍ଟୋର ପିକଅପ୍ (${selectedPickupSlot})`)
                      : (isEnglish ? `Delivery in ${liveSheetTimingLabel}` : `ଡେଲିଭରି ସମୟ: ${liveSheetTimingLabel}`)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setStep('checkout')}
                  className="text-xs font-bold text-[#0c5273] hover:underline cursor-pointer"
                >
                  {isEnglish ? 'Edit Cart' : 'ବଦଳାନ୍ତୁ'}
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
                <p className="font-bold text-slate-900">
                  👤 {custName} • +91 {cleanPhone}
                </p>
                <p className="text-slate-600">
                  📍 {deliveryType === 'pickup'
                    ? `${shopConfig.storePickupName || 'Munna Grocery'}, ${shopConfig.storePickupAddress || 'Cinema Hall Road, Niali'}`
                    : custAddress}
                </p>
              </div>
            </div>

            {/* Items in Order (Clickable to view product card) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5 text-xs">
              <h4 className="font-bold text-slate-900 pb-1.5 border-b border-slate-100">
                {isEnglish ? `Shipment of ${totalItemCount} items` : `ମୋଟ ${totalItemCount} ଟି ସାମଗ୍ରୀ`}
              </h4>
              <div className="divide-y divide-slate-100">
                {cartEans.map((ean, idx) => {
                  const item = catalog.find((x) => String(x.ean) === String(ean));
                  if (!item) return null;
                  const qty = cart[ean];
                  const price = typeof item.selling_price === 'number' ? item.selling_price : parseFloat(item.selling_price || '0');
                  return (
                    <div
                      key={`confirm-item-${ean}-${idx}`}
                      onClick={() => setSelectedProduct(item)}
                      className="py-2.5 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-50/80 rounded-lg px-1"
                    >
                      <img
                        src={resolveProductImage(item)}
                        alt={item.product_name}
                        className="w-11 h-11 object-contain rounded-lg border border-slate-100 bg-white p-0.5 shrink-0"
                        onError={(e) => handleProductImageError(e, item.backup_image_url, item.ean)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 text-xs truncate">{item.product_name}</p>
                        <p className="text-[11px] text-slate-500">₹{price} × {qty}</p>
                      </div>
                      <span className="font-bold text-slate-900 text-xs">₹{price * qty}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ================= QUICK-COMMERCE CHECKOUT VIEW (MATCHING SCREENSHOT) ================= */
          <>
            {/* Store Closed Alert Banner (If Store is currently closed in Sheet settings) */}
            {isStoreClosed && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 text-xs flex items-start gap-2.5 shadow-2xs">
                <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-extrabold text-amber-900">
                      {isEnglish ? 'Store Currently Closed' : 'ଦୋକାନ ବର୍ତ୍ତମାନ ବନ୍ଦ ଅଛି'}
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      {shopConfig.storeOpenTime || '10:00 AM'} - {shopConfig.storeCloseTime || '09:00 PM'}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                    {shopConfig.storeClosedCheckoutMessage ||
                      shopConfig.storeClosedMessage ||
                      (isEnglish
                        ? `Orders accepted now! Delivery starts after ${shopConfig.storeOpenTime || '10:00 AM'}.`
                        : `ଅର୍ଡର ଗ୍ରହଣ କରାଯାଉଛି! ସକାଳ ${shopConfig.storeOpenTime || '10:00 AM'} ପରେ ଡେଲିଭରୀ ହେବ।`)}
                  </p>
                </div>
              </div>
            )}

            {/* 1. SHIPMENT & CART ITEMS CARD (Matching top of screenshot) */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
              {/* Green Delivery Timing Header (Auto-read from Google Sheet) */}
              <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-100 flex items-start justify-between">
                <div>
                  <h4 className="text-[15px] font-extrabold text-[#15803d] leading-tight">
                    {!isStoreOpenNow(shopConfig)
                      ? (isEnglish
                          ? `Delivery after ${shopConfig.storeOpenTime || '10:00 AM'}`
                          : `ଡେଲିଭରି: ${shopConfig.storeOpenTime || '10:00 AM'} ପରେ`)
                      : deliveryType === 'pickup'
                      ? (isEnglish
                          ? `Store Pickup in ${selectedPickupSlot}`
                          : `ଷ୍ଟୋର ପିକଅପ୍: ${selectedPickupSlot}`)
                      : (isEnglish
                          ? `Delivery in ${liveSheetTimingLabel}`
                          : `ଡେଲିଭରି ସମୟ: ${liveSheetTimingLabel}`)}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {isEnglish
                      ? `Shipment of ${totalItemCount} ${totalItemCount === 1 ? 'item' : 'items'}`
                      : `ମୋଟ ${totalItemCount} ଟି ସାମଗ୍ରୀ`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-900">
                    ₹{billing.subtotal}
                  </span>
                </div>
              </div>

              {/* Cart Items List (Clicking any product image or title opens its Product Detail Card!) */}
              <div className="divide-y divide-slate-100 px-3.5">
                {cartEans.map((ean, idx) => {
                  const p = catalog.find((x) => String(x.ean) === String(ean));
                  if (!p) return null;
                  const q = cart[ean];
                  const price = typeof p.selling_price === 'number' ? p.selling_price : parseFloat(p.selling_price || '0');
                  const mrp = typeof p.mrp === 'number' ? p.mrp : parseFloat(p.mrp || '0');
                  const hasDiscount = mrp > price;
                  const curStock = parseProductStock(p.stock_qty);
                  const unitLabel = extractUnitLabel(p.product_name || '');

                  return (
                    <div
                      key={`cart-item-${ean}-${idx}`}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      {/* Clickable Product Image -> Opens Product Card */}
                      <div
                        onClick={() => setSelectedProduct(p)}
                        className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 p-1 flex items-center justify-center shrink-0 cursor-pointer hover:border-slate-300 transition-all"
                        title={isEnglish ? 'Tap to view product card' : 'ପ୍ରଡକ୍ଟ କାର୍ଡ ଦେଖିବାକୁ କ୍ଲିକ୍ କରନ୍ତୁ'}
                      >
                        <img
                          key={`cart-img-${ean}-${refreshTimestamp}`}
                          src={resolveProductImage(p)}
                          alt={p.product_name}
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          className="w-full h-full object-contain mix-blend-multiply"
                          onError={(e) => handleProductImageError(e, p.backup_image_url, p.ean)}
                        />
                      </div>

                      {/* Clickable Product Name & Unit -> Opens Product Card */}
                      <div
                        onClick={() => setSelectedProduct(p)}
                        className="flex-1 min-w-0 cursor-pointer"
                      >
                        <p className="font-semibold text-slate-900 text-[13px] leading-snug line-clamp-2 hover:text-[#0c5273] transition-colors">
                          {p.product_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[11px] text-slate-500 font-medium">
                            {unitLabel}
                          </span>
                          {curStock <= 0 ? (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded">
                              Out of Stock
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                              {curStock} left
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Pill Stepper + MRP & Price (Matching Screenshot) */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="flex items-center bg-[#4ea8de] text-white rounded-full px-2 py-1 gap-3 shadow-2xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQty(ean, q - 1);
                            }}
                            className="w-4 h-4 flex items-center justify-center font-bold text-white active:scale-90 cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                          <span className="font-extrabold text-xs min-w-[14px] text-center">
                            {q}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQty(ean, q + 1);
                            }}
                            className="w-4 h-4 flex items-center justify-center font-bold text-white active:scale-90 cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>

                        <div className="flex items-baseline gap-1.5">
                          {hasDiscount && (
                            <span className="text-[11px] text-slate-400 line-through font-medium">
                              ₹{mrp * q}
                            </span>
                          )}
                          <span className="text-[13px] font-extrabold text-slate-900">
                            ₹{price * q}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. FREE DELIVERY UNLOCK PROGRESS BANNER (Matching Screenshot Scooter Banner, reading shopConfig.freeAbove) */}
            {deliveryType === 'delivery' && (shopConfig.freeAbove ?? 300) > 0 && (
              <div className="bg-[#eff8ff] border border-[#d0e8ff] rounded-2xl p-3 shadow-2xs space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 shadow-2xs text-lg">
                    🛵
                  </div>
                  <p className="text-xs text-slate-800 leading-snug font-medium">
                    {billing.subtotal < (shopConfig.freeAbove ?? 300) ? (
                      <>
                        {isEnglish ? 'Shop for ' : 'ଆଉ '}
                        <b className="font-extrabold text-slate-950">
                          ₹{Math.max(0, (shopConfig.freeAbove ?? 300) - billing.subtotal)}
                        </b>
                        {isEnglish ? ' more to ' : ' ର ସଉଦା ଯୋଡ଼ି '}
                        <b className="font-extrabold text-slate-950">
                          {isEnglish ? 'unlock free delivery' : 'ମାଗଣା ଡେଲିଭରି (Free Delivery)'}
                        </b>
                        {isEnglish ? ' on your Quick grocery order' : ' ପାଆନ୍ତୁ'}
                      </>
                    ) : (
                      <span className="font-bold text-emerald-800">
                        {isEnglish
                          ? `🎉 Yay! You unlocked FREE delivery (Order above ₹${shopConfig.freeAbove ?? 300})!`
                          : `🎉 ଅଭିନନ୍ଦନ! ଆପଣଙ୍କ ଅର୍ଡରରେ ମାଗଣା ଡେଲିଭରି (Free Delivery) ମିଳିଛି!`}
                      </span>
                    )}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-[#d8ecff] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0ea5e9] rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((billing.subtotal / Math.max(1, shopConfig.freeAbove ?? 300)) * 100)
                      )}%`
                    }}
                  />
                </div>
              </div>
            )}

            {/* 3. "YOU MAY ALSO LIKE" SECTION (Shows Sugar + User's Most Searched Items for Direct Add, 3-per-line with Live Sheet Timing) */}
            {visibleSuggestedProducts.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[15px] font-extrabold text-slate-900 tracking-tight">
                    {isEnglish ? 'You may also like' : 'ଆପଣଙ୍କ ପାଇଁ ଉପଯୋଗୀ ସାମଗ୍ରୀ (You may also like)'}
                  </h4>
                </div>

                <div className="grid grid-cols-3 gap-x-2.5 gap-y-4">
                  {visibleSuggestedProducts.map((item, idx) => {
                    const itemQty = cart[item.ean] || 0;
                    const itemSp = typeof item.selling_price === 'number' ? item.selling_price : parseFloat(item.selling_price || '0');
                    const itemMrp = typeof item.mrp === 'number' ? item.mrp : parseFloat(item.mrp || '0');
                    const itemDisc = itemMrp > itemSp ? Math.round(((itemMrp - itemSp) / itemMrp) * 100) : 0;
                    const itemStock = parseProductStock(item.stock_qty);
                    const unit = extractUnitLabel(item.product_name || '');

                    return (
                      <div
                        key={`cart-suggest-${item.ean}-${idx}`}
                        className="flex flex-col select-none"
                      >
                        {/* Image Card with Unit + Direct ADD button */}
                        <div
                          onClick={() => setSelectedProduct(item)}
                          className="relative w-full aspect-[1/1.06] rounded-2xl border border-slate-200/90 bg-slate-50/70 overflow-hidden flex flex-col justify-between cursor-pointer"
                        >
                          <div className="w-full flex-1 flex items-center justify-center p-2 pb-7">
                            <img
                              src={resolveProductImage(item)}
                              alt={item.product_name}
                              loading="lazy"
                              className="w-full h-full object-contain mix-blend-multiply"
                              onError={(e) => handleProductImageError(e, item.backup_image_url, item.ean)}
                            />
                          </div>

                          {/* Bottom Strip inside image card: Unit on left, ADD / Stepper on right */}
                          <div className="absolute inset-x-0 bottom-0 h-8 bg-slate-100/95 px-2 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-700 truncate max-w-[52%]">
                              {unit}
                            </span>

                            <div className="z-10 -mt-2">
                              {itemQty > 0 ? (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center justify-between bg-[#0c5273] text-white rounded-xl px-1.5 py-1 gap-1.5 shadow-sm"
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setQty(item.ean, itemQty - 1);
                                    }}
                                    className="w-4 h-4 flex items-center justify-center active:scale-90 cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3 stroke-[2.5]" />
                                  </button>
                                  <span className="text-[11px] font-black">{itemQty}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setQty(item.ean, itemQty + 1);
                                    }}
                                    className="w-4 h-4 flex items-center justify-center active:scale-90 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3 stroke-[2.5]" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setQty(item.ean, 1);
                                  }}
                                  className="bg-white hover:bg-sky-50 text-[#0c5273] border-[1.5px] border-[#0c5273] rounded-xl px-2.5 py-1 text-[11px] font-extrabold tracking-tight shadow-2xs active:scale-95 transition-all cursor-pointer"
                                >
                                  ADD
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Price, Discount, Title & Live Sheet Timing */}
                        <div
                          onClick={() => setSelectedProduct(item)}
                          className="pt-1.5 px-0.5 flex flex-col cursor-pointer"
                        >
                          <div className="flex items-baseline gap-1 flex-wrap leading-none">
                            <span className="text-[13px] font-extrabold text-slate-900">
                              ₹{itemSp}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 min-h-[14px] flex-wrap">
                            {itemMrp > itemSp && (
                              <span className="text-[10px] font-semibold text-slate-400 line-through">
                                ₹{itemMrp}
                              </span>
                            )}
                            {itemDisc > 0 && (
                              <span className="text-[10px] font-extrabold text-[#15803d]">
                                {itemDisc}% off
                              </span>
                            )}
                          </div>
                          <h5 className="text-[11px] font-semibold text-slate-800 leading-[1.25] line-clamp-2 mt-0.5 min-h-[27px]">
                            {item.product_name}
                          </h5>
                          <div className="flex items-center gap-1 mt-1 text-slate-500">
                            <Zap className="w-3 h-3 text-slate-500 fill-slate-500 shrink-0" />
                            <span className="text-[10px] font-semibold truncate">
                              {liveSheetTimingLabel} • {itemStock} left
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* "See all items" Button (Matching Screenshot) */}
                {youMayAlsoLikeProducts.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSuggested((prev) => !prev)}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#eff8ff] hover:bg-[#e0f2fe] border border-[#d0e8ff] text-[#0c5273] font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <span>
                      {showAllSuggested
                        ? (isEnglish ? 'Show fewer items' : 'କମ୍ ସାମଗ୍ରୀ ଦେଖନ୍ତୁ')
                        : (isEnglish ? 'See all items' : 'ସବୁ ସାମଗ୍ରୀ ଦେଖନ୍ତୁ (See all items)')}
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* 4. COUPON BAR (Matching Screenshot "% Login to apply coupon" / Live Store Coupon) */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  if (!isUserLoggedIn) {
                    setShowLoginModal(true);
                  } else {
                    setShowCouponBox((prev) => !prev);
                  }
                }}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Percent className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-[13px] font-extrabold text-slate-900 block">
                      {!isUserLoggedIn
                        ? (isEnglish ? 'Login to apply coupon' : 'କୁପନ୍ ଲଗାଇବା ପାଇଁ ଲଗଇନ୍ କରନ୍ତୁ')
                        : appliedCoupon
                        ? `Coupon "${appliedCoupon}" applied (-₹${billing.discount})`
                        : shopConfig.couponCode
                        ? `Apply Store Coupon (${shopConfig.couponCode} - ${shopConfig.couponPercent}% OFF)`
                        : (isEnglish ? 'Apply Coupon Code' : 'କୁପନ୍ କୋଡ୍ ପ୍ରୟୋଗ କରନ୍ତୁ')}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              {(showCouponBox || (isUserLoggedIn && shopConfig.couponCode)) && (
                <div className="px-4 pb-3.5 pt-1 border-t border-slate-100 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder={shopConfig.couponCode ? `Code: ${shopConfig.couponCode}` : 'Enter coupon code'}
                      className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-xl uppercase outline-none focus:border-[#0c5273] font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyCoupon()}
                      className="px-4 py-2 bg-[#0c5273] text-white text-xs font-extrabold rounded-xl cursor-pointer active:scale-95"
                    >
                      {isEnglish ? 'Apply' : 'ଲଗାନ୍ତୁ'}
                    </button>
                  </div>
                  {shopConfig.couponCode && (
                    <button
                      type="button"
                      onClick={() => handleApplyCoupon(shopConfig.couponCode)}
                      className="w-full text-left p-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-[11px] font-bold text-emerald-900 cursor-pointer"
                    >
                      <span>
                        🎟️ Use <b>{shopConfig.couponCode}</b> ({shopConfig.couponPercent}% OFF above ₹{shopConfig.couponMinBill})
                      </span>
                      <span className="text-emerald-700 font-black">
                        {appliedCoupon === shopConfig.couponCode ? 'Applied ✓' : 'Tap to Apply'}
                      </span>
                    </button>
                  )}
                  {couponMsg && (
                    <p className={`text-[11px] font-bold ${couponMsg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {couponMsg.text}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 5. ACTIVE STORE SETTINGS & FULFILLMENT FIT-IN CARD (Reads all live Google Sheet store settings that are ON) */}
            {(() => {
              const isPickupOn = isStorePickupActive(shopConfig);
              const isDeliveryOn = isCodDeliveryActive(shopConfig);

              return (
                <div className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-[#0c5273]" />
                      <span>
                        {isEnglish ? 'Delivery & Store Options' : 'ଡେଲିଭରି ଓ ଷ୍ଟୋର ସେଟିଂସ୍'}
                      </span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {deliveryType === 'pickup'
                        ? (isEnglish ? `Store Pickup (${selectedPickupSlot})` : `ଷ୍ଟୋର ପିକଅପ୍ (${selectedPickupSlot})`)
                        : (isEnglish ? `Home Delivery (${liveSheetTimingLabel})` : `ହୋମ୍ ଡେଲିଭରି (${liveSheetTimingLabel})`)}
                    </span>
                  </div>

                  {/* Mode Switcher when both Home Delivery & Store Pickup are ON in Sheet */}
                  {isDeliveryOn && isPickupOn && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryType('delivery');
                          setSelectedPayment('COD');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          deliveryType === 'delivery'
                            ? 'border-[#0c5273] bg-[#eff8ff] text-slate-900 shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-[#0c5273]" />
                            <span>{isEnglish ? 'Home Delivery' : 'ହୋମ୍ ଡେଲିଭରି'}</span>
                          </span>
                          {deliveryType === 'delivery' && <CheckCircle2 className="w-3.5 h-3.5 text-[#0c5273]" />}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {liveSheetTimingLabel} • {billing.delivery === 0 ? 'FREE' : `₹${billing.delivery}`}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryType('pickup');
                          setSelectedPayment('STORE_PICKUP');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          deliveryType === 'pickup'
                            ? 'border-emerald-600 bg-emerald-50/70 text-slate-900 shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold flex items-center gap-1">
                            <Store className="w-3.5 h-3.5 text-emerald-700" />
                            <span>{isEnglish ? 'Store Pickup' : 'ଷ୍ଟୋର ପିକଅପ୍'}</span>
                          </span>
                          {deliveryType === 'pickup' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {shopConfig.pickupChargeOn && shopConfig.pickupChargeFee > 0
                            ? `Fee ₹${shopConfig.pickupChargeFee}`
                            : (shopConfig.pickupNote || 'Free ₹0 Pickup')}
                        </p>
                      </button>
                    </div>
                  )}

                  {/* Store Pickup Slot Selector (When Store Pickup is active & selected) */}
                  {deliveryType === 'pickup' && isPickupOn && (
                    <div className="pt-1 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <span>⏱️ {isEnglish ? 'Select Pickup Time Slot:' : 'ପିକଅପ୍ ସମୟ ବାଛନ୍ତୁ:'}</span>
                        <span className="text-emerald-700 font-extrabold">
                          Deadline: {pickupSchedule.pickupFinalFormattedEn}
                        </span>
                      </div>
                      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                        {availablePickupSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedPickupSlot(slot)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 border transition-all cursor-pointer ${
                              selectedPickupSlot === slot
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* COD Minimum Bill Notice (If Home Delivery is selected and subtotal < codMin) */}
                  {deliveryType === 'delivery' && isDeliveryOn && !isCodEligible && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-semibold flex items-center justify-between gap-2">
                      <span>
                        ⚠️ {isEnglish
                          ? `Min order for Cash on Delivery is ₹${codMin} (Add ₹${codMin - billing.subtotal} more)`
                          : `COD ପାଇଁ ଅତି କମରେ ₹${codMin} ଆବଶ୍ୟକ (ଆଉ ₹${codMin - billing.subtotal} ଯୋଡ଼ନ୍ତୁ)`}
                      </span>
                      {isPickupOn && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeliveryType('pickup');
                            setSelectedPayment('STORE_PICKUP');
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black shrink-0 cursor-pointer"
                        >
                          Free Pickup
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 6. PAYMENT DETAILS CARD (Matching Screenshot) */}
            <div id="cartFooterView" className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
              <div className="p-4 space-y-2.5 text-xs">
                <h4 className="text-sm font-extrabold text-slate-900 pb-1">
                  {isEnglish ? 'Payment details' : 'ବିଲ୍ ବିବରଣୀ (Payment details)'}
                </h4>

                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span>Total MRP</span>
                  <span className="font-bold text-slate-900">₹{totalOriginalMrp}</span>
                </div>

                {(totalMrpDiscount + (billing.discount || 0)) > 0 && (
                  <div className="flex items-center justify-between text-slate-600 font-medium">
                    <span>Discount</span>
                    <span className="font-extrabold text-[#15803d]">
                      -₹{totalMrpDiscount + (billing.discount || 0)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span>Subtotal</span>
                  <span id="summarySubtotal" className="font-bold text-slate-900">
                    ₹{billing.subtotal}
                  </span>
                </div>

                <div className="flex items-start justify-between text-slate-600 font-medium pt-0.5">
                  <div>
                    <span className="block">
                      {deliveryType === 'pickup' ? 'Store Pickup Fee' : 'Delivery Fee (Quick)'}
                    </span>
                    {deliveryType === 'delivery' && (shopConfig.freeAbove ?? 300) > 0 && (
                      <span className="text-[11px] font-bold text-slate-700 block mt-0.5">
                        FREE delivery on orders above ₹{shopConfig.freeAbove ?? 300} for Quick Groceries.
                      </span>
                    )}
                  </div>
                  <span id="summaryDeliveryCharge" className="font-bold text-slate-900 shrink-0 ml-2">
                    {deliveryType === 'pickup'
                      ? (billing.pickup > 0 ? `₹${billing.pickup}` : 'FREE')
                      : (billing.delivery > 0 ? `₹${billing.delivery}` : 'FREE')}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">Total</span>
                  <span id="summaryTotal" className="text-base font-extrabold text-slate-900">
                    ₹{billing.total}
                  </span>
                </div>
              </div>

              {/* Green "Your total saving" bottom strip inside Payment details card (Matching Screenshot) */}
              {savings > 0 && (
                <div className="bg-[#e6f7ed] border-t border-[#c6f0d6] px-4 py-2.5 flex items-center justify-between text-xs font-extrabold text-[#15803d]">
                  <span>Your total saving</span>
                  <span>₹{savings}</span>
                </div>
              )}
            </div>

            {/* 7. CANCELLATION POLICY CARD (Matching Screenshot) */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-2xs space-y-1.5">
              <p className="text-xs text-slate-600 leading-relaxed">
                {deliveryType === 'pickup'
                  ? (shopConfig.pickupCancelNotice ||
                      'Orders are reserved at the counter and eligible for cancellation before pickup deadline.')
                  : 'Orders are eligible for cancellation or refund only before they are packed for delivery'}
              </p>
              <button
                type="button"
                onClick={() => setShowPaymentPolicyModal(true)}
                className="text-xs font-extrabold text-[#0c5273] hover:underline cursor-pointer"
              >
                Cancellation policy
              </button>
            </div>
          </>
        )}
      </div>

      {/* ADDRESS & CONTACT DRAWER MODAL (Opened when user clicks "Change" on the bottom bar) */}
      {showAddressDrawer && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-md max-h-[88dvh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#0c5273]" />
                <span>
                  {deliveryType === 'pickup'
                    ? (isEnglish ? 'Pickup Contact Details' : 'ପିକଅପ୍ ଯୋଗାଯୋଗ ବିବରଣୀ')
                    : (isEnglish ? 'Select or Change Delivery Address' : 'ଡେଲିଭରି ଠିକଣା ବାଛନ୍ତୁ କିମ୍ବା ବଦଳାନ୍ତୁ')}
                </span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowAddressDrawer(false);
                  setShowAddressSetup(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3.5 flex-1 pb-6">
              {/* Saved Addresses List (if in Delivery mode and not editing) */}
              {deliveryType === 'delivery' && !showAddressSetup && validSavedAddresses.length > 0 && (
                <div className="space-y-2.5">
                  {validSavedAddresses.map((addr) => {
                    const isSelected = selectedSavedAddrId === addr.id;
                    return (
                      <div
                        key={addr.id}
                        onClick={() => {
                          handleSelectSavedAddress(addr);
                          setShowAddressDrawer(false);
                        }}
                        className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-start justify-between gap-2 ${
                          isSelected
                            ? 'border-[#0c5273] bg-[#eff8ff]'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-extrabold text-slate-900">
                            {addr.name} • +91 {addr.phone}
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5 leading-snug break-words">
                            {addr.address}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditAddressClick(addr);
                          }}
                          className="text-xs font-bold text-[#0c5273] px-2 py-1 rounded-lg bg-white border border-slate-200 shrink-0 cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleAddNewAddressClick}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#0c5273] text-[#0c5273] font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isEnglish ? '+ Add New Delivery Address' : '+ ନୂଆ ଡେଲିଭରି ଠିକଣା ଯୋଡ଼ନ୍ତୁ'}</span>
                  </button>
                </div>
              )}

              {/* Address & Contact Form + 3KM Map */}
              {(deliveryType === 'pickup' || showAddressSetup || validSavedAddresses.length === 0) && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{isEnglish ? 'Full Name *' : 'ଆପଣଙ୍କ ନାମ *'}</span>
                      </label>
                      <input
                        id="custNameInput"
                        type="text"
                        value={custName}
                        onChange={(e) => setCustName(e.target.value)}
                        placeholder={isEnglish ? 'Enter full name' : 'ପୂରା ନାମ ଲେଖନ୍ତୁ'}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-[#0c5273] font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{isEnglish ? '10-Digit Mobile *' : '୧୦-ଅଙ୍କର ମୋବାଇଲ୍ *'}</span>
                      </label>
                      <input
                        id="custPhoneInput"
                        type="tel"
                        maxLength={10}
                        value={custPhone}
                        onChange={(e) => setCustPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="9876543210"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-[#0c5273] font-semibold"
                      />
                    </div>
                  </div>

                  {deliveryType === 'delivery' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAutoLocateGPS(false)}
                        disabled={isLocating}
                        className="w-full py-2 px-3 rounded-xl bg-[#0c5273] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {isLocating ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{isEnglish ? 'Detecting GPS...' : 'GPS ଖୋଜା ଚାଲିଛି...'}</span>
                          </>
                        ) : (
                          <>
                            <Compass className="w-3.5 h-3.5" />
                            <span>{isEnglish ? '⚡ Auto-Detect Road & PIN via GPS' : '⚡ GPS ରୁ ରାସ୍ତା ଓ ପିନ୍ କୋଡ୍ ଖୋଜନ୍ତୁ'}</span>
                          </>
                        )}
                      </button>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          {isEnglish ? 'Complete Delivery Address (Niali 3KM) *' : 'ସମ୍ପୂର୍ଣ୍ଣ ଡେଲିଭରି ଠିକଣା *'}
                        </label>
                        <textarea
                          id="custAddressInput"
                          rows={2}
                          value={custAddress}
                          onChange={(e) => setCustAddress(e.target.value)}
                          placeholder="House/Plot, Road, Landmark, Niali, PIN 754004"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-[#0c5273] font-medium"
                        />
                      </div>

                      <div className="relative w-full h-44 rounded-2xl border border-slate-200 overflow-hidden">
                        <div id="allInOneDeliveryMap" ref={mapContainerRef} className="w-full h-full z-10" />
                        <div
                          style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -100%)',
                            pointerEvents: 'none',
                            zIndex: 1000
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="28" height="28" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1">
                            <path d="M12 2C7.9 2 4.5 5.3 4.5 9.4 4.5 14.6 12 22 12 22s7.5-7.4 7.5-12.6C19.5 5.3 16.1 2 12 2z" />
                            <circle cx="12" cy="9.3" r="2.8" fill="#fff" />
                          </svg>
                        </div>
                      </div>

                      {distanceNote && (
                        <div
                          className={`text-[11px] font-bold p-2 rounded-xl border ${
                            isWithinRadius
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {distanceNote}
                        </div>
                      )}
                    </>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-slate-400" />
                      <span>{isEnglish ? 'Order Note (Optional):' : 'ଅର୍ଡର ନୋଟ୍ (ଇଚ୍ଛାଧୀନ):'}</span>
                    </label>
                    <input
                      type="text"
                      value={orderNote}
                      onChange={(e) => setOrderNote(e.target.value)}
                      placeholder={isEnglish ? 'Any special instruction...' : 'କୌଣସି ବିଶେଷ ସୂଚନା...'}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sticky footer for saving address/pickup details */}
            {(deliveryType === 'pickup' || showAddressSetup || validSavedAddresses.length === 0) && (
              <div
                className="p-3.5 bg-white border-t border-slate-200 shrink-0 shadow-lg"
                style={{
                  paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))'
                }}
              >
                <button
                  type="button"
                  id="drawerSaveAddressBtn"
                  onClick={handleSaveAndApplyAddress}
                  className="w-full py-3 rounded-full bg-[#0c5273] hover:bg-[#093e57] text-white font-extrabold text-xs shadow-md cursor-pointer active:scale-95 transition-all"
                >
                  {isEnglish ? 'Save & Use Details' : 'ଠିକଣା ସେଭ୍ କରନ୍ତୁ ଓ ବ୍ୟବହାର କରନ୍ତୁ'}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* PAYMENT SELECTION / COD CONFIRM POPUP / AUTO UPI QR + UTR MODAL (Opened after clicking Proceed) */}
      {showPaymentModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-md max-h-[92dvh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                {paymentModalView !== 'select' && (
                  <button
                    type="button"
                    onClick={() => {
                      setUtrError('');
                      setPaymentModalView('select');
                    }}
                    className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}
                <h4 className="text-sm font-extrabold text-slate-900">
                  {paymentModalView === 'cod_confirm'
                    ? (isEnglish ? '💵 Confirm Cash on Delivery' : '💵 Cash on Delivery (COD) ନିଶ୍ଚିତ କରନ୍ତୁ')
                    : paymentModalView === 'upi_qr'
                    ? (isEnglish ? '📱 Scan UPI QR & Enter UTR' : '📱 UPI QR ସ୍କାନ୍ କରନ୍ତୁ ଓ UTR ଲେଖନ୍ତୁ')
                    : (isEnglish ? '💳 Select Payment Option' : '💳 ପେମେଣ୍ଟ ମାଧ୍ୟମ ବାଛନ୍ତୁ (COD / UPI)')}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setUtrError('');
                }}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3.5 flex-1 pb-6">
              {/* Total Bill & Customer Summary Pill */}
              <div className="p-3 rounded-2xl bg-[#eff8ff] border border-[#d0e8ff] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-600 block">
                    {isEnglish ? 'Total Payable Bill' : 'ମୋଟ ଦେବାକୁ ଥିବା ବିଲ୍'}
                  </span>
                  <span className="text-xs font-extrabold text-slate-800">
                    {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} •{' '}
                    {deliveryType === 'pickup' ? 'Store Pickup' : 'Home Delivery'}
                  </span>
                </div>
                <span className="text-xl font-black text-[#0c5273]">₹{finalTotal}</span>
              </div>

              {/* VIEW 1: CHOOSE PAYMENT OPTION (CASH ON DELIVERY / UPI QR) */}
              {paymentModalView === 'select' && (
                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-slate-600">
                    {isEnglish
                      ? 'Choose how you would like to pay for your order:'
                      : 'ଆପଣ କିପରି ପେମେଣ୍ଟ କରିବାକୁ ଚାହୁଁଛନ୍ତି ବାଛନ୍ତୁ:'}
                  </p>

                  {/* OPTION 1: CASH ON DELIVERY (COD) / PAY AT STORE COUNTER */}
                  {(isCodOn || deliveryType === 'pickup') && (
                    <button
                      type="button"
                      onClick={() => {
                        if (deliveryType === 'delivery' && !isCodEligible) {
                          alert(
                            isEnglish
                              ? `Minimum order value for Cash on Delivery is ₹${codMin}. Please add ₹${codMin - billing.subtotal} more items or pay via UPI QR.`
                              : `Cash on Delivery (COD) ପାଇଁ ଅତି କମରେ ₹${codMin} ର ସଉଦା ଆବଶ୍ୟକ। ଆଉ ₹${codMin - billing.subtotal} ଯୋଡ଼ନ୍ତୁ କିମ୍ବା UPI QR ବାଛନ୍ତୁ।`
                          );
                          return;
                        }
                        setSelectedPayment(deliveryType === 'pickup' ? 'STORE_PICKUP' : 'COD');
                        setPaymentModalView('cod_confirm');
                      }}
                      className="w-full p-3.5 rounded-2xl border-2 border-emerald-200 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 text-left flex items-center justify-between gap-3 transition-all cursor-pointer active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Banknote className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-black text-slate-900">
                              {deliveryType === 'pickup'
                                ? (isEnglish ? 'Cash at Store Counter (COD)' : 'ଦୋକାନ କାଉଣ୍ଟରରେ କ୍ୟାସ୍ (COD)')
                                : (isEnglish ? 'Cash on Delivery (COD)' : 'କ୍ୟାସ୍ ଅନ୍ ଡେଲିଭରୀ (COD)')}
                            </span>
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                              Popular
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                            {deliveryType === 'delivery' && !isCodEligible
                              ? (isEnglish
                                  ? `⚠️ Min order ₹${codMin} required for COD`
                                  : `⚠️ COD ପାଇଁ ଅତି କମରେ ₹${codMin} ବିଲ୍ ଆବଶ୍ୟକ`)
                              : (shopConfig.codNotice ||
                                  (isEnglish
                                    ? `Pay ₹${finalTotal} cash when you receive your items`
                                    : `ସାମଗ୍ରୀ ପାଇବା ସମୟରେ ₹${finalTotal} ନଗଦ ଟଙ୍କା ଦିଅନ୍ତୁ`))}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-emerald-700 shrink-0" />
                    </button>
                  )}

                  {/* OPTION 2: UPI QR PAYMENT (AUTO QR GENERATE + UTR BOX) */}
                  {isUpiOn && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPayment('UPI');
                        setUtrError('');
                        setPaymentModalView('upi_qr');
                      }}
                      className="w-full p-3.5 rounded-2xl border-2 border-indigo-200 hover:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50 text-left flex items-center justify-between gap-3 transition-all cursor-pointer active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <QrCode className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-black text-slate-900">
                              {isEnglish ? 'Pay via UPI QR Code' : 'UPI QR ସ୍କାନ୍ କରି ପେମେଣ୍ଟ କରନ୍ତୁ'}
                            </span>
                            <span className="text-[10px] font-black bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                              Instant QR
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                            {isEnglish
                              ? `Auto-generates ₹${finalTotal} QR • Scan with PhonePe / GPay / Paytm & enter UTR`
                              : `₹${finalTotal} ର ଅଟୋ QR କୋଡ୍ • PhonePe / GPay ରେ ପେମେଣ୍ଟ କରି UTR ନମ୍ବର ଦିଅନ୍ତୁ`}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-indigo-700 shrink-0" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    {isEnglish ? 'Cancel' : 'ବାତିଲ୍ କରନ୍ତୁ (Cancel)'}
                  </button>
                </div>
              )}

              {/* VIEW 2: COD CONFIRM / CANCEL POPUP */}
              {paymentModalView === 'cod_confirm' && (
                <div className="space-y-3.5 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-sm">
                      <Banknote className="w-6 h-6" />
                    </div>
                    <h5 className="text-base font-black text-slate-900">
                      {isEnglish
                        ? 'Confirm Cash on Delivery Order?'
                        : 'ଆପଣ Cash on Delivery ଅର୍ଡର ନିଶ୍ଚିତ କରୁଛନ୍ତି କି?'}
                    </h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {isEnglish
                        ? `Please keep ₹${finalTotal} ready to pay in cash upon ${deliveryType === 'pickup' ? 'pickup at the store counter' : 'delivery at your doorstep'}.`
                        : `ଦୟାକରି ${deliveryType === 'pickup' ? 'ଦୋକାନ କାଉଣ୍ଟରରେ ନେବା ସମୟରେ' : 'ଡେଲିଭରୀ ସମୟରେ'} ₹${finalTotal} ନଗଦ ଟଙ୍କା ପ୍ରସ୍ତୁତ ରଖନ୍ତୁ।`}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">{isEnglish ? 'Customer:' : 'ଗ୍ରାହକ:'}</span>
                      <span className="font-bold text-slate-900">{custName} ({cleanPhone})</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 font-semibold shrink-0">{isEnglish ? 'Address:' : 'ଠିକଣା:'}</span>
                      <span className="font-bold text-slate-900 text-right truncate">
                        {deliveryType === 'pickup'
                          ? (shopConfig.storePickupName || 'Munna Grocery Counter')
                          : custAddress}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 3: AUTO UPI PAYMENT QR GENERATOR + UTR ENTER BOX + CONFIRM PAID */}
              {paymentModalView === 'upi_qr' && (() => {
                const merchantUpiId = (shopConfig.upiId || '9040585726@ybl').trim();
                const merchantName = (shopConfig.upiPayeeName || 'Munna Mobile & Grocery').trim();
                const upiUri = `upi://pay?pa=${encodeURIComponent(merchantUpiId)}&pn=${encodeURIComponent(merchantName)}&am=${finalTotal}&cu=INR&tn=${encodeURIComponent('Munna Store Order')}`;
                const autoQrImageUrl =
                  shopConfig.upiCustomQrUrl && shopConfig.upiCustomQrUrl.trim()
                    ? shopConfig.upiCustomQrUrl.trim()
                    : `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(upiUri)}`;

                return (
                  <div className="space-y-3 animate-fadeIn">
                    {/* Auto Generated QR Code Box */}
                    <div className="p-3.5 rounded-2xl bg-indigo-50/70 border-2 border-indigo-200 text-center space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] font-extrabold text-indigo-950 bg-indigo-100/80 px-3 py-1 rounded-xl">
                        <span>⚡ {merchantName}</span>
                        <span className="text-indigo-700 font-black">Pay ₹{finalTotal}</span>
                      </div>

                      <div className="w-48 h-48 mx-auto bg-white p-2.5 rounded-2xl border-2 border-indigo-300 shadow-sm flex items-center justify-center">
                        <img
                          src={autoQrImageUrl}
                          alt="UPI Payment QR Code"
                          className="w-full h-full object-contain"
                        />
                      </div>

                      {/* UPI ID + Copy Button + Open UPI App Button */}
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 bg-white px-3 py-1 rounded-full border border-indigo-200 text-xs">
                          <span className="text-slate-500 font-semibold">UPI ID:</span>
                          <span className="font-mono font-black text-indigo-950">{merchantUpiId}</span>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                navigator.clipboard.writeText(merchantUpiId);
                                showToast(isEnglish ? 'UPI ID Copied!' : 'UPI ID କପି ହେଲା!', 'success');
                              } catch {}
                            }}
                            className="ml-1 text-[10px] font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-0.5 cursor-pointer"
                          >
                            <Copy className="w-2.5 h-2.5" />
                            <span>Copy</span>
                          </button>
                        </div>

                        <div>
                          <a
                            href={upiUri}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>
                              {isEnglish
                                ? `Open UPI App (PhonePe / GPay / Paytm) — ₹${finalTotal}`
                                : `UPI ଆପ୍ ଖୋଲି ₹${finalTotal} ପେମେଣ୍ଟ କରନ୍ତୁ`}
                            </span>
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Below QR: UTR / UPI Ref ID Input Box */}
                    <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-2">
                      <label className="text-xs font-black text-amber-950 block">
                        🔢 {isEnglish
                          ? 'Enter 12-Digit UTR / UPI Reference No. *'
                          : 'ପେମେଣ୍ଟ ପରେ ୧୨-ଅଙ୍କ UTR / UPI Ref ନମ୍ବର ଏଠାରେ ଲେଖନ୍ତୁ *'}
                      </label>
                      <input
                        id="upiUtrInput"
                        type="text"
                        value={utrInput}
                        onChange={(e) => {
                          setUtrInput(e.target.value);
                          if (utrError) setUtrError('');
                        }}
                        placeholder={isEnglish ? 'Enter UTR / UPI Ref No. (e.g. 412345678901)' : 'UTR ନମ୍ବର ଲେଖନ୍ତୁ (ଯେପରି 412345678901)'}
                        className="w-full px-3.5 py-2.5 text-sm font-mono font-black rounded-xl border-2 border-amber-400 bg-white text-slate-900 outline-none focus:border-indigo-600"
                      />
                      {utrError && (
                        <p className="text-[11px] font-extrabold text-rose-600">
                          {utrError}
                        </p>
                      )}
                      <p className="text-[10.5px] text-amber-900 leading-snug font-medium">
                        ⏸️ {isEnglish
                          ? 'After clicking Confirm Paid, your order will be placed ON HOLD and wait for Seller confirmation.'
                          : 'Confirm Paid ଦବାଇବା ପରେ ଆପଣଙ୍କ ଅର୍ଡର On Hold ରହିବ ଏବଂ ଦୋକାନୀ UTR ଯାଞ୍ଚ କରି କନଫର୍ମ (Confirm) କରିବେ।'}
                      </p>
                    </div>

                  </div>
                );
              })()}
            </div>

            {/* STICKY BOTTOM ACTIONS FOOTER (Always visible, on top of everything, never hidden) */}
            {paymentModalView === 'upi_qr' && (
              <div
                className="px-4 py-3 bg-white border-t border-slate-200 grid grid-cols-2 gap-2.5 shrink-0 shadow-lg"
                style={{
                  paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))'
                }}
              >
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setShowPaymentModal(false);
                    setUtrError('');
                  }}
                  className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs cursor-pointer active:scale-95 transition-all"
                >
                  {isEnglish ? 'Cancel' : 'ବାତିଲ୍ (Cancel)'}
                </button>
                <button
                  type="button"
                  id="modalConfirmPaidBtn"
                  disabled={isSubmitting}
                  onClick={() => handleFinalConfirmOrder('UPI', utrInput)}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isEnglish ? 'Confirm Paid ✅' : 'Confirm Paid ✅'}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {paymentModalView === 'cod_confirm' && (
              <div
                className="px-4 py-3 bg-white border-t border-slate-200 grid grid-cols-2 gap-2.5 shrink-0 shadow-lg"
                style={{
                  paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))'
                }}
              >
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowPaymentModal(false)}
                  className="py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-xs cursor-pointer active:scale-95 transition-all"
                >
                  ❌ {isEnglish ? 'Cancel' : 'ବାତିଲ୍ (Cancel)'}
                </button>
                <button
                  type="button"
                  id="modalConfirmCodBtn"
                  disabled={isSubmitting}
                  onClick={() => handleFinalConfirmOrder('COD')}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isEnglish ? 'Confirm Order' : 'Confirm (ନିଶ୍ଚିତ କରନ୍ତୁ)'}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* STICKY BOTTOM CHECKOUT FOOTER:
          Upper Side = Delivering to Address + Change Button
          Lower Side = Total Amount + Login to proceed / Proceed Button
          (Exact match to Screenshot) */}
      {step !== 'success' && cartEans.length > 0 && (
        <div
          className="fixed left-0 right-0 z-[60] bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.07)]"
          style={{
            bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))'
          }}
        >
          <div className="max-w-md mx-auto">
            {/* Upper Side: Address / Pickup Location Bar */}
            <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2.5">
              <div
                onClick={() => {
                  setShowAddressDrawer(true);
                  if (deliveryType === 'delivery' && validSavedAddresses.length === 0) {
                    setShowAddressSetup(true);
                  }
                }}
                className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-[#e0f2fe] text-[#0c5273] flex items-center justify-center shrink-0">
                  {deliveryType === 'pickup' ? (
                    <Store className="w-4 h-4" />
                  ) : (
                    <MapPin className="w-4 h-4 fill-[#0c5273] text-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-800 leading-tight truncate">
                    {deliveryType === 'pickup' ? (
                      <>
                        Pickup from <b className="font-extrabold text-slate-950">{shopConfig.storePickupName || 'Munna Grocery Niali'}</b>
                      </>
                    ) : (
                      <>
                        Delivering to <b className="font-extrabold text-slate-950">{custName || 'Niali'}</b>
                      </>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {deliveryType === 'pickup'
                      ? `${shopConfig.storePickupAddress || 'Cinema Hall Road, Niali'} • Slot: ${selectedPickupSlot}`
                      : (custAddress || (isEnglish ? 'Tap Change to add your delivery address' : 'ଠିକଣା ଯୋଡ଼ିବା ପାଇଁ Change ଦବାନ୍ତୁ'))}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAddressDrawer(true);
                  if (deliveryType === 'delivery' && validSavedAddresses.length === 0) {
                    setShowAddressSetup(true);
                  }
                }}
                className="text-xs font-extrabold text-[#0c5273] hover:underline shrink-0 px-1.5 py-1 cursor-pointer"
              >
                Change
              </button>
            </div>

            {/* Lower Side: Total + Login to proceed / Proceed Button */}
            <div className="px-4 py-2.5 flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-500 leading-tight">
                  Total
                </span>
                <span className="text-base font-extrabold text-slate-950 leading-tight">
                  ₹{finalTotal}
                </span>
              </div>

              <button
                type="button"
                onClick={step === 'confirm' ? () => handleFinalConfirmOrder() : handleProceedToConfirm}
                disabled={isSubmitting || !isOrderAllowed}
                className={`flex-1 max-w-[230px] py-3 px-6 rounded-full font-extrabold text-sm text-white shadow-md flex items-center justify-center gap-2 transition-all ${
                  !isOrderAllowed
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-[#0c5273] hover:bg-[#093e57] active:scale-95 cursor-pointer'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>{isEnglish ? 'Processing...' : 'ପ୍ରକ୍ରିୟା ଚାଲିଛି...'}</span>
                  </>
                ) : !isOrderAllowed ? (
                  <span>{isEnglish ? 'Ordering Paused' : 'ଅର୍ଡର ବନ୍ଦ ଅଛି'}</span>
                ) : !isUserLoggedIn ? (
                  <span>Login to proceed</span>
                ) : step === 'confirm' ? (
                  <span>{isEnglish ? 'Confirm & Place Order' : 'ଅର୍ଡର ନିଶ୍ଚିତ କରନ୍ତୁ'}</span>
                ) : (
                  <span>{isEnglish ? 'Proceed to Order' : 'ଅର୍ଡର କରନ୍ତୁ (Proceed)'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
