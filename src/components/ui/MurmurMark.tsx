/**
 * The Murmur mark, in one place.
 *
 * Three short bars of uneven height (a murmur — low amplitude) running into a
 * tall flat-ended bar (the caret the words land in). The shape difference
 * between round caps and flat ends is what makes the last bar read as a text
 * cursor rather than just the loudest one, and it is the only element that
 * takes the accent colour.
 *
 * Mirrors `src/assets/logo.svg`; change both together.
 */
export function MurmurMark({
  size = 48,
  className,
  /** Draw on a tile (app-icon style) rather than transparent (inline use). */
  tile = false,
  /** Ignore the accent and draw everything in currentColor, for monochrome contexts. */
  monochrome = false,
}: {
  size?: number;
  className?: string;
  tile?: boolean;
  monochrome?: boolean;
}) {
  const quiet = monochrome ? "currentColor" : "var(--color-muted-foreground)";
  const caret = monochrome ? "currentColor" : "var(--color-primary)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {tile && <rect width="1024" height="1024" rx="228" fill="var(--color-background)" />}
      <g fill={quiet} opacity={monochrome ? 0.55 : 1}>
        <rect x="241" y="437" width="92" height="150" rx="46" />
        <rect x="391" y="382" width="92" height="260" rx="46" />
        <rect x="541" y="417" width="92" height="190" rx="46" />
      </g>
      <rect x="691" y="252" width="92" height="520" rx="14" fill={caret} />
    </svg>
  );
}
