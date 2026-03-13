/**
 * Route Executor Module - Executes route handlers and middleware chain
 * @module route-executor
 */

/**
 * RouteExecutor - Executes a route's middleware chain
 * Handles both sync and async handlers
 */
export class RouteExecutor {
  /**
   * Execute a route's handler chain
   * @param {Route} route - The matched route
   * @param {Object} request - Request object
   * @param {Object} response - Response object
   * @param {Object} params - Route parameters
   * @returns {Promise<void>}
   */
  static async execute(route, request, response, params) {
    // Set route params on request
    request.params = params;
    
    const handlers = route.getHandlers();
    let index = 0;
    let error = null;
    
    /**
     * Next function - moves to next handler in chain
     * @param {Error} err - Optional error to trigger error handling
     */
    async function next(err) {
      // If error was passed, store it and stop further middleware
      if (err) {
        error = err;
        return;
      }
      
      if (error) {
        return;
      }
      
      // If response already sent, stop execution
      if (response.headersSent || response.writableEnded) {
        return;
      }
      
      // End of chain
      if (index >= handlers.length) {
        return;
      }
      
      const handler = handlers[index++];
      
      try {
        // Execute handler - support both sync and async
        const result = handler(request, response, next);
        
        // If handler returns a promise, await it
        if (result && typeof result.then === 'function') {
          await result;
        }
      } catch (handlerErr) {
        error = handlerErr;
      }
      
      if (error) {
        return;
      }
    }
    
    // Start the handler chain
    await next();
    
    if (error) {
      throw error;
    }
  }
  
  /**
   * Execute handlers with error handling
   * @param {Route} route - The matched route
   * @param {Object} request - Request object
   * @param {Object} response - Response object
   * @param {Object} params - Route parameters
   * @param {Function} onError - Error handler callback
   * @returns {Promise<void>}
   */
  static async executeSafe(route, request, response, params, onError) {
    try {
      await this.execute(route, request, response, params);
    } catch (err) {
      if (onError) {
        onError(err, request, response);
      } else {
        throw err;
      }
    }
  }
}

/**
 * Execute a route handler chain
 * @param {Route} route - The matched route
 * @param {Object} request - Request object
 * @param {Object} response - Response object
 * @param {Object} params - Route parameters
 * @returns {Promise<void>}
 */
export async function executeRoute(route, request, response, params) {
  return RouteExecutor.execute(route, request, response, params);
}
