/**
 * Cloudflare Pages Function Middleware: Dynamic Social Media Link Image & Preview Injector
 *
 * Intercepts incoming crawler/bot requests for WhatsApp, Facebook, Telegram, Twitter, LinkedIn, etc.
 * When a request has ?item=... (or ?product=..., ?ean=..., ?id=...), dynamically resolves:
 * 1. Live Google Sheet (Sheet1) Price, MRP, Stock Qty, Name & Image (ZERO hardcoded prices/stocks).
 * 2. Live URL parameters (&n=..., &img=..., &sp=..., &mrp=..., &stk=...) sent from the Sheet catalog.
 * 3. Instant <1ms EAN Media Index (Name & HD Photo URL only — no hardcoded price or stock) so
 *    WhatsApp crawlers NEVER time out or show a generic store icon / "Munna Grocery" fallback.
 */

export interface CatalogItem {
  name: string;
  price: string | number;
  mrp: string | number;
  image: string;
  category?: string;
  stock_qty?: string | number;
}

interface MediaEntry {
  keys: string[];
  name: string;
  image: string;
  category: string;
}

// Media-only lookup (Name + HD Image URL + Category ONLY — ZERO hardcoded prices, MRPs, or stock!)
// Ensures <1ms photo & title resolution even if a short link is shared without &n= or &img= during a cold start.
const EAN_MEDIA_ENTRIES: MediaEntry[] = [
  {"keys":["7552164","row-2","494400138"],"name":"Freedom Kachi Ghani Mustard Oil 1 L","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004944001381.jpg.fc33b08bec.jpg","category":"Mustard Oil"},
  {"keys":["7516618","row-3","491276476"],"name":"Horlicks Classic Malt Superfoods Nutritional Drink Mix 750 g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004912764761.jpg.4fb593c42a.jpg","category":"Nutritional Drinks"},
  {"keys":["7517035","row-4","491504124"],"name":"Super Sarvottam Physically Refined Rice Bran Oil 815 g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004915041241.jpg.7d3a004bd3.jpg","category":"Rice Bran Oil"},
  {"keys":["7516932","row-5","491112748"],"name":"Energy max 1L","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004911127481.jpg.e074c2e696.jpg","category":"Rice Bran Oil"},
  {"keys":["49792497","row-6","490225938"],"name":"Comfort After Wash Morning Fresh Fabric Conditioner 210 ml","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/4902259381.jpg.31232acfb1.jpg","category":"Fabric Pre, Post Wash"},
  {"keys":["49792510"],"name":"Comfort After Wash Lily Fresh Fabric Conditioner 210 ml","image":"https://i.ibb.co/WNtyqpTs/be7d13c98696.jpg","category":"Fabric Pre, Post Wash"},
  {"keys":["49792642","row-7","490877961"],"name":"Comfort After Wash Anti-Bacterial Action Fabric Conditioner 210 ml","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004908779611.jpg.d7dacbba0a.jpg","category":"Fabric Pre, Post Wash"},
  {"keys":["7536462","row-8","491696741"],"name":"Britannia Vita Marie Gold Biscuits 900 g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004916967411.jpg.7ffc8d08a9.jpg","category":"Marie, Health, Digestive"},
  {"keys":["7510768","row-9","491585579"],"name":"Unibic Cashew Badam Cookies 450 g (90 g x 5N)","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004915855791.jpg.521274d837.jpg","category":"Other Biscuits"},
  {"keys":["7508782","491551495","row-10"],"name":"Good Life Pure Crystal Sugar (M) 5 kg","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004915514951.jpg.e3599fcf26.jpg","category":"Sugar, Salt & Jaggery"},
  {"keys":["1791827664152","row-11","491334852"],"name":"Good Life Kachi Ghani Mustard Oil 1 L (Pouch)","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004913348521.jpg.c90ad0bd4f.jpg","category":"Mustard Oil"},
  {"keys":["1791893308225","8901207038334","row-12"],"name":"Dabur Anmol Gold Pure Coconut Oil 550 ml","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/616fteexful.sx679.jpg.3d1ce141be.jpg","category":"Hair Oil & Serum"},
  {"keys":["1791911713960","row-13"],"name":"Dalda Kachi Ghani Mustard Oil 1 L (Pouch)","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/fe5ad4d18ac889a42f494f817784791bdalda-kachi-ghani-mustard-oil-1-l-0-20210831.jpg.49d2346642.jpg","category":"Mustard Oil"},
  {"keys":["1791911844367","row-14","491504124"],"name":"Super Sarvottam Physically Refined Rice Bran Oil 815 g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004915041241.jpg.7d3a004bd3.jpg","category":"Rice Bran Oil"},
  {"keys":["8909081005046","row-15"],"name":"Dark fantasy","image":"https://i.ibb.co/35qTVJ7N/3043ea4f3954.jpg","category":"Biscuit"},
  {"keys":["8901030820021","row-16"],"name":"Junior horlicks 500g","image":"https://i.ibb.co/0RVQzknW/9ac6299cc3f9.jpg","category":"Horlicks"},
  {"keys":["8901207023644","row-17"],"name":"Dabur red gel 300g","image":"https://i.ibb.co/Xx1GYcXr/b7484336e324.jpg","category":"Toothpaste"},
  {"keys":["8909081014277","row-18"],"name":"Moms magic 190g+41gExtra=231g","image":"https://i.ibb.co/tTJ0dGBX/c53375fda934.jpg","category":"Biscuit"},
  {"keys":["8901207040313","row-19"],"name":"Dabur red bae fresh gel 300g","image":"https://i.ibb.co/1JsdzrSB/d58d3f6f5550.jpg","category":"Toothpaste"},
  {"keys":["8906009071848","row-20"],"name":"Unibik Fruit & Nut Cookies 270g","image":"https://i.ibb.co/b5Byhyf5/80710a162ec1.jpg","category":"Cookies"},
  {"keys":["8996001307373","row-21"],"name":"Malkist Cheese Flavour 150g","image":"https://i.ibb.co/QW8J3tt/b09d2a78c7c6.jpg","category":"Biscuit"},
  {"keys":["8909106022041","row-22"],"name":"Comfort Lily fresh 860ml","image":"https://i.ibb.co/nqBtC5Zq/1e4b9b262216.jpg","category":"Wash"},
  {"keys":["1792025431078","row-23"],"name":"Parle Hide & Seek 4 Flavour Choco Chip Creme Biscuit 400 g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/parle-hide-seek-4-fun-flavours-choco-chip-creme-sandwich-biscuits-400-g-0-20220113.jpg.49c1e1e9e6.jpg","category":"Cream Biscuits & Wafers"},
  {"keys":["1792030740077","row-24"],"name":"Loose Sugar M 1 kg","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/490176160ak-sugar-m.jpg.1ddca0fb5e.jpg","category":"Sugar"},
  {"keys":["22215341006","row-25"],"name":"Hushabye Baby Wipes. 72 Wipes","image":"https://i.ibb.co/TMcS4j5z/1c69e414038a.jpg","category":"Baby care"},
  {"keys":["4901416135316","row-26"],"name":"Krack Jack 352.8g","image":"https://i.ibb.co/xKHFv45d/b6591c1d4aa3.jpg","category":"Biscuit"},
  {"keys":["8904075600443","row-27"],"name":"Chicken Masala 50g","image":"https://i.ibb.co/DHQQ1dCV/2f68b9c9eb1e.jpg","category":"Masala Powder"},
  {"keys":["8906033741465","row-28"],"name":"Mc vities Digestive 959.1g","image":"https://i.ibb.co/yjvccm9/b5dfddf31b3f.jpg","category":"Biscuit"},
  {"keys":["8904132983700","row-29","494590284"],"name":"Sil Instant Masala Noodles 300 g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004945902841.jpg.244960342a.jpg","category":"Instant, Hakka & Cup Noodles"},
  {"keys":["8906014762830","row-30"],"name":"Bajaj coconut oil 300ml","image":"https://i.ibb.co/tTDHxcwG/dc85fff6a429.jpg","category":"Coconut oil"},
  {"keys":["8901088721981","row-31"],"name":"Revive Liquid Stiffener 395g","image":"https://i.ibb.co/SwyHQcG3/3a341c53e22b.jpg","category":"Washing"},
  {"keys":["8904293707948","row-32"],"name":"Classic Kachi Ghani Mustard Oil 1L (910g)","image":"https://i.ibb.co/0yTPYpMp/300804adc3dc.jpg","category":"Oil"},
  {"keys":["8901314550286","row-33"],"name":"Colgate Power Tip Qty:6","image":"https://i.ibb.co/DD2Cyg55/70258dbb4cd0.jpg","category":"Toothbrush"},
  {"keys":["8906142775757","row-34"],"name":"Bolas cashew nuts 900g","image":"https://i.ibb.co/KpWkbxzg/dfb4c14712ad.jpg","category":"Nuts"},
  {"keys":["8901030960475","row-35"],"name":"Horlicks mother's plus","image":"https://i.ibb.co/PsJWPgJj/c3243b4366a2.jpg","category":"Horlicks"},
  {"keys":["8904293725201","row-36"],"name":"Aqua College Menthol Soap 75g×4u=300g","image":"https://i.ibb.co/4cyFPSw/2f26dd10a1b6.png","category":"Soap"},
  {"keys":["8904132944312","row-37"],"name":"Good Life Refined Rice Bran Oil 820g","image":"https://i.ibb.co/Z6y49N4N/585bee5b6f81.png","category":"Oil"},
  {"keys":["8904293724372","row-38"],"name":"Classic Kachi Ghani Mustard Oil Pouch 1L (910g)","image":"https://i.ibb.co/s9zTLbvZ/e04034571000.jpg","category":"Oil"},
  {"keys":["8906007288125","row-39"],"name":"King Rice Bran Oil 840g","image":"https://i.ibb.co/YTDJHGbs/b7a8b2064c50.png","category":"Oil"},
  {"keys":["8908000445963","row-40"],"name":"Besan 500g","image":"https://i.ibb.co/Z6cLTrSd/8c553f10ede3.jpg","category":"Besan"},
  {"keys":["8901012118405","row-41"],"name":"Johnson's baby soap","image":"https://i.ibb.co/SwT43nNH/be79c1a3e8e1.jpg","category":"Baby care"},
  {"keys":["8904026639508","row-42"],"name":"New Little Fluffy Soft 40pic","image":"https://i.ibb.co/ZRYqk9j0/900ea99001c4.jpg","category":"Baby care"},
  {"keys":["8901088064590","row-43"],"name":"Parachute body lotion 400ml","image":"https://i.ibb.co/bRgFTZDM/83d58ae57e33.jpg","category":"Body lotion"},
  {"keys":["8901207029974","row-44"],"name":"Dabur Anmol Jasmine Coconut Oil 450ml","image":"https://i.ibb.co/N6Fn1Drd/bb7cfc3a54c5.jpg","category":"Hair Oil"},
  {"keys":["8901030518591","row-45"],"name":"Corn Starch 100g","image":"https://i.ibb.co/qFc9Y5mH/cbabcb946eb5.jpg","category":"Masala Powder"},
  {"keys":["8904132912984","row-46"],"name":"Snac tac 280g","image":"https://i.ibb.co/d0HK5yW0/a485e972a080.png","category":"Noodles"},
  {"keys":["8904075600399","row-47","492172628"],"name":"Bharat Meat Masala 50 g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004921726281.jpg.f5c274472c.jpg","category":"Blended Masalas"},
  {"keys":["8904075600504","row-48","492172630"],"name":"Bharat Garam Masala 50 g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004921726301.jpg.ffcf041c0d.jpg","category":"Blended Masalas"},
  {"keys":["1792140384540","row-49"],"name":"B Natural Litchi Fruit Drink 1 L","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/litchicopy.jpg.6b488f75b2.jpg","category":"Juices"},
  {"keys":["8901719127106","row-50"],"name":"Parle Platina Nutricrunch Digestive Cookies 1 kg","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/parle-platina-nutricrunch-digestive-cookies-1-kg-0-20210423.jpg.0ee7f2769c.jpg","category":"Cookies"},
  {"keys":["8901719140488","row-51","491984654"],"name":"Parle Marie Biscuits 800 g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004919846541.jpg.ee9d521067.jpg","category":"Marie, Health, Digestive"},
  {"keys":["1792140794757","row-52","491696803"],"name":"Sunfeast Dark Fantasy Vanilla Creme Dark Crunch Biscuit 237g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/4916968031.jpg.eafb38fff2.jpg","category":"Cream Biscuits & Wafers"},
  {"keys":["8904075600078","row-53"],"name":"Bharat Turmeric Powder 100g","image":"https://i.ibb.co/35ht6jF1/aaf0283de6bb.jpg","category":"Masala Powder"},
  {"keys":["8901088136945","row-54","491438626"],"name":"Parachute 100% Pure Coconut Hair Oil 300 ml","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/4914386261.jpg.ff38229e29.jpg","category":"Hair Oil & Serum"},
  {"keys":["8904132953642","row-55"],"name":"Independence Kachi Ghani Mustard Oil 1L","image":"https://i.ibb.co/PZvrDqHr/5fbb9c4effec.jpg","category":"Cooking oil"},
  {"keys":["8906016570242","row-56"],"name":"Mangaldeep","image":"https://i.ibb.co/PsvPTZB5/48effe1eb6de.jpg","category":"Agarbatti"},
  {"keys":["8901063029279","row-57"],"name":"BRITANNIA Jim jam 138g","image":"https://i.ibb.co/Sz4K9Q0/2482246d3df8.png","category":"Biscuit"},
  {"keys":["8906036741448","row-58"],"name":"Mc vities Digestive 200g","image":"https://i.ibb.co/Gv2hj641/c01a1fd3f2b8.png","category":"Biscuit"},
  {"keys":["8906033744329","row-59"],"name":"Mc vities hobnobs 75g","image":"https://i.ibb.co/WvWdwXvC/741e8e6e190f.jpg","category":"Biscuit"},
  {"keys":["8909106011045","494336789","24061413","row-60"],"name":"Surf Excel Easy Wash Detergent Powder 7 kg","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004943367891.jpg.102705b372.jpg","category":"Detergent"},
  {"keys":["8901138511449","row-61"],"name":"Himalaya Baby Shampoo 100ml","image":"https://i.ibb.co/ch4KKKjP/9707a9f4c13d.jpg","category":"Baby care"},
  {"keys":["8906007280693","row-62"],"name":"fortune rice bran oil 870g","image":"https://i.ibb.co/whkfZFds/d05d18b81119.webp","category":"Cooking oil"},
  {"keys":["8901725100025","row-63"],"name":"B natural Mixed Fruit 1L","image":"https://i.ibb.co/GmcdwVK/c63692fd9c01.jpg","category":"Fruit Juice"},
  {"keys":["8901725100063","row-64"],"name":"B Natural Apple Juice 1L","image":"https://i.ibb.co/4Rn31JwN/cd9732eecf2a.jpg","category":"Fruit Juice"},
  {"keys":["8901248126359","row-65"],"name":"Boro plus Doodh Kesar","image":"https://i.ibb.co/JFjdfmkK/dbcbe1bfd3d4.jpg","category":"Body lotion"},
  {"keys":["8901207027420","490672482","7510305","row-66"],"name":"Dabur Red Toothpaste (200+ 100) g (With Free Toothbrush)","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/4906724821.jpg.eb81645617.jpg","category":"Toothpaste"},
  {"keys":["7622202318320","row-67"],"name":"Cadbury 5 star pack of 6","image":"https://i.ibb.co/gLJ1rnDQ/7ecfa5f17852.jpg","category":"Chocolate"},
  {"keys":["7622202819384","row-68"],"name":"Cadbury 5 star mini treats 166.6g","image":"https://i.ibb.co/NgLp4jXp/65f5d8751b0c.jpg","category":"Chocolate"},
  {"keys":["8901725005955","491337398","7527479","row-69"],"name":"YiPPee Magic Masala Noodles with Added Veggies (6 in 1) 420 g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/4913373981.jpg.37dcffa195.jpg","category":"Spices"},
  {"keys":["8901052010363","8906035030055","row-70"],"name":"Freedom Refined Sunflower Oil 1 L pack of 10","image":"https://i.ibb.co/3mxkbTD0/1115dd5cd21f.png","category":"Cooking oil"},
  {"keys":["8909081008184","row-71"],"name":"Moms Magic Family Pack 510g","image":"https://i.ibb.co/j9RvhL2x/0f61dcb79176.png","category":"Biscuit"},
  {"keys":["1792298051265","row-72","491504124"],"name":"Super Sarvottam Physically Refined Rice Bran Oil 815 g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004915041241.jpg.7d3a004bd3.jpg","category":"Rice Bran Oil"},
  {"keys":["1792427820523","row-73","491334852"],"name":"Good Life Kachi Ghani Mustard Oil 1 L (Pouch)","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004913348521.jpg.c90ad0bd4f.jpg","category":"Mustard Oil"},
  {"keys":["8906079335635","row-74"],"name":"Little Angel easy dry pants M 72pc","image":"https://i.ibb.co/Gf2HRmwB/7e7540ac9c4e.jpg","category":"Baby care"},
  {"keys":["8909106084728","row-75"],"name":"Lilte horlicks 450g","image":"https://i.ibb.co/Vcwbg8y7/91ccf121f4c8.jpg","category":"Horlicks"},
  {"keys":["8904293716834","row-76"],"name":"Dishwash Bar","image":"https://i.ibb.co/tTbhBPCf/3f2088039777.png","category":"Dishwash"},
  {"keys":["8901030993381","row-77"],"name":"Horlicks 1kg","image":"https://i.ibb.co/yng1jHkB/2c60e8aeb843.png","category":"Horlicks"},
  {"keys":["8904132944299","row-78"],"name":"Good Life refined sunflower oil 820g","image":"https://i.ibb.co/xSkKqNnp/f8e4a5ee33b5.jpg","category":"Cooking oil"},
  {"keys":["8904075603536","row-79"],"name":"Bharat Biriyani Masala 50g","image":"https://i.ibb.co/dJVVLCS3/aff79818d08e.webp","category":"Masala"},
  {"keys":["8901725016296","row-80"],"name":"Dark fantasy bourbon 99g","image":"https://i.ibb.co/36W9QmV/b7d731eee3c0.jpg","category":"Biscuit"},
  {"keys":["1792914163648","row-81"],"name":"Mz wireless speaker","image":"https://i.ibb.co/Ld4yjfmH/Screenshot-2026-10-25-13-10-45-40-6012fa4d4ddec268fc5c7112cbb265e7.jpg","category":"electric"},
  {"keys":["1792914626931","row-82"],"name":"Mz s682 Bluetooth speaker with mic","image":"https://i.ibb.co/Jj1HypsC/Screenshot-2026-10-25-13-19-54-86-6012fa4d4ddec268fc5c7112cbb265e7.jpg","category":"electric"},
  {"keys":["1793007711508","row-83"],"name":"Happy happy biscuit 396g","image":"https://i.ibb.co/yB0V9thy/Screenshot-2026-10-26-15-11-29-98-aff2935e0e9ac6ba5f2d558ed2920986.jpg","category":"Grocery"},
  {"keys":["8901719136788","row-84"],"name":"Hide&seek Milano 200g","image":"https://i.ibb.co/3yq6yDy1/40204936-9-parle-platina-milano-dark-choco-biscuits.jpg","category":"Biscuit"},
  {"keys":["8901063004139","row-85"],"name":"Britannia Good day choco chips cookies 400g","image":"https://i.ibb.co/1txr2kMt/40197805-13-britannia-good-day-chocochip-cookies.png","category":"Biscuit"},
  {"keys":["8904075603604","row-86"],"name":"Egg curry masala 50g","image":"https://i.ibb.co/bg9DVJJQ/BMSME39-C-1.jpg","category":"Masala"},
  {"keys":["8904075603727","row-87"],"name":"Paneer masala","image":"https://i.ibb.co/Q7FGcZT1/BMSMP43-B-1.jpg","category":"Masala"},
  {"keys":["8901719140457","row-88"],"name":"Parle krack Jack butter masala 307.8g","image":"https://i.ibb.co/bjnkxF7f/c1621eb2-484f-40d4-b49f-d72163af958f.jpg","category":"Biscuit"},
  {"keys":["8904075600313","row-89"],"name":"Curry powder50lg","image":"https://i.ibb.co/2Y1w13SM/40313466-1-bharat-masala-curry-powder.jpg","category":"Masala"},
  {"keys":["619659200480","row-90"],"name":"SanDisk 128gb Memory card","image":"https://i.ibb.co/7fYVLFy/Screenshot-2026-10-26-20-56-11-09-680d03679600f7af0b4c700c6b270fe7.jpg","category":"Mobile"},
  {"keys":["1793028838652","row-91"],"name":"Se.13 8gb MicroSD Memory card","image":"https://i.ibb.co/qFy6VV2d/Screenshot-2026-10-26-21-03-47-99-680d03679600f7af0b4c700c6b270fe7.jpg","category":"Grocery"},
  {"keys":["8900503801093","row-92"],"name":"SanDisk microSDHC Card 32GB","image":"https://i.ibb.co/6RFZnt8Q/cline-studio-product.jpg","category":"Electronics"},
  {"keys":["8909106007147","492367966","17507924","row-93"],"name":"Surf Excel Easy Wash Detergent Powder 5 kg","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004923679661.jpg.9f42ea9c59.jpg","category":"Detergent"},
  {"keys":["LPNBLR5N2533857","row-94"],"name":"AXE 215ml","image":"https://i.ibb.co/fYDHtnTp/51-R24-YLez-JL.jpg","category":"Body spray"},
  {"keys":["72878635","row-95","494764639","8908024388017"],"name":"BDM Fresh Whole Wheat Chakki Atta 5 kg","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004947646391.jpg.f6abe4791c.jpg","category":"Atta"},
  {"keys":["490015988","17507923","row-96"],"name":"Surf Excel Easy Wash Detergent Powder 500 g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004900159881.jpg.f5baf0ec77.jpg","category":"Detergent"},
  {"keys":["490876695","7525103","row-97"],"name":"Britannia Jimjam Sandwich Biscuits 138 g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004908766951.jpg.6c5126ddf5.jpg","category":"Leaf & Dust Tea"},
  {"keys":["490089299","7541105","row-98"],"name":"Tata Tea Premium Dust Tea 500 g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004900892991.jpg.964861b86a.jpg","category":"Leaf & Dust Tea"},
  {"keys":["490000038","132487249","row-99"],"name":"Aashirvaad Shudh Whole Wheat Chakki Atta 5 kg","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/4900000381.jpg.24dd9dd971.jpg","category":"Atta"},
  {"keys":["490537394","7514712","row-100"],"name":"Frooti 1.2 l","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004905373941.jpg.d525a4e326.jpg","category":"Juices"},
  {"keys":["490000032","132487032","row-101"],"name":"Aashirvaad Shudh Whole Wheat Chakki Atta 1 kg","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/4900000321.jpg.b8d354dd8d.jpg","category":"Atta"},
  {"keys":["491349662","7533244","row-102"],"name":"Good Life Maida 1 kg","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004913496621.jpg.833ffef68e.jpg","category":"Atta"},
  {"keys":["490617298","7515694","row-103"],"name":"Prabhuji Elaichi Soan Papdi 400 g","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/egurhk/.j/pg/0000000004906172981.jpg.dc20acbc7b.jpg","category":"Beverages"},
  {"keys":["RVIXQOSBRC","53792114","row-104"],"name":"Desidiya Led String Serial Light 35 Meter With 8 Modes Changing Controller. Waterproof & Flexible Copper Led Serial String Lights Led Lights For Home Diwali Home Decoration & Christmas - (Multicolor)","image":"https://cdn1.jiomartjcp.com/v2/catalog-cloud/jiomar/original/images/othe/tns3gz/.j/pg/b0cgpztc8cjcs1.jpg.da2a97be65.jpg","category":"Electronics"}
];

