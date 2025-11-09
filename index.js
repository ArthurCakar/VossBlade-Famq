const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, SlashCommandBuilder, Routes, ActivityType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, REST } = require('discord.js');
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

// Data storage
const reminders = new Map();
const userEconomy = new Map();
const userRegistrations = new Map();

// Virtual Stocks
const virtualStocks = {
  "TechCorp": { price: 100, volatility: 0.1 },
  "GameStudio": { price: 80, volatility: 0.15 },
  "FoodChain": { price: 50, volatility: 0.2 },
  "MusicStream": { price: 120, volatility: 0.08 },
  "FashionHub": { price: 70, volatility: 0.12 }
};

// Jobs
const jobs = {
  "💻 Developer": { min: 100, max: 300, cooldown: 300000 },
  "🎨 Designer": { min: 80, max: 250, cooldown: 240000 },
  "🚀 Streamer": { min: 150, max: 400, cooldown: 360000 },
  "🎮 Gamer": { min: 60, max: 200, cooldown: 180000 },
  "📱 Influencer": { min: 120, max: 350, cooldown: 300000 }
};

// Achievements
const achievements = {
  "first_million": { name: "İlk Milyon", reward: 50000 },
  "daily_streak_7": { name: "Sadık Kullanıcı", reward: 10000 },
  "work_master": { name: "Çalışkan", reward: 15000 },
  "investment_king": { name: "Yatırım Ustası", reward: 20000 },
  "gamble_pro": { name: "Şanslı", reward: 10000 }
};

// Initialize user economy
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

// Initialize user registration
function initializeUserRegistration(userId) {
  if (!userRegistrations.has(userId)) {
    userRegistrations.set(userId, {
      registered: false,
      name: '',
      age: 0,
      gender: '',
      city: '',
      about: '',
      registerDate: null,
      favoriteGame: '',
      discordSince: ''
    });
  }
  return userRegistrations.get(userId);
}

// Health bar function
function createHealthBar(currentHP, maxHP) {
  const percentage = currentHP / maxHP;
  const filledBars = Math.round(percentage * 10);
  const emptyBars = 10 - filledBars;
  
  let healthBar = '';
  for (let i = 0; i < filledBars; i++) healthBar += '█';
  for (let i = 0; i < emptyBars; i++) healthBar += '░';
  
  return `${healthBar} ${currentHP}/${maxHP} HP`;
}

// Update stock prices
function updateStockPrices() {
  for (const stock in virtualStocks) {
    const change = (Math.random() - 0.5) * 2 * virtualStocks[stock].volatility;
    virtualStocks[stock].price = Math.max(10, virtualStocks[stock].price * (1 + change));
    virtualStocks[stock].price = Math.round(virtualStocks[stock].price * 100) / 100;
  }
}

