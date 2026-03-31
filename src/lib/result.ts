/**
 * Standard data-holding result type for Services and Actions.
 * Encourages explicit error handling over exceptions for domain logic.
 */
export type ActionResult<T = void> = 
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export function unwrapActionResult<T>(result: ActionResult<T>): T {
  if (!result.success) {
    throw new Error(result.error);
  }

  return result.data;
}

export class ActionError extends Error {
  constructor(public message: string, public code?: string) {
    super(message);
    this.name = "ActionError";
  }
}
