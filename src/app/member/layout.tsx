"use client";

import { RoleLayoutShell } from "@/components/role-layout";

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayoutShell allowedRoles={["membership", "leadership"]}>{children}</RoleLayoutShell>;
}
