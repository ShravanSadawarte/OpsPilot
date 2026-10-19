"use client";

import * as React from "react";

export type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
};

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastState = {
  toasts: Toast[];
};

const ToastContext = React.createContext<{
  toasts: Toast[];
  toast: (props: Omit<Toast, "id">) => void;
  dismiss: (id?: string) => void;
} | undefined>(undefined);

let count = 0;

function genId() {
  return (++count).toString();
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ToastState>({ toasts: [] });

  const toast = React.useCallback(
    (props: Omit<Toast, "id">) => {
      const id = genId();
      setState((s) => ({ toasts: [...s.toasts, { ...props, id }] }));
      const delay = props.duration ?? 4000;
      const timer = setTimeout(() => {
        setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, delay);
      return id;
    },
    [],
  );

  const dismiss = React.useCallback((id?: string) => {
    setState((s) =>
      id === undefined ? { toasts: [] } : { toasts: s.toasts.filter((t) => t.id !== id) },
    );
  }, []);

  return (
    <ToastContext.Provider value={{ toasts: state.toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export function Toast({ toast }: { toast: Toast }) {
  return (
    <div
      className={`flex w-full items-center gap-4 p-4 rounded-lg border ${
        toast.variant === "destructive"
          ? "border-destructive/50 bg-destructive text-destructive-foreground"
          : "border-primary bg-background text-foreground"
      }`}
    >
      <div className="flex flex-col gap-1">
        {toast.title && (
          <h4 className="font-semibold">{toast.title}</h4>
        )}
        {toast.description && <p className="text-sm">{toast.description}</p>}
      </div>
    </div>
  );
}

export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed top-0 right-0 z-50 flex flex-col gap-2 p-4 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto"
          onClick={() => dismiss(t.id)}
        >
          <Toast toast={t} />
        </div>
      ))}
    </div>
  );
}
