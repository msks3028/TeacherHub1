import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ChevronsLeft, ChevronsRight, LogOut, Moon, MoreHorizontal, Search, Sun, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { usePlatform } from "../../context/PlatformContext";
import Icon, { ChevronForward } from "../ui/Icon";
import Button from "../ui/Button";
import Avatar from "../ui/Avatar";
import Modal from "../ui/Modal";
import Menu from "../ui/Menu";
import { Toggle } from "../ui/Form";
import PlatformMark from "./PlatformMark";
import SearchBox from "./SearchBox";
import NotificationBell from "./NotificationBell";
import { STUDENT_NAV, TEACHER_NAV, TONE_CLS } from "./nav";

const COLLAPSE_KEY = "th-sidebar-collapsed";
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; } };

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" iconOnly onClick={toggle} aria-label={theme === "dark" ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن"}>
      <Icon icon={theme === "dark" ? Sun : Moon} size={20} />
    </Button>
  );
}

export default function DashboardLayout({ role }) {
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { name: platformName } = usePlatform();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const nav = role === "TEACHER" ? TEACHER_NAV : STUDENT_NAV;
  const displayName = user?.profile?.fullName || user?.email || "";
  const profilePath = role === "TEACHER" ? "/teacher/profile" : "/student/profile";

  useEffect(() => { setMoreOpen(false); setSearchOpen(false); }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch { /* not persisted */ }
      return !c;
    });
  }

  async function handleLogout() {
    const result = await logout();
    if (!result.ok) toast.error("تم تسجيل الخروج من هذا الجهاز، لكن تعذر تأكيد إنهاء الجلسة على الخادم.");
  }

  // Page title / breadcrumb from the current route
  const crumbs = useMemo(() => {
    const match = [...nav].sort((a, b) => b.to.length - a.to.length).find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
    if (!match) return [];
    const deeper = pathname.replace(/\/$/, "") !== match.to;
    return deeper ? [{ label: match.label, to: match.to }, { label: "التفاصيل" }] : [{ label: match.label }];
  }, [nav, pathname]);

  const tabItems = nav.filter((n) => n.tab);
  const moreItems = nav.filter((n) => !n.tab);
  const groups = [
    { id: "content", title: "المحتوى", items: nav.filter((n) => n.group === "content") },
    { id: "account", title: "الحساب", items: nav.filter((n) => n.group === "account") },
  ];
  const moreActive = moreItems.some((n) => pathname.startsWith(n.to));

  const userMenu = [
    { label: "الملف الشخصي", icon: User, onClick: () => navigate(profilePath) },
    { label: "تسجيل الخروج", icon: LogOut, danger: true, separatorBefore: true, onClick: handleLogout },
  ];

  return (
    <div className="min-h-screen bg-surface flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[100] focus:bg-raised focus:text-ink focus:px-4 focus:py-2 focus:rounded focus:shadow-3">
        تخطّي إلى المحتوى
      </a>

      {/* ------------------------------------------------ sidebar (desktop) */}
      <aside
        className={`hidden lg:flex sticky top-3 m-3 h-[calc(100vh-1.5rem)] shrink-0 flex-col overflow-hidden rounded-xl bg-sidebar text-sidebar-ink shadow-3 transition-[width] duration-200 ease-out ${collapsed ? "w-[84px]" : "w-[264px]"}`}
        aria-label="القائمة الرئيسية"
        style={{ "--ring": "var(--sb-ink)" }}
      >
        <div className={`flex items-center h-[var(--topbar-h)] shrink-0 border-b border-sidebar-line ${collapsed ? "justify-center" : "justify-between ps-5 pe-3"}`}>
          {collapsed ? <PlatformMark size={38} showName={false} /> : <PlatformMark size={38} nameClass="text-lg text-sidebar-ink" />}
          {!collapsed && (
            <button type="button" onClick={toggleCollapsed} aria-label="طيّ القائمة" className="w-9 h-9 grid place-items-center rounded text-sidebar-ink2 hover:bg-sidebar-hover hover:text-sidebar-ink transition-colors">
              <Icon icon={ChevronsRight} size={20} />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {groups.map((g) => (
            <div key={g.id}>
              {collapsed ? <div className="mx-3 mb-2 border-t border-sidebar-line" /> : <p className="px-3 mb-2 text-xs font-semibold text-sidebar-ink2">{g.title}</p>}
              <ul className="space-y-1.5">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      title={collapsed ? item.label : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `relative flex items-center gap-3 min-h-[54px] rounded-2xl text-sm transition-colors ${collapsed ? "justify-center" : "ps-2.5 pe-3"} ${
                          isActive ? "bg-sidebar-active text-sidebar-ink font-bold" : "text-sidebar-ink2 font-semibold hover:bg-sidebar-hover hover:text-sidebar-ink"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span className="nav-mark" aria-hidden="true" />}
                          <span className={`ct ct-sm nav-tile ${TONE_CLS[item.tone] || "ct-neutral"} ${isActive ? "nav-tile-on" : ""}`} aria-hidden="true"><Icon icon={item.icon} size={18} /></span>
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-line space-y-2">
          {collapsed && (
            <button type="button" onClick={toggleCollapsed} aria-label="توسيع القائمة" className="w-full min-h-[44px] grid place-items-center rounded text-sidebar-ink2 hover:bg-sidebar-hover hover:text-sidebar-ink transition-colors">
              <Icon icon={ChevronsLeft} size={20} />
            </button>
          )}
          <Link
            to={profilePath}
            title={collapsed ? displayName : undefined}
            aria-label={collapsed ? displayName : undefined}
            className={`flex items-center gap-3 rounded-2xl bg-sidebar-hover p-2 transition-colors hover:bg-sidebar-active ${collapsed ? "justify-center" : ""}`}
          >
            <Avatar name={displayName} src={user?.profile?.avatarUrl} size="sm" />
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-sidebar-ink">{displayName}</span>
                <span className="block text-xs text-sidebar-ink2">{role === "TEACHER" ? "مدرس" : "طالب"}</span>
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? "تسجيل الخروج" : undefined}
            aria-label={collapsed ? "تسجيل الخروج" : undefined}
            className={`w-full flex items-center gap-3 min-h-[44px] rounded text-sm font-semibold text-sidebar-ink2 hover:bg-sidebar-hover hover:text-sidebar-ink transition-colors ${collapsed ? "justify-center" : "px-3.5"}`}
          >
            <Icon icon={LogOut} size={20} className="shrink-0" />
            {!collapsed && "تسجيل الخروج"}
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------- main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-[var(--topbar-h)] bg-surface border-b border-line flex items-center gap-2 px-3 md:px-6 safe-t box-content">
          {/* phones: identity on the start side */}
          <Link to={role === "TEACHER" ? "/teacher" : "/student"} className="lg:hidden min-w-0 flex-1 text-ink" aria-label={platformName}>
            <PlatformMark size={34} nameClass="text-base" />
          </Link>

          {/* desktop: breadcrumb + search */}
          <nav aria-label="مسار الصفحة" className="hidden lg:flex items-center gap-2 text-sm min-w-0">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-2 min-w-0">
                {i > 0 && <Icon icon={ChevronForward} size={16} className="text-ink-3 shrink-0" />}
                {c.to ? <Link to={c.to} className="text-ink-3 hover:text-ink transition-colors">{c.label}</Link> : <span className="font-bold text-ink truncate" aria-current="page">{c.label}</span>}
              </span>
            ))}
          </nav>
          <div className="hidden lg:block flex-1 max-w-md mx-auto w-full">
            <SearchBox role={role} />
          </div>

          <div className="flex items-center gap-1 ms-auto">
            <Button variant="ghost" iconOnly onClick={() => setSearchOpen(true)} aria-label="بحث" className="lg:hidden">
              <Icon icon={Search} size={20} />
            </Button>
            <ThemeToggle />
            <NotificationBell role={role} />
            <div className="hidden lg:block ms-1">
              <Menu
                width={240}
                items={userMenu}
                header={
                  <div className="flex items-center gap-3 px-3 py-2.5 border-b border-line mb-1.5">
                    <Avatar name={displayName} src={user?.profile?.avatarUrl} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink truncate">{displayName}</p>
                      <p className="text-xs text-ink-3 truncate" dir="ltr">{user?.email}</p>
                    </div>
                  </div>
                }
                trigger={(p) => (
                  <button {...p} type="button" aria-label="قائمة المستخدم" className="flex items-center gap-2.5 min-h-[44px] ps-1 pe-3 rounded-full hover:bg-sunken transition-colors">
                    <Avatar name={displayName} src={user?.profile?.avatarUrl} size="sm" />
                    <span className="text-sm font-semibold text-ink max-w-[140px] truncate">{displayName}</span>
                  </button>
                )}
              />
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 min-w-0" tabIndex={-1}>
          <div key={pathname} className="anim-rise mx-auto w-full max-w-page px-4 md:px-8 pt-6 md:pt-8 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+44px)] lg:pb-12">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ------------------------------------------- bottom tab bar (phones) */}
      <nav aria-label="التنقل السريع" className="lg:hidden fixed inset-x-3 z-40 rounded-xl bg-raised border border-line shadow-3" style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
        <ul className="grid grid-cols-5 h-[var(--tabbar-h)]">
          {tabItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className="h-full flex flex-col items-center justify-center gap-1 text-[11px] font-semibold">
                {({ isActive }) => (
                  <>
                    <span className={`grid place-items-center w-14 h-8 rounded-full transition-colors ${isActive ? "bg-primary-soft text-primary-ink pill-on" : "text-ink-3"}`}>
                      <Icon icon={item.icon} size={24} />
                    </span>
                    <span className={isActive ? "text-primary-ink" : "text-ink-3"}>{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className="h-full w-full flex flex-col items-center justify-center gap-1 text-[11px] font-semibold">
              <span className={`grid place-items-center w-14 h-8 rounded-full transition-colors ${moreActive ? "bg-primary-soft text-primary-ink pill-on" : "text-ink-3"}`}>
                <Icon icon={MoreHorizontal} size={24} />
              </span>
              <span className={moreActive ? "text-primary-ink" : "text-ink-3"}>المزيد</span>
            </button>
          </li>
        </ul>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="المزيد">
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-line">
          <Avatar name={displayName} src={user?.profile?.avatarUrl} />
          <div className="min-w-0">
            <p className="font-bold text-ink truncate">{displayName}</p>
            <p className="text-xs text-ink-3 truncate" dir="ltr">{user?.email}</p>
          </div>
        </div>
        <ul className="grid grid-cols-3 gap-2">
          {moreItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} className={({ isActive }) => `flex flex-col items-center gap-2 p-3 rounded text-center text-xs font-semibold min-h-[88px] justify-center transition-colors ${isActive ? "bg-primary-soft text-primary-ink" : "bg-sunken text-ink hover:bg-primary-soft"}`}>
                <span className={`ct ${TONE_CLS[item.tone] || "ct-neutral"}`}><Icon icon={item.icon} size={22} /></span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-2 border-t border-line">
          <Toggle checked={theme === "dark"} onChange={toggleTheme} label="الوضع الداكن" description="مريح للعين في الإضاءة المنخفضة" />
        </div>
        <Button variant="danger" icon={LogOut} onClick={handleLogout} className="w-full mt-3">تسجيل الخروج</Button>
      </Modal>

      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="بحث">
        <div className="min-h-[50dvh]">
          <SearchBox role={role} autoFocus onNavigate={() => setSearchOpen(false)} />
        </div>
      </Modal>
    </div>
  );
}
