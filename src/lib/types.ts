export type User = {
  id: string;
  username: string;
  nickname: string;
  role: "user" | "admin";
  verified: boolean;
  createdAt: string;
  email: string | null;
  emailConsent: boolean;
};

export type MemberStatus = "active" | "restricted" | "suspended";

export type AdminUser = User & {
  status: MemberStatus;
  sanctionUntil: string | null;
  sanctionReason: string;
};

export type Verification = {
  code: string;
  expiresAt: string;
};

export type ServerStatus = {
  online: boolean;
  players: number;
  maxPlayers: number;
  updatedAt: string | null;
  live: boolean;
};

export type SiteConfig = {
  server_name: string;
  tagline: string;
  java_host: string;
  java_port: string;
  bedrock_host: string;
  bedrock_port: string;
  status_text: string;
  status_note: string;
  discord_url: string;
  world_cards: string;
};

export type BoardKey = "free" | "photo";

export type BoardPost = {
  id: string;
  board: BoardKey;
  title: string;
  body: string;
  nickname: string;
  authorId: string;
  hasImage: boolean;
  createdAt: string;
};

export type AdminPost = BoardPost & { deleted: boolean };

export type Notice = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
};

export type UpdateEntry = {
  id: string;
  version: string;
  title: string;
  body: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  nickname: string;
  body: string;
  createdAt: string;
};

export type ChatMember = {
  nickname: string;
  role: "admin" | "member";
  self: boolean;
};

export type AdminMessage = ChatMessage & {
  userId: string;
  deleted: boolean;
};

export type AdminOverview = {
  users: number;
  admins: number;
  messages: number;
  notices: number;
  updates: number;
};

export type MailHistoryEntry = {
  id: string;
  subject: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
};

export type MailState = {
  configured: boolean;
  relayUrl: string;
  senderAddress: string;
  recipients: number;
  history: MailHistoryEntry[];
};

export type MailResult = {
  sent: number;
  failed: number;
  failures: { email: string; error: string }[];
  recipients: number;
  test?: boolean;
};
