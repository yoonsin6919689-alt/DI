import { useEffect, useState } from "react";
import { ChevronRight, Megaphone } from "lucide-react";
import { Link } from "@/lib/router";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Notice } from "@/lib/types";
import { PageHeader } from "@/components/Layout";

export function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<{ notices: Notice[] }>("/api/notices")
      .then((data) => {
        if (active) setNotices(data.notices);
      })
      .catch(() => {
        if (active) setError("공지사항을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="wrap page">
      <PageHeader
        eyebrow="NOTICE"
        title="공지사항"
        description="점검 일정, 서버 규칙, 주요 안내를 확인하세요."
      />

      {loading && <div className="list-skeleton" aria-hidden="true"><span /><span /><span /><span /></div>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {!loading && !error && notices.length === 0 && (
        <div className="empty-state">
          <Megaphone size={26} aria-hidden="true" />
          <p>아직 등록된 공지가 없습니다.</p>
        </div>
      )}

      {notices.length > 0 && (
        <ul className="board-list">
          {notices.map((notice) => (
            <li key={notice.id}>
              <Link to={`/notices/${notice.id}`} className="board-row">
                <div className="board-main">
                  <div className="board-tags">
                    {notice.pinned && <span className="badge gold">고정</span>}
                    <span className="board-title">{notice.title}</span>
                  </div>
                  <p className="board-preview">{notice.body.split("\n")[0]}</p>
                </div>
                <div className="board-side">
                  <time dateTime={notice.createdAt}>{formatDate(notice.createdAt)}</time>
                  <ChevronRight size={16} aria-hidden="true" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
