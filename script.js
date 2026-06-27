// ============================================================
//  TEMPLE MANAGEMENT SYSTEM — MAIN SCRIPT
//  Google Apps Script Backend | Fully Responsive
// ============================================================

// ===== STATE =====
let currentUser = null;
let allTransactions = [];
let allUsers = [];
let allPermissions = {};
let siteSettings = {};
let masterCategories = [];
let masterPayments = [];
let sliderImages = [];
let currentSlide = 0;
let sliderTimer = null;
let reportData = [];
let currentReportType = '';
let txnPage = 1;
const TXN_PER_PAGE = 20;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  restoreSession();
  loadPublicData();
  bindNavLinks();
  setTodayDate();
  document.getElementById('temple-name-header').textContent = '🛕 ' + CONFIG.TEMPLE_NAME;
  document.getElementById('temple-name-slide').textContent = CONFIG.TEMPLE_NAME;
  document.getElementById('temple-tagline-slide').textContent = CONFIG.TEMPLE_TAGLINE;
  document.getElementById('footer-name').textContent = CONFIG.TEMPLE_NAME;
});

// ===== NAVIGATION =====
function bindNavLinks() {
  document.querySelectorAll('.nav-link[data-page]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      showPage(a.dataset.page);
    });
  });
}

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }
  document.querySelectorAll(`.nav-link[data-page="${page}"]`).forEach(a => a.classList.add('active'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (page === 'dashboard' && currentUser) loadDashboard();
  if (page === 'transactions') loadTransactions();
  if (page === 'users') loadUsers();
  if (page === 'master') loadMasterSettings();
  if (page === 'permissions') loadPermissions();
  if (page === 'finance') prepareFinanceForm();
  if (page === 'homepage-edit') loadHomepageEditForm();
  if (page === 'photos') renderPhotosPage();
  if (page === 'updates') renderUpdatesPage();
  if (page === 'contact') renderContactPage();
}

function toggleMenu() {
  document.getElementById('mobile-menu').classList.toggle('hidden');
}

// ===== SESSION =====
function restoreSession() {
  try {
    const saved = sessionStorage.getItem('temple_user');
    if (saved) { currentUser = JSON.parse(saved); applyLogin(); }
  } catch(e) {}
}
function saveSession() { sessionStorage.setItem('temple_user', JSON.stringify(currentUser)); }
function clearSession() { sessionStorage.removeItem('temple_user'); }

// ===== API CALL — JSONP (fixes CORS with Google Apps Script) =====
function apiCall(payload) {
  // Demo mode if URL not set
  if (!CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL.includes('YOUR_SCRIPT_ID')) {
    return Promise.resolve(mockResponse(payload));
  }

  return new Promise((resolve, reject) => {
    const cbName = 'tpl_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
    const script = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Request timeout after 15s'));
    }, 15000);

    window[cbName] = function(result) {
      cleanup();
      resolve(result);
    };

    function cleanup() {
      clearTimeout(timer);
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    script.onerror = function() {
      cleanup();
      reject(new Error('Network error'));
    };

    // Build URL — send all data as query params
    const dataStr = encodeURIComponent(JSON.stringify(payload));
    script.src = CONFIG.SCRIPT_URL
      + '?action=' + encodeURIComponent(payload.action || '')
      + '&data=' + dataStr
      + '&callback=' + cbName;

    document.head.appendChild(script);
  });
}

