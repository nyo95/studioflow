# Extensions Architecture Refactoring Plan

**Status:** Audit completed April 15, 2026 | Pending implementation  
**Scope:** Fix 10 issues across extensions architecture  
**Methodology:** Phase-based rollout (Priority 1 → 3)  
**Target:** Align codebase with MASTER_SSOT directives

---

## OVERVIEW: Critical Issues Found

- **3 Critical Issues** (P1) - Data integrity, security, error handling
- **3 High Issues** (P2) - Architecture, type safety, resilience
- **4 Medium/Low Issues** (P3) - Maintainability, best practices

**Total Estimated Effort:** ~20 hours spread across 3 weeks

---

## 🔴 PRIORITY 1: DATA INTEGRITY & SECURITY (Week 1)

### P1.1 - Remove Duplicate Vendor Audit Logging
**Severity:** CRITICAL (Data Integrity)  
**Estimated Effort:** 1 hour  
**Owner:** [TBD]

**Problem:** 
`createVendorAction`, `updateVendorAction`, `deleteVendorAction` in `src/extensions/library/actions/library-actions.ts` call `insertAuditLog` AFTER the service methods, which ALSO log. Results in duplicate audit entries.

**Files Affected:**
- `src/extensions/library/actions/library-actions.ts` (lines 30-35, ~75, ~95)
- `src/extensions/library/services/library-service.ts` (lines ~55)

**Current (WRONG):**
```typescript
export const createVendorAction = createAction<LibraryVendorInput, LibraryVendor>(
  async ({ input, ctx, tx }) => {
    const result = await LibraryService.createVendor(input, ctx.userId, tx);
    
    // ❌ DUPLICATE: Service already logged!
    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_VENDOR, "VENDOR", result.id, ctx.userId, {
      brand_name: input.brand_name,
    });
    
    return result;
  }
);
```

**Reference (Correct):**
`createMaterialAction` (line 109) correctly omits duplicate logging.

**Tasks:**
- [ ] Find all LibraryService methods that call insertAuditLog
- [ ] In vendor action handlers, remove redundant insertAuditLog() calls
- [ ] Add comment: `// LibraryService.{method}() handles audit logging`
- [ ] Test: Create vendor → verify audit_log table has exactly 1 entry
- [ ] Document: "Only Action layer calls insertAuditLog, never Service"

**Verification:**
```sql
SELECT action, COUNT(*) FROM audit_log 
WHERE action='LIBRARY_CREATE_VENDOR' AND created_at > now() - '1 day'::interval
GROUP BY action;
-- Should show count = number of vendor creations (not 2x)
```

**Acceptance:** ✅ No duplicate entries; audit trail integrity restored.

---

### P1.2 - Add Missing Authorization Check to getComments()
**Severity:** CRITICAL (Security)  
**Estimated Effort:** 30 minutes  
**Owner:** [TBD]

**Problem:** 
`getComments()` lacks project membership verification. Unauthorized users can read any project's comments.

**File:** `src/extensions/live-collaboration/actions/comment-actions.ts` (line ~20)

**Current (UNSAFE):**
```typescript
export async function getComments(projectId: string): Promise<CommentWithAuthor[]> {
  const snapshot = await getProjectDiscussionSnapshot(projectId);
  return snapshot.comments;
  // ❌ NO project membership verification!
}
```

**Reference (Correct):**
`createComment()` at line 24 has proper checks.

**Tasks:**
- [ ] Add authentication check
- [ ] Add `await getProjectMembershipOrThrow(projectId, userId);`
- [ ] Test: Non-member access → 403 Forbidden
- [ ] Test: Member access → comments returned
- [ ] Audit all other read operations for same gap

**Required Fix:**
```typescript
export async function getComments(projectId: string) {
  const { userId } = await getSession();
  if (!userId) throwActionError("UNAUTHORIZED");
  
  await getProjectMembershipOrThrow(projectId, userId);
  return await getProjectDiscussionSnapshot(projectId);
}
```

**Acceptance:** ✅ Unauthorized access blocked; security test passes.

---

### P1.3 - Standardize Error Types in ScheduleService
**Severity:** CRITICAL (Error Handling)  
**Estimated Effort:** 2 hours  
**Owner:** [TBD]

