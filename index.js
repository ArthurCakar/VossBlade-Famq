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
    GatewayIntentBits.GuildVoiceStates,
  ]
});

// Hatırlatıcılar için Map
const reminders = new Map();

// Ekonomi Sistemi için Map
const userEconomy = new Map();

// Kayıt Sistemi için Map
const userRegistry = new Map();

// Ses Kanalı Sistemi
let currentVoiceConnection = null;
let voiceChannelId = null;

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

  // Ses bağlantısı durumunu kontrol et (5 dakikada bir)
  setInterval(() => {
    if (currentVoiceConnection) {
      const channel = client.channels.cache.get(voiceChannelId);
      if (!channel) {
        console.log('❌ Ses kanalı bulunamadı, bağlantı kesiliyor...');
        currentVoiceConnection.destroy();
        currentVoiceConnection = null;
        voiceChannelId = null;
      }
    }
  }, 300000);
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

// Kullanıcı kaydı başlatma fonksiyonu
function initializeUserRegistry(userId) {
  if (!userRegistry.has(userId)) {
    userRegistry.set(userId, {
      registered: false,
      name: null,
      age: null,
      registeredBy: null,
      registeredAt: null,
      notes: []
    });
  }
  return userRegistry.get(userId);
}

// CAN BAR OLUŞTURMA FONKSİYONU
function createHealthBar(currentHP, maxHP) {
  const percentage = currentHP / maxHP;
  const filledBars = Math.round(percentage * 10);
  const emptyBars = 10 - filledBars;
  
  let healthBar = '';
  for (let i = 0; i < filledBars; i++) healthBar += '█';
  for (let i = 0; i < emptyBars; i++) healthBar += '░';
  
  return `${healthBar} ${currentHP}/${maxHP} HP`;
}

