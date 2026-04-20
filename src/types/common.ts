import type { CSSProperties } from "react";

export type PrismaTransaction = Omit<
  import("@/generated/prisma").PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export interface UISettings {
  canvasBg?: string;
  radiusCard?: string;
  sectionPx?: string;
  sectionPy?: string;
  rowPaddingY?: string;
  sidebarWidth?: string;
  containerMaxWidth?: string;
  fontSerif?: string;
  fontSans?: string;
  appLogoUrl?: string;
  pagePaddingY?: string;
  pageMaxWidth?: string;
  tableDensity?: string;
  modalDensity?: string;
}

export interface PhaseHeartbeatChecklistItem {
  id: string;
  label: string;
  is_checked: boolean;
  phase_id: string | null;
}

export interface PhaseHeartbeatActivity {
  id: string;
  content: string;
  mode: string;
  status: string;
  phase_id?: string | null;
  deferred_from_version?: string | null;
}

export interface PhaseHeartbeatSnapshot {
  checklistItems: PhaseHeartbeatChecklistItem[];
  activities: PhaseHeartbeatActivity[];
}

export interface ProjectDiscussionSnapshot {
  comments: import("@/extensions/live-collaboration/types/comment").CommentWithAuthor[];
}

export type UISettingsStyle = CSSProperties & Record<`--${string}`, string>;
