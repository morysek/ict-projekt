const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// Data o kurzech
const seminars = [
  { id: 1,  name: "Otevřená laboratoř", lecturers: ["Miroslav Pražienka"], capacity: 20 },
  { id: 2,  name: "Praktická Biologie: od buněk k ekosystémům", lecturers: ["Marek Kasner"], capacity: 20 },
  { id: 3,  name: "Nutritional Anthropology", lecturers: ["Melanie Rada"], capacity: 20 },
  { id: 4,  name: "Southern Gothic Literature – Writings from the Peach State", lecturers: ["Melanie Rada"], capacity: 20 },
  { id: 5,  name: "Seminář vizuální tvorby", lecturers: ["Olga Vršková"], capacity: 20 },
  { id: 6,  name: "Public Speaking and Debate", lecturers: ["Petra Schmalzová"], capacity: 20 },
  { id: 7,  name: "Seminář tvůrčího překladu a tvůrčího psaní", lecturers: ["Petr Fantys", "Marek Šindelka"], capacity: 20 },
  { id: 8,  name: "Antistres – tělo, dýchání, mysl", lecturers: ["Petra Vágnerová", "Petr Knotek"], capacity: 20 },
  { id: 9,  name: "Seminář Zajímavá matematika", lecturers: ["Štěpánka Svobodová"], capacity: 20 },
  { id: 10, name: "Seminář Základy latiny", lecturers: ["Tereza Samková"], capacity: 20 },
  { id: 11, name: "Seminář Úvod do moderní psychologie", lecturers: [], capacity: 20 }
];

// Stav registrací
let registrationOpen = true;

// Uloženy výběry {email, priorities:[id1,id2,id3], timestamp}
const selections = [];

// Statické soubory
app.use(express.static(path.join(__dirname, 'public')));

// API - Získat kurzy + dostupnost
app.get('/api/seminars', (_req, res) => {
  const data = seminars.map(s => {
    const bookedCount = selections.filter(sel => sel.priorities.includes(s.id)).length;
    return {
      id: s.id,
      name: s.name,
      lecturers: s.lecturers,
      capacity: s.capacity,
      remaining: Math.max(0, s.capacity - bookedCount)
    };
  });
  res.json({ seminars: data });
});

// API - Poslat volby
app.post('/api/selections', (req, res) => {
  if(!registrationOpen) {
    return res.status(403).json({ error: 'Registrace je uzavřena' });
  }

  const { email, priorities } = req.body || {};
  if(!email || !priorities || !Array.isArray(priorities) || priorities.length !== 3) {
    return res.status(400).json({ error: 'Neplatný email nebo nedostatečné priority (potřebné 3)' });
  }

  // Validace emailu jednoduchou regex kontrolou
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  if(!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Neplatný formát emailu' });
  }

  // Už má uživatel vybrané?
  const existing = selections.find(sel => sel.email === email);
  if(existing) {
    return res.status(409).json({ error: 'Tento email již má odeslané priority' });
  }

  selections.push({ email, priorities, timestamp: Date.now() });
  res.json({ ok: true, message: 'Priority uloženy' });
});

// API - Admin - data přihlášení
app.get('/api/admin/selections', (req, res) => {
  if(req.query.secret !== 'adminsecret') {
    return res.status(403).json({ error: 'Přístup odepřen' });
  }
  res.json({ selections, registrationOpen });
});

// API - Admin - zavřít přihlašování a vyhodnotit
app.post('/api/admin/close', (req, res) => {
  if(req.query.secret !== 'adminsecret') {
    return res.status(403).json({ error: 'Přístup odepřen' });
  }

  registrationOpen = false;

  // Vyhodnocení: udělejme jednoduché přiřazení podle priority + času
  // Vytvoříme mapu {seminarId: []}
  const result = {};
  seminars.forEach(s => result[s.id] = []);

  // Třídíme výběry podle data a pak podle priorit
  const sortedSelections = [...selections].sort((a,b) => a.timestamp - b.timestamp);

  sortedSelections.forEach(sel => {
    for(let p of sel.priorities) {
      if(result[p].length < seminars.find(s => s.id === p).capacity) {
        result[p].push(sel.email);
        break;
      }
    }
  });

  // Výsledek uložíme pro zobrazení
  app.locals.result = result;

  res.json({ ok: true, message: 'Registrace uzavřena a vyhodnocena' });
});

// API - získat výsledek podle uživatele
app.get('/api/result', (req, res) => {
  const email = req.query.email;
  if(!email) {
    return res.status(400).json({ error: 'Chybí email' });
  }
  const resMap = app.locals.result || {};
  const assigned = Object.entries(resMap).find(([seminarId, emails]) => emails.includes(email));

  res.json({ seminarId: assigned ? Number(assigned[0]) : null });
});


// Vše ostatní na frontend
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server běží na http://localhost:${PORT}`);
});
