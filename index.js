const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, SlashCommandBuilder, Routes, ActivityType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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

// Ekonomi Sistemi için Map
const userEconomy = new Map();

// Sunucu prefix'leri için Map (sunucuID -> prefix)
const serverPrefixes = new Map();

// Varsayılan prefix
const DEFAULT_PREFIX = 'vb';

// Sanal Borsa Sistemi
const virtualStocks = {
  "TechCorp": { price: 100, volatility: 0.1 },
  "GameStudio": { price: 80, volatility: 0.15 },
  "FoodChain": { price: 50, volatility: 0.2 },
  "MusicStream": { price: 120, volatility: 0.08 },
  "FashionHub": { price: 70, volatility: 0.12 }
};

// Meslekler
const jobs = {
  "💻 Developer": { min: 100, max: 300, cooldown: 300000 },
  "🎨 Designer": { min: 80, max: 250, cooldown: 240000 },
  "🚀 Streamer": { min: 150, max: 400, cooldown: 360000 },
  "🎮 Gamer": { min: 60, max: 200, cooldown: 180000 },
  "📱 Influencer": { min: 120, max: 350, cooldown: 300000 }
};

// Başarılar
const achievements = {
  "first_million": { name: "İlk Milyon", reward: 50000 },
  "daily_streak_7": { name: "Sadık Kullanıcı", reward: 10000 },
  "work_master": { name: "Çalışkan", reward: 15000 },
  "investment_king": { name: "Yatırım Ustası", reward: 20000 },
  "gamble_pro": { name: "Şanslı", reward: 10000 }
};

// Prefix almak için yardımcı fonksiyon
function getPrefix(guildId) {
  return serverPrefixes.get(guildId) || DEFAULT_PREFIX;
}

// Bot ready event
client.once('ready', () => {
  console.log(`🚀 ${client.user.tag} is now online!`);
  console.log(`📊 Serving ${client.guilds.cache.size} servers`);
  
  client.user.setPresence({
    activities: [{ name: 'FamqVerse Economy | /help', type: ActivityType.Playing }],
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
  }, 30000);

  // Borsa fiyatlarını güncelle (30 saniyede bir)
  setInterval(() => {
    updateStockPrices();
  }, 30000);
});

// Borsa fiyatlarını güncelleme fonksiyonu
function updateStockPrices() {
  for (const stock in virtualStocks) {
    const change = (Math.random() - 0.5) * 2 * virtualStocks[stock].volatility;
    virtualStocks[stock].price = Math.max(10, virtualStocks[stock].price * (1 + change));
    virtualStocks[stock].price = Math.round(virtualStocks[stock].price * 100) / 100;
  }
}

