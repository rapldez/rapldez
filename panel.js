const express = require('express');
const router = express.Router();

router.get('/panel', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Panel Zarządzania Botem</title>
            <style>
                body {
                    background-color: #0b0b0b;
                    color: #ffffff;
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 30px;
                }
                h1 { color: #5865F2; text-align: center; }
                .grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    max-width: 900px;
                    margin: 30px auto;
                }
                .box {
                    background: #161616;
                    border: 1px solid #282828;
                    padding: 20px;
                    border-radius: 8px;
                }
                .box h3 { margin-top: 0; color: #dbdee1; }
            </style>
        </head>
        <body>
            <h1>Panel Zarządzania Botem</h1>
            <p style="text-align: center; color: #949ba4;">Witaj w centrum dowodzenia.</p>
            
            <div class="grid">
                <div class="box">
                    <h3>Status bota</h3>
                    <p>🟢 Online i gotowy do działania</p>
                </div>
                <div class="box">
                    <h3>Anty-Phishing</h3>
                    <p>🛡️ Filtr podejrzanych domen: <b>Aktywny</b></p>
                </div>
                <div class="box">
                    <h3>Ghost Pingi</h3>
                    <p>👻 Logowanie usuniętych pingów: <b>Aktywne</b></p>
                </div>
            </div>
        </body>
        </html>
    `);
});

module.exports = router;