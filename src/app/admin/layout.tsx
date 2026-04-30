"use client";

import { RoleLayoutShell } from "@/components/role-layout";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayoutShell allowedRoles={["admin_primary"]}>{children}</RoleLayoutShell>;
}
