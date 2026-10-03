import { useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { BarChart3, Film, Plus, Trash2, UserMinus, Users } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Alert from "../../components/ui/Alert";
import ImageUpload from "../../components/ui/ImageUpload";
import VideoThumb from "../../components/common/VideoThumb";
import VideoPreviewModal from "../../components/common/VideoPreviewModal";
import HomeworkVideosModal from "../../components/common/HomeworkVideosModal";
import Avatar from "../../components/ui/Avatar";
import CoverHeader from "../../components/common/CoverHeader";
import Tabs, { TabPanel } from "../../components/ui/Tabs";
import { ContentRow, RowList } from "../../components/ui/Card";
import { Checkbox, FileDrop, Input, SearchInput, Textarea } from "../../components/ui/Form";
import ExamFormModal from "../../components/exam/ExamFormModal";
import ExamAnalyticsModal from "../../components/exam/ExamAnalyticsModal";
import { useConfirm } from "../../context/ConfirmContext";
import api from "../../services/api";
import { uploadFile } from "../../lib/upload";
import { fmtDateTime, fmtNumber } from "../../lib/format";
import CourseUnitsPanel from "../../components/course/CourseUnitsPanel";

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const { data, loading, error, refetch } = useApi(`/teacher/courses/${courseId}`);
  const [tab, setTab] = useState("videos");
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [studentsModalOpen, setStudentsModalOpen] = useState(false);

  if (loading && !data) return <LoadingState label="جارِ تحميل الكورس..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const course = data.course;
  const tabs = [
    { key: "videos", label: "الفيديوهات", count: course.videos.length },
    { key: "homework", label: "الواجبات", count: course.homework.length },
    { key: "materials", label: "الملفات", count: course.materials.length },
    { key: "exams", label: "الاختبارات", count: course.exams.length },
  ];

  return (
    <>
      <CoverHeader
        back={{ to: "/teacher/courses", label: "كل الكورسات" }}
        eyebrow={course.grade || "الصف غير محدد"}
        title={course.title}
        description={course.description}
        stats={[
          { label: "طالب مسجّل", value: fmtNumber(course.enrollments.length) },
          { label: "فيديو", value: fmtNumber(course.videos.length) },
          { label: "واجب", value: fmtNumber(course.homework.length) },
          { label: "اختبار", value: fmtNumber(course.exams.length) },
        ]}
        actions={<Button variant="secondary" icon={Users} onClick={() => setStudentsModalOpen(true)}>إدارة الطلاب المسجّلين</Button>}
      />
      {course.enrollments.length === 0 && (
        <Alert tone="warn" className="mb-6" action={<Button size="sm" variant="secondary" onClick={() => setStudentsModalOpen(true)}>إضافة طلاب</Button>}>
          لا يوجد طلاب مسجّلين في هذا الكورس بعد، لن يظهر لأي طالب حتى تضيف طلابًا.
        </Alert>
      )}

      <CourseUnitsPanel course={course} onChanged={refetch} />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <div className="mt-6">
        <TabPanel id={tab}>
          {tab === "videos" && <VideosTab courseId={courseId} videos={course.videos} onChanged={refetch} modalOpen={videoModalOpen} setModalOpen={setVideoModalOpen} />}
          {tab === "homework" && <HomeworkTab courseId={courseId} homework={course.homework} onChanged={refetch} />}
          {tab === "materials" && <MaterialsTab courseId={courseId} materials={course.materials} onChanged={refetch} />}
          {tab === "exams" && <ExamsTab courseId={courseId} exams={course.exams} onChanged={refetch} />}
        </TabPanel>
      </div>

      {studentsModalOpen && <ManageStudentsModal course={course} onClose={() => setStudentsModalOpen(false)} onChanged={refetch} />}
    </>
  );
}

