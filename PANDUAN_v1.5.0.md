# PANDUAN Pemasangan — Pusat Referensi Regulasi YEH v1.5.0

**Tanggal:** 9 November 2026
**Versi sebelumnya yang disyaratkan:** v1.4.0 (`YEH_VERSION = '1.4.0'` di `Code.js`, `APP_VERSION: '1.4.0'` di `config.js`)
**Versi sesudah paket ini:** v1.5.0

Paket ini mengerjakan pilihan **(b)**: memperbaiki jalur baca dan memindahkan penerbitan ke Cloudflare Workers. Kerangka web tetap JavaScript biasa — tidak dibongkar ke React.

---

## URUTAN WAJIB

Urutannya tidak boleh ditukar. Langkah A–D menyiapkan tempat; E menerbitkan backend; F mengisi cermin; G menerbitkan web.

```
A. SQL Supabase          →  B. Uji RLS        →  C. Edge Function + Secrets
                                                        ↓
G. Cloudflare Workers    ←  F. Isi cermin     ←  E. clasp push + deploy
   + matikan Pages          + pasang pemicu       ↑
                                                D. Script Properties
```

Selama langkah D belum selesai, web tetap berjalan seperti v1.4.0 — membaca lewat Apps Script. Tidak ada yang rusak di tengah jalan.

---

## ISI PERUBAHAN

### Berkas Apps Script — folder `D:\GAS Project\PusatRegulasiYEH`
Sudah dituliskan ke folder itu. Tinggal di-push.

| Berkas | Keadaan | Isi perubahan |
|---|---|---|
| `Core_Cermin.js` | **baru** | Cermin Supabase, penanda revisi per sheet, pemicu, keep-alive, rekonsiliasi |
| `Core_Data.js` | diubah | `yehRegRev_` memakai penanda per sheet; `yehSource_` tidak lagi mengirim naskah dasar yang kembar; `yehInit_` membawa `sbKey` |
| `Core_Auth.js` | diubah | `yehKunciCermin_` menerbitkan kunci sesi bertanda HMAC; sesi membawa masa berlakunya |
| `Core_Admin.js` | diubah | perubahan kelompok menutup sesi lama; aturan akses dan metadata regulasi didorong ke cermin saat disimpan |
| `Code.js` | diubah | versi 1.5.0; `ping` mengembalikan `fitur{}`; dua menu baru |

Tidak disentuh: `Core_Config.js`, `Core_Dokumen.js`, `Core_Acces.js`, `Core_Audit.js`, `Core_Parser.js`, `Core_Search.js`, `Patch_AdminMembers.js`, `appsscript.json`, `BridgeResponse.html`, `.clasp.json`.
**Tidak ada berkas yang perlu Anda hapus.**

### Berkas web — repo `yayasanekaharap/Pusat_Regulasi_YEH`
Sudah di-commit dan di-push ke `main`.

| Berkas | Keadaan | Isi perubahan |
|---|---|---|
| `cermin.js` | **baru** | Penukar kunci sesi dan pembaca PostgREST, dengan jatuh balik |
| `wrangler.jsonc` | **baru** | Penerbitan ke Worker `pusatregulasi`, aset dari `./build` |
| `package.json`, `package-lock.json` | **baru** | Skrip `build` dan `lint` |
| `build.mjs` | **baru** | Menyalin berkas web ke `build/` — hanya yang didaftarkan yang terbit |
| `eslint.config.mjs` | **baru** | ESLint 9, `no-undef` dan `no-unused-vars` menyala |
| `.gitignore` | **baru** | `node_modules/`, `build/` |
| `supabase/01_reg_cermin.sql` | **baru** | Skema cermin, RLS, pencarian |
| `supabase/functions/regulasi-sesi/index.ts` | **baru** | Edge Function penukar kunci |
| `app.js` | diubah | Jalur baca cermin + jatuh balik, pemulih naskah kembar, panel Diagnosa |
| `config.js` | diubah | `APP_VERSION` 1.5.0, `VERSI_BACKEND_MIN`, `SUPABASE_URL`, `SUPABASE_KEY`. **`API_URL` tidak disentuh** |
| `index.html` | diubah | CSP `connect-src` ditambah host Supabase, memuat `cermin.js`, versi 1.5.0 |
| `.github/workflows/main.yml` | **dihapus** | Penerbitan GitHub Pages tidak dipakai lagi |
| `download` | **dihapus** | Berkas 0 byte tanpa guna |

