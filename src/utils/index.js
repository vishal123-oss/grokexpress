/**
 * Shared utility functions for grokexpress
 * @module utils
 */

/**
 * Parse query string with support for:
 * - Simple parameters: ?name=value
 * - Repeated parameters: ?id=1&id=2 → { id: ['1', '2'] }
 * - Array notation: ?items[]=a&items[]=b → { items: ['a', 'b'] }
 * - Nested objects: ?user[name]=John → { user: { name: 'John' } }
 * - Mixed: ?tags[]=js&tags[]=node&sort=desc
 * 
 * @param {string} queryString - Query string (with or without leading ?)
 * @returns {Object} Parsed query object
 */
export function parseQueryString(queryString) {
  const result = {};
  
  if (!queryString || queryString === '?') {
    return result;
  }
  
  // Remove leading ? if present
  const search = queryString.startsWith('?') ? queryString.slice(1) : queryString;
  
  if (!search) {
    return result;
  }
  
  // Split by & to get individual parameters
  const params = search.split('&');
  
  for (const param of params) {
    if (!param) continue;
    
    // Split key and value
    let [key, value] = param.split('=');
    
    // Decode URI components
    try {
      key = decodeURIComponent(key || '');
      value = decodeURIComponent(value || '');
    } catch (e) {
      // Skip malformed URI components
      continue;
    }
    
    // Handle empty keys
    if (!key) continue;
    
    // Parse the key and set the value
    setNestedValue(result, key, value);
  }
  
  return result;
}

/**
 * Set a value in a nested object structure
 * Handles: simple keys, array notation [], and nested object notation [key]
 * 
 * @param {Object} obj - Target object
 * @param {string} key - Key (may contain [] notation)
 * @param {string} value - Value to set
 */
function setNestedValue(obj, key, value) {
  // Check for array notation: key[] or key[index]
  const arrayMatch = key.match(/^([^\[]+)\[\]$/);
  const indexedArrayMatch = key.match(/^([^\[]+)\[(\d+)\]$/);
  const nestedMatch = key.match(/^([^\[]+)\[([^\]]+)\](.*)$/);
  
  if (arrayMatch) {
    // Array notation: items[] → push to array
    const arrayKey = arrayMatch[1];
    if (!obj[arrayKey]) {
      obj[arrayKey] = [];
    }
    if (Array.isArray(obj[arrayKey])) {
      obj[arrayKey].push(value);
    }
  } else if (indexedArrayMatch) {
    // Indexed array: items[0] → set at specific index
    const arrayKey = indexedArrayMatch[1];
    const index = parseInt(indexedArrayMatch[2], 10);
    if (!obj[arrayKey]) {
      obj[arrayKey] = [];
    }
    obj[arrayKey][index] = value;
  } else if (nestedMatch) {
    // Nested object: user[name] or user[profile][age]
    const parentKey = nestedMatch[1];
    const childKey = nestedMatch[2];
    const remaining = nestedMatch[3];
    
    if (!obj[parentKey]) {
      obj[parentKey] = {};
    }
    
    if (remaining) {
      // More nested levels: user[profile][age]
      setNestedValue(obj[parentKey], childKey + remaining, value);
    } else {
      // Single level nesting: user[name]
      // Check if this key already exists and should be converted to array
      if (obj[parentKey][childKey] !== undefined) {
        if (Array.isArray(obj[parentKey][childKey])) {
          obj[parentKey][childKey].push(value);
        } else {
          obj[parentKey][childKey] = [obj[parentKey][childKey], value];
        }
      } else {
        obj[parentKey][childKey] = value;
      }
    }
  } else {
    // Simple key: name
    if (obj[key] !== undefined) {
      // Key exists - convert to array or push
      if (Array.isArray(obj[key])) {
        obj[key].push(value);
      } else {
        obj[key] = [obj[key], value];
      }
    } else {
      obj[key] = value;
    }
  }
}

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