// Slash Commands
const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Tüm bot komutlarını gösterir.'),
  new SlashCommandBuilder().setName('clear').setDescription('Belirtilen sayıda mesajı siler.')
    .addIntegerOption(option => option.setName('miktar').setDescription('Silinecek mesaj sayısı (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName('ban').setDescription('Kullanıcıyı sunucudan banlar.')
    .addUserOption(option => option.setName('kullanıcı').setDescription('Banlanacak kullanıcı').setRequired(true))
    .addStringOption(option => option.setName('sebep').setDescription('Ban sebebi').setRequired(false)),
  new SlashCommandBuilder().setName('ping').setDescription('Botun ping değerini gösterir.'),
  new SlashCommandBuilder().setName('status').setDescription('Botun durum istatistiklerini gösterir.'),
  new SlashCommandBuilder().setName('kaccm').setDescription('Kullanıcının kaç cm olduğunu söyler.')
    .addUserOption(option => option.setName('kullanıcı').setDescription('Kaç cm olduğunu öğrenmek istediğiniz kullanıcı').setRequired(false)),
  new SlashCommandBuilder().setName('avatar').setDescription('Kullanıcının avatarını gösterir.')
    .addUserOption(option => option.setName('kullanıcı').setDescription('Avatarını görmek istediğiniz kullanıcı').setRequired(false)),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Sunucu bilgilerini gösterir.'),
  new SlashCommandBuilder().setName('userinfo').setDescription('Kullanıcı bilgilerini gösterir.')
    .addUserOption(option => option.setName('kullanıcı').setDescription('Bilgilerini görmek istediğiniz kullanıcı').setRequired(false)),
  new SlashCommandBuilder().setName('say').setDescription('Bota bir şey söyletir.')
    .addStringOption(option => option.setName('mesaj').setDescription('Botun söyleyeceği mesaj').setRequired(true)),
  new SlashCommandBuilder().setName('reminder').setDescription('Periyodik hatırlatıcı oluşturur.'),
  new SlashCommandBuilder().setName('reminder-remove').setDescription('Mevcut bir hatırlatıcıyı kaldırır.'),
  new SlashCommandBuilder().setName('daily').setDescription('Günlük ödülünü al.'),
  new SlashCommandBuilder().setName('work').setDescription('Çalışarak para kazan.'),
  new SlashCommandBuilder().setName('profile').setDescription('Ekonomi profilini göster.')
    .addUserOption(option => option.setName('kullanıcı').setDescription('Profilini görmek istediğiniz kullanıcı').setRequired(false)),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Zenginlik sıralamasını göster.'),
  new SlashCommandBuilder().setName('invest').setDescription('Sanal borsada yatırım yap.'),
  new SlashCommandBuilder().setName('gamble').setDescription('Kumar oyunları oyna.'),
  new SlashCommandBuilder().setName('add-coin').setDescription('Belirtilen kullanıcıya coin ekler. (Sadece Bot Sahibi)')
    .addUserOption(option => option.setName('kullanıcı').setDescription('Coin eklemek istediğiniz kullanıcı').setRequired(true))
    .addIntegerOption(option => option.setName('miktar').setDescription('Eklenecek coin miktarı').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('remove-coin').setDescription('Belirtilen kullanıcıdan coin çıkarır. (Sadece Bot Sahibi)')
    .addUserOption(option => option.setName('kullanıcı').setDescription('Coin çıkarmak istediğiniz kullanıcı').setRequired(true))
    .addIntegerOption(option => option.setName('miktar').setDescription('Çıkarılacak coin miktarı').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('pay').setDescription('Başka bir kullanıcıya coin gönder.')
    .addUserOption(option => option.setName('kullanıcı').setDescription('Coin göndermek istediğiniz kullanıcı').setRequired(true))
    .addIntegerOption(option => option.setName('miktar').setDescription('Göndermek istediğiniz coin miktarı').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('vs').setDescription('Başka bir kullanıcıyla coin üzerine düello yap!')
    .addUserOption(option => option.setName('rakip').setDescription('Düello yapmak istediğiniz kullanıcı').setRequired(true))
    .addIntegerOption(option => option.setName('bahis').setDescription('Bahis miktarı').setRequired(true).setMinValue(10)),
  new SlashCommandBuilder().setName('kayit').setDescription('Kayıt olarak ailemize katıl!'),
  new SlashCommandBuilder().setName('kayit-bilgi').setDescription('Kayıt bilgilerini görüntüle.')
    .addUserOption(option => option.setName('kullanıcı').setDescription('Kayıt bilgilerini görmek istediğiniz kullanıcı').setRequired(false)),
  new SlashCommandBuilder().setName('kayit-sil').setDescription('Kullanıcının kaydını sil. (Yetkili)')
    .addUserOption(option => option.setName('kullanıcı').setDescription('Kaydını silmek istediğiniz kullanıcı').setRequired(true)),
  new SlashCommandBuilder().setName('kayit-listesi').setDescription('Kayıtlı kullanıcıları görüntüle. (Yetkili)'),
  new SlashCommandBuilder().setName('kayit-say').setDescription('Kayıt istatistiklerini göster.'),
].map(command => command.toJSON());

// Bot ready event
client.once('ready', async () => {
  console.log(`🚀 ${client.user.tag} is now online!`);
  console.log(`📊 Serving ${client.guilds.cache.size} servers`);
  console.log(`📝 Kayıtlı kullanıcı: ${userRegistrations.size} users`);
  
  client.user.setPresence({
    activities: [{ name: 'FamqVerse Economy & Register | /help', type: ActivityType.Playing }],
    status: 'online'
  });

  // Register slash commands
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    console.log('🔄 Slash komutları yükleniyor...');
    
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    
    console.log('✅ Slash komutları başarıyla yüklendi!');
  } catch (error) {
    console.error('❌ Slash komut yükleme hatası:', error);
  }

  // Start intervals
  setInterval(() => {
    const now = Date.now();
    reminders.forEach((reminder, reminderId) => {
      if (now >= reminder.nextRun) {
        sendReminder(reminderId);
      }
    });
  }, 30000);

  setInterval(() => {
    updateStockPrices();
  }, 30000);
});

// Command handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options, user, guild, channel } = interaction;

  try {
    switch (commandName) {
      case 'help':
        await handleHelpCommand(interaction);
        break;
      case 'clear':
        await handleClearCommand(interaction);
        break;
      case 'ban':
        await handleBanCommand(interaction);
        break;
      case 'ping':
        await handlePingCommand(interaction);
        break;
      case 'status':
        await handleStatusCommand(interaction);
        break;
      case 'kaccm':
        await handleKaccmCommand(interaction);
        break;
      case 'avatar':
        await handleAvatarCommand(interaction);
        break;
      case 'serverinfo':
        await handleServerInfoCommand(interaction);
        break;
      case 'userinfo':
        await handleUserInfoCommand(interaction);
        break;
      case 'say':
        await handleSayCommand(interaction);
        break;
      case 'reminder':
        await handleReminderCommand(interaction);
        break;
      case 'reminder-remove':
        await handleReminderRemoveCommand(interaction);
        break;
      case 'daily':
        await handleDailyCommand(interaction);
        break;
      case 'work':
        await handleWorkCommand(interaction);
        break;
      case 'profile':
        await handleProfileCommand(interaction);
        break;
      case 'leaderboard':
        await handleLeaderboardCommand(interaction);
        break;
      case 'invest':
        await handleInvestCommand(interaction);
        break;
      case 'gamble':
        await handleGambleCommand(interaction);
        break;
      case 'add-coin':
        await handleAddCoinCommand(interaction);
        break;
      case 'remove-coin':
        await handleRemoveCoinCommand(interaction);
        break;
      case 'pay':
        await handlePayCommand(interaction);
        break;
      case 'vs':
        await handleVsCommand(interaction);
        break;
      case 'kayit':
        await handleKayitCommand(interaction);
        break;
      case 'kayit-bilgi':
        await handleKayitBilgiCommand(interaction);
        break;
      case 'kayit-sil':
        await handleKayitSilCommand(interaction);
        break;
      case 'kayit-listesi':
        await handleKayitListesiCommand(interaction);
        break;
      case 'kayit-say':
        await handleKayitSayCommand(interaction);
        break;
      default:
        await interaction.reply({ content: '❌ Bilinmeyen komut!', ephemeral: true });
    }
  } catch (error) {
    console.error(`Command error (${commandName}):`, error);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ Komut işlenirken bir hata oluştu!', ephemeral: true });
    }
  }
});

