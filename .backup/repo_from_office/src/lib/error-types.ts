export class ActionError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "ActionError";
  }
}

export function toActionError(message: string, code = message) {
  return new ActionError(message, code);
}

export function throwActionError(message: string, code = message): never {
  throw toActionError(message, code);
}
