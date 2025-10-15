// server.js
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// Kurzy s kapacitou 20 a sjednocenými vyučujícími (pole stringů)
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

// Uložené volby v paměti
const selections = [];

// Statické soubory (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// API: seznam seminářů s počtem zbývajících míst
app.get('/api/seminars', (_req, res) => {
  const payload = seminars.map(s => {
    const taken = selections.filter(x => x.seminarId === s.id).length;
    return {
      id: s.id,
      name: s.name,
      lecturers: s.lecturers,
      capacity: s.capacity,
      remaining: Math.max(0, s.capacity - taken)
    };
  });
  res.json({ seminars: payload });
});

// API: odeslání volby studenta
app.post('/api/selections', (req, res) => {
  const { studentId, seminarId } = req.body || {};

  if (!studentId || !seminarId) {
    return res.status(400).json({ error: 'Chybí studentId nebo seminarId' });
  }
  const sem = seminars.find(s => s.id === Number(seminarId));
  if (!sem) {
    return res.status(404).json({ error: 'Seminář neexistuje' });
  }

  // Už má student tuto volbu?
  const already = selections.find(
    (x) => String(x.studentId) === String(studentId) && x.seminarId === sem.id
  );
  if (already) {
    return res.status(200).json({ ok: true, message: 'Volba už je uložena' });
  }

  // Kapacita
  const taken = selections.filter(x => x.seminarId === sem.id).length;
  if (taken >= sem.capacity) {
    return res.status(409).json({ error: 'Kapacita plná' });
  }

  selections.push({ studentId: String(studentId), seminarId: sem.id });
  return res.status(201).json({ ok: true, message: 'Volba uložena' });
});

// SPA fallback na index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server běží na http://localhost:${PORT}`);
});
