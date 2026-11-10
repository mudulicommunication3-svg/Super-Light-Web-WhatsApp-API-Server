import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowRight, Tag } from 'lucide-react';

export const Carousel: React.FC = () => {
  const { banners, catalog, setSelectedProduct, setActiveCategory } = useApp();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInteractingRef = useRef<boolean>(false);
  const interactionTimerRef = useRef<any>(null);

  const bannerList = banners && banners.length > 0 ? banners : [
    {
      id: 1,
      title: 'ଅଟା, ତେଲ ଓ ଡାଲି ହୋଲସେଲ୍ ଦରରେ!',
      img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80'
    },
    {
      id: 2,
      title: 'ମୋବାଇଲ୍ ବ୍ୟାକ୍ କଭର୍ ଓ UV ଗ୍ଲାସ୍ ଫ୍ଲାଟ୍ ୫୦% ରିହାତି',
      img: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=800&auto=format&fit=crop&q=80'
    },
    {
      id: 3,
      title: 'ଫ୍ରିଡମ୍ ସନଫ୍ଲାୱାର୍ ତେଲ ସ୍ପେଶାଲ୍ ଡିଲ୍',
      img: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&auto=format&fit=crop&q=80'
    }
  ];

  // Scroll to a specific slide index
  const scrollToSlide = useCallback((index: number) => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const targetLeft = index * container.clientWidth;
      container.scrollTo({
        left: targetLeft,
        behavior: 'smooth'
      });
    }
    setActiveIndex(index);
  }, []);

  // Update activeIndex on touch drag / scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    if (clientWidth > 0) {
      const newIndex = Math.round(scrollLeft / clientWidth);
      if (newIndex >= 0 && newIndex < bannerList.length && newIndex !== activeIndex) {
        setActiveIndex(newIndex);
      }
    }
  };

  // Temporarily pause auto-slide while user is interacting
  const handleTouchStart = () => {
    isInteractingRef.current = true;
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
  };

  const handleTouchEnd = () => {
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    interactionTimerRef.current = setTimeout(() => {
      isInteractingRef.current = false;
    }, 4000);
  };

  // Smooth horizontal auto-sliding every 4–5 seconds
  useEffect(() => {
    if (bannerList.length <= 1) return;

    const interval = setInterval(() => {
      if (isInteractingRef.current) return;

      setActiveIndex((prev) => {
        const next = (prev + 1) % bannerList.length;
        if (scrollRef.current) {
          const container = scrollRef.current;
          container.scrollTo({
            left: next * container.clientWidth,
            behavior: 'smooth'
          });
        }
        return next;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [bannerList.length]);

  // Click Action: Navigates to linked offer category, product, or smooth scrolls down to "Trending Offers"
  const handleBannerClick = (banner: any) => {
    // 1. Linked Product
    if (banner.ean) {
      const prod = catalog.find((p) => String(p.ean) === String(banner.ean));
      if (prod) {
        setSelectedProduct(prod);
        return;
      }
    }

    // 2. Linked Category
    if (banner.category) {
      setActiveCategory(banner.category);
      const catEl = document.getElementById('categorySection');
      if (catEl) {
        catEl.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }

    // 3. Smooth scroll down to "Trending Offers"
    const trendingSection = document.getElementById('trendingSection');
    if (trendingSection) {
      trendingSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 320, behavior: 'smooth' });
    }
  };

  return (
    <section className="max-w-md mx-auto px-3.5 mt-3">
      {/* Required Container: w-full overflow-hidden rounded-2xl sm:rounded-3xl shadow-sm mb-4 relative */}
      <div className="w-full overflow-hidden rounded-2xl sm:rounded-3xl shadow-sm mb-4 relative bg-slate-100 border border-slate-200/80">
        {/* Responsive Aspect Ratio Container: w-full aspect-[21/9] sm:aspect-[16/6] md:aspect-[3/1] max-h-56 sm:max-h-72 */}
        <div className="w-full aspect-[21/9] sm:aspect-[16/6] md:aspect-[3/1] max-h-56 sm:max-h-72 relative">
          {/* Touch Drag/Swipe Gestures: overflow-x-auto snap-x snap-mandatory flex */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="w-full h-full overflow-x-auto snap-x snap-mandatory flex no-scrollbar scroll-smooth overscroll-x-contain"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
            }}
          >
            {bannerList.map((banner, idx) => (
              <div
                key={banner.id || idx}
                onClick={() => handleBannerClick(banner)}
                className="w-full h-full shrink-0 snap-center relative cursor-pointer select-none group"
                role="button"
                tabIndex={0}
                aria-label={banner.title || `Offer Banner ${idx + 1}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleBannerClick(banner);
                  }
                }}
              >
                {/* Edge-to-edge full promotional campaign image */}
                <img
                  src={banner.img}
                  alt={banner.title || 'Promotional Offer'}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover sm:object-contain rounded-2xl sm:rounded-3xl transition-transform duration-500 group-hover:scale-[1.01]"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80';
                  }}
                />

                {/* Subtle bottom gradient overlay for legible campaign text & badges */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-3 pt-6 flex items-end justify-between pointer-events-none rounded-b-2xl sm:rounded-b-3xl">
                  {banner.title && (
                    <div className="max-w-[75%] pr-2">
                      <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-white drop-shadow-md leading-tight line-clamp-1">
                        <Tag className="w-3 h-3 text-amber-300 shrink-0" />
                        <span>{banner.title}</span>
                      </span>
                    </div>
                  )}
                  <span className="text-[10px] text-white/90 font-bold bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-full flex items-center gap-0.5 ml-auto">
                    <span>Explore</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Clean pagination dots at bottom center: Small sleek pill indicators */}
          {bannerList.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/30 backdrop-blur-xs pointer-events-auto">
              {bannerList.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollToSlide(idx);
                  }}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    idx === activeIndex
                      ? 'w-5 bg-emerald-600'
                      : 'w-2 bg-white/70 hover:bg-white'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Carousel;
