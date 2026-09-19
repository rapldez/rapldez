const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, AuditLogEvent } = require('discord.js');
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
const FULL_LOGS_CHANNEL_ID = '1550791675486408754';

// Główny kolor systemu (nie zmieniamy na żaden inny)
const MAIN_COLOR = '#024442';

// --- FUNKCJE POMOCNICZE ---
async function logToTerminalDiscord(title, description) {
    try {
        const channel = client.channels.cache.get(TERMINAL_LOG_CHANNEL);
        if (!channel) return;
        
        const embed = new EmbedBuilder()
            .setColor(MAIN_COLOR)
            .setAuthor({ name: '💻 TERMINAL WWW • LOGI SYSTEMOWE' })
            .setTitle(title)
            .setDescription(description)
            .setTimestamp()
            .setFooter({ text: 'rapldez.onrender.com • Zabezpieczenia' });
            
        await channel.send({ embeds: [embed] });
    } catch (e) {}
}

async function sendServerLog(title, description) {
    try {
        const channel = client.channels.cache.get(FULL_LOGS_CHANNEL_ID);
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setColor(MAIN_COLOR)
            .setAuthor({ name: title })
            .setDescription(description)
            .setTimestamp();
        await channel.send({ embeds: [embed] });
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

if (MONGO_URI) {
    mongoose.connect(MONGO_URI).then(() => console.log('✅ Połączono z bazą MongoDB!')).catch(err => console.error('❌ Błąd z MongoDB:', err));
}

// Rozbudowane intenty dla pełnego nasłuchu wszystkich akcji na serwerze
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildInvites, GatewayIntentBits.GuildEmojisAndStickers, GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildScheduledEvents, GatewayIntentBits.AutoModerationConfiguration, 
        GatewayIntentBits.AutoModerationExecution, GatewayIntentBits.GuildModeration
    ] 
});

// --- CRASH MONITOR ---
const sendCrashLog = async (error) => {
    const channel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (!channel) return;
    const embed = new EmbedBuilder()
        .setColor(MAIN_COLOR)
        .setTitle('⚠️ Krytyczny Błąd Systemu')
        .setDescription(`Wykryto awarię aplikacji na Renderze. Ostatni zrzut błędu:\n\`\`\`js\n${error.stack ? error.stack.substring(0, 3000) : error}\n\`\`\``)
        .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('crash_restart').setLabel('Zrestartuj Serwer').setStyle(ButtonStyle.Danger).setEmoji('🔄')
    );
    await channel.send({ content: `<@${YOUR_DISCORD_ID}> Serwer napotkał problem!`, embeds: [embed], components: [row] }).catch(() => null);
};

process.on('uncaughtException', async (err) => { console.error(err); await sendCrashLog(err); });
process.on('unhandledRejection', async (reason) => { console.error(reason); await sendCrashLog(reason); });

// --- OAUTH2 DISCORD LOGIN ---
app.get('/auth/discord', (req, res) => {
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`);
});

app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!code) return res.redirect('/?error=no_code');
    
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
            logToTerminalDiscord('🔑 Autoryzacja udana', `Panel Administratora został odblokowany przez **${userData.username}**.\n**IP:** \`${userIP}\``);
            return res.redirect('/?login=success');
        } else {
            logToTerminalDiscord('⚠️ Zablokowano dostęp', `Nieudana próba wejścia do terminala.\n**Profil:** \`${userData.username}\` (${userData.id})\n**IP:** \`${userIP}\``);
            return res.redirect('/?error=unauthorized');
        }
    } catch (error) { res.redirect('/?error=server_error'); }
});

app.get('/api/check-auth', (req, res) => {
    if (req.session && req.session.user && req.session.user.id === YOUR_DISCORD_ID) {
        res.json({ authenticated: true, username: req.session.user.username });
    } else res.json({ authenticated: false });
});
app.post('/api/logout', (req, res) => { req.session.destroy(() => { res.json({ success: true }); }); });