// Kullanıcı ekonomisi başlatma fonksiyonu
function initializeUserEconomy(userId) {
  if (!userEconomy.has(userId)) {
    userEconomy.set(userId, {
      balance: 1000,
      bank: 0,
      level: 1,
      xp: 0,
      job: null,
      lastWork: 0,
      dailyStreak: 0,
      lastDaily: 0,
      achievements: [],
      inventory: [],
      investments: {},
      currentBet: 0
    });
  }
  return userEconomy.get(userId);
}

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
    .setName('status')
    .setDescription('Botun durum istatistiklerini gösterir.'),

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

  new SlashCommandBuilder()
    .setName('reminder-remove')
    .setDescription('Mevcut bir hatırlatıcıyı kaldırır.'),

  // YENİ KOMUT: PREFIX
  new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('Ekonomi komutları prefixini değiştirir.'),

  // YÖNETİCİ KOMUTLARI
  new SlashCommandBuilder()
    .setName('add-coin')
    .setDescription('Belirtilen kullanıcıya coin ekler. (Sadece Bot Sahibi)')
    .addUserOption(option =>
      option.setName('kullanıcı')
        .setDescription('Coin eklemek istediğiniz kullanıcı')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('miktar')
        .setDescription('Eklenecek coin miktarı')
        .setRequired(true)
        .setMinValue(1)),

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
        const prefix = getPrefix(interaction.guild.id);
        
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
              name: `💰 **Ekonomi Sistemi (Prefix: ${prefix})**`,
              value: `• \`${prefix} daily\` - Günlük ödül\n• \`${prefix} work\` - Çalışarak para kazan\n• \`${prefix} profile\` - Ekonomi profili\n• \`${prefix} leaderboard\` - Zenginlik sıralaması\n• \`${prefix} invest\` - Sanal borsa\n• \`${prefix} gamble\` - Kumar oyunları\n• \`${prefix} pay <@kullanıcı> <miktar>\` - Başka kullanıcıya coin gönder`,
              inline: false
            },
            {
              name: '🎵 **Müzik**',
              value: '• *Yakında eklenecek!* 🎵\n*Müzik sistemi şu anda geliştirme aşamasındadır.*',
              inline: false
            },
            {
              name: '😄 **Eğlence**',
              value: '• `/avatar` - Avatar gösterir\n• `/serverinfo` - Sunucu bilgisi\n• `/userinfo` - Kullanıcı bilgisi\n• `/kaccm` - Kaç cm olduğunu söyler\n• `/say` - Bota mesaj söyletir\n• `/reminder` - Periyodik hatırlatıcı oluşturur\n• `/reminder-remove` - Hatırlatıcıyı kaldırır',
              inline: false
            },
            {
              name: '⚙️ **Ayarlar**',
              value: '• `/prefix` - Ekonomi komutları prefixini değiştirir',
              inline: false
            },
            {
              name: '🤖 **Bot**',
              value: '• `/ping` - Bot pingini gösterir\n• `/status` - Bot istatistiklerini gösterir\n• `/help` - Bu menüyü gösterir',
              inline: false
            },
            {
              name: '🔧 **Yönetici Komutları**',
              value: '• `/add-coin` - Coin ekleme (Sadece Bot Sahibi)',
              inline: false
            }
          )
          .setImage('https://media.discordapp.net/attachments/962353412480069652/1429871003936493579/standard_4.gif?ex=69101a65&is=690ec8e5&hm=820dcee8df2d4d512d8ceb533bfe7f788d86043d5e07d928e75792fd95505742&=')
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

      else if (commandName === 'status') {
        await handleStatusCommand(interaction);
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

      else if (commandName === 'reminder-remove') {
        await handleReminderRemoveCommand(interaction);
      }

      // YENİ KOMUT: PREFIX
      else if (commandName === 'prefix') {
        await handlePrefixCommand(interaction);
      }

      // YÖNETİCİ KOMUTLARI
      else if (commandName === 'add-coin') {
        await handleAddCoinCommand(interaction);
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
  } else if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'reminderRemoveSelect') {
      await handleReminderRemoveSelect(interaction);
    } else if (interaction.customId === 'jobSelect') {
      await handleJobSelect(interaction);
    } else if (interaction.customId === 'stockSelect') {
      await handleStockSelect(interaction);
    }
  } else if (interaction.isButton()) {
    if (interaction.customId === 'daily_claim') {
      await handleDailyClaim(interaction);
    } else if (interaction.customId.startsWith('gamble_')) {
      await handleGambleButton(interaction);
    }
  }
});

// MESAJ HANDLER - EKONOMİ KOMUTLARI
client.on('messageCreate', async (message) => {
  // Bot mesajlarını ignore et
  if (message.author.bot) return;
  
  // DM'leri ignore et
  if (!message.guild) return;

  const prefix = getPrefix(message.guild.id);
  
  // Prefix kontrolü - prefix ve boşluk ile başlamalı
  if (!message.content.startsWith(prefix + ' ')) return;

  const args = message.content.slice(prefix.length + 1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    // EKONOMİ KOMUTLARI
    if (command === 'daily') {
      await handleDailyMessage(message);
    }
    else if (command === 'work') {
      await handleWorkMessage(message);
    }
    else if (command === 'profile') {
      await handleProfileMessage(message, args);
    }
    else if (command === 'leaderboard' || command === 'lb') {
      await handleLeaderboardMessage(message);
    }
    else if (command === 'invest') {
      await handleInvestMessage(message);
    }
    else if (command === 'gamble') {
      await handleGambleMessage(message);
    }
    else if (command === 'pay') {
      await handlePayMessage(message, args);
    }
    else if (command === 'help') {
      await handleEconomyHelpMessage(message, prefix);
    }

  } catch (error) {
    console.error(`Ekonomi komutu hatası (${command}):`, error);
    message.reply('❌ Komut işlenirken bir hata oluştu!');
  }
});

// EKONOMİ MESAJ KOMUTLARI

