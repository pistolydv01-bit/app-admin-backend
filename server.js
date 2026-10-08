const express = require('express');
const sqlite3 = require('sqlite3').verbose();

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
    // Admin credentials
    db.run(`CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY, username TEXT, password TEXT)`);
    
    // App Users (Created by Admin)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        device_id TEXT DEFAULT '',
        status TEXT DEFAULT 'active'
    )`);

    // App Settings (YouTube link, etc.)
    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT UNIQUE, value TEXT)`);

    // Custom Pages / Features
    db.run(`CREATE TABLE IF NOT EXISTS pages (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content_url TEXT)`);

    // Broadcast messages
    db.run(`CREATE TABLE IF NOT EXISTS broadcasts (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

    // Default Entries
    db.run(`INSERT OR IGNORE INTO admin (id, username, password) VALUES (1, 'admin', 'admin123')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('youtube_url', 'https://www.youtube.com')`);
});

// ---------------------- ADMIN PANEL UI ----------------------
app.get('/admin', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="hi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Control Hub Admin Panel</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
            .container { max-width: 900px; margin: 0 auto; }
            h1 { text-align: center; color: #38bdf8; margin-bottom: 30px; }
            .card { background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5); }
            h2 { color: #f43f5e; margin-top: 0; font-size: 18px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
            label { display: block; margin: 10px 0 5px; font-weight: bold; color: #cbd5e1; }
            input, select { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; box-sizing: border-box; }
            button { background: #0284c7; color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 10px; }
            button:hover { background: #0369a1; }
            .btn-danger { background: #e11d48; }
            .btn-danger:hover { background: #be123c; }
            .btn-success { background: #16a34a; }
            .btn-success:hover { background: #15803d; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 10px; border: 1px solid #334155; text-align: left; }
            th { background: #334155; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Master Admin Dashboard</h1>

            <!-- 1. Add New App User -->
            <div class="card">
                <h2>👤 1. Naya User Banaye (Create App User)</h2>
                <input type="text" id="newUsername" placeholder="User ka Username">
                <input type="text" id="newPassword" placeholder="User ka Password" style="margin-top:8px;">
                <button onclick="createUser()" class="btn-success">User Add Kare</button>
            </div>

            <!-- 2. Manage / Block Users & Devices -->
            <div class="card">
                <h2>🚫 2. Users & Device Block/Unblock System</h2>
                <button onclick="loadUsers()">Users Reload Kare</button>
                <table id="usersTable">
                    <thead>
                        <tr><th>Username</th><th>Device ID</th><th>Status</th><th>Action</th></tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>

            <!-- 3. Update Redirect / YouTube URL -->
            <div class="card">
                <h2>🔗 3. YouTube / App Redirect Link</h2>
                <input type="text" id="ytUrl" placeholder="https://youtube.com/...">
                <button onclick="updateLink()">Save YouTube Link</button>
            </div>

            <!-- 4. Send Broadcast Message -->
            <div class="card">
                <h2>📢 4. Send Broadcast Notification</h2>
                <input type="text" id="broadcastMsg" placeholder="Sabhi App Users ko Message Bheje...">
                <button onclick="sendBroadcast()" style="background: #8b5cf6;">Send Broadcast</button>
            </div>

            <!-- 5. Add Dynamic Pages -->
            <div class="card">
                <h2>📄 5. Add Custom Dynamic Page/Link</h2>
                <input type="text" id="pageTitle" placeholder="Page Title (e.g., Update Link / Help)">
                <input type="text" id="pageUrl" placeholder="Page URL / Content Link" style="margin-top:8px;">
                <button onclick="addPage()">Add New Page</button>
            </div>
        </div>

        <script>
            // Create User
            async function createUser() {
                let u = document.getElementById('newUsername').value;
                let p = document.getElementById('newPassword').value;
                if(!u || !p) return alert("Username aur Password dono bhare!");
                let res = await fetch('/api/admin/create-user', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({username: u, password: p})
                });
                let data = await res.json();
                alert(data.message);
                loadUsers();
            }

            // Load Users
            async function loadUsers() {
                let res = await fetch('/api/admin/get-users');
                let users = await res.json();
                let tbody = document.querySelector('#usersTable tbody');
                tbody.innerHTML = '';
                users.forEach(u => {
                    let btn = u.status === 'active' 
                        ? `<button class="btn-danger" onclick="toggleStatus(${u.id}, 'blocked')">Block</button>`
                        : `<button class="btn-success" onclick="toggleStatus(${u.id}, 'active')">Unblock</button>`;
                    tbody.innerHTML += \`<tr>
                        <td>\${u.username}</td>
                        <td>\${u.device_id || 'Not Logged In'}</td>
                        <td><b>\${u.status.toUpperCase()}</b></td>
                        <td>\${btn}</td>
                    </tr>\`;
                });
            }

            // Block / Unblock User
            async function toggleStatus(id, status) {
                await fetch('/api/admin/update-status', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({id, status})
                });
                loadUsers();
            }

            // Update Link
            async function updateLink() {
                let url = document.getElementById('ytUrl').value;
                let res = await fetch('/api/update-link', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({url})
                });
                let data = await res.json();
                alert(data.message);
            }

            // Send Broadcast
            async function sendBroadcast() {
                let msg = document.getElementById('broadcastMsg').value;
                let res = await fetch('/api/admin/broadcast', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({message: msg})
                });
                let data = await res.json();
                alert(data.message);
            }

            // Add Page
            async function addPage() {
                let title = document.getElementById('pageTitle').value;
                let content_url = document.getElementById('pageUrl').value;
                let res = await fetch('/api/admin/add-page', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({title, content_url})
                });
                let data = await res.json();
                alert(data.message);
            }

            loadUsers();
        </script>
    </body>
    </html>
    `);
});

// ---------------------- APP APIS ----------------------

// 1. App Login API (Validates User, Checks Block Status & Device ID)
app.post('/api/login', (req, res) => {
    const { username, password, device_id } = req.body;
    db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, row) => {
        if (err || !row) return res.send("invalid");
        if (row.status === 'blocked') return res.send("blocked");

        // Save or update device ID
        db.run(`UPDATE users SET device_id = ? WHERE id = ?`, [device_id || 'unknown', row.id]);
        res.send("success");
    });
});

// 2. Get YouTube Redirect Link API
app.get('/api/get-link', (req, res) => {
    db.get(`SELECT value FROM settings WHERE key = 'youtube_url'`, (err, row) => {
        res.send(row ? row.value : "https://www.youtube.com");
    });
});

// 3. Get Broadcast Messages for App
app.get('/api/get-broadcast', (req, res) => {
    db.get(`SELECT message FROM broadcasts ORDER BY id DESC LIMIT 1`, (err, row) => {
        res.send(row ? row.message : "No message");
    });
});

// 4. Get Custom Pages/Links for App
app.get('/api/get-pages', (req, res) => {
    db.all(`SELECT * FROM pages`, (err, rows) => {
        res.json(rows || []);
    });
});

// ---------------------- ADMIN APIS ----------------------
app.post('/api/admin/create-user', (req, res) => {
    const { username, password } = req.body;
    db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, password], function(err) {
        if (err) return res.json({ success: false, message: "Username pehle se मौजूद hai!" });
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
