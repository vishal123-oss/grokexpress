/**
 * Router Module - Group routes and middleware
 * @module router
 */

import { matchPath } from './utils.js';

/**
 * Router class for grouping routes and middleware
 * Can be mounted on the main app with a path prefix
 */
export class Router {
  constructor() {
    this.stack = [];
  }
  
  /**
   * Add middleware to the router
   * @param {string|Function} path - Path or middleware function
   * @param {Function} middleware - Middleware function (optional)
   */
  use(path, middleware) {
    if (typeof path === 'function') {
      middleware = path;
      path = '/';
    }
    
    // Check if it's an error handler (4 parameters)
    const isError = middleware.length === 4;
    
    this.stack.push({
      path,
      handler: middleware,
      isRoute: false,
      isError
    });
    
    return this;
  }
  
  /**
   * Add GET route
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  get(path, handler) {
    this.stack.push({
      method: 'GET',
      path,
      handler,
      isRoute: true
    });
    return this;
  }
  
  /**
   * Add POST route
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  post(path, handler) {
    this.stack.push({
      method: 'POST',
      path,
      handler,
      isRoute: true
    });
    return this;
  }
  
  /**
   * Add PUT route
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  put(path, handler) {
    this.stack.push({
      method: 'PUT',
      path,
      handler,
      isRoute: true
    });
    return this;
  }
  
  /**
   * Add PATCH route
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  patch(path, handler) {
    this.stack.push({
      method: 'PATCH',
      path,
      handler,
      isRoute: true
    });
    return this;
  }
  
  /**
   * Add DELETE route
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  delete(path, handler) {
    this.stack.push({
      method: 'DELETE',
      path,
      handler,
      isRoute: true
    });
    return this;
  }
  
  /**
   * Add route for all HTTP methods
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  all(path, handler) {
    this.stack.push({
      method: '*',
      path,
      handler,
      isRoute: true
    });
    return this;
  }
  
  /**
   * Add HEAD route
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  head(path, handler) {
    this.stack.push({
      method: 'HEAD',
      path,
      handler,
      isRoute: true
    });
    return this;
  }
  
  /**
   * Add OPTIONS route
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  options(path, handler) {
    this.stack.push({
      method: 'OPTIONS',
      path,
      handler,
      isRoute: true
    });
    return this;
  }
  
  /**
   * Create a sub-router
   * @param {string} path - Path prefix for sub-router
   * @returns {Router}
   */
  route(path) {
    const subRouter = new Router();
    subRouter._prefix = path;
    return subRouter;
  }
}
