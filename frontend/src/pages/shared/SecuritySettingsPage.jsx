import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, BellRing, Copy, KeyRound, LogOut, Monitor, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import api from "../../services/api";
import CoverHeader from "../../components/common/CoverHeader";
import Alert from "../../components/ui/Alert";
import Badge from "../../components/ui/Badge";
import { useConfirm } from "../../context/ConfirmContext";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Icon from "../../components/ui/Icon";
import { Input } from "../../components/ui/Form";
import { ErrorState, LoadingState } from "../../components/common/StateViews";

function deviceName(ua = "") {
  if (/iphone|ipad/i.test(ua)) return "iPhone / iPad";
  if (/android/i.test(ua)) return "هاتف Android";
  if (/windows/i.test(ua)) return "Windows";
  if (/macintosh|mac os/i.test(ua)) return "Mac";
  if (/linux/i.test(ua)) return "Linux";
  return "جهاز أو متصفح آخر";
}

function decodeKey(value) {
  const padded = `${value}${"=".repeat((4 - value.length % 4) % 4)}`;
  return Uint8Array.from(atob(padded.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}

export default function SecuritySettingsPage() {
  const { data: security, loading, error, refetch } = useApi("/security/settings");
  const { data: sessionData, refetch: refetchSessions } = useApi("/security/sessions");
  const confirm = useConfirm();
  const [setup, setSetup] = useState(null);
  const [setupPassword, setSetupPassword] = useState("");
  const [enablePassword, setEnablePassword] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableForm, setDisableForm] = useState({ password: "", code: "" });
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;
    setPushSupported(supported);
    if (!supported) return;
    navigator.serviceWorker.getRegistration("/").then((registration) => registration?.pushManager.getSubscription()).then((subscription) => setPushEnabled(!!subscription)).catch(() => {});
  }, []);

  async function startSetup() {
    setSetup({ pending: true });
    setSetupPassword("");
    setEnablePassword("");
    setSetupCode("");
  }

  function cancelSetup() {
    setSetup(null);
    setSetupPassword("");
    setEnablePassword("");
    setSetupCode("");
  }

  async function beginSetup(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/security/two-factor/setup", { password: setupPassword });
      setSetup(data);
      setSetupCode("");
      setEnablePassword("");
      setSetupPassword("");
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function enableTwoFactor(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/security/two-factor/enable", { secret: setup.secret, code: setupCode, password: enablePassword });
      setSetup(null);
      setEnablePassword("");
      setRecoveryCodes(data.recoveryCodes);
      toast.success("تم تفعيل المصادقة الثنائية.");
      refetch(); refetchSessions();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function disableTwoFactor(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/security/two-factor/disable", disableForm);
      setDisableOpen(false); setDisableForm({ password: "", code: "" });
      toast.success("تم إيقاف المصادقة الثنائية.");
      refetch(); refetchSessions();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function enablePush() {
    if (!pushSupported) return toast.error("إشعارات المتصفح غير مدعومة على هذا الجهاز أو المتصفح.");
    setSaving(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("لم تسمح بإرسال الإشعارات.");
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const { data } = await api.get("/notifications/push/public-key");
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(data.vapidPublicKey) });
      }
      await api.post("/notifications/push/subscriptions", { subscription: subscription.toJSON() });
      setPushEnabled(true);
      toast.success("تم تفعيل الإشعارات على هذا الجهاز.");
    } catch (err) { toast.error(err.message || "تعذّر تفعيل الإشعارات."); }
    finally { setSaving(false); }
  }

  async function disablePush() {
    setSaving(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await api.delete("/notifications/push/subscriptions", { data: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
      setPushEnabled(false);
      toast.success("تم إيقاف إشعارات هذا الجهاز.");
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function revokeSession(id) {
    if (!(await confirm({ title: "إنهاء الجلسة", message: "هيتم تسجيل خروج هذا الجهاز فورًا. هل تريد المتابعة؟", confirmLabel: "أنهِ الجلسة" }))) return;
    try { await api.delete(`/security/sessions/${id}`); toast.success("تم إنهاء الجلسة."); refetchSessions(); }
    catch (err) { toast.error(err.message); }
  }

  async function revokeOthers() {
    if (!(await confirm({ title: "إنهاء كل الأجهزة الأخرى", message: "هيتم تسجيل الخروج من كل الأجهزة ما عدا هذا الجهاز. هل تريد المتابعة؟", confirmLabel: "أنهِ الأجهزة الأخرى" }))) return;
    try { const { data } = await api.delete("/security/sessions/others"); toast.success(`تم إنهاء ${data.revokedCount} جلسة.`); refetchSessions(); }
    catch (err) { toast.error(err.message); }
  }

  async function copyRecoveryCodes() {
    try { await navigator.clipboard.writeText(recoveryCodes.join("\n")); toast.success("تم نسخ رموز الاسترداد."); }
    catch { toast.error("تعذّر النسخ؛ احتفظ بالرموز الظاهرة يدويًا."); }
  }

  if (loading) return <LoadingState label="جارِ تحميل إعدادات الأمان..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  const sessions = sessionData?.sessions || [];
  const othersCount = sessions.filter((session) => !session.current).length;
  const isPhone = (ua = "") => /iphone|ipad|android/i.test(ua);
  return (
    <>
      <CoverHeader
        eyebrow="حسابك"
        title="الأمان والجلسات"
        description="إدارة المصادقة الثنائية والجلسات والأجهزة التي تستخدم حسابك."
        stats={[{ label: "المصادقة الثنائية", value: security.twoFactorEnabled ? "مفعّلة" : "متوقفة" }, { label: "جلسات نشطة", value: sessions.length }]}
      />
      {!security.twoFactorEnabled && (
        <Alert tone="warn" className="mb-5">حسابك محمي بكلمة المرور فقط. فعّل المصادقة الثنائية عشان تضيف طبقة حماية تانية.</Alert>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="space-y-5">
          <section className="card p-5" aria-labelledby="two-factor-title">
            <div className="flex items-start gap-3.5">
              <span className="ct ct-primary shrink-0"><Icon icon={KeyRound} size={20} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h2 id="two-factor-title" className="font-bold text-ink">المصادقة الثنائية</h2>{security.twoFactorEnabled ? <Badge tone="ok" icon={ShieldCheck}>مفعّلة</Badge> : <Badge tone="warn" icon={ShieldAlert}>غير مفعّلة</Badge>}</div>
                <p className="mt-1.5 text-sm text-ink-2">أضف رمزًا من تطبيق المصادقة عند تسجيل الدخول. رموز الاسترداد تستخدم مرة واحدة.</p>
              </div>
            </div>
            {security.twoFactorEnabled ? <Button className="mt-4" variant="danger" onClick={() => setDisableOpen(true)}>إيقاف المصادقة الثنائية</Button> : <Button className="mt-4" icon={ShieldCheck} loading={saving} onClick={startSetup}>إعداد المصادقة الثنائية</Button>}
          </section>

          <section className="card p-5" aria-labelledby="push-title">
            <div className="flex items-start gap-3.5">
              <span className="ct ct-note shrink-0"><Icon icon={BellRing} size={20} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h2 id="push-title" className="font-bold text-ink">إشعارات هذا الجهاز</h2>{pushSupported && (pushEnabled ? <Badge tone="ok">مفعّلة</Badge> : <Badge>غير مفعّلة</Badge>)}</div>
                <p className="mt-1.5 text-sm text-ink-2">تصل تنبيهات جديدة حتى عندما لا تكون المنصة مفتوحة. لا تُرسل بيانات خاصة في الإشعار إلا ما يظهر في قائمة الإشعارات داخل المنصة.</p>
                {!pushSupported && <p className="mt-1.5 text-sm text-ink-3">تفعيل الإشعارات غير متاح في هذا المتصفح أو السياق.</p>}
              </div>
            </div>
            {pushSupported && (pushEnabled ? <Button className="mt-4" variant="secondary" loading={saving} onClick={disablePush}>إيقاف إشعارات هذا الجهاز</Button> : <Button className="mt-4" variant="secondary" loading={saving} onClick={enablePush}>تفعيل إشعارات هذا الجهاز</Button>)}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-5" aria-labelledby="sessions-title">
            <div className="flex items-start gap-3.5">
              <span className="ct ct-info shrink-0"><Icon icon={Monitor} size={20} /></span>
              <div className="min-w-0 flex-1"><h2 id="sessions-title" className="font-bold text-ink">الأجهزة والجلسات النشطة</h2><p className="mt-1.5 text-sm text-ink-2">أنهِ أي جلسة لا تعرفها. الجلسة الحالية لا يمكن إنهاؤها من هذه القائمة.</p></div>
            </div>
            {sessions.length === 0 ? <p className="mt-4 text-sm text-ink-3">لا توجد جلسات نشطة.</p> : (
              <ul className="mt-4 space-y-2.5">
                {sessions.map((session) => (
                  <li key={session.id} className={`flex items-center gap-3 rounded-2xl p-3.5 ${session.current ? "bg-primary-soft" : "bg-sunken"}`}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface text-ink-2"><Icon icon={isPhone(session.userAgent) ? Smartphone : Monitor} size={20} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">{deviceName(session.userAgent)}{session.current && <Badge tone="primary">هذا الجهاز</Badge>}</p>
                      <p className="mt-0.5 text-xs text-ink-3">آخر نشاط: <span className="num">{new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.lastSeenAt))}</span></p>
                    </div>
                    {!session.current && <Button variant="danger" size="sm" icon={LogOut} aria-label={`إنهاء جلسة ${deviceName(session.userAgent)}`} onClick={() => revokeSession(session.id)}>إنهاء</Button>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {othersCount > 0 && (
            <section className="rounded-3xl border p-5" style={{ borderColor: "var(--bad-bg-strong)", background: "var(--bad-bg)" }} aria-labelledby="danger-title">
              <div className="flex items-start gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface text-bad"><Icon icon={AlertTriangle} size={20} /></span>
                <div className="min-w-0 flex-1">
                  <h2 id="danger-title" className="font-bold text-bad">منطقة حسّاسة</h2>
                  <p className="mt-1.5 text-sm text-ink-2">لو حاسس إن حد غيرك دخل حسابك، أنهِ كل الأجهزة التانية مرة واحدة وغيّر كلمة المرور.</p>
                  <Button className="mt-3" variant="dangerSolid" size="sm" icon={LogOut} onClick={revokeOthers}>إنهاء الأجهزة الأخرى ({othersCount})</Button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <Modal open={!!setup} onClose={cancelSetup} title="إعداد المصادقة الثنائية" description={setup?.pending ? "أدخل كلمة المرور الحالية للتأكيد." : "امسح رمز QR، ثم أدخل كلمة المرور الحالية ورمز التطبيق للتأكيد."} footer={setup?.pending ? <><Button variant="secondary" onClick={cancelSetup}>إلغاء</Button><Button type="submit" form="two-factor-start" loading={saving}>متابعة</Button></> : <><Button variant="secondary" onClick={cancelSetup}>إلغاء</Button><Button type="submit" form="two-factor-setup" loading={saving}>تفعيل</Button></>}>
        {setup?.pending && <form id="two-factor-start" onSubmit={beginSetup}><Input label="كلمة المرور الحالية" type="password" autoComplete="current-password" required value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} /></form>}
        {setup && !setup.pending && <form id="two-factor-setup" onSubmit={enableTwoFactor} className="space-y-4"><div className="flex justify-center"><img src={setup.qrDataUrl} alt="رمز إعداد تطبيق المصادقة" width="220" height="220" /></div><p className="text-sm text-ink-2">إذا تعذر المسح، أدخل هذا المفتاح يدويًا في تطبيق المصادقة.</p><code dir="ltr" className="block rounded bg-sunken px-3 py-2 text-center text-sm font-bold tracking-wider text-ink break-all">{setup.secret}</code><Input label="كلمة المرور الحالية" type="password" autoComplete="current-password" required value={enablePassword} onChange={(e) => setEnablePassword(e.target.value)} /><Input label="رمز من التطبيق" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={setupCode} onChange={(e) => setSetupCode(e.target.value)} /></form>}
      </Modal>

      <Modal open={!!recoveryCodes} onClose={() => setRecoveryCodes(null)} title="احفظ رموز الاسترداد" description="لن تظهر هذه الرموز مرة أخرى. احفظها في مكان آمن. كل رمز صالح لاستخدام واحد فقط." footer={<><Button variant="secondary" icon={Copy} onClick={copyRecoveryCodes}>نسخ الرموز</Button><Button onClick={() => setRecoveryCodes(null)}>تم الحفظ</Button></>}>
        {recoveryCodes && <ul dir="ltr" className="grid grid-cols-2 gap-2">{recoveryCodes.map((code) => <li key={code} className="rounded bg-sunken px-3 py-2 text-center font-mono text-sm font-bold text-ink">{code}</li>)}</ul>}
      </Modal>

      <Modal open={disableOpen} onClose={() => setDisableOpen(false)} title="إيقاف المصادقة الثنائية" description="للتأكيد، أدخل كلمة المرور الحالية ورمز المصادقة أو رمز استرداد غير مستخدم." footer={<><Button variant="secondary" onClick={() => setDisableOpen(false)}>رجوع</Button><Button type="submit" form="disable-two-factor" variant="danger" loading={saving}>إيقاف</Button></>}>
        <form id="disable-two-factor" onSubmit={disableTwoFactor} className="space-y-4"><Input label="كلمة المرور الحالية" type="password" autoComplete="current-password" required value={disableForm.password} onChange={(e) => setDisableForm({ ...disableForm, password: e.target.value })} /><Input label="رمز المصادقة أو الاسترداد" dir="ltr" autoComplete="one-time-code" required value={disableForm.code} onChange={(e) => setDisableForm({ ...disableForm, code: e.target.value })} /></form>
      </Modal>
    </>
  );
}
