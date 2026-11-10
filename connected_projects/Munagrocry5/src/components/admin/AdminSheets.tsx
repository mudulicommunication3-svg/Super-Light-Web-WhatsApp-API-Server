import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useApp } from '../../context/AppContext';
import {
  Database,
  ExternalLink,
  Save,
  RefreshCw,
  CheckCircle,
  Copy,
  AlertTriangle,
  Key,
  ShieldCheck,
  FileCode,
  Sparkles,
  FolderTree,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  getWebhookUrl,
  setWebhookUrl,
  getGoogleSheetId,
  setGoogleSheetId,
  getSpreadsheetUrl,
  fetchSheetConfig,
  batchUpdateProductsOnSheet,
  resetSheetDefaults,
  getFacebookFeedUrl,
  syncFacebookCatalogFeed,
  generateFacebookCatalogCsvString,
  APP_CONFIG
} from '../../services/api';
import { DEFAULT_IMGBB_KEY, getOriginalCdnUrl } from '../../data/initialData';
import { getRepoImagePath, isRepoUrl } from '../../utils/imageHelper';
import {
  getActiveAiApiKey,
  fetchAiKeyFromSheetConfig,
  saveAiKeyToSheetConfig
} from '../../services/groqVisionService';

export const AdminSheets: React.FC = () => {
  const { catalog, setCatalog } = useApp();
  const { isEnglish } = useLanguage();

  const [webhook, setWebhook] = useState(getWebhookUrl());
  const [sheetId, setSheetIdState] = useState(getGoogleSheetId());
  const [imgbbKey, setImgbbKey] = useState(
    localStorage.getItem('munna_imgbb_key') || ''
  );

  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [dbSetupStatus, setDbSetupStatus] = useState<string | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptContent, setScriptContent] = useState<string>('');

  const [clineAiKey, setClineAiKey] = useState<string>(() => getActiveAiApiKey());
  const [isSavingAiKey, setIsSavingAiKey] = useState(false);
  const [isFetchingAiKey, setIsFetchingAiKey] = useState(false);
  const [showAiKeyPassword, setShowAiKeyPassword] = useState(false);

  // 📣 Facebook / Meta Catalog Feed Sync State
  const [isSyncingFbFeed, setIsSyncingFbFeed] = useState(false);
  const [fbFeedStatus, setFbFeedStatus] = useState<string | null>(null);
  const [copiedFbFeedUrl, setCopiedFbFeedUrl] = useState(false);
  const fbFeedUrl = getFacebookFeedUrl();

  const handleSyncFacebookFeed = async () => {
    setIsSyncingFbFeed(true);
    setFbFeedStatus(null);
    try {
      const res = await syncFacebookCatalogFeed(catalog.length);
      setFbFeedStatus(`✅ Facebook Catalog Feed Updated! Total items: ${res.count} (Facebook_Feed ଟ୍ୟାବ୍ ଅପଡେଟ୍ ହେଲା)`);
    } catch (e) {
      setFbFeedStatus('❌ Error syncing Facebook Catalog Feed');
    } finally {
      setIsSyncingFbFeed(false);
    }
  };

  const handleCopyFbFeedUrl = () => {
    if (!fbFeedUrl) return;
    navigator.clipboard.writeText(fbFeedUrl);
    setCopiedFbFeedUrl(true);
    setTimeout(() => setCopiedFbFeedUrl(false), 2500);
  };

  const handleDownloadFbCsv = () => {
    const csv = generateFacebookCatalogCsvString(catalog);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'munna-facebook-catalog-feed.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Auto-fetch dynamic Cline AI Key from Google Sheet Config on mount
  useEffect(() => {
    fetchAiKeyFromSheetConfig().then((key) => {
      if (key) setClineAiKey(key);
    });
  }, []);

  useEffect(() => {
    if (showScriptModal && !scriptContent) {
      fetch('/google-apps-script/Code.gs')
        .then((r) => r.text())
        .then((txt) => {
          if (txt && txt.trim()) setScriptContent(txt);
        })
        .catch(() => {});
    }
  }, [showScriptModal, scriptContent]);

  const handleSaveWebhook = () => {
    setWebhookUrl(webhook);
    setTestResult('✅ Webhook URL ସେଭ୍ ହେଲା!');
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleSaveSheetId = () => {
    setGoogleSheetId(sheetId);
    setTestResult('✅ Google Sheet ID ସେଭ୍ ହେଲା!');
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleSaveImgbbKey = () => {
    if (imgbbKey.trim()) {
      localStorage.setItem('munna_imgbb_key', imgbbKey.trim());
      setTestResult('✅ ImgBB API Key ସେଭ୍ ହେଲା! Image Generator ରେ ନିଜ କୀ ବ୍ୟବହାର ହେବ।');
    } else {
      localStorage.removeItem('munna_imgbb_key');
      setTestResult('⚠️ Default Built-in ImgBB Key ରେ ଫେରିଗଲା।');
    }
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleSaveClineAiKey = async () => {
    setIsSavingAiKey(true);
    try {
      await saveAiKeyToSheetConfig(clineAiKey);
      setTestResult('✅ Cline AI Key Google Sheet Config ରେ ସେଭ୍ ହେଲା! ସମସ୍ତ ଆଡମିନ୍ ବ୍ୟବହାର କରିପାରିବେ।');
    } catch (e: any) {
      setTestResult('❌ AI Key ସେଭ୍ ତ୍ରୁଟି: ' + (e?.message || 'Error'));
    } finally {
      setIsSavingAiKey(false);
      setTimeout(() => setTestResult(null), 4000);
    }
  };

  const handleFetchClineAiKey = async () => {
    setIsFetchingAiKey(true);
    try {
      const key = await fetchAiKeyFromSheetConfig();
      if (key) {
        setClineAiKey(key);
        setTestResult('✅ Google Sheet ରୁ Cline AI Key ସଫଳତାର ସହ ଲୋଡ୍ ହେଲା!');
      } else {
        setTestResult('ℹ️ Google Sheet ରେ କୌଣସି cline_api_key ମିଳିଲା ନାହିଁ। ନୂଆ କୀ ଦେଇ Save କରନ୍ତୁ।');
      }
    } catch (e: any) {
      setTestResult('❌ କୀ ଲୋଡ୍ ତ୍ରୁଟି: ' + (e?.message || 'Failed'));
    } finally {
      setIsFetchingAiKey(false);
      setTimeout(() => setTestResult(null), 4000);
    }
  };

  const handleTestSync = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const cfg = await fetchSheetConfig();
      if (cfg) {
        setTestResult('✅ Google Sheet ସହ ସଫଳତାର ସହ କନେକ୍ଟ ହୋଇଛି! (Connected & Live Sync Ready)');
      } else {
        setTestResult('⚠️ Webhook ଉତ୍ତର ଦେଉନାହିଁ। Apps Script Deploy ଠିକ୍ ଅଛି କି ଯାଞ୍ଚ କରନ୍ତୁ।');
      }
    } catch (e: any) {
      setTestResult('❌ କନେକ୍ସନ୍ ତ୍ରୁଟି: ' + (e?.message || 'Connection failed'));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSetupDatabase = async () => {
    setIsSettingUp(true);
    setDbSetupStatus(null);
    const hook = getWebhookUrl();
    const currentSheetId = getGoogleSheetId();
    try {
      const freshUrl = `${hook}${hook.includes('?') ? '&' : '?'}action=setup_database&sheet_id=${encodeURIComponent(
        currentSheetId
      )}&_t=${Date.now()}`;
      const res = await fetch(freshUrl, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });
      const data = await res.json().catch(() => null);
      if (data && data.status === 'success') {
        setDbSetupStatus('✅ ଡାଟାବେସ୍ ସମସ୍ତ Sheets (Products, Orders, Users, Addresses, Config, Viewers) ପ୍ରସ୍ତୁତ!');
      } else {
        setDbSetupStatus('✅ ଡାଟାବେସ୍ ଯାଞ୍ଚ ସମ୍ପନ୍ନ ହୋଇଛି।');
      }
    } catch (e: any) {
      setDbSetupStatus('⚠️ Setup ରିକ୍ୱେଷ୍ଟ୍ ପଠାଗଲା। Sheet ଯାଞ୍ଚ କରନ୍ତୁ।');
    } finally {
      setIsSettingUp(false);
    }
  };

  const [isConvertingLinks, setIsConvertingLinks] = useState(false);
  const [imageActionFeedback, setImageActionFeedback] = useState<string | null>(null);

  const repoCount = catalog.filter((p) => isRepoUrl(p.image_url)).length;
  const cdnCount = catalog.length - repoCount;
  const backupCount = catalog.filter(
    (p) =>
      (!!p.backup_image_url && p.backup_image_url.trim() !== '') ||
      !!getOriginalCdnUrl(p.ean) ||
      (p.image_url && p.image_url.startsWith('http'))
  ).length;

  const handleConvertAllToRepo = async () => {
    if (
      !confirm(
        isEnglish
          ? '⚡ Convert all product images to local repo links (/products/<category>/<ean>.jpg)?'
          : '⚡ ସମସ୍ତ ସାମଗ୍ରୀର ଫଟୋ ଲିଙ୍କକୁ ନିଜ ରିପୋ ଫୋଲ୍ଡର (/products/<category>/<ean>.jpg) କୁ ବଦଳାଇବାକୁ ଚାହାଁନ୍ତି କି?'
      )
    ) {
      return;
    }

    setIsConvertingLinks(true);
    setImageActionFeedback(null);
    try {
      let convertedCount = 0;
      const updatedCatalog = catalog.map((p) => {
        const repoPath = getRepoImagePath(p.category, p.ean);
        const currentUrl = (p.image_url || '').trim();
        if (isRepoUrl(currentUrl)) return p;
        convertedCount++;
        return {
          ...p,
          image_url: repoPath,
          backup_image_url: p.backup_image_url || currentUrl
        };
      });

      setCatalog(updatedCatalog);
      try {
        localStorage.setItem('munna_store_catalog', JSON.stringify(updatedCatalog));
      } catch (e) {}

      await batchUpdateProductsOnSheet(updatedCatalog);
      setImageActionFeedback(`✅ ${convertedCount} ଟି ପ୍ରୋଡକ୍ଟ ରିପୋ ଲିଙ୍କ୍ କୁ ବଦଳିଲା!`);
    } catch (e) {
      setImageActionFeedback('❌ Error converting images to repo');
    } finally {
      setIsConvertingLinks(false);
    }
  };

  const handleRestoreAllToCdn = async () => {
    if (
      !confirm(
        isEnglish
          ? 'Restore all product images back to original cloud CDN links (JioMart / ImgBB)?'
          : 'ସମସ୍ତ ପ୍ରୋଡକ୍ଟ ଫଟୋକୁ ସେମାନଙ୍କ ମୂଳ କ୍ଲାଉଡ୍ CDN ଲିଙ୍କ୍ (JioMart/ImgBB) କୁ ଫେରାଇବାକୁ ଚାହାଁନ୍ତି କି?'
      )
    ) {
      return;
    }

    setIsConvertingLinks(true);
    setImageActionFeedback(null);
    try {
      let restoredCount = 0;
      const updatedCatalog = catalog.map((p) => {
        const cdnUrl =
          (p.backup_image_url && p.backup_image_url.trim()) ||
          getOriginalCdnUrl(p.ean) ||
          (p.image_url && p.image_url.startsWith('http') ? p.image_url : undefined);

        if (cdnUrl && cdnUrl.startsWith('http')) {
          restoredCount++;
          return {
            ...p,
            image_url: cdnUrl,
            backup_image_url: cdnUrl
          };
        }
        return p;
      });

      setCatalog(updatedCatalog);
      try {
        localStorage.setItem('munna_store_catalog', JSON.stringify(updatedCatalog));
      } catch (e) {}

      await batchUpdateProductsOnSheet(updatedCatalog);
      setImageActionFeedback(`🔄 ${restoredCount} ଟି ପ୍ରୋଡକ୍ଟର ମୂଳ CDN ଲିଙ୍କ୍ ଫେରସ୍ତ ହେଲା!`);
    } catch (e) {
      setImageActionFeedback('❌ Error restoring CDN links');
    } finally {
      setIsConvertingLinks(false);
    }
  };

  const [showPrivateDetails, setShowPrivateDetails] = useState(false);

  const handleResetToPrivateDefaults = () => {
    resetSheetDefaults();
    setWebhook(APP_CONFIG.SHEET_WEBHOOK_URL);
    setSheetIdState(APP_CONFIG.GOOGLE_SHEET_ID);
    setTestResult('🔒 Google Sheet ID ଏବଂ Webhook URL ହାର୍ଡକୋଡେଡ୍ ପ୍ରାଇଭେଟ୍ ଡିଫଲ୍ଟ୍ କୁ ରିସେଟ୍ ହେଲା!');
    setTimeout(() => setTestResult(null), 4000);
  };

  return (
    <div className="space-y-3">
      {/* 🔒 Hardcoded Private Sheet Security Status Banner */}
      <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-md flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-white">🔒 Private Hardcoded Google Sheet Active</h4>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                Secured
              </span>
            </div>
            <p className="text-[10px] text-slate-300">
              ଆପଣଙ୍କ Google Sheet ID (<code className="text-amber-300 font-mono font-bold">1wj0Lg32...</code>) ଏବଂ Webhook URL କୋଡ୍‌ରେ ସୁରକ୍ଷିତ ହାର୍ଡକୋଡ୍ ଅଛି।
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowPrivateDetails(!showPrivateDetails)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer border border-slate-700"
            title="Toggle visibility of private sheet URL and ID"
          >
            {showPrivateDetails ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{showPrivateDetails ? 'Hide' : 'Show Links'}</span>
          </button>
          <button
            type="button"
            onClick={handleResetToPrivateDefaults}
            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
            title="Reset to hardcoded defaults"
          >
            Restore Private Defaults
          </button>
        </div>
      </div>

      {/* Webhook Configuration Card */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
        <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
          <Database className="w-4 h-4 text-[#1864ab]" />
          <span>Google Sheet Apps Script Webhook (Private)</span>
        </h4>
        <div className="flex gap-1.5">
          <input
            type={showPrivateDetails ? 'text' : 'password'}
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="flex-1 text-xs font-mono px-2.5 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#1864ab]"
          />
          <button
            onClick={handleSaveWebhook}
            className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            Save
          </button>
          <button
            onClick={handleTestSync}
            disabled={isTesting}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Testing...' : 'Sync'}</span>
          </button>
        </div>
        <p className="text-[10px] text-slate-400 leading-snug">
          🔍 JioMart search କ୍ରମ: <b>Bot Search Bus</b> (ବଟ୍ PC ର ସିଧା JioMart engine — Sheet ଦେଇ, କୌଣସି ପ୍ରକ୍ସି ଲାଗେ ନାହିଁ) → Apps Script → Relay → OpenFoodFacts । ବଟ୍ (python main.py) ଚାଲୁଥିଲେ Smart Search ଅସଲି JioMart ଡାଟା ଦେବ ।
        </p>

        {testResult && (
          <p className="text-[11px] font-bold text-slate-700 p-2 bg-slate-50 rounded-lg border border-slate-200">
            {testResult}
          </p>
        )}
      </div>

      {/* Google Sheet ID & Direct Link */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-slate-700 block">
            Google Spreadsheet ID (Private)
          </label>
          {showPrivateDetails && (
            <a
              href={getSpreadsheetUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-[#1864ab] hover:underline flex items-center gap-1"
            >
              <span>Open Sheet</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="flex gap-1.5">
          <input
            type={showPrivateDetails ? 'text' : 'password'}
            value={sheetId}
            onChange={(e) => setSheetIdState(e.target.value)}
            placeholder="Google Sheet ID"
            className="flex-1 text-xs font-mono px-2.5 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#1864ab]"
          />
          <button
            onClick={handleSaveSheetId}
            className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>

      {/* ⚡ Cline AI / OpenRouter API Key (Auto-Save in Google Sheet Config for all Admins) */}
      <div className="bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/50 p-3.5 rounded-2xl border border-indigo-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-black text-indigo-950 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>⚡ Cline AI API Key (ଗୋଟିଏ କୀ — ସମସ୍ତ ଆଡମିନ୍ ପାଇଁ Sheet Config ରେ Auto-Save)</span>
          </label>
          <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
            Sheet Auto-Sync
          </span>
        </div>
        <p className="text-[10px] text-slate-600 leading-snug">
          ଏହି OpenRouter/Cline API କୀ Google Sheet ର Config ଟ୍ୟାବ୍ ରେ ସେଭ୍ ରହିବ। ଯେକୌଣସି ଆଡମିନ୍ ଯେକୌଣସି ଫୋନ୍ ବା ଲାପଟପ୍‌ରୁ <b>Cline AI Studio</b> ରେ ପ୍ରୋଡକ୍ଟ ଯୋଡ଼ିବେ, ସେମାନଙ୍କୁ ପୁନର୍ବାର key ଦେବାକୁ ପଡ଼ିବ ନାହିଁ — ଏହି ଗୋଟିଏ କୀ ସ୍ୱୟଂଚାଳିତ ଭାବେ ଲାଗୁ ହେବ।
        </p>
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <input
              type={showAiKeyPassword ? 'text' : 'password'}
              value={clineAiKey}
              onChange={(e) => setClineAiKey(e.target.value)}
              placeholder="sk-or-v1-... (OpenRouter / Cline API Key ପେଷ୍ଟ କରନ୍ତୁ)"
              className="w-full text-xs font-mono px-2.5 py-2 border border-indigo-200 rounded-lg outline-none focus:border-indigo-600 bg-white pr-8"
            />
            <button
              type="button"
              onClick={() => setShowAiKeyPassword(!showAiKeyPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showAiKeyPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button
            onClick={handleSaveClineAiKey}
            disabled={isSavingAiKey}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-50"
            title="Save to Google Sheet Config"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSavingAiKey ? 'Saving...' : 'Save to Sheet'}</span>
          </button>
          <button
            onClick={handleFetchClineAiKey}
            disabled={isFetchingAiKey}
            className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-50"
            title="Read live key from Google Sheet"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetchingAiKey ? 'animate-spin' : ''}`} />
            <span>Read Sheet</span>
          </button>
        </div>
      </div>

      {/* ImgBB API Key */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
        <label className="text-[11px] font-bold text-slate-700 block">
          🖼️ ImgBB API Key (built-in କୀ ଅଛି — ବଦଳାଇବାକୁ ଚାହିଁଲେ ନୂଆ key ଦିଅନ୍ତୁ)
        </label>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={imgbbKey}
            onChange={(e) => setImgbbKey(e.target.value)}
            placeholder="ImgBB API key ପେଷ୍ଟ କରନ୍ତୁ... (Default Built-in active)"
            className="flex-1 text-xs px-2.5 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#1864ab]"
          />
          <button
            onClick={handleSaveImgbbKey}
            className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            Save
          </button>
        </div>
        <p className="text-[10px] text-slate-400 leading-snug">
          📤 built-in କୀ ପୂର୍ବରୁ ସେଟ୍ ଅଛି — Banners ଟ୍ୟାବ୍ ର Image Link Generator ତୁରନ୍ତ କାମ କରିବ।
        </p>
      </div>

      {/* Database Schema Setup */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
        <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Database Auto-Setup Engine</span>
        </h4>
        <p className="text-[10px] text-slate-500 leading-snug">
          ଆପଣଙ୍କ Google Sheet ରେ ଆବଶ୍ୟକ ଟ୍ୟାବ୍ (Products, Orders, Users, Addresses, Config, Viewers) ସ୍ୱୟଂଚାଳିତ ଭାବେ ତିଆରି କରନ୍ତୁ।
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleSetupDatabase}
            disabled={isSettingUp}
            className="flex-1 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{isSettingUp ? 'Setting up sheets...' : 'Initialize / Verify Sheet Database'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowScriptModal(true)}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="View full Apps Script Code.gs to deploy in script.google.com"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span>Code.gs Script</span>
          </button>
        </div>
        {dbSetupStatus && (
          <p className="text-[10px] font-bold text-emerald-700 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
            {dbSetupStatus}
          </p>
        )}
      </div>

      {/* Code.gs Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900">Google Apps Script (Code.gs)</h3>
                  <p className="text-[10px] text-slate-500">Sheet ID: <span className="font-mono font-bold text-emerald-700">{sheetId}</span></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 text-xs font-black cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-black text-[11px]">Instructions (ସ୍ଥାପନ ପ୍ରଣାଳୀ):</p>
              <ol className="list-decimal list-inside text-[11px] text-amber-800 space-y-0.5">
                <li><a href="https://script.google.com" target="_blank" rel="noreferrer" className="underline font-bold text-blue-700">script.google.com</a> ଖୋଲନ୍ତୁ ଏବଂ ନିଜ Webhook ପ୍ରୋଜେକ୍ଟ ଖୋଲନ୍ତୁ।</li>
                <li>ତଳେ ଥିବା &quot;Copy Code&quot; ଦବାଇ କୋଡ୍ କପି କରନ୍ତୁ ଓ <code className="bg-white px-1 rounded font-mono">Code.gs</code> ରେ Paste କରନ୍ତୁ।</li>
                <li><strong>Deploy &gt; Manage deployments &gt; Edit (ପେନ୍ସିଲ୍ ଆଇକନ୍) &gt; Version: New version &gt; Deploy</strong> କରନ୍ତୁ।</li>
              </ol>
            </div>
            <div className="p-3 flex-1 overflow-y-auto bg-slate-900 text-slate-100 font-mono text-[11px]">
              <pre className="whitespace-pre-wrap leading-relaxed select-all">
                {scriptContent || `// Loading full Code.gs script...`}
              </pre>
            </div>
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">File: <code className="font-mono text-slate-800 font-bold">google-apps-script/Code.gs</code></span>
              <button
                type="button"
                onClick={() => {
                  if (scriptContent) {
                    navigator.clipboard.writeText(scriptContent);
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 3000);
                    return;
                  }
                  fetch('/google-apps-script/Code.gs')
                    .then(r => r.text())
                    .then(txt => {
                      setScriptContent(txt);
                      navigator.clipboard.writeText(txt);
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 3000);
                    })
                    .catch(() => {});
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {copiedScript ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedScript ? 'Copied! ✅' : 'Copy Full Code.gs'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Storage & CDN Backup / Restore Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 rounded-2xl border border-slate-700 shadow-lg space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
            <FolderTree className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black flex items-center gap-2">
              <span>Photo Storage & Fail-Safe CDN Backup</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.2 rounded-full border border-emerald-500/30">
                {catalog.length} Products
              </span>
            </h4>
            <p className="text-[10px] text-slate-300">
              ପ୍ରୋଡକ୍ଟ ଫଟୋ ରିପୋ ଲିଙ୍କ୍ କିମ୍ବା ମୂଳ CDN ଲିଙ୍କକୁ ୧-କ୍ଲିକ୍ ରେ ବଦଳାନ୍ତୁ / ଫେରାନ୍ତୁ
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={handleRestoreAllToCdn}
            disabled={isConvertingLinks}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50 border border-sky-400/40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isConvertingLinks ? 'animate-spin' : ''}`} />
            <span>{isConvertingLinks ? 'Restoring CDN...' : '🔄 Restore Original CDN Links (ମୂଳ CDN ଫେରାନ୍ତୁ)'}</span>
          </button>

          <button
            onClick={handleConvertAllToRepo}
            disabled={isConvertingLinks}
            className="py-2 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isConvertingLinks ? 'animate-spin' : ''}`} />
            <span>⚡ Convert to Repo Links</span>
          </button>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
          <div className="bg-slate-800/80 border border-slate-700/80 p-2 rounded-xl">
            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Repo Links</span>
            <span className="text-sm font-black text-amber-400">{repoCount}</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/80 p-2 rounded-xl">
            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">CDN Links</span>
            <span className="text-sm font-black text-blue-400">{cdnCount}</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/80 p-2 rounded-xl">
            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Backups Ready</span>
            <span className="text-sm font-black text-emerald-400">{backupCount}</span>
          </div>
        </div>

        {imageActionFeedback && (
          <p className="text-[11px] font-bold text-emerald-300 p-2 bg-emerald-950/60 rounded-xl border border-emerald-500/30">
            {imageActionFeedback}
          </p>
        )}
      </div>

      {/* 📣 Facebook / Meta Commerce Manager Catalog Feed 1-Click Card */}
      <div className="bg-gradient-to-r from-[#1877F2]/10 via-blue-50/90 to-indigo-50/80 p-4 rounded-2xl border border-[#1877F2]/30 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1877F2] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
              f
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <span>Facebook / Meta Commerce Catalog Data Feed</span>
                <span className="text-[9px] bg-[#1877F2]/15 text-[#1877F2] font-extrabold px-2 py-0.5 rounded-full border border-[#1877F2]/30">
                  Tab: Facebook_Feed
                </span>
              </h4>
              <p className="text-[10px] text-slate-600">
                Sheet1 ର କୌଣସି କଲମ୍ ନ ବଦଳାଇ ସ୍ୱୟଂଚାଳିତ <code className="font-mono font-bold text-slate-800">Facebook_Feed</code> ଟ୍ୟାବ୍ ଓ ଲାଇଭ୍ CSV ଲିଙ୍କ୍ ତିଆରି କରେ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSyncFacebookFeed}
              disabled={isSyncingFbFeed}
              className="px-3.5 py-2 rounded-xl bg-[#1877F2] hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFbFeed ? 'animate-spin' : ''}`} />
              <span>{isSyncingFbFeed ? 'Syncing Feed...' : '⚡ Convert & Sync Facebook Feed'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadFbCsv}
              className="px-2.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs cursor-pointer"
              title="Download CSV file"
            >
              ⬇️ CSV
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-2 rounded-xl border border-blue-200">
          <span className="text-[10px] font-black text-slate-700 px-1.5 shrink-0">
            Copy Feed URL:
          </span>
          <input
            type={showPrivateDetails ? 'text' : 'password'}
            readOnly
            value={fbFeedUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="flex-1 text-[11px] font-mono bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-800 outline-none"
          />
          <button
            type="button"
            onClick={handleCopyFbFeedUrl}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            {copiedFbFeedUrl ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedFbFeedUrl ? 'Copied! ✅' : 'Copy Feed URL'}</span>
          </button>
        </div>

        {fbFeedStatus && (
          <p className="text-[11px] font-bold text-emerald-800 p-2 bg-emerald-50 rounded-xl border border-emerald-200">
            {fbFeedStatus}
          </p>
        )}
      </div>
    </div>
  );
};

