import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Check, RotateCcw, Trash2 } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { usePlatform } from "../../context/PlatformContext";
import { LoadingState, ErrorState } from "../../components/common/StateViews";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Icon from "../../components/ui/Icon";
import PageHeader from "../../components/ui/PageHeader";
import { FileDrop, Input } from "../../components/ui/Form";
import { ProgressBar } from "../../components/ui/Progress";
import { DEFAULT_PRIMARY, DEFAULT_SIDEBAR, brandVars, effectivePrimary, effectiveSidebar, normalizeHex } from "../../lib/theme";
import { uploadFile } from "../../lib/upload";
import api from "../../services/api";

const PRESETS = [
  { name: "ياقوت الأتيليه", primary: "#2350D8", sidebar: "#0B1533" },
  { name: "أخضر السبورة", primary: "#0F7B63", sidebar: "#12251F" },
  { name: "أزرق الحبر", primary: "#1F4FD1", sidebar: "#0F1B3D" },
  { name: "توت", primary: "#A4285F", sidebar: "#2A1220" },
  { name: "كهرمان", primary: "#B8620A", sidebar: "#2B1D10" },
  { name: "ياقوت", primary: "#B3261E", sidebar: "#2A1412" },
  { name: "بنفسجي", primary: "#6B46C1", sidebar: "#1C1530" },
  { name: "رمادي أردوازي", primary: "#334155", sidebar: "#0F172A" },
];

// Stored + editable, but only primary and sidebar restyle the app today.
const OTHER_COLORS = [["buttonColor", "لون الأزرار"], ["textColor", "لون النصوص"], ["backgroundColor", "لون الخلفية"]];

const isHex = (v) => /^#[0-9a-f]{6}$/i.test((v || "").trim());