---

## LANGKAH

### A. Skema Supabase

1. Buka **Supabase › project `yayasanekaharap's Project` › SQL Editor › New query**.
2. Buka berkas `supabase/01_reg_cermin.sql` dari repo, salin **seluruh** isinya, tempel, lalu **Run**.
3. **Hasil yang diharapkan:** `Success. No rows returned`. Beberapa baris `NOTICE ... skipping` wajar dan bukan galat.
4. Berkas ini aman dijalankan ulang bila perlu.

### B. Uji RLS — jangan dilewati

Langkah ini memastikan kunci publik di `config.js` tidak membuka apa pun.

1. Di **SQL Editor**, jalankan:
   ```sql
   select relname, coalesce(array_to_string(relacl,' | '),'(kosong)') as hak
     from pg_class
    where relname in ('reg_regulasi','reg_baris','reg_aturan','reg_meta')
    order by relname;
   ```
2. **Hasil yang diharapkan:** nama `anon` **tidak muncul sama sekali** pada keempat baris. `authenticated` hanya boleh punya `r`. `reg_aturan` tidak boleh menyebut `authenticated`.
3. Bila `anon` masih muncul, berhenti di sini dan beri tahu saya. Jangan lanjut ke langkah berikutnya.

### C. Edge Function dan rahasianya

Langkah ini memakai tiga nilai, dan asalnya **berbeda**. Dua sudah ada dan tinggal disalin; satu belum ada dan Anda yang membuatnya.

| Nilai | Asalnya | Dipakai di |
|---|---|---|
| **JWT Secret project** | **Sudah ada.** Supabase › Settings › API › JWT Settings › JWT Secret, klik *Reveal* | langkah C.4, sebagai `REG_JWT_SECRET` |
| **service_role key** | **Sudah ada.** Supabase › Settings › API › `service_role`, klik *Reveal* | langkah D.2, sebagai `REG_SB_SERVICE_KEY` |
| **Rahasia kunci sesi** | **BELUM ADA. Anda yang membuatnya**, seperti membuat sandi baru | **dua tempat**: langkah C.4 sebagai `REG_TOKEN_SECRET` **dan** langkah D.2 sebagai `REG_TOKEN_SECRET` — harus **sama persis** |

**Tentang rahasia kunci sesi.** Ini sandi bersama antara Apps Script dan Edge Function: Apps Script menandatangani kunci sesi dengan sandi itu, Edge Function memeriksa tanda tangannya dengan sandi yang sama. Tidak diambil dari mana pun, tidak perlu diingat, dan tidak dipakai untuk hal lain. Syaratnya hanya: acak, 40–64 karakter, huruf dan angka, dan nilainya identik di kedua tempat.

Untuk membuatnya, jalankan satu perintah ini di PC lalu salin hasilnya:

```
node -e "const c=require('crypto');const a='abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';const b=c.randomBytes(56);let s='';for(let i=0;i<56;i++)s+=a[b[i]%a.length];console.log(s)"
```

Simpan hasilnya di tempat Anda biasa menyimpan sandi. Nilai itu **tidak** ditulis di sheet mana pun dan **tidak** masuk repo.

