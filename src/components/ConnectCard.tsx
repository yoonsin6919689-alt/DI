import { useEffect, useState } from "react";
import { Check, Copy, Lock, LogIn } from "lucide-react";
import { Link } from "@/lib/router";
import { useConfig } from "@/lib/config";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { copyText } from "@/lib/clipboard";
import { statusLabel, useServerStatus } from "@/lib/serverStatus";

type ConnectInfo = {
  java: { host: string; port: string };
  bedrock: { host: string; port: string };
};

function AddressRow({
  label,
  host,
  port,
  onCopy,
  copied,
}: {
  label: string;
  host: string;
  port: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="addr-row">
      <div className="addr-label">{label}</div>
      <div className="addr-value">
        <code>{host || "주소 준비 중"}</code>
        {host && port && <span className="addr-port">:{port}</span>}
      </div>
      <button
        type="button"
        className="copy-btn"
        onClick={onCopy}
        disabled={!host}
        aria-label={`${label} 주소 복사`}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        <span>{copied ? "복사됨" : "복사"}</span>
      </button>
    </div>
  );
}

export function ConnectCard() {
  const { config } = useConfig();
  const { user, loading: sessionLoading } = useSession();
  const status = useServerStatus();
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !user.verified) {
      setInfo(null);
      setLoadFailed(false);
      return;
    }
    let active = true;
    api<ConnectInfo>("/api/connect")
      .then((data) => {
        if (!active) return;
        setInfo(data);
        setLoadFailed(false);
      })
      .catch(() => {
        if (!active) return;
        setInfo(null);
        setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const copy = async (key: string, host: string, port: string) => {
    const target = port ? `${host}:${port}` : host;
    if (await copyText(target)) {
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1800);
    }
  };

  const statusText = statusLabel(status, config.status_text || "상태 미정");
  const dot = !status.live ? " wait" : status.online ? " ok" : "";

  return (
    <section className="card connect-card" id="connect" aria-labelledby="connect-title">
      <div className="connect-head">
        <div>
          <p className="eyebrow">SERVER</p>
          <h2 id="connect-title" className="connect-title">접속 정보</h2>
        </div>
        <span className={`status-pill${status.online && status.live ? " live" : ""}`}>
          <span className={`status-dot${dot}`} aria-hidden="true" />
          {statusText}
        </span>
      </div>

      {sessionLoading ? (
        <div className="list-skeleton" aria-hidden="true">
          <span /><span />
        </div>
      ) : !user ? (
        <div className="connect-locked">
          <Lock size={18} aria-hidden="true" />
          <p>
            서버 주소는 <strong>승인된 회원</strong>에게만 공개됩니다.
            <br />
            로그인 후 확인할 수 있습니다.
          </p>
          <Link to="/login" className="btn btn-gold btn-block">
            <LogIn size={16} />
            로그인
          </Link>
        </div>
      ) : !user.verified ? (
        <div className="connect-locked">
          <Lock size={18} aria-hidden="true" />
          <p>
            아직 승인 전 계정입니다.
            <br />
            승인 또는 인게임 인증을 마치면 주소가 표시됩니다.
          </p>
          <Link to="/account" className="btn btn-ghost btn-block">
            인증 상태 확인
          </Link>
        </div>
      ) : !info ? (
        <div className="connect-locked">
          <p>{loadFailed ? "주소를 불러오지 못했습니다. 새로고침해 주세요." : "주소를 불러오는 중…"}</p>
        </div>
      ) : (
        <div className="addr-list">
          <AddressRow
            label="JAVA"
            host={info.java.host}
            port={info.java.port}
            copied={copied === "java"}
            onCopy={() => void copy("java", info.java.host, info.java.port)}
          />
          <AddressRow
            label="BEDROCK"
            host={info.bedrock.host}
            port={info.bedrock.port}
            copied={copied === "bedrock"}
            onCopy={() => void copy("bedrock", info.bedrock.host, info.bedrock.port)}
          />
        </div>
      )}

      <p className="connect-note">{config.status_note}</p>

      {config.discord_url && (
        <a className="btn btn-ghost btn-block" href={config.discord_url} target="_blank" rel="noreferrer noopener">
          디스코드 커뮤니티
        </a>
      )}
    </section>
  );
}