// ===== LOGIN =====
async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  errEl.textContent = '';

  if (!username || !password) {
    errEl.textContent = 'Please enter username and password.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    const res = await apiCall({ action: 'login', username, password });
    if (res.success) {
      currentUser = { username: res.username, role: res.role, permissions: res.permissions || {} };
      saveSession();
      applyLogin();
      showPage('dashboard');
      showToast('Welcome, ' + currentUser.username + '!');
    } else {
      errEl.textContent = res.message || 'Invalid username or password.';
      errEl.classList.remove('hidden');
    }
  } catch(e) {
    errEl.textContent = 'Connection error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

function applyLogin() {
  const isAdmin = currentUser.role === 'admin';
  const perms = currentUser.permissions || {};
  document.querySelectorAll('.auth-link').forEach(el => el.classList.remove('hidden'));
  document.querySelectorAll('.admin-link').forEach(el => { if (!isAdmin) el.classList.add('hidden'); });
  document.getElementById('login-btn').classList.add('hidden');
  document.getElementById('login-btn-mob').classList.add('hidden');
  document.getElementById('logout-btn').classList.remove('hidden');
  document.getElementById('logout-btn-mob').classList.remove('hidden');
  const du = document.getElementById('dash-username');
  const dr = document.getElementById('dash-role');
  if (du) du.textContent = currentUser.username;
  if (dr) dr.textContent = currentUser.role.toUpperCase();
  if (!isAdmin && perms.homeEdit !== 'Yes') {
    document.querySelectorAll('[data-page="homepage-edit"]').forEach(el => el.classList.add('hidden'));
  }
}

function logout() {
  currentUser = null;
  allTransactions = [];
  clearSession();
  document.querySelectorAll('.auth-link').forEach(el => el.classList.add('hidden'));
  document.getElementById('login-btn').classList.remove('hidden');
  document.getElementById('login-btn-mob').classList.remove('hidden');
  document.getElementById('logout-btn').classList.add('hidden');
  document.getElementById('logout-btn-mob').classList.add('hidden');
  showPage('home');
  showToast('Logged out successfully.');
}

// ===== PUBLIC DATA =====
async function loadPublicData() {
  try {
    const res = await apiCall({ action: 'getPublicData' });
    if (res.success) {
      siteSettings = res.settings || {};
      masterCategories = res.categories || [];
      masterPayments = res.payments || [];
      sliderImages = res.sliders || [];
      renderHomeData(res);
    }
  } catch(e) { console.warn('Public data load failed:', e.message); }
}

function renderHomeData(data) {
  const s = data.settings || {};
  const name = s.TempleName || CONFIG.TEMPLE_NAME;
  document.getElementById('temple-name-header').textContent = '🛕 ' + name;
  document.getElementById('temple-name-slide').textContent = name;
  document.getElementById('temple-tagline-slide').textContent = s.Tagline || CONFIG.TEMPLE_TAGLINE;
  document.getElementById('footer-name').textContent = name;
  if (s.TaglineHeader) document.getElementById('temple-tagline-header').textContent = s.TaglineHeader;
  if (s.LogoURL) {
    const img = document.getElementById('temple-logo');
    img.src = s.LogoURL; img.classList.remove('hidden');
  }
  document.getElementById('home-timings').textContent = s.Timings || 'Morning 6–12 | Evening 4–8';
  document.getElementById('home-address').textContent = s.Address || '';
  document.getElementById('home-phone').textContent = s.Phone || '';
  buildSlider(data.sliders || []);
  renderUpdates(data.updates || [], 'updates-list', 3);
  renderFestivals(data.festivals || []);
  if (s.MapURL) {
    document.getElementById('map-container').innerHTML = `<iframe src="${s.MapURL}" allowfullscreen loading="lazy"></iframe>`;
  }
  if (s.DonationUPI) document.getElementById('donation-upi').textContent = s.DonationUPI;
  if (s.QRCodeURL) {
    const qr = document.getElementById('qr-img');
    qr.src = s.QRCodeURL; qr.classList.remove('hidden');
  }
}

// ===== SLIDER =====
function buildSlider(images) {
  const slider = document.getElementById('slider');
  const dotsEl = document.getElementById('slide-dots');
  slider.innerHTML = ''; dotsEl.innerHTML = '';
  const slides = images.length > 0 ? images : [{ url: '', caption: CONFIG.TEMPLE_NAME }];
  slides.forEach((img, i) => {
    const div = document.createElement('div');
    div.className = 'slide';
    if (img.url) div.style.backgroundImage = `url('${img.url}')`;
    else div.style.background = 'linear-gradient(135deg,#b8860b,#8b0000)';
    div.innerHTML = `<div class="slide-text"><h2>${CONFIG.TEMPLE_NAME}</h2><p>${img.caption || CONFIG.TEMPLE_TAGLINE}</p></div>`;
    slider.appendChild(div);
    const dot = document.createElement('div');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.onclick = () => goToSlide(i);
    dotsEl.appendChild(dot);
  });
  startSlider();
}
function startSlider() { clearInterval(sliderTimer); sliderTimer = setInterval(() => changeSlide(1), 4000); }
function changeSlide(dir) {
  const slides = document.querySelectorAll('.slide');
  if (!slides.length) return;
  currentSlide = (currentSlide + dir + slides.length) % slides.length;
  goToSlide(currentSlide);
}
function goToSlide(n) {
  currentSlide = n;
  document.getElementById('slider').style.transform = `translateX(-${n * 100}%)`;
  document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === n));
}

