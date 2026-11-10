import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Product, normalizeTrending } from './types';
import { AppProvider, useApp } from './context/AppContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { Header } from './components/Header';
import { Carousel } from './components/Carousel';
import { BroadcastNotice } from './components/BroadcastNotice';
import { CategoryPills } from './components/CategoryPills';
import { ProductCard } from './components/ProductCard';
import { FloatingCartBar } from './components/FloatingCartBar';
import { BottomNav } from './components/BottomNav';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartScreen } from './components/CartScreen';
import { OrdersScreen } from './components/OrdersScreen';
import { AddressScreen } from './components/AddressScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { AdminPinModal } from './components/AdminPinModal';
import { ScannerModal } from './components/ScannerModal';
import { IncomingOrderAlert } from './components/IncomingOrderAlert';
import { WishlistScreen } from './components/WishlistScreen';
import { PermissionModal } from './components/PermissionModal';
import { PaymentPolicyModal } from './components/PaymentPolicyModal';
import { Flame, Search, Sparkles, ChevronLeft, ChevronRight, Loader2, ShoppingBag, RefreshCw } from 'lucide-react';
import { initStatusBar } from './utils/device';
import { useSmartBackButton } from './utils/backButton';
import { ToastContainer, showToast } from './components/Toast';
import { recordPageView } from './services/api';
import { OfflineIndicator } from './components/OfflineIndicator';
import { StoreChatbot } from './components/StoreChatbot';
import { doesProductMatchEan, doesProductContainEanSubstring, parseEanList } from './utils/productMediaHelper';
import { resolveProductFromShortLink } from './utils/shareUtils';

// Safely redirect any window.alert calls to the non-blocking in-app Toast notification
if (typeof window !== 'undefined') {
  window.alert = (message?: any) => {
    showToast(String(message ?? ''));
  };
}

