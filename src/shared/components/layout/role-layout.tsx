"use client";

import { RoleGuard } from "@/modules/auth/components/RoleGuard";
import TopNavbar from "@/shared/components/layout/top-navbar";
import type { UserRole } from "@/core/types";
import { useRole } from "@/modules/auth/hooks/use-role";
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#00629B]" />
      </div>
    );
  }

  return (
    <RoleGuard role={allowedRoles}>
      <div className="min-h-screen flex flex-col bg-gray-50/50">
        <TopNavbar user={user} />
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-[1600px] mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </RoleGuard>
  );
}

