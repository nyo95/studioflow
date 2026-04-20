import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { TempFileService } from "@/lib/services/temp-file-service";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Hardcoded to temp folder for security
    const folder = "temp";
    const uploadRoot = path.resolve(process.cwd(), "public", "uploads", folder);
    
    // Generate a safe unique filename
    const timestamp = Date.now();
    const safeName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

    const fullPath = path.resolve(uploadRoot, safeName);

    // Ensure the folder structure exists
    await mkdir(uploadRoot, { recursive: true });
    await writeFile(fullPath, buffer);

    // URL for access
    const url = `/uploads/${folder}/${safeName}`;

    // Create DB record
    const attachment = await TempFileService.createAttachment({
      filename: file.name,
      url: url,
      file_type: file.type,
      expiresInMinutes: 30
    });

    return NextResponse.json(attachment);
  } catch (error: unknown) {
    console.error("Temp Upload Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Upload Error" },
      { status: 500 }
    );
  }
}