// --- API STRONY & TERMINAL ---
app.post('/api/terminal', async (req, res) => {
    const cmd = req.body.command ? req.body.command.trim() : '';
    if (!req.session || !req.session.user || req.session.user.id !== YOUR_DISCORD_ID) {
        return res.status(403).json({ output: 'Odmowa dostępu.' });
    }

    logToTerminalDiscord('⌨️ Wykonano polecenie WWW', `**Komenda:** \`${cmd || '[Puste]'}\``);
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

    if (message.content === '!test-embeds' && message.author.id === YOUR_DISCORD_ID) {
        const testEmbed = new EmbedBuilder()
            .setColor(MAIN_COLOR)
            .setAuthor({ name: '🛠️ TEST KOLORYSTYKI SYSTEMU' })
            .setDescription(`Od teraz każdy z 48 typów logów, terminal, błędy i crashe będą używać wyłącznie tego koloru: \`${MAIN_COLOR}\`.`)
            .setTimestamp();
        await message.channel.send({ content: 'Podgląd sztywnego koloru embedów:', embeds: [testEmbed] });
        return;
    }

    if (message.content.startsWith('!clear') && message.author.id === YOUR_DISCORD_ID) {
        const amount = parseInt(message.content.split(' ')[1]);
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('Podaj liczbę (1-100), np. `!clear 10`').then(m => setTimeout(() => m.delete().catch(()=>null), 3000));

        await message.delete().catch(() => null);
        const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);
        if (deleted) {
            const fb = new EmbedBuilder()
                .setColor(MAIN_COLOR)
                .setAuthor({ name: '🛠️ PANEL KONTROLNY' })
                .setDescription(`>>> **Status:** Pomyślnie usunięto wiadomości.\n**Zlikwidowano:** \`${deleted.size}\` sztuk.`)
                .setFooter({ text: 'Wiadomość ulegnie autodestrukcji za 5s' });
            const msg = await message.channel.send({ embeds: [fb] });
            setTimeout(() => msg.delete().catch(() => null), 5000);
            sendServerLog('🧹 Masowe czyszczenie (Purge)', `Użytkownik <@${message.author.id}> usunął \`${deleted.size}\` wiadomości na kanale <#${message.channel.id}>.`);
        }
    }

    if (message.content.startsWith('!warn') && message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        const args = message.content.split(' ');
        const targetUser = message.mentions.users.first();
        const reason = args.slice(2).join(' ') || 'Brak podanego powodu';
        
        if (!targetUser) return message.reply('Oznacz użytkownika, np. `!warn @user spam`');
        
        const embed = new EmbedBuilder()
            .setColor(MAIN_COLOR)
            .setDescription(`⚠️ Użytkownik <@${targetUser.id}> otrzymał ostrzeżenie.\n**Powód:** ${reason}`);
        message.channel.send({ embeds: [embed] });
        sendServerLog('⚠️ Nadano ostrzeżenie', `**Administrator:** <@${message.author.id}>\n**Ukarany:** <@${targetUser.id}>\n**Powód:** ${reason}`);
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

    if (message.content === '!backup' && message.author.id === YOUR_DISCORD_ID) {
        const counters = await Counter.find();
        const archives = await TicketArchive.find();
        const data = JSON.stringify({ statystyki: counters, archiwum_ticketow: archives }, null, 2);
        const attachment = new AttachmentBuilder(Buffer.from(data, 'utf-8'), { name: `rapldez_backup_${Date.now()}.json` });
        await message.reply({ content: '📦 **Backup wygenerowany:**', files: [attachment] });
    }

    if (message.content.startsWith('!embed') && message.author.id === YOUR_DISCORD_ID) {
        const rawArgs = message.content.replace('!embed', '').trim();
        if (!rawArgs) return;
        const parts = rawArgs.split('|');
        const embedData = {};
        parts.forEach(part => {
            const index = part.indexOf('=');
            if (index !== -1) embedData[part.substring(0, index).trim().toLowerCase()] = part.substring(index + 1).trim();
        });
        const embed = new EmbedBuilder().setColor(MAIN_COLOR);
        if (embedData.title) embed.setTitle(embedData.title);
        if (embedData.desc) embed.setDescription(embedData.desc.replace(/\\n/g, '\n'));
        if (embedData.footer) embed.setFooter({ text: embedData.footer });
        await message.channel.send({ embeds: [embed] });
        await message.delete().catch(() => null);
    }
});

