/**
 * Application Module - Main factory function for creating grokexpress apps
 * @module application
 */

import http from 'node:http';
import { Request } from './request.js';
import { Response } from './response.js';
import { MiddlewareStack, MiddlewarePipeline } from './middleware.js';
import { Router } from './router.js';
import { RouteTable } from './route-table.js';
import { RouteExecutor } from './route-executor.js';
import { normalizePath } from './utils.js';

/**
 * Create Application - Main factory function
 * Creates an Express-like application with middleware support
 * 
 * @returns {Object} App object with use, listen, and route methods
 */
export function createApplication() {
  const middlewareStack = new MiddlewareStack();
  const routeTable = new RouteTable();
  let server = null;
  let customErrorHandler = null;
  
  /**
   * Main request handler - processes all middleware in order
   */
  async function handler(req, res) {
    // Wrap native request/response
    const request = new Request(req);
    const response = new Response(res);
    
    // Find matching route
    const { route, params } = routeTable.find(request.method, request.path);
    
    // If route found, execute it
    if (route) {
      try {
        await RouteExecutor.execute(route, request, response, params);
        
        // If response not sent after route execution, continue to 404
        if (!response.headersSent && !response.writableEnded) {
          response.status(404).json({
            error: 'Not Found',
            path: request.path,
            status: 404
          });
        }
        return;
      } catch (err) {
        // Handle error
        if (customErrorHandler) {
          customErrorHandler(err, request, response, () => {});
        } else {
          response.status(err.status || 500).json({
            error: {
              message: err.message || 'Internal Server Error',
              status: err.status || 500,
              timestamp: new Date().toISOString()
            }
          });
        }
        return;
      }
    }
    
    // No route matched - try middleware pipeline
    const pipeline = new MiddlewarePipeline(
      middlewareStack.getAll(),
      customErrorHandler ? [{ handler: customErrorHandler }] : []
    );
    
    // Execute pipeline
    await pipeline.execute(request, response, () => {
      // On complete - if no response sent, send 404
      if (!response.headersSent && !response.writableEnded) {
        response.status(404).json({
          error: 'Not Found',
          path: request.path,
          status: 404
        });
      }
    });
  }
  
  /**
   * Helper to flatten arguments for route registration
   * Handles: app.get('/path', handler)
   *          app.get('/path', middleware, handler)
   *          app.get('/path', mw1, mw2, ..., handler)
   */
  function flattenHandlers(args) {
    // args = [path, handler1, handler2, ...]
    // Return array of all handlers
    return args.slice(1);
  }
  
  /**
   * App object - public API
   */
  const app = {
    /**
     * Add middleware or mount router
     * 
     * Middleware signature: (req, res, next) => {}
     * Error handler signature: (err, req, res, next) => {}
     * 
     * @param {string|Function|Router} path - Path, middleware function, or Router
     * @param {Function|Router} middleware - Middleware function or Router (optional)
     */
    use(path, middleware) {
      // Handle router mounting without path
      if (path instanceof Router) {
        const router = path;
        this._mountRouter(router, '/');
        return app;
      }
      
      // Handle router mounting with path prefix
      if (typeof path === 'string' && middleware instanceof Router) {
        this._mountRouter(middleware, path);
        return app;
      }
      
      // Handle error handler (4 parameters)
      if (typeof path === 'function' && path.length === 4) {
        customErrorHandler = path;
        return app;
      }
      
      if (typeof path === 'function' && middleware === undefined) {
        middleware = path;
        path = '/';
      }
      
      // Handle error handler middleware (4 parameters)
      if (middleware.length === 4) {
        customErrorHandler = middleware;
        return app;
      }
      
      middlewareStack.use(path, middleware);
      return app;
    },
    
    /**
     * Internal: Mount a router with path prefix
     */
    _mountRouter(router, prefix) {
      const normalizedPrefix = normalizePath(prefix);
      
      router.stack.forEach(item => {
        const fullPath = normalizedPrefix + (item.path.startsWith('/') ? item.path : '/' + item.path);
        
        if (item.isRoute) {
          routeTable.register(item.method, fullPath, item.handler);
        } else if (item.isError) {
          customErrorHandler = item.handler;
        } else {
          middlewareStack.use(fullPath, item.handler);
        }
      });
    },
    
    /**
     * Set custom error handler
     * Signature: (err, req, res, next) => {}
     */
    setErrorHandler(handler) {
      customErrorHandler = handler;
      return app;
    },
    
    /**
     * GET route - supports multiple middleware
     * app.get('/path', handler)
     * app.get('/path', middleware, handler)
     * app.get('/path', mw1, mw2, ..., handler)
     */
    get(path, ...handlers) {
      routeTable.register('GET', path, ...handlers);
      return app;
    },
    
    /**
     * POST route - supports multiple middleware
     */
    post(path, ...handlers) {
      routeTable.register('POST', path, ...handlers);
      return app;
    },
    
    /**
     * PUT route - supports multiple middleware
     */
    put(path, ...handlers) {
      routeTable.register('PUT', path, ...handlers);
      return app;
    },
    
    /**
     * PATCH route - supports multiple middleware
     */
    patch(path, ...handlers) {
      routeTable.register('PATCH', path, ...handlers);
      return app;
    },
    
    /**
     * DELETE route - supports multiple middleware
     */
    delete(path, ...handlers) {
      routeTable.register('DELETE', path, ...handlers);
      return app;
    },
    
    /**
     * HEAD route - supports multiple middleware
     */
    head(path, ...handlers) {
      routeTable.register('HEAD', path, ...handlers);
      return app;
    },
    
    /**
     * OPTIONS route - supports multiple middleware
     */
    options(path, ...handlers) {
      routeTable.register('OPTIONS', path, ...handlers);
      return app;
    },
    
    /**
     * All methods route - supports multiple middleware
     */
    all(path, ...handlers) {
      routeTable.register('*', path, ...handlers);
      return app;
    },
    
    /**
     * Listen on port
     * @param {number} port - Port number
     * @param {Function} callback - Callback function (optional)
     * @returns {Promise<http.Server>}
     */
    listen(port, callback) {
      server = http.createServer(handler);
      
      return new Promise((resolve, reject) => {
        server.listen(port, () => {
          const address = server.address();
          console.log(`🚀 grokexpress server running on http://localhost:${address.port}`);
          
          // Print route table for debugging
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
     * @returns {Promise<void>}
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
     * Get middleware stack (for debugging)
     */
    getStack() {
      return middlewareStack.getAll();
    },
    
    /**
     * Get route table (for debugging)
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

