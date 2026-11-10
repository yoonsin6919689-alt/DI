export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

const MESSAGES: Record<string, string> = {
  network_error: "서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.",
  invalid_response: "서버가 예상하지 못한 응답을 보냈습니다.",
  login_required: "로그인이 필요합니다.",
  invalid_credentials: "아이디 또는 비밀번호가 올바르지 않습니다.",
  username_taken: "이미 사용 중인 아이디입니다.",
  nickname_taken: "이미 사용 중인 닉네임입니다.",
  email_taken: "이미 다른 계정에서 사용 중인 이메일입니다.",
  invalid_email: "이메일 형식이 올바르지 않습니다.",
  mail_not_configured: "메일 발송이 아직 설정되지 않았습니다. 관리자에게 문의해 주세요.",
  mail_failed: "메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
  no_recipients: "메일을 받을 회원이 없습니다.",
  invalid_username: "아이디는 3~20자의 영문 소문자, 숫자, _, - 조합이어야 합니다.",
  invalid_password: "비밀번호는 8자 이상이어야 합니다.",
  invalid_nickname: "닉네임은 2~20자, 한글·영문·숫자·_·.·공백만 사용할 수 있습니다.",
  rate_limited: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  verification_required: "관리자 승인 또는 인증을 완료해야 이용할 수 있습니다.",
  already_verified: "이미 인증된 계정입니다.",
  invalid_code: "인증 코드가 올바르지 않거나 만료되었습니다.",
  forbidden: "이 작업을 수행할 권한이 없습니다.",
  cannot_change_own_role: "자신의 권한은 변경할 수 없습니다.",
  account_suspended: "정지된 계정입니다. 관리자에게 문의해 주세요.",
  account_restricted: "이용이 제한된 계정입니다. 관리자에게 문의해 주세요.",
  cannot_sanction_self: "자신에게는 제재를 적용할 수 없습니다.",
  cannot_sanction_admin: "관리자 계정은 제재할 수 없습니다. 먼저 권한을 해제해 주세요.",
  origin_forbidden: "요청 출처를 확인할 수 없습니다. 페이지를 새로고침해 주세요.",
  registration_unconfirmed: "가입 결과를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  logout_unconfirmed: "로그아웃을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  service_unavailable: "서비스가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요.",
  database_unavailable: "데이터베이스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  payload_too_large: "입력 내용이 너무 깁니다.",
  invalid_input: "입력 내용을 확인해 주세요.",
  method_not_allowed: "지원하지 않는 요청입니다.",
  bridge_not_configured: "인게임 연동이 아직 설정되지 않았습니다.",
  not_found: "요청한 내용을 찾을 수 없습니다.",
};

export function friendlyError(error: unknown, fallback = "요청을 처리하지 못했습니다."): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? error.message ?? fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`/functions/v1/app${path}`, {
      ...init,
      headers,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(MESSAGES.network_error, "network_error");
  }

  if (response.redirected || !response.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(MESSAGES.invalid_response, "invalid_response", response.status);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(MESSAGES.invalid_response, "invalid_response", response.status);
  }

  const body = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const code = typeof body?.error === "string" ? body.error : null;

  if (!response.ok || code) {
    const resolved = code ?? "request_failed";
    throw new ApiError(MESSAGES[resolved] ?? MESSAGES.invalid_response, resolved, response.status);
  }
  return data as T;
}
