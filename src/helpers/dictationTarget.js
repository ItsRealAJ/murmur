/**
 * Which app the current dictation is going to land in.
 *
 * Captured once when recording starts (see `capture-dictation-target`), because
 * by the time cleanup runs Murmur's own overlay may be the frontmost window.
 * Held here rather than threaded through AudioManager -> ReasoningService ->
 * prompt builder, all of which would otherwise need a parameter they do not
 * otherwise care about.
 *
 * Renderer-only, and only ever one dictation is in flight at a time.
 */

let targetAppId = null;

/** @param {string|null} appId bundle id (macOS) or executable name (Windows) */
export function setTargetAppId(appId) {
  targetAppId = typeof appId === "string" && appId.trim() ? appId.trim() : null;
}

/** @returns {string|null} */
export function getTargetAppId() {
  return targetAppId;
}

/** Clear between dictations so one recording never inherits the previous target. */
export function clearTargetAppId() {
  targetAppId = null;
}