// ==========================================
// PEŁNY SYSTEM LOGÓW (48 AKCJI)
// ==========================================

// Wiadomości
client.on('messageDelete', message => {
    if (message.author?.bot) return;
    const content = message.content ? `\`\`\`text\n${message.content}\n\`\`\`` : '*Wiadomość usunięto, brak tekstu (lub załącznik/plik).*';
    sendServerLog('🗑️ Usunięcie wiadomości', `**Autor:** <@${message.author?.id}>\n**Kanał:** <#${message.channel.id}>\n**Treść:**\n${content}`);
});
client.on('messageUpdate', (oldMsg, newMsg) => {
    if (oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
    
    let action = '✏️ Edycja wiadomości';
    if (!oldMsg.pinned && newMsg.pinned) action = '📌 Przypięcie wiadomości';
    if (oldMsg.pinned && !newMsg.pinned) action = '📍 Odpięcie wiadomości';

    sendServerLog(action, `**Autor:** <@${oldMsg.author?.id}>\n**Kanał:** <#${oldMsg.channel.id}>\n\n**Przed:**\n\`\`\`text\n${oldMsg.content || 'Brak'}\n\`\`\`**Po:**\n\`\`\`text\n${newMsg.content || 'Brak'}\n\`\`\`[Przejdź do wiadomości](${newMsg.url})`);
});

// Kanały Głosowe
client.on('voiceStateUpdate', (oldState, newState) => {
    const user = `<@${newState.id}>`;
    if (!oldState.channelId && newState.channelId) {
        sendServerLog('🔊 Dołączenie do kanału głosowego', `Członek ${user} wszedł na kanał <#${newState.channelId}>.`);
    } else if (oldState.channelId && !newState.channelId) {
        sendServerLog('🔇 Opuszczenie kanału głosowego', `Członek ${user} opuścił kanał <#${oldState.channelId}> (Rozłączenie/Wyjście).`);
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        sendServerLog('🔀 Przełączenie kanału głosowego', `Członek ${user} przeszedł z <#${oldState.channelId}> na <#${newState.channelId}> (lub został przeniesiony).`);
    } else {
        if (!oldState.serverMute && newState.serverMute) sendServerLog('🎙️ Wyciszenie na kanale (Mute)', `${user} został wyciszony serwerowo.`);
        if (oldState.serverMute && !newState.serverMute) sendServerLog('🎙️ Odtiszenie na kanale (Unmute)', `${user} może znów mówić.`);
        if (!oldState.serverDeaf && newState.serverDeaf) sendServerLog('🎧 Ogłuszenie (Deafen)', `${user} został ogłuszony serwerowo.`);
    }
});

// Użytkownicy / Członkowie serwera
client.on('guildMemberAdd', member => {
    const isNew = (Date.now() - member.user.createdTimestamp) < 1000 * 60 * 60 * 24 * 7; // Młodsze niż 7 dni
    let desc = `Członek <@${member.id}> dołączył do serwera.\n**Konto utworzono:** <t:${Math.floor(member.user.createdTimestamp/1000)}:R>`;
    if (isNew) desc += `\n⚠️ **Wykryto młode konto (Potencjalny Alt)!**`;
    sendServerLog('📥 Dołączenie członka', desc);
});
client.on('guildMemberRemove', member => {
    sendServerLog('📤 Opuszczenie serwera', `Członek <@${member.id}> opuścił serwer lub został wyrzucony.`);
});
client.on('guildMemberUpdate', (oldMember, newMember) => {
    const user = `<@${newMember.id}>`;
    if (oldMember.nickname !== newMember.nickname) {
        sendServerLog('📝 Zmiana pseudonimu', `${user} zmienił nick z \`${oldMember.nickname || oldMember.user.username}\` na \`${newMember.nickname || newMember.user.username}\`.`);
    }
    if (oldMember.roles.cache.size < newMember.roles.cache.size) {
        const addedRole = newMember.roles.cache.find(r => !oldMember.roles.cache.has(r.id));
        if (addedRole) sendServerLog('➕ Nadanie roli', `${user} otrzymał rolę <@&${addedRole.id}>.`);
    }
    if (oldMember.roles.cache.size > newMember.roles.cache.size) {
        const removedRole = oldMember.roles.cache.find(r => !newMember.roles.cache.has(r.id));
        if (removedRole) sendServerLog('➖ Odebranie roli', `${user} stracił rolę <@&${removedRole.id}>.`);
    }
    if (!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()) {
        sendServerLog('⏳ Timeout (Wyciszenie/Przerwa)', `${user} otrzymał przerwę do <t:${Math.floor(newMember.communicationDisabledUntilTimestamp/1000)}:F>.`);
    }
    if (oldMember.isCommunicationDisabled() && !newMember.isCommunicationDisabled()) {
        sendServerLog('⏳ Timeout zdjęty', `${user} odzyskał możliwość pisania.`);
    }
    if (oldMember.premiumSinceTimestamp !== newMember.premiumSinceTimestamp) {
        if (newMember.premiumSinceTimestamp) sendServerLog('💎 Ulepszanie Serwera', `${user} rozpoczął boostowanie serwera!`);
        else sendServerLog('📉 Koniec Ulepszania', `${user} przestał boostować serwer.`);
    }
});
client.on('userUpdate', (oldUser, newUser) => {
    if (oldUser.username !== newUser.username || oldUser.globalName !== newUser.globalName) {
        sendServerLog('🏷️ Zmiana nazwy globalnej', `<@${newUser.id}> zmienił nazwę z \`${oldUser.username} (${oldUser.globalName})\` na \`${newUser.username} (${newUser.globalName})\`.`);
    }
    if (oldUser.avatar !== newUser.avatar) {
        sendServerLog('🖼️ Zmiana awatara', `Użytkownik <@${newUser.id}> zaktualizował swoje zdjęcie profilowe.`);
    }
});

// Serwer i Struktura (Kanały, Role, Bany, Eventy, Emotki)
client.on('channelCreate', channel => sendServerLog('📁 Utworzenie kanału', `Utworzono nowy kanał: <#${channel.id}> (\`${channel.name}\`)`));
client.on('channelDelete', channel => sendServerLog('🗑️ Usunięcie kanału', `Usunięto kanał: \`${channel.name}\``));
client.on('channelUpdate', (oldC, newC) => {
    if (oldC.name !== newC.name) sendServerLog('🔄 Aktualizacja kanału', `Zmieniono nazwę kanału z \`${oldC.name}\` na <#${newC.id}> (\`${newC.name}\`)`);
    if (oldC.permissionOverwrites.cache.size !== newC.permissionOverwrites.cache.size) sendServerLog('🔐 Zmiana uprawnień kanału', `Zaktualizowano uprawnienia dla <#${newC.id}>.`);
});
client.on('roleCreate', role => sendServerLog('🛡️ Utworzenie roli', `Dodano nową rolę: <@&${role.id}>`));
client.on('roleDelete', role => sendServerLog('🗑️ Usunięcie roli', `Skasowano rolę: \`${role.name}\``));
client.on('roleUpdate', (oldR, newR) => {
    if (oldR.name !== newR.name || oldR.permissions.bitfield !== newR.permissions.bitfield) {
        sendServerLog('🔄 Aktualizacja roli', `Zmodyfikowano rolę <@&${newR.id}> (Nazwa lub Uprawnienia).`);
    }
});
client.on('guildBanAdd', ban => sendServerLog('🔨 Zbanowanie członka', `Użytkownik \`${ban.user.tag}\` (${ban.user.id}) otrzymał bana na serwerze.`));
client.on('guildBanRemove', ban => sendServerLog('🕊️ Odbanowanie członka', `Użytkownik \`${ban.user.tag}\` został odbanowany.`));
client.on('inviteCreate', invite => sendServerLog('🔗 Stworzenie zaproszenia', `Utworzono link zaproszeniowy \`${invite.code}\` przez <@${invite.inviter?.id}>.`));
client.on('emojiCreate', emoji => sendServerLog('😀 Utworzenie emotki', `Dodano emotkę ${emoji} (\`${emoji.name}\`).`));
client.on('emojiDelete', emoji => sendServerLog('🗑️ Usunięcie emotki', `Usunięto emotkę \`${emoji.name}\`.`));
client.on('emojiUpdate', (o, n) => sendServerLog('🔄 Aktualizacja emotki', `Zaktualizowano emotkę ${n}.`));
client.on('stickerCreate', sticker => sendServerLog('🖼️ Utworzenie naklejki', `Dodano naklejkę \`${sticker.name}\`.`));
client.on('stickerDelete', sticker => sendServerLog('🗑️ Usunięcie naklejki', `Skasowano naklejkę \`${sticker.name}\`.`));
client.on('guildScheduledEventCreate', event => sendServerLog('📅 Utworzenie wydarzenia', `Zaplanowano wydarzenie: \`${event.name}\``));
client.on('guildScheduledEventDelete', event => sendServerLog('❌ Zakończenie wydarzenia', `Zakończono lub anulowano: \`${event.name}\``));
client.on('webhookUpdate', channel => sendServerLog('🪝 Aktualizacja Webhooka', `Zmieniono lub dodano webhooki na kanale <#${channel.id}>.`));
client.on('guildUpdate', (oldG, newG) => {
    if (oldG.premiumTier !== newG.premiumTier) sendServerLog('📈 Poziom Boostów', `Poziom ulepszeń serwera uległ zmianie (Tier: ${newG.premiumTier}).`);
    if (oldG.name !== newG.name) sendServerLog('⚙️ Aktualizacja ustawień', `Zmieniono nazwę serwera na \`${newG.name}\`.`);
});
client.on('autoModerationActionExecution', action => {
    sendServerLog('🛡️ Akcja AutoMod', `Wykryto naruszenie w <#${action.channelId}> przez <@${action.userId}>.\n**Zasada:** \`${action.ruleTriggerType}\``);
});

// --- STARTUP & STATUS ---
client.once('ready', async () => {
    app.listen(PORT, () => { console.log(`Serwer działa na porcie ${PORT}!`); });
    try {
        const statusChannel = client.channels.cache.get(STATUS_CHANNEL_ID);
        if (statusChannel) {
            const embed = new EmbedBuilder()
                .setColor(MAIN_COLOR)
                .setAuthor({ name: '🟢 SYSTEM OPERACYJNY ONLINE' })
                .setDescription(`**Status infrastruktury:** Stabilny\n**Aktualny Ping:** \`${client.ws.ping}ms\``)
                .setTimestamp()
                .setFooter({ text: 'rapldez.onrender.com' });
            const statusMsg = await statusChannel.send({ embeds: [embed] });
            setInterval(() => {
                embed.setDescription(`**Status infrastruktury:** Stabilny\n**Aktualny Ping:** \`${client.ws.ping}ms\``).setTimestamp();
                statusMsg.edit({ embeds: [embed] }).catch(()=>null);
            }, 10 * 60 * 1000);
        }
    } catch (e) {}
});

// --- OBSŁUGA TICKETÓW ZE STRONY WWW ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId === 'crash_restart') {
        if (interaction.user.id !== YOUR_DISCORD_ID) return interaction.reply({ content: 'Brak uprawnień.', ephemeral: true });
        await interaction.reply('🔄 Restartuję system...');
        setTimeout(() => process.exit(1), 1000);
        return;
    }

    if (interaction.user.id !== YOUR_DISCORD_ID && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;

    const topic = interaction.channel.topic || '';
    const parts = topic.split('|');
    let targetId = parts[0] || 'brak_id';
    let createdAtStr = 'Nieznana';
    const createdPart = parts.find(p => p && p.startsWith('CREATED:'));
    if (createdPart) createdAtStr = createdPart.replace('CREATED:', '');

    if (interaction.customId === 'close_ticket') {
        if (targetId && targetId !== 'brak_id') await interaction.channel.permissionOverwrites.edit(targetId, { ViewChannel: false }).catch(() => null);
        const closedAtStr = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
        interaction.channel.setTopic(`${targetId}|CREATED:${createdAtStr}|CLOSED:${closedAtStr}`).catch(() => null);

        const reopenRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_ticket').setLabel('Otwórz ponownie').setStyle(ButtonStyle.Success).setEmoji('🔓'),
            new ButtonBuilder().setCustomId('archive_ticket').setLabel('Archiwizuj i Usuń').setStyle(ButtonStyle.Danger).setEmoji('📁')
        );
        await interaction.reply({ content: `🔒 Zgłoszenie zamknięte (${closedAtStr}).`, components: [reopenRow] });
    }

    if (interaction.customId === 'open_ticket') {
        if (targetId && targetId !== 'brak_id') await interaction.channel.permissionOverwrites.edit(targetId, { ViewChannel: true }).catch(() => null);
        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Zamknij').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('archive_ticket').setLabel('Archiwizuj i Usuń').setStyle(ButtonStyle.Danger).setEmoji('📁')
        );
        await interaction.reply({ content: `🔓 Zgłoszenie otwarte dla <@${targetId}>.`, components: [closeRow] });
    }

    if (interaction.customId === 'archive_ticket') {
        await interaction.reply('📁 Generuję archiwum...');
        try {
            let messages = await interaction.channel.messages.fetch({ limit: 100 });
            messages = Array.from(messages.values()).reverse();
            const participantsSet = new Set();
            messages.forEach(m => { if (!m.author.bot) participantsSet.add(m.author.username); });
            const participantsList = participantsSet.size > 0 ? Array.from(participantsSet).join(', ') : 'Brak interakcji';

            let closedAtStr = 'Nie zamknięto ręcznie';
            const closedPart = parts.find(p => p && p.startsWith('CLOSED:'));
            if (closedPart) closedAtStr = closedPart.replace('CLOSED:', '');
            const archivedAtStr = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });

            let htmlContent = `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><title>Archiwum</title><style>body{background:#313338;color:#dbdee1;font-family:sans-serif;padding:20px}.message{margin-bottom:15px}.author{font-weight:bold;color:#f2f3f5}.content{background:#2b2d31;padding:10px;border-radius:6px;display:inline-block}</style></head><body><h2>Archiwum: ${interaction.channel.name}</h2>`;
            messages.forEach(m => { htmlContent += `<div class="message"><span class="author">${m.author.username}</span> <span style="font-size:11px;color:#949ba4">${m.createdAt.toLocaleString('pl-PL')}</span><br><div class="content">${m.content || '[Media]'}</div></div>`; });
            htmlContent += `</body></html>`;

            await TicketArchive.create({ channelName: interaction.channel.name, messagesCount: messages.length, participants: Array.from(participantsSet), createdAt: createdAtStr, closedAt: closedAtStr, archivedAt: archivedAtStr, archivedBy: interaction.user.username, htmlContent: htmlContent });

            const embedLog = new EmbedBuilder()
                .setColor(MAIN_COLOR)
                .setAuthor({ name: '📁 ARCHIWUM ZGŁOSZENIA' })
                .setDescription(`>>> **• Kanał:** \`${interaction.channel.name}\`\n**• Wiadomości:** \`${messages.length}\`\n**• Uczestnicy:** \`${participantsList}\`\n**• Otwarcie:** \`${createdAtStr}\`\n**• Zamknięcie:** \`${closedAtStr}\`\n**• Archiwizacja:** \`${archivedAtStr}\`\n**• Zarchiwizował:** <@${interaction.user.id}>`)
                .setFooter({ text: 'rapldez.onrender.com' }).setTimestamp();

            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) await logChannel.send({ embeds: [embedLog] });
        } catch (err) {}
        setTimeout(() => { interaction.channel.delete().catch(() => null); }, 4000);
    }
});

const PORT = process.env.PORT || 3000;
client.login(BOT_TOKEN);
