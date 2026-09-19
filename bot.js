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
const FULL_LOGS_CHANNEL_ID = '1550791675486408754';

const MAIN_COLOR = '#024442';

// --- FUNKCJE POMOCNICZE ---
const createLogEmbed = (title, desc) => new EmbedBuilder().setColor(MAIN_COLOR).setAuthor({ name: title }).setDescription(desc).setTimestamp();

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

if (MONGO_URI) mongoose.connect(MONGO_URI).then(() => console.log('✅ Połączono z MongoDB!')).catch(err => console.error(err));

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
    const embed = createLogEmbed('⚠️ Krytyczny Błąd Systemu', `Wykryto awarię aplikacji na Renderze. Zrzut:\n\`\`\`js\n${error.stack ? error.stack.substring(0, 3000) : error}\n\`\`\``);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('crash_restart').setLabel('Zrestartuj Serwer').setStyle(ButtonStyle.Danger).setEmoji('🔄'));
    await channel.send({ content: `<@${YOUR_DISCORD_ID}> Awaria!`, embeds: [embed], components: [row] }).catch(() => null);
};

process.on('uncaughtException', async (err) => { console.error(err); await sendCrashLog(err); });
process.on('unhandledRejection', async (reason) => { console.error(reason); await sendCrashLog(reason); });

