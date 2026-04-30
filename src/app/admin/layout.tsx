import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import type { UserProfile } from "@/lib/types";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("email", user.email.toLowerCase())
    .single();

  if (!profile || !["admin_primary", "admin_secondary"].includes(profile.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={profile as UserProfile} />
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
