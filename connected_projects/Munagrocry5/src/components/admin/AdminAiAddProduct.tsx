import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Product } from '../../types';
import {
  Zap,
  Camera,
  Upload,
  Sparkles,
  Crop,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Save,
  Barcode,
  Image as ImageIcon,
  Key,
  RotateCcw,
  Tag,
  ArrowRight,
  Eye,
  EyeOff,
  Check,
  Copy,
  Layers,
  Smartphone,
  Sliders,
  SunMedium,
  RotateCw
} from 'lucide-react';
import {
  uploadAndGenerateImageLink,
  getWebhookUrl,
  getGoogleSheetId,
  updateProductOnSheet
} from '../../services/api';
import {
  extractWithClineAi,
  fetchLiveFreeVisionModels,
  generateStandardEan890,
  getActiveAiApiKey,
  fetchAiKeyFromSheetConfig,
  saveAiKeyToSheetConfig,
  DEFAULT_FREE_MODELS,
  OpenRouterModel
} from '../../services/groqVisionService';
import { showToast } from '../Toast';
import { resolveProductImage, handleProductImageError } from '../../utils/imageHelper';
import { AdminBarcodeScannerModal } from './AdminBarcodeScannerModal';

export const AdminAiAddProduct: React.FC = () => {
  const { catalog, addProduct } = useApp();
  const { isEnglish } = useLanguage();

  // Dynamic store categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((p) => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    const list = Array.from(set);
    const defaults = ['Mobile Phones', 'Grocery', 'Electronics', 'Spices', 'Snacks', 'Beverages', 'Oil & Ghee', 'Personal Care', 'Dairy'];
    defaults.forEach((d) => {
      if (!list.includes(d)) list.push(d);
    });
    return list;
  }, [catalog]);

  // ================= 1. ENGINE & MODEL SELECTION STATE =================
  const [apiKey, setApiKey] = useState<string>(() => getActiveAiApiKey());
  const [showKeyPassword, setShowKeyPassword] = useState<boolean>(false);
  const [modelsList, setModelsList] = useState<OpenRouterModel[]>(DEFAULT_FREE_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>('openrouter/free');
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);
  const [keySavedBadge, setKeySavedBadge] = useState<boolean>(false);

  const [isSavingKey, setIsSavingKey] = useState<boolean>(false);
  const [isReadingKey, setIsReadingKey] = useState<boolean>(false);

  // Auto-fetch dynamic key from sheet config on mount so every admin uses the same key
  useEffect(() => {
    fetchAiKeyFromSheetConfig().then((key) => {
      if (key) setApiKey(key);
    });
  }, []);

  const handleSaveApiKey = async (newKey: string) => {
    const trimmed = newKey.trim();
    setApiKey(trimmed);
    setIsSavingKey(true);
    try {
      await saveAiKeyToSheetConfig(trimmed);
      setKeySavedBadge(true);
      setTimeout(() => setKeySavedBadge(false), 3500);
      showToast(isEnglish ? 'Cline API Key saved to Google Sheet for all admins! ✅' : 'Cline API Key ଗୁଗୁଲ୍ ସିଟ୍‌ରେ ସେଭ୍ ହେଲା — ସବୁ ଆଡମିନ୍ ପାଇଁ ସକ୍ରିୟ! ✅');
    } catch (e) {
      showToast('Key saved locally');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleReadApiKeyFromSheet = async () => {
    setIsReadingKey(true);
    try {
      const key = await fetchAiKeyFromSheetConfig();
      if (key) {
        setApiKey(key);
        showToast(isEnglish ? 'Loaded Cline API Key from Google Sheet! ✅' : 'Google Sheet ରୁ କୀ ଲୋଡ୍ ହେଲା! ✅');
      } else {
        showToast(isEnglish ? 'No key found on Sheet Config yet. Enter & save a key to sync.' : 'Sheet ରେ କୌଣସି କୀ ନାହିଁ। ନୂଆ କୀ ସେଭ୍ କରନ୍ତୁ।');
      }
    } catch (e) {
      showToast('Failed to read key from sheet');
    } finally {
      setIsReadingKey(false);
    }
  };

  const handleRefreshLiveModels = async () => {
    setIsFetchingModels(true);
    try {
      const models = await fetchLiveFreeVisionModels(apiKey);
      setModelsList(models);
      showToast(isEnglish ? `Fetched ${models.length} live OpenRouter models! 🔄` : `${models.length} ଟି ଲାଇଭ୍ ମଡେଲ୍ ଲୋଡ୍ ହେଲା! 🔄`);
    } catch (err: any) {
      showToast(isEnglish ? 'Could not reach OpenRouter. Using cached models.' : 'ମଡେଲ୍ ଫେଚ୍ ବିଫଳ। କ୍ୟାଚ୍ ମଡେଲ୍ ବ୍ୟବହାର ହେଉଛି।');
    } finally {
      setIsFetchingModels(false);
    }
  };

  // ================= 2. PACKAGING PHOTO & CANVAS STUDIO STATE =================
  const [originalImageSrc, setOriginalImageSrc] = useState<string>('');
  const [currentCanvasSrc, setCurrentCanvasSrc] = useState<string>('');
  const [hostedImageUrl, setHostedImageUrl] = useState<string>('');
  const [hostedBackupUrl, setHostedBackupUrl] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  // Canvas processing toggles & angles
  const [isMobileCropped, setIsMobileCropped] = useState<boolean>(false);
  const [isStudioWhiteBg, setIsStudioWhiteBg] = useState<boolean>(false);
  const [isEnhanced, setIsEnhanced] = useState<boolean>(false);
  const [rotationAngle, setRotationAngle] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Handle image upload from file or camera
  const handleFileSelect = (file: File) => {
    setExtractionError(null);
    setPushSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      setOriginalImageSrc(src);
      setCurrentCanvasSrc(src);
      setIsMobileCropped(false);
      setIsStudioWhiteBg(false);
      setIsEnhanced(false);
      setRotationAngle(0);

      // Auto-upload to hosted permanent URL
      uploadToHosting(file);
    };
    reader.readAsDataURL(file);
  };

  // Upload image to ImgBB or permanent storage
  const uploadToHosting = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const res = await uploadAndGenerateImageLink(file);
      if (res.success && res.data?.url) {
        setHostedImageUrl(res.data.url);
        setHostedBackupUrl(res.data.url);
      }
    } catch (err) {
      console.warn('Hosted image upload failed:', err);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Re-render HTML5 Canvas Studio Processor
  const processCanvas = (
    mobileCrop: boolean,
    whiteBg: boolean,
    enhanced: boolean,
    rotation: number
  ) => {
    if (!originalImageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let srcX = 0;
      let srcY = 0;
      let srcW = img.width;
      let srcH = img.height;

      // 📱 "Crop Mobile Only" - Focuses on the handset / central 70% product area
      if (mobileCrop) {
        const cropWidth = Math.floor(img.width * 0.72);
        const cropHeight = Math.floor(img.height * 0.72);
        srcX = Math.floor((img.width - cropWidth) / 2);
        srcY = Math.floor((img.height - cropHeight) / 2);
        srcW = cropWidth;
        srcH = cropHeight;
      }

      // Check orientation for rotation
      const isRotatedQuarter = rotation % 180 !== 0;
      const targetW = isRotatedQuarter ? 1000 : 1000;
      const targetH = isRotatedQuarter ? 1000 : 1000;

      canvas.width = targetW;
      canvas.height = targetH;

      // ⬜ "Studio White BG" - Pure #ffffff matte margin
      if (whiteBg) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Save context for transformations
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // ✨ "Enhance / Contrast"
      if (enhanced) {
        ctx.filter = 'contrast(130%) brightness(105%) saturate(112%)';
      } else {
        ctx.filter = 'none';
      }

      // Calculate aspect ratio fit within padding
      const padding = whiteBg ? 80 : 20;
      const maxDrawW = canvas.width - padding * 2;
      const maxDrawH = canvas.height - padding * 2;

      let drawW = isRotatedQuarter ? srcH : srcW;
      let drawH = isRotatedQuarter ? srcW : srcH;

      const scale = Math.min(maxDrawW / drawW, maxDrawH / drawH);
      const finalW = srcW * scale;
      const finalH = srcH * scale;

      ctx.drawImage(img, srcX, srcY, srcW, srcH, -finalW / 2, -finalH / 2, finalW, finalH);
      ctx.restore();

      const processedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setCurrentCanvasSrc(processedDataUrl);

      // Generate blob to update file & cloud link
      canvas.toBlob((blob) => {
        if (blob) {
          const processedFile = new File([blob], 'cline_studio_product.jpg', { type: 'image/jpeg' });
          uploadToHosting(processedFile);
        }
      }, 'image/jpeg', 0.92);
    };

    img.src = originalImageSrc;
  };

  // Canvas Control Handlers
  const toggleMobileCrop = () => {
    const next = !isMobileCropped;
    setIsMobileCropped(next);
    processCanvas(next, isStudioWhiteBg, isEnhanced, rotationAngle);
  };

  const toggleStudioWhiteBg = () => {
    const next = !isStudioWhiteBg;
    setIsStudioWhiteBg(next);
    processCanvas(isMobileCropped, next, isEnhanced, rotationAngle);
  };

  const toggleEnhance = () => {
    const next = !isEnhanced;
    setIsEnhanced(next);
    processCanvas(isMobileCropped, isStudioWhiteBg, next, rotationAngle);
  };

  const handleRotate90 = () => {
    const nextAngle = (rotationAngle + 90) % 360;
    setRotationAngle(nextAngle);
    processCanvas(isMobileCropped, isStudioWhiteBg, isEnhanced, nextAngle);
  };

  const handleResetCanvas = () => {
    setIsMobileCropped(false);
    setIsStudioWhiteBg(false);
    setIsEnhanced(false);
    setRotationAngle(0);
    setCurrentCanvasSrc(originalImageSrc);
    showToast(isEnglish ? 'Canvas reset to original' : 'କ୍ୟାନଭାସ୍ ପୁନରୁଦ୍ଧାର ହେଲା');
  };

  // ================= 3. DUAL PROMPT & AI ACTION STATE =================
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string>('');

  const handleExtractWithClineAi = async () => {
    const imageToScan = currentCanvasSrc || originalImageSrc;
    if (!imageToScan) {
      setExtractionError(isEnglish ? 'Please upload or capture a product packaging photo first.' : 'ଦୟାକରି ପ୍ରଥମେ ପ୍ରୋଡକ୍ଟ ଫଟୋ ଅପଲୋଡ୍ କରନ୍ତୁ।');
      return;
    }

    const key = apiKey.trim();
    if (!key) {
      setExtractionError(isEnglish ? 'Please enter your OpenRouter API key in Step 1.' : 'ଦୟାକରି ପ୍ରଥମେ OpenRouter API Key ଦିଅନ୍ତୁ।');
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);

    try {
      const extracted = await extractWithClineAi(
        imageToScan,
        selectedModel,
        customPrompt,
        key,
        categories
      );

      setProdName(extracted.product_name || '');
      setProdCategory(extracted.category || 'Mobile Phones');
      setProdMrp(extracted.mrp ? String(extracted.mrp) : '');
      setProdSp(extracted.selling_price ? String(extracted.selling_price) : (extracted.mrp ? String(extracted.mrp) : ''));
      setProdStock(String(extracted.stock_qty || 10));
      setProdEan(extracted.ean || generateStandardEan890());
      setProdDesc(extracted.description || '');
      setProviderUsed(extracted.providerUsed || selectedModel);

      showToast(isEnglish ? '✨ Cline AI Extraction Complete!' : '✨ Cline AI ଏକ୍ସଟ୍ରାକ୍ସନ୍ ସଫଳ ହେଲା!');
    } catch (err: any) {
      console.error('Cline AI Scan error:', err);
      setExtractionError(err?.message || 'OpenRouter extraction failed. Verify API key & model.');
      showToast(isEnglish ? 'AI extraction error. You can still fill manually.' : 'AI ଏକ୍ସଟ୍ରାକ୍ସନ୍ ତ୍ରୁଟି। ହାତରେ ଭରିପାରିବେ।');
    } finally {
      setIsExtracting(false);
    }
  };

  // ================= 4. LIVE STORE CARD & 1-CLICK SYNC STATE =================
  const [prodName, setProdName] = useState<string>('');
  const [prodCategory, setProdCategory] = useState<string>('Mobile Phones');
  const [prodMrp, setProdMrp] = useState<string>('');
  const [prodSp, setProdSp] = useState<string>('');
  const [prodStock, setProdStock] = useState<string>('10');
  const [prodEan, setProdEan] = useState<string>(() => generateStandardEan890());
  const [prodDesc, setProdDesc] = useState<string>('');
  const [isPushingToSheet, setIsPushingToSheet] = useState<boolean>(false);
  const [pushSuccess, setPushSuccess] = useState<boolean>(false);
  const [copiedRow, setCopiedRow] = useState<boolean>(false);

  // Calculate discount percentage for live store card
  const discountPercent = useMemo(() => {
    const mrp = Number(prodMrp) || 0;
    const sp = Number(prodSp) || 0;
    if (mrp > sp && mrp > 0) {
      return Math.round(((mrp - sp) / mrp) * 100);
    }
    return 0;
  }, [prodMrp, prodSp]);

  // Regenerate GS1 890 standard EAN
  const handleRegenerateEan = () => {
    const newEan = generateStandardEan890();
    setProdEan(newEan);
    showToast(isEnglish ? `Generated EAN: ${newEan}` : `ନୂଆ EAN ସୃଷ୍ଟି ହେଲା: ${newEan}`);
  };

  // Barcode Scanner Modal State & Callback
  const [showEanScannerModal, setShowEanScannerModal] = useState<boolean>(false);
  const handleBarcodeScanned = (scannedCode: string) => {
    const clean = scannedCode.trim();
    if (clean) {
      setProdEan(clean);
      setShowEanScannerModal(false);
      showToast(isEnglish ? `Barcode Scanned: ${clean} ✅` : `ବାରକୋଡ୍ ସ୍କାନ ହେଲା: ${clean} ✅`);
    }
  };

  // Copy Row Data (Tab-separated for direct Google Sheets paste)
  const handleCopyRowData = () => {
    const finalImage = hostedImageUrl || currentCanvasSrc || '/icon-512.png';
    const rowValues = [
      prodName.trim() || 'New Product',
      Number(prodMrp) || Number(prodSp) || 0,
      Number(prodSp) || 0,
      Number(prodStock) || 10,
      prodEan.trim() || generateStandardEan890(),
      finalImage,
      prodCategory.trim() || 'Mobile Phones',
      hostedBackupUrl || finalImage
    ];

    const tsv = rowValues.join('\t');
    navigator.clipboard.writeText(tsv).then(() => {
      setCopiedRow(true);
      setTimeout(() => setCopiedRow(false), 2500);
      showToast(isEnglish ? '📋 Row copied to clipboard! Paste into Google Sheets.' : '📋 Row କପି ହେଲା! Sheet ରେ ପେଷ୍ଟ କରନ୍ତୁ।');
    }).catch(() => {
      showToast('Copy failed. Please copy manually.');
    });
  };

  // 1-Click Save to Google Sheet (Sheet1 Schema Fidelity)
  const handleSaveToSheet1 = async () => {
    if (!prodName.trim()) {
      showToast(isEnglish ? 'Product Name is required.' : 'ପ୍ରୋଡକ୍ଟ ନାମ ଆବଶ୍ୟକ।');
      return;
    }
    if (!prodSp.trim()) {
      showToast(isEnglish ? 'Selling Price is required.' : 'ବିକ୍ରୟ ମୂଲ୍ୟ ଆବଶ୍ୟକ।');
      return;
    }

    setIsPushingToSheet(true);
    setPushSuccess(false);

    const finalEan = (prodEan.trim() || generateStandardEan890()).replace(/^EAN-/, '').trim();
    const finalImage = hostedImageUrl || currentCanvasSrc || '/icon-512.png';
    const finalBackup = hostedBackupUrl || hostedImageUrl || finalImage;
    const finalMrp = Number(prodMrp) || Number(prodSp) || 0;
    const finalSp = Number(prodSp) || 0;
    const finalStock = Number(prodStock) || 10;
    const finalCategory = prodCategory.trim() || 'Mobile Phones';

    // Exact 8-Column Map for Sheet1
    // 1. Product Name, 2. MRP, 3. Selling Price, 4. Stock Qty, 5. EAN Barcode, 6. Image URL, 7. Column 1 (Category), 8. backup_image_url
    const rawRowArray = [
      prodName.trim(),
      finalMrp,
      finalSp,
      finalStock,
      finalEan,
      finalImage,
      finalCategory,
      finalBackup
    ];

    const sheetPayload = {
      action: 'update_product',
      sheet_id: getGoogleSheetId(),
      worksheet: 'Sheet1',
      product_name: prodName.trim(),
      mrp: finalMrp,
      selling_price: finalSp,
      stock_qty: finalStock,
      ean: finalEan,
      image_url: finalImage,
      category: finalCategory,
      backup_image_url: finalBackup,
      description: prodDesc.trim() || prodName.trim(),
      max_order_qty: 10,
      raw_row: rawRowArray
    };

    try {
      const finalDescription = prodDesc.trim() || prodName.trim();
      const newProductItem: Product = {
        ean: finalEan,
        additional_eans: finalEan,
        ean_list: [finalEan],
        product_name: prodName.trim(),
        mrp: finalMrp,
        selling_price: finalSp,
        stock_qty: finalStock,
        category: finalCategory,
        description: finalDescription,
        image_url: finalImage,
        backup_image_url: finalBackup,
        max_order_qty: 10
      };

      // Add to local AppContext Catalog state and overrides immediately
      addProduct(newProductItem);

      // Push to Google Sheet using unified updateProductOnSheet
      await updateProductOnSheet({
        ean: finalEan,
        additional_eans: finalEan,
        ean_list: [finalEan],
        product_name: prodName.trim(),
        mrp: finalMrp,
        selling_price: finalSp,
        stock_qty: finalStock,
        category: finalCategory,
        description: finalDescription,
        image_url: finalImage,
        backup_image_url: finalBackup,
        max_order_qty: 10
      });

      setPushSuccess(true);
      showToast(isEnglish ? `🎉 "${prodName.trim()}" added to Sheet1!` : `🎉 "${prodName.trim()}" Sheet1 ରେ ଯୋଡ଼ାଗଲା!`);

      // Reset after success
      setTimeout(() => {
        setOriginalImageSrc('');
        setCurrentCanvasSrc('');
        setHostedImageUrl('');
        setHostedBackupUrl('');
        setProdName('');
        setProdMrp('');
        setProdSp('');
        setProdStock('10');
        setProdEan(generateStandardEan890());
        setProdDesc('');
        setPushSuccess(false);
      }, 2500);
    } catch (err: any) {
      console.error('Error saving to Sheet1:', err);
      showToast(isEnglish ? 'Network delay saving to sheet. Product staged locally.' : 'ସିଟ୍ ରେ ସେଭ୍ କରିବାରେ ତ୍ରୁଟି ହେଲା।');
    } finally {
      setIsPushingToSheet(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-400 flex items-center justify-center shadow-inner">
              <Zap className="w-6 h-6 text-indigo-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Cline AI Studio
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full">
                  OpenRouter Multimodal
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
                4-Step Vision Pipeline: Shutter Canvas Editor, Multimodal Free OCR, & 1-Click Sheet1 Sync
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-slate-800/80 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors"
            >
              <span>Get Free Key</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* ================= STEP 1: ENGINE & MODEL SELECTION BAR ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center">
              1
            </span>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Engine & Model Selection
            </h2>
          </div>
          {keySavedBadge && (
            <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-fade-in">
              <Check className="w-3 h-3" /> Auto-Saved to Google Sheet!
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          {/* API Key Input */}
          <div className="md:col-span-6">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Cline / OpenRouter API Key <span className="text-slate-400 font-normal">(sk-or-v1-...)</span>
              </label>
              <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.2 rounded-full border border-indigo-200">
                🌐 Single Shared Key
              </span>
            </div>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <input
                  type={showKeyPassword ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste sk-or-v1-..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKeyPassword(!showKeyPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showKeyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleSaveApiKey(apiKey)}
                disabled={isSavingKey}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
                title="Save & Sync to Google Sheet for all admins"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingKey ? 'Saving...' : 'Save to Sheet'}</span>
              </button>
              <button
                type="button"
                onClick={handleReadApiKeyFromSheet}
                disabled={isReadingKey}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-2.5 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
                title="Read live key from Google Sheet"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReadingKey ? 'animate-spin' : ''}`} />
                <span>Read</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
              🔒 ଏହି ଗୋଟିଏ କୀ Google Sheet Config ରେ ସେଭ୍ ହୁଏ — ସମସ୍ତ ଆଡମିନ୍ ଯେକୌଣସି ଫୋନ୍ ବା PC ରୁ ଏହି ଗୋଟିଏ କୀ ବ୍ୟବହାର କରି Product Add କରିପାରିବେ।
            </p>
          </div>

          {/* Model Selector */}
          <div className="md:col-span-4">
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Multimodal Vision Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {modelsList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1 truncate">
              {modelsList.find((m) => m.id === selectedModel)?.description || 'Selected OpenRouter engine'}
            </p>
          </div>

          {/* Fetch Live Models Button */}
          <div className="md:col-span-2 flex items-end">
            <button
              type="button"
              onClick={handleRefreshLiveModels}
              disabled={isFetchingModels}
              className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingModels ? 'animate-spin' : ''}`} />
              <span>{isFetchingModels ? 'Fetching...' : '🔄 Live Models'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= STEP 2: PACKAGING PHOTO & STUDIO CANVAS EDITOR ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center">
              2
            </span>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Packaging Photo & Studio Canvas Editor
            </h2>
          </div>
          {isUploadingImage && (
            <span className="text-[11px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" /> Uploading to cloud...
            </span>
          )}
          {hostedImageUrl && !isUploadingImage && (
            <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Cloud Link Ready
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Shutter & File Upload Controls */}
          <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
            <div>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                Capture the product box, back-of-pack MRP label, or mobile handset. The Studio Canvas Editor cleans up reflections and applies e-commerce studio white matte.
              </p>

              <div className="grid grid-cols-2 gap-2.5 mb-3">
                {/* Take Photo Button */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Camera className="w-5 h-5" />
                  <span>Take Photo</span>
                </button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />

                {/* Upload Image Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-5 h-5 text-indigo-600" />
                  <span>Upload File</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
              </div>

              {/* Drag & drop or status box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50"
              >
                <ImageIcon className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                <span className="text-xs font-bold text-slate-700 block">
                  Click or Drop Product Photo Here
                </span>
                <span className="text-[10px] text-slate-400">
                  PNG, JPG, WEBP up to 10MB
                </span>
              </div>
            </div>

            {/* Hosted link display */}
            {hostedImageUrl && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Hosted Image URL
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={hostedImageUrl}
                    className="w-full text-[10px] font-mono text-slate-600 bg-white border border-slate-200 rounded px-2 py-1 truncate"
                  />
                  <a
                    href={hostedImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-slate-500 hover:text-indigo-600 shrink-0"
                    title="Open Image"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Canvas Studio Processor & Preview */}
          <div className="lg:col-span-8 flex flex-col items-center justify-center bg-slate-900 rounded-2xl p-4 border border-slate-800 relative min-h-[320px]">
            {/* Top Toolbar of Canvas Controls */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-3 bg-slate-800/80 backdrop-blur p-2 rounded-xl border border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 px-2">
                Studio Tools:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {/* 📱 Crop Mobile Only */}
                <button
                  type="button"
                  onClick={toggleMobileCrop}
                  disabled={!originalImageSrc}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 ${
                    isMobileCropped
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                  title="Crop center region to isolate handset from outer packaging"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>📱 Crop Mobile Only</span>
                </button>

                {/* ⬜ Studio White BG */}
                <button
                  type="button"
                  onClick={toggleStudioWhiteBg}
                  disabled={!originalImageSrc}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 ${
                    isStudioWhiteBg
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                  title="Apply pure #ffffff matte studio background"
                >
                  <Crop className="w-3.5 h-3.5" />
                  <span>⬜ Studio White BG</span>
                </button>

                {/* ✨ Enhance / Contrast */}
                <button
                  type="button"
                  onClick={toggleEnhance}
                  disabled={!originalImageSrc}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 ${
                    isEnhanced
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                  title="Enhance contrast and clarity of barcode/printed text"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>✨ Enhance</span>
                </button>

                {/* 🔄 Rotate 90° */}
                <button
                  type="button"
                  onClick={handleRotate90}
                  disabled={!originalImageSrc}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 hover:bg-slate-600 flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                  title="Rotate clockwise 90 degrees"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotate 90°</span>
                </button>

                {/* ↩️ Reset */}
                <button
                  type="button"
                  onClick={handleResetCanvas}
                  disabled={!originalImageSrc}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-700 text-rose-300 hover:bg-rose-900/50 flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                  title="Reset to original uploaded photo"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Canvas / Image Display */}
            <div className="relative max-h-[360px] flex items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950/70 p-2 w-full">
              {currentCanvasSrc ? (
                <img
                  src={currentCanvasSrc}
                  alt="Product Canvas Preview"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  className="max-h-[320px] max-w-full object-contain rounded-lg shadow-lg"
                />
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Camera className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-bold text-slate-400">No Image Loaded</p>
                  <p className="text-xs text-slate-500">Upload or take a packaging photo above</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ================= STEP 3: DUAL PROMPT & AI ACTION ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center">
              3
            </span>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Dual Prompt & AI Action
            </h2>
          </div>
          {providerUsed && (
            <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-2.5 py-0.5 rounded-full">
              Engine: {providerUsed}
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Custom Instruction to AI <span className="text-slate-400 font-normal">(Optional hints for price, memory, or highlights)</span>
            </label>
            <div className="relative">
              <textarea
                rows={2}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder='e.g., "Keep selling price 749, highlight 6000mAh battery and 50MP camera" or "Category: Mobile Phones, 6GB RAM 128GB ROM"'
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Quick Prompt Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Hints:</span>
              {[
                '📱 Category: Mobile Phones',
                '🛒 Category: Grocery',
                '⚡ Special Discount Price',
                '🔋 Highlight Battery & Storage',
                '🏷️ Read MRP & Barcode carefully'
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setCustomPrompt((prev) => (prev ? `${prev}, ${chip}` : chip))}
                  className="text-[10px] font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* AI Scan Error Banner */}
          {extractionError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{extractionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setExtractionError(null)}
                className="text-rose-500 hover:text-rose-800 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Big Action Button */}
          <button
            type="button"
            onClick={handleExtractWithClineAi}
            disabled={isExtracting || !currentCanvasSrc}
            className={`w-full py-3.5 px-6 rounded-xl font-black text-sm text-white shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${
              isExtracting
                ? 'bg-indigo-700 cursor-wait'
                : 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 hover:shadow-indigo-500/25 active:scale-[0.99]'
            }`}
          >
            {isExtracting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Scanning with Cline AI & OpenRouter...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300" />
                <span>🚀 Scan with Cline AI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ================= STEP 4: LIVE STORE CARD & 1-CLICK SYNC ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center">
              4
            </span>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Live Store Card & 1-Click Sync
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyRowData}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedRow ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedRow ? 'Copied!' : '📋 Copy Row Data'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Interactive Live Store Card Preview */}
          <div className="lg:col-span-4 flex flex-col items-center">
            <div className="w-full max-w-xs bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden relative group">
              {/* Live Preview Label */}
              <div className="bg-slate-900 text-white text-[10px] font-black tracking-wider uppercase px-3 py-1 flex items-center justify-between">
                <span>Customer Store View</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              {/* Product Photo with Studio White BG */}
              <div className="relative aspect-square w-full bg-white flex items-center justify-center p-3 border-b border-slate-100">
                {currentCanvasSrc || hostedImageUrl ? (
                  <img
                    src={currentCanvasSrc || hostedImageUrl}
                    alt={prodName || 'Product'}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-slate-400">
                    <ImageIcon className="w-12 h-12 mx-auto mb-1 opacity-30" />
                    <span className="text-[11px]">No Photo</span>
                  </div>
                )}

                {/* Discount Badge */}
                {discountPercent > 0 && (
                  <span className="absolute top-2 left-2 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-xs">
                    {discountPercent}% OFF
                  </span>
                )}

                {/* Stock Indicator */}
                <span className="absolute bottom-2 right-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  Stock: {prodStock || 10}
                </span>
              </div>

              {/* Product Info */}
              <div className="p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                    {prodCategory || 'Category'}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-slate-900 line-clamp-2 leading-tight">
                  {prodName || 'Product Name (Extracted by AI)'}
                </h3>

                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {prodDesc || 'Product description and specifications will appear here...'}
                </p>

                {/* Price Display */}
                <div className="flex items-baseline gap-2 pt-1 border-t border-slate-100">
                  <span className="text-base font-black text-slate-900">
                    Rs. {prodSp || '0'}
                  </span>
                  {Number(prodMrp) > Number(prodSp) && (
                    <span className="text-xs text-slate-400 line-through">
                      Rs. {prodMrp}
                    </span>
                  )}
                </div>

                {/* Barcode Badge */}
                <div className="bg-slate-50 rounded-lg p-1.5 flex items-center justify-between border border-slate-200 text-[10px] font-mono text-slate-600">
                  <div className="flex items-center gap-1">
                    <Barcode className="w-3.5 h-3.5 text-slate-500" />
                    <span>{prodEan || 'EAN-13'}</span>
                  </div>
                  <span className="text-[9px] text-slate-400">GS1 890</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Sheet1 Schema Editable Form */}
          <div className="lg:col-span-8 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Product Name */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Product Name (Brand + Full Model + Pack Size)
                </label>
                <input
                  type="text"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g., Vivo Y200e 5G (8GB RAM, 128GB Storage, Saffron Green)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Category
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    placeholder="Or type..."
                    className="w-28 bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* EAN / Barcode */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    EAN-13 Barcode
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEanScannerModal(true)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200 transition-colors"
                      title="Open Barcode Scanner"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Scan Barcode</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRegenerateEan}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                      title="Generate new 890 GS1 EAN"
                    >
                      🎲 Gen 890
                    </button>
                  </div>
                </div>
                <div className="relative flex items-center">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={prodEan}
                    onChange={(e) => setProdEan(e.target.value)}
                    placeholder="8901234567890"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-24 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEanScannerModal(true)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                    title="Scan Barcode via Camera"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Scan</span>
                  </button>
                </div>
              </div>

              {/* MRP */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Printed MRP (Rs.)
                </label>
                <input
                  type="number"
                  value={prodMrp}
                  onChange={(e) => setProdMrp(e.target.value)}
                  placeholder="e.g. 19999"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Selling Price */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Selling Price (Rs.)
                </label>
                <input
                  type="number"
                  value={prodSp}
                  onChange={(e) => setProdSp(e.target.value)}
                  placeholder="e.g. 16499"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-black text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Stock Qty */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Initial Stock Qty
                </label>
                <input
                  type="number"
                  value={prodStock}
                  onChange={(e) => setProdStock(e.target.value)}
                  placeholder="10"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Primary Image URL */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Primary Image URL (Hosted)
                </label>
                <input
                  type="text"
                  value={hostedImageUrl || currentCanvasSrc}
                  onChange={(e) => setHostedImageUrl(e.target.value)}
                  placeholder="https://i.ibb.co/..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Backup Image URL */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Backup Image URL
                </label>
                <input
                  type="text"
                  value={hostedBackupUrl || hostedImageUrl}
                  onChange={(e) => setHostedBackupUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Description / Key Specs (2-sentence summary)
                </label>
                <textarea
                  rows={2}
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  placeholder="Brief summary of product features, warranty, or contents."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Action Buttons: 1-Click Save to Sheet1 */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={handleSaveToSheet1}
                disabled={isPushingToSheet}
                className={`w-full sm:flex-1 py-3 px-5 rounded-xl font-black text-sm text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${
                  pushSuccess
                    ? 'bg-emerald-600'
                    : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-600/25 active:scale-[0.99]'
                }`}
              >
                {isPushingToSheet ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Syncing with Sheet1...</span>
                  </>
                ) : pushSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Saved to Sheet1!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>💾 Save to Google Sheet (Sheet1)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyRowData}
                className="w-full sm:w-auto py-3 px-4 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy TSV Row</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Admin EAN / Barcode Camera Scanner Modal */}
      <AdminBarcodeScannerModal
        isOpen={showEanScannerModal}
        onClose={() => setShowEanScannerModal(false)}
        onScan={handleBarcodeScanned}
        title="Scan Product EAN Barcode"
        subtitle="Point camera at product box barcode or upload barcode image"
      />
    </div>
  );
};

export default AdminAiAddProduct;
