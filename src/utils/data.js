// Olah data mentah dari Sheet menjadi peta & turunan yang dipakai layar.
import { hariIni, kunciTanggal, selisihHari, teks, namaPendek, tglPanjang, rentangJam, tgl, tambahHari } from './format';

export const KOSONG = { isu: [], rapat: [], orang: [], itemRapat: [], itemArahan: [], tautanDokumen: [], notulen: [], tindakLanjut: [], arahan: [], opsi: [], surat: [] };

export const BAWAAN = {
  STATUS_TL: ['Belum Dimulai', 'Progress', 'Selesai', 'Dibatalkan'],
  STATUS_ISU: ['Isu Awal', 'Dalam Pengembangan', 'Siap Dibahas', 'Dijadwalkan', 'Dalam Pembahasan', 'Menunggu Keputusan', 'Ditindaklanjuti', 'Selesai', 'Ditunda', 'Dibatalkan'],
  STATUS_RAPAT: ['Draft', 'Dijadwalkan', 'Selesai', 'Dibatalkan'],
  PRIORITAS: ['Rendah', 'Sedang', 'Tinggi', 'Kritis'],
  PENANDA: ['Perlu Keputusan', 'Perlu Dibahas', 'Perlu Revisi', 'Menunggu Dokumen'],
  STATUS_PEMBAHASAN: ['Belum Dibahas', 'Dibahas', 'Diputuskan', 'Ditunda', 'Tidak Dilanjutkan'],
  KATEGORI_ISU: ['Legal', 'Keuangan', 'SDM', 'Akademik', 'Operasional', 'Tata Kelola', 'Lainnya'],
  JENIS_RAPAT: ['Rapat Pembina', 'Rapat Pengurus', 'Rapat Pengawas', 'Rapat Gabungan', 'Rapat Koordinasi', 'Rapat Unit', 'Lainnya'],
  JENIS_DOKUMEN: ['Draft', 'Referensi', 'Lampiran', 'Kajian', 'Output', 'Final'],
  LEMBAGA: ['YEH', 'UNEKA', 'YEH & UNEKA'],
  FORUM_ARAHAN: ['Rapat pimpinan', 'Rapat internal unit', 'Diskusi lisan', 'Kunjungan lapangan', 'WhatsApp', 'Telepon', 'Disposisi surat', 'Lain-lain'],
  SIFAT_ARAHAN: ['Arahan/Instruksi', 'Informasi', 'Gagasan belum final', 'Peringatan'],
  STATUS_ARAHAN: ['Belum ditindaklanjuti', 'Sedang dikerjakan', 'Selesai', 'Tidak perlu tindakan'],
  MODE_RAPAT: ['Luring', 'Daring', 'Hibrida'],
  TEMPAT_RAPAT: ['Kantor YEH Surabaya', 'Kampus UNEKA Palangka Raya', 'Zoom', 'Google Meet'],
  JENIS_HASIL_TL: ['Aksi saja', 'Menghasilkan surat'],
  ARAH_SURAT: ['Masuk', 'Keluar'],
  SIFAT_SURAT: ['Perlu tindakan', 'Untuk diketahui', 'Tembusan', 'Arsip rutin'],
  JENIS_SURAT: ['Surat', 'Surat Tugas', 'Surat Permohonan', 'Surat Usulan', 'Surat Teguran', 'Surat Pernyataan',
    'Surat Lamaran', 'Surat Keterangan', 'Undangan', 'Berita Acara', 'SK', 'PKWT', 'Peraturan', 'Pedoman',
    'Kajian', 'Memo Internal', 'Lainnya'],
  STATUS_SURAT: ['Belum ditindaklanjuti', 'Sedang diproses', 'Sudah dijawab', 'Tidak perlu jawaban'],
  TENGGAT_SUMBER: ['Tertulis', 'Diminta'],
  MEDIA_SURAT: ['WAG Keuangan', 'WAG Kepegawaian', 'Email Admin', 'WhatsApp', 'Fisik', 'Lainnya'],
  KELOMPOK_MASALAH: ['Tugas dan izin belajar', 'Pelanggaran kontrak dan ikatan dinas', 'Disiplin, cuti, dan izin',
    'Status kontrak (PKWT ke PKWTT)', 'Lainnya'],
  KEMATANGAN: ['Ada', 'Sebagian', 'Belum'],
  UNIT: ['YEH', 'UNEKA', 'Ketua Yayasan', 'Bendahara Yayasan', 'Finance', 'Accounting', 'Admin', 'Rektor',
    'Wakil Rektor I', 'Wakil Rektor II', 'Wakil Rektor III', 'Ketua Senat Akademik', 'Sekretaris Senat Akademik',
    'Ketua LPPM', 'Bagian Tata Usaha Umum dan Kepegawaian', 'Pihak luar'],
};

/** Pemisah nilai ganda pada satu sel (unit tujuan, unit terkait). Sama dengan Konfigurasi.gs. */
export const PISAH_GANDA = ' | ';
/** Sel unit → array. Nilai lama berkoma tetap utuh sebagai satu butir agar tidak salah pecah. */
export function unitList(v) {
  return teks(v).split(PISAH_GANDA).map((x) => x.trim()).filter(Boolean);
}
export const unitTeks = (list) => (Array.isArray(list) ? list : unitList(list)).join(PISAH_GANDA);
// Tahap yang diatur sistem; tidak ditawarkan untuk dipilih manual.
export const TAHAP_OTOMATIS = ['Dijadwalkan', 'Ditindaklanjuti'];
export const TAHAP_ARSIP = ['Selesai', 'Dibatalkan'];

export const LABEL_STATUS_TL = { 'Belum Dimulai': 'Belum Dimulai', Progress: 'Sedang Dikerjakan', Selesai: 'Selesai', Dibatalkan: 'Dibatalkan' };
export const labelStatusTl = (s) => LABEL_STATUS_TL[s] || s || '—';

