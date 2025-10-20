const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, SlashCommandBuilder, Routes, ActivityType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const yts = require('yt-search');
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

// Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ]
});

// Müzik kuyruğu
const musicQueues = new Map();

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

  // Music commands
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Şarkı çalar.')
    .addStringOption(option =>
      option.setName('şarkı')
        .setDescription('Şarkı ismi veya YouTube linki')
        .setRequired(true)),

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
    .setName('stop')
    .setDescription('Müziği durdurur ve kanaldan ayrılır.'),

  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Şarkı kuyruğunu gösterir.'),

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
            value: '• `/play` - Şarkı çalar\n• `/pause` - Duraklatır\n• `/resume` - Devam ettirir\n• `/next` - Sonrakine geçer\n• `/replay` - Baştan çalar\n• `/stop` - Durdurur\n• `/queue` - Kuyruğu gösterir',
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
        .setImage('https://media.discordapp.net/attachments/962353412480069652/1429871003936493579/standard_4.gif?ex=68f7b6a5&is=68f66525&hm=f1bdd34f0f60a3637928f51390113da39e539745ea2bc315a563b3398091bea2&=')
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

    // MÜZİK KOMUTLARI

    // PLAY COMMAND
    else if (commandName === 'play') {
      await handlePlayCommand(interaction);
    }

    // PAUSE COMMAND
    else if (commandName === 'pause') {
      await handlePauseCommand(interaction);
    }

    // RESUME COMMAND
    else if (commandName === 'resume') {
      await handleResumeCommand(interaction);
    }

    // NEXT COMMAND
    else if (commandName === 'next') {
      await handleNextCommand(interaction);
    }

    // REPLAY COMMAND
    else if (commandName === 'replay') {
      await handleReplayCommand(interaction);
    }

    // STOP COMMAND
    else if (commandName === 'stop') {
      await handleStopCommand(interaction);
    }

    // QUEUE COMMAND
    else if (commandName === 'queue') {
      await handleQueueCommand(interaction);
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

    let songInfo;
    
    // YouTube URL kontrolü
    if (ytdl.validateURL(query)) {
      try {
        songInfo = await ytdl.getInfo(query);
      } catch (error) {
        console.error('URL bilgi alma hatası:', error);
        return await interaction.editReply({ content: '❌ Geçersiz YouTube linki!' });
      }
    } else {
      // Şarkı ismiyle arama
      try {
        const searchResults = await yts(query);
        if (!searchResults.videos.length) {
          return await interaction.editReply({ content: '❌ Şarkı bulunamadı! Lütfen farklı bir isim deneyin.' });
        }
        const video = searchResults.videos[0];
        songInfo = await ytdl.getInfo(video.url);
      } catch (error) {
        console.error('Arama hatası:', error);
        return await interaction.editReply({ content: '❌ Şarkı aranırken bir hata oluştu!' });
      }
    }

    const song = {
      title: songInfo.videoDetails.title,
      url: songInfo.videoDetails.video_url,
      duration: formatDuration(songInfo.videoDetails.lengthSeconds),
      thumbnail: songInfo.videoDetails.thumbnails[0].url,
      requestedBy: interaction.user.tag
    };

    // Kuyruk yapısını al veya oluştur
    let queue = musicQueues.get(interaction.guild.id);
    
    if (!queue) {
      queue = {
        voiceChannel: voiceChannel,
        textChannel: interaction.channel,
        connection: null,
        songs: [],
        player: createAudioPlayer(),
        playing: true
      };
      musicQueues.set(interaction.guild.id, queue);
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
        musicQueues.delete(interaction.guild.id);
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
  const queue = musicQueues.get(guildId);
  if (!song) {
    // Kuyruk boşsa bağlantıyı temizle
    if (queue.connection) {
      queue.connection.destroy();
    }
    musicQueues.delete(guildId);
    return;
  }

  try {
    const stream = ytdl(song.url, { 
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25
    });

    const resource = createAudioResource(stream);
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

  } catch (error) {
    console.error('Şarkı çalma hatası:', error);
    queue.textChannel.send('❌ Şarkı çalınırken bir hata oluştu!');
    queue.songs.shift();
    playSong(guildId, queue.songs[0]);
  }
}

async function handlePauseCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  const queue = musicQueues.get(interaction.guild.id);
  
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
  const queue = musicQueues.get(interaction.guild.id);
  
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
  const queue = musicQueues.get(interaction.guild.id);
  
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
  const queue = musicQueues.get(interaction.guild.id);
  
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

async function handleStopCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  const queue = musicQueues.get(interaction.guild.id);
  
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
  
  musicQueues.delete(interaction.guild.id);
  await interaction.reply('⏹️ Müzik durduruldu ve kanaldan ayrıldı.');
}

async function handleQueueCommand(interaction) {
  const queue = musicQueues.get(interaction.guild.id);
  
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

// YARDIMCI FONKSİYONLAR

function formatDuration(seconds) {
  if (!seconds) return 'Bilinmiyor';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

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
