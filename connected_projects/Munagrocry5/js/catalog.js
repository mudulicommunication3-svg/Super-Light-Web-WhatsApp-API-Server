/* munnamobile :: js/catalog.js
   Clean modern Blinkit/Zepto style product cards & trending section */

function render() {
  if (typeof renderCategoryPills === "function") renderCategoryPills();
  var grid = document.getElementById("grid");
  var empty = document.getElementById("emptyView");
  if (!grid) return;
  grid.innerHTML = "";

  var q = (typeof query !== "undefined" ? query : "").trim().toLowerCase();
  var filtered = (window.STORE_CATALOG || []).filter(function (p) {
    if (typeof activeCat !== "undefined" && activeCat !== "All" && typeof catOf === "function" && catOf(p) !== activeCat) return false;
    if (q && (p.product_name || "").toLowerCase().indexOf(q) < 0) return false;
    return true;
  });

  var badgeEl = document.getElementById("productCountBadge");
  if (badgeEl) {
    badgeEl.innerText = `${filtered.length} ଟି ସାମଗ୍ରୀ`;
  }

  if (filtered.length === 0) {
    if (empty) empty.classList.remove("hidden");
  } else {
    if (empty) empty.classList.add("hidden");
    filtered.forEach(function (p) {
      var qty = (typeof cart !== "undefined" && cart[p.ean]) || 0;
      var mrpVal = parseFloat(p.mrp) || 0;
      var spVal = parseFloat(p.selling_price) || 0;
      var discount = mrpVal > spVal ? Math.round(((mrpVal - spVal) / mrpVal) * 100) : 0;
      var savings = mrpVal > spVal ? (mrpVal - spVal) : 0;

      var stockN = parseInt(p.stock_qty, 10);
      if (isNaN(stockN)) stockN = 10;

      var stockBadge = stockN <= 0
        ? '<span class="text-[9.5px] font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200">Out of Stock</span>'
        : (stockN <= 5
          ? `<span class="text-[9.5px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">Only ${stockN} left</span>`
          : '<span class="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">In Stock</span>');

      var card = document.createElement("div");
      // Blinkit/Zepto clean modern rounded-2xl card layout with border-slate-100 and soft elevation
      card.className = "bg-white rounded-2xl p-2.5 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-emerald-200 transition-all flex flex-col justify-between relative group";

      card.innerHTML = `
        <!-- High-contrast discount pill badge (top-left) -->
        ${discount > 0 ? `
          <div class="absolute top-2 left-2 z-10 bg-emerald-600 text-white text-[9.5px] font-black px-1.5 py-0.5 rounded-md shadow-xs tracking-tight flex items-center gap-0.5">
            <span>${discount}% OFF</span>
          </div>
        ` : ''}

        <!-- Product Image Stage: strict onclick for openProductDetail -->
        <div onclick="openProductDetail('${p.ean}')" class="w-full h-32 rounded-xl bg-slate-50/70 flex items-center justify-center overflow-hidden cursor-pointer p-1.5 transition-transform duration-200 group-hover:scale-[1.02]">
          <img src="${p.image_url || 'icon-512.png'}" alt="${p.product_name}" class="w-full h-full object-contain mix-blend-multiply" onerror="this.src='icon-512.png'">
        </div>

        <!-- Product Details: strict onclick for openProductDetail -->
        <div onclick="openProductDetail('${p.ean}')" class="mt-2 flex-1 flex flex-col justify-between cursor-pointer select-none">
          <div>
            <h4 class="text-xs font-bold text-slate-800 line-clamp-2 leading-tight tracking-tight">${p.product_name}</h4>
            <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span class="bg-emerald-600 text-white text-[9px] font-black px-1 rounded flex items-center gap-0.5">
                4.8 <i class="ph-fill ph-star text-[8px]"></i>
              </span>
              ${stockBadge}
            </div>
          </div>

          <!-- Bold Price Hierarchy with Savings Badge -->
          <div class="mt-2 pt-1 border-t border-slate-100">
            <div class="flex items-baseline gap-1.5">
              <span class="text-sm font-black text-slate-900 tracking-tight">Rs.${typeof money === "function" ? money(p.selling_price) : p.selling_price}</span>
              ${mrpVal > spVal ? `<span class="text-[10px] text-slate-400 line-through font-semibold">Rs.${typeof money === "function" ? money(p.mrp) : p.mrp}</span>` : ''}
            </div>
            ${savings > 0 ? `
              <span class="inline-block text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-1 rounded mt-0.5">Save Rs.${typeof money === "function" ? money(savings) : savings}</span>
            ` : ''}
          </div>
        </div>

        <!-- Stepper / Add button container: NOT wrapped in openProductDetail -->
        <div class="mt-2" id="action-box-${p.ean}"></div>
      `;

      var actionBox = card.querySelector(`#action-box-${p.ean}`);
      if (qty > 0) {
        // High-contrast, rounded-xl Blinkit/Zepto stepper with stopPropagation
        actionBox.innerHTML = `
          <div class="flex items-center justify-between bg-emerald-600 text-white rounded-xl p-1 shadow-xs font-extrabold">
            <button onclick="event.stopPropagation(); setQty('${p.ean}', ${qty - 1})" class="w-6 h-6 rounded-lg bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center text-xs active:scale-90 transition-transform cursor-pointer">
              <i class="ph-bold ph-minus"></i>
            </button>
            <span class="text-xs font-black px-1">${qty}</span>
            <button onclick="event.stopPropagation(); setQty('${p.ean}', ${qty + 1})" class="w-6 h-6 rounded-lg bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center text-xs active:scale-90 transition-transform cursor-pointer">
              <i class="ph-bold ph-plus"></i>
            </button>
          </div>
        `;
      } else if (stockN <= 0) {
        actionBox.innerHTML = `
          <button disabled class="w-full py-1.5 rounded-xl bg-slate-100 text-slate-400 border border-slate-200 text-xs font-bold cursor-not-allowed flex items-center justify-center gap-1">
            <i class="ph-bold ph-x-circle"></i> Out of Stock
          </button>
        `;
      } else {
        // Clean high-contrast "+ ADD" rounded-xl pill button with stopPropagation
        actionBox.innerHTML = `
          <button onclick="event.stopPropagation(); setQty('${p.ean}', 1)" class="w-full py-1.5 rounded-xl border border-emerald-600 bg-emerald-50/70 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-black transition-all flex items-center justify-center gap-1 shadow-xs active:scale-95 cursor-pointer">
            <span>ADD</span>
            <i class="ph-bold ph-plus text-xs"></i>
          </button>
        `;
      }
      grid.appendChild(card);
    });
  }

  if (typeof renderTrending === "function") renderTrending();
  if (typeof renderBar === "function") renderBar();
}