// Slash Commands
const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Tüm bot komutlarını gösterir.'),

  new SlashCommandBuilder()
    .setName('help-economy')
    .setDescription('Ekonomi sistemi komutlarını gösterir.'),

  new SlashCommandBuilder()
    .setName('help-fun')
    .setDescription('Eğlence komutlarını gösterir.'),

  new SlashCommandBuilder()
    .setName('help-kayit')
    .setDescription('Kayıt sistemi komutlarını gösterir.'),

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

  // EKONOMİ KOMUTLARI
  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Günlük ödülünü al.'),

  new SlashCommandBuilder()
    .setName('work')
    .setDescription('Çalışarak para kazan.'),

  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Ekonomi profilini göster.')
    .addUserOption(option =>
      option.setName('kullanıcı')
        .setDescription('Profilini görmek istediğiniz kullanıcı')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Zenginlik sıralamasını göster.'),

  new SlashCommandBuilder()
    .setName('invest')
    .setDescription('Sanal borsada yatırım yap.'),

  new SlashCommandBuilder()
    .setName('gamble')
    .setDescription('Kumar oyunları oyna.'),

  // YENİ KOMUT: ADD-COIN
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

  // YENİ KOMUT: REMOVE-COIN
  new SlashCommandBuilder()
    .setName('remove-coin')
    .setDescription('Belirtilen kullanıcıdan coin çıkarır. (Sadece Bot Sahibi)')
    .addUserOption(option =>
      option.setName('kullanıcı')
        .setDescription('Coin çıkarmak istediğiniz kullanıcı')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('miktar')
        .setDescription('Çıkarılacak coin miktarı')
        .setRequired(true)
        .setMinValue(1)),

  // YENİ KOMUT: PAY
  new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Başka bir kullanıcıya coin gönder.')
    .addUserOption(option =>
      option.setName('kullanıcı')
        .setDescription('Coin göndermek istediğiniz kullanıcı')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('miktar')
        .setDescription('Göndermek istediğiniz coin miktarı')
        .setRequired(true)
        .setMinValue(1)),

  // YENİ KOMUT: VS
  new SlashCommandBuilder()
    .setName('vs')
    .setDescription('Başka bir kullanıcıyla coin üzerine düello yap!')
    .addUserOption(option =>
      option.setName('rakip')
        .setDescription('Düello yapmak istediğiniz kullanıcı')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('bahis')
        .setDescription('Bahis miktarı')
        .setRequired(true)
        .setMinValue(10)),

  // KAYIT SİSTEMİ KOMUTLARI
  new SlashCommandBuilder()
    .setName('kayit')
    .setDescription('Kullanıcıyı kayıt eder.')
    .addUserOption(option =>
      option.setName('kullanici')
        .setDescription('Kayıt edilecek kullanıcı')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('isim')
        .setDescription('Kullanıcının ismi')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('yas')
        .setDescription('Kullanıcının yaşı')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)),

  new SlashCommandBuilder()
    .setName('kayit-sil')
    .setDescription('Kullanıcının kaydını siler.')
    .addUserOption(option =>
      option.setName('kullanici')
        .setDescription('Kaydı silinecek kullanıcı')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('kayit-bilgi')
    .setDescription('Kullanıcının kayıt bilgilerini gösterir.')
    .addUserOption(option =>
      option.setName('kullanici')
        .setDescription('Bilgileri gösterilecek kullanıcı')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('kayit-listesi')
    .setDescription('Kayıtlı kullanıcıların listesini gösterir.'),

  // YENİ SES KANALI KOMUTLARI
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
              name: '💰 **Ekonomi Sistemi**',
              value: '• `/daily` - Günlük ödül\n• `/work` - Çalışarak para kazan\n• `/profile` - Ekonomi profili\n• `/leaderboard` - Zenginlik sıralaması\n• `/invest` - Sanal borsa\n• `/gamble` - Kumar oyunları\n• `/pay` - Başka kullanıcıya coin gönder\n• `/add-coin` - Coin ekleme (Sadece Bot Sahibi)\n• `/remove-coin` - Coin çıkarma (Sadece Bot Sahibi)\n• `/vs` - Bahisli düello\n• `/help-economy` - Ekonomi komutları listesi',
              inline: false
            },
            {
              name: '📝 **Kayıt Sistemi**',
              value: '• `/kayit` - Kullanıcıyı kayıt eder\n• `/kayit-sil` - Kullanıcının kaydını siler\n• `/kayit-bilgi` - Kayıt bilgilerini gösterir\n• `/kayit-listesi` - Kayıtlı kullanıcıları listeler\n• `/help-kayit` - Kayıt komutları listesi',
              inline: false
            },
            {
              name: '😄 **Eğlence**',
              value: '• `/avatar` - Avatar gösterir\n• `/serverinfo` - Sunucu bilgisi\n• `/userinfo` - Kullanıcı bilgisi\n• `/kaccm` - Kaç cm olduğunu söyler\n• `/say` - Bota mesaj söyletir\n• `/reminder` - Periyodik hatırlatıcı oluşturur\n• `/reminder-remove` - Hatırlatıcıyı kaldırır\n• `/help-fun` - Eğlence komutları listesi',
              inline: false
            },
            {
              name: '🔊 **Ses Kanalı**',
              value: '• `/connect-vc` - Botu ses kanalına bağlar\n• `/disconnect-vc` - Botu ses kanalından çıkarır',
              inline: false
            },
            {
              name: '🤖 **Bot**',
              value: '• `/ping` - Bot pingini gösterir\n• `/status` - Bot istatistiklerini gösterir\n• `/help` - Bu menüyü gösterir',
              inline: false
            }
          )
          .setImage('https://media.discordapp.net/attachments/962353412480069652/1429871003936493579/standard_4.gif?ex=69101a65&is=690ec8e5&hm=820dcee8df2d4d512d8ceb533bfe7f788d86043d5e07d928e75792fd95505742&=')
          .setFooter({ text: `VossBlade Famq Bot | Toplam ${client.guilds.cache.size} sunucu`, iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        await interaction.reply({ embeds: [helpEmbed] });
      }

      else if (commandName === 'help-economy') {
        const economyHelpEmbed = new EmbedBuilder()
          .setTitle('💰 Ekonomi Sistemi Komutları')
          .setDescription('Aşağıda ekonomi sistemine ait tüm komutları bulabilirsiniz:')
          .setColor(0x00AE86)
          .setThumbnail(client.user.displayAvatarURL())
          .addFields(
            {
              name: '🎁 **Temel Komutlar**',
              value: '• `/daily` - Günlük ödülünü al\n• `/work` - Çalışarak para kazan\n• `/profile` - Ekonomi profilini göster\n• `/leaderboard` - Zenginlik sıralamasını göster',
              inline: false
            },
            {
              name: '📈 **Yatırım & Kumar**',
              value: '• `/invest` - Sanal borsada yatırım yap\n• `/gamble` - Kumar oyunları oyna\n• `/vs` - Başka bir kullanıcıyla bahisli düello yap',
              inline: false
            },
            {
              name: '💸 **Transfer & Yönetim**',
              value: '• `/pay` - Başka bir kullanıcıya coin gönder\n• `/add-coin` - Coin ekleme (Sadece Bot Sahibi)\n• `/remove-coin` - Coin çıkarma (Sadece Bot Sahibi)',
              inline: false
            }
          )
          .setImage('https://media.discordapp.net/attachments/962353412480069652/1429871003936493579/standard_4.gif?ex=69101a65&is=690ec8e5&hm=820dcee8df2d4d512d8ceb533bfe7f788d86043d5e07d928e75792fd95505742&=')
          .setFooter({ text: 'FamqVerse Ekonomi Sistemi', iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        await interaction.reply({ embeds: [economyHelpEmbed] });
      }

      else if (commandName === 'help-fun') {
        const funHelpEmbed = new EmbedBuilder()
          .setTitle('😄 Eğlence Komutları')
          .setDescription('Aşağıda eğlence komutlarını bulabilirsiniz:')
          .setColor(0xFF69B4)
          .setThumbnail(client.user.displayAvatarURL())
          .addFields(
            {
              name: '👤 **Kullanıcı Komutları**',
              value: '• `/avatar` - Kullanıcının avatarını gösterir\n• `/userinfo` - Kullanıcı bilgilerini gösterir\n• `/kaccm` - Kullanıcının kaç cm olduğunu söyler',
              inline: false
            },
            {
              name: '🏠 **Sunucu Komutları**',
              value: '• `/serverinfo` - Sunucu bilgilerini gösterir',
              inline: false
            },
            {
              name: '⚡ **Diğer Eğlence**',
              value: '• `/say` - Bota mesaj söyletir\n• `/reminder` - Periyodik hatırlatıcı oluşturur\n• `/reminder-remove` - Hatırlatıcıyı kaldırır',
              inline: false
            }
          )
          .setImage('https://media.discordapp.net/attachments/962353412480069652/1429871003936493579/standard_4.gif?ex=69101a65&is=690ec8e5&hm=820dcee8df2d4d512d8ceb533bfe7f788d86043d5e07d928e75792fd95505742&=')
          .setFooter({ text: 'VossBlade Eğlence Sistemi', iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        await interaction.reply({ embeds: [funHelpEmbed] });
      }

      else if (commandName === 'help-kayit') {
        const kayitHelpEmbed = new EmbedBuilder()
          .setTitle('📝 Kayıt Sistemi Komutları')
          .setDescription('Aşağıda kayıt sistemine ait tüm komutları bulabilirsiniz:')
          .setColor(0x0099FF)
          .setThumbnail(client.user.displayAvatarURL())
          .addFields(
            {
              name: '📋 **Kayıt İşlemleri**',
              value: '• `/kayit` - Kullanıcıyı kayıt eder\n• `/kayit-sil` - Kullanıcının kaydını siler\n• `/kayit-bilgi` - Kayıt bilgilerini gösterir\n• `/kayit-listesi` - Kayıtlı kullanıcıları listeler',
              inline: false
            },
            {
              name: '⚙️ **Kullanım**',
              value: '**Kayıt için gerekli bilgiler:**\n- Kullanıcı etiketi\n- İsim\n- Yaş\n\n**Not:** Kayıt işlemleri için yetkili olmanız gerekmektedir.',
              inline: false
            }
          )
          .setImage('https://media.discordapp.net/attachments/962353412480069652/1429871003936493579/standard_4.gif?ex=69101a65&is=690ec8e5&hm=820dcee8df2d4d512d8ceb533bfe7f788d86043d5e07d928e75792fd95505742&=')
          .setFooter({ text: 'VossBlade Kayıt Sistemi', iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        await interaction.reply({ embeds: [kayitHelpEmbed] });
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

      // EKONOMİ KOMUTLARI
      else if (commandName === 'daily') {
        await handleDailyCommand(interaction);
      }

      else if (commandName === 'work') {
        await handleWorkCommand(interaction);
      }

      else if (commandName === 'profile') {
        await handleProfileCommand(interaction);
      }

      else if (commandName === 'leaderboard') {
        await handleLeaderboardCommand(interaction);
      }

      else if (commandName === 'invest') {
        await handleInvestCommand(interaction);
      }

      else if (commandName === 'gamble') {
        await handleGambleCommand(interaction);
      }

      // YENİ KOMUT: ADD-COIN
      else if (commandName === 'add-coin') {
        await handleAddCoinCommand(interaction);
      }

      // YENİ KOMUT: REMOVE-COIN
      else if (commandName === 'remove-coin') {
        await handleRemoveCoinCommand(interaction);
      }

      // YENİ KOMUT: PAY
      else if (commandName === 'pay') {
        await handlePayCommand(interaction);
      }

      // YENİ KOMUT: VS
      else if (commandName === 'vs') {
        await handleVsCommand(interaction);
      }

      // KAYIT SİSTEMİ KOMUTLARI
      else if (commandName === 'kayit') {
        await handleKayitCommand(interaction);
      }

      else if (commandName === 'kayit-sil') {
        await handleKayitSilCommand(interaction);
      }

      else if (commandName === 'kayit-bilgi') {
        await handleKayitBilgiCommand(interaction);
      }

      else if (commandName === 'kayit-listesi') {
        await handleKayitListesiCommand(interaction);
      }

      // YENİ SES KANALI KOMUTLARI
      else if (commandName === 'connect-vc') {
        await handleConnectVcCommand(interaction);
      }

      else if (commandName === 'disconnect-vc') {
        await handleDisconnectVcCommand(interaction);
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
    } else if (interaction.customId === 'voiceChannelSelect') {
      await handleVoiceChannelSelect(interaction);
    }
  } else if (interaction.isButton()) {
    if (interaction.customId === 'daily_claim') {
      await handleDailyClaim(interaction);
    } else if (interaction.customId.startsWith('gamble_')) {
      await handleGambleButton(interaction);
    } else if (interaction.customId.startsWith('vs_')) {
      await handleVsButton(interaction);
    } else if (interaction.customId.startsWith('pay_')) {
      await handlePayButton(interaction);
    }
  }
});

// EKONOMİ SİSTEMİ FONKSİYONLARI

async function handleDailyCommand(interaction) {
  const userData = initializeUserEconomy(interaction.user.id);
  const now = Date.now();
  const lastDaily = userData.lastDaily || 0;
  const cooldown = 24 * 60 * 60 * 1000; // 24 saat

  if (now - lastDaily < cooldown) {
    const nextDaily = lastDaily + cooldown;
    const timeLeft = nextDaily - now;
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    return await interaction.reply({
      content: `❌ Günlük ödülünü zaten aldın! ${hours} saat ${minutes} dakika sonra tekrar alabilirsin.`,
      ephemeral: true
    });
  }

  // Mini oyun için butonlar
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
      { name: '💰 Bonus', value: `+${(userData.dailyStreak * 50).toLocaleString()} coin`, inline: true }
    )
    .setFooter({ text: 'Her gün ödül alarak streak\'ini artır!', iconURL: interaction.user.displayAvatarURL() });

  await interaction.reply({ embeds: [dailyEmbed], components: [row] });
}

async function handleDailyClaim(interaction) {
  const userData = initializeUserEconomy(interaction.user.id);
  const baseReward = 500;
  const streakBonus = userData.dailyStreak * 50;
  const totalReward = baseReward + streakBonus;

  userData.balance += totalReward;
  userData.dailyStreak += 1;
  userData.lastDaily = Date.now();
  
  // Başarı kontrolü
  if (userData.dailyStreak === 7 && !userData.achievements.includes('daily_streak_7')) {
    userData.achievements.push('daily_streak_7');
    userData.balance += achievements.daily_streak_7.reward;
  }

  const resultEmbed = new EmbedBuilder()
    .setTitle('🎉 Günlük Ödül Alındı!')
    .setColor(0x00FF00)
    .addFields(
      { name: '💰 Temel Ödül', value: `${baseReward.toLocaleString()} coin`, inline: true },
      { name: '🔥 Streak Bonus', value: `${streakBonus.toLocaleString()} coin`, inline: true },
      { name: '🎯 Toplam', value: `${totalReward.toLocaleString()} coin`, inline: true },
      { name: '📈 Yeni Streak', value: `${userData.dailyStreak} gün`, inline: true },
      { name: '💳 Yeni Bakiye', value: `${userData.balance.toLocaleString()} coin`, inline: true }
    );

  if (userData.dailyStreak === 7) {
    resultEmbed.addFields({
      name: '🏆 Yeni Başarı!',
      value: `**${achievements.daily_streak_7.name}** kazandın! +${achievements.daily_streak_7.reward.toLocaleString()} coin`
    });
  }

  await interaction.update({ embeds: [resultEmbed], components: [] });
}

async function handleWorkCommand(interaction) {
  const userData = initializeUserEconomy(interaction.user.id);
  const now = Date.now();

  if (!userData.job) {
    // İş seçme menüsü
    const selectMenu = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('jobSelect')
          .setPlaceholder('Bir meslek seçin...')
          .addOptions(
            Object.entries(jobs).map(([jobName, jobData]) => ({
              label: jobName,
              description: `Kazanç: ${jobData.min.toLocaleString()}-${jobData.max.toLocaleString()} coin`,
              value: jobName
            }))
          )
      );

    await interaction.reply({
      content: '**Çalışmak için bir meslek seç:**',
      components: [selectMenu],
      ephemeral: true
    });
    return;
  }

  const job = jobs[userData.job];
  if (now - userData.lastWork < job.cooldown) {
    const timeLeft = job.cooldown - (now - userData.lastWork);
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);

    return await interaction.reply({
      content: `❌ Şu anda çalışamazsın! ${minutes} dakika ${seconds} saniye sonra tekrar çalışabilirsin.`,
      ephemeral: true
    });
  }

  const earnings = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
  const xpGain = Math.floor(earnings / 10);

  userData.balance += earnings;
  userData.xp += xpGain;
  userData.lastWork = now;

  // Seviye atlama kontrolü
  const neededXP = userData.level * 100;
  if (userData.xp >= neededXP) {
    userData.level += 1;
    userData.xp = 0;
    userData.balance += userData.level * 200; // Seviye bonusu
  }

  const workEmbed = new EmbedBuilder()
    .setTitle('💼 Çalışma Tamamlandı!')
    .setColor(0x0099FF)
    .addFields(
      { name: '👨‍💼 Meslek', value: userData.job, inline: true },
      { name: '💰 Kazanç', value: `${earnings.toLocaleString()} coin`, inline: true },
      { name: '⭐ XP', value: `${xpGain} XP`, inline: true },
      { name: '🎯 Seviye', value: `${userData.level}`, inline: true },
      { name: '💳 Yeni Bakiye', value: `${userData.balance.toLocaleString()} coin`, inline: true },
      { name: '📊 XP İlerleme', value: `${userData.xp}/${userData.level * 100}`, inline: true }
    );

  if (userData.xp === 0) {
    workEmbed.addFields({
      name: '🎉 Seviye Atladın!',
      value: `**Seviye ${userData.level}** oldun! +${(userData.level * 200).toLocaleString()} coin bonus!`
    });
  }

  await interaction.reply({ embeds: [workEmbed] });
}

async function handleJobSelect(interaction) {
  // Sadece komutu başlatan kişi seçim yapabilir
  if (interaction.user.id !== interaction.message.interaction.user.id) {
    return await interaction.reply({
      content: '❌ Bu meslek seçimini sadece komutu kullanan kişi yapabilir!',
      ephemeral: true
    });
  }

  const userData = initializeUserEconomy(interaction.user.id);
  const selectedJob = interaction.values[0];

  userData.job = selectedJob;
  userData.lastWork = 0; // Hemen çalışabilmesi için

  const jobEmbed = new EmbedBuilder()
    .setTitle('👨‍💼 İşe Başladın!')
    .setColor(0x00FF00)
    .setDescription(`Tebrikler! Artık bir **${selectedJob}** olarak çalışıyorsun.`)
    .addFields(
      { name: '💰 Maaş Aralığı', value: `${jobs[selectedJob].min.toLocaleString()}-${jobs[selectedJob].max.toLocaleString()} coin`, inline: true },
      { name: '⏰ Bekleme Süresi', value: `${jobs[selectedJob].cooldown / 60000} dakika`, inline: true }
    )
    .setFooter({ text: 'Hemen /work komutuyla çalışmaya başlayabilirsin!', iconURL: interaction.user.displayAvatarURL() });

  await interaction.update({ content: '', embeds: [jobEmbed], components: [] });
}

async function handleProfileCommand(interaction) {
  const targetUser = interaction.options.getUser('kullanıcı') || interaction.user;
  const userData = initializeUserEconomy(targetUser.id);

  const netWorth = userData.balance + userData.bank;
  let rank = 1;
  
  // Sıralama hesapla
  const allUsers = Array.from(userEconomy.entries())
    .map(([id, data]) => ({ id, netWorth: data.balance + data.bank }))
    .sort((a, b) => b.netWorth - a.netWorth);
  
  rank = allUsers.findIndex(u => u.id === targetUser.id) + 1;

  const profileEmbed = new EmbedBuilder()
    .setTitle(`👤 ${targetUser.username} - Ekonomi Profili`)
    .setColor(0x00AE86)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '💳 Cüzdan', value: `${userData.balance.toLocaleString()} coin`, inline: true },
      { name: '🏦 Banka', value: `${userData.bank.toLocaleString()} coin`, inline: true },
      { name: '💰 Toplam', value: `${netWorth.toLocaleString()} coin`, inline: true },
      { name: '🎯 Seviye', value: `${userData.level}`, inline: true },
      { name: '⭐ XP', value: `${userData.xp}/${userData.level * 100}`, inline: true },
      { name: '🏆 Sıralama', value: `#${rank}`, inline: true },
      { name: '👨‍💼 Meslek', value: userData.job || 'İşsiz', inline: true },
      { name: '🔥 Daily Streak', value: `${userData.dailyStreak} gün`, inline: true },
      { name: '🏆 Başarılar', value: `${userData.achievements.length} adet`, inline: true }
    )
    .setFooter({ text: 'FamqVerse Ekonomi Sistemi', iconURL: client.user.displayAvatarURL() })
    .setTimestamp();

  await interaction.reply({ embeds: [profileEmbed] });
}

