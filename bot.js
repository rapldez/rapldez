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
const LOG_CHANNEL_ID = '1550753070726512730'; 
const TERMINAL_LOG_CHANNEL = '1550789490518528010';

// --- FUNKCJE POMOCNICZE (NOWE EMBEDY LOGÓW) ---
async function logToTerminalDiscord(title, description, color = '#2b2d31') {
    try {
        const channel = client.channels.cache.get(TERMINAL_LOG_CHANNEL);
        if (!channel) return;
        
        const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({ name: '💻 TERMINAL WWW • LOGI' })
            .setTitle(title)
            .setDescription(description)
            .setTimestamp()
            .setFooter({ text: 'rapldez OS • Nasłuch na żywo' });
            
        await channel.send({ embeds: [embed] });
    } catch (e) {
        console.error('Błąd logowania do terminala na DC:', e);
    }
}

// --- MONGODB SCHEMAS ---
const counterSchema = new mongoose.Schema({
    id: { type: String, default: 'views' },
    count: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

const ticketArchiveSchema = new mongoose.Schema({
    channelName: String,
    messagesCount: Number,
    participants: [String],
    createdAt: String,
    closedAt: String,
    archivedAt: String,
    archivedBy: String,
    htmlContent: String
});
const TicketArchive = mongoose.model('TicketArchive', ticketArchiveSchema);

if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('✅ Połączono z bazą MongoDB!'))
        .catch(err => console.error('❌ Błąd połączenia z MongoDB:', err));
}

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

// --- CRASH MONITOR ---
const sendCrashLog = async (error) => {
    const channel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (!channel) return;
    const embed = new EmbedBuilder()
        .setColor('#ed4245')
        .setTitle('⚠️ Krytyczny Błąd Systemu')
        .setDescription(`Wykryto awarię aplikacji na Renderze. Ostatni zrzut błędu:\n\`\`\`js\n${error.stack ? error.stack.substring(0, 3000) : error}\n\`\`\``)
        .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('crash_restart').setLabel('Zrestartuj Serwer').setStyle(ButtonStyle.Danger).setEmoji('🔄')
    );
    await channel.send({ content: `<@${YOUR_DISCORD_ID}> Serwer napotkał problem!`, embeds: [embed], components: [row] }).catch(() => null);
};

process.on('uncaughtException', async (err) => {
    console.error('Niezłapany błąd:', err);
    await sendCrashLog(err);
});
process.on('unhandledRejection', async (reason, promise) => {
    console.error('Niezłapana obietnica:', reason);
    await sendCrashLog(reason);
});

// --- OAUTH2 DISCORD LOGIN ---
app.get('/auth/discord', (req, res) => {
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(discordAuthUrl);
});

app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/?error=no_code');

    try {
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) return res.redirect('/?error=bad_token');

        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
        });

        const userData = await userResponse.json();

        if (userData.id === YOUR_DISCORD_ID) {
            req.session.user = { id: userData.id, username: userData.username };
            logToTerminalDiscord('🔐 Autoryzacja udana', 'Panel roota został pomyślnie odblokowany.', '#23a559');
            return res.redirect('/?login=success');
        } else {
            logToTerminalDiscord('⚠️ Odrzucono logowanie', `Zablokowano próbę dostępu do panelu.\n**Konto:** \`${userData.username}\`\n**ID:** \`${userData.id}\``, '#ed4245');
            return res.redirect('/?error=unauthorized');
        }
    } catch (error) {
        res.redirect('/?error=server_error');
    }
});

app.get('/api/check-auth', (req, res) => {
    if (req.session && req.session.user && req.session.user.id === YOUR_DISCORD_ID) {
        res.json({ authenticated: true, username: req.session.user.username });
    } else {
        res.json({ authenticated: false });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => { res.json({ success: true }); });
});

// --- API STRONY ---
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

