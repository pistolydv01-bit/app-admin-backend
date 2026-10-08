const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SQLite Database Setup
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error("Database connection error:", err.message);
    else console.log("Connected to SQLite Database.");
});

// Database Tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY, username TEXT, password TEXT)`);
    
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        device_id TEXT DEFAULT '',
        status TEXT DEFAULT 'active'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT UNIQUE, value TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS pages (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content_url TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS broadcasts (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

    db.run(`INSERT OR IGNORE INTO admin (id, username, password) VALUES (1, 'admin', 'admin123')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('youtube_url', 'https://www.youtube.com')`);
});

// Serve Admin Panel HTML
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ---------------------- APP APIS ----------------------

app.post('/api/login', (req, res) => {
    const { username, password, device_id } = req.body;
    db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, row) => {
        if (err || !row) return res.send("invalid");
        if (row.status === 'blocked') return res.send("blocked");

        db.run(`UPDATE users SET device_id = ? WHERE id = ?`, [device_id || 'unknown', row.id]);
        res.send("success");
    });
});

app.get('/api/get-link', (req, res) => {
    db.get(`SELECT value FROM settings WHERE key = 'youtube_url'`, (err, row) => {
        res.send(row ? row.value : "https://www.youtube.com");
    });
});

app.get('/api/get-broadcast', (req, res) => {
    db.get(`SELECT message FROM broadcasts ORDER BY id DESC LIMIT 1`, (err, row) => {
        res.send(row ? row.message : "No message");
    });
});

app.get('/api/get-pages', (req, res) => {
    db.all(`SELECT * FROM pages`, (err, rows) => {
        res.json(rows || []);
    });
});

// ---------------------- ADMIN APIS ----------------------

app.post('/api/admin/create-user', (req, res) => {
    const { username, password } = req.body;
    db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, password], function(err) {
        if (err) return res.json({ success: false, message: "Username pehle se maujood hai!" });
        res.json({ success: true, message: "User Successfully Ban Gaya!" });
    });
});

app.get('/api/admin/get-users', (req, res) => {
    db.all(`SELECT id, username, device_id, status FROM users`, (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/admin/update-status', (req, res) => {
    const { id, status } = req.body;
    db.run(`UPDATE users SET status = ? WHERE id = ?`, [status, id], () => {
        res.json({ success: true, message: "Status Updated" });
    });
});

app.post('/api/update-link', (req, res) => {
    const { url } = req.body;
    db.run(`UPDATE settings SET value = ? WHERE key = 'youtube_url'`, [url], () => {
        res.json({ success: true, message: "YouTube Link Updated!" });
    });
});

app.post('/api/admin/broadcast', (req, res) => {
    const { message } = req.body;
    db.run(`INSERT INTO broadcasts (message) VALUES (?)`, [message], () => {
        res.json({ success: true, message: "Broadcast Sent Successfully!" });
    });
});

app.post('/api/admin/add-page', (req, res) => {
    const { title, content_url } = req.body;
    db.run(`INSERT INTO pages (title, content_url) VALUES (?, ?)`, [title, content_url], () => {
        res.json({ success: true, message: "New Page Added Successfully!" });
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
