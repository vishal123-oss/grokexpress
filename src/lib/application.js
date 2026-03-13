/**
 * Application Module - Main factory function for creating grokexpress apps
 * @module application
 */

import http from 'node:http';
import { Request } from './request.js';
import { Response } from './response.js';
import { Router } from './router.js';
import { RouteTable } from './route-table.js';
import { RouteExecutor } from './route-executor.js';
import { normalizePath, pathMatches } from '../utils/index.js';

/**
 * Layer types for middleware processing
 */
const LayerType = {
  GLOBAL: 'global',           // Global middleware (app.use(fn))
  PATH: 'path',               // Path-specific middleware (app.use('/path', fn))
  ROUTE: 'route',             // Route handlers (app.get('/path', fn))
  ERROR: 'error'              // Error handlers (app.use((err, req, res, next) => {}))
};

/**
 * Create Application - Main factory function
 * Creates an Express-like application with full middleware support
 * 
 * @returns {Object} App object with use, listen, and route methods
 */
export function createApplication() {
  // Global middleware stack (runs for all requests)
  const globalMiddleware = [];
  
  // Path-specific middleware (runs for matching paths)
  const pathMiddleware = [];
  
  // Route table (stores routes with their inline middleware)
  const routeTable = new RouteTable();
  
  // Error handlers (4-parameter middleware)
  const errorHandlers = [];
  
  let server = null;
  
  /**
   * Main request handler
   * Execution order:
   * 1. Global middleware
   * 2. Path-specific middleware (matching request path)
   * 3. Route handler (with its inline middleware chain)
   * 4. Error handlers (if error occurred)
   */
  async function handler(req, res) {
    // Wrap native request/response
    const request = new Request(req);
    const response = new Response(res);
    
    // Store middleware execution order for debugging
    request.middlewareChain = [];
    
    try {
      // Phase 1: Execute global middleware
      const globalResult = await executeMiddlewareStack(
        globalMiddleware,
        request,
        response,
        (mw) => true // All global middleware runs for all requests
      );
      
      if (globalResult.ended) {
        return; // Response sent by global middleware
      }
      
      // Phase 2: Execute path-specific middleware
      const pathResult = await executeMiddlewareStack(
        pathMiddleware,
        request,
        response,
        (mw) => pathMatches(mw.path, request.path)
      );
      
      if (pathResult.ended) {
        return; // Response sent by path middleware
      }
      
      // Phase 3: Find and execute route
      const { route, params } = routeTable.find(request.method, request.path);
      
      if (route) {
        await RouteExecutor.execute(route, request, response, params);
        
        // If response not sent after route execution, send 404
        if (!response.headersSent && !response.writableEnded) {
          await send404(response, request);
        }
        return;
      }
      
      // No route matched - send 404
      await send404(response, request);
      
    } catch (err) {
      // Phase 4: Error handling
      await handleError(err, request, response);
    }
  }
  
  /**
   * Execute a stack of middleware
   * @param {Array} stack - Middleware stack
   * @param {Request} request - Request object
   * @param {Response} response - Response object
   * @param {Function} shouldRun - Function to determine if middleware should run
   * @returns {{ ended: boolean }} Whether the response was sent
   */
  async function executeMiddlewareStack(stack, request, response, shouldRun) {
    let index = 0;
    let ended = false;
    
    async function next(err) {
      // If error passed, throw it
      if (err) {
        throw err;
      }
      
      // If response already sent, stop
      if (response.headersSent || response.writableEnded) {
        ended = true;
        return;
      }
      
      // Find next matching middleware
      while (index < stack.length) {
        const middleware = stack[index++];
        
        if (shouldRun(middleware)) {
          // Execute middleware
          const result = middleware.handler(request, response, next);
          
          // Handle async middleware
          if (result && typeof result.then === 'function') {
            await result;
          }
          
          // Check if response was sent
          if (response.headersSent || response.writableEnded) {
            ended = true;
          }
          
          return;
        }
      }
    }
    
    await next();
    return { ended };
  }
  
  /**
   * Handle errors using registered error handlers
   */
  async function handleError(err, request, response) {
    console.error('[Error]', err.message || 'Unknown error');
    
    // Try custom error handlers first
    for (const handler of errorHandlers) {
      try {
        // Error handlers have signature: (err, req, res, next)
        const result = handler(request, response, () => {}, err);
        
        if (result && typeof result.then === 'function') {
          await result;
        }
        
        // If response sent by error handler, stop
        if (response.headersSent || response.writableEnded) {
          return;
        }
      } catch (handlerErr) {
        console.error('[Error Handler Failed]', handlerErr);
      }
    }
    
    // Default error response
    if (!response.headersSent && !response.writableEnded) {
      const status = err.status || err.statusCode || 500;
      response.status(status).json({
        error: {
          message: err.message || 'Internal Server Error',
          status,
          timestamp: new Date().toISOString(),
          path: request.path
        }
      });
    }
  }
  
  /**
   * Send 404 response
   */
  async function send404(response, request) {
    if (!response.headersSent && !response.writableEnded) {
      response.status(404).json({
        error: 'Not Found',
        path: request.path,
        status: 404
      });
    }
  }
  
  /**
   * Check if a function is an error handler (4 parameters)
   */
  function isErrorHandler(fn) {
    return fn.length === 4;
  }
  
  /**
   * App object - public API
   */
  const app = {
    /**
     * Add middleware
     * 
     * Supports:
     * - Global middleware: app.use((req, res, next) => {})
     * - Path-specific: app.use('/path', (req, res, next) => {})
     * - Error handler: app.use((err, req, res, next) => {})
     * - Router mounting: app.use(router) or app.use('/prefix', router)
     * 
     * @param {string|Function|Router} path - Path, middleware, or Router
     * @param {Function|Router} middleware - Middleware or Router
     */
    use(path, middleware) {
      // Case 1: Router mounting without path - app.use(router)
      if (path instanceof Router) {
        this._mountRouter(path, '/');
        return app;
      }
      
      // Case 2: Router mounting with path - app.use('/api', router)
      if (typeof path === 'string' && middleware instanceof Router) {
        this._mountRouter(middleware, path);
        return app;
      }
      
      // Case 3: Error handler without path - app.use((err, req, res, next) => {})
      if (typeof path === 'function' && isErrorHandler(path)) {
        errorHandlers.push(path);
        return app;
      }
      
      // Case 4: Global middleware without path - app.use((req, res, next) => {})
      if (typeof path === 'function' && middleware === undefined) {
        if (isErrorHandler(path)) {
          errorHandlers.push(path);
        } else {
          globalMiddleware.push({
            type: LayerType.GLOBAL,
            path: '/',
            handler: path
          });
        }
        return app;
      }
      
      // Case 5: Error handler with path - app.use('/path', (err, req, res, next) => {})
      if (typeof path === 'string' && isErrorHandler(middleware)) {
        // Error handlers with path are treated as global but only run for that path
        errorHandlers.push(middleware);
        return app;
      }
      
      // Case 6: Path-specific middleware - app.use('/path', (req, res, next) => {})
      if (typeof path === 'string' && typeof middleware === 'function') {
        pathMiddleware.push({
          type: LayerType.PATH,
          path: path,
          handler: middleware
        });
        return app;
      }
      
      throw new Error('Invalid middleware arguments');
    },
    
    /**
     * Internal: Mount a router with path prefix
     */
    _mountRouter(router, prefix) {
      const normalizedPrefix = normalizePath(prefix);
      
      router.stack.forEach(item => {
        const fullPath = normalizedPrefix + (item.path.startsWith('/') ? item.path : '/' + item.path);
        
        if (item.isRoute) {
          // Register route with its inline middleware (spread handlers array)
          routeTable.register(item.method, fullPath, ...item.handlers);
        } else if (item.isError) {
          // Router error handler
          errorHandlers.push(item.handler);
        } else {
          // Router middleware becomes path-specific middleware
          pathMiddleware.push({
            type: LayerType.PATH,
            path: fullPath,
            handler: item.handler
          });
        }
      });
    },
    
    /**
     * Route registration methods with inline middleware support
     */
    
    /**
     * GET route - supports multiple inline middleware
     * app.get('/path', handler)
     * app.get('/path', middleware, handler)
     * app.get('/path', mw1, mw2, ..., handler)
     */
    get(path, ...handlers) {
      routeTable.register('GET', path, ...handlers);
      return app;
    },
    
    /**
     * POST route - supports multiple inline middleware
     */
    post(path, ...handlers) {
      routeTable.register('POST', path, ...handlers);
      return app;
    },
    
    /**
     * PUT route - supports multiple inline middleware
     */
    put(path, ...handlers) {
      routeTable.register('PUT', path, ...handlers);
      return app;
    },
    
    /**
     * PATCH route - supports multiple inline middleware
     */
    patch(path, ...handlers) {
      routeTable.register('PATCH', path, ...handlers);
      return app;
    },
    
    /**
     * DELETE route - supports multiple inline middleware
     */
    delete(path, ...handlers) {
      routeTable.register('DELETE', path, ...handlers);
      return app;
    },
    
    /**
     * HEAD route - supports multiple inline middleware
     */
    head(path, ...handlers) {
      routeTable.register('HEAD', path, ...handlers);
      return app;
    },
    
    /**
     * OPTIONS route - supports multiple inline middleware
     */
    options(path, ...handlers) {
      routeTable.register('OPTIONS', path, ...handlers);
      return app;
    },
    
    /**
     * All methods route - supports multiple inline middleware
     */
    all(path, ...handlers) {
      routeTable.register('*', path, ...handlers);
      return app;
    },
    
    /**
     * Set custom error handler (legacy method)
     * @deprecated Use app.use((err, req, res, next) => {}) instead
     */
    setErrorHandler(handler) {
      errorHandlers.push(handler);
      return app;
    },
    
    /**
     * Listen on port
     */
    listen(port, callback) {
      server = http.createServer(handler);
      
      return new Promise((resolve, reject) => {
        server.listen(port, () => {
          const address = server.address();
          console.log(`🚀 grokexpress server running on http://localhost:${address.port}`);
          
          // Debug info
          console.log(`\n📊 Middleware Stack:`);
          console.log(`  Global: ${globalMiddleware.length}`);
          console.log(`  Path-specific: ${pathMiddleware.length}`);
          console.log(`  Error handlers: ${errorHandlers.length}`);
          
          // Print route table
          routeTable.print();
          
          if (callback) {
            callback(address);
          }
          resolve(server);
        });
        
        server.on('error', reject);
      });
    },
    
    /**
     * Close server
     */
    close() {
      return new Promise((resolve, reject) => {
        if (server) {
          server.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        } else {
          resolve();
        }
      });
    },
    
    /**
     * Get underlying HTTP server
     */
    getServer() {
      return server;
    },
    
    /**
     * Get global middleware stack
     */
    getGlobalMiddleware() {
      return [...globalMiddleware];
    },
    
    /**
     * Get path-specific middleware
     */
    getPathMiddleware() {
      return [...pathMiddleware];
    },
    
    /**
     * Get error handlers
     */
    getErrorHandlers() {
      return [...errorHandlers];
    },
    
    /**
     * Get route table
     */
    getRouteTable() {
      return routeTable;
    }
  };
  
  return app;
}

// Export alias for Express-like API
export const grok = createApplication;

// Re-export Router for convenience
export { Router };

