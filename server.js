const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());

// Načtení dat z CSV souborů
let seminars = [];
let allowedStudents = [];

function loadCSVData() {
    // Načtení seminářů
    try {
        const seminarsCSV = fs.readFileSync('seminare.csv', 'utf8');
        const lines = seminarsCSV.split('\n').filter(line => line.trim());
        
        // Přeskočit hlavičku (první řádek)
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length >= 4) {
                seminars.push({
                    id: parseInt(parts[0].trim()),
                    name: parts[1].trim(),
                    lecturers: parts[2].trim() ? parts[2].trim().split(';').map(l => l.trim()) : [],
                    capacity: parseInt(parts[3].trim())
                });
            }
        }
        console.log(`Načteno ${seminars.length} seminářů`);
    } catch (err) {
        console.error('Chyba při načítání seminare.csv:', err);
        process.exit(1);
    }

    // Načtení povolených studentů
    try {
        const studentsCSV = fs.readFileSync('allowed_students.csv', 'utf8');
        const lines = studentsCSV.split('\n').filter(line => line.trim());
        
        // Přeskočit hlavičku (první řádek)
        for (let i = 1; i < lines.length; i++) {
            const username = lines[i].trim().toLowerCase();
            if (username) {
                allowedStudents.push(username);
            }
        }
        console.log(`Načteno ${allowedStudents.length} povolených studentů`);
    } catch (err) {
        console.error('Chyba při načítání allowed_students.csv:', err);
        process.exit(1);
    }
}

// Načíst data při startu
loadCSVData();

const ADMIN_PASSWORD = "milujikozeje";

let registrationOpen = true;
const selections = [];
let evaluationResult = null;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/seminars', (_req, res) => res.json({ seminars }));

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body || {};
    if (password === ADMIN_PASSWORD) {
        res.json({ ok: true, secret: 'adminsecret' });
    } else {
        res.status(403).json({ error: 'Nesprávné heslo' });
    }
});

app.post('/api/select', (req, res) => {
    if (!registrationOpen) return res.status(403).json({ error: 'Registrace je uzavřena' });
    
    const { username, priorities } = req.body || {};
    const usernameLower = (username + "").toLowerCase().trim();
    
    if (usernameLower === 'admin') return res.status(403).json({ error: 'Jméno admin je vyhrazeno pro administraci' });
    
    if (!allowedStudents.includes(usernameLower)) {
        return res.status(403).json({ error: 'Toto jméno není na seznamu povolených žáků!' });
    }
    
    if (
        !Array.isArray(priorities) || 
        priorities.length !== 5 ||
        new Set(priorities).size !== 5 ||
        priorities.some(id => !seminars.some(s => s.id === id))
    ) {
        return res.status(400).json({ error: 'Musíš vybrat přesně 5 různých seminářů!' });
    }
    
    const idx = selections.findIndex(u => u.username === usernameLower);
    if (idx >= 0) selections.splice(idx, 1);
    
    selections.push({ username: usernameLower, priorities, timestamp: Date.now() });
    
    res.json({ ok: true, message: 'Tvůj výběr byl úspěšně uložen!' });
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
    evaluationResult = null;
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
    const assignments = {};
    const studentAssignments = {};
    
    seminars.forEach(s => assignments[s.id] = []);
    
    const sorted = [...all].sort((a, b) => a.timestamp - b.timestamp);
    
    sorted.forEach(({ username, priorities }) => {
        let assigned = false;
        for (const pid of priorities) {
            const seminar = seminars.find(s => s.id === pid);
            if (assignments[pid].length < seminar.capacity) {
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
app.listen(PORT, () => { console.log(`Server běží na http://localhost:${PORT}`); });
