"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { AppError, ErrorCode, ok } from "@/lib/http";
import {
  requireUser,
  verifyPassword,
  createSession,
  revokeSession,
  setSessionCookie,
  clearSessionCookie,
  setCsrfCookie,
  clearCsrfCookie,
  generateCsrfToken,
  checkLoginRateLimit,
  clearLoginRateLimit,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;

const MAX_LOGIN_ATTEMPTS = Number(process.env.LOGIN_RATE_LIMIT_MAX ?? "5");
const LOGIN_WINDOW_SECONDS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS ?? "300");

/** Identifier for rate limiting: prefer email, fall back to IP. */
function rateLimitIdentifier(email: string | undefined, ip: string | null): string {
  return email ? `email:${email.toLowerCase()}` : `ip:${ip ?? "unknown"}`;
}

export async function login(
  input: LoginInput,
  { ip, csrfHeaderToken }: { ip: string | null; csrfHeaderToken: string | null },
) {
  const data = LoginSchema.parse(input);

  // Rate limit before doing any DB work (prevents enumeration + brute force).
  const id = rateLimitIdentifier(data.email, ip);
  const limit = checkLoginRateLimit(id, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_SECONDS);
  if (!limit.allowed) {
    throw new AppError(
      429,
      ErrorCode.RATE_LIMITED,
      "Too many login attempts. Please try again later.",
      { retryAfter: [String(Math.ceil((limit.resetAt - Date.now()) / 1000))] },
    );
  }

  const user = await db.user.findUnique({ where: { email: data.email } });
  if (!user || !user.isActive) {
    // Consume a rate-limit attempt even for unknown users to prevent enumeration.
    throw new AppError(401, ErrorCode.UNAUTHENTICATED, "Invalid email or password.");
  }

  const valid = await verifyPassword(user.passwordHash, data.password);
  if (!valid) {
    throw new AppError(401, ErrorCode.UNAUTHENTICATED, "Invalid email or password.");
  }

  // Success: clear rate-limit state and create session.
  clearLoginRateLimit(id);

  const { token } = await createSession(user.id);
  await setSessionCookie(token);

  // Issue a fresh signed CSRF token cookie for the authenticated session.
  const csrfToken = generateCsrfToken();
  await setCsrfCookie(csrfToken);

  return ok({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    csrfToken,
  });
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    // revokeSession hashes the token before deleting; sessions are stored hashed.
    await revokeSession(token);
  }
  await clearSessionCookie();
  await clearCsrfCookie();
  return ok({ ok: true });
}

/** Current authenticated user (session restoration). */
export async function me() {
  const user = await requireUser();
  return ok({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  });
}

export async function csrfToken() {
  // Always issue a fresh signed token so stale/legacy cookies are replaced.
  const token = generateCsrfToken();
  await setCsrfCookie(token);
  return ok({ csrfToken: token });
}
