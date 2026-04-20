# StudioFlow Audit - Quick Reference Issues Matrix

**Generated:** April 19, 2026  
**Total Issues Found:** 12  
**Critical:** 1 | **High:** 3 | **Medium:** 8

---

## CRITICAL 🔴

### Issue #1: Phase Submission Blocking Logic Missing Activity Context

| Property | Value |
|----------|-------|
| **File** | `src/lib/services/phase-service.ts` line ~149 |
| **Problem** | Activities from different phases don't block correctly - checks ALL activities in revision, not just phase-specific ones |
| **Impact** | False blockers - activities from Phase A can block Phase B submission |
| **Fix** | Filter activities by `origin_phase_id` matching current phase |
| **Effort** | 2 hours |
| **Test** | Create activities in Phase A, verify Phase B submits (should fail), delete Phase A activities, Phase B submits (should pass) |

```typescript
// ❌ WRONG - checks all activities
const hasOpenTodos = activeRevision?.activities.some(
  (a: Activity) => a.mode === "TODO" && a.status === ActivityStatus.OPEN
);

// ✅ CORRECT - checks only phase-tagged activities
const hasOpenTodos = activeRevision?.activities.some(
  (a: Activity) => 
    a.mode === "TODO" && 
    a.status === ActivityStatus.OPEN &&
    (a.origin_phase_id === null || a.origin_phase_id === phaseId)
);
```

---

## HIGH PRIORITY 🟠

### Issue #2: Feedback-to-TODO Conversion Missing Assignment Validation

| Property | Value |
|----------|-------|
| **File** | `src/lib/services/phase-service.ts` line ~195-200 |
| **Problem** | When feedback activities are converted to TODOs during phase rejection, `assigned_to_id` is copied blindly, can result in null assignments |
| **Impact** | Team members don't see their tasks - activities appear "unassigned" |
| **Fix** | Validate assignee exists, default to project Designer if null, audit each conversion |
| **Effort** | 3 hours |
| **Related** | Issue #4 (missing audit logs) - fix together |

```typescript
// ❌ CURRENT - lost assignments
await tx.activity.createMany({
  data: feedbackActivities.map((a: Activity) => ({
    revision_id: newRevision.id,
    content: a.content,
    mode: "TODO",
    status: ActivityStatus.OPEN,
    // assigned_to_id missing!
  })),
});

// ✅ CORRECT - preserve/default assignments
const defaultAssigneeId = phase.project.pic_designer_id; // fallback
const newActivities = feedbackActivities.map((a: Activity) => ({
  revision_id: newRevision.id,
  content: a.content,
  mode: "TODO",
  status: ActivityStatus.OPEN,
  assigned_to_id: a.assigned_to_id || defaultAssigneeId,
}));
```

---

### Issue #3: schedule_category vs category Field Name Mismatch

| Property | Value |
|----------|-------|
| **File** | `prisma/schema.prisma` + multiple service files |
| **Problem** | Schema defines `schedule_category` but code uses `category` - inconsistent naming |
| **Impact** | Silent lookup failures in queries, validation doesn't catch mismatches |
| **Fix** | Standardize on one name - recommend `schedule_category` → `category` |
| **Effort** | 4 hours (includes migration) |
| **Breaking** | YES - database migration required |

```typescript
// Schema
model ProjectScheduleEntry {
  schedule_category String  // ← Actual field
}

// Service (WRONG)
async executeUpsertEntry(...params: { category: string }) {
  // expects 'category' but schema has 'schedule_category'
}

// Action (CORRECT)
const { entry } = await ScheduleService.addEntryToSchedule(
  tx,
  input.projectId,
  input.schedule_category,  // ← Correct usage
  ...
);
```

---

### Issue #4: Missing Audit Logs for Activity Conversions

