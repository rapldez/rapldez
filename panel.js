const express = require('express');
const router = express.Router();

let liveLogs = ['[SYSTEM] Centrum dowodzenia i terminal załadowane pomyślnie.'];

router.addLog = function(text) {
    liveLogs.unshift(`[${new Date().toLocaleTimeString()}] ${text}`);
    if (liveLogs.length > 100) liveLogs.pop();
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
                    margin-bottom: 25px;
                }
                h1 { color: #5865F2; margin-bottom: 5px; }
                .subtitle { color: #949ba4; font-size: 14px; }
                
                .grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                    gap: 20px;
                    max-width: 1200px;
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
                    height: 220px;
                    overflow-y: auto;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 13px;
                    color: #00ff66;
                    line-height: 1.5;
                }
                .terminal div { margin-bottom: 4px; }
                
                /* Formularze i Kreator Embedów */
                .form-group {
                    margin-bottom: 12px;
                }
                label {
                    display: block;
                    font-size: 12px;
                    color: #949ba4;
                    margin-bottom: 5px;
                }
                input, textarea {
                    width: 100%;
                    background: #0b0b0b;
                    border: 1px solid #333;
                    color: #fff;
                    padding: 8px;
                    border-radius: 5px;
                    box-sizing: border-box;
                    font-family: inherit;
                }
                textarea { resize: vertical; height: 70px; }
                
                /* Podgląd Embedu Discorda */
                .discord-embed-preview {
                    background: #2f3136;
                    border-left: 4px solid #5865F2;
                    padding: 12px;
                    border-radius: 4px;
                    margin-top: 15px;
                    font-size: 13px;
                }
                .embed-title { font-weight: bold; color: #fff; margin-bottom: 5px; }
                .embed-desc { color: #dcddde; white-space: pre-wrap; }

                .btn {
                    background: #5865F2;
                    color: white;
                    border: none;
                    padding: 10px 15px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                    width: 100%;
                    margin-top: 5px;
                    transition: background 0.2s;
                }
                .btn:hover { background: #4752C4; }
                
                .status-item {
                    display: flex;
                    justify-content: space-between;
                    margin: 10px 0;
                    font-size: 14px;
                }
                .badge-on { color: #23a55a; font-weight: bold; }
            </style>
        </head>
        <body>
            <header>
                <h1>Centrum Dowodzenia</h1>
                <div class="subtitle">Twój osobisty panel bota i narzędzia</div>
            </header>
            
            <div class="grid">
                <!-- Statusy -->
                <div class="card">
                    <h3>Status Systemu</h3>
                    <div class="status-item"><span>Bot:</span> <span class="badge-on">🟢 Online</span></div>
                    <div class="status-item"><span>Anty-Phishing:</span> <span class="badge-on">🛡️ Aktywny</span></div>
                    <div class="status-item"><span>Ghost Pingi:</span> <span class="badge-on">👻 Aktywne</span></div>
                    <button class="btn" style="margin-top: 15px;" onclick="location.reload()">Odśwież Panel</button>
                </div>

                <!-- Kreator Embedów -->
                <div class="card">
                    <h3>Kreator Embedów</h3>
                    <div class="form-group">
                        <label>Tytuł wiadomości</label>
                        <input type="text" id="embedTitleInput" placeholder="Wpisz tytuł..." oninput="updatePreview()">
                    </div>
                    <div class="form-group">
                        <label>Treść / Opis</label>
                        <textarea id="embedDescInput" placeholder="Wpisz treść embeda..." oninput="updatePreview()"></textarea>
                    </div>
                    
                    <label>Podgląd na żywo:</label>
                    <div class="discord-embed-preview" id="embedPreviewBox">
                        <div class="embed-title" id="prevTitle">Twój tytuł...</div>
                        <div class="embed-desc" id="prevDesc">Tutaj pojawi się treść wiadomości...</div>
                    </div>
                </div>

                <!-- Terminal na pełną szerokość -->
                <div class="card terminal-container">
                    <h3>Terminal / Logi na Żywo</h3>
                    <div class="terminal" id="terminal-box">
                        ${liveLogs.map(log => `<div>${log}</div>`).join('')}
                    </div>
                </div>
            </div>

            <script>
                // Automatyczne scrollowanie terminala
                const term = document.getElementById('terminal-box');
                term.scrollTop = term.scrollHeight;

                // Skrypt podglądu embeda w czasie rzeczywistym
                function updatePreview() {
                    const title = document.getElementById('embedTitleInput').value;
                    const desc = document.getElementById('embedDescInput').value;
                    
                    document.getElementById('prevTitle').innerText = title || 'Twój tytuł...';
                    document.getElementById('prevDesc').innerText = desc || 'Tutaj pojawi się treść wiadomości...';
                }
            </script>
        </body>
        </html>
    `);
});

module.exports = router;
