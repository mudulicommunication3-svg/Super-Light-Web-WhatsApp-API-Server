import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Address } from '../types';
import {
  ArrowLeft,
  Plus,
  MapPin,
  Trash2,
  Edit2,
  Check,
  Store,
  ExternalLink,
  ShoppingBag,
  Clock,
  Phone,
  Sparkles,
  ShieldCheck,
  Truck,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { STORE_LAT, STORE_LNG } from '../data/initialData';
import { useRegisterBackHandler } from '../utils/backButton';

export const AddressScreen: React.FC = () => {
  const {
    addresses,
    saveAddress,
    deleteAddress,
    setDefaultAddress,
    setActiveScreen,
    goBackScreen,
    shopConfig,
    updateShopConfig,
    isEnglish,
    isLoadingAddresses,
    isSavingAddress,
    refreshAddresses,
    sessionUser
  } = useApp();

  // Always read latest addresses from Google Sheet when AddressScreen opens
  useEffect(() => {
    if (sessionUser?.phone) {
      refreshAddresses();
    }
  }, [sessionUser?.phone, refreshAddresses]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressText, setAddressText] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Store Pickup Address Edit State (Editable store address with default upper name)
  const [isEditingStoreAddr, setIsEditingStoreAddr] = useState(false);

  useRegisterBackHandler(() => {
    if (showForm) {
      setShowForm(false);
      setEditingId(null);
      return true;
    }
    if (isEditingStoreAddr) {
      setIsEditingStoreAddr(false);
      return true;
    }
    return false;
  });
  const [storeNameInput, setStoreNameInput] = useState(
    shopConfig.storePickupName || 'Munna Grocery & Mobile'
  );
  const [storeAddrInput, setStoreAddrInput] = useState(
    shopConfig.storePickupAddress || 'Cinema Hall Road, Niali, Cuttack, PIN - 754004'
  );
  const [storePhoneInput, setStorePhoneInput] = useState(
    shopConfig.storePickupPhone || '9040585726'
  );
  const [storeHoursInput, setStoreHoursInput] = useState(
    shopConfig.storePickupHours || '10:00 AM - 09:00 PM (Daily)'
  );

  // Keep state in sync if shopConfig changes
  useEffect(() => {
    setStoreNameInput(shopConfig.storePickupName || 'Munna Grocery & Mobile');
    setStoreAddrInput(shopConfig.storePickupAddress || 'Cinema Hall Road, Niali, Cuttack, PIN - 754004');
    setStorePhoneInput(shopConfig.storePickupPhone || '9040585726');
    setStoreHoursInput(shopConfig.storePickupHours || '10:00 AM - 09:00 PM (Daily)');
  }, [shopConfig]);

  const handleSaveStoreAddress = (e: React.FormEvent) => {
    e.preventDefault();
    updateShopConfig({
      storePickupName: storeNameInput.trim() || 'Munna Grocery & Mobile',
      storePickupAddress: storeAddrInput.trim() || 'Cinema Hall Road, Niali, Cuttack, PIN - 754004',
      storePickupPhone: storePhoneInput.trim() || '9040585726',
      storePickupHours: storeHoursInput.trim() || '10:00 AM - 09:00 PM (Daily)'
    });
    setIsEditingStoreAddr(false);
  };

  const handleResetStoreAddress = () => {
    const defaultName = 'Munna Grocery & Mobile';
    const defaultAddr = 'Cinema Hall Road, Niali, Cuttack, PIN - 754004';
    const defaultPhone = '9040585726';
    const defaultHours = '10:00 AM - 09:00 PM (Daily)';
    setStoreNameInput(defaultName);
    setStoreAddrInput(defaultAddr);
    setStorePhoneInput(defaultPhone);
    setStoreHoursInput(defaultHours);
    updateShopConfig({
      storePickupName: defaultName,
      storePickupAddress: defaultAddr,
      storePickupPhone: defaultPhone,
      storePickupHours: defaultHours
    });
    setIsEditingStoreAddr(false);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setName(sessionUser?.name || '');
    setPhone(sessionUser?.phone || '');
    setAddressText('');
    setIsDefault(addresses.length === 0);
    setShowForm(true);
  };

  const handleEdit = (addr: Address) => {
    setEditingId(addr.id);
    setName(addr.name);
    setPhone(addr.phone);
    setAddressText(addr.address);
    setIsDefault(addr.isDefault);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !addressText.trim()) {
      alert('ଦୟାକରି ଆପଣଙ୍କ ନାମ, ଫୋନ୍ ଏବଂ ଠିକଣା ପୂରଣ କରନ୍ତୁ।');
      return;
    }

    await saveAddress(
      {
        name: name.trim(),
        phone: phone.trim(),
        address: addressText.trim(),
        isDefault
      },
      editingId || undefined
    );

    setShowForm(false);
  };

  const openStoreInGoogleMaps = () => {
    window.open(`https://maps.google.com/?q=${STORE_LAT},${STORE_LNG}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-30 bg-[#f1f3f6] overflow-y-auto">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-[#0c2340] text-white px-4 py-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveScreen('home')}
            className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center cursor-pointer hover:bg-white/25 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div>
            <h3 className="font-extrabold text-sm leading-tight">
              {isEnglish ? 'Delivery & Store Pickup' : 'ଠିକଣା ଓ ଦୋକାନ ପିକଅପ୍'}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refreshAddresses()}
            disabled={isLoadingAddresses || isSavingAddress}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Addresses"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAddresses ? 'animate-spin' : ''}`} />
          </button>
          {!showForm && (
            <button
              onClick={handleOpenAdd}
              className="px-3 py-1.5 rounded-xl bg-[#ffd43b] hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isEnglish ? '+ Add Address' : '+ ଠିକଣା ଯୋଡ଼ନ୍ତୁ'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto p-3.5 pb-28 space-y-4">
        {/* ================= 1. STORE PICKUP CARD (NO NEED TO SAVE ADDRESS) ================= */}
        <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-950 text-white p-4 rounded-3xl border border-emerald-500/30 shadow-lg space-y-3.5">
          {/* Header Badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black flex items-center gap-1.5 text-white">
                  <span>🏪 ଦୋକାନରୁ ସଉଦା ନେବା (Store Pickup)</span>
                </h4>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30 inline-block mt-0.5">
                  ₹0 Free Pickup · କୌଣସି ଠିକଣା ସେଭ୍ କରିବା ଆବଶ୍ୟକ ନାହିଁ
                </span>
              </div>
            </div>
          </div>

          {/* Simple Reassurance Note */}
          <div className="bg-white/10 rounded-2xl p-2.5 text-xs text-slate-200 border border-white/10 leading-snug">
            <p className="font-bold text-white flex items-center gap-1.5 text-[11.5px]">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span>ଠିକଣା ସେଭ୍ କରିବା ଦରକାର ନାହିଁ!</span>
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              ଯଦି ଆପଣ ନିଜେ ଆସି ଦୋକାନରୁ ସଉଦା ନେବେ, ତେବେ କୌଣସି ଠିକଣା ସେଭ୍ ନକରି କାର୍ଟରୁ ସିଧାସଳଖ <b>"Store Pickup"</b> ବାଛି ଅର୍ଡର ଦେଇପାରିବେ।
            </p>
          </div>

          {/* Official Store Address Details (Editable with default upper name Munna Grocery & Mobile) */}
          <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-amber-400 uppercase tracking-wide flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>ଆମ ଦୋକାନ ଠିକଣା (Store Address)</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditingStoreAddr(!isEditingStoreAddr)}
                  className="text-[10px] font-bold text-amber-300 hover:text-amber-200 bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-lg border border-amber-300/30 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                  title="Edit Store Pickup Location"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>{isEditingStoreAddr ? 'Cancel' : 'Edit'}</span>
                </button>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  ନିଆଳି ଷ୍ଟୋର୍
                </span>
              </div>
            </div>

            {/* Editable Form */}
            {isEditingStoreAddr ? (
              <form onSubmit={handleSaveStoreAddress} className="bg-slate-900/95 rounded-xl p-3 border border-amber-400/40 space-y-2.5 mt-2 animate-fadeIn text-left">
                <div>
                  <label className="text-[10px] font-extrabold text-amber-300 block mb-1">
                    Store Name / ଦୋକାନ ନାମ:
                  </label>
                  <input
                    type="text"
                    required
                    value={storeNameInput}
                    onChange={(e) => setStoreNameInput(e.target.value)}
                    placeholder="Munna Grocery & Mobile"
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-800 text-white rounded-lg border border-slate-700 outline-none focus:border-amber-400 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-amber-300 block mb-1">
                    Store Address / ଦୋକାନ ଠିକଣା:
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={storeAddrInput}
                    onChange={(e) => setStoreAddrInput(e.target.value)}
                    placeholder="Cinema Hall Road, Niali, Cuttack, PIN - 754004"
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-800 text-white rounded-lg border border-slate-700 outline-none focus:border-amber-400 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-extrabold text-amber-300 block mb-1">
                      Phone / ଫୋନ୍ ନମ୍ବର:
                    </label>
                    <input
                      type="tel"
                      required
                      value={storePhoneInput}
                      onChange={(e) => setStorePhoneInput(e.target.value)}
                      placeholder="9040585726"
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-800 text-white rounded-lg border border-slate-700 outline-none focus:border-amber-400 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-amber-300 block mb-1">
                      Hours / ସମୟ:
                    </label>
                    <input
                      type="text"
                      value={storeHoursInput}
                      onChange={(e) => setStoreHoursInput(e.target.value)}
                      placeholder="10:00 AM - 09:00 PM"
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-800 text-white rounded-lg border border-slate-700 outline-none focus:border-amber-400 font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={handleResetStoreAddress}
                    className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 text-[10px] font-bold rounded-lg border border-white/15 cursor-pointer"
                    title="Reset to default upper name and address"
                  >
                    Reset Default
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-xs text-slate-200 space-y-1">
                <p className="font-black text-sm text-white">
                  {shopConfig.storePickupName || 'Munna Grocery & Mobile'}
                </p>
                <p className="text-[11.5px] text-slate-300 leading-snug">
                  📍 {shopConfig.storePickupAddress || 'Cinema Hall Road, Niali, Cuttack, PIN - 754004'}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{shopConfig.storePickupHours || '10:00 AM - 09:00 PM (Daily)'}</span>
                  </span>
                  <a
                    href={`tel:${shopConfig.storePickupPhone || '9040585726'}`}
                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>+91 {shopConfig.storePickupPhone || '9040585726'}</span>
                  </a>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={openStoreInGoogleMaps}
              className="w-full mt-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>🗺️ Google Maps ରେ ଦୋକାନ ରାସ୍ତା ଦେଖନ୍ତୁ (Get Directions)</span>
            </button>
          </div>

          {/* 3-Step Clear Indication of How Pickup Works */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-extrabold text-slate-300 block">
              💡 ଦୋକାନ ପିକଅପ୍ କିପରି କାମ କରେ? (How Pickup Works):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-800/60 p-2.5 rounded-2xl border border-slate-700/60">
                <div className="w-6 h-6 rounded-full bg-amber-400/20 text-amber-300 font-black text-xs flex items-center justify-center mb-1">
                  1
                </div>
                <p className="font-extrabold text-white text-[11px]">ଅର୍ଡର ଦିଅନ୍ତୁ</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                  କାର୍ଟରୁ 'Store Pickup' ବାଛି ନାମ ଓ ଫୋନ୍ ଦେଇ କନଫର୍ମ କରନ୍ତୁ (₹0 Free)।
                </p>
              </div>

              <div className="bg-slate-800/60 p-2.5 rounded-2xl border border-slate-700/60">
                <div className="w-6 h-6 rounded-full bg-emerald-400/20 text-emerald-300 font-black text-xs flex items-center justify-center mb-1">
                  2
                </div>
                <p className="font-extrabold text-white text-[11px]">କାଉଣ୍ଟରରେ ପ୍ୟାକ୍</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                  ଆମ ଷ୍ଟାଫ୍ ଆପଣଙ୍କ ସଉଦା କାଉଣ୍ଟରରେ ବ୍ୟାଗ୍‌ରେ ପ୍ୟାକ୍ କରି ପ୍ରସ୍ତୁତ ରଖିବେ।
                </p>
              </div>

              <div className="bg-slate-800/60 p-2.5 rounded-2xl border border-slate-700/60">
                <div className="w-6 h-6 rounded-full bg-blue-400/20 text-blue-300 font-black text-xs flex items-center justify-center mb-1">
                  3
                </div>
                <p className="font-extrabold text-white text-[11px]">ଆସି ସଉଦା ନିଅନ୍ତୁ</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                  ଦୋକାନକୁ ଆସି ଫୋନ୍ ନମ୍ବର କହି ଜିନିଷ ନିଅନ୍ତୁ ଏବଂ Cash/UPI ରେ ଟଙ୍କା ଦିଅନ୍ତୁ!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 2. HOME DELIVERY ADDRESSES ================= */}
        <div className="space-y-3">

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#1864ab]" />
                <span>{isEnglish ? 'Doorstep Delivery Addresses (Within 3 KM)' : '🏠 ଘରେ ଡେଲିଭରୀ ଠିକଣା (୩ କି.ମି. ପରିଧି)'}</span>
              </h4>
              <p className="text-[10.5px] text-slate-500">
                {isEnglish
                  ? 'Only required if you want orders delivered directly to your home'
                  : 'କେବଳ ଘରେ ଡେଲିଭରୀ ଚାହୁଁଥିଲେ ଏଠାରେ ଠିକଣା ସେଭ୍ କରନ୍ତୁ'}
              </p>
            </div>
          </div>

          {/* Form Modal/Card */}
          {showForm && (
            <form
              onSubmit={handleSave}
              className="bg-white p-4 rounded-3xl border-2 border-blue-600/30 shadow-md space-y-3 animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>
                    {editingId
                      ? (isEnglish ? 'Edit Delivery Address' : 'ଡେଲିଭରୀ ଠିକଣା ସଂଶୋଧନ କରନ୍ତୁ')
                      : (isEnglish ? 'Add New Delivery Address' : 'ନୂତନ ଡେଲିଭରୀ ଠିକଣା ଯୋଡ଼ନ୍ତୁ')}
                  </span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold p-1"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                  {isEnglish ? 'Full Name' : 'ଆପଣଙ୍କ ପୂରା ନାମ:'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isEnglish ? 'e.g. Ramesh Chandra' : 'ଉଦାହରଣ: ରମେଶ ଚନ୍ଦ୍ର ସାହୁ'}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-[#1864ab] font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                  {isEnglish ? '10-Digit Phone Number' : '୧୦-ଅଙ୍କର ମୋବାଇଲ୍ ନମ୍ବର:'}
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-[#1864ab] font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                  {isEnglish ? 'Complete Address, Landmark, Niali' : 'ଘର ନମ୍ବର / ଗଳି / ଲ୍ୟାଣ୍ଡମାର୍କ, ନିଆଳି:'}
                </label>
                <textarea
                  rows={2}
                  required
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  placeholder={
                    isEnglish
                      ? 'House No./Street, Near Jagannath Temple, Niali, PIN 754004'
                      : 'ଘର ନମ୍ବର/ରାସ୍ତା, ଜଗନ୍ନାଥ ମନ୍ଦିର ନିକଟ, ନିଆଳି, ପିନ୍ ୭୫୪୦୦୪'
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-[#1864ab] font-medium"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="accent-[#1864ab] w-4 h-4 rounded"
                />
                <span>{isEnglish ? 'Set as primary delivery address' : 'ମୁଖ୍ୟ ଡେଲିଭରୀ ଠିକଣା ଭାବେ ରଖନ୍ତୁ'}</span>
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  {isEnglish ? 'Save Delivery Address' : 'ଠିକଣା ସେଭ୍ କରନ୍ତୁ'}
                </button>
              </div>
            </form>
          )}

          {/* Saved Addresses List */}
          {addresses.length === 0 ? (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center space-y-2 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <MapPin className="w-6 h-6" />
              </div>
              <h5 className="font-extrabold text-xs text-slate-800">
                {isEnglish ? 'No home delivery addresses saved yet' : 'କୌଣସି ଘର ଠିକଣା ସେଭ୍ ହୋଇନାହିଁ'}
              </h5>
              <p className="text-[11px] text-slate-400 leading-snug max-w-xs mx-auto">
                {isEnglish
                  ? 'If you want doorstep delivery in Niali area, add your address. For store pickup, no address is needed.'
                  : 'ଯଦି ଘରେ ଡେଲିଭରୀ ଚାହୁଁଛନ୍ତି ତେବେ ଠିକଣା ଯୋଡ଼ନ୍ତୁ। ଦୋକାନରୁ ନେଉଥିଲେ କୌଣସି ଠିକଣା ଦରକାର ନାହିଁ।'}
              </p>
              <button
                onClick={handleOpenAdd}
                className="mt-1 px-4 py-2 bg-[#1864ab] hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                + {isEnglish ? 'Add Delivery Address' : 'ଠିକଣା ଯୋଡ଼ନ୍ତୁ'}
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`bg-white p-3.5 rounded-2xl border shadow-xs space-y-2 transition-all ${
                    addr.isDefault
                      ? 'border-[#1864ab] ring-1 ring-blue-500/20'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#1864ab]" />
                      <span>{addr.name}</span>
                    </span>
                    {addr.isDefault && (
                      <span className="text-[9.5px] font-black bg-blue-50 text-[#1864ab] border border-blue-200 px-2 py-0.5 rounded-full">
                        PRIMARY
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-snug">{addr.address}</p>
                  <p className="text-[11px] font-bold text-slate-500">📞 {addr.phone}</p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    {!addr.isDefault ? (
                      <button
                        onClick={() => setDefaultAddress(addr.id)}
                        className="text-[#1864ab] font-bold hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>{isEnglish ? 'Set as Default' : 'ମୁଖ୍ୟ ଠିକଣା କରନ୍ତୁ'}</span>
                      </button>
                    ) : (
                      <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>{isEnglish ? 'Default Delivery Address' : 'ମୁଖ୍ୟ ଡେଲିଭରୀ ଠିକଣା'}</span>
                      </span>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleEdit(addr)}
                        className="p-1.5 text-slate-500 hover:text-[#1864ab] rounded-lg hover:bg-slate-50 cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('ଠିକଣା ଡିଲିଟ୍ କରିବାକୁ ଚାହାଁନ୍ତି କି?')) {
                            deleteAddress(addr.id);
                          }
                        }}
                        className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddressScreen;
