const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, SlashCommandBuilder, Routes, ActivityType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const play = require('play-dl');
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

// Müzik kuyruğu
const queues = new Map();

// Bot ready event
client.once('ready', () => {
  console.log(`🚀 ${client.user.tag} is now online!`);
  console.log(`📊 Serving ${client.guilds.cache.size} servers`);
  
  client.user.setPresence({
    activities: [{ name: 'VossBlade Famq | /help', type: ActivityType.Listening }],
    status: 'online'
  });
});

// Slash Commands (Müzik komutları eklendi)
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

  // Müzik Komutları
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Şarkı çalar.')
    .addStringOption(option =>
      option.setName('şarkı')
        .setDescription('Şarkı ismi veya YouTube linki')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Müziği durdurur ve kanaldan ayrılır.'),

  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Şarkıyı duraklatır.'),

  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Duraklatılan şarkıyı devam ettirir.'),

  new SlashCommandBuilder()
    .setName('next')
    .setDescription('Sıradaki şarkıya geçer.'),

  new SlashCommandBuilder()
    .setName('replay')
    .setDescription('Şarkıyı baştan çalar.'),

  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Şarkı kuyruğunu gösterir.'),

  // Eğlence Komutları
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
            value: '• `/play` - Şarkı çalar\n• `/stop` - Müziği durdurur\n• `/pause` - Duraklatır\n• `/resume` - Devam ettirir\n• `/next` - Sonrakine geçer\n• `/replay` - Baştan çalar\n• `/queue` - Kuyruğu gösterir',
            inline: false
          },
          {
            name: '😄 **Eğlence**',
            value: '• `/avatar` - Avatar gösterir\n• `/serverinfo` - Sunucu bilgisi\n• `/userinfo` - Kullanıcı bilgisi\n• `/kaccm` - Kaç cm olduğunu söyler',
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

    // MÜZİK KOMUTLARI
    else if (commandName === 'play') {
      await handlePlayCommand(interaction);
    }

    else if (commandName === 'stop') {
      await handleStopCommand(interaction);
    }

    else if (commandName === 'pause') {
      await handlePauseCommand(interaction);
    }

    else if (commandName === 'resume') {
      await handleResumeCommand(interaction);
    }

    else if (commandName === 'next') {
      await handleNextCommand(interaction);
    }

    else if (commandName === 'replay') {
      await handleReplayCommand(interaction);
    }

    else if (commandName === 'queue') {
      await handleQueueCommand(interaction);
    }

    // EĞLENCE KOMUTLARI
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

// MÜZİK FONKSİYONLARI

async function handlePlayCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    return interaction.reply({ 
      content: '❌ Müzik çalmak için önce bir ses kanalına katılın!', 
      ephemeral: true 
    });
  }

  const query = interaction.options.getString('şarkı');
  
  try {
    await interaction.deferReply();

    // YouTube'dan şarkı ara
    let videoInfo;
    if (play.yt_validate(query) === 'video') {
      // Doğrudan link
      videoInfo = await play.video_info(query);
    } else {
      // Arama yap
      const search = await play.search(query, { limit: 1 });
      if (!search || search.length === 0) {
        return await interaction.editReply({ content: '❌ Şarkı bulunamadı! Lütfen farklı bir isim deneyin.' });
      }
      videoInfo = await play.video_info(search[0].url);
    }

    const song = {
      title: videoInfo.video_details.title,
      url: videoInfo.video_details.url,
      duration: videoInfo.video_details.durationRaw,
      thumbnail: videoInfo.video_details.thumbnails[0].url,
      requestedBy: interaction.user.tag
    };

    // Kuyruk yapısını al veya oluştur
    let queue = queues.get(interaction.guild.id);
    
    if (!queue) {
      queue = {
        voiceChannel: voiceChannel,
        textChannel: interaction.channel,
        connection: null,
        songs: [],
        player: createAudioPlayer(),
        playing: true
      };
      queues.set(interaction.guild.id, queue);
    }

    // Şarkıyı kuyruğa ekle
    queue.songs.push(song);

    // Bot ses kanalında değilse bağlan
    if (!queue.connection) {
      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: interaction.guild.id,
          adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        
        queue.connection = connection;
        queue.connection.subscribe(queue.player);
        
        // İlk şarkıyı çal
        playSong(interaction.guild.id, queue.songs[0]);
        
        const embed = new EmbedBuilder()
          .setTitle('🎵 Şimdi Oynatılıyor')
          .setDescription(`[${song.title}](${song.url})`)
          .setThumbnail(song.thumbnail)
          .addFields(
            { name: '⏱️ Süre', value: song.duration, inline: true },
            { name: '👤 İsteyen', value: song.requestedBy, inline: true }
          )
          .setColor(0x00FF00)
          .setFooter({ text: 'VossBlade Famq Music' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Ses kanalına bağlanma hatası:', error);
        queues.delete(interaction.guild.id);
        return await interaction.editReply({ content: '❌ Ses kanalına bağlanırken bir hata oluştu!' });
      }
    } else {
      await interaction.editReply(`🎵 **${song.title}** sıraya eklendi! 📝 (Sıra: ${queue.songs.length})`);
    }

  } catch (error) {
    console.error('Play komutu hatası:', error);
    await interaction.editReply({ content: '❌ Şarkı çalınırken beklenmeyen bir hata oluştu!' });
  }
}

