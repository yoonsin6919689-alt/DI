// Outbound mail is relayed over HTTPS: the edge runtime exposes fetch only, so
// SMTP is not available. The relay (a Google Apps Script web app) owns the
// Gmail credentials and is configured by an admin from the site itself.
import { AppError, rows } from './http.mjs';

const SETTINGS_ID = 'default';
const BATCH_SIZE = 25;
const RELAY_TIMEOUT_MS = 60_000;

export async function readMailSettings(db) {
  const found = rows(await db.from('mail_settings')
    .select('relay_url,relay_token,sender_address,updated_at').eq('id', SETTINGS_ID).limit(1));
  if (found.length !== 1) return null;
  const row = found[0];
  if (typeof row.relay_url !== 'string' || !row.relay_url) return null;
  if (typeof row.relay_token !== 'string' || !row.relay_token) return null;
  return {
    url: row.relay_url,
    token: row.relay_token,
    sender: typeof row.sender_address === 'string' ? row.sender_address : '',
  };
}

export async function saveMailSettings(db, { url, token, sender }) {
  const existing = rows(await db.from('mail_settings')
    .select('id,relay_token').eq('id', SETTINGS_ID).limit(1));
  const now = new Date().toISOString();
  if (existing.length === 0) {
    await db.from('mail_settings').insert({
      id: SETTINGS_ID,
      relay_url: url,
      relay_token: token,
      sender_address: sender,
      updated_at: now,
    });
    return;
  }
  const changes = { relay_url: url, sender_address: sender, updated_at: now };
  if (token) changes.relay_token = token;
  await db.from('mail_settings').update(changes).eq('id', SETTINGS_ID);
}

async function postRelay(settings, payload) {
  let response;
  try {
    response = await fetch(settings.url, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: settings.token, ...payload }),
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
    });
  } catch {
    throw new AppError('mail_failed', 502);
  }
  if (!response.ok) throw new AppError('mail_failed', 502);
  try {
    return await response.json();
  } catch {
    throw new AppError('mail_failed', 502);
  }
}

function failedSamples(data, limit = 5) {
  if (!Array.isArray(data?.failed)) return [];
  const samples = [];
  for (const item of data.failed) {
    if (samples.length >= limit) break;
    const email = typeof item?.email === 'string' ? item.email : '';
    if (!email) continue;
    const error = typeof item?.error === 'string' ? item.error.slice(0, 120) : 'failed';
    samples.push({ email, error });
  }
  return samples;
}

export async function sendMail(db, { to, subject, text }) {
  const settings = await readMailSettings(db);
  if (!settings) throw new AppError('mail_not_configured', 503);
  const data = await postRelay(settings, {
    subject, text, recipients: [to], sender: settings.sender,
  });
  const sent = Number.isSafeInteger(data?.sent) ? data.sent : (data?.ok ? 1 : 0);
  if (sent < 1) throw new AppError('mail_failed', 502);
  return { sent };
}

export async function sendBulk(db, { recipients, subject, text }) {
  const settings = await readMailSettings(db);
  if (!settings) throw new AppError('mail_not_configured', 503);

  let sent = 0;
  let failures = [];
  for (let offset = 0; offset < recipients.length; offset += BATCH_SIZE) {
    const chunk = recipients.slice(offset, offset + BATCH_SIZE);
    const data = await postRelay(settings, {
      subject, text, recipients: chunk, sender: settings.sender,
    });
    const chunkSent = Number.isSafeInteger(data?.sent)
      ? Math.max(0, Math.min(data.sent, chunk.length))
      : 0;
    sent += chunkSent;
    if (failures.length < 5) failures = failures.concat(failedSamples(data, 5 - failures.length));
  }
  return { sent, failed: Math.max(0, recipients.length - sent), failures };
}
