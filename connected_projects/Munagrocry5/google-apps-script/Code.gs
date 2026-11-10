/**
 * ============================================================================
 * MUNNA MOBILE & GROCERY - GOOGLE APPS SCRIPT DATABASE BACKEND
 * ============================================================================
 * 
 * Connected Sheet ID: 1wj0Lg32nIDjCDadnBovK2u0agpJ4gIJr1ahxya1GMGE
 * Spreadsheet Name: MUNNA MOBILE & Grocery Database
 * 
 * Instructions to deploy:
 * 1. Open https://script.google.com/
 * 2. Create a New Project (or open your existing Apps Script project)
 * 3. Replace all code with this script
 * 4. Verify SHEET_ID below matches your Google Sheet ID
 * 5. Click "Deploy" > "New deployment"
 * 6. Select type: "Web app"
 * 7. Set:
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (allows app to connect without Google login)
 * 8. Click "Deploy", authorize permissions, and copy the Web App URL (ends with /exec)
 * 9. Paste the Web App URL into your app's Admin Panel Settings or .env file!
 */

// ==========================================
// CONFIGURATION: YOUR GOOGLE SHEET ID
// ==========================================
var DEFAULT_SHEET_ID = '1wj0Lg32nIDjCDadnBovK2u0agpJ4gIJr1ahxya1GMGE';

/**
 * 🔑 1-CLICK AUTHORIZATION FOR URLFETCHAPP
 * 
 * Select 'authorizeScript' from the function dropdown at the top of script.google.com
 * and click '▷ Run'. Google will show "Authorization Required".
 * Click "Review permissions" -> select your Google Account -> "Advanced" -> "Go to ... (unsafe)" -> "Allow".
 * After doing this ONCE, click "Deploy" > "Manage Deployments" > "Edit (pencil)" > "Version: New version" > "Deploy".
 */
function authorizeScript() {
  Logger.log("Authorizing UrlFetchApp for WhatsApp Render Gateway...");
  try {
    var response = UrlFetchApp.fetch("https://httpbin.org/get", { muteHttpExceptions: true });
    Logger.log("✅ Successfully authorized UrlFetchApp! HTTP Status: " + response.getResponseCode());
    return "SUCCESS: UrlFetchApp is now fully authorized! Now Deploy > Manage Deployments > Edit > New Version > Deploy.";
  } catch (e) {
    Logger.log("❌ Error during authorization: " + e.message);
    throw e;
  }
}

/**
 * Quick diagnostic function to verify UrlFetchApp permission
 */
function testUrlFetchPermission() {
  try {
    var res = UrlFetchApp.fetch("https://super-light-web-whatsapp-api-server-rubo.onrender.com", {
      muteHttpExceptions: true,
      method: 'get'
    });
    return {
      status: 'success',
      authorized: true,
      statusCode: res.getResponseCode(),
      message: 'UrlFetchApp is fully authorized and Render server is reachable!'
    };
  } catch (err) {
    return {
      status: 'error',
      authorized: false,
      message: err.toString()
    };
  }
}

/**
 * Connect to Google Sheet by Sheet ID
 */
function getSpreadsheet(customSheetId) {
  var id = customSheetId || DEFAULT_SHEET_ID;
  if (id && id !== 'YOUR_GOOGLE_SHEET_ID_HERE') {
    try {
      return SpreadsheetApp.openById(id);
    } catch (err) {
      Logger.log('Could not openById with ID ' + id + ', falling back to active sheet: ' + err);
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Handle HTTP GET Requests
 */
function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var action = (params.action || 'get_config').toLowerCase();
    var feedParam = String(params.feed || '').toLowerCase().trim();
    var sheetId = params.sheet_id || params.sheetId || DEFAULT_SHEET_ID;

    // Direct Meta Commerce Manager Scheduled Data Feed CSV output (?feed=facebook)
    if (feedParam === 'facebook' || action === 'facebook_feed' || action === 'facebook_csv') {
      var csvText = handleGetFacebookFeedCsv(sheetId);
      return ContentService.createTextOutput(csvText)
        .setMimeType(ContentService.MimeType.CSV);
    }

    // WhatsApp Baileys Auto-Loop Broadcaster Web App UI (?page=loop, ?action=wa_loop, ?view=loop)
    if (params.page === 'loop' || action === 'wa_loop' || action === 'whatsapp_loop' || params.view === 'loop' || params.ui === 'loop') {
      try {
        return HtmlService.createTemplateFromFile('Index')
          .evaluate()
          .setTitle('Munna Grocery - WhatsApp Baileys Auto-Loop Broadcaster')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
          .addMetaTag('viewport', 'width=device-width, initial-scale=1');
      } catch (htmlErr) {
        return HtmlService.createHtmlOutput(getInlineWaLoopHtml(sheetId))
          .setTitle('Munna Grocery - WhatsApp Baileys Auto-Loop Broadcaster')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
          .addMetaTag('viewport', 'width=device-width, initial-scale=1');
      }
    }

    var result;
    switch (action) {
      case 'get_config':
        result = handleGetConfig(sheetId);
        break;
      case 'save_config':
        var configPayload = {};
        if (params.data) {
          try {
            configPayload = JSON.parse(params.data);
          } catch (e) {
            configPayload = params;
          }
        } else {
          configPayload = params;
        }
        result = handleSaveConfig(sheetId, configPayload);
        break;
      case 'save_share_format':
        result = handleSaveShareFormat(sheetId, params);
        break;
      case 'get_products':
        result = handleGetProducts(sheetId, params.worksheet || params.sheet || params.tab);
        break;
      case 'get_orders':
        result = handleGetOrders(sheetId, params.phone);
        break;
      case 'check_user':
        result = handleCheckUser(sheetId, params.phone);
        break;
      case 'setup_database':
        result = setupDatabase(sheetId);
        break;
      case 'get_users':
        result = handleGetUsers(sheetId);
        break;
      case 'track_viewer':
        result = handleTrackViewer(sheetId, params);
        break;
      case 'search_jiomart':
        result = handleJioMartProxy(params.q, params.pincode || params.pin, params.strict);
        break;
      case 'delete_product':
      case 'delete':
        result = handleDeleteProduct(sheetId, params);
        break;
      case 'update_product_stock':
      case 'update_stock':
        result = handleUpdateProductStock(sheetId, params);
        break;
      case 'update_product':
      case 'add_product':
      case 'add_item':
      case 'save_product':
        result = handleUpdateProduct(sheetId, params);
        break;
      case 'get_parties':
        result = handleGetParties(sheetId);
        break;
      case 'save_party':
        var partyPayload = {};
        if (params.data) {
          try { partyPayload = JSON.parse(params.data); } catch (e) { partyPayload = params; }
        } else {
          partyPayload = params;
        }
        result = handleSaveParty(sheetId, partyPayload);
        break;
      case 'update_party_balance':
      case 'collect_udhar':
        result = handleUpdatePartyBalance(sheetId, params);
        break;
      case 'get_expenses':
        result = handleGetExpenses(sheetId);
        break;
      case 'add_expense':
        result = handleAddExpense(sheetId, params);
        break;
      case 'get_sales':
      case 'get_pos_sales':
        result = handleGetPosSales(sheetId);
        break;
      case 'create_sale':
      case 'record_pos_sale':
      case 'save_sale':
        var saleGetPayload = {};
        if (params.data) {
          try { saleGetPayload = JSON.parse(params.data); } catch (e) { saleGetPayload = params; }
        } else {
          saleGetPayload = params;
        }
        result = handleCreatePosSale(sheetId, saleGetPayload);
        break;
      case 'batch_update_products':
        result = handleBatchUpdateProducts(sheetId, params);
        break;
      case 'sync_facebook':
      case 'sync_facebook_feed':
        result = handleSyncFacebookFeed(sheetId);
        break;
      case 'get_product_preview':
        result = handleGetProductPreview(sheetId, params.item || params.ean || params.product || params.id);
        break;
      case 'reset_all_links':
      case 'reset_product_links':
        result = handleResetAllProductLinks(sheetId);
        break;
      case 'get_wa_settings':
        result = handleGetWaSettings(sheetId);
        break;
      case 'update_wa_settings':
        var waSettingsPayload = {};
        if (params.data) {
          try { waSettingsPayload = JSON.parse(params.data); } catch (e) { waSettingsPayload = params; }
        } else {
          waSettingsPayload = params;
        }
        result = handleUpdateWaSettings(sheetId, waSettingsPayload);
        break;
      case 'get_products_loop':
        result = getProductsForLoop(sheetId, params.domain);
        break;
      case 'post_wa_message':
      case 'send_wa_message':
        result = postWhatsAppMessage(params.link || params.product_link, params.recipient || params.to, sheetId, params.product_key || params.productKey || params.ean, params.price, params.stock);
        break;
      case 'edit_wa_message':
        result = editWhatsAppMessage(params.message_id || params.messageId, params.link || params.product_link, params.recipient || params.to, sheetId, params.product_key || params.productKey || params.ean, params.price, params.stock);
        break;
      case 'record_wa_sent_msg':
      case 'save_wa_sent_msg':
        result = recordWaSentMessageInSheet(sheetId, params.product_key || params.productKey || params.ean, params.message_id || params.messageId, params.recipient || params.to, params.link || params.product_link, params.status, params.price, params.stock);
        break;
      case 'get_wa_sent_log':
      case 'get_wa_sent_messages':
        result = handleGetWaSentLog(sheetId);
        break;
      case 'get_wa_sent_msg':
        result = getWaSentMessageFromSheet(sheetId, params.product_key || params.productKey || params.ean);
        break;
      case 'test_wa_connection':
        result = testWaConnection(sheetId);
        break;
      case 'setup_cloud_trigger':
      case 'enable_cloud_trigger':
        result = setupCloudLoopTrigger(sheetId);
        break;
      case 'stop_cloud_trigger':
      case 'disable_cloud_trigger':
        result = stopCloudLoopTrigger(sheetId);
        break;
      case 'get_cloud_trigger_status':
        result = getCloudTriggerStatus(sheetId);
        break;
      default:
        result = {
          status: 'success',
          message: 'Munna Mobile & Grocery Backend API is Active',
          sheet_id: sheetId,
          timestamp: new Date().toISOString()
        };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle HTTP POST Requests
 */
function doPost(e) {
  try {
    var rawData = e && e.postData ? e.postData.contents : '{}';
    var payload;
    try {
      payload = JSON.parse(rawData);
    } catch (parseErr) {
      payload = e ? e.parameter : {};
    }

    var action = (payload.action || '').toLowerCase();
    var sheetId = payload.sheet_id || payload.sheetId || (e && e.parameter ? e.parameter.sheet_id : '') || DEFAULT_SHEET_ID;

    var result;
    switch (action) {
      case 'login':
        result = handleLogin(sheetId, payload);
        break;
      case 'register_user':
        result = handleRegisterUser(sheetId, payload);
        break;
      case 'check_user':
        result = handleCheckUser(sheetId, payload.phone);
        break;
      case 'get_config':
        result = handleGetConfig(sheetId);
        break;
      case 'save_config':
        result = handleSaveConfig(sheetId, payload);
        break;
      case 'save_share_format':
        result = handleSaveShareFormat(sheetId, payload);
        break;
      case 'create_order':
        result = handleCreateOrder(sheetId, payload);
        break;
      case 'update_order_stage':
      case 'update_order_status':
        result = handleUpdateOrderStage(sheetId, payload);
        break;
      case 'update_product':
      case 'add_product':
      case 'add_item':
      case 'save_product':
        result = handleUpdateProduct(sheetId, payload);
        break;
      case 'get_parties':
        result = handleGetParties(sheetId);
        break;
      case 'save_party':
        result = handleSaveParty(sheetId, payload);
        break;
      case 'update_party_balance':
      case 'collect_udhar':
        result = handleUpdatePartyBalance(sheetId, payload);
        break;
      case 'create_sale':
      case 'record_pos_sale':
      case 'save_sale':
        result = handleCreatePosSale(sheetId, payload);
        break;
      case 'get_sales':
      case 'get_pos_sales':
        result = handleGetPosSales(sheetId);
        break;
      case 'get_expenses':
        result = handleGetExpenses(sheetId);
        break;
      case 'add_expense':
        result = handleAddExpense(sheetId, payload);
        break;
      case 'update_product_stock':
      case 'update_stock':
        result = handleUpdateProductStock(sheetId, payload);
        break;
      case 'delete_product':
      case 'delete':
        result = handleDeleteProduct(sheetId, payload);
        break;
      case 'batch_update_products':
        result = handleBatchUpdateProducts(sheetId, payload);
        break;
      case 'sync_facebook':
      case 'sync_facebook_feed':
        result = handleSyncFacebookFeed(sheetId);
        break;
      case 'get_product_preview':
        result = handleGetProductPreview(sheetId, payload.item || payload.ean || payload.product || payload.id);
        break;
      case 'reset_all_links':
      case 'reset_product_links':
        result = handleResetAllProductLinks(sheetId);
        break;
      case 'get_wa_settings':
        result = handleGetWaSettings(sheetId);
        break;
      case 'update_wa_settings':
        result = handleUpdateWaSettings(sheetId, payload.settings || payload);
        break;
      case 'get_products_loop':
        result = getProductsForLoop(sheetId, payload.domain);
        break;
      case 'post_wa_message':
      case 'send_wa_message':
        result = postWhatsAppMessage(payload.product_link || payload.link || payload.text, payload.recipient || payload.to, sheetId, payload.product_key || payload.productKey || payload.ean, payload.price, payload.stock);
        break;
      case 'edit_wa_message':
        result = editWhatsAppMessage(payload.message_id || payload.messageId, payload.product_link || payload.link || payload.text, payload.recipient || payload.to, sheetId, payload.product_key || payload.productKey || payload.ean, payload.price, payload.stock);
        break;
      case 'record_wa_sent_msg':
      case 'save_wa_sent_msg':
        result = recordWaSentMessageInSheet(sheetId, payload.product_key || payload.productKey || payload.ean, payload.message_id || payload.messageId, payload.recipient || payload.to, payload.product_link || payload.link || payload.text, payload.status, payload.price, payload.stock);
        break;
      case 'get_wa_sent_log':
      case 'get_wa_sent_messages':
        result = handleGetWaSentLog(sheetId);
        break;
      case 'get_wa_sent_msg':
        result = getWaSentMessageFromSheet(sheetId, payload.product_key || payload.productKey || payload.ean);
        break;
      case 'test_wa_connection':
        result = testWaConnection(sheetId);
        break;
      case 'save_address':
        result = handleSaveAddress(sheetId, payload);
        break;
      case 'sync_cart':
        result = handleSyncCart(sheetId, payload);
        break;
      case 'check_admin_auth':
        result = handleAdminAuth(sheetId, payload);
        break;
      case 'get_users':
        result = handleGetUsers(sheetId);
        break;
      case 'track_viewer':
        result = handleTrackViewer(sheetId, payload);
        break;
      default:
        result = {
          status: 'error',
          message: 'Unknown action: ' + action
        };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// ACTION HANDLERS
// ==========================================

/**
 * 1. Config Handler: Reads Key-Value pairs from 'Config' Sheet
 */
function handleGetConfig(sheetId) {
  var ss = getSpreadsheet(sheetId);
  var sheet = ss.getSheetByName('Config');
  if (!sheet) {
    setupDatabase(sheetId);
    sheet = ss.getSheetByName('Config');
  }

  var data = sheet.getDataRange().getValues();
  var config = {};

  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    var val = data[i][1];
    if (key) {
      var lowerK = key.toLowerCase();
      // SECURITY: Never expose admin password in public config response
      if (lowerK === 'admin_password' || lowerK === 'admin_pass') {
        continue;
      }
      if (val instanceof Date) {
        var h = String(val.getHours());
        if (h.length < 2) h = '0' + h;
        var m = String(val.getMinutes());
        if (m.length < 2) m = '0' + m;
        val = h + ':' + m;
      }
      config[key] = val;
    }
  }

  if (!config.whatsapp_share_format) {
    config.whatsapp_share_format = '*[Product Name with Weight]*\n*Rs [Offer Price]* ~MRP [MRP]~\n[Store Name]\n[Address]\n[Product Link]';
  }
  if (!config.whatsapp_link_caption_format) {
    config.whatsapp_link_caption_format = '[Product Name with Weight]\n*Rs [Offer Price]* ~*MRP [MRP]*~ ([Discount %]% OFF) [Stock Status]\n[Store Name], [Address] odisha call-9040585726';
  }

  return {
    status: 'success',
    sheet_id: ss.getId(),
    sheet_name: ss.getName(),
    config: config
  };
}

/**
 * 1b. Save Share Format Only: Writes ONLY whatsapp_share_format, whatsapp_link_caption_format
 * (and optional store_name / store_pickup_address) into the 'Config' tab without touching any other tab or unrelated keys.
 */
function handleSaveShareFormat(sheetId, payload) {
  var ss = getSpreadsheet(sheetId);
  var sheet = ss.getSheetByName('Config');
  if (!sheet) {
    setupDatabase(sheetId);
    sheet = ss.getSheetByName('Config');
  }

  var formatVal = String(
    payload.whatsapp_share_format ||
    payload.whatsappShareFormat ||
    payload.share_format ||
    payload.format ||
    payload.value ||
    ''
  ).trim();

  if (!formatVal) {
    formatVal = '*[Product Name with Weight]*\n*Rs [Offer Price]* ~MRP [MRP]~\n[Store Name]\n[Address]\n[Product Link]';
  }

  var linkCaptionVal = String(
    payload.whatsapp_link_caption_format ||
    payload.whatsappLinkCaptionFormat ||
    payload.link_caption_format ||
    ''
  ).trim();

  var data = sheet.getDataRange().getValues();
  var existingLowerMap = {};
  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][0]).trim();
    if (k) {
      existingLowerMap[k.toLowerCase()] = i + 1;
    }
  }

  function upsertConfigKey(keyName, val) {
    var r = existingLowerMap[keyName.toLowerCase()];
    if (r) {
      sheet.getRange(r, 2).setValue(val);
    } else {
      sheet.appendRow([keyName, val]);
      existingLowerMap[keyName.toLowerCase()] = sheet.getLastRow();
    }
  }

  upsertConfigKey('whatsapp_share_format', formatVal);

  if (linkCaptionVal) {
    upsertConfigKey('whatsapp_link_caption_format', linkCaptionVal);
  }
  if (payload.store_name !== undefined && String(payload.store_name).trim()) {
    upsertConfigKey('store_name', String(payload.store_name).trim());
  }
  if (payload.store_pickup_address !== undefined && String(payload.store_pickup_address).trim()) {
    upsertConfigKey('store_pickup_address', String(payload.store_pickup_address).trim());
  }

  var newVer = 'fmt_' + new Date().getTime().toString(36).slice(-5);
  upsertConfigKey('share_link_version', newVer);

  SpreadsheetApp.flush();
  return {
    status: 'success',
    ok: true,
    whatsapp_share_format: formatVal,
    whatsapp_link_caption_format: linkCaptionVal || undefined,
    share_link_version: newVer,
    message: 'WhatsApp share & link caption format saved to Config tab successfully (Link version updated to ' + newVer + ')'
  };
}

/**
 * 2. Save Config: Updates or Appends Key-Values in 'Config' Sheet
 */
function handleSaveConfig(sheetId, payload) {
  var ss = getSpreadsheet(sheetId);
  var sheet = ss.getSheetByName('Config');
  if (!sheet) {
    setupDatabase(sheetId);
    sheet = ss.getSheetByName('Config');
  }

  var data = sheet.getDataRange().getValues();
  var existingMap = {};
  var existingLowerMap = {};
  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][0]).trim();
    if (k) {
      existingMap[k] = i + 1; // 1-indexed row number
      existingLowerMap[k.toLowerCase()] = i + 1;
    }
  }

  // Helper to safely write config cell
  function writeConfigValue(targetRow, val) {
    var cell = sheet.getRange(targetRow, 2);
    cell.setValue(val);
  }

  // Support single-key payload: { action: 'SAVE_CONFIG', key: '...', value: '...' }
  if (payload.key !== undefined) {
    var singleKey = String(payload.key).trim();
    var singleVal = payload.value;
    if (singleVal === undefined || singleVal === null) singleVal = '';
    if (typeof singleVal === 'object') singleVal = JSON.stringify(singleVal);
    
    var rowIdx = existingMap[singleKey] || existingLowerMap[singleKey.toLowerCase()];
    if (rowIdx) {
      writeConfigValue(rowIdx, singleVal);
    } else {
      sheet.appendRow([singleKey, '']);
      var newR = sheet.getLastRow();
      writeConfigValue(newR, singleVal);
      existingMap[singleKey] = newR;
      existingLowerMap[singleKey.toLowerCase()] = newR;
    }
    SpreadsheetApp.flush();
    return {
      status: 'success',
      ok: true,
      key: singleKey,
      message: 'Config key ' + singleKey + ' saved successfully'
    };
  }

  var systemKeys = ['action', 'sheet_id', 'sheetid', '_', 'callback', 'key', 'value', '_t', 'data'];
  var updatedKeys = [];

  for (var key in payload) {
    if (payload.hasOwnProperty(key) && systemKeys.indexOf(key.toLowerCase()) === -1) {
      var val = payload[key];
      if (val !== undefined && val !== null) {
        if (typeof val === 'object') {
          val = JSON.stringify(val);
        }
        var targetRow = existingMap[key] || existingLowerMap[key.toLowerCase()];
        if (targetRow) {
          writeConfigValue(targetRow, val);
        } else {
          sheet.appendRow([key, '']);
          var addedRow = sheet.getLastRow();
          writeConfigValue(addedRow, val);
          existingMap[key] = addedRow;
          existingLowerMap[key.toLowerCase()] = addedRow;
        }
        updatedKeys.push(key);
      }
    }
  }

  SpreadsheetApp.flush();
  return {
    status: 'success',
    ok: true,
    message: 'Store configuration saved to sheet successfully (' + updatedKeys.length + ' settings updated)',
    updated_keys: updatedKeys
  };
}

