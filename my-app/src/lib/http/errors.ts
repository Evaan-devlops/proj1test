// src/lib/http/errors.ts
/* =============================================================================
(0) PURPOSE: Centralized error contract + message mapping + extraction
==============================================================================
Why this file exists:
- Keep ALL error policy in one place (consistent UX across whole app)
- client.ts focuses on HTTP mechanics; errors.ts focuses on error meaning

JS concepts referenced by the client:
- type guards (runtime checks) to safely inspect unknown payloads
- mapping status codes -> user-safe text
============================================================================= */

/* =============================================================================
(1) TYPE: ApiError (single shape across the app)
============================================================================= */
export type ApiError = {
  status: number; // 0 means we never received an HTTP response (network/CORS/offline/abort)
  message: string; // user-safe message to show in UI
  details?: unknown; // raw payload or exception (for logs only)
};

/* =============================================================================
(2) userSafeMessage(status): status -> friendly UX message
==============================================================================
WHY:
- Components should not decide copy text.
- Copy lives centrally so UX is consistent and easy to update later.
============================================================================= */
export function userSafeMessage(status: number): string {
  if (status === 0) return "Network error. Please check your connection.";
  if (status >= 500) return "Something went wrong. Please try again.";
  if (status === 401) return "Please sign in and try again.";
  if (status === 403) return "You don’t have permission to do that.";
  if (status === 404) return "Requested resource wasn’t found.";
  return "Couldn’t complete the action. Please try again.";
}

/* =============================================================================
(3) extractServerMessage(payload): try to pull message from backend error JSON
==============================================================================
Goal:
- If backend provides a safe message, show it.
- Else fallback to userSafeMessage(status).

Handles common shapes:
- { message: string }
- { detail: string }
- { error: { message: string } }
- (extend later if needed)
============================================================================= */
export function extractServerMessage(parsed: unknown): string | undefined {
  if (typeof parsed !== "object" || parsed === null) return undefined;

  const obj = parsed as Record<string, unknown>;

  const msg = obj["message"];
  if (typeof msg === "string") return msg;

  const detail = obj["detail"];
  if (typeof detail === "string") return detail;

  const err = obj["error"];
  if (typeof err === "object" && err !== null) {
    const errObj = err as Record<string, unknown>;
    const errMsg = errObj["message"];
    if (typeof errMsg === "string") return errMsg;
  }

  return undefined;
}

/* =============================================================================
(4) isAbortError(e): detect AbortController abort exceptions
==============================================================================
JS concept:
- In browsers, aborted fetch throws a DOMException-like error with name "AbortError"
============================================================================= */
export function isAbortError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;

  const maybe = e as { name?: unknown };
  return maybe.name === "AbortError";
}