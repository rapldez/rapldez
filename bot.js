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

// TUTAJ WKLEJ ID KANAŁU, NA KTÓRY MAJĄ LECIEĆ ZARCHIWIZOWANE TICKETY
const LOG_CHANNEL_ID = '1550753070726512730'; 

// ---------------- MONGODB ----------------
const counterSchema = new mongoose.Schema({
    id: { type: String, default: 'views' },
    count: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('✅ Połączono z bazą MongoDB!'))
        .catch(err => console.error('❌ Błąd połączenia z MongoDB:', err));
} else {
    console.log('⚠️ Brak MONGO_URI! Licznik nie będzie działał.');
}
// -----------------------------------------

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

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
        await interaction.reply('📁 Generuję archiwum... Kanał zostanie usunięty za 5 sekund.');
        
        try {
            let messages = await interaction.channel.messages.fetch({ limit: 100 });
            messages = Array.from(messages.values()).reverse();
            
            // Generowanie kodu HTML
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
            
            // Tworzenie embeda do logów
            const embedLog = new EmbedBuilder()
                .setColor('#2b2d31')
                .setAuthor({ name: `📁 Archiwum: ${interaction.channel.name}` })
                .addFields(
                    { name: '👤 Utworzył', value: targetId && targetId !== 'brak_id' ? `<@${targetId}>` : 'Z poziomu WWW', inline: true },
                    { name: '🔒 Zarchiwizował', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '💬 Wiadomości', value: `${messages.length}`, inline: true }
                )
                .setFooter({ text: 'rapldez OS • Logi Zgłoszeń' })
                .setTimestamp();

            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            
            if (logChannel) {
                await logChannel.send({ embeds: [embedLog], files: [attachment] });
            } else {
                // Zabezpieczenie: jeśli nie ma kanału logów, wysyła na PW
                const adminUser = await client.users.fetch(YOUR_DISCORD_ID);
                await adminUser.send({ content: `⚠️ Nie skonfigurowano ID kanału logów. Archiwum: **${interaction.channel.name}**`, embeds: [embedLog], files: [attachment] });
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
