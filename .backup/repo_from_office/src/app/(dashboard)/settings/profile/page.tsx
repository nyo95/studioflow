import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma";
import { getSession, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateUserName } from "@/actions/user-actions";
import { ActionError } from "@/lib/error-types";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_SETTINGS } from "@/lib/revalidation-tags";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unwrapActionResult } from "@/lib/result";
import { SettingsShell } from "@/ui_engine";

export default async function ProfileSettingsPage() {
  const { userId, role } = await getSession();

  if (!userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    redirect("/login");
  }

  const isAdmin = role === Role.ADMIN;

  async function saveProfile(formData: FormData) {
    "use server";

    const session = await requireSession();
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirm_password") ?? "");

    unwrapActionResult(await updateUserName({ userId: session.userId, newName: name }));

    if (!email) {
      throw new ActionError("Email is required.", "EMAIL_REQUIRED");
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        NOT: { id: session.userId },
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new ActionError("Email is already in use.", "EMAIL_IN_USE");
    }

    const data: { email: string; password?: string } = {
      email,
    };

    if (password || confirmPassword) {
      if (password.length < 8) {
        throw new ActionError("New password must be at least 8 characters.", "PASSWORD_TOO_SHORT");
      }

      if (password !== confirmPassword) {
        throw new ActionError("Password confirmation does not match.", "PASSWORD_CONFIRMATION_MISMATCH");
      }

      data.password = await bcrypt.hash(password, 12);
    }

    await prisma.user.update({
      where: { id: session.userId },
      data,
    });

    invalidateCache({ scope: REVALIDATE_SETTINGS });
  }
  return (
    <SettingsShell
      activeTab="profile"
      isAdmin={isAdmin}
      title="Profile"
      description="Manage your own login credentials and personal account details."
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm lg:col-span-2">
          <CardHeader className="border-b border-slate-50 pb-6">
            <CardTitle className="font-serif text-xl font-bold text-slate-900">
              My Profile
            </CardTitle>
            <CardDescription>
              Update your name, email address, and password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-8">
            <form action={saveProfile} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Full Name
                  </Label>
                  <Input
                    name="name"
                    defaultValue={user.name}
                    required
                    className="h-10 rounded-lg border-slate-200 focus:ring-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Email
                  </Label>
                  <Input
                    name="email"
                    type="email"
                    defaultValue={user.email}
                    required
                    className="h-10 rounded-lg border-slate-200 focus:ring-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    New Password
                  </Label>
                  <Input
                    name="password"
                    type="password"
                    minLength={8}
                    placeholder="Leave blank to keep current password"
                    className="h-10 rounded-lg border-slate-200 focus:ring-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Confirm Password
                  </Label>
                  <Input
                    name="confirm_password"
                    type="password"
                    minLength={8}
                    placeholder="Repeat the new password"
                    className="h-10 rounded-lg border-slate-200 focus:ring-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  User ID
                </Label>
                <Input
                  value={user.id}
                  readOnly
                  className="h-10 rounded-lg border-slate-200 bg-slate-50 font-mono text-[10px] text-slate-400"
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  className="h-10 rounded-lg bg-slate-900 px-8 font-sans text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Save Profile Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-50 pb-6">
            <CardTitle className="font-serif text-xl font-bold text-slate-900">
              Access Level
            </CardTitle>
            <CardDescription>
              Your current administrative permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-4 pt-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 font-serif text-2xl font-bold text-white shadow-lg shadow-slate-200">
              {user.role.charAt(0)}
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold uppercase tracking-tighter text-slate-900">
                {user.role}
              </h3>
              <p className="max-w-[200px] text-xs text-slate-400">
                {user.role === "ADMIN"
                  ? "Full administrative access to studio configurations."
                  : "Standard production access for project management."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsShell>
  );
}
