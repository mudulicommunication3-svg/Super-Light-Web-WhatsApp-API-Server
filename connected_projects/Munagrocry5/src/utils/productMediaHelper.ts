/**
 * Product Media & Smart Category Helper
 * - Auto-detects store categories from JioMart search metadata & product titles
 * - Handles YouTube & video embed URL parsing, thumbnail extraction, and playback
 */

/**
 * Intelligent category detection from product title and raw JioMart category
 */
export function detectProductCategory(
  productName?: string,
  rawCategory?: string,
  rawItem?: any
): string {
  const name = String(productName || '').toLowerCase().trim();
  const rawCat = String(rawCategory || rawItem?.category || rawItem?.category_name || rawItem?.vertical || '').toLowerCase().trim();
  const combined = `${name} ${rawCat} ${String(rawItem?.description || '').toLowerCase()}`;

  // 1. Atta, Flours & Sooji
  if (
    /atta|flour|chakki|maida|suji|sooji|besan|sattu|wheat flour/i.test(combined) &&
    !/shampoo|soap|biscuit/i.test(combined)
  ) {
    return 'Atta';
  }

  // 2. Edible Oils (Distinguish specific oils)
  if (/mustard.*oil|sarson|kachhi ghani/i.test(combined)) {
    return 'Mustard Oil';
  }
  if (/sunflower.*oil/i.test(combined)) {
    return 'Sunflower Oil';
  }
  if (/rice.*bran.*oil/i.test(combined)) {
    return 'Rice Bran Oil';
  }
  if (/ghee|vanaspati/i.test(combined)) {
    return 'Ghee & Vanaspati';
  }
  if (/refined oil|edible oil|groundnut oil|soyabean oil|til oil|sesame oil|\boil\b/i.test(combined) && !/hair oil|baby oil/i.test(combined)) {
    return 'Edible Oil';
  }

  // 3. Tea, Coffee & Beverages
  if (/dust tea|leaf tea|tea bag|green tea|\btea\b|chai|tata tea|red label|wagh bakri/i.test(combined)) {
    return 'Leaf & Dust Tea';
  }
  if (/coffee|nescafe|bru/i.test(combined)) {
    return 'Coffee & Beverages';
  }
  if (/horlicks|boost|bournvita|complan|ensure|pediasure|malt|nutritional drink/i.test(combined)) {
    return 'Nutritional Drinks';
  }
  if (/cold drink|cola|pepsi|sprite|thums up|frooti|maaza|slice|juice|real juice|tang|glucon/i.test(combined)) {
    return 'Beverages';
  }

  // 4. Biscuits, Cookies & Bakery
  if (/biscuit|cookie|rusk|toast|marie|parle|britannia|oreo|bourbon|monaco|krackjack|good day|hide & seek/i.test(combined)) {
    return 'Biscuits';
  }

  // 5. Personal Care
  if (/bath.*soap|\bsoap\b|body wash|shower gel|lux|dettol.*soap|lifebuoy|cinthol|pears|santoor|dove/i.test(combined) && !/dishwash|detergent/i.test(combined)) {
    return 'Bath Soap';
  }
  if (/toothpaste|toothbrush|mouthwash|colgate|close up|pepsodent|sensodyne|dabur red|oral/i.test(combined)) {
    return 'Oral Care';
  }
  if (/shampoo|conditioner|hair oil|parachute|bajaj almond|navratna|clinic plus|head & shoulders|sunsilk|vatika/i.test(combined)) {
    return 'Hair Care';
  }
  if (/baby.*diaper|pampers|mamy poko|huggies|baby.*wash|baby.*lotion|johnson.*baby/i.test(combined)) {
    return 'Baby Care';
  }

  // 6. Household & Cleaning
  if (/detergent|washing powder|surf excel|ariel|tide|rin|wheel|fabric conditioner|comfort/i.test(combined)) {
    return 'Detergent';
  }
  if (/harpic|lizol|vim|dishwash|scrub|odonil|floor cleaner|toilet cleaner|phenyl|mop/i.test(combined)) {
    return 'Household & Cleaning';
  }

  // 7. Staples: Dal, Rice, Spices, Sugar/Salt
  if (/turmeric|haldi|chilli powder|mirch|cumin|jeera|coriander|dhaniya|garam masala|everest|mdh|catch|spices|masala/i.test(combined)) {
    return 'Spices';
  }
  if (/toor dal|arhar dal|moong dal|chana dal|urad dal|masoor dal|rajma|chole|kabuli chana|pulses|\bdal\b/i.test(combined)) {
    return 'Dal & Pulses';
  }
  if (/basmati|biryani rice|raw rice|boiled rice|poha|flattened rice|murmura|puffed rice|\brice\b/i.test(combined) && !/rice.*bran/i.test(combined)) {
    return 'Rice & Grains';
  }
  if (/sugar|sakkar|salt|namak|tata salt|jaggery|gur/i.test(combined)) {
    return 'Sugar, Salt & Jaggery';
  }

  // 8. Instant Foods & Snacks
  if (/maggi|noodle|pasta|macaroni|vermicelli|yippee|chowmein/i.test(combined)) {
    return 'Noodles & Pasta';
  }
  if (/kurkure|lays|bingo|namkeen|bhujia|mixture|chips|snacks|popcorn|peanut/i.test(combined)) {
    return 'Snacks & Namkeen';
  }
  if (/chocolate|cadbury|dairy milk|kitkat|5 star|perk|munch|candy|lollipop|sweet/i.test(combined)) {
    return 'Chocolates & Sweets';
  }

  // 9. Dairy & Bakery
  if (/milk|curd|dahi|paneer|butter|cheese|amul|bread|pav|dairy/i.test(combined)) {
    return 'Dairy & Bakery';
  }

  // 10. Dry Fruits & Nuts
  if (/kaju|cashew|badam|almond|kismis|raisin|pista|walnut|akhrot|dry fruit|dates|khajoor/i.test(combined)) {
    return 'Dry Fruits & Nuts';
  }

  // 11. Mobile Accessories
  if (/mobile|tempered glass|back cover|cover|charger|usb cable|type-c|earphone|headphone|airpods/i.test(combined)) {
    return 'Mobile Accessories';
  }

  // 12. If rawCategory has a specific meaningful value other than 'grocery'/'general'/'all'
  if (rawCategory && rawCategory.trim() && !/^(grocery|groceries|general|all|item|product)$/i.test(rawCategory.trim())) {
    return rawCategory.trim();
  }

  return 'Grocery';
}

