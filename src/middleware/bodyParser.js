/**
 * Body Parser Middleware Module
 * Parses request bodies for JSON and URL-encoded form data
 * @module middleware/bodyParser
 */

import { parseQueryString } from '../utils/index.js';

/**
 * Default options for body parsing
 */
const DEFAULT_OPTIONS = {
  limit: '100kb',        // Max body size
  strict: true,          // Only accept arrays and objects for JSON
  extended: true,        // Use extended URL-encoded parser
  parameterLimit: 1000,  // Max number of URL-encoded params
  type: 'application/json' // Default content type for json parser
};

/**
 * Parse content-length header to bytes
 * @param {string} limit - Limit string (e.g., '100kb', '1mb')
 * @returns {number} Bytes
 */
function parseLimit(limit) {
  if (typeof limit === 'number') return limit;
  
  const match = String(limit).match(/^(\d+(?:\.\d+)?)\s*(kb|mb|gb|bytes?)?$/i);
  if (!match) return 100 * 1024; // Default 100kb
  
  const num = parseFloat(match[1]);
  const unit = (match[2] || 'bytes').toLowerCase();
  
  const multipliers = {
    'byte': 1,
    'bytes': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  return Math.floor(num * (multipliers[unit] || 1));
}

/**
 * Check if request content-type matches expected type
 * @param {Request} req - Request object
 * @param {string} type - Expected content type
 * @returns {boolean}
 */
function hasContentType(req, type) {
  const contentType = req.get('content-type') || '';
  return contentType.toLowerCase().includes(type.toLowerCase());
}

/**
 * Check if content-type is JSON
 * @param {Request} req - Request object
 * @returns {boolean}
 */
function isJSON(req) {
  const contentType = req.get('content-type') || '';
  return contentType.toLowerCase().includes('application/json');
}

/**
 * Check if content-type is URL-encoded
 * @param {Request} req - Request object
 * @returns {boolean}
 */
function isURLEncoded(req) {
  const contentType = req.get('content-type') || '';
  return contentType.toLowerCase().includes('application/x-www-form-urlencoded');
}

/**
 * Read request body as string
 * @param {Request} req - Request object
 * @param {number} limit - Max bytes to read
 * @returns {Promise<string>}
 */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let data = '';
    let received = 0;
    
    req._raw.on('data', (chunk) => {
      received += chunk.length;
      
      if (received > limit) {
        reject(new Error('Request body too large'));
        req._raw.destroy();
        return;
      }
      
      data += chunk.toString('utf8');
    });
    
    req._raw.on('end', () => {
      resolve(data);
    });
    
    req._raw.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * JSON body parser middleware factory
 * Parses application/json request bodies
 * 
 * @param {Object} options - Parser options
 * @param {number|string} options.limit - Max body size (default: '100kb')
 * @param {boolean} options.strict - Only accept arrays/objects (default: true)
 * @param {string} options.type - Content-type to match (default: 'application/json')
 * @param {Function} options.reviver - JSON.parse reviver function
 * @returns {Function} Middleware function
 * 
 * @example
 * // Basic usage
 * app.use(bodyParser.json());
 * 
 * // With options
 * app.use(bodyParser.json({ limit: '50kb', strict: true }));
 */
export function json(options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const limit = parseLimit(opts.limit);
  
  return async (req, res, next) => {
    // Only parse if content-type matches
    if (!isJSON(req)) {
      return next();
    }
    
    // Skip if body already parsed
    if (req.body !== null && req.body !== undefined) {
      return next();
    }
    
    // Only parse POST, PUT, PATCH
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }
    
    try {
      const rawBody = await readBody(req, limit);
      
      // Empty body
      if (!rawBody.trim()) {
        req.body = {};
        return next();
      }
      
      // Parse JSON
      try {
        const parsed = JSON.parse(rawBody, opts.reviver);
        
        // Strict mode: only allow objects and arrays
        if (opts.strict && parsed !== null && typeof parsed !== 'object') {
          const err = new Error('Invalid JSON payload');
          err.status = 400;
          err.statusCode = 400;
          return next(err);
        }
        
        req.body = parsed;
      } catch (parseErr) {
        const err = new Error('Invalid JSON');
        err.status = 400;
        err.statusCode = 400;
        return next(err);
      }
      
      next();
    } catch (err) {
      if (err.message === 'Request body too large') {
        const error = new Error('Request Entity Too Large');
        error.status = 413;
        error.statusCode = 413;
        return next(error);
      }
      next(err);
    }
  };
}

