/**
 * The RPC contract between the server part and the TUI part.
 *
 * The server part owns the credential (only the server can resolve an
 * integration credential), the TUI part owns the rendering.
 *
 * Both methods take an object input, even though neither reads a field: the
 * dispatcher rejects a missing `input` entirely ("Expected JSON value"), and
 * `force` is left optional so a TUI generation from before `refresh` existed —
 * which sends `{ force }` to `usage` — keeps working across a plugin reload.
 */
import { Rpc } from "@opencode/plugin/rpc"

const window = {
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    percent: { type: "number" },
    status: { type: "string" },
    resetsAt: { type: "string" },
  },
  required: ["id", "label", "percent", "status"],
} as const

const input = {
  type: "object",
  properties: {
    /** Ignored by `refresh`; accepted so older callers keep working. */
    force: { type: "boolean" },
  },
} as const

const output = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    fetchedAt: { type: "number" },
    windows: { type: "array", items: window },
    error: { type: "string" },
  },
  required: ["ok", "fetchedAt", "windows"],
} as const

export const GoUsage = Rpc.define({
  id: "go-usage",
  methods: {
    /** Cached for a minute, so several TUIs share one upstream call. */
    usage: { input, output },
    /** Bypasses the cache; used by the manual refresh command. */
    refresh: { input, output },
  },
  events: {},
})