// --- OAUTH2 DISCORD LOGIN ---
app.get('/auth/discord', (req, res) => res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`));

app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

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

// --- API STRONY & TERMINAL ---
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
        await Paste.create({ shortId, content: cmd.substring(6), createdAt: new Date().toLocaleString() });
        return res.json({ output: `Zapisano kod. Link: https://rapldez.onrender.com/p/${shortId}` });
    }
    if (cmdLower === 'bot' && cmdArgs[1] === 'status') {
        client.user.setActivity(cmd.substring(11));
        return res.json({ output: `Status zmieniony na: "${cmd.substring(11)}"` });
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

    // --- SYSTEM TESTÓW EMBEDÓW (1 do 5) ---
    if (message.content.startsWith('!test-') && message.author.id === YOUR_DISCORD_ID) {
        const packNum = message.content.split('-')[1];
        let embeds = [];

        if (packNum === '1') {
            embeds = [
                createLogEmbed('💻 TERMINAL: Autoryzacja udana', 'Panel odblokowany przez **rapldez**.\n**IP:** `192.168.1.1`'),
                createLogEmbed('💻 TERMINAL: Odrzucono ruch (VPN)', 'Zablokowano próbę wejścia z ukrytego IP.\n**IP:** `185.22.45.11`'),
                createLogEmbed('💻 TERMINAL: Wykonano polecenie', '**Komenda:** `sysinfo`'),
                createLogEmbed('⚠️ Krytyczny Błąd Systemu', 'Wykryto awarię aplikacji na Renderze.'),
                createLogEmbed('🟢 SYSTEM OPERACYJNY ONLINE', '**Status:** Stabilny\n**Ping:** `45ms`'),
                createLogEmbed('📁 ARCHIWUM ZGŁOSZENIA', `**Kanał:** \`ticket-test\`\n**Zarchiwizował:** <@${YOUR_DISCORD_ID}>`),
                createLogEmbed('🎫 NOWE ZGŁOSZENIE (Strona WWW)', '**Nadawca:** Użytkownik\n**Temat:** Pytanie'),
                createLogEmbed('⚙️ Aktualizacja ustawień', 'Zmieniono nazwę lub ikonę serwera.'),
                createLogEmbed('🛠️ Użycie komendy moderacyjnej', `<@${YOUR_DISCORD_ID}> użył komendy na kanale <#${message.channel.id}>.`),
                createLogEmbed('⚠️ Nadano ostrzeżenie', `**Administrator:** <@${YOUR_DISCORD_ID}>\n**Ukarany:** <@123456>\n**Powód:** Złamanie regulaminu.`)
            ];
            await message.channel.send({ content: '**[1/5] System, Terminal, Tickety i Podstawy**', embeds });
        }
        else if (packNum === '2') {
            embeds = [
                createLogEmbed('🔨 Zbanowanie członka', 'Użytkownik `Troll#1234` otrzymał bana na serwerze.'),
                createLogEmbed('🕊️ Odbanowanie członka', 'Użytkownik `Troll#1234` został odbanowany.'),
                createLogEmbed('👢 Wyrzucenie członka (Kick)', 'Administrator usunął użytkownika z serwera.'),
                createLogEmbed('⏳ Timeout (Wyciszenie/Przerwa)', `<@123456> otrzymał przerwę na pisanie.`),
                createLogEmbed('⏳ Timeout zdjęty', `<@123456> odzyskał możliwość pisania.`),
                createLogEmbed('🧹 Masowe czyszczenie (Purge)', `Usunięto \`50\` wiadomości na kanale <#${message.channel.id}>.`),
                createLogEmbed('🛡️ Akcja AutoMod', `Zablokowano wiadomość z powodu naruszenia zasad.`),
                createLogEmbed('🛑 Wykrycie spamu', `System zatrzymał masowe wysyłanie wiadomości.`),
                createLogEmbed('🔗 Wykrycie zablokowanych linków', `Usunięto wiadomość z podejrzanym linkiem.`),
                createLogEmbed('🔀 Przełączenie kanału głosowego', `Członek został przeniesiony z <#111> na <#222>.`)
            ];
            await message.channel.send({ content: '**[2/5] Moderacja, Kary i AutoMod**', embeds });
        }
        else if (packNum === '3') {
            embeds = [
                createLogEmbed('📥 Dołączenie członka', `Konto utworzono 2 lata temu.`),
                createLogEmbed('⚠️ Wykryto młode konto (Alt Account)', `Uwaga: Konto utworzone zaledwie wczoraj.`),
                createLogEmbed('📤 Opuszczenie serwera', `Członek opuścił serwer.`),
                createLogEmbed('📝 Zmiana pseudonimu', `Nick został zaktualizowany na serwerze.`),
                createLogEmbed('🏷️ Zmiana nazwy globalnej', `Użytkownik zmienił swój główny Discord Tag.`),
                createLogEmbed('🖼️ Zmiana awatara', `Użytkownik zaktualizował swoje zdjęcie profilowe.`),
                createLogEmbed('➕ Nadanie roli', `Otrzymał rolę: <@&111222>`),
                createLogEmbed('➖ Odebranie roli', `Stracił rolę: <@&111222>`),
                createLogEmbed('🔊 Dołączenie do kanału głosowego', `Członek wszedł na kanał VC.`),
                createLogEmbed('🔇 Opuszczenie kanału głosowego', `Członek opuścił kanał VC.`)
            ];
            await message.channel.send({ content: '**[3/5] Użytkownicy, Profile i VC**', embeds });
        }
        else if (packNum === '4') {
            embeds = [
                createLogEmbed('📁 Utworzenie kanału', `Dodano nowy kanał tekstowy.`),
                createLogEmbed('🗑️ Usunięcie kanału', `Kanał został trwale usunięty.`),
                createLogEmbed('🔄 Aktualizacja kanału / Nazwy', `Zmieniono właściwości kanału.`),
                createLogEmbed('🔐 Zmiana uprawnień kanału', `Zaktualizowano dostęp do kanału.`),
                createLogEmbed('🛡️ Utworzenie roli', `Nowa rola pojawiła się w systemie.`),
                createLogEmbed('🗑️ Usunięcie roli', `Rola została skasowana.`),
                createLogEmbed('🔄 Aktualizacja uprawnień roli', `Edytowano permisje dla roli.`),
                createLogEmbed('📅 Utworzenie wydarzenia', `Zaplanowano event na serwerze.`),
                createLogEmbed('❌ Anulowanie/Zakończenie wydarzenia', `Wydarzenie dobiegło końca.`),
                createLogEmbed('🔗 Stworzenie zaproszenia', `Wygenerowano nowy link zaproszeniowy do serwera.`)
            ];
            await message.channel.send({ content: '**[4/5] Kanały, Role, Eventy i Zaproszenia**', embeds });
        }
        else if (packNum === '5') {
            embeds = [
                createLogEmbed('🗑️ Usunięcie wiadomości', `**Treść:** To jest testowo skasowana wiadomość.`),
                createLogEmbed('✏️ Edycja wiadomości', `**Przed:** Cześć\n**Po:** Witam serdecznie`),
                createLogEmbed('🖼️ Usunięcie obrazka / pliku', `Wiadomość z załącznikiem została skasowana.`),
                createLogEmbed('📌 Przypięcie wiadomości', `Przypięto ważną informację do kanału.`),
                createLogEmbed('📍 Odpięcie wiadomości', `Odpięto przestarzałą wiadomość.`),
                createLogEmbed('😀 Aktualizacja emotki/naklejki', `Utworzono lub zmodyfikowano serwerową grafikę.`),
                createLogEmbed('🪝 Aktualizacja Webhooka', `Dodano nową integrację (Webhook) na kanale.`),
                createLogEmbed('💎 Zmiana poziomu ulepszeń', `Serwer wszedł na wyższy poziom Boosta!`),
                createLogEmbed('🎙️ Status aktywności głosowej', `Użytkownik został wyciszony serwerowo.`),
                createLogEmbed('🔌 Rozłączenie z VC (Disconnect)', `Admin przymusowo wyrzucił członka z kanału VC.`)
            ];
            await message.channel.send({ content: '**[5/5] Wiadomości, Emotki, Narzędzia Głosowe i Boosty**', embeds });
        }
        return;
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
        const reason = args.slice(2).join(' ') || 'Brak powódu';
        if (!targetUser) return message.reply('Oznacz użytkownika, np. `!warn @user spam`');
        
        message.channel.send({ embeds: [createLogEmbed('⚠️ OSTRZEŻENIE', `Użytkownik <@${targetUser.id}> otrzymał ostrzeżenie.\n**Powód:** ${reason}`)] });
        sendServerLog('⚠️ Nadano ostrzeżenie', `**Admin:** <@${message.author.id}>\n**Ukarany:** <@${targetUser.id}>\n**Powód:** ${reason}`);
    }

    if (message.content === '!backup' && message.author.id === YOUR_DISCORD_ID) {
        const data = JSON.stringify({ statystyki: await Counter.find(), archiwum_ticketow: await TicketArchive.find() }, null, 2);
        await message.reply({ content: '📦 **Backup:**', files: [new AttachmentBuilder(Buffer.from(data, 'utf-8'), { name: `backup_${Date.now()}.json` })] });
    }
});

