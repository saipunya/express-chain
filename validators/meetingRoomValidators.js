const { body, validationResult } = require('express-validator');

const validateCreate = () => [
	// required fields
	body('mee_date')
		.trim()
		.notEmpty().withMessage('กรุณาระบุวันที่')
		.isISO8601({ strict: true }).withMessage('รูปแบบวันที่ไม่ถูกต้อง'),
	body('mee_time')
		.trim()
		.notEmpty().withMessage('กรุณาระบุเวลา')
		.matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('รูปแบบเวลาไม่ถูกต้อง (HH:mm)'),
	body('mee_subject')
		.trim()
		.notEmpty().withMessage('กรุณาระบุเรื่อง')
		.isLength({ max: 255 }).withMessage('เรื่องยาวเกินกำหนด'),
	body('mee_room')
		.trim()
		.notEmpty().withMessage('กรุณาระบุห้อง')
		.isLength({ max: 100 }).withMessage('ชื่อห้องยาวเกินกำหนด'),
	// optional fields
	body('mee_respon')
		.optional({ nullable: true })
		.trim()
		.isLength({ max: 100 }).withMessage('ผู้รับผิดชอบยาวเกินกำหนด'),
	body('mee_saveby')
		.optional({ nullable: true })
		.trim()
		.isLength({ max: 100 }).withMessage('ผู้บันทึกยาวเกินกำหนด'),
	body('mee_savedate')
		.optional({ checkFalsy: true })
		.customSanitizer(v => v || new Date().toISOString()),
];

const handleValidation = (req, res, next) => {
	const errors = validationResult(req);
	if (errors.isEmpty()) return next();

	if (req.accepts('html')) {
		return res.status(422).render('meetingroom/create', {
			title: 'Create Meeting Room',
			errors: errors.mapped(),
			values: req.body,
		});
	}
	return res.status(422).json({ errors: errors.array() });
};

module.exports = { validateCreate, handleValidation };
