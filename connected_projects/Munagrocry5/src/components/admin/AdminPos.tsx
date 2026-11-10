import React from 'react';
import { ExternalLink, RefreshCw, Calculator, ShieldCheck } from 'lucide-react';

export const AdminPos: React.FC = () => {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = '/pos.html?embedded=true&_t=' + Date.now();
    }
  };

  const handleOpenFullscreen = () => {
    window.open('/pos.html', '_blank');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[500px] bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
      {/* POS Header Control Bar */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              <span>🛒 POS COUNTER & BILLING (ବିଲିଂ କାଉଣ୍ଟର୍)</span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Protected
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Live Google Sheet Synced Counter • Thermal Print & WhatsApp Bill
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
            title="Refresh POS Frame"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh POS</span>
          </button>
          <button
            type="button"
            onClick={handleOpenFullscreen}
            className="px-3.5 py-1.5 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-900/20 transition-all cursor-pointer active:scale-95"
            title="Open POS in Full Screen Window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Full Screen POS</span>
          </button>
        </div>
      </div>

      {/* Embedded POS Iframe */}
      <div className="flex-1 w-full bg-white relative">
        <iframe
          ref={iframeRef}
          src="/pos.html?embedded=true"
          title="POS Counter & Billing System"
          className="w-full h-full border-none"
        />
      </div>
    </div>
  );
};

export default AdminPos;
