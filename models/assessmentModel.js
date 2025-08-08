const db = require('../config/db');

class AssessmentModel {
  static async create(data) {
    const query = `
      INSERT INTO assessments (
        cooperative_type, criterion_1_1, criterion_1_2, criterion_1_3,
        criterion_2_1, criterion_2_2, criterion_2_3, criterion_2_4, criterion_2_5, criterion_2_6,
        criterion_3_1, criterion_3_2, criterion_3_3, criterion_3_4,
        criterion_4_1, criterion_4_2, criterion_4_3, criterion_4_4,
        total_score, assessment_level, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    
    const [result] = await db.execute(query, [
      data.cooperative_type, data.criterion_1_1, data.criterion_1_2, data.criterion_1_3,
      data.criterion_2_1, data.criterion_2_2, data.criterion_2_3, data.criterion_2_4, 
      data.criterion_2_5, data.criterion_2_6, data.criterion_3_1, data.criterion_3_2,
      data.criterion_3_3, data.criterion_3_4, data.criterion_4_1, data.criterion_4_2,
      data.criterion_4_3, data.criterion_4_4, data.total_score, data.assessment_level
    ]);
    
    return result.insertId;
  }

  static async getAll() {
    const [rows] = await db.execute('SELECT * FROM assessments ORDER BY created_at DESC');
    return rows;
  }

  static async getById(id) {
    const [rows] = await db.execute('SELECT * FROM assessments WHERE id = ?', [id]);
    return rows[0];
  }
}

module.exports = AssessmentModel;