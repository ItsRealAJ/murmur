const assert = require("node:assert/strict");
const test = require("node:test");

const load = () => import("../../src/components/onboarding/flow.ts");

// Murmur has no accounts, so there is no sign-in step and no account/guest
// fork: everyone walks one route. Permissions lead it because a user who never
// granted the mic and never saw their hotkey has not been onboarded, whatever
// else they clicked past.
test("one route for everyone, permissions first", async () => {
  const { getOnboardingRoute } = await load();
  assert.deepEqual(getOnboardingRoute({ authPath: "guest", setupMode: null }), [
    "permissions",
    "languages",
    "use-cases",
    "dictation-hotkey",
    "activation-mode",
    "setup-choice",
  ]);
});

test("authPath no longer changes the route", async () => {
  const { getOnboardingRoute } = await load();
  const asGuest = getOnboardingRoute({ authPath: "guest", setupMode: null });
  const asAccount = getOnboardingRoute({
    authPath: "account",
    setupMode: null,
  });
  const asNull = getOnboardingRoute({ authPath: null, setupMode: null });
  assert.deepEqual(asAccount, asGuest);
  // Previously a null authPath returned ["auth"] — a step whose renderer is gone,
  // which meant a blank first run.
  assert.deepEqual(asNull, asGuest);
});

test("every dictation route restores activation mode setup after shortcut capture", async () => {
  const { getOnboardingRoute } = await load();
  const accountRoute = getOnboardingRoute({
    authPath: "account",
    setupMode: null,
  });
  const guestRoute = getOnboardingRoute({
    authPath: "guest",
    setupMode: null,
  });

  assert.equal(accountRoute[accountRoute.indexOf("dictation-hotkey") + 1], "activation-mode");
  assert.equal(guestRoute[guestRoute.indexOf("dictation-hotkey") + 1], "activation-mode");
});

// The assistant is gone, so no route can reach it however it is asked for.
test("no route offers an assistant step", async () => {
  const { getOnboardingRoute } = await load();
  for (const setupMode of [null, "byok", "local"]) {
    const route = getOnboardingRoute({ authPath: "account", setupMode });
    assert.equal(
      route.some((step) => step.includes("assistant")),
      false,
      `assistant step in ${setupMode} route`
    );
  }
});

// Two stages, but the second is the cleanup model rather than the assistant:
// it is what configures the LLM, so it outlived the agent under a truer name.
test("setup choice appends the selected two-stage route", async () => {
  const { getOnboardingRoute } = await load();
  assert.deepEqual(getOnboardingRoute({ authPath: "guest", setupMode: "byok" }).slice(-3), [
    "setup-choice",
    "byok-dictation",
    "byok-cleanup",
  ]);
  assert.deepEqual(getOnboardingRoute({ authPath: "account", setupMode: "local" }).slice(-3), [
    "setup-choice",
    "local-dictation",
    "local-cleanup",
  ]);
});

test("skipping the setup choice ends the route at the last guided step", async () => {
  const { getOnboardingRoute } = await load();
  const route = getOnboardingRoute({
    authPath: "guest",
    setupMode: null,
    skipSetupChoice: true,
  });
  // Was "notes", then "assistant-demo", then "assistant-hotkey" — each went
  // with its feature.
  assert.equal(route.at(-1), "activation-mode");
  assert.equal(route.includes("setup-choice"), false);
});

test("enterprise workspace entitlement requires a current paid entitlement", async () => {
  const { isEnterpriseWorkspaceEntitled } = await load();
  assert.equal(isEnterpriseWorkspaceEntitled({ plan: "enterprise", status: "active" }), true);
  assert.equal(isEnterpriseWorkspaceEntitled({ plan: "enterprise", status: "trialing" }), true);
  assert.equal(isEnterpriseWorkspaceEntitled({ plan: "enterprise", status: "past_due" }), false);
  assert.equal(isEnterpriseWorkspaceEntitled({ plan: "pro", status: "active" }), false);
  assert.equal(isEnterpriseWorkspaceEntitled(null), false);
});

test("only a signed-in account with an uncommitted choice skips enterprise setup", async () => {
  const { shouldSkipOnboardingSetupChoice } = await load();
  const base = {
    isSignedIn: true,
    authPath: "account",
    setupMode: null,
    activeWorkspace: { plan: "enterprise", status: "active" },
  };

  assert.equal(shouldSkipOnboardingSetupChoice(base), true);
  assert.equal(shouldSkipOnboardingSetupChoice({ ...base, setupMode: "cloud" }), true);
  assert.equal(shouldSkipOnboardingSetupChoice({ ...base, setupMode: "local" }), false);
  assert.equal(shouldSkipOnboardingSetupChoice({ ...base, authPath: "guest" }), false);
  assert.equal(shouldSkipOnboardingSetupChoice({ ...base, isSignedIn: false }), false);
  assert.equal(shouldSkipOnboardingSetupChoice({ ...base, activeWorkspace: null }), false);
});

test("a fresh multi-workspace account resolves its enterprise workspace", async () => {
  const { resolveEnterpriseWorkspaceForOnboarding } = await load();
  const personal = { id: "personal", plan: "pro", status: "active" };
  const enterprise = { id: "enterprise", plan: "enterprise", status: "trialing" };

  assert.equal(resolveEnterpriseWorkspaceForOnboarding(null, [personal, enterprise]), enterprise);
  assert.equal(resolveEnterpriseWorkspaceForOnboarding(personal, [personal, enterprise]), null);
  assert.equal(
    resolveEnterpriseWorkspaceForOnboarding(enterprise, [personal, enterprise]),
    enterprise
  );
});

