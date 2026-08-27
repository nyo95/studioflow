import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSION } from "@/core/rbac/rbac";
import { loadProjectView } from "@/subapps/bq/services/breakdown-service";
import { BqBreakdownClient } from "@/subapps/bq/components/BqBreakdownClient";

/**
 * Satu breakdown, tiga lapis.
 *
 * Seluruh perhitungan terjadi di server (`loadProjectView` -> `lib/calc.ts`),
 * sesuai aturan PRD BQ no. 5 (*"Perhitungan di server, bukan di klien"*).
 * Komponen klien di bawah menampilkan angka dan mengirim mutasi; ia tidak
 * pernah menjumlahkan apa pun sendiri.
 *
 * Konsekuensi yang disengaja: mengubah qty L2 memicu `revalidatePath` dan
 * halaman ini dihitung ulang. FR-EXP-06 meminta pembaruan "tanpa reload" —
 * dan itulah yang terjadi, karena Next.js mengganti payload RSC-nya, bukan
 * memuat ulang dokumen. Menyalin mesin hitung ke klien untuk mengejar
 * beberapa milidetik akan menghadirkan sumber kebenaran kedua.
 */

export const dynamic = "force-dynamic";

export default async function BqBreakdownPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { role } = await getSession();

  const view = await loadProjectView(projectId);
  if (!view) notFound();

  return (
    <BqBreakdownClient
      view={view}
      canEdit={hasPermission(role, PERMISSION.BQ_BREAKDOWN_EDIT)}
    />
  );
}
