// ============================================================
//  TEMPLE MANAGEMENT SYSTEM — Google Apps Script Backend
//  FIXED VERSION — Supports JSONP (fixes CORS error)
//  Deploy as: Web App → Execute as Me → Anyone can access
// ============================================================

const SS = SpreadsheetApp.getActiveSpreadsheet();

// ===== doGet — handles JSONP calls from website =====
function doGet(e) {
  try {
    const action = e.parameter.action || '';
    const dataStr = e.parameter.data || '{}';
    const payload = JSON.parse(dataStr);
    payload.action = action;

    const result = handleAction(payload);
    const callback = e.parameter.callback;

    if (callback) {
      // JSONP — wraps result in callback function
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(result) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    // Normal GET (for browser test)
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    const callback = e.parameter.callback;
    const errResult = { success: false, message: err.message };
    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(errResult) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(JSON.stringify(errResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== doPost — kept for compatibility =====
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const result = handleAction(payload);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== ROUTER =====
function handleAction(p) {
  switch(p.action) {
    case 'login':            return doLogin(p);
    case 'getPublicData':    return getPublicData();
    case 'getDashboard':     return getDashboard();
    case 'getNextReceipt':   return getNextReceipt();
    case 'getCategories':    return { success:true, categories: getColumn('Categories','Name') };
    case 'getPaymentTypes':  return { success:true, payments: getColumn('PaymentTypes','Name') };
    case 'saveTransaction':  return saveTransaction(p);
    case 'getTransactions':  return getTransactions();
    case 'getReport':        return getReport(p.reportType);
    case 'getUsers':         return getUsers();
    case 'saveUser':         return saveUser(p);
    case 'deleteUser':       return deleteUser(p);
    case 'getMasterData':    return getMasterData();
    case 'addMasterItem':    return addMasterItem(p);
    case 'deleteMasterItem': return deleteMasterItem(p);
    case 'getPermissions':   return getPermissions();
    case 'savePermission':   return savePermission(p);
    case 'getSettings':      return getSettings();
    case 'saveSettings':     return saveSettings(p);
    case 'getPhotos':        return getPhotos();
    default: return { success:true, message:'Temple API running' };
  }
}

// ===== LOGIN =====
function doLogin(p) {
  const users = sheetToObjects('Users');
  const user = users.find(u =>
    u.Username === p.username &&
    u.Password === p.password &&
    u.Status === 'active'
  );
  if (!user) return { success: false, message: 'Invalid username or password.' };
  const perms = sheetToObjects('Permissions').find(r => r.Username === user.Username) || {};
  return {
    success: true, username: user.Username, role: user.Role,
    permissions: {
      HomeEdit: perms.HomeEdit || 'No', Finance: perms.Finance || 'No',
      Reports: perms.Reports || 'No', Downloads: perms.Downloads || 'No'
    }
  };
}

// ===== PUBLIC DATA =====
function getPublicData() {
  const settings = settingsToObj();
  const homeRows = sheetToObjects('HomePage');
  const updates = homeRows.filter(r => r.Type === 'Update').map(r => ({ Title:r.Title, Content:r.Content, Date:r.Date }));
  const festivals = homeRows.filter(r => r.Type === 'Festival').map(r => ({ Name:r.Title, Date:r.Date }));
  const photos = sheetToObjects('Photos');
  const sliders = photos.filter(p => p.Type === 'slider').map(p => ({ url:p.URL, caption:p.Caption }));
  const categories = getColumn('Categories','Name');
  const payments = getColumn('PaymentTypes','Name');
  return { success:true, settings, updates, festivals, sliders, categories, payments };
}

// ===== DASHBOARD =====
function getDashboard() {
  const txns = sheetToObjects('Transactions');
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  const monthStr = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM');
  const income = txns.filter(t => t.Category !== 'Expenses');
  const expenses = txns.filter(t => t.Category === 'Expenses');
  const sum = arr => arr.reduce((s,t) => s + (parseFloat(t.Amount)||0), 0);
  const todayTotal = sum(income.filter(t => (t.Date||'').startsWith(todayStr)));
  const monthTotal = sum(income.filter(t => (t.Date||'').startsWith(monthStr)));
  const grandTotal = sum(income);
  const totalExpense = sum(expenses);
  const recent = txns.slice(-10).reverse();
  return { success:true, todayTotal, monthTotal, grandTotal, totalExpense, recent };
}

// ===== RECEIPT =====
function getNextReceipt() {
  const sheet = SS.getSheetByName('Transactions');
  const lastRow = sheet ? sheet.getLastRow() : 1;
  const num = lastRow > 1 ? lastRow : 1;
  return { receiptNo: 'TR' + String(num).padStart(6,'0') };
}

// ===== SAVE TRANSACTION =====
function saveTransaction(p) {
  const sheet = SS.getSheetByName('Transactions');
  if (!sheet) return { success:false, message:'Transactions sheet not found.' };
  sheet.appendRow([p.ReceiptNo, p.Date, p.Name, p.Area, p.Category, p.Amount, p.PaymentType, p.WhatsApp, p.Remarks, p.EnteredBy, new Date()]);
  return { success:true };
}

// ===== GET TRANSACTIONS =====
function getTransactions() {
  const txns = sheetToObjects('Transactions');
  txns.reverse();
  return { success:true, transactions:txns };
}

// ===== REPORTS =====
function getReport(type) {
  const txns = sheetToObjects('Transactions');
  const income = txns.filter(t => t.Category !== 'Expenses');
  let data = [], columns = [];

  const sumByKey = (arr, key) => {
    const map = {};
    arr.forEach(t => { const k=t[key]||'Unknown'; map[k]=(map[k]||0)+(parseFloat(t.Amount)||0); });
    return Object.entries(map).map(([k,v]) => ({ [key]:k, Total:'₹'+v.toLocaleString('en-IN'), Count:arr.filter(t=>t[key]===k).length }));
  };

  if(type==='daily')       { data=sumByKey(income,'Date'); columns=['Date','Total','Count']; }
  else if(type==='monthly'){ const m={};income.forEach(t=>{const k=(t.Date||'').slice(0,7);m[k]=(m[k]||0)+(parseFloat(t.Amount)||0);});data=Object.entries(m).map(([k,v])=>({Month:k,Total:'₹'+v.toLocaleString('en-IN')}));columns=['Month','Total']; }
  else if(type==='yearly') { const y={};income.forEach(t=>{const k=(t.Date||'').slice(0,4);y[k]=(y[k]||0)+(parseFloat(t.Amount)||0);});data=Object.entries(y).map(([k,v])=>({Year:k,Total:'₹'+v.toLocaleString('en-IN')}));columns=['Year','Total']; }
  else if(type==='category'){ data=sumByKey(income,'Category'); columns=['Category','Total','Count']; }
  else if(type==='payment') { data=sumByKey(income,'PaymentType'); columns=['PaymentType','Total','Count']; }
  else if(type==='area')    { data=sumByKey(income,'Area'); columns=['Area','Total','Count']; }
  else if(type==='user')    { data=sumByKey(income,'EnteredBy'); columns=['EnteredBy','Total','Count']; }
  else if(type==='balance') {
    const ti=income.reduce((s,t)=>s+(parseFloat(t.Amount)||0),0);
    const te=txns.filter(t=>t.Category==='Expenses').reduce((s,t)=>s+(parseFloat(t.Amount)||0),0);
    data=[{Type:'Total Income',Amount:'₹'+ti.toLocaleString('en-IN')},{Type:'Total Expense',Amount:'₹'+te.toLocaleString('en-IN')},{Type:'Balance',Amount:'₹'+(ti-te).toLocaleString('en-IN')}];
    columns=['Type','Amount'];
  }
  return { success:true, data, columns };
}

// ===== USERS =====
function getUsers() {
  return { success:true, users: sheetToObjects('Users').map(u=>({Username:u.Username,Role:u.Role,Status:u.Status})) };
}
function saveUser(p) {
  const sheet = SS.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const uCol = headers.indexOf('Username');
  const rows = data.slice(1);
  const idx = rows.findIndex(r => r[uCol] === p.username);
  if(idx>=0){
    const row=idx+2;
    if(p.password) sheet.getRange(row,headers.indexOf('Password')+1).setValue(p.password);
    sheet.getRange(row,headers.indexOf('Role')+1).setValue(p.role);
    sheet.getRange(row,headers.indexOf('Status')+1).setValue(p.status);
  } else {
    if(!p.password) return {success:false,message:'Password required for new user.'};
    sheet.appendRow([p.username,p.password,p.role,p.status]);
  }
  return {success:true};
}
function deleteUser(p) {
  const sheet=SS.getSheetByName('Users');
  const data=sheet.getDataRange().getValues();
  const uCol=data[0].indexOf('Username');
  for(let i=1;i<data.length;i++){if(data[i][uCol]===p.username){sheet.deleteRow(i+1);return {success:true};}}
  return {success:false,message:'User not found.'};
}

// ===== MASTER =====
function getMasterData() {
  return {success:true,categories:getColumn('Categories','Name'),payments:getColumn('PaymentTypes','Name')};
}
function addMasterItem(p) {
  const sheet=SS.getSheetByName(p.sheet);
  if(!sheet) return {success:false,message:'Sheet not found.'};
  sheet.appendRow([p.value]); return {success:true};
}
function deleteMasterItem(p) {
  const sheet=SS.getSheetByName(p.sheet);
  const data=sheet.getDataRange().getValues();
  for(let i=0;i<data.length;i++){if(data[i][0]===p.value){sheet.deleteRow(i+1);return {success:true};}}
  return {success:false,message:'Item not found.'};
}

// ===== PERMISSIONS =====
function getPermissions() { return {success:true,permissions:sheetToObjects('Permissions')}; }
function savePermission(p) {
  const sheet=SS.getSheetByName('Permissions');
  const data=sheet.getDataRange().getValues();
  const headers=data[0]; const uCol=headers.indexOf('Username');
  for(let i=1;i<data.length;i++){
    if(data[i][uCol]===p.Username){
      ['HomeEdit','Finance','Reports','Downloads'].forEach(k=>{const col=headers.indexOf(k);if(col>=0)sheet.getRange(i+1,col+1).setValue(p[k]||'No');});
      return {success:true};
    }
  }
  sheet.appendRow([p.Username,p.HomeEdit||'No',p.Finance||'No',p.Reports||'No',p.Downloads||'No']);
  return {success:true};
}

// ===== SETTINGS =====
function getSettings() { return {success:true,settings:settingsToObj()}; }
function saveSettings(p) {
  const sheet=SS.getSheetByName('Settings');
  const data=sheet.getDataRange().getValues();
  const keys=data.map(r=>r[0]);
  Object.keys(p).filter(k=>k!=='action').forEach(key=>{
    const idx=keys.indexOf(key);
    if(idx>=0) sheet.getRange(idx+1,2).setValue(p[key]);
    else sheet.appendRow([key,p[key]]);
  });
  return {success:true};
}

// ===== PHOTOS =====
function getPhotos() {
  return {success:true,photos:sheetToObjects('Photos').map(p=>({url:p.URL,caption:p.Caption,type:p.Type}))};
}

// ===== HELPERS =====
function sheetToObjects(name) {
  const sheet=SS.getSheetByName(name);
  if(!sheet||sheet.getLastRow()<2) return [];
  const data=sheet.getDataRange().getValues();
  const headers=data[0];
  return data.slice(1).filter(r=>r[0]!=='').map(row=>{
    const obj={};
    headers.forEach((h,i)=>obj[h]=row[i]!==undefined?String(row[i]):'');
    return obj;
  });
}
function getColumn(sheetName,colName) {
  return sheetToObjects(sheetName).map(r=>r[colName]).filter(Boolean);
}
function settingsToObj() {
  const sheet=SS.getSheetByName('Settings');
  if(!sheet) return {};
  const data=sheet.getDataRange().getValues();
  const obj={};
  data.forEach(r=>{if(r[0])obj[r[0]]=r[1]||'';});
  return obj;
}