export interface VideoEmbedInfo {
  isYouTube: boolean;
  embedUrl: string;
  videoId?: string;
  originalUrl: string;
}

/**
 * Parses YouTube links (regular, watch?v=, youtu.be, shorts, embeds) and direct video links
 */
export function getVideoEmbedInfo(url?: string): VideoEmbedInfo | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 1. YouTube Shorts: https://www.youtube.com/shorts/VIDEO_ID or youtube.com/shorts/VIDEO_ID
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,15})/i);
  if (shortsMatch && shortsMatch[1]) {
    const id = shortsMatch[1];
    return {
      isYouTube: true,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`,
      videoId: id,
      originalUrl: trimmed
    };
  }

  // 2. YouTube Standard: https://www.youtube.com/watch?v=VIDEO_ID
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{6,15})/i);
  if (watchMatch && watchMatch[1]) {
    const id = watchMatch[1];
    return {
      isYouTube: true,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`,
      videoId: id,
      originalUrl: trimmed
    };
  }

  // 3. YouTube Short Link: https://youtu.be/VIDEO_ID
  const youtuBeMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{6,15})/i);
  if (youtuBeMatch && youtuBeMatch[1]) {
    const id = youtuBeMatch[1];
    return {
      isYouTube: true,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`,
      videoId: id,
      originalUrl: trimmed
    };
  }

  // 4. YouTube Embed Link: https://www.youtube.com/embed/VIDEO_ID
  const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,15})/i);
  if (embedMatch && embedMatch[1]) {
    const id = embedMatch[1];
    return {
      isYouTube: true,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`,
      videoId: id,
      originalUrl: trimmed
    };
  }

  // 5. Direct MP4 / WebM / Video file URL
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(trimmed)) {
    return {
      isYouTube: false,
      embedUrl: trimmed,
      originalUrl: trimmed
    };
  }

  // Fallback if user just entered YouTube video ID directly (11 chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return {
      isYouTube: true,
      embedUrl: `https://www.youtube-nocookie.com/embed/${trimmed}?autoplay=1&rel=0&playsinline=1`,
      videoId: trimmed,
      originalUrl: trimmed
    };
  }

  return null;
}

/**
 * Extracts high-res thumbnail image from a YouTube URL
 */
export function getYouTubeThumbnail(url?: string): string | null {
  const info = getVideoEmbedInfo(url);
  if (info && info.isYouTube && info.videoId) {
    return `https://img.youtube.com/vi/${info.videoId}/hqdefault.jpg`;
  }
  return null;
}

