import { useState } from "react";
import { Trash2 } from "lucide-react";
import Button from "./Button";
import Avatar from "./Avatar";
import { FileDrop } from "./Form";
import { uploadFile } from "../../lib/upload";

const IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif";

/**
 * Pick an image and upload it right away. `value` is the stored image URL
 * ("" when none) and `onChange(url)` is called after a successful upload (or
 * with "" when the image is removed).
 *   uploadPath: "/teacher/upload/image" (default) or "/student/upload/avatar"
 *   round:      show the preview as a round avatar (profile pictures)
 */
export default function ImageUpload({ label, hint, value, onChange, uploadPath = "/teacher/upload/image", round = false, name = "", disabled = false }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  async function pick(file) {
    if (!file) return;
    setError("");
    try {
      setProgress(0);
      const res = await uploadFile(uploadPath, file, setProgress);
      onChange(res.data.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress(null);
    }
  }

  return (
    <div>
      {label && <span className="label">{label}</span>}
      {value && progress === null ? (
        <div className="flex items-center gap-3 rounded border border-line bg-raised p-2.5">
          {round ? (
            <Avatar name={name} src={value} size="lg" />
          ) : (
            <img src={value} alt="" className="w-28 aspect-video rounded object-cover bg-sunken shrink-0" />
          )}
          <p className="flex-1 min-w-0 text-sm text-ink-2">تم رفع الصورة.</p>
          <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label="إزالة الصورة" className="!text-bad" disabled={disabled} onClick={() => onChange("")} />
        </div>
      ) : (
        <FileDrop kind="image" accept={IMAGE_TYPES} hint={hint || "PNG أو JPG أو WebP"} file={null} onFile={pick} progress={progress} error={error} disabled={disabled} />
      )}
    </div>
  );
}