// ===== UPDATES =====
function renderUpdates(updates, containerId, limit) {
  const el = document.getElementById(containerId); if (!el) return;
  el.innerHTML = '';
  const items = limit ? updates.slice(0, limit) : updates;
  if (!items.length) { el.innerHTML = '<p style="color:var(--muted)">No updates yet.</p>'; return; }
  items.forEach(u => {
    el.innerHTML += `<div class="update-card"><h4>${u.Title||''}</h4><p>${u.Content||''}</p><div class="update-date">${u.Date||''}</div></div>`;
  });
}
function renderUpdatesPage() {
  apiCall({ action: 'getPublicData' }).then(res => renderUpdates(res.updates||[], 'updates-full', 0)).catch(()=>{});
}

// ===== FESTIVALS =====
function renderFestivals(festivals) {
  const el = document.getElementById('festivals-list'); if (!el) return;
  el.innerHTML = '';
  if (!festivals.length) { el.innerHTML = '<p style="color:var(--muted)">No upcoming festivals.</p>'; return; }
  festivals.forEach(f => {
    el.innerHTML += `<div class="festival-card"><h4>${f.Name||''}</h4><p>📅 ${f.Date||''}</p></div>`;
  });
}

// ===== PHOTOS =====
function renderPhotosPage() {
  const el = document.getElementById('photos-grid'); if (!el) return;
  el.innerHTML = '';
  apiCall({ action: 'getPhotos' }).then(res => {
    const photos = res.photos || [];
    if (!photos.length) { el.innerHTML = '<p style="padding:2rem;color:var(--muted)">No photos uploaded yet.</p>'; return; }
    photos.forEach(p => {
      const div = document.createElement('div');
      div.className = 'photo-thumb';
      div.innerHTML = `<img src="${p.url}" alt="${p.caption||''}" loading="lazy" onclick="openLightbox('${p.url}','${p.caption||''}')" />`;
      el.appendChild(div);
    });
  }).catch(() => { el.innerHTML = '<p style="padding:2rem;color:var(--muted)">Could not load photos.</p>'; });
}
function openLightbox(url, caption) {
  document.getElementById('lb-img').src = url;
  document.getElementById('lb-caption').textContent = caption;
  document.getElementById('lightbox').classList.remove('hidden');
}
function closeLightbox() { document.getElementById('lightbox').classList.add('hidden'); }

// ===== CONTACT =====
function renderContactPage() {
  const s = siteSettings;
  setText('contact-address', s.Address||'');
  setText('contact-phone', s.Phone||'');
  setText('contact-email', s.Email||'');
  setText('contact-whatsapp', s.WhatsApp||'');
}

// ===== DASHBOARD =====
async function loadDashboard() {
  try {
    const res = await apiCall({ action: 'getDashboard' });
    if (res.success) {
      setText('stat-today', '₹' + fmt(res.todayTotal||0));
      setText('stat-month', '₹' + fmt(res.monthTotal||0));
      setText('stat-total', '₹' + fmt(res.grandTotal||0));
      setText('stat-expense', '₹' + fmt(res.totalExpense||0));
      setText('stat-balance', '₹' + fmt((res.grandTotal||0)-(res.totalExpense||0)));
      renderRecentTxn(res.recent||[]);
    }
  } catch(e) { console.error(e); }
}
function renderRecentTxn(txns) {
  const tbody = document.getElementById('recent-txn-body'); tbody.innerHTML = '';
  if (!txns.length) { tbody.innerHTML = '<tr><td colspan="6" class="loading-td">No transactions yet.</td></tr>'; return; }
  txns.forEach(t => {
    tbody.innerHTML += `<tr><td>${t.ReceiptNo||''}</td><td>${t.Date||''}</td><td>${t.Name||''}</td><td>${t.Category||''}</td><td>₹${fmt(t.Amount||0)}</td><td>${t.PaymentType||''}</td></tr>`;
  });
}

// ===== FINANCE =====
async function prepareFinanceForm() {
  setTodayDate();
  try {
    const res = await apiCall({ action: 'getNextReceipt' });
    if (res.receiptNo) document.getElementById('f-receipt').value = res.receiptNo;
  } catch(e) {}
  fillDropdown('f-category', masterCategories.length ? masterCategories : await fetchCategories());
  fillDropdown('f-payment', masterPayments.length ? masterPayments : await fetchPayments());
  document.getElementById('receipt-box').classList.add('hidden');
  document.getElementById('send-wa-btn').classList.add('hidden');
  document.getElementById('finance-msg').classList.add('hidden');
}
async function fetchCategories() { try { const r = await apiCall({action:'getCategories'}); return r.categories||[]; } catch(e){return[];} }
async function fetchPayments() { try { const r = await apiCall({action:'getPaymentTypes'}); return r.payments||[]; } catch(e){return[];} }

