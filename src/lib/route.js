/**
 * Route Module - Represents a single route with its middleware chain
 * @module route
 */

import { matchPath } from './utils.js';

/**
 * Route class - Represents a single route definition
 * Stores the HTTP method, path pattern, middleware chain, and final handler
 */
export class Route {
  /**
   * Create a new Route
   * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param {string} path - URL path pattern (e.g., '/users/:id')
   * @param {Array<Function>} handlers - Array of middleware functions + final handler
   */
  constructor(method, path, handlers) {
    this.method = method.toUpperCase();
    this.path = path;
    this.handlers = handlers; // [middleware1, middleware2, ..., finalHandler]
    
    // Extract parameter names from path pattern
    this.paramNames = this._extractParamNames(path);
    
    // Create regex pattern for matching
    this.regex = this._createRegex(path);
    
    // Route metadata
    this.isWildcard = method === '*';
  }
  
  /**
   * Extract parameter names from path pattern
   * @param {string} path - Path pattern
   * @returns {Array<string>} Array of parameter names
   * @private
   */
  _extractParamNames(path) {
    const names = [];
    const regex = /:([^/]+)/g;
    let match;
    
    while ((match = regex.exec(path)) !== null) {
      names.push(match[1]);
    }
    
    return names;
  }
  
  /**
   * Create regex pattern for route matching
   * @param {string} path - Path pattern
   * @returns {RegExp} Regex for matching URLs
   * @private
   */
  _createRegex(path) {
    // Escape special regex characters except ':'
    let pattern = path
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/:([^/]+)/g, '([^/]+)'); // Replace params with capture groups
    
    // Ensure exact match
    return new RegExp(`^${pattern}$`);
  }
  
  /**
   * Check if this route matches the given method and path
   * @param {string} method - HTTP method
   * @param {string} path - URL path
   * @returns {{ matched: boolean, params: Object }} Match result with extracted params
   */
  match(method, path) {
    // Check method match (wildcard matches all)
    if (!this.isWildcard && this.method !== method.toUpperCase()) {
      return { matched: false, params: {} };
    }
    
    // Check path match
    const matchResult = path.match(this.regex);
    
    if (!matchResult) {
      return { matched: false, params: {} };
    }
    
    // Extract parameters
    const params = {};
    this.paramNames.forEach((name, index) => {
      params[name] = matchResult[index + 1];
    });
    
    return { matched: true, params };
  }
  
  /**
   * Get all middleware/handlers for this route
   * @returns {Array<Function>} Array of handler functions
   */
  getHandlers() {
    return this.handlers;
  }
  
  /**
   * Get the number of handlers (middleware + final handler)
   * @returns {number}
   */
  getHandlerCount() {
    return this.handlers.length;
  }
  
  /**
   * Check if route has middleware (more than just the final handler)
   * @returns {boolean}
   */
  hasMiddleware() {
    return this.handlers.length > 1;
  }
  
  /**
   * Get route info for debugging
   * @returns {Object}
   */
  toJSON() {
    return {
      method: this.method,
      path: this.path,
      paramNames: this.paramNames,
      handlerCount: this.handlers.length,
      hasMiddleware: this.hasMiddleware()
    };
  }
}

/**
 * Create a new Route instance
 * @param {string} method - HTTP method
 * @param {string} path - URL path pattern
 * @param {Array<Function>} handlers - Middleware and handler functions
 * @returns {Route}
 */
export function createRoute(method, path, handlers) {
  return new Route(method, path, handlers);
}
