import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { listTeams } from "@/server/services/team.service";
import { WorkItemsView } from "@/components/work-items/work-items-view";
import { WorkItemsSkeleton } from "@/components/work-items/work-items-skeleton";
import type { Team } from "@/types/api";

export const metadata: Metadata = {
  title: "Work items",
};

export const dynamic = "force-dynamic";

export default async function WorkItemsPage() {
  const user = await requireUser();
  const result = await listTeams(user);
  const body = (await result.json()) as { data?: { items?: Team[] } };
  // listTeams is already scoped by the server. ADMIN receives every active
  // team; everyone else receives only active memberships.
  const teams = (body.data?.items ?? []).map((team) => ({
    id: team.id,
    key: team.key,
    name: team.name,
  }));

  return (
    <Suspense fallback={<WorkItemsSkeleton />}>
      <WorkItemsView currentUserId={user.id} teams={teams} />
    </Suspense>
  );
}
