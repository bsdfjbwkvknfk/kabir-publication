/**
 * Kabir Publication - Reports & CSV Import/Export Module
 */

(function(window) {
  'use strict';

  // Export Orders to CSV
  function exportOrdersToCSV(filteredOrders = null) {
    const orders = filteredOrders || window.KPStorage.getOrders();
    if (!orders || orders.length === 0) {
      if (window.showToast) window.showToast('No orders available to export.', 'warning');
      return;
    }

    const headers = [
      'Order ID',
      'Customer Name',
      'Mobile',
      'Address',
      'City',
      'State',
      'PIN Code',
      'Book',
      'Quantity',
      'Tracking ID',
      'Courier',
      'COD',
      'Status',
      'Payment',
      'WhatsApp Status',
      'Delivered Date',
      'Remarks',
      'Created Date'
    ];

    function escapeCSV(val) {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }

    const rows = orders.map(o => [
      escapeCSV(o.orderId),
      escapeCSV(o.customerName),
      escapeCSV(o.mobile),
      escapeCSV(o.address),
      escapeCSV(o.city),
      escapeCSV(o.state),
      escapeCSV(o.pincode),
      escapeCSV(o.bookName),
      escapeCSV(o.quantity),
      escapeCSV(o.trackingId),
      escapeCSV(o.courier),
      escapeCSV(o.codAmount),
      escapeCSV(o.orderStatus),
      escapeCSV(o.paymentStatus),
      escapeCSV(o.whatsappStatus),
      escapeCSV(o.deliveredDate),
      escapeCSV(o.remarks),
      escapeCSV(o.createdDate)
    ].join(','));

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kabir-publication-orders.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (window.showToast) window.showToast(`Exported ${orders.length} orders to CSV`, 'success');
  }

  // Import Orders from CSV text
  async function importOrdersFromCSV(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('CSV file appears empty or missing data rows.');
    }

    // Parse CSV line taking quotes into account
    function parseCSVLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += c;
        }
      }
      result.push(current.trim());
      return result;
    }

    const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    let imported = 0;
    let duplicates = 0;
    let errors = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;

      const obj = {};
      header.forEach((h, idx) => {
        obj[h] = cols[idx] !== undefined ? cols[idx] : '';
      });

      const orderData = {
        orderId: obj['orderid'] || '',
        customerName: obj['customername'] || obj['name'] || obj['customer'] || 'Customer',
        mobile: obj['mobile'] || obj['phone'] || obj['contact'] || '',
        address: obj['address'] || '',
        city: obj['city'] || '',
        state: obj['state'] || '',
        pincode: obj['pincode'] || obj['pin'] || '',
        bookName: obj['book'] || obj['bookname'] || 'Gyan Ganga',
        quantity: parseInt(obj['quantity'] || obj['qty'], 10) || 1,
        trackingId: obj['trackingid'] || obj['tracking'] || '',
        courier: obj['courier'] || 'India Post',
        codAmount: parseFloat(obj['cod'] || obj['codamount']) || 0,
        paymentStatus: obj['payment'] || obj['paymentstatus'] || 'COD',
        orderStatus: obj['status'] || obj['orderstatus'] || 'Packed',
        whatsappStatus: obj['whatsappstatus'] || obj['whatsapp'] || 'Message Pending',
        deliveredDate: obj['delivereddate'] || '',
        remarks: obj['remarks'] || 'Imported from CSV'
      };

      const res = await window.KPStorage.saveOrder(orderData);
      if (res.success) imported++;
      else if (res.duplicate) duplicates++;
      else errors++;
    }

    return { imported, duplicates, errors, total: lines.length - 1 };
  }

  // Calculate Report Analytics for a given date range
  function getReportData(dateFilter = '30days', customStart = '', customEnd = '') {
    const orders = window.KPStorage.getOrders();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let startDate = null;
    let endDate = null;

    if (dateFilter === 'today') {
      startDate = todayStr;
      endDate = todayStr;
    } else if (dateFilter === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      startDate = y.toISOString().split('T')[0];
      endDate = startDate;
    } else if (dateFilter === '7days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      startDate = d.toISOString().split('T')[0];
      endDate = todayStr;
    } else if (dateFilter === '30days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      startDate = d.toISOString().split('T')[0];
      endDate = todayStr;
    } else if (dateFilter === 'custom') {
      startDate = customStart || '1970-01-01';
      endDate = customEnd || '2099-12-31';
    }

    const filtered = orders.filter(o => {
      const oDate = o.orderDate || (o.createdDate ? o.createdDate.split('T')[0] : '');
      if (!startDate) return true;
      return oDate >= startDate && oDate <= endDate;
    });

    const report = {
      totalOrders: filtered.length,
      totalCodAmount: 0,
      paidAmount: 0,
      pendingCod: 0,
      packedOrders: 0,
      shippedOrders: 0,
      deliveredOrders: 0,
      returnedOrders: 0,
      cancelledOrders: 0,
      whatsappSent: 0,
      whatsappPending: 0,
      bookBreakdown: {},
      courierBreakdown: {},
      orders: filtered
    };

    filtered.forEach(o => {
      const cod = parseFloat(o.codAmount) || 0;
      report.totalCodAmount += cod;

      const pay = (o.paymentStatus || '').toLowerCase();
      if (pay === 'online' || pay === 'paid') report.paidAmount += cod;
      else if (pay === 'cod' || pay === 'cod pending') report.pendingCod += cod;

      const st = (o.orderStatus || '').toLowerCase();
      if (st === 'packed') report.packedOrders++;
      else if (st === 'shipped') report.shippedOrders++;
      else if (st === 'delivered') report.deliveredOrders++;
      else if (st === 'returned') report.returnedOrders++;
      else if (st === 'cancelled') report.cancelledOrders++;

      const wa = (o.whatsappStatus || '').toLowerCase();
      if (wa.includes('sent')) report.whatsappSent++;
      else report.whatsappPending++;

      // Books breakdown
      const book = (o.bookName || 'Unspecified').trim();
      report.bookBreakdown[book] = (report.bookBreakdown[book] || 0) + (parseInt(o.quantity, 10) || 1);

      // Courier breakdown
      const courier = (o.courier || 'India Post').trim();
      report.courierBreakdown[courier] = (report.courierBreakdown[courier] || 0) + 1;
    });

    return report;
  }

  // Export Report Summary as CSV
  function exportReportSummaryCSV(report, filterLabel) {
    const lines = [
      `"Kabir Publication - Order Report (${filterLabel})"`,
      `"Generated At", "${new Date().toLocaleString('en-IN')}"`,
      '',
      '"Metric","Value"',
      `"Total Orders",${report.totalOrders}`,
      `"Total COD / Order Value","₹${report.totalCodAmount.toFixed(2)}"`,
      `"Paid Orders Value","₹${report.paidAmount.toFixed(2)}"`,
      `"Pending COD Amount","₹${report.pendingCod.toFixed(2)}"`,
      `"Packed Orders",${report.packedOrders}`,
      `"Shipped Orders",${report.shippedOrders}`,
      `"Delivered Orders",${report.deliveredOrders}`,
      `"Returned Orders",${report.returnedOrders}`,
      `"Cancelled Orders",${report.cancelledOrders}`,
      `"WhatsApp Messages Sent",${report.whatsappSent}`,
      `"WhatsApp Messages Pending",${report.whatsappPending}`,
      '',
      '"Book Name","Quantity Dispatched"',
      ...Object.entries(report.bookBreakdown).map(([book, qty]) => `"${book.replace(/"/g, '""')}",${qty}`),
      '',
      '"Courier","Shipment Count"',
      ...Object.entries(report.courierBreakdown).map(([cr, cnt]) => `"${cr.replace(/"/g, '""')}",${cnt}`)
    ];

    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kabir-publication-report-${filterLabel.replace(/\s+/g, '-').toLowerCase()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (window.showToast) window.showToast('Report CSV exported successfully', 'success');
  }

  window.KPReports = {
    exportOrdersToCSV,
    importOrdersFromCSV,
    getReportData,
    exportReportSummaryCSV
  };

})(window);
