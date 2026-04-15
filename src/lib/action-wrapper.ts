import { ActionError } from "./error-types";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export function createAction<TInput, TOutput>(
  handler: (args: { input: TInput; ctx: { userId: string; role: any }; tx: any }) => Promise<TOutput>,
  options: { useTransaction?: boolean } = { useTransaction: true }
) {
  return async (input: TInput): Promise<ActionResult<TOutput>> => {
    try {
      // Logic for session and transaction would go here in actual implementation
      // For now we'll assume the handler is called with a mocked context
      return { success: true, data: await handler({ input, ctx: {} as any, tx: {} as any }) };
    } catch (e: any) {
      return { success: false, error: e.message || "Action Failed", code: e.code };
    }
  };
}
