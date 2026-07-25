"use client";

import { RoleLayoutShell } from "@/shared/components/layout/role-layout";

export default function RepLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayoutShell allowedRoles={["student_rep"]}>{children}</RoleLayoutShell>;
}
