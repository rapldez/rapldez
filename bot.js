const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI; 
const SERVER_ID = '1516145205215232050'; 
const CATEGORY_ID = '1550704110691422318'; 
const YOUR_DISCORD_ID = '920029957739139083';

// ID KANAŁU NA LOGI TICKETÓW
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

// --- API ---

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
    const { password } = req.body;
    if (password !== 'sigma123') return res.status(403).json({ error: 'Brak uprawnień' });

    res.json({ message: 'Zlecono restart serwera.' });
    
    setTimeout(() => {
        console.log('Zdalny restart przez WWW...');
        process.exit(1); 
    }, 1000);
});

// --- KOMENDY NA DISCORDZIE (Kreator Embedów) ---
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!embed') && message.author.id === YOUR_DISCORD_ID) {
        const rawArgs = message.content.replace('!embed', '').trim();
        
        if (!rawArgs) {
            return message.channel.send("Użyj komendy w ten sposób:\n`!embed title=Twój Tytuł | desc=Twój opis | color=#ff0000 | footer=Stopka | author=Autor | image=Link_do_zdjecia | thumbnail=Link_do_miniaturki`\nMożesz używać `\\n` w opisie, żeby zrobić nową linijkę. Czego nie wpiszesz, tego nie będzie.");
        }

        const parts = rawArgs.split('|');
        const embedData = {};

        // Rozbija komendę na klucz i wartość
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
        
        // Zabezpieczenie koloru (musi być format #XXXXXX), jak nie ma to dajemy czarny/mroczny
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
            console.log("Problem z załadowaniem grafiki do embeda.");
        }

        if (!hasContent) {
            embed.setDescription("Zrobiłeś pusty embed! Musisz wpisać chociaż `title=` albo `desc=`.");
        }

        try {
            await message.channel.send({ embeds: [embed] });
            await message.delete().catch(() => null);
        } catch (err) {
            console.log("Błąd wysyłania embeda:", err);
            message.channel.send("Coś poszło nie tak. Sprawdź, czy na pewno wrzuciłeś poprawne linki do zdjęć.");
        }
    }
});

// --- OBSŁUGA PRZYCISKÓW W TICKETACH ---
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
        
        await interaction.reply({ content: '🔒 Zgłoszenie zamknięte. Użytkownik stracił dostęp do kanału.', components: [reopenRow] });
    }

    if (interaction.customId === 'open_ticket') {
        if (targetId && targetId !== 'brak_id') {
            await interaction.channel.permissionOverwrites.edit(targetId, { ViewChannel: true }).catch(() => null);
        }
        
        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Zamknij').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('archive_ticket').setLabel('Archiwizuj i Usuń').setStyle(ButtonStyle.Danger).setEmoji('📁')
        );
        
        await interaction.reply({ content: `🔓 Zgłoszenie otwarte. Użytkownik <@${targetId}> znów widzi kanał.`, components: [closeRow] });
    }

    if (interaction.customId === 'archive_ticket') {
        await interaction.reply('📁 Generuję archiwum HTML... Kanał zostanie usunięty za 5 sekund.');
        
        try {
            let messages = await interaction.channel.messages.fetch({ limit: 100 });
            messages = Array.from(messages.values()).reverse();
            
            let htmlContent = `
            <!DOCTYPE html>
            <html lang="pl">
            <head>
                <meta charset="utf-8">
                <title>Archiwum - ${interaction.channel.name}</title>
                <style>
                    body { background-color: #313338; color: #dbdee1; font-family: sans-serif; padding: 20px; }
                    .message { margin-bottom: 15px; display: flex; flex-direction: column; }
                    .header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 5px; }
                    .author { color: #f2f3f5; font-weight: bold; font-size: 16px; }
                    .date { color: #949ba4; font-size: 12px; }
                    .content { font-size: 15px; line-height: 1.4; white-space: pre-wrap; background: #2b2d31; padding: 10px; border-radius: 6px; display: inline-block; max-width: 80%; }
                </style>
            </head>
            <body>
                <h2>Archiwum kanału: ${interaction.channel.name}</h2>
                <hr style="border-color: #404249; margin-bottom: 20px;">
            `;

            if (messages.length === 0) {
                htmlContent += `<p>Brak wiadomości tekstowych w tickecie.</p>`;
            } else {
                messages.forEach(m => {
                    const content = m.content || '[Załącznik/Embed]';
                    htmlContent += `
                    <div class="message">
                        <div class="header">
                            <span class="author">${m.author.username}</span>
                            <span class="date">${m.createdAt.toLocaleString('pl-PL')}</span>
                        </div>
                        <div class="content">${content}</div>
                    </div>
                    `;
                });
            }
            htmlContent += `</body></html>`;

            const attachment = new AttachmentBuilder(Buffer.from(htmlContent, 'utf-8'), { name: `archiwum-${interaction.channel.name}.html` });
            
            const authorVal = targetId && targetId !== 'brak_id' ? `<@${targetId}>` : '`Z poziomu WWW`';
            const embedLog = new EmbedBuilder()
                .setColor('#111214')
                .setAuthor({ name: '📁 RAPLDEZ • ARCHIWUM TICKETA' })
                .setDescription(`
**• 📁 × Informacje o kanale:**
\`—\` **× Nazwa:** \`${interaction.channel.name}\`
\`—\` **× Wiadomości:** \`${messages.length}\`

**• 👤 × Informacje o akcji:**
\`—\` **× Utworzył:** ${authorVal}
\`—\` **× Zarchiwizował:** <@${interaction.user.id}>
                `)
                .setFooter({ text: 'rapldez OS • Logi Zgłoszeń' })
                .setTimestamp();

            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            
            if (logChannel) {
                await logChannel.send({ embeds: [embedLog], files: [attachment] });
            } else {
                const adminUser = await client.users.fetch(YOUR_DISCORD_ID);
                await adminUser.send({ content: `⚠️ Nie mogłem wysłać na kanał logów. Archiwum: **${interaction.channel.name}**`, embeds: [embedLog], files: [attachment] });
            }

        } catch (err) {
            console.log('Błąd archiwizacji:', err);
        }

        setTimeout(() => { interaction.channel.delete().catch(() => null); }, 5000);
    }
});

const PORT = process.env.PORT || 3000;

client.once('ready', () => {
    console.log(`Bot zalogowany jako ${client.user.tag}`);
    app.listen(PORT, () => { console.log(`Serwer i bot działają na porcie ${PORT}!`); });
});

client.login(BOT_TOKEN);