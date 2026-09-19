const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const fetch = require('node-fetch');
const app = express();

// --- SPRAWDZANIE ZMIENNYCH ŚRODOWISKOWYCH (.env) ---
const requiredEnv = ['BOT_TOKEN', 'MONGO_URI', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI'];
const missingEnv = requiredEnv.filter(envName => !process.env[envName]);

if (missingEnv.length > 0) {
    console.error('============================================================');
    console.error('❌ BŁĄD KRYTYCZNY: Brakuje następujących zmiennych środowiskowych:');
    missingEnv.forEach(env => console.error(`   - ${env}`));
    console.error('Uzupełnij je w pliku .env lub w panelu Render przed startem bota!');
    console.error('============================================================');
    process.exit(1);
}

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
const CATEGORY_ID = '1516145205936394455'; 
const VOICE_CREATOR_CHANNEL_ID = '1516643168479608963'; 
const YOUR_DISCORD_ID = '920029957739139083';

// Kanały
const LOG_CHANNEL_ID = '1550753070726512730'; 
const TERMINAL_LOG_CHANNEL = '1550789490518528010';
const STATUS_CHANNEL_ID = '1550797478021038161';
const FULL_LOGS_CHANNEL_ID = '1550791675486408754';

const MAIN_COLOR = '#024442';

// --- FUNKCJE POMOCNICZE ---
const createLogEmbed = (title, desc) => new EmbedBuilder().setColor(MAIN_COLOR).setAuthor({ name: title }).setDescription(desc).setTimestamp();

const formatDatePL = (dateObj = new Date()) => {
    const time = dateObj.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Warsaw' });
    const date = dateObj.toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' });
    return `${time},${date}`;
};

async function logToTerminalDiscord(title, description) {
    try {
        const channel = client.channels.cache.get(TERMINAL_LOG_CHANNEL);
        if (channel) await channel.send({ embeds: [createLogEmbed(`💻 TERMINAL: ${title}`, description)] });
    } catch (e) {}
}

async function sendServerLog(title, description) {
    try {
        const channel = client.channels.cache.get(FULL_LOGS_CHANNEL_ID);
        if (channel) await channel.send({ embeds: [createLogEmbed(title, description)] });
    } catch (e) {}
}

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

const warnSchema = new mongoose.Schema({ userId: String, reason: String, adminId: String, date: String });
const Warn = mongoose.model('Warn', warnSchema);

const embedPresetSchema = new mongoose.Schema({ name: String, content: String, authorName: String, authorUrl: String, authorIcon: String, title: String, description: String, color: String, image: String, thumbnail: String, footer: String, footerIcon: String, timestamp: Boolean, buttons: Array });
const EmbedPreset = mongoose.model('EmbedPreset', embedPresetSchema);

const giveawaySchema = new mongoose.Schema({
    messageId: String,
    channelId: String,
    prize: String,
    endsAt: Number,
    ended: { type: Boolean, default: false },
    participants: [String]
});
const Giveaway = mongoose.model('Giveaway', giveawaySchema);

// Schemat ankiet z czasem trwania
const pollSchema = new mongoose.Schema({
    messageId: String,
    channelId: String,
    question: String,
    options: [String],
    endsAt: Number,
    ended: { type: Boolean, default: false },
    votes: { type: Map, of: Number, default: {} }
});
const Poll = mongoose.model('Poll', pollSchema);

let dbStatus = 'Rozłączono';
if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => { dbStatus = '🟢 Połączono (Stabilna)'; console.log('✅ Połączono z MongoDB!'); })
        .catch(err => { dbStatus = '🔴 Błąd połączenia'; console.error(err); });
}

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildInvites, GatewayIntentBits.GuildEmojisAndStickers, GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildScheduledEvents, GatewayIntentBits.AutoModerationConfiguration, 
        GatewayIntentBits.AutoModerationExecution, GatewayIntentBits.GuildModeration
    ] 
});

const guildInvitesCache = new Map();

const sendCrashLog = async (error) => {
    const channel = client.channels.cache.get(TERMINAL_LOG_CHANNEL);
    if (!channel) return;
    const embed = createLogEmbed('⚠️ Krytyczny Błąd Systemu', `Wykryto awarię aplikacji na Renderze. Zrzut:\n\`\`\`js\n${error.stack ? error.stack.substring(0, 3000) : error}\n\`\`\``);
    await channel.send({ embeds: [embed] }).catch(() => null);
};

process.on('uncaughtException', async (err) => { console.error(err); await sendCrashLog(err); });
process.on('unhandledRejection', async (reason) => { console.error(reason); await sendCrashLog(reason); });

app.get('/auth/discord', (req, res) => res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`));

app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    let userIP = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.socket.remoteAddress;

    if (!code) return res.redirect('/?error=no_code');
    if (await isVPN(userIP)) {
        logToTerminalDiscord('🛡️ Odrzucono ruch (VPN/Proxy)', `System zablokował próbę logowania z ukrytego IP.\n**Adres IP:** \`${userIP}\``);
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
            logToTerminalDiscord('🔑 Autoryzacja udana', `Panel odblokowany przez **${userData.username}**.\n**IP:** \`${userIP}\``);
            return res.redirect('/?login=success');
        } else {
            logToTerminalDiscord('⚠️ Zablokowano dostęp', `Nieudana próba wejścia.\n**Profil:** \`${userData.username}\` (${userData.id})\n**IP:** \`${userIP}\``);
            return res.redirect('/?error=unauthorized');
        }
    } catch (error) { res.redirect('/?error=server_error'); }
});

app.get('/api/check-auth', (req, res) => res.json({ authenticated: (req.session?.user?.id === YOUR_DISCORD_ID), username: req.session?.user?.username }));
app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ success: true })));

app.get('/api/views', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    try {
        if (!MONGO_URI) return res.json({ views: 'Brak Bazy' });
        let counter = await Counter.findOne({ id: 'views' });
        if (!counter) counter = new Counter({ id: 'views', count: 0 });
        counter.count += 1;
        await counter.save();
        res.json({ views: counter.count });
    } catch (err) {
        res.status(500).json({ views: 'Live' });
    }
});

// Szablony Embedów API
app.get('/api/embed-presets', async (req, res) => {
    try { const presets = await EmbedPreset.find({}, 'name'); res.json(presets); } catch(e) { res.json([]); }
});
app.get('/api/embed-presets/:id', async (req, res) => {
    try { const p = await EmbedPreset.findById(req.params.id); res.json(p); } catch(e) { res.status(404).json({}); }
});
app.post('/api/embed-presets', async (req, res) => {
    try { await EmbedPreset.create(req.body); res.json({ success: true }); } catch(e) { res.status(500).json({ success: false }); }
});

const recentSubmissions = new Map();

