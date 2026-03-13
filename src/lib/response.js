/**
 * Response Module - Express-like response wrapper
 * @module response
 */

/**
 * HTTP status codes and their default messages
 */
const STATUS_CODES = {
  100: 'Continue',
  101: 'Switching Protocols',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Payload Too Large',
  414: 'URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable',
  417: 'Expectation Failed',
  418: "I'm a teapot",
  421: 'Misdirected Request',
  422: 'Unprocessable Entity',
  423: 'Locked',
  424: 'Failed Dependency',
  425: 'Too Early',
  426: 'Upgrade Required',
  428: 'Precondition Required',
  429: 'Too Many Requests',
  431: 'Request Header Fields Too Large',
  451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported'
};

/**
 * Mime type mapping for common file extensions
 */
const MIME_TYPES = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject'
};

/**
 * Response class - wraps native Node.js ServerResponse
 * Provides Express-like chainable methods
 */
export class Response {
  constructor(res) {
    this._raw = res;
    this._statusCode = 200;
    this._headers = {};
    this._headersSent = false;
    this._body = null;
    this._locals = {};
  }
  
  // ============================================
  // Status & Headers
  // ============================================
  
  /**
   * Set status code (chainable)
   * @param {number} code - HTTP status code
   * @returns {Response}
   */
  status(code) {
    this._statusCode = code;
    return this;
  }
  
  /**
   * Send status code with its default message
   * @param {number} code - HTTP status code
   * @returns {Response}
   */
  sendStatus(code) {
    const message = STATUS_CODES[code] || 'Unknown';
    this._statusCode = code;
    this._headers['content-type'] = 'text/plain';
    this._body = String(message);
    return this._send();
  }
  
  /**
   * Set a header (chainable)
   * @param {string|Object} field - Header name or object with headers
   * @param {string} value - Header value
   * @returns {Response}
   */
  set(field, value) {
    if (typeof field === 'object') {
      Object.assign(this._headers, field);
    } else {
      this._headers[field.toLowerCase()] = value;
    }
    return this;
  }
  
  /**
   * Alias for set()
   * @param {string|Object} field - Header name or object
   * @param {string} value - Header value
   * @returns {Response}
   */
  setHeader(field, value) {
    return this.set(field, value);
  }
  
  /**
   * Get a header value
   * @param {string} field - Header name
   * @returns {string|undefined}
   */
  get(field) {
    return this._headers[field.toLowerCase()];
  }
  
  /**
   * Get all headers
   * @returns {Object}
   */
  getHeaders() {
    return { ...this._headers };
  }
  
  /**
   * Check if a header exists
   * @param {string} field - Header name
   * @returns {boolean}
   */
  hasHeader(field) {
    return field.toLowerCase() in this._headers;
  }
  
  /**
   * Remove a header
   * @param {string} field - Header name
   * @returns {Response}
   */
  removeHeader(field) {
    delete this._headers[field.toLowerCase()];
    return this;
  }
  
  /**
   * Append to header (adds to existing value)
   * @param {string} field - Header name
   * @param {string} value - Header value to append
   * @returns {Response}
   */
  append(field, value) {
    const key = field.toLowerCase();
    const existing = this._headers[key];
    if (existing) {
      this._headers[key] = [].concat(existing).concat(value);
    } else {
      this._headers[key] = value;
    }
    return this;
  }
  
  /**
   * Add Link header
   * @param {Object} links - Object with rel:url pairs
   * @returns {Response}
   */
  links(links) {
    const linkHeader = Object.entries(links)
      .map(([rel, url]) => `<${url}>; rel="${rel}"`)
      .join(', ');
    return this.set('Link', linkHeader);
  }
  
  /**
   * Set Location header
   * @param {string} path - URL path
   * @returns {Response}
   */
  location(path) {
    return this.set('Location', path);
  }
  
  /**
   * Add Vary header
   * @param {string|Array} field - Header name(s)
   * @returns {Response}
   */
  vary(field) {
    const fields = Array.isArray(field) ? field : [field];
    const existing = this._headers['vary'];
    const existingFields = existing ? existing.split(', ').map(f => f.trim()) : [];
    const allFields = [...existingFields, ...fields];
    // Remove duplicates while preserving order
    this._headers['vary'] = [...new Set(allFields)].join(', ');
    return this;
  }
  
  // ============================================
  // Content Type
  // ============================================
  
