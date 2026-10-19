"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/components/ui/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Plus, RefreshCw, Search } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

type Status = "OPEN" | "IN_PROGRESS" | "BLOCKED" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type Type = "INCIDENT" | "CUSTOMER_ISSUE" | "ENGINEERING_TASK" | "PAYMENT_INVESTIGATION" | "COMPLIANCE_REQUEST" | "OPERATIONAL_TASK";

interface WorkItem {
  id: string;
  publicKey: string;
  title: string;
  status: Status;
  priority: Priority;
  type: Type;
  assignee: { name: string | null } | null;
  team: { key: string; name: string };
}

interface ListResponse {
  items: WorkItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const STATUSES: Status[] = ["OPEN", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "RESOLVED", "CLOSED"];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const TYPES: Type[] = ["INCIDENT", "CUSTOMER_ISSUE", "ENGINEERING_TASK", "PAYMENT_INVESTIGATION", "COMPLIANCE_REQUEST", "OPERATIONAL_TASK"];

export default function WorkItemsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const status = searchParams.get("status") ?? "";
  const priority = searchParams.get("priority") ?? "";
  const type = searchParams.get("type") ?? "";
  const search = searchParams.get("search") ?? "";
  const assigneeId = searchParams.get("assigneeId") ?? "";
  const page = Number(searchParams.get("page")) || 1;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (priority) qs.set("priority", priority);
      if (type) qs.set("type", type);
      if (search) qs.set("search", search);
      if (assigneeId) qs.set("assigneeId", assigneeId);
      qs.set("page", String(page));
      qs.set("pageSize", "20");

      const res = await apiFetch(`/api/v1/work-items?${qs}`);
      if (!res.ok) throw new Error("Failed to load work items");
      const json = await res.json();
      setData(json.data);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
    } finally {
      setLoading(false);
    }
  }, [status, priority, type, search, assigneeId, page, toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const statusBadge = (s: Status) => {
    const v: Record<Status, string> = { OPEN: "default", IN_PROGRESS: "default", BLOCKED: "destructive", IN_REVIEW: "outline", RESOLVED: "secondary", CLOSED: "secondary" };
    return <Badge variant={(v[s] as "default" | "destructive" | "outline" | "secondary")}>{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Work items</h1>
          <p className="text-sm text-muted-foreground">Track, assign, and manage operational work.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/work-items/create">
            <Button className="hidden sm:inline">
              <Plus className="size-4 mr-2" /> Create work item
            </Button>
          </Link>
          <Button onClick={fetchItems} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Search className="size-4" /> Filters</CardTitle>
        </CardHeader>
        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select value={status} onChange={(v) => router.push(`/work-items?status=${v}&page=1`)}>
            <option></option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select value={priority} onChange={(v) => router.push(`/work-items?priority=${v}&page=1`)}>
            <option></option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select value={type} onChange={(v) => router.push(`/work-items?type=${v}&page=1`)}>
            <option></option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input value={search} onChange={(e) => router.push(`/work-items?search=${e.target.value}&page=1`)} placeholder="Search" />
        </div>
      </Card>

      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Key</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead className="w-20">Priority</TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead className="w-32">Assignee</TableHead>
              <TableHead className="w-20">Team</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || !data ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  Loading work items...
                </TableCell>
              </TableRow>
            ) : data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  No work items found.
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.publicKey}</TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/work-items/${item.id}`} className="hover:underline">{item.title}</Link>
                  </TableCell>
                  <TableCell className="text-xs">{item.type}</TableCell>
                  <TableCell>{statusBadge(item.priority as Status)}</TableCell>
                  <TableCell>{statusBadge(item.status)}</TableCell>
                  <TableCell className="text-xs">{item.assignee?.name ?? "Unassigned"}</TableCell>
                  <TableCell className="text-xs">{item.team.key}</TableCell>
                  <TableCell>
                    <Link href={`/work-items/${item.id}`} className="text-sm underline underline-offset-4">View</Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} items
          </p>
          <div className="flex gap-1">
            {data.meta.page > 1 && (
              <Button variant="outline" size="sm" onClick={() => router.push(`/work-items?page=${data.meta.page - 1}`)}>Prev</Button>
            )}
            {data.meta.page < data.meta.totalPages && (
              <Button variant="outline" size="sm" onClick={() => router.push(`/work-items?page=${data.meta.page + 1}`)}>Next</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