// GÜNCELLENMİŞ LEADERBOARD KOMUTU - Kullanıcı isimlerini global olarak göster
async function handleLeaderboardCommand(interaction) {
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
    
    try {
      // Kullanıcıyı global olarak bulmaya çalış
      const userObj = await client.users.fetch(user.id);
      leaderboardText += `**${i + 1}.** ${userObj.tag} - ${user.netWorth.toLocaleString()} coin (Seviye ${user.level})\n`;
    } catch (error) {
      // Kullanıcı bulunamazsa ID ile göster
      leaderboardText += `**${i + 1}.** <@${user.id}> - ${user.netWorth.toLocaleString()} coin (Seviye ${user.level})\n`;
    }
  }

  const leaderboardEmbed = new EmbedBuilder()
    .setTitle('🏆 Zenginlik Sıralaması')
    .setDescription(leaderboardText || 'Henüz kimse ekonomi sistemine katılmamış!')
    .setColor(0xFFD700)
    .setFooter({ text: 'FamqVerse Ekonomi Liderliği', iconURL: interaction.guild.iconURL() })
    .setTimestamp();

  await interaction.reply({ embeds: [leaderboardEmbed] });
}

// GÜNCELLENMİŞ INVEST KOMUTU
async function handleInvestCommand(interaction) {
  const userData = initializeUserEconomy(interaction.user.id);
  
  const stockOptions = Object.entries(virtualStocks).map(([name, data]) => ({
    label: name,
    description: `Fiyat: ${data.price.toLocaleString()} coin | Değişim: %${(data.volatility * 100).toFixed(1)}`,
    value: name
  }));

  const selectMenu = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('stockSelect')
        .setPlaceholder('Yatırım yapmak için hisse seçin...')
        .addOptions(stockOptions)
    );

  const totalInvestment = Object.values(userData.investments).reduce((sum, inv) => sum + (inv.shares * inv.buyPrice), 0);

  const investEmbed = new EmbedBuilder()
    .setTitle('📈 Sanal Borsa')
    .setDescription('Aşağıdan yatırım yapmak istediğiniz hisseyi seçin:')
    .setColor(0x0099FF)
    .addFields(
      { name: '💳 Mevcut Bakiye', value: `${userData.balance.toLocaleString()} coin`, inline: true },
      { name: '🏦 Toplam Yatırım', value: `${totalInvestment.toLocaleString()} coin`, inline: true }
    )
    .setFooter({ text: 'Hisse fiyatları gerçek zamanlı olarak değişmektedir', iconURL: interaction.user.displayAvatarURL() });

  await interaction.reply({ embeds: [investEmbed], components: [selectMenu], ephemeral: true });
}

