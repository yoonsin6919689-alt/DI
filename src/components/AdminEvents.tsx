import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, Pencil, Plus, RefreshCw, Trash } from "lucide-react";
import { api, friendlyError } from "@/lib/api";
import {
  EVENT_IMAGE_ACCEPT, EVENT_LIMITS, eventCharacterCount, eventImageUrl, eventInputError,
  eventPath, eventThumbnailUrl, uploadEventImage, useEventList,
  type EventBlock, type EventEntry, type EventInput,
} from "@/lib/events";
import { formatDate } from "@/lib/format";
import { Link } from "@/lib/router";

type ImageAsset = { path: string; preview: string };
type DraftBlock =
  | { key: string; type: "text"; text: string }
  | { key: string; type: "image"; image: ImageAsset | null; caption: string };

function newTextBlock(): DraftBlock {
  return { key: crypto.randomUUID(), type: "text", text: "" };
}

function payloadBlocks(blocks: DraftBlock[]): EventBlock[] {
  return blocks.map((block) => block.type === "text"
    ? { type: "text", text: block.text }
    : { type: "image", imagePath: block.image?.path ?? "", caption: block.caption });
}

function ImageUpload({ label, image, onPick }: { label: string; image: ImageAsset | null; onPick: (file: File) => void }) {
  return (
    <div className="event-image-upload">
      {image ? <img className="event-editor-preview" src={image.preview} alt={`${label} 미리보기`} /> : (
        <div className="event-editor-placeholder"><ImagePlus size={24} aria-hidden="true" /><span>이미지를 선택해 주세요</span></div>
      )}
      <label className="field">
        <span>{label} {image ? "교체" : "업로드"}</span>
        <input className="input event-file-input" type="file" accept={EVENT_IMAGE_ACCEPT} onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) onPick(file);
        }} />
        <small>JPG · PNG · WebP, 파일당 6MiB 이하</small>
      </label>
    </div>
  );
}

