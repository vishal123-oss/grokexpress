/**
 * grokexpress Routing System Demo
 * 
 * This example demonstrates the new routing system with:
 * - Route registration methods (get, post, put, delete, patch)
 * - Multiple middleware per route
 * - Route table organization and matching
 * - Path parameters
 */

import createApplication from '../src/lib/index.js';

// ============================================
// Create the application
// ============================================
const app = createApplication();

// ============================================
// Global Middleware (applies to all routes)
// ============================================
app.use((req, res, next) => {
  console.log(`[Global] ${req.method} ${req.path}`);
  req.timestamp = Date.now();
  next();
});

// ============================================
// ROUTE EXAMPLES WITH MULTIPLE MIDDLEWARE
// ============================================

/**
 * Example 1: Simple route (no middleware)
 * app.get('/path', handler)
 */
app.get('/', (req, res) => {
  res.json({
    message: 'grokexpress Routing Demo',
    description: 'Demonstrates route registration with multiple middleware',
    endpoints: [
      { method: 'GET', path: '/', description: 'This endpoint' },
      { method: 'GET', path: '/simple', description: 'Simple route (no middleware)' },
      { method: 'GET', path: '/with-middleware', description: 'Route with 1 middleware' },
      { method: 'GET', path: '/multi-middleware', description: 'Route with 3 middleware' },
      { method: 'GET', path: '/users/:id', description: 'Route with params + middleware' },
      { method: 'POST', path: '/users', description: 'POST with validation middleware' },
      { method: 'PUT', path: '/users/:id', description: 'PUT with auth + validation' },
      { method: 'DELETE', path: '/users/:id', description: 'DELETE with auth middleware' }
    ]
  });
});

/**
 * Example 2: Simple route without middleware
 */
app.get('/simple', (req, res) => {
  res.json({
    message: 'Simple route - no middleware',
    path: req.path,
    timestamp: req.timestamp
  });
});

/**
 * Example 3: Route with single middleware
 * app.get('/path', middleware, handler)
 */
app.get('/with-middleware',
  // Middleware 1: Add custom header
  (req, res, next) => {
    console.log('  [Route Middleware] Adding custom header');
    res.set('X-Custom-Header', 'Hello from middleware');
    next();
  },
  // Final handler
  (req, res) => {
    res.json({
      message: 'Route with single middleware',
      path: req.path,
      customHeader: res.get('X-Custom-Header')
    });
  }
);

/**
 * Example 4: Route with multiple middleware
 * app.get('/path', mw1, mw2, mw3, handler)
 */
app.get('/multi-middleware',
  // Middleware 1: Authentication check (simulated)
  (req, res, next) => {
    console.log('  [MW1] Auth check');
    req.user = { id: 1, name: 'John', role: 'admin' };
    next();
  },
  // Middleware 2: Logging
  (req, res, next) => {
    console.log('  [MW2] Logging request');
    req.logEntry = { path: req.path, user: req.user.name, time: new Date() };
    next();
  },
  // Middleware 3: Data enrichment
  (req, res, next) => {
    console.log('  [MW3] Enriching data');
    req.data = { source: 'middleware-chain', step: 3 };
    next();
  },
  // Final handler
  (req, res) => {
    res.json({
      message: 'Route with multiple middleware',
      path: req.path,
      user: req.user,
      logEntry: req.logEntry,
      data: req.data
    });
  }
);

// ============================================
// ROUTE WITH PARAMETERS + MIDDLEWARE
// ============================================

/**
 * Example 5: Route with path parameters and middleware
 * GET /users/:id
 */
app.get('/users/:id',
  // Middleware: Validate user ID format
  (req, res, next) => {
    console.log('  [User Middleware] Validating user ID');
    const { id } = req.params;
    
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        error: 'Invalid user ID',
        id: id,
        message: 'User ID must be a number'
      });
    }
    
    req.validatedUserId = id;
    next();
  },
  // Middleware: Load user data
  (req, res, next) => {
    console.log('  [User Middleware] Loading user data');
    // Simulate database lookup
    const users = {
      '1': { id: 1, name: 'Alice', email: 'alice@example.com' },
      '2': { id: 2, name: 'Bob', email: 'bob@example.com' },
      '3': { id: 3, name: 'Charlie', email: 'charlie@example.com' }
    };
    
    const user = users[req.validatedUserId];
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        id: req.validatedUserId
      });
    }
    
    req.user = user;
    next();
  },
  // Final handler
  (req, res) => {
    res.json({
      message: 'User found',
      user: req.user,
      validatedId: req.validatedUserId
    });
  }
);

// ============================================
// POST ROUTE WITH VALIDATION MIDDLEWARE
// ============================================

/**
 * Example 6: POST route with validation middleware
 * POST /users
 */