// GÜNCELLENMİŞ STOCK SELECT İŞLEYİCİSİ
async function handleStockSelect(interaction) {
  // Sadece komutu başlatan kişi seçim yapabilir
  if (interaction.user.id !== interaction.message.interaction.user.id) {
    return await interaction.reply({
      content: '❌ Bu hisse seçimini sadece komutu kullanan kişi yapabilir!',
      ephemeral: true
    });
  }

  const stockName = interaction.values[0];
  const stock = virtualStocks[stockName];
  
  // Modal oluştur - kaç hisse alınmak istendiğini sor
  const modal = new ModalBuilder()
    .setCustomId(`investModal_${stockName}`)
    .setTitle(`${stockName} Hisse Alımı`);

  const sharesInput = new TextInputBuilder()
    .setCustomId('sharesAmount')
    .setLabel("Almak istediğiniz hisse miktarı")
    .setPlaceholder("1")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(5);

  const actionRow = new ActionRowBuilder().addComponents(sharesInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

// YENİ INVEST MODAL İŞLEYİCİSİ
async function handleInvestModal(interaction, stockName) {
  try {
    const sharesAmount = parseInt(interaction.fields.getTextInputValue('sharesAmount'));
    const stock = virtualStocks[stockName];
    const userData = initializeUserEconomy(interaction.user.id);

    if (isNaN(sharesAmount) || sharesAmount < 1) {
      return await interaction.reply({
        content: '❌ Geçersiz hisse miktarı! Lütfen pozitif bir sayı girin.',
        ephemeral: true
      });
    }

    const totalCost = sharesAmount * stock.price;

    if (userData.balance < totalCost) {
      return await interaction.reply({
        content: `❌ Yeterli bakiyen yok! ${totalCost.toLocaleString()} coin gerekiyor, senin bakiyen: ${userData.balance.toLocaleString()} coin`,
        ephemeral: true
      });
    }

    if (!userData.investments[stockName]) {
      userData.investments[stockName] = { shares: 0, buyPrice: 0 };
    }

    userData.investments[stockName].shares += sharesAmount;
    userData.investments[stockName].buyPrice = stock.price;
    userData.balance -= totalCost;

    const investEmbed = new EmbedBuilder()
      .setTitle('✅ Yatırım Tamamlandı!')
      .setColor(0x00FF00)
      .addFields(
        { name: '📈 Hisse', value: stockName, inline: true },
        { name: '🔢 Adet', value: `${sharesAmount.toLocaleString()} hisse`, inline: true },
        { name: '💰 Birim Fiyat', value: `${stock.price.toLocaleString()} coin`, inline: true },
        { name: '💸 Toplam Maliyet', value: `${totalCost.toLocaleString()} coin`, inline: true },
        { name: '💳 Kalan Bakiye', value: `${userData.balance.toLocaleString()} coin`, inline: true },
        { name: '📊 Toplam Hisse', value: `${userData.investments[stockName].shares.toLocaleString()} adet`, inline: true }
      )
      .setFooter({ text: 'Fiyatlar dalgalanabilir, dikkatli yatırım yapın!', iconURL: interaction.user.displayAvatarURL() });

    await interaction.reply({ embeds: [investEmbed] });

  } catch (error) {
    console.error('Invest modal hatası:', error);
    await interaction.reply({
      content: '❌ Yatırım işlemi sırasında bir hata oluştu!',
      ephemeral: true
    });
  }
}

// GÜNCELLENMİŞ GAMBLE KOMUTU
async function handleGambleCommand(interaction) {
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

  await interaction.showModal(modal);
}

// YENİ GAMBLE MODAL İŞLEYİCİSİ
async function handleGambleModal(interaction) {
  try {
    const betAmount = parseInt(interaction.fields.getTextInputValue('betAmount'));
    const userData = initializeUserEconomy(interaction.user.id);

    if (isNaN(betAmount) || betAmount < 1) {
      return await interaction.reply({
        content: '❌ Geçersiz bahis miktarı! Lütfen pozitif bir sayı girin.',
        ephemeral: true
      });
    }

    if (userData.balance < betAmount) {
      return await interaction.reply({
        content: `❌ Yeterli bakiyen yok! ${betAmount.toLocaleString()} coin gerekiyor, senin bakiyen: ${userData.balance.toLocaleString()} coin`,
        ephemeral: true
      });
    }

    // Bahis miktarını kullanıcı verisine kaydet
    userData.currentBet = betAmount;

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('gamble_slot')
          .setLabel('🎰 Slot Makinesi')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('gamble_dice')
          .setLabel('🎲 Zar At')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('gamble_coin')
          .setLabel('⭕️ Yazı-Tura')
          .setStyle(ButtonStyle.Secondary)
      );

    const gambleEmbed = new EmbedBuilder()
      .setTitle('🎰 Kumar Oyunları')
      .setDescription(`**Bahis Miktarı:** ${betAmount.toLocaleString()} coin\nAşağıdan oynamak istediğiniz oyunu seçin:`)
      .setColor(0x9B59B6)
      .addFields(
        { name: '🎰 Slot Makinesi', value: 'Büyük kazançlar için!', inline: true },
        { name: '🎲 Zar At', value: 'Basit ve eğlenceli', inline: true },
        { name: '⭕️ Yazı-Tura', value: '%50 şans', inline: true }
      )
      .setFooter({ 
        text: `Kumar bağımlılık yapabilir, dikkatli oynayın! • ${interaction.user.username}`, 
        iconURL: interaction.user.displayAvatarURL() 
      });

    await interaction.reply({ 
      embeds: [gambleEmbed], 
      components: [row] 
    });

  } catch (error) {
    console.error('Gamble modal hatası:', error);
    await interaction.reply({
      content: '❌ Bahis işlemi sırasında bir hata oluştu!',
      ephemeral: true
    });
  }
}

// GÜNCELLENMİŞ GAMBLE BUTON İŞLEYİCİSİ - Sadece komutu kullanan etkileşimde bulunabilsin
async function handleGambleButton(interaction) {
  // Sadece komutu başlatan kişi butonlara tıklayabilir
  if (interaction.user.id !== interaction.message.interaction.user.id) {
    return await interaction.reply({
      content: '❌ Bu kumar oyununu sadece komutu kullanan kişi oynayabilir!',
      ephemeral: true
    });
  }

  const userData = initializeUserEconomy(interaction.user.id);
  const gameType = interaction.customId.split('_')[1];
  const betAmount = userData.currentBet || 100;

  if (userData.balance < betAmount) {
    return await interaction.reply({
      content: `❌ Yeterli bakiyen yok! ${betAmount.toLocaleString()} coin gerekiyor, senin bakiyen: ${userData.balance.toLocaleString()} coin`,
      ephemeral: true
    });
  }

  userData.balance -= betAmount;
  let result, winAmount = 0;

  switch (gameType) {
    case 'slot':
      const slots = ['🍒', '🍋', '🍊', '⭐', '7️⃣'];
      const result1 = slots[Math.floor(Math.random() * slots.length)];
      const result2 = slots[Math.floor(Math.random() * slots.length)];
      const result3 = slots[Math.floor(Math.random() * slots.length)];
      
      result = `${result1} | ${result2} | ${result3}`;
      
      if (result1 === result2 && result2 === result3) {
        if (result1 === '7️⃣') {
          winAmount = betAmount * 10; // Jackpot!
        } else if (result1 === '⭐') {
          winAmount = betAmount * 5;
        } else {
          winAmount = betAmount * 3;
        }
      } else if (result1 === result2 || result2 === result3 || result1 === result3) {
        winAmount = betAmount * 2;
      }
      break;

    case 'dice':
      const userRoll = Math.floor(Math.random() * 6) + 1;
      const botRoll = Math.floor(Math.random() * 6) + 1;
      
      result = `🎲 **Sen:** ${userRoll} | **Bot:** ${botRoll}`;
      
      if (userRoll > botRoll) {
        winAmount = betAmount * 2;
      } else if (userRoll === botRoll) {
        winAmount = betAmount; // Berabere
      }
      break;

    case 'coin':
      const coinResult = Math.random() > 0.5 ? 'Yazı' : 'Tura';
      const userChoice = Math.random() > 0.5 ? 'Yazı' : 'Tura';
      
      result = `⭕️ **Sen:** ${userChoice} | **Sonuç:** ${coinResult}`;
      
      if (userChoice === coinResult) {
        winAmount = betAmount * 1.8;
      }
      break;
  }

  userData.balance += winAmount;
  userData.currentBet = 0; // Bahsi sıfırla

  const gambleResultEmbed = new EmbedBuilder()
    .setTitle(`🎰 ${gameType === 'slot' ? 'Slot Makinesi' : gameType === 'dice' ? 'Zar Oyunu' : 'Yazı-Tura'}`)
    .setColor(winAmount > betAmount ? 0x00FF00 : winAmount > 0 ? 0xFFA500 : 0xFF0000)
    .addFields(
      { name: '👤 Oyuncu', value: interaction.user.toString(), inline: true },
      { name: '🎯 Sonuç', value: result, inline: false },
      { name: '💰 Bahis', value: `${betAmount.toLocaleString()} coin`, inline: true },
      { name: '🎉 Kazanç', value: `${winAmount.toLocaleString()} coin`, inline: true },
      { name: '💳 Yeni Bakiye', value: `${userData.balance.toLocaleString()} coin`, inline: true }
    )
    .setFooter({ 
      text: winAmount > 0 ? '🎉 Tebrikler!' : '😔 Bir dahaki sefere!', 
      iconURL: interaction.user.displayAvatarURL() 
    })
    .setTimestamp();

  if (winAmount > betAmount) {
    gambleResultEmbed.setDescription('**🎊 BÜYÜK KAZANÇ!**');
  } else if (winAmount > 0) {
    gambleResultEmbed.setDescription('**🎉 Tebrikler, kazandın!**');
  } else {
    gambleResultEmbed.setDescription('**😔 Maalesef kaybettin, bir dahaki sefere!**');
  }

  await interaction.update({ embeds: [gambleResultEmbed], components: [] });
}

// YENİ ADD-COIN KOMUTU
async function handleAddCoinCommand(interaction) {
  // Sadece bot sahibi kullanabilsin
  if (interaction.user.id !== '726500417021804648') {
    return await interaction.reply({
      content: '❌ Bu komutu sadece bot sahibi kullanabilir!',
      ephemeral: true
    });
  }

  const targetUser = interaction.options.getUser('kullanıcı');
  const amount = interaction.options.getInteger('miktar');
  const userData = initializeUserEconomy(targetUser.id);

  userData.balance += amount;

  const addCoinEmbed = new EmbedBuilder()
    .setTitle('💰 Coin Eklendi!')
    .setColor(0x00FF00)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '👤 Kullanıcı', value: `${targetUser.tag}`, inline: true },
      { name: '🆔 ID', value: targetUser.id, inline: true },
      { name: '💰 Eklenecek Miktar', value: `${amount.toLocaleString()} coin`, inline: true },
      { name: '💳 Yeni Bakiye', value: `${userData.balance.toLocaleString()} coin`, inline: true },
      { name: '👤 İşlemi Yapan', value: interaction.user.tag, inline: true }
    )
    .setFooter({ text: 'FamqVerse Yönetici Sistemi', iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  await interaction.reply({ embeds: [addCoinEmbed] });
}

// YENİ REMOVE-COIN KOMUTU
async function handleRemoveCoinCommand(interaction) {
  // Sadece bot sahibi kullanabilsin
  if (interaction.user.id !== '726500417021804648') {
    return await interaction.reply({
      content: '❌ Bu komutu sadece bot sahibi kullanabilir!',
      ephemeral: true
    });
  }

  const targetUser = interaction.options.getUser('kullanıcı');
  const amount = interaction.options.getInteger('miktar');
  const userData = initializeUserEconomy(targetUser.id);

  // Kullanıcının bakiyesinden çıkar
  userData.balance = Math.max(0, userData.balance - amount); // Negatif olmaması için

  const removeCoinEmbed = new EmbedBuilder()
    .setTitle('💰 Coin Çıkarıldı!')
    .setColor(0xFF0000)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '👤 Kullanıcı', value: `${targetUser.tag}`, inline: true },
      { name: '🆔 ID', value: targetUser.id, inline: true },
      { name: '💰 Çıkarılan Miktar', value: `${amount.toLocaleString()} coin`, inline: true },
      { name: '💳 Yeni Bakiye', value: `${userData.balance.toLocaleString()} coin`, inline: true },
      { name: '👤 İşlemi Yapan', value: interaction.user.tag, inline: true }
    )
    .setFooter({ text: 'FamqVerse Yönetici Sistemi', iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  await interaction.reply({ embeds: [removeCoinEmbed] });
}

// GÜNCELLENMİŞ PAY KOMUTU - Onay sistemi ile
async function handlePayCommand(interaction) {
  const targetUser = interaction.options.getUser('kullanıcı');
  const amount = interaction.options.getInteger('miktar');
  const userData = initializeUserEconomy(interaction.user.id);
  const targetData = initializeUserEconomy(targetUser.id);

  // Kendine para gönderemez
  if (targetUser.id === interaction.user.id) {
    return await interaction.reply({
      content: '❌ Kendine coin gönderemezsin!',
      ephemeral: true
    });
  }

  // Yeterli bakiye kontrolü
  if (userData.balance < amount) {
    return await interaction.reply({
      content: `❌ Yeterli bakiyen yok! ${amount.toLocaleString()} coin göndermek istiyorsun, bakiyen: ${userData.balance.toLocaleString()} coin`,
      ephemeral: true
    });
  }

  // Onay embed'i
  const confirmEmbed = new EmbedBuilder()
    .setTitle('💸 Coin Transferi Onayı')
    .setColor(0xFFA500)
    .setDescription(`**${targetUser.tag}** kullanıcısına **${amount.toLocaleString()} coin** göndermek üzeresiniz.`)
    .addFields(
      { name: '👤 Alıcı', value: `${targetUser.tag}`, inline: true },
      { name: '💰 Miktar', value: `${amount.toLocaleString()} coin`, inline: true },
      { name: '💳 Mevcut Bakiye', value: `${userData.balance.toLocaleString()} coin`, inline: true },
      { name: '🏦 Alıcı Bakiyesi', value: `${targetData.balance.toLocaleString()} coin`, inline: true }
    )
    .setFooter({ text: 'İşlemi onaylamak için 30 saniyeniz var', iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`pay_confirm_${targetUser.id}_${amount}`)
        .setLabel('✅ Onayla')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('pay_cancel')
        .setLabel('❌ İptal')
        .setStyle(ButtonStyle.Danger)
    );

  await interaction.reply({ 
    embeds: [confirmEmbed], 
    components: [row] 
  });

  // 30 saniye timeout
  setTimeout(async () => {
    try {
      const message = await interaction.fetchReply();
      if (message.components.length > 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setTitle('⏰ Süre Doldu!')
          .setColor(0x666666)
          .setDescription('Coin transferi onay süresi doldu.')
          .setFooter({ text: 'İşlem iptal edildi', iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ 
          embeds: [timeoutEmbed], 
          components: [] 
        });
      }
    } catch (error) {
      console.error('Pay timeout hatası:', error);
    }
  }, 30000);
}

// YENİ PAY BUTON İŞLEYİCİSİ
async function handlePayButton(interaction) {
  // Sadece komutu kullanan kişi onaylayabilir
  if (interaction.user.id !== interaction.message.interaction.user.id) {
    return await interaction.reply({
      content: '❌ Bu işlemi sadece komutu kullanan kişi onaylayabilir!',
      ephemeral: true
    });
  }

  if (interaction.customId === 'pay_cancel') {
    const cancelEmbed = new EmbedBuilder()
      .setTitle('❌ İşlem İptal Edildi')
      .setColor(0xFF0000)
      .setDescription('Coin transferi iptal edildi.')
      .setFooter({ text: 'İşlem kullanıcı tarafından iptal edildi', iconURL: interaction.user.displayAvatarURL() });

    await interaction.update({ 
      embeds: [cancelEmbed], 
      components: [] 
    });
    return;
  }

  if (interaction.customId.startsWith('pay_confirm_')) {
    const [,, targetUserId, amount] = interaction.customId.split('_');
    const targetUser = await client.users.fetch(targetUserId);
    const transferAmount = parseInt(amount);

    const userData = initializeUserEconomy(interaction.user.id);
    const targetData = initializeUserEconomy(targetUserId);

    // Tekrar bakiye kontrolü
    if (userData.balance < transferAmount) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ İşlem Başarısız!')
        .setColor(0xFF0000)
        .setDescription('Yeterli bakiyeniz kalmadı!')
        .setFooter({ text: 'Bakiye yetersiz', iconURL: interaction.user.displayAvatarURL() });

      return await interaction.update({ 
        embeds: [errorEmbed], 
        components: [] 
      });
    }

    // Para transferi
    userData.balance -= transferAmount;
    targetData.balance += transferAmount;

    const successEmbed = new EmbedBuilder()
      .setTitle('💸 Coin Transferi Tamamlandı!')
      .setColor(0x00FF00)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 Gönderen', value: `${interaction.user.tag}`, inline: true },
        { name: '👥 Alıcı', value: `${targetUser.tag}`, inline: true },
        { name: '💰 Miktar', value: `${transferAmount.toLocaleString()} coin`, inline: true },
        { name: '💳 Gönderen Yeni Bakiye', value: `${userData.balance.toLocaleString()} coin`, inline: true },
        { name: '🏦 Alıcı Yeni Bakiye', value: `${targetData.balance.toLocaleString()} coin`, inline: true }
      )
      .setFooter({ text: 'FamqVerse Transfer Sistemi', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.update({ 
      embeds: [successEmbed], 
      components: [] 
    });
  }
}

// GELİŞMİŞ VS KOMUTU - Geri sayım ve çoklu tur sistemi
async function handleVsCommand(interaction) {
  const challenger = interaction.user;
  const opponent = interaction.options.getUser('rakip');
  const betAmount = interaction.options.getInteger('bahis');

  // Kontroller
  if (opponent.bot) {
    return await interaction.reply({
      content: '❌ Botlarla VS atamazsın!',
      ephemeral: true
    });
  }

  if (opponent.id === challenger.id) {
    return await interaction.reply({
      content: '❌ Kendinle VS atamazsın!',
      ephemeral: true
    });
  }

  const challengerData = initializeUserEconomy(challenger.id);
  const opponentData = initializeUserEconomy(opponent.id);

  if (challengerData.balance < betAmount) {
    return await interaction.reply({
      content: `❌ Yeterli bakiyen yok! ${betAmount.toLocaleString()} coin gerekiyor, senin bakiyen: ${challengerData.balance.toLocaleString()} coin`,
      ephemeral: true
    });
  }

  if (opponentData.balance < betAmount) {
    return await interaction.reply({
      content: `❌ Rakibin yeterli bakiyesi yok! ${opponent.username}'in bakiyesi: ${opponentData.balance.toLocaleString()} coin`,
      ephemeral: true
    });
  }

  // VS daveti oluştur
  const vsEmbed = new EmbedBuilder()
    .setTitle('⚔️ VS Düello Daveti!')
    .setColor(0xFF0000)
    .setDescription(`${challenger} ${opponent} adlı kullanıcıyı **${betAmount.toLocaleString()} coin** bahisli düelloya çağırıyor!`)
    .addFields(
      { name: '🎯 Meydan Okuyan', value: `${challenger.tag}\nBakiye: ${challengerData.balance.toLocaleString()} coin`, inline: true },
      { name: '🛡️ Rakip', value: `${opponent.tag}\nBakiye: ${opponentData.balance.toLocaleString()} coin`, inline: true },
      { name: '💰 Bahis', value: `${betAmount.toLocaleString()} coin`, inline: true }
    )
    .setImage('https://media.discordapp.net/attachments/962353412480069652/1430000000000000000/vs_battle.gif')
    .setFooter({ text: 'Düelloyu kabul etmek için 60 saniyen var!', iconURL: interaction.guild.iconURL() })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`vs_accept_${challenger.id}_${opponent.id}_${betAmount}`)
        .setLabel('⚔️ Düelloyu Kabul Et!')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`vs_decline_${challenger.id}_${opponent.id}_${betAmount}`)
        .setLabel('❌ Reddet')
        .setStyle(ButtonStyle.Danger)
    );

  await interaction.reply({ 
    content: `${opponent}`, 
    embeds: [vsEmbed], 
    components: [row] 
  });

  // 60 saniye timeout
  setTimeout(async () => {
    try {
      const message = await interaction.fetchReply();
      if (message.components.length > 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setTitle('⏰ VS Düello Süresi Doldu!')
          .setColor(0x666666)
          .setDescription('Düello daveti süresi doldu.')
          .setFooter({ text: 'Davet 60 saniye içinde kabul edilmedi', iconURL: interaction.guild.iconURL() });

        await interaction.editReply({ 
          content: '', 
          embeds: [timeoutEmbed], 
          components: [] 
        });
      }
    } catch (error) {
      console.error('VS timeout hatası:', error);
    }
  }, 60000);
}

