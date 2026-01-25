const PlanProject = require('../models/planProject');
const planProjectModel = require('../models/planProjectModel');
const PlanKpi = require('../models/planKpi');

const isAdmin = (req) => {
  return req.session?.user?.mClass === 'admin';
};

const deny = (res) => {
  return res.status(403).render('requireLevel', { title: 'ไม่ได้เข้าหน้านี้' });
};

exports.requireAdminOrResponsibleByProjectCode = (getProCode) => {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next();

      const userId = Number(req.session?.user?.id);
      const proCode = typeof getProCode === 'function' ? getProCode(req) : null;

      if (!userId || !proCode) {
        return deny(res);
      }

      const project = await PlanProject.findByCode(proCode);
      if (!project) {
        return deny(res);
      }

      if (Number(project.pro_respon_id) !== userId) {
        return deny(res);
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
};

exports.requireAdminOrResponsibleByProjectId = (getProjectId) => {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next();

      const userId = Number(req.session?.user?.id);
      const projectId = typeof getProjectId === 'function' ? getProjectId(req) : null;
      const id = Number(projectId);

      if (!userId || !Number.isFinite(id)) {
        return deny(res);
      }

      const project = await planProjectModel.getById(id);
      if (!project) {
        return deny(res);
      }

      if (Number(project.pro_respon_id) !== userId) {
        return deny(res);
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
};

exports.requireAdminOrResponsibleByKpiId = (getKpiId) => {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next();

      const userId = Number(req.session?.user?.id);
      const rawKpiId = typeof getKpiId === 'function' ? getKpiId(req) : null;
      const kpiId = Number(rawKpiId);

      if (!userId || !Number.isFinite(kpiId)) {
        return deny(res);
      }

      const kpi = await PlanKpi.findByPk(kpiId);
      if (!kpi || !kpi.kp_procode) {
        return deny(res);
      }

      const project = await PlanProject.findByCode(kpi.kp_procode);
      if (!project) {
        return deny(res);
      }

      if (Number(project.pro_respon_id) !== userId) {
        return deny(res);
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
};
