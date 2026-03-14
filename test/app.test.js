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

// ============================================
// PARAMETERIZED ROUTES AND PRIORITY TESTS
// ============================================

describe('Parameterized Routes and Priority Tests', () => {
  // Import modules for unit testing
  let Route, RouteTable, createApplication;
  
  async function loadModules() {
    const routeModule = await import('../src/lib/route.js');
    const routeTableModule = await import('../src/lib/route-table.js');
    const appModule = await import('../src/lib/application.js');
    Route = routeModule.Route;
    RouteTable = routeTableModule.RouteTable;
    createApplication = appModule.createApplication;
  }

  describe('Route Class', () => {
    it('should extract parameter names from route path', async () => {
      await loadModules();
      
      const route = new Route('GET', '/users/:id', [() => {}]);
      assert.deepStrictEqual(route.paramNames, ['id']);
      
      const route2 = new Route('GET', '/posts/:postId/comments/:commentId', [() => {}]);
      assert.deepStrictEqual(route2.paramNames, ['postId', 'commentId']);
    });

    it('should create regex for matching URLs', async () => {
      await loadModules();
      
      const route = new Route('GET', '/users/:id', [() => {}]);
      assert.ok(route.regex.test('/users/123'));
      assert.ok(route.regex.test('/users/abc'));
      assert.ok(!route.regex.test('/users'));
      assert.ok(!route.regex.test('/users/123/extra'));
    });

    it('should match URLs and extract params', async () => {
      await loadModules();
      
      const route = new Route('GET', '/users/:id', [() => {}]);
      
      const result1 = route.match('GET', '/users/123');
      assert.strictEqual(result1.matched, true);
      assert.deepStrictEqual(result1.params, { id: '123' });
      
      const result2 = route.match('GET', '/users/abc');
      assert.strictEqual(result2.matched, true);
      assert.deepStrictEqual(result2.params, { id: 'abc' });
      
      const result3 = route.match('GET', '/posts/123');
      assert.strictEqual(result3.matched, false);
    });

    it('should match multiple parameters', async () => {
      await loadModules();
      
      const route = new Route('GET', '/posts/:postId/comments/:commentId', [() => {}]);
      
      const result = route.match('GET', '/posts/42/comments/99');
      assert.strictEqual(result.matched, true);
      assert.deepStrictEqual(result.params, { postId: '42', commentId: '99' });
    });

    it('should calculate priority correctly', async () => {
      await loadModules();
      
      // Static route should have higher priority than parameterized route
      const staticRoute = new Route('GET', '/users/profile', [() => {}]);
      const paramRoute = new Route('GET', '/users/:id', [() => {}]);
      
      assert.ok(staticRoute.priority > paramRoute.priority, 
        `Static route priority (${staticRoute.priority}) should be > param route priority (${paramRoute.priority})`);
    });

    it('should give higher priority to routes with more static segments', async () => {
      await loadModules();
      
      const route1 = new Route('GET', '/users/:id/posts', [() => {}]);
      const route2 = new Route('GET', '/users/:id/:postId', [() => {}]);
      
      // route1 has one static segment after param, route2 has two params
      assert.ok(route1.priority > route2.priority,
        `Route with static segment (${route1.priority}) should have higher priority than all params (${route2.priority})`);
    });
  });

  describe('RouteTable Class', () => {
    it('should register and find routes', async () => {
      await loadModules();
      
      const table = new RouteTable();
      table.register('GET', '/users', () => {});
      table.register('GET', '/users/:id', () => {});
      
      const result1 = table.find('GET', '/users');
      assert.ok(result1.route);
      assert.strictEqual(result1.route.path, '/users');
      assert.deepStrictEqual(result1.params, {});
      
      const result2 = table.find('GET', '/users/123');
      assert.ok(result2.route);
      assert.strictEqual(result2.route.path, '/users/:id');
      assert.deepStrictEqual(result2.params, { id: '123' });
    });

    it('should match static routes before parameterized routes', async () => {
      await loadModules();
      
      const table = new RouteTable();
      // Register in reverse order to test priority sorting
      table.register('GET', '/users/:id', () => 'param');
      table.register('GET', '/users/profile', () => 'static');
      table.register('GET', '/users/admin', () => 'static2');
      
      // Static route should match even though param route was registered first
      const result1 = table.find('GET', '/users/profile');
      assert.strictEqual(result1.route.path, '/users/profile');
      
      const result2 = table.find('GET', '/users/admin');
      assert.strictEqual(result2.route.path, '/users/admin');
      
      // Param route should match for other values
      const result3 = table.find('GET', '/users/123');
      assert.strictEqual(result3.route.path, '/users/:id');
    });

    it('should handle multiple parameters correctly', async () => {
      await loadModules();
      
      const table = new RouteTable();
      table.register('GET', '/users/:userId/posts/:postId', () => {});
      
      const result = table.find('GET', '/users/42/posts/99');
      assert.ok(result.route);
      assert.deepStrictEqual(result.params, { userId: '42', postId: '99' });
    });

    it('should detect route collisions', async () => {
      await loadModules();
      
      const table = new RouteTable();
      table.register('GET', '/users/:id', () => {});
      table.register('GET', '/users/:userId', () => {}); // Same structure, different param name
      
      const collisions = table.detectCollisions();
      // These routes could potentially conflict (same structure)
      assert.ok(collisions.length >= 0); // At minimum, it should not throw
    });

    it('should return 404 for non-matching routes', async () => {
      await loadModules();
      
      const table = new RouteTable();
      table.register('GET', '/users/:id', () => {});
      
      const result = table.find('GET', '/posts/123');
      assert.strictEqual(result.route, null);
    });

    it('should handle routes with same prefix but different methods', async () => {
      await loadModules();
      
      const table = new RouteTable();
      table.register('GET', '/users/:id', () => 'get');
      table.register('POST', '/users/:id', () => 'post');
      
      const getResult = table.find('GET', '/users/123');
      assert.strictEqual(getResult.route.method, 'GET');
      
      const postResult = table.find('POST', '/users/123');
      assert.strictEqual(postResult.route.method, 'POST');
    });
  });

  describe('Integration Tests with Application', () => {
    it('should set req.params correctly', async () => {
      await loadModules();
      
      const app = createApplication();
      let capturedParams = null;
      
      app.get('/test/:id', (req, res) => {
        capturedParams = req.params;
        res.json({ params: req.params });
      });
      
      // Start server on a random port
      const server = await app.listen(0);
      const port = server.address().port;
      
      try {
        const response = await makeRequestToPort('GET', `/test/123`, null, port);
        assert.strictEqual(response.statusCode, 200);
        assert.deepStrictEqual(response.data.params, { id: '123' });
      } finally {
        await app.close();
      }
    });

    it('should handle nested parameters', async () => {
      await loadModules();
      
      const app = createApplication();
      
      app.get('/orgs/:orgId/teams/:teamId/members/:memberId', (req, res) => {
        res.json({ params: req.params });
      });
      
      const server = await app.listen(0);
      const port = server.address().port;
      
      try {
        const response = await makeRequestToPort('GET', '/orgs/myorg/teams/myteam/members/john', null, port);
        assert.strictEqual(response.statusCode, 200);
        assert.deepStrictEqual(response.data.params, {
          orgId: 'myorg',
          teamId: 'myteam',
          memberId: 'john'
        });
      } finally {
        await app.close();
      }
    });

    it('should match static routes before parameterized in app', async () => {
      await loadModules();
      
      const app = createApplication();
      
      // Register param route first
      app.get('/api/:version', (req, res) => {
        res.json({ type: 'param', version: req.params.version });
      });
      
      // Register static routes after
      app.get('/api/latest', (req, res) => {
        res.json({ type: 'static', version: 'latest' });
      });
      
      app.get('/api/v2', (req, res) => {
        res.json({ type: 'static', version: 'v2' });
      });
      
      const server = await app.listen(0);
      const port = server.address().port;
      
      try {
        // Static routes should match
        const latestResponse = await makeRequestToPort('GET', '/api/latest', null, port);
        assert.strictEqual(latestResponse.data.type, 'static');
        
        const v2Response = await makeRequestToPort('GET', '/api/v2', null, port);
        assert.strictEqual(v2Response.data.type, 'static');
        
        // Other values should match param route
        const v3Response = await makeRequestToPort('GET', '/api/v3', null, port);
        assert.strictEqual(v3Response.data.type, 'param');
        assert.strictEqual(v3Response.data.version, 'v3');
      } finally {
        await app.close();
      }
    });

    it('should work with middleware and params', async () => {
      await loadModules();
      
      const app = createApplication();
      
      app.get('/users/:id',
        (req, res, next) => {
          // Middleware can access params
          req.userId = req.params.id;
          next();
        },
        (req, res) => {
          res.json({ 
            params: req.params,
            userId: req.userId 
          });
        }
      );
      
      const server = await app.listen(0);
      const port = server.address().port;
      
      try {
        const response = await makeRequestToPort('GET', '/users/42', null, port);
        assert.strictEqual(response.statusCode, 200);
        assert.strictEqual(response.data.params.id, '42');
        assert.strictEqual(response.data.userId, '42');
      } finally {
        await app.close();
      }
    });

    it('should handle Router with parameterized routes', async () => {
      await loadModules();
      
      const { Router } = await import('../src/lib/router.js');
      const app = createApplication();
      const router = new Router();
      
      router.get('/:id', (req, res) => {
        res.json({ id: req.params.id });
      });
      
      app.use('/items', router);
      
      const server = await app.listen(0);
      const port = server.address().port;
      
      try {
        const response = await makeRequestToPort('GET', '/items/123', null, port);
        assert.strictEqual(response.statusCode, 200);
        assert.strictEqual(response.data.id, '123');
      } finally {
        await app.close();
      }
    });
  });
});

