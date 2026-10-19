export interface DashboardMetrics {
  openWork: number;
  criticalHighWork: number;
  overdueWork: number;
  unassignedWork: number;
  myWork: number;
  pendingApprovals: number;
  teamCount: number;
  recentActivity: Array<{
    id: string;
    type: string;
    createdAt: string;
    actor: { id: string; name: string | null; email: string } | null;
    workItem: { id: string; publicKey: string; title: string } | null;
  }>;
  statusSummary: Array<{ status: string; count: number }>;
  prioritySummary: Array<{ priority: string; count: number }>;
  attentionRequired: Array<{
    id: string;
    publicKey: string;
    title: string;
    status: string;
    priority: string;
    assigneeId: string | null;
    dueDate: string | null;
  }>;
}

export interface WorkItem {
  id: string;
  publicKey: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  teamId: string;
  assigneeId: string | null;
  reporterId: string;
  team: { id: string; key: string; name: string };
  assignee: { id: string; name: string | null; email: string } | null;
  reporter: { id: string; name: string | null; email: string };
  version: number;
  dueDate: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  workItemId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string | null; email: string };
}

export interface Team {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  memberCount: number;
  userRole: string | null;
  workItemCount: number;
  memberships?: Array<{
    id: string;
    user: { id: string; name: string | null; email: string; role: string };
    role: string;
  }>;
}

export interface Approval {
  id: string;
  status: string;
  reason: string | null;
  requestedBy: { id: string; name: string | null; email: string };
  decidedBy: { id: string; name: string | null; email: string } | null;
  decidedAt: string | null;
  createdAt: string;
  workItem: {
    id: string;
    publicKey: string;
    title: string;
    status: string;
    teamId?: string;
    team?: { id: string; key: string; name: string };
  };
}

export interface ActivityEvent {
  id: string;
  type: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string | null; email: string } | null;
  actorId: string | null;
  workItemId: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiData<T> {
  data: T;
  success: boolean;
}
