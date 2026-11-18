# opencode-go-usage

OpenCode Go allowance in the OpenCode TUI sidebar: today's consumption, the
5-hour window, the week and the billing period, refreshed every five minutes.

```
▾ OpenCode Go Usage 2m
today              12%
─────────────────────────
5h   █░░░░░░░░░   5% 1h02m
wk   █░░░░░░░░░  12% 4d13h
mo   ████████░░  77% 3d07h
```

Click the header to collapse it to one line, the same way the Context and MCP
headers behave; the collapsed state is remembered. The right-hand column of the
three bars is the time until that window resets. Bars turn amber at 80% and red
at 100%. Percentages are whole numbers, the resolution the endpoint reports.

## Install

OpenCode installs plugins straight from Git — no clone needed. Pick whichever
suits you:

```sh
# tracks the default branch, pinned to the installed commit
opencode plugin add github:mzealey/opencode-go-usage

# a branch, tag or commit
opencode plugin add 'github:mzealey/opencode-go-usage#main'
opencode plugin add 'git+ssh://git@github.com/mzealey/opencode-go-usage.git#<sha>'
```

`opencode plugin update` re-checks unpinned Git plugins; exact commits stay
pinned. Or write the entry yourself in `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "plugins": ["github:mzealey/opencode-go-usage"],
}
```

For development, point at the checkout instead — edits then reload with the
config watcher, no push required:

```jsonc
{
  "plugins": ["/absolute/path/to/opencode-go-usage"],
}
```

Only configure one of the two: loading both gives `Duplicate plugin ID:
go-usage`. Note `opencode plugin add` rewrites `opencode.jsonc` and drops
comments from the file.

```sh
git clone https://github.com/mzealey/opencode-go-usage
cd opencode-go-usage && bun install
```

Config reloads on save (`/reload` forces it). The sidebar appears in the
session view; the usual sidebar toggle shows it.

Commands, in the palette under **OpenCode Go**:

- `Refresh OpenCode Go usage` — also `/go-usage` (or `/gou`), toasts the numbers.
- `Collapse or expand Go usage` — the keyboard equivalent of clicking the header.

## Options

```jsonc
{
  "plugins": [
    {
      "package": "/absolute/path/to/opencode-go-usage",
      "options": {
        "refreshMinutes": 5, // poll interval, minimum 30s
        "cacheSeconds": 60, // server-side cache shared by every TUI
      },
    },
  ],
}
```

## The key

Nothing is configured by hand. The server part reads the active `opencode-go`
credential from OpenCode's credential store through the plugin SDK:

```ts
const connection = await ctx.integration.connection.active("opencode-go")
const credential = await ctx.integration.connection.resolve(connection)
```

so it follows `/connect` → OpenCode Go and `/credential` switches, and the key
never reaches the TUI part. If no key is connected the panel says so instead of
failing.