/**
 * Strips HTML tags and normalizes whitespace from raw API strings
 */
function stripHtmlAndClean(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/**
 * Extracts or auto-generates a rich, informative product description from JioMart product data
 */
export function extractOrGenerateProductDescription(
  rawItem: any,
  detectedCategory?: string
): string {
  if (!rawItem) return '';

  const name = String(rawItem.name || rawItem.product_name || rawItem.title || '').trim();
  const category = detectedCategory || detectProductCategory(name, rawItem.category || rawItem.category_name, rawItem);
  const brand = String(rawItem.brand || rawItem.manufacturer || rawItem.manufacturer_name || '').trim();
  const ean = String(rawItem.ean || rawItem.barcode || rawItem.id || '').replace(/^EAN-/, '').trim();

  // Extract pack size / weight from product title if present (e.g., "5 kg", "1 L", "500 g", "200 ml")
  const packMatch = name.match(/\b(\d+(?:\.\d+)?\s*(?:kg|g|gm|gms|l|ltr|litre|ml|pc|pcs|pack|sachet|pouches|tablets|rolls))\b/i);
  const packSize = String(rawItem.pack_size || rawItem.net_weight || (packMatch ? packMatch[1] : '')).trim();

  // 1. Collect any raw description fields provided by JioMart / Worker API
  const rawDescCandidates: string[] = [];
  const fieldsToTry = [
    rawItem.description,
    rawItem.short_description,
    rawItem.long_description,
    rawItem.product_description,
    rawItem.summary,
    rawItem.about_the_product,
    rawItem.benefits
  ];

  for (const field of fieldsToTry) {
    if (typeof field === 'string' && field.trim()) {
      const cleaned = stripHtmlAndClean(field);
      // Only include if it's not just repeating the exact product name
      if (cleaned && cleaned.toLowerCase() !== name.toLowerCase() && !rawDescCandidates.includes(cleaned)) {
        rawDescCandidates.push(cleaned);
      }
    }
  }

  // Also check array fields like highlights / features / bullet_points
  const arrayFields = [rawItem.highlights, rawItem.features, rawItem.bullet_points, rawItem.key_features];
  for (const arr of arrayFields) {
    if (Array.isArray(arr) && arr.length > 0) {
      const joined = arr
        .map((x) => (typeof x === 'string' ? stripHtmlAndClean(x) : ''))
        .filter(Boolean)
        .map((x) => (x.startsWith('•') ? x : `• ${x}`))
        .join('\n');
      if (joined) rawDescCandidates.push(joined);
    }
  }

  // If JioMart returned a rich description (> 45 chars), format and enrich it
  const existingRichDesc = rawDescCandidates.join('\n').trim();
  if (existingRichDesc && existingRichDesc.length > 45) {
    const specs: string[] = [];
    if (brand) specs.push(`Brand: ${brand}`);
    if (packSize) specs.push(`Net Qty: ${packSize}`);
    if (category) specs.push(`Category: ${category}`);
    return specs.length > 0 ? `${existingRichDesc}\n• ${specs.join(' | ')}` : existingRichDesc;
  }

  // 2. Smart Category-Aware Auto-Description Builder when JioMart search snippet has only title/meta
  const catLower = category.toLowerCase();
  let categoryDetails = '100% genuine, fresh, and hygienic quality product sourced directly for daily household needs.';

  if (catLower.includes('atta') || /atta|chakki|flour|maida|suji|sooji|besan/i.test(name)) {
    categoryDetails = '100% pure & finely ground whole wheat / grain flour. Absorbs more water keeping rotis and chapatis soft, fluffy, and nutritious for hours. Rich in dietary fibre and natural nutrients.';
  } else if (catLower.includes('mustard oil') || /mustard|sarson|kachhi ghani/i.test(name)) {
    categoryDetails = '100% pure Kachhi Ghani mustard oil with natural pungency and aroma. Rich in Omega-3 & Omega-6 fatty acids, ideal for traditional Indian cooking, frying, and pickling.';
  } else if (catLower.includes('sunflower oil') || catLower.includes('rice bran') || catLower.includes('edible oil') || /\boil\b/i.test(name)) {
    categoryDetails = 'Light, healthy, and refined cooking oil enriched with Vitamins A & D. Retains natural taste of food, absorbs less oil during frying, and supports everyday heart-healthy cooking.';
  } else if (catLower.includes('ghee') || /ghee|vanaspati/i.test(name)) {
    categoryDetails = 'Pure, aromatic, and granular quality ghee that adds rich traditional flavor and nutrition to dals, rotis, sweets, and everyday meals.';
  } else if (catLower.includes('tea') || /\btea\b|chai/i.test(name)) {
    categoryDetails = 'Premium blend of finely selected tea leaves and dust for a rich color, refreshing aroma, and strong kadak taste in every cup.';
  } else if (catLower.includes('coffee') || /coffee/i.test(name)) {
    categoryDetails = 'Rich, aromatic roasted coffee blend that delivers an instant refreshing and smooth café-like coffee experience at home.';
  } else if (catLower.includes('biscuit') || /biscuit|cookie|rusk|marie|bourbon|oreo|good day/i.test(name)) {
    categoryDetails = 'Crisp, delicious, and freshly baked biscuits made from quality ingredients. Perfect tea-time snack for the whole family.';
  } else if (catLower.includes('soap') || /soap|body wash|dettol|lifebuoy|lux|santoor/i.test(name)) {
    categoryDetails = 'Gentle and refreshing bathing bar that cleanses skin thoroughly, provides germ protection, and leaves skin feeling soft, smooth, and fragrant.';
  } else if (catLower.includes('oral') || /toothpaste|toothbrush|colgate|sensodyne|dabur red/i.test(name)) {
    categoryDetails = 'Complete daily oral care protection for strong teeth, healthy gums, cavity defense, and long-lasting fresh breath.';
  } else if (catLower.includes('hair') || /shampoo|hair oil|parachute|clinic plus/i.test(name)) {
    categoryDetails = 'Nourishes scalp and hair from root to tip, keeping hair strong, smooth, shiny, and protected against daily damage.';
  } else if (catLower.includes('detergent') || catLower.includes('household') || /surf|ariel|tide|rin|wheel|vim|harpic|lizol/i.test(name)) {
    categoryDetails = 'Powerful stain and dirt removal formula that cleans deeply, leaves a pleasant fresh fragrance, and keeps your home and clothes sparkling clean.';
  } else if (catLower.includes('spice') || /masala|turmeric|haldi|chilli|mirch|jeera|dhaniya/i.test(name)) {
    categoryDetails = '100% pure, aromatic, and hygienically packed spice with natural color and authentic traditional flavor for delicious home-cooked meals.';
  } else if (catLower.includes('dal') || catLower.includes('pulse') || /\bdal\b|rajma|chana|besan/i.test(name)) {
    categoryDetails = 'Unpolished, protein-rich, and hygienically sorted pulses that cook evenly and deliver wholesome nutrition and authentic taste.';
  } else if (catLower.includes('rice') || /\brice\b|basmati|poha|murmura/i.test(name)) {
    categoryDetails = 'Premium quality, aged grains that cook up fluffy, non-sticky, and aromatic—ideal for daily meals, pulao, and biryani.';
  } else if (catLower.includes('noodle') || catLower.includes('snack') || /maggi|noodle|pasta|chips|kurkure|namkeen|bhujia/i.test(name)) {
    categoryDetails = 'Delicious, crispy, and flavorful snack made with quality ingredients and signature spices—ready to enjoy anytime.';
  } else if (catLower.includes('nutritional') || catLower.includes('beverage') || /horlicks|boost|bournvita|juice|frooti|maaza/i.test(name)) {
    categoryDetails = 'Refreshing and energizing beverage packed with essential vitamins, minerals, and great taste for daily vitality.';
  }

  const parts: string[] = [];
  if (existingRichDesc) {
    parts.push(existingRichDesc);
  }
  if (name) {
    parts.push(`${name} — ${categoryDetails}`);
  } else {
    parts.push(categoryDetails);
  }

  const metaBullets: string[] = [];
  if (brand) metaBullets.push(`Brand: ${brand}`);
  if (packSize) metaBullets.push(`Net Weight / Pack: ${packSize}`);
  if (category) metaBullets.push(`Category: ${category}`);
  if (ean && !ean.startsWith('P-')) metaBullets.push(`Barcode/EAN: ${ean}`);

  if (metaBullets.length > 0) {
    parts.push(`• ${metaBullets.join(' | ')}`);
  }
  parts.push('• 100% Authentic & Fresh Stock at Munna Mobile & Grocery, Niali.');

  return parts.join('\n');
}

/**
 * Parses one or more EAN / Barcode inputs (comma/space/semicolon separated strings or arrays)
 * into a deduplicated array of clean EAN tokens.
 */
export function parseEanList(
  ...inputs: Array<string | number | string[] | undefined | null>
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const input of inputs) {
    if (input === undefined || input === null) continue;
    const rawList: Array<string | number> = Array.isArray(input) ? input : [input];

    for (const item of rawList) {
      const str = String(item || '').trim();
      if (!str) continue;

      // Split by comma, pipe, semicolon, newline, or multiple spaces
      const tokens = str.split(/[,|;\n]+|\s{2,}/);
      for (const token of tokens) {
        const cleaned = token
          .replace(/^EAN-/i, '')
          .split('_')[0]
          .trim();
        if (!cleaned || cleaned === 'undefined' || cleaned === 'null') continue;
        const lower = cleaned.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          result.push(cleaned);
        }
      }
    }
  }

  return result;
}

