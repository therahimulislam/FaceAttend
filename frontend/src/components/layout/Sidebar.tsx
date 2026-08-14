/**
 * FaceAttend — Sidebar Navigation
 * Role-aware navigation: shows relevant links per user role.
 */
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  CheckSquare,
  BarChart3,
  Settings,
  LogOut,
  Scan,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { UserRole } from "@/types";

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  // Admin / Faculty shared
  { label: "Dashboard",    to: "/admin/dashboard",   icon: LayoutDashboard, roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN"] },
  { label: "Students",     to: "/admin/students",    icon: GraduationCap,   roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN"] },
  { label: "Faculty",      to: "/admin/faculty",     icon: Users,           roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN"] },
  { label: "Departments",  to: "/admin/departments", icon: BookOpen,        roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN"] },
  { label: "Subjects",     to: "/admin/subjects",    icon: GraduationCap,   roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN"] },
  { label: "Rooms",        to: "/admin/rooms",       icon: BarChart3,       roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN"] },
  { label: "Timetable",    to: "/admin/timetable",   icon: Calendar,        roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "FACULTY"] },
  { label: "Attendance",   to: "/faculty/attendance", icon: CheckSquare,   roles: ["FACULTY"] },
  { label: "Reports",      to: "/admin/reports",     icon: BarChart3,       roles: ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "FACULTY"] },

  // Student
  { label: "Dashboard",    to: "/student/dashboard", icon: LayoutDashboard, roles: ["STUDENT"] },
  { label: "My Attendance",to: "/student/attendance",icon: CheckSquare,     roles: ["STUDENT"] },
  { label: "Face Enroll",  to: "/student/face-enroll",icon: Scan,          roles: ["STUDENT"] },
];

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  const filteredItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "FA";

  const roleBadge: Record<UserRole, string> = {
    STUDENT: "Student",
    FACULTY: "Faculty",
    DEPARTMENT_ADMIN: "Dept Admin",
    SUPER_ADMIN: "Super Admin",
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-900/80 border-r border-white/5 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center">
            <Scan size={14} className="text-white" />
          </div>
          <span className="text-white font-bold tracking-tight">FaceAttend</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-auto">
        {filteredItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={16}
                  className={cn(
                    "flex-shrink-0 transition-colors",
                    isActive ? "text-white" : "text-slate-500 group-hover:text-white"
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight size={12} className="text-slate-400" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer: user card + logout */}
      <div className="px-3 py-4 border-t border-white/5 space-y-2">
        {/* User info */}
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-white/10 text-white text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.email}</p>
            <p className="text-slate-500 text-xs">{user ? roleBadge[user.role] : ""}</p>
          </div>
        </div>

        {/* Settings + Logout */}
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
        >
          <Settings size={15} />
          <span>Settings</span>
        </NavLink>
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={15} />
          <span>{logout.isPending ? "Signing out…" : "Sign out"}</span>
        </button>
      </div>
    </aside>
  );
}
