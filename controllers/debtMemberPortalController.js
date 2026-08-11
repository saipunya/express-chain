'use strict';

const repository = require('../repositories/debtMemberPortalRepository');

function locals(req, extra = {}) {
  return {
    debtMember: req.session.debtMember,
    debtMoney: (value) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    debtNumber: (value) => Number(value || 0).toLocaleString('th-TH'),
    debtDate: (value) => value ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '-',
    debtRiskThai: (risk) => ({ RED: 'เร่งด่วน', ORANGE: 'ต้องติดตาม', YELLOW: 'เฝ้าระวัง', GREEN: 'ปกติ' }[risk] || risk || '-'),
    ...extra
  };
}

exports.overview = async (req, res) => {
  const detail = await repository.getMemberOverview(req.session.debtMember.memberId);
  if (!detail) return res.status(404).render('debt/auth-error', { title: 'ไม่พบข้อมูลสมาชิก', message: 'กรุณาติดต่อสหกรณ์ของท่าน' });
  res.render('debt/member-portal-overview', locals(req, { title: 'ข้อมูลหนี้ของฉัน', ...detail }));
};

exports.loan = async (req, res) => {
  const detail = await repository.getLoanForMember(req.params.loanId, req.session.debtMember.memberId);
  if (!detail) return res.status(404).render('debt/member-portal-error', locals(req, { title: 'ไม่พบสัญญา', message: 'ไม่พบสัญญานี้ในบัญชีสมาชิกของคุณ' }));
  res.render('debt/member-portal-loan', locals(req, { title: `สัญญา ${detail.loan.loan_no}`, ...detail }));
};
