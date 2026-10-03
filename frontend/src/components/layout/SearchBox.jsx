import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { SearchInput } from "../ui/Form";
import ContentIcon from "../ui/ContentIcon";
import Avatar from "../ui/Avatar";

const GROUPS = {
  TEACHER: {
    students: { label: "الطلاب", to: () => "/teacher/students", title: (r) => r.fullName },
    courses: { label: "الكورسات", type: "file", to: (r) => `/teacher/courses/${r.id}`, title: (r) => r.title },
    videos: { label: "الفيديوهات", type: "video", to: () => "/teacher/videos", title: (r) => r.title },
    homework: { label: "الواجبات", type: "homework", to: () => "/teacher/homework", title: (r) => r.title },
    exams: { label: "الاختبارات", type: "exam", to: () => "/teacher/exams", title: (r) => r.title },
    materials: { label: "الملفات", type: "file", to: () => "/teacher/materials", title: (r) => r.title },
    announcements: { label: "الإعلانات", type: "note", to: () => "/teacher/announcements", title: (r) => r.title },
  },
  STUDENT: {
    courses: { label: "الكورسات", type: "file", to: (r) => `/student/courses/${r.id}`, title: (r) => r.title },
    videos: { label: "الفيديوهات", type: "video", to: () => "/student/videos", title: (r) => r.title },
    homework: { label: "الواجبات", type: "homework", to: () => "/student/homework", title: (r) => r.title },
    materials: { label: "الملازم", type: "file", to: () => "/student/materials", title: (r) => r.title },
  },
};

/** Quick search wired to /api/teacher/search and /api/student/search. */
export default function SearchBox({ role, autoFocus = false, onNavigate, className = "" }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [state, setState] = useState({ loading: false, results: null, error: false });
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const groups = GROUPS[role] || GROUPS.STUDENT;
  const base = role === "TEACHER" ? "/teacher/search" : "/student/search";

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setState({ loading: false, results: null, error: false }); return undefined; }
    setState((s) => ({ ...s, loading: true }));
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`${base}?q=${encodeURIComponent(term)}`);
        if (alive) setState({ loading: false, results: data.results || {}, error: false });
      } catch {
        if (alive) setState({ loading: false, results: null, error: true });
      }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q, base]);

  useEffect(() => {
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const sections = Object.entries(groups)
    .map(([key, g]) => ({ key, g, items: state.results?.[key] || [] }))
    .filter((s) => s.items.length > 0);
  const showPanel = open && q.trim().length >= 2;

  function go(path) {
    setOpen(false);
    setQ("");
    onNavigate?.();
    navigate(path);
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <SearchInput value={q} onChange={(v) => { setQ(v); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="ابحث في المنصة..." autoFocus={autoFocus} />
      {showPanel && (
        <div className="absolute z-40 mt-2 w-full max-h-[60dvh] overflow-y-auto card !shadow-3 p-2" role="listbox" aria-label="نتائج البحث">
          {state.loading && <p className="px-3 py-3 text-sm text-ink-3">جارِ البحث...</p>}
          {!state.loading && state.error && <p className="px-3 py-3 text-sm text-bad">تعذّر البحث. حاول مرة أخرى.</p>}
          {!state.loading && !state.error && sections.length === 0 && <p className="px-3 py-3 text-sm text-ink-3">مفيش نتائج لـ «{q.trim()}».</p>}
          {sections.map(({ key, g, items }) => (
            <div key={key} className="py-1">
              <p className="px-3 py-1 text-xs font-semibold text-ink-3">{g.label}</p>
              {items.map((r) => (
                <button key={r.id} type="button" role="option" className="menu-item !min-h-[44px]" onClick={() => go(g.to(r))}>
                  {key === "students" ? <Avatar name={g.title(r)} size="sm" /> : <ContentIcon type={g.type} size="sm" />}
                  <span className="truncate">{g.title(r)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
