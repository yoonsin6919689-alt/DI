// Self-hosted entry point. Serves the built frontend from dist/ and mounts the
// existing business routes at /functions/v1/app so the frontend code is
// unchanged. Run with `node server/index.mjs`.
import { createServer } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { createDatabase } from './db.mjs';
import { createStorage, storageRootFromEnv } from './storage.mjs';
import { applySchema, seedFromLiveContent } from './seed.mjs';
import { currentOrigin, runWithOrigin } from './context.mjs';

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = resolve(process.cwd());
const DIST = resolve(process.env.DIST_DIR || join(ROOT, 'dist'));
const DB_PATH = process.env.DATABASE_FILE || join(ROOT, 'server', 'data', 'app.db');
const UPLOAD_LIMIT = 8 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.apk': 'application/vnd.android.package-archive',
  '.ipa': 'application/octet-stream',
};

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = createDatabase(DB_PATH);
applySchema(db);
await seedFromLiveContent(db);

const storageSecret = process.env.STORAGE_SECRET || randomSecret();
const storage = createStorage({
  root: storageRootFromEnv(),
  baseUrl: () => process.env.PUBLIC_ORIGIN || currentOrigin(),
  secret: storageSecret,
});

function randomSecret() {
  const value = createHmac('sha256', String(Date.now())).update(randomUUID()).digest('base64url');
  console.warn('[server] STORAGE_SECRET is not set; signed URLs will reset on restart.');
  return value;
}

const { createApplication } = await import('../functions/router.mjs');
const handle = createApplication({ db, storage });

function requestOrigin(request) {
  const host = request.headers.host || `127.0.0.1:${PORT}`;
  const forwarded = request.headers['x-forwarded-proto'];
  const secure = forwarded ? forwarded.split(',')[0].trim() === 'https' : false;
  return { host, protocol: secure ? 'https' : 'http' };
}

async function readBody(stream, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('payload_too_large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function serveStatic(pathname, response, method) {
  let relative = decodeURIComponent(pathname).replace(/^\/+/, '');
  let full = resolve(DIST, normalize(relative || 'index.html'));
  if (full !== DIST && !full.startsWith(DIST + sep)) {
    response.writeHead(403).end('forbidden');
    return true;
  }
  let info = await stat(full).catch(() => null);
  if (info?.isDirectory()) {
    full = join(full, 'index.html');
    info = await stat(full).catch(() => null);
  }
  // Single-page app: unknown extensionless paths render the shell.
  if (!info && !extname(relative)) {
    full = join(DIST, 'index.html');
    info = await stat(full).catch(() => null);
  }
  if (!info) return false;

  const headers = { 'content-type': MIME[extname(full).toLowerCase()] || 'application/octet-stream' };
  headers['cache-control'] = relative.startsWith('assets/')
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';
  response.writeHead(200, headers);
  if (method === 'HEAD') response.end();
  else response.end(await readFile(full));
  return true;
}

async function handleStorage(request, response, url, method) {
  const match = url.pathname.match(/^\/storage\/(object|upload)\/(.+)$/);
  if (!match) return false;
  const kind = match[1];
  const objectPath = decodeURIComponent(match[2]);
  const expires = Number(url.searchParams.get('expires'));
  const signature = url.searchParams.get('signature') || '';

  if (!storage.verify(objectPath, expires, signature)) {
    response.writeHead(403, { 'content-type': 'application/json' }).end('{"error":"signature_invalid"}');
    return true;
  }

  if (kind === 'upload') {
    if (method !== 'PUT') {
      response.writeHead(405).end('method_not_allowed');
      return true;
    }
    try {
      const bytes = await readBody(request, UPLOAD_LIMIT);
      if (bytes.length === 0) throw new Error('empty');
      await storage.put(objectPath, bytes, request.headers['content-type']);
      response.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
    } catch (error) {
      response.writeHead(error.status || 400).end(JSON.stringify({ error: error.message }));
    }
    return true;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    response.writeHead(405).end('method_not_allowed');
    return true;
  }
  try {
    const file = await storage.read(objectPath);
    response.writeHead(200, { 'content-type': file.type, 'cache-control': 'private, max-age=300' });
    if (method === 'HEAD') response.end();
    else response.end(file.bytes);
  } catch {
    response.writeHead(404).end('not_found');
  }
  return true;
}

const server = createServer(async (request, response) => {
  try {
    const { host, protocol } = requestOrigin(request);
    const url = new URL(request.url, `${protocol}://${host}`);

    if (url.pathname.startsWith('/storage/')) {
      if (await handleStorage(request, response, url, request.method)) return;
    }

    if (url.pathname === '/functions/v1/app' || url.pathname.startsWith('/functions/v1/app/')) {
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      const hasBody = !['GET', 'HEAD'].includes(request.method);
      const body = hasBody ? await readBody(request, UPLOAD_LIMIT) : undefined;
      const apiRequest = new Request(url, { method: request.method, headers, body });
      const apiResponse = await runWithOrigin(`${protocol}://${host}`, () => handle({ request: apiRequest }));
      const outgoing = {};
      for (const [key, value] of apiResponse.headers) outgoing[key] = value;
      response.writeHead(apiResponse.status, outgoing);
      response.end(Buffer.from(await apiResponse.arrayBuffer()));
      return;
    }

    if (await serveStatic(url.pathname, response, request.method)) return;
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
  } catch (error) {
    console.error('[server] request failed:', error);
    response.writeHead(error?.status || 500, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'service_unavailable' }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`DIMENSION server listening on http://${HOST}:${PORT} (dist: ${DIST})`);
});
