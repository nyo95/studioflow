/**
 * BQ — daftar breakdown.
 *
 * MENGGANTIKAN STUB. Versi sebelumnya berbunyi *"BQ is a SEPARATE APPLICATION
 * in its own repository … DO NOT build BQ features here"*, dan itu benar untuk
 * asumsi yang berlaku saat itu (`UPSTREAM-BQ-MATERIAL-SOURCE.md` §0: BQ
 * dibangun mandiri lalu dikoneksikan sebagai subapp terpisah).
 *
 * Owner membalikkannya 2026-08-19: BQ dibangun DI DALAM StudioFlow di `/bq`.
 * Repo `D:\Misc\ProjectsHUB\BQ` tetap jadi sumber spesifikasi
 * (`PRD_Fixture_Breakdown.md`) — ia memang tidak pernah berisi kode, hanya PRD
 * dan prototype HTML.
 *
 * Gerbang izin pindah ke `layout.tsx` supaya diwarisi seluruh halaman anak,
 * persis seperti yang diperintahkan catatan di stub itu.
 */

import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSION } from "@/core/rbac/rbac";
import { listProjects } from "@/subapps/bq/services/breakdown-service";
import { BqProjectListClient } from "@/subapps/bq/components/BqProjectListClient";

export const dynamic = "force-dynamic";

export default async function BqProjectsPage() {
  const { role } = await getSession();
  const projects = await listProjects();

  return (
    <BqProjectListClient
      projects={projects}
      canManageProjects={hasPermission(role, PERMISSION.BQ_PROJECT_MANAGE)}
    />
  );
}
