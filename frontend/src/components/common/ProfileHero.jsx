import Avatar from "../ui/Avatar";

/**
 * The cover of a profile page: the same ruled notebook cover as the teacher's dashboard,
 * with the avatar in a saffron ring. Display only; the page passes in what to show.
 */
export default function ProfileHero({ name, avatarUrl, role, badges = [], stats = [] }) {
  return (
    <header className="relative mb-6 overflow-hidden rounded-3xl bg-sidebar text-sidebar-ink" style={{ "--ring": "var(--sb-ink)" }}>
      <svg className="absolute inset-0 h-full w-full text-sidebar-ink opacity-[0.07]" aria-hidden="true">
        <defs>
          <pattern id="profile-rule" width="100%" height="36" patternUnits="userSpaceOnUse"><line x1="0" y1="35" x2="100%" y2="35" stroke="currentColor" strokeWidth="1.5" /></pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#profile-rule)" />
      </svg>
      <div className="absolute inset-y-0 start-7 w-px bg-pen opacity-60" aria-hidden="true" />

      <div className="relative flex flex-col items-center gap-5 p-6 ps-12 text-center sm:flex-row sm:text-start md:p-8 md:ps-16">
        <span className="shrink-0 rounded-full p-1" style={{ background: "var(--gold)" }}>
          <Avatar name={name} src={avatarUrl || undefined} size="lg" className="!h-20 !w-20 !text-3xl ring-4 ring-[var(--sb)]" />
        </span>
        <div className="min-w-0 flex-1">
          {role && <p className="text-sm font-semibold text-sidebar-ink2">{role}</p>}
          <h1 className="font-display text-2xl font-bold leading-tight break-words md:text-3xl">{name}</h1>
          {badges.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {badges.map((b) => <span key={b} className="inline-flex h-7 items-center rounded-full bg-sidebar-hover px-3 text-xs font-bold text-sidebar-ink">{b}</span>)}
            </div>
          )}
        </div>
        {stats.length > 0 && (
          <dl className="grid shrink-0 grid-flow-col gap-2">
            {stats.map((st) => (
              <div key={st.label} className="flex min-w-[88px] flex-col-reverse rounded-2xl bg-sidebar-hover px-4 py-3 text-center">
                <dt className="mt-1 text-xs text-sidebar-ink2">{st.label}</dt>
                <dd className="num text-2xl font-bold leading-none">{st.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  );
}