function fillDropdown(id, items) {
  const sel = document.getElementById(id); if (!sel) return;
  const first = sel.options[0]; sel.innerHTML = ''; sel.appendChild(first);
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = typeof item === 'string' ? item : item.Name || item;
    opt.textContent = opt.value;
    sel.appendChild(opt);
  });
}

async function saveFinance() {
  const date = document.getElementById('f-date').value;
  const name = document.getElementById('f-name').value.trim();
  const area = document.getElementById('f-area').value.trim();
  const category = document.getElementById('f-category').value;
  const amount = parseFloat(document.getElementById('f-amount').value)||0;
  const payment = document.getElementById('f-payment').value;
  const whatsapp = document.getElementById('f-whatsapp').value.trim();
  const remarks = document.getElementById('f-remarks').value.trim();
  const receipt = document.getElementById('f-receipt').value;

  if (!date||!name||!category||!amount||!payment) { showFinanceMsg('Please fill all required fields (*).','error'); return; }

  try {
    const res = await apiCall({ action:'saveTransaction', Date:date, Name:name, Area:area, Category:category, Amount:amount, PaymentType:payment, WhatsApp:whatsapp, Remarks:remarks, ReceiptNo:receipt, EnteredBy:currentUser.username });
    if (res.success) {
      showFinanceMsg('Transaction saved successfully!','success');
      fillReceipt({date,name,category,amount,payment,receipt});
      document.getElementById('receipt-box').classList.remove('hidden');
      if (whatsapp && whatsapp.length===10) {
        document.getElementById('send-wa-btn').classList.remove('hidden');
        document.getElementById('send-wa-btn').dataset.wa = whatsapp;
        document.getElementById('send-wa-btn').dataset.msg = buildWAMessage(receipt,amount,date,name);
      }
      setTimeout(()=>prepareFinanceForm(),500);
    } else { showFinanceMsg(res.message||'Save failed.','error'); }
  } catch(e) { showFinanceMsg('Network error. Please try again.','error'); }
}

function fillReceipt(d) {
  setText('r-temple', siteSettings.TempleName||CONFIG.TEMPLE_NAME);
  setText('r-no', d.receipt); setText('r-date', d.date); setText('r-name', d.name);
  setText('r-cat', d.category); setText('r-amount', '₹'+fmt(d.amount));
  setText('r-pay', d.payment); setText('r-by', currentUser.username);
}
function buildWAMessage(receipt, amount, date, name) {
  return `🙏 ${siteSettings.TempleName||CONFIG.TEMPLE_NAME}\nThank you for your valuable contribution.\nReceipt No : ${receipt}\nAmount : ₹${fmt(amount)}\nDate : ${date}\nMay God Bless You. 🙏`;
}
function sendWhatsApp() {
  const btn = document.getElementById('send-wa-btn');
  window.open(`https://wa.me/91${btn.dataset.wa}?text=${encodeURIComponent(btn.dataset.msg)}`,'_blank');
}
function resetFinance() {
  ['f-name','f-area','f-amount','f-whatsapp','f-remarks'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['f-category','f-payment'].forEach(id=>{const el=document.getElementById(id);if(el)el.selectedIndex=0;});
  document.getElementById('receipt-box').classList.add('hidden');
  document.getElementById('send-wa-btn').classList.add('hidden');
  document.getElementById('finance-msg').classList.add('hidden');
}
function showFinanceMsg(msg, type) {
  const el = document.getElementById('finance-msg');
  el.textContent = msg; el.className = type==='error'?'alert-error':'alert-success';
  el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),5000);
}
function printReceipt() { window.print(); }

