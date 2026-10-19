"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "destructive" | "warning" | "info";

export type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  toasts: Toast[];
  toast: (props: Omit<Toast, "id">) => string;
  dismiss: (id?: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

let toastCount = 0;

function genId() {
  toastCount += 1;
  return String(toastCount);
}

const variantConfig: Record<
  ToastVariant,
  { icon: LucideIcon; iconClassName: string; accentClassName: string }
> = {
  default: {
    icon: Info,
    iconClassName: "text-muted-foreground",
    accentClassName: "bg-border",
  },
  success: {
    icon: CheckCircle2,
    iconClassName: "text-success",
    accentClassName: "bg-success",
  },
  destructive: {
    icon: AlertTriangle,
    iconClassName: "text-destructive",
    accentClassName: "bg-destructive",
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: "text-warning",
    accentClassName: "bg-warning",
  },
  info: {
    icon: Info,
    iconClassName: "text-info",
    accentClassName: "bg-info",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id?: string) => {
    if (id === undefined) {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
      setToasts([]);
      return;
    }
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback(
    (props: Omit<Toast, "id">) => {
      const id = genId();
      setToasts((current) => [...current.slice(-3), { ...props, id }]);
      const timer = setTimeout(() => dismiss(id), props.duration ?? 4500);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  React.useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}

function ToastCard({ toast }: { toast: Toast }) {
  const { dismiss } = useToast();
  const variant = toast.variant ?? "default";
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      className="toast-item pointer-events-auto relative flex w-full gap-3 overflow-hidden rounded-xl border border-border bg-popover p-3.5 pr-10 text-popover-foreground shadow-float"
      role={variant === "destructive" ? "alert" : "status"}
      aria-atomic="true"
    >
      <span className={cn("absolute inset-y-0 left-0 w-0.5", config.accentClassName)} aria-hidden="true" />
      <Icon className={cn("mt-0.5 size-4 shrink-0", config.iconClassName)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {toast.title ? <p className="text-[13px] font-semibold leading-5">{toast.title}</p> : null}
        {toast.description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className="absolute right-2 top-2 grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        aria-label="Dismiss notification"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const { toasts } = useToast();
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
