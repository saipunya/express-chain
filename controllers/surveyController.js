const repository = require('../repositories/surveyRepository');
const service = require('../services/surveyService');
const options = require('../utils/surveyOptions');

async function formData(old = {}, error = null) {
  return { options, old, error };
}

exports.showForm = async (req, res, next) => {
  try {
    res.render('survey/form', await formData());
  } catch (err) {
    next(err);
  }
};

exports.submit = async (req, res, next) => {
  try {
    const data = service.buildResponse(req.body, null, {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    const id = await repository.create(data);
    res.redirect(`/survey/success?id=${id}`);
  } catch (err) {
    if (['COOP_NAME_REQUIRED', 'INVALID_TECH_LEVEL', 'INVALID_CHOICE'].includes(err.message)) {
      const messages = {
        COOP_NAME_REQUIRED: 'กรุณากรอกชื่อสหกรณ์หรือกลุ่มเกษตรกร',
        INVALID_TECH_LEVEL: 'กรุณาระบุระดับการใช้เทคโนโลยี 1–5',
        INVALID_CHOICE: 'ข้อมูลบางรายการไม่อยู่ในตัวเลือกที่กำหนด กรุณาตรวจสอบอีกครั้ง'
      };
      try {
        return res.status(400).render('survey/form', await formData(req.body, messages[err.message]));
      } catch (renderError) {
        return next(renderError);
      }
    }
    next(err);
  }
};

exports.success = (req, res) => res.render('survey/success', { id: /^\d+$/.test(req.query.id || '') ? req.query.id : null });

exports.results = async (req, res, next) => {
  try {
    const dimensions = await repository.getCooperativeDimensions();
    const filters = service.validateFilters(req.query, dimensions);
    const rows = await repository.list(filters);
    res.render('survey/results', {
      rows,
      summary: service.summarize(rows),
      filters,
      dimensions,
      options
    });
  } catch (err) {
    next(err);
  }
};
