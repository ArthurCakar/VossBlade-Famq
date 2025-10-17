const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, SlashCommandBuilder, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const yts = require('yt-search');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Healthcheck endpoint
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(port, () => {
  console.log(`Express app listening on port ${port}`);
});

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

client.once('ready', () => {
  console.log(`✅ ${client.user.tag} botu aktif!`);
  client.user.setActivity('VossBlade Famq', { type: 'WATCHING' });
});

// Slash Command'leri oluşturma
const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Bot komutlarını gösterir.'),
  
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Belirtilen sayıda mesajı siler.')
    .addIntegerOption(option => 
      option.setName('miktar')
        .setDescription('Silinecek mesaj sayısı')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Kullanıcıyı banlar.')
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
    .setName('music')
    .setDescription('Müzik komutlarını gösterir.'),
  
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Şarkı çalar.')
    .addStringOption(option => 
      option.setName('şarkı')
        .setDescription('Şarkı ismi veya link')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Şarkıyı duraklatır.'),
  
  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Şarkıya devam eder.'),
  
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
].map(command => command.toJSON());

const rest = new (require('discord.js').REST)({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Slash komutları yükleniyor...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('Slash komutları başarıyla yüklendi!');
  } catch (error) {
    console.error(error);
  }
})();

// Komut işleyici
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  try {
    if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setTitle("VossBlade Famq Bot Commands")
        .setDescription("**Moderator**\n- /clear\n- /ban\n\n**Music**\n- /play\n- /pause\n- /resume\n- /next\n- /replay\n- /stop\n- /queue\n- /music\n\n**General**\n- /avatar\n- /serverinfo\n- /userinfo\n- /say\n\n**Bot**\n- /ping")
        .setImage("https://media.discordapp.net/attachments/962353412480069652/1428851964149764166/standard.gif?ex=68f40197&is=68f2b017&hm=b7b73097e5dd8c90fa0d8e2713d86b1402dca891fcc1bbe99de673cda456c666&=")
        .setColor(0x00AE86)
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'clear') {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return interaction.reply({ content: 'Bu komutu kullanmak için "Mesajları Yönet" yetkisine sahip olmalısınız.', ephemeral: true });
      }
      
      const amount = interaction.options.getInteger('miktar');
      
      if (amount < 1 || amount > 100) {
        return interaction.reply({ content: '1 ile 100 arasında bir sayı girmelisiniz.', ephemeral: true });
      }
      
      try {
        await interaction.channel.bulkDelete(amount, true);
        await interaction.reply({ content: `✅ ${amount} mesaj başarıyla silindi.`, ephemeral: true });
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Mesajlar silinirken bir hata oluştu.', ephemeral: true });
      }
    }

    else if (commandName === 'ban') {
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers)) {
        return interaction.reply({ content: 'Bu komutu kullanmak için "Üyeleri Yasakla" yetkisine sahip olmalısınız.', ephemeral: true });
      }
      
      const user = interaction.options.getUser('kullanıcı');
      const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi.';
      
      try {
        await interaction.guild.members.ban(user, { reason });
        await interaction.reply({ content: `✅ ${user.tag} başarıyla banlandı. Sebep: ${reason}`, ephemeral: true });
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Kullanıcı banlanırken bir hata oluştu.', ephemeral: true });
      }
    }

    else if (commandName === 'ping') {
      await interaction.reply(`🏓 Pong! Bot gecikmesi: ${client.ws.ping}ms`);
    }

    else if (commandName === 'music') {
      const embed = new EmbedBuilder()
        .setTitle("VossBlade Famq Music Commands")
        .setDescription("/play - Şarkı çalar\n/pause - Şarkıyı duraklatır\n/resume - Şarkıya devam eder\n/next - Sıradaki şarkıya geçer\n/replay - Şarkıyı baştan çalar\n/stop - Müziği durdurur\n/queue - Kuyruğu gösterir")
        .setColor(0x0099FF)
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
    }

    // Müzik komutları
    else if (commandName === 'play') {
      await handlePlayCommand(interaction);
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

    else if (commandName === 'stop') {
      await handleStopCommand(interaction);
    }

    else if (commandName === 'queue') {
      await handleQueueCommand(interaction);
    }

    // Eğlenceli komutlar
    else if (commandName === 'avatar') {
      const user = interaction.options.getUser('kullanıcı') || interaction.user;
      
      const embed = new EmbedBuilder()
        .setTitle(`${user.username} avatarı`)
        .setImage(user.displayAvatarURL({ size: 4096, dynamic: true }))
        .setColor(0x00AE86)
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'serverinfo') {
      const { guild } = interaction;
      
      const embed = new EmbedBuilder()
        .setTitle(`${guild.name} Sunucu Bilgileri`)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .addFields(
          { name: 'Sunucu Sahibi', value: `<@${guild.ownerId}>`, inline: true },
          { name: 'Üye Sayısı', value: `${guild.memberCount}`, inline: true },
          { name: 'Kanal Sayısı', value: `${guild.channels.cache.size}`, inline: true },
          { name: 'Oluşturulma Tarihi', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
          { name: 'Sunucu ID', value: guild.id, inline: true },
          { name: 'Boost Seviyesi', value: `${guild.premiumTier}`, inline: true }
        )
        .setColor(0x0099FF)
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'userinfo') {
      const user = interaction.options.getUser('kullanıcı') || interaction.user;
      const member = interaction.guild.members.cache.get(user.id);
      
      const embed = new EmbedBuilder()
        .setTitle(`${user.username} Kullanıcı Bilgileri`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'Kullanıcı Adı', value: user.tag, inline: true },
          { name: 'ID', value: user.id, inline: true },
          { name: 'Hesap Oluşturulma', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: 'Sunucuya Katılma', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Bilinmiyor', inline: true },
          { name: 'Roller', value: member ? member.roles.cache.map(role => role.toString()).join(', ').substring(0, 1024) || 'Rol yok' : 'Bilinmiyor', inline: false }
        )
        .setColor(0x00AE86)
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'say') {
      const message = interaction.options.getString('mesaj');
      
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return interaction.reply({ content: 'Bu komutu kullanmak için "Mesajları Yönet" yetkisine sahip olmalısınız.', ephemeral: true });
      }
      
      await interaction.reply({ content: 'Mesaj gönderildi!', ephemeral: true });
      await interaction.channel.send(message);
    }

  } catch (error) {
    console.error('Komut işleme hatası:', error);
    if (!interaction.replied) {
      await interaction.reply({ content: 'Komut işlenirken bir hata oluştu!', ephemeral: true });
    }
  }
});

