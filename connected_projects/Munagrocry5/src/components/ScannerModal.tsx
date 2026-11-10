import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Barcode,
  X,
  Camera,
  Image as ImageIcon,
  Search,
  CheckCircle,
  RefreshCw,
  Upload,
  AlertTriangle
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { showToast } from './Toast';
import { doesProductMatchEan } from '../utils/productMediaHelper';

export const ScannerModal: React.FC = () => {
  const {
    showScanner,
    setShowScanner,
    scannerMode,
    catalog,
    setQty,
    setSelectedProduct,
    placeOrder,
    isEnglish
  } = useApp();

  const [scanResult, setScanResult] = useState<string | null>(null);
  const [manualEan, setManualEan] = useState('');
  const [quickBillItems, setQuickBillItems] = useState<{ ean: string; name: string; price: number; qty: number }[]>([]);
  const [qbName, setQbName] = useState('');
  const [qbPhone, setQbPhone] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const readerElementId = 'html5-qrcode-reader';

  // Sound feedback on successful scan
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {}
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        // ignore clean up error
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleScanSuccess = (decodedText: string) => {
    playBeep();
    setScanResult(decodedText);
    const trimmed = decodedText.trim();
    const product = catalog.find((p) => doesProductMatchEan(p, trimmed));

    if (scannerMode === 'quickbill') {
      if (product) {
        const price = typeof product.selling_price === 'number' ? product.selling_price : parseFloat(product.selling_price || '0');
        setQuickBillItems((prev) => {
          const existing = prev.find((i) => i.ean === product.ean);
          if (existing) {
            return prev.map((i) => (i.ean === product.ean ? { ...i, qty: i.qty + 1 } : i));
          }
          return [...prev, { ean: product.ean, name: product.product_name, price, qty: 1 }];
        });
        showToast(`✅ ${product.product_name} ଯୋଡ଼ା ହେଲା!`);
      } else {
        showToast(`❌ EAN ${trimmed} କୌଣସି ପ୍ରୋଡକ୍ଟ ସହ ମିଳୁନାହିଁ।`);
      }
    } else {
      // Customer Mode
      if (product) {
        setQty(product.ean, 1);
        setSelectedProduct(product);
        stopScanner();
        setShowScanner(false);
        showToast(`✅ ${product.product_name} କାର୍ଟରେ ଯୋଡ଼ା ହେଲା!`);
      } else {
        showToast(
          isEnglish
            ? `Barcode found (${trimmed}) — item not in catalog`
            : `ବାରକୋଡ୍ ମିଳିଲା: ${trimmed} — କାଟାଲଗ୍‌ରେ ନାହିଁ।`
        );
      }
    }
  };

  // Directly start camera when modal opens
  const startCamera = async () => {
    setCameraError(null);
    try {
      // Ensure any previous instance is stopped
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }

      const readerEl = document.getElementById(readerElementId);
      if (!readerEl) return;

      scannerRef.current = new Html5Qrcode(readerElementId);
      setIsCameraActive(true);

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.floor(minEdge * 0.75);
            return { width: Math.max(edge, 200), height: Math.max(edge, 180) };
          }
        },
        handleScanSuccess,
        () => {}
      );
    } catch (err: unknown) {
      console.warn('Camera failed to start:', err);
      setIsCameraActive(false);
      setCameraError(
        isEnglish
          ? 'Camera not accessible. Please allow camera permission or upload a photo.'
          : 'କ୍ୟାମେରା ଆରମ୍ଭ ହୋଇପାରିଲା ନାହିଁ। କ୍ୟାମେରା ଅନୁମତି ଦିଅନ୍ତୁ କିମ୍ବା ତଳୁ ଫଟୋ ଅପଲୋଡ୍ କରନ୍ତୁ।'
      );
    }
  };

  // Automatic direct camera launch when QR modal opens
  useEffect(() => {
    if (showScanner) {
      const timer = setTimeout(() => {
        startCamera();
      }, 150);

      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [showScanner]);

  // Handle uploading and decoding from photo
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsProcessingFile(true);

    try {
      // 1. Try BarcodeDetector API if available in browser
      if ('BarcodeDetector' in window) {
        try {
          const detector = new (window as unknown as { BarcodeDetector: any }).BarcodeDetector({
            formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e']
          });
          const imageBitmap = await createImageBitmap(file);
          const detected = await detector.detect(imageBitmap);
          if (detected && detected.length > 0) {
            handleScanSuccess(detected[0].rawValue);
            setIsProcessingFile(false);
            return;
          }
        } catch (detectorErr) {
          // fallback to html5-qrcode
        }
      }

      // 2. Fallback to Html5Qrcode scanFile
      await stopScanner();
      const qrScanner = new Html5Qrcode(readerElementId);
      const result = await qrScanner.scanFile(file, true);
      handleScanSuccess(result);
    } catch (err) {
      showToast(
        isEnglish
          ? 'No barcode or QR code detected in this photo. Please try a clear picture.'
          : 'ଫଟୋରୁ କୌଣସି ବାରକୋଡ୍ / QR ଚିହ୍ନି ହେଲା ନାହିଁ। ଦୟାକରି ସ୍ପଷ୍ଟ ଫଟୋ ବାଛନ୍ତୁ।'
      );
      // Restart camera after failed file scan
      setTimeout(() => {
        startCamera();
      }, 300);
    } finally {
      setIsProcessingFile(false);
      // Reset input value so same photo can be picked again if needed
      if (e.target) e.target.value = '';
    }
  };

  const handleManualSearch = () => {
    if (!manualEan.trim()) return;
    handleScanSuccess(manualEan.trim());
    setManualEan('');
  };

  const qbTotal = quickBillItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  const handleSaveQuickBill = async () => {
    if (quickBillItems.length === 0) {
      showToast(isEnglish ? 'No items added yet.' : 'କୌଣସି ସାମଗ୍ରୀ ଯୋଡ଼ା ହୋଇନାହିଁ।');
      return;
    }
    await placeOrder({
      customerName: qbName.trim() || 'Counter Walk-in',
      phone: qbPhone.trim() || '9999999999',
      address: 'Shop Counter Direct Sale',
      items: quickBillItems,
      subtotal: qbTotal,
      deliveryFee: 0,
      discount: 0,
      total: qbTotal,
      payment: 'CASH_COUNTER',
      deliveryType: 'pickup'
    });
    showToast(isEnglish ? '⚡ Quick Bill Saved!' : '⚡ Quick Bill ସଫଳତାର ସହ ସେଭ୍ ହେଲା!');
    setQuickBillItems([]);
    stopScanner();
    setShowScanner(false);
  };

  if (!showScanner) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs z-[85] flex items-center justify-center p-3 animate-fadeIn">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] border border-slate-200">
        {/* Header */}
        <div className="bg-[#0c2340] text-white px-4 py-3 flex items-center justify-between shrink-0">
          <span className="font-black text-sm flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#ffd43b] text-[#0c2340] flex items-center justify-center shadow-xs">
              <Barcode className="w-4 h-4 text-[#0c2340]" />
            </div>
            <span>
              {scannerMode === 'quickbill'
                ? '⚡ POS Barcode Scanner'
                : isEnglish
                ? 'Scan Barcode / QR Code'
                : 'QR କୋଡ୍ ଓ ବାରକୋଡ୍ ସ୍କାନର୍'}
            </span>
          </span>
          <button
            onClick={() => {
              stopScanner();
              setShowScanner(false);
            }}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer active:scale-95 transition-transform"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Bill POS Panel (Admin only) */}
        {scannerMode === 'quickbill' && (
          <div className="p-3 bg-blue-50/70 border-b border-blue-200 space-y-2 shrink-0">
            <div className="flex items-center justify-between text-xs font-black text-slate-800">
              <span>⚡ Bill Items ({quickBillItems.length})</span>
              <span className="text-[#1864ab] text-sm">Total: Rs.{qbTotal}</span>
            </div>

            {quickBillItems.length > 0 && (
              <div className="space-y-1 max-h-24 overflow-y-auto no-scrollbar">
                {quickBillItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs bg-white p-1.5 rounded-lg border border-slate-200">
                    <span className="truncate flex-1 font-semibold">{item.name} x{item.qty}</span>
                    <span className="font-bold text-slate-900 ml-2">Rs.{item.price * item.qty}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={qbName}
                onChange={(e) => setQbName(e.target.value)}
                placeholder="ଗ୍ରାହକ ନାଁ (Optional)"
                className="text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none"
              />
              <input
                type="tel"
                value={qbPhone}
                onChange={(e) => setQbPhone(e.target.value)}
                placeholder="ଫୋନ୍ (Optional)"
                className="text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none"
              />
            </div>

            <button
              onClick={handleSaveQuickBill}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>ବିଲ୍ ସେଭ୍ କରନ୍ତୁ (Save Counter Order)</span>
            </button>
          </div>
        )}

        {/* Scanner Viewport (Direct Camera Open) */}
        <div className="relative mx-3 mt-3 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center min-h-[220px] max-h-[260px] shadow-inner">
          <div id={readerElementId} className="w-full h-full"></div>

          {/* Laser scanning beam overlay when camera active */}
          {isCameraActive && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-48 h-40 border-2 border-dashed border-yellow-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(250,204,21,0.3)]">
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-bounce"></div>
              </div>
              <p className="text-[10px] font-bold text-white/80 mt-2 bg-black/50 px-2 py-0.5 rounded-full">
                {isEnglish ? 'Point camera at QR or Barcode' : 'QR କିମ୍ବା ବାରକୋଡ୍ ସାମ୍ନାରେ ଧରନ୍ତୁ'}
              </p>
            </div>
          )}

          {/* Camera Error / Fallback State */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 text-center text-slate-200 space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
              <p className="text-xs font-bold text-white">{cameraError}</p>
              <button
                onClick={startCamera}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-yellow-300 text-xs font-bold flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isEnglish ? 'Retry Camera' : 'ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ'}</span>
              </button>
            </div>
          )}

          {/* Loading File Processing indicator */}
          {isProcessingFile && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white space-y-2 z-10">
              <RefreshCw className="w-6 h-6 animate-spin text-yellow-300" />
              <p className="text-xs font-bold">
                {isEnglish ? 'Scanning photo for QR / Barcode...' : 'ଫଟୋରୁ କୋଡ୍ ପଢ଼ାହେଉଛି...'}
              </p>
            </div>
          )}
        </div>

        {/* Action Panel: Upload from photo + camera restart + manual search */}
        <div className="p-3.5 space-y-2.5 shrink-0">
          {/* PRIMARY OPTION: Upload from Photo (Prominently asked) */}
          <div className="bg-amber-50/80 rounded-2xl p-2.5 border border-amber-200/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-slate-900 leading-tight">
                  {isEnglish ? 'Upload from Photo' : 'ଫଟୋରୁ QR / ବାରକୋଡ୍ ପଢ଼ନ୍ତୁ'}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {isEnglish ? 'Pick image from your gallery' : 'ଗ୍ୟାଲେରୀରୁ ଫଟୋ ବାଛନ୍ତୁ'}
                </p>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isEnglish ? 'Upload Photo' : 'ଫଟୋ ବାଛନ୍ତୁ'}</span>
            </button>
            {/* Hidden file picker */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Camera Controls */}
          <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{isCameraActive ? (isEnglish ? 'Camera live scanning' : 'କ୍ୟାମେରା ସକ୍ରିୟ') : (isEnglish ? 'Camera paused' : 'କ୍ୟାମେରା ବନ୍ଦ')}</span>
            </span>
            {isCameraActive ? (
              <button
                onClick={stopScanner}
                className="text-[10.5px] font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                {isEnglish ? 'Pause Camera' : 'କ୍ୟାମେରା ରୋକନ୍ତୁ'}
              </button>
            ) : (
              <button
                onClick={startCamera}
                className="text-[10.5px] font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1 cursor-pointer"
              >
                <Camera className="w-3 h-3" />
                <span>{isEnglish ? 'Resume Camera' : 'କ୍ୟାମେରା ଖୋଲନ୍ତୁ'}</span>
              </button>
            )}
          </div>

          {/* Manual EAN / Code Input */}
          <div className="flex gap-1.5 pt-1">
            <input
              type="text"
              value={manualEan}
              onChange={(e) => setManualEan(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
              placeholder={isEnglish ? 'Enter barcode or product EAN...' : 'EAN / ବାରକୋଡ୍ ନମ୍ବର ଲେଖନ୍ତୁ...'}
              className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#0c2340] focus:bg-white font-medium"
            />
            <button
              onClick={handleManualSearch}
              className="px-3.5 py-2 bg-[#0c2340] hover:bg-blue-950 text-white text-xs font-black rounded-xl flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </button>
          </div>

          {scanResult && (
            <p className="text-[10px] text-emerald-700 font-bold bg-emerald-50 p-1.5 rounded-xl text-center border border-emerald-100">
              Scanned Code: {scanResult}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