// Modal submit handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  try {
    if (interaction.customId === 'reminderModal') {
      await handleReminderModal(interaction);
    } else if (interaction.customId === 'gambleModal') {
      await handleGambleModal(interaction);
    } else if (interaction.customId.startsWith('investModal_')) {
      const stockName = interaction.customId.replace('investModal_', '');
      await handleInvestModal(interaction, stockName);
    } else if (interaction.customId === 'kayitModal') {
      await handleKayitModal(interaction);
    }
  } catch (error) {
    console.error('Modal submit error:', error);
    await interaction.reply({ content: '❌ Modal işlenirken bir hata oluştu!', ephemeral: true });
  }
});

// Button interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  try {
    if (interaction.customId === 'daily_claim') {
      await handleDailyClaim(interaction);
    } else if (interaction.customId.startsWith('gamble_')) {
      await handleGambleButton(interaction);
    } else if (interaction.customId.startsWith('vs_')) {
      await handleVsButton(interaction);
    } else if (interaction.customId.startsWith('pay_')) {
      await handlePayButton(interaction);
    }
  } catch (error) {
    console.error('Button interaction error:', error);
    await interaction.reply({ content: '❌ Buton işlenirken bir hata oluştu!', ephemeral: true });
  }
});

// Select menu interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  try {
    if (interaction.customId === 'reminderRemoveSelect') {
      await handleReminderRemoveSelect(interaction);
    } else if (interaction.customId === 'jobSelect') {
      await handleJobSelect(interaction);
    } else if (interaction.customId === 'stockSelect') {
      await handleStockSelect(interaction);
    }
  } catch (error) {
    console.error('Select menu error:', error);
    await interaction.reply({ content: '❌ Menü işlenirken bir hata oluştu!', ephemeral: true });
  }
});

