/**
 * BQ — Library: resep L1 dan L2 yang bisa dipanggil ulang.
 *
 * Menggantikan /bq/settings di navigasi sidebar BQ.
 * Permission: BQ_BREAKDOWN_EDIT — library milik estimator.
 */

import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSION } from "@/core/rbac/rbac";
import { listLibraryObjects, listLibrarySubObjects } from "@/subapps/bq/services/library-service";
import { BqLibraryClient } from "@/subapps/bq/components/BqLibraryClient";

export const dynamic = "force-dynamic";

export default async function BqLibraryPage() {
  const { role } = await getSession();
  const canEdit = hasPermission(role, PERMISSION.BQ_BREAKDOWN_EDIT);

  const [objects, subObjects] = await Promise.all([
    listLibraryObjects(""),
    listLibrarySubObjects(""),
  ]);

  return (
    <BqLibraryClient
      initialObjects={objects}
      initialSubObjects={subObjects}
      canEdit={canEdit}
    />
  );
}
