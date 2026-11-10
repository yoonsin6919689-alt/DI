import type { BoardKey } from "./types";

export const BOARD_META: Record<BoardKey, { label: string; eyebrow: string; description: string }> = {
  free: {
    label: "자유게시판",
    eyebrow: "FREE BOARD",
    description: "모험 이야기, 공략, 파티 모집까지 자유롭게 나눠 주세요.",
  },
  photo: {
    label: "사진게시판",
    eyebrow: "PHOTO BOARD",
    description: "인게임 스크린샷과 차원 풍경을 사진으로 공유합니다.",
  },
};

export const postImageUrl = (id: string) => `/functions/v1/app/api/posts/${id}/image`;
