const { body, validationResult } = require('express-validator');

const validateCreate = () => [
	body('name')
		.trim()
		.notEmpty().withMessage('Name is required')
		.isLength({ max: 100 }).withMessage('Name must be at most 100 characters'),
	body('capacity')
		.trim()
		.isInt({ min: 1 }).withMessage('Capacity must be a positive integer')
		.toInt(),
	body('location')
		.optional({ nullable: true })
		.trim()
		.isLength({ max: 200 }).withMessage('Location must be at most 200 characters'),
	body('available')
		.optional({ nullable: true })
		.isBoolean().withMessage('Available must be a boolean')
		.toBoolean(),
];

const handleValidation = (req, res, next) => {
	const errors = validationResult(req);
	if (errors.isEmpty()) return next();

	// If HTML expected, re-render the form with errors; otherwise respond JSON
	if (req.accepts('html')) {
		return res.status(422).render('meetingRooms/create', {
			title: 'Create Meeting Room',
			errors: errors.mapped(),
			values: req.body,
		});
	}
	return res.status(422).json({ errors: errors.array() });
};

module.exports = { validateCreate, handleValidation };
