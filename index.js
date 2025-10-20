const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, SlashCommandBuilder, Routes, ActivityType } = require('discord.js');
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

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Health check server running on port ${PORT}`);
});

// Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// Bot ready event
client.once('ready', () => {
  console.log(`🚀 ${client.user.tag} is now online!`);
  console.log(`📊 Serving ${client.guilds.cache.size} servers`);
  
  client.user.setPresence({
    activities: [{ name: 'VossBlade Famq | /help', type: ActivityType.Watching }],
    status: 'online'
  });
});

// Slash Commands (Sadece temel komutlar)
const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Tüm bot komutlarını gösterir.'),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Belirtilen sayıda mesajı siler.')
    .addIntegerOption(option =>
      option.setName('miktar')
        .setDescription('Silinecek mesaj sayısı (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Kullanıcıyı sunucudan banlar.')
    .addUserOption(option =>
      option.setName('kullanıcı')
        .setDescription('Banlanacak kullanıcı')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('sebep')
        .setDescription('Ban sebebi')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Botun ping değerini gösterir.'),

  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Kullanıcının avatarını gösterir.')
    .addUserOption(option =>
      option.setName('kullanıcı')
        .setDescription('Avatarını görmek istediğiniz kullanıcı')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Sunucu bilgilerini gösterir.'),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Kullanıcı bilgilerini gösterir.')
    .addUserOption(option =>
      option.setName('kullanıcı')
        .setDescription('Bilgilerini görmek istediğiniz kullanıcı')
        .setRequired(false)),

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
  if (!interaction.isCommand()) return;

  const { commandName, options, user, guild, channel } = interaction;

  try {
    if (commandName === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setTitle('🎮 VossBlade Famq Bot Komutları')
        .setDescription('Aşağıda tüm bot komutlarını bulabilirsiniz:')
        .setColor(0x00AE86)
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          {
            name: '🛡️ **Moderasyon**',
            value: '• `/clear` - Mesajları temizler\n• `/ban` - Kullanıcıyı banlar',
            inline: false
          },
          {
            name: '🎵 **Müzik**',
            value: '• *Yakında eklenecek!* 🔧',
            inline: false
          },
          {
            name: '😄 **Eğlence**',
            value: '• `/avatar` - Avatar gösterir\n• `/serverinfo` - Sunucu bilgisi\n• `/userinfo` - Kullanıcı bilgisi',
            inline: false
          },
          {
            name: '🤖 **Bot**',
            value: '• `/ping` - Bot pingini gösterir\n• `/help` - Bu menüyü gösterir',
            inline: false
          }
        )
        .setImage('https://media.discordapp.net/attachments/962353412480069652/1429871003936493579/standard_4.gif?ex=68f7b6a5&is=68f66525&hm=f1bdd34f0f60a3637928f51390113da39e539745ea2bc315a563b3398091bea2&=')
        .setFooter({ text: `VossBlade Famq Bot | Toplam ${client.guilds.cache.size} sunucu`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      await interaction.reply({ embeds: [helpEmbed] });
    }

    else if (commandName === 'clear') {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return await interaction.reply({
          content: '❌ Bu komutu kullanmak için **Mesajları Yönet** yetkisine sahip olmalısınız!',
          ephemeral: true
        });
      }

      const amount = options.getInteger('miktar');
      
      try {
        await interaction.deferReply({ ephemeral: true });
        const messages = await channel.bulkDelete(amount, true);
        await interaction.editReply({
          content: `✅ **${messages.size}** mesaj başarıyla silindi!`
        });
      } catch (error) {
        await interaction.editReply({
          content: '❌ Mesajlar silinirken bir hata oluştu! (14 günden eski mesajlar silinemez)'
        });
      }
    }

    else if (commandName === 'ban') {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers)) {
        return await interaction.reply({
          content: '❌ Bu komutu kullanmak için **Üyeleri Yasakla** yetkisine sahip olmalısınız!',
          ephemeral: true
        });
      }

      const targetUser = options.getUser('kullanıcı');
      const reason = options.getString('sebep') || 'Sebep belirtilmedi.';

      try {
        await interaction.guild.members.ban(targetUser, { reason: `${reason} - Banlayan: ${user.tag}` });
        
        const banEmbed = new EmbedBuilder()
          .setTitle('🔨 Kullanıcı Banlandı')
          .setColor(0xFF0000)
          .addFields(
            { name: 'Kullanıcı', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
            { name: 'Banlayan', value: user.tag, inline: true },
            { name: 'Sebep', value: reason, inline: false }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [banEmbed] });
      } catch (error) {
        await interaction.reply({
          content: '❌ Kullanıcı banlanırken bir hata oluştu!',
          ephemeral: true
        });
      }
    }

    else if (commandName === 'ping') {
      const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
      const ping = sent.createdTimestamp - interaction.createdTimestamp;

      const pingEmbed = new EmbedBuilder()
        .setTitle('📊 Bot İstatistikleri')
        .setColor(0x00FF00)
        .addFields(
          { name: '🔄 API Gecikmesi', value: `\`${client.ws.ping}ms\``, inline: true },
          { name: '🤖 Bot Gecikmesi', value: `\`${ping}ms\``, inline: true }
        );

      await interaction.editReply({ content: '', embeds: [pingEmbed] });
    }

    else if (commandName === 'avatar') {
      const targetUser = options.getUser('kullanıcı') || user;
      
      const avatarEmbed = new EmbedBuilder()
        .setTitle(`📷 ${targetUser.username} Avatarı`)
        .setColor(0x00AE86)
        .setImage(targetUser.displayAvatarURL({ size: 4096, dynamic: true }));

      await interaction.reply({ embeds: [avatarEmbed] });
    }

    else if (commandName === 'serverinfo') {
      const owner = await guild.fetchOwner();

      const serverEmbed = new EmbedBuilder()
        .setTitle(`📊 ${guild.name} Sunucu Bilgileri`)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setColor(0x0099FF)
        .addFields(
          { name: '👑 Sunucu Sahibi', value: `${owner.user.tag}`, inline: true },
          { name: '🆔 Sunucu ID', value: guild.id, inline: true },
          { name: '📅 Oluşturulma', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '👥 Üye Sayısı', value: `**${guild.memberCount}** üye`, inline: true }
        );

      await interaction.reply({ embeds: [serverEmbed] });
    }

    else if (commandName === 'userinfo') {
      const targetUser = options.getUser('kullanıcı') || user;
      const member = guild.members.cache.get(targetUser.id);

      const userEmbed = new EmbedBuilder()
        .setTitle(`👤 ${targetUser.tag} Kullanıcı Bilgileri`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setColor(0x00AE86)
        .addFields(
          { name: '🆔 Kullanıcı ID', value: targetUser.id, inline: true },
          { name: '👤 Kullanıcı Adı', value: targetUser.tag, inline: true },
          { name: '📅 Hesap Oluşturma', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '📅 Sunucuya Katılma', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Bilinmiyor', inline: true }
        );

      await interaction.reply({ embeds: [userEmbed] });
    }

  } catch (error) {
    console.error(`Command error (${commandName}):`, error);
    
    if (!interaction.replied) {
      await interaction.reply({
        content: '❌ Komut işlenirken bir hata oluştu!',
        ephemeral: true
      });
    }
  }
});

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
