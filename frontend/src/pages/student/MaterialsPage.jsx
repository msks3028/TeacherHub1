import { useState } from "react";
import { Search } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import CoverHeader from "../../components/common/CoverHeader";
import StatStrip from "../../components/ui/StatStrip";
import Icon from "../../components/ui/Icon";
import MaterialItem from "../../components/common/MaterialItem";

export default function StudentMaterialsPage() {
  const { data, loading, error, refetch } = useApi("/student/materials");
  const [query, setQuery] = useState("");
  const [onlyDownloadable, setOnlyDownloadable] = useState(false);

  if (loading) return <LoadingState variant="list" label="جارِ تحميل الملفات..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const all = data.materials;
  const q = query.trim().toLowerCase();
  const shown = all.filter((m) => (!q || m.title.toLowerCase().includes(q)) && (!onlyDownloadable || m.allowDownload));

  return (
    <>
      <CoverHeader eyebrow="الملفات" title="الملازم والملفات" description="ملفات PDF للمذاكرة، افتحها من المنصة أو نزّلها لو مسموح." />
      {all.length === 0 ? (
        <EmptyState illustration="file" title="مفيش ملفات" message="لا يوجد ملفات متاحة حاليًا." />
      ) : (
        <>
          <StatStrip className="mb-5" items={[{ label: "ملف متاح", value: all.length, tone: "file" }, { label: "قابل للتحميل", value: all.filter((m) => m.allowDownload).length, tone: "ok" }]} />
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Icon icon={Search} size={18} className="pointer-events-none absolute inset-y-0 my-auto start-4 text-ink-3" />
              <input type="search" className="input ps-11" aria-label="ابحث في الملفات" placeholder="ابحث باسم الملف..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <button type="button" aria-pressed={onlyDownloadable} onClick={() => setOnlyDownloadable((v) => !v)}
              className={`min-h-[44px] rounded-full px-5 text-sm font-bold transition-colors ${onlyDownloadable ? "bg-primary text-primary-on" : "bg-sunken text-ink-2 hover:bg-primary-soft"}`}>للتحميل فقط</button>
          </div>
          {shown.length === 0 ? (
            <EmptyState compact illustration="file" title="مفيش نتيجة" message="جرّب كلمة تانية أو شيل التصفية." />
          ) : (
            <ul className="grid md:grid-cols-2 gap-3 stagger">{shown.map((m) => <MaterialItem key={m.id} material={m} />)}</ul>
          )}
        </>
      )}
    </>
  );
}
