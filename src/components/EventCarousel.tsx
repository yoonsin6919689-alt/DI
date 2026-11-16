import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Gift, Pause, Play } from "lucide-react";
import { Link } from "@/lib/router";
import { eventPath, eventThumbnailUrl, useEventList } from "@/lib/events";
import { formatDate } from "@/lib/format";

export function EventCarousel() {
  const { events, loading, error, reload } = useEventList();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [manualStep, setManualStep] = useState(0);
  const count = events.length;
  const currentIndex = count ? index % count : 0;
  const current = events[currentIndex];
  const rotating = count > 1 && !loading && !error && !paused && !hovered && !focused && !hidden;

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % count), 5000);
    return () => window.clearInterval(timer);
  }, [rotating, count, manualStep]);

  const step = (direction: number) => {
    if (count < 2) return;
    setIndex((value) => (value + direction + count) % count);
    setManualStep((value) => value + 1);
  };

  return (
    <section
      className="home-events"
      aria-labelledby="home-event-title"
      aria-roledescription="캐러셀"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="section-head">
        <div>
          <p className="eyebrow">EVENTS</p>
          <h2 id="home-event-title" className="section-title">이벤트</h2>
        </div>
        <Link to="/events" className="text-link">전체 보기 <ChevronRight size={15} aria-hidden="true" /></Link>
      </div>
      {loading ? (
        <div className="card event-carousel-state" role="status">이벤트를 불러오는 중입니다.</div>
      ) : error ? (
        <div className="card event-carousel-state">
          <p className="form-error" role="alert">{error}</p>
          <button type="button" className="btn btn-ghost btn-small" onClick={reload}>다시 시도</button>
        </div>
      ) : !current ? (
        <div className="card event-carousel-state">
          <Gift size={28} aria-hidden="true" />
          <p>새로운 이벤트를 준비하고 있습니다.</p>
        </div>
      ) : (
        <div className="card event-carousel-card">
          <div id="home-event-slide" role="group" aria-roledescription="슬라이드" aria-label={`${currentIndex + 1} / ${count}`}>
            <Link to={eventPath(current.id)} className="event-slide-link">
              <img key={eventThumbnailUrl(current)} className="event-thumbnail" src={eventThumbnailUrl(current)} alt="" />
              <div className="event-slide-copy">
                <time dateTime={current.createdAt}>{formatDate(current.createdAt)}</time>
                <h3>{current.title}</h3>
                <span className="text-link">이벤트 자세히 보기 <ChevronRight size={15} aria-hidden="true" /></span>
              </div>
            </Link>
          </div>
          <div className="event-carousel-controls">
            <span className="event-position" aria-live={rotating ? "off" : "polite"} aria-atomic="true">
              {currentIndex + 1} / {count}<span className="sr-only"> · {current.title}</span>
            </span>
            {count > 1 ? (
              <div className="row-actions">
                <button type="button" className="icon-button" onClick={() => step(-1)} aria-label="이전 이벤트" aria-controls="home-event-slide"><ChevronLeft size={18} aria-hidden="true" /></button>
                <button type="button" className="btn btn-ghost btn-small" onClick={() => setPaused((value) => !value)} aria-label={paused ? "이벤트 자동 재생 시작" : "이벤트 자동 재생 일시정지"} aria-describedby="event-playback-help">
                  {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
                  {paused ? "자동 재생" : "일시정지"}
                </button>
                <button type="button" className="icon-button" onClick={() => step(1)} aria-label="다음 이벤트" aria-controls="home-event-slide"><ChevronRight size={18} aria-hidden="true" /></button>
              </div>
            ) : <span className="event-position">새 이벤트를 기다려 주세요</span>}
          </div>
          {count > 1 && <p id="event-playback-help" className="sr-only">5초마다 전환됩니다. 마우스를 올리거나 키보드로 선택하는 동안에는 자동 재생이 멈춥니다.</p>}
        </div>
      )}
    </section>
  );
}
