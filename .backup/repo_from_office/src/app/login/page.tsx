import { prisma } from "@/lib/db";
import { LoginForm } from "@/components/login-form";
import { SYSTEM_CONFIG_ID } from "@/lib/permissions";

// Cache config: revalidate every 1 hour to prevent excessive DB queries
export const revalidate = 3600;

export default async function LoginPage() {
  let appTitle = "StudioFlow";
  try {
    const [systemConfig] = await prisma.$queryRaw<Array<{ app_title: string }>>`
      SELECT "app_title"
      FROM "SystemConfig"
      WHERE "id" = ${SYSTEM_CONFIG_ID}
      LIMIT 1
    `;
    if (systemConfig?.app_title) {
      appTitle = systemConfig.app_title;
    }
  } catch {
    // Fall back to the default title when the database is not reachable during build/dev bootstrap.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_40%)]" />
      <div className="relative w-full max-w-md">
        <LoginForm appTitle={appTitle} />
      </div>
    </div>
  );
}