const MEDIA_MAP: Record<string, { name: string; image: string; category: string }> = {};
for (const entry of EAN_MEDIA_ENTRIES) {
  for (const k of entry.keys) {
    MEDIA_MAP[k.toLowerCase()] = { name: entry.name, image: entry.image, category: entry.category };
  }
}

function lookupMediaByEan(rawKey: string): { name: string; image: string; category: string } | null {
  if (!rawKey) return null;
  const clean = rawKey.split(/[,;|\s]+/)[0].split("_")[0].replace(/^EAN-/i, "").trim().toLowerCase();
  if (!clean) return null;
  if (MEDIA_MAP[clean]) return MEDIA_MAP[clean];
  if (MEDIA_MAP["row-" + clean]) return MEDIA_MAP["row-" + clean];
  if (clean.length >= 6) {
    for (const entry of EAN_MEDIA_ENTRIES) {
      if (entry.image && entry.image.toLowerCase().includes(clean)) {
        return { name: entry.name, image: entry.image, category: entry.category };
      }
    }
  }
  return null;
}

interface CacheRecord<T> {
  data: T;
  timestamp: number;
}

// 45s Edge Isolate Memory Cache with 15s stale-while-revalidate so WA Loop items hit warm cache in <1ms while Sheet edits sync fast
const EDGE_PRODUCT_CACHE: Map<string, CacheRecord<CatalogItem>> = new Map();
const CACHE_TTL_MS = 45000;
const STALE_REVALIDATE_MS = 15000;
let LAST_CATALOG_FETCH_MS = 0;
let IN_FLIGHT_SHEET_PROMISE: Promise<void> | null = null;
let EDGE_CONFIG_CACHE: {
  linkCaptionFormat: string;
  storeName: string;
  storeAddress: string;
  fetchedAt: number;
} | null = null;

