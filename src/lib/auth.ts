import { cookies } from "next/headers";
import { argon2id, hash, verify } from "argon2";
import { createHash, randomBytes } from "crypto";
import { UserRole } from "@prisma/client";
import { db } from "./db";
import { AppError, ErrorCode } from "./http";

const TOKEN_BYTES = 32;
const CSRF_COOKIE_NAME = "ops_csrf";
const SESSION_COOKIE_NAME = "ops_session";

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const AUTH_SECRET = requiredEnv("AUTH_SECRET");
export const SESSION_TTL_SECONDS = parseInt(
  process.env.SESSION_TTL_SECONDS ?? "86400",
  10,
);
export const SESSION_COOKIE_SECURE =
  process.env.SESSION_COOKIE_SECURE === "true";
export const SESSION_COOKIE_SAMESITE: "lax" | "strict" | "none" =
  (process.env.SESSION_COOKIE_SAMESITE ?? "lax") as "lax" | "strict" | "none";

/** Hash a password with Argon2id (via the argon2 library — no custom crypto). */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
}

/** Verify a plaintext password against an Argon2id hash. */
export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(hash, password);
  } catch {
    return false;
  }
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/* ------------------------------------------------------------------ */
/* Sessions                                                           */
/* ------------------------------------------------------------------ */

export async function createSession(userId: string): Promise<{ token: string }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await db.session.create({
    data: {
      userId,
      token: sha256(token), // store a hash, never the raw token
      expiresAt,
    },
  });

  return { token };
}

export async function revokeSession(token: string): Promise<void> {
  try {
    await db.session.delete({ where: { token: sha256(token) } });
  } catch {
    // ignore if already gone
  }
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

/**
 * Return the authenticated user for the current request, or null.
 * Validates session expiration and revocation on every call.
 */
export async function getSession(): Promise<{
  user: Awaited<ReturnType<typeof db.user.findUnique>>;
  session: Awaited<ReturnType<typeof db.session.findUnique>>;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = sha256(token);
  const session = await db.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session) return null;
  if (!session.user) return null;
  if (!session.user.isActive) return null;
  if (session.expiresAt < new Date()) {
    // expired — revoke and treat as unauthenticated
    await revokeSession(token);
    return null;
  }

  return { user: session.user, session };
}

/** Require authentication; throw UNAUTHENTICATED if no valid session. */
export async function requireUser(): Promise<{
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
}> {
  const s = await getSession();
  if (!s || !s.user) {
    throw new AppError(401, ErrorCode.UNAUTHENTICATED, "Authentication required.");
  }
  return {
    id: s.user.id,
    email: s.user.email,
    name: s.user.name,
    role: s.user.role,
    isActive: s.user.isActive,
  };
}

/** Set the session cookie (HttpOnly, Secure in production, SameSite). */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: SESSION_COOKIE_SAMESITE,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Clear the session cookie. */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: SESSION_COOKIE_SAMESITE,
    path: "/",
    maxAge: 0,
  });
}

/* ------------------------------------------------------------------ */
/* CSRF (double-submit cookie)                                        */
/* ------------------------------------------------------------------ */

/** Generate a CSRF token and set it as a non-HttpOnly cookie readable by JS. */
export async function setCsrfCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: SESSION_COOKIE_SECURE,
    sameSite: SESSION_COOKIE_SAMESITE,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Read the CSRF token cookie. */
export async function getCsrfTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE_NAME)?.value ?? null;
}

/**
 * Verify a double-submit CSRF token. The caller must pass the token read from
 * the X-CSRF-Token header and compare it against the cookie value.
 */
export function validateCsrfToken(
  headerToken: string | null,
  cookieToken: string | null,
): void {
  if (!headerToken || !cookieToken) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "CSRF token missing.");
  }
  if (!timingSafeEqual(headerToken, cookieToken)) {
    throw new AppError(403, ErrorCode.FORBIDDEN, "Invalid CSRF token.");
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/* ------------------------------------------------------------------ */
/* Login rate limiting (in-memory, per serverless instance)           */
/* ------------------------------------------------------------------ */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const loginRateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Record a login attempt for an identifier (email or IP). Returns true if the
 * request is allowed, false if rate limited. Throttles after max attempts
 * within the window. Note: in-memory store is per serverless instance; for
 * multi-instance production deployments, back this with Redis.
 */
export function checkLoginRateLimit(
  identifier: string,
  maxAttempts: number,
  windowSeconds: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = loginRateLimitStore.get(identifier);
  const windowMs = windowSeconds * 1000;

  if (!entry || now > entry.resetAt) {
    loginRateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, maxAttempts - 1),
      resetAt: now + windowMs,
    };
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - entry.count),
    resetAt: entry.resetAt,
  };
}

/** Clear rate-limit state for an identifier (called on successful login). */
export function clearLoginRateLimit(identifier: string): void {
  loginRateLimitStore.delete(identifier);
}

export { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME };
