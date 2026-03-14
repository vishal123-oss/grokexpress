/**
 * Static File Serving Middleware
 * Serves static files from a directory with streaming, MIME detection, and caching
 * @module middleware/static
 */

import { createReadStream, statSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * MIME types for common file extensions
 */
const MIME_TYPES = {
  // Text
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  
  // Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  
  // Audio/Video
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  
  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  
  // Default
  '': 'application/octet-stream'
};

/**
 * Get MIME type from file extension
 * @param {string} filepath - File path or extension
 * @returns {string} MIME type
 */
export function getMimeType(filepath) {
  const ext = extname(filepath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Generate ETag from file stats
 * @param {Object} stats - fs.Stats object
 * @returns {string} ETag value
 */
function generateETag(stats) {
  const hash = createHash('md5')
    .update(`${stats.size}-${stats.mtime.getTime()}`)
    .digest('hex');
  return `"${hash}"`;
}

/**
 * Parse Cache-Control max-age option
 * @param {number|string} maxAge - Max age in seconds or string like '1h'
 * @returns {number} Max age in seconds
 */
function parseMaxAge(maxAge) {
  if (typeof maxAge === 'number') return maxAge;
  if (typeof maxAge === 'string') {
    const match = maxAge.match(/^(\d+)(ms|s|m|h|d|w|y)?$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      const unit = (match[2] || 's').toLowerCase();
      const multipliers = {
        ms: 0.001,
        s: 1,
        m: 60,
        h: 3600,
        d: 86400,
        w: 604800,
        y: 31536000
      };
      return Math.floor(num * (multipliers[unit] || 1));
    }
  }
  return 0;
}

/**
 * Check if request is conditional (has If-None-Match or If-Modified-Since)
 * @param {Request} req - Request object
 * @param {string} etag - Current ETag
 * @param {Date} lastModified - Last modified date
 * @returns {boolean} True if 304 should be returned
 */
function shouldReturnNotModified(req, etag, lastModified) {
  // Check If-None-Match header
  const ifNoneMatch = req.get('if-none-match');
  if (ifNoneMatch) {
    // Support wildcard
    if (ifNoneMatch === '*') return true;
    
    // Parse ETags (can be comma-separated)
    const etags = ifNoneMatch.split(',').map(e => e.trim().replace(/^W\//, ''));
    if (etags.includes(etag) || etags.includes(`"${etag}"`)) return true;
  }
  
  // Check If-Modified-Since header
  const ifModifiedSince = req.get('if-modified-since');
  if (ifModifiedSince && !ifNoneMatch) {
    const since = new Date(ifModifiedSince);
    if (!isNaN(since.getTime()) && lastModified <= since) {
      return true;
    }
  }
  
  return false;
}

/**
 * Build Cache-Control header value
 * @param {Object} opts - Options
 * @param {number} maxAge - Max age in seconds
 * @param {number} sMaxAge - Shared max-age (CDN)
 * @returns {string} Cache-Control value
 */
function buildCacheControl(opts, maxAge, sMaxAge) {
  const parts = [];
  const cc = opts.cacheControl || {};
  
  // Cache type directive
  if (cc.type) {
    parts.push(cc.type);
  } else if (opts.immutable) {
    parts.push('public');
  } else if (maxAge > 0) {
    parts.push('public');
  }
  
  // Max-age
  if (maxAge > 0) {
    parts.push(`max-age=${maxAge}`);
  }
  
  // Shared max-age (for CDNs/proxies)
  if (sMaxAge !== null && sMaxAge > 0) {
    parts.push(`s-maxage=${sMaxAge}`);
  }
  
  // Immutable
  if (opts.immutable) {
    parts.push('immutable');
  }
  
  // Stale-while-revalidate
  if (cc.staleWhileRevalidate) {
    const swr = typeof cc.staleWhileRevalidate === 'number' ? cc.staleWhileRevalidate : 86400;
    parts.push(`stale-while-revalidate=${swr}`);
  }
  
  // Stale-if-error
  if (cc.staleIfError) {
    const sie = typeof cc.staleIfError === 'number' ? cc.staleIfError : 86400;
    parts.push(`stale-if-error=${sie}`);
  }
  
  // Must-revalidate
  if (cc.mustRevalidate) {
    parts.push('must-revalidate');
  }
  
  // No-transform
  if (cc.noTransform) {
    parts.push('no-transform');
  }
  
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Send file response with streaming
 * @param {Response} res - Response object
 * @param {string} filepath - Full path to file
 * @param {Object} options - Response options
 */
function sendFile(res, filepath, options = {}) {
  const { 
    stats, mimeType, etag, lastModified, maxAge, immutable, 
    opts, sMaxAge, acceptRanges, setExpires 
  } = options;
  
  // Set core headers
  res.set('Content-Type', mimeType);
  res.set('Content-Length', stats.size);
  res.set('X-Content-Type-Options', 'nosniff');
  
  // Accept-Ranges for resumable downloads
  if (acceptRanges !== false) {
    res.set('Accept-Ranges', 'bytes');
  }
  
  // Last-Modified
  if (lastModified) {
    res.set('Last-Modified', lastModified.toUTCString());
  }
  
  // ETag
  if (etag) {
    res.set('ETag', etag);
  }
  
  // Build and set Cache-Control
  const cacheControlValue = buildCacheControl(opts, maxAge, sMaxAge);
  if (cacheControlValue) {
    res.set('Cache-Control', cacheControlValue);
  }
  
  // Expires header (HTTP/1.0 compatibility)
  if (setExpires !== false && maxAge > 0) {
    const expiresDate = new Date(Date.now() + maxAge * 1000);
    res.set('Expires', expiresDate.toUTCString());
  }
  
  // Pragma for HTTP/1.0
  if (opts.cacheControl?.type === 'no-cache' || opts.cacheControl?.type === 'no-store') {
    res.set('Pragma', 'no-cache');
  }
  
  // Vary header for proper caching with content negotiation
  if (opts.vary) {
    const varyValue = Array.isArray(opts.vary) ? opts.vary.join(', ') : opts.vary;
    res.set('Vary', varyValue);
  }
  
  // Call custom setHeaders
  if (opts.setHeaders) {
    try {
      opts.setHeaders(res, filepath, stats);
    } catch (err) {
      // Ignore errors
    }
  }
  
  // Stream the file
  const stream = createReadStream(filepath);
  
  stream.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).end('Internal Server Error');
    }
  });
  
  stream.pipe(res._raw || res);
}

/**
 * Static file serving middleware factory
 * Creates middleware to serve static files from a directory
 * 
 * @param {string} root - Root directory to serve files from
 * @param {Object} options - Middleware options
 * @param {number|string} options.maxAge - Cache max-age (default: 0)
 * @param {boolean} options.immutable - Add immutable directive (default: false)
 * @param {string} options.index - Index file name (default: 'index.html')
 * @param {boolean} options.dotfiles - Serve dotfiles (default: false)
 * @param {boolean} options.fallthrough - Call next() if file not found (default: true)
 * @param {boolean} options.etag - Generate ETags (default: true)
 * @param {boolean} options.lastModified - Set Last-Modified (default: true)
 * @param {string} options.setHeaders - Custom header function (req, path, stat) => {}
 * @param {string} options.prefix - Mount prefix to strip from path (auto-detected if not set)
 * @param {Object} options.cacheControl - Advanced cache control options
 * @param {string} options.cacheControl.type - 'public' | 'private' | 'no-cache' | 'no-store' | 'must-revalidate'
 * @param {string} options.cacheControl.sMaxAge - Shared proxy cache max-age (CDN)
 * @param {boolean} options.cacheControl.staleWhileRevalidate - Add stale-while-revalidate
 * @param {boolean} options.cacheControl.staleIfError - Add stale-if-error
 * @param {boolean} options.acceptRanges - Set Accept-Ranges header (default: true)
 * @param {boolean} options.setExpires - Set Expires header based on maxAge (default: true)
 * @returns {Function} Middleware function
 * 
 * @example
 * // Basic usage
 * app.use('/static', staticMiddleware('./public'));
 * 
 * // With caching options
 * app.use('/assets', staticMiddleware('./assets', {
 *   maxAge: '1y',
 *   immutable: true,
 *   cacheControl: {
 *     type: 'public',
 *     sMaxAge: '1y',           // CDN cache
 *     staleWhileRevalidate: true
 *   }
 * }));
 */
export function staticMiddleware(root, options = {}) {
  const opts = {
    maxAge: options.maxAge || 0,
    immutable: options.immutable || false,
    index: options.index !== undefined ? options.index : 'index.html',
    dotfiles: options.dotfiles || false,
    fallthrough: options.fallthrough !== false,
    etag: options.etag !== false,
    lastModified: options.lastModified !== false,
    setHeaders: options.setHeaders || null,
    prefix: options.prefix || null,
    cacheControl: options.cacheControl || {},
    acceptRanges: options.acceptRanges !== false,
    setExpires: options.setExpires !== false
  };
  
  const maxAgeSeconds = parseMaxAge(opts.maxAge);
  const sMaxAge = opts.cacheControl.sMaxAge ? parseMaxAge(opts.cacheControl.sMaxAge) : null;
  const rootPath = resolve(root);
  
  return (req, res, next) => {
    // Only handle GET and HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (opts.fallthrough) {
        return next();
      }
      res.status(405).set('Allow', 'GET, HEAD').end();
      return;
    }
    
    // Get the requested path relative to the mount point
    let requestPath = req.path || '/';
    
    // Strip mount prefix if provided or auto-detect from req.baseUrl
    if (opts.prefix) {
      const prefix = opts.prefix.startsWith('/') ? opts.prefix : '/' + opts.prefix;
      if (requestPath.startsWith(prefix)) {
        requestPath = requestPath.slice(prefix.length) || '/';
      }
    } else if (req.baseUrl) {
      // Auto-strip baseUrl if set by router
      if (requestPath.startsWith(req.baseUrl)) {
        requestPath = requestPath.slice(req.baseUrl.length) || '/';
      }
    }
    
    // Remove query string
    requestPath = requestPath.split('?')[0];
    
    // Security: prevent path traversal
    const normalizedPath = normalize(requestPath).replace(/^\/+/, '');
    
    // Check for dotfiles
    if (!opts.dotfiles && normalizedPath.split('/').some(part => part.startsWith('.'))) {
      if (opts.fallthrough) {
        return next();
      }
      res.status(403).end('Forbidden');
      return;
    }
    
    // Build full file path
    let filepath = join(rootPath, normalizedPath);
    
    // Resolve to prevent escaping root
    const resolvedPath = resolve(filepath);
    if (!resolvedPath.startsWith(rootPath)) {
      if (opts.fallthrough) {
        return next();
      }
      res.status(403).end('Forbidden');
      return;
    }
    
    // Check if file exists
    let stats;
    try {
      stats = statSync(resolvedPath);
    } catch (err) {
      // File not found
      if (opts.fallthrough) {
        return next();
      }
      res.status(404).end('Not Found');
      return;
    }
    
    // If directory, try index file
    if (stats.isDirectory()) {
      if (opts.index) {
        const indexPath = join(resolvedPath, opts.index);
        try {
          stats = statSync(indexPath);
          filepath = indexPath;
        } catch (err) {
          if (opts.fallthrough) {
            return next();
          }
          res.status(404).end('Not Found');
          return;
        }
      } else {
        if (opts.fallthrough) {
          return next();
        }
        res.status(404).end('Not Found');
        return;
      }
    }
    
    // Generate cache headers
    const etag = opts.etag ? generateETag(stats) : null;
    const lastModified = opts.lastModified ? stats.mtime : null;
    const mimeType = getMimeType(filepath);
    
    // Check conditional request
    if (etag && shouldReturnNotModified(req, etag, lastModified)) {
      res.status(304).end();
      return;
    }
    
    // Call custom setHeaders if provided
    if (opts.setHeaders) {
      try {
        opts.setHeaders(res, filepath, stats);
      } catch (err) {
        // Ignore setHeaders errors
      }
    }
    
    // For HEAD requests, just send headers
    if (req.method === 'HEAD') {
      res.set('Content-Type', mimeType);
      res.set('Content-Length', stats.size);
      res.set('X-Content-Type-Options', 'nosniff');
      
      if (acceptRanges !== false) {
        res.set('Accept-Ranges', 'bytes');
      }
      if (etag) res.set('ETag', etag);
      if (lastModified) res.set('Last-Modified', lastModified.toUTCString());
      
      // Build cache control for HEAD
      const ccValue = buildCacheControl(opts, maxAgeSeconds, sMaxAge);
      if (ccValue) res.set('Cache-Control', ccValue);
      
      if (opts.setExpires !== false && maxAgeSeconds > 0) {
        res.set('Expires', new Date(Date.now() + maxAgeSeconds * 1000).toUTCString());
      }
      
      if (opts.vary) {
        const varyValue = Array.isArray(opts.vary) ? opts.vary.join(', ') : opts.vary;
        res.set('Vary', varyValue);
      }
      
      res.status(200).end();
      return;
    }
    
    // Stream the file
    sendFile(res, filepath, {
      stats,
      mimeType,
      etag,
      lastModified,
      maxAge: maxAgeSeconds,
      immutable: opts.immutable,
      opts,
      sMaxAge,
      acceptRanges: opts.acceptRanges,
      setExpires: opts.setExpires
    });
  };
}

/**
 * Static file serving middleware (alias)
 */
export const serveStatic = staticMiddleware;

export default staticMiddleware;