/**
 * 3. User Authentication (Login)
 * Sheet: Users
 * Columns: User ID, Name, Phone, PasswordHash, Default Address, Total Orders, Created At, CartJSON
 */
function handleLogin(sheetId, payload) {
  var ss = getSpreadsheet(sheetId);
  var sheet = ss.getSheetByName('Users');
  if (!sheet) {
    setupDatabase(sheetId);
    return { status: 'not_found', isNew: true };
  }

  var cleanPhone = String(payload.phone || '').replace(/\D/g, '').slice(-10);
  var reqHash = String(payload.passwordHash || '').trim();

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rowPhone = String(data[i][2]).replace(/\D/g, '').slice(-10);
    if (rowPhone === cleanPhone) {
      var sheetHash = String(data[i][3]).trim();
      if (!sheetHash || sheetHash === reqHash) {
        return {
          status: 'success',
          ok: true,
          user: {
            user_id: data[i][0] || 'U-' + cleanPhone,
            name: data[i][1] || 'Customer',
            phone: cleanPhone,
            address: data[i][4] || '',
            total_orders: Number(data[i][5]) || 0
          }
        };
      } else {
        return { status: 'incorrect_password', valid: false, error: 'INCORRECT_PASSWORD' };
      }
    }
  }

  return { status: 'not_found', isNew: true, error: 'USER_NOT_FOUND' };
}

/**
 * 4. User Registration
 */
function handleRegisterUser(sheetId, payload) {
  var ss = getSpreadsheet(sheetId);
  var sheet = ss.getSheetByName('Users');
  if (!sheet) {
    setupDatabase(sheetId);
    sheet = ss.getSheetByName('Users');
  }

  var cleanPhone = String(payload.phone || '').replace(/\D/g, '').slice(-10);
  var userId = payload.user_id || 'U-' + Date.now();
  var name = payload.name || 'Customer';
  var passwordHash = payload.passwordHash || '';
  var address = payload.default_address || payload.address || '';
  var totalOrders = Number(payload.total_orders) || 0;
  var createdAt = payload.created_at || new Date().toISOString();
  var cartJson = payload.cart_json || '{}';

  // Check if phone already registered
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var p = String(data[i][2]).replace(/\D/g, '').slice(-10);
    if (p === cleanPhone) {
      // Update existing
      sheet.getRange(i + 1, 2).setValue(name);
      if (passwordHash) sheet.getRange(i + 1, 4).setValue(passwordHash);
      if (address) sheet.getRange(i + 1, 5).setValue(address);
      return { status: 'success', message: 'User updated', user_id: data[i][0] };
    }
  }

  sheet.appendRow([userId, name, cleanPhone, passwordHash, address, totalOrders, createdAt, cartJson]);
  return { status: 'success', message: 'User registered', user_id: userId };
}

/**
 * 5. Check if User Exists
 */
function handleCheckUser(sheetId, phone) {
  var ss = getSpreadsheet(sheetId);
  var sheet = ss.getSheetByName('Users');
  if (!sheet) return { exists: false, isNew: true };

  var cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var p = String(data[i][2]).replace(/\D/g, '').slice(-10);
    if (p === cleanPhone) {
      return {
        exists: true,
        isNew: false,
        name: data[i][1],
        address: data[i][4],
        total_orders: data[i][5]
      };
    }
  }

  return { exists: false, isNew: true };
}

/**
 * 6. Order Placement
 * Sheet: Orders
 * Columns: id, user_id, name, phone, address, items, total, stage, status, payment, created_at, delivery_type, pickup_slot, location
 */
function handleCreateOrder(sheetId, payload) {
  var ss = getSpreadsheet(sheetId);
  var sheet = ss.getSheetByName('Orders');
  if (!sheet) {
    setupDatabase(sheetId);
    sheet = ss.getSheetByName('Orders');
  }

  var orderId = payload.id || payload.order_id || 'ORD-' + Date.now();
  var userId = payload.user_id || payload.phone || '';
  var name = payload.name || payload.customer_name || '';
  var phone = payload.phone || '';
  var address = payload.address || '';
  var items = typeof payload.items === 'string' ? payload.items : JSON.stringify(payload.items || []);
  var total = payload.total || 0;
  var stage = payload.stage || 1;
  var status = payload.status || 'pending';
  var payment = payload.payment || 'COD';
  var createdAt = payload.created_at || new Date().toISOString();
  var deliveryType = payload.delivery_type || 'Home Delivery';
  var pickupSlot = payload.pickup_slot || '';
  var location = payload.location || '';

  sheet.appendRow([
    orderId, userId, name, phone, address, items, total,
    stage, status, payment, createdAt, deliveryType, pickupSlot, location
  ]);

  // Increment total orders in Users sheet
  if (phone) {
    incrementUserOrderCount(ss, phone);
  }

  return { status: 'success', ok: true, order_id: orderId };
}

/**
 * 7. Update Order Stage & Status
 */
function handleUpdateOrderStage(sheetId, payload) {
  var ss = getSpreadsheet(sheetId);
  var sheet = ss.getSheetByName('Orders');
  if (!sheet) return { status: 'error', message: 'Orders sheet missing' };

  var targetId = String(payload.order_id || payload.id || '').trim();
  var newStage = payload.stage;
  var newStatus = payload.status;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === targetId) {
      if (newStage !== undefined) sheet.getRange(i + 1, 8).setValue(newStage);
      if (newStatus !== undefined) sheet.getRange(i + 1, 9).setValue(newStatus);
      return { status: 'success', ok: true, message: 'Order updated' };
    }
  }

  return { status: 'error', message: 'Order ID not found: ' + targetId };
}

/**
 * Helper: Find the active products sheet in the spreadsheet
 */
function getProductsSheet(ss) {
  var sheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Products') || ss.getSheetByName('Catalog');
  if (!sheet || sheet.getLastRow() <= 1) {
    var allSheets = ss.getSheets();
    for (var s = 0; s < allSheets.length; s++) {
      var sName = allSheets[s].getName();
      if (['Orders', 'Config', 'Users', 'Addresses', 'Tokens', 'Passwords', 'SearchQueue', 'LoginOTPs', 'Viewers', 'Facebook_Feed'].indexOf(sName) === -1) {
        if (allSheets[s].getLastRow() > 1) {
          sheet = allSheets[s];
          break;
        }
      }
    }
  }
  if (!sheet && ss.getSheets().length > 0) {
    sheet = ss.getSheets()[0];
  }
  return sheet;
}

/**
/**
 * Helper: Parse comma/semicolon/pipe separated EANs into a deduplicated array of clean strings
 */
function parseSheetEans(rawVal) {
  if (rawVal === undefined || rawVal === null) return [];
  var str = String(rawVal).trim();
  if (!str) return [];
  var parts = str.split(/[,;|\n]+/);
  var seen = {};
  var result = [];
  for (var i = 0; i < parts.length; i++) {
    var raw = String(parts[i] || '').replace(/^EAN-/i, '').trim();
    if (!raw) continue;
    // Handle scientific notation / float like 4.9000038e+12 or 7541105.0
    if (/^[0-9.]+(?:e[+-]?[0-9]+)?$/i.test(raw)) {
      var n = Number(raw);
      if (!isNaN(n) && isFinite(n) && n > 0) {
        raw = String(Math.round(n));
      }
    }
    var clean = raw.trim();
    if (!clean) continue;
    var key = clean.toLowerCase();
    if (!seen[key]) {
      seen[key] = true;
      result.push(clean);
    }
  }
  return result;
}

/**
 * Helper: Check if two single EAN tokens match (exact, digits, or numeric/scientific)
 */
function isSingleEanTokenMatch(tokenA, tokenB) {
  var a = String(tokenA || '').replace(/^EAN-/i, '').trim();
  var b = String(tokenB || '').replace(/^EAN-/i, '').trim();
  if (!a || !b) return false;
  if (a.toLowerCase() === b.toLowerCase()) return true;
  var dA = a.replace(/\D/g, '');
  var dB = b.replace(/\D/g, '');
  if (dA && dB && dA.length >= 4 && dA === dB) return true;
  var numA = Number(a);
  var numB = Number(b);
  if (!isNaN(numA) && !isNaN(numB) && numA > 0 && Math.round(numA) === Math.round(numB)) return true;
  return false;
}

/**
 * Helper: Inspect top rows (0..2) to dynamically map column headers.
 */
function getProductColumnMap(data) {
  var colMap = {
    name: -1,
    mrp: -1,
    sp: -1,
    stock: -1,
    ean: -1,
    img: -1,
    cat: -1,
    desc: -1,
    backup_img: -1,
    additional_imgs: -1,
    additional_eans: -1,
    video: -1,
    max_qty: -1,
    row_idx_col: -1,
    headerRowIdx: 0
  };
  for (var r = 0; r < Math.min(3, data.length); r++) {
    var row = data[r];
    for (var c = 0; c < row.length; c++) {
      var h = String(row[c] || '').toLowerCase().trim();
      if (!h) continue;
      if (h === '#' || h === 's.no' || h === 'sl_no' || h === 'sl.no' || h === 'rowindex' || h === 'row_index' || h === 'id' || h === 'no') colMap.row_idx_col = c;
      else if (h === 'additional_eans' || h === 'additional_ean' || h === 'extra_eans' || h === 'multiple_eans' || h === 'ean_list' || h === 'barcodes') colMap.additional_eans = c;
      else if (colMap.ean === -1 && (h.indexOf('ean') >= 0 || h.indexOf('barcode') >= 0 || h.indexOf('code') >= 0)) colMap.ean = c;
      else if (colMap.name === -1 && (h.indexOf('name') >= 0 || h.indexOf('product') >= 0 || h.indexOf('title') >= 0 || h.indexOf('item') >= 0)) colMap.name = c;
      else if (colMap.mrp === -1 && h.indexOf('mrp') >= 0) colMap.mrp = c;
      else if (colMap.sp === -1 && (h.indexOf('selling') >= 0 || h.indexOf('price') >= 0 || h.indexOf('sp') >= 0 || h.indexOf('rate') >= 0)) colMap.sp = c;
      else if (colMap.max_qty === -1 && h.indexOf('max') >= 0 && (h.indexOf('qty') >= 0 || h.indexOf('order') >= 0 || h.indexOf('limit') >= 0 || h.indexOf('cart') >= 0)) colMap.max_qty = c;
      else if (colMap.stock === -1 && (h.indexOf('stock') >= 0 || h.indexOf('qty') >= 0 || h.indexOf('quantity') >= 0 || h.indexOf('balance') >= 0 || h.indexOf('count') >= 0)) colMap.stock = c;
      else if (colMap.backup_img === -1 && (h.indexOf('backup') >= 0 || h.indexOf('cdn') >= 0 || h.indexOf('original') >= 0)) colMap.backup_img = c;
      else if (colMap.additional_imgs === -1 && (h.indexOf('additional') >= 0 || h.indexOf('gallery') >= 0 || h.indexOf('extra') >= 0 || h.indexOf('more_img') >= 0 || h.indexOf('multi') >= 0) && h !== 'additional_eans' && h !== 'additional_ean') colMap.additional_imgs = c;
      else if (colMap.img === -1 && (h.indexOf('image') >= 0 || h.indexOf('photo') >= 0 || h.indexOf('img') >= 0 || h.indexOf('url') >= 0) && h.indexOf('backup') === -1 && h.indexOf('cdn') === -1 && h.indexOf('additional') === -1 && h.indexOf('gallery') === -1 && h.indexOf('extra') === -1 && h.indexOf('more') === -1 && h.indexOf('video') === -1) colMap.img = c;
      else if (colMap.video === -1 && (h.indexOf('video') >= 0 || h.indexOf('youtube') >= 0 || h.indexOf('media') >= 0)) colMap.video = c;
      else if (colMap.cat === -1 && (h.indexOf('category') >= 0 || h.indexOf('cat') >= 0 || h === 'column 1' || h === 'column1')) colMap.cat = c;
      else if (colMap.desc === -1 && (h.indexOf('desc') >= 0 || h.indexOf('detail') >= 0)) colMap.desc = c;
    }
    if (colMap.ean !== -1 || colMap.name !== -1 || colMap.mrp !== -1) {
      colMap.headerRowIdx = r;
      break;
    }
  }

  // Fallback defaults if header detection missed a column
  if (colMap.row_idx_col !== -1 && colMap.row_idx_col === 0) {
    if (colMap.name === -1) colMap.name = 1;
    if (colMap.mrp === -1) colMap.mrp = 2;
    if (colMap.sp === -1) colMap.sp = 3;
    if (colMap.stock === -1) colMap.stock = 4;
    if (colMap.ean === -1) colMap.ean = 5;
    if (colMap.img === -1) colMap.img = 6;
    if (colMap.cat === -1) colMap.cat = 7;
  } else {
    if (colMap.name === -1) colMap.name = 0;
    if (colMap.mrp === -1) colMap.mrp = 1;
    if (colMap.sp === -1) colMap.sp = 2;
    if (colMap.stock === -1) colMap.stock = 3;
    if (colMap.ean === -1) colMap.ean = 4;
    if (colMap.img === -1) colMap.img = 5;
    if (colMap.cat === -1) colMap.cat = 6;
  }

  return colMap;
}

