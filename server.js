// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load or initialize data
function readData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read data.json, creating default structure.', err);
    const initial = { options: [] };
    fs.writeFileSync(DATA_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
}
function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// In-memory SSE clients
const clients = new Set();

// Simple rate limiter: per-IP sliding window (demo only)
const rateMap = new Map();
const WINDOW_MS = 10_000; // 10s
const MAX_PER_WINDOW = 10;

function allowed(ip) {
  const now = Date.now();
  let rec = rateMap.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) {
    rec = { start: now, count: 0 };
  }
  rec.count++;
  rateMap.set(ip, rec);
  return rec.count <= MAX_PER_WINDOW;
}

// Send update to all SSE clients
function broadcast(payload) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try {
      res.write(msg);
    } catch (err) {
      // ignore; will be cleaned on 'close'
    }
  }
}

// API: get options
app.get('/api/options', (req, res) => {
  const data = readData();
  res.json({ options: data.options });
});

// API: increment an option (add an entry)
app.post('/api/options/:id/click', (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  if (!allowed(ip)) {
    return res.status(429).json({ error: 'rate limit exceeded' });
  }

  const id = req.params.id;
  const data = readData();
  const opt = data.options.find(o => o.id === id);
  if (!opt) {
    return res.status(404).json({ error: 'option not found' });
  }

  // increment count (this represents "adding an entry")
  opt.count = (opt.count || 0) + 1;
  writeData(data);

  // broadcast the updated option to all clients
  broadcast({ type: 'update', option: { id: opt.id, count: opt.count } });

  res.json({ success: true, option: opt });
});

// SSE endpoint for real-time updates
app.get('/events', (req, res) => {
  // headers for SSE
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.flushHeaders();

  // send initial snapshot
  const data = readData();
  res.write(`event: init\n`);
  res.write(`data: ${JSON.stringify({ options: data.options })}\n\n`);

  // add to clients set
  clients.add(res);

  // cleanup on close
  req.on('close', () => {
    clients.delete(res);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Clicker local server running on http://localhost:${PORT}`);
});
