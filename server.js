const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());

const seminars = [
  { id: 1,  name: "OtevÅ™enÃ¡ laboratoÅ™", lecturers: ["Miroslav PraÅ¾ienka"], capacity: 20 },
  { id: 2,  name: "PraktickÃ¡ Biologie: od bunÄ›k k ekosystÃ©mÅ¯m", lecturers: ["Marek Kasner"], capacity: 20 },
  { id: 3,  name: "Nutritional Anthropology", lecturers: ["Melanie Rada"], capacity: 20 },
  { id: 4,  name: "Southern Gothic Literature â€“ Writings from the Peach State", lecturers: ["Melanie Rada"], capacity: 20 },
  { id: 5,  name: "SeminÃ¡Å™ vizuÃ¡lnÃ­ tvorby", lecturers: ["Olga VrÅ¡kovÃ¡"], capacity: 20 },
  { id: 6,  name: "Public Speaking and Debate", lecturers: ["Petra SchmalzovÃ¡"], capacity: 20 },
  { id: 7,  name: "SeminÃ¡Å™ tvÅ¯rÄÃ­ho pÅ™ekladu a tvÅ¯rÄÃ­ho psanÃ­", lecturers: ["Petr Fantys", "Marek Å indelka"], capacity: 20 },
  { id: 8,  name: "Antistres â€“ tÄ›lo, dÃ½chÃ¡nÃ­, mysl", lecturers: ["Petra VÃ¡gnerovÃ¡", "Petr Knotek"], capacity: 20 },
  { id: 9,  name: "SeminÃ¡Å™ ZajÃ­mavÃ¡ matematika", lecturers: ["Å tÄ›pÃ¡nka SvobodovÃ¡"], capacity: 20 },
  { id: 10, name: "SeminÃ¡Å™ ZÃ¡klady latiny", lecturers: ["Tereza SamkovÃ¡"], capacity: 20 },
  { id: 11, name: "SeminÃ¡Å™ Ãšvod do modernÃ­ psychologie", lecturers: [], capacity: 20 }
];

// Seznam 100 povolenÃ½ch Å¾Ã¡kÅ¯ s pÅ™Ã­jmenÃ­mi obsahujÃ­cÃ­mi "koÅ¾"
const allowedStudents = [
  'kozisek.adam', 'kozisek.alena', 'kozisek.anna', 'kozisek.antonin', 'kozisek.barbora',
  'kozisek.benjamin', 'kozisek.daniela', 'kozisek.david', 'kozisek.dominik', 'kozisek.elena',
  'kozisek.erik', 'kozisek.eva', 'kozisek.filip', 'kozisek.frantisek', 'kozisek.gabriela',
  'kozeny.adam', 'kozeny.alena', 'kozeny.anna', 'kozeny.antonin', 'kozeny.barbora',
  'kozeny.benjamin', 'kozeny.daniela', 'kozeny.david', 'kozeny.dominik', 'kozeny.elena',
  'kozela.adam', 'kozela.alena', 'kozela.anna', 'kozela.barbora', 'kozela.benjamin',
  'kozela.daniela', 'kozela.david', 'kozela.dominik', 'kozela.erik', 'kozela.eva',
  'kozuch.adam', 'kozuch.alena', 'kozuch.anna', 'kozuch.antonin', 'kozuch.barbora',
  'kozuch.benjamin', 'kozuch.daniela', 'kozuch.david', 'kozuch.dominik', 'kozuch.elena',
  'kozusnik.adam', 'kozusnik.alena', 'kozusnik.anna', 'kozusnik.antonin', 'kozusnik.barbora',
  'kozusnik.benjamin', 'kozusnik.daniela', 'kozusnik.david', 'kozusnik.dominik', 'kozusnik.elena',
  'kozisek.hana', 'kozisek.helena', 'kozisek.honza', 'kozisek.ivan', 'kozisek.jakub',
  'kozeny.filip', 'kozeny.frantisek', 'kozeny.gabriela', 'kozeny.hana', 'kozeny.helena',
  'kozela.filip', 'kozela.frantisek', 'kozela.gabriela', 'kozela.hana', 'kozela.helena',
  'kozuch.erik', 'kozuch.eva', 'kozuch.filip', 'kozuch.frantisek', 'kozuch.gabriela',
  'kozusnik.erik', 'kozusnik.eva', 'kozusnik.filip', 'kozusnik.frantisek', 'kozusnik.gabriela',
  'kozisek.jana', 'kozisek.jaroslav', 'kozisek.josef', 'kozisek.julie', 'kozisek.karin',
  'kozeny.honza', 'kozeny.ivan', 'kozeny.jakub', 'kozeny.jana', 'kozeny.jaroslav',
  'kozela.honza', 'kozela.ivan', 'kozela.jakub', 'kozela.jana', 'kozela.jaroslav',
  'kozuch.hana', 'kozuch.helena', 'kozuch.honza', 'kozuch.ivan', 'kozuch.jakub'
];