function renderTrending() {
  var row = document.getElementById("trendingOffersRow") || document.getElementById("trendingRow");
  if (!row) return;
  row.innerHTML = "";

  var trendingList = (window.shopConfig && window.shopConfig.trending) || [];
  if (!Array.isArray(trendingList) || trendingList.length === 0) {
    var sec = document.getElementById("trendingSection");
    if (sec) sec.classList.add("hidden");
    return;
  }

  var items = (window.STORE_CATALOG || []).filter(function (p) {
    return trendingList.indexOf(String(p.ean)) >= 0;
  });

  if (items.length === 0) {
    var s = document.getElementById("trendingSection");
    if (s) s.classList.add("hidden");
    return;
  }

  var s2 = document.getElementById("trendingSection");
  if (s2) s2.classList.remove("hidden");

  items.forEach(function (p) {
    var qty = (typeof cart !== "undefined" && cart[p.ean]) || 0;
    var mrpVal = parseFloat(p.mrp) || 0;
    var spVal = parseFloat(p.selling_price) || 0;
    var discount = mrpVal > spVal ? Math.round(((mrpVal - spVal) / mrpVal) * 100) : 0;

    var card = document.createElement("div");
    card.className = "w-36 shrink-0 bg-white rounded-2xl p-2 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md flex flex-col justify-between relative group";
    card.innerHTML = `
      ${discount > 0 ? `<span class="absolute top-1.5 left-1.5 z-10 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">${discount}% OFF</span>` : ''}
      <div onclick="openProductDetail('${p.ean}')" class="w-full h-24 rounded-xl bg-slate-50/70 flex items-center justify-center p-1 cursor-pointer">
        <img src="${p.image_url || 'icon-512.png'}" alt="${p.product_name}" class="w-full h-full object-contain mix-blend-multiply" onerror="this.src='icon-512.png'">
      </div>
      <div onclick="openProductDetail('${p.ean}')" class="mt-1 cursor-pointer flex-1 flex flex-col justify-between">
        <h4 class="text-[11px] font-bold text-slate-800 line-clamp-2 leading-tight">${p.product_name}</h4>
        <div class="mt-1 flex items-baseline gap-1">
          <span class="text-xs font-black text-slate-900">Rs.${typeof money === "function" ? money(p.selling_price) : p.selling_price}</span>
          ${mrpVal > spVal ? `<span class="text-[9px] text-slate-400 line-through">Rs.${typeof money === "function" ? money(p.mrp) : p.mrp}</span>` : ''}
        </div>
      </div>
      <div class="mt-1.5" id="trend-action-${p.ean}">
        ${qty > 0 ? `
          <div class="flex items-center justify-between bg-emerald-600 text-white rounded-xl p-0.5 shadow-xs">
            <button onclick="event.stopPropagation(); setQty('${p.ean}', ${qty - 1})" class="w-5 h-5 rounded-md bg-emerald-700 flex items-center justify-center text-[10px]"><i class="ph-bold ph-minus"></i></button>
            <span class="text-[10px] font-black px-1">${qty}</span>
            <button onclick="event.stopPropagation(); setQty('${p.ean}', ${qty + 1})" class="w-5 h-5 rounded-md bg-emerald-700 flex items-center justify-center text-[10px]"><i class="ph-bold ph-plus"></i></button>
          </div>
        ` : `
          <button onclick="event.stopPropagation(); setQty('${p.ean}', 1)" class="w-full py-1 rounded-xl border border-emerald-600 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white text-[10px] font-black flex items-center justify-center gap-1 transition-all">
            <span>ADD</span><i class="ph-bold ph-plus text-[9px]"></i>
          </button>
        `}
      </div>
    `;
    row.appendChild(card);
  });
}

