import "server-only";

import { prisma } from "@/core/platform/db";
import { unlink } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export class TempFileService {
  /**
   * Cleanup expired temporary files from disk and database
   * Can be scoped to a project or global
   */
  static async cleanupExpiredFiles(projectId?: string) {
    const now = new Date();

    const expiredFiles = await prisma.temporaryAttachment.findMany({
      where: {
        expires_at: {
          lte: now,
        },
        comment: projectId ? { project_id: projectId } : undefined,
      },
    });

    if (expiredFiles.length === 0) return;

    for (const file of expiredFiles) {
      try {
        // Construct physical path
        // URL is usually "/uploads/temp/filename.ext"
        // We need to map it back to public/uploads/temp/filename.ext
        const relativePath = file.url.startsWith("/") ? file.url.slice(1) : file.url;
        const fullPath = path.join(process.cwd(), "public", relativePath);

        if (existsSync(fullPath)) {
          await unlink(fullPath);
          console.log(`[TEMP_CLEANUP] Deleted file: ${fullPath}`);
        }
      } catch (error) {
        console.error(`[TEMP_CLEANUP_ERROR] Failed to delete file ${file.url}:`, error);
      }
    }

    // Delete from DB
    await prisma.temporaryAttachment.deleteMany({
      where: {
        id: {
          in: expiredFiles.map((f) => f.id),
        },
      },
    });

    console.log(`[TEMP_CLEANUP] Removed ${expiredFiles.length} records from DB.`);
  }

  /**
   * Create a temporary attachment record
   */
  static async createAttachment(data: {
    filename: string;
    url: string;
    file_type: string;
    expiresInMinutes?: number;
  }) {
    const expires_at = new Date(Date.now() + (data.expiresInMinutes || 30) * 60 * 1000);

    return prisma.temporaryAttachment.create({
      data: {
        filename: data.filename,
        url: data.url,
        file_type: data.file_type,
        expires_at,
      },
    });
  }
}
