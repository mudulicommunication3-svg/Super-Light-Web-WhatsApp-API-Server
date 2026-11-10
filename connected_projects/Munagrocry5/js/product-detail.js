/* munnamobile :: js/product-detail.js
   One Product One Page: detail modal with similar products carousel and clean action bar */

var currentDetailEan = null;
var detailQtyVal = 1;

function openProductDetail(ean) {
  var p = (window.STORE_CATALOG || []).find(function (x) { return String(x.ean) === String(ean); });
  if (!p) return;
  currentDetailEan = p.ean;

  var currentCartQty = (typeof cart !== "undefined" && cart[p.ean]) || 0;
  detailQtyVal = currentCartQty > 0 ? currentCartQty : 1;

  var screenEl = document.getElementById("productDetailScreen");
  if (!screenEl) return;

  var mrpVal = parseFloat(p.mrp) || 0;
  var spVal = parseFloat(p.selling_price) || 0;
  var discount = mrpVal > spVal ? Math.round(((mrpVal - spVal) / mrpVal) * 100) : 0;
  var savings = mrpVal > spVal ? (mrpVal - spVal) : 0;

  var stockN = parseInt(p.stock_qty, 10);
  if (isNaN(stockN)) stockN = 10;

  // Image & Discount
  var imgEl = document.getElementById("pdImage");
  if (imgEl) {
    imgEl.src = p.image_url || "icon-512.png";
    imgEl.alt = p.product_name;
  }
  var offEl = document.getElementById("pdOffBadge");
  if (offEl) {
    if (discount > 0) {
      offEl.innerText = discount + "% OFF";
      offEl.classList.remove("hidden");
    } else {
      offEl.classList.add("hidden");
    }
  }

  // Titles & Category
  var catEl = document.getElementById("pdCategory");
  if (catEl) catEl.innerText = (p.category || "General").trim();

  var titleEl = document.getElementById("pdTitle");
  if (titleEl) titleEl.innerText = p.product_name;

  // Prices & Savings
  var priceEl = document.getElementById("pdPrice");
  if (priceEl) priceEl.innerText = "Rs." + (typeof money === "function" ? money(p.selling_price) : p.selling_price);

  var mrpEl = document.getElementById("pdMrp");
  if (mrpEl) {
    mrpEl.innerText = mrpVal > spVal ? "Rs." + (typeof money === "function" ? money(p.mrp) : p.mrp) : "";
  }

  var savEl = document.getElementById("pdSavings");
  if (savEl) {
    savEl.innerText = savings > 0 ? "ଛାଡ଼: Rs." + (typeof money === "function" ? money(savings) : savings) : "";
    savEl.classList.toggle("hidden", savings <= 0);
  }

  // Stock indicator
  var stockEl = document.getElementById("pdStock");
  if (stockEl) {
    if (stockN <= 0) {
      stockEl.innerHTML = '<span class="text-xs font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">❌ ସରିଯାଇଛି (Out of stock)</span>';
    } else if (stockN <= 5) {
      stockEl.innerHTML = `<span class="text-xs font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">⚠️ କେବଳ ${stockN} ଟି ବଳିଛି</span>`;
    } else {
      stockEl.innerHTML = `<span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">✅ ଷ୍ଟକ୍ ଉପଲବ୍ଧ (${stockN} ଟି)</span>`;
    }
  }

  // Description
  var descEl = document.getElementById("pdDesc");
  if (descEl) {
    descEl.innerText = p.description || "ଶୁଦ୍ଧ ଓ ପ୍ରାମାଣିକ ସାମଗ୍ରୀ ସୁଲଭ ମୂଲ୍ୟରେ ଆପଣଙ୍କ ଘରେ ପହଞ୍ଚାଯିବ।";
  }

  // Stepper & Add to cart button synchronization
  syncDetailActionState(stockN);

  // Render Similar Products Carousel
  renderSimilarProducts(p);

  screenEl.classList.remove("hidden");
  screenEl.scrollTop = 0;
}

