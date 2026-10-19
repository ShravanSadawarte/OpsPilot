"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, LayoutDashboard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col justify-center py-10">
      <Card>
        <CardHeader>
          <span className="mb-1 grid size-10 place-items-center rounded-xl border border-destructive/25 bg-destructive/[0.07] text-destructive">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <CardTitle>Something went wrong on this page</CardTitle>
          <CardDescription>
            The page could not be loaded. Nothing you submitted was lost — try again, and if the
            problem continues, head back to the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={reset}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Try again
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <LayoutDashboard className="size-4" aria-hidden="true" />
                Back to dashboard
              </Link>
            </Button>
          </div>
          {error.digest ? (
            <p className="text-[11px] text-muted-foreground">
              Reference for support: <span className="font-mono">{error.digest}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
