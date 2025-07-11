const axios = require('axios');

// Nginx Proxy Manager API
class NginxManager {
  constructor(apiUrl, apiKey) {
    if (!apiUrl || !apiKey) {
      console.warn('[NginxManager] API URL or Key not provided. Running in MOCK mode.');
      this.mock = true;
      return;
    }
    this.axios = axios.create({
      baseURL: apiUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    });
  }

  async createProxyHost(subdomain) {
    if (this.mock) {
        console.log(`[NginxManager MOCK] Creating proxy for ${subdomain}`);
        return { id: Math.floor(Math.random() * 1000), scheme: 'https' };
    }
    try {
      const domain = `${subdomain}.${process.env.TUNNEL_DOMAIN}`;
      
      const response = await this.axios.post('/nginx/proxy-hosts', {
        domain_names: [domain],
        forward_scheme: "http",
        forward_host: "app", // Service name in docker-compose
        forward_port: process.env.PORT || 5000,
        access_list_id: 0,
        certificate_id: "new", // Request a new Let's Encrypt cert
        ssl_forced: true,
        hsts_enabled: true,
        hsts_subdomains: true,
        http2_support: true,
        block_exploits: true,
      });
      
      console.log(`[NginxManager] Created proxy host for ${domain}`);
      return {
          id: response.data.id,
          scheme: 'https'
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      console.error(`[NginxManager] Failed to create proxy host: ${errorMessage}`);
      throw new Error(`Could not create proxy host for ${subdomain}. Reason: ${errorMessage}`);
    }
  }

  async deleteProxyHost(proxyHostId) {
    if (this.mock) {
      console.log(`[NginxManager MOCK] Deleting proxy host with ID ${proxyHostId}`);
      return { message: 'Proxy host deleted' };
    }
    try {
      await this.axios.delete(`/nginx/proxy-hosts/${proxyHostId}`);
      console.log(`[NginxManager] Deleted proxy host with ID ${proxyHostId}`);
      return { message: 'Proxy host deleted' };
    } catch (error) {
      // Don't throw if it fails, maybe it was already deleted. Just log it.
      const errorMessage = error.response?.data?.message || error.message;
      console.error(`[NginxManager] Could not delete proxy host ID ${proxyHostId}. Reason: ${errorMessage}`);
      return { message: 'Could not delete proxy host, it may have already been removed.' };
    }
  }
}

// Note: This service will be instantiated with config values
module.exports = NginxManager;
