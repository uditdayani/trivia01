/** Fire-and-forget analytics from the browser. Failures are ignored on purpose. */
export function track(
  name: "puzzle_view" | "game_start" | "game_finish" | "result_copy",
  pack: string,
  date: string,
  props: Record<string, unknown> = {},
) {
  try {
    const body = JSON.stringify({ name, pack, date, props });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/event", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  } catch {
    // analytics must never break the game
  }
}
