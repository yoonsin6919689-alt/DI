// HTTP helpers shared by every business route.
// Application identity comes only from this app's own session row; platform
// identity (ctx.user) is deliberately never consulted.

export const BODY_LIMIT_BYTES = 16384;

export class AppError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

// Runs in Deno in production and under Node for local fixtures.
export function readEnv(name) {
  const deno = globalThis.Deno?.env?.get?.(name);
  if (deno) return deno;
  return globalThis.process?.env?.[name] ?? undefined;
}

const NO_STORE = {
  'cache-control': 'private, no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};

export function json(value, status = 200, extra = {}) {
  return Response.json(value, { status, headers: { ...NO_STORE, ...extra } });
}

export function errorJson(code, status, extra = {}) {
  return json({ error: code }, status, extra);
}

// The gateway rewrites the logical `app` segment to the deployed physical name
// and the provider may strip /functions/v1 before invoking the handler.
export function applicationPath(request) {
  const match = new URL(request.url).pathname.match(/^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/);
  if (!match) throw new AppError('not_found', 404);
  return match[1] || '/';
}

// Second CSRF layer behind the gateway's same-origin enforcement. The gateway
// rewrites Host/URL for the sandboxed function, so the browser's Origin can
// only be matched against forwarded host headers or the platform domain.
export function requireTrustedOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  // Bearer tokens are never attached automatically by a browser, and the
  // standalone editor runs from a file:// origin.
  if (/^Bearer [A-Za-z0-9_-]{43}$/.test(request.headers.get('authorization') || '')) return;
  const url = new URL(request.url);
  if (url.pathname.includes('/api/editor/')) return;
  const origin = request.headers.get('origin');
  // SameSite=Lax already keeps the session cookie off cross-site POSTs, so a
  // missing Origin (proxy stripped, non-browser client) is not a CSRF signal.
  if (!origin || origin === 'null') return;

  let originHost;
  try {
    originHost = new URL(origin).hostname.toLowerCase();
  } catch {
    throw new AppError('origin_forbidden', 403);
  }

  const hosts = new Set();
  const remember = (value) => {
    if (!value) return;
    for (const part of value.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      try {
        hosts.add(new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname.toLowerCase());
      } catch {
        // Ignore malformed forwarding headers.
      }
    }
  };
  remember(url.hostname);
  remember(request.headers.get('host'));
  remember(request.headers.get('x-forwarded-host'));
  remember(request.headers.get('x-original-host'));
  const configured = readEnv('APP_ORIGIN');
  if (configured) remember(configured);

  if (hosts.has(originHost)) return;
  // Published sites live on the platform domain; the gateway has already
  // authenticated the visitor before the request reaches the function.
  if (originHost === 'qoder.website' || originHost.endsWith('.qoder.website')) return;
  console.log('origin_forbidden', JSON.stringify({ origin, hosts: [...hosts], url: request.url }));
  throw new AppError('origin_forbidden', 403);
}

// Editor endpoints authenticate with a bearer token, so a wildcard origin is
// safe there: no cookies or ambient credentials are accepted on that path.
export const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept',
  'access-control-max-age': '600',
};

export async function readJson(request, maxBytes = BODY_LIMIT_BYTES) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    throw new AppError('invalid_input', 400);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('invalid_input', 400);
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AppError('payload_too_large', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new AppError('invalid_input', 400);
  }
}

// Normalise data-layer results into business results without leaking provider
// error details to the browser.
export function rows(result) {
  if (result?.error || !Array.isArray(result?.data)) throw new AppError('database_unavailable', 503);
  return result.data;
}
