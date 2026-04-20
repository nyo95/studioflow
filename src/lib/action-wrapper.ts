import { prisma, ensureDbSchemaPreflight } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ActionError } from "@/lib/error-types";
import { Role } from "@/generated/prisma";
import { ActionResult, PrismaTransaction } from "@/types/common";
import { z } from "zod";

function isRedirectError(error: any): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  return typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT");
}

interface ActionContextUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: Role;
}

interface ActionContext {
  userId: string;
  role: Role;
  user: ActionContextUser;
}

interface ActionOptions<TInput> {
  useTransaction?: boolean;
  schema?: z.ZodSchema<TInput>;
  skipPreflight?: boolean;
}

/**
 * Higher-order function to create a standardized Server Action.
 * Handles auth, Zod validation, error mapping, and optional transactions.
 */
export function createAction<TInput, TOutput>(
  handler: (args: { 
    input: TInput; 
    ctx: ActionContext; 
    tx: PrismaTransaction 
  }) => Promise<TOutput>,
  options: ActionOptions<TInput> = { useTransaction: true }
) {
  return async (input: unknown): Promise<ActionResult<TOutput>> => {
    try {
      const useTransaction = options.useTransaction ?? true;

      // 1. Run DB Schema Preflight Check (Required by SSOT Section 4/11)
      if (!options.skipPreflight) {
        await ensureDbSchemaPreflight();
      }

      const session = await requireSession();

      // Zod Validation if schema provided
      let validatedInput: TInput;
      if (options.schema) {
        try {
          validatedInput = options.schema.parse(input);
        } catch (zodError) {
          if (zodError instanceof z.ZodError) {
            const issues = zodError.issues.map((i) => i.message).join(", ");
            throw new ActionError(`Validation Error: ${issues}`, "VALIDATION_FAILED");
          }
          throw zodError;
        }
      } else {
        validatedInput = input as TInput;
      }
      
      const execute = async (tx: PrismaTransaction) => {
        return handler({ input: validatedInput, ctx: session, tx });
      };

      let result: TOutput;
      if (useTransaction) {
        result = await prisma.$transaction(async (tx) => execute(tx as PrismaTransaction));
      } else {
        result = await execute(prisma as unknown as PrismaTransaction);
      }

      return { success: true, data: result };
    } catch (error: unknown) {
      if (isRedirectError(error)) {
        throw error;
      }

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
