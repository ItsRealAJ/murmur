import { cn } from "../lib/utils";

/**
 * Murmur's signature element.
 *
 * Every dictation ends at a blinking text cursor in somebody else's window, so
 * the pill carries one of its own. It states what the app does in a single
 * element, and it is the only place the interface spends any boldness.
 *
 * The caret reads the pipeline rather than decorating it:
 *
 *   idle       slow blink   — waiting, like any unfocused caret
 *   recording  solid ember  — receiving; a blink here would fight the waveform
 *   processing slow pulse   — thinking, not dead
 *   unavailable dimmed still
 *
 * Colour is the only saturated moment in the whole interface (see docs/DESIGN.md):
 * everything else sits close to its ground, and this lifts when Murmur hears you.
 */
export type PillCaretState = "idle" | "recording" | "processing" | "unavailable";

export function PillCaret({
  state,
  compact = false,
  className,
}: {
  state: PillCaretState;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-caret-state={state}
      className={cn("murmur-caret", className)}
      style={{ height: compact ? 12 : 15 }}
    />
  );
}
