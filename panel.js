const express = require('express');
const router = express.Router();

let liveLogs = [];

// Przechwytywanie logów do terminala
const originalConsoleLog = console.log;
console.log = function(...args) {
    const text = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    liveLogs.unshift(`[${new Date().toLocaleTimeString()}] ${text}`);
    if (liveLogs.length > 150) liveLogs.pop();
    originalConsoleLog.apply(console, args);
};

// Eksportujemy funkcję przyjmującą klienta bota (potrzebnego do wysyłania embedów i czytania kanałów)
module.exports = function(client) {

    // --- STRONA PANELU (HTML / CSS / JS) ---
    router.get('/panel', (req, res) => {
        let channelOptions = '';
        if (client && client.guilds) {
            client.guilds.cache.forEach(guild => {
                guild.channels.cache.forEach(channel => {
                    if (channel.type === 0) { // Kanał tekstowy
                        channelOptions += `<option value="${channel.id}">${guild.name} / #${channel.name}</option>`;
                    }
                });
            });
        }

        res.send(`
            <!DOCTYPE html>
            <html lang="pl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Centrum Dowodzenia - Bot</title>
                <style>
                    :root {
                        --bg-main: #121214;
                        --bg-card: #18181b;
                        --border-color: #27272a;
                        --accent: #5865F2;
                        --accent-hover: #4752C4;
                        --text-main: #f4f4f5;
                        --text-muted: #a1a1aa;
                        --terminal-bg: #09090b;
                        --terminal-text: #22c55e;
                    }
                    body {
                        background-color: var(--bg-main);
                        color: var(--text-main);
                        font-family: 'Inter', -apple-system, sans-serif;
                        margin: 0;
                        padding: 15px;
                        box-sizing: border-box;
                    }
                    header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: var(--bg-card);
                        border: 1px solid var(--border-color);
                        padding: 15px 20px;
                        border-radius: 12px;
                        margin-bottom: 20px;
                    }
                    h1 { color: var(--text-main); margin: 0; font-size: 18px; font-weight: 600; }
                    .grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                        gap: 20px;
                        max-width: 1200px;
                        margin: 0 auto;
                    }
                    .card {
                        background: var(--bg-card);
                        border: 1px solid var(--border-color);
                        padding: 20px;
                        border-radius: 12px;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    }
                    .card h3 { margin-top: 0; color: var(--text-main); border-bottom: 1px solid var(--border-color); padding-bottom: 10px; font-size: 16px; }
                    
                    /* Formularze */
                    .form-group { margin-bottom: 12px; }
                    label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 5px; font-weight: 500; }
                    input, textarea, select {
                        width: 100%;
                        background: var(--terminal-bg);
                        border: 1px solid var(--border-color);
                        color: #fff;
                        padding: 10px;
                        border-radius: 8px;
                        box-sizing: border-box;
                        font-family: inherit;
                        font-size: 13px;
                    }
                    textarea { resize: vertical; height: 80px; }
                    
                    /* Podgląd Embedu */
                    .discord-embed-preview {
                        background: #2b2d31;
                        border-left: 4px solid #5865F2;
                        padding: 12px;
                        border-radius: 4px;
                        margin-top: 15px;
                        font-size: 13px;
                    }
                    .embed-title { font-weight: bold; color: #fff; margin-bottom: 5px; }
                    .embed-desc { color: #dcddde; white-space: pre-wrap; word-break: break-all; }

                    .btn {
                        background: var(--accent);
                        color: white;
                        border: none;
                        padding: 10px 15px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        width: 100%;
                        margin-top: 10px;
                        transition: background 0.2s;
                    }
                    .btn:hover { background: var(--accent-hover); }
                    .btn-success { background: #23a55a; }
                    .btn-success:hover { background: #1d8a4b; }

                    /* Terminal */
                    .terminal-container { grid-column: 1 / -1; }
                    .terminal {
                        background: var(--terminal-bg);
                        border: 1px solid var(--border-color);
                        border-radius: 8px;
                        padding: 15px;
                        height: 250px;
                        overflow-y: auto;
                        font-family: 'JetBrains Mono', Consolas, monospace;
                        font-size: 12px;
                        color: var(--terminal-text);
                        line-height: 1.5;
                    }
                    .terminal div { margin-bottom: 4px; white-space: pre-wrap; word-break: break-all; }
                </style>
            </head>
            <body>
                <header>
                    <h1>🛡️ Centrum Dowodzenia Botem</h1>
                    <button class="btn" style="width: auto; margin: 0; padding: 6px 12px;" onclick="location.reload()">Odśwież</button>
                </header>
                
                <div class="grid">
                    <!-- Kreator Embedów -->
                    <div class="card">
                        <h3>Kreator / Edytor Embedów</h3>
                        <form action="/send-embed" method="POST">
                            <div class="form-group">
                                <label>Kanał docelowy</label>
                                <select name="channelId">
                                    ${channelOptions || '<option>Brak dostępnych kanałów</option>'}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Tytuł embeda</label>
                                <input type="text" name="title" id="embedTitleInput" placeholder="Wpisz tytuł..." oninput="updatePreview()">
                            </div>
                            <div class="form-group">
                                <label>Opis / Treść</label>
                                <textarea name="description" id="embedDescInput" placeholder="Wpisz treść wiadomości..." oninput="updatePreview()"></textarea>
                            </div>
                            
                            <label>Podgląd na żywo:</label>
                            <div class="discord-embed-preview" id="embedPreviewBox">
                                <div class="embed-title" id="prevTitle">Twój tytuł...</div>
                                <div class="embed-desc" id="prevDesc">Tutaj pojawi się treść...</div>
                            </div>

                            <button type="submit" class="btn btn-success">🚀 Wyślij embed na serwer</button>
                        </form>
                    </div>

                    <!-- Status systemowy -->
                    <div class="card">
                        <h3>Status Systemu</h3>
                        <p>🔹 <b>Stan panelu:</b> Aktywny</p>
                        <p>🔹 <b>Przesył logów:</b> Synchronizowany 1:1</p>
                        <button class="btn" onclick="alert('Wszystko działa stabilnie!')">Test powiadomienia</button>
                    </div>

                    <!-- Terminal -->
                    <div class="card terminal-container">
                        <h3>Terminal / Logi na Żywo</h3>
                        <div class="terminal" id="terminal-box">
                            ${liveLogs.length > 0 ? liveLogs.map(log => `<div>${log}</div>`).join('') : '<div>Oczekiwanie na logi...</div>'}
                        </div>
                    </div>
                </div>

                <script>
                    const term = document.getElementById('terminal-box');
                    term.scrollTop = term.scrollHeight;

                    function updatePreview() {
                        const title = document.getElementById('embedTitleInput').value;
                        const desc = document.getElementById('embedDescInput').value;
                        document.getElementById('prevTitle').innerText = title || 'Twój tytuł...';
                        document.getElementById('prevDesc').innerText = desc || 'Tutaj pojawi się treść...';
                    }
                </script>
            </body>
            </html>
        `);
    });

    // --- OBSŁUGA WYSYŁANIA EMBEDA Z PANELU ---
    router.post('/send-embed', express.urlencoded({ extended: true }), async (req, res) => {
        const { channelId, title, description } = req.body;
        
        try {
            const channel = await client.channels.fetch(channelId);
            if (channel && channel.isTextBased()) {
                await channel.send({
                    embeds: [{
                        color: 0x5865F2,
                        title: title || undefined,
                        description: description || undefined,
                        timestamp: new Date().toISOString()
                    }]
                });
                console.log(`[PANEL] Wysłano embed na kanał ID: ${channelId}`);
            }
        } catch (err) {
            console.error('[BŁĄD PANELU] Nie udało się wysłać embeda:', err);
        }

        res.redirect('/panel');
    });

    return router;
};
