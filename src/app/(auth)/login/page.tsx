"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Mail } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "Login failed", description: json.error?.message ?? "Invalid credentials." });
        return;
      }
      // Fetch CSRF token for future mutations
      await fetch("/api/v1/auth/csrf");
      router.push("/dashboard");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message ?? "Unexpected error." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold">Sign in</CardTitle>
        <CardDescription>Access your OpsPilot workspace</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 pl-2 text-muted-foreground">
              <Mail className="size-4" />
            </div>
            <Input
              {...form.register("email")}
              type="email"
              placeholder="Email address"
              className={form.formState.errors.email ? "border-destructive" : undefined}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 pl-2 text-muted-foreground">
              <Lock className="size-4" />
            </div>
            <Input
              {...form.register("password")}
              type="password"
              placeholder="Password"
              className={form.formState.errors.password ? "border-destructive" : undefined}
            />
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <div className="text-xs text-center text-muted-foreground">
          Demo: admin@example.com / password123  ·  manager@example.com / password123  ·  member.one@example.com / password123
        </div>
      </CardFooter>
    </Card>
  );
}
