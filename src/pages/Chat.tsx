import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { LoaderCircle, MessageSquare, Send, ShieldAlert, Trash } from "lucide-react";
import { Link, navigate } from "@/lib/router";
import { useSession } from "@/lib/session";
import { api, ApiError, friendlyError } from "@/lib/api";
import { formatTime } from "@/lib/format";
import type { ChatMember, ChatMessage, Verification } from "@/lib/types";
import { PageHeader } from "@/components/Layout";
import { VerificationPanel } from "@/components/VerificationPanel";

function nicknameColor(nickname: string): string {
  let hash = 0;
  for (const char of nickname) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return `hsl(${hash} 62% 74%)`;
}

function ChatBubble({
  message,
  mine,
  canDelete,
  onDelete,
}: {
  message: ChatMessage;
  mine: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <div className={`chat-bubble${mine ? " mine" : ""}`}>
      <div className="chat-meta">
        <span className="chat-nick" style={{ color: mine ? undefined : nicknameColor(message.nickname) }}>
          {message.nickname}
        </span>
        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        {canDelete && (
          <button type="button" className="chat-delete" onClick={onDelete} aria-label={`${message.nickname}의 메시지 삭제`}>
            <Trash size={13} />
          </button>
        )}
      </div>
      <p className="chat-text">{message.body}</p>
    </div>
  );
}