/**
 * URL-encoded body parser middleware factory
 * Parses application/x-www-form-urlencoded request bodies
 * 
 * @param {Object} options - Parser options
 * @param {number|string} options.limit - Max body size (default: '100kb')
 * @param {boolean} options.extended - Use extended parser (default: true)
 * @param {number} options.parameterLimit - Max number of params (default: 1000)
 * @returns {Function} Middleware function
 * 
 * @example
 * // Basic usage
 * app.use(bodyParser.urlencoded());
 * 
 * // With options
 * app.use(bodyParser.urlencoded({ extended: true, limit: '50kb' }));
 */
export function urlencoded(options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const limit = parseLimit(opts.limit);
  const parameterLimit = opts.parameterLimit || 1000;
  
  return async (req, res, next) => {
    // Only parse if content-type matches
    if (!isURLEncoded(req)) {
      return next();
    }
    
    // Skip if body already parsed
    if (req.body !== null && req.body !== undefined) {
      return next();
    }
    
    // Only parse POST, PUT, PATCH
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }
    
    try {
      const rawBody = await readBody(req, limit);
      
      // Empty body
      if (!rawBody.trim()) {
        req.body = {};
        return next();
      }
      
      // Parse URL-encoded data
      try {
        // Count parameters to prevent DoS
        const paramCount = (rawBody.match(/&/g) || []).length + 1;
        if (paramCount > parameterLimit) {
          const err = new Error('Too many parameters');
          err.status = 400;
          err.statusCode = 400;
          return next(err);
        }
        
        if (opts.extended) {
          // Extended mode: supports nested objects and arrays
          req.body = parseQueryString('?' + rawBody);
        } else {
          // Simple mode: flat key-value pairs only
          req.body = {};
          const pairs = rawBody.split('&');
          
          for (const pair of pairs) {
            if (!pair) continue;
            const [key, value] = pair.split('=');
            const decodedKey = decodeURIComponent(key || '');
            const decodedValue = decodeURIComponent(value || '');
            
            if (decodedKey) {
              if (req.body[decodedKey] !== undefined) {
                // Convert to array for repeated keys
                if (Array.isArray(req.body[decodedKey])) {
                  req.body[decodedKey].push(decodedValue);
                } else {
                  req.body[decodedKey] = [req.body[decodedKey], decodedValue];
                }
              } else {
                req.body[decodedKey] = decodedValue;
              }
            }
          }
        }
      } catch (parseErr) {
        const err = new Error('Invalid URL-encoded data');
        err.status = 400;
        err.statusCode = 400;
        return next(err);
      }
      
      next();
    } catch (err) {
      if (err.message === 'Request body too large') {
        const error = new Error('Request Entity Too Large');
        error.status = 413;
        error.statusCode = 413;
        return next(error);
      }
      next(err);
    }
  };
}

/**
 * Combined body parser middleware factory
 * Automatically detects content-type and parses accordingly
 * Supports: application/json, application/x-www-form-urlencoded
 * 
 * @param {Object} options - Parser options (passed to individual parsers)
 * @returns {Function} Middleware function
 * 
 * @example
 * // Basic usage
 * app.use(bodyParser());
 * 
 * // With options
 * app.use(bodyParser({ limit: '50kb' }));
 */
export function bodyParser(options = {}) {
  const jsonParser = json(options);
  const urlencodedParser = urlencoded(options);
  
  return async (req, res, next) => {
    // Initialize body if not already set
    if (req.body === undefined || req.body === null) {
      req.body = null;
    }
    
    // Try JSON first
    if (isJSON(req)) {
      return jsonParser(req, res, next);
    }
    
    // Try URL-encoded
    if (isURLEncoded(req)) {
      return urlencodedParser(req, res, next);
    }
    
    // No matching content-type, skip
    next();
  };
}

/**
 * Body parser namespace object (Express-like API)
 * Allows: bodyParser.json(), bodyParser.urlencoded()
 */
const bodyParserNS = bodyParser;
bodyParserNS.json = json;
bodyParserNS.urlencoded = urlencoded;

export default bodyParserNS;
