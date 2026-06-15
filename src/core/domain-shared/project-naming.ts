import { ActionError } from "@/lib/error-types";
import { PrismaTransaction } from "@/types/common";

const NAMING_REGEX = /^\d{4}-\d+ .+/;

export const projectNamingPolicy = {
  /**
   * Validates if a manually provided name follows the [YYYY]-[Nomor] [Name] format.
   */
  validateManualFormat(name: string) {
    if (!NAMING_REGEX.test(name)) {
      throw new ActionError(
        "Project name must use the format: [YYYY]-[Nomor] [Name].",
        "INVALID_FORMAT"
      );
    }
  },

  /**
   * Generates a project name based on the current year and latest sequence.
   */
  async generateAutoName(tx: PrismaTransaction, readableName: string): Promise<string> {
    const normalizedReadable = readableName.trim();
    
    // Block if user tries to manually input the prefix when auto-naming is ON
    if (NAMING_REGEX.test(normalizedReadable)) {
      throw new ActionError(
        "Enter only the readable project name. Year and sequence are generated automatically.",
        "AUTO_NAMING_CONFLICT"
      );
    }

    const currentYear = new Date().getFullYear();
    const yearPrefix = `${currentYear}-`;
    
    // Get the latest project number for this year
    const lastProject = await tx.project.findFirst({
      where: { name: { startsWith: yearPrefix } },
      orderBy: { name: "desc" },
      select: { name: true }
    });

    let nextNumber = 1;
    if (lastProject) {
      const match = lastProject.name.match(new RegExp(`^${currentYear}-(\\d+)`));
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    const nnn = String(nextNumber).padStart(3, "0");
    return `${currentYear}-${nnn} ${normalizedReadable}`;
  },
  
  /**
   * Extracts the [YYYY]-[Nomor] code from a formatted project name.
   */
  extractProjectCode(name: string): string {
    const match = name.match(/^(\d{4}-\d+)/);
    return match ? match[0] : "PENDING";
  },

  /**
   * Regex for UI/frontend validation consistency.
   */
  FORMAT_REGEX: NAMING_REGEX
};
