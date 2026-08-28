// Murmur's agent mark: the caret with a spark, drawn filled. Same family as the
// dictation mark (quiet bars running into a flat-ended caret) so agent mode
// reads as the same product in a different mood, not a different app.
export const AGENT_MODE_PATH =
  "M15.4 5.2C15.4 4.87 15.67 4.6 16 4.6C16.33 4.6 16.6 4.87 16.6 5.2V16.8C16.6 17.13 16.33 17.4 16 17.4C15.67 17.4 15.4 17.13 15.4 16.8V5.2Z" +
  "M11.2 8.4C11.2 8.07 11.47 7.8 11.8 7.8C12.13 7.8 12.4 8.07 12.4 8.4V13.6C12.4 13.93 12.13 14.2 11.8 14.2C11.47 14.2 11.2 13.93 11.2 13.6V8.4Z" +
  "M7 9.6C7 9.27 7.27 9 7.6 9C7.93 9 8.2 9.27 8.2 9.6V12.4C8.2 12.73 7.93 13 7.6 13C7.27 13 7 12.73 7 12.4V9.6Z" +
  "M4.9 2.6L5.44 4.36L7.2 4.9L5.44 5.44L4.9 7.2L4.36 5.44L2.6 4.9L4.36 4.36L4.9 2.6Z";

type CubicCurve = readonly [number, number, number, number, number, number];

interface CubicPath {
  start: readonly [number, number];
  curves: readonly CubicCurve[];
  closed?: boolean;
}

interface MorphPair {
  from: CubicPath;
  to: CubicPath;
}

/**
 * The dictation identity: three quiet amplitude bars running into a caret,
 * matching src/assets/logo.svg. Drawn as stroked verticals in a 24x24 box.
 *
 * `shell` carries the caret rather than an enclosing ring — Murmur's mark has
 * no container, and reusing the slot keeps the existing four-element morph.
 */
const CARET_RESTING: CubicPath = {
  // Drawn a unit longer at each end than the round-capped bars would need: the
  // caret uses a butt cap, which stops dead at the endpoint instead of
  // overhanging by half the stroke width.
  start: [17.3, 4.9],
  curves: [[17.3, 9.6, 17.3, 14.4, 17.3, 19.1]],
};

/** In agent mode the caret shortens and lifts, making room for the spark. */
const CARET_AGENT: CubicPath = {
  start: [16, 6.4],
  curves: [[16, 10.2, 16, 14, 16, 17.8]],
};

const MORPH_PATHS = {
  shell: { from: CARET_RESTING, to: CARET_AGENT },
  // The three amplitude bars: uneven on purpose. A symmetric equaliser is the
  // generic "audio" glyph; unevenness is what reads as a real, quiet signal.
  leftBar: {
    from: { start: [6.7, 10.2], curves: [[6.7, 11.4, 6.7, 12.6, 6.7, 13.8]] },
    to: { start: [7.6, 9.6], curves: [[7.6, 10.5, 7.6, 11.5, 7.6, 12.4]] },
  },
  centerBar: {
    from: { start: [10.2, 8.9], curves: [[10.2, 10.9, 10.2, 13.1, 10.2, 15.1]] },
    to: { start: [11.8, 8.4], curves: [[11.8, 10.1, 11.8, 11.9, 11.8, 13.6]] },
  },
  rightBar: {
    from: { start: [13.8, 9.8], curves: [[13.8, 10.9, 13.8, 13.1, 13.8, 14.2]] },
    // Collapses to a point: agent mode shows three elements, not four.
    to: { start: [11.8, 11], curves: [[11.8, 11, 11.8, 11, 11.8, 11]] },
  },
  // Only visible mid-morph and in agent mode — the spark that marks the assistant.
  sparkCross: {
    from: { start: [6.7, 12], curves: [[6.7, 12, 6.7, 12, 6.7, 12]] },
    to: { start: [4.9, 3.2], curves: [[4.9, 4.3, 4.9, 5.5, 4.9, 6.6]] },
  },
} satisfies Record<string, MorphPair>;

export const VOICE_IDENTITY_MORPH_DURATION_MS = 480;

const interpolate = (from: number, to: number, progress: number) => from + (to - from) * progress;

const format = (value: number) => Number(value.toFixed(3));

const interpolatePath = ({ from, to }: MorphPair, progress: number) => {
  const startX = format(interpolate(from.start[0], to.start[0], progress));
  const startY = format(interpolate(from.start[1], to.start[1], progress));
  const curves = from.curves.map((curve, curveIndex) => {
    const target = to.curves[curveIndex];
    const values = curve.map((value, valueIndex) =>
      format(interpolate(value, target[valueIndex], progress))
    );
    return `C${values.join(" ")}`;
  });
  return `M${startX} ${startY}${curves.join("")}${from.closed ? "Z" : ""}`;
};

const smoothRange = (progress: number, start: number, end: number) => {
  const normalized = Math.min(1, Math.max(0, (progress - start) / (end - start)));
  return normalized * normalized * (3 - 2 * normalized);
};

export const resolveVoiceIdentityMorphPaths = (progress: number) => {
  const boundedProgress = Math.min(1, Math.max(0, progress));
  return {
    shell: interpolatePath(MORPH_PATHS.shell, boundedProgress),
    leftBar: interpolatePath(MORPH_PATHS.leftBar, boundedProgress),
    centerBar: interpolatePath(MORPH_PATHS.centerBar, boundedProgress),
    rightBar: interpolatePath(MORPH_PATHS.rightBar, boundedProgress),
    sparkCross: interpolatePath(MORPH_PATHS.sparkCross, boundedProgress),
    constructionOpacity: 1 - smoothRange(boundedProgress, 0.7, 0.96),
    sparkOpacity:
      smoothRange(boundedProgress, 0.2, 0.48) * (1 - smoothRange(boundedProgress, 0.72, 0.96)),
    agentOpacity: smoothRange(boundedProgress, 0.58, 0.94),
  };
};