/**
 * v6.16.0 — tindak lanjut yang DIBATALKAN (tidak dilanjutkan, wajib beralasan).
 *
 * Dibatalkan berbeda dari Selesai: keduanya sudah tidak perlu dikerjakan
 * ("tuntas"), tetapi hanya Selesai yang dihitung sebagai capaian. Semua
 * pemeriksaan "masih aktif?" memakai tlTuntas, bukan perbandingan langsung
 * dengan 'Selesai', supaya pekerjaan yang dibatalkan tidak muncul sebagai
 * terlambat atau tanpa perkembangan.
 */
export const STATUS_TL_BATAL = 'Dibatalkan';
export const tlBatal = (t) => !!t && teks(t.STATUS) === STATUS_TL_BATAL;
export const tlTuntas = (t) => !!t && (teks(t.STATUS) === 'Selesai' || teks(t.STATUS) === STATUS_TL_BATAL);
/** Pilihan status untuk diubah langsung. Dibatalkan hanya lewat menu ⋯ › Batalkan (wajib alasan). */
export function opsiStatusTl(sekarang) {
  return BAWAAN.STATUS_TL.filter((s) => s !== STATUS_TL_BATAL || s === sekarang).map((s) => ({ value: s, label: labelStatusTl(s) }));
}

/** PIC lain (pendamping) satu tindak lanjut → array nama. Disimpan dengan pemisah ' | '. */
export function picLainList(t) {
  const utama = teks(t && t.PIC).toLowerCase();
  const seen = {};
  return teks(t && t.PIC_LAIN).split(PISAH_GANDA).map((x) => x.trim()).filter((x) => {
    const k = x.toLowerCase();
    if (!x || k === utama || seen[k]) return false; seen[k] = true; return true;
  });
}
/** Semua PIC satu tindak lanjut: utama lebih dahulu, lalu PIC lain. */
export const semuaPic = (t) => (teks(t && t.PIC) ? [teks(t.PIC)] : []).concat(picLainList(t));

export function nadaTahap(s) {
  return ({
    'Isu Awal': 'abu', 'Dalam Pengembangan': 'abu', 'Siap Dibahas': 'biru-muda', Dijadwalkan: 'biru',
    'Dalam Pembahasan': 'pink', 'Menunggu Keputusan': 'kuning', Ditindaklanjuti: 'hijau-muda', Selesai: 'hijau',
    Ditunda: 'redup', Dibatalkan: 'redup',
  })[s] || 'abu';
}
export function nadaStatusTl(s) { return ({ 'Belum Dimulai': 'abu', Progress: 'biru', Selesai: 'hijau', Dibatalkan: 'redup' })[s] || 'abu'; }
export function nadaPrioritas(s) { return ({ Kritis: 'merah', Tinggi: 'kuning', Sedang: 'abu', Rendah: 'redup' })[s] || 'abu'; }
export function nadaStatusArahan(s) {
  return ({ 'Belum ditindaklanjuti': 'abu', 'Sedang dikerjakan': 'biru', Selesai: 'hijau', 'Tidak perlu tindakan': 'redup' })[s] || 'abu';
}
/** Status arahan yang dianggap belum tuntas; dipakai saringan dan blok pantauan Beranda. */
export const ARAHAN_TERBUKA = ['', 'Belum ditindaklanjuti', 'Sedang dikerjakan'];

/* ---------------- Surat ---------------- */
/**
 * Sifat surat yang tidak menuntut tindakan Yayasan; disembunyikan dari tampilan bawaan.
 * v6.17.0 — "Untuk diketahui": SK, edaran, pengumuman, dan sejenisnya. Isinya perlu
 * dibaca dan dijalankan, tetapi tidak perlu dijawab. Berbeda dari Tembusan (salinan
 * surat yang ditujukan ke pihak lain) dan Arsip rutin (administrasi berkala).
 */
export const SIFAT_PASIF = ['Untuk diketahui', 'Tembusan', 'Arsip rutin'];
/** Jenis surat yang lazimnya bersifat "Untuk diketahui"; dipakai sebagai usulan saat mencatat surat baru. */
export const jenisInformatif = (j) => /^(sk|peraturan|pedoman)$|edaran|pengumuman|pemberitahuan|keputusan/i.test(teks(j));
/** Tanggal masuk surat: tanggal diterima, atau tanggal surat bila tanggal diterima belum dicatat. */
export const tanggalMasukSurat = (s) => kunciTanggal(s && s.TANGGAL_DITERIMA) || kunciTanggal(s && s.TANGGAL_SURAT);
/** Tanggal acuan urutan: masuk = tanggal masuk; keluar = tanggal terbit, atau tanggal surat. */
export const tanggalAcuanSurat = (s) => (s && s.ARAH === 'Keluar'
  ? (kunciTanggal(s.TANGGAL_TERBIT) || kunciTanggal(s.TANGGAL_SURAT)) : tanggalMasukSurat(s));
/**
 * Pemeriksa tanggal surat yang janggal — hanya peringatan, tidak pernah menolak.
 * Salah ketik tahun (mis. 2826) membuat surat menempel di puncak daftar.
 */
