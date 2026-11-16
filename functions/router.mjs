// All business routes. Application identity is derived exclusively from this
// app's own session table; the platform user context is never used.
import {
  AppError, CORS_HEADERS, applicationPath, errorJson, json, readEnv, readJson, requireTrustedOrigin, rows,
} from './http.mjs';
import {
  canonicalUsername, isUuid, validateChatBody, validateEmail, validateNickname, validatePassword,
  validateText, validateVersion,
} from './validate.mjs';
import {
  readMailSettings, saveMailSettings, sendBulk, sendMail,
} from './mail.mjs';
import { constantTimeStringEqual, hashPassword, verifyPassword, verifyPasswordAgainstDummy } from './passwords.mjs';
import {
  SESSION_REMEMBER_TTL_MS, SESSION_TTL_MS, clearSessionCookie, createSession, revokeSession, sessionCookie, sha256Hex, validateSession,
} from './sessions.mjs';
import { consume } from './limiter.mjs';

const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

class SessionRequired extends Error {
  constructor(state) {
    super('login_required');
    this.state = state;
  }
}

const retryAfter = (result) => ({ 'retry-after': String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))) });

function secureCookie(request) {
  const host = (request.headers.get('host') || '').toLowerCase();
  if (host.startsWith('127.0.0.1') || host.startsWith('localhost') || host.startsWith('[::1]')) return false;
  return true;
}

function unauthorized(state, request) {
  return state === 'invalid'
    ? errorJson('login_required', 401, { 'set-cookie': clearSessionCookie(secureCookie(request)) })
    : errorJson('login_required', 401);
}

async function requireSession(db, request) {
  const result = await validateSession(db, request);
  if (result.state !== 'valid') throw new SessionRequired(result.state);
  return result.session;
}

const USER_COLUMNS = 'id,username,nickname,role,verified_at,created_at,status,sanction_until,'
  + 'sanction_reason,email,email_consent';

async function loadUser(db, userId) {
  const found = rows(await db.from('users')
    .select(USER_COLUMNS)
    .eq('id', userId).limit(1));
  if (found.length !== 1 || typeof found[0]?.username !== 'string') throw new SessionRequired('invalid');
  return found[0];
}

async function requireAdmin(db, request) {
  const session = await requireSession(db, request);
  const user = await loadUser(db, session.userId);
  if (user.role !== 'admin') throw new AppError('forbidden', 403);
  return { session, user };
}

const publicUser = (row) => ({
  id: row.id,
  username: row.username,
  nickname: row.nickname,
  role: row.role,
  verified: Boolean(row.verified_at),
  createdAt: row.created_at,
});

// The email is only ever returned to its owner or to an admin.
const emailFields = (row) => ({
  email: typeof row.email === 'string' && row.email ? row.email : null,
  emailConsent: row.email_consent !== false,
});

const accountUser = (row) => ({ ...publicUser(row), ...emailFields(row) });

// A sanction whose end time has passed behaves like a normal account again.
function sanctionState(row, now = Date.now()) {
  const status = row.status === 'restricted' || row.status === 'suspended' ? row.status : 'active';
  const until = typeof row.sanction_until === 'string' ? row.sanction_until : null;
  const untilMs = until ? Date.parse(until) : Number.NaN;
  const expired = until !== null && Number.isFinite(untilMs) && untilMs <= now;
  if (status === 'active' || expired) return { status: 'active', until: null, reason: '' };
  return {
    status,
    until,
    reason: typeof row.sanction_reason === 'string' ? row.sanction_reason : '',
  };
}

const adminUser = (row) => {
  const state = sanctionState(row);
  return {
    ...publicUser(row),
    ...emailFields(row),
    status: state.status,
    sanctionUntil: state.until,
    sanctionReason: state.reason,
  };
};

function assertCanWrite(user) {
  const state = sanctionState(user);
  if (state.status !== 'active') throw new AppError('account_restricted', 403);
}

const SANCTION_DAYS = new Set([1, 7, 30]);

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newVerificationCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join('');
}

const CODE_TTL_MS = 30 * 60 * 1000;

async function currentVerification(db, userId) {
  const found = rows(await db.from('verify_codes')
    .select('code,expires_at,used_at').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(1));
  if (found.length !== 1 || found[0].used_at) return null;
  const expiresAt = Date.parse(found[0].expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return { code: found[0].code, expiresAt: found[0].expires_at };
}

async function issueVerification(db, userId) {
  const code = newVerificationCode();
  const now = Date.now();
  await db.from('verify_codes').insert({
    code,
    user_id: userId,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + CODE_TTL_MS).toISOString(),
    used_at: null,
  });
  return { code, expiresAt: new Date(now + CODE_TTL_MS).toISOString() };
}

// ---------------------------------------------------------------- auth

async function register(db, request) {
  const body = await readJson(request);
  const username = canonicalUsername(body?.username);
  const password = validatePassword(body?.password);
  const nickname = validateNickname(body?.nickname);
  const email = validateEmail(body?.email);
  const emailConsent = body?.emailConsent !== false;

  const limit = await consume(db, 'register', username);
  if (!limit.allowed) return errorJson('rate_limited', 429, retryAfter(limit));

  const existingUsers = rows(await db.from('users').select('id').limit(2));
  // The very first account owns the site. Owners register immediately after
  // publishing; later accounts are ordinary members awaiting approval.
  const isOwner = existingUsers.length === 0;
  const role = isOwner ? 'admin' : 'user';

  const takenName = rows(await db.from('users').select('id').eq('username', username).limit(1));
  if (takenName.length > 0) return errorJson('username_taken', 409);
  const nicknameKey = nickname.toLowerCase();
  const takenNickname = rows(await db.from('users').select('id').eq('nickname_key', nicknameKey).limit(1));
  if (takenNickname.length > 0) return errorJson('nickname_taken', 409);
  const takenEmail = rows(await db.from('users').select('id').eq('email', email).limit(1));
  if (takenEmail.length > 0) return errorJson('email_taken', 409);

  const derived = await hashPassword(password);
  const id = crypto.randomUUID();
  const created = rows(await db.from('users').insertIfAbsent({
    id,
    username,
    nickname,
    nickname_key: nicknameKey,
    password_salt: derived.salt,
    password_hash: derived.hash,
    password_iterations: derived.iterations,
    role,
    verified_at: isOwner ? new Date().toISOString() : null,
    email,
    email_consent: emailConsent,
    created_at: new Date().toISOString(),
  }, { onConflict: 'username' }).select(USER_COLUMNS));

  if (created.length !== 1) {
    const winner = rows(await db.from('users').select('username').eq('username', username).limit(1));
    if (winner.length === 1) return errorJson('username_taken', 409);
    const nick = rows(await db.from('users').select('nickname_key').eq('nickname_key', nicknameKey).limit(1));
    if (nick.length === 1) return errorJson('nickname_taken', 409);
    return errorJson('registration_unconfirmed', 503);
  }

  const verification = await issueVerification(db, id);
  const { token } = await createSession(db, id);
  return json(
    {
      user: accountUser(created[0]),
      verification,
    },
    201,
    { 'set-cookie': sessionCookie(token, SESSION_TTL_SECONDS, secureCookie(request)) },
  );
}

