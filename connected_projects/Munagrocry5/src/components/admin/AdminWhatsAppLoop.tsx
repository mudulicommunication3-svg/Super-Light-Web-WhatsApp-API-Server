import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  MessageSquare,
  Play,
  Pause,
  RefreshCw,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Link2,
  Database,
  ArrowRight,
  ShieldCheck,
  Zap,
  Radio,
  Sliders,
  Send,
  Eye,
  EyeOff,
  ShieldAlert,
  CheckSquare,
  Square,
  Cloud,
  CloudOff,
  Search,
  Filter,
  Check,
  Sun,
  Lock,
  Layers,
  FolderTree,
  Tag,
  DollarSign,
  PackageCheck,
  PlusCircle
} from 'lucide-react';
import {
  fetchWaSettings,
  saveWaSettings,
  getStoredWaSettings,
  setStoredWaSettings,
  triggerWaInstantAutoSend,
  checkSheetChangesEvery5MinAndForward,
  sendWaLoopMessage,
  editWaLoopMessage,
  fetchWaSentLogFromSheet,
  getWaSentMessageMap,
  testWaServerConnection,
  toggleCloudTrigger,
  getCloudTriggerInfo,
  fixAndForceRefreshWhatsAppLinkCache,
  WaConfigSettings,
  DEFAULT_WA_SETTINGS,
  getWebhookUrl,
  getGoogleSheetId
} from '../../services/api';
import { getProductBestShareImage, getPrimaryCleanEan, getSiteDomain, getDynamicShareUrl } from '../../utils/shareUtils';
import { showToast } from '../Toast';
import { Product } from '../../types';

