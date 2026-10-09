const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let firebaseAdmin = null;
try {
    firebaseAdmin = require('firebase-admin');
} catch (_) {
    console.log("firebase-admin not installed; Broadcast will use database polling only.");
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error("Database connection error:", err.message);
    else console.log("Connected to SQLite Database.");
});

if (firebaseAdmin && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin / FCM enabled.");
    } catch (e) {
        console.error("FCM setup failed:", e.message);
    }
}

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS admin (
        id INTEGER PRIMARY KEY,
        username TEXT,
        password TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        name TEXT DEFAULT '',
        mobile TEXT DEFAULT '',
        email TEXT DEFAULT '',
        device_id TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT UNIQUE,
        value TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content_url TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS broadcasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    const migrations = [
        "ALTER TABLE users ADD COLUMN name TEXT DEFAULT ''",
        "ALTER TABLE users ADD COLUMN mobile TEXT DEFAULT ''",
        "ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''",
        "ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE users ADD COLUMN last_login DATETIME"
    ];
    migrations.forEach(sql => db.run(sql, () => {}));

    db.run(`INSERT OR IGNORE INTO admin (id, username, password)
            VALUES (1, 'admin', 'admin123')`);

    db.run(`INSERT OR IGNORE INTO settings (key, value)
            VALUES ('youtube_url', 'https://www.youtube.com')`);

    db.run(`INSERT OR IGNORE INTO settings (key, value)
            VALUES ('maintenance_mode', 'off')`);
});

function getSetting(key, fallback = '') {
    return new Promise((resolve) => {
        db.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => {
            resolve(!err && row ? row.value : fallback);
        });
    });
}

function setSetting(key, value) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO settings(key, value) VALUES(?, ?)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
            [key, value],
            (err) => err ? reject(err) : resolve()
        );
    });
}

// Health Check / Keep-Alive Routes for Render
app.get('/', (req, res) => {
    res.status(200).send("OK - Server is Running");
});

