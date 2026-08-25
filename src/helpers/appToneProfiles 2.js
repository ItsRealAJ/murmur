/**
 * Per-app tone profiles.
 *
 * The same sentence wants different treatment depending on where it lands. A
 * Discord message should stay short and lowercase; an email wants full
 * sentences; a terminal wants what you actually said, with identifiers intact
 * and no helpful punctuation. This maps the frontmost application to a profile,
 * and the profile to an instruction appended to the cleanup prompt.
 *
 * Matching is on a stable app identity — the bundle identifier on macOS
 * (`com.tinyspeck.slackmacgap`), the executable name on Windows (`Code.exe`) —
 * lowercased, never on the window title, which changes constantly.
 */

export const TONE_PROFILES = ["default", "casual", "formal", "technical"];

/**
 * Instruction appended to the cleanup prompt. Deliberately short: it competes
 * with the base prompt for the model's attention, and a long tone essay makes
 * small local models worse, not better.
 */
export const TONE_INSTRUCTIONS = {
  default: "",
  casual:
    " This text is going into a chat message. Keep it brief and conversational. " +
    "Do not add greetings, sign-offs, or formality the speaker did not use.",
  formal:
    " This text is going into an email or document. Use complete sentences and " +
    "standard capitalisation and punctuation. Do not add greetings or sign-offs " +
    "the speaker did not say.",
  technical:
    " This text is going into a code editor or terminal. Stay close to the " +
    "literal words. Preserve identifiers, file paths, flags, and casing exactly " +
    "as spoken. Do not add punctuation that was not dictated.",
};

/**
 * Built-in mapping. Substring match against the lowercased app id, so
 * `com.microsoft.vscode` and `code.exe` both reach "technical" without needing
 * an entry per platform.
 */
const BUILT_IN = [
  // chat
  ["discord", "casual"],
  ["slack", "casual"],
  ["messages", "casual"],
  ["imessage", "casual"],
  ["whatsapp", "casual"],
  ["telegram", "casual"],
  ["signal", "casual"],
  // mail and documents
  ["mail", "formal"],
  ["outlook", "formal"],
  ["superhuman", "formal"],
  ["spark", "formal"],
  ["word", "formal"],
  ["docs", "formal"],
  ["notion", "formal"],
  // code and terminals
  ["vscode", "technical"],
  ["code.exe", "technical"],
  ["cursor", "technical"],
  ["xcode", "technical"],
  ["jetbrains", "technical"],
  ["intellij", "technical"],
  ["terminal", "technical"],
  ["iterm", "technical"],
  ["ghostty", "technical"],
  ["alacritty", "technical"],
  ["warp", "technical"],
  ["wezterm", "technical"],
  ["powershell", "technical"],
  ["windowsterminal", "technical"],
];

/**
 * Resolve the tone profile for an app.
 *
 * @param {string|null|undefined} appId bundle id (macOS) or executable name (Windows)
 * @param {Record<string,string>} overrides user-configured appId -> profile
 * @returns {string} one of TONE_PROFILES
 */
export function resolveToneProfile(appId, overrides = {}) {
  if (typeof appId !== "string" || !appId.trim()) return "default";
  const id = appId.trim().toLowerCase();

  // A user override wins outright, including an explicit "default" that opts an
  // app out of a built-in match.
  for (const [key, profile] of Object.entries(overrides || {})) {
    if (typeof key !== "string" || !key.trim()) continue;
    if (id.includes(key.trim().toLowerCase()) && TONE_PROFILES.includes(profile)) {
      return profile;
    }
  }

  for (const [needle, profile] of BUILT_IN) {
    if (id.includes(needle)) return profile;
  }
  return "default";
}

/** The instruction to append for a profile. Empty string for "default". */
export function toneInstruction(profile) {
  return TONE_INSTRUCTIONS[profile] ?? "";
}

/** Every built-in mapping, for display in settings. */
export function builtInToneMappings() {
  return BUILT_IN.map(([match, profile]) => ({ match, profile }));
}