1. Siapkan ketiga nilai di atas.
2. Supabase › **Edge Functions › Create a new function**, nama fungsinya **`regulasi-sesi`** (persis, dengan tanda minus).
3. Hapus isi contohnya, lalu tempel seluruh isi `supabase/functions/regulasi-sesi/index.ts` dari repo. **Deploy**.
4. Supabase › **Edge Functions › Secrets › Add new secret**, tambahkan dua secret:

   | Nama secret | Nilai |
   |---|---|
   | `REG_TOKEN_SECRET` | rahasia kunci sesi yang Anda buat di langkah C |
   | `REG_JWT_SECRET` | JWT Secret project (Settings › API › JWT Settings) |

5. **Hasil yang diharapkan:** fungsi berstatus **ACTIVE** dan kedua secret terdaftar.

### D. Script Properties di Apps Script

1. Buka editor Apps Script proyek Pusat Regulasi › **Project Settings** (ikon roda gigi) › **Script Properties › Add script property**.
2. Tambahkan tiga properti:

   | Nama properti | Nilai |
   |---|---|
   | `REG_SB_URL` | `https://dybnqztyxqazhmbywwge.supabase.co` |
   | `REG_SB_SERVICE_KEY` | **service_role** key, dari Supabase › Settings › API › `service_role`. Klik *Reveal* |
   | `REG_TOKEN_SECRET` | rahasia kunci sesi yang sama — **salin-tempel** dari tempat Anda menyimpannya, jangan diketik ulang |

3. **Hasil yang diharapkan:** tiga properti tersimpan.
4. `service_role` key dan rahasia kunci sesi tidak boleh ditulis di sheet mana pun dan tidak boleh masuk repo.
5. Bila `REG_TOKEN_SECRET` di sini berbeda walau satu karakter dari yang di langkah C.4, penukaran kunci ditolak dan web tetap berjalan memakai jalur Apps Script. Gejalanya terlihat di Diagnosa: baris **Tukar kunci sesi** merah dengan pesan *"Kunci sesi tidak sah"*.

### E. Terbitkan Apps Script

Jalankan di PC, di dalam folder `D:\GAS Project\PusatRegulasiYEH`:

```
clasp push
```

**Hasil yang diharapkan:** daftar 12 berkas terkirim, termasuk `Core_Cermin.js`.

Lalu naikkan deployment — `doPost` berubah, jadi langkah ini **wajib**:

```
clasp list-deployments
```

Catat ID deployment yang alamat `/exec`-nya dipakai `config.js`, lalu:

```
clasp deploy -i <DEPLOYMENT_ID>
```

**Hasil yang diharapkan:** deployment naik versi, alamat `/exec` **tetap sama**.

> `clasp deploy` **tanpa** `-i` membuat alamat `/exec` baru, sementara `config.js` menunjuk yang lama. Gejalanya: aplikasi tampak sama sekali tidak berubah. Pada clasp 3.x nama kanoniknya `clasp create-deployment -i <id>`.

### F. Isi cermin dan pasang pemicu

1. Buka **spreadsheet konfigurasi** (`YEH Pusat Regulasi`). Muat ulang halamannya supaya menu terbaru muncul.
2. Menu **Pusat Regulasi › Pasang pemicu cermin**. Setujui permintaan izin bila muncul.
   **Hasil yang diharapkan:** kotak pesan menyebut lima pemicu aktif.
3. Menu **Pusat Regulasi › Segarkan cermin Supabase sekarang**.
   **Hasil yang diharapkan:** kotak pesan menyebut jumlah regulasi tercermin, jumlah baris naskah, dan jumlah aturan akses. Bila ada regulasi yang gagal, namanya disebut.
4. Langkah F.3 membaca 17 sheet sumber sekaligus. Bila terpotong batas waktu, jalankan ulang — aman dijalankan berkali-kali, dan yang sudah tercermin tidak diproses ulang dari nol.

### G. Terbitkan web ke Cloudflare Workers

Worker `pusatregulasi` belum ada, jadi langkah ini dikerjakan sekali.

