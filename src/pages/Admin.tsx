import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  BadgeCheck, Download, House, LoaderCircle, Mail, MessagesSquare, NotebookPen, Pencil, Plus,
  RefreshCw, ScrollText, Send, Settings, ShieldAlert, Sparkles, Trash, UserPlus, Users,
} from "lucide-react";
import { Link } from "@/lib/router";
import { useSession } from "@/lib/session";
import { useConfig } from "@/lib/config";
import { api, friendlyError } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import type {
  AdminMessage, AdminOverview, AdminPost, AdminUser, BoardKey, MailResult, MailState, MemberStatus,
  Notice, SiteConfig, UpdateEntry,
} from "@/lib/types";
import { PageHeader } from "@/components/Layout";

type Tab = "overview" | "notices" | "updates" | "posts" | "settings" | "members" | "verify" | "mail" | "chat";

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: "overview", label: "개요", icon: House },
  { id: "notices", label: "공지", icon: ScrollText },
  { id: "updates", label: "업데이트", icon: Sparkles },
  { id: "posts", label: "게시판", icon: NotebookPen },
  { id: "settings", label: "서버 설정", icon: Settings },
  { id: "members", label: "회원", icon: Users },
  { id: "verify", label: "인증 요청", icon: BadgeCheck },
  { id: "mail", label: "전체메일", icon: Mail },
  { id: "chat", label: "채팅 관리", icon: MessagesSquare },
];

function useAdminList<T>(path: string, key: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Record<string, T[]>>(path);
      setItems(data[key] ?? []);
      setError("");
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, [path, key]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, setItems, loading, error, setError, reload };
}

