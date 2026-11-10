import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'en' | 'or';

export interface Translations {
  // Header & Delivery
  delivery: string;
  pickup: string;
  search: string;
  storeName: string;
  storeLocation: string;
  cinemaHallRoad: string;
  kmZone: string;
  storeClosed: string;
  homeDelivery: string;
  storePickup: string;
  available: string;
  closed: string;
  today: string;
  tomorrow: string;

  // Banner
  dailySpecial: string;
  headline: string;
  shopNow: string;

  // Categories
  all: string;
  vegetables: string;
  fruits: string;
  attaRice: string;
  oilMasalas: string;
  dairy: string;
  packagedFoods: string;
  biscuits: string;
  teaDrinks: string;
  spices: string;
  personalCare: string;
  cleaning: string;
  babyCare: string;
  snacksNoodles: string;
  mobileElectronics: string;

  // Actions & Badges
  add: string;
  inStock: string;
  outOfStock: string;
  bestDeals: string;
  trendingOffers: string;
  popularItems: string;
  newArrivals: string;
  save: string;
  deals: string;
  items: string;
  noProductsFound: string;
  trySearching: string;
  onlyLeft: string;

  // Cart & Checkout
  cart: string;
  myCart: string;
  itemTotal: string;
  deliveryFee: string;
  totalBill: string;
  proceedToPay: string;
  emptyCart: string;
  startShopping: string;
  viewCart: string;
  checkout: string;

  // Bottom Nav
  home: string;
  searchNav: string;
  categories: string;
  profile: string;

  // Product Detail
  productDetails: string;
  similarProducts: string;
  similarProductsHeading: string;
  buyNow: string;
  addToCart: string;
  share: string;
  copied: string;
  ratingsCount: string;
  fastDelivery: string;
  genuineGuarantee: string;
  storeSupport: string;
  unitsAvailable: string;

  // Profile & Language Selector
  appLanguage: string;
  english: string;
  odia: string;
  welcomeGuest: string;
  loginSignUp: string;
  logout: string;
  myOrders: string;
  savedAddresses: string;
  adminPortal: string;

  // Wishlist & Sharing
  wishlist: string;
  myWishlist: string;
  emptyWishlist: string;
  emptyWishlistDesc: string;
  exploreProducts: string;
  shareSuccess: string;
  addedToWishlist: string;
  removedFromWishlist: string;

  // Smart Authentication System
  step1Title: string;
  mobileNumber: string;
  password: string;
  continueBtn: string;
  newUserDetected: string;
  fullName: string;
  confirmPassword: string;
  createAccount: string;
  incorrectPassword: string;
  passwordsDoNotMatch: string;
  enterValidPhone: string;
  enterFullName: string;
  passwordMinLength: string;
  loginSuccess: string;
  accountCreated: string;
  checkingAccount: string;
  creatingAccount: string;
  backToStep1: string;
}

