/**
 * Mumur has no plans, quotas, or billing.
 *
 * Upstream metered dictation against a hosted subscription (free tier capped at
 * 2,000 words/week) and this hook fetched that entitlement. A local-only fork
 * has nothing to meter: transcription and cleanup run on the user's own machine
 * or against their own API key.
 *
 * The hook is kept so the surfaces that read it compile unchanged; every value
 * is pinned to "unlimited, paid, never over limit" so quota banners, upgrade
 * prompts, and trial countdowns are unreachable. Those components are deleted
 * separately — this makes them dead before they are removed, so the app stays
 * runnable throughout.
 */

export interface UseUsageResult {
  status: "success";
  isRefreshing: boolean;
  isRetrying: boolean;
  error: string | null;
  retry: () => Promise<void>;
  refetch: () => Promise<void>;
  hasPaidAccess: boolean | null;
  hasPaidAccessOptimistic: boolean;
  plan: string;
  isPastDue: boolean;
  wordsUsed: number;
  wordsRemaining: number;
  limit: number;
  isSubscribed: boolean;
  isPersonallySubscribed: boolean;
  entitledWorkspaceIds: string[];
  isTrial: boolean;
  trialDaysLeft: number | null;
  currentPeriodEnd: string | null;
  billingInterval: "monthly" | "annual" | null;
  isOverLimit: boolean;
  isApproachingLimit: boolean;
  resetAt: string | null;
  checkoutLoading: boolean;
  openCheckout: (opts?: {
    plan?: "monthly" | "annual";
    tier?: "pro" | "business";
  }) => Promise<{ success: boolean; error?: string }>;
  openBillingPortal: () => Promise<{ success: boolean; error?: string; code?: string }>;
  switchPlan: (opts: {
    plan: "monthly" | "annual";
    tier: "pro" | "business";
  }) => Promise<{ success: boolean; error?: string }>;
  previewSwitchPlan: (opts: {
    plan: "monthly" | "annual";
    tier: "pro" | "business";
  }) => Promise<{ success: boolean; error?: string }>;
}

const noop = async (): Promise<void> => {};
const unavailable = async () => ({ success: false, error: "Mumur has no billing." });

const UNLIMITED: UseUsageResult = {
  status: "success",
  isRefreshing: false,
  isRetrying: false,
  error: null,
  retry: noop,
  refetch: noop,
  hasPaidAccess: true,
  hasPaidAccessOptimistic: true,
  plan: "local",
  isPastDue: false,
  wordsUsed: 0,
  // Infinity rather than a large number: `wordsUsed >= limit * 0.8` and similar
  // threshold checks must never become true.
  wordsRemaining: Number.POSITIVE_INFINITY,
  limit: Number.POSITIVE_INFINITY,
  isSubscribed: true,
  isPersonallySubscribed: true,
  entitledWorkspaceIds: [],
  isTrial: false,
  trialDaysLeft: null,
  currentPeriodEnd: null,
  billingInterval: null,
  isOverLimit: false,
  isApproachingLimit: false,
  resetAt: null,
  checkoutLoading: false,
  openCheckout: unavailable,
  openBillingPortal: unavailable,
  switchPlan: unavailable,
  previewSwitchPlan: unavailable,
};

export function useUsage(): UseUsageResult {
  return UNLIMITED;
}