export function peringatanTanggalSurat(v, hari) {
  const hasil = [];
  const jauh = tambahHari(hari, 30);
  const cek = (nilai, nama) => {
    const k = kunciTanggal(nilai);
    if (!k) {
      // Tahun di luar rentang wajar (mis. 2826) tidak terbaca sebagai tanggal sama sekali.
      if (teks(nilai)) hasil.push(nama + ' ' + teks(nilai) + ' tidak terbaca sebagai tanggal yang wajar');
      return;
    }
    if (k > jauh) hasil.push(nama + ' ' + tgl(k) + ' lebih dari 30 hari ke depan');
    else if (k < '2020-01-01') hasil.push(nama + ' ' + tgl(k) + ' sebelum tahun 2020');
  };
  cek(v.tanggalSurat, 'Tanggal surat');
  if (v.arah !== 'Keluar') {
    cek(v.tanggalDiterima, 'Tanggal diterima');
    const a = kunciTanggal(v.tanggalSurat), b = kunciTanggal(v.tanggalDiterima);
    if (a && b && b < a) hasil.push('tanggal diterima lebih awal dari tanggal surat');
  }
  return hasil;
}
/** Status surat yang dianggap belum tuntas. */
export const SURAT_TERBUKA = ['', 'Belum ditindaklanjuti', 'Sedang diproses'];
export const suratTerbuka = (s) => {
  if (!s || (s.ARAH === 'Keluar' && ['Draft', 'Batal', 'Cadangan'].includes(s.STATUS_PENERBITAN))) return false;
  return SURAT_TERBUKA.indexOf(teks(s.STATUS)) !== -1 && SIFAT_PASIF.indexOf(teks(s.SIFAT)) === -1;
};
/** Siapa yang berkewajiban menjawab surat yang masih terbuka: kita, atau pihak lain. */
export const posisiSurat = (s) => (!suratTerbuka(s) ? '' : (s.ARAH === 'Keluar' ? 'lawan' : 'kita'));
/** Surat sudah punya balasan bila ada surat lain yang menunjuknya lewat ID_SURAT_TERKAIT. */
export function sudahDibalas(daftar, idSurat, kecualiId) {
  const k = teks(idSurat).toUpperCase();
  if (!k) return false;
  const kecuali = teks(kecualiId).toUpperCase();
  return (daftar || []).some((x) => !x._baru && teks(x.ID_SURAT).toUpperCase() !== kecuali
    && teks(x.ID_SURAT_TERKAIT).toUpperCase() === k);
}
export function nadaSifatSurat(s) {
  return ({ 'Perlu tindakan': 'biru', 'Untuk diketahui': 'abu', Tembusan: 'abu', 'Arsip rutin': 'redup' })[s] || 'abu';
}
export function nadaStatusSurat(s) {
  return ({ 'Belum ditindaklanjuti': 'abu', 'Sedang diproses': 'biru', 'Sudah dijawab': 'hijau', 'Tidak perlu jawaban': 'redup' })[s] || 'abu';
}
export function nadaArah(a) { return a === 'Keluar' ? 'pink' : 'biru-muda'; }
export function nadaKematangan(v) { return ({ Ada: 'hijau', Sebagian: 'kuning', Belum: 'merah' })[v] || 'abu'; }
/** Warna tenggat surat: merah lewat, kuning ≤3 hari, abu selebihnya. */
export function urgensiSurat(s, hari, batasKuning = 3) {
  if (!suratTerbuka(s)) return 'hijau';
  const t = kunciTanggal(s.TENGGAT_JAWAB);
  if (!t) return 'abu';
  const n = selisihHari(t, hari);
  if (n < 0) return 'merah';
  if (n <= batasKuning) return 'kuning';
  return 'abu';
}
/** Pokok bahasan boleh ditunjuk beberapa surat; satu surat boleh menunjuk beberapa pokok bahasan. */
export const isuSurat = (s) => teks(s && s.ID_ISU).split(PISAH_GANDA).map((x) => x.trim()).filter(Boolean);
export function suratPokok(d, idIsu) {
  const k = teks(idIsu).toUpperCase();
  return (d.surat || []).filter((s) => isuSurat(s).some((x) => x.toUpperCase() === k));
}
export function suratTl(d, idTl) {
  const k = teks(idTl).toUpperCase();
  return (d.surat || []).filter((s) => teks(s.ID_TINDAKLANJUT).toUpperCase() === k);
}
export function nadaPembahasan(s) { return ({ Diputuskan: 'hijau', Dibahas: 'biru-muda', Ditunda: 'kuning', 'Tidak Dilanjutkan': 'redup' })[s] || 'abu'; }

/**
 * Parameter aplikasi dari Config_Opsi.
 *
 * Nilai di bawah dahulu dihardcode di berkas-berkas layar, sehingga mengubah
 * nama aplikasi atau satu ambang menuntut revisi kode. Sekarang semuanya satu
 * baris di Config_Opsi dan dapat diubah dari Pengaturan > Parameter Aplikasi.
 * Daftar bawaan di sini tetap diperlukan sebagai jatuh balik: aplikasi harus
 * utuh walau barisnya belum pernah dibuat.
 *
 * Pola nomor surat SENGAJA tidak ada di sini; ia dipakai mendeteksi nomor ganda
 * dan nomor salah ketik pada 400-an surat, jadi satu salah ketik di layar akan
 * merusak usulan nomor seluruh tahun berjalan.
 */
export const PARAM_BAWAAN = {
  APP_NAMA: 'Rapat & Tindak Lanjut',
  APP_SUBJUDUL: 'Yayasan Eka Harap · UNEKA',
  LEMBAGA_BAWAAN: 'YEH',
  URGENSI_KUNING_HARI: '3',
  RENTANG_PETA: '7,14,30',
  BATAS_KARTU_SELESAI: '8',
};
/** Satu baris Config_Opsi berisi nilai teks. Baris ganda diabaikan, bawaan dipakai. */
export function parameterTeks(data, kunci, bawaan) {
  const baris = (data.opsi || []).filter((r) => teks(r.KUNCI).toUpperCase() === kunci && teks(r.AKTIF) !== 'Tidak');
  const nilai = baris.length === 1 ? teks(baris[0].NILAI) : '';
  return nilai || (bawaan !== undefined ? bawaan : PARAM_BAWAAN[kunci]) || '';
}
/** "7,14,30" -> [7,14,30]. Nilai tak sah jatuh ke bawaan. */
export function parameterDeret(data, kunci, bawaan) {
  const mentah = parameterTeks(data, kunci, '');
  const deret = mentah.split(',').map((x) => Number(teks(x))).filter((n) => Number.isInteger(n) && n >= 1 && n <= 90);
  return deret.length ? deret : bawaan;
}

