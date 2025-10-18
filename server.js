// optimized server.js
'use strict';

const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');

const app = express();

// security + compression (reduces payload size & latency)
app.use(helmet());
app.use(compression());
app.use(express.json());

// ---------- Data (kept same values as original) ----------
const seminars = [
  { id: 1, name: "Otevřená laboratoř", lecturers: ["Miroslav Pražienka"], capacity: 20 },
  { id: 2, name: "Praktická Biologie: od buněk k ekosystémům", lecturers: ["Marek Kasner"], capacity: 20 },
  { id: 3, name: "Nutritional Anthropology", lecturers: ["Melanie Rada"], capacity: 20 },
  { id: 4, name: "Southern Gothic Literature – Writings from the Peach State", lecturers: ["Melanie Rada"], capacity: 20 },
  { id: 5, name: "Seminář vizuální tvorby", lecturers: ["Olga Vršková"], capacity: 20 },
  { id: 6, name: "Public Speaking and Debate", lecturers: ["Petra Schmalzová"], capacity: 20 },
  { id: 7, name: "Seminář tvůrčího překladu a tvůrčího psaní", lecturers: ["Petr Fantys", "Marek Šindelka"], capacity: 20 },
  { id: 8, name: "Antistres – tělo, dýchání, mysl", lecturers: ["Petra Vágnerová", "Petr Knotek"], capacity: 20 },
  { id: 9, name: "Seminář Zajímavá matematika", lecturers: ["Štěpánka Svobodová"], capacity: 20 },
  { id: 10, name: "Seminář Základy latiny", lecturers: ["Tereza Samková"], capacity: 20 },
  { id: 11, name: "Seminář Úvod do moderní psychologie", lecturers: [], capacity: 20 }
];

// Precompute useful maps & sets for O(1) lookups
const seminarMap = new Map(seminars.map(s => [s.id, Object.assign({}, s)]));
const validSeminarIds = new Set(seminars.map(s => s.id));

// Original allowed-students list (kept values). Store as lowercase in a Set for O(1).
const allowedStudentsArr = [
  'kozisek.adam','kozisek.alena','kozisek.anna','kozisek.antonin','kozisek.barbora','kozisek.benjamin',
  'kozisek.daniela','kozisek.david','kozisek.dominik','kozisek.elena','kozisek.erik','kozisek.eva',
  'kozisek.filip','kozisek.frantisek','kozisek.gabriela','kozeny.adam','kozeny.alena','kozeny.anna',
  'kozeny.antonin','kozeny.barbora','kozeny.benjamin','kozeny.daniela','kozeny.david','kozeny.dominik',
  'kozeny.elena','kozela.adam','kozela.alena','kozela.anna','kozela.barbora','kozela.benjamin',
  'kozela.daniela','kozela.david','kozela.dominik','kozela.erik','kozela.eva','kozuch.adam',
  'kozuch.alena','kozuch.anna','kozuch.antonin','kozuch.barbora','kozuch.benjamin','kozuch.daniela',
  'kozuch.david','kozuch.dominik','kozuch.elena','kozusnik.adam','kozusnik.alena','kozusnik.anna',
  'kozusnik.antonin','kozusnik.barbora','kozusnik.benjamin','kozusnik.daniela','kozusnik.david',
  'kozusnik.dominik','kozusnik.elena','kozisek.hana','kozisek.helena','kozisek.honza','kozisek.ivan',
  'kozisek.jakub','kozeny.filip','kozeny.frantisek','kozeny.gabriela','kozeny.hana','kozeny.helena',
  'kozela.filip','kozela.frantisek','kozela.gabriela','kozela.hana','kozela.helena','kozuch.erik',
  'kozuch.eva','kozuch.filip','kozuch.frantisek','kozuch.gabriela','kozusnik.erik','kozusnik.eva',
  'kozusnik.filip','kozusnik.frantisek','kozusnik.gabriela','kozisek.jana','kozisek.jaroslav','kozisek.josef',
  'kozisek.julie','kozisek.karin','kozeny.honza','kozeny.ivan','kozeny.jakub','kozeny.jana','kozeny.jaroslav',
  'kozela.honza','kozela.ivan','kozela.jakub','kozela.jana','kozela.jaroslav','kozuch.hana','kozuch.helena',
  'kozuch.honza','kozuch.ivan','kozuch.jakub'
];
const allowedStudents = new Set(allowedStudentsArr.map(s => s.toLowerCase().trim()));

