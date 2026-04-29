import { revalidatePath } from "next/cache";
import {
  REVALIDATE_CUSTOM,
  REVALIDATE_PROJECT,
  REVALIDATION_PATHS,
} from "@/lib/revalidation-tags";

type RevalidationType = "page" | "layout";
type RevalidationTarget = { path: string; type?: RevalidationType };
type ScopeName = keyof typeof REVALIDATION_PATHS;

function revalidateTargets(targets: readonly RevalidationTarget[]) {
  for (const target of targets) {
    revalidatePath(target.path, target.type);
  }
}

export function invalidateCache(
  options:
    | { scope: ScopeName }
    | { scope: typeof REVALIDATE_PROJECT; id: string }
    | { scope: typeof REVALIDATE_CUSTOM; path: string; type?: RevalidationType }
) {
  if (options.scope === REVALIDATE_PROJECT) {
    revalidatePath(`/projects/${options.id}`);
    revalidatePath(`/projects/${options.id}/activity`);
    revalidatePath(`/projects/${options.id}/extensions/product-catalog`);
    return;
  }

  if (options.scope === REVALIDATE_CUSTOM) {
    revalidatePath(options.path, options.type);
    return;
  }

  revalidateTargets(REVALIDATION_PATHS[options.scope]);
}
