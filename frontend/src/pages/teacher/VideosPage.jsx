import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { GraduationCap, Layers, Plus, Trash2, Users } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import ImageUpload from "../../components/ui/ImageUpload";
import VideoThumb from "../../components/common/VideoThumb";
import VideoPreviewModal from "../../components/common/VideoPreviewModal";
import PageHeader from "../../components/ui/PageHeader";
import VisibilitySelector from "../../components/ui/VisibilitySelector";
import { FileDrop, Input } from "../../components/ui/Form";
import { useConfirm } from "../../context/ConfirmContext";
import api from "../../services/api";
import { uploadFile } from "../../lib/upload";
import { fmtDateTime } from "../../lib/format";

export const visibilityBadge = (item) =>
  item.visibility === "ALL_STUDENTS" ? { icon: Users, label: "كل الطلاب" } : item.visibility === "GRADE" ? { icon: GraduationCap, label: item.grade } : { icon: Layers, label: item.group };

export default function VideosPage() {
  const { data, loading, error, refetch } = useApi("/teacher/videos/general");
  const confirm = useConfirm();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [title, setTitle] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [preview, setPreview] = useState(null);
  const [expirationDate, setExpirationDate] = useState("");
  const [visibility, setVisibility] = useState({ visibility: "ALL_STUDENTS", grade: "", group: "" });
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (location.state?.create) { setOpen(true); navigate(location.pathname, { replace: true, state: null }); }
  }, [location, navigate]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!file) { setFileError("اختر ملف الفيديو أولًا"); return toast.error("اختر ملف الفيديو أولًا"); }
    setUploading(true);
    try {
      setProgress(0);
      const uploadRes = await uploadFile("/teacher/upload/video", file, setProgress);
      // No courseId here => this video is General content, NOT tied to any course.
      await api.post("/teacher/videos", { title, fileUrl: uploadRes.data.url, thumbnailUrl: thumbnail || null, ...visibility, expirationDate: expirationDate || null });
      toast.success("تم رفع الفيديو");
      setOpen(false);
      setTitle("");
      setThumbnail("");
      setFile(null);
      setExpirationDate("");
      setVisibility({ visibility: "ALL_STUDENTS", grade: "", group: "" });
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function handleDelete(v) {
    if (!(await confirm({ title: "حذف الفيديو", message: `هل تريد حذف «${v.title}»؟`, confirmLabel: "احذف" }))) return;
    try {
      await api.delete(`/teacher/videos/${v.id}`);
      toast.success("تم حذف الفيديو");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading && !data) return <LoadingState variant="grid" rows={6} label="جارِ تحميل الفيديوهات..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title="الفيديوهات العامة"
        description="الفيديوهات غير المرتبطة بكورس. فيديوهات الكورسات بتظهر جوه صفحة كل كورس."
        actions={<Button icon={Plus} onClick={() => setOpen(true)}>رفع فيديو</Button>}
      />

      {data.videos.length === 0 ? (
        <EmptyState illustration="book" title="مفيش فيديوهات عامة" message="ارفع فيديو وحدّد مين يشوفه." action={<Button icon={Plus} onClick={() => setOpen(true)}>رفع فيديو</Button>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {data.videos.map((v) => {
            const vis = visibilityBadge(v);
            return (
              <article key={v.id} className="card card-interactive overflow-hidden">
                <div className="relative">
                  <VideoThumb video={v} onPlay={() => setPreview(v)} />
                  <span className="pointer-events-none absolute top-2.5 start-2.5"><Badge icon={vis.icon} className="!bg-raised shadow-1">{vis.label}</Badge></span>
                  {v.expirationDate && new Date(v.expirationDate) < new Date() && (
                    <span className="pointer-events-none absolute top-2.5 end-2.5"><Badge tone="bad" className="shadow-1">انتهت الصلاحية</Badge></span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-ink leading-snug">{v.title}</h3>
                    <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label={`حذف ${v.title}`} className="!text-bad shrink-0 -mt-1 -me-2" onClick={() => handleDelete(v)} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-ink-3 num">{v.expirationDate ? `ينتهي: ${fmtDateTime(v.expirationDate)}` : "بدون تاريخ انتهاء"}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="رفع فيديو عام"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={uploading}>إلغاء</Button><Button type="submit" form="general-video" loading={uploading}>{uploading ? "جارِ الرفع..." : "رفع الفيديو"}</Button></>}>
        <form id="general-video" onSubmit={handleCreate} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-ink-2 mb-3">الأساسيات</legend>
            <Input label="عنوان الفيديو" required value={title} onChange={(e) => setTitle(e.target.value)} />
            <FileDrop label="ملف الفيديو" kind="video" accept="video/*" hint="MP4 (H.264 + AAC) أفضل صيغة. الرفع ممكن ياخد وقت حسب الحجم." file={file} onFile={(f) => { setFile(f); setFileError(""); }} progress={progress} error={fileError} disabled={uploading} required />
            <ImageUpload label="صورة الفيديو (اختياري)" hint="الصورة اللي هتظهر للطالب قبل ما يشغّل الفيديو" value={thumbnail} onChange={setThumbnail} disabled={uploading} />
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-ink-2 mb-3">الاستهداف</legend>
            <VisibilitySelector value={visibility} onChange={setVisibility} />
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-ink-2 mb-3">التواريخ</legend>
            <Input label="تاريخ انتهاء الصلاحية" hint="اختياري" type="datetime-local" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
          </fieldset>
        </form>
      </Modal>

      {preview && <VideoPreviewModal video={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
