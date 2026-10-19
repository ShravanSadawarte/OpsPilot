"use client";

/** Read the CSRF token from the cookie (client-side). */
export function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(^|; )ops_csrf=([^;]+)/);
  return match ? match[2] : null;
}

/** Fetch a JSON API endpoint with CSRF protection and auth error handling. */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> ?? {}),
  };
  const token = readCsrfToken();
  if (token) headers["x-csrf-token"] = token;

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }
  return res;
}