async function handleDailyMessage(message) {
  const userData = initializeUserEconomy(message.author.id);
  const now = Date.now();
  const lastDaily = userData.lastDaily || 0;
  const cooldown = 24 * 60 * 60 * 1000; // 24 saat

  if (now - lastDaily < cooldown) {
    const nextDaily = lastDaily + cooldown;
    const timeLeft = nextDaily - now;
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    return message.reply({
      content: `❌ Günlük ödülünü zaten aldın! ${hours} saat ${minutes} dakika sonra tekrar alabilirsin.`
    });
  }

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('daily_claim')
        .setLabel('🎁 Ödülü Al!')
        .setStyle(ButtonStyle.Success)
    );

  const dailyEmbed = new EmbedBuilder()
    .setTitle('🎁 Günlük Ödül')
    .setDescription('Aşağıdaki butona tıklayarak günlük ödülünü alabilirsin!')
    .setColor(0xFFD700)
    .addFields(
      { name: '🎯 Mevcut Streak', value: `${userData.dailyStreak} gün`, inline: true },
      { name: '💰 Bonus', value: `+${userData.dailyStreak * 50} coin`, inline: true }
    )
    .setFooter({ text: 'Her gün ödül alarak streak\'ini artır!', iconURL: message.author.displayAvatarURL() });

  await message.reply({ embeds: [dailyEmbed], components: [row] });
}

async function handleWorkMessage(message) {
  const userData = initializeUserEconomy(message.author.id);
  const now = Date.now();

  if (!userData.job) {
    const selectMenu = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('jobSelect')
          .setPlaceholder('Bir meslek seçin...')
          .addOptions(
            Object.entries(jobs).map(([jobName, jobData]) => ({
              label: jobName,
              description: `Kazanç: ${jobData.min}-${jobData.max} coin`,
              value: jobName
            }))
          )
      );

    await message.reply({
      content: '**Çalışmak için bir meslek seç:**',
      components: [selectMenu]
    });
    return;
  }

  const job = jobs[userData.job];
  if (now - userData.lastWork < job.cooldown) {
    const timeLeft = job.cooldown - (now - userData.lastWork);
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);

    return message.reply({
      content: `❌ Şu anda çalışamazsın! ${minutes} dakika ${seconds} saniye sonra tekrar çalışabilirsin.`
    });
  }

  const earnings = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
  const xpGain = Math.floor(earnings / 10);

  userData.balance += earnings;
  userData.xp += xpGain;
  userData.lastWork = now;

  const neededXP = userData.level * 100;
  if (userData.xp >= neededXP) {
    userData.level += 1;
    userData.xp = 0;
    userData.balance += userData.level * 200;
  }

  const workEmbed = new EmbedBuilder()
    .setTitle('💼 Çalışma Tamamlandı!')
    .setColor(0x0099FF)
    .addFields(
      { name: '👨‍💼 Meslek', value: userData.job, inline: true },
      { name: '💰 Kazanç', value: `${earnings} coin`, inline: true },
      { name: '⭐ XP', value: `${xpGain} XP`, inline: true },
      { name: '🎯 Seviye', value: `${userData.level}`, inline: true },
      { name: '💳 Yeni Bakiye', value: `${userData.balance} coin`, inline: true },
      { name: '📊 XP İlerleme', value: `${userData.xp}/${userData.level * 100}`, inline: true }
    );

  if (userData.xp === 0) {
    workEmbed.addFields({
      name: '🎉 Seviye Atladın!',
      value: `**Seviye ${userData.level}** oldun! +${userData.level * 200} coin bonus!`
    });
  }

  await message.reply({ embeds: [workEmbed] });
}

