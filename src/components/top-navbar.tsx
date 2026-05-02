"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { getRoleLabel, getRoleColor, type UserRole, type UserProfile } from "@/lib/types";
import {
  LayoutDashboard, Users, UserPlus, Activity, Bell, CheckSquare,
  CalendarDays, FileText, Megaphone, LogOut, Table,
  Zap, Info, MessageSquare, BookOpen, ChevronDown,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
}

const adminNav: NavItem[] = [
  { href: "/admin/dashboard", icon: <LayoutDashboard className="w-4 h-4" />, label: "Dashboard" },
  { href: "/admin/calendar", icon: <CalendarDays className="w-4 h-4" />, label: "Calendar" },
  { href: "/admin/event-requests", icon: <CalendarDays className="w-4 h-4" />, label: "Requests" },
  { href: "/admin/events", icon: <BookOpen className="w-4 h-4" />, label: "Events" },
  { href: "/admin/posts", icon: <MessageSquare className="w-4 h-4" />, label: "Posts" },
  { href: "/admin/attendance", icon: <CheckSquare className="w-4 h-4" />, label: "Attendance" },
  { href: "/admin/society", icon: <Users className="w-4 h-4" />, label: "Society" },
  { href: "/admin/manage", icon: <UserPlus className="w-4 h-4" />, label: "Users" },
  { href: "/admin/notifications", icon: <Bell className="w-4 h-4" />, label: "Alerts" },
  { href: "/admin/tasks", icon: <CheckSquare className="w-4 h-4" />, label: "Tasks" },
  { href: "/admin/spreadsheets", icon: <Table className="w-4 h-4" />, label: "Sheets" },
  { href: "/admin/about-ieee", icon: <Info className="w-4 h-4" />, label: "About" },
];

const repNav: NavItem[] = [
  { href: "/rep/dashboard", icon: <LayoutDashboard className="w-4 h-4" />, label: "Dashboard" },
  { href: "/rep/calendar", icon: <CalendarDays className="w-4 h-4" />, label: "Calendar" },
  { href: "/rep/posts", icon: <Megaphone className="w-4 h-4" />, label: "Posts" },
  { href: "/rep/notifications", icon: <Bell className="w-4 h-4" />, label: "Alerts" },
  { href: "/rep/about-ieee", icon: <Info className="w-4 h-4" />, label: "About" },
];

const leadershipNav: NavItem[] = [
  { href: "/leadership/dashboard", icon: <LayoutDashboard className="w-4 h-4" />, label: "Dashboard" },
  { href: "/leadership/calendar", icon: <CalendarDays className="w-4 h-4" />, label: "Calendar" },
  { href: "/leadership/society", icon: <Users className="w-4 h-4" />, label: "Society" },
  { href: "/leadership/event", icon: <CalendarDays className="w-4 h-4" />, label: "Event" },
  { href: "/leadership/bookings", icon: <BookOpen className="w-4 h-4" />, label: "Bookings" },
  { href: "/leadership/update", icon: <FileText className="w-4 h-4" />, label: "Resume" },
  { href: "/leadership/task", icon: <CheckSquare className="w-4 h-4" />, label: "Task" },
  { href: "/leadership/about-ieee", icon: <Info className="w-4 h-4" />, label: "About" },
];

const memberNav: NavItem[] = [
  { href: "/member/dashboard", icon: <LayoutDashboard className="w-4 h-4" />, label: "Dashboard" },
  { href: "/member/calendar", icon: <CalendarDays className="w-4 h-4" />, label: "Calendar" },
  { href: "/member/activity", icon: <Activity className="w-4 h-4" />, label: "Activity" },
  { href: "/member/bookings", icon: <BookOpen className="w-4 h-4" />, label: "Bookings" },
  { href: "/member/my-bookings", icon: <CalendarDays className="w-4 h-4" />, label: "My Bookings" },
  { href: "/member/attendance", icon: <CheckSquare className="w-4 h-4" />, label: "Attendance" },
  { href: "/member/society", icon: <Users className="w-4 h-4" />, label: "Society" },
  { href: "/member/task", icon: <CheckSquare className="w-4 h-4" />, label: "Task" },
  { href: "/member/about-ieee", icon: <Info className="w-4 h-4" />, label: "About" },
];

