function buildInstitutionDistrictSummary(counts = []) {
  const rows = counts.map((item) => {
    const district = String(item.district || '').trim();
    const cooperatives = Number(item.cooperatives) || 0;
    const farmerGroups = Number(item.farmerGroups) || 0;
    return {
      district: district || 'ไม่ระบุอำเภอ',
      isUnknown: !district,
      cooperatives,
      farmerGroups,
      total: cooperatives + farmerGroups
    };
  }).sort((a, b) => Number(a.isUnknown) - Number(b.isUnknown) || a.district.localeCompare(b.district, 'th'));

  const totals = rows.reduce((summary, item) => ({
    cooperatives: summary.cooperatives + item.cooperatives,
    farmerGroups: summary.farmerGroups + item.farmerGroups,
    total: summary.total + item.total
  }), { cooperatives: 0, farmerGroups: 0, total: 0 });

  return {
    rows,
    totals,
    unknownTotal: rows.filter((item) => item.isUnknown).reduce((sum, item) => sum + item.total, 0)
  };
}

module.exports = { buildInstitutionDistrictSummary };
