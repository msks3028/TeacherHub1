import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePlatform } from "../../context/PlatformContext";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";
import { Input, PasswordInput } from "../../components/ui/Form";
import PlatformMark from "../../components/layout/PlatformMark";
import ThemeCorner from "../../components/layout/ThemeCorner";

export default function LoginPage() {
  const { login, twoFactorRequired } = useAuth();
  const { settings, name } = usePlatform();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const result = await login(email, password, twoFactorCode);
    setSubmitting(false);
    if (result === true) navigate("/");
    else setError(result?.requiresTwoFactor || twoFactorRequired ? "أدخل رمز تطبيق المصادقة أو رمز استرداد صالحًا." : "البريد الإلكتروني أو كلمة المرور غير صحيحة");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-surface">
      {/* ---------- identity panel (desktop) ---------- */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden rounded-xl m-3 bg-sidebar text-sidebar-ink p-12 shadow-3" aria-hidden={false}>
        {settings?.heroImageUrl && (
          <>
            <img src={settings.heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-sidebar opacity-80" />
          </>
        )}
        {/* notebook ruling + the red margin line */}
        <svg className="absolute inset-0 w-full h-full text-sidebar-ink opacity-[0.07]" aria-hidden="true">
          <defs>
            <pattern id="rule" width="100%" height="40" patternUnits="userSpaceOnUse"><line x1="0" y1="39" x2="100%" y2="39" stroke="currentColor" strokeWidth="1.5" /></pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#rule)" />
        </svg>
        <div className="absolute inset-y-0 start-[88px] w-px bg-pen opacity-70" aria-hidden="true" />
        {/* drifting notebook doodles */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <svg className="float-slow absolute top-[14%] end-[12%] w-14 text-pen" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M24 5l5.2 12.4L43 19l-10 9 3 14-12-7.4L12 42l3-14-10-9 13.8-1.6z" /></svg>
          <svg className="float-slow-b absolute bottom-[24%] end-[18%] w-16 text-sidebar-ink opacity-30" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="24" cy="24" r="18" /><path d="M15 25l6 6 12-13" /></svg>
          <svg className="float-slow absolute top-[46%] end-[34%] w-12 text-sidebar-ink opacity-25" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 40l2-9L32 9a4 4 0 016 6L16 37z" /><path d="M28 13l7 7" /></svg>
        </div>

        <PlatformMark size={44} nameClass="text-xl text-sidebar-ink" className="relative" />

        <div className="relative ps-14 max-w-lg">
          <h2 className="font-display text-3xl xl:text-[44px] font-bold leading-[1.25]">أهلاً بيك في {name}</h2>
          <svg viewBox="0 0 240 16" className="mt-3 w-56 text-pen" aria-hidden="true" fill="none">
            <path pathLength="1" className="pen-draw" d="M4 10 C 40 3, 70 14, 110 8 S 190 4, 236 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <p className="mt-5 text-lg text-sidebar-ink2 leading-relaxed">ادخل بحسابك وكمّل من حيث وقفت: فيديوهاتك وواجباتك واختباراتك في مكان واحد.</p>
        </div>

        <p className="relative text-sm text-sidebar-ink2">
          {settings?.contactEmail ? <>محتاج مساعدة؟ <span dir="ltr" className="text-sidebar-ink">{settings.contactEmail}</span></> : "\u00a0"}
        </p>
      </aside>

      {/* ---------- form panel ---------- */}
      <main className="relative flex flex-col justify-center px-5 py-10 sm:px-10">
        <ThemeCorner />
        <div className="w-full max-w-sm mx-auto anim-rise">
          <div className="lg:hidden mb-8 text-ink"><PlatformMark size={44} nameClass="text-xl" /></div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-ink">تسجيل الدخول</h1>
          <p className="mt-2 text-sm text-ink-2">
            استخدم البريد وكلمة المرور اللي مدرسك إداهملك، أو امسح الـ QR Code بتاعك.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate={false}>
            {error && <Alert tone="bad">{error}</Alert>}
            <Input
              label="البريد الإلكتروني"
              type="email"
              dir="ltr"
              icon={Mail}
              autoComplete="username"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
            />
            <PasswordInput
              label="كلمة المرور"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
            />
            {twoFactorRequired && (
              <Input
                label="رمز المصادقة الثنائية أو رمز الاسترداد"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={24}
                required
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
              />
            )}
            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              {submitting ? "جارِ الدخول..." : "دخول"}
            </Button>
          </form>

          <p className="mt-8 text-sm text-ink-3 text-center">الحسابات بينشئها المدرس، مفيش تسجيل ذاتي.</p>
        </div>
      </main>
    </div>
  );
}
