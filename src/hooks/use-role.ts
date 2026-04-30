"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import type { UserRole, UserProfile } from "@/lib/types";
import { getRoleDashboardPath } from "@/lib/types";

interface UseRoleReturn {
  role: UserRole | null;
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook that returns the current user's role, profile, and loading state.
 * Queries the users table by the authenticated user's email.
 */
export function useRole(): UseRoleReturn {
  const supabase = createClient();
  const [role, setRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchRole() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser?.email) {
          if (mounted) { setError("Not authenticated"); setLoading(false); }
          return;
        }

        const { data: profile, error: dbError } = await supabase
          .from("users")
          .select("*, society:societies(id, name, abbreviation, department)")
          .eq("email", authUser.email.toLowerCase())
          .single();

        if (dbError || !profile) {
          if (mounted) { setError("Account not registered"); setLoading(false); }
          return;
        }

        if (mounted) {
          setRole(profile.role as UserRole);
          setUser(profile as UserProfile);
          setLoading(false);
        }
      } catch {
        if (mounted) { setError("Failed to load profile"); setLoading(false); }
      }
    }

    fetchRole();
    return () => { mounted = false; };
  }, []);

  return { role, user, loading, error };
}
