// Input validation helpers
const { body, param, query, validationResult } = require('express-validator');

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate subdomain format
 * @param {string} subdomain - Subdomain to validate
 * @returns {boolean} True if valid subdomain
 */
function isValidSubdomain(subdomain) {
    // RFC 1035 compliant subdomain validation
    const subdomainRegex = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
    return subdomainRegex.test(subdomain);
}

/**
 * Validate port number
 * @param {number} port - Port number to validate
 * @returns {boolean} True if valid port
 */
function isValidPort(port) {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Validate API key format
 * @param {string} apiKey - API key to validate
 * @returns {boolean} True if valid API key
 */
function isValidApiKey(apiKey) {
    // API keys should be at least 32 characters long
    return typeof apiKey === 'string' && apiKey.length >= 32;
}

/**
 * Validate MongoDB ObjectId format
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid ObjectId
 */
function isValidObjectId(id) {
    const objectIdRegex = /^[a-f\d]{24}$/i;
    return objectIdRegex.test(id);
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Validate plan name
 * @param {string} plan - Plan name to validate
 * @returns {boolean} True if valid plan
 */
function isValidPlan(plan) {
    const validPlans = ['free', 'basic', 'pro', 'enterprise'];
    return validPlans.includes(plan);
}

/**
 * Sanitize string input
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeString(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '');
}

/**
 * Validation middleware for tunnel creation
 */
const validateTunnelCreation = [
    body('localPort')
        .isInt({ min: 1, max: 65535 })
        .withMessage('Local port must be a valid port number (1-65535)'),
    body('subdomain')
        .optional()
        .custom(value => {
            if (!isValidSubdomain(value)) {
                throw new Error('Invalid subdomain format');
            }
            return true;
        }),
    body('gitContextorShare')
        .optional()
        .isBoolean()
        .withMessage('gitContextorShare must be a boolean'),
];

/**
 * Validation middleware for user registration
 */
const validateUserRegistration = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
];

/**
 * Validation middleware for subscription creation
 */
const validateSubscriptionCreation = [
    body('priceId')
        .notEmpty()
        .withMessage('Stripe price ID is required')
        .isString()
        .withMessage('Price ID must be a string'),
];

/**
 * Validation middleware for ObjectId parameters
 */
const validateObjectIdParam = (paramName) => [
    param(paramName)
        .custom(value => {
            if (!isValidObjectId(value)) {
                throw new Error(`Invalid ${paramName} format`);
            }
            return true;
        })
];

/**
 * Validation middleware for pagination
 */
const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
];

/**
 * Handle validation errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            msg: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
}

module.exports = {
    isValidEmail,
    isValidSubdomain,
    isValidPort,
    isValidApiKey,
    isValidObjectId,
    isValidUrl,
    isValidPlan,
    sanitizeString,
    validateTunnelCreation,
    validateUserRegistration,
    validateSubscriptionCreation,
    validateObjectIdParam,
    validatePagination,
    handleValidationErrors
};
