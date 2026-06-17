import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
      },
      data: {
        executed_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      updated_count: result.count,
    });
  } catch (error) {
    console.error("[SKETCHUP_MERGE_CONFIRM_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
