import { REVALIDATE_CUSTOM, REVALIDATE_PROJECT, REVALIDATION_PATHS } from "@/lib/revalidation-tags";
import { revalidatePath } from "next/cache";

export function invalidateCache(options: { scope: string; id?: string; path?: string; type?: "page" | "layout" }) {
  if (options.scope === REVALIDATE_PROJECT && options.id) {
    revalidatePath(`/projects/${options.id}`);
    revalidatePath(`/projects/${options.id}/activity`);
  } else if (options.scope === REVALIDATE_CUSTOM && options.path) {
    revalidatePath(options.path, options.type);
  } else {
    const paths = (REVALIDATION_PATHS as any)[options.scope];
    if (paths) {
      paths.forEach((p: any) => revalidatePath(p.path, p.type));
    }
  }
}