test("versioned sessions reject malformed or old data", async () => {
  const { createOnboardingSession, parseOnboardingSession } = await load();
  assert.equal(parseOnboardingSession(null), null);
  assert.equal(parseOnboardingSession("not json"), null);
  assert.equal(parseOnboardingSession('{"version":1,"currentStepId":"auth"}'), null);

  const session = createOnboardingSession();
  assert.deepEqual(parseOnboardingSession(JSON.stringify(session)), session);

  const legacyV2 = { ...session };
  delete legacyV2.selfHostedRequested;
  assert.equal(parseOnboardingSession(JSON.stringify(legacyV2)).selfHostedRequested, false);
  assert.equal(
    parseOnboardingSession(JSON.stringify({ ...session, selfHostedRequested: "yes" })),
    null
  );
});

test("an explicit restart clears every persisted route choice", async () => {
  const { resetOnboardingProgress } = await load();
  const values = new Map([
    ["onboardingSessionV2", '{"currentStepId":"permissions"}'],
    ["onboardingCompleted", "true"],
    ["authenticationSkipped", "true"],
    ["skipAuth", "true"],
  ]);
  const storage = {
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };

  resetOnboardingProgress(storage);

  assert.equal(values.get("onboardingCurrentStep"), "0");
  assert.equal(values.has("onboardingSessionV2"), false);
  assert.equal(values.has("onboardingCompleted"), false);
  assert.equal(values.has("authenticationSkipped"), false);
  assert.equal(values.has("skipAuth"), false);
});

test("legacy numeric steps migrate conservatively", async () => {
  const { migrateLegacyOnboardingStep } = await load();
  // Was "auth"; that step went with the accounts layer, so the flow now opens
  // on permissions and legacy saves resume there.
  assert.equal(migrateLegacyOnboardingStep(null), "permissions");
  assert.equal(migrateLegacyOnboardingStep("0"), "permissions");
  // Old steps 1-2 predate the old permissions step, so they must resume at
  // the new flow's permissions step rather than past it.
  assert.equal(migrateLegacyOnboardingStep("1"), "permissions");
  assert.equal(migrateLegacyOnboardingStep("2"), "permissions");
  assert.equal(migrateLegacyOnboardingStep("4"), "dictation-hotkey");
  assert.equal(migrateLegacyOnboardingStep("999"), "setup-choice");
});

// A saved session can name a step the live route does not have — a provider
// stage from a setup mode that was since changed, or a step removed by an
// upgrade. Clamping to route.at(-1) would teleport the user past everything in
// between, which reads as a jump to the end.
test("an off-route step clamps to its nearest neighbour, not the end of the route", async () => {
  const { getOnboardingRoute, reconcileStepWithRoute } = await load();
  const route = getOnboardingRoute({ authPath: "account", setupMode: null });

  assert.equal(route.includes("byok-cleanup"), false);
  assert.equal(reconcileStepWithRoute("byok-cleanup", route), "setup-choice");

  // A step id that no longer exists at all (an assistant step from an older
  // install) has no position to measure from, so it restarts the route rather
  // than landing somewhere arbitrary.
  assert.equal(reconcileStepWithRoute("assistant-hotkey", route), "permissions");
});

test("route helpers walk the route in order", async () => {
  const { getNextOnboardingStep, getOnboardingRoute, reconcileStepWithRoute } = await load();
  const route = getOnboardingRoute({ authPath: "guest", setupMode: null });
  assert.equal(reconcileStepWithRoute("setup-choice", route), "setup-choice");
  assert.equal(getNextOnboardingStep("permissions", route), "languages");
  assert.equal(getNextOnboardingStep("setup-choice", route), null);
});

test("progress counts every step the user is shown, once each", async () => {
  const { getOnboardingProgress, getOnboardingRoute } = await load();
  const route = getOnboardingRoute({ authPath: "account", setupMode: null });

  // Permissions renders in a compact frame with no footer, so it carries no row
  // and must not inflate the total — landing on languages is "1 of 5".
  assert.equal(getOnboardingProgress("permissions", route), null);

  const counted = route.filter((stepId) => getOnboardingProgress(stepId, route) !== null);
  assert.deepEqual(
    counted.map((stepId) => getOnboardingProgress(stepId, route).index),
    counted.map((_, index) => index)
  );
  assert.deepEqual(getOnboardingProgress("languages", route), { index: 0, total: 5 });
  assert.deepEqual(getOnboardingProgress("setup-choice", route), { index: 4, total: 5 });
});

test("progress total tracks the conditional parts of the route", async () => {
  const { getOnboardingProgress, getOnboardingRoute } = await load();
  const context = { authPath: "account", setupMode: null };

  // Picking a non-cloud mode appends the provider pair, so the row grows by two
  // at that moment and the last provider step is what fills it.
  const byok = getOnboardingRoute({ ...context, setupMode: "byok" });
  assert.deepEqual(getOnboardingProgress("setup-choice", byok), { index: 4, total: 7 });
  assert.deepEqual(getOnboardingProgress("byok-cleanup", byok), { index: 6, total: 7 });

  const local = getOnboardingRoute({ ...context, setupMode: "local" });
  assert.deepEqual(getOnboardingProgress("local-cleanup", local), { index: 6, total: 7 });
});

test("an off-route step reports no position", async () => {
  const { getOnboardingProgress, getOnboardingRoute } = await load();
  const route = getOnboardingRoute({ authPath: "guest", setupMode: "byok" });
  // The guest-only variant of this test is gone with the account/guest fork.
  assert.equal(getOnboardingProgress("local-dictation", route), null);
});
