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
            <title>Centrum Dowodzenia - Terminal</title>
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
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    margin: 0;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
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
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }

                .brand {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                h1 { 
                    color: var(--text-main); 
                    margin: 0; 
                    font-size: 18px; 
                    font-weight: 600;
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(34, 197, 94, 0.1);
                    color: #22c55e;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    border: 1px solid rgba(34, 197, 94, 0.2);
                }

                .status-dot {
                    width: 6px;
                    height: 6px;
                    background-color: #22c55e;
                    border-radius: 50%;
                    box-shadow: 0 0 8px #22c55e;
                }

                .btn-refresh {
                    background: var(--accent);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 13px;
                    transition: background 0.2s, transform 0.1s;
                }

                .btn-refresh:hover { 
                    background: var(--accent-hover); 
                }
                
                .btn-refresh:active {
                    transform: scale(0.98);
                }

                .terminal-wrapper {
                    flex-grow: 1;
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
                }

                .terminal-header {
                    font-size: 13px;
                    color: var(--text-muted);
                    margin-bottom: 10px;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .terminal {
                    flex-grow: 1;
                    background: var(--terminal-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 15px;
                    overflow-y: auto;
                    font-family: 'JetBrains Mono', Consolas, Monaco, 'Courier New', monospace;
                    font-size: 12.5px;
                    color: var(--terminal-text);
                    line-height: 1.6;
                }

                .terminal div { 
                    margin-bottom: 4px; 
                    white-space: pre-wrap; 
                    word-break: break-all; 
                }

                /* Scrollbar */
                ::-webkit-scrollbar {
                    width: 8px;
                }
                ::-webkit-scrollbar-track {
                    background: var(--terminal-bg);
                }
                ::-webkit-scrollbar-thumb {
                    background: var(--border-color);
                    border-radius: 4px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #3f3f46;
                }
            </style>
        </head>
        <body>
            <header>
                <div class="brand">
                    <h1>Centrum Dowodzenia</h1>
                    <div class="status-badge">
                        <div class="status-dot"></div>
                        Live
                    </div>
                </div>
                <button class="btn-refresh" onclick="location.reload()">Odśwież</button>
            </header>
            
            <div class="terminal-wrapper">
                <div class="terminal-header">Terminal / Logi Serwera na Żywo</div>
                <div class="terminal" id="terminal-box">
                    ${liveLogs.length > 0 ? liveLogs.map(log => `<div>${log}</div>`).join('') : '<div>Oczekiwanie na logi...</div>'}
                </div>
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
