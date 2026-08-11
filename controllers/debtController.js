'use strict';

const repository = require('../repositories/debtRepository');
const debtService = require('../services/debtService');

function viewData(req, extra = {}) {
  return { basePath: '/debt', currentPath: req.path, query: req.query || {}, ...extra };
}

exports.index = (req, res) => res.redirect('/debt/dashboard');

exports.dashboard = async (req, res) => {
  const [summary, tasks] = await Promise.all([
    repository.getProvinceSummary(req.debtAccess),
    repository.listUrgentTasks(req.debtAccess, 10)
  ]);
  res.render('debt/dashboard', viewData(req, { title: 'ภาพรวมการติดตามหนี้', summary, tasks }));
};

exports.cdfDashboard = async (req, res) => {
  const [cooperatives, allContracts, contracts] = await Promise.all([
    repository.listCdfCooperatives(req.debtAccess),
    repository.listCdfContracts(req.debtAccess),
    repository.listCdfContracts(req.debtAccess, { risk: req.query.risk })
  ]);
  res.render('debt/cdf-dashboard', viewData(req, { title: 'ติดตามหนี้ กพส.', cooperatives, allContracts, contracts }));
};

exports.cdfCooperative = async (req, res) => {
  const [cooperative, contracts] = await Promise.all([
    repository.getCooperative(req.params.coopId),
    repository.listCdfContracts(req.debtAccess, { coopId: req.params.coopId, risk: req.query.risk })
  ]);
  if (!cooperative) return res.status(404).render('debt/error', viewData(req, { status: 404, message: 'ไม่พบสหกรณ์' }));
  res.render('debt/cdf-cooperative', viewData(req, { title: cooperative.c_name, cooperative, contracts }));
};

exports.cdfContract = async (req, res) => {
  const detail = await repository.getCdfContract(req.params.contractId, req.debtAccess);
  if (!detail) return res.status(404).render('debt/error', viewData(req, { status: 404, message: 'ไม่พบสัญญา หรือไม่มีสิทธิ์เข้าถึง' }));
  res.render('debt/cdf-contract', viewData(req, { title: `สัญญา ${detail.contract.contract_no}`, ...detail }));
};

exports.addCdfFollowup = async (req, res) => {
  await debtService.addCdfFollowup(req.params.contractId, req.body, req.debtAccess);
  res.redirect(`/debt/cdf/contracts/${encodeURIComponent(req.params.contractId)}?saved=1`);
};

exports.memberDashboard = async (req, res) => {
  const [cooperatives, allLoans, loans] = await Promise.all([
    repository.listMemberDebtCooperatives(req.debtAccess),
    repository.listMemberDebt(req.debtAccess),
    repository.listMemberDebt(req.debtAccess, { risk: req.query.risk, q: req.query.q })
  ]);
  res.render('debt/member-dashboard', viewData(req, { title: 'ติดตามหนี้สมาชิก', cooperatives, allLoans, loans }));
};

exports.memberCooperative = async (req, res) => {
  const [cooperative, loans] = await Promise.all([
    repository.getCooperative(req.params.coopId),
    repository.listMemberDebt(req.debtAccess, { coopId: req.params.coopId, risk: req.query.risk, q: req.query.q })
  ]);
  if (!cooperative) return res.status(404).render('debt/error', viewData(req, { status: 404, message: 'ไม่พบสหกรณ์' }));
  res.render('debt/member-cooperative', viewData(req, { title: cooperative.c_name, cooperative, loans }));
};

exports.memberDetail = async (req, res) => {
  const detail = await repository.getMember(req.params.memberId, req.debtAccess);
  if (!detail) return res.status(404).render('debt/error', viewData(req, { status: 404, message: 'ไม่พบสมาชิก หรือไม่มีสิทธิ์เข้าถึง' }));
  res.render('debt/member-detail', viewData(req, { title: detail.member.display_name, ...detail }));
};

exports.loanDetail = async (req, res) => {
  const detail = await repository.getLoan(req.params.loanId, req.debtAccess);
  if (!detail) return res.status(404).render('debt/error', viewData(req, { status: 404, message: 'ไม่พบสัญญา หรือไม่มีสิทธิ์เข้าถึง' }));
  res.render('debt/loan-detail', viewData(req, { title: `สัญญา ${detail.loan.loan_no}`, ...detail }));
};

exports.addMemberFollowup = async (req, res) => {
  await debtService.addMemberFollowup(req.params.loanId, req.body, req.debtAccess);
  res.redirect(`/debt/member-debt/loans/${encodeURIComponent(req.params.loanId)}?saved=1`);
};

exports.tasks = async (req, res) => {
  const tasks = await repository.listUrgentTasks(req.debtAccess, 100);
  res.render('debt/tasks', viewData(req, { title: 'งานที่ต้องดำเนินการ', tasks }));
};

exports.imports = (req, res) => res.render('debt/imports', viewData(req, { title: 'นำเข้าข้อมูลหนี้สมาชิก' }));
