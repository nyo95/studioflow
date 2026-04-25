import { NextRequest, NextResponse } from "next/server";
import { getProjectDiscussionSnapshot } from "@/lib/project-discussion";
import { getSession } from "@/lib/auth";
import { prisma } from "@/core/platform/db";
import { getProjectMembershipOrThrow } from "@/core/rbac/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { userId, role } = await getSession();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await getProjectMembershipOrThrow(prisma as never, projectId, userId, role);
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const snapshot = await getProjectDiscussionSnapshot(projectId);

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("[PROJECT_HEARTBEAT_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
