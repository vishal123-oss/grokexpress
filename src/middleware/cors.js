/**
 * CORS (Cross-Origin Resource Sharing) Middleware
 * Enables secure cross-origin requests with full configuration
 * @module middleware/cors
 */

/**
 * Default CORS options
 */
const DEFAULT_CORS_OPTIONS = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: [],
  exposedHeaders: [],
  credentials: false,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

/**
 * Check if origin is allowed
 */
function isOriginAllowed(requestOrigin, allowedOrigin) {
  if (!requestOrigin) return false;
  if (allowedOrigin === '*') return '*';
  if (Array.isArray(allowedOrigin)) {
    return allowedOrigin.includes(requestOrigin) ? requestOrigin : false;
  }
  if (allowedOrigin instanceof RegExp) {
    return allowedOrigin.test(requestOrigin) ? requestOrigin : false;
  }
  if (typeof allowedOrigin === 'function') {
    const result = allowedOrigin(requestOrigin);
    return result === true ? requestOrigin : result;
  }
  return allowedOrigin === requestOrigin ? requestOrigin : false;
}

/**
 * Parse headers to string
 */
function parseHeaders(headers) {
  if (Array.isArray(headers)) return headers.join(', ');
  return headers;
}

/**
 * Configure CORS headers on response
 */
function configureHeaders(req, res, options) {
  const requestOrigin = req.get('origin');
  const origin = isOriginAllowed(requestOrigin, options.origin);
  
  if (!origin) return false;
  
  if (origin === '*') {
    res.set('Access-Control-Allow-Origin', '*');
  } else {
    res.set('Access-Control-Allow-Origin', origin);
    if (options.credentials) {
      res.set('Vary', 'Origin');
    }
  }
  
  if (options.credentials) {
    res.set('Access-Control-Allow-Credentials', 'true');
  }
  
  if (options.exposedHeaders && options.exposedHeaders.length > 0) {
    res.set('Access-Control-Expose-Headers', parseHeaders(options.exposedHeaders));
  }
  
  return true;
}

/**
 * Handle CORS preflight request
 */
function handlePreflight(req, res, options) {
  const requestOrigin = req.get('origin');
  const requestHeaders = req.get('access-control-request-headers');
  
  const origin = isOriginAllowed(requestOrigin, options.origin);
  if (!origin) {
    res.status(403).end('CORS: Origin not allowed');
    return false;
  }
  
  res.set('Access-Control-Allow-Origin', origin === '*' ? '*' : origin);
  
  if (options.credentials) {
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Vary', 'Origin');
  }
  
  if (options.methods) {
    res.set('Access-Control-Allow-Methods', parseHeaders(options.methods));
  }
  
  let allowedHeaders = options.allowedHeaders;
  if (!allowedHeaders || allowedHeaders.length === 0) {
    allowedHeaders = requestHeaders;
  }
  if (allowedHeaders) {
    res.set('Access-Control-Allow-Headers', parseHeaders(allowedHeaders));
  }
  
  if (options.maxAge) {
    res.set('Access-Control-Max-Age', String(options.maxAge));
  }
  
  return true;
}

/**
 * CORS middleware factory
 * @param {Object} options - CORS options
 * @param {string|Array|RegExp|Function} options.origin - Allowed origin(s)
 * @param {string|Array} options.methods - Allowed HTTP methods
 * @param {string|Array} options.allowedHeaders - Allowed request headers
 * @param {string|Array} options.exposedHeaders - Headers exposed to client
 * @param {boolean} options.credentials - Allow cookies/auth headers
 * @param {number} options.maxAge - Preflight cache duration (seconds)
 * @returns {Function} Middleware
 */
export function cors(options = {}) {
  const opts = { ...DEFAULT_CORS_OPTIONS, ...options };
  
  if (Array.isArray(opts.methods)) {
    opts.methods = opts.methods.join(',');
  }
  
  return (req, res, next) => {
    if (req.method === 'OPTIONS') {
      const success = handlePreflight(req, res, opts);
      if (opts.preflightContinue) {
        next();
      } else {
        res.status(opts.optionsSuccessStatus).end();
      }
      return;
    }
    
    const allowed = configureHeaders(req, res, opts);
    if (!allowed && opts.origin !== '*') {
      res.status(403).end('CORS: Origin not allowed');
      return;
    }
    
    next();
  };
}

/**
 * Simple CORS preset for development
 */
export function corsDev() {
  return cors({ origin: '*', credentials: true, methods: '*' });
}

/**
 * Strict CORS preset for production
 */
export function corsProd(allowedOrigins) {
  return cors({
    origin: allowedOrigins,
    credentials: true,
    maxAge: 3600,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  });
}

export default cors;
