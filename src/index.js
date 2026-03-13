import http from 'node:http';
import { config } from './config/config.js';
import { router } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './middleware/logger.js';

const PORT = config.port;

const server = http.createServer((req, res) => {
  // Attach response helpers
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };

  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  res.send = (data) => {
    res.end(data);
  };

  // Logger middleware
  logger(req, res, () => {
    // Router
    router(req, res, (err) => {
      if (err) {
        errorHandler(err, req, res);
      } else if (!res.writableEnded) {
        // 404 handler
        res.statusCode = 404;
        res.json({ error: 'Not Found', path: req.url });
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`🚀 grokexpress server running on http://localhost:${PORT}`);
});

export { server };
