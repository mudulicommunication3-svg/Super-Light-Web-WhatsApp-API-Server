const fs = require('fs');
const path = require('path');

const itemsPath = path.resolve(__dirname, '../extracted_sheet1_products.json');
const items = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));

function normalizeImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  if (!url) return '';

  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    }
  }

  if (url.startsWith('/')) {
    return `https://www.munagrocery.in${url}`;
  }

  if (url.startsWith('http://')) {
    return url.replace(/^http:\/\//i, 'https://');
  }

  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  return url;
}

const catalog = {};
for (const p of items) {
  const cleanEan = String(p.ean || p.raw_ean || '').replace(/^EAN-/i, '').trim();
  const rawEan = String(p.raw_ean || p.ean || '').trim();
  const rowIndex = String(p.rowIndex || '');
  const normalizedImage = normalizeImageUrl(p.image_url || p.backup_image_url || '');

  const entry = {
    name: (p.product_name || 'Product').trim(),
    price: String(p.selling_price || p.mrp || '0').trim(),
    mrp: String(p.mrp || p.selling_price || '0').trim(),
    image: normalizedImage,
    category: (p.category || 'Grocery').trim()
  };

  if (cleanEan) catalog[cleanEan] = entry;
  if (rawEan && rawEan !== cleanEan) catalog[rawEan] = entry;
  if (rowIndex) catalog[`row-${rowIndex}`] = entry;
}

const catalogJson = JSON.stringify(catalog, null, 2);

