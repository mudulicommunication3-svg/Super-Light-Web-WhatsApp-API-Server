import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { isUpiOrder, extractUtrFromOrder } from '../services/api';
import { useRegisterBackHandler } from '../utils/backButton';
import {
  ArrowLeft,
  Receipt,
  Search,
  XCircle,
  Clock,
  RotateCcw,
  ShieldCheck,
  LogIn,
  KeyRound,
  ChevronDown,
  ChevronUp,
  Package,
  QrCode,
  CheckCircle2,
  Loader2,
  RefreshCw
} from 'lucide-react';

export const OrdersScreen: React.FC = () => {
  const {
    myOrders,
    cancelOrder,
    sessionUser,
    setActiveScreen,
    goBackScreen,
    setShowLoginModal,
    linkOrderToDevice,
    isEnglish,
    shopConfig,
    isRefreshingOrders,
    refreshOrders
  } = useApp();

  // Silently sync latest orders in the background when OrdersScreen opens
  useEffect(() => {
    void refreshOrders(false);
  }, [refreshOrders]);

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await refreshOrders(false);
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [showLookupBox, setShowLookupBox] = useState(false);
  const [lookupOrderId, setLookupOrderId] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);

  useRegisterBackHandler(() => {
    if (showLookupBox) {
      setShowLookupBox(false);
      return true;
    }
    return false;
  });

  const STAGES = [
    { num: 1, label: 'Order Placed', desc: isEnglish ? 'Order placed' : 'ଅର୍ଡର ଗ୍ରହଣ ହେଲା' },
    { num: 2, label: 'Accepted', desc: isEnglish ? 'Accepted by store' : 'ଦୋକାନୀ ଅର୍ଡର ଗ୍ରହଣ କଲେ' },
    { num: 3, label: 'Packing', desc: isEnglish ? 'Packed & verified' : 'ପ୍ୟାକିଂ ଓ ଷ୍ଟକ୍ ଯାଞ୍ଚ ସରିଲା' },
    { num: 4, label: 'Out for Delivery', desc: isEnglish ? 'Out for delivery' : 'ଡେଲିଭରୀ ବାହାରିଛି' },
    { num: 5, label: 'Delivered', desc: isEnglish ? 'Successfully delivered' : 'ସଫଳତାର ସହ ପହଞ୍ଚିଲା' }
  ];

  // Strictly user-wise: Filter only within the current user's verified orders
  const filteredOrders = myOrders.filter((o) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    const idMatch = o.id.toLowerCase().includes(q);
    const itemMatch = o.items.some((item) => item.name.toLowerCase().includes(q));
    return idMatch || itemMatch;
  });

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupOrderId.trim() || !lookupPhone.trim()) return;
    setIsLookingUp(true);
    const ok = linkOrderToDevice(lookupOrderId.trim(), lookupPhone.trim());
    setIsLookingUp(false);
    if (ok) {
      setLookupOrderId('');
      setLookupPhone('');
      setShowLookupBox(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-[#f1f3f6] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#1864ab] text-white px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveScreen('home')}
            className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center cursor-pointer hover:bg-white/25 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div>
            <h3 className="font-extrabold text-sm leading-tight">
              {isEnglish ? 'My Orders & Live Tracking' : 'ମୋ ଅର୍ଡର ଓ ଲାଇଭ୍ ଟ୍ରାକିଂ'}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isManualRefreshing}
            className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isManualRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* User Account Pill or Quick Login */}
          {sessionUser ? (
            <div className="flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-full text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span className="max-w-[100px] truncate">{sessionUser.name || sessionUser.phone}</span>
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-1 bg-white text-[#1864ab] px-2.5 py-1 rounded-full text-[11px] font-extrabold hover:bg-slate-100 cursor-pointer shadow-xs"
            >
              <LogIn className="w-3 h-3" />
              <span>{isEnglish ? 'Login' : 'ଲଗଇନ୍'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto p-3.5 pb-28 space-y-3">
        {/* User Isolation Privacy Banner */}
        {sessionUser ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-emerald-900 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-tight">
                {isEnglish ? 'Personal Order History' : 'ବ୍ୟକ୍ତିଗତ ଅର୍ଡର ସୁରକ୍ଷା'}
              </p>
              <p className="text-[11px] text-emerald-700 leading-tight">
                {isEnglish
                  ? `Showing orders linked to ${sessionUser.phone}. Safe & private.`
                  : `${sessionUser.phone} ସହ ଜଡ଼ିତ ଆପଣଙ୍କ ବ୍ୟକ୍ତିଗତ ଅର୍ଡର। ଅନ୍ୟ କେହି ଦେଖିପାରିବେ ନାହିଁ।`}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 space-y-2 shadow-xs">
            <div className="flex items-start gap-2.5 text-xs text-blue-900">
              <Package className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">
                  {isEnglish ? 'Device Order View' : 'ଏହି ଡିଭାଇସ୍‌ର ଅର୍ଡର'}
                </p>
                <p className="text-[11px] text-blue-700 leading-tight">
                  {isEnglish
                    ? 'Showing orders placed from this browser. Log in to save and access your orders on any device!'
                    : 'ଏହି ଫୋନ୍/ବ୍ରାଉଜରରୁ ହୋଇଥିବା ଅର୍ଡର ଦେଖାଯାଉଛି। ସବୁ ଡିଭାଇସ୍‌ରେ ଅର୍ଡର ପାଇବା ପାଇଁ ଲଗଇନ୍ କରନ୍ତୁ।'}
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowLoginModal(true)}
                className="flex-1 py-1.5 px-3 bg-[#1864ab] hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isEnglish ? 'Log in with Account' : 'ଆକାଉଣ୍ଟ୍ ଲଗଇନ୍ କରନ୍ତୁ'}</span>
              </button>

              <button
                onClick={() => setShowLookupBox(!showLookupBox)}
                className="py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                <span>{isEnglish ? 'Track by ID' : 'ID ଯୋଡ଼ନ୍ତୁ'}</span>
                {showLookupBox ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>
        )}

        {/* Secure Order Lookup Box (requires BOTH Order ID + matching Phone Number) */}
        {showLookupBox && (
          <form
            onSubmit={handleLookup}
            className="bg-white p-3.5 rounded-2xl border border-amber-300 shadow-sm space-y-2.5 animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-950">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>{isEnglish ? 'Secure Order Lookup' : 'ସୁରକ୍ଷିତ ଅର୍ଡର ଯାଞ୍ଚ ଓ ଟ୍ରାକିଂ'}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              {isEnglish
                ? 'Enter your Order ID and the 10-digit phone used at checkout to link and track.'
                : 'ଆପଣଙ୍କ ଅର୍ଡର ID ଏବଂ ଅର୍ଡର ସମୟରେ ଦିଆଯାଇଥିବା ୧୦-ଅଙ୍କ ଫୋନ୍ ନମ୍ବର ଦେଇ ଟ୍ରାକ୍ କରନ୍ତୁ।'}
            </p>

            <div className="space-y-2">
              <input
                type="text"
                value={lookupOrderId}
                onChange={(e) => setLookupOrderId(e.target.value)}
                placeholder={isEnglish ? 'Order ID (e.g. MG-123456)' : 'ଅର୍ଡର ID (ଯେପରି MG-123456)'}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-[#1864ab] font-mono uppercase"
              />

              <input
                type="tel"
                maxLength={10}
                value={lookupPhone}
                onChange={(e) => setLookupPhone(e.target.value)}
                placeholder={isEnglish ? '10-digit Phone Number' : '୧୦-ଅଙ୍କ ମୋବାଇଲ୍ ନମ୍ବର'}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-[#1864ab]"
              />
            </div>

            <button
              type="submit"
              disabled={isLookingUp}
              className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{isLookingUp ? 'Verifying...' : (isEnglish ? 'Verify & Link Order' : 'ଅର୍ଡର ଯାଞ୍ଚ ଓ ଯୋଡ଼ନ୍ତୁ')}</span>
            </button>
          </form>
        )}

        {/* Search within Current User's Orders */}
        {myOrders.length > 0 && (
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  isEnglish
                    ? 'Search in your orders (ID or product name)...'
                    : 'ଆପଣଙ୍କ ଅର୍ଡର ID କିମ୍ବା ସାମଗ୍ରୀର ନାମ ଦେଇ ଖୋଜନ୍ତୁ...'
                }
                className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-[#1864ab]"
              />
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Orders List */}
        <div id="ordersList" className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-3">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto" />
              <div>
                <p className="text-xs text-slate-700 font-black">
                  {isEnglish ? 'No orders found' : 'କୌଣସି ଅର୍ଡର ମିଳିଲା ନାହିଁ।'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {searchTerm
                    ? (isEnglish ? 'No orders match your search term.' : 'ଆପଣଙ୍କ ଖୋଜିବା ସହ କୌଣସି ଅର୍ଡର ମେଳ ଖାଉନାହିଁ।')
                    : (isEnglish
                        ? 'Place your first order to track live dispatch status!'
                        : 'ନୂତନ ଅର୍ଡର କଲେ ଏଠାରେ ୫-ଧାପ ବିଶିଷ୍ଟ ଲାଇଭ୍ ଟ୍ରାକିଂ ଦେଖିପାରିବେ।')}
                </p>
              </div>

              {!sessionUser && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1864ab] text-white rounded-xl text-xs font-extrabold shadow-xs hover:bg-blue-800 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{isEnglish ? 'Log in to view past orders' : 'ପୂର୍ବ ଅର୍ଡର ଦେଖିବାକୁ ଲଗଇନ୍ କରନ୍ତୁ'}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            filteredOrders.map((order) => {
              const currentStage = order.stage || 1;
              const canCancel =
                ['pending', 'accepted', 'packing'].includes(order.status) &&
                currentStage < 4;
              const upiOrder = isUpiOrder(order);
              const orderUtr = extractUtrFromOrder(order);
              const isUpiOnHold = upiOrder && order.status !== 'cancelled' && (currentStage === 1 || order.status === 'pending');

              return (
                <div
                  key={order.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5"
                >
                  {/* Order Top Bar */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-black text-slate-900 text-xs">#{order.id}</span>
                    <div className="flex items-center gap-1.5">
                      {upiOrder && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                          ⚡ UPI QR {orderUtr ? `• UTR: ${orderUtr}` : ''}
                        </span>
                      )}
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                          order.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-800'
                            : order.status === 'delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : isUpiOnHold
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                            : 'bg-blue-100 text-[#1864ab]'
                        }`}
                      >
                        {order.status === 'cancelled'
                          ? 'CANCELLED'
                          : isUpiOnHold
                          ? '⏸️ ON HOLD (WAITING SELLER)'
                          : `Stage ${currentStage}/5`}
                      </span>
                    </div>
                  </div>

                  {/* UPI Order On Hold / Confirmed Status Banner */}
                  {upiOrder && order.status !== 'cancelled' && (
                    isUpiOnHold ? (
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-300 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-amber-950 flex items-center gap-1.5">
                            <QrCode className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>
                              {isEnglish
                                ? '⏸️ Order On Hold — Waiting for Seller Confirmation'
                                : '⏸️ ଅର୍ଡର ହୋଲ୍ଡ (On Hold) — ଦୋକାନୀଙ୍କ ଅନୁମୋଦନ ପାଇଁ ଅପେକ୍ଷାରତ'}
                            </span>
                          </span>
                        </div>
                        <p className="text-[10.5px] text-amber-800 leading-snug">
                          {isEnglish
                            ? `Your UPI payment (UTR: ${orderUtr || 'Submitted'}) has been sent to the seller. Your order will be confirmed once verified.`
                            : `ଆପଣଙ୍କ UPI ପେମେଣ୍ଟ (UTR: ${orderUtr || 'Submitted'}) ଦୋକାନୀଙ୍କୁ ପଠାଯାଇଛି। ଦୋକାନୀ ଯାଞ୍ଚ କରିବା ମାତ୍ରେ ଅର୍ଡର କନଫର୍ମ ହେବ।`}
                        </p>
                      </div>
                    ) : (
                      <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] font-bold text-emerald-800 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            {isEnglish
                              ? '✅ UPI Payment Verified & Confirmed by Seller'
                              : '✅ ଦୋକାନୀଙ୍କ ଦ୍ୱାରା UPI ପେମେଣ୍ଟ ଯାଞ୍ଚ ଓ କନଫର୍ମ ହୋଇଛି'}
                          </span>
                        </span>
                        {orderUtr && (
                          <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-emerald-200">
                            UTR: {orderUtr}
                          </span>
                        )}
                      </div>
                    )
                  )}

                  <div className="text-[10px] text-slate-400 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>
                        {isEnglish ? 'Ordered at: ' : '🕐 ଅର୍ଡର୍ ସମୟ: '}
                        {order.timestamp} · {order.payment}
                      </span>
                    </div>
                    <div className="font-bold text-emerald-700">
                      {order.deliveryType === 'pickup'
                        ? (isEnglish ? '🛍️ Pickup Slot: ' : '🛍️ ପିକଅପ୍ ସ୍ଲଟ୍: ')
                        : (isEnglish ? '⏳ Expected: ' : '⏳ ଆଶାୟୀ ସମୟ: ')}
                      {order.pickupSlot || order.expectedBy || '30 - 60 mins'}
                    </div>
                  </div>

                  {/* Pickup Deadline & Auto-Cancel Notice Banner */}
                  {order.deliveryType === 'pickup' && (
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-950 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-700" />
                          <span>{isEnglish ? '🏁 Pickup Final Deadline:' : '🏁 ଚୂଡ଼ାନ୍ତ ପିକଅପ୍ ସମୟ:'}</span>
                        </span>
                        <span className="text-[10px] font-black bg-amber-200/90 text-amber-950 px-2 py-0.5 rounded font-mono border border-amber-300">
                          {order.pickupFinalTime || order.pickupSlot || 'Today'}
                        </span>
                      </div>
                      {order.status !== 'cancelled' && order.status !== 'delivered' && (
                        <p className="text-[10px] text-amber-800 leading-tight">
                          {isEnglish
                            ? '⚠️ Pick up before deadline. Uncollected orders auto-cancel & restore stock.'
                            : '⚠️ ସମୟ ସରିବା ଆଗରୁ କାଉଣ୍ଟରରୁ ନିଅନ୍ତୁ, ଅନ୍ୟଥା ଅର୍ଡର ସ୍ୱୟଂକ୍ରିୟ ବାତିଲ୍ ହୋଇ ଷ୍ଟକ୍ ଫେରିଯିବ।'}
                        </p>
                      )}
                      <div className="pt-1 border-t border-amber-200/70 text-[10.5px] text-slate-700 flex items-center justify-between flex-wrap gap-1">
                        <span className="font-bold text-slate-800">
                          📍 {shopConfig.storePickupName || 'Munna Grocery & Mobile'} ({shopConfig.storePickupAddress || 'Cinema Hall Road, Niali'})
                        </span>
                        {shopConfig.storePickupPhone && (
                          <a href={`tel:${shopConfig.storePickupPhone}`} className="text-emerald-700 font-black hover:underline flex items-center gap-1">
                            📞 {shopConfig.storePickupPhone}
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Items Box */}
                  <div className="p-2.5 bg-slate-50 rounded-xl space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[11px]">
                        <span className="text-slate-700 font-medium truncate flex-1">
                          {item.name} x{item.qty}
                        </span>
                        <span className="font-bold text-slate-900 ml-2">
                          Rs.{item.price * item.qty}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Bill Row */}
                  <div className="flex justify-between pt-1 border-t border-slate-100 text-xs font-black">
                    <span>Total Bill:</span>
                    <span className="text-[#1864ab]">Rs.{order.total}</span>
                  </div>

                  {/* 5-Stage Live Stepper (if not cancelled) */}
                  {order.status !== 'cancelled' ? (
                    <div className="stepper my-3">
                      <div className="stepper-line"></div>
                      {STAGES.map((st) => (
                        <div
                          key={st.num}
                          className={`step-item ${
                            currentStage > st.num ? 'done' : ''
                          } ${currentStage === st.num ? 'active' : ''}`}
                        >
                          <div className="step-dot"></div>
                          <div className="text-xs font-bold text-slate-800 leading-none">
                            {st.label}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {st.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-700">
                        <XCircle className="w-4 h-4 shrink-0" />
                        <span>
                          {order.isAutoCancelled
                            ? (isEnglish ? 'Auto-Cancelled (Pickup Deadline Expired)' : 'ଅର୍ଡର ସ୍ୱୟଂକ୍ରିୟ ବାତିଲ୍ (ପିକଅପ୍ ସମୟ ସରିଗଲା)')
                            : (isEnglish ? 'This order was cancelled' : 'ଏହି ଅର୍ଡର ବାତିଲ୍ ହୋଇଛି')}
                        </span>
                      </div>
                      {order.isAutoCancelled && (
                        <p className="text-[10.5px] text-emerald-800 font-bold pl-5.5 flex items-center gap-1">
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
                          <span>
                            {isEnglish
                              ? 'Stock Successfully Restored to Store Catalog'
                              : 'ବୁକ୍ ହୋଇଥିବା ସାମଗ୍ରୀର ଷ୍ଟକ୍ (Stock) ସଫଳତାର ସହ ଦୋକାନକୁ ଫେରିଆସିଛି'}
                          </span>
                        </p>
                      )}
                      {order.autoCancelledReason && (
                        <p className="text-[10px] text-rose-600 pl-5.5">{order.autoCancelledReason}</p>
                      )}
                    </div>
                  )}

                  {/* Cancel Button */}
                  {canCancel && (
                    <button
                      onClick={() => {
                        if (confirm(isEnglish ? 'Are you sure you want to cancel this order?' : 'ଆପଣ ସତରେ ଏହି ଅର୍ଡର ବାତିଲ୍ କରିବାକୁ ଚାହାଁନ୍ତି କି?')) {
                          cancelOrder(order.id);
                        }
                      }}
                      className="w-full py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
                    >
                      ❌ {isEnglish ? 'Cancel Order' : 'ଅର୍ଡର ବାତିଲ୍ କରନ୍ତୁ'}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
