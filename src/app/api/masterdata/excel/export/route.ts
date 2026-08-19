import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/core/rbac/guards";
import { PERMISSION } from "@/core/rbac/constants";
import { exportMasterDataExcel } from "@/subapps/master-data/services/excel-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const { role } = await getSession();
  if (!hasPermission(role, PERMISSION.MASTERDATA_VIEW)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const bytes = await exportMasterDataExcel();
    // `bytes` is Uint8Array<ArrayBufferLike>; slice to a plain ArrayBuffer so
    // Blob constructor accepts it without TS GenericArray incompatibility.
    const ab = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([ab], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="masterdata-${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[masterdata/excel/export]", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