app.post('/api/kontakt', async (req, res) => {
    const { nick, subject, message } = req.body;
    if (!nick || !message || !subject) return res.status(400).json({ error: 'Brakujące dane' });

    const subKey = `${nick}_${message}`;
    if (recentSubmissions.has(subKey) && Date.now() - recentSubmissions.get(subKey) < 5000) {
        return res.status(200).json({ message: 'Zgłoszenie zostało już wysłane.' });
    }
    recentSubmissions.set(subKey, Date.now());

    try {
        const guild = client.guilds.cache.get(SERVER_ID);
        if (!guild) return res.status(500).json({ message: 'Błąd serwera.' });

        const inputClean = nick.toLowerCase().trim();
        let member = null;
        try {
            const searchResults = await guild.members.fetch({ query: inputClean, limit: 10 });
            member = searchResults.find(m => m.user.username.toLowerCase() === inputClean || (m.user.globalName && m.user.globalName.toLowerCase() === inputClean));
        } catch (e) {}

        const permissionOverwrites = [{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }];
        if (member) {
            permissionOverwrites.push({ id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
        }

        const ticketCount = await TicketArchive.countDocuments();
        const nextNumber = ticketCount + 1;
        const channelName = `zgłoszenie-${nextNumber}`;
        
        const createdAtStr = formatDatePL(new Date());
        const topicData = `${member ? member.id : 'brak_id'}\vert{}${createdAtStr}|Brak`;
        
        const newChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            topic: topicData,
            permissionOverwrites: permissionOverwrites
        });

        const embed = new EmbedBuilder()
            .setColor(MAIN_COLOR)
            .setAuthor({ name: '🎫 RAPLDEZ • ZGŁOSZENIE ZE STRONY' })
            .setDescription(`**• 👤 Nadawca:** \`${nick}\` (${member ? `<@${member.id}>` : 'Brak na serwerze'})\n**• 📩 Temat:** \`${subject}\`\n**• 🕒 Otwarto:** \`${createdAtStr}\`\n\`\`\`text\n${message}\n\`\`\``)
            .setFooter({ text: 'rapldez OS • System zgłoszeń' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Zamknij').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('archive_ticket').setLabel('Archiwizuj').setStyle(ButtonStyle.Danger).setEmoji('📁')
        );

        await newChannel.send({ content: `<@${YOUR_DISCORD_ID}> Masz nowe zgłoszenie ze strony!`, embeds: [embed], components: [row] });
        return res.status(200).json({ message: 'Zgłoszenie wysłane!' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Wystąpił błąd serwera.' });
    }
});

// TERMINAL API
app.post('/api/terminal', async (req, res) => {
    const cmd = req.body.command ? req.body.command.trim() : '';
    if (!req.session || !req.session.user || req.session.user.id !== YOUR_DISCORD_ID) return res.status(403).json({ output: 'Odmowa dostępu.' });

    logToTerminalDiscord('⌨️ Wykonano polecenie WWW', `**Komenda:** \`${cmd || '[Puste]'}\``);
    const cmdArgs = cmd.split(' ');
    const cmdLower = cmdArgs[0].toLowerCase();

    if (cmdLower === 'sysinfo') return res.json({ output: `Uptime: ${Math.floor(process.uptime())}s | RAM: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB \vert{} Ping:${client.ws.ping}ms` });
    
    if (cmdLower === 'db' && cmdArgs[1] === 'stats') {
        const tickCount = await TicketArchive.countDocuments();
        const views = await Counter.findOne({ id: 'views' });
        return res.json({ output: `Statystyki bazy:\n- Zarchiwizowane tickety: ${tickCount}\n- Odsłony strony: ${views?.count || 0}` });
    }
    
    if (cmdLower === 'paste' && cmdArgs.length > 1) {
        const shortId = Math.random().toString(36).substring(2, 8);
        await Paste.create({ shortId, content: cmd.substring(6), createdAt: formatDatePL(new Date()) });
        return res.json({ output: `Zapisano kod. Link: https://rapldez.onrender.com/p/${shortId}` });
    }
    
    if (cmdLower === 'bot' && cmdArgs[1] === 'status') {
        client.user.setActivity(cmd.substring(11));
        return res.json({ output: `Status zmieniony na: "${cmd.substring(11)}"` });
    }

    if (cmdLower === 'search' && cmdArgs.length > 1) {
        const query = cmdArgs.slice(1).join(' ');
        const results = await TicketArchive.find({ htmlContent: { $regex: query,$options: 'i' } });
        if (results.length === 0) return res.json({ output: `Brak wyników w bazie dla słowa: "${query}"` });
        const names = results.map(r => r.channelName).join(', ');
        return res.json({ output: `Znaleziono słowo "${query}" w ticketach (${results.length}):\n${names}` });
    }

    if (cmdLower === 'giveaway') {
        const channelId = cmdArgs[1];
        const minutes = parseInt(cmdArgs[2]);
        const prize = cmdArgs.slice(3).join(' ');

        if (!channelId || isNaN(minutes) || !prize) {
            return res.json({ output: 'Użycie: giveaway [ID_KANAŁU] [CZAS_W_MINUTACH] [NAGRODA]' });
        }

        const channel = client.channels.cache.get(channelId);
        if (!channel) return res.json({ output: 'Błąd: Nie znaleziono kanału o podanym ID.' });

        const endsAt = Date.now() + (minutes * 60 * 1000);
        const unixTime = Math.floor(endsAt / 1000);

        const embed = new EmbedBuilder()
            .setColor(MAIN_COLOR)
            .setAuthor({ name: '🎉 ROZPOCZĘTO KONKURS (GIVEAWAY)' })
            .setTitle(prize)
            .setDescription(`>>> **• Nagroda:** \`${prize}\`\n**• Zakończenie:** <t:${unixTime}:R>\n**• Dokładna data:** <t:${unixTime}:f>\n**• Uczestnicy:** \`0\`\n\nKliknij przycisk poniżej, aby dołączyć!`)
            .setFooter({ text: 'rapldez OS • Konkursy' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_giveaway').setLabel('Dołącz do losowania').setStyle(ButtonStyle.Success).setEmoji('🎉')
        );

        const gMsg = await channel.send({ embeds: [embed], components: [row] });
        await Giveaway.create({
            messageId: gMsg.id,
            channelId: channel.id,
            prize: prize,
            endsAt: endsAt,
            participants: []
        });

        return res.json({ output: `Wystartowano giveaway na kanale <#${channelId}> na ${minutes} minut. Nagroda: ${prize}` });
    }

    return res.json({ output: `Nie rozpoznano polecenia. Dostępne: sysinfo, db stats, paste [kod], bot status [tekst], search [słowo], giveaway [kanał] [minuty] [nagroda]` });
});

// POBIERANIE WIADOMOŚCI DO EDYCJI
app.get('/api/fetch-message/:channelId/:messageId', async (req, res) => {
    if (!req.session || !req.session.user || req.session.user.id !== YOUR_DISCORD_ID) return res.status(403).json({ error: 'Brak uprawnień roota.' });
    try {
        const channel = client.channels.cache.get(req.params.channelId);
        if (!channel) return res.status(404).json({ error: 'Nie znaleziono kanału.' });
        const msg = await channel.messages.fetch(req.params.messageId);
        if (!msg) return res.status(404).json({ error: 'Nie znaleziono wiadomości.' });

        const embed = msg.embeds[0] || {};
        const data = {
            content: msg.content || '',
            authorName: embed.author?.name || '',
            authorUrl: embed.author?.url || '',
            authorIcon: embed.author?.iconURL || '',
            title: embed.title || '',
            description: embed.description || '',
            color: embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#024442',
            image: embed.image?.url || '',
            thumbnail: embed.thumbnail?.url || '',
            footer: embed.footer?.text || '',
            footerIcon: embed.footer?.iconURL || '',
            timestamp: !!embed.timestamp,
            buttons: []
        };

        if (msg.components && msg.components.length > 0 && msg.components[0].components) {
            msg.components[0].components.forEach(btn => {
                let style = 'PRIMARY';
                if (btn.style === 2) style = 'SECONDARY';
                if (btn.style === 3) style = 'SUCCESS';
                if (btn.style === 4) style = 'DANGER';
                if (btn.style === 5) style = 'LINK';
                data.buttons.push({
                    label: btn.label || '',
                    style: style,
                    value: btn.url || btn.customId || ''
                });
            });
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Nie można pobrać wiadomości (sprawdź ID).' });
    }
});

// ENDPOINT WYSYŁANIA I EDYCJI EMBEDÓW
app.post('/api/send-embed', async (req, res) => {
    if (!req.session || !req.session.user || req.session.user.id !== YOUR_DISCORD_ID) return res.status(403).json({ error: 'Brak uprawnień roota.' });
    
    const { channelId, messageId, content, authorName, authorUrl, authorIcon, title, description, color, image, thumbnail, footer, footerIcon, timestamp, buttons } = req.body;
    if (!channelId || (!description && !title && !content)) return res.status(400).json({ error: 'Wymagane ID kanału oraz treść embedu.' });

    try {
        const targetChannel = client.channels.cache.get(channelId);
        if (!targetChannel) return res.status(404).json({ error: 'Nie znaleziono kanału o tym ID.' });

        const embed = new EmbedBuilder();
        if (color) embed.setColor(color);
        if (title) embed.setTitle(title);
        if (description) embed.setDescription(description.replace(/\\n/g, '\n'));
        
        if (authorName) {
            embed.setAuthor({
                name: authorName,
                ...(authorUrl && { url: authorUrl }),
                ...(authorIcon && { iconURL: authorIcon })
            });
        }

        if (image) embed.setImage(image);
        if (thumbnail) embed.setThumbnail(thumbnail);
        if (footer || footerIcon) {
            embed.setFooter({ text: footer || '', ...(footerIcon && { iconURL: footerIcon }) });
        }
        if (timestamp) embed.setTimestamp();

        const payload = {};
        if (content) payload.content = content.replace(/\\n/g, '\n');
        if (description || title || authorName || image || thumbnail || footer) payload.embeds = [embed];

        if (buttons && buttons.length > 0) {
            const row = new ActionRowBuilder();
            buttons.forEach((btn, idx) => {
                let style = ButtonStyle.Primary;
                if (btn.style === 'SECONDARY') style = ButtonStyle.Secondary;
                if (btn.style === 'SUCCESS') style = ButtonStyle.Success;
                if (btn.style === 'DANGER') style = ButtonStyle.Danger;
                if (btn.style === 'LINK') style = ButtonStyle.Link;

                const bBuilder = new ButtonBuilder()
                    .setLabel(btn.label || `Przycisk ${idx+1}`)
                    .setStyle(style);

                if (style === ButtonStyle.Link) {
                    bBuilder.setURL(btn.value || 'https://discord.com');
                } else {
                    bBuilder.setCustomId(`custom_btn_${Date.now()}_${idx}`);
                }
                row.addComponents(bBuilder);
            });
            payload.components = [row];
        } else {
            payload.components = [];
        }

        if (messageId) {
            const msgToEdit = await targetChannel.messages.fetch(messageId);
            if (!msgToEdit) return res.status(404).json({ error: 'Nie znaleziono wiadomości o tym ID na podanym kanale.' });
            await msgToEdit.edit(payload);
            logToTerminalDiscord('📝 Edytor Embedów', `Użytkownik **${req.session.user.username}** zaktualizował embed na kanale <#${channelId}>.`);
            res.json({ success: true, message: 'Wiadomość zaktualizowana pomyślnie!' });
        } else {
            await targetChannel.send(payload);
            logToTerminalDiscord('📝 Kreator Embedów', `Użytkownik **${req.session.user.username}** wysłał embed na kanał <#${channelId}>.`);
            res.json({ success: true, message: 'Wiadomość z embedem wysłana!' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Błąd podczas wysyłania/edycji.' });
    }
});

app.get('/p/:id', async (req, res) => {
    const paste = await Paste.findOne({ shortId: req.params.id });
    if (!paste) return res.send('Brak kodu o tym ID.');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(paste.content);
});

// Map do śledzenia wiadomości (Anty-Spam)
const userSpamMap = new Map();
const SPAM_LIMIT = 5; 
const SPAM_TIME = 4000; 
const SPAM_DUPLICATES = 4; 
const TIMEOUT_DURATION = 5 * 60 * 1000; 

const tempVoiceChannels = new Map();

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.author.id !== YOUR_DISCORD_ID && !message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const userId = message.author.id;
        const msgContent = message.content.toLowerCase();

        // 1. DETEKTOR SCAM-LINKÓW
        const scamRegex = /(discorcl|dlscord|discord-nitro|discord-app|nitro-gift|steamcommunitly|stearmcommunity|steam-nitro|free-nitro|discord\.xyz|discord-gift|gift-nitro)/i;
        const isRealDiscord = msgContent.includes('discord.com') || msgContent.includes('discord.gg');
        
        if (scamRegex.test(msgContent) && !isRealDiscord) {
            await message.delete().catch(() => {});
            if (message.member && message.member.moderatable) {
                await message.member.timeout(24 * 60 * 60 * 1000, 'Zabezpieczenie: Wysłano Scam-Link (Phishing)'); 
            }
            sendServerLog('☠️ Zablokowano Scam-Link', `**Użytkownik:** <@${userId}>\n**Kanał:** <#${message.channel.id}>\n**Akcja:** Wiadomość usunięta, Timeout 24h\n**Wykryta treść:**\n\`\`\`text\n${message.content.replace(/`/g, '')}\n\`\`\``);
            const alertMsg = await message.channel.send({ content: `⚠️ <@${userId}>, wysyłanie podejrzanych linków jest zabronione. Twoje konto zostało tymczasowo zablokowane.` });
            setTimeout(() => alertMsg.delete().catch(()=>null), 8000);
            return;
        }

        // 2. TARCZA MASOWYCH WZMIANEK
        const mentionCount = message.mentions.users.size + message.mentions.roles.size;
        const hasEveryone = message.content.includes('@everyone') || message.content.includes('@here');
        
        if (mentionCount > 4 || (hasEveryone && !message.member.permissions.has(PermissionsBitField.Flags.MentionEveryone))) {
            await message.delete().catch(() => {});
            if (message.member && message.member.moderatable) {
                await message.member.timeout(60 * 60 * 1000, 'Zabezpieczenie: Masowe oznaczanie (Mass Mention)'); 
            }
            sendServerLog('🛡️ Tarcza Anty-Rajdowa', `**Użytkownik:** <@${userId}>\n**Kanał:** <#${message.channel.id}>\n**Akcja:** Wiadomość usunięta, Timeout 1h\n**Powód:** Oznaczono ${mentionCount} osób/ról lub użyto @everyone.`);
            const alertMsg = await message.channel.send({ content: `⚠️ <@${userId}>, prosimy nie oznaczać masowo użytkowników!` });
            setTimeout(() => alertMsg.delete().catch(()=>null), 5000);
            return;
        }

        // 3. ORYGINALNY SYSTEM ANTY-SPAM
        const currentTime = Date.now();
        if (!userSpamMap.has(userId)) {
            userSpamMap.set(userId, { timestamps: [], lastMessage: msgContent, duplicateCount: 1 });
        }

        const userData = userSpamMap.get(userId);
        userData.timestamps.push(currentTime);
        userData.timestamps = userData.timestamps.filter(time => currentTime - time < SPAM_TIME);

        if (msgContent === userData.lastMessage && msgContent !== '') {
            userData.duplicateCount++;
        } else {
            userData.lastMessage = msgContent;
            userData.duplicateCount = 1;
        }

        if (userData.timestamps.length >= SPAM_LIMIT || userData.duplicateCount >= SPAM_DUPLICATES) {
            try {
                if (message.member && message.member.moderatable) {
                    await message.member.timeout(TIMEOUT_DURATION, 'System Anty-Spam: Zbyt szybkie pisanie / powielanie tekstu');
                    
                    const fetched = await message.channel.messages.fetch({ limit: 15 });
                    const userMessagesToDelete = fetched.filter(m => m.author.id === userId);
                    await message.channel.bulkDelete(userMessagesToDelete, true).catch(() => {});

                    const alertEmbed = new EmbedBuilder()
                        .setColor('#f23f42')
                        .setAuthor({ name: '🛡️ SYSTEM OBRONNY OS' })
                        .setDescription(`>>> **Zagrożenie:** Wykryto atak spamem.\n**Cel:** <@${userId}>\n**Akcja:** Tymczasowe odcięcie dostępu (5 minut).\n**Status:** Środowisko zabezpieczone.`);
                        
                    const alertMsg = await message.channel.send({ embeds: [alertEmbed] });
                    setTimeout(() => alertMsg.delete().catch(()=>null), 6000);

                    sendServerLog('🛡️ Aktywacja Anty-Spamu', `**Zagrożenie usunięte.**\n**Użytkownik:** <@${userId}>\n**Kanał:** <#${message.channel.id}>\n**Kara:** Timeout na 5 minut\n**Powód:** Spam.`);
                }
            } catch (err) { console.error('Błąd anty-spamu:', err); }
            
            userSpamMap.delete(userId);
            return; 
        }
    }

    // --- KOMENDA: KLONOWANIE UPRAWNIEŃ KANAŁÓW (!sync-perms) ---
    if (message.content.startsWith('!sync-perms') && message.author.id === YOUR_DISCORD_ID) {
        const mentionedChannels = Array.from(message.mentions.channels.values());
        const sourceChannel = mentionedChannels[0];
        const targetChannel = mentionedChannels[1] || message.channel;

        if (!sourceChannel) {
            return message.reply('❌ Użycie: `!sync-perms #wzorcowy-kanal #docelowy-kanal`');
        }

        try {
            const overwrites = sourceChannel.permissionOverwrites.cache.map(o => ({
                id: o.id,
                type: o.type,
                allow: o.allow,
                deny: o.deny
            }));

            await targetChannel.permissionOverwrites.set(overwrites);

            const successEmbed = new EmbedBuilder()
                .setColor(MAIN_COLOR)
                .setAuthor({ name: '🔄 SYNCHRONIZACJA PERMISJI' })
                .setDescription(`>>> **• Wzorzec:** <#${sourceChannel.id}>\n**• Cel:** <#${targetChannel.id}>\n**• Status:** \`Pomyślnie zaktualizowano uprawnienia\`\n**• Wykonał:** <@${message.author.id}>`)
                .setTimestamp()
                .setFooter({ text: 'rapldez OS • Wiadomość zniknie za 5 sekund' });

            const replyMsg = await message.channel.send({ embeds: [successEmbed] });
            await message.delete().catch(() => {});

            setTimeout(() => {
                replyMsg.delete().catch(() => {});
            }, 5000);

            sendServerLog('🔄 Synchronizacja Permisji', `Root <@${message.author.id}> skopiował uprawnienia z <#${sourceChannel.id}> do <#${targetChannel.id}>.`);
        } catch (err) {
            console.error('Błąd sync-perms:', err);
            message.reply('❌ Wystąpił błąd podczas klonowania uprawnień.');
        }
        return;
    }

    // --- KOMENDA: INTERAKTYWNA ANKIETA Z CZASEM (!poll [minuty] | [pytanie] | [opcja1] | [opcja2]) ---
    if (message.content.startsWith('!poll') && message.author.id === YOUR_DISCORD_ID) {
        const argsText = message.content.substring(5).trim();
        const parts = argsText.split('|').map(p => p.trim()).filter(Boolean);

        if (parts.length < 3) {
            return message.reply('❌ Użycie: `!poll [minuty] | [Pytanie] | [Opcja 1] | [Opcja 2]`');
        }

        const minutes = parseInt(parts[0]);
        if (isNaN(minutes) || minutes <= 0) {
            return message.reply('❌ Podaj poprawną liczbę minut jako pierwszy argument, np. `!poll 5 | Pytanie? | Tak | Nie`');
        }

        const question = parts[1];
        const options = parts.slice(2, 7); // Maksymalnie 5 opcji

        if (options.length < 2) {
            return message.reply('❌ Ankieta musi mieć przynajmniej 2 opcje.');
        }

        await message.delete().catch(() => {});

        const endsAt = Date.now() + (minutes * 60 * 1000);
        const unixTime = Math.floor(endsAt / 1000);

        const generatePollDescription = (options, votesMap, isEnded = false) => {
            let totalVotes = 0;
            const counts = options.map((_, idx) => {
                let c = 0;
                if (votesMap) {
                    for (const optIdx of votesMap.values()) {
                        if (optIdx === idx) c++;
                    }
                }
                totalVotes += c;
                return c;
            });

            let desc = `>>> **❓ Pytanie:** \`${question}\`\n\n`;
            if (!isEnded) {
                desc += `**• Zakończenie:** <t:${unixTime}:R> (<t:${unixTime}:f>)\n\n`;
            } else {
                desc += `**• Status:** \`ZAKOŃCZONA\`\n\n`;
            }

            options.forEach((opt, idx) => {
                const count = counts[idx];
                const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const filled = Math.round(percent / 10);
                const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
                desc += `**${idx + 1}.**${opt}\n\`${bar}\` **${percent}%** (\`${count} głosów\`)\n\n`;
            });
            desc += `**• Łącznie głosów:** \`${totalVotes}\``;
            return desc;
        };

        const pollEmbed = new EmbedBuilder()
            .setColor(MAIN_COLOR)
            .setAuthor({ name: '📊 RAPLDEZ OS • SYSTEM ANKIET' })
            .setDescription(generatePollDescription(options, new Map(), false))
            .setFooter({ text: 'rapldez OS • Głosuj za pomocą przycisków' })
            .setTimestamp();

        const row = new ActionRowBuilder();
        options.forEach((_, idx) => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_vote_${idx}`)
                    .setLabel(`${idx + 1}`)
                    .setStyle(ButtonStyle.Secondary)
            );
        });

        const pollMsg = await message.channel.send({ embeds: [pollEmbed], components: [row] });

        await Poll.create({
            messageId: pollMsg.id,
            channelId: message.channel.id,
            question: question,
            options: options,
            endsAt: endsAt,
            ended: false,
            votes: {}
        });

        return;
    }

    const voiceCommands = ['!lock', '!unlock', '!permit', '!reject', '!limit', '!name'];
    const firstWord = message.content.split(' ')[0].toLowerCase();

    if (voiceCommands.includes(firstWord)) {
        let userVoiceChannel = message.member?.voice?.channel;
        
        if (!userVoiceChannel || !tempVoiceChannels.has(userVoiceChannel.id)) {
            for (const [chanId, ownerId] of tempVoiceChannels.entries()) {
                if (ownerId === message.author.id) {
                    userVoiceChannel = message.guild.channels.cache.get(chanId);
                    break;
                }
            }
        }

        if (!userVoiceChannel || !tempVoiceChannels.has(userVoiceChannel.id)) {
            return message.reply('❌ Nie posiadasz aktywnego pokoju prywatnego lub w nim nie przebywasz.').then(m => setTimeout(() => m.delete().catch(()=>null), 4000));
        }

        const channelOwnerId = tempVoiceChannels.get(userVoiceChannel.id);
        if (channelOwnerId !== message.author.id && message.author.id !== YOUR_DISCORD_ID) {
            return message.reply('❌ Nie jesteś właścicielem tego pokoju głosowego.').then(m => setTimeout(() => m.delete().catch(()=>null), 4000));
        }

        const args = message.content.split(' ');

        if (firstWord === '!lock') {
            await userVoiceChannel.permissionOverwrites.edit(message.guild.id, { Connect: false });
            return message.reply('🔒 Twój pokój został zablokowany dla wszystkich.');
        }

        if (firstWord === '!unlock') {
            await userVoiceChannel.permissionOverwrites.edit(message.guild.id, { Connect: null });
            return message.reply('🔓 Twój pokój został odblokowany.');
        }

        if (firstWord === '!permit') {
            const target = message.mentions.members.first();
            if (!target) return message.reply('Podaj użytkownika: `!permit @user`');
            await userVoiceChannel.permissionOverwrites.edit(target.id, { Connect: true });
            return message.reply(`✅ <@${target.id}> otrzymał stały dostęp do Twojego pokoju.`);
        }

        if (firstWord === '!reject') {
            const target = message.mentions.members.first();
            if (!target) return message.reply('Podaj użytkownika: `!reject @user`');
            await userVoiceChannel.permissionOverwrites.edit(target.id, { Connect: false });
            if (target.voice?.channelId === userVoiceChannel.id) {
                await target.voice.disconnect().catch(() => {});
            }
            return message.reply(`🚫 <@${target.id}> został zablokowany i usunięty z pokoju.`);
        }

        if (firstWord === '!limit') {
            const limit = parseInt(args[1]);
            if (isNaN(limit) || limit < 0 || limit > 99) return message.reply('Podaj poprawną liczbę slotów (0-99): `!limit 2`');
            await userVoiceChannel.setUserLimit(limit);
            return message.reply(`👥 Zmieniono limit osób na kanale na: \`${limit === 0 ? 'Bez limitu' : limit}\`.`);
        }

        if (firstWord === '!name') {
            const newName = args.slice(1).join(' ');
            if (!newName) return message.reply('Podaj nową nazwę pokoju: `!name Moja Ekipa`');
            await userVoiceChannel.setName(`🔒 | ${newName}`);
            return message.reply(`✏️ Nazwa Twojego pokoju została zmieniona na: \`🔒 | ${newName}\`.`);
        }
    }

    if (message.content.startsWith('!clear') && message.author.id === YOUR_DISCORD_ID) {
        const amount = parseInt(message.content.split(' ')[1]);
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('Podaj liczbę (1-100)').then(m => setTimeout(() => m.delete().catch(()=>null), 3000));

        await message.delete().catch(() => null);
        const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);
        if (deleted) {
            const msg = await message.channel.send({ embeds: [createLogEmbed('🛠️ PANEL KONTROLNY', `>>> **Status:** Pomyślnie usunięto wiadomości.\n**Zlikwidowano:** \`${deleted.size}\` sztuk.`).setFooter({ text: 'Wiadomość ulegnie autodestrukcji za 5s' })] });
            setTimeout(() => msg.delete().catch(() => null), 5000);
            sendServerLog('🧹 Masowe czyszczenie (Purge)', `Użytkownik <@${message.author.id}> usunął \`${deleted.size}\` wiadomości na kanale <#${message.channel.id}>.`);
        }
    }

    if (message.content.startsWith('!warn') && message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        const args = message.content.split(' ');
        const targetUser = message.mentions.users.first();
        const reason = args.slice(2).join(' ') || 'Brak powodu';
        if (!targetUser) return message.reply('Oznacz użytkownika, np. `!warn @user spam`');
        
        await Warn.create({ userId: targetUser.id, reason: reason, adminId: message.author.id, date: formatDatePL(new Date()) });
        message.channel.send({ embeds: [createLogEmbed('⚠️ OSTRZEŻENIE', `Użytkownik <@${targetUser.id}> otrzymał ostrzeżenie.\n**Powód:** ${reason}`)] });
        sendServerLog('⚠️ Nadano ostrzeżenie', `**Admin:** <@${message.author.id}>\n**Ukarany:** <@${targetUser.id}>\n**Powód:** ${reason}`);
    }

    if (message.content.startsWith('!kick') && message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        const args = message.content.split(' ');
        const targetMember = message.mentions.members.first();
        const reason = args.slice(2).join(' ') || 'Brak powodu';
        if (!targetMember) return message.reply('Oznacz użytkownika: `!kick @user powód`');
        if (!targetMember.kickable) return message.reply('Nie mogę wyrzucić tego użytkownika.');

        await targetMember.kick(reason).catch(() => null);
        message.channel.send({ embeds: [createLogEmbed('👢 WYRZUCENIE', `<@${targetMember.id}> został wyrzucony.\n**Powód:** ${reason}`)] });
        sendServerLog('👢 Wyrzucenie z serwera (Kick)', `**Admin:** <@${message.author.id}>\n**Ukarany:** <@${targetMember.id}>\n**Powód:** ${reason}`);
    }

    if (message.content.startsWith('!ban') && message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        const args = message.content.split(' ');
        const targetMember = message.mentions.members.first();
        const reason = args.slice(2).join(' ') || 'Brak powodu';
        if (!targetMember) return message.reply('Oznacz użytkownika: `!ban @user powód`');
        if (!targetMember.bannable) return message.reply('Nie mogę zbanować tego użytkownika.');

        await targetMember.ban({ reason }).catch(() => null);
        message.channel.send({ embeds: [createLogEmbed('🔨 BAN', `<@${targetMember.id}> został zbanowany.\n**Powód:** ${reason}`)] });
    }

    if (message.content.startsWith('!userinfo')) {
        const targetMember = message.mentions.members.first() || message.member;
        const warnCount = await Warn.countDocuments({ userId: targetMember.id });
        const roles = targetMember.roles.cache.filter(r => r.id !== message.guild.id).map(r => `<@&${r.id}>`).join(', ') || 'Brak ról';
        
        const embed = new EmbedBuilder()
            .setColor(MAIN_COLOR)
            .setAuthor({ name: `Informacje o użytkowniku: ${targetMember.user.tag}`, iconURL: targetMember.user.displayAvatarURL() })
            .addFields(
                { name: '📅 Dołączył na serwer', value: `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '📝 Konto utworzone', value: `<t:${Math.floor(targetMember.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '⚠️ Ilość ostrzeżeń', value: `\`${warnCount}\``, inline: true },
                { name: '🏷️ Posiadane role', value: roles, inline: false }
            )
            .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `ID: ${targetMember.id}` })
            .setTimestamp();
            
        await message.channel.send({ embeds: [embed] });
    }

    if (message.content.startsWith('!clone-role') && message.author.id === YOUR_DISCORD_ID) {
        const args = message.content.split(' ');
        const targetRole = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
        const newName = args.slice(2).join(' ') || `${targetRole.name} - Kopia`;
        if (!targetRole) return message.reply('Oznacz rolę do sklonowania: `!clone-role @rola Nowa Nazwa`');
        try {
            const cloned = await message.guild.roles.create({
                name: newName, color: targetRole.color, hoist: targetRole.hoist,
                permissions: targetRole.permissions, mentionable: targetRole.mentionable
            });
            message.reply(`✅ Rola sklonowana pomyślnie: <@&${cloned.id}>`);
        } catch (err) { message.reply('Błąd podczas klonowania.'); }
    }

    if (message.content.startsWith('!setup-verify') && message.author.id === YOUR_DISCORD_ID) {
        const role = message.mentions.roles.first();
        if (!role) return message.reply('Musisz oznaczyć rolę, np. `!setup-verify @Użytkownik`');
        await message.delete().catch(()=>null);
        const embed = new EmbedBuilder().setColor(MAIN_COLOR).setTitle('✅ Weryfikacja konta').setDescription('Witamy na serwerze! Aby uzyskać pełny dostęp do kanałów, musisz potwierdzić, że zapoznałeś się z regulaminem.\n\nKliknij przycisk poniżej, aby odblokować serwer.').setFooter({ text: 'rapldez OS • System bezpieczeństwa' });
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`verify_role_${role.id}`).setLabel('Zweryfikuj się').setStyle(ButtonStyle.Success).setEmoji('🛡️'));
        await message.channel.send({ embeds: [embed], components: [row] });
    }

    if (message.content === '!backup' && message.author.id === YOUR_DISCORD_ID) {
        const data = JSON.stringify({ statystyki: await Counter.find(), archiwum_ticketow: await TicketArchive.find(), warny: await Warn.find() }, null, 2);
        await message.reply({ content: '📦 **Backup:**', files: [new AttachmentBuilder(Buffer.from(data, 'utf-8'), { name: `backup_${Date.now()}.json` })] });
    }
});