const DEFAULT_BANNER = "https://www.munagrocery.in/banner.jpg";
const SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyBG-2536FNp4Kdux8GSBjKMyHjaSBWqSIaJpHDQ68GtzKpyUYR9x_N9QthMdvXPNhE/exec";
const SHEET_ID = "1wj0Lg32nIDjCDadnBovK2u0agpJ4gIJr1ahxya1GMGE";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function normalizeImageUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  let url = rawUrl.trim();
  if (!url) return "";

  if (url.includes("drive.google.com") || url.includes("docs.google.com")) {
    const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    }
  }

  if (url.includes("ibb.co/") && !url.includes("i.ibb.co/")) {
    url = url.replace("ibb.co/", "i.ibb.co/");
  }

  if (url.startsWith("//")) {
    url = `https:${url}`;
  } else if (url.startsWith("http://")) {
    url = url.replace(/^http:\/\//i, "https://");
  } else if (!url.startsWith("https://")) {
    const cleanPath = url.startsWith("/") ? url : `/${url}`;
    url = `https://www.munagrocery.in${cleanPath}`;
  }

  // Convert .webp images to 600x600 square JPEG so WhatsApp crawlers render the full product card
  if (/\.webp(\?.*)?$/i.test(url)) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=600&h=600&fit=contain&bg=white&output=jpg`;
  }

  return url;
}

export function getCachedProduct(key: string): CatalogItem | null {
  const clean = key.toLowerCase();
  const rec = EDGE_PRODUCT_CACHE.get(clean);
  if (rec) {
    if (Date.now() - rec.timestamp < CACHE_TTL_MS) {
      return rec.data;
    }
    EDGE_PRODUCT_CACHE.delete(clean);
  }
  return null;
}

function toUnicodeStrike(str: string): string {
  if (!str) return "";
  let plain = String(str);
  plain = plain.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, (m) => {
    const code = m.codePointAt(0);
    if (code && code >= 0x1D7CE && code <= 0x1D7ED) return String.fromCharCode(48 + (code - 0x1D7CE));
    if (code && code >= 0x1D5D4 && code <= 0x1D5ED) return String.fromCharCode(65 + (code - 0x1D5D4));
    if (code && code >= 0x1D5EE && code <= 0x1D607) return String.fromCharCode(97 + (code - 0x1D5EE));
    return m;
  });
  return Array.from(plain)
    .map((c) => c + "\u0336")
    .join("");
}

interface LiveSheetBundle {
  product: CatalogItem | null;
  linkCaptionFormat: string;
  storeName: string;
  storeAddress: string;
}

const DEFAULT_LINK_CAPTION_TEMPLATE = `[Product Name with Weight] Rs [Offer Price]\nRs [Offer Price] ~MRP [MRP]~ ([Discount %]% OFF) [Stock Status]\n[Store Name], [Address] odisha call-9040585726`;

/**
 * Performs a non-aborted background refresh of the entire Google Sheet catalog into EDGE_PRODUCT_CACHE.
 * Deduplicates concurrent calls so multiple requests share the same in-flight promise.
 */
function refreshEdgeCatalogFromSheet(): Promise<void> {
  if (IN_FLIGHT_SHEET_PROMISE) {
    return IN_FLIGHT_SHEET_PROMISE;
  }

  IN_FLIGHT_SHEET_PROMISE = (async () => {
    const controller = new AbortController();
    const safetyTimer = setTimeout(() => controller.abort(), 9000);
    try {
      const nonce = Math.random().toString(36).substring(7);
      const productsUrl = `${SHEET_WEBHOOK_URL}?action=get_products&sheet_id=${encodeURIComponent(SHEET_ID)}&worksheet=Sheet1&nocache=1&_t=${Date.now()}&_n=${nonce}`;
      const prodRes = await fetch(productsUrl, {
        signal: controller.signal,
        redirect: "follow",
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0"
        }
      });

      if (prodRes.ok) {
        const rawList: any = await prodRes.json();
        const list = Array.isArray(rawList)
          ? rawList
          : rawList && Array.isArray(rawList.products)
          ? rawList.products
          : null;

        if (list && list.length > 0) {
          const now = Date.now();
          LAST_CATALOG_FETCH_MS = now;
          for (const item of list) {
            const bkp = String(item.backup_image_url || "").trim();
            const pri = String(item.image_url || item.image || "").trim();
            const bestImg = bkp.startsWith("http") && !bkp.includes("/products/")
              ? bkp
              : pri.startsWith("http") && !pri.includes("/products/")
              ? pri
              : bkp || pri;

            const liveStock = item.stock_qty ?? item.stock ?? item.quantity ?? item.stock_quantity;
            const parsedStock =
              liveStock !== undefined && liveStock !== null && String(liveStock).trim() !== ""
                ? isNaN(Number(liveStock))
                  ? 0
                  : Number(liveStock)
                : 0;

            const catalogItem: CatalogItem = {
              name: String(item.product_name || item.name || "Product").trim(),
              price: String(item.selling_price ?? item.mrp ?? "0").trim(),
              mrp: String(item.mrp ?? item.selling_price ?? "0").trim(),
              image: normalizeImageUrl(bestImg),
              category: String(item.category || "Grocery").trim(),
              stock_qty: parsedStock
            };

            const allEansStr = `${item.primary_ean || ""},${item.ean || ""},${item.additional_eans || ""},${Array.isArray(item.ean_list) ? item.ean_list.join(",") : ""}`;
            const tokens = allEansStr
              .split(/[,|;\s]+/)
              .map((s) => s.replace(/^EAN-/i, "").split("_")[0].trim().toLowerCase())
              .filter(Boolean);

            for (const tk of tokens) {
              EDGE_PRODUCT_CACHE.set(tk, { data: catalogItem, timestamp: now });
            }
            if (item.rowIndex !== undefined) {
              EDGE_PRODUCT_CACHE.set(`row-${item.rowIndex}`, { data: catalogItem, timestamp: now });
            }
          }
        }
      }
    } catch {
      // Safe fallback to cached/URL/media data
    } finally {
      clearTimeout(safetyTimer);
      IN_FLIGHT_SHEET_PROMISE = null;
    }
  })();

  return IN_FLIGHT_SHEET_PROMISE;
}

/**
 * Fetches live product & config from Google Sheet (Sheet1).
 * Uses context.waitUntil so the Google Sheet fetch is NEVER aborted mid-flight at 2.2s,
 * ensuring EDGE_PRODUCT_CACHE always warms up for all 103 products.
 */
async function fetchLiveProductAndConfig(
  searchKey: string,
  maxWaitMs: number,
  waitUntil?: (promise: Promise<any>) => void
): Promise<LiveSheetBundle> {
  const cleanTarget = searchKey.split(/[,;|\s]+/)[0].split("_")[0].replace(/^EAN-/i, "").trim();
  const lowerKey = cleanTarget.toLowerCase();

  let product: CatalogItem | null = getCachedProduct(lowerKey);
  const linkCaptionFormat = EDGE_CONFIG_CACHE?.linkCaptionFormat || DEFAULT_LINK_CAPTION_TEMPLATE;
  const storeName = EDGE_CONFIG_CACHE?.storeName || "Munna Mobile & Grocery";
  const storeAddress = EDGE_CONFIG_CACHE?.storeAddress || "Cinema Hall Road, Niali";

  // If already in warm cache, return immediately in <1ms and trigger background revalidate if older than 15s
  if (product) {
    if (Date.now() - LAST_CATALOG_FETCH_MS > STALE_REVALIDATE_MS) {
      const bgPromise = refreshEdgeCatalogFromSheet();
      if (waitUntil) waitUntil(bgPromise);
    }
    return { product, linkCaptionFormat, storeName, storeAddress };
  }

  // Start non-aborted Sheet refresh and keep it alive via waitUntil
  const refreshPromise = refreshEdgeCatalogFromSheet();
  if (waitUntil) {
    waitUntil(refreshPromise);
  }

  if (maxWaitMs > 0) {
    await Promise.race([
      refreshPromise,
      new Promise<void>((resolve) => setTimeout(resolve, maxWaitMs))
    ]);
    product = getCachedProduct(lowerKey);
  }

  return { product, linkCaptionFormat, storeName, storeAddress };
}

function buildOpenGraphCaptionFromTemplate(
  template: string,
  titleName: string,
  displayPrice: string,
  displayMrp: string,
  storeName: string,
  storeAddress: string,
  cleanEan: string,
  category: string,
  stockQtyRaw?: string | number,
  stockStatusRaw?: string
): { ogTitle: string; ogDesc: string } {
  const numSp = Number(displayPrice) || 0;
  const numMrp = Number(displayMrp) || numSp;
  const discountPercent = numMrp > numSp ? Math.round(((numMrp - numSp) / numMrp) * 100) : 0;
  const savings = numMrp > numSp ? numMrp - numSp : 0;

  const qtyNum =
    stockQtyRaw !== undefined && stockQtyRaw !== null && String(stockQtyRaw).trim() !== ""
      ? Number(stockQtyRaw)
      : 0;
  const isOutOfStock = stockStatusRaw === "out_of_stock" || isNaN(qtyNum) || qtyNum <= 0;
  const stockQtyStr = isOutOfStock ? "0pc" : `${qtyNum}pc`;
  const stockStatusStr = isOutOfStock ? "Out of Stock" : `In Stock (${stockQtyStr})`;

  const spNumStr = String(displayPrice);
  const mrpStr = toUnicodeStrike(`MRP ${displayMrp}`);

  const populated = (template || DEFAULT_LINK_CAPTION_TEMPLATE)
    .replace(/\[Product Name with Weight\]|\[Product Name\]|\{product_name\}|\{name\}/gi, titleName)
    .replace(/Rs\s*\*?\[Offer Price\]\*?|Rs\s*\*?\[Selling Price\]\*?|Rs\s*\*?\{selling_price\}|Rs\s*\*?\{offer_price\}/gi, `Rs ${spNumStr}`)
    .replace(/\*?\[Offer Price\]\*?|\*?\[Selling Price\]\*?|\*?\[Price\]\*?|\{selling_price\}|\{offer_price\}|\{price\}|\{sp\}/gi, spNumStr)
    .replace(/~\*MRP \[MRP\]\*~|~MRP \[MRP\]~|\[MRP\]|\{mrp\}/gi, mrpStr)
    .replace(/\[Discount %\]|\[Discount\]|\{discount\}/gi, String(discountPercent))
    .replace(/\[Savings\]|\[Save\]|\{savings\}/gi, String(savings))
    .replace(/\[Stock Status\]|\{stock_status\}/gi, stockStatusStr)
    .replace(/\[Stock Qty\]|\[Stock Quantity\]|\{stock_qty\}/gi, stockQtyStr)
    .replace(/\[Store Name\]|\{store_name\}|\{store\}/gi, storeName)
    .replace(/\[Address\]|\[Store Address\]|\{address\}|\{store_address\}/gi, storeAddress)
    .replace(/\[EAN\]|\[Barcode\]|\{ean\}/gi, cleanEan)
    .replace(/\[Category\]|\{category\}/gi, category)
    .replace(/\[Product Link\]|\[Link\]|\{product_link\}|\{link\}|\{url\}/gi, "");

  const sanitized = populated
    .replace(/Rs\s+Rs\s+/gi, "Rs ")
    .replace(/~([^~\n]+)~/g, (_, inner) => toUnicodeStrike(inner))
    .replace(/\*/g, "");

  const lines = sanitized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("http://") && !l.startsWith("https://"));

  const ogTitle = lines[0] || `${titleName} Rs ${spNumStr}`;
  const ogDesc =
    lines.slice(1).join(" • ") ||
    `Rs ${spNumStr} ${mrpStr} (${discountPercent}% OFF) ${stockStatusStr} • ${storeName}, ${storeAddress} odisha call-9040585726`;

  return { ogTitle, ogDesc };
}

export const onRequest = async (context: {
  request: Request;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  waitUntil?: (promise: Promise<any>) => void;
}): Promise<Response> => {
  const { request } = context;
  const userAgent = request.headers.get("user-agent") || "";
  const url = new URL(request.url);

  const itemParam =
    url.searchParams.get("item") ||
    url.searchParams.get("product") ||
    url.searchParams.get("ean") ||
    url.searchParams.get("id");

  if (!itemParam) {
    return context.next();
  }

  const isCrawlerOrBot = /facebookexternalhit|WhatsApp|Facebot|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Pinterest|SkypeUriPreview|Googlebot|bingbot|Discordbot|axios|node-fetch|undici|got|curl|python|Go-http-client|HeadlessChrome|Preview/i.test(userAgent);

  const cleanKey = itemParam.split(/[,;|\s]+/)[0].split("_")[0].replace(/^EAN-/i, "").trim();

  // Extract inline URL parameters (populated from live Google Sheet when sharing)
  const rawN = url.searchParams.get("n") || url.searchParams.get("name") || "";
  const rawImg = url.searchParams.get("img") || url.searchParams.get("image") || "";
  const rawVParam =
    url.searchParams.get("sp") ||
    url.searchParams.get("v") ||
    url.searchParams.get("price") ||
    url.searchParams.get("p") ||
    "";
  const rawMrpParam = url.searchParams.get("mrp") || url.searchParams.get("m") || "";

  let paramName = "";
  if (rawN) {
    try {
      paramName = decodeURIComponent(rawN).trim();
    } catch {
      paramName = rawN.trim();
    }
  }

  let paramImage = "";
  if (rawImg) {
    try {
      paramImage = decodeURIComponent(rawImg).trim();
    } catch {
      paramImage = rawImg.trim();
    }
  }

  const paramPriceRaw = rawVParam.split("_")[0];
  const paramPriceMatch = paramPriceRaw.match(/\d+(\.\d+)?/);
  const paramPrice = paramPriceMatch ? paramPriceMatch[0] : "";

  const paramMrpMatch = rawMrpParam.match(/\d+(\.\d+)?/);
  const paramMrp = paramMrpMatch ? paramMrpMatch[0] : "";

  const stockParamMatch = itemParam.match(/_s(\d+)_/i) || itemParam.match(/_stk(\d+)_/i);
  const rawStockQueryParam = url.searchParams.get("stk") || url.searchParams.get("stock") || url.searchParams.get("sq") || "";
  let urlStock: number | undefined;
  if (stockParamMatch && stockParamMatch[1]) {
    urlStock = Number(stockParamMatch[1]);
  } else if (rawStockQueryParam !== "" && !isNaN(Number(rawStockQueryParam))) {
    urlStock = Number(rawStockQueryParam);
  }

  // Instant <1ms media-only lookup (Name & HD Photo URL only — no price/stock)
  const mediaMatch = lookupMediaByEan(itemParam);
  const isParamImgDead = !paramImage || paramImage.includes("/products/") || paramImage.startsWith("/products/");
  const hasUrlCompleteData = Boolean((paramName || mediaMatch?.name) && (!isParamImgDead || mediaMatch?.image) && paramPrice && urlStock !== undefined);

  // Wait up to 3600ms for crawlers/bots if URL lacks data, 2800ms if URL has data, or 1800ms for Baileys/browser requests
  const maxWaitMs = isCrawlerOrBot ? (hasUrlCompleteData ? 2800 : 3600) : (hasUrlCompleteData ? 400 : 2800);

  // Fetch live Google Sheet data (with waitUntil so the Sheet fetch never aborts prematurely)
  const liveBundle = await fetchLiveProductAndConfig(cleanKey, maxWaitMs, context.waitUntil?.bind(context));
  const liveProduct = liveBundle.product;

  // Name resolution: 1. Live Google Sheet -> 2. URL &n= param -> 3. EAN Media Index -> 4. Fallback
  const titleName = (liveProduct?.name || paramName || mediaMatch?.name || "Munna Grocery").replace(/\s+/g, " ").trim();

  // Price & MRP resolution: 1. Live Google Sheet -> 2. URL &sp=/&mrp= params (Zero hardcoded prices!)
  const livePrice = liveProduct?.price !== undefined && String(liveProduct.price).trim() !== "" ? String(liveProduct.price).trim() : "";
  const displayPrice = livePrice || paramPrice || "0";
  const liveMrp = liveProduct?.mrp !== undefined && String(liveProduct.mrp).trim() !== "" ? String(liveProduct.mrp).trim() : "";
  const displayMrp = liveMrp || paramMrp || displayPrice;
  const displayCategory = liveProduct?.category || mediaMatch?.category || "Grocery";

  // Image resolution: 1. Live Google Sheet -> 2. URL &img= param -> 3. EAN Media Index -> 4. Banner
  let candidateImg = "";
  if (liveProduct?.image && !liveProduct.image.includes("/products/")) {
    candidateImg = liveProduct.image;
  } else if (paramImage && !isParamImgDead) {
    candidateImg = paramImage;
  } else if (mediaMatch?.image && !mediaMatch.image.includes("/products/")) {
    candidateImg = mediaMatch.image;
  } else {
    candidateImg = DEFAULT_BANNER;
  }

  let finalImageUrl = normalizeImageUrl(candidateImg);
  if (!finalImageUrl) {
    finalImageUrl = DEFAULT_BANNER;
  }

  const ogImageType = /\.png(\?.*)?$/i.test(finalImageUrl) ? "image/png" : "image/jpeg";

  // Stock resolution: 1. Live Google Sheet stock_qty -> 2. URL embedded stock (_s{stk}_ or &stk=) (Zero hardcoded stock!)
  const rawStock =
    liveProduct?.stock_qty !== undefined
      ? liveProduct.stock_qty
      : urlStock !== undefined
      ? urlStock
      : 0;

  const { ogTitle, ogDesc } = buildOpenGraphCaptionFromTemplate(
    liveBundle.linkCaptionFormat,
    titleName,
    displayPrice,
    displayMrp,
    liveBundle.storeName,
    liveBundle.storeAddress,
    cleanKey,
    displayCategory,
    rawStock
  );

  const pageTitle = ogTitle;
  const canonicalUrl = request.url;

  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  let html = await response.text();

  const tagsToInject = `
  <!-- Dynamic Open Graph Product Preview for ${escapeHtml(cleanKey)} -->
  <title>${escapeHtml(pageTitle)}</title>
  <link rel="image_src" href="${escapeHtml(finalImageUrl)}" />
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="Munna Mobile & Grocery" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDesc)}" />
  <meta property="og:image" content="${escapeHtml(finalImageUrl)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(finalImageUrl)}" />
  <meta property="og:image:type" content="${ogImageType}" />
  <meta property="og:image:width" content="600" />
  <meta property="og:image:height" content="600" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(ogDesc)}" />
  <meta name="twitter:image" content="${escapeHtml(finalImageUrl)}" />
  <meta name="description" content="${escapeHtml(ogDesc)}" />
