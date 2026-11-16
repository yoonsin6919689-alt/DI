import { ChevronRight, Gift } from "lucide-react";
import { PageHeader } from "@/components/Layout";
import { Link } from "@/lib/router";
import { eventPath, eventThumbnailUrl, useEventList } from "@/lib/events";
import { formatDate } from "@/lib/format";

export function EventsPage() {
  const { events, loading, error, reload } = useEventList();
  return (
    <div className="wrap page">
      <PageHeader eyebrow="EVENTS" title="이벤트" description="차원 너머의 특별한 소식과 함께할 이벤트를 만나보세요." />
      {loading && <p className="empty-note" role="status">이벤트를 불러오는 중입니다.</p>}
      {error && <div className="empty-state"><p className="form-error" role="alert">{error}</p><button type="button" className="btn btn-ghost" onClick={reload}>다시 시도</button></div>}
      {!loading && !error && (events.length === 0 ? (
        <div className="empty-state"><Gift size={28} aria-hidden="true" /><p>아직 등록된 이벤트가 없습니다.</p></div>
      ) : (
        <ul className="events-grid">
          {events.map((event) => (
            <li key={event.id}>
              <Link to={eventPath(event.id)} className="card event-list-card">
                <img className="event-thumbnail" src={eventThumbnailUrl(event)} alt="" loading="lazy" />
                <div className="event-slide-copy">
                  <time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
                  <h2>{event.title}</h2>
                  <span className="text-link">자세히 보기 <ChevronRight size={15} aria-hidden="true" /></span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
