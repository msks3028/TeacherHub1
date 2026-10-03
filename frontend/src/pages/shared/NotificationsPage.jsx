import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Bell, CheckCheck, ChevronDown, ChevronUp } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import Button from "../../components/ui/Button";
import PageHeader from "../../components/ui/PageHeader";
import ContentIcon from "../../components/ui/ContentIcon";
import api from "../../services/api";
import { fmtDate, fmtDateTime } from "../../lib/format";

const CATEGORY_LABELS = {
  HOMEWORK: "الواجبات", EXAMS: "الاختبارات", MATERIALS: "الملفات التعليمية", VIDEOS: "الفيديوهات",
  ANNOUNCEMENTS: "الإعلانات", LIVE_CLASSES: "الحصص المباشرة", SECURITY: "الأمان",
};
const TYPE_LABELS = {
  VIDEO_ADDED: "فيديو جديد", HOMEWORK_ADDED: "واجب جديد", EXAM_ADDED: "اختبار جديد", MATERIAL_ADDED: "ملف جديد",
  ANNOUNCEMENT: "إعلان", HOMEWORK_GRADED: "تم تصحيح واجب", EXAM_GRADED: "ظهرت نتيجة اختبار",
  HOMEWORK_SUBMITTED: "تسليم واجب", EXAM_COMPLETED: "اكتمال اختبار", NEEDS_GRADING: "يحتاج تصحيح",
};
const TYPE_ICON = {
  VIDEO_ADDED: "video", HOMEWORK_ADDED: "homework", HOMEWORK_GRADED: "homework", HOMEWORK_SUBMITTED: "homework", NEEDS_GRADING: "homework",
  EXAM_ADDED: "exam", EXAM_GRADED: "exam", EXAM_COMPLETED: "exam", MATERIAL_ADDED: "file", ANNOUNCEMENT: "note",
};

function dayLabel(iso) {
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(new Date()) - startOf(new Date(iso))) / 86400000);
  if (diff <= 0) return "اليوم";
  if (diff === 1) return "امبارح";
  return fmtDate(iso);
}

