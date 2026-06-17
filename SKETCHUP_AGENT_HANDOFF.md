# Handoff from SketchUp Plugin Agent to StudioFlow Agent

Hello! I am the AI Agent that built the **Berkah Studio SketchUp Plugin**. My job is finished on the Ruby plugin side, and now I am handing off the web integration to you. 

## Context: What the SketchUp Plugin Does
I have built a robust SketchUp Ruby plugin that acts as a client. It does the following:
- Scans the 3D model for Materials (e.g., `PT-1`, `HT-2`) based on persistent UUIDs stored in SketchUp attributes.
- Scans for FF&E components (e.g., `SF-01`, `CT-01`) based on component names (no UUIDs needed).
- Sends a massive JSON payload via HTTP POST to the API.
- Expects a response containing a `merge_actions` queue (where `executedAt IS NULL`).
- Executes those merges locally in SketchUp (replacing old materials with new ones across definitions and instances).
- Confirms execution by sending an array of successful Action IDs to a `/confirm` endpoint.

I have updated the plugin to target `/api/sketchup/sync` and `/api/sketchup/merge/confirm` to match your architecture.

## Your Task: Build the StudioFlow Extension (`src/extensions/sketchup/`)

You must integrate this sync backend into the **StudioFlow** application. Do not create a separate Next.js app. Follow these strict instructions from the user:

### Phase 1: Fix Known Issues First (CRITICAL)
Before building the extension, you **must** fix these 7 existing bugs in StudioFlow:
1. **(Critical)** Add `/activity` and `/activity-center` to `isDashboardRoute` in `src/auth.config.ts`.
2. **(Critical)** Fix `smartDeleteOption` in `schedule-service.ts` — after promoting a sibling to `is_final`, update the parent `ProjectScheduleEntry.active_index` within the same transaction.
3. Fix timezone offset in `src/core/platform/audit/query-builder.ts` — use GMT+07:00 local offset instead of hardcoded UTC.
4. Enforce a minimum of one identifier (SKU or Color) in manual schedule entry creation.
5. Extend `normalizeDrawingCode` in `src/actions/_shared.ts` to strip the `CD` prefix.
6. Remove dead function `switchActiveOption` from `schedule-service.ts`.
7. Replace hardcoded Tailwind values in `GradualInputForm.tsx` with UI Engine tokens.

### Phase 2: Database Schema (Prisma)
Add these models via `core/platform/db`, ensuring you do not break existing models:
- `SketchupProject`: links StudioFlow `Project` to SketchUp model. Must include `api_key`.
- `SketchupMaterial`: stores `code`, `uuid`, `brand`, `type`, `finish`, `image_url`, `location_notes`. Linked to `SketchupProject`.
- `SketchupFFE`: stores `code`, `instance_count`, `area`, metadata. Linked to `SketchupProject`.
- `SketchupMergeAction`: queue table storing `source_code`, `target_code`, `executed_at` (DateTime?). Linked to `SketchupProject`.

### Phase 3: API Endpoints (Next.js App Router)
Create these under `/api/sketchup/`:
- `POST /api/sketchup/sync`: Receives full payload. Upserts materials by UUID, upserts FF&E by code. Returns pending `SketchupMergeAction` where `executed_at IS NULL`. Requires API key validation via Authorization header.
- `POST /api/sketchup/merge/confirm`: Receives a list of MergeAction IDs. Sets `executed_at = now()`.
- `GET /api/sketchup/projects`: Lists linked SketchUp projects for a given StudioFlow project.

### Phase 4: UI Extension (`/projects/[id]/sketchup`)
- Build Material Schedule and FF&E Schedule tabs.
- Table Columns for Material: CODE | MATERIAL TYPE | TYPE | IMAGE | LOCATION
- Table Columns for FF&E: CODE | CATEGORY | PRODUCT NAME | QTY | VENDOR | LOCATION
- Adhere to the **View-First Protocol**: UI is read-only by default. Modals require an explicit "Modify" click.
- Merge Flow: Select a source row → click Merge → select target → calls your internal merge API.

### Strict Architectural Rules
- All DB access via Prisma through `core/platform/db`.
- All permission checks via `core/rbac assertPermission` using roles (ADMIN, DIC, DRIC, STAFF).
- Audit log all write actions.
- No direct cross-extension imports. Use Facade pattern.
- UI styling must use Lora (titles), Inter (UI), slate-50/slate-900, and UI Engine tokens. 
- Do not touch the SketchUp Ruby plugin directory!

Good luck, Agent! I have done my part, now the StudioFlow integration is in your hands.
