// src/lib/http/client.ts
/* ============================================================================
(0) FILE GOAL / CONTRACT  (Single “source of truth” for HTTP in app)
===============================================================================
Mental model:
“No matter what happens (204/empty JSON/4xx/5xx/network/abort/stream end),
I return a predictable object so UI never crashes or has to guess.”

Exports:
  1) request<T>()     -> non-streaming JSON calls
  2) requestStream()  -> streaming text calls (SSE recommended)

Design principles:
  - UI never needs try/catch
  - fetch doesn't throw on 4xx/5xx -> we check res.ok
  - parsing never throws to UI
  - streaming uses AsyncGenerator<string>
  - cancellation uses AbortController
  - base URL configurable in dev, same-origin in prod by default

React usage concepts (in UI):
  - store cancel() in useRef for “Stop generating”
  - buffer UI updates (don’t setState per token)
  - abort on unmount (useEffect cleanup)
============================================================================ */

/* ============================================================================
(1) IMPORTS: error policy lives in errors.ts
============================================================================ */
// ✅ type-only import (for TS verbatimModuleSyntax)
import type { ApiError } from "./errors";
import {
  userSafeMessage,
  extractServerMessage,
  isAbortError,
} from "./errors";

/* ============================================================================
(2) TYPES: predictable result shapes for UI
============================================================================ */
export type ApiResult<T> =
  | { ok: true; data: T | null }
  | { ok: false; error: ApiError };

type RequestOptions = Omit<RequestInit, "body" | "signal"> & {
  body?: unknown;          // we accept unknown, we will normalize safely
  signal?: AbortSignal;    // optional external signal (e.g. component unmount)
  timeoutMs?: number;      // fixed timeout (mainly for request())
};

export type StreamMode = "auto" | "sse" | "text";

export type ApiStreamResult =
  | {
      ok: true;
      status: number;
      contentType: string;
      stream: AsyncGenerator<string, void, void>; // single-consume iterator (Fix B)
      cancel: () => void;
    }
  | { ok: false; error: ApiError };

type StreamOptions = Omit<RequestOptions, "timeoutMs" | "mode"> & {
  mode?: StreamMode;
  idleTimeoutMs?: number; // abort stream if no chunk arrives for N ms (optional)
  onOpen?: (info: { status: number; contentType: string }) => void;
};

