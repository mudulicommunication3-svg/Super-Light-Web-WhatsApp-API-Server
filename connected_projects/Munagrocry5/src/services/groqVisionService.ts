import { APP_CONFIG, getWebhookUrl, getGoogleSheetId, pushConfigKeyToSheet } from './api';

export interface ExtractedProductData {
  product_name: string;
  category: string;
  mrp: number;
  selling_price: number;
  stock_qty: number;
  ean: string;
  description: string;
  rawJson?: string;
  providerUsed?: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
}

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// Canonical default free models on OpenRouter
export const DEFAULT_FREE_MODELS: OpenRouterModel[] = [
  {
    id: 'openrouter/free',
    name: 'Auto Free Multimodal Router (openrouter/free)',
    description: 'Routes automatically to the fastest available free vision model'
  },
  {
    id: 'nvidia/nemotron-3.5-super-v1:free',
    name: 'NVIDIA Nemotron 3.5 Super Vision (Free)',
    description: 'High precision packaging & OCR extractor'
  },
  {
    id: 'meta-llama/llama-3.2-11b-vision-instruct:free',
    name: 'Meta Llama 3.2 11B Vision Instruct (Free)',
    description: 'Multimodal vision model for packaging text & detail'
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Google Gemini 2.0 Flash Exp (Free)',
    description: 'Ultra-fast vision & OCR intelligence'
  },
  {
    id: 'qwen/qwen-2.5-vl-72b-instruct:free',
    name: 'Qwen 2.5 VL 72B Instruct (Free)',
    description: 'Top-tier multilingual packaging OCR & barcode reader'
  },
  {
    id: 'mistralai/pixtral-12b:free',
    name: 'Mistral Pixtral 12B (Free)',
    description: 'Strong multimodal image reasoning & schema extraction'
  }
];

/**
 * Cleanly strip markdown code blocks, backticks, and extra wrapper text before JSON parsing
 */
