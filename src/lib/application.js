import http from 'node:http';
import { Request } from './request.js';
import { Response } from './response.js';

/**
 * MiddlewareStack - Manages middleware execution order
 * Uses a linked list approach for efficient insertion/removal
 */
class MiddlewareStack {
  constructor() {
    this.stack = [];
  }
  
  /**
   * Add middleware to the stack
   * @param {string} path - Optional path to match
   * @param {Function} middleware - Middleware function
   */
  use(path, middleware) {
    if (typeof path === 'function') {
      middleware = path;
      path = '/';
    }
    
    this.stack.push({
      path,
      handler: middleware,
      isRoute: false
    });
    
    return this;
  }
  
  /**
   * Add a route handler
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  route(method, path, handler) {
    this.stack.push({
      method,
      path,
      handler,
      isRoute: true
    });
    
    return this;
  }
  
  /**
   * Get all middleware
   */
  getAll() {
    return [...this.stack];
  }
  
  /**
   * Clear all middleware
   */
  clear() {
    this.stack = [];
  }
}

/**
 * Router class for grouping routes
 */
export class Router {
  constructor() {
    this.stack = [];
  }
  
  use(path, middleware) {
    if (typeof path === 'function') {
      middleware = path;
      path = '/';
    }
    this.stack.push({ path, handler: middleware, isRoute: false });
    return this;
  }
  
  get(path, handler) {
    this.stack.push({ method: 'GET', path, handler, isRoute: true });
    return this;
  }
  
  post(path, handler) {
    this.stack.push({ method: 'POST', path, handler, isRoute: true });
    return this;
  }
  
  put(path, handler) {
    this.stack.push({ method: 'PUT', path, handler, isRoute: true });
    return this;
  }
  
  patch(path, handler) {
    this.stack.push({ method: 'PATCH', path, handler, isRoute: true });
    return this;
  }
  
  delete(path, handler) {
    this.stack.push({ method: 'DELETE', path, handler, isRoute: true });
    return this;
  }
  
  all(path, handler) {
    this.stack.push({ method: '*', path, handler, isRoute: true });
    return this;
  }
}

/**
 * Create Application - Main factory function
 * Creates an Express-like application with middleware support
 * 
 * @returns {Object} App object with use, listen, and route methods
 */
export function createApplication() {
  const middlewareStack = new MiddlewareStack();
  let server = null;
  let errorHandler = defaultErrorHandler;
  
  /**
   * Default error handler
   */
  function defaultErrorHandler(err, req, res) {
    console.error('Error:', err.message);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      error: {
        message: err.message || 'Internal Server Error',
        status,
        timestamp: new Date().toISOString()
      }
    });
  }
  
  /**
   * Match path pattern with params
   */
  function matchPath(pattern, url) {
    // Exact match
    if (pattern === url) {
      return { matched: true, params: {} };
    }
    
    // Pattern matching with params
    const paramNames = [];
    const regexPattern = pattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    
    const regex = new RegExp(`^${regexPattern}$`);
    const match = url.match(regex);
    
    if (match) {
      const params = {};
      paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      return { matched: true, params };
    }
    
    return { matched: false, params: {} };
  }
  
  /**
   * Check if middleware path matches request path
   */
  function pathMatches(middlewarePath, requestPath) {
    if (middlewarePath === '/') return true;
    return requestPath.startsWith(middlewarePath);
  }
  
  /**
   * Main request handler - processes all middleware in order
   */
  async function handler(req, res) {
    // Wrap native request/response
    const request = new Request(req);
    const response = new Response(res);
    
    // Get all middleware
    const stack = middlewareStack.getAll();
    
    // Current middleware index
    let index = 0;
    
    /**
     * Next function - moves to next middleware
     */
    async function next(err) {
      // Handle errors
      if (err) {
        return errorHandler(err, request, response);
      }
      
      // End of stack
      if (index >= stack.length) {
        if (!response.headersSent && !response.writableEnded) {
          response.status(404).json({
            error: 'Not Found',
            path: request.path,
            status: 404
          });
        }
        return;
      }
      
      const current = stack[index++];
      
      // Check if it's a route
      if (current.isRoute) {
        // Check method match
        if (current.method !== '*' && current.method !== request.method) {
          return next();
        }
        
        // Check path match
        const { matched, params } = matchPath(current.path, request.path);
        if (!matched) {
          return next();
        }
        
        // Set params
        request.params = params;
        
        // Execute handler
        try {
          await current.handler(request, response, next);
        } catch (err) {
          next(err);
        }
      } else {
        // It's middleware
        // Check path match
        if (!pathMatches(current.path, request.path)) {
          return next();
        }
        
        // Execute middleware
        try {
          await current.handler(request, response, next);
        } catch (err) {
          next(err);
        }
      }
    }
    
    // Start middleware chain
    await next();
  }
  
  /**
   * App object - public API
   */
  const app = {
    /**
     * Add middleware or mount router
     * @param {string|Function} path - Path or middleware function
     * @param {Function} middleware - Middleware function (optional)
     */
    use(path, middleware) {
      // Handle router mounting
      if (path instanceof Router) {
        const router = path;
        router.stack.forEach(item => {
          middlewareStack.stack.push(item);
        });
        return app;
      }
      
      // Handle router mounting with path prefix
      if (typeof path === 'string' && middleware instanceof Router) {
        const router = middleware;
        const prefix = path.endsWith('/') ? path.slice(0, -1) : path;
        
        router.stack.forEach(item => {
          const fullPath = prefix + (item.path.startsWith('/') ? item.path : '/' + item.path);
          middlewareStack.stack.push({
            ...item,
            path: fullPath
          });
        });
        return app;
      }
      
      middlewareStack.use(path, middleware);
      return app;
    },
    
    /**
     * Set error handler
     */
    setErrorHandler(handler) {
      errorHandler = handler;
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
     * All methods route
     */
    all(path, handler) {
      middlewareStack.route('*', path, handler);
      return app;
    },
    
    /**
     * Listen on port
     * @param {number} port - Port number
     * @param {Function} callback - Callback function
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
