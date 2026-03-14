/**
 * Route Table Module - Stores and matches routes efficiently
 * @module route-table
 */

import { Route } from './route.js';

/**
 * RouteTable class - Manages route registration and matching
 * Organizes routes by HTTP method for efficient lookup
 * Routes are sorted by priority (static routes before parameterized routes)
 */
export class RouteTable {
  constructor() {
    // Store routes by method: { GET: [Route, Route], POST: [Route], ... }
    // Routes within each method are sorted by priority (highest first)
    this.routesByMethod = new Map();
    
    // Store all routes for iteration
    this.allRoutes = [];
    
    // Wildcard routes (match any method) - also sorted by priority
    this.wildcardRoutes = [];
    
    // Flag to track if routes need sorting
    this._needsSorting = false;
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
    
    // Mark as needing sorting
    this._needsSorting = true;
    
    return route;
  }
  
  /**
   * Sort routes by priority (higher priority first)
   * This ensures static routes match before parameterized routes
   * @private
   */
  _sortRoutes() {
    if (!this._needsSorting) return;
    
    // Sort routes by priority (descending - higher priority first)
    const sortByPriority = (a, b) => b.priority - a.priority;
    
    // Sort each method's routes
    for (const routes of this.routesByMethod.values()) {
      routes.sort(sortByPriority);
    }
    
    // Sort wildcard routes
    this.wildcardRoutes.sort(sortByPriority);
    
    this._needsSorting = false;
  }
  
  /**
   * Find a matching route for the given method and path
   * Routes are matched in priority order (static routes first)
   * @param {string} method - HTTP method
   * @param {string} path - URL path
   * @returns {{ route: Route|null, params: Object }} Matched route and params
   */
  find(method, path) {
    // Ensure routes are sorted by priority before matching
    this._sortRoutes();
    
    const upperMethod = method.toUpperCase();
    
    // First check method-specific routes (sorted by priority)
    const methodRoutes = this.routesByMethod.get(upperMethod);
    if (methodRoutes) {
      for (const route of methodRoutes) {
        const result = route.match(upperMethod, path);
        if (result.matched) {
          return { route, params: result.params };
        }
      }
    }
    
    // Then check wildcard routes (sorted by priority)
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
    this._needsSorting = false;
  }
  
  /**
   * Check for potential route collisions
   * A collision occurs when two routes could match the same URL
   * This helps developers identify ambiguous route definitions
   * 
   * @returns {Array<{ route1: Route, route2: Route, reason: string }>} Array of collision warnings
   */
  detectCollisions() {
    const collisions = [];
    
    // Check collisions within each method's routes
    for (const [method, routes] of this.routesByMethod) {
      this._checkRouteCollisions(routes, method, collisions);
    }
    
    // Check collisions within wildcard routes
    this._checkRouteCollisions(this.wildcardRoutes, '*', collisions);
    
    return collisions;
  }
  
  /**
   * Check for collisions between routes
   * @param {Array<Route>} routes - Routes to check
   * @param {string} method - HTTP method
   * @param {Array} collisions - Array to collect collision warnings
   * @private
   */
  _checkRouteCollisions(routes, method, collisions) {
    for (let i = 0; i < routes.length; i++) {
      for (let j = i + 1; j < routes.length; j++) {
        const route1 = routes[i];
        const route2 = routes[j];
        
        // Check if routes have the same structure (potential collision)
        const collision = this._checkPairCollision(route1, route2, method);
        if (collision) {
          collisions.push(collision);
        }
      }
    }
  }
  
  /**
   * Check if two routes could collide
   * @param {Route} route1 - First route
   * @param {Route} route2 - Second route
   * @param {string} method - HTTP method
   * @returns {{ route1: Route, route2: Route, reason: string }|null}
   * @private
   */
  _checkPairCollision(route1, route2, method) {
    // Same exact path - definite collision
    if (route1.path === route2.path) {
      return {
        route1,
        route2,
        method,
        reason: `Duplicate route path: '${route1.path}'`
      };
    }
    
    // Check if one route could shadow another
    // e.g., /users/:id could shadow /users/profile if :id comes first
    const segments1 = route1.path.split('/').filter(Boolean);
    const segments2 = route2.path.split('/').filter(Boolean);
    
    // Different segment counts - no collision
    if (segments1.length !== segments2.length) {
      return null;
    }
    
    // Check segment by segment
    let hasDifference = false;
    let hasParamDifference = false;
    
    for (let i = 0; i < segments1.length; i++) {
      const seg1 = segments1[i];
      const seg2 = segments2[i];
      const isParam1 = seg1.startsWith(':');
      const isParam2 = seg2.startsWith(':');
      
      if (seg1 !== seg2) {
        hasDifference = true;
        // If both are static but different, no collision
        if (!isParam1 && !isParam2) {
          return null; // Different static segments, no collision
        }
        // If one is param and other is static
        if (isParam1 !== isParam2) {
          hasParamDifference = true;
        }
      }
    }
    
    // If there's a difference involving parameters, potential collision
    if (hasDifference && hasParamDifference) {
      // Determine which route has higher priority
      const higherPriority = route1.priority > route2.priority ? route1 : route2;
      const lowerPriority = route1.priority > route2.priority ? route2 : route1;
      
      return {
        route1,
        route2,
        method,
        reason: `Potential collision: '${route1.path}' and '${route2.path}' could match the same URLs. ` +
                `'${higherPriority.path}' will be matched first due to higher priority.`
      };
    }
    
    return null;
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
