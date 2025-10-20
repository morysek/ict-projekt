const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());

// --- Semináře ---
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

// --- Povolení žáci: všechna jména ---
const allowedStudents = [
"kozisek.adam","kozisek.alena","kozisek.anna","kozisek.antonin","kozisek.barbora","kozisek.benjamin","kozisek.daniela",
"kozisek.david","kozisek.dominik","kozisek.elena","kozisek.erik","kozisek.eva","kozisek.filip","kozisek.frantisek",
"kozisek.gabriela","kozisek.hana","kozisek.helena","kozisek.honza","kozisek.ivan","kozisek.jakub","kozisek.jana",
"kozisek.jaroslav","kozisek.josef","kozisek.julie","kozisek.karin",
"kozeny.adam","kozeny.alena","kozeny.anna","kozeny.antonin","kozeny.barbora","kozeny.benjamin","kozeny.daniela",
"kozeny.david","kozeny.dominik","kozeny.elena","kozeny.filip","kozeny.frantisek","kozeny.gabriela","kozeny.hana",
"kozeny.helena","kozeny.honza","kozeny.ivan","kozeny.jakub","kozeny.jana","kozeny.jaroslav",
"kozela.adam","kozela.alena","kozela.anna","kozela.barbora","kozela.benjamin","kozela.daniela","kozela.david",
"kozela.dominik","kozela.erik","kozela.eva","kozela.filip","kozela.frantisek","kozela.gabriela",
"kozela.hana","kozela.helena","kozela.honza","kozela.ivan","kozela.jakub","kozela.jana","kozela.jaroslav",
"kozuch.adam","kozuch.alena","kozuch.anna","kozuch.antonin","kozuch.barbora","kozuch.benjamin","kozuch.daniela",
"kozuch.david","kozuch.dominik","kozuch.elena","kozuch.erik","kozuch.eva","kozuch.filip","kozuch.frantisek",
"kozuch.gabriela","kozuch.hana","kozuch.helena","kozuch.honza","kozuch.ivan","kozuch.jakub",
"kozusnik.adam","kozusnik.alena","kozusnik.anna","kozusnik.antonin","kozusnik.barbora","kozusnik.benjamin",
"kozusnik.daniela","kozusnik.david","kozusnik.dominik","kozusnik.elena","kozusnik.erik","kozusnik.eva",
"kozusnik.filip","kozusnik.frantisek","kozusnik.gabriela"
];

const ADMIN_PASSWORD = "milujikozeje";
let registrationOpen = true;
const selections = [];
let evaluationResult = {};

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/seminars', (_req, res) => res.json({ seminars }));

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) res.json({ ok: true, secret: 'adminsecret' });
  else res.status(403).json({ error: 'Nesprávné heslo' });
});
app.post('/api/select', (req, res) => {
  if (!registrationOpen) return res.status(403).json({ error: 'Registrace je uzavřena' });
  const { username, priorities } = req.body || {};
  const usernameLower = (username + "").toLowerCase().trim();
  if (usernameLower === 'admin') return res.status(403).json({ error: 'Jméno admin je vyhrazeno pro administraci' });
  if (!allowedStudents.includes(usernameLower))
    return res.status(403).json({ error: 'Jméno není povoleno.' });
  if (!Array.isArray(priorities) || priorities.length !== 3 ||
      new Set(priorities).size !== 3 ||
      priorities.some(id => !seminars.some(s => s.id === id)))
    return res.status(400).json({ error: 'Vyberte tři různé platné semináře!' });
  const idx = selections.findIndex(u => u.username === usernameLower);
  if (idx >= 0) selections.splice(idx, 1);
  selections.push({ username: usernameLower, priorities, timestamp: Date.now() });
  res.json({ ok: true, message: 'Výběr uložen.' });
});
app.get('/api/admin/selections', (req, res) => {
  if (req.query.secret !== 'adminsecret') return res.status(403).json({ error: 'Přístup odepřen' });
  res.json({ selections, registrationOpen, evaluationResult });
});
app.post('/api/admin/evaluate', (req, res) => {
  if (req.query.secret !== 'adminsecret') return res.status(403).json({ error: 'Přístup odepřen' });
  registrationOpen = false;
  evaluationResult = assignSeminars(selections, seminars);
  res.json({ ok: true, message: 'Registrace uzavřena a vyhodnocena.' });
});
app.post('/api/admin/reopen', (req, res) => {
  if (req.query.secret !== 'adminsecret') return res.status(403).json({ error: 'Přístup odepřen' });
  registrationOpen = true;
  evaluationResult = {};
  res.json({ ok: true, message: 'Registrace znovu otevřena.' });
});
app.post('/api/admin/delete', (req, res) => {
  if (req.query.secret !== 'adminsecret') return res.status(403).json({ error: 'Přístup odepřen' });
  const { username } = req.body || {};
  const idx = selections.findIndex(u => u.username === username);
  if (idx >= 0) {
    selections.splice(idx, 1);
    res.json({ ok: true, message: 'Přihláška smazána.' });
  } else {
    res.status(404).json({ error: 'Uživatel nenalezen.' });
  }
});
function assignSeminars(all, seminars) {
  const assignments = {}; seminars.forEach(s => assignments[s.id] = []);
  const sorted = [...all].sort((a, b) => a.timestamp - b.timestamp);
  sorted.forEach(({ username, priorities }) => {
    for (const pid of priorities) {
      if (assignments[pid].length < seminars.find(s => s.id === pid).capacity) {
        assignments[pid].push(username); break;
      }
    }
  });
  return assignments;
}

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server běží na http://localhost:${PORT}`); });
