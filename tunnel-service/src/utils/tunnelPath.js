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
        if (!existing) {
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
    return /^[a-z0-9-]{3,50}$/.test(path) && !path.startsWith('-') && !path.endsWith('-');
}

/**
 * Generate legacy subdomain for backward compatibility
 * @param {string} requestedSubdomain - Optional requested subdomain
 * @returns {Promise<string>} - Unique subdomain
 */
async function generateSubdomain(requestedSubdomain) {
    let subdomain;
    
    if (requestedSubdomain) {
        // Sanitize requested subdomain
        subdomain = requestedSubdomain
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        
        // Check if it's available
        const existingTunnel = await Tunnel.findOne({ subdomain });
        if (existingTunnel) {
            // Append random suffix if taken
            subdomain = `${subdomain}-${nanoid(6)}`;
        }
    } else {
        // Generate random subdomain
        subdomain = `sub-${nanoid(8)}`;
    }
    
    // Ensure uniqueness
    let attempts = 0;
    while (attempts < 10) {
        const existingTunnel = await Tunnel.findOne({ subdomain });
        if (!existingTunnel) {
            break;
        }
        subdomain = `sub-${nanoid(8)}`;
        attempts++;
    }
    
    if (attempts >= 10) {
        throw new Error('Unable to generate unique subdomain after 10 attempts');
    }
    
    return subdomain;
}

module.exports = {
    generateTunnelPath,
    generateSubdomain,
    isValidTunnelPath
};
