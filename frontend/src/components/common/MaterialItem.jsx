import { Download, ExternalLink } from "lucide-react";
import Button from "../ui/Button";

/** A little paper sheet with a folded corner, drawn in SVG (no image files). */
export function PdfSheet() {
  return (
    <span className="relative shrink-0 w-12 h-14 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105" style={{ color: "var(--t-file)" }} aria-hidden="true">
      <svg viewBox="0 0 48 56" className="absolute inset-0 w-full h-full" fill="none">
        <path d="M6 4h26l10 10v38a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="var(--t-file-bg)" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        <path d="M32 4v10h10" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        <path d="M11 24h26M11 30h26" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" opacity="0.4" />
      </svg>
      <span className="absolute bottom-2 start-1 end-1 rounded text-center text-[9px] font-extrabold leading-4" style={{ background: "var(--t-file)", color: "var(--surface)" }}>PDF</span>
    </span>
  );
}

/** A PDF: paper-sheet tile, title, "open" and (only when allowed) "download". */
export default function MaterialItem({ material: m }) {
  return (
    <li className="group card card-interactive p-4 flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <PdfSheet />
        <div className="min-w-0">
          <p className="font-bold text-ink leading-snug break-words">{m.title}</p>
          <p className="text-sm text-ink-3 mt-1">ملف PDF{m.allowDownload ? " · متاح للتحميل" : " · للقراءة من المنصة"}</p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button as="a" href={`/api/files/material/${m.id}`} target="_blank" rel="noreferrer" variant="soft" icon={ExternalLink} className="flex-1 sm:flex-none">فتح</Button>
        {m.allowDownload && (
          <Button as="a" href={`/api/files/material/${m.id}?download=1`} variant="secondary" icon={Download} className="flex-1 sm:flex-none">تحميل</Button>
        )}
      </div>
    </li>
  );
}
