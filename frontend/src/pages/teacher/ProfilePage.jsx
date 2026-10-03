import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Facebook, Globe, Instagram, Link2, Phone, Youtube } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState } from "../../components/common/StateViews";
import Button from "../../components/ui/Button";
import ProfileHero from "../../components/common/ProfileHero";
import { Input, Textarea } from "../../components/ui/Form";
import api from "../../services/api";
import ChangePasswordCard from "../../components/common/ChangePasswordCard";

const SOCIAL_FIELDS = [
  ["facebook", "Facebook", Facebook], ["instagram", "Instagram", Instagram], ["youtube", "YouTube", Youtube],
  ["tiktok", "TikTok", Link2], ["telegram", "Telegram", Link2], ["whatsapp", "WhatsApp", Phone],
  ["x", "X", Link2], ["linkedin", "LinkedIn", Link2], ["website", "الموقع الإلكتروني", Globe],
];

export default function TeacherProfilePage() {
  const { data, loading, error, refetch } = useApi("/teacher/profile");
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (data?.teacher) setForm(data.teacher);
  }, [data]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put("/teacher/profile", form);
      toast.success("تم حفظ الملف الشخصي");
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if ((loading && !form) || (!form && !error)) return <LoadingState label="جارِ تحميل الملف الشخصي..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="max-w-3xl">
      <ProfileHero name={form.fullName || ""} role="مدرس" />
      <div className="space-y-6">
        <form onSubmit={handleSubmit} className="panel p-5 md:p-6 space-y-6">
          <fieldset className="space-y-4">
            <legend className="sr-only">البيانات الأساسية</legend>
            <Input label="الاسم" value={form.fullName || ""} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <Textarea label="نبذة تعريفية (Bio)" rows={3} value={form.bio || ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            <Input label="الهاتف" icon={Phone} dir="ltr" inputMode="tel" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </fieldset>
          <fieldset>
            <legend className="text-sm font-bold text-ink-2 mb-3">روابط التواصل الاجتماعي (اختيارية)</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              {SOCIAL_FIELDS.map(([key, label, icon]) => (
                <Input key={key} aria-label={label} placeholder={label} icon={icon} dir="ltr" value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              ))}
            </div>
          </fieldset>
          <Button type="submit" loading={submitting}>{submitting ? "جارِ الحفظ..." : "حفظ التعديلات"}</Button>
        </form>
        <ChangePasswordCard />
      </div>
    </div>
  );
}
