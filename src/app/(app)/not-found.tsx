import Link from "next/link";
import { Compass, LayoutDashboard, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <EmptyState
        icon={SearchX}
        title="We couldn’t find that page"
        description="The page may have been moved, the link may be out of date, or the item might not be visible to your teams."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="size-4" aria-hidden="true" />
                Back to dashboard
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/work-items">
                <Compass className="size-4" aria-hidden="true" />
                Open work queue
              </Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
