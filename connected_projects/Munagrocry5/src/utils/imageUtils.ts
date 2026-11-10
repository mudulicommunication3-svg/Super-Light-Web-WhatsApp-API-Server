import { Product } from '../types';
import {
  formatDirectImageUrl,
  handleProductImageError,
  DEFAULT_PRODUCT_PLACEHOLDER,
  resolveProductImage,
  getRepoImagePath
} from './imageHelper';

export { formatDirectImageUrl, handleProductImageError, resolveProductImage };

export function slugifyCategory(category: string): string {
  if (!category) return 'general';
  return category
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'general';
}

export function getProductDisplayImage(product: Product): string {
  return resolveProductImage(product);
}

export function getProductBackupImage(product: Product): string {
  if (product.backup_image_url && product.backup_image_url.trim()) {
    return formatDirectImageUrl(product.backup_image_url);
  }
  return DEFAULT_PRODUCT_PLACEHOLDER;
}

/**
 * Converts all products to own repo links while backing up original external CDN links
 */
export function convertCatalogToRepoLinks(catalog: Product[]): Product[] {
  return catalog.map((p) => {
    const repoPath = getRepoImagePath(p.category, p.ean);
    const backup = p.backup_image_url || (p.image_url.startsWith('http') ? p.image_url : '');

    return {
      ...p,
      image_url: repoPath,
      own_image_url: repoPath,
      backup_image_url: formatDirectImageUrl(backup || p.backup_image_url || p.image_url)
    };
  });
}
