import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";

/**
 * Universal Media Pipeline API
 * Supports multiple folders: library, projects, deliverables, etc.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await getSession();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "misc";
    const subPath = formData.get("path") as string;

    if (!file || !subPath) {
      return NextResponse.json({ error: "File and path are required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Base directory for all media uploads
    const uploadRoot = path.resolve(process.cwd(), "public", "uploads", folder);
    const normalizedPath = path.posix.normalize(subPath.replace(/\\/g, "/"));

    // Security check: prevents directory traversal
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

    // Ensure the folder structure exists
    const dir = path.dirname(fullPath);
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, buffer);

    // Return the relative URL for public access
    const relativeUrl = `/uploads/${folder}/${normalizedPath}`;
    
    return NextResponse.json({ url: relativeUrl });
  } catch (error: unknown) {
    console.error("Media Upload Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Upload Error" },
      { status: 500 }
    );
  }
}
