/* munnamobile :: js/checkout.js
   Modern Blinkit/Zepto Cart & Checkout workflow: item cards, steppers, map, and billing */

var STORE_LAT = 20.132475;
var STORE_LNG = 86.059808;
var MAX_RADIUS_KM = 3.0;

var customerLat = STORE_LAT;
var customerLng = STORE_LNG;
var isWithinRadius = true;
var checkoutMap = null;
var deliveryMarker = null;
var selectedDeliveryType = 'delivery'; // 'delivery' | 'pickup'

function openCartDrawer() {
  if (typeof showScreen === "function") showScreen('cart');
}

function closeCartDrawer() {
  if (typeof showScreen === "function") showScreen('home');
}

function renderCartDrawer() {
  var container = document.getElementById('cartItemsContainer');
  if (!container) return;

  var items = Object.keys(typeof cart !== "undefined" ? cart : {});

  // Saved default address preview in cart
  var addrEl = document.getElementById('cartAddrText');
  if (addrEl && typeof getAddresses === "function") {
    var addrs = getAddresses() || [];
    var def = addrs.filter(function (a) { return a.isDefault; })[0] || addrs[0];
    addrEl.innerText = def ? ('📍 ' + def.name + ' — ' + def.address) : '📍 ଡେଲିଭରୀ ଠିକଣା ଯୋଡ଼ନ୍ତୁ';
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="py-10 text-center space-y-2">
        <div class="w-12 h-12 rounded-full bg-blue-50 text-[#1864ab] flex items-center justify-center mx-auto">
          <i class="ph-bold ph-shopping-bag text-2xl"></i>
        </div>
        <p class="text-xs text-slate-500 font-bold">କାର୍ଟ ଖାଲି ଅଛି (Cart is empty)</p>
        <p class="text-[10px] text-slate-400">କିଛି ସାମଗ୍ରୀ ଯୋଡ଼ିବା ପରେ ଏଠାରେ ଦେଖାଯିବ।</p>
      </div>
    `;
    updateBillingSummary();
    return;
  }

  container.innerHTML = items.map(function (ean) {
    var p = (window.STORE_CATALOG || []).find(function (x) { return String(x.ean) === String(ean); });
    if (!p) return '';
    var qty = cart[ean];
    var price = parseFloat(p.selling_price) || 0;
    var sub = price * qty;
    var stockN = parseInt(p.stock_qty, 10);
    if (isNaN(stockN)) stockN = 10;

    return `
      <div class="bg-slate-50/80 p-2.5 rounded-2xl border border-slate-100 flex items-center justify-between gap-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div class="w-12 h-12 rounded-xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shrink-0">
          <img src="${p.image_url || 'icon-512.png'}" alt="${p.product_name}" class="w-full h-full object-contain mix-blend-multiply" onerror="this.src='icon-512.png'">
        </div>
        <div class="flex-1 min-w-0">
          <h5 class="text-xs font-bold text-slate-800 truncate">${p.product_name}</h5>
          <div class="flex items-baseline gap-1 mt-0.5">
            <span class="text-xs font-black text-slate-900">Rs.${typeof money === "function" ? money(sub) : sub}</span>
            <span class="text-[10px] text-slate-400 font-semibold">(Rs.${typeof money === "function" ? money(price) : price} x${qty})</span>
          </div>
        </div>
        <!-- High-contrast modern quantity stepper -->
        <div class="flex items-center gap-1.5 shrink-0">
          <div class="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
            <button onclick="setQty('${ean}', ${qty - 1})" class="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs font-black text-slate-700 active:scale-90 cursor-pointer">
              <i class="ph-bold ph-minus"></i>
            </button>
            <span class="font-black text-xs w-6 text-center text-slate-800">${qty}</span>
            <button onclick="setQty('${ean}', ${qty + 1})" class="w-6 h-6 rounded-lg bg-[#1864ab] hover:bg-blue-800 flex items-center justify-center text-xs font-black text-white active:scale-90 cursor-pointer">
              <i class="ph-bold ph-plus"></i>
            </button>
          </div>
          <button onclick="setQty('${ean}', 0)" class="w-7 h-7 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer" title="Remove item">
            <i class="ph-bold ph-trash text-sm"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  updateBillingSummary();
}

function cartBilling() {
  var subtotal = 0;
  var items = typeof cart !== "undefined" ? cart : {};
  Object.keys(items).forEach(function (ean) {
    var p = (window.STORE_CATALOG || []).find(function (x) { return String(x.ean) === String(ean); });
    if (p) subtotal += (parseFloat(p.selling_price) || 0) * items[ean];
  });

  var cfg = window.shopConfig || { freeAbove: 500, deliveryFee: 30, couponPercent: 0, couponMinBill: 0 };
  var freeAbove = cfg.freeAbove || 0;
  var isPickupSel = selectedDeliveryType === 'pickup';

  var delivery = (!isPickupSel && subtotal > 0 && (freeAbove <= 0 || subtotal < freeAbove))
    ? (cfg.deliveryFee || 0) : 0;
  var pickup = (isPickupSel && cfg.pickupChargeOn && subtotal > 0)
    ? Math.max(0, cfg.pickupChargeFee || 0) : 0;

  var discount = 0;
  var code = String((typeof appliedCoupon !== "undefined" ? appliedCoupon : "") || '').trim().toUpperCase();
  if (code && cfg.couponCode && code === String(cfg.couponCode).trim().toUpperCase() && subtotal >= (cfg.couponMinBill || 0)) {
    discount = Math.round(subtotal * (cfg.couponPercent || 0)) / 100;
  }

  return {
    subtotal: subtotal,
    delivery: delivery,
    pickup: pickup,
    discount: discount,
    total: Math.max(0, subtotal + delivery + pickup - discount)
  };
}

function updateBillingSummary() {
  var b = cartBilling();
  var setVal = function (id, v) {
    var el = document.getElementById(id);
    if (el) el.innerText = v;
  };

  setVal('summarySubtotal', 'Rs.' + (typeof money === "function" ? money(b.subtotal) : b.subtotal));

  var charge = selectedDeliveryType === 'pickup' ? (b.pickup || 0) : (b.delivery || 0);
  var chargeLabel = selectedDeliveryType === 'pickup' ? '🛍️ Pickup ଚାର୍ଜ:' : '🚚 ଡେଲିଭରି ଚାର୍ଜ:';

  var chargeEl = document.getElementById('summaryDeliveryRow');
  var chargeLabelEl = document.getElementById('summaryDeliveryLabel');
  var chargeValEl = document.getElementById('summaryDeliveryCharge');

  if (chargeEl) {
    chargeEl.classList.toggle('hidden', charge <= 0);
    if (chargeLabelEl) chargeLabelEl.textContent = chargeLabel;
    if (chargeValEl) chargeValEl.textContent = charge > 0 ? ('Rs.' + (typeof money === "function" ? money(charge) : charge)) : 'ମାଗଣା ✅';
  }

  var disRow = document.getElementById('summaryDiscountRow');
  var disEl = document.getElementById('summaryDiscount');
  if (disRow && disEl) {
    disRow.classList.toggle('hidden', b.discount <= 0);
    disEl.innerText = '-Rs.' + (typeof money === "function" ? money(b.discount) : b.discount);
  }

  setVal('summaryTotal', 'Rs.' + (typeof money === "function" ? money(b.total) : b.total));

  // Payment view live mirrors
  setVal('paySubtotal', 'Rs.' + (typeof money === "function" ? money(b.subtotal) : b.subtotal));
  setVal('payTotal', 'Rs.' + (typeof money === "function" ? money(b.total) : b.total));
}

function setStep(stepName) {
  ['stepCart', 'stepAddress', 'stepPayment', 'stepSuccess'].forEach(function (s) {
    var el = document.getElementById(s);
    if (el) el.classList.toggle('hidden', s !== ('step' + stepName));
  });
}

function goCheckoutAddress() {
  var items = Object.keys(typeof cart !== "undefined" ? cart : {});
  if (items.length === 0) {
    alert("କାର୍ଟ ଖାଲି ଅଛି! ସାମଗ୍ରୀ ଯୋଡ଼ନ୍ତୁ।");
    return;
  }
  setStep('Address');
  setTimeout(initCheckoutMap, 200);
}

function backToCart() {
  setStep('Cart');
}

function goCheckoutPayment() {
  setStep('Payment');
}

function backToAddress() {
  setStep('Address');
}

function applyCoupon() {
  var input = document.getElementById('couponInput');
  if (!input) return;
  var code = input.value.trim().toUpperCase();
  var cfg = window.shopConfig || {};
  if (code && cfg.couponCode && code === String(cfg.couponCode).trim().toUpperCase()) {
    appliedCoupon = code;
    updateBillingSummary();
    alert("🎉 Coupon ପ୍ରଯୁଜ୍ୟ ହେଲା!");
  } else {
    alert("❌ ଭୁଲ୍ Coupon କୋଡ୍!");
  }
}

function initCheckoutMap() {
  if (typeof L === "undefined") return;
  var mapEl = document.getElementById('checkoutDeliveryMap');
  if (!mapEl) return;

  if (!checkoutMap) {
    checkoutMap = L.map('checkoutDeliveryMap').setView([STORE_LAT, STORE_LNG], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(checkoutMap);

    L.marker([STORE_LAT, STORE_LNG]).addTo(checkoutMap).bindPopup("<b>MUNNA GROCERY (Shop)</b>").openPopup();
    L.circle([STORE_LAT, STORE_LNG], { color: '#16a34a', fillColor: '#86efac', fillOpacity: 0.2, radius: 3000 }).addTo(checkoutMap);

    deliveryMarker = L.marker([STORE_LAT, STORE_LNG], { opacity: 0 }).addTo(checkoutMap);

    checkoutMap.on('moveend', function () {
      var c = checkoutMap.getCenter();
      customerLat = c.lat;
      customerLng = c.lng;
      if (deliveryMarker) deliveryMarker.setLatLng([c.lat, c.lng]);
    });
  }

  setTimeout(function () { if (checkoutMap) checkoutMap.invalidateSize(); }, 300);
}
