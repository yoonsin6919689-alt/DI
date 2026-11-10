// Local stand-in for the Google Apps Script relay used in production.
// Listens on 127.0.0.1:8010 and keeps the last messages in memory so a local
// test can read the verification code that would have been emailed.
import { createServer } from 'node:http';

const TOKEN = process.env.LOCAL_RELAY_TOKEN || 'local-token';
const outbox = [];
const MAX_OUTBOX = 200;

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/outbox') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ messages: outbox }));
    return;
  }
  if (request.method !== 'POST') {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'not_found' }));
    return;
  }

  const chunks = [];
  request.on('data', (chunk) => {
    if (chunks.reduce((size, part) => size + part.length, 0) + chunk.length > 512 * 1024) {
      request.destroy();
    } else {
      chunks.push(chunk);
    }
  });
  request.on('end', () => {
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ sent: 0, failed: [], error: 'invalid_json' }));
      return;
    }
    if (body?.token !== TOKEN) {
      response.writeHead(403, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ sent: 0, failed: [], error: 'forbidden' }));
      return;
    }
    const recipients = Array.isArray(body?.recipients)
      ? body.recipients.filter((value) => typeof value === 'string')
      : [];
    if (recipients.length === 0 || typeof body?.subject !== 'string') {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ sent: 0, failed: [], error: 'invalid_input' }));
      return;
    }
    outbox.push({
      subject: body.subject,
      text: typeof body.text === 'string' ? body.text : '',
      recipients,
      at: new Date().toISOString(),
    });
    while (outbox.length > MAX_OUTBOX) outbox.shift();
    console.log(`[relay] ${body.subject} -> ${recipients.length} recipient(s)`);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ sent: recipients.length, failed: [] }));
  });
});

server.listen(8010, '127.0.0.1', () => {
  console.log('local mail relay on http://127.0.0.1:8010');
});
