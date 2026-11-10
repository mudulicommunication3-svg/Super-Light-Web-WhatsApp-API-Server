import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Order } from '../../types';
import {
  Package,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  Box,
  Check,
  XCircle,
  Phone,
  MapPin,
  Calendar,
  AlertCircle,
  RefreshCw,
  Barcode,
  ExternalLink,
  ChevronRight,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Copy
} from 'lucide-react';
import { updateOrderStageOnSheet, pushConfigKeyToSheet, isStoreOpenNow, isUpiOrder, extractUtrFromOrder } from '../../services/api';
import { showToast } from '../Toast';

const STAGES = [
  { stage: 1, labelEn: 'Placed', labelOr: 'ଅର୍ଡର ହେଲା', status: 'pending' as const, icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { stage: 2, labelEn: 'Accepted', labelOr: 'ସ୍ୱୀକୃତ', status: 'accepted' as const, icon: CheckCircle2, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { stage: 3, labelEn: 'Packing', labelOr: 'ପ୍ୟାକିଂ ସରିଲା', status: 'packing' as const, icon: Box, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { stage: 4, labelEn: 'Out for Delivery', labelOr: 'ବାହାରିଛି', status: 'out_for_delivery' as const, icon: Truck, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { stage: 5, labelEn: 'Delivered', labelOr: 'ପହଞ୍ଚିଲା', status: 'delivered' as const, icon: Check, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
];

export const AdminOrders: React.FC = () => {
  const {
    myOrders,
    updateOrderStage,
    cancelOrder,
    setShowScanner,
    refreshOrders,
    isRefreshingOrders,
    shopConfig,
    updateShopConfig
  } = useApp();
  const { isEnglish } = useLanguage();

  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'accepted' | 'packing' | 'out_for_delivery' | 'delivered' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filter logic
  const filteredOrders = myOrders.filter((order) => {
    // Tab filter
    if (filterTab !== 'all') {
      if (filterTab === 'pending') {
        if (order.status !== 'pending' && order.status !== 'reviewed' && order.stage !== 1) return false;
        if (order.status === 'cancelled') return false;
      } else if (filterTab === 'cancelled') {
        if (order.status !== 'cancelled') return false;
      } else {
        const targetStage =
          filterTab === 'accepted' ? 2 :
          filterTab === 'packing' ? 3 :
          filterTab === 'out_for_delivery' ? 4 :
          filterTab === 'delivered' ? 5 : -1;
        if (order.status !== filterTab && order.stage !== targetStage) return false;
      }
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchId = order.id.toLowerCase().includes(q);
      const matchName = order.customerName.toLowerCase().includes(q);
      const matchPhone = order.phone.includes(q);
      const matchAddress = (order.address || '').toLowerCase().includes(q);
      const matchPayment = (order.payment || '').toLowerCase().includes(q);
      const matchUtr = extractUtrFromOrder(order).toLowerCase().includes(q);
      if (!matchId && !matchName && !matchPhone && !matchAddress && !matchPayment && !matchUtr) return false;
    }

    return true;
  });

  const handleStageChange = async (orderId: string, nextStage: number, nextStatus: Order['status']) => {
    setUpdatingId(orderId);
    try {
      await updateOrderStage(orderId, nextStage, nextStatus);
      await updateOrderStageOnSheet(orderId, nextStage, nextStatus);
      if (nextStatus === 'accepted') {
        showToast(isEnglish ? `Order #${orderId} confirmed & accepted! ✅` : `ଅର୍ଡର #${orderId} ନିଶ୍ଚିତ ଓ ସ୍ୱୀକାର ହେଲା! ✅`);
      }
    } catch (e) {
      console.error('Error updating order stage:', e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleManualRefresh = async () => {
    const list = await refreshOrders(true);
    showToast(isEnglish ? `Fetched ${list.length} orders from Google Sheet ✅` : `ଗୁଗୁଲ୍ ସିଟ୍ ରୁ ${list.length} ଟି ଅର୍ଡର ରିଫ୍ରେସ୍ ହେଲା! ✅`);
  };

  const handleCancelOrder = async (orderId: string) => {
    if (confirm(isEnglish ? `Cancel order #${orderId}?` : `ଅର୍ଡର #${orderId} କୁ ବାତିଲ୍ (Cancel) କରିବାକୁ ଚାହାଁନ୍ତି କି?`)) {
      setUpdatingId(orderId);
      try {
        await cancelOrder(orderId);
      } finally {
        setUpdatingId(null);
      }
    }
  };

  // Status counts for badge tabs
  const countAll = myOrders.length;
  const countPending = myOrders.filter((o) => (o.status === 'pending' || o.status === 'reviewed' || o.stage === 1) && o.status !== 'cancelled').length;
  const countAccepted = myOrders.filter((o) => o.status === 'accepted' || o.stage === 2).length;
  const countPacking = myOrders.filter((o) => o.status === 'packing' || o.stage === 3).length;
  const countOut = myOrders.filter((o) => o.status === 'out_for_delivery' || o.stage === 4).length;
  const countDelivered = myOrders.filter((o) => o.status === 'delivered' || o.stage === 5).length;
  const countCancelled = myOrders.filter((o) => o.status === 'cancelled').length;

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <span>5-Stage Order Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEnglish
              ? 'Real-time order dispatch control synced with Google Sheet & Customer Tracker'
              : 'ଗୁଗୁଲ୍ ସିଟ୍ ଓ ଗ୍ରାହକଙ୍କ ଟ୍ରାକିଂ ସହ ଲାଇଭ୍ ଅର୍ଡର ପରିଚାଳନା'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Real-time Refresh Orders from Google Sheet button */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshingOrders}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            title="Refresh orders from Google Sheet"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingOrders ? 'animate-spin' : ''}`} />
            <span>{isRefreshingOrders ? 'Syncing...' : '🔄 Sync Sheet'}</span>
          </button>

          <button
            onClick={() => setShowScanner(true, 'quickbill')}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer"
          >
            <Barcode className="w-4 h-4" />
            <span>⚡ POS Bill</span>
          </button>
        </div>
      </div>

      {/* Incoming Order Notification & Ring Controls Quick Bar */}
      <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 border border-blue-200/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
            {shopConfig.orderNotificationEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5 text-blue-200" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-800">
                {isEnglish ? 'Live Order Alerts' : 'ଅର୍ଡର ଆଲର୍ଟ ଓ ରିଂ'}
              </span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                isStoreOpenNow(shopConfig) ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {isStoreOpenNow(shopConfig) ? (isEnglish ? '● Store Open' : '● ଦୋକାନ ଖୋଲା') : (isEnglish ? '● Store Closed' : '● ଦୋକାନ ବନ୍ଦ')}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              {isEnglish ? 'Configure sound & alert active hours' : 'ଆଲର୍ଟ ଏବଂ ରିଙ୍ଗ୍ ସମୟ ସେଟିଂସ୍'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Notification Toggle */}
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs text-[11px] font-bold">
            <button
              type="button"
              onClick={async () => {
                const nextVal = !shopConfig.orderNotificationEnabled;
                updateShopConfig({ orderNotificationEnabled: nextVal });
                await pushConfigKeyToSheet('ORDER_NOTIFICATION_ENABLED', nextVal ? 'true' : 'false');
                showToast(nextVal ? 'Order Alert ON 🔔' : 'Order Alert OFF 🔕');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                shopConfig.orderNotificationEnabled
                  ? 'bg-blue-600 text-white font-black shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Toggle Incoming Order Alert"
            >
              {shopConfig.orderNotificationEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3 text-slate-400" />}
              <span>{shopConfig.orderNotificationEnabled ? 'Alert ON' : 'Alert OFF'}</span>
            </button>
            {shopConfig.orderNotificationEnabled && (
              <button
                type="button"
                onClick={async () => {
                  const nextH = shopConfig.orderNotificationHours === 'always' ? 'store_hours' : 'always';
                  updateShopConfig({ orderNotificationHours: nextH });
                  await pushConfigKeyToSheet('ORDER_NOTIFICATION_HOURS', nextH);
                  showToast(nextH === 'always' ? 'Alerts: 24/7 Always 🔔' : 'Alerts: Store Hours Only ⏰');
                }}
                className="ml-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-extrabold cursor-pointer border border-blue-200/60"
                title="Switch between Always (24/7) vs Store Hours Only"
              >
                {shopConfig.orderNotificationHours === 'always' ? '24/7' : 'Store Hours'}
              </button>
            )}
          </div>

          {/* Ring Sound Toggle */}
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs text-[11px] font-bold">
            <button
              type="button"
              onClick={async () => {
                const nextVal = !shopConfig.orderRingEnabled;
                updateShopConfig({ orderRingEnabled: nextVal });
                await pushConfigKeyToSheet('ORDER_RING_ENABLED', nextVal ? 'true' : 'false');
                showToast(nextVal ? 'Ring Sound ON 🔊' : 'Ring Sound OFF 🔇');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                shopConfig.orderRingEnabled
                  ? 'bg-amber-600 text-white font-black shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Toggle Incoming Order Ring Chime"
            >
              {shopConfig.orderRingEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3 text-slate-400" />}
              <span>{shopConfig.orderRingEnabled ? 'Ring ON' : 'Ring OFF'}</span>
            </button>
            {shopConfig.orderRingEnabled && (
              <button
                type="button"
                onClick={async () => {
                  const nextH = shopConfig.orderRingHours === 'always' ? 'store_hours' : 'always';
                  updateShopConfig({ orderRingHours: nextH });
                  await pushConfigKeyToSheet('ORDER_RING_HOURS', nextH);
                  showToast(nextH === 'always' ? 'Ring: Always 24/7 🔊' : 'Ring: Store Hours Only ⏰');
                }}
                className="ml-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 text-[10px] font-extrabold cursor-pointer border border-amber-200/60"
                title="Switch between Always (24/7) vs Store Hours Only"
              >
                {shopConfig.orderRingHours === 'always' ? '24/7' : 'Store Hours'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pending Orders Action Banner */}
      {countPending > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs animate-pulse">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-sm shrink-0">
              {countPending}
            </div>
            <div>
              <p className="text-xs font-black text-amber-900">
                {isEnglish
                  ? `${countPending} New Order${countPending > 1 ? 's' : ''} Awaiting Acceptance!`
                  : `${countPending} ଟି ନୂତନ ଅର୍ଡର ସ୍ୱୀକାର ପାଇଁ ଅପେକ୍ଷା କରୁଛି!`}
              </p>
              <p className="text-[11px] text-amber-700">
                {isEnglish
                  ? 'Review details and click "Accept Order" below to begin packing.'
                  : 'ଗ୍ରାହକଙ୍କ ଅର୍ଡର ଦେଖି ତୁରନ୍ତ "Accept" ବଟନ୍ ଦବାନ୍ତୁ।'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterTab('pending')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shrink-0 cursor-pointer shadow-xs"
          >
            {isEnglish ? 'View Pending' : 'ଦେଖନ୍ତୁ'}
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-bold">
        {[
          { id: 'all', label: 'All Orders', count: countAll },
          { id: 'pending', label: '1. Pending', count: countPending },
          { id: 'accepted', label: '2. Accepted', count: countAccepted },
          { id: 'packing', label: '3. Packing', count: countPacking },
          { id: 'out_for_delivery', label: '4. Out for Delivery', count: countOut },
          { id: 'delivered', label: '5. Delivered', count: countDelivered },
          { id: 'cancelled', label: 'Cancelled', count: countCancelled }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id as any)}
            className={`px-3 py-2 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              filterTab === tab.id
                ? 'bg-[#1864ab] text-white shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                filterTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isEnglish ? 'Search orders by ID, UTR No., Customer Name, Phone, Address...' : 'ଅର୍ଡର ID, UTR ନମ୍ବର, ନାମ, କିମ୍ବା ଫୋନ୍ ନମ୍ବର ଖୋଜନ୍ତୁ...'}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
          >
            Clear
          </button>
        )}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">
            {isEnglish ? 'No orders match this filter' : 'କୌଣସି ଅର୍ଡର ମିଳିଲା ନାହିଁ'}
          </h3>
          <p className="text-xs text-slate-400">
            {searchQuery
              ? `No results for "${searchQuery}"`
              : 'When customers place orders, they will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const currentStage = order.stage || 1;
            const isCancelled = order.status === 'cancelled';
            const isUpdating = updatingId === order.id;
            const upiOrder = isUpiOrder(order);
            const utrCode = extractUtrFromOrder(order);
            const isOnHoldUpi = upiOrder && !isCancelled && currentStage === 1;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border shadow-xs overflow-hidden transition-all ${
                  isOnHoldUpi
                    ? 'border-2 border-indigo-400 ring-2 ring-indigo-100'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Order Top Bar */}
                <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-sm text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                      #{order.id}
                    </span>
                    {upiOrder && (
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-indigo-600 text-white shadow-2xs">
                        ⚡ UPI QR ORDER {utrCode ? `• UTR: ${utrCode}` : ''}
                      </span>
                    )}
                    <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      {order.timestamp}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        isCancelled
                          ? 'bg-rose-100 text-rose-700'
                          : isOnHoldUpi
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                          : order.status === 'reviewed'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : currentStage === 5
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {isOnHoldUpi
                        ? (isEnglish ? '⏸️ ON HOLD (VERIFY UTR)' : '⏸️ ON HOLD (UTR ଯାଞ୍ଚ କରନ୍ତୁ)')
                        : order.status === 'reviewed'
                        ? (isEnglish ? '👁️ Under Review' : '👁️ ସମୀକ୍ଷା ଚାଲିଛି')
                        : order.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      Rs. {order.total}
                    </span>
                  </div>
                </div>

                {/* Customer & Delivery Details */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-100 text-xs">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <span>👤 {order.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <a
                        href={`tel:${order.phone}`}
                        className="font-bold text-blue-600 hover:underline"
                      >
                        +91 {order.phone}
                      </a>
                      <a
                        href={`https://wa.me/91${order.phone.replace(/\D/g, '').slice(-10)}?text=Hello%20${encodeURIComponent(order.customerName)},%20regarding%20your%20Munna%20Grocery%20Order%20${order.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-black hover:bg-emerald-100"
                      >
                        WhatsApp
                      </a>
                    </div>
                    <div className="flex items-start gap-1.5 text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{order.address}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Delivery Type:</span>
                      <span className="font-bold text-slate-800">
                        {order.deliveryType === 'pickup' ? '🛍️ Store Pickup' : '🚚 Home Delivery'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment:</span>
                      <span className="font-bold text-slate-800 uppercase">
                        {order.payment}
                      </span>
                    </div>
                    {upiOrder && (
                      <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-2 mt-1">
                        <div>
                          <span className="text-[10px] font-black uppercase text-indigo-700 block">
                            Customer UTR / Ref ID:
                          </span>
                          <span className="font-mono font-black text-xs text-indigo-950">
                            {utrCode || order.payment}
                          </span>
                        </div>
                        {utrCode && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(utrCode);
                              showToast(`Copied UTR ID: ${utrCode}`);
                            }}
                            className="px-2 py-1 rounded-md bg-white border border-indigo-200 text-indigo-700 text-[10px] font-black flex items-center gap-1 cursor-pointer hover:bg-indigo-100"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy UTR</span>
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        {order.deliveryType === 'pickup' ? 'Pickup Timing:' : 'Expected By:'}
                      </span>
                      <span className="font-bold text-emerald-700">
                        {order.pickupSlot || order.expectedBy || '30 - 60 mins'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order Items Breakdown */}
                <div className="p-4 bg-white">
                  <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block mb-2">
                    Ordered Items ({order.items.reduce((s, i) => s + i.qty, 0)})
                  </span>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 flex items-center justify-between text-xs bg-slate-50/40 hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-700 font-black text-[10px] flex items-center justify-center">
                            {item.qty}x
                          </span>
                          <span className="font-bold text-slate-800">{item.name}</span>
                        </div>
                        <span className="font-black text-slate-900">
                          Rs. {item.price * item.qty}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5-Stage Live Dispatch Controller */}
                {!isCancelled ? (
                  <div className="p-4 bg-slate-50/80 border-t border-slate-100 space-y-3">
                    {/* Quick Accept / Confirm or Cancel CTA for New Pending / On Hold Orders */}
                    {(currentStage === 1 || order.status === 'pending') && (
                      <div
                        className={`rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs border ${
                          upiOrder
                            ? 'bg-indigo-50/90 border-indigo-300'
                            : 'bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2.5 h-2.5 rounded-full animate-ping ${
                                upiOrder ? 'bg-indigo-600' : 'bg-emerald-500'
                              }`}
                            />
                            <span className={`text-xs font-black ${upiOrder ? 'text-indigo-950' : 'text-emerald-900'}`}>
                              {upiOrder
                                ? (isEnglish
                                    ? `⏸️ UPI Order On Hold — Verify ₹${order.total} (UTR: ${utrCode || 'Check Payment'})`
                                    : `⏸️ UPI ଅର୍ଡର ହୋଲ୍ଡ (On Hold) ଅଛି — ₹${order.total} (UTR: ${utrCode || 'ଯାଞ୍ଚ କରନ୍ତୁ'})`)
                                : (isEnglish ? 'New Order Awaiting Acceptance' : 'ନୂତନ ଅର୍ଡର ସ୍ୱୀକାର ଅପେକ୍ଷାରେ')}
                            </span>
                          </div>
                          {upiOrder && (
                            <p className="text-[11px] text-indigo-800 font-medium pl-4">
                              {isEnglish
                                ? 'Check your UPI / Bank app for this UTR ID, then click Confirm Order or Cancel Order.'
                                : 'ଆପଣଙ୍କ ବ୍ୟାଙ୍କ/UPI ଆପ୍‌ରେ UTR ନମ୍ବର ଯାଞ୍ଚ କରି Confirm କିମ୍ବା Cancel ଦବାନ୍ତୁ।'}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleStageChange(order.id, 2, 'accepted')}
                            disabled={isUpdating}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {upiOrder
                                ? (isEnglish ? 'Confirm UPI & Accept ✅' : 'UPI ନିଶ୍ଚିତ ଓ ଗ୍ରହଣ କରନ୍ତୁ ✅')
                                : (isEnglish ? 'Accept Order ✅' : 'ଅର୍ଡର ଗ୍ରହଣ କରନ୍ତୁ ✅')}
                            </span>
                          </button>
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            disabled={isUpdating}
                            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>{isEnglish ? 'Cancel ❌' : 'ବାତିଲ୍ ❌'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-blue-600" />
                        <span>Live Stage Progression ({currentStage}/5)</span>
                      </span>
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        disabled={isUpdating}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel Order</span>
                      </button>
                    </div>

                    {/* Stage Buttons */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {STAGES.map((st) => {
                        const isCurrent = currentStage === st.stage;
                        const isPassed = currentStage > st.stage;
                        const Icon = st.icon;

                        return (
                          <button
                            key={st.stage}
                            onClick={() => handleStageChange(order.id, st.stage, st.status)}
                            disabled={isUpdating}
                            className={`p-2.5 rounded-xl border text-left transition-all relative cursor-pointer ${
                              isCurrent
                                ? 'bg-[#1864ab] text-white border-[#1864ab] shadow-sm scale-102'
                                : isPassed
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-black opacity-80">
                                Stage {st.stage}
                              </span>
                              <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-white' : isPassed ? 'text-emerald-600' : 'text-slate-400'}`} />
                            </div>
                            <p className="text-xs font-black leading-tight">
                              {isEnglish ? st.labelEn : st.labelOr}
                            </p>
                            {isCurrent && (
                              <span className="text-[9px] font-bold opacity-90 block mt-0.5">
                                ● Current Live
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 border-t border-rose-100 text-center">
                    <span className="text-xs font-black text-rose-700 flex items-center justify-center gap-1">
                      <XCircle className="w-4 h-4" />
                      <span>This order was cancelled</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