// Basic command implementations (kısa versiyonlar)
async function handleHelpCommand(interaction) {
  const helpEmbed = new EmbedBuilder()
    .setTitle('🎮 VossBlade Famq Bot Komutları')
    .setDescription('Aşağıda tüm bot komutlarını bulabilirsiniz:')
    .setColor(0x00AE86)
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      { name: '🛡️ **Moderasyon**', value: '• `/clear` - Mesajları temizler\n• `/ban` - Kullanıcıyı banlar', inline: false },
      { name: '💰 **Ekonomi Sistemi**', value: '• `/daily` - Günlük ödül\n• `/work` - Çalışarak para kazan\n• `/profile` - Ekonomi profili\n• `/leaderboard` - Zenginlik sıralaması', inline: false },
      { name: '📝 **Kayıt Sistemi**', value: '• `/kayit` - Kayıt ol\n• `/kayit-bilgi` - Kayıt bilgilerini görüntüle\n• `/kayit-sil` - Kayıt sil (Yetkili)', inline: false },
      { name: '😄 **Eğlence**', value: '• `/avatar` - Avatar gösterir\n• `/serverinfo` - Sunucu bilgisi\n• `/userinfo` - Kullanıcı bilgisi\n• `/kaccm` - Kaç cm olduğunu söyler', inline: false }
    )
    .setFooter({ text: `VossBlade Famq Bot | Toplam ${client.guilds.cache.size} sunucu`, iconURL: client.user.displayAvatarURL() });

  await interaction.reply({ embeds: [helpEmbed] });
}

async function handleClearCommand(interaction) {
  if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return await interaction.reply({ content: '❌ Bu komutu kullanmak için **Mesajları Yönet** yetkisine sahip olmalısınız!', ephemeral: true });
  }

  const amount = interaction.options.getInteger('miktar');
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const messages = await interaction.channel.bulkDelete(amount, true);
    await interaction.editReply({ content: `✅ **${messages.size}** mesaj başarıyla silindi!` });
  } catch (error) {
    await interaction.editReply({ content: '❌ Mesajlar silinirken bir hata oluştu! (14 günden eski mesajlar silinemez)' });
  }
}

