import Link from "next/link";
import { Compass, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function RootNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl">
        <EmptyState
          icon={SearchX}
          title="This page doesn’t exist"
          description="Check the address, or sign in to continue to your operations workspace."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/login">
                  <Compass className="size-4" aria-hidden="true" />
                  Go to sign in
                </Link>
              </Button>
            </div>
          }
        />
      </div>
    </main>
  );
}
