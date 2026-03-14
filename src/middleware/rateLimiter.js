/**
 * Rate Limiting Middleware
 * Protects against DOS attacks and API abuse
 * @module middleware/rateLimiter
 */

/**
 * In-memory store for rate limiting
 */
class MemoryStore {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minute default
    this.max = options.max || 100;
    this.requests = new Map();
    this.resetTimer = null;
    
    // Clean up expired entries periodically
    this.startCleanup();
  }
  
  startCleanup() {
    this.resetTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.requests) {
        if (now - entry.startTime > this.windowMs) {
          this.requests.delete(key);
        }
      }
    }, this.windowMs);
    
    if (this.resetTimer.unref) {
      this.resetTimer.unref();
    }
  }
  
  increment(key) {
    const now = Date.now();
    let entry = this.requests.get(key);
    
    if (!entry || now - entry.startTime > this.windowMs) {
      entry = {
        count: 1,
        startTime: now,
        firstRequestTime: now
      };
      this.requests.set(key, entry);
      return { count: 1, remaining: this.max - 1, resetTime: now + this.windowMs };
    }
    
    entry.count++;
    const remaining = Math.max(0, this.max - entry.count);
    const resetTime = entry.startTime + this.windowMs;
    
    return { count: entry.count, remaining, resetTime };
  }
  
  reset(key) {
    this.requests.delete(key);
  }
  
  resetAll() {
    this.requests.clear();
  }
  
  get(key) {
    return this.requests.get(key);
  }
  
  stop() {
    if (this.resetTimer) {
      clearInterval(this.resetTimer);
      this.resetTimer = null;
    }
  }
}

/**
 * Default key generator (IP-based)
 */
function defaultKeyGenerator(req) {
  return req.ip || 
         req.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.get('x-real-ip') ||
         req.socket?.remoteAddress ||
         'unknown';
}

/**
 * Default handler when limit is exceeded
 */
function defaultHandler(req, res, next, options) {
  res.status(429).json({
    error: 'Too Many Requests',
    message: options.message || 'Rate limit exceeded. Please try again later.',
    retryAfter: options.retryAfter || 60
  });
}

/**
 * Default skip function (always false)
 */
function defaultSkip(req) {
  return false;
}

/**
 * Rate limiter middleware factory
 * 
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000)
 * @param {number} options.max - Max requests per window (default: 100)
 * @param {string} options.message - Custom error message
 * @param {number} options.retryAfter - Retry-After header value (seconds)
 * @param {Function} options.keyGenerator - Custom key generator (req) => string
 * @param {Function} options.handler - Custom handler when limit exceeded
 * @param {Function} options.skip - Skip rate limiting for certain requests (req) => boolean
 * @param {boolean} options.headers - Send rate limit headers (default: true)
 * @param {Object} options.store - Custom store (must have increment method)
 * @param {boolean} options.skipFailedRequests - Skip failed requests (4xx/5xx)
 * @param {boolean} options.skipSuccessfulRequests - Skip successful requests
 * @returns {Function} Middleware function
 * 
 * @example
 * // Basic usage - 100 requests per minute per IP
 * app.use(rateLimiter());
 * 
 * // Custom limits
 * app.use(rateLimiter({
 *   windowMs: 15 * 60 * 1000, // 15 minutes
 *   max: 100,                 // 100 requests per 15 min
 *   message: 'Too many requests, please try again later'
 * }));
 * 
 * // Strict limits for login endpoint
 * app.post('/login', rateLimiter({
 *   windowMs: 60 * 60 * 1000, // 1 hour
 *   max: 5,                   // 5 login attempts per hour
 *   message: 'Too many login attempts'
 * }), loginHandler);
 * 
 * // API key based limiting
 * app.use(rateLimiter({
 *   keyGenerator: (req) => req.get('x-api-key') || req.ip
 * }));
 */
