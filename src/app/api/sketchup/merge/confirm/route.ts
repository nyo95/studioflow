import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Confirmation marks the queued actions done. It does NOT try to verify the
// result against the staging tables.
//
// An earlier version did: it only marked an action executed once its source
// code had disappeared from staging. That was wrong, because it assumed the
// plugin pushes before it confirms. It does the opposite — apply, confirm,
// THEN push — so at confirm time staging still holds the pre-rename codes,
// every action failed verification, stayed pending, and was handed back to
// the plugin on the next sync. The plugin then re-applied renames it had
// already done ("Source material ACR-1 not found") and the queue never
// drained.
//
// Verification belongs at the next push instead, where the model's real
// state is actually visible: autoLinkSyncedMaterial / autoLinkSyncedFixture
// compare each material against its linked schedule entry and re-queue a
// rename if they diverge (see catalog-ownership.ts). A rename that silently
// failed in SketchUp is therefore still caught — one sync later, using real
// data, instead of being guessed at here from stale data.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
    }

    const apiKey = authHeader.split(" ")[1];

    const sketchupProject = await prisma.sketchupProject.findUnique({
      where: { api_key: apiKey },
    });

    if (!sketchupProject) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 403 });
    }

    const body = await req.json();
    const actionIds = body.actionIds ?? body.action_ids;

    if (!Array.isArray(actionIds) || actionIds.length === 0) {
      return NextResponse.json({ error: "Invalid or empty actionIds array" }, { status: 400 });
    }

    const result = await prisma.sketchupMergeAction.updateMany({
      where: {
        id: { in: actionIds },
        sketchup_project_id: sketchupProject.id,
        executed_at: null,
      },
      data: {
        executed_at: new Date(),
      },
    });

    // A count mismatch is reported but is not an error: it usually just means
    // some of these were already confirmed by an earlier call.
    return NextResponse.json({
      success: true,
      requested_count: actionIds.length,
      updated_count: result.count,
    });
  } catch (error) {
    console.error("[SKETCHUP_MERGE_CONFIRM_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
