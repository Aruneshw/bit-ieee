"use client";

import { RoleGuard } from "@/components/role-guard";
import Sidebar from "@/components/sidebar";
import type { UserRole } from "@/lib/types";
import { useRole } from "@/hooks/use-role";
import { Loader2 } from "lucide-react";

export function RoleLayoutShell({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}) {
  const { user, loading } = useRole();

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent-primary)" }} />
      </div>
    );
  }

  return (
    <RoleGuard role={allowedRoles}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar user={user} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </RoleGuard>
  );
}

