const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, SlashCommandBuilder, Routes, ActivityType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const express = require('express');

// Express app for health check
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'VossBlade Bot is running!',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    bot: 'VossBlade Bot'
  });
});

app.listen(PORT, () => {
  console.log(`✅ Health check server running on port ${PORT}`);
});

// Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

// Data storage
const reminders = new Map();
const userEconomy = new Map();
const userRegistry = new Map();
let currentVoiceConnection = null;
let voiceChannelId = null;

// Bot ready event
client.once('ready', () => {
  console.log(`🚀 ${client.user.tag} is now online!`);
  console.log(`📊 Serving ${client.guilds.cache.size} servers`);
  
  client.user.setPresence({
    activities: [{ name: 'FamqVerse Economy | /help', type: ActivityType.Playing }],
    status: 'online'
  });
});

// Slash Commands - Sadece yeni komutlar
const commands = [
  new SlashCommandBuilder()
    .setName('connect-vc')
    .setDescription('Botu bir ses kanalına bağlar. (Sadece Yetkililer)'),

  new SlashCommandBuilder()
    .setName('disconnect-vc')
    .setDescription('Botu ses kanalından çıkarır. (Sadece Yetkililer)'),

].map(command => command.toJSON());

// Register slash commands
client.once('ready', async () => {
  try {
    const rest = new (require('discord.js').REST)({ version: '10' }).setToken(process.env.TOKEN);
    console.log('🔄 Slash komutları yükleniyor...');
    
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    
    console.log('✅ Slash komutları başarıyla yüklendi!');
  } catch (error) {
    console.error('❌ Slash komut yükleme hatası:', error);
  }
});

// Command handler
client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    const { commandName } = interaction;

    try {
      if (commandName === 'connect-vc') {
        await handleConnectVcCommand(interaction);
      } else if (commandName === 'disconnect-vc') {
        await handleDisconnectVcCommand(interaction);
      }
    } catch (error) {
      console.error(`Command error (${commandName}):`, error);
      await interaction.reply({
        content: '❌ Komut işlenirken bir hata oluştu!',
        ephemeral: true
      });
    }
  } else if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'voiceChannelSelect') {
      await handleVoiceChannelSelect(interaction);
    }
  }
});

// SES KANALI KOMUT FONKSİYONLARI
async function handleConnectVcCommand(interaction) {
  if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
    return await interaction.reply({
      content: '❌ Bu komutu kullanmak için **Kanalları Yönet** yetkisine sahip olmalısınız!',
      ephemeral: true
    });
  }

  if (currentVoiceConnection) {
    const channel = interaction.guild.channels.cache.get(voiceChannelId);
    return await interaction.reply({
      content: `❌ Bot zaten bir ses kanalında! (${channel ? channel.name : 'Bilinmeyen Kanal'})\nÖnce botun bağlantısını kesmek için \`/disconnect-vc\` komutunu kullanın.`,
      ephemeral: true
    });
  }

  const voiceChannels = interaction.guild.channels.cache.filter(channel => 
    channel.type === ChannelType.GuildVoice
  );

  if (voiceChannels.size === 0) {
    return await interaction.reply({
      content: '❌ Bu sunucuda hiç ses kanalı bulunmamaktadır!',
      ephemeral: true
    });
  }

  const selectMenu = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('voiceChannelSelect')
        .setPlaceholder('Bağlanmak için bir ses kanalı seçin...')
        .addOptions(
          voiceChannels.map(channel => ({
            label: channel.name,
            description: `Üye sayısı: ${channel.members.size}`,
            value: channel.id
          }))
        )
    );

  await interaction.reply({
    content: '**Botu bağlamak için bir ses kanalı seçin:**',
    components: [selectMenu],
    ephemeral: true
  });
}

async function handleDisconnectVcCommand(interaction) {
  if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
    return await interaction.reply({
      content: '❌ Bu komutu kullanmak için **Kanalları Yönet** yetkisine sahip olmalısınız!',
      ephemeral: true
    });
  }

  if (!currentVoiceConnection) {
    return await interaction.reply({
      content: '❌ Bot herhangi bir ses kanalında değil!',
      ephemeral: true
    });
  }

  try {
    currentVoiceConnection.destroy();
    currentVoiceConnection = null;
    voiceChannelId = null;

    await interaction.reply({
      content: '✅ Bot ses kanalından başarıyla ayrıldı!',
      ephemeral: true
    });
  } catch (error) {
    console.error('Ses kanalından ayrılma hatası:', error);
    await interaction.reply({
      content: '❌ Ses kanalından ayrılırken bir hata oluştu!',
      ephemeral: true
    });
  }
}

async function handleVoiceChannelSelect(interaction) {
  if (interaction.user.id !== interaction.message.interaction.user.id) {
    return await interaction.reply({
      content: '❌ Bu kanal seçimini sadece komutu kullanan kişi yapabilir!',
      ephemeral: true
    });
  }

  const channelId = interaction.values[0];
  const channel = interaction.guild.channels.cache.get(channelId);

  try {
    if (!channel) {
      return await interaction.reply({
        content: '❌ Kanal bulunamadı!',
        ephemeral: true
      });
    }

    if (channel.type !== ChannelType.GuildVoice) {
      return await interaction.reply({
        content: '❌ Bu bir ses kanalı değil!',
        ephemeral: true
      });
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`✅ Bot ${channel.name} ses kanalına bağlandı`);
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch (error) {
        console.log('🔌 Ses bağlantısı kesildi, yeniden bağlanılıyor...');
        connection.destroy();
        currentVoiceConnection = null;
        voiceChannelId = null;
      }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      console.log('🔌 Ses bağlantısı tamamen kesildi');
      currentVoiceConnection = null;
      voiceChannelId = null;
    });

    currentVoiceConnection = connection;
    voiceChannelId = channelId;

    const successEmbed = new EmbedBuilder()
      .setTitle('✅ Bot Ses Kanalına Bağlandı!')
      .setColor(0x00FF00)
      .addFields(
        { name: '🔊 Kanal', value: `${channel.name}`, inline: true },
        { name: '🆔 Kanal ID', value: channelId, inline: true },
        { name: '👂 Durum', value: 'Sağırlaştırıldı (Deafened)', inline: true },
        { name: '⏰ Bağlantı', value: '7/24 Aktif', inline: true }
      )
      .setFooter({ text: 'Bot kanaldan atılana kadar bağlı kalacak.', iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.update({ content: '', embeds: [successEmbed], components: [] });

  } catch (error) {
    console.error('Ses kanalına bağlanma hatası:', error);
    await interaction.reply({
      content: '❌ Ses kanalına bağlanırken bir hata oluştu!',
      ephemeral: true
    });
  }
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Login to Discord
client.login(process.env.TOKEN).catch(error => {
  console.error('❌ Discord login failed! Lütfen TOKEN ve CLIENT_ID değerlerini kontrol edin.');
  console.error('Hata detayı:', error.message);
  process.exit(1);
});
