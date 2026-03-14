import { parse } from 'node:url';
import { env } from 'node:process';
import { parseQueryString } from '../utils/index.js';

/**
 * Request class - wraps native Node.js IncomingMessage
 * Adds Express-like helpers and parsing
 */
export class Request {
  constructor(req) {
    this._raw = req;
    this.method = req.method;
    this.url = req.url;
    this.headers = req.headers;
    this.httpVersion = req.httpVersion;
    
    // Parsed URL components
    const parsed = parse(req.url, true);
    this.path = parsed.pathname;
    
    // Enhanced query string parsing with array/repeated parameter support
    this.query = parseQueryString(parsed.search || '');
    this.search = parsed.search;
    
    // Placeholder for route params (set by router)
    this.params = {};
    
    // Placeholder for body (parsed by middleware)
    this.body = null;
    
    // IP address
    this.ip = req.socket.remoteAddress;
    
    // Protocol
    this.protocol = req.socket.encrypted ? 'https' : 'http';
    
    // Hostname
    this.hostname = req.headers.host?.split(':')[0] || 'localhost';
    
    // Original request reference
    this.originalUrl = req.url;
  }
  
  /**
   * Get header by name (case-insensitive)
   */
  get(name) {
    return this.headers[name.toLowerCase()];
  }
  
  /**
   * Check if request accepts a content type
   */
  accepts(type) {
    const accept = this.headers.accept || '';
    return accept.includes(type);
  }
  
  /**
   * Check if request is JSON
   */
  is(type) {
    const contentType = this.headers['content-type'] || '';
    return contentType.includes(type);
  }
  
  /**
   * Parse request body as JSON
   */
  async json() {
    if (this.body !== null) {
      return this.body;
    }
    
    return new Promise((resolve, reject) => {
      let data = '';
      this._raw.on('data', chunk => data += chunk);
      this._raw.on('end', () => {
        try {
          this.body = data ? JSON.parse(data) : {};
          resolve(this.body);
        } catch (err) {
          reject(new Error('Invalid JSON'));
        }
      });
      this._raw.on('error', reject);
    });
  }
  
  /**
   * Parse request body as text
   */
  async text() {
    return new Promise((resolve, reject) => {
      let data = '';
      this._raw.on('data', chunk => data += chunk);
      this._raw.on('end', () => resolve(data));
      this._raw.on('error', reject);
    });
  }
  
  /**
   * Get raw Node.js request object
   */
  get raw() {
    return this._raw;
  }
}
