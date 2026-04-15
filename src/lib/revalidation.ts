import { revalidatePath } from "next/cache";

export function invalidateCache(options: any) {
  if (options.path) {
    revalidatePath(options.path);
  }
}
