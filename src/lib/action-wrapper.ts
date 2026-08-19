import { prisma, ensureDbSchemaPreflight } from "@/core/platform/db";
import { requireSession } from "@/lib/auth";
import { ActionError } from "@/lib/error-types";
import { Prisma, Role } from "@/generated/prisma";
import { ActionResult, PrismaTransaction } from "@/types/common";
import { z } from "zod";

function isRedirectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const errObj = error as { digest: unknown };
  return typeof errObj.digest === "string" && errObj.digest.startsWith("NEXT_REDIRECT");
}

/**
 * M6 (roadmap Gelombang 4, 2026-08-18) — turn a raw Prisma error into
 * something a person can act on, instead of a constraint name and a query
 * fragment. This is the ONLY place this mapping happens; individual actions
 * should keep throwing `ActionError` for domain-specific messages (a name
 * check that runs BEFORE the write, e.g. `findLivePartyByName`) and let this
 * catch the write itself when it still races past that check.
 *
 * Deliberately narrow: `Prisma.PrismaClientKnownRequestError` only — Zod
 * errors are already mapped above, `ActionError` already carries its own
 * message, and any other error (a bug, a genuinely unexpected exception)
 * keeps falling through to `error.message` below, unmapped, so it stays
 * visible in `console.error` and in the browser rather than being smoothed
 * over into something equally generic but harder to diagnose.
 *
 * §7 (slug bentrok — sekarang juga dicegah proaktif oleh `ensureUniqueSlug`,
 * B3), §15 (`generateWorkPriceCode` TOCTOU — sekarang juga dicegah oleh
 * advisory lock, M9), dan §16 (contact yang sudah dihapus pengguna lain) semua
 * lewat sini sebagai jaring pengaman kedua — perbaikan utamanya ada di
 * masing-masing, ini yang menangkap sisanya.
 */
function mapKnownPrismaError(error: Prisma.PrismaClientKnownRequestError): ActionError {
  const target = Array.isArray(error.meta?.target)
    ? (error.meta.target as unknown[]).join(", ")
    : typeof error.meta?.target === "string"
      ? error.meta.target
      : null;

  switch (error.code) {
    case "P2002":
      // Unique constraint. `target` is the column/index name Prisma reports
      // — not the value the person typed, which Prisma does not hand back —
      // so the message names the FIELD, not the value, and asks for a retry.
      return new ActionError(
        target
          ? `This value is already used by another record (field: ${target}). Try a different name or code.`
          : "This value is already used by another record. Try a different name or code.",
        "CONFLICT"
      );
    case "P2025":
      // Record the write targeted no longer matches — deleted or changed by
      // someone else between the screen loading and this submit.
      return new ActionError(
        "This record no longer exists or was changed in another tab or session. Refresh the page and try again.",
        "NOT_FOUND"
      );
    case "P2003":
      // Foreign key violation — usually a picked relation (supplier,
      // category, brand…) that was deleted between being listed and being
      // submitted.
      return new ActionError(
        "A related supplier, category, or brand no longer exists. Refresh the page and select it again.",
        "CONFLICT"
      );
    case "P2014":
      // Required relation would be violated by this write.
      return new ActionError(
        "This change would break a required data relationship. Review the related records and try again.",
        "CONFLICT"
      );
    default:
      // Other known-but-unmapped Prisma codes: still not the raw message,
      // still not silent about being a database error.
      return new ActionError(
        "The database could not save this change. Try again; if it keeps happening, contact an administrator.",
        error.code
      );
  }
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

      // M6: known Prisma errors (constraint violations, missing rows) get a
      // message a person can act on instead of an index name and a query
      // fragment. See `mapKnownPrismaError` above for why this is narrow.
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const mapped = mapKnownPrismaError(error);
        return { success: false, error: mapped.message, code: mapped.code };
      }

      // Handle common Prisma or generic errors
      const message = error instanceof Error ? error.message : "Internal Server Error";
      return { success: false, error: message };
    }
  };
}
