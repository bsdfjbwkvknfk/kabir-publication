/**
 * Kabir Publication - WhatsApp Messaging Engine
 * Handles message templating, courier tracking link resolution,
 * wa.me deep-linking, bulk dispatch queue, and Meta Cloud API integration.
 */

(function(window) {
  'use strict';

  // Get Courier Tracking Link
  function getTrackingLink(courierName, trackingId) {
    if (!trackingId) return '';
    const settings = window.KPStorage.getSettings();
    const couriers = settings.couriers || [];
    const matched = couriers.find(c => c.name.toLowerCase() === (courierName || '').toLowerCase());
    
    let template = matched ? matched.urlTemplate : 'https://www.indiapost.gov.in/';
    if (!template) template = 'https://www.indiapost.gov.in/';

    return template
      .replace(/{{tracking}}/g, encodeURIComponent(trackingId))
      .replace(/{{courier}}/g, encodeURIComponent(courierName || 'Courier'));
  }

  // Format and interpolate WhatsApp template
  function generateMessage(order) {
    const settings = window.KPStorage.getSettings();
    const template = settings.whatsappTemplate || '';
    const trackingLink = getTrackingLink(order.courier, order.trackingId);

    const cleanTracking = (order.trackingId || '').replace(/[`*#]/g, '').trim();

    const replacements = {
      '{{name}}': order.customerName || 'Customer',
      '{{mobile}}': order.mobile || '',
      '{{book}}': order.bookName || 'Pustak',
      '{{tracking}}': cleanTracking,
      '{{tracking_link}}': trackingLink,
      '{{cod}}': order.codAmount ? `₹${order.codAmount}` : 'Nil',
      '{{order_id}}': order.orderId || '',
      '{{date}}': order.orderDate || new Date().toISOString().split('T')[0],
      '{{business_name}}': settings.businessName || 'Kabir Publication',
      '{{businessName}}': settings.businessName || 'Kabir Publication'
    };

    let msg = template;
    for (const [key, val] of Object.entries(replacements)) {
      msg = msg.split(key).join(val);
    }
    return msg;
  }

  // Validate order for WhatsApp sending
  function validateOrderForWhatsApp(order) {
    if (!order) {
      return { valid: false, message: 'Order data is missing.' };
    }
    if (!order.trackingId || !order.trackingId.trim()) {
      return { valid: false, message: 'Please add Tracking ID first. Tracking ID is required to send tracking message.' };
    }
    const cleanMobile = (order.mobile || '').replace(/\D/g, '').slice(-10);
    if (!cleanMobile || cleanMobile.length !== 10 || !/^[6-9]/.test(cleanMobile)) {
      return { valid: false, message: `Invalid mobile number: "${order.mobile}". Must be a valid 10-digit Indian number.` };
    }
    return { valid: true, cleanMobile };
  }

  // Send single WhatsApp tracking message
  async function sendTrackingMessage(orderId) {
    const order = window.KPStorage.getOrderById(orderId);
    if (!order) {
      if (window.showToast) window.showToast('Order not found', 'error');
      return { success: false, message: 'Order not found' };
    }

    const validation = validateOrderForWhatsApp(order);
    if (!validation.valid) {
      if (window.showToast) window.showToast(validation.message, 'warning');
      return { success: false, message: validation.message };
    }

    const settings = window.KPStorage.getSettings();
    const messageText = generateMessage(order);

    if (settings.whatsappMode === 'cloud_api' && window.KPStorage.isBackendConnected()) {
      try {
        const res = await fetch('/api/whatsapp/send-tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          await window.KPStorage.updateMessageStatus(orderId, 'Message Sent');
          if (window.showToast) window.showToast(`Cloud API: WhatsApp message sent to ${order.customerName}`, 'success');
          return { success: true };
        } else {
          await window.KPStorage.updateMessageStatus(orderId, 'Failed');
          if (window.showToast) window.showToast(`Cloud API Error: ${data.message || 'Send failed'}`, 'error');
          return { success: false, message: data.message };
        }
      } catch (err) {
        await window.KPStorage.updateMessageStatus(orderId, 'Failed');
        if (window.showToast) window.showToast(`Cloud API Network Error: ${err.message}`, 'error');
        return { success: false, message: err.message };
      }
    }

    // Manual wa.me deep-link mode
    const cleanNumber = `91${validation.cleanMobile}`;
    const encodedText = encodeURIComponent(messageText);
    const waUrl = `https://wa.me/${cleanNumber}?text=${encodedText}`;

    // Open WhatsApp
    const win = window.open(waUrl, '_blank');
    if (!win) {
      window.location.href = waUrl;
    }

    // Mark as Message Sent
    await window.KPStorage.updateMessageStatus(orderId, 'Message Sent');
    if (window.showToast) {
      window.showToast(`WhatsApp message opened for ${order.customerName}`, 'success');
    }

    // Refresh UI if listener exists
    if (window.KPApp && window.KPApp.refreshCurrentView) {
      window.KPApp.refreshCurrentView();
    }

    return { success: true, url: waUrl, message: messageText };
  }

  // Bulk Dispatch Queue State
  const bulkQueue = {
    items: [],
    currentIndex: 0,
    isRunning: false,
    timer: null,
    onProgressUpdate: null,
    onComplete: null
  };

  function initBulkQueue(orderIds, onProgressUpdate, onComplete) {
    const orders = orderIds.map(id => window.KPStorage.getOrderById(id)).filter(Boolean);
    bulkQueue.items = orders.map(order => {
      const v = validateOrderForWhatsApp(order);
      return {
        order,
        valid: v.valid,
        validationMsg: v.message || '',
        status: v.valid ? 'Ready' : 'Failed', // Ready, Opened, Sent, Failed
        message: v.valid ? generateMessage(order) : ''
      };
    });
    bulkQueue.currentIndex = 0;
    bulkQueue.isRunning = false;
    bulkQueue.onProgressUpdate = onProgressUpdate;
    bulkQueue.onComplete = onComplete;
    return bulkQueue.items;
  }

  // Open next item in bulk queue
  async function processNextBulkItem() {
    if (bulkQueue.currentIndex >= bulkQueue.items.length) {
      bulkQueue.isRunning = false;
      if (bulkQueue.onComplete) bulkQueue.onComplete();
      return null;
    }

    const item = bulkQueue.items[bulkQueue.currentIndex];
    if (!item.valid) {
      item.status = 'Failed';
      bulkQueue.currentIndex++;
      if (bulkQueue.onProgressUpdate) bulkQueue.onProgressUpdate(bulkQueue);
      return item;
    }

    const settings = window.KPStorage.getSettings();

    if (settings.whatsappMode === 'cloud_api' && window.KPStorage.isBackendConnected()) {
      try {
        const res = await fetch('/api/whatsapp/send-tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: item.order.orderId })
        });
        if (res.ok) {
          item.status = 'Sent';
          await window.KPStorage.updateMessageStatus(item.order.orderId, 'Message Sent');
        } else {
          item.status = 'Failed';
          await window.KPStorage.updateMessageStatus(item.order.orderId, 'Failed');
        }
      } catch (e) {
        item.status = 'Failed';
        await window.KPStorage.updateMessageStatus(item.order.orderId, 'Failed');
      }
    } else {
      // Manual deep link
      const cleanNumber = `91${item.order.mobile.replace(/\D/g, '').slice(-10)}`;
      const encodedText = encodeURIComponent(item.message);
      const waUrl = `https://wa.me/${cleanNumber}?text=${encodedText}`;
      
      item.status = 'Opened';
      window.open(waUrl, '_blank');
      await window.KPStorage.updateMessageStatus(item.order.orderId, 'Message Sent');
    }

    bulkQueue.currentIndex++;
    if (bulkQueue.onProgressUpdate) bulkQueue.onProgressUpdate(bulkQueue);

    if (bulkQueue.currentIndex >= bulkQueue.items.length) {
      bulkQueue.isRunning = false;
      if (bulkQueue.onComplete) bulkQueue.onComplete();
    }

    return item;
  }

  window.KPWhatsApp = {
    generateMessage,
    getTrackingLink,
    validateOrderForWhatsApp,
    sendTrackingMessage,
    bulkQueue,
    initBulkQueue,
    processNextBulkItem
  };

  // Reusable global alias requested in Section 22:
  window.sendTrackingMessage = sendTrackingMessage;

})(window);
