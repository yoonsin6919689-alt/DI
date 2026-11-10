import { useEffect, useState, type FormEvent } from "react";
import {
  BadgeCheck, LoaderCircle, LogOut, Mail, MessagesSquare, ShieldAlert, ShieldCheck,
} from "lucide-react";
import { Link, navigate } from "@/lib/router";
import { useSession } from "@/lib/session";
import { api, friendlyError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Verification } from "@/lib/types";
import { PageHeader } from "@/components/Layout";
import { VerificationPanel } from "@/components/VerificationPanel";

export function AccountPage() {
  const { user, verification, loading, refresh, logout } = useSession();
  const [localVerification, setLocalVerification] = useState<Verification | null>(verification);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [emailInput, setEmailInput] = useState(user?.email ?? "");
  const [emailBusy, setEmailBusy] = useState<"" | "save" | "consent">("");
  const [emailNote, setEmailNote] = useState("");

  useEffect(() => {
    setEmailInput(user?.email ?? "");
  }, [user?.email]);

  useEffect(() => {
    setLocalVerification(verification);
  }, [verification]);

  const regenerate = async () => {
    setRegenerating(true);
    setError("");
    try {
      const result = await api<{ verification: Verification }>("/api/verify/refresh", { method: "POST" });
      setLocalVerification(result.verification);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setRegenerating(false);
    }
  };

  const saveEmail = async (event: FormEvent) => {
    event.preventDefault();
    setEmailNote("");
    setError("");
    setEmailBusy("save");
    try {
      await api<{ user: unknown }>("/api/email/address", {
        method: "POST",
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      await refresh();
      setEmailNote("이메일 주소를 저장했습니다.");
    } catch (caught) {
      setEmailNote(friendlyError(caught));
    } finally {
      setEmailBusy("");
    }
  };

  const setConsent = async (consent: boolean) => {
    setEmailNote("");
    setEmailBusy("consent");
    try {
      await api<{ user: unknown }>("/api/email/consent", {
        method: "POST",
        body: JSON.stringify({ consent }),
      });
      await refresh();
      setEmailNote(consent ? "공지 메일 수신에 동의했습니다." : "공지 메일 수신을 거부했습니다.");
    } catch (caught) {
      setEmailNote(friendlyError(caught));
    } finally {
      setEmailBusy("");
    }
  };

  const signOut = async () => {
    setLoggingOut(true);
    setError("");
    try {
      await logout();
      navigate("/");
    } catch (caught) {
      setError(friendlyError(caught));
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="wrap page">
        <div className="card skeleton-card tall" aria-hidden="true" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="wrap page">
        <PageHeader eyebrow="ACCOUNT" title="내 계정" description="계정과 공지 메일 수신 설정을 관리합니다." />
        <div className="empty-state">
          <ShieldAlert size={26} aria-hidden="true" />
          <p>로그인하면 계정 정보와 인증 상태를 확인할 수 있습니다.</p>
          <div className="button-row">
            <Link to="/login" className="btn btn-gold">로그인</Link>
            <Link to="/signup" className="btn btn-ghost">회원가입</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap page">
      <PageHeader eyebrow="ACCOUNT" title="내 계정" description="계정과 공지 메일 수신 설정을 관리합니다." />

      <div className="account-grid">
        {!user.verified && (
          <section className="card pending-card">
            <p className="eyebrow">APPROVAL</p>
            <h2 className="card-title">
              <BadgeCheck size={18} aria-hidden="true" /> 관리자 승인 대기
            </h2>
            <p className="side-text">
              가입 신청이 접수되었습니다. 관리자가 <strong>인증 요청</strong>을 확인하면 계정이 활성화되고
              커뮤니티 채팅에 참여할 수 있습니다.
            </p>
            <p className="form-note">
              인게임 코드 인증을 완료하면 승인을 기다리지 않고 바로 활성화됩니다.
            </p>
          </section>
        )}

        <section className="card profile-card">
          <div className="profile-head">
            <div className="avatar" aria-hidden="true">{user.nickname.slice(0, 1)}</div>
            <div>
              <h2 className="profile-nick">{user.nickname}</h2>
              <p className="profile-username">@{user.username}</p>
            </div>
          </div>

          <dl className="profile-facts">
            <div>
              <dt>권한</dt>
              <dd>{user.role === "admin" ? "관리자" : "모험가"}</dd>
            </div>
            <div>
              <dt>이메일</dt>
              <dd>{user.email ?? "미등록"}</dd>
            </div>
            <div>
              <dt>인증 상태</dt>
              <dd className={user.verified ? "ok" : "wait"}>
                {user.verified ? "인증 완료" : "승인 대기"}
              </dd>
            </div>
            <div>
              <dt>가입일</dt>
              <dd>{formatDate(user.createdAt)}</dd>
            </div>
          </dl>

          <div className="profile-actions">
            {user.role === "admin" && (
              <Link to="/admin" className="btn btn-gold">
                <ShieldCheck size={16} /> 관리자 페이지
              </Link>
            )}
            {user.verified && (
              <Link to="/chat" className="btn btn-ghost">
                <MessagesSquare size={16} /> 채팅으로 이동
              </Link>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => void signOut()} disabled={loggingOut}>
              {loggingOut ? <LoaderCircle size={16} className="spin" /> : <LogOut size={16} />}
              로그아웃
            </button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </section>

        <section className="card">
          <p className="eyebrow">EMAIL</p>
          <h2 className="card-title">
            <Mail size={18} aria-hidden="true" /> 공지 메일
          </h2>
          <p className="side-text">
            서버 공지와 운영 안내를 받을 이메일입니다. 전체메일 발송에만 사용됩니다.
            {!user.email && " 아직 등록된 이메일이 없습니다."}
          </p>

          <form onSubmit={saveEmail} className="form">
            <label className="field">
              <span>이메일 주소</span>
              <input
                className="input"
                type="email"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                required
              />
            </label>
            <button type="submit" className="btn btn-gold btn-block" disabled={emailBusy === "save"}>
              {emailBusy === "save" ? <LoaderCircle size={16} className="spin" /> : <Mail size={16} />}
              이메일 주소 저장
            </button>
          </form>

          {user.email && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={user.emailConsent}
                disabled={emailBusy === "consent"}
                onChange={(event) => void setConsent(event.target.checked)}
              />
              <span>공지·운영 안내 메일 수신</span>
            </label>
          )}

          {emailNote && <p className="form-note" role="status">{emailNote}</p>}

          <details className="verify-fallback">
            <summary>인게임 코드로 인증하기</summary>
            {localVerification ? (
              <VerificationPanel
                verification={localVerification}
                regenerating={regenerating}
                onRegenerate={() => void regenerate()}
                onVerified={() => void refresh()}
              />
            ) : (
              <button type="button" className="btn btn-ghost btn-block" onClick={() => void regenerate()} disabled={regenerating}>
                {regenerating ? <LoaderCircle size={16} className="spin" /> : null}
                인게임 인증 코드 발급
              </button>
            )}
          </details>
        </section>
      </div>
    </div>
  );
}
