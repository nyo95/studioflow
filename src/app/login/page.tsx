import { prisma } from "@/lib/db";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  let appTitle = "StudioFlow";
  try {
    const [systemConfig] = await prisma.$queryRaw<Array<{ app_title: string }>>`
      SELECT "app_title"
      FROM "SystemConfig"
      WHERE "id" = 'default'
      LIMIT 1
    `;
    if (systemConfig?.app_title) {
      appTitle = systemConfig.app_title;
    }
  } catch (error) {
    console.error("Failed to fetch app title during build:", error);
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
