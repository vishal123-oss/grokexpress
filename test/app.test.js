import { describe, it } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

const PORT = 3333;
const BASE_URL = `http://localhost:${PORT}`;

describe('grokexpress Application Tests', () => {

  describe('Home Routes', () => {
    it('should return API info on GET /', async () => {
      const response = await makeRequest('GET', '/');
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.name, 'grokexpress');
      assert.ok(Array.isArray(response.data.endpoints));
    });

    it('should return health status on GET /health', async () => {
      const response = await makeRequest('GET', '/health');
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.status, 'healthy');
      assert.ok(response.data.timestamp);
    });
  });

  describe('User Routes', () => {
    it('should return empty array on GET /users', async () => {
      const response = await makeRequest('GET', '/users');
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.count, 0);
      assert.deepStrictEqual(response.data.users, []);
    });

    it('should create a user on POST /users', async () => {
      const userData = { name: 'John Doe', email: 'john@example.com' };
      const response = await makeRequest('POST', '/users', userData);
      assert.strictEqual(response.statusCode, 201);
      assert.ok(response.data.user.id);
      assert.strictEqual(response.data.user.name, userData.name);
    });

    it('should get a user by id on GET /users/:id', async () => {
      // First create a user
      const userData = { name: 'Jane Doe', email: 'jane@example.com' };
      const createResponse = await makeRequest('POST', '/users', userData);
      const userId = createResponse.data.user.id;

      // Then get the user
      const response = await makeRequest('GET', `/users/${userId}`);
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.user.id, userId);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await makeRequest('GET', '/users/999');
      assert.strictEqual(response.statusCode, 404);
      assert.ok(response.data.error);
    });

    it('should update a user on PUT /users/:id', async () => {
      // Create a user first
      const userData = { name: 'Original', email: 'original@example.com' };
      const createResponse = await makeRequest('POST', '/users', userData);
      const userId = createResponse.data.user.id;

      // Update the user
      const updateData = { name: 'Updated' };
      const response = await makeRequest('PUT', `/users/${userId}`, updateData);
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.user.name, 'Updated');
    });

    it('should delete a user on DELETE /users/:id', async () => {
      // Create a user first
      const userData = { name: 'To Delete', email: 'delete@example.com' };
      const createResponse = await makeRequest('POST', '/users', userData);
      const userId = createResponse.data.user.id;

      // Delete the user
      const deleteResponse = await makeRequest('DELETE', `/users/${userId}`);
      assert.strictEqual(deleteResponse.statusCode, 204);

      // Verify user is deleted
      const getResponse = await makeRequest('GET', `/users/${userId}`);
      assert.strictEqual(getResponse.statusCode, 404);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await makeRequest('GET', '/unknown-route');
      assert.strictEqual(response.statusCode, 404);
      assert.ok(response.data.error);
    });
  });
});

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000, // Default port from config
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsedBody = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            data: parsedBody
          });
        } catch (err) {
          resolve({
            statusCode: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}