function syncDetailActionState(stockN) {
  var qEl = document.getElementById("pdQty");
  if (qEl) qEl.innerText = detailQtyVal;

  var addBtn = document.getElementById("pdAddCartBtn");
  var buyBtn = document.getElementById("pdBuyBtn");
  var stepper = document.getElementById("pdStepperWrap");

  var currentCartQty = (typeof cart !== "undefined" && currentDetailEan && cart[currentDetailEan]) || 0;

  if (stockN <= 0) {
    if (stepper) stepper.classList.add("hidden");
    if (addBtn) {
      addBtn.disabled = true;
      addBtn.classList.add("opacity-50", "cursor-not-allowed");
      addBtn.innerText = "Out of Stock";
    }
    if (buyBtn) {
      buyBtn.disabled = true;
      buyBtn.classList.add("opacity-50", "cursor-not-allowed");
    }
  } else {
    if (stepper) stepper.classList.remove("hidden");
    if (addBtn) {
      addBtn.disabled = false;
      addBtn.classList.remove("opacity-50", "cursor-not-allowed");
      addBtn.innerHTML = currentCartQty > 0
        ? '<i class="ph-bold ph-check"></i> <span>କାର୍ଟରେ ଅଛି</span>'
        : '<i class="ph-bold ph-shopping-bag"></i> <span>କାର୍ଟରେ ଯୋଡ଼ନ୍ତୁ</span>';
    }
    if (buyBtn) {
      buyBtn.disabled = false;
      buyBtn.classList.remove("opacity-50", "cursor-not-allowed");
    }
  }
}

function detailQtyChange(delta) {
  if (!currentDetailEan) return;
  var p = (window.STORE_CATALOG || []).find(function (x) { return String(x.ean) === String(currentDetailEan); });
  var maxStock = p ? (parseInt(p.stock_qty, 10) || 10) : 10;

  detailQtyVal = Math.max(1, Math.min(maxStock, detailQtyVal + delta));
  var qEl = document.getElementById("pdQty");
  if (qEl) qEl.innerText = detailQtyVal;

  // If already in cart, update cart immediately
  if (typeof cart !== "undefined" && cart[currentDetailEan]) {
    if (typeof setQty === "function") setQty(currentDetailEan, detailQtyVal);
  }
}

function detailAddToCart() {
  if (!currentDetailEan) return;
  if (typeof setQty === "function") {
    setQty(currentDetailEan, detailQtyVal);
  }
  var p = (window.STORE_CATALOG || []).find(function (x) { return String(x.ean) === String(currentDetailEan); });
  var stockN = p ? (parseInt(p.stock_qty, 10) || 10) : 10;
  syncDetailActionState(stockN);
}

function detailBuyNow() {
  if (!currentDetailEan) return;
  if (typeof setQty === "function") {
    setQty(currentDetailEan, detailQtyVal);
  }
  closeProductDetail(false);
  if (typeof showScreen === "function") {
    showScreen("cart");
  }
}

function closeProductDetail(updateUrl) {
  var screenEl = document.getElementById("productDetailScreen");
  if (screenEl) screenEl.classList.add("hidden");
  currentDetailEan = null;
}

