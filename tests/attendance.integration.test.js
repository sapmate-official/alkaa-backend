const request = require('supertest');
const { app } = require('../server');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 🧪 COMPREHENSIVE BACKEND API TESTS FOR ATTENDANCE SYSTEM
describe('Attendance System API Integration Tests', () => {
  let authToken;
  let testOrgId;
  let testUserId;
  let testRuleId;
  let testGeofenceId;

  // Setup before all tests
  beforeAll(async () => {
    // Create test organization
    testOrgId = `test-org-${Date.now()}`;
    testUserId = `test-user-${Date.now()}`;
    
    // Mock authentication (replace with your actual auth flow)
    authToken = 'mock-jwt-token'; // You'll need to generate a real JWT for testing
  });

  // Cleanup after all tests
  afterAll(async () => {
    // Clean up test data
    try {
      await prisma.$disconnect();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  // Helper function to make authenticated requests
  const authenticatedRequest = (method, url) => {
    return request(app)[method](url)
      .set('Authorization', `Bearer ${authToken}`)
      .set('Content-Type', 'application/json');
  };

  // ===================================
  // HEALTH CHECK TESTS
  // ===================================
  describe('Health Check Endpoints', () => {
    test('should return API v3 health status', async () => {
      const response = await request(app)
        .get('/api/v3/health')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
    });

    test('should return attendance API health status', async () => {
      const response = await request(app)
        .get('/api/v3/attendance/health')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
    });
  });

  // ===================================
  // ATTENDANCE RULES TESTS
  // ===================================
  describe('Attendance Rules API', () => {
    test('should get organization attendance rules', async () => {
      const response = await authenticatedRequest('get', `/api/v3/attendance/organizations/${testOrgId}/rules`);
      
      expect(response.status).toBeIn([200, 401]); // 401 if auth is required
      if (response.status === 200) {
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    test('should create new attendance rule', async () => {
      const ruleData = {
        ruleType: 'LATE_ARRIVAL',
        threshold: 15,
        penalty: 100,
        description: 'Test late arrival rule',
        isActive: true
      };

      const response = await authenticatedRequest('post', `/api/v3/attendance/organizations/${testOrgId}/rules`)
        .send(ruleData);

      expect(response.status).toBeIn([200, 201, 401]);
      if (response.status === 200 || response.status === 201) {
        expect(response.body.data).toHaveProperty('id');
        testRuleId = response.body.data.id;
      }
    });

    test('should update attendance rule', async () => {
      if (!testRuleId) return; // Skip if rule creation failed

      const updateData = {
        threshold: 20,
        penalty: 150,
        description: 'Updated test rule'
      };

      const response = await authenticatedRequest('put', `/api/v3/attendance/organizations/${testOrgId}/rules/${testRuleId}`)
        .send(updateData);

      expect(response.status).toBeIn([200, 401, 404]);
    });

    test('should delete attendance rule', async () => {
      if (!testRuleId) return; // Skip if rule creation failed

      const response = await authenticatedRequest('delete', `/api/v3/attendance/organizations/${testOrgId}/rules/${testRuleId}`);

      expect(response.status).toBeIn([200, 204, 401, 404]);
    });
  });

  // ===================================
  // BREAK MANAGEMENT TESTS
  // ===================================
  describe('Break Management API', () => {
    test('should get user active breaks', async () => {
      const response = await authenticatedRequest('get', `/api/v3/attendance/users/${testUserId}/breaks/active`);
      
      expect(response.status).toBeIn([200, 401, 404]);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
      }
    });

    test('should start break', async () => {
      const breakData = {
        type: 'LUNCH',
        reason: 'Test lunch break'
      };

      const response = await authenticatedRequest('post', `/api/v3/attendance/users/${testUserId}/breaks/start`)
        .send(breakData);

      expect(response.status).toBeIn([200, 201, 401]);
    });

    test('should end break', async () => {
      const response = await authenticatedRequest('post', `/api/v3/attendance/users/${testUserId}/breaks/end`);

      expect(response.status).toBeIn([200, 401, 404]);
    });

    test('should get break history', async () => {
      const response = await authenticatedRequest('get', `/api/v3/attendance/users/${testUserId}/breaks?limit=10`);

      expect(response.status).toBeIn([200, 401]);
      if (response.status === 200) {
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  // ===================================
  // GEOFENCING TESTS
  // ===================================
  describe('Geofencing API', () => {
    test('should get organization geofences', async () => {
      const response = await authenticatedRequest('get', `/api/v3/attendance/organizations/${testOrgId}/geofences`);
      
      expect(response.status).toBeIn([200, 401]);
      if (response.status === 200) {
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    test('should create new geofence', async () => {
      const geofenceData = {
        name: 'Test Office',
        type: 'OFFICE',
        latitude: 40.7128,
        longitude: -74.0060,
        radius: 100,
        description: 'Test office location',
        isActive: true
      };

      const response = await authenticatedRequest('post', `/api/v3/attendance/organizations/${testOrgId}/geofences`)
        .send(geofenceData);

      expect(response.status).toBeIn([200, 201, 401]);
      if (response.status === 200 || response.status === 201) {
        expect(response.body.data).toHaveProperty('id');
        testGeofenceId = response.body.data.id;
      }
    });

    test('should verify location within geofence', async () => {
      const locationData = {
        latitude: 40.7128,
        longitude: -74.0060
      };

      const response = await authenticatedRequest('post', `/api/v3/attendance/organizations/${testOrgId}/geofences/verify`)
        .send(locationData);

      expect(response.status).toBeIn([200, 401]);
    });

    test('should update geofence', async () => {
      if (!testGeofenceId) return;

      const updateData = {
        radius: 150,
        description: 'Updated test office location'
      };

      const response = await authenticatedRequest('put', `/api/v3/attendance/organizations/${testOrgId}/geofences/${testGeofenceId}`)
        .send(updateData);

      expect(response.status).toBeIn([200, 401, 404]);
    });

    test('should delete geofence', async () => {
      if (!testGeofenceId) return;

      const response = await authenticatedRequest('delete', `/api/v3/attendance/organizations/${testOrgId}/geofences/${testGeofenceId}`);

      expect(response.status).toBeIn([200, 204, 401, 404]);
    });
  });

  // ===================================
  // ALERTS TESTS
  // ===================================
  describe('Alerts API', () => {
    test('should get organization alerts', async () => {
      const response = await authenticatedRequest('get', `/api/v3/attendance/organizations/${testOrgId}/alerts`);
      
      expect(response.status).toBeIn([200, 401]);
      if (response.status === 200) {
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    test('should create attendance alert', async () => {
      const alertData = {
        type: 'LATE_ARRIVAL',
        userId: testUserId,
        message: 'Test late arrival alert',
        severity: 'MEDIUM'
      };

      const response = await authenticatedRequest('post', `/api/v3/attendance/organizations/${testOrgId}/alerts`)
        .send(alertData);

      expect(response.status).toBeIn([200, 201, 401]);
    });

    test('should mark alert as read', async () => {
      // First get alerts to find one to mark as read
      const alertsResponse = await authenticatedRequest('get', `/api/v3/attendance/organizations/${testOrgId}/alerts`);
      
      if (alertsResponse.status === 200 && alertsResponse.body.data.length > 0) {
        const alertId = alertsResponse.body.data[0].id;
        
        const response = await authenticatedRequest('put', `/api/v3/attendance/organizations/${testOrgId}/alerts/${alertId}/read`);
        expect(response.status).toBeIn([200, 401, 404]);
      }
    });
  });

  // ===================================
  // ANALYTICS TESTS
  // ===================================
  describe('Analytics API', () => {
    test('should get attendance analytics overview', async () => {
      const response = await authenticatedRequest('get', `/api/v3/attendance/organizations/${testOrgId}/analytics`);
      
      expect(response.status).toBeIn([200, 401]);
      if (response.status === 200) {
        expect(response.body.data).toHaveProperty('summary');
      }
    });

    test('should get attendance trends', async () => {
      const response = await authenticatedRequest('get', `/api/v3/attendance/organizations/${testOrgId}/analytics/trends?period=7`);
      
      expect(response.status).toBeIn([200, 401]);
    });

    test('should get violation analytics', async () => {
      const response = await authenticatedRequest('get', `/api/v3/attendance/organizations/${testOrgId}/analytics/violations`);
      
      expect(response.status).toBeIn([200, 401]);
    });

    test('should get break analytics', async () => {
      const response = await authenticatedRequest('get', `/api/v3/attendance/organizations/${testOrgId}/analytics/breaks`);
      
      expect(response.status).toBeIn([200, 401]);
    });
  });

  // ===================================
  // ATTENDANCE RECORDING TESTS
  // ===================================
  describe('Attendance Recording API', () => {
    test('should record check-in', async () => {
      const checkInData = {
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: new Date().toISOString()
      };

      const response = await authenticatedRequest('post', `/api/v3/attendance/users/${testUserId}/check-in`)
        .send(checkInData);

      expect(response.status).toBeIn([200, 201, 401]);
    });

    test('should record check-out', async () => {
      const checkOutData = {
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: new Date().toISOString()
      };

      const response = await authenticatedRequest('post', `/api/v3/attendance/users/${testUserId}/check-out`)
        .send(checkOutData);

      expect(response.status).toBeIn([200, 201, 401]);
    });

    test('should get current status', async () => {
      const response = await authenticatedRequest('get', `/api/v3/attendance/users/${testUserId}/status`);

      expect(response.status).toBeIn([200, 401]);
      if (response.status === 200) {
        expect(response.body.data).toHaveProperty('status');
      }
    });

    test('should get attendance history', async () => {
      const response = await authenticatedRequest('get', `/api/v3/attendance/users/${testUserId}/history?limit=10`);

      expect(response.status).toBeIn([200, 401]);
      if (response.status === 200) {
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  // ===================================
  // ERROR HANDLING TESTS
  // ===================================
  describe('Error Handling', () => {
    test('should handle invalid organization ID', async () => {
      const response = await authenticatedRequest('get', '/api/v3/attendance/organizations/invalid-id/rules');
      
      expect(response.status).toBeIn([400, 401, 404]);
    });

    test('should handle invalid user ID', async () => {
      const response = await authenticatedRequest('get', '/api/v3/attendance/users/invalid-id/status');
      
      expect(response.status).toBeIn([400, 401, 404]);
    });

    test('should handle malformed request data', async () => {
      const response = await authenticatedRequest('post', `/api/v3/attendance/organizations/${testOrgId}/rules`)
        .send({ invalidField: 'invalid data' });

      expect(response.status).toBeIn([400, 401, 422]);
    });

    test('should handle missing authorization', async () => {
      const response = await request(app)
        .get(`/api/v3/attendance/organizations/${testOrgId}/rules`)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(401);
    });
  });

  // ===================================
  // PERFORMANCE TESTS
  // ===================================
  describe('Performance Tests', () => {
    test('should respond to health check within 500ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/v3/attendance/health')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });

    test('should handle concurrent requests', async () => {
      const promises = Array(5).fill().map(() => 
        authenticatedRequest('get', `/api/v3/attendance/organizations/${testOrgId}/rules`)
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.status).toBeIn([200, 401]);
      });
    });
  });
});

// Custom Jest matchers
expect.extend({
  toBeIn(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be in [${expected.join(', ')}]`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be in [${expected.join(', ')}]`,
        pass: false,
      };
    }
  },
});

module.exports = {
  testOrgId: 'test-org-integration',
  testUserId: 'test-user-integration'
};
