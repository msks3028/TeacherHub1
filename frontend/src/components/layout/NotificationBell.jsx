import { useLocation, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import Icon from "../ui/Icon";
import Menu from "../ui/Menu";
import Button from "../ui/Button";
import { useApi } from "../../hooks/useApi";
import { fmtDateTime } from "../../lib/format";
import api from "../../services/api";

export default function NotificationBell({ role }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data, refetch } = useApi("/notifications", { deps: [pathname] });
  const unread = data?.unreadCount || 0;
  const page = role === "TEACHER" ? "/teacher/notifications" : "/student/notifications";
  const latest = (data?.notifications || []).slice(0, 5);

  async function open(n) {
    if (!n.isRead) {
      try { await api.patch(`/notifications/${n.id}/read`); refetch(); } catch { /* non-critical */ }
    }
    navigate(page);
  }

  const items = [
    ...latest.map((n) => ({
      key: n.id,
      label: n.title,
      onClick: () => open(n),
      content: (
        <span className="flex items-start gap-2.5 py-2 min-w-0">
          <span className={`mt-2 w-2 h-2 rounded-full shrink-0 ${n.isRead ? "bg-transparent" : "bg-bad-solid"}`} aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink truncate">{n.title}</span>
            <span className="block text-xs text-ink-3">{fmtDateTime(n.createdAt)}</span>
          </span>
        </span>
      ),
    })),
    { key: "all", label: "عرض كل الإشعارات", onClick: () => navigate(page), separatorBefore: latest.length > 0 },
  ];

  return (
    <Menu
      width={340}
      items={items}
      header={<p className="px-3 pt-2 pb-1.5 text-sm font-bold text-ink">الإشعارات{latest.length === 0 && <span className="block text-xs font-normal text-ink-3 mt-1">مفيش إشعارات جديدة.</span>}</p>}
      trigger={(p) => (
        <Button {...p} variant="ghost" iconOnly icon={undefined} aria-label={unread > 0 ? `الإشعارات، ${unread} غير مقروء` : "الإشعارات"} className="relative">
          <Icon icon={Bell} size={20} className={unread > 0 ? "bell-ring" : ""} />
          {unread > 0 && <span className="absolute top-2.5 end-2.5 w-2.5 h-2.5 rounded-full bg-bad-solid ring-2 ring-[var(--surface)]" aria-hidden="true" />}
        </Button>
      )}
    />
  );
}
