import type { Metadata } from "next";
import { UserRole } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { canManageTeam } from "@/lib/permissions";
import { listTeams } from "@/server/services/team.service";
import type { Team } from "@/types/api";
import { PageHeader } from "@/components/ui/page-header";
import {
  TeamDirectory,
  type DirectoryTeam,
} from "@/components/teams/team-directory";

export const metadata: Metadata = {
  title: "Teams",
};

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const user = await requireUser();
  const result = await listTeams(user);
  const body = (await result.json()) as { data?: { items?: Team[] } };
  const teams = body.data?.items ?? [];

  const directory: DirectoryTeam[] = await Promise.all(
    teams.map(async (team) => ({
      id: team.id,
      key: team.key,
      name: team.name,
      description: team.description,
      memberCount: team.memberCount,
      workItemCount: team.workItemCount,
      userRole: team.userRole,
      canManage: await canManageTeam(user, team.id),
      isMember: Boolean(team.userRole) || user.role === UserRole.ADMIN,
    })),
  );

  const canCreateTeam = user.role === UserRole.ADMIN || user.role === UserRole.MANAGER;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Teams"
        description="Ownership map for work items and approvals. Open a team to see who is on it and how much work is in flight."
      />
      <TeamDirectory
        teams={directory}
        currentUserId={user.id}
        canCreateTeam={canCreateTeam}
        canBrowseUsers={canCreateTeam}
      />
    </div>
  );
}
