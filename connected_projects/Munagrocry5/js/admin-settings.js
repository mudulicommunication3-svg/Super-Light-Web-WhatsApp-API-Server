/* munnamobile :: js/admin-settings.js
   Admin settings, trending offers list, and store configuration */

window.shopConfig = window.shopConfig || {
  deliveryFee: 30,
  freeAbove: 500,
  couponCode: 'MUNNA10',
  couponPercent: 10,
  couponMinBill: 300,
  trending: ['7533476', '7533478'],
  codActive: true,
  pickupActive: true,
  storeOpen: true,
  deliverySlot: '1 hour',
  pickupSlots: ['30 min', '1 hour', '2 hour']
};

function saveShopSettings(newCfg) {
  if (!newCfg) return;
  Object.assign(window.shopConfig, newCfg);
  try {
    localStorage.setItem('SHOP_SETTINGS', JSON.stringify(window.shopConfig));
  } catch (e) {}
  if (typeof render === "function") render();
}
