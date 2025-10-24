const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, SlashCommandBuilder, Routes, ActivityType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
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

// Hatırlatıcılar için Map
const reminders = new Map();

// Bot ready event
client.once('ready', () => {
  console.log(`🚀 ${client.user.tag} is now online!`);
  console.log(`📊 Serving ${client.guilds.cache.size} servers`);
  
  client.user.setPresence({
    activities: [{ name: 'VossBlade Famq | /help', type: ActivityType.Watching }],
    status: 'online'
  });

  // Hatırlatıcı kontrol interval'ini başlat
  setInterval(() => {
    const now = Date.now();
    reminders.forEach((reminder, reminderId) => {
      if (now >= reminder.nextRun) {
        sendReminder(reminderId);
      }
    });
  }, 30000); // 30 saniyede bir kontrol et
});

// Slash Commands
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
    .setName('kaccm')
    .setDescription('Kullanıcının kaç cm olduğunu söyler.')
    .addUserOption(option =>
      option.setName('kullanıcı')
        .setDescription('Kaç cm olduğunu öğrenmek istediğiniz kullanıcı')
        .setRequired(false)),

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
    .setName('reminder')
    .setDescription('Periyodik hatırlatıcı oluşturur.'),

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
              value: '• *Yakında eklenecek!* 🎵\n*Müzik sistemi şu anda geliştirme aşamasındadır.*',
              inline: false
            },
            {
              name: '😄 **Eğlence**',
              value: '• `/avatar` - Avatar gösterir\n• `/serverinfo` - Sunucu bilgisi\n• `/userinfo` - Kullanıcı bilgisi\n• `/kaccm` - Kaç cm olduğunu söyler\n• `/say` - Bota mesaj söyletir\n• `/reminder` - Periyodik hatırlatıcı oluşturur',
              inline: false
            },
            {
              name: '🤖 **Bot**',
              value: '• `/ping` - Bot pingini gösterir\n• `/help` - Bu menüyü gösterir',
              inline: false
            }
          )
          .setImage('https://media.discordapp.net/attachments/962353412480069652/1429871003936493579/standard_4.gif?ex=68fc53e5&is=68fb0265&hm=45c6312606f3a07506abaf28bfdb3b898479a02be7a9e7fe44e4854dde540d45&=')
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

      else if (commandName === 'kaccm') {
        const targetUser = options.getUser('kullanıcı') || user;
        const randomCm = Math.floor(Math.random() * 50) + 1;

        const messages = [
          "Vay canına! 😲",
          "İnanılmaz! 🎯",
          "Bu çok iyi! 🔥",
          "Wow! 🌟",
          "Harika! 💪"
        ];
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];

        const cmEmbed = new EmbedBuilder()
          .setTitle(`🧐 ${targetUser.username} Kaç CM?`)
          .setDescription(`**${randomCm} CM**\n\n${randomMessage}`)
          .setColor(0xFF69B4)
          .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: 'Ölçen', value: user.tag, inline: true },
            { name: 'Ölçülen', value: targetUser.tag, inline: true }
          )
          .setFooter({ text: 'VossBlade Famq Eğlence', iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        await interaction.reply({ embeds: [cmEmbed] });
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

      else if (commandName === 'say') {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
          return await interaction.reply({
            content: '❌ Bu komutu kullanmak için **Mesajları Yönet** yetkisine sahip olmalısınız!',
            ephemeral: true
          });
        }

        const message = options.getString('mesaj');
        
        await interaction.reply({ content: '✅ Mesaj gönderildi!', ephemeral: true });
        await interaction.channel.send(message);
      }

      else if (commandName === 'reminder') {
        await handleReminderCommand(interaction);
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
  } else if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction);
  }
});

// REMİNDER FONKSİYONLARI

