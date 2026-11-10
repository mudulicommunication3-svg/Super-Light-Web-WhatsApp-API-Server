import React from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage, Translations } from '../context/LanguageContext';

interface CategoryItem {
  id: string;
  nameKey: keyof Translations;
  emoji: string;
}

export const CATEGORIES: CategoryItem[] = [
  { id: 'All', nameKey: 'all', emoji: '🛒' },
  { id: 'Mobile & Electronics', nameKey: 'mobileElectronics', emoji: '📱' },
  { id: 'Oil', nameKey: 'oilMasalas', emoji: '🛢️' },
  { id: 'Atta & Rice', nameKey: 'attaRice', emoji: '🌾' },
  { id: 'Biscuits', nameKey: 'biscuits', emoji: '🍪' },
  { id: 'Tea & Drinks', nameKey: 'teaDrinks', emoji: '☕' },
  { id: 'Snacks & Noodles', nameKey: 'snacksNoodles', emoji: '🍜' },
  { id: 'Spices', nameKey: 'spices', emoji: '🌶️' },
  { id: 'Personal Care', nameKey: 'personalCare', emoji: '🧼' },
  { id: 'Cleaning', nameKey: 'cleaning', emoji: '🧹' },
  { id: 'Baby Care', nameKey: 'babyCare', emoji: '👶' },
];

export const CategoryPills: React.FC = () => {
  const { activeCategory, setActiveCategory } = useApp();
  const { t } = useLanguage();

  const handleSelect = (catName: string) => {
    if (activeCategory === catName) {
      setActiveCategory('All');
    } else {
      setActiveCategory(catName);
    }
  };

  return (
    <section id="categorySection" className="max-w-md mx-auto px-3.5 mt-3">
      {/* Horizontal scrolling row of circular category chips */}
      <div
        className="flex items-start gap-3 overflow-x-auto no-scrollbar py-1 overscroll-x-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y',
        }}
      >
        {CATEGORIES.map((c) => {
          const isSelected =
            (c.id === 'All' && (!activeCategory || activeCategory === 'All')) ||
            activeCategory === c.id;

          return (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              className="flex flex-col items-center shrink-0 w-[68px] cursor-pointer group focus:outline-none"
            >
              <div
                className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white flex items-center justify-center text-2xl mx-auto shadow-2xs transition-all duration-200 border ${
                  isSelected
                    ? 'ring-2 ring-emerald-500 bg-emerald-50/80 border-emerald-300 scale-105 shadow-sm'
                    : 'border-slate-200/80 group-hover:bg-slate-50 active:scale-95'
                }`}
              >
                {c.emoji}
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-semibold text-slate-700 mt-1.5 text-center leading-tight truncate w-full ${
                  isSelected ? 'text-emerald-700 font-extrabold' : ''
                }`}
              >
                {t(c.nameKey)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default CategoryPills;