app.post('/api/kontakt', async (req, res) => {
    const { nick, subject, message } = req.body;
    if (!nick || !message || !subject) return res.status(400).json({ error: 'Brakujące dane' });

    try {
        const guild = client.guilds.cache.get(SERVER_ID);
        if (!guild) return res.status(500).json({ message: 'Błąd serwera.' });

        const inputClean = nick.toLowerCase().trim();
        let member = null;
        try {
            const searchResults = await guild.members.fetch({ query: inputClean, limit: 10 });
            member = searchResults.find(m => m.user.username.toLowerCase() === inputClean || (m.user.globalName && m.user.globalName.toLowerCase() === inputClean));
            if (!member) {
                const allMembers = await guild.members.fetch(); 
                member = allMembers.find(m => m.user.username.toLowerCase() === inputClean);
            }
        } catch (e) {}

        const permissionOverwrites = [{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }];
        if (member) {
            permissionOverwrites.push({ id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
        }

        const safeNick = nick.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 16) || 'nieznany';
        const channelName = `ticket-${safeNick}`;
        const createdAtStr = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
        const topicData = `${member ? member.id : 'brak_id'}\vert{}CREATED:${createdAtStr}`;
        
        const newChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            topic: topicData,
            permissionOverwrites: permissionOverwrites
        });

        const embed = new EmbedBuilder()
            .setColor('#111214')
            .setAuthor({ name: '🎫 RAPLDEZ • ZGŁOSZENIE ZE STRONY' })
            .setDescription(`**• 👤 × Nadawca:** \`${nick}\` (${member ? `<@${member.id}>` : 'Brak na serwerze'})\n**• 📩 × Temat:** \`${subject}\`\n**• 🕒 × Otwarto:** \`${createdAtStr}\`\n\`\`\`text\n${message}\n\`\`\``)
            .setFooter({ text: 'rapldez OS • System zgłoszeń' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Zamknij').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('archive_ticket').setLabel('Archiwizuj').setStyle(ButtonStyle.Danger).setEmoji('📁')
        );

        await newChannel.send({ content: `<@${YOUR_DISCORD_ID}> Masz nowe zgłoszenie!`, embeds: [embed], components: [row] });
        res.status(200).json({ message: 'Zgłoszenie wysłane!' });
    } catch (error) {
        res.status(500).json({ message: 'Wystąpił błąd serwera.' });
    }
});

// --- GITHUB WEBHOOK ---
app.post('/webhook/github', async (req, res) => {
    const channel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (channel) {
        await channel.send('🔄 **GitHub Hook:** Wykryto wypchnięcie nowego kodu na GitHuba. Zarządzam automatyczny restart bota...');
    }
    res.sendStatus(200);
    setTimeout(() => process.exit(1), 2000);
});

// --- KOMENDY TERMINALA WWW ---
app.post('/api/terminal', async (req, res) => {
    const cmd = req.body.command ? req.body.command.trim() : '';

    if (!req.session || !req.session.user || req.session.user.id !== YOUR_DISCORD_ID) {
        logToTerminalDiscord('🚫 Blokada autoryzacji', `Użytkownik bez uprawnień próbował wywołać komendę.\n**Wpisano:** \`${cmd || '[Puste]'}\`\n**IP:** \`${req.ip || 'Nieznane'}\``, '#ed4245');
        return res.status(403).json({ output: 'Odmowa dostępu. Brak autoryzacji roota.' });
    }

    logToTerminalDiscord('⌨️ Wprowadzono komendę', `Root wywołał polecenie w terminalu na stronie:\n\`\`\`bash\n${cmd || '[Puste polecenie]'}\n\`\`\``, '#5865F2');

    const cmdLower = cmd.toLowerCase();

    if (cmdLower === 'sysinfo') {
        const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);
        const uptime = Math.floor(process.uptime());
        return res.json({ output: `System Uptime: ${uptime}s | RAM Usage: ${mem}MB | WS Ping: ${client.ws.ping}ms` });
    }
    
    if (cmdLower === 'db stats') {
        const tickCount = await TicketArchive.countDocuments();
        const views = await Counter.findOne({ id: 'views' });
        return res.json({ output: `MongoDB Atlas Stats:\n- Zarchiwizowane tickety: ${tickCount}\n- Liczba odsłon strony: ${views ? views.count : 0}` });
    }
    
    if (cmdLower.startsWith('bot status ')) {
        const statusText = cmd.substring(11);
        client.user.setActivity(statusText);
        return res.json({ output: `Ustawiono nowy status bota: "${statusText}"` });
    }

    return res.json({ output: `Nie rozpoznano polecenia: ${cmd}. Dostępne: sysinfo, db stats, bot status [tekst]` });
});

