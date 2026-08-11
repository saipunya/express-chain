const pool = require('../config/db');

const INSERT_FIELDS = [
  'coop_id', 'coop_name', 'coop_type', 'member_range', 'staff_range', 'respondent_role',
  'current_tools', 'tech_level', 'data_storage', 'time_consuming_jobs', 'current_problems',
  'most_time_job', 'most_time_job_detail', 'desired_technology_jobs', 'desired_system_features',
  'ai_interest', 'desired_ai_jobs', 'ai_priority', 'shared_system_opinion', 'shareable_data',
  'shared_system_concerns', 'computer_readiness', 'internet_readiness', 'staff_tech_skill',
  'pilot_readiness', 'support_needs', 'support_formats', 'first_priority_system', 'priority_reason',
  'current_time_spent', 'expected_outcomes', 'biggest_opportunity', 'dream_system',
  'additional_suggestions', 'ip_address', 'user_agent'
];

exports.listCooperatives = async () => {
  const [rows] = await pool.query(`
    SELECT c_id, c_code, c_name, c_type, coop_group, c_group, c_status
    FROM active_coop
    WHERE c_status = 'ดำเนินการ'
    ORDER BY c_name ASC
  `);
  return rows;
};

exports.findCooperative = async (id) => {
  const [rows] = await pool.query(`
    SELECT c_id, c_code, c_name, c_type, coop_group, c_group, c_status
    FROM active_coop WHERE c_id = ? AND c_status = 'ดำเนินการ' LIMIT 1
  `, [id]);
  return rows[0] || null;
};

exports.getCooperativeDimensions = async () => {
  const [rows] = await pool.query(`
    SELECT DISTINCT c_group, c_status, c_person
    FROM active_coop
    ORDER BY c_group ASC, c_status ASC, c_person ASC
  `);
  const unique = (field) => [...new Set(rows.map((row) => row[field]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), 'th'));
  return { groups: unique('c_group'), statuses: unique('c_status'), officers: unique('c_person') };
};

exports.create = async (data) => {
  const columns = INSERT_FIELDS.join(', ');
  const placeholders = INSERT_FIELDS.map(() => '?').join(', ');
  const values = INSERT_FIELDS.map((field) => data[field] ?? null);
  const [result] = await pool.execute(
    `INSERT INTO survey_responses (${columns}) VALUES (${placeholders})`,
    values
  );
  return result.insertId;
};

exports.list = async (filters) => {
  const conditions = [];
  const params = [];
  const add = (sql, value) => { conditions.push(sql); params.push(value); };

  if (filters.coop_type) add('sr.coop_type = ?', filters.coop_type);
  if (filters.tech_level) add('sr.tech_level = ?', Number(filters.tech_level));
  if (filters.ai_interest) add('sr.ai_interest = ?', filters.ai_interest);
  if (filters.pilot_readiness) add('sr.pilot_readiness = ?', filters.pilot_readiness);
  if (filters.c_group) add('ac.c_group = ?', filters.c_group);
  if (filters.c_status) add('ac.c_status = ?', filters.c_status);
  if (filters.c_person) add('ac.c_person = ?', filters.c_person);
  if (filters.date_from) add('sr.submitted_at >= ?', `${filters.date_from} 00:00:00`);
  if (filters.date_to) add('sr.submitted_at < DATE_ADD(?, INTERVAL 1 DAY)', filters.date_to);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(`
    SELECT sr.*, ac.c_group, ac.c_status, ac.c_person
    FROM survey_responses sr
    LEFT JOIN active_coop ac ON ac.c_id = sr.coop_id
    ${where}
    ORDER BY sr.submitted_at DESC
  `, params);
  return rows;
};
