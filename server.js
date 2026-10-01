/**
 * Kabir Publication - Express Backend API Server
 * Provides RESTful order management, settings persistence, and secure WhatsApp Cloud API dispatcher.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Data directory
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data and backups folders exist
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Middleware: Enhanced CORS & Chrome/Edge Private Network Access
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Middleware: Disable browser caching on all API responses so devices always get fresh data
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// ==========================================
// REAL-TIME MULTI-DEVICE SYNC ENGINE
// ==========================================

// Helper: Get all active local IPv4 addresses (Wi-Fi, LAN)
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

// Active SSE sync clients
const syncClients = new Set();
let syncVersion = Date.now();
let lastSettingsUpdate = Date.now();
let lastOrdersUpdate = Date.now();

function broadcastSync(event) {
  syncVersion = Date.now();
  if (event.type && event.type.includes('settings')) {
    lastSettingsUpdate = syncVersion;
  }
  if (event.type && event.type.includes('order')) {
    lastOrdersUpdate = syncVersion;
  }

  const payload = JSON.stringify({
    ...event,
    version: syncVersion,
    timestamp: new Date().toISOString()
  });

  for (const client of syncClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (e) {
      syncClients.delete(client);
    }
  }
}

// Default Settings
const DEFAULT_SETTINGS = {
  businessName: 'Kabir Publication',
  businessSubtitle: 'Book Order Management System',
  businessWhatsApp: '9413508833',
  senderAddress: 'Kabir Publication, Satlok Ashram, Barwala (Hisar), Haryana - 125121',
  senderPhone: '9413508833',
  whatsappMode: 'manual',
  cloudApiToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  cloudApiPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  cloudApiBusinessId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  cloudApiVersion: process.env.WHATSAPP_API_VERSION || 'v19.0',
  defaultStatus: 'Packed',
  defaultPayment: 'COD',
  books: [
    'Gyan Ganga',
    'Jeene Ki Raah',
    'Geeta Tera Gyan Amrit',
    'Bhakti Se Bhagwan Tak',
    'Dharm Bodh',
    'Andh Shradha Bhakti Khatra-e-Jaan',
    'Kabir Sahib Vaani'
  ],
  defaultBook: 'Gyan Ganga',
  couriers: [
    { name: 'India Post', urlTemplate: 'https://www.indiapost.gov.in/' },
    { name: 'Delhivery', urlTemplate: 'https://www.delhivery.com/track/package/{{tracking}}' },
    { name: 'Blue Dart', urlTemplate: 'https://www.bluedart.com/tracking?handler=tnt&action=custfindbox&tracktype=awb&trackid={{tracking}}' },
    { name: 'DTDC', urlTemplate: 'https://www.dtdc.in/tracking/shipment-tracking.asp?trkid={{tracking}}' },
    { name: 'Other', urlTemplate: 'https://www.google.com/search?q={{courier}}+tracking+{{tracking}}' }
  ],
  whatsappTemplate: 
`📦 Kabir Publication – Order Dispatched!

Namaste {{name}} ji 🙏

Aapki book {{book}} successfully dispatch ho gayi hai. 🎉

📚 Book: {{book}}

🚚 Tracking ID (Tap to Copy):
\`{{tracking}}\`

🔎 Shipment Track Karein:
{{tracking_link}}

Aap upar diye gaye Tracking ID par click/tap karke copy kar sakte hain aur link se tracking status check kar sakte hain.

Aapke order ke liye Kabir Publication ko chunne ke liye dhanyavaad. ❤️

Kabir Publication 📚`
};

// ==========================================
// DATABASE ENGINE WITH ATOMIC PERSISTENCE & BACKUPS
// ==========================================

function atomicWriteJson(filePath, data) {
  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  try {
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempPath, jsonString, 'utf8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    console.error(`Atomic write failed for ${filePath}:`, err);
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
    // Direct write fallback
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (err2) {
      console.error(`Direct write fallback failed for ${filePath}:`, err2);
      return false;
    }
  }
}

let lastBackupTime = 0;
function maybeCreateBackup(orders) {
  const now = Date.now();
  if (now - lastBackupTime > 120000 && Array.isArray(orders) && orders.length > 0) {
    try {
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(BACKUPS_DIR, `orders_backup_${dateStr}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(orders, null, 2), 'utf8');
      lastBackupTime = now;
      // Retain maximum 15 rolling backups
      const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('orders_backup_')).sort();
      while (files.length > 15) {
        const oldest = files.shift();
        try { fs.unlinkSync(path.join(BACKUPS_DIR, oldest)); } catch (e) {}
      }
    } catch (e) {
      console.warn('Auto backup skipped:', e);
    }
  }
}

function readOrders() {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const data = fs.readFileSync(ORDERS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.error('Error reading orders database:', err);
    // Attempt fallback from most recent backup if main file is corrupted
    try {
      const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('orders_backup_')).sort().reverse();
      if (files.length > 0) {
        console.warn(`Recovering orders from backup: ${files[0]}`);
        const backupData = fs.readFileSync(path.join(BACKUPS_DIR, files[0]), 'utf8');
        return JSON.parse(backupData) || [];
      }
    } catch (bErr) {}
  }
  return [];
}

function writeOrders(orders, eventAction = 'updated') {
  if (!Array.isArray(orders)) orders = [];
  const success = atomicWriteJson(ORDERS_FILE, orders);
  if (success) {
    maybeCreateBackup(orders);
    broadcastSync({
      type: 'orders_updated',
      action: eventAction,
      count: orders.length
    });
    return true;
  }
  return false;
}

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(data));
    }
  } catch (err) {
    console.error('Error reading settings database:', err);
  }
  return { ...DEFAULT_SETTINGS };
}

function writeSettings(settings) {
  const merged = Object.assign({}, DEFAULT_SETTINGS, settings || {});
  const success = atomicWriteJson(SETTINGS_FILE, merged);
  if (success) {
    broadcastSync({
      type: 'settings_updated',
      settings: merged
    });
    return true;
  }
  return false;
}

// ==========================================
// REST API ENDPOINTS
// ==========================================

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUser = (username || '').toString().trim().toLowerCase();
  const cleanPass = (password || '').toString();

  if (cleanUser === 'admin' && cleanPass === 'admin@123') {
    return res.json({
      success: true,
      user: 'admin',
      token: 'kp_auth_' + Date.now(),
      message: 'Login successful'
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid username or password'
  });
});

// GET /api/orders (Authoritative Database Fetch)
app.get('/api/orders', (req, res) => {
  const orders = readOrders();
  res.json(orders);
});

// GET /api/orders/:id
app.get('/api/orders/:id', (req, res) => {
  const orders = readOrders();
  const targetId = (req.params.id || '').trim().toUpperCase();
  const order = orders.find(o => 
    (o.orderId || '').trim().toUpperCase() === targetId ||
    (o.trackingId || '').trim().toUpperCase() === targetId
  );
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

// POST /api/orders (Add or Upsert Order to Database)
app.post('/api/orders', (req, res) => {
  const orders = readOrders();
  const orderData = req.body;
  if (!orderData || typeof orderData !== 'object') {
    return res.status(400).json({ error: 'Invalid order payload' });
  }

  const cleanReqId = (orderData.orderId || '').trim();
  const cleanReqTrack = (orderData.trackingId || '').trim().toUpperCase();

  // UPSERT Check: If order with same orderId already exists in database, UPDATE IT!
  if (cleanReqId) {
    const existingIdx = orders.findIndex(o => 
      (o.orderId || '').trim().toUpperCase() === cleanReqId.toUpperCase()
    );
    if (existingIdx !== -1) {
      const updated = {
        ...orders[existingIdx],
        ...orderData,
        orderId: orders[existingIdx].orderId,
        updatedDate: new Date().toISOString()
      };
      orders[existingIdx] = updated;
      writeOrders(orders, 'updated');
      return res.json({ success: true, order: updated, updated: true });
    }
  }

  // Duplicate Check for Tracking ID (excluding current order)
  if (cleanReqTrack) {
    const duplicate = orders.find(o => 
      (o.trackingId || '').trim().toUpperCase() === cleanReqTrack
    );
    if (duplicate && !req.query.force && !req.body.force) {
      return res.status(409).json({
        error: 'Duplicate order found with same Tracking ID',
        existing: duplicate
      });
    }
  }

  // New Order Creation
  const now = new Date().toISOString();
  if (!cleanReqId) {
    const yearShort = new Date().getFullYear().toString().slice(-2);
    orderData.orderId = `KP${yearShort}-${1000 + orders.length + 1}`;
  }

  orderData.createdDate = orderData.createdDate || now;
  orderData.updatedDate = now;

  orders.unshift(orderData);
  writeOrders(orders, 'created');

  res.status(201).json({ success: true, order: orderData, created: true });
});

// PUT /api/orders/:id (Update Order in Database)
app.put('/api/orders/:id', (req, res) => {
  const orders = readOrders();
  const cleanId = (req.params.id || '').trim().toUpperCase();

  let idx = orders.findIndex(o => (o.orderId || '').trim().toUpperCase() === cleanId);
  // Fallback match by tracking ID
  if (idx === -1) {
    idx = orders.findIndex(o => (o.trackingId || '').trim().toUpperCase() === cleanId);
  }

  const now = new Date().toISOString();

  if (idx !== -1) {
    const updated = {
      ...orders[idx],
      ...req.body,
      orderId: orders[idx].orderId,
      updatedDate: now
    };
    orders[idx] = updated;
    writeOrders(orders, 'updated');
    return res.json({ success: true, order: updated, updated: true });
  }

  // If not found, upsert as new record so changes are NEVER lost
  const newOrder = {
    ...req.body,
    orderId: req.params.id || ('KP' + Date.now().toString().slice(-6)),
    createdDate: now,
    updatedDate: now
  };
  orders.unshift(newOrder);
  writeOrders(orders, 'created');
  res.status(201).json({ success: true, order: newOrder, upserted: true });
});

// DELETE /api/orders/:id (Delete Order from Database)
app.delete('/api/orders/:id', (req, res) => {
  let orders = readOrders();
  const cleanId = (req.params.id || '').trim().toUpperCase();
  const initialLength = orders.length;

  orders = orders.filter(o => 
    (o.orderId || '').trim().toUpperCase() !== cleanId &&
    (o.trackingId || '').trim().toUpperCase() !== cleanId
  );

  if (orders.length === initialLength) {
    return res.status(404).json({ error: 'Order not found in database' });
  }

  writeOrders(orders, 'deleted');
  res.json({ success: true, message: 'Order deleted from database successfully' });
});

// DELETE /api/orders (Clear All Orders from Database)
app.delete('/api/orders', (req, res) => {
  writeOrders([], 'cleared');
  res.json({ success: true, message: 'All orders cleared from database successfully' });
});

// POST /api/orders/bulk-sync (Bulk Merge/Synchronize from any Client Device)
app.post('/api/orders/bulk-sync', (req, res) => {
  const incoming = req.body.orders;
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: 'orders must be an array' });
  }

  const current = readOrders();
  const mergedMap = new Map();

  // Load existing DB orders into map
  for (const o of current) {
    const key = (o.orderId || o.trackingId || '').trim().toUpperCase();
    if (key) mergedMap.set(key, o);
  }

  let added = 0;
  let updated = 0;

  // Merge incoming client orders
  for (const inc of incoming) {
    const key = (inc.orderId || inc.trackingId || '').trim().toUpperCase();
    if (!key) continue;

    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key);
      const incTime = new Date(inc.updatedDate || 0).getTime();
      const exTime = new Date(existing.updatedDate || 0).getTime();
      if (incTime >= exTime) {
        mergedMap.set(key, { ...existing, ...inc, orderId: existing.orderId });
        updated++;
      }
    } else {
      mergedMap.set(key, inc);
      added++;
    }
  }

  const mergedList = Array.from(mergedMap.values());
  writeOrders(mergedList, 'bulk_synced');
  res.json({
    success: true,
    total: mergedList.length,
    added,
    updated,
    message: 'Database orders synchronized successfully'
  });
});

// GET /api/database/info (Database Health & Persistence Status)
app.get('/api/database/info', (req, res) => {
  const orders = readOrders();
  const settings = readSettings();
  let fileSize = 0;
  let lastModified = null;
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const s = fs.statSync(ORDERS_FILE);
      fileSize = s.size;
      lastModified = s.mtime.toISOString();
    }
  } catch (e) {}

  let backupsCount = 0;
  try {
    if (fs.existsSync(BACKUPS_DIR)) {
      backupsCount = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('orders_backup_')).length;
    }
  } catch (e) {}

  res.json({
    success: true,
    status: 'connected',
    databaseType: 'Atomic Persistent JSON Database',
    ordersCount: orders.length,
    fileSizeBytes: fileSize,
    fileSizeFormatted: (fileSize / 1024).toFixed(2) + ' KB',
    lastModified,
    backupsCount,
    connectedDevices: syncClients.size,
    ipAddresses: getLocalIpAddresses(),
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// GET /api/database/backup (Download Full JSON Database Backup)
app.get('/api/database/backup', (req, res) => {
  const orders = readOrders();
  const settings = readSettings();
  const payload = {
    exportDate: new Date().toISOString(),
    version: '2.0',
    businessName: settings.businessName || 'Kabir Publication',
    totalOrders: orders.length,
    orders,
    settings
  };
  const fileName = `Kabir_Publication_DB_Backup_${new Date().toISOString().split('T')[0]}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(JSON.stringify(payload, null, 2));
});

// POST /api/orders/import-label
app.post('/api/orders/import-label', (req, res) => {
  const { labels } = req.body;
  if (!Array.isArray(labels)) {
    return res.status(400).json({ error: 'labels must be an array' });
  }

  const orders = readOrders();
  let imported = 0;
  let duplicates = 0;

  labels.forEach(label => {
    const isDup = orders.some(o => 
      o.trackingId && label.trackingId && 
      o.trackingId.trim().toUpperCase() === label.trackingId.trim().toUpperCase()
    );
    if (isDup) {
      duplicates++;
    } else {
      label.orderStatus = label.orderStatus || 'Packed';
      label.whatsappStatus = label.whatsappStatus || 'Message Pending';
      label.createdDate = label.createdDate || new Date().toISOString();
      label.updatedDate = label.createdDate;
      orders.unshift(label);
      imported++;
    }
  });

  writeOrders(orders, 'imported');
  res.json({ success: true, imported, duplicates, total: labels.length });
});

// GET /api/dashboard/stats
app.get('/api/dashboard/stats', (req, res) => {
  const orders = readOrders();
  const stats = {
    total: orders.length,
    packed: orders.filter(o => (o.orderStatus || '').toLowerCase() === 'packed').length,
    shipped: orders.filter(o => (o.orderStatus || '').toLowerCase() === 'shipped').length,
    delivered: orders.filter(o => (o.orderStatus || '').toLowerCase() === 'delivered').length,
    returned: orders.filter(o => (o.orderStatus || '').toLowerCase() === 'returned').length,
    cancelled: orders.filter(o => (o.orderStatus || '').toLowerCase() === 'cancelled').length,
    codPending: orders.filter(o => {
      const p = (o.paymentStatus || '').toLowerCase();
      return p === 'cod' || p === 'cod pending';
    }).length,
    paid: orders.filter(o => {
      const p = (o.paymentStatus || '').toLowerCase();
      return p === 'online' || p === 'paid';
    }).length,
    cod: orders.filter(o => {
      const p = (o.paymentStatus || '').toLowerCase();
      return p === 'cod' || p === 'cod pending';
    }).length,
    online: orders.filter(o => {
      const p = (o.paymentStatus || '').toLowerCase();
      return p === 'online' || p === 'paid';
    }).length,
    whatsappPending: orders.filter(o => (o.whatsappStatus || '').toLowerCase().includes('pending')).length,
    whatsappSent: orders.filter(o => (o.whatsappStatus || '').toLowerCase().includes('sent')).length,
    totalCodAmount: orders.reduce((sum, o) => sum + (parseFloat(o.codAmount) || 0), 0)
  };
  res.json(stats);
});

// GET /api/download-website (One-click full project zip download for any laptop)
app.get('/api/download-website', (req, res) => {
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();

    const rootFiles = [
      'index.html', 'server.js', 'package.json', 'package-lock.json',
      'manifest.json', 'sw.js', 'favicon.png', 'logo.jpeg', 'logo.png',
      'icon-192.png', 'icon-512.png', 'README.md', 'Run_Website.bat', 'HOW_TO_RUN.txt',
      'Kabir_Publication.url', 'Open_Website.bat'
    ];

    rootFiles.forEach(f => {
      const p = path.join(__dirname, f);
      if (fs.existsSync(p)) {
        zip.addLocalFile(p);
      }
    });

    ['css', 'js', 'data'].forEach(dir => {
      const p = path.join(__dirname, dir);
      if (fs.existsSync(p)) {
        zip.addLocalFolder(p, dir);
      }
    });

    const buffer = zip.toBuffer();
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Kabir_Publication_Website_${dateStr}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('Error generating website zip:', err);
    res.status(500).json({ error: 'Failed to generate website zip', details: err.message });
  }
});

// GET /api/download-shortcut (Direct Windows Desktop .url shortcut)
app.get('/api/download-shortcut', (req, res) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const url = `${protocol}://${host}/`;
  const content = `[InternetShortcut]\r\nURL=${url}\r\nIconIndex=0\r\n`;
  res.setHeader('Content-Type', 'application/internet-shortcut');
  res.setHeader('Content-Disposition', 'attachment; filename="Kabir_Publication.url"');
  res.send(content);
});

// GET /api/download-bat-shortcut (Direct 1-Click .bat launcher)
app.get('/api/download-bat-shortcut', (req, res) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const content = `@echo off\r\ntitle Kabir Publication\r\nstart "" "${protocol}://${host}/"\r\nexit\r\n`;
  res.setHeader('Content-Type', 'application/x-bat');
  res.setHeader('Content-Disposition', 'attachment; filename="Open_Kabir_Publication.bat"');
  res.send(content);
});

// GET /api/settings
app.get('/api/settings', (req, res) => {
  const settings = readSettings();
  res.json(settings);
});

// PUT /api/settings
app.put('/api/settings', (req, res) => {
  const updated = Object.assign({}, readSettings(), req.body);
  writeSettings(updated);
  res.json({ success: true, settings: updated });
});

// POST /api/settings (Alias for PUT)
app.post('/api/settings', (req, res) => {
  const updated = Object.assign({}, readSettings(), req.body);
  writeSettings(updated);
  res.json({ success: true, settings: updated });
});

// POST /api/whatsapp/send-tracking
app.post('/api/whatsapp/send-tracking', async (req, res) => {
  const { orderId } = req.body;
  const orders = readOrders();
  const order = orders.find(o => o.orderId === orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (!order.trackingId) {
    return res.status(400).json({ success: false, message: 'Tracking ID is missing' });
  }

  const cleanPhone = (order.mobile || '').replace(/\D/g, '').slice(-10);
  if (!cleanPhone || cleanPhone.length !== 10) {
    return res.status(400).json({ success: false, message: 'Invalid 10-digit mobile number' });
  }

  const settings = readSettings();
  const token = process.env.WHATSAPP_ACCESS_TOKEN || settings.cloudApiToken;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || settings.cloudApiPhoneId;

  if (!token || !phoneId) {
    // Simulated cloud send when test credentials are used
    order.whatsappStatus = 'Message Sent';
    order.lastMessageTime = new Date().toISOString();
    writeOrders(orders);
    return res.json({
      success: true,
      simulated: true,
      message: 'WhatsApp Cloud API simulation successful. (Set WHATSAPP_ACCESS_TOKEN & WHATSAPP_PHONE_NUMBER_ID for live delivery)'
    });
  }

  // Meta Cloud API Call
  try {
    const metaUrl = `https://graph.facebook.com/${settings.cloudApiVersion || 'v19.0'}/${phoneId}/messages`;
    const response = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: `91${cleanPhone}`,
        type: 'text',
        text: {
          body: `📦 Kabir Publication – Order Dispatched!\n\nNamaste ${order.customerName} ji 🙏\n\nAapki book ${order.bookName} successfully dispatch ho gayi hai.\n\n📚 Book: ${order.bookName}\n🚚 Tracking ID: ${order.trackingId}\n\nKabir Publication 📚`
        }
      })
    });

    const metaData = await response.json();
    if (response.ok) {
      order.whatsappStatus = 'Message Sent';
      order.lastMessageTime = new Date().toISOString();
      writeOrders(orders);
      return res.json({ success: true, meta: metaData });
    } else {
      order.whatsappStatus = 'Failed';
      writeOrders(orders);
      return res.status(502).json({ success: false, error: metaData });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/send-bulk
app.post('/api/whatsapp/send-bulk', async (req, res) => {
  const { orderIds } = req.body;
  if (!Array.isArray(orderIds)) {
    return res.status(400).json({ error: 'orderIds must be an array' });
  }

  let sent = 0;
  let failed = 0;
  const orders = readOrders();

  for (const id of orderIds) {
    const o = orders.find(item => item.orderId === id);
    if (o && o.trackingId && o.mobile) {
      o.whatsappStatus = 'Message Sent';
      o.lastMessageTime = new Date().toISOString();
      sent++;
    } else {
      failed++;
    }
  }

  writeOrders(orders);
  res.json({ success: true, sent, failed, total: orderIds.length });
});

// GET /api/network-info and /network-info (Discovery for mobile and multi-device connection)
app.get(['/api/network-info', '/network-info'], (req, res) => {
  const ips = getLocalIpAddresses();
  const primaryIp = ips[0] || '127.0.0.1';
  const urls = ips.map(ip => `http://${ip}:${PORT}`);
  res.json({
    port: PORT,
    hostname: os.hostname(),
    localUrl: `http://localhost:${PORT}`,
    primaryIp: primaryIp,
    primaryUrl: `http://${primaryIp}:${PORT}`,
    networkUrls: urls,
    connectedDevices: syncClients.size
  });
});

// GET /api/sync/stream (Server-Sent Events for instant live multi-device sync)
app.get('/api/sync/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const handshake = {
    type: 'connected',
    version: syncVersion,
    settings: readSettings(),
    connectedDevices: syncClients.size + 1,
    timestamp: new Date().toISOString()
  };
  res.write(`data: ${JSON.stringify(handshake)}\n\n`);

  syncClients.add(res);

  // Keep connection alive with periodic comment every 15s
  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (err) {
      clearInterval(keepAlive);
      syncClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    syncClients.delete(res);
  });
});

// GET /api/sync/status and /sync/status (Lightweight status check for polling fallback)
app.get(['/api/sync/status', '/sync/status'], (req, res) => {
  res.json({
    version: syncVersion,
    lastSettingsUpdate,
    lastOrdersUpdate,
    connectedDevices: syncClients.size,
    ordersCount: readOrders().length,
    timestamp: new Date().toISOString()
  });
});

// POST /api/sync/ping (Test real-time cross-device sync)
app.post('/api/sync/ping', (req, res) => {
  const { deviceName, message } = req.body || {};
  broadcastSync({
    type: 'sync_ping',
    sender: deviceName || 'Another Device',
    message: message || 'Real-time sync test'
  });
  res.json({ success: true, connectedDevices: syncClients.size });
});

// Start Server (Bind to 0.0.0.0 for Local Network / Wi-Fi access)
app.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log(`====================================================`);
  console.log(` Kabir Publication Server Running on Port ${PORT}`);
  console.log(` Local Access:     http://localhost:${PORT}`);
  if (ips.length > 0) {
    ips.forEach(ip => {
      console.log(` Other Devices:    http://${ip}:${PORT}`);
    });
  } else {
    console.log(` Other Devices:    Connect both devices to same Wi-Fi/Hotspot`);
  }
  console.log(` Multi-Device Sync: REAL-TIME SSE & REST ACTIVE (0.0.0.0)`);
  console.log(`====================================================`);
});