app.get('/health', (req, res) => {
    res.status(200).send("OK");
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ---------------------- APP APIS ----------------------

app.post('/api/signup', (req, res) => {
    const { username, password, name, mobile, email, device_id } = req.body;

    if (!username || !password || !name || !mobile) {
        return res.json({
            success: false,
            status: "missing",
            message: "Name, Mobile, Username aur Password zaroori hain."
        });
    }

    db.run(
        `INSERT INTO users
        (username, password, name, mobile, email, device_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [
            String(username).trim(),
            String(password),
            String(name).trim(),
            String(mobile).trim(),
            String(email || '').trim(),
            String(device_id || '').trim()
        ],
        function(err) {
            if (err) {
                return res.json({
                    success: false,
                    status: "exists",
                    message: "Username pehle se registered hai."
                });
            }

            res.json({
                success: true,
                status: "pending",
                message: "Registration submit ho gaya. Admin approval ka wait karein."
            });
        }
    );
});

app.post('/api/login', async (req, res) => {
    const { username, password, device_id } = req.body;

    const maintenance = await getSetting('maintenance_mode', 'off');
    if (maintenance === 'on') {
        return res.send("maintenance");
    }

    db.get(
        `SELECT * FROM users WHERE username = ? AND password = ?`,
        [username, password],
        (err, row) => {
            if (err || !row) return res.send("invalid");

            if (row.status === 'pending') return res.send("pending");
            if (row.status === 'blocked') return res.send("blocked");
            if (row.status !== 'active') return res.send("invalid");

            db.run(
                `UPDATE users SET device_id = ?, last_login = CURRENT_TIMESTAMP WHERE id = ?`,
                [device_id || 'unknown', row.id]
            );

            res.send("success");
        }
    );
});

app.get('/api/get-maintenance', async (req, res) => {
    const mode = await getSetting('maintenance_mode', 'off');
    res.json({ maintenance: mode === 'on' });
});

app.get('/api/get-link', (req, res) => {
    db.get(`SELECT value FROM settings WHERE key = 'youtube_url'`, (err, row) => {
        res.send(row ? row.value : "https://www.youtube.com");
    });
});

app.get('/api/get-broadcast', (req, res) => {
    db.get(
        `SELECT message FROM broadcasts ORDER BY id DESC LIMIT 1`,
        (err, row) => res.send(row ? row.message : "No message")
    );
});

app.get('/api/get-pages', (req, res) => {
    db.all(`SELECT * FROM pages ORDER BY id DESC`, (err, rows) => {
        res.json(rows || []);
    });
});

// ---------------------- ADMIN APIS ----------------------

app.post('/api/admin/create-user', (req, res) => {
    const { username, password, name, mobile, email } = req.body;

    if (!username || !password) {
        return res.json({ success: false, message: "Username aur Password zaroori hain." });
    }

    db.run(
        `INSERT INTO users
        (username, password, name, mobile, email, status)
        VALUES (?, ?, ?, ?, ?, 'active')`,
        [username, password, name || '', mobile || '', email || ''],
        function(err) {
            if (err) {
                return res.json({
                    success: false,
                    message: "Username pehle se maujood hai!"
                });
            }
            res.json({
                success: true,
                message: "Active user successfully ban gaya!"
            });
        }
    );
});

app.get('/api/admin/get-users', (req, res) => {
    db.all(
        `SELECT id, username, name, mobile, email, device_id, status,
                created_at, last_login
         FROM users ORDER BY id DESC`,
        (err, rows) => res.json(rows || [])
    );
});

app.post('/api/admin/update-status', (req, res) => {
    const { id, status } = req.body;
    const allowed = ['pending', 'active', 'blocked'];

    if (!allowed.includes(status)) {
        return res.json({ success: false, message: "Invalid status." });
    }

    db.run(
        `UPDATE users SET status = ? WHERE id = ?`,
        [status, id],
        function(err) {
            if (err) {
                return res.json({ success: false, message: "Status update failed." });
            }
            res.json({ success: true, message: "Status Updated" });
        }
    );
});

app.get('/api/admin/stats', (req, res) => {
    db.get(
        `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END) AS blocked
         FROM users`,
        (err, row) => res.json(row || { total: 0, pending: 0, active: 0, blocked: 0 })
    );
});

app.get('/api/admin/maintenance', async (req, res) => {
    const mode = await getSetting('maintenance_mode', 'off');
    res.json({ enabled: mode === 'on' });
});

app.post('/api/admin/maintenance', async (req, res) => {
    const enabled = !!req.body.enabled;
    try {
        await setSetting('maintenance_mode', enabled ? 'on' : 'off');
        res.json({
            success: true,
            enabled,
            message: enabled ? "Maintenance Mode ON" : "Maintenance Mode OFF"
        });
    } catch (e) {
        res.json({ success: false, message: "Maintenance update failed." });
    }
});

app.post('/api/update-link', (req, res) => {
    const { url } = req.body;
    if (!url) return res.json({ success: false, message: "URL required." });

    db.run(
        `UPDATE settings SET value = ? WHERE key = 'youtube_url'`,
        [url],
        (err) => {
            if (err) return res.json({ success: false, message: "Link update failed." });
            res.json({ success: true, message: "Redirect Link Updated!" });
        }
    );
});

app.post('/api/admin/broadcast', async (req, res) => {
    const message = String(req.body.message || '').trim();

    if (!message) {
        return res.json({ success: false, message: "Broadcast message likhiye." });
    }

    db.run(
        `INSERT INTO broadcasts (message) VALUES (?)`,
        [message],
        async function(err) {
            if (err) {
                return res.json({
                    success: false,
                    message: "Broadcast save nahi hua."
                });
            }

            if (firebaseAdmin && firebaseAdmin.apps.length) {
                try {
                    await firebaseAdmin.messaging().send({
                        topic: 'all-users',
                        notification: {
                            title: 'Admin Message',
                            body: message
                        },
                        data: {
                            type: 'broadcast'
                        }
                    });

                    return res.json({
                        success: true,
                        push_sent: true,
                        message: "Broadcast saved + phone notification sent."
                    });
                } catch (e) {
                    console.error("FCM broadcast error:", e.message);
                    return res.json({
                        success: true,
                        push_sent: false,
                        message: "Broadcast save ho gaya, lekin FCM notification nahi gaya. Firebase setup check karein."
                    });
                }
            }

            res.json({
                success: true,
                push_sent: false,
                message: "Broadcast save ho gaya. FCM setup hone ke baad phone notification bhi jayega."
            });
        }
    );
});

app.post('/api/admin/add-page', (req, res) => {
    const { title, content_url } = req.body;

    if (!title || !content_url) {
        return res.json({ success: false, message: "Title aur URL dono chahiye." });
    }

    db.run(
        `INSERT INTO pages (title, content_url) VALUES (?, ?)`,
        [title, content_url],
        (err) => {
            if (err) return res.json({ success: false, message: "Page add failed." });
            res.json({ success: true, message: "New Page Added Successfully!" });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
