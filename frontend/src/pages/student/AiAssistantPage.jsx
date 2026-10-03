import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { BookOpen, CalendarDays, Check, Copy, History, Lightbulb, ListChecks, MessageSquarePlus, Send, SlidersHorizontal, Sparkles } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import Modal from "../../components/ui/Modal";
import api from "../../services/api";
import { fmtDateShort } from "../../lib/format";
import { Select } from "../../components/ui/Form";

const SUGGESTIONS = [
  { text: "اشرحلي درس اليوم بطريقة بسيطة", icon: BookOpen, tone: "ct-video" },
  { text: "إيه الفرق بين الفاعل والمفعول به؟", icon: Lightbulb, tone: "ct-homework" },
  { text: "ساعدني أرتب جدول مذاكرة لأسبوع", icon: CalendarDays, tone: "ct-exam" },
  { text: "لخّصلي فكرة الجاذبية في 3 سطور", icon: ListChecks, tone: "ct-file" },
];
const TASK_LABELS = { chat: "محادثة عامة", explain: "شرح درس", summarize: "تلخيص درس", practice: "أسئلة تدريب", flashcards: "بطاقات مراجعة", mistakes: "شرح الأخطاء", study_plan: "خطة مذاكرة" };

/** The assistant's mark: a saffron-ringed sparkle, the same ring used on profile photos. */
function AssistantMark({ size = "sm" }) {
  const dim = size === "lg" ? "h-16 w-16" : "h-9 w-9";
  return (
    <span className={`grid shrink-0 place-items-center rounded-full p-[2px] ${dim}`} style={{ background: "var(--gold)" }} aria-hidden="true">
      <span className="grid h-full w-full place-items-center rounded-full bg-sidebar text-sidebar-ink"><Icon icon={Sparkles} size={size === "lg" ? 28 : 16} /></span>
    </span>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard not available */ }
  }
  return (
    <button type="button" onClick={copy} aria-label={copied ? "تم النسخ" : "نسخ الرد"} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-3 opacity-70 transition hover:bg-sunken hover:text-ink hover:opacity-100 focus-visible:opacity-100">
      <Icon icon={copied ? Check : Copy} size={16} className={copied ? "text-ok" : ""} />
    </button>
  );
}

