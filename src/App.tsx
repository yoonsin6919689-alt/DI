import { useEffect } from "react";
import { SiteLayout, PageHeader } from "@/components/Layout";
import { ConfigProvider, useConfig } from "@/lib/config";
import { SessionProvider } from "@/lib/session";
import { Link, useRoute } from "@/lib/router";
import { HomePage } from "@/pages/Home";
import { LoginPage } from "@/pages/Login";
import { SignupPage } from "@/pages/Signup";
import { NoticesPage } from "@/pages/Notices";
import { NoticeDetailPage } from "@/pages/NoticeDetail";
import { UpdatesPage } from "@/pages/Updates";
import { ChatPage } from "@/pages/Chat";
import { BoardPage } from "@/pages/Board";
import { PostDetailPage } from "@/pages/PostDetail";
import { AccountPage } from "@/pages/Account";
import { AdminPage } from "@/pages/Admin";
import type { BoardKey } from "@/lib/types";

function NotFoundPage() {
  return (
    <div className="wrap page-body">
      <PageHeader
        eyebrow="404"
        title="페이지를 찾을 수 없습니다"
        description="주소가 바뀌었거나 삭제된 페이지입니다."
        action={<Link to="/" className="btn btn-primary">홈으로</Link>}
      />
    </div>
  );
}

function Routes() {
  const path = useRoute();
  const { config } = useConfig();

  useEffect(() => {
    const name = config.server_name;
    const titles: Record<string, string> = {
      "/login": "로그인",
      "/signup": "회원가입",
      "/notices": "공지사항",
      "/updates": "업데이트",
      "/board/free": "자유게시판",
      "/board/photo": "사진게시판",
      "/chat": "커뮤니티 채팅",
      "/account": "내 계정",
      "/admin": "관리자",
    };
    const section =
      titles[path] ??
      (path.startsWith("/notices/") ? "공지사항" : null) ??
      (path.startsWith("/board/free/") ? "자유게시판" : null) ??
      (path.startsWith("/board/photo/") ? "사진게시판" : null);
    document.title = section ? `${section} · ${name}` : `${name} · ${config.tagline}`;
  }, [path, config.server_name, config.tagline]);

  if (path === "/") return <HomePage />;
  if (path === "/login") return <LoginPage />;
  if (path === "/signup") return <SignupPage />;
  if (path === "/notices") return <NoticesPage />;
  const noticeMatch = path.match(/^\/notices\/([^/]+)$/);
  if (noticeMatch) return <NoticeDetailPage id={decodeURIComponent(noticeMatch[1])} />;
  if (path === "/updates") return <UpdatesPage />;
  if (path === "/board/free") return <BoardPage board="free" />;
  if (path === "/board/photo") return <BoardPage board="photo" />;
  const postMatch = path.match(/^\/board\/(free|photo)\/([^/]+)$/);
  if (postMatch) {
    return <PostDetailPage board={postMatch[1] as BoardKey} id={decodeURIComponent(postMatch[2])} />;
  }
  if (path === "/chat") return <ChatPage />;
  if (path === "/account") return <AccountPage />;
  if (path === "/admin") return <AdminPage />;
  return <NotFoundPage />;
}

export default function App() {
  return (
    <ConfigProvider>
      <SessionProvider>
        <SiteLayout>
          <Routes />
        </SiteLayout>
      </SessionProvider>
    </ConfigProvider>
  );
}