async function handleProfileMessage(message, args) {
  let targetUser = message.author;
  
  // Eğer kullanıcı etiketlemişse
  if (args.length > 0) {
    const mention = args[0];
    const userId = mention.replace(/[<@!>]/g, '');
    
    try {
      targetUser = await message.client.users.fetch(userId);
    } catch (error) {
      // Eğer kullanıcı bulunamazsa, orijinal kullanıcıyı kullan
    }
  }

  const userData = initializeUserEconomy(targetUser.id);
  const netWorth = userData.balance + userData.bank;
  let rank = 1;
  
  const allUsers = Array.from(userEconomy.entries())
    .map(([id, data]) => ({ id, netWorth: data.balance + data.bank }))
    .sort((a, b) => b.netWorth - a.netWorth);
  
  rank = allUsers.findIndex(u => u.id === targetUser.id) + 1;

  const profileEmbed = new EmbedBuilder()
    .setTitle(`👤 ${targetUser.username} - Ekonomi Profili`)
    .setColor(0x00AE86)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '💳 Cüzdan', value: `${userData.balance} coin`, inline: true },
      { name: '🏦 Banka', value: `${userData.bank} coin`, inline: true },
      { name: '💰 Toplam', value: `${netWorth} coin`, inline: true },
      { name: '🎯 Seviye', value: `${userData.level}`, inline: true },
      { name: '⭐ XP', value: `${userData.xp}/${userData.level * 100}`, inline: true },
      { name: '🏆 Sıralama', value: `#${rank}`, inline: true },
      { name: '👨‍💼 Meslek', value: userData.job || 'İşsiz', inline: true },
      { name: '🔥 Daily Streak', value: `${userData.dailyStreak} gün`, inline: true },
      { name: '🏆 Başarılar', value: `${userData.achievements.length} adet`, inline: true }
    )
    .setFooter({ text: 'FamqVerse Ekonomi Sistemi', iconURL: message.client.user.displayAvatarURL() })
    .setTimestamp();

  await message.reply({ embeds: [profileEmbed] });
}

async function handleLeaderboardMessage(message) {
  const allUsers = Array.from(userEconomy.entries())
    .map(([id, data]) => ({ 
      id, 
      netWorth: data.balance + data.bank,
      level: data.level 
    }))
    .sort((a, b) => b.netWorth - a.netWorth)
    .slice(0, 10);

  let leaderboardText = '';
  for (let i = 0; i < allUsers.length; i++) {
    const user = allUsers[i];
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    const username = member ? member.user.username : 'Bilinmeyen Kullanıcı';
    
    leaderboardText += `**${i + 1}.** ${username} - ${user.netWorth} coin (Seviye ${user.level})\n`;
  }

  const leaderboardEmbed = new EmbedBuilder()
    .setTitle('🏆 Zenginlik Sıralaması')
    .setDescription(leaderboardText || 'Henüz kimse ekonomi sistemine katılmamış!')
    .setColor(0xFFD700)
    .setFooter({ text: 'FamqVerse Ekonomi Liderliği', iconURL: message.guild.iconURL() })
    .setTimestamp();

  await message.reply({ embeds: [leaderboardEmbed] });
}

async function handleInvestMessage(message) {
  const userData = initializeUserEconomy(message.author.id);
  
  const stockOptions = Object.entries(virtualStocks).map(([name, data]) => ({
    label: name,
    description: `Fiyat: ${data.price} coin | Değişim: %${(data.volatility * 100).toFixed(1)}`,
    value: name
  }));

  const selectMenu = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('stockSelect')
        .setPlaceholder('Yatırım yapmak için hisse seçin...')
        .addOptions(stockOptions)
    );

  const investEmbed = new EmbedBuilder()
    .setTitle('📈 Sanal Borsa')
    .setDescription('Aşağıdan yatırım yapmak istediğiniz hisseyi seçin:')
    .setColor(0x0099FF)
    .addFields(
      { name: '💳 Mevcut Bakiye', value: `${userData.balance} coin`, inline: true },
      { name: '🏦 Toplam Yatırım', value: `${Object.values(userData.investments).reduce((sum, inv) => sum + (inv.shares * inv.buyPrice), 0)} coin`, inline: true }
    )
    .setFooter({ text: 'Hisse fiyatları gerçek zamanlı olarak değişmektedir', iconURL: message.author.displayAvatarURL() });

  await message.reply({ embeds: [investEmbed], components: [selectMenu] });
}

async function handleGambleMessage(message) {
  const modal = new ModalBuilder()
    .setCustomId('gambleModal')
    .setTitle('Kumar Oyunu - Bahis Miktarı');

  const betInput = new TextInputBuilder()
    .setCustomId('betAmount')
    .setLabel("Bahis Miktarı (coin)")
    .setPlaceholder("100")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(10);

  const actionRow = new ActionRowBuilder().addComponents(betInput);
  modal.addComponents(actionRow);

  await message.showModal(modal);
}

