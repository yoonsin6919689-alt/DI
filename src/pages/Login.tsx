import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Link, navigate } from "@/lib/router";
import { useSession } from "@/lib/session";
import { api, friendlyError } from "@/lib/api";
import type { User, Verification } from "@/lib/types";

export function LoginPage() {
  const { user, loading, applySession } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/account");
  }, [loading, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await api<{ user: User; verification: Verification | null }>("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password, remember }),
      });
      applySession(result.user, result.verification);
      navigate("/account");
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wrap auth-wrap">
      <div className="auth-shell">
        <aside className="auth-aside">
          <p className="eyebrow">WELCOME BACK</p>
          <h2>모험을 이어서.</h2>
          <p>계정에 로그인하면 커뮤니티 채팅과 인게임 인증 상태를 확인할 수 있습니다.</p>
          <ul className="auth-points">
            <li>인게임 닉네임과 연결된 계정</li>
            <li>실시간 웹 채팅 참여</li>
            <li>공지와 업데이트 알림</li>
          </ul>
        </aside>

        <div className="auth-card">
          <p className="eyebrow">LOGIN</p>
          <h1 className="auth-title">로그인</h1>

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
                required
              />
            </label>

            <label className="field">
              <span>비밀번호</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <label className="checkbox-row auth-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              자동 로그인 (30일 유지)
            </label>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button type="submit" className="btn btn-gold btn-block" disabled={submitting}>
              {submitting ? <LoaderCircle size={16} className="spin" /> : null}
              로그인
            </button>
          </form>

          <p className="auth-switch">
            아직 계정이 없나요? <Link to="/signup">회원가입</Link>
          </p>
          <Link to="/" className="text-link back-link">홈으로 <ArrowRight size={14} /></Link>
        </div>
      </div>
    </div>
  );
}