async function handlePingCommand(interaction) {
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

async function handleStatusCommand(interaction) {
  const serverCount = client.guilds.cache.size;
  let totalMembers = 0;
  client.guilds.cache.forEach(guild => { totalMembers += guild.memberCount; });

  const uptime = process.uptime();
  const days = Math.floor(uptime / (24 * 60 * 60));
  const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((uptime % (60 * 60)) / 60);
  const seconds = Math.floor(uptime % 60);
  const uptimeString = `${days}g ${hours}s ${minutes}d ${seconds}sn`;

  const statusEmbed = new EmbedBuilder()
    .setTitle(`🤖 ${client.user.username} Durumu`)
    .setColor(0x00AE86)
    .addFields(
      { name: '📊 Sunucu Sayısı', value: `**${serverCount}**`, inline: true },
      { name: '👥 Toplam Kullanıcı', value: `**${totalMembers.toLocaleString()}**`, inline: true },
      { name: '⚡ Ping', value: `**${client.ws.ping}ms**`, inline: true },
      { name: '🕒 Çalışma Süresi', value: `**${uptimeString}**`, inline: false }
    );

  await interaction.reply({ embeds: [statusEmbed] });
}

// KAYIT SİSTEMİ FONKSİYONLARI
async function handleKayitCommand(interaction) {
  const userData = initializeUserRegistration(interaction.user.id);
  
  if (userData.registered) {
    return await interaction.reply({ content: '❌ Zaten kayıtlısın!', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId('kayitModal')
    .setTitle('🎪 VossBlade Ailesine Hoş Geldin!');

  const isimInput = new TextInputBuilder()
    .setCustomId('isimInput')
    .setLabel('👤 İsim ve Yaşınız')
    .setPlaceholder('Örnek: Ahmet 18')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const cinsiyetInput = new TextInputBuilder()
    .setCustomId('cinsiyetInput')
    .setLabel('🚻 Cinsiyetiniz')
    .setPlaceholder('Erkek / Kadın')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const sehirInput = new TextInputBuilder()
    .setCustomId('sehirInput')
    .setLabel('🏙️ Yaşadığınız Şehir')
    .setPlaceholder('İstanbul')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(isimInput),
    new ActionRowBuilder().addComponents(cinsiyetInput),
    new ActionRowBuilder().addComponents(sehirInput)
  );

  await interaction.showModal(modal);
}

async function handleKayitModal(interaction) {
  try {
    const name = interaction.fields.getTextInputValue('isimInput');
    const gender = interaction.fields.getTextInputValue('cinsiyetInput');
    const city = interaction.fields.getTextInputValue('sehirInput');

    const userData = initializeUserRegistration(interaction.user.id);
    userData.registered = true;
    userData.name = name;
    userData.gender = gender;
    userData.city = city;
    userData.registerDate = new Date();

    // Kayıt bonusu
    const economyData = initializeUserEconomy(interaction.user.id);
    economyData.balance += 1000;

    const successEmbed = new EmbedBuilder()
      .setTitle('🎉 Kayıt Başarılı!')
      .setColor(0x00FF00)
      .setDescription(`${interaction.user}, **VossBlade** ailesine hoş geldin! 🎊`)
      .addFields(
        { name: '👤 İsim ve Yaş', value: name, inline: true },
        { name: '🚻 Cinsiyet', value: gender, inline: true },
        { name: '🏙️ Şehir', value: city, inline: true },
        { name: '💰 Hoş Geldin Bonusu', value: '1.000 coin 🎁', inline: true }
      )
      .setFooter({ text: `VossBlade Ailesi • ${interaction.guild.name}` });

    await interaction.reply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Kayıt hatası:', error);
    await interaction.reply({ content: '❌ Kayıt işlemi sırasında bir hata oluştu!', ephemeral: true });
  }
}

async function handleKayitBilgiCommand(interaction) {
  const targetUser = interaction.options.getUser('kullanıcı') || interaction.user;
  const registration = userRegistrations.get(targetUser.id);

  if (!registration || !registration.registered) {
    return await interaction.reply({ content: '❌ Bu kullanıcı kayıtlı değil!', ephemeral: true });
  }

  const kayitEmbed = new EmbedBuilder()
    .setTitle(`📝 ${targetUser.username} - Kayıt Bilgileri`)
    .setColor(0x5865F2)
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      { name: '👤 İsim ve Yaş', value: registration.name, inline: true },
      { name: '🚻 Cinsiyet', value: registration.gender, inline: true },
      { name: '🏙️ Şehir', value: registration.city, inline: true },
      { name: '📅 Kayıt Tarihi', value: `<t:${Math.floor(registration.registerDate.getTime() / 1000)}:R>`, inline: true }
    );

  await interaction.reply({ embeds: [kayitEmbed] });
}

// Diğer basit komut implementasyonları
async function handleKaccmCommand(interaction) {
  const targetUser = interaction.options.getUser('kullanıcı') || interaction.user;
  const randomCm = Math.floor(Math.random() * 50) + 1;

  const cmEmbed = new EmbedBuilder()
    .setTitle(`🧐 ${targetUser.username} Kaç CM?`)
    .setDescription(`**${randomCm} CM**\n\nVay canına! 😲`)
    .setColor(0xFF69B4)
    .setThumbnail(targetUser.displayAvatarURL());

  await interaction.reply({ embeds: [cmEmbed] });
}

async function handleAvatarCommand(interaction) {
  const targetUser = interaction.options.getUser('kullanıcı') || interaction.user;
  const avatarEmbed = new EmbedBuilder()
    .setTitle(`📷 ${targetUser.username} Avatarı`)
    .setColor(0x00AE86)
    .setImage(targetUser.displayAvatarURL({ size: 4096 }));
  await interaction.reply({ embeds: [avatarEmbed] });
}

async function handleServerInfoCommand(interaction) {
  const owner = await interaction.guild.fetchOwner();
  const serverEmbed = new EmbedBuilder()
    .setTitle(`📊 ${interaction.guild.name} Sunucu Bilgileri`)
    .setThumbnail(interaction.guild.iconURL())
    .setColor(0x0099FF)
    .addFields(
      { name: '👑 Sunucu Sahibi', value: `${owner.user.tag}`, inline: true },
      { name: '👥 Üye Sayısı', value: `**${interaction.guild.memberCount}** üye`, inline: true }
    );
  await interaction.reply({ embeds: [serverEmbed] });
}

// Eksik fonksiyonları basit implementasyonlarla tamamlıyoruz
async function handleBanCommand(interaction) {
  await interaction.reply({ content: 'Ban komutu yakında eklenecek!', ephemeral: true });
}

async function handleUserInfoCommand(interaction) {
  const targetUser = interaction.options.getUser('kullanıcı') || interaction.user;
  const userEmbed = new EmbedBuilder()
    .setTitle(`👤 ${targetUser.tag} Kullanıcı Bilgileri`)
    .setThumbnail(targetUser.displayAvatarURL())
    .setColor(0x00AE86)
    .addFields(
      { name: '🆔 Kullanıcı ID', value: targetUser.id, inline: true },
      { name: '📅 Hesap Oluşturma', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true }
    );
  await interaction.reply({ embeds: [userEmbed] });
}

async function handleSayCommand(interaction) {
  if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return await interaction.reply({ content: '❌ Bu komutu kullanmak için **Mesajları Yönet** yetkisine sahip olmalısınız!', ephemeral: true });
  }
  const message = interaction.options.getString('mesaj');
  await interaction.reply({ content: '✅ Mesaj gönderildi!', ephemeral: true });
  await interaction.channel.send(message);
}

async function handleReminderCommand(interaction) {
  await interaction.reply({ content: 'Hatırlatıcı sistemi yakında eklenecek!', ephemeral: true });
}

async function handleReminderRemoveCommand(interaction) {
  await interaction.reply({ content: 'Hatırlatıcı sistemi yakında eklenecek!', ephemeral: true });
}

// Ekonomi komutları
async function handleDailyCommand(interaction) {
  const userData = initializeUserEconomy(interaction.user.id);
  userData.balance += 500;
  userData.dailyStreak += 1;
  
  const dailyEmbed = new EmbedBuilder()
    .setTitle('🎁 Günlük Ödül Alındı!')
    .setColor(0x00FF00)
    .setDescription(`**500 coin** kazandın! 🎉\n**Streak:** ${userData.dailyStreak} gün\n**Yeni bakiye:** ${userData.balance} coin`);
  
  await interaction.reply({ embeds: [dailyEmbed] });
}

async function handleWorkCommand(interaction) {
  const userData = initializeUserEconomy(interaction.user.id);
  const earnings = Math.floor(Math.random() * 200) + 100;
  userData.balance += earnings;
  
  const workEmbed = new EmbedBuilder()
    .setTitle('💼 Çalışma Tamamlandı!')
    .setColor(0x0099FF)
    .setDescription(`**${earnings} coin** kazandın! 💰\n**Yeni bakiye:** ${userData.balance} coin`);
  
  await interaction.reply({ embeds: [workEmbed] });
}

async function handleProfileCommand(interaction) {
  const targetUser = interaction.options.getUser('kullanıcı') || interaction.user;
  const userData = initializeUserEconomy(targetUser.id);
  
  const profileEmbed = new EmbedBuilder()
    .setTitle(`👤 ${targetUser.username} - Ekonomi Profili`)
    .setColor(0x00AE86)
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      { name: '💳 Cüzdan', value: `${userData.balance.toLocaleString()} coin`, inline: true },
      { name: '🎯 Seviye', value: `${userData.level}`, inline: true },
      { name: '🔥 Daily Streak', value: `${userData.dailyStreak} gün`, inline: true }
    );
  
  await interaction.reply({ embeds: [profileEmbed] });
}