async function handlePayMessage(message, args) {
  if (args.length < 2) {
    return message.reply({
      content: '❌ Kullanım: `pay <@kullanıcı> <miktar>`'
    });
  }

  const mention = args[0];
  const amount = parseInt(args[1]);

  if (isNaN(amount) || amount < 1) {
    return message.reply({
      content: '❌ Geçersiz miktar! Lütfen pozitif bir sayı girin.'
    });
  }

  const targetUserId = mention.replace(/[<@!>]/g, '');
  let targetUser;

  try {
    targetUser = await message.client.users.fetch(targetUserId);
  } catch (error) {
    return message.reply({
      content: '❌ Geçersiz kullanıcı!'
    });
  }

  // Kendine para gönderemez
  if (targetUser.id === message.author.id) {
    return message.reply({
      content: '❌ Kendine coin gönderemezsin!'
    });
  }

  const userData = initializeUserEconomy(message.author.id);
  const targetData = initializeUserEconomy(targetUser.id);

  // Yeterli bakiye kontrolü
  if (userData.balance < amount) {
    return message.reply({
      content: `❌ Yeterli bakiyen yok! ${amount} coin göndermek istiyorsun, bakiyen: ${userData.balance} coin`
    });
  }

  // Para transferi
  userData.balance -= amount;
  targetData.balance += amount;

  const payEmbed = new EmbedBuilder()
    .setTitle('💸 Coin Transferi')
    .setColor(0x00FF00)
    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '👤 Gönderen', value: `${message.author.tag}`, inline: true },
      { name: '👥 Alıcı', value: `${targetUser.tag}`, inline: true },
      { name: '💰 Miktar', value: `${amount.toLocaleString()} coin`, inline: true },
      { name: '💳 Gönderen Yeni Bakiye', value: `${userData.balance.toLocaleString()} coin`, inline: true },
      { name: '🏦 Alıcı Yeni Bakiye', value: `${targetData.balance.toLocaleString()} coin`, inline: true }
    )
    .setFooter({ text: 'FamqVerse Transfer Sistemi', iconURL: message.client.user.displayAvatarURL() })
    .setTimestamp();

  await message.reply({ embeds: [payEmbed] });
}

async function handleEconomyHelpMessage(message, prefix) {
  const helpEmbed = new EmbedBuilder()
    .setTitle(`💰 FamqVerse Ekonomi Sistemi - Prefix: ${prefix}`)
    .setColor(0x00AE86)
    .setDescription(`Tüm ekonomi komutları **${prefix}** prefixi ile kullanılır!\nÖrnek: **${prefix} daily**`)
    .addFields(
      { name: `${prefix} daily`, value: 'Günlük ödülünü al', inline: true },
      { name: `${prefix} work`, value: 'Çalışarak para kazan', inline: true },
      { name: `${prefix} profile [@kullanıcı]`, value: 'Ekonomi profilini göster', inline: true },
      { name: `${prefix} leaderboard`, value: 'Zenginlik sıralaması', inline: true },
      { name: `${prefix} invest`, value: 'Sanal borsada yatırım yap', inline: true },
      { name: `${prefix} gamble`, value: 'Kumar oyunları oyna', inline: true },
      { name: `${prefix} pay @kullanıcı <miktar>`, value: 'Başka kullanıcıya coin gönder', inline: true }
    )
    .setFooter({ text: 'Diğer komutlar için /help kullanın', iconURL: message.client.user.displayAvatarURL() })
    .setTimestamp();

  await message.reply({ embeds: [helpEmbed] });
}