const MainShop: React.FC = () => {
  const {
    catalog,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    activeScreen,
    setActiveScreen,
    goBackScreen,
    selectedProduct,
    setSelectedProduct,
    shopConfig,
    showLoginModal,
    setShowLoginModal,
    showAdminPinModal,
    setShowAdminPinModal,
    showScanner,
    setShowScanner,
    showPermissionModal,
    setShowPermissionModal,
    showPaymentPolicyModal,
    setShowPaymentPolicyModal,
    incomingOrderAlert,
    setIncomingOrderAlert,
    isInitialSheetLoading
  } = useApp();
  const { t, isEnglish } = useLanguage();

  // 1. Initialize native Android status bar styling & record initial page view
  useEffect(() => {
    initStatusBar();
    recordPageView('Home');
  }, []);

  // 2. Smart Android hardware back button, previous screen stack, and double-press on Home to exit
  useSmartBackButton({
    selectedProduct,
    setSelectedProduct,
    activeScreen,
    setActiveScreen,
    goBackScreen,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    showLoginModal,
    setShowLoginModal,
    showAdminPinModal,
    setShowAdminPinModal,
    showScanner,
    setShowScanner,
    showPermissionModal,
    setShowPermissionModal,
    showPaymentPolicyModal,
    setShowPaymentPolicyModal,
    incomingOrderAlert,
    setIncomingOrderAlert
  });

  // Keep refs for activeScreen, selectedProduct, and catalog to prevent infinite update loops
  const catalogRef = React.useRef(catalog);
  catalogRef.current = catalog;

  const activeScreenRef = React.useRef(activeScreen);
  activeScreenRef.current = activeScreen;

  const selectedProductRef = React.useRef(selectedProduct);
  selectedProductRef.current = selectedProduct;

  const hadOpenProductRef = React.useRef(false);
  const initialDeepLinkSearchRef = React.useRef<string>(
    typeof window !== 'undefined' ? window.location.search : ''
  );

  // 3. Deep-Linking & URL Routing: Listen to browser history navigation (popstate/hashchange) and initial load
  useEffect(() => {
    const handleUrlNavigation = () => {
      try {
        // (a) Deep link for Product Detail modal: /?item={ean} or /?product={ean} or /?ean={ean} or /?id={ean}
        const activeSearch = window.location.search || initialDeepLinkSearchRef.current;
        const params = new URLSearchParams(activeSearch);
        const itemEan = params.get('item') || params.get('product') || params.get('ean') || params.get('id');
        if (itemEan) {
          const cleanItemEan = itemEan.split('_')[0].replace(/^EAN-/i, '').trim();
          const product =
            catalogRef.current.find((p) => doesProductMatchEan(p, cleanItemEan)) ||
            resolveProductFromShortLink(window.location.href || activeSearch, catalogRef.current);
          if (product) {
            hadOpenProductRef.current = true;
            if (!selectedProductRef.current || !doesProductMatchEan(selectedProductRef.current, cleanItemEan)) {
              setSelectedProduct(product);
            }
          }
        } else if (selectedProductRef.current && !initialDeepLinkSearchRef.current) {
          setSelectedProduct(null);
        }

        // (b) Screen deep link via Hash (#cart, #wishlist, #profile, #categories, #search, #admin, etc.)
        const hash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
        const pathname = window.location.pathname;

        if (
          pathname === '/admin' ||
          pathname.endsWith('/admin') ||
          hash === 'admin' ||
          pathname === '/pos' ||
          pathname.endsWith('/pos') ||
          pathname.endsWith('/pos.html') ||
          hash === 'pos'
        ) {
          if (activeScreenRef.current !== 'admin') setActiveScreen('admin');
          return;
        }

        if (hash === 'cart') {
          if (activeScreenRef.current !== 'cart') setActiveScreen('cart');
        } else if (hash === 'wishlist') {
          if (activeScreenRef.current !== 'wishlist') setActiveScreen('wishlist');
        } else if (hash === 'profile') {
          if (activeScreenRef.current !== 'profile') setActiveScreen('profile');
        } else if (hash === 'orders') {
          if (activeScreenRef.current !== 'orders') setActiveScreen('orders');
        } else if (hash === 'address') {
          if (activeScreenRef.current !== 'address') setActiveScreen('address');
        } else if (hash === 'categories') {
          if (activeScreenRef.current !== 'home') setActiveScreen('home');
          setTimeout(() => {
            const catEl = document.getElementById('categorySection');
            if (catEl) catEl.scrollIntoView({ behavior: 'smooth' });
          }, 80);
        } else if (hash === 'search') {
          if (activeScreenRef.current !== 'home') setActiveScreen('home');
          setTimeout(() => {
            const input = document.getElementById('searchInput') as HTMLInputElement | null;
            if (input) {
              input.focus();
              input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 80);
        } else if (!hash || hash === 'home') {
          if (activeScreenRef.current !== 'home') {
            setActiveScreen('home');
          }
        }
      } catch (e) {
        // Safe fallback
      }
    };

    handleUrlNavigation();
  }, [setActiveScreen, setSelectedProduct]);

  // 4. When catalog updates from Google Sheet, open or upgrade the deep-linked product with live Sheet data
  useEffect(() => {
    try {
      const activeSearch = window.location.search || initialDeepLinkSearchRef.current;
      const params = new URLSearchParams(activeSearch);
      const itemEan = params.get('item') || params.get('product') || params.get('ean') || params.get('id');
      if (itemEan && catalog.length > 0) {
        const cleanItemEan = itemEan.split('_')[0].replace(/^EAN-/i, '').trim();
        const product = catalog.find((p) => doesProductMatchEan(p, cleanItemEan));
        if (product) {
          hadOpenProductRef.current = true;
          initialDeepLinkSearchRef.current = '';
          setSelectedProduct(product);
        }
      }
    } catch (e) {}
  }, [catalog, setSelectedProduct]);

  // 5. Sync selectedProduct to URL query param (?item={ean}) without page reloads
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const currentItem = url.searchParams.get('item');

      if (selectedProduct) {
        hadOpenProductRef.current = true;
        const primaryClean = String(selectedProduct.ean || '').split(',')[0].split('_')[0].replace(/^EAN-/i, '').trim();
        const currentClean = String(currentItem || '').split('_')[0].replace(/^EAN-/i, '').trim();
        if (primaryClean && currentClean !== primaryClean) {
          url.searchParams.set('item', primaryClean);
          window.history.pushState({ item: primaryClean }, '', url.pathname + url.search + url.hash);
        }
      } else if (hadOpenProductRef.current) {
        // Only remove ?item= when the user explicitly closes an already-open product modal!
        hadOpenProductRef.current = false;
        initialDeepLinkSearchRef.current = '';
        if (currentItem !== null) {
          url.searchParams.delete('item');
          url.searchParams.delete('n');
          url.searchParams.delete('img');
          url.searchParams.delete('sp');
          url.searchParams.delete('mrp');
          url.searchParams.delete('stk');
          url.searchParams.delete('v');
          window.history.pushState(null, '', url.pathname + (url.search || '') + url.hash);
        }
      }
    } catch (e) {}
  }, [selectedProduct]);

  // 6. Sync activeScreen to URL hash (#cart, #wishlist, #profile, etc.) without triggering hashchange loops
  useEffect(() => {
    try {
      const currentHash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
      const search = window.location.search || '';

      if (activeScreen === 'home') {
        if (
          currentHash === 'cart' ||
          currentHash === 'wishlist' ||
          currentHash === 'profile' ||
          currentHash === 'orders' ||
          currentHash === 'address' ||
          currentHash === 'admin'
        ) {
          window.history.replaceState(null, '', `${window.location.pathname}${search}`);
        }
      } else {
        if (currentHash !== activeScreen) {
          window.history.pushState(null, '', `${window.location.pathname}${search}#${activeScreen}`);
        }
      }
    } catch (e) {}
  }, [activeScreen]);

  // Filter products by category & search query
  const filteredProducts = catalog.filter((p) => {
    if (activeCategory && activeCategory.toLowerCase() !== 'all') {
      const cat = (p.category || '').toLowerCase();
      const name = (p.product_name || '').toLowerCase();

      if (activeCategory === 'Mobile & Electronics') {
        const matchesMobile =
          cat.includes('mobile') ||
          cat.includes('electronic') ||
          cat.includes('electric') ||
          cat.includes('speaker') ||
          cat.includes('audio') ||
          cat.includes('sound') ||
          cat.includes('bluetooth') ||
          cat.includes('wireless') ||
          cat.includes('phone') ||
          cat.includes('charger') ||
          cat.includes('cable') ||
          cat.includes('glass') ||
          cat.includes('cover') ||
          cat.includes('earphone') ||
          cat.includes('headphone') ||
          cat.includes('neckband') ||
          cat.includes('otg') ||
          cat.includes('adapter') ||
          name.includes('speaker') ||
          name.includes('audio') ||
          name.includes('sound') ||
          name.includes('bluetooth') ||
          name.includes('wireless') ||
          name.includes('boat') ||
          name.includes('jbl') ||
          name.includes('mobile') ||
          name.includes('charger') ||
          name.includes('cable') ||
          name.includes('usb') ||
          name.includes('type-c') ||
          name.includes('glass') ||
          name.includes('cover') ||
          name.includes('earphone') ||
          name.includes('neckband') ||
          name.includes('adapter') ||
          name.includes('tempered');
        if (!matchesMobile) return false;
      } else if (activeCategory === 'Oil' || activeCategory === 'Oil & Masalas') {
        const matchesOil =
          (!cat.includes('hair') && cat.includes('oil')) ||
          cat.includes('mustard') ||
          cat.includes('sunflower') ||
          cat.includes('bran') ||
          cat.includes('ghee') ||
          (!name.includes('hair') && name.includes('oil')) ||
          name.includes('mustard') ||
          name.includes('sunflower') ||
          name.includes('refined');
        if (!matchesOil) return false;
      } else if (activeCategory === 'Atta & Rice') {
        const matchesAtta =
          cat.includes('atta') ||
          cat.includes('rice') ||
          cat.includes('besan') ||
          cat.includes('sugar') ||
          cat.includes('dal') ||
          cat.includes('flour') ||
          cat.includes('grocery') ||
          name.includes('atta') ||
          name.includes('rice') ||
          name.includes('sugar') ||
          name.includes('besan') ||
          name.includes('dal') ||
          name.includes('flour');
        if (!matchesAtta) return false;
      } else if (activeCategory === 'Biscuits') {
        const matchesBiscuits =
          cat.includes('biscuit') ||
          cat.includes('cookie') ||
          cat.includes('creme') ||
          cat.includes('wafer') ||
          cat.includes('marie') ||
          name.includes('biscuit') ||
          name.includes('cookie') ||
          name.includes('bourbon') ||
          name.includes('creme') ||
          name.includes('wafer') ||
          name.includes('marie') ||
          name.includes('bikis') ||
          name.includes('fantasy') ||
          name.includes('unibic') ||
          name.includes('parle');
        if (!matchesBiscuits) return false;
      } else if (activeCategory === 'Tea & Drinks') {
        const matchesTea =
          cat.includes('tea') ||
          cat.includes('tae') ||
          cat.includes('drink') ||
          cat.includes('juice') ||
          cat.includes('horlick') ||
          name.includes('tea') ||
          name.includes('horlicks') ||
          name.includes('juice') ||
          name.includes('drink') ||
          name.includes('bournvita') ||
          name.includes('boost');
        if (!matchesTea) return false;
      } else if (activeCategory === 'Snacks & Noodles') {
        const matchesSnacks =
          cat.includes('noodle') ||
          cat.includes('snack') ||
          cat.includes('choco') ||
          cat.includes('nut') ||
          name.includes('noodle') ||
          name.includes('maggi') ||
          name.includes('choco') ||
          name.includes('nut') ||
          name.includes('kaju') ||
          name.includes('pasta');
        if (!matchesSnacks) return false;
      } else if (activeCategory === 'Spices') {
        const matchesSpices =
          cat.includes('masala') ||
          cat.includes('spice') ||
          name.includes('masala') ||
          name.includes('spice') ||
          name.includes('chilli') ||
          name.includes('turmeric') ||
          name.includes('haldi');
        if (!matchesSpices) return false;
      } else if (activeCategory === 'Personal Care') {
        const matchesCare =
          cat.includes('soap') ||
          cat.includes('paste') ||
          cat.includes('brush') ||
          cat.includes('tooth') ||
          cat.includes('hair') ||
          cat.includes('lotion') ||
          cat.includes('body') ||
          cat.includes('spray') ||
          cat.includes('oral') ||
          cat.includes('shampoo') ||
          cat.includes('cream') ||
          name.includes('soap') ||
          name.includes('paste') ||
          name.includes('brush') ||
          name.includes('hair') ||
          name.includes('lotion') ||
          name.includes('spray') ||
          name.includes('gel') ||
          name.includes('dettol') ||
          name.includes('lux') ||
          name.includes('colgate') ||
          name.includes('dabur red');
        if (!matchesCare) return false;
      } else if (activeCategory === 'Cleaning') {
        const matchesCleaning =
          cat.includes('wash') ||
          cat.includes('detergent') ||
          cat.includes('surf') ||
          cat.includes('dish') ||
          cat.includes('agarbatti') ||
          cat.includes('fabric') ||
          name.includes('wash') ||
          name.includes('surf') ||
          name.includes('detergent') ||
          name.includes('agarbatti') ||
          name.includes('rin') ||
          name.includes('comfort') ||
          name.includes('dishwash') ||
          name.includes('wheel') ||
          name.includes('tide');
        if (!matchesCleaning) return false;
      } else if (activeCategory === 'Baby Care') {
        const matchesBaby =
          cat.includes('baby') ||
          name.includes('baby') ||
          name.includes('hushabye') ||
          name.includes('wipes');
        if (!matchesBaby) return false;
      } else if (!cat.includes(activeCategory.toLowerCase()) && !name.includes(activeCategory.toLowerCase())) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const name = (p.product_name || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return name.includes(q) || cat.includes(q) || doesProductContainEanSubstring(p, q);
    }
    return true;
  });

  // Helper to determine numeric stock for any product
  const getProductStock = (p: Product): number => {
    if (typeof p.stock_qty === 'number') return p.stock_qty;
    const parsed = parseInt(String(p.stock_qty ?? '0'), 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Products sorted with Home Page Selected / Featured items prioritized at the upper top,
  // followed by all other items on scroll down, with Out of Stock placed at the page end
  const sortedProducts = useMemo(() => {
    const seenEans = new Set<string>();
    const uniqueFiltered: Product[] = [];
    filteredProducts.forEach((p) => {
      const allCodes = parseEanList(p.ean, p.additional_eans, p.ean_list);
      const cleanEan = allCodes[0] || String(p.ean).replace(/^EAN-/, '').trim();
      const codesToCheck = allCodes.length > 0 ? allCodes : [cleanEan];
      if (!codesToCheck.some((code) => seenEans.has(code))) {
        codesToCheck.forEach((code) => seenEans.add(code));
        uniqueFiltered.push(p);
      }
    });

    const list = [...uniqueFiltered];
    const cleanTrending = normalizeTrending(shopConfig.trending);

    list.sort((a, b) => {
      const stockA = getProductStock(a);
      const stockB = getProductStock(b);
      const isOutOfStockA = stockA <= 0;
      const isOutOfStockB = stockB <= 0;

      // In-stock first, out-of-stock at page last
      if (isOutOfStockA && !isOutOfStockB) return 1;
      if (!isOutOfStockA && isOutOfStockB) return -1;

      // When viewing 'All' category and without search, prioritize Home Page Selected items first
      if (!isOutOfStockA && !isOutOfStockB && activeCategory.toLowerCase() === 'all' && !searchQuery.trim()) {
        const cleanA = String(a.ean).replace(/^EAN-/, '').trim();
        const cleanB = String(b.ean).replace(/^EAN-/, '').trim();
        const rawA = String(a.ean).trim();
        const rawB = String(b.ean).trim();
        const isSelectedA = cleanTrending.includes(cleanA) || cleanTrending.includes(rawA);
        const isSelectedB = cleanTrending.includes(cleanB) || cleanTrending.includes(rawB);

        if (isSelectedA && !isSelectedB) return -1;
        if (!isSelectedA && isSelectedB) return 1;

        if (isSelectedA && isSelectedB) {
          const indexA = cleanTrending.findIndex(
            (t) => String(t).replace(/^EAN-/, '').trim() === cleanA || String(t).trim() === rawA
          );
          const indexB = cleanTrending.findIndex(
            (t) => String(t).replace(/^EAN-/, '').trim() === cleanB || String(t).trim() === rawB
          );
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        }
      }

      return 0;
    });

    return list;
  }, [filteredProducts, shopConfig.trending, activeCategory, searchQuery]);

  // Trending products with out-of-stock items placed at the end (deduplicated across all linked EANs)
  const trendingProducts = useMemo(() => {
    const cleanTrending = normalizeTrending(shopConfig.trending);
    const cleanTrendingSet = new Set(cleanTrending.map((t) => t.replace(/^EAN-/, '').trim()));

    const seenEans = new Set<string>();
    const list: Product[] = [];

    catalog.forEach((p) => {
      const rawEan = String(p.ean).trim();
      const allCodes = parseEanList(p.ean, p.additional_eans, p.ean_list);
      const cleanEan = allCodes[0] || rawEan.replace(/^EAN-/, '').trim();
      const codesToCheck = allCodes.length > 0 ? allCodes : [cleanEan];
      const isTrending =
        codesToCheck.some((c) => cleanTrendingSet.has(c) || cleanTrending.includes(c)) ||
        cleanTrendingSet.has(rawEan) ||
        cleanTrending.includes(rawEan) ||
        cleanTrending.some((t) => t.toLowerCase() === (p.product_name || '').trim().toLowerCase());

      if (isTrending && !codesToCheck.some((code) => seenEans.has(code))) {
        codesToCheck.forEach((code) => seenEans.add(code));
        list.push(p);
      }
    });

    list.sort((a, b) => {
      const isOutOfStockA = getProductStock(a) <= 0;
      const isOutOfStockB = getProductStock(b) <= 0;
      if (isOutOfStockA && !isOutOfStockB) return 1;
      if (!isOutOfStockA && isOutOfStockB) return -1;

      const cleanA = String(a.ean).replace(/^EAN-/, '').trim();
      const cleanB = String(b.ean).replace(/^EAN-/, '').trim();
      const rawA = String(a.ean).trim();
      const rawB = String(b.ean).trim();

      const idxA = cleanTrending.findIndex(
        (t) =>
          String(t).replace(/^EAN-/, '').trim() === cleanA ||
          String(t).trim() === rawA ||
          String(t).trim().toLowerCase() === (a.product_name || '').trim().toLowerCase()
      );
      const idxB = cleanTrending.findIndex(
        (t) =>
          String(t).replace(/^EAN-/, '').trim() === cleanB ||
          String(t).trim() === rawB ||
          String(t).trim().toLowerCase() === (b.product_name || '').trim().toLowerCase()
      );

      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });

    return list;
  }, [catalog, shopConfig.trending]);

  // Auto-scroll logic for Trending Products (Left to Right format with smooth loop & touch pause)
  const trendingContainerRef = React.useRef<HTMLDivElement>(null);
  const isInteractingTrendingRef = React.useRef<boolean>(false);

  useEffect(() => {
    const container = trendingContainerRef.current;
    if (!container || trendingProducts.length <= 1) return;

    let resumeTimer: NodeJS.Timeout;

    // Smooth continuous auto-scroll left-to-right interval
    const interval = setInterval(() => {
      if (!isInteractingTrendingRef.current && container) {
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (maxScroll > 2) {
          if (container.scrollLeft >= maxScroll - 2) {
            // Smoothly reset back to start for endless loop
            container.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            // Advance by ~1 card width smoothly left-to-right
            container.scrollBy({ left: 165, behavior: 'smooth' });
          }
        }
      }
    }, 2800);

    const handleInteractionStart = () => {
      isInteractingTrendingRef.current = true;
      if (resumeTimer) clearTimeout(resumeTimer);
    };

    const handleInteractionEnd = () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        isInteractingTrendingRef.current = false;
      }, 3500); // Resume auto-scrolling 3.5s after user touches or scrolls
    };

    container.addEventListener('mouseenter', handleInteractionStart);
    container.addEventListener('mouseleave', handleInteractionEnd);
    container.addEventListener('touchstart', handleInteractionStart, { passive: true });
    container.addEventListener('touchend', handleInteractionEnd, { passive: true });

    return () => {
      clearInterval(interval);
      if (resumeTimer) clearTimeout(resumeTimer);
      container.removeEventListener('mouseenter', handleInteractionStart);
      container.removeEventListener('mouseleave', handleInteractionEnd);
      container.removeEventListener('touchstart', handleInteractionStart);
      container.removeEventListener('touchend', handleInteractionEnd);
    };
  }, [trendingProducts.length]);

  const handleManualTrendingScroll = (direction: 'left' | 'right') => {
    const container = trendingContainerRef.current;
    if (!container) return;
    isInteractingTrendingRef.current = true;
    const amount = direction === 'left' ? -180 : 180;
    container.scrollBy({ left: amount, behavior: 'smooth' });
    setTimeout(() => {
      isInteractingTrendingRef.current = false;
    }, 4000);
  };

  // Initial Full-Page Simple Round Spinner (Only round clock/spinner, no letters or internal database mention)
  if (isInitialSheetLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white select-none">
        <div className="w-11 h-11 rounded-full border-4 border-slate-200 border-t-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#111]">
      {/* Main Content Area */}
      <main
        id="mainHomeContent"
        className="flex-1 pb-24 touch-pan-y"
      >
        {/* Main Home Screen */}
        {activeScreen === 'home' && (
          <div className="w-full">
            {/* Store Header with Natural Top Info & Rock-Solid Sticky Search Bar */}
            <Header />
            {/* Top Banner, Broadcast Notice & Categories Section (natural fluid scroll flow) */}
            <div className="space-y-0.5">
              {/* Responsive Full-Width Hero Offer Banner Carousel */}
              <Carousel />

              {/* Admin Broadcast Notice (if published) */}
              <BroadcastNotice />

              {/* Circular Category Icons Bar */}
              <CategoryPills />
            </div>

            {/* Trending Offers Strip - Left to Right Auto-Scroll (3 per row width) */}
            {trendingProducts.length > 0 && !searchQuery && (
              <section id="trendingSection" className="max-w-md mx-auto px-3 sm:px-3.5 mt-3">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-[15px] sm:text-base font-extrabold text-slate-900 flex items-center gap-1.5 tracking-tight">
                    <Flame className="w-4 h-4 text-rose-500 fill-rose-500 animate-pulse" />
                    <span>{t('trendingOffers')}</span>
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-slate-500">
                    <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/80 font-black flex items-center gap-0.5">
                      <span>🔥 {t('deals')}</span>
                    </span>
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        onClick={() => handleManualTrendingScroll('left')}
                        className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 active:scale-95 transition-transform"
                        title="Scroll Left"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleManualTrendingScroll('right')}
                        className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 active:scale-95 transition-transform"
                        title="Scroll Right"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Horizontal Scroll Trending Offers Row (3 products visible per line) */}
                <div
                  id="trendingOffersRow"
                  ref={trendingContainerRef}
                  className="overflow-x-auto flex gap-2.5 sm:gap-3 pb-2 overscroll-x-contain no-scrollbar scroll-smooth"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-x pan-y',
                  }}
                >
                  {trendingProducts.map((p, idx) => (
                    <div
                      key={`trending-${p.ean}-${p.rowIndex ?? ''}-${idx}`}
                      className="w-[calc((100%-20px)/3)] min-w-[104px] sm:w-[134px] shrink-0 flex flex-col"
                      style={{ touchAction: 'pan-x pan-y' }}
                    >
                      <ProductCard product={p} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Popular Near You / Main Products Grid - 3 Products Per Line */}
            <section id="newArrivalsSection" className="max-w-md mx-auto px-3 sm:px-3.5 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[16px] sm:text-[17px] font-black text-slate-950 flex items-center gap-1.5 tracking-tight">
                  <Sparkles className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                  <span>
                    {searchQuery
                      ? `${t('searchNav')}: "${searchQuery}"`
                      : activeCategory.toLowerCase() === 'all'
                      ? t('newArrivals')
                      : activeCategory === 'Mobile & Electronics'
                      ? t('mobileElectronics')
                      : activeCategory}
                  </span>
                </h3>
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
                  {sortedProducts.length} {t('items')}
                </span>
              </div>

              {sortedProducts.length === 0 ? (
                <div className="py-10 px-4 text-center bg-white rounded-2xl border border-slate-200 mt-2 space-y-3 shadow-2xs">
                  <Search className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="font-black text-slate-800 text-sm">
                    {t('noProductsFound')}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {t('trySearching')}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('All');
                      if (searchQuery) setSearchQuery('');
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    🛒 ସବୁ ସାମଗ୍ରୀ ଦେଖନ୍ତୁ (View All Products)
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-x-2.5 gap-y-4 sm:gap-x-3 sm:gap-y-5">
                  {sortedProducts.map((p, idx) => (
                    <ProductCard key={`arrival-${p.ean}-${p.rowIndex ?? ''}-${idx}`} product={p} />
                  ))}
                </div>
              )}
            </section>

            {/* Floating Cart Bar */}
            <FloatingCartBar />
          </div>
        )}

        {/* Screen Views (Rendered inside main, isolated from home header) */}
        {activeScreen === 'cart' && <CartScreen />}
        {activeScreen === 'orders' && <OrdersScreen />}
        {activeScreen === 'address' && <AddressScreen />}
        {activeScreen === 'profile' && <ProfileScreen />}
        {activeScreen === 'wishlist' && <WishlistScreen />}
        {activeScreen === 'admin' && <AdminPanel />}
      </main>

      {/* Modals & Overlays */}
      <OfflineIndicator />
      <ProductDetailModal />
      <PaymentPolicyModal />
      <AuthModal />
      <AdminPinModal />
      <ScannerModal />
      <IncomingOrderAlert />
      <PermissionModal />
      <ToastContainer />

      {/* Persistent Bottom Navigation (Visible across all customer pages) */}
      {activeScreen !== 'admin' && activeScreen !== 'cart' && <StoreChatbot />}
      {activeScreen !== 'admin' && <BottomNav />}
    </div>
  );
};

export function App() {
  return (
    <LanguageProvider>
      <AppProvider>
        <MainShop />
      </AppProvider>
    </LanguageProvider>
  );
}

export default App;
