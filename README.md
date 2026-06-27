# 🛕 Temple Management System

A **100% free** temple website with finance management, built using:
- **Frontend**: HTML + CSS + JavaScript (GitHub Pages hosting)
- **Backend**: Google Apps Script
- **Database**: Google Sheets

---

## 📁 Files

| File | Purpose |
|---|---|
| `index.html` | Main website (all pages) |
| `style.css` | Responsive design (mobile + laptop) |
| `script.js` | All frontend logic |
| `config.js` | ✏️ Your settings (edit this first!) |
| `Code.gs` | Google Apps Script backend (paste in Apps Script) |

---

## 🚀 Setup Steps

### STEP 1 — Create Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) → New sheet
2. Name it: `Temple Management`
3. Create these tabs (sheets) with exact names:

| Sheet Name | Columns (Row 1 headers) |
|---|---|
| `Users` | Username, Password, Role, Status |
| `Permissions` | Username, HomeEdit, Finance, Reports, Downloads |
| `Transactions` | ReceiptNo, Date, Name, Area, Category, Amount, PaymentType, WhatsApp, Remarks, EnteredBy, Timestamp |
| `Categories` | Name |
| `PaymentTypes` | Name |
| `HomePage` | Type, Title, Content, Date |
| `Photos` | URL, Caption, Type |
| `Settings` | Key, Value |

4. Fill `Users` sheet with first row:
   - `admin` | `admin123` | `admin` | `active`

5. Fill `Categories` sheet:
   - Donation, Interest, Festival, Annadhanam, Building Fund, Temple Maintenance

6. Fill `PaymentTypes` sheet:
   - Cash, UPI, Google Pay, PhonePe, Bank Transfer

7. Fill `Settings` sheet:
   | Key | Value |
   |---|---|
   | TempleName | Your Temple Name |
   | Tagline | Your tagline |
   | Timings | Morning 6–12 \| Evening 4–8 |
   | Address | Your address |
   | Phone | Your phone |
   | Email | Your email |

---

### STEP 2 — Google Apps Script

1. In your Google Sheet → `Extensions` → `Apps Script`
2. Delete the default code
3. Paste the entire contents of `Code.gs`
4. Click **Save** (disk icon)
5. Click **Deploy** → **New deployment**
6. Settings:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy** → **Authorize** → **Allow**
8. Copy the **Web App URL** (looks like `https://script.google.com/macros/s/ABC.../exec`)

---

### STEP 3 — Update config.js

Open `config.js` and paste your URL:

```js
SCRIPT_URL: "https://script.google.com/macros/s/YOUR_ACTUAL_URL/exec",
TEMPLE_NAME: "Sri Murugan Temple",
```

---

### STEP 4 — Upload to GitHub

1. Create account at [github.com](https://github.com)
2. New Repository → name: `temple-website` → Public
3. Upload all 4 files: `index.html`, `style.css`, `script.js`, `config.js`
4. Settings → Pages → Branch: `main` → Save
5. Your site: `https://YOUR-USERNAME.github.io/temple-website/`

---

## 🔐 Default Login (Demo Mode)

Before connecting Apps Script, use these demo credentials:

| Username | Password | Role |
|---|---|---|
| admin | admin123 | Admin |
| user1 | user123 | User |

---

## 📱 Responsive Design

- ✅ Mobile (portrait & landscape)
- ✅ Tablet
- ✅ Laptop / Desktop
- ✅ Auto-adjusting layout

---

## 💡 WhatsApp Integration

After saving a transaction:
1. If WhatsApp number is entered → **Send Receipt** button appears
2. Click → Opens WhatsApp Web with pre-filled message
3. User clicks Send

For automated WhatsApp (Twilio), add Twilio integration in `Code.gs`.

---

## 🆓 Cost Summary

| Service | Cost |
|---|---|
| Google Sheets | Free |
| Google Apps Script | Free |
| GitHub | Free |
| GitHub Pages | Free |
| **Total** | **₹0** |