app.post('/api/reboot', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.id !== YOUR_DISCORD_ID) {
        logToTerminalDiscord('🚫 Zablokowano restart', `Próba wymuszenia restartu bez uprawnień (IP: \`${req.ip || 'Nieznane'}\`).`, '#ed4245');
        return res.status(403).json({ error: 'Brak uprawnień' });
    }
    logToTerminalDiscord('🔄 Restart systemu', `Zlecono polecenie \`reboot\`. Zamykanie procesów...`, '#fee75c');
    res.json({ message: 'Restart...' });
    setTimeout(() => process.exit(1), 1000);
});

// --- KOMENDY NA DISCORDZIE ---
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!clear') && message.author.id === YOUR_DISCORD_ID) {
        const args = message.content.split(' ');
        const amount = parseInt(args[1]);

        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply('Podaj prawidłową liczbę od 1 do 100, np. `!clear 10`').then(m => setTimeout(() => m.delete().catch(()=>null), 3000));
        }

        await message.delete().catch(() => null);
        const deleted = await message.channel.bulkDelete(amount, true).catch(err => {
            message.channel.send('Wystąpił błąd podczas usuwania wiadomości (wiadomości starsze niż 14 dni nie mogą być kasowane grupowo).').then(m => setTimeout(() => m.delete().catch(()=>null), 4000));
            return null;
        });

        if (deleted) {
            const fb = new EmbedBuilder()
                .setColor('#23a559')
                .setDescription(`🧹 **Teren czysty!**\nUsunięto \`${deleted.size}\` wiadomości na polecenie administratora.`);
            const msg = await message.channel.send({ embeds: [fb] });
            setTimeout(() => msg.delete().catch(() => null), 4000);
        }
    }

    if (message.content === '!backup' && message.author.id === YOUR_DISCORD_ID) {
        const counters = await Counter.find();
        const archives = await TicketArchive.find();
        const data = JSON.stringify({ statystyki: counters, archiwum_ticketow: archives }, null, 2);
        
        const buffer = Buffer.from(data, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, { name: `rapldez_backup_${Date.now()}.json` });
        
        await message.reply({ content: '📦 **Backup wygenerowany:** Pełny zrzut bazy danych w formacie JSON.', files: [attachment] });
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
        const embed = new EmbedBuilder();
        if (embedData.title) embed.setTitle(embedData.title);
        if (embedData.desc) embed.setDescription(embedData.desc.replace(/\\n/g, '\n'));
        embed.setColor(embedData.color && /^#[0-9A-F]{6}$/i.test(embedData.color) ? embedData.color : '#111214');
        if (embedData.footer) embed.setFooter({ text: embedData.footer });
        if (embedData.author) embed.setAuthor({ name: embedData.author });

        await message.channel.send({ embeds: [embed] });
        await message.delete().catch(() => null);
    }
});

