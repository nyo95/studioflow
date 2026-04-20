import { auth } from "./auth";

export default auth;

export const config = {
  // Protect all routes except auth-related ones and public assets
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
