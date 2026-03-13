/**
 * Application Module - Main factory function for creating grokexpress apps
 * @module application
 */

import http from 'node:http';
import { Request } from './request.js';
import { Response } from './response.js';
import { MiddlewareStack, MiddlewarePipeline } from './middleware.js';
import { Router } from './router.js';
import { matchPath, normalizePath } from './utils.js';

/**
 * Create Application - Main factory function
 * Creates an Express-like application with middleware support
 * 
 * @returns {Object} App object with use, listen, and route methods
 */
export function createApplication() {
  const middlewareStack = new MiddlewareStack();
  let server = null;
  let customErrorHandler = null;
  
  /**
   * Main request handler - processes all middleware in order
   */
  async function handler(req, res) {
    // Wrap native request/response
    const request = new Request(req);
    const response = new Response(res);
    
    // Create pipeline
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
          middlewareStack.route(item.method, fullPath, item.handler);
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
     * GET route
     */
    get(path, handler) {
      middlewareStack.route('GET', path, handler);
      return app;
    },
    
    /**
     * POST route
     */
    post(path, handler) {
      middlewareStack.route('POST', path, handler);
      return app;
    },
    
    /**
     * PUT route
     */
    put(path, handler) {
      middlewareStack.route('PUT', path, handler);
      return app;
    },
    
    /**
     * PATCH route
     */
    patch(path, handler) {
      middlewareStack.route('PATCH', path, handler);
      return app;
    },
    
    /**
     * DELETE route
     */
    delete(path, handler) {
      middlewareStack.route('DELETE', path, handler);
      return app;
    },
    
    /**
     * HEAD route
     */
    head(path, handler) {
      middlewareStack.route('HEAD', path, handler);
      return app;
    },
    
    /**
     * OPTIONS route
     */
    options(path, handler) {
      middlewareStack.route('OPTIONS', path, handler);
      return app;
    },
    
    /**
     * All methods route
     */
    all(path, handler) {
      middlewareStack.route('*', path, handler);
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
    }
  };
  
  return app;
}

// Export alias for Express-like API
export const grok = createApplication;

// Re-export Router for convenience
export { Router };

