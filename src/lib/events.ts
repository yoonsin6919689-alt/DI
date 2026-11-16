import { useEffect, useState } from "react";
import { api, friendlyError } from "./api";

export type EventBlock =
  | { type: "text"; text: string }
  | { type: "image"; imagePath: string; caption: string };

export type EventInput = { title: string; thumbnailPath: string; blocks: EventBlock[] };
export type EventEntry = EventInput & { id: string; createdAt: string; updatedAt: string };

export const EVENT_LIMITS = { title: 120, blocks: 24, images: 8, characters: 8000, imageBytes: 6 * 1024 * 1024 };
export const EVENT_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export function eventPath(id: string): string {
  return `/events/${encodeURIComponent(id)}`;
}

export function eventThumbnailUrl(event: EventEntry): string {
  return `/functions/v1/app/api${eventPath(event.id)}/thumbnail?v=${encodeURIComponent(event.updatedAt)}`;
}

export function eventImageUrl(event: EventEntry, blockIndex: number): string {
  return `/functions/v1/app/api${eventPath(event.id)}/images/${blockIndex}?v=${encodeURIComponent(event.updatedAt)}`;
}

export function eventCharacterCount(blocks: EventBlock[]): number {
  return blocks.reduce((sum, block) => sum + (block.type === "text" ? block.text.length : block.caption.length), 0);
}

export function eventInputError(input: EventInput): string {
  if (!input.title.trim() || input.title.length > EVENT_LIMITS.title) return "제목을 1~120자로 입력해 주세요.";
  if (!input.thumbnailPath.trim()) return "대표 썸네일을 별도로 업로드해 주세요.";
  if (input.blocks.length < 1 || input.blocks.length > EVENT_LIMITS.blocks) return "본문 블록을 1~24개 추가해 주세요.";
  if (input.blocks.filter((block) => block.type === "image").length > EVENT_LIMITS.images) return "본문 이미지는 최대 8장까지 추가할 수 있습니다.";
  if (eventCharacterCount(input.blocks) > EVENT_LIMITS.characters) return "본문과 이미지 설명은 합쳐서 8,000자 이내로 입력해 주세요.";
  if (input.blocks.some((block) => block.type === "text" ? !block.text.trim() : !block.imagePath.trim())) {
    return "비어 있는 본문 블록에 글 또는 이미지를 추가하거나 해당 블록을 삭제해 주세요.";
  }
  return "";
}

export async function uploadEventImage(file: File, signal?: AbortSignal): Promise<string> {
  if (!EVENT_IMAGE_ACCEPT.split(",").includes(file.type)) throw new Error("JPG, PNG, WebP 이미지만 올릴 수 있습니다.");
  if (file.size === 0 || file.size > EVENT_LIMITS.imageBytes) throw new Error("이미지는 비어 있지 않은 6MiB 이하 파일이어야 합니다.");
  const intent = await api<{ objectPath: string; uploadUrl: string; maxBytes: number }>("/api/uploads/photo", {
    method: "POST",
    body: JSON.stringify({ contentType: file.type, size: file.size }),
    signal,
  });
  if (file.size > intent.maxBytes) throw new Error("서버에서 허용하는 이미지 용량을 초과했습니다.");
  const response = await fetch(new URL(intent.uploadUrl, window.location.origin).toString(), {
    method: "PUT",
    headers: { "Content-Type": file.type },
    credentials: "same-origin",
    body: file,
    signal,
  });
  if (!response.ok) throw new Error("이미지 업로드에 실패했습니다. 다시 시도해 주세요.");
  return intent.objectPath;
}

export function useEventList(admin = false) {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<{ events: EventEntry[] }>(admin ? "/api/admin/events" : "/api/events", { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setEvents(data.events); })
      .catch((caught) => { if (!controller.signal.aborted) setError(friendlyError(caught)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [admin, revision]);

  return { events, setEvents, loading, error, reload: () => setRevision((value) => value + 1) };
}