`;

  html = html
    .replace(/<title>.*?<\/title>/is, "")
    .replace(/<meta\s+property=["']og:title["'].*?>/gis, "")
    .replace(/<meta\s+property=["']og:description["'].*?>/gis, "")
    .replace(/<meta\s+property=["']og:image["'].*?>/gis, "")
    .replace(/<meta\s+property=["']og:image:secure_url["'].*?>/gis, "")
    .replace(/<meta\s+property=["']og:image:width["'].*?>/gis, "")
    .replace(/<meta\s+property=["']og:image:height["'].*?>/gis, "")
    .replace(/<meta\s+property=["']og:url["'].*?>/gis, "")
    .replace(/<meta\s+property=["']og:type["'].*?>/gis, "")
    .replace(/<meta\s+property=["']og:site_name["'].*?>/gis, "")
    .replace(/<meta\s+name=["']twitter:card["'].*?>/gis, "")
    .replace(/<meta\s+name=["']twitter:title["'].*?>/gis, "")
    .replace(/<meta\s+name=["']twitter:description["'].*?>/gis, "")
    .replace(/<meta\s+name=["']twitter:image["'].*?>/gis, "")
    .replace(/<meta\s+name=["']description["'].*?>/gis, "");

  html = html.replace(/<head>/i, "<head>" + tagsToInject);

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "text/html; charset=UTF-8");
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");

  return new Response(html, {
    status: 200,
    headers
  });
};
