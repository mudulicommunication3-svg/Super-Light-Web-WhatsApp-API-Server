# Munna Mobile & Grocery (React + TypeScript + Vite)

Bilingual (Odia & English) mobile-first e-commerce and grocery store application for **MUNNA MOBILE & GROCERY** located in Niali, Odisha (PIN 754004).

## Features

- **Storefront & Catalog**:
  - Live search by product name, category, or EAN barcode.
  - Category filters (Grocery, Sunflower Oil, Nutritional Drinks, Mobile Accessories, etc.).
  - 5-slide dynamic promotional offers carousel with dot indicators.
  - Real-time stock status (in-stock, low-stock warning ≤5, and out-of-stock badges).
  - Flipkart/JioMart style floating cart summary bar.
- **Product Details ("One Product One Page")**:
  - High-res product images with discount percentage badges.
  - Price & savings breakdown.
  - Similar products carousel from the same category.
  - Quantity stepper and direct **Buy Now** or **Add to Cart** action bar.
  - Web share / link copy support.
- **Cart & 4-Step Checkout Flow**:
  - Step 1: Cart review with quantity stepper, subtotal, coupon code application (e.g., `MUNNA10`), and delivery timing badge.
  - Step 2: Address selection and interactive **Leaflet 3 KM Delivery Zone Map** centered on Cinema Hall Road, Niali, with GPS Auto-Locate and road distance checking (OSRM/Haversine).
  - Step 3: Delivery method selection — **Home Delivery (Cash on Delivery)** or **Store Pickup** with time slot selection (30 min, 1 hour, 2 hour).
  - Step 4: Order confirmation screen with Order ID, summary breakdown, and confetti celebration.
- **Live 5-Stage Order Tracking**:
  - 1. Order Placed (ଅର୍ଡର ଗ୍ରହଣ ହେଲା)
  - 2. Accepted (ଦୋକାନୀ ଅର୍ଡର ଗ୍ରହଣ କଲେ)
  - 3. Packing (ପ୍ୟାକିଂ ଓ ଷ୍ଟକ୍ ଯାଞ୍ଚ ସରିଲା)
  - 4. Out for Delivery (ଡେଲିଭରୀ ବାହାରିଛି)
  - 5. Delivered (ସଫଳତାର ସହ ପହଞ୍ଚିଲା)
  - Order search by 10-digit mobile number and pre-dispatch order cancellation.
- **Customer Accounts & Saved Addresses**:
  - Mobile + password login and registration.
  - Multiple saved delivery addresses with GPS coordinates and default address selection.
  - Bilingual language switcher between Odia (OD) and English (EN).
- **Store Admin Panel & Incoming Order Alert**:
  - Secure admin authentication (Default: `1111111111` / `1111111111`).
  - WhatsApp/Telegram-style full-screen incoming order call ring overlay with Accept / Reject / Review quick response buttons.
  - 5-stage order fulfillment and status updating.
  - Smart JioMart search and catalog manager (add/edit products, stock counts, pricing).
  - Stock health reporting (out of stock and low stock alerts).
  - Banners and broadcast customer announcements manager.
  - Shop controls: open/closed toggles, delivery fees, free delivery threshold, pickup slots, and coupons.
  - Barcode & QR camera scanner POS for Quick Bill in-store counter checkout.

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Bundler & Dev Server**: Vite
- **Styling**: Tailwind CSS v4 with mobile-optimized layout
- **Map & Geolocation**: Leaflet with OpenStreetMap
- **Barcode & QR Scanner**: html5-qrcode
- **Database & Backend Sync**: Google Apps Script Webhook API with offline resilience
