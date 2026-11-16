import React, { useMemo, useState } from 'react';
import * as api from '../api';
import { useApp } from '../konteks';
import { Modal } from '../components/Modal';
import { Field, Lipat } from '../components/Dasar';
import { Pilih, PilihBanyak } from '../components/Pilih';
import EditorTautan, { BarisTautan } from '../components/EditorTautan';
import Ikon from '../components/Ikon';
import { useIsian, useIkutiDataSegar, selisih, GalatForm, Kaki } from './umum';
import { kunciTanggal, hariIni, tgl } from '../utils/format';
import { opsi, tautan, unitList, isuSurat, suratTerbuka, sudahDibalas, tlTuntas, SIFAT_PASIF, jenisInformatif, peringatanTanggalSurat } from '../utils/data';
import { susunRangkaian } from '../utils/korespondensi';

export default function FormSurat({ item, awal, draf, galat }) {
  const { data, tutupForm, kirimForm, toast, boleh } = useApp();
  const edit = !!item;
  // Nilai awal form selalu diambil dari data TERKINI surat itu, bukan dari
  // potret saat tombol Edit ditekan (lihat useIkutiDataSegar di umum.js).
  const sumber = edit ? ((data.peta.surat && data.peta.surat[item.ID_SURAT]) || item) : null;
  const asal = edit ? {
    arah: sumber.ARAH || 'Masuk', sifat: sumber.SIFAT || 'Perlu tindakan', nomorSurat: sumber.NOMOR_SURAT || '',
    jenis: sumber.JENIS || 'Surat', judul: sumber.JUDUL || '', tanggalSurat: kunciTanggal(sumber.TANGGAL_SURAT),
    tanggalDiterima: kunciTanggal(sumber.TANGGAL_DITERIMA), asalTujuan: unitList(sumber.ASAL_TUJUAN),
    kategori: sumber.KATEGORI || '', media: sumber.MEDIA || '', tenggatJawab: kunciTanggal(sumber.TENGGAT_JAWAB),
    tenggatSumber: sumber.TENGGAT_SUMBER || '', status: sumber.STATUS || 'Belum ditindaklanjuti',
    linkDraft: sumber.LINK_DRAFT || '', linkFinal: sumber.LINK_FINAL || '',
    statusPenerbitan: sumber.STATUS_PENERBITAN || (sumber.ARAH === 'Keluar' ? (sumber.LINK_FINAL ? 'Terbit' : sumber.NOMOR_SURAT ? 'Bernomor' : 'Draft') : ''),
    alasanNomor: sumber.ALASAN_NOMOR || '',
    idSuratTerkait: sumber.ID_SURAT_TERKAIT || '', idRangkaian: sumber.ID_RANGKAIAN || '', idRapat: sumber.ID_RAPAT || '', idIsu: isuSurat(sumber), idTindakLanjut: sumber.ID_TINDAKLANJUT || '',
    namaTerkait: sumber.NAMA_TERKAIT || '', catatan: sumber.CATATAN || '', tautan: tautan(data, 'Surat', sumber.ID_SURAT),
    jenisBerkasFinal: sumber.JENIS_BERKAS_FINAL || '',
  } : Object.assign({
    arah: 'Masuk', sifat: 'Perlu tindakan', nomorSurat: '', jenis: 'Surat', judul: '', tanggalSurat: '',
    tanggalDiterima: hariIni(), asalTujuan: [], kategori: '', media: '', tenggatJawab: '', tenggatSumber: '',
    status: 'Belum ditindaklanjuti', statusPenerbitan: 'Draft', alasanNomor: '', linkDraft: '', linkFinal: '', idSuratTerkait: '', idRangkaian: '', idRapat: '', idIsu: [],
    idTindakLanjut: '', namaTerkait: '', catatan: '', tautan: [], jenisBerkasFinal: '',
  }, awal || {});
  const bolehMasuk = boleh('surat_masuk', edit ? 'EDIT' : 'TAMBAH');
  const bolehKeluar = boleh('surat_keluar', edit ? 'EDIT' : 'TAMBAH');
  if (!edit && !awal?.arah && !bolehMasuk && bolehKeluar) asal.arah = 'Keluar';
  const [v, set, setV] = useIsian(asal, draf);
  useIkutiDataSegar(edit, asal, setV);
  const [baca, setBaca] = useState({ status: 'diam' });
  const keluar = v.arah === 'Keluar';
  /*
   * v6.17.0 — sifat dan status saling menyesuaikan, tanpa mengunci:
   *  - surat masuk berjenis SK, peraturan, pedoman, edaran, pengumuman diusulkan
   *    "Untuk diketahui" (hanya pada surat baru yang sifatnya belum diubah);
   *  - sifat yang tidak menuntut jawaban mengubah status "Belum ditindaklanjuti"
   *    menjadi "Tidak perlu jawaban". Keduanya tetap dapat diubah kembali.
   */
  const pasif = (x) => SIFAT_PASIF.indexOf(x) !== -1;
  const ubahSifat = (x) => setV((s) => Object.assign({}, s, { sifat: x },
    s.arah !== 'Keluar' && pasif(x) && (!s.status || s.status === 'Belum ditindaklanjuti') ? { status: 'Tidak perlu jawaban' } : {}));
  const ubahJenis = (x) => setV((s) => Object.assign({}, s, { jenis: x },
    !edit && s.arah !== 'Keluar' && s.sifat === 'Perlu tindakan' && jenisInformatif(x)
      ? Object.assign({ sifat: 'Untuk diketahui' }, (!s.status || s.status === 'Belum ditindaklanjuti') ? { status: 'Tidak perlu jawaban' } : {}) : {}));
  const tanggalJanggal = peringatanTanggalSurat(v, data.hari);
  // Arah tetap dapat diganti meskipun modal dibuka dari tab Masuk atau Keluar, agar salah pencet bisa dibetulkan di sini.
  const tampilArah = !edit && bolehMasuk && bolehKeluar;
  const tahapOpsi = opsi(data, 'STATUS_PENERBITAN').length ? opsi(data, 'STATUS_PENERBITAN') : ['Draft', 'Bernomor', 'Terbit', 'Batal', 'Cadangan'];

  const unitOpsi = useMemo(() => {
    const dari = opsi(data, 'UNIT').concat(opsi(data,'PIHAK_EKSTERNAL'));
    const seen = {};
    return dari.concat(v.asalTujuan || []).filter((x) => { const k = String(x).toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, (v.asalTujuan || []).join('|')]);

  const isuOpsi = useMemo(() => data.isu.filter((i) => !i._baru)
    .map((i) => ({ value: i.ID_ISU, label: i.JUDUL, meta: i.STATUS_ISU })), [data]);
  // Hanya surat berlawanan arah yang masih terbuka dan belum punya balasan. Surat yang sudah
  // dijawab, tidak perlu jawaban, batal, cadangan, atau masih draft tidak ikut memanjangkan daftar.
  // Nilai yang sudah tersimpan tetap ditampilkan walaupun suratnya kini sudah tertutup.
  const suratOpsi = useMemo(() => {
    const arahLawan = keluar ? 'Masuk' : 'Keluar';
    const idSaya = item && item.ID_SURAT;
    return (data.surat || []).filter((s) => {
      if (s._baru || s.ID_SURAT === idSaya) return false;
      if (s.ID_SURAT === v.idSuratTerkait) return true;
      if ((s.ARAH || 'Masuk') !== arahLawan) return false;
      if (!suratTerbuka(s)) return false;
      return !sudahDibalas(data.surat, s.ID_SURAT, idSaya);
    }).map((s) => ({ value: s.ID_SURAT, label: s.JUDUL,
      meta: [(s.ARAH || 'Masuk'), (s.NOMOR_SURAT || 'belum bernomor'), tgl(s.TANGGAL_SURAT), unitList(s.ASAL_TUJUAN).join(', ')].filter(Boolean).join(' · ') }));
  }, [data.surat, item, keluar, v.idSuratTerkait]);
  const rangkaianOpsi = useMemo(() => susunRangkaian(data.surat || []).map(g => ({value:g.id,label:g.judul,meta:g.id + ' · ' + g.jumlah + ' surat'})), [data.surat]);
  const rapatOpsi = useMemo(() => data.rapat.filter(x => !x._baru).map(x => ({value:x.ID_RAPAT,label:x.JUDUL_RAPAT,meta:x.ID_RAPAT})), [data.rapat]);
  const tlOpsi = useMemo(() => data.tindakLanjut.filter((t) => !t._baru && !tlTuntas(t))
    .map((t) => ({ value: t.ID_TINDAKLANJUT, label: t.JUDUL, meta: t.PIC || 'tanpa PIC' })), [data]);

  async function bacaDraft() {
    const url = String(v.linkDraft || '').trim();
    if (!url) return;
    setBaca({ status: 'memuat' });
    try {
      const h = await api.bacaDraftSurat(url);
      const adaIsi = h.nomorSurat || h.perihal || h.tujuan || h.tenggat;
      setBaca({ status: adaIsi ? 'ada' : 'kosong', hasil: h });
    } catch (err) {
      setBaca({ status: 'galat', pesan: err.message });
    }
  }
  /** Surat masuk: isi PDF atau gambar di Drive dibaca lewat OCR. Hasilnya usulan, sama seperti Baca draft. */
  const finalDiDrive = /drive\.google\.com\/(file\/d\/|open\?id=|uc\?id=)/.test(String(v.linkFinal || ''));
  async function bacaPdf() {
    const url = String(v.linkFinal || '').trim();
    if (!url) return;
    setBaca({ status: 'memuat', sumber: 'pdf' });
    try {
      const h = await api.bacaPdfSurat(url);
      const adaIsi = h.nomorSurat || h.perihal || h.tujuan || h.tenggat;
      setBaca({ status: adaIsi ? 'ada' : 'kosong', hasil: h, sumber: 'pdf' });
    } catch (err) {
      setBaca({ status: 'galat', pesan: err.message, sumber: 'pdf' });
    }
  }
  function pakaiUsulan() {
    const h = (baca && baca.hasil) || {};
    if (h.nomorSurat && !v.nomorSurat) set('nomorSurat', h.nomorSurat);
    if (h.perihal && !v.judul.trim()) set('judul', h.perihal);
    if (h.tenggat) { set('tenggatJawab', h.tenggat); if (!v.tenggatSumber) set('tenggatSumber', 'Tertulis'); }
    setBaca({ status: 'diam' });
  }
  async function usulNomor() {
    try {
      const r = await api.nomorSurat(String(v.tanggalSurat || new Date().getFullYear()).slice(0, 4));
      if (r && r.usulan) { set('nomorSurat', r.usulan); set('statusPenerbitan', v.statusPenerbitan === 'Cadangan' ? 'Cadangan' : 'Bernomor'); } 
      else toast('Belum ada nomor surat keluar tahun ini sebagai acuan.', 'galat');
    } catch (err) { toast(err.message, 'galat'); }
  }

  // --- Pembetulan nomor surat (v6.10.0) ---
  //
  // Sejak v6.10.0 backend mengizinkan nomor dibetulkan: bebas selama suratnya
  // belum terbit, dan untuk surat yang sudah terbit hanya oleh Admin dengan
  // alasan wajib. Bagian ini membuat aturan itu terlihat SEBELUM pengguna
  // menekan Simpan, bukan sesudahnya — sampai v6.9.0 kolom nomor tetap bisa
  // diketik lalu ditolak saat menyimpan, sehingga usaha pengguna terbuang.
  const tahapAsal = edit ? (asal.statusPenerbitan || '') : '';
  const nomorBerubah = edit && keluar && !!asal.nomorSurat && v.nomorSurat !== asal.nomorSurat;
  const perluAlasanNomor = nomorBerubah && ['Terbit', 'Batal'].indexOf(tahapAsal) !== -1;

  // Nomor tertinggi tahun berjalan, dipakai sebagai rem saat mengetik.
  //
  // Satu salah ketik pada nomor surat tidak berhenti pada surat itu: usulan nomor
  // berikutnya diambil dari angka TERTINGGI, jadi satu angka yang kelewat besar
  // merusak penomoran seluruh surat keluar berikutnya pada tahun itu. Karena itu
  // angka yang jauh di atas kebiasaan ditahan dulu dengan pertanyaan — ditahan,
  // bukan ditolak; nomor sisipan atau lompatan yang disengaja tetap boleh.
  const nomorJanggal = useMemo(() => {
    if (!keluar || !v.nomorSurat) return null;
    const m = String(v.nomorSurat).match(/^(\d+)\b/);
    if (!m) return null;
    const diketik = Number(m[1]);
    const tahun = String(v.tanggalSurat || new Date().getFullYear()).slice(0, 4);
    let tertinggi = 0;
    (data.surat || []).forEach((x) => {
      if (x.ARAH !== 'Keluar' || x.ID_SURAT === (item && item.ID_SURAT)) return;
      const mm = String(x.NOMOR_SURAT || '').match(/^(\d+)\b/);
      if (!mm || String(x.NOMOR_SURAT).indexOf(tahun) === -1) return;
      if (Number(mm[1]) > tertinggi) tertinggi = Number(mm[1]);
    });
    if (!tertinggi || diketik <= tertinggi + 50) return null;
    return { diketik, tertinggi };
  }, [keluar, v.nomorSurat, v.tanggalSurat, data.surat, item]);
  const [nomorDisetujui, setNomorDisetujui] = useState('');

  // --- Nomor ganda (v6.14.0): diperingatkan, tidak ditolak ---
  //
  // Nomor yang sama boleh dipakai lebih dari satu surat; register sendiri sudah
  // memuat nomor ganda yang sah. Yang diperlukan hanyalah pengguna TAHU sebelum
  // menekan Simpan. Surat keluar dibandingkan menurut nomor urut dan tahunnya
  // (aturan yang sama dengan nomorKunci_ di Simpan.gs), surat masuk menurut
  // nomor utuhnya, dan keduanya hanya terhadap surat yang searah.
  const nomorKembar = useMemo(() => {
    const rapat = (x) => String(x || '').toUpperCase().replace(/\s+/g, '');
    const kunci = (x) => {
      const t = rapat(x);
      if (!keluar) return t;
      const m = t.match(/^(\d+)([A-Z]?)\/(?:.*\/)?(\d{4})$/);
      return m ? m[3] + ':' + Number(m[1]) + m[2] : 'L:' + t;
    };
    if (!rapat(v.nomorSurat)) return [];
    const k = kunci(v.nomorSurat);
    const idSaya = item && item.ID_SURAT;
    return (data.surat || []).filter((x) => !x._baru && x.ID_SURAT !== idSaya
      && (x.ARAH || 'Masuk') === v.arah && x.NOMOR_SURAT && kunci(x.NOMOR_SURAT) === k);
  }, [keluar, v.nomorSurat, v.arah, data.surat, item]);

  function simpan(e) {
    e.preventDefault();
    if (!v.judul.trim()) return;
    if (!(keluar ? bolehKeluar : bolehMasuk)) { toast('Akses menulis surat ini tidak tersedia.', 'galat'); return; }
    const isi = Object.assign({}, v, { judul: v.judul.trim() });
    if (!keluar) { delete isi.statusPenerbitan; delete isi.alasanNomor; }
    if (keluar && isi.nomorSurat && isi.statusPenerbitan === 'Draft') {
      toast('Nomor sudah diisi. Pilih tahap Bernomor, Terbit, Batal, atau Cadangan sebelum menyimpan.', 'galat'); return;
    }
    if (perluAlasanNomor && !String(isi.alasanNomor || '').trim()) {
      toast('Surat ini sudah ' + tahapAsal.toLowerCase() + '. Isi alasan pembetulan nomor sebelum menyimpan; alasan itu dicatat di Riwayat.', 'galat');
      return;
    }
    if (nomorJanggal && nomorDisetujui !== isi.nomorSurat) {
      toast('Nomor ' + nomorJanggal.diketik + ' jauh di atas nomor tertinggi tahun ini (' +
        nomorJanggal.tertinggi + '). Tekan "Ya, nomor ini benar" di bawah kolom nomor bila memang disengaja.', 'galat');
      return;
    }
    if (edit) {
      const beda = selisih(asal, isi);
      if (!Object.keys(beda).length) { tutupForm(); return; }
      kirimForm('updateSurat', Object.assign({ id: item.ID_SURAT }, beda), v, { sukses: 'Surat diperbarui.' });
    } else {
      kirimForm('addSurat', isi, v, { sukses: 'Surat dicatat.' });
    }
  }

  const labelSimpan = !keluar ? 'Simpan surat masuk' : v.statusPenerbitan === 'Draft' ? 'Simpan draft' : v.statusPenerbitan === 'Terbit' ? 'Terbitkan' : v.statusPenerbitan === 'Batal' ? 'Catat pembatalan' : 'Simpan';
  const statusBerlaku = !keluar || v.statusPenerbitan === 'Terbit';
  const adaKaitan = !!(v.idIsu.length || v.idSuratTerkait || v.idTindakLanjut || v.idRangkaian || v.idRapat || v.jenis === 'Undangan' || v.namaTerkait || v.catatan);

  /**
   * v6.15.0 — susunan modal dirombak.
   *
   * Sampai v6.14.0 urutan isian BERBEDA antara surat masuk dan keluar (Kategori,
   * Media, dan Tanggal diterima bertukar tempat), ada sel kosong di baris tiga
   * kolom, dan kolom nomor terpotong oleh tombol Usulkan. Sekarang empat blok
   * dengan urutan yang sama untuk kedua arah:
   *   1 Surat  ·  2 Tenggat dan status  ·  3 Berkas  ·  4 Kaitan (terlipat)
   * Yang berbeda antara masuk dan keluar hanya SATU sel pertama blok 2:
   * "Tanggal diterima" untuk surat masuk, "Tahap penerbitan" untuk surat keluar.
   */
  return (
    <Modal judul={(edit ? 'Edit surat ' : 'Catat surat ') + (keluar ? 'keluar' : 'masuk')} onTutup={tutupForm} ukuran="md"
      kaki={<Kaki onBatal={tutupForm} form="form-surat" label={labelSimpan} nonaktif={!v.judul.trim()} />}>
      <form id="form-surat" onSubmit={simpan} className="form form-blok">
        <GalatForm pesan={galat} />

        <section className="blok-form">
          <h3 className="blok-form-judul"><span>1</span>Surat</h3>
          <Field label="Judul / perihal" wajib>
            <input autoFocus value={v.judul} onChange={(e) => set('judul', e.target.value)} placeholder="mis. Permintaan Asesmen Pengunduran Diri Dosen a.n Lidia Widia" />
          </Field>
          <div className={tampilArah ? 'grid-3' : 'grid-2'}>
            {tampilArah ? <Field label="Arah"><Pilih value={v.arah} onChange={(x) => set('arah', x)} opsi={opsi(data, 'ARAH_SURAT')} cari={false} /></Field> : null}
            <Field label="Jenis"><Pilih value={v.jenis} onChange={ubahJenis} opsi={opsi(data, 'JENIS_SURAT')} bebas /></Field>
            <Field label="Sifat" petunjuk="Untuk diketahui = SK, edaran, pengumuman. Tembusan = surat tugas, cuti, izin.">
              <Pilih value={v.sifat} onChange={ubahSifat} opsi={opsi(data, 'SIFAT_SURAT')} cari={false} />
            </Field>
          </div>
          <div className="grid-2-1">
            <Field label="Nomor surat">
              <div className="baris-isian">
                <input readOnly={keluar && !boleh('surat_keluar','NOMOR') && !v.nomorSurat} value={v.nomorSurat} onChange={(e) => set('nomorSurat', e.target.value)} placeholder="1743/UNEKA/PEND/X/2026" />
                {keluar && boleh('surat_keluar','NOMOR') ? <button type="button" className="tombol tipis kecil" onClick={usulNomor} title="Usulkan nomor berikutnya dari register">Usulkan</button> : null}
              </div>
            </Field>
            <Field label="Tanggal surat"><input type="date" value={v.tanggalSurat} onChange={(e) => set('tanggalSurat', e.target.value)} /></Field>
          </div>
          {nomorJanggal && nomorDisetujui !== v.nomorSurat ? (
            <p className="galat-form kecil">
              Nomor <b>{nomorJanggal.diketik}</b> jauh di atas nomor tertinggi tahun ini (<b>{nomorJanggal.tertinggi}</b>).
              Nomor yang kelewat besar ikut merusak usulan nomor surat berikutnya.{' '}
              <button type="button" className="tautan-tombol" onClick={() => setNomorDisetujui(v.nomorSurat)}>Ya, nomor ini benar</button>
            </p>
          ) : null}
          {nomorKembar.length ? (
            <p className="catatan-kuning kecil" role="status">
              <Ikon n="peringatan" s={13} /> Nomor ini juga dipakai{' '}
              {nomorKembar.slice(0, 3).map((x, i) => <span key={x.ID_SURAT}>{i ? '; ' : ''}<b>{x.ID_SURAT}</b> ({x.JUDUL})</span>)}
              {nomorKembar.length > 3 ? ' dan ' + (nomorKembar.length - 3) + ' surat lain' : ''}.
              {' '}Nomor ganda tetap dapat disimpan.
            </p>
          ) : null}
          {nomorBerubah && !perluAlasanNomor ? (
            <p className="samar kecil">Nomor diubah dari <b>{asal.nomorSurat}</b>. Surat ini belum terbit, jadi pembetulan tidak memerlukan alasan — tetap tercatat di Riwayat.</p>
          ) : null}
          <div className="grid-2-1">
            <Field label={keluar ? 'Ditujukan kepada' : 'Pengirim'}>
              <PilihBanyak value={v.asalTujuan} onChange={(x) => set('asalTujuan', x)} opsi={unitOpsi} placeholder="— belum ditentukan —" lebar={360}
                onTambah={(t) => { const nama = (t || '').trim(); if (nama) set('asalTujuan', (v.asalTujuan || []).concat(nama)); }}
                labelTambah="unit" />
            </Field>
            <Field label="Kategori"><Pilih value={v.kategori} onChange={(x) => set('kategori', x)} opsi={opsi(data, 'KATEGORI_ISU')} kosong="— belum ditentukan —" bebas /></Field>
          </div>
        </section>

        <section className="blok-form">
          <h3 className="blok-form-judul"><span>2</span>Tenggat dan status</h3>
          <div className="grid-3">
            {keluar
              ? <Field label="Tahap penerbitan"><Pilih value={v.statusPenerbitan} onChange={(x) => set('statusPenerbitan', x)} opsi={tahapOpsi} cari={false} /></Field>
              : <Field label="Tanggal diterima"><input type="date" value={v.tanggalDiterima} onChange={(e) => set('tanggalDiterima', e.target.value)} /></Field>}
            <Field label="Tenggat jawab" petunjuk={keluar ? 'Batas pihak lain menjawab.' : 'Batas kita menjawab.'}>
              <input type="date" value={v.tenggatJawab} onChange={(e) => set('tenggatJawab', e.target.value)} />
            </Field>
            <Field label="Sumber tenggat"><Pilih value={v.tenggatSumber} onChange={(x) => set('tenggatSumber', x)} opsi={opsi(data, 'TENGGAT_SUMBER')} kosong="— tidak dicatat —" cari={false} /></Field>
          </div>
          {tanggalJanggal.length ? (
            <p className="catatan-kuning kecil" role="status">
              <Ikon n="peringatan" s={13} /> Periksa tanggal: {tanggalJanggal.join('; ')}. Tanggal yang salah ketik membuat urutan daftar surat kacau. Tetap dapat disimpan.
            </p>
          ) : null}
          <div className="grid-2">
            <Field label="Status tindak lanjut" petunjuk={statusBerlaku ? undefined : 'Berlaku sesudah surat terbit.'}>
              <Pilih value={v.status} onChange={(x) => set('status', x)} opsi={opsi(data, 'STATUS_SURAT')} cari={false} disabled={!statusBerlaku} />
            </Field>
            <Field label={keluar ? 'Media pengiriman' : 'Media penerimaan'}><Pilih value={v.media} onChange={(x) => set('media', x)} opsi={opsi(data, 'MEDIA_SURAT')} kosong="— tidak dicatat —" bebas /></Field>
          </div>
          {keluar ? <p className="field-petunjuk">Draft belum memakai nomor. Bernomor dan Cadangan mempertahankan nomor meskipun nanti batal.</p> : null}
          {keluar && perluAlasanNomor ? <Field label="Alasan pembetulan nomor" wajib
            petunjuk={'Surat ini sudah ' + tahapAsal.toLowerCase() + ' dengan nomor ' + asal.nomorSurat + '. Alasan dicatat di Riwayat; hanya Admin yang dapat membetulkan.'}>
            <textarea rows={2} value={v.alasanNomor} onChange={(e) => set('alasanNomor', e.target.value)}
              placeholder="Mis. salah ketik saat pencatatan; nomor yang benar adalah …" />
          </Field> : keluar && (v.statusPenerbitan === 'Cadangan' || v.statusPenerbitan === 'Batal') ? <Field label="Alasan / keterangan nomor" petunjuk="Tercatat di Riwayat surat.">
            <textarea rows={2} value={v.alasanNomor} onChange={(e) => set('alasanNomor', e.target.value)} placeholder="Catat alasan pencadangan atau pembatalan nomor" />
          </Field> : null}
        </section>

        <section className="blok-form">
          <h3 className="blok-form-judul"><span>3</span>Berkas</h3>
          {keluar ? <Field label="Draft surat (Google Doc)">
            <BarisTautan value={v.linkDraft} onChange={(x) => { set('linkDraft', x); setBaca({ status: 'diam' }); }}
              jenis="Draft" placeholder="https://docs.google.com/document/d/…"
              aksi={<button type="button" className="tombol tipis kecil" onClick={bacaDraft} disabled={!String(v.linkDraft || '').trim() || baca.status === 'memuat'}>
                <Ikon n="baca" s={14} />{baca.status === 'memuat' && baca.sumber !== 'pdf' ? 'Membaca…' : 'Baca draft'}
              </button>} />
          </Field> : null}
          <Field label={keluar ? 'Surat terbit / final' : 'Dokumen surat diterima'}>
            <BarisTautan value={v.linkFinal} onChange={(x) => { set('linkFinal', x); if (v.jenisBerkasFinal) set('jenisBerkasFinal', ''); }}
              jenis={keluar ? 'Final' : 'Surat diterima'} placeholder="https://drive.google.com/…"
              jenisBerkas={v.jenisBerkasFinal} onJenisBerkas={(j) => set('jenisBerkasFinal', j)}
              aksi={!keluar && finalDiDrive ? <button type="button" className="tombol tipis kecil" onClick={bacaPdf} disabled={baca.status === 'memuat'}
                title="Membaca isi PDF atau gambar lewat Google Drive. Hasil pindai bisa kurang tepat; periksa sebelum dipakai.">
                <Ikon n="baca" s={14} />{baca.status === 'memuat' && baca.sumber === 'pdf' ? 'Membaca…' : 'Baca PDF'}
              </button> : null} />
          </Field>
          {baca.status === 'galat' ? <p className="kecil teks-merah">{baca.pesan}</p> : null}
          {baca.status === 'kosong' ? <p className="kecil samar">Tidak ditemukan nomor, perihal, maupun kalimat tenggat pada {baca.sumber === 'pdf' ? 'berkas' : 'draft'} itu. Isi manual saja.</p> : null}
          {baca.status === 'ada' ? (
            <div className="usulan-baca">
              <strong>Usulan dari {baca.sumber === 'pdf' ? 'berkas (hasil baca otomatis, periksa dulu)' : 'draft'}</strong>
              <ul>
                {baca.hasil.nomorSurat ? <li>Nomor surat: <b>{baca.hasil.nomorSurat}</b></li> : null}
                {baca.hasil.perihal ? <li>Perihal: <b>{baca.hasil.perihal}</b></li> : null}
                {baca.hasil.tujuan ? <li>Tujuan: {baca.hasil.tujuan}</li> : null}
                {baca.hasil.tenggat ? <li>Tenggat: <b>{tgl(baca.hasil.tenggat)}</b> <small className="samar">dari kalimat “{baca.hasil.kalimatTenggat}”</small></li> : null}
              </ul>
              <div className="baris-aksi-kecil">
                <button type="button" className="tombol utama kecil" onClick={pakaiUsulan}>Pakai usulan</button>
                <button type="button" className="tombol tipis kecil" onClick={() => setBaca({ status: 'diam' })}>Abaikan</button>
              </div>
              <small className="samar">Hanya isian yang masih kosong yang akan terisi.</small>
            </div>
          ) : null}
          <Field label="Dokumen pendukung"><EditorTautan value={v.tautan} onChange={(x) => set('tautan', x)} data={data} /></Field>
        </section>

        <Lipat judul="4 · Kaitan dan catatan" ringkas="rangkaian, rapat, pokok bahasan, tindak lanjut" terbuka={adaKaitan}>
          <div className="grid-2">
            <Field label="Rangkaian korespondensi" petunjuk="Kosong = membentuk rangkaian baru.">
              <Pilih value={v.idRangkaian} onChange={x=>set('idRangkaian',x)} opsi={rangkaianOpsi} kosong="Buat baru / ikuti surat balasan" lebar={420}/>
            </Field>
            <Field label="Rapat terkait" petunjuk="Khususnya untuk surat undangan.">
              <Pilih value={v.idRapat} onChange={x=>set('idRapat',x)} opsi={rapatOpsi} kosong="Tidak terkait rapat" lebar={420}/>
            </Field>
          </div>
          <Field label="Pokok bahasan terkait" petunjuk="Boleh lebih dari satu.">
            <PilihBanyak value={v.idIsu} onChange={(x) => set('idIsu', x)} opsi={isuOpsi} placeholder="Berdiri sendiri" lebar={460} />
          </Field>
          <div className="grid-2">
            <Field label={keluar ? 'Menjawab surat masuk' : 'Dijawab dengan surat keluar'}>
              <Pilih value={v.idSuratTerkait} onChange={(x) => set('idSuratTerkait', x)} opsi={suratOpsi} kosong="— tidak ada —" lebar={420} />
            </Field>
            <Field label="Menjawab tindak lanjut" petunjuk="Isi bila surat ini menutup satu pekerjaan.">
              <Pilih value={v.idTindakLanjut} onChange={(x) => set('idTindakLanjut', x)} opsi={tlOpsi} kosong="— tidak ada —" lebar={420} />
            </Field>
          </div>
          <Field label="Nama terkait" petunjuk="Nama pegawai yang disebut; pisahkan dengan |">
            <input value={v.namaTerkait} onChange={(e) => set('namaTerkait', e.target.value)} placeholder="Lidia Widia" />
          </Field>
          <Field label="Catatan"><textarea rows={2} value={v.catatan} onChange={(e) => set('catatan', e.target.value)} /></Field>
        </Lipat>
      </form>
    </Modal>
  );
}
