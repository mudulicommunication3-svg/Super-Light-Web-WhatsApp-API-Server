import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingBag, Check, X, Eye, Volume2, VolumeX, Copy } from 'lucide-react';
import { isStoreOpenNow, isUpiOrder, extractUtrFromOrder } from '../services/api';
import { playOrderAlertChime } from '../utils/audioAlert';
import { showToast } from './Toast';

export const IncomingOrderAlert: React.FC = () => {
  const {
    incomingOrderAlert,
    setIncomingOrderAlert,
    updateOrderStage,
    setActiveScreen,
    refreshOrders,
    markOrderAlerted,
    shopConfig
  } = useApp();

  const [secondsLeft, setSecondsLeft] = useState(30);

  // Determine whether ringing is permitted right now based on admin settings
  const isRingEnabled = shopConfig.orderRingEnabled !== false;
  const ringHours = shopConfig.orderRingHours || 'always';
  const isStoreOpen = isStoreOpenNow(shopConfig);
  const shouldRing = isRingEnabled && (ringHours === 'always' || isStoreOpen);

  // Fast background polling every 2.5s while alert is open to sync immediately if another admin acts
  useEffect(() => {
    if (!incomingOrderAlert) return;
    const syncPoll = setInterval(() => {
      refreshOrders(true);
    }, 2500);
    return () => clearInterval(syncPoll);
  }, [incomingOrderAlert, refreshOrders]);

  useEffect(() => {
    if (!incomingOrderAlert) {
      setSecondsLeft(30);
      return;
    }

    // Play chime only if ringing is enabled and within permitted hours
    if (shouldRing) {
      playOrderAlertChime();
    }

    // Repeat chime every 3.2 seconds while alert is open if ringing is allowed
    const chimeInterval = setInterval(() => {
      if (shouldRing) {
        playOrderAlertChime();
      }
    }, 3200);

    const intervalTimer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    const autoDismissTimeout = setTimeout(() => {
      setIncomingOrderAlert(null);
    }, 30000);

    return () => {
      clearInterval(chimeInterval);
      clearInterval(intervalTimer);
      clearTimeout(autoDismissTimeout);
    };
  }, [incomingOrderAlert, setIncomingOrderAlert, shouldRing]);

  if (!incomingOrderAlert) return null;

  const upiOrder = isUpiOrder(incomingOrderAlert);
  const utrCode = extractUtrFromOrder(incomingOrderAlert);

  const handleAction = async (action: 'accept' | 'decline' | 'review') => {
    const orderId = incomingOrderAlert.id;
    markOrderAlerted(orderId);
    setIncomingOrderAlert(null);

    if (action === 'accept') {
      await updateOrderStage(orderId, 2, 'accepted');
    } else if (action === 'decline') {
      await updateOrderStage(orderId, 1, 'cancelled');
    } else if (action === 'review') {
      await updateOrderStage(orderId, 1, 'reviewed');
    }

    try {
      const channel = new BroadcastChannel('munna_order_sync_channel');
      channel.postMessage({
        type: 'ORDER_SYNC',
        orderId,
        action,
        status: action === 'accept' ? 'accepted' : action === 'decline' ? 'cancelled' : 'reviewed'
      });
      channel.close();
    } catch (e) {}

    if (action === 'review' || action === 'accept') {
      setActiveScreen('admin');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4">
      {/* Pulsing incoming call background */}
      <div className="absolute inset-0 bg-rose-950/95 backdrop-blur-md overflow-hidden">
        <div className="absolute inset-0 bg-rose-600/20 rounded-full blur-[60px] animate-pulse"></div>
        <div className="relative z-10 flex flex-col items-center justify-center h-full w-full py-8 text-center px-4 max-w-md mx-auto">
          {/* Animated Bag Icon */}
          <div className="relative z-20 w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4 animate-pulse ring-4 ring-rose-500/30">
            <ShoppingBag className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-2xl font-extrabold text-white tracking-tight mb-1">
            {upiOrder ? 'UPI Paid Order Alert!' : 'Incoming Order Alert!'}
          </h2>
          <p className="text-sm text-rose-200 mb-4 font-semibold">
            {upiOrder
              ? '⏸️ UPI ଅର୍ଡର ON HOLD ଅଛି — UTR ଯାଞ୍ଚ କରି Confirm କରନ୍ତୁ'
              : 'ନୂତନ ଗ୍ରାହକ ଅର୍ଡର ଅପେକ୍ଷା କରୁଛି'}
          </p>

          {/* Countdown timer & Sound status badge */}
          <div className="flex items-center gap-2 mb-5 flex-wrap justify-center">
            <span className="text-sm font-black text-white bg-black/40 px-4 py-1 rounded-full shadow-lg border border-white/10">
              ⏳ {secondsLeft}s
            </span>
            {upiOrder && (
              <span className="text-xs font-black text-amber-950 bg-amber-300 px-3 py-1 rounded-full shadow-sm">
                ⚡ UPI QR PAID • ON HOLD
              </span>
            )}
            {shouldRing ? (
              <span className="text-xs font-black text-emerald-200 bg-emerald-950/70 border border-emerald-400/40 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Ringing 🔊</span>
              </span>
            ) : (
              <span className="text-xs font-black text-amber-200 bg-amber-950/70 border border-amber-400/40 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                <span>Silent ({!isRingEnabled ? 'Ring OFF' : 'Store Closed'}) 🔇</span>
              </span>
            )}
          </div>

          {/* Order Details Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-2xl w-full mb-5 text-left space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-[#1864ab]">
                {incomingOrderAlert.deliveryType === 'pickup' ? 'Store Pickup' : 'Home Delivery'}
              </span>
              <span className="text-xs font-bold text-rose-100">
                {incomingOrderAlert.timestamp}
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-white">
              <div className="flex justify-between">
                <span className="text-rose-200">Order ID:</span>
                <span className="font-bold">#{incomingOrderAlert.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-rose-200">Customer:</span>
                <span className="font-bold">{incomingOrderAlert.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-rose-200">Phone:</span>
                <span className="font-bold">{incomingOrderAlert.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-rose-200">Payment Mode:</span>
                <span className="font-black text-amber-300">{upiOrder ? 'UPI QR Payment' : incomingOrderAlert.payment}</span>
              </div>
              {upiOrder && (
                <div className="p-2.5 rounded-xl bg-amber-400/20 border border-amber-300/60 flex items-center justify-between gap-2 mt-1">
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-200 block">
                      Customer Submitted UTR / Ref ID:
                    </span>
                    <span className="font-mono font-black text-sm text-white tracking-wider">
                      {utrCode || incomingOrderAlert.payment}
                    </span>
                  </div>
                  {utrCode && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(utrCode);
                        showToast(`Copied UTR: ${utrCode}`);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white text-slate-900 text-[11px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  )}
                </div>
              )}
              <div className="flex justify-between pt-1">
                <span className="text-rose-200">Total Bill:</span>
                <span className="font-black text-emerald-300 text-base">
                  Rs.{incomingOrderAlert.total}
                </span>
              </div>
            </div>
          </div>

          {/* Response Buttons */}
          <div className="grid grid-cols-2 gap-3 w-full mb-3">
            <button
              onClick={() => handleAction('accept')}
              className="py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm sm:text-base font-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-5 h-5" />
              <span>{upiOrder ? 'Confirm UPI ✅' : 'Accept ✅'}</span>
            </button>
            <button
              onClick={() => handleAction('decline')}
              className="py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm sm:text-base font-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
              <span>{upiOrder ? 'Cancel Order ❌' : 'Reject ❌'}</span>
            </button>
          </div>

          <button
            onClick={() => handleAction('review')}
            className="w-full py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold border border-white/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>Review Order in Admin Panel</span>
          </button>
        </div>
      </div>
    </div>
  );
};
