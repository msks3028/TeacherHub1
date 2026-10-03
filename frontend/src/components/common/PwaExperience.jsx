import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, WifiOff, X } from "lucide-react";
import Icon from "../ui/Icon";

function isInstalled() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function detectInstallSupport() {
  if (isInstalled()) return "installed";
  const userAgent = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "manual";
  if (typeof window.BeforeInstallPromptEvent === "function" || /Chrome\/|Chromium\/|Edg\/|SamsungBrowser\//i.test(userAgent)) return "prompt";
  return "unsupported";
}

export default function PwaExperience() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [serverUnavailable, setServerUnavailable] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(isInstalled);
  const [installSupport, setInstallSupport] = useState(detectInstallSupport);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(() => {
    try { return localStorage.getItem("th-install-dismissed") === "1"; } catch { return false; }
  });
  const registrationRef = useRef(null);
  const reloadAfterUpdateRef = useRef(false);

  useEffect(() => {
    let registration;
    let onUpdateFound;
    let onControllerChange;
    if (import.meta.env.PROD && "serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((value) => {
        registration = value;
        registrationRef.current = value;
        setUpdateAvailable(!!value.waiting);
        onUpdateFound = () => {
          const worker = value.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateAvailable(true);
          });
        };
        value.addEventListener("updatefound", onUpdateFound);
        value.update().catch(() => {});
      }).catch(() => {
        // PWA support is optional; the web application itself remains usable.
      });
      onControllerChange = () => {
        if (reloadAfterUpdateRef.current) {
          reloadAfterUpdateRef.current = false;
          window.location.reload();
        }
      };
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    }

    const onOffline = () => setOnline(false);
    const onOnline = () => {
      setOnline(true);
      setReconnecting(true);
      window.dispatchEvent(new Event("teacherhub:reconnected"));
    };
    const onApiFailure = () => { setServerUnavailable(true); setReconnecting(false); };
    const onApiSuccess = () => { setServerUnavailable(false); setReconnecting(false); };
    const onInstall = (event) => {
      event.preventDefault();
      if (!isInstalled()) { setInstallEvent(event); setInstallSupport("available"); }
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallSupport("installed");
      setInstallEvent(null);
      setInstallDismissed(true);
      try { localStorage.setItem("th-install-dismissed", "1"); } catch { /* storage may be blocked */ }
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener("teacherhub:network-error", onApiFailure);
    window.addEventListener("teacherhub:api-online", onApiSuccess);
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("teacherhub:network-error", onApiFailure);
      window.removeEventListener("teacherhub:api-online", onApiSuccess);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (registration && onUpdateFound) registration.removeEventListener("updatefound", onUpdateFound);
      if (onControllerChange) navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  async function applyUpdate() {
    const registration = registrationRef.current;
    if (!registration?.waiting) return;
    reloadAfterUpdateRef.current = true;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const result = await installEvent.userChoice;
    setInstallEvent(null);
    if (result?.outcome === "dismissed") {
      setInstallDismissed(true);
      try { localStorage.setItem("th-install-dismissed", "1"); } catch { /* storage may be blocked */ }
    }
  }

  const showOffline = !online || serverUnavailable || reconnecting;
  const showInstall = !installed && !installDismissed && installEvent;
  const showInstallHelp = !installed && !installDismissed && !installEvent && ["manual", "unsupported"].includes(installSupport);
  if (!showOffline && !showInstall && !showInstallHelp && !updateAvailable) return null;

  return (
    <div className="fixed z-[70] inset-x-3 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+12px)] lg:bottom-4 flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-xl space-y-2">
        {showOffline && (
          <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-lg border border-warn/30 bg-raised px-3 py-2 shadow-2">
            <Icon icon={WifiOff} size={18} className="shrink-0 text-warn" />
            <p className="min-w-0 flex-1 text-sm text-ink">{!online ? "أنت غير متصل. البيانات المعروضة تحتاج اتصالًا بالخادم وقد تكون قديمة." : reconnecting ? "عاد الاتصال. جارِ تحديث البيانات المباشرة…" : "الاتصال بالخادم غير متاح. البيانات المعروضة قد تكون قديمة."}</p>
          </div>
        )}
        {updateAvailable && (
          <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-lg border border-primary/30 bg-raised px-3 py-2 shadow-2">
            <p className="min-w-0 flex-1 text-sm text-ink">يتوفر تحديث جديد لـTeacherHub.</p>
            <button type="button" onClick={applyUpdate} className="btn btn-primary btn-sm min-h-[44px] shrink-0" aria-label="تحديث TeacherHub">
              <Icon icon={RefreshCw} size={16} /> تحديث
            </button>
          </div>
        )}
        {showInstall && (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-line bg-raised p-2 shadow-2">
            <span className="min-w-0 flex-1 px-2 text-sm font-semibold text-ink">ثبّت TeacherHub للوصول السريع</span>
            <button type="button" onClick={install} className="btn btn-primary btn-sm min-h-[44px] shrink-0" aria-label="تثبيت TeacherHub">
              <Icon icon={Download} size={16} /> تثبيت
            </button>
            <button type="button" onClick={() => { setInstallDismissed(true); try { localStorage.setItem("th-install-dismissed", "1"); } catch { /* storage may be blocked */ } }} className="btn btn-ghost btn-icon btn-sm min-h-[44px] min-w-[44px] shrink-0" aria-label="إخفاء اقتراح التثبيت">
              <Icon icon={X} size={16} />
            </button>
          </div>
        )}
        {showInstallHelp && (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-line bg-raised p-2 shadow-2">
            <span className="min-w-0 flex-1 px-2 text-sm text-ink">{installSupport === "manual" ? "للتثبيت على iPhone أو iPad، افتح قائمة المشاركة ثم اختر «إضافة إلى الشاشة الرئيسية»." : "هذا المتصفح لا يدعم زر تثبيت TeacherHub. يمكنك متابعة استخدام المنصة من المتصفح."}</span>
            <button type="button" onClick={() => { setInstallDismissed(true); try { localStorage.setItem("th-install-dismissed", "1"); } catch { /* storage may be blocked */ } }} className="btn btn-ghost btn-icon btn-sm min-h-[44px] min-w-[44px] shrink-0" aria-label="إخفاء معلومات التثبيت">
              <Icon icon={X} size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
