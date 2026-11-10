import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowRight, X, ExternalLink } from 'lucide-react';

export const BroadcastNotice: React.FC = () => {
  const { adminNotice } = useApp();
  const [showDetail, setShowDetail] = useState(false);

  if (!adminNotice || (!adminNotice.img && !adminNotice.text && !adminNotice.title)) {
    return null;
  }

  return (
    <>
      <section className="max-w-md mx-auto px-3.5 mt-3">
        <div
          onClick={() => setShowDetail(true)}
          className="relative group rounded-2xl overflow-hidden border border-amber-200 bg-amber-50 shadow-sm cursor-pointer"
        >
          {adminNotice.img && (
            <img
              src={adminNotice.img}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              className="w-full h-28 object-cover"
              alt="Notice"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=700';
              }}
            />
          )}
          <div className="p-3 bg-white/95">
            <h3 className="text-xs font-black text-amber-900 leading-tight mb-1">
              {adminNotice.title || '📢 ନୂତନ ଅଫର୍ / ଅପଡେଟ୍'}
            </h3>
            <p className="text-[10px] text-slate-700 font-medium leading-snug line-clamp-2">
              {adminNotice.text}
            </p>
            <div className="mt-2 flex items-center justify-between w-full">
              <span className="text-[9px] font-bold text-amber-600">
                📢 ନୂତନ ଅଫର୍ / ଅପଡେଟ୍ — ଦେଖନ୍ତୁ
              </span>
              <ArrowRight className="w-3 h-3 text-amber-600" />
            </div>
          </div>
        </div>
      </section>

      {/* Detail Overlay */}
      {showDetail && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative w-full max-w-md max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <button
              onClick={() => setShowDetail(false)}
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-white text-slate-800 flex items-center justify-center shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
            {adminNotice.img && (
              <img
                src={adminNotice.img}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                className="w-full h-48 object-cover bg-slate-100"
                alt="Notice detail"
              />
            )}
            <div className="p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                {adminNotice.title || 'Notice'}
              </h3>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                {adminNotice.text}
              </p>
              {adminNotice.url && (
                <a
                  href={adminNotice.url}
                  className="w-full py-2.5 bg-[#1864ab] hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 mb-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>ଲିଙ୍କ୍ ଖୋଲନ୍ତୁ</span>
                </a>
              )}
              <button
                onClick={() => setShowDetail(false)}
                className="w-full py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
              >
                ବନ୍ଦ କରନ୍ତୁ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
