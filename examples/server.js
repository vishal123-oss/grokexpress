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
      { method: 'GET', path: '/error-sync', description: 'Sync error handling test' },
      { method: 'GET', path: '/error-async', description: 'Async rejected promise test' },
      { method: 'GET', path: '/error-next', description: 'next(err) skip middleware test' },
      { method: 'GET', path: '/error-default', description: 'Default error response test' },
      { method: 'GET', path: '/router-test', description: 'Router with its own middleware' },
      // Response methods tests
      { method: 'GET', path: '/response/status', description: 'res.status() test' },
      { method: 'GET', path: '/response/send-status', description: 'res.sendStatus() test' },
      { method: 'GET', path: '/response/send-string', description: 'res.send() string' },
      { method: 'GET', path: '/response/send-object', description: 'res.send() object' },
      { method: 'GET', path: '/response/text', description: 'res.text()' },
      { method: 'GET', path: '/response/html', description: 'res.html()' },
      { method: 'GET', path: '/response/xml', description: 'res.xml()' },
      { method: 'GET', path: '/response/headers', description: 'res.set() / res.get()' },
      { method: 'GET', path: '/response/cookie', description: 'res.cookie()' },
      { method: 'GET', path: '/response/redirect', description: 'res.redirect()' },
      { method: 'GET', path: '/response/format', description: 'res.format()' },
      { method: 'GET', path: '/response/chain', description: 'Method chaining' },
      { method: 'GET', path: '/response/jsonp', description: 'res.jsonp()' }
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
// ERROR TEST ROUTES
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

/**
 * Route: GET /error-sync
 * Throws synchronous error inside middleware
 */
app.get('/error-sync', (req, res, next) => {
  throw new Error('Sync error from middleware');
});

/**
 * Route: GET /error-async
 * Returns rejected promise to test async error handling
 */
app.get('/error-async', async (req, res, next) => {
  throw new Error('Async error (rejected promise)');
});

/**
 * Route: GET /error-next
 * Calls next(err) to skip remaining middleware
 */
app.get('/error-next',
  (req, res, next) => {
    req.beforeError = true;
    next(new Error('Error via next()'));
  },
  (req, res) => {
    res.json({ shouldNotRun: true });
  }
);

/**
 * Route: GET /error-default
 * No custom error handler should catch this (tests default error response)
 */
