// ====================== KONFIGURASI UTAMA ======================

module.exports = {
  // Token bot dari @BotFather
  BOT_TOKEN: '8863435726:AAH6SeOz6eMM0gmH9E1iFIBjwN1GggZR0Jk',

  // ID Telegram Owner
  OWNER_ID: [
    1814157380, // Ganti dengan ID kamu
  ],

  // Userhash Catbox (dari https://catbox.moe/user/manage.php)
  // Biarkan kosong '' jika ingin upload anonim
  USERHASH: '700824b02661458ef396ff667',

  // Maksimal ukuran file (dalam bytes) - Catbox limit 200MB
  MAX_FILE_SIZE: 200 * 1024 * 1024,

  // Folder sementara
  TEMP_DIR: './temp',

  // Timeout
  UPLOAD_TIMEOUT: 180000,   // 3 menit
  DOWNLOAD_TIMEOUT: 90000,  // 1.5 menit

  // Pesan-pesan bot
  MESSAGES: {
    START: `Halo! 👋

SAYA ADALAH ASISTEN KEY *KIRIMKAN FILE APA SAJA YANG SUPPORT CATBOX *.
Saya akan upload ke Catbox dan kirimkan link-nya.

📌 Maksimal ukuran file: *200 MB*`,

    HELP: `📖 *Cara Penggunaan:*

1. Kirim file (foto/video/dokumen/dll) ke bot ini
2. Tunggu proses upload
3. Dapatkan link Catbox-nya

Fitur:
• Support hampir semua jenis file
• Limit 200MB
• Tombol Hapus Pesan
• Progress status`,

    DOWNLOADING: '⏳ Mengunduh file...',
    UPLOADING: '📤 Sedang mengupload ke Catbox...',
    SUCCESS: '✅ Upload berhasil!',
    FILE_TOO_LARGE: '❌ File terlalu besar!\nMaksimal yang diizinkan: 200 MB',
    UNSUPPORTED: '❌ Jenis file tidak didukung.',
    TIMEOUT: '❌ Timeout saat mengupload. Coba file yang lebih kecil.',
    FAILED: '❌ Gagal mengupload file. Silakan coba lagi.',
    ONLY_OWNER: '❌ Perintah ini hanya untuk Owner.',
  }
};
