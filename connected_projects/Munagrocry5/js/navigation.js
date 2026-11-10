/* munnamobile :: js/navigation.js
   Clean modern screen navigation, frosted glass bottom nav, and order tracking */

var _backNavGuard = false;

function showScreen(name) {
  ['cart', 'orders', 'address', 'profile'].forEach(function (s) {
    var el = document.getElementById(s + 'Screen');
    if (el) el.classList.toggle('hidden', s !== name);
  });

  if (typeof closeProductDetail === "function") {
    closeProductDetail(false);
  }

  // Bottom nav tab styling transitions
  document.querySelectorAll('.nav-btn').forEach(function (b) {
    var on = b.dataset.nav === name;
    b.classList.toggle('text-[#1864ab]', on);
    b.classList.toggle('text-slate-400', !on);
  });

  var fbar = document.getElementById('floatingCartBar');
  if (name === 'home') {
    if (typeof renderBar === "function") renderBar();
  } else if (fbar) {
    fbar.classList.add('hidden');
    document.body.classList.remove('pb-32');
    document.body.classList.add('pb-20');
  }

  if (name === 'cart') {
    if (typeof renderCartDrawer === "function") renderCartDrawer();
    var cs = document.getElementById('cartScreen');
    if (cs) cs.scrollTop = 0;
  }
  if (name === 'orders') {
    if (typeof renderOrders === "function") renderOrders();
  }
  if (name === 'address') {
    if (typeof renderAddressList === "function") renderAddressList();
  }
  if (name === 'profile') {
    if (typeof renderProfile === "function") renderProfile();
  }
  if (name === 'home') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function closeScreen(name) {
  showScreen('home');
}

function renderOrders() {
  var box = document.getElementById('ordersList');
  if (!box) return;

  var orders = typeof getMyOrders === "function" ? getMyOrders() : [];
  if (!orders || orders.length === 0) {
    box.innerHTML = `
      <div class="text-center py-16 bg-white rounded-2xl border border-slate-100 p-6 space-y-2">
        <i class="ph-bold ph-receipt text-5xl text-slate-300"></i>
        <p class="text-xs font-bold text-slate-500">କୌଣସି ଅର୍ଡର ମିଳିଲା ନାହିଁ।</p>
      </div>
    `;
    return;
  }

  box.innerHTML = orders.map(function (o) {
    var stNum = o.stage || 1;
    return `
      <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-black text-slate-800 text-xs">#${o.id}</span>
          <span class="text-[9px] bg-blue-50 text-[#1864ab] font-extrabold px-2 py-0.5 rounded-full border border-blue-100">Stage ${stNum}/5</span>
        </div>
        <p class="text-[10px] text-slate-400">🕐 ${o.timestamp || 'Just now'} · ${o.payment}</p>
        <div class="my-2 p-2.5 bg-slate-50 rounded-xl space-y-1">
          ${(o.items || []).map(function (i) {
            return `<div class="flex justify-between text-xs"><span class="text-slate-700">${i.name} x${i.qty}</span><span class="font-bold">Rs.${i.price * i.qty}</span></div>`;
          }).join('')}
        </div>
        <div class="flex justify-between pt-1 border-t border-slate-100 text-xs font-black">
          <span>Total Bill</span>
          <span class="text-[#1864ab]">Rs.${o.total}</span>
        </div>
      </div>
    `;
  }).join('');
}
