import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // ---------------------------------------------------------------------
  // UI ENGINE BOUNDARY
  // ---------------------------------------------------------------------
  // `@/components/ui/*` are the UI Engine's internal primitives. Application
  // code composes from `@/ui_engine` so that tokens, radius and typography
  // come from one place. Two parallel layers with different tokens is how
  // MASTER_SSOT §8 Issue 7 ("Design Token Hardcoding") came back after it had
  // already been fixed once.
  //
  // Raised from "warn" to "error" once the 65-file migration was complete
  // (2026-08-03). All application code now imports from @/ui_engine. Only
  // src/ui_engine/** and src/components/ui/** may reach the primitives directly.
  // Do NOT add eslint-disable comments to bypass this — if a component is
  // missing from the re-exports, add it to src/ui_engine/primitives/index.ts.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/ui_engine/**", "src/components/ui/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/ui/*"],
              message:
                "Import UI primitives from '@/ui_engine' instead. Only src/ui_engine/** may reach into @/components/ui/* directly. If you need a token, use the exports from @/ui_engine/tokens rather than writing var(--ui-*) inline.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/ui_engine/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/ui_engine",
              importNames: ["DashboardPageShell"],
              message:
                "Use one of the template exports from '@/ui_engine' instead of DashboardPageShell directly.",
            },
            {
              name: "@/ui_engine/layout/shells/dashboard-page-shell",
              message:
                "DashboardPageShell is internal to the template layer. Import a template from '@/ui_engine' instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/ui_engine/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/subapps/*", "@/extensions/*"],
              message:
                "UI Engine must stay domain-agnostic. Move domain wiring to the caller and pass plain slots/props into the engine.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/subapps/*", "@/extensions/*", "@/ui_engine/*", "@/ui_engine"],
              message:
                "Core must not depend on app domains or UI. Keep core modules reusable and domain-neutral.",
            },
          ],
        },
      ],
    },
  },
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='location'][callee.property.name='reload']",
          message: "Use router.refresh() from next/navigation instead of location.reload().",
        },
        {
          selector: "CallExpression[callee.object.property.name='location'][callee.property.name='reload']",
          message: "Use router.refresh() from next/navigation instead of window.location.reload().",
        },
      ],
    },
  },
  // -----------------------------------------------------------------------
  // SCHEDULE WRITE-PATH GUARD (2026-08-12)
  // -----------------------------------------------------------------------
  // Direct calls to tx.projectScheduleOption.create / .update that carry
  // data_snapshot bypass the spec_* index derivation and break the reuse pool.
  // All snapshot writes MUST go through schedule-option-writer.ts helpers.
  //
  // Non-snapshot writes (is_final, status, sku_id) are intentionally allowed
  // and must be annotated with // eslint-disable-next-line no-restricted-syntax
  // + a short comment explaining why they are direct.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/extensions/schedule/services/schedule-option-writer.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression > MemberExpression.callee[object.property.name='projectScheduleOption'][property.name='create']",
          message:
            "Use createScheduleOption() from schedule-option-writer.ts instead of direct tx.projectScheduleOption.create(). " +
            "Direct creates bypass spec_* index derivation and break the reuse pool. " +
            "Non-snapshot creates (no data_snapshot field) may disable this rule with a comment explaining why.",
        },
        {
          selector:
            "CallExpression > MemberExpression.callee[object.property.name='projectScheduleOption'][property.name='update']",
          message:
            "Use updateScheduleOptionSnapshot() from schedule-option-writer.ts instead of direct tx.projectScheduleOption.update(). " +
            "Direct updates bypass spec_* index derivation and break the reuse pool. " +
            "Non-snapshot updates (no data_snapshot field) may disable this rule with a comment explaining why.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/prisma/**",
    // Local 14 MB backup of the v1 Prisma client. Untracked and already in
    // .gitignore, but eslint was still walking it: 849 of the 870 errors in
    // `npx eslint src` came from here, which is enough noise to make the ~13
    // real ones unfindable. Ignored rather than deleted — it is the owner's
    // backup, not repo content, and it is not this change's to throw away.
    "src/generated/prisma_old_bak/**",
    "tmp/**",
    // Arsip 2026-08-10: berkas mati yang dipindahkan keluar dari src/ dan
    // scripts/. Sengaja disimpan apa adanya (impor rusak, tipe implisit) —
    // memperbaikinya berarti merawat kode yang sudah tidak dipakai.
    "docs/archive/**",
  ]),
]);

export default eslintConfig;
