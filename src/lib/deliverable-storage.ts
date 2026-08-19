import path from "path";

/**
 * Deliverables are client-confidential design files. Before 2026-08-04 they
 * were written to public/uploads/deliverables and served as static public
 * assets — reachable by anyone with the URL, no session required. See
 * PLAN-AUDIT-ROADMAP-2026Q3.md §1.2 A2 / §2.3 R3.
 *
 * This is the one module that knows where deliverables live on disk and what
 * uploads are allowed. The upload route, the authenticated download route,
 * and the delete-on-replace cleanup in phase-service.ts all import from here
 * so the three can't drift out of sync with each other.
 */

/** New uploads land here — outside `public/`, never statically served. */
export const DELIVERABLES_PRIVATE_ROOT = path.resolve(process.cwd(), "storage", "deliverables");

/**
 * Pre-2026-08-04 uploads live here (public, unauthenticated). Kept only so
 * deleteManagedDeliverableAsset can still clean up old files when they're
 * replaced by a new revision upload. New uploads never write here again —
 * migrating the existing files out of `public/` is a follow-up data task,
 * not something this pass can do without access to the running deployment.
 */
export const DELIVERABLES_LEGACY_PUBLIC_ROOT = path.resolve(process.cwd(), "public", "uploads", "deliverables");

export const MAX_DELIVERABLE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  dwg: "application/acad",
  dxf: "application/dxf",
  skp: "application/octet-stream",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
  txt: "text/plain",
};

export const ALLOWED_DELIVERABLE_EXTENSIONS = new Set(Object.keys(EXTENSION_MIME_MAP));

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function getDeliverableMimeType(fileName: string): string {
  return EXTENSION_MIME_MAP[extensionOf(fileName)] ?? "application/octet-stream";
}

export function isAllowedDeliverableExtension(fileName: string): boolean {
  return ALLOWED_DELIVERABLE_EXTENSIONS.has(extensionOf(fileName));
}

const NEW_URL_PREFIX = "/api/deliverables/file/";
const LEGACY_URL_PREFIX = "/uploads/deliverables/";

/** True for both the new authenticated scheme and pre-migration public URLs. */
export function isManagedDeliverableUrl(fileUrl: string): boolean {
  return fileUrl.startsWith(NEW_URL_PREFIX) || fileUrl.startsWith(LEGACY_URL_PREFIX);
}

function safeResolveWithin(root: string, relativePath: string): string | null {
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, "/"));
  if (normalized === "." || normalized.startsWith("..") || path.posix.isAbsolute(normalized)) {
    return null;
  }
  const fullPath = path.resolve(root, normalized);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (fullPath !== root && !fullPath.startsWith(rootWithSep)) {
    return null;
  }
  return fullPath;
}

/**
 * Resolves a stored file_url to its on-disk path, for either the new
 * authenticated scheme or a pre-migration legacy public URL. Returns null if
 * the URL isn't a managed deliverable asset (e.g. an external link, or a
 * traversal attempt) — callers should treat null as "nothing to do", not throw.
 */
export function resolveManagedDeliverableAssetPath(fileUrl: string): string | null {
  if (fileUrl.startsWith(NEW_URL_PREFIX)) {
    return safeResolveWithin(DELIVERABLES_PRIVATE_ROOT, fileUrl.slice(NEW_URL_PREFIX.length));
  }
  if (fileUrl.startsWith(LEGACY_URL_PREFIX)) {
    return safeResolveWithin(DELIVERABLES_LEGACY_PUBLIC_ROOT, fileUrl.slice(LEGACY_URL_PREFIX.length));
  }
  return null;
}

/** Builds the on-disk path for a NEW deliverable upload, or null if the
 * relative path is invalid (traversal, absolute, etc). */
export function resolveNewDeliverablePath(relativePath: string): string | null {
  return safeResolveWithin(DELIVERABLES_PRIVATE_ROOT, relativePath);
}