/**
 * Returns the primary (first) clean EAN from a single or comma-separated EAN string
 */
export function getPrimaryEan(
  ean?: string | number,
  additionalEans?: string | string[]
): string {
  const list = parseEanList(ean, additionalEans);
  return list[0] || String(ean || '').replace(/^EAN-/i, '').split('_')[0].trim();
}

/**
 * Formats all unique EANs of a product into a clean comma-separated string for display and Google Sheet storage
 */
export function formatMultipleEans(
  ...inputs: Array<string | number | string[] | undefined | null>
): string {
  return parseEanList(...inputs).join(', ');
}

/**
 * Checks if any EAN of a product exactly matches any EAN in the target string/list
 */
export function doesProductMatchEan(
  product: { ean?: string | number; additional_eans?: string; ean_list?: string[]; rowIndex?: number; image_url?: string; backup_image_url?: string } | null | undefined,
  targetEanOrQuery?: string | number | string[]
): boolean {
  if (!product || !targetEanOrQuery) return false;
  const prodEans = parseEanList(product.ean, product.additional_eans, product.ean_list);
  const targetEans = parseEanList(targetEanOrQuery);
  if (targetEans.length === 0) return false;

  for (const tEan of targetEans) {
    const tLower = tEan.toLowerCase();
    const tDigits = tEan.replace(/\D/g, '');

    if (product.rowIndex !== undefined && (tLower === `row-${product.rowIndex}` || tLower === String(product.rowIndex))) {
      return true;
    }

    for (const pEan of prodEans) {
      const pLower = pEan.toLowerCase();
      if (pLower === tLower) return true;
      const pDigits = pEan.replace(/\D/g, '');
      if (pDigits && tDigits && pDigits.length >= 5 && pDigits === tDigits) {
        return true;
      }
    }

    if (tLower.length >= 6) {
      const bkp = String(product.backup_image_url || '').toLowerCase();
      const pri = String(product.image_url || '').toLowerCase();
      if ((bkp && bkp.includes(tLower)) || (pri && pri.includes(tLower))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if a search query substring is contained in any of the product's multiple EANs
 */
export function doesProductContainEanSubstring(
  product: { ean?: string | number; additional_eans?: string; ean_list?: string[] } | null | undefined,
  query?: string
): boolean {
  if (!product || !query) return false;
  const q = query.replace(/^EAN-/i, '').trim().toLowerCase();
  if (!q) return false;
  const prodEans = parseEanList(product.ean, product.additional_eans, product.ean_list);
  return prodEans.some((code) => code.toLowerCase().includes(q));
}

/**
 * Finds an existing product in the catalog if ANY of its multiple EANs match ANY EAN in targetEanOrList
 */
export function findProductByAnyEan<T extends { ean: string; additional_eans?: string; ean_list?: string[]; product_name?: string }>(
  catalog: T[],
  targetEanOrList?: string | number | string[],
  fallbackProductName?: string
): T | undefined {
  if (!Array.isArray(catalog) || catalog.length === 0) return undefined;

  // 1. First check exact match across all multiple EANs
  if (targetEanOrList) {
    const matchedByEan = catalog.find((p) => doesProductMatchEan(p, targetEanOrList));
    if (matchedByEan) return matchedByEan;
  }

  // 2. Optional fallback: exact normalized product name match if provided
  if (fallbackProductName && fallbackProductName.trim().length > 3) {
    const targetName = fallbackProductName.trim().toLowerCase();
    const matchedByName = catalog.find(
      (p) => (p.product_name || '').trim().toLowerCase() === targetName
    );
    if (matchedByName) return matchedByName;
  }

  return undefined;
}


