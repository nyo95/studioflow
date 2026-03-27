import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPhaseHeartbeatSnapshot } from "@/lib/phase-heartbeat";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ phaseId: string }> }
) {
  const session = await getSession();

  if (!session.userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { phaseId } = await params;
  const snapshot = await getPhaseHeartbeatSnapshot(phaseId);

  return NextResponse.json(snapshot);
}