// Diğer komutlar için basit implementasyonlar
async function handleLeaderboardCommand(interaction) {
  await interaction.reply({ content: 'Leaderboard yakında eklenecek!', ephemeral: true });
}

async function handleInvestCommand(interaction) {
  await interaction.reply({ content: 'Yatırım sistemi yakında eklenecek!', ephemeral: true });
}

async function handleGambleCommand(interaction) {
  await interaction.reply({ content: 'Kumar sistemi yakında eklenecek!', ephemeral: true });
}

async function handleAddCoinCommand(interaction) {
  await interaction.reply({ content: 'Bu komutu sadece bot sahibi kullanabilir!', ephemeral: true });
}

async function handleRemoveCoinCommand(interaction) {
  await interaction.reply({ content: 'Bu komutu sadece bot sahibi kullanabilir!', ephemeral: true });
}

async function handlePayCommand(interaction) {
  await interaction.reply({ content: 'Ödeme sistemi yakında eklenecek!', ephemeral: true });
}

async function handleVsCommand(interaction) {
  await interaction.reply({ content: 'VS sistemi yakında eklenecek!', ephemeral: true });
}

async function handleKayitSilCommand(interaction) {
  if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return await interaction.reply({ content: '❌ Bu komutu kullanmak için **Mesajları Yönet** yetkisine sahip olmalısınız!', ephemeral: true });
  }
  await interaction.reply({ content: 'Kayıt silme yakında eklenecek!', ephemeral: true });
}

