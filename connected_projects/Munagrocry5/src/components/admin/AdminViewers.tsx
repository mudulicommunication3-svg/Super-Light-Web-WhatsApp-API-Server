import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Eye,
  RefreshCw,
  Search,
  Users,
  Calendar,
  Activity,
  Package
} from 'lucide-react';
import { getViewerStats } from '../../services/api';

export const AdminViewers: React.FC = () => {
  const { catalog } = useApp();
  const { isEnglish } = useLanguage();

  const [stats, setStats] = useState(getViewerStats());
  const [searchQuery, setSearchQuery] = useState('');

  const refreshStats = () => {
    setStats(getViewerStats());
  };

  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 8000);
    return () => clearInterval(interval);
  }, []);

  const productViewEntries = Object.entries(stats.productViews || {})
    .filter(([name]) => {
      if (!searchQuery.trim()) return true;
      return name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    })
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      {/* Header and Refresh */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-blue-600" />
          <span>Live Viewers Tracker</span>
        </h4>
        <button
          onClick={refreshStats}
          className="text-[11px] font-bold text-[#1864ab] hover:text-blue-800 flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-100 text-center shadow-2xs">
          <div className="text-[10px] text-blue-700 font-bold mb-0.5">Live Viewers</div>
          <div className="text-xl font-black text-blue-600">{stats.liveCount}</div>
          <div className="text-[9px] text-blue-500 font-medium">Last 5 min</div>
        </div>
        <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 text-center shadow-2xs">
          <div className="text-[10px] text-emerald-700 font-bold mb-0.5">Today's Visits</div>
          <div className="text-xl font-black text-emerald-600">{stats.todayCount}</div>
          <div className="text-[9px] text-emerald-500 font-medium">Unique today</div>
        </div>
        <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100 text-center shadow-2xs">
          <div className="text-[10px] text-amber-700 font-bold mb-0.5">All Time Visits</div>
          <div className="text-xl font-black text-amber-600">{stats.totalCount}</div>
          <div className="text-[9px] text-amber-500 font-medium">Total visitors</div>
        </div>
      </div>

      {/* Product Views Section */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 ପ୍ରୋଡକ୍ଟ ନାମ ଦ୍ୱାରା ଖୋଜନ୍ତୁ..."
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#1864ab]"
          />
        </div>

        {productViewEntries.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">
            କୌଣସି ଡାଟା ନାହିଁ — ଗ୍ରାହକ ୱେବସାଇଟ୍ ଖୋଲିଲେ ଏଠାରେ ଦେଖାଯିବ।
          </p>
        ) : (
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto no-scrollbar">
            {productViewEntries.map(([productName, count]) => {
              const matchedProd = catalog.find((p) => p.product_name === productName);
              const imgUrl = matchedProd?.image_url || '/icon-512.png';

              return (
                <div
                  key={productName}
                  className="py-2 flex items-center justify-between gap-2.5 hover:bg-slate-50/70 p-1.5 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <img
                      src={imgUrl}
                      alt={productName}
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      className="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-100 p-0.5 shrink-0"
                      onError={(e: any) => {
                        e.target.src = '/icon-512.png';
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {productName}
                      </p>
                      {matchedProd && (
                        <p className="text-[10px] text-slate-400">
                          Rs.{matchedProd.selling_price} · {matchedProd.category || 'General'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-black bg-blue-50 text-[#1864ab] border border-blue-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      <span>{count} views</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