// GÜNCELLENMİŞ VS BUTON İŞLEYİCİSİ - Sadece davet edilen kişi etkileşimde bulunabilsin
async function handleVsButton(interaction) {
  const [action, challengerId, opponentId, betAmount] = interaction.customId.split('_').slice(1);
  const bet = parseInt(betAmount);

  // Sadece davet edilen kişi kabul/reddedebilir
  if (interaction.user.id !== opponentId) {
    return await interaction.reply({
      content: '❌ Bu düello daveti sana değil!',
      ephemeral: true
    });
  }

  if (action === 'decline') {
    const declineEmbed = new EmbedBuilder()
      .setTitle('❌ VS Düello Reddedildi!')
      .setColor(0x666666)
      .setDescription(`${interaction.user} düello davetini reddetti.`)
      .setFooter({ text: 'Başka zaman tekrar deneyin!', iconURL: interaction.guild.iconURL() });

    await interaction.update({ 
      content: '', 
      embeds: [declineEmbed], 
      components: [] 
    });
    return;
  }

  if (action === 'accept') {
    const challenger = await client.users.fetch(challengerId);
    const opponent = interaction.user;

    // Tekrar bakiye kontrolü
    const challengerData = initializeUserEconomy(challenger.id);
    const opponentData = initializeUserEconomy(opponent.id);

    if (challengerData.balance < bet || opponentData.balance < bet) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ VS Düello İptal!')
        .setColor(0xFF0000)
        .setDescription('Bir oyuncunun yeterli bakiyesi kalmadı!')
        .addFields(
          { name: `${challenger.username}`, value: `${challengerData.balance.toLocaleString()} coin`, inline: true },
          { name: `${opponent.username}`, value: `${opponentData.balance.toLocaleString()} coin`, inline: true }
        );

      await interaction.update({ 
        content: '', 
        embeds: [errorEmbed], 
        components: [] 
      });
      return;
    }

    // Düello başlıyor! Geri sayım
    await startVsCountdown(interaction, challenger, opponent, bet);
  }
}

