import { useState } from "react";
import toast from "react-hot-toast";
import { GraduationCap, Layers, Plus, Trash2, Users } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import PageHeader from "../../components/ui/PageHeader";
import GradeSelect from "../../components/ui/GradeSelect";
import { ChoiceGroup, Input, Textarea } from "../../components/ui/Form";
import { useConfirm } from "../../context/ConfirmContext";
import api from "../../services/api";
import { fmtDateTime } from "../../lib/format";

// Each announcement is a pinned sticky note: colour cycles through the content-type palette.
const NOTE_COLORS = [
  "var(--t-homework-bg)", "var(--t-note-bg)", "var(--t-video-bg)", "var(--t-exam-bg)", "var(--t-file-bg)",
];
const NOTE_TILT = [-1.2, 0.9, -0.6, 1.4];

export default function AnnouncementsPage() {
  const { data, loading, error, refetch } = useApi("/teacher/announcements");
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", scope: "ALL_STUDENTS" });
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/teacher/announcements", form);
      toast.success("تم نشر الإعلان");
      setOpen(false);
      setForm({ title: "", body: "", scope: "ALL_STUDENTS" });
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(a) {
    if (!(await confirm({ title: "حذف الإعلان", message: `هل تريد حذف «${a.title}»؟`, confirmLabel: "احذف" }))) return;
    try {
      await api.delete(`/teacher/announcements/${a.id}`);
      toast.success("تم الحذف");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading && !data) return <LoadingState variant="list" label="جارِ تحميل الإعلانات..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader title="الإعلانات" description="انشر خبر أو تنبيه لطلابك، وهيوصلهم كإشعار." actions={<Button icon={Plus} onClick={() => setOpen(true)}>إعلان جديد</Button>} />

      {data.announcements.length === 0 ? (
        <EmptyState illustration="inbox" title="مفيش إعلانات" message="انشر أول إعلان لطلابك." action={<Button icon={Plus} onClick={() => setOpen(true)}>إعلان جديد</Button>} />
      ) : (
        <ul className="grid gap-x-5 gap-y-7 pt-3 sm:grid-cols-2 lg:grid-cols-3 stagger">
          {data.announcements.map((a, i) => (
            <li key={a.id} className="relative">
              <span className="absolute -top-2 inset-x-0 mx-auto z-10 block h-4 w-4 rounded-full bg-pen shadow-2 ring-2 ring-[var(--surface)]" aria-hidden="true" />
              <article
                className="flex min-h-[176px] flex-col rounded-xl p-5 pt-7 shadow-2 transition-transform duration-300 [transform:rotate(var(--r))] hover:[transform:rotate(0deg)]"
                style={{ "--r": `${NOTE_TILT[i % NOTE_TILT.length]}deg`, background: NOTE_COLORS[i % NOTE_COLORS.length] }}
              >
                <h2 className="font-bold text-ink leading-snug break-words">{a.title}</h2>
                <p className="mt-2 flex-1 text-ink-2 whitespace-pre-wrap break-words">{a.body}</p>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <p className="text-xs text-ink-2 num">{fmtDateTime(a.createdAt)}</p>
                  <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label={`حذف ${a.title}`} className="!text-bad shrink-0 -me-2" onClick={() => handleDelete(a)} />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="نشر إعلان جديد"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>إلغاء</Button><Button type="submit" form="create-ann" loading={submitting}>{submitting ? "جارِ النشر..." : "نشر"}</Button></>}>
        <form id="create-ann" onSubmit={handleCreate} className="space-y-5">
          <Input label="العنوان" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="نص الإعلان" required rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <ChoiceGroup label="لمين؟" value={form.scope} onChange={(v) => setForm({ ...form, scope: v })}
            options={[{ value: "ALL_STUDENTS", label: "كل الطلاب", icon: Users }, { value: "GRADE", label: "صف معيّن", icon: GraduationCap }, { value: "GROUP", label: "مجموعة معيّنة", icon: Layers }]} />
          {form.scope === "GRADE" && <GradeSelect required value={form.grade} onChange={(v) => setForm({ ...form, grade: v })} />}
          {form.scope === "GROUP" && <Input aria-label="اسم المجموعة" placeholder="اسم المجموعة" value={form.group || ""} onChange={(e) => setForm({ ...form, group: e.target.value })} />}
        </form>
      </Modal>
    </>
  );
}
