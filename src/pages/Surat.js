import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../konteks';
import Kepala, { SaringBar, KotakCari, Segmen } from '../components/Kepala';
import Tabel from '../components/Tabel';
import { Pilih, MenuTitik } from '../components/Pilih';
import { EditPilihan } from '../components/EditSel';
import { Lencana, Kosong } from '../components/Dasar';
import Ikon from '../components/Ikon';
import RangkaianSurat from './RangkaianSurat';
import { rangkaianSurat } from '../utils/korespondensi';
import { pref, setPref } from '../simpanan';
import { cocokCari, tgl, kunciTanggal, selisihHari, tambahHari } from '../utils/format';
import { bandingNomorSurat, bandingTanggal, bandingNilai } from '../utils/urut';
import { opsi, unitList, isuSurat, SIFAT_PASIF, suratTerbuka, nadaStatusSurat, posisiSurat, sudahDibalas, tanggalMasukSurat, tanggalAcuanSurat } from '../utils/data';

const AWAL = { q: '', tab: 'perlu', posisi: '', kategori: '', jenis: '', sifat: '', tanggalJenis: 'TANGGAL_SURAT', periode: 'semua', dari: '', sampai: '' };
/** Draft = surat keluar yang belum bernomor dan belum diterbitkan. */
/** Pemecah seri: surat yang dicatat terakhir (ID terbesar) di atas. */
const idTerbaru = (a, b) => bandingNilai(a.ID_SURAT, b.ID_SURAT, -1);
/** Tanggal yang dipakai saringan periode; "Tanggal Diterima" memakai tanggal masuk (diterima, atau tanggal surat). */
const tanggalSaring = (s, jenis) => (jenis === 'TANGGAL_DITERIMA' ? tanggalMasukSurat(s) : kunciTanggal(s[jenis] || ''));
const adalahDraf = (s) => s.ARAH === 'Keluar' &&
  (s.STATUS_PENERBITAN === 'Draft' || (!s.STATUS_PENERBITAN && !String(s.NOMOR_SURAT || '').trim()));

/**
 * Ubah status surat. Bila ditandai sudah dijawab sementara belum ada surat balasan yang
 * tertaut, pengguna diingatkan — bukan dilarang.
 */
export async function simpanStatusSurat(app, s, v) {
  const { data, tulis, tanya } = app;
  if (v === 'Sudah dijawab' && !String(s.ID_SURAT_TERKAIT || '').trim() && !sudahDibalas(data.surat, s.ID_SURAT)) {
    const ya = await tanya({
      judul: 'Tandai surat sudah dijawab?',
      pesan: 'Belum ada surat balasan yang tertaut ke surat ini. Status tetap dapat diubah, dan kaitan balasannya boleh diisi belakangan dari modal surat.',
      label: 'Ya, tandai sudah dijawab',
    });
    if (!ya) return;
  }
  tulis('updateSurat', { id: s.ID_SURAT, status: v }, { sukses: 'Status surat diperbarui.' });
}

export function aksiSurat(app, s) {
  const { buka, bukaForm, hapus, hanyaBaca, boleh } = app;
  return [
    { label: 'Lihat rincian', onClick: () => buka('surat', s.ID_SURAT) },
    { label: 'Edit', hilang: hanyaBaca, onClick: () => bukaForm('surat', { item: s }) },
    { label: s.ARAH === 'Masuk' ? 'Buat surat balasan' : 'Catat surat masuk balasan', hilang: !boleh(s.ARAH === 'Masuk' ? 'surat_keluar' : 'surat_masuk','TAMBAH'),
      onClick: () => bukaForm('surat', { awal: {
        arah: s.ARAH === 'Masuk' ? 'Keluar' : 'Masuk',
        judul: 'Balasan: ' + s.JUDUL, kategori: s.KATEGORI, idSuratTerkait: s.ID_SURAT,
        idIsu: isuSurat(s), idRangkaian: (rangkaianSurat(app.data.surat, s.ID_SURAT) || {}).id || '', idRapat: s.ID_RAPAT || '', namaTerkait: s.NAMA_TERKAIT,
      } }) },
    { label: 'Tambah tindak lanjut', hilang: !boleh('tindak_lanjut','TAMBAH'),
      onClick: () => bukaForm('tl', { awal: { judul: s.JUDUL, idSuratAsal: s.ID_SURAT, idIsu: isuSurat(s)[0] || '' } }) },
    { garis: true, hilang: hanyaBaca },
    { label: 'Hapus', bahaya: true, hilang: hanyaBaca || (s.ARAH === 'Keluar' && !!s.NOMOR_SURAT),
      onClick: () => hapus('deleteSurat', s.ID_SURAT, { judul: 'Hapus surat?', pesan: '“' + s.JUDUL + '” akan dihapus dari sheet Surat.' }) },
  ];
}

