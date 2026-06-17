import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

async function getProjectFromAuth(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const apiKey = authHeader.split(" ")[1];
  return prisma.sketchupProject.findUnique({
    where: { api_key: apiKey },
  });
}

export async function GET(req: NextRequest) {
  try {
    const sketchupProject = await getProjectFromAuth(req);
    if (!sketchupProject) {
      return NextResponse.json({ error: "Missing or invalid Authorization header or API key" }, { status: 401 });
    }

    // Fetch pending merge actions to return to SketchUp
    const pendingActions = await prisma.sketchupMergeAction.findMany({
      where: {
        sketchup_project_id: sketchupProject.id,
        executed_at: null,
      },
      select: {
        id: true,
        source_code: true,
        target_code: true,
      },
    });

    const merge_actions = pendingActions.map(a => ({
      id: a.id,
      source: a.source_code,
      target: a.target_code,
    }));

    return NextResponse.json({
      success: true,
      projectId: sketchupProject.project_id,
      merge_actions,
    });
  } catch (error) {
    console.error("[SKETCHUP_SYNC_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sketchupProject = await getProjectFromAuth(req);
    if (!sketchupProject) {
      return NextResponse.json({ error: "Missing or invalid Authorization header or API key" }, { status: 401 });
    }

    const payload = await req.json();
    const { materials = [], ffes = [], ffe = [] } = payload;
    const ffeList = [...ffes, ...ffe];

    // We will do a transaction for all upserts to ensure data integrity
    const operations = [];

    for (const mat of materials) {
      operations.push(
        prisma.sketchupMaterial.upsert({
          where: {
            sketchup_project_id_uuid: {
              sketchup_project_id: sketchupProject.id,
              uuid: mat.uuid,
            },
          },
          create: {
            sketchup_project_id: sketchupProject.id,
            code: mat.code,
            uuid: mat.uuid,
            area: mat.area ?? null,
            face_count: mat.face_count ?? null,
            backface_count: mat.backface_count ?? null,
            layers: mat.layers ?? null,
            parents: mat.parents ?? null,
            brand: null,
            type: null,
            finish: null,
            image_url: null,
            location_notes: null,
            linked_entry_id: null,
          },
          update: {
            code: mat.code,
            uuid: mat.uuid,
            area: mat.area ?? null,
            face_count: mat.face_count ?? null,
            backface_count: mat.backface_count ?? null,
            layers: mat.layers ?? null,
            parents: mat.parents ?? null,
          },
        })
      );
    }

    for (const item of ffeList) {
      operations.push(
        prisma.sketchupFFE.upsert({
          where: {
            sketchup_project_id_code: {
              sketchup_project_id: sketchupProject.id,
              code: item.code,
            },
          },
          create: {
            sketchup_project_id: sketchupProject.id,
            code: item.code,
            instance_count: item.instance_count ?? 1,
            metadata: {
              definition_names: item.definition_names ?? [],
              layers: item.layers ?? [],
              locations: item.locations ?? [],
            },
          },
          update: {
            instance_count: item.instance_count ?? 1,
            metadata: {
              definition_names: item.definition_names ?? [],
              layers: item.layers ?? [],
              locations: item.locations ?? [],
            },
          },
        })
      );
    }

    await prisma.$transaction(operations);

    // Fetch pending merge actions to return to SketchUp
    const pendingActions = await prisma.sketchupMergeAction.findMany({
      where: {
        sketchup_project_id: sketchupProject.id,
        executed_at: null,
      },
      select: {
        id: true,
        source_code: true,
        target_code: true,
      },
    });

    const merge_actions = pendingActions.map(a => ({
      id: a.id,
      source: a.source_code,
      target: a.target_code,
    }));

    return NextResponse.json({
      success: true,
      projectId: sketchupProject.project_id,
      merge_actions,
    });
  } catch (error) {
    console.error("[SKETCHUP_SYNC_POST_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