function playSong(guildId, song) {
  const queue = queues.get(guildId);
  if (!song) {
    // Kuyruk boşsa bağlantıyı temizle
    if (queue.connection) {
      queue.connection.destroy();
    }
    queues.delete(guildId);
    return;
  }

  try {
    const stream = play.stream(song.url, {
      quality: 0,
      discordPlayerCompatibility: true
    }).then(stream => {
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true
      });
      
      resource.volume.setVolume(0.5);
      queue.player.play(resource);

      queue.player.on(AudioPlayerStatus.Idle, () => {
        queue.songs.shift();
        playSong(guildId, queue.songs[0]);
      });

      queue.player.on('error', error => {
        console.error('Oynatıcı hatası:', error);
        queue.textChannel.send('❌ Şarkı çalınırken bir hata oluştu!');
        queue.songs.shift();
        playSong(guildId, queue.songs[0]);
      });
    });

  } catch (error) {
    console.error('Şarkı çalma hatası:', error);
    queue.textChannel.send('❌ Şarkı çalınırken bir hata oluştu!');
    queue.songs.shift();
    playSong(guildId, queue.songs[0]);
  }
}

async function handleStopCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  const queue = queues.get(interaction.guild.id);
  
  if (!voiceChannel) {
    return interaction.reply({ 
      content: '❌ Müzik komutlarını kullanmak için bir ses kanalında olmalısınız!', 
      ephemeral: true 
    });
  }

  if (!queue) {
    return interaction.reply({ 
      content: '❌ Zaten müzik çalmıyor!', 
      ephemeral: true 
    });
  }

  queue.songs = [];
  queue.player.stop();
  
  if (queue.connection) {
    queue.connection.destroy();
  }
  
  queues.delete(interaction.guild.id);
  await interaction.reply('⏹️ Müzik durduruldu ve kanaldan ayrıldı.');
}

async function handlePauseCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  const queue = queues.get(interaction.guild.id);
  
  if (!voiceChannel) {
    return interaction.reply({ 
      content: '❌ Müzik komutlarını kullanmak için bir ses kanalında olmalısınız!', 
      ephemeral: true 
    });
  }

  if (!queue || !queue.playing) {
    return interaction.reply({ 
      content: '❌ Şu anda çalan bir şarkı yok!', 
      ephemeral: true 
    });
  }

  queue.player.pause();
  queue.playing = false;
  await interaction.reply('⏸️ Şarkı duraklatıldı.');
}

async function handleResumeCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  const queue = queues.get(interaction.guild.id);
  
  if (!voiceChannel) {
    return interaction.reply({ 
      content: '❌ Müzik komutlarını kullanmak için bir ses kanalında olmalısınız!', 
      ephemeral: true 
    });
  }

  if (!queue || queue.playing) {
    return interaction.reply({ 
      content: '❌ Şu anda duraklatılmış bir şarkı yok!', 
      ephemeral: true 
    });
  }

  queue.player.unpause();
  queue.playing = true;
  await interaction.reply('▶️ Şarkı devam ettiriliyor.');
}

async function handleNextCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  const queue = queues.get(interaction.guild.id);
  
  if (!voiceChannel) {
    return interaction.reply({ 
      content: '❌ Müzik komutlarını kullanmak için bir ses kanalında olmalısınız!', 
      ephemeral: true 
    });
  }

  if (!queue || queue.songs.length < 2) {
    return interaction.reply({ 
      content: '❌ Sırada başka şarkı yok!', 
      ephemeral: true 
    });
  }

  queue.player.stop();
  await interaction.reply('⏭️ Sıradaki şarkıya geçiliyor.');
}

async function handleReplayCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  const queue = queues.get(interaction.guild.id);
  
  if (!voiceChannel) {
    return interaction.reply({ 
      content: '❌ Müzik komutlarını kullanmak için bir ses kanalında olmalısınız!', 
      ephemeral: true 
    });
  }

  if (!queue || !queue.songs.length) {
    return interaction.reply({ 
      content: '❌ Şu anda çalan bir şarkı yok!', 
      ephemeral: true 
    });
  }

  const currentSong = queue.songs[0];
  queue.player.stop();
  // Kısa bir gecikme ekleyerek çakışmayı önle
  setTimeout(() => {
    queue.songs.unshift(currentSong);
  }, 100);
  
  await interaction.reply('🔂 Şarkı baştan çalınıyor.');
}

async function handleQueueCommand(interaction) {
  const queue = queues.get(interaction.guild.id);
  
  if (!queue || !queue.songs.length) {
    return interaction.reply({ 
      content: '❌ Kuyrukta şarkı yok!', 
      ephemeral: true 
    });
  }

  const queueList = queue.songs.slice(0, 10).map((song, index) => 
    `**${index + 1}.** [${song.title}](${song.url}) - ${song.requestedBy}`
  ).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📋 Şarkı Kuyruğu')
    .setDescription(queueList)
    .setColor(0x0099FF)
    .setFooter({ text: `Toplam ${queue.songs.length} şarkı` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
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