// YouTube'dan şarkı arama fonksiyonu
async function searchYouTube(query) {
  try {
    const searchResult = await yts(query);
    return searchResult.videos.length > 0 ? searchResult.videos[0] : null;
  } catch (error) {
    console.error('YouTube arama hatası:', error);
    return null;
  }
}

// Müzik komutları
async function handlePlayCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ Müzik çalmak için bir ses kanalında olmalısınız!', ephemeral: true });
  }

  const query = interaction.options.getString('şarkı');
  
  try {
    await interaction.deferReply();
    
    let video;
    
    // YouTube URL kontrolü
    if (ytdl.validateURL(query)) {
      try {
        const videoInfo = await ytdl.getInfo(query);
        video = {
          title: videoInfo.videoDetails.title,
          url: videoInfo.videoDetails.video_url,
          duration: videoInfo.videoDetails.lengthSeconds,
          thumbnail: videoInfo.videoDetails.thumbnails[0].url
        };
      } catch (error) {
        console.error('URL bilgi alma hatası:', error);
        return await interaction.editReply({ content: '❌ Geçersiz YouTube linki!' });
      }
    } else {
      // Şarkı ismiyle arama
      video = await searchYouTube(query);
      if (!video) {
        return await interaction.editReply({ content: '❌ Şarkı bulunamadı! Lütfen farklı bir isim veya link deneyin.' });
      }
    }

    // Kuyruk yapısını al veya oluştur
    let queue = queues.get(interaction.guildId);
    
    if (!queue) {
      queue = {
        voiceChannel: voiceChannel,
        textChannel: interaction.channel,
        connection: null,
        songs: [],
        player: createAudioPlayer(),
        playing: true,
        volume: 0.5
      };
      queues.set(interaction.guildId, queue);
    }

    // Şarkıyı kuyruğa ekle
    queue.songs.push({
      title: video.title,
      url: video.url,
      duration: video.duration,
      thumbnail: video.thumbnail,
      requestedBy: interaction.user.tag
    });

    // Eğer bot ses kanalında değilse, bağlan
    if (!queue.connection) {
      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: interaction.guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        
        queue.connection = connection;
        queue.connection.subscribe(queue.player);
        
        // İlk şarkıyı çal
        playSong(interaction.guildId, queue.songs[0]);
        
        const embed = new EmbedBuilder()
          .setTitle('🎵 Şimdi Oynatılıyor')
          .setDescription(`[${video.title}](${video.url})`)
          .setThumbnail(video.thumbnail)
          .addFields(
            { name: 'Süre', value: formatDuration(video.duration), inline: true },
            { name: 'İsteyen', value: interaction.user.tag, inline: true }
          )
          .setColor(0x00FF00);
        
        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Ses kanalına bağlanma hatası:', error);
        queues.delete(interaction.guildId);
        return await interaction.editReply({ content: '❌ Ses kanalına bağlanırken bir hata oluştu!' });
      }
    } else {
      await interaction.editReply(`🎵 **${video.title}** sıraya eklendi! (Sıra: ${queue.songs.length})`);
    }

  } catch (error) {
    console.error('Play komutu hatası:', error);
    await interaction.editReply({ content: '❌ Şarkı çalınırken beklenmeyen bir hata oluştu!' });
  }
}

