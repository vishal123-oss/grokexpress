/**
 * grokexpress - A lightweight Express-like Node.js framework
 * 
 * @module grokexpress
 */

import { createApplication, Router, grok } from './application.js';
import { Request } from './request.js';
import { Response } from './response.js';
import { MiddlewareStack, MiddlewarePipeline } from './middleware.js';
import { matchPath, pathMatches, normalizePath } from './utils.js';
import { Route, createRoute } from './route.js';
import { RouteTable, createRouteTable } from './route-table.js';
import { RouteExecutor, executeRoute } from './route-executor.js';

// Main exports
export { createApplication, Router, grok, Request, Response };

// Advanced exports for middleware manipulation
export { MiddlewareStack, MiddlewarePipeline };

// Utility exports
export { matchPath, pathMatches, normalizePath };

// Route system exports
export { Route, createRoute };
export { RouteTable, createRouteTable };
export { RouteExecutor, executeRoute };

// Default export for convenience
export default createApplication;
