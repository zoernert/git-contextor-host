const NginxManager = require('../../src/services/NginxManager');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('NginxManager', () => {
    let nginxManager;
    let mockAxiosInstance;

    beforeEach(() => {
        // Create mock axios instance
        mockAxiosInstance = {
            post: jest.fn(),
            get: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
        };

        mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        it('should create instance with valid config', () => {
            nginxManager = new NginxManager('http://localhost:81/api', 'test-key');
            
            expect(nginxManager.mock).toBeFalsy();
            expect(mockedAxios.create).toHaveBeenCalledWith({
                baseURL: 'http://localhost:81/api',
                headers: {
                    'Authorization': 'Bearer test-key',
                    'Content-Type': 'application/json',
                }
            });
        });

        it('should create mock instance when config is missing', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            
            nginxManager = new NginxManager();
            
            expect(nginxManager.mock).toBeTruthy();
            expect(consoleSpy).toHaveBeenCalledWith('[NginxManager] API URL or Key not provided. Running in MOCK mode.');
            
            consoleSpy.mockRestore();
        });
    });

    describe('createProxyHost', () => {
        beforeEach(() => {
            nginxManager = new NginxManager('http://localhost:81/api', 'test-key');
        });

        it('should create proxy host successfully', async () => {
            const mockResponse = {
                data: { id: 123, enabled: true }
            };
            mockAxiosInstance.post.mockResolvedValue(mockResponse);

            const result = await nginxManager.createProxyHost('test-subdomain');

            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nginx/proxy-hosts', {
                domain_names: ['test-subdomain.undefined'],
                forward_scheme: 'http',
                forward_host: 'app',
                forward_port: 5000,
                access_list_id: 0,
                certificate_id: 'new',
                ssl_forced: true,
                hsts_enabled: true,
                hsts_subdomains: true,
                http2_support: true,
                block_exploits: true,
            });

            expect(result).toEqual({ id: 123, scheme: 'https' });
        });

        it('should handle API errors', async () => {
            const apiError = new Error('API Error');
            mockAxiosInstance.post.mockRejectedValue(apiError);

            await expect(nginxManager.createProxyHost('test-subdomain'))
                .rejects
                .toThrow('API Error');
        });

        it('should work in mock mode', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            nginxManager = new NginxManager(); // No config = mock mode

            const result = await nginxManager.createProxyHost('test-subdomain');

            expect(consoleSpy).toHaveBeenCalledWith('[NginxManager MOCK] Creating proxy for test-subdomain');
            expect(result).toEqual({ id: expect.any(Number), scheme: 'https' });
            expect(result.id).toBeGreaterThan(0);
            expect(result.id).toBeLessThan(1000);

            consoleSpy.mockRestore();
        });
    });

    describe('deleteProxyHost', () => {
        beforeEach(() => {
            nginxManager = new NginxManager('http://localhost:81/api', 'test-key');
        });

        it('should delete proxy host successfully', async () => {
            const mockResponse = {
                data: { message: 'Proxy host deleted' }
            };
            mockAxiosInstance.delete.mockResolvedValue(mockResponse);

            const result = await nginxManager.deleteProxyHost(123);

            expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/nginx/proxy-hosts/123');
            expect(result).toEqual({ message: 'Proxy host deleted' });
        });

        it('should handle API errors', async () => {
            const apiError = new Error('Not Found');
            mockAxiosInstance.delete.mockRejectedValue(apiError);

            await expect(nginxManager.deleteProxyHost(123))
                .rejects
                .toThrow('Not Found');
        });

        it('should work in mock mode', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            nginxManager = new NginxManager(); // No config = mock mode

            const result = await nginxManager.deleteProxyHost(123);

            expect(consoleSpy).toHaveBeenCalledWith('[NginxManager MOCK] Deleting proxy host 123');
            expect(result).toEqual({ message: 'Proxy host deleted' });

            consoleSpy.mockRestore();
        });
    });

    describe('updateProxyHost', () => {
        beforeEach(() => {
            nginxManager = new NginxManager('http://localhost:81/api', 'test-key');
        });

        it('should update proxy host successfully', async () => {
            const mockResponse = {
                data: { id: 123, enabled: true }
            };
            mockAxiosInstance.put.mockResolvedValue(mockResponse);

            const config = { enabled: false };
            const result = await nginxManager.updateProxyHost(123, config);

            expect(mockAxiosInstance.put).toHaveBeenCalledWith('/nginx/proxy-hosts/123', config);
            expect(result).toEqual({ id: 123, enabled: true });
        });

        it('should handle API errors', async () => {
            const apiError = new Error('Validation Error');
            mockAxiosInstance.put.mockRejectedValue(apiError);

            await expect(nginxManager.updateProxyHost(123, {}))
                .rejects
                .toThrow('Validation Error');
        });

        it('should work in mock mode', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            nginxManager = new NginxManager(); // No config = mock mode

            const config = { enabled: false };
            const result = await nginxManager.updateProxyHost(123, config);

            expect(consoleSpy).toHaveBeenCalledWith('[NginxManager MOCK] Updating proxy host 123 with config:', config);
            expect(result).toEqual({ message: 'Proxy host updated' });

            consoleSpy.mockRestore();
        });
    });

    describe('Environment variable handling', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            jest.resetModules();
            process.env = { ...originalEnv };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('should use environment variables for domain', async () => {
            process.env.TUNNEL_DOMAIN = 'test.example.com';
            process.env.PORT = '8080';
            
            nginxManager = new NginxManager('http://localhost:81/api', 'test-key');
            
            const mockResponse = {
                data: { id: 123, enabled: true }
            };
            mockAxiosInstance.post.mockResolvedValue(mockResponse);

            await nginxManager.createProxyHost('test-subdomain');

            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nginx/proxy-hosts', 
                expect.objectContaining({
                    domain_names: ['test-subdomain.test.example.com'],
                    forward_port: 8080,
                })
            );
        });
    });
});
