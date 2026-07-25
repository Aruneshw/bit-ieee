"use client";

import { useRole } from "@/modules/auth/hooks/use-role";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { UserRole } from "@/core/types";
import { getRoleDashboardPath } from "@/core/types";
import { ShieldAlert, Loader2 } from "lucide-react";

interface RoleGuardProps {
  /** Allowed roles. If current user's role is not in this list, they're redirected. */
  role: UserRole[];
  children: React.ReactNode;
  /** Optional fallback during loading */
  fallback?: React.ReactNode;
}

/**
 * Client component that wraps children in a role check.
 * Redirects the user to their own dashboard if their role is not in the allowed list.
 */
export function RoleGuard({ role: allowedRoles, children, fallback }: RoleGuardProps) {
  const { role, loading, error } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (error || !role) {
      router.replace("/login");
      return;
    }

    if (!allowedRoles.includes(role)) {
      router.replace(getRoleDashboardPath(role));
    }
  }, [role, loading, error, allowedRoles, router]);

  if (loading) {
    return fallback || (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#00bfff] animate-spin" />
      </div>
    );
  }

  if (error || !role) return null;

  if (!allowedRoles.includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
        <ShieldAlert className="w-16 h-16 text-red-400 mb-4 opacity-80" />
        <h2 className="text-2xl font-bold text-red-400">Access Denied</h2>
        <p className="mt-2 text-gray-400">Redirecting to your dashboard...</p>
      </div>
    );
  }

  return <>{children}</>;
}
