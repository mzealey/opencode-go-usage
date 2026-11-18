/**
 * Fetch and normalise OpenCode Go allowance usage.
 *
 * Endpoint:  GET https://opencode.ai/zen/go/v1/usage
 * Auth:      Authorization: Bearer <opencode-go api key>
 * Response:  {
 *              "usage": {
 *                "rolling": { "status": "ok", "percent": 4,  "resetsAt": "2026-11-18T11:51:02.000Z" },
 *                "weekly":  { "status": "ok", "percent": 12, "resetsAt": "2026-11-23T00:00:00.000Z" },
 *                "monthly": { "status": "ok", "percent": 77, "resetsAt": "2026-11-21T18:06:01.000Z" }
 *              }
 *            }
 *
 * The endpoint is undocumented in the public docs but is the one the Console Go
 * page uses. It needs no scope beyond the Go API key and answers in a few ms.
 *
 * The plan enforces three windows:
 *   rolling = the 5-hour window (20% of the monthly allowance)
 *   weekly  = 50% of the monthly allowance, resets Monday 00:00 UTC
 *   monthly = the billing period
 * There is no 24-hour window, so `today` is derived by the server part from
 * the monthly counter (see `index.ts`).
 */

export const USAGE_URL = "https://opencode.ai/zen/go/v1/usage"

export type WindowID = "rolling" | "today" | "weekly" | "monthly"

export interface UsageWindow {
  /** Raw key from the API, or `today` for the derived window. */
  id: WindowID
  /** Short label for a narrow sidebar. */
  label: string
  /** 0-100 (may exceed 100 with Extra Usage on). */
  percent: number
  /**
   * `ok`, `limit_reached`, … — passed through for the API windows. The derived
   * `today` window uses `ok` for a measured value and `floor` for a lower bound.
   */
  status: string
  /** ISO timestamp of the next reset, when the API reports one. */
  resetsAt?: string
}

export interface UsageSnapshot {
  ok: boolean
  /** Milliseconds since the epoch, local clock, when the fetch finished. */
  fetchedAt: number
  windows: UsageWindow[]
  /** Human readable failure, present only when `ok` is false. */
  error?: string
}

interface RawWindow {
  status?: unknown
  percent?: unknown
  resetsAt?: unknown
}

const WINDOW_ORDER: readonly { id: Exclude<WindowID, "today">; label: string }[] = [
  { id: "rolling", label: "5h" },
  { id: "weekly", label: "wk" },
  { id: "monthly", label: "mo" },
]

function messageOf(body: unknown): string | undefined {
  const error = (body as { error?: unknown } | undefined)?.error
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const detail = error as { message?: unknown; type?: unknown; code?: unknown }
    if (typeof detail.message === "string") return detail.message
    if (typeof detail.type === "string") return detail.type
    if (typeof detail.code === "string") return detail.code
  }
  return undefined
}

/** Turn the raw JSON body into a snapshot. Never throws. */
export function parseUsage(body: unknown, now = Date.now()): UsageSnapshot {
  const usage = (body as { usage?: Record<string, RawWindow> } | undefined)?.usage
  if (!usage || typeof usage !== "object") {
    return {
      ok: false,
      fetchedAt: now,
      windows: [],
      error: messageOf(body) ?? "unexpected response from the usage endpoint",
    }
  }

  const windows: UsageWindow[] = []
  for (const { id, label } of WINDOW_ORDER) {
    const raw = usage[id]
    if (!raw) continue
    const percent = Number(raw.percent)
    windows.push({
      id,
      label,
      percent: Number.isFinite(percent) ? percent : 0,
      status: typeof raw.status === "string" ? raw.status : "unknown",
      ...(typeof raw.resetsAt === "string" ? { resetsAt: raw.resetsAt } : {}),
    })
  }

  if (windows.length === 0) {
    return { ok: false, fetchedAt: now, windows: [], error: "usage response had no windows" }
  }
  return { ok: true, fetchedAt: now, windows }
}

export interface FetchUsageOptions {
  signal?: AbortSignal
  /** Override for tests / self-hosted mirrors. Defaults to the public endpoint. */
  baseUrl?: string
  /** Sent so OpenCode can identify the client. */
  userAgent?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export async function fetchUsage(
  apiKey: string,
  options: FetchUsageOptions = {},
): Promise<UsageSnapshot> {
  const {
    signal,
    baseUrl = USAGE_URL,
    userAgent = "opencode-go-usage/0.1.0",
    fetchImpl = globalThis.fetch,
    timeoutMs = 15_000,
  } = options

  const timeout = AbortSignal.timeout(timeoutMs)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  try {
    const response = await fetchImpl(baseUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
        "user-agent": userAgent,
      },
      signal: combined,
    })

    const text = await response.text()
    let body: unknown
    try {
      body = text ? JSON.parse(text) : {}
    } catch {
      body = { error: `non-JSON response (HTTP ${response.status})` }
    }

    if (!response.ok) {
      const reason = messageOf(body) ?? `HTTP ${response.status}`
      return {
        ok: false,
        fetchedAt: Date.now(),
        windows: [],
        error: response.status === 401 ? `key rejected (401): ${reason}` : reason,
      }
    }
    return parseUsage(body)
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.name === "TimeoutError" || error.name === "AbortError"
          ? "usage request timed out"
          : error.message
        : String(error)
    return { ok: false, fetchedAt: Date.now(), windows: [], error: reason }
  }
}

/**
 * Best effort human message for a thrown value. RPC failures arrive as plain
 * objects (`{ type, message, data }`), not Errors, so `String(error)` would
 * print `[object Object]`.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const detail = error as { message?: unknown; type?: unknown }
    if (typeof detail.message === "string" && detail.message.length > 0) {
      return typeof detail.type === "string" && detail.type.length > 0
        ? `${detail.type}: ${detail.message}`
        : detail.message
    }
    if (typeof detail.type === "string" && detail.type.length > 0) return detail.type
    try {
      return JSON.stringify(error) ?? String(error)
    } catch {
      return String(error)
    }
  }
  return String(error)
}