client.on('messageDelete', message => {
    if (message.author?.bot) return;
    sendServerLog('🗑️ Usunięcie wiadomości', `**Autor:** <@${message.author?.id}>\n**Kanał:** <#${message.channel.id}>\n**Treść:**\n\`\`\`text\n${message.content || '[Brak tekstu / Plik]'}\n\`\`\``);
});

client.on('messageUpdate', (oldMsg, newMsg) => {
    if (oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
    let action = '✏️ Edycja wiadomości';
    if (!oldMsg.pinned && newMsg.pinned) action = '📌 Przypięcie wiadomości';
    if (oldMsg.pinned && !newMsg.pinned) action = '📍 Odpięcie wiadomości';
    sendServerLog(action, `**Autor:** <@${oldMsg.author?.id}>\n**Kanał:** <#${oldMsg.channel.id}>\n\n**Przed:**\n\`\`\`text\n${oldMsg.content || 'Brak'}\n\`\`\`**Po:**\n\`\`\`text\n${newMsg.content || 'Brak'}\n\`\`\``);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const user = `<@${newState.id}>`;
    
    if (!oldState.channelId && newState.channelId) sendServerLog('🔊 Dołączenie do kanału głosowego', `Członek ${user} wszedł na kanał <#${newState.channelId}>.`);
    else if (oldState.channelId && !newState.channelId) sendServerLog('🔇 Opuszczenie kanału głosowego', `Członek ${user} opuścił kanał <#${oldState.channelId}>.`);
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) sendServerLog('🔀 Przełączenie kanału głosowego', `Członek ${user} przeszedł z <#${oldState.channelId}> na <#${newState.channelId}>.`);
    else {
        if (!oldState.serverMute && newState.serverMute) sendServerLog('🎙️ Wyciszenie na kanale (Mute)', `${user} wyciszony serwerowo.`);
        if (!oldState.serverDeaf && newState.serverDeaf) sendServerLog('🎧 Ogłuszenie (Deafen)', `${user} ogłuszony serwerowo.`);
    }

    try {
        if (newState.channelId === VOICE_CREATOR_CHANNEL_ID) {
            const guild = newState.guild;
            const member = newState.member;
            const channelName = `🔒 | Prywatny pokój: ${member.displayName || member.user.username}`;

            const createdChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                parent: CATEGORY_ID,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
                    },
                    {
                        id: member.id,
                        allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak, PermissionsBitField.Flags.MuteMembers, PermissionsBitField.Flags.DeafenMembers, PermissionsBitField.Flags.MoveMembers],
                    }
                ]
            });

            await member.voice.setChannel(createdChannel).catch(() => {});
            tempVoiceChannels.set(createdChannel.id, member.id);

            createdChannel.send({
                content: `👋 <@${member.id}> Oto Twój pokój prywatny!\n**Dostępne komendy:**\n• \`!lock\` / \`!unlock\` - blokuj/odblokuj pokój\n• \`!permit @user\` / \`!reject @user\` - zarządzaj gośćmi\n• \`!limit [liczba]\` - ustaw limit osób\n• \`!name [nazwa]\` - zmień nazwę pokoju`
            }).catch(() => {});
        }

        if (oldState.channelId && oldState.channelId !== VOICE_CREATOR_CHANNEL_ID) {
            const oldChannel = oldState.channel;
            if (oldChannel && tempVoiceChannels.has(oldChannel.id) && oldChannel.members.size === 0) {
                tempVoiceChannels.delete(oldChannel.id);
                await oldChannel.delete().catch(() => {});
            }
        }
    } catch (err) {
        console.error('Błąd systemu kanałów głosowych:', err);
    }
});