const outputTs = `/**
 * Cloudflare Pages Function Middleware: Dynamic Social Media Link Image & Preview Injector
 * 
 * Intercepts incoming crawler/bot requests for WhatsApp, Facebook, Telegram, Twitter, LinkedIn, etc.
 * When a request has ?item=... (or ?product=..., ?ean=..., ?id=...), dynamically injects accurate
 * Open Graph and Twitter Card <meta> tags pointing to the product photo, title, and price.
 * 
 * Features:
 * 1. Embedded in-memory catalog fallback for instantaneous (<100ms) bot response without timeout.
 * 2. Live Google Sheet Apps Script webhook query for newly added products.
 * 3. Automatic Google Drive URL conversion to direct public CDN image link (lh3.googleusercontent.com/d/{id}).
 * 4. Strict HTTPS enforcement.
 * 5. Full pass-through for regular browser visitors.
 */

export interface CatalogItem {
  name: string;
  price: string | number;
  mrp: string | number;
  image: string;
  category?: string;
}

export const STATIC_CATALOG: Record<string, CatalogItem> = ${catalogJson};

// User-Agent regex detecting social media crawlers and link unfurling bots
const CRAWLER_REGEX = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Slack-ImgProxy|Pinterest|SkypeUriPreview|Googlebot|bingbot|Applebot/i;

const DEFAULT_BANNER = "https://www.munagrocery.in/banner.jpg";
const DEFAULT_STORE_TITLE = "Munna Mobile & Grocery - Niali";
const DEFAULT_STORE_DESC = "Order grocery, daily essentials, and mobile accessories with fast store pickup and local delivery in Niali.";
const SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyBG-2536FNp4Kdux8GSBjKMyHjaSBWqSIaJpHDQ68GtzKpyUYR9x_N9QthMdvXPNhE/exec";
const SHEET_ID = "1wj0Lg32nIDjCDadnBovK2u0agpJ4gIJr1ahxya1GMGE";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function normalizeImageUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  let url = rawUrl.trim();
  if (!url) return "";

  // 1. Google Drive direct link conversion
  if (url.includes("drive.google.com") || url.includes("docs.google.com")) {
    const idMatch = url.match(/\\/d\\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      return \`https://lh3.googleusercontent.com/d/\${idMatch[1]}\`;
    }
  }

  // 2. Resolve relative URLs to full HTTPS production domain
  if (url.startsWith("/")) {
    return \`https://www.munagrocery.in\${url}\`;
  }

  // 3. Ensure HTTPS protocol is strictly used
  if (url.startsWith("http://")) {
    return url.replace(/^http:\\/\\//i, "https://");
  }

  if (url.startsWith("//")) {
    return \`https:\${url}\`;
  }

  return url;
}

export function lookupStaticCatalog(key: string): CatalogItem | null {
  if (!key) return null;
  const clean = key.replace(/^EAN-/i, "").trim();
  if (STATIC_CATALOG[clean]) return STATIC_CATALOG[clean];
  if (STATIC_CATALOG[key]) return STATIC_CATALOG[key];
  if (STATIC_CATALOG["row-" + clean]) return STATIC_CATALOG["row-" + clean];

  // Try case-insensitive scan
  const lowerClean = clean.toLowerCase();
  for (const [k, v] of Object.entries(STATIC_CATALOG)) {
    if (k.toLowerCase() === lowerClean || k.toLowerCase().replace(/^ean-/, "") === lowerClean) {
      return v;
    }
  }

  return null;
}

async function fetchLiveProduct(searchKey: string): Promise<CatalogItem | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const url = \`\${SHEET_WEBHOOK_URL}?action=get_products&sheet_id=\${encodeURIComponent(SHEET_ID)}&worksheet=Sheet1\`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return null;
    const data: any = await res.json().catch(() => null);
    const list = Array.isArray(data) ? data : (data && Array.isArray(data.products) ? data.products : null);
    if (!list) return null;

    const key = searchKey.replace(/^EAN-/i, "").trim().toLowerCase();

    const match = list.find((item: any) => {
      const itemEan = String(item.ean || "").replace(/^EAN-/i, "").trim().toLowerCase();
      const itemRawEan = String(item.raw_ean || "").trim().toLowerCase();
      const itemId = String(item.id || "").trim().toLowerCase();
      const itemRow = String(item.rowIndex || "").trim().toLowerCase();
      return itemEan === key || itemRawEan === key || itemId === key || itemRow === key || ("row-" + itemRow) === key;
    });

    if (match) {
      const rawImage = match.image_url || match.backup_image_url || match.image || "";
      return {
        name: String(match.product_name || match.name || "Product").trim(),
        price: String(match.selling_price || match.mrp || "0").trim(),
        mrp: String(match.mrp || match.selling_price || "0").trim(),
        image: normalizeImageUrl(rawImage),
        category: String(match.category || "Grocery").trim()
      };
    }
    return null;
  } catch {
    return null;
  }
}

export const onRequest = async (context: {
  request: Request;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
}): Promise<Response> => {
  const { request } = context;
  const userAgent = request.headers.get("user-agent") || "";
  const url = new URL(request.url);

  // 1. Identify product query parameter (item, product, ean, or id)
  const itemParam = url.searchParams.get("item") || 
                    url.searchParams.get("product") || 
                    url.searchParams.get("ean") || 
                    url.searchParams.get("id");
  const isCrawler = CRAWLER_REGEX.test(userAgent);

  // 2. Fast pass-through for regular browser visitors or requests without product parameter
  if (!isCrawler || !itemParam) {
    return context.next();
  }

  // 3. Crawler detected with a product parameter: resolve product details
  const cleanKey = itemParam.replace(/^EAN-/i, "").trim();
  
  // (a) Fast in-memory lookup (<100ms response guarantee for social unfurlers)
  let product: CatalogItem | null = lookupStaticCatalog(cleanKey);

  // (b) Live Google Sheet query fallback
  if (!product) {
    product = await fetchLiveProduct(cleanKey);
  }

  // 4. Formulate canonical and product meta tags
  const canonicalUrl = \`https://www.munagrocery.in/?item=\${encodeURIComponent(cleanKey)}\`;

  let pageTitle = DEFAULT_STORE_TITLE;
  let ogType = "website";
  let ogTitle = DEFAULT_STORE_TITLE;
  let ogDesc = DEFAULT_STORE_DESC;
  let directProductImageUrl = DEFAULT_BANNER;

  if (product) {
    const productName = product.name || "Grocery Item";
    const productPrice = product.price || "0";
    const productMrp = product.mrp || productPrice;
    
    ogType = "product";
    pageTitle = \`\${productName} - Rs.\${productPrice} | Munna Grocery\`;
    ogTitle = \`\${productName} - Rs.\${productPrice} | Munna Grocery\`;
    ogDesc = \`Buy \${productName} at Rs.\${productPrice} (MRP Rs.\${productMrp}). Fast pickup & delivery at Niali.\`;

    const rawImg = normalizeImageUrl(product.image);
    if (rawImg) {
      directProductImageUrl = rawImg;
    }
  }

  // 5. Fetch downstream index.html from React build output
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  let html = await response.text();

  // 6. Inject Open Graph & Twitter Card tags in <head>
  const tagsToInject = \`
  <!-- Dynamic Open Graph Product Preview for \${escapeHtml(cleanKey)} -->
  <title>\${escapeHtml(pageTitle)}</title>
  <meta property="og:type" content="\${escapeHtml(ogType)}" />
  <meta property="og:site_name" content="Munna Mobile & Grocery" />
  <meta property="og:url" content="\${escapeHtml(canonicalUrl)}" />
  <meta property="og:title" content="\${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="\${escapeHtml(ogDesc)}" />
  <meta property="og:image" content="\${escapeHtml(directProductImageUrl)}" />
  <meta property="og:image:secure_url" content="\${escapeHtml(directProductImageUrl)}" />
  <meta property="og:image:width" content="600" />
  <meta property="og:image:height" content="600" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="\${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="\${escapeHtml(ogDesc)}" />
  <meta name="twitter:image" content="\${escapeHtml(directProductImageUrl)}" />
  <meta name="description" content="\${escapeHtml(ogDesc)}" />
\`;

  // Strip existing static social tags to ensure unambiguous preview tags for crawlers
  html = html
    .replace(/<title>.*?<\\/title>/is, "")
    .replace(/<meta\\s+property=["']og:title["'].*?>/gis, "")
    .replace(/<meta\\s+property=["']og:description["'].*?>/gis, "")
    .replace(/<meta\\s+property=["']og:image["'].*?>/gis, "")
    .replace(/<meta\\s+property=["']og:image:secure_url["'].*?>/gis, "")
    .replace(/<meta\\s+property=["']og:image:width["'].*?>/gis, "")
    .replace(/<meta\\s+property=["']og:image:height["'].*?>/gis, "")
    .replace(/<meta\\s+property=["']og:url["'].*?>/gis, "")
    .replace(/<meta\\s+property=["']og:type["'].*?>/gis, "")
    .replace(/<meta\\s+property=["']og:site_name["'].*?>/gis, "")
    .replace(/<meta\\s+name=["']twitter:card["'].*?>/gis, "")
    .replace(/<meta\\s+name=["']twitter:title["'].*?>/gis, "")
    .replace(/<meta\\s+name=["']twitter:description["'].*?>/gis, "")
    .replace(/<meta\\s+name=["']twitter:image["'].*?>/gis, "")
    .replace(/<meta\\s+name=["']description["'].*?>/gis, "");

  html = html.replace(/<head>/i, "<head>" + tagsToInject);

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");

  return new Response(html, {
    status: 200,
    headers
  });
};
`;

const dest = path.resolve(__dirname, '../functions/_middleware.ts');
fs.writeFileSync(dest, outputTs);
console.log('Successfully updated functions/_middleware.ts');
