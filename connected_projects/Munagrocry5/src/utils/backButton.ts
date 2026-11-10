import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { showExitToast } from '../components/Toast';

export interface SmartBackOptions {
  selectedProduct: any | null;
  setSelectedProduct: (product: any | null) => void;
  activeScreen: string;
  setActiveScreen: (screen: any) => void;
  goBackScreen?: () => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  activeCategory?: string;
  setActiveCategory?: (cat: string) => void;
  showLoginModal?: boolean;
  setShowLoginModal?: (show: boolean) => void;
  showAdminPinModal?: boolean;
  setShowAdminPinModal?: (show: boolean) => void;
  showScanner?: boolean;
  setShowScanner?: (show: boolean) => void;
  showPermissionModal?: boolean;
  setShowPermissionModal?: (show: boolean) => void;
  showPaymentPolicyModal?: boolean;
  setShowPaymentPolicyModal?: (show: boolean) => void;
  incomingOrderAlert?: any | null;
  setIncomingOrderAlert?: (order: any | null) => void;
}

type CustomBackHandler = () => boolean;
const customBackHandlers: CustomBackHandler[] = [];

/**
 * Register a sub-modal/drawer back handler (e.g. Payment modal, UPI QR, COD confirm)
 * so hardware back closes the sub-view first before navigating away from the page.
 */
export const useRegisterBackHandler = (handler: CustomBackHandler, active = true) => {
  const handlerRef = useRef<CustomBackHandler>(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return;
    const wrapped: CustomBackHandler = () => handlerRef.current();
    customBackHandlers.push(wrapped);
    return () => {
      const idx = customBackHandlers.lastIndexOf(wrapped);
      if (idx !== -1) {
        customBackHandlers.splice(idx, 1);
      }
    };
  }, [active]);
};

/**
 * Smart Android Hardware Back-Button & Double-Press To Exit handler:
 *
 * RULE 1: If on ANY sub-page (Cart, Orders, Address, Profile, Wishlist, Admin):
 *   - If an inner popup/modal is open (e.g. Payment modal, UPI QR, COD confirm, Address drawer):
 *     close that popup first and stay on the current screen.
 *   - Otherwise, ALWAYS navigate back to the MAIN HOME PAGE (`activeScreen = 'home'`).
 *   - NEVER exit or show exit toast from any non-home page!
 *
 * RULE 2: ONLY when the user is on the MAIN HOME PAGE (`activeScreen === 'home'`):
 *   - If Product modal is open, close it.
 *   - If search query or category is filtered, reset to All.
 *   - 1st Back press on clean Home: Show toast "Press back again to exit (ଆପ୍ ବନ୍ଦ କରିବା ପାଇଁ ପୁଣି ଥରେ Back ଦବାନ୍ତୁ)"
 *   - 2nd Back press on clean Home within 2.5 seconds: Close/exit the app.
 */
