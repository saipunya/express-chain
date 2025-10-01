// Thai Baht text conversion helper
// Usage: const bahtText = require('./utils/bahtText'); bahtText(1234.56)
// Reference formatting: https://en.wikipedia.org/wiki/Thai_numerals (implementation simplified)

function bahtText(input) {
  if (input === null || input === undefined || input === '') return '-';
  // Normalize number
  let num = typeof input === 'number' ? input : Number(String(input).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return '-';
  if (num === 0) return 'ศูนย์บาทถ้วน';

  const numberText = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const positionText = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  function readSection(section) {
    let text = '';
    const digits = section.split('').map(d => parseInt(d, 10));
    for (let i = 0; i < digits.length; i++) {
      const digit = digits[i];
      const pos = digits.length - i - 1; // position index
      if (digit === 0) continue;

      if (pos === 0) { // หน่วย
        if (digit === 1 && digits.length > 1) {
          text += 'เอ็ด';
        } else {
          text += numberText[digit];
        }
      } else if (pos === 1) { // สิบ
        if (digit === 1) {
          text += 'สิบ';
        } else if (digit === 2) {
          text += 'ยี่สิบ';
        } else {
          text += numberText[digit] + 'สิบ';
        }
      } else { // ร้อย พัน หมื่น แสน
        text += numberText[digit] + positionText[pos];
      }
    }
    return text;
  }

  const parts = num.toFixed(2).split('.');
  let integerPart = parts[0];
  const satangPart = parts[1];

  let bahtTextStr = '';

  // Handle millions grouping
  let millionGroups = [];
  while (integerPart.length > 0) {
    millionGroups.unshift(integerPart.slice(-6));
    integerPart = integerPart.slice(0, -6);
  }
  // Actually Thai grouping groups by ล้าน every 6? Real grouping is 6 digits? It's every 6 then add 'ล้าน'. We'll implement by recursive splitting by 6.
  // Adjust: We'll join reading each group with 'ล้าน' between when necessary.
  bahtTextStr = millionGroups.map(group => {
    return readSection(String(parseInt(group, 10))); // remove leading zeros
  }).join('ล้าน');

  if (!bahtTextStr) bahtTextStr = 'ศูนย์';
  bahtTextStr += 'บาท';

  let satangText = '';
  if (satangPart === '00') {
    satangText = 'ถ้วน';
  } else {
    satangText = readSection(String(parseInt(satangPart, 10)));
    if (satangText) satangText += 'สตางค์';
  }
  return bahtTextStr + satangText;
}

module.exports = bahtText;
