import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Prisma } from "@/generated/prisma";
import {
  mapKnownPrismaError,
  normalizeActionErrorCode,
} from "@/lib/action-wrapper";

function asKnownPrismaError(args: {
  code: string;
  target?: string[] | string;
}): Prisma.PrismaClientKnownRequestError {
  return {
    code: args.code,
    meta: args.target ? { target: args.target } : undefined,
  } as Prisma.PrismaClientKnownRequestError;
}

describe("action wrapper error contract", () => {
  test("normalizes legacy platform codes to the canonical vocabulary", () => {
    assert.equal(normalizeActionErrorCode("VALIDATION_FAILED"), "VALIDATION_ERROR");
    assert.equal(normalizeActionErrorCode("INVALID_INPUT"), "VALIDATION_ERROR");
    assert.equal(normalizeActionErrorCode("UNAUTHORIZED_ACTION"), "FORBIDDEN");
    assert.equal(normalizeActionErrorCode("NOT_FOUND"), "NOT_FOUND");
  });

  test("maps known Prisma conflicts without exposing raw database text", () => {
    const mapped = mapKnownPrismaError(
      asKnownPrismaError({ code: "P2002", target: ["name"] })
    );

    assert.equal(mapped.code, "CONFLICT");
    assert.match(mapped.message, /already used by another record/i);
    assert.doesNotMatch(mapped.message, /P2002/i);
  });

  test("falls back to BUSINESS_RULE for other known Prisma codes", () => {
    const mapped = mapKnownPrismaError(asKnownPrismaError({ code: "P2020" }));

    assert.equal(mapped.code, "BUSINESS_RULE");
    assert.match(mapped.message, /database could not save this change/i);
    assert.doesNotMatch(mapped.message, /P2020/i);
  });
});
