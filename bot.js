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
const CATEGORY_ID = '1516145205936394455'; // Kategoria głosowa
const VOICE_CREATOR_CHANNEL_ID = '1516643168479608963'; // ID kanału twórcy głosowego
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
        const results = await TicketArchive.find({ htmlContent: { $regex: query, $options: 'i' } });
        if (results.length === 0) return res.json({ output: `Brak wyników w bazie dla słowa: "${query}"` });
        const names = results.map(r => r.channelName).join(', ');
        return res.json({ output: `Znaleziono słowo "${query}" w ticketach (${results.length}):\n${names}` });
    }

    return res.json({ output: `Nie rozpoznano polecenia. Dostępne: sysinfo, db stats, paste [kod], bot status [tekst], search [słowo]` });
});

// --- NOWY ENDPOINT: POBIERANIE WIADOMOŚCI DO EDYCJI ---
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

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // --- SYSTEM ANTY-SPAM ---
    if (message.author.id !== YOUR_DISCORD_ID && !message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const userId = message.author.id;
        const currentTime = Date.now();
        const msgContent = message.content.toLowerCase();

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
    // --- KONIEC ANTY-SPAMU ---

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

// Map do śledzenia dynamicznych kanałów głosowych
const tempVoiceChannels = new Map();

client.on('voiceStateUpdate', async (oldState, newState) => {
    const user = `<@${newState.id}>`;
    
    // Logi głosowe
    if (!oldState.channelId && newState.channelId) sendServerLog('🔊 Dołączenie do kanału głosowego', `Członek ${user} wszedł na kanał <#${newState.channelId}>.`);
    else if (oldState.channelId && !newState.channelId) sendServerLog('🔇 Opuszczenie kanału głosowego', `Członek ${user} opuścił kanał <#${oldState.channelId}>.`);
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) sendServerLog('🔀 Przełączenie kanału głosowego', `Członek ${user} przeszedł z <#${oldState.channelId}> na <#${newState.channelId}>.`);
    else {
        if (!oldState.serverMute && newState.serverMute) sendServerLog('🎙️ Wyciszenie na kanale (Mute)', `${user} wyciszony serwerowo.`);
        if (!oldState.serverDeaf && newState.serverDeaf) sendServerLog('🎧 Ogłuszenie (Deafen)', `${user} ogłuszony serwerowo.`);
    }

    // System "Stwórz swój głos" ze zmienioną nazwą
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
                        allow: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.MuteMembers, PermissionsBitField.Flags.DeafenMembers, PermissionsBitField.Flags.MoveMembers],
                    }
                ]
            });

            await member.voice.setChannel(createdChannel).catch(() => {});
            tempVoiceChannels.set(createdChannel.id, member.id);
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

client.on('guildMemberAdd', member => sendServerLog('📥 Dołączenie członka', `Członek <@${member.id}> dołączył do serwera.\n${(Date.now() - member.user.createdTimestamp) < 604800000 ? '⚠️ **Wykryto młode konto!**' : ''}`));
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

// --- CYBERNETYCZNE CENTRUM DOWODZENIA (STATUS Z TELEMETRIĄ) ---
client.once('ready', async () => {
    app.listen(PORT, () => { console.log(`Serwer działa na porcie ${PORT}!`); });
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

// --- INTERAKCJE (TICKETY, WERYFIKACJA I PRZYCISKI) ---
client.on('interactionCreate', async interaction => {
    // Obsługa przycisków kontrolnych panelu statusu
    if (interaction.isButton() && (interaction.customId === 'status_restart_bot' || interaction.customId === 'status_refresh')) {
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

    if (interaction.isButton() && interaction.customId.startsWith('custom_btn_')) {
        await interaction.reply({ content: 'Przycisk interaktywny wygenerowany z panelu.', ephemeral: true });
        return;
    }

    if (!interaction.isButton()) return;

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
    
    if (interaction.customId === 'crash_restart') {
        if (interaction.user.id !== YOUR_DISCORD_ID) return interaction.reply({ content: 'Brak uprawnień.', ephemeral: true });
        await interaction.reply('🔄 Restartuję system...');
        setTimeout(() => process.exit(1), 1000);
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

const PORT = process.env.PORT || 3000;
client.login(BOT_TOKEN);