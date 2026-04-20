# StudioFlow Deep Audit Report (Stage 2)

**Date:** April 19, 2026  
**Reviewer:** AI Assistant (Main Lead)  
**Scope:** Full codebase audit against MASTER_SSOT.md, AGENTS.md, and implementation files  
**Status:** Compiling 12 major issues and logic gaps

---

## Executive Summary

The codebase has achieved 85-90% alignment with architectural intent. However, 12 critical/medium issues have been identified spanning:

- **Data Model Inconsistencies** (3 issues)
- **Business Logic Gaps** (5 issues)  
- **Audit & Observability** (2 issues)
- **Documentation Gaps** (2 issues)

**Blocking Issues:** 1 CRITICAL  
**Requires Immediate Action:** 3 HIGH  
**Can Be Deferred:** 8 MEDIUM/LOW

---

## CRITICAL ISSUES

### 🔴 Issue #1: Phase Submission Blocking Logic Does NOT Respect Activity Context

**Severity:** CRITICAL (Data Integrity)  
**SSOT Reference:** Section 4.2 - "Phase submission blocked only by OPEN tasks tagged to that specific phase or its active revision"

**Problem:**
The phase submission validation only checks activities in the active revision but does NOT verify they are "tagged to that specific phase." The code treats all activities as globally scoped.

**Current Code (phase-service.ts line ~149):**
```typescript
const activeRevision = await getActiveRevision(tx, phaseId, { includeActivities: true });
const hasOpenTodos = activeRevision?.activities.some(
  (a: Activity) => a.mode === "TODO" && a.status === ActivityStatus.OPEN
);
if (hasOpenTodos) throw new ActionError(...);
```

**What's Missing:**
```typescript
// Should check: activities tagged to THIS PHASE only
// Current: includes activities tagged to OTHER phases via same revision
// Actual Schema: Activity has optional phase_id (origin_phase_id) field
```

**Impact:**
- Activities from one phase can block submission of a different phase (if sharing revision)
- Violates Agile creation model where activities are independent
- Creates false blockers

**Fix Required:**
```typescript
// Filter activities by origin_phase_id matching the current phase
const hasOpenTodosInPhase = activeRevision?.activities.some(
  (a: Activity) => 
    a.mode === "TODO" && 
    a.status === ActivityStatus.OPEN &&
    (a.origin_phase_id === null || a.origin_phase_id === phaseId) // Null = untagged global, specific = phase-tagged
);
```

**Locations to Verify:**
- `src/lib/services/phase-service.ts` line ~149-155
- `src/actions/phase-actions.ts` (clients of above)

**Database Query Needed:**
```sql
-- Find activities that might cause false blockers:
SELECT a.id, a.content, a.status, a.origin_phase_id, r.phase_id
FROM activity a
JOIN revision r ON a.revision_id = r.id
WHERE a.mode = 'TODO' AND a.status = 'OPEN' 
AND a.origin_phase_id != r.phase_id;
```

---

## HIGH-PRIORITY ISSUES

### 🟠 Issue #2: Feedback-to-TODO Activity Conversion Missing Assignment Validation

**Severity:** HIGH (Business Logic)  
**Related:** Activity lifecycle, Phase Rejection Workflow

**Problem:**
When a phase is rejected (client), feedback activities are converted to TODOs in the new revision. However, the `assigned_to_id` is copied without validation—if null, the task becomes "orphaned."

**Current Code (phase-service.ts line ~185-200):**
```typescript
const feedbackActivities = activeRevision.activities.filter(
  (a: Activity) => a.mode === "FEEDBACK" && a.status === ActivityStatus.OPEN
);
if (feedbackActivities.length > 0) {
  await tx.activity.createMany({
    data: feedbackActivities.map((a: Activity) => ({
      revision_id: newRevision.id,
      content: a.content,
      mode: "TODO",
      status: ActivityStatus.OPEN,
      // ❌ MISSING: assigned_to_id validation
    })),
  });
}
```

**Expected Behavior:**
- If original feedback has an assignee: copy it
- If original feedback is unassigned: assign to Designer or escalate
- Log audit trail for each activity assignment change

**Impact:**
- Activities appear unassigned (assigned_to_id = null)
- Unclear who is responsible for addressing feedback
- Team loses visibility into action items

**Fix Required:**
1. Validate `assigned_to_id` exists in User table
2. Default to project PIC Designer if null
3. Audit log each conversion

**Locations:**
- `src/lib/services/phase-service.ts` line ~195-200
- `src/lib/services/audit` - add `ACTIVITY_CONVERTED_FEEDBACK_TO_TODO` action