function renderSimilarProducts(currentProd) {
  var row = document.getElementById("pdSimilarRow");
  if (!row) return;
  row.innerHTML = "";

  var cat = (currentProd.category || "General").trim();
  var similar = (window.STORE_CATALOG || []).filter(function (p) {
    return (p.category || "General").trim() === cat && String(p.ean) !== String(currentProd.ean);
  });

  if (similar.length === 0) {
    similar = (window.STORE_CATALOG || []).filter(function (p) {
      return String(p.ean) !== String(currentProd.ean);
    }).slice(0, 4);
  }

  similar.forEach(function (p) {
    var qty = (typeof cart !== "undefined" && cart[p.ean]) || 0;
    var mrpVal = parseFloat(p.mrp) || 0;
    var spVal = parseFloat(p.selling_price) || 0;
    var discount = mrpVal > spVal ? Math.round(((mrpVal - spVal) / mrpVal) * 100) : 0;

    var card = document.createElement("div");
    card.className = "w-32 shrink-0 bg-white rounded-2xl p-2 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md flex flex-col justify-between relative group";

    card.innerHTML = `
      ${discount > 0 ? `<span class="absolute top-1.5 left-1.5 z-10 bg-emerald-600 text-white text-[9px] font-black px-1 rounded">${discount}% OFF</span>` : ''}
      <div onclick="openProductDetail('${p.ean}')" class="w-full h-20 rounded-xl bg-slate-50/70 flex items-center justify-center p-1 cursor-pointer">
        <img src="${p.image_url || 'icon-512.png'}" alt="${p.product_name}" class="w-full h-full object-contain mix-blend-multiply" onerror="this.src='icon-512.png'">
      </div>
      <div onclick="openProductDetail('${p.ean}')" class="mt-1.5 cursor-pointer flex-1 flex flex-col justify-between">
        <h5 class="text-[11px] font-bold text-slate-800 line-clamp-1 leading-tight">${p.product_name}</h5>
        <div class="mt-1 flex items-baseline gap-1">
          <span class="text-xs font-black text-slate-900">Rs.${typeof money === "function" ? money(p.selling_price) : p.selling_price}</span>
        </div>
      </div>
      <div class="mt-1.5">
        ${qty > 0 ? `
          <div class="flex items-center justify-between bg-emerald-600 text-white rounded-xl p-0.5 shadow-xs font-bold">
            <button onclick="event.stopPropagation(); setQty('${p.ean}', ${qty - 1}); renderSimilarProducts(currentDetailEan ? (window.STORE_CATALOG.find(x => String(x.ean) === String(currentDetailEan)) || currentProd) : currentProd);" class="w-5 h-5 rounded-md bg-emerald-700 flex items-center justify-center text-[10px]"><i class="ph-bold ph-minus"></i></button>
            <span class="text-[10px] font-black px-1">${qty}</span>
            <button onclick="event.stopPropagation(); setQty('${p.ean}', ${qty + 1}); renderSimilarProducts(currentDetailEan ? (window.STORE_CATALOG.find(x => String(x.ean) === String(currentDetailEan)) || currentProd) : currentProd);" class="w-5 h-5 rounded-md bg-emerald-700 flex items-center justify-center text-[10px]"><i class="ph-bold ph-plus"></i></button>
          </div>
        ` : `
          <button onclick="event.stopPropagation(); setQty('${p.ean}', 1); renderSimilarProducts(currentDetailEan ? (window.STORE_CATALOG.find(x => String(x.ean) === String(currentDetailEan)) || currentProd) : currentProd);" class="w-full py-1 rounded-xl border border-emerald-600 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white text-[10px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer">
            <span>ADD</span><i class="ph-bold ph-plus text-[9px]"></i>
          </button>
        `}
      </div>
    `;
    row.appendChild(card);
  });
}

function shareCurrentProduct() {
  if (!currentDetailEan) return;
  var p = (window.STORE_CATALOG || []).find(function (x) { return String(x.ean) === String(currentDetailEan); });
  if (!p) return;

  var mrpVal = parseFloat(p.mrp) || 0;
  var spVal = parseFloat(p.selling_price) || 0;
  var cleanEan = String(p.ean).replace(/^EAN-/, '').trim();
  var cleanName = String(p.product_name || '').replace(/\s+/g, ' ').trim();
  var shareUrl = "https://www.munagrocery.in/?item=" + cleanEan + "&sp=" + spVal + "&mrp=" + mrpVal;

  var shareText = "*" + cleanName + "*\n*Rs " + spVal + "* ~MRP " + mrpVal + "~\nMunna Mobile & Grocery\nCinema Hall Road, Niali\n" + shareUrl;

  if (navigator.share) {
    navigator.share({
      text: shareText
    }).catch(function () {});
  } else {
    try {
      navigator.clipboard.writeText(shareText);
    } catch (e) {}
    window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(shareText), "_blank");
  }
}