export default function AiAssistantPage() {
  const { data: history, refetch: refetchHistory } = useApi("/student/ai/conversations");
  const { data: courseData } = useApi("/student/courses");
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [task, setTask] = useState("chat");
  const [courseId, setCourseId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const lessonUrl = courseId ? `/student/lessons?courseId=${encodeURIComponent(courseId)}` : null;
  const { data: lessonData } = useApi(lessonUrl, { enabled: Boolean(courseId) });
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!input && inputRef.current) inputRef.current.style.height = "auto";
  }, [input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function send(text) {
    text = text.trim();
    if (!text || sending) return;
    if (["explain", "summarize", "practice", "flashcards"].includes(task) && !lessonId) {
      toast.error("اختر كورسًا ودرسًا لهذه المساعدة.");
      return;
    }
    if (["mistakes", "study_plan"].includes(task) && !courseId) {
      toast.error("اختر كورسًا لتحليل الأخطاء أو إعداد خطة المذاكرة.");
      return;
    }

    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    try {
      const { data } = await api.post("/student/ai/message", {
        conversationId,
        message: text,
        task,
        courseId: courseId || undefined,
        lessonId: lessonId || undefined,
      });
      if (!conversationId) refetchHistory();
      setConversationId(data.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: data.reply.content }]);
    } catch (err) {
      toast.error(err.message);
      setMessages((m) => m.slice(0, -1)); // remove the optimistic user message on failure
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  function handleSend(e) {
    e.preventDefault();
    send(input);
  }

  function openConversation(c) {
    setConversationId(c.id);
    setMessages(c.messages.map((m) => ({ role: m.role, content: m.content })));
    setHistoryOpen(false);
  }
  function newChat() {
    setConversationId(null);
    setMessages([]);
    setHistoryOpen(false);
    inputRef.current?.focus();
  }

  const conversations = history?.conversations || [];
  const courseTitle = (courseData?.courses || []).find((c) => c.id === courseId)?.title;
  const HistoryList = (
    <div className="space-y-1">
      <Button variant="soft" icon={MessageSquarePlus} onClick={newChat} className="w-full mb-3">محادثة جديدة</Button>
      {conversations.length === 0 && <p className="text-sm text-ink-3 px-1 py-2">مفيش محادثات سابقة.</p>}
      {conversations.map((c) => {
        const first = c.messages.find((m) => m.role === "user")?.content || "محادثة";
        return (
          <button key={c.id} type="button" onClick={() => openConversation(c)} aria-current={c.id === conversationId ? "true" : undefined}
            className={`w-full text-start rounded-2xl px-3.5 py-3 transition-colors ${c.id === conversationId ? "bg-primary-soft" : "hover:bg-sunken"}`}>
            <span className="block text-sm font-semibold text-ink truncate">{first}</span>
            <span className="block text-xs text-ink-3 num">{fmtDateShort(c.createdAt)}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="h-[calc(100dvh-var(--topbar-h)-var(--tabbar-h)-env(safe-area-inset-bottom)-4.5rem)] lg:h-[calc(100dvh-var(--topbar-h)-5rem)] grid lg:grid-cols-[260px_minmax(0,1fr)] gap-5">
      <aside className="hidden lg:block panel p-3 overflow-y-auto" aria-label="المحادثات السابقة">
        <h2 className="px-1 pb-2 text-sm font-bold text-ink-2">المحادثات السابقة</h2>
        {HistoryList}
      </aside>

      <section className="panel flex flex-col min-h-0 overflow-hidden" aria-label="محادثة مع المساعد الذكي">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <AssistantMark />
            <div className="min-w-0">
              <h1 className="font-display font-bold text-ink leading-tight">المساعد الذكي</h1>
              <p className="text-xs text-ink-3" role="status">{sending ? "يكتب الآن..." : "اسأل في أي حاجة"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" icon={SlidersHorizontal} onClick={() => setCtxOpen((v) => !v)} aria-expanded={ctxOpen} aria-controls="ai-context">السياق</Button>
            <Button variant="ghost" size="sm" icon={History} onClick={() => setHistoryOpen(true)} className="lg:hidden">المحادثات</Button>
            <Button variant="ghost" size="sm" icon={MessageSquarePlus} onClick={newChat} className="hidden lg:inline-flex">محادثة جديدة</Button>
          </div>
        </header>

        <div className="border-b border-line bg-raised px-3 py-2.5 shrink-0">
          {!ctxOpen && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
              <span className="inline-flex h-7 items-center rounded-full bg-primary-soft px-3 font-bold text-primary-ink">{TASK_LABELS[task]}</span>
              {courseTitle && <span className="inline-flex h-7 items-center rounded-full bg-sunken px-3 font-semibold text-ink-2">{courseTitle}</span>}
              {!courseTitle && <span>افتح "السياق" لو عايز الشرح مبني على كورس أو درس معيّن.</span>}
            </p>
          )}
          {ctxOpen && (
            <div id="ai-context" className="grid sm:grid-cols-3 gap-2 anim-fade">
              <Select label="نوع المساعدة" value={task} onChange={(event) => setTask(event.target.value)}>
                <option value="chat">محادثة عامة</option><option value="explain">شرح درس</option><option value="summarize">تلخيص درس</option>
                <option value="practice">أسئلة تدريب</option><option value="flashcards">بطاقات مراجعة</option><option value="mistakes">شرح الأخطاء</option><option value="study_plan">خطة مذاكرة</option>
              </Select>
              <Select label="الكورس" value={courseId} onChange={(event) => { setCourseId(event.target.value); setLessonId(""); }}>
                <option value="">بدون سياق كورس</option>{(courseData?.courses || []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </Select>
              <Select label="الدرس" value={lessonId} disabled={!courseId} onChange={(event) => setLessonId(event.target.value)}>
                <option value="">اختر درسًا (اختياري للمحادثة)</option>{(lessonData?.lessons || []).map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
              </Select>
              <p className="sm:col-span-3 text-xs text-ink-3">بيانات الأداء تُحسب من سجلاتك الفعلية، والدروس تظهر فقط إذا كان حسابك مخولًا للوصول إليها.</p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
          {messages.length === 0 ? (
            <div className="min-h-full grid place-items-center text-center">
              <div className="w-full max-w-xl anim-rise">
                <div className="mx-auto w-fit"><AssistantMark size="lg" /></div>
                <h2 className="mt-4 font-display text-2xl font-bold text-ink">اسألني أي حاجة</h2>
                <p className="mt-1 text-sm text-ink-2">سؤال في المذاكرة، أو فكرة مش فاهمها، أو حتى كلام عادي.</p>
                <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 stagger">
                  {SUGGESTIONS.map((sg) => (
                    <li key={sg.text}>
                      <button type="button" onClick={() => send(sg.text)} className="group card card-interactive flex w-full items-center gap-3 p-3.5 text-start">
                        <span className={`ct ct-sm ${sg.tone}`}><Icon icon={sg.icon} size={18} /></span>
                        <span className="text-sm font-semibold leading-snug text-ink">{sg.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((m, i) => (
                m.role === "user" ? (
                  <div key={i} className="anim-rise flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-ss-md bg-primary px-4 py-3 text-[15px] leading-relaxed text-primary-on whitespace-pre-wrap shadow-1">{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className="anim-rise flex items-start gap-2.5">
                    <AssistantMark />
                    <div className="max-w-[88%] rounded-2xl rounded-ss-md border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink whitespace-pre-wrap shadow-1" style={{ borderInlineStartWidth: 3, borderInlineStartColor: "var(--pen)" }}>{m.content}</div>
                    <CopyButton text={m.content} />
                  </div>
                )
              ))}
              {sending && (
                <div className="flex items-start gap-2.5" role="status" aria-label="المساعد يكتب الآن">
                  <AssistantMark />
                  <div className="flex gap-1.5 rounded-2xl rounded-ss-md border border-line bg-surface px-4 py-4">
                    <span className="typing-dot h-2 w-2 rounded-full bg-ink-3" /><span className="typing-dot h-2 w-2 rounded-full bg-ink-3" /><span className="typing-dot h-2 w-2 rounded-full bg-ink-3" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="shrink-0 border-t border-line bg-raised p-3">
          <div className="flex items-end gap-2 rounded-3xl border border-line-strong bg-surface p-1.5 focus-within:border-primary-ink focus-within:shadow-[0_0_0_4px_var(--primary-soft-2)] transition-shadow">
            <textarea
              ref={inputRef}
              rows={1}
              className="max-h-32 min-h-[44px] w-full resize-none bg-transparent px-3.5 py-2.5 text-base text-ink outline-none placeholder:text-ink-3"
              aria-label="اكتب سؤالك"
              placeholder="اكتب أي سؤال..."
              value={input}
              onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            />
            <Button type="submit" iconOnly loading={sending} disabled={!input.trim() && !sending} aria-label="إرسال" className="!h-11 !w-11 shrink-0"><Icon icon={Send} size={20} className="-scale-x-100" /></Button>
          </div>
          <p className="mt-1.5 hidden px-2 text-[11px] text-ink-3 sm:block">Enter للإرسال، Shift + Enter لسطر جديد</p>
        </form>
      </section>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="المحادثات السابقة">{HistoryList}</Modal>
    </div>
  );
}