**Problem:** 
`schedule-service.ts` mixes `throw new Error(msg)` (untyped) with `throw new ActionError(msg, code)`. Without error codes, frontend can't distinguish error types.

**File:** `src/lib/services/schedule-service.ts`  
**Locations:** ~5-8 instances (line ~83, ~95, material resolution logic)

**Current (WRONG):**
```typescript
// schedule-service.ts
throw new Error("Catalog item not found");  // ❌ No error code

// library-service.ts (for comparison)
throw new ActionError("Vendor required", "VENDOR_REQUIRED");  // ✅ Has code
```

**Tasks:**
- [ ] Find all `throw new Error(` in schedule-service
- [ ] Define error codes: ITEM_NOT_FOUND, NO_MATERIALS, VENDOR_INVALID, INVALID_SECTION
- [ ] Replace with `throw new ActionError(message, CODE)`
- [ ] Test: Trigger each error → verify response contains error.code
- [ ] Verify createAction wrapper extracts codes correctly

**Impact:**
- Frontend receives error codes → appropriate error UI
- Monitoring distinguishes error types (not generic 500)
- Debugging easier (error codes in logs)

**Acceptance:** ✅ All errors are ActionError with codes; no generic 500 for known errors.

---

## 🟠 PRIORITY 2: ARCHITECTURE & CODE QUALITY (Week 2)

### P2.1 - Break Schedule ↔ Library Coupling
**Severity:** HIGH (Architecture)  
**Estimated Effort:** 4 hours  
**Owner:** [TBD]

**Problem:** 
`schedule-service.ts` (core) bypasses `LibraryService` (extension) and makes direct Prisma calls. This:
- Skips audit logging in LibraryService
- Duplicates vendor creation logic
- Skips category registration
- Breaks DRY principle

**File:** `src/lib/services/schedule-service.ts`  
**Function:** `resolveCatalogItemForMode` (lines ~175-190)

**Current (WRONG - Direct Prisma bypass):**
```typescript
const vendorId = (await tx.vendor.create({
  data: { brand_name: normalizedBrand },
})).id;

const created = await tx.materialCatalog.create({
  data: {...},
});
```

**Tasks:**
- [ ] Find all `await tx.vendor.create(...)` calls
- [ ] Replace with `await LibraryService.createVendor(input, userId, tx)`
- [ ] Find all `await tx.materialCatalog.create(...)` calls
- [ ] Replace with `await LibraryService.createMaterial(input, userId, tx)`
- [ ] Ensure physical sample creation uses service pattern
- [ ] E2E test: Schedule material creation → appears in audit log
- [ ] Verify category registration still works

**Required Fix:**
```typescript
const vendor = await LibraryService.createVendor(
  { brand_name: normalizedBrand, contacts: [] },
  userId,
  tx
);

const created = await LibraryService.createMaterial(
  {...materialData...},
  userId,
  tx
);
```

**Acceptance:** ✅ No direct Prisma for vendor/material in schedule-service; audit logs complete.

---

### P2.2 - Replace `any` Type Casts with Enums
**Severity:** HIGH (Type Safety)  
**Estimated Effort:** 3 hours  
**Owner:** [TBD]

**Problem:** 
Multiple `as any` casts bypass TypeScript. Developers couldn't express proper types.

**Files:**
- `src/extensions/library/types.ts` (metadata?: any)
- `src/extensions/library/services/library-service.ts` (line ~513, status as any)
- `src/extensions/library/components/MaterialRequestTable.tsx` (line ~58, newStatus as any)

**Current (WRONG):**
```typescript
export type MaterialCatalogInput = {
  metadata?: any;  // ❌ Loses type info
};

status: status as any,  // ❌ Unchecked cast
```

**Tasks:**
- [ ] Create MaterialStatus enum: "PENDING" | "APPROVED" | "REJECTED"
- [ ] Replace `metadata?: any` → `metadata?: Record<string, unknown>`
- [ ] Create Zod schema for metadata validation
- [ ] In status assignments, use `MaterialStatusSchema.parse(input.status)`
- [ ] Remove all `as any` casts
- [ ] Test: Invalid enum value → validation error thrown

