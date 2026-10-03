import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { CheckCircle2, QrCode, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import PlatformMark from "../../components/layout/PlatformMark";
import ThemeCorner from "../../components/layout/ThemeCorner";
import { Input } from "../../components/ui/Form";

export default function QrLoginPage() {
  const { token } = useParams();
  const { qrLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function attemptLogin(code) {
    setChecking(true);
    const result = await qrLogin(token, code);
    setChecking(false);
    if (result === true) { setDone(true); timer.current = setTimeout(() => navigate("/"), 650); }
    else if (result?.requiresTwoFactor) setNeedsTwoFactor(true);
    else setError("رمز QR غير صالح أو منتهي الصلاحية.");
  }

  useEffect(() => {
    attemptLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="relative min-h-screen grid place-items-center bg-surface px-5 py-10">
      <ThemeCorner />
      <div className="w-full max-w-sm text-center anim-rise">
        <div className="flex justify-center mb-8 text-ink"><PlatformMark size={40} nameClass="text-lg" /></div>

        {done ? (
          <div role="status" aria-live="polite" className="anim-rise">
            <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-ok-bg text-ok"><Icon icon={CheckCircle2} size={24} className="!h-12 !w-12" /></span>
            <h1 className="mt-8 font-display text-2xl font-bold text-ink">أهلاً بيك، تمام!</h1>
            <p className="mt-2 text-sm text-ink-2">بنفتحلك المنصة…</p>
          </div>
        ) : !error && !needsTwoFactor ? (
          <div role="status" aria-live="polite">
            <div className="relative mx-auto w-40 h-40 text-primary-ink">
              <svg viewBox="0 0 160 160" className="absolute inset-0" fill="none" aria-hidden="true">
                <path d="M8 44V22a14 14 0 0 1 14-14h22M116 8h22a14 14 0 0 1 14 14v22M152 116v22a14 14 0 0 1-14 14h-22M44 152H22a14 14 0 0 1-14-14v-22" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-ink-3"><Icon icon={QrCode} size={24} className="!w-14 !h-14 opacity-60" /></span>
              <span className="absolute inset-x-6 top-6 bottom-6 overflow-hidden" aria-hidden="true">
                <span className="block h-[3px] rounded bg-primary" style={{ animation: "scan 1.8s ease-in-out infinite" }} />
              </span>
            </div>
            <h1 className="mt-8 font-display text-2xl font-bold text-ink">جارِ تسجيل دخولك…</h1>
            <p className="mt-2 text-sm text-ink-2">لحظات ونفتحلك المنصة.</p>
            <ol className="mx-auto mt-6 w-fit space-y-2 text-start text-sm text-ink-2" aria-hidden="true">
              <li className="flex items-center gap-2.5"><span className="grid h-6 w-6 place-items-center rounded-full bg-ok-bg text-ok"><Icon icon={CheckCircle2} size={16} /></span>قرينا الرمز</li>
              <li className="flex items-center gap-2.5"><span className="grid h-6 w-6 place-items-center rounded-full bg-primary-soft text-primary-ink"><Icon icon={ShieldCheck} size={16} className="animate-pulse" /></span>بنتأكد من الرمز</li>
              <li className="flex items-center gap-2.5 text-ink-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-sunken"><Icon icon={UserRound} size={16} /></span>بنفتح حسابك</li>
            </ol>
          </div>
        ) : needsTwoFactor && !error ? (
          <form onSubmit={(e) => { e.preventDefault(); attemptLogin(twoFactorCode); }} className="text-start">
            <span className="ct ct-lg ct-primary !rounded-full mx-auto"><Icon icon={QrCode} size={24} /></span>
            <h1 className="mt-6 text-center font-display text-2xl font-bold text-ink">تحقق إضافي مطلوب</h1>
            <p className="mt-2 text-center text-sm text-ink-2">أدخل رمز تطبيق المصادقة أو أحد رموز الاسترداد.</p>
            <Input label="رمز المصادقة" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={24} required value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} containerClassName="mt-5" />
            <Button type="submit" size="lg" loading={checking} className="w-full mt-4">متابعة</Button>
          </form>
        ) : (
          <div role="alert">
            <span className="ct ct-lg ct-bad !rounded-full mx-auto"><Icon icon={QrCode} size={24} /></span>
            <h1 className="mt-6 font-display text-2xl font-bold text-ink">الرمز ده مش شغّال</h1>
            <p className="mt-2 text-ink-2">{error}</p>
            <div className="mt-5 panel p-4 text-sm text-ink-2 text-start">
              <p className="font-semibold text-ink">تعمل إيه؟</p>
              <ol className="mt-2 list-decimal space-y-1.5 ps-5">
                <li>جرّب تاني لو الإنترنت كان ضعيف.</li>
                <li>كلّم مدرسك وخليه يديك رمز QR جديد (الرمز القديم بينتهي).</li>
                <li>أو ادخل بالبريد وكلمة المرور.</li>
              </ol>
            </div>
            <div className="mt-6 grid gap-2.5">
              <Button size="lg" icon={RotateCcw} loading={checking} onClick={() => { setError(null); attemptLogin(); }} className="w-full">حاول تاني</Button>
              <Button as={Link} to="/login" size="lg" variant="secondary" className="w-full">الذهاب لتسجيل الدخول</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
