const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../../src/helpers/dictationRouting.js");

test("translation is unreachable when disabled", async () => {
  const { resolveDictationTranslationReachability } = await load();

  assert.equal(
    resolveDictationTranslationReachability({
      useDictationTranslation: false,
      translationTargetLanguage: "it",
      translationMode: "openwhispr",
      translationProvider: undefined,
      translationModel: "gpt-5-mini",
      isCloudTranslation: true,
      isSelfHostedTranslation: false,
    }),
    false
  );
});

test("translation is unreachable without a target language", async () => {
  const { resolveDictationTranslationReachability } = await load();

  assert.equal(
    resolveDictationTranslationReachability({
      useDictationTranslation: true,
      translationTargetLanguage: "   ",
      translationMode: "openwhispr",
      translationProvider: undefined,
      translationModel: "gpt-5-mini",
      isCloudTranslation: true,
      isSelfHostedTranslation: false,
    }),
    false
  );
});

test("translation is reachable in cloud mode without an explicit model", async () => {
  const { resolveDictationTranslationReachability } = await load();

  assert.equal(
    resolveDictationTranslationReachability({
      useDictationTranslation: true,
      translationTargetLanguage: "it",
      translationMode: "openwhispr",
      translationProvider: undefined,
      translationModel: "",
      isCloudTranslation: true,
      isSelfHostedTranslation: false,
    }),
    true
  );
});

test("translation is reachable in self-hosted mode without an explicit model", async () => {
  const { resolveDictationTranslationReachability } = await load();

  assert.equal(
    resolveDictationTranslationReachability({
      useDictationTranslation: true,
      translationTargetLanguage: "it",
      translationMode: "self-hosted",
      translationProvider: undefined,
      translationModel: "",
      isCloudTranslation: false,
      isSelfHostedTranslation: true,
    }),
    true
  );
});

test("translation needs a model on model-required providers", async () => {
  const { resolveDictationTranslationReachability } = await load();

  assert.equal(
    resolveDictationTranslationReachability({
      useDictationTranslation: true,
      translationTargetLanguage: "it",
      translationMode: "providers",
      translationProvider: "openai",
      translationModel: "  ",
      isCloudTranslation: false,
      isSelfHostedTranslation: false,
    }),
    false
  );

  assert.equal(
    resolveDictationTranslationReachability({
      useDictationTranslation: true,
      translationTargetLanguage: "it",
      translationMode: "providers",
      translationProvider: "openai",
      translationModel: "qwen3:8b",
      isCloudTranslation: false,
      isSelfHostedTranslation: false,
    }),
    true
  );
});

test("translation provider: available managed mode routes to openwhispr", async () => {
  const { resolveTranslationProviderId } = await load();

  assert.equal(
    resolveTranslationProviderId({
      isCloudTranslation: true,
      translationMode: "openwhispr",
      translationProvider: "openai",
    }),
    "openwhispr"
  );
});

test("translation provider: mode wins over stale provider and cloud state", async () => {
  const { resolveTranslationProviderId } = await load();

  for (const [translationMode, translationProvider, expected] of [
    ["providers", " groq ", "groq"],
    ["local", "qwen", "local"],
    ["local", "openai", "local"],
    ["self-hosted", "openai", undefined],
  ]) {
    assert.equal(
      resolveTranslationProviderId({
        isCloudTranslation: translationMode === "local",
        translationMode,
        translationProvider,
      }),
      expected
    );
  }
});

test("translation provider: empty local provider routes to llama.cpp", async () => {
  const { resolveTranslationProviderId } = await load();

  assert.equal(
    resolveTranslationProviderId({
      isCloudTranslation: false,
      translationMode: "local",
      translationProvider: "",
    }),
    "local"
  );
});

test("translation provider: incomplete managed and provider modes fail closed", async () => {
  const { resolveTranslationProviderId } = await load();

  for (const translationMode of ["openwhispr", "providers", "enterprise"]) {
    assert.equal(
      resolveTranslationProviderId({
        isCloudTranslation: false,
        translationMode,
        translationProvider: "  ",
      }),
      undefined
    );
  }
});

// resolveDictationRouteKind used to have an "agent" arm, reachable either by
// the voice-assistant hotkey or by a wake word at the head of the transcript.
// Both are gone: a dictation now always ends as text. These pin the reduced
// shape, because losing the agent must not quietly cost cleanup or translation.
test("a plain dictation with cleanup configured takes the cleanup path", async () => {
  const { resolveDictationRouteKind } = await import("../../src/helpers/dictationRouting.js");
  assert.equal(
    resolveDictationRouteKind({
      cleanupReachable: true,
      translationRequested: false,
      translationReachable: false,
    }),
    "cleanup"
  );
});

test("with no cleanup model the transcript is pasted untouched", async () => {
  const { resolveDictationRouteKind } = await import("../../src/helpers/dictationRouting.js");
  assert.equal(
    resolveDictationRouteKind({
      cleanupReachable: false,
      translationRequested: false,
      translationReachable: false,
    }),
    "skip"
  );
});

test("a translation request routes to translation when it is reachable", async () => {
  const { resolveDictationRouteKind } = await import("../../src/helpers/dictationRouting.js");
  assert.equal(
    resolveDictationRouteKind({
      cleanupReachable: true,
      translationRequested: true,
      translationReachable: true,
    }),
    "translation"
  );
});

// A transcript is still a useful dictation without the translation step, so an
// unreachable translation degrades rather than failing.
test("an unreachable translation falls back to cleanup, then to raw text", async () => {
  const { resolveDictationRouteKind } = await import("../../src/helpers/dictationRouting.js");
  assert.equal(
    resolveDictationRouteKind({
      cleanupReachable: true,
      translationRequested: true,
      translationReachable: false,
    }),
    "cleanup"
  );
  assert.equal(
    resolveDictationRouteKind({
      cleanupReachable: false,
      translationRequested: true,
      translationReachable: false,
    }),
    "skip"
  );
});

// The wake word defaulted to the product name, so this exact sentence used to
// be swallowed by the agent instead of typed.
test("no input can route to an agent any more", async () => {
  const { resolveDictationRouteKind } = await import("../../src/helpers/dictationRouting.js");
  for (const translationRequested of [true, false]) {
    for (const cleanupReachable of [true, false]) {
      for (const translationReachable of [true, false]) {
        const kind = resolveDictationRouteKind({
          cleanupReachable,
          translationRequested,
          translationReachable,
        });
        assert.notEqual(kind, "agent");
        assert.ok(["cleanup", "translation", "skip"].includes(kind), `unexpected kind ${kind}`);
      }
    }
  }
});
