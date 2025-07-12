const Tunnel = require('../models/Tunnel');
const { nanoid } = require('nanoid');

/**
 * Generate a unique tunnel path for path-based routing
 * @param {string} requestedPath - Optional requested path
 * @returns {Promise<string>} - Unique tunnel path
 */
async function generateTunnelPath(requestedPath) {
    let tunnelPath;
    
    if (requestedPath) {
        // Sanitize requested path
        tunnelPath = requestedPath
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')  // Replace invalid chars with hyphens
            .replace(/-+/g, '-')          // Replace multiple hyphens with single
            .replace(/^-|-$/g, '');       // Remove leading/trailing hyphens
        
        // Ensure minimum length
        if (tunnelPath.length < 3) {
            tunnelPath = tunnelPath + '-' + nanoid(6);
        }
        
        // Check if requested path is available
        const existing = await Tunnel.findOne({ tunnelPath });
        if (existing) {
            // Append random suffix if taken
            tunnelPath = tunnelPath + '-' + nanoid(4);
        }
    } else {
        // Generate random path
        tunnelPath = nanoid(12);
    }
    
    // Final check for uniqueness
    let attempts = 0;
    while (attempts < 5) {
        const existing = await Tunnel.findOne({ tunnelPath });
            break;
        }
        tunnelPath = nanoid(12);
        attempts++;
    }
    
    if (attempts >= 5) {
        throw new Error('Unable to generate unique tunnel path after multiple attempts');
    }
    
    return tunnelPath;
}

/**
 * Validate tunnel path format
 * @param {string} path - Path to validate
 * @returns {boolean} - Whether path is valid
 */
function isValidTunnelPath(path) {
    // Path should be 3-50 characters, alphanumeric and hyphens only
}

module.exports = {
    generateTunnelPath,
    isValidTunnelPath
};
