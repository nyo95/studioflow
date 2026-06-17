import { PhaseName } from "@/generated/prisma";

export interface ParsedTag {
  cleanContent: string;
  targetPhaseName: PhaseName | "GENERAL" | null;
}

const PHASE_TAG_MAP: Record<string, PhaseName | "GENERAL"> = {
  // Moodboard / Concept
  "moodboard": PhaseName.MOODBOARD,
  "mood": PhaseName.MOODBOARD,
  "concept": PhaseName.MOODBOARD,
  
  // Layout
  "layout": PhaseName.LAYOUT,
  
  // Design 3D
  "design3d": PhaseName.DESIGN_3D,
  "design_3d": PhaseName.DESIGN_3D,
  "design": PhaseName.DESIGN_3D,
  "3d": PhaseName.DESIGN_3D,
  
  // CD / Drawings
  "cd": PhaseName.CD,
  "drawing": PhaseName.CD,
  
  // Supervision / Construction
  "supervision": PhaseName.SUPERVISION,
  "spv": PhaseName.SUPERVISION,
  "lapangan": PhaseName.SUPERVISION,
  
  // General / Project level
  "general": "GENERAL",
  "project": "GENERAL",
};

/**
 * Parses trailing #tag from content
 */
export function parsePhaseTag(content: string): ParsedTag {
  const trimmed = content.trim();
  const match = trimmed.match(/\s*#([a-zA-Z0-9_]+)$/);
  
  if (match) {
    const tag = match[1].toLowerCase();
    if (tag in PHASE_TAG_MAP) {
      const targetPhaseName = PHASE_TAG_MAP[tag];
      const cleanContent = trimmed.substring(0, match.index).trim();
      return { cleanContent, targetPhaseName };
    }
  }
  
  return { cleanContent: trimmed, targetPhaseName: null };
}
