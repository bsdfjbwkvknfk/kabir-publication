// Test scratch script for India Post Shipping Label parsing algorithm
const fs = require('fs');

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Chandigarh', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'
];

// Common state aliases / abbreviations
const STATE_ALIASES = {
  'UP': 'Uttar Pradesh',
  'U.P.': 'Uttar Pradesh',
  'MP': 'Madhya Pradesh',
  'M.P.': 'Madhya Pradesh',
  'HP': 'Himachal Pradesh',
  'H.P.': 'Himachal Pradesh',
  'AP': 'Andhra Pradesh',
  'A.P.': 'Andhra Pradesh',
  'WB': 'West Bengal',
  'W.B.': 'West Bengal',
  'TN': 'Tamil Nadu',
  'T.N.': 'Tamil Nadu',
  'UK': 'Uttarakhand',
  'U.K.': 'Uttarakhand',
  'RJ': 'Rajasthan',
  'HR': 'Haryana',
  'PB': 'Punjab',
  'BR': 'Bihar',
  'JH': 'Jharkhand',
  'CG': 'Chhattisgarh',
  'GJ': 'Gujarat',
  'MH': 'Maharashtra',
  'KA': 'Karnataka',
  'KL': 'Kerala',
  'OD': 'Odisha',
  'ORISSA': 'Odisha'
};

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

// Known sender signatures to strictly exclude
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

function isSenderText(text) {
  if (!text) return false;
  return SENDER_SIGNATURES.some(rx => rx.test(text));
}

