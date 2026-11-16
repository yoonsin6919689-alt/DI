// Schema bootstrap and one-time migration of the content that is already
// published on the Qoder site, so the self-hosted deployment starts with the
// same notices, updates, chat history and settings.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export function applySchema(db) {
  db.exec(readFileSync(join(HERE, 'schema.sql'), 'utf8'));
}

async function tableCount(db, table) {
  const result = await db.from(table).select('*').limit(1);
  return result?.data?.length ?? 0;
}

function readLiveContent() {
  try {
    return JSON.parse(readFileSync(join(HERE, 'live-content.json'), 'utf8'));
  } catch {
    return null;
  }
}

export async function seedFromLiveContent(db) {
  const content = readLiveContent();
  if (!content) return;

  if (await tableCount(db, 'notices') === 0) {
    for (const notice of content.notices ?? []) {
      await db.from('notices').insert({
        id: notice.id,
        title: notice.title,
        body: notice.body,
        pinned: notice.pinned === true,
        deleted: false,
        created_at: notice.createdAt,
      });
    }
  }

  if (await tableCount(db, 'updates') === 0) {
    for (const update of content.updates ?? []) {
      await db.from('updates').insert({
        id: update.id,
        version: update.version,
        title: update.title,
        body: update.body,
        deleted: false,
        created_at: update.createdAt,
      });
    }
  }

  if (await tableCount(db, 'chat_messages') === 0) {
    for (const message of content.chat ?? []) {
      await db.from('chat_messages').insert({
        id: message.id,
        user_id: '00000000-0000-0000-0000-000000000000',
        nickname: message.nickname,
        body: message.body,
        deleted: false,
        created_at: message.createdAt,
      });
    }
  }

  if (await tableCount(db, 'server_config') === 0 && content.config) {
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(content.config)) {
      if (typeof value !== 'string') continue;
      await db.from('server_config').insert({ key, value, updated_at: now });
    }
  }

  if (await tableCount(db, 'server_status') === 0 && content.status) {
    await db.from('server_status').insert({
      id: 'main',
      online: content.status.online === true,
      players: Number(content.status.players) || 0,
      max_players: Number(content.status.maxPlayers) || 0,
      updated_at: content.status.updatedAt || new Date().toISOString(),
    });
  }
}
