# Kabir Publication – Book Order & WhatsApp Management System

A fast, professional, mobile-friendly Book Order + Shipping Label + Customer WhatsApp Communication Management System built specifically for **Kabir Publication**.

---

## 🔐 Login Credentials (Admin Access)

The website is protected with a secure Admin Login Gate before anyone can access the dashboard or order data:

- **Username**: `admin`
- **Password**: `admin@123`

Features include session persistence, "Remember on this laptop" option, show/hide password toggle, and Logout buttons in both the header and sidebar.

---

## 🌟 Key Features

1. **Brand & Identity**:
   - Official Kabir Publication branding and logo.
   - Clean, professional admin UI with white cards, light grey background (`#f8fafc`), and professional indigo/purple theme (`#4f46e5`).
   - Fully responsive on Desktop, Tablet, and Mobile devices.

2. **Main Dashboard & 10 Interactive Stat Cards**:
   - Total Orders
   - Packed
   - Shipped
   - Delivered
   - Returned
   - Cancelled
   - COD Pending
   - Paid Orders
   - WhatsApp Pending
   - WhatsApp Sent
   - *Every single card is clickable* and instantly opens the corresponding filtered order registry.
   - Real-time financial counters: Total COD Value, Pending COD, and Paid/Collected Value.

3. **Order Management & Registry**:
   - Full order lifecycle: `Packed → Shipped → Delivered → Returned / Cancelled`.
   - Desktop responsive data table with row selection, sorting, quick status changer, tracking copy, address modal, and WhatsApp trigger.
   - Mobile card view that automatically optimizes table rows into cards on phone screens.
   - Global instant search across 7 key fields: Customer Name, Mobile Number, Book Title, Tracking ID, Order ID, PIN Code, and City.
   - Multi-criteria filter bar: Order Status, Payment Status, WhatsApp Message Status, and Date Range (Today, Yesterday, Last 7 Days, Last 30 Days, Custom Date Range).

4. **Customer Address System**:
   - Clean, isolated customer address modal ("View Address").
   - One-click "Copy Address" button formatted for shipping labels and postal dispatch.

5. **Shipping Label PDF Import Engine**:
   - Upload single or multiple PDF shipping labels (India Post Speed Post, BNPL, Delhivery, etc.).
   - Client-side extraction via Mozilla `PDF.js`: Customer Name, Mobile Number, Full Address, City, State, 6-digit PIN Code, Tracking ID, COD Amount, and Book Name.
   - Automatic duplicate checking by Tracking ID and Customer Name + Mobile + PIN.
   - Imports automatically into `Status = Packed` and `WhatsApp Status = Message Pending`.
   - Summary breakdown: Successfully Imported, Duplicates, Failed, and OCR Required.

6. **Shipping Label Generator (Thermal 4x6 / A6 / A4)**:
   - Real-time barcode generation using `JsBarcode` (Code128).
   - Dynamic QR code generation using `QRCode.js` linking directly to courier shipment tracking URL.
   - Sender details pre-configured for Kabir Publication (Satlok Ashram, Barwala, Hisar, Haryana - 125121, Helpline: 9413508833).
   - Direct browser print engine (`@media print`) and PDF download.

7. **WhatsApp Messaging Engine**:
   - Automatic personalized dispatch notification generator in Hindi/Hinglish.
   - Pre-configured default business helpline: `9413508833`.
   - Courier tracking URL resolution (India Post, Delhivery, Blue Dart, DTDC, or custom).
   - Validation for 10-digit Indian mobile numbers and Tracking ID presence.
   - Seamless deep-linking via `wa.me/91...` and automatic update to `Message Sent`.
   - Template editor with variable insertion chips (`{{name}}`, `{{mobile}}`, `{{book}}`, `{{tracking}}`, `{{tracking_link}}`, `{{cod}}`, `{{order_id}}`, `{{date}}`) and live preview modal.
   - Meta WhatsApp Cloud API backend mode for automated sending without manual clicks.

8. **WhatsApp Bulk Send Queue**:
   - Dedicated "WhatsApp Messages" page.
   - Select All, Select Pending, and Send Selected.
   - Confirmation dialog and queue processor with status monitoring (Pending → Ready → Opened → Sent → Failed).

9. **Reports & Analytics**:
   - Distribution analytics across custom date ranges.
   - Literature dispatched breakdown (Gyan Ganga, Jeene Ki Raah, Geeta Tera Gyan Amrit, etc.).
   - Courier distribution breakdown.
   - One-click Export Report Summary CSV and Print.

10. **Data Persistence & Backend-Ready Architecture**:
    - Dual persistence layer: works 100% locally via browser `localStorage` AND automatically synchronizes with Node.js/Express REST API backend when active.
    - Full CSV export (`kabir-publication-orders.csv`) and CSV import.
    - JSON backup and restore with safe confirmation dialogs.

11. **Progressive Web App (PWA)**:
    - Web App Manifest (`manifest.json`) and Service Worker (`sw.js`).
    - Works offline and can be installed directly to mobile and desktop home screens ("Install App" button).

---

## 🚀 How to Run Locally

### Option 1: Express Server (Full REST API + Static Hosting)
```bash
npm install
npm start
```
Open your browser at:
`http://localhost:3000`

### Option 2: Direct Browser / Static File (Offline Mode)
Simply double-click `index.html` or host on any static web server (GitHub Pages, Vercel, Netlify). The application will automatically detect offline mode and use `localStorage`.

---

## 📁 File Structure

```
Kabir Publication/
├── index.html           # Master application interface
├── manifest.json         # PWA Manifest configuration
├── sw.js                 # Service Worker for offline caching
├── server.js             # Node.js + Express backend REST API
├── package.json          # Node dependencies and npm scripts
├── logo.png              # Official Kabir Publication brand logo
├── logo.jpeg             # Alternative brand graphic
├── icon-192.png          # PWA 192x192 app icon
├── icon-512.png          # PWA 512x512 app icon
├── favicon.png           # Browser tab icon
├── css/
│   └── styles.css        # Clean, modern admin stylesheet & print rules
└── js/
    ├── storage.js        # Reusable data storage abstraction (localStorage & API)
    ├── whatsapp.js       # WhatsApp template, deep-link & bulk queue engine
    ├── pdf-importer.js   # PDF.js extraction & order auto-creation engine
    ├── label-generator.js# Thermal 4x6 / A6 label generator with Barcode & QR
    ├── reports.js        # Analytics calculation and CSV import/export
    └── app.js            # Core UI controller, search, filters & modal handlers
```

---

## 🔒 Security & WhatsApp Cloud API Configuration
For true automated background sending, configure the following in your environment variables or `server.js`:
```env
WHATSAPP_ACCESS_TOKEN=your_meta_system_user_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_API_VERSION=v19.0
```
These credentials are kept securely on the server and are never exposed to frontend client code.
