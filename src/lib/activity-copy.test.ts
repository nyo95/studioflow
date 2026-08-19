import test from 'node:test';
import assert from 'node:assert';
import { humanizeAuditAction, humanizeEntityType, buildActivitySentence, formatActionLabel } from './activity-copy';

test('humanizeAuditAction - known actions', () => {
  assert.strictEqual(humanizeAuditAction('ACTIVATE_PHASE'), 'started phase');
  assert.strictEqual(humanizeAuditAction('ADD_ACTIVITY'), 'added activity');
  assert.strictEqual(humanizeAuditAction('DELETE_ACTIVITY'), 'deleted activity');
});

test('humanizeAuditAction - checklist actions added with the task work', () => {
  assert.strictEqual(humanizeAuditAction('TOGGLE_CHECKLIST'), 'ticked a task');
  assert.strictEqual(humanizeAuditAction('DETACH_CHECKLIST_TEMPLATE'), 'detached a task from its template');
});

test('humanizeAuditAction - unknown actions fall back to readable words', () => {
  // A new AUDIT_ACTIONS constant should render as slightly awkward English
  // rather than vanish, so the missing label is visible in the UI.
  assert.strictEqual(humanizeAuditAction('UNKNOWN_ACTION'), 'unknown action');
  assert.strictEqual(humanizeAuditAction('MY_CUSTOM_EVENT'), 'my custom event');
  assert.strictEqual(humanizeAuditAction('multiple__underscores'), 'multiple underscores');
});

test('humanizeEntityType - normalization', () => {
  assert.strictEqual(humanizeEntityType('PROJECT'), 'project');
  assert.strictEqual(humanizeEntityType('Phase'), 'phase');
  assert.strictEqual(humanizeEntityType('sub_activity'), 'sub activity');
  assert.strictEqual(humanizeEntityType('ProjectChecklist'), 'projectchecklist');
});

test('humanizeEntityType - unknown types pass through', () => {
  assert.strictEqual(humanizeEntityType('user'), 'user');
  assert.strictEqual(humanizeEntityType('COMMENT'), 'comment');
});

test('buildActivitySentence - custom actor', () => {
  const result = buildActivitySentence({
    actorName: 'Alice',
    action: 'ADD_ACTIVITY',
    entityType: 'project'
  });
  assert.strictEqual(result, 'Alice added activity on project');
});

test('buildActivitySentence - default actor is System', () => {
  const result1 = buildActivitySentence({
    actorName: null,
    action: 'ACTIVATE_PHASE',
    entityType: 'phase'
  });
  assert.strictEqual(result1, 'System started phase on phase');

  const result2 = buildActivitySentence({
    action: 'UPDATE_ACTIVITY',
    entityType: 'activity'
  });
  assert.strictEqual(result2, 'System updated activity on activity');
});

test('formatActionLabel - known actions', () => {
  assert.strictEqual(formatActionLabel('ADD_ACTIVITY'), 'Added activity');
  assert.strictEqual(formatActionLabel('PROJECT_COMPLETED_MANUAL'), 'Marked project complete');
});

test('formatActionLabel - unknown actions', () => {
  assert.strictEqual(formatActionLabel('custom_action'), 'Custom action');
});

test('formatActionLabel - empty', () => {
  assert.strictEqual(formatActionLabel(''), '');
});
