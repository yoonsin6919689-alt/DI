import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/lib/router";
import { api } from "@/lib/api";
import { formatDate, splitParagraphs } from "@/lib/format";
import type { Notice } from "@/lib/types";

export function NoticeDetailPage({ id }: { id: string }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMissing(false);
    api<{ notice: Notice }>(`/api/notices/${id}`)
      .then((data) => {
        if (active) setNotice(data.notice);
      })
      .catch(() => {
        if (active) setMissing(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="wrap page">
      <Link to="/notices" className="text-link back-link"><ArrowLeft size={15} /> 공지사항</Link>

      {loading && <div className="article-skeleton" aria-hidden="true" />}
      {missing && (
        <div className="empty-state">
          <p>공지를 찾을 수 없습니다. 삭제되었거나 잘못된 주소입니다.</p>
          <Link to="/notices" className="btn btn-ghost">목록으로</Link>
        </div>
      )}

      {notice && !loading && (
        <article className="article">
          <div className="article-tags">
            {notice.pinned && <span className="badge gold">고정</span>}
            <span className="badge neutral">공지</span>
          </div>
          <h1 className="article-title">{notice.title}</h1>
          <p className="article-meta">
            <time dateTime={notice.createdAt}>{formatDate(notice.createdAt)}</time>
          </p>
          <div className="article-body">
            {splitParagraphs(notice.body).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </article>
      )}
    </div>
  );
}