// ===== TRANSACTIONS =====
async function loadTransactions() {
  const tbody = document.getElementById('txn-body');
  tbody.innerHTML = '<tr><td colspan="11" class="loading-td">Loading...</td></tr>';
  try {
    const res = await apiCall({ action:'getTransactions' });
    allTransactions = res.transactions||[];
    renderTransactionTable(allTransactions);
    fillFilterDropdowns();
  } catch(e) { tbody.innerHTML = '<tr><td colspan="11" class="loading-td">Could not load transactions.</td></tr>'; }
}
function fillFilterDropdowns() {
  const catSel = document.getElementById('filter-cat');
  const paySel = document.getElementById('filter-pay');
  masterCategories.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;catSel.appendChild(o);});
  masterPayments.forEach(p=>{const o=document.createElement('option');o.value=p;o.textContent=p;paySel.appendChild(o);});
}
function renderTransactionTable(data) {
  const tbody = document.getElementById('txn-body');
  const start = (txnPage-1)*TXN_PER_PAGE;
  const page = data.slice(start, start+TXN_PER_PAGE);
  tbody.innerHTML = '';
  if (!page.length) { tbody.innerHTML='<tr><td colspan="11" class="loading-td">No records found.</td></tr>'; return; }
  page.forEach((t,i)=>{
    const isLast = i===0 && txnPage===1;
    tbody.innerHTML += `<tr><td>${t.ReceiptNo||''}</td><td>${t.Date||''}</td><td>${t.Name||''}</td><td>${t.Area||''}</td><td>${t.Category||''}</td><td>₹${fmt(t.Amount||0)}</td><td>${t.PaymentType||''}</td><td>${t.WhatsApp||''}</td><td>${t.Remarks||''}</td><td>${t.EnteredBy||''}</td><td>${isLast?'<button class="btn-outline" style="padding:0.3rem 0.6rem;font-size:0.78rem" onclick="editLastTxn()">Edit</button>':''}</td></tr>`;
  });
  renderPagination(data.length);
}
function renderPagination(total) {
  const pages = Math.ceil(total/TXN_PER_PAGE);
  const el = document.getElementById('txn-pagination'); el.innerHTML='';
  for(let i=1;i<=pages;i++){
    const btn=document.createElement('button');
    btn.className='page-btn'+(i===txnPage?' active':'');
    btn.textContent=i; btn.onclick=()=>{txnPage=i;renderTransactionTable(allTransactions);};
    el.appendChild(btn);
  }
}
function applyFilters() {
  const from=document.getElementById('filter-from').value;
  const to=document.getElementById('filter-to').value;
  const name=document.getElementById('filter-name').value.toLowerCase();
  const cat=document.getElementById('filter-cat').value;
  const pay=document.getElementById('filter-pay').value;
  txnPage=1;
  const filtered=allTransactions.filter(t=>{
    if(from&&t.Date<from)return false;
    if(to&&t.Date>to)return false;
    if(name&&!(t.Name||'').toLowerCase().includes(name))return false;
    if(cat&&t.Category!==cat)return false;
    if(pay&&t.PaymentType!==pay)return false;
    return true;
  });
  renderTransactionTable(filtered);
}
function clearFilters() {
  ['filter-from','filter-to','filter-name'].forEach(id=>document.getElementById(id).value='');
  ['filter-cat','filter-pay'].forEach(id=>document.getElementById(id).selectedIndex=0);
  txnPage=1; renderTransactionTable(allTransactions);
}
function editLastTxn() { showPage('finance'); showToast('Edit mode: modify and save again.'); }

// ===== REPORTS =====
async function generateReport(type) {
  currentReportType = type;
  document.getElementById('report-output').classList.remove('hidden');
  const head=document.getElementById('report-head');
  const body=document.getElementById('report-body');
  head.innerHTML='<tr><td colspan="5" class="loading-td">Generating report...</td></tr>'; body.innerHTML='';
  try {
    const res = await apiCall({ action:'getReport', reportType:type });
    if(res.success){
      reportData=res.data||[];
      const cols=res.columns||[];
      head.innerHTML='<tr>'+cols.map(c=>`<th>${c}</th>`).join('')+'</tr>';
      body.innerHTML='';
      reportData.forEach(row=>{ body.innerHTML+='<tr>'+cols.map(c=>`<td>${row[c]||''}</td>`).join('')+'</tr>'; });
    }
  } catch(e) { head.innerHTML='<tr><td class="loading-td">Error loading report.</td></tr>'; }
  document.getElementById('report-output').scrollIntoView({behavior:'smooth'});
}
function downloadExcel() {
  if(!reportData.length)return;
  const cols=Object.keys(reportData[0]);
  let csv=cols.join(',')+'\n';
  reportData.forEach(r=>{csv+=cols.map(c=>`"${r[c]||''}"`).join(',')+'\n';});
  downloadFile(csv,`report_${currentReportType}_${today()}.csv`,'text/csv');
}
function downloadPDF() { window.print(); }