  /**
   * Set Content-Type header (chainable)
   * @param {string} contentType - Mime type or shorthand (html, json, text, etc.)
   * @returns {Response}
   */
  type(contentType) {
    const types = {
      html: 'text/html',
      json: 'application/json',
      text: 'text/plain',
      xml: 'application/xml',
      form: 'application/x-www-form-urlencoded',
      urlencoded: 'application/x-www-form-urlencoded',
      binary: 'application/octet-stream',
      css: 'text/css',
      js: 'application/javascript',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml'
    };
    
    this._headers['content-type'] = types[contentType] || contentType;
    return this;
  }
  
  /**
   * Alias for type()
   * @param {string} type - Content type
   * @returns {Response}
   */
  contentType(type) {
    return this.type(type);
  }
  
  // ============================================
  // Response Body Methods
  // ============================================
  
  /**
   * Send JSON response
   * @param {*} data - Data to serialize as JSON
   * @returns {Response}
   */
  json(data) {
    this._headers['content-type'] = 'application/json';
    this._body = JSON.stringify(data);
    return this._send();
  }
  
  /**
   * Send JSON response with pretty print
   * @param {*} data - Data to serialize
   * @returns {Response}
   */
  jsonp(data, callback = 'callback') {
    this._headers['content-type'] = 'application/javascript';
    this._body = `${callback}(${JSON.stringify(data)})`;
    return this._send();
  }
  
  /**
   * Send response (auto-detects content type)
   * @param {*} data - Response body
   * @returns {Response}
   */
  send(data) {
    // Handle null/undefined
    if (data == null) {
      return this._send();
    }
    
    // Handle objects (convert to JSON)
    if (typeof data === 'object') {
      return this.json(data);
    }
    
    // Handle strings
    if (typeof data === 'string') {
      if (!this._headers['content-type']) {
        this._headers['content-type'] = 'text/html';
      }
    }
    
    // Handle numbers
    if (typeof data === 'number') {
      this._body = String(data);
    } else {
      this._body = data;
    }
    
    return this._send();
  }
  
  /**
   * Send plain text response
   * @param {string} data - Text content
   * @returns {Response}
   */
  text(data) {
    this._headers['content-type'] = 'text/plain';
    this._body = String(data);
    return this._send();
  }
  
  /**
   * Send HTML response
   * @param {string} data - HTML content
   * @returns {Response}
   */
  html(data) {
    this._headers['content-type'] = 'text/html';
    this._body = data;
    return this._send();
  }
  
  /**
   * Send XML response
   * @param {string} data - XML content
   * @returns {Response}
   */
  xml(data) {
    this._headers['content-type'] = 'application/xml';
    this._body = data;
    return this._send();
  }
  
  // ============================================
  // Redirects
  // ============================================
  
  /**
   * Send redirect response
   * @param {string} url - URL to redirect to
   * @param {number} status - HTTP status code (default: 302)
   * @returns {Response}
   */
  redirect(url, status = 302) {
    this._statusCode = status;
    this._headers['location'] = url;
    this._body = `Redirecting to ${url}`;
    return this._send();
  }
  
  // ============================================
  // Error Responses
  // ============================================
  
  /**
   * Send 404 Not Found
   * @param {string} message - Error message
   * @returns {Response}
   */
  notFound(message = 'Not Found') {
    return this.status(404).json({ error: message, status: 404 });
  }
  
  /**
   * Send error response
   * @param {string} message - Error message
   * @param {number} status - HTTP status code (default: 500)
   * @returns {Response}
   */
  error(message, status = 500) {
    return this.status(status).json({
      error: message,
      status,
      timestamp: new Date().toISOString()
    });
  }
  
  // ============================================
  // Cookies
  // ============================================
  
  /**
   * Set cookie
   * @param {string} name - Cookie name
   * @param {string} value - Cookie value
   * @param {Object} options - Cookie options
   * @returns {Response}
   */
  cookie(name, value, options = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    
    if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
    if (options.domain) parts.push(`Domain=${options.domain}`);
    if (options.path) parts.push(`Path=${options.path}`);
    if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
    if (options.secure) parts.push('Secure');
    if (options.httpOnly) parts.push('HttpOnly');
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    
    const existing = this._headers['set-cookie'] || [];
    this._headers['set-cookie'] = [...existing, parts.join('; ')];
    
    return this;
  }
  
  /**
   * Clear cookie
   * @param {string} name - Cookie name
   * @param {Object} options - Cookie options
   * @returns {Response}
   */
  clearCookie(name, options = {}) {
    return this.cookie(name, '', { ...options, maxAge: 0 });
  }
  
