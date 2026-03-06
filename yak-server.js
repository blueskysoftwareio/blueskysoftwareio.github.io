const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'yak-data.json');
const HTML_FILE = path.join(__dirname, 'tracker.html');
const FAVICON_FILE = path.join(__dirname, 'yak-favicon.png');

function readData() {
  try {
    return fs.readFileSync(DATA_FILE, 'utf8');
  } catch {
    return JSON.stringify({ cards: [], timeEntries: [], clients: [] });
  }
}

function writeData(json) {
  fs.writeFileSync(DATA_FILE, json, 'utf8');
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(HTML_FILE));
  } else if (req.method === 'GET' && req.url === '/yak-favicon.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(fs.readFileSync(FAVICON_FILE));
  } else if (req.method === 'GET' && req.url === '/api/data') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(readData());
  } else if (req.method === 'POST' && req.url === '/api/data') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      writeData(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Yak running at http://localhost:${PORT}`);
});
