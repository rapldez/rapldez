const express = require('express');
const router = express.Router();

// Tutaj możemy w przyszłości zbierać ostatnie logi z bota do wyświetlenia na stronie
let liveLogs = ['[SYSTEM] Panel administracyjny uruchomiony pomyślnie.'];

// Funkcja pomocnicza do dopisywania logów (możemy ją wywoływać z bot.js)
router.addLog = function(text) {
    liveLogs.unshift(`[${new Date().toLocaleTimeString()}] ${text}`);
    if (liveLogs.length > 50) liveLogs.pop(); // Trzymamy maksymalnie 50 ostatnich wpisów
};

router.get('/panel', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Centrum Dowodzenia - Bot</title>
            <style>
                body {
                    background-color: #0b0b0b;
                    color: #ffffff;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0;
                    padding: 20px;
                }
                header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                h1 { color: #5865F2; margin-bottom: 5px; }
                .subtitle { color: #949ba4; font-size: 14px; }
                
                .grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                    max-width: 1100px;
                    margin: 0 auto;
                }
                .card {
                    background: #161616;
                    border: 1px solid #282828;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                }
                .card h3 { margin-top: 0; color: #dbdee1; border-bottom: 1px solid #282828; padding-bottom: 10px; }
                
                /* Styl terminala */
                .terminal {
                    background: #000000;
                    border: 1px solid #222;
                    border-radius: 6px;
                    padding: 12px;
                    height: 180px;
                    overflow-y: auto;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 12px;
                    color: #00ff66;
                    line-height: 1.4;
                }
                
                .status-item {
                    display: flex;
                    justify-content: space-between;
                    margin: 10px 0;
                    font-size: 14px;
                }
                .badge-on { color: #23a55a; font-weight: bold; }
                
                .btn {
                    background: #5865F2;
                    color: white;
                    border: none;
                    padding: 10px 15px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                    width: 100%;
                    margin-top: 10px;
                    transition: background 0.2s;
                }
                .btn:hover { background: #4752C4; }
                .btn-danger { background: #da373c; }
                .btn-danger:hover { background: #a1282c; }
            </style>
        </head>
        <body>
            <header>
                <h1>Centrum Dowodzenia</h1>
                <div class="subtitle">Panel zarządzania botem i bezpieczeństwem serwera</div>
            </header>
            
            <div class="grid">
                <!-- Statusy systemów -->
                <div class="card">
                    <h3>Status Modułów</h3>
                    <div class="status-item"><span>Stan Bota:</span> <span class="badge-on">🟢 Online</span></div>
                    <div class="status-item"><span>Anty-Phishing:</span> <span class="badge-on">🛡️ Aktywny</span></div>
                    <div class="status-item"><span>Ghost Pingi:</span> <span class="badge-on">👻 Aktywne</span></div>
                    <div class="status-item"><span>Baza MongoDB:</span> <span class="badge-on">🔗 Połączono</span></div>
                </div>

                <!-- Szybkie akcje -->
                <div class="card">
                    <h3>Szybkie Akcje</h3>
                    <button class="btn" onclick="alert('Wysyłam testowe powiadomienie...')">Wyślij test logu</button>
                    <button class="btn btn-danger" onclick="alert('Funkcja Awaryjna - wkrótce!')">Przycisk Awaryjny (Nuke)</button>
                </div>

                <!-- Terminal / Logi na żywo -->
                <div class="card" style="grid-column: 1 / -1;">
                    <h3>Terminal / Ostatnie Zdarzenia</h3>
                    <div class="terminal" id="terminal-box">
                        ${liveLogs.map(log => `<div>${log}</div>`).join('')}
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

module.exports = router;
