const AppError = require('../../utils/AppError');

const validate = (schema) => (req, res, next) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    } catch (err) {
        const errors = err.errors.map(e => ({ path: e.path, message: e.message }));
        next(new AppError('Validation Error', 400, 'VALIDATION_ERROR', errors));
    }
};

module.exports = validate;
