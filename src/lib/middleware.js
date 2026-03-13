/**
 * Middleware Stack and Execution Pipeline
 * @module middleware
 */

import { pathMatches, matchPath } from './utils.js';

/**
 * Middleware layer types
 */
const LayerType = {
  MIDDLEWARE: 'middleware',
  ROUTE: 'route',
  ERROR_HANDLER: 'error_handler'
};

/**
 * Represents a single middleware/route layer in the stack
 */
class Layer {
  constructor(options) {
    this.type = options.type || LayerType.MIDDLEWARE;
    this.path = options.path || '/';
    this.handler = options.handler;
    this.method = options.method || null; // For routes
    this.isError = options.isError || false; // For error handlers
  }
  
  /**
   * Check if this layer matches the request
   */
  matches(request) {
    // Error handlers only match when there's an error
    if (this.isError) return false;
    
    // For routes, check method and path
    if (this.type === LayerType.ROUTE) {
      if (this.method !== '*' && this.method !== request.method) {
        return false;
      }
      const { matched } = matchPath(this.path, request.path);
      return matched;
    }
    
    // For middleware, check path prefix
    return pathMatches(this.path, request.path);
  }
  
  /**
   * Check if this layer is an error handler that matches
   */
  matchesError() {
    return this.isError;
  }
}

/**
 * MiddlewareStack - Manages middleware execution order
 * Handles both regular middleware and error handlers
 */
export class MiddlewareStack {
  constructor() {
    this.stack = [];
    this.errorHandlers = [];
  }
  
  /**
   * Add middleware to the stack
   * @param {string} path - Optional path to match
   * @param {Function} middleware - Middleware function with signature (req, res, next)
   */
  use(path, middleware) {
    if (typeof path === 'function') {
      middleware = path;
      path = '/';
    }
    
    // Check if it's an error handler (4 parameters)
    if (middleware.length === 4) {
      this.errorHandlers.push(new Layer({
        type: LayerType.ERROR_HANDLER,
        path,
        handler: middleware,
        isError: true
      }));
    } else {
      this.stack.push(new Layer({
        type: LayerType.MIDDLEWARE,
        path,
        handler: middleware
      }));
    }
    
    return this;
  }
  
  /**
   * Add a route handler
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  route(method, path, handler) {
    this.stack.push(new Layer({
      type: LayerType.ROUTE,
      method,
      path,
      handler
    }));
    
    return this;
  }
  
  /**
   * Get all middleware layers
   */
  getAll() {
    return [...this.stack];
  }
  
  /**
   * Get error handlers
   */
  getErrorHandlers() {
    return [...this.errorHandlers];
  }
  
  /**
   * Clear all middleware
   */
  clear() {
    this.stack = [];
    this.errorHandlers = [];
  }
}

/**
 * Middleware Pipeline Executor
 * Executes middleware in order, handles sync/async, and stops on response
 */
export class MiddlewarePipeline {
  constructor(stack, errorHandlers) {
    this.stack = stack;
    this.errorHandlers = errorHandlers;
  }
  
  /**
   * Execute the middleware pipeline
   * @param {Request} request - Wrapped request object
   * @param {Response} response - Wrapped response object
   * @param {Function} onComplete - Called when pipeline completes
   */
  async execute(request, response, onComplete) {
    let index = 0;
    let error = null;
    let pipelineStopped = false;
    
    /**
     * Stop the pipeline (response sent)
     */
    const stop = () => {
      pipelineStopped = true;
    };
    
    /**
     * Next function - moves to next middleware
     * Can be called with an error to trigger error handling
     */
    const next = async (err) => {
      // If an error occurred, handle it
      if (err) {
        error = err;
        return this.handleError(err, request, response);
      }
      
      // If pipeline was stopped, don't continue
      if (pipelineStopped) {
        return;
      }
      
      // End of stack - call onComplete
      if (index >= this.stack.length) {
        return onComplete();
      }
      
      const current = this.stack[index++];
      
      // Check if this layer matches
      if (!current.matches(request)) {
        return next();
      }
      
      // For routes, set params
      if (current.type === LayerType.ROUTE) {
        const { params } = matchPath(current.path, request.path);
        request.params = params;
      }
      
      // Execute the handler
      try {
        // Call handler with (req, res, next) - 3 parameters
        // Support both sync and async handlers
        const result = current.handler(request, response, next);
        
        // If handler returns a promise, wait for it
        if (result && typeof result.then === 'function') {
          await result;
        }
      } catch (err) {
        error = err;
        return this.handleError(err, request, response);
      }
    };
    
    // Start the pipeline
    await next();
  }
  
  /**
   * Handle errors by passing to error handlers
   */
  async handleError(err, request, response) {
    // If there are custom error handlers, use them
    if (this.errorHandlers.length > 0) {
      for (const handler of this.errorHandlers) {
        try {
          const result = handler.handler(err, request, response, () => {});
          if (result && typeof result.then === 'function') {
            await result;
          }
          // Stop after first error handler responds
          if (response.headersSent) {
            return;
          }
        } catch (handlerErr) {
          console.error('Error in error handler:', handlerErr);
        }
      }
    }
    
    // If no response was sent, use default error response
    if (!response.headersSent && !response.writableEnded) {
      const status = err.status || err.statusCode || 500;
      response.status(status).json({
        error: {
          message: err.message || 'Internal Server Error',
          status,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}

/**
 * Create a middleware pipeline from a stack
 */
export function createPipeline(stack, errorHandlers) {
  return new MiddlewarePipeline(stack, errorHandlers);
}