// --- INVITE LOGGER & GUILD MEMBER EVENTS ---
client.on('guildMemberAdd', async member => {
    let inviteInfo = 'Nieznane / Vanity / Direct';
    try {
        const cachedInvites = guildInvitesCache.get(member.guild.id);
        const newInvites = await member.guild.invites.fetch();
        
        if (cachedInvites) {
            const usedInvite = newInvites.find(inv => {
                const prev = cachedInvites.get(inv.code);
                return prev && inv.uses > prev.uses;
            });

            if (usedInvite) {
                const inviter = usedInvite.inviter;
                inviteInfo = `Kod: \`${usedInvite.code}\` | Zaprosił: ${inviter ? `<@${inviter.id}> (\`${inviter.tag}\`)` : 'Nieznany'} (Użyć: \`${usedInvite.uses}\`)`;
            } else if (member.guild.vanityURLCode) {
                inviteInfo = `Własny link serwera (Vanity): \`${member.guild.vanityURLCode}\``;
            }
        }

        const currentInvMap = new Map();
        newInvites.forEach(inv => currentInvMap.set(inv.code, { uses: inv.uses, inviterId: inv.inviter?.id }));
        guildInvitesCache.set(member.guild.id, currentInvMap);
    } catch (e) {
        console.error('Błąd InviteLogger:', e);
    }

    const isYoungAccount = (Date.now() - member.user.createdTimestamp) < 604800000;
    const logDesc = `>>> **• Użytkownik:** <@${member.id}> (\`${member.user.tag}\`)\n` +
                    `**• Źródło zaproszenia:** ${inviteInfo}\n` +
                    `**• Wiek konta:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>${isYoungAccount ? ' ⚠️ **(Młode konto!)**' : ''}`;

    sendServerLog('📥 Dołączenie członka (Invite Tracker)', logDesc);
});

client.on('inviteCreate', async invite => {
    const cached = guildInvitesCache.get(invite.guild.id) || new Map();
    cached.set(invite.code, { uses: invite.uses, inviterId: invite.inviter?.id });
    guildInvitesCache.set(invite.guild.id, cached);
});

client.on('inviteDelete', async invite => {
    const cached = guildInvitesCache.get(invite.guild.id);
    if (cached) cached.delete(invite.code);
});

client.on('guildMemberRemove', member => sendServerLog('📤 Opuszczenie serwera', `Członek <@${member.id}> opuścił serwer.`));
client.on('guildMemberUpdate', (oldM, newM) => {
    if (oldM.nickname !== newM.nickname) sendServerLog('📝 Zmiana pseudonimu', `<@${newM.id}> zmienił nick na \`${newM.nickname || newM.user.username}\`.`);
    if (!oldM.isCommunicationDisabled() && newM.isCommunicationDisabled()) sendServerLog('⏳ Timeout', `<@${newM.id}> wyciszony do <t:${Math.floor(newM.communicationDisabledUntilTimestamp/1000)}:F>.`);
});

client.on('channelCreate', c => sendServerLog('📁 Utworzenie kanału', `Dodano kanał: <#${c.id}>`));
client.on('channelDelete', c => sendServerLog('🗑️ Usunięcie kanału', `Usunięto kanał: \`${c.name}\``));
client.on('roleCreate', r => sendServerLog('🛡️ Utworzenie roli', `Utworzono rolę: <@&${r.id}>`));
client.on('roleDelete', r => sendServerLog('🗑️ Usunięcie roli', `Usunięto rolę: \`${r.name}\``));
client.on('guildBanAdd', ban => sendServerLog('🔨 Zbanowanie członka', `Zbanowano \`${ban.user.tag}\`.`));
client.on('guildBanRemove', ban => sendServerLog('🕊️ Odbanowanie członka', `Odbanowano \`${ban.user.tag}\`.`));

// Pętla sprawdzająca zakończenie ankiet oraz konkursów
setInterval(async () => {
    try {
        const now = Date.now();

        // Ankiety
        const activePolls = await Poll.find({ ended: false, endsAt: { $lte: now } });
        for (const poll of activePolls) {
            poll.ended = true;
            await poll.save();

            const channel = client.channels.cache.get(poll.channelId);
            if (!channel) continue;

            const msg = await channel.messages.fetch(poll.messageId).catch(() => null);
            if (!msg) continue;

            const generatePollDescription = (options, votesMap) => {
                let totalVotes = 0;
                const counts = options.map((_, idx) => {
                    let c = 0;
                    if (votesMap) {
                        for (const optIdx of votesMap.values()) {
                            if (optIdx === idx) c++;
                        }
                    }
                    totalVotes += c;
                    return c;
                });

                let desc = `>>> **❓ Pytanie:** \`${poll.question}\`\n\n**• Status:** \`ZAKOŃCZONA\`\n\n`;
                options.forEach((opt, idx) => {
                    const count = counts[idx];
                    const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    const filled = Math.round(percent / 10);
                    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
                    desc += `**${idx + 1}.**${opt}\n\`${bar}\` **${percent}%** (\`${count} głosów\`)\n\n`;
                });
                desc += `**• Łącznie głosów:** \`${totalVotes}\``;
                return desc;
            };

            const originalEmbed = msg.embeds[0];
            const finalEmbed = new EmbedBuilder()
                .setColor(originalEmbed.color || MAIN_COLOR)
                .setAuthor({ name: '📊 RAPLDEZ OS • ANKIETA ZAKOŃCZONA' })
                .setDescription(generatePollDescription(poll.options, poll.votes))
                .setFooter({ text: 'rapldez OS • Wyniki końcowe' })
                .setTimestamp();

            await msg.edit({ embeds: [finalEmbed], components: [] }).catch(() => null);
        }

        // Giveaways
        const activeGiveaways = await Giveaway.find({ ended: false, endsAt: { $lte: now } });
        for (const g of activeGiveaways) {
            g.ended = true;
            await g.save();

            const channel = client.channels.cache.get(g.channelId);
            if (!channel) continue;

            const msg = await channel.messages.fetch(g.messageId).catch(() => null);
            let winnerId = null;
            if (g.participants.length > 0) {
                winnerId = g.participants[Math.floor(Math.random() * g.participants.length)];
            }

            const endEmbed = new EmbedBuilder()
                .setColor(winnerId ? '#23a559' : '#f23f42')
                .setAuthor({ name: '🎉 KONKURS ZAKOŃCZONY' })
                .setTitle(g.prize)
                .setDescription(winnerId 
                    ? `>>> **• Zwycięzca:** <@${winnerId}>\n**• Nagroda:** \`${g.prize}\`\n**• Uczestników:** \`${g.participants.length}\``
                    : `>>> **• Nagroda:** \`${g.prize}\`\n**• Zwycięzca:** Brak (brak uczestników)`)
                .setFooter({ text: 'rapldez OS • Wyniki' })
                .setTimestamp();

            if (msg) {
                await msg.edit({ embeds: [endEmbed], components: [] }).catch(() => null);
            }

            if (winnerId) {
                await channel.send({ content: `🎉 Gratulacje <@${winnerId}>! Wygrałeś: **${g.prize}**!` });
                sendServerLog('🎁 Zakończono Giveaway', `Nagroda: **${g.prize}**\nZwycięzca: <@${winnerId}>\nKanał: <#${g.channelId}>`);
            }
        }
    } catch (e) {
        console.error('Błąd pętli czasowej:', e);
    }
}, 10 * 1000);

// --- CYBERNETYCZNE CENTRUM DOWODZENIA (STATUS Z TELEMETRIĄ) ---
client.once('ready', async () => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => { console.log(`Serwer działa na porcie ${PORT}!`); });

    try {
        const guild = client.guilds.cache.get(SERVER_ID);
        if (guild) {
            const firstInvites = await guild.invites.fetch();
            const invMap = new Map();
            firstInvites.forEach(inv => invMap.set(inv.code, { uses: inv.uses, inviterId: inv.inviter?.id }));
            guildInvitesCache.set(guild.id, invMap);
        }
    } catch (e) {
        console.error('Błąd wstępnego buforowania zaproszeń:', e);
    }

    try {
        const statusChannel = client.channels.cache.get(STATUS_CHANNEL_ID);
        if (statusChannel) {
            const fetchedMessages = await statusChannel.messages.fetch({ limit: 10 });
            if (fetchedMessages.size > 0) {
                await statusChannel.bulkDelete(fetchedMessages, true).catch(() => {});
            }

            const getStatusEmbed = () => {
                const memoryUsage = process.memoryUsage().rss / 1024 / 1024;
                const uptimeSeconds = process.uptime();
                const hours = Math.floor(uptimeSeconds / 3600);
                const minutes = Math.floor((uptimeSeconds % 3600) / 60);
                
                const ramPercent = Math.min(Math.round((memoryUsage / 500) * 100), 100);
                const filledBlocks = Math.round(ramPercent / 10);
                const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(10 - filledBlocks);

                return new EmbedBuilder()
                    .setColor(MAIN_COLOR)
                    .setAuthor({ name: '🟢 RAPLDEZ OS • CYBERNETYCZNE CENTRUM DOWODZENIA' })
                    .setDescription(
                        `>>> **• 🤖 Stan Bota:** \`Online (Stabilny)\`\n` +
                        `**• 🌐 Stan Strony:** \`Online (Render Cloud)\`\n` +
                        `**• 🗄️ Stan Bazy Danych:** \`${dbStatus}\`\n` +
                        `**• 📶 Aktualny Ping:** \`${client.ws.ping}ms\`\n` +
                        `**• ⏳ Uptime Systemu:** \`${hours}h ${minutes}m\`\n\n` +
                        `**📊 Zużycie RAM (${memoryUsage.toFixed(1)} MB / 500 MB):**\n` +
                        `\`${progressBar}\` \`${ramPercent}%\``
                    )
                    .setTimestamp()
                    .setFooter({ text: 'rapldez.onrender.com • Live Telemetry' });
            };

            const statusRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('status_restart_bot').setLabel('Restart Bota').setStyle(ButtonStyle.Danger).setEmoji('🔄'),
                new ButtonBuilder().setCustomId('status_refresh').setLabel('Odśwież Telemetrię').setStyle(ButtonStyle.Secondary).setEmoji('📊')
            );

            const statusMsg = await statusChannel.send({ embeds: [getStatusEmbed()], components: [statusRow] });

            setInterval(async () => {
                try {
                    await statusMsg.edit({ embeds: [getStatusEmbed()], components: [statusRow] });
                } catch (e) {}
            }, 60 * 1000);
        }
    } catch (e) {
        console.error('Błąd monitora statusu:', e);
    }
});

