/**
 * Kabir Publication - Core Application Logic
 * Integrates storage, UI rendering, instant search, multi-filters,
 * modal dialogs, and bulk workflows.
 */

(function(window) {
  'use strict';

  // State Management
  const state = {
    currentView: 'dashboard',
    searchQuery: '',
    statusFilter: 'all',
    paymentFilter: 'all',
    whatsappFilter: 'all',
    dateFilter: 'all',
    customStartDate: '',
    customEndDate: '',
    selectedOrderIds: new Set(),
    editingOrderId: null,
    activeOrderForModal: null,
    bulkWhatsAppFilter: 'all',
    bulkSelectedOrderIds: new Set(),
    pendingImportCandidates: [],
    quickEditOrderId: null
  };

  // Toast Notification Engine
  function showToast(message, type = 'info', duration = 3200) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 20 20" fill="currentColor" class="toast-icon"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg viewBox="0 0 20 20" fill="currentColor" class="toast-icon"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg viewBox="0 0 20 20" fill="currentColor" class="toast-icon"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 20 20" fill="currentColor" class="toast-icon"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
  window.showToast = showToast;

  // View Navigation
  function navigateTo(viewName, filterParams = null) {
    state.currentView = viewName;

    // Apply special filter overrides if provided
    if (filterParams) {
      if (filterParams.status) state.statusFilter = filterParams.status;
      if (filterParams.payment) state.paymentFilter = filterParams.payment;
      if (filterParams.whatsapp) state.whatsappFilter = filterParams.whatsapp;
      if (filterParams.search !== undefined) state.searchQuery = filterParams.search;
    } else if (viewName === 'orders-all') {
      // Direct navigation to All Orders should always reset search and filters
      state.searchQuery = '';
      state.statusFilter = 'all';
      state.paymentFilter = 'all';
      state.whatsappFilter = 'all';
      state.dateFilter = 'all';
    }

    // Protection against browser credential autofill injecting 'admin'
    if (state.searchQuery && state.searchQuery.trim().toLowerCase() === 'admin') {
      state.searchQuery = '';
    }

    // Update navigation sidebar active class
    document.querySelectorAll('.nav-link').forEach(btn => {
      const target = btn.getAttribute('data-view');
      if (target === viewName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Hide all view containers, show targeted view
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active-view');
    });

    const activeSec = document.getElementById(`view-${viewName}`);
    if (activeSec) {
      activeSec.classList.add('active-view');
    }

    // Close mobile drawer if open
    closeMobileNav();

    // Render corresponding view
    renderCurrentView();

    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderCurrentView() {
    switch (state.currentView) {
      case 'dashboard':
        renderDashboard();
        break;
      case 'add-order':
        renderOrderForm();
        break;
      case 'orders-all':
      case 'orders-packed':
      case 'orders-shipped':
      case 'orders-delivered':
      case 'orders-returned':
        renderOrdersTable();
        break;
      case 'whatsapp':
        renderWhatsAppMessagesPage();
        break;
      case 'shipping-labels':
        renderShippingLabelsPage();
        break;
      case 'reports':
        renderReportsPage();
        break;
      case 'settings':
        renderSettingsPage();
        break;
      default:
        renderDashboard();
    }
  }

  // 1. DASHBOARD RENDERING
  function renderDashboard() {
    const stats = window.KPStorage.getStats();

    // Update 10 Stat Cards
    setCardValue('stat-total-orders', stats.total);
    setCardValue('stat-packed', stats.packed);
    setCardValue('stat-shipped', stats.shipped);
    setCardValue('stat-delivered', stats.delivered);
    setCardValue('stat-returned', stats.returned);
    setCardValue('stat-cancelled', stats.cancelled);
    setCardValue('stat-cod-pending', stats.codPending);
    setCardValue('stat-paid', stats.paid);
    setCardValue('stat-wa-pending', stats.whatsappPending);
    setCardValue('stat-wa-sent', stats.whatsappSent);

    // Update monetary highlights
    const totalCodEl = document.getElementById('stat-total-cod-amount');
    if (totalCodEl) totalCodEl.textContent = `₹${stats.totalCodAmount.toLocaleString('en-IN')}`;
    const pendingCodEl = document.getElementById('stat-pending-cod-amount');
    if (pendingCodEl) pendingCodEl.textContent = `₹${stats.totalPendingCodAmount.toLocaleString('en-IN')}`;
    const paidAmountEl = document.getElementById('stat-paid-amount');
    if (paidAmountEl) paidAmountEl.textContent = `₹${stats.totalPaidAmount.toLocaleString('en-IN')}`;

    // Render Recent 5 Orders on Dashboard
    const recentOrdersContainer = document.getElementById('dashboard-recent-orders');
    if (recentOrdersContainer) {
      const orders = window.KPStorage.getOrders().slice(0, 6);
      if (orders.length === 0) {
        recentOrdersContainer.innerHTML = `
          <div class="empty-state-card">
            <div class="empty-icon-bubble">📦</div>
            <h3 class="empty-title">Abhi Koi Order Nahi Hai</h3>
            <p class="empty-desc">Naya book order add karein ya Indian Post ke shipping labels upload karke auto-extract karein.</p>
            <div class="empty-actions">
              <button class="btn btn-primary btn-sm" onclick="window.KPApp.navigateTo('add-order')">+ Add New Order</button>
              <button class="btn btn-secondary btn-sm" onclick="window.KPApp.navigateTo('shipping-labels')">📄 Import Labels</button>
            </div>
          </div>
        `;
      } else {
        recentOrdersContainer.innerHTML = orders.map(o => `
          <div class="recent-order-item" onclick="window.KPApp.openOrderDetailsModal('${o.orderId}')">
            <div class="recent-order-main">
              <div class="order-id-badge">${o.orderId}</div>
              <div class="customer-info">
                <strong>${escapeHTML(o.customerName)}</strong>
                <span class="sub-text">📞 ${o.mobile} • ${escapeHTML(o.city || 'India')}</span>
              </div>
            </div>
            <div class="recent-order-book">
              <span class="book-pill">📚 ${escapeHTML(o.bookName)}</span>
              <span class="tracking-pill" ${o.trackingId ? `onclick="event.stopPropagation(); window.KPApp.copyTracking('${escapeHTML(o.trackingId)}')" style="cursor:pointer;" title="Click to Copy Tracking ID"` : ''}>
                ${o.trackingId ? '🚚 ' + escapeHTML(o.trackingId) + ' 📋' : '⚠️ No Tracking'}
              </span>
            </div>
            <div class="recent-order-status">
              <span class="status-badge badge-${(o.orderStatus || 'packed').toLowerCase()}">${o.orderStatus}</span>
              <span class="status-badge badge-wa-${(o.whatsappStatus || 'pending').toLowerCase().replace(/\s+/g, '-')}">${o.whatsappStatus}</span>
            </div>
          </div>
        `).join('');
      }
    }
  }

  function setCardValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // 2. FILTER & SEARCH ENGINE FOR ORDERS
  function getFilteredOrders() {
    const orders = window.KPStorage.getOrders();
    const query = state.searchQuery.trim().toLowerCase();
    const status = state.statusFilter;
    const payment = state.paymentFilter;
    const wa = state.whatsappFilter;
    const dateRange = state.dateFilter;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return orders.filter(o => {
      // 1. Text Search across 7 key fields (Customer, Mobile, Book, Tracking, Order ID, PIN, City)
      if (query) {
        const match = 
          (o.customerName && o.customerName.toLowerCase().includes(query)) ||
          (o.mobile && o.mobile.includes(query)) ||
          (o.bookName && o.bookName.toLowerCase().includes(query)) ||
          (o.trackingId && o.trackingId.toLowerCase().includes(query)) ||
          (o.orderId && o.orderId.toLowerCase().includes(query)) ||
          (o.pincode && o.pincode.includes(query)) ||
          (o.city && o.city.toLowerCase().includes(query));
        if (!match) return false;
      }

      // 2. Order Status Filter
      if (status !== 'all' && o.orderStatus !== status) {
        return false;
      }

      // 3. Payment Filter
      if (payment !== 'all') {
        const oPay = (o.paymentStatus || '').toLowerCase();
        const fPay = payment.toLowerCase();
        if (fPay === 'cod') {
          if (oPay !== 'cod' && oPay !== 'cod pending') return false;
        } else if (fPay === 'online') {
          if (oPay !== 'online' && oPay !== 'paid') return false;
        } else if (oPay !== fPay) {
          return false;
        }
      }

      // 4. WhatsApp Status Filter
      if (wa !== 'all') {
        if (wa === 'Pending' && !o.whatsappStatus.includes('Pending')) return false;
        if (wa === 'Sent' && !o.whatsappStatus.includes('Sent')) return false;
        if (wa === 'Failed' && o.whatsappStatus !== 'Failed') return false;
      }

      // 5. Date Filter
      if (dateRange !== 'all') {
        const orderDate = o.orderDate || (o.createdDate ? o.createdDate.split('T')[0] : '');
        if (dateRange === 'today' && orderDate !== todayStr) return false;
        if (dateRange === 'yesterday') {
          const y = new Date(now);
          y.setDate(y.getDate() - 1);
          if (orderDate !== y.toISOString().split('T')[0]) return false;
        }
        if (dateRange === '7days') {
          const d = new Date(now);
          d.setDate(d.getDate() - 7);
          if (orderDate < d.toISOString().split('T')[0]) return false;
        }
        if (dateRange === '30days') {
          const d = new Date(now);
          d.setDate(d.getDate() - 30);
          if (orderDate < d.toISOString().split('T')[0]) return false;
        }
        if (dateRange === 'custom') {
          if (state.customStartDate && orderDate < state.customStartDate) return false;
          if (state.customEndDate && orderDate > state.customEndDate) return false;
        }
      }

      return true;
    });
  }

  // 3. RENDER ORDERS TABLE (Single Source of Truth across all devices)
  function renderOrdersTable() {
    const container = document.getElementById('orders-table-body');
    const countBadge = document.getElementById('orders-filtered-count');
    const bulkBar = document.getElementById('orders-bulk-bar');
    const bulkCount = document.getElementById('orders-selected-count');

    // Sync filter controls with state
    if (state.searchQuery && state.searchQuery.trim().toLowerCase() === 'admin') {
      state.searchQuery = '';
    }

    const searchInput = document.getElementById('table-search-input');
    if (searchInput) {
      if (searchInput.value && searchInput.value.trim().toLowerCase() === 'admin') {
        searchInput.value = '';
      } else if (searchInput.value !== state.searchQuery) {
        searchInput.value = state.searchQuery;
      }
    }

    const globalSearch = document.getElementById('global-search-input');
    if (globalSearch && globalSearch.value && globalSearch.value.trim().toLowerCase() === 'admin') {
      globalSearch.value = '';
    }
    const statusSelect = document.getElementById('table-filter-status');
    if (statusSelect) statusSelect.value = state.statusFilter;
    const paymentSelect = document.getElementById('table-filter-payment');
    if (paymentSelect) paymentSelect.value = state.paymentFilter;
    const waSelect = document.getElementById('table-filter-wa');
    if (waSelect) waSelect.value = state.whatsappFilter;
    const dateSelect = document.getElementById('table-filter-date');
    if (dateSelect) dateSelect.value = state.dateFilter;

    const filtered = getFilteredOrders();
    if (countBadge) countBadge.textContent = `${filtered.length} Orders`;

    // Bulk selection bar visibility
    const selCount = state.selectedOrderIds.size;
    if (bulkBar && bulkCount) {
      if (selCount > 0) {
        bulkBar.classList.add('visible');
        bulkCount.textContent = `${selCount} Selected`;
      } else {
        bulkBar.classList.remove('visible');
      }
    }

    if (filtered.length === 0) {
      const allOrders = window.KPStorage.getOrders();
      let emptyHTML = '';
      if (allOrders.length === 0) {
        emptyHTML = `
          <div class="empty-state">
            <div class="empty-icon-bubble">📦</div>
            <h3 class="empty-title">Order Registry Khali Hai (No Orders Found)</h3>
            <p class="empty-desc">Aapne abhi tak koi order add nahi kiya hai. Naya order banayein ya Indian Post shipping labels upload karein.</p>
            <div class="empty-actions" style="margin-top:14px; display:flex; justify-content:center; gap:10px;">
              <button class="btn btn-primary btn-sm" onclick="window.KPApp.navigateTo('add-order')">+ Add New Order</button>
              <button class="btn btn-secondary btn-sm" onclick="window.KPApp.navigateTo('shipping-labels')">📄 Import Shipping Labels</button>
            </div>
          </div>
        `;
      } else {
        emptyHTML = `
          <div class="empty-state">
            <div class="empty-icon-bubble">🔍</div>
            <h3 class="empty-title">Is Filter Ke Sath Koi Order Nahi Mila</h3>
            <p class="empty-desc">Search keyword ya filter options ko reset karke dobara check karein.</p>
            <div class="empty-actions" style="margin-top:14px; display:flex; justify-content:center;">
              <button class="btn btn-secondary btn-sm" onclick="window.KPApp.resetFilters()">Clear All Filters</button>
            </div>
          </div>
        `;
      }
      if (container) container.innerHTML = `<tr><td colspan="15">${emptyHTML}</td></tr>`;
      return;
    }

    // Desktop Table HTML
    if (container) {
      container.innerHTML = filtered.map((o, idx) => {
        const isSelected = state.selectedOrderIds.has(o.orderId);
        const trackingDisplay = o.trackingId 
          ? `<span class="tracking-copy-badge font-mono" onclick="window.KPApp.copyTracking('${escapeHTML(o.trackingId)}')" title="Click to Copy Tracking ID">
               <span>${escapeHTML(o.trackingId)}</span>
               <span style="font-size:0.75rem;">📋</span>
             </span>`
          : `<span class="text-muted text-xs">No Tracking</span>
             <button class="btn-xs btn-outline" onclick="window.KPApp.openEditTrackingModal('${o.orderId}')">+ Add</button>`;

        return `
          <tr class="${isSelected ? 'row-selected' : ''}">
            <td class="col-checkbox">
              <input type="checkbox" class="order-select-checkbox" data-id="${o.orderId}" ${isSelected ? 'checked' : ''} onchange="window.KPApp.toggleSelectOrder('${o.orderId}')">
            </td>
            <td class="col-sno">${idx + 1}</td>
            <td class="col-id">
              <a href="javascript:void(0)" class="order-link font-mono" onclick="window.KPApp.openOrderDetailsModal('${o.orderId}')">${o.orderId}</a>
            </td>
            <td class="col-customer" style="white-space:nowrap;">
              <div class="cell-customer" style="white-space:nowrap;">
                <strong style="white-space:nowrap; display:block;">${escapeHTML(o.customerName)}</strong>
                <span class="sub-text" style="white-space:nowrap;">${escapeHTML(o.city || '')}${o.pincode ? ` (${o.pincode})` : ''}</span>
              </div>
            </td>
            <td class="col-mobile" style="white-space:nowrap;">
              <a href="tel:${o.mobile}" class="phone-link font-mono" style="white-space:nowrap;">${o.mobile}</a>
            </td>
            <td class="col-date text-xs text-muted" style="white-space:nowrap;">${o.orderDate || ''}</td>
            <td class="col-book" style="white-space:nowrap;">
              <div class="cell-book" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;" onclick="window.KPApp.openQuickEditBookAmountModal('${o.orderId}')" title="Click to Change Book or Amount">
                <span class="book-name-text" style="white-space:nowrap;">${escapeHTML(o.bookName)}</span>
                <span class="qty-pill" style="white-space:nowrap;">x${o.quantity || 1} ✏️</span>
              </div>
            </td>
            <td class="col-tracking">
              <div class="cell-tracking">${trackingDisplay}</div>
            </td>
            <td class="col-address">
              <button class="btn-xs btn-outline" onclick="window.KPApp.openAddressModal('${o.orderId}')" title="View & Copy Address">📍 Address</button>
            </td>
            <td class="col-cod font-semibold" style="cursor:pointer;" onclick="window.KPApp.openQuickEditBookAmountModal('${o.orderId}')" title="Click to Change Amount">
              ₹${o.codAmount || 0} <span style="font-size:0.75rem; color:var(--text-light);">✏️</span>
            </td>
            <td class="col-status">
              <select class="status-select status-select-${(o.orderStatus || 'packed').toLowerCase()}" onchange="window.KPApp.quickChangeStatus('${o.orderId}', this.value)">
                <option value="Packed" ${o.orderStatus === 'Packed' ? 'selected' : ''}>Packed</option>
                <option value="Shipped" ${o.orderStatus === 'Shipped' ? 'selected' : ''}>Shipped</option>
                <option value="Delivered" ${o.orderStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
                <option value="Returned" ${o.orderStatus === 'Returned' ? 'selected' : ''}>Returned</option>
                <option value="Cancelled" ${o.orderStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </td>
            <td class="col-payment">
              <span class="status-badge badge-pay-${(o.paymentStatus || 'cod-pending').toLowerCase().replace(/\s+/g, '-')}">${o.paymentStatus}</span>
            </td>
            <td class="col-wa">
              <span class="status-badge badge-wa-${(o.whatsappStatus || 'pending').toLowerCase().replace(/\s+/g, '-')}">${o.whatsappStatus}</span>
            </td>
            <td class="col-delivered text-xs text-muted">${o.deliveredDate || '-'}</td>
            <td class="col-actions">
              <div class="row-actions">
                <button class="btn-action btn-wa" title="Send WhatsApp Message" onclick="window.KPWhatsApp.sendTrackingMessage('${o.orderId}')">
                  💬
                </button>
                <button class="btn-action" title="Change Book & Amount" onclick="window.KPApp.openQuickEditBookAmountModal('${o.orderId}')">
                  📖
                </button>
                <button class="btn-action" title="View Details" onclick="window.KPApp.openOrderDetailsModal('${o.orderId}')">
                  👁️
                </button>
                <button class="btn-action" title="Edit Full Order" onclick="window.KPApp.editOrder('${o.orderId}')">
                  ✏️
                </button>
                <button class="btn-action btn-danger" title="Delete Order" onclick="window.KPApp.confirmDeleteOrder('${o.orderId}')">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Update Select All Checkbox state
    const selectAllCheckbox = document.getElementById('select-all-orders-checkbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = filtered.length > 0 && filtered.every(o => state.selectedOrderIds.has(o.orderId));
    }
  }

  // 4. ADD & EDIT ORDER FORM LOGIC
  function renderOrderForm() {
    const formTitle = document.getElementById('order-form-title');
    const saveBtn = document.getElementById('btn-save-order');
    const updateBtn = document.getElementById('btn-update-order');
    const orderIdField = document.getElementById('form-order-id');

    if (state.editingOrderId) {
      const order = window.KPStorage.getOrderById(state.editingOrderId);
      if (order) {
        if (formTitle) formTitle.textContent = `Edit Order: ${order.orderId}`;
        if (saveBtn) saveBtn.style.display = 'none';
        if (updateBtn) updateBtn.style.display = 'inline-flex';
        populateOrderForm(order);
        return;
      }
    }

    // New Order Mode
    if (formTitle) formTitle.textContent = 'Add New Book Order';
    if (saveBtn) saveBtn.style.display = 'inline-flex';
    if (updateBtn) updateBtn.style.display = 'none';
    clearOrderForm();
    if (orderIdField) orderIdField.value = window.KPStorage.generateOrderId();
  }

  function populateOrderForm(order) {
    setValue('form-order-id', order.orderId);
    setValue('form-customer-name', order.customerName);
    setValue('form-mobile', order.mobile);
    setValue('form-address', order.address);
    setValue('form-address-type', order.addressType || 'Home');
    setValue('form-city', order.city);
    setValue('form-state', order.state);
    setValue('form-pincode', order.pincode);
    setValue('form-book-name', order.bookName);
    setValue('form-quantity', order.quantity || 1);
    setValue('form-order-date', order.orderDate || new Date().toISOString().split('T')[0]);
    setValue('form-tracking-id', order.trackingId || '');
    setValue('form-courier', order.courier || 'India Post');
    setValue('form-cod-amount', order.codAmount || 0);
    const payStatus = (order.paymentStatus === 'Online' || order.paymentStatus === 'Paid') ? 'Online' : 'COD';
    setValue('form-payment-status', payStatus);
    setValue('form-order-status', order.orderStatus || 'Packed');
    setValue('form-delivered-date', order.deliveredDate || '');
    setValue('form-remarks', order.remarks || '');
  }

  function clearOrderForm() {
    state.editingOrderId = null;
    setValue('form-order-id', window.KPStorage.generateOrderId());
    setValue('form-customer-name', '');
    setValue('form-mobile', '');
    setValue('form-address', '');
    setValue('form-address-type', 'Home');
    setValue('form-city', '');
    setValue('form-state', '');
    setValue('form-pincode', '');
    const defaultBk = (window.KPStorage.getSettings && window.KPStorage.getSettings().defaultBook) || '';
    setValue('form-book-name', defaultBk);
    setValue('form-quantity', '1');
    setValue('form-order-date', new Date().toISOString().split('T')[0]);
    setValue('form-tracking-id', '');
    setValue('form-courier', 'India Post');
    setValue('form-cod-amount', '0');
    setValue('form-payment-status', 'COD');
    setValue('form-order-status', 'Packed');
    setValue('form-delivered-date', '');
    setValue('form-remarks', '');

    const formTitle = document.getElementById('order-form-title');
    const saveBtn = document.getElementById('btn-save-order');
    const updateBtn = document.getElementById('btn-update-order');
    if (formTitle) formTitle.textContent = 'Add New Book Order';
    if (saveBtn) saveBtn.style.display = 'inline-flex';
    if (updateBtn) updateBtn.style.display = 'none';
  }

  function getFormData() {
    return {
      orderId: getValue('form-order-id').trim(),
      customerName: getValue('form-customer-name').trim(),
      mobile: getValue('form-mobile').trim(),
      address: getValue('form-address').trim(),
      addressType: getValue('form-address-type'),
      city: getValue('form-city').trim(),
      state: getValue('form-state').trim(),
      pincode: getValue('form-pincode').trim(),
      bookName: getValue('form-book-name').trim(),
      quantity: parseInt(getValue('form-quantity'), 10) || 1,
      orderDate: getValue('form-order-date') || new Date().toISOString().split('T')[0],
      trackingId: getValue('form-tracking-id').trim(),
      courier: getValue('form-courier'),
      codAmount: parseFloat(getValue('form-cod-amount')) || 0,
      paymentStatus: getValue('form-payment-status'),
      orderStatus: getValue('form-order-status'),
      deliveredDate: getValue('form-delivered-date'),
      remarks: getValue('form-remarks').trim()
    };
  }

  function validateOrderForm(data) {
    if (!data.customerName || data.customerName.length < 2) {
      showToast('Customer Name is required (minimum 2 characters)', 'warning');
      focusField('form-customer-name');
      return false;
    }

    const cleanMobile = data.mobile.replace(/\D/g, '').slice(-10);
    if (!cleanMobile || cleanMobile.length !== 10 || !/^[6-9]/.test(cleanMobile)) {
      showToast('Please enter a valid 10-digit Indian Mobile number (starts with 6, 7, 8 or 9)', 'warning');
      focusField('form-mobile');
      return false;
    }

    if (!data.address || data.address.length < 5) {
      showToast('Complete Delivery Address is required', 'warning');
      focusField('form-address');
      return false;
    }

    if (!data.city) {
      showToast('City is required', 'warning');
      focusField('form-city');
      return false;
    }

    if (!data.state) {
      showToast('State is required', 'warning');
      focusField('form-state');
      return false;
    }

    if (!data.pincode || !/^[1-9]\d{5}$/.test(data.pincode)) {
      showToast('Please enter a valid 6-digit PIN code', 'warning');
      focusField('form-pincode');
      return false;
    }

    if (!data.bookName) {
      showToast('Book Name is required', 'warning');
      focusField('form-book-name');
      return false;
    }

    return true;
  }

  async function handleSaveOrder(forceDuplicate = false) {
    const data = getFormData();
    if (!validateOrderForm(data)) return;

    const res = await window.KPStorage.saveOrder(data, forceDuplicate);
    if (!res.success) {
      if (res.duplicate) {
        openDuplicateWarningModal(data, res.existing, () => {
          handleSaveOrder(true);
        });
        return;
      }
      showToast(`Error saving order: ${res.message || 'Unknown error'}`, 'error');
      return;
    }

    if (window.KPStorage.addBook && data.bookName) {
      await window.KPStorage.addBook(data.bookName);
    }

    showToast('Order saved successfully!', 'success');
    clearOrderForm();
    navigateTo('orders-all');
  }

  async function handleUpdateOrder() {
    if (!state.editingOrderId) return;
    const data = getFormData();
    if (!validateOrderForm(data)) return;

    const res = await window.KPStorage.updateOrder(state.editingOrderId, data);
    if (!res.success) {
      if (res.duplicate) {
        showToast(`Cannot update: ${res.reason}`, 'warning');
        return;
      }
      showToast(`Error updating order: ${res.message || 'Unknown error'}`, 'error');
      return;
    }

    if (window.KPStorage.addBook && data.bookName) {
      await window.KPStorage.addBook(data.bookName);
    }

    showToast('Order updated successfully!', 'success');
    state.editingOrderId = null;
    clearOrderForm();
    navigateTo('orders-all');
  }

  function editOrder(orderId) {
    state.editingOrderId = orderId;
    navigateTo('add-order');
  }

  // 5. QUICK STATUS CHANGE LOGIC
  async function quickChangeStatus(orderId, newStatus) {
    const order = window.KPStorage.getOrderById(orderId);
    if (!order) return;

    if (newStatus === 'Shipped' && (!order.trackingId || !order.trackingId.trim())) {
      openEditTrackingModal(orderId, () => {
        window.KPStorage.updateOrder(orderId, { orderStatus: 'Shipped' });
        showToast(`Order status updated to Shipped!`, 'success');
        renderOrdersTable();
      });
      return;
    }

    const updates = { orderStatus: newStatus };
    if (newStatus === 'Delivered' && !order.deliveredDate) {
      updates.deliveredDate = new Date().toISOString().split('T')[0];
    }

    await window.KPStorage.updateOrder(orderId, updates);
    showToast(`Order marked as ${newStatus}`, 'success');
    renderOrdersTable();
    renderDashboard();
  }

  // 6. WHATSAPP MESSAGES DEDICATED PAGE
  function renderWhatsAppMessagesPage() {
    const container = document.getElementById('whatsapp-messages-table-body');
    const selectedBadge = document.getElementById('whatsapp-selected-count');
    const orders = window.KPStorage.getOrders();
    const filter = state.bulkWhatsAppFilter;

    const filtered = orders.filter(o => {
      if (filter === 'Pending') return o.whatsappStatus.includes('Pending');
      if (filter === 'Sent') return o.whatsappStatus.includes('Sent');
      if (filter === 'Failed') return o.whatsappStatus === 'Failed';
      return true;
    });

    if (selectedBadge) {
      selectedBadge.textContent = `Selected: ${state.bulkSelectedOrderIds.size}`;
    }

    if (container) {
      if (filtered.length === 0) {
        const allOrders = window.KPStorage.getOrders();
        let emptyWaHTML = '';
        if (allOrders.length === 0) {
          emptyWaHTML = `
            <tr><td colspan="9">
              <div class="empty-state">
                <div class="empty-icon-bubble">💬</div>
                <h3 class="empty-title">WhatsApp Dispatch Queue Khali Hai</h3>
                <p class="empty-desc">Orders add karein aur Tracking ID assign karein taaki yahan customer WhatsApp dispatch list show ho sake.</p>
                <div style="margin-top:14px; display:flex; justify-content:center; gap:10px;">
                  <button class="btn btn-primary btn-sm" onclick="window.KPApp.navigateTo('add-order')">+ Add Order</button>
                  <button class="btn btn-secondary btn-sm" onclick="window.KPApp.navigateTo('shipping-labels')">📄 Import Labels</button>
                </div>
              </div>
            </td></tr>
          `;
        } else {
          emptyWaHTML = `
            <tr><td colspan="9">
              <div class="empty-state">
                <div class="empty-icon-bubble">🔍</div>
                <h3 class="empty-title">Is WhatsApp Status Ke Liye Koi Order Nahi Hai</h3>
                <p class="empty-desc">"All", "Pending", ya "Sent" filters check karein.</p>
              </div>
            </td></tr>
          `;
        }
        container.innerHTML = emptyWaHTML;
        return;
      }

      container.innerHTML = filtered.map((o, idx) => {
        const isSelected = state.bulkSelectedOrderIds.has(o.orderId);
        const hasTracking = Boolean(o.trackingId && o.trackingId.trim());

        return `
          <tr class="${isSelected ? 'row-selected' : ''}">
            <td>
              <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="window.KPApp.toggleBulkWhatsAppSelect('${o.orderId}')">
            </td>
            <td>${idx + 1}</td>
            <td style="white-space:nowrap;">
              <strong style="white-space:nowrap; display:block;">${escapeHTML(o.customerName)}</strong>
              <span class="sub-text font-mono" style="white-space:nowrap;">${o.orderId}</span>
            </td>
            <td class="font-mono" style="white-space:nowrap;">${o.mobile}</td>
            <td style="white-space:nowrap;"><strong style="white-space:nowrap;">${escapeHTML(o.bookName)}</strong></td>
            <td>
              ${hasTracking ? `
                <span class="tracking-copy-badge font-mono" onclick="window.KPApp.copyTracking('${escapeHTML(o.trackingId)}')" title="Click to Copy Tracking ID">
                  <span>${escapeHTML(o.trackingId)}</span>
                  <span style="font-size:0.75rem;">📋</span>
                </span>
              ` : '<span class="text-danger text-xs">⚠️ Missing</span>'}
            </td>
            <td>
              <span class="status-badge badge-${(o.orderStatus || 'packed').toLowerCase()}">${o.orderStatus}</span>
            </td>
            <td>
              <span class="status-badge badge-wa-${(o.whatsappStatus || 'pending').toLowerCase().replace(/\s+/g, '-')}">${o.whatsappStatus}</span>
            </td>
            <td>
              <button class="btn btn-sm btn-wa-send" onclick="window.KPWhatsApp.sendTrackingMessage('${o.orderId}')" ${!hasTracking ? 'disabled title="Add tracking ID first"' : ''}>
                💬 Send
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  function filterWhatsAppMessages(type) {
    state.bulkWhatsAppFilter = type;
    document.querySelectorAll('.wa-filter-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-filter') === type);
    });
    renderWhatsAppMessagesPage();
  }

  function selectAllWhatsApp(onlyPending = false) {
    const orders = window.KPStorage.getOrders();
    state.bulkSelectedOrderIds.clear();
    orders.forEach(o => {
      if (onlyPending) {
        if (o.whatsappStatus.includes('Pending') && o.trackingId) {
          state.bulkSelectedOrderIds.add(o.orderId);
        }
      } else {
        if (o.trackingId) {
          state.bulkSelectedOrderIds.add(o.orderId);
        }
      }
    });
    renderWhatsAppMessagesPage();
    showToast(`${state.bulkSelectedOrderIds.size} orders selected`, 'info');
  }

  function openBulkWhatsAppModal() {
    const selectedIds = Array.from(state.bulkSelectedOrderIds);
    if (selectedIds.length === 0) {
      showToast('Please select at least one order to send WhatsApp message.', 'warning');
      return;
    }

    const modal = document.getElementById('modal-bulk-whatsapp');
    const queueList = document.getElementById('bulk-queue-items');
    const statusText = document.getElementById('bulk-status-text');
    const progressBar = document.getElementById('bulk-progress-bar');
    const countText = document.getElementById('bulk-confirm-count');

    if (countText) countText.textContent = `${selectedIds.length} WhatsApp messages are ready to send.`;

    const items = window.KPWhatsApp.initBulkQueue(
      selectedIds,
      (queue) => {
        // Progress update
        const pct = Math.round((queue.currentIndex / queue.items.length) * 100);
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (statusText) statusText.textContent = `Processing: ${queue.currentIndex} of ${queue.items.length}`;
        renderBulkQueueDOM(queue, queueList);
      },
      () => {
        // Complete
        if (statusText) statusText.textContent = 'All messages processed!';
        showToast('Bulk dispatch completed!', 'success');
        renderWhatsAppMessagesPage();
        renderOrdersTable();
      }
    );

    renderBulkQueueDOM(window.KPWhatsApp.bulkQueue, queueList);
    if (modal) modal.classList.add('modal-open');
  }

  function renderBulkQueueDOM(queue, container) {
    if (!container) return;
    container.innerHTML = queue.items.map((item, idx) => `
      <div class="bulk-item-row status-${(item.status || 'ready').toLowerCase()}">
        <div class="bulk-item-info">
          <strong>${idx + 1}. ${escapeHTML(item.order.customerName)}</strong>
          <span class="font-mono">(${item.order.mobile})</span>
          <div class="text-xs text-muted" style="margin-top:2px;">
            Tracking: 
            ${item.order.trackingId ? `
              <span class="tracking-copy-badge" style="font-size:0.75rem; padding:1px 6px;" onclick="window.KPApp.copyTracking('${escapeHTML(item.order.trackingId)}')" title="Click to Copy Tracking ID">
                ${escapeHTML(item.order.trackingId)} 📋
              </span>
            ` : '<span class="text-danger">N/A</span>'}
          </div>
        </div>
        <div class="bulk-item-status">
          <span class="status-pill status-${(item.status || 'ready').toLowerCase()}">${item.status}</span>
          ${item.status === 'Ready' || item.status === 'Failed' ? `
            <button class="btn-xs btn-primary" onclick="window.KPWhatsApp.processNextBulkItem()">Send Now</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  // 7. SHIPPING LABELS & PDF IMPORT
  function renderShippingLabelsPage() {
    const container = document.getElementById('labels-preview-container');
    const orders = window.KPStorage.getOrders();
    // Default to packed orders or first 10
    const toRender = orders.filter(o => o.orderStatus === 'Packed').slice(0, 12);
    if (container && window.KPLabelGenerator) {
      window.KPLabelGenerator.renderLabels(toRender.length > 0 ? toRender : orders.slice(0, 8), container);
    }
  }

  // Unified Multi-File / Batch Label Upload Engine (Handles multiple PDFs, Excel sheets, images, and text)
  async function handleBatchUpload(fileList) {
    if (!fileList) return;
    const files = Array.isArray(fileList) ? fileList : Array.from(fileList);
    if (files.length === 0) return;

    const progressModal = document.getElementById('modal-pdf-progress');
    const progressBar = document.getElementById('pdf-progress-bar');
    const statusText = document.getElementById('pdf-status-text');

    if (progressModal) progressModal.classList.add('modal-open');
    if (progressBar) progressBar.style.width = '10%';
    if (statusText) statusText.textContent = `Analyzing ${files.length} file(s)...`;

    const allCandidates = [];
    const pdfFiles = [];
    const excelFiles = [];
    const textFiles = [];
    const imageFiles = [];

    files.forEach(f => {
      const name = (f.name || '').toLowerCase();
      if (/\.pdf$/i.test(name)) {
        pdfFiles.push(f);
      } else if (/\.(xlsx|xls|csv)$/i.test(name)) {
        excelFiles.push(f);
      } else if (/\.(txt|log|text)$/i.test(name)) {
        textFiles.push(f);
      } else if (/\.(png|jpe?g|webp|bmp)$/i.test(name)) {
        imageFiles.push(f);
      } else {
        pdfFiles.push(f);
      }
    });

    let processedCount = 0;
    const totalFiles = files.length;

    // 1. Process Excel / Spreadsheet files
    for (const ef of excelFiles) {
      try {
        if (statusText) statusText.textContent = `Reading Excel: ${ef.name}...`;
        if (window.KPExcelImporter) {
          const res = await window.KPExcelImporter.parseExcelFile(ef);
          if (res && res.candidates && res.candidates.length > 0) {
            allCandidates.push(...res.candidates);
          }
        }
      } catch (err) {
        console.error('Error parsing Excel file:', ef.name, err);
      }
      processedCount++;
      if (progressBar) progressBar.style.width = `${Math.round((processedCount / totalFiles) * 100)}%`;
    }

    // 2. Process Shipping Label Files (PDFs and Images: PNG, JPG, JPEG, WEBP)
    const labelFiles = [...pdfFiles, ...imageFiles];
    if (labelFiles.length > 0) {
      try {
        if (statusText) statusText.textContent = `Scanning & parsing ${labelFiles.length} shipping label(s)...`;
        
        let labelCandidates = [];
        if (window.KPIndiaPostImporter && typeof window.KPIndiaPostImporter.processUploadedFiles === 'function') {
          labelCandidates = await window.KPIndiaPostImporter.processUploadedFiles(labelFiles, (p) => {
            if (progressBar) {
              const basePct = Math.round((processedCount / totalFiles) * 100);
              const fileSlice = 100 / totalFiles;
              const subPct = Math.round(((p.fileIndex || 1) / totalFiles) * fileSlice);
              progressBar.style.width = `${Math.min(95, basePct + subPct)}%`;
            }
            if (statusText) {
              statusText.textContent = p.status || `Reading ${p.fileName || 'label'}...`;
            }
          });
        } else if (window.KPPdfImporter && typeof window.KPPdfImporter.extractCandidatesFromPDFs === 'function') {
          labelCandidates = await window.KPPdfImporter.extractCandidatesFromPDFs(pdfFiles, (p) => {
            if (progressBar) {
              const basePct = Math.round((processedCount / totalFiles) * 100);
              const fileSlice = 100 / totalFiles;
              const subPct = Math.round((p.pageNumber / (p.totalPages || 1)) * fileSlice);
              progressBar.style.width = `${Math.min(95, basePct + subPct)}%`;
            }
            if (statusText) {
              statusText.textContent = `Reading ${p.fileName} (Page ${p.pageNumber} of ${p.totalPages})...`;
            }
          });
        }

        if (labelCandidates && labelCandidates.length > 0) {
          labelCandidates.forEach(cand => {
            const defBook = ((window.KPStorage && window.KPStorage.getSettings) ? window.KPStorage.getSettings().defaultBook : 'Gyan Ganga') || 'Gyan Ganga';
            allCandidates.push({
              fileName: cand.fileName || 'Shipping Label',
              page: cand.pageNumber || 1,
              isScanned: cand.isScanned,
              trackingId: cand.trackingId || '',
              customerName: (cand.customerName && cand.customerName !== 'Not Found') ? cand.customerName : '',
              mobile: (cand.contactNumber && cand.contactNumber !== 'Not Found') ? cand.contactNumber : (cand.mobile || ''),
              address: (cand.address && cand.address !== 'Not Found') ? cand.address : '',
              city: (cand.city && cand.city !== 'Not Found') ? cand.city : '',
              state: (cand.state && cand.state !== 'Not Found') ? cand.state : '',
              pincode: (cand.pincode && cand.pincode !== 'Not Found') ? cand.pincode : '',
              bookName: cand.bookName || defBook,
              codAmount: cand.codAmount || cand.amount || 0,
              paymentStatus: cand.paymentStatus || cand.paymentMode || 'COD',
              courier: cand.courier || 'India Post',
              isDuplicate: cand.isDuplicate || false,
              duplicateReason: cand.duplicateReason || '',
              previewImage: cand.previewImage || null,
              rawText: cand.rawText || ''
            });
          });
        }
      } catch (err) {
        console.error('Error reading label files:', err);
      }
      processedCount += labelFiles.length;
      if (progressBar) progressBar.style.width = `${Math.round((processedCount / totalFiles) * 100)}%`;
    }

    // 3. Process Text files
    for (const tf of textFiles) {
      try {
        const text = await tf.text();
        const defBook = ((window.KPStorage && window.KPStorage.getSettings) ? window.KPStorage.getSettings().defaultBook : 'Gyan Ganga') || 'Gyan Ganga';
        const parsed = (window.KPIndiaPostImporter && window.KPIndiaPostImporter.parseIndiaPostLabel)
          ? window.KPIndiaPostImporter.parseIndiaPostLabel(text, null, { fileName: tf.name })
          : (window.KPPdfImporter ? window.KPPdfImporter.parseShippingLabelText(text) : null);

        if (parsed) {
          const dup = window.KPStorage ? window.KPStorage.checkDuplicate(parsed) : { duplicate: false };
          allCandidates.push({
            fileName: tf.name,
            page: 1,
            isScanned: false,
            trackingId: parsed.trackingId || '',
            customerName: (parsed.customerName && parsed.customerName !== 'Not Found') ? parsed.customerName : '',
            mobile: (parsed.contactNumber && parsed.contactNumber !== 'Not Found') ? parsed.contactNumber : (parsed.mobile || ''),
            address: (parsed.address && parsed.address !== 'Not Found') ? parsed.address : '',
            city: (parsed.city && parsed.city !== 'Not Found') ? parsed.city : '',
            state: (parsed.state && parsed.state !== 'Not Found') ? parsed.state : '',
            pincode: (parsed.pincode && parsed.pincode !== 'Not Found') ? parsed.pincode : '',
            bookName: parsed.bookName || defBook,
            codAmount: parsed.codAmount || parsed.amount || 0,
            paymentStatus: parsed.paymentStatus || parsed.paymentMode || 'COD',
            courier: parsed.courier || 'India Post',
            isDuplicate: dup.duplicate,
            duplicateReason: dup.reason || '',
            rawText: text
          });
        }
      } catch (err) {
        console.error('Error reading text file:', tf.name, err);
      }
      processedCount++;
    }

    if (progressModal) progressModal.classList.remove('modal-open');

    if (allCandidates.length === 0) {
      showToast('Uploaded file(s) contain no readable labels or order rows.', 'warning');
      return;
    }

    // Ensure all candidates have a unique Order ID and Tracking ID
    allCandidates.forEach((c, idx) => {
      if (!c.trackingId) {
        c.trackingId = `KP-PENDING-${Date.now().toString().slice(-6)}-${idx + 1}`;
      }
      if (!c.orderId) {
        c.orderId = c.trackingId;
      }
    });

    state.pendingImportCandidates = allCandidates;

    const title = document.getElementById('import-review-modal-title');
    if (title) title.textContent = `🏷️ Shipping Labels Import (${allCandidates.length} Labels from ${files.length} File${files.length > 1 ? 's' : ''})`;

    const badge = document.getElementById('import-review-total-count');
    if (badge) badge.textContent = `${allCandidates.length} Labels Found`;

    openIndiaPostReviewModal(allCandidates);
    showToast(`✅ Loaded all ${allCandidates.length} label(s) from ${files.length} file(s)! Review details and click Save.`, 'success');
  }

  // Backwards-compatible aliases
  async function handleExcelUpload(file) {
    if (!file) return;
    return handleBatchUpload([file]);
  }

  async function handlePDFUpload(files) {
    if (!files || files.length === 0) return;
    return handleBatchUpload(files);
  }

  // Handle Pasted Text Import (India Post text, SMS, postal slips)
  function handlePastedTextImport() {
    const textarea = document.getElementById('paste-label-textarea');
    if (!textarea || !textarea.value.trim()) {
      showToast('Please paste India Post label or consignment text first.', 'warning');
      return;
    }

    const rawVal = textarea.value.trim();
    const defBook = ((window.KPStorage && window.KPStorage.getSettings) ? window.KPStorage.getSettings().defaultBook : 'Gyan Ganga') || 'Gyan Ganga';

    let candidates = [];
    if (window.KPIndiaPostImporter && typeof window.KPIndiaPostImporter.parseIndiaPostLabel === 'function') {
      const parsed = window.KPIndiaPostImporter.parseIndiaPostLabel(rawVal);
      const dup = window.KPStorage ? window.KPStorage.checkDuplicate(parsed) : { duplicate: false };
      candidates = [{
        fileName: 'Pasted Label',
        page: 1,
        isScanned: false,
        trackingId: parsed.trackingId || '',
        customerName: (parsed.customerName && parsed.customerName !== 'Not Found') ? parsed.customerName : '',
        mobile: (parsed.contactNumber && parsed.contactNumber !== 'Not Found') ? parsed.contactNumber : (parsed.mobile || ''),
        address: (parsed.address && parsed.address !== 'Not Found') ? parsed.address : '',
        city: (parsed.city && parsed.city !== 'Not Found') ? parsed.city : '',
        state: (parsed.state && parsed.state !== 'Not Found') ? parsed.state : '',
        pincode: (parsed.pincode && parsed.pincode !== 'Not Found') ? parsed.pincode : '',
        bookName: parsed.bookName || defBook,
        codAmount: parsed.codAmount || parsed.amount || 0,
        paymentStatus: parsed.paymentStatus || parsed.paymentMode || 'COD',
        courier: parsed.courier || 'India Post',
        isDuplicate: dup.duplicate,
        duplicateReason: dup.reason || '',
        rawText: rawVal
      }];
    } else if (window.KPPdfImporter) {
      const parsedList = window.KPPdfImporter.parsePastedText(rawVal);
      candidates = parsedList.map((p, idx) => {
        const dup = window.KPStorage.checkDuplicate(p);
        return {
          fileName: `Pasted Label #${idx + 1}`,
          page: 1,
          isScanned: false,
          trackingId: p.trackingId || '',
          customerName: p.customerName || '',
          mobile: p.mobile || '',
          address: p.address || '',
          city: p.city || p.state || 'Local',
          state: p.state || 'India',
          pincode: p.pincode || '',
          bookName: p.bookName || defBook,
          codAmount: p.codAmount || 0,
          paymentStatus: p.paymentStatus || 'COD',
          courier: p.courier || 'India Post',
          isDuplicate: dup.duplicate,
          duplicateReason: dup.reason || '',
          rawText: rawVal
        };
      });
    }

    state.pendingImportCandidates = candidates;
    textarea.value = '';
    openIndiaPostReviewModal(candidates);
  }

  // Open the India Post Review & Batch Book/Amount Editor Modal
  function openIndiaPostReviewModal(candidates) {
    const modal = document.getElementById('modal-india-post-review');
    const badge = document.getElementById('import-review-total-count');
    if (badge) badge.textContent = `${candidates.length} Labels Found`;

    // Prefill the batch book input with user default book setting
    const batchBookInput = document.getElementById('batch-import-book-input');
    if (batchBookInput) {
      const def = (window.KPStorage.getSettings && window.KPStorage.getSettings().defaultBook) || '';
      batchBookInput.value = def;
    }

    renderIndiaPostReviewTable();
    if (modal) modal.classList.add('modal-open');
  }

  // Render Table of Candidates in Review Modal
  function renderIndiaPostReviewTable() {
    const tbody = document.getElementById('import-review-table-body');
    if (!tbody) return;

    tbody.innerHTML = state.pendingImportCandidates.map((c, idx) => `
      <tr class="${c.isDuplicate ? 'dup-row' : ''}">
        <td>${idx + 1}</td>
        <td>
          <input type="text" class="form-input font-mono input-xs font-bold" value="${escapeHTML(c.trackingId)}" onchange="window.KPApp.updateCandidateField(${idx}, 'trackingId', this.value)" placeholder="Tracking ID">
          ${c.isDuplicate ? '<span class="status-badge badge-returned" style="font-size:0.65rem;">Duplicate</span>' : '<span class="status-badge badge-shipped" style="font-size:0.65rem;">India Post</span>'}
        </td>
        <td>
          <input type="text" class="form-input input-xs font-bold" value="${escapeHTML(c.customerName)}" onchange="window.KPApp.updateCandidateField(${idx}, 'customerName', this.value)" placeholder="Receiver Name">
        </td>
        <td>
          <input type="tel" class="form-input font-mono input-xs" value="${escapeHTML(c.mobile)}" onchange="window.KPApp.updateCandidateField(${idx}, 'mobile', this.value)" placeholder="Phone" maxlength="10">
        </td>
        <td>
          <textarea class="form-textarea input-xs" style="min-height:36px; font-size:0.78rem;" onchange="window.KPApp.updateCandidateField(${idx}, 'address', this.value)" placeholder="Delivery Address">${escapeHTML(c.address)}</textarea>
          <div style="display:flex; gap:4px; margin-top:4px;">
            <input type="text" class="form-input input-xs" style="width:34%; font-size:0.74rem;" value="${escapeHTML(c.city || '')}" placeholder="City / District" title="City" onchange="window.KPApp.updateCandidateField(${idx}, 'city', this.value)">
            <input type="text" class="form-input input-xs" style="width:36%; font-size:0.74rem; font-weight:700;" value="${escapeHTML(c.state || '')}" placeholder="State" title="State" onchange="window.KPApp.updateCandidateField(${idx}, 'state', this.value)">
            <input type="text" class="form-input font-mono input-xs" style="width:30%; font-size:0.74rem;" value="${escapeHTML(c.pincode || '')}" placeholder="PIN" title="PIN Code" maxlength="6" onchange="window.KPApp.updateCandidateField(${idx}, 'pincode', this.value)">
          </div>
        </td>
        <td>
          <input type="text" class="form-input input-xs font-semibold" list="book-suggestions" value="${escapeHTML(c.bookName || '')}" placeholder="Type any book name..." onchange="window.KPApp.updateCandidateField(${idx}, 'bookName', this.value)">
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:3px;">
            <span>₹</span>
            <input type="number" class="form-input input-xs font-bold" style="width:70px;" value="${c.codAmount || 0}" min="0" step="1" onchange="window.KPApp.updateCandidateField(${idx}, 'codAmount', this.value)">
          </div>
        </td>
        <td>
          <button class="btn-icon text-danger" title="Remove label" onclick="window.KPApp.removeCandidate(${idx})">❌</button>
        </td>
      </tr>
    `).join('');
  }

  function updateCandidateField(idx, field, value) {
    if (state.pendingImportCandidates[idx]) {
      state.pendingImportCandidates[idx][field] = field === 'codAmount' ? (parseFloat(value) || 0) : value;
      if (field === 'codAmount') {
        state.pendingImportCandidates[idx].paymentStatus = state.pendingImportCandidates[idx].paymentStatus || 'COD';
      }
    }
  }

  function removeCandidate(idx) {
    state.pendingImportCandidates.splice(idx, 1);
    renderIndiaPostReviewTable();
    const badge = document.getElementById('import-review-total-count');
    if (badge) badge.textContent = `${state.pendingImportCandidates.length} Labels Found`;
  }

  // Batch Set Book for all candidates
  function applyBatchBookToCandidates(bookName) {
    const clean = (bookName || '').trim();
    if (!clean) return;
    if (window.KPStorage.addBook) {
      window.KPStorage.addBook(clean);
    }
    state.pendingImportCandidates.forEach(c => {
      c.bookName = clean;
    });
    renderIndiaPostReviewTable();
    showToast(`All imported books set to "${clean}"`, 'info');
  }

  // Batch Set Amount for all candidates
  function applyBatchAmountToCandidates(amount) {
    const num = parseFloat(amount) || 0;
    state.pendingImportCandidates.forEach(c => {
      c.codAmount = num;
      c.paymentStatus = 'COD';
    });
    renderIndiaPostReviewTable();
    showToast(`All imported amounts set to ₹${num}`, 'info');
  }

  // Save reviewed candidates into database with 100% save guarantee
  async function confirmAndSaveImportedCandidates() {
    if (!state.pendingImportCandidates || state.pendingImportCandidates.length === 0) {
      showToast('No candidates to import.', 'warning');
      return;
    }

    // Mark forceSave = true on ALL candidates so NONE are skipped or dropped
    state.pendingImportCandidates.forEach(c => { c.forceSave = true; });

    const saver = (window.KPPdfImporter && window.KPPdfImporter.saveReviewedOrders) || (window.KPExcelImporter && window.KPExcelImporter.saveImportedOrders);
    const res = await saver(state.pendingImportCandidates);
    closeModal('modal-india-post-review');
    
    showToast(`✅ Successfully saved and added all ${res.saved} labels to Orders Registry!`, 'success');
    state.pendingImportCandidates = [];
    
    renderDashboard();
    renderOrdersTable();
    navigateTo('orders-all');
  }

  // Quick Edit Book Name and Amount for single order
  function openQuickEditBookAmountModal(orderId) {
    const order = window.KPStorage.getOrderById(orderId);
    if (!order) return;
    state.quickEditOrderId = orderId;

    setValue('quick-edit-book-name', order.bookName);
    setValue('quick-edit-cod-amount', order.codAmount || 0);
    const quickPayStatus = (order.paymentStatus === 'Online' || order.paymentStatus === 'Paid') ? 'Online' : 'COD';
    setValue('quick-edit-payment-status', quickPayStatus);
    document.getElementById('quick-edit-customer-display').textContent = `${order.customerName} (${order.orderId})`;

    const modal = document.getElementById('modal-quick-edit-book-amount');
    if (modal) modal.classList.add('modal-open');
  }

  async function saveQuickEditBookAmount() {
    if (!state.quickEditOrderId) return;
    const newBook = getValue('quick-edit-book-name').trim();
    const newCod = parseFloat(getValue('quick-edit-cod-amount')) || 0;
    const newPayment = getValue('quick-edit-payment-status');

    if (!newBook) {
      showToast('Book Name cannot be empty', 'warning');
      return;
    }

    if (window.KPStorage.addBook) {
      await window.KPStorage.addBook(newBook);
    }

    await window.KPStorage.updateOrder(state.quickEditOrderId, {
      bookName: newBook,
      codAmount: newCod,
      paymentStatus: newPayment
    });

    closeModal('modal-quick-edit-book-amount');
    showToast('Book Name & Amount updated successfully!', 'success');
    state.quickEditOrderId = null;
    renderOrdersTable();
    renderDashboard();
  }

  // Bulk Change Book and Amount for all selected orders
  function openBulkChangeBookAmountModal() {
    if (state.selectedOrderIds.size === 0) {
      showToast('Please select orders using checkboxes first.', 'warning');
      return;
    }
    document.getElementById('bulk-change-count-text').textContent = `Changing details for ${state.selectedOrderIds.size} selected orders:`;
    const modal = document.getElementById('modal-bulk-change-book-amount');
    if (modal) modal.classList.add('modal-open');
  }

  async function saveBulkChangeBookAmount() {
    const changeBook = document.getElementById('bulk-apply-book-check').checked;
    const bookName = getValue('bulk-change-book-name').trim();
    const changeAmt = document.getElementById('bulk-apply-amt-check').checked;
    const amt = parseFloat(getValue('bulk-change-cod-amount')) || 0;
    const payStatus = getValue('bulk-change-payment-status');

    const updates = {};
    if (changeBook && bookName) {
      updates.bookName = bookName;
      if (window.KPStorage.addBook) {
        await window.KPStorage.addBook(bookName);
      }
    }
    if (changeAmt) {
      updates.codAmount = amt;
      updates.paymentStatus = payStatus;
    }

    if (Object.keys(updates).length === 0) {
      showToast('Please check at least one field to update.', 'warning');
      return;
    }

    for (const id of state.selectedOrderIds) {
      await window.KPStorage.updateOrder(id, updates);
    }

    closeModal('modal-bulk-change-book-amount');
    showToast(`Updated ${state.selectedOrderIds.size} orders successfully!`, 'success');
    state.selectedOrderIds.clear();
    renderOrdersTable();
    renderDashboard();
  }

  function openImportResultsModal(res) {
    const modal = document.getElementById('modal-import-results');
    document.getElementById('import-stat-imported').textContent = res.imported;
    document.getElementById('import-stat-duplicate').textContent = res.duplicates;
    document.getElementById('import-stat-failed').textContent = res.failed;
    document.getElementById('import-stat-ocr').textContent = res.ocrRequired;

    const list = document.getElementById('import-results-list');
    if (list) {
      list.innerHTML = res.items.map(item => `
        <div class="import-res-item status-${item.status.toLowerCase().replace(/\s+/g, '-')}">
          <div>
            <strong>${escapeHTML(item.fileName)}</strong> (Page ${item.page})
            ${item.customerName ? ` • ${escapeHTML(item.customerName)}` : ''}
            ${item.trackingId ? ` • Tracking: ${item.trackingId}` : ''}
          </div>
          <div>
            <span class="badge-${item.status.toLowerCase().replace(/\s+/g, '-')}">${item.status}</span>
            ${item.reason ? `<span class="text-xs text-muted"> (${item.reason})</span>` : ''}
          </div>
        </div>
      `).join('');
    }

    if (modal) modal.classList.add('modal-open');
  }

  // 8. REPORTS PAGE
  function renderReportsPage() {
    const filter = state.dateFilter === 'all' ? '30days' : state.dateFilter;
    const report = window.KPReports.getReportData(filter, state.customStartDate, state.customEndDate);

    setCardValue('report-total-orders', report.totalOrders);
    setCardValue('report-cod-amount', `₹${report.totalCodAmount.toLocaleString('en-IN')}`);
    setCardValue('report-paid-amount', `₹${report.paidAmount.toLocaleString('en-IN')}`);
    setCardValue('report-pending-cod', `₹${report.pendingCod.toLocaleString('en-IN')}`);
    setCardValue('report-delivered', report.deliveredOrders);
    setCardValue('report-returned', report.returnedOrders);
    setCardValue('report-cancelled', report.cancelledOrders);
    setCardValue('report-wa-sent', report.whatsappSent);
    setCardValue('report-wa-pending', report.whatsappPending);

    // Render Books Breakdown Table
    const booksContainer = document.getElementById('report-books-breakdown');
    if (booksContainer) {
      const entries = Object.entries(report.bookBreakdown);
      if (entries.length === 0) {
        booksContainer.innerHTML = '<tr><td colspan="2" class="text-muted">No book data for this period.</td></tr>';
      } else {
        booksContainer.innerHTML = entries.map(([book, qty]) => `
          <tr>
            <td><strong>📚 ${escapeHTML(book)}</strong></td>
            <td class="font-bold text-right">${qty}</td>
          </tr>
        `).join('');
      }
    }

    // Render Courier Breakdown Table
    const courierContainer = document.getElementById('report-courier-breakdown');
    if (courierContainer) {
      const entries = Object.entries(report.courierBreakdown);
      if (entries.length === 0) {
        courierContainer.innerHTML = '<tr><td colspan="2" class="text-muted">No courier data for this period.</td></tr>';
      } else {
        courierContainer.innerHTML = entries.map(([courier, cnt]) => `
          <tr>
            <td><strong>🚚 ${escapeHTML(courier)}</strong></td>
            <td class="font-bold text-right">${cnt}</td>
          </tr>
        `).join('');
      }
    }
  }

  // 9. SETTINGS PAGE
  function renderSettingsPage() {
    const s = window.KPStorage.getSettings();

    setValue('settings-business-name', s.businessName);
    setValue('settings-business-sub', s.businessSubtitle || 'Book Order Management System');
    setValue('settings-business-wa', s.businessWhatsApp);
    setValue('settings-sender-address', s.senderAddress);
    setValue('settings-firebase-url', s.firebaseDbUrl || (window.KPStorage.getFirebaseDbUrl ? window.KPStorage.getFirebaseDbUrl() : '') || '');
    setValue('settings-wa-mode', s.whatsappMode || 'manual');
    setValue('settings-cloud-token', s.cloudApiToken || '');
    setValue('settings-cloud-phone-id', s.cloudApiPhoneId || '');
    setValue('settings-cloud-biz-id', s.cloudApiBusinessId || '');
    setValue('settings-wa-template', s.whatsappTemplate || '');
    setValue('settings-default-status', s.defaultStatus || 'Packed');
    setValue('settings-default-payment', s.defaultPayment || 'COD');
    setValue('settings-default-book', s.defaultBook || '');

    renderSettingsBooksList();
    toggleCloudApiSettingsUI(s.whatsappMode === 'cloud_api');
  }

  function renderSettingsBooksList() {
    const container = document.getElementById('settings-books-chip-list');
    if (!container) return;

    const books = window.KPStorage.getBooks ? window.KPStorage.getBooks() : [];
    if (books.length === 0) {
      container.innerHTML = '<span style="font-size:0.85rem; color:var(--text-muted); font-style:italic;">No custom books saved yet. Add titles above.</span>';
      return;
    }

    container.innerHTML = books.map(book => `
      <span class="status-badge" style="display:inline-flex; align-items:center; gap:6px; font-size:0.82rem; padding:6px 12px; background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:20px; font-weight:600;">
        📖 ${escapeHTML(book)}
        <button type="button" onclick="window.KPApp.handleDeleteBook('${escapeHTML(book).replace(/'/g, "\\'")}')" style="background:none; border:none; color:var(--text-danger); cursor:pointer; font-size:0.85rem; padding:0 2px; line-height:1; font-weight:bold;" title="Remove this book title">✕</button>
      </span>
    `).join('');
  }

  async function handleAddNewBook() {
    const input = document.getElementById('settings-new-book-input');
    if (!input) return;
    const name = input.value.trim();
    if (!name) {
      showToast('Please type a book name to add.', 'warning');
      return;
    }
    if (window.KPStorage.addBook) {
      await window.KPStorage.addBook(name);
    }
    input.value = '';
    renderSettingsBooksList();
    showToast(`Book "${name}" added to list!`, 'success');
  }

  async function handleDeleteBook(name) {
    if (!confirm(`Are you sure you want to remove "${name}" from your book suggestions list?`)) return;
    if (window.KPStorage.deleteBook) {
      await window.KPStorage.deleteBook(name);
    }
    renderSettingsBooksList();
    showToast(`"${name}" removed from list.`, 'info');
  }

  function toggleCloudApiSettingsUI(isCloud) {
    const group = document.getElementById('settings-cloud-api-fields');
    if (group) {
      group.style.display = isCloud ? 'block' : 'none';
    }
  }

  async function handleSaveSettings() {
    const newSettings = {
      businessName: getValue('settings-business-name').trim(),
      businessSubtitle: (getValue('settings-business-sub') || '').trim() || 'Book Order Management System',
      businessWhatsApp: getValue('settings-business-wa').trim(),
      senderAddress: getValue('settings-sender-address').trim(),
      firebaseDbUrl: (getValue('settings-firebase-url') || '').trim(),
      whatsappMode: getValue('settings-wa-mode'),
      cloudApiToken: getValue('settings-cloud-token').trim(),
      cloudApiPhoneId: getValue('settings-cloud-phone-id').trim(),
      cloudApiBusinessId: getValue('settings-cloud-biz-id').trim(),
      whatsappTemplate: getValue('settings-wa-template'),
      defaultStatus: getValue('settings-default-status'),
      defaultPayment: getValue('settings-default-payment'),
      defaultBook: getValue('settings-default-book').trim()
    };

    if (window.KPStorage.setFirebaseDbUrl && newSettings.firebaseDbUrl !== undefined) {
      await window.KPStorage.setFirebaseDbUrl(newSettings.firebaseDbUrl);
    }

    await window.KPStorage.saveSettings(newSettings);
    applyBranding(newSettings);
    showToast('Settings saved & synced to all devices in real-time!', 'success');
  }

  // 10. MODAL DIALOGS
  function openAddressModal(orderId) {
    const order = window.KPStorage.getOrderById(orderId);
    if (!order) return;
    state.activeOrderForModal = order;

    document.getElementById('modal-address-name').textContent = order.customerName;
    document.getElementById('modal-address-phone').textContent = `+91 ${order.mobile}`;
    document.getElementById('modal-address-type').textContent = order.addressType || 'Delivery Address';
    document.getElementById('modal-address-full').textContent = order.address;
    document.getElementById('modal-address-city').textContent = `${order.city || ''}, ${order.state || ''}`;
    document.getElementById('modal-address-pin').textContent = `PIN: ${order.pincode || '------'}`;

    const modal = document.getElementById('modal-view-address');
    if (modal) modal.classList.add('modal-open');
  }

  function copyFormattedAddress() {
    if (!state.activeOrderForModal) return;
    const o = state.activeOrderForModal;
    const formatted = 
`${o.customerName}
Mobile: ${o.mobile}
Address: ${o.address}
City: ${o.city || ''}
State: ${o.state || ''}
PIN Code: ${o.pincode}
Book: ${o.bookName} (Qty: ${o.quantity})
COD Amount: ₹${o.codAmount || 0}`;

    navigator.clipboard.writeText(formatted).then(() => {
      showToast('Complete delivery address copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy address', 'error');
    });
  }

  function openOrderDetailsModal(orderId) {
    const order = window.KPStorage.getOrderById(orderId);
    if (!order) return;
    state.activeOrderForModal = order;

    document.getElementById('detail-order-id').textContent = order.orderId;
    document.getElementById('detail-created-date').textContent = order.createdDate ? new Date(order.createdDate).toLocaleString('en-IN') : order.orderDate;
    document.getElementById('detail-customer-name').textContent = order.customerName;
    document.getElementById('detail-customer-phone').textContent = `+91 ${order.mobile}`;
    document.getElementById('detail-address').textContent = order.address;
    document.getElementById('detail-city-state-pin').textContent = `${order.city || ''}, ${order.state || ''} - ${order.pincode}`;
    document.getElementById('detail-book-name').textContent = order.bookName;
    const trackingEl = document.getElementById('detail-tracking-id');
    if (trackingEl) {
      if (order.trackingId && order.trackingId.trim()) {
        trackingEl.innerHTML = `
          <span class="tracking-copy-badge font-mono" onclick="window.KPApp.copyTracking('${escapeHTML(order.trackingId)}')" title="Click to Copy Tracking ID">
            <span>${escapeHTML(order.trackingId)}</span>
            <span style="font-size:0.75rem;">📋 Click to Copy</span>
          </span>
        `;
      } else {
        trackingEl.innerHTML = '<span class="text-danger" style="font-weight:600;">⚠️ Not Added</span>';
      }
    }
    document.getElementById('detail-courier').textContent = order.courier || 'India Post';
    document.getElementById('detail-status').textContent = order.orderStatus;
    document.getElementById('detail-cod-amount').textContent = `₹${order.codAmount || 0}`;
    document.getElementById('detail-payment-status').textContent = order.paymentStatus;
    document.getElementById('detail-wa-status').textContent = order.whatsappStatus;
    document.getElementById('detail-last-wa-time').textContent = order.lastMessageTime ? new Date(order.lastMessageTime).toLocaleString('en-IN') : 'None';
    document.getElementById('detail-remarks').textContent = order.remarks || 'None';

    const modal = document.getElementById('modal-order-details');
    if (modal) modal.classList.add('modal-open');
  }

  function openEditTrackingModal(orderId, callback = null) {
    const order = window.KPStorage.getOrderById(orderId);
    if (!order) return;
    state.activeOrderForModal = order;

    setValue('input-edit-tracking-id', order.trackingId || '');
    setValue('select-edit-tracking-courier', order.courier || 'India Post');

    const modal = document.getElementById('modal-edit-tracking');
    if (modal) modal.classList.add('modal-open');

    // Save button handler
    const saveBtn = document.getElementById('btn-save-tracking-modal');
    saveBtn.onclick = async () => {
      const newTracking = getValue('input-edit-tracking-id').trim();
      const newCourier = getValue('select-edit-tracking-courier');
      if (!newTracking) {
        showToast('Please enter a Tracking ID', 'warning');
        return;
      }
      await window.KPStorage.updateOrder(orderId, {
        trackingId: newTracking,
        courier: newCourier
      });
      showToast('Tracking ID updated successfully!', 'success');
      closeModal('modal-edit-tracking');
      renderOrdersTable();
      renderDashboard();
      if (callback) callback();
    };
  }

  function openDuplicateWarningModal(orderData, existingOrder, onForceSave) {
    const modal = document.getElementById('modal-duplicate-warning');
    document.getElementById('dup-existing-id').textContent = existingOrder ? existingOrder.orderId : 'N/A';
    document.getElementById('dup-existing-name').textContent = existingOrder ? existingOrder.customerName : 'N/A';
    document.getElementById('dup-existing-phone').textContent = existingOrder ? existingOrder.mobile : 'N/A';
    document.getElementById('dup-existing-tracking').textContent = existingOrder ? existingOrder.trackingId : 'N/A';

    const forceBtn = document.getElementById('btn-dup-force-import');
    forceBtn.onclick = () => {
      closeModal('modal-duplicate-warning');
      if (onForceSave) onForceSave();
    };

    const viewBtn = document.getElementById('btn-dup-view-existing');
    viewBtn.onclick = () => {
      closeModal('modal-duplicate-warning');
      if (existingOrder) openOrderDetailsModal(existingOrder.orderId);
    };

    if (modal) modal.classList.add('modal-open');
  }

  function confirmDeleteOrder(orderId) {
    if (confirm(`Are you sure you want to delete order ${orderId}? This cannot be undone.`)) {
      window.KPStorage.deleteOrder(orderId);
      showToast(`Order ${orderId} deleted successfully`, 'success');
      renderOrdersTable();
      renderDashboard();
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('modal-open');
  }

  // 11. HELPER UTILITIES
  function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? val : '';
  }

  function focusField(id) {
    const el = document.getElementById(id);
    if (el) el.focus();
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

  function copyTracking(trackingId) {
    if (!trackingId) {
      showToast('Please add Tracking ID first.', 'warning');
      return;
    }
    const cleanId = String(trackingId).replace(/[`*#]/g, '').trim();
    if (!cleanId) {
      showToast('Tracking ID is empty.', 'warning');
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cleanId).then(() => {
        showToast(`📋 Tracking ID "${cleanId}" copied to clipboard!`, 'success');
      }).catch(() => {
        fallbackCopyText(cleanId, `Tracking ID "${cleanId}"`);
      });
    } else {
      fallbackCopyText(cleanId, `Tracking ID "${cleanId}"`);
    }
  }

  function fallbackCopyText(text, label = 'Text') {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      el.style.top = '-9999px';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      if (ok) {
        showToast(`📋 ${label} copied to clipboard!`, 'success');
      } else {
        prompt('Copy text:', text);
      }
    } catch (e) {
      prompt('Copy text:', text);
    }
  }

  function toggleSelectOrder(orderId) {
    if (state.selectedOrderIds.has(orderId)) {
      state.selectedOrderIds.delete(orderId);
    } else {
      state.selectedOrderIds.add(orderId);
    }
    renderOrdersTable();
  }

  function toggleSelectAllOrders() {
    const filtered = getFilteredOrders();
    const allSelected = filtered.every(o => state.selectedOrderIds.has(o.orderId));
    if (allSelected) {
      filtered.forEach(o => state.selectedOrderIds.delete(o.orderId));
    } else {
      filtered.forEach(o => state.selectedOrderIds.add(o.orderId));
    }
    renderOrdersTable();
  }

  function toggleBulkWhatsAppSelect(orderId) {
    if (state.bulkSelectedOrderIds.has(orderId)) {
      state.bulkSelectedOrderIds.delete(orderId);
    } else {
      state.bulkSelectedOrderIds.add(orderId);
    }
    renderWhatsAppMessagesPage();
  }

  function resetFilters() {
    state.searchQuery = '';
    state.statusFilter = 'all';
    state.paymentFilter = 'all';
    state.whatsappFilter = 'all';
    state.dateFilter = 'all';
    state.customStartDate = '';
    state.customEndDate = '';
    const tSearch = document.getElementById('table-search-input');
    if (tSearch) tSearch.value = '';
    const gSearch = document.getElementById('global-search-input');
    if (gSearch) gSearch.value = '';
    renderOrdersTable();
  }

  function openMobileNav() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar) sidebar.classList.add('mobile-nav-open');
    if (overlay) overlay.classList.add('overlay-active');
  }

  function closeMobileNav() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar) sidebar.classList.remove('mobile-nav-open');
    if (overlay) overlay.classList.remove('overlay-active');
  }

  // Export Data to JSON Backup
  function exportAllDataJSON() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      businessName: 'Kabir Publication',
      settings: window.KPStorage.getSettings(),
      orders: window.KPStorage.getOrders()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kabir-publication-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Complete backup JSON downloaded', 'success');
  }

  // Download Full Website ZIP (for running on any laptop)
  async function downloadWebsiteZip() {
    try {
      showToast('📦 Packaging complete website into ZIP... please wait a moment.', 'info');
      const response = await fetch('/api/download-website');
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `Kabir_Publication_Website_${dateStr}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('✅ Website ZIP downloaded! Extract and click Run_Website.bat on any laptop.', 'success');
    } catch (err) {
      console.warn('Direct fetch failed, falling back to window.location:', err);
      window.location.href = '/api/download-website';
    }
  }

  // Download Direct Windows Desktop Shortcut (.url)
  function downloadDesktopShortcut(silent = false) {
    try {
      const targetUrl = window.location.origin && window.location.origin.startsWith('http') 
        ? window.location.origin 
        : 'http://localhost:3000';
      const content = `[InternetShortcut]\r\nURL=${targetUrl}/\r\nIconIndex=0\r\n`;
      const blob = new Blob([content], { type: 'application/internet-shortcut' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Kabir_Publication.url';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('⚡ Desktop Shortcut (.url) downloaded! Save/drag it to your Desktop for 1-click open.', 'success');
      if (!silent) {
        openModal('modal-direct-shortcut');
      }
    } catch (err) {
      window.location.href = '/api/download-shortcut';
    }
  }

  // Download Direct 1-Click BAT Opener
  function downloadBatOpener() {
    showToast('⚡ Downloading 1-click .BAT launcher...', 'info');
    window.location.href = '/api/download-bat-shortcut';
  }

  function openDirectShortcutModal() {
    openModal('modal-direct-shortcut');
  }

  // Import Data from JSON Backup
  async function importDataJSON(jsonFile) {
    try {
      const text = await jsonFile.text();
      const data = JSON.parse(text);
      if (data.orders && Array.isArray(data.orders)) {
        for (const order of data.orders) {
          await window.KPStorage.saveOrder(order, true);
        }
      }
      if (data.settings) {
        await window.KPStorage.saveSettings(data.settings);
      }
      showToast('Data imported successfully!', 'success');
      renderDashboard();
    } catch (e) {
      showToast(`Invalid backup file: ${e.message}`, 'error');
    }
  }

  // Clear all local data & backend
  async function clearAllData() {
    if (confirm('⚠️ WARNING: Are you sure you want to delete ALL orders and reset settings? This action cannot be reversed!')) {
      if (confirm('Please confirm once more: All orders and dummy data will be erased.')) {
        await window.KPStorage.clearAllOrders();
        localStorage.clear();
        showToast('All data cleared successfully.', 'info');
        setTimeout(() => window.location.reload(), 500);
      }
    }
  }

  // Clear all orders only
  async function clearAllOrdersWithConfirm() {
    const orders = window.KPStorage.getOrders();
    if (orders.length === 0) {
      showToast('ℹ️ Order registry is already empty!', 'info');
      return;
    }
    if (confirm(`⚠️ Delete all ${orders.length} orders? This action cannot be reversed.`)) {
      await window.KPStorage.clearAllOrders();
      showToast('🗑️ All orders deleted successfully.', 'success');
      renderOrdersTable();
      updateDashboardStats();
    }
  }

  // PWA Installation prompt listener
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('btn-pwa-install');
    if (installBtn) installBtn.style.display = 'inline-flex';
  });

  function installPWA() {
    if (!deferredPrompt) {
      showToast('PWA installation is available from your browser menu', 'info');
      return;
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') {
        showToast('Kabir Publication installed to Home Screen!', 'success');
      }
      deferredPrompt = null;
    });
  }

  // Initialize App on DOM Load
  async function init() {
    await window.KPStorage.init();
    applyBranding();

    // Register live real-time sync listener
    if (window.KPStorage.registerSyncListener) {
      window.KPStorage.registerSyncListener((status, details) => {
        updateSyncStatusUI(status, details);
      });
    }

    // Automatically purge any dummy/demo orders from storage (by sample customer names only)
    const currentOrders = window.KPStorage.getOrders();
    for (const o of currentOrders) {
      if (
        o.customerName === 'Rameshwar Lal Sharma' ||
        o.customerName === 'Sunita Devi Yadav' ||
        o.customerName === 'Vikram Singh Verma'
      ) {
        await window.KPStorage.deleteOrder(o.orderId);
      }
    }

    // Refresh datalists with custom book names
    if (window.KPStorage.updateBookDatalists) {
      window.KPStorage.updateBookDatalists();
    }

    // Attach Event Listeners
    setupEventListeners();

    // Default route
    navigateTo('dashboard');
  }

  function setupEventListeners() {
    // Nav Click handlers
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        if (view) {
          if (view === 'orders-all') navigateTo('orders-all', { status: 'all', payment: 'all', whatsapp: 'all', search: '' });
          else if (view === 'orders-packed') navigateTo('orders-all', { status: 'Packed', search: '' });
          else if (view === 'orders-shipped') navigateTo('orders-all', { status: 'Shipped', search: '' });
          else if (view === 'orders-delivered') navigateTo('orders-all', { status: 'Delivered', search: '' });
          else if (view === 'orders-returned') navigateTo('orders-all', { status: 'Returned', search: '' });
          else navigateTo(view);
        }
      });
    });

    // Stat Cards Click-to-Filter handlers (Requirement #2)
    const cardFilters = {
      'card-total-orders': { view: 'orders-all', filter: { status: 'all', payment: 'all', whatsapp: 'all', search: '' } },
      'card-packed': { view: 'orders-all', filter: { status: 'Packed', search: '' } },
      'card-shipped': { view: 'orders-all', filter: { status: 'Shipped', search: '' } },
      'card-delivered': { view: 'orders-all', filter: { status: 'Delivered', search: '' } },
      'card-returned': { view: 'orders-all', filter: { status: 'Returned', search: '' } },
      'card-cancelled': { view: 'orders-all', filter: { status: 'Cancelled', search: '' } },
      'card-cod-pending': { view: 'orders-all', filter: { payment: 'COD', search: '' } },
      'card-paid': { view: 'orders-all', filter: { payment: 'Online', search: '' } },
      'card-wa-pending': { view: 'whatsapp', filter: { whatsapp: 'Pending' } },
      'card-wa-sent': { view: 'whatsapp', filter: { whatsapp: 'Sent' } }
    };

    Object.entries(cardFilters).forEach(([cardId, cfg]) => {
      const el = document.getElementById(cardId);
      if (el) {
        el.addEventListener('click', () => {
          navigateTo(cfg.view, cfg.filter);
        });
      }
    });

    // Table Search Live Input
    const searchInput = document.getElementById('table-search-input');
    if (searchInput) {
      if (searchInput.value && searchInput.value.trim().toLowerCase() === 'admin') {
        searchInput.value = '';
      }
      searchInput.addEventListener('input', (e) => {
        const val = e.target.value || '';
        if (val.trim().toLowerCase() === 'admin') {
          e.target.value = '';
          state.searchQuery = '';
          renderOrdersTable();
          return;
        }
        state.searchQuery = val;
        renderOrdersTable();
      });
      searchInput.addEventListener('focus', (e) => {
        if (e.target.value && e.target.value.trim().toLowerCase() === 'admin') {
          e.target.value = '';
          state.searchQuery = '';
          renderOrdersTable();
        }
      });
    }

    // Header Global Search Input
    const globalSearch = document.getElementById('global-search-input');
    if (globalSearch) {
      if (globalSearch.value && globalSearch.value.trim().toLowerCase() === 'admin') {
        globalSearch.value = '';
      }
      globalSearch.addEventListener('input', (e) => {
        const val = e.target.value || '';
        if (val.trim().toLowerCase() === 'admin') {
          e.target.value = '';
          state.searchQuery = '';
          if (state.currentView === 'orders-all') renderOrdersTable();
          return;
        }
        state.searchQuery = val;
        if (state.currentView !== 'orders-all') {
          navigateTo('orders-all', { search: val });
        } else {
          renderOrdersTable();
        }
      });
      globalSearch.addEventListener('focus', (e) => {
        if (e.target.value && e.target.value.trim().toLowerCase() === 'admin') {
          e.target.value = '';
          state.searchQuery = '';
          if (state.currentView === 'orders-all') renderOrdersTable();
        }
      });
    }

    // Filter Change listeners
    const statusSel = document.getElementById('table-filter-status');
    if (statusSel) {
      statusSel.addEventListener('change', (e) => {
        state.statusFilter = e.target.value;
        renderOrdersTable();
      });
    }
    const paySel = document.getElementById('table-filter-payment');
    if (paySel) {
      paySel.addEventListener('change', (e) => {
        state.paymentFilter = e.target.value;
        renderOrdersTable();
      });
    }
    const waSel = document.getElementById('table-filter-wa');
    if (waSel) {
      waSel.addEventListener('change', (e) => {
        state.whatsappFilter = e.target.value;
        renderOrdersTable();
      });
    }
    const dateSel = document.getElementById('table-filter-date');
    if (dateSel) {
      dateSel.addEventListener('change', (e) => {
        state.dateFilter = e.target.value;
        const customGroup = document.getElementById('custom-date-inputs');
        if (customGroup) customGroup.style.display = e.target.value === 'custom' ? 'flex' : 'none';
        renderOrdersTable();
      });
    }

    // Custom Date inputs
    const startInput = document.getElementById('custom-start-date');
    if (startInput) {
      startInput.addEventListener('change', (e) => {
        state.customStartDate = e.target.value;
        renderOrdersTable();
      });
    }
    const endInput = document.getElementById('custom-end-date');
    if (endInput) {
      endInput.addEventListener('change', (e) => {
        state.customEndDate = e.target.value;
        renderOrdersTable();
      });
    }

    // Excel File Upload Inputs (Dashboard, Orders Page, Labels Page)
    ['excel-dashboard-input', 'excel-import-input', 'excel-file-input'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', (e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleBatchUpload(e.target.files);
          }
          e.target.value = '';
        });
      }
    });

    // Excel View 5 Drop Zone
    const excelDropZone = document.getElementById('excel-view5-drop-zone');
    if (excelDropZone) {
      excelDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        excelDropZone.classList.add('drop-zone-active');
      });
      excelDropZone.addEventListener('dragleave', () => {
        excelDropZone.classList.remove('drop-zone-active');
      });
      excelDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        excelDropZone.classList.remove('drop-zone-active');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleBatchUpload(e.dataTransfer.files);
        }
      });
    }

    // PDF / Shipping Labels File Upload Input
    const pdfInput = document.getElementById('pdf-file-input');
    if (pdfInput) {
      pdfInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleBatchUpload(e.target.files);
        }
        e.target.value = '';
      });
    }

    // Drag and Drop PDF / Shipping Labels Zone
    const dropZone = document.getElementById('pdf-drop-zone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drop-zone-active');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drop-zone-active');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-zone-active');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleBatchUpload(e.dataTransfer.files);
        }
      });
    }

    // Universal Drop on Shipping Labels View (never lose a dropped file anywhere on page)
    const shippingSection = document.getElementById('view-shipping-labels');
    if (shippingSection) {
      shippingSection.addEventListener('dragover', (e) => {
        e.preventDefault();
      });
      shippingSection.addEventListener('drop', (e) => {
        if (!e.target.closest('#pdf-drop-zone') && !e.target.closest('#excel-view5-drop-zone')) {
          e.preventDefault();
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleBatchUpload(e.dataTransfer.files);
          }
        }
      });
    }

    // JSON Backup Upload
    const jsonInput = document.getElementById('json-backup-input');
    if (jsonInput) {
      jsonInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          importDataJSON(e.target.files[0]);
        }
        e.target.value = '';
      });
    }

    // CSV Import Input
    const csvInput = document.getElementById('csv-import-input');
    if (csvInput) {
      csvInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          try {
            const text = await e.target.files[0].text();
            const res = await window.KPReports.importOrdersFromCSV(text);
            showToast(`CSV Imported: ${res.imported} saved, ${res.duplicates} duplicates, ${res.errors} errors`, 'info');
            renderDashboard();
            renderOrdersTable();
          } catch (err) {
            showToast(`CSV Error: ${err.message}`, 'error');
          }
        }
        e.target.value = '';
      });
    }
  }

  function printSelectedLabels() {
    const selectedIds = Array.from(state.selectedOrderIds);
    if (selectedIds.length === 0) {
      showToast('Please select at least one order to print labels.', 'warning');
      return;
    }
    const orders = selectedIds.map(id => window.KPStorage.getOrderById(id)).filter(Boolean);
    const container = document.getElementById('labels-preview-container');
    if (container && window.KPLabelGenerator) {
      window.KPLabelGenerator.renderLabels(orders, container);
    }
    navigateTo('shipping-labels');
    setTimeout(() => {
      window.KPLabelGenerator.printLabels();
    }, 400);
  }

  function previewWhatsAppTemplate() {
    const rawTemplate = getValue('settings-wa-template') || '';
    const orders = window.KPStorage.getOrders();
    const realOrder = orders.length > 0 ? orders[0] : null;

    let preview = rawTemplate;
    let actualTracking = '';

    if (realOrder) {
      actualTracking = (realOrder.trackingId || '').replace(/[`*#]/g, '').trim();
      const trackingLink = window.KPWhatsApp ? window.KPWhatsApp.getTrackingLink(realOrder.courier, actualTracking) : 'https://www.indiapost.gov.in/';
      const replacements = {
        '{{name}}': realOrder.customerName || 'Customer',
        '{{mobile}}': realOrder.mobile || '',
        '{{book}}': realOrder.bookName || 'Pustak',
        '{{tracking}}': actualTracking || 'CX067707572IN',
        '{{tracking_link}}': trackingLink,
        '{{cod}}': realOrder.codAmount ? `₹${realOrder.codAmount}` : 'Nil',
        '{{order_id}}': realOrder.orderId || '',
        '{{date}}': realOrder.orderDate || new Date().toISOString().split('T')[0]
      };
      if (!actualTracking) actualTracking = 'CX067707572IN';
      for (const [key, val] of Object.entries(replacements)) {
        preview = preview.split(key).join(val);
      }
    } else {
      actualTracking = 'CX067707572IN';
      preview = rawTemplate
        .replace(/{{name}}/g, 'MR. MOHAMMAD TAJ ASLAM')
        .replace(/{{mobile}}/g, '7033177455')
        .replace(/{{book}}/g, 'Gyan Ganga')
        .replace(/{{tracking}}/g, actualTracking)
        .replace(/{{tracking_link}}/g, 'https://www.indiapost.gov.in/')
        .replace(/{{cod}}/g, '₹0 / Nil')
        .replace(/{{order_id}}/g, 'KP-1001')
        .replace(/{{date}}/g, new Date().toISOString().split('T')[0]);
    }

    state.lastWhatsAppPreviewText = preview;
    state.lastWhatsAppPreviewTracking = actualTracking;

    const previewEl = document.getElementById('template-preview-text');
    if (previewEl) {
      // Safe HTML with interactive click-to-copy tracking badge
      let safeHtml = escapeHTML(preview);

      if (actualTracking) {
        const cleanTrack = actualTracking.replace(/[`*#]/g, '').trim();
        const badgeHtml = `<span class="tracking-copy-badge font-mono" onclick="window.KPApp.copyTracking('${escapeHTML(cleanTrack)}')" title="Click to copy Tracking ID (${escapeHTML(cleanTrack)})" style="display:inline-flex; align-items:center; gap:6px; background:#dcfce7; border:1px solid #16a34a; color:#14532d; padding:3px 10px; border-radius:6px; font-weight:700; font-size:0.86rem; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.12); margin:2px 0;"><span style="user-select:all;">${escapeHTML(cleanTrack)}</span><span style="font-size:0.74rem; background:#16a34a; color:#ffffff; padding:1px 6px; border-radius:4px; font-weight:600;">📋 Click to Copy</span></span>`;

        // Replace backtick escaped versions first
        safeHtml = safeHtml.split(`\`${cleanTrack}\``).join(badgeHtml);
        safeHtml = safeHtml.split(`&#039;${cleanTrack}&#039;`).join(badgeHtml);
        safeHtml = safeHtml.split(cleanTrack).join(badgeHtml);
      }

      // Convert URLs to clickable links
      safeHtml = safeHtml.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#0284c7; text-decoration:underline; word-break:break-all;">$1</a>'
      );

      previewEl.innerHTML = safeHtml;
    }

    const previewTrackingLabel = document.getElementById('wa-preview-tracking-label');
    if (previewTrackingLabel) {
      previewTrackingLabel.textContent = actualTracking || 'None';
    }

    const modal = document.getElementById('modal-template-preview');
    if (modal) modal.classList.add('modal-open');
  }

  function copyWhatsAppPreviewText() {
    const text = state.lastWhatsAppPreviewText || (document.getElementById('template-preview-text') ? document.getElementById('template-preview-text').innerText : '');
    if (!text) {
      showToast('No WhatsApp message to copy', 'warning');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('📋 WhatsApp message copied to clipboard!', 'success');
      }).catch(() => {
        fallbackCopyText(text, 'WhatsApp message');
      });
    } else {
      fallbackCopyText(text, 'WhatsApp message');
    }
  }

  function copyWhatsAppPreviewTracking() {
    const tracking = state.lastWhatsAppPreviewTracking;
    if (tracking) {
      copyTracking(tracking);
    } else {
      showToast('No Tracking ID found in preview.', 'warning');
    }
  }

  function insertTemplateVariable(variableName) {
    const textarea = document.getElementById('settings-wa-template');
    if (!textarea) return;
    const start = textarea.selectionStart || textarea.value.length;
    const end = textarea.selectionEnd || textarea.value.length;
    const text = textarea.value;
    textarea.value = text.substring(0, start) + variableName + text.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + variableName.length;
  }

  function editActiveOrder() {
    if (!state.activeOrderForModal) return;
    const id = state.activeOrderForModal.orderId;
    closeModal('modal-order-details');
    editOrder(id);
  }

  function sendActiveOrderWhatsApp() {
    if (!state.activeOrderForModal) return;
    window.KPWhatsApp.sendTrackingMessage(state.activeOrderForModal.orderId);
  }

  function copyActiveOrderTracking() {
    if (!state.activeOrderForModal) return;
    copyTracking(state.activeOrderForModal.trackingId);
  }

  // ==========================================
  // DYNAMIC BRANDING & MULTI-DEVICE SYNC UI
  // ==========================================

  function applyBranding(customSettings) {
    const s = customSettings || window.KPStorage.getSettings();
    const name = s.businessName || 'Kabir Publication';
    const sub = s.businessSubtitle || 'Book Order Management System';
    const address = s.senderAddress || 'Kabir Publication, Satlok Ashram, Barwala (Hisar), Haryana - 125121';
    const phone = s.businessWhatsApp || s.senderPhone || '9413508833';

    // 1. Document Title
    document.title = `${name} – ${sub}`;

    // 2. Sidebar Brand
    document.querySelectorAll('.brand-title').forEach(el => {
      el.textContent = name;
    });
    document.querySelectorAll('.brand-sub').forEach(el => {
      el.textContent = sub;
    });

    // 3. Login Gate Brand
    document.querySelectorAll('.login-title').forEach(el => {
      el.textContent = name;
    });
    document.querySelectorAll('.login-subtitle').forEach(el => {
      el.textContent = sub;
    });
    document.querySelectorAll('.footer-note').forEach(el => {
      el.textContent = `${name} • Book Distribution Desk`;
    });
    document.querySelectorAll('.footer-branch').forEach(el => {
      el.textContent = address;
    });

    // 4. Dashboard Title
    const dashTitle = document.querySelector('#view-dashboard .page-title');
    if (dashTitle) {
      dashTitle.textContent = `${name} – Book Order Dashboard`;
    }

    // 5. Sidebar Helpline & Address
    const phoneEls = document.querySelectorAll('.helpline-box span:last-child, #sidebar-helpline-phone');
    phoneEls.forEach(el => {
      el.textContent = phone;
    });
    const addrEls = document.querySelectorAll('#sidebar-sender-address, .sidebar-footer > div:last-child');
    addrEls.forEach(el => {
      if (el && !el.classList.contains('helpline-box') && !el.classList.contains('sidebar-auth-user')) {
        el.textContent = address;
      }
    });
  }

  function onRemoteSettingsUpdated(s) {
    applyBranding(s);
    if (state.currentView === 'settings') {
      const activeEl = document.activeElement;
      if (!activeEl || !activeEl.id || !activeEl.id.startsWith('settings-')) {
        renderSettingsPage();
      }
    }
    showToast(`✨ Website name & settings updated live from another device! (${s.businessName || 'Updated'})`, 'info', 4000);
  }

  function onRemoteOrdersUpdated(payload) {
    renderCurrentView();
    if (state.currentView === 'dashboard') {
      renderDashboard();
    }
  }

  function updateSyncStatusUI(status, details) {
    const dot = document.getElementById('sync-header-dot');
    const text = document.getElementById('sync-header-text');
    if (!dot || !text) return;

    const count = window.KPStorage ? window.KPStorage.getOrders().length : 0;

    if (status === 'connected') {
      dot.style.background = '#22c55e';
      dot.style.boxShadow = '0 0 8px #22c55e';
      text.textContent = `🟢 Database: Connected (${count} Orders)`;
    } else if (status === 'reconnecting') {
      dot.style.background = '#f59e0b';
      dot.style.boxShadow = '0 0 8px #f59e0b';
      text.textContent = `🟡 Database: Syncing (${count} Orders)`;
    } else {
      dot.style.background = '#6b7280';
      dot.style.boxShadow = 'none';
      text.textContent = `🗄️ Database: Local (${count} Orders)`;
    }
  }

  async function openDeviceSyncModal() {
    let networkInfo = null;
    let dbInfo = null;
    try {
      const res = await fetch(`${window.KPStorage.getApiBase()}/network-info`, { cache: 'no-cache' });
      if (res.ok) networkInfo = await res.json();
    } catch (e) {}

    try {
      if (window.KPStorage && window.KPStorage.getDatabaseInfo) {
        dbInfo = await window.KPStorage.getDatabaseInfo();
      }
    } catch (e) {}

    const localUrlEl = document.getElementById('sync-local-url');
    const networkUrlEl = document.getElementById('sync-network-url');
    const customUrlInput = document.getElementById('sync-custom-url-input');
    const connStatusEl = document.getElementById('sync-connection-status');
    const connDevicesEl = document.getElementById('sync-connected-devices-count');
    const ordersValEl = document.getElementById('sync-db-orders-val');
    const dbTypeValEl = document.getElementById('sync-db-type-val');
    const devicesValEl = document.getElementById('sync-db-devices-val');
    const backupsValEl = document.getElementById('sync-db-backups-val');

    const port = (networkInfo && networkInfo.port) || 3000;
    const currentOrigin = window.location.origin;
    let targetUrl = '';

    if (networkInfo && networkInfo.primaryUrl) {
      targetUrl = networkInfo.primaryUrl;
    } else if (currentOrigin && currentOrigin.startsWith('http')) {
      targetUrl = currentOrigin;
    } else {
      targetUrl = `http://localhost:${port}`;
    }

    if (localUrlEl) localUrlEl.textContent = (networkInfo && networkInfo.localUrl) || `http://localhost:${port}`;
    if (networkUrlEl) networkUrlEl.value = targetUrl;

    const currentOrders = window.KPStorage ? window.KPStorage.getOrders() : [];
    if (ordersValEl) ordersValEl.textContent = (dbInfo && dbInfo.ordersCount !== undefined) ? dbInfo.ordersCount : currentOrders.length;
    if (devicesValEl) devicesValEl.textContent = (networkInfo && networkInfo.connectedDevices) || 1;
    if (backupsValEl) backupsValEl.textContent = (dbInfo && dbInfo.backupsCount !== undefined) ? dbInfo.backupsCount : 0;
    if (dbTypeValEl) {
      dbTypeValEl.textContent = (dbInfo && dbInfo.status === 'connected') ? 'Persistent' : 'Local Cache';
      dbTypeValEl.style.color = (dbInfo && dbInfo.status === 'connected') ? '#16a34a' : '#d97706';
    }

    if (connStatusEl) {
      const isConn = window.KPStorage.isBackendConnected();
      connStatusEl.innerHTML = isConn 
        ? '<div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:10px 14px; color:#065f46; font-weight:700;">🟢 Master Database Connected (Atomic Storage Engine Active & Synchronized)</div>'
        : '<div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 14px; color:#92400e; font-weight:700;">🟡 Standalone Cache Mode (Connecting to local database...)</div>';
    }

    if (connDevicesEl && networkInfo) {
      connDevicesEl.textContent = `${networkInfo.connectedDevices || 1} Device(s) Active`;
    }

    if (customUrlInput) {
      customUrlInput.value = window.KPStorage.getCustomServerUrl() || '';
    }

    const fbUrlInput = document.getElementById('sync-firebase-url-input');
    if (fbUrlInput && window.KPStorage.getFirebaseDbUrl) {
      fbUrlInput.value = window.KPStorage.getFirebaseDbUrl() || '';
    }

    const modal = document.getElementById('modal-device-sync');
    if (modal) modal.classList.add('modal-open');
  }

  function copyNetworkUrl() {
    const input = document.getElementById('sync-network-url');
    if (!input || !input.value) return;
    navigator.clipboard.writeText(input.value).then(() => {
      showToast('Link copied! Open this in mobile browser or any other laptop on same Wi-Fi.', 'success', 4000);
    }).catch(() => {
      input.select();
      document.execCommand('copy');
      showToast('Link copied to clipboard!', 'success', 4000);
    });
  }

  async function handleForceDbRefresh() {
    showToast('Refreshing latest orders from database...', 'info');
    if (window.KPStorage) {
      try {
        await Promise.all([
          window.KPStorage.syncSettingsFromServer(),
          window.KPStorage.syncOrdersFromServer()
        ]);
        renderCurrentView();
        if (state.currentView === 'dashboard') renderDashboard();
        await openDeviceSyncModal();
        const count = window.KPStorage.getOrders().length;
        showToast(`Database refreshed successfully! (${count} orders loaded)`, 'success');
      } catch (e) {
        showToast('Database refresh error. Check server status.', 'warning');
      }
    }
  }

  async function handleSyncAllToDb() {
    showToast('Pushing all orders to backend database...', 'info');
    if (window.KPStorage && window.KPStorage.syncAllToDatabase) {
      const res = await window.KPStorage.syncAllToDatabase();
      if (res.success) {
        showToast(`Database synchronized! (${res.count} orders saved)`, 'success');
        await openDeviceSyncModal();
      } else {
        showToast('Sync to database failed. Verify node server.js is running.', 'warning');
      }
    }
  }

  function handleDownloadDbBackup() {
    const backupUrl = `${window.KPStorage.getApiBase()}/database/backup`;
    window.open(backupUrl, '_blank');
    showToast('Downloading complete database JSON backup...', 'info');
  }

  async function handleSendSyncPing() {
    const success = await window.KPStorage.sendSyncPing('Admin Screen');
    if (success) {
      showToast('⚡ Real-time ping broadcasted! Check other devices.', 'success');
    } else {
      showToast('Failed to send ping. Server may be offline.', 'warning');
    }
  }

  function handleSaveCustomServerUrl() {
    const input = document.getElementById('sync-custom-url-input');
    if (!input) return;
    const url = input.value.trim();
    window.KPStorage.setCustomServerUrl(url);
    showToast(url ? `Connecting to custom server: ${url}` : 'Reset to auto-detect server', 'info');
  }

  async function handleSaveFirebaseDbUrl() {
    const input = document.getElementById('sync-firebase-url-input');
    if (!input) return;
    const url = input.value.trim();
    if (window.KPStorage.setFirebaseDbUrl) {
      await window.KPStorage.setFirebaseDbUrl(url);
    }
    showToast(url ? 'Firebase Cloud Database connected! All devices are now in sync.' : 'Firebase disconnected', 'success');
  }

  // Public Interface
  window.KPApp = {
    init,
    navigateTo,
    renderCurrentView,
    refreshCurrentView: renderCurrentView,
    openOrderDetailsModal,
    openAddressModal,
    copyFormattedAddress,
    openEditTrackingModal,
    editOrder,
    confirmDeleteOrder,
    closeModal,
    copyTracking,
    toggleSelectOrder,
    toggleSelectAllOrders,
    toggleBulkWhatsAppSelect,
    resetFilters,
    handleSaveOrder,
    handleUpdateOrder,
    clearOrderForm,
    quickChangeStatus,
    filterWhatsAppMessages,
    selectAllWhatsApp,
    openBulkWhatsAppModal,
    handleSaveSettings,
    exportAllDataJSON,
    clearAllData,
    clearAllOrdersWithConfirm,
    installPWA,
    openMobileNav,
    closeMobileNav,
    printSelectedLabels,
    previewWhatsAppTemplate,
    copyWhatsAppPreviewText,
    copyWhatsAppPreviewTracking,
    insertTemplateVariable,
    editActiveOrder,
    sendActiveOrderWhatsApp,
    copyActiveOrderTracking,
    getActiveOrder: () => state.activeOrderForModal,
    handlePastedTextImport,
    updateCandidateField,
    removeCandidate,
    applyBatchBookToCandidates,
    applyBatchAmountToCandidates,
    confirmAndSaveImportedCandidates,
    openQuickEditBookAmountModal,
    saveQuickEditBookAmount,
    openBulkChangeBookAmountModal,
    saveBulkChangeBookAmount,
    handleAddNewBook,
    handleDeleteBook,
    renderSettingsBooksList,
    toggleCloudApiSettingsUI,
    renderShippingLabelsPage,
    handleExcelUpload,
    downloadWebsiteZip,
    downloadDesktopShortcut,
    downloadBatOpener,
    openDirectShortcutModal,
    applyBranding,
    onRemoteSettingsUpdated,
    onRemoteOrdersUpdated,
    updateSyncStatusUI,
    openDeviceSyncModal,
    copyNetworkUrl,
    handleSendSyncPing,
    handleSaveCustomServerUrl,
    handleSaveFirebaseDbUrl,
    handleForceDbRefresh,
    handleSyncAllToDb,
    handleDownloadDbBackup
  };

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
