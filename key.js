const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Import konfigurasi
const config = require('./config');

// Validasi token
if (!config.BOT_TOKEN || config.BOT_TOKEN === 'TOKEN_BOT_KAMU_DISINI') {
  console.error('❌ ERROR: Silakan isi BOT_TOKEN di file config.js terlebih dahulu!');
  process.exit(1);
}

const bot = new Telegraf(config.BOT_TOKEN);

// Buat folder temp jika belum ada
if (!fs.existsSync(config.TEMP_DIR)) {
  fs.mkdirSync(config.TEMP_DIR, { recursive: true });
}

// Cek apakah user adalah owner
function isOwner(userId) {
  return config.OWNER_ID.includes(Number(userId));
}

// Fungsi upload ke Catbox
async function uploadToCatbox(filePath) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', fs.createReadStream(filePath));

  // Pakai userhash jika tersedia
  if (config.USERHASH && config.USERHASH.trim() !== '') {
    form.append('userhash', config.USERHASH.trim());
  }

  try {
    const response = await axios.post('https://catbox.moe/user/api.php', form, {
      headers: {
        ...form.getHeaders(),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: config.UPLOAD_TIMEOUT,
      validateStatus: () => true, // biar kita bisa lihat error dari server
    });

    // Catbox mengembalikan link jika berhasil, atau teks error jika gagal
    const result = (response.data || '').toString().trim();

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${result}`);
    }

    // Kalau hasilnya bukan link, berarti error
    if (!result.startsWith('https://')) {
      throw new Error(result || 'Response tidak valid dari Catbox');
    }

    return result;
  } catch (err) {
    // Perjelas error
    if (err.code === 'ECONNABORTED') {
      throw new Error('Timeout saat menghubungi Catbox');
    }
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      throw new Error('Tidak bisa terhubung ke Catbox (cek koneksi server)');
    }
    throw err;
  }
}

// Fungsi untuk mendapatkan file dari berbagai jenis pesan
function getFileFromMessage(ctx) {
  const message = ctx.message;

  if (message.photo) {
    const photo = message.photo[message.photo.length - 1];
    return {
      fileId: photo.file_id,
      fileName: `${photo.file_id}.jpg`,
      fileSize: photo.file_size || 0,
      type: 'photo'
    };
  }

  if (message.video) {
    return {
      fileId: message.video.file_id,
      fileName: message.video.file_name || `${message.video.file_id}.mp4`,
      fileSize: message.video.file_size || 0,
      type: 'video'
    };
  }

  if (message.document) {
    return {
      fileId: message.document.file_id,
      fileName: message.document.file_name || `${message.document.file_id}`,
      fileSize: message.document.file_size || 0,
      type: 'document'
    };
  }

  if (message.audio) {
    return {
      fileId: message.audio.file_id,
      fileName: message.audio.file_name || `${message.audio.file_id}.mp3`,
      fileSize: message.audio.file_size || 0,
      type: 'audio'
    };
  }

  if (message.voice) {
    return {
      fileId: message.voice.file_id,
      fileName: `${message.voice.file_id}.ogg`,
      fileSize: message.voice.file_size || 0,
      type: 'voice'
    };
  }

  if (message.animation) {
    return {
      fileId: message.animation.file_id,
      fileName: message.animation.file_name || `${message.animation.file_id}.gif`,
      fileSize: message.animation.file_size || 0,
      type: 'animation'
    };
  }

  if (message.sticker) {
    return {
      fileId: message.sticker.file_id,
      fileName: `${message.sticker.file_id}.webp`,
      fileSize: message.sticker.file_size || 0,
      type: 'sticker'
    };
  }

  return null;
}

// Handler utama
bot.on(['photo', 'video', 'document', 'audio', 'voice', 'animation', 'sticker'], async (ctx) => {
  let statusMsg = null;
  let filePath = null;

  try {
    const fileInfo = getFileFromMessage(ctx);
    if (!fileInfo) {
      return ctx.reply(config.MESSAGES.UNSUPPORTED);
    }

    // Cek ukuran
    if (fileInfo.fileSize > config.MAX_FILE_SIZE) {
      return ctx.reply(config.MESSAGES.FILE_TOO_LARGE);
    }

    statusMsg = await ctx.reply(config.MESSAGES.DOWNLOADING);

    // Download dari Telegram
    const fileLink = await ctx.telegram.getFileLink(fileInfo.fileId);
    filePath = path.join(config.TEMP_DIR, fileInfo.fileName);

    const response = await axios({
      url: fileLink.href,
      method: 'GET',
      responseType: 'stream',
      timeout: config.DOWNLOAD_TIMEOUT,
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Cek apakah file berhasil didownload
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('File yang didownload kosong');
    }

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      config.MESSAGES.UPLOADING
    );

    // Upload ke Catbox
    const catboxLink = await uploadToCatbox(filePath);

    // Hapus file sementara
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🗑 Hapus Pesan', `delete_${statusMsg.message_id}`)]
    ]);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `${config.MESSAGES.SUCCESS}\n\n🔗 ${catboxLink}\n\n📁 Tipe: ${fileInfo.type}`,
      keyboard
    );

  } catch (error) {
    console.error('=== ERROR DETAIL ===');
    console.error(error);

    // Hapus file sementara
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }

    let errorMsg = config.MESSAGES.FAILED;

    if (error.message.includes('Timeout') || error.message.includes('timeout')) {
      errorMsg = config.MESSAGES.TIMEOUT;
    } else if (error.message) {
      // Tampilkan error asli biar lebih mudah debug
      errorMsg = `❌ Gagal: ${error.message}`;
    }

    if (statusMsg) {
      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          null,
          errorMsg
        );
      } catch (e) {
        await ctx.reply(errorMsg);
      }
    } else {
      await ctx.reply(errorMsg);
    }
  }
});

// Tombol Hapus Pesan
bot.action(/delete_(\d+)/, async (ctx) => {
  try {
    const messageId = parseInt(ctx.match[1]);
    await ctx.telegram.deleteMessage(ctx.chat.id, messageId);
    await ctx.answerCbQuery('Pesan dihapus');
  } catch (err) {
    await ctx.answerCbQuery('Gagal menghapus pesan');
  }
});

// Command
bot.start((ctx) => {
  ctx.reply(config.MESSAGES.START, { parse_mode: 'Markdown' });
});

bot.help((ctx) => {
  ctx.reply(config.MESSAGES.HELP, { parse_mode: 'Markdown' });
});

bot.command('owner', (ctx) => {
  if (!isOwner(ctx.from.id)) {
    return ctx.reply(config.MESSAGES.ONLY_OWNER);
  }
  ctx.reply('✅ Kamu adalah Owner bot ini.');
});

// Jalankan bot
bot.launch();
console.log('🚀 Bot Catbox Uploader sedang berjalan...');
console.log(`👤 Owner ID : ${config.OWNER_ID.join(', ')}`);
console.log(`🔑 Userhash : ${config.USERHASH ? 'Terpasang' : 'Anonim'}`);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
