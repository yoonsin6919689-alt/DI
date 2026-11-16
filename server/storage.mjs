// Portable object storage: local files plus HMAC-signed URLs, replacing the
// platform Storage client. Signed URLs are absolute and point back at this
// server, so the frontend's `new URL(uploadUrl, origin)` flow keeps working.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';

const DEFAULT_TTL_SECONDS = 300;

export function createStorage({ root, baseUrl, secret }) {
  const base = resolve(root);
  // baseUrl may be a string or a function returning the origin for the current
  // request, so signed URLs work behind any host or reverse proxy.
  const originFor = typeof baseUrl === 'function' ? baseUrl : () => baseUrl;

  function resolvePath(objectPath) {
    if (typeof objectPath !== 'string' || objectPath.length === 0) throw new Error('invalid_path');
    const normalized = normalize(objectPath);
    if (normalized.startsWith('..') || normalized.includes(`..${sep}`)) throw new Error('invalid_path');
    const full = resolve(base, normalized);
    if (full !== base && !full.startsWith(base + sep)) throw new Error('invalid_path');
    return full;
  }

  function sign(objectPath, expiresAt) {
    return createHmac('sha256', secret).update(`${objectPath}\n${expiresAt}`).digest('base64url');
  }

  function verify(objectPath, expiresAt, signature) {
    if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
    const expected = sign(objectPath, expiresAt);
    const given = String(signature ?? '');
    if (given.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  }

  function url(kind, objectPath, ttlSeconds = DEFAULT_TTL_SECONDS) {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const signature = sign(objectPath, expiresAt);
    const query = `expires=${expiresAt}&signature=${signature}`;
    const origin = (originFor() || '').replace(/\/+$/, '');
    return `${origin}/storage/${kind}/${objectPath}?${query}`;
  }

  return {
    verify,

    async createSignedUrl(objectPath, ttlSeconds = DEFAULT_TTL_SECONDS) {
      return { signedUrl: url('object', objectPath, ttlSeconds) };
    },

    async createSignedUploadUrl(objectPath) {
      return { signedUrl: url('upload', objectPath, DEFAULT_TTL_SECONDS) };
    },

    async download(objectPath) {
      const full = resolvePath(objectPath);
      let bytes;
      try {
        bytes = await readFile(full);
      } catch {
        throw new Error('not_found');
      }
      return new Response(bytes, { headers: { 'content-type': contentType(objectPath) } });
    },

    async remove(paths) {
      let removed = 0;
      for (const objectPath of paths) {
        try {
          await rm(resolvePath(objectPath));
          removed += 1;
        } catch {
          // Missing objects are already effectively removed.
        }
      }
      return { removed };
    },

    // Used by the upload endpoint after the signature is verified.
    async put(objectPath, bytes, type) {
      const full = resolvePath(objectPath);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, bytes);
      await writeFile(`${full}.type`, String(type || 'application/octet-stream'));
      return { objectPath };
    },

    async read(objectPath) {
      const full = resolvePath(objectPath);
      const [bytes, info] = await Promise.all([readFile(full), stat(full).catch(() => null)]);
      if (!info) throw new Error('not_found');
      let type = contentType(objectPath);
      try {
        type = (await readFile(`${full}.type`, 'utf8')).trim() || type;
      } catch {
        // Fall back to extension-based detection.
      }
      return { bytes, type };
    },
  };
}

function contentType(objectPath) {
  const extension = objectPath.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

export function storageRootFromEnv() {
  return process.env.STORAGE_DIR || join(process.cwd(), 'server', 'data', 'objects');
}