// ===== USERS =====
async function loadUsers() {
  const tbody=document.getElementById('users-body');
  tbody.innerHTML='<tr><td colspan="4" class="loading-td">Loading...</td></tr>';
  try {
    const res=await apiCall({action:'getUsers'});
    allUsers=res.users||[]; tbody.innerHTML='';
    allUsers.forEach((u,i)=>{
      tbody.innerHTML+=`<tr><td>${u.Username||''}</td><td>${u.Role||''}</td><td><span class="status-badge ${u.Status==='active'?'green':'red'}">${u.Status||''}</span></td><td><button class="btn-outline" style="font-size:0.78rem;padding:0.3rem 0.6rem" onclick="openUserModal(${i})">Edit</button> <button class="btn-outline" style="font-size:0.78rem;padding:0.3rem 0.6rem;margin-left:4px" onclick="deleteUser(${i})">Delete</button></td></tr>`;
    });
  } catch(e) { tbody.innerHTML='<tr><td colspan="4" class="loading-td">Error loading users.</td></tr>'; }
}
function openUserModal(idx) {
  document.getElementById('user-modal').classList.remove('hidden');
  if(idx!==undefined && allUsers[idx]){
    const u=allUsers[idx];
    document.getElementById('user-modal-title').textContent='Edit User';
    document.getElementById('um-index').value=idx;
    document.getElementById('um-username').value=u.Username||'';
    document.getElementById('um-password').value='';
    document.getElementById('um-role').value=u.Role||'user';
    document.getElementById('um-status').value=u.Status||'active';
  } else {
    document.getElementById('user-modal-title').textContent='Add User';
    document.getElementById('um-index').value='';
    ['um-username','um-password'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('um-role').value='user';
    document.getElementById('um-status').value='active';
  }
}
async function saveUser() {
  const username=document.getElementById('um-username').value.trim();
  const password=document.getElementById('um-password').value;
  const role=document.getElementById('um-role').value;
  const status=document.getElementById('um-status').value;
  const idx=document.getElementById('um-index').value;
  if(!username){showToast('Username required.');return;}
  try {
    const res=await apiCall({action:'saveUser',username,password,role,status,index:idx});
    if(res.success){closeModal('user-modal');showToast('User saved!');loadUsers();}
    else showToast(res.message||'Save failed.');
  } catch(e){showToast('Network error.');}
}
async function deleteUser(idx) {
  if(!confirm('Delete this user?'))return;
  const u=allUsers[idx];
  try {
    const res=await apiCall({action:'deleteUser',username:u.Username});
    if(res.success){showToast('User deleted.');loadUsers();}
  } catch(e){showToast('Error deleting user.');}
}

// ===== MASTER SETTINGS =====
async function loadMasterSettings() {
  try {
    const res=await apiCall({action:'getMasterData'});
    masterCategories=res.categories||[]; masterPayments=res.payments||[];
    renderMasterList('cat-list',masterCategories,'Categories');
    renderMasterList('pay-list',masterPayments,'PaymentTypes');
  } catch(e){}
}
function renderMasterList(listId,items,sheet) {
  const el=document.getElementById(listId); el.innerHTML='';
  items.forEach(item=>{
    el.innerHTML+=`<li>${item} <button onclick="deleteMasterItem('${sheet}','${item}','${listId}')"><i class="fas fa-trash"></i></button></li>`;
  });
}
async function addMasterItem(sheet,inputId,listId) {
  const val=document.getElementById(inputId).value.trim(); if(!val)return;
  try {
    const res=await apiCall({action:'addMasterItem',sheet,value:val});
    if(res.success){document.getElementById(inputId).value='';showToast('Added!');loadMasterSettings();}
  } catch(e){showToast('Error.');}
}
async function deleteMasterItem(sheet,value,listId) {
  if(!confirm(`Remove "${value}"?`))return;
  try {
    const res=await apiCall({action:'deleteMasterItem',sheet,value});
    if(res.success){showToast('Removed.');loadMasterSettings();}
  } catch(e){showToast('Error.');}
}

// ===== PERMISSIONS =====
async function loadPermissions() {
  const tbody=document.getElementById('perm-body');
  tbody.innerHTML='<tr><td colspan="6" class="loading-td">Loading...</td></tr>';
  try {
    const res=await apiCall({action:'getPermissions'});
    allPermissions={}; const perms=res.permissions||[]; tbody.innerHTML='';
    perms.forEach(p=>{
      allPermissions[p.Username]=p;
      tbody.innerHTML+=`<tr><td>${p.Username}</td>${['HomeEdit','Finance','Reports','Downloads'].map(key=>`<td><select onchange="updatePerm('${p.Username}','${key}',this.value)"><option value="Yes" ${p[key]==='Yes'?'selected':''}>Yes</option><option value="No" ${p[key]==='No'?'selected':''}>No</option></select></td>`).join('')}<td><button class="btn-gold" style="font-size:0.78rem;padding:0.35rem 0.65rem" onclick="savePerm('${p.Username}')">Save</button></td></tr>`;
    });
  } catch(e){ tbody.innerHTML='<tr><td colspan="6" class="loading-td">Error.</td></tr>'; }
}
function updatePerm(username,key,val) { if(allPermissions[username])allPermissions[username][key]=val; }
async function savePerm(username) {
  const p=allPermissions[username];
  try { const res=await apiCall({action:'savePermission',...p}); if(res.success)showToast('Permission saved!'); }
  catch(e){showToast('Error saving.');}
}

// ===== EDIT HOME PAGE =====
async function loadHomepageEditForm() {
  try {
    const res=await apiCall({action:'getSettings'});
    const s=res.settings||{};
    const fields={'he-name':s.TempleName,'he-tagline':s.Tagline,'he-timings':s.Timings,'he-address':s.Address,'he-phone':s.Phone,'he-email':s.Email,'he-whatsapp':s.WhatsApp,'he-mapurl':s.MapURL,'he-logo':s.LogoURL,'he-upi':s.DonationUPI,'he-qr':s.QRCodeURL,'he-upd1':s.Update1,'he-upd2':s.Update2,'he-upd3':s.Update3,'he-fes1':s.Festival1,'he-fes2':s.Festival2,'he-p1':s.Photo1,'he-p2':s.Photo2,'he-p3':s.Photo3,'he-s1':s.Slider1,'he-s2':s.Slider2};
    Object.entries(fields).forEach(([id,val])=>{ const el=document.getElementById(id); if(el&&val!==undefined)el.value=val; });
  } catch(e){}
}
async function saveHomePage() {
  const fields={TempleName:'he-name',Tagline:'he-tagline',Timings:'he-timings',Address:'he-address',Phone:'he-phone',Email:'he-email',WhatsApp:'he-whatsapp',MapURL:'he-mapurl',LogoURL:'he-logo',DonationUPI:'he-upi',QRCodeURL:'he-qr',Update1:'he-upd1',Update2:'he-upd2',Update3:'he-upd3',Festival1:'he-fes1',Festival2:'he-fes2',Photo1:'he-p1',Photo2:'he-p2',Photo3:'he-p3',Slider1:'he-s1',Slider2:'he-s2'};
  const data={action:'saveSettings'};
  Object.entries(fields).forEach(([key,id])=>{ const el=document.getElementById(id); if(el)data[key]=el.value; });
  try {
    const res=await apiCall(data);
    const msgEl=document.getElementById('he-msg');
    if(res.success){ msgEl.className='alert-success'; msgEl.textContent='Settings saved! Reload to see changes.'; msgEl.classList.remove('hidden'); loadPublicData(); }
    else{ msgEl.className='alert-error'; msgEl.textContent=res.message||'Save failed.'; msgEl.classList.remove('hidden'); }
  } catch(e){ showToast('Network error.'); }
}

// ===== MOCK RESPONSES (Demo mode) =====
function mockResponse(payload) {
  const { action } = payload;
  if(action==='login'){
    if(payload.username==='admin'&&payload.password==='admin123') return {success:true,username:'admin',role:'admin',permissions:{HomeEdit:'Yes',Finance:'Yes',Reports:'Yes',Downloads:'Yes'}};
    if(payload.username==='user1'&&payload.password==='user123') return {success:true,username:'user1',role:'user',permissions:{HomeEdit:'No',Finance:'Yes',Reports:'Yes',Downloads:'No'}};
    return {success:false,message:'Invalid credentials. Try admin/admin123'};
  }
  if(action==='getPublicData') return {success:true,settings:{TempleName:CONFIG.TEMPLE_NAME,Tagline:CONFIG.TEMPLE_TAGLINE,Timings:'Morning 6:00 AM – 12:00 PM | Evening 4:00 PM – 8:00 PM',Address:'123 Temple Street, Tamil Nadu – 600001',Phone:'+91 98765 43210',Email:'temple@example.com',WhatsApp:'9876543210',MapURL:'',LogoURL:'',DonationUPI:'temple@upi',QRCodeURL:''},updates:[{Title:'Renovation Work',Content:'Main hall renovation in progress.',Date:'20 Jun 2026'},{Title:'Annadhanam Notice',Content:'Free food every Sunday 11 AM.',Date:'15 Jun 2026'}],festivals:[{Name:'Aadi Perukku',Date:'3 Aug 2026'},{Name:'Vinayaka Chaturthi',Date:'22 Aug 2026'}],sliders:[],categories:['Donation','Interest','Festival','Annadhanam','Building Fund','Temple Maintenance'],payments:['Cash','UPI','Google Pay','PhonePe','Bank Transfer']};
  if(action==='getDashboard') return {success:true,todayTotal:12500,monthTotal:87000,grandTotal:534000,totalExpense:215000,recent:[{ReceiptNo:'TR000012',Date:'2026-06-27',Name:'Rajan',Category:'Donation',Amount:1000,PaymentType:'UPI'},{ReceiptNo:'TR000011',Date:'2026-06-27',Name:'Sundar',Category:'Festival',Amount:500,PaymentType:'Cash'}]};
  if(action==='getNextReceipt') return {receiptNo:CONFIG.RECEIPT_PREFIX+String(Math.floor(Math.random()*1000)+100).padStart(6,'0')};
  if(action==='getCategories') return {categories:['Donation','Interest','Festival','Annadhanam','Building Fund','Temple Maintenance']};
  if(action==='getPaymentTypes') return {payments:['Cash','UPI','Google Pay','PhonePe','Bank Transfer']};
  if(action==='saveTransaction') return {success:true};
  if(action==='getTransactions'){const txns=[];for(let i=20;i>=1;i--)txns.push({ReceiptNo:`TR${String(i).padStart(6,'0')}`,Date:'2026-06-'+(i<10?'0'+i:i),Name:['Rajan','Sundar','Priya','Kumar','Meena'][i%5],Area:['Chennai','Madurai','Coimbatore'][i%3],Category:['Donation','Festival','Building Fund'][i%3],Amount:(i*100)+'',PaymentType:['Cash','UPI','Google Pay'][i%3],WhatsApp:'',Remarks:'',EnteredBy:'admin'});return {success:true,transactions:txns};}
  if(action==='getReport'){const data=[{Category:'Donation',Total:'₹45,000',Count:23},{Category:'Festival',Total:'₹18,000',Count:12},{Category:'Building Fund',Total:'₹24,000',Count:8}];return {success:true,data,columns:Object.keys(data[0])};}
  if(action==='getUsers') return {success:true,users:[{Username:'admin',Role:'admin',Status:'active'},{Username:'user1',Role:'user',Status:'active'}]};
  if(action==='saveUser'||action==='deleteUser') return {success:true};
  if(action==='getMasterData') return {success:true,categories:['Donation','Interest','Festival','Annadhanam','Building Fund','Temple Maintenance'],payments:['Cash','UPI','Google Pay','PhonePe','Bank Transfer']};
  if(action==='addMasterItem'||action==='deleteMasterItem') return {success:true};
  if(action==='getPermissions') return {success:true,permissions:[{Username:'user1',HomeEdit:'No',Finance:'Yes',Reports:'Yes',Downloads:'No'}]};
  if(action==='savePermission') return {success:true};
  if(action==='getSettings') return {success:true,settings:{TempleName:CONFIG.TEMPLE_NAME,Tagline:CONFIG.TEMPLE_TAGLINE,Timings:'Morning 6:00 AM – 12:00 PM | Evening 4:00 PM – 8:00 PM',Address:'123 Temple Street, Tamil Nadu – 600001',Phone:'+91 98765 43210',Email:'temple@example.com',WhatsApp:'9876543210'}};
  if(action==='saveSettings') return {success:true};
  if(action==='getPhotos') return {success:true,photos:[{url:'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Meenakshi_amman_temple.jpg/320px-Meenakshi_amman_temple.jpg',caption:'Temple View'}]};
  return {success:false,message:'Unknown action'};
}

// ===== UTILITIES =====
function setText(id,val){const el=document.getElementById(id);if(el)el.textContent=val||'';}
function fmt(n){return Number(n).toLocaleString('en-IN');}
function today(){return new Date().toISOString().slice(0,10);}
function setTodayDate(){const el=document.getElementById('f-date');if(el)el.value=today();}
function togglePass(id,icon){const el=document.getElementById(id);if(el.type==='password'){el.type='text';icon.innerHTML='<i class="fas fa-eye-slash"></i>';}else{el.type='password';icon.innerHTML='<i class="fas fa-eye"></i>';}}
function closeModal(id){document.getElementById(id).classList.add('hidden');}
function showToast(msg,dur=3000){const t=document.getElementById('toast');t.textContent=msg;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),dur);}
function downloadFile(content,filename,mime){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:mime}));a.download=filename;a.click();}