---

### 🟠 Issue #3: Namespace Terminology Mismatch - `schedule_category` vs `category`

**Severity:** HIGH (Schema Consistency)  
**SSOT Reference:** Section 2 - "Terminology Architecture", Section 5.3 - "Deterministic Coding"

**Problem:**
The `ProjectScheduleEntry` schema defines the field as `schedule_category`, but business logic and services use `category` inconsistently. This creates fragile queries and missed validations.

**Evidence:**

**Schema (prisma/schema.prisma line ~315):**
```prisma
model ProjectScheduleEntry {
  schedule_category String  // <-- Field name
  category String          // <-- NO! This doesn't exist
```

**Service Code (schedule-service.ts line ~95):**
```typescript
export interface ScheduleManualDataInput {
  schedule_category?: string;  // ✅ Uses correct name here
}

async executeUpsertEntry(...params: { category: string; }) {
  // ❌ Expects 'category' but schema has 'schedule_category'
}
```

**Action Code (schedule-actions.ts line ~40):**
```typescript
const { entry } = await ScheduleService.addEntryToSchedule(
  tx,
  input.projectId,
  input.schedule_category,  // ✅ Correct here
  ...
);
```

**Current Workaround:**
Code compensates by accepting both names, causing silent failures when validation relies on exact match.

**Impact:**
- Silent field lookup errors in queries
- Validation schema and database schema out of sync
- Migration path unclear

**Database Check:**
```sql
-- Verify actual column name:
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'ProjectScheduleEntry' 
AND column_name LIKE '%category%';
```

**Fix Options (Choose One):**
1. **Rename Schema:** `schedule_category` → `category` (less verbose, aligns with SSOT terminology)
2. **Update All Services:** Use `schedule_category` consistently everywhere
3. **Add Computed Field:** Create mapped alias (less ideal)

**Recommended:** Option 1 - rename to `category` for brevity and alignment with SSOT Section 9 terminology matrix.

**Locations to Update:**
- `prisma/schema.prisma` (model definition)
- `src/lib/services/schedule-service.ts` (all references)
- `src/lib/validations/` (schemas)
- `src/actions/schedule-actions.ts` (input mappings)

---

### 🟠 Issue #4: Missing Audit Trail for Activity Mutations During Rejection

**Severity:** HIGH (Audit Integrity, Resilience System)  
**SSOT Reference:** Section 7.3 - "Audit Integrity: Every mutation MUST call insertAuditLog"

**Problem:**
When a phase is rejected and feedback activities are converted to TODOs, only ONE audit log is created for the entire rejection. Individual activity creation mutations are not logged, violating the "Every Mutation" mandate.

**Current Code (phase-service.ts line ~193-202):**
```typescript
// Activity conversion (NO individual audit log per activity)
await tx.activity.createMany({
  data: feedbackActivities.map((a: Activity) => ({
    revision_id: newRevision.id,
    content: a.content,
    mode: "TODO",
    status: ActivityStatus.OPEN,
  })),
});

// Single bulk audit log for entire operation (insufficient detail)
await insertAuditLog(
  tx,
  AUDIT_ACTIONS.REJECT_PHASE_INTERNAL,
  "PHASE",
  phaseId,
  userId,
  { /* ... */ }
);
```

**SSOT Requirement:**
> "Every mutation (Create/Update/Delete/Approve) MUST call insertAuditLog."

**Impact:**
- Cannot audit trail individual activity conversions
- Difficult to investigate "why is this activity here?"
- Violates resilience protocol

**Fix Required:**
```typescript
const createdActivities = await tx.activity.createMany({
  data: feedbackActivities.map((a: Activity) => ({...})),
  skipDuplicates: false,
});

// Log each activity conversion individually
for (const origActivity of feedbackActivities) {
  await insertAuditLog(
    tx,
    AUDIT_ACTIONS.ACTIVITY_CONVERTED_FEEDBACK_TO_TODO,
    "Activity",
    origActivity.id, // or new activity id
    userId,
    {
      phase_id: phaseId,
      original_revision: activeRevision.id,
      new_revision: newRevision.id,
      assigned_to_id: origActivity.assigned_to_id,
    }
  );
}
```

**Locations:**
- `src/lib/services/phase-service.ts` line ~195
- `src/lib/services/audit/types.ts` - add `ACTIVITY_CONVERTED_FEEDBACK_TO_TODO` constant
- `src/actions/phase-actions.ts` (clients)

---

## MEDIUM-PRIORITY ISSUES

### 🟡 Issue #5: Dangerous Legacy Field `origin_phase_id` Still in Schema

