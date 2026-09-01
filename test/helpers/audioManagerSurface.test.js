const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "dist" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// The assistant strip removed methods from AudioManager while callers kept
// calling them. Nothing caught it: App.jsx and the hooks are plain .js, so the
// first symptom was a packaged build where pressing the hotkey did nothing and
// the pill flashed "processing" and vanished — a TypeError thrown inside the
// recording start path. setTranslationRequested was collateral damage from an
// over-wide delete, and translation is a feature we kept.
test("every AudioManager method the app calls actually exists", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/helpers/audioManager.js"), "utf8");

  const defined = new Set(
    [...source.matchAll(/^ {2}(?:async\s+|\*\s*)?([A-Za-z_]\w*)\s*\(/gm)].map((m) => m[1])
  );
  // Instance fields read as properties (this.x = ... in the constructor).
  for (const m of source.matchAll(/^\s*this\.([A-Za-z_]\w*)\s*=/gm)) defined.add(m[1]);

  const missing = new Map();
  for (const file of walk(path.join(ROOT, "src"))) {
    if (file.endsWith("audioManager.js")) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/audioManager(?:Ref\.current)?\??\.\s*([A-Za-z_]\w*)/g)) {
      if (!defined.has(m[1])) {
        const rel = path.relative(ROOT, file);
        if (!missing.has(m[1])) missing.set(m[1], new Set());
        missing.get(m[1]).add(rel);
      }
    }
  }

  assert.deepEqual(
    [...missing].map(([name, files]) => `${name} (called from ${[...files].join(", ")})`),
    [],
    "AudioManager members are referenced that no longer exist"
  );
});

// Translation survived the assistant removal and runs on every recording start.
test("the translation and verbatim entry points survive", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/helpers/audioManager.js"), "utf8");
  for (const method of ["setTranslationRequested", "setVerbatimRequested", "setTargetAppId"]) {
    assert.match(source, new RegExp(`^ {2}${method}\\(`, "m"), `${method} is missing`);
  }
});

// The external check above missed this one: getEffectiveSttLanguage is only ever
// called as this.getEffectiveSttLanguage(...) from inside the class, so nothing
// outside audioManager.js referenced it. It went in the same over-wide delete,
// and the failure surfaced only after a recording had already succeeded —
// "Local Whisper failed: this.getEffectiveSttLanguage is not a function".
test("every method AudioManager calls on itself exists", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/helpers/audioManager.js"), "utf8");

  const defined = new Set([
    ...[...source.matchAll(/^ {2}(?:async\s+|\*\s*)?([A-Za-z_]\w*)\s*\(/gm)].map((m) => m[1]),
    ...[...source.matchAll(/^\s*this\.([A-Za-z_]\w*)\s*=/gm)].map((m) => m[1]),
  ]);

  const missing = [
    ...new Set([...source.matchAll(/\bthis\.([A-Za-z_]\w*)\s*\(/g)].map((m) => m[1])),
  ]
    .filter((name) => !defined.has(name))
    .sort();

  assert.deepEqual(missing, [], "AudioManager calls methods on itself that do not exist");
});
