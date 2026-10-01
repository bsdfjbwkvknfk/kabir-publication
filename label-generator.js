/**
 * Kabir Publication - Shipping Label Generator & Print Engine
 * Generates thermal 4x6 / A6 shipping labels with barcode (JsBarcode)
 * and tracking QR code (QRCode.js).
 */

(function(window) {
  'use strict';

  function renderBarcode(element, codeText) {
    if (typeof JsBarcode === 'undefined' || !codeText) return;
    try {
      JsBarcode(element, codeText, {
        format: 'CODE128',
        lineColor: '#000',
        width: 1.8,
        height: 48,
        displayValue: true,
        fontSize: 12,
        margin: 4
      });
    } catch (e) {
      console.warn('Barcode generation error:', e);
    }
  }

  function renderQRCode(container, url) {
    if (typeof QRCode === 'undefined' || !container || !url) return;
    container.innerHTML = '';
    try {
      new QRCode(container, {
        text: url,
        width: 80,
        height: 80,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      console.warn('QR Code generation error:', e);
    }
  }

  function generateSingleLabelHTML(order, settings) {
    const trackingLink = window.KPWhatsApp ? window.KPWhatsApp.getTrackingLink(order.courier, order.trackingId) : 'https://www.indiapost.gov.in/';
    const isCOD = (order.paymentStatus === 'COD' || order.paymentStatus === 'COD Pending' || order.codAmount > 0);
    const codBadgeClass = isCOD ? 'label-badge-cod' : 'label-badge-prepaid';
    const codBadgeText = isCOD ? `COD: ₹${order.codAmount || 0}` : 'ONLINE / PREPAID';

    const safeOrderId = order.orderId || 'KP-ORDER';
    const safeTracking = order.trackingId || safeOrderId;

    return `
      <div class="shipping-label-card" id="label-${order.orderId}">
        <!-- Label Header -->
        <div class="label-header">
          <div class="label-brand">
            <img src="logo.jpeg" alt="Logo" class="label-logo" onerror="this.src='logo.png'">
            <div>
              <div class="label-brand-title">${(settings.businessName || 'KABIR PUBLICATION').toUpperCase()}</div>
              <div class="label-brand-sub">${settings.businessSubtitle || 'Book Order & Shipping Division'}</div>
            </div>
          </div>
          <div class="label-courier-box">
            <div class="label-courier-name">${order.courier || 'India Post'}</div>
            <div class="label-courier-type">${order.trackingId ? 'TRACKED SHIPMENT' : 'STANDARD'}</div>
          </div>
        </div>

        <!-- Barcode Row -->
        <div class="label-barcode-row">
          <svg class="barcode-svg" data-code="${safeTracking}"></svg>
        </div>

        <!-- Tracking & Order Numbers -->
        <div class="label-meta-grid">
          <div><strong>Order ID:</strong> ${order.orderId}</div>
          <div><strong>Date:</strong> ${order.orderDate || new Date().toISOString().split('T')[0]}</div>
          <div class="full-width"><strong>Tracking ID:</strong> <span class="tracking-text">${order.trackingId || 'Pending Assignment'}</span></div>
        </div>

        <!-- Payment Banner -->
        <div class="label-payment-banner ${codBadgeClass}">
          ${codBadgeText}
        </div>

        <!-- Addresses Grid -->
        <div class="label-address-grid">
          <!-- SHIP TO -->
          <div class="label-address-box ship-to-box">
            <div class="address-title">DELIVER TO (CONSIGNEE):</div>
            <div class="customer-name">${order.customerName || 'Customer'}</div>
            <div class="customer-phone">📞 <strong>+91 ${order.mobile || ''}</strong></div>
            <div class="customer-address">${order.address || ''}</div>
            <div class="customer-city-pin">
              <strong>${order.city || ''}${order.state ? ', ' + order.state : ''}</strong><br>
              <span class="pincode-highlight">PIN: ${order.pincode || '------'}</span>
            </div>
            ${order.addressType ? `<div class="address-type-tag">[${order.addressType}]</div>` : ''}
          </div>

          <!-- LOGO BADGE & RETURN TO -->
          <div class="label-side-box">
            <div class="label-logo-badge-box">
              <img src="logo.jpeg" alt="Kabir Publication" class="label-badge-logo" onerror="this.src='logo.png'">
              <div class="label-badge-logo-text">KABIR PUBLICATION</div>
            </div>
            
            <div class="return-box">
              <div class="return-title">FROM / RETURN ADDRESS:</div>
              <div class="sender-name">${(settings.businessName || 'KABIR PUBLICATION').toUpperCase()}</div>
              <div class="sender-address">${settings.senderAddress || 'Satlok Ashram, Barwala (Hisar), Haryana - 125121'}</div>
              <div class="sender-helpline">Helpline: <strong>${settings.businessWhatsApp || '9413508833'}</strong></div>
            </div>
          </div>
        </div>

        <!-- Item Footer -->
        <div class="label-footer">
          <div class="book-info">
            <strong>Book:</strong> ${order.bookName || 'Spiritual Literature'} | <strong>Qty:</strong> ${order.quantity || 1}
          </div>
          <div class="spiritual-quote">
            "Satguru Dev Ki Jai"
          </div>
        </div>
      </div>
    `;
  }

  function renderLabels(orders, container) {
    if (!container) return;
    if (!orders || orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 48px 24px; text-align: center;">
          <div class="empty-icon-bubble">🏷️</div>
          <h3 class="empty-title">Koi Dispatch Label Available Nahi Hai</h3>
          <p class="empty-desc">Naya order add karein ya India Post ke labels upload karein taaki 4x6 / A6 thermal print labels generate ho sakein.</p>
          <div style="margin-top:16px; display:flex; justify-content:center; gap:10px;">
            <button class="btn btn-primary btn-sm" onclick="window.KPApp.navigateTo('add-order')">+ Add Order</button>
            <button class="btn btn-secondary btn-sm" onclick="window.KPApp.navigateTo('orders-all')">View Orders Registry</button>
          </div>
        </div>
      `;
      return;
    }

    const settings = window.KPStorage.getSettings();
    const html = orders.map(o => generateSingleLabelHTML(o, settings)).join('');
    container.innerHTML = html;

    // Render barcodes for thermal tracking
    container.querySelectorAll('.barcode-svg').forEach(svg => {
      const code = svg.getAttribute('data-code');
      renderBarcode(svg, code);
    });

    // Fallback: If any legacy qr-target exists, replace with logo.jpeg
    container.querySelectorAll('.qr-target').forEach(div => {
      div.innerHTML = '<img src="logo.jpeg" alt="Logo" class="label-badge-logo" onerror="this.src=\'logo.png\'">';
    });
  }

  function printLabels() {
    window.print();
  }

  window.KPLabelGenerator = {
    renderLabels,
    printLabels
  };

})(window);
