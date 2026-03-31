import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ActionResult, ActionError } from "@/lib/result";

/**
 * Type helper for Prisma Transaction Client
 */
export type PrismaTransaction = Omit<
  import("@/generated/prisma").PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

interface ActionOptions {
  useTransaction?: boolean;
}

/**
 * Higher-order function to create a standardized Server Action.
 * Handles auth, error mapping, and optional transactions.
 */
export function createAction<TInput, TOutput>(
  handler: (args: { 
    input: TInput; 
    ctx: { userId: string; role: any; user: any }; 
    tx: PrismaTransaction 
  }) => Promise<TOutput>,
  options: ActionOptions = { useTransaction: true }
) {
  return async (input: TInput): Promise<ActionResult<TOutput>> => {
    try {
      const session = await requireSession();
      
      const execute = async (tx: PrismaTransaction) => {
        return handler({ input, ctx: session, tx });
      };

      let result: TOutput;
      if (options.useTransaction) {
        result = await prisma.$transaction(async (tx) => execute(tx as PrismaTransaction));
      } else {
        result = await execute(prisma as unknown as PrismaTransaction);
      }

      return { success: true, data: result };
    } catch (error: any) {
      console.error("[Action Error]:", error);

      if (error instanceof ActionError) {
        return { success: false, error: error.message, code: error.code };
      }

      // Handle common Prisma or generic errors
      const message = error instanceof Error ? error.message : "Internal Server Error";
      return { success: false, error: message };
    }
  };
}