/**
 * Di mana setiap daftar pilihan benar-benar dipakai. Cermin dari PEMAKAI_OPSI_
 * di Simpan.gs; keduanya harus tetap sama. Layar memakainya untuk menampilkan
 * jumlah pemakaian, dan server MEMERIKSA ULANG sebelum menghapus — angka di
 * layar tidak pernah menjadi dasar penghapusan.
 *
 * pemisah: '' satu nilai per sel, ' | ' dan ',' sel bernilai ganda.
 * Kunci yang tidak terdaftar di sini mengembalikan -1: pemakaiannya tidak dapat
 * dihitung, jadi nilainya tidak boleh dihapus — hanya dinonaktifkan.
 */
export const PEMAKAI_OPSI = {
  KATEGORI_ISU: [['isu', 'KATEGORI', ''], ['surat', 'KATEGORI', '']],
  STATUS_ISU: [['isu', 'STATUS_ISU', '']],
  PRIORITAS: [['isu', 'PRIORITAS', '']],
  KELOMPOK_MASALAH: [['isu', 'KELOMPOK_MASALAH', '']],
  KEMATANGAN: [['isu', 'ATURAN_ADA', ''], ['isu', 'PENCEGAHAN_ADA', '']],
  PENANDA: [['isu', 'PENANDA', ','], ['tindakLanjut', 'PENANDA', ',']],
  STATUS_TL: [['tindakLanjut', 'STATUS', '']],
  JENIS_RAPAT: [['rapat', 'JENIS_RAPAT', '']],
  STATUS_RAPAT: [['rapat', 'STATUS', '']],
  JENIS_SURAT: [['surat', 'JENIS', '']],
  SIFAT_SURAT: [['surat', 'SIFAT', '']],
  MEDIA_SURAT: [['surat', 'MEDIA', '']],
  STATUS_SURAT: [['surat', 'STATUS', '']],
  ARAH_SURAT: [['surat', 'ARAH', '']],
  TENGGAT_SUMBER: [['surat', 'TENGGAT_SUMBER', '']],
  LEMBAGA: [['arahan', 'LEMBAGA', '']],
  FORUM_ARAHAN: [['arahan', 'FORUM', '']],
  SIFAT_ARAHAN: [['arahan', 'SIFAT', '']],
  STATUS_ARAHAN: [['arahan', 'STATUS', '']],
  JENIS_DOKUMEN: [['tautanDokumen', 'JENIS_DOKUMEN', '']],
  UNIT: [['orang', 'UNIT', ''], ['isu', 'UNIT_TERKAIT', PISAH_GANDA], ['arahan', 'UNIT_TUJUAN', PISAH_GANDA]],
};
/** Berapa baris memakai satu nilai. -1 bila kuncinya tidak dapat dihitung. */
export function pakaiOpsi(data, kunci, nilai) {
  const tempat = PEMAKAI_OPSI[kunci];
  if (!tempat) return -1;
  const cari = teks(nilai).toLowerCase();
  if (!cari) return -1;
  let n = 0;
  tempat.forEach(([daftar, kolom, pemisah]) => {
    (data[daftar] || []).forEach((b) => {
      if (b._baru) return;
      const isi = teks(b[kolom]);
      if (!isi) return;
      const bagian = pemisah ? isi.split(pemisah) : [isi];
      if (bagian.some((x) => teks(x).toLowerCase() === cari)) n++;
    });
  });
  return n;
}
/** Sheet mana saja yang perlu sudah dimuat agar angkanya benar. */
export function pakaiPerluSurat(kunci) {
  return (PEMAKAI_OPSI[kunci] || []).some(([daftar]) => daftar === 'surat');
}

/** Daftar pilihan: Config_Opsi (aktif, berurutan) + bawaan; nilai lama tetap dapat ditampilkan. */
export function parameterHari(data, kunci, bawaan) {
  const baris = (data.opsi || []).find(r => teks(r.KUNCI).toUpperCase()===kunci && teks(r.AKTIF)!=='Tidak');
  const n = Number(baris && baris.NILAI);
  return Number.isInteger(n) && n >= 1 && n <= 30 ? n : bawaan;
}

export function opsi(data, kunci) {
  const bawaan = BAWAAN[kunci] || [];
  const hasil = [];
  const seen = {};
  const tambah = (v) => { const t = teks(v); if (t && !seen[t.toLowerCase()]) { seen[t.toLowerCase()] = true; hasil.push(t); } };
  (data.opsi || []).filter((r) => teks(r.KUNCI).toUpperCase() === kunci && teks(r.AKTIF) !== 'Tidak')
    .sort((a, b) => (Number(a.URUTAN) || 0) - (Number(b.URUTAN) || 0)).forEach((r) => tambah(r.NILAI));
  bawaan.forEach((v) => {
    const aturan = (data.opsi || []).find((r) => teks(r.KUNCI).toUpperCase() === kunci && teks(r.NILAI).toLowerCase() === teks(v).toLowerCase());
    if (!aturan || teks(aturan.AKTIF) !== 'Tidak') tambah(v);
  });
  return hasil;
}

function petaDari(list, kunci) {
  const p = {};
  list.forEach((x) => { const k = teks(x[kunci]); if (k) p[k] = x; });
  return p;
}

export function urgensi(t, hari, batasDiam = 14, batasKuning = 3) {
  if (tlTuntas(t)) return 'hijau';
  const target = kunciTanggal(t.TANGGAL_TARGET);
  if (target) {
    const n = selisihHari(target, hari);
    if (n < 0) return 'merah';
    if (n <= batasKuning) return 'kuning';
    return 'abu';
  }
  const upd = kunciTanggal(t.TANGGAL_UPDATE_TERAKHIR);
  if (upd) {
    const diam = selisihHari(hari, upd);
    if (diam > batasDiam) return 'merah';
    if (diam > Math.max(1, Math.floor(batasDiam / 2))) return 'kuning';
  }
  return 'abu';
}

