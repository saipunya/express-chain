const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const secureUpload = require('../middleware/secureUpload');
const { validateMetadata, validSignature, containsPhp } = require('../services/uploadSecurity');
const { uploadStatic, allowedUploadPath } = require('../middleware/uploadStatic');

const pdf = Buffer.from('%PDF-1.7\nbenign test document');
const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');

async function fixture(t) {
  const root = path.resolve(__dirname, '../uploads');
  await fs.mkdir(root, { recursive: true });
  const folder = await fs.mkdtemp(path.join(root, 'security-test-'));
  const storage = secureUpload.diskStorage({ destination: folder });
  const app = express();
  let accepted = 0;
  app.use((req, res, next) => {
    if (req.headers['x-test-user'] === 'yes') req.session = { user: { username: 'test' } };
    next();
  });
  const save = (req, res) => { accepted++; res.json({ filename: req.file?.filename, size: req.file?.size, count: req.files?.length }); };
  app.post('/upload', secureUpload({ storage }).single('file'), save);
  app.post('/batch', secureUpload({ storage }).array('files', 2), save);
  app.post('/memory', secureUpload({ storage: secureUpload.memoryStorage() }).single('file'), save);
  app.post('/small', secureUpload({ storage, limits: { fileSize: 16 } }).single('file'), save);
  app.post('/outside', secureUpload({ storage: secureUpload.diskStorage({ destination: path.resolve(folder, '../../outside-security-test') }) }).single('file'), save);
  app.post('/random-names/music', (req, res, next) => { req.session = { randomNamesAccessAuthed: true }; next(); }, secureUpload({ storage }).single('file'), save);
  app.use('/files', uploadStatic(folder));
  app.use((err, req, res, next) => res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code || 'UPLOAD_ERROR' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(folder, { recursive: true, force: true }); });
  const send = (name, mime, buffer, route = '/upload', auth = true) => {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mime }), name);
    return fetch(base + route, { method: 'POST', headers: auth ? { 'x-test-user': 'yes' } : {}, body: form });
  };
  return { folder, base, send, accepted: () => accepted };
}

test('rejects executable extensions, double extensions, traversal and spoofed MIME', () => {
  for (const name of ['shell.php', 'shell.PHP5', 'shell.phtml', 'shell.php.jpg', 'shell.php.pdf', 'shell.phar.png', '.htaccess', '.user.ini', '../file.pdf', 'sub/file.pdf', 'sub\\file.pdf', 'file.php:.pdf', 'file%00.pdf', 'file.pdf ']) {
    assert.throws(() => validateMetadata({ originalname: name, mimetype: 'application/pdf' }), name);
  }
  assert.throws(() => validateMetadata({ originalname: 'photo.png', mimetype: 'application/pdf' }));
  assert.equal(validateMetadata({ originalname: 'รายงาน.PDF', mimetype: 'application/pdf' }), '.pdf');
  assert.equal(validateMetadata({ originalname: 'report.xlsx', mimetype: 'application/octet-stream' }), '.xlsx');
});

test('validates signatures rather than trusting filename and declared MIME', () => {
  assert.equal(validSignature('.pdf', pdf), true);
  assert.equal(validSignature('.png', png), true);
  assert.equal(validSignature('.pdf', png), false);
  assert.equal(validSignature('.png', Buffer.from('plain text')), false);
  assert.equal(validSignature('.xlsx', Buffer.from('504b0304', 'hex')), true);
  assert.equal(validSignature('.xls', Buffer.from('d0cf11e0a1b11ae1', 'hex')), true);
  assert.equal(validSignature('.csv', Buffer.from('name,amount\ncoop,10')), true);
  assert.equal(validSignature('.csv', Buffer.from([0, 1, 2])), false);
  assert.equal(containsPhp(Buffer.from('<?PHP echo "test"; ?>')), true);
  assert.equal(containsPhp(Buffer.from('<?= "test" ?>')), true);
});

test('real multipart rejects dangerous names and disguised PHP without publishing files', async t => {
  const { folder, send, accepted } = await fixture(t);
  for (const [name, mime, bytes] of [
    ['shell.php', 'application/pdf', pdf], ['shell.php.jpg', 'image/jpeg', Buffer.from('ffd8ff', 'hex')],
    ['shell.phtml', 'image/png', png], ['file.php%00.pdf', 'application/pdf', pdf],
    ['../file.pdf', 'application/pdf', pdf], ['fake.pdf', 'application/pdf', Buffer.from('not a PDF')],
    ['polyglot.pdf', 'application/pdf', Buffer.concat([pdf, Buffer.alloc(70000, 32), Buffer.from('<?php echo "inert test"; ?>')])]
  ]) {
    const res = await send(name, mime, bytes);
    assert.equal(res.status, 400, name);
    assert.deepEqual(await fs.readdir(folder), [], name);
  }
  assert.equal(accepted(), 0);
});

