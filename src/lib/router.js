/**
 * Router Module - Group routes and middleware
 * @module router
 */

import { matchPath } from '../utils/index.js';

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
   * Add GET route with optional inline middleware
   * @param {string} path - Route path
   * @param {...Function} handlers - Middleware and final handler
   */
  get(path, ...handlers) {
    this.stack.push({
      method: 'GET',
      path,
      handlers, // Array of all handlers
      isRoute: true
    });
    return this;
  }
  
  /**
   * Add POST route with optional inline middleware
   * @param {string} path - Route path
   * @param {...Function} handlers - Middleware and final handler
   */
  post(path, ...handlers) {
    this.stack.push({
      method: 'POST',
      path,
      handlers,
      isRoute: true
    });
    return this;
  }
  
  /**
   * Add PUT route with optional inline middleware
   * @param {string} path - Route path
   * @param {...Function} handlers - Middleware and final handler
   */
  put(path, ...handlers) {
    this.stack.push({
      method: 'PUT',
      path,
      handlers,
      isRoute: true
    });
    return this;
  }
  
  /**
   * Add PATCH route with optional inline middleware
   * @param {string} path - Route path
   * @param {...Function} handlers - Middleware and final handler
   */
  patch(path, ...handlers) {
    this.stack.push({
      method: 'PATCH',
      path,
      handlers,
      isRoute: true
    });
    return this;
  }
  
  /**
   * Add DELETE route with optional inline middleware
   * @param {string} path - Route path
   * @param {...Function} handlers - Middleware and final handler
   */
  delete(path, ...handlers) {
    this.stack.push({
      method: 'DELETE',
      path,
      handlers,
      isRoute: true
    });
    return this;
  }
  
  /**
   * Add route for all HTTP methods with optional inline middleware
   * @param {string} path - Route path
   * @param {...Function} handlers - Middleware and final handler
   */
  all(path, ...handlers) {
    this.stack.push({
      method: '*',
      path,
      handlers,
      isRoute: true
    });
    return this;
  }
  
  /**
   * Add HEAD route with optional inline middleware
   * @param {string} path - Route path
   * @param {...Function} handlers - Middleware and final handler
   */
  head(path, ...handlers) {
    this.stack.push({
      method: 'HEAD',
      path,
      handlers,
      isRoute: true
    });
    return this;
  }
  
  /**
   * Add OPTIONS route with optional inline middleware
   * @param {string} path - Route path
   * @param {...Function} handlers - Middleware and final handler
   */
  options(path, ...handlers) {
    this.stack.push({
      method: 'OPTIONS',
      path,
      handlers,
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