// Admin password should be an env var in production
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'milujikozeje';

// registration state & selections stored in a Map for fast operations.
// Map key: usernameLower -> { username, priorities, timestamp }
let registrationOpen = true;
const selections = new Map();
let evaluationResult = {};

// Serve static files with caching headers (1 day). Adjust maxAge as needed.
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  immutable: true,
}));

// ---------- API ----------

// public: list seminars
app.get('/api/seminars', (_req, res) => res.json({ seminars }));

// admin login (simplified token returned; in prod use proper auth)
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    // in real-world use a real token (JWT) and HTTPS
    return res.json({ ok: true, secret: process.env.ADMIN_SECRET || 'adminsecret' });
  }
  return res.status(403).json({ error: 'Nesprávné heslo' });
});

// user selection (fast validation using Set/Map)
app.post('/api/select', (req, res) => {
  if (!registrationOpen) return res.status(403).json({ error: 'Registrace je uzavřena' });

  const { username, priorities } = req.body || {};
  const usernameLower = (username + '').toLowerCase().trim();

  if (usernameLower === 'admin') return res.status(403).json({ error: 'Jméno admin je vyhrazeno pro administraci' });
  if (!allowedStudents.has(usernameLower)) return res.status(403).json({ error: 'Toto jméno není na seznamu povolených žáků' });

  if (!Array.isArray(priorities) || priorities.length !== 3 || new Set(priorities).size !== 3 || !priorities.every(pid => validSeminarIds.has(pid))) {
    return res.status(400).json({ error: 'Vyberte tři různé platné semináře!' });
  }

  // O(1) insert/update
  selections.set(usernameLower, { username: usernameLower, priorities, timestamp: Date.now() });

  return res.json({ ok: true, message: 'Výběr uložen.' });
});

// admin: list selections
app.get('/api/admin/selections', (req, res) => {
  if (req.query.secret !== (process.env.ADMIN_SECRET || 'adminsecret')) return res.status(403).json({ error: 'Přístup odepřen' });
  return res.json({ selections: Array.from(selections.values()), registrationOpen, evaluationResult });
});

// admin: evaluate (assign)
app.post('/api/admin/evaluate', (req, res) => {
  if (req.query.secret !== (process.env.ADMIN_SECRET || 'adminsecret')) return res.status(403).json({ error: 'Přístup odepřen' });

  registrationOpen = false;
  evaluationResult = assignSeminars();
  return res.json({ ok: true, message: 'Registrace uzavřena a vyhodnocena.' });
});

// admin: reopen
app.post('/api/admin/reopen', (req, res) => {
  if (req.query.secret !== (process.env.ADMIN_SECRET || 'adminsecret')) return res.status(403).json({ error: 'Přístup odepřen' });
  registrationOpen = true;
  evaluationResult = {};
  return res.json({ ok: true, message: 'Registrace znovu otevřena.' });
});

// admin: delete an application
app.post('/api/admin/delete', (req, res) => {
  if (req.query.secret !== (process.env.ADMIN_SECRET || 'adminsecret')) return res.status(403).json({ error: 'Přístup odepřen' });

  const { username } = req.body || {};
  if (selections.delete(username)) {
    return res.json({ ok: true, message: 'Přihláška smazána.' });
  } else {
    return res.status(404).json({ error: 'Uživatel nenalezen.' });
  }
});

// ---------- assignment algorithm (efficient) ----------
function assignSeminars() {
  // initialize empty arrays and capacity counters
  const assignments = {};
  const capacityLeft = new Map();

  seminarMap.forEach((s, id) => {
    assignments[id] = [];
    capacityLeft.set(id, s.capacity);
  });

  // sort only once by timestamp (oldest first)
  const sorted = Array.from(selections.values()).sort((a, b) => a.timestamp - b.timestamp);

  for (const { username, priorities } of sorted) {
    for (const pid of priorities) {
      const left = capacityLeft.get(pid) || 0;
      if (left > 0) {
        assignments[pid].push(username);
        capacityLeft.set(pid, left - 1);
        break;
      }
    }
  }

  return assignments;
}

// catch-all to serve SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
