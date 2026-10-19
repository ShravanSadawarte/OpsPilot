"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { WorkItem } from "@/types/api";
import type { Paginated } from "@/types/api";
import { apiFetch } from "@/lib/api-client";
import { readApiError } from "@/lib/api-errors";
import { cn } from "@/lib/utils";
import {
  formatDueDate,
  formatNumber,
  isOverdueStatus,
  pluralize,
} from "@/lib/format";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  WORK_ITEM_STATUSES,
  WORK_ITEM_TYPES,
  STATUS_LABELS,
  TYPE_LABELS,
} from "@/lib/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  PriorityBadge,
  StatusBadge,
  TypeBadge,
} from "@/components/ui/status-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { WorkItemsSkeleton } from "@/components/work-items/work-items-skeleton";

type TeamOption = { id: string; key: string; name: string };

type ListResponse = Paginated<WorkItem>;

const sortOptions = [
  { value: "updatedAt:desc", label: "Recently updated" },
  { value: "createdAt:desc", label: "Newest first" },
  { value: "priority:desc", label: "Priority: high to low" },
  { value: "dueDate:asc", label: "Due date: soonest" },
  { value: "title:asc", label: "Title: A to Z" },
] as const;

export function WorkItemsView({
  currentUserId,
  teams,
}: {
  currentUserId: string;
  teams: TeamOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? "";
  const priority = searchParams.get("priority") ?? "";
  const type = searchParams.get("type") ?? "";
  const teamId = searchParams.get("teamId") ?? "";
  const assigneeId = searchParams.get("assigneeId") ?? "";
  const overdue = searchParams.get("overdue") === "true";
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const sort = searchParams.get("sort") ?? "updatedAt";
  const order = searchParams.get("order") ?? "desc";
  const sortValue = `${sort}:${order}`;

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(search);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentSearch = searchParams.get("search") ?? "";
      const nextSearch = searchDraft.trim();
      if (nextSearch === currentSearch) return;
      updateParams({ search: nextSearch || null, page: "1" });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft, searchParams, updateParams]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (type) params.set("type", type);
    if (teamId) params.set("teamId", teamId);
    if (assigneeId) params.set("assigneeId", assigneeId);
    if (overdue) params.set("overdue", "true");
    if (search) params.set("search", search);
    params.set("sort", sort);
    params.set("order", order);
    params.set("page", String(page));
    params.set("pageSize", "20");
    return params.toString();
  }, [assigneeId, order, overdue, page, priority, search, sort, status, teamId, type]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch(`/api/v1/work-items?${queryString}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          const parsed = await readApiError(response, "Unable to load work items.");
          throw new Error(parsed.message);
        }
        const body = (await response.json()) as { data: ListResponse };
        if (active) setData(body.data);
      } catch (loadError) {
        if (!active || controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load work items.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [queryString, refreshKey]);

  const activeFilterCount = [
    status,
    priority,
    type,
    teamId,
    assigneeId,
    overdue ? "true" : "",
    search,
  ].filter(Boolean).length;

  function clearFilters() {
    setSearchDraft("");
    updateParams({
      status: null,
      priority: null,
      type: null,
      teamId: null,
      assigneeId: null,
      overdue: null,
      search: null,
      page: "1",
    });
  }

  function changeSort(value: string) {
    const [nextSort, nextOrder] = value.split(":");
    updateParams({ sort: nextSort, order: nextOrder, page: "1" });
  }

  const hasRows = Boolean(data?.items.length);
  const showInitialSkeleton = loading && !data && !error;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <ListChecks className="size-3.5" aria-hidden="true" />
            Operations queue
          </>
        }
        title="Work items"
        description="Track, assign, and resolve operational work across the teams you belong to."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setRefreshKey((key) => key + 1)}
              disabled={loading}
              aria-label="Refresh work items"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden="true" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button asChild>
              <Link href="/work-items/create">
                <Plus className="size-4" aria-hidden="true" />
                New work item
              </Link>
            </Button>
          </>
        }
      />

      {showInitialSkeleton ? (
        <WorkItemsSkeleton />
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-3 shadow-card sm:p-4">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Search by title, key, or description…"
                  className="pl-9 pr-9"
                  aria-label="Search work items"
                />
                {searchDraft ? (
                  <button
                    type="button"
                    onClick={() => setSearchDraft("")}
                    className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    aria-label="Clear search"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={assigneeId === currentUserId ? "secondary" : "outline"}
                  onClick={() =>
                    updateParams({
                      assigneeId: assigneeId === currentUserId ? null : currentUserId,
                      page: "1",
                    })
                  }
                  aria-pressed={assigneeId === currentUserId}
                >
                  My items
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={overdue ? "secondary" : "outline"}
                  onClick={() => updateParams({ overdue: overdue ? null : "true", page: "1" })}
                  aria-pressed={overdue}
                >
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  Overdue
                </Button>
                {activeFilterCount > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={clearFilters}
                    className="text-muted-foreground"
                  >
                    Clear filters
                    <span className="grid size-4 place-items-center rounded-full bg-muted text-[9px] font-semibold tabular-nums text-foreground">
                      {activeFilterCount}
                    </span>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2 md:grid-cols-5">
              <label className="sr-only" htmlFor="filter-status">
                Filter by status
              </label>
              <Select
                id="filter-status"
                value={status}
                onChange={(event) =>
                  updateParams({ status: event.target.value || null, page: "1" })
                }
              >
                <option value="">All statuses</option>
                {WORK_ITEM_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {STATUS_LABELS[option]}
                  </option>
                ))}
              </Select>

              <label className="sr-only" htmlFor="filter-priority">
                Filter by priority
              </label>
              <Select
                id="filter-priority"
                value={priority}
                onChange={(event) =>
                  updateParams({ priority: event.target.value || null, page: "1" })
                }
              >
                <option value="">All priorities</option>
                {PRIORITIES.map((option) => (
                  <option key={option} value={option}>
                    {PRIORITY_LABELS[option]}
                  </option>
                ))}
              </Select>

              <label className="sr-only" htmlFor="filter-type">
                Filter by type
              </label>
              <Select
                id="filter-type"
                value={type}
                onChange={(event) =>
                  updateParams({ type: event.target.value || null, page: "1" })
                }
              >
                <option value="">All types</option>
                {WORK_ITEM_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {TYPE_LABELS[option]}
                  </option>
                ))}
              </Select>

              <label className="sr-only" htmlFor="filter-team">
                Filter by team
              </label>
              <Select
                id="filter-team"
                value={teamId}
                onChange={(event) =>
                  updateParams({ teamId: event.target.value || null, page: "1" })
                }
                disabled={teams.length === 0}
              >
                <option value="">All teams</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.key} · {team.name}
                  </option>
                ))}
              </Select>

              <label className="sr-only" htmlFor="sort-work-items">
                Sort work items
              </label>
              <Select
                id="sort-work-items"
                value={sortValue}
                onChange={(event) => changeSort(event.target.value)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {error ? (
            <EmptyState
              icon={AlertTriangle}
              title="Work items couldn’t load"
              description={error}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" onClick={() => setRefreshKey((key) => key + 1)}>
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Try again
                  </Button>
                  {activeFilterCount > 0 ? (
                    <Button variant="ghost" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : null}
                </div>
              }
            />
          ) : !data ? (
            <WorkItemsSkeleton />
          ) : !hasRows ? (
            <EmptyState
              icon={activeFilterCount > 0 ? SlidersHorizontal : ListChecks}
              title={activeFilterCount > 0 ? "No work matches these filters" : "No work items yet"}
              description={
                activeFilterCount > 0
                  ? "Try broadening your search or clearing one of the active filters."
                  : "Create the first work item to start tracking operational work for your team."
              }
              action={
                activeFilterCount > 0 ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/work-items/create">
                      <Plus className="size-4" aria-hidden="true" />
                      Create work item
                    </Link>
                  </Button>
                )
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  <span className="font-medium text-foreground">
                    {formatNumber(data.meta.total)}
                  </span>{" "}
                  {pluralize(data.meta.total, "work item")}
                  {activeFilterCount > 0 ? " matching your filters" : " in your teams"}
                </p>
                {loading ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                    Refreshing…
                  </span>
                ) : null}
              </div>

              <Card className="overflow-hidden">
                <div className="hidden md:block" aria-busy={loading}>
                  <Table>
                    <TableCaption className="sr-only">
                      Work items, page {data.meta.page} of {Math.max(1, data.meta.totalPages)}
                    </TableCaption>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="w-[38%] pl-5">Work item</TableHead>
                        <TableHead className="w-28">Priority</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead className="w-40">Assignee</TableHead>
                        <TableHead className="w-32">Due</TableHead>
                        <TableHead className="w-24">Team</TableHead>
                        <TableHead className="w-12 pr-5">
                          <span className="sr-only">Open</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((item) => {
                        const overdueItem = isOverdueStatus(item.dueDate, item.status);

                        return (
                          <TableRow key={item.id} className="group">
                            <TableCell className="pl-5">
                              <div className="flex min-w-0 flex-col gap-1.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono text-[10px] font-medium text-muted-foreground">
                                    {item.publicKey}
                                  </span>
                                  <TypeBadge type={item.type} className="h-5 text-[10px]" />
                                </div>
                                <Link
                                  href={`/work-items/${item.id}`}
                                  className="truncate text-[13px] font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                                >
                                  {item.title}
                                </Link>
                              </div>
                            </TableCell>
                            <TableCell>
                              <PriorityBadge priority={item.priority} />
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={item.status} />
                            </TableCell>
                            <TableCell>
                              {item.assignee ? (
                                <span className="flex min-w-0 items-center gap-2">
                                  <UserAvatar
                                    name={item.assignee.name}
                                    email={item.assignee.email}
                                    size="xs"
                                  />
                                  <span className="truncate text-xs text-muted-foreground">
                                    {item.assignee.name ?? item.assignee.email}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/70">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "text-xs",
                                  overdueItem
                                    ? "font-medium text-destructive"
                                    : "text-muted-foreground",
                                )}
                              >
                                {formatDueDate(item.dueDate)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {item.team.key}
                              </Badge>
                            </TableCell>
                            <TableCell className="pr-5">
                              <Link
                                href={`/work-items/${item.id}`}
                                className="grid size-7 place-items-center rounded-md text-muted-foreground/40 transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                                aria-label={`Open ${item.publicKey}: ${item.title}`}
                              >
                                <ArrowUpRight className="size-3.5" aria-hidden="true" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="divide-y divide-border/70 md:hidden" aria-busy={loading}>
                  {data.items.map((item) => {
                    const overdueItem = isOverdueStatus(item.dueDate, item.status);
                    return (
                      <Link
                        key={item.id}
                        href={`/work-items/${item.id}`}
                        className="group block p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[10px] font-medium text-muted-foreground">
                              {item.publicKey}
                            </span>
                            <StatusBadge status={item.status} />
                          </div>
                          <ArrowUpRight
                            className="size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-primary"
                            aria-hidden="true"
                          />
                        </div>
                        <p className="mt-2 text-sm font-medium leading-snug text-foreground">
                          {item.title}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <PriorityBadge priority={item.priority} />
                          <TypeBadge type={item.type} className="h-5 text-[10px]" />
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {item.team.key}
                          </Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
                          <span className="flex min-w-0 items-center gap-1.5">
                            {item.assignee ? (
                              <>
                                <UserAvatar
                                  name={item.assignee.name}
                                  email={item.assignee.email}
                                  size="xs"
                                  className="size-5 text-[8px]"
                                />
                                <span className="truncate">
                                  {item.assignee.name ?? item.assignee.email}
                                </span>
                              </>
                            ) : (
                              "Unassigned"
                            )}
                          </span>
                          <span className={cn(overdueItem && "font-medium text-destructive")}>
                            {formatDueDate(item.dueDate)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Card>

              <div className="flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground">
                  Showing{" "}
                  <span className="font-medium text-foreground">
                    {(data.meta.page - 1) * data.meta.pageSize + 1}–
                    {Math.min(data.meta.page * data.meta.pageSize, data.meta.total)}
                  </span>{" "}
                  of <span className="font-medium text-foreground">{data.meta.total}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.meta.page <= 1 || loading}
                    onClick={() => updateParams({ page: String(data.meta.page - 1) })}
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    Previous
                  </Button>
                  <span className="px-1 text-[11px] tabular-nums text-muted-foreground">
                    Page {data.meta.page} of {Math.max(1, data.meta.totalPages)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.meta.page >= data.meta.totalPages || loading}
                    onClick={() => updateParams({ page: String(data.meta.page + 1) })}
                  >
                    Next
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