// YENİ VS GERİ SAYIM FONKSİYONU
async function startVsCountdown(interaction, challenger, opponent, betAmount) {
  let countdown = 3;
  
  const countdownEmbed = new EmbedBuilder()
    .setTitle('⚔️ VS Düello Başlıyor!')
    .setColor(0xFF0000)
    .setDescription(`**${countdown}**`)
    .addFields(
      { name: '🎯 Meydan Okuyan', value: challenger.username, inline: true },
      { name: '🛡️ Rakip', value: opponent.username, inline: true },
      { name: '💰 Bahis', value: `${betAmount.toLocaleString()} coin`, inline: true }
    )
    .setImage('https://media.discordapp.net/attachments/962353412480069652/1430000000000000001/battle_start.gif')
    .setFooter({ text: 'Hazır olun!', iconURL: interaction.guild.iconURL() });

  await interaction.update({ 
    content: `${challenger} ${opponent}`, 
    embeds: [countdownEmbed], 
    components: [] 
  });

  // Geri sayım
  const countdownInterval = setInterval(async () => {
    countdown--;
    
    if (countdown > 0) {
      countdownEmbed.setDescription(`**${countdown}**`);
      await interaction.editReply({ 
        content: `${challenger} ${opponent}`, 
        embeds: [countdownEmbed] 
      });
    } else {
      clearInterval(countdownInterval);
      countdownEmbed.setDescription('**⚔️ DÜELLO BAŞLADI!**');
      await interaction.editReply({ 
        content: `${challenger} ${opponent}`, 
        embeds: [countdownEmbed] 
      });
      
      // Düello başlıyor
      setTimeout(() => {
        startVsBattle(interaction, challenger, opponent, betAmount);
      }, 1000);
    }
  }, 1000);
}

