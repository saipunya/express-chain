# Copilot Instructions for express-chain

## Project Overview
- **Type:** Node.js/Express monolith
- **Key Directories:**
  - `controllers/`: Route logic, business rules, and API endpoints
  - `models/`: Data access and business entities (likely using an ORM or direct DB queries)
  - `middleware/` & `middlewares/`: Custom Express middleware (auth, logging, uploads, etc.)
  - `routes/`: Route definitions (may import controllers)
  - `config/`: Environment, DB, and path configuration
  - `cron/`: Scheduled/background jobs
  - `public/`, `uploads/`, `views/`: Static assets, file uploads, and server-rendered templates

## Architecture & Patterns
- **Controller-Model Pattern:** Controllers handle HTTP logic, models encapsulate data access. Avoid business logic in routes.
- **Middleware:** Custom middleware is split between `middleware/` and `middlewares/`. Check both for cross-cutting concerns.
- **Cron Jobs:** Automated/scheduled tasks live in `cron/` and are invoked via `cron-job.js`.
- **Socket Support:** Real-time features are handled in `socket.js`.
- **Config:** Centralized in `config/` (e.g., `db.js` for database, `paths.js` for file paths).

## Developer Workflows
- **Start App:** `node app.js` (or use `nodemon` for development)
- **Run Cron Jobs:** `node cron-job.js`
- **Testing:** No standard test framework detected; check for ad-hoc test files (e.g., `test-bcrypt.js`).
- **Debugging:** Use `console.log` or Node.js inspector. No custom debug tooling found.

## Conventions & Practices
- **File Naming:**
  - Controllers/models: `*Controller.js`, `*Model.js`
  - Middleware: `*Middleware.js` or `*Upload.js`
- **No TypeScript:** All code is JavaScript (ES6+)
- **No Monorepo:** Single app, not split into packages
- **No .env by default:** Config is JS-based, not .env

## Integration Points
- **Database:** See `config/db.js` and `models/`
- **External Services:** Check `services/` for integrations (not fully explored)
- **Socket.io:** Used for real-time features (see `socket.js`)

## Examples
- To add a new API endpoint: create a controller in `controllers/`, add a route in `routes/`, and update model if needed.
- To add middleware: place in `middleware/` or `middlewares/` and register in `app.js`.

## References
- Main entry: `app.js`
- Cron entry: `cron-job.js`
- Real-time: `socket.js`
- Config: `config/`

---
_If you are unsure about a pattern, search for similar files in the relevant directory. For new features, follow the naming and structure conventions above._
