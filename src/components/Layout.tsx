import { useEffect, useRef, type ReactNode } from "react";
import {
  Gift, House, Images, MessagesSquare, NotebookPen, ScrollText, ShieldCheck, Sparkles, UserRound,
} from "lucide-react";
import { Link, useRoute } from "@/lib/router";
import { useSession } from "@/lib/session";
import { useConfig } from "@/lib/config";
import { Emblem } from "./Emblem";
import { IosInstallHint } from "./IosInstallHint";

const NAV = [
  { to: "/", label: "홈", short: "홈", icon: House },
  { to: "/notices", label: "공지", short: "공지", icon: ScrollText },
  { to: "/board/free", label: "자유게시판", short: "자유", icon: NotebookPen },
  { to: "/board/photo", label: "사진게시판", short: "사진", icon: Images },
  { to: "/updates", label: "업데이트", short: "업데이트", icon: Sparkles },
  { to: "/events", label: "이벤트", short: "이벤트", icon: Gift },
  { to: "/chat", label: "채팅", short: "채팅", icon: MessagesSquare },
];

function isActive(path: string, to: string): boolean {
  if (to === "/") return path === "/";
  return path === to || path.startsWith(`${to}/`);
}

export function Header() {
  const path = useRoute();
  const { user, loading } = useSession();
  const { config } = useConfig();

  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <Link to="/" className="brand" aria-label={`${config.server_name} 홈`}>
          <Emblem />
          <span className="brand-text">
            <span className="brand-name">{config.server_name}</span>
            <span className="brand-sub">Minecraft MMORPG</span>
          </span>
        </Link>

        <nav className="nav" aria-label="주요 메뉴">
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`nav-link${isActive(path, to) ? " active" : ""}`}
              aria-current={isActive(path, to) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="topbar-actions">
          {loading ? (
            <span className="user-chip ghost" aria-hidden="true" />
          ) : user ? (
            <>
              {user.role === "admin" && (
                <Link to="/admin" className={`icon-button${isActive(path, "/admin") ? " active" : ""}`} aria-label="관리자 페이지" title="관리자 페이지">
                  <ShieldCheck size={18} />
                </Link>
              )}
              <Link to="/account" className="user-chip">
                <span className={`status-dot${user.verified ? " ok" : " wait"}`} aria-hidden="true" />
                <span className="user-name">{user.nickname}</span>
              </Link>
            </>
          ) : (
            <Link to="/login" className="btn btn-ghost btn-small">로그인</Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const path = useRoute();
  const { user } = useSession();
  const items = [
    ...NAV,
    { to: user ? "/account" : "/login", label: user ? "내 정보" : "로그인", short: user ? "내 정보" : "로그인", icon: UserRound },
  ];
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < nav.scrollLeft) nav.scrollLeft = left;
    else if (right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = right - nav.clientWidth;
  }, [path, user]);
  return (
    <nav ref={navRef} className="bottom-nav" aria-label="모바일 메뉴 (좌우 스크롤)">
      {items.map(({ to, label, short, icon: Icon }) => {
        const active = isActive(path, to);
        return (
          <Link key={label} to={to} className={`bottom-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined} aria-label={label}>
            <Icon size={20} aria-hidden="true" />
            <span>{short}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Footer() {
  const { config } = useConfig();
  return (
    <footer className="site-footer">
      <div className="wrap footer-inner">
        <div className="footer-brand">
          <Emblem size={26} />
          <div>
            <p className="footer-name">{config.server_name}</p>
            <p className="footer-tagline">{config.tagline}</p>
          </div>
        </div>
        <nav className="footer-links" aria-label="바닥글 메뉴">
          <Link to="/notices">공지사항</Link>
          <Link to="/updates">업데이트</Link>
          <Link to="/events">이벤트</Link>
          <Link to="/board/free">자유게시판</Link>
          <Link to="/board/photo">사진게시판</Link>
          <Link to="/chat">커뮤니티</Link>
          <Link to="/account">내 계정</Link>
        </nav>
        <p className="footer-note">© 2026 {config.server_name}. 팬 커뮤니티 사이트.</p>
      </div>
    </footer>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main">본문으로 건너뛰기</a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <BottomNav />
      <IosInstallHint />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {action && <div className="page-head-action">{action}</div>}
    </div>
  );
}
