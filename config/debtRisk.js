'use strict';

module.exports = Object.freeze({
  memberDebt: Object.freeze({
    redDaysPastDue: 90,
    redOverdueInstallments: 3,
    orangeDaysPastDue: 31,
    orangeOverdueInstallments: 2,
    urgentFollowupAgeDays: 30
  }),
  cdf: Object.freeze({
    orangeDueWithinDays: 30,
    yellowDueWithinDays: 90
  })
});
