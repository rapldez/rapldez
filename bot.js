const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, EmbedBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.BOT_TOKEN;
const SERVER_ID = '1516145205215232050'; 
const CATEGORY_ID = '1550704110691422318'; 

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

app.post('/api/kontakt', async (req, res) => {
    const { nick, discordId, subject, message } = req.body;

    if (!nick || !message || !subject) {
        return res.status(400).json({ error: 'Brakujące dane' });
    }

    try {
        const guild = client.guilds.cache.get(SERVER_ID);
        if (!guild) {
            console.error("Błąd: Bot nie widzi serwera o ID:", SERVER_ID);
            return res.status(500).json({ error: 'Bot nie widzi serwera.' });
        }

        let member = null;
        if (discordId) {
            try {
                member = await guild.members.fetch(discordId.trim());
            } catch (err) {
                console.log(`Nie znaleziono użytkownika o ID: ${discordId}`);
            }
        }

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

        const embed = new EmbedBuilder()
            .setTitle(`Nowe zgłoszenie ze strony: ${subject}`)
            .setColor('#23a559')
            .addFields(
                { name: 'Nick', value: nick, inline: true },
                { name: 'Podane Discord ID', value: discordId || 'Brak', inline: true },
                { name: 'Użytkownik na serwerze?', value: member ? `<@${member.id}>` : 'Nie znaleziono / Złe ID', inline: false },
                { name: 'Treść zgłoszenia', value: message, inline: false }
            )
            .setTimestamp();

        await newChannel.send({ embeds: [embed] });
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
