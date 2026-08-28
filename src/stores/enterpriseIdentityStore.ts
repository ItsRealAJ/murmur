import type {
  EnterpriseSetupMode,
  ManagedEnterpriseScopeResolution,
} from "../types/enterpriseIdentity";
import type { InferenceScope } from "../config/inferenceScopes";

/**
 * Murmur has no managed enterprise identity.
 *
 * Upstream let an administrator pin the inference provider and model per scope
 * via a managed config fetched from its backend (with a fail-closed mode that
 * blocks inference when that config cannot be read). Murmur has no administrator
 * and no backend, so every scope resolves to `"manual"` — the user configures
 * their own provider, which is the only mode this fork ships.
 *
 * Returning "manual" (rather than "managed" or "error") keeps every caller on
 * its existing, well-tested local path.
 */

const MANUAL: ManagedEnterpriseScopeResolution = { kind: "manual" };

export function getManagedScopeResolution(
  _scope?: InferenceScope,
  _setupMode?: EnterpriseSetupMode
): ManagedEnterpriseScopeResolution {
  return MANUAL;
}

export function useManagedScopeResolution(
  _scope?: InferenceScope,
  _setupMode?: EnterpriseSetupMode
): ManagedEnterpriseScopeResolution {
  return MANUAL;
}