test('accepts legitimate PDF and raster files and assigns safe unique names', async t => {
  const { folder, base, send } = await fixture(t);
  for (const [name, mime, bytes] of [['รายงาน.PDF', 'application/pdf', pdf], ['photo.png', 'image/png', png]]) {
    const res = await send(name, mime, bytes);
    assert.equal(res.status, 200);
    const { filename } = await res.json();
    assert.match(filename, /^[0-9a-f-]{36}\.(pdf|png)$/);
    assert.deepEqual(await fs.readFile(path.join(folder, filename)), bytes);
    const download = await fetch(`${base}/files/${filename}`);
    assert.equal(download.status, 200);
    assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
    assert.match(download.headers.get('content-security-policy'), /sandbox/);
  }
});

test('requires authentication before upload but keeps authenticated random-names access', async t => {
  const { send, accepted } = await fixture(t);
  assert.equal((await send('file.pdf', 'application/pdf', pdf, '/upload', false)).status, 401);
  assert.equal(accepted(), 0);
  assert.equal((await send('file.pdf', 'application/pdf', pdf, '/random-names/music', false)).status, 200);
});

test('enforces size limits and private staging for disk and memory storage', async t => {
  const { folder, send } = await fixture(t);
  assert.equal((await send('file.pdf', 'application/pdf', pdf, '/small')).status, 413);
  assert.deepEqual(await fs.readdir(folder), []);
  assert.equal((await send('file.pdf', 'application/pdf', pdf, '/memory')).status, 200);
  assert.equal((await send('fake.pdf', 'application/pdf', Buffer.from('not PDF'), '/memory')).status, 400);
  assert.equal((await send('file.pdf', 'application/pdf', pdf, '/outside')).status, 400);
  assert.deepEqual(await fs.readdir(folder), []);
});

test('rolls back valid files when a later file in the same request is unsafe', async t => {
  const { folder, base, accepted } = await fixture(t);
  const form = new FormData();
  form.append('files', new Blob([pdf], { type: 'application/pdf' }), 'good.pdf');
  form.append('files', new Blob(['not PDF'], { type: 'application/pdf' }), 'bad.pdf');
  const res = await fetch(base + '/batch', { method: 'POST', headers: { 'x-test-user': 'yes' }, body: form });
  assert.equal(res.status, 400);
  assert.equal(accepted(), 0);
  assert.deepEqual(await fs.readdir(folder), []);
});

test('legacy script files and encoded paths are blocked; normal documents download as attachments', async t => {
  const { folder, base } = await fixture(t);
  for (const name of ['shell.php', 'shell.php.jpg', '.htaccess', 'page.html', 'script.svg']) {
    await fs.writeFile(path.join(folder, name), 'inert test');
    const response = await fetch(`${base}/files/${name}`);
    assert.equal(response.status, 404, name);
  }
  for (const raw of ['/shell%2ephp', '/shell%252ephp', '/dir%2f..%2fshell.php', '/dir/.user.ini']) assert.equal(allowedUploadPath(raw), false, raw);
  await fs.writeFile(path.join(folder, 'report.docx'), Buffer.from('504b0304', 'hex'));
  const document = await fetch(`${base}/files/report.docx`);
  assert.equal(document.status, 200);
  assert.match(document.headers.get('content-disposition'), /^attachment/);
});

test('detects PHP tags split across stream chunks and cleans up an interrupted upload', async t => {
  const { EventEmitter } = require('node:events');
  const { Readable, PassThrough } = require('node:stream');
  const { folder } = await fixture(t);
  const upload = secureUpload({ storage: secureUpload.diskStorage({ destination: folder }) });
  const file = stream => ({ originalname: 'report.pdf', mimetype: 'application/pdf', fieldname: 'file', stream });
  const run = (req, input) => new Promise(resolve => upload.storage._handleFile(req, file(input), err => resolve(err)));
  const split = await run(new EventEmitter(), Readable.from([pdf, Buffer.from('<'), Buffer.from('?p'), Buffer.from('hp echo "inert"; ?>')]));
  assert.equal(split.code, 'UNSAFE_UPLOAD');
  assert.deepEqual(await fs.readdir(folder), []);
  const req = new EventEmitter();
  const input = new PassThrough();
  input.on('error', () => {});
  const interrupted = run(req, input);
  input.write(pdf);
  req.aborted = true;
  req.emit('aborted');
  assert.equal((await interrupted).code, 'UNSAFE_UPLOAD');
  assert.deepEqual(await fs.readdir(folder), []);
});

test('endpoint type filters do not accept a PDF as a spreadsheet or image', async () => {
  const filter = secureUpload.fileFilter(['.xlsx']);
  const check = file => new Promise(resolve => filter({}, file, (error, allowed) => resolve({ error, allowed })));
  assert.equal((await check({ originalname: 'report.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })).allowed, true);
  assert.equal((await check({ originalname: 'report.pdf', mimetype: 'application/pdf' })).error.code, 'UNSAFE_UPLOAD');
  assert.equal((await check({ originalname: 'shell.php', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })).error.code, 'UNSAFE_UPLOAD');
});

test('binary audio containing an accidental short-tag byte sequence is not mistaken for PHP', async t => {
  const binary = Buffer.from('4944335aca3ea0a0ee64c8086e76963c3f3df32c88070f826245ec3ac9111df6231ad8', 'hex');
  assert.equal(containsPhp(binary), false);
  const { send } = await fixture(t);
  assert.equal((await send('track.mp3', 'audio/mpeg', binary, '/memory')).status, 200);
});
