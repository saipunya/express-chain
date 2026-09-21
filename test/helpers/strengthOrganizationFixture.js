function organizationAnswers(overrides = {}) {
  return { dimension3Mode:'detailed', controlMode:'standard', controlInput:'level', accountingTechnology:'full', controlEnvironmentLevel:'high', controlRiskLevel:'high', controlInformationLevel:'high', controlMonitoringLevel:'high', ...overrides };
}
module.exports = { organizationAnswers };