// --- OBSŁUGA INTERAKCJI (TICKETY I PRZYCISKI) ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId === 'crash_restart') {
        if (interaction.user.id !== YOUR_DISCORD_ID) return interaction.reply({ content: 'Brak uprawnień.', ephemeral: true });
        await interaction.reply('🔄 Restartuję system za pośrednictwem środowiska...');
        setTimeout(() => process.exit(1), 1000);
        return;
    }

    if (interaction.user.id !== YOUR_DISCORD_ID && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.reply({ content: 'Tylko administrator.', ephemeral: true });
    }

    const topic = interaction.channel.topic || '';
    const parts = topic.split('|');
    let targetId = parts[0] || 'brak_id';
    let createdAtStr = 'Nieznana';
    
    const createdPart = parts.find(p => p && p.startsWith('CREATED:'));
    if (createdPart) createdAtStr = createdPart.replace('CREATED:', '');

    if (interaction.customId === 'close_ticket') {
        if (targetId && targetId !== 'brak_id') {
            await interaction.channel.permissionOverwrites.edit(targetId, { ViewChannel: false }).catch(() => null);
        }
        const closedAtStr = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
        interaction.channel.setTopic(`${targetId}|CREATED:${createdAtStr}|CLOSED:${closedAtStr}`).catch(() => null);

        const reopenRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_ticket').setLabel('Otwórz ponownie').setStyle(ButtonStyle.Success).setEmoji('🔓'),
            new ButtonBuilder().setCustomId('archive_ticket').setLabel('Archiwizuj i Usuń').setStyle(ButtonStyle.Danger).setEmoji('📁')
        );
        await interaction.reply({ content: `🔒 Zgłoszenie zamknięte (${closedAtStr}).`, components: [reopenRow] });
    }

    if (interaction.customId === 'open_ticket') {
        if (targetId && targetId !== 'brak_id') {
            await interaction.channel.permissionOverwrites.edit(targetId, { ViewChannel: true }).catch(() => null);
        }
        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Zamknij').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('archive_ticket').setLabel('Archiwizuj i Usuń').setStyle(ButtonStyle.Danger).setEmoji('📁')
        );
        await interaction.reply({ content: `🔓 Zgłoszenie otwarte dla <@${targetId}>.`, components: [closeRow] });
    }

    if (interaction.customId === 'archive_ticket') {
        await interaction.reply('📁 Generuję szczegółowe archiwum...');
        try {
            let messages = await interaction.channel.messages.fetch({ limit: 100 });
            messages = Array.from(messages.values()).reverse();
            
            const participantsSet = new Set();
            messages.forEach(m => {
                if (!m.author.bot) participantsSet.add(m.author.username);
            });
            const participantsList = participantsSet.size > 0 ? Array.from(participantsSet).join(', ') : 'Brak interakcji';

            let closedAtStr = 'Nie zamknięto ręcznie';
            const closedPart = parts.find(p => p && p.startsWith('CLOSED:'));
            if (closedPart) {
                closedAtStr = closedPart.replace('CLOSED:', '');
            } else if (topic.includes('CLOSED:')) {
                const match = topic.match(/CLOSED:([^|]+)/);
                if (match) closedAtStr = match[1];
            }
            
            const archivedAtStr = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });

            let htmlContent = `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><title>Archiwum</title><style>body{background:#313338;color:#dbdee1;font-family:sans-serif;padding:20px}.message{margin-bottom:15px}.author{font-weight:bold;color:#f2f3f5}.content{background:#2b2d31;padding:10px;border-radius:6px;display:inline-block}</style></head><body><h2>Archiwum: ${interaction.channel.name}</h2>`;
            messages.forEach(m => {
                htmlContent += `<div class="message"><span class="author">${m.author.username}</span> <span style="font-size:11px;color:#949ba4">${m.createdAt.toLocaleString('pl-PL')}</span><br><div class="content">${m.content || '[Media]'}</div></div>`;
            });
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

            // Przywrócony zwarty wygląd archiwalnego embeda z lepszym kontrastem
            const embedLog = new EmbedBuilder()
                .setColor('#23a559')
                .setAuthor({ name: '📁 RAPLDEZ OS • ARCHIWUM ZGŁOSZENIA' })
                .setDescription(
                    `>>> **• Nazwa kanału:** \`${interaction.channel.name}\`\n` +
                    `**• Ilość wiadomości:** \`${messages.length}\`\n` +
                    `**• Uczestnicy:** \`${participantsList}\`\n` +
                    `**• Otwarcie:** \`${createdAtStr}\`\n` +
                    `**• Zamknięcie:** \`${closedAtStr}\`\n` +
                    `**• Archiwizacja:** \`${archivedAtStr}\`\n` +
                    `**• Zarchiwizował:** <@${interaction.user.id}>`
                )
                .setFooter({ text: 'Zapisano w bazie MongoDB' })
                .setTimestamp();

            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                await logChannel.send({ embeds: [embedLog] });
            }
        } catch (err) {
            console.log('Błąd archiwizacji:', err);
        }

        setTimeout(() => { interaction.channel.delete().catch(() => null); }, 4000);
    }
});

const PORT = process.env.PORT || 3000;
client.once('ready', () => {
    console.log(`Bot zalogowany jako ${client.user.tag}`);
    app.listen(PORT, () => { console.log(`Serwer działa na porcie ${PORT}!`); });
});
client.login(BOT_TOKEN);