**The API key needs the `usage: read` aspect.** Create or edit the key in the
[Console](https://opencode.ai/console/account#api-keys) with `usage: read`
enabled alongside whatever the model calls need. A key minted without it still
runs inference but is rejected by the usage endpoint with `401`, which the panel
shows verbatim.

## How it gets the numbers

`GET https://opencode.ai/zen/go/v1/usage` with `Authorization: Bearer <key>`:

```json
{
  "usage": {
    "rolling": { "status": "ok", "percent": 4, "resetsAt": "2026-11-18T11:51:02.000Z" },
    "weekly": { "status": "ok", "percent": 12, "resetsAt": "2026-11-23T00:00:00.000Z" },
    "monthly": { "status": "ok", "percent": 77, "resetsAt": "2026-11-21T18:06:01.000Z" }
  }
}
```

That is the endpoint the Console Go page uses. It is not in the public API docs,
it reports **whole percentages**, and it needs no scope beyond the key.

Each window's percent is against **that window's own allowance**, which the Go
plan defines as a fraction of the monthly one: 5-hour = 20%, weekly = 50%,
monthly = 100%. A 5% reading on the 5-hour bar is therefore 1% of the month.

- `rolling` is the 5-hour window.
- `weekly` resets Monday 00:00 UTC.
- `monthly` is the billing period.

`today` is derived, not fetched:

- With a reading from before midnight, it is the monthly delta since then —
  measured, and only as precise as the whole percent the API reports.
- Otherwise it is a lower bound: the 5-hour window when it opened after midnight
  (converted to the monthly scale — everything in such a window is today's), or
  the delta since the first reading today, whichever is larger. It renders as
  `≥ 1%`, and the line is dropped entirely when that bound is zero, rather than
  claiming 0%. It is rounded to whole percents like everything else, so a bound
  of 2.4 reads as 2%.

`today` is shown on the monthly scale; the three bars keep the per-window scale
the Console uses, so they compare directly with the Console's own gauges.

### Nothing reports spend past the subscription

There is no `over` line for the money spent past the Go allowance, because
there is no API for it:

- `/zen/go/v1/usage` has no spend or overage field, and no `/spend`, `/billing`,
  `/credits`, `/balance` or `/usage/daily` sibling exists.
- The Console API documentation covers inference and providers only.
- OpenCode's own `/api/experimental/usage/limits` carries fractional percents
  but returns `null` unless the location is signed in to a Console workspace,
  and even then it has no spend figure.
- The only dollars the key sees are per response: `usage.opencode.allowance`
  (what the request counted against the plan) and `list_cost` / `cost`.

Re-deriving it from `opencode.allowance` would need the server part to tee
every inference response, would only see this machine since the plugin loaded,
and would still need the plan's dollar limit to locate 100%. Not attempted —
see the checklist below if an endpoint ever appears.

## Watching for new endpoints

Re-check these whenever Console ships API changes. Last checked 2026-11-18
against both a `usage: read` key and a full-access key — same answers.

- [ ] **USD overspend** — no source at all today, so the panel says nothing
      about it. If `/zen/go/v1/usage` (or any sibling) grows a field for money
      spent past the plan, add it to `UsageSnapshot` in `src/usage.ts` and render
      it under the bars, gated on a non-zero amount.
- [ ] **Today's usage or spend** — no daily window exists, so `src/today.ts`
      reconstructs it (measured monthly delta, else a monthly-scaled floor from
      the 5-hour window). A real per-day series would replace that file's
      heuristics wholesale, and would also fix the ±1 point rounding.
- [ ] **Fractional percents** — `percent` is a whole number per window, which is
      why the panel does not show decimals. If it gains them, `PERCENT_WIDTH` in
      `src/tui.tsx` grows and `today` gets precise for free.
- [ ] **Absolute money in the usage response** — if per-window dollar amounts
      appear, compute every percentage from those rather than differencing
      rounded integers, as the README section above notes.
- [ ] **`/api/experimental/usage/limits` with data** — returns
      `UsageLimits.Go` with fractional percents, but only when the location is
      signed in to a Console workspace (`null` here, and `opencode auth list`
      has no Console account). Worth preferring if a Console sign-in lands in
      the TUI.

How to re-check:

```bash
KEY=<a opencode-go key>
curl -s https://opencode.ai/zen/go/v1/usage -H "Authorization: Bearer $KEY"
for p in spend billing credits balance invoice usage/daily; do
  printf '%-14s %s\n' "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' https://opencode.ai/zen/go/v1/$p -H "Authorization: Bearer $KEY")"
done
opencode api get /api/experimental/usage/limits
```

A real figure would need the server part to sum `opencode.allowance` from every
inference response (`session.hook("http.response")`), which only covers this
machine since the plugin loaded, and then still needs the plan's dollar limit to
locate 100%. Not wired up.


## Layout notes

The bars are `█`/`░` glyphs in fixed-width `<text>` runs rather than background
colours: OpenTUI 0.8.4 drops `fg`/`bg` on `<span>`, and space-only runs collapse,
which made the rows drift.

## Development

```
bun install
bunx tsc --noEmit          # typecheck
bun run build:tui          # regenerate the committed dist/ after editing the TUI
bun run check:dist         # verify the generated TUI is current
bun scripts/usage.ts       # hit the endpoint with the active local credential
```

`scripts/usage.ts` reads the credential straight out of
`~/.local/share/opencode/opencode.db` for convenience; the plugin itself always
goes through the SDK.
