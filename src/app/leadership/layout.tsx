"use client";

import { RoleLayoutShell } from "@/components/role-layout";

export default function LeadershipLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayoutShell allowedRoles={["leadership", "event_manager"]}>{children}</RoleLayoutShell>;
}
