# PANDUAN Pemasangan — Pusat Referensi Regulasi YEH v1.6.0-a

**Tanggal:** 9 November 2026
**Versi sebelumnya yang disyaratkan:** v1.5.0 terpasang dan berjalan
**Versi sesudah paket ini:** web 1.6.0, kode Apps Script tetap 1.5.0

Tahap **a** dari tiga tahap pemindahan ke standar penuh (Vite + React, satu repo).

---

## Yang dikerjakan tahap ini, dan yang TIDAK

**Dikerjakan:**

- Repo pindah ke tata letak standar: `gas/`, `src/`, `public/`, `supabase/`, dengan `.clasp.json` dan `.claspignore` di akar.
- Build memakai **Vite 7 + React 18**. Berkas web menjadi modul ES, bukan lagi skrip global.
- Kerangka halaman dirender React.
- `npm run lint` kini mencakup **`src` dan `gas`**, dengan pemeriksaan tambahan yang menggabungkan berkas `gas` menjadi satu lingkup — persis cara Apps Script memuatnya — sehingga fungsi yang tidak pernah dipanggil ikut tertangkap.

**TIDAK dikerjakan, dan ini disengaja:** tidak ada satu pun logika halaman yang dipindahkan ke komponen React. Halaman naskah, pencarian, penanda, kategori, Panel Admin, dan Diagnosa masih dijalankan perender lama di `src/app.js`, yang isinya **tidak diubah**. Kerangka React merendernya sekali, lalu perender lama memakai elemen itu lewat id yang sama seperti sebelumnya.

Alasannya: tahap pertama yang mengganti sistem build **dan** membongkar 1.583 baris sekaligus membuat setiap kerusakan tidak bisa dilacak ke salah satunya. Tahap a hanya memindahkan fondasi, dan buktinya 74 pemeriksaan yang sama tetap hijau. Tahap b memindahkan halaman naskah, tahap c memindahkan Panel Admin dan Diagnosa.

Jadi: **tidak ada perubahan yang akan Anda lihat di layar.** Itu hasil yang diharapkan.

---

## ISI PERUBAHAN

| Berkas | Keadaan | Isi perubahan |
|---|---|---|
| `gas/` (14 berkas) | **baru di repo** | Seluruh berkas Apps Script masuk repo. Isinya **identik** dengan yang sudah ter-deploy — tidak ada satu baris pun yang berubah |
| `.clasp.json` | **baru di repo** | `scriptId` sama, `rootDir` menunjuk `gas` |
| `.claspignore` | **baru** | Sengaja tanpa aturan; alasannya ditulis di dalam berkasnya |
| `src/` | dipindah | `app.js`, `api.js`, `store.js`, `cermin.js`, `config.js`, `style.css` pindah ke sini dan menjadi modul ES |
| `src/App.jsx` | **baru** | Kerangka halaman sebagai komponen React |
| `src/index.jsx` | **baru** | Titik masuk: memasang React, lalu menjalankan perender lama |
| `vite.config.js` | **baru** | `base './'`, `outDir build`, tanpa sourcemap, polyfill modulepreload dimatikan |
| `index.html` | diubah | Hanya `<div id="akar">` dan satu `<script type="module">`. CSP tidak berubah |
| `eslint.config.mjs` | diubah | Mencakup `src` dan `gas`; daftar global `gas` dipanen dari berkasnya sendiri |
| `scripts/lint-gas.mjs` | **baru** | Pemeriksaan gabungan berkas `gas` |
| `package.json` | diubah | Vite, React, versi 1.6.0, `lint` mencakup gas |
| `src/config.js` | diubah | `APP_VERSION` menjadi `1.6.0`. `API_URL`, `SUPABASE_URL`, dan `SUPABASE_KEY` **tidak disentuh** |
| `build.mjs` | **dihapus** | Digantikan Vite |
| `assets/` | dipindah | Menjadi `public/assets/` |

Tidak berubah: `wrangler.jsonc`, `supabase/`, dan seluruh isi `gas/`.

---

## LANGKAH

### A. Ambil perubahannya

1. GitHub Desktop → **Fetch origin** → **Pull origin**.
2. **Hasil yang diharapkan:** folder repo Anda kini memuat `gas/`, `src/`, `public/`, `scripts/`, dan `.clasp.json`.

### B. Tunggu Cloudflare

