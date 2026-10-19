import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Standard envelope for every API response. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
  requestId?: string;
}

/** Stable error codes used across the API. */
export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHENTICATED = "UNAUTHENTICATED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  VERSION_CONFLICT = "VERSION_CONFLICT",
  IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT",
  RATE_LIMITED = "RATE_LIMITED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  WORKFLOW_TRANSITION_INVALID = "WORKFLOW_TRANSITION_INVALID",
}

export class AppError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode;
  public readonly details?: Record<string, string[]>;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Build a successful JSON response. */
export function ok<T>(
  data: T,
  options?: { status?: number; meta?: ApiResponse["meta"]; requestId?: string },
): NextResponse<ApiResponse<T>> {
  const body: ApiResponse<T> = {
    success: true,
    data,
    requestId: options?.requestId,
  };
  if (options?.meta) body.meta = options.meta;
  return NextResponse.json(body, { status: options?.status ?? 200 });
}

/** Build an error JSON response from an AppError. */
export function err(
  e: AppError,
  options?: { requestId?: string },
): NextResponse<ApiResponse> {
  const body: ApiResponse = {
    success: false,
    error: {
      code: e.code,
      message: e.message,
      ...(e.details ? { details: e.details } : {}),
    },
    requestId: options?.requestId,
  };
  return NextResponse.json(body, { status: e.status });
}

/** Build an error JSON response for an unexpected error. */
export function internalError(
  message = "Internal server error",
  options?: { requestId?: string },
): NextResponse<ApiResponse> {
  const body: ApiResponse = {
    success: false,
    error: { code: ErrorCode.INTERNAL_ERROR, message },
    requestId: options?.requestId,
  };
  return NextResponse.json(body, { status: 500 });
}

/** Convert a Zod validation failure into a 400 AppError with field details. */
export function validationErrorFromZod(e: ZodError): AppError {
  const details: Record<string, string[]> = {};
  for (const issue of e.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    (details[key] ??= []).push(issue.message);
  }
  return new AppError(400, ErrorCode.VALIDATION_ERROR, "Validation failed.", details);
}

/**
 * Convert any thrown error into the standard error envelope.
 * Internal error details are logged server-side and never returned to clients.
 */
export function toErrorResponse(
  e: unknown,
  options?: { requestId?: string },
): NextResponse<ApiResponse> {
  if (e instanceof AppError) return err(e, options);
  if (e instanceof ZodError) return err(validationErrorFromZod(e), options);
  console.error("[api] Unhandled error:", e);
  return internalError("Internal server error", options);
}

/** Extract a short, stable request id for tracing/logging. */
export function requestId(headers: Headers): string {
  return headers.get("x-request-id") ?? crypto.randomUUID();
}
