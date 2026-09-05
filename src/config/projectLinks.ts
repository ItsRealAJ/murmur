/**
 * Every outward-facing Murmur link, in one place.
 *
 * Upstream pointed these at openwhispr.com (docs, support email, terms/privacy)
 * and at its own GitHub org and Discord. None of those belong to this fork, so
 * they are placeholders until the real repo and server invite exist — change
 * them here and every surface follows.
 *
 * `electron-builder.json` carries the matching publish target
 * (`publish.owner` / `publish.repo`), which must be updated alongside REPO.
 */

/** GitHub repository that hosts releases and issues. */
export const REPO = "https://github.com/ItsRealAJ/murmur";

export const ISSUES = `${REPO}/issues`;

/** README serves as documentation until there is a docs site. */
export const DOCS = `${REPO}#readme`;

/** The community this build is distributed to. */
export const DISCORD = "https://discord.gg/REPLACE_WITH_YOUR_INVITE";

/** True once the placeholders above have been replaced with real destinations. */
export const LINKS_CONFIGURED = !REPO.includes("REPLACE_WITH_YOUR");
