import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Activity, ListChecks, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { BrandLockup } from "@/components/brand";

export const metadata: Metadata = {
  title: "Sign in",
};

const proofPoints = [
  {
    icon: ListChecks,
    title: "One operational queue",
    description: "Incidents, customer issues, and internal work in a shared, filterable view.",
  },
  {
    icon: ShieldCheck,
    title: "Decisions with guardrails",
    description: "Role-aware approvals, optimistic concurrency, and server-enforced permissions.",
  },
  {
    icon: Activity,
    title: "An auditable trail",
    description: "Every status change, assignment, comment, and approval is recorded.",
  },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(480px,0.95fr)]">
      <aside className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="bg-grid-faint absolute inset-0 opacity-70" aria-hidden="true" />
        <div
          className="absolute -right-24 top-1/2 size-[440px] -translate-y-1/2 rounded-full border border-white/[0.04]"
          aria-hidden="true"
        />
        <div
          className="absolute -right-6 top-1/2 size-[280px] -translate-y-1/2 rounded-full border border-white/[0.05]"
          aria-hidden="true"
        />
        <div className="relative flex min-h-dvh flex-col px-10 py-10 xl:px-14">
          <BrandLockup
            textClassName="text-white"
            subtitle="Operations workspace"
            className="w-fit"
          />

          <div className="my-auto max-w-xl py-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-sidebar-muted">
              <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              Operational clarity, built in
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-white xl:text-[46px]">
              One command center for the work that keeps business moving.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400">
              OpsPilot gives operations teams a shared view of the work in flight, the
              decisions waiting on them, and the history behind every change.
            </p>

            <ul className="mt-10 space-y-5">
              {proofPoints.map((point) => {
                const Icon = point.icon;
                return (
                  <li key={point.title} className="flex gap-3.5">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">{point.title}</p>
                      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-400">
                        {point.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-6 text-[11px] text-slate-500">
            <span>Session-based access · CSRF protected</span>
            <span>OpsPilot</span>
          </div>
        </div>
      </aside>

      <main
        id="main-content"
        className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 sm:px-8"
      >
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
