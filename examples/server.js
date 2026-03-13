/**
 * grokexpress Example Server
 * 
 * This example demonstrates how to use grokexpress to build a REST API
 * with middleware, routing, and error handling.
 */

import createApplication, { Router } from '../src/lib/index.js';

// ============================================
// Create the application
// ============================================
const app = createApplication();

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
    endpoints: [
      { method: 'GET', path: '/', description: 'API info' },
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'GET', path: '/users', description: 'List all users' },
      { method: 'GET', path: '/users/:id', description: 'Get user by ID' },
      { method: 'POST', path: '/users', description: 'Create user' },
      { method: 'PUT', path: '/users/:id', description: 'Update user' },
      { method: 'DELETE', path: '/users/:id', description: 'Delete user' },
      { method: 'GET', path: '/api/products', description: 'List products (Router)' },
      { method: 'GET', path: '/api/products/:id', description: 'Get product (Router)' }
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
    memory: process.memoryUsage()
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
    total: users.size
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
  
  res.json({ user });
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
    user
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
    user: updatedUser
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
    count: products.size
  });
});

// Get product by ID
productRouter.get('/products/:id', (req, res) => {
  const { id } = req.params;
  const product = products.get(id);
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  res.json({ product });
});

// Mount the router at /api
app.use('/api', productRouter);

// ============================================
// Error Handler
// ============================================

app.setErrorHandler((err, req, res) => {
  console.error('Unhandled error:', err);
  
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
  console.log(`\n✅ Server started successfully!`);
  console.log(`📍 Listening on: http://localhost:${address.port}`);
  console.log(`\nTry these endpoints:`);
  console.log(`   curl http://localhost:${address.port}/`);
  console.log(`   curl http://localhost:${address.port}/health`);
  console.log(`   curl http://localhost:${address.port}/users`);
  console.log(`   curl http://localhost:${address.port}/users/1`);
  console.log(`   curl -X POST http://localhost:${address.port}/users -H "Content-Type: application/json" -d '{"name":"John","email":"john@example.com"}'`);
  console.log(`   curl http://localhost:${address.port}/api/products`);
  console.log(``);
});
