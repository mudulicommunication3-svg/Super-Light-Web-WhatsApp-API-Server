import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { GoogleGenAI } from '@google/genai';
import { INITIAL_PRODUCTS, ORIGINAL_CDN_MAP } from './src/data/initialData';

function productSeoPlugin(): Plugin {
  return {
    name: 'product-seo-plugin',
    transformIndexHtml(html, ctx) {
      const originalUrl = ctx?.originalUrl || ctx?.path || '';
      const match = originalUrl.match(/[?&]item=([^&]+)/);
      if (!match) return html;

      const ean = decodeURIComponent(match[1]).split(/[,;|\s]+/)[0].replace(/^EAN-/i, '').trim();
      const product = INITIAL_PRODUCTS.find((p) => {
        const tokens = `${p.ean || ''},${p.additional_eans || ''}`
          .split(/[,;|\s]+/)
          .map((s) => s.replace(/^EAN-/i, '').trim());
        return tokens.includes(ean);
      });
      if (!product && !ORIGINAL_CDN_MAP[ean]) return html;

      const sp = product
        ? (typeof product.selling_price === 'number' ? product.selling_price : parseFloat(String(product.selling_price || '0')))
        : 235;
      const mrp = product
        ? (typeof product.mrp === 'number' ? product.mrp : parseFloat(String(product.mrp || '0')))
        : 283;
      const prodName = product?.product_name || (ean === '490000038' ? 'Aashirvaad Shudh Whole Wheat Chakki Atta 5 kg' : `Item #${ean}`);
      const savings = mrp > sp ? mrp - sp : 0;
      const discount = mrp > sp ? Math.round(((mrp - sp) / mrp) * 100) : 0;

      const title = `${prodName} - Rs.${sp} | Munna Grocery Niali`;
      const desc = `Buy ${prodName} at Rs.${sp} (MRP: Rs.${mrp}${savings > 0 ? `, Save Rs.${savings} - ${discount}% OFF` : ''}). Munna Mobile & Grocery, Niali. Fast 3KM delivery!`;
      
      // Absolute image for WhatsApp/Telegram preview
      const primaryImg = product?.own_image_url || product?.image_url || ORIGINAL_CDN_MAP[ean] || '/icon-512.png';
      const backupImg = product?.backup_image_url || ORIGINAL_CDN_MAP[ean] || '';
      const shareImg = backupImg.startsWith('http') ? backupImg : primaryImg;
      const img = shareImg;

      const escape = (str: string) =>
        str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      let res = html;

      // Replace title
      res = res.replace(/<title>.*?<\/title>/i, `<title>${escape(title)}</title>`);

      // Replace or update OpenGraph Title
      if (res.includes('property="og:title"')) {
        res = res.replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i, `<meta property="og:title" content="${escape(title)}">`);
      } else {
        res = res.replace('</head>', `  <meta property="og:title" content="${escape(title)}">\n</head>`);
      }

      // Replace or update OpenGraph Description
      if (res.includes('property="og:description"')) {
        res = res.replace(/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i, `<meta property="og:description" content="${escape(desc)}">`);
      }

      // Replace or update OpenGraph Image (with backup image fallback tag)
      if (res.includes('property="og:image"')) {
        res = res.replace(
          /<meta\s+property="og:image"\s+content=".*?"\s*\/?>/i,
          `<meta property="og:image" content="${escape(shareImg)}">\n  <meta property="og:image:secure_url" content="${escape(shareImg)}">\n  <meta property="og:image:alt" content="${escape(prodName)}">\n  <meta property="og:image:width" content="600">\n  <meta property="og:image:height" content="600">${backupImg && backupImg !== shareImg ? `\n  <meta property="og:image" content="${escape(backupImg)}">` : ''}`
        );
      }

      // Replace or update Twitter Cards
      if (res.includes('name="twitter:title"')) {
        res = res.replace(/<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:title" content="${escape(title)}">`);
      }
      if (res.includes('name="twitter:description"')) {
        res = res.replace(/<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:description" content="${escape(desc)}">`);
      }
      if (res.includes('name="twitter:image"')) {
        res = res.replace(/<meta\s+name="twitter:image"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:image" content="${escape(img)}">`);
      }

      // Inject Product Specific meta tags & Schema.org JSON-LD
      const productMeta = `
  <meta property="og:type" content="product">
  <meta property="product:price:amount" content="${sp}">
  <meta property="product:price:currency" content="INR">
  <meta property="og:price:amount" content="${sp}">
  <meta property="og:price:currency" content="INR">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": ${JSON.stringify(prodName)},
    "image": [${JSON.stringify(img)}],
    "description": ${JSON.stringify(desc)},
    "offers": {
      "@type": "Offer",
      "priceCurrency": "INR",
      "price": "${sp}",
      "availability": "https://schema.org/InStock",
      "priceValidUntil": "2027-12-31"
    }
  }
  </script>`;

      res = res.replace('</head>', `${productMeta}\n</head>`);
      return res;
    }
  };
}

function jiomartSearchPlugin(): Plugin {
  const handleJioMartRequest = async (req: any, res: any, next: any) => {
    const rawUrl = req.url || '';
    if (!rawUrl.startsWith('/api/jiomart-search')) {
      return next();
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      const parsedUrl = new URL(rawUrl, 'http://localhost:3000');
      const query = (parsedUrl.searchParams.get('q') || '').trim();
      const requestedPincode = (
        parsedUrl.searchParams.get('pincode') ||
        parsedUrl.searchParams.get('pin') ||
        '752106'
      )
        .replace(/\D/g, '')
        .slice(0, 6);

      const strictMode =
        parsedUrl.searchParams.get('strict') === '1' ||
        parsedUrl.searchParams.get('strict') === 'true';

      const DEFAULT_FALLBACKS = ['753003', '753001', '751010'];

      let pincodesToTry: string[] = [];
      if (requestedPincode.length === 6) {
        if (strictMode) {
          pincodesToTry = [requestedPincode];
        } else {
          pincodesToTry = [
            requestedPincode,
            ...DEFAULT_FALLBACKS.filter((p) => p !== requestedPincode),
          ];
        }
      } else {
        pincodesToTry = DEFAULT_FALLBACKS;
      }

      if (!query) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            success: false,
            items: [],
            error: 'No search query provided',
          })
        );
        return;
      }

      let matchedItems: any[] = [];
      let activePincode = requestedPincode || '';

      for (const pincode of pincodesToTry) {
        const jioUrl = `https://www.jiomart.com/api/service/application/catalog/v1.0/products?q=${encodeURIComponent(
          query
        )}&page_size=10&page_no=1`;

        const locDetail = JSON.stringify({
          country: 'INDIA',
          country_iso_code: 'IN',
          pincode: String(pincode),
        });

        try {
          const visitorId =
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2);

          const jioRes = await fetch(jioUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36',
              Accept: 'application/json, text/plain, */*',
              Origin: 'https://www.jiomart.com',
              Referer: 'https://www.jiomart.com/',
              pincode: String(pincode),
              'x-pincode': String(pincode),
              'x-location-detail': locDetail,
              'visitor-id': visitorId,
            },
          });

          if (jioRes.ok) {
            const data: any = await jioRes.json();
            const rawItems = data?.data?.items || data?.items || [];

            if (Array.isArray(rawItems) && rawItems.length > 0) {
              activePincode = pincode;
              matchedItems = rawItems.slice(0, 10).map((item: any) => {
                const priceObj = item.price || {};
                const sp =
                  typeof priceObj.effective === 'object'
                    ? priceObj.effective.min || 0
                    : priceObj.effective || 0;
                const mrp =
                  typeof priceObj.marked === 'object'
                    ? priceObj.marked.min || 0
                    : priceObj.marked || 0;

                const images = (item.medias || [])
                  .filter(
                    (m: any) => m && m.url && String(m.url).startsWith('http')
                  )
                  .map((m: any) => m.url);

                const eanCode =
                  item.ean ||
                  item.barcode ||
                  (Array.isArray(item.identifiers) &&
                    item.identifiers[0]?.value) ||
                  item.sku_code ||
                  item.uid ||
                  item.id ||
                  '';

                return {
                  id: item.uid || item.id || item.sku_code || '',
                  ean: String(eanCode),
                  name: item.name || 'Product',
                  price: Number(sp),
                  mrp: Number(mrp),
                  image: images[0] || '',
                  images: images,
                  category:
                    item.category_slug ||
                    (item.categories && item.categories[0]?.name) ||
                    '',
                  description:
                    item.short_description ||
                    item.description ||
                    item.summary ||
                    '',
                  sellable: Boolean(item.sellable),
                  available: Boolean(item.sellable),
                  pincode: String(pincode),
                  requestedPincode: requestedPincode || String(pincode),
                };
              });
              break;
            }
          }
        } catch (err) {
          // Try next pincode if allowed
        }
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          success: true,
          source: 'built_in_project_server',
          query: query,
          requestedPincode: requestedPincode,
          pincode: activePincode,
          strictMode: strictMode,
          fallbackUsed: Boolean(
            requestedPincode &&
              activePincode &&
              requestedPincode !== activePincode
          ),
          count: matchedItems.length,
          items: matchedItems,
        })
      );
    } catch (e: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          success: false,
          items: [],
          error: e?.message || 'Internal JioMart proxy error',
        })
      );
    }
  };

  return {
    name: 'jiomart-search-plugin',
    configureServer(server) {
      server.middlewares.use(handleJioMartRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleJioMartRequest);
    },
  };
}