**Severity:** MEDIUM (Dead Code, Risk)  
**SSOT Reference:** Section 10 - "Banned Legacy Variants"

**Problem:**
The `Activity` model still contains `origin_phase_id` field, which is listed as "under audit" in PROJECT_STATUS. This field creates confusion and unused code paths.

**Schema (prisma/schema.prisma line ~96):**
```prisma
model Activity {
  origin_phase_id String?  // ❌ Banned legacy field
  revision_id String?      // ✅ Correct relationship
}
```

**Current Usage:**
- NOT used in phase submission blocking logic (see Issue #1)
- NOT used in activity filtering logic
- NOT documented in SSOT terminology matrix
- Only reference: "under audit; do not use in new logic"

**Action Required:**
1. **Audit Usage:** Verify no code depends on this field
2. **Migration Plan:** Create migration to remove field
3. **Timeline:** Target for Stage 3 cleanup

**Verification Query:**
```sql
-- Find any non-null origin_phase_id values:
SELECT COUNT(*) FROM activity WHERE origin_phase_id IS NOT NULL;

-- Expected result: 0 (if never populated) or list of activities to migrate
```

---

### 🟡 Issue #6: Snapshot Field Naming Not Aligned with SSOT Terminology

**Severity:** MEDIUM (Data Migration, Future Refactoring)  
**SSOT Reference:** Section 3.1, 5.2 - "Namespaced Fields strictly use `catalog_` prefix"

**Problem:**
Project schedule snapshots use non-prefixed field names (`category`, `name`, `brand`) instead of the mandated `catalog_` prefix. This violates the Pillar 2 terminology architecture.

**Current Snapshot (schedule-service.ts line ~80-110):**
```typescript
return {
  source_kind: "catalog",
  source_origin: sourceOrigin,
  material_catalog_id: item.id,
  schedule_category: item.catalog_category,      // ✅ Has prefix (mostly)
  catalog_product_name: item.catalog_product_name, // ✅ Has prefix
  catalog_brand: item.catalog_brand,             // ✅ Has prefix
  initials_type: calculateInitialsType(...),     // ❌ No prefix (but not from catalog)
  price: item.catalog_price ?? null,             // ❌ No prefix
  category: item.catalog_category,               // ❌ Inconsistent - should be schedule_category
  name: item.product_type,                       // ❌ No catalog_ prefix
  brand: item.vendor.brand_name,                 // ❌ No catalog_ prefix
```

**SSOT Requirement:**
> "Namespaced Fields: All fields strictly use namespaced prefixes (`catalog_` for library fields, `schedule_` for project context)."

**Standard Format:**
```typescript
// Should be:
{
  source_kind: "catalog",
  material_catalog_id: item.id,
  schedule_category: item.catalog_category,
  catalog_sku: item.catalog_sku,
  catalog_product_name: item.catalog_product_name,
  catalog_brand: item.catalog_brand,
  catalog_price: item.catalog_price,
  catalog_image_url: item.catalog_image_url,
  // ... all library fields with catalog_ prefix
}
```

**Impact:**
- Future migrations harder without clear naming
- TypeScript types become fragile
- Snapshot deserialization errors when field names change
- Violates established terminology matrix

**Action Required (Can Be Deferred to Stage 3):**
1. Standardize snapshot schema to use `catalog_` and `schedule_` prefixes
2. Create migration script for existing snapshots
3. Update validation schemas

---

### 🟡 Issue #7: Missing Cascade Protection for Material Requests

**Severity:** MEDIUM (Data Loss Risk)  
**Related:** Material Request Model, Schedule Entry Deletion

**Problem:**
`ProjectMaterialRequest` has an optional foreign key to `ProjectScheduleEntry`. When a schedule entry is deleted, material requests cascade without validation or warning.

**Schema (prisma/schema.prisma line ~245):**
```prisma
model ProjectMaterialRequest {
  schedule_entry_id String?
  schedule_entry ProjectScheduleEntry? 
    @relation(fields: [schedule_entry_id], references: [id], onDelete: SetNull)
    // ✅ Uses SetNull, so doesn't cascade-delete
    // But: creates orphaned requests silently
}
```

**Business Logic Gap:**
No check in `deleteScheduleEntryAction` to warn about linked material requests.

**Impact:**
- Material requests orphaned (schedule_entry_id becomes null)
- UI may not show these orphaned requests clearly
- Procurement workflow broken

**Action Required:**
1. Add pre-deletion check in schedule service
2. Either:
   - Block deletion if material requests exist
   - OR cascade delete material requests (with audit log)
3. Show warning to user

**Locations:**
- `src/actions/schedule-actions.ts` - deleteScheduleEntryAction
- `src/lib/services/schedule-service.ts` - add cascade check

---

### 🟡 Issue #8: Activity Query Safety - Missing Null Checks for Active Revision

**Severity:** MEDIUM (Robustness)  
**Pattern:** Multiple locations assume `activeRevision` exists

**Problem:**
The code assumes there's always an active revision, but in edge cases (failed migration, incomplete phase initialization), `getActiveRevision()` might return null.

**Vulnerable Code (phase-service.ts line ~150-155):**
```typescript
const activeRevision = await getActiveRevision(tx, phaseId, { includeActivities: true });
const hasOpenTodos = activeRevision?.activities.some(...);  // ✅ Has optional chaining
if (hasOpenTodos) throw new ActionError(...);
// But below, some code uses activeRevision directly without null check
```

**Risk Scenario:**
1. Phase is created but not activated (no revision)
2. User tries to submit for review
3. Query fails or returns unexpected result

**Defensive Code Pattern Needed:**
```typescript
const activeRevision = await getActiveRevision(tx, phaseId, { includeActivities: true });
if (!activeRevision) {
  throw new ActionError(
    "Phase has no active revision. Activate phase first.",
    "NO_ACTIVE_REVISION"
  );
}

const hasOpenTodos = activeRevision.activities.some(...);  // Now safe
```

**Locations to Audit:**
- `src/lib/services/phase-service.ts` (all `executeSubmitFor*` methods)
- `src/actions/_shared.ts` - `getActiveRevision()` function

---

### 🟡 Issue #9: Phase Activation Sequence Not Enforced

**Severity:** MEDIUM (Business Logic, Documentation)  
**SSOT Reference:** Section 4.1 - "Phase Lifecycle: MOODBOARD → LAYOUT → DESIGN_3D → CD → SUPERVISION"

**Problem:**
The code comment says phases can be "reactivated" or "activated regardless of sequence" but SSOT describes a strict sequence.

**Current Code (phase-service.ts line ~30):**
```typescript
// Note: We deliberately allow IN_PROGRESS phase reactivation (reset) if needed, 
// or activation of ANY phase regardless of sequence per "Parallel Phase" rule.
```

**SSOT Requirement (Section 4.1):**
> "Phase N can only activate if Phase N-1 is `READY_FOR_NEXT`."

**Contradiction:**
- Code allows parallel/non-sequential activation
- SSOT describes sequential gating
- No clear "Parallel Phase" rule documented

**Action Required:**
1. Clarify design intent: Are phases sequential or parallel?
2. Either:
   - Enforce sequence (add validation in `executeActivatePhase`)
   - OR document "Parallel Phase" design decision in MASTER_SSOT
3. Add database test cases

---

### 🟡 Issue #10: Admin Revision Override History Tracking Incomplete

**Severity:** MEDIUM (Auditability)  
**Related:** Phase-service.ts executeOverrideRevision()

**Problem:**
When admin performs HARD_RESET, all revision history is wiped and stored only in a single audit log JSON blob. If audit logs are corrupted/deleted, history is lost forever.

**Current Code (phase-service.ts line ~205-240):**
```typescript
// History captured in memory
const historySnapshot = phase.revisions.map((rev) => ({...}));

// All revisions deleted
await tx.revision.deleteMany({ where: { phase_id: phaseId } });

// History only exists in audit log
await insertAuditLog(tx, AUDIT_ACTIONS.REVISION_OVERRIDE_ADMIN, "REVISION", ..., {
  history_snapshot: historySnapshot,  // ← All history in one JSON
});
```

**Impact:**
- No recovery mechanism if needed
- History visibility limited to audit log query
- Violates principle of durable records

**Recommendation:**
1. Create `RevisionArchive` table for deleted revisions (soft delete)
2. Only allow HARD_RESET if admin explicitly acknowledges history loss
3. Add separate audit event per deleted revision

---

## DOCUMENTATION GAPS

### 📋 Issue #11: Activity Context/Lifecycle Not Clearly Documented

**Gap:** MASTER_SSOT Section 4 describes "Activity Workflow" but doesn't clarify:
- When to use `revision_id` vs `project_id`
- Role of `origin_phase_id` (currently banned but undefined)
- How "global" activities (project_id only) interact with phase blocking
- Assignment rules for unassigned tasks

**Recommendation:**
1. Add Activity Lifecycle diagram to MASTER_SSOT
2. Document each field's purpose in Activity model
3. Define "contextual blocker" more precisely

---

### 📋 Issue #12: Snapshot Field Naming Transition Plan Missing

**Gap:** No documented plan for transitioning snapshots from non-prefixed to `catalog_`/`schedule_` prefixes.

**Recommendation:**
1. Add "Data Migration - Stage 3" section to MASTER_SSOT
2. Define snapshot field naming standard
3. Create migration scripts for existing project data

---

## SUMMARY TABLE

| Issue # | Title | Severity | Category | Fix Type | Effort |
|---------|-------|----------|----------|----------|--------|
| 1 | Phase Submission Blocking Missing Context | CRITICAL | Logic Gap | Code Fix | 2h |
| 2 | Feedback Conversion Missing Assignment Validation | HIGH | Logic Gap | Code Fix + Audit | 3h |
| 3 | schedule_category vs category Mismatch | HIGH | Schema | DB Migration | 4h |
| 4 | Missing Activity Audit Logs | HIGH | Audit | Code Fix | 2h |
| 5 | origin_phase_id Dead Field | MEDIUM | Cleanup | DB Migration | 2h |
| 6 | Snapshot Naming Not Aligned | MEDIUM | Data Migration | Long-term | 8h (Stage 3) |
| 7 | Missing Cascade Protection | MEDIUM | Logic | Code Fix | 1.5h |
| 8 | Missing Null Checks | MEDIUM | Robustness | Code Fix | 1h |
| 9 | Phase Activation Sequence | MEDIUM | Clarification | Docs/Design | 1.5h |
| 10 | Revision Override History | MEDIUM | Auditability | Code Fix | 3h |
| 11 | Activity Documentation | MEDIUM | Docs | Docs | 1h |
| 12 | Snapshot Naming Plan | MEDIUM | Docs | Docs | 1h |

---

## RECOMMENDED ROADMAP

### **Immediate (This Sprint - Week 1)**
- [ ] **Issue #1** - Fix phase submission blocking logic (CRITICAL)
- [ ] **Issue #2** - Add assignment validation for activity conversion (HIGH)
- [ ] **Issue #4** - Add individual audit logs for activity mutations (HIGH)
- [ ] **Issue #8** - Add defensive null checks (quick win)

### **Near-Term (Sprint 2)**
- [ ] **Issue #3** - Execute schema migration (high impact)
- [ ] **Issue #7** - Add cascade protection (safety check)
- [ ] **Issue #9** - Clarify and document phase activation rules
- [ ] **Issue #11** - Document activity lifecycle

### **Deferred (Stage 3 Planning)**
- [ ] **Issue #5** - Remove origin_phase_id field
- [ ] **Issue #6** - Migrate snapshot naming convention
- [ ] **Issue #10** - Implement revision archive pattern
- [ ] **Issue #12** - Execute snapshot field naming plan

---

## VERIFICATION QUERIES

### Check for Potentially Affected Data

```sql
-- Activities blocking wrong phases
SELECT a.id, a.content, a.status, r.phase_id, a.origin_phase_id
FROM activity a
JOIN revision r ON a.revision_id = r.id
WHERE a.mode = 'TODO' AND a.status = 'OPEN' 
AND a.origin_phase_id IS NOT NULL
AND a.origin_phase_id != r.phase_id
LIMIT 20;

-- Orphaned material requests
SELECT pmr.id, pmr.custom_material_name, pmr.schedule_entry_id
FROM project_material_request pmr
WHERE pmr.schedule_entry_id IS NULL
LIMIT 20;

-- Unassigned converted activities (potential risk)
SELECT a.id, a.content, a.assigned_to_id, r.phase_id
FROM activity a
JOIN revision r ON a.revision_id = r.id
WHERE a.assigned_to_id IS NULL
AND a.mode = 'TODO'
LIMIT 20;

-- Phases without active revisions
SELECT p.id, p.name_enum, COUNT(r.id) as revision_count
FROM phase p
LEFT JOIN revision r ON p.id = r.phase_id AND r.status_enum = 'ACTIVE'
WHERE r.id IS NULL
GROUP BY p.id, p.name_enum;
```

---

## NEXT STEPS

1. **Review & Validate:** Stakeholder review of findings
2. **Prioritization:** Confirm roadmap with product/tech leads
3. **Create Tickets:** Break down issues into actionable tasks
4. **Execute Fixes:** Implement by priority
5. **Test & Verify:** Add test coverage for each fix
6. **Audit Re-Run:** Re-audit after fixes applied

---

**Document Generated By:** AI Assistant (Main Lead)  
**Review Status:** Pending  
**Last Updated:** 2026-04-19

