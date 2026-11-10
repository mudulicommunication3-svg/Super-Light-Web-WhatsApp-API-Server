import React from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { isNativeAndroidApp } from '../utils/device';
import { Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { showToast } from './Toast';

/**
 * Normalizes APK download URL, converting Google Drive sharing links
 * into direct download links automatically.
 */
export const getDirectApkDownloadUrl = (url?: string): string => {
  if (!url || !url.trim()) return '/munagrocery.apk';
  const trimmed = url.trim();

  // Convert Google Drive sharing links to direct download endpoints
  const driveMatch =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  }

  return trimmed;
};

/**
 * Single-click direct App Download Button for customers.
 * Initiates the APK download instantly without showing any extra modal/banner.
 */
export const PWAInstallButton: React.FC = () => {
  const { isInstalled } = usePWAInstall();
  const { shopConfig } = useApp();
  const { language } = useLanguage();
  const isOdia = language === 'or';

  // If already running inside Capacitor Native Android App or already installed PWA, hide download button
  if (isNativeAndroidApp() || isInstalled) {
    return null;
  }

  const rawUrl = shopConfig.appDownloadUrl || '/munagrocery.apk';
  const downloadUrl = getDirectApkDownloadUrl(rawUrl);

  const handleDownloadClick = () => {
    showToast(isOdia ? '⬇️ ଆପ୍ ଡାଉନଲୋଡ୍ ଆରମ୍ଭ ହେଉଛି...' : '⬇️ Starting App Download...');
  };

  return (
    <a
      href={downloadUrl}
      download="munagrocery.apk"
      target={downloadUrl.startsWith('http') ? '_blank' : undefined}
      rel={downloadUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
      onClick={handleDownloadClick}
      className="px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xs text-[10px] font-black flex items-center gap-1 transition-all active:scale-95 border border-emerald-400/30 cursor-pointer shrink-0 select-none"
      title={isOdia ? 'ମୁନ୍ନା ଗ୍ରୋସରୀ ଆପ୍ ଡାଉନଲୋଡ୍ କରନ୍ତୁ' : 'Download Munna Grocery App'}
      aria-label={isOdia ? 'ଆପ୍ ଡାଉନଲୋଡ୍' : 'Download App'}
    >
      <Download className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
      <span>{isOdia ? 'ଆପ୍ ଡାଉନଲୋଡ୍' : 'Download App'}</span>
    </a>
  );
};
