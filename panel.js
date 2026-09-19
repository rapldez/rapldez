const express = require('express');
const router = express.Router();

// Tablica na logi z bota
let liveLogs = ['[SYSTEM] Panel administracyjny oraz terminal uruchomione pomyślnie.'];

// Funkcja do dopisywania logów z bota (możesz ją importować lub wywoływać w bot.js)
router.addLog = function(text) {
    liveLogs.unshift(`[${new Date().toLocaleTimeString()}] ${text}`);
    if (liveLogs.length > 100) liveLogs.pop(); // Trzymamy do 100 ostatnich wpisów
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
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
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
                
                /* Terminal */
                .terminal-container {
                    grid-column: 1 / -1;
                }
                .terminal {
                    background: #000000;
                    border: 1px solid #222;
                    border-radius: 6px;
                    padding: 15px;
                    height: 250px;
                    overflow-y: auto;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 13px;
                    color: #00ff66;
                    line-height: 1.5;
                }
                .terminal div {
                    margin-bottom: 4px;
                }
                
                .status-item {
                    display: flex;
                    justify-content: space-between;
                    margin: 12px 0;
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
            </style>
        </head>
        <body>
            <header>
                <h1>Centrum Dowodzenia</h1>
                <div class="subtitle">Zarządzanie botem i podgląd systemu na żywo</div>
            </header>
            
            <div class="grid">
                <!-- Statusy systemów -->
                <div class="card">
                    <h3>Status Modułów</h3>
                    <div class="status-item"><span>Stan Bota:</span> <span class="badge-on">🟢 Online</span></div>
                    <div class="status-item"><span>Anty-Phishing:</span> <span class="badge-on">🛡️ Aktywny</span></div>
                    <div class="status-item"><span>Ghost Pingi:</span> <span class="badge-on">👻 Aktywne</span></div>
                    <div class="status-item"><span>Panel WWW:</span> <span class="badge-on">🌐 Działa</span></div>
                </div>

                <!-- Szybkie akcje -->
                <div class="card">
                    <h3>Szybkie Akcje</h3>
                    <button class="btn" onclick="alert('Wysyłam testowe powiadomienie...')">Wyślij test logu</button>
                    <button class="btn" onclick="location.reload()">Odśwież Panel</button>
                </div>

                <!-- Terminal przeniesiony na pełną szerokość -->
                <div class="card terminal-container">
                    <h3>Terminal / Logi Serwera na Żywo</h3>
                    <div class="terminal" id="terminal-box">
                        ${liveLogs.map(log => `<div>${log}</div>`).join('')}
                    </div>
                </div>
            </div>

            <script>
                // Automatyczne przewijanie terminala na sam dół przy załadowaniu
                const term = document.getElementById('terminal-box');
                term.scrollTop = term.scrollHeight;
            </script>
        </body>
        </html>
    `);
});

module.exports = router;
