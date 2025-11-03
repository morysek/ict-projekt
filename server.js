const express = require('express');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Konfigurace PostgreSQL databáze
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Inicializace databázových tabulek
async function initDatabase() {
  try {
    // Tabulka pro semináře
    await pool.query(`
      CREATE TABLE IF NOT EXISTS seminars (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        lecturers TEXT[],
        capacity INTEGER NOT NULL
      )
    `);
    
    // Tabulka pro povolené studenty
    await pool.query(`
      CREATE TABLE IF NOT EXISTS allowed_students (
        username TEXT PRIMARY KEY
      )
    `);
    
    // Tabulka pro výběry studentů
    await pool.query(`
      CREATE TABLE IF NOT EXISTS selections (
        username TEXT PRIMARY KEY,
        priorities INTEGER[],
        timestamp BIGINT NOT NULL
      )
    `);
    
    // Tabulka pro nastavení
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    
    // Inicializovat registrationOpen pokud neexistuje
    await pool.query(`
      INSERT INTO settings (key, value) 
      VALUES ('registrationOpen', 'true')
      ON CONFLICT (key) DO NOTHING
    `);
    
    console.log('Databáze inicializována');
  } catch (err) {
    console.error('Chyba při inicializaci databáze:', err);
    process.exit(1);
  }
}

initDatabase();

// Konfigurace Multer pro upload souborů (do paměti)
const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Pouze CSV soubory jsou povoleny!'));
    }
  }
});

const ADMIN_PASSWORD = "milujikozeje";

app.use(express.static(path.join(__dirname, 'public')));

// API: Získat semináře
app.get('/api/seminars', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM seminars ORDER BY id');
    res.json({ seminars: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Chyba při načítání seminářů' });
  }
});

// API: Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    res.json({ ok: true, secret: 'adminsecret' });
  } else {
    res.status(403).json({ error: 'Nesprávné heslo' });
  }
});

// API: Upload CSV souborů studentů
app.post('/api/admin/upload-students', upload.single('file'), async (req, res) => {
  if (req.query.secret !== 'adminsecret') {
    return res.status(403).json({ error: 'Přístup odepřen' });
  }
  
  try {
    const csvContent = req.file.buffer.toString('utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Smazat staré záznamy
    await pool.query('DELETE FROM allowed_students');
    
    // Přeskočit hlavičku a přidat studenty
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
      const username = lines[i].trim().toLowerCase();
      if (username) {
        await pool.query(
          'INSERT INTO allowed_students (username) VALUES ($1) ON CONFLICT DO NOTHING',
          [username]
        );
        count++;
      }
    }
    
    res.json({ ok: true, message: `Nahráno ${count} studentů` });
  } catch (err) {
    console.error('Chyba při nahrávání studentů:', err);
    res.status(500).json({ error: 'Chyba při nahrávání studentů' });
  }
});

// API: Upload CSV souborů seminářů
app.post('/api/admin/upload-seminars', upload.single('file'), async (req, res) => {
  if (req.query.secret !== 'adminsecret') {
    return res.status(403).json({ error: 'Přístup odepřen' });
  }
  
  try {
    const csvContent = req.file.buffer.toString('utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Smazat staré záznamy
    await pool.query('DELETE FROM seminars');
    
    // Přeskočit hlavičku a přidat semináře
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 4) {
        const id = parseInt(parts[0].trim());
        const name = parts[1].trim();
        const lecturers = parts[2].trim() ? parts[2].trim().split(';').map(l => l.trim()) : [];
        const capacity = parseInt(parts[3].trim());
        
        await pool.query(
          'INSERT INTO seminars (id, name, lecturers, capacity) VALUES ($1, $2, $3, $4)',
          [id, name, lecturers, capacity]
        );
        count++;
      }
    }
    
    res.json({ ok: true, message: `Nahráno ${count} seminářů` });
  } catch (err) {
    console.error('Chyba při nahrávání seminářů:', err);
    res.status(500).json({ error: 'Chyba při nahrávání seminářů' });
  }
});

// API: Výběr seminářů studentem
app.post('/api/select', async (req, res) => {
  try {
    // Zjistit stav registrace
    const settingsResult = await pool.query(
      "SELECT value FROM settings WHERE key = 'registrationOpen'"
    );
    const registrationOpen = settingsResult.rows[0]?.value === 'true';
    
    if (!registrationOpen) {
      return res.status(403).json({ error: 'Registrace je uzavřena' });
    }
    
    const { username, priorities } = req.body || {};
    const usernameLower = (username + "").toLowerCase().trim();
    
    if (usernameLower === 'admin') {
      return res.status(403).json({ error: 'Jméno admin je vyhrazeno pro administraci' });
    }
    
    // Kontrola povolených studentů
    const studentCheck = await pool.query(
      'SELECT * FROM allowed_students WHERE username = $1',
      [usernameLower]
    );
    
    if (studentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Toto jméno není na seznamu povolených žáků!' });
    }
    
    // Validace priorit
    const seminarsResult = await pool.query('SELECT id FROM seminars');
    const validIds = seminarsResult.rows.map(s => s.id);
    
    if (
      !Array.isArray(priorities) ||
      priorities.length !== 5 ||
      new Set(priorities).size !== 5 ||
      priorities.some(id => !validIds.includes(id))
    ) {
      return res.status(400).json({ error: 'Musíš vybrat přesně 5 různých seminářů!' });
    }
    
    // Uložit výběr
    await pool.query(
      `INSERT INTO selections (username, priorities, timestamp) 
       VALUES ($1, $2, $3)
       ON CONFLICT (username) 
       DO UPDATE SET priorities = $2, timestamp = $3`,
      [usernameLower, priorities, Date.now()]
    );
    
    res.json({ ok: true, message: 'Tvůj výběr byl úspěšně uložen!' });
  } catch (err) {
    console.error('Chyba při ukládání výběru:', err);
    res.status(500).json({ error: 'Chyba při ukládání výběru' });
  }
});

