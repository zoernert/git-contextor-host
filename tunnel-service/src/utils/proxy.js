// HTTP proxy utilities
const { v4: uuidv4 } = require('uuid');

/**
 * Parse raw HTTP request into structured data
 * @param {Object} req - Express request object
 * @param {Buffer} body - Raw request body
 * @returns {Object} Structured request data
 */
function parseHttpRequest(req, body) {
    return {
        method: req.method,
        url: req.originalUrl || req.url,
        headers: req.headers,
        body: body ? body.toString('base64') : '',
        remoteAddress: req.connection?.remoteAddress || req.ip,
        timestamp: new Date().toISOString()
    };
}

/**
 * Parse HTTP response from tunnel client
 * @param {Object} responseData - Response data from tunnel client
 * @returns {Object} Structured response data
 */
function parseHttpResponse(responseData) {
    const { status, headers, body } = responseData;
    
    return {
        status: status || 200,
        headers: headers || {},
        body: body ? Buffer.from(body, 'base64') : Buffer.alloc(0)
    };
}

/**
 * Generate unique request ID for tracking
 * @returns {string} Unique request ID
 */
function generateRequestId() {
    return uuidv4();
}

/**
 * Validate proxy request headers
 * @param {Object} headers - Request headers
 * @returns {boolean} True if headers are valid
 */
function validateProxyHeaders(headers) {
    // Check for essential headers
    if (!headers.host) {
        return false;
    }
    
    // Filter out hop-by-hop headers
    const hopByHopHeaders = [
        'connection',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailers',
        'transfer-encoding',
        'upgrade'
    ];
    
    const filteredHeaders = { ...headers };
    hopByHopHeaders.forEach(header => {
        delete filteredHeaders[header];
    });
    
    return true;
}

/**
 * Calculate content length from buffer
 * @param {Buffer} buffer - Content buffer
 * @returns {number} Content length in bytes
 */
function calculateContentLength(buffer) {
    return buffer ? buffer.length : 0;
}

/**
 * Check if request is websocket upgrade
 * @param {Object} req - Express request object
 * @returns {boolean} True if websocket upgrade request
 */
function isWebSocketUpgrade(req) {
    return req.headers.upgrade === 'websocket' && 
           req.headers.connection?.toLowerCase().includes('upgrade');
}

/**
 * Create error response for proxy failures
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @returns {Object} Error response object
 */
function createProxyError(statusCode, message) {
    return {
        status: statusCode,
        headers: {
            'content-type': 'application/json',
            'connection': 'close'
        },
        body: JSON.stringify({
            error: message,
            timestamp: new Date().toISOString()
        })
    };
}

module.exports = {
    parseHttpRequest,
    parseHttpResponse,
    generateRequestId,
    validateProxyHeaders,
    calculateContentLength,
    isWebSocketUpgrade,
    createProxyError
};
