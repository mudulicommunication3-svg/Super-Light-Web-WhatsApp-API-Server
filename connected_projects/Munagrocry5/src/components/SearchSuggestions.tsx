import React, { useMemo } from 'react';
import { Product } from '../types';
import { resolveProductImage, handleProductImageError } from '../utils/imageHelper';
import { doesProductContainEanSubstring } from '../utils/productMediaHelper';
import { Search, ChevronRight, ArrowUpLeft, Sparkles, Tag } from 'lucide-react';

export interface SuggestionItem {
  id: string;
  queryText: string;
  displayText: string;
  subtitle?: string;
  badge?: string;
  price?: number;
  representativeProduct: Product;
  type: 'phrase' | 'category' | 'product';
}

interface SearchSuggestionsProps {
  query: string;
  catalog: Product[];
  activeIndex?: number;
  onSelect: (phrase: string, product?: Product) => void;
  onClose: () => void;
}

/**
 * Helper to highlight matching substrings in suggestion text
 */
export const HighlightText: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query || !query.trim()) {
    return <span className="text-slate-800">{text}</span>;
  }

  const trimmedQuery = query.trim();
  // Escape regex special chars
  const escaped = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className="truncate">
      {parts.map((part, index) =>
        regex.test(part) ? (
          <strong key={index} className="font-extrabold text-[#0c2340] underline decoration-amber-400 decoration-2">
            {part}
          </strong>
        ) : (
          <span key={index} className="text-slate-700 font-medium">
            {part}
          </span>
        )
      )}
    </span>
  );
};

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  query,
  catalog,
  activeIndex = -1,
  onSelect,
  onClose
}) => {
  // Generate predictive structured suggestions based on current live catalog
  const suggestions = useMemo<SuggestionItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const matchingProducts = catalog.filter((p) => {
      const name = (p.product_name || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return name.includes(q) || cat.includes(q) || doesProductContainEanSubstring(p, q);
    });

    if (matchingProducts.length === 0) return [];

    const items: SuggestionItem[] = [];
    const seenQueries = new Set<string>();

    const addSuggestion = (item: SuggestionItem) => {
      const key = item.queryText.toLowerCase().trim();
      if (!seenQueries.has(key) && items.length < 6) {
        seenQueries.add(key);
        items.push(item);
      }
    };

    // 1. Category-level suggestions (e.g. "Mustard Oil", "Edible Oils", "Tea")
    const categoryMap = new Map<string, Product[]>();
    matchingProducts.forEach((p) => {
      const cat = p.category || 'Grocery';
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(p);
    });

    categoryMap.forEach((prods, catName) => {
      if (catName.toLowerCase().includes(q)) {
        addSuggestion({
          id: `cat-${catName}`,
          queryText: catName,
          displayText: catName,
          subtitle: `${prods.length} items in store`,
          badge: 'Category',
          representativeProduct: prods[0],
          type: 'category'
        });
      }
    });

    // 2. Extract smart concise query phrases from matching product titles (JioMart Style)
    // E.g. "Oil 1 L", "Mustard Oil", "Atta 5 kg", "Sunflower Oil", "Tea 500 g"
    matchingProducts.forEach((p) => {
      const name = p.product_name || '';
      const lower = name.toLowerCase();

      // Check for quantity patterns in title with query term (e.g., "1 L", "500 g", "5 kg", "1L")
      const qtyMatch = name.match(/(\d+\s*(?:l|kg|g|ml|litre|ltr|packet|pack|pc|pcs)\b)/i);
      if (qtyMatch) {
        const qty = qtyMatch[1];
        // Build phrase like "{query} {qty}" (e.g. "oil 1 L" or "atta 5 kg")
        const phrase = `${query.trim()} ${qty}`;
        if (lower.includes(query.trim().toLowerCase()) && lower.includes(qty.toLowerCase())) {
          addSuggestion({
            id: `phrase-qty-${p.ean}-${qty}`,
            queryText: phrase,
            displayText: phrase,
            subtitle: `Popular search in ${p.category || 'Grocery'}`,
            representativeProduct: p,
            type: 'phrase'
          });
        }
      }

      // Check for 2-3 word clean sub-phrase containing the query (e.g. "Mustard Oil", "Rice Bran Oil")
      const words = name.split(/\s+/);
      const queryIdx = words.findIndex((w) => w.toLowerCase().includes(q));
      if (queryIdx !== -1) {
        // Try word before + query word
        if (queryIdx > 0) {
          const twoWord = `${words[queryIdx - 1]} ${words[queryIdx]}`.replace(/[^\w\s-]/g, '').trim();
          if (twoWord.length > 3 && !twoWord.toLowerCase().match(/^\d+/)) {
            addSuggestion({
              id: `phrase-pre-${p.ean}-${twoWord}`,
              queryText: twoWord,
              displayText: twoWord,
              subtitle: `in ${p.category || 'Grocery'}`,
              representativeProduct: p,
              type: 'phrase'
            });
          }
        }
        // Try query word + word after
        if (queryIdx < words.length - 1) {
          const twoWordPost = `${words[queryIdx]} ${words[queryIdx + 1]}`.replace(/[^\w\s-]/g, '').trim();
          if (twoWordPost.length > 3) {
            addSuggestion({
              id: `phrase-post-${p.ean}-${twoWordPost}`,
              queryText: twoWordPost,
              displayText: twoWordPost,
              subtitle: `in ${p.category || 'Grocery'}`,
              representativeProduct: p,
              type: 'phrase'
            });
          }
        }
      }
    });

    // 3. Top individual matching products (Exact products with price tag)
    matchingProducts.forEach((p) => {
      const priceNum = Number(p.selling_price) || 0;
      addSuggestion({
        id: `prod-${p.ean}`,
        queryText: p.product_name,
        displayText: p.product_name,
        subtitle: p.category,
        price: priceNum > 0 ? priceNum : undefined,
        representativeProduct: p,
        type: 'product'
      });
    });

    return items.slice(0, 6);
  }, [query, catalog]);

  if (suggestions.length === 0) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden p-4 text-center">
        <p className="text-xs text-slate-500 font-medium">
          No matching items for <span className="font-bold text-slate-800">"{query}"</span>
        </p>
      </div>
    );
  }

  return (
    <div
      id="searchSuggestionsDropdown"
      role="listbox"
      aria-label="Search suggestions"
      className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200/80 z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-150"
    >
      {/* Suggestions List */}
      <div className="max-h-[340px] overflow-y-auto overscroll-contain">
        {suggestions.map((item, idx) => {
          const isSelected = activeIndex === idx;
          const imageSrc = resolveProductImage(item.representativeProduct);

          return (
            <div
              key={item.id}
              role="option"
              aria-selected={isSelected}
              onMouseDown={(e) => {
                // Prevent input blur before click registers
                e.preventDefault();
              }}
              onClick={() => onSelect(item.queryText, item.type === 'product' ? item.representativeProduct : undefined)}
              className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors select-none ${
                isSelected ? 'bg-amber-50 text-amber-900' : 'hover:bg-slate-50 active:bg-slate-100'
              }`}
            >
              {/* Product Thumbnail (36x36px rounded square with subtle border) */}
              <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center p-0.5 shrink-0 overflow-hidden shadow-2xs">
                <img
                  src={imageSrc}
                  alt={item.displayText}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={(e) =>
                    handleProductImageError(
                      e,
                      item.representativeProduct.backup_image_url,
                      String(item.representativeProduct.ean)
                    )
                  }
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>

              {/* Suggestion Text & Subtitle */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-slate-800 leading-snug truncate">
                    <HighlightText text={item.displayText} query={query} />
                  </span>
                  {item.badge && (
                    <span className="shrink-0 text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                      {item.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  {item.price !== undefined ? (
                    <span className="text-[11px] font-bold text-emerald-600">
                      ₹{item.price}
                      {Number(item.representativeProduct.mrp) > item.price && (
                        <span className="text-[10px] text-slate-400 font-normal line-through ml-1">
                          ₹{item.representativeProduct.mrp}
                        </span>
                      )}
                    </span>
                  ) : null}
                  {item.subtitle && (
                    <span className="text-[10px] text-slate-400 font-medium truncate">
                      {item.subtitle}
                    </span>
                  )}
                </div>
              </div>

              {/* Action indicator icon */}
              <div className="shrink-0 text-slate-300 group-hover:text-slate-500 pl-1">
                {item.type === 'product' ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowUpLeft className="w-3.5 h-3.5" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* "Show all results for '...'" bottom row */}
      <div
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onSelect(query.trim())}
        className="px-3.5 py-2.5 bg-slate-50 hover:bg-amber-50/70 active:bg-amber-100/70 cursor-pointer transition-colors flex items-center justify-between gap-2 border-t border-slate-100 select-none group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-full bg-[#0c2340]/5 group-hover:bg-[#0c2340] group-hover:text-white text-[#0c2340] flex items-center justify-center shrink-0 transition-colors">
            <Search className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-[#0c2340] truncate">
            Show all results for <span className="font-extrabold text-[#0c2340]">"{query.trim()}"</span>
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0c2340] shrink-0 transition-colors" />
      </div>
    </div>
  );
};
