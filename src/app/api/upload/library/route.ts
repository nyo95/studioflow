import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";

/**
 * Universal Library Upload API
 * Specifically for materials, schedules, and project assets.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await getSession();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const subPath = formData.get("path") as string;

    if (!file || !subPath) {
      return NextResponse.json({ error: "File and path are required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Base directory for library uploads
    const folder = "library";
    const uploadRoot = path.resolve(process.cwd(), "public", "uploads", folder);
    const normalizedPath = path.posix.normalize(subPath.replace(/\\/g, "/"));

    // Security check
    if (
      normalizedPath === "." ||
      normalizedPath.startsWith("..") ||
      path.posix.isAbsolute(normalizedPath)
    ) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    const fullPath = path.resolve(uploadRoot, normalizedPath);
    const rootWithSep = uploadRoot.endsWith(path.sep) ? uploadRoot : `${uploadRoot}${path.sep}`;

    if (!fullPath.startsWith(rootWithSep) && fullPath !== uploadRoot) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, buffer);

    const url = `/uploads/${folder}/${normalizedPath}`;
    
    return NextResponse.json({ url });
  } catch (error: unknown) {
    console.error("Library Upload Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