async function login(db, request) {
  const body = await readJson(request);
  const username = canonicalUsername(body?.username);
  const limit = await consume(db, 'login', username);
  if (!limit.allowed) return errorJson('rate_limited', 429, retryAfter(limit));

  if (typeof body?.password !== 'string' || body.password.length === 0) {
    throw new AppError('invalid_password', 400);
  }
  const password = body.password;
  if (new TextEncoder().encode(password).length > 200) throw new AppError('invalid_password', 400);

  const found = rows(await db.from('users')
    .select(`${USER_COLUMNS},password_salt,password_hash,password_iterations`)
    .eq('username', username).limit(1));

  if (found.length !== 1) {
    await verifyPasswordAgainstDummy(password);
    return errorJson('invalid_credentials', 401);
  }

  const user = found[0];
  const ok = await verifyPassword(password, {
    salt: user.password_salt, hash: user.password_hash, iterations: user.password_iterations,
  });
  if (!ok) return errorJson('invalid_credentials', 401);

  // Suspension blocks sign-in entirely; restriction only blocks writing.
  const state = sanctionState(user);
  if (state.status === 'suspended') {
    return json({ error: 'account_suspended', until: state.until, reason: state.reason }, 403);
  }

  const remember = body?.remember === true;
  const ttl = remember ? SESSION_REMEMBER_TTL_MS : SESSION_TTL_MS;
  const { token } = await createSession(db, user.id, Date.now(), ttl);
  const verification = user.verified_at
    ? null
    : (await currentVerification(db, user.id)) ?? await issueVerification(db, user.id);
  return json(
    { user: accountUser(user), verification },
    200,
    { 'set-cookie': sessionCookie(token, remember ? Math.floor(ttl / 1000) : null, secureCookie(request)) },
  );
}

async function editorLogin(db, request) {
  const body = await readJson(request);
  const username = canonicalUsername(body?.username);
  const limit = await consume(db, 'login', `editor:${username}`);
  if (!limit.allowed) {
    return errorJson('rate_limited', 429, { ...retryAfter(limit), ...CORS_HEADERS });
  }
  if (typeof body?.password !== 'string' || body.password.length === 0) {
    return errorJson('invalid_password', 400, CORS_HEADERS);
  }
  if (new TextEncoder().encode(body.password).length > 200) {
    return errorJson('invalid_password', 400, CORS_HEADERS);
  }

  const found = rows(await db.from('users')
    .select('id,username,nickname,role,verified_at,created_at,password_salt,password_hash,password_iterations')
    .eq('username', username).limit(1));
  if (found.length !== 1) {
    await verifyPasswordAgainstDummy(body.password);
    return errorJson('invalid_credentials', 401, CORS_HEADERS);
  }
  const user = found[0];
  const ok = await verifyPassword(body.password, {
    salt: user.password_salt, hash: user.password_hash, iterations: user.password_iterations,
  });
  if (!ok) return errorJson('invalid_credentials', 401, CORS_HEADERS);
  // The editor changes the public homepage, so only site admins may sign in.
  if (user.role !== 'admin') return errorJson('forbidden', 403, CORS_HEADERS);
  const { token } = await createSession(db, user.id);
  return json({ token, user: publicUser(user) }, 200, CORS_HEADERS);
}

async function logout(db, request) {
  const result = await validateSession(db, request);
  if (result.state === 'valid' && result.session) {
    try {
      await revokeSession(db, result.session.digest);
    } catch {
      return errorJson('logout_unconfirmed', 503);
    }
  }
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(secureCookie(request)) });
}

// ---------------------------------------------------------------- content

const toNotice = (row) => ({
  id: row.id, title: row.title, body: row.body, pinned: Boolean(row.pinned), createdAt: row.created_at,
});
const toUpdate = (row) => ({
  id: row.id, version: row.version, title: row.title, body: row.body, createdAt: row.created_at,
});
const toMessage = (row) => ({
  id: row.id, nickname: row.nickname, body: row.body, createdAt: row.created_at,
});

async function listNotices(db) {
  const found = rows(await db.from('notices').select('id,title,body,pinned,deleted,created_at')
    .eq('deleted', false).order('created_at', { ascending: false }).limit(40));
  return found
    .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 20)
    .map(toNotice);
}

async function listUpdates(db) {
  return rows(await db.from('updates').select('id,version,title,body,deleted,created_at')
    .eq('deleted', false).order('created_at', { ascending: false }).limit(30)).map(toUpdate);
}

async function listChat(db) {
  const found = rows(await db.from('chat_messages').select('id,nickname,body,deleted,created_at')
    .eq('deleted', false).order('created_at', { ascending: false }).limit(60));
  return found.reverse().map(toMessage);
}

// The chat page polls every few seconds, so the poll doubles as a presence
// heartbeat. Members are listed while their last heartbeat is fresh.
const PRESENCE_WINDOW_MS = 60 * 1000;
const PRESENCE_TOUCH_MS = 15 * 1000;
const MEMBER_PAGE = 500;

async function touchPresence(db, userId, now = Date.now()) {
  const found = rows(await db.from('chat_presence').select('user_id,last_seen')
    .eq('user_id', userId).limit(1));
  if (found.length === 1) {
    const seen = Date.parse(found[0].last_seen);
    if (Number.isFinite(seen) && now - seen < PRESENCE_TOUCH_MS) return;
    await db.from('chat_presence').update({ last_seen: new Date(now).toISOString() }).eq('user_id', userId);
    return;
  }
  await db.from('chat_presence').insert({ user_id: userId, last_seen: new Date(now).toISOString() });
}

async function presenceViewer(db, request) {
  try {
    const { state, session } = await validateSession(db, request);
    if (state !== 'valid') return null;
    const user = await loadUser(db, session.userId);
    // Presence is decorative; a failed heartbeat must never break the chat.
    try {
      await touchPresence(db, user.id);
    } catch {
      // Ignore.
    }
    return user;
  } catch {
    return null;
  }
}

async function listChatMembers(db, viewerId, now = Date.now()) {
  const seen = rows(await db.from('chat_presence').select('user_id,last_seen')
    .order('last_seen', { ascending: false }).limit(100));
  const cutoff = now - PRESENCE_WINDOW_MS;
  const active = new Set(seen
    .filter((row) => typeof row.last_seen === 'string' && Date.parse(row.last_seen) >= cutoff)
    .map((row) => row.user_id));
  if (active.size === 0) return [];
  const found = rows(await db.from('users').select(USER_COLUMNS).limit(MEMBER_PAGE));
  return found
    .filter((row) => active.has(row.id) && row.verified_at && sanctionState(row).status !== 'suspended')
    .map((row) => ({
      nickname: row.nickname,
      role: row.role === 'admin' ? 'admin' : 'member',
      self: row.id === viewerId,
    }))
    .sort((a, b) => (Number(b.role === 'admin') - Number(a.role === 'admin'))
      || a.nickname.localeCompare(b.nickname, 'ko'));
}

// ---------------------------------------------------------------- boards

const BOARDS = new Set(['free', 'photo']);
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const PHOTO_MAX_BYTES = 6 * 1024 * 1024;
const PHOTO_PATH = /^photos\/[0-9a-f]{32}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

const toPost = (row, full = false) => ({
  id: row.id,
  board: row.board,
  title: row.title,
  body: full || row.body.length <= 160 ? row.body : `${row.body.slice(0, 160)}…`,
  nickname: row.nickname,
  authorId: row.user_id,
  hasImage: Boolean(row.image_path),
  createdAt: row.created_at,
});

