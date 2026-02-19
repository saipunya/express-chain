const StrengthModel = require('../models/strengthModel');
const db = require('../config/db');

exports.getSummary = async (req, res) => {
  try {
    const { year } = req.query;

    if (!year) {
      const years = await StrengthModel.getYears();
      return res.render('strengthSummary', { 
        summary: null, 
        years: years || [],
        year: null,
        selectedYear: null
      });
    }

    // Query to get summary grouped by organization type
    const query = `
      SELECT 
        CASE 
          WHEN ac.coop_group = 'สหกรณ์' AND ac.in_out_group = 1 THEN 'สหกรณ์ภาคการเกษตร'
          WHEN ac.coop_group = 'สหกรณ์' AND ac.in_out_group = 2 THEN 'สหกรณ์นอกภาคการเกษตร'
          WHEN ac.coop_group = 'กลุ่มเกษตรกร' THEN 'กลุ่มเกษตรกร'
        END AS org_type,
        COUNT(DISTINCT s.st_code) AS total_count,
        COUNT(DISTINCT CASE WHEN s.st_grade = 'A' THEN s.st_code END) AS grade_a_count,
        COUNT(DISTINCT CASE WHEN s.st_grade = 'B' THEN s.st_code END) AS grade_b_count,
        COUNT(DISTINCT CASE WHEN s.st_grade = 'C' THEN s.st_code END) AS grade_c_count,
        COUNT(DISTINCT CASE WHEN s.st_grade = 'D' THEN s.st_code END) AS grade_d_count,
        ROUND(AVG(s.st_point), 2) AS avg_point,
        ROUND(MAX(s.st_point), 2) AS max_point,
        ROUND(MIN(s.st_point), 2) AS min_point
      FROM tbl_strength s
      LEFT JOIN active_coop ac ON s.st_code = ac.coop_code
      WHERE s.st_year = ?
      GROUP BY org_type
      ORDER BY FIELD(org_type, 'สหกรณ์ภาคการเกษตร', 'สหกรณ์นอกภาคการเกษตร', 'กลุ่มเกษตรกร')
    `;

    const [results] = await db.query(query, [year]);
    const years = await StrengthModel.getYears();

    res.render('strengthSummary', {
      summary: results || [],
      years: years || [],
      year: year,
      selectedYear: year
    });

  } catch (error) {
    console.error('Error in getSummary:', error);
    res.status(500).send('Internal server error');
  }
};
