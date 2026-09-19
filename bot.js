const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const fetch = require('node-fetch');
const app = express();

app.use(cors({
    origin: true,
    credentials: true
}));
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

const counterSchema = new mongoose.Schema({
    id: { type: String, default: 'views' },
    count: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

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
            headers: { authorization: `${tokenData.token_type} ${tokenData.access_token}` },
        });

        const userData = await userResponse.json();

        if (userData.id === YOUR_DISCORD_ID) {
            req.session.user = {
                id: userData.id,
                username: userData.username,
                tag: userData.discriminator
            };
            return res.redirect('/?login=success');
        } else {
            return res.redirect('/?error=unauthorized');
        }
    } catch (error) {
        console.error('OAuth błąd:', error);
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
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// --- API STRONY ---

app.get('/api/views', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    try {
        if (!MONGO_URI) return res.json({ views: 'Brak Bazy' });
        
        let counter = await Counter.findOne({ id: 'views' });
        if (!counter) {
            counter = new Counter({ id: 'views', count: 0 });
        }
        counter.count += 1;
        await counter.save();
        
        res.json({ views: counter.count });
    } catch (err) {
        console.error("Błąd licznika:", err);
        res.status(500).json({ views: 'Live' });
    }
});

app.post('/api/kontakt', async (req, res) => {
    const { nick, subject, message } = req.body;

    if (!nick || !message || !subject) {
        return res.status(400).json({ error: 'Brakujące dane' });
    }

    try {
        const guild = client.guilds.cache.get(SERVER_ID);
        if (!guild) return res.status(500).json({ message: 'Błąd: Bot nie widzi serwera.' });

        const inputClean = nick.toLowerCase().trim();
        let member = null;

        try {
            const searchResults = await guild.members.fetch({ query: inputClean, limit: 10 });
            member = searchResults.find(m => 
                m.user.username.toLowerCase() === inputClean || 
                (m.user.globalName && m.user.globalName.toLowerCase() === inputClean) ||
                (m.nickname && m.nickname.toLowerCase() === inputClean)
            );

            if (!member) {
                const allMembers = await guild.members.fetch(); 
                member = allMembers.find(m => 
                    m.user.username.toLowerCase() === inputClean || 
                    (m.user.globalName && m.user.globalName.toLowerCase() === inputClean) ||
                    (m.nickname && m.nickname.toLowerCase() === inputClean)
                );
            }
        } catch (e) {
            console.log("Błąd szukania użytkownika:", e);
        }

        const permissionOverwrites = [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }
        ];

        if (member) {
            permissionOverwrites.push({
                id: member.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
            });
        }

        const safeNick = nick.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 16) || 'nieznany';
        const channelName = `ticket-${safeNick}`;
        const topicId = member ? member.id : 'brak_id';
        
        const newChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            topic: topicId,
            permissionOverwrites: permissionOverwrites
        });

        const pingText = member ? `<@${member.id}>` : 'Brak na serwerze';
        const dateStr = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });

        const embed = new EmbedBuilder()
            .setColor('#111214')
            .setAuthor({ name: '🎫 RAPLDEZ • ZGŁOSZENIE ZE STRONY' })
            .setDescription(`
**• 👤 × Informacje o nadawcy:**
\`—\` **× Nick ze strony:** \`${nick}\`
\`—\` **× Ping:** ${pingText}

**• 📩 × Informacje o zgłoszeniu:**
\`—\` **× Temat:** \`${subject}\`
\`—\` **× Data wysłania:** \`${dateStr}\`
\`—\` **× Treść:**
\`\`\`text\n${message}\n\`\`\`
            `)
            .setFooter({ text: 'rapldez OS • System zgłoszeń' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Zamknij').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('archive_ticket').setLabel('Archiwizuj').setStyle(ButtonStyle.Danger).setEmoji('📁')
        );

        await newChannel.send({ 
            content: `<@${YOUR_DISCORD_ID}> Masz nowe zgłoszenie!`, 
            embeds: [embed],
            components: [row]
        });
        
        res.status(200).json({ message: 'Zgłoszenie wysłane! Sprawdź Discorda.' });

    } catch (error) {
        console.error("Błąd przy tworzeniu ticketa:", error);
        res.status(500).json({ message: 'Wystąpił błąd podczas komunikacji z serwerem.' });
    }
});

app.post('/api/reboot', (req, res) => {
    if (!req.session || !req.session.user || req.session.user.id !== YOUR_DISCORD_ID) {
        return res.status(403).json({ error: 'Brak uprawnień' });
    }

    res.json({ message: 'Zlecono restart serwera.' });
    setTimeout(() => { process.exit(1); }, 1000);
});

