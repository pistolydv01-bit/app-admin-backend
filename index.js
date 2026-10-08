const express = require('express');
const app = express();
app.use(express.json());

// Dynamic Config Database
let appConfig = {
    appName: "My Dynamic App",
    appProfilePic: "https://example.com/logo.png",
    groupLink: "https://t.me/yourgroup",
    announcementMessage: "", // Broadcast Alert Message
    maintenanceMode: false
};

// Users Database
let users = [
    // Example: { id: "1", username: "sandeep", password: "123", isApproved: true, isBlocked: false, lastActive: Date.now() }
];

// ------------------- ADMIN APIs -------------------

// 1. App Configuration अपडेट करें (Name, Profile, Group Link)
app.post('/api/admin/update-config', (req, res) => {
    const { appName, appProfilePic, groupLink, announcementMessage } = req.body;
    if (appName) appConfig.appName = appName;
    if (appProfilePic) appConfig.appProfilePic = appProfilePic;
    if (groupLink) appConfig.groupLink = groupLink;
    if (announcementMessage !== undefined) appConfig.announcementMessage = announcementMessage;
    
    res.json({ success: true, message: "App settings updated!", config: appConfig });
});

// 2. नया यूजर बनाएं या एक्टिवेट/ब्लॉक करें
app.post('/api/admin/manage-user', (req, res) => {
    const { username, password, action } = req.body; // action: 'create', 'block', 'unblock', 'approve'
    
    let user = users.find(u => u.username === username);

    if (action === 'create') {
        if (user) return res.status(400).json({ error: "User already exists" });
        users.push({ username, password, isApproved: true, isBlocked: false, lastActive: Date.now() });
        return res.json({ success: true, message: "User created & activated" });
    }

    if (!user) return res.status(404).json({ error: "User not found" });

    if (action === 'block') user.isBlocked = true;
    if (action === 'unblock') user.isBlocked = false;
    if (action === 'approve') user.isApproved = true;

    res.json({ success: true, message: `User ${action}ed successfully` });
});

// 3. Active Users और Online Count देखें
app.get('/api/admin/active-users', (req, res) => {
    const currentTime = Date.now();
    // 5 मिनट के अंदर एक्टिव रहने वाले यूजर्स
    const onlineUsers = users.filter(u => (currentTime - u.lastActive) < 5 * 60 * 1000 && !u.isBlocked);
    
    res.json({
        totalUsers: users.length,
        onlineCount: onlineUsers.length,
        usersList: users.map(u => ({ username: u.username, isApproved: u.isApproved, isBlocked: u.isBlocked }))
    });
});

// ------------------- APP CLIENT APIs -------------------

// 1. User Login Verification
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ success: false, message: "गलत Username या Password!" });
    }
    if (user.isBlocked) {
        return res.status(403).json({ success: false, message: "आपका अकाउंट ब्लॉक कर दिया गया है।" });
    }
    if (!user.isApproved) {
        return res.status(403).json({ success: false, message: "आपका अकाउंट अभी एक्टिवेट नहीं हुआ है। एडमिन से संपर्क करें।" });
    }

    // Ping Last Active
    user.lastActive = Date.now();

    res.json({
        success: true,
        message: "Login Successful",
        targetWebsiteUrl: "https://yourwebsite.com", // आपकी असली वेबसाइट का लिंक
        config: appConfig
    });
});

// 2. Heartbeat Ping & Config Check (App Background Check)
app.post('/api/heartbeat', (req, res) => {
    const { username } = req.body;
    const user = users.find(u => u.username === username);

    if (!user || user.isBlocked) {
        return res.json({ success: false, isBlocked: true });
    }

    user.lastActive = Date.now();
    res.json({
        success: true,
        isBlocked: false,
        config: appConfig
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
