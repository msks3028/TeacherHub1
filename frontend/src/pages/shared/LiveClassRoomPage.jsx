import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Camera, CameraOff, LogOut, Maximize2, MessageSquare, Mic, MicOff, Minimize2, MonitorUp, PhoneOff, Send, UserRound, Users, X } from "lucide-react";
import { Room, RoomEvent, Track } from "livekit-client";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import { useConfirm } from "../../context/ConfirmContext";
import { ErrorState, LoadingState } from "../../components/common/StateViews";

function TrackView({ track, muted = false }) {
  const elementRef = useRef(null);
  useEffect(() => {
    if (!track || !elementRef.current) return undefined;
    track.attach(elementRef.current);
    return () => track.detach(elementRef.current);
  }, [track]);
  return track.kind === Track.Kind.Video
    ? <video ref={elementRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
    : <audio ref={elementRef} autoPlay />;
}

function ParticipantTile({ participant, local = false, featured = false }) {
  const videoTracks = [...participant.videoTrackPublications.values()].map((publication) => publication.track).filter(Boolean);
  const audioTracks = local ? [] : [...participant.audioTrackPublications.values()].map((publication) => publication.track).filter(Boolean);
  const micOff = participant.isMicrophoneEnabled === false;
  return <article className="relative aspect-video w-full min-w-0 overflow-hidden rounded-2xl" style={{ background: "#141B33" }} aria-label={`مشارك: ${participant.name || "طالب"}`}>
    {videoTracks.length ? videoTracks.map((track) => <TrackView key={track.sid} track={track} muted={local} />) : <div className="absolute inset-0 grid place-items-center"><span className={`grid place-items-center rounded-full bg-white/10 text-white ${featured ? "h-20 w-20" : "h-12 w-12"}`}><UserRound size={featured ? 34 : 22} /></span><span className="sr-only">الكاميرا مغلقة</span></div>}
    {audioTracks.map((track) => <TrackView key={track.sid} track={track} />)}
    <span className="absolute bottom-2 inset-x-2 flex items-center gap-1.5">
      <span className="min-w-0 truncate rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">{participant.name || "مشارك"}{local ? " (أنت)" : ""}</span>
      {micOff && <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-black/60 text-white" role="img" aria-label="الميكروفون مكتوم"><MicOff size={13} /></span>}
    </span>
  </article>;
}

function RoundControl({ on, danger, icon, label, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on} aria-label={label} title={label}
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border transition-all duration-150 active:scale-95 disabled:opacity-50 ${danger ? "border-transparent bg-bad-solid text-white hover:brightness-95" : on ? "border-transparent bg-primary text-primary-on" : "border-line-strong bg-surface text-ink hover:bg-sunken"}`}>
      <Icon icon={icon} size={20} />
    </button>
  );
}

export default function LiveClassRoomPage() {
  const { liveClassId } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const teacher = user?.role === "TEACHER";
  const [room, setRoom] = useState(null);
  const [classTitle, setClassTitle] = useState("الحصة المباشرة");
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [microphoneOn, setMicrophoneOn] = useState(false);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const chatEndRef = useRef(null);
  const stageRef = useRef(null);
  const confirm = useConfirm();
  const [panel, setPanel] = useState("chat");
  const [fullscreen, setFullscreen] = useState(false);
  const participantList = useMemo(() => room ? [room.localParticipant, ...room.remoteParticipants.values()] : [], [room, revision]);

  useEffect(() => {
    let active = true;
    let connectedRoom;
    const load = async () => {
      try {
        const credentials = location.state?.liveKitToken && location.state?.liveKitUrl
          ? { token: location.state.liveKitToken, url: location.state.liveKitUrl, liveClass: location.state.liveClass }
          : (await api.post(`${teacher ? "/teacher" : "/student"}/live-classes/${liveClassId}/join`)).data;
        if (credentials.liveClass?.title) setClassTitle(credentials.liveClass.title);
        const nextRoom = new Room({ adaptiveStream: true, dynacast: true });
        connectedRoom = nextRoom;
        const update = () => setRevision((value) => value + 1);
        nextRoom.on(RoomEvent.ParticipantConnected, update);
        nextRoom.on(RoomEvent.ParticipantDisconnected, update);
        nextRoom.on(RoomEvent.TrackSubscribed, update);
        nextRoom.on(RoomEvent.TrackUnsubscribed, update);
        nextRoom.on(RoomEvent.TrackPublished, update);
        nextRoom.on(RoomEvent.TrackUnpublished, update);
        nextRoom.on(RoomEvent.TrackMuted, update);
        nextRoom.on(RoomEvent.TrackUnmuted, update);
        nextRoom.on(RoomEvent.Disconnected, () => { if (active) setStatus("disconnected"); });
        nextRoom.on(RoomEvent.DataReceived, (payload, sender, _kind, topic) => {
          if (topic !== "teacherhub-class-chat" || !sender) return;
          try {
            const item = JSON.parse(new TextDecoder().decode(payload));
            if (typeof item.text === "string" && item.text.length <= 1000) setChat((current) => [...current.slice(-99), { id: `${Date.now()}-${Math.random()}`, name: sender.name || "مشارك", text: item.text }]);
          } catch { /* ignore malformed classroom chat packets */ }
        });
        await nextRoom.connect(credentials.url, credentials.token);
        if (active) { setRoom(nextRoom); setStatus("connected"); }
      } catch (err) {
        if (active) { setError(err.message || "تعذّر الانضمام للحصة."); setStatus("error"); }
        connectedRoom?.disconnect();
      }
    };
    load();
    return () => { active = false; connectedRoom?.disconnect(); };
  }, [liveClassId, location.state, teacher]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen?.();
    } catch { /* fullscreen not allowed on this device */ }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [chat]);

  const refreshParticipants = useCallback(async () => {
    if (!teacher || !room) return;
    try {
      const { data } = await api.get(`/teacher/live-classes/${liveClassId}/participants`);
      setParticipants(data.participants || []);
    } catch { /* transiently unavailable; room connection remains usable */ }
  }, [liveClassId, room, teacher]);

  useEffect(() => {
    if (!room || !teacher) return undefined;
    refreshParticipants();
    const interval = window.setInterval(refreshParticipants, 10000);
    return () => window.clearInterval(interval);
  }, [refreshParticipants, room, teacher]);

  async function toggleMedia(kind) {
    if (!room) return;
    try {
      if (kind === "camera") {
        await room.localParticipant.setCameraEnabled(!cameraOn, { resolution: { width: 640, height: 360 } });
        setCameraOn(!cameraOn);
      } else if (kind === "microphone") {
        await room.localParticipant.setMicrophoneEnabled(!microphoneOn);
        setMicrophoneOn(!microphoneOn);
      } else {
        await room.localParticipant.setScreenShareEnabled(!screenShareOn);
        setScreenShareOn(!screenShareOn);
      }
      setRevision((value) => value + 1);
    } catch (err) { toast.error(err.message || "تعذّر تشغيل الجهاز."); }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = message.trim().slice(0, 1000);
    if (!room || !text || busy) return;
    setBusy(true);
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ text }));
      await room.localParticipant.publishData(payload, { reliable: true, topic: "teacherhub-class-chat" });
      setChat((current) => [...current.slice(-99), { id: `${Date.now()}-self`, name: "أنت", text }]);
      setMessage("");
    } catch (err) { toast.error(err.message || "تعذّر إرسال الرسالة."); }
    finally { setBusy(false); }
  }

  async function moderate(identity, action) {
    try {
      await api.post(`/teacher/live-classes/${liveClassId}/participants/${encodeURIComponent(identity)}/${action}`);
      await refreshParticipants();
      toast.success(action === "remove" ? "تم إخراج الطالب." : "تم كتم الميكروفون.");
    } catch (err) { toast.error(err.message); }
  }

  async function leave(endForAll = false) {
    if (endForAll && teacher && !(await confirm({ title: "إنهاء الحصة", message: "هيتم إنهاء الحصة لجميع المشاركين. هل تريد المتابعة؟", confirmLabel: "أنهِ الحصة" }))) return;
    setBusy(true);
    try {
      if (endForAll && teacher) await api.post(`/teacher/live-classes/${liveClassId}/end`);
      room?.disconnect();
      navigate(teacher ? "/teacher/live-classes" : "/student/live-classes", { replace: true });
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  }

  if (status === "connecting") return <LoadingState variant="panel" label="جارِ الاتصال بغرفة الحصة…" />;
  if (status === "error") return <ErrorState message={error} onRetry={() => navigate(0)} />;
  if (status === "disconnected") return <ErrorState message="انقطع الاتصال بغرفة الحصة." onRetry={() => navigate(0)} />;

  const featured = participantList.find((participant) => participant !== room.localParticipant) || room.localParticipant;
  const others = participantList.filter((participant) => participant !== featured);
  const tabs = teacher ? [["chat", "المحادثة", MessageSquare], ["people", `الطلاب (${participants.length})`, Users]] : [["chat", "المحادثة", MessageSquare]];

  return <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-bad"><span className="relative flex h-2.5 w-2.5" aria-hidden="true"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pen opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pen" /></span>مباشر الآن · <span className="num">{participantList.length}</span> متصل</p>
        <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-ink break-words md:text-3xl">{classTitle}</h1>
        <p className="mt-1 text-sm text-ink-3">الاتصال مشفّر عبر مزوّد الفيديو.</p>
      </div>
      <Button variant="secondary" icon={LogOut} onClick={() => leave(false)} disabled={busy}>مغادرة الحصة</Button>
    </header>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <section ref={stageRef} aria-label="غرفة الفيديو" className={`rounded-3xl p-3 sm:p-4 ${fullscreen ? "overflow-y-auto" : ""}`} style={{ background: "#0A0F1F" }}>
        <div className="relative">
          <ParticipantTile participant={featured} local={featured === room.localParticipant} featured />
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"} title={fullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"} className="absolute top-2.5 end-2.5 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75">
            <Icon icon={fullscreen ? Minimize2 : Maximize2} size={18} />
          </button>
        </div>
        {others.length > 0 && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">{others.map((participant) => <ParticipantTile key={participant.identity} participant={participant} local={participant === room.localParticipant} />)}</div>}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-full bg-white/10 p-2.5 sm:w-fit sm:mx-auto" role="group" aria-label="عناصر التحكم في الحصة">
          <RoundControl on={microphoneOn} danger={!microphoneOn} icon={microphoneOn ? Mic : MicOff} label={microphoneOn ? "كتم الميكروفون" : "تشغيل الميكروفون"} onClick={() => toggleMedia("microphone")} />
          <RoundControl on={cameraOn} danger={!cameraOn} icon={cameraOn ? Camera : CameraOff} label={cameraOn ? "إيقاف الكاميرا" : "تشغيل الكاميرا"} onClick={() => toggleMedia("camera")} />
          <RoundControl on={screenShareOn} icon={MonitorUp} label={screenShareOn ? "إيقاف مشاركة الشاشة" : "مشاركة الشاشة"} onClick={() => toggleMedia("screen")} />
          {teacher && <Button variant="dangerSolid" icon={PhoneOff} onClick={() => leave(true)} disabled={busy}>إنهاء الحصة للجميع</Button>}
        </div>
      </section>

      <aside className="panel flex flex-col overflow-hidden xl:h-[calc(100dvh-var(--topbar-h)-12rem)] xl:min-h-[28rem]" aria-label="محادثة ومشاركو الحصة">
        <div className="flex gap-1 border-b border-line p-2" role="tablist" aria-label="لوحة الحصة">
          {tabs.map(([key, label, icon]) => (
            <button key={key} type="button" role="tab" aria-selected={panel === key} onClick={() => setPanel(key)} className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm font-bold transition-colors ${panel === key ? "bg-primary-soft text-primary-ink" : "text-ink-3 hover:bg-sunken"}`}>
              <Icon icon={icon} size={16} />{label}
            </button>
          ))}
        </div>

        {teacher && panel === "people" ? (
          <section className="flex-1 overflow-y-auto p-3" role="tabpanel" aria-label="الطلاب المتصلون">
            {participants.length ? <ul className="space-y-2">{participants.map((participant) => <li key={participant.identity} className="flex items-center gap-2 rounded-2xl bg-sunken p-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary-ink" aria-hidden="true">{(participant.name || "؟").trim().charAt(0)}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{participant.name}</span>
              <Button size="sm" variant="ghost" onClick={() => moderate(participant.identity, "mute")} aria-label={`كتم ${participant.name}`} icon={MicOff}>كتم</Button>
              <Button size="sm" variant="danger" iconOnly onClick={() => moderate(participant.identity, "remove")} aria-label={`إخراج ${participant.name}`}><X size={16} aria-hidden="true" /></Button>
            </li>)}</ul> : <p className="py-10 text-center text-sm text-ink-3">لا يوجد طلاب متصلون الآن.</p>}
          </section>
        ) : (
          <section className="flex min-h-0 flex-1 flex-col" role="tabpanel" aria-label="محادثة الحصة">
            <ul className="min-h-40 flex-1 space-y-2.5 overflow-y-auto p-3" aria-live="polite" aria-relevant="additions">
              {chat.map((item) => item.name === "أنت"
                ? <li key={item.id} className="flex justify-start"><span className="max-w-[88%] break-words rounded-2xl rounded-ss-md bg-primary px-3.5 py-2 text-sm text-primary-on">{item.text}</span></li>
                : <li key={item.id} className="max-w-[92%] break-words rounded-2xl rounded-ss-md bg-sunken px-3.5 py-2 text-sm text-ink"><span className="block text-xs font-bold text-primary-ink">{item.name}</span>{item.text}</li>)}
              {!chat.length && <li className="grid place-items-center py-10 text-center text-sm text-ink-3">ابدأ المحادثة مع المشاركين.</li>}
              <li ref={chatEndRef} aria-hidden="true" />
            </ul>
            <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-line p-3">
              <label className="sr-only" htmlFor="class-chat-message">اكتب رسالة للحصة</label>
              <input id="class-chat-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} className="input min-w-0 flex-1" placeholder="اكتب رسالة…" />
              <Button type="submit" iconOnly disabled={!message.trim() || busy} aria-label="إرسال رسالة"><Icon icon={Send} size={18} className="-scale-x-100" /></Button>
            </form>
          </section>
        )}
      </aside>
    </div>
  </div>;
}
