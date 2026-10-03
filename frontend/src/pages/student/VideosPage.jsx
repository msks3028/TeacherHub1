import { useApi } from "../../hooks/useApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/StateViews";
import PageHeader from "../../components/ui/PageHeader";
import VideoGallery from "../../components/common/VideoGallery";

export default function StudentVideosPage() {
  const { data, loading, error, refetch } = useApi("/student/videos");

  if (loading) return <LoadingState variant="grid" rows={4} label="جارِ تحميل الفيديوهات..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader title="الفيديوهات" description="شاهد الشرح في أي وقت، وكرّر الجزء اللي مش واضح." />
      {data.videos.length === 0 ? (
        <EmptyState illustration="book" title="مفيش فيديوهات متاحة" message="لا يوجد فيديوهات متاحة لك حاليًا." />
      ) : (
        <VideoGallery videos={data.videos} />
      )}
    </>
  );
}
