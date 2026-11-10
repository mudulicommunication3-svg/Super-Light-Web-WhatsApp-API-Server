import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Banner } from '../../types';
import {
  Image,
  Upload,
  Link,
  Copy,
  Check,
  Download,
  Trash2,
  Plus,
  RefreshCw,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import {
  uploadImageToImgbb,
  saveConfigToSheet,
  pushConfigKeyToSheet
} from '../../services/api';

export const AdminBanners: React.FC = () => {
  const { banners, updateBanners, shopConfig, updateShopConfig, hasUnsavedAdminChanges, setHasUnsavedAdminChanges } = useApp();
  const { isEnglish } = useLanguage();

  // 1. Image Link Generator
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // 2. APK Download Link
  const [apkUrl, setApkUrl] = useState(shopConfig.appDownloadUrl || '/munagrocery.apk');
  const [apkSaving, setApkSaving] = useState(false);
  const [apkStatus, setApkStatus] = useState<string | null>(null);

  // 3. New Banner Form
  const [bannerImg, setBannerImg] = useState('');
  const [bannerTitle, setBannerTitle] = useState('');
  const [isSavingBanners, setIsSavingBanners] = useState(false);

  const handleGenerateLink = async () => {
    if (!imageFile) {
      alert('ପ୍ରଥମେ ଏକ ଫଟୋ ବାଛନ୍ତୁ!');
      return;
    }
    setIsUploading(true);
    try {
      const url = await uploadImageToImgbb(imageFile);
      if (url) {
        setGeneratedUrl(url);
      } else {
        alert('❌ ଅପଲୋଡ୍ ବିଫଳ ହେଲା। ImgBB କୀ ଯାଞ୍ଚ କରନ୍ତୁ।');
      }
    } catch (e: any) {
      alert('❌ ତ୍ରୁଟି: ' + (e?.message || 'Upload error'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleUseForBanner = () => {
    if (!generatedUrl) return;
    setBannerImg(generatedUrl);
  };

  const handleSaveApkLink = async () => {
    if (!apkUrl.trim()) {
      setApkStatus('❌ ପ୍ରଥମେ APK ଲିଙ୍କ୍ ଦିଅନ୍ତୁ!');
      return;
    }
    setApkSaving(true);
    updateShopConfig({ appDownloadUrl: apkUrl.trim() });
    try {
      await pushConfigKeyToSheet('app_download_url', apkUrl.trim());
      setHasUnsavedAdminChanges(false);
      setApkStatus('✅ ଲିଙ୍କ୍ ସେଭ୍ ହେଲା! ସମସ୍ତ ଗ୍ରାହକ ହୋମ୍ ପେଜ୍ ରେ ୨ ମିନିଟ୍ ମଧ୍ୟରେ ନୂଆ ଲିଙ୍କ୍ ପାଇବେ।');
    } catch (e) {
      setApkStatus('⚠️ ଏହି ଫୋନ୍ ରେ ସେଭ୍ ହେଲା।');
    } finally {
      setApkSaving(false);
      setTimeout(() => setApkStatus(null), 4000);
    }
  };

  const handleResetApkLink = () => {
    const defaultUrl = '/munagrocery.apk';
    setApkUrl(defaultUrl);
    updateShopConfig({ appDownloadUrl: defaultUrl });
    setHasUnsavedAdminChanges(true);
    setApkStatus('✅ ଡିଫଲ୍ଟ ଲିଙ୍କ୍ ରେ ଫେରିଗଲା (Staged)।');
    setTimeout(() => setApkStatus(null), 3000);
  };

  const handleAddBanner = async () => {
    if (banners.length >= 5) {
      alert('ସର୍ବାଧିକ ୫ଟି ବ୍ୟାନର୍ ଅନୁମୋଦିତ (Max 5 banners allowed)।');
      return;
    }
    if (!bannerImg.trim() || !bannerTitle.trim()) {
      alert('Image URL ଓ Title ଦିଅନ୍ତୁ!');
      return;
    }
    const newBanner: Banner = {
      id: Date.now(),
      title: bannerTitle.trim(),
      img: bannerImg.trim()
    };
    const updated = [...banners, newBanner];
    updateBanners(updated);
    setBannerImg('');
    setBannerTitle('');
    setIsSavingBanners(true);
    try {
      await pushConfigKeyToSheet('banners', updated);
      setHasUnsavedAdminChanges(false);
    } catch (e) {
      setHasUnsavedAdminChanges(true);
    } finally {
      setIsSavingBanners(false);
    }
  };

  const handleDeleteBanner = async (idx: number) => {
    const updated = banners.filter((_, i) => i !== idx);
    updateBanners(updated);
    setIsSavingBanners(true);
    try {
      await pushConfigKeyToSheet('banners', updated);
      setHasUnsavedAdminChanges(false);
    } catch (e) {
      setHasUnsavedAdminChanges(true);
    } finally {
      setIsSavingBanners(false);
    }
  };

  const handleSaveBannersManual = async () => {
    setIsSavingBanners(true);
    try {
      const res = await pushConfigKeyToSheet('banners', banners);
      if (res) {
        setHasUnsavedAdminChanges(false);
        alert('✅ ବ୍ୟାନର୍ ଗୁଡ଼ିକ Google Sheet ରେ ସେଭ୍ ହୋଇଗଲା!');
      }
    } catch (e) {
      alert('Error saving banners to sheet');
    } finally {
      setIsSavingBanners(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. Image Link Generator */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
        <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
          <Image className="w-4 h-4 text-[#1864ab]" />
          <span>🖼️ Image Link Generator (ମ୍ୟାନୁଆଲ୍ ପ୍ରୋଡକ୍ଟ / ଅଫର୍ ବ୍ୟାନର୍)</span>
        </h4>
        <p className="text-[10px] text-slate-500 leading-snug">
          ଏକ ଫଟୋ ଅପଲୋଡ୍ କରନ୍ତୁ — ସର୍ଭରରେ ସେଭ୍ ହୋଇ ଏକ <b>ସିଧା ଇମେଜ୍ ଲିଙ୍କ୍ (URL)</b> ମିଳିବ, ଯାହା ଉଭୟ ପ୍ରୋଡକ୍ଟ ଓ ବ୍ୟାନର୍ ରେ ବ୍ୟବହାର କରିପାରିବେ।
        </p>
        <div className="flex items-center gap-1.5">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            className="flex-1 text-[10px] text-slate-600 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:bg-blue-50 file:text-[#1864ab] file:font-bold file:text-[10px]"
          />
          <button
            type="button"
            onClick={handleGenerateLink}
            disabled={isUploading}
            className="px-3 py-1.5 bg-[#1864ab] hover:bg-blue-800 text-white text-[11px] font-bold rounded-lg shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Upload className={`w-3.5 h-3.5 ${isUploading ? 'animate-spin' : ''}`} />
            <span>{isUploading ? 'Uploading...' : 'Generate Link'}</span>
          </button>
        </div>

        {generatedUrl && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <img
                src={generatedUrl}
                alt="preview"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                className="w-12 h-12 object-contain bg-white rounded border border-slate-200"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-emerald-600">✅ ଲିଙ୍କ୍ ତିଆରି ହେଲା!</p>
                <p className="text-[9px] text-slate-500">ଲିଙ୍କ୍ କପି କରି ବ୍ୟବହାର କରନ୍ତୁ।</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                readOnly
                value={generatedUrl}
                className="flex-1 text-[10px] px-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-slate-700"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-2.5 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-lg shrink-0 cursor-pointer flex items-center gap-1"
              >
                {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={handleUseForBanner}
                className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg shrink-0 cursor-pointer"
              >
                → Banner
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. App Download Link (Android APK) */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
        <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
          <Download className="w-4 h-4 text-[#1864ab]" />
          <span>📱 App Download Link (Android APK)</span>
        </h4>
        <p className="text-[10px] text-slate-500 leading-snug">
          ହୋମ୍ ପେଜ୍ ର ଡାହାଣ ପାଖରେ "Download App" ବଟନ୍ ଦେଖାଯିବ (କେବଳ ୱେବ୍‌ସାଇଟ୍‌ରେ, ଆପ୍ ଭିତରେ ନୁହେଁ)। ଏଠାରେ ନୂଆ APK ଲିଙ୍କ୍ ପରିବର୍ତ୍ତନ କଲେ ସମସ୍ତଙ୍କ ପାଖରେ ସେହି ଲିଙ୍କ୍ ଦେଖାଯିବ।
        </p>
        <input
          type="text"
          value={apkUrl}
          onChange={(e) => setApkUrl(e.target.value)}
          placeholder="/munagrocery.apk"
          className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#1864ab]"
        />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleSaveApkLink}
            disabled={apkSaving}
            className="flex-1 py-2 bg-[#1864ab] hover:bg-blue-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{apkSaving ? 'Saving...' : 'ସେଭ୍ କରନ୍ତୁ (Update Link)'}</span>
          </button>
          <button
            type="button"
            onClick={handleResetApkLink}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg cursor-pointer"
          >
            Reset
          </button>
        </div>
        {apkStatus && (
          <p className="text-[10px] font-bold text-emerald-600 animate-fadeIn">{apkStatus}</p>
        )}
      </div>

      {/* 3. 5-Slide Promotional Banners Manager */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>📢 ୫-ସ୍ଲାଇଡ୍ ପ୍ରମୋସନ୍ ବ୍ୟାନର୍ ମ୍ୟାନେଜର୍ (Max 5)</span>
          </h4>
          <button
            type="button"
            onClick={handleSaveBannersManual}
            disabled={isSavingBanners}
            className="px-2.5 py-1 bg-[#1864ab] hover:bg-blue-800 text-white text-[10px] font-bold rounded-lg cursor-pointer disabled:opacity-50"
          >
            {isSavingBanners ? 'Saving...' : '💾 Save Banners to Sheet'}
          </button>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
          <span className="text-[10px] font-bold text-emerald-800">
            Shared — ଆପଣ ଯୋଡ଼ିଲେ ସମସ୍ତ ଗ୍ରାହକଙ୍କ ଫୋନ୍ ରେ ଦେଖାଯିବ
          </span>
        </div>

        <input
          type="text"
          value={bannerImg}
          onChange={(e) => setBannerImg(e.target.value)}
          placeholder="Image URL (https://...) — ଉପରର Generator ରୁ ପାଇପାରିବେ"
          className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#1864ab]"
        />
        <input
          type="text"
          value={bannerTitle}
          onChange={(e) => setBannerTitle(e.target.value)}
          placeholder="Banner Title / Offer Text (ଯେପରି Fresh Fruits 50% Off)"
          className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#1864ab]"
        />
        <button
          onClick={handleAddBanner}
          disabled={isSavingBanners}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>{isSavingBanners ? 'Saving to Sheet...' : '+ Add Banner & Save'}</span>
        </button>

        {/* Banners List */}
        <div className="space-y-2 pt-2">
          {banners.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              📢 ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ବ୍ୟାନର୍ ନାହିଁ — ଉପରେ ନୂଆ ବ୍ୟାନର୍ ଯୋଡ଼ନ୍ତୁ।
            </p>
          ) : (
            banners.map((b, idx) => (
              <div
                key={b.id || idx}
                className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <img
                    src={b.img}
                    alt={b.title}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="w-12 h-8 object-cover rounded bg-white border border-slate-200 shrink-0"
                    onError={(e: any) => {
                      e.target.src = '/icon-512.png';
                    }}
                  />
                  <span className="font-bold text-slate-800 line-clamp-1 truncate text-xs">
                    {b.title}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteBanner(idx)}
                  className="text-rose-600 hover:text-rose-800 p-1.5 cursor-pointer rounded-lg hover:bg-rose-50"
                  title="Delete banner"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
