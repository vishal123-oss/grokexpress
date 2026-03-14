/**
 * grokexpress - A lightweight Express-like Node.js framework
 * 
 * @module grokexpress
 */

import { createApplication, Router, grok } from './application.js';
import { Request } from './request.js';
import { Response } from './response.js';
import { MiddlewareStack, MiddlewarePipeline } from './middleware.js';
import { matchPath, pathMatches, normalizePath } from '../utils/index.js';
import { Route, createRoute } from './route.js';
import { RouteTable, createRouteTable } from './route-table.js';
import { RouteExecutor, executeRoute } from './route-executor.js';
import { STATUS_CODES, MIME_TYPES, RESPONSE_CONTENT_TYPES } from '../constants.js';

// Main exports
export { createApplication, Router, grok, Request, Response };

// Advanced exports for middleware manipulation
export { MiddlewareStack, MiddlewarePipeline };

// Utility exports
export { matchPath, pathMatches, normalizePath };

// Constants exports
export { STATUS_CODES, MIME_TYPES, RESPONSE_CONTENT_TYPES };

// Route system exports
export { Route, createRoute };
export { RouteTable, createRouteTable };
export { RouteExecutor, executeRoute };

// Static file serving
import staticMiddleware from '../middleware/static.js';
export { staticMiddleware };
export { staticMiddleware as serveStatic, getMimeType } from '../middleware/static.js';

// Default export for convenience
export default createApplication;
