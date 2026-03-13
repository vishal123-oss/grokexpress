/**
 * Shared utility functions for grokexpress
 * @module utils
 */

/**
 * Match path pattern with params extraction
 * Supports Express-like route patterns: /users/:id, /posts/:postId/comments/:commentId
 * 
 * @param {string} pattern - Route pattern (e.g., '/users/:id')
 * @param {string} url - Request URL path (e.g., '/users/123')
 * @returns {{ matched: boolean, params: Object }}
 */
export function matchPath(pattern, url) {
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
 * Middleware paths are prefixes, so /api matches /api/users, /api/users/1, etc.
 * 
 * @param {string} middlewarePath - Middleware mount path
 * @param {string} requestPath - Request URL path
 * @returns {boolean}
 */
export function pathMatches(middlewarePath, requestPath) {
  if (middlewarePath === '/') return true;
  return requestPath.startsWith(middlewarePath);
}

/**
 * Default error handler for unhandled errors
 * 
 * @param {Error} err - Error object
 * @param {Request} req - Request object
 * @param {Response} res - Response object
 */
export function defaultErrorHandler(err, req, res) {
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
 * Check if a function is async (returns a promise)
 * 
 * @param {Function} fn - Function to check
 * @returns {boolean}
 */
export function isAsync(fn) {
  return fn.constructor.name === 'AsyncFunction';
}

/**
 * Normalize path - remove trailing slash except for root
 * 
 * @param {string} path - Path to normalize
 * @returns {string}
 */
export function normalizePath(path) {
  if (path === '/') return path;
  return path.endsWith('/') ? path.slice(0, -1) : path;
}
