import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export type ErrorCode = "VALIDATION" | "NOT_FOUND" | "RATE_LIMITED" | "INTERNAL";

/** Standard error shape (Tech §6): `{ error: { code, message } }`. */
export function apiError(c: Context, status: ContentfulStatusCode, code: ErrorCode, message: string) {
  return c.json({ error: { code, message } }, status);
}
