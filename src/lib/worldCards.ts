export type WorldCard = {
  icon: string;
  title: string;
  text: string;
};

export const WORLD_ICON_NAMES = [
  "Sparkles", "Users", "Zap", "Anvil", "Hammer", "Fish", "Compass", "PawPrint",
  "Swords", "Crown", "Medal", "Trophy", "Gem", "Flame", "Leaf", "Mountain",
  "Tent", "Backpack", "Shield", "Star",
] as const;

export const DEFAULT_WORLD_CARDS: WorldCard[] = [
  { icon: "Sparkles", title: "차원", text: "차원마다 다른 몬스터와 규칙. 새로운 균열이 열릴 때마다 전장이 바뀝니다." },
  { icon: "Users", title: "다양한 직업", text: "근접·원거리·마법·생활까지 취향에 맞는 직업을 고르세요." },
  { icon: "Zap", title: "스킬", text: "직업별 스킬을 익히고 조합해 나만의 전투 방식을 만듭니다." },
  { icon: "Anvil", title: "장비 강화", text: "장비를 단계별로 강화해 더 높은 전투력에 도전합니다." },
  { icon: "Hammer", title: "아이템 조합", text: "재료를 모아 무기와 방어구, 생활 아이템을 직접 조합합니다." },
  { icon: "Fish", title: "낚시도감", text: "물고기를 낚아 도감을 채우고 희귀 어종 수집에 도전합니다." },
  { icon: "Compass", title: "탈것 시스템", text: "탈것을 획득하고 성장시켜 더 넓은 차원을 누빕니다." },
  { icon: "PawPrint", title: "펫", text: "함께 싸우고 따라다니는 펫과 모험을 이어갑니다." },
  { icon: "Swords", title: "파티 플레이", text: "친구와 파티를 맺고 역할을 나눠 어려운 콘텐츠에 도전합니다." },
  { icon: "Crown", title: "월드 보스", text: "서버 전체가 힘을 모아 쓰러뜨리는 대형 목표." },
  { icon: "Medal", title: "칭호 · 업적", text: "모험을 기록하는 칭호와 업적으로 자신만의 흔적을 남깁니다." },
  { icon: "Trophy", title: "랭킹", text: "레벨과 전투력, 수집까지. 서버 최고 자리를 겨룹니다." },
];

export function parseWorldCards(raw: string | undefined): WorldCard[] {
  if (!raw) return DEFAULT_WORLD_CARDS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_WORLD_CARDS;
    const cards = parsed.filter((card): card is WorldCard => (
      Boolean(card) && typeof card === "object"
      && typeof (card as WorldCard).title === "string"
      && typeof (card as WorldCard).text === "string"
      && typeof (card as WorldCard).icon === "string"
    ));
    return cards.length > 0 ? cards : DEFAULT_WORLD_CARDS;
  } catch {
    return DEFAULT_WORLD_CARDS;
  }
}
