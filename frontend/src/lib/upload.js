import api from "../services/api";

/**
 * Same multipart request the app always sent — plus an optional progress
 * callback (0–100) so the UI can show a progress bar while the file uploads.
 */
export function uploadFile(path, file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(path, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
  });
}
