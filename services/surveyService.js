const options = require('../utils/surveyOptions');
const { safeText, allowedSingle, allowedArray, countSelections, countSingle } = require('../utils/surveyUtils');

const json = (value) => JSON.stringify(value);

exports.validateFilters = (query, dimensions = { groups: [], statuses: [], officers: [] }) => ({
  coop_type: options.coopTypes.includes(query.coop_type) ? query.coop_type : '',
  tech_level: ['1', '2', '3', '4', '5'].includes(String(query.tech_level)) ? String(query.tech_level) : '',
  ai_interest: options.aiInterests.includes(query.ai_interest) ? query.ai_interest : '',
  pilot_readiness: options.pilotReadiness.includes(query.pilot_readiness) ? query.pilot_readiness : '',
  c_group: dimensions.groups.includes(query.c_group) ? query.c_group : '',
  c_status: dimensions.statuses.includes(query.c_status) ? query.c_status : '',
  c_person: dimensions.officers.includes(query.c_person) ? query.c_person : '',
  date_from: /^\d{4}-\d{2}-\d{2}$/.test(query.date_from || '') ? query.date_from : '',
  date_to: /^\d{4}-\d{2}-\d{2}$/.test(query.date_to || '') ? query.date_to : ''
});

exports.buildResponse = (body, cooperative, requestMeta) => {
  const coopName = safeText(cooperative?.c_name || body.coop_name, 255);
  if (!coopName) throw new Error('COOP_NAME_REQUIRED');
  const techLevel = Number(body.tech_level);
  if (![1, 2, 3, 4, 5].includes(techLevel)) throw new Error('INVALID_TECH_LEVEL');

  return {
    coop_id: cooperative?.c_id || null,
    coop_name: coopName,
    coop_type: allowedSingle(body.coop_type, options.coopTypes, true),
    member_range: allowedSingle(body.member_range, options.memberRanges),
    staff_range: allowedSingle(body.staff_range, options.staffRanges),
    respondent_role: allowedSingle(body.respondent_role, options.respondentRoles),
    current_tools: json(allowedArray(body.current_tools, options.currentTools)),
    tech_level: techLevel,
    data_storage: json(allowedArray(body.data_storage, options.dataStorage)),
    time_consuming_jobs: json(allowedArray(body.time_consuming_jobs, options.timeJobs)),
    current_problems: json(allowedArray(body.current_problems, options.problems)),
    most_time_job: safeText(body.most_time_job),
    most_time_job_detail: safeText(body.most_time_job_detail, 5000),
    desired_technology_jobs: json(allowedArray(body.desired_technology_jobs, options.technologyJobs)),
    desired_system_features: json(allowedArray(body.desired_system_features, options.systemFeatures)),
    ai_interest: allowedSingle(body.ai_interest, options.aiInterests, true),
    desired_ai_jobs: json(allowedArray(body.desired_ai_jobs, options.aiJobs)),
    ai_priority: safeText(body.ai_priority),
    shared_system_opinion: allowedSingle(body.shared_system_opinion, options.sharedOpinions),
    shareable_data: json(allowedArray(body.shareable_data, options.shareableData)),
    shared_system_concerns: json(allowedArray(body.shared_system_concerns, options.sharedConcerns)),
    computer_readiness: allowedSingle(body.computer_readiness, options.computerReadiness),
    internet_readiness: allowedSingle(body.internet_readiness, options.internetReadiness),
    staff_tech_skill: allowedSingle(body.staff_tech_skill, options.staffSkills),
    pilot_readiness: allowedSingle(body.pilot_readiness, options.pilotReadiness, true),
    support_needs: json(allowedArray(body.support_needs, options.supportNeeds)),
    support_formats: json(allowedArray(body.support_formats, options.supportFormats)),
    first_priority_system: safeText(body.first_priority_system),
    priority_reason: safeText(body.priority_reason, 5000),
    current_time_spent: allowedSingle(body.current_time_spent, options.timeSpent),
    expected_outcomes: json(allowedArray(body.expected_outcomes, options.expectedOutcomes)),
    biggest_opportunity: safeText(body.biggest_opportunity, 5000),
    dream_system: safeText(body.dream_system, 5000),
    additional_suggestions: safeText(body.additional_suggestions, 5000),
    ip_address: safeText(requestMeta.ip, 45),
    user_agent: safeText(requestMeta.userAgent, 500)
  };
};

exports.summarize = (rows) => {
  const total = rows.length;
  const uniqueCoops = new Set(rows.map((row) => row.coop_id || row.coop_name).filter(Boolean)).size;
  const aiInterested = rows.filter((row) => ['สนใจมาก', 'สนใจ'].includes(row.ai_interest)).length;
  const pilotReady = rows.filter((row) => ['พร้อมมาก', 'พร้อม'].includes(row.pilot_readiness)).length;
  const percentage = (count) => total ? Math.round((count / total) * 100) : 0;

  return {
    total,
    uniqueCoops,
    aiInterestedPercent: percentage(aiInterested),
    pilotReadyPercent: percentage(pilotReady),
    currentProblems: countSelections(rows, 'current_problems'),
    timeJobs: countSelections(rows, 'time_consuming_jobs'),
    desiredSystems: countSelections(rows, 'desired_system_features'),
    desiredAiJobs: countSelections(rows, 'desired_ai_jobs'),
    supportNeeds: countSelections(rows, 'support_needs'),
    coopTypes: countSingle(rows, 'coop_type'),
    techLevels: countSingle(rows, 'tech_level'),
    digitalReadiness: countSingle(rows, 'pilot_readiness')
  };
};
