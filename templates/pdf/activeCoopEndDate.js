module.exports = function buildDocDefinition(groups, opts = {}) {
  const { pageBreakByYear = true, landscape = false, title = 'สรุปสหกรณ์ / กลุ่มเกษตรกร แยกตามปีสิ้นสุด (end_date)' } = opts;
  const printedAt = new Date().toLocaleString('th-TH');

  const displayGroupName = (code) => {
    switch (code) {
      case 'group1': return 'กลุ่มส่งเสริมสหกรณ์ 1';
      case 'group2': return 'กลุ่มส่งเสริมสหกรณ์ 2';
      case 'group3': return 'กลุ่มส่งเสริมสหกรณ์ 3';
      case 'group4': return 'กลุ่มส่งเสริมสหกรณ์ 4';
      case 'group5': return 'กลุ่มส่งเสริมสหกรณ์ 5';
      default: return code || '-';
    }
  };

  const statusBadge = (status) => {
    const colorMap = {
      'ดำเนินการ': '#0d6efd',
      'ปิดกิจการ': '#dc3545',
      'ยกเลิก': '#6c757d'
    };
    const fill = colorMap[status] || '#6c757d';
    return { text: status || '-', color: '#fff', fillColor: fill, alignment: 'center', margin: [0, 2, 0, 2] };
  };

  const years = Object.keys(groups || {}).sort((a, b) => b - a);
  const coopByYear = {};
  const farmerByYear = {};
  years.forEach((y) => {
    (groups[y] || []).forEach((r) => {
      if (r.coop_group === 'สหกรณ์') (coopByYear[y] ||= []).push(r);
      else if (r.coop_group === 'กลุ่มเกษตรกร') (farmerByYear[y] ||= []).push(r);
    });
  });

  const makeYearTable = (year, list, isFirstOfSection = false) => ({
    pageBreak: pageBreakByYear && !isFirstOfSection ? 'before' : undefined,
    margin: [0, 8, 0, 6],
    stack: [
      { text: `ปี ${year} (ทั้งหมด ${list.length} แห่ง)`, style: 'yearHeader', margin: [0, 2, 0, 6] },
      {
        table: {
          headerRows: 1,
          widths: [24, 56, '*', 130, 64, 66],
          body: [
            [
              { text: '#', style: 'tableHeader' },
              { text: 'รหัส', style: 'tableHeader' },
              { text: 'ชื่อ', style: 'tableHeader' },
              { text: 'กลุ่ม (c_group)', style: 'tableHeader' },
              { text: 'สถานะ', style: 'tableHeader', alignment: 'center' },
              { text: 'End Date', style: 'tableHeader', alignment: 'right' },
            ],
            ...list.map((row, idx) => ([
              { text: String(idx + 1) },
              { text: row.c_code || '-' },
              { text: row.coop_group === 'สหกรณ์' ? `${row.c_name} จำกัด` : (row.c_name || '-') },
              { text: displayGroupName(row.c_group) },
              {text: row.c_status},
              { text: row.end_date || '-', alignment: 'right' },
            ])),
          ],
        },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? '#f1f3f5' : rowIndex % 2 === 0 ? '#fafafa' : null),
          hLineColor: () => '#dee2e6',
          vLineColor: () => '#dee2e6',
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
          vLineWidth: () => 0.5,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        fontSize: 14,
      },
    ],
  });

  const content = [
    { text: title, style: 'title', margin: [0, 0, 0, 6] },
    { text: `พิมพ์เมื่อ: ${printedAt}`, style: 'meta', margin: [0, 0, 0, 8] },

    { text: 'ส่วนที่ 1: สหกรณ์', style: 'section' },
    ...Object.keys(coopByYear).sort((a, b) => b - a).flatMap((y, i) => {
      const list = coopByYear[y] || [];
      if (!list.length) return [];
      return [makeYearTable(y, list, i === 0)];
    }),

    { text: 'ส่วนที่ 2: กลุ่มเกษตรกร', style: 'section', pageBreak: 'before' },
    ...Object.keys(farmerByYear).sort((a, b) => b - a).flatMap((y, i) => {
      const list = farmerByYear[y] || [];
      if (!list.length) return [];
      return [makeYearTable(y, list, i === 0)];
    }),
  ];

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [36, 72, 36, 54],
    header: (currentPage, pageCount) => ({
      margin: [36, 20, 36, 0],
      columns: [
        { text: 'รายงานสรุปสหกรณ์/กลุ่มเกษตรกร', style: 'headerTitle', width: '*' },
        { text: `หน้า ${currentPage} / ${pageCount}`, alignment: 'right', style: 'headerMeta', width: 'auto' },
      ],
    }),
    footer: () => ({
      margin: [36, 0, 36, 20],
      columns: [
        { text: 'แหล่งข้อมูล: CoopChain', style: 'footerMeta', width: '*' },
        { text: `ออกรายงาน: ${printedAt}`, alignment: 'right', style: 'footerMeta', width: 'auto' },
      ],
    }),
    defaultStyle: { font: 'THSarabun', fontSize: 14 },
    styles: {
      title: { fontSize: 16, bold: true, alignment: 'center' },
      section: { fontSize: 14, bold: true, margin: [0, 10, 0, 4] },
      yearHeader: { fontSize: 12, bold: true },
      tableHeader: { bold: true },
      meta: { fontSize: 12, color: '#555' },
      headerTitle: { bold: true },
      headerMeta: { fontSize: 12, color: '#555' },
      footerMeta: { fontSize: 12, color: '#555' },
    },
    content,
  };
};