/**
 * Response class - wraps native Node.js ServerResponse
 * Adds Express-like chainable helpers
 */
export class Response {
  constructor(res) {
    this._raw = res;
    this._statusCode = 200;
    this._headers = {};
    this._headersSent = false;
    this._body = null;
  }
  
  /**
   * Set status code (chainable)
   */
  status(code) {
    this._statusCode = code;
    return this;
  }
  
  /**
   * Set a header (chainable)
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
   */
  setHeader(field, value) {
    return this.set(field, value);
  }
  
  /**
   * Get a header
   */
  get(field) {
    return this._headers[field.toLowerCase()];
  }
  
  /**
   * Set Content-Type header (chainable)
   */
  type(contentType) {
    const types = {
      html: 'text/html',
      json: 'application/json',
      text: 'text/plain',
      xml: 'application/xml',
      form: 'application/x-www-form-urlencoded',
      binary: 'application/octet-stream'
    };
    
    this._headers['content-type'] = types[contentType] || contentType;
    return this;
  }
  
  /**
   * Send JSON response
   */
  json(data) {
    this._headers['content-type'] = 'application/json';
    this._body = JSON.stringify(data);
    return this._send();
  }
  
  /**
   * Send JSONP response
   */
  jsonp(data, callback = 'callback') {
    this._headers['content-type'] = 'application/javascript';
    this._body = `${callback}(${JSON.stringify(data)})`;
    return this._send();
  }
  
  /**
   * Send text/html response
   */
  send(data) {
    if (typeof data === 'object') {
      return this.json(data);
    }
    
    if (typeof data === 'string') {
      if (!this._headers['content-type']) {
        this._headers['content-type'] = 'text/html';
      }
    }
    
    this._body = data;
    return this._send();
  }
  
  /**
   * Send plain text response
   */
  text(data) {
    this._headers['content-type'] = 'text/plain';
    this._body = String(data);
    return this._send();
  }
  
  /**
   * Send HTML response
   */
  html(data) {
    this._headers['content-type'] = 'text/html';
    this._body = data;
    return this._send();
  }
  
  /**
   * Send redirect response
   */
  redirect(url, status = 302) {
    this._statusCode = status;
    this._headers['location'] = url;
    this._body = `Redirecting to ${url}`;
    return this._send();
  }
  
  /**
   * Send 404 Not Found
   */
  notFound(message = 'Not Found') {
    return this.status(404).json({ error: message, status: 404 });
  }
  
  /**
   * Send error response
   */
  error(message, status = 500) {
    return this.status(status).json({
      error: message,
      status,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Set cookie
   */
  cookie(name, value, options = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    
    if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
    if (options.domain) parts.push(`Domain=${options.domain}`);
    if (options.path) parts.push(`Path=${options.path}`);
    if (options.secure) parts.push('Secure');
    if (options.httpOnly) parts.push('HttpOnly');
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    
    const existing = this._headers['set-cookie'] || [];
    this._headers['set-cookie'] = [...existing, parts.join('; ')];
    
    return this;
  }
  
  /**
   * Clear cookie
   */
  clearCookie(name, options = {}) {
    return this.cookie(name, '', { ...options, maxAge: 0 });
  }
  
  /**
   * Append to header
   */
  append(field, value) {
    const existing = this._headers[field.toLowerCase()];
    if (existing) {
      this._headers[field.toLowerCase()] = [].concat(existing).concat(value);
    } else {
      this._headers[field.toLowerCase()] = value;
    }
    return this;
  }
  
  /**
   * End response (no body)
   */
  end(data) {
    if (data) this._body = data;
    return this._send();
  }
  
  /**
   * Check if headers sent
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
   */
  get writableEnded() {
    return this._raw.writableEnded;
  }
  
  /**
   * Get raw Node.js response object
   */
  get raw() {
    return this._raw;
  }
  
  /**
   * Internal send method
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
