import Modal from "../ui/Modal";
import VideoPlayer from "./VideoPlayer";

/** Lets the teacher watch a video exactly the way a student does. */
export default function VideoPreviewModal({ video, onClose }) {
  return (
    <Modal open onClose={onClose} title={video.title} size="xl">
      <VideoPlayer video={video} showCaption={false} className="!shadow-none" />
      {video.description && <p className="text-sm text-ink-2 mt-3 whitespace-pre-wrap">{video.description}</p>}
    </Modal>
  );
}
