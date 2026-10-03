import { useRef, useState } from "react";
import { PlayCircle } from "lucide-react";
import Cover from "../ui/Cover";
import Icon from "../ui/Icon";
import VideoPlayer from "./VideoPlayer";
import { fmtDate } from "../../lib/format";

/**
 * Display-only "theatre + playlist" for a list of videos: one big player for the
 * selected video and the rest as thumbnails you tap to switch to. Only one
 * <video> is mounted at a time, which is also much lighter on weak phones than
 * a player per card. The player itself (VideoPlayer) is unchanged.
 */
export default function VideoGallery({ videos }) {
  const [activeId, setActiveId] = useState(videos[0]?.id ?? null);
  const theater = useRef(null);
  const active = videos.find((v) => v.id === activeId) || videos[0];
  if (!active) return null;

  if (videos.length === 1) {
    return <div className="max-w-3xl"><VideoPlayer video={active} /></div>;
  }

  function pick(id) {
    setActiveId(id);
    const el = theater.current;
    if (el && el.getBoundingClientRect().top < 0) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <div ref={theater} className="min-w-0 scroll-mt-24">
        <VideoPlayer key={active.id} video={active} />
      </div>

      <aside aria-label="قائمة الفيديوهات" className="min-w-0 xl:sticky xl:top-[calc(var(--topbar-h)+16px)]">
        <h3 className="mb-3 text-sm font-bold text-ink-2">
          كل الفيديوهات <span className="num text-ink-3 font-medium">({videos.length})</span>
        </h3>
        <ul className="space-y-2 xl:max-h-[calc(100dvh-180px)] xl:overflow-y-auto xl:pe-1 stagger">
          {videos.map((v) => {
            const isActive = v.id === active.id;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => pick(v.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`group flex w-full items-center gap-3 rounded-xl border p-2 text-start transition-colors ${
                    isActive ? "border-primary-ink bg-primary-soft" : "border-line bg-surface hover:bg-sunken"
                  }`}
                >
                  <span className="relative block w-[132px] shrink-0 overflow-hidden rounded-lg">
                    <Cover seed={v.title + v.id} src={v.thumbnailUrl} ratio="16 / 9" />
                    <span className="absolute inset-0 grid place-items-center">
                      {isActive ? (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-on">يُشغَّل الآن</span>
                      ) : (
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-raised text-ink shadow-1 transition-transform duration-200 group-hover:scale-110">
                          <Icon icon={PlayCircle} size={20} />
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-snug text-ink line-clamp-2">{v.title}</span>
                    {v.createdAt && <span className="mt-1 block text-xs text-ink-3 num">{fmtDate(v.createdAt)}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
