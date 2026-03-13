/**
 * Route Table Module - Stores and matches routes efficiently
 * @module route-table
 */

import { Route } from './route.js';

/**
 * RouteTable class - Manages route registration and matching
 * Organizes routes by HTTP method for efficient lookup
 */
export class RouteTable {
  constructor() {
    // Store routes by method: { GET: [Route, Route], POST: [Route], ... }
    this.routesByMethod = new Map();
    
    // Store all routes for iteration
    this.allRoutes = [];
    
    // Wildcard routes (match any method)
    this.wildcardRoutes = [];
  }
  
  /**
   * Register a new route
   * @param {string} method - HTTP method
   * @param {string} path - URL path pattern
   * @param {...Function} handlers - Middleware and final handler
   * @returns {Route} The created route
   */
  register(method, path, ...handlers) {
    if (handlers.length === 0) {
      throw new Error('Route must have at least one handler');
    }
    
    const route = new Route(method, path, handlers);
    
    // Store in all routes list
    this.allRoutes.push(route);
    
    // Store by method for efficient lookup
    if (route.isWildcard) {
      this.wildcardRoutes.push(route);
    } else {
      if (!this.routesByMethod.has(route.method)) {
        this.routesByMethod.set(route.method, []);
      }
      this.routesByMethod.get(route.method).push(route);
    }
    
    return route;
  }
  
  /**
   * Find a matching route for the given method and path
   * @param {string} method - HTTP method
   * @param {string} path - URL path
   * @returns {{ route: Route|null, params: Object }} Matched route and params
   */
  find(method, path) {
    const upperMethod = method.toUpperCase();
    
    // First check method-specific routes
    const methodRoutes = this.routesByMethod.get(upperMethod);
    if (methodRoutes) {
      for (const route of methodRoutes) {
        const result = route.match(upperMethod, path);
        if (result.matched) {
          return { route, params: result.params };
        }
      }
    }
    
    // Then check wildcard routes
    for (const route of this.wildcardRoutes) {
      const result = route.match(upperMethod, path);
      if (result.matched) {
        return { route, params: result.params };
      }
    }
    
    // No match found
    return { route: null, params: {} };
  }
  
  /**
   * Get all routes for a specific HTTP method
   * @param {string} method - HTTP method
   * @returns {Array<Route>}
   */
  getRoutesByMethod(method) {
    return this.routesByMethod.get(method.toUpperCase()) || [];
  }
  
  /**
   * Get all registered routes
   * @returns {Array<Route>}
   */
  getAllRoutes() {
    return [...this.allRoutes];
  }
  
  /**
   * Get route count
   * @returns {number}
   */
  getRouteCount() {
    return this.allRoutes.length;
  }
  
  /**
   * Clear all routes
   */
  clear() {
    this.routesByMethod.clear();
    this.allRoutes = [];
    this.wildcardRoutes = [];
  }
  
  /**
   * Get route table info for debugging
   * @returns {Object}
   */
  toJSON() {
    const byMethod = {};
    for (const [method, routes] of this.routesByMethod) {
      byMethod[method] = routes.map(r => r.toJSON());
    }
    
    return {
      totalRoutes: this.allRoutes.length,
      routesByMethod: byMethod,
      wildcardRoutes: this.wildcardRoutes.map(r => r.toJSON())
    };
  }
  
  /**
   * Print route table (for debugging)
   */
  print() {
    console.log('\n📋 Route Table:');
    console.log('='.repeat(60));
    
    for (const [method, routes] of this.routesByMethod) {
      console.log(`\n${method}:`);
      for (const route of routes) {
        const middlewareCount = route.hasMiddleware() 
          ? ` (${route.getHandlerCount() - 1} middleware)` 
          : '';
        console.log(`  ${route.path}${middlewareCount}`);
      }
    }
    
    if (this.wildcardRoutes.length > 0) {
      console.log('\n* (All Methods):');
      for (const route of this.wildcardRoutes) {
        console.log(`  ${route.path}`);
      }
    }
    
    console.log('='.repeat(60));
    console.log(`Total: ${this.allRoutes.length} routes\n`);
  }
}

/**
 * Create a new RouteTable instance
 * @returns {RouteTable}
 */
export function createRouteTable() {
  return new RouteTable();
}
