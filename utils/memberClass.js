const MEMBER_CLASS_LABELS = {
  kjs: 'กลุ่มจัดตั้งฯ',
  kps: 'กลุ่มส่งเสริมและพัฒนาธุรกิจ',
  kbs: 'กลุ่ม กบส',
  kts: 'กลุ่ม กตส',
  pbt: 'ฝ่ายบริหารทั่วไป'
};

function resolveMemberClassLabel(memberClass) {
  const normalized = String(memberClass || '').trim();
  if (!normalized) {
    return '';
  }

  if (MEMBER_CLASS_LABELS[normalized]) {
    return MEMBER_CLASS_LABELS[normalized];
  }

  const groupMatch = normalized.match(/^group(\d+)$/i);
  if (groupMatch) {
    return `กลุ่มส่งเสริมสหกรณ์ ${groupMatch[1]}`;
  }

  return normalized;
}

module.exports = {
  resolveMemberClassLabel
};
