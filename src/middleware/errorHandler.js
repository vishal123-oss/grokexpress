export function errorHandler(err, req, res) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.statusCode = statusCode;
  res.json({
    error: {
      message,
      status: statusCode,
      timestamp: new Date().toISOString()
    }
  });
}