// ==========================================
// PEŁNY SYSTEM LOGÓW
// ==========================================

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

client.on('voiceStateUpdate', (oldState, newState) => {
    const user = `<@${newState.id}>`;
    if (!oldState.channelId && newState.channelId) sendServerLog('🔊 Dołączenie do kanału głosowego', `Członek ${user} wszedł na kanał <#${newState.channelId}>.`);
    else if (oldState.channelId && !newState.channelId) sendServerLog('🔇 Opuszczenie kanału głosowego', `Członek ${user} opuścił kanał <#${oldState.channelId}>.`);
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) sendServerLog('🔀 Przełączenie kanału głosowego', `Członek ${user} przeszedł z <#${oldState.channelId}> na <#${newState.channelId}>.`);
    else {
        if (!oldState.serverMute && newState.serverMute) sendServerLog('🎙️ Wyciszenie na kanale (Mute)', `${user} wyciszony serwerowo.`);
        if (!oldState.serverDeaf && newState.serverDeaf) sendServerLog('🎧 Ogłuszenie (Deafen)', `${user} ogłuszony serwerowo.`);
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

// --- STARTUP ---
client.once('ready', async () => {
    app.listen(PORT, () => { console.log(`Serwer działa na porcie ${PORT}!`); });
    try {
        const statusChannel = client.channels.cache.get(STATUS_CHANNEL_ID);
        if (statusChannel) {
            const statusMsg = await statusChannel.send({ embeds: [createLogEmbed('🟢 SYSTEM ONLINE', `Ping: \`${client.ws.ping}ms\``)] });
            setInterval(() => statusMsg.edit({ embeds: [createLogEmbed('🟢 SYSTEM ONLINE', `Ping: \`${client.ws.ping}ms\``)] }).catch(()=>null), 600000);
        }
    } catch (e) {}
});

// --- TICKETY ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'close_ticket') {
        const closedAtStr = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
        await interaction.reply({ content: `🔒 Zamknięto (${closedAtStr}).`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('Otwórz').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('archive_ticket').setLabel('Archiwizuj').setStyle(ButtonStyle.Danger))] });
    }
    if (interaction.customId === 'archive_ticket') {
        await interaction.reply('📁 Generuję archiwum...');
        setTimeout(() => interaction.channel.delete().catch(()=>null), 4000);
        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) await logChannel.send({ embeds: [createLogEmbed('📁 ARCHIWUM ZGŁOSZENIA', `Kanał: \`${interaction.channel.name}\` zarchiwizowany.`)] });
    }
});

const PORT = process.env.PORT || 3000;
client.login(BOT_TOKEN);