function normalizeNameForComparison(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Helper: Safe Multi-Criteria Row Matching
 */
function isRowMatch(rowData, colMap, targetEan, targetName, targetRowIndex, currentRowIndex) {
  // 1. Direct RowIndex Match: If targetRowIndex matches current row
  if (targetRowIndex && Number(targetRowIndex) === currentRowIndex) {
    return true;
  }

  // 2. Primary EAN / Barcode Token Match
  var targetTokens = parseSheetEans(targetEan);
  var rowEanRaw = colMap.ean >= 0 ? String(rowData[colMap.ean] || '') : '';
  var rowAddEanRaw = colMap.additional_eans >= 0 ? String(rowData[colMap.additional_eans] || '') : '';
  var rowTokens = parseSheetEans(rowEanRaw + ',' + rowAddEanRaw);

  if (targetTokens.length > 0 && rowTokens.length > 0) {
    for (var t = 0; t < targetTokens.length; t++) {
      for (var r = 0; r < rowTokens.length; r++) {
        if (isSingleEanTokenMatch(targetTokens[t], rowTokens[r])) {
          return true;
        }
      }
    }
  }

  // 3. Product Name Match (normalized fuzzy match)
  var rowName = colMap.name >= 0 && rowData[colMap.name] ? String(rowData[colMap.name]) : '';
  var normRowName = normalizeNameForComparison(rowName);
  var normTargetName = normalizeNameForComparison(targetName);

  if (normRowName && normTargetName) {
    if (normRowName === normTargetName) return true;
    if (normRowName.length >= 6 && normTargetName.length >= 6) {
      if (normRowName.indexOf(normTargetName) >= 0 || normTargetName.indexOf(normRowName) >= 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Helper: Safely write a product row even if the Google Sheet uses strict Table Typed Columns
 * (e.g., # MRP, # Selling Price, # Stock Qty, # EAN Barcode).
 */
function safeWriteProductRow(sheet, rowNumber, rowToWrite, colMap, primaryEan) {
  try {
    sheet.getRange(rowNumber, 1, 1, rowToWrite.length).setValues([rowToWrite]);
  } catch (rowErr) {
    for (var colIdx = 0; colIdx < rowToWrite.length; colIdx++) {
      try {
        sheet.getRange(rowNumber, colIdx + 1).setValue(rowToWrite[colIdx]);
      } catch (cellErr) {
        if (colIdx === colMap.ean && primaryEan) {
          try {
            var numEan = Number(String(primaryEan).replace(/\D/g, ''));
            sheet.getRange(rowNumber, colIdx + 1).setValue(!isNaN(numEan) && numEan > 0 ? numEan : String(primaryEan));
          } catch (e2) {}
        }
      }
    }
  }
}

/**
 * 8. Product Update & New Product Add
 * Supports Multiple EANs, Price, MRP, Stock, Max Order Qty, Name, Category, Description,
 * Primary Image, Backup Image, Multi-Gallery Images, and Video URL with zero column conflicts.
 */
function handleUpdateProduct(sheetId, payload) {
  var ss = getSpreadsheet(sheetId);
  var sheet = getProductsSheet(ss);
  if (!sheet) {
    setupDatabase(sheetId);
    sheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Products');
  }

  var rawPrimaryEan = String(payload.primary_ean || '').trim();
  var rawTargetEan = String(payload.ean || '').trim();
  var rawPrevEan = String(payload.previous_ean || '').trim();
  var rawAddEans = String(payload.additional_eans || '').trim();
  var incomingEans = parseSheetEans(rawPrimaryEan + ',' + rawTargetEan + ',' + rawAddEans);
  var searchEans = parseSheetEans(rawPrimaryEan + ',' + rawTargetEan + ',' + rawAddEans + ',' + rawPrevEan);
  var targetEan = incomingEans.join(', ') || rawTargetEan;
  var primarySingleEan = incomingEans[0] || rawPrimaryEan || rawTargetEan;
  var searchEanStr = searchEans.join(', ') || targetEan;
  var targetName = String(payload.product_name || payload.name || '').trim();
  var targetRow = Number(payload.rowIndex || payload.row || 0);

  var data = sheet.getDataRange().getValues();
  var colMap = getProductColumnMap(data);
  var headers = data[colMap.headerRowIdx] ? data[colMap.headerRowIdx].slice() : [];
  var headersChanged = false;

  var imgVal = String(payload.image_url || payload.img || payload.product_image || '').trim();
  var backupImgVal = String(payload.backup_image_url || payload.backup_img || '').trim();
  var videoVal = payload.video_url !== undefined ? String(payload.video_url || '').trim() : (payload.video !== undefined ? String(payload.video || '').trim() : undefined);
  var descVal = payload.description !== undefined ? String(payload.description || '').trim() : (payload.desc !== undefined ? String(payload.desc || '').trim() : undefined);
  var addImgsRaw = payload.additional_images !== undefined ? payload.additional_images : payload.gallery_images;
  var addImgsVal = undefined;
  if (addImgsRaw !== undefined) {
    addImgsVal = Array.isArray(addImgsRaw) ? addImgsRaw.join(', ').trim() : String(addImgsRaw || '').trim();
  }

  var newStockVal = payload.stock_qty !== undefined ? payload.stock_qty : payload.stock;
  var newSpVal = payload.selling_price !== undefined ? payload.selling_price : payload.price;
  var newMrpVal = payload.mrp;
  var newMaxQtyVal = payload.max_order_qty;

  // Dynamically add any missing extended columns at the end of the header row without shifting existing columns
  if (colMap.backup_img === -1 && backupImgVal) {
    colMap.backup_img = headers.length;
    headers.push('backup_image_url');
    headersChanged = true;
  }
  if (colMap.additional_imgs === -1 && addImgsVal) {
    colMap.additional_imgs = headers.length;
    headers.push('additional_images');
    headersChanged = true;
  }
  if (colMap.video === -1 && videoVal) {
    colMap.video = headers.length;
    headers.push('video_url');
    headersChanged = true;
  }
  if (colMap.desc === -1 && descVal) {
    colMap.desc = headers.length;
    headers.push('description');
    headersChanged = true;
  }
  if (colMap.additional_eans === -1 && incomingEans.length > 0) {
    colMap.additional_eans = headers.length;
    headers.push('additional_eans');
    headersChanged = true;
  }
  if (colMap.max_qty === -1 && newMaxQtyVal !== undefined) {
    colMap.max_qty = headers.length;
    headers.push('max_order_qty');
    headersChanged = true;
  }
  if (headersChanged) {
    try {
      sheet.getRange(colMap.headerRowIdx + 1, 1, 1, headers.length).setValues([headers]);
    } catch (hErr) {}
  }

  var matchedRowIndices = [];
  var allCollectedEans = targetEan;

  for (var i = colMap.headerRowIdx + 1; i < data.length; i++) {
    var currentRowIndex = i + 1;
    if (isRowMatch(data[i], colMap, searchEanStr, targetName, targetRow, currentRowIndex)) {
      matchedRowIndices.push(i);
      var existingRowEanStr = colMap.ean >= 0 ? String(data[i][colMap.ean] || '') : '';
      var existingRowAddEanStr = colMap.additional_eans >= 0 ? String(data[i][colMap.additional_eans] || '') : '';
      allCollectedEans = allCollectedEans + ',' + existingRowEanStr + ',' + existingRowAddEanStr;
    }
  }

  if (matchedRowIndices.length > 0) {
    // Keep the first matched row (or the explicit targetRow if it's in matchedRowIndices)
    var primaryDataIdx = matchedRowIndices[0];
    for (var m = 0; m < matchedRowIndices.length; m++) {
      if (targetRow && (matchedRowIndices[m] + 1) === targetRow) {
        primaryDataIdx = matchedRowIndices[m];
        break;
      }
    }
    var primaryRowNumber = primaryDataIdx + 1;

    // Put incomingEans first so if admin sets a new Primary EAN, it stays first
    var mergedRowEans = parseSheetEans(allCollectedEans);
    var mergedEanText = mergedRowEans.join(', ') || targetEan;
    var firstEanToken = mergedRowEans[0] || primarySingleEan;

    var maxColIdx = Math.max(
      headers.length - 1,
      colMap.name, colMap.mrp, colMap.sp, colMap.stock, colMap.ean, colMap.img, colMap.cat,
      colMap.backup_img, colMap.additional_imgs, colMap.video, colMap.desc, colMap.additional_eans, colMap.max_qty
    );
    var rowToWrite = data[primaryDataIdx].slice();
    while (rowToWrite.length <= maxColIdx) {
      rowToWrite.push('');
    }

    if (colMap.ean >= 0 && mergedEanText) rowToWrite[colMap.ean] = mergedEanText;
    if (colMap.additional_eans >= 0 && mergedEanText) rowToWrite[colMap.additional_eans] = mergedEanText;
    if (newStockVal !== undefined && newStockVal !== '' && colMap.stock >= 0) rowToWrite[colMap.stock] = Number(newStockVal);
    if (newSpVal !== undefined && newSpVal !== '' && colMap.sp >= 0) rowToWrite[colMap.sp] = Number(newSpVal);
    if (newMrpVal !== undefined && newMrpVal !== '' && colMap.mrp >= 0) rowToWrite[colMap.mrp] = Number(newMrpVal);
    if (newMaxQtyVal !== undefined && newMaxQtyVal !== '' && colMap.max_qty >= 0) rowToWrite[colMap.max_qty] = Number(newMaxQtyVal);
    if (targetName && colMap.name >= 0) rowToWrite[colMap.name] = targetName;
    if (payload.category && colMap.cat >= 0) rowToWrite[colMap.cat] = payload.category;
    if (descVal !== undefined && descVal !== '' && colMap.desc >= 0) rowToWrite[colMap.desc] = descVal;
    if (imgVal && colMap.img >= 0) rowToWrite[colMap.img] = imgVal;
    if (backupImgVal && colMap.backup_img >= 0) rowToWrite[colMap.backup_img] = backupImgVal;
    if (addImgsVal !== undefined && colMap.additional_imgs >= 0) rowToWrite[colMap.additional_imgs] = addImgsVal;
    if (videoVal !== undefined && colMap.video >= 0) rowToWrite[colMap.video] = videoVal;

    safeWriteProductRow(sheet, primaryRowNumber, rowToWrite, colMap, firstEanToken);

    // If duplicate rows existed for the same product/EANs, delete the extra rows from bottom to top
    if (matchedRowIndices.length > 1) {
      for (var d = matchedRowIndices.length - 1; d >= 0; d--) {
        if (matchedRowIndices[d] !== primaryDataIdx) {
          try {
            sheet.deleteRow(matchedRowIndices[d] + 1);
          } catch (delErr) {}
        }
      }
    }

    SpreadsheetApp.flush();
    try { handleSyncFacebookFeed(sheetId); } catch (fbErr) {}

    // Auto-edit existing WhatsApp post if product was previously shared and has a messageId
    try {
      var waSettingsRes = handleGetWaSettings(sheetId);
      var waSettings = waSettingsRes.settings || {};
      var existingWaMsg = getWaSentMessageFromSheet(sheetId, firstEanToken || targetEan || primarySingleEan);
      if (existingWaMsg && existingWaMsg.found && existingWaMsg.messageId) {
        var domain = (waSettings.STORE_DOMAIN || 'https://www.munagrocery.in').replace(/\/+$/, '');
        var finalSp = newSpVal !== undefined && newSpVal !== '' ? Number(newSpVal) : Number(rowToWrite[colMap.sp] || 0);
        var finalMrp = newMrpVal !== undefined && newMrpVal !== '' ? Number(newMrpVal) : Number(rowToWrite[colMap.mrp] || finalSp);
        var finalStock = newStockVal !== undefined && newStockVal !== '' ? Number(newStockVal) : Number(rowToWrite[colMap.stock] || 0);
        var vTag = finalSp + '_s' + finalStock + '_' + Math.random().toString(36).substring(2, 6);
        var rawImg = (colMap.backup_img >= 0 ? rowToWrite[colMap.backup_img] : '') || (colMap.img >= 0 ? rowToWrite[colMap.img] : '');
        var imgParam = (rawImg && (rawImg.indexOf('https://') === 0 || rawImg.indexOf('http://') === 0) && rawImg.indexOf('/products/') === -1)
          ? '&img=' + encodeURIComponent(rawImg)
          : '';
        var pureUpdatedLink = domain + '/?item=' + encodeURIComponent(firstEanToken || targetEan) + '&sp=' + finalSp + '&mrp=' + finalMrp + imgParam + '&v=' + vTag;

        editWhatsAppMessage(
          existingWaMsg.messageId,
          pureUpdatedLink,
          existingWaMsg.recipient || waSettings.DEFAULT_RECIPIENT,
          sheetId,
          firstEanToken || targetEan,
          finalSp,
          finalStock
        );
      }
    } catch (autoEditErr) {
      Logger.log('AutoEdit WA Error: ' + autoEditErr.toString());
    }

    return {
      status: 'success',
      ok: true,
      message: 'Product updated successfully',
      row: primaryRowNumber,
      ean: mergedEanText,
      stock_qty: newStockVal,
      selling_price: newSpVal,
      mrp: newMrpVal
    };
  }

  // Not found in existing rows -> Append New Product into exact mapped columns
  if (targetName && targetName !== 'New Product') {
    var maxNewCol = Math.max(
      headers.length - 1,
      colMap.name, colMap.mrp, colMap.sp, colMap.stock, colMap.ean, colMap.img, colMap.cat,
      colMap.backup_img, colMap.additional_imgs, colMap.video, colMap.desc, colMap.additional_eans, colMap.max_qty,
      6
    );
    var newRow = [];
    for (var k = 0; k <= maxNewCol; k++) newRow.push('');
    var nextRowIndex = data.length + 1;

    // Only write rowIndex if the sheet explicitly has a rowIndex column
    if (colMap.row_idx_col >= 0) {
      newRow[colMap.row_idx_col] = nextRowIndex;
    }
    if (colMap.name >= 0) newRow[colMap.name] = targetName;
    if (colMap.mrp >= 0) newRow[colMap.mrp] = newMrpVal !== undefined && newMrpVal !== '' ? Number(newMrpVal) : (newSpVal !== undefined && newSpVal !== '' ? Number(newSpVal) : 0);
    if (colMap.sp >= 0) newRow[colMap.sp] = newSpVal !== undefined && newSpVal !== '' ? Number(newSpVal) : 0;
    if (colMap.stock >= 0) newRow[colMap.stock] = newStockVal !== undefined && newStockVal !== '' ? Number(newStockVal) : 15;
    if (colMap.ean >= 0) newRow[colMap.ean] = targetEan;
    if (colMap.img >= 0) newRow[colMap.img] = imgVal;
    if (colMap.cat >= 0) newRow[colMap.cat] = payload.category || 'General';
    if (colMap.desc >= 0) newRow[colMap.desc] = descVal || targetName;
    if (colMap.backup_img >= 0) newRow[colMap.backup_img] = backupImgVal;
    if (colMap.additional_imgs >= 0) newRow[colMap.additional_imgs] = addImgsVal || '';
    if (colMap.video >= 0) newRow[colMap.video] = videoVal || '';
    if (colMap.additional_eans >= 0) newRow[colMap.additional_eans] = targetEan;
    if (colMap.max_qty >= 0) newRow[colMap.max_qty] = newMaxQtyVal !== undefined && newMaxQtyVal !== '' ? Number(newMaxQtyVal) : 10;

    try {
      sheet.appendRow(newRow);
    } catch (appendErr) {
      if (colMap.ean >= 0 && primarySingleEan) {
        var numPrimary = Number(String(primarySingleEan).replace(/\D/g, ''));
        newRow[colMap.ean] = !isNaN(numPrimary) && numPrimary > 0 ? numPrimary : primarySingleEan;
      }
      sheet.appendRow(newRow);
    }
    var appendedRowIdx = sheet.getLastRow();
    if (colMap.ean >= 0) {
      try {
        sheet.getRange(appendedRowIdx, colMap.ean + 1).setValue(targetEan);
      } catch (eCellErr) {
        try {
          var numClean = Number(String(primarySingleEan).replace(/\D/g, ''));
          sheet.getRange(appendedRowIdx, colMap.ean + 1).setValue(!isNaN(numClean) && numClean > 0 ? numClean : primarySingleEan);
        } catch (e2) {}
      }
    }
    if (colMap.additional_eans >= 0) {
      try {
        sheet.getRange(appendedRowIdx, colMap.additional_eans + 1).setValue(targetEan);
      } catch (addCellErr) {}
    }
    SpreadsheetApp.flush();
    try { handleSyncFacebookFeed(sheetId); } catch (fbErr) {}
    return { status: 'success', ok: true, message: 'Product added successfully', row: appendedRowIdx, ean: targetEan };
  }

  return { status: 'not_found', ok: false, message: 'Product not found for update: ' + targetEan };
}

/**
 * 8c. Fast Stock-Only Update
 */
function handleUpdateProductStock(sheetId, payload) {
  var ss = getSpreadsheet(sheetId);
  var sheet = getProductsSheet(ss);
  if (!sheet) return { status: 'error', message: 'Products sheet not found' };

  var targetEan = String(payload.ean || '').trim();
  var targetName = String(payload.product_name || payload.name || '').trim();
  var targetRow = Number(payload.rowIndex || payload.row || 0);
  var newStock = payload.stock_qty !== undefined ? payload.stock_qty : (payload.stock !== undefined ? payload.stock : 0);

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: 'error', message: 'Sheet is empty' };

  var colMap = getProductColumnMap(data);
  var stockCol = colMap.stock >= 0 ? colMap.stock : 3;

  for (var i = colMap.headerRowIdx + 1; i < data.length; i++) {
    var currentRowIndex = i + 1;
    if (isRowMatch(data[i], colMap, targetEan, targetName, targetRow, currentRowIndex)) {
      sheet.getRange(currentRowIndex, stockCol + 1).setValue(Number(newStock));
      SpreadsheetApp.flush();
      try { handleSyncFacebookFeed(sheetId); } catch (fbErr) {}
      return {
        status: 'success',
        ok: true,
        message: 'Product stock updated in Google Sheet',
        row: currentRowIndex,
        ean: targetEan,
        stock_qty: Number(newStock)
      };
    }
  }

  return { status: 'not_found', ok: false, message: 'Product not found for stock update: ' + targetEan };
}

/**
 * 8d. Delete Product from Google Sheet (Deletes all matching rows bottom-up to prevent ghost duplicates)
 */
function handleDeleteProduct(sheetId, payload) {
  var ss = getSpreadsheet(sheetId);
  var sheet = getProductsSheet(ss);
  if (!sheet) return { status: 'error', message: 'Products sheet not found' };

  var rawEan = String(payload.ean || '').trim();
  var rawAddEans = String(payload.additional_eans || '').trim();
  var targetEan = parseSheetEans(rawEan + ',' + rawAddEans).join(', ') || rawEan;
  var targetName = String(payload.product_name || payload.name || '').trim();
  var targetRow = Number(payload.rowIndex || payload.row || 0);

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: 'error', message: 'Sheet is empty' };

  var colMap = getProductColumnMap(data);
  var deletedRows = [];

  // Search from bottom up to avoid row index shifts when deleting
  for (var i = data.length - 1; i > colMap.headerRowIdx; i--) {
    var currentRowIndex = i + 1;
    if (isRowMatch(data[i], colMap, targetEan, targetName, targetRow, currentRowIndex)) {
      sheet.deleteRow(currentRowIndex);
      deletedRows.push(currentRowIndex);
    }
  }

  if (deletedRows.length > 0) {
    SpreadsheetApp.flush();
    try { handleSyncFacebookFeed(sheetId); } catch (fbErr) {}
    return {
      status: 'success',
      ok: true,
      message: 'Product deleted from Google Sheet',
      deletedRow: deletedRows[0],
      deletedCount: deletedRows.length,
      ean: targetEan
    };
  }

  return { status: 'not_found', ok: false, message: 'Product not found to delete: ' + targetEan };
}

/**
 * 8b. Batch Update Products (1-Click Save All to Sheet with Price, Stock, MRP, Max Qty, Name, Multiple EANs, Photos & Descriptions)
 */
function handleBatchUpdateProducts(sheetId, payload) {
  var ss = getSpreadsheet(sheetId);
  var sheet = getProductsSheet(ss);
  if (!sheet) {
    setupDatabase(sheetId);
    sheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Products');
  }

  var prods = payload.products;
  if (!prods || !Array.isArray(prods) || prods.length === 0) {
    return { status: 'error', message: 'No products array provided' };
  }

  var data = sheet.getDataRange().getValues();
  var colMap = getProductColumnMap(data);
  var headers = data[colMap.headerRowIdx] ? data[colMap.headerRowIdx].slice() : [];
  var headersChanged = false;

  if (colMap.backup_img === -1) {
    colMap.backup_img = headers.length;
    headers.push('backup_image_url');
    headersChanged = true;
  }

  var hasAnyAdditional = prods.some(function(p) { return p.additional_images || p.gallery_images; });
  if (colMap.additional_imgs === -1 && hasAnyAdditional) {
    colMap.additional_imgs = headers.length;
    headers.push('additional_images');
    headersChanged = true;
  }

  var hasAnyVideo = prods.some(function(p) { return p.video_url || p.video; });
  if (colMap.video === -1 && hasAnyVideo) {
    colMap.video = headers.length;
    headers.push('video_url');
    headersChanged = true;
  }

  var hasAnyDesc = prods.some(function(p) { return p.description || p.desc; });
  if (colMap.desc === -1 && hasAnyDesc) {
    colMap.desc = headers.length;
    headers.push('description');
    headersChanged = true;
  }

  var hasAnyMultiEan = prods.some(function(p) {
    return parseSheetEans((p.ean || '') + ',' + (p.additional_eans || '')).length > 0;
  });
  if (colMap.additional_eans === -1 && hasAnyMultiEan) {
    colMap.additional_eans = headers.length;
    headers.push('additional_eans');
    headersChanged = true;
  }

  var hasAnyMaxQty = prods.some(function(p) { return p.max_order_qty !== undefined; });
  if (colMap.max_qty === -1 && hasAnyMaxQty) {
    colMap.max_qty = headers.length;
    headers.push('max_order_qty');
    headersChanged = true;
  }

  if (headersChanged) {
    try {
      sheet.getRange(colMap.headerRowIdx + 1, 1, 1, headers.length).setValues([headers]);
    } catch (hErr) {}
  }

  // Create lookup maps across all multiple EAN tokens, Product Names, and Row Indices of every product
  var prodMap = {};
  var prodNameMap = {};
  var prodRowMap = {};
  var matchedKeys = {};

  for (var p = 0; p < prods.length; p++) {
    var pItem = prods[p];
    var pTokens = parseSheetEans((pItem.primary_ean || '') + ',' + (pItem.ean || '') + ',' + (pItem.additional_eans || ''));
    for (var t = 0; t < pTokens.length; t++) {
      prodMap[pTokens[t]] = pItem;
    }
    var pNameKey = (pItem.product_name || pItem.name || '').toLowerCase().trim();
    if (pNameKey) {
      prodNameMap[pNameKey] = pItem;
    }
    if (pItem.rowIndex && Number(pItem.rowIndex) > 0) {
      prodRowMap[Number(pItem.rowIndex)] = pItem;
    }
  }

  var maxColIdx = Math.max(
    headers.length - 1,
    colMap.name, colMap.mrp, colMap.sp, colMap.stock, colMap.ean, colMap.img, colMap.cat,
    colMap.backup_img, colMap.additional_imgs, colMap.video, colMap.desc, colMap.additional_eans, colMap.max_qty,
    6
  );

  var updatedCount = 0;
  for (var i = colMap.headerRowIdx + 1; i < data.length; i++) {
    var rowEanVal = colMap.ean >= 0 ? String(data[i][colMap.ean] || '') : '';
    var rowAddEanVal = colMap.additional_eans >= 0 ? String(data[i][colMap.additional_eans] || '') : '';
    var rowTokens = parseSheetEans(rowEanVal + ',' + rowAddEanVal);
    var rowNameKey = colMap.name >= 0 ? String(data[i][colMap.name] || '').toLowerCase().trim() : '';
    var currentRowNumber = i + 1;

    var match = null;
    for (var rt = 0; rt < rowTokens.length; rt++) {
      if (prodMap[rowTokens[rt]]) {
        match = prodMap[rowTokens[rt]];
        break;
      }
    }
    if (!match && rowNameKey && prodNameMap[rowNameKey]) {
      match = prodNameMap[rowNameKey];
    }
    if (!match && prodRowMap[currentRowNumber]) {
      match = prodRowMap[currentRowNumber];
    }

    if (match) {
      var matchAllTokens = parseSheetEans((match.primary_ean || '') + ',' + (match.ean || '') + ',' + (match.additional_eans || ''));
      for (var mk = 0; mk < matchAllTokens.length; mk++) {
        matchedKeys[matchAllTokens[mk]] = true;
      }

      var mergedEans = parseSheetEans((match.primary_ean || '') + ',' + (match.ean || '') + ',' + (match.additional_eans || '') + ',' + rowTokens.join(','));
      var mergedEanStr = mergedEans.join(', ');
      var firstEanToken = mergedEans[0] || match.primary_ean || match.ean || '';

      var rowToWrite = data[i].slice();
      while (rowToWrite.length <= maxColIdx) {
        rowToWrite.push('');
      }

      if (mergedEanStr && colMap.ean >= 0) rowToWrite[colMap.ean] = mergedEanStr;
      if (mergedEanStr && colMap.additional_eans >= 0) rowToWrite[colMap.additional_eans] = mergedEanStr;
      if ((match.product_name || match.name) && colMap.name >= 0) rowToWrite[colMap.name] = match.product_name || match.name;
      if (match.mrp !== undefined && match.mrp !== '' && colMap.mrp >= 0) rowToWrite[colMap.mrp] = Number(match.mrp);
      if (match.selling_price !== undefined && match.selling_price !== '' && colMap.sp >= 0) rowToWrite[colMap.sp] = Number(match.selling_price);
      if (match.stock_qty !== undefined && match.stock_qty !== '' && colMap.stock >= 0) rowToWrite[colMap.stock] = Number(match.stock_qty);
      if (match.max_order_qty !== undefined && match.max_order_qty !== '' && colMap.max_qty >= 0) rowToWrite[colMap.max_qty] = Number(match.max_order_qty);
      if (match.image_url && colMap.img >= 0) rowToWrite[colMap.img] = match.image_url;
      if (match.backup_image_url !== undefined && colMap.backup_img >= 0) rowToWrite[colMap.backup_img] = match.backup_image_url;
      if (match.category && colMap.cat >= 0) rowToWrite[colMap.cat] = match.category;

      var bDesc = match.description || match.desc || '';
      if (bDesc && colMap.desc >= 0) rowToWrite[colMap.desc] = bDesc;

      var bAddImg = match.additional_images || match.gallery_images || '';
      if (Array.isArray(bAddImg)) bAddImg = bAddImg.join(', ');
      if (bAddImg && colMap.additional_imgs >= 0) rowToWrite[colMap.additional_imgs] = bAddImg;

      var bVideo = match.video_url || match.video || '';
      if (bVideo && colMap.video >= 0) rowToWrite[colMap.video] = bVideo;

      safeWriteProductRow(sheet, i + 1, rowToWrite, colMap, firstEanToken);
      updatedCount++;
    }
  }

  // Append any newly added products not yet in the Sheet into exact mapped column positions
  var appendedCount = 0;
  for (var np = 0; np < prods.length; np++) {
    var item = prods[np];
    var itemTokens = parseSheetEans((item.primary_ean || '') + ',' + (item.ean || '') + ',' + (item.additional_eans || ''));
    var alreadyInSheet = itemTokens.some(function(tk) { return !!matchedKeys[tk]; });
    if (!alreadyInSheet && (item.product_name || item.name)) {
      var itemEanStr = itemTokens.join(', ') || String(item.ean || '');
      var itemPrimaryEan = itemTokens[0] || String(item.primary_ean || item.ean || '');
      var newRow = [];
      for (var cIdx = 0; cIdx <= maxColIdx; cIdx++) newRow.push('');
      if (colMap.row_idx_col >= 0) {
        newRow[colMap.row_idx_col] = data.length + appendedCount + 1;
      }
      if (colMap.name >= 0) newRow[colMap.name] = item.product_name || item.name;
      if (colMap.mrp >= 0) newRow[colMap.mrp] = item.mrp !== undefined && item.mrp !== '' ? Number(item.mrp) : 0;
      if (colMap.sp >= 0) newRow[colMap.sp] = item.selling_price !== undefined && item.selling_price !== '' ? Number(item.selling_price) : 0;
      if (colMap.stock >= 0) newRow[colMap.stock] = item.stock_qty !== undefined && item.stock_qty !== '' ? Number(item.stock_qty) : 15;
      if (colMap.ean >= 0) newRow[colMap.ean] = itemEanStr;
      if (colMap.img >= 0) newRow[colMap.img] = item.image_url || '';
      if (colMap.cat >= 0) newRow[colMap.cat] = item.category || 'General';
      if (colMap.desc >= 0) newRow[colMap.desc] = item.description || item.desc || (item.product_name || item.name);
      if (colMap.backup_img >= 0) newRow[colMap.backup_img] = item.backup_image_url || '';
      var nAddImg = item.additional_images || item.gallery_images || '';
      if (Array.isArray(nAddImg)) nAddImg = nAddImg.join(', ');
      if (colMap.additional_imgs >= 0) newRow[colMap.additional_imgs] = nAddImg;
      if (colMap.video >= 0) newRow[colMap.video] = item.video_url || item.video || '';
      if (colMap.additional_eans >= 0) newRow[colMap.additional_eans] = itemEanStr;
      if (colMap.max_qty >= 0) newRow[colMap.max_qty] = item.max_order_qty !== undefined && item.max_order_qty !== '' ? Number(item.max_order_qty) : 10;

      try {
        sheet.appendRow(newRow);
      } catch (appendErr) {
        if (colMap.ean >= 0 && itemPrimaryEan) {
          var numItemEan = Number(String(itemPrimaryEan).replace(/\D/g, ''));
          newRow[colMap.ean] = !isNaN(numItemEan) && numItemEan > 0 ? numItemEan : itemPrimaryEan;
        }
        sheet.appendRow(newRow);
      }
      var lastRow = sheet.getLastRow();
      if (colMap.ean >= 0) {
        try {
          sheet.getRange(lastRow, colMap.ean + 1).setValue(itemEanStr);
        } catch (eCellErr) {
          try {
            var numFallback = Number(String(itemPrimaryEan).replace(/\D/g, ''));
            sheet.getRange(lastRow, colMap.ean + 1).setValue(!isNaN(numFallback) && numFallback > 0 ? numFallback : itemPrimaryEan);
          } catch (e2) {}
        }
      }
      if (colMap.additional_eans >= 0) {
        try {
          sheet.getRange(lastRow, colMap.additional_eans + 1).setValue(itemEanStr);
        } catch (addCellErr) {}
      }
      for (var tkIdx = 0; tkIdx < itemTokens.length; tkIdx++) {
        matchedKeys[itemTokens[tkIdx]] = true;
      }
      appendedCount++;
    }
  }

  SpreadsheetApp.flush();
  try { handleSyncFacebookFeed(sheetId); } catch (fbErr) {}
  return {
    status: 'success',
    ok: true,
    count: updatedCount + appendedCount,
    updated: updatedCount,
    appended: appendedCount,
    message: 'Batch updated ' + updatedCount + ' and added ' + appendedCount + ' products'
  };
}

/**
 * 9. Save Address
 * Sheet: Addresses
 * Columns: Telegram User ID, Name, Address, Phone, Location, Updated At
 */
function handleSaveAddress(sheetId, payload) {
  var ss = getSpreadsheet(sheetId);
  var sheet = ss.getSheetByName('Addresses');
  if (!sheet) {
    setupDatabase(sheetId);
    sheet = ss.getSheetByName('Addresses');
  }

  var cleanPhone = String(payload.phone || '').replace(/\D/g, '').slice(-10);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var p = String(data[i][3]).replace(/\D/g, '').slice(-10);
    if (p === cleanPhone) {
      sheet.getRange(i + 1, 2).setValue(payload.name || '');
      sheet.getRange(i + 1, 3).setValue(payload.address || '');
      sheet.getRange(i + 1, 5).setValue(payload.location || '');
      sheet.getRange(i + 1, 6).setValue(new Date().toISOString());
      return { status: 'success', message: 'Address updated' };
    }
  }

  sheet.appendRow([
    payload.user_id || payload.telegram_user_id || '',
    payload.name || '',
    payload.address || '',
    cleanPhone,
    payload.location || '',
    new Date().toISOString()
  ]);

  return { status: 'success', message: 'Address added' };
}

/**
 * 10. Sync Cart to Users Sheet
 */
function handleSyncCart(sheetId, payload) {
  var ss = getSpreadsheet(sheetId);
  var sheet = ss.getSheetByName('Users');
  if (!sheet) return { status: 'ok' };

  var cleanPhone = String(payload.phone || '').replace(/\D/g, '').slice(-10);
  var cartJson = typeof payload.cart_json === 'string' ? payload.cart_json : JSON.stringify(payload.cart_json || {});

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var p = String(data[i][2]).replace(/\D/g, '').slice(-10);
    if (p === cleanPhone) {
      sheet.getRange(i + 1, 8).setValue(cartJson);
      return { status: 'success', message: 'Cart synced' };
    }
  }

  return { status: 'ok' };
}

/**
 * 11. Admin Authentication Check
 */
function handleAdminAuth(sheetId, payload) {
  var cleanUser = String(payload.username || '').replace(/\D/g, '').slice(-10);
  var pass = String(payload.password || '').trim();

  if (!cleanUser || !pass) {
    return { ok: false, status: 'invalid_credentials' };
  }

  // Check Sheet Config for admin credentials
  var ss = getSpreadsheet(sheetId);
  var sheet = ss.getSheetByName('Config') || ss.getSheetByName('Settings');
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    var adminUser = '';
    var adminPass = '';
    for (var i = 1; i < data.length; i++) {
      var k = String(data[i][0]).toLowerCase().trim();
      if (k === 'admin_username' || k === 'admin_user') adminUser = String(data[i][1]).replace(/\D/g, '').slice(-10);
      if (k === 'admin_password' || k === 'admin_pass') adminPass = String(data[i][1]).trim();
    }
    if (adminUser && cleanUser === adminUser && pass === adminPass) {
      return { ok: true, status: 'success' };
    }
  }

  return { ok: false, status: 'invalid_credentials' };
}

/**
 * Helper: Increment User Total Orders
 */
function incrementUserOrderCount(ss, phone) {
  var sheet = ss.getSheetByName('Users');
  if (!sheet) return;
  var cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var p = String(data[i][2]).replace(/\D/g, '').slice(-10);
    if (p === cleanPhone) {
      var current = Number(data[i][5]) || 0;
      sheet.getRange(i + 1, 6).setValue(current + 1);
      break;
    }
  }
}

