export class ActionError extends Error {
  constructor(public message: string, public code: string = "ACTION_ERROR") {
    super(message);
    this.name = "ActionError";
  }
}

export function throwActionError(message: string, code?: string): never {
  throw new ActionError(message, code);
}