export function AdminEventsTab() {
  const { events, setEvents, loading, error: listError, reload } = useEventList(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [thumbnail, setThumbnail] = useState<ImageAsset | null>(null);
  const [blocks, setBlocks] = useState<DraftBlock[]>(() => [newTextBlock()]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());
  const operation = useRef<AbortController | null>(null);
  const disabled = Boolean(busy) || loading;
  const characterCount = eventCharacterCount(payloadBlocks(blocks));
  const imageCount = blocks.filter((block) => block.type === "image").length;

  useEffect(() => () => {
    operation.current?.abort();
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    objectUrls.current.clear();
  }, []);

  const releaseImage = (image: ImageAsset | null) => {
    if (image && objectUrls.current.delete(image.preview)) URL.revokeObjectURL(image.preview);
  };

  const releaseAll = () => {
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    objectUrls.current.clear();
  };

  const reset = () => {
    releaseAll();
    setEditingId(null);
    setTitle("");
    setThumbnail(null);
    setBlocks([newTextBlock()]);
    setError("");
    setSuccess("");
  };

  const beginOperation = (message: string) => {
    if (operation.current) return null;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(message);
    setError("");
    setSuccess("");
    return controller;
  };

  const finishOperation = (controller: AbortController) => {
    if (operation.current === controller) {
      operation.current = null;
      if (!controller.signal.aborted) setBusy("");
    }
  };

  const pickImage = async (file: File, blockKey?: string) => {
    const controller = beginOperation(blockKey ? "본문 이미지 업로드 중…" : "대표 썸네일 업로드 중…");
    if (!controller) return;
    try {
      const path = await uploadEventImage(file, controller.signal);
      if (controller.signal.aborted) return;
      const preview = URL.createObjectURL(file);
      objectUrls.current.add(preview);
      const image = { path, preview };
      if (blockKey) {
        const previous = blocks.find((block) => block.key === blockKey);
        if (previous?.type === "image") releaseImage(previous.image);
        setBlocks((current) => current.map((block) => block.key === blockKey && block.type === "image" ? { ...block, image } : block));
      } else {
        releaseImage(thumbnail);
        setThumbnail(image);
      }
      setSuccess("이미지를 업로드했습니다. 이벤트를 저장하면 반영됩니다.");
    } catch (caught) {
      if (!controller.signal.aborted) setError(friendlyError(caught));
    } finally {
      finishOperation(controller);
    }
  };

  const startEdit = (entry: EventEntry) => {
    if (disabled) return;
    releaseAll();
    setEditingId(entry.id);
    setTitle(entry.title);
    setThumbnail({ path: entry.thumbnailPath, preview: eventThumbnailUrl(entry) });
    setBlocks(entry.blocks.map((block, index) => block.type === "text"
      ? { key: crypto.randomUUID(), type: "text", text: block.text }
      : {
        key: crypto.randomUUID(), type: "image", caption: block.caption,
        // Keep the original public URL when moving blocks before saving.
        image: { path: block.imagePath, preview: eventImageUrl(entry, index) },
      }));
    setError("");
    setSuccess("");
    titleInput.current?.focus();
  };

  const moveBlock = (key: string, direction: number) => {
    setBlocks((current) => {
      const from = current.findIndex((block) => block.key === key);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };

  const removeBlock = (block: DraftBlock) => {
    if (block.type === "image") releaseImage(block.image);
    setBlocks((current) => current.filter((item) => item.key !== block.key));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled || operation.current) return;
    const payload: EventInput = { title: title.trim(), thumbnailPath: thumbnail?.path ?? "", blocks: payloadBlocks(blocks) };
    const validationError = eventInputError(payload);
    setSuccess("");
    if (validationError) { setError(validationError); return; }
    const controller = beginOperation("이벤트 저장 중…");
    if (!controller) return;
    try {
      const data = await api<{ event: EventEntry }>(editingId ? `/api/admin${eventPath(editingId)}` : "/api/admin/events", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setEvents((current) => [data.event, ...current.filter((entry) => entry.id !== data.event.id)]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50));
      reset();
      setSuccess(editingId ? "이벤트를 수정했습니다." : "이벤트를 등록했습니다.");
    } catch (caught) {
      if (!controller.signal.aborted) setError(friendlyError(caught));
    } finally {
      finishOperation(controller);
    }
  };

  const removeEvent = async (entry: EventEntry) => {
    if (disabled || !window.confirm(`「${entry.title}」 이벤트를 삭제할까요?`)) return;
    const controller = beginOperation("이벤트 삭제 중…");
    if (!controller) return;
    try {
      await api(`/api/admin${eventPath(entry.id)}`, { method: "DELETE", signal: controller.signal });
      if (controller.signal.aborted) return;
      setEvents((current) => current.filter((item) => item.id !== entry.id));
      if (editingId === entry.id) reset();
      setSuccess("이벤트를 삭제했습니다.");
    } catch (caught) {
      if (!controller.signal.aborted) setError(friendlyError(caught));
    } finally {
      finishOperation(controller);
    }
  };

  return (
    <div className="admin-panel event-admin">
      <form className="card editor" onSubmit={(event) => void submit(event)} aria-busy={Boolean(busy)}>
        <div className="card-head">
          <h2 className="card-title">{editingId ? "이벤트 수정" : "새 이벤트"}</h2>
          <button type="button" className="btn btn-ghost btn-small" disabled={disabled} onClick={reset}>{editingId ? "수정 취소" : "초기화"}</button>
        </div>
        <fieldset className="event-editor-fields" disabled={disabled}>
          <legend className="sr-only">이벤트 내용</legend>
          <label className="field">
            <span>제목 (필수)</span>
            <input ref={titleInput} className="input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={EVENT_LIMITS.title} required />
          </label>
          <section className="event-thumbnail-editor" aria-labelledby="event-thumbnail-label">
            <h3 id="event-thumbnail-label">대표 썸네일 (필수)</h3>
            <p className="event-editor-help">홈 배너와 이벤트 목록에 표시됩니다. 본문 이미지와 별도로 업로드해 주세요.</p>
            <ImageUpload label="대표 썸네일" image={thumbnail} onPick={(file) => void pickImage(file)} />
          </section>
          <section aria-labelledby="event-blocks-label" className="event-blocks-editor">
            <div className="event-blocks-heading">
              <h3 id="event-blocks-label">본문</h3>
              <p className={`event-editor-help${characterCount > EVENT_LIMITS.characters ? " danger-text" : ""}`}>
                {blocks.length} / 24 블록 · 이미지 {imageCount} / 8장 · {characterCount.toLocaleString("ko-KR")} / 8,000자
              </p>
            </div>
            <p className="event-editor-help">글과 이미지를 원하는 순서로 추가하세요. 화살표 버튼으로 순서를 바꿀 수 있습니다. 글과 이미지 설명은 일반 텍스트로 표시됩니다.</p>
            <ol className="event-editor-blocks">
              {blocks.map((block, index) => (
                <li key={block.key} className="event-editor-block">
                  <div className="event-block-head">
                    <h4>{index + 1}. {block.type === "text" ? "글" : "이미지"}</h4>
                    <div className="row-actions">
                      <button type="button" className="icon-button" disabled={index === 0} onClick={() => moveBlock(block.key, -1)} aria-label={`${index + 1}번 블록 위로 이동`}><ArrowUp size={17} aria-hidden="true" /></button>
                      <button type="button" className="icon-button" disabled={index === blocks.length - 1} onClick={() => moveBlock(block.key, 1)} aria-label={`${index + 1}번 블록 아래로 이동`}><ArrowDown size={17} aria-hidden="true" /></button>
                      <button type="button" className="icon-button danger" onClick={() => removeBlock(block)} aria-label={`${index + 1}번 블록 삭제`}><Trash size={17} aria-hidden="true" /></button>
                    </div>
                  </div>
                  {block.type === "text" ? (
                    <label className="field">
                      <span>{index + 1}번 글 (필수)</span>
                      <textarea className="textarea" rows={5} maxLength={EVENT_LIMITS.characters} required value={block.text} onChange={(event) => {
                        const text = event.target.value;
                        setBlocks((current) => current.map((item) => item.key === block.key && item.type === "text" ? { ...item, text } : item));
                      }} />
                    </label>
                  ) : (
                    <>
                      <ImageUpload label={`${index + 1}번 본문 이미지`} image={block.image} onPick={(file) => void pickImage(file, block.key)} />
                      <label className="field">
                        <span>이미지 설명 (선택)</span>
                        <textarea className="textarea" rows={2} maxLength={EVENT_LIMITS.characters} value={block.caption} onChange={(event) => {
                          const caption = event.target.value;
                          setBlocks((current) => current.map((item) => item.key === block.key && item.type === "image" ? { ...item, caption } : item));
                        }} />
                      </label>
                    </>
                  )}
                </li>
              ))}
            </ol>
            {blocks.length === 0 && <p className="empty-note">글 또는 이미지 블록을 하나 이상 추가해 주세요.</p>}
            <div className="event-editor-actions">
              <button type="button" className="btn btn-ghost btn-small" disabled={blocks.length >= EVENT_LIMITS.blocks} onClick={() => setBlocks((current) => [...current, newTextBlock()])}><Plus size={16} aria-hidden="true" /> 글 추가</button>
              <button type="button" className="btn btn-ghost btn-small" disabled={blocks.length >= EVENT_LIMITS.blocks || imageCount >= EVENT_LIMITS.images} onClick={() => setBlocks((current) => [...current, { key: crypto.randomUUID(), type: "image", image: null, caption: "" }])}><ImagePlus size={16} aria-hidden="true" /> 이미지 추가</button>
            </div>
          </section>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        {success && <p className="event-editor-help" role="status">{success}</p>}
        <div className="event-editor-actions">
          <button type="submit" className="btn btn-gold" disabled={disabled}>
            {busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {editingId ? "수정 저장" : "이벤트 등록"}
          </button>
          {busy && <p className="event-editor-help" role="status">{busy}</p>}
        </div>
      </form>
      <section className="admin-list" aria-labelledby="admin-events-list-title">
        <div className="card-head">
          <h2 id="admin-events-list-title" className="card-title">등록된 이벤트</h2>
          <button type="button" className="btn btn-ghost btn-small" disabled={disabled} onClick={reload}><RefreshCw size={15} aria-hidden="true" /> 새로고침</button>
        </div>
        {loading && <p className="empty-note" role="status">이벤트를 불러오는 중입니다.</p>}
        {listError && <p className="form-error" role="alert">{listError}</p>}
        {!loading && !listError && events.length === 0 && <p className="empty-note">등록된 이벤트가 없습니다.</p>}
        {events.map((entry) => (
          <div key={entry.id} className="admin-row">
            <div className="admin-row-main">
              <Link to={eventPath(entry.id)} className="event-admin-title"><strong>{entry.title}</strong></Link>
              <span className="admin-row-meta">{formatDate(entry.createdAt)} · 본문 {entry.blocks.length}개 블록</span>
            </div>
            <div className="row-actions">
              <button type="button" className="icon-button" disabled={disabled} onClick={() => startEdit(entry)} aria-label={`${entry.title} 수정`}><Pencil size={16} aria-hidden="true" /></button>
              <button type="button" className="icon-button danger" disabled={disabled} onClick={() => void removeEvent(entry)} aria-label={`${entry.title} 삭제`}><Trash size={16} aria-hidden="true" /></button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