const EVENT_COLUMNS = 'id,title,content,thumbnail_path,deleted,created_at,updated_at';

const toEvent = (row) => ({
  id: row.id,
  title: row.title,
  thumbnailPath: row.thumbnail_path,
  blocks: JSON.parse(row.content),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function listEvents(db) {
  return rows(await db.from('events').select(EVENT_COLUMNS).eq('deleted', false)
    .order('created_at', { ascending: false }).limit(50)).map(toEvent);
}

async function loadEvent(db, id) {
  const found = rows(await db.from('events').select(EVENT_COLUMNS)
    .eq('id', id).eq('deleted', false).limit(1));
  if (found.length !== 1) throw new AppError('not_found', 404);
  return found[0];
}

async function saveEvent(db, storage, request, admin, id = null) {
  assertCanWrite(admin);
  const existing = id ? await loadEvent(db, id) : null;
  const body = await readJson(request, 48 * 1024);
  const title = validateText(body?.title, { max: 120 });
  const thumbnailPath = body?.thumbnailPath;
  if (typeof thumbnailPath !== 'string' || !PHOTO_PATH.test(thumbnailPath)) {
    throw new AppError('invalid_input', 400);
  }
  if (!Array.isArray(body?.blocks) || body.blocks.length < 1 || body.blocks.length > 24) {
    throw new AppError('invalid_input', 400);
  }
  let characters = 0;
  let images = 0;
  const blocks = body.blocks.map((block) => {
    if (block?.type === 'text') {
      const text = validateText(block.text, { max: 8000 });
      characters += [...text].length;
      return { type: 'text', text };
    }
    if (block?.type === 'image' && typeof block.imagePath === 'string' && PHOTO_PATH.test(block.imagePath)) {
      if (block.caption !== undefined && typeof block.caption !== 'string') throw new AppError('invalid_input', 400);
      const caption = (block.caption ?? '').trim();
      characters += [...caption].length;
      images += 1;
      return { type: 'image', imagePath: block.imagePath, caption };
    }
    throw new AppError('invalid_input', 400);
  });
  if (characters > 8000 || images > 8) throw new AppError('invalid_input', 400);
  const paths = new Set([thumbnailPath, ...blocks.filter((b) => b.type === 'image').map((b) => b.imagePath)]);
  const existingPaths = new Set(existing ? [existing.thumbnail_path,
    ...JSON.parse(existing.content).filter((b) => b.type === 'image').map((b) => b.imagePath)] : []);
  for (const path of paths) {
    // Any administrator may retain this event's images; new files must belong to the uploader.
    if (!existingPaths.has(path)) await verifyPhotoObject(requireStorage(storage), admin.id, path);
  }
  const values = { title, content: JSON.stringify(blocks), thumbnail_path: thumbnailPath, updated_at: new Date().toISOString() };
  if (existing) {
    const updated = rows(await db.from('events').update(values)
      .eq('id', id).eq('deleted', false).select(EVENT_COLUMNS));
    if (updated.length !== 1) throw new AppError('not_found', 404);
    return json({ event: toEvent(updated[0]) });
  }
  const event = { ...values, id: crypto.randomUUID(), deleted: false, created_at: values.updated_at };
  rows(await db.from('events').insert(event).select('id'));
  return json({ event: toEvent(event) }, 201);
}

async function eventImage(db, storage, id, index = null) {
  const event = await loadEvent(db, id);
  const block = index === null ? null : JSON.parse(event.content)[index];
  const path = index === null ? event.thumbnail_path : block?.type === 'image' ? block.imagePath : null;
  if (!path) throw new AppError('not_found', 404);
  try {
    const signed = await requireStorage(storage).createSignedUrl(path, 300);
    return new Response(null, { status: 302, headers: {
      location: signed.signedUrl, 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer',
    } });
  } catch {
    throw new AppError('storage_unavailable', 503);
  }
}

const photoDirectory = async (userId) => (await sha256Hex(userId)).slice(0, 32);

function requireStorage(storage) {
  if (!storage) throw new AppError('storage_unavailable', 503);
  return storage;
}

async function verifyPhotoObject(storage, userId, objectPath) {
  if (!PHOTO_PATH.test(objectPath)) throw new AppError('invalid_input', 400);
  if (!objectPath.startsWith(`photos/${await photoDirectory(userId)}/`)) {
    throw new AppError('invalid_input', 400);
  }
  let file;
  try {
    file = await storage.download(objectPath);
  } catch {
    throw new AppError('upload_unconfirmed', 503);
  }
  const type = (file.headers.get('content-type') || '').split(';')[0].trim();
  if (!PHOTO_TYPES[type]) throw new AppError('unsupported_media_type', 415);
  const reader = file.body?.getReader();
  if (!reader) throw new AppError('upload_unconfirmed', 503);
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > PHOTO_MAX_BYTES) {
        await reader.cancel();
        throw new AppError('payload_too_large', 413);
      }
    }
  } catch (error) {
    throw error instanceof AppError ? error : new AppError('upload_unconfirmed', 503);
  } finally {
    reader.releaseLock();
  }
  if (total === 0) throw new AppError('upload_unconfirmed', 503);
}

async function uploadPhotoIntent(db, storage, request) {
  const session = await requireSession(db, request);
  const user = await loadUser(db, session.userId);
  assertCanWrite(user);
  const limit = await consume(db, 'upload', user.id);
  if (!limit.allowed) return errorJson('rate_limited', 429, retryAfter(limit));
  const body = await readJson(request);
  const contentType = typeof body?.contentType === 'string' ? body.contentType : '';
  const size = body?.size;
  if (!PHOTO_TYPES[contentType]) return errorJson('unsupported_media_type', 415);
  if (!Number.isSafeInteger(size) || size < 1 || size > PHOTO_MAX_BYTES) {
    return errorJson('payload_too_large', 413);
  }
  const objectPath = `photos/${await photoDirectory(user.id)}/${crypto.randomUUID()}.${PHOTO_TYPES[contentType]}`;
  let signed;
  try {
    signed = await requireStorage(storage).createSignedUploadUrl(objectPath, { upsert: false });
  } catch {
    return errorJson('storage_unavailable', 503);
  }
  return json({ objectPath, uploadUrl: signed.signedUrl, maxBytes: PHOTO_MAX_BYTES }, 201);
}

async function createPost(db, storage, request) {
  const session = await requireSession(db, request);
  const user = await loadUser(db, session.userId);
  assertCanWrite(user);
  const limit = await consume(db, 'post', user.id);
  if (!limit.allowed) return errorJson('rate_limited', 429, retryAfter(limit));

  const body = await readJson(request);
  if (!BOARDS.has(body?.board)) return errorJson('invalid_input', 400);
  const board = body.board;
  const title = validateText(body?.title, { max: 80 });
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  if ([...text].length > 4000) return errorJson('invalid_input', 400);
  if (board === 'free' && !text) return errorJson('invalid_input', 400);

  const imagePath = typeof body?.imagePath === 'string' && body.imagePath ? body.imagePath : null;
  if (board === 'photo' && !imagePath) return errorJson('invalid_input', 400);
  if (board === 'free' && imagePath) return errorJson('invalid_input', 400);
  if (imagePath) await verifyPhotoObject(requireStorage(storage), user.id, imagePath);

  const post = {
    id: crypto.randomUUID(),
    board,
    user_id: user.id,
    nickname: user.nickname,
    title,
    body: text,
    image_path: imagePath,
    deleted: false,
    created_at: new Date().toISOString(),
  };
  await db.from('posts').insert(post);
  return json({ post: toPost(post, true) }, 201);
}

