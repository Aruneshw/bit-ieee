"use client";

import { RoleLayoutShell } from "@/shared/components/layout/role-layout";

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayoutShell allowedRoles={["membership", "leadership"]}>{children}</RoleLayoutShell>;
}
