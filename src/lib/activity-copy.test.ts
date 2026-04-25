import test from 'node:test';
import assert from 'node:assert';
import { humanizeAuditAction, humanizeEntityType, buildActivitySentence, formatActionLabel } from './activity-copy.ts';

test('humanizeAuditAction - known actions', () => {
  assert.strictEqual(humanizeAuditAction('ACTIVATE_PHASE'), 'memulai fase');
  assert.strictEqual(humanizeAuditAction('ADD_ACTIVITY'), 'menambah aktivitas');
  assert.strictEqual(humanizeAuditAction('DELETE_ACTIVITY'), 'menghapus aktivitas');
});

test('humanizeAuditAction - unknown actions', () => {
  assert.strictEqual(humanizeAuditAction('UNKNOWN_ACTION'), 'unknown action');
  assert.strictEqual(humanizeAuditAction('MY_CUSTOM_EVENT'), 'my custom event');
  assert.strictEqual(humanizeAuditAction('multiple__underscores'), 'multiple underscores');
});

test('humanizeEntityType - known types', () => {
  assert.strictEqual(humanizeEntityType('project'), 'proyek');
  assert.strictEqual(humanizeEntityType('phase'), 'fase');
  assert.strictEqual(humanizeEntityType('activity'), 'aktivitas');
  assert.strictEqual(humanizeEntityType('revision'), 'revisi');
});

test('humanizeEntityType - normalization', () => {
  assert.strictEqual(humanizeEntityType('PROJECT'), 'proyek');
  assert.strictEqual(humanizeEntityType('Phase'), 'fase');
  assert.strictEqual(humanizeEntityType('sub_activity'), 'sub activity');
});

test('humanizeEntityType - unknown types', () => {
  assert.strictEqual(humanizeEntityType('user'), 'user');
  assert.strictEqual(humanizeEntityType('COMMENT'), 'comment');
});

test('buildActivitySentence - custom actor', () => {
  const result = buildActivitySentence({
    actorName: 'Alice',
    action: 'ADD_ACTIVITY',
    entityType: 'project'
  });
  assert.strictEqual(result, 'Alice menambah aktivitas pada proyek');
});

test('buildActivitySentence - default actor', () => {
  const result1 = buildActivitySentence({
    actorName: null,
    action: 'ACTIVATE_PHASE',
    entityType: 'phase'
  });
  assert.strictEqual(result1, 'Sistem memulai fase pada fase');

  const result2 = buildActivitySentence({
    action: 'UPDATE_ACTIVITY',
    entityType: 'activity'
  });
  assert.strictEqual(result2, 'Sistem memperbarui aktivitas pada aktivitas');
});

test('formatActionLabel - known actions', () => {
  assert.strictEqual(formatActionLabel('ADD_ACTIVITY'), 'Menambah aktivitas');
  assert.strictEqual(formatActionLabel('PROJECT_COMPLETED_MANUAL'), 'Menandai proyek selesai');
});

test('formatActionLabel - unknown actions', () => {
  assert.strictEqual(formatActionLabel('custom_action'), 'Custom action');
});

test('formatActionLabel - empty', () => {
  assert.strictEqual(formatActionLabel(''), '');
});
