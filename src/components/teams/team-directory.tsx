"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { readApiError } from "@/lib/api-errors";
import { humanizeEnum, pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, fieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useToast } from "@/components/ui/toast";

export type DirectoryTeam = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  memberCount: number;
  workItemCount: number;
  userRole: string | null;
  canManage: boolean;
  isMember: boolean;
};

type TeamMember = {
  id: string;
  user: { id: string; name: string | null; email: string; role: string };
  role: string;
};

type TeamDetail = {
  id: string;
  key: string;
  name: string;
  memberships: TeamMember[];
};

type DirectoryUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

const MEMBER_ROLES = ["TEAM_LEAD", "TEAM_MEMBER", "MANAGER", "MEMBER"] as const;

export function TeamDirectory({
  teams,
  currentUserId,
  canCreateTeam,
  canBrowseUsers,
}: {
  teams: DirectoryTeam[];
  currentUserId: string;
  canCreateTeam: boolean;
  canBrowseUsers: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [query, setQuery] = useState("");

  const [activeTeam, setActiveTeam] = useState<DirectoryTeam | null>(null);
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removePending, setRemovePending] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<string>("TEAM_MEMBER");
  const [addError, setAddError] = useState<string | null>(null);
  const [addPending, setAddPending] = useState(false);

  const [users, setUsers] = useState<DirectoryUser[] | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState("");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [createPending, setCreatePending] = useState(false);

  const loadDetail = useCallback(async (teamId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await apiFetch(`/api/v1/teams?teamId=${encodeURIComponent(teamId)}`);
      if (!response.ok) {
        const parsed = await readApiError(response, "Unable to load team members.");
        setDetailError(parsed.message);
        return;
      }
      const body = (await response.json()) as { data?: { team?: TeamDetail } };
      setDetail(body.data?.team ?? null);
    } catch {
      setDetailError("We couldn’t reach the server. Try again.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeTeam) {
      setDetail(null);
      setDetailError(null);
      setRemoving(null);
      setAddOpen(false);
      return;
    }
    setRemoving(null);
    setAddOpen(false);
    setAddUserId("");
    setAddRole("TEAM_MEMBER");
    setAddError(null);
    void loadDetail(activeTeam.id);
  }, [activeTeam, loadDetail]);

  const loadUsers = useCallback(
    async (force = false) => {
      if (users && !force) return;
      setUsersLoading(true);
      setUsersError(null);
      try {
        const response = await apiFetch("/api/v1/users");
        if (!response.ok) {
          const parsed = await readApiError(response, "Unable to load the user directory.");
          setUsersError(parsed.message);
          return;
        }
        const body = (await response.json()) as { data?: { items?: DirectoryUser[] } };
        setUsers(body.data?.items ?? []);
      } catch {
        setUsersError("We couldn’t reach the server. Try again.");
      } finally {
        setUsersLoading(false);
      }
    },
    [users],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return teams;
    return teams.filter((team) =>
      [team.key, team.name, team.description ?? ""].join(" ").toLowerCase().includes(needle),
    );
  }, [query, teams]);

  async function removeMember(member: TeamMember) {
    if (!activeTeam || removePending) return;
    setRemovePending(member.user.id);
    try {
      const response = await apiFetch(
        `/api/v1/teams/${activeTeam.id}/members?teamId=${encodeURIComponent(
          activeTeam.id,
        )}&userId=${encodeURIComponent(member.user.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const parsed = await readApiError(response, "Unable to remove this member.");
        toast({
          variant: "destructive",
          title: "Member not removed",
          description: parsed.message,
        });
        return;
      }
      toast({
        variant: "success",
        title: "Member removed",
        description: `${member.user.name ?? member.user.email} no longer has access to ${
          activeTeam.name
        }.`,
      });
      setRemoving(null);
      await loadDetail(activeTeam.id);
      router.refresh();
    } catch {
      toast({
        variant: "destructive",
        title: "Member not removed",
        description: "We couldn’t reach the server. Try again.",
      });
    } finally {
      setRemovePending(null);
    }
  }

  async function addMember() {
    if (!activeTeam || !addUserId || addPending) return;
    setAddPending(true);
    setAddError(null);
    try {
      const response = await apiFetch(
        `/api/v1/teams/${activeTeam.id}/members?teamId=${encodeURIComponent(activeTeam.id)}`,
        {
          method: "POST",
          body: JSON.stringify({ userId: addUserId, role: addRole }),
        },
      );
      if (!response.ok) {
        const parsed = await readApiError(response, "Unable to add this member.");
        setAddError(parsed.message);
        return;
      }
      const added = users?.find((candidate) => candidate.id === addUserId);
      toast({
        variant: "success",
        title: "Member added",
        description: `${added?.name ?? added?.email ?? "The member"} now has access to ${
          activeTeam.name
        }.`,
      });
      setAddOpen(false);
      setAddUserId("");
      await loadDetail(activeTeam.id);
      router.refresh();
    } catch {
      setAddError("We couldn’t reach the server. Try again.");
    } finally {
      setAddPending(false);
    }
  }

  async function createTeam() {
    if (createPending) return;
    const nextErrors: Record<string, string> = {};
    const key = createKey.trim().toUpperCase();
    const name = createName.trim();
    if (!key) nextErrors.key = "Enter a short team key.";
    else if (key.length > 20) nextErrors.key = "Keep the key to 20 characters or fewer.";
    if (!name) nextErrors.name = "Enter a team name.";
    else if (name.length > 100) nextErrors.name = "Keep the name to 100 characters or fewer.";
    if (createDescription.trim().length > 500) {
      nextErrors.description = "Keep the description to 500 characters or fewer.";
    }
    setCreateErrors(nextErrors);
    setCreateError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setCreatePending(true);
    try {
      const response = await apiFetch("/api/v1/teams", {
        method: "POST",
        body: JSON.stringify({
          key,
          name,
          description: createDescription.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const parsed = await readApiError(response, "Unable to create the team.");
        if (parsed.details) {
          const mapped: Record<string, string> = {};
          for (const [field, messages] of Object.entries(parsed.details)) {
            mapped[field.split(".")[0]] = messages[0] ?? "Check this field.";
          }
          setCreateErrors(mapped);
        }
        setCreateError(parsed.message);
        return;
      }
      toast({
        variant: "success",
        title: "Team created",
        description: `${name} is ready. You were added as a team lead.`,
      });
      setCreateOpen(false);
      setCreateKey("");
      setCreateName("");
      setCreateDescription("");
      setCreateErrors({});
      router.refresh();
    } catch {
      setCreateError("We couldn’t reach the server. Try again.");
    } finally {
      setCreatePending(false);
    }
  }

  const availableUsers = useMemo(() => {
    if (!users) return [];
    const memberIds = new Set((detail?.memberships ?? []).map((member) => member.user.id));
    return users.filter((candidate) => !memberIds.has(candidate.id));
  }, [detail, users]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search teams by name or key…"
            className="pl-9 pr-9"
            aria-label="Search teams"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              aria-label="Clear search"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-3 sm:shrink-0">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            <span className="font-medium text-foreground">{teams.length}</span>{" "}
            {pluralize(teams.length, "team")}
          </p>
          {canCreateTeam ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Create team
            </Button>
          ) : null}
        </div>
      </div>

      {teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams yet"
          description={
            canCreateTeam
              ? "Create the first team to start routing work items and approvals."
              : "You are not a member of any team yet. Ask an administrator to add you."
          }
          action={
            canCreateTeam ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" aria-hidden="true" />
                Create team
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No teams match that search"
          description="Try a different team name or key."
          action={
            <Button variant="outline" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((team) => (
            <li
              key={team.id}
              className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/25"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-muted/60 font-mono text-[11px] font-semibold text-foreground">
                    {team.key}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">{team.name}</h3>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {team.userRole
                        ? `Your role: ${humanizeEnum(team.userRole)}`
                        : "You are not a member"}
                    </p>
                  </div>
                </div>
                {team.canManage ? (
                  <Badge variant="outline" className="shrink-0 border-primary/25 text-primary">
                    Manage
                  </Badge>
                ) : null}
              </div>

              {team.description ? (
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {team.description}
                </p>
              ) : (
                <p className="mt-3 text-xs italic leading-relaxed text-muted-foreground/70">
                  No description yet.
                </p>
              )}

              <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-3.5">
                <div className="flex items-center gap-2 text-xs">
                  <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <dd className="font-medium tabular-nums text-foreground">{team.memberCount}</dd>
                  <dt className="text-muted-foreground">
                    {pluralize(team.memberCount, "member")}
                  </dt>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <ClipboardList className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <dd className="font-medium tabular-nums text-foreground">
                    {team.workItemCount}
                  </dd>
                  <dt className="text-muted-foreground">
                    {pluralize(team.workItemCount, "item")}
                  </dt>
                </div>
              </dl>

              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/work-items?teamId=${team.id}`}>
                    View work
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
                {team.canManage || team.isMember ? (
                  <Button size="sm" variant="ghost" onClick={() => setActiveTeam(team)}>
                    <Users className="size-3.5" aria-hidden="true" />
                    Members
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={Boolean(activeTeam)}
        onOpenChange={(open) => {
          if (!open) setActiveTeam(null);
        }}
      >
        <DialogContent className="max-w-xl">
          {activeTeam ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">{activeTeam.key}</span>
                  {activeTeam.name}
                </DialogTitle>
                <DialogDescription>
                  {activeTeam.memberCount} {pluralize(activeTeam.memberCount, "active member")} ·{" "}
                  {activeTeam.workItemCount} {pluralize(activeTeam.workItemCount, "work item")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {detailLoading ? (
                  <div className="space-y-3" aria-busy="true" aria-label="Loading members">
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3 w-32" />
                          <Skeleton className="h-2.5 w-44" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : detailError ? (
                  <div
                    role="alert"
                    className="flex flex-col gap-3 rounded-lg border border-destructive/25 bg-destructive/[0.06] p-3.5"
                  >
                    <p className="flex items-start gap-2.5 text-xs leading-relaxed text-destructive">
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      {detailError}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={() => activeTeam && void loadDetail(activeTeam.id)}
                    >
                      <RefreshCw className="size-3.5" aria-hidden="true" />
                      Try again
                    </Button>
                  </div>
                ) : detail && detail.memberships.length > 0 ? (
                  <ul className="divide-y divide-border/70">
                    {detail.memberships.map((member) => (
                      <li key={member.id} className="flex items-center gap-3 py-3 first:pt-0">
                        <UserAvatar
                          name={member.user.name}
                          email={member.user.email}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-foreground">
                            {member.user.name ?? member.user.email}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {member.user.email}
                            {member.user.id === currentUserId ? " · you" : ""}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {humanizeEnum(member.role)}
                        </Badge>
                        {activeTeam.canManage && member.user.id !== currentUserId ? (
                          removing === member.user.id ? (
                            <span className="flex shrink-0 items-center gap-1.5">
                              <span className="text-[11px] text-muted-foreground">Remove?</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setRemoving(null)}
                                disabled={removePending !== null}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => removeMember(member)}
                                disabled={removePending !== null}
                              >
                                {removePending === member.user.id ? (
                                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                ) : (
                                  <Trash2 className="size-3.5" aria-hidden="true" />
                                )}
                                Remove
                              </Button>
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setRemoving(member.user.id)}
                              aria-label={`Remove ${member.user.name ?? member.user.email} from ${
                                activeTeam.name
                              }`}
                              title="Remove member"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          )
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : detail ? (
                  <p className="rounded-lg border border-dashed border-border bg-muted/25 p-4 text-center text-xs text-muted-foreground">
                    This team has no active members.
                  </p>
                ) : null}

                {activeTeam.canManage && canBrowseUsers ? (
                  addOpen ? (
                    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] font-medium text-foreground">Add a member</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAddOpen(false);
                            setAddError(null);
                          }}
                          disabled={addPending}
                        >
                          Cancel
                        </Button>
                      </div>

                      {addError ? (
                        <p
                          role="alert"
                          className="flex items-start gap-2 text-xs leading-relaxed text-destructive"
                        >
                          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          {addError}
                        </p>
                      ) : null}

                      {usersLoading ? (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                          Loading users…
                        </p>
                      ) : usersError ? (
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">{usersError}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void loadUsers(true)}
                          >
                            <RefreshCw className="size-3.5" aria-hidden="true" />
                            Retry
                          </Button>
                        </div>
                      ) : availableUsers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Every active user is already on this team.
                        </p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <label
                              htmlFor="add-member-user"
                              className="text-xs font-medium text-foreground"
                            >
                              Person
                            </label>
                            <Select
                              id="add-member-user"
                              value={addUserId}
                              onChange={(event) => setAddUserId(event.target.value)}
                              disabled={addPending}
                            >
                              <option value="">Select a user…</option>
                              {availableUsers.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.name ?? candidate.email} · {candidate.email}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <label
                              htmlFor="add-member-role"
                              className="text-xs font-medium text-foreground"
                            >
                              Team role
                            </label>
                            <Select
                              id="add-member-role"
                              value={addRole}
                              onChange={(event) => setAddRole(event.target.value)}
                              disabled={addPending}
                            >
                              {MEMBER_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {humanizeEnum(role)}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div className="sm:col-span-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={addMember}
                              disabled={addPending || !addUserId}
                            >
                              {addPending ? (
                                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                              ) : (
                                <UserPlus className="size-3.5" aria-hidden="true" />
                              )}
                              Add to team
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAddOpen(true);
                        setAddError(null);
                        void loadUsers();
                      }}
                    >
                      <UserPlus className="size-3.5" aria-hidden="true" />
                      Add member
                    </Button>
                  )
                ) : activeTeam.canManage ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Adding new people to the directory is limited to administrators and managers.
                    You can still manage existing members.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open && createPending) return;
          setCreateOpen(open);
          if (!open) {
            setCreateErrors({});
            setCreateError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a team</DialogTitle>
            <DialogDescription>
              Teams own work items and approvals. You will be added as a team lead.
            </DialogDescription>
          </DialogHeader>

          {createError && Object.keys(createErrors).length === 0 ? (
            <p
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] p-2.5 text-xs leading-relaxed text-destructive"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {createError}
            </p>
          ) : null}

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
              <Field
                id="team-key"
                label="Key"
                required
                error={createErrors.key}
                description="Short code, e.g. OPS"
              >
                <Input
                  id="team-key"
                  value={createKey}
                  onChange={(event) => setCreateKey(event.target.value.toUpperCase())}
                  className="font-mono uppercase"
                  maxLength={20}
                  disabled={createPending}
                  aria-invalid={Boolean(createErrors.key)}
                  aria-describedby={fieldIds("team-key", {
                    error: createErrors.key,
                    description: true,
                  })}
                />
              </Field>
              <Field id="team-name" label="Name" required error={createErrors.name}>
                <Input
                  id="team-name"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  maxLength={100}
                  disabled={createPending}
                  aria-invalid={Boolean(createErrors.name)}
                  aria-describedby={fieldIds("team-name", { error: createErrors.name })}
                />
              </Field>
            </div>
            <Field
              id="team-description"
              label="Description"
              optional
              error={createErrors.description}
              description="What this team is responsible for."
            >
              <Textarea
                id="team-description"
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                maxLength={500}
                className="min-h-20"
                disabled={createPending}
                aria-invalid={Boolean(createErrors.description)}
                aria-describedby={fieldIds("team-description", {
                  error: createErrors.description,
                  description: true,
                })}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={createTeam} disabled={createPending}>
              {createPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              Create team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