// GELİŞMİŞ VS SAVAŞ FONKSİYONU - Çoklu tur ve can sistemi
async function startVsBattle(originalInteraction, challenger, opponent, betAmount) {
  try {
    // Can değerleri
    let challengerHP = 100;
    let opponentHP = 100;
    const maxHP = 100;
    
    const turns = 3; // 3 tur
    let currentTurn = 1;

    const battleEmbed = new EmbedBuilder()
      .setTitle(`⚔️ VS Düello - Tur ${currentTurn}/${turns}`)
      .setColor(0xFF0000)
      .setDescription('Savaş devam ediyor! ⚡')
      .addFields(
        { name: '🎯 Meydan Okuyan', value: challenger.username, inline: true },
        { name: '🛡️ Rakip', value: opponent.username, inline: true },
        { name: '💰 Bahis', value: `${betAmount.toLocaleString()} coin`, inline: true },
        { name: '❤️ Can Durumu', value: `**${challenger.username}:** ${createHealthBar(challengerHP, maxHP)}\n**${opponent.username}:** ${createHealthBar(opponentHP, maxHP)}`, inline: false }
      )
      .setImage('https://media.discordapp.net/attachments/962353412480069652/1430000000000000001/battle_start.gif')
      .setFooter({ text: `Tur ${currentTurn}/${turns}`, iconURL: originalInteraction.guild.iconURL() });

    await originalInteraction.editReply({ 
      content: `${challenger} ${opponent}`, 
      embeds: [battleEmbed] 
    });

    // Tur bazlı savaş
    const battleInterval = setInterval(async () => {
      // Rastgele hasar (10-30 arası)
      const challengerDamage = Math.floor(Math.random() * 21) + 10;
      const opponentDamage = Math.floor(Math.random() * 21) + 10;

      // Canları güncelle
      challengerHP = Math.max(0, challengerHP - opponentDamage);
      opponentHP = Math.max(0, opponentHP - challengerDamage);

      currentTurn++;

      // Embed'i güncelle
      battleEmbed
        .setTitle(`⚔️ VS Düello - Tur ${currentTurn}/${turns}`)
        .setDescription(`**${currentTurn}. Tur Sonuçları:**\n${challenger.username} **${challengerDamage}** hasar vurdu!\n${opponent.username} **${opponentDamage}** hasar vurdu!`)
        .setFields(
          { name: '🎯 Meydan Okuyan', value: challenger.username, inline: true },
          { name: '🛡️ Rakip', value: opponent.username, inline: true },
          { name: '💰 Bahis', value: `${betAmount.toLocaleString()} coin`, inline: true },
          { name: '❤️ Can Durumu', value: `**${challenger.username}:** ${createHealthBar(challengerHP, maxHP)}\n**${opponent.username}:** ${createHealthBar(opponentHP, maxHP)}`, inline: false }
        )
        .setFooter({ text: `Tur ${currentTurn}/${turns}`, iconURL: originalInteraction.guild.iconURL() });

      await originalInteraction.editReply({ 
        content: `${challenger} ${opponent}`, 
        embeds: [battleEmbed] 
      );

      // Düello sonu kontrolü
      if (currentTurn >= turns || challengerHP <= 0 || opponentHP <= 0) {
        clearInterval(battleInterval);
        
        // Kazananı belirle
        let winner, loser;
        if (challengerHP > opponentHP) {
          winner = challenger;
          loser = opponent;
        } else if (opponentHP > challengerHP) {
          winner = opponent;
          loser = challenger;
        } else {
          // Berabere
          const challengerData = initializeUserEconomy(challenger.id);
          const opponentData = initializeUserEconomy(opponent.id);
          
          // Berabere durumunda bahisler iade edilir
          challengerData.balance += 0;
          opponentData.balance += 0;

          const drawEmbed = new EmbedBuilder()
            .setTitle('🤝 VS Düello Berabere!')
            .setColor(0xFFFF00)
            .setDescription('Düello berabere bitti!')
            .addFields(
              { name: '⚔️ Sonuç', value: 'Berabere', inline: true },
              { name: '💰 Bahis', value: `${betAmount.toLocaleString()} coin (iade)`, inline: true },
              { name: '❤️ Son Can Durumu', value: `**${challenger.username}:** ${createHealthBar(challengerHP, maxHP)}\n**${opponent.username}:** ${createHealthBar(opponentHP, maxHP)}`, inline: false }
            )
            .setImage('https://media.discordapp.net/attachments/962353412480069652/1430000000000000004/draw.gif')
            .setFooter({ text: 'Tekrar düello yapmak için /vs komutunu kullanın', iconURL: originalInteraction.guild.iconURL() })
            .setTimestamp();

          await originalInteraction.editReply({ 
            content: `${challenger} ${opponent}`, 
            embeds: [drawEmbed] 
          });
          return;
        }

        // Coin transferi
        const winnerData = initializeUserEconomy(winner.id);
        const loserData = initializeUserEconomy(loser.id);

        winnerData.balance += betAmount;
        loserData.balance -= betAmount;

        // Kazanç/kayıp hesapla
        const winnerOldBalance = winnerData.balance - betAmount;
        const loserOldBalance = loserData.balance + betAmount;

        const resultEmbed = new EmbedBuilder()
          .setTitle('🎉 VS Düello Sonucu!')
          .setColor(winner.id === challenger.id ? 0x00FF00 : 0x0099FF)
          .setDescription(`**${winner.username}** düelloyu kazandı! 🏆`)
          .addFields(
            { name: '⚔️ Kazanan', value: `${winner.username}\n+${betAmount.toLocaleString()} coin`, inline: true },
            { name: '💀 Kaybeden', value: `${loser.username}\n-${betAmount.toLocaleString()} coin`, inline: true },
            { name: '❤️ Son Can Durumu', value: `**${challenger.username}:** ${createHealthBar(challengerHP, maxHP)}\n**${opponent.username}:** ${createHealthBar(opponentHP, maxHP)}`, inline: false },
            { name: '💰 Önceki/Sonraki', value: `**${winner.username}:** ${winnerOldBalance.toLocaleString()} → ${winnerData.balance.toLocaleString()} coin\n**${loser.username}:** ${loserOldBalance.toLocaleString()} → ${loserData.balance.toLocaleString()} coin`, inline: false }
          )
          .setImage(winner.id === challenger.id ? 
            'https://media.discordapp.net/attachments/962353412480069652/1430000000000000002/victory_challenger.gif' :
            'https://media.discordapp.net/attachments/962353412480069652/1430000000000000003/victory_opponent.gif'
          )
          .setFooter({ text: 'Tebrikler! Tekrar düello yapmak için /vs komutunu kullanın', iconURL: winner.displayAvatarURL() })
          .setTimestamp();

        await originalInteraction.editReply({ 
          content: `${challenger} ${opponent}`, 
          embeds: [resultEmbed] 
        });
      }
    }, 2000); // Her tur 2 saniye

  } catch (error) {
    console.error('VS battle hatası:', error);
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ VS Düello Hatası!')
      .setColor(0xFF0000)
      .setDescription('Düello sırasında bir hata oluştu!')
      .setFooter({ text: 'Lütfen tekrar deneyin', iconURL: originalInteraction.guild.iconURL() });

    await originalInteraction.editReply({ 
      content: '', 
      embeds: [errorEmbed] 
    });
  }
}

// KAYIT SİSTEMİ FONKSİYONLARI

// KAYIT KOMUTU
async function handleKayitCommand(interaction) {
  if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return await interaction.reply({
      content: '❌ Bu komutu kullanmak için **Rolleri Yönet** yetkisine sahip olmalısınız!',
      ephemeral: true
    });
  }

  const targetUser = interaction.options.getUser('kullanici');
  const name = interaction.options.getString('isim');
  const age = interaction.options.getInteger('yas');

  const userData = initializeUserRegistry(targetUser.id);

  if (userData.registered) {
    return await interaction.reply({
      content: `❌ ${targetUser.tag} zaten kayıtlı!`,
      ephemeral: true
    });
  }

  // Kullanıcıyı kaydet
  userData.registered = true;
  userData.name = name;
  userData.age = age;
  userData.registeredBy = interaction.user.tag;
  userData.registeredAt = new Date();

  const kayitEmbed = new EmbedBuilder()
    .setTitle('✅ Kullanıcı Kaydedildi!')
    .setColor(0x00FF00)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '👤 Kullanıcı', value: `${targetUser.tag}`, inline: true },
      { name: '🆔 ID', value: targetUser.id, inline: true },
      { name: '📛 İsim', value: name, inline: true },
      { name: '🎂 Yaş', value: `${age}`, inline: true },
      { name: '👤 Kaydeden', value: interaction.user.tag, inline: true },
      { name: '📅 Kayıt Tarihi', value: `<t:${Math.floor(userData.registeredAt.getTime() / 1000)}:R>`, inline: true }
    )
    .setFooter({ text: 'VossBlade Kayıt Sistemi', iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  await interaction.reply({ embeds: [kayitEmbed] });
}

// KAYIT SİL KOMUTU
async function handleKayitSilCommand(interaction) {
  if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return await interaction.reply({
      content: '❌ Bu komutu kullanmak için **Rolleri Yönet** yetkisine sahip olmalısınız!',
      ephemeral: true
    });
  }

  const targetUser = interaction.options.getUser('kullanici');
  const userData = initializeUserRegistry(targetUser.id);

  if (!userData.registered) {
    return await interaction.reply({
      content: `❌ ${targetUser.tag} kayıtlı değil!`,
      ephemeral: true
    });
  }

  // Kaydı sil
  userRegistry.delete(targetUser.id);

  const kayitSilEmbed = new EmbedBuilder()
    .setTitle('✅ Kayıt Silindi!')
    .setColor(0x00FF00)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '👤 Kullanıcı', value: `${targetUser.tag}`, inline: true },
      { name: '🆔 ID', value: targetUser.id, inline: true },
      { name: '👤 Silen', value: interaction.user.tag, inline: true },
      { name: '📅 Silme Tarihi', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
    )
    .setFooter({ text: 'VossBlade Kayıt Sistemi', iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  await interaction.reply({ embeds: [kayitSilEmbed] });
}

// KAYIT BİLGİ KOMUTU
async function handleKayitBilgiCommand(interaction) {
  const targetUser = interaction.options.getUser('kullanici') || interaction.user;
  const userData = initializeUserRegistry(targetUser.id);

  if (!userData.registered) {
    return await interaction.reply({
      content: `❌ ${targetUser.tag} kayıtlı değil!`,
      ephemeral: true
    });
  }

  const kayitBilgiEmbed = new EmbedBuilder()
    .setTitle(`📋 ${targetUser.username} - Kayıt Bilgileri`)
    .setColor(0x0099FF)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '👤 Kullanıcı', value: `${targetUser.tag}`, inline: true },
      { name: '🆔 ID', value: targetUser.id, inline: true },
      { name: '📛 İsim', value: userData.name, inline: true },
      { name: '🎂 Yaş', value: `${userData.age}`, inline: true },
      { name: '👤 Kaydeden', value: userData.registeredBy, inline: true },
      { name: '📅 Kayıt Tarihi', value: `<t:${Math.floor(userData.registeredAt.getTime() / 1000)}:R>`, inline: true }
    )
    .setFooter({ text: 'VossBlade Kayıt Sistemi', iconURL: client.user.displayAvatarURL() })
    .setTimestamp();

  await interaction.reply({ embeds: [kayitBilgiEmbed] });
}

