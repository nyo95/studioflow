# Extension Error Handling Guidelines

## Standard Pattern

- Throw `ActionError` for known business/validation failures.
- Use stable error codes for frontend branching.
- Reserve unknown errors for true unexpected faults.

```ts
throw new ActionError("Comment cannot be empty", "EMPTY_COMMENT");
```

## When to Use `ActionError`

- validation failures (`VALIDATION_FAILED`, `EMPTY_COMMENT`)
- authorization failures (`UNAUTHORIZED`, `FORBIDDEN`)
- domain failures (`ITEM_NOT_FOUND`, `SNAPSHOT_MISSING`)

## Frontend Handling

- map `error.code` to user-facing messaging/actions
- keep fallback generic only for unknown errors
- show toast for async sync failures, not console-only logs

## Good vs Bad

### Good

```ts
if (!normalizedContent) {
  throwActionError("Comment cannot be empty", "EMPTY_COMMENT");
}
```

### Bad

```ts
if (!normalizedContent) {
  throw new Error("invalid");
}
```

Why bad:
- no machine-readable code
- UI cannot differentiate known errors

## Recommended Codes

- `UNAUTHORIZED`
- `FORBIDDEN`
- `VALIDATION_FAILED`
- `ITEM_NOT_FOUND`
- `SNAPSHOT_MISSING`
- `EMPTY_COMMENT`
- `COMMENT_TOO_LONG`

## Reference

- `src/lib/error-types.ts`
- `src/lib/services/schedule-service.ts`
- `src/extensions/live-collaboration/actions/comment-actions.ts`