function ColorField({ label, value, onChange }) {
  const valid = isHex(value);
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} (منتقي الألوان)`}
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-11 w-14 shrink-0 cursor-pointer rounded border border-line-field bg-raised p-1"
        />
        <input
          aria-label={`${label} (كود اللون)`}
          dir="ltr"
          className="input flex-1 num"
          value={value || ""}
          aria-invalid={!valid || undefined}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#2350D8"
        />
      </div>
      {!valid && <p className="field-error" role="alert">اكتب كود لون صحيح، مثال: #2350D8</p>}
    </div>
  );
}

/** A miniature of the real UI, drawn with the same tokens, scoped to the chosen colours. */
function LivePreview({ primary, sidebar, name, logoUrl }) {
  const vars = brandVars(primary, sidebar);
  return (
    <div className="brand-scope rounded-lg border border-line overflow-hidden bg-surface text-ink select-none" style={vars} aria-label="معاينة حيّة" role="img">
      <div className="flex h-72">
        <div className="w-28 shrink-0 bg-sidebar text-sidebar-ink p-3 space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-sidebar-line">
            {logoUrl ? <img src={logoUrl} alt="" className="w-7 h-7 rounded bg-white object-contain" /> : <span className="grid place-items-center w-7 h-7 rounded bg-primary text-primary-on text-xs font-bold font-display">{(name || "T").trim()[0]}</span>}
            <span className="text-[11px] font-bold truncate">{name || "المنصة"}</span>
          </div>
          {["الرئيسية", "الكورسات", "الواجبات"].map((l, i) => (
            <div key={l} className={`rounded px-2 py-1.5 text-[11px] font-semibold ${i === 0 ? "bg-sidebar-active text-sidebar-ink" : "text-sidebar-ink2"}`}>{l}</div>
          ))}
        </div>
        <div className="flex-1 min-w-0 p-4 space-y-3">
          <p className="font-display font-bold text-base">أهلاً يا أحمد</p>
          <div className="panel p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">واجب الوحدة الثانية</span>
              <span className="badge badge-primary !h-5 !text-[10px]">جديد</span>
            </div>
            <ProgressBar value={62} label="مثال على شريط تقدّم" />
          </div>
          <div className="flex gap-2">
            <span className="btn btn-primary btn-sm !min-h-8 !text-xs">زر أساسي</span>
            <span className="btn btn-soft btn-sm !min-h-8 !text-xs">زر ثانوي</span>
          </div>
          <p className="text-xs text-primary-ink font-semibold underline underline-offset-4">رابط بلون المنصة</p>
        </div>
      </div>
    </div>
  );
}

function ImageField({ label, hint, value, onChange }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  async function pick(file) {
    if (!file) return;
    setError("");
    try {
      setProgress(0);
      const res = await uploadFile("/teacher/upload/image", file, setProgress);
      onChange(res.data.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress(null);
    }
  }

  return (
    <div>
      <span className="label">{label}</span>
      {value ? (
        <div className="flex items-center gap-3 rounded border border-line bg-raised p-2.5">
          <img src={value} alt="" className="w-14 h-14 rounded object-cover bg-sunken" />
          <p className="flex-1 min-w-0 text-xs text-ink-3 truncate" dir="ltr">{value}</p>
          <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label={`إزالة ${label}`} className="!text-bad" onClick={() => onChange("")} />
        </div>
      ) : (
        <FileDrop kind="image" accept="image/*" hint={hint} file={null} onFile={pick} progress={progress} error={error} />
      )}
    </div>
  );
}

export default function AppearancePage() {
  const { data, loading, error, refetch } = useApi("/settings");
  const { refresh } = usePlatform();
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const lastPrimary = useRef(DEFAULT_PRIMARY);
  const lastSidebar = useRef(DEFAULT_SIDEBAR);

  useEffect(() => {
    if (data?.settings) {
      const s = data.settings;
      // old database defaults (indigo) mean "never customised" → show the new identity
      setForm({ ...s, primaryColor: effectivePrimary(s.primaryColor), sidebarColor: effectiveSidebar(s.sidebarColor) });
    }
  }, [data]);

  if (form) {
    if (isHex(form.primaryColor)) lastPrimary.current = form.primaryColor;
    if (isHex(form.sidebarColor)) lastSidebar.current = form.sidebarColor;
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const colorsValid = form && isHex(form.primaryColor) && isHex(form.sidebarColor) && OTHER_COLORS.every(([k]) => !form[k] || isHex(form[k]));

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put("/teacher/settings", form);
      toast.success("تم حفظ إعدادات المظهر");
      await refresh(); // re-applies colours + name app-wide, instantly
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if ((loading && !form) || (!form && !error)) return <LoadingState label="جارِ تحميل الإعدادات..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader title="تخصيص المنصة" description="غيّر الاسم والشعار والألوان، وشوف النتيجة قدامك قبل ما تحفظ." />

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-8 items-start">
        <div className="space-y-6 min-w-0">
          <section className="panel p-5 md:p-6 space-y-5">
            <h2 className="font-bold text-ink">الهوية</h2>
            <Input label="اسم المنصة" value={form.platformName || ""} onChange={(e) => set("platformName", e.target.value)} />
            <div className="grid sm:grid-cols-2 gap-5">
              <ImageField label="الشعار" hint="PNG أو JPG، يفضّل مربّع" value={form.logoUrl} onChange={(v) => set("logoUrl", v)} />
              <ImageField label="صورة صفحة الدخول" hint="بتظهر على الكمبيوتر فقط" value={form.heroImageUrl} onChange={(v) => set("heroImageUrl", v)} />
            </div>
            <Input label="معلومات التواصل (بريد)" dir="ltr" type="email" value={form.contactEmail || ""} onChange={(e) => set("contactEmail", e.target.value)} />
          </section>

          <section className="panel p-5 md:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-ink">الألوان</h2>
                <p className="text-sm text-ink-3 mt-0.5">باقي الدرجات ولون الكتابة على الأزرار بيتحسبوا تلقائيًا، عشان الكلام يفضل مقروء في الوضعين.</p>
              </div>
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setForm((f) => ({ ...f, primaryColor: DEFAULT_PRIMARY, sidebarColor: DEFAULT_SIDEBAR }))}>الافتراضي</Button>
            </div>

            <div role="group" aria-label="ألوان جاهزة">
              <span className="label">ألوان جاهزة</span>
              <div className="flex flex-wrap gap-2.5">
                {PRESETS.map((p) => {
                  const active = normalizeHex(form.primaryColor, "") === p.primary && normalizeHex(form.sidebarColor, "") === p.sidebar;
                  return (
                    <button key={p.name} type="button" aria-label={p.name} aria-pressed={active} title={p.name}
                      onClick={() => setForm((f) => ({ ...f, primaryColor: p.primary, sidebarColor: p.sidebar }))}
                      className={`relative w-12 h-12 rounded-full overflow-hidden border-2 transition-transform hover:scale-105 ${active ? "border-ink" : "border-line-strong"}`}>
                      <span className="absolute inset-y-0 start-0 w-1/2" style={{ background: p.sidebar }} />
                      <span className="absolute inset-y-0 end-0 w-1/2" style={{ background: p.primary }} />
                      {active && <span className="absolute inset-0 grid place-items-center text-white"><Icon icon={Check} size={20} className="drop-shadow" /></span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <ColorField label="اللون الأساسي" value={form.primaryColor} onChange={(v) => set("primaryColor", v)} />
              <ColorField label="لون القائمة الجانبية" value={form.sidebarColor} onChange={(v) => set("sidebarColor", v)} />
            </div>

            <details className="rounded border border-line">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-ink-2 min-h-[44px] flex items-center">ألوان إضافية <Badge className="ms-2">محفوظة فقط</Badge></summary>
              <div className="px-4 pb-4 pt-1 space-y-4">
                <p className="text-sm text-ink-3">الألوان دي بتتحفظ مع إعداداتك لكنها مش بتغيّر شكل المنصة حاليًا.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {OTHER_COLORS.map(([key, label]) => <ColorField key={key} label={label} value={form[key] || ""} onChange={(v) => set(key, v)} />)}
                </div>
              </div>
            </details>
          </section>

          <div className="flex items-center gap-3">
            <Button type="submit" size="lg" loading={submitting} disabled={!colorsValid}>{submitting ? "جارِ الحفظ..." : "حفظ الإعدادات"}</Button>
            {!colorsValid && <p className="text-sm text-bad">صحّح أكواد الألوان الأول.</p>}
          </div>
        </div>

        <aside className="lg:sticky lg:top-[calc(var(--topbar-h)+24px)] space-y-3" aria-label="معاينة">
          <h2 className="font-bold text-ink">معاينة حيّة</h2>
          <LivePreview primary={lastPrimary.current} sidebar={lastSidebar.current} name={form.platformName} logoUrl={form.logoUrl} />
          <p className="text-xs text-ink-3">المعاينة بتتبع الوضع الفاتح/الداكن الحالي. جرّب تبدّل الوضع من فوق.</p>
        </aside>
      </form>
    </>
  );
}