async function handleKayitListesiCommand(interaction) {
  if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return await interaction.reply({ content: '❌ Bu komutu kullanmak için **Mesajları Yönet** yetkisine sahip olmalısınız!', ephemeral: true });
  }
  await interaction.reply({ content: 'Kayıt listesi yakında eklenecek!', ephemeral: true });
}

async function handleKayitSayCommand(interaction) {
  const totalRegistered = Array.from(userRegistrations.values()).filter(data => data.registered).length;
  await interaction.reply({ content: `📊 Toplam **${totalRegistered}** kayıtlı kullanıcı bulunuyor!` });
}

// Eksik fonksiyonlar için placeholder'lar
async function handleReminderModal(interaction) {
  await interaction.reply({ content: 'Hatırlatıcı oluşturuldu!', ephemeral: true });
}

async function handleGambleModal(interaction) {
  await interaction.reply({ content: 'Kumar modalı işlendi!', ephemeral: true });
}

async function handleInvestModal(interaction, stockName) {
  await interaction.reply({ content: `Yatırım yapıldı: ${stockName}` });
}

async function handleDailyClaim(interaction) {
  await interaction.update({ content: 'Günlük ödül alındı!', components: [] });
}

async function handleGambleButton(interaction) {
  await interaction.update({ content: 'Kumar oyunu oynandı!', components: [] });
}

async function handleVsButton(interaction) {
  await interaction.update({ content: 'VS butonu tıklandı!', components: [] });
}

async function handlePayButton(interaction) {
  await interaction.update({ content: 'Ödeme butonu tıklandı!', components: [] });
}

async function handleReminderRemoveSelect(interaction) {
  await interaction.update({ content: 'Hatırlatıcı silindi!', components: [] });
}

async function handleJobSelect(interaction) {
  await interaction.update({ content: 'Meslek seçildi!', components: [] });
}

async function handleStockSelect(interaction) {
  await interaction.update({ content: 'Hisse seçildi!', components: [] });
}

// Hatırlatıcı fonksiyonu
async function sendReminder(reminderId) {
  console.log(`Hatırlatıcı gönderildi: ${reminderId}`);
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Login to Discord
console.log('🤖 Bot başlatılıyor...');
client.login(process.env.TOKEN).catch(error => {
  console.error('❌ Discord login failed!');
  console.error('Hata detayı:', error.message);
  console.log('🔧 Lütfen .env dosyanızı kontrol edin:');
  console.log('   - TOKEN değeri doğru mu?');
  console.log('   - CLIENT_ID değeri doğru mu?');
  console.log('   - Bot intentleri ayarlandı mı?');
  process.exit(1);
});
