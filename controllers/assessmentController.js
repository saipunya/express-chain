const AssessmentModel = require('../models/assessmentModel');

class AssessmentController {
  static showForm(req, res) {
    res.render('assessment/form', { 
      title: 'ระบบความเข้มแข็งสหกรณ์',
      user: req.session?.user || null
    });
  }

  static async processAssessment(req, res) {
    try {
      res.json({ message: 'ระบบทำงานแล้ว', data: req.body });
    } catch (error) {
      console.error('Assessment error:', error);
      res.status(500).json({ error: 'ข้อพลาด' });
    }
  }

  static async showResults(req, res) {
    try {
      res.json({ message: 'แสดงผลการ' });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'ข้อพลาด' });
    }
  }
}

module.exports = AssessmentController;
