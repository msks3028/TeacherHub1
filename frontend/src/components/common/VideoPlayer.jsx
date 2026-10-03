import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle, Clock, Loader2, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Volume1, Volume2, VolumeX,
} from "lucide-react";
import Icon from "../ui/Icon";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SKIP_SECONDS = 10;
const HIDE_AFTER_MS = 2800;

const pad = (n) => String(n).padStart(2, "0");
function fmt(t) {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Circular arrow with "10" in the middle: back / forward 10 seconds. */
function SkipButton({ direction, onClick, size = 26 }) {
  const back = direction < 0;
  return (
    <button type="button" className="vp-btn relative" onClick={onClick} aria-label={back ? `رجوع ${SKIP_SECONDS} ثواني` : `تقديم ${SKIP_SECONDS} ثواني`} title={back ? "رجوع 10 ثواني (←)" : "تقديم 10 ثواني (→)"}>
      <Icon icon={back ? RotateCcw : RotateCw} size={size} />
      <span className="absolute inset-0 grid place-items-center text-[9px] font-bold num leading-none pt-px" aria-hidden="true">{SKIP_SECONDS}</span>
    </button>
  );
}

/**
 * The platform's video player.
 *  - shows the teacher's thumbnail (`video.thumbnailUrl`) until playback starts
 *  - play / pause, ±10 seconds, seek bar (buffered + hover time), volume,
 *    speed, fullscreen
 *  - keyboard: Space/K play, ←/→ (or J/L) ±10s, ↑/↓ volume, M mute, F fullscreen
 *  - touch: double-tap the left / right side to skip 10 seconds
 * The <video> tag streams from the protected endpoint — the browser sends the
 * auth cookie and the backend re-checks access on every request.
 */
export default function VideoPlayer({ video, className = "", showCaption = true }) {
  const src = `/api/files/video/${video.id}`;

  const boxRef = useRef(null);
  const videoRef = useRef(null);
  const barRef = useRef(null);
  const hideTimer = useRef(null);
  const flashTimer = useRef(null);
  const tapRef = useRef({ t: 0, side: null });
  const pointerType = useRef("mouse");
  const menuRef = useRef(false);

  const [errorMessage, setErrorMessage] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [hoverFrac, setHoverFrac] = useState(null);
  const [flash, setFlash] = useState(null); // { side: "back" | "forward", id }

  menuRef.current = menuOpen;

  const showControls = useCallback((autoHide = true) => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    if (!autoHide) return;
    hideTimer.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused && !menuRef.current) setControlsVisible(false);
    }, HIDE_AFTER_MS);
  }, []);

  useEffect(() => () => { clearTimeout(hideTimer.current); clearTimeout(flashTimer.current); }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === boxRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) v.play().catch(() => {});
    else v.pause();
  }, []);

  const skip = useCallback((delta) => {
    const v = videoRef.current;
    if (!v) return;
    const max = Number.isFinite(v.duration) ? v.duration : Infinity;
    v.currentTime = Math.min(Math.max(0, v.currentTime + delta), max);
    setTime(v.currentTime);
    setFlash({ side: delta < 0 ? "back" : "forward", id: Date.now() });
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 650);
  }, []);

  const setVol = useCallback((value) => {
    const v = videoRef.current;
    if (!v) return;
    const next = Math.min(1, Math.max(0, value));
    v.volume = next;
    v.muted = next === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted || v.volume === 0) {
      v.muted = false;
      if (v.volume === 0) v.volume = 0.6;
    } else {
      v.muted = true;
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = boxRef.current;
    const v = videoRef.current;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen(); // iPhone Safari: the system player takes over
  }, []);

  function changeRate(r) {
    if (videoRef.current) videoRef.current.playbackRate = r;
    setMenuOpen(false);
    showControls();
  }

  /* ----------------------------------------------------------- video events */
  function syncBuffered() {
    const v = videoRef.current;
    if (!v) return;
    const b = v.buffered;
    let end = 0;
    for (let i = 0; i < b.length; i++) {
      if (b.start(i) <= v.currentTime + 0.5 && b.end(i) >= end) end = b.end(i);
    }
    setBufferedEnd(end);
  }

  // When the browser can't play the video it gives no reason at all — just a
  // blank player. Ask the same protected endpoint again (asking for only the
  // first byte) so we can show the real reason returned by the server:
  // file missing, expired, not available yet, no access, or session ended.
  async function handleError() {
    try {
      const res = await fetch(src, { credentials: "include", headers: { Range: "bytes=0-0" } });
      if (res.ok) {
        // The server is fine, so the browser itself couldn't decode this file.
        setErrorMessage("المتصفح لا يستطيع تشغيل صيغة هذا الفيديو. الأفضل رفع الفيديو بصيغة MP4 (H.264 + AAC) لضمان التشغيل.");
        return;
      }
      let message = null;
      try {
        message = (await res.json()).message;
      } catch {
        /* response wasn't JSON */
      }
      setErrorMessage(message || `تعذّر تحميل الفيديو (${res.status}).`);
    } catch {
      setErrorMessage("تعذّر الاتصال بالسيرفر. تأكد أن الـ backend شغّال.");
    }
  }

  /* --------------------------------------------------------------- gestures */
  const zoneOf = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    return x < 0.33 ? "left" : x > 0.67 ? "right" : "center";
  };

  function onSurfaceClick(e) {
    boxRef.current?.focus({ preventScroll: true });
    if (pointerType.current === "touch") {
      // Touch: a single tap shows / hides the controls, a double tap on the
      // left or right side skips 10 seconds.
      const side = zoneOf(e);
      const now = Date.now();
      const last = tapRef.current;
      if (now - last.t < 320 && last.side === side && side !== "center") {
        tapRef.current = { t: 0, side: null };
        skip(side === "left" ? -SKIP_SECONDS : SKIP_SECONDS);
        showControls();
        return;
      }
      tapRef.current = { t: now, side };
      if (controlsVisible && playing) setControlsVisible(false);
      else showControls();
      return;
    }
    togglePlay();
  }

  function onSurfaceDoubleClick(e) {
    if (pointerType.current === "touch") return;
    const zone = zoneOf(e);
    if (zone === "left") skip(-SKIP_SECONDS);
    else if (zone === "right") skip(SKIP_SECONDS);
    else toggleFullscreen();
  }

  function onKeyDown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = e.target.tagName;
    switch (e.key) {
      case " ":
      case "k":
      case "K":
        if (tag === "BUTTON" && e.key === " ") return; // let the button handle its own click
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowLeft":
      case "j":
      case "J":
        if (tag === "INPUT") return;
        e.preventDefault();
        skip(-SKIP_SECONDS);
        break;
      case "ArrowRight":
      case "l":
      case "L":
        if (tag === "INPUT") return;
        e.preventDefault();
        skip(SKIP_SECONDS);
        break;
      case "ArrowUp":
        if (tag === "INPUT") return;
        e.preventDefault();
        setVol((videoRef.current?.muted ? 0 : videoRef.current?.volume ?? 1) + 0.1);
        break;
      case "ArrowDown":
        if (tag === "INPUT") return;
        e.preventDefault();
        setVol((videoRef.current?.volume ?? 1) - 0.1);
        break;
      case "m":
      case "M":
        toggleMute();
        break;
      case "f":
      case "F":
        toggleFullscreen();
        break;
      default:
        return;
    }
    showControls();
  }

  /* --------------------------------------------------------------- seek bar */
  const fracFromEvent = (e) => {
    const rect = barRef.current.getBoundingClientRect();
    return Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
  };

  function onBarDown(e) {
    if (!duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(true);
    setScrubTime(fracFromEvent(e) * duration);
  }
  function onBarMove(e) {
    const f = fracFromEvent(e);
    setHoverFrac(f);
    if (scrubbing) setScrubTime(f * duration);
  }
  function onBarUp(e) {
    if (!scrubbing) return;
    const t = fracFromEvent(e) * duration;
    if (videoRef.current) videoRef.current.currentTime = t;
    setTime(t);
    setScrubbing(false);
  }

  /* ------------------------------------------------------------------ render */
  if (video.isExpired) {
    return (
      <figure className={`card overflow-hidden ${className}`}>
        <div className="aspect-video grid place-items-center bg-sunken text-center px-6">
          <div>
            <span className="ct ct-warn !rounded-full mx-auto"><Icon icon={Clock} size={20} /></span>
            <p className="mt-3 text-sm font-semibold text-ink">انتهت صلاحية هذا الفيديو ولم يعد متاحًا للمشاهدة.</p>
          </div>
        </div>
        <figcaption className="p-4">
          <h4 className="font-semibold text-ink">{video.title}</h4>
        </figcaption>
      </figure>
    );
  }

  const shownTime = scrubbing ? scrubTime : time;
  const playedPct = duration ? (shownTime / duration) * 100 : 0;
  const bufferedPct = duration ? (bufferedEnd / duration) * 100 : 0;
  const visible = controlsVisible || !playing || scrubbing || menuOpen;
  const volPct = (muted ? 0 : volume) * 100;
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <figure className={`card overflow-hidden ${className}`}>
      <div
        ref={boxRef}
        dir="ltr"
        tabIndex={0}
        role="group"
        aria-label={`مشغّل الفيديو: ${video.title}`}
        className={`vp relative aspect-video bg-black select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${playing && !visible ? "cursor-none" : ""}`}
        onKeyDown={onKeyDown}
        onMouseMove={() => showControls()}
        onMouseLeave={() => { if (playing) { clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => !menuRef.current && setControlsVisible(false), 600); } }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <video
          ref={videoRef}
          src={src}
          poster={video.thumbnailUrl || undefined}
          preload="metadata"
          playsInline
          disablePictureInPicture
          controlsList="nodownload noplaybackrate"
          className="absolute inset-0 w-full h-full object-contain"
          onError={handleError}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => { if (!scrubbing) setTime(e.currentTarget.currentTime); syncBuffered(); }}
          onProgress={syncBuffered}
          onPlay={() => { setPlaying(true); setEnded(false); showControls(); }}
          onPause={() => { setPlaying(false); setControlsVisible(true); clearTimeout(hideTimer.current); }}
          onEnded={() => { setPlaying(false); setEnded(true); setControlsVisible(true); }}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onCanPlay={() => setWaiting(false)}
          onSeeked={() => setWaiting(false)}
          onVolumeChange={(e) => { setVolume(e.currentTarget.volume); setMuted(e.currentTarget.muted); }}
          onRateChange={(e) => setRate(e.currentTarget.playbackRate)}
        />

        {/* tap / click surface (the video itself has no native controls) */}
        <div
          className="absolute inset-0"
          onPointerDown={(e) => { pointerType.current = e.pointerType; }}
          onClick={onSurfaceClick}
          onDoubleClick={onSurfaceDoubleClick}
        />

        {/* "10" feedback when skipping */}
        {flash && (
          <div key={flash.id} className={`vp-flash pointer-events-none absolute top-1/2 -translate-y-1/2 ${flash.side === "back" ? "left-[12%]" : "right-[12%]"}`}>
            <span className="relative grid place-items-center w-16 h-16 rounded-full bg-black/55 text-white">
              <Icon icon={flash.side === "back" ? RotateCcw : RotateCw} size={40} />
              <span className="absolute inset-0 grid place-items-center text-sm font-bold num pt-0.5">{SKIP_SECONDS}</span>
            </span>
          </div>
        )}

        {/* spinner while buffering */}
        {waiting && playing && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Icon icon={Loader2} size={44} className="animate-spin text-white/90" />
          </div>
        )}

        {/* big centre button: before the first play, when paused, and at the end */}
        {!playing && !scrubbing && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            aria-label={ended ? "إعادة التشغيل" : "تشغيل"}
            className="absolute inset-0 m-auto w-[68px] h-[68px] rounded-full grid place-items-center bg-primary text-primary-on shadow-3 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {ended ? <Icon icon={RotateCcw} size={30} /> : <Play size={30} strokeWidth={0} fill="currentColor" aria-hidden="true" className="translate-x-[2px]" />}
          </button>
        )}

        {/* title while in fullscreen */}
        {fullscreen && (
          <div className={`pointer-events-none absolute inset-x-0 top-0 px-5 pt-4 pb-10 bg-gradient-to-b from-black/70 to-transparent text-white font-semibold text-lg transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`} dir="auto">
            {video.title}
          </div>
        )}

        {/* control bar */}
        <div
          className={`absolute inset-x-0 bottom-0 px-3 pt-14 pb-2 bg-gradient-to-t from-black/85 via-black/45 to-transparent text-white transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {/* seek bar */}
          <div
            ref={barRef}
            role="slider"
            tabIndex={0}
            aria-label="شريط التقدّم"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration) || 0}
            aria-valuenow={Math.round(shownTime)}
            aria-valuetext={`${fmt(shownTime)} من ${fmt(duration)}`}
            className="group/bar relative h-5 flex items-center cursor-pointer touch-none"
            onPointerDown={onBarDown}
            onPointerMove={onBarMove}
            onPointerUp={onBarUp}
            onPointerCancel={() => setScrubbing(false)}
            onPointerLeave={() => setHoverFrac(null)}
          >
            <div className="relative w-full h-1 group-hover/bar:h-1.5 rounded-full bg-white/25 transition-[height]">
              <div className="absolute inset-y-0 left-0 rounded-full bg-white/35" style={{ width: `${bufferedPct}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${playedPct}%` }} />
              <div className={`absolute top-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-2 -translate-x-1/2 -translate-y-1/2 transition-transform ${scrubbing ? "scale-125" : "scale-0 group-hover/bar:scale-100"}`} style={{ left: `${playedPct}%` }} />
            </div>
            {hoverFrac !== null && duration > 0 && (
              <span className="pointer-events-none absolute bottom-6 -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 text-xs num" style={{ left: `${hoverFrac * 100}%` }}>
                {fmt(hoverFrac * duration)}
              </span>
            )}
          </div>

          {/* buttons */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button type="button" className="vp-btn" onClick={togglePlay} aria-label={playing ? "إيقاف مؤقت" : "تشغيل"} title={playing ? "إيقاف مؤقت (Space)" : "تشغيل (Space)"}>
              {playing ? <Pause size={22} strokeWidth={0} fill="currentColor" aria-hidden="true" /> : <Play size={22} strokeWidth={0} fill="currentColor" aria-hidden="true" />}
            </button>
            <SkipButton direction={-1} onClick={() => skip(-SKIP_SECONDS)} />
            <SkipButton direction={1} onClick={() => skip(SKIP_SECONDS)} />

            <div className="group/vol flex items-center">
              <button type="button" className="vp-btn" onClick={toggleMute} aria-label={muted || volume === 0 ? "إلغاء الكتم" : "كتم الصوت"} title="كتم (M)">
                <Icon icon={VolumeIcon} size={22} />
              </button>
              <input
                type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
                onChange={(e) => setVol(Number(e.target.value))}
                aria-label="مستوى الصوت"
                className="vp-range hidden sm:block w-0 opacity-0 group-hover/vol:w-20 group-hover/vol:opacity-100 group-hover/vol:mx-2 focus-visible:w-20 focus-visible:opacity-100 focus-visible:mx-2 transition-all duration-200"
                style={{ "--v": `${volPct}%` }}
              />
            </div>

            <span className="ms-1.5 text-[13px] num whitespace-nowrap tabular-nums" aria-hidden="true">
              {fmt(shownTime)} <span className="text-white/60">/ {fmt(duration)}</span>
            </span>

            <span className="flex-1" />

            <div className="relative">
              <button type="button" className="vp-btn !w-auto px-2.5 text-[13px] font-bold num" onClick={() => { setMenuOpen((o) => !o); showControls(false); }} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="سرعة التشغيل" title="سرعة التشغيل">
                {rate === 1 ? "1x" : `${rate}x`}
              </button>
              {menuOpen && (
                <ul role="menu" className="absolute bottom-11 right-0 min-w-[92px] rounded-lg bg-black/90 backdrop-blur py-1 shadow-3 border border-white/10">
                  {SPEEDS.map((r) => (
                    <li key={r} role="none">
                      <button type="button" role="menuitemradio" aria-checked={r === rate} onClick={() => changeRate(r)} className={`w-full px-3 py-1.5 text-start text-sm num hover:bg-white/15 ${r === rate ? "font-bold text-white" : "text-white/80"}`}>
                        {r === 1 ? "عادية" : `${r}x`}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button type="button" className="vp-btn" onClick={toggleFullscreen} aria-label={fullscreen ? "إغلاق ملء الشاشة" : "ملء الشاشة"} title="ملء الشاشة (F)">
              <Icon icon={fullscreen ? Minimize : Maximize} size={22} />
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div role="alert" className="flex items-start gap-2.5 px-4 py-3 bg-bad-bg text-bad text-sm">
          <Icon icon={AlertCircle} size={16} className="mt-1 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {showCaption && (
        <figcaption className="p-4">
          <h4 className="font-semibold text-ink">{video.title}</h4>
          {video.description && <p className="text-sm text-ink-2 mt-1">{video.description}</p>}
        </figcaption>
      )}
    </figure>
  );
}
