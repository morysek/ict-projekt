const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());

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

let registrationOpen = true;
// username = "prijmeni.jmeno"
const selections = [];
let evaluationResult = {};

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/seminars', (_req, res) => {
  res.json({ seminars });
});

// Získání všech přihlášek a stavu pro admina
app.get('/api/admin/selections', (req, res) => {
  if(req.query.secret !== 'adminsecret') return res.status(403).json({ error: 'Přístup odepřen' });
  res.json({ selections, registrationOpen, evaluationResult });
});

app.post('/api/admin/evaluate', (req, res) => {
  if(req.query.secret !== 'adminsecret') return res.status(403).json({ error: 'Přístup odepřen' });
  registrationOpen = false;
  evaluationResult = evaluateAssignments(selections, seminars);
  res.json({ ok: true, message: 'Registrace uzavřena a přiřazeno.' });
});

// Přihlášení a nová přihláška/úprava (username: prijmeni.jmeno)
app.post('/api/select', (req, res) => {
  if(!registrationOpen) return res.status(403).json({ error: 'Registrace je uzavřena' });
  const { username, priorities } = req.body || {};
  const unameRegex = /^[a-záčďéěíňóřšťúůýž]+\.[a-záčďéěíňóřšťúůýž]+$/i;
  if((username+"").toLowerCase() === "admin") return res.status(403).json({ error: 'Admin se takto nepřihlašuje.' });
  if(!username || !unameRegex.test(username)) return res.status(400).json({ error: 'Špatný formát uživatelského jména, použij prijmeni.jmeno' });

  if(!Array.isArray(priorities) || priorities.length !== 3) return res.status(400).json({ error: 'Musíš vybrat 3 různé semináře!' });

  for(let i=0; i<3; ++i){
    if(!seminars.some(s=>s.id===priorities[i])) return res.status(400).json({ error: 'Neplatné ID semináře!' });
    if(priorities.filter(x=>x===priorities[i]).length >1) return res.status(400).json({ error: 'Semináře se nesmí opakovat!' });
  }

  // Smazat starý výběr tohoto uživatele
  const idx = selections.findIndex(u=>u.username===username);
  if(idx>=0) selections.splice(idx,1);

  // Zapsat nový s časem
  selections.push({ username, priorities, timestamp: Date.now() });
  res.json({ ok: true, message: 'Výběr uložen, děkujeme.' });
});

// Získání výsledku pro uživatele po přihlášení
app.get('/api/result', (req,res)=>{
  const { username } = req.query;
  if(!username) return res.status(400).json({ error: "Chybí username" });
  // Pokud vyhodnoceno, zjisti kam byl přiřazen
  if(Object.keys(evaluationResult).length) {
    const val = Object.entries(evaluationResult).find(([seminarId, users]) => users.includes(username));
    return res.json({ seminarId: val ? Number(val[0]) : null });
  }
  res.json({ seminarId: null });
});

// Základní evaluace podle priorit a timestamp
function evaluateAssignments(users, seminars){
  const result = {};
  seminars.forEach(s=>result[s.id]=[]);
  const sorted = [...users].sort((a,b)=>a.timestamp-b.timestamp);

  sorted.forEach(sel => {
    for(const preferred of sel.priorities){
      if(result[preferred].length < seminars.find(s=>s.id===preferred).capacity){
        result[preferred].push(sel.username);
        break;
      }
    }
  });
  return result;
}

// Frontend fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => { console.log(`Server běží na http://localhost:${PORT}`); });
