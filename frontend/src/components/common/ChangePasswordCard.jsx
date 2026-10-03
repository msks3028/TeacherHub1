import { useState } from "react";
import toast from "react-hot-toast";
import { KeyRound } from "lucide-react";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { PasswordInput } from "../ui/Form";
import api, { setAuthToken } from "../../services/api";

/**
 * Lets the signed-in user (teacher or student) change their own password.
 * Changing it signs out every OTHER device that was using the old password;
 * this browser stays signed in (the server re-issues its session).
 */
export default function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword.length < 8) return setErrors({ newPassword: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" });
    if (newPassword !== confirm) return setErrors({ confirm: "تأكيد كلمة المرور غير مطابق" });
    setErrors({});

    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/change-password", { currentPassword, newPassword });
      if (data.token) setAuthToken(data.token);
      toast.success("تم تغيير كلمة المرور");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel p-5 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="ct ct-primary"><Icon icon={KeyRound} size={20} /></span>
        <div>
          <h2 className="font-bold text-ink">تغيير كلمة المرور</h2>
          <p className="text-sm text-ink-3">هيتم تسجيل خروجك من باقي الأجهزة.</p>
        </div>
      </div>
      <PasswordInput label="كلمة المرور الحالية" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
      <PasswordInput label="كلمة المرور الجديدة" hint="8 أحرف على الأقل" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} error={errors.newPassword} required />
      <PasswordInput label="تأكيد كلمة المرور الجديدة" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} required />
      <Button type="submit" loading={submitting}>{submitting ? "جارِ التغيير..." : "تغيير كلمة المرور"}</Button>
    </form>
  );
}