1. Buka **Cloudflare dashboard › Workers & Pages › Create › Workers › Import a repository**.
2. Pilih repo **`yayasanekaharap/Pusat_Regulasi_YEH`**, branch **`main`**.
3. Isi:

   | Kolom | Nilai |
   |---|---|
   | Worker name | `pusatregulasi` |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | kosongkan |

4. **Create and deploy**.
   **Hasil yang diharapkan:** build selesai, baris terakhirnya `build selesai: 8 berkas di build/`, lalu wrangler menerbitkan ke `https://pusatregulasi.<akun>.workers.dev`.
5. Bila build gagal, baris pertama yang diawali `npm error`, `✘ [ERROR]`, atau `Failed` adalah penyebabnya. Mengulang: tab **Deployments › Retry deployment**.
6. **Jangan mengubah setelan apa pun di Cloudflare selain kolom di atas.** Bila ada yang perlu berubah di sisi penerbitan, ubahnya lewat `wrangler.jsonc` di repo.

### H. Matikan GitHub Pages

1. GitHub › repo `Pusat_Regulasi_YEH` › **Settings › Pages**.
2. Pada **Build and deployment › Source**, pilih **None**. Simpan.
3. **Hasil yang diharapkan:** alamat `https://yayasanekaharap.github.io/Pusat_Regulasi_YEH/` berhenti melayani. Workflow-nya sendiri sudah dihapus dari repo, jadi tidak ada penerbitan baru.
4. Beri tahu pegawai alamat barunya. Alamat lama tidak dialihkan — itu pilihan yang Anda ambil.

---

## PEMERIKSAAN AKHIR

Kerjakan berurutan sesudah build Cloudflare selesai.

1. Buka alamat Worker yang baru, lalu **muat ulang keras**: `Ctrl+Shift+R`.
2. Masuk dengan akun Anda. **Diharapkan:** masuk berhasil seperti biasa.
3. Menu pengguna (pojok kanan atas) › **Diagnosa**.
4. Periksa baris **Versi web** = `1.5.0`.
5. Periksa baris **Versi kode backend** = `1.5.0` dengan lencana hijau.
6. Periksa tabel **Kemampuan backend** di bawah: keenam barisnya harus **hijau**. Satu saja merah berarti ada berkas `gas/` yang belum ikut terbit — ulangi langkah E.
7. Periksa baris **Tukar kunci sesi**: hijau bila ≤ 400 ms.
8. Periksa baris **Baca cermin**: hijau bila ≤ 600 ms, dan jumlah regulasinya sesuai.
9. Periksa baris **Pemicu sumber Supabase** = **terpasang**.
10. Periksa baris **Rekonsiliasi cermin terakhir** menyebut waktu, bukan "belum pernah".
11. Buka satu regulasi yang panjang (mis. *Ketenagakerjaan*). **Diharapkan:** naskah tampil, dan di Diagnosa baris **Sumber data terakhir** berubah menjadi **cermin** dengan lencana *jalur baku*.
12. Pada regulasi itu, ganti **Versi naskah** ke versi dasar (mis. *UU 13/2003*). **Diharapkan:** naskahnya tampil, tidak ada pasal yang kosong. Ini yang menguji penghematan naskah kembar.
13. Nyalakan pembanding: Versi = naskah berlaku, Bandingkan dengan = versi dasar. **Diharapkan:** pasal yang isinya memang sama tidak disorot sebagai perbedaan.
14. Cari satu kata yang Anda tahu ada, mis. `tenaga kerja`. **Diharapkan:** hasil muncul, dan isinya sama dengan hasil pencarian sebelum pemasangan.
15. Uji inti perbaikan B1: buka **spreadsheet sumber**, ubah satu sel naskah pada **satu** sheet saja, simpan. Tunggu ±1 menit. Kembali ke web, menu ⋯ › **Refresh data**. **Diharapkan:** hanya regulasi itu yang dimuat ulang; status pustaka di panel samping tidak kembali ke `0/17`.
16. Uji akses: minta satu pegawai berperan **Pengguna** membuka web. **Diharapkan:** regulasi *Anggaran Dasar YEH* dan *Anggaran Rumah Tangga YEH* **tidak** muncul dalam daftarnya.
17. Alamat GitHub Pages yang lama sudah tidak melayani.

