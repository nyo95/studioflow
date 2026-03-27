# RADSAAS-2: Technical Debt & Refactor Plan
**Status:** Postponed for Post-MVP / Pillar 2 Completion
**Strategy:** "Diet Refactor" (Strictly no over-engineering)

## 🎯 The Goal
Clean up the codebase to improve maintainability and developer experience without altering database schemas, UI tokens, or core business logic. No complex Java-like enterprise patterns (e.g., DTOs, Service Layers).

## 📋 Execution Steps (When Ready)

### Phase 1: Standardize UI Mutations
**Create:** `src/hooks/use-server-action.ts`
- **Why:** To eliminate repetitive `isPending`, `try/catch`, and `toast.error` boilerplate across all UI components.
- **Action:** Build a wrapper hook using React's `useTransition` that standardizes how Next.js Server Actions are called from the client.

### Phase 2: Centralize Security & Permissions
**Update:** `src/lib/permissions.ts`
- **Why:** Logic for "who can do what" is currently scattered across multiple files.
- **Action:** CUT all assertion functions (e.g., `assertAdmin`, `assertPhaseOwnerAccess`) from `src/app/actions.ts` and PASTE them here. Export them as a single source of truth.

### Phase 3: Decouple the Monolith Action File
**Refactor:** `src/app/actions.ts`
- **Why:** The file is too large (>1000 lines), making it hard to maintain and prone to merge conflicts.
- **Action:** Split it into a new `src/actions/` directory based on domain:
  - `src/actions/phase-actions.ts`
  - `src/actions/project-actions.ts`
  - `src/actions/client-actions.ts`
- **Rule:** Fix all broken imports across the components after splitting.

---
*Note for AI Agent: When instructed to execute this plan, do it step-by-step and ask for confirmation after each phase to prevent massive import breakages.*