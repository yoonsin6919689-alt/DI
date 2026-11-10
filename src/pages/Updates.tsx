import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, splitParagraphs } from "@/lib/format";
import type { UpdateEntry } from "@/lib/types";
import { PageHeader } from "@/components/Layout";

export function UpdatesPage() {
  const [updates, setUpdates] = useState<UpdateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<{ updates: UpdateEntry[] }>("/api/updates")
      .then((data) => {
        if (active) setUpdates(data.updates);
      })
      .catch(() => {
        if (active) setError("업데이트 노트를 불러오지 못했습니다.");
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
        eyebrow="PATCH NOTES"
        title="업데이트"
        description="서버에 적용된 변경 사항을 버전별로 기록합니다."
      />

      {loading && <div className="list-skeleton" aria-hidden="true"><span /><span /><span /></div>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {!loading && !error && updates.length === 0 && (
        <div className="empty-state">
          <Sparkles size={26} aria-hidden="true" />
          <p>아직 등록된 업데이트가 없습니다.</p>
        </div>
      )}

      <div className="timeline">
        {updates.map((entry) => (
          <article key={entry.id} className="timeline-item">
            <div className="timeline-marker" aria-hidden="true" />
            <div className="timeline-body card">
              <div className="update-card-head">
                <span className="version-chip">{entry.version}</span>
                <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
              </div>
              <h2>{entry.title}</h2>
              <div className="update-text">
                {splitParagraphs(entry.body).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