async function deletePost(db, storage, request, id, { asAdmin = false } = {}) {
  const session = await requireSession(db, request);
  const user = await loadUser(db, session.userId);
  const found = rows(await db.from('posts').select('id,user_id,image_path,deleted').eq('id', id).limit(1));
  if (found.length !== 1 || found[0].deleted) return errorJson('not_found', 404);
  if (!asAdmin && found[0].user_id !== user.id) return errorJson('forbidden', 403);
  const updated = rows(await db.from('posts').update({ deleted: true })
    .eq('id', id).eq('deleted', false).select('id'));
  if (updated.length !== 1) return errorJson('not_found', 404);
  if (found[0].image_path && storage) {
    try {
      await storage.remove([found[0].image_path]);
    } catch {
      // The row is already hidden; an orphaned object is cleaned up separately.
    }
  }
  return json({ ok: true });
}

async function postImage(db, storage, id) {
  const found = rows(await db.from('posts').select('image_path,deleted').eq('id', id).limit(1));
  if (found.length !== 1 || found[0].deleted || !found[0].image_path) {
    return errorJson('not_found', 404);
  }
  let signed;
  try {
    signed = await requireStorage(storage).createSignedUrl(found[0].image_path, 3600);
  } catch {
    return errorJson('storage_unavailable', 503);
  }
  return new Response(null, {
    status: 302,
    headers: {
      location: signed.signedUrl,
      'cache-control': 'private, max-age=300',
      'referrer-policy': 'no-referrer',
    },
  });
}

// Home page feature cards are editable content, stored as JSON so the admin
// page and the downloadable editor can change them without a redeploy.
export const WORLD_ICON_NAMES = [
  'Sparkles', 'Users', 'Zap', 'Anvil', 'Hammer', 'Fish', 'Compass', 'PawPrint',
  'Swords', 'Crown', 'Medal', 'Trophy', 'Gem', 'Flame', 'Leaf', 'Mountain',
  'Tent', 'Backpack', 'Shield', 'Star',
];

const DEFAULT_WORLD_CARDS = [
  { icon: 'Sparkles', title: '차원', text: '차원마다 다른 몬스터와 규칙. 새로운 균열이 열릴 때마다 전장이 바뀝니다.' },
  { icon: 'Users', title: '다양한 직업', text: '근접·원거리·마법·생활까지 취향에 맞는 직업을 고르세요.' },
  { icon: 'Zap', title: '스킬', text: '직업별 스킬을 익히고 조합해 나만의 전투 방식을 만듭니다.' },
  { icon: 'Anvil', title: '장비 강화', text: '장비를 단계별로 강화해 더 높은 전투력에 도전합니다.' },
  { icon: 'Hammer', title: '아이템 조합', text: '재료를 모아 무기와 방어구, 생활 아이템을 직접 조합합니다.' },
  { icon: 'Fish', title: '낚시도감', text: '물고기를 낚아 도감을 채우고 희귀 어종 수집에 도전합니다.' },
  { icon: 'Compass', title: '탈것 시스템', text: '탈것을 획득하고 성장시켜 더 넓은 차원을 누빕니다.' },
  { icon: 'PawPrint', title: '펫', text: '함께 싸우고 따라다니는 펫과 모험을 이어갑니다.' },
  { icon: 'Swords', title: '파티 플레이', text: '친구와 파티를 맺고 역할을 나눠 어려운 콘텐츠에 도전합니다.' },
  { icon: 'Crown', title: '월드 보스', text: '서버 전체가 힘을 모아 쓰러뜨리는 대형 목표.' },
  { icon: 'Medal', title: '칭호 · 업적', text: '모험을 기록하는 칭호와 업적으로 자신만의 흔적을 남깁니다.' },
  { icon: 'Trophy', title: '랭킹', text: '레벨과 전투력, 수집까지. 서버 최고 자리를 겨룹니다.' },
];

const CONFIG_DEFAULTS = {
  server_name: 'DIMENSION',
  tagline: '차원의 균열을 넘어, 모험이 시작된다.',
  java_host: '',
  java_port: '25565',
  bedrock_host: '',
  bedrock_port: '19132',
  status_text: '오픈 준비 중',
  status_note: '서버 주소와 오픈 일정은 공지사항에서 안내됩니다.',
  discord_url: '',
  world_cards: JSON.stringify(DEFAULT_WORLD_CARDS),
};
const CONFIG_KEYS = Object.keys(CONFIG_DEFAULTS);

// Connection addresses are never part of the public config: they are released
// only to signed-in, approved members so the server address stays off the
// public page and out of search engines.
const ADDRESS_KEYS = ['java_host', 'java_port', 'bedrock_host', 'bedrock_port'];

function publicConfig(config) {
  const values = { ...config };
  for (const key of ADDRESS_KEYS) values[key] = '';
  return values;
}

const STATUS_FRESH_MS = 120 * 1000;

function clampCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(Math.floor(number), 100000);
}

async function readServerStatus(db) {
  const found = rows(await db.from('server_status')
    .select('online,players,max_players,updated_at').eq('id', 'main').limit(1));
  if (found.length !== 1) {
    return { online: false, players: 0, maxPlayers: 0, updatedAt: null, live: false };
  }
  const row = found[0];
  const updated = Date.parse(row.updated_at);
  const live = Number.isFinite(updated) && Date.now() - updated <= STATUS_FRESH_MS;
  const online = Boolean(row.online) && live;
  return {
    online,
    players: online ? clampCount(row.players) : 0,
    maxPlayers: clampCount(row.max_players),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    live,
  };
}

async function writeServerStatus(db, online, players, maxPlayers, address = null) {
  const updatedAt = new Date().toISOString();
  const values = { online, players, max_players: maxPlayers, updated_at: updatedAt };
  if (address) {
    values.host = address.host;
    values.java_port = address.javaPort;
    values.bedrock_port = address.bedrockPort;
  }
  const existing = rows(await db.from('server_status').select('id').eq('id', 'main').limit(1));
  if (existing.length === 1) {
    await db.from('server_status').update(values).eq('id', 'main');
  } else {
    await db.from('server_status').insert({ id: 'main', ...values });
  }
  return updatedAt;
}

// The in-game plugin reports the machine's public host and ports so members see
// a working address without anyone typing it into the editor.
async function readAutoAddress(db) {
  const found = rows(await db.from('server_status')
    .select('host,java_port,bedrock_port').eq('id', 'main').limit(1));
  if (found.length !== 1) return null;
  const row = found[0];
  if (typeof row.host !== 'string' || !row.host.trim()) return null;
  return {
    host: row.host.trim(),
    javaPort: Number.isFinite(Number(row.java_port)) ? Number(row.java_port) : null,
    bedrockPort: Number.isFinite(Number(row.bedrock_port)) ? Number(row.bedrock_port) : null,
  };
}

function normalizeHost(raw) {
  if (typeof raw !== 'string') return '';
  const host = raw.trim().toLowerCase();
  if (host.length < 3 || host.length > 253) return '';
  return /^[a-z0-9.:-]+$/.test(host) ? host : '';
}

