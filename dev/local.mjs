// Local-only fixtures. This directory is never part of the published artifact.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

class LocalError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const iso = (offsetMs = 0) => new Date(Date.now() - offsetMs).toISOString();
const DAY = 86_400_000;

function seed(tables) {
  tables.notices.push(
    {
      id: randomUUID(), pinned: true, deleted: false, created_at: iso(2 * 3600_000),
      title: '11월 10일 정기 점검 안내',
      body: '11월 10일 03:00부터 서버 점검이 진행됩니다.\n예상 점검 시간은 30분이며, 점검 중에는 접속이 종료됩니다.\n\n점검 이후 신규 차원 2종이 개방됩니다.',
    },
    {
      id: randomUUID(), pinned: false, deleted: false, created_at: iso(2 * DAY),
      title: '신규 차원 「잿빛 균열」 개방',
      body: '잿빛 균열 차원이 새로 열렸습니다.\n차원 전용 몬스터와 보스가 추가되었고, 신규 조합 재료가 드롭됩니다.',
    },
    {
      id: randomUUID(), pinned: false, deleted: false, created_at: iso(5 * DAY),
      title: '서버 이용 규칙 안내',
      body: '비매너 행위, 버그 악용, 비인가 프로그램 사용은 제재 대상입니다.\n신고는 디스코드 또는 인게임 문의로 접수해 주세요.',
    },
  );
  tables.updates.push(
    {
      id: randomUUID(), deleted: false, created_at: iso(6 * 3600_000), version: 'v1.8.0',
      title: '차원 업데이트 — 잿빛 균열',
      body: '[신규 콘텐츠]\n- 신규 차원 「잿빛 균열」 추가\n- 차원 전용 몬스터 12종 추가\n- 신규 월드 보스 「균열의 수문장」 추가\n\n[장비]\n- 신규 조합 장비 8종 추가\n- 강화 실패 시 하락 폭 완화',
    },
    {
      id: randomUUID(), deleted: false, created_at: iso(3 * DAY), version: 'v1.7.0',
      title: '군단 습격 리워크',
      body: '[개선]\n- 습격 웨이브 진행 속도 조정\n- 보상 상자 확률 공개\n- 파티 인원에 따른 난이도 보정 적용',
    },
    {
      id: randomUUID(), deleted: false, created_at: iso(8 * DAY), version: 'v1.6.0',
      title: '신규 직업 「총잡이」 추가',
      body: '[신규]\n- 원거리 딜러 직업 총잡이 추가\n- 전용 스킬 4종 및 각성 스킬 1종 추가\n- 총기 전용 강화 재료 추가',
    },
  );
  const chat = [
    ['차원의검', '오늘 잿빛 균열 열린 거 확인했어?'],
    ['루멘', 'ㅇㅇ 방금 들어가봤는데 몹이 확실히 셈'],
    ['차원의검', '보스는 잡아봤어?'],
    ['루멘', '아직. 파티 구하면 갈 생각'],
    ['밤의수문장', '나도 낄래 지금 접속함'],
    ['루멘', '좋아 셋이서 가자'],
    ['차원의검', '강화 재료 드롭되면 나눠 먹자'],
    ['밤의수문장', 'ㄱㄱ'],
  ];
  chat.forEach(([nickname, body], index) => {
    tables.chat_messages.push({
      id: randomUUID(),
      user_id: randomUUID(),
      nickname,
      body,
      deleted: false,
      created_at: iso((chat.length - index) * 7 * 60_000),
    });
  });
  tables.posts.push(
    {
      id: randomUUID(), board: 'free', user_id: randomUUID(), nickname: '차원의검',
      title: '잿빛 균열 보스 공략 정리', deleted: false, image_path: null, created_at: iso(40 * 60_000),
      body: '1페이즈는 수문장이 내려찍을 때 뒤로 빠지면 됩니다.\n2페이즈부터 나오는 쫄은 탱커가 먼저 붙어주세요.\n파티 구하면 같이 가요.',
    },
    {
      id: randomUUID(), board: 'free', user_id: randomUUID(), nickname: '루멘',
      title: '장비 강화 확률 체감 공유', deleted: false, image_path: null, created_at: iso(3 * 3600_000),
      body: '+7까지는 생각보다 잘 붙는데 +8부터 재료가 확실히 많이 듭니다.\n강화석 모으는 팁 있으면 알려주세요.',
    },
  );
}