| Property | Value |
|----------|-------|
| **File** | `src/lib/services/phase-service.ts` line ~200 (related to Issue #2) |
| **Problem** | SSOT mandates "every mutation must be logged" - but activity conversions during rejection are not individually logged |
| **Impact** | Cannot audit trail why/when activities appeared |
| **Fix** | Log each activity creation individually with ACTIVITY_CONVERTED_FEEDBACK_TO_TODO action |
| **Effort** | 2 hours |
| **SSOT Ref** | Section 7.3 - "Audit Integrity" |

```typescript
// ❌ MISSING - only logs phase rejection, not individual activities
await insertAuditLog(tx, AUDIT_ACTIONS.REJECT_PHASE_INTERNAL, "PHASE", phaseId, userId, {...});

// ✅ REQUIRED - log each activity mutation
for (const origActivity of feedbackActivities) {
  const newActivity = ...;
  await insertAuditLog(
    tx,
    AUDIT_ACTIONS.ACTIVITY_CONVERTED_FEEDBACK_TO_TODO,
    "Activity",
    newActivity.id,
    userId,
    { original_revision_id: activeRevision.id, new_revision_id: newRevision.id }
  );
}
```

---

## MEDIUM PRIORITY 🟡

| # | Issue | File | Problem | Action |
|---|-------|------|---------|--------|
| 5 | Legacy Field: origin_phase_id | `prisma/schema.prisma` line 96 | Field listed as "banned" but still in schema | Remove after usage audit (Stage 3) |
| 6 | Snapshot Field Naming | `src/lib/services/schedule-service.ts` | Uses `category`, `name`, `brand` instead of `catalog_*` prefix | Standardize naming (Stage 3 migration) |
| 7 | Missing Cascade Protection | `src/actions/schedule-actions.ts` | No check for orphaned material requests on entry delete | Add pre-delete validation |
| 8 | Missing Null Checks | `src/lib/services/phase-service.ts` | Code assumes active revision exists | Add defensive checks |
| 9 | Phase Activation Sequence | `src/lib/services/phase-service.ts` line 30 | Design intent unclear - parallel vs sequential | Clarify and document in MASTER_SSOT |
| 10 | Revision Override History | `src/lib/services/phase-service.ts` line 240 | Admin HARD_RESET wipes history in one audit blob | Create RevisionArchive table |
| 11 | Activity Lifecycle Docs | `MASTER_SSOT.md` | Missing clarity on revision_id vs project_id usage | Add Activity Lifecycle section |
| 12 | Snapshot Naming Plan | `MASTER_SSOT.md` | No documented migration path for snapshot fields | Add "Stage 3 Migrations" section |

---

## IMPLEMENTATION ROADMAP

### **This Week (Sprint 1 - CRITICAL + HIGH)**

```
Day 1-2:  Issue #1 - Fix phase submission logic
          - Update activity filter in phase-service.ts
          - Add test cases for phase-specific blocking
          - Deploy

Day 2-3:  Issue #4 - Add activity audit logs
          - Add ACTIVITY_CONVERTED_FEEDBACK_TO_TODO action
          - Update phase rejection logic
          - Deploy

Day 3-4:  Issue #2 - Fix activity assignment
          - Validate assigned_to_id in feedback conversion
          - Default to Designer if null
          - Deploy

Day 4-5:  QA Testing
          - Verify phase submission blocking works correctly
          - Check audit logs appear for activity conversions
          - Verify assignments are preserved
```

### **Next Week (Sprint 2 - HIGH + MEDIUM)**

```
Day 1-2:  Issue #3 - Execute schema migration
          - Rename schedule_category → category
          - Update all service/action code
          - Test thoroughly
          - Deploy to production

Day 3-4:  Issue #7 - Add cascade protection
          - Check for material requests before deleting entries
          - Show user warning
          - Deploy

Day 4-5:  Issue #8, #9 - Quick fixes + docs
          - Add null checks for active revision
          - Update MASTER_SSOT with phase rules
```

### **Stage 3 (Future - Can Be Deferred)**

```
- Issue #5: Remove origin_phase_id field
- Issue #6: Migrate snapshot naming (catalog_ prefix)
- Issue #10: Implement revision archive table
- Issue #11-12: Complete documentation updates
```

---

## VERIFICATION COMMANDS

### Check Current State

```bash
# List activities that might be blocking wrong phases
psql radsaas_db << EOF
SELECT a.id, a.content, a.status, r.phase_id, a.origin_phase_id
FROM activity a
JOIN revision r ON a.revision_id = r.id
WHERE a.mode = 'TODO' AND a.status = 'OPEN' 
AND a.origin_phase_id IS NOT NULL
AND a.origin_phase_id != r.phase_id;
EOF

# Check for unassigned TODOs from conversions
psql radsaas_db << EOF
SELECT COUNT(*) FROM activity 
WHERE assigned_to_id IS NULL AND mode = 'TODO' AND status = 'OPEN';
EOF
```

### After Fixes

```bash
# Run test suite
npm run test

# Check types
npm run tsc

# Lint
npm run lint

# Audit log verification
psql radsaas_db << EOF
SELECT action, COUNT(*) FROM audit_log 
WHERE action LIKE 'ACTIVITY_%'
GROUP BY action
ORDER BY COUNT(*) DESC;
EOF
```

---

## RISK ASSESSMENT

| Issue | Risk Level | If Not Fixed | Recommendation |
|-------|-----------|------------|-----------------|
| #1 | 🔴 CRITICAL | Teams unable to submit phases correctly | Fix ASAP - blocks users |
| #2 | 🟠 HIGH | Feedback-driven tasks go unnoticed | Fix this sprint |
| #3 | 🟠 HIGH | Silent data corruption on next schema change | Fix within 1 week |
| #4 | 🟠 HIGH | Cannot audit/debug activity issues | Fix this sprint |
| #5 | 🟡 MEDIUM | Technical debt, confusion for new devs | Defer to Stage 3 |
| #6 | 🟡 MEDIUM | Makes future migrations harder | Defer to Stage 3 |
| #7 | 🟡 MEDIUM | Material requests orphaned silently | Fix within 2 weeks |
| #8 | 🟡 MEDIUM | Edge case failures if phase not activated | Fix within 1 week |
| #9 | 🟡 MEDIUM | Design confusion, inconsistent behavior | Clarify and document |
| #10 | 🟡 MEDIUM | Admin actions not fully reversible | Defer to Stage 3 |
| #11 | 🟡 MEDIUM | Developer confusion on activity model | Defer to Stage 3 |
| #12 | 🟡 MEDIUM | No migration plan = technical debt | Defer to Stage 3 |

---

## SIGN-OFF

**Audit Completed:** April 19, 2026  
**Auditor:** AI Assistant (Main Lead)  
**Status:** Ready for Stakeholder Review  

**Next Steps:**
1. [ ] Share findings with product/tech leads
2. [ ] Prioritize and estimate fixes
3. [ ] Create GitHub issues for each fix
4. [ ] Schedule implementation sprints
5. [ ] Schedule re-audit after fixes

---

**Questions?** Refer to `AUDIT_DEEP_ANALYSIS_20260419.md` for detailed analysis of each issue.