// API: Získat přihlášky a výsledky (admin)
app.get('/api/admin/selections', async (req, res) => {
  if (req.query.secret !== 'adminsecret') {
    return res.status(403).json({ error: 'Přístup odepřen' });
  }
  
  try {
    const selectionsResult = await pool.query(
      'SELECT username, priorities, timestamp FROM selections ORDER BY timestamp'
    );
    
    const settingsResult = await pool.query(
      "SELECT value FROM settings WHERE key = 'registrationOpen'"
    );
    const registrationOpen = settingsResult.rows[0]?.value === 'true';
    
    const evaluationResult = await pool.query(
      "SELECT value FROM settings WHERE key = 'evaluationResult'"
    );
    const evaluation = evaluationResult.rows[0]?.value 
      ? JSON.parse(evaluationResult.rows[0].value) 
      : null;
    
    res.json({ 
      selections: selectionsResult.rows, 
      registrationOpen,
      evaluationResult: evaluation
    });
  } catch (err) {
    console.error('Chyba při načítání přihlášek:', err);
    res.status(500).json({ error: 'Chyba při načítání přihlášek' });
  }
});

// API: Vyhodnotit registraci (admin)
app.post('/api/admin/evaluate', async (req, res) => {
  if (req.query.secret !== 'adminsecret') {
    return res.status(403).json({ error: 'Přístup odepřen' });
  }
  
  try {
    // Uzavřít registraci
    await pool.query(
      "UPDATE settings SET value = 'false' WHERE key = 'registrationOpen'"
    );
    
    // Načíst data pro vyhodnocení
    const selectionsResult = await pool.query(
      'SELECT username, priorities, timestamp FROM selections ORDER BY timestamp'
    );
    const seminarsResult = await pool.query('SELECT * FROM seminars');
    
    const evaluationResult = assignSeminars(
      selectionsResult.rows, 
      seminarsResult.rows
    );
    
    // Uložit výsledek
    await pool.query(
      `INSERT INTO settings (key, value) 
       VALUES ('evaluationResult', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [JSON.stringify(evaluationResult)]
    );
    
    res.json({ ok: true, message: 'Registrace uzavřena a vyhodnocena.' });
  } catch (err) {
    console.error('Chyba při vyhodnocení:', err);
    res.status(500).json({ error: 'Chyba při vyhodnocení' });
  }
});

// API: Znovu otevřít registraci (admin)
app.post('/api/admin/reopen', async (req, res) => {
  if (req.query.secret !== 'adminsecret') {
    return res.status(403).json({ error: 'Přístup odepřen' });
  }
  
  try {
    await pool.query(
      "UPDATE settings SET value = 'true' WHERE key = 'registrationOpen'"
    );
    await pool.query(
      "DELETE FROM settings WHERE key = 'evaluationResult'"
    );
    
    res.json({ ok: true, message: 'Registrace znovu otevřena.' });
  } catch (err) {
    console.error('Chyba při otevření registrace:', err);
    res.status(500).json({ error: 'Chyba při otevření registrace' });
  }
});

// API: Smazat přihlášku (admin)
app.post('/api/admin/delete', async (req, res) => {
  if (req.query.secret !== 'adminsecret') {
    return res.status(403).json({ error: 'Přístup odepřen' });
  }
  
  try {
    const { username } = req.body || {};
    const result = await pool.query(
      'DELETE FROM selections WHERE username = $1',
      [username]
    );
    
    if (result.rowCount > 0) {
      res.json({ ok: true, message: 'Přihláška smazána.' });
    } else {
      res.status(404).json({ error: 'Uživatel nenalezen.' });
    }
  } catch (err) {
    console.error('Chyba při mazání přihlášky:', err);
    res.status(500).json({ error: 'Chyba při mazání přihlášky' });
  }
});

// Funkce pro přiřazení seminářů
function assignSeminars(all, seminars) {
  const assignments = {};
  const studentAssignments = {};
  
  seminars.forEach(s => assignments[s.id] = []);
  
  const sorted = [...all].sort((a, b) => a.timestamp - b.timestamp);
  
  sorted.forEach(({ username, priorities }) => {
    let assigned = false;
    for (const pid of priorities) {
      const seminar = seminars.find(s => s.id === pid);
      if (seminar && assignments[pid].length < seminar.capacity) {
        assignments[pid].push(username);
        studentAssignments[username] = pid;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      studentAssignments[username] = null;
    }
  });
  
  return { assignments, studentAssignments };
}

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { 
  console.log(`Server běží na http://localhost:${PORT}`); 
});
