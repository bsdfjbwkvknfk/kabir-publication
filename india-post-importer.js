/**
 * Kabir Publication - 100% Workflow-Focused India Post Shipping Label Import & Order Generator
 * 
 * CORE PRINCIPLE: The uploaded India Post shipping label is the SOURCE OF TRUTH.
 * - Automatically reads uploaded labels (PDFs, JPGs, PNGs, WEBPs, multi-page PDFs, batches).
 * - Detects Tracking ID (Code128 barcode + text cross-validation).
 * - Identifies the RECEIVER block and extracts Customer Name, Address, Contact Number, City, State, PIN Code.
 * - STRICTLY IGNORES SENDER INFORMATION (Kabir Publication, 8875311878, 302020, Mansarovar, Jaipur, Rajasthan).
 * - STRICTLY IGNORES BOTTOM INFORMATION (Postal fees Rs 67.00, weight, booking ref, CustomerID).
 * - Provides interactive verification table, confidence scoring, manual corrections, side-by-side label viewer,
 *   duplicate tracking protection, and one-click order generation.
 */

(function(window) {
  'use strict';

  // Indian States & Union Territories
  const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi', 'Chandigarh', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'
  ];

  // Common State abbreviations
  const STATE_ALIASES = {
    'UP': 'Uttar Pradesh', 'U.P.': 'Uttar Pradesh', 'MP': 'Madhya Pradesh', 'M.P.': 'Madhya Pradesh',
    'HP': 'Himachal Pradesh', 'H.P.': 'Himachal Pradesh', 'AP': 'Andhra Pradesh', 'A.P.': 'Andhra Pradesh',
    'WB': 'West Bengal', 'W.B.': 'West Bengal', 'TN': 'Tamil Nadu', 'T.N.': 'Tamil Nadu',
    'UK': 'Uttarakhand', 'U.K.': 'Uttarakhand', 'RJ': 'Rajasthan', 'HR': 'Haryana',
    'PB': 'Punjab', 'BR': 'Bihar', 'JH': 'Jharkhand', 'CG': 'Chhattisgarh',
    'GJ': 'Gujarat', 'MH': 'Maharashtra', 'KA': 'Karnataka', 'KL': 'Kerala',
    'OD': 'Odisha', 'ORISSA': 'Odisha'
  };

  // 2-digit PIN code prefix to State mapping
  const PIN_TO_STATE_PREFIX = {
    '11': 'Delhi', '12': 'Haryana', '13': 'Haryana', '14': 'Punjab', '15': 'Punjab',
    '16': 'Chandigarh', '17': 'Himachal Pradesh', '18': 'Jammu and Kashmir', '19': 'Jammu and Kashmir',
    '20': 'Uttar Pradesh', '21': 'Uttar Pradesh', '22': 'Uttar Pradesh', '23': 'Uttar Pradesh',
    '24': 'Uttarakhand', '25': 'Uttar Pradesh', '26': 'Uttarakhand', '27': 'Uttar Pradesh',
    '28': 'Uttar Pradesh', '30': 'Rajasthan', '31': 'Rajasthan', '32': 'Rajasthan',
    '33': 'Rajasthan', '34': 'Rajasthan', '36': 'Gujarat', '37': 'Gujarat', '38': 'Gujarat',
    '39': 'Gujarat', '40': 'Maharashtra', '41': 'Maharashtra', '42': 'Maharashtra',
    '43': 'Maharashtra', '44': 'Maharashtra', '45': 'Madhya Pradesh', '46': 'Madhya Pradesh',
    '47': 'Madhya Pradesh', '48': 'Madhya Pradesh', '49': 'Chhattisgarh', '50': 'Telangana',
    '51': 'Andhra Pradesh', '52': 'Andhra Pradesh', '53': 'Andhra Pradesh', '56': 'Karnataka',
    '57': 'Karnataka', '58': 'Karnataka', '59': 'Karnataka', '60': 'Tamil Nadu',
    '61': 'Tamil Nadu', '62': 'Tamil Nadu', '63': 'Tamil Nadu', '64': 'Tamil Nadu',
    '67': 'Kerala', '68': 'Kerala', '69': 'Kerala', '70': 'West Bengal', '71': 'West Bengal',
    '72': 'West Bengal', '73': 'West Bengal', '74': 'West Bengal', '75': 'Odisha',
    '76': 'Odisha', '77': 'Odisha', '78': 'Assam', '79': 'North East', '80': 'Bihar',
    '81': 'Bihar', '82': 'Jharkhand', '83': 'Jharkhand', '84': 'Bihar', '85': 'Bihar'
  };

  // Known SENDER Signatures that must NEVER be used as Customer Details
  const SENDER_SIGNATURES = [
    /KABIR\s*PUBLICATION/i,
    /SATLOK\s*ASHRAM/i,
    /SUMER\s*NAGAR/i,
    /MANSAROVAR/i,
    /JAIPUR/i,
    /8875311878/,
    /9413508833/,
    /9413508834/,
    /302020/,
    /125121/,
    /BARWALA/i,
    /HISAR/i
  ];

  function isSenderText(text) {
    if (!text) return false;
    return SENDER_SIGNATURES.some(rx => rx.test(text));
  }

  function cleanTrackingNumber(code) {
    if (!code) return '';
    let clean = code.replace(/[\s\-_.:#]/g, '').toUpperCase();
    // Intelligent OCR correction: In India Post format (2 letters + 9 digits + 2 letters),
    // normalize letter lookalikes in the 9 middle numeric positions (e.g. O->0, I/l->1, S->5, Z->2)
    if (/^[A-Z]{2}[A-Z0-9]{9}[A-Z]{2}$/.test(clean)) {
      const prefix = clean.substring(0, 2);
      const middle = clean.substring(2, 11)
        .replace(/O/g, '0')
        .replace(/[IL]/g, '1')
        .replace(/S/g, '5')
        .replace(/Z/g, '2');
      const suffix = clean.substring(11);
      clean = prefix + middle + suffix;
    }
    return clean;
  }

  // Active in-memory session state
  const sessionState = {
    candidates: [],
    selectedIndices: new Set(),
    activeFilter: 'all', // 'all', 'ready', 'review', 'duplicate'
    searchQuery: '',
    currentSideBySideIndex: -1,
    zoomLevel: 1,
    rotationDeg: 0,
    isProcessing: false
  };

  // =========================================================================
  // 1. BARCODE DECODING ENGINE (BarcodeDetector API + ZXing Fallback)
  // =========================================================================
  async function scanCanvasForBarcode(canvas) {
    if (!canvas) return null;

    // 1. Native HTML5 BarcodeDetector (Chrome, Edge, Android)
    if ('BarcodeDetector' in window) {
      try {
        const detector = new window.BarcodeDetector({
          formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'upc_a']
        });
        const barcodes = await detector.detect(canvas);
        if (barcodes && barcodes.length > 0) {
          for (const b of barcodes) {
            const raw = cleanTrackingNumber(b.rawValue);
            if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(raw) || raw.length >= 8) {
              return { value: raw, format: b.format, confidence: 100, source: 'native-barcode-detector' };
            }
          }
          return { value: cleanTrackingNumber(barcodes[0].rawValue), format: barcodes[0].format, confidence: 95, source: 'native-barcode-detector' };
        }
      } catch (err) {
        // Fall through to ZXing
      }
    }

    // 2. ZXing Library Fallback
    if (window.ZXing && window.ZXing.BrowserMultiFormatReader) {
      try {
        const reader = new window.ZXing.BrowserMultiFormatReader();
        const result = await reader.decodeFromCanvas(canvas);
        if (result && result.getText()) {
          const raw = cleanTrackingNumber(result.getText());
          return { value: raw, format: result.getBarcodeFormat(), confidence: 100, source: 'zxing' };
        }
      } catch (e) {
        // Barcode not detected on this canvas
      }
    }

    return null;
  }

  // =========================================================================
  // 2. OCR RECOGNITION ENGINE (Tesseract.js with offline/fallback awareness)
  // =========================================================================
  async function recognizeCanvasWithOCR(canvas, onProgress) {
    if (!canvas) return { text: '', lines: [] };

    if (window.Tesseract) {
      try {
        let text = '';
        if (typeof window.Tesseract.recognize === 'function') {
          const ret = await window.Tesseract.recognize(canvas, 'eng', {
            logger: m => {
              if (onProgress && m.status === 'recognizing text') {
                onProgress(Math.round((m.progress || 0) * 100));
              }
            }
          });
          text = (ret && ret.data && ret.data.text) ? ret.data.text : '';
        } else if (typeof window.Tesseract.createWorker === 'function') {
          const worker = await window.Tesseract.createWorker('eng', 1, {
            logger: m => {
              if (onProgress && m.status === 'recognizing text') {
                onProgress(Math.round((m.progress || 0) * 100));
              }
            }
          });
          const ret = await worker.recognize(canvas);
          await worker.terminate();
          text = (ret && ret.data && ret.data.text) ? ret.data.text : '';
        }
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        return { text, lines };
      } catch (err) {
        console.warn('Tesseract OCR error:', err);
      }
    }

    return { text: '', lines: [] };
  }

  // =========================================================================
  // 3. TRACKING ID EXTRACTION & NORMALIZATION
  // =========================================================================
  function extractTrackingId(text) {
    if (!text) return null;

    // Standard India Post Article Number: 2 letters + 9 digits + 2 letters
    // E.g. CX067707572IN, EM123456789IN
    const ipMatch = text.match(/\b([A-Z]{2}[\s\-_]*\d(?:[\s\-_]*\d){8}[\s\-_]*[A-Z]{2})\b/i);
    if (ipMatch) {
      const cleaned = cleanTrackingNumber(ipMatch[1]);
      if (cleaned.length === 13) {
        return { id: cleaned, courier: 'India Post', confidence: 100 };
      }
    }

    // Explicit Article / Consignment / AWB tags
    const tagged = text.match(/\b(?:Article|Consignment|AWB|Tracking|Item|Docket)\s*(?:No|Num|Number|#)?\s*[:.-]?\s*([A-Z0-9\s-]{8,20})\b/i);
    if (tagged) {
      const cleaned = cleanTrackingNumber(tagged[1]);
      if (cleaned.length === 13 && /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(cleaned)) {
        return { id: cleaned, courier: 'India Post', confidence: 95 };
      } else if (cleaned.length >= 8 && cleaned.length <= 16) {
        const isIP = /^[A-Z]{2}\d+/.test(cleaned);
        return { id: cleaned, courier: isIP ? 'India Post' : 'Courier', confidence: 80 };
      }
    }

    return null;
  }

  // =========================================================================
  // 4. INTELLIGENT INDIA POST SHIPPING LABEL PARSER
  // =========================================================================
  function parseIndiaPostLabel(rawText, barcodeResult = null, context = {}) {
    const lines = (rawText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const result = {
      trackingId: '',
      trackingConfidence: 0,
      trackingMismatch: false,
      barcodeValue: barcodeResult ? barcodeResult.value : '',
      barcodeFormat: barcodeResult ? barcodeResult.format : '',
      barcodeMatched: false,
      customerName: '',
      nameConfidence: 0,
      contactNumber: '',
      phoneConfidence: 0,
      address: '',
      addressConfidence: 0,
      city: '',
      cityConfidence: 0,
      state: '',
      stateConfidence: 0,
      pincode: '',
      pinConfidence: 0,
      courier: 'India Post',
      orderStatus: 'Shipped',
      paymentMode: 'Unknown / Not Specified',
      amount: 0,
      bookName: '',
      overallStatus: 'Ready',
      overallConfidence: 0,
      senderBlock: '',
      receiverBlock: '',
      bottomBlock: '',
      isScanned: !!context.isScanned,
      previewImage: context.previewImage || null,
      fileName: context.fileName || 'Shipping Label',
      pageNumber: context.pageNumber || 1
    };

    // -------------------------------------------------------------
    // Step A: TRACKING ID & BARCODE CROSS-VALIDATION
    // -------------------------------------------------------------
    const textTracking = extractTrackingId(rawText);
    const barcodeCode = barcodeResult ? barcodeResult.value : null;

    if (textTracking && barcodeCode) {
      if (textTracking.id === barcodeCode) {
        // Perfect 100% cross-validated match
        result.trackingId = textTracking.id;
        result.trackingConfidence = 100;
        result.barcodeMatched = true;
        result.courier = textTracking.courier;
      } else {
        // Mismatch between barcode and text OCR
        result.trackingId = barcodeCode; // Barcodes have higher physical fidelity
        result.trackingConfidence = 75;
        result.trackingMismatch = true;
        result.courier = 'India Post';
      }
    } else if (barcodeCode) {
      result.trackingId = barcodeCode;
      result.trackingConfidence = 95;
      result.courier = /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(barcodeCode) ? 'India Post' : 'Courier';
    } else if (textTracking) {
      result.trackingId = textTracking.id;
      result.trackingConfidence = textTracking.confidence;
      result.courier = textTracking.courier;
    } else {
      result.trackingId = '';
      result.trackingConfidence = 0;
    }

    // -------------------------------------------------------------
    // Step B: SEMANTIC BLOCK SEGREGATION (RECEIVER vs SENDER vs BOTTOM)
    // -------------------------------------------------------------
    let receiverStartIndex = -1;
    let senderStartIndex = -1;
    let bottomStartIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect RECEIVER block start
      if (/^(?:RECEIVER|TO|SHIP\s*TO|DELIVER\s*TO|CONSIGNEE|ADDRESSEE|RECIPIENT)\s*[:.-]?/i.test(line)) {
        if (receiverStartIndex === -1) receiverStartIndex = i;
      }

      // Detect SENDER block start
      if (/^(?:SENDER|FROM|BOOKED\s*BY|SHIPPER|RETURN\s*TO)\s*[:.-]?/i.test(line) ||
          /^MS\.\s*KABIR\s*PUBLICATION/i.test(line) ||
          /^KABIR\s*PUBLICATION/i.test(line) ||
          /^SATLOK\s*ASHRAM/i.test(line)) {
        if (senderStartIndex === -1) senderStartIndex = i;
      }

      // Detect BOTTOM block start
      if (/^(?:Mansarovar\s*S\.?O|ChargedWeight|Phy\.Wt|Vol\.Wt|AmountPaid|BkgRefId|CustomerID|Weight\s*\(|Total\s*Charge)/i.test(line) ||
          /^\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2}/.test(line)) {
        if (bottomStartIndex === -1) bottomStartIndex = i;
      }
    }

    let receiverLines = [];
    let senderLines = [];
    let bottomLines = [];

    if (receiverStartIndex !== -1) {
      let receiverEndIndex = lines.length;
      if (senderStartIndex > receiverStartIndex) {
        receiverEndIndex = Math.min(receiverEndIndex, senderStartIndex);
      }
      if (bottomStartIndex > receiverStartIndex) {
        receiverEndIndex = Math.min(receiverEndIndex, bottomStartIndex);
      }
      receiverLines = lines.slice(receiverStartIndex, receiverEndIndex);
    }

    if (senderStartIndex !== -1) {
      let senderEndIndex = lines.length;
      if (receiverStartIndex > senderStartIndex) {
        senderEndIndex = Math.min(senderEndIndex, receiverStartIndex);
      }
      if (bottomStartIndex > senderStartIndex) {
        senderEndIndex = Math.min(senderEndIndex, bottomStartIndex);
      }
      senderLines = lines.slice(senderStartIndex, senderEndIndex);
    }

    if (bottomStartIndex !== -1) {
      bottomLines = lines.slice(bottomStartIndex);
    }

    // Fallback if no explicit RECEIVER tag: isolate by strictly filtering out sender & bottom lines
    if (receiverLines.length === 0) {
      const candidateLines = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isSenderText(line)) continue;
        if (/^(?:Mansarovar|ChargedWeight|Phy\.Wt|Vol\.Wt|AmountPaid|BkgRefId|CustomerID|INDIAPOST|PARCEL\s*CONTRACTUAL)/i.test(line)) continue;
        if (result.trackingId && line.includes(result.trackingId)) continue;
        candidateLines.push(line);
      }
      receiverLines = candidateLines;
    }

    result.receiverBlock = receiverLines.join('\n');
    result.senderBlock = senderLines.join('\n');
    result.bottomBlock = bottomLines.join('\n');

    const receiverText = receiverLines.join('\n');

    // -------------------------------------------------------------
    // Step C: CUSTOMER NAME EXTRACTION
    // -------------------------------------------------------------
    let nameFound = '';
    if (receiverLines.length > 0) {
      let firstLine = receiverLines[0]
        .replace(/^(?:RECEIVER|TO|SHIP\s*TO|DELIVER\s*TO|CONSIGNEE|ADDRESSEE|RECIPIENT)\s*[:.-]?\s*/i, '')
        .trim();

      if (firstLine.length > 0) {
        // If relation or address starts on same line, split cleanly
        const sIndex = firstLine.search(/\b(?:S\/O|D\/O|W\/O|C\/O|CONTACT|MOB|PHONE|AT\b|VIA\b|VILL\b)/i);
        if (sIndex > 0) {
          nameFound = firstLine.substring(0, sIndex).replace(/,\s*$/, '').trim();
        } else {
          nameFound = firstLine;
        }
      } else if (receiverLines.length > 1) {
        let secondLine = receiverLines[1].trim();
        const sIndex = secondLine.search(/\b(?:S\/O|D\/O|W\/O|C\/O|CONTACT|MOB|PHONE|AT\b|VIA\b|VILL\b)/i);
        if (sIndex > 0) {
          nameFound = secondLine.substring(0, sIndex).replace(/,\s*$/, '').trim();
        } else {
          nameFound = secondLine;
        }
      }
    }

    // Clean up name
    if (nameFound && !isSenderText(nameFound)) {
      result.customerName = nameFound.replace(/^[^\w\s]+|[^\w\s]+$/g, '').trim();
      result.nameConfidence = 98;
    } else {
      result.customerName = 'Not Found';
      result.nameConfidence = 0;
    }

    // -------------------------------------------------------------
    // Step D: CONTACT NUMBER (10-digit Indian Mobile)
    // -------------------------------------------------------------
    // Must strictly come from RECEIVER block
    const phoneRegex = /(?:CONTACT\s*(?:NO|NUM|NUMBER)?\.?|MOB(?:ILE)?\.?|PHONE\.?|TEL\.?|PH\.?)[:\s.-]*([6-9]\d{9})\b/i;
    const phoneMatch = receiverText.match(phoneRegex);
    if (phoneMatch && !isSenderText(phoneMatch[1])) {
      result.contactNumber = phoneMatch[1];
      result.phoneConfidence = 99;
    } else {
      // General 10-digit number in receiver block starting with 6-9
      const allPhones = receiverText.matchAll(/\b([6-9]\d{9})\b/g);
      for (const pm of allPhones) {
        if (!isSenderText(pm[1])) {
          result.contactNumber = pm[1];
          result.phoneConfidence = 95;
          break;
        }
      }
    }

    if (!result.contactNumber) {
      result.contactNumber = 'Not Found';
      result.phoneConfidence = 0;
    }

    // -------------------------------------------------------------
    // Step E: PIN CODE EXTRACTION (6-digit Indian PIN)
    // -------------------------------------------------------------
    // Prioritize PIN with * or # or - or PIN: prefix
    const pinStarMatch = receiverText.match(/(?:[\*\#\-]|PIN(?:\s*CODE)?[:\s.-]*)\s*([1-9]\d{5})(?!\d)/i);
    if (pinStarMatch) {
      const candidatePin = pinStarMatch[1];
      if (candidatePin !== '302020' && candidatePin !== '125121') {
        result.pincode = candidatePin;
        result.pinConfidence = 99;
      }
    }

    if (!result.pincode) {
      // Standalone 6-digit number using negative lookaround to never match part of a phone number
      const allPins = receiverText.matchAll(/(?<!\d)([1-9]\d{5})(?!\d)/g);
      for (const pinM of allPins) {
        const p = pinM[1];
        if (p !== '302020' && p !== '125121' && (!result.trackingId || !result.trackingId.includes(p))) {
          result.pincode = p;
          result.pinConfidence = 95;
          break;
        }
      }
    }

    // Top header fallback (e.g. Gowasa Shekhpura BO / 803214)
    if (!result.pincode || result.pincode === 'Not Found') {
      const topSection = (receiverStartIndex > 0) ? lines.slice(0, receiverStartIndex).join('\n') : rawText;
      const topPins = topSection.matchAll(/(?<!\d)([1-9]\d{5})(?!\d)/g);
      for (const pinM of topPins) {
        const p = pinM[1];
        if (p !== '302020' && p !== '125121' && (!result.trackingId || !result.trackingId.includes(p))) {
          result.pincode = p;
          result.pinConfidence = 92;
          break;
        }
      }
    }

    if (!result.pincode) {
      result.pincode = 'Not Found';
      result.pinConfidence = 0;
    }

    // -------------------------------------------------------------
    // Step F: STATE EXTRACTION
    // -------------------------------------------------------------
    let stateMatched = '';
    for (const st of INDIAN_STATES) {
      const rx = new RegExp(`\\b${st}\\b`, 'i');
      if (rx.test(receiverText)) {
        if (!isSenderText(st) || rx.test(receiverText.replace(result.senderBlock, ''))) {
          stateMatched = st.toUpperCase();
          result.stateConfidence = 99;
          break;
        }
      }
    }

    if (!stateMatched) {
      for (const [alias, full] of Object.entries(STATE_ALIASES)) {
        const rx = new RegExp(`\\b${alias}\\b`, 'i');
        if (rx.test(receiverText)) {
          stateMatched = full.toUpperCase();
          result.stateConfidence = 95;
          break;
        }
      }
    }

    // If state not in text, derive from PIN prefix
    if (!stateMatched && result.pincode && result.pincode !== 'Not Found') {
      const derived = PIN_TO_STATE_PREFIX[result.pincode.substring(0, 2)];
      if (derived) {
        stateMatched = derived.toUpperCase();
        result.stateConfidence = 90;
      }
    }

    result.state = stateMatched || 'Not Found';

    // -------------------------------------------------------------
    // Step G: CITY / VILLAGE / DISTRICT EXTRACTION
    // -------------------------------------------------------------
    let cityFound = '';
    if (result.state && result.state !== 'Not Found') {
      const stateRegex = new RegExp(`(?:([A-Za-z]+)\\s+)?${result.state}`, 'i');
      const m = receiverText.match(stateRegex);
      if (m && m[1]) {
        const candidateCity = m[1].trim().toUpperCase();
        if (!/^(?:CONTACT|NO|NUM|MOB|MOBILE|PHONE|VIA|AT|VILL|DIST|DISTT|NEAR|ROAD|STREET|PO|PS)$/i.test(candidateCity)) {
          cityFound = candidateCity;
          result.cityConfidence = 98;
        }
      }
    }

    if (!cityFound) {
      const distMatch = receiverText.match(/\b(?:DIST|DISTT|DISTRICT|VIA|CITY)[:\s.-]*([A-Za-z]+)\b/i);
      if (distMatch && distMatch[1]) {
        const cCity = distMatch[1].trim().toUpperCase();
        if (cCity.length > 2 && !/^(?:NEAR|ROAD|POST|OFFICE|BIHAR|INDIA)$/i.test(cCity)) {
          cityFound = cCity;
          result.cityConfidence = 92;
        }
      }
    }

    if (!cityFound) {
      const boMatch = rawText.match(/\b([A-Za-z\s]+)\s+(?:B\.?O\.?|S\.?O\.?|H\.?O\.?)\b/i);
      if (boMatch && boMatch[1] && !/mansarovar/i.test(boMatch[1])) {
        cityFound = boMatch[1].trim().toUpperCase();
        result.cityConfidence = 90;
      }
    }

    result.city = cityFound || (result.state !== 'Not Found' ? result.state : 'Not Found');
    if (!result.cityConfidence && result.city !== 'Not Found') {
      result.cityConfidence = 85;
    }

    // -------------------------------------------------------------
    // Step H: COMPLETE ADDRESS EXTRACTION
    // -------------------------------------------------------------
    const addressParts = [];
    for (let i = 0; i < receiverLines.length; i++) {
      let l = receiverLines[i];

      // If line 0, strip RECEIVER prefix and name
      if (i === 0) {
        l = l.replace(/^(?:RECEIVER|TO|SHIP\s*TO|DELIVER\s*TO|CONSIGNEE|ADDRESSEE|RECIPIENT)\s*[:.-]?\s*/i, '');
        if (result.customerName && result.customerName !== 'Not Found') {
          l = l.replace(result.customerName, '').replace(/^[, -]+/, '');
        }
      }

      // Strip contact numbers and labels
      l = l.replace(/CONTACT\s*(?:NO|NUM|NUMBER)?\.?[:\s.-]*\d*/gi, '');
      l = l.replace(/\b(?:MOB(?:ILE)?|PHONE|TEL|PH)\b\.?[:\s.-]*\d*/gi, '');
      l = l.replace(/\b[6-9]\d{9}\b/g, '');

      // Strip PIN code and asterisk lines
      if (result.pincode && result.pincode !== 'Not Found') {
        l = l.replace(result.pincode, '');
      }
      l = l.replace(/^\s*[\*\#]\s*\d*\s*$/, '');
      l = l.replace(/PIN(?:\s*Code)?[:\s.-]*\d*/gi, '');

      // Strip city & state if trailing
      if (result.state && result.state !== 'Not Found') {
        l = l.replace(new RegExp(`\\b${result.state}\\b`, 'gi'), '');
      }
      if (result.city && result.city !== 'Not Found' && result.city !== result.state) {
        l = l.replace(new RegExp(`\\b${result.city}\\b`, 'gi'), '');
      }

      l = l.replace(/^[,\s.-]+|[,\s.-]+$/g, '').trim();

      if (l.length > 2 && !isSenderText(l)) {
        addressParts.push(l);
      }
    }

    result.address = addressParts.join(', ').replace(/\s*,\s*,+/g, ', ').trim();
    if (result.address) {
      result.addressConfidence = 96;
    } else {
      result.address = 'Not Found';
      result.addressConfidence = 0;
    }

    // -------------------------------------------------------------
    // Step I: BOOK NAME & PAYMENT / COD AMOUNT
    // -------------------------------------------------------------
    // Only detect COD if clearly written
    const codMatch = rawText.match(/(?:COD\s*Amount|Collectable\s*Value|Collectable\s*Amount|VP\s*Amount)[:\s₹=]*(?:Rs\.?)?\s*(\d+(?:\.\d{1,2})?)/i);
    if (codMatch) {
      const amt = parseFloat(codMatch[1]);
      if (!isNaN(amt) && amt > 0) {
        result.amount = amt;
        result.paymentMode = 'COD';
      }
    }

    // Check if Book Name is on label (e.g. Gyan Ganga, Jeene Ki Raah)
    const settings = (typeof window !== 'undefined' && window.KPStorage) ? window.KPStorage.getSettings() : null;
    const knownBooks = (settings && Array.isArray(settings.books)) ? settings.books : ['Gyan Ganga', 'Jeene Ki Raah', 'Geeta Tera Gyan Amrit'];
    for (const b of knownBooks) {
      const rx = new RegExp(`\\b${b.replace(/\s+/g, '\\s*')}\\b`, 'i');
      if (rx.test(rawText)) {
        result.bookName = b;
        break;
      }
    }
    if (!result.bookName && settings && settings.defaultBook) {
      result.bookName = settings.defaultBook;
    }
    if (!result.bookName) {
      result.bookName = 'Gyan Ganga';
    }

    // -------------------------------------------------------------
    // Step J: OVERALL CONFIDENCE & READINESS STATUS
    // -------------------------------------------------------------
    const scores = [
      result.trackingConfidence,
      result.nameConfidence,
      result.phoneConfidence,
      result.addressConfidence,
      result.cityConfidence,
      result.stateConfidence,
      result.pinConfidence
    ];
    result.overallConfidence = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    const isComplete = (
      result.trackingId &&
      result.customerName !== 'Not Found' &&
      result.contactNumber !== 'Not Found' &&
      result.pincode !== 'Not Found' &&
      !result.trackingMismatch
    );

    // Check if duplicate in storage
    let isDuplicate = false;
    let duplicateReason = '';
    if (window.KPStorage && window.KPStorage.checkDuplicate) {
      const dup = window.KPStorage.checkDuplicate({
        trackingId: result.trackingId,
        mobile: result.contactNumber !== 'Not Found' ? result.contactNumber : '',
        customerName: result.customerName !== 'Not Found' ? result.customerName : '',
        pincode: result.pincode !== 'Not Found' ? result.pincode : ''
      });
      if (dup && dup.duplicate) {
        isDuplicate = true;
        duplicateReason = dup.reason;
      }
    }
    result.isDuplicate = isDuplicate;
    result.duplicateReason = duplicateReason;

    if (isDuplicate) {
      result.overallStatus = 'Duplicate';
    } else if (isComplete && result.overallConfidence >= 80) {
      result.overallStatus = 'Ready';
    } else {
      result.overallStatus = 'Needs Review';
    }

    // Normalized aliases for seamless integration across all views & tables
    result.mobile = (result.contactNumber && result.contactNumber !== 'Not Found') ? result.contactNumber : '';
    result.customerName = (result.customerName && result.customerName !== 'Not Found') ? result.customerName : '';
    result.address = (result.address && result.address !== 'Not Found') ? result.address : '';
    result.city = (result.city && result.city !== 'Not Found') ? result.city : '';
    result.state = (result.state && result.state !== 'Not Found') ? result.state : '';
    result.pincode = (result.pincode && result.pincode !== 'Not Found') ? result.pincode : '';
    result.codAmount = result.amount || 0;
    result.paymentStatus = result.paymentMode === 'Online' ? 'Online' : 'COD';
    result.orderId = result.trackingId || '';

    return result;
  }

  // =========================================================================
  // 5. PDF RENDERER & MULTI-LABEL SEGMENTATION
  // =========================================================================
  async function renderPdfPageToCanvas(page, scale = 2.0) {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }

  async function renderImageFileToCanvas(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve({ canvas, dataUrl: canvas.toDataURL('image/jpeg', 0.85) });
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }

  // =========================================================================
  // 6. PROCESS MULTIPLE UPLOADED FILES (PDFs, Images, Multi-Page PDFs)
  // =========================================================================
  async function processUploadedFiles(fileList, onProgress) {
    sessionState.isProcessing = true;
    const files = Array.from(fileList || []);
    const newCandidates = [];

    let totalSteps = files.length;
    let completedSteps = 0;

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      const file = files[fIdx];
      const isPdf = /\.pdf$/i.test(file.name);
      const isImg = /\.(jpe?g|png|webp|bmp)$/i.test(file.name);

      if (onProgress) {
        onProgress({
          fileIndex: fIdx + 1,
          totalFiles: files.length,
          fileName: file.name,
          percent: Math.round((completedSteps / totalSteps) * 100),
          status: `Processing ${file.name}...`
        });
      }

      // --- PDF HANDLER (Handles 1 to 100+ pages) ---
      if (isPdf) {
        try {
          if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js library is not loaded');
          }
          if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          }

          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

          for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
            if (onProgress) {
              onProgress({
                fileIndex: fIdx + 1,
                totalFiles: files.length,
                pageNumber: pNum,
                totalPages: pdf.numPages,
                fileName: file.name,
                percent: Math.round(((completedSteps + (pNum / pdf.numPages)) / totalSteps) * 100),
                status: `Reading ${file.name} (Page ${pNum} of ${pdf.numPages})...`
              });
            }

            const page = await pdf.getPage(pNum);
            
            // 1. Render page to canvas for side-by-side preview & barcode detection
            let canvas = null;
            let previewImage = null;
            let barcodeResult = null;
            try {
              canvas = await renderPdfPageToCanvas(page, 1.5);
              previewImage = canvas.toDataURL('image/jpeg', 0.85);
              barcodeResult = await scanCanvasForBarcode(canvas);
            } catch (renderErr) {
              console.warn('Canvas render error for page:', pNum, renderErr);
            }

            // 2. Extract PDF text content
            const textContent = await page.getTextContent();
            let rawText = '';
            if (textContent && textContent.items && textContent.items.length > 0) {
              const lineMap = new Map();
              textContent.items.forEach(item => {
                const rawY = Math.round(item.transform[5] / 4) * 4; // 4-pt grouping tolerance
                if (!lineMap.has(rawY)) lineMap.set(rawY, []);
                lineMap.get(rawY).push({ x: item.transform[4], str: item.str });
              });
              const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
              const lines = [];
              sortedY.forEach(y => {
                const items = lineMap.get(y).sort((a, b) => a.x - b.x);
                lines.push(items.map(i => i.str).join(' ').trim());
              });
              rawText = lines.filter(Boolean).join('\n');
            }

            // 3. If text is empty or minimal (< 20 chars), run Tesseract OCR on canvas
            let isScanned = false;
            if (rawText.trim().length < 25 && canvas) {
              isScanned = true;
              if (onProgress) {
                onProgress({
                  fileIndex: fIdx + 1,
                  totalFiles: files.length,
                  pageNumber: pNum,
                  totalPages: pdf.numPages,
                  fileName: file.name,
                  percent: Math.round(((completedSteps + (pNum / pdf.numPages)) / totalSteps) * 100),
                  status: `Running OCR on Scanned Page ${pNum}...`
                });
              }
              const ocrRes = await recognizeCanvasWithOCR(canvas);
              if (ocrRes.text) {
                rawText = ocrRes.text;
              }
            }

            // 4. Parse the label
            const parsed = parseIndiaPostLabel(rawText, barcodeResult, {
              isScanned,
              previewImage,
              fileName: file.name,
              pageNumber: pNum
            });

            newCandidates.push(parsed);
          }
        } catch (pdfErr) {
          console.error(`Error reading PDF ${file.name}:`, pdfErr);
          newCandidates.push({
            trackingId: `KP-FAIL-${Date.now().toString().slice(-5)}`,
            customerName: 'Failed to read PDF page',
            contactNumber: 'Not Found',
            address: 'Error parsing PDF document',
            city: 'Local',
            state: 'India',
            pincode: 'Not Found',
            courier: 'India Post',
            overallStatus: 'Needs Review',
            overallConfidence: 0,
            fileName: file.name,
            pageNumber: 1
          });
        }
      }
      // --- IMAGE HANDLER (JPG, PNG, WEBP) ---
      else if (isImg) {
        try {
          const { canvas, dataUrl } = await renderImageFileToCanvas(file);
          
          if (onProgress) {
            onProgress({
              fileIndex: fIdx + 1,
              totalFiles: files.length,
              fileName: file.name,
              percent: Math.round((completedSteps / totalSteps) * 100),
              status: `Scanning barcode & text in ${file.name}...`
            });
          }

          const barcodeResult = await scanCanvasForBarcode(canvas);
          const ocrRes = await recognizeCanvasWithOCR(canvas, (p) => {
            if (onProgress) {
              onProgress({
                fileIndex: fIdx + 1,
                totalFiles: files.length,
                fileName: file.name,
                percent: Math.round((completedSteps / totalSteps) * 100),
                status: `Running OCR on ${file.name} (${p}%)...`
              });
            }
          });

          const parsed = parseIndiaPostLabel(ocrRes.text, barcodeResult, {
            isScanned: true,
            previewImage: dataUrl,
            fileName: file.name,
            pageNumber: 1
          });

          newCandidates.push(parsed);
        } catch (imgErr) {
          console.error(`Error reading image ${file.name}:`, imgErr);
        }
      }
      // --- TEXT FILE HANDLER ---
      else {
        try {
          const text = await file.text();
          const parsed = parseIndiaPostLabel(text, null, {
            fileName: file.name,
            pageNumber: 1
          });
          newCandidates.push(parsed);
        } catch (txtErr) {
          console.error(`Error reading text ${file.name}:`, txtErr);
        }
      }

      completedSteps++;
    }

    sessionState.isProcessing = false;
    sessionState.candidates.push(...newCandidates);
    
    // Auto-select all ready items
    sessionState.candidates.forEach((_, idx) => {
      sessionState.selectedIndices.add(idx);
    });

    renderExtractionTable();
    return sessionState.candidates;
  }

  // =========================================================================
  // 7. SAMPLE LABEL TEST HARNESS (Loads the user's exact sample label)
  // =========================================================================
  function loadSampleTestLabel() {
    const sampleText = `
CX067707572IN - INDIAPOST PARCEL CONTRACTUAL

RECEIVER:MR. MOHAMMAD TAJ ASLAM
S/O MD. ASLAM, GOWASA SHEKHPURA,
AT GOLAMBAR, VIA-BARH, CONTACT NO.
7033177455 PATNA BIHAR
* 803214

MS. KABIR PUBLICATION
305, SUMER NAGAR VISTAR Q BLOCK
MANSAROVAR
CONTACT NO. 8875311878
JAIPUR RAJASTHAN
INDIA-302020

Mansarovar S.O (302020)
30/09/2026, 23:39:36
ChargedWeight(gms): 870
Phy.Wt(gms): 870
Vol.Wt(gms): 470
AmountPaid: Rs 67.00
(CONTRACT)
BkgRefId: 1000392309
CustomerID: 6000012345
`;

    // Create a mock visual canvas label for side-by-side preview demonstration
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 600, 700);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('भारतीय डाक / INDIA POST - SPEED POST', 24, 36);
    ctx.font = 'bold 20px monospace';
    ctx.fillText('CX067707572IN', 24, 75);
    ctx.strokeRect(20, 95, 560, 2);

    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#0369a1';
    ctx.fillText('RECEIVER / TO:', 24, 125);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('MR. MOHAMMAD TAJ ASLAM', 24, 150);
    ctx.font = '14px sans-serif';
    ctx.fillText('S/O MD. ASLAM, GOWASA SHEKHPURA,', 24, 175);
    ctx.fillText('AT GOLAMBAR, VIA-BARH', 24, 195);
    ctx.fillText('CONTACT NO: 7033177455', 24, 220);
    ctx.fillText('PATNA, BIHAR - 803214', 24, 245);

    ctx.strokeRect(20, 275, 560, 2);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('SENDER / FROM (IGNORED AS CUSTOMER):', 24, 305);
    ctx.font = '13px sans-serif';
    ctx.fillText('MS. KABIR PUBLICATION', 24, 328);
    ctx.fillText('305, SUMER NAGAR VISTAR Q BLOCK, MANSAROVAR', 24, 348);
    ctx.fillText('CONTACT NO: 8875311878 | JAIPUR RAJASTHAN - 302020', 24, 368);

    ctx.strokeRect(20, 395, 560, 2);
    ctx.font = '12px monospace';
    ctx.fillText('Mansarovar S.O (302020) | 30/09/2026, 23:39:36', 24, 425);
    ctx.fillText('ChargedWt: 870g | AmountPaid: Rs 67.00 | BkgRef: 1000392309', 24, 445);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    const parsed = parseIndiaPostLabel(sampleText, { value: 'CX067707572IN', format: 'code_128' }, {
      fileName: 'Sample_IndiaPost_Label.pdf',
      pageNumber: 1,
      previewImage: dataUrl
    });

    sessionState.candidates.unshift(parsed);
    sessionState.selectedIndices.add(0);
    renderExtractionTable();
    openSideBySideModal(0);

    if (window.showToast) {
      window.showToast('✅ Sample India Post Label loaded! Receiver segregated, Sender ignored.', 'success');
    }
  }

  // =========================================================================
  // 8. EXTRACTION TABLE RENDERING (Section 17)
  // =========================================================================
  function renderExtractionTable() {
    const tableBody = document.getElementById('extraction-table-body');
    const emptyState = document.getElementById('extraction-table-empty');
    const tableContainer = document.getElementById('extraction-table-container');
    const batchControls = document.getElementById('extraction-batch-controls');
    
    // Status counters
    const countTotal = document.getElementById('extract-stat-total');
    const countReady = document.getElementById('extract-stat-ready');
    const countReview = document.getElementById('extract-stat-review');
    const countDup = document.getElementById('extract-stat-dup');
    const btnCreateOrders = document.getElementById('btn-create-orders-action');

    const list = sessionState.candidates;

    if (!list || list.length === 0) {
      if (tableContainer) tableContainer.style.display = 'none';
      if (batchControls) batchControls.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      if (countTotal) countTotal.textContent = '0';
      if (countReady) countReady.textContent = '0';
      if (countReview) countReview.textContent = '0';
      if (countDup) countDup.textContent = '0';
      if (btnCreateOrders) btnCreateOrders.disabled = true;
      return;
    }

    if (tableContainer) tableContainer.style.display = 'block';
    if (batchControls) batchControls.style.display = 'flex';
    if (emptyState) emptyState.style.display = 'none';

    // Calculate totals
    let readyCount = 0;
    let reviewCount = 0;
    let dupCount = 0;

    list.forEach(c => {
      if (c.overallStatus === 'Ready') readyCount++;
      else if (c.overallStatus === 'Duplicate') dupCount++;
      else reviewCount++;
    });

    if (countTotal) countTotal.textContent = list.length;
    if (countReady) countReady.textContent = readyCount;
    if (countReview) countReview.textContent = reviewCount;
    if (countDup) countDup.textContent = dupCount;

    // Filter items
    const filtered = list.map((item, idx) => ({ item, originalIndex: idx })).filter(({ item }) => {
      if (sessionState.activeFilter === 'ready' && item.overallStatus !== 'Ready') return false;
      if (sessionState.activeFilter === 'review' && item.overallStatus !== 'Needs Review') return false;
      if (sessionState.activeFilter === 'duplicate' && item.overallStatus !== 'Duplicate') return false;
      
      if (sessionState.searchQuery) {
        const q = sessionState.searchQuery.toLowerCase();
        const str = `${item.trackingId} ${item.customerName} ${item.contactNumber} ${item.address} ${item.city} ${item.state} ${item.pincode}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });

    if (btnCreateOrders) {
      const selCount = sessionState.selectedIndices.size;
      btnCreateOrders.disabled = selCount === 0;
      btnCreateOrders.innerHTML = `🚀 Create Orders (${selCount} Selected)`;
    }

    if (!tableBody) return;

    tableBody.innerHTML = filtered.map(({ item, originalIndex }) => {
      const isSelected = sessionState.selectedIndices.has(originalIndex);
      
      let statusBadge = '';
      if (item.overallStatus === 'Ready') {
        statusBadge = `<span class="badge-status-pill badge-ready" title="Confidence: ${item.overallConfidence}%">✅ Ready (${item.overallConfidence}%)</span>`;
      } else if (item.overallStatus === 'Duplicate') {
        statusBadge = `<span class="badge-status-pill badge-duplicate" title="${item.duplicateReason}">⚠️ Duplicate Tracking</span>`;
      } else {
        statusBadge = `<span class="badge-status-pill badge-review" title="Please review missing fields">⚠️ Needs Review (${item.overallConfidence}%)</span>`;
      }

      const barcodeBadge = item.barcodeMatched ? 
        `<span class="badge-barcode-match" title="Barcode Verified Match">✓ Barcode Match</span>` : 
        (item.trackingMismatch ? `<span class="badge-barcode-mismatch" title="Mismatch with Barcode">⚠️ Mismatch</span>` : '');

      return `
        <tr class="${isSelected ? 'row-selected' : ''}">
          <td style="text-align:center;">
            <input type="checkbox" class="extract-checkbox" ${isSelected ? 'checked' : ''} onchange="window.KPIndiaPostImporter.toggleSelect(${originalIndex}, this.checked)">
          </td>
          <td>
            <div style="font-weight:700; font-family:var(--font-mono); color:var(--primary);">${escapeHTML(item.trackingId || 'MISSING')}</div>
            ${barcodeBadge}
            <div style="font-size:0.72rem; color:var(--text-muted);">${escapeHTML(item.courier)}</div>
          </td>
          <td>
            <div style="font-weight:700; color:var(--text-main);">${escapeHTML(item.customerName)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${item.nameConfidence ? item.nameConfidence + '% conf.' : ''}</div>
          </td>
          <td>
            <div style="font-family:var(--font-mono); font-weight:600;">${escapeHTML(item.contactNumber)}</div>
          </td>
          <td>
            <div style="font-size:0.82rem; max-width:240px; white-space:normal; line-height:1.35;" title="${escapeHTML(item.address)}">
              ${escapeHTML(item.address)}
            </div>
          </td>
          <td><strong>${escapeHTML(item.city)}</strong></td>
          <td>${escapeHTML(item.state)}</td>
          <td><span style="font-weight:700; font-family:var(--font-mono);">${escapeHTML(item.pincode)}</span></td>
          <td>${statusBadge}</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn btn-xs btn-outline" onclick="window.KPIndiaPostImporter.openSideBySideModal(${originalIndex})" title="View original label side-by-side">
                👁️ View Label
              </button>
              <button type="button" class="btn btn-xs btn-outline" style="color:var(--danger);" onclick="window.KPIndiaPostImporter.deleteCandidate(${originalIndex})" title="Remove label">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // =========================================================================
  // 9. SIDE-BY-SIDE VISUAL INSPECTION & EDIT MODAL (Section 18 & 19)
  // =========================================================================
  function openSideBySideModal(index) {
    if (index < 0 || index >= sessionState.candidates.length) return;
    sessionState.currentSideBySideIndex = index;
    sessionState.zoomLevel = 1;
    sessionState.rotationDeg = 0;

    const modal = document.getElementById('modal-label-sidebyside');
    if (!modal) return;

    populateSideBySideData(index);
    modal.classList.add('modal-open');
  }

  function populateSideBySideData(index) {
    const item = sessionState.candidates[index];
    if (!item) return;

    // Left Column: Original Label Image / Canvas
    const imgEl = document.getElementById('sidebyside-label-img');
    const noImgEl = document.getElementById('sidebyside-no-img');
    const labelTitle = document.getElementById('sidebyside-modal-title');
    const labelSubtitle = document.getElementById('sidebyside-modal-sub');

    if (labelTitle) labelTitle.textContent = `Label #${index + 1} of ${sessionState.candidates.length} - ${item.fileName || 'Label'}`;
    if (labelSubtitle) labelSubtitle.textContent = `Page ${item.pageNumber || 1} • Courier: ${item.courier}`;

    if (item.previewImage && imgEl) {
      imgEl.src = item.previewImage;
      imgEl.style.display = 'block';
      imgEl.style.transform = `scale(${sessionState.zoomLevel}) rotate(${sessionState.rotationDeg}deg)`;
      if (noImgEl) noImgEl.style.display = 'none';
    } else if (imgEl) {
      imgEl.style.display = 'none';
      if (noImgEl) noImgEl.style.display = 'flex';
    }

    // Right Column: Editable Form Fields
    setValue('sidebyside-input-tracking', item.trackingId);
    setValue('sidebyside-input-name', item.customerName);
    setValue('sidebyside-input-phone', item.contactNumber === 'Not Found' ? '' : item.contactNumber);
    setValue('sidebyside-input-address', item.address === 'Not Found' ? '' : item.address);
    setValue('sidebyside-input-city', item.city === 'Not Found' ? '' : item.city);
    setValue('sidebyside-input-state', item.state === 'Not Found' ? '' : item.state);
    setValue('sidebyside-input-pin', item.pincode === 'Not Found' ? '' : item.pincode);
    setValue('sidebyside-input-book', item.bookName || 'Gyan Ganga');
    setValue('sidebyside-input-amount', item.amount || 0);
    setValue('sidebyside-select-payment', item.paymentMode || 'Unknown / Not Specified');

    // Confidence Badges
    setText('conf-badge-tracking', `${item.trackingConfidence}%`);
    setText('conf-badge-name', `${item.nameConfidence}%`);
    setText('conf-badge-phone', `${item.phoneConfidence}%`);
    setText('conf-badge-address', `${item.addressConfidence}%`);
    setText('conf-badge-city', `${item.cityConfidence}%`);
    setText('conf-badge-state', `${item.stateConfidence}%`);
    setText('conf-badge-pin', `${item.pinConfidence}%`);

    // Audit Segregation Transparency Boxes
    setText('sidebyside-raw-receiver', item.receiverBlock || 'No explicit receiver block parsed');
    setText('sidebyside-raw-sender', item.senderBlock || 'MS. KABIR PUBLICATION, CONTACT NO. 8875311878, JAIPUR RAJASTHAN INDIA-302020 (Strictly Ignored as Customer)');
    setText('sidebyside-raw-bottom', item.bottomBlock || 'Mansarovar S.O (302020), AmountPaid Rs 67.00, Weight, BkgRefId (Strictly Ignored)');

    // Navigation Buttons
    const btnPrev = document.getElementById('sidebyside-btn-prev');
    const btnNext = document.getElementById('sidebyside-btn-next');
    if (btnPrev) btnPrev.disabled = index <= 0;
    if (btnNext) btnNext.disabled = index >= sessionState.candidates.length - 1;
  }

  function saveCurrentSideBySideChanges() {
    const idx = sessionState.currentSideBySideIndex;
    if (idx < 0 || idx >= sessionState.candidates.length) return;

    const item = sessionState.candidates[idx];
    item.trackingId = getValue('sidebyside-input-tracking').trim();
    item.customerName = getValue('sidebyside-input-name').trim();
    item.contactNumber = getValue('sidebyside-input-phone').trim().replace(/\D/g, '').slice(-10);
    item.address = getValue('sidebyside-input-address').trim();
    item.city = getValue('sidebyside-input-city').trim();
    item.state = getValue('sidebyside-input-state').trim();
    item.pincode = getValue('sidebyside-input-pin').trim().slice(0, 6);
    item.bookName = getValue('sidebyside-input-book').trim();
    item.amount = parseFloat(getValue('sidebyside-input-amount')) || 0;
    item.paymentMode = getValue('sidebyside-select-payment');

    // Update confidence scores to 100% since human verified!
    item.trackingConfidence = item.trackingId ? 100 : 0;
    item.nameConfidence = item.customerName ? 100 : 0;
    item.phoneConfidence = item.contactNumber.length === 10 ? 100 : 0;
    item.addressConfidence = item.address ? 100 : 0;
    item.cityConfidence = item.city ? 100 : 0;
    item.stateConfidence = item.state ? 100 : 0;
    item.pinConfidence = item.pincode.length === 6 ? 100 : 0;
    item.overallConfidence = 100;
    item.trackingMismatch = false;

    // Check completeness
    if (item.trackingId && item.customerName && item.contactNumber && item.pincode) {
      item.overallStatus = 'Ready';
    } else {
      item.overallStatus = 'Needs Review';
    }

    renderExtractionTable();
    if (window.showToast) {
      window.showToast('✅ Label details saved and marked verified!', 'success');
    }
  }

  function navigateSideBySide(delta) {
    saveCurrentSideBySideChanges();
    const newIdx = sessionState.currentSideBySideIndex + delta;
    if (newIdx >= 0 && newIdx < sessionState.candidates.length) {
      openSideBySideModal(newIdx);
    }
  }

  function adjustSideBySideZoom(delta) {
    sessionState.zoomLevel = Math.max(0.5, Math.min(3.0, sessionState.zoomLevel + delta));
    const imgEl = document.getElementById('sidebyside-label-img');
    if (imgEl) {
      imgEl.style.transform = `scale(${sessionState.zoomLevel}) rotate(${sessionState.rotationDeg}deg)`;
    }
  }

  function rotateSideBySide() {
    sessionState.rotationDeg = (sessionState.rotationDeg + 90) % 360;
    const imgEl = document.getElementById('sidebyside-label-img');
    if (imgEl) {
      imgEl.style.transform = `scale(${sessionState.zoomLevel}) rotate(${sessionState.rotationDeg}deg)`;
    }
  }

  function closeSideBySideModal() {
    const modal = document.getElementById('modal-label-sidebyside');
    if (modal) modal.classList.remove('modal-open');
  }

  // =========================================================================
  // 10. ORDER GENERATION ENGINE (Section 21, 22, 23, 24)
  // =========================================================================
  async function createOrdersFromVerifiedLabels() {
    const selected = [];
    sessionState.selectedIndices.forEach(idx => {
      if (sessionState.candidates[idx]) {
        selected.push({ item: sessionState.candidates[idx], index: idx });
      }
    });

    if (selected.length === 0) {
      if (window.showToast) window.showToast('Please select at least 1 label to create orders.', 'warning');
      return;
    }

    // Step 1: DUPLICATE CHECKING
    const duplicates = [];
    selected.forEach(({ item, index }) => {
      if (window.KPStorage && window.KPStorage.checkDuplicate) {
        const dup = window.KPStorage.checkDuplicate({
          trackingId: item.trackingId,
          mobile: item.contactNumber,
          customerName: item.customerName,
          pincode: item.pincode
        });
        if (dup && dup.duplicate) {
          duplicates.push({ item, index, existing: dup.existing, reason: dup.reason });
        }
      }
    });

    if (duplicates.length > 0) {
      // Show Duplicate Tracking Protection Dialog
      openDuplicateResolutionModal(duplicates, selected);
      return;
    }

    // Step 2: CREATE ORDERS DIRECTLY
    await executeOrderCreation(selected);
  }

  async function executeOrderCreation(selectedEntries, resolutionMap = {}) {
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const { item, index } of selectedEntries) {
      const resolution = resolutionMap[item.trackingId] || 'create';

      if (resolution === 'skip') {
        skippedCount++;
        continue;
      }

      // Format order payload exactly as required
      const orderPayload = {
        orderId: window.KPStorage ? window.KPStorage.generateOrderId() : `KP-${Date.now()}`,
        orderDate: new Date().toISOString().split('T')[0],
        customerName: item.customerName !== 'Not Found' ? item.customerName : 'Customer',
        mobile: item.contactNumber !== 'Not Found' ? item.contactNumber : '',
        address: item.address !== 'Not Found' ? item.address : 'Address as per India Post Label',
        addressType: 'Home',
        city: item.city !== 'Not Found' ? item.city : 'Local',
        state: item.state !== 'Not Found' ? item.state : 'India',
        pincode: item.pincode !== 'Not Found' ? item.pincode : '',
        bookName: item.bookName || 'Gyan Ganga',
        quantity: 1,
        amount: parseFloat(item.amount) || 0,
        codAmount: parseFloat(item.amount) || 0,
        paymentStatus: item.paymentMode === 'COD' ? 'COD' : (item.paymentMode === 'Prepaid' ? 'Paid' : 'Unknown / Not Specified'),
        trackingId: item.trackingId,
        courier: item.courier || 'India Post',
        orderStatus: 'Shipped', // Default Shipped as required by section 23
        whatsappStatus: 'Message Pending',
        remarks: `Imported from India Post Label (${item.fileName || 'Scan'})`
      };

      if (resolution === 'update') {
        // Find existing order by tracking ID and update
        const orders = window.KPStorage.getOrders();
        const existing = orders.find(o => o.trackingId && o.trackingId.toUpperCase() === item.trackingId.toUpperCase());
        if (existing) {
          await window.KPStorage.updateOrder(existing.orderId, orderPayload);
          updatedCount++;
        }
      } else {
        // Save new order with force = true
        await window.KPStorage.saveOrder(orderPayload, true);
        createdCount++;
      }
    }

    // Remove successfully processed candidates from session list
    const indicesToRemove = new Set(selectedEntries.map(e => e.index));
    sessionState.candidates = sessionState.candidates.filter((_, idx) => !indicesToRemove.has(idx));
    sessionState.selectedIndices.clear();

    renderExtractionTable();

    // Trigger full app reload to refresh Order Registry and stats
    if (window.KPApp && window.KPApp.renderOrders) {
      window.KPApp.renderOrders();
      window.KPApp.renderDashboardCounters();
    }

    // Success feedback
    if (window.showToast) {
      window.showToast(`🎉 Success! ${createdCount} new orders created (${updatedCount} updated, ${skippedCount} skipped).`, 'success');
    }

    // Auto-navigate to Order Registry to view newly generated orders!
    if (window.KPApp && window.KPApp.navigateTo) {
      setTimeout(() => {
        window.KPApp.navigateTo('orders');
      }, 900);
    }
  }

  // Duplicate Resolution Modal
  function openDuplicateResolutionModal(duplicates, allSelected) {
    const modal = document.getElementById('modal-duplicate-resolution');
    const container = document.getElementById('dup-resolution-list');
    if (!modal || !container) {
      // Fallback: prompt admin
      if (confirm(`⚠️ Found ${duplicates.length} duplicate tracking ID(s). Click OK to create anyway, or Cancel to review.`)) {
        executeOrderCreation(allSelected);
      }
      return;
    }

    container.innerHTML = duplicates.map(({ item, existing, reason }) => `
      <div class="dup-item-card">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <strong style="color:var(--primary); font-family:var(--font-mono);">${escapeHTML(item.trackingId)}</strong>
          <span class="badge-status-pill badge-duplicate">Duplicate Found</span>
        </div>
        <div style="font-size:0.84rem; margin-bottom:8px;">
          <div><strong>New Label Customer:</strong> ${escapeHTML(item.customerName)} (${escapeHTML(item.contactNumber)})</div>
          <div style="color:var(--text-muted);"><strong>Existing Order:</strong> ${escapeHTML(existing.orderId)} - ${escapeHTML(existing.customerName)} (${escapeHTML(existing.orderStatus)})</div>
        </div>
        <div class="dup-resolution-options">
          <label><input type="radio" name="dup_res_${item.trackingId}" value="skip"> Skip</label>
          <label><input type="radio" name="dup_res_${item.trackingId}" value="update"> Update Existing Order</label>
          <label><input type="radio" name="dup_res_${item.trackingId}" value="create" checked> Create Anyway</label>
        </div>
      </div>
    `).join('');

    modal.classList.add('modal-open');

    const btnConfirm = document.getElementById('btn-confirm-dup-resolution');
    if (btnConfirm) {
      btnConfirm.onclick = () => {
        const resolutionMap = {};
        duplicates.forEach(({ item }) => {
          const selectedRadio = document.querySelector(`input[name="dup_res_${item.trackingId}"]:checked`);
          resolutionMap[item.trackingId] = selectedRadio ? selectedRadio.value : 'create';
        });
        modal.classList.remove('modal-open');
        executeOrderCreation(allSelected, resolutionMap);
      };
    }
  }

  // =========================================================================
  // 11. BATCH CONTROLS (Set All Books, Set All Amounts, Filters)
  // =========================================================================
  function applyBatchBookToSelected(bookName) {
    if (!bookName) return;
    sessionState.selectedIndices.forEach(idx => {
      if (sessionState.candidates[idx]) {
        sessionState.candidates[idx].bookName = bookName;
      }
    });
    renderExtractionTable();
    if (window.showToast) window.showToast(`Applied "${bookName}" to selected labels.`, 'info');
  }

  function applyBatchAmountToSelected(amt) {
    const parsedAmt = parseFloat(amt) || 0;
    sessionState.selectedIndices.forEach(idx => {
      if (sessionState.candidates[idx]) {
        sessionState.candidates[idx].amount = parsedAmt;
        if (parsedAmt > 0) sessionState.candidates[idx].paymentMode = 'COD';
      }
    });
    renderExtractionTable();
    if (window.showToast) window.showToast(`Applied ₹${parsedAmt} to selected labels.`, 'info');
  }

  function toggleSelectAll(checked) {
    if (checked) {
      sessionState.candidates.forEach((_, idx) => sessionState.selectedIndices.add(idx));
    } else {
      sessionState.selectedIndices.clear();
    }
    renderExtractionTable();
  }

  function toggleSelect(index, checked) {
    if (checked) {
      sessionState.selectedIndices.add(index);
    } else {
      sessionState.selectedIndices.delete(index);
    }
    renderExtractionTable();
  }

  function setTableFilter(filter) {
    sessionState.activeFilter = filter;
    document.querySelectorAll('.btn-extract-filter').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
    });
    renderExtractionTable();
  }

  function deleteCandidate(index) {
    sessionState.candidates.splice(index, 1);
    sessionState.selectedIndices.delete(index);
    renderExtractionTable();
  }

  function clearAllCandidates() {
    if (sessionState.candidates.length === 0) return;
    if (confirm('Are you sure you want to clear all extracted labels in this session?')) {
      sessionState.candidates = [];
      sessionState.selectedIndices.clear();
      renderExtractionTable();
    }
  }

  // Helpers
  function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }
  function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? val : '';
  }
  function setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt || '';
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

  // =========================================================================
  // PUBLIC API EXPORT
  // =========================================================================
  window.KPIndiaPostImporter = {
    parseIndiaPostLabel,
    processUploadedFiles,
    loadSampleTestLabel,
    renderExtractionTable,
    openSideBySideModal,
    saveCurrentSideBySideChanges,
    navigateSideBySide,
    adjustSideBySideZoom,
    rotateSideBySide,
    closeSideBySideModal,
    createOrdersFromVerifiedLabels,
    applyBatchBookToSelected,
    applyBatchAmountToSelected,
    toggleSelectAll,
    toggleSelect,
    setTableFilter,
    deleteCandidate,
    clearAllCandidates,
    getSessionState: () => sessionState
  };

  // Compatibility bridge with existing KPPdfImporter
  window.KPPdfImporter = Object.assign({}, window.KPPdfImporter || {}, {
    parseShippingLabelText: (text, lines, ctx) => parseIndiaPostLabel(text, null, ctx),
    extractCandidatesFromPDFs: async (files, onProg) => {
      return processUploadedFiles(files, onProg);
    }
  });

})(window);
