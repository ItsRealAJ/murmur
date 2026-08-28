const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../../src/helpers/recommendLocalModel.js");

const mac = { platform: "darwin", arch: "arm64" };
const intelMac = { platform: "darwin", arch: "x64" };
const win = { platform: "win32", arch: "x64" };

test("Apple Silicon gets Parakeet — faster and a smaller download than Turbo", async () => {
  const { recommendLocalModel } = await load();
  const r = recommendLocalModel({ ...mac, totalMemoryGb: 16, language: "en" });
  assert.equal(r.provider, "nvidia");
  assert.equal(r.reason, "apple-silicon-parakeet");
});

test("Parakeet is not recommended for a language it cannot handle", async () => {
  const { recommendLocalModel } = await load();
  // Parakeet v3 covers 25 European languages; Japanese is not among them.
  const r = recommendLocalModel({ ...mac, totalMemoryGb: 32, language: "ja" });
  assert.equal(r.provider, "whisper", "falls back to Whisper, which covers 99 languages");
});

test('"auto" counts as supported — detection stays inside Parakeet\'s languages', async () => {
  const { recommendLocalModel } = await load();
  assert.equal(
    recommendLocalModel({ ...mac, totalMemoryGb: 16, language: "auto" }).provider,
    "nvidia"
  );
});

test("Whisper size follows installed memory", async () => {
  const { recommendLocalModel } = await load();
  assert.equal(recommendLocalModel({ ...win, totalMemoryGb: 32 }).model, "Turbo");
  assert.equal(recommendLocalModel({ ...win, totalMemoryGb: 16 }).model, "Turbo");
  assert.equal(recommendLocalModel({ ...win, totalMemoryGb: 12 }).model, "Small");
  assert.equal(recommendLocalModel({ ...win, totalMemoryGb: 8 }).model, "Small");
  assert.equal(recommendLocalModel({ ...win, totalMemoryGb: 4 }).model, "Base");
});

test("unknown memory takes the conservative tier, never the largest", async () => {
  const { recommendLocalModel } = await load();
  for (const unknown of [null, undefined, 0, -1, NaN, "16"]) {
    const r = recommendLocalModel({ ...win, totalMemoryGb: unknown });
    assert.equal(r.model, "Base", `${String(unknown)} should not pick a large download`);
  }
});

test("Intel Macs take the Whisper path, not Parakeet", async () => {
  const { recommendLocalModel } = await load();
  // Parakeet needs Apple Silicon or an NVIDIA GPU.
  assert.equal(recommendLocalModel({ ...intelMac, totalMemoryGb: 16 }).provider, "whisper");
});

test("called with nothing at all, it still returns a usable model", async () => {
  const { recommendLocalModel } = await load();
  const r = recommendLocalModel();
  assert.ok(r.provider && r.model, "onboarding must never be blocked by a missing probe");
  assert.equal(r.model, "Base");
});

test("every recommendation carries an explanation", async () => {
  const { recommendLocalModel, describeRecommendation } = await load();
  for (const env of [mac, intelMac, win]) {
    const text = describeRecommendation(recommendLocalModel({ ...env, totalMemoryGb: 16 }));
    assert.ok(text.length > 0, "the default has to be explainable to the user");
  }
  assert.equal(describeRecommendation(null), "");
});
