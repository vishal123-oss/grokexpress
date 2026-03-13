import { config } from '../config/config.js';

export const homeController = {
  getHome: (req, res) => {
    res.json({
      name: config.name,
      version: '1.0.0',
      description: 'A lightweight Express-like Node.js framework',
      endpoints: [
        { method: 'GET', path: '/' },
        { method: 'GET', path: '/health' },
        { method: 'GET', path: '/users' },
        { method: 'GET', path: '/users/:id' },
        { method: 'POST', path: '/users' },
        { method: 'PUT', path: '/users/:id' },
        { method: 'DELETE', path: '/users/:id' }
      ]
    });
  },

  getHealth: (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  }
};
