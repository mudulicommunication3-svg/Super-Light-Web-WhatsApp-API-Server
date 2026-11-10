import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const { language } = useLanguage();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  const isOdia = language === 'or';

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-amber-600/95 backdrop-blur-xs px-4 py-1.5 text-xs font-bold text-white shadow-lg border border-amber-400/40 animate-slideDown">
      <WifiOff className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
      <span>
        {isOdia
          ? 'ଅଫଲାଇନ୍ ମୋଡ୍ — ସେଭ୍ ହୋଇଥିବା ଡାଟା ଦେଖାଯାଉଛି'
          : 'Offline Mode — Cached store data is being used'}
      </span>
    </div>
  );
};
