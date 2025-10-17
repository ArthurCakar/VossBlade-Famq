const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, Routes, Collection } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');
const play = require('play-dl');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Healthcheck endpoint - Render'ın botu canlı tutması için
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
const queue = new Map();

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
  
  // Eğlenceli komutlar
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

  if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setTitle("VossBlade Famq Bot Commands")
      .setDescription("**Moderator**\n- /clear\n- /ban\n\n**General**\n- /music (müzik komutları)\n\n**Bot**\n- /ping")
      .setImage("https://media.discordapp.net/attachments/962353412480069652/1428851964149764166/standard.gif?ex=68f40197&is=68f2b017&hm=b7b73097e5dd8c90fa0d8e2713d86b1402dca891fcc1bbe99de673cda456c666&=")
      .setColor(0x00AE86)
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'clear') {
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

  if (commandName === 'ban') {
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

  if (commandName === 'ping') {
    await interaction.reply(`🏓 Pong! Bot gecikmesi: ${client.ws.ping}ms`);
  }

  if (commandName === 'music') {
    const embed = new EmbedBuilder()
      .setTitle("VossBlade Famq Music Commands")
      .setDescription("/play\n/pause\n/resume\n/next\n/replay")
      .setColor(0x0099FF)
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }

  // Müzik komutları
  if (commandName === 'play') {
    await handlePlayCommand(interaction);
  }

  if (commandName === 'pause') {
    await handlePauseCommand(interaction);
  }

  if (commandName === 'resume') {
    await handleResumeCommand(interaction);
  }

  if (commandName === 'next') {
    await handleNextCommand(interaction);
  }

  if (commandName === 'replay') {
    await handleReplayCommand(interaction);
  }

  // Eğlenceli komutlar
  if (commandName === 'avatar') {
    const user = interaction.options.getUser('kullanıcı') || interaction.user;
    
    const embed = new EmbedBuilder()
      .setTitle(`${user.username} avatarı`)
      .setImage(user.displayAvatarURL({ size: 4096, dynamic: true }))
      .setColor(0x00AE86)
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'serverinfo') {
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

  if (commandName === 'userinfo') {
    const user = interaction.options.getUser('kullanıcı') || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);
    
    const embed = new EmbedBuilder()
      .setTitle(`${user.username} Kullanıcı Bilgileri`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Kullanıcı Adı', value: user.tag, inline: true },
        { name: 'ID', value: user.id, inline: true },
        { name: 'Hesap Oluşturulma', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Sunucuya Katılma', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: 'Roller', value: member.roles.cache.map(role => role.toString()).join(', '), inline: false }
      )
      .setColor(0x00AE86)
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }
});

// Müzik komutları için fonksiyonlar
async function handlePlayCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ Müzik çalmak için bir ses kanalında olmalısınız!', ephemeral: true });
  }

  const song = interaction.options.getString('şarkı');
  
  try {
    // Kuyruk yapısını al veya oluştur
    const serverQueue = queue.get(interaction.guildId);
    if (!serverQueue) {
      const queueConstruct = {
        textChannel: interaction.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        player: null,
        playing: false,
      };
      queue.set(interaction.guildId, queueConstruct);
      queueConstruct.songs.push(song);

      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: interaction.guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        queueConstruct.connection = connection;
        playSong(interaction.guildId, queueConstruct.songs[0], interaction);
        await interaction.reply(`🎵 Şarkı sıraya eklendi: **${song}**`);
      } catch (error) {
        console.error(error);
        queue.delete(interaction.guildId);
        return interaction.reply({ content: '❌ Ses kanalına katılırken bir hata oluştu!', ephemeral: true });
      }
    } else {
      serverQueue.songs.push(song);
      await interaction.reply(`🎵 Şarkı sıraya eklendi: **${song}**`);
    }
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: '❌ Şarkı çalınırken bir hata oluştu!', ephemeral: true });
  }
}

async function playSong(guildId, song, interaction) {
  const serverQueue = queue.get(guildId);
  if (!song) {
    serverQueue.connection.destroy();
    queue.delete(guildId);
    return;
  }

  try {
    const stream = await play.stream(song);
    const resource = createAudioResource(stream.stream, { inputType: stream.type });
    
    if (!serverQueue.player) {
      serverQueue.player = createAudioPlayer();
      serverQueue.connection.subscribe(serverQueue.player);
    }
    
    serverQueue.player.play(resource);
    serverQueue.playing = true;

    serverQueue.player.on(AudioPlayerStatus.Idle, () => {
      serverQueue.songs.shift();
      playSong(guildId, serverQueue.songs[0], interaction);
    });

  } catch (error) {
    console.error(error);
    serverQueue.textChannel.send('❌ Şarkı çalınırken bir hata oluştu!');
    serverQueue.songs.shift();
    playSong(guildId, serverQueue.songs[0], interaction);
  }
}

async function handlePauseCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ Müzik komutlarını kullanmak için bir ses kanalında olmalısınız!', ephemeral: true });
  }

  const serverQueue = queue.get(interaction.guildId);
  if (!serverQueue || !serverQueue.playing) {
    return interaction.reply({ content: '❌ Şu anda çalan bir şarkı yok!', ephemeral: true });
  }

  serverQueue.player.pause();
  await interaction.reply('⏸️ Şarkı duraklatıldı.');
}

async function handleResumeCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ Müzik komutlarını kullanmak için bir ses kanalında olmalısınız!', ephemeral: true });
  }

  const serverQueue = queue.get(interaction.guildId);
  if (!serverQueue || !serverQueue.player) {
    return interaction.reply({ content: '❌ Şu anda duraklatılmış bir şarkı yok!', ephemeral: true });
  }

  serverQueue.player.unpause();
  await interaction.reply('▶️ Şarkı devam ettiriliyor.');
}

async function handleNextCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ Müzik komutlarını kullanmak için bir ses kanalında olmalısınız!', ephemeral: true });
  }

  const serverQueue = queue.get(interaction.guildId);
  if (!serverQueue || serverQueue.songs.length < 2) {
    return interaction.reply({ content: '❌ Sırada başka şarkı yok!', ephemeral: true });
  }

  serverQueue.player.stop();
  await interaction.reply('⏭️ Sıradaki şarkıya geçiliyor.');
}

async function handleReplayCommand(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ Müzik komutlarını kullanmak için bir ses kanalında olmalısınız!', ephemeral: true });
  }

  const serverQueue = queue.get(interaction.guildId);
  if (!serverQueue || !serverQueue.songs.length) {
    return interaction.reply({ content: '❌ Şu anda çalan bir şarkı yok!', ephemeral: true });
  }

  // Mevcut şarkıyı baştan çalmak için, player'ı durdurup aynı şarkıyı tekrar oynatıyoruz
  serverQueue.songs.unshift(serverQueue.songs[0]);
  serverQueue.player.stop();
  await interaction.reply('🔂 Şarkı baştan çalınıyor.');
}

client.login(process.env.TOKEN);
