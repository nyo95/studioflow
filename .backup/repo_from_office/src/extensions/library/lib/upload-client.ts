import { ActionError } from "@/lib/error-types";

/**
 * Upload binary to Local Storage via API route
 * This is safe to call from Client Components.
 */
export async function uploadLibraryImage(file: Blob | File, filePath: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("path", filePath);

  const response = await fetch("/api/upload/library", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ActionError(
      `Local Upload Failed: ${errorData.error || response.statusText}`, 
      "STORAGE_ERROR"
    );
  }

  const { url } = await response.json();
  return url;
}