Dua gejala yang mudah dikacaukan:

- **Tukar kunci sesi** merah, pesan *"Kunci sesi tidak sah"* → `REG_TOKEN_SECRET` di langkah C.4 dan D.2 tidak sama.
- **Tukar kunci sesi** hijau tetapi **Baca cermin** merah → yang salah `REG_JWT_SECRET` di langkah C.4. Tanda tangan kunci sesi sudah terbukti cocok; yang ditolak PostgREST adalah JWT-nya.

Bila Diagnosa menyebut *"Cermin Supabase tidak aktif pada sesi ini"*: langkah D belum lengkap. Web tetap benar, hanya masih memakai jalur lama.

---

## CATATAN PENGUJIAN

**Yang sudah diuji, dan hasilnya:**

| Pengujian | Hasil |
|---|---|
| Skema SQL dijalankan pada PostgreSQL 16 lokal dengan peran `anon`/`authenticated`/`service_role` dan *default privileges* Supabase ditirukan | lolos, dan idempoten pada jalan kedua |
| RLS: `anon` tanpa JWT, `authenticated` tanpa klaim, pengguna biasa, anggota kelompok, ADMIN, klaim kelompok rusak | tujuh keadaan, semuanya sesuai `yehAccess_` |
| Kecepatan pada 11.904 baris (skala pustaka sebenarnya) | baca satu regulasi 700 baris: **3 ms**; pencarian seluruh pustaka: **29 ms** |
| Edge Function `regulasi-sesi`: 20 kasus, termasuk muatan dirusak `USER`→`ADMIN` dengan tanda tangan lama, rahasia salah, sesi kedaluwarsa | semua yang harus ditolak, ditolak |
| Pasangan tanda tangan Apps Script ↔ Edge Function, termasuk nama ber-aksen non-ASCII | cocok |
| Logika GAS terhadap kode sungguhan dengan `SpreadsheetApp` ditirukan: penanda revisi per sheet, naskah kembar, `ping fitur{}`, urutan dorongan aturan akses | 22 pemeriksaan lolos |
| Uji akses `/exec`: 12 aksi tanpa token, token diubah, 10 aksi admin dipanggil akun berperan rendah, regulasi TERBATAS, ganti sandi membatalkan token lama | 38 pemeriksaan lolos |
| `npm run lint` web | nol galat |
| Lint berkas `gas` (digabung jadi satu lingkup global seperti cara Apps Script memuatnya, `no-undef` menyala) | nol galat — setiap pemanggilan fungsi punya definisinya |
| `npm ci` dari nol lalu `npm run build` | lolos, 8 berkas, 228 KB, tanpa berkas lain yang ikut terbit |
| Tampilan dengan Playwright pada 1366×768, 1536×864, 1920×1080: jatuh balik saat cermin mati, naskah kembar, pembanding, Diagnosa, gulir mendatar, galat konsol | 33 pemeriksaan lolos |
| Tampilan jalur cermin: naskah dari cermin, `/exec` tidak dipanggil, pencarian lewat RPC, **dan penanda revisi cermin yang belum sama memaksa jalur cadangan** | 16 pemeriksaan lolos |

**Cacat yang ditemukan pengujian sendiri, dan sudah diperbaiki:**