function safeInternalLink(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export default function NotificationsPage() {
  const [revision, setRevision] = useState(0);
  const since = new Date(Date.now() - 60_000).toISOString();
  const notificationUrl = `/notifications?limit=20${revision ? `&since=${encodeURIComponent(since)}` : ""}`;
  const { data, loading, error, refetch } = useApi(notificationUrl, { deps: [revision] });
  const { data: preferenceData, refetch: refetchPreferences } = useApi("/notifications/preferences");
  const [older, setOlder] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingPreference, setSavingPreference] = useState(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [catchingUp, setCatchingUp] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const notifications = [...(data?.notifications || []), ...older];

  useEffect(() => {
    const refreshOnReconnect = () => {
      setOnline(true);
      setCatchingUp(true);
      setRevision((value) => value + 1);
      setOlder([]);
      window.setTimeout(() => setCatchingUp(false), 1200);
    };
    const offline = () => setOnline(false);
    window.addEventListener("online", refreshOnReconnect);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", refreshOnReconnect);
      window.removeEventListener("offline", offline);
    };
  }, [refetch]);

  async function loadMore() {
    if (!data?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data: page } = await api.get(`/notifications?limit=20&cursor=${encodeURIComponent(data.nextCursor)}`);
      setOlder((current) => [...current, ...page.notifications]);
    } catch (err) { toast.error(err.message); }
    finally { setLoadingMore(false); }
  }

  async function markRead(id) {
    try { await api.patch(`/notifications/${id}/read`); setOlder([]); refetch(); }
    catch (err) { toast.error(err.message); }
  }

  async function markUnread(id) {
    try { await api.patch(`/notifications/${id}/unread`); setOlder([]); refetch(); }
    catch (err) { toast.error(err.message); }
  }

  async function markAllRead() {
    try { await api.patch("/notifications/read-all"); setOlder([]); refetch(); }
    catch (err) { toast.error(err.message); }
  }

  async function updatePreference(category, key, value) {
    const current = preferenceData?.preferences?.find((item) => item.category === category);
    if (!current || category === "SECURITY") return;
    const updated = { ...current, [key]: value };
    setSavingPreference(`${category}:${key}`);
    try {
      await api.put("/notifications/preferences", { preferences: { [category]: updated } });
      await refetchPreferences();
      toast.success("تم حفظ تفضيل الإشعارات.");
    } catch (err) { toast.error(err.message); }
    finally { setSavingPreference(null); }
  }

  if (loading) return <LoadingState variant="list" label="جارِ تحميل الإشعارات..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  const hasNotifications = notifications.length > 0;
  const categories = [...new Set(notifications.map((n) => n.category).filter(Boolean))];
  const visible = filter === "ALL" ? notifications : notifications.filter((n) => n.category === filter);
  const groups = [];
  visible.forEach((n) => {
    const label = dayLabel(n.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  });

  return (
    <>
      <PageHeader
        title="الإشعارات"
        description={!online ? "أنت غير متصل. قد تكون قائمة الإشعارات قديمة حتى يعود الاتصال." : catchingUp ? "عاد الاتصال. جارِ جلب الإشعارات الجديدة…" : data.unreadCount > 0 ? `عندك ${data.unreadCount} إشعار غير مقروء.` : "متابع كل جديد."}
        actions={data.unreadCount > 0 && <Button variant="secondary" icon={CheckCheck} onClick={markAllRead}>تعليم الكل كمقروء</Button>}
      />

      <section className="panel max-w-3xl mb-4 overflow-hidden">
        <button type="button" className="min-h-[48px] w-full flex items-center justify-between gap-3 px-4 py-3 text-start" aria-expanded={preferencesOpen} onClick={() => setPreferencesOpen((value) => !value)}>
          <span className="inline-flex items-center gap-2 font-semibold text-ink"><Bell size={18} aria-hidden="true" /> تفضيلات الإشعارات</span>
          {preferencesOpen ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        </button>
        {preferencesOpen && <div className="border-t border-line p-3 sm:p-4 grid sm:grid-cols-2 gap-3">
          {(preferenceData?.preferences || []).map((pref) => <fieldset key={pref.category} className="rounded-2xl bg-sunken p-4">
            <legend className="px-1 font-bold text-ink">{CATEGORY_LABELS[pref.category] || pref.category}</legend>
            {pref.category === "SECURITY" && <p className="text-xs text-ink-3 mb-1">إشعارات الأمان إلزامية</p>}
            {["inAppEnabled", "pushEnabled"].map((key) => <label key={key} className="flex min-h-[44px] items-center gap-3 text-sm text-ink-2">
              <input type="checkbox" className="check" aria-label={`${CATEGORY_LABELS[pref.category]} — ${key === "inAppEnabled" ? "داخل التطبيق" : "إشعار الجهاز"}`} checked={pref[key]} disabled={pref.category === "SECURITY" || savingPreference === `${pref.category}:${key}`} onChange={(event) => updatePreference(pref.category, key, event.target.checked)} />
              {key === "inAppEnabled" ? "داخل التطبيق" : "إشعار الجهاز"}
            </label>)}
          </fieldset>)}
        </div>}
      </section>

      {!hasNotifications ? <EmptyState illustration="inbox" title="مفيش إشعارات" message="لا يوجد إشعارات بعد." /> : (
        <div className="max-w-3xl space-y-6">
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="تصفية الإشعارات">
              {[["ALL", "الكل"], ...categories.map((c) => [c, CATEGORY_LABELS[c] || c])].map(([key, label]) => (
                <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}
                  className={`min-h-[40px] rounded-full px-4 text-sm font-bold transition-colors ${filter === key ? "bg-primary text-primary-on" : "bg-sunken text-ink-2 hover:bg-primary-soft"}`}>{label}</button>
              ))}
            </div>
          )}
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="mb-2.5 text-sm font-bold text-ink-2">{g.label}</h2>
              <ul className="space-y-2.5 stagger">
                {g.items.map((n) => {
                  const link = safeInternalLink(n.link);
                  const title = <span className={`block mt-0.5 text-ink ${n.isRead ? "font-medium" : "font-bold"}`}>{n.title}</span>;
                  return <li key={n.id} className={`relative flex items-start gap-3.5 rounded-2xl border p-4 transition-colors ${n.isRead ? "border-line bg-surface" : "border-transparent bg-primary-soft"}`}>
                    <ContentIcon type={TYPE_ICON[n.type] || "note"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><span className="text-xs font-semibold text-ink-3">{CATEGORY_LABELS[n.category] || TYPE_LABELS[n.type] || n.type}</span>{!n.isRead && <span className="w-2 h-2 rounded-full bg-bad-solid" aria-label="غير مقروء" />}</div>
                      {link ? <Link to={link} onClick={() => !n.isRead && markRead(n.id)} className="block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">{title}</Link> : <button type="button" className="text-start" onClick={() => !n.isRead && markRead(n.id)}>{title}</button>}
                      {n.body && <p className="text-sm text-ink-2 mt-0.5">{n.body}</p>}
                      <time className="block text-xs text-ink-3 mt-1.5 num" dateTime={n.createdAt}>{fmtDateTime(n.createdAt)}</time>
                    </div>
                    <Button size="sm" variant="ghost" className="shrink-0 min-w-[44px]" onClick={() => n.isRead ? markUnread(n.id) : markRead(n.id)} aria-label={n.isRead ? "تعليم كغير مقروء" : "تعليم كمقروء"}>{n.isRead ? "غير مقروء" : "مقروء"}</Button>
                  </li>;
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {data.nextCursor && <div className="max-w-3xl mt-4 flex justify-center"><Button variant="secondary" loading={loadingMore} onClick={loadMore}>تحميل إشعارات أقدم</Button></div>}
    </>
  );
}