// --- INTERAKCJE (PRZYCISKI, GIVEAWAY, TICKETY, ANKIETY) ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    // Obsługa głosowania w ankietach
    if (interaction.customId.startsWith('poll_vote_')) {
        try {
            const poll = await Poll.findOne({ messageId: interaction.message.id });

            if (!poll) {
                return interaction.reply({ content: '❌ Ta ankieta już nie istnieje w bazie.', ephemeral: true });
            }

            if (poll.ended || Date.now() >= poll.endsAt) {
                return interaction.reply({ content: '❌ Czas na głosowanie w tej ankiecie dobiegł końca!', ephemeral: true });
            }

            const optionIndex = parseInt(interaction.customId.split('_')[2]);
            const userId = interaction.user.id;
            const currentVotes = poll.votes instanceof Map ? poll.votes : new Map(Object.entries(poll.votes || {}));
            
            currentVotes.set(userId, optionIndex);
            poll.votes = currentVotes;
            await poll.save();

            const generatePollDescription = (options, votesMap) => {
                let totalVotes = 0;
                const counts = options.map((_, idx) => {
                    let c = 0;
                    if (votesMap) {
                        for (const optIdx of votesMap.values()) {
                            if (optIdx === idx) c++;
                        }
                    }
                    totalVotes += c;
                    return c;
                });

                const unixTime = Math.floor(poll.endsAt / 1000);
                let desc = `>>> **❓ Pytanie:** \`${poll.question}\`\n\n**• Zakończenie:** <t:${unixTime}:R> (<t:${unixTime}:f>)\n\n`;
                options.forEach((opt, idx) => {
                    const count = counts[idx];
                    const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    const filled = Math.round(percent / 10);
                    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
                    desc += `**${idx + 1}.**${opt}\n\`${bar}\` **${percent}%** (\`${count} głosów\`)\n\n`;
                });
                desc += `**• Łącznie głosów:** \`${totalVotes}\``;
                return desc;
            };

            const originalEmbed = interaction.message.embeds[0];
            const updatedEmbed = new EmbedBuilder()
                .setColor(originalEmbed.color || MAIN_COLOR)
                .setAuthor(originalEmbed.author ? { name: originalEmbed.author.name } : { name: '📊 RAPLDEZ OS • SYSTEM ANKIET' })
                .setDescription(generatePollDescription(poll.options, currentVotes))
                .setFooter({ text: 'rapldez OS • Głosuj za pomocą przycisków' })
                .setTimestamp(new Date(originalEmbed.timestamp || Date.now()));

            await interaction.update({ embeds: [updatedEmbed] });
            return interaction.followUp({ content: `✅ Twój głos został zapisany na opcję **nr ${optionIndex + 1}**!`, ephemeral: true });
        } catch (e) {
            console.error('Błąd ankiety:', e);
            return interaction.reply({ content: '❌ Wystąpił błąd podczas rejestrowania głosu.', ephemeral: true });
        }
    }

    if (interaction.customId === 'join_giveaway') {
        try {
            const g = await Giveaway.findOne({ messageId: interaction.message.id, ended: false });
            if (!g) {
                return interaction.reply({ content: '❌ Ten konkurs już się zakończył.', ephemeral: true });
            }

            let left = false;
            if (g.participants.includes(interaction.user.id)) {
                g.participants = g.participants.filter(id => id !== interaction.user.id);
                left = true;
            } else {
                g.participants.push(interaction.user.id);
            }
            await g.save();

            const unixTime = Math.floor(g.endsAt / 1000);
            const originalEmbed = interaction.message.embeds[0];
            
            const updatedEmbed = new EmbedBuilder()
                .setColor(originalEmbed.color || MAIN_COLOR)
                .setAuthor(originalEmbed.author ? { name: originalEmbed.author.name } : { name: '🎉 ROZPOCZĘTO KONKURS (GIVEAWAY)' })
                .setTitle(g.prize)
                .setDescription(`>>> **• Nagroda:** \`${g.prize}\`\n**• Zakończenie:** <t:${unixTime}:R>\n**• Dokładna data:** <t:${unixTime}:f>\n**• Uczestnicy:** \`${g.participants.length}\`\n\nKliknij przycisk poniżej, aby dołączyć!`)
                .setFooter({ text: 'rapldez OS • Konkursy' })
                .setTimestamp(new Date(originalEmbed.timestamp || Date.now()));

            await interaction.update({ embeds: [updatedEmbed] });
            return interaction.followUp({ content: left ? '👋 Opuściłeś losowanie.' : '🎉 Zostałeś pomyślnie dodany do losowania! Powodzenia.', ephemeral: true });
        } catch (e) {
            console.error(e);
            return interaction.reply({ content: 'Błąd podczas zapisywania.', ephemeral: true });
        }
    }

    if (interaction.customId === 'status_restart_bot' || interaction.customId === 'status_refresh') {
        if (interaction.user.id !== YOUR_DISCORD_ID) {
            return interaction.reply({ content: '❌ Odmowa dostępu. Ten przycisk jest zarezerwowany dla właściciela systemu.', ephemeral: true });
        }
        
        if (interaction.customId === 'status_restart_bot') {
            await interaction.reply({ content: '🔄 Wykonuję zdalny restart bota...', ephemeral: true });
            logToTerminalDiscord('🔄 Zdalny Restart', `Zainicjowany przez <@${interaction.user.id}> poprzez panel statusu.`);
            setTimeout(() => process.exit(1), 1000);
        } else if (interaction.customId === 'status_refresh') {
            const memoryUsage = process.memoryUsage().rss / 1024 / 1024;
            const uptimeSeconds = process.uptime();
            const hours = Math.floor(uptimeSeconds / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            const ramPercent = Math.min(Math.round((memoryUsage / 500) * 100), 100);
            const filledBlocks = Math.round(ramPercent / 10);
            const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(10 - filledBlocks);

            const getStatusEmbed = () => new EmbedBuilder()
                .setColor(MAIN_COLOR)
                .setAuthor({ name: '🟢 RAPLDEZ OS • CYBERNETYCZNE CENTRUM DOWODZENIA' })
                .setDescription(
                    `>>> **• 🤖 Stan Bota:** \`Online (Stabilny)\`\n` +
                    `**• 🌐 Stan Strony:** \`Online (Render Cloud)\`\n` +
                    `**• 🗄️ Stan Bazy Danych:** \`${dbStatus}\`\n` +
                    `**• 📶 Aktualny Ping:** \`${client.ws.ping}ms\`\n` +
                    `**• ⏳ Uptime Systemu:** \`${hours}h ${minutes}m\`\n\n` +
                    `**📊 Zużycie RAM (${memoryUsage.toFixed(1)} MB / 500 MB):**\n` +
                    `\`${progressBar}\` \`${ramPercent}%\``
                )
                .setTimestamp()
                .setFooter({ text: 'rapldez.onrender.com • Live Telemetry' });

            const statusRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('status_restart_bot').setLabel('Restart Bota').setStyle(ButtonStyle.Danger).setEmoji('🔄'),
                new ButtonBuilder().setCustomId('status_refresh').setLabel('Odśwież Telemetrię').setStyle(ButtonStyle.Secondary).setEmoji('📊')
            );

            await interaction.update({ embeds: [getStatusEmbed()], components: [statusRow] });
        }
        return;
    }

    if (interaction.customId.startsWith('custom_btn_')) {
        await interaction.reply({ content: 'Przycisk interaktywny wygenerowany z panelu.', ephemeral: true });
        return;
    }

    if (interaction.customId.startsWith('verify_role_')) {
        const roleId = interaction.customId.split('verify_role_')[1];
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.reply({ content: '❌ Błąd: Rola weryfikacyjna już nie istnieje.', ephemeral: true });
        if (interaction.member.roles.cache.has(roleId)) return interaction.reply({ content: 'Jesteś już zweryfikowany!', ephemeral: true });

        try {
            await interaction.member.roles.add(role);
            await interaction.reply({ content: '✅ Zostałeś pomyślnie zweryfikowany! Uzyskałeś dostęp do serwera.', ephemeral: true });
            sendServerLog('🛡️ Pomyślna Weryfikacja', `Użytkownik <@${interaction.user.id}> zweryfikował się przez system i otrzymał rolę <@&${roleId}>.`);
        } catch (err) {
            await interaction.reply({ content: '❌ Błąd uprawnień bota przy nadawaniu roli.', ephemeral: true });
        }
        return;
    }

    const topic = interaction.channel.topic || '';
    const parts = topic.split('|');
    let targetId = parts[0] || 'brak_id';
    let createdAtStr = parts[1] || formatDatePL(new Date());

    if (interaction.customId === 'close_ticket') {
        await interaction.deferUpdate();
        const closedAtStr = formatDatePL(new Date());
        await interaction.channel.setTopic(`${targetId}|${createdAtStr}|${closedAtStr}`).catch(() => null);
        
        if (targetId && targetId !== 'brak_id') {
            await interaction.channel.permissionOverwrites.edit(targetId, { ViewChannel: false }).catch(() => null);
        }

        const ticketNumber = interaction.channel.name.replace(/[^0-9]/g, '') || '1';
        await interaction.channel.setName(`rozwiązany-${ticketNumber}`).catch(() => null);

        const reopenRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_ticket').setLabel('Otwórz ponownie').setStyle(ButtonStyle.Success).setEmoji('🔓'),
            new ButtonBuilder().setCustomId('archive_ticket').setLabel('Archiwizuj i Usuń').setStyle(ButtonStyle.Danger).setEmoji('📁')
        );
        
        await interaction.message.edit({ content: `🔒 Zgłoszenie zamknięte i oznaczone jako rozwiązane (${closedAtStr}).`, components: [reopenRow] }).catch(() => null);
    }

    if (interaction.customId === 'open_ticket') {
        await interaction.deferUpdate();
        
        if (targetId && targetId !== 'brak_id') {
            await interaction.channel.permissionOverwrites.edit(targetId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => null);
        }
        
        const ticketNumber = interaction.channel.name.replace(/[^0-9]/g, '') || '1';
        
        setTimeout(async () => {
            await interaction.channel.setName(`zgłoszenie-${ticketNumber}`).catch(() => null);
        }, 1000);

        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Zamknij').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('archive_ticket').setLabel('Archiwizuj i Usuń').setStyle(ButtonStyle.Danger).setEmoji('📁')
        );
        
        await interaction.message.edit({ content: `🔓 Zgłoszenie zostało ponownie otwarte.`, components: [closeRow] }).catch(() => null);
    }

    if (interaction.customId === 'archive_ticket') {
        await interaction.reply('📁 Generuję archiwum...');
        try {
            let messages = await interaction.channel.messages.fetch({ limit: 100 });
            messages = Array.from(messages.values()).reverse();
            const participantsSet = new Set();
            messages.forEach(m => { if (!m.author.bot) participantsSet.add(m.author.username); });
            const participantsList = participantsSet.size > 0 ? Array.from(participantsSet).join(', ') : 'Brak interakcji';

            let closedAtStr = parts[2] && parts[2] !== 'Brak' ? parts[2] : formatDatePL(new Date());
            const archivedAtStr = formatDatePL(new Date());

            let htmlContent = `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><title>Archiwum</title><style>body{background:#313338;color:#dbdee1;font-family:sans-serif;padding:20px}.message{margin-bottom:15px}.author{font-weight:bold;color:#f2f3f5}.content{background:#2b2d31;padding:10px;border-radius:6px;display:inline-block}</style></head><body><h2>Archiwum: ${interaction.channel.name}</h2>`;
            messages.forEach(m => { htmlContent += `<div class="message"><span class="author">${m.author.username}</span> <span style="font-size:11px;color:#949ba4">${formatDatePL(m.createdAt)}</span><br><div class="content">${m.content || '[Media]'}</div></div>`; });
            htmlContent += `</body></html>`;

            await TicketArchive.create({
                channelName: interaction.channel.name,
                messagesCount: messages.length,
                participants: Array.from(participantsSet),
                createdAt: createdAtStr,
                closedAt: closedAtStr,
                archivedAt: archivedAtStr,
                archivedBy: interaction.user.username,
                htmlContent: htmlContent
            });

            const embedLog = new EmbedBuilder()
                .setColor(MAIN_COLOR)
                .setAuthor({ name: '📁 ARCHIWUM ZGŁOSZENIA' })
                .setDescription(`>>> **• Kanał:** \`${interaction.channel.name}\`\n**• Wiadomości:** \`${messages.length}\`\n**• Uczestnicy:** \`${participantsList}\`\n**• Otwarcie:** \`${createdAtStr}\`\n**• Zamknięcie:** \`${closedAtStr}\`\n**• Archiwizacja:** \`${archivedAtStr}\`\n**• Zarchiwizował:** <@${interaction.user.id}>`)
                .setFooter({ text: 'rapldez.onrender.com' }).setTimestamp();

            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) await logChannel.send({ embeds: [embedLog] });
        } catch (err) {
            console.error(err);
        }
        setTimeout(() => { interaction.channel.delete().catch(() => null); }, 4000);
    }
});

