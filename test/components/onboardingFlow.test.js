const assert = require("node:assert/strict");
const test = require("node:test");

const load = () => import("../../src/components/onboarding/flow.ts");

// Murmur has no accounts, so there is no sign-in step and no account/guest
// fork: everyone walks one route. Permissions lead it because a user who never
// granted the mic and never saw their hotkey has not been onboarded, whatever
// else they clicked past.
test("one route for everyone, permissions first", async () => {
  const { getOnboardingRoute } = await load();
  assert.deepEqual(getOnboardingRoute({ authPath: "guest", setupMode: null, agentAllowed: true }), [
    "permissions",
    "languages",
    "use-cases",
    "dictation-hotkey",
    "activation-mode",
    "dictation-demo",
    "assistant-hotkey",
    "assistant-demo",
    "setup-choice",
  ]);
});

test("authPath no longer changes the route", async () => {
  const { getOnboardingRoute } = await load();
  const asGuest = getOnboardingRoute({ authPath: "guest", setupMode: null, agentAllowed: true });
  const asAccount = getOnboardingRoute({
    authPath: "account",
    setupMode: null,
    agentAllowed: true,
  });
  const asNull = getOnboardingRoute({ authPath: null, setupMode: null, agentAllowed: true });
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
    agentAllowed: true,
  });
  const guestRoute = getOnboardingRoute({
    authPath: "guest",
    setupMode: null,
    agentAllowed: true,
  });

  assert.equal(accountRoute[accountRoute.indexOf("dictation-hotkey") + 1], "activation-mode");
  assert.equal(guestRoute[guestRoute.indexOf("dictation-hotkey") + 1], "activation-mode");
});

test("policy removes assistant states", async () => {
  const { getOnboardingRoute } = await load();
  const route = getOnboardingRoute({ authPath: "account", setupMode: null, agentAllowed: false });
  assert.equal(route.includes("assistant-hotkey"), false);
  assert.equal(route.includes("assistant-demo"), false);
  assert.equal(route.at(-1), "setup-choice");
});

test("setup choice appends the selected two-stage route", async () => {
  const { getOnboardingRoute } = await load();
  assert.deepEqual(
    getOnboardingRoute({ authPath: "guest", setupMode: "byok", agentAllowed: true }).slice(-3),
    ["setup-choice", "byok-dictation", "byok-assistant"]
  );
  assert.deepEqual(
    getOnboardingRoute({ authPath: "account", setupMode: "local", agentAllowed: false }).slice(-2),
    ["setup-choice", "local-dictation"]
  );
});

test("skipping the setup choice ends the route at the last guided step", async () => {
  const { getOnboardingRoute } = await load();
  const route = getOnboardingRoute({
    authPath: "guest",
    setupMode: null,
    agentAllowed: true,
    skipSetupChoice: true,
  });
  // Was "notes" — that step went with the notes feature.
  assert.equal(route.at(-1), "assistant-demo");
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

test("an off-route assistant step clamps to its neighbour, not the end of the route", async () => {
  const { getOnboardingRoute, reconcileStepWithRoute } = await load();
  // agentAllowed false is what a failed policy fetch produces, and it drops both
  // assistant steps from the route. Clamping to route.at(-1) used to land the
  // user past intermediate steps, which read as a jump to the end.
  const route = getOnboardingRoute({
    authPath: "account",
    setupMode: null,
    agentAllowed: false,
  });
  assert.equal(route.includes("assistant-hotkey"), false);
  assert.equal(reconcileStepWithRoute("assistant-hotkey", route), "dictation-demo");
  assert.equal(reconcileStepWithRoute("assistant-demo", route), "setup-choice");
  assert.notEqual(reconcileStepWithRoute("assistant-hotkey", route), "setup-choice");

  // With the agent allowed the steps are on the route and pass through untouched.
  const agentRoute = getOnboardingRoute({
    authPath: "account",
    setupMode: null,
    agentAllowed: true,
  });
  assert.equal(reconcileStepWithRoute("assistant-hotkey", agentRoute), "assistant-hotkey");
});

test("route helpers recover from ineligible steps", async () => {
  const { getNextOnboardingStep, getOnboardingRoute, reconcileStepWithRoute } = await load();
  const route = getOnboardingRoute({ authPath: "guest", setupMode: null, agentAllowed: true });
  // assistant-demo is on this route now, so it passes through untouched; a
  // provider step that was never selected is the genuinely off-route case.
  assert.equal(reconcileStepWithRoute("assistant-demo", route), "assistant-demo");
  assert.equal(reconcileStepWithRoute("byok-assistant", route), "setup-choice");
  assert.equal(getNextOnboardingStep("permissions", route), "languages");
  assert.equal(getNextOnboardingStep("setup-choice", route), null);
});

test("progress counts every step the user is shown, once each", async () => {
  const { getOnboardingProgress, getOnboardingRoute } = await load();
  const route = getOnboardingRoute({ authPath: "account", setupMode: null, agentAllowed: true });

  // Permissions renders in a compact frame with no footer, so it carries no row
  // and must not inflate the total — landing on languages is "1 of 8".
  assert.equal(getOnboardingProgress("permissions", route), null);

  const counted = route.filter((stepId) => getOnboardingProgress(stepId, route) !== null);
  assert.deepEqual(
    counted.map((stepId) => getOnboardingProgress(stepId, route).index),
    counted.map((_, index) => index)
  );
  assert.deepEqual(getOnboardingProgress("languages", route), { index: 0, total: 8 });
  assert.deepEqual(getOnboardingProgress("setup-choice", route), { index: 7, total: 8 });
});

test("progress total tracks the conditional parts of the route", async () => {
  const { getOnboardingProgress, getOnboardingRoute } = await load();
  const context = { authPath: "account", setupMode: null, agentAllowed: true };

  // Dropping the assistant pair shortens the row rather than leaving two dots
  // that can never fill.
  const noAgent = getOnboardingRoute({ ...context, agentAllowed: false });
  assert.equal(getOnboardingProgress("languages", noAgent).total, 6);
  assert.deepEqual(getOnboardingProgress("setup-choice", noAgent), { index: 5, total: 6 });

  // Picking a non-cloud mode appends the provider pair, so the row grows by two
  // at that moment and the last provider step is what fills it.
  const byok = getOnboardingRoute({ ...context, setupMode: "byok" });
  assert.deepEqual(getOnboardingProgress("setup-choice", byok), { index: 7, total: 10 });
  assert.deepEqual(getOnboardingProgress("byok-assistant", byok), { index: 9, total: 10 });
});

test("an off-route step reports no position", async () => {
  const { getOnboardingProgress, getOnboardingRoute } = await load();
  const route = getOnboardingRoute({ authPath: "guest", setupMode: "byok", agentAllowed: true });
  // The guest-only variant of this test is gone with the account/guest fork.
  assert.equal(getOnboardingProgress("local-dictation", route), null);
});