function geminiChatPlugin(): Plugin {
  const handleGeminiChat = async (req: any, res: any, next: any) => {
    const rawUrl = req.url || '';
    if (!rawUrl.startsWith('/api/gemini/chat')) {
      return next();
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      return next();
    }

    try {
      let bodyData = req.body;
      if (!bodyData) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const rawStr = Buffer.concat(chunks).toString('utf8');
        bodyData = rawStr ? JSON.parse(rawStr) : {};
      }

      const { message, history, mode, storeContext } = bodyData || {};
      const userMessage = String(message || '').trim();
      if (!userMessage) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Message is required' }));
        return;
      }

      let selectedModel = 'gemini-3.8-flash';
      if (mode === 'fast') selectedModel = 'gemini-3.1-flash-lite';
      else if (mode === 'complex') selectedModel = 'gemini-4-argon';

      const systemInstruction = [
        'You are the official AI Shopping Assistant for "Munna Mobile & Grocery" (ମୁନ୍ନା ମୋବାଇଲ୍ ଆଣ୍ଡ ଗ୍ରୋସରୀ), located in Niali, Odisha.',
        '- Reply in the language the customer uses (Odia, English, or Odia in English script).',
        '- NEVER invent or guess product prices, MRPs, or stock quantities. ONLY use the live store catalog data provided below.',
        '- Mention live Selling Price, MRP, discount savings, and available stock count.',
        '',
        'LIVE STORE CONTEXT & CATALOG:',
        typeof storeContext === 'string' && storeContext.trim()
          ? storeContext
          : 'No live catalog snapshot provided.',
      ].join('\n');

      const formattedHistory = Array.isArray(history)
        ? history
            .filter(
              (item: any) =>
                item &&
                (item.role === 'user' || item.role === 'model') &&
                typeof item.text === 'string' &&
                item.text.trim() !== ''
            )
            .slice(-16)
            .map((item: any) => ({
              role: item.role,
              parts: [{ text: String(item.text) }],
            }))
        : [];

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      let response;
      try {
        const chat = ai.chats.create({
          model: selectedModel,
          history: formattedHistory,
          config: { systemInstruction },
        });
        response = await chat.sendMessage({ message: userMessage });
      } catch (primaryErr) {
        if (selectedModel !== 'gemini-3.8-flash') {
          selectedModel = 'gemini-3.8-flash';
          const fallbackChat = ai.chats.create({
            model: selectedModel,
            history: formattedHistory,
            config: { systemInstruction },
          });
          response = await fallbackChat.sendMessage({ message: userMessage });
        } else {
          throw primaryErr;
        }
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          reply: response?.text || '',
          model: selectedModel,
        })
      );
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: err?.message || 'Failed to generate AI response',
        })
      );
    }
  };

  return {
    name: 'gemini-chat-plugin',
    configureServer(server) {
      server.middlewares.use(handleGeminiChat);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleGeminiChat);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), productSeoPlugin(), jiomartSearchPlugin(), geminiChatPlugin()],
  optimizeDeps: {
    entries: ['index.html'],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: false,
    watch: {
      ignored: ['**/*.apk', '**/*.zip', '**/public/assets/**', '**/pos.html'],
    },
  },
});


