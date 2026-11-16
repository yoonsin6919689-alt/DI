import assert from 'node:assert/strict';

const base = `http://127.0.0.1:${process.env.LOCAL_API_PORT || 8000}`;
const password = 'local-event-test-2026';
const stamp = Date.now().toString().slice(-8);
let checks = 0;
async function call(path, { method = 'GET', body, cookie, token } = {}) {
  const response = await fetch(base + '/functions/v1/app' + path, {
    method, redirect: 'manual',
    headers: { origin: base, ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, data: text ? JSON.parse(text) : null };
}
function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name);
  checks++;
  console.log(`PASS ${name}`);
}
async function account(prefix) {
  const username = prefix + stamp;
  const result = await call('/api/register', { method: 'POST', body: { username, password, nickname: prefix + stamp.slice(-4), email: `${username}@example.test`, emailConsent: false } });
  check(`register ${prefix}`, result.status, 201);
  return { username, cookie: result.headers.get('set-cookie').split(';')[0] };
}
async function upload(cookie) {
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const intent = await call('/api/uploads/photo', { method: 'POST', cookie, body: { contentType: 'image/png', size: bytes.length } });
  check('upload intent', intent.status, 201);
  const put = await fetch(intent.data.uploadUrl, { method: 'PUT', headers: { 'content-type': 'image/png' }, body: bytes });
  check('upload bytes', put.status, 200);
  return intent.data.objectPath;
}

check('initial events empty', (await call('/api/events')).data.events.length, 0);
const admin = await account('evtadmin');
const member = await account('evtmember');
check('anonymous admin list denied', (await call('/api/admin/events')).status, 401);
check('member admin list denied', (await call('/api/admin/events', member)).status, 403);
const thumbnailPath = await upload(admin.cookie);
const imagePath = await upload(admin.cookie);
const body = { title: '로컬 테스트 이벤트', thumbnailPath, blocks: [
  { type: 'text', text: '첫 번째 안내\n두 번째 줄' },
  { type: 'image', imagePath, caption: '본문 이미지' },
  { type: 'text', text: '<script>alert(1)</script>도 일반 텍스트입니다.' },
] };
check('anonymous create denied', (await call('/api/admin/events', { method: 'POST', body })).status, 401);
check('member create denied', (await call('/api/admin/events', { method: 'POST', body, ...member })).status, 403);
const created = await call('/api/admin/events', { method: 'POST', body, ...admin });
check('admin create', created.status, 201);
const event = created.data.event;
check('ordered blocks preserved', event.blocks, body.blocks);
check('thumbnail separate', event.thumbnailPath !== event.blocks[1].imagePath, true);
check('public list', (await call('/api/events')).data.events[0].id, event.id);
check('public detail', (await call(`/api/events/${event.id}`)).data.event.title, body.title);
for (const suffix of ['thumbnail', 'images/1']) check(`media ${suffix}`, (await call(`/api/events/${event.id}/${suffix}`)).status, 302);
for (const suffix of ['images/0', 'images/23']) check(`invalid media ${suffix}`, (await call(`/api/events/${event.id}/${suffix}`)).status, 404);
for (const [name, changes] of [
  ['thumbnail required', { thumbnailPath: '' }],
  ['body required', { blocks: [] }],
  ['text nonempty', { blocks: [{ type: 'text', text: ' ' }] }],
  ['text bounded', { blocks: [{ type: 'text', text: '가'.repeat(8001) }] }],
  ['block count bounded', { blocks: Array.from({ length: 25 }, () => ({ type: 'text', text: 'a' })) }],
  ['images bounded', { blocks: Array.from({ length: 9 }, () => ({ type: 'image', imagePath, caption: '' })) }],
  ['unknown block rejected', { blocks: [{ type: 'html', html: '<b>x</b>' }] }],
]) check(name, (await call('/api/admin/events', { method: 'POST', ...admin, body: { ...body, ...changes } })).status, 400);
const foreignPath = await upload(member.cookie);
const foreign = await call('/api/admin/events', { method: 'POST', ...admin, body: { ...body, thumbnailPath: foreignPath } });
check('foreign image rejected', foreign.status >= 400 && foreign.status < 500, true);
const large = await call('/api/admin/events', { method: 'PATCH', ...admin, body: { ...body, blocks: [{ type: 'text', text: '가'.repeat(8000) }] } });
check('wrong route not accepted', large.status, 404);
const updated = await call(`/api/admin/events/${event.id}`, { method: 'PATCH', ...admin, body: { ...body, title: '수정된 이벤트', blocks: [{ type: 'text', text: '가'.repeat(8000) }] } });
check('8000 Korean characters accepted', updated.status, 200);
check('creation date retained', updated.data.event.createdAt, event.createdAt);
check('removed image route gone', (await call(`/api/events/${event.id}/images/1`)).status, 404);
check('promote second admin', (await call('/api/admin/admins', { method: 'POST', ...admin, body: { username: member.username } })).status, 200);
const editor = await call('/api/editor/login', { method: 'POST', body: { username: member.username, password } });
check('editor login', editor.status, 200);
const retained = await call(`/api/admin/events/${event.id}`, { method: 'PATCH', token: editor.data.token, body: { ...body, blocks: [{ type: 'text', text: '다른 관리자 수정' }] } });
check('another admin retains thumbnail with bearer', retained.status, 200);
check('editor list', (await call('/api/admin/events', { token: editor.data.token })).status, 200);
check('editor delete', (await call(`/api/admin/events/${event.id}`, { method: 'DELETE', token: editor.data.token })).status, 200);
check('deleted list empty', (await call('/api/events')).data.events.length, 0);
check('deleted detail', (await call(`/api/events/${event.id}`)).status, 404);
check('deleted thumbnail', (await call(`/api/events/${event.id}/thumbnail`)).status, 404);
check('deleted update', (await call(`/api/admin/events/${event.id}`, { method: 'PATCH', ...admin, body })).status, 404);
for (const path of ['/api/notices', '/api/updates', '/api/posts?board=free', '/api/config']) check(`regression ${path}`, (await call(path)).status, 200);
for (let i = 1; i <= 3; i++) check(`browser fixture ${i}`, (await call('/api/admin/events', { method: 'POST', ...admin, body: { ...body, title: `로컬 테스트 이벤트 ${i}` } })).status, 201);
console.log(`${checks} checks passed. Local browser admin: ${admin.username}; password is the test constant in this script.`);