async function handleReminderCommand(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('reminderModal')
    .setTitle('Hatırlatıcı Oluştur');

  const channelInput = new TextInputBuilder()
    .setCustomId('channelInput')
    .setLabel("Kanal ID")
    .setPlaceholder("123456789012345678")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const memberInput = new TextInputBuilder()
    .setCustomId('memberInput')
    .setLabel("Etiketlenecek Kişi ID")
    .setPlaceholder("123456789012345678")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const messageInput = new TextInputBuilder()
    .setCustomId('messageInput')
    .setLabel("Hatırlatma Mesajı")
    .setPlaceholder("Toplantı başlıyor!")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const intervalInput = new TextInputBuilder()
    .setCustomId('intervalInput')
    .setLabel("Zaman Aralığı (dakika)")
    .setPlaceholder("10")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const nameInput = new TextInputBuilder()
    .setCustomId('nameInput')
    .setLabel("Hatırlatıcı İsmi")
    .setPlaceholder("Günlük Toplantı")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const firstActionRow = new ActionRowBuilder().addComponents(channelInput);
  const secondActionRow = new ActionRowBuilder().addComponents(memberInput);
  const thirdActionRow = new ActionRowBuilder().addComponents(messageInput);
  const fourthActionRow = new ActionRowBuilder().addComponents(intervalInput);
  const fifthActionRow = new ActionRowBuilder().addComponents(nameInput);

  modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);

  await interaction.showModal(modal);
}

async function handleModalSubmit(interaction) {
  if (interaction.customId === 'reminderModal') {
    try {
      const channelId = interaction.fields.getTextInputValue('channelInput');
      const memberId = interaction.fields.getTextInputValue('memberInput');
      const message = interaction.fields.getTextInputValue('messageInput');
      const intervalMinutes = interaction.fields.getTextInputValue('intervalInput');
      const name = interaction.fields.getTextInputValue('nameInput');

      const channel = interaction.guild.channels.cache.get(channelId);
      if (!channel) {
        return await interaction.reply({ 
          content: '❌ Geçersiz kanal ID! Lütfen doğru bir kanal IDsi girin.', 
          ephemeral: true 
        });
      }

      const member = interaction.guild.members.cache.get(memberId);
      if (!member) {
        return await interaction.reply({ 
          content: '❌ Geçersiz kullanıcı ID! Lütfen doğru bir kullanıcı IDsi girin.', 
          ephemeral: true 
        });
      }

      const interval = parseInt(intervalMinutes);
      if (isNaN(interval) || interval < 1 || interval > 1440) {
        return await interaction.reply({ 
          content: '❌ Geçersiz zaman aralığı! 1-1440 dakika arasında bir değer girin.', 
          ephemeral: true 
        });
      }

      const reminderId = `${interaction.guild.id}-${Date.now()}`;
      const reminder = {
        channelId,
        memberId,
        message,
        interval,
        name,
        createdBy: interaction.user.tag,
        createdAt: new Date(),
        nextRun: Date.now()
      };

      reminders.set(reminderId, reminder);

      await sendReminder(reminderId);

      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Hatırlatıcı Oluşturuldu!')
        .setColor(0x00FF00)
        .addFields(
          { name: 'İsim', value: name, inline: true },
          { name: 'Kanal', value: `<#${channelId}>`, inline: true },
          { name: 'Etiketlenecek', value: `<@${memberId}>`, inline: true },
          { name: 'Mesaj', value: message, inline: false },
          { name: 'Aralık', value: `${interval} dakika`, inline: true },
          { name: 'Oluşturan', value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [successEmbed], ephemeral: true });

    } catch (error) {
      console.error('Modal işleme hatası:', error);
      await interaction.reply({ 
        content: '❌ Hatırlatıcı oluşturulurken bir hata oluştu!', 
        ephemeral: true 
      });
    }
  }
}

async function sendReminder(reminderId) {
  const reminder = reminders.get(reminderId);
  if (!reminder) return;

  try {
    const channel = client.channels.cache.get(reminder.channelId);
    if (!channel) {
      reminders.delete(reminderId);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔔 ${reminder.name}`)
      .setDescription(reminder.message)
      .setColor(0xFFA500)
      .addFields(
        { name: 'Aralık', value: `${reminder.interval} dakika`, inline: true },
        { name: 'Oluşturan', value: reminder.createdBy, inline: true }
      )
      .setTimestamp();

    await channel.send({ 
      content: `<@${reminder.memberId}>`, 
      embeds: [embed] 
    });

    reminder.nextRun = Date.now() + (reminder.interval * 60 * 1000);
    reminders.set(reminderId, reminder);

  } catch (error) {
    console.error('Hatırlatıcı gönderme hatası:', error);
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
