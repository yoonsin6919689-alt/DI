import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ImagePlus, LoaderCircle, LockKeyhole, NotebookPen } from "lucide-react";
import { Link } from "@/lib/router";
import { useSession } from "@/lib/session";
import { api, friendlyError } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { BOARD_META, postImageUrl } from "@/lib/posts";
import type { BoardKey, BoardPost } from "@/lib/types";
import { PageHeader } from "@/components/Layout";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 6 * 1024 * 1024;

function BoardTabs({ board }: { board: BoardKey }) {
  return (
    <nav className="board-tabs" aria-label="게시판 선택">
      {(Object.keys(BOARD_META) as BoardKey[]).map((key) => (
        <Link
          key={key}
          to={`/board/${key}`}
          className={`board-tab${board === key ? " active" : ""}`}
          aria-current={board === key ? "page" : undefined}
        >
          {BOARD_META[key].label}
        </Link>
      ))}
    </nav>
  );
}

function Composer({ board, onCreated }: { board: BoardKey; onCreated: () => Promise<void> }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  if (!user) {
    return (
      <div className="card composer-gate">
        <LockKeyhole size={20} aria-hidden="true" />
        <p>글을 쓰려면 로그인이 필요합니다.</p>
        <Link to="/login" className="btn btn-ghost btn-small">로그인</Link>
      </div>
    );
  }

  const pickImage = async (file: File) => {
    setError("");
    if (!PHOTO_TYPES.includes(file.type)) {
      setError("JPG, PNG, WebP 이미지만 올릴 수 있습니다.");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError("사진은 6MB 이하만 올릴 수 있습니다.");
      return;
    }
    setUploading(true);
    try {
      const intent = await api<{ objectPath: string; uploadUrl: string }>("/api/uploads/photo", {
        method: "POST",
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      const target = new URL(intent.uploadUrl, window.location.origin).toString();
      const response = await fetch(target, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("사진 업로드에 실패했습니다. 다시 시도해 주세요.");
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(file));
      setImagePath(intent.objectPath);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (board === "photo" && !imagePath) {
      setError("사진을 먼저 올려 주세요.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          board,
          title,
          body,
          ...(board === "photo" ? { imagePath } : {}),
        }),
      });
      setTitle("");
      setBody("");
      setImagePath("");
      if (preview) URL.revokeObjectURL(preview);
      setPreview("");
      setOpen(false);
      await onCreated();
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="card composer-open" onClick={() => setOpen(true)}>
        <NotebookPen size={18} aria-hidden="true" />
        <span>{BOARD_META[board].label}에 글 쓰기</span>
      </button>
    );
  }

  return (
    <form className="card editor composer" onSubmit={(event) => void submit(event)}>
      <div className="card-head">
        <h2 className="card-title">새 글 작성</h2>
        <button type="button" className="text-link inline-button" onClick={() => setOpen(false)}>닫기</button>
      </div>

      <label className="field">
        <span>제목</span>
        <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required />
      </label>

      <label className="field">
        <span>{board === "photo" ? "설명 (선택)" : "본문"}</span>
        <textarea
          className="textarea"
          rows={board === "photo" ? 3 : 6}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={4000}
          required={board === "free"}
        />
      </label>

      {board === "photo" && (
        <div className="field">
          <span>사진</span>
          <div className="upload-preview">
            {preview ? <img src={preview} alt="업로드 미리보기" /> : <span className="upload-placeholder"><ImagePlus size={20} aria-hidden="true" /></span>}
            <div className="upload-copy">
              <button type="button" className="btn btn-ghost btn-small" disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? <LoaderCircle size={14} className="spin" /> : <ImagePlus size={14} />}
                {imagePath ? "사진 교체" : "사진 선택"}
              </button>
              <small>JPG · PNG · WebP, 6MB 이하</small>
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void pickImage(file);
            }}
          />
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      <button type="submit" className="btn btn-gold" disabled={saving || uploading}>
        {saving ? <LoaderCircle size={16} className="spin" /> : <NotebookPen size={16} />}
        등록
      </button>
    </form>
  );
}

export function BoardPage({ board }: { board: BoardKey }) {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const meta = BOARD_META[board];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ posts: BoardPost[] }>(`/api/posts?board=${board}`);
      setPosts(data.posts);
      setError("");
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, [board]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="wrap page">
      <PageHeader eyebrow={meta.eyebrow} title={meta.label} description={meta.description} />
      <BoardTabs board={board} />

      <div className="board-layout">
        <Composer key={board} board={board} onCreated={load} />

        {error && <p className="form-error" role="alert">{error}</p>}
        {loading && <div className="list-skeleton" aria-hidden="true"><span /><span /><span /></div>}

        {!loading && !error && posts.length === 0 && (
          <p className="empty-note">아직 글이 없습니다. 첫 글을 남겨보세요.</p>
        )}

        {!loading && board === "free" && posts.length > 0 && (
          <ul className="board-list">
            {posts.map((post) => (
              <li key={post.id}>
                <Link to={`/board/${board}/${post.id}`} className="board-row">
                  <div className="board-main">
                    <div className="board-tags">
                      <span className="board-title">{post.title}</span>
                    </div>
                    <p className="board-preview">{post.body}</p>
                  </div>
                  <div className="board-side">
                    <span>{post.nickname}</span>
                    <span>{formatRelative(post.createdAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!loading && board === "photo" && posts.length > 0 && (
          <div className="photo-grid">
            {posts.map((post) => (
              <Link key={post.id} to={`/board/${board}/${post.id}`} className="card photo-card">
                {post.hasImage
                  ? <img className="photo-thumb" src={postImageUrl(post.id)} alt={post.title} loading="lazy" />
                  : <span className="photo-thumb empty" aria-hidden="true" />}
                <div className="photo-meta">
                  <h3>{post.title}</h3>
                  <span>{post.nickname} · {formatRelative(post.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