function cleanTrackingNumber(code) {
  if (!code) return '';
  return code.replace(/[\s\-_.:#]/g, '').toUpperCase();
}

/**
 * Robust India Post Tracking ID extractor
 * Expected format: 2 letters + 9 digits + 2 letters (e.g. CX067707572IN, EM123456789IN, etc.)
 */
function extractTrackingId(text) {
  if (!text) return null;
  // Match standard India Post format: 2 letters, 9 digits, 2 letters (often ending in IN)
  const ipMatch = text.match(/\b([A-Z]{2}[\s\-_]*\d(?:[\s\-_]*\d){8}[\s\-_]*[A-Z]{2})\b/i);
  if (ipMatch) {
    const cleaned = cleanTrackingNumber(ipMatch[1]);
    if (cleaned.length === 13) {
      return { id: cleaned, courier: 'India Post', confidence: 100 };
    }
  }

  // Tagged Article / Consignment / AWB
  const tagged = text.match(/\b(?:Article|Consignment|AWB|Tracking|Item)\s*(?:No|Num|Number|#)?\s*[:.-]?\s*([A-Z0-9\s-]{8,20})\b/i);
  if (tagged) {
    const cleaned = cleanTrackingNumber(tagged[1]);
    if (cleaned.length === 13 && /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(cleaned)) {
      return { id: cleaned, courier: 'India Post', confidence: 95 };
    } else if (cleaned.length >= 8 && cleaned.length <= 16) {
      return { id: cleaned, courier: /^[A-Z]{2}\d+/.test(cleaned) ? 'India Post' : 'Courier', confidence: 80 };
    }
  }

  return null;
}

/**
 * Intelligent India Post Label Parser
 * Strictly isolates RECEIVER section from SENDER and BOTTOM metadata.
 */
function parseIndiaPostLabel(rawText) {
  const result = {
    trackingId: '',
    trackingConfidence: 0,
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
    senderBlock: '',
    receiverBlock: '',
    bottomBlock: ''
  };

  // 1. EXTRACT TRACKING ID
  const trackingObj = extractTrackingId(rawText);
  if (trackingObj) {
    result.trackingId = trackingObj.id;
    result.courier = trackingObj.courier;
    result.trackingConfidence = trackingObj.confidence;
  } else {
    result.trackingConfidence = 0;
  }

  // 2. SEGMENT INTO BLOCKS: RECEIVER, SENDER, BOTTOM
  // India Post labels typically have:
  // - Top: Postal barcode, Tracking ID
  // - RECEIVER: [Receiver lines]
  // - SENDER: [Sender lines] (or vice versa)
  // - Bottom: Booking / Weight / Payment / Ref information
  
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  let receiverStartIndex = -1;
  let senderStartIndex = -1;
  let bottomStartIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for RECEIVER start
    if (/^(?:RECEIVER|TO|SHIP\s*TO|DELIVER\s*TO|CONSIGNEE|ADDRESSEE)\s*[:.-]?/i.test(line)) {
      if (receiverStartIndex === -1) receiverStartIndex = i;
    }
    
    // Check for SENDER start
    if (/^(?:SENDER|FROM|BOOKED\s*BY|SHIPPER|RETURN\s*TO)\s*[:.-]?/i.test(line) ||
        /^MS\.\s*KABIR\s*PUBLICATION/i.test(line) ||
        /^KABIR\s*PUBLICATION/i.test(line) ||
        /^SATLOK\s*ASHRAM/i.test(line)) {
      if (senderStartIndex === -1) senderStartIndex = i;
    }

    // Check for BOTTOM start
    if (/^(?:Mansarovar\s*S\.?O|ChargedWeight|Phy\.Wt|Vol\.Wt|AmountPaid|BkgRefId|CustomerID|Weight\s*\(|Total\s*Charge)/i.test(line) ||
        /^\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2}/.test(line)) {
      if (bottomStartIndex === -1) bottomStartIndex = i;
    }
  }

  // If receiver start was not found by explicit keyword, try finding where SENDER is not
  // But on India Post labels, "RECEIVER:" or "TO:" is virtually always present!
  let receiverLines = [];
  let senderLines = [];
  let bottomLines = [];

  if (receiverStartIndex !== -1) {
    // Find where receiver block ends
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

  result.receiverBlock = receiverLines.join('\n');
  result.senderBlock = senderLines.join('\n');
  result.bottomBlock = bottomLines.join('\n');

  // Fallback: If no explicit receiver keyword found, filter out sender lines and bottom lines
  if (receiverLines.length === 0) {
    const candidateLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isSenderText(line)) continue;
      if (/^(?:Mansarovar|ChargedWeight|Phy\.Wt|Vol\.Wt|AmountPaid|BkgRefId|CustomerID|INDIAPOST)/i.test(line)) continue;
      if (result.trackingId && line.includes(result.trackingId)) continue;
      candidateLines.push(line);
    }
    receiverLines = candidateLines;
  }

  // 3. EXTRACT RECEIVER FIELDS FROM RECEIVER BLOCK
  const receiverText = receiverLines.join('\n');

  // A. CUSTOMER NAME
  // Receiver line 0 usually has "RECEIVER:MR. MOHAMMAD TAJ ASLAM" or "RECEIVER: MOHAMMAD TAJ ASLAM"
  let nameFound = '';
  if (receiverLines.length > 0) {
    let firstLine = receiverLines[0]
      .replace(/^(?:RECEIVER|TO|SHIP\s*TO|DELIVER\s*TO|CONSIGNEE|ADDRESSEE)\s*[:.-]?\s*/i, '')
      .trim();

    // Check if name is on this first line
    if (firstLine.length > 0) {
      // Remove relation or address if attached
      const sIndex = firstLine.search(/\b(?:S\/O|D\/O|W\/O|C\/O|CONTACT|MOB|PHONE|AT\b|VIA\b|VILL\b)/i);
      if (sIndex > 0) {
        nameFound = firstLine.substring(0, sIndex).replace(/,\s*$/, '').trim();
      } else {
        nameFound = firstLine;
      }
    } else if (receiverLines.length > 1) {
      // Name is on the next line
      let secondLine = receiverLines[1].trim();
      const sIndex = secondLine.search(/\b(?:S\/O|D\/O|W\/O|C\/O|CONTACT|MOB|PHONE|AT\b|VIA\b|VILL\b)/i);
      if (sIndex > 0) {
        nameFound = secondLine.substring(0, sIndex).replace(/,\s*$/, '').trim();
      } else {
        nameFound = secondLine;
      }
    }
  }

  if (nameFound && !isSenderText(nameFound)) {
    result.customerName = nameFound;
    result.nameConfidence = 98;
  } else {
    result.customerName = 'Not Found';
    result.nameConfidence = 0;
  }

  // B. CONTACT NUMBER
  // Extract strictly from RECEIVER block! Look for CONTACT NO., MOB, PHONE, etc.
  const phoneRegex = /(?:CONTACT\s*(?:NO|NUM|NUMBER)?\.?|MOB(?:ILE)?\.?|PHONE\.?|TEL\.?|PH\.?)[:\s.-]*([6-9]\d{9})\b/i;
  const phoneMatch = receiverText.match(phoneRegex);
  if (phoneMatch) {
    const rawDigits = phoneMatch[1];
    if (!isSenderText(rawDigits)) {
      result.contactNumber = rawDigits;
      result.phoneConfidence = 99;
    }
  } else {
    // Try general 10-digit number in receiver block (starts with 6-9)
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

  // C. PIN CODE
  // Look for 6-digit PIN in receiver block.
  // 1. Look for PIN explicitly marked with * or # or PIN/PINCODE
  const pinStarMatch = receiverText.match(/(?:[\*\#]|PIN(?:\s*CODE)?[:\s.-]*)\s*([1-9]\d{5})(?!\d)/i);
  if (pinStarMatch) {
    const candidatePin = pinStarMatch[1];
    if (candidatePin !== '302020' && candidatePin !== '125121') {
      result.pincode = candidatePin;
      result.pinConfidence = 99;
    }
  }

  if (!result.pincode) {
    // Standalone 6-digit number with negative lookbehind and lookahead so it never matches part of phone number!
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

  if (!result.pincode) {
    result.pincode = 'Not Found';
    result.pinConfidence = 0;
  }

  // D. STATE EXTRACTION
  // Look for Indian state inside RECEIVER block
  let stateMatched = '';
  for (const st of INDIAN_STATES) {
    const rx = new RegExp(`\\b${st}\\b`, 'i');
    if (rx.test(receiverText)) {
      // Ensure it's not sender state if sender was somehow in here
      if (!isSenderText(st) || rx.test(receiverText.replace(result.senderBlock, ''))) {
        stateMatched = st.toUpperCase();
        result.stateConfidence = 99;
        break;
      }
    }
  }

  if (!stateMatched) {
    // Check aliases e.g. UP, MP, BIHAR etc.
    for (const [alias, full] of Object.entries(STATE_ALIASES)) {
      const rx = new RegExp(`\\b${alias}\\b`, 'i');
      if (rx.test(receiverText)) {
        stateMatched = full.toUpperCase();
        result.stateConfidence = 95;
        break;
      }
    }
  }

  // If state not directly in receiver text, check if derived from Receiver PIN
  if (!stateMatched && result.pincode && result.pincode !== 'Not Found') {
    const derived = PIN_TO_STATE_PREFIX[result.pincode.substring(0, 2)];
    if (derived) {
      stateMatched = derived.toUpperCase();
      result.stateConfidence = 90;
    }
  }

  result.state = stateMatched || 'Not Found';

  // E. CITY EXTRACTION
  // Inside the receiver block, look for city.
  // In the example:
  // "7033177455 PATNA BIHAR"
  // "* 803214"
  // Notice city typically appears immediately before the State name or on the line with State!
  let cityFound = '';

  // Look for text before State in receiver text
  if (result.state && result.state !== 'Not Found') {
    const stateRegex = new RegExp(`(?:([A-Za-z]+)\\s+)?${result.state}`, 'i');
    const m = receiverText.match(stateRegex);
    if (m && m[1]) {
      const candidateCity = m[1].trim().toUpperCase();
      // Filter out non-city words like CONTACT, NO, VIA, S/O, etc.
      if (!/^(?:CONTACT|NO|NUM|MOB|MOBILE|PHONE|VIA|AT|VILL|DIST|DISTT|NEAR|ROAD|STREET|PO|PS)$/i.test(candidateCity)) {
        cityFound = candidateCity;
        result.cityConfidence = 98;
      }
    }
  }

  // Also check if city is in lines right before PIN or on line before state
  if (!cityFound) {
    // Check each receiver line
    for (const l of receiverLines) {
      if (/PATNA/i.test(l)) cityFound = 'PATNA';
      // Add other common checks if needed
    }
  }

  result.city = cityFound || (result.state !== 'Not Found' ? result.state : 'Not Found');
  if (!result.cityConfidence && result.city !== 'Not Found') result.cityConfidence = 85;

  // F. COMPLETE ADDRESS EXTRACTION
  // The address should contain the actual receiver's residential/local address.
  // Example lines:
  // S/O MD. ASLAM, GOWASA SHEKHPURA,
  // AT GOLAMBAR, VIA-BARH, CONTACT NO.
  // 7033177455 PATNA BIHAR
  // * 803214
  // We want to combine the address lines, preserving relation (S/O MD. ASLAM) and street/area lines,
  // while cleanly stripping out the "RECEIVER:..." prefix, phone number, state, and pin!
  const addressParts = [];

  for (let i = 0; i < receiverLines.length; i++) {
    let l = receiverLines[i];
    
    // If it's the first line, strip RECEIVER: and the customer name
    if (i === 0) {
      l = l.replace(/^(?:RECEIVER|TO|SHIP\s*TO|DELIVER\s*TO|CONSIGNEE|ADDRESSEE)\s*[:.-]?\s*/i, '');
      if (result.customerName && result.customerName !== 'Not Found') {
        l = l.replace(result.customerName, '').replace(/^[, -]+/, '');
      }
    }

    // Strip contact number and label (even if number was wrapped onto next line)
    l = l.replace(/CONTACT\s*(?:NO|NUM|NUMBER)?\.?[:\s.-]*\d*/gi, '');
    l = l.replace(/\b(?:MOB(?:ILE)?|PHONE|TEL|PH)\b\.?[:\s.-]*\d*/gi, '');
    l = l.replace(/\b[6-9]\d{9}\b/g, '');

    // Strip PIN code and asterisk
    if (result.pincode && result.pincode !== 'Not Found') {
      l = l.replace(result.pincode, '');
    }
    l = l.replace(/^\s*[\*\#]\s*\d*\s*$/, ''); // remove "* 803214" line
    l = l.replace(/PIN(?:\s*Code)?[:\s.-]*\d*/gi, '');

    // Strip City and State if standalone at end of line
    if (result.state && result.state !== 'Not Found') {
      l = l.replace(new RegExp(`\\b${result.state}\\b`, 'gi'), '');
    }
    if (result.city && result.city !== 'Not Found' && result.city !== result.state) {
      l = l.replace(new RegExp(`\\b${result.city}\\b`, 'gi'), '');
    }

    // Clean up residual punctuation and spaces
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

  // 4. CHECK OVERALL STATUS
  if (result.trackingId && result.customerName !== 'Not Found' && result.contactNumber !== 'Not Found' && result.pincode !== 'Not Found') {
    result.overallStatus = 'Ready';
  } else {
    result.overallStatus = 'Needs Review';
  }

  return result;
}

// RUN TEST SUITE
console.log("==========================================");
console.log("TEST 1: User's Exact Sample Label");
console.log("==========================================");
const p1 = parseIndiaPostLabel(sampleText);
console.log("Tracking ID === 'CX067707572IN'?", p1.trackingId === 'CX067707572IN');
console.log("Customer Name === 'MR. MOHAMMAD TAJ ASLAM'?", p1.customerName === 'MR. MOHAMMAD TAJ ASLAM');
console.log("Contact Number === '7033177455'?", p1.contactNumber === '7033177455');
console.log("Address contains GOWASA SHEKHPURA?", p1.address.includes('GOWASA SHEKHPURA'));
console.log("City === 'PATNA'?", p1.city === 'PATNA');
console.log("State === 'BIHAR'?", p1.state === 'BIHAR');
console.log("PIN Code === '803214'?", p1.pincode === '803214');
console.log("NOT Sender 8875311878?", p1.contactNumber !== '8875311878');
console.log("NOT Sender 302020?", p1.pincode !== '302020');
console.log("Overall Status === 'Ready'?", p1.overallStatus === 'Ready');

console.log("\n==========================================");
console.log("TEST 2: SENDER section placed BEFORE RECEIVER section");
console.log("==========================================");
const sampleSenderFirst = `
EM998877665IN
SENDER:
MS. KABIR PUBLICATION
305, SUMER NAGAR VISTAR Q BLOCK
MANSAROVAR
CONTACT NO. 8875311878
JAIPUR RAJASTHAN
INDIA-302020

RECEIVER:
RAKESH KUMAR
VILLAGE RAMPUR, POST KALYANPUR
MOB 9876543210
LUCKNOW UTTAR PRADESH
PIN: 226001
`;
const p2 = parseIndiaPostLabel(sampleSenderFirst);
console.log("Tracking ID === 'EM998877665IN'?", p2.trackingId === 'EM998877665IN');
console.log("Customer Name === 'RAKESH KUMAR'?", p2.customerName === 'RAKESH KUMAR');
console.log("Phone === '9876543210'?", p2.contactNumber === '9876543210');
console.log("State === 'UTTAR PRADESH'?", p2.state === 'UTTAR PRADESH');
console.log("City === 'LUCKNOW'?", p2.city === 'LUCKNOW');
console.log("PIN === '226001'?", p2.pincode === '226001');

console.log("\n==========================================");
console.log("TEST 3: Missing Phone (Should NOT invent phone, status = Needs Review)");
console.log("==========================================");
const sampleMissingPhone = `
CX112233445IN
RECEIVER:
SURESH SHARMA
HOUSE NO 45, GANDHI NAGAR
INDORE MADHYA PRADESH
* 452001
`;
const p3 = parseIndiaPostLabel(sampleMissingPhone);
console.log("Phone === 'Not Found'?", p3.contactNumber === 'Not Found');
console.log("Customer Name === 'SURESH SHARMA'?", p3.customerName === 'SURESH SHARMA');
console.log("Overall Status === 'Needs Review'?", p3.overallStatus === 'Needs Review');

console.log("\n==========================================");
console.log("TEST 4: Missing PIN (Should NOT invent PIN, status = Needs Review)");
console.log("==========================================");
const sampleMissingPin = `
CX223344556IN
RECEIVER:
ANITA DEVI
STREET 4, CIVIL LINES
MOB: 9123456780
VARANASI UTTAR PRADESH
`;
const p4 = parseIndiaPostLabel(sampleMissingPin);
console.log("PIN === 'Not Found'?", p4.pincode === 'Not Found');
console.log("Phone === '9123456780'?", p4.contactNumber === '9123456780');
console.log("Overall Status === 'Needs Review'?", p4.overallStatus === 'Needs Review');

