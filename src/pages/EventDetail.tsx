import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/lib/router";
import { api, ApiError, friendlyError } from "@/lib/api";
import { eventImageUrl, eventPath, eventThumbnailUrl, type EventEntry } from "@/lib/events";
import { formatDate } from "@/lib/format";

export function EventDetailPage({ id }: { id: string }) {
  const [entry, setEntry] = useState<EventEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setEntry(null);
    setLoading(true);
    setMissing(false);
    setError("");
    api<{ event: EventEntry }>(`/api${eventPath(id)}`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setEntry(data.event); })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        if (caught instanceof ApiError && (caught.status === 404 || caught.code === "not_found")) setMissing(true);
        else setError(friendlyError(caught));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, revision]);

  return (
    <div className="wrap page">
      <Link to="/events" className="text-link back-link"><ArrowLeft size={15} aria-hidden="true" /> 이벤트 목록</Link>
      {loading && <p className="empty-note" role="status">이벤트를 불러오는 중입니다.</p>}
      {missing && <div className="empty-state"><h1 className="card-title">이벤트를 찾을 수 없습니다</h1><p>삭제되었거나 잘못된 주소입니다.</p><Link to="/events" className="btn btn-ghost">목록으로</Link></div>}
      {error && <div className="empty-state"><p className="form-error" role="alert">{error}</p><button type="button" className="btn btn-ghost" onClick={() => setRevision((value) => value + 1)}>다시 시도</button></div>}
      {!loading && !error && !missing && entry && entry.id === id && (
        <article className="article event-article">
          <div className="article-tags"><span className="badge gold">이벤트</span></div>
          <h1 className="article-title">{entry.title}</h1>
          <p className="article-meta"><time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time></p>
          <img className="post-cover" src={eventThumbnailUrl(entry)} alt={`${entry.title} 대표 썸네일`} />
          <div className="event-body">
            {entry.blocks.map((block, index) => block.type === "text" ? (
              <p key={index}>{block.text}</p>
            ) : (
              <figure key={index}>
                <img src={eventImageUrl(entry, index)} alt={block.caption || `${entry.title} 본문 이미지 ${index + 1}`} loading="lazy" />
                {block.caption && <figcaption>{block.caption}</figcaption>}
              </figure>
            ))}
          </div>
          <div className="article-actions"><Link to="/events" className="btn btn-ghost"><ArrowLeft size={15} aria-hidden="true" /> 이벤트 목록</Link></div>
        </article>
      )}
    </div>
  );
}
