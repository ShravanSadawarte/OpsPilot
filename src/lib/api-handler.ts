import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSession, validateCsrfToken, getCsrfTokenFromCookie } from "@/lib/auth";
import { AppError, err, toErrorResponse, requestId, ErrorCode } from "@/lib/http";

export type AuthedUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
};

type AuthedHandler = (
  user: AuthedUser,
  req: NextRequest,
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a Route Handler with authentication + CSRF protection + error handling.
 * Every protected endpoint authenticates the user at the server boundary.
 * Mutating methods (POST/PUT/PATCH/DELETE) require a double-submit CSRF token.
 */
export function withAuth(handler: AuthedHandler, options: { csrf?: boolean } = {}) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const rid = requestId(req.headers);
    try {
      const session = await getSession();
      const user = session?.user;
      if (!user) {
        return err(
          new AppError(401, ErrorCode.UNAUTHENTICATED, "Authentication required."),
          { requestId: rid },
        );
      }

      if (
        options.csrf &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(req.method ?? "")
      ) {
        const cookieToken = await getCsrfTokenFromCookie();
        const headerToken = req.headers.get("x-csrf-token");
        validateCsrfToken(headerToken, cookieToken);
      }

      return await handler(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
        },
        req,
      );
    } catch (e: unknown) {
      return toErrorResponse(e, { requestId: rid });
    }
  };
}

/** Read the body as JSON safely. */
export async function jsonBody<T = unknown>(req: NextRequest): Promise<T> {
  const text = await req.text();
  if (!text) throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Request body is required.");
  return JSON.parse(text) as T;
}
