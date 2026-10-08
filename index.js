const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// इन-मेमोरी डेटा स्टोर (डिफ़ॉल्ट सेटिंग्स)
let appConfig = {
    app_status: "active", // "active" या "blocked"
    maintenance_message: "ऐप अभी मेंटेनेंस में है।",
    bg_color: "#FFFFFF",
    thumbnail_url: "https://via.placeholder.com/150",
    notice_link: "https://example.com"
};

// 1. एडमिन पैनल (वेब UI)
app.get('/admin', (req, res) => {
    res.send(`
        <h2>App Control Panel</h2>
        <form action="/admin/update" method="POST">
            <label>App Status (active / blocked):</label><br>
            <input type="text" name="app_status" value="${appConfig.app_status}"><br><br>
            
            <label>Maintenance Message:</label><br>
            <input type="text" name="maintenance_message" value="${appConfig.maintenance_message}"><br><br>
            
            <label>Background Color (Hex code):</label><br>
            <input type="text" name="bg_color" value="${appConfig.bg_color}"><br><br>
            
            <label>Thumbnail Image URL:</label><br>
            <input type="text" name="thumbnail_url" value="${appConfig.thumbnail_url}"><br><br>
            
            <label>Notice / Open Link:</label><br>
            <input type="text" name="notice_link" value="${appConfig.notice_link}"><br><br>
            
            <button type="submit">Save Settings</button>
        </form>
    `);
});

// 2. सेटिंग्स अपडेट करने का एंडपॉइंट
app.post('/admin/update', (req, res) => {
    appConfig.app_status = req.body.app_status || appConfig.app_status;
    appConfig.maintenance_message = req.body.maintenance_message || appConfig.maintenance_message;
    appConfig.bg_color = req.body.bg_color || appConfig.bg_color;
    appConfig.thumbnail_url = req.body.thumbnail_url || appConfig.thumbnail_url;
    appConfig.notice_link = req.body.notice_link || appConfig.notice_link;
    
    res.send('<h3>Settings Updated Successfully!</h3><a href="/admin">Go Back</a>');
});

// 3. APK के लिए API (यह एंडपॉइंट ऐप कॉल करेगा)
app.get('/api/config', (req, res) => {
    res.json(appConfig);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
