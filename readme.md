# grokexpress

A lightweight Express-like Node.js framework built with ES modules.

## Features

- 🚀 Built with native ES modules (no transpilation needed)
- 📝 Express-style routing with controllers
- 🔧 Middleware support
- 🧪 Built-in testing with Node.js test runner
- 📦 Zero dependencies

## Project Structure

```
grokexpress/
├── src/
│   ├── config/
│   │   └── config.js          # Configuration settings
│   ├── controllers/
│   │   ├── home.controller.js # Home route handlers
│   │   └── user.controller.js # User CRUD handlers
│   ├── middleware/
│   │   ├── errorHandler.js    # Global error handler
│   │   └── logger.js          # Request logger
│   ├── routes/
│   │   ├── home.routes.js     # Home route definitions
│   │   ├── user.routes.js     # User route definitions
│   │   └── index.js           # Router aggregator
│   ├── utils/                 # Utility functions
│   └── index.js               # Application entry point
├── test/
│   └── app.test.js            # Test suite
└── package.json
```

## Installation

```bash
npm install
```

## Usage

### Running the Application

```bash
# Development mode with auto-reload (Node.js 18+)
npm run dev

# Production mode
npm start
```

### Running Tests

```bash
npm test
```

### Build

Since this project uses ES modules, no build step is required. The build script is included for future compatibility:

```bash
npm run build
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API information |
| GET | `/health` | Health check |
| GET | `/users` | List all users |
| GET | `/users/:id` | Get user by ID |
| POST | `/users` | Create new user |
| PUT | `/users/:id` | Update user |
| DELETE | `/users/:id` | Delete user |

## Example Requests

```bash
# Get API info
curl http://localhost:3000/

# Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com"}'

# Get all users
curl http://localhost:3000/users

# Get user by ID
curl http://localhost:3000/users/1

# Update user
curl -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe"}'

# Delete user
curl -X DELETE http://localhost:3000/users/1
```

## Requirements

- Node.js >= 18.0.0

## License

MIT
