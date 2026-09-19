const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const fetch = require('node-fetch');
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'rapldez_super_secret_key_997',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI; 
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

const SERVER_ID = '1516145205215232050'; 
const CATEGORY_ID = '1550704110691422318'; 
const YOUR_DISCORD_ID = '920029957739139083';

// Kanały
const LOG_CHANNEL_ID = '1550753070726512730'; 
const TERMINAL_LOG_CHANNEL = '1550789490518528010';
const STATUS_CHANNEL_ID = '1550797478021038161';
const FULL_LOGS_CHANNEL_ID = 'WPISZ_ID_KANALU'; // <-- TUTAJ WPISZ ID KANAŁU NA PEŁNE LOGI SERWERA

// --- FUNKCJE POMOCNICZE (LOGI TERMINALA #024442) ---
async function logToTerminalDiscord(title, description) {
    try {
        const channel = client.channels.cache.get(TERMINAL_LOG_CHANNEL);
        if (!channel) return;
        
        const embed = new EmbedBuilder()
            .setColor('#024442')
            .setAuthor({ name: '💻 TERMINAL WWW • LOGI SYSTEMOWE' })
            .setTitle(title)
            .setDescription(description)
            .setTimestamp()
            .setFooter({ text: 'rapldez.onrender.com • Zabezpieczenia' });
            
        await channel.send({ embeds: [embed] });
    } catch (e) {
        console.error('Błąd logowania do terminala na DC:', e);
    }
}

// Sprawdzanie VPN (darmowe API)
async function isVPN(ip) {
    if (ip === '127.0.0.1' || ip === '::1' || !ip) return false;
    try {
        const res = await fetch(`http://ip-api.com/json/${ip}?fields=proxy`);
        const data = await res.json();
        return data.proxy === true;
    } catch (e) { return false; }
}

// --- MONGODB SCHEMAS ---
const counterSchema = new mongoose.Schema({ id: { type: String, default: 'views' }, count: { type: Number, default: 0 } });
const Counter = mongoose.model('Counter', counterSchema);

const ticketArchiveSchema = new mongoose.Schema({
    channelName: String, messagesCount: Number, participants: [String],
    createdAt: String, closedAt: String, archivedAt: String, archivedBy: String, htmlContent: String
});
const TicketArchive = mongoose.model('TicketArchive', ticketArchiveSchema);

const pasteSchema = new mongoose.Schema({ shortId: String, content: String, createdAt: String });
const Paste = mongoose.model('Paste', pasteSchema);

if (MONGO_URI) {
    mongoose.connect(MONGO_URI).then(() => console.log('✅ Połączono z bazą MongoDB!')).catch(err => console.error('❌ Błąd z MongoDB:', err));
}

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates
    ] 
});

// --- OAUTH2 DISCORD LOGIN ---
app.get('/auth/discord', (req, res) => {
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`);
});

app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!code) return res.redirect('/?error=no_code');
    
    // Sprawdzenie VPN przed zalogowaniem
    const vpnDetected = await isVPN(userIP);
    if (vpnDetected) {
        logToTerminalDiscord('🛡️ Odrzucono ruch (VPN/Proxy)', `System zablokował próbę logowania z ukrytego adresu IP.\n**Adres IP:** \`${userIP}\``);
        return res.redirect('/?error=vpn_blocked');
    }

    try {
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', code: code, redirect_uri: REDIRECT_URI }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) return res.redirect('/?error=bad_token');

        const userResponse = await fetch('https://discord.com/api/users/@me', { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } });
        const userData = await userResponse.json();

        if (userData.id === YOUR_DISCORD_ID) {
            req.session.user = { id: userData.id, username: userData.username };
            logToTerminalDiscord('🔑 Autoryzacja udana', `Panel Administratora został pomyślnie odblokowany przez **${userData.username}**.\n**IP:** \`${userIP}\``);
            return res.redirect('/?login=success');
        } else {
            logToTerminalDiscord('⚠️ Zablokowano dostęp', `Nieudana próba wejścia do terminala.\n**Profil:** \`${userData.username}\` (${userData.id})\n**IP:** \`${userIP}\``);
            return res.redirect('/?error=unauthorized');
        }
    } catch (error) { res.redirect('/?error=server_error'); }
});

// --- API STRONY & TERMINAL ---
app.post('/api/terminal', async (req, res) => {
    const cmd = req.body.command ? req.body.command.trim() : '';
    if (!req.session || !req.session.user || req.session.user.id !== YOUR_DISCORD_ID) {
        return res.status(403).json({ output: 'Odmowa dostępu.' });
    }

    logToTerminalDiscord('⌨️ Wykonano polecenie', `**Komenda:** \`${cmd || '[Puste]'}\``);
    const cmdArgs = cmd.split(' ');
    const cmdLower = cmdArgs[0].toLowerCase();

    if (cmdLower === 'sysinfo') {
        const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);
        return res.json({ output: `Uptime: ${Math.floor(process.uptime())}s | RAM: ${mem}MB \vert{} Ping:${client.ws.ping}ms` });
    }
    
    if (cmdLower === 'db' && cmdArgs[1] === 'stats') {
        const tickCount = await TicketArchive.countDocuments();
        const views = await Counter.findOne({ id: 'views' });
        return res.json({ output: `Statystyki bazy:\n- Zarchiwizowane tickety: ${tickCount}\n- Odsłony strony: ${views ? views.count : 0}` });
    }
    
    if (cmdLower === 'paste' && cmdArgs.length > 1) {
        const content = cmd.substring(6);
        const shortId = Math.random().toString(36).substring(2, 8);
        await Paste.create({ shortId, content, createdAt: new Date().toLocaleString() });
        return res.json({ output: `Zapisano kod. Link: https://rapldez.onrender.com/p/${shortId}` });
    }

    if (cmdLower === 'bot' && cmdArgs[1] === 'status') {
        const statusText = cmd.substring(11);
        client.user.setActivity(statusText);
        return res.json({ output: `Status zmieniony na: "${statusText}"` });
    }

    return res.json({ output: `Nie rozpoznano polecenia. Dostępne: sysinfo, db stats, paste [kod], bot status [tekst]` });
});