app.get('/error-default', (req, res, next) => {
  throw new Error('Default error response test');
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
// 6. RESPONSE METHODS TESTS
// Comprehensive tests for all Response methods
// ============================================

/**
 * Test: res.status() and res.json() chaining
 */
app.get('/response/status', (req, res) => {
  res.status(201).json({ message: 'Created', status: 201 });
});

/**
 * Test: res.sendStatus()
 */
app.get('/response/send-status', (req, res) => {
  res.sendStatus(404);
});

/**
 * Test: res.send() with different types
 */
app.get('/response/send-string', (req, res) => {
  res.send('Hello World as plain text');
});

app.get('/response/send-html', (req, res) => {
  res.send('<h1>Hello World</h1><p>This is HTML</p>');
});

app.get('/response/send-object', (req, res) => {
  res.send({ message: 'Auto-converted to JSON', type: 'object' });
});

/**
 * Test: res.text()
 */
app.get('/response/text', (req, res) => {
  res.text('This is plain text response');
});

/**
 * Test: res.html()
 */
app.get('/response/html', (req, res) => {
  res.html('<!DOCTYPE html><html><body><h1>HTML Response</h1></body></html>');
});

/**
 * Test: res.xml()
 */
app.get('/response/xml', (req, res) => {
  res.xml('<?xml version="1.0"?><root><message>Hello XML</message></root>');
});

/**
 * Test: res.type() shorthand
 */
app.get('/response/type', (req, res) => {
  res.type('json').send('{"custom": "json"}');
});

/**
 * Test: res.set() and res.get()
 */
app.get('/response/headers', (req, res) => {
  res.set('X-Custom-Header', 'custom-value');
  res.set({
    'X-Another-Header': 'another-value',
    'X-Request-ID': '12345'
  });
  
  res.json({
    message: 'Headers set',
    'X-Custom-Header': res.get('X-Custom-Header'),
    'X-Another-Header': res.get('X-Another-Header'),
    allHeaders: res.getHeaders()
  });
});

/**
 * Test: res.append()
 */
app.get('/response/append', (req, res) => {
  res.append('X-Multi-Value', 'value1');
  res.append('X-Multi-Value', 'value2');
  res.append('Set-Cookie', 'cookie1=value1');
  res.append('Set-Cookie', 'cookie2=value2');
  
  res.json({ message: 'Headers appended' });
});

/**
 * Test: res.links()
 */
app.get('/response/links', (req, res) => {
  res.links({
    next: 'https://api.example.com/users?page=2',
    last: 'https://api.example.com/users?page=5',
    first: 'https://api.example.com/users?page=1'
  });
  
  res.json({ message: 'Link headers set' });
});

/**
 * Test: res.location()
 */
app.get('/response/location', (req, res) => {
  res.location('/new-path');
  res.json({ message: 'Location header set', location: res.get('Location') });
});

/**
 * Test: res.vary()
 */
app.get('/response/vary', (req, res) => {
  res.vary('Accept');
  res.vary(['Accept-Encoding', 'Accept-Language']);
  res.vary('Accept'); // Duplicate should be ignored
  
  res.json({ message: 'Vary header set', vary: res.get('Vary') });
});

/**
 * Test: res.redirect()
 */
app.get('/response/redirect', (req, res) => {
  res.redirect('/response/redirect-target');
});

app.get('/response/redirect-target', (req, res) => {
  res.json({ message: 'Redirect successful!' });
});

app.get('/response/redirect-301', (req, res) => {
  res.redirect('/response/redirect-target', 301);
});

/**
 * Test: res.cookie() and res.clearCookie()
 */
app.get('/response/cookie', (req, res) => {
  res.cookie('session', 'abc123', { 
    maxAge: 900000, 
    httpOnly: true,
    path: '/',
    sameSite: 'strict'
  });
  res.cookie('preferences', 'dark-mode', { maxAge: 86400000 });
  
  res.json({ message: 'Cookies set' });
});

app.get('/response/clear-cookie', (req, res) => {
  res.clearCookie('session');
  res.json({ message: 'Cookie cleared' });
});

/**
 * Test: res.format() - Content Negotiation
 */
app.get('/response/format', (req, res) => {
  res.format({
    'text/html': () => {
      res.send('<h1>HTML Response</h1>');
    },
    'application/json': () => {
      res.json({ message: 'JSON Response' });
    },
    'text/plain': () => {
      res.text('Plain Text Response');
    },
    default: () => {
      res.status(406).send('Not Acceptable');
    }
  });
});

/**
 * Test: res.attachment()
 */
app.get('/response/attachment', (req, res) => {
  res.attachment('document.pdf');
  res.send('PDF content would go here');
});

/**
 * Test: res.notFound()
 */
app.get('/response/not-found', (req, res) => {
  res.notFound('Custom not found message');
});

/**
 * Test: res.error()
 */
app.get('/response/server-error', (req, res) => {
  res.error('Something went wrong', 500);
});

/**
 * Test: res.hasHeader() and res.removeHeader()
 */
app.get('/response/header-check', (req, res) => {
  res.set('X-Test-Header', 'test-value');
  const hasHeader = res.hasHeader('X-Test-Header');
  res.removeHeader('X-Test-Header');
  const hasAfterRemove = res.hasHeader('X-Test-Header');
  
  res.json({
    hasBeforeRemove: hasHeader,
    hasAfterRemove: hasAfterRemove
  });
});

/**
 * Test: res.locals()
 */
app.get('/response/locals', (req, res) => {
  res.locals('user', { id: 1, name: 'John' });
  res.locals({ timestamp: Date.now(), requestId: 'req-123' });
  
  res.json({
    message: 'Locals set',
    locals: res.getLocals()
  });
});

/**
 * Test: Chaining multiple methods
 */
app.get('/response/chain', (req, res) => {
  res
    .status(201)
    .set('X-Custom', 'value')
    .cookie('test', 'value', { maxAge: 10000 })
    .links({ next: '/next', prev: '/prev' })
    .json({ message: 'All methods chained successfully!' });
});

/**
 * Test: res.end()
 */
app.get('/response/end', (req, res) => {
  res.status(204).end();
});

/**
 * Test: res.jsonp()
 */
app.get('/response/jsonp', (req, res) => {
  res.jsonp({ message: 'JSONP response', data: [1, 2, 3] }, 'myCallback');
});

// ============================================
// 7. QUERY STRING PARSING TESTS
// Demonstrates enhanced query string parsing
// ============================================

/**
 * Test: Simple query parameters
 * GET /query/simple?name=John&age=30
 */
app.get('/query/simple', (req, res) => {
  res.json({
    message: 'Simple query parameters',
    query: req.query,
    name: req.query.name,
    age: req.query.age
  });
});

/**
 * Test: Repeated parameters (converted to array)
 * GET /query/repeated?id=1&id=2&id=3
 */
app.get('/query/repeated', (req, res) => {
  res.json({
    message: 'Repeated parameters become arrays',
    query: req.query,
    id: req.query.id,
    isArray: Array.isArray(req.query.id)
  });
});

/**
 * Test: Array notation
 * GET /query/array?tags[]=javascript&tags[]=nodejs&tags[]=express
 */
app.get('/query/array', (req, res) => {
  res.json({
    message: 'Array notation [] parsing',
    query: req.query,
    tags: req.query.tags,
    isArray: Array.isArray(req.query.tags)
  });
});

/**
 * Test: Nested object notation
 * GET /query/nested?user[name]=John&user[email]=john@example.com&user[age]=25
 */
app.get('/query/nested', (req, res) => {
  res.json({
    message: 'Nested object notation parsing',
    query: req.query,
    user: req.query.user
  });
});

/**
 * Test: Deep nested objects
 * GET /query/deep?filter[status]=active&filter[role]=admin&filter[settings][theme]=dark
 */
app.get('/query/deep', (req, res) => {
  res.json({
    message: 'Deep nested object parsing',
    query: req.query,
    filter: req.query.filter
  });
});

/**
 * Test: Mixed query parameters
 * GET /query/mixed?sort=desc&limit=10&tags[]=js&tags[]=node&filter[status]=active&id=1&id=2
 */
app.get('/query/mixed', (req, res) => {
  res.json({
    message: 'Mixed query parameter types',
    query: req.query,
    types: {
      sort: typeof req.query.sort,
      limit: typeof req.query.limit,
      tags: Array.isArray(req.query.tags) ? 'array' : typeof req.query.tags,
      filter: typeof req.query.filter,
      id: Array.isArray(req.query.id) ? 'array' : typeof req.query.id
    }
  });
});

/**
 * Test: Indexed array notation
 * GET /query/indexed?items[0]=first&items[1]=second&items[2]=third
 */
app.get('/query/indexed', (req, res) => {
  res.json({
    message: 'Indexed array notation',
    query: req.query,
    items: req.query.items
  });
});

/**
 * Test: URL encoded values
 * GET /query/encoded?name=John%20Doe&email=john%40example.com&url=https%3A%2F%2Fexample.com
 */
app.get('/query/encoded', (req, res) => {
  res.json({
    message: 'URL encoded values are decoded',
    query: req.query,
    name: req.query.name,
    email: req.query.email,
    url: req.query.url
  });
});

/**
 * Test: Empty and missing values
 * GET /query/empty?name=&age=&present=value
 */
app.get('/query/empty', (req, res) => {
  res.json({
    message: 'Empty values handling',
    query: req.query,
    name: req.query.name,
    age: req.query.age,
    present: req.query.present
  });
});

/**
 * Test: Combined route params and query strings
 * GET /query/combined/:category?sort=asc&limit=20
 */
app.get('/query/combined/:category', (req, res) => {
  res.json({
    message: 'Combined route params and query strings',
    params: req.params,
    query: req.query,
    category: req.params.category,
    sort: req.query.sort,
    limit: req.query.limit
  });
});

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
  
  console.log('\n# 5. Error Handler Tests');
  console.log(`curl http://localhost:${address.port}/error-test`);
  console.log(`curl http://localhost:${address.port}/error-sync`);
  console.log(`curl http://localhost:${address.port}/error-async`);
  console.log(`curl http://localhost:${address.port}/error-next`);
  console.log(`curl http://localhost:${address.port}/error-default`);
  
  console.log('\n# 6. Router with Middleware');
  console.log(`curl http://localhost:${address.port}/router-test/products`);
  console.log(`curl http://localhost:${address.port}/router-test/products/1`);
  console.log(`curl http://localhost:${address.port}/router-test/products/abc`);
  
  console.log('\n# 7. Response Methods Tests');
  console.log(`curl http://localhost:${address.port}/response/status`);
  console.log(`curl http://localhost:${address.port}/response/send-status`);
  console.log(`curl http://localhost:${address.port}/response/send-string`);
  console.log(`curl http://localhost:${address.port}/response/send-object`);
  console.log(`curl http://localhost:${address.port}/response/text`);
  console.log(`curl http://localhost:${address.port}/response/html`);
  console.log(`curl http://localhost:${address.port}/response/xml`);
  console.log(`curl http://localhost:${address.port}/response/headers`);
  console.log(`curl -I http://localhost:${address.port}/response/cookie`);
  console.log(`curl -L http://localhost:${address.port}/response/redirect`);
  console.log(`curl -H "Accept: application/json" http://localhost:${address.port}/response/format`);
  console.log(`curl -H "Accept: text/html" http://localhost:${address.port}/response/format`);
  console.log(`curl http://localhost:${address.port}/response/chain`);
  console.log(`curl http://localhost:${address.port}/response/jsonp`);
  console.log(`curl http://localhost:${address.port}/response/not-found`);
  console.log(`curl http://localhost:${address.port}/response/server-error`);
  
  console.log('\n# 8. Query String Parsing Tests');
  console.log(`curl 'http://localhost:${address.port}/query/simple?name=John&age=30'`);
  console.log(`curl 'http://localhost:${address.port}/query/repeated?id=1&id=2&id=3'`);
  console.log(`curl 'http://localhost:${address.port}/query/array?tags[]=javascript&tags[]=nodejs&tags[]=express'`);
  console.log(`curl 'http://localhost:${address.port}/query/nested?user[name]=John&user[email]=john@example.com'`);
  console.log(`curl 'http://localhost:${address.port}/query/deep?filter[status]=active&filter[role]=admin&filter[settings][theme]=dark'`);
  console.log(`curl 'http://localhost:${address.port}/query/mixed?sort=desc&limit=10&tags[]=js&tags[]=node&filter[status]=active&id=1&id=2'`);
  console.log(`curl 'http://localhost:${address.port}/query/indexed?items[0]=first&items[1]=second&items[2]=third'`);
  console.log(`curl 'http://localhost:${address.port}/query/encoded?name=John%20Doe&email=john%40example.com'`);
  console.log(`curl 'http://localhost:${address.port}/query/combined/electronics?sort=asc&limit=20'`);
  
  console.log('');
});

