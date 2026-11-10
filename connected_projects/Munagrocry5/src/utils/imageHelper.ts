/**
 * Product Image and Repository Asset Helper
 * Handles category-based folder structuring, own repo paths, CDN backups, and resilient fallbacks
 */

import { Product } from '../types';
import { ORIGINAL_CDN_MAP, getOriginalCdnUrl } from '../data/initialData';

export const STORE_BASE_URL = 'https://munagrocery.in';

/**
 * Normalizes Google Drive share links to high-speed direct image view URLs:
 * Converts https://drive.google.com/file/d/{FILE_ID}/view to https://lh3.googleusercontent.com/d/{FILE_ID}
 */
export function normalizeGoogleDriveImageUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Check if it's a Google Drive link
  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
    // Match /file/d/{ID}
    const fileIdMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }
    // Match id={ID}
    const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch && idParamMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${idParamMatch[1]}`;
    }
    // Match /open?id={ID}
    const openMatch = trimmed.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
    if (openMatch && openMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${openMatch[1]}`;
    }
  }
  return trimmed;
}

/**
 * Auto-normalizes image URLs:
 * - Converts ImgBB page viewer URLs (e.g. ibb.co/xyz) to direct raw CDN links (i.ibb.co/xyz)
 * - Converts Google Drive share links to direct lh3 view links
 */
export function formatDirectImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim();
  if (!trimmed) return '';

  // Google Drive URL normalization
  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
    trimmed = normalizeGoogleDriveImageUrl(trimmed);
  }

  // ImgBB URL normalization: convert ibb.co/ to i.ibb.co/ if not already i.ibb.co
  if (trimmed.includes('ibb.co/') && !trimmed.includes('i.ibb.co/')) {
    trimmed = trimmed.replace('ibb.co/', 'i.ibb.co/');
  }

  return trimmed;
}

/**
 * Compresses an image client-side to max 1200px and JPEG quality 0.85
 * Ensures fast uploads from phone cameras without memory issues
 */