function normalizePort(raw) {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return port;
}

function normalizeWorldCards(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError('invalid_input', 400);
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 16) {
    throw new AppError('invalid_input', 400);
  }
  return JSON.stringify(parsed.map((card) => {
    if (!card || typeof card !== 'object') throw new AppError('invalid_input', 400);
    const title = typeof card.title === 'string' ? card.title.trim() : '';
    const text = typeof card.text === 'string' ? card.text.trim() : '';
    const icon = typeof card.icon === 'string' ? card.icon : '';
    if (!title || [...title].length > 24) throw new AppError('invalid_input', 400);
    if (!text || [...text].length > 90) throw new AppError('invalid_input', 400);
    if (!WORLD_ICON_NAMES.includes(icon)) throw new AppError('invalid_input', 400);
    return { title, text, icon };
  }));
}

async function readConfig(db) {
  const found = rows(await db.from('server_config').select('key,value').limit(60));
  const values = { ...CONFIG_DEFAULTS };
  for (const row of found) {
    if (CONFIG_KEYS.includes(row.key) && typeof row.value === 'string') values[row.key] = row.value;
  }
  return values;
}

// The plugin bridge key can come from the site Secret or, when the owner has
// never opened Site Settings, from an enrolled row that is never served publicly.
async function resolveBridgeKey(db) {
  const fromEnv = readEnv('INGAME_BRIDGE_SECRET');
  if (fromEnv) return fromEnv;
  const found = rows(await db.from('server_config').select('value').eq('key', 'bridge_key').limit(1));
  if (found.length !== 1 || typeof found[0].value !== 'string') return '';
  return found[0].value.trim();
}

async function writeSetting(db, key, value) {
  const existing = rows(await db.from('server_config').select('key').eq('key', key).limit(1));
  const updatedAt = new Date().toISOString();
  if (existing.length === 1) {
    rows(await db.from('server_config').update({ value, updated_at: updatedAt }).eq('key', key).select('key'));
    return;
  }
  await db.from('server_config').insert({ key, value, updated_at: updatedAt });
}

