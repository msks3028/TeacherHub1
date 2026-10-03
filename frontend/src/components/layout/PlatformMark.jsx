import { usePlatform } from "../../context/PlatformContext";

/** The teacher's logo (or a letter mark) + platform name. */
export default function PlatformMark({ size = 36, showName = true, className = "", nameClass = "" }) {
  const { settings, name } = usePlatform();
  return (
    <span className={`flex items-center gap-3 min-w-0 ${className}`}>
      {settings?.logoUrl ? (
        <img src={settings.logoUrl} alt="" className="rounded object-contain bg-white shrink-0" style={{ width: size, height: size }} />
      ) : (
        <span className="grid place-items-center rounded bg-primary text-primary-on font-display font-bold shrink-0" style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden="true">
          {name.trim()[0]?.toUpperCase() || "T"}
        </span>
      )}
      {showName && <span className={`font-display font-bold truncate ${nameClass}`}>{name}</span>}
    </span>
  );
}