function playSong(guildId, song) {
  const queue = queues.get(guildId);
  if (!song) {
    if (queue.connection) {
      queue.connection.destroy();
    }
    queues.delete(guildId);
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
  const queue = queues.get(interaction.guildId);
  
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ Müzik komutlarını kullanmak için bir ses kanalında olmalısınız!', ephemeral: true });
  }

  if (!queue || !queue.playing) {
    return interaction.reply({ content: '❌ Şu anda çalan bir şarkı yok!', ephemeral: true });
  }

  queue.player.pause();
  queue.playing = false;
  await interaction.reply('⏸️ Şarkı duraklatıldı.');
}

async function handleResumeCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  const queue = queues.get(interaction.guildId);
  
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ Müzik komutlarını kullanmak için bir ses kanalında olmalısınız!', ephemeral: true });
  }

  if (!queue || queue.playing) {
    return interaction.reply({ content: '❌ Şu anda duraklatılmış bir şarkı yok!', ephemeral: true });
  }

  queue.player.unpause();
  queue.playing = true;
  await interaction.reply('▶️ Şarkı devam ettiriliyor.');
}

async function handleNextCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  const queue = queues.get(interaction.guildId);
  
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ Müzik komutlarını kullanmak için bir ses kanalında olmalısınız!', ephemeral: true });
  }

  if (!queue || queue.songs.length < 2) {
    return interaction.reply({ content: '❌ Sırada başka şarkı yok!', ephemeral: true });
  }

  queue.player.stop();
  await interaction.reply('⏭️ Sıradaki şarkıya geçiliyor.');
}

async function handleReplayCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  const queue = queues.get(interaction.guildId);
  
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ Müzik komutlarını kullanmak için bir ses kanalında olmalısınız!', ephemeral: true });
  }

  if (!queue || !queue.songs.length) {
    return interaction.reply({ content: '❌ Şu anda çalan bir şarkı yok!', ephemeral: true });
  }

  const currentSong = queue.songs[0];
  queue.player.stop();
  setTimeout(() => {
    queue.songs.unshift(currentSong);
  }, 100);
  
  await interaction.reply('🔂 Şarkı baştan çalınıyor.');
}

async function handleStopCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  const queue = queues.get(interaction.guildId);
  
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ Müzik komutlarını kullanmak için bir ses kanalında olmalısınız!', ephemeral: true });
  }

  if (!queue) {
    return interaction.reply({ content: '❌ Zaten müzik çalmıyor!', ephemeral: true });
  }

  queue.songs = [];
  queue.player.stop();
  
  if (queue.connection) {
    queue.connection.destroy();
  }
  
  queues.delete(interaction.guildId);
  await interaction.reply('⏹️ Müzik durduruldu ve kanaldan ayrıldı.');
}

async function handleQueueCommand(interaction) {
  const queue = queues.get(interaction.guildId);
  
  if (!queue || !queue.songs.length) {
    return interaction.reply({ content: '❌ Kuyrukta şarkı yok!', ephemeral: true });
  }

  const queueList = queue.songs.slice(0, 10).map((song, index) => 
    `**${index + 1}.** [${song.title}](${song.url}) - ${song.requestedBy}`
  ).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('🎵 Şarkı Kuyruğu')
    .setDescription(queueList)
    .setColor(0x0099FF)
    .setFooter({ text: `Toplam ${queue.songs.length} şarkı` });

  await interaction.reply({ embeds: [embed] });
}

// Süre formatlama fonksiyonu
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

client.login(process.env.TOKEN);
