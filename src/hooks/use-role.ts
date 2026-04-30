"use client";

import { useSessionProfile } from "@/components/session-profile-provider";
import type { UserRole, UserProfile } from "@/lib/types";

interface UseRoleReturn {
  role: UserRole | null;
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook that returns the current user's role, profile, and loading state.
 * Backed by SessionProfileProvider (single fetch per session).
 */
export function useRole(): UseRoleReturn {
  const { loading, error, role, profile } = useSessionProfile();
  return { loading, error, role, user: profile };
}
