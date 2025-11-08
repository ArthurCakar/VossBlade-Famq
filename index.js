const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, SlashCommandBuilder, Routes, ActivityType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

// Basitleştirilmiş müzik sistemi için gerekli importlar
const { 
    AudioPlayerStatus, 
    StreamType, 
    createAudioPlayer, 
    createAudioResource, 
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection
} = require('@discordjs/voice');
const ytdl = require('ytdl-core');

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

// Müzik kuyruğu için Map
const musicQueue = new Map();

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
    activities: [{ name: 'FamqVerse Economy & Music | /help', type: ActivityType.Playing }],
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

  // MÜZİK KOMUTLARI - BASİT VERSİYON
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('YouTube\'dan şarkı çalar')
    .addStringOption(option =>
      option.setName('şarkı')
        .setDescription('Şarkı adı veya URL')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Müziği durdurur ve odadan ayrılır'),

  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Şu anki şarkıyı atlar'),

  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Şarkı kuyruğunu gösterir'),

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
              value: '• `/daily` - Günlük ödül\n• `/work` - Çalışarak para kazan\n• `/profile` - Ekonomi profili\n• `/leaderboard` - Zenginlik sıralaması\n• `/invest` - Sanal borsa\n• `/gamble` - Kumar oyunları\n• `/pay` - Başka kullanıcıya coin gönder\n• `/add-coin` - Coin ekleme (Sadece Bot Sahibi)',
              inline: false
            },
            {
              name: '🎵 **Müzik**',
              value: '• `/play` - Şarkı çalar\n• `/stop` - Müziği durdurur\n• `/skip` - Şarkıyı atlar\n• `/queue` - Kuyruğu gösterir',
              inline: false
            },
            {
              name: '😄 **Eğlence**',
              value: '• `/avatar` - Avatar gösterir\n• `/serverinfo` - Sunucu bilgisi\n• `/userinfo` - Kullanıcı bilgisi\n• `/kaccm` - Kaç cm olduğunu söyler\n• `/say` - Bota mesaj söyletir\n• `/reminder` - Periyodik hatırlatıcı oluşturur\n• `/reminder-remove` - Hatırlatıcıyı kaldırır',
              inline: false
            },
            {
              name: '🤖 **Bot**',
              value: '• `/ping` - Bot pingini gösterir\n• `/status` - Bot istatistiklerini gösterir\n• `/help` - Bu menüyü gösterir',
              inline: false
            }
          )
          .setFooter({ text: `VossBlade Famq Bot | Toplam ${client.guilds.cache.size} sunucu`, iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        await interaction.reply({ embeds: [helpEmbed] });
      }

      // Diğer komutlar aynı şekilde devam ediyor...
      // Sadece müzik komutlarını değiştirdim

      // MÜZİK KOMUTLARI
      else if (commandName === 'play') {
        await handlePlayCommand(interaction);
      }

      else if (commandName === 'stop') {
        await handleStopCommand(interaction);
      }

      else if (commandName === 'skip') {
        await handleSkipCommand(interaction);
      }

      else if (commandName === 'queue') {
        await handleQueueCommand(interaction);
      }

      // Diğer komut işleyicileri aynen kalacak...
      // Kısaltma nedeniyle burada sadece müzik komutlarını gösterdim

    } catch (error) {
      console.error(`Command error (${commandName}):`, error);
      
      if (!interaction.replied) {
        await interaction.reply({
          content: '❌ Komut işlenirken bir hata oluştu!',
          ephemeral: true
        });
      }
    }
  }
});

// BASİT MÜZİK SİSTEMİ FONKSİYONLARI

async function handlePlayCommand(interaction) {
  await interaction.deferReply();
  
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    return await interaction.editReply('❌ Müzik çalmak için bir ses kanalında olmalısınız!');
  }

  const songQuery = interaction.options.getString('şarkı');
  
  try {
    // Basit YouTube URL kontrolü
    let songUrl = songQuery;
    if (!songQuery.includes('youtube.com') && !songQuery.includes('youtu.be')) {
      return await interaction.editReply('❌ Lütfen geçerli bir YouTube URL\'si girin!');
    }

    const songInfo = await ytdl.getInfo(songUrl);
    const song = {
      title: songInfo.videoDetails.title,
      url: songInfo.videoDetails.video_url,
      duration: parseInt(songInfo.videoDetails.lengthSeconds),
      thumbnail: songInfo.videoDetails.thumbnails[0].url,
      requestedBy: interaction.user.tag
    };

    const serverQueue = musicQueue.get(interaction.guild.id);

    if (!serverQueue) {
      const queueConstructor = {
        textChannel: interaction.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        volume: 100,
        playing: true,
        audioPlayer: createAudioPlayer()
      };

      musicQueue.set(interaction.guild.id, queueConstructor);
      queueConstructor.songs.push(song);

      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: interaction.guild.id,
          adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        queueConstructor.connection = connection;
        connection.subscribe(queueConstructor.audioPlayer);

        play(interaction.guild, queueConstructor.songs[0]);
        
        const playEmbed = new EmbedBuilder()
          .setTitle('🎵 Şarkı Çalınıyor')
          .setColor(0x00FF00)
          .setThumbnail(song.thumbnail)
          .addFields(
            { name: '🎶 Şarkı', value: `[${song.title}](${song.url})`, inline: false },
            { name: '⏱️ Süre', value: `${formatTime(song.duration)}`, inline: true },
            { name: '👤 İsteyen', value: song.requestedBy, inline: true }
          )
          .setFooter({ text: 'Müzik Sistemi', iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [playEmbed] });
      } catch (error) {
        console.error('Ses kanalına bağlanılamadı:', error);
        musicQueue.delete(interaction.guild.id);
        await interaction.editReply('❌ Ses kanalına bağlanılamadı!');
      }
    } else {
      serverQueue.songs.push(song);
      
      const queueEmbed = new EmbedBuilder()
        .setTitle('📥 Şarkı Kuyruğa Eklendi')
        .setColor(0x0099FF)
        .setThumbnail(song.thumbnail)
        .addFields(
          { name: '🎶 Şarkı', value: `[${song.title}](${song.url})`, inline: false },
          { name: '⏱️ Süre', value: `${formatTime(song.duration)}`, inline: true },
          { name: '👤 İsteyen', value: song.requestedBy, inline: true },
          { name: '📊 Sıra', value: `#${serverQueue.songs.length}`, inline: true }
        );

      await interaction.editReply({ embeds: [queueEmbed] });
    }
  } catch (error) {
    console.error('Şarkı çalma hatası:', error);
    await interaction.editReply('❌ Şarkı çalınamadı! Geçerli bir YouTube URL\'si girin.');
  }
}

