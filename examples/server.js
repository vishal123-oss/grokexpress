/**
 * grokexpress Example Server
 * 
 * This example demonstrates how to use grokexpress to build a REST API
 * with middleware, routing, and error handling.
 * 
 * Middleware Features Demonstrated:
 * - Sync and Async middleware
 * - Middleware execution order
 * - Pipeline stopping when response is sent
 * - Error handling middleware (4 parameters)
 */

import createApplication, { Router } from '../src/lib/index.js';

// ============================================
// Create the application
// ============================================
const app = createApplication();

// ============================================
// MIDDLEWARE TEST CASES
// ============================================

/**
 * TEST 1: Sync Middleware
 * - Synchronous middleware executes immediately
 * - Must call next() to continue to next middleware
 */
app.use((req, res, next) => {
  // Add custom property to request
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[Sync Middleware] Request ID: ${req.requestId}`);
  next(); // Continue to next middleware
});

/**
 * TEST 2: Async Middleware
 * - Async middleware can use await for async operations
 * - Pipeline waits for async middleware to complete
 */
app.use(async (req, res, next) => {
  console.log('[Async Middleware] Processing...');
  
  // Simulate async operation (e.g., database lookup, API call)
  await new Promise(resolve => setTimeout(resolve, 10));
  
  // Add timestamp to request
  req.startTime = Date.now();
  console.log('[Async Middleware] Done');
  
  await next(); // Continue to next middleware
});

/**
 * TEST 3: Middleware Execution Order
 * - Middleware executes in the order it's added
 * - Each middleware can modify request/response before passing to next
 */
app.use((req, res, next) => {
  // Track middleware execution order
  if (!req.middlewareOrder) {
    req.middlewareOrder = [];
  }
  req.middlewareOrder.push('middleware-1');
  console.log('[Order Test] Middleware 1 executed');
  next();
});

app.use((req, res, next) => {
  req.middlewareOrder.push('middleware-2');
  console.log('[Order Test] Middleware 2 executed');
  next();
});

app.use((req, res, next) => {
  req.middlewareOrder.push('middleware-3');
  console.log('[Order Test] Middleware 3 executed');
  next();
});

/**
 * TEST 4: Pipeline Stopping
 * - Middleware can stop the pipeline by sending a response
 * - If response is sent, subsequent middleware/routes are NOT executed
 * 
 * Try: GET /blocked - will stop at blocking middleware
 * Try: GET /not-blocked - will pass through all middleware
 */
app.use('/blocked', (req, res, next) => {
  console.log('[Blocking Middleware] Stopping pipeline here');
  // Response sent WITHOUT calling next() - pipeline stops!
  res.json({
    message: 'Pipeline stopped by middleware',
    requestId: req.requestId,
    middlewareOrder: req.middlewareOrder
  });
  // next() NOT called - pipeline stops here
});

/**
 * TEST 5: Path-specific Middleware
 * - Middleware can be mounted on specific paths
 * - Only executes for matching paths
 */
app.use('/api/admin', (req, res, next) => {
  console.log('[Admin Middleware] Checking admin access...');
  // Simulate auth check
  const authHeader = req.get('authorization');
  if (!authHeader) {
    // Stop pipeline and return error
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authorization header required for admin routes'
    });
  }
  req.isAdmin = true;
  next();
});

// ============================================
// Built-in Middleware
// ============================================

/**
 * Logger Middleware - logs all incoming requests
 */
app.use(async (req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log after response is sent
  res.raw.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  await next();
});

/**
 * JSON Body Parser Middleware - parses JSON request bodies
 */
app.use(async (req, res, next) => {
  if (req.is('application/json') && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      req.body = await req.json();
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }
  await next();
});

/**
 * CORS Middleware - adds CORS headers
 */
app.use(async (req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  await next();
});

// ============================================
// Routes
// ============================================

/**
 * Home Route - API info
 */
app.get('/', (req, res) => {
  res.json({
    name: 'grokexpress',
    version: '1.0.0',
    description: 'A lightweight Express-like Node.js framework',
    requestId: req.requestId,
    middlewareOrder: req.middlewareOrder,
    endpoints: [
      { method: 'GET', path: '/', description: 'API info' },
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'GET', path: '/users', description: 'List all users' },
      { method: 'GET', path: '/users/:id', description: 'Get user by ID' },
      { method: 'POST', path: '/users', description: 'Create user' },
      { method: 'PUT', path: '/users/:id', description: 'Update user' },
      { method: 'DELETE', path: '/users/:id', description: 'Delete user' },
      { method: 'GET', path: '/api/products', description: 'List products (Router)' },
      { method: 'GET', path: '/api/products/:id', description: 'Get product (Router)' },
      // Middleware test endpoints
      { method: 'GET', path: '/blocked', description: 'Test pipeline stopping' },
      { method: 'GET', path: '/not-blocked', description: 'Test full pipeline' },
      { method: 'GET', path: '/api/admin/dashboard', description: 'Admin route (requires auth)' },
      { method: 'GET', path: '/error-test', description: 'Test error handling' },
      { method: 'GET', path: '/async-test', description: 'Test async middleware' }
    ]
  });
});

/**
 * Health Check Route
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    requestId: req.requestId
  });
});

/**
 * Test Route - Not blocked
 * Demonstrates that middleware order is preserved
 */
app.get('/not-blocked', (req, res) => {
  res.json({
    message: 'All middleware executed successfully',
    requestId: req.requestId,
    middlewareOrder: req.middlewareOrder,
    startTime: req.startTime
  });
});

/**
 * Test Route - Error handling
 * Demonstrates error handling with 4-parameter middleware
 */
app.get('/error-test', (req, res, next) => {
  // Trigger an error
  const error = new Error('This is a test error');
  error.status = 400;
  throw error;
});

/**
 * Test Route - Async operation
 * Demonstrates async route handlers
 */
app.get('/async-test', async (req, res) => {
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 100));
  
  res.json({
    message: 'Async operation completed',
    requestId: req.requestId,
    middlewareOrder: req.middlewareOrder,
    processingTime: Date.now() - req.startTime
  });
});

/**
 * Admin Dashboard Route
 * Protected by path-specific middleware
 */
app.get('/api/admin/dashboard', (req, res) => {
  res.json({
    message: 'Welcome to admin dashboard',
    isAdmin: req.isAdmin,
    requestId: req.requestId
  });
});

// ============================================
// In-memory data store (for demo purposes)
// ============================================
const users = new Map();
let userIdCounter = 1;

// Seed some users
users.set('1', { id: '1', name: 'Alice', email: 'alice@example.com' });
users.set('2', { id: '2', name: 'Bob', email: 'bob@example.com' });
userIdCounter = 3;

// ============================================
// User Routes
// ============================================

/**
 * Get all users
 */
app.get('/users', (req, res) => {
  const userList = Array.from(users.values());
  
  // Query parameter filtering
  const { name } = req.query;
  const filtered = name 
    ? userList.filter(u => u.name.toLowerCase().includes(name.toLowerCase()))
    : userList;
  
  res.json({
    users: filtered,
    count: filtered.length,
    total: users.size,
    requestId: req.requestId
  });
});

/**
 * Get user by ID
 */
app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  const user = users.get(id);
  
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      id
    });
  }
  
  res.json({ user, requestId: req.requestId });
});

/**
 * Create new user
 */
app.post('/users', (req, res) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({
      error: 'Name and email are required'
    });
  }
  
  const id = String(userIdCounter++);
  const user = {
    id,
    name,
    email,
    createdAt: new Date().toISOString()
  };
  
  users.set(id, user);
  
  res.status(201).json({
    message: 'User created successfully',
    user,
    requestId: req.requestId
  });
});

/**
 * Update user
 */
app.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const existingUser = users.get(id);
  
  if (!existingUser) {
    return res.status(404).json({
      error: 'User not found',
      id
    });
  }
  
  const updatedUser = {
    ...existingUser,
    ...req.body,
    id, // Prevent ID modification
    updatedAt: new Date().toISOString()
  };
  
  users.set(id, updatedUser);
  
  res.json({
    message: 'User updated successfully',
    user: updatedUser,
    requestId: req.requestId
  });
});

/**
 * Delete user
 */
app.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  
  if (!users.has(id)) {
    return res.status(404).json({
      error: 'User not found',
      id
    });
  }
  
  users.delete(id);
  
  res.status(204).end();
});

// ============================================
// Router Example - Product Routes
// ============================================

const productRouter = new Router();

// In-memory products
const products = new Map([
  ['1', { id: '1', name: 'Laptop', price: 999.99 }],
  ['2', { id: '2', name: 'Phone', price: 699.99 }],
  ['3', { id: '3', name: 'Tablet', price: 499.99 }]
]);

// Product middleware - runs for all product routes
productRouter.use(async (req, res, next) => {
  console.log(`[Product Router] ${req.method} ${req.path}`);
  await next();
});

// Get all products
productRouter.get('/products', (req, res) => {
  res.json({
    products: Array.from(products.values()),
    count: products.size,
    requestId: req.requestId
  });
});

// Get product by ID
productRouter.get('/products/:id', (req, res) => {
  const { id } = req.params;
  const product = products.get(id);
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  res.json({ product, requestId: req.requestId });
});

// Mount the router at /api
app.use('/api', productRouter);

// ============================================
// Error Handler (4 parameters: err, req, res, next)
// ============================================

app.use((err, req, res, next) => {
  console.error('[Error Handler]', err.message);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500,
      timestamp: new Date().toISOString(),
      path: req.path,
      requestId: req.requestId
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
  console.log(`\n📋 Try these endpoints:\n`);
  console.log(`   # Basic routes`);
  console.log(`   curl http://localhost:${address.port}/`);
  console.log(`   curl http://localhost:${address.port}/health`);
  console.log(`\n   # Middleware test - Pipeline stopping`);
  console.log(`   curl http://localhost:${address.port}/blocked`);
  console.log(`   curl http://localhost:${address.port}/not-blocked`);
  console.log(`\n   # Middleware test - Execution order (check middlewareOrder array)`);
  console.log(`   curl http://localhost:${address.port}/ | jq '.middlewareOrder'`);
  console.log(`\n   # Middleware test - Path-specific middleware (admin auth)`);
  console.log(`   curl http://localhost:${address.port}/api/admin/dashboard`);
  console.log(`   curl -H "Authorization: Bearer token" http://localhost:${address.port}/api/admin/dashboard`);
  console.log(`\n   # Middleware test - Error handling`);
  console.log(`   curl http://localhost:${address.port}/error-test`);
  console.log(`\n   # Middleware test - Async middleware`);
  console.log(`   curl http://localhost:${address.port}/async-test`);
  console.log(`\n   # User CRUD operations`);
  console.log(`   curl http://localhost:${address.port}/users`);
  console.log(`   curl http://localhost:${address.port}/users/1`);
  console.log(`   curl -X POST http://localhost:${address.port}/users -H "Content-Type: application/json" -d '{"name":"John","email":"john@example.com"}'`);
  console.log(`\n   # Router example`);
  console.log(`   curl http://localhost:${address.port}/api/products`);
  console.log(``);
});

