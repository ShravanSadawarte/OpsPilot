export type ApiErrorDetails = Record<string, string[]>;

export type ParsedApiError = {
  message: string;
  code?: string;
  details?: ApiErrorDetails;
};

export async function readApiError(
  response: Response,
  fallback = "Something went wrong. Please try again.",
): Promise<ParsedApiError> {
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string; details?: ApiErrorDetails };
    };
    return {
      message: body.error?.message ?? fallback,
      code: body.error?.code,
      details: body.error?.details,
    };
  } catch {
    return { message: fallback };
  }
}
