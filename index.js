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
    bot: client?.user?.tag || 'starting...'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Health check server running on port ${PORT}`);
});

// Discord Client with minimal intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ]
});

// Bot ready event
client.once('ready', () => {
  console.log(`🚀 ${client.user.tag} is now online!`);
  console.log(`📊 Serving ${client.guilds.cache.size} servers`);
  
  // Set bot activity
  client.user.setPresence({
    activities: [{ name: 'VossBlade Famq', type: ActivityType.Watching }],
    status: 'online'
  });
});

// Slash Commands
const commands = [
  // Help command
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Tüm bot komutlarını gösterir.'),

  // Moderation commands
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

  // Bot commands
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Botun ping değerini gösterir.'),

  // Music commands menu
  new SlashCommandBuilder()
    .setName('music')
    .setDescription('Müzik komutlarını gösterir.'),

  // Fun commands
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

  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Bota bir şey söyletir.')
    .addStringOption(option =>
      option.setName('mesaj')
        .setDescription('Botun söyleyeceği mesaj')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('random')
    .setDescription('Rastgele sayı üretir.')
    .addIntegerOption(option =>
      option.setName('min')
        .setDescription('Minimum değer')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('max')
        .setDescription('Maksimum değer')
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
    // HELP COMMAND
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
            value: '• `/music` - Müzik komutlarını gösterir\n*(Yakında eklenecek!)*',
            inline: false
          },
          {
            name: '😄 **Eğlence**',
            value: '• `/avatar` - Avatar gösterir\n• `/serverinfo` - Sunucu bilgisi\n• `/userinfo` - Kullanıcı bilgisi\n• `/say` - Mesaj söyletir\n• `/random` - Rastgele sayı',
            inline: false
          },
          {
            name: '🤖 **Bot**',
            value: '• `/ping` - Bot pingini gösterir\n• `/help` - Bu menüyü gösterir',
            inline: false
          }
        )
        .setImage('https://media.discordapp.net/attachments/962353412480069652/1428851964149764166/standard.gif?ex=68f40197&is=68f2b017&hm=b7b73097e5dd8c90fa0d8e2713d86b1402dca891fcc1bbe99de673cda456c666&=')
        .setFooter({ text: `VossBlade Famq Bot | Toplam ${client.guilds.cache.size} sunucu`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      await interaction.reply({ embeds: [helpEmbed] });
    }

    // CLEAR COMMAND
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
        console.error('Clear error:', error);
        await interaction.editReply({
          content: '❌ Mesajlar silinirken bir hata oluştu! (14 günden eski mesajlar silinemez)'
        });
      }
    }

    // BAN COMMAND
    else if (commandName === 'ban') {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers)) {
        return await interaction.reply({
          content: '❌ Bu komutu kullanmak için **Üyeleri Yasakla** yetkisine sahip olmalısınız!',
          ephemeral: true
        });
      }

      const targetUser = options.getUser('kullanıcı');
      const reason = options.getString('sebep') || 'Sebep belirtilmedi.';

      // Check if user exists and is bannable
      const member = guild.members.cache.get(targetUser.id);
      if (!member) {
        return await interaction.reply({
          content: '❌ Kullanıcı bulunamadı!',
          ephemeral: true
        });
      }

      if (!member.bannable) {
        return await interaction.reply({
          content: '❌ Bu kullanıcıyı banlayamıyorum! (Yetki yetersiz)',
          ephemeral: true
        });
      }

      try {
        await member.ban({ reason: `${reason} - Banlayan: ${user.tag}` });
        
        const banEmbed = new EmbedBuilder()
          .setTitle('🔨 Kullanıcı Banlandı')
          .setColor(0xFF0000)
          .addFields(
            { name: 'Kullanıcı', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
            { name: 'Banlayan', value: user.tag, inline: true },
            { name: 'Sebep', value: reason, inline: false }
          )
          .setTimestamp()
          .setFooter({ text: 'VossBlade Famq Moderation' });

        await interaction.reply({ embeds: [banEmbed] });
      } catch (error) {
        console.error('Ban error:', error);
        await interaction.reply({
          content: '❌ Kullanıcı banlanırken bir hata oluştu!',
          ephemeral: true
        });
      }
    }

    // PING COMMAND
    else if (commandName === 'ping') {
      const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
      const ping = sent.createdTimestamp - interaction.createdTimestamp;

      const pingEmbed = new EmbedBuilder()
        .setTitle('📊 Bot İstatistikleri')
        .setColor(0x00FF00)
        .addFields(
          { name: '🔄 API Gecikmesi', value: `\`${client.ws.ping}ms\``, inline: true },
          { name: '🤖 Bot Gecikmesi', value: `\`${ping}ms\``, inline: true },
          { name: '🕒 Çalışma Süresi', value: formatUptime(process.uptime()), inline: true }
        )
        .setFooter({ text: `İsteyen: ${user.tag}`, iconURL: user.displayAvatarURL() })
        .setTimestamp();

      await interaction.editReply({ content: '', embeds: [pingEmbed] });
    }

    // MUSIC COMMAND
    else if (commandName === 'music') {
      const musicEmbed = new EmbedBuilder()
        .setTitle('🎵 VossBlade Famq Müzik Sistemi')
        .setDescription('Müzik komutları yakında eklenecek! 🎶')
        .setColor(0x0099FF)
        .addFields(
          { name: 'Planlanan Komutlar', value: '• `/play` - Şarkı çalar\n• `/pause` - Duraklatır\n• `/resume` - Devam ettirir\n• `/stop` - Durdurur\n• `/queue` - Kuyruğu gösterir', inline: false },
          { name: 'Not', value: 'Müzik sistemi şu anda geliştirme aşamasındadır. En kısa sürede eklenecek!', inline: false }
        )
        .setFooter({ text: 'VossBlade Famq Music', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      await interaction.reply({ embeds: [musicEmbed] });
    }

    // AVATAR COMMAND
    else if (commandName === 'avatar') {
      const targetUser = options.getUser('kullanıcı') || user;
      
      const avatarEmbed = new EmbedBuilder()
        .setTitle(`📷 ${targetUser.username} Avatarı`)
        .setColor(0x00AE86)
        .setImage(targetUser.displayAvatarURL({ size: 4096, dynamic: true }))
        .setFooter({ text: `İsteyen: ${user.tag}`, iconURL: user.displayAvatarURL() })
        .setTimestamp();

      await interaction.reply({ embeds: [avatarEmbed] });
    }

    // SERVERINFO COMMAND
    else if (commandName === 'serverinfo') {
      const { guild } = interaction;
      const owner = await guild.fetchOwner();

      const serverEmbed = new EmbedBuilder()
        .setTitle(`📊 ${guild.name} Sunucu Bilgileri`)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setColor(0x0099FF)
        .addFields(
          { name: '👑 Sunucu Sahibi', value: `${owner.user.tag}`, inline: true },
          { name: '🆔 Sunucu ID', value: guild.id, inline: true },
          { name: '📅 Oluşturulma', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '👥 Üye Sayısı', value: `**${guild.memberCount}** üye`, inline: true },
          { name: '📊 Boost Seviyesi', value: `Seviye ${guild.premiumTier}`, inline: true },
          { name: '🚀 Boost Sayısı', value: `**${guild.premiumSubscriptionCount}** boost`, inline: true },
          { name: '🔊 Kanallar', value: `**${guild.channels.cache.size}** kanal`, inline: true },
          { name: '😎 Emojiler', value: `**${guild.emojis.cache.size}** emoji`, inline: true },
          { name: '🛡️ Roller', value: `**${guild.roles.cache.size}** rol`, inline: true }
        )
        .setFooter({ text: `İsteyen: ${user.tag}`, iconURL: user.displayAvatarURL() })
        .setTimestamp();

      await interaction.reply({ embeds: [serverEmbed] });
    }

    // USERINFO COMMAND
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
          { name: '📅 Sunucuya Katılma', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Bilinmiyor', inline: true },
          { name: '🎨 Rol Sayısı', value: member ? `**${member.roles.cache.size - 1}** rol` : 'Bilinmiyor', inline: true },
          { name: '🤖 Bot mu?', value: targetUser.bot ? 'Evet 🤖' : 'Haydi 👤', inline: true }
        )
        .setFooter({ text: `İsteyen: ${user.tag}`, iconURL: user.displayAvatarURL() })
        .setTimestamp();

      if (member && member.roles.cache.size > 1) {
        const roles = member.roles.cache
          .filter(role => role.id !== guild.id)
          .map(role => role.toString())
          .join(', ')
          .slice(0, 1024);

        userEmbed.addFields({ 
          name: `🎭 Roller (${member.roles.cache.size - 1})`, 
          value: roles || 'Rol yok', 
          inline: false 
        });
      }

      await interaction.reply({ embeds: [userEmbed] });
    }

    // SAY COMMAND
    else if (commandName === 'say') {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return await interaction.reply({
          content: '❌ Bu komutu kullanmak için **Mesajları Yönet** yetkisine sahip olmalısınız!',
          ephemeral: true
        });
      }

      const message = options.getString('mesaj');
      
      await interaction.reply({ content: '✅ Mesaj gönderildi!', ephemeral: true });
      await channel.send(message);
    }

    // RANDOM COMMAND
    else if (commandName === 'random') {
      const min = options.getInteger('min') || 1;
      const max = options.getInteger('max') || 100;
      
      if (min >= max) {
        return await interaction.reply({
          content: '❌ Minimum değer maksimum değerden küçük olmalıdır!',
          ephemeral: true
        });
      }

      const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
      
      const randomEmbed = new EmbedBuilder()
        .setTitle('🎲 Rastgele Sayı Üretici')
        .setColor(0x9B59B6)
        .addFields(
          { name: 'Aralık', value: `${min} - ${max}`, inline: true },
          { name: 'Sonuç', value: `**${randomNum}**`, inline: true }
        )
        .setFooter({ text: `İsteyen: ${user.tag}`, iconURL: user.displayAvatarURL() })
        .setTimestamp();

      await interaction.reply({ embeds: [randomEmbed] });
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

// Utility functions
function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}g`);
  if (hours > 0) parts.push(`${hours}s`);
  if (minutes > 0) parts.push(`${minutes}d`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}sn`);

  return parts.join(' ');
}

// Error handling
client.on('error', (error) => {
  console.error('❌ Discord Client Error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

// Login to Discord
client.login(process.env.TOKEN).catch(error => {
  console.error('❌ Discord login failed:', error);
  process.exit(1);
});
