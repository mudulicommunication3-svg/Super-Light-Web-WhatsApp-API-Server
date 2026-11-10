import React from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { Home, Search, LayoutGrid, ShoppingBag, User } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { activeScreen, setActiveScreen, cart, setSelectedProduct, selectedProduct } = useApp();
  const { t } = useLanguage();

  const totalCartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const handleNav = (tab: 'home' | 'search' | 'categories' | 'cart' | 'profile') => {
    // Dismiss product detail page whenever navigating via bottom navigation
    setSelectedProduct(null);

    if (tab === 'home') {
      if (window.location.hash) {
        window.history.pushState(null, '', window.location.pathname + (window.location.search || ''));
      }
      setActiveScreen('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'search') {
      window.location.hash = 'search';
      setActiveScreen('home');
      setTimeout(() => {
        const input = document.getElementById('searchInput') as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    } else if (tab === 'categories') {
      window.location.hash = 'categories';
      setActiveScreen('home');
      setTimeout(() => {
        const catEl = document.getElementById('categorySection');
        if (catEl) {
          catEl.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 220, behavior: 'smooth' });
        }
      }, 50);
    } else if (tab === 'cart') {
      window.location.hash = 'cart';
      setActiveScreen('cart');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'profile') {
      window.location.hash = 'profile';
      setActiveScreen('profile');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div
      id="mainBottomNavigation"
      className="fixed bottom-0 left-0 right-0 z-[70] bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-md"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <nav
        className="h-16 flex items-center justify-around max-w-md mx-auto"
        aria-label="Main Navigation"
      >
        <div className="w-full grid grid-cols-5 text-[10px] font-bold h-full">
        {/* Home */}
        <button
          onClick={() => handleNav('home')}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors duration-200 ${
            activeScreen === 'home' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className={`w-4 h-4 transition-transform ${activeScreen === 'home' ? 'scale-110' : ''}`} />
          <span className="leading-none">{t('home')}</span>
        </button>

        {/* Search */}
        <button
          onClick={() => handleNav('search')}
          className="flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors duration-200 text-slate-500 hover:text-slate-800"
        >
          <Search className="w-4 h-4" />
          <span className="leading-none">{t('searchNav')}</span>
        </button>

        {/* Categories */}
        <button
          onClick={() => handleNav('categories')}
          className="flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors duration-200 text-slate-500 hover:text-slate-800"
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="leading-none">{t('categories')}</span>
        </button>

        {/* Cart */}
        <button
          onClick={() => handleNav('cart')}
          className={`flex flex-col items-center justify-center gap-1 relative cursor-pointer transition-colors duration-200 ${
            activeScreen === 'cart' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <ShoppingBag className={`w-4 h-4 transition-transform ${activeScreen === 'cart' ? 'scale-110' : ''}`} />
            {totalCartCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-white text-[8px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                {totalCartCount}
              </span>
            )}
          </div>
          <span className="leading-none">{t('cart')}</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => handleNav('profile')}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors duration-200 ${
            activeScreen === 'profile' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className={`w-4 h-4 transition-transform ${activeScreen === 'profile' ? 'scale-110' : ''}`} />
          <span className="leading-none">{t('profile')}</span>
        </button>
      </div>
    </nav>
  </div>
  );
};
