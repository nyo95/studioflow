import { ActionError } from "@/lib/error-types";
import { ActionResult } from "@/types/common";

export type { ActionResult } from "@/types/common";
export { ActionError } from "@/lib/error-types";

export function unwrapActionResult<T>(result: ActionResult<T>): T {
  if (!result.success) {
    throw new ActionError(result.error, result.code);
  }

  return result.data;
}
