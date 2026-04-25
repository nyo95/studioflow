import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const BACKUPS_DIR = path.join(process.cwd(), "backups");

export interface BackupInfo {
  name: string;
  size: number;
  createdAt: Date;
}

export class DatabaseService {
  /**
   * Ensures the backups directory exists
   */
  private static ensureBackupsDir() {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
  }

  /**
   * Lists all available database backups
   */
  static async listBackups(): Promise<BackupInfo[]> {
    this.ensureBackupsDir();
    const files = fs.readdirSync(BACKUPS_DIR);
    
    return files
      .filter(f => f.endsWith(".sql"))
      .map(name => {
        const stats = fs.statSync(path.join(BACKUPS_DIR, name));
        return {
          name,
          size: stats.size,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Creates a new database backup using pg_dump
   */
  static async createBackup(): Promise<string> {
    this.ensureBackupsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `backup_${timestamp}.sql`;
    const filePath = path.join(BACKUPS_DIR, fileName);

    // Get database info from environment
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL not found");

    try {
      // First attempt: Docker (since we saw it's running in studioflow-db-1)
      console.log(`[BackupService] Attempting Docker backup...`);
      try {
        execSync(`docker exec studioflow-db-1 pg_dump -U postgres studioflow > "${filePath}"`);
        return fileName;
      } catch (dockerError) {
        console.warn(`[BackupService] Docker backup failed, falling back to local pg_dump:`, dockerError);
      }

      // Second attempt: Local pg_dump
      execSync(`pg_dump "${dbUrl}" --file="${filePath}"`);
      return fileName;
    } catch (error) {
      console.error(`[BackupService] Backup failed:`, error);
      throw new Error(`Failed to create database backup: ${(error as Error).message}`);
    }
  }

  /**
   * Restores a database from a specific backup file
   */
  static async restoreBackup(fileName: string): Promise<void> {
    const filePath = path.join(BACKUPS_DIR, fileName);
    if (!fs.existsSync(filePath)) throw new Error("Backup file not found");

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL not found");

    try {
      console.log(`[BackupService] Restoring database from ${fileName}...`);

      // Attempt Docker restore first
      try {
        // We use cat to pipe the file into the docker psql command
        execSync(`cat "${filePath}" | docker exec -i studioflow-db-1 psql -U postgres studioflow`);
        return;
      } catch (dockerError) {
        console.warn(`[BackupService] Docker restore failed, falling back to local psql:`, dockerError);
      }

      // Local psql fallback
      execSync(`psql "${dbUrl}" < "${filePath}"`);
    } catch (error) {
      console.error(`[BackupService] Restore failed:`, error);
      throw new Error(`Failed to restore database: ${(error as Error).message}`);
    }
  }

  /**
   * Deletes a backup file
   */
  static async deleteBackup(fileName: string): Promise<void> {
    const filePath = path.join(BACKUPS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