  // ============================================
  // Content Negotiation
  // ============================================
  
  /**
   * Perform content negotiation and send appropriate response
   * @param {Object} options - Object with format handlers
   * @returns {Response}
   */
  format(options) {
    const accept = this._raw.req.headers['accept'] || '*/*';
    
    // Check for exact mime type matches
    for (const [type, handler] of Object.entries(options)) {
      if (accept.includes(type)) {
        return handler(this);
      }
    }
    
    // Check for 'default' fallback
    if (options.default) {
      return options.default(this);
    }
    
    // No match found
    return this.status(406).json({
      error: 'Not Acceptable',
      message: 'None of the requested content types are available'
    });
  }
  
  // ============================================
  // File Handling
  // ============================================
  
  /**
   * Set Content-Disposition to attachment
   * @param {string} filename - Optional filename
   * @returns {Response}
   */
  attachment(filename) {
    if (filename) {
      const ext = filename.slice(filename.lastIndexOf('.'));
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
      this.type(mimeType);
      this.set('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      this.set('Content-Disposition', 'attachment');
    }
    return this;
  }
  
  /**
   * Send file for download
   * @param {string} path - File path
   * @param {string} filename - Download filename
   * @param {Object} options - Additional options
   * @returns {Response}
   */
  download(path, filename, options = {}) {
    const downloadName = filename || path.split('/').pop();
    this.attachment(downloadName);
    
    if (options.headers) {
      this.set(options.headers);
    }
    
    // Note: Actual file reading would require fs module
    // This sets up the headers for file download
    this._body = null; // File content would go here
    return this._send();
  }
  
  /**
   * Send file content
   * @param {string} path - File path
   * @param {Object} options - Options (root, headers, etc.)
   * @returns {Response}
   */
  sendFile(path, options = {}) {
    // Set content type based on extension
    const ext = path.slice(path.lastIndexOf('.'));
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    this.type(mimeType);
    
    if (options.headers) {
      this.set(options.headers);
    }
    
    if (options.lastModified) {
      this.set('Last-Modified', options.lastModified.toUTCString());
    }
    
    // Note: Actual file reading would require fs module
    this._body = null; // File content would go here
    return this._send();
  }
  
  // ============================================
  // Response Control
  // ============================================
  
  /**
   * End response (no body or optional data)
   * @param {string} data - Optional final data chunk
   * @returns {Response}
   */
  end(data) {
    if (data) this._body = data;
    return this._send();
  }
  
  /**
   * Set local variables (for view rendering)
   * @param {string|Object} name - Variable name or object
   * @param {*} value - Variable value
   * @returns {Response}
   */
  locals(name, value) {
    if (typeof name === 'object') {
      Object.assign(this._locals, name);
    } else if (value !== undefined) {
      this._locals[name] = value;
    }
    return this;
  }
  
  /**
   * Get local variables
   * @returns {Object}
   */
  getLocals() {
    return { ...this._locals };
  }
  
  // ============================================
  // Getters
  // ============================================
  
  /**
   * Check if headers have been sent
   * @returns {boolean}
   */
  get headersSent() {
    return this._raw.headersSent;
  }
  
  /**
   * Get/set status code
   */
  get statusCode() {
    return this._statusCode;
  }
  
  set statusCode(code) {
    this._statusCode = code;
  }
  
  /**
   * Get writable ended state
   * @returns {boolean}
   */
  get writableEnded() {
    return this._raw.writableEnded;
  }
  
  /**
   * Get raw Node.js response object
   * @returns {ServerResponse}
   */
  get raw() {
    return this._raw;
  }
  
  // ============================================
  // Private Methods
  // ============================================
  
  /**
   * Internal send method - writes to response stream
   * @private
   * @returns {Response}
   */
  _send() {
    if (this._raw.headersSent || this._raw.writableEnded) {
      return this;
    }
    
    // Set status code
    this._raw.statusCode = this._statusCode;
    
    // Set headers
    for (const [key, value] of Object.entries(this._headers)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          this._raw.appendHeader(key, v);
        }
      } else {
        this._raw.setHeader(key, value);
      }
    }
    
    // Set content-length if body exists
    if (this._body) {
      this._raw.setHeader('content-length', Buffer.byteLength(this._body));
    }
    
    // End response
    this._raw.end(this._body);
    this._headersSent = true;
    
    return this;
  }
}

/**
 * Create a new Response wrapper
 * @param {ServerResponse} res - Native Node.js response
 * @returns {Response}
 */
export function createResponse(res) {
  return new Response(res);
}