/**
 * 12. Auto Database Setup & Sheet Creation
 */
function setupDatabase(sheetId) {
  var ss = getSpreadsheet(sheetId);

  // 1. Config Sheet (Dedicated Key-Value Tab for All Admin Setup)
  var configSheet = ss.getSheetByName('Config') || ss.insertSheet('Config');
  if (configSheet.getLastRow() === 0) {
    configSheet.appendRow(['Key', 'Value']);
    var defaults = [
      ['store_open', 1],
      ['store_open_message', 'Store is open for deliveries and orders.'],
      ['store_closed_message', 'ଦୋକାନ ବର୍ତ୍ତମାନ ବନ୍ଦ ଅଛି। ସକାଳ ୧୦ ଟାରେ ଖୋଲିବ।'],
      ['store_open_time', '10:00 AM'],
      ['store_close_time', '09:00 PM'],
      ['delivery_fee', 30],
      ['free_delivery_above', 500],
      ['delivery_slot', '30 - 60 mins'],
      ['delivery_day', 'Today'],
      ['cod_active', 1],
      ['cod_notice', 'Cash on Delivery Available (କ୍ୟାସ୍ ଅନ୍ ଡେଲିଭରୀ ଉପଲବ୍ଧ)'],
      ['pickup_active', 1],
      ['pickup_note', 'Free Store Pickup (ଦୋକାନରୁ ମାଗଣା ପିକଅପ୍)'],
      ['pickup_slots', '30 mins, 1 hour, 2 hours'],
      ['pickup_charge_on', 0],
      ['pickup_charge_fee', 0],
      ['coupon_code', 'MUNNA10'],
      ['coupon_percent', 10],
      ['coupon_min_bill', 300],
      ['trending', '7533476, 7533478, 7552164, 7541105'],
      ['app_download_url', '/munagrocery.apk'],
      ['store_name', 'Munna Mobile & Grocery'],
      ['store_pickup_name', 'Munna Grocery & Mobile'],
      ['store_pickup_address', 'Cinema Hall Road, Niali'],
      ['store_pickup_phone', '9040585726'],
      ['store_pickup_hours', '10:00 AM - 09:00 PM (Daily)'],
      ['whatsapp_share_format', '*[Product Name with Weight]*\n*Rs [Offer Price]* ~MRP [MRP]~\n[Store Name]\n[Address]\n[Product Link]'],
      ['whatsapp_link_caption_format', '[Product Name with Weight]\nRs [Offer Price] ~MRP [MRP]~\n[Store Name], [Address]'],
      ['admin_username', '9040585726'],
      ['admin_password', 'munna@123'],
      ['imgbb_api_key', '7608fb749170c4dd32e74a62823d776b']
    ];
    defaults.forEach(function(row) {
      configSheet.appendRow(row);
    });
  }

  // 2. Users Sheet
  var usersSheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
  if (usersSheet.getLastRow() === 0) {
    usersSheet.appendRow([
      'User ID', 'Name', 'Phone', 'PasswordHash',
      'Default Address', 'Total Orders', 'Created At', 'CartJSON'
    ]);
  }

  // 3. Orders Sheet
  var ordersSheet = ss.getSheetByName('Orders') || ss.insertSheet('Orders');
  if (ordersSheet.getLastRow() === 0) {
    ordersSheet.appendRow([
      'id', 'user_id', 'name', 'phone', 'address',
      'items', 'total', 'stage', 'status', 'payment',
      'created_at', 'delivery_type', 'pickup_slot', 'location'
    ]);
  }

  // 4. Products Sheet (Unified 13-column layout matching Sheet1)
  var productsSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Products') || ss.insertSheet('Products');
  if (productsSheet.getLastRow() === 0) {
    productsSheet.appendRow([
      'product_name', 'mrp', 'selling_price', 'stock_qty', 'ean',
      'image_url', 'category', 'backup_image_url', 'additional_images',
      'video_url', 'description', 'additional_eans', 'max_order_qty'
    ]);
  }

  // 5. Addresses Sheet
  var addressesSheet = ss.getSheetByName('Addresses') || ss.insertSheet('Addresses');
  if (addressesSheet.getLastRow() === 0) {
    addressesSheet.appendRow([
      'Telegram User ID', 'Name', 'Address', 'Phone', 'Location', 'Updated At'
    ]);
  }

  // 6. WA_Config Sheet (Dedicated WhatsApp Baileys Gateway & Auto-Loop Configuration)
  var waConfigSheet = ss.getSheetByName('WA_Config') || ss.insertSheet('WA_Config');
  if (waConfigSheet.getLastRow() === 0) {
    waConfigSheet.appendRow(['Key', 'Value', 'Description']);
    var waDefaults = [
      ['RENDER_BASE_URL', 'https://super-light-web-whatsapp-api-server-rubo.onrender.com', 'Base URL of your WhatsApp Baileys server on Render'],
      ['SESSION_ID', 'Mmmmm', 'Active WhatsApp Baileys Session ID'],
      ['API_BEARER_TOKEN', '3ea2caba-5b8c-491c-98c2-9a0d6e999856', 'Authorization Bearer Token'],
      ['DEFAULT_RECIPIENT', '120363414065601906@newsletter', 'Target WhatsApp Channel JID (@newsletter), Group ID (@g.us), or Phone Number'],
      ['DEFAULT_LOOP_DELAY_SEC', 6, 'Seconds to wait between posts for WhatsApp link preview loading'],
      ['STORE_DOMAIN', 'https://www.munagrocery.in', 'Store domain for generating pure product links'],
      ['SEND_ONLY_IN_STOCK', 'true', 'Skip out-of-stock items (true/false)'],
      ['AUTO_REFRESH_LINKS', 'true', 'Auto-generate fresh cache-buster version for each link (true/false)']
    ];
    waDefaults.forEach(function(row) {
      waConfigSheet.appendRow(row);
    });
    waConfigSheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#E6F4EA');
    waConfigSheet.setFrozenRows(1);
  }

  return {
    status: 'success',
    message: 'All Google Sheets tables (including WA_Config) verified and initialized successfully!',
    sheet_id: ss.getId(),
    sheet_name: ss.getName()
  };
}