/* ------------------------------------------------------------ enrollments */
function ManageStudentsModal({ course, onClose, onChanged }) {
  const { data, loading, error } = useApi("/teacher/students");
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const enrolledIds = new Set(course.enrollments.map((e) => e.studentId));

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function selectAllInGrade() {
    if (!data) return;
    const ids = data.students.filter((s) => s.grade === course.grade && !enrolledIds.has(s.id)).map((s) => s.id);
    setSelected((prev) => Array.from(new Set([...prev, ...ids])));
  }

  async function handleAdd() {
    if (selected.length === 0) return toast.error("اختر طالبًا واحدًا على الأقل");
    setSubmitting(true);
    try {
      await api.post(`/teacher/courses/${course.id}/enrollments`, { studentIds: selected });
      toast.success("تمت إضافة الطلاب — الكورس ومحتواه هيظهروا لهم دلوقتي");
      setSelected([]);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(studentId) {
    try {
      await api.delete(`/teacher/courses/${course.id}/enrollments/${studentId}`);
      toast.success("تم إلغاء تسجيل الطالب");
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const available = data ? data.students.filter((s) => !enrolledIds.has(s.id) && (!filter || s.fullName.includes(filter))) : [];

  return (
    <Modal open onClose={onClose} title="إدارة الطلاب المسجّلين" wide
      footer={<><Button variant="secondary" onClick={onClose}>إغلاق</Button><Button onClick={handleAdd} loading={submitting} disabled={selected.length === 0}>{submitting ? "جارِ الإضافة..." : `إضافة ${selected.length || ""} طالب محدد`}</Button></>}>
      {loading && <LoadingState variant="list" rows={3} />}
      {error && <ErrorState message={error} />}
      {data && (
        <div className="space-y-7">
          <section>
            <h3 className="text-sm font-bold text-ink-2 mb-2">المسجّلون حاليًا <span className="num">({fmtNumber(course.enrollments.length)})</span></h3>
            {course.enrollments.length === 0 ? (
              <p className="text-sm text-ink-3">لا يوجد طلاب مسجّلين، أضف طلابًا من القائمة تحت.</p>
            ) : (
              <ul className="panel divide-soft max-h-48 overflow-y-auto">
                {course.enrollments.map((e) => (
                  <li key={e.studentId} className="flex items-center gap-3 px-3 py-2">
                    <Avatar name={e.student.fullName} size="sm" />
                    <span className="min-w-0 flex-1 text-sm"><span className="font-semibold text-ink">{e.student.fullName}</span> <span className="text-ink-3">· {e.student.grade}</span></span>
                    <Button size="sm" variant="danger" icon={UserMinus} onClick={() => handleRemove(e.studentId)}>إلغاء التسجيل</Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-bold text-ink-2">إضافة طلاب</h3>
              {course.grade && <Button type="button" size="sm" variant="soft" onClick={selectAllInGrade}>تحديد كل طلاب «{course.grade}»</Button>}
            </div>
            <SearchInput value={filter} onChange={setFilter} placeholder="ابحث باسم الطالب..." className="mb-2" />
            <ul className="panel divide-soft max-h-64 overflow-y-auto">
              {available.length === 0 && <li className="p-4 text-sm text-ink-3 text-center">مفيش طلاب متاحين للإضافة.</li>}
              {available.map((s) => (
                <li key={s.id} className="px-3">
                  <Checkbox checked={selected.includes(s.id)} onChange={() => toggle(s.id)} label={s.fullName} description={`${s.grade}${s.group ? ` · ${s.group}` : ""}`} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Modal>
  );
}

/* ---------------------------------------------------------------- videos */
function VideosTab({ courseId, videos, onChanged, modalOpen, setModalOpen }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [preview, setPreview] = useState(null);
  const [expirationDate, setExpirationDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [fileError, setFileError] = useState("");
  const confirm = useConfirm();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) { setFileError("اختر ملف الفيديو أولًا"); return toast.error("اختر ملف الفيديو أولًا"); }
    setUploading(true);
    try {
      setProgress(0);
      const uploadRes = await uploadFile("/teacher/upload/video", file, setProgress);
      await api.post(`/teacher/courses/${courseId}/videos`, {
        title,
        fileUrl: uploadRes.data.url,
        thumbnailUrl: thumbnail || null,
        visibility: "ALL_STUDENTS", // targeting is already handled by course enrollment
        expirationDate: expirationDate || null,
      });
      toast.success("تمت إضافة الفيديو داخل الكورس فقط");
      setModalOpen(false);
      setTitle("");
      setThumbnail("");
      setFile(null);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function remove(v) {
    if (!(await confirm({ title: "حذف الفيديو", message: "هل تريد حذف هذا الفيديو؟", confirmLabel: "احذف" }))) return;
    try {
      await api.delete(`/teacher/videos/${v.id}`);
      toast.success("تم حذف الفيديو");
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button icon={Plus} onClick={() => setModalOpen(true)}>إضافة فيديو</Button></div>
      {videos.length === 0 ? (
        <EmptyState illustration="book" title="مفيش فيديوهات في الكورس" message="ارفع أول فيديو وهيظهر للطلاب المسجّلين." action={<Button icon={Plus} onClick={() => setModalOpen(true)}>إضافة فيديو</Button>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {videos.map((v) => (
            <article key={v.id} className="card overflow-hidden">
              <VideoThumb video={v} onPlay={() => setPreview(v)} />
              <div className="p-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-semibold text-ink leading-snug">{v.title}</h4>
                  <p className="text-xs text-ink-3 mt-1 num">{v.expirationDate ? `ينتهي: ${fmtDateTime(v.expirationDate)}` : "بدون تاريخ انتهاء"}</p>
                </div>
                <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label={`حذف ${v.title}`} onClick={() => remove(v)} className="!text-bad shrink-0" />
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="إضافة فيديو داخل الكورس"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)} disabled={uploading}>إلغاء</Button><Button type="submit" form="course-video" loading={uploading}>{uploading ? "جارِ الرفع..." : "رفع وإضافة"}</Button></>}>
        <form id="course-video" onSubmit={handleSubmit} className="space-y-5">
          <Input label="عنوان الفيديو" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <FileDrop label="ملف الفيديو" kind="video" accept="video/*" hint="MP4 (H.264 + AAC) أفضل صيغة" file={file} onFile={(f) => { setFile(f); setFileError(""); }} progress={progress} error={fileError} disabled={uploading} required />
          <ImageUpload label="صورة الفيديو (اختياري)" hint="الصورة اللي هتظهر للطالب قبل ما يشغّل الفيديو" value={thumbnail} onChange={setThumbnail} disabled={uploading} />
          <Input label="تاريخ انتهاء الصلاحية" hint="اختياري" type="datetime-local" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
        </form>
      </Modal>

      {preview && <VideoPreviewModal video={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/* -------------------------------------------------------------- homework */
function HomeworkTab({ courseId, homework, onChanged }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", deadline: "" });
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnail, setThumbnail] = useState("");
  const [progress, setProgress] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [videosOf, setVideosOf] = useState(null); // the homework whose videos are open

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Upload the video first: if that fails, no half-created homework is left behind.
      let videoUrl = null;
      if (videoFile) {
        setProgress(0);
        videoUrl = (await uploadFile("/teacher/upload/video", videoFile, setProgress)).data.url;
      }

      // targeting is already handled by course enrollment — no need to ask for grade again here
      const { data } = await api.post("/teacher/homework", { ...form, courseId, visibility: "ALL_STUDENTS" });

      if (videoUrl) {
        await api.post(`/teacher/homework/${data.homework.id}/video`, {
          title: `شرح: ${form.title}`,
          fileUrl: videoUrl,
          thumbnailUrl: thumbnail || null,
        });
      }

      toast.success("تمت إضافة الواجب" + (videoUrl ? " مع فيديو الشرح" : ""));
      setOpen(false);
      setForm({ title: "", description: "", deadline: "" });
      setVideoFile(null);
      setThumbnail("");
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button icon={Plus} onClick={() => setOpen(true)}>إضافة واجب</Button></div>
      {homework.length === 0 ? (
        <EmptyState illustration="file" title="مفيش واجبات في الكورس" message="أضف واجبًا وحدّد موعد التسليم." action={<Button icon={Plus} onClick={() => setOpen(true)}>إضافة واجب</Button>} />
      ) : (
        <RowList className="stagger">
          {homework.map((h) => (
            <ContentRow key={h.id} type="homework" title={h.title}
              meta={<><span className="num">{h.deadline ? fmtDateTime(h.deadline) : "بدون موعد نهائي"}</span>{h.explanationVideos?.length > 0 && <Badge tone="info" icon={Film}>فيديو شرح مرفق</Badge>}</>}
              end={<Button variant="soft" size="sm" icon={Film} onClick={() => setVideosOf(h)}>الفيديوهات</Button>} />
          ))}
        </RowList>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="إضافة واجب داخل الكورس"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>إلغاء</Button><Button type="submit" form="course-hw" loading={submitting}>{submitting ? "جارِ الإضافة..." : "إضافة"}</Button></>}>
        <form id="course-hw" onSubmit={handleSubmit} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-ink-2 mb-3">الأساسيات</legend>
            <Input label="عنوان الواجب" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea label="الوصف" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-ink-2 mb-3">الموعد</legend>
            <Input label="الموعد النهائي" type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-ink-2 mb-3">فيديو الشرح (اختياري)</legend>
            <FileDrop label="ملف الفيديو" kind="video" accept="video/*" file={videoFile} onFile={setVideoFile} progress={progress} disabled={submitting} />
            {videoFile && <ImageUpload label="صورة الفيديو (اختياري)" value={thumbnail} onChange={setThumbnail} disabled={submitting} />}
          </fieldset>
        </form>
      </Modal>

      {videosOf && <HomeworkVideosModal homework={videosOf} onClose={() => setVideosOf(null)} onChanged={onChanged} />}
    </div>
  );
}

/* ------------------------------------------------------------- materials */
function MaterialsTab({ courseId, materials, onChanged }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [allowDownload, setAllowDownload] = useState(false);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [fileError, setFileError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) { setFileError("اختر ملف PDF أولًا"); return toast.error("اختر ملف PDF أولًا"); }
    setUploading(true);
    try {
      setProgress(0);
      const uploadRes = await uploadFile("/teacher/upload/pdf", file, setProgress);
      await api.post("/teacher/materials", { title, fileUrl: uploadRes.data.url, allowDownload, courseId, visibility: "ALL_STUDENTS" });
      toast.success("تمت إضافة الملف");
      setOpen(false);
      setFile(null);
      setTitle("");
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button icon={Plus} onClick={() => setOpen(true)}>إضافة ملف PDF</Button></div>
      {materials.length === 0 ? (
        <EmptyState illustration="file" title="مفيش ملفات في الكورس" message="ارفع ملزمة PDF وهتظهر للطلاب." action={<Button icon={Plus} onClick={() => setOpen(true)}>إضافة ملف PDF</Button>} />
      ) : (
        <RowList className="stagger">
          {materials.map((m) => <ContentRow key={m.id} type="file" title={m.title} meta={<span>{m.allowDownload ? "التحميل مسموح" : "قراءة فقط"}</span>} />)}
        </RowList>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="إضافة ملف PDF داخل الكورس"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={uploading}>إلغاء</Button><Button type="submit" form="course-mat" loading={uploading}>{uploading ? "جارِ الرفع..." : "رفع وإضافة"}</Button></>}>
        <form id="course-mat" onSubmit={handleSubmit} className="space-y-5">
          <Input label="عنوان الملف" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <FileDrop label="ملف الـ PDF" kind="pdf" accept="application/pdf,.pdf" file={file} onFile={(f) => { setFile(f); setFileError(""); }} progress={progress} error={fileError} disabled={uploading} required />
          <Checkbox checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} label="السماح بتحميل الملف" description="لو مقفول، الطالب يقدر يقرأه بس داخل المنصة." />
        </form>
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------- exams */
function ExamsTab({ courseId, exams, onChanged }) {
  const [open, setOpen] = useState(false);
  const [analyticsExamId, setAnalyticsExamId] = useState(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button icon={Plus} onClick={() => setOpen(true)}>إنشاء اختبار</Button></div>
      {exams.length === 0 ? (
        <EmptyState illustration="check" title="مفيش اختبارات في الكورس" message="أنشئ اختبارًا بأسئلة اختيار من متعدد أو مقالية." action={<Button icon={Plus} onClick={() => setOpen(true)}>إنشاء اختبار</Button>} />
      ) : (
        <RowList className="stagger">
          {exams.map((ex) => (
            <ContentRow key={ex.id} type="exam" title={ex.title}
              end={<Button variant="soft" size="sm" icon={BarChart3} onClick={() => setAnalyticsExamId(ex.id)}>التحليلات والنتائج</Button>} />
          ))}
        </RowList>
      )}

      <ExamFormModal open={open} onClose={() => setOpen(false)} fixedCourseId={courseId} onCreated={onChanged} />
      {analyticsExamId && <ExamAnalyticsModal examId={analyticsExamId} onClose={() => setAnalyticsExamId(null)} />}
    </div>
  );
}