// --- SYSTEM: AUTO-BLOKADA PODEJRZANYCH DOMEN (ANTY-PHISHING) ---
// Lista domen, które chcesz całkowicie blokować na serwerie
const BLOCKED_DOMAINS = [
    'steam-gift.com', 
    'discord-nitro.ru', 
    'free-nitros.link',
    'nitro-discord.gg'
    // Możesz dopisywać kolejne podejrzane adresy w cudzysłowach po przecinku
];

client.on('messageCreate', async message => {
    // Ignorujemy wiadomości od botów i wiadomości prywatne (DM)
    if (message.author.bot || !message.guild) return;

    const contentLower = message.content.toLowerCase();
    
    // Sprawdzamy, czy wiadomość zawiera którąś z zablokowanych domen
    const isSuspicious = BLOCKED_DOMAINS.some(domain => contentLower.includes(domain));

    if (isSuspicious) {
        try {
            // 1. Kasujemy wiadomość z podejrzanym linkiem
            await message.delete();

            // 2. Wysyłamy ostrzeżenie na kanale
            const warningMsg = await message.channel.send(`⚠️ ${message.author}, Twoja wiadomość została usunięta, ponieważ zawierała potencjalnie niebezpieczną lub zablokowaną domenę!`);
            
            // Usuwamy ostrzeżenie po 5 sekundach, żeby nie śmiecić na czacie
            setTimeout(() => warningMsg.delete().catch(() => {}), 5000);

            // 3. (Opcjonalnie) Możesz też wysłać log do swojego kanału administracyjnego
            // console.log(`[ANTY-PHISHING] Zablokowano link od ${message.author.tag}: ${message.content}`);

        } catch (error) {
            console.error('Błąd podczas usuwania podejrzanego linku:', error);
        }
    }
});

