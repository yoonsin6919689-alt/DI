import { useEffect, useState } from "react";
import {
  Anvil, ArrowRight, Backpack, ChevronRight, Compass, Crown, Download, Fish, Flame, Gem, Hammer, Leaf,
  Medal, Mountain, PawPrint, Shield, Sparkles, Star, Swords, Tent, Trophy, Users, Zap,
} from "lucide-react";
import { Link } from "@/lib/router";
import { useConfig } from "@/lib/config";
import { statusLabel, useServerStatus } from "@/lib/serverStatus";
import { api } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";
import { parseWorldCards } from "@/lib/worldCards";
import { isAppShell, isIosDevice } from "@/lib/platform";
import type { Notice, UpdateEntry } from "@/lib/types";
import { ConnectCard } from "@/components/ConnectCard";

const WORLD_ICONS: Record<string, typeof Sparkles> = {
  Sparkles, Users, Zap, Anvil, Hammer, Fish, Compass, PawPrint,
  Swords, Crown, Medal, Trophy, Gem, Flame, Leaf, Mountain,
  Tent, Backpack, Shield, Star,
};

export function HomePage() {
  const { config } = useConfig();
  const status = useServerStatus();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [updates, setUpdates] = useState<UpdateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ios] = useState(isIosDevice);
  const [appShell] = useState(isAppShell);
  const worldCards = parseWorldCards(config.world_cards);

  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ notices: Notice[] }>("/api/notices"),
      api<{ updates: UpdateEntry[] }>("/api/updates"),
    ])
      .then(([noticeData, updateData]) => {
        if (!active) return;
        setNotices(noticeData.notices);
        setUpdates(updateData.updates);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-backdrop" aria-hidden="true" />
        <div className="wrap hero-inner">
          <p className="eyebrow">MINECRAFT × MMORPG</p>
          <h1 className="hero-title">{config.server_name}</h1>
          <p className="hero-tagline">{config.tagline}</p>
          <div className="hero-actions">
            <a href="#connect" className="btn btn-gold">
              서버 접속하기
              <ArrowRight size={18} />
            </a>
            <Link to="/chat" className="btn btn-ghost">
              커뮤니티 채팅
            </Link>
            {appShell ? null : ios ? (
              <a href="#install" className="btn btn-ghost">
                <Download size={16} />
                iPhone 앱 설치
              </a>
            ) : (
              <a href="/downloads/DIMENSION-1.1.0.apk" download className="btn btn-ghost">
                <Download size={16} />
                Android 앱
              </a>
            )}
          </div>
          <ul className="hero-facts">
            <li>
              <span
                className={`status-dot${!status.live ? " wait" : status.online ? " ok" : ""}`}
                aria-hidden="true"
              />
              {statusLabel(status, config.status_text)}
            </li>
            <li>PC · 모바일 크로스플레이</li>
            <li>인게임 닉네임 인증</li>
          </ul>
        </div>
      </section>

      <div className="wrap home-grid">
        <ConnectCard />

        <section className="card notice-card" aria-labelledby="home-notice-title">
          <div className="card-head">
            <div>
              <p className="eyebrow">NOTICE</p>
              <h2 id="home-notice-title" className="card-title">공지사항</h2>
            </div>
            <Link to="/notices" className="text-link">전체 보기 <ChevronRight size={15} /></Link>
          </div>

          {loading ? (
            <div className="list-skeleton" aria-hidden="true">
              <span /><span /><span />
            </div>
          ) : notices.length === 0 ? (
            <p className="empty-note">아직 등록된 공지가 없습니다.</p>
          ) : (
            <ul className="notice-list">
              {notices.slice(0, 4).map((notice) => (
                <li key={notice.id}>
                  <Link to={`/notices/${notice.id}`} className="notice-row">
                    <span className="notice-main">
                      {notice.pinned && <span className="badge gold">고정</span>}
                      <span className="notice-title">{notice.title}</span>
                    </span>
                    <span className="notice-date">{formatDate(notice.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="wrap section" aria-labelledby="home-update-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">PATCH NOTES</p>
            <h2 id="home-update-title" className="section-title">업데이트</h2>
          </div>
          <Link to="/updates" className="text-link">전체 보기 <ChevronRight size={15} /></Link>
        </div>

        {loading ? (
          <div className="update-grid">
            <div className="card skeleton-card" /><div className="card skeleton-card" /><div className="card skeleton-card" />
          </div>
        ) : updates.length === 0 ? (
          <p className="empty-note">첫 업데이트 노트를 준비하고 있습니다.</p>
        ) : (
          <div className="update-grid">
            {updates.slice(0, 3).map((entry) => (
              <Link key={entry.id} to="/updates" className="card update-card">
                <div className="update-card-head">
                  <span className="version-chip">{entry.version}</span>
                  <span className="update-date">{formatRelative(entry.createdAt)}</span>
                </div>
                <h3>{entry.title}</h3>
                <p>{entry.body.split("\n")[0]}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="wrap section" aria-labelledby="home-world-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">THE WORLD</p>
            <h2 id="home-world-title" className="section-title">이 세계에서 벌어지는 일</h2>
            <p className="section-sub">차원과 전투, 강화와 조합, 낚시와 탈것·펫까지. 모험의 갈래가 여럿으로 열려 있습니다.</p>
          </div>
        </div>
        <div className="world-grid">
          {worldCards.map(({ title, icon, text }) => {
            const Icon = WORLD_ICONS[icon] ?? Sparkles;
            return (
              <article key={`${icon}-${title}`} className="card world-card">
                <span className="world-icon"><Icon size={20} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            );
          })}
        </div>
      </section>

      {appShell ? null : (
        <section className="wrap">
          <div className="app-band" id="install">
            <div>
              <p className="eyebrow">MOBILE APP</p>
              <h2>폰에서 앱처럼 열기</h2>
              {ios ? (
                <p>
                  iPhone은 Safari로 접속한 뒤 <strong>공유 → 홈 화면에 추가</strong>를 누르면
                  아이콘이 생기고, 앱처럼 전체화면으로 실행됩니다. 자동 로그인을 켜면 다시 로그인할 필요도 없습니다.
                </p>
              ) : (
                <p>
                  Android는 APK를 설치하면 전체화면 앱으로 실행됩니다. 아이폰은 Safari에서
                  <strong> 공유 → 홈 화면에 추가</strong>로 설치합니다.
                </p>
              )}
            </div>
            <div className="app-band-actions">
              {ios ? (
                <ol className="app-steps">
                  <li>Safari 하단의 <strong>공유</strong> 버튼 누르기</li>
                  <li><strong>홈 화면에 추가</strong> 선택하기</li>
                </ol>
              ) : (
                <a href="/downloads/DIMENSION-1.1.0.apk" download className="btn btn-gold">
                  <Download size={16} /> Android APK 다운로드
                </a>
              )}
              <span className="app-band-note">
                {ios ? "설치하면 아이콘·전체화면 실행·자동 로그인 지원" : "v1.1.0 · 141KB · 설치 시 '알 수 없는 앱' 허용 필요"}
              </span>
            </div>
          </div>
        </section>
      )}

      <section className="wrap">
        <div className="cta-band">
          <div>
            <p className="eyebrow">ADVENTURE BEGINS</p>
            <h2>지금, 차원 너머로.</h2>
            <p>계정을 만들고 관리자 승인을 받으면 커뮤니티 채팅에 바로 참여할 수 있습니다.</p>
          </div>
          <Link to="/signup" className="btn btn-gold">
            계정 만들기
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