function getNavItems(role: UserRole): NavItem[] {
  switch (role) {
    case "admin_primary": return adminNav;
    case "student_rep": return repNav;
    case "leadership":
    case "event_manager": return leadershipNav;
    case "membership": return memberNav;
    default: return memberNav;
  }
}

export default function TopNavbar({ user }: { user: UserProfile }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [unreadCount, setUnreadCount] = useState(0);

  const navItems = getNavItems(user.role);

  useEffect(() => {
    async function fetchUnread() {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false)
        .or(`recipient_id.eq.${user.id},society_id.eq.${user.society_id},recipient_role.eq.${user.role}`);
      setUnreadCount(count || 0);
    }
    fetchUnread();

    const channel = supabase
      .channel("notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
      }, () => {
        fetchUnread();
        toast.info("New notification received");
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user.id, user.society_id, user.role]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="sticky top-0 z-50 bg-[#00629B] shadow-lg px-4 md:px-8">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between h-16">
        {/* Left: Logo Section (Google Style) */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-white flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#00629B]" />
          </div>
          <div className="h-5 w-px bg-white/20 mx-1 hidden sm:block" />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold text-white tracking-wide">BIT IEEE HUB</span>
            <span className="text-[10px] text-blue-200 uppercase tracking-tighter">
              {getRoleLabel(user.role)}
            </span>
          </div>
        </div>

        {/* Center: Horizontal Navigation Tabs */}
        <div className="hidden lg:flex items-center gap-1 flex-1 justify-center px-8 overflow-visible">
          {navItems.slice(0, 7).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                  isActive 
                    ? "bg-white/15 text-white shadow-sm" 
                    : "text-blue-100 hover:bg-white/5 hover:text-white"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.label === "Alerts" && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}

          {/* "More" Dropdown for remaining items */}
          {navItems.length > 7 && (
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-blue-100 hover:bg-white/5 hover:text-white transition-all whitespace-nowrap">
                <span>More</span>
                <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180" />
              </button>
              
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-left scale-95 group-hover:scale-100 z-[60]">
                {navItems.slice(7).map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                        isActive 
                          ? "bg-blue-50 text-[#00629B] font-semibold" 
                          : "text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <span className={cn(isActive ? "text-[#00629B]" : "text-gray-400")}>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: User Profile & Logout */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-white max-w-[120px] truncate">
                {user.name || "Member"}
              </p>
              <p className="text-[9px] text-blue-200 truncate">{user.email}</p>
            </div>
            <div className="relative group">
              <button className="w-9 h-9 rounded-full bg-white text-[#00629B] flex items-center justify-center text-sm font-bold shadow-md border-2 border-white/20 transition-transform group-hover:scale-105">
                {(user.name || user.email)?.[0]?.toUpperCase() || "?"}
              </button>
              
              {/* Dropdown placeholder or direct action */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right scale-95 group-hover:scale-100">
                <Link 
                  href={`/${user.role === 'admin_primary' ? 'admin' : user.role === 'student_rep' ? 'rep' : user.role === 'leadership' ? 'leadership' : 'member'}/update`}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Activity className="w-4 h-4" /> Edit Profile
                </Link>
                <div className="h-px bg-gray-100 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Bar (Scrollable) */}
      <div className="lg:hidden flex items-center gap-2 py-2 overflow-x-auto no-scrollbar border-t border-white/10">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-medium transition-all shrink-0",
                isActive ? "text-white" : "text-blue-200"
              )}
            >
              {item.icon}
              <span className="truncate max-w-[60px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
