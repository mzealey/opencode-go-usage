import { createComponent as _$createComponent } from "opentui:runtime-module:%40opentui%2Fsolid";
import { memo as _$memo } from "opentui:runtime-module:%40opentui%2Fsolid";
import { effect as _$effect } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createTextNode as _$createTextNode } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement } from "opentui:runtime-module:%40opentui%2Fsolid";
/**
 * TUI part: OpenCode Go allowance inside the right-hand sidebar.
 *
 * Polling belongs to the mounted panel, not to setup: a plugin reload disposes
 * setup's timers while the host can keep the last rendered panel on screen, and
 * the panel then sits there frozen. A component that owns its own timer keeps
 * updating for as long as it is actually on screen.
 */
import { Plugin, usePlugin } from "opentui:runtime-module:%40opencode%2Fplugin%2Ftui";
import { For, Show, createSignal, onCleanup, onMount } from "opentui:runtime-module:solid-js";
import { GoUsage } from "./rpc.ts";
import { errorMessage } from "./usage.ts";
const [state, setState] = createSignal({
  loading: true
});
/** Re-rendered every 30s so the age and reset countdowns stay honest. */
const [tick, setTick] = createSignal(Date.now());

/** After a failure, try again sooner than the normal interval. */
const RETRY_MS = 30_000;
const BAR_CELLS = 10;
const LABEL_WIDTH = 4;
/** Digits only: the API reports whole percents, so "100" is the widest. */
const PERCENT_WIDTH = 3;
const RESET_WIDTH = 5;
/** label + bar + "≥100%" + space + countdown. */
const VALUE_COLUMN = LABEL_WIDTH + BAR_CELLS;
const LINE_WIDTH = VALUE_COLUMN + 1 + PERCENT_WIDTH + 1 + 1 + RESET_WIDTH;
function colorFor(window, theme) {
  if (window.percent >= 100) return theme.text.feedback.error.base;
  if (window.percent >= 80) return theme.text.feedback.warning.base;
  return theme.text.base;
}

/**
 * Whole percents, matching what the endpoint reports. `prefix` is the whole
 * first column, so a `≥` lower bound lines up with the plain values instead of
 * pushing the row out.
 */
function percentField(value, prefix = " ") {
  return `${prefix}${String(Math.round(value)).padStart(PERCENT_WIDTH)}%`;
}
function cells(percent) {
  return Math.max(0, Math.min(BAR_CELLS, Math.round(percent / 100 * BAR_CELLS)));
}

