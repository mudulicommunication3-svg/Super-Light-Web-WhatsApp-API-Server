import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Product, normalizeTrending, parseProductStock } from '../../types';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  Save,
  Check,
  AlertTriangle,
  Barcode,
  Layers,
  ArrowUpDown,
  RefreshCw,
  ExternalLink,
  Upload,
  CheckCircle2,
  X,
  Star,
  Image as ImageIcon,
  FolderTree,
  HardDrive,
  Sparkles,
  Link2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Share2,
  Send,
  Copy,
  CheckSquare,
  Square,
  MessageSquare,
  Users,
  CheckCheck,
  Phone,
  Home,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Zap,
  Volume2,
  CheckCircle,
  Camera,
  MapPin
} from 'lucide-react';
import {
  updateProductOnSheet,
  updateProductStockOnSheet,
  searchJioMartProducts,
  uploadImageToImgbb,
  pushConfigKeyToSheet,
  fetchProductsFromSheet,
  batchUpdateProductsOnSheet,
  uploadAndGenerateImageLink,
  ImageUploadResult,
  getStoredDeletedEans,
  getStoredDeletedNames,
  parseGalleryImages,
  saveProductOverride,
  getFacebookFeedUrl,
  syncFacebookCatalogFeed,
  generateFacebookCatalogCsvString,
  resetAllProductShareLinks,
  JioMartSearchResult,
  JIOMART_CLOUDFLARE_WORKER_CODE
} from '../../services/api';
import { showToast } from '../Toast';
import {
  getCategoryFolder,
  getRepoImagePath,
  isRepoUrl,
  handleProductImageError,
  resolveProductImage,
  normalizeGoogleDriveImageUrl
} from '../../utils/imageHelper';
import { getOriginalCdnUrl } from '../../data/initialData';
import {
  getAdminBulkShareText,
  handleAdminBulkShare,
  getIndividualWhatsAppShareUrl,
  handleShareProduct,
  getProductShareUrl,
  getSiteDomain,
  getProductShareText
} from '../../utils/shareHelper';
import { AdminBarcodeScannerModal } from './AdminBarcodeScannerModal';
import { AdminProductShareRefreshModal } from './AdminProductShareRefreshModal';
import {
  detectProductCategory,
  getVideoEmbedInfo,
  getYouTubeThumbnail,
  extractOrGenerateProductDescription,
  parseEanList,
  getPrimaryEan,
  formatMultipleEans,
  doesProductMatchEan,
  doesProductContainEanSubstring,
  findProductByAnyEan
} from '../../utils/productMediaHelper';