/**
 * 13. Get Products List from Sheet (Uses unified getProductColumnMap so read & write positions match 100%)
 */
function handleGetProducts(sheetId, requestedWorksheet) {
  var ss = getSpreadsheet(sheetId);
  var targetName = requestedWorksheet || '';
  var sheet = null;
  
  if (targetName) {
    sheet = ss.getSheetByName(targetName);
  }
  
  if (!sheet) {
    sheet = getProductsSheet(ss);
  }
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var colMap = getProductColumnMap(data);
  var headerRowIdx = colMap.headerRowIdx;

  var products = [];
  for (var i = headerRowIdx + 1; i < data.length; i++) {
    var row = data[i];
    var pName = colMap.name >= 0 ? String(row[colMap.name] || '').trim() : '';
    if (!pName || pName.toLowerCase() === 'product name' || pName.toLowerCase() === 'product_name') continue;

    var eanVal = colMap.ean >= 0 && row[colMap.ean] !== undefined ? String(row[colMap.ean]).trim() : '';
    var addEanVal = colMap.additional_eans >= 0 && row[colMap.additional_eans] !== undefined ? String(row[colMap.additional_eans]).trim() : '';
    var parsedEans = parseSheetEans(eanVal + ',' + addEanVal);
    if (parsedEans.length === 0) parsedEans = ['P-' + (i + 1)];
    var fullEansStr = parsedEans.join(', ');

    var rawAddImgs = colMap.additional_imgs >= 0 && row[colMap.additional_imgs] ? String(row[colMap.additional_imgs]).trim() : '';
    var galleryImgs = rawAddImgs ? rawAddImgs.split(',').map(function(u) { return u.trim(); }).filter(Boolean) : [];
    var maxOrderVal = colMap.max_qty >= 0 && row[colMap.max_qty] !== undefined && row[colMap.max_qty] !== '' ? Number(row[colMap.max_qty]) : 10;

    var rawPrimaryImg = colMap.img >= 0 ? String(row[colMap.img] || '').trim() : '';
    var rawBackupImg = colMap.backup_img >= 0 && row[colMap.backup_img] ? String(row[colMap.backup_img] || '').trim() : '';
    var resolvedPrimaryImg = rawPrimaryImg;
    if ((!resolvedPrimaryImg || resolvedPrimaryImg.indexOf('/products/') === 0) && (rawBackupImg.indexOf('https://') === 0 || rawBackupImg.indexOf('http://') === 0)) {
      resolvedPrimaryImg = rawBackupImg;
    } else if ((!resolvedPrimaryImg || resolvedPrimaryImg.indexOf('/products/') === 0) && galleryImgs.length > 0 && (galleryImgs[0].indexOf('https://') === 0 || galleryImgs[0].indexOf('http://') === 0)) {
      resolvedPrimaryImg = galleryImgs[0];
    }

    products.push({
      rowIndex: i + 1,
      ean: fullEansStr,
      primary_ean: parsedEans[0],
      additional_eans: fullEansStr,
      ean_list: parsedEans,
      product_name: pName,
      mrp: colMap.mrp >= 0 ? row[colMap.mrp] : '',
      selling_price: colMap.sp >= 0 ? row[colMap.sp] : '',
      stock_qty: colMap.stock >= 0 && row[colMap.stock] !== undefined && row[colMap.stock] !== '' ? row[colMap.stock] : 10,
      max_order_qty: !isNaN(maxOrderVal) && maxOrderVal > 0 ? maxOrderVal : 10,
      image_url: resolvedPrimaryImg,
      backup_image_url: rawBackupImg || (resolvedPrimaryImg.indexOf('http') === 0 ? resolvedPrimaryImg : ''),
      additional_images: rawAddImgs,
      gallery_images: galleryImgs,
      video_url: colMap.video >= 0 && row[colMap.video] ? String(row[colMap.video] || '').trim() : '',
      category: colMap.cat >= 0 && row[colMap.cat] ? String(row[colMap.cat]).replace(/&amp;/g, '&').trim() : 'General',
      description: colMap.desc >= 0 && row[colMap.desc] ? String(row[colMap.desc]).trim() : pName
    });
  }

  return products;
}

/**
 * 14. Get Orders List from Sheet
 */
function handleGetOrders(sheetId, filterPhone) {
  var ss = getSpreadsheet(sheetId);
  var sheet = ss.getSheetByName('Orders');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var orders = [];
  var cleanFilter = filterPhone ? String(filterPhone).replace(/\D/g, '').slice(-10) : '';

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    var orderPhone = String(row[3] || '').replace(/\D/g, '').slice(-10);
    if (cleanFilter && orderPhone !== cleanFilter) continue;

    var items = [];
    try {
      items = JSON.parse(row[5] || '[]');
    } catch (e) {}

    orders.push({
      id: String(row[0]),
      user_id: String(row[1] || ''),
      customerName: String(row[2] || ''),
      phone: String(row[3] || ''),
      address: String(row[4] || ''),
      items: items,
      total: Number(row[6]) || 0,
      stage: Number(row[7]) || 1,
      status: String(row[8] || 'pending'),
      payment: String(row[9] || 'COD'),
      timestamp: String(row[10] || ''),
      deliveryType: String(row[11] || '').toLowerCase().includes('pickup') ? 'pickup' : 'delivery',
      pickupSlot: String(row[12] || ''),
      location: String(row[13] || '')
    });
  }
  return orders;
}

/**
 * 15. Proxy JioMart Search via Webhook (Real Pincode-Wise Availability Engine)
 * Runs inside your existing Google Sheet Apps Script — NO extra Cloudflare Worker or Page required!
 */
function handleJioMartProxy(query, pincode, strict) {
  try {
    var cleanQ = String(query || '').trim();
    if (!cleanQ) {
      return { success: false, items: [], results: [], error: 'No search query provided' };
    }

    var reqPin = String(pincode || '752106').replace(/\D/g, '').slice(0, 6);
    var strictMode = String(strict) === '1' || String(strict) === 'true';
    var defaultFallbacks = ['753003', '753001', '751010'];
    var pincodesToTry = [];

    if (reqPin.length === 6) {
      if (strictMode) {
        pincodesToTry = [reqPin];
      } else {
        pincodesToTry = [reqPin];
        for (var f = 0; f < defaultFallbacks.length; f++) {
          if (defaultFallbacks[f] !== reqPin) pincodesToTry.push(defaultFallbacks[f]);
        }
      }
    } else {
      pincodesToTry = defaultFallbacks;
    }

    var matchedItems = [];
    var activePincode = reqPin || '';

    for (var i = 0; i < pincodesToTry.length; i++) {
      var pin = pincodesToTry[i];
      var jioUrl = 'https://www.jiomart.com/api/service/application/catalog/v1.0/products?q=' + encodeURIComponent(cleanQ) + '&page_size=10&page_no=1';
      var locDetail = JSON.stringify({
        country: 'INDIA',
        country_iso_code: 'IN',
        pincode: String(pin)
      });

      try {
        var response = UrlFetchApp.fetch(jioUrl, {
          method: 'get',
          muteHttpExceptions: true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://www.jiomart.com',
            'Referer': 'https://www.jiomart.com/',
            'pincode': String(pin),
            'x-pincode': String(pin),
            'x-location-detail': locDetail,
            'visitor-id': Utilities.getUuid()
          }
        });

        if (response.getResponseCode() === 200) {
          var data = JSON.parse(response.getContentText());
          var rawItems = (data && data.data && data.data.items) ? data.data.items : (data && data.items ? data.items : []);
          if (rawItems && rawItems.length > 0) {
            activePincode = pin;
            matchedItems = rawItems.slice(0, 10).map(function(item) {
              var priceObj = item.price || {};
              var sp = (typeof priceObj.effective === 'object' && priceObj.effective !== null) ? (priceObj.effective.min || 0) : (priceObj.effective || 0);
              var mrp = (typeof priceObj.marked === 'object' && priceObj.marked !== null) ? (priceObj.marked.min || 0) : (priceObj.marked || 0);
              var medias = item.medias || [];
              var images = [];
              for (var m = 0; m < medias.length; m++) {
                if (medias[m] && medias[m].url && String(medias[m].url).indexOf('http') === 0) {
                  images.push(medias[m].url);
                }
              }
              var eanCode = item.ean || item.barcode || (item.identifiers && item.identifiers[0] && item.identifiers[0].value) || item.sku_code || item.uid || item.id || '';
              return {
                id: item.uid || item.id || item.sku_code || '',
                ean: String(eanCode),
                name: item.name || 'Product',
                price: Number(sp),
                mrp: Number(mrp),
                image: images[0] || '',
                images: images,
                category: item.category_slug || (item.categories && item.categories[0] && item.categories[0].name) || '',
                description: item.short_description || item.description || item.summary || '',
                sellable: Boolean(item.sellable),
                available: Boolean(item.sellable),
                pincode: String(pin),
                requestedPincode: reqPin || String(pin)
              };
            });
            break;
          }
        }
      } catch (innerErr) {}
    }

    return {
      success: true,
      source: 'google_apps_script_direct',
      query: cleanQ,
      requestedPincode: reqPin,
      pincode: activePincode,
      strictMode: strictMode,
      count: matchedItems.length,
      items: matchedItems,
      results: matchedItems
    };
  } catch (err) {
    return { success: false, items: [], results: [], error: err.toString() };
  }
}

/**
 * 16. Aggregate All Users from Users, Orders, and Addresses sheets
 */
function handleGetUsers(sheetId) {
  var ss = getSpreadsheet(sheetId);
  var userSheet = ss.getSheetByName('Users');
  var orderSheet = ss.getSheetByName('Orders');
  var addrSheet = ss.getSheetByName('Addresses');
  
  var usersMap = {};
  
  // 1. From Users sheet
  if (userSheet) {
    var uData = userSheet.getDataRange().getValues();
    for (var i = 1; i < uData.length; i++) {
      var phone = String(uData[i][2] || '').replace(/\D/g, '').slice(-10);
      if (phone) {
        usersMap[phone] = {
          user_id: String(uData[i][0] || ('U-' + phone)),
          name: String(uData[i][1] || 'Customer'),
          phone: phone,
          address: String(uData[i][4] || ''),
          orders: Number(uData[i][5]) || 0,
          spent: 0,
          last: String(uData[i][6] || '')
        };
      }
    }
  }
  
  // 2. From Orders sheet
  if (orderSheet) {
    var oData = orderSheet.getDataRange().getValues();
    for (var j = 1; j < oData.length; j++) {
      var oPhone = String(oData[j][3] || '').replace(/\D/g, '').slice(-10);
      var oName = String(oData[j][2] || '');
      var oAddr = String(oData[j][4] || '');
      var oTotal = Number(oData[j][6]) || 0;
      var oDate = String(oData[j][10] || '');
      if (oPhone) {
        if (!usersMap[oPhone]) {
          usersMap[oPhone] = {
            user_id: String(oData[j][1] || ('U-' + oPhone)),
            name: oName || 'Customer',
            phone: oPhone,
            address: oAddr || '',
            orders: 0,
            spent: 0,
            last: oDate
          };
        }
        usersMap[oPhone].orders += 1;
        usersMap[oPhone].spent += oTotal;
        if (!usersMap[oPhone].address && oAddr) usersMap[oPhone].address = oAddr;
        if (!usersMap[oPhone].name || usersMap[oPhone].name === 'Customer') usersMap[oPhone].name = oName;
        if (oDate) usersMap[oPhone].last = oDate;
      }
    }
  }

  // 3. From Addresses sheet
  if (addrSheet) {
    var aData = addrSheet.getDataRange().getValues();
    for (var k = 1; k < aData.length; k++) {
      var aPhone = String(aData[k][3] || '').replace(/\D/g, '').slice(-10);
      var aName = String(aData[k][1] || '');
      var aAddr = String(aData[k][2] || '');
      var aTg = String(aData[k][0] || '');
      if (aPhone && usersMap[aPhone]) {
        if (!usersMap[aPhone].address) usersMap[aPhone].address = aAddr;
        if (!usersMap[aPhone].name || usersMap[aPhone].name === 'Customer') usersMap[aPhone].name = aName;
        if (aTg) usersMap[aPhone].tg_id = aTg;
      }
    }
  }

  var usersList = Object.keys(usersMap).map(function(k) { return usersMap[k]; });
  return { status: 'success', users: usersList, total: usersList.length };
}

/**
 * 17. Track Visitor / Page View
 */
function handleTrackViewer(sheetId, payload) {
  var ss = getSpreadsheet(sheetId);
  var sheet = ss.getSheetByName('Viewers');
  if (!sheet) {
    sheet = ss.insertSheet('Viewers');
    sheet.appendRow(['Session ID', 'Product', 'Timestamp', 'Date', 'User Agent']);
  }
  sheet.appendRow([
    payload.sessionId || payload.session_id || '',
    payload.product || payload.page || 'Home',
    payload.ts || new Date().toISOString(),
    payload.today || new Date().toISOString().slice(0, 10),
    payload.ua || ''
  ]);
  return { status: 'success', ok: true };
}

/**
 * ============================================================================
 * 18. FACEBOOK / META COMMERCE MANAGER CATALOG FEED ENGINE
 * ============================================================================
 * Dynamically reads Sheet1 via getProductColumnMap (without modifying Sheet1),
 * populates/updates the 'Facebook_Feed' worksheet, and serves live CSV on ?feed=facebook.
 */