// YENİ PREFIX KOMUTU
async function handlePrefixCommand(interaction) {
  if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
    return await interaction.reply({
      content: '❌ Bu komutu kullanmak için **Sunucuyu Yönet** yetkisine sahip olmalısınız!',
      ephemeral: true
    });
  }

  const currentPrefix = getPrefix(interaction.guild.id);

  const modal = new ModalBuilder()
    .setCustomId('prefixModal')
    .setTitle('Prefix Değiştir');

  const prefixInput = new TextInputBuilder()
    .setCustomId('newPrefix')
    .setLabel(`Şuanki prefix: "${currentPrefix}" - Yeni prefix:`)
    .setPlaceholder('Yeni prefixi girin...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(5);

  const actionRow = new ActionRowBuilder().addComponents(prefixInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

// PREFIX MODAL İŞLEYİCİSİ
async function handlePrefixModal(interaction) {
  try {
    const newPrefix = interaction.fields.getTextInputValue('newPrefix');
    const oldPrefix = getPrefix(interaction.guild.id);

    // Prefix'i kaydet
    serverPrefixes.set(interaction.guild.id, newPrefix);

    const successEmbed = new EmbedBuilder()
      .setTitle('✅ Prefix Başarıyla Değiştirildi!')
      .setColor(0x00FF00)
      .setDescription(`Ekonomi komutları artık **"${newPrefix}"** prefixi ile kullanılacak!\n\n**Örnek kullanım:**\n\`${newPrefix} daily\` - Günlük ödül al\n\`${newPrefix} work\` - Çalışarak para kazan\n\`${newPrefix} profile\` - Profilini görüntüle`)
      .addFields(
        { name: '📝 Eski Prefix', value: `\`${oldPrefix}\``, inline: true },
        { name: '🆕 Yeni Prefix', value: `\`${newPrefix}\``, inline: true },
        { name: '👤 Değiştiren', value: interaction.user.tag, inline: true }
      )
      .setFooter({ text: 'Ekonomi komutları artık prefix + boşluk + komut şeklinde kullanılır', iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed] });

  } catch (error) {
    console.error('Prefix modal hatası:', error);
    await interaction.reply({
      content: '❌ Prefix değiştirilirken bir hata oluştu!',
      ephemeral: true
    });
  }
}

// DİĞER FONKSİYONLAR (Aynı kalacak, sadece modal handler'a prefix modalını ekleyeceğiz)

// GÜNCELLENMİŞ MODAL SUBMIT İŞLEYİCİSİ
async function handleModalSubmit(interaction) {
  if (interaction.customId === 'reminderModal') {
    // ... mevcut reminder modal kodu
  } else if (interaction.customId === 'gambleModal') {
    await handleGambleModal(interaction);
  } else if (interaction.customId.startsWith('investModal_')) {
    const stockName = interaction.customId.replace('investModal_', '');
    await handleInvestModal(interaction, stockName);
  } else if (interaction.customId === 'prefixModal') {
    await handlePrefixModal(interaction);
  }
}

// STATUS KOMUTU (güncellenmiş)
async function handleStatusCommand(interaction) {
  try {
    const serverCount = client.guilds.cache.size;
    
    let totalMembers = 0;
    client.guilds.cache.forEach(guild => {
      totalMembers += guild.memberCount;
    });

    const uptime = process.uptime();
    const days = Math.floor(uptime / (24 * 60 * 60));
    const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((uptime % (60 * 60)) / 60);
    const seconds = Math.floor(uptime % 60);

    const uptimeString = `${days}g ${hours}s ${minutes}d ${seconds}sn`;

    const usedMemory = process.memoryUsage().rss / 1024 / 1024;
    const totalMemory = require('os').totalmem() / 1024 / 1024;

    // Ekonomi istatistikleri
    const economyUsers = userEconomy.size;
    const totalEconomyBalance = Array.from(userEconomy.values()).reduce((sum, user) => sum + user.balance, 0);

    // Prefix istatistikleri
    const customPrefixCount = Array.from(serverPrefixes.values()).length;

    const statusEmbed = new EmbedBuilder()
      .setTitle(`🤖 ${client.user.username} Durumu`)
      .setColor(0x00AE86)
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        {
          name: '📊 **Sunucu İstatistikleri**',
          value: `┣ Sunucu Sayısı: **${serverCount}**\n┗ Toplam Kullanıcı: **${totalMembers.toLocaleString()}**`,
          inline: false
        },
        {
          name: '💰 **Ekonomi Sistemi**',
          value: `┣ Aktif Kullanıcı: **${economyUsers}**\n┗ Toplam Para: **${totalEconomyBalance.toLocaleString()} coin**\n┗ Özel Prefix: **${customPrefixCount} sunucu**`,
          inline: false
        },
        {
          name: '⚡ **Performans**',
          value: `┣ Ping: **${client.ws.ping}ms**\n┗ Bellek Kullanımı: **${usedMemory.toFixed(2)}MB / ${totalMemory.toFixed(2)}MB**`,
          inline: false
        },
        {
          name: '🕒 **Sistem**',
          value: `┣ Çalışma Süresi: **${uptimeString}**\n┗ Node.js: **${process.version}**\n┗ Discord.js: **${require('discord.js').version}**`,
          inline: false
        }
      )
      .setFooter({ 
        text: `VossBlade Famq Bot | ${new Date().toLocaleDateString('tr-TR')}`, 
        iconURL: client.user.displayAvatarURL() 
      })
      .setTimestamp();

    await interaction.reply({ embeds: [statusEmbed] });

  } catch (error) {
    console.error('Status komutu hatası:', error);
    await interaction.reply({
      content: '❌ Durum bilgileri alınırken bir hata oluştu!',
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
