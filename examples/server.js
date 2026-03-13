/**
 * grokexpress - Comprehensive Middleware Demo
 * 
 * This example demonstrates ALL middleware types:
 * 1. Global Middleware - runs on every request
 * 2. Path-specific Middleware - runs for matching paths
 * 3. Route-level (Inline) Middleware - specific to individual routes
 * 4. Error Handler Middleware - handles errors (4 parameters)
 * 5. Router with Middleware - mounted routers with their own middleware
 * 
 * Execution Order:
 * 1. Global Middleware (app.use(fn))
 * 2. Path-specific Middleware (app.use('/path', fn))
 * 3. Route Inline Middleware (app.get('/path', mw, handler))
 * 4. Error Handlers (app.use((err, req, res, next) => {}))
 */

import createApplication, { Router } from '../src/lib/index.js';

// ============================================
// Create the application
// ============================================
const app = createApplication();

// Track middleware execution for demonstration
const executionLog = [];

function logExecution(type, name, path) {
  const entry = { type, name, path, time: Date.now() };
  executionLog.push(entry);
  console.log(`[${type}] ${name} - ${path}`);
}

// ============================================
// 1. GLOBAL MIDDLEWARE
// Runs on EVERY request
// ============================================

/**
 * Global Middleware 1: Request Logger
 * Logs all incoming requests
 */
app.use((req, res, next) => {
  logExecution('GLOBAL', 'Request Logger', req.path);
  req.requestId = `req_${Date.now()}`;
  req.startTime = Date.now();
  next();
});

/**
 * Global Middleware 2: CORS Headers
 * Adds CORS headers to all responses
 */
app.use((req, res, next) => {
  logExecution('GLOBAL', 'CORS Headers', req.path);
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  next();
});

/**
 * Global Middleware 3: Security Headers
 * Adds security headers
 */
app.use((req, res, next) => {
  logExecution('GLOBAL', 'Security Headers', req.path);
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });
  next();
});

// ============================================
// 2. PATH-SPECIFIC MIDDLEWARE
// Only runs when path matches
// ============================================

/**
 * Path Middleware: /api/*
 * API-specific middleware
 */
app.use('/api', (req, res, next) => {
  logExecution('PATH', 'API Middleware', req.path);
  req.apiVersion = 'v1';
  req.isApiRequest = true;
  next();
});

/**
 * Path Middleware: /admin/*
 * Admin authentication check
 */
app.use('/admin', (req, res, next) => {
  logExecution('PATH', 'Admin Auth Check', req.path);
  
  const authHeader = req.get('authorization');
  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin access requires authentication',
      path: req.path
    });
  }
  
  req.user = { id: 1, role: 'admin', name: 'Admin User' };
  next();
});

/**
 * Path Middleware: /public/*
 * Public file serving simulation
 */
app.use('/public', (req, res, next) => {
  logExecution('PATH', 'Public Files', req.path);
  req.isPublic = true;
  next();
});

// ============================================
// 3. ROUTES WITH INLINE MIDDLEWARE
// Middleware specific to individual routes
// ============================================

/**
 * Route: GET /
 * No inline middleware (simple route)
 */
app.get('/', (req, res) => {
  res.json({
    message: 'grokexpress Middleware Demo',
    description: 'Demonstrates all middleware types',
    middlewareTypes: [
      { type: 'Global', description: 'Runs on every request', count: 3 },
      { type: 'Path-specific', description: 'Runs for matching paths', paths: ['/api/*', '/admin/*', '/public/*'] },
      { type: 'Route-level (Inline)', description: 'Specific to individual routes' },
      { type: 'Error Handler', description: 'Handles errors (4 params)' }
    ],
    endpoints: [
      { method: 'GET', path: '/', description: 'This endpoint' },
      { method: 'GET', path: '/simple', description: 'Simple route' },
      { method: 'GET', path: '/with-middleware', description: 'Route with 1 inline middleware' },
      { method: 'GET', path: '/multi-middleware', description: 'Route with 3 inline middleware' },
      { method: 'GET', path: '/api/users', description: 'API route with path middleware' },
      { method: 'GET', path: '/api/users/:id', description: 'API route with params + inline middleware' },
      { method: 'GET', path: '/admin/dashboard', description: 'Admin route (requires auth)' },
      { method: 'GET', path: '/public/file.txt', description: 'Public file route' },
      { method: 'POST', path: '/users', description: 'POST with validation middleware' },
      { method: 'GET', path: '/error-test', description: 'Trigger error for error handler test' },
      { method: 'GET', path: '/router-test', description: 'Router with its own middleware' }
    ]
  });
});

