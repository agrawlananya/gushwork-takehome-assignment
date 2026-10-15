import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiError } from "../../shared/api";

export type ErrorCode = ApiError["error"]["code"];

/** Standard error shape (Tech §6): `{ error: { code, message } }`. */
export function apiError(
  c: Context,
  status: ContentfulStatusCode,
  code: ErrorCode,
  message: string,
  extra: { leadId?: string } = {},
) {
  return c.json<ApiError>({ error: { code, message, ...extra } }, status);
}
