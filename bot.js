const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, EmbedBuilder } = require('discord.js');
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
            console.error("Błąd: Bot nie widzi serwera o ID:", SERVER_ID);
            return res.status(500).json({ error: 'Bot nie widzi serwera.' });
        }

        await guild.members.fetch(); 
        
        const targetNick = nick.toLowerCase();
        const member = guild.members.cache.find(m => 
            m.user.username.toLowerCase() === targetNick || 
            (m.user.globalName && m.user.globalName.toLowerCase() === targetNick) ||
            (m.nickname && m.nickname.toLowerCase() === targetNick)
        );

        let permissionOverwrites = [
            {
                id: guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
            }
        ];

        if (member) {
            permissionOverwrites.push({
                id: member.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
            });
        }

        const channelName = `ticket-${nick.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        const newChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: permissionOverwrites
        });

        const memberIdText = member ? member.id : 'Brak użytkownika na serwerze';
        const memberPing = member ? `<@${member.id}>` : `\`${nick}\``;
        const avatarUrl = member ? member.user.displayAvatarURL({ dynamic: true }) : 'https://cdn.discordapp.com/embed/avatars/0.png';

        const embed = new EmbedBuilder()
            .setColor('#111214')
            .setAuthor({ name: '🎫 RAPLDEZ • TICKET', iconURL: avatarUrl })
            .setThumbnail(avatarUrl)
            .setDescription(`
**• 👤 × Informacje o nadawcy:**
\`—\` **× Ping:** ${memberPing}
\`—\` **× Nick:** \`${nick}\`
\`—\` **× ID:** \`${memberIdText}\`

**• 📩 × Informacje o zgłoszeniu:**
\`—\` **× Temat:** \`${subject}\`
\`—\` **× Treść:**
\`\`\`text\n${message}\n\`\`\`
            `)
            .setFooter({ text: 'rapldez OS • System zgłoszeń' })
            .setTimestamp();

        await newChannel.send({ content: `<@${YOUR_DISCORD_ID}> Masz nowe zgłoszenie!`, embeds: [embed] });
        res.status(200).json({ success: true, message: 'Zgłoszenie utworzone.' });

    } catch (error) {
        console.error("Błąd przy tworzeniu ticketa:", error);
        res.status(500).json({ error: 'Wystąpił błąd serwera.' });
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