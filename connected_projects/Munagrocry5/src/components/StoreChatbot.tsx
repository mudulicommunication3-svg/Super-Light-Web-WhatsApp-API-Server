import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Zap,
  Brain,
  Trash2,
  ShoppingBag,
  Loader2,
  Move,
  Plus,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { Product, parseProductStock } from '../types';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  timestamp: string;
}

type ChatMode = 'fast' | 'general' | 'complex';

const STORAGE_KEY = 'munna_store_gemini_chat_v2';
const POS_STORAGE_KEY = 'munna_store_ai_btn_pos_v1';

const CLOUD_API_ENDPOINTS = [
  '/api/gemini/chat',
  'https://ais-dev-7ocoatuisr74c7neux4ywv-345736644359.asia-northeast1.run.app/api/gemini/chat',
  'https://ais-pre-7ocoatuisr74c7neux4ywv-345736644359.asia-northeast1.run.app/api/gemini/chat',
];

export const StoreChatbot: React.FC = () => {
  const { catalog, shopConfig, cart, setQty, setSelectedProduct } = useApp();
  const { isEnglish } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>('general');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Draggable floating button position (null = smart default docked on left edge above cart bar)
  const [customPos, setCustomPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const raw = localStorage.getItem(POS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const dragRef = useRef<{
    isDragging: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({
    isDragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    origX: 12,
    origY: 140,
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'welcome-1',
        role: 'model',
        text: 'ନମସ୍କାର! 🙏 ମୁଁ **Munna Mobile & Grocery** ର AI ସହାୟକ।\nଆପଣ ଦୋକାନର କୌଣସି ସାମଗ୍ରୀର **ଦାମ୍ (Price), ଷ୍ଟକ୍ (Stock), ଅଫର୍** କିମ୍ବା **ଡେଲିଭରି** ବିଷୟରେ ଓଡ଼ିଆ କିମ୍ବା ଇଂରାଜୀରେ ପଚାରିପାରିବେ!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen to Header / Search Bar AI button click
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 120);
    };
    window.addEventListener('open-munna-ai-chat', handleOpen);
    return () => window.removeEventListener('open-munna-ai-chat', handleOpen);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    }
  }, [messages, isOpen, isLoading]);

  // Calculate total items in cart accurately from Record<string, number>
  const totalCartItems = useMemo(() => {
    if (!cart || typeof cart !== 'object') return 0;
    return Object.values(cart).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
  }, [cart]);

  // Build live catalog context from AppContext (never hardcoded)
  const liveStoreContext = useMemo(() => {
    const storeHeader = [
      `Store Name: ${shopConfig.storeName || 'Munna Mobile & Grocery'}`,
      `Address: ${shopConfig.storePickupAddress || 'Cinema Hall Road, Niali, 754004'}`,
      `Phone / WhatsApp: ${shopConfig.storePickupPhone || '9040585726'}`,
      `Delivery Timing / Slot: ${shopConfig.deliverySlot || '20 mins'} (${shopConfig.deliveryDay || 'Today'})`,
      `Free Delivery Minimum Order: Rs.${shopConfig.freeAbove ?? 300}`,
      `Delivery Radius: 3 KM`,
      `Delivery Charge (below min order): Rs.${shopConfig.deliveryFee ?? 25}`,
      shopConfig.couponCode
        ? `Active Coupon: ${shopConfig.couponCode} (${shopConfig.couponPercent}% OFF above Rs.${shopConfig.couponMinBill})`
        : '',
      `Total Products in Live Catalog: ${catalog.length}`,
      '',
      'LIVE PRODUCTS LIST (Name | Category | Selling Price | MRP | Stock | EAN):',
    ].filter(Boolean);

    const productLines = catalog.map((p) => {
      const sp = Number(p.selling_price) || 0;
      const mrp = Number(p.mrp) || sp;
      const stock = parseProductStock(p.stock_qty);
      return `- ${p.product_name} | Cat: ${p.category || 'General'} | SP: Rs.${sp} | MRP: Rs.${mrp} | Stock: ${
        stock > 0 ? `${stock} left` : 'OUT OF STOCK (0)'
      } | EAN: ${p.ean}`;
    });

    return [...storeHeader, ...productLines].join('\n');
  }, [catalog, shopConfig]);

  // Smart Live Catalog Answer Engine (Guaranteed zero-error instant reply using live Google Sheet data if server API is unreachable on static domain/APK)
  const generateLiveCatalogFallbackReply = (query: string): string => {
    const q = query.toLowerCase().trim();
    const inStockItems = catalog.filter((p) => parseProductStock(p.stock_qty) > 0);

    const formatItemLine = (p: Product) => {
      const sp = Number(p.selling_price) || 0;
      const mrp = Number(p.mrp) || sp;
      const stock = parseProductStock(p.stock_qty);
      const disc = mrp > sp ? Math.round(((mrp - sp) / mrp) * 100) : 0;
      const discStr = disc > 0 ? ` (${disc}% OFF, MRP ₹${mrp})` : '';
      return `• **${p.product_name}** — **₹${sp}**${discStr} • ଷ୍ଟକ୍: ${stock} left`;
    };

    // 1. Delivery / Timing / Minimum Order queries
    if (
      q.includes('delivery') ||
      q.includes('ଡେଲିଭରି') ||
      q.includes('minimum') ||
      q.includes('time') ||
      q.includes('ସମୟ') ||
      q.includes('charge')
    ) {
      const slot = shopConfig.deliverySlot || '2 hours';
      const day = shopConfig.deliveryDay === 'Tomorrow' ? 'Tomorrow (ଆସନ୍ତାକାଲି)' : 'Today (ଆଜି)';
      const freeAbove = shopConfig.freeAbove ?? 300;
      const fee = shopConfig.deliveryFee ?? 25;
      const addr = shopConfig.storePickupAddress || 'Cinema Hall Road, Niali (754004)';

      return isEnglish
        ? `🚚 **Munna Grocery Delivery Info:**\n• **Delivery Time:** ${day} · ${slot}\n• **Free Delivery:** On orders above **₹${freeAbove}** (within 3 KM of Niali)\n• **Delivery Charge:** ₹${fee} for orders below ₹${freeAbove}\n• **Store Pickup:** Free at ${addr}`
        : `🚚 **ମୁନ୍ନା ଗ୍ରୋସରୀ ଡେଲିଭରି ନିୟମ:**\n• **ଡେଲିଭରି ସମୟ:** ${day} · **${slot}**\n• **ଫ୍ରି ଡେଲିଭରି:** ₹${freeAbove} କିମ୍ବା ତା’ଠାରୁ ଅଧିକ ଅର୍ଡରରେ **ମାଗଣା ଡେଲିଭରି** (3 KM ଭିତରେ)\n• **ଡେଲିଭରି ଚାର୍ଜ:** ₹${freeAbove} ରୁ କମ୍ ଅର୍ଡରରେ ₹${fee}\n• **ଦୋକାନ ଠିକଣା:** ${addr}`;
    }

    // 2. Best Discount Offers queries
    if (
      q.includes('best discount') ||
      q.includes('best offer') ||
      q.includes('top offer') ||
      q.includes('ଅଫର୍') ||
      q.includes('ଡିସକାଉଣ୍ଟ') ||
      q.includes('offer')
    ) {
      const topDeals = [...inStockItems]
        .sort((a, b) => {
          const spA = Number(a.selling_price) || 0;
          const mrpA = Number(a.mrp) || spA;
          const spB = Number(b.selling_price) || 0;
          const mrpB = Number(b.mrp) || spB;
          const pctA = mrpA > spA ? (mrpA - spA) / mrpA : 0;
          const pctB = mrpB > spB ? (mrpB - spB) / mrpB : 0;
          return pctB - pctA;
        })
        .slice(0, 8);

      const header = isEnglish
        ? `🔥 **Top In-Stock Discount Offers at Munna Grocery:**`
        : `🔥 **ଦୋକାନରେ ଏବେ ଥିବା ସବୁଠାରୁ ବଡ଼ ଡିସକାଉଣ୍ଟ ଅଫର୍ (In-Stock):**`;
      return `${header}\n\n${topDeals.map(formatItemLine).join('\n')}`;
    }

    // 3. Cooking Oils & Mustard Oils queries
    if (
      q.includes('cooking oil') ||
      q.includes('mustard oil') ||
      q.includes('sunflower') ||
      q.includes('rice bran') ||
      q.includes('ତେଲ') ||
      q.includes('ସୋରିଷ') ||
      (q.includes('oil') && !q.includes('hair'))
    ) {
      const oils = inStockItems.filter((p) => {
        const text = `${p.product_name} ${p.category}`.toLowerCase();
        return (
          !text.includes('hair') &&
          !text.includes('coconut') &&
          !text.includes('jasmine') &&
          (text.includes('oil') ||
            text.includes('mustard') ||
            text.includes('sunflower') ||
            text.includes('rice bran') ||
            text.includes('ghee'))
        );
      });

      if (oils.length > 0) {
        const header = isEnglish
          ? `🛢️ **In-Stock Cooking & Mustard Oils (${oils.length} items):**`
          : `🛢️ **ଦୋକାନରେ ଷ୍ଟକ୍ ଥିବା ସୋରିଷ ଓ ରିଫାଇନ୍ ତେଲ (${oils.length} ଟି):**`;
        return `${header}\n\n${oils.map(formatItemLine).join('\n')}`;
      }
    }

    // 4. Atta, Sugar & Spices / Masalas queries
    if (
      q.includes('atta') ||
      q.includes('sugar') ||
      q.includes('masala') ||
      q.includes('spice') ||
      q.includes('ଅଟା') ||
      q.includes('ଚିନି') ||
      q.includes('ମସଲା') ||
      q.includes('biryani') ||
      q.includes('ବିରିୟାନୀ')
    ) {
      const essentials = inStockItems.filter((p) => {
        const text = `${p.product_name} ${p.category}`.toLowerCase();
        return (
          text.includes('atta') ||
          text.includes('maida') ||
          text.includes('starch') ||
          text.includes('sugar') ||
          text.includes('masala') ||
          text.includes('spice') ||
          text.includes('turmeric') ||
          text.includes('curry')
        );
      });

      if (essentials.length > 0) {
        const header = isEnglish
          ? `🌾 **In-Stock Atta, Sugar & Spices (${essentials.length} items):**`
          : `🌾 **ଦୋକାନରେ ଷ୍ଟକ୍ ଥିବା ଅଟା, ଚିନି ଏବଂ ମସଲା (${essentials.length} ଟି):**`;
        return `${header}\n\n${essentials.map(formatItemLine).join('\n')}`;
      }
    }

    // 5. General keyword search across live catalog
    const stopWords = new Set([
      'what',
      'are',
      'the',
      'show',
      'all',
      'with',
      'their',
      'prices',
      'price',
      'stock',
      'available',
      'right',
      'now',
      'in-stock',
      'instock',
      'please',
      'tell',
      'me',
      'and',
      'for',
      'ଦାମ୍',
      'କେତେ',
      'ଷ୍ଟକ୍',
      'ଅଛି',
      'କି',
    ]);
    const keywords = q
      .replace(/[?.,!]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !stopWords.has(w));

    if (keywords.length > 0) {
      const matched = catalog.filter((p) => {
        const text = `${p.product_name} ${p.category} ${p.ean}`.toLowerCase();
        return keywords.some((kw) => text.includes(kw));
      });

      const inStockMatched = matched.filter((p) => parseProductStock(p.stock_qty) > 0);
      const outStockMatched = matched.filter((p) => parseProductStock(p.stock_qty) <= 0);

      if (inStockMatched.length > 0 || outStockMatched.length > 0) {
        const lines: string[] = [];
        if (inStockMatched.length > 0) {
          lines.push(
            isEnglish
              ? `✅ **Available In Stock (${inStockMatched.length}):**`
              : `✅ **ଦୋକାନରେ ଷ୍ଟକ୍ ଅଛି (${inStockMatched.length} ଟି):**`
          );
          lines.push(...inStockMatched.slice(0, 8).map(formatItemLine));
        }
        if (outStockMatched.length > 0 && inStockMatched.length < 5) {
          lines.push(
            isEnglish
              ? `\n❌ **Currently Out of Stock:**`
              : `\n❌ **ବର୍ତ୍ତମାନ ଷ୍ଟକ୍ ନାହିଁ (Out of Stock):**`
          );
          lines.push(
            ...outStockMatched
              .slice(0, 4)
              .map((p) => `• ${p.product_name} (₹${p.selling_price}) — *Out of Stock*`)
          );
        }
        return lines.join('\n');
      }
    }

    // 6. Default helpful summary with top in-stock items
    const sampleItems = inStockItems.slice(0, 6).map(formatItemLine).join('\n');
    return isEnglish
      ? `🙏 Welcome to **Munna Mobile & Grocery**! We currently have **${inStockItems.length} products in stock** ready for delivery (${shopConfig.deliverySlot || '2 hours'}).\n\n**Popular In-Stock Items:**\n${sampleItems}\n\nAsk me about any item name (e.g. *Aashirvaad Atta, Mustard Oil, Biscuits, Surf Excel, Spices*)!`
      : `🙏 **ମୁନ୍ନା ମୋବାଇଲ୍ ଆଣ୍ଡ ଗ୍ରୋସରୀ** କୁ ସ୍ୱାଗତ! ବର୍ତ୍ତମାନ ଦୋକାନରେ **${inStockItems.length} ଟି ସାମଗ୍ରୀ ଷ୍ଟକ୍ ଅଛି**।\n\n**କିଛି ପ୍ରମୁଖ ସାମଗ୍ରୀ:**\n${sampleItems}\n\nଆପଣ ଯେକୌଣସି ସାମଗ୍ରୀର ନାମ (ଯଥା: *Atta, Oil, Biscuit, Surf Excel, Masala*) ଲେଖି ଦାମ୍ ପଚାରିପାରିବେ!`;
  };

  const quickPrompts = [
    {
      label: isEnglish ? '🔥 Best Offers' : '🔥 ଆଜିର ବେଷ୍ଟ ଅଫର୍',
      prompt: isEnglish
        ? 'What are the best discount offers currently in stock?'
        : 'ଦୋକାନରେ ଏବେ ସବୁଠାରୁ ଭଲ ଡିସକାଉଣ୍ଟ ଅଫର୍ କ’ଣ କ’ଣ ଷ୍ଟକ୍ ଅଛି?',
    },
    {
      label: isEnglish ? '🛢️ Cooking Oil Price' : '🛢️ ସୋରିଷ ଓ ରିଫାଇନ୍ ତେଲ ଦାମ୍',
      prompt: isEnglish
        ? 'Show me all in-stock cooking oils and mustard oils with their prices.'
        : 'ଦୋକାନରେ କେଉଁ କେଉଁ ସୋରିଷ ତେଲ ଓ ରିଫାଇନ୍ ତେଲ ଷ୍ଟକ୍ ଅଛି ଏବଂ ଦାମ୍ କେତେ?',
    },
    {
      label: isEnglish ? '🌾 Atta, Sugar & Spices' : '🌾 ଅଟା, ଚିନି ଓ ମସଲା',
      prompt: isEnglish
        ? 'What Atta, Sugar, and Masalas are available in stock right now?'
        : 'ଆଶୀର୍ବାଦ ଅଟା, ଚିନି ଏବଂ ମସଲା କ’ଣ କ’ଣ ଷ୍ଟକ୍ ଅଛି ଓ ଦାମ୍ କେତେ?',
    },
    {
      label: isEnglish ? '🚚 Delivery Rules' : '🚚 ଡେଲିଭରି ନିୟମ ଓ ସମୟ',
      prompt: isEnglish
        ? 'What is the delivery time, minimum order for free delivery, and delivery area?'
        : 'ଡେଲିଭରି କେତେ ସମୟରେ ହୁଏ ଏବଂ ଫ୍ରି ଡେଲିଭରି ପାଇଁ କେତେ ଟଙ୍କାର ଅର୍ଡର କରିବାକୁ ପଡ଼ିବ?',
    },
  ];

  const sendMessage = async (textToSend?: string) => {
    const trimmed = (textToSend ?? input).trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const historyForApi = messages
      .filter((m) => m.id !== 'welcome-1')
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    let replyText = '';
    let usedModel = mode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-3.8-flash';

    for (const endpoint of CLOUD_API_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 9000);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            history: historyForApi,
            mode,
            storeContext: liveStoreContext,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.ok) {
          const data = await response.json();
          if (data && typeof data.reply === 'string' && data.reply.trim()) {
            replyText = data.reply.trim();
            usedModel = data.model || usedModel;
            break;
          }
        }
      } catch {
        // Try next endpoint or fallback to live catalog engine
      }
    }

    if (!replyText) {
      replyText = generateLiveCatalogFallbackReply(trimmed);
    }

    const botMsg: ChatMessage = {
      id: `model-${Date.now()}`,
      role: 'model',
      text: replyText,
      modelUsed: usedModel,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, botMsg]);
    setIsLoading(false);
  };

  const clearChat = () => {
    const resetMsg: ChatMessage = {
      id: 'welcome-1',
      role: 'model',
      text: 'ନମସ୍କାର! 🙏 ମୁଁ **Munna Mobile & Grocery** ର AI ସହାୟକ।\nଆପଣ ଦୋକାନର କୌଣସି ସାମଗ୍ରୀର **ଦାମ୍ (Price), ଷ୍ଟକ୍ (Stock), ଅଫର୍** କିମ୍ବା **ଡେଲିଭରି** ବିଷୟରେ ଓଡ଼ିଆ କିମ୍ବା ଇଂରାଜୀରେ ପଚାରିପାରିବେ!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([resetMsg]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  // Find up to 4 matching IN-STOCK products from the latest conversation turn so customer can View or +ADD directly
  const suggestedCatalogProducts = useMemo(() => {
    if (messages.length <= 1) return [];
    const lastTwoText = messages
      .slice(-2)
      .map((m) => m.text.toLowerCase())
      .join(' ');

    const matched = catalog.filter((p) => {
      const stock = parseProductStock(p.stock_qty);
      if (stock <= 0) return false; // Only suggest in-stock products!
      const name = (p.product_name || '').toLowerCase();
      if (name.length < 4) return false;
      const words = name.split(/\s+/).filter((w) => w.length >= 4);
      return (
        lastTwoText.includes(name) ||
        (words.length >= 2 && words.slice(0, 2).every((w) => lastTwoText.includes(w)))
      );
    });

    return matched.slice(0, 4);
  }, [messages, catalog]);

  // Touch & Mouse Drag Handlers for movable floating AI button
  const handlePointerDown = (clientX: number, clientY: number, currentEl: HTMLElement) => {
    const rect = currentEl.getBoundingClientRect();
    dragRef.current = {
      isDragging: true,
      moved: false,
      startX: clientX,
      startY: clientY,
      origX: rect.left,
      origY: rect.top,
    };
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!dragRef.current.isDragging) return;
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      dragRef.current.moved = true;
      const maxX = Math.max(0, window.innerWidth - 105);
      const maxY = Math.max(60, window.innerHeight - 135);
      const nextX = Math.min(maxX, Math.max(6, dragRef.current.origX + dx));
      const nextY = Math.min(maxY, Math.max(56, dragRef.current.origY + dy));
      setCustomPos({ x: Math.round(nextX), y: Math.round(nextY) });
    }
  };

  const handlePointerUp = () => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;
    if (dragRef.current.moved && customPos) {
      try {
        localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(customPos));
      } catch {}
    }
  };

  // Smart default position: docked cleanly on left side above FloatingCartBar & BottomNav (and never over right-side ADD buttons)
  const defaultBottomPx = totalCartItems > 0 ? 132 : 74;

  return (
    <>
      {/* Movable / Draggable Compact Floating AI Button */}
      {!isOpen && (
        <button
          type="button"
          onTouchStart={(e) => {
            if (e.touches.length > 0) {
              handlePointerDown(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget);
            }
          }}
          onTouchMove={(e) => {
            if (e.touches.length > 0) {
              handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
            }
          }}
          onTouchEnd={() => {
            const wasMoved = dragRef.current.moved;
            handlePointerUp();
            if (!wasMoved) {
              setIsOpen(true);
              setTimeout(() => inputRef.current?.focus(), 120);
            }
          }}
          onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY, e.currentTarget)}
          onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
          onMouseUp={() => {
            const wasMoved = dragRef.current.moved;
            handlePointerUp();
            if (!wasMoved) {
              setIsOpen(true);
              setTimeout(() => inputRef.current?.focus(), 120);
            }
          }}
          aria-label="Open Store AI Assistant (Draggable)"
          title={isEnglish ? 'Tap to chat or drag to move' : 'ଚାଟ୍ କରନ୍ତୁ କିମ୍ବା ଟାଣି ସ୍ଥାନ ବଦଳାନ୍ତୁ'}
          style={
            customPos
              ? {
                  left: `${customPos.x}px`,
                  top: `${customPos.y}px`,
                  touchAction: 'none',
                }
              : {
                  left: '12px',
                  bottom: `calc(${defaultBottomPx}px + env(safe-area-inset-bottom, 0px))`,
                  touchAction: 'none',
                }
          }
          className="fixed z-[46] flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#0c2340] hover:bg-slate-900 text-white shadow-lg border border-emerald-400/50 active:scale-95 transition-shadow cursor-grab active:cursor-grabbing select-none"
        >
          <span className="relative flex h-4 w-4 items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[11px] font-black tracking-tight text-white">
            {isEnglish ? 'Ask AI' : 'AI ସହାୟକ'}
          </span>
          <Move className="w-3 h-3 text-slate-400 ml-0.5 opacity-80" />
        </button>
      )}

      {/* Full-Height Mobile-Friendly Chat Modal (z-[100] so BottomNav never covers input box) */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-0 sm:p-4 animate-fadeIn">
          <div
            className="w-full max-w-md h-[92dvh] sm:h-[620px] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Top Header */}
            <div className="bg-emerald-800 text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-700 border border-emerald-500/40 flex items-center justify-center shadow-inner">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                    <span>Munna Store AI</span>
                    <span className="text-[10px] font-bold bg-emerald-950/60 text-emerald-200 px-1.5 py-0.5 rounded">
                      LIVE
                    </span>
                  </h3>
                  <p className="text-[11px] text-emerald-100/90 font-medium">
                    {isEnglish
                      ? `Connected to ${catalog.length} live store items`
                      : `${catalog.length} ଟି ଲାଇଭ୍ ପ୍ରଡକ୍ଟ ସହ ସଂଯୁକ୍ତ`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {customPos && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomPos(null);
                      try {
                        localStorage.removeItem(POS_STORAGE_KEY);
                      } catch {}
                    }}
                    title="Reset Button Position"
                    className="px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-100 hover:text-white hover:bg-emerald-700/70 transition-colors cursor-pointer"
                  >
                    Reset Pos
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearChat}
                  title={isEnglish ? 'Clear Chat' : 'ଚାଟ୍ ସଫା କରନ୍ତୁ'}
                  className="p-2 rounded-lg text-emerald-100 hover:text-white hover:bg-emerald-700/70 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title={isEnglish ? 'Close' : 'ବନ୍ଦ କରନ୍ତୁ'}
                  className="p-2 rounded-lg text-emerald-100 hover:text-white hover:bg-emerald-700/70 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Model Speed / Reasoning Mode Selector */}
            <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-1.5 shrink-0">
              <span className="text-[11px] font-bold text-slate-600">
                {isEnglish ? 'AI Mode:' : 'AI ମୋଡ୍:'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMode('fast')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                    mode === 'fast'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  <span>Fast</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('general')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                    mode === 'general'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Smart</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('complex')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                    mode === 'complex'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Brain className="w-3 h-3" />
                  <span>Deep</span>
                </button>
              </div>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="px-3 py-2 bg-white border-b border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {quickPrompts.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendMessage(item.prompt)}
                  disabled={isLoading}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 text-[11px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Scrollable Messages Thread */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/60">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap shadow-2xs ${
                        isUser
                          ? 'bg-emerald-700 text-white rounded-br-xs font-medium'
                          : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {msg.timestamp}
                    </span>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-start">
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-slate-600 shadow-2xs">
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                    <span>
                      {isEnglish
                        ? 'Checking live store stock & prices...'
                        : 'ଦୋକାନର ଲାଇଭ୍ ଦାମ୍ ଓ ଷ୍ଟକ୍ ଦେଖୁଛି...'}
                    </span>
                  </div>
                </div>
              )}

              {/* Matched In-Stock Products Quick Cards */}
              {suggestedCatalogProducts.length > 0 && !isLoading && (
                <div className="pt-1 space-y-1.5">
                  <p className="text-[11px] font-extrabold text-slate-500 px-1">
                    {isEnglish
                      ? 'Matched In-Stock Products:'
                      : 'ଦୋକାନରେ ଷ୍ଟକ୍ ଥିବା ସମ୍ପର୍କିତ ସାମଗ୍ରୀ:'}
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {suggestedCatalogProducts.map((prod) => {
                      const sp = Number(prod.selling_price) || 0;
                      const mrp = Number(prod.mrp) || sp;
                      const stock = parseProductStock(prod.stock_qty);
                      const inCartQty = cart[prod.ean] || 0;
                      return (
                        <div
                          key={prod.ean}
                          className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-400 text-left shadow-2xs transition-all"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              setSelectedProduct(prod);
                            }}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <ShoppingBag className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div className="truncate">
                              <p className="text-xs font-bold text-slate-800 truncate">
                                {prod.product_name}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] text-emerald-700 font-black">
                                  ₹{sp}
                                </span>
                                {mrp > sp && (
                                  <span className="text-[10px] text-slate-400 line-through">
                                    ₹{mrp}
                                  </span>
                                )}
                                <span className="text-[9.5px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                  {stock} left
                                </span>
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <button
                              type="button"
                              onClick={() => setQty(prod.ean, 1)}
                              className="flex items-center gap-0.5 text-[11px] font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg active:scale-95 transition-all cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>{inCartQty > 0 ? `Added (${inCartQty})` : 'ADD'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsOpen(false);
                                setSelectedProduct(prod);
                              }}
                              className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg cursor-pointer"
                            >
                              {isEnglish ? 'View' : 'ଦେଖନ୍ତୁ'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Input Form (Always visible above mobile navigation) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isEnglish
                    ? 'Ask price, stock, offers in Odia or English...'
                    : 'ଓଡ଼ିଆ କିମ୍ବା ଇଂରାଜୀରେ ଦାମ୍ ଓ ଷ୍ଟକ୍ ପଚାରନ୍ତୁ...'
                }
                disabled={isLoading}
                className="flex-1 bg-slate-100 focus:bg-white border border-slate-200 focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white transition-all active:scale-95 cursor-pointer"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
