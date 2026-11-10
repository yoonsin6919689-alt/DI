import { useEffect, useState } from "react";
import { Check, Copy, LoaderCircle, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { formatTime } from "@/lib/format";
import type { User, Verification } from "@/lib/types";

export function VerificationPanel({
  verification,
  onVerified,
  onRegenerate,
  regenerating,
}: {
  verification: Verification;
  onVerified: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const result = await api<{ user: User }>("/api/me");
        if (active && result.user.verified) onVerified();
      } catch {
        // A transient failure keeps the panel visible; polling continues.
      }
    };
    const timer = window.setInterval(() => void check(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [onVerified]);

  const copyCode = async () => {
    if (await copyText(verification.code)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const checkNow = async () => {
    setChecking(true);
    setStatus("");
    try {
      const result = await api<{ user: User }>("/api/me");
      if (result.user.verified) {
        onVerified();
        return;
      }
      setStatus("아직 인증이 확인되지 않았습니다. 인게임에서 코드를 입력한 뒤 다시 시도해 주세요.");
    } catch {
      setStatus("인증 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="verify-panel">
      <div className="verify-head">
        <div>
          <p className="eyebrow">IN-GAME VERIFICATION</p>
          <h3 className="verify-title">인게임 인증</h3>
        </div>
        <span className="badge neutral">미인증</span>
      </div>

      <p className="verify-help">
        마인크래프트 서버에 접속한 뒤 채팅창에 아래 명령을 입력하세요.
        인증이 완료되면 채팅과 계정 기능이 열립니다.
      </p>

      <div className="verify-code-row">
        <code className="verify-code">{verification.code}</code>
        <button type="button" className="copy-btn" onClick={() => void copyCode()}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          <span>{copied ? "복사됨" : "복사"}</span>
        </button>
      </div>

      <div className="verify-command">
        <span>인게임 명령</span>
        <code>/인증 {verification.code}</code>
      </div>

      <p className="verify-expiry">코드 만료 {formatTime(verification.expiresAt)} · 만료 후 재발급할 수 있습니다.</p>

      {status && <p className="form-note" role="status">{status}</p>}

      <div className="verify-actions">
        <button type="button" className="btn btn-gold" onClick={() => void checkNow()} disabled={checking}>
          {checking ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}
          인증 확인
        </button>
        <button type="button" className="btn btn-ghost" onClick={onRegenerate} disabled={regenerating}>
          {regenerating ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}
          코드 재발급
        </button>
      </div>
    </div>
  );
}
