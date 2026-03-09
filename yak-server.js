const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'yak-data.json');
const HTML_FILE = path.join(__dirname, 'tracker.html');
const FAVICON_FILE = path.join(__dirname, 'yak-favicon.png');

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const d = JSON.parse(raw);
    // Ensure cards have IDs
    let changed = false;
    (d.cards || []).forEach(c => {
      if (!c.id) { c.id = uid(); changed = true; }
    });
    if (changed) writeData(d);
    return d;
  } catch {
    return { cards: [], timeEntries: [], clients: [], clientOrder: [] };
  }
}

function writeData(data) {
  // Atomic write: write to temp file then rename
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

function json(res, obj, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;

    // Serve HTML
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(HTML_FILE));
      return;
    }

    // Serve favicon
    if (req.method === 'GET' && p === '/yak-favicon.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(fs.readFileSync(FAVICON_FILE));
      return;
    }

    // GET full data
    if (req.method === 'GET' && p === '/api/data') {
      json(res, readData());
      return;
    }

    // POST full data (legacy — kept as fallback)
    if (req.method === 'POST' && p === '/api/data') {
      const body = await parseBody(req);
      writeData(body);
      json(res, { ok: true });
      return;
    }

    // ── Time Entries ──

    // Add time entry
    if (req.method === 'POST' && p === '/api/time-entries') {
      const entry = await parseBody(req);
      if (!entry.id) entry.id = uid();
      const data = readData();
      data.timeEntries.push(entry);
      writeData(data);
      json(res, entry, 201);
      return;
    }

    // Update time entry
    if (req.method === 'PUT' && p.startsWith('/api/time-entries/')) {
      const id = p.split('/').pop();
      const updates = await parseBody(req);
      const data = readData();
      const idx = data.timeEntries.findIndex(e => e.id === id);
      if (idx === -1) { json(res, { error: 'Not found' }, 404); return; }
      Object.assign(data.timeEntries[idx], updates);
      writeData(data);
      json(res, data.timeEntries[idx]);
      return;
    }

    // Delete time entry
    if (req.method === 'DELETE' && p.startsWith('/api/time-entries/')) {
      const id = p.split('/').pop();
      const data = readData();
      const before = data.timeEntries.length;
      data.timeEntries = data.timeEntries.filter(e => e.id !== id);
      writeData(data);
      json(res, { ok: true, deleted: data.timeEntries.length < before });
      return;
    }

    // ── Cards ──

    // Add card
    if (req.method === 'POST' && p === '/api/cards') {
      const card = await parseBody(req);
      if (!card.id) card.id = uid();
      const data = readData();
      data.cards.push(card);
      writeData(data);
      json(res, card, 201);
      return;
    }

    // Update card
    if (req.method === 'PUT' && p.startsWith('/api/cards/')) {
      const id = p.split('/').pop();
      const updates = await parseBody(req);
      const data = readData();
      const idx = data.cards.findIndex(c => c.id === id);
      if (idx === -1) { json(res, { error: 'Not found' }, 404); return; }
      updates.id = id; // preserve id
      data.cards[idx] = updates;
      writeData(data);
      json(res, data.cards[idx]);
      return;
    }

    // Delete card
    if (req.method === 'DELETE' && p.startsWith('/api/cards/')) {
      const id = p.split('/').pop();
      const data = readData();
      data.cards = data.cards.filter(c => c.id !== id);
      writeData(data);
      json(res, { ok: true });
      return;
    }

    // Reorder cards
    if (req.method === 'PUT' && p === '/api/cards-order') {
      const { orderedIds } = await parseBody(req);
      const data = readData();
      const byId = Object.fromEntries(data.cards.map(c => [c.id, c]));
      data.cards = orderedIds.map(id => byId[id]).filter(Boolean);
      // Append any cards not in the order (safety net)
      const ordered = new Set(orderedIds);
      data.cards.push(...data.cards.filter(c => !ordered.has(c.id)));
      writeData(data);
      json(res, { ok: true });
      return;
    }

    // ── Clients ──

    // Add client
    if (req.method === 'POST' && p === '/api/clients') {
      const { name } = await parseBody(req);
      if (!name) { json(res, { error: 'Name required' }, 400); return; }
      const data = readData();
      if (!data.clients) data.clients = [];
      if (!data.clients.includes(name)) {
        data.clients.push(name);
        writeData(data);
      }
      json(res, { ok: true });
      return;
    }

    // Update client order
    if (req.method === 'PUT' && p === '/api/client-order') {
      const { order } = await parseBody(req);
      const data = readData();
      data.clientOrder = order;
      writeData(data);
      json(res, { ok: true });
      return;
    }

    // Upload image
    if (req.method === 'POST' && p === '/api/images') {
      const imgDir = path.join(__dirname, 'images');
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir);
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      await new Promise(resolve => req.on('end', resolve));
      const buf = Buffer.concat(chunks);
      const id = uid();
      const ext = (req.headers['content-type'] || 'image/png').split('/')[1] || 'png';
      const filename = `${id}.${ext}`;
      fs.writeFileSync(path.join(imgDir, filename), buf);
      json(res, { url: `/images/${filename}` }, 201);
      return;
    }

    // Serve images
    if (req.method === 'GET' && p.startsWith('/images/')) {
      const imgPath = path.join(__dirname, p);
      if (fs.existsSync(imgPath)) {
        const ext = path.extname(imgPath).slice(1);
        const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(fs.readFileSync(imgPath));
        return;
      }
    }

    // Backup
    if (req.method === 'POST' && p === '/api/backup') {
      const backupDir = path.join(__dirname, 'backups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
      const now = new Date();
      const stamp = now.getFullYear().toString() +
        String(now.getMonth()+1).padStart(2,'0') +
        String(now.getDate()).padStart(2,'0') + '-' +
        String(now.getHours()).padStart(2,'0') +
        String(now.getMinutes()).padStart(2,'0') +
        String(now.getSeconds()).padStart(2,'0');
      const dest = path.join(backupDir, `yak-data-${stamp}.json`);
      fs.copyFileSync(DATA_FILE, dest);
      json(res, { ok: true, file: `yak-data-${stamp}.json` });
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (err) {
    console.error(err);
    json(res, { error: err.message }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`Yak running at http://localhost:${PORT}`);
});
