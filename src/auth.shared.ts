export const authSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV !== "production" ? "dev-auth-secret-change-me" : undefined);