function buildFacebookFeedRows(sheetId) {
  var ss = getSpreadsheet(sheetId);
  var sheet = getProductsSheet(ss);
  var headers = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand'];
  var rows = [headers];

  if (!sheet) return { ss: ss, rows: rows };

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ss: ss, rows: rows };

  var colMap = getProductColumnMap(data);
  var seenIds = {};

  for (var i = colMap.headerRowIdx + 1; i < data.length; i++) {
    var row = data[i];
    var pName = colMap.name >= 0 ? String(row[colMap.name] || '').trim() : '';
    if (!pName || pName.toLowerCase() === 'product name' || pName.toLowerCase() === 'product_name' || pName.toLowerCase() === 'new product') {
      continue;
    }

    var eanVal = colMap.ean >= 0 && row[colMap.ean] !== undefined ? String(row[colMap.ean]).trim() : '';
    var addEanVal = colMap.additional_eans >= 0 && row[colMap.additional_eans] !== undefined ? String(row[colMap.additional_eans]).trim() : '';
    var parsedEans = parseSheetEans(eanVal + ',' + addEanVal);
    var primaryId = parsedEans.length > 0 ? String(parsedEans[0]).trim() : ('MUNNA-' + (i + 1));
    if (!primaryId) primaryId = 'MUNNA-' + (i + 1);

    // Ensure unique ID in Meta Catalog Feed
    if (seenIds[primaryId]) {
      primaryId = primaryId + '-' + (i + 1);
    }
    seenIds[primaryId] = true;

    // Description: Existing description or rich Niali store fallback
    var rawDesc = colMap.desc >= 0 && row[colMap.desc] !== undefined ? String(row[colMap.desc] || '').trim() : '';
    var finalDesc = (rawDesc && rawDesc.toLowerCase() !== pName.toLowerCase())
      ? rawDesc
      : (pName + ' - Available at Munna Grocery, Cinema Hall Road, Niali');

    // Availability: Stock quantity > 0 ? "in stock" : "out of stock"
    var rawStock = colMap.stock >= 0 && row[colMap.stock] !== undefined && row[colMap.stock] !== '' ? row[colMap.stock] : 10;
    var stockNum = parseFloat(String(rawStock).replace(/[^\d.-]/g, ''));
    if (isNaN(stockNum)) stockNum = 0;
    var availability = stockNum > 0 ? 'in stock' : 'out of stock';

    // Condition: Always "new"
    var condition = 'new';

    // Price: Selling price formatted with currency code "X.XX INR"
    var rawSp = colMap.sp >= 0 && row[colMap.sp] !== undefined ? row[colMap.sp] : (colMap.mrp >= 0 ? row[colMap.mrp] : 0);
    var spNum = parseFloat(String(rawSp).replace(/[^\d.]/g, ''));
    if (isNaN(spNum) || spNum < 0) spNum = 0;
    var priceFormatted = spNum.toFixed(2) + ' INR';

    // Canonical store link
    var canonicalLink = 'https://munagrocery.in';

    // Image Link: Prioritize live HTTPS image link (JioMart CDN / backup_image_url over local paths)
    var rawPrimaryImg = colMap.img >= 0 && row[colMap.img] !== undefined ? String(row[colMap.img] || '').trim() : '';
    var rawBackupImg = colMap.backup_img >= 0 && row[colMap.backup_img] !== undefined ? String(row[colMap.backup_img] || '').trim() : '';
    var rawAddImgs = colMap.additional_imgs >= 0 && row[colMap.additional_imgs] !== undefined ? String(row[colMap.additional_imgs] || '').trim() : '';
    var firstGalleryHttps = '';
    if (rawAddImgs) {
      var gParts = rawAddImgs.split(',');
      for (var g = 0; g < gParts.length; g++) {
        var candidate = String(gParts[g] || '').trim();
        if (candidate.indexOf('https://') === 0 || candidate.indexOf('http://') === 0) {
          firstGalleryHttps = candidate;
          break;
        }
      }
    }

    var finalImageLink = '';
    if (rawBackupImg.indexOf('https://') === 0 || rawBackupImg.indexOf('http://') === 0) {
      finalImageLink = rawBackupImg;
    } else if (rawPrimaryImg.indexOf('https://') === 0 || rawPrimaryImg.indexOf('http://') === 0) {
      finalImageLink = rawPrimaryImg;
    } else if (firstGalleryHttps) {
      finalImageLink = firstGalleryHttps;
    } else if (rawPrimaryImg.indexOf('/') === 0) {
      finalImageLink = 'https://munagrocery.in' + rawPrimaryImg;
    } else {
      finalImageLink = 'https://munagrocery.in/icon-512.png';
    }

    // Brand: Category / brand name or "Munna Grocery"
    var rawBrand = colMap.cat >= 0 && row[colMap.cat] !== undefined ? String(row[colMap.cat] || '').replace(/&amp;/g, '&').trim() : '';
    var finalBrand = (rawBrand && rawBrand.toLowerCase() !== 'general') ? rawBrand : 'Munna Grocery';

    rows.push([
      primaryId,
      pName,
      finalDesc,
      availability,
      condition,
      priceFormatted,
      canonicalLink,
      finalImageLink,
      finalBrand
    ]);
  }

  return { ss: ss, rows: rows };
}

function handleSyncFacebookFeed(sheetId) {
  var built = buildFacebookFeedRows(sheetId);
  var ss = built.ss;
  var feedRows = built.rows;

  var fbSheet = ss.getSheetByName('Facebook_Feed');
  if (!fbSheet) {
    fbSheet = ss.insertSheet('Facebook_Feed');
  }

  // Clear old feed rows and write fresh formatted rows atomically
  fbSheet.clearContents();
  if (feedRows.length > 0) {
    fbSheet.getRange(1, 1, feedRows.length, 9).setValues(feedRows);
  }
  SpreadsheetApp.flush();

  var totalItems = Math.max(0, feedRows.length - 1);
  return {
    status: 'success',
    ok: true,
    count: totalItems,
    tab: 'Facebook_Feed',
    message: 'Facebook Catalog Feed Updated! Total items: ' + totalItems
  };
}

function handleGetFacebookFeedCsv(sheetId) {
  var built = buildFacebookFeedRows(sheetId);
  var ss = built.ss;
  var feedRows = built.rows;

  // Keep 'Facebook_Feed' sheet synchronized whenever Meta fetches the live CSV
  try {
    var fbSheet = ss.getSheetByName('Facebook_Feed') || ss.insertSheet('Facebook_Feed');
    fbSheet.clearContents();
    if (feedRows.length > 0) {
      fbSheet.getRange(1, 1, feedRows.length, 9).setValues(feedRows);
    }
    SpreadsheetApp.flush();
  } catch (syncErr) {}

  var csvLines = [];
  for (var r = 0; r < feedRows.length; r++) {
    var row = feedRows[r];
    var cells = [];
    for (var c = 0; c < row.length; c++) {
      var val = row[c] === undefined || row[c] === null ? '' : String(row[c]);
      // Clean line breaks inside fields and escape double quotes per RFC 4180
      val = val.replace(/\r?\n/g, ' ').trim();
      if (val.indexOf('"') >= 0 || val.indexOf(',') >= 0) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      cells.push(val);
    }
    csvLines.push(cells.join(','));
  }

  return csvLines.join('\r\n');
}

/**
 * ============================================================================
 * 19. FAST SINGLE-CALL WHATSAPP SHORT-LINK PREVIEW & 1-CLICK ALL-LINKS RESET
 * ============================================================================
 */

function extractCleanBaseEanScript(str) {
  if (!str) return '';
  var s = String(str).trim();
  try { s = decodeURIComponent(s); } catch(e) {}
  s = s.replace(/^EAN-/i, '').trim();
  var idx = s.indexOf('_');
  if (idx > 0) {
    s = s.substring(0, idx);
  }
  return s.trim().toLowerCase();
}

/**
 * Returns both the matched product and the Config tab's WhatsApp Link Caption Format
 * in a single fast JSON response (<500ms) for Cloudflare Edge Middleware.
 */
function handleGetProductPreview(sheetId, targetItemKey) {
  var cfgBundle = handleGetConfig(sheetId);
  var config = (cfgBundle && cfgBundle.config) ? cfgBundle.config : {};
  var cleanTarget = extractCleanBaseEanScript(targetItemKey);

  var matchedProduct = null;
  if (cleanTarget) {
    var allProds = handleGetProducts(sheetId, 'Sheet1');
    for (var i = 0; i < allProds.length; i++) {
      var p = allProds[i];
      var eanTokens = p.ean_list || [];
      var found = false;
      for (var t = 0; t < eanTokens.length; t++) {
        var cleanTok = extractCleanBaseEanScript(eanTokens[t]);
        if (cleanTok === cleanTarget) {
          found = true;
          break;
        }
      }
      if (!found && (String(p.rowIndex) === cleanTarget || ('row-' + p.rowIndex) === cleanTarget)) {
        found = true;
      }
      if (!found && cleanTarget.length >= 6) {
        var bkp = String(p.backup_image_url || '').toLowerCase();
        var pri = String(p.image_url || '').toLowerCase();
        if (bkp.indexOf(cleanTarget) >= 0 || pri.indexOf(cleanTarget) >= 0) {
          found = true;
        }
      }
      if (found) {
        matchedProduct = {
          rowIndex: p.rowIndex,
          ean: p.primary_ean || p.ean,
          product_name: p.product_name,
          selling_price: p.selling_price,
          mrp: p.mrp,
          stock_qty: p.stock_qty,
          image_url: p.backup_image_url && p.backup_image_url.indexOf('http') === 0 ? p.backup_image_url : p.image_url,
          backup_image_url: p.backup_image_url,
          category: p.category
        };
        break;
      }
    }
  }

  return {
    status: 'success',
    ok: true,
    product: matchedProduct,
    config: {
      whatsapp_link_caption_format: config.whatsapp_link_caption_format || '[Product Name with Weight]\nRs [Offer Price] ~MRP [MRP]~ ([Discount %]% OFF) [Stock Status]\n[Store Name], [Address] odisha call-9040585726',
      store_name: config.store_name || 'Munna Mobile & Grocery',
      store_pickup_address: config.store_pickup_address || 'Cinema Hall Road, Niali',
      share_link_version: config.share_link_version || 'v1'
    }
  };
}

/**
 * 1-Click Reset All Products Links (Frontend & Backend):
 * 1. Scans Sheet1 and heals any row where image_url is a broken local /products/... path
 *    by copying its live HTTPS backup_image_url into image_url (without altering columns).
 * 2. Generates a fresh share_link_version token and writes it to the Config tab so all
 *    short links across Frontend & Backend get a new cache-busting token for WhatsApp.
 * 3. Re-synchronizes Facebook_Feed tab.
 */
function handleResetAllProductLinks(sheetId) {
  var ss = getSpreadsheet(sheetId);
  var sheet = getProductsSheet(ss);
  var healedImagesCount = 0;
  var totalProductsCount = 0;

  if (sheet && sheet.getLastRow() > 1) {
    var data = sheet.getDataRange().getValues();
    var colMap = getProductColumnMap(data);

    for (var i = colMap.headerRowIdx + 1; i < data.length; i++) {
      var row = data[i];
      var pName = colMap.name >= 0 ? String(row[colMap.name] || '').trim() : '';
      if (!pName || pName.toLowerCase() === 'product name' || pName.toLowerCase() === 'product_name') continue;
      totalProductsCount++;

      var rawImg = colMap.img >= 0 ? String(row[colMap.img] || '').trim() : '';
      var rawBkp = colMap.backup_img >= 0 ? String(row[colMap.backup_img] || '').trim() : '';
      var rawAddImgs = colMap.additional_imgs >= 0 ? String(row[colMap.additional_imgs] || '').trim() : '';

      var bestHttps = '';
      if (rawBkp.indexOf('https://') === 0 || rawBkp.indexOf('http://') === 0) {
        bestHttps = rawBkp;
      } else if (rawImg.indexOf('https://') === 0 || rawImg.indexOf('http://') === 0) {
        bestHttps = rawImg;
      } else if (rawAddImgs) {
        var parts = rawAddImgs.split(',');
        for (var g = 0; g < parts.length; g++) {
          var cand = String(parts[g] || '').trim();
          if (cand.indexOf('https://') === 0 || cand.indexOf('http://') === 0) {
            bestHttps = cand;
            break;
          }
        }
      }

      if (bestHttps) {
        if (colMap.img >= 0 && (!rawImg || rawImg.indexOf('/products/') === 0)) {
          try {
            sheet.getRange(i + 1, colMap.img + 1).setValue(bestHttps);
            healedImagesCount++;
          } catch (e1) {}
        }
        if (colMap.backup_img >= 0 && (!rawBkp || rawBkp.indexOf('/products/') === 0)) {
          try {
            sheet.getRange(i + 1, colMap.backup_img + 1).setValue(bestHttps);
          } catch (e2) {}
        }
      }
    }
  }

  var newVersion = 'rst_' + new Date().getTime().toString(36).slice(-5);
  var nowIso = new Date().toISOString();
  handleSaveConfig(sheetId, {
    share_link_version: newVersion,
    last_link_reset_at: nowIso
  });

  try {
    handleSyncFacebookFeed(sheetId);
  } catch (fbErr) {}

  SpreadsheetApp.flush();

  return {
    status: 'success',
    ok: true,
    totalProducts: totalProductsCount,
    healedImages: healedImagesCount,
    share_link_version: newVersion,
    last_link_reset_at: nowIso,
    message: 'All ' + totalProductsCount + ' product links reset & ' + healedImagesCount + ' image links healed!'
  };
}

// ============================================================================
// PART 4: WHATSAPP BAILEYS GATEWAY SERVER INTEGRATION & AUTO-LOOP ENGINE
// ============================================================================

var WA_CONFIG_SHEET_NAME = 'WA_Config';

/**
 * Access or dynamically initialize the "WA_Config" sheet tab with default values
 */
function getWaConfigSheet(ss) {
  var sheet = ss.getSheetByName(WA_CONFIG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(WA_CONFIG_SHEET_NAME);
    sheet.appendRow(['Key', 'Value', 'Description']);
    var defaults = [
      ['RENDER_BASE_URL', 'https://super-light-web-whatsapp-api-server-rubo.onrender.com', 'Base URL of your WhatsApp Baileys server on Render'],
      ['SESSION_ID', 'Mmmmm', 'Active WhatsApp Baileys Session ID'],
      ['API_BEARER_TOKEN', '3ea2caba-5b8c-491c-98c2-9a0d6e999856', 'Authorization Bearer Token'],
      ['DEFAULT_RECIPIENT', '120363414065601906@newsletter', 'Target WhatsApp Channel JID (@newsletter), Group ID (@g.us), or Phone Number'],
      ['DEFAULT_LOOP_DELAY_SEC', 6, 'Seconds to wait between posts for WhatsApp link preview loading'],
      ['STORE_DOMAIN', 'https://www.munagrocery.in', 'Store domain for generating pure product links'],
      ['SEND_ONLY_IN_STOCK', 'true', 'Skip out-of-stock items (true/false)'],
      ['AUTO_REFRESH_LINKS', 'true', 'Auto-generate fresh cache-buster version for each link (true/false)']
    ];
    defaults.forEach(function(row) {
      sheet.appendRow(row);
    });
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#E6F4EA');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Read all configuration key-values dynamically from "WA_Config" sheet tab
 */
function handleGetWaSettings(sheetId) {
  var ss = getSpreadsheet(sheetId);
  var sheet = getWaConfigSheet(ss);
  var data = sheet.getDataRange().getValues();

  var settings = {
    RENDER_BASE_URL: 'https://super-light-web-whatsapp-api-server-rubo.onrender.com',
    SESSION_ID: 'Mmmmm',
    API_BEARER_TOKEN: '3ea2caba-5b8c-491c-98c2-9a0d6e999856',
    DEFAULT_RECIPIENT: '120363414065601906@newsletter',
    DEFAULT_LOOP_DELAY_SEC: 6,
    STORE_DOMAIN: 'https://www.munagrocery.in',
    SEND_ONLY_IN_STOCK: true,
    AUTO_REFRESH_LINKS: true,
    AUTO_SEND_NEW_PRODUCTS: false,
    AUTO_SEND_RESTOCKED_PRODUCTS: false,
    AUTO_SEND_PRICE_CHANGED_PRODUCTS: false,
    GROUP_BY_CATEGORY: true
  };

  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][0] || '').trim();
    var v = data[i][1];
    if (k) {
      settings[k] = v;
    }
  }

  // Normalize numbers and booleans
  settings.DEFAULT_LOOP_DELAY_SEC = Number(settings.DEFAULT_LOOP_DELAY_SEC) || 6;
  settings.SEND_ONLY_IN_STOCK = String(settings.SEND_ONLY_IN_STOCK).toLowerCase() !== 'false';
  settings.AUTO_REFRESH_LINKS = String(settings.AUTO_REFRESH_LINKS).toLowerCase() !== 'false';
  settings.AUTO_SEND_NEW_PRODUCTS = String(settings.AUTO_SEND_NEW_PRODUCTS).toLowerCase() === 'true';
  settings.AUTO_SEND_RESTOCKED_PRODUCTS = String(settings.AUTO_SEND_RESTOCKED_PRODUCTS).toLowerCase() === 'true';
  settings.AUTO_SEND_PRICE_CHANGED_PRODUCTS = String(settings.AUTO_SEND_PRICE_CHANGED_PRODUCTS).toLowerCase() === 'true';
  settings.GROUP_BY_CATEGORY = String(settings.GROUP_BY_CATEGORY).toLowerCase() !== 'false';

  return {
    status: 'success',
    ok: true,
    settings: settings
  };
}

/**
 * Update configuration values in "WA_Config" sheet tab
 */
function handleUpdateWaSettings(sheetId, newSettings) {
  var ss = getSpreadsheet(sheetId);
  var sheet = getWaConfigSheet(ss);
  var data = sheet.getDataRange().getValues();

  var keyRowMap = {};
  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][0] || '').trim();
    if (k) {
      keyRowMap[k] = i + 1;
    }
  }

  for (var key in newSettings) {
    if (newSettings.hasOwnProperty(key)) {
      var val = newSettings[key];
      if (val === undefined || val === null) val = '';
      if (typeof val === 'object') val = JSON.stringify(val);

      if (keyRowMap[key]) {
        sheet.getRange(keyRowMap[key], 2).setValue(val);
      } else {
        sheet.appendRow([key, val, '']);
        keyRowMap[key] = sheet.getLastRow();
      }
    }
  }

  SpreadsheetApp.flush();
  return {
    status: 'success',
    ok: true,
    message: 'WA_Config settings updated successfully in Google Sheet'
  };
}

/**
 * Recipient Resolution: Channels (@newsletter), Groups (@g.us), or Phone numbers
 */
function resolveRecipient(recipientInput) {
  var raw = String(recipientInput || '').trim();
  if (!raw) {
    return { type: 'group', to: '' };
  }

  // 1. WhatsApp Channel (Newsletter)
  if (raw.indexOf('whatsapp.com/channel/') !== -1) {
    var match = raw.match(/channel\/([A-Za-z0-9_-]+)/);
    var code = match ? match[1] : raw;
    return {
      type: 'group',
      to: code.indexOf('@newsletter') !== -1 ? code : code + '@newsletter',
      original: raw
    };
  }

  if (raw.indexOf('@newsletter') !== -1) {
    return {
      type: 'group',
      to: raw,
      original: raw
    };
  }

  // 2. WhatsApp Group (@g.us)
  if (raw.indexOf('@g.us') !== -1) {
    return {
      type: 'group',
      to: raw,
      original: raw
    };
  }

  // 3. Mobile Number (Individual)
  var digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    digits = '91' + digits; // Default Indian prefix
  }

  return {
    type: 'individual',
    to: digits,
    original: raw
  };
}

