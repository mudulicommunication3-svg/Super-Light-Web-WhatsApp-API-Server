import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Barcode,
  X,
  Camera,
  Flashlight,
  Image as ImageIcon,
  RefreshCw,
  Upload,
  AlertTriangle,
  CheckCircle2,
  SwitchCamera,
  Keyboard
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { showToast } from '../Toast';

interface AdminBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (ean: string) => void;
  title?: string;
  subtitle?: string;
}

export const AdminBarcodeScannerModal: React.FC<AdminBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Product Barcode / EAN',
  subtitle = 'Point camera at product barcode (EAN-13, EAN-8, UPC, Code-128)'
}) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [manualEan, setManualEan] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeTrackRef = useRef<MediaStreamTrack | null>(null);
  const readerElementId = 'admin-ean-html5-scanner';

  // Crisp audio beep & haptic feedback on successful barcode detection
  const playScanFeedback = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6 tone
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.14);
      }
    } catch (e) {}

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (e) {}
  }, []);

  const stopScanner = useCallback(async () => {
    if (activeTrackRef.current) {
      try {
        activeTrackRef.current.stop();
      } catch (e) {}
      activeTrackRef.current = null;
    }

    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        // Safe catch on cleanup
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  const handleDetectedCode = useCallback((rawCode: string) => {
    const trimmed = String(rawCode).trim().replace(/^EAN-/, '');
    if (!trimmed) return;

    playScanFeedback();
    setLastScannedCode(trimmed);

    // Stop camera and deliver scanned barcode
    stopScanner();
    onScan(trimmed);
    showToast(`✅ Barcode Scanned: ${trimmed}`);
    onClose();
  }, [playScanFeedback, stopScanner, onScan, onClose]);

  // Check and initialize torch capabilities from the active video track
  const checkTorchCapability = useCallback(() => {
    try {
      const videoEl = document.querySelector(`#${readerElementId} video`) as HTMLVideoElement | null;
      if (videoEl && videoEl.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        if (track) {
          activeTrackRef.current = track;
          const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
          if (capabilities.torch) {
            setHasTorch(true);
          }
        }
      }
    } catch (e) {}
  }, [readerElementId]);

  const toggleTorch = async () => {
    if (!activeTrackRef.current) return;
    try {
      const nextTorch = !isTorchOn;
      await (activeTrackRef.current as any).applyConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setIsTorchOn(nextTorch);
    } catch (e) {
      showToast('Flashlight not supported on this lens');
    }
  };

  const startScanner = useCallback(async (facing: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    try {
      await stopScanner();

      const readerEl = document.getElementById(readerElementId);
      if (!readerEl) return;

      const html5QrCode = new Html5Qrcode(readerElementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE
        ],
        verbose: false
      });
      scannerRef.current = html5QrCode;
      setIsCameraActive(true);

      const config = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Barcodes are rectangular (wide), so use an elongated scan box
          const width = Math.min(Math.floor(viewfinderWidth * 0.85), 340);
          const height = Math.min(Math.floor(viewfinderHeight * 0.55), 180);
          return { width: Math.max(width, 220), height: Math.max(height, 120) };
        },
        aspectRatio: 1.333334
      };

      await html5QrCode.start(
        { facingMode: facing },
        config,
        (decodedText) => {
          handleDetectedCode(decodedText);
        },
        () => {
          // Frame passed with no barcode detected, continue scanning
        }
      );

      // Check for torch capability after camera start
      setTimeout(() => {
        checkTorchCapability();
      }, 500);

    } catch (err: unknown) {
      console.warn('Barcode camera failed to initialize:', err);
      setIsCameraActive(false);
      setCameraError(
        'Unable to access camera. Please allow camera permissions or upload a photo of the barcode below.'
      );
    }
  }, [facingMode, handleDetectedCode, stopScanner, checkTorchCapability]);

  // Flip camera between environment (back) and user (front)
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startScanner(nextMode);
  };

  // Decode barcode from an uploaded image/gallery photo
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsProcessingFile(true);

    try {
      // 1. Try native BarcodeDetector API if supported
      if ('BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code']
          });
          const imageBitmap = await createImageBitmap(file);
          const detected = await detector.detect(imageBitmap);
          if (detected && detected.length > 0 && detected[0].rawValue) {
            handleDetectedCode(detected[0].rawValue);
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
      if (result) {
        handleDetectedCode(result);
      }
    } catch (err) {
      showToast('No readable barcode found in this photo. Please take a closer, well-lit picture.');
      setTimeout(() => {
        startScanner();
      }, 400);
    } finally {
      setIsProcessingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEan.trim()) return;
    handleDetectedCode(manualEan.trim());
    setManualEan('');
  };

  // Lifecycle when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setLastScannedCode(null);
      const timer = setTimeout(() => {
        startScanner();
      }, 150);

      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, startScanner, stopScanner]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[95] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 text-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-700/80 max-h-[95vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-3.5 border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <Barcode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate flex items-center gap-1.5">
                <span>{title}</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded-md border border-emerald-500/30">
                  EAN / UPC
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
            </div>
          </div>

          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer active:scale-95 transition-transform shrink-0"
            title="Close scanner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="relative bg-black mx-3 mt-3 rounded-2xl overflow-hidden flex items-center justify-center min-h-[250px] sm:min-h-[280px] max-h-[340px] shadow-inner border border-slate-800">
          <div id={readerElementId} className="w-full h-full flex items-center justify-center"></div>

          {/* Viewfinder Target Graphic with Laser Animation */}
          {isCameraActive && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              {/* Wide Barcode Framing Box with Corner Accents */}
              <div className="w-[82%] max-w-[320px] h-[140px] border-2 border-emerald-400/70 rounded-2xl relative shadow-[0_0_25px_rgba(52,211,153,0.3)] bg-emerald-500/5">
                {/* 4 Corner Crosshairs */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-emerald-400 rounded-tl-lg"></div>
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-emerald-400 rounded-tr-lg"></div>
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-emerald-400 rounded-bl-lg"></div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-emerald-400 rounded-br-lg"></div>

                {/* Sweeping Laser Beam */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_8px_#ef4444]"></div>
              </div>

              <span className="text-[11px] font-bold text-white mt-2.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 tracking-wide">
                Center barcode lines inside box
              </span>
            </div>
          )}

          {/* Camera Error / Permission Fallback */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 text-center text-slate-200 space-y-2.5">
              <AlertTriangle className="w-10 h-10 text-amber-400" />
              <p className="text-xs font-bold text-white max-w-xs">{cameraError}</p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => startScanner()}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-md"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Photo</span>
                </button>
              </div>
            </div>
          )}

          {/* Loading File Processing */}
          {isProcessingFile && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2 z-20">
              <RefreshCw className="w-7 h-7 animate-spin text-emerald-400" />
              <p className="text-xs font-black text-white">Scanning barcode from photo...</p>
            </div>
          )}
        </div>

        {/* Quick Toolbar (Torch, Flip Camera, Upload from Photo) */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            {/* Flashlight toggle */}
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isTorchOn
                    ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title="Toggle Torch/Flashlight"
              >
                <Flashlight className="w-3.5 h-3.5" />
                <span>{isTorchOn ? 'Torch ON' : 'Torch'}</span>
              </button>
            )}

            {/* Switch Camera */}
            <button
              type="button"
              onClick={handleToggleFacingMode}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Switch Front/Back Camera"
            >
              <SwitchCamera className="w-3.5 h-3.5 text-slate-400" />
              <span>{facingMode === 'environment' ? 'Back Cam' : 'Front Cam'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Upload from Photo */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 font-black text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Pick an image containing barcode from gallery"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>From Photo</span>
            </button>

            {/* Manual type toggle */}
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              title="Type barcode digits manually"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>{showManualInput ? 'Hide' : 'Type'}</span>
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Manual Digit Entry Section (Expandable) */}
        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="p-3 bg-slate-800/80 border-b border-slate-700/80 flex gap-2">
            <input
              type="text"
              autoFocus
              value={manualEan}
              onChange={(e) => setManualEan(e.target.value)}
              placeholder="Enter EAN digits (e.g. 890123456789)..."
              className="flex-1 text-xs px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-emerald-500 text-white font-mono"
            />
            <button
              type="submit"
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs rounded-xl cursor-pointer active:scale-95"
            >
              Apply
            </button>
          </form>
        )}

        {/* Footer Note */}
        <div className="p-3.5 bg-slate-900 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px]">Instant barcode capture • Audio & haptic cue</span>
          </div>

          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="text-[11px] font-bold text-slate-400 hover:text-white underline cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
