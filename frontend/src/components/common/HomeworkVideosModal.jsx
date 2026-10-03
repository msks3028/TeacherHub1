import { useState } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "./StateViews";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import ImageUpload from "../ui/ImageUpload";
import { FileDrop, Input } from "../ui/Form";
import VideoThumb from "./VideoThumb";
import VideoPreviewModal from "./VideoPreviewModal";
import { useConfirm } from "../../context/ConfirmContext";
import api from "../../services/api";
import { uploadFile } from "../../lib/upload";

/**
 * The explanation videos of ONE homework: watch them, delete them, and add a
 * new one (with an optional thumbnail). Students who can see the homework see
 * these videos inside it.
 */
export default function HomeworkVideosModal({ homework, onClose, onChanged }) {
  const { data, loading, error, refetch } = useApi(`/teacher/homework/${homework.id}`);
  const confirm = useConfirm();
  const [preview, setPreview] = useState(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState(`شرح: ${homework.title}`);
  const [file, setFile] = useState(null);
  const [thumbnail, setThumbnail] = useState("");
  const [progress, setProgress] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!file) return toast.error("اختر ملف الفيديو أولًا");
    setUploading(true);
    try {
      setProgress(0);
      const up = await uploadFile("/teacher/upload/video", file, setProgress);
      await api.post(`/teacher/homework/${homework.id}/video`, { title, fileUrl: up.data.url, thumbnailUrl: thumbnail || null });
      toast.success("تمت إضافة الفيديو للواجب");
      setAdding(false);
      setFile(null);
      setThumbnail("");
      setTitle(`شرح: ${homework.title}`);
      refetch();
      onChanged?.();
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
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const videos = data?.homework.explanationVideos || [];

  return (
    <>
      <Modal open onClose={onClose} title={`فيديوهات الواجب: ${homework.title}`} size="wide"
        footer={adding
          ? <><Button variant="secondary" onClick={() => setAdding(false)} disabled={uploading}>إلغاء</Button><Button type="submit" form="hw-video" loading={uploading}>{uploading ? "جارِ الرفع..." : "رفع وإضافة"}</Button></>
          : <><Button variant="secondary" onClick={onClose}>إغلاق</Button><Button icon={Plus} onClick={() => setAdding(true)}>إضافة فيديو</Button></>}>
        {loading && !data && <LoadingState variant="grid" rows={2} />}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {adding ? (
          <form id="hw-video" onSubmit={handleAdd} className="space-y-5">
            <Input label="عنوان الفيديو" required value={title} onChange={(e) => setTitle(e.target.value)} />
            <FileDrop label="ملف الفيديو" kind="video" accept="video/*" hint="MP4 (H.264 + AAC) أفضل صيغة" file={file} onFile={setFile} progress={progress} disabled={uploading} required />
            <ImageUpload label="صورة الفيديو (اختياري)" hint="الصورة اللي هتظهر للطالب قبل ما يشغّل الفيديو" value={thumbnail} onChange={setThumbnail} disabled={uploading} />
          </form>
        ) : (
          data && (videos.length === 0 ? (
            <EmptyState compact illustration="book" title="مفيش فيديوهات للواجب ده" message="أضف فيديو شرح وهيظهر للطلاب جوه الواجب." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {videos.map((v) => (
                <article key={v.id} className="card overflow-hidden">
                  <VideoThumb video={v} onPlay={() => setPreview(v)} />
                  <div className="p-3.5 flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-ink leading-snug min-w-0">{v.title}</h4>
                    <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label={`حذف ${v.title}`} className="!text-bad shrink-0" onClick={() => handleDelete(v)} />
                  </div>
                </article>
              ))}
            </div>
          ))
        )}
      </Modal>
      {preview && <VideoPreviewModal video={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