export default function Surat() {
  const app = useApp();
  const { data, buka, bukaForm, tulis, muatSurat, suratSiap, rute, boleh } = app;
  const izinMasuk = boleh('surat_masuk');
  const izinKeluar = boleh('surat_keluar');
  const tabUbah = fTab => ((fTab === 'keluar' || fTab === 'draf') && boleh('surat_keluar','EDIT')) || (fTab === 'masuk' && boleh('surat_masuk','EDIT')) || (['semua','perlu','rangkaian'].includes(fTab) && boleh('surat_masuk','EDIT') && boleh('surat_keluar','EDIT'));
  const tabTambah = fTab => (fTab === 'keluar' || fTab === 'draf') ? boleh('surat_keluar','TAMBAH') : fTab === 'masuk' ? boleh('surat_masuk','TAMBAH') : boleh('surat_masuk','TAMBAH') || boleh('surat_keluar','TAMBAH');
  const tabAman = fTab => (fTab === 'keluar' || fTab === 'draf') && !izinKeluar ? 'masuk' : fTab === 'masuk' && !izinMasuk ? 'keluar' : fTab;
  const [f, setF] = useState(() => Object.assign({}, AWAL, pref('saring.surat', {})));
  const [pilihan, setPilihan] = useState(() => new Set());
  useEffect(() => { if (!suratSiap) muatSurat(false); }, [suratSiap, muatSurat]);
  useEffect(() => { setPref('saring.surat', f); }, [f]);
  const ubahF = (k, v) => setF((x) => Object.assign({}, x, { [k]: v }));
  useEffect(() => {
    const tab = rute?.query?.tab;
    if (['masuk','keluar','draf','semua','perlu','rangkaian'].includes(tab)) setF(x => ({...x,tab:tabAman(tab)}));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rute?.query?.tab]);
  useEffect(() => {
    if (((f.tab === 'keluar' || f.tab === 'draf') && !izinKeluar) || (f.tab === 'masuk' && !izinMasuk)) ubahF('tab', tabAman(f.tab));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [izinMasuk,izinKeluar,f.tab]);

  const semua = useMemo(() => data.surat || [], [data]);
  const nomorInfo = useMemo(() => {
    const tahun = String(new Date().getFullYear());
    let tertinggi = 0, terakhir = '—', cadangan = 0;
    const pakai = {};
    semua.filter(x => x.ARAH === 'Keluar').forEach(s => {
      if (s.STATUS_PENERBITAN === 'Cadangan') cadangan++;
      const m = String(s.NOMOR_SURAT || '').match(/^(\d+)([A-Za-z]?)\/.+\/(\d{4})$/);
      if (!m || m[3] !== tahun) return;
      const kunci = String(Number(m[1])) + String(m[2] || '').toUpperCase();
      pakai[kunci] = (pakai[kunci] || 0) + 1;
      if (Number(m[1]) >= tertinggi) { tertinggi = Number(m[1]); terakhir = s.NOMOR_SURAT; }
    });
    // Register yang rapi: nomor tidak dipakai dua kali, dan tidak ada angka yang terlompati.
    const ganda = Object.keys(pakai).filter((k) => pakai[k] > 1).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
    const bolong = [];
    for (let i = 1; i < tertinggi; i++) if (!pakai[String(i)]) bolong.push(i);
    return { tertinggi, berikut: tertinggi + 1, terakhir, cadangan, tahun, ganda, bolong };
  }, [semua]);
  const jumlah = useMemo(() => ({
    perlu: semua.filter(suratTerbuka).length,
    kita: semua.filter((s) => posisiSurat(s) === 'kita').length,
    lawan: semua.filter((s) => posisiSurat(s) === 'lawan').length,
    draf: semua.filter(adalahDraf).length,
    masuk: semua.filter((s) => s.ARAH !== 'Keluar').length,
    keluar: semua.filter((s) => s.ARAH === 'Keluar' && s.STATUS_PENERBITAN !== 'Cadangan').length,
  }), [semua]);

  const baris = useMemo(() => semua.filter((s) => {
    if (!cocokCari(f.q, [s.ID_SURAT, s.NOMOR_SURAT, s.JUDUL, s.ASAL_TUJUAN, s.NAMA_TERKAIT, s.JENIS, s.CATATAN])) return false;
    if (['semua', 'perlu'].includes(f.tab) && s.STATUS_PENERBITAN === 'Cadangan') return false;
    if (f.tab === 'perlu' && !suratTerbuka(s)) return false;
    if (f.tab === 'perlu' && f.posisi && posisiSurat(s) !== f.posisi) return false;
    if (f.tab === 'masuk' && s.ARAH === 'Keluar') return false;
    if (f.tab === 'keluar' && s.ARAH !== 'Keluar') return false;
    if (f.tab === 'draf' && !adalahDraf(s)) return false;
    if (f.kategori && (s.KATEGORI || '') !== f.kategori) return false;
    if (f.jenis && (s.JENIS || '') !== f.jenis) return false;
    if (f.sifat && (s.SIFAT || '') !== f.sifat) return false;
    const tanggal = tanggalSaring(s, f.tanggalJenis);
    const batas = data.hari;
    const awal = f.periode === 'bulan' ? batas.slice(0,7)+'-01' : f.periode === 'lalu' ? (()=>{const d=new Date(batas.slice(0,7)+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7)+'-01';})() : f.periode === 'rentang' ? f.dari : '';
    const akhir = f.periode === 'bulan' ? tambahHari(batas.slice(0,7)+'-01', 31).slice(0,7) === batas.slice(0,7) ? tambahHari(batas.slice(0,7)+'-01',31) : (()=>{const d=new Date(batas.slice(0,7)+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(0);return d.toISOString().slice(0,10);})() : f.periode === 'lalu' ? tambahHari(batas.slice(0,7)+'-01',-1) : f.periode === 'rentang' ? f.sampai : '';
    if ((awal || akhir) && (!tanggal || (awal && tanggal < awal) || (akhir && tanggal > akhir))) return false;
    return true;
  }).sort((a, b) => {
    /*
     * v6.17.0 — urutan bawaan.
     * Masuk  : tanggal masuk terbaru (diterima; bila kosong, tanggal surat — tampil abu di kolom
     *          Tanggal Diterima), lalu yang dicatat terakhir.
     * Keluar : nomor terbaru, lalu tanggal surat, lalu yang dicatat terakhir.
     * Perlu  : tenggat terdekat; tanpa tenggat di bawah, diurut tanggal acuan terbaru.
     * Lainnya: tanggal acuan terbaru (masuk = tanggal masuk, keluar = terbit/tanggal surat).
     * Sampai v6.16.0 surat bertanggal sama berurutan acak, dan tab Semua memakai kunci berbeda.
     */
    if (f.tab === 'perlu') return bandingTanggal(a.TENGGAT_JAWAB,b.TENGGAT_JAWAB) || bandingNilai(tanggalAcuanSurat(a),tanggalAcuanSurat(b),-1) || idTerbaru(a,b);
    if (f.tab === 'keluar') return bandingNomorSurat(a.NOMOR_SURAT,b.NOMOR_SURAT,-1) || bandingTanggal(a.TANGGAL_SURAT,b.TANGGAL_SURAT,-1) || idTerbaru(a,b);
    if (f.tab === 'masuk') return bandingNilai(tanggalMasukSurat(a),tanggalMasukSurat(b),-1) || idTerbaru(a,b);
    return bandingNilai(tanggalAcuanSurat(a),tanggalAcuanSurat(b),-1) || idTerbaru(a,b);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [semua, f]);

  const kolom = useMemo(() => [
    { kunci: 'nomor', urut: (s) => s.NOMOR_SURAT, banding: bandingNomorSurat, judul: 'Nomor Surat', lebar: 205, render: (s) => <div className="dua-baris"><strong className="judul-baris">{s.NOMOR_SURAT || 'Belum bernomor'}</strong><small>{s.ID_SURAT} · {s.ARAH}</small></div> },
    { kunci: 'perihal', urut: (s) => s.JUDUL, judul: 'Perihal', lebar: 300, render: (s) => <div className="dua-baris"><strong className="judul-baris">{s.JUDUL || '—'}</strong><small>{s.JENIS || 'Surat'}</small></div> },
    { kunci: 'tanggalSurat', urut: (s) => kunciTanggal(s.TANGGAL_SURAT), judul: 'Tanggal Surat', lebar: 135, render: (s) => tgl(s.TANGGAL_SURAT) },
    { kunci: 'pihak', urut: (s) => s.ASAL_TUJUAN, judul: f.tab === 'masuk' ? 'Pengirim' : (f.tab === 'keluar' || f.tab === 'draf') ? 'Penerima' : 'Pengirim / Tujuan', lebar: 180,
      render: (s) => unitList(s.ASAL_TUJUAN).join(', ') || '—' },
    { kunci: 'tanggalTambahan', urut: s => (s.ARAH === 'Keluar' ? kunciTanggal(s.TANGGAL_TERBIT) : tanggalMasukSurat(s)),
      judul: f.tab === 'masuk' ? 'Tanggal Diterima' : (f.tab === 'keluar' || f.tab === 'draf') ? 'Tanggal Terbit' : 'Terima / Terbit', lebar: 146,
      render: (s) => (s.ARAH === 'Keluar' || kunciTanggal(s.TANGGAL_DITERIMA) || !kunciTanggal(s.TANGGAL_SURAT)
        ? tgl(s.ARAH === 'Keluar' ? s.TANGGAL_TERBIT : s.TANGGAL_DITERIMA)
        : <span className="samar" title="Tanggal diterima belum dicatat; urutan memakai tanggal surat">{tgl(s.TANGGAL_SURAT)} (tgl surat)</span>) },
    f.tab === 'draf' ? null : { kunci: 'posisi', urut: (s) => posisiSurat(s), judul: 'Posisi', lebar: 162, render: (s) => {
      const p = posisiSurat(s);
      if (!p) return <span className="samar">—</span>;
      if (p === 'kita') return <Lencana nada="biru">Kita menjawab</Lencana>;
      const sejak = kunciTanggal(s.TANGGAL_TERBIT || s.TANGGAL_SURAT);
      const lama = sejak && sejak <= data.hari ? selisihHari(data.hari, sejak) : 0;
      return <div className="dua-baris"><Lencana nada="kuning">Kita menunggu</Lencana>{lama ? <small>sudah {lama} hari</small> : null}</div>;
    } },
    { kunci: 'tenggat', urut: s => kunciTanggal(s.TENGGAT_JAWAB), judul: 'Tenggat Jawaban', lebar: 151, render: (s) => {
      const k = kunciTanggal(s.TENGGAT_JAWAB);
      if (!k) return '—';
      return <span className={suratTerbuka(s) && k < data.hari ? 'teks-merah' : ''}>{tgl(k)}{suratTerbuka(s) && k < data.hari ? ' · lewat '+selisihHari(data.hari,k)+' hr' : ''}</span>;
    } },
    { kunci: 'status', urut: (s) => s.ARAH === 'Keluar' ? s.STATUS_PENERBITAN : s.STATUS, judul: (f.tab === 'keluar' || f.tab === 'draf') ? 'Penerbitan' : 'Status', lebar: 156,
      render: (s) => s.ARAH === 'Keluar' ? <Lencana nada={s.STATUS_PENERBITAN === 'Batal' ? 'merah' : s.STATUS_PENERBITAN === 'Terbit' ? 'hijau':'abu'}>{s.STATUS_PENERBITAN || (s.LINK_FINAL?'Terbit':s.NOMOR_SURAT?'Bernomor':'Draft')}</Lencana>
        : <EditPilihan value={s.STATUS || 'Belum ditindaklanjuti'} opsi={opsi(data,'STATUS_SURAT')} nada={nadaStatusSurat}
            disabled={!boleh('surat_masuk','EDIT')||s._baru} onSimpan={v=>simpanStatusSurat(app,s,v)}/> },
    { kunci: 'aksi', judul: '', lebar: 52, tetapKanan: true, kelas: 'kolom-aksi', render: (s) => s._baru ? null : <MenuTitik items={aksiSurat({...app,hanyaBaca:!boleh(s.ARAH==='Keluar'?'surat_keluar':'surat_masuk','EDIT')},s)} /> },
  ].filter(Boolean)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  , [data, f.tab, app, tulis, boleh]);

  const adaSaring = JSON.stringify(f) !== JSON.stringify(AWAL);
  const dipilih = Array.from(pilihan).filter((id) => data.peta.surat[id]);
  const bulk = (payload, label) => {
    tulis('bulkUpdateSurat', Object.assign({ ids: dipilih }, payload), { sukses: label });
    setPilihan(new Set());
  };

  if (!suratSiap && !semua.length) {
    return (
      <div className="halaman">
        <Kepala judul="Surat" sub="Surat masuk dan surat keluar dalam satu pintu." />
        <div className="memuat"><span className="pemutar" />Memuat data surat…</div>
      </div>
    );
  }
  if (suratSiap && !semua.length) {
    return (
      <div className="halaman">
        <Kepala judul="Surat" sub="Surat masuk dan surat keluar dalam satu pintu."
          aksi={!tabTambah(f.tab) ? null : <button type="button" className="tombol utama" onClick={() => bukaForm('surat', f.tab === 'keluar' || f.tab === 'draf' || f.tab === 'masuk' ? { awal: { arah: f.tab === 'masuk' ? 'Masuk' : 'Keluar' } } : { awal: { arah: izinMasuk && boleh('surat_masuk','TAMBAH') ? 'Masuk' : 'Keluar' } })}><Ikon n="tambah" s={15} />Catat Surat</button>} />
        <Kosong ikon="surat">Belum ada surat tercatat. Isi sheet “Surat” lewat salin-tempel, atau catat satu per satu dari sini.</Kosong>
      </div>
    );
  }

  return (
    <div className="halaman">
      <Kepala judul="Surat" sub="Surat masuk dan surat keluar dalam satu pintu."
        aksi={!tabTambah(f.tab) ? null : <button type="button" className="tombol utama" onClick={() => bukaForm('surat', f.tab === 'keluar' || f.tab === 'draf' || f.tab === 'masuk' ? { awal: { arah: f.tab === 'masuk' ? 'Masuk' : 'Keluar' } } : { awal: { arah: izinMasuk && boleh('surat_masuk','TAMBAH') ? 'Masuk' : 'Keluar' } })}><Ikon n="tambah" s={15} />Catat Surat</button>} />
      <div className="saring">
        <Segmen value={f.tab} onChange={(v) => setF(x=>({...x,tab:v,posisi:'',tanggalJenis:v==='perlu'?'TENGGAT_JAWAB':v==='masuk'?'TANGGAL_DITERIMA':'TANGGAL_SURAT',periode:'semua',dari:'',sampai:''}))} opsi={[
          { value: 'perlu', label: 'Perlu jawaban', jumlah: jumlah.perlu },
          ...(izinMasuk ? [{ value: 'masuk', label: 'Masuk', jumlah: jumlah.masuk }] : []),
          ...(izinKeluar ? [{ value: 'keluar', label: 'Keluar', jumlah: jumlah.keluar }] : []),
          ...(izinKeluar ? [{ value: 'draf', label: 'Draft', jumlah: jumlah.draf }] : []),
          { value: 'semua', label: 'Semua' },
          ...(izinMasuk && izinKeluar ? [{ value: 'rangkaian', label: 'Rangkaian' }] : []),
        ]} />
      </div>
      {f.tab === 'perlu' ? <div className="saring saring-anak">
        <Segmen kecil value={f.posisi} onChange={(v) => ubahF('posisi', v)} opsi={[
          { value: 'kita', label: 'Kita menjawab', jumlah: jumlah.kita },
          { value: 'lawan', label: 'Kita menunggu', jumlah: jumlah.lawan },
          { value: '', label: 'Semua', jumlah: jumlah.perlu },
        ]} />
        <span className="jumlah-hasil">{f.posisi === 'kita' ? 'Surat masuk yang belum kita jawab.' : f.posisi === 'lawan' ? 'Surat keluar yang jawabannya masih kita tunggu.' : 'Kewajiban kita dan pihak lain ditampilkan bersama.'}</span>
      </div> : null}
      {f.tab === 'keluar' ? <div className="nomor-register" role="group" aria-label="Ringkasan penomoran surat keluar">
        <span><small>Nomor tertinggi {nomorInfo.tahun}</small><strong>{nomorInfo.tertinggi || '—'}</strong></span>
        <span><small>Angka berikutnya (usulan)</small><strong>{nomorInfo.berikut}</strong></span>
        <span><small>Nomor dicadangkan</small><strong>{nomorInfo.cadangan}</strong></span>
        {boleh('surat_keluar','NOMOR') && boleh('surat_keluar','TAMBAH') ? <button type="button" className="tombol tipis kecil" onClick={() => bukaForm('surat', { awal: { arah: 'Keluar', jenis: 'Cadangan nomor', judul: 'Cadangan nomor surat', sifat: 'Arsip rutin', statusPenerbitan: 'Cadangan' } })}>Cadangkan nomor</button> : null}
        <small className="samar">Usulan belum mengunci nomor. Nomor baru dipastikan unik saat disimpan.</small>
        {nomorInfo.ganda.length || nomorInfo.bolong.length ? <span className="nomor-peringatan"><Ikon n="peringatan" s={14} />
          {nomorInfo.ganda.length ? 'Nomor dipakai lebih dari sekali: ' + nomorInfo.ganda.join(', ') + '. ' : ''}
          {nomorInfo.bolong.length ? 'Angka belum terpakai: ' + (nomorInfo.bolong.length > 12 ? nomorInfo.bolong.slice(0, 12).join(', ') + ', dan ' + (nomorInfo.bolong.length - 12) + ' lagi' : nomorInfo.bolong.join(', ')) + '.' : ''}
        </span> : null}
      </div> : null}
      {f.tab === 'rangkaian' ? <RangkaianSurat /> : <>
      <SaringBar jumlah={baris.length + ' surat'} adaSaring={adaSaring} onReset={() => setF(AWAL)}>
        <KotakCari value={f.q} onChange={(v) => ubahF('q', v)} placeholder="Cari judul, nomor, pihak, nama…" />
        <Pilih className="saring-pilih" value={f.kategori} onChange={(v) => ubahF('kategori', v)} opsi={opsi(data, 'KATEGORI_ISU')} kosong="Semua kategori" placeholder="Kategori" />
        <Pilih className="saring-pilih" value={f.jenis} onChange={(v) => ubahF('jenis', v)} opsi={opsi(data, 'JENIS_SURAT')} kosong="Semua jenis" placeholder="Jenis" />
        <Pilih className="saring-pilih" value={f.sifat} onChange={(v) => ubahF('sifat', v)} opsi={opsi(data, 'SIFAT_SURAT')} kosong="Semua sifat" placeholder="Sifat" cari={false} />
        <label className="saring-tanggal"><span>Tanggal</span><select aria-label="Jenis tanggal" value={f.tanggalJenis} onChange={e=>ubahF('tanggalJenis',e.target.value)}>
          <option value="TANGGAL_SURAT">Tanggal Surat</option>
          {f.tab==='masuk'?<option value="TANGGAL_DITERIMA">Tanggal Diterima</option>:null}
          {f.tab==='keluar'?<option value="TANGGAL_TERBIT">Tanggal Terbit</option>:null}
          {f.tab==='perlu'?<option value="TENGGAT_JAWAB">Tenggat Jawaban</option>:null}
        </select></label>
        <select className="saring-pilih" aria-label="Periode surat" value={f.periode} onChange={e=>ubahF('periode',e.target.value)}>
          <option value="semua">Semua waktu</option><option value="bulan">Bulan ini</option><option value="lalu">Bulan lalu</option><option value="rentang">Rentang tanggal</option>
        </select>
        {f.periode==='rentang'?<><label className="saring-tanggal">Dari <input type="date" value={f.dari} onChange={e=>ubahF('dari',e.target.value)}/></label>
          <label className="saring-tanggal">Sampai <input type="date" value={f.sampai} min={f.dari||undefined} onChange={e=>ubahF('sampai',e.target.value)}/></label></>:null}

      </SaringBar>
      {f.tab === 'perlu' && !f.sifat ? (
        <p className="petunjuk-saring samar kecil">
          {SIFAT_PASIF.slice(0, -1).join(', ') + ' dan ' + SIFAT_PASIF[SIFAT_PASIF.length - 1]} disembunyikan di tab ini. Pilih tab Masuk atau Keluar untuk melihat semuanya.
        </p>
      ) : null}
      {dipilih.length ? (
        <div className="bilah-massal">
          <strong>{dipilih.length} dipilih</strong>
          <Pilih className="kecil" value="" onChange={(v) => v && bulk({ status: v }, 'Status surat diperbarui.')} opsi={opsi(data, 'STATUS_SURAT')} placeholder="Ubah status" cari={false} />
          <Pilih className="kecil" value="" onChange={(v) => v && bulk({ sifat: v }, 'Sifat surat diperbarui.')} opsi={opsi(data, 'SIFAT_SURAT')} placeholder="Ubah sifat" cari={false} />
          <button type="button" className="tombol tipis kecil" onClick={() => setPilihan(new Set())}>Batal</button>
        </div>
      ) : null}
      <Tabel key={f.tab + ':' + f.tanggalJenis + ':' + f.periode + ':' + f.dari + ':' + f.sampai + ':' + f.q + ':' + f.kategori + ':' + f.jenis + ':' + f.sifat} id="surat" kolom={kolom} baris={baris} kunci={(s) => s.ID_SURAT} onBuka={(s) => !s._baru && buka('surat', s.ID_SURAT)}
        pilihan={!tabUbah(f.tab) ? undefined : pilihan} onPilih={!tabUbah(f.tab) ? undefined : (id) => setPilihan((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
        onPilihSemua={!tabUbah(f.tab) ? undefined : (semua, ids) => setPilihan(prev => { const next = new Set(prev); (ids || baris.map(x => x.ID_SURAT)).forEach(id => semua ? next.add(id) : next.delete(id)); return next; })}
        kelasBaris={(s) => (s.URGENSI === 'merah' ? 'baris-sorot' : '')}
        kosong={adaSaring ? 'Tidak ada surat yang cocok dengan saringan.' : 'Belum ada surat pada tab ini.'} />
      </>}
    </div>
  );
}
