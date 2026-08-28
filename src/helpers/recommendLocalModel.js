/**
 * Picks a local transcription model for this machine.
 *
 * The model chooser is where non-technical users stall: "tiny / base / small /
 * medium / large / turbo" asks someone to trade accuracy against RAM before
 * they have heard the app work once. So Murmur picks a sensible default and
 * pre-selects it — the list stays available for anyone who wants it, but
 * finishing setup no longer requires an opinion.
 *
 * The numbers are download size and working memory, not benchmark scores:
 * a model that pages to disk is slower than a smaller one that does not,
 * whatever its word error rate.
 */

/** Whisper builds, smallest first. `name` matches modelRegistryData.whisperModels. */
const WHISPER_LADDER = [
  { name: "Base", minGb: 0 },
  { name: "Small", minGb: 8 },
  { name: "Turbo", minGb: 16 },
];

/**
 * Parakeet on Apple Silicon is roughly an order of magnitude faster than
 * Whisper Turbo at comparable accuracy, and its ~650MB download is smaller than
 * Turbo's 1.6GB. It only covers 25 European languages and cannot translate, so
 * it is the recommendation only when the user's language is one it handles.
 */
const PARAKEET_DEFAULT = "parakeet-tdt-0.6b-v3";

/** Languages Parakeet v3 handles. "auto" counts: detection stays within them. */
const PARAKEET_LANGUAGES = new Set([
  "auto",
  "en",
  "bg",
  "hr",
  "cs",
  "da",
  "nl",
  "et",
  "fi",
  "fr",
  "de",
  "el",
  "hu",
  "it",
  "lv",
  "lt",
  "mt",
  "pl",
  "pt",
  "ro",
  "sk",
  "sl",
  "es",
  "sv",
  "ru",
  "uk",
]);

/**
 * @param {object} opts
 * @param {number|null} opts.totalMemoryGb  installed RAM, or null if unknown
 * @param {string} opts.platform            process.platform
 * @param {string} opts.arch                process.arch
 * @param {string} [opts.language]          preferred dictation language, or "auto"
 * @returns {{provider: "whisper"|"nvidia", model: string, reason: string}}
 */
export function recommendLocalModel({ totalMemoryGb, platform, arch, language = "auto" } = {}) {
  const appleSilicon = platform === "darwin" && arch === "arm64";

  // Unknown RAM is treated as the low tier: a machine that cannot report its
  // memory should not be handed the largest download.
  const gb = typeof totalMemoryGb === "number" && totalMemoryGb > 0 ? totalMemoryGb : 0;

  if (appleSilicon && PARAKEET_LANGUAGES.has(language)) {
    return {
      provider: "nvidia",
      model: PARAKEET_DEFAULT,
      reason: "apple-silicon-parakeet",
    };
  }

  const pick = [...WHISPER_LADDER].reverse().find((tier) => gb >= tier.minGb) ?? WHISPER_LADDER[0];
  return {
    provider: "whisper",
    model: pick.name,
    reason: gb ? `whisper-${pick.name.toLowerCase()}-for-${gb}gb` : "whisper-unknown-memory",
  };
}

/** Exported for the settings copy that explains the default. */
export function describeRecommendation(recommendation) {
  if (!recommendation) return "";
  if (recommendation.reason === "apple-silicon-parakeet") {
    return "Fastest on Apple Silicon, and a smaller download than Whisper Turbo.";
  }
  if (recommendation.reason === "whisper-unknown-memory") {
    return "A conservative default, chosen because this machine's memory could not be read.";
  }
  return "Chosen to fit this machine's memory without paging to disk.";
}
