"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Field, fieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type LoginValues = z.infer<typeof schema>;

const demoAccounts = [
  { label: "Admin", email: "admin@example.com", name: "Admin User" },
  { label: "Manager", email: "manager@example.com", name: "Manager One" },
  { label: "Member", email: "member.one@example.com", name: "Member One" },
] as const;

function safeCallbackUrl(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    if (loading) return;
    setAuthError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;

      if (!response.ok) {
        setAuthError(body?.error?.message ?? "Unable to sign in. Check your credentials and try again.");
        return;
      }

      router.replace(safeCallbackUrl(callbackUrl));
      router.refresh();
    } catch {
      setAuthError("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(email: string) {
    setAuthError(null);
    form.setValue("email", email, { shouldValidate: true, shouldDirty: true });
    form.setValue("password", "password123", { shouldValidate: true, shouldDirty: true });
  }

  const emailError = form.formState.errors.email?.message;
  const passwordError = form.formState.errors.password?.message;

  return (
    <div className="w-full">
      <div className="mb-8 lg:hidden">
        <BrandLockup />
      </div>

      <div className="mb-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Welcome back
        </p>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.035em]">
          Sign in to OpsPilot
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Access your operations workspace and pick up where your team left off.
        </p>
      </div>

      {authError ? (
        <div
          role="alert"
          className="mb-5 flex gap-3 rounded-lg border border-destructive/25 bg-destructive/8 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">{authError}</p>
        </div>
      ) : null}

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field id="email" label="Work email" required error={emailError}>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              {...form.register("email")}
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@company.com"
              className="pl-9"
              aria-invalid={Boolean(emailError)}
              aria-describedby={fieldIds("email", { error: emailError })}
              disabled={loading}
              autoFocus
            />
          </div>
        </Field>

        <Field id="password" label="Password" required error={passwordError}>
          <div className="relative">
            <LockKeyhole
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              {...form.register("password")}
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="pl-9 pr-10"
              aria-invalid={Boolean(passwordError)}
              aria-describedby={fieldIds("password", { error: passwordError })}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </Field>

        <Button type="submit" size="lg" className="mt-1 w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </form>

      <div className="mt-7 rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-foreground">Demo workspace</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Choose a role to fill the form. Password: <span className="font-mono">password123</span>
            </p>
          </div>
          <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Safe to explore
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              disabled={loading}
              onClick={() => fillDemo(account.email)}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-2.5 text-center transition-colors hover:border-primary/30 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60"
            >
              <UserAvatar name={account.name} size="xs" />
              <span className="text-[11px] font-medium">{account.label}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
        Need access? Contact your workspace administrator.
      </p>
      <p className="mt-2 text-center text-[10px] text-muted-foreground/80">
        Protected by session authentication, CSRF validation, and login rate limiting.
      </p>

      <div className="mt-4 text-center">
        <Link
          href="/"
          className="text-[11px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Return to workspace entry
        </Link>
      </div>
    </div>
  );
}
