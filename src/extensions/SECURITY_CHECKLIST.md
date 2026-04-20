## Security Review Checklist for New Server Actions

- [ ] Authentication: `getSession()` called and `userId` null-check handled.
- [ ] Authorization (RBAC): role guards (`assertAdmin`, `assertAdminOrStaff`) or equivalent applied.
- [ ] Resource Access: project membership/ownership validated (`getProjectMembershipOrThrow`).
- [ ] Input Validation: payload validated (Zod parse or explicit guards).
- [ ] Service Delegation: avoid direct DB writes from actions when service layer exists.
- [ ] Audit Logging: mutation path guarantees `insertAuditLog` is called exactly once.
- [ ] Error Handling: known failures throw `ActionError` with stable `code`.
- [ ] Cache Invalidation: `invalidateCache`/revalidate tags invoked for affected views.
- [ ] Rate Limiting: considered for expensive or high-frequency operations.
- [ ] Test Coverage: includes positive and negative-path tests.

### Good Pattern

```ts
export const updateMaterialAction = createAction(async ({ input, ctx, tx }) => {
  assertAdminOrStaff(ctx.role);
  const parsed = MaterialUpdateSchema.parse(input);
  return LibraryService.updateMaterial(parsed.id, parsed.data, ctx.userId, tx);
});
```

### Bad Pattern

```ts
export async function unsafeAction(projectId: string) {
  return prisma.project.update({ where: { id: projectId }, data: { name: "X" } });
}
```

Why bad:
- no auth/authz
- no input validation
- bypasses service/audit conventions

### Reference Implementations

- `src/extensions/library/actions/library-actions.ts`
- `src/extensions/live-collaboration/actions/comment-actions.ts`
- `src/actions/schedule-actions.ts`

### Review

- Reviewed by: [Name]
- Approved: [ ]