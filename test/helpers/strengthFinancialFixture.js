function financialAnswers(overrides = {}) {
  return {
    dimension2Mode: 'financial', financialSubtype: 'agriculture', assets: '1000000', assetsPrevious: '1000000', liabilities: '200000', equity: '800000', reserve: '300000', operatingProfit: '100000', operatingExpenses: '20000', profitBeforeExpenses: '120000', currentAssets: '500000', currentLiabilities: '100000', repaymentMode: 'standard', lendingVolume: '100000', loansDue: '100000', loansPaid: '100000', financialEvidence: 'งบปีปัจจุบัน ปีก่อน และทะเบียนลูกหนี้ปี 2569', ...overrides
  };
}
module.exports = { financialAnswers };