/** "1h02m" / "4d13h" / "now" — compact enough for a sidebar. */
function countdown(resetsAt, now) {
  if (!resetsAt) return "";
  const target = Date.parse(resetsAt);
  if (!Number.isFinite(target)) return "";
  const remaining = target - now;
  if (remaining <= 0) return "now";
  const minutes = Math.floor(remaining / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d${String(hours % 24).padStart(2, "0")}h`;
  if (hours > 0) return `${hours}h${String(minutes % 60).padStart(2, "0")}m`;
  return `${minutes}m`;
}
function age(fetchedAt, now) {
  const seconds = Math.max(0, Math.round((now - fetchedAt) / 1000));
  if (seconds < 45) return "";
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 60)}h`;
}

/** `today` is a number only — the API has no daily window — so it gets no bar. */
function Today(props) {
  const context = usePlugin();
  const theme = () => context.theme;
  const floor = () => props.window.status === "floor";
  return (() => {
    var _el$ = _$createElement("box"),
      _el$2 = _$createElement("text"),
      _el$4 = _$createElement("text");
    _$insertNode(_el$, _el$2);
    _$insertNode(_el$, _el$4);
    _$setProp(_el$, "flexDirection", "row");
    _$insertNode(_el$2, _$createTextNode(`today         `));
    _$insert(_el$4, () => percentField(props.window.percent, floor() ? "≥" : " "));
    _$effect(_p$ => {
      var _v$ = theme().text.muted,
        _v$2 = floor() ? theme().text.faint : colorFor(props.window, theme());
      _v$ !== _p$.e && (_p$.e = _$setProp(_el$2, "fg", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp(_el$4, "fg", _v$2, _p$.t));
      return _p$;
    }, {
      e: undefined,
      t: undefined
    });
    return _el$;
  })();
}
function Row(props) {
  const context = usePlugin();
  const theme = () => context.theme;
  const filled = () => cells(props.window.percent);
  const reset = () => countdown(props.window.resetsAt, tick());

  // Fixed-width <text> runs: the bar glyphs carry the value, so rows stay
  // aligned in any terminal font. The bar is one run — a zero-width run for an
  // empty half collapses and shifts the row.
  const bar = () => "█".repeat(filled()) + "░".repeat(BAR_CELLS - filled());
  return (() => {
    var _el$5 = _$createElement("box"),
      _el$6 = _$createElement("text"),
      _el$7 = _$createElement("text"),
      _el$8 = _$createElement("text"),
      _el$9 = _$createElement("text");
    _$insertNode(_el$5, _el$6);
    _$insertNode(_el$5, _el$7);
    _$insertNode(_el$5, _el$8);
    _$insertNode(_el$5, _el$9);
    _$setProp(_el$5, "flexDirection", "row");
    _$insert(_el$6, () => props.window.label.padEnd(LABEL_WIDTH));
    _$insert(_el$7, bar);
    _$insert(_el$8, () => percentField(props.window.percent));
    _$insert(_el$9, () => ` ${reset().padStart(RESET_WIDTH)}`);
    _$effect(_p$ => {
      var _v$3 = theme().text.muted,
        _v$4 = colorFor(props.window, theme()),
        _v$5 = colorFor(props.window, theme()),
        _v$6 = theme().text.faint;
      _v$3 !== _p$.e && (_p$.e = _$setProp(_el$6, "fg", _v$3, _p$.e));
      _v$4 !== _p$.t && (_p$.t = _$setProp(_el$7, "fg", _v$4, _p$.t));
      _v$5 !== _p$.a && (_p$.a = _$setProp(_el$8, "fg", _v$5, _p$.a));
      _v$6 !== _p$.o && (_p$.o = _$setProp(_el$9, "fg", _v$6, _p$.o));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined
    });
    return _el$5;
  })();
}
function Panel(props) {
  const context = usePlugin();
  const snapshot = () => state().snapshot;
  const error = () => state().error ?? (snapshot()?.ok === false ? snapshot()?.error : undefined);
  const today = () => snapshot()?.windows.find(item => item.id === "today");
  const rest = () => snapshot()?.windows.filter(item => item.id !== "today") ?? [];
  const fresh = () => snapshot() ? age(snapshot().fetchedAt, tick()) : "";
  onMount(() => {
    let stopped = false;
    let timer;
    const tick = () => setTick(Date.now());
    const clock = setInterval(tick, 30_000);
    const run = async () => {
      const ok = await props.poll(false);
      if (stopped) return;
      timer = setTimeout(run, ok ? props.intervalMs : RETRY_MS);
    };
    void run();
    onCleanup(() => {
      stopped = true;
      clearInterval(clock);
      if (timer !== undefined) clearTimeout(timer);
    });
  });
  return (() => {
    var _el$0 = _$createElement("box"),
      _el$1 = _$createElement("box"),
      _el$10 = _$createElement("text"),
      _el$11 = _$createElement("text"),
      _el$13 = _$createElement("text");
    _$insertNode(_el$0, _el$1);
    _$setProp(_el$0, "flexDirection", "column");
    _$insertNode(_el$1, _el$10);
    _$insertNode(_el$1, _el$11);
    _$insertNode(_el$1, _el$13);
    _$setProp(_el$1, "flexDirection", "row");
    _$insert(_el$10, () => props.collapsed ? "▸ " : "▾ ");
    _$insertNode(_el$11, _$createTextNode(`OpenCode Go Usage`));
    _$insert(_el$13, (() => {
      var _c$ = _$memo(() => !!fresh());
      return () => _c$() ? ` ${fresh()}` : "";
    })());
    _$insert(_el$0, _$createComponent(Show, {
      get when() {
        return !props.collapsed;
      },
      get children() {
        return [_$createComponent(Show, {
          get when() {
            return snapshot()?.ok;
          },
          get children() {
            return [_$memo(() => _$memo(() => today() === undefined)() ? null : _$createComponent(Today, {
              get window() {
                return today();
              }
            })), (() => {
              var _el$14 = _$createElement("text");
              _$insertNode(_el$14, _$createTextNode(`─────────────────────────`));
              _$effect(_$p => _$setProp(_el$14, "fg", context.theme.text.faint, _$p));
              return _el$14;
            })(), _$createComponent(For, {
              get each() {
                return rest();
              },
              children: item => _$createComponent(Row, {
                window: item
              })
            })];
          }
        }), _$createComponent(Show, {
          get when() {
            return error();
          },
          get children() {
            var _el$16 = _$createElement("text");
            _$insert(_el$16, error);
            _$effect(_$p => _$setProp(_el$16, "fg", context.theme.text.feedback.error.base, _$p));
            return _el$16;
          }
        }), _$createComponent(Show, {
          get when() {
            return snapshot()?.windows.some(window => window.status === "limit_reached");
          },
          get children() {
            var _el$17 = _$createElement("text");
            _$insertNode(_el$17, _$createTextNode(`limit reached`));
            _$effect(_$p => _$setProp(_el$17, "fg", context.theme.text.feedback.warning.base, _$p));
            return _el$17;
          }
        })];
      }
    }), null);
    _$effect(_p$ => {
      var _v$7 = props.onToggle,
        _v$8 = context.theme.text.muted,
        _v$9 = context.theme.text.base,
        _v$0 = context.theme.text.faint;
      _v$7 !== _p$.e && (_p$.e = _$setProp(_el$1, "onMouseDown", _v$7, _p$.e));
      _v$8 !== _p$.t && (_p$.t = _$setProp(_el$10, "fg", _v$8, _p$.t));
      _v$9 !== _p$.a && (_p$.a = _$setProp(_el$11, "fg", _v$9, _p$.a));
      _v$0 !== _p$.o && (_p$.o = _$setProp(_el$13, "fg", _v$0, _p$.o));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined
    });
    return _el$0;
  })();
}
export default Plugin.define({
  id: "go-usage.tui",
  setup(context) {
    const configured = Number(context.options.refreshMinutes ?? 5);
    const minutes = Number.isFinite(configured) && configured > 0 ? configured : 5;
    const intervalMs = Math.max(30, minutes) * 60_000;
    const [ui, updateUI] = context.storage.store("panel", {
      initial: {
        collapsed: false
      }
    });
    const toggle = () => void updateUI(draft => {
      draft.collapsed = !draft.collapsed;
    });
    let disposed = false;

    /** Reads the live client each call: it changes after a server restart. */
    async function poll(force) {
      try {
        const client = context.client.rpc(GoUsage);
        // JSON Schema methods are typed `unknown`; the server part is the only writer.
        const result = force ? await client.refresh({}) : await client.usage({});
        if (disposed) return false;
        setState({
          loading: false,
          snapshot: result,
          error: result.ok ? undefined : result.error
        });
        return true;
      } catch (error) {
        if (disposed) return false;
        setState(previous => ({
          ...previous,
          loading: false,
          error: errorMessage(error)
        }));
        return false;
      }
    }
    context.keymap.layer(() => ({
      mode: "global",
      commands: [{
        id: "go-usage.refresh",
        title: "Refresh OpenCode Go usage",
        group: "OpenCode Go",
        palette: true,
        slash: {
          name: "go-usage",
          aliases: ["gou"]
        },
        run: async () => {
          const ok = await poll(true);
          const current = state();
          const summary = !ok ? error() ?? "usage unavailable" : current.snapshot?.ok ? current.snapshot.windows.map(window => `${window.label} ${Math.round(window.percent)}%`).join(" · ") : current.snapshot?.error ?? "usage unavailable";
          context.ui.toast.show({
            title: "OpenCode Go",
            message: summary,
            variant: ok && current.snapshot?.ok ? "info" : "error"
          });
        }
      }, {
        id: "go-usage.toggle",
        title: "Collapse or expand Go usage",
        group: "OpenCode Go",
        palette: true,
        run: () => toggle()
      }]
    }));
    function error() {
      return state().error ?? (state().snapshot?.ok === false ? state().snapshot?.error : undefined);
    }

    // Belt and braces: the mounted panel owns its own timer, and this one keeps
    // the shared state fresh even if the host leaves the panel unmounted (a
    // sidebar that is closed, or a stale render from before a reload). The
    // server caches for a minute, so the extra call is free.
    const fallback = setInterval(() => void poll(false), intervalMs);
    context.ui.slot({
      append: "sidebar.content",
      render: () => _$createComponent(Panel, {
        get collapsed() {
          return ui.collapsed;
        },
        onToggle: toggle,
        poll: poll,
        intervalMs: intervalMs
      })
    });
    return () => {
      disposed = true;
      clearInterval(fallback);
    };
  }
});
