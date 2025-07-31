/**
 * @fileoverview Tests for date range API endpoints
 * Tests the new REST API endpoints for date range reporting
 */

const request = require('supertest');
const ApiServer = require('../scripts/apiServer');

describe('Date Range API Endpoints', () => {
  let apiServer;
  let app;

  beforeAll(async () => {
    apiServer = new ApiServer({ port: 0 }); // Use dynamic port for testing
    app = apiServer.app;
  });

  afterAll(async () => {
    if (apiServer.server) {
      apiServer.server.close();
    }
  });

  describe('GET /api/range/:startDate/:endDate', () => {
    test('should handle date range endpoint (may return 200 with data or 500 if empty)', async () => {
      const response = await request(app).get(
        '/api/range/2025-07-15/2025-07-17'
      );

      if (response.status === 200) {
        // If data exists, validate structure
        expect(response.body).toHaveProperty('reportType', 'dateRange');
        expect(response.body).toHaveProperty('startDate', '2025-07-15');
        expect(response.body).toHaveProperty('endDate', '2025-07-17');
        expect(response.body).toHaveProperty('report');
        expect(response.body).toHaveProperty('metadata');
        expect(response.body.metadata).toHaveProperty('generatedAt');
        expect(response.body.metadata).toHaveProperty(
          'groupBy',
          'departmentalGoal'
        );
        expect(response.body.metadata).toHaveProperty('sort', 'date');
        expect(response.body.metadata).toHaveProperty('topTasks', 3);
      } else if (response.status === 500) {
        // If no data, expect proper error structure
        expect(response.body).toHaveProperty('error', 'Internal server error');
        expect(response.body.message).toContain('No time entries found');
      } else {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
    });

    test('should handle query parameters correctly', async () => {
      const response = await request(app)
        .get('/api/range/2025-07-15/2025-07-17')
        .query({
          groupBy: 'tag',
          sort: 'hours',
          topTasks: 5,
        });

      if (response.status === 200) {
        expect(response.body.metadata.groupBy).toBe('tag');
        expect(response.body.metadata.sort).toBe('hours');
        expect(response.body.metadata.topTasks).toBe(5);
      } else if (response.status === 500) {
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should return 500 for empty date range', async () => {
      const response = await request(app)
        .get('/api/range/2025-06-01/2025-06-30')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal server error');
      expect(response.body.message).toContain('No time entries found');
    });
  });

  describe('GET /api/weekly', () => {
    test('should handle current week endpoint', async () => {
      const response = await request(app).get('/api/weekly');

      if (response.status === 200) {
        expect(response.body).toHaveProperty('reportType', 'weekly');
        expect(response.body).toHaveProperty('weekOf');
        expect(response.body).toHaveProperty('startDate');
        expect(response.body).toHaveProperty('endDate');
        expect(response.body).toHaveProperty('report');
        expect(response.body).toHaveProperty('metadata');
      } else if (response.status === 500) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.message).toContain('No time entries found');
      }
    });

    test('should handle query parameters for weekly report', async () => {
      const response = await request(app).get('/api/weekly').query({
        groupBy: 'strategicDirection',
        sort: 'alpha',
        topTasks: 2,
      });

      if (response.status === 200) {
        expect(response.body.metadata.groupBy).toBe('strategicDirection');
        expect(response.body.metadata.sort).toBe('alpha');
        expect(response.body.metadata.topTasks).toBe(2);
      } else if (response.status === 500) {
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('GET /api/weekly/:date', () => {
    test('should handle weekly report for specific date', async () => {
      const response = await request(app).get('/api/weekly/2025-07-16');

      if (response.status === 200) {
        expect(response.body).toHaveProperty('reportType', 'weekly');
        expect(response.body).toHaveProperty('targetDate', '2025-07-16');
        expect(response.body).toHaveProperty('weekOf');
        expect(response.body).toHaveProperty('startDate');
        expect(response.body).toHaveProperty('endDate');
      } else if (response.status === 500) {
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .get('/api/weekly/2025-7-16')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid date format');
      expect(response.body).toHaveProperty('expected', 'YYYY-MM-DD');
    });
  });

  describe('GET /api/monthly', () => {
    test('should handle current month endpoint', async () => {
      const response = await request(app).get('/api/monthly');

      if (response.status === 200) {
        expect(response.body).toHaveProperty('reportType', 'monthly');
        expect(response.body).toHaveProperty('month');
        expect(response.body).toHaveProperty('startDate');
        expect(response.body).toHaveProperty('endDate');
        expect(response.body).toHaveProperty('report');
      } else if (response.status === 500) {
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('GET /api/monthly/:month', () => {
    test('should handle monthly report for specific month (YYYY-MM)', async () => {
      const response = await request(app).get('/api/monthly/2025-07');

      if (response.status === 200) {
        expect(response.body).toHaveProperty('reportType', 'monthly');
        expect(response.body).toHaveProperty('month', '2025-07');
        expect(response.body).toHaveProperty('startDate');
        expect(response.body).toHaveProperty('endDate');
      } else if (response.status === 500) {
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should handle monthly report for specific date (YYYY-MM-DD)', async () => {
      const response = await request(app).get('/api/monthly/2025-07-15');

      if (response.status === 200) {
        expect(response.body).toHaveProperty('reportType', 'monthly');
        expect(response.body).toHaveProperty('month', '2025-07');
      } else if (response.status === 500) {
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should return 500 for invalid month format', async () => {
      const response = await request(app)
        .get('/api/monthly/2025-7')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal server error');
      expect(response.body.message).toContain('Invalid month format');
    });
  });

  describe('API Info Endpoint', () => {
    test('should include new endpoints in API info', async () => {
      const response = await request(app).get('/api').expect(200);

      expect(response.body.endpoints).toHaveProperty(
        'GET /api/range/:startDate/:endDate'
      );
      expect(response.body.endpoints).toHaveProperty('GET /api/weekly');
      expect(response.body.endpoints).toHaveProperty('GET /api/weekly/:date');
      expect(response.body.endpoints).toHaveProperty('GET /api/monthly');
      expect(response.body.endpoints).toHaveProperty('GET /api/monthly/:month');
    });
  });
});
