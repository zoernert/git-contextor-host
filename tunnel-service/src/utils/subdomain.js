const Tunnel = require('../models/Tunnel');
const { customAlphabet } = require('nanoid');
const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
const nanoid = customAlphabet(alphabet, 6);

const isSubdomainTaken = async (subdomain) => {
    const existing = await Tunnel.findOne({ subdomain, isActive: true });
    return !!existing;
};

const generateSubdomain = async (requested) => {
    if (requested) {
        // Basic validation for requested subdomain
        if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(requested)) {
            throw new Error('Invalid subdomain format.');
        }
        if (await isSubdomainTaken(requested)) {
            throw new Error('Subdomain is already in use.');
        }
        return requested;
    }

    // Generate a random one
    let subdomain;
    let attempts = 0;
    do {
        subdomain = nanoid();
        if (attempts++ > 10) {
            throw new Error('Could not generate a unique subdomain.');
        }
    } while (await isSubdomainTaken(subdomain));

    return subdomain;
};

module.exports = { generateSubdomain, isSubdomainTaken };