function renderBar() {
  var keys = Object.keys(typeof cart !== "undefined" ? cart : {}), n = 0, total = 0;
  keys.forEach(function (k) {
    var p = (window.STORE_CATALOG || []).find(function (x) { return String(x.ean) === String(k); });
    if (p) {
      n += cart[k];
      total += (parseFloat(p.selling_price) || 0) * cart[k];
    }
  });

  var bBadge = document.getElementById("floatingCartBadge");
  if (bBadge) bBadge.innerText = n;

  var bTotal = document.getElementById("floatingCartTotal");
  if (bTotal) bTotal.innerText = "Rs." + (typeof money === "function" ? money(total) : total);

  updateCartBadge();

  var hasItems = n > 0;
  var fbar = document.getElementById('floatingCartBar');
  if (fbar) fbar.classList.toggle('hidden', !hasItems);
  document.body.classList.toggle('pb-32', hasItems);
  document.body.classList.toggle('pb-20', !hasItems);
}

function updateCartBadge() {
  var n = 0;
  Object.keys(typeof cart !== "undefined" ? cart : {}).forEach(function (k) { n += (cart[k] || 0); });
  var b = document.getElementById('navCartBadge');
  if (b) {
    b.innerText = n;
    b.classList.toggle('hidden', n === 0);
  }
}