app.get('/p/:id', async (req, res) => {
    const paste = await Paste.findOne({ shortId: req.params.id });
    if (!paste) return res.send('Brak kodu o tym ID.');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(paste.content);
});

// --- KOMENDY DISCORD ---
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!clear') && message.author.id === YOUR_DISCORD_ID) {
        const args = message.content.split(' ');
        const amount = parseInt(args[1]);

        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply('Podaj liczbę (1-100), np. `!clear 10`').then(m => setTimeout(() => m.delete().catch(()=>null), 3000));
        }

        await message.delete().catch(() => null);
        const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);

        if (deleted) {
            const fb = new EmbedBuilder()
                .setColor('#024442')
                .setAuthor({ name: '🛠️ PANEL KONTROLNY' })
                .setDescription(`>>> **Status:** Pomyślnie usunięto wiadomości.\n**Zlikwidowano:** \`${deleted.size}\` sztuk.`)
                .setFooter({ text: 'Wiadomość ulegnie autodestrukcji za 5s' });
                
            const msg = await message.channel.send({ embeds: [fb] });
            setTimeout(() => msg.delete().catch(() => null), 5000);
        }
    }

    if (message.content.startsWith('!clone-role') && message.author.id === YOUR_DISCORD_ID) {
        const args = message.content.split(' ');
        const targetRole = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
        const newName = args.slice(2).join(' ') || `${targetRole.name} - Kopia`;

        if (!targetRole) return message.reply('Oznacz rolę do sklonowania: `!clone-role @rola Nowa Nazwa`');
        
        try {
            const cloned = await message.guild.roles.create({
                name: newName, color: targetRole.color, hoist: targetRole.hoist,
                permissions: targetRole.permissions, mentionable: targetRole.mentionable,
                reason: `Sklonowano z polecenia roota`
            });
            message.reply(`✅ Rola sklonowana pomyślnie. Nowa rola: <@&${cloned.id}>`);
        } catch (err) { message.reply('Błąd podczas klonowania.'); }
    }
});

// --- PEŁNE LOGI SERWERA ---
client.on('messageDelete', async (message) => {
    if (message.author?.bot) return;
    const channel = client.channels.cache.get(FULL_LOGS_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor('#ed4245')
        .setAuthor({ name: '🗑️ Wiadomość usunięta' })
        .setDescription(`**Autor:** ${message.author} (${message.author.id})\n**Kanał:** ${message.channel}\n\n**Treść:**\n\`\`\`text\n${message.content || '[Brak tekstu / Obraz]'}\n\`\`\``)
        .setTimestamp();
    channel.send({ embeds: [embed] });
});

client.on('voiceStateUpdate', (oldState, newState) => {
    const channel = client.channels.cache.get(FULL_LOGS_CHANNEL_ID);
    if (!channel) return;

    if (!oldState.channelId && newState.channelId) {
        const embed = new EmbedBuilder().setColor('#23a559').setDescription(`🔊 **${newState.member.user.tag}** dołączył do kanału <#${newState.channelId}>`).setTimestamp();
        channel.send({ embeds: [embed] });
    } else if (oldState.channelId && !newState.channelId) {
        const embed = new EmbedBuilder().setColor('#ed4245').setDescription(`🔇 **${oldState.member.user.tag}** opuścił kanał <#${oldState.channelId}>`).setTimestamp();
        channel.send({ embeds: [embed] });
    }
});

// --- LIVE PING & STARTUP ---
client.once('ready', async () => {
    console.log(`Bot zalogowany jako ${client.user.tag}`);
    app.listen(PORT, () => { console.log(`Serwer działa na porcie ${PORT}!`); });

    try {
        const statusChannel = client.channels.cache.get(STATUS_CHANNEL_ID);
        if (statusChannel) {
            const embed = new EmbedBuilder()
                .setColor('#024442')
                .setAuthor({ name: '🟢 SYSTEM OPERACYJNY ONLINE' })
                .setDescription(`**Status infrastruktury:** Stabilny\n**Aktualny Ping:** \`${client.ws.ping}ms\``)
                .setTimestamp()
                .setFooter({ text: 'rapldez.onrender.com' });
                
            const statusMsg = await statusChannel.send({ embeds: [embed] });
            
            // Auto-update pingu co 10 minut
            setInterval(() => {
                embed.setDescription(`**Status infrastruktury:** Stabilny\n**Aktualny Ping:** \`${client.ws.ping}ms\``).setTimestamp();
                statusMsg.edit({ embeds: [embed] }).catch(()=>null);
            }, 10 * 60 * 1000);
        }
    } catch (e) { console.error(e); }
});

const PORT = process.env.PORT || 3000;
client.login(BOT_TOKEN);