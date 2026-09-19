const express = require('express');
const router = express.Router();

let liveLogs = [];

const originalConsoleLog = console.log;
console.log = function(...args) {
    const text = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    liveLogs.unshift(`[${new Date().toLocaleTimeString()}] ${text}`);
    if (liveLogs.length > 150) liveLogs.pop();
    originalConsoleLog.apply(console, args);
};

router.get('/panel', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Terminal Bota - Centrum Dowodzenia</title>
            <style>
                body { background-color: #0b0b0b; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; }
                header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #222; padding-bottom: 15px; }
                h1 { color: #5865F2; margin: 0; font-size: 20px; }
                .badge { background: #23a55a; color: white; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
                .terminal { background: #000000; border: 1px solid #222; border-radius: 6px; padding: 15px; height: 75vh; overflow-y: auto; font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #00ff66; line-height: 1.5; box-shadow: inset 0 0 10px rgba(0,0,0,0.8); }
                .terminal div { margin-bottom: 4px; white-space: pre-wrap; word-break: break-all; }
                .btn-refresh { background: #5865F2; color: white; border: none; padding: 8px 14px; border-radius: 5px; cursor: pointer; font-weight: bold; }
                .btn-refresh:hover { background: #4752C4; }
            </style>
        </head>
        <body>
            <header>
                <h1>🖥️ Terminal Bota (Centrum Dowodzenia)</h1>
                <div>
                    <span class="badge">Online</span>
                    <button class="btn-refresh" onclick="location.reload()">Odśwież</button>
                </div>
            </header>
            
            <div class="terminal" id="terminal-box">
                ${liveLogs.length > 0 ? liveLogs.map(log => `<div>${log}</div>`).join('') : '<div>Oczekiwanie na logi...</div>'}
            </div>

            <script>
                const term = document.getElementById('terminal-box');
                term.scrollTop = term.scrollHeight;
            </script>
        </body>
        </html>
    `);
});

module.exports = router;
