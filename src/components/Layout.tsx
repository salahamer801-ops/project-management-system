import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  FolderKanban,
  History,
  KanbanSquare,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { cn } from "./ui";
import { ROLES } from "../lib/constants";
import { initials } from "../lib/format";

const NAV = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard, roles: null },
  { to: "/projects", label: "المشاريع", icon: FolderKanban, roles: null },
  { to: "/tasks", label: "المهام", icon: ListTodo, roles: null },
  { to: "/kanban", label: "لوحة كانبان", icon: KanbanSquare, roles: null },
  { to: "/calendar", label: "التقويم", icon: CalendarDays, roles: null },
  { to: "/expenses", label: "المصروفات", icon: Wallet, roles: null },
  { to: "/meetings", label: "الاجتماعات", icon: ClipboardList, roles: null },
  { to: "/reports", label: "التقارير", icon: BarChart3, roles: null },
  { to: "/notifications", label: "الإشعارات", icon: Bell, roles: null },
  { to: "/users", label: "المستخدمون", icon: Users, roles: ["system_admin"] },
  { to: "/activity", label: "سجل الأنشطة", icon: History, roles: ["system_admin"] },
  { to: "/settings", label: "الإعدادات", icon: Settings, roles: null },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await api<{ unread: number }>("/notifications");
        if (active) setUnread(res.data.unread);
      } catch {
        /* ignore */
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const nav = NAV.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-extrabold text-white">إدارة المشاريع</div>
            <div className="text-[11px] text-slate-400">Project Management</div>
          </div>
        </div>
        <button className="lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="إغلاق القائمة">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                isActive ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )
            }
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
            {item.to === "/notifications" && unread > 0 && (
              <span className="mr-auto rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white">
            {initials(user?.name)}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-bold text-white">{user?.name}</div>
            <div className="truncate text-[11px] text-slate-400">{user ? ROLES[user.role] : ""}</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 right-0 w-72">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:mr-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="فتح القائمة">
              <Menu className="h-6 w-6 text-slate-600" />
            </button>
            <h2 className="hidden text-sm font-bold text-slate-600 sm:block">
              نظام إدارة المشاريع للمؤسسة
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate("/notifications")}
              aria-label="الإشعارات"
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -left-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                  {initials(user?.name)}
                </div>
              </button>
              {menuOpen && (
                <div className="absolute left-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="text-sm font-bold text-slate-800">{user?.name}</div>
                    <div className="text-xs text-slate-500">{user?.email}</div>
                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {user ? ROLES[user.role] : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate("/settings")}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <Settings className="h-4 w-4" /> الإعدادات
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      navigate("/login");
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" /> تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