**Pattern:**
```typescript
import { z } from "zod";

const MaterialStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type MaterialStatus = z.infer<typeof MaterialStatusSchema>;

// In action:
const status = MaterialStatusSchema.parse(input.status);  // Runtime validation
```

**Acceptance:** ✅ No `any` types; TypeScript strict mode passes; invalid enums rejected.

---

### P2.3 - Add Error Boundaries to Extension Components
**Severity:** HIGH (Resilience)  
**Estimated Effort:** 3 hours  
**Owner:** [TBD]

**Problem:** 
Single component error crashes entire extension UI.

**Files:**
- `src/extensions/library/components/*.tsx`
- `src/extensions/schedule/components/*.tsx`
- `src/extensions/live-collaboration/components/*.tsx`

**Tasks:**
- [ ] Verify ErrorBoundary component exists or create at `src/components/ErrorBoundary.tsx`
- [ ] Wrap each extension main page with `<ErrorBoundary>`
- [ ] Wrap major sections (tabs, modals, tables) with `<ErrorBoundary>`
- [ ] Create ErrorFallback component (dismiss, retry)
- [ ] Test: Simulate component error → boundary catches it
- [ ] Verify error is logged

**Pattern:**
```tsx
<ErrorBoundary 
  fallback={<ErrorFallback />}
  onError={(error) => console.error("Extension error:", error)}
>
  <LibraryTabs {...props} />
</ErrorBoundary>
```

**Acceptance:** ✅ Component error doesn't cascade; fallback UI shown; error logged.

---

## 🟡 PRIORITY 3: MAINTAINABILITY (Week 3)

### P3.1 - Create ProjectScheduleContext (Eliminate Prop Drilling)
**Severity:** MEDIUM (Maintainability)  
**Estimated Effort:** 2 hours  
**Owner:** [TBD]

**Problem:** 
ScheduleMaterialPickerModal receives 8+ props. Props drilled through intermediate components.

**File to Create:** `src/extensions/schedule/context/ProjectScheduleContext.tsx`

**Context Interface:**
```typescript
interface ProjectScheduleContextType {
  projectId: string;
  categories: ScheduleCategory[];
  sections: ScheduleSection[];
  entries: ProjectScheduleEntry[];
  addEntry: (entry: CreateEntryInput) => Promise<void>;
  updateEntry: (id: string, data: UpdateEntryInput) => Promise<void>;
  isSaving: boolean;
}
```

**Tasks:**
- [ ] Create context provider file and hook
- [ ] Move state from props to context
- [ ] Update modal to use context instead of props
- [ ] Reduce modal props from 8+ to <3
- [ ] Test: Modal works without projectId/categories props
- [ ] Refactor callbacks to use context

**Before (Prop Drilling):**
```tsx
<ScheduleMaterialPickerModal 
  projectId={projectId}
  category={category}
  section={section}
  isOpen={isOpen}
  onClose={handleClose}
  onSelect={handleSelectMaterial}
  // ... more props
/>
```

**After (Context-Based):**
```tsx
<ProjectScheduleProvider projectId={projectId}>
  <ScheduleMaterialPickerModal isOpen={isOpen} onClose={handleClose} />
</ProjectScheduleProvider>

const { projectId, category } = useContext(ProjectScheduleContext);
```

**Acceptance:** ✅ Prop drilling eliminated; modal props <3; context tests pass.

---

### P3.2 - Create Security Checklist Template
**Severity:** MEDIUM (Best Practices)  
**Estimated Effort:** 1 hour  
**Owner:** [TBD]

**File to Create:** `src/extensions/SECURITY_CHECKLIST.md`

**Content:**
```markdown
## Security Review Checklist for New Server Actions

- [ ] **Authentication:** getSession() called, null check
- [ ] **Authorization (RBAC):** Appropriate permission check
- [ ] **Resource Access:** Membership/ownership verified
- [ ] **Input Validation:** Zod schema parsed
- [ ] **Service Delegation:** No direct DB calls
- [ ] **Audit Logging:** insertAuditLog called
- [ ] **Error Handling:** Uses ActionError with codes
- [ ] **Cache Invalidation:** revalidateTag called
- [ ] **Rate Limiting:** Considered for expensive ops
- [ ] **Test Coverage:** Unit + integration tests

### Review
- Reviewed by: [Name]
- Approved: [ ]
```

