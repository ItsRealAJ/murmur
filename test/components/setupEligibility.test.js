const assert = require("node:assert/strict");
const test = require("node:test");

const load = () => import("../../src/components/onboarding/setupEligibility.ts");

const TRANSCRIPTION_PROVIDERS = [{ id: "openai" }, { id: "groq" }];
const LLM_PROVIDERS = [{ id: "anthropic" }, { id: "groq" }];

function managedPolicy({ transcription, llm }) {
  return {
    status: "managed",
    appVersion: "1.0.0",
    policy: {
      version: 1,
      transcription,
      llm,
      features: { agentEnabled: true, webSearchEnabled: true },
      sharing: { externalLinkSharing: "allowed" },
      dataRetention: {
        audioRetentionMaxDays: null,
        localHistoryMode: "user_choice",
        cloudBackupAllowed: true,
      },
      minAppVersion: null,
    },
  };
}

function availability(policy, overrides = {}) {
  return load().then(({ getOnboardingSetupAvailability }) =>
    getOnboardingSetupAvailability({
      policy,
      transcriptionProviders: TRANSCRIPTION_PROVIDERS,
      llmProviders: LLM_PROVIDERS,
      ...overrides,
    })
  );
}

test("BYOK requires a usable provider for both stages", async () => {
  const base = {
    transcription: { allowedModes: ["providers"], allowedByokProviders: [] },
    llm: {
      allowedModes: ["providers"],
      allowedByokProviders: [],
      allowedEnterpriseProviders: [],
    },
  };
  assert.equal((await availability(managedPolicy(base))).byok, false);

  base.transcription.allowedByokProviders = ["groq"];
  assert.equal((await availability(managedPolicy(base))).byok, false);

  base.llm.allowedByokProviders = ["anthropic"];
  assert.equal((await availability(managedPolicy(base))).byok, true);
});

test("self-hosted eligibility is independent from hosted provider mode", async () => {
  const result = await availability(
    managedPolicy({
      transcription: { allowedModes: ["self-hosted"], allowedByokProviders: ["custom"] },
      llm: {
        allowedModes: ["self-hosted"],
        allowedByokProviders: ["custom"],
        allowedEnterpriseProviders: [],
      },
    })
  );

  assert.equal(result.byok, false);
  assert.equal(result.selfHosted, true);
});

test("availability reports no setup when policy permits no onboarding mode", async () => {
  const policy = managedPolicy({
    transcription: { allowedModes: [], allowedByokProviders: [] },
    llm: {
      allowedModes: [],
      allowedByokProviders: [],
      allowedEnterpriseProviders: [],
    },
  });

  const result = await availability(policy);
  assert.deepEqual(result, {
    cloud: false,
    local: false,
    byok: false,
    selfHosted: false,
  });
});

// Both setup stages always run now, so a policy that blocks LLM providers
// blocks the whole route rather than leaving a dictation-only path: cleanup
// needs a model, and there is no agent flag left to make it optional.
test("blocking LLM providers blocks the route, since cleanup needs a model", async () => {
  const result = await availability(
    managedPolicy({
      transcription: {
        allowedModes: ["local", "providers", "self-hosted"],
        allowedByokProviders: ["groq"],
      },
      llm: { allowedModes: [], allowedByokProviders: [], allowedEnterpriseProviders: [] },
    })
  );
  assert.equal(result.byok, false);
  assert.equal(result.local, false);
  assert.equal(result.selfHosted, false);
});
