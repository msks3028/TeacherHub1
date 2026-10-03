import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Ban, KeyRound, Mail, Pencil, Plus, Printer, QrCode, RefreshCw, Trash2, UserCheck, UserPlus, Download } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { useDebounced } from "../../hooks/useDebounced";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Avatar from "../../components/ui/Avatar";
import Menu from "../../components/ui/Menu";
import PageHeader from "../../components/ui/PageHeader";
import GradeSelect from "../../components/ui/GradeSelect";
import { Input, PasswordInput, SearchInput, Select } from "../../components/ui/Form";
import { GRADES } from "../../constants/grades";
import { useConfirm } from "../../context/ConfirmContext";
import { usePlatform } from "../../context/PlatformContext";
import api from "../../services/api";
import { fmtDateShort, fmtNumber } from "../../lib/format";

const emptyForm = { fullName: "", email: "", password: "", grade: "", group: "", phone: "" };

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const debounced = useDebounced(search, 300);
  const query = new URLSearchParams({ ...(debounced && { search: debounced }), ...(grade && { grade }) }).toString();
  const { data, loading, error, refetch } = useApi(`/teacher/students?${query}`, { deps: [debounced, grade] });
  const confirm = useConfirm();
  const { name: platformName } = usePlatform();
  const location = useLocation();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [qrStudent, setQrStudent] = useState(null);
  const [editStudent, setEditStudent] = useState(null);
  const [resetStudent, setResetStudent] = useState(null);

  // dashboard shortcut ("إضافة طالب") opens the form straight away
  useEffect(() => {
    if (location.state?.create) {
      setCreateOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/teacher/students", form);
      toast.success("تم إنشاء الطالب بنجاح");
      setCreateOpen(false);
      setForm(emptyForm);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(student) {
    try {
      await api.patch(`/teacher/students/${student.id}/status`, { isActive: !student.isActive });
      toast.success(student.isActive ? "تم تعطيل الطالب" : "تم تفعيل الطالب");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete(student) {
    const ok = await confirm({ title: "حذف الطالب", message: `هل أنت متأكد من حذف ${student.fullName}؟ مش هتقدر ترجّعه بعد كده.`, confirmLabel: "احذف الطالب" });
    if (!ok) return;
    try {
      await api.delete(`/teacher/students/${student.id}`);
      toast.success("تم حذف الطالب");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleRegenerateQr(student) {
    try {
      const { data } = await api.post(`/teacher/students/${student.id}/regenerate-qr`);
      toast.success("تم إنشاء QR Code جديد");
      setQrStudent(data.student);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const rowMenu = (st) => (
    <div className="flex items-center gap-1">
      <Button variant="soft" size="sm" icon={QrCode} onClick={() => setQrStudent(st)}>QR</Button>
      <Menu
        label={`إجراءات ${st.fullName}`}
        items={[
          { label: "تعديل البيانات", icon: Pencil, onClick: () => setEditStudent(st) },
          { label: "تجديد QR Code", icon: RefreshCw, onClick: () => handleRegenerateQr(st) },
          { label: "إعادة تعيين كلمة المرور", icon: KeyRound, onClick: () => setResetStudent(st) },
          { label: st.isActive ? "تعطيل الحساب" : "تفعيل الحساب", icon: st.isActive ? Ban : UserCheck, onClick: () => toggleActive(st), separatorBefore: true },
          { label: "حذف الطالب", icon: Trash2, danger: true, onClick: () => handleDelete(st) },
        ]}
      />
    </div>
  );

  const hasFilters = !!(debounced || grade);

  return (
    <>
      <PageHeader
        title="الطلاب"
        description={data ? `${fmtNumber(data.students.length)} طالب${hasFilters ? " مطابق للبحث" : ""}` : "أضف طلابك وتابع حساباتهم."}
        actions={<Button icon={Plus} onClick={() => setCreateOpen(true)}>إضافة طالب</Button>}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو البريد..." className="flex-1" />
        <Select aria-label="تصفية بالصف" value={grade} onChange={(e) => setGrade(e.target.value)} containerClassName="sm:w-64">
          <option value="">كل الصفوف</option>
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </Select>
      </div>

      {loading && !data && <LoadingState variant="list" rows={6} label="جارِ تحميل الطلاب..." />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {data && !error && data.students.length === 0 && (
        hasFilters ? (
          <EmptyState illustration="search" title="مفيش نتايج" message="جرّب كلمة تانية أو شيل فلتر الصف." action={<Button variant="secondary" onClick={() => { setSearch(""); setGrade(""); }}>مسح البحث</Button>} />
        ) : (
          <EmptyState illustration="inbox" title="لسه ما أضفتش طلاب" message="أضف أول طالب وهيطلعله QR Code يدخل بيه من موبايله." action={<Button icon={UserPlus} onClick={() => setCreateOpen(true)}>إضافة طالب</Button>} />
        )
      )}
      {data && !error && data.students.length > 0 && (
        <ul className={`grid sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger transition-opacity ${loading ? "opacity-60" : ""}`} aria-label="قائمة الطلاب">
          {data.students.map((st) => (
            <li key={st.id} className="card card-interactive p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3.5">
                <span className="relative shrink-0">
                  <Avatar name={st.fullName} size="lg" />
                  <span className={`absolute bottom-0 end-0 h-4 w-4 rounded-full ring-[3px] ring-[var(--surface)] ${st.isActive ? "bg-ok-solid" : "bg-bad-solid"}`} role="img" aria-label={st.isActive ? "الحساب مفعّل" : "الحساب معطّل"} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-ink truncate">{st.fullName}</h3>
                  <p className="text-xs text-ink-3 truncate" dir="ltr">{st.email}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-primary-ink">
                    {st.grade && <span>{st.grade}</span>}
                    {st.grade && st.group && <span className="text-ink-3" aria-hidden="true">·</span>}
                    {st.group && <span className="text-ink-2">{st.group}</span>}
                    {!st.isActive && <Badge tone="bad">معطّل</Badge>}
                  </p>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
                <p className="text-xs text-ink-3 num">آخر نشاط: {st.lastActiveAt ? fmtDateShort(st.lastActiveAt) : "-"}</p>
                {rowMenu(st)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ---- create ---- */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="إضافة طالب جديد"
        description="هيتعمل له حساب و QR Code للدخول."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>إلغاء</Button>
            <Button type="submit" form="create-student" loading={submitting}>{submitting ? "جارِ الإنشاء..." : "إنشاء الطالب"}</Button>
          </>
        }
      >
        <form id="create-student" onSubmit={handleCreate} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-ink-2 mb-3">بيانات الطالب</legend>
            <Input label="اسم الطالب" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <GradeSelect label="الصف الدراسي" required value={form.grade} onChange={(v) => setForm({ ...form, grade: v })} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="المجموعة" hint="اختياري" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} />
              <Input label="الهاتف" hint="اختياري" dir="ltr" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-ink-2 mb-3">بيانات الدخول</legend>
            <Input label="البريد الإلكتروني" type="email" dir="ltr" icon={Mail} required autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <PasswordInput label="كلمة المرور" required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </fieldset>
        </form>
      </Modal>

      {editStudent && <EditStudentModal student={editStudent} onClose={() => setEditStudent(null)} onSaved={refetch} />}
      {resetStudent && <ResetPasswordModal student={resetStudent} onClose={() => setResetStudent(null)} />}

      {/* ---- QR (printable) ---- */}
      <Modal
        open={!!qrStudent}
        onClose={() => setQrStudent(null)}
        title="QR Code للدخول"
        footer={qrStudent && (
          <>
            <Button as="a" href={qrStudent.qrCodeUrl} download variant="secondary" icon={Download} className="no-print">تحميل الصورة</Button>
            <Button icon={Printer} onClick={() => window.print()} className="no-print">طباعة</Button>
          </>
        )}
      >
        {qrStudent && (
          <div className="print-area flex flex-col items-center text-center gap-3 py-2">
            <p className="font-display text-lg font-bold text-ink">{platformName}</p>
            <img src={qrStudent.qrCodeUrl} alt={`QR Code الخاص بـ ${qrStudent.fullName}`} className="w-64 h-64 sm:w-72 sm:h-72 rounded border border-line bg-white p-2" />
            <p className="text-xl font-bold text-ink">{qrStudent.fullName}</p>
            <p className="text-sm text-ink-2">امسح الكود بكاميرا الموبايل عشان تدخل المنصة مباشرة.</p>
          </div>
        )}
      </Modal>
    </>
  );
}

function EditStudentModal({ student, onClose, onSaved }) {
  const [f, setF] = useState({ fullName: student.fullName || "", grade: student.grade || "", group: student.group || "", phone: student.phone || "" });
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/teacher/students/${student.id}`, f);
      toast.success("تم حفظ بيانات الطالب");
      onClose();
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="تعديل بيانات الطالب"
      footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button type="submit" form="edit-student" loading={saving}>حفظ</Button></>}>
      <form id="edit-student" onSubmit={submit} className="space-y-4">
        <Input label="اسم الطالب" required value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
        <GradeSelect label="الصف الدراسي" required value={f.grade} onChange={(v) => setF({ ...f, grade: v })} />
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="المجموعة" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })} />
          <Input label="الهاتف" dir="ltr" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ student, onClose }) {
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (pw.length < 8) return setErr("كلمة المرور لازم تكون 8 أحرف على الأقل");
    setErr("");
    setSaving(true);
    try {
      await api.post(`/teacher/students/${student.id}/reset-password`, { newPassword: pw });
      toast.success("تم تعيين كلمة مرور جديدة");
      onClose();
    } catch (e2) {
      toast.error(e2.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`كلمة مرور جديدة لـ ${student.fullName}`}
      footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button type="submit" form="reset-pw" loading={saving}>تعيين</Button></>}>
      <form id="reset-pw" onSubmit={submit}>
        <PasswordInput label="كلمة المرور الجديدة" hint="8 أحرف على الأقل. بلّغها للطالب بنفسك." autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} error={err} required />
      </form>
    </Modal>
  );
}
