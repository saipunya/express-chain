# AGENT WORK SCOPE

Default development scope for this repository is **`/promotion` only**.

## Rules
- Treat the promotion system as a separate subsystem from the main app.
- Only modify files related to promotion flows, such as:
  - `routes/promotionRoutes.js`
  - `controllers/promotionController.js`
  - `controllers/promotionAdminController.js`
  - `models/promotionModel.js`
  - `models/promotion/*`
  - `views/promotion/*`
  - `docs/promotion-*`
- Do not modify non-promotion modules unless the user explicitly asks for it in the current request.
- If a requested change appears to require non-promotion edits, pause and ask for confirmation first.
