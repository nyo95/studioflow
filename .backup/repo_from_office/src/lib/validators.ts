import { ActionError } from "@/lib/error-types";

type Validator = (value: unknown) => boolean;

export const validators = {
  email: (value: unknown) =>
    typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()),
  phone: (value: unknown) =>
    typeof value === "string" && /^\+?[\d\s\-()]{9,}$/.test(value.trim()),
  name: (value: unknown) => typeof value === "string" && value.trim().length >= 2 && value.trim().length <= 100,
  url: (value: unknown) => typeof value === "string" && /^https?:\/\/.+/i.test(value.trim()),
  positiveNumber: (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0,
  nonEmptyString: (value: unknown) => typeof value === "string" && value.trim().length > 0,
  password: (value: unknown) => typeof value === "string" && value.trim().length >= 8,
  uuid: (value: unknown) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  alphanumericWithSpace: (value: unknown) =>
    typeof value === "string" && /^[a-zA-Z0-9\s\-_]+$/.test(value.trim()),
} as const satisfies Record<string, Validator>;

export function validateInput(
  schema: Record<string, Validator>,
  data: Record<string, unknown>
) {
  const errors: Record<string, string> = {};

  for (const [key, validator] of Object.entries(schema)) {
    if (!validator(data[key])) {
      errors[key] = `${key} is invalid`;
    }
  }

  return errors;
}

export function assertValidInput(
  schema: Record<string, Validator>,
  data: Record<string, unknown>
) {
  const errors = validateInput(schema, data);

  if (Object.keys(errors).length > 0) {
    throw new ActionError(`Validation failed: ${Object.values(errors).join(", ")}`, "VALIDATION_ERROR");
  }
}
