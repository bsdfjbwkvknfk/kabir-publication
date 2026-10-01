/**
 * Kabir Publication - Excel (.xlsx / .xls) & CSV Import Engine
 * Automatically extracts customer orders, validates mobile numbers & PIN codes,
 * detects book names, tracking IDs, amounts, and saves directly to database.
 */

(function(window) {
  'use strict';

  // Helper: Find non-empty value from row matching given patterns
  function findColumnValue(row, patterns, exactOnly = false) {
    const keys = Object.keys(row);
    // Pass 1: exact normalized match with non-empty value
    for (const k of keys) {
      const val = row[k];
      if (val === '' || val === null || val === undefined) continue;
      const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const p of patterns) {
        if (clean === p) return val;
      }
    }
    if (exactOnly) return '';

    // Pass 2: substring match with non-empty value & collision guards
    for (const k of keys) {
      const val = row[k];
      if (val === '' || val === null || val === undefined) continue;
      const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      // Avoid matching "postal code" or "pin code" when searching for "cod"
      if (patterns.includes('cod') && (clean.includes('post') || clean.includes('pin') || clean.includes('zip') || clean.includes('code'))) {
        continue;
      }
      for (const p of patterns) {
        if (clean.includes(p)) return val;
      }
    }
    return '';
  }

  // Clean 10-digit mobile number from Excel value (handles numbers, floats, scientific notation)
  function cleanMobileNumber(val) {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    // Handle Excel scientific notation (e.g. 9.87654321E+09)
    if (/e\+/i.test(str)) {
      const num = Number(str);
      if (!isNaN(num)) str = num.toFixed(0);
    }
    const digits = str.replace(/\D/g, '');
    if (digits.length >= 10) {
      return digits.slice(-10);
    }
    return digits;
  }

  // Clean PIN code
  function cleanPincode(val, address = '') {
    if (val !== null && val !== undefined) {
      const digits = String(val).replace(/\D/g, '');
      if (digits.length === 6) return digits;
    }
    // Fallback: search 6-digit pin inside address string
    if (address) {
      const match = String(address).match(/\b([1-9]\d{5})\b/);
      if (match) return match[1];
    }
    return '';
  }

  // Parse Excel File (.xlsx, .xls, .csv)
  async function parseExcelFile(file) {
    if (!file) throw new Error('No file selected');

    const xlsxLib = (typeof XLSX !== 'undefined' ? XLSX : (window && window.XLSX));
    if (!xlsxLib) {
      throw new Error('SheetJS (XLSX) library is loading or missing. Please refresh the page.');
    }

    const dataBuffer = await file.arrayBuffer();
    const workbook = xlsxLib.read(dataBuffer, { type: 'array', cellDates: true });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel workbook contains no readable sheets.');
    }

    // Pick first non-empty sheet
    let worksheet = null;
    let sheetName = '';
    for (const name of workbook.SheetNames) {
      const ws = workbook.Sheets[name];
      if (ws && ws['!ref']) {
        worksheet = ws;
        sheetName = name;
        break;
      }
    }

    if (!worksheet) {
      throw new Error('All sheets in the Excel file appear empty.');
    }

    // Convert sheet to JSON array of objects
    const rawRows = xlsxLib.utils.sheet_to_json(worksheet, { defval: '', blankrows: false });
    if (!rawRows || rawRows.length === 0) {
      throw new Error(`Sheet "${sheetName}" has no data rows.`);
    }

    const settings = window.KPStorage ? window.KPStorage.getSettings() : {};
    const defaultBook = settings.defaultBook || 'Gyan Ganga';
    const defaultPayment = 'COD'; // As requested: default COD

    const candidates = [];
    let skippedEmpty = 0;

    rawRows.forEach((row, idx) => {
      // 1. Customer Name
      const customerName = String(findColumnValue(row, [
        'customername', 'receivername', 'consigneename', 'clientname', 'partyname', 'grahakkanam', 'grahakname',
        'customer', 'receiver', 'consignee', 'client', 'name', 'party', 'naam', 'grahak', 'recipient', 'buyer'
      ]) || '').trim();

      // 2. Mobile Number
      const rawMobile = findColumnValue(row, [
        'mobilenumber', 'phonenumber', 'contactnumber', 'mobileno', 'phoneno', 'contactno',
        'mobile', 'phone', 'contact', 'cell', 'mob', 'tel', 'phone1', 'mobile1'
      ]);
      const mobile = cleanMobileNumber(rawMobile);

      // 3. Address
      const address = String(findColumnValue(row, [
        'deliveryaddress', 'shippingaddress', 'fulladdress', 'customeraddress',
        'address', 'addr', 'street', 'destination', 'location', 'addressline'
      ]) || '').trim();

      // Skip completely empty rows
      if (!customerName && !mobile && !address) {
        skippedEmpty++;
        return;
      }

      // 4. City & State & PIN
      let city = String(findColumnValue(row, [
        'destinationcity', 'customercity', 'city', 'town', 'district', 'dist', 'village', 'tehsil'
      ]) || '').trim();

      let state = String(findColumnValue(row, [
        'destinationstate', 'customerstate', 'state', 'province', 'region'
      ]) || '').trim();

      const pincode = cleanPincode(findColumnValue(row, [
        'pincode', 'pin', 'postalcode', 'zipcode', 'zip', 'postal'
      ]), address);

      // 5. Book Name
      let bookName = String(findColumnValue(row, [
        'bookname', 'booktitle', 'itemname', 'productname', 'itemdescription', 'pustakkanam', 'pustakname',
        'book', 'title', 'item', 'product', 'literature', 'pustak', 'kitab'
      ]) || '').trim();
      if (!bookName) bookName = defaultBook;

      // 6. Quantity
      const rawQty = findColumnValue(row, ['quantity', 'qty', 'count', 'pcs', 'units']);
      const quantity = parseInt(rawQty, 10) || 1;

      // 7. Tracking ID / Consignment No
      const trackingId = String(findColumnValue(row, [
        'trackingid', 'consignmentno', 'articleno', 'awbno', 'courierno', 'docketno',
        'tracking', 'consignment', 'article', 'awb', 'barcode', 'lrno', 'trackno'
      ]) || '').trim().toUpperCase();

      // 8. Courier Partner
      let courier = String(findColumnValue(row, [
        'courierpartner', 'couriername', 'courier', 'carrier', 'service'
      ]) || '').trim();
      if (!courier) courier = 'India Post';

      // 9. COD / Amount
      const rawAmount = findColumnValue(row, [
        'codamount', 'collectablevalue', 'collectableamount', 'vpamount',
        'amount', 'cod', 'price', 'totalamount', 'total', 'value'
      ]);
      let codAmount = 0;
      if (rawAmount !== '' && rawAmount !== undefined && rawAmount !== null) {
        const parsed = parseFloat(String(rawAmount).replace(/[^0-9.]/g, ''));
        if (!isNaN(parsed)) codAmount = parsed;
      }

      // 10. Payment Status
      const rawPay = String(findColumnValue(row, [
        'paymentstatus', 'paymentmode', 'paymenttype', 'payment', 'paystatus'
      ]) || '').trim().toLowerCase();
      let paymentStatus = defaultPayment;
      if (rawPay === 'online' || rawPay === 'paid' || rawPay === 'prepaid') {
        paymentStatus = 'Online';
      } else {
        paymentStatus = 'COD';
      }

      // 11. Order ID (if provided in sheet, else generated)
      const existingOrderId = String(findColumnValue(row, ['orderid', 'orderno', 'id']) || '').trim();

      // Duplicate Check
      const dup = window.KPStorage ? window.KPStorage.checkDuplicate({ trackingId, mobile, customerName }) : { duplicate: false };

      candidates.push({
        fileName: file.name,
        page: idx + 1,
        orderId: existingOrderId,
        customerName: customerName || `Customer #${idx + 1}`,
        mobile: mobile,
        address: address || `${city ? city + ', ' : ''}${state || 'India'}`,
        city: city || 'Local',
        state: state || 'India',
        pincode: pincode,
        bookName: bookName,
        quantity: quantity,
        trackingId: trackingId,
        courier: courier,
        codAmount: codAmount,
        paymentStatus: paymentStatus,
        orderStatus: 'Packed',
        whatsappStatus: 'Message Pending',
        isDuplicate: dup.duplicate,
        duplicateReason: dup.reason || '',
        remarks: `Imported from Excel (${file.name})`
      });
    });

    return {
      fileName: file.name,
      sheetName,
      totalRows: rawRows.length,
      skippedEmpty,
      candidates
    };
  }

  // Save reviewed orders into storage
  async function saveImportedOrders(candidates) {
    if (!candidates || candidates.length === 0) return { saved: 0, duplicates: 0 };
    let saved = 0;
    let duplicates = 0;

    for (const item of candidates) {
      const orderData = {
        orderId: item.orderId || (window.KPStorage ? window.KPStorage.generateOrderId() : null),
        customerName: item.customerName,
        mobile: item.mobile,
        address: item.address,
        addressType: 'Home',
        city: item.city || 'Local',
        state: item.state || 'India',
        pincode: item.pincode,
        bookName: item.bookName || 'Gyan Ganga',
        quantity: item.quantity || 1,
        trackingId: item.trackingId || '',
        courier: item.courier || 'India Post',
        codAmount: parseFloat(item.codAmount) || 0,
        paymentStatus: item.paymentStatus || 'COD',
        orderStatus: 'Packed',
        whatsappStatus: 'Message Pending',
        remarks: item.remarks || `Imported from Excel`
      };

      if (window.KPStorage) {
        const res = await window.KPStorage.saveOrder(orderData, true);
        if (res && res.success) {
          saved++;
        } else if (window.KPStorage.updateOrder) {
          await window.KPStorage.updateOrder(orderData.orderId, orderData);
          saved++;
        }
      }
    }

    return { saved, duplicates: 0, total: candidates.length };
  }

  // Public Interface
  window.KPExcelImporter = {
    parseExcelFile,
    saveImportedOrders
  };

})(window);
