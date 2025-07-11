// Nginx API integration configuration
const axios = require('axios');

/**
 * Nginx Proxy Manager configuration
 */
const nginxConfig = {
    apiUrl: process.env.NGINX_PROXY_MANAGER_API_URL || 'http://localhost:81/api',
    apiKey: process.env.NGINX_PROXY_MANAGER_API_KEY || '',
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
};

/**
 * Create axios instance for Nginx Proxy Manager API
 * @returns {Object} Axios instance
 */
function createNginxApiClient() {
    const client = axios.create({
        baseURL: nginxConfig.apiUrl,
        timeout: nginxConfig.timeout,
        headers: {
            'Authorization': `Bearer ${nginxConfig.apiKey}`,
            'Content-Type': 'application/json',
        }
    });

    // Add request interceptor for logging
    client.interceptors.request.use(
        (config) => {
            console.log(`[NginxAPI] ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        },
        (error) => {
            console.error('[NginxAPI] Request error:', error.message);
            return Promise.reject(error);
        }
    );

    // Add response interceptor for error handling
    client.interceptors.response.use(
        (response) => {
            console.log(`[NginxAPI] Response: ${response.status} ${response.statusText}`);
            return response;
        },
        (error) => {
            console.error('[NginxAPI] Response error:', error.message);
            if (error.response) {
                console.error('[NginxAPI] Error details:', error.response.data);
            }
            return Promise.reject(error);
        }
    );

    return client;
}

/**
 * Retry wrapper for API calls
 * @param {Function} apiCall - The API call function
 * @param {number} attempts - Number of retry attempts
 * @param {number} delay - Delay between retries in milliseconds
 * @returns {Promise} API call result
 */
async function retryApiCall(apiCall, attempts = nginxConfig.retryAttempts, delay = nginxConfig.retryDelay) {
    for (let i = 0; i < attempts; i++) {
        try {
            return await apiCall();
        } catch (error) {
            if (i === attempts - 1) {
                throw error;
            }
            console.warn(`[NginxAPI] Retry attempt ${i + 1}/${attempts} failed:`, error.message);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Get all proxy hosts from Nginx Proxy Manager
 * @param {Object} client - Axios client instance
 * @returns {Promise<Array>} Array of proxy hosts
 */
async function getAllProxyHosts(client) {
    const response = await retryApiCall(() => client.get('/nginx/proxy-hosts'));
    return response.data;
}

/**
 * Get proxy host by ID
 * @param {Object} client - Axios client instance
 * @param {number} id - Proxy host ID
 * @returns {Promise<Object>} Proxy host data
 */
async function getProxyHostById(client, id) {
    const response = await retryApiCall(() => client.get(`/nginx/proxy-hosts/${id}`));
    return response.data;
}

/**
 * Create SSL certificate configuration
 * @param {string} domain - Domain name
 * @returns {Object} SSL certificate configuration
 */
function createSSLConfig(domain) {
    return {
        certificate_id: 'new', // Request new Let's Encrypt certificate
        ssl_forced: true,
        ssl_provider: 'letsencrypt',
        hsts_enabled: true,
        hsts_subdomains: true,
        http2_support: true,
    };
}

/**
 * Create default proxy host configuration
 * @param {string} domain - Domain name
 * @param {Object} options - Additional options
 * @returns {Object} Proxy host configuration
 */
function createProxyHostConfig(domain, options = {}) {
    const {
        forwardScheme = 'http',
        forwardHost = 'localhost',
        forwardPort = 5000,
        enableSSL = true,
        enableBlocking = true,
        enableCaching = false,
        accessListId = 0,
    } = options;

    const config = {
        domain_names: [domain],
        forward_scheme: forwardScheme,
        forward_host: forwardHost,
        forward_port: forwardPort,
        access_list_id: accessListId,
        block_exploits: enableBlocking,
        caching_enabled: enableCaching,
        allow_websocket_upgrade: true,
        locations: [],
    };

    if (enableSSL) {
        Object.assign(config, createSSLConfig(domain));
    }

    return config;
}

/**
 * Validate Nginx API configuration
 * @returns {boolean} True if configuration is valid
 */
function validateNginxConfig() {
    if (!nginxConfig.apiUrl) {
        console.warn('[NginxConfig] API URL not configured');
        return false;
    }

    if (!nginxConfig.apiKey) {
        console.warn('[NginxConfig] API Key not configured');
        return false;
    }

    return true;
}

module.exports = {
    nginxConfig,
    createNginxApiClient,
    retryApiCall,
    getAllProxyHosts,
    getProxyHostById,
    createSSLConfig,
    createProxyHostConfig,
    validateNginxConfig
};