/* ============================================================================
(3) BASE URL (dev/prod) via import.meta.env
============================================================================
Rules:
- If url is absolute (http/https), do NOT prefix
- Else prefix with VITE_API_BASE_URL if provided
- If VITE_API_BASE_URL is empty/undefined -> same-origin paths like "/api/..."
============================================================================ */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function joinUrl(base: string, path: string): string {
  // avoid double slashes when joining
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function resolveUrl(url: string): string {
  if (isAbsoluteUrl(url)) return url;                 // absolute URL -> leave as-is
  if (!API_BASE_URL) return url;                      // same-origin -> leave as-is
  return joinUrl(API_BASE_URL, url);                  // prefix in dev (or separate domains)
}

/* ============================================================================
(4) DEFAULT HEADERS
============================================================================
We set defaults ONLY if caller didn't set them.
- request():      Accept: application/json
- requestStream():Accept: text/event-stream
============================================================================ */
function applyDefaultHeaders(headers: Headers, acceptValue: string) {
  if (!headers.has("Accept")) headers.set("Accept", acceptValue);
}

/* ============================================================================
(5) SAFE BODY READING + SAFE JSON PARSE (non-streaming)
============================================================================ */
async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function parseMaybeJson(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/* ============================================================================
(6) BODY NORMALIZATION (Fix A)
============================================================================
Only JSON-stringify plain objects/arrays/primitives.
Pass through FormData/Blob/URLSearchParams/string/etc.
============================================================================ */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function buildBodyAndHeaders(options: { body?: unknown }, headers: Headers): { body?: BodyInit } {
  if (options.body === undefined) return {};

  const b = options.body;

  // Pass-through body types (do NOT set JSON Content-Type here)
  if (
    typeof b === "string" ||
    b instanceof Blob ||
    b instanceof ArrayBuffer ||
    b instanceof FormData ||
    b instanceof URLSearchParams ||
    b instanceof ReadableStream
  ) {
    return { body: b }; // Works for: string, Blob, ArrayBuffer, FormData, URLSearchParams, ReadableStream
  }

  // JSON-stringify for plain objects, arrays, and simple primitives
  const shouldJson =
    isPlainObject(b) ||
    Array.isArray(b) ||
    typeof b === "number" ||
    typeof b === "boolean" ||
    b === null;

  if (shouldJson) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return { body: JSON.stringify(b) };
  }

  // Conservative fallback: stringify unknown objects (e.g., Date)
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return { body: JSON.stringify(b) };
}

/* ============================================================================
(7) ABORT + TIMEOUT HELPERS
============================================================================
We create one AbortController so:
- UI can cancel (stop button)
- fixed timeout can abort
- external signal can abort (unmount)
============================================================================ */
function createAbortControllerWithSignals(opts: { signal?: AbortSignal }) {
  const controller = new AbortController();

  // Merge external signal
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return controller;
}

function startFixedTimeout(controller: AbortController, timeoutMs?: number): number | undefined {
  if (!timeoutMs || timeoutMs <= 0) return undefined;
  const id = window.setTimeout(() => controller.abort(), timeoutMs);
  return id;
}

function clearTimeoutIfSet(id?: number) {
  if (id !== undefined) window.clearTimeout(id);
}

/* ============================================================================
(8) NON-STREAMING JSON REQUEST
============================================================================
Default timeout:
- request() defaults to 30s unless caller overrides with options.timeoutMs
Control flow:
  (8.1) resolve URL (baseURL)
  (8.2) headers + default Accept
  (8.3) build body safely
  (8.4) AbortController + fixed timeout
  (8.5) fetch()
  (8.6) handle 204
  (8.7) read text once + parse safely
  (8.8) return ok:false on !res.ok
  (8.9) return ok:true on success
============================================================================ */

/**
 * request<T>()
 * What it does:
 * - Calls JSON API endpoints safely
 * - Never throws to UI
 * - Returns {ok:true,data} or {ok:false,error}
 *
 * How to consume (React example):
 *   const r = await request<User>("/api/me");
 *   if (!r.ok) toast(r.error.message);
 *   else setUser(r.data);
 */
export async function request<T>(
  url: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  // (8.1) Resolve URL (dev base URL or same-origin)
  const finalUrl = resolveUrl(url);

  // (8.2) Normalize headers
  const headers = new Headers(options.headers);
  applyDefaultHeaders(headers, "application/json");

  // (8.3) Build body
  const { body } = buildBodyAndHeaders(options, headers);

  // (8.4) Setup abort + fixed timeout
  const controller = createAbortControllerWithSignals({ signal: options.signal });
  const timeoutId = startFixedTimeout(controller, options.timeoutMs ?? 30_000);

  try {
    // (8.5) fetch (note: fetch won't throw on 4xx/5xx)
    const res = await fetch(finalUrl, {
      ...options,
      headers,
      body,
      signal: controller.signal,
    });

    // (8.6) 204 No Content -> success with null
    if (res.status === 204) return { ok: true, data: null };

    // (8.7) Read body once as text and parse safely
    const text = await safeReadText(res);
    const parsed = parseMaybeJson(text);

    // (8.8) HTTP error path
    if (!res.ok) {
      const serverMessage = extractServerMessage(parsed);
      return {
        ok: false,
        error: {
          status: res.status,
          message: serverMessage ?? userSafeMessage(res.status),
          details: parsed ?? text,
        },
      };
    }

    // (8.9) Success but empty/invalid JSON -> treat as null
    if (parsed === null) return { ok: true, data: null };
    return { ok: true, data: parsed as T };
  } catch (e) {
    return {
      ok: false,
      error: {
        status: 0,
        message: isAbortError(e) ? "Request cancelled." : userSafeMessage(0),
        details: e,
      },
    };
  } finally {
    // Always clear timeout so it doesn't fire later
    clearTimeoutIfSet(timeoutId);
  }
}

/* ============================================================================
(9) STREAM PARSERS (SSE/text)
============================================================================ */

function findEventBoundary(buffer: string): number {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");
  if (lf === -1) return crlf;
  if (crlf === -1) return lf;
  return Math.min(lf, crlf);
}

async function* sseIterator(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk?: () => void
) {
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      if (value) {
        buffer += decoder.decode(value, { stream: true });
        onChunk?.(); // used for idle-timeout reset
      }

      while (true) {
        const idx = findEventBoundary(buffer);
        if (idx === -1) break;

        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx);

        if (buffer.startsWith("\r\n\r\n")) buffer = buffer.slice(4);
        else if (buffer.startsWith("\n\n")) buffer = buffer.slice(2);

        const lines = rawEvent.split(/\r?\n/);
        const dataLines = lines
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart());

        if (!dataLines.length) continue;

        const data = dataLines.join("\n");
        if (data === "[DONE]") return;

        yield data;
      }
    }

    const tail = buffer.trim();
    if (tail) {
      const lines = tail.split(/\r?\n/);
      const dataLines = lines
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart());

      if (dataLines.length) {
        const data = dataLines.join("\n");
        if (data !== "[DONE]") yield data;
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
}