1. Cloudflare membangun sendiri begitu push masuk. Perintah build-nya **tidak berubah** — tetap `npm run build`, hanya isinya sekarang Vite.
2. **Hasil yang diharapkan:** build selesai, baris terakhirnya `✓ built in …` dan daftar empat berkas keluaran di `build/`.
3. Bila gagal, baris pertama yang diawali `npm error`, `✘ [ERROR]`, atau `Failed` adalah penyebabnya. Mengulang: tab **Deployments › Retry deployment**.
4. **Jangan mengubah setelan apa pun di Cloudflare.** Tidak ada yang perlu diubah pada tahap ini.

### C. Apps Script — TIDAK ADA yang perlu di-push

Isi `gas/` identik dengan yang sudah ter-deploy, jadi **jangan jalankan `clasp push` pada tahap ini.** Tidak ada yang berubah untuk didorong, dan menjalankannya hanya menambah risiko tanpa manfaat.

Yang berubah adalah **letaknya** untuk paket-paket berikutnya:

- Mulai paket berikut yang menyentuh Apps Script, `clasp push` dijalankan dari **folder repo**, bukan dari `D:\GAS Project\PusatRegulasiYEH`.
- **Jangan hapus folder lama itu.** Simpan sebagai cadangan.
- Pada `clasp push` pertama dari folder repo nanti, **periksa dulu daftar berkas yang akan terkirim**: harus 14 berkas dari `gas/` dan tidak boleh memuat `index.html` atau apa pun dari `src/`. Bila daftarnya tidak demikian, **hentikan dan beri tahu saya** — berarti `rootDir` tidak terbaca sebagaimana mestinya di versi clasp Anda. Ini satu-satunya bagian paket ini yang tidak dapat saya uji sendiri, karena clasp memerlukan otentikasi akun Google Anda.

---

## PEMERIKSAAN AKHIR

1. Buka alamat Worker, lalu **muat ulang keras**: `Ctrl+Shift+R`.
2. Masuk dengan akun Anda. **Diharapkan:** berhasil seperti biasa.
3. Menu pengguna → **Diagnosa**. Periksa baris **Versi web** = `1.6.0`.
4. Periksa baris **Versi kode backend** = `1.5.0`, dan lencananya **hijau**. Ini benar, bukan ketidakcocokan: ambangnya `VERSI_BACKEND_MIN` = 1.5.0, dan hijau berarti "sama atau lebih baru" — paket ini hanya menyentuh web, jadi backend memang tidak perlu dinaikkan.
5. Tabel **Kemampuan backend**: keenam barisnya tetap hijau.
6. Buka satu regulasi panjang. **Diharapkan:** naskah tampil, dan baris **Sumber data terakhir** berbunyi *cermin · jalur baku*.
7. Ganti **Versi naskah** ke versi dasar. **Diharapkan:** tidak ada pasal kosong.
8. Nyalakan pembanding versi. **Diharapkan:** perbedaan tersorot; pasal yang sama tidak.
9. Cari satu kata lewat kotak cari di bilah atas. **Diharapkan:** hasil muncul seperti sebelumnya.
10. Buka satu regulasi, tekan **Cari** di bilah naskah, ketik satu kata. **Diharapkan:** jumlah temuan muncul dan tersorot.
11. Buka panel **Daftar isi**, klik salah satu pasal. **Diharapkan:** naskah bergulir ke pasal itu.
12. Tandai satu pasal lewat menu ⋯ di barisnya, lalu buka **Penanda saya**. **Diharapkan:** pasal itu terdaftar.
13. Buka **Panel Admin**, klik kelima tabnya satu per satu. **Diharapkan:** semuanya memuat tabel, tidak ada yang kosong atau galat.
14. Tekan **Keluar**, lalu masuk kembali. **Diharapkan:** normal.
15. Buka web di ponsel. **Diharapkan:** tidak ada gulir ke samping, dan tombol panel samping bekerja.

Bila ada satu saja langkah di atas yang tidak sesuai, beri tahu saya langkah nomor berapa — tahap b belum dikerjakan, jadi memutar balik tahap a cukup dengan satu Revert di GitHub Desktop.

---

## CATATAN PENGUJIAN

**Garis dasar.** Sebelum menyentuh apa pun, harness Playwright diperluas dari 33 menjadi **74 pemeriksaan**, lalu dijalankan terhadap build v1.5.0 sampai hijau seluruhnya. Setiap kegagalan sesudah itu karena perubahan paket ini, bukan keadaan sebelumnya.