export function olah(raw) {
  const d = Object.assign({}, KOSONG, raw || {});
  Object.keys(KOSONG).forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
  const hari = hariIni();
  const batasKuning = Math.max(1, Math.min(14, Number(parameterTeks(d, 'URGENSI_KUNING_HARI')) || 3));
  const anak = {};
  d.tindakLanjut.forEach((t) => { if (t.ID_INDUK) anak[t.ID_INDUK] = (anak[t.ID_INDUK] || 0) + 1; });
  const pTl = petaDari(d.tindakLanjut, 'ID_TINDAKLANJUT');
  d.tindakLanjut = d.tindakLanjut.map((t) => {
    let lvl = 0; let cur = t; const seen = {};
    while (cur && cur.ID_INDUK && lvl < 20 && !seen[cur.ID_TINDAKLANJUT]) { seen[cur.ID_TINDAKLANJUT] = 1; cur = pTl[cur.ID_INDUK]; if (cur) lvl++; }
    return Object.assign({}, t, { URGENSI: urgensi(t, hari, parameterHari(d, 'PENGINGAT_DIAM_HARI', 14), batasKuning), JUMLAH_ANAK: anak[t.ID_TINDAKLANJUT] || 0, TINGKAT: lvl });
  });
  const relArahan = {};
  d.itemArahan.forEach((r) => { const a = teks(r.ID_ARAHAN); (relArahan[a] = relArahan[a] || []).push(teks(r.ID_ISU)); });
  d.arahan = d.arahan.map((a) => Object.assign({}, a, { ID_ISU_LIST: (relArahan[teks(a.ID_ARAHAN)] || []).filter(Boolean) }));
  // v6.7.0 — butir arahan. Baris ItemArahan yang kolom ISI-nya terisi adalah butir;
  // yang kosong tetap kaitan bentuk lama dan tidak ikut ditampilkan sebagai butir.
  d.butirPer = {};
  d.itemArahan.forEach((r) => {
    if (!teks(r.ISI)) return;
    const a = teks(r.ID_ARAHAN);
    (d.butirPer[a] = d.butirPer[a] || []).push(r);
  });
  Object.keys(d.butirPer).forEach((k) => {
    d.butirPer[k].sort((x, y) => (Number(x.URUTAN) || 0) - (Number(y.URUTAN) || 0));
  });
  d.peta = {
    isu: petaDari(d.isu, 'ID_ISU'), rapat: petaDari(d.rapat, 'ID_RAPAT'), notulen: petaDari(d.notulen, 'ID_NOTULEN'),
    tl: petaDari(d.tindakLanjut, 'ID_TINDAKLANJUT'), orang: petaDari(d.orang, 'ID_ORANG'), arahan: petaDari(d.arahan, 'ID_ARAHAN'),
  };
  d.tautanPer = {};
  d.tautanDokumen.forEach((x) => { const k = x.JENIS_ENTITAS + '|' + teks(x.ID_ENTITAS); (d.tautanPer[k] = d.tautanPer[k] || []).push(x); });
  d.agendaPer = {};
  d.itemRapat.forEach((x) => { (d.agendaPer[x.ID_RAPAT] = d.agendaPer[x.ID_RAPAT] || []).push(x); });
  Object.keys(d.agendaPer).forEach((k) => d.agendaPer[k].sort((a, b) => Number(a.URUTAN_AGENDA || 0) - Number(b.URUTAN_AGENDA || 0)));
  d.surat = d.surat.map((s) => Object.assign({}, s, { URGENSI: urgensiSurat(s, hari, batasKuning) }));
  d.peta.surat = petaDari(d.surat, 'ID_SURAT');
  d.hari = hari;
  return d;
}

/** Butir satu arahan, selalu array. */
export function butir(d, idArahan) { return (d.butirPer && d.butirPer[teks(idArahan)]) || []; }

/**
 * Ringkasan ketuntasan butir satu arahan.
 * Butir dianggap tuntas bila ditandai selesai tanpa tindak lanjut, atau bila
 * tindak lanjutnya sudah Selesai — aturan yang sama dengan hitungStatusArahan_
 * di Simpan.gs, supaya angka di layar tidak pernah berbeda dari yang di sheet.
 */
export function ringkasButir(d, idArahan) {
  const list = butir(d, idArahan);
  let tuntas = 0;
  let berTl = 0;
  list.forEach((b) => {
    const st = teks(b.STATUS);
    const idTl = teks(b.ID_TINDAKLANJUT);
    if (idTl) berTl++;
    if (st === 'Selesai tanpa tindak lanjut') { tuntas++; return; }
    if (idTl) {
      const t = d.peta.tl[idTl];
      if (tlTuntas(t)) tuntas++;
    }
  });
  return { jumlah: list.length, tuntas, berTl, sisa: list.length - tuntas };
}

/** Butir dianggap tuntas memakai aturan yang sama dengan backend. */
export function butirTuntas(d, b) {
  const st = teks(b.STATUS);
  if (st === 'Selesai tanpa tindak lanjut') return true;
  const idTl = teks(b.ID_TINDAKLANJUT);
  if (!idTl) return false;
  const t = d.peta.tl[idTl];
  return tlTuntas(t);
}

/**
 * Memecah teks arahan bernomor menjadi calon butir. Hanya dipakai untuk
 * MENGUSULKAN isi editor; hasilnya selalu ditinjau pengguna sebelum disimpan,
 * karena memecah kalimat arahan pimpinan terlalu mahal bila salah tebak.
 */