// --- KOMENDY NA DISCORDZIE (Upiększony Kreator Embedów) ---
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!embed') && message.author.id === YOUR_DISCORD_ID) {
        const rawArgs = message.content.replace('!embed', '').trim();
        
        // Jeśli komenda jest pusta, wyślij ładnego, mrocznego embeda z instrukcją
        if (!rawArgs) {
            const helpEmbed = new EmbedBuilder()
                .setColor('#111214')
                .setAuthor({ name: '🛠️ RAPLDEZ • KREATOR EMBEDÓW' })
                .setDescription(`
**• 📌 × Instrukcja użycia:**
Wpisz komendę, używając pionowej kreski (\`|\`) do oddzielenia elementów.

**• ⚙️ × Dostępne parametry:**
\`—\` \`title=...\` – Tytuł embeda
\`—\` \`desc=...\` – Treść / Opis (możesz użyć \`\\n\` do nowej linijki)
\`—\` \`color=#HEX\` – Kolor paska bocznego (np. \`#23a559\`)
\`—\` \`author=...\` – Tekst w nagłówku (autor)
\`—\` \`footer=...\` – Tekst w stopce
\`—\` \`thumbnail=URL\` – Miniaturka w prawym górnym rogu
\`—\` \`image=URL\` – Duży obraz na samym dole

**• 💡 × Przykład:**
\`!embed title=Witaj! | desc=Zasady serwera:\\n1. Kultura\\n2. Szacunek | color=#23a559 | footer=Regulamin\`
                `)
                .setFooter({ text: 'rapldez OS • Generator stylów' })
                .setTimestamp();

            await message.channel.send({ embeds: [helpEmbed] });
            await message.delete().catch(() => null);
            return;
        }

        const parts = rawArgs.split('|');
        const embedData = {};
        
        parts.forEach(part => {
            const index = part.indexOf('=');
            if (index !== -1) {
                const key = part.substring(0, index).trim().toLowerCase();
                const value = part.substring(index + 1).trim();
                embedData[key] = value;
            }
        });

        const embed = new EmbedBuilder();
        let hasContent = false;
        
        if (embedData.title) { embed.setTitle(embedData.title); hasContent = true; }
        if (embedData.desc) { embed.setDescription(embedData.desc.replace(/\\n/g, '\n')); hasContent = true; }
        
        if (embedData.color && /^#[0-9A-F]{6}$/i.test(embedData.color)) {
            embed.setColor(embedData.color);
        } else {
            embed.setColor('#111214'); 
        }

        if (embedData.footer) embed.setFooter({ text: embedData.footer });
        if (embedData.author) embed.setAuthor({ name: embedData.author });
        
        try {
            if (embedData.image) embed.setImage(embedData.image);
            if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
        } catch (e) {
            console.log("Problem z załadowaniem grafiki.");
        }

        if (!hasContent) {
            embed.setDescription("⚠️ Zrobiłeś pusty embed! Musisz podać chociaż `title=` lub `desc=`.");
        }

        try {
            await message.channel.send({ embeds: [embed] });
            await message.delete().catch(() => null);
        } catch (err) {
            console.log("Błąd wysyłania embeda:", err);
            message.channel.send("Wystąpił błąd. Sprawdź, czy linki do obrazków są poprawne.");
        }
    }
});

// --- OBSŁUGA TICKETÓW ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.user.id !== YOUR_DISCORD_ID && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.reply({ content: 'Tylko administrator może zarządzać zgłoszeniem.', ephemeral: true });
    }

    const targetId = interaction.channel.topic; 

    if (interaction.customId === 'close_ticket') {
        if (targetId && targetId !== 'brak_id') {
            await interaction.channel.permissionOverwrites.edit(targetId, { ViewChannel: false }).catch(() => null);
        }
        const reopenRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_ticket').setLabel('Otwórz ponownie').setStyle(ButtonStyle.Success).setEmoji('🔓'),
            new ButtonBuilder().setCustomId('archive_ticket').setLabel('Archiwizuj i Usuń').setStyle(ButtonStyle.Danger).setEmoji('📁')
        );
        await interaction.reply({ content: '🔒 Zgłoszenie zamknięte.', components: [reopenRow] });
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
        await interaction.reply('📁 Generuję archiwum HTML...');
        try {
            let messages = await interaction.channel.messages.fetch({ limit: 100 });
            messages = Array.from(messages.values()).reverse();
            
            let htmlContent = `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><title>Archiwum</title><style>body{background:#313338;color:#dbdee1;font-family:sans-serif;padding:20px}.message{margin-bottom:15px}.author{font-weight:bold;color:#f2f3f5}.content{background:#2b2d31;padding:10px;border-radius:6px;display:inline-block}</style></head><body><h2>Archiwum: ${interaction.channel.name}</h2>`;
            messages.forEach(m => {
                htmlContent += `<div class="message"><span class="author">${m.author.username}</span> <span style="font-size:11px;color:#949ba4">${m.createdAt.toLocaleString('pl-PL')}</span><br><div class="content">${m.content || '[Media]'}</div></div>`;
            });
            htmlContent += `</body></html>`;

            const attachment = new AttachmentBuilder(Buffer.from(htmlContent, 'utf-8'), { name: `archiwum-${interaction.channel.name}.html` });
            const embedLog = new EmbedBuilder()
                .setColor('#111214')
                .setAuthor({ name: '📁 RAPLDEZ • ARCHIWUM TICKETA' })
                .setDescription(`**• Kanał:** \`${interaction.channel.name}\`\n**• Wiadomości:** \`${messages.length}\`\n**• Zarchiwizował:** <@${interaction.user.id}>`)
                .setTimestamp();

            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) await logChannel.send({ embeds: [embedLog], files: [attachment] });
        } catch (err) {
            console.log('Błąd:', err);
        }
        setTimeout(() => { interaction.channel.delete().catch(() => null); }, 5000);
    }
});

const PORT = process.env.PORT || 3000;
client.once('ready', () => {
    console.log(`Bot zalogowany jako ${client.user.tag}`);
    app.listen(PORT, () => { console.log(`Serwer działa na porcie ${PORT}!`); });
});
client.login(BOT_TOKEN);