const ADMIN_PASSWORD = "milujikozeje";
let registrationOpen = true;
const selections = [];
let evaluationResult = {};

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/seminars', (_req, res) => res.json({ seminars }));

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    res.json({ ok: true, secret: 'adminsecret' });
  } else {
    res.status(403).json({ error: 'NesprÃ¡vnÃ© heslo' });
  }
});

app.post('/api/select', (req, res) => {
  if (!registrationOpen) return res.status(403).json({ error: 'Registrace je uzavÅ™ena' });

  const { username, priorities } = req.body || {};
  const usernameLower = (username + "").toLowerCase().trim();

  if (usernameLower === 'admin') return res.status(403).json({ error: 'JmÃ©no admin je vyhrazeno pro administraci' });
  
  if (!allowedStudents.includes(usernameLower)) {
    return res.status(403).json({ error: 'Toto jmÃ©no nenÃ­ na seznamu povolenÃ½ch Å¾Ã¡kÅ¯' });
  }

  if (!Array.isArray(priorities) || priorities.length !== 3 ||
      new Set(priorities).size !== 3 ||
      priorities.some(id => !seminars.some(s => s.id === id))
  ) return res.status(400).json({ error: 'Vyberte tÅ™i rÅ¯znÃ© platnÃ© seminÃ¡Å™e!' });

  const idx = selections.findIndex(u => u.username === usernameLower);
  if (idx >= 0) selections.splice(idx, 1);

  selections.push({ username: usernameLower, priorities, timestamp: Date.now() });
  res.json({ ok: true, message: 'VÃ½bÄ›r uloÅ¾en.' });
});

app.get('/api/admin/selections', (req, res) => {
  if (req.query.secret !== 'adminsecret') return res.status(403).json({ error: 'PÅ™Ã­stup odepÅ™en' });
  res.json({ selections, registrationOpen, evaluationResult });
});

app.post('/api/admin/evaluate', (req, res) => {
  if (req.query.secret !== 'adminsecret') return res.status(403).json({ error: 'PÅ™Ã­stup odepÅ™en' });
  registrationOpen = false;
  evaluationResult = assignSeminars(selections, seminars);
  res.json({ ok: true, message: 'Registrace uzavÅ™ena a vyhodnocena.' });
});

app.post('/api/admin/reopen', (req, res) => {
  if (req.query.secret !== 'adminsecret') return res.status(403).json({ error: 'PÅ™Ã­stup odepÅ™en' });
  registrationOpen = true;
  evaluationResult = {};
  res.json({ ok: true, message: 'Registrace znovu otevÅ™ena.' });
});

app.post('/api/admin/delete', (req, res) => {
  if (req.query.secret !== 'adminsecret') return res.status(403).json({ error: 'PÅ™Ã­stup odepÅ™en' });
  const { username } = req.body || {};
  const idx = selections.findIndex(u => u.username === username);
  if (idx >= 0) {
    selections.splice(idx, 1);
    res.json({ ok: true, message: 'PÅ™ihlÃ¡Å¡ka smazÃ¡na.' });
  } else {
    res.status(404).json({ error: 'UÅ¾ivatel nenalezen.' });
  }
});

function assignSeminars(all, seminars) {
  const assignments = {};
  seminars.forEach(s => assignments[s.id] = []);
  const sorted = [...all].sort((a, b) => a.timestamp - b.timestamp);
  sorted.forEach(({ username, priorities }) => {
    for (const pid of priorities) {
      if (assignments[pid].length < seminars.find(s => s.id === pid).capacity) {
        assignments[pid].push(username);
        break;
      }
    }
  });
  return assignments;
}

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server bÄ›Å¾Ã­ na http://localhost:${PORT}`); });
