// Local API smoke test for boards, uploads and the editor. Never published.
const BASE = 'http://127.0.0.1:8000';
const H = { origin: 'http://127.0.0.1:8000' };

async function call(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const response = await fetch(BASE + '/functions/v1/app' + path, {
    method,
    headers: {
      ...H,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, headers: response.headers };
}

const results = [];
const check = (label, ok, extra = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`);
};

const stamp = Date.now();
const username = `tester${String(stamp).slice(-6)}`;
const nickname = '테스터';
const password = 'dimension2026';

const reg = await call('/api/register', { method: 'POST', body: { username, password, nickname } });
check('register first account', reg.status === 201, `${reg.status} ${JSON.stringify(reg.data).slice(0, 120)}`);
const cookie = (reg.headers.get('set-cookie') || '').split(';')[0];

const free = await call('/api/posts', {
  method: 'POST',
  cookie,
  body: { board: 'free', title: '로컬 자유글', body: '자유게시판 본문입니다.' },
});
check('create free post', free.status === 201, `${free.status} ${JSON.stringify(free.data).slice(0, 140)}`);

const emptyList = await call('/api/posts?board=free');
check('list free posts', emptyList.status === 200 && Array.isArray(emptyList.data.posts), `${emptyList.data.posts?.length} posts`);

const intent = await call('/api/uploads/photo', {
  method: 'POST',
  cookie,
  body: { contentType: 'image/png', size: 68 },
});
check('photo upload intent', intent.status === 201, `${intent.status} ${JSON.stringify(intent.data).slice(0, 140)}`);

if (intent.status === 201) {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const put = await fetch(intent.data.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: png,
  });
  check('signed upload PUT', put.status === 200, String(put.status));

  const photo = await call('/api/posts', {
    method: 'POST',
    cookie,
    body: { board: 'photo', title: '로컬 사진글', body: '사진 설명', imagePath: intent.data.objectPath },
  });
  check('create photo post', photo.status === 201, `${photo.status} ${JSON.stringify(photo.data).slice(0, 160)}`);

  if (photo.status === 201) {
    const img = await fetch(`${BASE}/functions/v1/app/api/posts/${photo.data.post.id}/image`, { redirect: 'manual', headers: H });
    check('photo image redirect', img.status === 302, `${img.status} -> ${img.headers.get('location')}`);
  }
}

const foreign = await call('/api/posts', {
  method: 'POST',
  cookie,
  body: { board: 'photo', title: '사진 없음' },
});
check('photo post requires image', foreign.status === 400, String(foreign.status));

const detail = await call(`/api/posts/${free.data.post.id}`);
check('post detail', detail.status === 200 && detail.data.post.title === '로컬 자유글');

const editorLogin = await call('/api/editor/login', { method: 'POST', body: { username, password } });
check('editor login', editorLogin.status === 200 && typeof editorLogin.data.token === 'string', String(editorLogin.status));

if (editorLogin.status === 200) {
  const bearer = { authorization: `Bearer ${editorLogin.data.token}` };
  const content = await call('/api/editor/content', { headers: bearer });
  check('editor read content', content.status === 200 && Boolean(content.data.config.world_cards), String(content.status));
  check('editor CORS header', content.headers.get('access-control-allow-origin') === '*');

  const cards = JSON.parse(content.data.config.world_cards);
  cards[0].title = '수정된 차원';
  const save = await call('/api/editor/content', {
    method: 'PATCH',
    headers: { ...bearer, origin: 'null' },
    body: { values: { world_cards: JSON.stringify(cards) } },
  });
  check('editor save world cards', save.status === 200 && JSON.parse(save.data.config.world_cards)[0].title === '수정된 차원', `${save.status}`);

  const publicConfig = await call('/api/config');
  check('public config reflects edit', JSON.parse(publicConfig.data.config.world_cards)[0].title === '수정된 차원');

  const badCards = await call('/api/editor/content', {
    method: 'PATCH',
    headers: bearer,
    body: { values: { world_cards: JSON.stringify([{ icon: 'Nope', title: 'x', text: 'y' }]) } },
  });
  check('editor rejects bad icon', badCards.status === 400, String(badCards.status));
}

const second = await call('/api/register', {
  method: 'POST',
  body: { username: `member${String(stamp).slice(-6)}`, password, nickname: '멤버' },
});
check('register second account', second.status === 201, String(second.status));

const promote = await call('/api/admin/admins', {
  method: 'POST',
  cookie,
  body: { username: `member${String(stamp).slice(-6)}` },
});
check('promote admin by username', promote.status === 200 && promote.data.ok === true, `${promote.status} ${JSON.stringify(promote.data)}`);

const editorDenied = await call('/api/editor/login', {
  method: 'POST',
  body: { username: `member${String(stamp).slice(-6)}`, password },
});
check('editor login still admin-only (now promoted)', editorDenied.status === 200, String(editorDenied.status));

console.log(results.join('\n'));
