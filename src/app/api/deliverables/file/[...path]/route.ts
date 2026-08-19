import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";
import { getDeliverableMimeType, resolveNewDeliverablePath } from "@/lib/deliverable-storage";

/**
 * Authenticated deliverable download. Deliverables are client-confidential —
 * this route replaces the old behavior of serving them as static files under
 * `public/uploads/deliverables/` (reachable by anyone with the URL, no
 * session required). See PLAN-AUDIT-ROADMAP-2026Q3.md §1.2 A2 / §2.3 R3.
 *
 * Auth model: any authenticated user, matching how the rest of the app
 * treats project visibility today (the Deliverables Tracking page itself has
 * no per-project membership gate — staff can already browse any project's
 * deliverables list; DIC/DRIC-only *upload* is enforced separately by
 * addDeliverable's assertDeliverableUploadAccess). This route closes the
 * "reachable with zero auth" gap without inventing a stricter per-project ACL
 * that the rest of the app doesn't otherwise have — that's a follow-up, not
 * required to fix the actual exposure.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { userId } = await getSession();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: segments } = await params;
  const relativePath = segments.join("/");
  const fullPath = resolveNewDeliverablePath(relativePath);
  if (!fullPath) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }

  try {
    const stats = await stat(fullPath);
    if (!stats.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const buffer = await readFile(fullPath);
    const fileName = path.basename(fullPath);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": getDeliverableMimeType(fileName),
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": String(stats.size),
        // Private per-user download, not a shared/public asset.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("Deliverable download error:", error);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