app.post('/users',
  // Middleware 1: Parse JSON body
  async (req, res, next) => {
    console.log('  [POST Middleware] Parsing body');
    try {
      if (req.is('application/json')) {
        req.body = await req.json();
      }
      next();
    } catch (err) {
      res.status(400).json({ error: 'Invalid JSON' });
    }
  },
  // Middleware 2: Validate required fields
  (req, res, next) => {
    console.log('  [POST Middleware] Validating fields');
    const { name, email } = req.body || {};
    
    if (!name || !email) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Name and email are required',
        received: req.body
      });
    }
    
    req.validatedData = { name, email };
    next();
  },
  // Middleware 3: Check email format
  (req, res, next) => {
    console.log('  [POST Middleware] Checking email format');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(req.validatedData.email)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid email format'
      });
    }
    
    next();
  },
  // Final handler: Create user
  (req, res) => {
    const newUser = {
      id: Date.now(),
      ...req.validatedData,
      createdAt: new Date().toISOString()
    };
    
    res.status(201).json({
      message: 'User created successfully',
      user: newUser
    });
  }
);

// ============================================
// PUT ROUTE WITH AUTH + VALIDATION
// ============================================

/**
 * Example 7: PUT route with authentication and validation
 * PUT /users/:id
 */
app.put('/users/:id',
  // Middleware 1: Authenticate (simulated)
  (req, res, next) => {
    console.log('  [PUT Middleware] Authenticating');
    const authHeader = req.get('authorization');
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authorization header required'
      });
    }
    
    req.authUser = { id: 1, name: 'Admin', role: 'admin' };
    next();
  },
  // Middleware 2: Parse body
  async (req, res, next) => {
    console.log('  [PUT Middleware] Parsing body');
    try {
      if (req.is('application/json')) {
        req.body = await req.json();
      }
      next();
    } catch (err) {
      res.status(400).json({ error: 'Invalid JSON' });
    }
  },
  // Middleware 3: Validate update data
  (req, res, next) => {
    console.log('  [PUT Middleware] Validating update data');
    const updates = req.body || {};
    
    // Prevent ID modification
    delete updates.id;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'No valid fields to update'
      });
    }
    
    req.updates = updates;
    next();
  },
  // Final handler
  (req, res) => {
    const { id } = req.params;
    
    res.json({
      message: 'User updated',
      userId: id,
      updates: req.updates,
      updatedBy: req.authUser.name,
      updatedAt: new Date().toISOString()
    });
  }
);

// ============================================
// DELETE ROUTE WITH AUTH MIDDLEWARE
// ============================================

/**
 * Example 8: DELETE route with authentication
 * DELETE /users/:id
 */
app.delete('/users/:id',
  // Middleware: Check admin role
  (req, res, next) => {
    console.log('  [DELETE Middleware] Checking permissions');
    const authHeader = req.get('authorization');
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authorization required'
      });
    }
    
    // Simulate role check
    const user = { role: 'admin' }; // Would decode from token
    
    if (user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required'
      });
    }
    
    req.performingUser = user;
    next();
  },
  // Final handler
  (req, res) => {
    const { id } = req.params;
    
    res.json({
      message: 'User deleted',
      userId: id,
      deletedBy: 'admin',
      deletedAt: new Date().toISOString()
    });
  }
);

// ============================================
// ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
  console.error('[Error Handler]', err.message);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500,
      timestamp: new Date().toISOString(),
      path: req.path
    }
  });
});

// ============================================
// Start Server
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, (address) => {
  console.log(`\n✅ Routing Demo Server started!`);
  console.log(`📍 Listening on: http://localhost:${address.port}`);
  console.log(`\n📋 Test Commands:\n`);
  console.log(`# Simple routes`);
  console.log(`curl http://localhost:${address.port}/`);
  console.log(`curl http://localhost:${address.port}/simple`);
  console.log(`\n# Routes with middleware`);
  console.log(`curl http://localhost:${address.port}/with-middleware`);
  console.log(`curl http://localhost:${address.port}/multi-middleware`);
  console.log(`\n# Routes with params + middleware`);
  console.log(`curl http://localhost:${address.port}/users/1`);
  console.log(`curl http://localhost:${address.port}/users/999`);
  console.log(`curl http://localhost:${address.port}/users/abc`);
  console.log(`\n# POST with validation`);
  console.log(`curl -X POST http://localhost:${address.port}/users -H "Content-Type: application/json" -d '{"name":"John","email":"john@example.com"}'`);
  console.log(`curl -X POST http://localhost:${address.port}/users -H "Content-Type: application/json" -d '{"name":"John"}'`);
  console.log(`curl -X POST http://localhost:${address.port}/users -H "Content-Type: application/json" -d '{"name":"John","email":"invalid"}'`);
  console.log(`\n# PUT with auth + validation`);
  console.log(`curl -X PUT http://localhost:${address.port}/users/1 -H "Content-Type: application/json" -H "Authorization: Bearer token" -d '{"name":"Updated"}'`);
  console.log(`curl -X PUT http://localhost:${address.port}/users/1 -H "Content-Type: application/json" -d '{"name":"Updated"}'`);
  console.log(`\n# DELETE with auth`);
  console.log(`curl -X DELETE http://localhost:${address.port}/users/1 -H "Authorization: Bearer token"`);
  console.log(`curl -X DELETE http://localhost:${address.port}/users/1`);
  console.log(``);
});