export function pecahTeksButir(isi) {
  const t = teks(isi);
  if (!t) return [];
  const baris = t.split('\n').map((x) => x.trim()).filter(Boolean);
  const bernomor = baris.filter((b) => /^(\d{1,2}[.)]|[-*•])\s+\S/.test(b));
  if (bernomor.length > 1) {
    return baris.map((b) => b.replace(/^(\d{1,2}[.)]|[-*•])\s+/, '').trim()).filter(Boolean);
  }
  const potong = t.split(/(?:^|\s)(?=\d{1,2}[.)]\s+\S)/).map((x) => x.trim()).filter(Boolean);
  if (potong.length > 1) {
    return potong.map((b) => b.replace(/^\d{1,2}[.)]\s+/, '').trim()).filter(Boolean);
  }
  return [t];
}

/* ---------------- Relasi ---------------- */
export function tautan(d, jenis, id, legacyUrl, legacyJudul) {
  const list = (d.tautanPer[jenis + '|' + teks(id)] || []).map((x) => ({ id: x.ID_TAUTAN, judul: x.JUDUL_TAUTAN, url: x.URL, jenisDokumen: x.JENIS_DOKUMEN, jenisBerkas: x.JENIS_BERKAS || '', catatan: x.CATATAN }));
  if (!list.length && urlAman(legacyUrl)) return [{ judul: legacyJudul || 'Dokumen', url: legacyUrl, jenisDokumen: 'Referensi', catatan: '' }];
  return list;
}
/* ---------------- Jenis berkas (sama dengan Simpan.gs) ---------------- */
export const JENIS_BERKAS = [
  { label: 'Google Doc', kode: 'DOC', kelas: 'doc' }, { label: 'Google Sheet', kode: 'SHEET', kelas: 'sheet' },
  { label: 'Google Slides', kode: 'SLIDE', kelas: 'slide' }, { label: 'Google Form', kode: 'FORM', kelas: 'form' },
  { label: 'Folder Drive', kode: 'FOLDER', kelas: 'folder' }, { label: 'PDF', kode: 'PDF', kelas: 'pdf' },
  { label: 'Gambar', kode: 'IMG', kelas: 'img' }, { label: 'Word', kode: 'WORD', kelas: 'word' },
  { label: 'Excel', kode: 'XLS', kelas: 'xls' }, { label: 'PowerPoint', kode: 'PPT', kelas: 'ppt' },
  { label: 'Video', kode: 'VIDEO', kelas: 'video' }, { label: 'Berkas lain', kode: 'FILE', kelas: 'lain' },
  { label: 'Tautan web', kode: 'WEB', kelas: 'web' },
];
const TAK_TERDETEKSI = { label: 'Berkas Drive', kode: 'DRIVE', kelas: 'tak', tak: true };
function idBerkasDrive(url) {
  const u = teks(url);
  if (!/^https?:\/\/(drive|docs)\.google\.com\//i.test(u)) return '';
  let m = u.match(/\/file\/d\/([\w-]{10,})/);
  if (m) return m[1];
  if (/\/(open|uc)\b/i.test(u)) { m = u.match(/[?&]id=([\w-]{10,})/); if (m) return m[1]; }
  return '';
}
function dariNama(x) {
  const m = String(x || '').toLowerCase().split(/[?#]/)[0].match(/\.([a-z0-9]{2,5})$/);
  const ext = m ? m[1] : '';
  if (ext === 'pdf') return 'PDF';
  if (/^(jpe?g|png|gif|webp|bmp|heic)$/.test(ext)) return 'Gambar';
  if (/^(docx?|odt|rtf)$/.test(ext)) return 'Word';
  if (/^(xlsx?|csv|ods)$/.test(ext)) return 'Excel';
  if (/^(pptx?|odp)$/.test(ext)) return 'PowerPoint';
  if (/^(mp4|mov|avi|mkv|webm)$/.test(ext)) return 'Video';
  return '';
}
export function jenisDariAlamat(url, judul) {
  const u = teks(url).toLowerCase();
  if (!u) return '';
  if (/docs\.google\.com\/document\//.test(u)) return 'Google Doc';
  if (/docs\.google\.com\/spreadsheets\//.test(u)) return 'Google Sheet';
  if (/docs\.google\.com\/presentation\//.test(u)) return 'Google Slides';
  if (/docs\.google\.com\/forms\/|forms\.gle\//.test(u)) return 'Google Form';
  if (/drive\.google\.com\/(drive\/(u\/\d+\/)?folders\/|folderview)/.test(u)) return 'Folder Drive';
  if (/youtube\.com\/|youtu\.be\//.test(u)) return 'Video';
  const a = dariNama(u);
  if (a) return a;
  if (idBerkasDrive(url)) return dariNama(judul);
  return dariNama(judul) || 'Tautan web';
}
/** Jenis berkas untuk tampilan: isian sheet (otomatis/manual) → tebakan dari alamat → "Berkas Drive" (belum terdeteksi). */
export function jenisBerkas(t) {
  const simpan = teks(t && t.jenisBerkas).toLowerCase();
  const tersimpan = JENIS_BERKAS.find((j) => j.label.toLowerCase() === simpan);
  if (tersimpan) return tersimpan;
  const tebak = jenisDariAlamat(t && t.url, t && t.judul);
  return JENIS_BERKAS.find((j) => j.label === tebak) || TAK_TERDETEKSI;
}

export function urlAman(v) {
  const s = teks(v);
  if (!s) return '';
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : ''; } catch (e) { return ''; }
}
export function unik(list) {
  const seen = {};
  return list.filter((l) => { const k = urlAman(l && l.url); if (!k || seen[k]) return false; seen[k] = true; return true; });
}
export function tlUtama(d, idIsu) {
  if (!idIsu) return null;
  return d.tindakLanjut.filter((t) => t.ID_ISU === idIsu && !t.ID_INDUK && !t.ID_ARAHAN_ASAL)
    .sort((a, b) => new Date(b.TANGGAL_UPDATE_TERAKHIR || 0) - new Date(a.TANGGAL_UPDATE_TERAKHIR || 0))[0] || null;
}
export function agendaPokok(d, idIsu) {
  return d.itemRapat.filter((a) => a.ID_ISU === idIsu || (a.JENIS_ITEM === 'Pokok Bahasan' && a.ID_REFERENSI === idIsu));
}
export function arahanPokok(d, idIsu) { return d.arahan.filter((a) => a.ID_ISU_LIST.indexOf(idIsu) !== -1); }
export function tlPokok(d, idIsu) { return d.tindakLanjut.filter((t) => t.ID_ISU === idIsu); }
export function judulAgenda(d, a) {
  if (a.JENIS_ITEM === 'Tindak Lanjut') { const t = d.peta.tl[a.ID_REFERENSI]; return t ? t.JUDUL : 'Tindak lanjut'; }
  const i = d.peta.isu[a.ID_ISU || a.ID_REFERENSI]; return i ? i.JUDUL : 'Pokok bahasan';
}
/**
 * Dokumen milik satu pokok bahasan: dokumennya sendiri, dokumen arahannya, dan
 * dokumen tindak lanjutnya.
 *
 * v6.15.0 — dokumen RAPAT tidak lagi diwariskan. Sampai v6.14.0 setiap dokumen
 * yang ditautkan ke sebuah rapat ikut tampil di SEMUA pokok bahasan yang pernah
 * diagendakan di rapat itu: dokumen standar biaya muncul di isu gaji hanya
 * karena keduanya dibahas pada rapat yang sama. Sebuah dokumen kini tampil di
 * pokok bahasan hanya bila memang ditautkan ke sana (atau ke arahan dan tindak
 * lanjutnya). Notulen rapatnya disediakan terpisah lewat notulenPokok().
 */
export function dokumenPokok(d, idIsu) {
  const list = [].concat(tautan(d, 'Pokok Bahasan', idIsu));
  arahanPokok(d, idIsu).forEach((a) => list.push.apply(list, tautan(d, 'Arahan', a.ID_ARAHAN)));
  tlPokok(d, idIsu).forEach((t) => list.push.apply(list, tautan(d, 'Tindak Lanjut', t.ID_TINDAKLANJUT, t.LINK_DOKUMEN, 'Dokumen/output')));
  return unik(list);
}
/** Notulen rapat yang membahas pokok bahasan ini, berlabel nama dan tanggal rapatnya. */
export function notulenPokok(d, idIsu) {
  const list = [];
  agendaPokok(d, idIsu).forEach((a) => {
    const r = d.peta.rapat[a.ID_RAPAT];
    const n = d.peta.notulen[a.ID_NOTULEN || (r && r.ID_NOTULEN)];
    if (!n) return;
    tautan(d, 'Notulen', n.ID_NOTULEN, n.LINK_DOKUMEN, 'Notulen').forEach((t) => {
      list.push(Object.assign({}, t, { judul: 'Notulen — ' + ((r && r.JUDUL_RAPAT) || n.JUDUL || n.ID_NOTULEN), jenisDokumen: 'Notulen', id: '' }));
    });
  });
  return unik(list);
}

/**
 * Kunci pembanding judul: huruf kecil, tanpa tanda baca. "Logo YEH, dan Guide"
 * dan "Logo YEH dan Guide" harus dianggap judul yang sama. Padanan kunciJudul_
 * di HasilRapat.gs.
 */
export function kunciJudul(s) {
  return teks(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
/** Indeks butir yang judulnya paling cocok; -1 bila tidak ada yang cukup mirip atau ambigu. */
export function cocokJudul(cari, daftar) {
  const k = kunciJudul(cari);
  if (!k) return -1;
  const kunci = daftar.map(kunciJudul);
  let i = kunci.indexOf(k);
  if (i !== -1) return i;
  const muat = kunci.map((x, j) => (x && (x.indexOf(k) !== -1 || k.indexOf(x) !== -1) ? j : -1)).filter((j) => j !== -1);
  if (muat.length === 1) return muat[0];
  // Kemiripan kata: dipakai hanya bila ada SATU calon yang jelas unggul.
  const kata = (x) => x.split(' ').filter((w) => w.length >= 3);
  const a = kata(k);
  if (!a.length) return -1;
  const nilai = kunci.map((x) => { const b = kata(x); if (!b.length) return 0; const sama = a.filter((w) => b.indexOf(w) !== -1).length; return sama / (a.length + b.length - sama); });
  const urut = nilai.map((n, j) => [n, j]).sort((x, y) => y[0] - x[0]);
  if (urut[0] && urut[0][0] >= 0.6 && (!urut[1] || urut[0][0] - urut[1][0] >= 0.2)) return urut[0][1];
  return -1;
}

/** Status tampilan rapat (gabungan status sheet + notulen + tanggal). */
export function statusRapat(r, hari) {
  if (r.ID_NOTULEN) return { kunci: 'selesai', label: 'Selesai', nada: 'hijau' };
  if (r.STATUS === 'Dibatalkan') return { kunci: 'batal', label: 'Dibatalkan', nada: 'redup' };
  if (r.STATUS === 'Draft') return { kunci: 'draft', label: 'Draft', nada: 'abu' };
  const k = kunciTanggal(r.TANGGAL);
  if (r.STATUS === 'Selesai' || (k && k < hari)) return { kunci: 'perlu-hasil', label: 'Perlu hasil', nada: 'kuning' };
  return { kunci: 'mendatang', label: 'Terjadwal', nada: 'biru' };
}

/* ---------------- Orang & PIC ---------------- */
function token(s) { return teks(s).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((x) => x.length >= 3); }
/** Apakah isian PIC (bebas) menunjuk orang ini? "widi" cocok "Titis Widiyanti". */
export function picCocok(pic, orang) {
  if (!pic || !orang) return false;
  const p = teks(pic).toLowerCase();
  const nama = namaPendek(orang.NAMA).toLowerCase();
  if (!p) return false;
  if (p === teks(orang.NAMA).toLowerCase() || p === nama) return true;
  const tp = token(namaPendek(pic));
  const tn = token(nama);
  return tp.length > 0 && tp.every((a) => tn.some((b) => b.indexOf(a) !== -1));
}
export function cariOrang(d, teksNama) {
  const t = teks(teksNama);
  if (!t) return null;
  const persis = d.orang.find((o) => teks(o.NAMA).toLowerCase() === t.toLowerCase() || namaPendek(o.NAMA).toLowerCase() === namaPendek(t).toLowerCase());
  if (persis) return persis;
  const cocok = d.orang.filter((o) => picCocok(t, o));
  return cocok.length === 1 ? cocok[0] : null;
}
export function opsiOrang(d) {
  const no = {};
  d.orang.forEach((o, i) => { no[o.ID_ORANG] = i; });
  return d.orang.filter((o) => o.STATUS !== 'Nonaktif').slice().sort((a, b) => namaPendek(a.NAMA).localeCompare(namaPendek(b.NAMA)))
    .map((o) => ({ value: o.NAMA, label: namaPendek(o.NAMA), meta: [o.JABATAN, o.UNIT].filter(Boolean).join(' · '), cari: [o.NAMA, o.JABATAN, o.UNIT].join(' '), id: o.ID_ORANG,
      jabatan: teks(o.JABATAN), unit: teks(o.UNIT), no: no[o.ID_ORANG] }));
}

/**
 * Kelompokkan orang per UNIT. Urutan unit mengikuti urutan baris pertama unit itu di DaftarOrang;
 * beda huruf besar-kecil/spasi dianggap sama; UNIT kosong masuk "Lainnya" (paling akhir).
 * items: [{ unit, no, ... }] → [{ kunci, label, items }]
 */
export function kelompokUnit(items) {
  const peta = {};
  const urut = [];
  items.forEach((x) => {
    const u = teks(x.unit);
    const k = u ? u.replace(/\s+/g, ' ').toUpperCase() : '~LAINNYA';
    if (!peta[k]) { peta[k] = { kunci: k, label: u || 'Lainnya', items: [], no: Infinity }; urut.push(peta[k]); }
    peta[k].items.push(x);
    const n = typeof x.no === 'number' ? x.no : Infinity;
    if (n < peta[k].no) { peta[k].no = n; if (u) peta[k].label = u; } // ejaan unit mengikuti baris teratas di DaftarOrang
  });
  return urut.sort((a, b) => (a.kunci === '~LAINNYA') - (b.kunci === '~LAINNYA') || a.no - b.no || a.label.localeCompare(b.label));
}

/** Peserta rapat (ID_PESERTA) sebagai daftar orang lengkap untuk tampilan. */
export function pesertaRapat(d, r) {
  const no = {};
  d.orang.forEach((o, i) => { no[o.ID_ORANG] = i; });
  return String(r.ID_PESERTA || '').split(',').map((s) => s.trim()).filter(Boolean).map((id) => {
    const x = d.peta.orang[id];
    return x ? { id, nama: x.NAMA, jabatan: teks(x.JABATAN), unit: teks(x.UNIT), no: no[id] } : { id, nama: id, jabatan: '', unit: '', no: Infinity };
  });
}
export function opsiOrangId(d) {
  return opsiOrang(d).map((o) => Object.assign({}, o, { value: o.id }));
}

/* ---------------- Bahan notulen untuk /susun-notulen ---------------- */
export function bahanNotulen(d, r) {
  const o = (id, cadangan) => { const x = d.peta.orang[id]; return x ? x.NAMA + (x.JABATAN ? ' (' + x.JABATAN + ')' : '') : (cadangan || '[perlu dilengkapi]'); };
  const peserta = String(r.ID_PESERTA || '').split(',').map((s) => s.trim()).filter(Boolean).map((id) => o(id, id));
  const agenda = d.agendaPer[r.ID_RAPAT] || [];
  const baris = [
    'BAHAN NOTULEN — ' + r.JUDUL_RAPAT,
    '',
    'Hari / Tanggal : ' + tglPanjang(r.TANGGAL),
    'Jam            : ' + (rentangJam(r) ? rentangJam(r) + ' WIB' : '[perlu dilengkapi]'),
    'Jenis rapat    : ' + (r.JENIS_RAPAT || '-'),
    'Sifat pertemuan: ' + (r.MODE || 'Luring'),
    'Tempat         : ' + (teks(r.TEMPAT) || '[perlu dilengkapi]'),
    'Tautan daring  : ' + (teks(r.TAUTAN_RAPAT) || '-'),
    'Pimpinan rapat : ' + o(r.ID_PIMPINAN, r.PIMPINAN_RAPAT),
    'Notulis rapat  : ' + o(r.ID_NOTULIS, r.NOTULIS),
    'Peserta rapat  : ' + (peserta.length ? peserta.join('; ') : (r.PESERTA || 'Sesuai lampiran daftar kehadiran')),
    '',
    'Agenda rapat (Kode Agenda — Pokok Bahasan):',
  ];
  agenda.forEach((a, i) => baris.push((i + 1) + '. ' + a.ID_ITEM_RAPAT + ' — ' + judulAgenda(d, a) + (teks(a.SUSULAN) ? ' [selipan, dicatat setelah notulen terbit]' : '')));
  if (!agenda.length) baris.push('(belum ada agenda; isi Kode Agenda dengan "-")');
  baris.push('', 'Wajib: di akhir notulen tambahkan tabel "LAMPIRAN — RINGKASAN KEPUTUSAN DAN TINDAK LANJUT" dengan kolom',
    'Kode Agenda | Pokok Bahasan | Ringkasan Pembahasan | Keputusan | Tindak Lanjut | PIC | Target',
    'Satu baris untuk satu tindak lanjut. Target ditulis dd/mm/yyyy. PIC ditulis nama lengkap.');
  return baris.join('\n');
}

export function salinTeks(t) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); resolve(); } catch (e) { reject(e); } finally { document.body.removeChild(ta); }
  });
}