// --- SYSTEM: GHOST PING DETEKTOR ---
client.on('messageDelete', async message => {
    // Ignorujemy wiadomości od botów, brak gildii lub wiadomości bez treści/wzmianek
    if (message.author?.bot || !message.guild || message.mentions.users.size === 0) return;

    // Pobieramy osoby, które zostały oznaczone
    const mentionedUsers = message.mentions.users.map(user => user.tag).join(', ');

    // Tworzymy czytelny komunikat o ghost pingu
    const logEmbed = {
        color: 0xffcc00,
        title: '👻 Wykryto Ghost Ping!',
        fields: [
            { name: 'Autor wiadomości', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: 'Oznaczone osoby', value: mentionedUsers, inline: true },
            { name: 'Treść skasowanej wiadomości', value: message.content || '[Brak tekstu / sam embed lub załącznik]' }
        ],
        timestamp: new Date().toISOString()
    };

    // Tutaj wpisz ID swojego kanału logów (możesz też użyć zmiennej środowiskowej, np. process.env.LOG_CHANNEL_ID)
    const LOG_CHANNEL_ID = ''; 
    const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);

    if (logChannel) {
        logChannel.send({ embeds: [logEmbed] }).catch(err => console.error('Błąd wysyłania logu ghost ping:', err));
    }
});


client.login(BOT_TOKEN);