export function rateLimiter(options = {}) {
  const opts = {
    windowMs: options.windowMs || 60000,
    max: options.max || 100,
    message: options.message || 'Too many requests, please try again later.',
    retryAfter: options.retryAfter || Math.ceil((options.windowMs || 60000) / 1000),
    keyGenerator: options.keyGenerator || defaultKeyGenerator,
    handler: options.handler || defaultHandler,
    skip: options.skip || defaultSkip,
    headers: options.headers !== false,
    skipFailedRequests: options.skipFailedRequests || false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    store: options.store || null
  };
  
  // Create store if not provided
  const store = opts.store || new MemoryStore(opts);
  
  return (req, res, next) => {
    // Skip if skip function returns true
    if (opts.skip(req)) {
      return next();
    }
    
    // Generate key for this request
    const key = opts.keyGenerator(req);
    
    // Increment and get current count
    const result = store.increment(key);
    
    // Set rate limit headers
    if (opts.headers) {
      res.set('X-RateLimit-Limit', String(opts.max));
      res.set('X-RateLimit-Remaining', String(result.remaining));
      res.set('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)));
    }
    
    // Check if limit exceeded
    if (result.count > opts.max) {
      // Set Retry-After header
      res.set('Retry-After', String(opts.retryAfter));
      
      // Call handler
      opts.handler(req, res, next, {
        ...opts,
        current: result.count,
        limit: opts.max,
        remaining: result.remaining,
        resetTime: result.resetTime
      });
      return;
    }
    
    // Handle skip options for response
    if (opts.skipFailedRequests || opts.skipSuccessfulRequests) {
      const originalEnd = res.end;
      res.end = function(...args) {
        const statusCode = res.statusCode;
        const isFailed = statusCode >= 400;
        const isSuccess = statusCode < 400;
        
        if ((opts.skipFailedRequests && isFailed) || 
            (opts.skipSuccessfulRequests && isSuccess)) {
          // Don't count this request
          const entry = store.get(key);
          if (entry && entry.count > 0) {
            entry.count--;
          }
        }
        
        return originalEnd.apply(this, args);
      };
    }
    
    next();
  };
}

/**
 * Create a sliding window rate limiter
 * More accurate but slightly more expensive
 */
export function slidingWindowLimiter(options = {}) {
  const opts = {
    windowMs: options.windowMs || 60000,
    max: options.max || 100,
    ...options
  };
  
  const requests = new Map();
  
  return (req, res, next) => {
    if (opts.skip && opts.skip(req)) {
      return next();
    }
    
    const key = (opts.keyGenerator || defaultKeyGenerator)(req);
    const now = Date.now();
    
    // Get or create request timestamps
    let timestamps = requests.get(key);
    if (!timestamps) {
      timestamps = [];
      requests.set(key, timestamps);
    }
    
    // Remove old timestamps
    const windowStart = now - opts.windowMs;
    while (timestamps.length > 0 && timestamps[0] < windowStart) {
      timestamps.shift();
    }
    
    // Add current request
    timestamps.push(now);
    
    // Set headers
    if (opts.headers !== false) {
      res.set('X-RateLimit-Limit', String(opts.max));
      res.set('X-RateLimit-Remaining', String(Math.max(0, opts.max - timestamps.length)));
      res.set('X-RateLimit-Reset', String(Math.ceil((now + opts.windowMs) / 1000)));
    }
    
    // Check limit
    if (timestamps.length > opts.max) {
      res.set('Retry-After', String(Math.ceil(opts.windowMs / 1000)));
      (opts.handler || defaultHandler)(req, res, next, opts);
      return;
    }
    
    next();
  };
}

/**
 * Token bucket rate limiter
 * Allows bursting up to a maximum
 */
export function tokenBucketLimiter(options = {}) {
  const opts = {
    bucketSize: options.bucketSize || options.max || 100,
    refillRate: options.refillRate || 10, // tokens per second
    ...options
  };
  
  const buckets = new Map();
  
  return (req, res, next) => {
    if (opts.skip && opts.skip(req)) {
      return next();
    }
    
    const key = (opts.keyGenerator || defaultKeyGenerator)(req);
    const now = Date.now();
    
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: opts.bucketSize,
        lastRefill: now
      };
      buckets.set(key, bucket);
    }
    
    // Refill tokens
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(opts.bucketSize, bucket.tokens + elapsed * opts.refillRate);
    bucket.lastRefill = now;
    
    // Set headers
    if (opts.headers !== false) {
      res.set('X-RateLimit-Limit', String(opts.bucketSize));
      res.set('X-RateLimit-Remaining', String(Math.floor(bucket.tokens)));
    }
    
    // Check if we have tokens
    if (bucket.tokens < 1) {
      const retryAfter = Math.ceil((1 - bucket.tokens) / opts.refillRate);
      res.set('Retry-After', String(retryAfter));
      (opts.handler || defaultHandler)(req, res, next, opts);
      return;
    }
    
    // Consume token
    bucket.tokens--;
    
    next();
  };
}

/**
 * Create a store instance
 */
export function createStore(options) {
  return new MemoryStore(options);
}

// Export store class
export { MemoryStore };

export default rateLimiter;