async function* textIterator(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk?: () => void
) {
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      if (value) {
        onChunk?.(); // used for idle-timeout reset
        yield decoder.decode(value, { stream: true });
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
}

/* ============================================================================
(10) STREAMING REQUEST (SSE recommended for chat)
============================================================================
Defaults:
- Accept: text/event-stream
- No fixed timeout by default (streams can be long)
- Optional idleTimeoutMs: abort if no chunk arrives for N ms

Control flow:
  (10.1) resolve URL (baseURL)
  (10.2) headers + default Accept
  (10.3) build body safely
  (10.4) AbortController merges external signal
  (10.5) fetch()
  (10.6) handle !res.ok (read error text)
  (10.7) handle 204 / no body -> ok:true with empty generator (Fix C)
  (10.8) choose mode (auto -> SSE if content-type says event-stream)
  (10.9) implement optional idle timeout reset on each chunk
  (10.10) return iterator directly (Fix B)
============================================================================ */

/**
 * requestStream()
 * What it does:
 * - Calls a streaming endpoint (LLM text streaming)
 * - Returns AsyncGenerator<string> that yields chunks
 * - Never throws to UI
 * - Provides cancel() to stop generation
 *
 * How to consume (React example):
 *   const r = await requestStream("/api/chat/stream", { method:"POST", body:{prompt} });
 *   if (!r.ok) toast(r.error.message);
 *   else {
 *     cancelRef.current = r.cancel; // useRef for Stop button
 *     let full = "";
 *     for await (const chunk of r.stream) {
 *       full += chunk;
 *       setMessage(full); // buffer updates in real app to avoid rerender per token
 *     }
 *   }
 */
export async function requestStream(
  url: string,
  options: StreamOptions = {}
): Promise<ApiStreamResult> {
  // (10.1) Resolve URL
  const finalUrl = resolveUrl(url);

  // (10.2) Headers + default SSE Accept
  const headers = new Headers(options.headers);
  applyDefaultHeaders(headers, "text/event-stream");

  // (10.3) Body
  const { body } = buildBodyAndHeaders(options, headers);

  // (10.4) Abort setup (UI cancel + unmount cancel)
  const controller = createAbortControllerWithSignals({ signal: options.signal });

  const {
    mode: streamMode = "auto",
    idleTimeoutMs,
    onOpen,
    ...fetchOptions
  } = options;

  try {
    // (10.5) fetch
    const res = await fetch(finalUrl, {
      ...fetchOptions,
      headers,
      body,
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") ?? "";
    onOpen?.({ status: res.status, contentType });

    // (10.6) If HTTP error, read body safely and return ok:false
    if (!res.ok) {
      const text = await safeReadText(res);
      const parsed = parseMaybeJson(text);
      const serverMessage = extractServerMessage(parsed);

      return {
        ok: false,
        error: {
          status: res.status,
          message: serverMessage ?? userSafeMessage(res.status),
          details: parsed ?? text,
        },
      };
    }

    // (10.7) Fix C: 204 or missing body => ok:true with empty iterator
    if (res.status === 204 || !res.body) {
      async function* empty() {}
      return {
        ok: true,
        status: res.status,
        contentType,
        stream: empty(),
        cancel: () => controller.abort(),
      };
    }

    // (10.8) Decide mode
    const mode: StreamMode =
      streamMode && streamMode !== "auto"
        ? streamMode
        : contentType.includes("text/event-stream")
          ? "sse"
          : "text";

    // (10.9) Optional idle timeout
    // If idleTimeoutMs is set, abort if no chunks arrive within that time.
    let idleTimer: number | undefined;
    const idleMs = idleTimeoutMs;

    const resetIdle = () => {
      if (!idleMs || idleMs <= 0) return;
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => controller.abort(), idleMs);
    };

    // Start idle timer immediately after open (optional).
    resetIdle();

    const reader = res.body.getReader();

    // Wrap iterator so we can clear idle timer at the end.
    const baseIterator =
      mode === "sse" ? sseIterator(reader, resetIdle) : textIterator(reader, resetIdle);

    async function* wrapped() {
      try {
        for await (const chunk of baseIterator) yield chunk;
      } finally {
        if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      }
    }

    // (10.10) Return iterator directly (Fix B)
    return {
      ok: true,
      status: res.status,
      contentType,
      stream: wrapped(),
      cancel: () => controller.abort(),
    };
  } catch (e) {
    return {
      ok: false,
      error: {
        status: 0,
        message: isAbortError(e) ? "Request cancelled." : userSafeMessage(0),
        details: e,
      },
    };
  }
}

/* ============================================================================
(11) QUICK CONSUMPTION GUIDE (mental steps)
============================================================================
Non-streaming (JSON):
  1) const r = await request<T>("/api/thing", { method:"GET" })
  2) if (!r.ok) show r.error.message
  3) else use r.data

Streaming (SSE):
  1) const r = await requestStream("/api/chat/stream", { method:"POST", body:{prompt} })
  2) if (!r.ok) show r.error.message
  3) else for await (const chunk of r.stream) { append chunk }
  4) call r.cancel() to stop
============================================================================ */
