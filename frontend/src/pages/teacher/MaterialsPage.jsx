import { useState } from "react";
import toast from "react-hot-toast";
import { Download, Eye, Plus, Trash2 } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import PageHeader from "../../components/ui/PageHeader";
import Icon from "../../components/ui/Icon";
import { PdfSheet } from "../../components/common/MaterialItem";
import VisibilitySelector from "../../components/ui/VisibilitySelector";
import { Checkbox, FileDrop, Input } from "../../components/ui/Form";
import { useConfirm } from "../../context/ConfirmContext";
import api from "../../services/api";
import { uploadFile } from "../../lib/upload";
import { visibilityBadge } from "./VideosPage";

export default function MaterialsPage() {
  const { data, loading, error, refetch } = useApi("/teacher/materials");
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [title, setTitle] = useState("");
  const [allowDownload, setAllowDownload] = useState(false);
  const [visibility, setVisibility] = useState({ visibility: "ALL_STUDENTS", grade: "", group: "" });
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    if (!file) { setFileError("اختر ملف PDF أولًا"); return toast.error("اختر ملف أولًا"); }
    setUploading(true);
    try {
      setProgress(0);
      const uploadRes = await uploadFile("/teacher/upload/pdf", file, setProgress);
      // No courseId => general material, appears only in the general Materials section.
      await api.post("/teacher/materials", { title, fileUrl: uploadRes.data.url, allowDownload, ...visibility });
      toast.success("تمت إضافة الملف");
      setOpen(false);
      setFile(null);
      setTitle("");
      setVisibility({ visibility: "ALL_STUDENTS", grade: "", group: "" });
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function handleDelete(m) {
    if (!(await confirm({ title: "حذف الملف", message: `هل تريد حذف «${m.title}»؟`, confirmLabel: "احذف" }))) return;
    try {
      await api.delete(`/teacher/materials/${m.id}`);
      toast.success("تم الحذف");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading && !data) return <LoadingState variant="list" label="جارِ تحميل الملفات..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title="الملفات العامة"
        description="ملازم PDF غير المرتبطة بكورس. ملفات الكورسات بتظهر جوه صفحة كل كورس."
        actions={<Button icon={Plus} onClick={() => setOpen(true)}>إضافة ملف</Button>}
      />

      {data.materials.length === 0 ? (
        <EmptyState illustration="file" title="مفيش ملفات عامة" message="ارفع ملزمة PDF وحدّد مين يشوفها." action={<Button icon={Plus} onClick={() => setOpen(true)}>إضافة ملف</Button>} />
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {data.materials.map((m) => {
            const vis = visibilityBadge(m);
            return (
              <li key={m.id} className="group card card-interactive p-4 flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <PdfSheet />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-ink leading-snug break-words">{m.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2"><Badge icon={vis.icon}>{vis.label}</Badge></div>
                  </div>
                  <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label={`حذف ${m.title}`} className="!text-bad shrink-0 -mt-1 -me-2" onClick={() => handleDelete(m)} />
                </div>
                <p className="mt-auto pt-3 border-t border-line flex items-center gap-2 text-sm text-ink-2">
                  <Icon icon={m.allowDownload ? Download : Eye} size={16} className="text-ink-3" />
                  {m.allowDownload ? "التحميل مسموح" : "قراءة فقط"}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="إضافة ملف عام"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={uploading}>إلغاء</Button><Button type="submit" form="general-material" loading={uploading}>{uploading ? "جارِ الرفع..." : "رفع وإضافة"}</Button></>}>
        <form id="general-material" onSubmit={handleCreate} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-ink-2 mb-3">الأساسيات</legend>
            <Input label="عنوان الملف" required value={title} onChange={(e) => setTitle(e.target.value)} />
            <FileDrop label="ملف الـ PDF" kind="pdf" accept="application/pdf,.pdf" file={file} onFile={(f) => { setFile(f); setFileError(""); }} progress={progress} error={fileError} disabled={uploading} required />
            <Checkbox checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} label="السماح بتحميل الملف" description="لو مقفول، الطالب يقدر يقرأه بس." />
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="text-sm font-bold text-ink-2 mb-3">الاستهداف</legend>
            <VisibilitySelector value={visibility} onChange={setVisibility} />
          </fieldset>
        </form>
      </Modal>
    </>
  );
}
