# StudioFlow Pillar 1 Refactoring - Continuation Prompt

## Context

You are continuing a large-scale refactoring of the StudioFlow (radsaas-2) codebase. The goal is to standardize all Server Actions to use the "Pattern B+C" architecture: `createAction` wrapper + Service Layer pattern.

## What Has Been Done ✅

### 1. New Service Layer Files Created
- `src/lib/services/project-service.ts` - Project business logic
- `src/lib/services/client-service.ts` - Client business logic
- `src/lib/services/user-service.ts` - User business logic
- `src/lib/services/settings-service.ts` - Settings business logic

### 2. Consolidated Helpers
- `src/actions/_shared.ts` - Contains all shared helper functions:
  - `insertAuditLog`
  - `getActiveRevision`
  - `normalizeOptionalString`
  - `upsertClientByName`
  - `getSystemConfigTx`
  - `normalizeDrawingCode`

### 3. New Action Files (using createAction pattern)
- `src/actions/project-actions.ts` ✅
- `src/actions/client-actions.ts` ✅
- `src/actions/user-actions.ts` ✅
- `src/actions/settings-actions.ts` ✅

### 4. Component Imports Updated
All 19 component files now import from `@/actions/*` instead of `@/app/actions`

---

## What Needs To Be Done ⚠️

### Problem: Type Mismatch Errors

The new `createAction` pattern has a **different signature** than the old inline functions:

**Old Pattern (in phase-actions.ts - still using this):**
```typescript
export async function approveInternal(phaseId: string, userId: string, userRole: Role) {
  return prisma.$transaction(async (tx: any) => { ... });
}
```

**New Pattern (createAction):**
```typescript
export const approveInternal = createAction(async ({ input, ctx, tx }) => {
  // input is a single object
  return result;
});
```

### Current Errors (17 total):

1. **phase-actions.tsx** - calls like `activatePhase(phaseId, userId, userRole)` but new pattern expects single object
2. **template-manager.tsx** - 3 similar mismatches
3. **user-management.tsx** - 2 similar mismatches  
4. **project-list-client.tsx** - 1 mismatch
5. **phase-checklist.tsx** - 1 mismatch
6. **project-checklist-overview.tsx** - 1 mismatch
7. **delete-button.tsx** - 1 mismatch
8. **top-header.tsx** - logout action mismatch
9. **settings pages** - 2 mismatches

---

## Your Task

### Step 1: Convert ALL remaining phase-actions.ts functions to createAction

The file `src/actions/phase-actions.ts` still has 14 functions using the OLD inline pattern. Convert ALL of them to use `createAction`:

**Functions to convert:**
1. `approveInternal` - convert to createAction
2. `submitForClientReview` - convert to createAction  
3. `approveClientPhase` - convert to createAction
4. `reopenPhase` - convert to createAction
5. `completeSupervisionPhase` - convert to createAction
6. `createCDItem` - convert to createAction
7. `updateCDItem` - convert to createAction
8. `updateCDStatus` - convert to createAction
9. `deleteCDItem` - convert to createAction
10. `addActivity` - convert to createAction
11. `updateActivityContent` - convert to createAction
12. `toggleActivityStatus` - convert to createAction
13. `deleteActivity` - convert to createAction
14. `addDeliverable` - convert to createAction

**Template for conversion:**

```typescript
// BEFORE (OLD):
export async function approveInternal(phaseId: string, userId: string, userRole: Role) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    // ... business logic
  });
}

// AFTER (NEW):
export const approveInternal = createAction(
  async ({ input, ctx, tx }) => {
    const params = input as { phaseId: string };
    
    // Authorization (in handler)
    await getOwnedPhaseOrThrow(tx, params.phaseId, ctx.userId, ctx.role);
    
    // Business logic here or call service
    const phase = await tx.phase.findUnique({ where: { id: params.phaseId } });
    // ...
    
    return updatedPhase;
  }
);
```

### Step 2: Fix Component Call Sites

After converting actions, update components to pass single input object:

**Before:**
```typescript
<Button onClick={() => handleAction("Activate", () => activatePhase(phaseId, userId, userRole))}>
```

**After:**
```typescript
<Button onClick={() => handleAction("Activate", () => activatePhase({ phaseId }))}>
```

Components to fix:
- `src/components/phase-actions.tsx` - 4 calls
- `src/components/template-manager.tsx` - 3 calls
- `src/components/user-management.tsx` - 2 calls
- `src/components/project-list-client.tsx` - 1 call
- `src/components/phase-checklist.tsx` - 1 call
- `src/components/project-checklist-overview.tsx` - 1 call
- `src/components/delete-button.tsx` - 1 call

### Step 3: Handle Special Cases

**logout action** (`src/components/top-header.tsx`):
- The logout now returns `ActionResult<void>` instead of void
- Fix by not awaiting or handling the result

**Settings pages** (`src/app/(dashboard)/settings/studio/page.tsx` and `profile/page.tsx`):
- These pass settings objects directly
- Wrap in object: `updateUISettings({ uiSettings: settings, appTitle })`

### Step 4: Delete Legacy File

After all fixes, delete:
```
src/app/actions.ts
```

### Step 5: Verify

Run:
```bash
npm run build
# or
npx tsc --noEmit
```

Ensure zero TypeScript errors.

---

## Reference Files

- `src/lib/action-wrapper.ts` - Shows createAction pattern
- `src/actions/project-actions.ts` - Example of converted file
- `src/lib/services/phase-service.ts` - Example service layer
- `src/actions/phase-actions.ts` - File to convert

---

## Rules

1. **Service Layer:** Business logic should be in services, not actions
2. **Type Safety:** Use proper types, avoid `any`
3. **Consistency:** All actions must use same pattern
4. **Testing:** After completion, verify with `npm run build`

---

Good luck!