// KAYIT LİSTESİ KOMUTU
async function handleKayitListesiCommand(interaction) {
  const registeredUsers = Array.from(userRegistry.entries())
    .filter(([id, data]) => data.registered)
    .slice(0, 15); // En fazla 15 kullanıcı göster

  if (registeredUsers.length === 0) {
    return await interaction.reply({
      content: '❌ Henüz kayıtlı kullanıcı yok!',
      ephemeral: true
    });
  }

  let kayitListesiText = '';
  
  for (let i = 0; i < registeredUsers.length; i++) {
    const [userId, userData] = registeredUsers[i];
    
    try {
      const user = await client.users.fetch(userId);
      kayitListesiText += `**${i + 1}.** ${user.tag} - ${userData.name} (${userData.age})\n`;
    } catch (error) {
      kayitListesiText += `**${i + 1}.** <@${userId}> - ${userData.name} (${userData.age})\n`;
    }
  }

  const kayitListesiEmbed = new EmbedBuilder()
    .setTitle('📋 Kayıtlı Kullanıcılar')
    .setDescription(kayitListesiText)
    .setColor(0x0099FF)
    .setFooter({ text: `Toplam ${registeredUsers.length} kayıtlı kullanıcı`, iconURL: interaction.guild.iconURL() })
    .setTimestamp();

  await interaction.reply({ embeds: [kayitListesiEmbed] });
}

// STATUS KOMUTU
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

    // Kayıt istatistikleri
    const registeredUsers = Array.from(userRegistry.values()).filter(user => user.registered).length;

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
          value: `┣ Aktif Kullanıcı: **${economyUsers}**\n┗ Toplam Para: **${totalEconomyBalance.toLocaleString()} coin**`,
          inline: false
        },
        {
          name: '📝 **Kayıt Sistemi**',
          value: `┣ Kayıtlı Kullanıcı: **${registeredUsers}**`,
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

// GÜNCELLENMİŞ MODAL SUBMIT İŞLEYİCİSİ
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
  } else if (interaction.customId === 'gambleModal') {
    await handleGambleModal(interaction);
  } else if (interaction.customId.startsWith('investModal_')) {
    const stockName = interaction.customId.replace('investModal_', '');
    await handleInvestModal(interaction, stockName);
  }
}

async function handleReminderRemoveCommand(interaction) {
  try {
    const guildReminders = Array.from(reminders.entries())
      .filter(([reminderId, reminder]) => reminderId.startsWith(interaction.guild.id))
      .map(([reminderId, reminder]) => ({
        reminderId,
        ...reminder
      }));

    if (guildReminders.length === 0) {
      return await interaction.reply({
        content: '❌ Bu sunucuda hiç hatırlatıcı bulunmamaktadır.',
        ephemeral: true
      });
    }

    const options = guildReminders.map(reminder => ({
      label: reminder.name.length > 25 ? reminder.name.substring(0, 22) + '...' : reminder.name,
      description: `Mesaj: ${reminder.message.substring(0, 50)}...`,
      value: reminder.reminderId
    }));

    const selectMenu = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('reminderRemoveSelect')
          .setPlaceholder('Silmek istediğiniz hatırlatıcıyı seçin...')
          .addOptions(options)
      );

    await interaction.reply({
      content: '**Silmek istediğiniz hatırlatıcıyı seçin:**',
      components: [selectMenu],
      ephemeral: true
    });

  } catch (error) {
    console.error('Reminder remove komutu hatası:', error);
    await interaction.reply({
      content: '❌ Hatırlatıcıları listelerken bir hata oluştu!',
      ephemeral: true
    });
  }
}

async function handleReminderRemoveSelect(interaction) {
  try {
    const reminderId = interaction.values[0];
    const reminder = reminders.get(reminderId);

    if (!reminder) {
      return await interaction.reply({
        content: '❌ Hatırlatıcı bulunamadı!',
        ephemeral: true
      });
    }

    reminders.delete(reminderId);

    const embed = new EmbedBuilder()
      .setTitle('✅ Hatırlatıcı Silindi!')
      .setColor(0x00FF00)
      .addFields(
        { name: 'İsim', value: reminder.name, inline: true },
        { name: 'Kanal', value: `<#${reminder.channelId}>`, inline: true },
        { name: 'Etiketlenecek', value: `<@${reminder.memberId}>`, inline: true },
        { name: 'Mesaj', value: reminder.message.length > 1024 ? reminder.message.substring(0, 1021) + '...' : reminder.message, inline: false },
        { name: 'Aralık', value: `${reminder.interval} dakika`, inline: true },
        { name: 'Oluşturan', value: reminder.createdBy, inline: true }
      )
      .setTimestamp();

    await interaction.update({ content: '', embeds: [embed], components: [] });

  } catch (error) {
    console.error('Reminder remove select hatası:', error);
    await interaction.reply({
      content: '❌ Hatırlatıcı silinirken bir hata oluştu!',
      ephemeral: true
    });
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

// SES KANALI KOMUT FONKSİYONLARI

async function handleConnectVcCommand(interaction) {
  // Yetki kontrolü
  if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
    return await interaction.reply({
      content: '❌ Bu komutu kullanmak için **Kanalları Yönet** yetkisine sahip olmalısınız!',
      ephemeral: true
    });
  }

  // Bot zaten bir ses kanalında mı?
  if (currentVoiceConnection) {
    const channel = interaction.guild.channels.cache.get(voiceChannelId);
    return await interaction.reply({
      content: `❌ Bot zaten bir ses kanalında! (${channel ? channel.name : 'Bilinmeyen Kanal'})\nÖnce botun bağlantısını kesmek için \`/disconnect-vc\` komutunu kullanın.`,
      ephemeral: true
    });
  }

  // Sunucudaki tüm ses kanallarını al
  const voiceChannels = interaction.guild.channels.cache.filter(channel => 
    channel.type === ChannelType.GuildVoice
  );

  if (voiceChannels.size === 0) {
    return await interaction.reply({
      content: '❌ Bu sunucuda hiç ses kanalı bulunmamaktadır!',
      ephemeral: true
    });
  }

  // Select menu oluştur
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
  // Yetki kontrolü
  if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
    return await interaction.reply({
      content: '❌ Bu komutu kullanmak için **Kanalları Yönet** yetkisine sahip olmalısınız!',
      ephemeral: true
    });
  }

  // Bot bir ses kanalında değilse
  if (!currentVoiceConnection) {
    return await interaction.reply({
      content: '❌ Bot herhangi bir ses kanalında değil!',
      ephemeral: true
    });
  }

  try {
    // Bağlantıyı kes
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
  // Sadece komutu başlatan kişi seçim yapabilir
  if (interaction.user.id !== interaction.message.interaction.user.id) {
    return await interaction.reply({
      content: '❌ Bu kanal seçimini sadece komutu kullanan kişi yapabilir!',
      ephemeral: true
    });
  }

  const channelId = interaction.values[0];
  const channel = interaction.guild.channels.cache.get(channelId);

  try {
    // Kanalı kontrol et
    if (!channel) {
      return await interaction.reply({
        content: '❌ Kanal bulunamadı!',
        ephemeral: true
      });
    }

    // Kanalın ses kanalı olduğunu kontrol et
    if (channel.type !== ChannelType.GuildVoice) {
      return await interaction.reply({
        content: '❌ Bu bir ses kanalı değil!',
        ephemeral: true
      });
    }

    // Botu kanala bağla
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true, // Botu sağırlaştır
      selfMute: false // Botu susturma
    });

    // Bağlantı event listener'ları
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

    // Global değişkenleri güncelle
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
