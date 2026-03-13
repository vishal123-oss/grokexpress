import { homeRoutes } from './home.routes.js';
import { userRoutes } from './user.routes.js';

const routes = [
  ...homeRoutes,
  ...userRoutes
];

export function router(req, res, next) {
  const { method, url } = req;

  // Find matching route
  const route = routes.find(r => {
    const pathMatch = r.path === url || matchPattern(r.path, url);
    return r.method === method && pathMatch;
  });

  if (route) {
    // Extract params if pattern matching
    req.params = extractParams(route.path, url);

    // Execute route handler
    try {
      route.handler(req, res);
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
}

function matchPattern(pattern, url) {
  const regex = new RegExp('^' + pattern.replace(/:([^/]+)/g, '([^/]+)') + '$');
  return regex.test(url);
}

function extractParams(pattern, url) {
  const keys = pattern.match(/:([^/]+)/g) || [];
  const regex = new RegExp('^' + pattern.replace(/:([^/]+)/g, '([^/]+)') + '$');
  const values = url.match(regex);

  const params = {};
  if (values) {
    keys.forEach((key, index) => {
      params[key.slice(1)] = values[index + 1];
    });
  }
  return params;
}
