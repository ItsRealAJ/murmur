/**
 * Shared dictionary packs.
 *
 * A pack is a JSON document published at a URL that a community curates once so
 * every member's transcription improves at the same time — member handles,
 * project names, in-jokes, jargon. Subscribers keep their own words separate, so
 * refreshing a pack never clobbers personal entries and unsubscribing removes
 * exactly what the pack contributed.
 *
 * Pack words end up inside the Whisper `prompt` and appended to the cleanup
 * model's system prompt, which makes a pack an untrusted input to an LLM. Every
 * limit below exists for that reason, not for tidiness.
 *
 * Expected document shape (unknown fields ignored):
 *   { "name": "...", "description": "...", "words": ["...", "..."] }
 * A bare array of strings is also accepted.
 */

/** Whisper's prompt is finite; a huge pack would crowd out the user's own words. */
export const MAX_WORDS_PER_PACK = 500;
/** Long enough for "Bougainvillea Standard", short enough to not smuggle a paragraph. */
export const MAX_WORD_LENGTH = 60;
/** Refuse oversized documents before parsing them. */
export const MAX_PACK_BYTES = 256 * 1024;

/**
 * A pack word must read as a word or short phrase. Anything carrying control
 * characters or prompt-steering punctuation is dropped rather than escaped — a
 * dictionary entry has no legitimate need for them, and dropping is the only
 * option that cannot be worked around.
 */
export function sanitizeWord(raw) {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  if (cleaned.length > MAX_WORD_LENGTH) return null;
  // Reject the shapes used to steer a model: braces, angle-bracket tags,
  // backticks/fences, and role-prefixed instructions.
  if (/[<>{}`]/.test(cleaned)) return null;
  if (/^(system|assistant|user)\s*:/i.test(cleaned)) return null;
  return cleaned;
}

/** Case-insensitive de-dupe that keeps the first spelling seen. */
export function dedupeWords(words) {
  const seen = new Set();
  const out = [];
  for (const w of words) {
    const key = w.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

/**
 * Parse a fetched pack document.
 *
 * @returns {{ok: true, name: string|null, description: string|null, words: string[], dropped: number}
 *          | {ok: false, error: string}}
 */
export function parsePack(text) {
  if (typeof text !== "string") return { ok: false, error: "Pack is not text." };
  if (text.length > MAX_PACK_BYTES) return { ok: false, error: "Pack is too large." };

  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return { ok: false, error: "Pack is not valid JSON." };
  }

  const rawWords = Array.isArray(doc) ? doc : doc && Array.isArray(doc.words) ? doc.words : null;
  if (!rawWords) return { ok: false, error: "Pack has no `words` array." };

  const kept = [];
  let dropped = 0;
  for (const raw of rawWords) {
    const w = sanitizeWord(raw);
    if (w) kept.push(w);
    else dropped += 1;
  }

  const deduped = dedupeWords(kept);
  const words = deduped.slice(0, MAX_WORDS_PER_PACK);
  dropped += deduped.length - words.length;
  if (!words.length) return { ok: false, error: "Pack contains no usable words." };

  const name = !Array.isArray(doc) && typeof doc.name === "string" ? sanitizeWord(doc.name) : null;
  const description =
    !Array.isArray(doc) && typeof doc.description === "string"
      ? sanitizeWord(doc.description)
      : null;

  return { ok: true, name, description, words, dropped };
}

/** Only https, and no credentials embedded in the URL. */
export function validatePackUrl(raw) {
  let url;
  try {
    url = new URL(String(raw ?? "").trim());
  } catch {
    return { ok: false, error: "Not a valid URL." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Pack URLs must use https." };
  if (url.username || url.password)
    return { ok: false, error: "URL must not contain credentials." };
  return { ok: true, url: url.toString() };
}

/**
 * The dictionary actually handed to transcription: the user's own words first
 * (so they win ties), then every enabled pack in subscription order.
 */
export function mergeDictionary(userWords = [], packs = []) {
  // Non-strings are dropped, not coerced — String(null) would otherwise add the
  // literal word "null" to the dictionary and boost it during transcription.
  const keep = (list) =>
    (list || [])
      .filter((w) => typeof w === "string")
      .map((w) => w.trim())
      .filter(Boolean);

  const all = keep(userWords);
  for (const pack of packs || []) {
    if (!pack || pack.enabled === false) continue;
    all.push(...keep(pack.words));
  }
  return dedupeWords(all);
}

/** A fresh subscription record, before its first fetch. */
export function newSubscription(url, name = null) {
  return {
    url,
    name: name || null,
    words: [],
    lastFetched: null,
    lastError: null,
    enabled: true,
  };
}
