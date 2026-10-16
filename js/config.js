/* =====================================================================
   KONFIGURASI FRONTEND — satu-satunya berkas yang perlu Anda ubah.
   ===================================================================== */
window.APP_CONFIG = {
  // URL Web App dari Apps Script (Deploy → Manage deployments → salin URL yang berakhiran /exec)
  GAS_URL: 'https://script.google.com/macros/s/AKfycby5ojzZwXyosH16_tKqoh5AJLqD6c-89QHQ6wotmxn9qVB2ALCQgqgld140t_1UCz2x/exec',

  // Salin dari Execution log setupAppEnvironment() atau sheet AppConfig (baris API_KEY)
  API_KEY: 'rk_2ee95c99149241079f11d26d',

  // Bulan awal tahun akademik (8 = Agustus). Dipakai untuk filter "Tahun Akademik".
  TA_MULAI_BULAN: 8,

  // Berapa lama data di perangkat dianggap segar sebelum dicek ulang ke server (milidetik)
  FRESH_MS: 60000
};
