import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import {
  MapPin,
  Camera,
  Bell,
  ShieldCheck,
  CheckCircle2,
  X,
  AlertCircle
} from 'lucide-react';
import { showToast } from './Toast';

type PermissionStatus = 'prompt' | 'granted' | 'denied';

export const PermissionModal: React.FC = () => {
  const { showPermissionModal, setShowPermissionModal } = useApp();
  const { language } = useLanguage();
  const isOdia = language === 'or';

  const [geoStatus, setGeoStatus] = useState<PermissionStatus>('prompt');
  const [cameraStatus, setCameraStatus] = useState<PermissionStatus>('prompt');
  const [notifStatus, setNotifStatus] = useState<PermissionStatus>('prompt');
  const [isRequestingAll, setIsRequestingAll] = useState(false);

  // Check initial permission status on modal open
  useEffect(() => {
    if (!showPermissionModal) return;

    // 1. Notification
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') setNotifStatus('granted');
      else if (Notification.permission === 'denied') setNotifStatus('denied');
      else setNotifStatus('prompt');
    }

    // 2. Geolocation & Camera via Permissions API
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      try {
        navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
          setGeoStatus(result.state as PermissionStatus);
          result.onchange = () => setGeoStatus(result.state as PermissionStatus);
        }).catch(() => {});

        navigator.permissions.query({ name: 'camera' as PermissionName }).then((result) => {
          setCameraStatus(result.state as PermissionStatus);
          result.onchange = () => setCameraStatus(result.state as PermissionStatus);
        }).catch(() => {});
      } catch (e) {}
    }
  }, [showPermissionModal]);

  if (!showPermissionModal) return null;

  const handleClose = () => {
    try {
      localStorage.setItem('munna_permissions_asked', 'true');
    } catch (e) {}
    setShowPermissionModal(false);
  };

  // 1. Request GPS Geolocation
  const requestLocation = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        showToast(isOdia ? 'GPS ସମର୍ଥିତ ନୁହେଁ' : 'Geolocation is not supported');
        resolve(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => {
          setGeoStatus('granted');
          showToast(isOdia ? '✅ GPS ଲୋକେସନ୍ ଅନୁମତି ମିଳିଲା!' : '✅ Location permission granted!');
          resolve(true);
        },
        () => {
          setGeoStatus('denied');
          showToast(isOdia ? '⚠️ GPS ଅନୁମତି ଅସ୍ୱୀକାର ହେଲା' : '⚠️ Location permission denied');
          resolve(false);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    });
  };

  // 2. Request Camera for Barcode & QR Scanner
  const requestCamera = async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast(isOdia ? 'କ୍ୟାମେରା ସମର୍ଥିତ ନୁହେଁ' : 'Camera not supported');
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      stream.getTracks().forEach((track) => track.stop());
      setCameraStatus('granted');
      showToast(isOdia ? '✅ କ୍ୟାମେରା ଅନୁମତି ମିଳିଲା!' : '✅ Camera permission granted!');
      return true;
    } catch (err) {
      setCameraStatus('denied');
      showToast(isOdia ? '⚠️ କ୍ୟାମେରା ଅନୁମତି ଅସ୍ୱୀକାର ହେଲା' : '⚠️ Camera permission denied');
      return false;
    }
  };

  // 3. Request Notifications
  const requestNotification = async (): Promise<boolean> => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotifStatus('granted');
          showToast(isOdia ? '✅ ଅର୍ଡର ନୋଟିଫିକେସନ୍ ସକ୍ରିୟ!' : '✅ Notifications enabled!');
          return true;
        } else {
          setNotifStatus('denied');
          return false;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  // 4. Request All Permissions in one tap
  const handleAllowAll = async () => {
    setIsRequestingAll(true);
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          const ctx = new AudioCtx();
          ctx.resume();
        } catch (e) {}
      }

      await requestLocation();
      await requestCamera();
      await requestNotification();

      showToast(isOdia ? '🎉 ହାର୍ଡୱେର୍ ଅନୁମତି ସେଭ୍ ହେଲା!' : '🎉 Permissions configured!');
      setTimeout(() => {
        handleClose();
      }, 800);
    } finally {
      setIsRequestingAll(false);
    }
  };

  const getStatusBadge = (status: PermissionStatus, onAllow: () => void) => {
    if (status === 'granted') {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
          <span>{isOdia ? 'Allowed' : 'Allowed'}</span>
        </span>
      );
    }
    if (status === 'denied') {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600">
          <AlertCircle className="w-2.5 h-2.5" />
          <span>Blocked</span>
        </span>
      );
    }
    return (
      <button
        onClick={onAllow}
        className="text-[9px] font-extrabold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200 cursor-pointer active:scale-95 transition-transform"
      >
        {isOdia ? 'ଅନୁମତି' : 'Allow'}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
      {/* Mini Screen Dialog Container */}
      <div
        className="bg-white w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-[#0c2340] text-white px-3.5 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#ffd43b] text-[#0c2340] flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-[#0c2340]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black text-white leading-tight truncate">
                {isOdia ? 'ଡିଭାଇସ୍ ଅନୁମତି' : 'Device Permissions'}
              </h3>
              <p className="text-[9px] text-slate-300 truncate">
                {isOdia ? 'ଦ୍ରୁତ ସପିଂ ଓ ଡେଲିଭରୀ ପାଇଁ' : 'For fast delivery & scanner'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Compact Permissions List */}
        <div className="p-3 space-y-2">
          {/* Location */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-800 leading-tight">
                  {isOdia ? 'GPS ଲୋକେସନ୍' : 'GPS Location'}
                </p>
                <p className="text-[9px] text-slate-400 truncate">
                  {isOdia ? '୩ କି.ମି. ଡେଲିଭରୀ ଓ ଠିକଣା' : '3 KM delivery & address'}
                </p>
              </div>
            </div>
            {getStatusBadge(geoStatus, requestLocation)}
          </div>

          {/* Camera */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Camera className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-800 leading-tight">
                  {isOdia ? 'କ୍ୟାମେରା' : 'Camera Access'}
                </p>
                <p className="text-[9px] text-slate-400 truncate">
                  {isOdia ? 'QR ଓ ବାରକୋଡ୍ ସ୍କାନର୍' : 'Barcode & QR scanner'}
                </p>
              </div>
            </div>
            {getStatusBadge(cameraStatus, requestCamera)}
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-800 leading-tight">
                  {isOdia ? 'ନୋଟିଫିକେସନ୍' : 'Notifications'}
                </p>
                <p className="text-[9px] text-slate-400 truncate">
                  {isOdia ? 'ଅର୍ଡର ଟ୍ରାକିଂ ଅପଡେଟ୍' : 'Order tracking alerts'}
                </p>
              </div>
            </div>
            {getStatusBadge(notifStatus, requestNotification)}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-3 pt-1 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-1.5">
          <button
            onClick={handleAllowAll}
            disabled={isRequestingAll}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white font-black text-xs shadow-sm flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              {isRequestingAll
                ? (isOdia ? 'ଯାଞ୍ଚ ହେଉଛି...' : 'Allowing...')
                : (isOdia ? 'ସବୁ ଅନୁମତି ଦିଅନ୍ତୁ' : 'Allow All Permissions')}
            </span>
          </button>

          <button
            onClick={handleClose}
            className="w-full py-1 text-slate-500 hover:text-slate-800 text-[10px] font-bold text-center cursor-pointer transition-colors"
          >
            {isOdia ? 'ପରେ କରିବି (Skip)' : 'Not Now (Skip)'}
          </button>
        </div>
      </div>
    </div>
  );
};