function OverviewTab({ onGo }: { onGo: (tab: Tab) => void }) {
  const [stats, setStats] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<AdminOverview>("/api/admin/overview")
      .then((data) => {
        if (active) setStats(data);
      })
      .catch((caught) => {
        if (active) setError(friendlyError(caught));
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="admin-panel">
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="stat-grid">
        {[
          { label: "가입자", value: stats?.users, note: `관리자 ${stats?.admins ?? 0}명`, tab: "members" as Tab },
          { label: "채팅 메시지", value: stats?.messages, note: "삭제 제외", tab: "chat" as Tab },
          { label: "공지", value: stats?.notices, note: "게시 중", tab: "notices" as Tab },
          { label: "업데이트", value: stats?.updates, note: "등록됨", tab: "updates" as Tab },
        ].map(({ label, value, note, tab }) => (
          <button key={label} type="button" className="card stat-card" onClick={() => onGo(tab)}>
            <span className="stat-label">{label}</span>
            <strong className="stat-value">{value ?? "–"}</strong>
            <span className="stat-note">{note}</span>
          </button>
        ))}
      </div>

      <div className="card admin-note">
        <h2 className="card-title">운영 안내</h2>
        <p>
          사이트의 첫 번째 가입 계정이 관리자 권한을 받습니다. 관리자 페이지에서 서버 주소,
          공지, 업데이트, 게시판을 직접 관리할 수 있습니다.
        </p>
        <p>
          새로 가입한 회원은 <strong>인증 요청</strong> 탭에 표시됩니다. 승인하면 바로 채팅에 참여할 수 있습니다.
          전체메일 발송은 <strong>전체메일</strong> 탭에서 Gmail 릴레이를 먼저 설정해야 동작합니다.
        </p>
        <p>
          홈 화면 문구와 콘텐츠 카드는 Windows용 편집기 프로그램(.exe)으로도 수정할 수 있습니다.
          관리자 계정으로 로그인해 사용하세요.
        </p>
        <a href="/downloads/DIMENSION-Editor.exe" download="DIMENSION-홈페이지-편집기.exe" className="btn btn-ghost btn-small">
          <Download size={14} /> 홈페이지 편집기(.exe) 다운로드
        </a>
      </div>
    </div>
  );
}

function NoticesTab() {
  const { items, loading, error, setError, reload } = useAdminList<Notice>("/api/admin/notices", "notices");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setPinned(false);
  };

  const startEdit = (notice: Notice) => {
    setEditingId(notice.id);
    setTitle(notice.title);
    setBody(notice.body);
    setPinned(notice.pinned);
    window.scrollTo(0, 0);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await api(`/api/admin/notices/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({ title, body, pinned }),
        });
      } else {
        await api("/api/admin/notices", {
          method: "POST",
          body: JSON.stringify({ title, body, pinned }),
        });
      }
      reset();
      await reload();
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("이 공지를 삭제할까요?")) return;
    try {
      await api(`/api/admin/notices/${id}`, { method: "DELETE" });
      if (editingId === id) reset();
      await reload();
    } catch (caught) {
      setError(friendlyError(caught));
    }
  };

  return (
    <div className="admin-panel">
      <form className="card editor" onSubmit={(event) => void submit(event)}>
        <div className="card-head">
          <h2 className="card-title">{editingId ? "공지 수정" : "새 공지"}</h2>
          {editingId && <button type="button" className="text-link inline-button" onClick={reset}>수정 취소</button>}
        </div>

        <label className="field">
          <span>제목</span>
          <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
        </label>
        <label className="field">
          <span>본문</span>
          <textarea className="textarea" value={body} onChange={(event) => setBody(event.target.value)} rows={6} required />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
          <span>상단 고정</span>
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button type="submit" className="btn btn-gold" disabled={saving}>
          {saving ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}
          {editingId ? "수정 저장" : "공지 등록"}
        </button>
      </form>

      <div className="admin-list">
        {loading && <div className="list-skeleton" aria-hidden="true"><span /><span /></div>}
        {!loading && items.length === 0 && <p className="empty-note">등록된 공지가 없습니다.</p>}
        {items.map((notice) => (
          <div key={notice.id} className="admin-row">
            <div className="admin-row-main">
              <div className="board-tags">
                {notice.pinned && <span className="badge gold">고정</span>}
                <strong>{notice.title}</strong>
              </div>
              <span className="admin-row-meta">{formatDate(notice.createdAt)}</span>
            </div>
            <div className="row-actions">
              <button type="button" className="icon-button" onClick={() => startEdit(notice)} aria-label="수정"><Pencil size={16} /></button>
              <button type="button" className="icon-button danger" onClick={() => void remove(notice.id)} aria-label="삭제"><Trash size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UpdatesTab() {
  const { items, loading, error, setError, reload } = useAdminList<UpdateEntry>("/api/admin/updates", "updates");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setEditingId(null);
    setVersion("");
    setTitle("");
    setBody("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = JSON.stringify({ version, title, body });
    try {
      if (editingId) {
        await api(`/api/admin/updates/${editingId}`, { method: "PATCH", body: payload });
      } else {
        await api("/api/admin/updates", { method: "POST", body: payload });
      }
      reset();
      await reload();
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("이 업데이트 노트를 삭제할까요?")) return;
    try {
      await api(`/api/admin/updates/${id}`, { method: "DELETE" });
      if (editingId === id) reset();
      await reload();
    } catch (caught) {
      setError(friendlyError(caught));
    }
  };

  return (
    <div className="admin-panel">
      <form className="card editor" onSubmit={(event) => void submit(event)}>
        <div className="card-head">
          <h2 className="card-title">{editingId ? "업데이트 수정" : "새 업데이트"}</h2>
          {editingId && <button type="button" className="text-link inline-button" onClick={reset}>수정 취소</button>}
        </div>

        <div className="field-row">
          <label className="field">
            <span>버전</span>
            <input className="input" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="v1.9.0" maxLength={20} required />
          </label>
          <label className="field grow">
            <span>제목</span>
            <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
          </label>
        </div>
        <label className="field">
          <span>본문</span>
          <textarea className="textarea" value={body} onChange={(event) => setBody(event.target.value)} rows={7} required />
          <small>빈 줄로 문단을 구분합니다. [신규], [수정] 같은 머리말을 사용할 수 있습니다.</small>
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button type="submit" className="btn btn-gold" disabled={saving}>
          {saving ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}
          {editingId ? "수정 저장" : "업데이트 등록"}
        </button>
      </form>

      <div className="admin-list">
        {loading && <div className="list-skeleton" aria-hidden="true"><span /><span /></div>}
        {!loading && items.length === 0 && <p className="empty-note">등록된 업데이트가 없습니다.</p>}
        {items.map((entry) => (
          <div key={entry.id} className="admin-row">
            <div className="admin-row-main">
              <div className="board-tags">
                <span className="version-chip">{entry.version}</span>
                <strong>{entry.title}</strong>
              </div>
              <span className="admin-row-meta">{formatDate(entry.createdAt)}</span>
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="icon-button"
                aria-label="수정"
                onClick={() => {
                  setEditingId(entry.id);
                  setVersion(entry.version);
                  setTitle(entry.title);
                  setBody(entry.body);
                  window.scrollTo(0, 0);
                }}
              >
                <Pencil size={16} />
              </button>
              <button type="button" className="icon-button danger" onClick={() => void remove(entry.id)} aria-label="삭제"><Trash size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SETTING_FIELDS: { key: keyof SiteConfig; label: string; hint?: string; textarea?: boolean }[] = [
  { key: "server_name", label: "서버 이름", hint: "메인 화면 로고 옆에 표시됩니다." },
  { key: "tagline", label: "한 줄 소개" },
  { key: "java_host", label: "Java 주소", hint: "승인된 회원에게만 보입니다. 도메인 또는 서버 IP를 입력하세요." },
  { key: "java_port", label: "Java 포트" },
  { key: "bedrock_host", label: "Bedrock 주소", hint: "모바일 접속용. 승인된 회원에게만 보입니다." },
  { key: "bedrock_port", label: "Bedrock 포트" },
  { key: "status_text", label: "상태 문구", hint: "인게임 연동 전이거나 서버가 꺼졌을 때 표시됩니다." },
  { key: "status_note", label: "상태 안내문", textarea: true },
  { key: "discord_url", label: "디스코드 링크", hint: "https:// 로 시작하는 주소" },
];

function SettingsTab() {
  const { config, reload: reloadConfig, setConfig } = useConfig();
  const [form, setForm] = useState<SiteConfig>(config);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    api<{ config: SiteConfig }>("/api/admin/settings")
      .then((data) => {
        if (active) setForm({ ...config, ...data.config });
      })
      .catch((caught) => {
        if (active) setError(friendlyError(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [config]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const values = Object.fromEntries(
        SETTING_FIELDS.map(({ key }) => [key, form[key] ?? ""]),
      );
      const data = await api<{ config: SiteConfig }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ values }),
      });
      setForm({ ...form, ...data.config });
      setConfig({ ...form, ...data.config });
      await reloadConfig();
      setSaved(true);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel">
      <form className="card editor" onSubmit={(event) => void submit(event)}>
        <h2 className="card-title">서버 정보</h2>
        <p className="form-note">저장하면 메인 화면과 접속 카드에 즉시 반영됩니다.</p>

        {loading ? (
          <div className="list-skeleton" aria-hidden="true"><span /><span /><span /></div>
        ) : (
          SETTING_FIELDS.map(({ key, label, hint, textarea }) => (
            <label key={key} className="field">
              <span>{label}</span>
              {textarea ? (
                <textarea
                  className="textarea"
                  rows={3}
                  value={form[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                />
              ) : (
                <input
                  className="input"
                  value={form[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                  maxLength={300}
                />
              )}
              {hint && <small>{hint}</small>}
            </label>
          ))
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
        {saved && <p className="form-success" role="status">저장되었습니다.</p>}

        <button type="submit" className="btn btn-gold" disabled={saving || loading}>
          {saving ? <LoaderCircle size={16} className="spin" /> : null}
          설정 저장
        </button>
      </form>
    </div>
  );
}

function MailTab() {
  const [state, setState] = useState<MailState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");
  const [relayUrl, setRelayUrl] = useState("");
  const [relayToken, setRelayToken] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsNote, setSettingsNote] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<MailState>("/api/admin/mail");
      setState(data);
      setRelayUrl(data.relayUrl);
      setSenderAddress(data.senderAddress);
      setError("");
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    setSavingSettings(true);
    setSettingsNote("");
    try {
      await api("/api/admin/mail/settings", {
        method: "PATCH",
        body: JSON.stringify({ relayUrl, relayToken, senderAddress }),
      });
      setRelayToken("");
      setSettingsNote("메일 설정을 저장했습니다.");
      await reload();
    } catch (caught) {
      setSettingsNote(friendlyError(caught));
    } finally {
      setSavingSettings(false);
    }
  };

  const send = async (test: boolean) => {
    if (!test && !window.confirm(`${state?.recipients ?? 0}명에게 메일을 보낼까요? 발송 후에는 취소할 수 없습니다.`)) return;
    setSending(true);
    setNote("");
    try {
      const result = await api<MailResult>("/api/admin/mail", {
        method: "POST",
        body: JSON.stringify(test
          ? { subject, text: body, testEmail: testEmail.trim() }
          : { subject, text: body }),
      });
      const failed = result.failed > 0 ? ` · 실패 ${result.failed}건` : "";
      setNote(test ? "테스트 메일을 보냈습니다." : `${result.sent}명에게 발송했습니다${failed}.`);
      if (!test) await reload();
    } catch (caught) {
      setNote(friendlyError(caught));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="admin-panel">
      <form className="card editor" onSubmit={saveSettings}>
        <h2 className="card-title">Gmail 릴레이 설정</h2>
        <p className="form-note">
          Google Apps Script 웹 앱 주소와 토큰을 넣으면 Gmail로 메일을 보냅니다.
          토큰은 저장 후 다시 표시되지 않습니다.
        </p>
        <label className="field">
          <span>릴레이 주소</span>
          <input
            className="input"
            value={relayUrl}
            onChange={(event) => setRelayUrl(event.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            spellCheck={false}
            required
          />
        </label>
        <label className="field">
          <span>릴레이 토큰 {state?.configured ? "(변경할 때만 입력)" : ""}</span>
          <input
            className="input"
            type="password"
            value={relayToken}
            onChange={(event) => setRelayToken(event.target.value)}
            autoComplete="new-password"
            placeholder={state?.configured ? "저장된 토큰 사용 중" : "스크립트에 넣은 토큰"}
            spellCheck={false}
          />
        </label>
        <label className="field">
          <span>보내는 주소 (선택)</span>
          <input
            className="input"
            type="email"
            value={senderAddress}
            onChange={(event) => setSenderAddress(event.target.value)}
            placeholder="dimension.server@gmail.com"
            spellCheck={false}
          />
        </label>
        {settingsNote && <p className="form-note" role="status">{settingsNote}</p>}
        <div className="row-actions">
          <button type="submit" className="btn btn-gold" disabled={savingSettings}>
            {savingSettings ? <LoaderCircle size={16} className="spin" /> : null}
            설정 저장
          </button>
          <span className={`badge ${state?.configured ? "green" : "neutral"}`}>
            {state?.configured ? "발송 준비됨" : "설정 필요"}
          </span>
        </div>
      </form>

      <div className="card editor">
        <h2 className="card-title">전체메일 보내기</h2>
        <p className="form-note">
          이메일을 등록하고 수신에 동의한 회원 <strong>{state?.recipients ?? 0}명</strong>에게 발송합니다.
        </p>
        <label className="field">
          <span>제목</span>
          <input
            className="input"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={120}
            placeholder="예: 11월 10일 정기 점검 안내"
            required
          />
        </label>
        <label className="field">
          <span>내용</span>
          <textarea
            className="textarea"
            rows={8}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={8000}
            placeholder={"안녕하세요, DIMENSION 운영팀입니다.\n\n..."}
            required
          />
          <small>{body.length} / 8000자 · 하단에 수신 거부 안내가 자동으로 붙습니다.</small>
        </label>
        <label className="field">
          <span>테스트 받을 이메일 (선택)</span>
          <input
            className="input"
            type="email"
            value={testEmail}
            onChange={(event) => setTestEmail(event.target.value)}
            placeholder="내 메일 주소"
            spellCheck={false}
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {note && <p className="form-note" role="status">{note}</p>}
        <div className="row-actions">
          <button
            type="button"
            className="btn btn-gold"
            disabled={sending || !subject.trim() || !body.trim() || !state?.configured}
            onClick={() => void send(false)}
          >
            {sending ? <LoaderCircle size={16} className="spin" /> : <Send size={16} />}
            전체 발송
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={sending || !subject.trim() || !body.trim() || !testEmail.trim() || !state?.configured}
            onClick={() => void send(true)}
          >
            테스트 발송
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">발송 기록</h2>
        {loading && <div className="list-skeleton" aria-hidden="true"><span /><span /></div>}
        {!loading && (state?.history.length ?? 0) === 0 && <p className="empty-note">아직 보낸 메일이 없습니다.</p>}
        <div className="admin-list">
          {state?.history.map((entry) => (
            <div key={entry.id} className="member-row">
              <div className="member-main">
                <strong>{entry.subject}</strong>
                <span className="admin-row-meta">
                  {formatDate(entry.createdAt)} · {entry.sentCount}/{entry.recipientCount}명 성공
                  {entry.failedCount > 0 ? ` · 실패 ${entry.failedCount}` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VerifyTab() {
  const { items, setItems, loading, error, setError, reload } = useAdminList<AdminUser>("/api/admin/users", "users");
  const [busyId, setBusyId] = useState<string | null>(null);
  const pending = items.filter((member) => !member.verified);

  const approve = async (target: AdminUser) => {
    setBusyId(target.id);
    setError("");
    try {
      const data = await api<{ user: AdminUser }>(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({ verified: true }),
      });
      setItems((current) => current.map((row) => (row.id === target.id ? data.user : row)));
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-panel">
      <section className="card">
        <p className="eyebrow">APPROVALS</p>
        <h2 className="card-title">
          <BadgeCheck size={18} aria-hidden="true" /> 인증 요청
        </h2>
        <p className="form-note">
          가입 후 아직 승인되지 않은 회원입니다. 승인하면 바로 채팅에 참여할 수 있습니다.
        </p>
        <div className="field-row">
          <p className="admin-row-meta grow">대기 {pending.length}명 · 전체 {items.length}명</p>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => void reload()} disabled={loading}>
            {loading ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />}
            새로고침
          </button>
        </div>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <div className="list-skeleton" aria-hidden="true"><span /><span /><span /></div>}

      <div className="admin-list">
        {pending.map((member) => (
          <div key={member.id} className="card member-row">
            <div className="member-main">
              <div className="member-id">
                <strong>{member.nickname}</strong>
                <span>@{member.username}</span>
                <span className="member-email">{member.email ?? "이메일 미등록"}</span>
              </div>
              <div className="member-tags">
                <span className="badge amber">승인 대기</span>
                {member.role === "admin" && <span className="badge gold">관리자</span>}
                <span className="admin-row-meta">{formatDate(member.createdAt)} 가입</span>
              </div>
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-gold btn-small"
                disabled={busyId === member.id}
                onClick={() => void approve(member)}
              >
                {busyId === member.id ? <LoaderCircle size={14} className="spin" /> : <BadgeCheck size={14} />}
                인증 승인
              </button>
            </div>
          </div>
        ))}
        {!loading && pending.length === 0 && <p className="empty-note">대기 중인 인증 요청이 없습니다.</p>}
      </div>
    </div>
  );
}

function MembersTab() {
  const { items, setItems, loading, error, setError, reload } = useAdminList<AdminUser>("/api/admin/users", "users");
  const { user: me } = useSession();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [promoteName, setPromoteName] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [promoteNote, setPromoteNote] = useState("");
  const [sanctionOpen, setSanctionOpen] = useState<string | null>(null);
  const [sanctionDays, setSanctionDays] = useState("7");
  const [sanctionReason, setSanctionReason] = useState("");
  const [sanctionBusy, setSanctionBusy] = useState<string | null>(null);

  const update = async (target: AdminUser, changes: { verified?: boolean; role?: "user" | "admin" }) => {
    setBusyId(target.id);
    setError("");
    try {
      const data = await api<{ user: AdminUser }>(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setItems((current) => current.map((row) => (row.id === target.id ? data.user : row)));
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setBusyId(null);
    }
  };

  const sanction = async (target: AdminUser, status: MemberStatus) => {
    setSanctionBusy(target.id);
    setError("");
    try {
      const days = sanctionDays === "0" ? null : Number(sanctionDays);
      const data = await api<{ user: AdminUser }>(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify(
          status === "active"
            ? { status }
            : { status, days, reason: sanctionReason.trim() },
        ),
      });
      setItems((current) => current.map((row) => (row.id === target.id ? data.user : row)));
      if (status === "active") {
        setSanctionOpen(null);
        setSanctionReason("");
      }
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setSanctionBusy(null);
    }
  };

  return (
    <div className="admin-panel">
      <form
        className="card editor"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          setPromoting(true);
          setPromoteNote("");
          void (async () => {
            try {
              const data = await api<{ already?: boolean }>("/api/admin/admins", {
                method: "POST",
                body: JSON.stringify({ username: promoteName }),
              });
              setPromoteName("");
              setPromoteNote(data.already ? "이미 관리자 권한이 있는 계정입니다." : "관리자로 등록했습니다.");
              await reload();
            } catch (caught) {
              setError(friendlyError(caught));
            } finally {
              setPromoting(false);
            }
          })();
        }}
      >
        <h2 className="card-title">관리자 등록</h2>
        <p className="form-note">가입한 계정의 아이디를 입력하면 바로 관리자 권한을 부여합니다.</p>
        <div className="field-row">
          <label className="field grow">
            <span>아이디</span>
            <input
              className="input"
              value={promoteName}
              onChange={(event) => setPromoteName(event.target.value)}
              placeholder="example_user"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </label>
          <button type="submit" className="btn btn-gold" disabled={promoting}>
            {promoting ? <LoaderCircle size={16} className="spin" /> : <UserPlus size={16} />}
            관리자 등록
          </button>
        </div>
        {promoteNote && <p className="form-success" role="status">{promoteNote}</p>}
      </form>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <div className="list-skeleton" aria-hidden="true"><span /><span /><span /></div>}

      <div className="admin-list">
        {items.map((member) => (
          <div key={member.id} className="card member-row">
            <div className="member-main">
              <div className="member-id">
                <strong>{member.nickname}</strong>
                <span>@{member.username}</span>
                <span className="member-email">
                  {member.email ?? "이메일 미등록"}
                  {member.email && !member.emailConsent ? " · 수신 거부" : ""}
                </span>
              </div>
              <div className="member-tags">
                <span className={`badge ${member.verified ? "green" : "neutral"}`}>
                  {member.verified ? "인증" : "미인증"}
                </span>
                <span className={`badge ${member.role === "admin" ? "gold" : "neutral"}`}>
                  {member.role === "admin" ? "관리자" : "모험가"}
                </span>
                {member.status === "suspended" && <span className="badge red">정지</span>}
                {member.status === "restricted" && <span className="badge amber">제한</span>}
                <span className="admin-row-meta">{formatDate(member.createdAt)} 가입</span>
              </div>
              {member.status !== "active" && (
                <p className="admin-row-meta">
                  {member.sanctionUntil ? `${formatDate(member.sanctionUntil)}까지` : "무기한"}
                  {member.sanctionReason ? ` · ${member.sanctionReason}` : ""}
                </p>
              )}
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-ghost btn-small"
                disabled={busyId === member.id}
                onClick={() => void update(member, { verified: !member.verified })}
              >
                {busyId === member.id ? <LoaderCircle size={14} className="spin" /> : null}
                {member.verified ? "인증 해제" : "인증 처리"}
              </button>
              <select
                className="select select-small"
                value={member.role}
                disabled={busyId === member.id || member.id === me?.id}
                aria-label={`${member.nickname} 권한`}
                onChange={(event) => void update(member, { role: event.target.value as "user" | "admin" })}
              >
                <option value="user">모험가</option>
                <option value="admin">관리자</option>
              </select>
              {member.role !== "admin" && member.id !== me?.id && (
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  disabled={sanctionBusy === member.id}
                  onClick={() => setSanctionOpen(sanctionOpen === member.id ? null : member.id)}
                >
                  제재
                </button>
              )}
            </div>
            {sanctionOpen === member.id && (
              <div className="sanction-panel">
                <div className="field-row">
                  <label className="field grow">
                    <span>사유</span>
                    <input
                      className="input"
                      value={sanctionReason}
                      maxLength={200}
                      onChange={(event) => setSanctionReason(event.target.value)}
                      placeholder="예: 게시판 규칙 위반"
                    />
                  </label>
                  <label className="field">
                    <span>기간</span>
                    <select
                      className="select select-small"
                      value={sanctionDays}
                      onChange={(event) => setSanctionDays(event.target.value)}
                    >
                      <option value="1">1일</option>
                      <option value="7">7일</option>
                      <option value="30">30일</option>
                      <option value="0">무기한</option>
                    </select>
                  </label>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    disabled={sanctionBusy === member.id}
                    onClick={() => void sanction(member, "suspended")}
                  >
                    {sanctionBusy === member.id ? <LoaderCircle size={14} className="spin" /> : null}
                    정지
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    disabled={sanctionBusy === member.id}
                    onClick={() => void sanction(member, "restricted")}
                  >
                    제한
                  </button>
                  {member.status !== "active" && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      disabled={sanctionBusy === member.id}
                      onClick={() => void sanction(member, "active")}
                    >
                      해제
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => setSanctionOpen(null)}
                  >
                    닫기
                  </button>
                </div>
                <p className="form-note">정지는 로그인을, 제한은 자유·사진게시판 작성과 채팅을 막습니다.</p>
              </div>
            )}
          </div>
        ))}
        {!loading && items.length === 0 && <p className="empty-note">아직 가입한 회원이 없습니다.</p>}
      </div>
    </div>
  );
}

function PostsTab() {
  const [board, setBoard] = useState<"all" | BoardKey>("all");
  const path = board === "all" ? "/api/admin/posts" : `/api/admin/posts?board=${board}`;
  const { items, setItems, loading, error, setError } = useAdminList<AdminPost>(path, "posts");
  const [busyId, setBusyId] = useState<string | null>(null);

  const remove = async (id: string) => {
    if (!window.confirm("이 글을 삭제할까요? 사진도 함께 삭제됩니다.")) return;
    setBusyId(id);
    setError("");
    try {
      await api(`/api/admin/posts/${id}`, { method: "DELETE" });
      setItems((current) => current.map((row) => (row.id === id ? { ...row, deleted: true } : row)));
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-panel">
      <div className="board-tabs" role="tablist" aria-label="게시판 필터">
        {([["all", "전체"], ["free", "자유게시판"], ["photo", "사진게시판"]] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={board === value}
            className={`board-tab${board === value ? " active" : ""}`}
            onClick={() => setBoard(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <div className="list-skeleton" aria-hidden="true"><span /><span /><span /></div>}

      <div className="admin-list">
        {items.map((post) => (
          <div key={post.id} className={`card moderation-row${post.deleted ? " deleted" : ""}`}>
            <div className="moderation-main">
              <div className="moderation-meta">
                <span className="badge neutral">{post.board === "photo" ? "사진" : "자유"}</span>
                <strong>{post.title}</strong>
                <span>{post.nickname} · {formatDate(post.createdAt)} {formatTime(post.createdAt)}</span>
                {post.deleted && <span className="badge neutral">삭제됨</span>}
              </div>
              {post.body && <p>{post.body.slice(0, 120)}</p>}
            </div>
            {!post.deleted && (
              <button
                type="button"
                className="btn btn-ghost btn-small"
                disabled={busyId === post.id}
                onClick={() => void remove(post.id)}
              >
                {busyId === post.id ? <LoaderCircle size={14} className="spin" /> : <Trash size={14} />}
                삭제
              </button>
            )}
          </div>
        ))}
        {!loading && items.length === 0 && <p className="empty-note">아직 게시글이 없습니다.</p>}
      </div>
    </div>
  );
}

function ChatModerationTab() {
  const { items, setItems, loading, error, setError } = useAdminList<AdminMessage>("/api/admin/messages", "messages");
  const [busyId, setBusyId] = useState<string | null>(null);

  const remove = async (id: string) => {
    setBusyId(id);
    setError("");
    try {
      await api(`/api/admin/messages/${id}`, { method: "DELETE" });
      setItems((current) => current.map((row) => (row.id === id ? { ...row, deleted: true } : row)));
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-panel">
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <div className="list-skeleton" aria-hidden="true"><span /><span /><span /></div>}

      <div className="admin-list">
        {items.map((message) => (
          <div key={message.id} className={`card moderation-row${message.deleted ? " deleted" : ""}`}>
            <div className="moderation-main">
              <div className="moderation-meta">
                <strong>{message.nickname}</strong>
                <span>{formatDate(message.createdAt)} {formatTime(message.createdAt)}</span>
                {message.deleted && <span className="badge neutral">삭제됨</span>}
              </div>
              <p>{message.body}</p>
            </div>
            {!message.deleted && (
              <button
                type="button"
                className="btn btn-ghost btn-small"
                disabled={busyId === message.id}
                onClick={() => void remove(message.id)}
              >
                {busyId === message.id ? <LoaderCircle size={14} className="spin" /> : <Trash size={14} />}
                삭제
              </button>
            )}
          </div>
        ))}
        {!loading && items.length === 0 && <p className="empty-note">아직 채팅 메시지가 없습니다.</p>}
      </div>
    </div>
  );
}

export function AdminPage() {
  const { user, loading } = useSession();
  const [tab, setTab] = useState<Tab>("overview");

  if (loading) {
    return <div className="wrap page"><div className="card skeleton-card tall" aria-hidden="true" /></div>;
  }

  if (!user) {
    return (
      <div className="wrap page">
        <PageHeader eyebrow="ADMIN" title="관리자" description="운영자 전용 페이지입니다." />
        <div className="empty-state">
          <ShieldAlert size={26} aria-hidden="true" />
          <p>로그인한 뒤 관리자 계정으로 접속해 주세요.</p>
          <Link to="/login" className="btn btn-gold">로그인</Link>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="wrap page">
        <PageHeader eyebrow="ADMIN" title="관리자" description="운영자 전용 페이지입니다." />
        <div className="empty-state">
          <ShieldAlert size={26} aria-hidden="true" />
          <p>이 계정에는 관리자 권한이 없습니다.</p>
          <Link to="/" className="btn btn-ghost">홈으로</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap page">
      <PageHeader
        eyebrow="ADMIN"
        title="관리자"
        description="공지, 업데이트, 서버 정보, 회원과 채팅을 관리합니다."
      />

      <div className="admin-tabs" role="tablist" aria-label="관리자 메뉴">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`admin-tab${tab === id ? " active" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab onGo={setTab} />}
      {tab === "notices" && <NoticesTab />}
      {tab === "updates" && <UpdatesTab />}
      {tab === "posts" && <PostsTab />}
      {tab === "settings" && <SettingsTab />}
      {tab === "members" && <MembersTab />}
      {tab === "verify" && <VerifyTab />}
      {tab === "mail" && <MailTab />}
      {tab === "chat" && <ChatModerationTab />}
    </div>
  );
}
