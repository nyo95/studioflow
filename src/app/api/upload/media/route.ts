import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";
import {
  MAX_DELIVERABLE_SIZE_BYTES,
  isAllowedDeliverableExtension,
  resolveNewDeliverablePath,
} from "@/lib/deliverable-storage";

/**
 * Universal Media Pipeline API
 * Supports multiple folders: library, projects, deliverables, etc.
 *
 * `deliverables` is handled separately from every other folder: those files
 * are client-confidential, so they're written to a private root (never under
 * `public/`) and served back through an authenticated route instead of a
 * static URL. See PLAN-AUDIT-ROADMAP-2026Q3.md §1.2 A2 / §2.3 R3. Every
 * other folder keeps the original public-static behavior unchanged.
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

    if (folder === "deliverables") {
      if (file.size > MAX_DELIVERABLE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `File exceeds the ${Math.floor(MAX_DELIVERABLE_SIZE_BYTES / (1024 * 1024))}MB limit for deliverables.` },
          { status: 413 }
        );
      }
      if (!isAllowedDeliverableExtension(file.name)) {
        return NextResponse.json(
          { error: "This file type isn't allowed for deliverables. Use a document, drawing, image, or archive file." },
          { status: 415 }
        );
      }

      const normalizedPath = path.posix.normalize(subPath.replace(/\\/g, "/"));
      const fullPath = resolveNewDeliverablePath(normalizedPath);
      if (!fullPath) {
        return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, buffer);

      return NextResponse.json({ url: `/api/deliverables/file/${normalizedPath}` });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Base directory for all other media uploads (public, static)
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
