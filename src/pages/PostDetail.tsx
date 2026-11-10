import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, Trash } from "lucide-react";
import { Link, navigate } from "@/lib/router";
import { useSession } from "@/lib/session";
import { api, friendlyError } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import { BOARD_META, postImageUrl } from "@/lib/posts";
import type { BoardKey, BoardPost } from "@/lib/types";
import { PageHeader } from "@/components/Layout";

export function PostDetailPage({ board, id }: { board: BoardKey; id: string }) {
  const { user } = useSession();
  const [post, setPost] = useState<BoardPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const meta = BOARD_META[board];

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<{ post: BoardPost }>(`/api/posts/${id}`)
      .then((data) => {
        if (active) setPost(data.post);
      })
      .catch((caught) => {
        if (active) setError(friendlyError(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const remove = async () => {
    if (!window.confirm("이 글을 삭제할까요?")) return;
    setRemoving(true);
    try {
      await api(`/api/posts/${id}`, { method: "DELETE" });
      navigate(`/board/${board}`);
    } catch (caught) {
      setError(friendlyError(caught));
      setRemoving(false);
    }
  };

  if (loading) {
    return <div className="wrap page"><div className="card skeleton-card tall" aria-hidden="true" /></div>;
  }

  if (!post || error) {
    return (
      <div className="wrap page">
        <PageHeader eyebrow={meta.eyebrow} title={meta.label} />
        <div className="empty-state">
          <p>{error || "글을 찾을 수 없습니다."}</p>
          <Link to={`/board/${board}`} className="btn btn-ghost">목록으로</Link>
        </div>
      </div>
    );
  }

  const canDelete = Boolean(user && (user.role === "admin" || user.id === post.authorId));

  return (
    <div className="wrap page">
      <article className="article">
        <div className="article-tags">
          <span className="badge gold">{meta.label}</span>
          {post.hasImage && <span className="badge neutral">사진</span>}
        </div>
        <h1 className="article-title">{post.title}</h1>
        <p className="article-meta">
          {post.nickname} · {formatDate(post.createdAt)} {formatTime(post.createdAt)}
        </p>

        {post.hasImage && (
          <img className="post-cover" src={postImageUrl(post.id)} alt={post.title} />
        )}

        {post.body && <div className="article-body">{post.body}</div>}

        <div className="article-actions">
          <Link to={`/board/${board}`} className="btn btn-ghost btn-small">
            <ArrowLeft size={14} /> 목록으로
          </Link>
          {canDelete && (
            <button type="button" className="btn btn-ghost btn-small danger-text" disabled={removing} onClick={() => void remove()}>
              {removing ? <LoaderCircle size={14} className="spin" /> : <Trash size={14} />}
              삭제
            </button>
          )}
        </div>
      </article>
    </div>
  );
}