export const useSmartBackButton = ({
  selectedProduct,
  setSelectedProduct,
  activeScreen,
  setActiveScreen,
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
}: SmartBackOptions) => {
  const selectedProductRef = useRef(selectedProduct);
  selectedProductRef.current = selectedProduct;

  const activeScreenRef = useRef(activeScreen);
  activeScreenRef.current = activeScreen;

  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  const activeCategoryRef = useRef(activeCategory);
  activeCategoryRef.current = activeCategory;

  const showLoginModalRef = useRef(showLoginModal);
  showLoginModalRef.current = showLoginModal;

  const showAdminPinModalRef = useRef(showAdminPinModal);
  showAdminPinModalRef.current = showAdminPinModal;

  const showScannerRef = useRef(showScanner);
  showScannerRef.current = showScanner;

  const showPermissionModalRef = useRef(showPermissionModal);
  showPermissionModalRef.current = showPermissionModal;

  const showPaymentPolicyModalRef = useRef(showPaymentPolicyModal);
  showPaymentPolicyModalRef.current = showPaymentPolicyModal;

  const incomingOrderAlertRef = useRef(incomingOrderAlert);
  incomingOrderAlertRef.current = incomingOrderAlert;

  const lastBackPressTimeRef = useRef<number>(0);
  const lastActionTimeRef = useRef<number>(0);

  // Helper to ensure the browser has a dummy state in history so hardware back can be intercepted in PWA/browser
  const ensureHistoryGuard = () => {
    try {
      const curState = window.history.state;
      if (!curState || !curState.__munna_guard) {
        window.history.pushState(
          { __munna_guard: true, screen: activeScreenRef.current },
          '',
          window.location.href
        );
      }
    } catch {}
  };

  // Helper to remove ?item= from current URL cleanly without page reload
  const removeUrlItemParam = () => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('item')) {
        url.searchParams.delete('item');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    } catch {
      // Ignore
    }
  };

  const handleBackAction = (): boolean => {
    const now = Date.now();
    // Debounce rapid duplicate events (e.g. Capacitor backButton + browser popstate firing in the same tick)
    if (now - lastActionTimeRef.current < 250) {
      return true;
    }
    lastActionTimeRef.current = now;

    // 1. Close any global modal / popup / alert
    if (incomingOrderAlertRef.current && setIncomingOrderAlert) {
      setIncomingOrderAlert(null);
      ensureHistoryGuard();
      return true;
    }
    if (showScannerRef.current && setShowScanner) {
      setShowScanner(false);
      ensureHistoryGuard();
      return true;
    }
    if (showPermissionModalRef.current && setShowPermissionModal) {
      setShowPermissionModal(false);
      ensureHistoryGuard();
      return true;
    }
    if (showPaymentPolicyModalRef.current && setShowPaymentPolicyModal) {
      setShowPaymentPolicyModal(false);
      ensureHistoryGuard();
      return true;
    }
    if (showAdminPinModalRef.current && setShowAdminPinModal) {
      setShowAdminPinModal(false);
      ensureHistoryGuard();
      return true;
    }
    if (showLoginModalRef.current && setShowLoginModal) {
      setShowLoginModal(false);
      ensureHistoryGuard();
      return true;
    }

    // 2. Close Product Detail modal if open
    if (selectedProductRef.current) {
      setSelectedProduct(null);
      removeUrlItemParam();
      ensureHistoryGuard();
      return true;
    }

    // 3. Check registered inner-screen handlers (e.g., Cart UPI QR -> Select Payment -> Cart)
    for (let i = customBackHandlers.length - 1; i >= 0; i--) {
      try {
        const handled = customBackHandlers[i]();
        if (handled) {
          ensureHistoryGuard();
          return true;
        }
      } catch (e) {
        // Ignore handler error
      }
    }

    // 4. CRITICAL: If on ANY non-home page (Cart, Orders, Address, Profile, Wishlist, Admin),
    // ALWAYS return to MAIN HOME PAGE. NEVER EXIT or show exit toast from here!
    if (activeScreenRef.current !== 'home') {
      setActiveScreen('home');
      try {
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      } catch (e) {}
      lastBackPressTimeRef.current = 0; // Reset exit timer
      ensureHistoryGuard();
      return true;
    }

    // 5. On Home screen: if search query or category filter is active, clear it first
    if (searchQueryRef.current && searchQueryRef.current.trim() !== '' && setSearchQuery) {
      setSearchQuery('');
      ensureHistoryGuard();
      return true;
    }
    if (activeCategoryRef.current && activeCategoryRef.current !== 'All' && setActiveCategory) {
      setActiveCategory('All');
      ensureHistoryGuard();
      return true;
    }

    // 6. ONLY on clean Home screen root: Double-press within 2.5 seconds to exit/close
    if (now - lastBackPressTimeRef.current < 2500) {
      if (Capacitor.isNativePlatform()) {
        CapApp.exitApp();
      } else {
        try {
          window.close();
        } catch (e) {}
      }
      return false;
    } else {
      lastBackPressTimeRef.current = now;
      showExitToast('Press back again to exit (ଆପ୍ ବନ୍ଦ କରିବା ପାଇଁ ପୁଣି ଥରେ Back ଦବାନ୍ତୁ)');
      ensureHistoryGuard();
      return true;
    }
  };

  useEffect(() => {
    let capListener: any = null;

    // Push initial history guard so browser popstate can always be caught
    ensureHistoryGuard();

    // In Capacitor native app, listen to Capacitor backButton
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('backButton', () => {
        handleBackAction();
      })
        .then((handle) => {
          capListener = handle;
        })
        .catch((e) => {
          console.warn('Capacitor backButton listener failed:', e);
        });
    }

    // Mobile browser popstate handler
    const onPopState = () => {
      handleBackAction();
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      if (capListener && typeof capListener.remove === 'function') {
        capListener.remove();
      }
    };
  }, []);
};