/**
 * Route: GET /simple
 * Simple route without inline middleware
 */
app.get('/simple', (req, res) => {
  res.json({
    message: 'Simple route',
    middlewareExecuted: 'Global + Path (if applicable)',
    requestId: req.requestId
  });
});

/**
 * Route: GET /with-middleware
 * Route with 1 inline middleware
 */
app.get('/with-middleware',
  // Inline Middleware: Add custom header
  (req, res, next) => {
    logExecution('INLINE', 'Custom Header', req.path);
    res.set('X-Custom-Header', 'Added by inline middleware');
    req.customData = 'from middleware';
    next();
  },
  // Handler
  (req, res) => {
    res.json({
      message: 'Route with single inline middleware',
      customData: req.customData,
      header: res.get('X-Custom-Header')
    });
  }
);

/**
 * Route: GET /multi-middleware
 * Route with multiple inline middleware
 */
app.get('/multi-middleware',
  // Inline Middleware 1: Validate request
  (req, res, next) => {
    logExecution('INLINE', 'Validate Request', req.path);
    req.validated = true;
    next();
  },
  // Inline Middleware 2: Load data
  (req, res, next) => {
    logExecution('INLINE', 'Load Data', req.path);
    req.loadedData = { items: [1, 2, 3], count: 3 };
    next();
  },
  // Inline Middleware 3: Transform data
  (req, res, next) => {
    logExecution('INLINE', 'Transform Data', req.path);
    req.transformedData = req.loadedData.items.map(x => x * 2);
    next();
  },
  // Handler
  (req, res) => {
    res.json({
      message: 'Route with multiple inline middleware',
      validated: req.validated,
      loadedData: req.loadedData,
      transformedData: req.transformedData
    });
  }
);

// ============================================
// API ROUTES (with /api path middleware)
// ============================================

/**
 * Route: GET /api/users
 * Uses path middleware from app.use('/api', ...)
 */
app.get('/api/users', (req, res) => {
  res.json({
    message: 'API endpoint',
    apiVersion: req.apiVersion,
    isApiRequest: req.isApiRequest,
    users: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ]
  });
});

/**
 * Route: GET /api/users/:id
 * Uses path middleware + inline middleware
 */
app.get('/api/users/:id',
  // Inline Middleware: Validate ID
  (req, res, next) => {
    logExecution('INLINE', 'Validate User ID', req.path);
    const { id } = req.params;
    
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'ID must be a number'
      });
    }
    
    req.validatedUserId = id;
    next();
  },
  // Inline Middleware: Load user
  (req, res, next) => {
    logExecution('INLINE', 'Load User', req.path);
    
    const users = {
      '1': { id: 1, name: 'Alice', email: 'alice@example.com' },
      '2': { id: 2, name: 'Bob', email: 'bob@example.com' }
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
  // Handler
  (req, res) => {
    res.json({
      message: 'User found',
      apiVersion: req.apiVersion,
      user: req.user
    });
  }
);

// ============================================
// ADMIN ROUTES (with /admin path middleware)
// ============================================

/**
 * Route: GET /admin/dashboard
 * Protected by admin path middleware
 */
app.get('/admin/dashboard', (req, res) => {
  res.json({
    message: 'Admin Dashboard',
    user: req.user,
    stats: {
      users: 100,
      orders: 500,
      revenue: 50000
    }
  });
});

// ============================================
// PUBLIC ROUTES (with /public path middleware)
// ============================================

/**
 * Route: GET /public/file.txt
 * Uses public path middleware
 */
app.get('/public/file.txt', (req, res) => {
  res.type('text').send('This is a public file');
});

// ============================================
// POST ROUTE WITH VALIDATION MIDDLEWARE
// ============================================

/**
 * Route: POST /users
 * Multiple inline middleware for validation
 */
app.post('/users',
  // Inline Middleware 1: Parse body
  async (req, res, next) => {
    logExecution('INLINE', 'Parse Body', req.path);
    try {
      if (req.is('application/json')) {
        req.body = await req.json();
      }
      next();
    } catch (err) {
      res.status(400).json({ error: 'Invalid JSON' });
    }
  },
  // Inline Middleware 2: Validate fields
  (req, res, next) => {
    logExecution('INLINE', 'Validate Fields', req.path);
    const { name, email } = req.body || {};
    
    if (!name || !email) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Name and email are required'
      });
    }
    
    req.validatedData = { name, email };
    next();
  },
  // Handler
  (req, res) => {
    const newUser = {
      id: Date.now(),
      ...req.validatedData,
      createdAt: new Date().toISOString()
    };
    
    res.status(201).json({
      message: 'User created',
      user: newUser
    });
  }
);