**Tasks:**
- [ ] Create checklist file
- [ ] Add 2-3 code examples (good/bad patterns)
- [ ] Link to reference implementations
- [ ] Add to PR review guidelines
- [ ] All new actions reviewed using checklist

**Acceptance:** ✅ Checklist referenced in code reviews; consistent security patterns.

---

### P3.3 - Add Input Validation & User Feedback to Comments
**Severity:** MEDIUM (UX & Validation)  
**Estimated Effort:** 1 hour  
**Owner:** [TBD]

**Problem:** 
`createComment()` accepts empty strings. Sync failures only logged to console.

**File:** `src/extensions/live-collaboration/actions/comment-actions.ts`

**Current (UNSAFE):**
```typescript
export async function createComment(projectId, content) {
  const comment = await prisma.comment.create({
    data: { content, ... }  // ❌ No validation
  });
}

void syncNow().catch((error) => {
  console.error("Failed to sync:", error);  // ❌ No user feedback
});
```

**Tasks:**
- [ ] Add validation: non-empty, trimmed, max 5000 chars
- [ ] Test: Empty submission → validation error
- [ ] Test: Oversized submission → validation error
- [ ] Replace console.error with toast notifications
- [ ] Test: Sync failure → toast shown to user

**Required Fix:**
```typescript
if (!content?.trim()) {
  throwActionError("Comment cannot be empty", "EMPTY_COMMENT");
}
if (content.length > 5000) {
  throwActionError("Comment too long (max 5000 chars)", "COMMENT_TOO_LONG");
}

// In component:
void syncNow().catch((error) => {
  console.error("Failed to sync comments:", error);
  toast.error("Failed to sync comments - please retry");  // ✅ User feedback
});
```

**Acceptance:** ✅ Empty comments rejected; oversized rejected; sync failures show toast.

---

### P3.4 - Make Extensions Environment-Configurable
**Severity:** LOW (Ops/Feature Flags)  
**Estimated Effort:** 1.5 hours  
**Owner:** [TBD]

**Problem:** 
Extension enabled status hardcoded. Can't toggle without code change.

**File:** `src/extensions/registry.ts`

**Current (Hardcoded):**
```typescript
const EXTENSIONS: Extension[] = [
  { id: "library", enabled: true, ... },
  { id: "schedule", enabled: false, ... },
];
```

**Tasks:**
- [ ] Add env vars: NEXT_PUBLIC_ENABLE_LIBRARY, NEXT_PUBLIC_ENABLE_SCHEDULE, etc.
- [ ] Update registry to check env vars
- [ ] Add dependency validation (optional)
- [ ] Document in .env.example
- [ ] Test: Disable via env → not available in UI

**Required Change:**
```typescript
const EXTENSIONS: Extension[] = [
  {
    id: "library",
    enabled: process.env.NEXT_PUBLIC_ENABLE_LIBRARY !== "false",
    dependencies: [],
  },
  {
    id: "schedule",
    enabled: process.env.NEXT_PUBLIC_ENABLE_SCHEDULE !== "false",
    dependencies: ["library"],
  },
];

// .env.example
NEXT_PUBLIC_ENABLE_LIBRARY=true
NEXT_PUBLIC_ENABLE_SCHEDULE=true
NEXT_PUBLIC_ENABLE_LIVE_COLLABORATION=false
```

**Acceptance:** ✅ Extensions configurable via env; no code changes needed.

---

### P3.5 - Add JSDoc Documentation to Service Methods
**Severity:** LOW (Documentation)  
**Estimated Effort:** 2 hours  
**Owner:** [TBD]

**Files:** All service classes

**Pattern:**
```typescript
/**
 * Creates a vendor with audit logging.
 * 
 * @param data - Vendor input { brand_name, company_name, contacts }
 * @param userId - User ID creating vendor (for audit)
 * @param tx - Prisma transaction
 * 
 * @returns Newly created Vendor { id, brand_name, created_at, ... }
 * 
 * @throws {ActionError} VENDOR_INVALID - if brand_name empty
 * @throws {ActionError} CONTACT_INVALID - if contact malformed
 * 
 * @example
 * const vendor = await LibraryService.createVendor(
 *   { brand_name: "Acme", company_name: "ACME Inc", contacts: [] },
 *   "user-123",
 *   tx
 * );
 */
static async createVendor(data, userId, tx) {
  // ...
}
```

