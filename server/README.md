# Tavora Auth Server (SQLite)

Minimal Node.js server that provides user registration and login backed by SQLite.

Features
- Stores users in SQLite (`server/users.db`)
- Passwords are hashed with bcrypt
- Default admin user created at startup: username `admin`, password `Admin1`
- Endpoints:
  - `POST /api/register` { username, name, password } -> create user
  - `POST /api/login` { username, password } -> returns { token, user }
  - `GET /api/users` (admin, requires Bearer token) -> list users

Quick start
1. From the `server` folder install dependencies:

```bash
cd server
npm install
```

2. Start the server:

```bash
npm start
```

The server listens on port 4000 by default. You can set `PORT` and `JWT_SECRET` environment variables.

Notes for the frontend
- This repo's frontend is static files. To use the server from the browser you'll need to serve the frontend over HTTP (not `file://`) and update the client fetch calls to `http://localhost:4000/api/register` and `http://localhost:4000/api/login`.
- The server returns a JWT token on login. Store it in `localStorage` as `authToken` and include it in requests to protected endpoints as `Authorization: Bearer <token>`.

Security remarks
- This simple server is for demo/local use. For production harden the server (HTTPS, rotate JWT secret, rate limiting, email verification, password rules, CSRF protections, etc.).
