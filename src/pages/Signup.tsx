import { useState, type FormEvent } from "react";
import {
  ArrowRight, CheckCircle2, LoaderCircle,
} from "lucide-react";
import { Link, navigate } from "@/lib/router";
import { useSession } from "@/lib/session";
import { api, friendlyError } from "@/lib/api";
import type { User, Verification } from "@/lib/types";
import { VerificationPanel } from "@/components/VerificationPanel";

type Step = "form" | "verify" | "done";

export function SignupPage() {
  const { user, applySession, refresh } = useSession();
  const [step, setStep] = useState<Step>("form");
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [emailConsent, setEmailConsent] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [verification, setVerification] = useState<Verification | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<{
        user: User;
        verification: Verification;
      }>("/api/register", {
        method: "POST",
        body: JSON.stringify({ username, password, nickname, email, emailConsent }),
      });
      applySession(result.user, result.verification);
      setVerification(result.verification);
      setStep(result.user.verified ? "done" : "verify");
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const result = await api<{ verification: Verification }>("/api/verify/refresh", { method: "POST" });
      setVerification(result.verification);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setRegenerating(false);
    }
  };

  if (step === "done") {
    return (
      <div className="wrap auth-wrap">
        <div className="auth-card centered">
          <CheckCircle2 size={40} className="success-icon" />
          <h1 className="auth-title">인증 완료</h1>
          <p className="auth-desc">이제 커뮤니티 채팅에 참여할 수 있습니다.</p>
          <div className="button-row">
            <button type="button" className="btn btn-gold" onClick={() => navigate("/chat")}>
              채팅으로 이동 <ArrowRight size={16} />
            </button>
            <Link to="/account" className="btn btn-ghost">내 계정</Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === "verify" && verification) {
    return (
      <div className="wrap auth-wrap">
        <div className="auth-shell single">
          <div className="auth-card">
            <p className="eyebrow">ONE MORE STEP</p>
            <h1 className="auth-title">관리자 승인을 기다리는 중</h1>
            <p className="auth-desc">
              가입 신청이 접수되었습니다. 관리자가 <strong>인증 요청</strong>을 확인하면 계정이 활성화되고
              커뮤니티 채팅에 참여할 수 있습니다.
            </p>

            <p className="form-note">
              승인 전에 인게임 코드 인증을 먼저 마치면 기다리지 않고 바로 활성화됩니다.
            </p>

            <details className="verify-fallback">
              <summary>인게임 코드로 인증하기</summary>
              <VerificationPanel
                verification={verification}
                regenerating={regenerating}
                onRegenerate={() => void regenerate()}
                onVerified={() => {
                  void refresh();
                  setStep("done");
                }}
              />
            </details>

            <button type="button" className="text-link inline-button" onClick={() => navigate("/account")}>
              내 계정에서 승인 상태 확인 <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap auth-wrap">
      <div className="auth-shell">
        <aside className="auth-aside">
          <p className="eyebrow">CREATE ACCOUNT</p>
          <h2>캐릭터와 연결되는 계정.</h2>
          <p>아이디와 비밀번호, 인게임 닉네임, 이메일을 입력하면 시작할 수 있습니다. 가입 후 관리자 승인으로 계정이 활성화됩니다.</p>
          <ul className="auth-points">
            <li>관리자 승인으로 계정 활성화</li>
            <li>서버 공지 메일 수신</li>
            <li>웹 채팅 · 공지 · 계정 관리</li>
            <li>추후 랭킹과 전적 연동</li>
          </ul>
        </aside>

        <div className="auth-card">
          <p className="eyebrow">SIGN UP</p>
          <h1 className="auth-title">회원가입</h1>

          <form onSubmit={submit} className="form">
            <label className="field">
              <span>아이디</span>
              <input
                className="input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                minLength={3}
                maxLength={20}
                required
              />
              <small>영문 소문자, 숫자, _, - · 3~20자</small>
            </label>

            <label className="field">
              <span>비밀번호</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <small>8자 이상</small>
            </label>

            <label className="field">
              <span>비밀번호 확인</span>
              <input
                className="input"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            <label className="field">
              <span>인게임 닉네임</span>
              <input
                className="input"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                autoComplete="nickname"
                maxLength={20}
                required
              />
              <small>마인크래프트에서 사용하는 닉네임 · 2~20자</small>
            </label>

            <label className="field">
              <span>이메일</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                required
              />
              <small>서버 공지와 운영 안내를 받을 주소입니다.</small>
            </label>

            <label className="check-field">
              <input
                type="checkbox"
                checked={emailConsent}
                onChange={(event) => setEmailConsent(event.target.checked)}
              />
              <span>서버 공지·운영 안내 메일 수신에 동의합니다. (언제든 내 계정에서 변경)</span>
            </label>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button type="submit" className="btn btn-gold btn-block" disabled={submitting}>
              {submitting ? <LoaderCircle size={16} className="spin" /> : null}
              계정 만들기
            </button>
            <p className="form-note">사이트의 첫 번째 계정은 자동으로 관리자 권한을 받습니다.</p>
          </form>

          <p className="auth-switch">
            이미 계정이 있나요? <Link to="/login">로그인</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