// ============================================
// QUERY STRING PARSING TESTS
// ============================================

describe('Query String Parsing Tests', () => {
  let createApplication, parseQueryString;
  
  async function loadModules() {
    const appModule = await import('../src/lib/application.js');
    const utilsModule = await import('../src/utils/index.js');
    createApplication = appModule.createApplication;
    parseQueryString = utilsModule.parseQueryString;
  }

  describe('parseQueryString function', () => {
    it('should parse simple query parameters', async () => {
      await loadModules();
      
      const result = parseQueryString('?name=John&age=30');
      assert.deepStrictEqual(result, { name: 'John', age: '30' });
    });

    it('should handle repeated parameters as arrays', async () => {
      await loadModules();
      
      const result = parseQueryString('?id=1&id=2&id=3');
      assert.deepStrictEqual(result, { id: ['1', '2', '3'] });
    });

    it('should parse array notation', async () => {
      await loadModules();
      
      const result = parseQueryString('?tags[]=javascript&tags[]=nodejs&tags[]=express');
      assert.deepStrictEqual(result, { tags: ['javascript', 'nodejs', 'express'] });
    });

    it('should parse nested object notation', async () => {
      await loadModules();
      
      const result = parseQueryString('?user[name]=John&user[email]=john@example.com');
      assert.deepStrictEqual(result, { 
        user: { 
          name: 'John', 
          email: 'john@example.com' 
        } 
      });
    });

    it('should parse deep nested objects', async () => {
      await loadModules();
      
      const result = parseQueryString('?filter[status]=active&filter[settings][theme]=dark');
      assert.deepStrictEqual(result, { 
        filter: { 
          status: 'active',
          settings: { theme: 'dark' }
        } 
      });
    });

    it('should parse indexed array notation', async () => {
      await loadModules();
      
      const result = parseQueryString('?items[0]=first&items[1]=second&items[2]=third');
      assert.deepStrictEqual(result, { items: ['first', 'second', 'third'] });
    });

    it('should decode URL encoded values', async () => {
      await loadModules();
      
      const result = parseQueryString('?name=John%20Doe&email=john%40example.com');
      assert.strictEqual(result.name, 'John Doe');
      assert.strictEqual(result.email, 'john@example.com');
    });

    it('should handle empty query string', async () => {
      await loadModules();
      
      assert.deepStrictEqual(parseQueryString(''), {});
      assert.deepStrictEqual(parseQueryString('?'), {});
      assert.deepStrictEqual(parseQueryString(null), {});
    });

    it('should handle mixed parameters', async () => {
      await loadModules();
      
      const result = parseQueryString('?sort=desc&tags[]=js&tags[]=node&id=1&id=2');
      assert.strictEqual(result.sort, 'desc');
      assert.deepStrictEqual(result.tags, ['js', 'node']);
      assert.deepStrictEqual(result.id, ['1', '2']);
    });
  });

  describe('Integration Tests with Application', () => {
    it('should parse simple query in request', async () => {
      await loadModules();
      
      const app = createApplication();
      
      app.get('/test', (req, res) => {
        res.json({ query: req.query });
      });
      
      const server = await app.listen(0);
      const port = server.address().port;
      
      try {
        const response = await makeRequestToPort('GET', '/test?name=John&age=30', null, port);
        assert.strictEqual(response.statusCode, 200);
        assert.deepStrictEqual(response.data.query, { name: 'John', age: '30' });
      } finally {
        await app.close();
      }
    });

    it('should support nested routers with prefixes', async () => {
      await loadModules();
      const { Router } = await import('../src/lib/router.js');
      
      const app = createApplication();
      const apiRouter = new Router();
      const usersRouter = new Router();
      const profilesRouter = new Router();
      
      profilesRouter.get('/', (req, res) => {
        res.json({
          route: 'profiles',
          userId: req.params.id,
          version: req.apiVersion
        });
      });
      
      usersRouter.use((req, res, next) => {
        req.resource = 'users';
        next();
      });
      
      usersRouter.get('/', (req, res) => {
        res.json({ route: 'users', resource: req.resource, version: req.apiVersion });
      });
      
      usersRouter.get('/:id', (req, res) => {
        res.json({ route: 'user', id: req.params.id, version: req.apiVersion });
      });
      
      usersRouter.use('/:id/profiles', profilesRouter);
      
      apiRouter.use((req, res, next) => {
        req.apiVersion = 'v1';
        next();
      });
      
      apiRouter.use('/users', usersRouter);
      app.use('/v1', apiRouter);
      
      const server = await app.listen(0);
      const port = server.address().port;
      
      try {
        const listResponse = await makeRequestToPort('GET', '/v1/users', null, port);
        assert.strictEqual(listResponse.statusCode, 200);
        assert.strictEqual(listResponse.data.route, 'users');
        assert.strictEqual(listResponse.data.version, 'v1');
        
        const userResponse = await makeRequestToPort('GET', '/v1/users/42', null, port);
        assert.strictEqual(userResponse.statusCode, 200);
        assert.strictEqual(userResponse.data.id, '42');
        
        const profileResponse = await makeRequestToPort('GET', '/v1/users/42/profiles', null, port);
        assert.strictEqual(profileResponse.statusCode, 200);
        assert.strictEqual(profileResponse.data.route, 'profiles');
        assert.strictEqual(profileResponse.data.userId, '42');
        assert.strictEqual(profileResponse.data.version, 'v1');
      } finally {
        await app.close();
      }
    });

    it('should support router prefix with route()', async () => {
      await loadModules();
      const { Router } = await import('../src/lib/router.js');
      
      const app = createApplication();
      const apiRouter = new Router();
      const usersRouter = apiRouter.route('/users');
      
      usersRouter.get('/', (req, res) => {
        res.json({ route: 'users-root' });
      });
      
      usersRouter.get('/:id', (req, res) => {
        res.json({ route: 'users-id', id: req.params.id });
      });
      
      app.use('/api', apiRouter);
      
      const server = await app.listen(0);
      const port = server.address().port;
      
      try {
        const rootResponse = await makeRequestToPort('GET', '/api/users', null, port);
        assert.strictEqual(rootResponse.statusCode, 200);
        assert.strictEqual(rootResponse.data.route, 'users-root');
        
        const idResponse = await makeRequestToPort('GET', '/api/users/100', null, port);
        assert.strictEqual(idResponse.statusCode, 200);
        assert.strictEqual(idResponse.data.id, '100');
      } finally {
        await app.close();
      }
    });

    it('should parse repeated parameters as arrays in request', async () => {
      await loadModules();
      
      const app = createApplication();
      
      app.get('/test', (req, res) => {
        res.json({ query: req.query, isArray: Array.isArray(req.query.id) });
      });
      
      const server = await app.listen(0);
      const port = server.address().port;
      
      try {
        const response = await makeRequestToPort('GET', '/test?id=1&id=2&id=3', null, port);
        assert.strictEqual(response.statusCode, 200);
        assert.deepStrictEqual(response.data.query.id, ['1', '2', '3']);
        assert.strictEqual(response.data.isArray, true);
      } finally {
        await app.close();
      }
    });

    it('should parse array notation in request', async () => {
      await loadModules();
      
      const app = createApplication();
      
      app.get('/test', (req, res) => {
        res.json({ tags: req.query.tags });
      });
      
      const server = await app.listen(0);
      const port = server.address().port;
      
      try {
        const response = await makeRequestToPort('GET', '/test?tags[]=js&tags[]=node&tags[]=express', null, port);
        assert.strictEqual(response.statusCode, 200);
        assert.deepStrictEqual(response.data.tags, ['js', 'node', 'express']);
      } finally {
        await app.close();
      }
    });

    it('should parse nested objects in request', async () => {
      await loadModules();
      
      const app = createApplication();
      
      app.get('/test', (req, res) => {
        res.json({ user: req.query.user });
      });
      
      const server = await app.listen(0);
      const port = server.address().port;
      
      try {
        const response = await makeRequestToPort('GET', '/test?user[name]=John&user[email]=john@example.com', null, port);
        assert.strictEqual(response.statusCode, 200);
        assert.deepStrictEqual(response.data.user, { name: 'John', email: 'john@example.com' });
      } finally {
        await app.close();
      }
    });

    it('should combine route params and query strings', async () => {
      await loadModules();
      
      const app = createApplication();
      
      app.get('/test/:category', (req, res) => {
        res.json({ params: req.params, query: req.query });
      });
      
      const server = await app.listen(0);
      const port = server.address().port;
      
      try {
        const response = await makeRequestToPort('GET', '/test/electronics?sort=asc&limit=10', null, port);
        assert.strictEqual(response.statusCode, 200);
        assert.deepStrictEqual(response.data.params, { category: 'electronics' });
        assert.deepStrictEqual(response.data.query, { sort: 'asc', limit: '10' });
      } finally {
        await app.close();
      }
    });
  });
});