export const AdminWhatsAppLoop: React.FC = () => {
  const { catalog, setCatalog, shopConfig } = useApp();
  const { isEnglish } = useLanguage();

  // Cache fix state
  const [isFixingPreviewCache, setIsFixingPreviewCache] = useState(false);

  const handleFixPreviewCache = async () => {
    setIsFixingPreviewCache(true);
    try {
      const res = await fixAndForceRefreshWhatsAppLinkCache(catalog);
      if (res.updatedProducts && res.updatedProducts.length > 0) {
        setCatalog(res.updatedProducts);
      }
      if (activeProduct) {
        setActivePureLink(getDynamicShareUrl(activeProduct, activeProduct.selling_price, res.versionTag));
      }
      showToast(
        isEnglish
          ? `✅ Synced Google Sheet & Reset All ${res.totalProducts} Product Links (v=${res.versionTag})!`
          : `✅ Google Sheet ରୁ ଲାଇଭ୍ ତଥ୍ୟ ଆସିଲା ଏବଂ ସମସ୍ତ ${res.totalProducts} ଟି ଲିଙ୍କ୍ ରିସେଟ୍ ହେଲା (v=${res.versionTag})!`
      );
    } catch {
      showToast('Error refreshing WhatsApp link cache');
    } finally {
      setIsFixingPreviewCache(false);
    }
  };

  // Settings State (Initialized from localStorage + synced with WA_Config sheet)
  const [settings, setSettings] = useState<WaConfigSettings>(() => getStoredWaSettings());
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [testingRule, setTestingRule] = useState<string | null>(null);
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [serverStatusText, setServerStatusText] = useState('Checking Baileys Server...');

  // Cloud Trigger State
  const [cloudActive, setCloudActive] = useState(false);
  const [cloudLastRun, setCloudLastRun] = useState<string>('Never');
  const [isTogglingCloud, setIsTogglingCloud] = useState(false);

  // Selection & Search State
  const [selectedEans, setSelectedEans] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [queueFilter, setQueueFilter] = useState<'all' | 'selected' | 'instock' | 'outofstock'>('all');
  const [wakeLockActive, setWakeLockActive] = useState(false);

  // Loop Controller State (Persisted in localStorage so Queue #1 is not repeated on tab switch/reload)
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    try {
      const saved = parseInt(localStorage.getItem('munna_wa_loop_current_index') || '0', 10);
      return Number.isFinite(saved) && saved >= 0 ? saved : 0;
    } catch {
      return 0;
    }
  });
  const [isLooping, setIsLooping] = useState(false);
  const [loopDelay, setLoopDelay] = useState(6);
  const [countdown, setCountdown] = useState(0);
  const [autoRefreshLink, setAutoRefreshLink] = useState(true);
  const [infiniteLoop, setInfiniteLoop] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('munna_wa_loop_infinite_mode');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [quickRecipientOverride, setQuickRecipientOverride] = useState('');
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [isCheckingSheetDiff, setIsCheckingSheetDiff] = useState(false);

  const updateAndPersistIndex = (nextIdx: number) => {
    setCurrentIndex(nextIdx);
    try {
      localStorage.setItem('munna_wa_loop_current_index', String(nextIdx));
    } catch {}
  };

  // Activity Log Terminal
  const [logs, setLogs] = useState<Array<{ id: string; time: string; text: string; type: 'info' | 'success' | 'error' | 'wait' }>>([
    {
      id: 'init-1',
      time: new Date().toTimeString().split(' ')[0],
      text: 'WhatsApp Baileys Auto-Loop engine initialized.',
      type: 'info'
    }
  ]);

  const loopTimerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);
  const isLoopingRef = useRef(isLooping);
  isLoopingRef.current = isLooping;
  const infiniteLoopRef = useRef(infiniteLoop);
  infiniteLoopRef.current = infiniteLoop;
  const autoRefreshLinkRef = useRef(autoRefreshLink);
  autoRefreshLinkRef.current = autoRefreshLink;
  const loopDelayRef = useRef(loopDelay);
  loopDelayRef.current = loopDelay;
  const wakeLockRef = useRef<any>(null);

  const appendLog = (text: string, type: 'info' | 'success' | 'error' | 'wait' = 'info') => {
    const time = new Date().toTimeString().split(' ')[0];
    setLogs((prev) => [...prev.slice(-90), { id: `${Date.now()}-${Math.random()}`, time, text, type }]);
  };

  // Initialize product selection with all catalog EANs by default
  useEffect(() => {
    if (catalog.length > 0 && selectedEans.size === 0) {
      const allEans = new Set<string>();
      catalog.forEach((p) => {
        const ean = getPrimaryCleanEan(p);
        if (ean) allEans.add(ean);
      });
      setSelectedEans(allEans);
    }
  }, [catalog]);

  // Initial Load of WA_Config and Cloud Trigger Status + Live Event Auto-Send Listener
  useEffect(() => {
    loadSettingsFromSheet();
    checkServerHealth();
    checkCloudStatus();
    fetchWaSentLogFromSheet().catch(() => {});

    const handleAutoSendLog = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (!detail) return;
      const statusText = detail.ok
        ? `✅ Instant Auto-Send [${detail.eventLabel}] Sent "${detail.product?.product_name}" (${detail.detailText}) ➔ ${detail.recipient}`
        : `⚠️ Instant Auto-Send [${detail.eventLabel}] Failed for "${detail.product?.product_name}": ${detail.message}`;
      appendLog(statusText, detail.ok ? 'success' : 'error');
    };

    const handleSettingsSync = (ev: Event) => {
      const updated = (ev as CustomEvent)?.detail;
      if (updated && typeof updated === 'object') {
        setSettings((prev) => ({ ...prev, ...updated }));
      }
    };

    window.addEventListener('munna_wa_autosend_log', handleAutoSendLog);
    window.addEventListener('munna_wa_settings_updated', handleSettingsSync);
    return () => {
      window.removeEventListener('munna_wa_autosend_log', handleAutoSendLog);
      window.removeEventListener('munna_wa_settings_updated', handleSettingsSync);
    };
  }, []);

  const handleToggleEventRule = async (
    key: 'AUTO_SEND_NEW_PRODUCTS' | 'AUTO_SEND_RESTOCKED_PRODUCTS' | 'AUTO_SEND_PRICE_CHANGED_PRODUCTS' | 'GROUP_BY_CATEGORY',
    checked: boolean,
    label: string
  ) => {
    const nextSettings: WaConfigSettings = {
      ...settings,
      [key]: checked,
      DEFAULT_LOOP_DELAY_SEC: loopDelay
    };
    setSettings(nextSettings);
    setStoredWaSettings(nextSettings, true);
    appendLog(`⚡ Toggle Rule [${label}] (${key}) set to: ${checked ? 'ON ✅' : 'OFF ⚪'} — Syncing to Sheet...`, 'info');
    showToast(
      isEnglish
        ? `✅ ${label}: ${checked ? 'ON (Active & Saved)' : 'OFF'}`
        : `✅ ${label}: ${checked ? 'ON (ଚାଲୁ ଓ ସେଭ୍ ହେଲା)' : 'OFF (ବନ୍ଦ ହେଲା)'}`
    );
    try {
      await saveWaSettings(nextSettings);
    } catch (e) {}
  };

  const handleTestEventRule = async (eventType: 'new_product' | 'restocked' | 'price_changed') => {
    const targetProd = activeProduct || catalog[0];
    if (!targetProd) {
      showToast('No product available to test');
      return;
    }
    setTestingRule(eventType);
    appendLog(`🧪 Testing Instant Auto-Send (${eventType}) with "${targetProd.product_name}" (Rs.${targetProd.selling_price})...`, 'info');
    try {
      await triggerWaInstantAutoSend(
        eventType,
        targetProd,
        `Test Dispatch (Rs.${targetProd.selling_price}, Stock: ${targetProd.stock_qty})`,
        true
      );
    } finally {
      setTestingRule(null);
    }
  };

  const loadSettingsFromSheet = async () => {
    setIsLoadingSettings(true);
    appendLog('Reading dynamic configuration from "WA_Config" sheet tab...', 'info');
    try {
      const data = await fetchWaSettings();
      setSettings(data);
      setLoopDelay(data.DEFAULT_LOOP_DELAY_SEC || 6);
      appendLog(`Loaded WA_Config: Session="${data.SESSION_ID}", Recipient="${data.DEFAULT_RECIPIENT}"`, 'success');
    } catch (e: any) {
      appendLog('Failed to read WA_Config: ' + e?.message, 'error');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const checkCloudStatus = async () => {
    try {
      const info = await getCloudTriggerInfo();
      if (info.ok) {
        setCloudActive(!!info.active);
        setCloudLastRun(info.lastRun || 'Never');
      }
    } catch (e) {}
  };

  const handleToggleCloud = async (enable: boolean) => {
    setIsTogglingCloud(true);
    appendLog(`Sending Cloud Trigger ${enable ? 'activation' : 'deactivation'} request to Google Cloud...`, 'info');
    try {
      const res = await toggleCloudTrigger(enable);
      if (res.ok) {
        setCloudActive(enable);
        showToast(enable ? '☁️ Cloud 24/7 Auto-Loop Activated!' : '⏸️ Cloud 24/7 Auto-Loop Stopped!');
        appendLog(res.message || (enable ? 'Cloud trigger active' : 'Cloud trigger stopped'), 'success');
      } else {
        showToast(res.message || 'Trigger action failed');
        appendLog('Cloud trigger error: ' + res.message, 'error');
      }
    } catch (e: any) {
      appendLog('Cloud trigger exception: ' + e?.message, 'error');
    } finally {
      setIsTogglingCloud(false);
      checkCloudStatus();
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    appendLog('Writing updated credentials and event triggers to "WA_Config" sheet tab...', 'info');
    try {
      const updated = {
        ...settings,
        DEFAULT_LOOP_DELAY_SEC: loopDelay
      };
      const res = await saveWaSettings(updated);
      if (res.ok) {
        showToast(isEnglish ? '✅ Settings saved to "WA_Config" tab!' : '✅ ସେଟିଂସ୍ "WA_Config" ଟ୍ୟାବ୍‌ରେ ସେଭ୍ ହେଲା!');
        appendLog('✅ Saved and verified with Google Sheet WA_Config tab.', 'success');
        checkServerHealth();
      } else {
        showToast(res.message);
        appendLog('Sheet update warning: ' + res.message, 'error');
      }
    } catch (err: any) {
      showToast('Error saving settings');
      appendLog('Error saving settings: ' + err?.message, 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const checkServerHealth = async () => {
    setServerStatus('checking');
    setServerStatusText('Checking Baileys Server...');
    try {
      const res = await testWaServerConnection();
      if (res.ok) {
        setServerStatus('online');
        setServerStatusText(`Online (HTTP ${res.statusCode || 200})`);
        appendLog(`Baileys gateway server online: ${settings.RENDER_BASE_URL}`, 'success');
      } else {
        setServerStatus('offline');
        setServerStatusText('Sleeping / Reconnecting...');
        appendLog('Render server may be spinning up from free-tier sleep. It will answer on request.', 'wait');
      }
    } catch (e) {
      setServerStatus('offline');
      setServerStatusText('Server check timed out');
    }
  };

  // Selection Helper Functions
  const handleToggleSelectProduct = (ean: string) => {
    setSelectedEans((prev) => {
      const next = new Set(prev);
      if (next.has(ean)) {
        next.delete(ean);
      } else {
        next.add(ean);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const next = new Set<string>();
    catalog.forEach((p) => {
      const ean = getPrimaryCleanEan(p);
      if (ean) next.add(ean);
    });
    setSelectedEans(next);
    showToast(isEnglish ? '✅ Selected all products' : '✅ ସମସ୍ତ ପ୍ରୋଡକ୍ଟ ସିଲେକ୍ଟ ହେଲା');
  };

  const handleDeselectAll = () => {
    setSelectedEans(new Set());
    showToast(isEnglish ? '🧹 Deselected all products' : '🧹 ସମସ୍ତ ପ୍ରୋଡକ୍ଟ ଅନ-ସିଲେକ୍ଟ ହେଲା');
  };

  const handleSelectInStockOnly = () => {
    const next = new Set<string>();
    catalog.forEach((p) => {
      const stock = typeof p.stock_qty === 'number' ? p.stock_qty : parseInt(String(p.stock_qty || '0'), 10);
      if (stock > 0) {
        const ean = getPrimaryCleanEan(p);
        if (ean) next.add(ean);
      }
    });
    setSelectedEans(next);
    showToast(isEnglish ? '✅ Selected in-stock items' : '✅ ଷ୍ଟକ୍ ଥିବା ପ୍ରୋଡକ୍ଟ ସିଲେକ୍ଟ ହେଲା');
  };

  // Filtered & Category-Grouped Queue Products for Auto-Loop & Showcase
  const queueProducts = useMemo(() => {
    const list = catalog.filter((p) => {
      const ean = getPrimaryCleanEan(p);
      // Selection check: If selectedEans is not empty, check membership
      if (selectedEans.size > 0 && !selectedEans.has(ean)) {
        return false;
      }
      // Stock check
      if (onlyInStock) {
        const stock = typeof p.stock_qty === 'number' ? p.stock_qty : parseInt(String(p.stock_qty || '0'), 10);
        if (stock <= 0) return false;
      }
      return true;
    });

    // Category-wise Sequential Grouping
    if (settings.GROUP_BY_CATEGORY) {
      return [...list].sort((a, b) => {
        const catA = (a.category || 'General').toLowerCase();
        const catB = (b.category || 'General').toLowerCase();
        if (catA < catB) return -1;
        if (catA > catB) return 1;
        return 0;
      });
    }

    return list;
  }, [catalog, selectedEans, onlyInStock, settings.GROUP_BY_CATEGORY]);

  // Display Products for Queue Selector Table (Search & Filtered)
  const displayCatalogProducts = useMemo(() => {
    const list = catalog.filter((p) => {
      const ean = getPrimaryCleanEan(p);
      const stock = typeof p.stock_qty === 'number' ? p.stock_qty : parseInt(String(p.stock_qty || '0'), 10);

      if (queueFilter === 'selected' && !selectedEans.has(ean)) return false;
      if (queueFilter === 'instock' && stock <= 0) return false;
      if (queueFilter === 'outofstock' && stock > 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (p.product_name || '').toLowerCase().includes(q);
        const catMatch = (p.category || '').toLowerCase().includes(q);
        const eanMatch = ean.toLowerCase().includes(q);
        if (!nameMatch && !catMatch && !eanMatch) return false;
      }

      return true;
    });

    if (settings.GROUP_BY_CATEGORY) {
      return [...list].sort((a, b) => {
        const catA = (a.category || 'General').toLowerCase();
        const catB = (b.category || 'General').toLowerCase();
        if (catA < catB) return -1;
        if (catA > catB) return 1;
        return 0;
      });
    }

    return list;
  }, [catalog, selectedEans, queueFilter, searchQuery, settings.GROUP_BY_CATEGORY]);

  const queueProductsRef = useRef<Product[]>(queueProducts);
  queueProductsRef.current = queueProducts;

  const activeProduct = queueProducts[currentIndex] || queueProducts[0];

  // Helper to generate the exact pure link for a product with live price, MRP, stock & cache-buster token
  const getProductPureLink = (prod: Product, customTimeHash?: string) => {
    if (!prod) return '';
    return getDynamicShareUrl(prod, prod.selling_price, customTimeHash);
  };

  const [activePureLink, setActivePureLink] = useState(() => getProductPureLink(activeProduct));

  useEffect(() => {
    if (activeProduct) {
      setActivePureLink(getProductPureLink(activeProduct));
    }
  }, [currentIndex, activeProduct?.ean, activeProduct?.selling_price, activeProduct?.mrp, activeProduct?.stock_qty]);

  // Screen Wake Lock API handling
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        setWakeLockActive(true);
        appendLog('🟢 Screen Wake Lock acquired (Prevents browser/screen sleep)', 'info');
      } catch (err) {
        setWakeLockActive(false);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (e) {}
    }
    setWakeLockActive(false);
  };

  const handleRefreshLinkToken = () => {
    if (!activeProduct) return;
    const freshToken = `${activeProduct.selling_price}_${Date.now().toString(36).slice(-5)}`;
    const freshLink = getProductPureLink(activeProduct, freshToken);
    setActivePureLink(freshLink);
    appendLog(`🔄 Generated fresh cache-buster token for "${activeProduct.product_name}" (token: ${freshToken})`, 'info');
    showToast(isEnglish ? '🔄 Refreshed link cache token!' : '🔄 ନୂଆ ଲିଙ୍କ୍ କ୍ୟାଚ୍ ଟୋକନ୍ ପ୍ରସ୍ତୁତ ହେଲା!');
  };

  const handleCopyLink = () => {
    if (!activePureLink) return;
    navigator.clipboard.writeText(activePureLink);
    setCopiedLink(true);
    showToast(isEnglish ? '🔗 Pure link copied!' : '🔗 ଲିଙ୍କ୍ କପି ହେଲା!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Start Loop (Continues from saved queue index so #1 is not repeated unnecessarily)
  const handleStartLoop = () => {
    const activeQueue = queueProductsRef.current;
    if (activeQueue.length === 0) {
      showToast('No selected products in loop queue');
      return;
    }
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setIsLooping(true);
    isLoopingRef.current = true;
    requestWakeLock();
    const safeIdx = currentIndex >= activeQueue.length || currentIndex < 0 ? 0 : currentIndex;
    if (safeIdx !== currentIndex) updateAndPersistIndex(0);
    appendLog(
      `▶️ Auto-loop started from Queue #${safeIdx + 1}! Mode: ${infiniteLoopRef.current ? 'Repeat All Selected' : 'Once All Selected'} | Recipient: ${settings.DEFAULT_RECIPIENT} (${activeQueue.length} selected items, Delay: ${loopDelayRef.current}s)`,
      'success'
    );
    dispatchItemAndScheduleNext(safeIdx);
  };

  // Pause Loop
  const handlePauseLoop = () => {
    setIsLooping(false);
    isLoopingRef.current = false;
    releaseWakeLock();
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setCountdown(0);
    appendLog('⏸️ Auto-loop paused by user.', 'wait');
    showToast(isEnglish ? '⏸️ Auto-loop paused' : '⏸️ ଲୁପ୍ ପଜ୍ (Pause) ରଖାଗଲା');
  };

  // Stop Loop (Stops completely and resets queue index back to #1)
  const handleStopLoop = () => {
    setIsLooping(false);
    isLoopingRef.current = false;
    releaseWakeLock();
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setCountdown(0);
    updateAndPersistIndex(0);
    appendLog('⏹️ Auto-loop stopped and reset to Queue #1.', 'wait');
    showToast(isEnglish ? '⏹️ Loop stopped & reset to #1' : '⏹️ ଲୁପ୍ ବନ୍ଦ ହେଲା ଓ #1 କୁ ରିସେଟ୍ ହେଲା');
  };

  // Restart Loop (Resets queue back to #1 and starts sending immediately)
  const handleRestartLoop = () => {
    const activeQueue = queueProductsRef.current;
    if (activeQueue.length === 0) {
      showToast('No selected products in loop queue');
      return;
    }
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setCountdown(0);
    updateAndPersistIndex(0);
    setIsLooping(true);
    isLoopingRef.current = true;
    requestWakeLock();
    appendLog(
      `🔄 Auto-loop restarted from Queue #1! Mode: ${infiniteLoopRef.current ? 'Repeat All Selected' : 'Once All Selected'} (${activeQueue.length} items)`,
      'success'
    );
    showToast(
      isEnglish
        ? '🔄 Loop restarted from #1!'
        : '🔄 #1 ରୁ ଲୁପ୍ ପୁଣି ଥରେ ଆରମ୍ଭ ହେଲା (Restarted)!'
    );
    dispatchItemAndScheduleNext(0);
  };

  const dispatchItemAndScheduleNext = async (targetIndex: number) => {
    if (!isLoopingRef.current) return;

    const activeQueue = queueProductsRef.current;
    if (!activeQueue || activeQueue.length === 0) return;

    const validIndex = targetIndex >= activeQueue.length || targetIndex < 0 ? 0 : targetIndex;
    const prod = activeQueue[validIndex];
    if (!prod) return;

    // Immediately advance and persist the next index so pausing/tab-switching never repeats this item
    const upcomingIndex = validIndex + 1;
    if (upcomingIndex < activeQueue.length) {
      try {
        localStorage.setItem('munna_wa_loop_current_index', String(upcomingIndex));
      } catch {}
    } else {
      try {
        localStorage.setItem('munna_wa_loop_current_index', '0');
      } catch {}
    }

    // Build fresh pure link if autoRefresh is enabled
    const timeToken = autoRefreshLinkRef.current ? `${prod.selling_price}_${Date.now().toString(36).slice(-5)}` : undefined;
    const pureLinkToSend = getProductPureLink(prod, timeToken);
    setActivePureLink(pureLinkToSend);

    const recipient = quickRecipientOverride.trim() || settings.DEFAULT_RECIPIENT;

    appendLog(`[${validIndex + 1}/${activeQueue.length}] [Category: ${prod.category || 'General'}] Sending pure link for: "${prod.product_name}"`, 'info');

    const directCfg = {
      baseUrl: settings.RENDER_BASE_URL,
      sessionId: settings.SESSION_ID,
      bearerToken: settings.API_BEARER_TOKEN
    };

    try {
      const pKey = targetProduct ? getPrimaryCleanEan(targetProduct) : undefined;
      const res = await sendWaLoopMessage(
        pureLinkToSend,
        recipient,
        directCfg,
        pKey,
        targetProduct ? targetProduct.selling_price : undefined,
        targetProduct ? targetProduct.stock_qty : undefined
      );
      if (res.isPermissionError) {
        setHasPermissionError(true);
      }
      if (res.ok) {
        const msgIdStr = res.messageId ? ` MsgID: ${res.messageId}` : '';
        appendLog(`✅ Dispatched successfully! (HTTP ${res.statusCode || 200})${msgIdStr} Recipient: ${recipient}`, 'success');
      } else {
        appendLog(`⚠️ Send error: ${res.message || 'Request failed'}. Moving to next item.`, 'error');
      }
    } catch (err: any) {
      appendLog(`❌ Dispatch exception: ${err?.message}`, 'error');
    }

    if (!isLoopingRef.current) return;

    const latestQueueLen = queueProductsRef.current.length || activeQueue.length;
    let nextIndex = validIndex + 1;
    if (nextIndex >= latestQueueLen) {
      if (infiniteLoopRef.current) {
        appendLog('🔁 Reached end of selected queue. Repeating all selected items from #1...', 'info');
        nextIndex = 0;
      } else {
        appendLog('🎉 Completed Once All Selected Send! Auto-stopping loop.', 'success');
        setIsLooping(false);
        isLoopingRef.current = false;
        setCountdown(0);
        updateAndPersistIndex(0);
        releaseWakeLock();
        showToast(
          isEnglish
            ? '✅ Sent all selected products once! Loop finished.'
            : '✅ ସମସ୍ତ ସିଲେକ୍ଟ ପ୍ରଡକ୍ଟ ଥରେ ପଠାଗଲା! ଲୁପ୍ ସମ୍ପୂର୍ଣ୍ଣ ହେଲା।'
        );
        return;
      }
    }

    updateAndPersistIndex(nextIndex);

    // Schedule countdown delay
    const activeDelay = loopDelayRef.current || 6;
    setCountdown(activeDelay);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    let secLeft = activeDelay;
    countdownTimerRef.current = setInterval(() => {
      secLeft -= 1;
      setCountdown(Math.max(0, secLeft));
      if (secLeft <= 0) {
        clearInterval(countdownTimerRef.current);
      }
    }, 1000);

    loopTimerRef.current = setTimeout(() => {
      if (isLoopingRef.current) {
        dispatchItemAndScheduleNext(nextIndex);
      }
    }, activeDelay * 1000);
  };

  const handleSendSingleItem = async (prodToSend?: Product) => {
    const target = prodToSend || activeProduct;
    if (!target) return;
    const recipient = quickRecipientOverride.trim() || settings.DEFAULT_RECIPIENT;
    const targetLink = getProductPureLink(target);
    appendLog(`Manual single test dispatch for "${target.product_name}" to: ${recipient}`, 'info');
    const directCfg = {
      baseUrl: settings.RENDER_BASE_URL,
      sessionId: settings.SESSION_ID,
      bearerToken: settings.API_BEARER_TOKEN
    };
    try {
      const pKey = getPrimaryCleanEan(target);
      const res = await sendWaLoopMessage(
        targetLink,
        recipient,
        directCfg,
        pKey,
        target.selling_price,
        target.stock_qty
      );
      if (res.isPermissionError) {
        setHasPermissionError(true);
      }
      if (res.ok) {
        const msgIdStr = res.messageId ? ` (MsgID: ${res.messageId})` : '';
        appendLog(`✅ Single link sent! (HTTP ${res.statusCode || 200})${msgIdStr}`, 'success');
        showToast(isEnglish ? `✅ Product link sent!${msgIdStr}` : `✅ ପ୍ରୋଡକ୍ଟ ଲିଙ୍କ୍ ପଠାଗଲା!${msgIdStr}`);
      } else {
        appendLog(`❌ Failed: ${res.message}`, 'error');
        showToast(res.message || 'Send failed');
      }
    } catch (e: any) {
      showToast('Error sending message');
    }
  };

  const handleEditPostNow = async (targetProduct?: any) => {
    const target = targetProduct || currentProduct;
    if (!target) return;
    const pKey = getPrimaryCleanEan(target);
    const sentMap = getWaSentMessageMap();
    const existing = sentMap[pKey];
    if (!existing || !existing.messageId) {
      showToast(isEnglish ? 'No message ID found in Sheet/Logs. Please send first.' : 'ଶିଟ୍‌ରେ କୌଣସି ପୂର୍ବ Message ID ମିଳିଲା ନାହିଁ। ଦୟାକରି ପ୍ରଥମେ ସେଣ୍ଡ କରନ୍ତୁ।');
      return;
    }
    const freshToken = `${target.selling_price}_s${target.stock_qty}_${Date.now().toString(36).slice(-5)}`;
    const pureLink = getDynamicShareUrl(target, target.selling_price, freshToken);
    const recipient = quickRecipientOverride.trim() || existing.recipient || settings.DEFAULT_RECIPIENT;
    const directCfg = {
      baseUrl: settings.RENDER_BASE_URL,
      sessionId: settings.SESSION_ID,
      bearerToken: settings.API_BEARER_TOKEN
    };
    appendLog(`✏️ Editing live WhatsApp post for "${target.product_name}" (MsgID: ${existing.messageId})...`, 'info');
    try {
      const res = await editWaLoopMessage(
        existing.messageId,
        pureLink,
        recipient,
        directCfg,
        pKey,
        target.selling_price,
        target.stock_qty
      );
      if (res.ok) {
        const finalId = res.messageId || existing.messageId;
        appendLog(`✅ WhatsApp post updated successfully! MsgID: ${finalId}`, 'success');
        showToast(isEnglish ? '✅ WhatsApp post updated!' : '✅ ହ୍ୱାଟ୍ସଆପ୍ ପୋଷ୍ଟ ସଫଳତାର ସହିତ ଅପଡେଟ୍ ହେଲା!');
      } else {
        appendLog(`❌ Edit failed: ${res.message}`, 'error');
        showToast(res.message || 'Edit failed');
      }
    } catch (err: any) {
      appendLog(`❌ Edit exception: ${err?.message}`, 'error');
      showToast('Error editing post');
    }
  };

  const webAppUrl = getWebhookUrl();
  const webAppLoopUrl = `${webAppUrl}${webAppUrl.includes('?') ? '&' : '?'}page=loop`;

  return (
    <div className="space-y-5 animate-in fade-in duration-200 font-sans">
      
      {/* Top Banner & Quick Links */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-4 sm:p-5 rounded-3xl border border-emerald-500/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg shadow-emerald-500/20 shrink-0">
            📲
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                WhatsApp Baileys Auto-Loop Broadcaster
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                Pure Link Mode
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {isEnglish
                ? 'Loop-shares pure product links to WhatsApp Channels (@newsletter), Groups (@g.us), or Phone numbers with automatic rich preview.'
                : 'ୱାଟ୍ସଆପ୍ ଚ୍ୟାନେଲ୍, ଗ୍ରୁପ୍ ବା ମୋବାଇଲ୍‌କୁ ସ୍ୱୟଂଚାଳିତ ଭାବେ ଲାଇଭ୍ ଫଟୋ ଓ ଦର ସହ ପ୍ରୋଡକ୍ଟ ଲିଙ୍କ୍ ପଠାନ୍ତୁ।'}
            </p>
          </div>
        </div>

        {/* Server & External Links */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-xl font-mono">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                serverStatus === 'online'
                  ? 'bg-emerald-400 animate-pulse'
                  : serverStatus === 'checking'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-200 font-bold">{serverStatusText}</span>
          </div>

          <button
            onClick={handleFixPreviewCache}
            disabled={isFixingPreviewCache}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-transform active:scale-95 shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
            title="Forces WhatsApp to invalidate its link preview cache by pushing caption format to Config tab and generating a new version tag"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFixingPreviewCache ? 'animate-spin' : ''}`} />
            <span>{isFixingPreviewCache ? 'Fixing Preview...' : '⚡ Fix Preview Cache'}</span>
          </button>

          <a
            href={webAppLoopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-transform active:scale-95 shadow-xs"
            title="Open standalone Google Apps Script Web App in a new window"
          >
            <span>🚀 Apps Script Web App</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <a
            href="/google-apps-script/Index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
            title="Open local Index.html control page"
          >
            <span>📄 Index.html</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={() => setHasPermissionError(!hasPermissionError)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer ${
              hasPermissionError
                ? 'bg-amber-400 text-slate-950 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-400/30'
            }`}
            title="Google Apps Script UrlFetchApp permission guide"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>🔑 Auth Guide</span>
          </button>

          <button
            onClick={() => setShowConfigDrawer(!showConfigDrawer)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer ${
              showConfigDrawer
                ? 'bg-amber-400 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/40'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>⚙️ WA_Config Sheet</span>
          </button>
        </div>
      </div>

      {/* 24/7 CLOUD BACKGROUND TRIGGER CARD & BACKGROUND SLEEP EXPLANATION */}
      <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-3xl p-5 text-white shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-indigo-500/30 shrink-0">
              ☁️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  Google Cloud 24/7 Background Auto-Loop (Always-On Mode)
                </h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  cloudActive
                    ? 'bg-emerald-400 text-slate-950 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {cloudActive ? '🟢 Active 24/7 on Cloud' : '⚪ Inactive (Browser Mode)'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {isEnglish
                  ? 'Runs on Google Cloud Servers every 1 minute — keeps sending products automatically even if phone is OFF or browser is closed!'
                  : 'ଗୁଗୁଲ୍ କ୍ଲାଉଡ୍ ସର୍ଭରରେ ଚାଲେ — ଆପଣଙ୍କ ଫୋନ୍/ବ୍ରାଉଜର୍ ବନ୍ଦ ଥିଲେ ମଧ୍ୟ ସ୍ୱୟଂଚାଳିତ ଭାବେ WhatsApp ରେ ପ୍ରୋଡକ୍ଟ ଲିଙ୍କ୍ ପଠାଏ!'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleToggleCloud(!cloudActive)}
              disabled={isTogglingCloud}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 active:scale-95 ${
                cloudActive
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white ring-2 ring-indigo-400/50'
              }`}
            >
              {isTogglingCloud ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : cloudActive ? (
                <CloudOff className="w-4 h-4" />
              ) : (
                <Cloud className="w-4 h-4" />
              )}
              <span>
                {isTogglingCloud
                  ? 'Updating Cloud...'
                  : cloudActive
                  ? '⏹️ Stop 24/7 Cloud Loop'
                  : '▶️ Enable 24/7 Cloud Loop'}
              </span>
            </button>
          </div>
        </div>

        {/* Technical Explanation in Odia for Background Sleep Solution */}
        <div className="bg-slate-950/80 rounded-2xl p-4 border border-indigo-500/20 text-xs space-y-2 text-slate-300 leading-relaxed font-sans">
          <p className="font-bold text-indigo-300 flex items-center gap-1.5">
            <Sun className="w-4 h-4 text-amber-400" />
            <span>💡 ଫୋନ୍ / ବ୍ରାଉଜର୍ ବନ୍ଦ ହେଲେ ଲୁପ୍ ଅଟକିବ ନାହିଁ — ଏହା କିପରି କାମ କରେ? (Odia Explanation)</span>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="font-extrabold text-amber-300 block">📱 1. ୱେବସାଇଟ୍ / ବ୍ରାଉଜର୍ ସୀମା (Browser Sleep):</span>
              <p className="text-[11px] text-slate-300">
                ମୋବାଇଲ୍ ସ୍କ୍ରିନ୍ ଅଫ୍ ହେଲେ କିମ୍ବା ବ୍ରାଉଜର୍ ବ୍ୟାକଗ୍ରାଉଣ୍ଡକୁ ଗଲେ Chrome/Safari ଜାଭାସ୍କ୍ରିପ୍ଟ ଟାଇମର୍ କୁ ସ୍ପୀଡ୍ କମାଇଦିଏ। ଆମେ **Screen WakeLock API** ଯୋଡ଼ିଛୁ ଯାହା ସ୍କ୍ରିନ୍ ଅନ୍ ଥିବା ପର୍ଯ୍ୟନ୍ତ ବ୍ରାଉଜରକୁ ଶୋଇବାକୁ ଦିଏନାହିଁ।
              </p>
            </div>
            <div className="bg-slate-900/90 p-3 rounded-xl border border-indigo-500/30 space-y-1">
              <span className="font-extrabold text-emerald-300 block">☁️ 2. ସ୍ପେଶାଲ୍ Google Cloud 24/7 Trigger (ସର୍ବୋତ୍ତମ ସମାଧାନ):</span>
              <p className="text-[11px] text-slate-300">
                ଉପରେ ଥିବା **"Enable 24/7 Cloud Loop"** ଦବାଇଲେ, Google Cloud ସର୍ଭରରେ `Cron Time Trigger` ଚାଲୁ ହୋଇଯାଏ। ଏହା ଗୁଗୁଲ୍‌ର ସର୍ଭରରେ ପ୍ରତି ୧ ମିନିଟ୍ ରେ ପ୍ରୋଡକ୍ଟ ଲିଙ୍କ୍ WhatsApp କୁ ପଠାଏ। **ଆପଣ ଫୋନ୍ ବନ୍ଦ କରିଦେଲେ ବି ଲୁପ୍ ବନ୍ଦ ହୁଏ ନାହିଁ!**
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Google Apps Script Permission Guide Banner */}
      {hasPermissionError && (
        <div className="bg-amber-500/15 border-2 border-amber-400/80 rounded-3xl p-5 text-white shadow-2xl space-y-3 animate-in fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xl shrink-0 shadow-md">
                🔑
              </div>
              <div>
                <h4 className="text-sm font-black text-amber-300">
                  Google Apps Script Authorization Required (UrlFetchApp ଅନୁମତି ଦିଅନ୍ତୁ)
                </h4>
                <p className="text-xs text-slate-300">
                  Google Apps Script କୁ Render WhatsApp API କଲ୍ କରିବା ପାଇଁ Google ସୁରକ୍ଷା ଅନୁମତି (Authorization) ଆବଶ୍ୟକ କରେ।
                </p>
              </div>
            </div>
            <button
              onClick={() => setHasPermissionError(false)}
              className="text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800/80 text-xs font-bold"
            >
              ✕ ବନ୍ଦ କରନ୍ତୁ
            </button>
          </div>

          <div className="bg-slate-950/80 rounded-2xl p-4 border border-amber-400/30 text-xs space-y-2.5 font-sans leading-relaxed">
            <p className="font-bold text-amber-200">
              ⚡ ଏହାକୁ ଠିକ୍ କରିବା ପାଇଁ ମାତ୍ର ୩ ଟି ସହଜ ଷ୍ଟେପ୍ (Step-by-Step Guide):
            </p>
            <ol className="list-decimal list-inside space-y-2 text-slate-200">
              <li>
                <a
                  href="https://script.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline font-black inline-flex items-center gap-1 hover:text-emerald-300"
                >
                  script.google.com ଖୋଲନ୍ତୁ <ExternalLink className="w-3 h-3" />
                </a>{' '}
                ଏବଂ ଆପଣଙ୍କ Munna Grocery ପ୍ରୋଜେକ୍ଟ ଓପନ୍ କରନ୍ତୁ।
              </li>
              <li>
                ଉପରେ ଥିବା ଫଙ୍କସନ୍ Dropdown ରୁ <span className="bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">authorizeScript</span> ବାଛନ୍ତୁ ଏବଂ ପାଖରେ ଥିବା <strong>▷ Run</strong> ବଟନ୍ ଦବାନ୍ତୁ।
              </li>
              <li>
                ଗୁଗୁଲ୍ ପପ୍-ଅପ୍ ଆସିବ: <strong>Review Permissions</strong> ➔ ଆପଣଙ୍କ ଜିମେଲ୍ ବାଛନ୍ତୁ ➔ ତଳେ ଥିବା <strong>Advanced</strong> କ୍ଲିକ୍ କରନ୍ତୁ ➔ <strong>Go to MUNNA GROCERY Backend (unsafe)</strong> ➔ <strong>Allow</strong> ଦିଅନ୍ତୁ।
              </li>
              <li>
                ଶେଷରେ ଉପରେ <strong>Deploy</strong> ➔ <strong>Manage Deployments</strong> ➔ ପେନସିଲ୍ (✏️ Edit) ➔ Version ରେ <strong>New version</strong> ବାଛି <strong>Deploy</strong> କରିଦିଅନ୍ତୁ।
              </li>
            </ol>
            <div className="pt-2 border-t border-slate-800 text-[11px] text-emerald-400 flex items-center gap-1.5">
              <span>💡 ଟିପ୍: ଏବେ ବ୍ରାଉଜରୁ ସିଧାସଳଖ Render କୁ Direct Fallback ସକ୍ରିୟ କରାଯାଇଛି, ଯାହା ଫଳରେ ଲୁପ୍ ଅଟକିବ ନାହିଁ!</span>
            </div>
          </div>
        </div>
      )}

      {/* NEW EVENT AUTO-SEND TOGGLES PANEL (Auto-Saved & Persisted in LocalStorage + WA_Config Sheet) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="font-extrabold text-sm sm:text-base text-white">
              ⚡ Event-Driven Instant Auto-Send Rules (ନୂଆ / ଷ୍ଟକ୍ / ଦର ବଦଳିଲେ ଅଟୋ ସେଣ୍ଡ)
            </h3>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
            Live Active • Auto-Syncs with Sheet
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          {isEnglish
            ? 'Enable automatic instant forwarding whenever products are added, restocked, or price updated in Google Sheet or Admin Catalog. Toggling any rule saves it immediately!'
            : 'ନୂଆ ପ୍ରୋଡକ୍ଟ ଯୋଡ଼ାଗଲେ, ଆଉଟ୍-ଅଫ୍-ଷ୍ଟକ୍ ରୁ ଇନ୍-ଷ୍ଟକ୍ ହେଲେ କିମ୍ବା ପ୍ରାଇସ୍ ବଦଳିଲେ ଅଟୋମେଟିକ୍ WhatsApp କୁ ଲିଙ୍କ୍ ଯିବ। ଟୋଗଲ୍ ଅନ/ଅଫ୍ କଲେ ତୁରନ୍ତ ସେଭ୍ ଓ କାର୍ଯ୍ୟକାରୀ ହୁଏ!'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          
          {/* Toggle 1: Auto Send New Product */}
          <div
            onClick={() =>
              handleToggleEventRule(
                'AUTO_SEND_NEW_PRODUCTS',
                !settings.AUTO_SEND_NEW_PRODUCTS,
                'Auto Send New Product'
              )
            }
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
              settings.AUTO_SEND_NEW_PRODUCTS
                ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md shadow-emerald-900/20'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                  <PlusCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Auto Send New Product</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {isEnglish
                    ? 'Auto send pure link when a new product is added from sheet/app'
                    : 'ନୂଆ ପ୍ରୋଡକ୍ଟ ଯୋଡ଼ାଗଲେ ଅଟୋମେଟିକ୍ WhatsApp ରେ ସେୟାର୍ ହେବ'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.AUTO_SEND_NEW_PRODUCTS}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  handleToggleEventRule('AUTO_SEND_NEW_PRODUCTS', e.target.checked, 'Auto Send New Product')
                }
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer shrink-0 mt-1"
              />
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTestEventRule('new_product');
                }}
                disabled={testingRule === 'new_product'}
                className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold cursor-pointer"
              >
                {testingRule === 'new_product' ? 'Sending...' : '⚡ Test Send'}
              </button>
              <span className={`font-black ${settings.AUTO_SEND_NEW_PRODUCTS ? 'text-emerald-400' : 'text-slate-500'}`}>
                {settings.AUTO_SEND_NEW_PRODUCTS ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>

          {/* Toggle 2: Auto Send Restocked Product */}
          <div
            onClick={() =>
              handleToggleEventRule(
                'AUTO_SEND_RESTOCKED_PRODUCTS',
                !settings.AUTO_SEND_RESTOCKED_PRODUCTS,
                'Auto Send Restocked'
              )
            }
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
              settings.AUTO_SEND_RESTOCKED_PRODUCTS
                ? 'bg-amber-950/40 border-amber-500/60 shadow-md shadow-amber-900/20'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                  <PackageCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Auto Send Restocked</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {isEnglish
                    ? 'Auto send link when Out-of-Stock product comes back In-Stock'
                    : 'ପ୍ରୋଡକ୍ଟ Restock (Out-of-Stock ➔ In-Stock) ହେଲେ ଅଟୋମେଟିକ୍ ସେଣ୍ଡ ହେବ'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.AUTO_SEND_RESTOCKED_PRODUCTS}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  handleToggleEventRule('AUTO_SEND_RESTOCKED_PRODUCTS', e.target.checked, 'Auto Send Restocked')
                }
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0 mt-1"
              />
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTestEventRule('restocked');
                }}
                disabled={testingRule === 'restocked'}
                className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold cursor-pointer"
              >
                {testingRule === 'restocked' ? 'Sending...' : '⚡ Test Send'}
              </button>
              <span className={`font-black ${settings.AUTO_SEND_RESTOCKED_PRODUCTS ? 'text-amber-400' : 'text-slate-500'}`}>
                {settings.AUTO_SEND_RESTOCKED_PRODUCTS ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>

          {/* Toggle 3: Auto Send Price Change */}
          <div
            onClick={() =>
              handleToggleEventRule(
                'AUTO_SEND_PRICE_CHANGED_PRODUCTS',
                !settings.AUTO_SEND_PRICE_CHANGED_PRODUCTS,
                'Auto Send Price Change'
              )
            }
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
              settings.AUTO_SEND_PRICE_CHANGED_PRODUCTS
                ? 'bg-blue-950/40 border-blue-500/60 shadow-md shadow-blue-900/20'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                  <DollarSign className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Auto Send Price Change</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {isEnglish
                    ? 'Auto send link when product price or offer price is updated'
                    : 'ପ୍ରୋଡକ୍ଟର ପ୍ରାଇସ୍ କିମ୍ବା ଡିସକାଉଣ୍ଟ ବଦଳିଲେ ଅଟୋମେଟିକ୍ ସେଣ୍ଡ ହେବ'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.AUTO_SEND_PRICE_CHANGED_PRODUCTS}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  handleToggleEventRule('AUTO_SEND_PRICE_CHANGED_PRODUCTS', e.target.checked, 'Auto Send Price Change')
                }
                className="w-4 h-4 accent-blue-500 rounded cursor-pointer shrink-0 mt-1"
              />
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTestEventRule('price_changed');
                }}
                disabled={testingRule === 'price_changed'}
                className="px-2 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 font-bold cursor-pointer"
              >
                {testingRule === 'price_changed' ? 'Sending...' : '⚡ Test Send'}
              </button>
              <span className={`font-black ${settings.AUTO_SEND_PRICE_CHANGED_PRODUCTS ? 'text-blue-400' : 'text-slate-500'}`}>
                {settings.AUTO_SEND_PRICE_CHANGED_PRODUCTS ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>

          {/* Toggle 4: Group Bulk Items Category-Wise */}
          <div
            onClick={() =>
              handleToggleEventRule(
                'GROUP_BY_CATEGORY',
                !settings.GROUP_BY_CATEGORY,
                'Group Category-Wise'
              )
            }
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
              settings.GROUP_BY_CATEGORY
                ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md shadow-indigo-900/20'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                  <FolderTree className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Group Category-Wise</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {isEnglish
                    ? 'Group selected bulk items category by category before broadcasting'
                    : 'ସିଲେକ୍ଟ ହୋଇଥିବା ପ୍ରୋଡକ୍ଟ ଗୁଡ଼ିକୁ କ୍ୟାଟେଗୋରୀ ଅନୁସାରେ ଗ୍ରୁପ୍ କରି ଗୋଟିଏ ପରେ ଗୋଟିଏ ପଠାଇବ'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.GROUP_BY_CATEGORY}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  handleToggleEventRule('GROUP_BY_CATEGORY', e.target.checked, 'Group Category-Wise')
                }
                className="w-4 h-4 accent-indigo-500 rounded cursor-pointer shrink-0 mt-1"
              />
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
              <span className="text-slate-400 font-mono">Sheet Key: GROUP_BY_CATEGORY</span>
              <span className={`font-black ${settings.GROUP_BY_CATEGORY ? 'text-indigo-400' : 'text-slate-500'}`}>
                {settings.GROUP_BY_CATEGORY ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>

        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 flex-wrap gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-emerald-400 font-semibold">
              ⏱️ Auto-Reads Google Sheet Every 5 Min (300s) • Forwards only when toggle-related changes are found
            </span>
            <span className="text-[10px] text-slate-400">
              Recipient: {settings.DEFAULT_RECIPIENT}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={async () => {
                setIsCheckingSheetDiff(true);
                appendLog('🔍 Checking Google Sheet for toggle-related changes (New / Restocked / Price Change)...', 'info');
                try {
                  const res = await checkSheetChangesEvery5MinAndForward();
                  if (res.forwarded > 0) {
                    appendLog(`✅ Found and auto-forwarded ${res.forwarded} changed product(s) from Google Sheet!`, 'success');
                    showToast(`✅ Forwarded ${res.forwarded} changed item(s) from Sheet!`);
                  } else {
                    appendLog(`ℹ️ Checked ${res.checked} Sheet items — no new toggle changes found since last check.`, 'info');
                    showToast('ℹ️ No new Sheet changes found since last check');
                  }
                } finally {
                  setIsCheckingSheetDiff(false);
                }
              }}
              disabled={isCheckingSheetDiff}
              className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-black text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingSheetDiff ? 'animate-spin' : ''}`} />
              <span>{isCheckingSheetDiff ? 'Checking Sheet...' : '🔍 Check Sheet Changes Now'}</span>
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
            >
              {isSavingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>💾</span>}
              <span>Save Toggle Rules to Sheet</span>
            </button>
          </div>
        </div>
      </div>

      {/* WA_Config Drawer / Settings Form */}
      {showConfigDrawer && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <h3 className="font-extrabold text-sm text-white">
                Google Sheet "WA_Config" Tab Credentials (Zero Hardcoding)
              </h3>
            </div>
            <button
              onClick={() => setShowConfigDrawer(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-300 block mb-1">Render Base URL</label>
              <input
                type="text"
                value={settings.RENDER_BASE_URL}
                onChange={(e) => setSettings({ ...settings, RENDER_BASE_URL: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Session ID</label>
              <input
                type="text"
                value={settings.SESSION_ID}
                onChange={(e) => setSettings({ ...settings, SESSION_ID: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-300">API Bearer Token</label>
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="text-[10px] text-slate-400 hover:text-white"
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showToken ? 'text' : 'password'}
                value={settings.API_BEARER_TOKEN}
                onChange={(e) => setSettings({ ...settings, API_BEARER_TOKEN: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-300">Default Recipient (Channel / Group / Phone)</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, DEFAULT_RECIPIENT: '120363414065601906@newsletter' })}
                    className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded cursor-pointer"
                  >
                    + Channel (@newsletter)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, DEFAULT_RECIPIENT: '120363028374829104@g.us' })}
                    className="text-[10px] bg-slate-800 text-blue-400 px-2 py-0.5 rounded cursor-pointer"
                  >
                    + Group (@g.us)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, DEFAULT_RECIPIENT: '919040585726' })}
                    className="text-[10px] bg-slate-800 text-amber-400 px-2 py-0.5 rounded cursor-pointer"
                  >
                    + Phone
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={settings.DEFAULT_RECIPIENT}
                onChange={(e) => setSettings({ ...settings, DEFAULT_RECIPIENT: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Store Domain for Links</label>
              <input
                type="text"
                value={settings.STORE_DOMAIN}
                onChange={(e) => setSettings({ ...settings, STORE_DOMAIN: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              onClick={checkServerHealth}
              className="text-xs text-slate-300 hover:text-white bg-slate-800 px-3 py-1.5 rounded-xl font-bold cursor-pointer"
            >
              🔌 Ping Baileys Server
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSavingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>💾</span>}
              <span>{isSavingSettings ? 'Saving...' : 'Save to "WA_Config" Sheet'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Broadcast Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT COLUMN: Controls & Active Product Card (7 COLS) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Progress & Quick Metrics Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    isLooping ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
                  }`}
                />
                <h3 className="font-extrabold text-sm text-white">
                  {isLooping ? '▶️ Auto-Loop Running...' : '⏸️ Auto-Loop Engine Paused'}
                </h3>
              </div>

              <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                {queueProducts.length > 0 ? `Selected Queue: #${currentIndex + 1} of ${queueProducts.length}` : 'Queue Empty'}
              </span>
            </div>

            {/* Countdown Delay Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400 font-bold">
                <span>Delay Timer ({loopDelay}s interval)</span>
                <span>{isLooping ? `Next in ${countdown}s` : 'Paused'}</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-1000 shadow-sm"
                  style={{
                    width: isLooping
                      ? `${Math.max(0, Math.min(100, ((loopDelay - countdown) / loopDelay) * 100))}%`
                      : '0%'
                  }}
                />
              </div>
            </div>

            {/* Repeat All Selected vs Once All Selected Send Mode Toggle */}
            <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                  Queue Send Mode (ସିଲେକ୍ଟ ପ୍ରଡକ୍ଟ ପଠାଇବା ମୋଡ୍)
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  infiniteLoop
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {infiniteLoop ? '🔁 Repeat All Selected' : '1️⃣ Once All Selected'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInfiniteLoop(true);
                    infiniteLoopRef.current = true;
                    appendLog('🔁 Mode switched to: Repeat All Selected Send (Continuous Loop)', 'info');
                    showToast(
                      isEnglish
                        ? '🔁 Mode: Repeat All Selected Send'
                        : '🔁 ମୋଡ୍: Repeat All Selected Send (ବାରମ୍ବାର ଚାଲିବ)'
                    );
                  }}
                  className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    infiniteLoop
                      ? 'bg-emerald-600 text-slate-950 border-emerald-400 shadow-md shadow-emerald-600/20'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <span>🔁 Repeat All Selected Send</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInfiniteLoop(false);
                    infiniteLoopRef.current = false;
                    appendLog('1️⃣ Mode switched to: Once All Selected Send (Stop after 1 round)', 'info');
                    showToast(
                      isEnglish
                        ? '1️⃣ Mode: Once All Selected Send (1 Round)'
                        : '1️⃣ ମୋଡ୍: Once All Selected Send (ଥରେ ପଠାଇ ବନ୍ଦ ହେବ)'
                    );
                  }}
                  className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    !infiniteLoop
                      ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md shadow-amber-500/20'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <span>1️⃣ Once All Selected Send</span>
                </button>
              </div>
            </div>

            {/* Config & Toggle Controls */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
              <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                <label className="text-[10px] text-slate-400 font-extrabold uppercase block mb-1">
                  Loop Delay (Sec)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={3}
                    max={60}
                    value={loopDelay}
                    onChange={(e) => setLoopDelay(Math.max(3, parseInt(e.target.value || '6', 10)))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1 text-white font-mono font-bold text-center outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 font-bold">sec</span>
                </div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">
                    Auto-Fresh Link
                  </span>
                  <span className="text-[10px] text-slate-300 font-bold">
                    {autoRefreshLink ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoRefreshLink}
                  onChange={(e) => setAutoRefreshLink(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">
                    Only In-Stock
                  </span>
                  <span className="text-[10px] text-slate-300 font-bold">
                    {onlyInStock ? 'Yes (Qty > 0)' : 'All Items'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">
                    Repeat All Send
                  </span>
                  <span className="text-[10px] text-slate-300 font-bold">
                    {infiniteLoop ? 'Repeat All' : 'Once Only'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={infiniteLoop}
                  onChange={(e) => {
                    setInfiniteLoop(e.target.checked);
                    infiniteLoopRef.current = e.target.checked;
                  }}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Action Controller Buttons (Start, Pause, Stop, Restart, Refresh Link, Skip Item) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
              <button
                type="button"
                onClick={handleStartLoop}
                disabled={isLooping || queueProducts.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-black text-xs py-3 px-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-600/20 active:scale-95"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Start Loop</span>
              </button>

              <button
                type="button"
                onClick={handlePauseLoop}
                disabled={!isLooping}
                className="bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-300 border border-amber-500/30 font-bold text-xs py-3 px-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <Pause className="w-4 h-4" />
                <span>Pause Loop</span>
              </button>

              <button
                type="button"
                onClick={handleStopLoop}
                disabled={!isLooping && currentIndex === 0}
                className="bg-rose-600/25 hover:bg-rose-600/40 disabled:opacity-40 text-rose-300 border border-rose-500/40 font-black text-xs py-3 px-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title="Stop loop completely and reset queue to #1"
              >
                <Square className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                <span>Stop Loop</span>
              </button>

              <button
                type="button"
                onClick={handleRestartLoop}
                disabled={queueProducts.length === 0}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-black text-xs py-3 px-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95"
                title="Reset queue to #1 and restart sending immediately"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Restart Loop</span>
              </button>

              <button
                type="button"
                onClick={handleRefreshLinkToken}
                className="bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 font-bold text-xs py-3 px-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title="Generates a brand new cache token so WhatsApp crawler re-fetches the image card"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Link</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (queueProducts.length === 0) return;
                  const nextIdx = (currentIndex + 1) % queueProducts.length;
                  updateAndPersistIndex(nextIdx);
                  appendLog('Skipped to next product in queue.', 'info');
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs py-3 px-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <span>Skip Item ⏭</span>
              </button>
            </div>
          </div>

          {/* Active Product Showcase */}
          {activeProduct && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <span>📦</span>
                  <span>Currently Active Product (Queue #{currentIndex + 1})</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  EAN: {getPrimaryCleanEan(activeProduct)}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="w-24 h-24 rounded-2xl bg-white p-1.5 flex items-center justify-center shrink-0 border border-slate-700 overflow-hidden shadow-md">
                  <img
                    src={getProductBestShareImage(activeProduct)}
                    alt={activeProduct.product_name}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-1.5 w-full text-center sm:text-left">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                    📁 Category: {activeProduct.category || 'Grocery'}
                  </span>
                  <h4 className="font-black text-sm sm:text-base text-white leading-snug line-clamp-2">
                    {activeProduct.product_name}
                  </h4>
                  <div className="flex items-baseline justify-center sm:justify-start gap-2.5">
                    <span className="font-black text-emerald-400 text-base">₹{activeProduct.selling_price}</span>
                    {activeProduct.mrp && Number(activeProduct.mrp) > Number(activeProduct.selling_price) && (
                      <span className="text-xs text-slate-500 line-through">₹{activeProduct.mrp}</span>
                    )}
                    <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                      In Stock: {activeProduct.stock_qty}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pure Link Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pure Product Link (Sent without extra text for big WhatsApp card):</span>
                  </label>
                  <button
                    onClick={handleCopyLink}
                    className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedLink ? 'Copied! ✅' : 'Copy'}</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2 overflow-hidden">
                  <span className="font-mono text-xs text-emerald-400 break-all select-all font-semibold">
                    {activePureLink}
                  </span>
                  <a
                    href={activePureLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white shrink-0"
                    title="Open pure link in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Manual single test dispatch */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <input
                  type="text"
                  value={quickRecipientOverride}
                  onChange={(e) => setQuickRecipientOverride(e.target.value)}
                  placeholder={`Send only this item to: ${settings.DEFAULT_RECIPIENT}`}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => handleSendSingleItem(activeProduct)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-xl text-xs font-black shrink-0 transition-colors cursor-pointer"
                >
                  Send This Item Now
                </button>
                {activeProduct && getWaSentMessageMap()[getPrimaryCleanEan(activeProduct)]?.messageId && (
                  <button
                    onClick={() => handleEditPostNow(activeProduct)}
                    className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-black shrink-0 transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Edit previously shared WhatsApp post in-place with updated price/stock pure link"
                  >
                    <span>✏️</span>
                    <span>Edit Live Post</span>
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Live Activity Feed Terminal (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex-1 flex flex-col min-h-[460px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <h3 className="font-bold text-sm text-white">Live Broadcast Activity Feed</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLogs([])}
                  className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    const text = logs.map((l) => `[${l.time}] ${l.text}`).join('\n');
                    navigator.clipboard.writeText(text);
                    showToast('Logs copied!');
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer"
                >
                  Copy Logs
                </button>
              </div>
            </div>

            {/* Terminal Window */}
            <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 font-mono text-[11px] text-slate-300 space-y-1.5 flex-1 overflow-y-auto max-h-[460px] select-text">
              {logs.map((log) => (
                <div key={log.id} className="leading-relaxed break-all">
                  <span className="text-slate-600">[{log.time}]</span>{' '}
                  <span
                    className={
                      log.type === 'success'
                        ? 'text-emerald-400 font-semibold'
                        : log.type === 'error'
                        ? 'text-rose-400 font-semibold'
                        : log.type === 'wait'
                        ? 'text-amber-400'
                        : 'text-sky-300'
                    }
                  >
                    {log.text}
                  </span>
                </div>
              ))}
            </div>

            {/* Helper notice */}
            <p className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-800">
              💡 WhatsApp crawler requires ~6 seconds between posts to scrape your website and generate the high-resolution product photo card.
            </p>
          </div>
        </div>

      </div>

      {/* ============================================================================ */}
      {/* PRODUCT QUEUE SELECTION TABLE & BULK SELECTION MANAGER */}
      {/* ============================================================================ */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        
        {/* Header Bar with Search & Quick Selection Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h3 className="font-black text-base text-white">
                📋 Product Queue & Custom Selection Manager (ସିଲେକ୍ଟ ଆଇଟମ୍ ଲୁପ୍)
              </h3>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {isEnglish
                ? 'Select or deselect specific products to send in the auto-loop queue. Grouped category-by-category!'
                : 'ଯେଉଁ ଯେଉଁ ପ୍ରୋଡକ୍ଟ ଲୁପ୍ ରେ ପଠାଇବାକୁ ଚାହାଁନ୍ତି ତାହା Check/Select କରନ୍ତୁ। କ୍ରମାନ୍ୱୟରେ ଗୋଟିଏ କ୍ୟାଟେଗୋରୀ ପରେ ଅନ୍ୟ କ୍ୟାଟେଗୋରୀ ଯିବ।'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-black text-emerald-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              Selected: {selectedEans.size} / {catalog.length} Products
            </span>
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl font-black text-xs cursor-pointer transition-colors"
            >
              ✓ Select All
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl font-bold text-xs cursor-pointer transition-colors"
            >
              ✕ Deselect All
            </button>
            <button
              onClick={handleSelectInStockOnly}
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl font-bold text-xs cursor-pointer transition-colors"
            >
              📦 In-Stock Only
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setQueueFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                queueFilter === 'all'
                  ? 'bg-slate-800 text-white font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Items ({catalog.length})
            </button>
            <button
              onClick={() => setQueueFilter('selected')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                queueFilter === 'selected'
                  ? 'bg-emerald-600 text-slate-950 font-black'
                  : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              Selected Queue ({selectedEans.size})
            </button>
            <button
              onClick={() => setQueueFilter('instock')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                queueFilter === 'instock'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              In Stock Only
            </button>
            <button
              onClick={() => setQueueFilter('outofstock')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                queueFilter === 'outofstock'
                  ? 'bg-rose-500 text-white font-black'
                  : 'text-rose-400 hover:text-rose-300'
              }`}
            >
              Out of Stock
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product name, category, or EAN..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Product Queue List Table */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
          <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-800/80">
            {displayCatalogProducts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No products found matching your current filter/search.
              </div>
            ) : (
              displayCatalogProducts.map((prod, idx) => {
                const ean = getPrimaryCleanEan(prod);
                const isSelected = selectedEans.has(ean);
                const stock = typeof prod.stock_qty === 'number' ? prod.stock_qty : parseInt(String(prod.stock_qty || '0'), 10);
                const inStock = stock > 0;
                const isActiveInQueue = activeProduct && getPrimaryCleanEan(activeProduct) === ean;

                // Category Header Divider
                const prevCat = idx > 0 ? (displayCatalogProducts[idx - 1].category || 'General') : null;
                const currentCat = prod.category || 'General';
                const showCatHeader = settings.GROUP_BY_CATEGORY && (idx === 0 || prevCat !== currentCat);

                return (
                  <React.Fragment key={`${ean}-${idx}`}>
                    {showCatHeader && (
                      <div className="bg-slate-900/90 px-4 py-2 border-y border-slate-800/80 text-xs font-black text-indigo-300 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                        <div className="flex items-center gap-2">
                          <FolderTree className="w-4 h-4 text-indigo-400" />
                          <span>📁 Category: {currentCat}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {displayCatalogProducts.filter((p) => (p.category || 'General') === currentCat).length} Items
                        </span>
                      </div>
                    )}

                    <div
                      className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                        isActiveInQueue
                          ? 'bg-emerald-950/40 border-l-4 border-emerald-400'
                          : isSelected
                          ? 'hover:bg-slate-900/90'
                          : 'opacity-50 hover:opacity-80 bg-slate-950'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleSelectProduct(ean)}
                          className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-emerald-400 fill-emerald-500/20" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-600" />
                          )}
                        </button>

                        {/* Thumbnail */}
                        <div className="w-10 h-10 rounded-xl bg-white p-1 shrink-0 overflow-hidden border border-slate-700 flex items-center justify-center">
                          <img
                            src={getProductBestShareImage(prod)}
                            alt={prod.product_name}
                            className="w-full h-full object-contain"
                          />
                        </div>

                        {/* Product Details */}
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-xs text-white truncate max-w-xs sm:max-w-md">
                              {prod.product_name}
                            </h4>
                            {isActiveInQueue && (
                              <span className="text-[9px] font-black uppercase bg-emerald-400 text-slate-950 px-1.5 py-0.2 rounded-full">
                                Current Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                            <span>₹{prod.selling_price}</span>
                            {prod.mrp && Number(prod.mrp) > Number(prod.selling_price) && (
                              <span className="line-through text-slate-600">₹{prod.mrp}</span>
                            )}
                            <span>• {prod.category || 'General'}</span>
                            <span>• EAN: {ean}</span>
                          </div>
                        </div>
                      </div>

                      {/* Stock status & Instant Dispatch Button */}
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {(() => {
                          const pKey = getPrimaryCleanEan(prod);
                          const existingSent = getWaSentMessageMap()[pKey];
                          if (!existingSent || !existingSent.messageId) return null;
                          return (
                            <button
                              type="button"
                              onClick={() => handleEditPostNow(prod)}
                              className="p-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              title={`Edit existing WhatsApp message (${existingSent.messageId}) in-place`}
                            >
                              <span>✏️</span>
                              <span className="hidden sm:inline">Edit Post</span>
                            </button>
                          );
                        })()}

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            inStock
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {inStock ? `Qty: ${stock}` : 'Out of Stock'}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleSendSingleItem(prod)}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          title="Send this individual item link to WhatsApp right now"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Send Now</span>
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default AdminWhatsAppLoop;
