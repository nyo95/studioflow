"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import type { Role } from "@/generated/prisma";
import { landingRouteFor } from "@/core/rbac/app-access";
import { Button } from "@/ui_engine";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui_engine";
import { Input } from "@/ui_engine";
import { Label } from "@/ui_engine";
import { Checkbox } from "@/ui_engine";

interface LoginFormProps {
  appTitle: string;
}

export function LoginForm({ appTitle }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email: email.trim(),
      password,
      rememberMe: rememberMe ? "true" : "false",
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    // Route by role, not a hardcoded "/". STAFF/ESTIMATOR own subapps
    // (/masterdata, /bq); pushing "/" would strand them on StudioFlow since
    // the proxy gate lets those roles into "/" and never redirects them off it.
    const session = await getSession();
    const role = session?.user?.role as Role | undefined;
    router.push(landingRouteFor(role));
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-3 text-center">
        <CardTitle className="font-serif text-3xl font-bold text-slate-950">{appTitle}</CardTitle>
        <CardDescription className="text-sm text-slate-500">
          Sign in with your studio email and password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@studioflow.local"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="rememberMe" 
                checked={rememberMe} 
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <Label 
                htmlFor="rememberMe" 
                className="text-xs font-medium leading-none text-slate-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Keep me signed in
              </Label>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="h-11 w-full bg-slate-900 text-white hover:bg-slate-800">
            {loading ? "Signing In..." : "Sign In"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
