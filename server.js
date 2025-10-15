const express = require('express');
const path = require('path');

const app = express();

// Data o kurzech a vyučujících
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

// Seznam již vybrané (uložené) volby
const selections = [];

// Statické soubory v adresáři public
app.use(express.static(path.join(__dirname, 'public')));

// API: seznam kurzů s dostupností
app.get('/api/seminars', (req, res) => {
  const data = seminars.map(s => {
    const taken = selections.filter(x => x.seminarId === s.id).length;
    return {
      id: s.id,
      name: s.name,
      lecturers: s.lecturers,
      capacity: s.capacity,
      remaining: Math.max(0, s.capacity - taken)
    };
  });
  res.json({ seminars: data });
});

// API: uložit volbu
app.post('/api/selections', (req, res) => {
  const { studentId, seminarId } = req.body || {};

  if (!studentId || !seminarId) {
    return res.status(400).json({ error: 'Chybí studentId nebo seminarId' });
  }

  const s = seminars.find(s => s.id === Number(seminarId));
  if (!s) {
    return res.status(404).json({ error: 'Kurz neexistuje' });
  }

  // Kontrola, zda student již volbu neprovedl
  if (selections.some(x => x.studentId === String(studentId) && x.seminarId === s.id)) {
    return res.json({ ok: true, message: 'Volba již existuje' });
  }

  // Kontrola kapacity
  const booked = selections.filter(x => x.seminarId === s.id).length;
  if (booked >= s.capacity) {
    return res.status(409).json({ error: 'Kapacita je plná' });
  }

  // Uložit volbu
  selections.push({ studentId: String(studentId), seminarId: s.id });
  res.status(201).json({ ok: true, message: 'Volba uložena' });
});

// Přesměrování všeho na index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server běží na http://localhost:${PORT}`);
});