async function handleStopCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  const serverQueue = musicQueue.get(interaction.guild.id);

  if (!voiceChannel) {
    return await interaction.reply('❌ Müzik komutlarını kullanmak için ses kanalında olmalısınız!');
  }

  if (!serverQueue) {
    return await interaction.reply('❌ Şu anda hiç şarkı çalmıyor!');
  }

  serverQueue.songs = [];
  serverQueue.audioPlayer.stop();
  
  try {
    serverQueue.connection.destroy();
  } catch (error) {
    console.error('Bağlantı kapatılırken hata:', error);
  }
  
  musicQueue.delete(interaction.guild.id);
  
  await interaction.reply('⏹️ Müzik durduruldu ve odadan ayrıldım!');
}

async function handleSkipCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  const serverQueue = musicQueue.get(interaction.guild.id);

  if (!voiceChannel) {
    return await interaction.reply('❌ Müzik komutlarını kullanmak için ses kanalında olmalısınız!');
  }

  if (!serverQueue) {
    return await interaction.reply('❌ Şu anda hiç şarkı çalmıyor!');
  }

  serverQueue.audioPlayer.stop();
  await interaction.reply('⏭️ Şarkı atlandı!');
}

async function handleQueueCommand(interaction) {
  const serverQueue = musicQueue.get(interaction.guild.id);

  if (!serverQueue || serverQueue.songs.length === 0) {
    return await interaction.reply('❌ Kuyrukta şarkı yok!');
  }

  const queueString = serverQueue.songs.slice(0, 10).map((song, index) => {
    return `**${index + 1}.** [${song.title}](${song.url}) - ${formatTime(song.duration)} - ${song.requestedBy}`;
  }).join('\n');

  const queueEmbed = new EmbedBuilder()
    .setTitle('📋 Şarkı Kuyruğu')
    .setDescription(queueString)
    .setColor(0x0099FF)
    .setFooter({ text: `Toplam ${serverQueue.songs.length} şarkı`, iconURL: interaction.guild.iconURL() });

  await interaction.reply({ embeds: [queueEmbed] });
}

// Müzik çalma fonksiyonu
function play(guild, song) {
  const serverQueue = musicQueue.get(guild.id);
  if (!song) {
    if (serverQueue.connection) {
      serverQueue.connection.destroy();
    }
    musicQueue.delete(guild.id);
    return;
  }

  try {
    const stream = ytdl(song.url, {
      filter: 'audioonly',
      quality: 'highestaudio'
    });

    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true
    });

    resource.volume.setVolume(serverQueue.volume / 100);
    serverQueue.audioPlayer.play(resource);

    serverQueue.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    });

    serverQueue.audioPlayer.on('error', error => {
      console.error('Müzik oynatıcı hatası:', error);
      serverQueue.textChannel.send('❌ Müzik oynatılırken bir hata oluştu!');
    });

  } catch (error) {
    console.error('Müzik çalma hatası:', error);
    serverQueue.textChannel.send('❌ Müzik çalınamadı!');
  }
}

// Zaman formatlama fonksiyonu
function formatTime(seconds) {
  if (isNaN(seconds)) return 'Bilinmiyor';
  
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Bot ses kanalından atıldığında kuyruğu temizle
client.on('voiceStateUpdate', (oldState, newState) => {
  if (oldState.member.id === client.user.id && !newState.channelId) {
    const serverQueue = musicQueue.get(oldState.guild.id);
    if (serverQueue) {
      musicQueue.delete(oldState.guild.id);
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

// Login to Discord with better error handling
client.login(process.env.TOKEN).catch(error => {
  console.error('❌ Discord login failed!');
  console.error('Hata:', error.message);
  console.log('🔍 Lütfen aşağıdakileri kontrol edin:');
  console.log('1. .env dosyasında TOKEN ve CLIENT_ID değerleri doğru mu?');
  console.log('2. Botunuzun Discord Developer Portal\'da intent\'leri açık mı?');
  console.log('3. Bot token\'ı geçerli mi?');
  process.exit(1);
});