1. Rancangan pertama tabel izin tidak dapat meniru `yehAccess_`: pengguna biasa tanpa aturan khusus kehilangan akses ke regulasi INTERNAL. Diganti dengan cermin aturan `reg_aturan` berikut dimensi kelompok, lalu diuji ulang.
2. Indeks trigram pada `teks_cari` ternyata tidak pernah dipilih planner pada ukuran tabel ini (6,6 ms tanpa indeks, 1,5 ms bila dipaksa — keduanya jauh di bawah ambang 600 ms). Indeksnya dibuang; alasan dan cara menghidupkannya kembali dalam satu baris dicatat di dalam berkas SQL.
3. Panel Diagnosa hanya menjelaskan "800–1.500 ms adalah lantai platform" ketika cermin aktif, padahal penjelasan itu paling dibutuhkan justru saat cermin mati. Sekarang selalu ditampilkan.
4. Rujukan ke fungsi `yehForgetSrc_` yang tidak pernah ada, tertangkap lint sebelum di-push.

**Yang BELUM diuji, dan sebabnya:**

| Hal | Sebab |
|---|---|
| Pemicu `onEdit`/`onChange` pada spreadsheet sumber | Pemicu Apps Script hanya berjalan di lingkungan Google. Pemasangannya diuji dengan `ScriptApp` ditirukan, tetapi penyalaannya oleh suntingan nyata belum. **Pemeriksaan akhir no. 15 adalah uji itu.** |
| Rekonsiliasi terhadap 17 sheet sumber sungguhan | Jaringan keluar ke `script.google.com` dan `supabase.co` diblokir dari workspace saya, jadi saya tidak dapat memanggil `/exec` maupun PostgREST Anda. **Pemeriksaan akhir no. 3–10 adalah uji itu.** |
| Besar penghematan naskah kembar yang sebenarnya | Mekanismenya teruji; besarnya bergantung data. Pada 11 baris pertama sheet *Ketenagakerjaan* yang saya baca, **10 dari 10** baris bernaskah ternyata kembar persis — tetapi itu satu cuplikan, bukan seluruh pustaka. Angka sesungguhnya akan terlihat di baris **Baca naskah terakhir** pada Diagnosa. |
| Keep-alive harian dan rekonsiliasi malam | Berjalan menurut jadwal. Baru terlihat di Diagnosa setelah melewati jam 02.00 dan 14.00. |
| Waktu nyata `/exec` dan cermin dari jaringan Anda | Sebab sama: jaringan keluar diblokir. Angka pada Diagnosa-lah yang berlaku, bukan angka saya. |

**Di luar lingkup paket ini, dan sengaja tidak disentuh:**

- Pertumbuhan sheet `Cfg_Sesi` (temuan B5). Perbaikannya menyentuh jalur login dan tidak dicampur dengan migrasi.
- Dua sheet sumber yang belum terdaftar — `Pelindungan Ketenagakerjaan` dan `PP 30-2026` (temuan C5). Jalankan **Panel Admin › Sinkronisasi** kapan pun Anda siap menampilkannya.
- Kode mati `Patch_AdminMembers.js`, `Core_Parser.js`, `Core_Acces.js`, `Core_Audit.js`, `Core_Search.js`, dan `yehAt_` (temuan C2, C3). Keempat fungsi tak terpakai didaftarkan per nama di `eslint.config.mjs`, bukan disembunyikan dengan pola lebar, supaya utangnya tercatat dan fungsi baru yang tak terpakai tetap tertangkap.
- `GITHUB_PAGES_ORIGIN` di `Cfg_App` yang menunjuk origin aplikasi lain, dan `BridgeResponse.html` (temuan C1). Keduanya kode mati: `api.js` ber-POST langsung dan `doGet` tidak pernah menyajikan bridge itu.
- Nilai usang `VERSI` dan `VERSI_BRIDGE` di `Cfg_App` (temuan C6). Tidak dipakai kode mana pun.
- Repo web dan folder Apps Script masih terpisah (temuan A3). Karena itu lint berkas `gas` dijalankan di sisi saya, bukan oleh `npm run lint` di repo.
