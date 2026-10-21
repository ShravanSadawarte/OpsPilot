import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listTeams } from "@/server/services/team.service";
import { CreateWorkItemForm } from "@/components/work-items/create-work-item-form";
import type { Team } from "@/types/api";

export const metadata: Metadata = {
  title: "New work item",
};

export const dynamic = "force-dynamic";

export default async function CreateWorkItemPage() {
  const user = await requireUser();
  const result = await listTeams(user);
  const body = (await result.json()) as { data?: { items?: Team[] } };
  // listTeams applies the same team scope as createWorkItem: ADMIN receives
  // every active team, everyone else receives only their active memberships.
  const teams = body.data?.items ?? [];

  return (
    <CreateWorkItemForm
      teams={teams.map((team) => ({ id: team.id, key: team.key, name: team.name }))}
    />
  );
}
