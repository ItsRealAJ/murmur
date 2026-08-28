/**
 * Murmur has no accounts.
 *
 * Upstream (OpenWhispr) is open-core for a hosted service, so this hook talked
 * to auth.openwhispr.com and drove sign-in, team membership, and account-scoped
 * data purges. None of that applies to a fork that ships as a local-only app,
 * so the hook is now a constant: there is never a signed-in user.
 *
 * It is kept as a hook (rather than deleted outright) because the surfaces that
 * gate on `isSignedIn` read as "hide the cloud affordance", which is exactly the
 * behaviour we want while the remaining cloud UI is removed.
 */

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

export interface AuthSession {
  token: string;
}

export interface UseAuthResult {
  isSignedIn: boolean;
  isGracePeriodOnly: boolean;
  isLoaded: boolean;
  /** Always null. Typed nullable (not `null`) so `session?.x` stays valid. */
  session: AuthSession | null;
  /** Always null. Typed nullable (not `null`) so `user?.name` stays valid. */
  user: AuthUser | null;
  refetch: () => Promise<void>;
}

const noop = async (): Promise<void> => {};

const LOCAL_ONLY: UseAuthResult = {
  isSignedIn: false,
  isGracePeriodOnly: false,
  // Always resolved — nothing is fetched, so no consumer should ever spin.
  isLoaded: true,
  session: null,
  user: null,
  refetch: noop,
};

export function useAuth(): UseAuthResult {
  return LOCAL_ONLY;
}
