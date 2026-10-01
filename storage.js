/**
 * Kabir Publication - Order Management Storage Layer
 * Supports local storage with automatic backend API synchronization when available.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY_ORDERS = 'kp_orders_v1';
  const STORAGE_KEY_SETTINGS = 'kp_settings_v1';
  const STORAGE_KEY_CUSTOM_SERVER = 'kp_custom_server_url';
  const STORAGE_KEY_FIREBASE_URL = 'kp_firebase_db_url';

  function getFirebaseDbUrl() {
    try {
      const s = settingsCache || {};
      if (s.firebaseDbUrl && s.firebaseDbUrl.trim()) {
        return s.firebaseDbUrl.trim().replace(/\/+$/, '');
      }
      const stored = localStorage.getItem(STORAGE_KEY_FIREBASE_URL);
      if (stored && stored.trim()) {
        return stored.trim().replace(/\/+$/, '');
      }
    } catch (e) {}
    return '';
  }

  function getApiBase() {
    try {
      const custom = localStorage.getItem(STORAGE_KEY_CUSTOM_SERVER);
      if (custom && custom.trim()) {
        return custom.trim().replace(/\/+$/, '') + '/api';
      }
      if (window.location.protocol === 'file:') {
        return 'http://localhost:3000/api';
      }
    } catch (e) {}
    return '/api';
  }

  const DEFAULT_SETTINGS = {
    businessName: 'Kabir Publication',
    businessSubtitle: 'Book Order Management System',
    firebaseDbUrl: '',
    businessWhatsApp: '9413508833',
    senderAddress: 'Kabir Publication, Satlok Ashram, Barwala (Hisar), Haryana - 125121',
    senderPhone: '9413508833',
    whatsappMode: 'manual', // 'manual' | 'cloud_api'
    cloudApiToken: '',
    cloudApiPhoneId: '',
    cloudApiBusinessId: '',
    cloudApiVersion: 'v19.0',
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

  // Memory cache
  let ordersCache = null;
  let settingsCache = null;
  let isBackendConnected = false;

  // Check if backend API is responding
  async function checkBackendConnection() {
    try {
      const res = await fetch(`${getApiBase()}/sync/status`, { method: 'GET', cache: 'no-cache' });
      if (res.ok) {
        isBackendConnected = true;
        return true;
      }
    } catch (e) {
      try {
        const res2 = await fetch(`${getApiBase()}/settings`, { method: 'GET', cache: 'no-cache' });
        if (res2.ok) {
          isBackendConnected = true;
          return true;
        }
      } catch (e2) {}
      isBackendConnected = false;
    }
    return false;
  }

  // Load Settings
  function getSettings() {
    if (settingsCache) return { ...settingsCache };
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) {
        settingsCache = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
        if (settingsCache.whatsappTemplate && settingsCache.whatsappTemplate.includes('🚚 Tracking ID: {{tracking}}')) {
          settingsCache.whatsappTemplate = settingsCache.whatsappTemplate
            .replace('🚚 Tracking ID: {{tracking}}', '🚚 Tracking ID (Tap to Copy):\n`{{tracking}}`')
            .replace('Aap apni Tracking ID ka use karke shipment ka status check kar sakte hain.', 'Aap upar diye gaye Tracking ID par click/tap karke copy kar sakte hain aur link se tracking status check kar sakte hain.');
        }
      } else {
        settingsCache = { ...DEFAULT_SETTINGS };
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settingsCache));
      }
    } catch (e) {
      console.warn('Error reading settings from localStorage:', e);
      settingsCache = { ...DEFAULT_SETTINGS };
    }
    return { ...settingsCache };
  }

  // Save Settings
  async function saveSettings(newSettings) {
    settingsCache = Object.assign({}, DEFAULT_SETTINGS, settingsCache || {}, newSettings);
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settingsCache));
    } catch (e) {
      console.error('Error saving settings to localStorage:', e);
    }

    // Apply branding immediately to current device UI
    if (window.KPApp && window.KPApp.applyBranding) {
      window.KPApp.applyBranding(settingsCache);
    }

    // Firebase Realtime Cloud Sync (Netlify / Public Internet)
    const fbUrl = getFirebaseDbUrl();
    if (fbUrl) {
      try {
        await fetch(`${fbUrl}/settings.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsCache)
        });
      } catch (err) {
        console.warn('Firebase sync failed for settings:', err);
      }
    }

    // Authoritative Backend Server Database Persistence
    try {
      const res = await fetch(`${getApiBase()}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsCache)
      });
      if (res.ok) {
        isBackendConnected = true;
      }
    } catch (err) {
      console.warn('Backend database sync failed for settings:', err);
    }
    return { ...settingsCache };
  }

  // Get Books list (user-defined or defaults)
  function getBooks() {
    const s = getSettings();
    if (Array.isArray(s.books) && s.books.length > 0) {
      return [...s.books];
    }
    return [
      'Gyan Ganga',
      'Jeene Ki Raah',
      'Geeta Tera Gyan Amrit',
      'Bhakti Se Bhagwan Tak',
      'Dharm Bodh',
      'Andh Shradha Bhakti Khatra-e-Jaan',
      'Kabir Sahib Vaani'
    ];
  }

  // Add new custom book to the user's book list
  async function addBook(bookName) {
    if (!bookName || !bookName.trim()) return false;
    const clean = bookName.trim();
    const s = getSettings();
    const current = Array.isArray(s.books) ? [...s.books] : getBooks();
    const exists = current.some(b => b.toLowerCase() === clean.toLowerCase());
    if (!exists) {
      current.push(clean);
      s.books = current;
      await saveSettings(s);
      updateBookDatalists();
      return true;
    }
    return false;
  }

  // Delete a book from the user's book list
  async function deleteBook(bookName) {
    if (!bookName) return false;
    const clean = bookName.trim().toLowerCase();
    const s = getSettings();
    const current = Array.isArray(s.books) ? s.books : getBooks();
    s.books = current.filter(b => b.toLowerCase() !== clean);
    if ((s.defaultBook || '').toLowerCase() === clean) {
      s.defaultBook = s.books[0] || '';
    }
    await saveSettings(s);
    updateBookDatalists();
    return true;
  }

  // Update all book suggestions datalists across the app
  function updateBookDatalists() {
    const books = getBooks();
    const datalists = document.querySelectorAll('datalist#book-suggestions');
    datalists.forEach(dl => {
      dl.innerHTML = books.map(b => `<option value="${escapeHTML(b)}">`).join('');
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Load Orders from LocalStorage
  function getOrders() {
    if (ordersCache) return [...ordersCache];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ORDERS);
      if (raw) {
        ordersCache = JSON.parse(raw);
        if (!Array.isArray(ordersCache)) ordersCache = [];
        // Strictly filter out any legacy dummy demo records by name
        const dummyNames = ['Rameshwar Lal Sharma', 'Sunita Devi Yadav', 'Vikram Singh Verma'];
        const cleaned = ordersCache.filter(o => !dummyNames.includes(o.customerName));
        if (cleaned.length !== ordersCache.length) {
          ordersCache = cleaned;
          localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(ordersCache));
        }
      } else {
        ordersCache = [];
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(ordersCache));
      }
    } catch (e) {
      console.error('Error reading orders from localStorage:', e);
      ordersCache = [];
    }
    return [...ordersCache];
  }

  // Persist Orders to LocalStorage & optional Backend / Firebase
  function persistOrdersLocally() {
    try {
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(ordersCache || []));
    } catch (e) {
      console.error('Error persisting orders:', e);
    }

    // Firebase Cloud Sync for Netlify
    const fbUrl = getFirebaseDbUrl();
    if (fbUrl) {
      try {
        fetch(`${fbUrl}/orders.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ordersCache || [])
        }).catch(err => console.warn('Firebase orders sync error:', err));
      } catch (err) {}
    }
  }

  // Generate Unique Order ID
  function generateOrderId() {
    const orders = getOrders();
    const yearShort = new Date().getFullYear().toString().slice(-2);
    let maxNum = 1000;
    orders.forEach(o => {
      if (o.orderId && o.orderId.startsWith('KP')) {
        const parts = o.orderId.replace(/[^0-9]/g, '');
        const num = parseInt(parts.slice(-4), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    return `KP${yearShort}-${maxNum + 1}`;
  }

  // Check for duplicate order
  function checkDuplicate(orderData, excludeId = null) {
    const orders = getOrders();
    const track = (orderData.trackingId || '').trim().toUpperCase();
    const mob = (orderData.mobile || '').trim().replace(/\D/g, '').slice(-10);
    const name = (orderData.customerName || '').trim().toLowerCase();
    const pin = (orderData.pincode || '').trim();

    for (const o of orders) {
      if (excludeId && o.orderId === excludeId) continue;
      
      // Match by non-empty Tracking ID
      if (track && o.trackingId && o.trackingId.trim().toUpperCase() === track) {
        return { duplicate: true, reason: 'Tracking ID already exists', existing: o };
      }

      // Match by combination of Mobile + Name + PIN
      const oMob = (o.mobile || '').trim().replace(/\D/g, '').slice(-10);
      const oName = (o.customerName || '').trim().toLowerCase();
      const oPin = (o.pincode || '').trim();

      if (mob && oMob && mob === oMob && pin && oPin && pin === oPin && name && oName && name === oName) {
        return { duplicate: true, reason: 'Same Customer Name, Mobile & PIN already exists', existing: o };
      }
    }
    return { duplicate: false };
  }

  // Save New Order
  async function saveOrder(orderData, force = false) {
    const dup = checkDuplicate(orderData);
    if (dup.duplicate && !force) {
      return { success: false, duplicate: true, reason: dup.reason, existing: dup.existing };
    }

    const settings = getSettings();
    const now = new Date().toISOString();
    const order = {
      orderId: orderData.orderId || generateOrderId(),
      customerName: (orderData.customerName || '').trim(),
      mobile: (orderData.mobile || '').trim().replace(/\D/g, '').slice(-10),
      address: (orderData.address || '').trim(),
      addressType: orderData.addressType || 'Home',
      city: (orderData.city || '').trim(),
      state: (orderData.state || '').trim(),
      pincode: (orderData.pincode || '').trim().slice(0, 6),
      bookName: (orderData.bookName || '').trim(),
      quantity: Math.max(1, parseInt(orderData.quantity, 10) || 1),
      orderDate: orderData.orderDate || new Date().toISOString().split('T')[0],
      trackingId: (orderData.trackingId || '').trim(),
      courier: orderData.courier || 'India Post',
      codAmount: parseFloat(orderData.codAmount) || 0,
      paymentStatus: orderData.paymentStatus || settings.defaultPayment || 'COD',
      orderStatus: orderData.orderStatus || settings.defaultStatus || 'Packed',
      whatsappStatus: orderData.whatsappStatus || 'Message Pending',
      deliveredDate: orderData.deliveredDate || '',
      remarks: (orderData.remarks || '').trim(),
      createdDate: orderData.createdDate || now,
      updatedDate: now,
      lastMessageTime: orderData.lastMessageTime || ''
    };

    if (order.orderStatus === 'Delivered' && !order.deliveredDate) {
      order.deliveredDate = new Date().toISOString().split('T')[0];
    }

    if (!ordersCache) getOrders();

    const existingIdx = orderData.orderId ? ordersCache.findIndex(o => o.orderId === orderData.orderId) : -1;
    if (existingIdx !== -1) {
      ordersCache[existingIdx] = Object.assign({}, ordersCache[existingIdx], order, { updatedDate: now });
    } else {
      ordersCache.unshift(order);
    }
    persistOrdersLocally();

    // Authoritative Database Persistence
    try {
      const res = await fetch(`${getApiBase()}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      if (res.ok) {
        isBackendConnected = true;
      }
    } catch (err) {
      console.warn('Backend database sync failed for saveOrder:', err);
    }

    return { success: true, order };
  }

  // Update Existing Order
  async function updateOrder(orderId, updateData) {
    if (!ordersCache) getOrders();
    const idx = ordersCache.findIndex(o => o.orderId === orderId);
    if (idx === -1) {
      return { success: false, message: 'Order not found' };
    }

    // Check duplicate if trackingId changed
    if (updateData.trackingId && updateData.trackingId !== ordersCache[idx].trackingId) {
      const dup = checkDuplicate(updateData, orderId);
      if (dup.duplicate) {
        return { success: false, duplicate: true, reason: dup.reason, existing: dup.existing };
      }
    }

    const current = ordersCache[idx];
    const now = new Date().toISOString();

    const updated = {
      ...current,
      ...updateData,
      orderId: current.orderId, // immutable
      updatedDate: now
    };

    // Auto set deliveredDate if status changed to Delivered and empty
    if (updated.orderStatus === 'Delivered' && !updated.deliveredDate) {
      updated.deliveredDate = new Date().toISOString().split('T')[0];
    }

    ordersCache[idx] = updated;
    persistOrdersLocally();

    // Authoritative Database Persistence
    try {
      const res = await fetch(`${getApiBase()}/orders/${encodeURIComponent(orderId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        isBackendConnected = true;
      }
    } catch (err) {
      console.warn('Backend database sync failed for updateOrder:', err);
    }

    return { success: true, order: updated };
  }

  // Delete Order
  async function deleteOrder(orderId) {
    if (!ordersCache) getOrders();
    const idx = ordersCache.findIndex(o => o.orderId === orderId);
    if (idx === -1) return { success: false, message: 'Order not found' };

    ordersCache.splice(idx, 1);
    persistOrdersLocally();

    // Authoritative Database Persistence
    try {
      const res = await fetch(`${getApiBase()}/orders/${encodeURIComponent(orderId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        isBackendConnected = true;
      }
    } catch (err) {
      console.warn('Backend database sync failed for deleteOrder:', err);
    }

    return { success: true };
  }

  // Clear All Orders
  async function clearAllOrders() {
    ordersCache = [];
    persistOrdersLocally();

    // Authoritative Database Persistence
    try {
      const res = await fetch(`${getApiBase()}/orders`, {
        method: 'DELETE'
      });
      if (res.ok) {
        isBackendConnected = true;
      }
    } catch (err) {
      console.warn('Backend database sync failed for clearAllOrders:', err);
    }
    return { success: true };
  }

  // Get Order By ID
  function getOrderById(orderId) {
    const orders = getOrders();
    return orders.find(o => o.orderId === orderId) || null;
  }

  // Update WhatsApp Message Status
  async function updateMessageStatus(orderId, status) {
    return await updateOrder(orderId, {
      whatsappStatus: status,
      lastMessageTime: new Date().toISOString()
    });
  }

  // Get Statistics for Dashboard
  function getStats() {
    const orders = getOrders();
    const stats = {
      total: orders.length,
      packed: 0,
      shipped: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0,
      codPending: 0,
      paid: 0,
      whatsappPending: 0,
      whatsappSent: 0,
      totalCodAmount: 0,
      totalPaidAmount: 0,
      totalPendingCodAmount: 0
    };

    orders.forEach(o => {
      const status = (o.orderStatus || '').toLowerCase();
      if (status === 'packed') stats.packed++;
      else if (status === 'shipped') stats.shipped++;
      else if (status === 'delivered') stats.delivered++;
      else if (status === 'returned') stats.returned++;
      else if (status === 'cancelled') stats.cancelled++;

      const pay = (o.paymentStatus || '').toLowerCase();
      const cod = parseFloat(o.codAmount) || 0;
      if (pay === 'online' || pay === 'paid') {
        stats.paid++;
        stats.totalPaidAmount += cod;
      } else if (pay === 'cod' || pay === 'cod pending') {
        stats.codPending++;
        stats.totalPendingCodAmount += cod;
      }

      stats.totalCodAmount += cod;

      const wa = (o.whatsappStatus || '').toLowerCase();
      if (wa.includes('sent')) {
        stats.whatsappSent++;
      } else {
        stats.whatsappPending++;
      }
    });

    return stats;
  }

  // ==========================================
  // REAL-TIME MULTI-DEVICE SYNC ENGINE
  // ==========================================
  let eventSource = null;
  let reconnectTimer = null;
  let lastKnownSyncVersion = 0;
  let syncStatusListeners = [];

  function registerSyncListener(fn) {
    if (typeof fn === 'function') {
      syncStatusListeners.push(fn);
      try {
        fn(isBackendConnected ? 'connected' : 'disconnected', {
          isBackendConnected,
          version: lastKnownSyncVersion
        });
      } catch (e) {}
    }
  }

  function notifySyncStatus(status, details) {
    syncStatusListeners.forEach(fn => {
      try { fn(status, details); } catch (e) {}
    });
  }

  async function syncOrdersFromServer() {
    try {
      const res = await fetch(`${getApiBase()}/orders`, { cache: 'no-cache' });
      if (res.ok) {
        const remoteOrders = await res.json();
        if (Array.isArray(remoteOrders)) {
          const dummyNames = ['Rameshwar Lal Sharma', 'Sunita Devi Yadav', 'Vikram Singh Verma'];
          const dummyIds = ['KP26-1001', 'KP26-1002', 'KP26-1003'];
          ordersCache = remoteOrders.filter(o => !dummyIds.includes(o.orderId) && !dummyNames.includes(o.customerName));
          persistOrdersLocally();
          return true;
        }
      }
    } catch (err) {
      console.warn('syncOrdersFromServer backend fetch failed:', err);
    }

    // Static Seed Fallback for Netlify / GitHub Pages Hosting
    try {
      const staticRes = await fetch('./data/orders.json', { cache: 'no-cache' });
      if (staticRes.ok) {
        const staticOrders = await staticRes.json();
        if (Array.isArray(staticOrders) && (!ordersCache || ordersCache.length === 0)) {
          ordersCache = staticOrders;
          persistOrdersLocally();
          return true;
        }
      }
    } catch (sErr) {}

    return false;
  }

  async function syncSettingsFromServer() {
    try {
      const sRes = await fetch(`${getApiBase()}/settings`, { cache: 'no-cache' });
      if (sRes.ok) {
        const remoteSettings = await sRes.json();
        if (remoteSettings && typeof remoteSettings === 'object') {
          settingsCache = Object.assign({}, DEFAULT_SETTINGS, remoteSettings);
          try {
            localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settingsCache));
          } catch (e) {}
          if (window.KPApp && window.KPApp.applyBranding) {
            window.KPApp.applyBranding(settingsCache);
          }
          if (window.KPApp && window.KPApp.onRemoteSettingsUpdated) {
            window.KPApp.onRemoteSettingsUpdated(settingsCache);
          }
          return true;
        }
      }
    } catch (err) {
      console.warn('syncSettingsFromServer backend fetch failed:', err);
    }

    // Static Seed Fallback for Netlify / GitHub Pages Hosting
    try {
      const staticSRes = await fetch('./data/settings.json', { cache: 'no-cache' });
      if (staticSRes.ok) {
        const staticSettings = await staticSRes.json();
        if (staticSettings && typeof staticSettings === 'object') {
          settingsCache = Object.assign({}, DEFAULT_SETTINGS, staticSettings);
          try {
            localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settingsCache));
          } catch (e) {}
          if (window.KPApp && window.KPApp.applyBranding) {
            window.KPApp.applyBranding(settingsCache);
          }
          return true;
        }
      }
    } catch (sErr) {}

    return false;
  }

  async function checkSyncVersionAndRefresh() {
    try {
      const res = await fetch(`${getApiBase()}/sync/status`, { cache: 'no-cache' });
      if (res.ok) {
        const status = await res.json();
        isBackendConnected = true;
        if (status.version && status.version !== lastKnownSyncVersion) {
          lastKnownSyncVersion = status.version;
          await syncSettingsFromServer();
          await syncOrdersFromServer();
          if (window.KPApp && window.KPApp.onRemoteOrdersUpdated) {
            window.KPApp.onRemoteOrdersUpdated();
          }
        }
        notifySyncStatus('connected', status);
        return status;
      }
    } catch (e) {
      isBackendConnected = false;
      notifySyncStatus('disconnected', null);
    }
    return null;
  }

  function startRealtimeSync() {
    if (typeof EventSource === 'undefined') {
      startPollingSync();
      return;
    }

    if (eventSource) {
      try { eventSource.close(); } catch (e) {}
      eventSource = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    try {
      const sseUrl = `${getApiBase()}/sync/stream`;
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = function() {
        isBackendConnected = true;
        notifySyncStatus('connected', { mode: 'realtime' });
      };

      eventSource.onmessage = async function(event) {
        if (!event.data) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.version) lastKnownSyncVersion = payload.version;

          if (payload.type === 'connected') {
            isBackendConnected = true;
            if (payload.settings) {
              settingsCache = Object.assign({}, DEFAULT_SETTINGS, payload.settings);
              try { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settingsCache)); } catch (e) {}
              if (window.KPApp && window.KPApp.applyBranding) {
                window.KPApp.applyBranding(settingsCache);
              }
            }
            notifySyncStatus('connected', payload);
          } else if (payload.type === 'settings_updated') {
            if (payload.settings) {
              settingsCache = Object.assign({}, DEFAULT_SETTINGS, payload.settings);
              try { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settingsCache)); } catch (e) {}
              if (window.KPApp && window.KPApp.applyBranding) {
                window.KPApp.applyBranding(settingsCache);
              }
              if (window.KPApp && window.KPApp.onRemoteSettingsUpdated) {
                window.KPApp.onRemoteSettingsUpdated(settingsCache);
              }
            }
            notifySyncStatus('connected', payload);
          } else if (payload.type === 'orders_updated') {
            await syncOrdersFromServer();
            if (window.KPApp && window.KPApp.onRemoteOrdersUpdated) {
              window.KPApp.onRemoteOrdersUpdated(payload);
            }
            notifySyncStatus('connected', payload);
          } else if (payload.type === 'sync_ping') {
            if (window.showToast) {
              window.showToast(`⚡ Real-Time Sync Ping: ${payload.sender || 'Another device'} connected!`, 'info');
            }
          }
        } catch (err) {
          console.warn('Error parsing SSE sync payload:', err);
        }
      };

      eventSource.onerror = function() {
        isBackendConnected = false;
        notifySyncStatus('reconnecting', { mode: 'polling' });
        try { eventSource.close(); } catch (e) {}
        eventSource = null;
        reconnectTimer = setTimeout(startRealtimeSync, 3500);
      };
    } catch (e) {
      console.warn('Error creating EventSource, falling back to polling:', e);
      startPollingSync();
    }
  }

  let pollingInterval = null;
  function startPollingSync() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(() => {
      if (!eventSource || eventSource.readyState !== EventSource.OPEN) {
        checkSyncVersionAndRefresh();
      }
    }, 4000);
  }

  // Cross-tab sync via storage events
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_SETTINGS) {
      try {
        if (e.newValue) {
          settingsCache = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(e.newValue));
          if (window.KPApp && window.KPApp.applyBranding) {
            window.KPApp.applyBranding(settingsCache);
          }
          if (window.KPApp && window.KPApp.onRemoteSettingsUpdated) {
            window.KPApp.onRemoteSettingsUpdated(settingsCache);
          }
        }
      } catch (err) {}
    } else if (e.key === STORAGE_KEY_ORDERS) {
      try {
        if (e.newValue) {
          ordersCache = JSON.parse(e.newValue) || [];
          if (window.KPApp && window.KPApp.onRemoteOrdersUpdated) {
            window.KPApp.onRemoteOrdersUpdated();
          }
        }
      } catch (err) {}
    }
  });

  // Re-check on tab visibility
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkSyncVersionAndRefresh();
    }
  });

  window.addEventListener('focus', () => {
    checkSyncVersionAndRefresh();
  });

  // Test Ping trigger
  async function sendSyncPing(deviceName = 'This Device') {
    try {
      const res = await fetch(`${getApiBase()}/sync/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceName, message: 'Cross-device sync verified!' })
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // ==========================================
  // FIREBASE REALTIME CLOUD SYNC (FOR NETLIFY)
  // ==========================================
  let firebaseEventSource = null;

  function startFirebaseSync() {
    const fbUrl = getFirebaseDbUrl();
    if (!fbUrl) return;

    if (firebaseEventSource) {
      try { firebaseEventSource.close(); } catch (e) {}
      firebaseEventSource = null;
    }

    try {
      firebaseEventSource = new EventSource(`${fbUrl}/.json`);

      const handleFirebasePayload = (payload) => {
        if (!payload) return;
        if (payload.path === '/' && payload.data) {
          if (payload.data.settings) {
            settingsCache = Object.assign({}, DEFAULT_SETTINGS, payload.data.settings);
            try { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settingsCache)); } catch (err) {}
            if (window.KPApp && window.KPApp.applyBranding) window.KPApp.applyBranding(settingsCache);
            if (window.KPApp && window.KPApp.onRemoteSettingsUpdated) window.KPApp.onRemoteSettingsUpdated(settingsCache);
          }
          if (Array.isArray(payload.data.orders)) {
            ordersCache = payload.data.orders;
            try { localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(ordersCache)); } catch (err) {}
            if (window.KPApp && window.KPApp.onRemoteOrdersUpdated) window.KPApp.onRemoteOrdersUpdated();
          }
        } else if (payload.path === '/settings' && payload.data) {
          settingsCache = Object.assign({}, DEFAULT_SETTINGS, payload.data);
          try { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settingsCache)); } catch (err) {}
          if (window.KPApp && window.KPApp.applyBranding) window.KPApp.applyBranding(settingsCache);
          if (window.KPApp && window.KPApp.onRemoteSettingsUpdated) window.KPApp.onRemoteSettingsUpdated(settingsCache);
        } else if (payload.path && payload.path.startsWith('/settings/')) {
          const key = payload.path.replace('/settings/', '');
          if (!settingsCache) getSettings();
          settingsCache[key] = payload.data;
          try { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settingsCache)); } catch (err) {}
          if (window.KPApp && window.KPApp.applyBranding) window.KPApp.applyBranding(settingsCache);
          if (window.KPApp && window.KPApp.onRemoteSettingsUpdated) window.KPApp.onRemoteSettingsUpdated(settingsCache);
        } else if (payload.path === '/orders' && Array.isArray(payload.data)) {
          ordersCache = payload.data;
          try { localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(ordersCache)); } catch (err) {}
          if (window.KPApp && window.KPApp.onRemoteOrdersUpdated) window.KPApp.onRemoteOrdersUpdated();
        }
        notifySyncStatus('connected', { mode: 'firebase_cloud' });
      };

      firebaseEventSource.addEventListener('put', (e) => {
        try {
          handleFirebasePayload(JSON.parse(e.data));
        } catch (err) {
          console.warn('Firebase put parse error:', err);
        }
      });

      firebaseEventSource.addEventListener('patch', (e) => {
        try {
          handleFirebasePayload(JSON.parse(e.data));
        } catch (err) {
          console.warn('Firebase patch parse error:', err);
        }
      });

      firebaseEventSource.onerror = () => {
        try { firebaseEventSource.close(); } catch (e) {}
        firebaseEventSource = null;
        setTimeout(startFirebaseSync, 5000);
      };
    } catch (err) {
      console.warn('Firebase EventSource error:', err);
    }
  }

  // Set / Get Firebase Database URL (e.g. https://my-proj-default-rtdb.firebaseio.com)
  async function setFirebaseDbUrl(url) {
    const clean = (url || '').trim().replace(/\/+$/, '');
    if (!clean) {
      localStorage.removeItem(STORAGE_KEY_FIREBASE_URL);
      if (settingsCache) settingsCache.firebaseDbUrl = '';
      if (firebaseEventSource) {
        try { firebaseEventSource.close(); } catch (e) {}
        firebaseEventSource = null;
      }
    } else {
      localStorage.setItem(STORAGE_KEY_FIREBASE_URL, clean);
      if (settingsCache) settingsCache.firebaseDbUrl = clean;
      // Initialize Firebase with current local data if remote is empty
      try {
        const sRes = await fetch(`${clean}/settings.json`);
        const rData = await sRes.json();
        if (!rData) {
          await fetch(`${clean}/settings.json`, { method: 'PUT', body: JSON.stringify(settingsCache || DEFAULT_SETTINGS) });
        }
      } catch (e) {}
      startFirebaseSync();
    }
  }

  function getFirebaseDbUrlSetting() {
    return getFirebaseDbUrl();
  }

  // Set / Get Custom Server URL (for connecting to a master laptop or cloud backend)
  function setCustomServerUrl(url) {
    if (!url) {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_SERVER);
    } else {
      localStorage.setItem(STORAGE_KEY_CUSTOM_SERVER, url.trim().replace(/\/+$/, ''));
    }
    // Re-check and re-connect
    checkBackendConnection().then(() => {
      startRealtimeSync();
    });
  }

  function getCustomServerUrl() {
    return localStorage.getItem(STORAGE_KEY_CUSTOM_SERVER) || '';
  }

  // Initial backend check and sync
  async function init() {
    getSettings();
    getOrders();

    // 1. Firebase Cloud Sync check (for Netlify / Public URL)
    const fbUrl = getFirebaseDbUrl();
    if (fbUrl) {
      try {
        const sRes = await fetch(`${fbUrl}/settings.json`, { cache: 'no-cache' });
        if (sRes.ok) {
          const remoteSettings = await sRes.json();
          if (remoteSettings && typeof remoteSettings === 'object') {
            settingsCache = Object.assign({}, DEFAULT_SETTINGS, remoteSettings);
            try { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settingsCache)); } catch (e) {}
            if (window.KPApp && window.KPApp.applyBranding) window.KPApp.applyBranding(settingsCache);
          } else {
            // First time: initialize remote Firebase with local settings
            await fetch(`${fbUrl}/settings.json`, { method: 'PUT', body: JSON.stringify(settingsCache) });
          }
        }

        const oRes = await fetch(`${fbUrl}/orders.json`, { cache: 'no-cache' });
        if (oRes.ok) {
          const remoteOrders = await oRes.json();
          if (Array.isArray(remoteOrders)) {
            ordersCache = remoteOrders;
            try { localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(ordersCache)); } catch (e) {}
          } else if (!remoteOrders && ordersCache && ordersCache.length > 0) {
            await fetch(`${fbUrl}/orders.json`, { method: 'PUT', body: JSON.stringify(ordersCache) });
          }
        }

        startFirebaseSync();
        notifySyncStatus('connected', { mode: 'firebase_cloud' });
      } catch (err) {
        console.warn('Firebase init error:', err);
      }
    }

    // 2. Local / VPS Backend Database check
    try {
      const connected = await checkBackendConnection();
      if (connected) {
        await Promise.all([
          syncSettingsFromServer(),
          syncOrdersFromServer()
        ]);
        if (window.KPApp && window.KPApp.onRemoteOrdersUpdated) {
          window.KPApp.onRemoteOrdersUpdated();
        }
        startRealtimeSync();
        startPollingSync();
      } else {
        startPollingSync();
      }
    } catch (e) {
      console.warn('Backend init check error:', e);
      startPollingSync();
    }
  }

  // Push all local orders to database (bidirectional reconciliation)
  async function syncAllToDatabase() {
    const orders = getOrders();
    try {
      const res = await fetch(`${getApiBase()}/orders/bulk-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders })
      });
      if (res.ok) {
        const data = await res.json();
        await syncOrdersFromServer();
        return { success: true, count: data.total || orders.length };
      }
    } catch (e) {
      console.warn('syncAllToDatabase failed:', e);
    }
    return { success: false };
  }

  // Get Backend Database Status
  async function getDatabaseInfo() {
    try {
      const res = await fetch(`${getApiBase()}/database/info`, { cache: 'no-cache' });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return {
      success: false,
      status: 'disconnected',
      ordersCount: (ordersCache || []).length,
      databaseType: 'Local Storage Cache',
      timestamp: new Date().toISOString()
    };
  }

  // Export functions to global scope
  window.KPStorage = {
    init,
    getSettings,
    saveSettings,
    getOrders,
    getOrderById,
    saveOrder,
    updateOrder,
    deleteOrder,
    updateMessageStatus,
    getStats,
    checkDuplicate,
    generateOrderId,
    clearAllOrders,
    getBooks,
    addBook,
    deleteBook,
    updateBookDatalists,
    isBackendConnected: () => isBackendConnected,
    getApiBase,
    setCustomServerUrl,
    getCustomServerUrl,
    getFirebaseDbUrl: getFirebaseDbUrlSetting,
    setFirebaseDbUrl,
    registerSyncListener,
    syncOrdersFromServer,
    syncSettingsFromServer,
    checkSyncVersionAndRefresh,
    sendSyncPing,
    syncAllToDatabase,
    getDatabaseInfo
  };

  // Reusable global aliases requested in spec Section 22:
  window.saveOrder = saveOrder;
  window.updateOrder = updateOrder;
  window.deleteOrder = deleteOrder;
  window.clearAllOrders = clearAllOrders;
  window.getOrders = getOrders;
  window.getOrderById = getOrderById;
  window.updateMessageStatus = updateMessageStatus;

})(window);
