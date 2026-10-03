import { Play } from "lucide-react";
import Cover from "../ui/Cover";

/** A video's cover (the teacher's thumbnail when there is one) with a play button on top. */
export default function VideoThumb({ video, onPlay }) {
  return (
    <button type="button" onClick={onPlay} aria-label={`تشغيل ${video.title}`} className="group relative block w-full text-start">
      <Cover seed={video.title + video.id} src={video.thumbnailUrl || undefined} />
      <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/25 group-focus-visible:bg-black/25">
        <span className="grid place-items-center w-14 h-14 rounded-full bg-raised/95 text-ink shadow-2 transition-transform group-hover:scale-105">
          <Play size={24} strokeWidth={0} fill="currentColor" aria-hidden="true" className="translate-x-[1px]" />
        </span>
      </span>
    </button>
  );
}
