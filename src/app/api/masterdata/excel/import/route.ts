import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/core/rbac/guards";
import { PERMISSION } from "@/core/rbac/constants";
import { importMasterDataExcel } from "@/subapps/master-data/services/excel-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { role, userId, user } = await getSession();
  if (!hasPermission(role, PERMISSION.MASTERDATA_SKU_MANAGE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const MAX_EXCEL_BYTES = 20 * 1024 * 1024; // 20 MB
    if ((file as File).size > MAX_EXCEL_BYTES) {
      return NextResponse.json(
        { error: `File is too large (${((file as File).size / 1024 / 1024).toFixed(1)} MB). Maximum size is 20 MB.` },
        { status: 413 }
      );
    }

    const arrayBuffer = await (file as File).arrayBuffer();

    // `actor` ditambahkan 2026-08-18 (audit H6) — sebelumnya tiap baris yang
    // ditulis import ini tidak tercatat di shared audit trail sama sekali.
    const result = await importMasterDataExcel(arrayBuffer, {
      id: userId || null,
      name: user?.name ?? role,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[masterdata/excel/import]", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
