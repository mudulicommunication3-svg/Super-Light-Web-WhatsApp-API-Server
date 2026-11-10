import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'exit';
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [exitToastMessage, setExitToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // 1. General top toasts
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type?: 'info' | 'success' | 'warning' | 'error' | 'exit' }>;
      if (!customEvent.detail || !customEvent.detail.message) return;

      const rawMsg = customEvent.detail.message;
      const requestedType = customEvent.detail.type;

      // Dedicated bottom exit pill toast
      if (requestedType === 'exit') {
        setExitToastMessage(rawMsg);
        setTimeout(() => {
          setExitToastMessage((cur) => (cur === rawMsg ? null : cur));
        }, 2200);
        return;
      }

      let toastType: 'info' | 'success' | 'warning' | 'error' = requestedType || 'info';

      if (!requestedType) {
        if (rawMsg.includes('❌') || rawMsg.toLowerCase().includes('fail') || rawMsg.toLowerCase().includes('error')) {
          toastType = 'error';
        } else if (rawMsg.includes('⚠️') || rawMsg.toLowerCase().includes('warning')) {
          toastType = 'warning';
        } else if (rawMsg.includes('✅') || rawMsg.includes('⚡') || rawMsg.toLowerCase().includes('success') || rawMsg.includes('ସଫଳ')) {
          toastType = 'success';
        }
      }

      const newToast: ToastItem = {
        id: Math.random().toString(36).substring(2, 9),
        message: rawMsg,
        type: toastType
      };

      setToasts((prev) => [...prev.slice(-2), newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 4000);
    };

    // 2. Dedicated bottom exit toast event
    const handleExitToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message?: string }>;
      const msg = customEvent.detail?.message || 'Press back again to exit (ଆପ୍ ବନ୍ଦ କରିବା ପାଇଁ ପୁଣି ଥରେ Back ଦବାନ୍ତୁ)';
      setExitToastMessage(msg);
      setTimeout(() => {
        setExitToastMessage((cur) => (cur === msg ? null : cur));
      }, 2200);
    };

    window.addEventListener('app-toast', handleToastEvent);
    window.addEventListener('app-exit-toast', handleExitToastEvent);
    return () => {
      window.removeEventListener('app-toast', handleToastEvent);
      window.removeEventListener('app-exit-toast', handleExitToastEvent);
    };
  }, []);

  return (
    <>
      {/* Top Floating Alerts */}
      {toasts.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-2 max-w-[92vw] w-[360px] pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-center justify-between gap-2.5 px-4 py-3 rounded-xl bg-slate-900/95 text-white text-xs font-semibold shadow-2xl backdrop-blur-md border border-slate-700/60 transition-all duration-300 animate-fadeIn"
            >
              <div className="flex items-center gap-2.5">
                {toast.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                ) : toast.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : toast.type === 'warning' ? (
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <Info className="w-4 h-4 text-sky-400 shrink-0" />
                )}
                <span className="leading-snug">{toast.message}</span>
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-slate-400 hover:text-white p-0.5 rounded transition shrink-0 cursor-pointer"
                aria-label="Close notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightweight Floating Pill Toast for Android Exit Hint */}
      {exitToastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/90 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg backdrop-blur-sm pointer-events-none transition-all duration-300 animate-fadeIn flex items-center gap-2 whitespace-nowrap border border-white/10"
        >
          <span>{exitToastMessage}</span>
        </div>
      )}
    </>
  );
};

export const showToast = (message: string, type?: 'info' | 'success' | 'warning' | 'error' | 'exit') => {
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
    }, 0);
  }
};

export const showExitToast = (message?: string) => {
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('app-exit-toast', { detail: { message } }));
    }, 0);
  }
};
