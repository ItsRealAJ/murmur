import {
  filterByokProviderOptionsByPolicy,
  isModeAllowedByPolicy,
  isProviderAllowedByPolicy,
  type PolicyDecisionSnapshot,
} from "../../stores/policyRules.ts";

interface ProviderOption {
  id: string;
}

export interface OnboardingSetupAvailability {
  cloud: boolean;
  local: boolean;
  byok: boolean;
  selfHosted: boolean;
}

/**
 * A setup card is available only when every stage behind it has at least one
 * usable option. Checking modes alone can expose a route whose provider list is
 * empty after workspace-policy filtering.
 */
export function getOnboardingSetupAvailability({
  policy,
  transcriptionProviders,
  llmProviders,
}: {
  policy: PolicyDecisionSnapshot;
  transcriptionProviders: ProviderOption[];
  llmProviders: ProviderOption[];
}): OnboardingSetupAvailability {
  const transcriptionByokAvailable =
    isModeAllowedByPolicy(policy, "transcription", "providers") &&
    filterByokProviderOptionsByPolicy(transcriptionProviders, "transcription", policy).length > 0;
  const llmByokAvailable =
    isModeAllowedByPolicy(policy, "llm", "providers") &&
    filterByokProviderOptionsByPolicy(llmProviders, "llm", policy).length > 0;

  // Murmur has no hosted account tier — the only paths are the user's own API
  // key (BYOK / self-hosted) or fully on-device. Never offer a sign-in card.
  const cloud = false;
  // Both stages always run: setup configures a transcription model and the
  // cleanup LLM. The agent used to make the LLM stage conditional; it is gone,
  // and cleanup needs a model regardless, so every route requires both.
  const local =
    isModeAllowedByPolicy(policy, "transcription", "local") &&
    isModeAllowedByPolicy(policy, "llm", "local");
  const byok = transcriptionByokAvailable && llmByokAvailable;
  const selfHosted =
    isModeAllowedByPolicy(policy, "transcription", "self-hosted") &&
    isProviderAllowedByPolicy(policy, "transcription", "custom") &&
    isModeAllowedByPolicy(policy, "llm", "self-hosted") &&
    isProviderAllowedByPolicy(policy, "llm", "custom");

  return { cloud, local, byok, selfHosted };
}

export function hasAvailableOnboardingSetup(availability: OnboardingSetupAvailability): boolean {
  return Object.values(availability).some(Boolean);
}