export async function compressImageForUpload(
  file: File,
  maxDimension = 1200,
  quality = 0.85
): Promise<File> {
  // If not an image or running on server, return file as-is
  if (!file.type.startsWith('image/') || typeof window === 'undefined') {
    return file;
  }

  // If already very small (< 100KB) and not huge SVG/BMP, return as-is
  if (file.size < 100 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        // Draw image onto canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressedFile = new File([blob], cleanName, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Converts File or Blob to Base64 Data URL string
 */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// Inlined clean store placeholder SVG fallback so broken external images never show 404 or ImgBB error screens
export const DEFAULT_PRODUCT_PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' rx='20' fill='%23f8fafc'/><path d='M70 65h60l10 75H60L70 65z' fill='%23e2e8f0' stroke='%23cbd5e1' stroke-width='3' stroke-linejoin='round'/><path d='M85 65a15 15 0 0 1 30 0' fill='none' stroke='%2394a3b8' stroke-width='3' stroke-linecap='round'/><circle cx='100' cy='115' r='12' fill='%2310b981'/><text x='100' y='170' font-family='sans-serif' font-size='11' font-weight='bold' fill='%2364748b' text-anchor='middle'>Munna Grocery</text></svg>";

/**
 * Standardize category name to a clean filesystem folder name
 */
export function getCategoryFolder(category?: string): string {
  if (!category) return 'General';
  const c = category.trim();

  // Normalize common catalog categories to clean directory names
  if (/mustard/i.test(c)) return 'Mustard_Oil';
  if (/rice.*bran/i.test(c)) return 'Rice_Bran_Oil';
  if (/sunflower/i.test(c)) return 'Sunflower_Oil';
  if (/oil/i.test(c)) return 'Edible_Oil';
  if (/tea/i.test(c)) return 'Tea';
  if (/atta|flour/i.test(c)) return 'Atta';
  if (/biscuit|cookie/i.test(c)) return 'Biscuits';
  if (/nutritional|horlicks|boost|bournvita/i.test(c)) return 'Nutritional_Drinks';
  if (/soap/i.test(c)) return 'Bath_Soap';
  if (/wash|detergent|surf/i.test(c)) return 'Detergent';
  if (/tooth|oral|paste/i.test(c)) return 'Oral_Care';
  if (/baby/i.test(c)) return 'Baby_Care';
  if (/shampoo|conditioner|hair/i.test(c)) return 'Hair_Care';
  if (/spice|masala/i.test(c)) return 'Spices';
  if (/mobile|case|cover|glass/i.test(c)) return 'Mobile_Accessories';

  // Fallback: replace spaces and special chars with underscores
  return c
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'General';
}

/**
 * Returns structured repository relative image path: /products/<Category_Folder>/<ean>.jpg
 */
export function getRepoImagePath(category: string, ean: string): string {
  const folder = getCategoryFolder(category);
  const firstEan = String(ean || '').split(/[,|;\s]+/)[0] || String(ean || '');
  const cleanEan = firstEan.replace(/^EAN-/i, '').replace(/[^\w-]/g, '').trim();
  return `/products/${folder}/${cleanEan}.jpg`;
}

/**
 * Resolves the best working image URL for a product:
 * 1. If product.image_url is a working HTTP/HTTPS or data URL, normalize and return
 * 2. If product.backup_image_url is a working HTTP/HTTPS URL, normalize and return
 * 3. Lookup any of the product's EANs in original CDN map
 * 4. Return robust inlined SVG store placeholder
 */
export function resolveProductImage(
  product?: Partial<Product> | null
): string {
  if (!product) return DEFAULT_PRODUCT_PLACEHOLDER;

  let img = formatDirectImageUrl(product.image_url || '');
  let backup = formatDirectImageUrl(product.backup_image_url || '');

  const rawEans = `${product.ean || ''},${product.additional_eans || ''}`
    .split(/[,|;\s]+/)
    .map((e) => e.replace(/^EAN-/i, '').trim())
    .filter(Boolean);
  const cleanEan = rawEans[0] || '';

  // 1. Direct working HTTP/data URL
  if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:')) {
    return img;
  }

  // 2. Backup CDN URL
  if (backup.startsWith('http://') || backup.startsWith('https://')) {
    return backup;
  }

  // 3. Fallback to known original CDN for any of this product's EANs
  for (const code of rawEans) {
    if (ORIGINAL_CDN_MAP[code]) {
      return formatDirectImageUrl(ORIGINAL_CDN_MAP[code]);
    }
    const orig = getOriginalCdnUrl(code);
    if (orig) {
      return formatDirectImageUrl(orig);
    }
  }

  if (img && !img.startsWith('/products/')) {
    return img;
  }

  return DEFAULT_PRODUCT_PLACEHOLDER;
}

/**
 * Returns customer-facing order link or share photo link
 * STRICT PRIVACY & BRANDING RULE: Only our own store link/domain is shared with customers.
 * Never shares external 3rd-party CDN URLs to customers!
 */
export function getCustomerShareImageUrl(category?: string, ean?: string): string {
  if (category && ean) {
    return `${STORE_BASE_URL}${getRepoImagePath(category, ean)}`;
  }
  return `${STORE_BASE_URL}/icon-512.png`;
}

/**
 * Returns absolute URL for OpenGraph and WhatsApp sharing
 */
export function getAbsoluteImageUrl(url?: string, category?: string, ean?: string): string {
  if (category && ean) {
    return `${STORE_BASE_URL}${getRepoImagePath(category, ean)}`;
  }

  if (!url || url.trim() === '') {
    return `${STORE_BASE_URL}/icon-512.png`;
  }

  const trimmed = url.trim();
  if (trimmed.includes('jiomart') || trimmed.includes('ibb.co') || trimmed.includes('imgbb')) {
    return `${STORE_BASE_URL}/icon-512.png`;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const relativePath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${STORE_BASE_URL}${relativePath}`;
}

/**
 * Determine if an image URL is our repository path (/products/...) or our own domain
 */
export function isRepoUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith('/products/') || url.includes('/products/') || url.includes('munagrocery.in/products/');
}

/**
 * Safe Image error fallback handler for React <img> tags:
 * 1. Tries backupUrl (e.g. original CDN link) formatted
 * 2. Tries ORIGINAL_CDN_MAP based on ean formatted
 * 3. Falls back to guaranteed DEFAULT_PRODUCT_PLACEHOLDER SVG (never broken!)
 */
export function handleProductImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  backupUrl?: string,
  ean?: string
) {
  const imgEl = e.currentTarget;
  const currentSrc = imgEl.src;

  // Try backup URL first if provided and not already tried
  if (backupUrl && backupUrl.trim()) {
    const formattedBackup = formatDirectImageUrl(backupUrl);
    if (formattedBackup && !currentSrc.includes(formattedBackup)) {
      imgEl.src = formattedBackup;
      return;
    }
  }

  // Try looking up original CDN by EAN
  if (ean) {
    const clean = String(ean).replace(/^EAN-/, '').trim();
    const cdn = ORIGINAL_CDN_MAP[clean];
    if (cdn) {
      const formattedCdn = formatDirectImageUrl(cdn);
      if (formattedCdn && !currentSrc.includes(formattedCdn)) {
        imgEl.src = formattedCdn;
        return;
      }
    }
  }

  // Fallback to clean inline SVG store placeholder (prevents ImgBB "service unavailable" screen)
  if (!currentSrc.startsWith('data:image/svg+xml')) {
    imgEl.src = DEFAULT_PRODUCT_PLACEHOLDER;
  }
}