function createMemoryDb() {
  const tables = {
    users: [], sessions: [], auth_limiter: [], verify_codes: [],
    notices: [], updates: [], chat_messages: [], server_config: [], posts: [],
    mail_log: [], mail_settings: [], server_status: [], chat_presence: [],
  };
  seed(tables);

  const db = {
    from(table) {
      if (!(table in tables)) throw new LocalError('invalid_table', 400);
      const filters = [];
      const order = [];
      let mode = 'read';
      let values;
      let conflict;
      let columns;
      let count = 1000;

      const query = {
        select(value) { columns = value; return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        order(key, options = {}) { order.push([key, options.ascending !== false]); return query; },
        limit(value) { count = value; return query; },
        insert(value) { mode = 'insert'; values = value; return query; },
        insertIfAbsent(value, options) {
          mode = 'insert';
          values = value;
          conflict = options.onConflict.split(',');
          return query;
        },
        update(value) { mode = 'update'; values = value; return query; },
        then(fulfilled, rejected) {
          return Promise.resolve().then(() => {
            let result;
            if (mode === 'insert') {
              const duplicate = conflict
                && tables[table].some((row) => conflict.every((key) => row[key] === values[key]));
              if (duplicate) {
                result = [];
              } else {
                const row = { ...values };
                tables[table].push(row);
                result = [row];
              }
            } else {
              result = tables[table].filter((row) => filters.every(([key, value]) => row[key] === value));
              if (mode === 'update') result.forEach((row) => Object.assign(row, values));
            }
            for (const [key, ascending] of [...order].reverse()) {
              result = [...result].sort((a, b) => {
                if (a[key] === b[key]) return 0;
                return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1);
              });
            }
            result = result.slice(0, count).map((row) => (
              columns ? Object.fromEntries(columns.split(',').map((key) => [key, row[key]])) : { ...row }
            ));
            return { data: result, error: null };
          }).then(fulfilled, rejected);
        },
      };
      return query;
    },
  };
  return { db, tables };
}

function createMemoryStorage() {
  const files = new Map();
  const base = 'http://127.0.0.1:8000/local-storage/';
  return {
    files,
    api: {
      async createSignedUploadUrl(objectPath) { return { signedUrl: base + objectPath }; },
      async createSignedUrl(objectPath) { return { signedUrl: base + objectPath }; },
      async download(objectPath) {
        const file = files.get(objectPath);
        if (!file) throw new Error('not_found');
        return new Response(file.bytes, { headers: { 'content-type': file.type } });
      },
      async remove(paths) {
        for (const path of paths) files.delete(path);
        return { removed: paths.length };
      },
    },
  };
}

const { db } = createMemoryDb();
const memoryStorage = createMemoryStorage();

async function start() {
  process.env.INGAME_BRIDGE_SECRET = process.env.INGAME_BRIDGE_SECRET || 'local-dev-bridge-secret';
  const { createApplication } = await import('../functions/router.mjs');
  const handle = createApplication({ db, storage: memoryStorage.api });

  const server = createServer(async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url, `http://${incoming.headers.host || '127.0.0.1:8000'}`);

      if (url.pathname.startsWith('/local-storage/')) {
        const cors = {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, PUT, OPTIONS',
          'access-control-allow-headers': 'content-type',
        };
        if (incoming.method === 'OPTIONS') {
          outgoing.writeHead(204, cors);
          outgoing.end();
          return;
        }
        const objectPath = decodeURIComponent(url.pathname.slice('/local-storage/'.length));
        if (!objectPath.startsWith('photos/')) {
          outgoing.writeHead(400, cors);
          outgoing.end();
          return;
        }
        if (incoming.method === 'PUT') {
          const chunks = [];
          let size = 0;
          for await (const chunk of incoming) {
            size += chunk.length;
            if (size > 6 * 1024 * 1024) {
              outgoing.writeHead(413, cors);
              outgoing.end();
              return;
            }
            chunks.push(chunk);
          }
          const type = (incoming.headers['content-type'] || 'application/octet-stream').split(';')[0];
          memoryStorage.files.set(objectPath, { bytes: Buffer.concat(chunks), type });
          outgoing.writeHead(200, { ...cors, 'content-type': 'application/json' });
          outgoing.end('{"ok":true}');
          return;
        }
        const file = memoryStorage.files.get(objectPath);
        if (!file) {
          outgoing.writeHead(404, cors);
          outgoing.end();
          return;
        }
        outgoing.writeHead(200, { ...cors, 'content-type': file.type, 'cache-control': 'no-store' });
        outgoing.end(file.bytes);
        return;
      }

      const chunks = [];
      let size = 0;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > 32 * 1024) throw new LocalError('payload_too_large', 413);
        chunks.push(chunk);
      }
      const hasBody = !['GET', 'HEAD'].includes(incoming.method);
      const request = new Request(url, {
        method: incoming.method,
        headers: incoming.headers,
        ...(hasBody ? { body: Buffer.concat(chunks) } : {}),
      });
      const response = await handle({ request });
      const headers = Object.fromEntries(response.headers);
      outgoing.writeHead(response.status, { ...headers, 'cache-control': 'no-store' });
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      const status = error instanceof LocalError ? error.status : 500;
      outgoing.writeHead(status, { 'content-type': 'application/json' });
      outgoing.end(JSON.stringify({ error: error instanceof LocalError ? error.code : 'local_failure' }));
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(8000, '127.0.0.1', resolve);
  });
  console.log('Local Function listening on http://127.0.0.1:8000 (memory database, fixtures reset on restart)');
  process.once('SIGINT', () => server.close(() => process.exit(0)));
  process.once('SIGTERM', () => server.close(() => process.exit(0)));
}

start();
