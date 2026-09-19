const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); 
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.BOT_TOKEN;
const SERVER_ID = '1516145205215232050'; 
const CATEGORY_ID = '1550704110691422318'; 
const YOUR_DISCORD_ID = '920029957739139083';
const COUNTER_FILE = path.join(__dirname, 'licznik.txt');

if (!fs.existsSync(COUNTER_FILE)) {
    fs.writeFileSync(COUNTER_FILE, '0');
}

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

app.get('/api/views', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    try {
        let views = parseInt(fs.readFileSync(COUNTER_FILE, 'utf-8')) || 0;
        views++;
        fs.writeFileSync(COUNTER_FILE, views.toString());
        res.json({ views });
    } catch (err) {
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
        if (!guild) {
            return res.status(500).json({ message: 'Błąd: Bot nie widzi serwera.' });
        }

        // Miękkie szukanie użytkownika
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

        // Uprawnienia: domyślnie nikt nie widzi kanału (poza administracją serwera)
        const permissionOverwrites = [
            {
                id: guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
            }
        ];

        // Jeśli bot go znalazł, dostaje uprawnienia (żeby pisać z Tobą w tickecie)
        if (member) {
            permissionOverwrites.push({
                id: member.id,
                allow: [
                    PermissionsBitField.Flags.ViewChannel, 
                    PermissionsBitField.Flags.SendMessages, 
                    PermissionsBitField.Flags.ReadMessageHistory
                ],
            });
        }

        // Bezpieczna nazwa kanału i zapisanie ID w temacie (topic) do użycia w przyciskach
        const safeNick = nick.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 16) || 'nieznany';
        const channelName = `ticket-${safeNick}`;
        const topicId = member ? member.id : 'brak_id';
        
        const newChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            topic: topicId, // Ukryte zapamiętanie ID
            permissionOverwrites: permissionOverwrites
        });

        const pingText = member ? `<@${member.id}>` : 'Brak na serwerze (Nie można oznaczyć)';
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
\`—\` **× Data i godzina:** \`${dateStr}\`
\`—\` **× Treść:**
\`\`\`text\n${message}\n\`\`\`
            `)
            .setFooter({ text: 'rapldez OS • System zgłoszeń' });

        // Komplet przycisków startowych
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Zamknij').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('archive_ticket').setLabel('Archiwizuj').setStyle(ButtonStyle.Danger).setEmoji('📁')
        );

        // Ping na głównego admina + ładny embed
        await newChannel.send({ 
            content: `<@${YOUR_DISCORD_ID}> Masz nowe zgłoszenie!`, 
            embeds: [embed],
            components: [row]
        });
        
        res.status(200).json({ message: 'Zgłoszenie wysłane! Jeśli jesteś na moim serwerze Discord, dostałeś powiadomienie.' });

    } catch (error) {
        console.error("Błąd przy tworzeniu ticketa:", error);
        res.status(500).json({ message: 'Wystąpił błąd podczas komunikacji z Discordem.' });
    }
});

// LOGIKA PRZYCISKÓW W TICKETACH
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    // Uprawnienia - tylko Ty (lub admini) mogą klikać przyciski
    if (interaction.user.id !== YOUR_DISCORD_ID && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.reply({ content: 'Tylko administrator może zarządzać zgłoszeniem.', ephemeral: true });
    }

    const targetId = interaction.channel.topic; 

    // ZAMKNIJ TICKET (Odbiera dostęp graczowi)
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

    // OTWÓRZ TICKET (Przywraca dostęp graczowi)
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

    // ARCHIWIZUJ TICKET (Zapisuje log do TXT, wysyła Ci na PW i usuwa kanał)
    if (interaction.customId === 'archive_ticket') {
        await interaction.reply('📁 Generuję archiwum... Kanał zostanie usunięty za 5 sekund.');
        
        try {
            // Pobieranie historii kanału
            let messages = await interaction.channel.messages.fetch({ limit: 100 });
            let logText = messages.reverse().map(m => `[${m.createdAt.toLocaleString('pl-PL')}] ${m.author.username}: ${m.content}`).join('\n');
            
            if (logText.trim() === '') logText = 'Brak wiadomości tekstowych w tickecie.';

            const attachment = new AttachmentBuilder(Buffer.from(logText, 'utf-8'), { name: `archiwum-${interaction.channel.name}.txt` });
            
            // Wysłanie PW do Ciebie
            const adminUser = await client.users.fetch(YOUR_DISCORD_ID);
            await adminUser.send({ content: `📁 Zarchiwizowano zgłoszenie: **${interaction.channel.name}**`, files: [attachment] });
        } catch (err) {
            console.log('Błąd archiwizacji (mogło zablokować PW):', err);
        }

        setTimeout(() => {
            interaction.channel.delete().catch(() => null);
        }, 5000);
    }
});

const PORT = process.env.PORT || 3000;

client.once('ready', () => {
    console.log(`Bot zalogowany jako ${client.user.tag}`);
    app.listen(PORT, () => {
        console.log(`Serwer i bot działają na porcie ${PORT}!`);
    });
});

client.login(BOT_TOKEN);