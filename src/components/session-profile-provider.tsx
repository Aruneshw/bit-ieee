"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, UserRole } from "@/lib/types";

type WelcomeType = "returning" | "first_time" | null;

interface SessionProfileState {
  loading: boolean;
  error: string | null;
  profile: UserProfile | null;
  role: UserRole | null;
  welcome: {
    type: WelcomeType;
    fullName: string | null;
  };
  refresh: () => Promise<void>;
}

const SessionProfileContext = createContext<SessionProfileState | null>(null);

async function fetchProfileByEmail(email: string) {
  const supabase = createClient();
  return supabase
    .from("users")
    .select("*, society:societies(id, name, abbreviation, department)")
    .eq("email", email.toLowerCase())
    .single();
}

export function SessionProfileProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [welcome, setWelcome] = useState<{ type: WelcomeType; fullName: string | null }>({
    type: null,
    fullName: null,
  });
  const didSetLoginRef = useRef(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      setProfile(null);
      setRole(null);
      setWelcome({ type: null, fullName: null });
      setLoading(false);
      setError("Not authenticated");
      return;
    }

    const { data, error: dbError } = await fetchProfileByEmail(user.email);
    if (dbError || !data) {
      setProfile(null);
      setRole(null);
      setWelcome({ type: null, fullName: null });
      setLoading(false);
      setError("Account not registered");
      return;
    }

    const prevLastLogin = (data as any).last_login as string | null | undefined;
    const fullName = (data as any).full_name ?? (data as any).name ?? null;

    setProfile(data as unknown as UserProfile);
    setRole((data as any).role as UserRole);
    setWelcome({
      type: prevLastLogin ? "returning" : "first_time",
      fullName,
    });
    setLoading(false);
    setError(null);

    // Update last_login on every login (do once per page session).
    if (!didSetLoginRef.current) {
      didSetLoginRef.current = true;
      supabase
        .from("users")
        .update({
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", user.id)
        .then(() => {
          // keep UI snappy; no need to refetch
        });
    }
  };

  useEffect(() => {
    refresh();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, _session) => {
      // If user signs in/out, re-load profile
      refresh();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<SessionProfileState>(
    () => ({ loading, error, profile, role, welcome, refresh }),
    [loading, error, profile, role, welcome]
  );

  return <SessionProfileContext.Provider value={value}>{children}</SessionProfileContext.Provider>;
}

export function useSessionProfile() {
  const ctx = useContext(SessionProfileContext);
  if (!ctx) {
    throw new Error("useSessionProfile must be used within SessionProfileProvider");
  }
  return ctx;
}

