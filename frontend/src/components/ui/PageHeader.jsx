import { Link } from "react-router-dom";
import Icon, { ArrowBack } from "./Icon";

/** Same title block on every page: title · short description · main action. */
export default function PageHeader({ title, description, actions, back, className = "" }) {
  return (
    <header className={`mb-6 md:mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${className}`}>
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="inline-flex items-center gap-1.5 mb-2 -ms-1 px-1 py-1 text-sm font-medium text-ink-3 hover:text-ink rounded transition-colors">
            <Icon icon={ArrowBack} size={16} />
            {back.label}
          </Link>
        )}
        <h1 className="font-display text-2xl md:text-3xl font-bold text-ink leading-tight">{title}</h1>
        {description && <p className="mt-1.5 text-sm md:text-base text-ink-2 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