const DICTIONARY: Record<Language, Translations> = {
  en: {
    // Header & Delivery
    delivery: 'Delivery in 1 hour',
    pickup: 'Store Pickup Available',
    search: 'Search for groceries, vegetables, and more...',
    storeName: 'Munna Grocery',
    storeLocation: 'Niali, 754004',
    cinemaHallRoad: 'Cinema Hall Road, Niali, 754004',
    kmZone: '3 KM Zone',
    storeClosed: 'Store Closed',
    homeDelivery: 'Home Delivery',
    storePickup: 'Store Pickup',
    available: 'Available ✅',
    closed: 'Closed',
    today: 'Today',
    tomorrow: 'Tomorrow',

    // Banner
    dailySpecial: 'DAILY SPECIAL',
    headline: 'Fresh Fruits & Vegetables - Up to 50% Off!',
    shopNow: 'Shop Now',

    // Categories
    all: 'All',
    vegetables: 'Vegetables',
    fruits: 'Fruits',
    attaRice: 'Atta & Rice',
    oilMasalas: 'Edible Oils',
    dairy: 'Dairy',
    packagedFoods: 'Packaged Foods',
    biscuits: 'Biscuits',
    teaDrinks: 'Tea & Drinks',
    spices: 'Masala & Spices',
    personalCare: 'Soaps & Care',
    cleaning: 'Detergents',
    babyCare: 'Baby Care',
    snacksNoodles: 'Snacks & Noodles',
    mobileElectronics: 'Mobile & Electronics',

    // Actions & Badges
    add: 'ADD +',
    inStock: 'In Stock',
    outOfStock: 'Out of Stock',
    bestDeals: 'Best Offers & Deals',
    trendingOffers: 'Trending Offers',
    popularItems: 'Popular Items',
    newArrivals: 'New Items / New Arrivals',
    save: 'Save',
    deals: 'deals',
    items: 'items',
    noProductsFound: 'No products found',
    trySearching: 'Try searching something else',
    onlyLeft: 'Only {count} left',

    // Cart & Checkout
    cart: 'Cart',
    myCart: 'My Cart',
    itemTotal: 'Item Total',
    deliveryFee: 'Delivery Fee',
    totalBill: 'Total Payable',
    proceedToPay: 'Proceed to Pay',
    emptyCart: 'Your cart is empty',
    startShopping: 'Start Shopping',
    viewCart: 'View Cart',
    checkout: 'Checkout',

    // Bottom Nav
    home: 'Home',
    searchNav: 'Search',
    categories: 'Categories',
    profile: 'Profile',

    // Product Detail
    productDetails: 'Product Details',
    similarProducts: 'Similar Products',
    similarProductsHeading: 'Similar Products (ଏହିପରି ଅନ୍ୟ ସାମଗ୍ରୀ)',
    buyNow: 'Buy Now',
    addToCart: 'Add to Cart',
    share: 'Share',
    copied: 'Copied',
    ratingsCount: '120+ ratings',
    fastDelivery: '10–15 Mins Delivery',
    genuineGuarantee: '100% Genuine Quality Guarantee',
    storeSupport: 'Easy replacement / Store support at Cinema Hall Road, Niali',
    unitsAvailable: '{count} units available',

    // Profile & Language Selector
    appLanguage: 'App Language / ଭାଷା ଚୟନ',
    english: 'English',
    odia: 'ଓଡ଼ିଆ',
    welcomeGuest: 'Welcome Guest',
    loginSignUp: 'Login / Sign Up',
    logout: 'Logout',
    myOrders: 'My Orders & Tracking',
    savedAddresses: 'Saved Addresses',
    adminPortal: 'Admin Management Portal',

    // Wishlist & Sharing
    wishlist: 'Wishlist',
    myWishlist: 'My Wishlist',
    emptyWishlist: 'Your wishlist is empty',
    emptyWishlistDesc: 'Explore products and tap the heart icon to save them for later.',
    exploreProducts: 'Explore Products',
    shareSuccess: 'Product link copied to clipboard!',
    addedToWishlist: 'Added to wishlist ❤️',
    removedFromWishlist: 'Removed from wishlist',

    // Smart Authentication System
    step1Title: 'Enter your Mobile & Password',
    mobileNumber: '10-Digit Mobile Number',
    password: 'Password',
    continueBtn: 'Continue / ଆଗକୁ ବଢ଼ନ୍ତୁ',
    newUserDetected: 'New user detected! Complete your profile:',
    fullName: 'Full Name',
    confirmPassword: 'Confirm Password',
    createAccount: 'Create Account / ଆକାଉଣ୍ଟ୍ ଖୋଲନ୍ତୁ',
    incorrectPassword: 'Incorrect Password! Please try again.',
    passwordsDoNotMatch: 'Passwords do not match! Please check again.',
    enterValidPhone: 'Please enter a valid 10-digit mobile number.',
    enterFullName: 'Please enter your full name.',
    passwordMinLength: 'Password must be at least 6 characters long.',
    loginSuccess: 'Login successful!',
    accountCreated: 'Account created successfully!',
    checkingAccount: 'Checking account...',
    creatingAccount: 'Creating account...',
    backToStep1: 'Change Mobile Number'
  },
  or: {
    // Header & Delivery
    delivery: 'ଆସିବ 1 ଘଣ୍ଟାରେ',
    pickup: 'ଦୋକାନରୁ ଉପଲବ୍ଧ',
    search: 'ସାମଗ୍ରୀ ଖୋଜନ୍ତୁ...',
    storeName: 'Munna Grocery',
    storeLocation: 'ନିଆଳି, ୭୫୪୦୦୪',
    cinemaHallRoad: 'ସିନେମା ହଲ୍ ରୋଡ୍, ନିଆଳି, ୭୫୪୦୦୪',
    kmZone: '୩ କି.ମି. ଜୋନ୍',
    storeClosed: 'ଦୋକାନ ବନ୍ଦ ଅଛି',
    homeDelivery: 'ଘରେ ଡେଲିଭରୀ',
    storePickup: 'ଦୋକାନରୁ ପିକଅପ୍',
    available: 'ଉପଲବ୍ଧ ✅',
    closed: 'ବନ୍ଦ',
    today: 'ଆଜି',
    tomorrow: 'ଆସନ୍ତାକାଲି',

    // Banner
    dailySpecial: 'ଦୈନିକ ସ୍ୱତନ୍ତ୍ର',
    headline: 'ତାଜା ଫଳ ଓ ପନିପରିବା - 50% ପର୍ଯ୍ୟନ୍ତ ଛାଡ଼!',
    shopNow: 'ଏବେ କିଣନ୍ତୁ',

    // Categories
    all: 'ସବୁ ସାମଗ୍ରୀ',
    vegetables: 'ପନିପରିବା',
    fruits: 'ଫଳ',
    attaRice: 'ଅଟା ଓ ଚାଉଳ',
    oilMasalas: 'ତେଲ ଓ ଘିଅ',
    dairy: 'କ୍ଷୀର ଜାତୀୟ',
    packagedFoods: 'ପ୍ୟାକେଟ୍ ଖାଦ୍ୟ',
    biscuits: 'ବିସ୍କୁଟ୍',
    teaDrinks: 'ଚାହା ଓ ହର୍ଲିକ୍ସ',
    spices: 'ମସଲା',
    personalCare: 'ସାବୁନ ଓ କେୟାର',
    cleaning: 'ସର୍ଫ ଓ ଡିଟରଜେଣ୍ଟ',
    babyCare: 'ଶିଶୁ ଯତ୍ନ',
    snacksNoodles: 'ସ୍ନାକ୍ସ ଓ ନୁଡୁଲ୍ସ',
    mobileElectronics: 'ମୋବାଇଲ୍ ଓ ଇଲେକ୍ଟ୍ରୋନିକ୍ସ',

    // Actions & Badges
    add: 'ଯୋଡ଼ନ୍ତୁ +',
    inStock: 'ଷ୍ଟକ୍ ଅଛି',
    outOfStock: 'ସରିଯାଇଛି',
    bestDeals: 'ଶ୍ରେଷ୍ଠ ଅଫର୍',
    trendingOffers: 'ଟ୍ରେଣ୍ଡିଂ ଅଫର',
    popularItems: 'ଲୋକପ୍ରିୟ ସାମଗ୍ରୀ',
    newArrivals: 'ନୂତନ ସାମଗ୍ରୀ (New Arrivals)',
    save: 'ସଞ୍ଚୟ',
    deals: 'ଅଫର୍',
    items: 'ଟି ସାମଗ୍ରୀ',
    noProductsFound: 'କୌଣସି ସାମଗ୍ରୀ ମିଳିଲା ନାହିଁ',
    trySearching: 'ଅନ୍ୟ କିଛି ଶବ୍ଦ ଖୋଜନ୍ତୁ।',
    onlyLeft: 'କେବଳ {count} ବଳିଛି',

    // Cart & Checkout
    cart: 'କାର୍ଟ',
    myCart: 'ମୋ କାର୍ଟ',
    itemTotal: 'ମୋଟ ମୂଲ୍ୟ',
    deliveryFee: 'ଡେଲିଭରୀ ଫି',
    totalBill: 'ଦେୟ ରାଶି',
    proceedToPay: 'ପେମେଣ୍ଟ କରନ୍ତୁ',
    emptyCart: 'କାର୍ଟ ଖାଲି ଅଛି',
    startShopping: 'ସଉଦା କିଣନ୍ତୁ',
    viewCart: 'କାର୍ଟ ଦେଖନ୍ତୁ',
    checkout: 'ଅର୍ଡର କରନ୍ତୁ',

    // Bottom Nav
    home: 'ହୋମ୍',
    searchNav: 'ସନ୍ଧାନ',
    categories: 'ବର୍ଗ',
    profile: 'ପ୍ରୋଫାଇଲ୍',

    // Product Detail
    productDetails: 'ପ୍ରୋଡକ୍ଟ ବିବରଣୀ',
    similarProducts: 'ସମାନ ସାମଗ୍ରୀ',
    similarProductsHeading: 'Similar Products (ଏହିପରି ଅନ୍ୟ ସାମଗ୍ରୀ)',
    buyNow: 'ଏବେ କିଣନ୍ତୁ',
    addToCart: 'କାର୍ଟରେ ଯୋଡ଼ନ୍ତୁ',
    share: 'ସେୟାର୍',
    copied: 'କପି ହୋଇଛି',
    ratingsCount: '୧୨୦+ ରେଟିଂ',
    fastDelivery: '୧୦–୧୫ ମିନିଟ୍‌ରେ ଡେଲିଭରୀ',
    genuineGuarantee: '୧୦୦% ଅସଲି ଗୁଣବତ୍ତା ନିଶ୍ଚିତ',
    storeSupport: 'ସହଜ ରିପ୍ଲେସମେଣ୍ଟ / ସିନେମା ହଲ୍ ରୋଡ୍, ନିଆଳିରେ ଦୋକାନ ସହାୟତା',
    unitsAvailable: '{count} ଟି ଉପଲବ୍ଧ',

    // Profile & Language Selector
    appLanguage: 'App Language / ଭାଷା ଚୟନ',
    english: 'English',
    odia: 'ଓଡ଼ିଆ',
    welcomeGuest: 'ଅତିଥି ଗ୍ରାହକ',
    loginSignUp: 'ଲଗଇନ୍ / Sign Up କରନ୍ତୁ',
    logout: 'ଲଗଆଉଟ୍ କରନ୍ତୁ',
    myOrders: 'ମୋ ଅର୍ଡର ଟ୍ରାକିଂ',
    savedAddresses: 'ସଂରକ୍ଷିତ ଠିକଣା',
    adminPortal: 'ଆଡମିନ୍ ପୋର୍ଟାଲ୍',

    // Wishlist & Sharing
    wishlist: 'ଇଚ୍ଛା ତାଲିକା',
    myWishlist: 'ମୋ ଇଚ୍ଛା ତାଲିକା',
    emptyWishlist: 'ଆପଣଙ୍କ ଇଚ୍ଛା ତାଲିକା ଖାଲି ଅଛି',
    emptyWishlistDesc: 'ସାମଗ୍ରୀ ଦେଖନ୍ତୁ ଏବଂ ପରେ କିଣିବା ପାଇଁ ହାର୍ଟ ଆଇକନ୍ ଦବାନ୍ତୁ।',
    exploreProducts: 'ସାମଗ୍ରୀ ଦେଖନ୍ତୁ',
    shareSuccess: 'ପ୍ରୋଡକ୍ଟ ଲିଙ୍କ୍ କପି ହୋଇଛି!',
    addedToWishlist: 'ଇଚ୍ଛା ତାଲିକାରେ ଯୋଡ଼ାଗଲା ❤️',
    removedFromWishlist: 'ଇଚ୍ଛା ତାଲିକାରୁ ବାହାର କରାଗଲା',

    // Smart Authentication System
    step1Title: 'ମୋବାଇଲ୍ ନମ୍ବର ଓ ପାସୱାର୍ଡ ଦିଅନ୍ତୁ',
    mobileNumber: '୧୦-ଅଙ୍କ ମୋବାଇଲ୍ ନମ୍ବର',
    password: 'ପାସୱାର୍ଡ',
    continueBtn: 'Continue / ଆଗକୁ ବଢ଼ନ୍ତୁ',
    newUserDetected: 'ନୂଆ ଗ୍ରାହକ ଚିହ୍ନଟ ହୋଇଛନ୍ତି! ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ୍ ପୂରଣ କରନ୍ତୁ:',
    fullName: 'ସମ୍ପୂର୍ଣ୍ଣ ନାମ (Full Name)',
    confirmPassword: 'ପାସୱାର୍ଡ ନିଶ୍ଚିତ କରନ୍ତୁ (Confirm)',
    createAccount: 'Create Account / ଆକାଉଣ୍ଟ୍ ଖୋଲନ୍ତୁ',
    incorrectPassword: 'Incorrect Password! Please try again.',
    passwordsDoNotMatch: 'ଦୁଇଟିଯାକ ପାସୱାର୍ଡ ମେଳ ଖାଉନାହିଁ!',
    enterValidPhone: 'ଦୟାକରି ଠିକ୍ ୧୦-ଅଙ୍କ ବିଶିଷ୍ଟ ମୋବାଇଲ୍ ନମ୍ବର ଦିଅନ୍ତୁ।',
    enterFullName: 'ଦୟାକରି ଆପଣଙ୍କ ସମ୍ପୂର୍ଣ୍ଣ ନାମ ଲେଖନ୍ତୁ।',
    passwordMinLength: 'ପାସୱାର୍ଡ ଅନ୍ତତଃ ୬ ଅକ୍ଷର ହେବା ଆବଶ୍ୟକ।',
    loginSuccess: 'ସଫଳତାର ସହ ଲଗଇନ୍ ହେଲା!',
    accountCreated: 'ଆକାଉଣ୍ଟ୍ ସଫଳତାର ସହ ତିଆରି ହେଲା!',
    checkingAccount: 'ଯାଞ୍ଚ ହେଉଛି...',
    creatingAccount: 'ଆକାଉଣ୍ଟ୍ ଖୋଲାଯାଉଛି...',
    backToStep1: 'ମୋବାଇଲ୍ ନମ୍ବର ବଦଳାନ୍ତୁ'
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isEnglish: boolean;
  setIsEnglish: (isEn: boolean) => void;
  t: (key: keyof Translations, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem('user_lang');
      if (stored === 'en' || stored === 'or') return stored;
      const legacy = localStorage.getItem('munna_lang');
      if (legacy === 'od') return 'or';
      if (legacy === 'en') return 'en';
    } catch (e) {}
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('user_lang', lang);
      localStorage.setItem('munna_lang', lang === 'en' ? 'en' : 'od');
    } catch (e) {}
  };

  const isEnglish = language === 'en';
  const setIsEnglish = (isEn: boolean) => {
    setLanguage(isEn ? 'en' : 'or');
  };

  useEffect(() => {
    try {
      localStorage.setItem('user_lang', language);
      localStorage.setItem('munna_lang', language === 'en' ? 'en' : 'od');
    } catch (e) {}
  }, [language]);

  const t = (key: keyof Translations, params?: Record<string, string | number>): string => {
    let str = DICTIONARY[language]?.[key] || DICTIONARY.en[key] || String(key);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v));
      });
    }
    return str;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        isEnglish,
        setIsEnglish,
        t
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
