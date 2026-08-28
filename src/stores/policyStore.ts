import { create } from "zustand";
import type { PolicyDecisionSnapshot } from "./policyRules";

/**
 * Murmur is never centrally managed.
 *
 * Upstream fetched an org policy from its backend to let administrators lock
 * providers, retention, and features for enterprise seats. A local-only fork has
 * no org and no backend, so the store is pinned to `status: "unmanaged"`.
 *
 * This is deliberately a pinned store rather than a rewrite of every call site:
 * `policyRules.ts` already treats "unmanaged" as fully permissive, so all of its
 * predicates (isPolicyActionAllowed, isProviderAllowedByPolicy, isAgentAllowed,
 * …) keep their real logic and simply always allow. Nothing is bypassed — the
 * rules run, they just have no policy to enforce.
 */

export interface PolicyState extends PolicyDecisionSnapshot {
  accountId: string | null;
  authGeneration: number | null;
  revision: number;
  managed: boolean;
  fetchPolicy: (accountId: string, authGeneration: number) => Promise<void>;
  clearPolicy: () => void;
  suspendPolicy: () => void;
}

const noop = () => {};

export const usePolicyStore = create<PolicyState>()(() => ({
  status: "unmanaged",
  policy: null,
  appVersion: null,
  accountId: null,
  authGeneration: null,
  revision: 0,
  managed: false,
  fetchPolicy: async () => {},
  clearPolicy: noop,
  suspendPolicy: noop,
}));
