// Pure input normalisation. No database access happens here.
import { AppError } from './http.mjs';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 200;

export function canonicalUsername(raw) {
  if (typeof raw !== 'string') throw new AppError('invalid_username', 400);
  const canonical = raw.trim().toLowerCase();
  if (canonical.length < USERNAME_MIN || canonical.length > USERNAME_MAX) {
    throw new AppError('invalid_username', 400);
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(canonical)) throw new AppError('invalid_username', 400);
  return canonical;
}

export function validatePassword(raw) {
  if (typeof raw !== 'string') throw new AppError('invalid_password', 400);
  if ([...raw].length < PASSWORD_MIN) throw new AppError('invalid_password', 400);
  if (new TextEncoder().encode(raw).length > PASSWORD_MAX_BYTES) throw new AppError('invalid_password', 400);
  return raw;
}

// Minecraft Java names are 3-16 word characters, Bedrock gamertags may contain
// spaces and dots. Korean nicknames are allowed for a private server.
export function validateNickname(raw) {
  if (typeof raw !== 'string') throw new AppError('invalid_nickname', 400);
  const nickname = raw.trim().replace(/\s+/g, ' ');
  if (nickname.length < 2 || nickname.length > 20) throw new AppError('invalid_nickname', 400);
  if (!/^[A-Za-z0-9_.가-힣 ]+$/.test(nickname)) throw new AppError('invalid_nickname', 400);
  return nickname;
}

export function validateEmail(raw) {
  if (typeof raw !== 'string') throw new AppError('invalid_email', 400);
  const email = raw.trim().toLowerCase();
  if (email.length < 5 || email.length > 254) throw new AppError('invalid_email', 400);
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) throw new AppError('invalid_email', 400);
  return email;
}

export function validateText(raw, { max, code = 'invalid_input' }) {
  if (typeof raw !== 'string') throw new AppError(code, 400);
  const value = raw.trim();
  if (!value || [...value].length > max) throw new AppError(code, 400);
  return value;
}

export function validateChatBody(raw) {
  if (typeof raw !== 'string') throw new AppError('invalid_input', 400);
  const body = raw.trim();
  if (!body || [...body].length > 200) throw new AppError('invalid_input', 400);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(body)) throw new AppError('invalid_input', 400);
  return body;
}

export function validateVersion(raw) {
  if (typeof raw !== 'string') throw new AppError('invalid_input', 400);
  const version = raw.trim();
  if (!/^[A-Za-z0-9._-]{1,20}$/.test(version)) throw new AppError('invalid_input', 400);
  return version;
}

export function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}