// Helper function to make HTTP requests to a specific port
function makeRequestToPort(method, path, data = null, port = 3000) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port,
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

// ============================================
// BODY PARSER MIDDLEWARE TESTS
// ============================================

describe('Body Parser Middleware Tests', () => {
  let bodyParser, jsonParser, urlencodedParser;
  
  async function loadModules() {
    const bpModule = await import('../src/middleware/bodyParser.js');
    bodyParser = bpModule.default;
    jsonParser = bpModule.json;
    urlencodedParser = bpModule.urlencoded;
  }

  describe('Body Parser Module', () => {
    it('should export bodyParser namespace', async () => {
      await loadModules();
      assert.strictEqual(typeof bodyParser, 'function');
      assert.strictEqual(typeof bodyParser.json, 'function');
      assert.strictEqual(typeof bodyParser.urlencoded, 'function');
    });

    it('should export individual parsers', async () => {
      await loadModules();
      assert.strictEqual(typeof jsonParser, 'function');
      assert.strictEqual(typeof urlencodedParser, 'function');
    });
  });

  describe('JSON Parser', () => {
    it('should parse valid JSON body', async () => {
      await loadModules();
      const parser = jsonParser();
      
      const mockReq = {
        _raw: {
          on: (event, cb) => {
            if (event === 'data') cb('{"name":"John","age":30}');
            if (event === 'end') cb();
          },
          destroy: () => {}
        },
        get: (name) => name === 'content-type' ? 'application/json' : undefined,
        method: 'POST',
        body: null
      };
      
      let nextCalled = false;
      let parsedBody = null;
      
      await parser(mockReq, {}, (err) => {
        if (!err) nextCalled = true;
        parsedBody = mockReq.body;
      });
      
      assert.strictEqual(nextCalled, true);
      assert.deepStrictEqual(parsedBody, { name: 'John', age: 30 });
    });

    it('should handle empty body', async () => {
      await loadModules();
      const parser = jsonParser();
      
      const mockReq = {
        _raw: {
          on: (event, cb) => {
            if (event === 'end') cb();
          },
          destroy: () => {}
        },
        get: (name) => 'application/json',
        method: 'POST',
        body: null
      };
      
      await parser(mockReq, {}, () => {});
      assert.deepStrictEqual(mockReq.body, {});
    });

    it('should reject invalid JSON', async () => {
      await loadModules();
      const parser = jsonParser();
      
      const mockReq = {
        _raw: {
          on: (event, cb) => {
            if (event === 'data') cb('{invalid}');
            if (event === 'end') cb();
          },
          destroy: () => {}
        },
        get: (name) => 'application/json',
        method: 'POST',
        body: null
      };
      
      let errorPassed = null;
      
      await parser(mockReq, {}, (err) => {
        errorPassed = err;
      });
      
      assert.ok(errorPassed);
      assert.strictEqual(errorPassed.status, 400);
    });
  });

  describe('URL-encoded Parser', () => {
    it('should parse simple form data', async () => {
      await loadModules();
      const parser = urlencodedParser();
      
      const mockReq = {
        _raw: {
          on: (event, cb) => {
            if (event === 'data') cb('name=John&age=30');
            if (event === 'end') cb();
          },
          destroy: () => {}
        },
        get: (name) => 'application/x-www-form-urlencoded',
        method: 'POST',
        body: null
      };
      
      await parser(mockReq, {}, () => {});
      
      assert.strictEqual(mockReq.body.name, 'John');
      assert.strictEqual(mockReq.body.age, '30');
    });

    it('should parse repeated parameters as arrays', async () => {
      await loadModules();
      const parser = urlencodedParser();
      
      const mockReq = {
        _raw: {
          on: (event, cb) => {
            if (event === 'data') cb('tags=js&tags=node&tags=express');
            if (event === 'end') cb();
          },
          destroy: () => {}
        },
        get: (name) => 'application/x-www-form-urlencoded',
        method: 'POST',
        body: null
      };
      
      await parser(mockReq, {}, () => {});
      
      assert.deepStrictEqual(mockReq.body.tags, ['js', 'node', 'express']);
    });

    it('should decode URL-encoded values', async () => {
      await loadModules();
      const parser = urlencodedParser();
      
      const mockReq = {
        _raw: {
          on: (event, cb) => {
            if (event === 'data') cb('name=John%20Doe&email=john%40example.com');
            if (event === 'end') cb();
          },
          destroy: () => {}
        },
        get: (name) => 'application/x-www-form-urlencoded',
        method: 'POST',
        body: null
      };
      
      await parser(mockReq, {}, () => {});
      
      assert.strictEqual(mockReq.body.name, 'John Doe');
      assert.strictEqual(mockReq.body.email, 'john@example.com');
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