/**
 * Post pure product link to WhatsApp Baileys Gateway Server on Render
 */
/**
 * Post pure product link to WhatsApp Baileys Gateway Server on Render
 * Automatically writes returned messageId into Google Sheet "WA_Sent_Log" tab
 */
function postWhatsAppMessage(productLink, overrideRecipient, customSheetId, optProductKey, optPrice, optStock) {
  try {
    var sheetId = customSheetId || DEFAULT_SHEET_ID;
    var settingsRes = handleGetWaSettings(sheetId);
    var settings = settingsRes.settings;

    var targetRecipient = (overrideRecipient && String(overrideRecipient).trim()) || settings.DEFAULT_RECIPIENT;
    var recipientInfo = resolveRecipient(targetRecipient);

    if (!recipientInfo.to) {
      return {
        status: 'error',
        ok: false,
        message: 'Invalid or missing recipient. Please check DEFAULT_RECIPIENT in WA_Config tab.'
      };
    }

    var baseUrl = String(settings.RENDER_BASE_URL || '').replace(/\/+$/, '');
    var sessionId = String(settings.SESSION_ID || '').trim();
    var token = String(settings.API_BEARER_TOKEN || '').trim();

    if (!baseUrl || !sessionId) {
      return {
        status: 'error',
        ok: false,
        message: 'Missing RENDER_BASE_URL or SESSION_ID in WA_Config tab.'
      };
    }

    var apiUrl = baseUrl + '/api/v1/messages?sessionId=' + encodeURIComponent(sessionId);

    // Payload sending ONLY pure product link for rich card preview
    var payload = {
      recipient_type: recipientInfo.type,
      to: recipientInfo.to,
      type: 'text',
      text: {
        body: String(productLink || '').trim()
      }
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(apiUrl, options);
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();

    // Smart Case Fallback: If "Mmm" was entered instead of "mmm", retry with lowercase session ID
    if (statusCode === 403 && sessionId !== sessionId.toLowerCase()) {
      var lowerSession = sessionId.toLowerCase();
      var retryUrl = baseUrl + '/api/v1/messages?sessionId=' + encodeURIComponent(lowerSession);
      var retryRes = UrlFetchApp.fetch(retryUrl, options);
      if (retryRes.getResponseCode() >= 200 && retryRes.getResponseCode() < 300) {
        try {
          handleUpdateWaSettings(sheetId, { SESSION_ID: lowerSession });
        } catch (fixErr) {}
        response = retryRes;
        statusCode = retryRes.getResponseCode();
        responseText = retryRes.getContentText();
      }
    }

    var responseData = null;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { raw: responseText };
    }

    var isSuccess = (statusCode >= 200 && statusCode < 300);
    var errDetail = responseData && responseData.message ? responseData.message : (responseText || ('HTTP ' + statusCode));

    // Extract returned messageId from Baileys response
    var messageId = '';
    if (responseData) {
      if (Array.isArray(responseData) && responseData.length > 0 && responseData[0].messageId) {
        messageId = String(responseData[0].messageId);
      } else if (responseData.messageId) {
        messageId = String(responseData.messageId);
      } else if (responseData.response && responseData.response.messageId) {
        messageId = String(responseData.response.messageId);
      }
    }

    // Determine product key (EAN or item ID)
    var targetKey = (optProductKey && String(optProductKey).trim()) || '';
    if (!targetKey && productLink) {
      var itemMatch = String(productLink).match(/[?&]item=([^&#]+)/i);
      if (itemMatch && itemMatch[1]) {
        try { targetKey = decodeURIComponent(itemMatch[1]); } catch (e) { targetKey = itemMatch[1]; }
      }
    }

    // Automatically write to Google Sheet "WA_Sent_Log" tab
    if (isSuccess && messageId && targetKey) {
      try {
        recordWaSentMessageInSheet(sheetId, targetKey, messageId, recipientInfo.to, productLink, 'SENT', optPrice, optStock);
      } catch (sheetErr) {
        Logger.log('Warning: could not write to WA_Sent_Log sheet: ' + sheetErr.toString());
      }
    }

    return {
      status: isSuccess ? 'success' : 'error',
      ok: isSuccess,
      statusCode: statusCode,
      messageId: messageId,
      productKey: targetKey,
      recipient: recipientInfo,
      productLink: productLink,
      response: responseData,
      message: isSuccess ? 'Success' : ('Render API Error (HTTP ' + statusCode + '): ' + errDetail),
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    var errStr = err.toString();
    var isPermissionErr = errStr.indexOf('UrlFetchApp') !== -1 || errStr.indexOf('external_request') !== -1 || errStr.indexOf('permission') !== -1;
    return {
      status: 'error',
      ok: false,
      needs_authorization: isPermissionErr,
      message: isPermissionErr
        ? 'Apps Script Authorization Required: Open script.google.com, select "authorizeScript" from dropdown, click Run (▷), grant permission, then Deploy > Manage Deployments > Edit > New Version > Deploy.'
        : errStr,
      raw_error: errStr,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Edit an existing sent WhatsApp text message link
 * Updates existing message in-place and syncs with Google Sheet "WA_Sent_Log" tab
 */
function editWhatsAppMessage(messageId, productLink, overrideRecipient, customSheetId, optProductKey, optPrice, optStock) {
  try {
    if (!messageId) {
      return {
        status: 'error',
        ok: false,
        message: 'Missing messageId for edit'
      };
    }
    var sheetId = customSheetId || DEFAULT_SHEET_ID;
    var settingsRes = handleGetWaSettings(sheetId);
    var settings = settingsRes.settings;

    var targetRecipient = (overrideRecipient && String(overrideRecipient).trim()) || settings.DEFAULT_RECIPIENT;
    var recipientInfo = resolveRecipient(targetRecipient);

    var baseUrl = String(settings.RENDER_BASE_URL || '').replace(/\/+$/, '');
    var sessionId = String(settings.SESSION_ID || '').trim();
    var token = String(settings.API_BEARER_TOKEN || '').trim();

    if (!baseUrl || !sessionId) {
      return {
        status: 'error',
        ok: false,
        message: 'Missing RENDER_BASE_URL or SESSION_ID in WA_Config tab.'
      };
    }

    var apiUrl = baseUrl + '/api/v1/message';

    var payload = {
      sessionId: sessionId,
      messageId: messageId,
      remoteJid: recipientInfo.to,
      text: String(productLink || '').trim()
    };

    var options = {
      method: 'put',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(apiUrl, options);
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();

    var responseData = null;
    try { responseData = JSON.parse(responseText); } catch (e) { responseData = { raw: responseText }; }

    var isSuccess = (statusCode >= 200 && statusCode < 300);

    // Determine product key
    var targetKey = (optProductKey && String(optProductKey).trim()) || '';
    if (!targetKey && productLink) {
      var itemMatch = String(productLink).match(/[?&]item=([^&#]+)/i);
      if (itemMatch && itemMatch[1]) {
        try { targetKey = decodeURIComponent(itemMatch[1]); } catch (e) { targetKey = itemMatch[1]; }
      }
    }

    // Automatically sync updated link to Google Sheet "WA_Sent_Log" tab
    if (isSuccess && targetKey) {
      try {
        recordWaSentMessageInSheet(sheetId, targetKey, messageId, recipientInfo.to, productLink, 'EDITED', optPrice, optStock);
      } catch (sheetErr) {
        Logger.log('Warning: could not update WA_Sent_Log sheet: ' + sheetErr.toString());
      }
    }

    return {
      status: isSuccess ? 'success' : 'error',
      ok: isSuccess,
      statusCode: statusCode,
      messageId: messageId,
      productKey: targetKey,
      recipient: recipientInfo,
      productLink: productLink,
      response: responseData,
      message: isSuccess ? 'Edit Success' : ('Render Edit Error (HTTP ' + statusCode + '): ' + (responseData ? responseData.message : responseText)),
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    var errStr = err.toString();
    var isPermissionErr = errStr.indexOf('UrlFetchApp') !== -1 || errStr.indexOf('external_request') !== -1 || errStr.indexOf('permission') !== -1;
    return {
      status: 'error',
      ok: false,
      needs_authorization: isPermissionErr,
      message: errStr,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Access or create the "WA_Sent_Log" sheet tab for persistent message tracking
 */
function getWaSentLogSheet(ss) {
  var sheet = ss.getSheetByName('WA_Sent_Log');
  if (!sheet) {
    sheet = ss.insertSheet('WA_Sent_Log');
    sheet.appendRow([
      'Product_Key',
      'Message_ID',
      'Recipient',
      'Product_Link',
      'Selling_Price',
      'Stock_Qty',
      'Status',
      'Last_Updated'
    ]);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#D1E7DD');
    sheet.setFrozenRows(1);
    try {
      sheet.setColumnWidth(1, 150);
      sheet.setColumnWidth(2, 230);
      sheet.setColumnWidth(3, 200);
      sheet.setColumnWidth(4, 280);
      sheet.setColumnWidth(5, 90);
      sheet.setColumnWidth(6, 90);
      sheet.setColumnWidth(7, 100);
      sheet.setColumnWidth(8, 170);
    } catch (cwErr) {}
  }
  return sheet;
}

/**
 * Record or update a sent/edited WhatsApp message in Google Sheet "WA_Sent_Log" tab
 */
function recordWaSentMessageInSheet(sheetId, productKey, messageId, recipient, productLink, status, price, stock) {
  try {
    var ss = getSpreadsheet(sheetId);
    var sheet = getWaSentLogSheet(ss);
    var data = sheet.getDataRange().getValues();

    var cleanKey = String(productKey || '').trim();
    if (!cleanKey || !messageId) {
      return { status: 'error', ok: false, message: 'Missing productKey or messageId' };
    }

    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      var rowKey = String(data[i][0] || '').trim();
      if (rowKey && (rowKey.toLowerCase() === cleanKey.toLowerCase() || rowKey.indexOf(cleanKey) !== -1 || cleanKey.indexOf(rowKey) !== -1)) {
        rowIndex = i + 1;
        break;
      }
    }

    var now = new Date().toISOString();
    var stat = status || 'SENT';

    if (rowIndex > 1) {
      sheet.getRange(rowIndex, 2).setValue(String(messageId));
      if (recipient) sheet.getRange(rowIndex, 3).setValue(String(recipient));
      if (productLink) sheet.getRange(rowIndex, 4).setValue(String(productLink));
      if (price !== undefined && price !== '') sheet.getRange(rowIndex, 5).setValue(Number(price));
      if (stock !== undefined && stock !== '') sheet.getRange(rowIndex, 6).setValue(Number(stock));
      sheet.getRange(rowIndex, 7).setValue(stat);
      sheet.getRange(rowIndex, 8).setValue(now);
    } else {
      sheet.appendRow([
        cleanKey,
        String(messageId),
        String(recipient || ''),
        String(productLink || ''),
        price !== undefined && price !== '' ? Number(price) : '',
        stock !== undefined && stock !== '' ? Number(stock) : '',
        stat,
        now
      ]);
    }

    // Also update wa_message_id column in Products/Sheet1 if present
    try {
      var pSheet = getProductsSheet(ss);
      if (pSheet) {
        var pData = pSheet.getDataRange().getValues();
        var pColMap = getProductColumnMap(pData);
        var pHeaders = pData[pColMap.headerRowIdx];
        var msgIdCol = -1;
        for (var c = 0; c < pHeaders.length; c++) {
          var hName = String(pHeaders[c] || '').toLowerCase().trim();
          if (hName === 'wa_message_id' || hName === 'message_id' || hName === 'wa_msg_id') {
            msgIdCol = c;
            break;
          }
        }
        if (msgIdCol === -1) {
          msgIdCol = pHeaders.length;
          pSheet.getRange(pColMap.headerRowIdx + 1, msgIdCol + 1).setValue('wa_message_id');
        }
        for (var r = pColMap.headerRowIdx + 1; r < pData.length; r++) {
          var rowEan = pColMap.ean >= 0 ? String(pData[r][pColMap.ean] || '') : '';
          var rowName = pColMap.name >= 0 ? String(pData[r][pColMap.name] || '') : '';
          if (rowEan.indexOf(cleanKey) !== -1 || cleanKey.indexOf(rowEan) !== -1 || (cleanKey.indexOf('item-') !== -1 && (r - pColMap.headerRowIdx) === Number(cleanKey.replace(/\D/g, '')))) {
            pSheet.getRange(r + 1, msgIdCol + 1).setValue(String(messageId));
            break;
          }
        }
      }
    } catch (colErr) {}

    SpreadsheetApp.flush();
    return {
      status: 'success',
      ok: true,
      productKey: cleanKey,
      messageId: messageId,
      statusLabel: stat,
      updatedAt: now
    };
  } catch (err) {
    return { status: 'error', ok: false, message: err.toString() };
  }
}

/**
 * Retrieve a product's sent WhatsApp message info from Google Sheet "WA_Sent_Log" tab
 */
function getWaSentMessageFromSheet(sheetId, productKey) {
  try {
    var ss = getSpreadsheet(sheetId);
    var sheet = ss.getSheetByName('WA_Sent_Log');
    if (!sheet) {
      return { status: 'not_found', found: false };
    }
    var data = sheet.getDataRange().getValues();
    var cleanKey = String(productKey || '').toLowerCase().trim();
    if (!cleanKey) return { status: 'not_found', found: false };

    for (var i = 1; i < data.length; i++) {
      var rowKey = String(data[i][0] || '').toLowerCase().trim();
      var msgId = String(data[i][1] || '').trim();
      if (rowKey && msgId && (rowKey === cleanKey || rowKey.indexOf(cleanKey) !== -1 || cleanKey.indexOf(rowKey) !== -1)) {
        return {
          status: 'success',
          found: true,
          productKey: data[i][0],
          messageId: msgId,
          recipient: data[i][2],
          productLink: data[i][3],
          price: data[i][4],
          stock: data[i][5],
          statusLabel: data[i][6],
          updatedAt: data[i][7]
        };
      }
    }
    return { status: 'not_found', found: false };
  } catch (err) {
    return { status: 'error', found: false, message: err.toString() };
  }
}

/**
 * Get all sent WhatsApp message records from Google Sheet "WA_Sent_Log" tab
 */
function handleGetWaSentLog(sheetId) {
  try {
    var ss = getSpreadsheet(sheetId);
    var sheet = ss.getSheetByName('WA_Sent_Log');
    if (!sheet) return { status: 'success', ok: true, count: 0, logs: [] };
    var data = sheet.getDataRange().getValues();
    var list = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0] && !row[1]) continue;
      list.push({
        productKey: String(row[0] || ''),
        messageId: String(row[1] || ''),
        recipient: String(row[2] || ''),
        productLink: String(row[3] || ''),
        price: row[4],
        stock: row[5],
        status: String(row[6] || 'SENT'),
        updatedAt: String(row[7] || '')
      });
    }
    return { status: 'success', ok: true, count: list.length, logs: list };
  } catch (e) {
    return { status: 'error', ok: false, message: e.toString() };
  }
}

/**
 * Retrieve all in-stock products formatted with pure links for the auto-loop
 */
function getProductsForLoop(sheetId, customDomain) {
  var prods = handleGetProducts(sheetId);
  var settingsRes = handleGetWaSettings(sheetId);
  var domain = (customDomain || settingsRes.settings.STORE_DOMAIN || 'https://www.munagrocery.in').replace(/\/+$/, '');
  var onlyInStock = settingsRes.settings.SEND_ONLY_IN_STOCK;

  var list = [];
  for (var i = 0; i < prods.length; i++) {
    var p = prods[i];
    var stock = Number(p.stock_qty || 0);
    if (onlyInStock && stock <= 0) continue;

    var rawEan = String(p.ean || '').split(/[,;|\s]+/)[0].replace(/^EAN-/i, '').trim();
    if (!rawEan) rawEan = 'item-' + (i + 1);

    var sp = Number(p.selling_price || 0);
    var mrp = Number(p.mrp || sp);
    var vTag = sp + '_s' + stock;
    var rawImg = p.backup_image_url || p.image_url || '';
    var imgParam = (rawImg && (rawImg.indexOf('https://') === 0 || rawImg.indexOf('http://') === 0) && rawImg.indexOf('/products/') === -1)
      ? '&img=' + encodeURIComponent(rawImg)
      : '';

    var pureLink = domain + '/?item=' + encodeURIComponent(rawEan) + '&sp=' + sp + '&mrp=' + mrp + imgParam + '&v=' + vTag;

    list.push({
      index: i + 1,
      name: p.product_name || 'Grocery Item',
      ean: rawEan,
      sp: sp,
      mrp: mrp,
      stock: stock,
      category: p.category || 'General',
      image: p.backup_image_url || p.image_url || '',
      pureLink: pureLink
    });
  }

  // Sort category-wise sequentially if GROUP_BY_CATEGORY is enabled
  if (settingsRes.settings.GROUP_BY_CATEGORY) {
    list.sort(function(a, b) {
      var catA = String(a.category || 'General').toLowerCase();
      var catB = String(b.category || 'General').toLowerCase();
      if (catA < catB) return -1;
      if (catA > catB) return 1;
      return 0;
    });
  }

  return {
    status: 'success',
    ok: true,
    count: list.length,
    products: list
  };
}

/**
 * Test connectivity with Baileys Gateway Server on Render
 */
function testWaConnection(customSheetId) {
  var sheetId = customSheetId || DEFAULT_SHEET_ID;
  var settings = handleGetWaSettings(sheetId).settings;
  var baseUrl = String(settings.RENDER_BASE_URL || '').replace(/\/+$/, '');
  var token = String(settings.API_BEARER_TOKEN || '').trim();

  try {
    var testUrl = baseUrl + '/api/v1/sessions';
    var res = UrlFetchApp.fetch(testUrl, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    return {
      status: 'success',
      ok: res.getResponseCode() >= 200 && res.getResponseCode() < 400,
      statusCode: res.getResponseCode(),
      response: res.getContentText()
    };
  } catch (e) {
    return {
      status: 'error',
      ok: false,
      message: e.toString()
    };
  }
}

// Client-Callable RPC Functions for Index.html (google.script.run)
function getSettings() {
  return handleGetWaSettings(DEFAULT_SHEET_ID);
}

function updateSettings(newSettings) {
  return handleUpdateWaSettings(DEFAULT_SHEET_ID, newSettings);
}

function getProductsLoop(domain) {
  return getProductsForLoop(DEFAULT_SHEET_ID, domain);
}

function sendProductLink(link, recipient) {
  return postWhatsAppMessage(link, recipient, DEFAULT_SHEET_ID);
}

function refreshLinkForProduct(ean, sp, mrp, domain) {
  var cleanEan = String(ean || '').split(/[,;|\s]+/)[0].replace(/^EAN-/i, '').trim();
  var dom = (domain || 'https://www.munagrocery.in').replace(/\/+$/, '');
  var hash = Math.random().toString(36).substring(2, 7);
  var vTag = sp + '_' + hash;
  return dom + '/?item=' + encodeURIComponent(cleanEan) + '&sp=' + sp + '&mrp=' + mrp + '&v=' + vTag;
}

/**
 * ============================================================================
 * CLOUD 24/7 BACKGROUND AUTO-LOOP TRIGGER (Runs on Google Cloud Servers)
 * ============================================================================
 */

function setupCloudLoopTrigger(customSheetId) {
  var sheetId = customSheetId || DEFAULT_SHEET_ID;
  stopCloudLoopTrigger(sheetId);
  
  try {
    ScriptApp.newTrigger('runCloudAutoLoopCron')
      .timeBased()
      .everyMinutes(1)
      .create();

    var configRes = handleGetWaSettings(sheetId);
    var settings = configRes.settings || {};
    settings.CLOUD_TRIGGER_ACTIVE = "true";
    settings.CLOUD_CURRENT_INDEX = settings.CLOUD_CURRENT_INDEX || "0";
    handleUpdateWaSettings(sheetId, settings);

    return {
      status: 'success',
      ok: true,
      message: '☁️ Cloud 24/7 Background Trigger Activated! Google Cloud will send product links every minute automatically, even if browser/phone is closed.'
    };
  } catch (err) {
    return {
      status: 'error',
      ok: false,
      message: 'Failed to create Cloud Trigger: ' + err.toString()
    };
  }
}

function stopCloudLoopTrigger(customSheetId) {
  var sheetId = customSheetId || DEFAULT_SHEET_ID;
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var count = 0;
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'runCloudAutoLoopCron') {
        ScriptApp.deleteTrigger(triggers[i]);
        count++;
      }
    }

    var configRes = handleGetWaSettings(sheetId);
    var settings = configRes.settings || {};
    settings.CLOUD_TRIGGER_ACTIVE = "false";
    handleUpdateWaSettings(sheetId, settings);

    return {
      status: 'success',
      ok: true,
      deleted: count,
      message: '⏸️ Cloud 24/7 Background Trigger Stopped.'
    };
  } catch (err) {
    return {
      status: 'error',
      ok: false,
      message: err.toString()
    };
  }
}

function getCloudTriggerStatus(customSheetId) {
  var sheetId = customSheetId || DEFAULT_SHEET_ID;
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var isActive = false;
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'runCloudAutoLoopCron') {
        isActive = true;
        break;
      }
    }

    var settingsRes = handleGetWaSettings(sheetId);
    var settings = settingsRes.settings || {};

    return {
      status: 'success',
      ok: true,
      active: isActive,
      currentIndex: Number(settings.CLOUD_CURRENT_INDEX || 0),
      lastRun: settings.CLOUD_LAST_RUN || 'Never'
    };
  } catch (err) {
    return {
      status: 'error',
      ok: false,
      active: false,
      message: err.toString()
    };
  }
}

function runCloudAutoLoopCron() {
  var sheetId = DEFAULT_SHEET_ID;
  var settingsRes = handleGetWaSettings(sheetId);
  var settings = settingsRes.settings || {};

  var productsRes = getProductsForLoop(sheetId, settings.STORE_DOMAIN);
  var products = productsRes.products || [];
  if (products.length === 0) return;

  var currentIndex = Number(settings.CLOUD_CURRENT_INDEX || 0);
  if (currentIndex >= products.length) {
    currentIndex = 0;
  }

  var prod = products[currentIndex];
  if (prod && prod.pureLink) {
    var recipient = settings.DEFAULT_RECIPIENT;
    // Check if this product was already posted and has a messageId recorded in Google Sheet
    var existingWa = getWaSentMessageFromSheet(sheetId, prod.ean);
    if (existingWa && existingWa.found && existingWa.messageId) {
      // Product was already posted -> Edit existing WhatsApp message in-place with pure link
      editWhatsAppMessage(existingWa.messageId, prod.pureLink, recipient, sheetId, prod.ean, prod.sp, prod.stock);
    } else {
      // First time sending -> Post link and save returned messageId into Google Sheet WA_Sent_Log
      postWhatsAppMessage(prod.pureLink, recipient, sheetId, prod.ean, prod.sp, prod.stock);
    }
  }

  var nextIndex = (currentIndex + 1) % products.length;
  settings.CLOUD_CURRENT_INDEX = String(nextIndex);
  settings.CLOUD_LAST_RUN = new Date().toISOString();
  handleUpdateWaSettings(sheetId, settings);
}

// ============================================================================
// PART 5: POS & VYAPAR BILLING COUNTER DATABASE BACKEND
// ============================================================================

/**
 * POS & VYAPAR: Get Parties / Customers Ledger
 */
function handleGetParties(sheetId) {
  try {
    var ss = getSpreadsheet(sheetId);
    var sheet = ss.getSheetByName('Parties');
    if (!sheet) {
      sheet = ss.insertSheet('Parties');
      sheet.appendRow(['ID', 'Name', 'Phone', 'Address', 'Balance', 'Created_At', 'Updated_At']);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#E8F0FE');
      sheet.setFrozenRows(1);
      return { status: 'success', parties: [], data: [] };
    }
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { status: 'success', parties: [], data: [] };
    }
    var parties = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0] && !row[1] && !row[2]) continue;
      parties.push({
        id: row[0] || ('P-' + i),
        name: String(row[1] || '').trim(),
        phone: String(row[2] || '').trim(),
        addr: String(row[3] || '').trim(),
        balance: Number(row[4]) || 0,
        createdAt: row[5] ? String(row[5]) : '',
        updatedAt: row[6] ? String(row[6]) : ''
      });
    }
    return { status: 'success', parties: parties, data: parties, count: parties.length };
  } catch (err) {
    return { status: 'error', message: err.toString(), parties: [], data: [] };
  }
}

/**
 * POS & VYAPAR: Save or Update Party / Customer
 */
function handleSaveParty(sheetId, payload) {
  try {
    var ss = getSpreadsheet(sheetId);
    var sheet = ss.getSheetByName('Parties');
    if (!sheet) {
      sheet = ss.insertSheet('Parties');
      sheet.appendRow(['ID', 'Name', 'Phone', 'Address', 'Balance', 'Created_At', 'Updated_At']);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#E8F0FE');
      sheet.setFrozenRows(1);
    }

    var targetId = String(payload.id || '').trim();
    var name = String(payload.name || payload.customer || '').trim();
    var rawPhone = String(payload.phone || '').trim();
    var cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
    var addr = String(payload.addr || payload.address || '').trim();
    var balance = Number(payload.balance !== undefined ? payload.balance : (payload.bal !== undefined ? payload.bal : 0)) || 0;
    var nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    var data = sheet.getDataRange().getValues();
    var matchRowIdx = -1;

    for (var i = 1; i < data.length; i++) {
      var rowId = String(data[i][0] || '').trim();
      var rowPhone = String(data[i][2] || '').replace(/\D/g, '').slice(-10);
      if ((targetId && rowId === targetId) || (cleanPhone && rowPhone === cleanPhone)) {
        matchRowIdx = i + 1;
        break;
      }
    }

    if (matchRowIdx > 0) {
      if (name) sheet.getRange(matchRowIdx, 2).setValue(name);
      if (rawPhone) sheet.getRange(matchRowIdx, 3).setValue(rawPhone);
      if (addr) sheet.getRange(matchRowIdx, 4).setValue(addr);
      sheet.getRange(matchRowIdx, 5).setValue(balance);
      sheet.getRange(matchRowIdx, 7).setValue(nowStr);
      SpreadsheetApp.flush();
      return { status: 'success', ok: true, message: 'Party updated successfully', id: targetId || cleanPhone, balance: balance };
    } else {
      var newId = targetId || ('PARTY-' + (data.length));
      sheet.appendRow([newId, name, rawPhone, addr, balance, nowStr, nowStr]);
      SpreadsheetApp.flush();
      return { status: 'success', ok: true, message: 'Party added successfully', id: newId, balance: balance };
    }
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * POS & VYAPAR: Update Party Balance (e.g. Udhar payment / collection)
 */
function handleUpdatePartyBalance(sheetId, payload) {
  try {
    var ss = getSpreadsheet(sheetId);
    var sheet = ss.getSheetByName('Parties');
    if (!sheet) {
      return { status: 'error', message: 'Parties sheet does not exist' };
    }

    var targetId = String(payload.id || '').trim();
    var cleanPhone = String(payload.phone || '').replace(/\D/g, '').slice(-10);
    var nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var rowId = String(data[i][0] || '').trim();
      var rowPhone = String(data[i][2] || '').replace(/\D/g, '').slice(-10);
      if ((targetId && rowId === targetId) || (cleanPhone && rowPhone === cleanPhone)) {
        var rowIndex = i + 1;
        var currentBal = Number(data[i][4]) || 0;
        var newBal = currentBal;
        if (payload.balance !== undefined) {
          newBal = Number(payload.balance);
        } else if (payload.delta !== undefined) {
          newBal = currentBal + Number(payload.delta);
        } else if (payload.amount !== undefined || payload.amt !== undefined) {
          var amt = Number(payload.amount || payload.amt || 0);
          newBal = Math.max(0, currentBal - amt);
        }
        sheet.getRange(rowIndex, 5).setValue(newBal);
        sheet.getRange(rowIndex, 7).setValue(nowStr);
        SpreadsheetApp.flush();
        return { status: 'success', ok: true, message: 'Balance updated', balance: newBal, id: rowId };
      }
    }
    return { status: 'not_found', ok: false, message: 'Party not found' };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * POS & VYAPAR: Record Sale and Auto-Deduct Inventory Stock
 */
function handleCreatePosSale(sheetId, payload) {
  try {
    var ss = getSpreadsheet(sheetId);
    
    // 1. Ensure POS_Sales sheet exists
    var salesSheet = ss.getSheetByName('POS_Sales');
    if (!salesSheet) {
      salesSheet = ss.insertSheet('POS_Sales');
      salesSheet.appendRow([
        'Sale_ID', 'Date_Time', 'Customer_Name', 'Customer_Phone',
        'Payment_Mode', 'Total_Amount', 'Items_Count', 'Items_Details',
        'Date', 'Time'
      ]);
      salesSheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#E6F4EA');
      salesSheet.setFrozenRows(1);
    }

    var now = new Date();
    var timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
    var dateStr = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    var dateTimeStr = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    var saleId = String(payload.id || ('POS-' + Date.now().toString().slice(-6)));
    var custName = String(payload.customer || payload.customerName || 'Cash').trim();
    var custPhone = String(payload.phone || '').trim();
    var payMode = String(payload.payMode || payload.paymentMode || 'Cash').trim();
    var totalAmt = Number(payload.total || payload.totalAmt || 0);

    var items = payload.items || [];
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }
    var itemsCount = Number(payload.itemsCount || items.length);
    var itemsSummary = items.map(function(it) {
      return (it.name || 'Item') + ' x ' + (it.qty || 1) + ' (₹' + (it.price || it.sp || 0) + ')';
    }).join(', ');

    // Append sale record
    salesSheet.appendRow([
      saleId,
      dateTimeStr,
      custName,
      custPhone,
      payMode,
      totalAmt,
      itemsCount,
      itemsSummary || JSON.stringify(items),
      dateStr,
      timeStr
    ]);

    // 2. Stock Deduction in Sheet1 / Products Sheet
    var prodSheet = getProductsSheet(ss);
    if (prodSheet && items && items.length > 0) {
      var prodData = prodSheet.getDataRange().getValues();
      var colMap = getProductColumnMap(prodData);
      var stockCol = colMap.stock >= 0 ? colMap.stock : 3;

      for (var k = 0; k < items.length; k++) {
        var it = items[k];
        var itemEan = String(it.ean || it.barcode || '').trim();
        var itemName = String(it.name || '').trim().toLowerCase();
        var itemQty = Number(it.qty) || 1;

        for (var r = colMap.headerRowIdx + 1; r < prodData.length; r++) {
          var row = prodData[r];
          var rowEan = colMap.ean >= 0 ? String(row[colMap.ean] || '').trim() : '';
          var rowAddEans = colMap.additional_eans >= 0 ? String(row[colMap.additional_eans] || '').trim() : '';
          var rowName = colMap.name >= 0 ? String(row[colMap.name] || '').trim().toLowerCase() : '';

          var match = false;
          if (itemEan && (rowEan === itemEan || rowAddEans.indexOf(itemEan) !== -1)) {
            match = true;
          } else if (itemName && rowName && rowName === itemName) {
            match = true;
          }

          if (match) {
            var currentStock = Number(row[stockCol]) || 0;
            var newStock = Math.max(0, currentStock - itemQty);
            prodSheet.getRange(r + 1, stockCol + 1).setValue(newStock);
            row[stockCol] = newStock;
            break;
          }
        }
      }
    }

    // 3. If Udhar (Credit) Sale, auto-update Party's balance
    if (payMode.toLowerCase() === 'credit') {
      var partySheet = ss.getSheetByName('Parties');
      if (partySheet && (payload.partyId || custPhone || custName)) {
        var partyData = partySheet.getDataRange().getValues();
        var cleanTargetPhone = custPhone.replace(/\D/g, '').slice(-10);
        for (var p = 1; p < partyData.length; p++) {
          var pId = String(partyData[p][0] || '').trim();
          var pName = String(partyData[p][1] || '').trim().toLowerCase();
          var pPhone = String(partyData[p][2] || '').replace(/\D/g, '').slice(-10);
          if ((payload.partyId && pId === String(payload.partyId)) ||
              (cleanTargetPhone && pPhone === cleanTargetPhone) ||
              (custName && pName === custName.toLowerCase())) {
            var curBal = Number(partyData[p][4]) || 0;
            var updatedBal = curBal + totalAmt;
            partySheet.getRange(p + 1, 5).setValue(updatedBal);
            partySheet.getRange(p + 1, 7).setValue(dateTimeStr);
            break;
          }
        }
      }
    }

    SpreadsheetApp.flush();
    return {
      status: 'success',
      ok: true,
      message: 'Sale recorded and stock deducted successfully',
      saleId: saleId,
      total: totalAmt
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * POS & VYAPAR: Get POS Sales Daybook
 */
function handleGetPosSales(sheetId) {
  try {
    var ss = getSpreadsheet(sheetId);
    var sheet = ss.getSheetByName('POS_Sales');
    if (!sheet) {
      return { status: 'success', sales: [], data: [] };
    }
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { status: 'success', sales: [], data: [] };
    
    var sales = [];
    for (var i = data.length - 1; i >= 1 && sales.length < 200; i--) {
      var row = data[i];
      if (!row[0]) continue;
      sales.push({
        id: String(row[0]),
        dateTime: String(row[1] || ''),
        customer: String(row[2] || 'Cash'),
        phone: String(row[3] || ''),
        payMode: String(row[4] || 'Cash'),
        total: Number(row[5]) || 0,
        itemsCount: Number(row[6]) || 0,
        itemsDetails: String(row[7] || ''),
        date: String(row[8] || ''),
        time: String(row[9] || '')
      });
    }
    return { status: 'success', sales: sales, data: sales, count: sales.length };
  } catch (err) {
    return { status: 'error', message: err.toString(), sales: [], data: [] };
  }
}

/**
 * POS & VYAPAR: Get Shop Expenses
 */
function handleGetExpenses(sheetId) {
  try {
    var ss = getSpreadsheet(sheetId);
    var sheet = ss.getSheetByName('Expenses');
    if (!sheet) {
      sheet = ss.insertSheet('Expenses');
      sheet.appendRow(['ID', 'Date', 'Title', 'Category', 'Amount', 'Payment_Mode', 'Created_At']);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#FCE8E6');
      sheet.setFrozenRows(1);
      return { status: 'success', expenses: [], data: [] };
    }
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { status: 'success', expenses: [], data: [] };

    var expenses = [];
    for (var i = data.length - 1; i >= 1 && expenses.length < 200; i--) {
      var row = data[i];
      if (!row[0] && !row[1] && !row[2]) continue;
      expenses.push({
        id: row[0] || ('EXP-' + i),
        date: String(row[1] || ''),
        name: String(row[2] || ''),
        cat: String(row[3] || 'General'),
        amt: Number(row[4]) || 0,
        payMode: String(row[5] || 'Cash'),
        createdAt: String(row[6] || '')
      });
    }
    return { status: 'success', expenses: expenses, data: expenses, count: expenses.length };
  } catch (err) {
    return { status: 'error', message: err.toString(), expenses: [], data: [] };
  }
}

/**
 * POS & VYAPAR: Add Expense
 */
function handleAddExpense(sheetId, payload) {
  try {
    var ss = getSpreadsheet(sheetId);
    var sheet = ss.getSheetByName('Expenses');
    if (!sheet) {
      sheet = ss.insertSheet('Expenses');
      sheet.appendRow(['ID', 'Date', 'Title', 'Category', 'Amount', 'Payment_Mode', 'Created_At']);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#FCE8E6');
      sheet.setFrozenRows(1);
    }

    var now = new Date();
    var expId = String(payload.id || ('EXP-' + Date.now().toString().slice(-6)));
    var dateStr = String(payload.date || now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }));
    var title = String(payload.name || payload.title || 'Expense').trim();
    var cat = String(payload.cat || payload.category || 'General').trim();
    var amt = Number(payload.amt || payload.amount || 0);
    var payMode = String(payload.payMode || 'Cash').trim();
    var nowStr = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    sheet.appendRow([expId, dateStr, title, cat, amt, payMode, nowStr]);
    SpreadsheetApp.flush();
    return { status: 'success', ok: true, message: 'Expense saved successfully', id: expId, amt: amt };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}