// ============================================
// ERROR TEST ROUTE
// ============================================

/**
 * Route: GET /error-test
 * Triggers an error to test error handler
 */
app.get('/error-test', (req, res, next) => {
  const error = new Error('This is a test error');
  error.status = 400;
  throw error;
});

// ============================================
// 5. ROUTER WITH MIDDLEWARE
// Demonstrates router mounting with middleware
// ============================================

const apiRouter = new Router();

// Router-level middleware
apiRouter.use((req, res, next) => {
  logExecution('ROUTER', 'Router Middleware', req.path);
  req.routerMiddlewareApplied = true;
  next();
});

// Router routes
apiRouter.get('/products', (req, res) => {
  res.json({
    message: 'Products from router',
    routerMiddlewareApplied: req.routerMiddlewareApplied,
    products: [
      { id: 1, name: 'Laptop', price: 999 },
      { id: 2, name: 'Phone', price: 699 }
    ]
  });
});

apiRouter.get('/products/:id',
  // Inline middleware for this route
  (req, res, next) => {
    logExecution('INLINE', 'Validate Product ID', req.path);
    const { id } = req.params;
    if (isNaN(Number(id))) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    next();
  },
  (req, res) => {
    res.json({
      message: 'Product from router',
      productId: req.params.id,
      routerMiddlewareApplied: req.routerMiddlewareApplied
    });
  }
);

// Mount router at /router-test
app.use('/router-test', apiRouter);

// ============================================
// 4. ERROR HANDLER MIDDLEWARE
// Must be registered AFTER all other middleware and routes
// Signature: (err, req, res, next) => {}
// ============================================

/**
 * Error Handler Middleware
 * Catches all errors thrown in middleware or routes
 */
app.use((err, req, res, next) => {
  logExecution('ERROR', 'Error Handler', req.path);
  
  console.error('[ErrorHandler]', err.message);
  
  const status = err.status || err.statusCode || 500;
  
  res.status(status).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: status,
      path: req.path,
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    }
  });
});

// ============================================
// Start Server
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, (address) => {
  console.log(`\n✅ Server started successfully!`);
  console.log(`📍 Listening on: http://localhost:${address.port}`);
  
  console.log(`\n📋 Test Commands:\n`);
  
  console.log('# 1. Global Middleware Tests');
  console.log(`curl http://localhost:${address.port}/`);
  console.log(`curl http://localhost:${address.port}/simple`);
  console.log(`curl -I http://localhost:${address.port}/ 2>/dev/null | grep -E '(X-Content|Access-Control)'`);
  
  console.log('\n# 2. Path-specific Middleware Tests');
  console.log(`curl http://localhost:${address.port}/api/users`);
  console.log(`curl http://localhost:${address.port}/public/file.txt`);
  console.log(`curl http://localhost:${address.port}/admin/dashboard`);
  console.log(`curl -H "Authorization: Bearer token" http://localhost:${address.port}/admin/dashboard`);
  
  console.log('\n# 3. Inline Middleware Tests');
  console.log(`curl http://localhost:${address.port}/with-middleware`);
  console.log(`curl http://localhost:${address.port}/multi-middleware`);
  console.log(`curl http://localhost:${address.port}/api/users/1`);
  console.log(`curl http://localhost:${address.port}/api/users/999`);
  console.log(`curl http://localhost:${address.port}/api/users/abc`);
  
  console.log('\n# 4. POST with Validation');
  console.log(`curl -X POST http://localhost:${address.port}/users -H "Content-Type: application/json" -d '{"name":"John","email":"john@example.com"}'`);
  console.log(`curl -X POST http://localhost:${address.port}/users -H "Content-Type: application/json" -d '{"name":"John"}'`);
  
  console.log('\n# 5. Error Handler Test');
  console.log(`curl http://localhost:${address.port}/error-test`);
  
  console.log('\n# 6. Router with Middleware');
  console.log(`curl http://localhost:${address.port}/router-test/products`);
  console.log(`curl http://localhost:${address.port}/router-test/products/1`);
  console.log(`curl http://localhost:${address.port}/router-test/products/abc`);
  
  console.log('');
});