**Tasks:**
- [ ] Add JSDoc to every public method
- [ ] Document @param, @returns, @throws
- [ ] Include @example for complex methods
- [ ] Verify IDE tooltips work
- [ ] No undocumented public methods

**Acceptance:** ✅ All public service methods documented; IDE tooltips helpful.

---

### P3.6 - Document Extension Error Handling Patterns
**Severity:** LOW (Documentation)  
**Estimated Effort:** 1 hour  
**Owner:** [TBD]

**File to Create:** `src/extensions/ERROR_HANDLING.md`

**Content:**
- Standard error handling pattern
- When to use ActionError
- How frontend handles different error codes
- Example implementations (good/bad)

**Tasks:**
- [ ] Create documentation
- [ ] Include pattern examples (3-4 cases)
- [ ] Link to reference code
- [ ] Add to code review guidelines
- [ ] Future actions follow patterns

**Acceptance:** ✅ Documentation clear; referenced in reviews; consistent error handling.

---

## 🔍 VERIFICATION & MONITORING

### After Priority 1 Complete (Data Integrity)
```sql
-- Verify no duplicate audit logs
SELECT action, COUNT(*) FROM audit_log 
WHERE action IN ('LIBRARY_CREATE_VENDOR', 'LIBRARY_UPDATE_VENDOR')
AND created_at > now() - interval '7 days'
GROUP BY action;
-- Expected: count ~= number of vendor mutations (not 2x)

-- Verify comments properly associated
SELECT project_id, COUNT(*) FROM comment 
WHERE deleted_at IS NULL 
GROUP BY project_id;
```

### After Priority 2 Complete (Architecture)
```bash
npm run tsc          # TypeScript strict mode - should pass
npm run lint         # ESLint - no `any` casts
npm run test         # All tests pass
```

### Monitoring Alerts
- [ ] Alert: Duplicate audit entries for same action within 5sec
- [ ] Alert: Schedule material creation without library audit
- [ ] Alert: Error code = "INTERNAL_ERROR" (>10 in 1hr)

---

## 📋 ROLLOUT SCHEDULE

**Week 1 (Priority 1):**
- Monday: Deploy to dev
- Tue-Wed: QA testing
- Friday: Production deployment

**Week 2 (Priority 2):**
- Parallelize P2.1, P2.2, P2.3
- Extensive testing (schedule-critical)

**Week 3 (Priority 3):**
- Low-risk, non-blocking
- Improves developer experience

---

## ✅ ACCEPTANCE CRITERIA

### After Priority 1
- ✅ No duplicate audit entries for vendor ops
- ✅ getComments() enforces membership
- ✅ All schedule-service errors are ActionError
- ✅ Audit trail integrity SQL checks pass

### After Priority 2
- ✅ schedule-service uses LibraryService (no direct Prisma)
- ✅ No `any` types in public APIs
- ✅ Extension errors don't cascade
- ✅ TypeScript strict + eslint pass

### After Priority 3
- ✅ Modal props <3; context-based state
- ✅ Security checklist documented
- ✅ Input validation + error feedback complete
- ✅ Extensions configurable via env

---

## 📌 CONNECTED TO MASTER_SSOT

These fixes align with SSOT directives:
- **P1.1:** Ensures AuditLog integrity (rule 7.3 - "every mutation MUST call insertAuditLog")
- **P1.2:** Enforces membership verification & security patterns
- **P1.3:** Standardizes error types across extensions
- **P2.1:** Maintains Service Layer separation per core stack
- **P2.2:** Strengthens type safety (TypeScript Strict directive)
- **P3.1-P3.6:** Improves maintainability without changing business logic

---

## 👥 SIGN-OFF

**Plan Created:** April 15, 2026  
**By:** Security & Architecture Audit  
**Status:** Ready for Assignment  
**Next Step:** Assign to development team by priority
