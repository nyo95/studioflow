/**
 * §6.14 / PLAN-LIBRARY-BRAND-FIRST.md §10 R1.
 *
 * Extracts a Google Drive file id from common share-link shapes so a
 * BrandLink of kind DRIVE (kantor's archived catalog copy) can render as an
 * iframe preview without an API key.
 *
 * This ONLY works if the file is shared "Anyone with the link" — a
 * restricted-share Drive file renders an empty/blank iframe with no error
 * StudioFlow can detect client-side. Verify sharing on one real file before
 * relying on this in production; if the office's Drive folder is locked
 * down, this needs OAuth + the Drive API instead, which is materially more
 * expensive and out of scope for this pass. See PLAN §10 R1.
 */
export function driveFileIdFromUrl(url: string): string | null {
  try {
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9_-]+)/, // .../file/d/<id>/view
      /[?&]id=([a-zA-Z0-9_-]+)/, // .../open?id=<id> or uc?id=<id>
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

export function drivePreviewEmbedUrl(url: string): string | null {
  const id = driveFileIdFromUrl(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}