export function ChatPage() {
  const { user, verification, loading, refresh } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [body, setBody] = useState("");
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [localVerification, setLocalVerification] = useState<Verification | null>(verification);
  const [regenerating, setRegenerating] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    setLocalVerification(verification);
  }, [verification]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await api<{ messages: ChatMessage[]; members: ChatMember[] }>("/api/chat");
        if (!active) return;
        setMessages(data.messages);
        setMembers(data.members ?? []);
        setLoadError("");
      } catch {
        if (active) setLoadError("채팅을 불러오지 못했습니다. 잠시 후 다시 시도합니다.");
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !atBottomRef.current) return;
    list.scrollTop = list.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const list = listRef.current;
    if (!list) return;
    atBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  };

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = body.trim();
    if (!value || sending) return;
    setSending(true);
    setSendError("");
    try {
      const result = await api<{ message: ChatMessage }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ body: value }),
      });
      setMessages((current) => [...current, result.message]);
      setBody("");
      atBottomRef.current = true;
    } catch (caught) {
      setSendError(friendlyError(caught));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  const removeMessage = async (id: string) => {
    try {
      await api(`/api/admin/messages/${id}`, { method: "DELETE" });
      setMessages((current) => current.filter((message) => message.id !== id));
    } catch (caught) {
      setSendError(friendlyError(caught));
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const result = await api<{ verification: Verification }>("/api/verify/refresh", { method: "POST" });
      setLocalVerification(result.verification);
    } catch (caught) {
      // The account can be verified in-game after this page loaded.
      if (caught instanceof ApiError && caught.code === "already_verified") await refresh();
      else setSendError(friendlyError(caught));
    } finally {
      setRegenerating(false);
    }
  };

  const canWrite = Boolean(user?.verified);

  return (
    <div className="wrap page">
      <PageHeader
        eyebrow="COMMUNITY"
        title="실시간 채팅"
        description="서버를 기다리는 동안, 모험 이야기를 나눠보세요."
      />

      <div className="chat-layout">
        <section className="card chat-main" aria-label="채팅 메시지">
          <div className="chat-topbar">
            <span className="chat-live"><span className="status-dot ok" aria-hidden="true" />LIVE</span>
            <span className="chat-topbar-meta">
              <span>{members.length}명 참여 중</span>
              <span>{messages.length}개의 메시지</span>
            </span>
          </div>

          <div className="chat-list" ref={listRef} onScroll={onScroll}>
            {messages.length === 0 && !loadError && (
              <div className="chat-empty">
                <MessageSquare size={24} aria-hidden="true" />
                <p>첫 메시지를 남겨보세요.</p>
              </div>
            )}
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                mine={Boolean(user && message.nickname === user.nickname)}
                canDelete={user?.role === "admin"}
                onDelete={() => void removeMessage(message.id)}
              />
            ))}
            {loadError && <p className="form-error chat-error" role="alert">{loadError}</p>}
          </div>

          <form className="chat-composer" onSubmit={(event) => void send(event)}>
            {!loading && !user && (
              <div className="chat-gate">
                <p>채팅에 참여하려면 로그인이 필요합니다.</p>
                <div className="button-row">
                  <Link to="/login" className="btn btn-gold btn-small">로그인</Link>
                  <Link to="/signup" className="btn btn-ghost btn-small">회원가입</Link>
                </div>
              </div>
            )}

            {user && !canWrite && (
              <p className="chat-note">
                <ShieldAlert size={15} aria-hidden="true" />
                관리자 승인 후 또는 인게임 인증을 완료하면 메시지를 보낼 수 있습니다.
              </p>
            )}

            {user && canWrite && (
              <>
                <label className="sr-only" htmlFor="chat-input">메시지</label>
                <div className="composer-row">
                  <textarea
                    id="chat-input"
                    className="chat-input"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
                    maxLength={200}
                    rows={2}
                  />
                  <button type="submit" className="btn btn-gold send-btn" disabled={sending || !body.trim()}>
                    {sending ? <LoaderCircle size={18} className="spin" /> : <Send size={18} />}
                    <span className="sr-only">전송</span>
                  </button>
                </div>
                <div className="composer-foot">
                  <span>{body.length}/200</span>
                  <span>욕설과 비방은 제재 대상입니다.</span>
                </div>
              </>
            )}

            {sendError && <p className="form-error" role="alert">{sendError}</p>}
          </form>
        </section>

        <aside className="chat-aside">
          <div className="card side-card chat-members">
            <p className="eyebrow">MEMBERS</p>
            <h2 className="card-title">
              채팅 참여자
              <span className="member-count">{members.length}</span>
            </h2>
            {members.length === 0 ? (
              <p className="side-text">지금 보고 있는 참여자가 없습니다.</p>
            ) : (
              <ul className="member-list">
                {members.map((member) => (
                  <li key={member.nickname} className={`member-row${member.self ? " me" : ""}`}>
                    <span className="member-dot" aria-hidden="true" />
                    <span className="member-name" style={{ color: nicknameColor(member.nickname) }}>
                      {member.nickname}
                    </span>
                    {member.self && <span className="member-tag">나</span>}
                    {member.role === "admin" && <span className="member-tag admin">관리자</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {user && !user.verified && localVerification && (
            <div className="card">
              <p className="form-note">관리자 승인 대기 중입니다. 승인되면 자동으로 활성화됩니다.</p>
              <VerificationPanel
                verification={localVerification}
                regenerating={regenerating}
                onRegenerate={() => void regenerate()}
                onVerified={() => void refresh()}
              />
            </div>
          )}

          {user && !user.verified && !localVerification && (
            <div className="card side-card">
              <p className="eyebrow">APPROVAL</p>
              <h2 className="card-title">관리자 승인 대기 중</h2>
              <p className="side-text">
                관리자가 인증 요청을 승인하면 자동으로 대화할 수 있습니다.
                인게임 코드로 먼저 인증할 수도 있습니다.
              </p>
              <button type="button" className="btn btn-gold btn-block" onClick={() => void regenerate()} disabled={regenerating}>
                {regenerating ? <LoaderCircle size={16} className="spin" /> : null}
                인게임 인증 코드 발급
              </button>
            </div>
          )}

          {user && user.verified && (
            <div className="card side-card">
              <p className="eyebrow">SIGNED IN</p>
              <h2 className="card-title">{user.nickname}</h2>
              <p className="side-text">인증이 완료된 계정입니다.</p>
              <button type="button" className="btn btn-ghost btn-block" onClick={() => navigate("/account")}>
                내 계정 보기
              </button>
            </div>
          )}

          {!user && !loading && (
            <div className="card side-card">
              <p className="eyebrow">JOIN US</p>
              <h2 className="card-title">커뮤니티에 합류하세요</h2>
              <p className="side-text">계정을 만들고 관리자 승인을 받으면 바로 대화할 수 있습니다.</p>
              <Link to="/signup" className="btn btn-gold btn-block">계정 만들기</Link>
            </div>
          )}

          <div className="card side-card chat-rules">
            <p className="eyebrow">RULES</p>
            <h2 className="card-title">채팅 규칙</h2>
            <ul>
              <li>서로 존중하는 대화를 나눠주세요.</li>
              <li>개인정보와 계정 정보를 공유하지 마세요.</li>
              <li>광고·도배는 관리자가 삭제할 수 있습니다.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
