import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { STORE_LAT, STORE_LNG } from '../../data/initialData';
import {
  Users,
  Search,
  RefreshCw,
  Phone,
  MapPin,
  ExternalLink,
  ShoppingBag,
  DollarSign,
  Calendar,
  UserCheck
} from 'lucide-react';
import { fetchUsersFromSheet, AdminUserRecord } from '../../services/api';

export const AdminUsers: React.FC = () => {
  const { isEnglish } = useLanguage();
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchUsersFromSheet();
      setUsers(data);
    } catch (e) {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const totalOrders = users.reduce((acc, u) => acc + (u.orders || 0), 0);
  const totalSpent = users.reduce((acc, u) => acc + (Number(u.spent) || 0), 0);

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q) ||
      (u.address || '').toLowerCase().includes(q) ||
      (u.tg_id || u.user_id || '').includes(q)
    );
  });

  return (
    <div className="space-y-3">
      {/* Header and Sync */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-[#1864ab]" />
          <span>👥 ସମସ୍ତ ଗ୍ରାହକ (All Users)</span>
        </h4>
        <button
          onClick={loadUsers}
          disabled={loading}
          className="text-[11px] font-bold text-[#1864ab] hover:text-blue-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Syncing...' : 'Sync'}</span>
        </button>
      </div>

      {/* Aggregate Stats */}
      <div className="flex gap-2 text-[10px] font-bold flex-wrap">
        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 shadow-2xs">
          👥 {isEnglish ? 'Total Customers' : 'ମୋଟ ଗ୍ରାହକ'}: {users.length}
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60 shadow-2xs">
          📦 {isEnglish ? 'Total Orders' : 'ମୋଟ ଅର୍ଡର'}: {totalOrders}
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
          💰 {isEnglish ? 'Total Revenue' : 'ବିକ୍ରୟ'}: Rs.{totalSpent}
        </span>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 ନାଁ / ଫୋନ୍ / ଠିକଣା ରୁ ଖୋଜନ୍ତୁ..."
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#1864ab]"
          />
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-2">
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400 space-y-1">
            <p>କୌଣସି ଗ୍ରାହକ ମିଳିଲା ନାହିଁ।</p>
            <p className="text-[10px] text-slate-400">
              Sync ଚାପନ୍ତୁ କିମ୍ବା ନୂତନ ଅର୍ଡର ଆସିବା ପରେ ଏଠାରେ ଦେଖାଯିବ।
            </p>
          </div>
        ) : (
          filteredUsers.map((u) => {
            const initial = (u.name || '?').charAt(0).toUpperCase();
            const mapsLink = u.address
              ? `https://www.google.com/maps/dir/?api=1&origin=${STORE_LAT},${STORE_LNG}&destination=${encodeURIComponent(
                  u.address
                )}`
              : '';
            const lastStr = u.last ? String(u.last).substring(0, 16) : '—';

            return (
              <div
                key={u.phone || u.user_id}
                className="bg-white p-3 rounded-2xl border border-slate-200 text-xs space-y-2 shadow-xs hover:border-blue-300 transition-colors"
              >
                {/* User Top Row: Name, Phone, Orders Pill */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-[#1864ab] font-black flex items-center justify-center shrink-0 border border-blue-100">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <span className="font-black text-slate-800 block line-clamp-1 text-xs">
                        {u.name || 'Customer'}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                        <a
                          href={`tel:${u.phone}`}
                          className="hover:text-[#1864ab] flex items-center gap-0.5"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{u.phone || '—'}</span>
                        </a>
                        {u.tg_id && (
                          <span className="text-[10px] text-slate-400">· TG {u.tg_id}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] bg-blue-100 text-[#1864ab] font-black px-2 py-0.5 rounded-md shrink-0">
                    {u.orders || 0} {isEnglish ? 'Orders' : 'ଅର୍ଡର'}
                  </span>
                </div>

                {/* Address & Navigation */}
                <div className="text-[11px] text-slate-600 flex items-start justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <span className="line-clamp-2 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#1864ab] shrink-0 mt-0.5" />
                    <span>{u.address || 'ଠିକଣା ନାହିଁ'}</span>
                  </span>
                  {mapsLink && (
                    <a
                      href={mapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1864ab] font-bold shrink-0 flex items-center gap-1 hover:underline ml-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Map</span>
                    </a>
                  )}
                </div>

                {/* Footer: Last order time & Total spent */}
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
                  <span className="text-slate-500">
                    {isEnglish ? 'Last Order' : 'ଶେଷ ଅର୍ଡର'}:{' '}
                    <b className="text-slate-700">{lastStr}</b>
                  </span>
                  <span className="font-black text-emerald-700">
                    {isEnglish ? 'Total' : 'ମୋଟ'}: Rs.{u.spent}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