Cakupan 74 pemeriksaan: layar Masuk termasuk sandi salah, ganti sandi wajib termasuk keempat syaratnya, kerangka dan sidebar, tujuh rute, saringan judul, halaman naskah, pergantian versi naskah, pembanding versi dan "hanya yang berbeda", cari-dalam-naskah, daftar isi, cetak sampai `window.print` terpanggil, penanda pasal dari menandai sampai tampil di halaman Penanda, kelima tab Panel Admin, gulir mendatar di 1366×768, 1536×864, 1920×1080, dan 390×844, Back/Forward, serta galat konsol di setiap skenario.

| Pengujian | Hasil |
|---|---|
| Harness 74 pemeriksaan terhadap build v1.5.0 (garis dasar) | hijau seluruhnya |
| Harness 74 pemeriksaan terhadap build v1.6.0-a | hijau seluruhnya |
| **Kontrol:** harness yang sama, sesudah disesuaikan, dijalankan ulang terhadap build v1.5.0 | hijau seluruhnya — membuktikan penyesuaian harness netral, bukan menutupi regresi |
| `npm ci` dari nol lalu `npm run build` | lolos, 32 modul, 4 berkas keluaran |
| `index.html` hasil build diperiksa tidak memuat skrip inline | tidak ada — CSP `script-src 'self'` tetap aman |
| `npm run lint` (`eslint src gas` + pemeriksaan gabungan) | nol galat |
| **Bukti pemeriksa bekerja:** pemanggilan ke fungsi yang tidak ada ditanam sengaja di `gas/Core_Parser.js` | tertangkap di berkas dan baris yang benar, lalu dipulihkan |

**Cacat yang ditemukan pengujian sendiri, dan sudah diperbaiki:**

1. Naskah tiruan di harness terlalu pendek, sehingga halamannya tidak dapat bergulir dan uji daftar isi tidak membuktikan apa pun. Diganti dengan naskah 150+ baris, yang sekaligus membuat perenderan bertahap ikut teruji.
2. Uji cetak gagal karena gulir halus dari uji sebelumnya belum selesai — Playwright menolak mengklik elemen yang belum diam. Dugaan pertama saya tabrakan z-index; diperiksa dan **salah**: item menunya memang elemen teratas di titiknya. Harness diberi penenang halaman.
3. `esbuild.loader` di `vite.config.js` saja tidak cukup pada Vite 7 — JSX di berkas `.js` sampai ke Rollup dan ditolak. Dua berkas React baru diberi ekstensi `.jsx`; berkas lama tetap `.js` karena memang tidak memuat JSX, jadi larangan "jangan ganti nama puluhan berkas" tetap dihormati.
4. Pemeriksaan gabungan berkas `gas` awalnya menulis berkas sementara di luar folder proyek, dan ESLint menjawab *"File ignored because outside of base path"* — nol galat yang menyesatkan. Berkasnya dipindah ke dalam repo, dan ditambahkan penjaga yang menggagalkan pemeriksaan bila ESLint mengabaikan berkasnya.
5. Satu kegagalan harness pada layar ganti sandi ternyata perlombaan waktu, bukan regresi: `showChange` memasang `focus()` lewat `setTimeout` 40 ms, dan build React memuat satu bongkahan tambahan sehingga urutannya bergeser. Jeda tetap diganti menunggu kondisi, lalu dibuktikan netral lewat uji kontrol di tabel di atas.

**Yang BELUM diuji, dan sebabnya:**

| Hal | Sebab |
|---|---|
| `clasp push` dari folder repo dengan `rootDir: "gas"` | clasp memerlukan otentikasi akun Google Anda, dan jaringan keluar dari workspace saya diblokir. **Langkah C adalah pemeriksaan itu**, dan saya sengaja memintanya dilakukan dengan memeriksa daftar berkas lebih dahulu, bukan dengan langsung mendorong |
| Tampilan sesungguhnya di peramban Anda | Harness memakai backend tiruan. Pemeriksaan akhir no. 1–15 adalah uji itu |
| Cetak ke printer atau PDF sungguhan | Yang teruji hanya sampai `window.print` terpanggil; dialog cetak milik sistem operasi |

**Di luar lingkup tahap ini:** seluruh temuan forensik yang belum disentuh (B5, C1, C2/C3, C6, C8) masih belum disentuh, dan halaman-halaman masih dijalankan perender lama. Keduanya memang bukan bagian tahap a.