export function cleanJsonOutput(raw: string): string {
  if (!raw) return '{}';
  let cleaned = raw.trim();
  // Strip ```json or ``` at beginning
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  // Strip ``` at the end
  cleaned = cleaned.replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

  // If there's still wrapping text before the first { or after the last }, extract { ... }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

/**
 * Retrieve the active AI API key
 * Checks explicit key -> localStorage (cline_api_key, openrouter_api_key, settings.ai_api_key, munna_ai_api_key) -> APP_CONFIG
 */
export function getActiveAiApiKey(explicitKey?: string): string {
  if (explicitKey && explicitKey.trim()) {
    return explicitKey.trim();
  }
  try {
    const saved =
      localStorage.getItem('cline_api_key') ||
      localStorage.getItem('openrouter_api_key') ||
      localStorage.getItem('settings.ai_api_key') ||
      localStorage.getItem('munna_ai_api_key') ||
      localStorage.getItem('ai_api_key');
    if (saved && saved.trim()) return saved.trim();
  } catch (e) {}

  if ((APP_CONFIG as any).CLINE_API_KEY) return (APP_CONFIG as any).CLINE_API_KEY;
  if ((APP_CONFIG as any).OPENROUTER_API_KEY) return (APP_CONFIG as any).OPENROUTER_API_KEY;
  if ((APP_CONFIG as any).AI_API_KEY) return (APP_CONFIG as any).AI_API_KEY;
  return '';
}

/**
 * Fetch dynamic AI API key from Google Sheet Config tab so all admins use the same key
 */
export async function fetchAiKeyFromSheetConfig(): Promise<string | null> {
  try {
    const hook = getWebhookUrl();
    const sheetId = getGoogleSheetId();
    if (!hook) return null;

    const url = `${hook}${hook.includes('?') ? '&' : '?'}sheet_id=${encodeURIComponent(sheetId)}&action=get_config&_t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const cfg = data?.config || data;
      const keyVal =
        cfg?.cline_api_key ||
        cfg?.CLINE_API_KEY ||
        cfg?.openrouter_api_key ||
        cfg?.OPENROUTER_API_KEY ||
        cfg?.ai_api_key ||
        cfg?.AI_API_KEY ||
        cfg?.['settings.ai_api_key'];
      if (keyVal && String(keyVal).trim()) {
        const clean = String(keyVal).trim();
        try {
          localStorage.setItem('cline_api_key', clean);
          localStorage.setItem('openrouter_api_key', clean);
          localStorage.setItem('settings.ai_api_key', clean);
          localStorage.setItem('munna_ai_api_key', clean);
        } catch (e) {}
        return clean;
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Auto-saves the Cline AI API Key centrally into Google Sheet Config
 * and locally so ALL admins can add products using this one shared key!
 */
export async function saveAiKeyToSheetConfig(newKey: string): Promise<boolean> {
  const clean = newKey.trim();
  try {
    if (clean) {
      localStorage.setItem('cline_api_key', clean);
      localStorage.setItem('openrouter_api_key', clean);
      localStorage.setItem('settings.ai_api_key', clean);
      localStorage.setItem('munna_ai_api_key', clean);
    } else {
      localStorage.removeItem('cline_api_key');
      localStorage.removeItem('openrouter_api_key');
      localStorage.removeItem('settings.ai_api_key');
      localStorage.removeItem('munna_ai_api_key');
    }
  } catch (e) {}

  let sheetSaved = false;
  try {
    const p1 = pushConfigKeyToSheet('cline_api_key', clean);
    const p2 = pushConfigKeyToSheet('openrouter_api_key', clean);
    const results = await Promise.allSettled([p1, p2]);
    sheetSaved = results.some((r) => r.status === 'fulfilled' && Boolean(r.value));
  } catch (err) {
    console.warn('Failed to push cline_api_key to sheet config:', err);
  }
  return sheetSaved;
}

/**
 * Queries OpenRouter models endpoint and filters active free models ending with ':free' or 'openrouter/free'
 */
export async function fetchLiveFreeVisionModels(apiKey?: string): Promise<OpenRouterModel[]> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const key = getActiveAiApiKey(apiKey);
    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    }

    const res = await fetch(`${OPENROUTER_BASE}/models`, {
      headers,
      cache: 'no-store'
    });

    if (res.ok) {
      const data = await res.json();
      const rawModels: any[] = Array.isArray(data?.data) ? data.data : [];

      const freeList = rawModels.filter((m) => {
        const id = String(m?.id || '').toLowerCase();
        return id.endsWith(':free') || id === 'openrouter/free' || id.includes('free');
      });

      if (freeList.length > 0) {
        const mapped: OpenRouterModel[] = freeList.map((m) => ({
          id: m.id,
          name: m.name || m.id,
          description: m.description ? String(m.description).slice(0, 100) : 'Free OpenRouter Model',
          context_length: m.context_length
        }));

        // Ensure openrouter/free is always at the top
        const hasRouter = mapped.some((m) => m.id === 'openrouter/free');
        if (!hasRouter) {
          mapped.unshift(DEFAULT_FREE_MODELS[0]);
        }
        return mapped;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch live OpenRouter models, using default free models list:', err);
  }

  return DEFAULT_FREE_MODELS;
}

/**
 * Generates a standard 13-digit EAN barcode starting with 890 (GS1 India prefix)
 */
export function generateStandardEan890(): string {
  // 890 prefix + 9 random digits + checksum digit
  const prefix = '890';
  let body = '';
  for (let i = 0; i < 9; i++) {
    body += Math.floor(Math.random() * 10).toString();
  }
  const digits = (prefix + body).split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += i % 2 === 0 ? digits[i] : digits[i] * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${prefix}${body}${checkDigit}`;
}

/**
 * Extract product information using Cline AI on OpenRouter
 *
 * Headers:
 * - Authorization: Bearer {apiKey}
 * - Content-Type: application/json
 * - HTTP-Referer: "https://munagrocery.in"
 * - X-Title: "Munna Store Cline Vision"
 *
 * System Prompt:
 * Analyze the product packaging photo. Return strictly a raw JSON object (no markdown, no backticks) with keys:
 * - name: Brand + full model/title + pack size
 * - category: Store category (e.g., 'Mobile Phones', 'Grocery', 'Electronics')
 * - mrp: Printed MRP number
 * - price: Selling price number
 * - ean: Barcode numeric digits if visible, else 13-digit standard EAN starting with 890
 * - description: 2-sentence summary of key specifications
 */
export async function extractWithClineAi(
  base64Image: string,
  selectedModel: string = 'openrouter/free',
  userPrompt: string = '',
  apiKey?: string,
  categories: string[] = []
): Promise<ExtractedProductData> {
  const activeKey = getActiveAiApiKey(apiKey);
  if (!activeKey) {
    throw new Error('Please provide an OpenRouter API key. Get one for free at https://openrouter.ai/keys');
  }

  // Sanitize base64 and mime
  let cleanBase64 = base64Image.trim();
  let mimeType = 'image/jpeg';
  if (cleanBase64.startsWith('data:')) {
    const match = cleanBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      cleanBase64 = match[2];
    } else {
      cleanBase64 = cleanBase64.replace(/^data:[^;]+;base64,/, '');
    }
  }

  const catHint = categories.length > 0
    ? `Available store categories: [${categories.join(', ')}]. Choose the most accurate one.`
    : `Categories may include 'Mobile Phones', 'Grocery', 'Electronics', 'Personal Care', 'Snacks', 'Beverages'.`;

  const systemPrompt = `Analyze the product packaging photo. Return strictly a raw JSON object (no markdown, no backticks) with keys:
- name: Brand + full model/title + pack size
- category: Store category (e.g., 'Mobile Phones', 'Grocery', 'Electronics')
- mrp: Printed MRP number
- price: Selling price number
- ean: Barcode numeric digits if visible, else 13-digit standard EAN starting with 890
- description: 2-sentence summary of key specifications
${catHint}`;

  let userText = 'Extract product details from this packaging photo following the exact JSON schema.';
  if (userPrompt && userPrompt.trim()) {
    userText += `\nAdditional user instructions: ${userPrompt.trim()}`;
  }

  const modelToUse = selectedModel || 'openrouter/free';

  const payload = {
    model: modelToUse,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userText
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${cleanBase64}`
            }
          }
        ]
      }
    ],
    temperature: 0.1
  };

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${activeKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://munagrocery.in',
      'X-Title': 'Munna Store Cline Vision'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const errMsg = errJson?.error?.message || `OpenRouter API error ${res.status}: ${res.statusText}`;
    throw new Error(errMsg);
  }

  const json = await res.json();
  const rawContent = json?.choices?.[0]?.message?.content || '{}';
  const cleaned = cleanJsonOutput(rawContent);

  let parsed: any = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    // Fallback: extract keys with regex if JSON has minor syntax issues
    const extractField = (key: string) => {
      const regex = new RegExp(`"${key}"\\s*:\\s*(?:"([^"]+)"|([0-9.]+)|true|false)`, 'i');
      const m = cleaned.match(regex);
      return m ? m[1] || m[2] : '';
    };
    parsed = {
      name: extractField('name') || extractField('product_name'),
      category: extractField('category'),
      mrp: extractField('mrp'),
      price: extractField('price') || extractField('selling_price'),
      ean: extractField('ean'),
      description: extractField('description')
    };
  }

  const mrpNum = Number(parsed.mrp) || Number(parsed.price) || 0;
  const spNum = Number(parsed.price !== undefined ? parsed.price : parsed.selling_price) || mrpNum;

  // Barcode validation: if absent or non-numeric, generate 13-digit 890 standard EAN
  let finalEan = String(parsed.ean || parsed.barcode || '').trim().replace(/[^0-9]/g, '');
  if (!finalEan || finalEan.length < 8) {
    finalEan = generateStandardEan890();
  }

  const finalName = String(parsed.name || parsed.product_name || 'New Product').trim();
  const finalCategory = String(parsed.category || (categories[0] || 'Grocery')).trim();
  const finalDesc = String(parsed.description || `${finalName} - genuine store item`).trim();

  return {
    product_name: finalName,
    category: finalCategory,
    mrp: mrpNum,
    selling_price: spNum,
    stock_qty: Number(parsed.stock_qty || parsed.stock || 10),
    ean: finalEan,
    description: finalDesc,
    rawJson: cleaned,
    providerUsed: `OpenRouter (${modelToUse})`
  };
}

/**
 * Backward compatibility alias for any existing code calling extractProductWithVision
 */
export async function extractProductWithVision(params: {
  base64Image: string;
  mimeType?: string;
  apiKey?: string;
  categories?: string[];
  notes?: string;
  selectedModel?: string;
}): Promise<ExtractedProductData> {
  return extractWithClineAi(
    params.base64Image,
    params.selectedModel || 'openrouter/free',
    params.notes || '',
    params.apiKey,
    params.categories || []
  );
}