export const AdminCatalog: React.FC = () => {
  const {
    catalog,
    addProduct,
    updateProduct,
    deleteProduct,
    setShowScanner,
    shopConfig,
    updateShopConfig,
    setCatalog,
    lastStockSyncTime,
    syncLiveStockWithServer,
    isSyncingStock,
    hasUnsavedAdminChanges,
    setHasUnsavedAdminChanges,
    isSyncPaused,
    pauseSyncRemainingSec,
    pauseBackgroundSync,
    resumeBackgroundSync
  } = useApp();
  const { isEnglish } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAllCategoriesGrid, setShowAllCategoriesGrid] = useState(false);
  const [stockHealthFilter, setStockHealthFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'trending'>('all');
  const [savingEan, setSavingEan] = useState<string | null>(null);
  const [savedSuccessEan, setSavedSuccessEan] = useState<string | null>(null);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [isConvertingLinks, setIsConvertingLinks] = useState(false);
  const [showImageManager, setShowImageManager] = useState(false);
  const [shareRefreshProduct, setShareRefreshProduct] = useState<Product | null>(null);

  // Manual inline edits buffer (prevents auto-updating while typing until user clicks Save)
  const [rowEdits, setRowEdits] = useState<Record<string, {
    selling_price?: string;
    mrp?: string;
    stock_qty?: string;
    max_order_qty?: string;
  }>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);

  // 📣 Facebook / Meta Commerce Manager Catalog Feed Sync State
  const [isSyncingFbFeed, setIsSyncingFbFeed] = useState(false);
  const [fbFeedStatus, setFbFeedStatus] = useState<string | null>(null);
  const [isCopiedFbUrl, setIsCopiedFbUrl] = useState(false);
  const fbFeedUrl = getFacebookFeedUrl();

  const handleSyncFacebookFeedClick = async () => {
    setIsSyncingFbFeed(true);
    setFbFeedStatus(null);
    try {
      const res = await syncFacebookCatalogFeed(catalog.length);
      const msg = `Facebook Catalog Feed Updated! Total items: ${res.count}`;
      setFbFeedStatus(msg);
      showToast(
        isEnglish
          ? `✅ ${msg}`
          : `✅ Facebook Catalog Feed ଅପଡେଟ୍ ହେଲା! ମୋଟ ସାମଗ୍ରୀ: ${res.count}`
      );
    } catch (e) {
      setFbFeedStatus('Error syncing Facebook Catalog Feed');
      showToast('Error syncing Facebook Catalog Feed');
    } finally {
      setIsSyncingFbFeed(false);
    }
  };

  const handleCopyFbFeedUrl = () => {
    if (!fbFeedUrl) return;
    navigator.clipboard.writeText(fbFeedUrl);
    setIsCopiedFbUrl(true);
    showToast(
      isEnglish
        ? '📋 Copied Facebook Feed URL for Meta Commerce Manager!'
        : '📋 Meta Commerce Manager ପାଇଁ Facebook Feed URL କପି ହେଲା!'
    );
    setTimeout(() => setIsCopiedFbUrl(false), 2500);
  };

  const handleDownloadFbCsv = () => {
    const csv = generateFacebookCatalogCsvString(catalog);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'munna-facebook-catalog-feed.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(isEnglish ? '⬇️ Downloaded Facebook Catalog CSV!' : '⬇️ Facebook Catalog CSV ଡାଉନଲୋଡ୍ ହେଲା!');
  };

  // 📸 Image Uploader & Public Link Generator Hub State
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [hubImageFile, setHubImageFile] = useState<File | null>(null);
  const [isUploadingHub, setIsUploadingHub] = useState(false);
  const [generatedHubUrl, setGeneratedHubUrl] = useState('');
  const [generatedMeta, setGeneratedMeta] = useState<{ fileName: string; sizeKb: number; source: string } | null>(null);
  const [isCopiedHubLink, setIsCopiedHubLink] = useState(false);
  const [driveUrlInput, setDriveUrlInput] = useState('');
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [selectedProductToAssign, setSelectedProductToAssign] = useState<Product | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [recentImages, setRecentImages] = useState<Array<{ url: string; time: number; name?: string }>>(() => {
    try {
      const saved = localStorage.getItem('munna_recent_catalog_images');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const saveToRecentImages = (url: string, name?: string) => {
    try {
      const cleanUrl = url.trim();
      if (!cleanUrl) return;
      setRecentImages((prev) => {
        const filtered = prev.filter((x) => x.url !== cleanUrl);
        const updated = [{ url: cleanUrl, time: Date.now(), name: name || 'Product Photo' }, ...filtered].slice(0, 20);
        try {
          localStorage.setItem('munna_recent_catalog_images', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    } catch (e) {}
  };

  // Home Page Setup Engine & Pinned Upper Section State
  const [isHomePageSetupMode, setIsHomePageSetupMode] = useState(false);
  const [showSelectedInUpperPage, setShowSelectedInUpperPage] = useState(true);

  // Bulk Share & Product Selection State
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedEans, setSelectedEans] = useState<Set<string>>(new Set());
  const [showBulkShareModal, setShowBulkShareModal] = useState(false);
  const [bulkCustomNote, setBulkCustomNote] = useState('');
  const [targetCustomerPhone, setTargetCustomerPhone] = useState('');
  const [sentIndividualEans, setSentIndividualEans] = useState<Set<string>>(new Set());
  const [isCopiedBulk, setIsCopiedBulk] = useState(false);
  const [queueIndex, setQueueIndex] = useState(0);
  const [bulkShareTab, setBulkShareTab] = useState<'one_by_one' | 'list' | 'combined'>('one_by_one');
  const [copiedEan, setCopiedEan] = useState<string | null>(null);

  // Auto-Send Queue State
  const [autoSendActive, setAutoSendActive] = useState(false);
  const [autoDelaySeconds, setAutoDelaySeconds] = useState(3);
  const [countdown, setCountdown] = useState<number>(0);
  const [autoAdvanceOnFocus, setAutoAdvanceOnFocus] = useState(true);
  const [autoShareMode, setAutoShareMode] = useState<'link_only' | 'full_details'>('link_only');
  const [lastDispatchedEan, setLastDispatchedEan] = useState<string | null>(null);

  const toggleSelectProduct = (ean: string) => {
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

  const handleClearSelection = () => {
    setSelectedEans(new Set());
  };

  const handleSyncWithSheet = async () => {
    setIsSyncingSheet(true);
    try {
      const prods = await fetchProductsFromSheet();
      if (prods && prods.length > 0) {
        const deletedEans = getStoredDeletedEans();
        const deletedNames = getStoredDeletedNames();
        const dedupedList: Product[] = [];
        prods.forEach((p) => {
          const pEans = parseEanList(p.ean, p.additional_eans, p.ean_list);
          const clean = pEans[0] || String(p.ean).replace(/^EAN-/, '').trim();
          const cleanName = String(p.product_name || '').toLowerCase().trim();
          if (
            deletedEans.has(clean) ||
            deletedEans.has(String(p.ean).trim()) ||
            (pEans.length > 0 && pEans.every((c) => deletedEans.has(c))) ||
            (cleanName && deletedNames.has(cleanName))
          ) {
            return;
          }
          const existingIdx = dedupedList.findIndex((item) => doesProductMatchEan(item, pEans));
          if (existingIdx === -1) {
            dedupedList.push({
              ...p,
              ean: clean,
              additional_eans: pEans.join(', '),
              ean_list: pEans
            });
          } else {
            const existing = dedupedList[existingIdx];
            const mergedEans = parseEanList(existing.ean, existing.additional_eans, existing.ean_list, pEans);
            const existingGalleryLen = existing.gallery_images?.length || 0;
            const newGalleryLen = p.gallery_images?.length || 0;
            const preferNew = newGalleryLen >= existingGalleryLen;
            const winner = preferNew ? p : existing;
            const loser = preferNew ? existing : p;
            dedupedList[existingIdx] = {
              ...loser,
              ...winner,
              ean: winner.ean || existing.ean || clean,
              additional_eans: mergedEans.join(', '),
              ean_list: mergedEans
            };
          }
        });
        setCatalog(dedupedList);
        showToast(isEnglish ? `Loaded ${dedupedList.length} products from Google Sheet! ✅` : `ଗୁଗୁଲ୍ ସିଟ୍ ରୁ ${dedupedList.length} ଟି ସାମଗ୍ରୀ ସଫଳତାର ସହ ଲୋଡ୍ ହେଲା! ✅`);
      }
    } catch (e) {
      showToast('Error syncing products with Google Sheet');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handlePushAllToSheet = async () => {
    setIsSyncingSheet(true);
    try {
      // First apply any pending inline rowEdits and save product overrides so nothing is left unsaved
      const mergedCatalog = catalog.map((p) => {
        const draft = rowEdits[p.ean];
        if (!draft) return p;
        const nextSp = draft.selling_price !== undefined ? draft.selling_price.trim() : String(p.selling_price);
        const nextMrp = draft.mrp !== undefined ? draft.mrp.trim() : String(p.mrp);
        const nextStock = draft.stock_qty !== undefined ? parseProductStock(draft.stock_qty) : parseProductStock(p.stock_qty);
        const nextMax = draft.max_order_qty !== undefined ? (parseInt(draft.max_order_qty, 10) || 10) : (p.max_order_qty ?? 10);
        const updatedItem: Product = {
          ...p,
          selling_price: nextSp || p.selling_price,
          mrp: nextMrp || p.mrp || nextSp,
          stock_qty: nextStock,
          max_order_qty: nextMax
        };
        saveProductOverride({
          ean: updatedItem.ean,
          additional_eans: updatedItem.additional_eans,
          ean_list: updatedItem.ean_list,
          rowIndex: updatedItem.rowIndex,
          selling_price: updatedItem.selling_price,
          mrp: updatedItem.mrp,
          stock_qty: updatedItem.stock_qty,
          product_name: updatedItem.product_name,
          category: updatedItem.category,
          description: updatedItem.description,
          image_url: updatedItem.image_url,
          backup_image_url: updatedItem.backup_image_url,
          video_url: updatedItem.video_url,
          max_order_qty: updatedItem.max_order_qty,
          additional_images: updatedItem.additional_images,
          gallery_images: updatedItem.gallery_images
        });
        return updatedItem;
      });
      setCatalog(mergedCatalog);
      try {
        localStorage.setItem('munna_store_catalog', JSON.stringify(mergedCatalog));
      } catch (e) {}
      setRowEdits({});
      setHasUnsavedAdminChanges(false);
      resumeBackgroundSync(false);
      await batchUpdateProductsOnSheet(mergedCatalog);
      showToast(
        isEnglish
          ? `✅ Saved all ${mergedCatalog.length} products (Price, Qty, Multiple EANs, Photos & Details) to Google Sheet!`
          : `✅ ସମସ୍ତ ${mergedCatalog.length} ଟି ସାମଗ୍ରୀ (ମୂଲ୍ୟ, କ୍ୱାଣ୍ଟିଟି, ସବୁ EAN ଓ ବିବରଣୀ) ଗୁଗୁଲ୍ ସିଟ୍‌ରେ ସେଭ୍ ହେଲା!`
      );
    } catch (e) {
      showToast('Error saving catalog to Google Sheet');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // 1-Click Convert All Images to Repo Links (/products/<category>/<ean>.jpg) with CDN Backup
  const handleConvertAllToRepoLinks = async () => {
    if (
      !confirm(
        isEnglish
          ? '⚡ Convert all product images to local repository folder links (/products/<category>/<ean>.jpg)? Current CDN links will be saved as backup.'
          : '⚡ ସମସ୍ତ ସାମଗ୍ରୀର ଫଟୋ ଲିଙ୍କକୁ ନିଜ ରିପୋ ଫୋଲ୍ଡର (/products/<category>/<ean>.jpg) କୁ ବଦଳାଇବାକୁ ଚାହାଁନ୍ତି କି? ପୁରୁଣା CDN ଲିଙ୍କ୍ ବ୍ୟାକଅପ୍ ରୂପେ ସୁରକ୍ଷିତ ରହିବ।'
      )
    ) {
      return;
    }

    setIsConvertingLinks(true);
    try {
      let convertedCount = 0;
      const updatedCatalog = catalog.map((p) => {
        const repoPath = getRepoImagePath(p.category, p.ean);
        const currentUrl = (p.image_url || '').trim();

        // If already using repo link, keep it
        if (isRepoUrl(currentUrl)) {
          return p;
        }

        convertedCount++;
        return {
          ...p,
          image_url: repoPath,
          backup_image_url: p.backup_image_url || currentUrl
        };
      });

      setCatalog(updatedCatalog);
      try {
        localStorage.setItem('munna_store_catalog', JSON.stringify(updatedCatalog));
      } catch (e) {}

      // Batch sync to Google Sheet
      await batchUpdateProductsOnSheet(updatedCatalog);

      showToast(
        isEnglish
          ? `✅ Successfully converted ${convertedCount} products to Repo links! Backup CDN saved.`
          : `✅ ସଫଳତା! ${convertedCount} ଟି ସାମଗ୍ରୀର ଲିଙ୍କ୍ ରିପୋ ଫୋଲ୍ଡରକୁ ପରିବର୍ତ୍ତନ ହେଲା ଓ CDN ବ୍ୟାକଅପ୍ ସୁରକ୍ଷିତ ରହିଲା!`
      );
    } catch (err) {
      showToast('Error converting product images');
    } finally {
      setIsConvertingLinks(false);
    }
  };

  // 1-Click Restore All Images to Original CDN Links (JioMart / ImgBB)
  const handleRestoreAllToCdnLinks = async () => {
    if (
      !confirm(
        isEnglish
          ? 'Restore all product images back to their original cloud CDN links (JioMart / ImgBB)?'
          : 'ସମସ୍ତ ପ୍ରୋଡକ୍ଟ ଫଟୋକୁ ସେମାନଙ୍କ ମୂଳ କ୍ଲାଉଡ୍ CDN ଲିଙ୍କ୍ (JioMart/ImgBB) କୁ ଫେରାଇବାକୁ ଚାହାଁନ୍ତି କି?'
      )
    ) {
      return;
    }

    setIsConvertingLinks(true);
    try {
      let restoredCount = 0;
      const updatedCatalog = catalog.map((p) => {
        // Priority 1: backup_image_url if present
        // Priority 2: fallback to original CDN link from RAW_INITIAL_PRODUCTS
        const cdnUrl =
          (p.backup_image_url && p.backup_image_url.trim()) ||
          getOriginalCdnUrl(p.ean) ||
          (p.image_url && p.image_url.startsWith('http') ? p.image_url : undefined);

        if (cdnUrl && cdnUrl.startsWith('http')) {
          restoredCount++;
          return {
            ...p,
            image_url: cdnUrl,
            backup_image_url: cdnUrl
          };
        }
        return p;
      });

      setCatalog(updatedCatalog);
      try {
        localStorage.setItem('munna_store_catalog', JSON.stringify(updatedCatalog));
      } catch (e) {}

      await batchUpdateProductsOnSheet(updatedCatalog);

      showToast(
        isEnglish
          ? `🔄 Restored ${restoredCount} products to original CDN links!`
          : `🔄 ${restoredCount} ଟି ପ୍ରୋଡକ୍ଟର ମୂଳ CDN ଲିଙ୍କ୍ ସଫଳତାର ସହ ଫେରସ୍ତ ଆସିଲା!`
      );
    } catch (e) {
      showToast('Error restoring CDN links');
    } finally {
      setIsConvertingLinks(false);
    }
  };

  // 1-Click Reset All Product Share Links (Frontend + Backend)
  const [isResettingAllShareLinks, setIsResettingAllShareLinks] = useState(false);
  const handleResetAllProductLinks = async () => {
    setIsResettingAllShareLinks(true);
    try {
      const res = await resetAllProductShareLinks(catalog);
      if (res.updatedProducts && res.updatedProducts.length > 0) {
        setCatalog(res.updatedProducts);
      }
      updateShopConfig({
        shareLinkVersion: res.versionTag,
        lastLinkResetAt: new Date().toISOString()
      });
      showToast(
        isEnglish
          ? `✅ Reset all ${res.totalCount} product links (Frontend & Backend)! ${res.healedCount} photo links healed to HTTPS.`
          : `✅ ସମସ୍ତ ${res.totalCount} ଟି ପ୍ରୋଡକ୍ଟ ଲିଙ୍କ୍ (Frontend + Backend) ରିସେଟ୍ ହେଲା! (${res.healedCount} ଟି ଫଟୋ ସଜଡ଼ାଗଲା)`
      );
    } catch (e) {
      showToast('Error resetting all product links');
    } finally {
      setIsResettingAllShareLinks(false);
    }
  };

  // Restore single product to original CDN link
  const handleRestoreSingleProductToCdn = async (product: Product) => {
    const cdnUrl =
      (product.backup_image_url && product.backup_image_url.trim()) ||
      getOriginalCdnUrl(product.ean);

    if (!cdnUrl) {
      showToast('No CDN backup link found for this item');
      return;
    }

    const updated = {
      ...product,
      image_url: cdnUrl,
      backup_image_url: cdnUrl
    };

    updateProduct(updated);
    try {
      await updateProductOnSheet(updated);
    } catch (e) {}

    showToast(
      isEnglish
        ? `Restored CDN link for ${product.product_name}`
        : `"${product.product_name}" ର ମୂଳ CDN ଲିଙ୍କ୍ ଫେରସ୍ତ ହେଲା`
    );
  };

  // Convert single product to repo link
  const handleConvertSingleProductToRepo = async (product: Product) => {
    const repoPath = getRepoImagePath(product.category, product.ean);
    const existingCdn =
      (product.image_url && product.image_url.startsWith('http') ? product.image_url : undefined) ||
      product.backup_image_url ||
      getOriginalCdnUrl(product.ean);

    const updated = {
      ...product,
      image_url: repoPath,
      backup_image_url: existingCdn
    };

    updateProduct(updated);
    try {
      await updateProductOnSheet(updated);
    } catch (e) {}

    showToast(
      isEnglish
        ? `Converted to repo link: ${repoPath}`
        : `ରିପୋ ଲିଙ୍କ୍ ସେଟ୍ ହେଲା: ${repoPath}`
    );
  };

  // New or Edit Product Form modal/card
  const [showForm, setShowForm] = useState(false);
  const [editingEan, setEditingEan] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodMrp, setProdMrp] = useState('');
  const [prodSp, setProdSp] = useState('');
  const [prodStock, setProdStock] = useState('15');
  const [prodCategory, setProdCategory] = useState('Grocery');
  const [prodEan, setProdEan] = useState('');
  const [prodEanList, setProdEanList] = useState<string[]>([]);
  const [additionalEanInput, setAdditionalEanInput] = useState('');
  const [eanScannerAction, setEanScannerAction] = useState<'primary' | 'add_more'>('primary');
  const [prodImage, setProdImage] = useState('');
  const [prodBackupImage, setProdBackupImage] = useState('');
  const [prodMaxOrderQty, setProdMaxOrderQty] = useState('10');
  const [prodGallery, setProdGallery] = useState<string[]>([]);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [showAddUrlInput, setShowAddUrlInput] = useState(false);
  const [prodVideoUrl, setProdVideoUrl] = useState('');
  const [prodDescription, setProdDescription] = useState('');

  // Barcode scanner modal state for EAN box & new product creation
  const [showEanScanner, setShowEanScanner] = useState(false);
  const [scannedExistingProduct, setScannedExistingProduct] = useState<Product | null>(null);

  // Helper: Filter out temporary Date.now() 13-digit placeholder timestamps starting with "17" when merging real EANs
  const filterGeneratedPlaceholderEans = (codes: string[], hasRealEan: boolean): string[] => {
    if (!hasRealEan) return codes;
    return codes.filter((c) => !(c.length === 13 && c.startsWith('17')));
  };

  // Auto-merge with an existing database product so no duplicate is created
  const mergeWithExistingDatabaseProduct = (
    existing: Product,
    incomingEans: string[],
    preserveCurrentFormDetails = true
  ) => {
    const existingEans = parseEanList(existing.ean, existing.additional_eans, existing.ean_list);
    const currentEans = filterGeneratedPlaceholderEans(
      parseEanList(prodEanList, prodEan),
      existingEans.length > 0 || incomingEans.length > 0
    );
    const mergedEans = parseEanList(existing.ean, existingEans, incomingEans, currentEans);

    setEditingEan(existing.ean);
    setScannedExistingProduct(existing);
    setProdEanList(mergedEans);
    setProdEan(mergedEans.join(', '));

    if (!preserveCurrentFormDetails || !prodName.trim()) {
      setProdName(existing.product_name);
    }
    if (!preserveCurrentFormDetails || !prodSp.trim()) {
      setProdSp(String(existing.selling_price));
    }
    if (!preserveCurrentFormDetails || !prodMrp.trim()) {
      setProdMrp(String(existing.mrp));
    }
    if (existing.stock_qty !== undefined && (!preserveCurrentFormDetails || !prodStock.trim())) {
      setProdStock(String(existing.stock_qty));
    }
    if (existing.category && (!preserveCurrentFormDetails || !prodCategory.trim())) {
      setProdCategory(existing.category);
    }
    if (existing.max_order_qty !== undefined && (!preserveCurrentFormDetails || !prodMaxOrderQty.trim())) {
      setProdMaxOrderQty(String(existing.max_order_qty));
    }
    if (existing.video_url && !prodVideoUrl.trim()) {
      setProdVideoUrl(existing.video_url);
    }
    if (existing.description && !prodDescription.trim()) {
      setProdDescription(existing.description);
    }

    // Merge gallery images from both existing product and current form (e.g. JioMart gallery)
    const existingGallery = parseGalleryImages(existing.gallery_images || existing.additional_images);
    if (existing.image_url && !existingGallery.includes(existing.image_url)) {
      existingGallery.unshift(existing.image_url);
    }
    if (existing.backup_image_url && !existingGallery.includes(existing.backup_image_url)) {
      existingGallery.push(existing.backup_image_url);
    }
    setProdGallery((prev) => Array.from(new Set([...prev, ...existingGallery].filter(Boolean))));

    if (!prodImage.trim() && existing.image_url) {
      setProdImage(existing.image_url);
    }
    if (!prodBackupImage.trim() && existing.backup_image_url) {
      setProdBackupImage(existing.backup_image_url);
    }
  };

  // Add one or more additional EANs (e.g. original product barcode alongside JioMart EAN)
  const handleAddMoreEan = (rawInput?: string) => {
    const inputVal = rawInput !== undefined ? rawInput : additionalEanInput;
    const newCodes = parseEanList(inputVal);
    if (newCodes.length === 0) {
      showToast(isEnglish ? 'Please enter or scan a valid EAN / Barcode' : 'ଦୟାକରି ସଠିକ୍ ବାରକୋଡ୍ (EAN) ଲେଖନ୍ତୁ କିମ୍ବା ସ୍କାନ୍ କରନ୍ତୁ');
      return;
    }

    const baseCodes = filterGeneratedPlaceholderEans(parseEanList(prodEanList, prodEan), true);
    const combinedCodes = parseEanList(baseCodes, newCodes);

    // Check if the newly added EAN matches an existing product in the catalog database
    const existingMatch = findProductByAnyEan(catalog, newCodes) || (!editingEan ? findProductByAnyEan(catalog, combinedCodes) : undefined);
    const isAlreadyEditingSameProduct = Boolean(editingEan && existingMatch && doesProductMatchEan(existingMatch, editingEan));

    if (existingMatch && !isAlreadyEditingSameProduct) {
      mergeWithExistingDatabaseProduct(existingMatch, combinedCodes, true);
      setAdditionalEanInput('');
      showToast(
        isEnglish
          ? `🔄 Old EAN matched "${existingMatch.product_name}"! Auto-switched to edit & merged all EANs (No duplicate).`
          : `🔄 ପୁରୁଣା EAN "${existingMatch.product_name}" ସହ ମିଳିଗଲା! ଡୁପ୍ଲିକେଟ୍ ନ ହୋଇ ପୁରୁଣା ପ୍ରୋଡକ୍ଟ ସହିତ ସବୁ EAN ଯୋଡ଼ାଗଲା ✅`
      );
      return;
    }

    setProdEanList(combinedCodes);
    setProdEan(combinedCodes.join(', '));
    setAdditionalEanInput('');
    showToast(
      isEnglish
        ? `✅ Added EAN (${newCodes.join(', ')})! Total ${combinedCodes.length} EANs will be saved.`
        : `✅ ନୂଆ ବାରକୋଡ୍ (${newCodes.join(', ')}) ଯୋଡ଼ାଗଲା! ମୋଟ ${combinedCodes.length} ଟି EAN ସେଭ୍ ହେବ।`
    );
  };

  const handleRemoveSingleEan = (codeToRemove: string) => {
    const remaining = prodEanList.filter((c) => c !== codeToRemove);
    setProdEanList(remaining);
    setProdEan(remaining.join(', '));
  };

  const handleMakePrimaryEan = (codeToPromote: string) => {
    const reordered = [codeToPromote, ...prodEanList.filter((c) => c !== codeToPromote)];
    setProdEanList(reordered);
    setProdEan(reordered.join(', '));
    showToast(
      isEnglish
        ? `⭐ Set ${codeToPromote} as Primary EAN`
        : `⭐ ${codeToPromote} କୁ ମୁଖ୍ୟ ବାରକୋଡ୍ (Primary EAN) କରାଗଲା`
    );
  };

  // JioMart search state & Manual Pincode for item availability by pincode
  const [jioQuery, setJioQuery] = useState('');
  const [jioPincode, setJioPincode] = useState<string>(() => {
    try {
      return localStorage.getItem('munna_jiomart_pincode') || '752106';
    } catch (e) {
      return '752106';
    }
  });
  const [lastSearchedPincode, setLastSearchedPincode] = useState<string>('');
  const [strictPincodeMode, setStrictPincodeMode] = useState<boolean>(true);
  const [showWorkerCodeHelper, setShowWorkerCodeHelper] = useState<boolean>(false);
  const [copiedWorkerCode, setCopiedWorkerCode] = useState<boolean>(false);
  const [jioSearchAttempted, setJioSearchAttempted] = useState(false);
  const [jioResults, setJioResults] = useState<JioMartSearchResult[]>([]);
  const [isSearchingJio, setIsSearchingJio] = useState(false);
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [isBatchUpdatingLimits, setIsBatchUpdatingLimits] = useState(false);

  const handleBarcodeScanned = async (scannedEan: string) => {
    const cleanEan = String(scannedEan).trim().replace(/^EAN-/, '');
    if (!cleanEan) return;

    // If product form is not open, open it first
    if (!showForm) {
      handleNewProduct(undefined, selectedCategory !== 'All' ? selectedCategory : 'Grocery');
    }

    // If triggered from "+ Scan Original EAN to Add", append to existing EAN list
    if (eanScannerAction === 'add_more') {
      handleAddMoreEan(cleanEan);
      setEanScannerAction('primary');
      return;
    }

    const baseCodes = filterGeneratedPlaceholderEans(parseEanList(prodEanList, prodEan), true);
    const combinedCodes = parseEanList(cleanEan, baseCodes);

    // Check if this EAN is already present anywhere in store catalog (primary or additional EANs)
    const existing = findProductByAnyEan(catalog, combinedCodes);

    if (existing) {
      mergeWithExistingDatabaseProduct(existing, combinedCodes, Boolean(prodName.trim()));
      showToast(
        isEnglish
          ? `✅ Barcode matched "${existing.product_name}"! Auto-loaded for editing with all EANs.`
          : `✅ ଏହି ବାରକୋଡ୍ ପୂର୍ବରୁ "${existing.product_name}" ନାମରେ ଅଛି! ଅଟୋ-ଏଡିଟ୍ ମୋଡ୍‌ରେ ଖୋଲିଗଲା।`
      );
    } else {
      setScannedExistingProduct(null);
      setProdEanList(combinedCodes);
      setProdEan(combinedCodes.join(', '));

      // If no custom image set yet, auto-prepare repo link
      if (!prodImage || isRepoUrl(prodImage)) {
        const repoPath = getRepoImagePath(prodCategory || 'Grocery', cleanEan);
        setProdImage(repoPath);
      }

      // Auto-trigger JioMart search using active manual pincode if product name is still empty
      if (!prodName.trim()) {
        const cleanPin = (jioPincode || '752106').replace(/\D/g, '').slice(0, 6) || '752106';
        setJioQuery(cleanEan);
        setIsSearchingJio(true);
        setJioSearchAttempted(true);
        setLastSearchedPincode(cleanPin);
        try {
          const results = await searchJioMartProducts(cleanEan, cleanPin, strictPincodeMode);
          if (results && results.length > 0) {
            setJioResults(results);
            const actualPin = results[0]?.pincode || cleanPin;
            if (actualPin !== cleanPin) {
              showToast(
                isEnglish
                  ? `⚠️ Worker returned Pin ${actualPin} instead of ${cleanPin} (Update Worker code for exact pincode)`
                  : `⚠️ ଆପଣ ${cleanPin} ଦେଇଥିଲେ କିନ୍ତୁ Worker ${actualPin} ରୁ ଡାଟା ଆଣିଛି!`
              );
            } else {
              showToast(
                isEnglish
                  ? `🔍 Found ${results.length} JioMart match at Pin ${actualPin}!`
                  : `🔍 ପିନକୋଡ୍ ${actualPin} ରେ ${results.length} ଟି ଉତ୍ପାଦ ମିଳିଲା!`
              );
            }
          }
        } catch (e) {} finally {
          setIsSearchingJio(false);
        }
      }
    }
  };

  // Complete Categories list & per-category product counts (no 6-category limit; case-insensitive deduplication)
  const { categories, categoryCounts } = useMemo(() => {
    const counts: Record<string, number> = { All: catalog.length };
    const lowerToCanonical: Record<string, string> = {};
    const orderedCats: string[] = [];

    catalog.forEach((p) => {
      const rawCat = String(p.category || 'General').replace(/&amp;/g, '&').trim() || 'General';
      const lowerKey = rawCat.toLowerCase();
      if (!lowerToCanonical[lowerKey]) {
        lowerToCanonical[lowerKey] = rawCat;
        orderedCats.push(rawCat);
        counts[rawCat] = 0;
      }
      const canonical = lowerToCanonical[lowerKey];
      counts[canonical] = (counts[canonical] || 0) + 1;
    });

    return {
      categories: ['All', ...orderedCats],
      categoryCounts: counts
    };
  }, [catalog]);

  // Stock health counts
  const outOfStockItems = catalog.filter((p) => {
    const s = typeof p.stock_qty === 'number' ? p.stock_qty : parseInt(p.stock_qty || '0', 10);
    return s <= 0;
  });

  const lowStockItems = catalog.filter((p) => {
    const s = typeof p.stock_qty === 'number' ? p.stock_qty : parseInt(p.stock_qty || '0', 10);
    return s > 0 && s <= 5;
  });

  const inStockCount = catalog.length - outOfStockItems.length;

  // Image statistics
  const repoImageCount = catalog.filter((p) => isRepoUrl(p.image_url)).length;
  const cdnImageCount = catalog.length - repoImageCount;
  const backupSavedCount = catalog.filter((p) => !!p.backup_image_url && p.backup_image_url.trim() !== '').length;
  const availableCdnCount = catalog.filter(
    (p) =>
      (!!p.backup_image_url && p.backup_image_url.trim() !== '') ||
      !!getOriginalCdnUrl(p.ean) ||
      (p.image_url && p.image_url.startsWith('http'))
  ).length;

  // Helper to check if product is pinned to Home Page upper section
  const isProductInHome = (ean: string | number) => {
    const rawTarget = String(ean).trim();
    const cleanTarget = rawTarget.replace(/^EAN-/, '').trim();
    const currentTrending = normalizeTrending(shopConfig.trending);
    return currentTrending.some(
      (t) => String(t).replace(/^EAN-/, '').trim() === cleanTarget || String(t).trim() === rawTarget
    );
  };

  // Products currently selected for Home Page in their exact sequence
  const homeSelectedProducts = useMemo(() => {
    const cleanTrending = normalizeTrending(shopConfig.trending);

    const list: Product[] = [];
    for (const trendEan of cleanTrending) {
      const cleanTarget = trendEan.replace(/^EAN-/, '').trim();
      const found = catalog.find((p) => {
        const pClean = String(p.ean).replace(/^EAN-/, '').trim();
        return pClean === cleanTarget || String(p.ean).trim() === trendEan;
      });
      if (found && !list.some((p) => String(p.ean) === String(found.ean))) {
        list.push(found);
      }
    }
    return list;
  }, [catalog, shopConfig.trending]);

  // Reorder Home Page item sequence (Move Up / Down)
  const handleMoveHomeItem = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= homeSelectedProducts.length) return;

    const list = [...homeSelectedProducts];
    const movedItem = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = movedItem;

    const nextTrending = list.map((p) => String(p.ean));
    updateShopConfig({ trending: nextTrending });
    showToast(
      isEnglish
        ? `Reordered "${movedItem.product_name}" to #${targetIndex + 1} on Home Page`
        : `"${movedItem.product_name}" କ୍ରମ #${targetIndex + 1} କୁ ବଦଳିଲା`
    );

    try {
      await pushConfigKeyToSheet('trending', nextTrending.join(', '));
    } catch (e) {}
  };

  // Clear all Home Page pins
  const handleClearAllHomePins = async () => {
    if (
      !confirm(
        isEnglish
          ? 'Are you sure you want to unpin all items from Home Page?'
          : 'ଆପଣ ନିଶ୍ଚିତ କି ହୋମ୍ ପେଜ୍‌ରୁ ସମସ୍ତ ପିନ୍ ହୋଇଥିବା ସାମଗ୍ରୀ ହଟାଇବାକୁ ଚାହାଁନ୍ତି?'
      )
    ) {
      return;
    }
    updateShopConfig({ trending: [] });
    showToast(isEnglish ? 'Unpinned all items from Home Page' : 'ହୋମ୍ ପେଜ୍‌ରୁ ସମସ୍ତ ସାମଗ୍ରୀ ହଟାଗଲା');
    try {
      await pushConfigKeyToSheet('trending', '');
    } catch (e) {}
  };

  const handleToggleTrending = async (ean: string, productName?: string) => {
    const strEan = String(ean).trim();
    const cleanEan = strEan.replace(/^EAN-/, '').trim();
    const curTrending = normalizeTrending(shopConfig.trending);
    const isTrending = curTrending.some(
      (t) => String(t).replace(/^EAN-/, '').trim() === cleanEan || String(t).trim() === strEan
    );
    const nextTrending = isTrending
      ? curTrending.filter((x) => String(x).replace(/^EAN-/, '').trim() !== cleanEan && String(x).trim() !== strEan)
      : [...curTrending, cleanEan || strEan];
    updateShopConfig({ trending: nextTrending });

    if (isTrending) {
      showToast(
        isEnglish
          ? `Removed "${productName || strEan}" from Home Page Top`
          : `"${productName || strEan}" ହୋମ୍ ପେଜ୍ ଉପରୁ ହଟାଗଲା`
      );
    } else {
      showToast(
        isEnglish
          ? `⭐ Pinned "${productName || strEan}" to Upper Home Page!`
          : `⭐ "${productName || strEan}" ହୋମ୍ ପେଜ୍ ଉପରେ ପିନ୍ ହେଲା!`
      );
    }

    try {
      await pushConfigKeyToSheet('trending', nextTrending.join(', '));
    } catch (e) {}
  };

  // Filtered catalog
  const filteredCatalog = catalog.filter((p) => {
    const s = typeof p.stock_qty === 'number' ? p.stock_qty : parseInt(p.stock_qty || '0', 10);
    if (stockHealthFilter === 'in_stock' && s <= 0) return false;
    if (stockHealthFilter === 'low_stock' && (s <= 0 || s > 5)) return false;
    if (stockHealthFilter === 'out_of_stock' && s > 0) return false;
    if (stockHealthFilter === 'trending' && !isProductInHome(p.ean)) return false;

    if (
      selectedCategory !== 'All' &&
      String(p.category || 'General').replace(/&amp;/g, '&').trim().toLowerCase() !== selectedCategory.trim().toLowerCase()
    ) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.product_name.toLowerCase().includes(q);
      const matchEan = doesProductContainEanSubstring(p, q);
      const matchCat = (p.category || '').toLowerCase().includes(q);
      if (!matchName && !matchEan && !matchCat) return false;
    }
    return true;
  });

  const handleSelectAllFiltered = () => {
    if (selectedEans.size === filteredCatalog.length && filteredCatalog.length > 0) {
      setSelectedEans(new Set());
    } else {
      setSelectedEans(new Set(filteredCatalog.map((p) => p.ean)));
    }
  };

  const selectedProducts = catalog.filter((p) => selectedEans.has(p.ean));

  // Auto-Send Queue Engine Refs & Helpers
  const autoSendActiveRef = useRef(autoSendActive);
  autoSendActiveRef.current = autoSendActive;
  const sentSetRef = useRef(sentIndividualEans);
  sentSetRef.current = sentIndividualEans;
  const selectedProductsRef = useRef(selectedProducts);
  selectedProductsRef.current = selectedProducts;
  const autoDelaySecondsRef = useRef(autoDelaySeconds);
  autoDelaySecondsRef.current = autoDelaySeconds;
  const autoAdvanceOnFocusRef = useRef(autoAdvanceOnFocus);
  autoAdvanceOnFocusRef.current = autoAdvanceOnFocus;

  const playAudioHapticCue = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.14);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.16);
      }
    } catch (e) {}

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (e) {}
  }, []);

  const buildWhatsAppSharePayload = useCallback((product: Product) => {
    const itemUrl = getProductShareUrl(product);
    const shareText = getProductShareText(product, itemUrl);

    const cleanDigits = targetCustomerPhone.replace(/\D/g, '');
    const phoneParam = cleanDigits.length === 10
      ? `phone=91${cleanDigits}&`
      : cleanDigits.length >= 11
        ? `phone=${cleanDigits}&`
        : '';

    return {
      waUrl: `https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(shareText)}`,
      itemUrl
    };
  }, [targetCustomerPhone]);

  const dispatchQueueItem = useCallback((product: Product) => {
    const { waUrl } = buildWhatsAppSharePayload(product);

    playAudioHapticCue();
    setLastDispatchedEan(product.ean);

    // Open WhatsApp
    const opened = window.open(waUrl, '_blank');
    if (!opened) {
      showToast(
        isEnglish
          ? 'Browser popup blocked! Click "Send Item" or allow popups.'
          : 'ବ୍ରାଉଜର୍ ପପ୍-ଅପ୍ ବ୍ଲକ୍ ହେଲା! ଦୟାକରି "Send" ବଟନ୍ ଦବାନ୍ତୁ।'
      );
    }

    // Mark as sent
    setSentIndividualEans((prev) => {
      const next = new Set(prev);
      next.add(product.ean);
      return next;
    });

    const curSent = new Set(sentSetRef.current);
    curSent.add(product.ean);

    const remaining = selectedProductsRef.current.filter((p) => !curSent.has(p.ean));
    if (remaining.length === 0) {
      setAutoSendActive(false);
      setCountdown(0);
      showToast(
        isEnglish
          ? '🎉 All selected products dispatched successfully!'
          : '🎉 ସମସ୍ତ ବଛାଯାଇଥିବା ସାମଗ୍ରୀ ସଫଳତାର ସହ ପଠାଗଲା!'
      );
    } else {
      const nextIdx = selectedProductsRef.current.findIndex((p) => !curSent.has(p.ean));
      if (nextIdx !== -1) {
        setQueueIndex(nextIdx);
      }
      setCountdown(autoDelaySecondsRef.current);
    }
  }, [buildWhatsAppSharePayload, playAudioHapticCue, isEnglish]);

  const handleStartAutoSequence = useCallback(() => {
    const unsent = selectedProducts.filter((p) => !sentIndividualEans.has(p.ean));
    if (unsent.length === 0) {
      showToast(
        isEnglish
          ? 'All selected products already sent! Click Reset to restart.'
          : 'ସମସ୍ତ ସାମଗ୍ରୀ ପଠାସରିଛି! ପୁଣି ଥରେ ପଠାଇବା ପାଇଁ ରିସେଟ୍ କରନ୍ତୁ।'
      );
      return;
    }

    setAutoSendActive(true);
    const firstUnsent = unsent[0];
    const firstIdx = selectedProducts.findIndex((p) => p.ean === firstUnsent.ean);
    if (firstIdx !== -1) setQueueIndex(firstIdx);

    dispatchQueueItem(firstUnsent);
    showToast(
      isEnglish
        ? `▶️ Auto sequence started! Sending ${unsent.length} products...`
        : `▶️ ଅଟୋ ସିକ୍ୟୁଏନ୍ସ ଆରମ୍ଭ ହେଲା! ${unsent.length} ଟି ସାମଗ୍ରୀ ପଠାଯାଉଛି...`
    );
  }, [selectedProducts, sentIndividualEans, dispatchQueueItem, isEnglish]);

  const handlePauseAutoSequence = useCallback(() => {
    setAutoSendActive(false);
    setCountdown(0);
    showToast(isEnglish ? '⏸️ Auto sequence paused' : '⏸️ ଅଟୋ ସିକ୍ୟୁଏନ୍ସ ବନ୍ଦ ରଖାଗଲା');
  }, [isEnglish]);

  const handleResetQueue = useCallback(() => {
    setAutoSendActive(false);
    setCountdown(0);
    setSentIndividualEans(new Set());
    setQueueIndex(0);
    setLastDispatchedEan(null);
    showToast(isEnglish ? '🔄 Queue progress reset to 0' : '🔄 କ୍ୟୁ ରିସେଟ୍ ହେଲା');
  }, [isEnglish]);

  // Countdown effect
  useEffect(() => {
    if (!autoSendActive) {
      return;
    }

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((c) => c - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (countdown === 0 && autoSendActive) {
      const nextUnsent = selectedProductsRef.current.find((p) => !sentSetRef.current.has(p.ean));
      if (nextUnsent) {
        dispatchQueueItem(nextUnsent);
      } else {
        setAutoSendActive(false);
      }
    }
  }, [autoSendActive, countdown, dispatchQueueItem]);

  // Window Focus Listener for instant continuation
  useEffect(() => {
    if (!showBulkShareModal) {
      setAutoSendActive(false);
      setCountdown(0);
      return;
    }

    const handleWindowFocus = () => {
      if (autoSendActiveRef.current && autoAdvanceOnFocusRef.current) {
        const nextUnsent = selectedProductsRef.current.find((p) => !sentSetRef.current.has(p.ean));
        if (nextUnsent) {
          dispatchQueueItem(nextUnsent);
        }
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [showBulkShareModal, dispatchQueueItem]);

  const handleStartEdit = (p: Product) => {
    setScannedExistingProduct(null);
    setEditingEan(p.ean);
    setProdName(p.product_name);
    setProdMrp(String(p.mrp));
    setProdSp(String(p.selling_price));
    setProdStock(String(p.stock_qty));
    setProdCategory(p.category || 'Grocery');
    const allProductEans = parseEanList(p.ean, p.additional_eans, p.ean_list);
    setProdEanList(allProductEans);
    setProdEan(allProductEans.join(', ') || String(p.ean));
    setAdditionalEanInput('');
    setProdImage(p.image_url);
    setProdBackupImage(p.backup_image_url || '');
    setProdVideoUrl(p.video_url || '');
    const initialDesc =
      p.description && p.description.trim() && p.description.trim().toLowerCase() !== p.product_name.trim().toLowerCase()
        ? p.description.trim()
        : extractOrGenerateProductDescription(
            {
              name: p.product_name,
              category: p.category,
              mrp: p.mrp,
              sp: p.selling_price,
              ean: p.ean,
              description: p.description
            },
            p.category || 'Grocery'
          );
    setProdDescription(initialDesc);
    setProdMaxOrderQty(String(p.max_order_qty !== undefined ? p.max_order_qty : 10));

    // Initialize gallery images
    const existingGallery: string[] = [];
    if (Array.isArray(p.gallery_images) && p.gallery_images.length > 0) {
      existingGallery.push(...p.gallery_images);
    } else if (p.additional_images) {
      existingGallery.push(...parseGalleryImages(p.additional_images));
    }
    if (p.image_url && !existingGallery.includes(p.image_url)) {
      existingGallery.unshift(p.image_url);
    }
    if (p.backup_image_url && !existingGallery.includes(p.backup_image_url)) {
      existingGallery.push(p.backup_image_url);
    }
    setProdGallery(Array.from(new Set(existingGallery.filter(Boolean))));
    setCustomImageUrl('');
    setShowAddUrlInput(false);

    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewProduct = (initialImageUrl?: string | React.MouseEvent, initialCategory?: string) => {
    setScannedExistingProduct(null);
    const imgUrl = typeof initialImageUrl === 'string' ? initialImageUrl : '';
    const cat = typeof initialCategory === 'string' ? initialCategory : (selectedCategory !== 'All' ? selectedCategory : 'Grocery');
    setEditingEan(null);
    setProdName('');
    setProdMrp('');
    setProdSp('');
    setProdStock('15');
    setProdCategory(cat);
    const defaultEan = String(Date.now());
    setProdEan(defaultEan);
    setProdEanList([]);
    setAdditionalEanInput('');
    setProdImage(imgUrl);
    setProdBackupImage(imgUrl);
    setProdVideoUrl('');
    setProdDescription('');
    setProdMaxOrderQty('10');
    setProdGallery(imgUrl ? [imgUrl] : []);
    setCustomImageUrl('');
    setShowAddUrlInput(false);
    setJioResults([]);
    setJioSearchAttempted(false);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAutoFillRepoPath = () => {
    const primaryCode = getPrimaryEan(prodEanList[0] || prodEan || editingEan || String(Date.now()));
    const repoPath = getRepoImagePath(prodCategory, primaryCode);
    if (prodImage && !isRepoUrl(prodImage)) {
      setProdBackupImage(prodImage);
    }
    setProdImage(repoPath);
    showToast(`Set Repo Path: ${repoPath}`);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim() || !prodSp) {
      alert('Please provide product name and selling price.');
      return;
    }

    // Collect all EANs from chips, main input, and any un-submitted text in the "+ Add More EAN" input
    const rawCollectedEans = parseEanList(prodEanList, prodEan, additionalEanInput, editingEan);
    const hasRealBarcode = rawCollectedEans.some((c) => !(c.length === 13 && c.startsWith('17')));
    const cleanedEanList = filterGeneratedPlaceholderEans(rawCollectedEans, hasRealBarcode);
    const finalEanList = cleanedEanList.length > 0 ? cleanedEanList : [String(Date.now())];

    // Check if ANY of finalEanList or editingEan matches an existing product in catalog to prevent duplicates!
    const existingProd =
      (editingEan ? catalog.find((x) => doesProductMatchEan(x, editingEan)) : undefined) ||
      findProductByAnyEan(catalog, finalEanList, prodName.trim());

    const mergedAllEans = existingProd
      ? parseEanList(finalEanList[0] || existingProd.ean, finalEanList, existingProd.ean, existingProd.additional_eans, existingProd.ean_list)
      : finalEanList;

    const primaryEan = mergedAllEans[0] || (existingProd ? existingProd.ean : String(Date.now()));
    const allEansCommaStr = mergedAllEans.join(', ');
    const prevEanForLookup = editingEan || existingProd?.ean || primaryEan;

    const parsedStockQty = parseProductStock(prodStock !== '' ? prodStock : '15');
    const cleanSp = String(prodSp).trim();
    const cleanMrp = String(prodMrp || prodSp).trim();
    const parsedMaxLimit = parseInt(prodMaxOrderQty, 10) || 10;
    const finalCategory = prodCategory.trim() || detectProductCategory(prodName.trim()) || 'General';
    const finalDescription =
      prodDescription.trim() ||
      extractOrGenerateProductDescription(
        {
          name: prodName.trim(),
          category: finalCategory,
          mrp: cleanMrp,
          sp: cleanSp,
          ean: allEansCommaStr
        },
        finalCategory
      );

    const productData: Product = {
      rowIndex: existingProd?.rowIndex,
      ean: primaryEan,
      additional_eans: allEansCommaStr,
      ean_list: mergedAllEans,
      product_name: prodName.trim(),
      mrp: cleanMrp,
      selling_price: cleanSp,
      stock_qty: parsedStockQty,
      category: finalCategory,
      description: finalDescription,
      image_url: prodImage.trim() || (prodGallery[0] || '/icon-512.png'),
      backup_image_url: prodBackupImage.trim() || (prodGallery[0] || undefined),
      video_url: prodVideoUrl.trim() || undefined,
      max_order_qty: parsedMaxLimit,
      additional_images: prodGallery.length > 0 ? prodGallery.join(', ') : undefined,
      gallery_images: prodGallery.length > 0 ? prodGallery : undefined
    };

    // Clear any stale inline rowEdits for this product so the table row immediately displays the new values
    setRowEdits((prev) => {
      const next = { ...prev };
      delete next[primaryEan];
      mergedAllEans.forEach((c) => delete next[c]);
      if (editingEan) delete next[editingEan];
      if (existingProd?.ean) delete next[existingProd.ean];
      return next;
    });

    if (existingProd || editingEan) {
      updateProduct(productData, prevEanForLookup);
      showToast(
        isEnglish
          ? `Updated "${productData.product_name}" (Rs.${cleanSp}, Qty: ${parsedStockQty}) with ${mergedAllEans.length} EAN(s)! ✅`
          : `"${productData.product_name}" (ମୂଲ୍ୟ Rs.${cleanSp}, ଷ୍ଟକ୍ ${parsedStockQty}, ${mergedAllEans.length} ଟି EAN) ଅପଡେଟ୍ ହେଲା! ✅`
      );
    } else {
      addProduct(productData);
      showToast(
        isEnglish
          ? `Added "${productData.product_name}" (Rs.${cleanSp}, Qty: ${parsedStockQty}) with ${mergedAllEans.length} EAN(s)! ✅`
          : `"${productData.product_name}" (ମୂଲ୍ୟ Rs.${cleanSp}, ଷ୍ଟକ୍ ${parsedStockQty}, ${mergedAllEans.length} ଟି EAN) ଯୋଡ଼ାଗଲା! ✅`
      );
    }

    setAdditionalEanInput('');
    setShowForm(false);

    // Live sync to Google Apps Script Sheet (saves all multiple EANs, quantity, price, and details to Sheet)
    setSavingEan(primaryEan);
    try {
      await updateProductOnSheet({
        ean: primaryEan,
        previous_ean: prevEanForLookup,
        additional_eans: allEansCommaStr,
        ean_list: mergedAllEans,
        rowIndex: existingProd?.rowIndex,
        stock_qty: parsedStockQty,
        selling_price: cleanSp,
        mrp: cleanMrp,
        product_name: productData.product_name,
        category: productData.category,
        description: productData.description,
        image_url: productData.image_url,
        backup_image_url: productData.backup_image_url,
        video_url: productData.video_url,
        max_order_qty: productData.max_order_qty,
        additional_images: productData.additional_images,
        gallery_images: productData.gallery_images
      });
      setSavedSuccessEan(primaryEan);
      setTimeout(() => {
        setSavedSuccessEan((prev) => (prev === primaryEan ? null : prev));
      }, 2500);
    } catch (err) {
      // Handled by local override
    } finally {
      setSavingEan((prev) => (prev === primaryEan ? null : prev));
    }
  };

  // Quick In-Stock / Out-of-Stock toggle
  const handleToggleStock = async (p: Product) => {
    const curStock = parseProductStock(p.stock_qty);
    const nextStock = curStock > 0 ? 0 : 15;

    const updated = { ...p, stock_qty: nextStock };
    updateProduct(updated);

    // Clear any pending draft stock for this item
    setRowEdits((prev) => {
      if (!prev[p.ean]) return prev;
      const next = { ...prev };
      delete next[p.ean].stock_qty;
      if (Object.keys(next[p.ean]).length === 0) {
        delete next[p.ean];
      }
      return next;
    });

    setSavingEan(p.ean);
    await updateProductStockOnSheet(p.ean, nextStock, p.rowIndex, p.product_name);
    setSavingEan(null);
    setSavedSuccessEan(p.ean);
    setTimeout(() => setSavedSuccessEan(null), 2000);
  };

  // Manual inline edits handlers (No auto-saving on typing/blur until user clicks Save)
  const handleRowFieldChange = (
    ean: string,
    field: 'selling_price' | 'mrp' | 'stock_qty' | 'max_order_qty',
    val: string
  ) => {
    setHasUnsavedAdminChanges(true);
    setRowEdits((prev) => ({
      ...prev,
      [ean]: {
        ...prev[ean],
        [field]: val
      }
    }));
  };

  const handleCancelRowEdits = (ean: string) => {
    setRowEdits((prev) => {
      const next = { ...prev };
      delete next[ean];
      if (Object.keys(next).length === 0) {
        setHasUnsavedAdminChanges(false);
      }
      return next;
    });
  };

  const isRowDirty = (p: Product) => {
    const draft = rowEdits[p.ean];
    if (!draft) return false;
    if (draft.selling_price !== undefined && String(draft.selling_price).trim() !== String(p.selling_price).trim()) return true;
    if (draft.mrp !== undefined && String(draft.mrp).trim() !== String(p.mrp).trim()) return true;
    if (draft.stock_qty !== undefined && String(draft.stock_qty).trim() !== String(p.stock_qty).trim()) return true;
    if (draft.max_order_qty !== undefined && String(draft.max_order_qty).trim() !== String(p.max_order_qty ?? 10).trim()) return true;
    return false;
  };

  const handleSaveRowEdits = async (p: Product) => {
    const draft = rowEdits[p.ean] || {};
    const nextSp = draft.selling_price !== undefined ? draft.selling_price.trim() : String(p.selling_price);
    const nextMrp = draft.mrp !== undefined ? draft.mrp.trim() : String(p.mrp);
    const nextStock = draft.stock_qty !== undefined ? parseProductStock(draft.stock_qty) : parseProductStock(p.stock_qty);
    const nextMax = draft.max_order_qty !== undefined ? (parseInt(draft.max_order_qty, 10) || 10) : (p.max_order_qty ?? 10);

    const updated: Product = {
      ...p,
      selling_price: nextSp || p.selling_price,
      mrp: nextMrp || p.mrp || nextSp,
      stock_qty: nextStock,
      max_order_qty: nextMax
    };

    updateProduct(updated);

    // Clear draft for this product
    setRowEdits((prev) => {
      const next = { ...prev };
      delete next[p.ean];
      if (Object.keys(next).length === 0) {
        setHasUnsavedAdminChanges(false);
      }
      return next;
    });

    setSavingEan(p.ean);
    try {
      await updateProductOnSheet({
        ean: p.ean,
        additional_eans: p.additional_eans,
        ean_list: p.ean_list,
        rowIndex: p.rowIndex,
        product_name: p.product_name,
        stock_qty: nextStock,
        selling_price: nextSp,
        mrp: nextMrp,
        max_order_qty: nextMax,
        category: p.category,
        description: p.description,
        image_url: p.image_url,
        backup_image_url: p.backup_image_url,
        video_url: p.video_url,
        additional_images: p.additional_images,
        gallery_images: p.gallery_images
      });
      setSavedSuccessEan(p.ean);
      resumeBackgroundSync(false);
      showToast(isEnglish ? `Saved ${p.product_name}! ✅` : `${p.product_name} ସେଭ୍ ହେଲା! ✅`);
      setTimeout(() => {
        setSavedSuccessEan((prev) => (prev === p.ean ? null : prev));
      }, 2500);
    } catch (err) {
      showToast(isEnglish ? 'Error saving changes to sheet' : 'ସିଟ୍‌ରେ ସେଭ୍ କରିବାରେ ତ୍ରୁଟି ହେଲା');
    } finally {
      setSavingEan((prev) => (prev === p.ean ? null : prev));
    }
  };

  const handleSaveAllRowEdits = async () => {
    const dirtyItems = catalog.filter((p) => isRowDirty(p));
    if (dirtyItems.length === 0) return;

    setIsSavingAll(true);
    try {
      for (const p of dirtyItems) {
        await handleSaveRowEdits(p);
      }
      setHasUnsavedAdminChanges(false);
      resumeBackgroundSync(false);
      showToast(isEnglish ? `Saved all ${dirtyItems.length} products! ✅` : `ସମସ୍ତ ${dirtyItems.length} ଟି ସାମଗ୍ରୀ ସେଭ୍ ହେଲା! ✅`);
    } catch (e) {
      showToast('Error saving all changes');
    } finally {
      setIsSavingAll(false);
    }
  };

  // Listen for Master "💾 Save All to Sheet" button in AdminPanel top bar so staged price/MRP/qty edits are also saved
  useEffect(() => {
    const onFlushCatalogEdits = () => {
      handleSaveAllRowEdits();
    };
    window.addEventListener('munna-flush-catalog-edits', onFlushCatalogEdits);
    return () => {
      window.removeEventListener('munna-flush-catalog-edits', onFlushCatalogEdits);
    };
  });

  const dirtyCount = useMemo(() => {
    return catalog.filter((p) => isRowDirty(p)).length;
  }, [catalog, rowEdits]);

  // Backward compatibility aliases
  const handleInlineChange = handleRowFieldChange;
  const handleInlinePriceChange = handleRowFieldChange;

  // Batch set all products default max order limit (e.g. 10pc)
  const handleBatchSetAllMaxLimits = async (limit = 10) => {
    if (
      !confirm(
        isEnglish
          ? `⚡ Set maximum order limit to ${limit} units per item for ALL ${catalog.length} products in store? Customers won't be able to add more than ${limit} of any item.`
          : `⚡ ସମସ୍ତ ${catalog.length} ଟି ସାମଗ୍ରୀ ପାଇଁ ଗ୍ରାହକ ପ୍ରତି ସର୍ବାଧିକ ଅର୍ଡର ସୀମା ${limit} ଟି (Max ${limit}pc/user) ସେଟ୍ କରିବାକୁ ଚାହାଁନ୍ତି କି?`
      )
    ) {
      return;
    }

    setIsBatchUpdatingLimits(true);
    try {
      const updatedList = catalog.map((p) => ({
        ...p,
        max_order_qty: limit
      }));
      setCatalog(updatedList);
      try {
        localStorage.setItem('munna_store_catalog', JSON.stringify(updatedList));
      } catch (e) {}

      await batchUpdateProductsOnSheet(updatedList);
      showToast(
        isEnglish
          ? `✅ Successfully set default max limit ${limit}pc for all ${catalog.length} products!`
          : `✅ ସମସ୍ତ ${catalog.length} ଟି ସାମଗ୍ରୀ ପାଇଁ ସର୍ବାଧିକ ଅର୍ଡର ସୀମା ${limit}pc ସଫଳତାର ସହ ସେଟ୍ ହେଲା!`
      );
    } catch (e) {
      showToast('Error setting batch order limits');
    } finally {
      setIsBatchUpdatingLimits(false);
    }
  };

  const handleJioSearch = async (overrideQuery?: string, overridePincode?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : (jioQuery || prodName)).trim();
    if (!q) {
      showToast(
        isEnglish
          ? 'Please enter a product name or barcode to search JioMart'
          : 'ଦୟାକରି JioMart ରେ ଖୋଜିବା ପାଇଁ ସାମଗ୍ରୀର ନାମ ବା ବାରକୋଡ୍ ଲେଖନ୍ତୁ'
      );
      return;
    }
    const rawPin = overridePincode !== undefined ? overridePincode : jioPincode;
    const cleanPin = (rawPin || '752106').replace(/\D/g, '').slice(0, 6) || '752106';
    if (cleanPin !== jioPincode) {
      setJioPincode(cleanPin);
    }
    try {
      localStorage.setItem('munna_jiomart_pincode', cleanPin);
    } catch (e) {}

    setIsSearchingJio(true);
    setJioSearchAttempted(true);
    setLastSearchedPincode(cleanPin);
    try {
      const results = await searchJioMartProducts(q, cleanPin, strictPincodeMode);
      setJioResults(results);
      if (results.length > 0) {
        const actualPin = results[0]?.pincode || cleanPin;
        const sellableCount = results.filter((r) => r.sellable !== false).length;
        if (actualPin !== cleanPin) {
          showToast(
            isEnglish
              ? `⚠️ Searched Pin ${cleanPin}, but Worker returned Pin ${actualPin}! Please update Worker code.`
              : `⚠️ ଆପଣ ପିନକୋଡ୍ ${cleanPin} ଖୋଜିଥିଲେ, କିନ୍ତୁ ପୁରୁଣା Worker କୋଡ୍ ଯୋଗୁଁ ${actualPin} ରୁ ରେଜଲ୍ଟ ଆସିଛି!`
          );
        } else {
          showToast(
            isEnglish
              ? `✅ Pin ${actualPin}: ${sellableCount}/${results.length} item(s) In-Stock (Sellable)`
              : `✅ ପିନକୋଡ୍ ${actualPin} ରେ ${results.length} ରୁ ${sellableCount} ଟି ସାମଗ୍ରୀ ଷ୍ଟକ୍‌ରେ ଅଛି`
          );
        }
      } else {
        showToast(
          isEnglish
            ? `⚠️ No items found at Pincode ${cleanPin}. Try changing Pincode!`
            : `⚠️ ପିନକୋଡ୍ ${cleanPin} ରେ ମିଳିଲା ନାହିଁ। ଅନ୍ୟ ପିନକୋଡ୍ ଦେଇ ଖୋଜନ୍ତୁ!`
        );
      }
    } finally {
      setIsSearchingJio(false);
    }
  };

  const handleSelectJioItem = (item: any) => {
    if (item.name) setProdName(item.name);
    if (item.mrp) setProdMrp(String(item.mrp));
    if (item.sp || item.selling_price || item.price) setProdSp(String(item.sp || item.selling_price || item.price));

    // Auto-detect store category from product title & JioMart metadata
    const detectedCategory = detectProductCategory(item.name, item.category, item);
    setProdCategory(detectedCategory);

    // Extract all JioMart EANs / barcodes / SKUs and combine with any existing non-placeholder EANs in form
    const jioEans = parseEanList(item.ean, item.eans, item.additional_eans, item.id);
    const existingFormEans = filterGeneratedPlaceholderEans(parseEanList(prodEanList, prodEan, editingEan), jioEans.length > 0);
    const candidateEans = parseEanList(existingFormEans, jioEans);

    // Check if an old product in the database already matches ANY of these EANs or product name!
    const matchedOldProduct =
      (editingEan ? catalog.find((p) => doesProductMatchEan(p, editingEan)) : undefined) ||
      findProductByAnyEan(catalog, candidateEans, item.name);

    let finalMergedEans = candidateEans;
    if (matchedOldProduct) {
      finalMergedEans = parseEanList(
        matchedOldProduct.ean,
        matchedOldProduct.additional_eans,
        matchedOldProduct.ean_list,
        candidateEans
      );
      setEditingEan(matchedOldProduct.ean);
      setScannedExistingProduct(matchedOldProduct);
      if (matchedOldProduct.stock_qty !== undefined && prodStock === '15') {
        setProdStock(String(matchedOldProduct.stock_qty));
      }
      if (matchedOldProduct.max_order_qty !== undefined) {
        setProdMaxOrderQty(String(matchedOldProduct.max_order_qty));
      }
    }

    setProdEanList(finalMergedEans);
    setProdEan(finalMergedEans.join(', '));

    if (item.video_url || item.video) {
      setProdVideoUrl(String(item.video_url || item.video));
    }

    // Auto-extract / generate and copy rich Product Description from JioMart item
    const autoDesc = extractOrGenerateProductDescription(item, detectedCategory);
    setProdDescription(autoDesc);
    try {
      if (navigator.clipboard && autoDesc) {
        navigator.clipboard.writeText(autoDesc).catch(() => {});
      }
    } catch (e) {}

    // 1. Extract all photos from item.images, item.medias, and item.image
    const extractedImages: string[] = [];
    if (Array.isArray(item.images)) {
      extractedImages.push(...item.images);
    }
    if (item.image && !extractedImages.includes(item.image)) {
      extractedImages.unshift(item.image);
    }
    if (Array.isArray(item.medias)) {
      item.medias.forEach((m: any) => {
        const u = typeof m === 'string' ? m : (m?.url || m?.image || m?.src);
        if (u && !extractedImages.includes(u)) extractedImages.push(u);
      });
    }

    const cleanGallery = Array.from(new Set(extractedImages.map((s) => String(s).trim()).filter(Boolean)));
    setProdGallery(cleanGallery);

    // 2. Set primary image directly to the high-res JioMart photo so it works immediately everywhere
    const primaryImg = cleanGallery[0] || item.image || '';
    if (primaryImg) {
      setProdImage(primaryImg);
      setProdBackupImage(primaryImg);
    }

    if (matchedOldProduct) {
      showToast(
        isEnglish
          ? `🔄 Auto-matched existing "${matchedOldProduct.product_name}"! Merged ${finalMergedEans.length} EAN(s) & JioMart details (No duplicate).`
          : `🔄 ପୁରୁଣା "${matchedOldProduct.product_name}" ସହ ଅଟୋ-ମ୍ୟାଚ୍ ହେଲା! ${finalMergedEans.length} ଟି EAN ଓ JioMart ତଥ୍ୟ ଯୋଡ଼ାଗଲା (ଡୁପ୍ଲିକେଟ୍ ହେବ ନାହିଁ) ✅`
      );
    } else {
      showToast(
        isEnglish
          ? `Auto-filled "${detectedCategory}", JioMart EAN (${jioEans.join(', ')}), Description & ${cleanGallery.length} photos! ✅`
          : `"${detectedCategory}" କାଟାଗୋରୀ, JioMart EAN (${jioEans.join(', ')}), ବିବରଣୀ ଓ ${cleanGallery.length} ଟି ଫଟୋ ଅଟୋ-କପି ହେଲା! ✅`
      );
    }

    setJioResults([]);
  };

  const handleAddCustomImageUrl = () => {
    if (!customImageUrl.trim()) return;
    let urlToAdd = customImageUrl.trim();
    if (urlToAdd.includes('drive.google.com') || urlToAdd.includes('docs.google.com')) {
      const direct = normalizeGoogleDriveImageUrl(urlToAdd);
      if (direct) urlToAdd = direct;
    }
    setProdGallery((prev) => {
      if (prev.includes(urlToAdd)) return prev;
      return [...prev, urlToAdd];
    });
    if (!prodImage || prodImage === '/icon-512.png') {
      setProdImage(urlToAdd);
      setProdBackupImage(urlToAdd);
    }
    setCustomImageUrl('');
    setShowAddUrlInput(false);
    showToast(isEnglish ? 'Added photo to gallery! 📸' : 'ଗ୍ୟାଲେରୀରେ ଫଟୋ ଯୋଡ଼ାଗଲା! 📸');
  };

  const handleSetPrimaryGalleryImage = (imgUrl: string) => {
    setProdImage(imgUrl);
    setProdBackupImage(imgUrl);
    setProdGallery((prev) => {
      const rest = prev.filter((u) => u !== imgUrl);
      return [imgUrl, ...rest];
    });
    showToast(isEnglish ? '⭐ Set as Primary Cover Photo!' : '⭐ ମୁଖ୍ୟ କଭର୍ ଫଟୋ ଭାବେ ସେଟ୍ ହେଲା!');
  };

  const handleRemoveGalleryImage = (imgUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProdGallery((prev) => {
      const next = prev.filter((u) => u !== imgUrl);
      if (prodImage === imgUrl || prodBackupImage === imgUrl) {
        if (next.length > 0) {
          setProdImage(next[0]);
          setProdBackupImage(next[0]);
        } else {
          setProdImage('');
          setProdBackupImage('');
        }
      }
      return next;
    });
    showToast(isEnglish ? 'Removed photo from gallery' : 'ଗ୍ୟାଲେରୀରୁ ଫଟୋ ହଟାଗଲା');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploadingImg(true);
    try {
      const res = await uploadAndGenerateImageLink(file);
      if (res.success && res.data) {
        const directUrl = res.data.url;
        setProdImage(directUrl);
        setProdBackupImage(directUrl);
        setProdGallery((prev) => {
          if (prev.includes(directUrl)) return prev;
          return [directUrl, ...prev];
        });
        saveToRecentImages(directUrl, file.name);
        showToast(
          isEnglish
            ? 'Uploaded photo & added to gallery! ✅'
            : 'ଫଟୋ ଅପଲୋଡ୍ ହେଲା ଓ ଗ୍ୟାଲେରୀରେ ଯୋଡ଼ାଗଲା! ✅'
        );
      } else {
        alert(res.error || 'Image upload failed. Please try a different photo.');
      }
    } catch (err: any) {
      alert('Upload error: ' + (err?.message || 'Network error'));
    } finally {
      setIsUploadingImg(false);
      e.target.value = '';
    }
  };

  const handleHubUpload = async (file: File) => {
    setHubImageFile(file);
    setIsUploadingHub(true);
    setGeneratedHubUrl('');
    try {
      const result = await uploadAndGenerateImageLink(file);
      if (result.success && result.data) {
        setGeneratedHubUrl(result.data.url);
        setGeneratedMeta({
          fileName: result.data.fileName,
          sizeKb: result.data.sizeKb,
          source: result.data.source
        });
        saveToRecentImages(result.data.url, file.name);
        showToast(
          isEnglish
            ? '✅ Image uploaded & link generated successfully!'
            : '✅ ଫଟୋ ଅପଲୋଡ୍ ହେଲା ଏବଂ ଲିଙ୍କ୍ ପ୍ରସ୍ତୁତ ହୋଇଗଲା!'
        );
      } else {
        alert(result.error || 'Upload failed. Please try a different photo.');
      }
    } catch (e: any) {
      alert('Upload error: ' + (e?.message || 'Network error'));
    } finally {
      setIsUploadingHub(false);
    }
  };

  const handleCopyGeneratedLink = (urlToCopy?: string) => {
    const url = urlToCopy || generatedHubUrl;
    if (!url) return;
    navigator.clipboard.writeText(url);
    setIsCopiedHubLink(true);
    showToast(isEnglish ? '📋 Image Link Copied!' : '📋 ଫଟୋ ଲିଙ୍କ୍ କପି ହୋଇଗଲା!');
    setTimeout(() => setIsCopiedHubLink(false), 2000);
  };

  const handleConvertDriveUrl = () => {
    if (!driveUrlInput.trim()) return;
    const direct = normalizeGoogleDriveImageUrl(driveUrlInput.trim());
    if (direct) {
      setGeneratedHubUrl(direct);
      setGeneratedMeta({ fileName: 'Google Drive Image', sizeKb: 0, source: 'google_drive' });
      saveToRecentImages(direct, 'Google Drive Photo');
      showToast(isEnglish ? '✨ Converted Google Drive link to direct link!' : '✨ ଗୁଗୁଲ୍ ଡ୍ରାଇଭ୍ ଲିଙ୍କ୍ ଡାଇରେକ୍ଟ ଲିଙ୍କ୍ ରେ ପରିବର୍ତ୍ତିତ ହେଲା!');
    } else {
      showToast('Please enter a valid Google Drive link');
    }
  };

  const handleAssignImageToProduct = async (product: Product, urlToAssign: string) => {
    if (!urlToAssign) return;
    setIsAssigning(true);
    try {
      const updated: Product = {
        ...product,
        image_url: urlToAssign,
        backup_image_url: urlToAssign
      };
      updateProduct(updated);
      await updateProductOnSheet({
        ean: product.ean,
        stock_qty: product.stock_qty,
        selling_price: product.selling_price,
        mrp: product.mrp,
        product_name: product.product_name,
        category: product.category,
        image_url: urlToAssign,
        backup_image_url: urlToAssign,
        max_order_qty: product.max_order_qty
      });
      showToast(
        isEnglish
          ? `✅ Image updated for "${product.product_name}"!`
          : `✅ "${product.product_name}" ରେ ନୂଆ ଫଟୋ ଲିଙ୍କ୍ ସଫଳତାର ସହ ଯୋଡ଼ାଗଲା!`
      );
      setSelectedProductToAssign(null);
    } catch (e) {
      showToast('Error updating product image on Google Sheet');
    } finally {
      setIsAssigning(false);
    }
  };

  const assignCatalogMatches = useMemo(() => {
    if (!assignSearchQuery.trim()) {
      return catalog.slice(0, 8);
    }
    const q = assignSearchQuery.toLowerCase().trim();
    return catalog.filter(
      (p) =>
        (p.product_name || '').toLowerCase().includes(q) ||
        doesProductContainEanSubstring(p, q) ||
        (p.category || '').toLowerCase().includes(q)
    ).slice(0, 15);
  }, [catalog, assignSearchQuery]);


  return (
    <div className="space-y-4">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            <span>Catalog & Inventory Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEnglish
              ? 'Real-time stock controls, pricing updates, and instant Google Sheet sync'
              : 'ଷ୍ଟକ୍ ପରିମାଣ ଓ ମୂଲ୍ୟ ପରିଚାଳନା ଏବଂ ଲାଇଭ୍ ଗୁଗୁଲ୍ ସିଟ୍ ସିଙ୍କ୍'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowImageUploader(!showImageUploader)}
            className={`px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer ${
              showImageUploader
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                : 'bg-emerald-50 border border-emerald-300 text-emerald-900 hover:bg-emerald-100'
            }`}
            title="Upload image file or take photo to generate direct link for new products or catalogue"
          >
            <Camera className={`w-3.5 h-3.5 ${showImageUploader ? 'text-white' : 'text-emerald-700'}`} />
            <span>{isEnglish ? '📸 Upload & Link Gen' : '📸 ଫଟୋ ଅପଲୋଡ୍ ଓ ଲିଙ୍କ୍'}</span>
          </button>
          <button
            onClick={() => setShowImageManager(!showImageManager)}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer ${
              showImageManager ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-white hover:bg-slate-900'
            }`}
            title="Image Storage & CDN Migration"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>📸 Image & CDN Hub</span>
          </button>
          <button
            onClick={handleRestoreAllToCdnLinks}
            disabled={isConvertingLinks}
            className="px-3 py-2 rounded-xl bg-sky-50 border border-sky-300 hover:bg-sky-100 text-sky-900 font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
            title="Restore all product images back to original cloud CDN links"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isConvertingLinks ? 'animate-spin text-sky-600' : 'text-sky-700'}`} />
            <span>{isConvertingLinks ? 'Restoring...' : '🔄 Restore CDN'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (isSyncPaused) {
                resumeBackgroundSync(true);
              } else {
                pauseBackgroundSync(5);
              }
            }}
            className={`px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer ${
              isSyncPaused
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-2 ring-amber-200'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
            title={
              isSyncPaused
                ? 'Click to resume background sync immediately'
                : 'Pause background sync for 5 minutes while editing products (auto-resumes after 5m or when Save is clicked)'
            }
          >
            {isSyncPaused ? <Play className="w-3.5 h-3.5 fill-slate-950" /> : <Pause className="w-3.5 h-3.5" />}
            <span>
              {isSyncPaused
                ? `▶️ Resume (${Math.floor(pauseSyncRemainingSec / 60)}:${String(pauseSyncRemainingSec % 60).padStart(2, '0')})`
                : (isEnglish ? '⏸️ Pause Sync (5m)' : '⏸️ ୫ ମି. ସିଙ୍କ୍ ବନ୍ଦ')}
            </span>
          </button>
          <button
            onClick={handleSyncWithSheet}
            disabled={isSyncingSheet}
            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            title="Fetch all products from Google Sheet"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin' : ''}`} />
            <span>{isSyncingSheet ? 'Syncing...' : '🔄 Sync Products'}</span>
          </button>
          <button
            type="button"
            onClick={handlePushAllToSheet}
            disabled={isSyncingSheet}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            title="Save all products (Price, Quantity, Multiple EANs, Photos & Description) to Google Sheet"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isEnglish ? '☁️ Save All to Sheet' : '☁️ ସିଟ୍‌ରେ ସବୁ ସେଭ୍ କରନ୍ତୁ'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowEanScanner(true)}
            className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
            title="Scan Barcode with Camera to Add or Update Product"
          >
            <Barcode className="w-4 h-4 text-emerald-700" />
            <span>📷 Scan Barcode</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const nextMode = !isSelectMode;
              setIsSelectMode(nextMode);
              if (!nextMode) {
                setSelectedEans(new Set());
              }
            }}
            className={`px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer ${
              isSelectMode
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white'
            }`}
            title="Bulk Share items to Customer / WhatsApp Group"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{isSelectMode ? (isEnglish ? 'Exit Select' : 'ଚୟନ ବନ୍ଦ') : (isEnglish ? '📢 Bulk Share' : '📢 ବଲ୍କ ଶେୟାର')}</span>
            {selectedEans.size > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white text-emerald-800 text-[10px] font-black">
                {selectedEans.size}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShareRefreshProduct(catalog[0] || null)}
            className="px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
            title="Create or Refresh WhatsApp Share Link & Test Short-Link Preview for any product"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isEnglish ? '🔗 WhatsApp Link & Preview' : '🔗 WhatsApp ଲିଙ୍କ୍ ଓ ପ୍ରିଭ୍ୟୁ'}</span>
          </button>
          <button
            type="button"
            onClick={handleResetAllProductLinks}
            disabled={isResettingAllShareLinks}
            className="px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-400 disabled:opacity-60"
            title="1-Click Reset All Products Links across Frontend and Backend (Heals broken photo paths & refreshes WhatsApp cache)"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResettingAllShareLinks ? 'animate-spin' : ''}`} />
            <span>
              {isResettingAllShareLinks
                ? (isEnglish ? 'Resetting Links...' : 'ରିସେଟ୍ ହେଉଛି...')
                : (isEnglish ? '⚡ Reset All Links (FE+BE)' : '⚡ ସବୁ ପ୍ରୋଡକ୍ଟ ଲିଙ୍କ୍ ରିସେଟ୍')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              const nextVal = !isHomePageSetupMode;
              setIsHomePageSetupMode(nextVal);
              if (nextVal) {
                setShowSelectedInUpperPage(true);
              }
            }}
            className={`px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer ${
              isHomePageSetupMode
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-md'
                : 'bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100'
            }`}
            title="Toggle Home Page Setup: First show selected items in upper page, then all items on scroll down"
          >
            <Home className="w-3.5 h-3.5 text-amber-600" />
            <span>{isHomePageSetupMode ? (isEnglish ? '✓ Home Setup ON' : '✓ ହୋମ୍ ସେଟଅପ୍ ଚାଲୁ') : (isEnglish ? '🏠 Setup Home Page' : '🏠 ହୋମ୍ ପେଜ୍ ସେଟଅପ୍')}</span>
            {homeSelectedProducts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-950 text-[10px] font-black">
                {homeSelectedProducts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => handleNewProduct()}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      {/* 📸 IMAGE UPLOADER & PUBLIC LINK GENERATOR HUB */}
      {showImageUploader && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-4 sm:p-6 rounded-3xl border-2 border-emerald-500/50 shadow-2xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-lg">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <span>Product Photo Upload & Public Link Generator</span>
                  <span className="text-[10px] bg-emerald-400 text-emerald-950 font-black px-2 py-0.5 rounded-full">
                    Instant Link
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {isEnglish
                    ? 'Upload product photos from mobile camera or storage to generate public links for new products or catalogue.'
                    : 'ମୋବାଇଲ୍ କ୍ୟାମେରା ବା ଫାଇଲ୍‌ରୁ ଫଟୋ ଅପଲୋଡ୍ କରି ନୂଆ ପ୍ରୋଡକ୍ଟ କିମ୍ବା କାଟାଲଗ୍ ପାଇଁ ତୁରନ୍ତ ଲିଙ୍କ୍ ପ୍ରସ୍ତୁତ କରନ୍ତୁ।'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowImageUploader(false)}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column: Upload Dropzone & Drive Converter */}
            <div className="space-y-3">
              {/* Dropzone */}
              <label
                className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isUploadingHub
                    ? 'border-emerald-400 bg-emerald-950/40 pointer-events-none'
                    : 'border-slate-600 hover:border-emerald-400 bg-slate-800/60 hover:bg-slate-800/90'
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleHubUpload(e.target.files[0]);
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                  disabled={isUploadingHub}
                />
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2.5">
                  {isUploadingHub ? (
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>
                <span className="text-xs font-black text-white block">
                  {isUploadingHub
                    ? (isEnglish ? 'Compressing & Generating Public Link...' : 'ଫଟୋ କମ୍ପ୍ରେସ୍ ହେଉଛି ଓ ଲିଙ୍କ୍ ତିଆରି ହେଉଛି...')
                    : (isEnglish ? 'Click or Tap to Choose Photo (Camera / Gallery)' : 'କ୍ୟାମେରା ବା ଗ୍ୟାଲେରୀରୁ ଫଟୋ ବାଛନ୍ତୁ (ଟ୍ୟାପ୍ କରନ୍ତୁ)')}
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Supports JPG, PNG, WEBP • Auto-compressed for rapid WhatsApp & Store display
                </span>
              </label>

              {/* Google Drive Link Converter */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-3 rounded-2xl space-y-1.5">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Google Drive Link Converter (ଡ୍ରାଇଭ୍ ଲିଙ୍କ୍ ରୁ ଡାଇରେକ୍ଟ ଲିଙ୍କ୍)</span>
                </span>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={driveUrlInput}
                    onChange={(e) => setDriveUrlInput(e.target.value)}
                    placeholder="Paste Google Drive share link (drive.google.com/file/d/...)"
                    className="flex-1 text-xs px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-emerald-500 text-white font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={handleConvertDriveUrl}
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 cursor-pointer transition-colors"
                  >
                    Convert
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Generated Link, Preview & Actions */}
            <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between space-y-3">
              {generatedHubUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Generated Direct Image Link</span>
                    </span>
                    {generatedMeta && (
                      <span className="text-[10px] text-slate-400">
                        {generatedMeta.sizeKb > 0 ? `${generatedMeta.sizeKb} KB` : 'Ready'} • {generatedMeta.source}
                      </span>
                    )}
                  </div>

                  {/* Thumbnail & URL Row */}
                  <div className="flex items-center gap-3 bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/80">
                    <div className="w-14 h-14 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden border border-slate-600">
                      <img
                        src={generatedHubUrl}
                        alt="Uploaded preview"
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        className="w-full h-full object-contain"
                        onError={(e) => handleProductImageError(e, generatedHubUrl)}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        readOnly
                        value={generatedHubUrl}
                        className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-emerald-300 font-mono text-[11px] outline-none"
                      />
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyGeneratedLink(generatedHubUrl)}
                          className="px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {isCopiedHubLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{isCopiedHubLink ? 'Copied! ✅' : 'Copy Link'}</span>
                        </button>
                        <a
                          href={generatedHubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Action 1: Create New Product with this Link */}
                  <div className="pt-1 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleNewProduct(generatedHubUrl);
                        showToast(isEnglish ? 'New product form opened with image! ✅' : 'ଫଟୋ ସହିତ ନୂଆ ପ୍ରୋଡକ୍ଟ ଫର୍ମ ଖୋଲିଗଲା! ✅');
                      }}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isEnglish ? '+ Use For New Product' : '+ ନୂଆ ପ୍ରୋଡକ୍ଟରେ ଯୋଡ଼ନ୍ତୁ'}</span>
                    </button>
                  </div>

                  {/* Action 2: Assign To Existing Catalogue Item */}
                  <div className="bg-slate-900/90 border border-slate-700/80 p-3 rounded-xl space-y-2">
                    <span className="text-[11px] font-black text-slate-200 block">
                      {isEnglish ? '📦 Apply To Existing Catalogue Item:' : '📦 କାଟାଲଗ୍‌ର ପୁରୁଣା ସାମଗ୍ରୀରେ ଏହି ଫଟୋ ଲଗାନ୍ତୁ:'}
                    </span>
                    <input
                      type="text"
                      value={assignSearchQuery}
                      onChange={(e) => setAssignSearchQuery(e.target.value)}
                      placeholder="Search item to update photo (e.g. Atta, Oil, Soap)..."
                      className="w-full text-xs px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-emerald-500"
                    />

                    <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-slate-800 pr-1">
                      {assignCatalogMatches.map((item, idx) => (
                        <div
                          key={`assign-match-${item.ean}-${item.rowIndex ?? ''}-${idx}`}
                          className="pt-1.5 pb-1 flex items-center justify-between text-xs gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded bg-white p-0.5 shrink-0 overflow-hidden">
                              <img
                                src={resolveProductImage(item)}
                                alt={item.product_name}
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                                className="w-full h-full object-contain"
                                onError={(e) => handleProductImageError(e, item.backup_image_url, item.ean)}
                              />
                            </div>
                            <span className="truncate text-slate-200 font-semibold">{item.product_name}</span>
                          </div>
                          <button
                            type="button"
                            disabled={isAssigning}
                            onClick={() => handleAssignImageToProduct(item, generatedHubUrl)}
                            className="px-2 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-bold text-[10px] shrink-0 cursor-pointer transition-colors disabled:opacity-50"
                          >
                            {isAssigning ? 'Saving...' : 'Apply Image'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-300">
                    {isEnglish ? 'No image uploaded yet' : 'ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ଫଟୋ ଅପଲୋଡ୍ ହୋଇନାହିଁ'}
                  </span>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    {isEnglish
                      ? 'Upload a photo or convert a link on the left to get your instant direct image link, copy it, or attach it to products.'
                      : 'ବାମ ପାଖରୁ ଫଟୋ ବାଛନ୍ତୁ, ଏଠାରେ ଡାଇରେକ୍ଟ ଲିଙ୍କ୍ ଦେଖାଯିବ ଓ ନୂଆ ପ୍ରୋଡକ୍ଟରେ ଲଗାଇପାରିବେ।'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Uploaded Images Strip */}
          {recentImages.length > 0 && (
            <div className="border-t border-slate-800 pt-3">
              <span className="text-[11px] font-black text-slate-400 block mb-2 uppercase tracking-wider">
                Recent Generated Images ({recentImages.length})
              </span>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {recentImages.map((rec, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setGeneratedHubUrl(rec.url);
                      setGeneratedMeta({ fileName: rec.name || 'Photo', sizeKb: 0, source: 'history' });
                    }}
                    className={`shrink-0 w-16 h-16 rounded-xl bg-white p-1 border-2 cursor-pointer transition-all ${
                      generatedHubUrl === rec.url ? 'border-emerald-400 scale-105 shadow-md' : 'border-slate-700 hover:border-slate-500'
                    }`}
                    title={rec.name || 'Click to select this image'}
                  >
                    <img
                      src={rec.url}
                      alt="Recent"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain"
                      onError={(e) => handleProductImageError(e, rec.url)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live 5-Sec Server Sync & Max Add-to-Cart per Item Toolbar */}
      <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-emerald-50/60 border border-blue-200 rounded-2xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
            <RefreshCw className={`w-4 h-4 ${isSyncingStock ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-slate-900">
                {isEnglish ? '5-Sec Live Server Stock Sync' : '୫-ସେକେଣ୍ଡ୍ ଲାଇଭ୍ ସର୍ଭର ଷ୍ଟକ୍ ସିଙ୍କ୍'}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>Active • Auto-Refresh (5s)</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {isEnglish
                ? 'Server stock auto-syncs every 5s. If customer A buys 5pc, customer B cart auto-manages to remaining stock.'
                : 'ଜଣେ ଗ୍ରାହକ ଅର୍ଡର କଲେ ସର୍ଭର ଷ୍ଟକ୍ କମିବ ଏବଂ ଅନ୍ୟ ଗ୍ରାହକଙ୍କ କାର୍ଟ ୫ ସେକେଣ୍ଡ୍ ଭିତରେ ଅଟୋମେଟିକ୍ ମ୍ୟାନେଜ୍ ହେବ।'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Batch Set All Max Limit to 10 */}
          <button
            type="button"
            disabled={isBatchUpdatingLimits}
            onClick={() => handleBatchSetAllMaxLimits(10)}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            title="Set default max cart limit of 10pc for all items"
          >
            <span>⚡ {isBatchUpdatingLimits ? 'Updating...' : 'Set All Max: 10pc'}</span>
          </button>

          {/* Manual trigger button */}
          <button
            type="button"
            onClick={() => {
              syncLiveStockWithServer();
              showToast('Synced live stocks from server! 🔄');
            }}
            className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-xs flex items-center gap-1 cursor-pointer"
            title="Force immediate stock sync"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncingStock ? 'animate-spin' : ''}`} />
            <span>Sync Now</span>
          </button>
        </div>
      </div>

      {/* 📣 FACEBOOK / META COMMERCE MANAGER CATALOG FEED 1-CLICK SYNC HUB */}
      <div className="bg-gradient-to-r from-[#1877F2]/10 via-blue-50/90 to-indigo-50/80 border border-[#1877F2]/30 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1877F2] text-white flex items-center justify-center font-black shadow-xs shrink-0 text-sm">
              f
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black text-slate-900">
                  {isEnglish
                    ? 'Facebook / Meta Commerce Catalog Data Feed'
                    : 'Facebook / Meta Commerce କ୍ୟାଟାଲଗ୍ ଡାଟା ଫିଡ୍'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#1877F2]/15 text-[#1877F2] border border-[#1877F2]/30">
                  Auto-Sync Tab: Facebook_Feed
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {isEnglish
                  ? '1-Click generates the Facebook_Feed tab in Google Sheets & serves live CSV (?feed=facebook) for Meta Ads & WhatsApp Catalog.'
                  : '୧-କ୍ଲିକ୍ ରେ Google Sheet ର Facebook_Feed ଟ୍ୟାବ୍ ଅପଡେଟ୍ କରେ ଏବଂ Meta Commerce ଓ WhatsApp Catalog ପାଇଁ ଲାଇଭ୍ CSV ଲିଙ୍କ୍ ପ୍ରସ୍ତୁତ କରେ।'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleSyncFacebookFeedClick}
              disabled={isSyncingFbFeed}
              className="px-3.5 py-2 rounded-xl bg-[#1877F2] hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFbFeed ? 'animate-spin' : ''}`} />
              <span>{isSyncingFbFeed ? 'Syncing Feed...' : '⚡ Convert & Sync Facebook Feed'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadFbCsv}
              className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Download CSV file directly"
            >
              <span>⬇️ CSV</span>
            </button>
          </div>
        </div>

        {/* Direct Copy Feed URL Input Box for Meta Commerce Manager */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white/90 p-2 rounded-xl border border-blue-200">
          <span className="text-[10.5px] font-black text-slate-700 px-1.5 shrink-0">
            Meta Feed URL:
          </span>
          <input
            type="text"
            readOnly
            value={fbFeedUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="flex-1 text-[11px] font-mono bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-800 outline-none"
          />
          <button
            type="button"
            onClick={handleCopyFbFeedUrl}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            {isCopiedFbUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopiedFbUrl ? 'Copied! ✅' : 'Copy Feed URL'}</span>
          </button>
        </div>

        {fbFeedStatus && (
          <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-black flex items-center justify-between">
            <span>✅ {fbFeedStatus}</span>
            <button
              type="button"
              onClick={() => setFbFeedStatus(null)}
              className="text-emerald-700 hover:text-emerald-950 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* PHOTO STORAGE & 1-CLICK REPO CONVERSION HUB */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 sm:p-5 rounded-3xl border border-slate-700 shadow-lg space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                <span>Repository Photos & Fail-Safe CDN Backup</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {catalog.length} Items Total
                </span>
              </h3>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                {isEnglish
                  ? 'All product photos organized in /public/products/<category>/<ean>.jpg with dual-layer cloud CDN fallback'
                  : 'କାଟାଗୋରୀ ଫୋଲ୍ଡର ଅନୁଯାୟୀ ନିଜ ରିପୋରେ ଫଟୋ ସେଭ୍ କରନ୍ତୁ ଏବଂ ପୁରୁଣା CDN କୁ ବ୍ୟାକଅପ୍ ଭାବେ ରଖନ୍ତୁ'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleConvertAllToRepoLinks}
              disabled={isConvertingLinks}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isConvertingLinks ? 'animate-spin' : ''}`} />
              <span>{isConvertingLinks ? 'Converting...' : '⚡ 1-Click Convert to Repo Links'}</span>
            </button>

            {/* UNCONDITIONALLY VISIBLE RESTORE CDN BUTTON */}
            <button
              onClick={handleRestoreAllToCdnLinks}
              disabled={isConvertingLinks}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50 border border-sky-400/40"
              title="Restore all product images back to original cloud CDN links (JioMart / ImgBB)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isConvertingLinks ? 'animate-spin' : ''}`} />
              <span>{isConvertingLinks ? 'Restoring...' : '🔄 Restore Original CDN Links (ମୂଳ CDN ଫେରାନ୍ତୁ)'}</span>
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
          <div className="bg-slate-800/80 border border-slate-700/80 p-2.5 rounded-2xl">
            <span className="text-[9.5px] text-slate-400 font-bold block uppercase tracking-wider">Repo Links (/products/...)</span>
            <span className="text-base font-black text-amber-400">{repoImageCount}</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/80 p-2.5 rounded-2xl">
            <span className="text-[9.5px] text-slate-400 font-bold block uppercase tracking-wider">External CDN Links</span>
            <span className="text-base font-black text-blue-400">{cdnImageCount}</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/80 p-2.5 rounded-2xl">
            <span className="text-[9.5px] text-slate-400 font-bold block uppercase tracking-wider">CDN Backups Ready</span>
            <span className="text-base font-black text-emerald-400">{availableCdnCount}</span>
          </div>
        </div>

        {/* Odia Architecture Explainer Pill */}
        <div className="bg-slate-800/70 border border-slate-700/80 p-2.5 rounded-2xl text-[11px] text-slate-300 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <strong className="text-white">ଫଟୋ ସୁରକ୍ଷା ଓ ବ୍ୟାକଅପ୍ ପ୍ରଣାଳୀ:</strong> ଗ୍ରାହକଙ୍କୁ ପ୍ରଥମେ ନିଜ ଡୋମେନ୍/ରିପୋ ଲିଙ୍କ୍ (<code className="text-amber-300">/products/Mustard_Oil/7552164.jpg</code>) ଦେଖାଯିବ। ଯଦି ଡୋମେନ୍ କିମ୍ବା ସେହି ଫାଇଲ୍ ଅନୁପଲବ୍ଧ ହୁଏ, ତେବେ ଗୁଗୁଲ୍ ସିଟ୍‌ର <code className="text-emerald-300">backup_image_url</code> (ଜିଓମାର୍ଟ/ImgBB CDN) ରୁ ଫଟୋ ଅଟୋମେଟିକ୍ ଲୋଡ୍ ହେବ, ଯାହା ଦ୍ୱାରା କଦାପି ଫଟୋ ଭାଙ୍ଗିବ ନାହିଁ!
          </div>
        </div>
      </div>

      {/* Stock Health Badges (Auto Engine Filters) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs font-bold">
        <button
          onClick={() => setStockHealthFilter('all')}
          className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
            stockHealthFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span className="text-[10px] uppercase font-black block">All Products</span>
          <span className="text-base font-black">{catalog.length}</span>
        </button>

        <button
          onClick={() => setStockHealthFilter('in_stock')}
          className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
            stockHealthFilter === 'in_stock'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
          }`}
        >
          <span className="text-[10px] uppercase font-black block">In Stock</span>
          <span className="text-base font-black">{inStockCount}</span>
        </button>

        <button
          onClick={() => setStockHealthFilter('low_stock')}
          className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
            stockHealthFilter === 'low_stock'
              ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
              : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
          }`}
        >
          <span className="text-[10px] uppercase font-black block">Low Stock (≤5)</span>
          <span className="text-base font-black">{lowStockItems.length}</span>
        </button>

        <button
          onClick={() => setStockHealthFilter('out_of_stock')}
          className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
            stockHealthFilter === 'out_of_stock'
              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
              : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
          }`}
        >
          <span className="text-[10px] uppercase font-black block">Out of Stock</span>
          <span className="text-base font-black">{outOfStockItems.length}</span>
        </button>

        <button
          onClick={() => {
            setStockHealthFilter('trending');
            setIsHomePageSetupMode(true);
            setShowSelectedInUpperPage(true);
          }}
          className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
            stockHealthFilter === 'trending'
              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs ring-2 ring-amber-400/40'
              : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
          }`}
          title="Filter and manage Home Page Upper Section items"
        >
          <span className="text-[10px] uppercase font-black block flex items-center justify-center gap-1">
            <span>⭐ Home Page Pinned</span>
          </span>
          <span className="text-base font-black">{homeSelectedProducts.length}</span>
        </button>
      </div>

      {/* Add / Edit Form Modal/Drawer */}
      {showForm && (
        <div className="bg-white p-5 rounded-3xl border-2 border-emerald-500/30 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>{editingEan ? 'Edit Product Details' : 'Add New Product to Store'}</span>
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* JioMart Live Search Widget with Manual Pincode for Item Availability */}
          <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-2xl space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                <span>🔍 Quick Auto-Fill with JioMart Database (By Pincode Availability)</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10.5px] font-black text-blue-800 bg-white border border-blue-200 px-2 py-0.5 rounded-full w-fit">
                <MapPin className="w-3 h-3 text-blue-600" />
                <span>Active Pincode: {jioPincode || '752106'}</span>
              </span>
            </div>

            {/* Search Query + Manual Pincode Inputs + Search Button */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={jioQuery}
                  onChange={(e) => setJioQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleJioSearch();
                    }
                  }}
                  placeholder="Search item name or EAN (e.g. Fortune Oil, Milk Bikis, Maggi)..."
                  className="w-full text-xs px-3 py-2 bg-white border border-blue-200 rounded-xl outline-none focus:border-blue-600 font-medium text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="relative flex items-center w-36 sm:w-40">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={jioPincode}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setJioPincode(clean);
                      if (clean.length === 6) {
                        try {
                          localStorage.setItem('munna_jiomart_pincode', clean);
                        } catch (err) {}
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleJioSearch();
                      }
                    }}
                    placeholder="Pincode (752106)"
                    title="Enter 6-digit Pincode to check JioMart item availability & price for that area"
                    className="w-full text-xs pl-7 pr-2.5 py-2 bg-white border border-blue-300 rounded-xl outline-none focus:border-blue-600 font-mono font-black text-blue-950"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleJioSearch()}
                  disabled={isSearchingJio}
                  className="px-4 py-2 bg-[#1864ab] hover:bg-blue-800 text-white font-black text-xs rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs active:scale-95 transition-all shrink-0"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isSearchingJio ? 'Searching...' : 'Search'}</span>
                </button>
              </div>
            </div>

            {/* Quick Pincode Presets for instant availability switching */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] font-bold text-slate-500">
                {isEnglish ? '📍 Quick Pincode:' : '📍 ପିନକୋଡ୍ ବାଛନ୍ତୁ:'}
              </span>
              {[
                { pin: '754004', label: 'Niali (754004)' },
                { pin: '752106', label: 'Bhingarpur (752106)' },
                { pin: '751001', label: 'Bhubaneswar (751001)' },
                { pin: '753001', label: 'Cuttack (753001)' },
                { pin: '400001', label: 'All India Hub (400001)' }
              ].map((preset) => {
                const isActivePin = jioPincode === preset.pin;
                return (
                  <button
                    key={preset.pin}
                    type="button"
                    onClick={() => {
                      setJioPincode(preset.pin);
                      try {
                        localStorage.setItem('munna_jiomart_pincode', preset.pin);
                      } catch (e) {}
                      if ((jioQuery || prodName).trim()) {
                        handleJioSearch(undefined, preset.pin);
                      } else {
                        showToast(
                          isEnglish
                            ? `📍 JioMart Pincode set to ${preset.pin}`
                            : `📍 JioMart ପିନକୋଡ୍ ${preset.pin} ସେଟ୍ ହେଲା`
                        );
                      }
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      isActivePin
                        ? 'bg-blue-700 text-white border-blue-800 shadow-2xs'
                        : 'bg-white text-slate-700 border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Mode Toggle & Built-in Project Engine Badge */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-blue-200/60">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={strictPincodeMode}
                    onChange={(e) => setStrictPincodeMode(e.target.checked)}
                    className="rounded border-blue-300 text-blue-700 focus:ring-blue-500"
                  />
                  <span>
                    {isEnglish
                      ? 'Strict Pincode Only (Do not fallback to 753003)'
                      : 'କେବଳ ଦିଆଯାଇଥିବା ପିନକୋଡ୍ ଯାଞ୍ଚ କରନ୍ତୁ (Strict Mode)'}
                  </span>
                </label>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>
                    {isEnglish
                      ? 'Built-In Project Engine Active (No Cloudflare Needed)'
                      : 'Built-In ପ୍ରୋଜେକ୍ଟ ଇଞ୍ଜିନ୍ ସକ୍ରିୟ (Cloudflare ଦରକାର ନାହିଁ)'}
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowWorkerCodeHelper((prev) => !prev)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <Zap className="w-3 h-3" />
                <span>
                  {showWorkerCodeHelper
                    ? 'Hide Worker Code ▲'
                    : '⚡ Optional Worker Code'}
                </span>
              </button>
            </div>

            {showWorkerCodeHelper && (
              <div className="bg-slate-900 text-slate-100 rounded-xl p-3 space-y-2 border border-indigo-400/40 text-[11px]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-black text-amber-300 text-xs">
                      ⚡ Cloudflare Worker Pincode Fix (jiomartsarch.mudulicommunication3.workers.dev)
                    </p>
                    <p className="text-[10.5px] text-slate-300 mt-0.5">
                      ଆପଣଙ୍କ ପୁରୁଣା Worker କୋଡ୍‌ରେ <code className="text-rose-300">url.searchParams.get("pincode")</code> ନଥିଲା, ତେଣୁ ତାହା ସବୁବେଳେ <code className="text-amber-300">753003</code> ରୁ ସର୍ଚ୍ଚ କରୁଥିଲା। ତଳ କୋଡ୍‌କୁ କପି କରି Cloudflare Worker ରେ ପେଷ୍ଟ (Deploy) କରନ୍ତୁ:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JIOMART_CLOUDFLARE_WORKER_CODE);
                      setCopiedWorkerCode(true);
                      showToast('✅ Copied Fixed Pincode Worker Code! Paste & Deploy in Cloudflare Worker.');
                      setTimeout(() => setCopiedWorkerCode(false), 3000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {copiedWorkerCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWorkerCode ? 'Copied!' : 'Copy Worker Code'}</span>
                  </button>
                </div>
                <pre className="max-h-48 overflow-y-auto bg-slate-950 p-2.5 rounded-lg font-mono text-[10px] text-emerald-300 border border-slate-800 whitespace-pre-wrap">
                  {JIOMART_CLOUDFLARE_WORKER_CODE}
                </pre>
              </div>
            )}

            {jioResults.length > 0 && (() => {
              const actualPin = jioResults[0]?.pincode || lastSearchedPincode || jioPincode;
              const reqPin = lastSearchedPincode || jioPincode;
              const isPinMismatch = Boolean(actualPin && reqPin && actualPin !== reqPin);
              const sellableCount = jioResults.filter((r) => r.sellable !== false).length;

              return (
                <div className="max-h-72 overflow-y-auto bg-white border border-blue-200 rounded-xl p-2 space-y-1.5 divide-y divide-slate-100 shadow-md">
                  {isPinMismatch && (
                    <div className="bg-rose-50 border border-rose-300 rounded-lg p-2.5 text-[11px] text-rose-950 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-black text-rose-800 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            ⚠️ Pincode Mismatch: ଆପଣ ପିନକୋଡ୍ <u>{reqPin}</u> ଖୋଜିଥିଲେ, କିନ୍ତୁ ଆପଣଙ୍କ Cloudflare Worker ପିନକୋଡ୍ <u>{actualPin}</u> ରୁ ରେଜଲ୍ଟ ଦେଉଛି!
                          </span>
                        </span>
                      </div>
                      <p className="text-[10.5px] text-rose-800 leading-relaxed">
                        କାରଣ: ଆପଣଙ୍କ Cloudflare Worker ରେ ବର୍ତ୍ତମାନ କେବଳ <code className="bg-rose-100 px-1 rounded font-mono">["753003", "753001", "751010"]</code> ହାର୍ଡକୋଡ୍ ହୋଇଛି ଏବଂ <code className="bg-rose-100 px-1 rounded font-mono">url.searchParams.get("pincode")</code> ନାହିଁ। ସଠିକ୍ ପିନକୋଡ୍ ସର୍ଚ୍ଚ ପାଇଁ ତଳ ବଟନ୍ ଦବାଇ ନୂଆ Worker କୋଡ୍ କପି କରି Cloudflare ରେ Deploy କରନ୍ତୁ:
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(JIOMART_CLOUDFLARE_WORKER_CODE);
                            setCopiedWorkerCode(true);
                            setShowWorkerCodeHelper(true);
                            showToast('✅ Copied Fixed Worker Code! Paste it in your Cloudflare Worker.');
                            setTimeout(() => setCopiedWorkerCode(false), 3000);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-black text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>📋 Copy Fixed Cloudflare Worker Code</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pb-1.5 px-2 flex items-center justify-between text-[10.5px] font-black text-blue-900 bg-blue-50/60 rounded-lg py-1">
                    <span className="flex items-center gap-1 flex-wrap">
                      <CheckCircle2 className={`w-3.5 h-3.5 ${isPinMismatch ? 'text-amber-600' : 'text-emerald-600'}`} />
                      <span>
                        Worker Returned Pincode: <span className="font-mono underline text-blue-950">{actualPin}</span>
                        {isPinMismatch ? ` (Requested: ${reqPin})` : ''} • {sellableCount}/{jioResults.length} In Stock (Sellable)
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setJioResults([]);
                        setJioSearchAttempted(false);
                      }}
                      className="text-[10px] text-slate-500 hover:text-rose-600 font-bold cursor-pointer shrink-0"
                    >
                      Clear ✕
                    </button>
                  </div>
                  {jioResults.map((item, idx) => {
                    const imgCount = Array.isArray(item.images) ? item.images.length : (item.image ? 1 : 0);
                    const thumb = item.image || (Array.isArray(item.images) && item.images[0]) || '';
                    const detectedCat = detectProductCategory(item.name, item.category, item);
                    const previewDesc = item.description || extractOrGenerateProductDescription(item, detectedCat);
                    const realItemPin = item.pincode || actualPin;
                    const isItemSellable = item.sellable !== false && item.available !== false;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleSelectJioItem(item)}
                        className="pt-2 pb-2 px-2 flex items-start justify-between text-xs hover:bg-blue-50/80 rounded-xl cursor-pointer transition-colors gap-2.5"
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          {thumb ? (
                            <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden mt-0.5">
                              <img
                                src={thumb}
                                alt=""
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                              🛍️
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-slate-800">{item.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span
                                className={`text-[9.5px] font-black px-1.5 py-0.2 rounded-full border ${
                                  !isItemSellable
                                    ? 'text-rose-800 bg-rose-100 border-rose-300'
                                    : isPinMismatch
                                    ? 'text-amber-900 bg-amber-100 border-amber-300'
                                    : 'text-emerald-800 bg-emerald-100/80 border-emerald-300'
                                }`}
                              >
                                📍 Actual Pin {realItemPin} • {isItemSellable ? 'Sellable (In Stock)' : 'Out of Stock (Not Sellable)'}
                              </span>
                              {imgCount > 0 && (
                                <span className="text-[9.5px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                                  📷 {imgCount} {imgCount === 1 ? 'photo' : 'photos'}
                                </span>
                              )}
                              <span className="text-[9.5px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-full">
                                🏷️ {detectedCat}
                              </span>
                              {item.ean && (
                                <span className="text-[9.5px] font-mono text-slate-400 truncate">
                                  EAN: {item.ean}
                                </span>
                              )}
                            </div>
                            {previewDesc && (
                              <p className="text-[10px] text-slate-500 line-clamp-1 mt-1 italic">
                                📝 {previewDesc.replace(/\n/g, ' ')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <div>
                            <span className="font-black text-blue-700 block">Rs. {item.sp || item.price || item.mrp}</span>
                            {item.mrp && Number(item.mrp) > Number(item.sp || item.price) && (
                              <span className="text-[10px] text-slate-400 line-through block">Rs. {item.mrp}</span>
                            )}
                          </div>
                          <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                            + Auto-Fill & Copy Desc
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Empty state when an item isn't available at the current pincode */}
            {!isSearchingJio && jioSearchAttempted && jioResults.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>
                  ⚠️ No JioMart stock found for <b>"{jioQuery || prodName}"</b> at Pincode <b>{lastSearchedPincode || jioPincode}</b>. Try searching with a nearby hub pincode:
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleJioSearch(undefined, '751001')}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black text-[10.5px] cursor-pointer"
                  >
                    Try 751001 (BBSR)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleJioSearch(undefined, '753003')}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-[10.5px] cursor-pointer"
                  >
                    Try 753003 (Cuttack)
                  </button>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSaveForm} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Product Name</label>
              <input
                type="text"
                required
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="Product full name and quantity (e.g. Fortune Oil 1L)"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Selling Price (Rs.)</label>
                <input
                  type="number"
                  required
                  value={prodSp}
                  onChange={(e) => setProdSp(e.target.value)}
                  placeholder="145"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">MRP (Rs.)</label>
                <input
                  type="number"
                  value={prodMrp}
                  onChange={(e) => setProdMrp(e.target.value)}
                  placeholder="170"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Stock Quantity</label>
                <input
                  type="number"
                  required
                  value={prodStock}
                  onChange={(e) => setProdStock(e.target.value)}
                  placeholder="15"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-blue-900 block mb-1">
                  <span>Max Add to Cart / User</span>
                  <span className="text-[10px] text-blue-600 block font-normal">(Default: 10pc)</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={prodMaxOrderQty}
                  onChange={(e) => setProdMaxOrderQty(e.target.value)}
                  placeholder="10"
                  className="w-full text-xs px-3 py-2 border border-blue-300 bg-blue-50/50 rounded-xl outline-none focus:border-blue-600 font-black text-blue-950"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Category ({categories.length - 1} in Sheet)
                </label>
                <input
                  type="text"
                  required
                  list="admin-catalog-category-datalist"
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                  placeholder="Select or type category (e.g. Mustard Oil, Biscuit, Spices...)"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                />
                <datalist id="admin-catalog-category-datalist">
                  {categories
                    .filter((c) => c !== 'All')
                    .map((cat) => (
                      <option key={`datalist-cat-${cat}`} value={cat}>
                        {cat} ({categoryCounts[cat] || 0})
                      </option>
                    ))}
                </datalist>
              </div>
            </div>

            {/* Quick Category Selector Chips inside Add/Edit Form */}
            {categories.length > 1 && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-600">
                  <span>🏷️ Quick Pick Existing Sheet Category ({categories.length - 1} categories):</span>
                  <span className="text-emerald-700 font-black">{prodCategory || 'General'}</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {categories
                    .filter((c) => c !== 'All')
                    .map((cat) => {
                      const isActive = prodCategory.trim().toLowerCase() === cat.trim().toLowerCase();
                      return (
                        <button
                          key={`form-cat-chip-${cat}`}
                          type="button"
                          onClick={() => setProdCategory(cat)}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap border transition-all cursor-pointer ${
                            isActive
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                          }`}
                        >
                          {cat} ({categoryCounts[cat] || 0})
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* 📝 PRODUCT DESCRIPTION (Auto-Filled & Copied from JioMart Search) */}
            <div className="bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Product Description (ପ୍ରୋଡକ୍ଟ ବିବରଣୀ - Auto-Fill from JioMart)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const generated = extractOrGenerateProductDescription(
                        {
                          name: prodName || jioQuery,
                          category: prodCategory,
                          mrp: prodMrp,
                          sp: prodSp,
                          ean: prodEan
                        },
                        prodCategory
                      );
                      if (generated) {
                        setProdDescription(generated);
                        try {
                          navigator.clipboard?.writeText(generated).catch(() => {});
                        } catch (e) {}
                        showToast(
                          isEnglish
                            ? '✨ Auto-generated & copied product description!'
                            : '✨ ପ୍ରୋଡକ୍ଟ ବିବରଣୀ ଅଟୋ-ପ୍ରସ୍ତୁତ ଓ କପି ହେଲା!'
                        );
                      } else {
                        showToast('Enter product name or select from JioMart first');
                      }
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 transition-all"
                    title="Auto-generate rich product description from product name & JioMart data"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>✨ Auto-Fill Description</span>
                  </button>
                  {prodDescription && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(prodDescription);
                        showToast(isEnglish ? '📋 Description copied!' : '📋 ପ୍ରୋଡକ୍ଟ ବିବରଣୀ କପି ହେଲା!');
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Copy product description"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  )}
                </div>
              </div>
              <textarea
                rows={3}
                value={prodDescription}
                onChange={(e) => setProdDescription(e.target.value)}
                placeholder="Product description, key highlights, pack size & quality details (auto-filled when you select a product from JioMart search above)..."
                className="w-full text-xs px-3 py-2 bg-white border border-emerald-200 rounded-xl outline-none focus:border-emerald-600 text-slate-800 leading-relaxed resize-y"
              />
              <p className="text-[10.5px] text-emerald-800/90 flex items-center justify-between">
                <span>✅ Automatically displayed in the individual Product Card & Description Tab</span>
                {prodDescription && <span className="font-mono text-[10px]">{prodDescription.length} chars</span>}
              </p>
            </div>

            {/* MULTIPLE EAN / BARCODE HUB (JioMart Auto EAN + Add Original Product EAN + Auto-Match Old Product) */}
            <div className="bg-slate-50/90 p-3.5 rounded-2xl border-2 border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Barcode className="w-4 h-4 text-emerald-600" />
                    <span>Multiple EAN / Barcodes (JioMart EAN + Original Packet EAN)</span>
                    {prodEanList.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black">
                        {prodEanList.length} {prodEanList.length === 1 ? 'EAN' : 'EANs'}
                      </span>
                    )}
                  </label>
                  <p className="text-[10.5px] text-slate-500 mt-0.5">
                    {isEnglish
                      ? 'Supports multiple EANs per product in Google Sheet & Search. If an old EAN is already in database, it auto-finds & edits that product without creating duplicates!'
                      : 'ଗୋଟିଏ ପ୍ରୋଡକ୍ଟରେ ଏକାଧିକ ବାରକୋଡ୍ (JioMart EAN + ଅରିଜିନାଲ୍ ପ୍ୟାକେଟ୍ EAN) ସେଭ୍ ଓ ସର୍ଚ୍ଚ କରନ୍ତୁ। ପୁରୁଣା EAN ଡାଟାବେସ୍‌ରେ ଥିଲେ ଅଟୋ-ମ୍ୟାଚ୍ ହୋଇ ଏଡିଟ୍ ହେବ (ଡୁପ୍ଲିକେଟ୍ ହେବ ନାହିଁ)।'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEanScannerAction('add_more');
                      setShowEanScanner(true);
                    }}
                    className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
                    title="Scan Original Product Barcode to Add to this Product"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>📷 + Scan & Add EAN</span>
                  </button>
                </div>
              </div>

              {/* Active Multiple EAN Chips Display */}
              {prodEanList.length > 0 && (
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200 space-y-1.5">
                  <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-600">
                    <span>Active Barcodes Saved for this Product (Click any EAN to make Primary):</span>
                    <span className="text-emerald-700 font-mono">{prodEanList.length} linked</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {prodEanList.map((code, idx) => {
                      const isPrimaryCode = idx === 0;
                      return (
                        <div
                          key={`ean-chip-${code}-${idx}`}
                          onClick={() => !isPrimaryCode && handleMakePrimaryEan(code)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                            isPrimaryCode
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                              : 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100 cursor-pointer'
                          }`}
                          title={isPrimaryCode ? 'Primary EAN' : 'Click to make Primary EAN'}
                        >
                          <Barcode className="w-3 h-3 shrink-0" />
                          <span>{code}</span>
                          <span className={`text-[9px] font-sans font-black px-1.5 py-0.2 rounded ${
                            isPrimaryCode ? 'bg-white/20 text-white' : 'bg-emerald-200/80 text-emerald-900'
                          }`}>
                            {isPrimaryCode ? '★ Primary' : `EAN #${idx + 1}`}
                          </span>
                          {prodEanList.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveSingleEan(code);
                              }}
                              className={`ml-0.5 rounded-full p-0.5 transition-colors cursor-pointer ${
                                isPrimaryCode ? 'hover:bg-white/25 text-white' : 'hover:bg-rose-200 text-rose-700'
                              }`}
                              title="Remove this EAN"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* + ADD MORE EAN / ORIGINAL PRODUCT BARCODE BOX */}
              <div className="bg-blue-50/70 border border-blue-200 p-2.5 rounded-xl space-y-1.5">
                <label className="text-[11px] font-black text-blue-950 flex items-center justify-between">
                  <span>➕ Add More EAN / Original Product Barcode (ଅଧିକ / ଅରିଜିନାଲ୍ ବାରକୋଡ୍ ଯୋଡ଼ନ୍ତୁ):</span>
                  <span className="text-[10px] font-bold text-blue-700">Auto-checks existing DB</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={additionalEanInput}
                    onChange={(e) => setAdditionalEanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddMoreEan();
                      }
                    }}
                    placeholder="Type original packet EAN (e.g. 8901052010363) or comma-separated EANs..."
                    className="flex-1 text-xs px-3 py-2 bg-white border border-blue-300 rounded-xl outline-none focus:border-blue-600 font-mono font-semibold text-slate-900"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAddMoreEan()}
                      className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add EAN</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEanScannerAction('add_more');
                        setShowEanScanner(true);
                      }}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 transition-all"
                      title="Scan original packet barcode to add"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Scan Original</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Combined Sheet EAN String Input (Editable comma-separated list written directly to Google Sheet) */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-slate-600 block">
                  All Product EANs Written to Sheet (Comma-separated: Primary EAN, JioMart EAN, Original EAN):
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400 pointer-events-none">
                    <Barcode className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={prodEan}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProdEan(val);
                      const parsedCodes = parseEanList(val);
                      setProdEanList(parsedCodes);
                      // Check if any typed EAN matches an existing product in database
                      const existingMatch = findProductByAnyEan(catalog, parsedCodes);
                      if (existingMatch && existingMatch.ean !== editingEan) {
                        mergeWithExistingDatabaseProduct(existingMatch, parsedCodes, Boolean(prodName.trim()));
                        showToast(
                          isEnglish
                            ? `🔄 Matched existing product "${existingMatch.product_name}"! Switched to edit mode.`
                            : `🔄 ପୂର୍ବରୁ ଥିବା "${existingMatch.product_name}" ମିଳିଗଲା! ଅଟୋ-ଏଡିଟ୍ ମୋଡ୍‌ରେ ଯୋଡ଼ାଗଲା।`
                        );
                      }
                    }}
                    placeholder="890123456789, 490001234 (Supports single or multiple comma-separated EANs)"
                    className="w-full text-xs pl-9 pr-24 py-2 bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-500 font-mono text-[12px] font-semibold text-slate-900 shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEanScannerAction('primary');
                      setShowEanScanner(true);
                    }}
                    className="absolute right-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-black text-xs flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 transition-all"
                    title="Open Camera Barcode Scanner"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan</span>
                  </button>
                </div>
              </div>

              {/* Helper strip below EAN input */}
              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500 pt-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>All multiple EANs are searchable in Store, Admin & Scanner</span>
                </span>
                <div className="flex items-center gap-2">
                  {prodEan && (
                    <button
                      type="button"
                      onClick={handleAutoFillRepoPath}
                      className="text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer text-[10.5px]"
                    >
                      Use Primary EAN in Repo path
                    </button>
                  )}
                  {prodEan && (
                    <button
                      type="button"
                      onClick={() => {
                        const firstCode = getPrimaryEan(prodEanList[0] || prodEan);
                        setJioQuery(firstCode);
                        handleJioSearch(firstCode, jioPincode);
                      }}
                      className="text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer text-[10.5px]"
                    >
                      🔍 Search JioMart with EAN (Pin: {jioPincode || '752106'})
                    </button>
                  )}
                </div>
              </div>

              {/* Auto-Matched Existing Database Product Banner */}
              {scannedExistingProduct && (
                <div className="p-3 bg-emerald-50 border-2 border-emerald-400 rounded-xl text-xs space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-emerald-950 font-black flex-wrap gap-1">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Auto-Matched Existing DB Product: <b>{scannedExistingProduct.product_name}</b> (Editing in-place — No duplicate will be created!)
                      </span>
                    </span>
                    <span className="text-emerald-700 font-black">Rs. {scannedExistingProduct.selling_price}</span>
                  </div>
                  <div className="text-[11px] text-emerald-800 font-mono">
                    Merged EANs: <b>{formatMultipleEans(prodEanList, prodEan, scannedExistingProduct.ean, scannedExistingProduct.additional_eans)}</b>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        mergeWithExistingDatabaseProduct(scannedExistingProduct, prodEanList, false);
                        showToast(`Loaded original fields of "${scannedExistingProduct.product_name}" with all merged EANs`);
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[11px] cursor-pointer shadow-xs"
                    >
                      Load Old Price/Name too
                    </button>
                    <button
                      type="button"
                      onClick={() => setScannedExistingProduct(null)}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-[11px] border border-slate-200 cursor-pointer"
                    >
                      Hide Banner
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PRODUCT PHOTO & DIRECT LINK GENERATION */}
            <div className="bg-slate-50 border border-slate-200/90 p-4 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span>Product Image URL & Direct Link Generator</span>
                  </label>
                  <span className="text-[10px] text-slate-500 block">
                    Upload image from camera/gallery or paste direct/Google Drive URL
                  </span>
                </div>

                {/* Upload Button */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors shrink-0">
                    {isUploadingImg ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={isUploadingImg}
                    />
                    <span>{isUploadingImg ? 'Uploading...' : '📸 Upload Photo'}</span>
                  </label>

                  {/* If recent images exist, option to pick from recent */}
                  {recentImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const latest = recentImages[0]?.url;
                        if (latest) {
                          setProdImage(latest);
                          setProdBackupImage(latest);
                          showToast('Used latest uploaded photo! ✅');
                        }
                      }}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-[11px] font-bold cursor-pointer"
                      title="Use most recently uploaded photo"
                    >
                      ⚡ Latest Upload
                    </button>
                  )}
                </div>
              </div>

              {/* Main Image URL Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prodImage}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val.includes('drive.google.com') || val.includes('docs.google.com')) {
                      const direct = normalizeGoogleDriveImageUrl(val);
                      if (direct) {
                        val = direct;
                        showToast('✨ Converted Google Drive link to direct link!');
                      }
                    }
                    setProdImage(val);
                    if (!prodBackupImage || prodBackupImage.includes('drive.google.com')) {
                      setProdBackupImage(val);
                    }
                  }}
                  placeholder="https://i.ibb.co/... or /products/Category/ean.jpg or Google Drive link"
                  className="flex-1 text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-500 font-mono text-[11px]"
                />
                {prodImage && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleCopyGeneratedLink(prodImage)}
                      className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0"
                      title="Copy Image Link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Copy</span>
                    </button>
                    <a
                      href={resolveProductImage({ image_url: prodImage, backup_image_url: prodBackupImage, ean: prodEan })}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
                      title="Open Image"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </>
                )}
              </div>

              {/* Live Image Preview Card */}
              {(prodImage || prodBackupImage) && (
                <div className="flex items-center gap-3.5 p-2.5 bg-white rounded-xl border border-slate-200">
                  <div className="w-14 h-14 rounded-lg bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={resolveProductImage({ image_url: prodImage, backup_image_url: prodBackupImage, ean: prodEan })}
                      alt="Preview"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain"
                      onError={(e) => handleProductImageError(e, prodBackupImage, prodEan)}
                    />
                  </div>
                  <div className="text-[11px] text-slate-600 leading-tight space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">Preview Active</span>
                      <span className="text-[10px] text-emerald-700 font-black bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                        Ready for WhatsApp OG
                      </span>
                    </div>
                    <p className="truncate font-mono text-[10px] text-slate-500">
                      URL: {prodImage || prodBackupImage}
                    </p>
                  </div>
                </div>
              )}

              {/* Advanced / Secondary CDN Settings Collapsible Details */}
              <details className="text-[11px] text-slate-600 group">
                <summary className="font-bold cursor-pointer text-slate-500 hover:text-slate-800 flex items-center gap-1 select-none">
                  <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                  <span>Advanced: Repository Path & Backup CDN Links</span>
                </summary>
                <div className="mt-2 pt-2 border-t border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-600">Backup CDN Link (Fail-safe):</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const cdn = getOriginalCdnUrl(prodEan);
                          if (cdn) {
                            setProdBackupImage(cdn);
                            showToast('Loaded original CDN backup');
                          }
                        }}
                        className="text-[9.5px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        🔄 Original CDN
                      </button>
                      <button
                        type="button"
                        onClick={handleAutoFillRepoPath}
                        className="text-[9.5px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        ⚡ Set Repo Path
                      </button>
                    </div>
                  </div>
                  <input
                    type="url"
                    value={prodBackupImage}
                    onChange={(e) => setProdBackupImage(e.target.value)}
                    placeholder="Secondary CDN backup URL..."
                    className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none font-mono text-[10px]"
                  />
                </div>
              </details>
            </div>

            {/* 📸 INTERACTIVE PRODUCT IMAGE GALLERY PICKER (JioMart Multi-Image Selection) */}
            <div className="bg-slate-50 border border-slate-200/90 p-4 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                <div>
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>Product Image Gallery Picker (ବହୁବିଧ ଫଟୋ ଗ୍ୟାଲେରୀ)</span>
                  </label>
                  <span className="text-[10px] text-slate-500 block">
                    {prodGallery.length} {prodGallery.length === 1 ? 'photo' : 'photos'} available • Click any photo to set as Primary Cover Image
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowAddUrlInput(!showAddUrlInput)}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Image URL</span>
                  </button>

                  {prodGallery.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(isEnglish ? 'Clear all gallery photos?' : 'ସମସ୍ତ ଗ୍ୟାଲେରୀ ଫଟୋ ହଟାଇବାକୁ ଚାହାଁନ୍ତି କି?')) {
                          setProdGallery([]);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-500 rounded-xl text-[11px] font-bold cursor-pointer transition-colors"
                      title="Clear gallery"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Collapsible "+ Add Custom Image URL" Input Box */}
              {showAddUrlInput && (
                <div className="p-3 bg-white border border-emerald-300 rounded-xl space-y-2 animate-in fade-in duration-150">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Paste Image URL (CDN / ImgBB / Google Drive link):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={customImageUrl}
                      onChange={(e) => setCustomImageUrl(e.target.value)}
                      placeholder="https://... or Google Drive sharing link"
                      className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-emerald-500 font-mono text-[11px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomImageUrl();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomImageUrl}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl cursor-pointer shrink-0 shadow-xs"
                    >
                      Add Photo
                    </button>
                  </div>
                </div>
              )}

              {/* Interactive Thumbnail Gallery Grid */}
              {prodGallery.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-1">
                  {prodGallery.map((imgUrl, idx) => {
                    const isPrimary = prodImage === imgUrl || prodBackupImage === imgUrl || (idx === 0 && !prodGallery.includes(prodImage) && !prodGallery.includes(prodBackupImage));
                    return (
                      <div
                        key={`gallery-item-${idx}-${imgUrl}`}
                        onClick={() => handleSetPrimaryGalleryImage(imgUrl)}
                        className={`relative group rounded-2xl overflow-hidden border-2 bg-white flex flex-col items-center justify-center aspect-square cursor-pointer transition-all ${
                          isPrimary
                            ? 'border-emerald-500 ring-2 ring-emerald-300/80 shadow-md'
                            : 'border-slate-200 hover:border-emerald-400 hover:shadow-xs'
                        }`}
                        title={isPrimary ? 'Primary Cover Image (Click to re-select)' : 'Click to set as Primary Cover'}
                      >
                        {/* Primary Badge */}
                        {isPrimary ? (
                          <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-0.5 z-10">
                            <Star className="w-2.5 h-2.5 fill-white text-white" />
                            <span>Primary</span>
                          </span>
                        ) : (
                          <span className="absolute top-1 left-1 bg-slate-900/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            #{idx + 1}
                          </span>
                        )}

                        {/* Delete (✕) Thumbnail Button */}
                        <button
                          type="button"
                          onClick={(e) => handleRemoveGalleryImage(imgUrl, e)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-800/80 hover:bg-rose-600 text-white flex items-center justify-center text-[10px] font-black shadow-xs cursor-pointer transition-colors z-10"
                          title="Remove this photo from gallery"
                        >
                          <X className="w-3 h-3" />
                        </button>

                        {/* Image Display */}
                        <div className="w-full h-full p-2 flex items-center justify-center">
                          <img
                            src={imgUrl}
                            alt={`Gallery photo ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            crossOrigin="anonymous"
                            className="w-full h-full object-contain"
                            onError={(e) => handleProductImageError(e, imgUrl, prodEan)}
                          />
                        </div>

                        {/* Set Primary Hover Banner */}
                        {!isPrimary && (
                          <div className="absolute inset-x-0 bottom-0 py-1 bg-emerald-950/80 text-white text-[9px] font-bold text-center opacity-0 group-hover:opacity-100 transition-opacity">
                            Set Primary ★
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-500 space-y-1">
                  <p className="font-bold">No gallery photos loaded yet</p>
                  <p className="text-[11px] text-slate-400">
                    Use "🔍 Quick Auto-Fill with JioMart Database" above to auto-extract all catalog photos, or click "+ Add Image URL" / "📸 Upload Photo" above.
                  </p>
                </div>
              )}
            </div>

            {/* PRODUCT VIDEO / YOUTUBE LINK SUPPORT */}
            <div className="bg-rose-50/70 border border-rose-200 p-4 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-rose-950 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
                  <span>Product Video / YouTube Link (ପ୍ରୋଡକ୍ଟ ଭିଡିଓ / ୟୁଟ୍ୟୁବ୍ ଲିଙ୍କ୍)</span>
                </label>
                {prodVideoUrl && (
                  <button
                    type="button"
                    onClick={() => setProdVideoUrl('')}
                    className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                  >
                    Clear Video
                  </button>
                )}
              </div>
              <p className="text-[11px] text-rose-900/80 leading-snug">
                Paste YouTube video link (e.g. <code>youtube.com/watch?v=...</code>, Shorts, or <code>youtu.be/...</code>) or direct MP4 link. An interactive "▶ Video" play button will appear on the customer product card!
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={prodVideoUrl}
                  onChange={(e) => setProdVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/... or .mp4"
                  className="flex-1 text-xs px-3 py-2 bg-white border border-rose-200 rounded-xl outline-none focus:border-rose-500 font-mono text-[11px]"
                />
              </div>

              {/* Video Preview If Valid */}
              {prodVideoUrl.trim() && (() => {
                const info = getVideoEmbedInfo(prodVideoUrl);
                if (!info) {
                  return (
                    <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-1.5">
                      <span>⚠️ Please enter a valid YouTube link or .mp4 URL</span>
                    </div>
                  );
                }
                const ytThumb = getYouTubeThumbnail(prodVideoUrl);
                return (
                  <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-rose-200">
                    {ytThumb ? (
                      <div className="w-16 h-12 rounded-lg bg-slate-900 overflow-hidden relative shrink-0 flex items-center justify-center">
                        <img src={ytThumb} alt="Video preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <Play className="w-4 h-4 fill-white text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                        <Play className="w-5 h-5 text-rose-600 fill-rose-600" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 text-[11px]">
                      <span className="font-black text-rose-900 block">
                        Video ready for Product Card ({info.isYouTube ? 'YouTube' : 'Direct MP4'})
                      </span>
                      <span className="text-slate-500 font-mono text-[10px] truncate block">
                        {prodVideoUrl}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              {editingEan && (
                <button
                  type="button"
                  onClick={() => {
                    const matched = catalog.find((item) => doesProductMatchEan(item, [editingEan, prodEan]));
                    deleteProduct(
                      editingEan,
                      matched?.rowIndex,
                      prodName || matched?.product_name,
                      prodEanList.length > 0 ? prodEanList : (matched?.additional_eans || matched?.ean_list)
                    );
                    setShowForm(false);
                    setEditingEan(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
              <button
                type="submit"
                className="flex-[2] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm cursor-pointer"
              >
                {editingEan ? 'Save Changes' : '+ Add Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter, Category Dropdown & Full Category Bar (Shows ALL Categories from Google Sheet) */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, barcode EAN, or category..."
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Instant Category Dropdown Select for all 45+ categories */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:border-emerald-500 cursor-pointer max-w-[210px] sm:max-w-[240px]"
              title="Jump to any category in Google Sheet"
            >
              {categories.map((cat) => (
                <option key={`select-cat-${cat}`} value={cat}>
                  {cat === 'All'
                    ? `📂 All Categories (${categories.length - 1} cats • ${catalog.length} items)`
                    : `${cat} (${categoryCounts[cat] || 0})`}
                </option>
              ))}
            </select>

            {/* Toggle Button to Expand/Wrap All Categories on Screen */}
            <button
              type="button"
              onClick={() => setShowAllCategoriesGrid((prev) => !prev)}
              className={`px-3 py-2.5 rounded-xl text-xs font-black border flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
                showAllCategoriesGrid
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
              title="Show or hide full multi-row grid of all categories"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>
                {showAllCategoriesGrid
                  ? isEnglish
                    ? 'Collapse ▲'
                    : 'ଛୋଟ କରନ୍ତୁ ▲'
                  : isEnglish
                  ? `All ${categories.length - 1} Categories ▼`
                  : `ସବୁ ${categories.length - 1} କାଟାଗୋରୀ ▼`}
              </span>
            </button>
          </div>
        </div>

        {/* Full Category Pills (Every single category from Sheet1 is shown — no .slice(0, 6) truncation!) */}
        <div
          className={
            showAllCategoriesGrid
              ? 'flex flex-wrap items-center gap-1.5 pt-1 max-h-60 overflow-y-auto pr-1'
              : 'flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5'
          }
        >
          {categories.map((cat) => {
            const isSelected =
              cat === 'All'
                ? selectedCategory === 'All'
                : selectedCategory.trim().toLowerCase() === cat.trim().toLowerCase();
            const count = categoryCounts[cat] ?? 0;

            return (
              <button
                key={`pill-cat-${cat}`}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs ring-2 ring-slate-900/20'
                    : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-900'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selection Mode Action Bar */}
      {isSelectMode && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 text-white rounded-2xl p-3.5 shadow-md border border-emerald-500/50 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {selectedEans.size === filteredCatalog.length && filteredCatalog.length > 0 ? (
                  <>
                    <CheckSquare className="w-4 h-4 text-emerald-300" />
                    <span>{isEnglish ? 'Deselect All' : 'ସବୁ ଅଣଚୟନ'}</span>
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 text-white" />
                    <span>{isEnglish ? `Select All (${filteredCatalog.length})` : `ସବୁ ଚୟନ (${filteredCatalog.length})`}</span>
                  </>
                )}
              </button>

              {selectedEans.size > 0 && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-xs text-emerald-200 hover:text-white underline cursor-pointer"
                >
                  {isEnglish ? 'Clear' : 'ସଫା କରନ୍ତୁ'}
                </button>
              )}
            </div>

            <div className="px-3 py-1 rounded-full bg-white/20 border border-white/30 text-xs font-black">
              {selectedEans.size} {isEnglish ? 'Selected' : 'ଟି ଚୟନିତ'}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={selectedEans.size === 0}
              onClick={() => setShowBulkShareModal(true)}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 font-black text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Share2 className="w-4 h-4 text-emerald-700" />
              <span>
                {isEnglish
                  ? `Share Selected (${selectedEans.size}) 🚀`
                  : `ଚୟନିତ ସାମଗ୍ରୀ ଶେୟାର କରନ୍ତୁ (${selectedEans.size}) 🚀`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSelectMode(false);
                setSelectedEans(new Set());
              }}
              className="px-3 py-2 rounded-xl bg-black/30 hover:bg-black/50 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              {isEnglish ? 'Exit' : 'ବନ୍ଦ'}
            </button>
          </div>
        </div>
      )}

      {/* Home Page Setup Engine Banner & Controls */}
      {isHomePageSetupMode && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-amber-400 space-y-3 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white text-amber-700 flex items-center justify-center font-black shadow-md shrink-0">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-sm sm:text-base text-white">
                    {isEnglish ? '🏠 Home Page Showcase Setup Engine' : '🏠 ହୋମ୍ ପେଜ୍ ଡିସପ୍ଲେ ସେଟଅପ୍'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white text-amber-900">
                    {homeSelectedProducts.length} {isEnglish ? 'Items Pinned' : 'ଟି ସାମଗ୍ରୀ ପିନ୍ ଅଛି'}
                  </span>
                </div>
                <p className="text-xs text-amber-100 mt-0.5">
                  {isEnglish
                    ? 'Selected items appear first in the Upper Section of the Home Page. All other products follow below on scroll down.'
                    : 'ଏହି ସାମଗ୍ରୀଗୁଡ଼ିକ ଗ୍ରାହକଙ୍କ ହୋମ୍ ପେଜ୍ ଉପରେ ପ୍ରଥମେ ଦେଖାଯିବ, ଏବଂ ଅନ୍ୟ ସମସ୍ତ ସାମଗ୍ରୀ ତଳକୁ ସ୍କ୍ରୋଲ୍ କଲେ ଦେଖାଯିବ।'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle switch for first showing selected items in upper page */}
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-xs text-xs font-black text-white cursor-pointer select-none transition-colors">
                <input
                  type="checkbox"
                  checked={showSelectedInUpperPage}
                  onChange={(e) => setShowSelectedInUpperPage(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-0 w-4 h-4 cursor-pointer accent-amber-500"
                />
                <span>{isEnglish ? 'Show Selected at Top' : 'ପ୍ରଥମେ ଉପରେ ଦେଖାନ୍ତୁ'}</span>
              </label>

              {homeSelectedProducts.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllHomePins}
                  className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  {isEnglish ? 'Clear All Pins' : 'ସବୁ ଖାଲି କରନ୍ତୁ'}
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsHomePageSetupMode(false)}
                className="px-3 py-1.5 rounded-xl bg-black/30 hover:bg-black/50 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                {isEnglish ? 'Done / Close' : 'ହୋଇଗଲା'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Top Header Bar */}
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span>Total Products: {filteredCatalog.length}</span>
            {selectedEans.size > 0 && (
              <span className="text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                {selectedEans.size} selected
              </span>
            )}
            {homeSelectedProducts.length > 0 && (
              <span className="text-amber-800 font-extrabold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                <span>{homeSelectedProducts.length} on Home</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Quick Toggle Button to Show Selected Items in Upper Page */}
            <button
              type="button"
              onClick={() => {
                const nextVal = !showSelectedInUpperPage;
                setShowSelectedInUpperPage(nextVal);
                if (nextVal && !isHomePageSetupMode) {
                  setIsHomePageSetupMode(true);
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                showSelectedInUpperPage
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title="Toggle: First show selected items in upper page, then all items below"
            >
              <Star className={`w-3.5 h-3.5 ${showSelectedInUpperPage ? 'fill-amber-500 text-amber-600' : 'text-slate-400'}`} />
              <span>{showSelectedInUpperPage ? (isEnglish ? 'Upper Selected (ON)' : 'ଉପରେ ଚୟନିତ (ଚାଲୁ)') : (isEnglish ? 'Show Selected at Top' : 'ପ୍ରଥମେ ଉପରେ ଦେଖାନ୍ତୁ')}</span>
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => {
                const nextMode = !isSelectMode;
                setIsSelectMode(nextMode);
                if (!nextMode) setSelectedEans(new Set());
              }}
              className="text-emerald-700 font-extrabold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isSelectMode ? (isEnglish ? 'Close Select' : 'ଚୟନ ବନ୍ଦ') : (isEnglish ? 'Select Items to Share' : 'ଶେୟାର ପାଇଁ ବାଛନ୍ତୁ')}</span>
            </button>
            <span>·</span>
            <span className="text-emerald-800 font-bold flex items-center gap-1">
              <Save className="w-3 h-3 text-emerald-600" />
              <span>{isEnglish ? 'Manual Save Mode' : 'ମାନୁଆଲ୍ ସେଭ୍ ମୋଡ୍'}</span>
            </span>
          </div>
        </div>

        {/* 🌟 UPPER PAGE SECTION: Selected Home Page Items Showcase */}
        {showSelectedInUpperPage && (
          <div className="bg-gradient-to-b from-amber-50/90 via-amber-50/40 to-white border-b-2 border-amber-200 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-amber-200/70">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-2xs">
                  ⭐
                </span>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-amber-950 flex items-center gap-1.5">
                    <span>{isEnglish ? 'Upper Page Section (Selected Home Page Items)' : 'ହୋମ୍ ପେଜ୍ ଉପର ସାମଗ୍ରୀ (ଚୟନିତ)'}</span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-amber-200 text-amber-900">
                      {homeSelectedProducts.length}
                    </span>
                  </h4>
                  <p className="text-[11px] text-amber-800">
                    {isEnglish
                      ? 'These products display first at the top of your store home page. Use ⬆️ ⬇️ to set display order.'
                      : 'ଏହି ସାମଗ୍ରୀଗୁଡ଼ିକ ଗ୍ରାହକଙ୍କୁ ସବୁଠୁ ଉପରେ ଦେଖାଯିବ। କ୍ରମ ବଦଳାଇବାକୁ ⬆️ ⬇️ ବ୍ୟବହାର କରନ୍ତୁ।'}
                  </p>
                </div>
              </div>

              {homeSelectedProducts.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllHomePins}
                  className="text-[11px] font-bold text-amber-900 hover:text-rose-700 underline cursor-pointer"
                >
                  {isEnglish ? 'Remove All' : 'ସବୁ ହଟାନ୍ତୁ'}
                </button>
              )}
            </div>

            {homeSelectedProducts.length === 0 ? (
              <div className="py-4 px-3 text-center bg-white/90 rounded-xl border border-dashed border-amber-300 text-xs text-amber-800 space-y-1">
                <p className="font-bold">
                  {isEnglish
                    ? 'No products pinned to Home Page yet!'
                    : 'ଏପର୍ଯ୍ୟନ୍ତ ହୋମ୍ ପେଜ୍ ଉପରେ କୌଣସି ସାମଗ୍ରୀ ଚୟନ କରାଯାଇନାହିଁ!'}
                </p>
                <p className="text-[11px] text-amber-700/80">
                  {isEnglish
                    ? 'Scroll down to "All Items in Catalogue" below and click "+ Pin to Home" on any item to place it here.'
                    : 'ତଳକୁ ସ୍କ୍ରୋଲ୍ କରି ଯେକୌଣସି ସାମଗ୍ରୀରେ "+ ହୋମ୍‌ରେ ରଖନ୍ତୁ" କ୍ଲିକ୍ କରନ୍ତୁ।'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {homeSelectedProducts.map((p, idx) => {
                  const stockNum = typeof p.stock_qty === 'number' ? p.stock_qty : parseInt(p.stock_qty || '0', 10);
                  const isOut = stockNum <= 0;

                  return (
                    <div
                      key={`home-selected-${p.ean}-${p.rowIndex ?? ''}-${idx}`}
                      className="bg-white rounded-xl border border-amber-200 p-2.5 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-2"
                    >
                      {/* Priority rank pill */}
                      <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-900 font-black text-[10px] flex items-center justify-center shrink-0 border border-amber-300">
                        #{idx + 1}
                      </span>

                      {/* Product thumbnail */}
                      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 p-0.5 flex items-center justify-center shrink-0">
                        <img
                          src={resolveProductImage(p)}
                          alt={p.product_name}
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          className="w-full h-full object-contain"
                          onError={(e) => handleProductImageError(e, p.backup_image_url, p.ean)}
                        />
                      </div>

                      {/* Product info */}
                      <div className="min-w-0 flex-1">
                        <h5 className="font-extrabold text-slate-900 text-xs truncate">
                          {p.product_name}
                        </h5>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-black text-emerald-700">Rs. {p.selling_price}</span>
                          <span>·</span>
                          <span className={isOut ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                            {isOut ? 'Out of Stock' : `Stock: ${stockNum}`}
                          </span>
                        </div>
                      </div>

                      {/* Order Controls: Move Up / Down and Remove */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveHomeItem(idx, 'up')}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 disabled:opacity-30 disabled:hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                          title="Move Up in priority"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === homeSelectedProducts.length - 1}
                          onClick={() => handleMoveHomeItem(idx, 'down')}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 disabled:opacity-30 disabled:hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                          title="Move Down in priority"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleTrending(p.ean, p.product_name)}
                          className="w-6 h-6 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center justify-center cursor-pointer transition-colors"
                          title="Remove from Upper Home Page"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ⬇️ LOWER SECTION HEADER: All Items in Catalogue on Scroll Down */}
        <div className="bg-slate-100/90 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between text-xs font-black text-slate-700">
          <div className="flex items-center gap-1.5">
            <span>⬇️ {isEnglish ? 'All Items in Catalogue (Scroll Down)' : 'ସବୁ ସାମଗ୍ରୀ (ତଳକୁ ସ୍କ୍ରୋଲ୍ କରନ୍ତୁ)'}</span>
            <span className="text-[11px] font-normal text-slate-500">
              ({filteredCatalog.length} {isEnglish ? 'products' : 'ଟି ପ୍ରୋଡକ୍ଟ'})
            </span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
            {isEnglish ? 'Click "+ Pin to Home" on any item to add to upper page' : 'ଉପର ପେଜ୍‌ରେ ରଖିବାକୁ "+ ହୋମ୍‌ରେ ରଖନ୍ତୁ" କ୍ଲିକ୍ କରନ୍ତୁ'}
          </span>
        </div>

        {/* Unsaved Edits Global Alert Banner */}
        {dirtyCount > 0 && (
          <div className="bg-amber-500 text-slate-950 p-2.5 sm:p-3 rounded-2xl shadow-md border border-amber-300 flex items-center justify-between gap-3 mx-2 my-2 animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-5 h-5 text-amber-950 shrink-0" />
              <span className="text-xs sm:text-sm font-black truncate">
                {isEnglish
                  ? `${dirtyCount} item(s) have unsaved price/quantity changes!`
                  : `${dirtyCount} ଟି ସାମଗ୍ରୀର ମୂଲ୍ୟ/କ୍ୱାଣ୍ଟିଟି ପରିବର୍ତ୍ତନ ହୋଇଛି (Save କରନ୍ତୁ)!`}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setRowEdits({})}
                className="px-2.5 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-950 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                {isEnglish ? 'Discard' : 'ବାତିଲ୍'}
              </button>
              <button
                type="button"
                onClick={handleSaveAllRowEdits}
                disabled={isSavingAll}
                className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-900 text-white font-black text-xs rounded-xl shadow flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isSavingAll ? 'Saving...' : (isEnglish ? 'Save All Changes' : 'ସମସ୍ତ ସେଭ୍ କରନ୍ତୁ')}</span>
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {filteredCatalog.map((product, idx) => {
            const curStock = typeof product.stock_qty === 'number' ? product.stock_qty : parseInt(product.stock_qty || '0', 10);
            const isOut = curStock <= 0;
            const isSaving = savingEan === product.ean;
            const isSaved = savedSuccessEan === product.ean;
            const isSelected = selectedEans.has(product.ean);
            const draft = rowEdits[product.ean];
            const isDirty = isRowDirty(product);

            return (
              <div
                key={`catalog-row-${product.ean}-${product.rowIndex ?? ''}-${idx}`}
                className={`p-3 sm:p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-emerald-50/50'
                    : isDirty
                    ? 'bg-amber-50/60 border-l-4 border-l-amber-500'
                    : 'hover:bg-slate-50/60'
                }`}
              >
                {/* Left: Checkbox + Star + Image & Name */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {isSelectMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectProduct(product.ean);
                      }}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-90 border ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-300'
                          : 'bg-slate-100 text-slate-400 border-slate-300 hover:border-emerald-500 hover:text-emerald-700'
                      }`}
                      title={isSelected ? 'Deselect Item' : 'Select Item'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-white" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleToggleTrending(product.ean, product.product_name)}
                    title={
                      isProductInHome(product.ean)
                        ? 'Remove from Upper Home Page (ହୋମ୍ ପେଜ୍ ଉପରୁ ହଟାନ୍ତୁ)'
                        : 'Pin to Upper Home Page (ହୋମ୍ ପେଜ୍ ଉପରେ ରଖନ୍ତୁ)'
                    }
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-90 border ${
                      isProductInHome(product.ean)
                        ? 'bg-amber-100 text-amber-500 border-amber-300 ring-2 ring-amber-400/30'
                        : 'bg-slate-50 text-slate-300 border-slate-200 hover:text-amber-500 hover:bg-amber-50 hover:border-amber-200'
                    }`}
                  >
                    <Star
                      className={`w-5 h-5 transition-transform ${
                        isProductInHome(product.ean)
                          ? 'fill-amber-400 text-amber-500 scale-105'
                          : 'fill-none'
                      }`}
                    />
                  </button>

                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 p-1 flex items-center justify-center shrink-0">
                    <img
                      src={resolveProductImage(product)}
                      alt={product.product_name}
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain"
                      onError={(e) => handleProductImageError(e, product.backup_image_url, product.ean)}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                        {product.product_name}
                      </h4>
                      {isProductInHome(product.ean) && (
                        <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-black px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          ⭐ HOME TOP
                        </span>
                      )}
                      {isDirty && (
                        <span className="text-[10px] text-amber-900 font-black bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded flex items-center gap-0.5 animate-pulse">
                          ⚠️ Unsaved Edits
                        </span>
                      )}
                      {isSaved && (
                        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Saved
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-[11px] text-slate-400">
                      <span className="font-mono text-slate-600" title="All linked EANs / Barcodes">
                        EAN: {formatMultipleEans(product.ean, product.additional_eans, product.ean_list)}
                      </span>
                      {parseEanList(product.ean, product.additional_eans, product.ean_list).length > 1 && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-200">
                          {parseEanList(product.ean, product.additional_eans, product.ean_list).length} EANs
                        </span>
                      )}
                      <span>·</span>
                      <span className="text-slate-600 font-medium">{product.category || 'General'}</span>
                      {product.video_url && (
                        <span className="text-[8.5px] font-black px-1.5 py-0.2 rounded border bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-0.5" title={`Video Link: ${product.video_url}`}>
                          <Play className="w-2.5 h-2.5 fill-rose-600 text-rose-600" />
                          <span>Video</span>
                        </span>
                      )}
                      {((product.gallery_images && product.gallery_images.length > 1) || (product.additional_images && product.additional_images.length > 5)) && (
                        <span className="text-[8.5px] font-black px-1.5 py-0.2 rounded border bg-emerald-50 text-emerald-800 border-emerald-200 flex items-center gap-0.5" title="Multiple Gallery Photos available">
                          <span>📷 {product.gallery_images?.length || 'Multi'} Photos</span>
                        </span>
                      )}
                      <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded border ${
                        isRepoUrl(product.image_url)
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}>
                        {isRepoUrl(product.image_url) ? '📁 Repo Link' : '🌐 CDN Link'}
                      </span>
                      {isRepoUrl(product.image_url) && (
                        <button
                          type="button"
                          onClick={() => handleRestoreSingleProductToCdn(product)}
                          title="Restore this product to original CDN link"
                          className="text-[9px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-300 px-1.5 py-0.2 rounded cursor-pointer transition-colors"
                        >
                          🔄 Restore CDN
                        </button>
                      )}
                      {!isRepoUrl(product.image_url) && (
                        <button
                          type="button"
                          onClick={() => handleConvertSingleProductToRepo(product)}
                          title="Convert this product to repo link"
                          className="text-[9px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded cursor-pointer transition-colors"
                        >
                          ⚡ Set Repo Link
                        </button>
                      )}
                      {(product.backup_image_url || getOriginalCdnUrl(product.ean)) && (
                        <span
                          className="text-[8.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1 py-0.2 rounded flex items-center gap-0.5"
                          title={`Backup CDN: ${product.backup_image_url || getOriginalCdnUrl(product.ean)}`}
                        >
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Backup OK</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Center / Right: Editable Controls with Manual Save */}
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                  {/* Selling Price */}
                  <div className="flex items-center gap-1" title="Selling Price (ବିକ୍ରୟ ମୂଲ୍ୟ)">
                    <span className="text-[11px] font-bold text-slate-400">Rs.</span>
                    <input
                      type="number"
                      value={draft?.selling_price !== undefined ? draft.selling_price : product.selling_price}
                      onChange={(e) => handleRowFieldChange(product.ean, 'selling_price', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveRowEdits(product);
                        }
                      }}
                      className={`w-18 px-2 py-1 rounded-lg text-xs font-black outline-none transition-all ${
                        draft?.selling_price !== undefined && String(draft.selling_price).trim() !== String(product.selling_price).trim()
                          ? 'bg-white border-2 border-amber-500 text-amber-950 ring-2 ring-amber-200'
                          : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-emerald-500'
                      }`}
                    />
                  </div>

                  {/* MRP */}
                  <div className="flex items-center gap-1" title="MRP (ପ୍ୟାକେଟ୍ ମୂଲ୍ୟ)">
                    <span className="text-[10px] font-bold text-slate-400">MRP:</span>
                    <input
                      type="number"
                      value={draft?.mrp !== undefined ? draft.mrp : product.mrp}
                      onChange={(e) => handleRowFieldChange(product.ean, 'mrp', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveRowEdits(product);
                        }
                      }}
                      className={`w-16 px-2 py-1 rounded-lg text-xs font-bold line-through outline-none transition-all ${
                        draft?.mrp !== undefined && String(draft.mrp).trim() !== String(product.mrp).trim()
                          ? 'bg-white border-2 border-amber-500 text-amber-950 line-through ring-2 ring-amber-200'
                          : 'bg-slate-50 border border-slate-200 text-slate-500 focus:bg-white focus:border-emerald-500'
                      }`}
                    />
                  </div>

                  {/* Stock Quantity Number Input */}
                  <div className="flex items-center gap-1" title="Stock Quantity (ମହଜୁଦ ସଂଖ୍ୟା)">
                    <span className="text-[10px] font-bold text-slate-400">Qty:</span>
                    <input
                      type="number"
                      value={draft?.stock_qty !== undefined ? draft.stock_qty : product.stock_qty}
                      onChange={(e) => handleRowFieldChange(product.ean, 'stock_qty', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveRowEdits(product);
                        }
                      }}
                      className={`w-14 px-2 py-1 rounded-lg text-xs font-bold text-center outline-none transition-all ${
                        draft?.stock_qty !== undefined && String(draft.stock_qty).trim() !== String(product.stock_qty).trim()
                          ? 'bg-white border-2 border-amber-500 text-amber-950 font-black ring-2 ring-amber-200'
                          : 'bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-emerald-500'
                      }`}
                    />
                  </div>

                  {/* Max Item Add to Cart Limit per Customer */}
                  <div
                    className="flex items-center gap-1"
                    title="Max item add to cart per customer per order (Default: 10pc)"
                  >
                    <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      Max/Cart:
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={draft?.max_order_qty !== undefined ? draft.max_order_qty : (product.max_order_qty !== undefined ? product.max_order_qty : 10)}
                      onChange={(e) => handleRowFieldChange(product.ean, 'max_order_qty', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveRowEdits(product);
                        }
                      }}
                      className={`w-12 px-1 py-1 rounded-lg text-xs font-black text-center outline-none transition-all shadow-2xs ${
                        draft?.max_order_qty !== undefined && String(draft.max_order_qty).trim() !== String(product.max_order_qty ?? 10).trim()
                          ? 'bg-white border-2 border-amber-500 text-amber-950 ring-2 ring-amber-200'
                          : 'bg-white border border-blue-300 text-blue-900 focus:border-blue-600'
                      }`}
                    />
                  </div>

                  {/* MANUAL SAVE BUTTON (Updates item/quantity/price/mrp only after click) */}
                  <div className="flex items-center gap-1">
                    {isSaving ? (
                      <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-slate-100 text-slate-600 border border-slate-300 flex items-center gap-1.5 shadow-2xs">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        <span>Saving...</span>
                      </span>
                    ) : isSaved ? (
                      <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Saved ✓</span>
                      </span>
                    ) : isDirty ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSaveRowEdits(product)}
                          className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer ring-2 ring-emerald-400 animate-pulse"
                          title="Click to save quantity, price, and MRP changes"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{isEnglish ? 'Save' : 'ସେଭ୍ କରନ୍ତୁ'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelRowEdits(product.ean)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Cancel / Revert changes"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSaveRowEdits(product)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 flex items-center gap-1 transition-all cursor-pointer"
                        title="Click to save"
                      >
                        <Save className="w-3.5 h-3.5 text-slate-400" />
                        <span>Save</span>
                      </button>
                    )}
                  </div>

                  {/* Quick In/Out of Stock Toggle Button */}
                  <button
                    onClick={() => handleToggleStock(product)}
                    disabled={isSaving}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      isOut
                        ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {isOut ? 'Out of Stock' : 'In Stock ✓'}
                  </button>

                  {/* Dedicated 1-Click Home Page Pin / Unpin Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleTrending(product.ean, product.product_name)}
                    title={
                      isProductInHome(product.ean)
                        ? 'Remove from Upper Home Page (ହୋମ୍ ପେଜ୍ ଉପରୁ ହଟାନ୍ତୁ)'
                        : 'Pin to Upper Home Page (ହୋମ୍ ପେଜ୍ ଉପରେ ରଖନ୍ତୁ)'
                    }
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-all active:scale-95 border ${
                      isProductInHome(product.ean)
                        ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50/70 hover:text-amber-900'
                    }`}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        isProductInHome(product.ean)
                          ? 'fill-amber-500 text-amber-600'
                          : 'text-slate-400'
                      }`}
                    />
                    <span>
                      {isProductInHome(product.ean)
                        ? (isEnglish ? 'On Home Top ✓' : 'ହୋମ୍ ଉପରେ ଅଛି ✓')
                        : (isEnglish ? '+ Pin to Home' : '+ ହୋମ୍‌ରେ ରଖନ୍ତୁ')}
                    </span>
                  </button>

                  {/* Actions: Share, Edit & Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShareRefreshProduct(product)}
                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-black flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                      title={isEnglish ? "Create / Refresh WhatsApp Share Link with exact live details" : "WhatsApp ଲିଙ୍କ୍ ତିଆରି / ରିଫ୍ରେଶ୍ କରନ୍ତୁ"}
                    >
                      <RefreshCw className="w-3 h-3 text-emerald-600" />
                      <span>{isEnglish ? 'Link' : 'ଲିଙ୍କ୍'}</span>
                    </button>
                    <a
                      href={getIndividualWhatsAppShareUrl(product)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      title="Share this product with Photo & Link on WhatsApp"
                    >
                      <Share2 className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleStartEdit(product)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Product"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProduct(
                          product.ean,
                          product.rowIndex,
                          product.product_name,
                          product.additional_eans || product.ean_list
                        );
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bulk Share Products Modal */}
      {showBulkShareModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black leading-tight flex items-center gap-2">
                    <span>{isEnglish ? 'Bulk Share Products' : 'ବଲ୍କ ପ୍ରୋଡକ୍ଟ ଶେୟାର'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-400/30 text-emerald-100 font-extrabold border border-emerald-300/30">
                      {selectedProducts.length} {isEnglish ? 'Selected' : 'ଚୟନିତ'}
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-100/90 mt-0.5 font-medium">
                    {isEnglish
                      ? 'Send one by one with photo & details using your own store link (No CDN links)'
                      : 'ପ୍ରତ୍ୟେକ ପ୍ରୋଡକ୍ଟ ଫଟୋ ଓ ନିଜ ସାଇଟ୍ ଲିଙ୍କ୍ ସହ ଗୋଟିଏ ଗୋଟିଏ ସହଜରେ ପଠାନ୍ତୁ'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkShareModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50 px-3 sm:px-6 shrink-0 gap-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setBulkShareTab('one_by_one')}
                className={`py-3 px-3.5 text-xs font-black border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  bulkShareTab === 'one_by_one'
                    ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Send className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isEnglish ? '1. One-by-One Queue' : '୧. ଗୋଟିଏ ଗୋଟିଏ ପଠାନ୍ତୁ (1-by-1)'}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-black">
                  {sentIndividualEans.size}/{selectedProducts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setBulkShareTab('list')}
                className={`py-3 px-3.5 text-xs font-black border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  bulkShareTab === 'list'
                    ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>{isEnglish ? '2. Full Selected List' : '୨. ସମ୍ପୂର୍ଣ୍ଣ ତାଲିକା'}</span>
              </button>

              <button
                type="button"
                onClick={() => setBulkShareTab('combined')}
                className={`py-3 px-3.5 text-xs font-black border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  bulkShareTab === 'combined'
                    ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isEnglish ? '3. Combined Summary' : '୩. ଏକାଠି ଟେକ୍ସଟ୍'}</span>
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Optional Recipient Phone & Custom Promo Note */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-black text-slate-800 block mb-1 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isEnglish ? 'Customer WhatsApp (Optional):' : 'ଗ୍ରାହକଙ୍କ ୱାଟ୍ସଆପ୍ ନମ୍ବର (ଇଚ୍ଛାଧୀନ):'}</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1.5 rounded-xl">
                        +91
                      </span>
                      <input
                        type="tel"
                        value={targetCustomerPhone}
                        onChange={(e) => setTargetCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="e.g. 9937150743"
                        className="flex-1 text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-800 block mb-1 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isEnglish ? 'Custom Promotional Note (Optional):' : 'ସ୍ୱତନ୍ତ୍ର ଅଫର୍ ନୋଟ୍ (ଇଚ୍ଛାଧୀନ):'}</span>
                    </label>
                    <input
                      type="text"
                      value={bulkCustomNote}
                      onChange={(e) => setBulkCustomNote(e.target.value)}
                      placeholder={isEnglish ? 'e.g. Special Today Offer! Call for delivery' : 'ଯଥା: ଆଜିର ସ୍ୱତନ୍ତ୍ର ରିହାତି ଅଫର୍!'}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* TAB 1: ONE-BY-ONE QUEUE RUNNER & AUTO SENDER */}
              {bulkShareTab === 'one_by_one' && (
                <div className="space-y-4">
                  {selectedProducts.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <p className="text-xs font-bold">{isEnglish ? 'No products selected' : 'କୌଣସି ସାମଗ୍ରୀ ବଛାଯାଇନାହିଁ'}</p>
                    </div>
                  ) : (() => {
                    const totalCount = selectedProducts.length;
                    const sentCount = sentIndividualEans.size;
                    const remainingCount = Math.max(0, totalCount - sentCount);
                    const percent = totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0;

                    const safeIdx = Math.min(Math.max(0, queueIndex), selectedProducts.length - 1);
                    const currentProd = selectedProducts[safeIdx];
                    const cleanEan = String(currentProd.ean).replace(/^EAN-/, '').trim();
                    const mrp = typeof currentProd.mrp === 'number' ? currentProd.mrp : parseFloat(String(currentProd.mrp || '0'));
                    const price = typeof currentProd.selling_price === 'number' ? currentProd.selling_price : parseFloat(String(currentProd.selling_price || '0'));
                    const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
                    const savings = mrp > price ? mrp - price : 0;
                    const isSent = sentIndividualEans.has(currentProd.ean);
                    const isCurrentlyDispatched = lastDispatchedEan === currentProd.ean;
                    const ownSiteUrl = `${getSiteDomain()}/?item=${cleanEan}`;
                    const { waUrl } = buildWhatsAppSharePayload(currentProd);

                    return (
                      <div className="space-y-4">
                        {/* 1. Progress Header & Statistics */}
                        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200/80 rounded-2xl p-3.5 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black">
                            <span className="flex items-center gap-1.5 text-emerald-950 font-extrabold">
                              <span className={`w-2.5 h-2.5 rounded-full ${autoSendActive ? 'bg-emerald-500 animate-ping' : 'bg-emerald-600'}`} />
                              <span>
                                Total Selected: <strong className="text-emerald-700">{totalCount}</strong> | Sent: <strong className="text-teal-700">{sentCount}</strong> | Remaining: <strong className="text-amber-700">{remainingCount}</strong>
                              </span>
                            </span>
                            <span className="text-xs font-black text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300/60">
                              {percent}% {isEnglish ? 'Completed' : 'ସମ୍ପନ୍ନ'}
                            </span>
                          </div>

                          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden p-0.5 shadow-inner">
                            <div
                              className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 h-full rounded-full transition-all duration-300 shadow-xs"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>

                        {/* 2. Automatic Sequence Controller Box */}
                        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md space-y-3 border border-slate-800">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                                <Zap className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-xs sm:text-sm font-black flex items-center gap-2">
                                  <span>{isEnglish ? 'Automatic One-by-One Dispatcher' : 'ଅଟୋମେଟିକ୍ ଗୋଟିଏ ଗୋଟିଏ ପ୍ରେରକ'}</span>
                                  {autoSendActive && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 animate-pulse">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                      Running
                                    </span>
                                  )}
                                </h4>
                                <p className="text-[11px] text-slate-300 font-medium">
                                  {isEnglish
                                    ? 'Sequentially dispatches WhatsApp messages with delay for rich preview unfurling'
                                    : 'ଫଟୋ ପ୍ରିଭ୍ୟୁ ପାଇଁ ସମୟ ବ୍ୟବଧାନ ସହ ୱାଟ୍ସଆପ୍ ଆପେଆପେ ଖୋଲିବ'}
                                </p>
                              </div>
                            </div>

                            {/* Start / Pause & Reset Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              {!autoSendActive ? (
                                <button
                                  type="button"
                                  onClick={handleStartAutoSequence}
                                  disabled={remainingCount === 0}
                                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Play className="w-3.5 h-3.5 fill-white" />
                                  <span>{isEnglish ? '▶️ Start Auto Sequence' : '▶️ ଅଟୋ ସିକ୍ୟୁଏନ୍ସ ଆରମ୍ଭ'}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handlePauseAutoSequence}
                                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
                                >
                                  <Pause className="w-3.5 h-3.5 fill-slate-950" />
                                  <span>{isEnglish ? '⏸️ Pause' : '⏸️ ବିରତି'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={handleResetQueue}
                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                                title="Reset sent counter and restart queue"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>{isEnglish ? 'Reset' : 'ରିସେଟ୍'}</span>
                              </button>
                            </div>
                          </div>

                          {/* Delay & Auto-advance Settings Row */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800 text-xs">
                            {/* Delay Selector */}
                            <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700/60">
                              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Delay:</span>
                              </span>
                              <div className="flex items-center gap-1">
                                {[2, 3, 4, 5].map((sec) => (
                                  <button
                                    key={sec}
                                    type="button"
                                    onClick={() => setAutoDelaySeconds(sec)}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                      autoDelaySeconds === sec
                                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                                  >
                                    {sec}s
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Share Format Mode */}
                            <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700/60">
                              <span className="text-[11px] font-bold text-slate-300">Format:</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setAutoShareMode('link_only')}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                    autoShareMode === 'link_only'
                                      ? 'bg-teal-500 text-slate-950 shadow-xs'
                                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                  }`}
                                  title="Sends direct site order link (fastest rich link preview)"
                                >
                                  Direct Link
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAutoShareMode('full_details')}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                    autoShareMode === 'full_details'
                                      ? 'bg-teal-500 text-slate-950 shadow-xs'
                                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                  }`}
                                >
                                  Full Card
                                </button>
                              </div>
                            </div>

                            {/* Auto-advance on Focus Checkbox */}
                            <label className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700/60 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={autoAdvanceOnFocus}
                                onChange={(e) => setAutoAdvanceOnFocus(e.target.checked)}
                                className="rounded border-slate-600 text-emerald-500 focus:ring-0 w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
                              />
                              <span className="text-[11px] font-medium text-slate-200">
                                {isEnglish ? 'Advance on tab return' : 'ଟ୍ୟାବ୍ ଫେରିଲେ ପରବର୍ତ୍ତୀ'}
                              </span>
                            </label>
                          </div>

                          {/* Countdown Indicator Banner */}
                          {autoSendActive && (
                            <div
                              onClick={() => {
                                const nextUnsent = selectedProducts.find((p) => !sentIndividualEans.has(p.ean));
                                if (nextUnsent) dispatchQueueItem(nextUnsent);
                              }}
                              className="bg-emerald-500/20 border border-emerald-400/50 rounded-xl p-2.5 flex items-center justify-between cursor-pointer hover:bg-emerald-500/30 transition-colors"
                              title="Click to dispatch next product immediately without waiting"
                            >
                              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                                <span>
                                  {countdown > 0
                                    ? `⏳ Dispatching next item in ${countdown}s... (Click to Send Now)`
                                    : '🚀 Dispatching next item now...'}
                                </span>
                              </div>
                              <span className="text-[11px] font-black uppercase text-emerald-400 underline">
                                Send Now ⏭️
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 3. Active Product Showcase Card */}
                        <div className={`bg-white rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 border-2 transition-all ${
                          isCurrentlyDispatched
                            ? 'border-emerald-500 ring-4 ring-emerald-100'
                            : 'border-slate-200'
                        }`}>
                          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                            {/* Product Photo Box */}
                            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-slate-50 border border-slate-200 p-2 flex items-center justify-center shrink-0">
                              <img
                                src={resolveProductImage(currentProd)}
                                alt={currentProd.product_name}
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                                className="w-full h-full object-contain"
                                onError={(e) => handleProductImageError(e, currentProd.backup_image_url, currentProd.ean)}
                              />
                              {discount > 0 && (
                                <div className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-2xs">
                                  {discount}% OFF
                                </div>
                              )}
                              {isSent && (
                                <div className="absolute top-1.5 right-1.5 bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-2xs">
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Sent ✓</span>
                                </div>
                              )}
                            </div>

                            {/* Product Info & Pricing */}
                            <div className="space-y-2 flex-1 min-w-0 text-center sm:text-left">
                              <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                                <span className="text-[10px] font-extrabold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                  {currentProd.category || 'General'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  EAN: {cleanEan}
                                </span>
                                {isSent ? (
                                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    Dispatched ✔️
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                    Pending in Queue ⏳
                                  </span>
                                )}
                              </div>

                              <h4 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                                {currentProd.product_name}
                              </h4>

                              <div className="flex items-baseline justify-center sm:justify-start gap-2 flex-wrap">
                                <span className="text-xl sm:text-2xl font-black text-emerald-700">
                                  Rs.{price}
                                </span>
                                {mrp > price && (
                                  <>
                                    <span className="text-xs text-slate-400 line-through">
                                      MRP Rs.{mrp}
                                    </span>
                                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                      Save Rs.{savings} ({discount}% OFF)
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Store Direct Link Box */}
                              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 text-left space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-black text-emerald-900">
                                  <span className="flex items-center gap-1">
                                    <Link2 className="w-3 h-3 text-emerald-700" />
                                    <span>{isEnglish ? 'Our Store Order Link (No CDN):' : 'ନିଜ ଷ୍ଟୋର୍ ଅର୍ଡର ଲିଙ୍କ୍:'}</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard?.writeText(ownSiteUrl);
                                      setCopiedEan(currentProd.ean);
                                      showToast(isEnglish ? 'Copied store link! 🔗' : 'ଷ୍ଟୋର୍ ଲିଙ୍କ୍ କପି ହେଲା! 🔗');
                                      setTimeout(() => setCopiedEan(null), 2000);
                                    }}
                                    className="text-emerald-700 hover:text-emerald-950 font-black cursor-pointer underline flex items-center gap-0.5"
                                  >
                                    {copiedEan === currentProd.ean ? 'Copied ✓' : 'Copy Link'}
                                  </button>
                                </div>
                                <p className="text-[11px] font-mono font-bold text-emerald-800 break-all select-all">
                                  {ownSiteUrl}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Primary Action Button: Dispatch on WhatsApp */}
                          <div className="pt-2 space-y-2">
                            <button
                              type="button"
                              onClick={() => {
                                dispatchQueueItem(currentProd);
                                if (safeIdx < selectedProducts.length - 1) {
                                  setQueueIndex(safeIdx + 1);
                                }
                              }}
                              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all cursor-pointer"
                            >
                              <Send className="w-4 h-4" />
                              <span>
                                {isEnglish
                                  ? `📱 Send Item #${safeIdx + 1} on WhatsApp (Next ⏭️)`
                                  : `📱 ସାମଗ୍ରୀ #${safeIdx + 1} ୱାଟ୍ସଆପ୍‌ରେ ପଠାନ୍ତୁ (Next ⏭️)`}
                              </span>
                            </button>

                            {/* Secondary Actions: Native Photo Share + Copy Details */}
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  await handleShareProduct(currentProd);
                                  setSentIndividualEans((prev) => new Set(prev).add(currentProd.ean));
                                  if (safeIdx < selectedProducts.length - 1) {
                                    setQueueIndex(safeIdx + 1);
                                  }
                                }}
                                className="py-2.5 px-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 font-black text-xs flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-colors cursor-pointer"
                                title="Send with image file directly using device share sheet"
                              >
                                <Share2 className="w-3.5 h-3.5 text-blue-600" />
                                <span>{isEnglish ? 'Share with Photo File' : 'ଫଟୋ ଫାଇଲ୍ ସହ ଶେୟାର'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const text = getProductShareText(currentProd);
                                  navigator.clipboard?.writeText(text);
                                  setCopiedEan(currentProd.ean);
                                  showToast(isEnglish ? 'Copied product details! 📋' : 'ସାମଗ୍ରୀ ତଥ୍ୟ କପି ହେଲା! 📋');
                                  setTimeout(() => setCopiedEan(null), 2000);
                                }}
                                className="py-2.5 px-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 font-black text-xs flex items-center justify-center gap-1.5 hover:bg-slate-200 transition-colors cursor-pointer"
                              >
                                {copiedEan === currentProd.ean ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{isEnglish ? 'Copied! ✓' : 'କପି ହେଲା! ✓'}</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                                    <span>{isEnglish ? 'Copy Details' : 'ତଥ୍ୟ କପି କରନ୍ତୁ'}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Navigation Buttons: Prev / Next */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                            <button
                              type="button"
                              disabled={safeIdx === 0}
                              onClick={() => setQueueIndex(Math.max(0, safeIdx - 1))}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              <span>{isEnglish ? 'Prev Item' : 'ପୂର୍ବ ସାମଗ୍ରୀ'}</span>
                            </button>

                            <span className="text-[11px] font-black text-slate-500">
                              {safeIdx + 1} / {selectedProducts.length}
                            </span>

                            <button
                              type="button"
                              disabled={safeIdx >= selectedProducts.length - 1}
                              onClick={() => setQueueIndex(Math.min(selectedProducts.length - 1, safeIdx + 1))}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <span>{isEnglish ? 'Next Item' : 'ପରବର୍ତ୍ତୀ'}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 4. Complete Queue Items Preview List with Status Badges */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between text-xs font-black text-slate-800">
                            <span>{isEnglish ? 'Queue Items List:' : 'କ୍ୟୁ ସାମଗ୍ରୀ ତାଲିକା:'}</span>
                            <span className="text-[11px] text-slate-500">
                              {sentCount} / {totalCount} {isEnglish ? 'Sent' : 'ପଠାଗଲା'}
                            </span>
                          </div>

                          <div className="divide-y divide-slate-200/70 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                            {selectedProducts.map((p, idx) => {
                              const pSent = sentIndividualEans.has(p.ean);
                              const isCurrent = idx === safeIdx;
                              return (
                                <div
                                  key={`bulk-queue-${p.ean}-${p.rowIndex ?? ''}-${idx}`}
                                  onClick={() => setQueueIndex(idx)}
                                  className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                    isCurrent ? 'bg-emerald-50/80 font-bold' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="text-[10px] font-mono text-slate-400 w-5">
                                      #{idx + 1}
                                    </span>
                                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 p-0.5 flex items-center justify-center shrink-0">
                                      <img
                                        src={resolveProductImage(p)}
                                        alt={p.product_name}
                                        referrerPolicy="no-referrer"
                                        crossOrigin="anonymous"
                                        className="w-full h-full object-contain"
                                        onError={(e) => handleProductImageError(e, p.backup_image_url, p.ean)}
                                      />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-slate-800 truncate">
                                        {p.product_name}
                                      </p>
                                      <p className="text-[10px] font-bold text-emerald-700">
                                        Rs.{p.selling_price}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {pSent ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                                        <Check className="w-2.5 h-2.5" />
                                        <span>Sent ✔️</span>
                                      </span>
                                    ) : isCurrent ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                                        <span>Active 🚀</span>
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                        Queued ⏳
                                      </span>
                                    )}

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        dispatchQueueItem(p);
                                      }}
                                      className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                                      title="Send this item now"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 2: FULL SELECTED LIST WITH 1-CLICK SEND FOR EACH */}
              {bulkShareTab === 'list' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-600">
                      {isEnglish
                        ? 'Click "Send" next to any product to open WhatsApp with that specific item and our store link:'
                        : 'ପ୍ରତ୍ୟେକ ପ୍ରୋଡକ୍ଟର ଡାହାଣ ପାଖରେ ଥିବା "Send" ବଟନ୍ ଦବାଇ ଅଲଗା ଅଲଗା ପଠାନ୍ତୁ:'}
                    </p>
                    <span className="text-[11px] font-black text-emerald-800">
                      {sentIndividualEans.size} / {selectedProducts.length} {isEnglish ? 'Sent' : 'ପଠାଗଲା'}
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {selectedProducts.map((p, idx) => {
                      const isSent = sentIndividualEans.has(p.ean);
                      const cleanEan = String(p.ean).replace(/^EAN-/, '').trim();
                      const waUrl = getIndividualWhatsAppShareUrl(p, targetCustomerPhone, bulkCustomNote);
                      const ownSiteUrl = `${getSiteDomain()}/?item=${cleanEan}`;

                      return (
                        <div
                          key={`bulk-list-${p.ean}-${p.rowIndex ?? ''}-${idx}`}
                          className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="text-[10px] font-black text-slate-400 w-5">{idx + 1}.</span>
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0">
                              <img
                                src={resolveProductImage(p)}
                                alt={p.product_name}
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                                className="w-full h-full object-contain"
                                onError={(e) => handleProductImageError(e, p.backup_image_url, p.ean)}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black text-slate-900 truncate">{p.product_name}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs font-black text-emerald-700">
                                  Rs.{p.selling_price}
                                </span>
                                <span className="text-[10px] text-slate-400 line-through">
                                  Rs.{p.mrp}
                                </span>
                                <span className="text-[9.5px] font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 truncate max-w-[130px]">
                                  ?item={cleanEan}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleShareProduct(p)}
                              className="p-2 rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                              title="Share photo file directly"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>

                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                setSentIndividualEans((prev) => new Set(prev).add(p.ean));
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                                isSent
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs active:scale-95'
                              }`}
                            >
                              {isSent ? (
                                <>
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{isEnglish ? 'Sent ✓' : 'ପଠାଗଲା ✓'}</span>
                                </>
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  <span>{isEnglish ? 'Send' : 'ପଠାନ୍ତୁ'}</span>
                                </>
                              )}
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: COMBINED SUMMARY BROADCAST (CLEAN, ZERO CDN LINKS) */}
              {bulkShareTab === 'combined' && (
                <div className="bg-gradient-to-br from-indigo-50/70 to-emerald-50/70 border border-indigo-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-700" />
                      <span>{isEnglish ? 'Broadcast All Items Together' : 'ସମସ୍ତ ଚୟନିତ ସାମଗ୍ରୀ ଏକାଠି ପଠାନ୍ତୁ'}</span>
                    </h4>
                    <span className="text-[11px] font-black text-indigo-800">
                      {selectedProducts.length} items
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {isEnglish
                      ? 'Clean text catalog with offer prices, discounts, and our own store order links (All raw CDN links removed).'
                      : 'ନିଜ ଷ୍ଟୋର୍ ଅର୍ଡର ଲିଙ୍କ୍ ଓ ଅଫର୍ ମୂଲ୍ୟ ସହ ଏକାଠି ମେସେଜ୍ (କୌଣସି CDN ଲିଙ୍କ୍ ରହିବ ନାହିଁ)।'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleAdminBulkShare(selectedProducts, bulkCustomNote, isEnglish)}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-all cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isEnglish ? 'Share on WhatsApp' : 'ୱାଟ୍ସଆପ୍‌ରେ ପଠାନ୍ତୁ'}</span>
                    </button>

                    <button
                      onClick={async () => {
                        const text = getAdminBulkShareText(selectedProducts, bulkCustomNote, isEnglish);
                        try {
                          if (navigator.clipboard) {
                            await navigator.clipboard.writeText(text);
                            setIsCopiedBulk(true);
                            showToast(isEnglish ? 'Copied all product details! 📋' : 'ସମସ୍ତ ତଥ୍ୟ କପି ହେଲା! 📋');
                            setTimeout(() => setIsCopiedBulk(false), 2000);
                          }
                        } catch (e) {
                          showToast('Error copying text');
                        }
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-white border border-indigo-300 text-indigo-900 font-black text-xs flex items-center justify-center gap-2 hover:bg-indigo-100/50 shadow-xs active:scale-98 transition-all cursor-pointer"
                    >
                      {isCopiedBulk ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>{isEnglish ? 'Copied to Clipboard! ✓' : 'କପି ସଫଳ! ✓'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-indigo-700" />
                          <span>{isEnglish ? 'Copy Formatted Text 📋' : 'ଟେକ୍ସଟ୍ କପି କରନ୍ତୁ 📋'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSentIndividualEans(new Set());
                  setSelectedEans(new Set());
                  setQueueIndex(0);
                  setShowBulkShareModal(false);
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {isEnglish ? 'Reset & Close' : 'ରିସେଟ୍ ଓ ବନ୍ଦ କରନ୍ତୁ'}
              </button>

              <button
                type="button"
                onClick={() => setShowBulkShareModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
              >
                {isEnglish ? 'Done' : 'ହୋଇଗଲା'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Admin EAN / Barcode Camera Scanner */}
      <AdminBarcodeScannerModal
        isOpen={showEanScanner}
        onClose={() => setShowEanScanner(false)}
        onScan={handleBarcodeScanned}
        title={editingEan ? 'Update Product Barcode' : 'Scan New Product Barcode'}
        subtitle="Point camera at product barcode (EAN-13, EAN-8, UPC, Code-128)"
      />

      {/* Admin WhatsApp Link & Cache Refresh Modal */}
      {shareRefreshProduct && (
        <AdminProductShareRefreshModal
          product={shareRefreshProduct}
          allProducts={catalog}
          onClose={() => setShareRefreshProduct(null)}
          onSelectProduct={(p) => setShareRefreshProduct(p)}
          onUpdateAllProducts={(updatedList) => setCatalog(updatedList)}
        />
      )}
    </div>
  );
};