async function applySettings(db, body) {
  const values = body?.values;
  if (!values || typeof values !== 'object' || Array.isArray(values)) return null;
  const entries = Object.entries(values);
  if (entries.length === 0 || entries.length > CONFIG_KEYS.length) return null;

  const normalized = new Map();
  for (const [key, value] of entries) {
    if (!CONFIG_KEYS.includes(key)) throw new AppError('invalid_key', 400);
    if (typeof value !== 'string') return null;
    if (key === 'world_cards') {
      normalized.set(key, value.trim() === '' ? CONFIG_DEFAULTS.world_cards : normalizeWorldCards(value));
      continue;
    }
    if ([...value].length > 300) return null;
    if (key === 'discord_url' && value !== '' && !/^https:\/\//.test(value)) return null;
    if ((key === 'java_port' || key === 'bedrock_port') && value !== '' && !/^\d{1,5}$/.test(value)) return null;
    normalized.set(key, value.trim());
  }
  for (const [key, value] of normalized) await writeSetting(db, key, value);
  return readConfig(db);
}

// ---------------------------------------------------------------- route

async function route(db, storage, request) {
  const path = applicationPath(request);
  const method = request.method;

  if (path === '/api/health' && method === 'GET') return json({ ok: true });

  // Plugin bridge: server-to-server, authenticated by a shared secret and
  // therefore exempt from the browser Origin check.
  if (path.startsWith('/api/internal/')) {
    const expected = await resolveBridgeKey(db);
    if (!expected) return errorJson('bridge_not_configured', 503);
    if (!constantTimeStringEqual(request.headers.get('x-bridge-key') || '', expected)) {
      return errorJson('bridge_forbidden', 403);
    }
    if (path === '/api/internal/verify' && method === 'POST') {
      const body = await readJson(request);
      const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
      if (!/^[A-Z0-9]{6}$/.test(code)) return errorJson('invalid_code', 400);
      // The plugin sends the nickname of the character that ran /인증, so a
      // leaked code cannot verify an account from a different character.
      const player = typeof body?.nickname === 'string'
        ? body.nickname.trim().replace(/\s+/g, ' ').toLowerCase()
        : '';
      if (!player) return errorJson('invalid_nickname', 400);
      const found = rows(await db.from('verify_codes').select('code,user_id,expires_at,used_at')
        .eq('code', code).limit(1));
      if (found.length !== 1) return errorJson('invalid_code', 404);
      const row = found[0];
      const owner = rows(await db.from('users')
        .select('nickname,nickname_key,role').eq('id', row.user_id).limit(1));
      if (owner.length !== 1 || owner[0].nickname_key !== player) return errorJson('invalid_code', 404);
      const expiresAt = Date.parse(row.expires_at);
      if (row.used_at || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        return errorJson('invalid_code', 404);
      }
      // Concurrent plugin calls for the same code are harmless (same account,
      // same outcome), so the write does not depend on a NULL predicate.
      const claimed = rows(await db.from('verify_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('code', code).select('code'));
      if (claimed.length !== 1) return errorJson('invalid_code', 409);
      rows(await db.from('users').update({ verified_at: new Date().toISOString() })
        .eq('id', row.user_id).select('id'));
      return json({ ok: true, nickname: owner[0].nickname, role: owner[0].role });
    }
    if (path === '/api/internal/player' && method === 'GET') {
      const nickname = new URL(request.url).searchParams.get('nickname')?.trim().toLowerCase() ?? '';
      if (!nickname) return errorJson('invalid_input', 400);
      const found = rows(await db.from('users')
        .select('nickname,role,verified_at').eq('nickname_key', nickname).limit(1));
      if (found.length !== 1) return errorJson('not_found', 404);
      return json({
        nickname: found[0].nickname,
        role: found[0].role,
        verified: Boolean(found[0].verified_at),
      });
    }
    if (path === '/api/internal/status' && method === 'POST') {
      const body = await readJson(request);
      const online = body?.online !== false;
      const host = normalizeHost(body?.host);
      const address = host
        ? {
          host,
          javaPort: normalizePort(body?.javaPort),
          bedrockPort: normalizePort(body?.bedrockPort),
        }
        : null;
      const updatedAt = await writeServerStatus(
        db,
        online,
        clampCount(body?.players),
        clampCount(body?.maxPlayers),
        address,
      );
      return json({ ok: true, updatedAt });
    }
    return errorJson('not_found', 404);
  }

  requireTrustedOrigin(request);

  // ------------------------------------------------------------ editor
  // The downloadable editor runs from a local file, authenticates with a
  // bearer token and therefore needs permissive CORS on this path only.
  if (path.startsWith('/api/editor/')) {
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    try {
      if (path === '/api/editor/login' && method === 'POST') return await editorLogin(db, request);
      const { user } = await requireAdmin(db, request);
      if (path === '/api/editor/content' && method === 'GET') {
        return json({ config: await readConfig(db), editor: { nickname: user.nickname, username: user.username } }, 200, CORS_HEADERS);
      }
      if (path === '/api/editor/content' && method === 'PATCH') {
        const config = await applySettings(db, await readJson(request));
        if (!config) return errorJson('invalid_input', 400, CORS_HEADERS);
        return json({ config }, 200, CORS_HEADERS);
      }
      if (path === '/api/editor/logout' && method === 'POST') {
        const session = await requireSession(db, request);
        await revokeSession(db, session.digest);
        return json({ ok: true }, 200, CORS_HEADERS);
      }
      return errorJson('not_found', 404, CORS_HEADERS);
    } catch (error) {
      if (error instanceof SessionRequired) {
        return errorJson('login_required', 401, CORS_HEADERS);
      }
      if (error instanceof AppError) return errorJson(error.code, error.status, CORS_HEADERS);
      throw error;
    }
  }

  if (path === '/api/config' && method === 'GET') return json({ config: publicConfig(await readConfig(db)) });
  if (path === '/api/status' && method === 'GET') return json(await readServerStatus(db));
  if (path === '/api/notices' && method === 'GET') return json({ notices: await listNotices(db) });
  if (path === '/api/updates' && method === 'GET') return json({ updates: await listUpdates(db) });
  if (path === '/api/events' && method === 'GET') return json({ events: await listEvents(db) });
  const eventDetail = path.match(/^\/api\/events\/([0-9a-f-]{36})$/);
  if (eventDetail && isUuid(eventDetail[1]) && method === 'GET') {
    return json({ event: toEvent(await loadEvent(db, eventDetail[1])) });
  }
  const eventMedia = path.match(/^\/api\/events\/([0-9a-f-]{36})\/(thumbnail|images\/(\d{1,2}))$/);
  if (eventMedia && isUuid(eventMedia[1]) && method === 'GET') {
    return eventImage(db, storage, eventMedia[1], eventMedia[3] === undefined ? null : Number(eventMedia[3]));
  }
  if (path === '/api/chat' && method === 'GET') {
    const viewer = await presenceViewer(db, request);
    return json({
      messages: await listChat(db),
      members: await listChatMembers(db, viewer?.id ?? null),
    });
  }

  const noticeDetail = path.match(/^\/api\/notices\/([0-9a-f-]{36})$/);
  if (noticeDetail && isUuid(noticeDetail[1]) && method === 'GET') {
    const found = rows(await db.from('notices').select('id,title,body,pinned,deleted,created_at')
      .eq('id', noticeDetail[1]).eq('deleted', false).limit(1));
    if (found.length !== 1) return errorJson('not_found', 404);
    return json({ notice: toNotice(found[0]) });
  }

  if (path === '/api/register' && method === 'POST') return register(db, request);
  if (path === '/api/login' && method === 'POST') return login(db, request);
  if (path === '/api/logout' && method === 'POST') return logout(db, request);

  if (path === '/api/me' && method === 'GET') {
    const session = await requireSession(db, request);
    const user = await loadUser(db, session.userId);
    const verification = user.verified_at ? null : await currentVerification(db, user.id);
    return json({ user: accountUser(user), verification });
  }

  if (path === '/api/connect' && method === 'GET') {
    const session = await requireSession(db, request);
    const user = await loadUser(db, session.userId);
    if (!user.verified_at) return errorJson('verification_required', 403);
    const config = await readConfig(db);
    const auto = await readAutoAddress(db);
    return json({
      java: {
        host: config.java_host || auto?.host || '',
        port: config.java_port || (auto?.javaPort ? String(auto.javaPort) : ''),
      },
      bedrock: {
        host: config.bedrock_host || auto?.host || '',
        port: config.bedrock_port || (auto?.bedrockPort ? String(auto.bedrockPort) : ''),
      },
    });
  }

  if (path === '/api/verify/refresh' && method === 'POST') {
    const session = await requireSession(db, request);
    const user = await loadUser(db, session.userId);
    if (user.verified_at) return errorJson('already_verified', 400);
    const limit = await consume(db, 'verify', user.id);
    if (!limit.allowed) return errorJson('rate_limited', 429, retryAfter(limit));
    return json({ verification: await issueVerification(db, user.id) });
  }

  if (path === '/api/email/address' && method === 'POST') {
    const session = await requireSession(db, request);
    const user = await loadUser(db, session.userId);
    const body = await readJson(request);
    const email = validateEmail(body?.email);
    const limit = await consume(db, 'email', user.id);
    if (!limit.allowed) return errorJson('rate_limited', 429, retryAfter(limit));

    if (email !== user.email) {
      const taken = rows(await db.from('users').select('id').eq('email', email).limit(1));
      if (taken.length === 1 && taken[0].id !== user.id) return errorJson('email_taken', 409);
      await db.from('users').update({ email }).eq('id', user.id).select('id');
    }
    const updated = await loadUser(db, user.id);
    return json({ user: accountUser(updated) });
  }

  if (path === '/api/email/consent' && method === 'POST') {
    const session = await requireSession(db, request);
    const user = await loadUser(db, session.userId);
    const body = await readJson(request);
    if (typeof body?.consent !== 'boolean') return errorJson('invalid_input', 400);
    await db.from('users').update({ email_consent: body.consent }).eq('id', user.id).select('id');
    const updated = await loadUser(db, user.id);
    return json({ user: accountUser(updated) });
  }

  if (path === '/api/chat' && method === 'POST') {
    const session = await requireSession(db, request);
    const user = await loadUser(db, session.userId);
    assertCanWrite(user);
    if (!user.verified_at) return errorJson('verification_required', 403);
    const limit = await consume(db, 'chat', user.id);
    if (!limit.allowed) return errorJson('rate_limited', 429, retryAfter(limit));
    const body = await readJson(request);
    const text = validateChatBody(body?.body);
    const message = {
      id: crypto.randomUUID(),
      user_id: user.id,
      nickname: user.nickname,
      body: text,
      deleted: false,
      created_at: new Date().toISOString(),
    };
    await db.from('chat_messages').insert(message);
    return json({ message: toMessage(message) }, 201);
  }

  // ------------------------------------------------------------- boards

  if (path === '/api/posts' && method === 'GET') {
    const params = new URL(request.url).searchParams;
    const board = params.get('board') ?? 'free';
    if (!BOARDS.has(board)) return errorJson('invalid_input', 400);
    const requested = Number.parseInt(params.get('limit') ?? '30', 10);
    const limit = Number.isSafeInteger(requested) ? Math.min(Math.max(requested, 1), 50) : 30;
    const found = rows(await db.from('posts')
      .select('id,board,user_id,nickname,title,body,image_path,deleted,created_at')
      .eq('board', board).eq('deleted', false)
      .order('created_at', { ascending: false }).limit(limit));
    return json({ posts: found.map((row) => toPost(row)) });
  }

  if (path === '/api/posts' && method === 'POST') return createPost(db, storage, request);

  if (path === '/api/uploads/photo' && method === 'POST') {
    return uploadPhotoIntent(db, storage, request);
  }

  const postImageMatch = path.match(/^\/api\/posts\/([0-9a-f-]{36})\/image$/);
  if (postImageMatch && isUuid(postImageMatch[1]) && method === 'GET') {
    return postImage(db, storage, postImageMatch[1]);
  }

  const postDetail = path.match(/^\/api\/posts\/([0-9a-f-]{36})$/);
  if (postDetail && isUuid(postDetail[1]) && method === 'GET') {
    const found = rows(await db.from('posts')
      .select('id,board,user_id,nickname,title,body,image_path,deleted,created_at')
      .eq('id', postDetail[1]).eq('deleted', false).limit(1));
    if (found.length !== 1) return errorJson('not_found', 404);
    return json({ post: toPost(found[0], true) });
  }
  if (postDetail && isUuid(postDetail[1]) && method === 'DELETE') {
    return deletePost(db, storage, request, postDetail[1]);
  }

  // ------------------------------------------------------------ admin

  if (path.startsWith('/api/admin/')) {
    const { user: admin } = await requireAdmin(db, request);

    if (path === '/api/admin/overview' && method === 'GET') {
      const users = rows(await db.from('users').select('id,role').limit(1000));
      const messages = rows(await db.from('chat_messages').select('id,deleted').limit(1000));
      const notices = rows(await db.from('notices').select('id,deleted').limit(1000));
      const updates = rows(await db.from('updates').select('id,deleted').limit(1000));
      return json({
        users: users.length,
        admins: users.filter((row) => row.role === 'admin').length,
        messages: messages.filter((row) => !row.deleted).length,
        notices: notices.filter((row) => !row.deleted).length,
        updates: updates.filter((row) => !row.deleted).length,
      });
    }

    if (path === '/api/admin/users' && method === 'GET') {
      const found = rows(await db.from('users')
        .select(USER_COLUMNS)
        .order('created_at', { ascending: false }).limit(200));
      return json({ users: found.map(adminUser) });
    }

    const adminUserPath = path.match(/^\/api\/admin\/users\/([0-9a-f-]{36})$/);
    if (adminUserPath && isUuid(adminUserPath[1]) && method === 'PATCH') {
      const body = await readJson(request);
      const targetId = adminUserPath[1];
      const target = rows(await db.from('users').select('id,role').eq('id', targetId).limit(1));
      if (target.length !== 1) return errorJson('not_found', 404);

      const changes = {};
      let revokeSessions = false;
      if (typeof body?.verified === 'boolean') {
        changes.verified_at = body.verified ? new Date().toISOString() : null;
      }
      if (body?.role === 'user' || body?.role === 'admin') {
        if (targetId === admin.id) return errorJson('cannot_change_own_role', 400);
        changes.role = body.role;
      }
      if (body?.status === 'active' || body?.status === 'restricted' || body?.status === 'suspended') {
        if (targetId === admin.id) return errorJson('cannot_sanction_self', 400);
        if (target[0].role === 'admin') return errorJson('cannot_sanction_admin', 403);

        if (body.status === 'active') {
          changes.status = 'active';
          changes.sanction_until = null;
          changes.sanction_reason = '';
        } else {
          const days = body?.days === null ? null : body?.days;
          if (days !== null && !SANCTION_DAYS.has(days)) return errorJson('invalid_input', 400);
          const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
          if ([...reason].length > 200) return errorJson('invalid_input', 400);
          changes.status = body.status;
          changes.sanction_until = days === null
            ? null
            : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
          changes.sanction_reason = reason;
          revokeSessions = body.status === 'suspended';
        }
      }
      if (Object.keys(changes).length === 0) return errorJson('invalid_input', 400);

      const updated = rows(await db.from('users').update(changes).eq('id', targetId)
        .select(USER_COLUMNS));
      if (updated.length !== 1) return errorJson('not_found', 404);
      if (revokeSessions) {
        // A suspended account loses every existing session, not just new logins.
        await db.from('sessions').update({ revoked_at: new Date().toISOString() }).eq('user_id', targetId);
      }
      return json({ user: adminUser(updated[0]) });
    }

    if (path === '/api/admin/admins' && method === 'POST') {
      const body = await readJson(request);
      const username = canonicalUsername(body?.username);
      const found = rows(await db.from('users').select('id,role').eq('username', username).limit(1));
      if (found.length !== 1) return errorJson('not_found', 404);
      if (found[0].role === 'admin') return json({ ok: true, already: true });
      rows(await db.from('users').update({ role: 'admin' }).eq('id', found[0].id).select('id'));
      return json({ ok: true });
    }

    if (path === '/api/admin/mail' && method === 'GET') {
      const settings = await readMailSettings(db);
      const all = rows(await db.from('users').select('email,email_consent').limit(2000));
      const recipients = all.filter((row) => (
        typeof row.email === 'string' && row.email && row.email_consent !== false
      )).length;
      const history = rows(await db.from('mail_log')
        .select('id,subject,recipient_count,sent_count,failed_count,created_at')
        .order('created_at', { ascending: false }).limit(20));
      return json({
        configured: Boolean(settings),
        relayUrl: settings?.url ?? '',
        senderAddress: settings?.sender ?? '',
        recipients,
        history: history.map((row) => ({
          id: row.id,
          subject: row.subject,
          recipientCount: row.recipient_count,
          sentCount: row.sent_count,
          failedCount: row.failed_count,
          createdAt: row.created_at,
        })),
      });
    }

    if (path === '/api/admin/mail/settings' && method === 'PATCH') {
      const body = await readJson(request);
      const url = typeof body?.relayUrl === 'string' ? body.relayUrl.trim() : '';
      const https = /^https:\/\/[^\s]{8,480}$/.test(url);
      const local = /^http:\/\/127\.0\.0\.1:[0-9]{2,5}\/[^\s]*$/.test(url);
      if (!https && !local) return errorJson('invalid_input', 400);
      const token = typeof body?.relayToken === 'string' ? body.relayToken.trim() : '';
      if (token.length > 200) return errorJson('invalid_input', 400);
      const sender = typeof body?.senderAddress === 'string' ? body.senderAddress.trim() : '';
      if (sender && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(sender)) return errorJson('invalid_email', 400);
      const existing = await readMailSettings(db);
      if (!existing && !token) return errorJson('invalid_input', 400);
      await saveMailSettings(db, { url, token, sender });
      return json({ configured: true });
    }

    if (path === '/api/admin/mail' && method === 'POST') {
      const limit = await consume(db, 'mail', admin.id);
      if (!limit.allowed) return errorJson('rate_limited', 429, retryAfter(limit));
      const body = await readJson(request);
      const subject = validateText(body?.subject, { max: 120 });
      const text = validateText(body?.text, { max: 8000 });
      const testEmail = typeof body?.testEmail === 'string' && body.testEmail.trim()
        ? validateEmail(body.testEmail)
        : null;

      if (testEmail) {
        await sendMail(db, { to: testEmail, subject: `[테스트] ${subject}`, text });
        return json({ test: true, sent: 1, failed: 0, failures: [], recipients: 1 });
      }

      const all = rows(await db.from('users').select('email,email_consent').limit(2000));
      const recipients = [...new Set(all
        .filter((row) => typeof row.email === 'string' && row.email && row.email_consent !== false)
        .map((row) => row.email.toLowerCase()))];
      if (recipients.length === 0) return errorJson('no_recipients', 400);

      const fullText = `${text}\n\n— DIMENSION 운영팀\n수신 거부는 사이트 로그인 후 [내 계정]에서 변경할 수 있습니다.`;
      const result = await sendBulk(db, { recipients, subject, text: fullText });
      await db.from('mail_log').insert({
        id: crypto.randomUUID(),
        subject,
        body: text,
        recipient_count: recipients.length,
        sent_count: result.sent,
        failed_count: result.failed,
        created_by: admin.id,
        created_at: new Date().toISOString(),
      });
      return json({
        sent: result.sent,
        failed: result.failed,
        failures: result.failures,
        recipients: recipients.length,
      });
    }

    if (path === '/api/admin/events' && method === 'GET') {
      return json({ events: await listEvents(db) });
    }
    if (path === '/api/admin/events' && method === 'POST') {
      return saveEvent(db, storage, request, admin);
    }
    const adminEvent = path.match(/^\/api\/admin\/events\/([0-9a-f-]{36})$/);
    if (adminEvent && isUuid(adminEvent[1]) && method === 'PATCH') {
      return saveEvent(db, storage, request, admin, adminEvent[1]);
    }
    if (adminEvent && isUuid(adminEvent[1]) && method === 'DELETE') {
      assertCanWrite(admin);
      const updated = rows(await db.from('events').update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('id', adminEvent[1]).eq('deleted', false).select('id'));
      if (updated.length !== 1) throw new AppError('not_found', 404);
      return json({ ok: true });
    }

    if (path === '/api/admin/notices' && method === 'GET') {
      const found = rows(await db.from('notices').select('id,title,body,pinned,deleted,created_at')
        .eq('deleted', false).order('created_at', { ascending: false }).limit(50));
      return json({ notices: found.map(toNotice) });
    }

    if (path === '/api/admin/notices' && method === 'POST') {
      const body = await readJson(request);
      const notice = {
        id: crypto.randomUUID(),
        title: validateText(body?.title, { max: 120 }),
        body: validateText(body?.body, { max: 8000 }),
        pinned: body?.pinned === true,
        deleted: false,
        created_at: new Date().toISOString(),
      };
      await db.from('notices').insert(notice);
      return json({ notice: toNotice(notice) }, 201);
    }

    const adminNotice = path.match(/^\/api\/admin\/notices\/([0-9a-f-]{36})$/);
    if (adminNotice && isUuid(adminNotice[1]) && method === 'PATCH') {
      const body = await readJson(request);
      const changes = {};
      if (body?.title !== undefined) changes.title = validateText(body.title, { max: 120 });
      if (body?.body !== undefined) changes.body = validateText(body.body, { max: 8000 });
      if (typeof body?.pinned === 'boolean') changes.pinned = body.pinned;
      if (Object.keys(changes).length === 0) return errorJson('invalid_input', 400);
      const updated = rows(await db.from('notices').update(changes)
        .eq('id', adminNotice[1]).eq('deleted', false)
        .select('id,title,body,pinned,deleted,created_at'));
      if (updated.length !== 1) return errorJson('not_found', 404);
      return json({ notice: toNotice(updated[0]) });
    }
    if (adminNotice && isUuid(adminNotice[1]) && method === 'DELETE') {
      const updated = rows(await db.from('notices').update({ deleted: true })
        .eq('id', adminNotice[1]).eq('deleted', false).select('id'));
      if (updated.length !== 1) return errorJson('not_found', 404);
      return json({ ok: true });
    }

    if (path === '/api/admin/updates' && method === 'GET') {
      const found = rows(await db.from('updates').select('id,version,title,body,deleted,created_at')
        .eq('deleted', false).order('created_at', { ascending: false }).limit(50));
      return json({ updates: found.map(toUpdate) });
    }

    if (path === '/api/admin/updates' && method === 'POST') {
      const body = await readJson(request);
      const update = {
        id: crypto.randomUUID(),
        version: validateVersion(body?.version),
        title: validateText(body?.title, { max: 120 }),
        body: validateText(body?.body, { max: 8000 }),
        deleted: false,
        created_at: new Date().toISOString(),
      };
      await db.from('updates').insert(update);
      return json({ update: toUpdate(update) }, 201);
    }

    const adminUpdate = path.match(/^\/api\/admin\/updates\/([0-9a-f-]{36})$/);
    if (adminUpdate && isUuid(adminUpdate[1]) && method === 'PATCH') {
      const body = await readJson(request);
      const changes = {};
      if (body?.version !== undefined) changes.version = validateVersion(body.version);
      if (body?.title !== undefined) changes.title = validateText(body.title, { max: 120 });
      if (body?.body !== undefined) changes.body = validateText(body.body, { max: 8000 });
      if (Object.keys(changes).length === 0) return errorJson('invalid_input', 400);
      const updated = rows(await db.from('updates').update(changes)
        .eq('id', adminUpdate[1]).eq('deleted', false)
        .select('id,version,title,body,deleted,created_at'));
      if (updated.length !== 1) return errorJson('not_found', 404);
      return json({ update: toUpdate(updated[0]) });
    }
    if (adminUpdate && isUuid(adminUpdate[1]) && method === 'DELETE') {
      const updated = rows(await db.from('updates').update({ deleted: true })
        .eq('id', adminUpdate[1]).eq('deleted', false).select('id'));
      if (updated.length !== 1) return errorJson('not_found', 404);
      return json({ ok: true });
    }

    if (path === '/api/admin/settings' && method === 'GET') {
      return json({ config: await readConfig(db) });
    }

    if (path === '/api/admin/settings' && method === 'PATCH') {
      const config = await applySettings(db, await readJson(request));
      if (!config) return errorJson('invalid_input', 400);
      return json({ config });
    }

    if (path === '/api/admin/messages' && method === 'GET') {
      const found = rows(await db.from('chat_messages')
        .select('id,user_id,nickname,body,deleted,created_at')
        .order('created_at', { ascending: false }).limit(100));
      return json({
        messages: found.map((row) => ({
          id: row.id, userId: row.user_id, nickname: row.nickname, body: row.body,
          deleted: Boolean(row.deleted), createdAt: row.created_at,
        })),
      });
    }

    const adminMessage = path.match(/^\/api\/admin\/messages\/([0-9a-f-]{36})$/);
    if (adminMessage && isUuid(adminMessage[1]) && method === 'DELETE') {
      const updated = rows(await db.from('chat_messages').update({ deleted: true })
        .eq('id', adminMessage[1]).select('id'));
      if (updated.length !== 1) return errorJson('not_found', 404);
      return json({ ok: true });
    }

    if (path === '/api/admin/posts' && method === 'GET') {
      const board = new URL(request.url).searchParams.get('board');
      if (board !== null && !BOARDS.has(board)) return errorJson('invalid_input', 400);
      const base = db.from('posts')
        .select('id,board,user_id,nickname,title,body,image_path,deleted,created_at')
        .order('created_at', { ascending: false }).limit(100);
      const found = rows(await (board ? base.eq('board', board) : base));
      return json({
        posts: found.map((row) => ({ ...toPost(row), deleted: Boolean(row.deleted) })),
      });
    }

    const adminPost = path.match(/^\/api\/admin\/posts\/([0-9a-f-]{36})$/);
    if (adminPost && isUuid(adminPost[1]) && method === 'DELETE') {
      return deletePost(db, storage, request, adminPost[1], { asAdmin: true });
    }

    return errorJson('not_found', 404);
  }

  if ([
    '/api/register', '/api/login', '/api/logout', '/api/chat', '/api/verify/refresh', '/api/me',
    '/api/email/address', '/api/email/consent', '/api/connect',
  ].includes(path)) {
    return errorJson('method_not_allowed', 405);
  }
  return errorJson('not_found', 404);
}

export function createApplication({ db, storage }) {
  return async function handle(context) {
    const request = context.request;
    try {
      return await route(db, storage, request);
    } catch (error) {
      if (error instanceof SessionRequired) return unauthorized(error.state, request);
      if (error instanceof AppError) return errorJson(error.code, error.status);
      return errorJson('service_unavailable', 503);
    }
  };
}
