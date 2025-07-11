const request = require('supertest');
const app = require('../../src/index');

describe('API Health Check', () => {
    it('should return 200 OK with status ok', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ status: 'ok' });
    });
});
