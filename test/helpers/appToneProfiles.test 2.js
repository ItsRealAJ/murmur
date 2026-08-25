const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../../src/helpers/appToneProfiles.js");

test("chat apps resolve to the casual profile on both platforms", async () => {
  const { resolveToneProfile } = await load();
  assert.equal(resolveToneProfile("com.hnc.Discord"), "casual");
  assert.equal(resolveToneProfile("Discord.exe"), "casual");
  assert.equal(resolveToneProfile("com.tinyspeck.slackmacgap"), "casual");
});

test("mail and editors resolve to their own profiles", async () => {
  const { resolveToneProfile } = await load();
  assert.equal(resolveToneProfile("com.apple.mail"), "formal");
  assert.equal(resolveToneProfile("OUTLOOK.EXE"), "formal", "matching is case-insensitive");
  assert.equal(resolveToneProfile("com.microsoft.VSCode"), "technical");
  assert.equal(resolveToneProfile("Code.exe"), "technical");
  assert.equal(resolveToneProfile("com.apple.Terminal"), "technical");
});

test("unknown or missing apps fall back to default", async () => {
  const { resolveToneProfile } = await load();
  assert.equal(resolveToneProfile("com.example.SomethingElse"), "default");
  assert.equal(resolveToneProfile(""), "default");
  assert.equal(resolveToneProfile(null), "default");
  assert.equal(resolveToneProfile(undefined), "default");
  assert.equal(resolveToneProfile(12345), "default", "non-strings do not throw");
});

test("a user override beats the built-in mapping", async () => {
  const { resolveToneProfile } = await load();
  // Someone who writes formally in Slack.
  assert.equal(resolveToneProfile("com.tinyspeck.slackmacgap", { slack: "formal" }), "formal");
  // And an explicit "default" opts an app out of its built-in match entirely.
  assert.equal(resolveToneProfile("com.hnc.Discord", { discord: "default" }), "default");
});

test("overrides naming an unknown profile are ignored, not obeyed", async () => {
  const { resolveToneProfile } = await load();
  assert.equal(
    resolveToneProfile("com.hnc.Discord", { discord: "shakespearean" }),
    "casual",
    "an invalid profile falls through to the built-in match"
  );
});

test("only the default profile contributes no instruction", async () => {
  const { toneInstruction, TONE_PROFILES } = await load();
  assert.equal(toneInstruction("default"), "");
  for (const profile of TONE_PROFILES.filter((p) => p !== "default")) {
    assert.ok(toneInstruction(profile).length > 0, `${profile} has an instruction`);
  }
  assert.equal(toneInstruction("nonsense"), "", "an unknown profile adds nothing");
});

test("every built-in mapping names a real profile", async () => {
  const { builtInToneMappings, TONE_PROFILES } = await load();
  const mappings = builtInToneMappings();
  assert.ok(mappings.length > 0);
  for (const { match, profile } of mappings) {
    assert.ok(match && match === match.toLowerCase(), `${match} is stored lowercased`);
    assert.ok(TONE_PROFILES.includes(profile), `${match} -> ${profile} is a known profile`);
  }
});
