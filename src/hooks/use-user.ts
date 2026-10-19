"use client";

import { useEffect, useState, useCallback } from "react";

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
};

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/users/me", {
        cache: "no-store",
        headers: { "x-csrf-token": "" },
      });
      if (res.ok) {
        const json = await res.json();
        setUser(json.data ?? null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { user, isLoading };
}
