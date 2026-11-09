// Hanya pengaturan teknis. Jangan menulis sandi di berkas ini.
export const C = {
  APP_VERSION: '1.6.0',
  // Versi kode Apps Script paling tua yang masih dimengerti web ini.
  // Panel Diagnosa menyalakan hijau bila versi backend SAMA ATAU LEBIH BARU.
  VERSI_BACKEND_MIN: '1.5.0',
  API_URL: 'https://script.google.com/macros/s/AKfycbwB8WQ9SwTQe-A7-qbnPbP4vwZklooru5v1IC0bYqtJttAVqcMVG9rDSimzwH8NsV8/exec',
  // Cermin baca. Kunci di bawah memang kunci publik dan boleh terbaca siapa
  // pun: peran anon sudah dicabut dari seluruh tabel reg_*, sehingga tanpa JWT
  // hasil penukaran di Edge Function regulasi-sesi, kunci ini tidak membuka
  // satu baris pun.
  SUPABASE_URL: 'https://dybnqztyxqazhmbywwge.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5Ym5xenR5eHFhemhtYnl3d2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMzQ2MjcsImV4cCI6MjEwODcxMDYyN30.JbH_MR3RUygd1t0Pis9qSgFtLPbekTl1015RzGtLMns',
  STORAGE_KEY: 'yeh_pusat_regulasi'
};

export default C;
