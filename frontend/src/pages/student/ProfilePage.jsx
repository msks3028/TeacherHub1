import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Phone, User } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { LoadingState, ErrorState } from "../../components/common/StateViews";
import Button from "../../components/ui/Button";
import ProfileHero from "../../components/common/ProfileHero";
import ImageUpload from "../../components/ui/ImageUpload";
import { Input } from "../../components/ui/Form";
import api from "../../services/api";
import ChangePasswordCard from "../../components/common/ChangePasswordCard";
import { fmtNumber } from "../../lib/format";

export default function StudentProfilePage() {
  const { data, loading, error, refetch } = useApi("/student/profile");
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ fullName: "", phone: "", guardianPhone: "", avatarUrl: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (data?.student) {
      const s = data.student;
      setForm({ fullName: s.fullName || "", phone: s.phone || "", guardianPhone: s.guardianPhone || "", avatarUrl: s.avatarUrl || "" });
    }
  }, [data]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.fullName.trim().length < 2) return toast.error("اكتب اسمك (حرفين على الأقل)");
    setSubmitting(true);
    try {
      await api.put("/student/profile", form);
      toast.success("تم حفظ التعديلات");
      refetch();
      refreshUser(); // the name / photo in the top bar update straight away
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !data) return <LoadingState label="جارِ تحميل الملف الشخصي..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const s = data.student;

  return (
    <div className="max-w-3xl">
      <ProfileHero
        name={s.fullName}
        avatarUrl={form.avatarUrl}
        role="طالب"
        badges={[s.grade, s.group].filter(Boolean)}
        stats={[{ label: "كورساتي", value: fmtNumber(s.enrollments.length) }]}
      />
      <div className="space-y-6">
        <section className="panel p-5 md:p-6">
          <dl className="divide-soft text-sm">
            <Info label="البريد الإلكتروني" value={<span dir="ltr">{data.email}</span>} />
            <Info label="الكورسات المسجّل بها" value={<span className="num">{fmtNumber(s.enrollments.length)}</span>} />
          </dl>
          <p className="mt-3 text-xs text-ink-3">الصف والمجموعة والبريد بيغيّرهم المدرس.</p>
        </section>

        <form onSubmit={handleSubmit} className="panel p-5 md:p-6 space-y-5">
          <ImageUpload
            label="الصورة الشخصية"
            hint="PNG أو JPG"
            uploadPath="/student/upload/avatar"
            round
            name={form.fullName}
            value={form.avatarUrl}
            onChange={(url) => setForm((f) => ({ ...f, avatarUrl: url }))}
            disabled={submitting}
          />
          <Input label="الاسم" icon={User} required autoComplete="name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="رقم هاتفك" icon={Phone} dir="ltr" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="رقم هاتف ولي الأمر" icon={Phone} dir="ltr" inputMode="tel" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
          </div>
          <Button type="submit" loading={submitting}>{submitting ? "جارِ الحفظ..." : "حفظ التعديلات"}</Button>
        </form>

        <ChangePasswordCard />
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-ink-3">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}
