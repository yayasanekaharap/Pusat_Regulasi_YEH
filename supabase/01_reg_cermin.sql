/* ==========================================================================
   PUSAT REFERENSI REGULASI YEH — cermin baca Supabase
   Berkas 01. Jalankan SEKALI TEMPEL di SQL Editor Supabase.

   Yang dibuat berkas ini:
     - skema reg (fungsi penjaga akses)
     - tabel public.reg_regulasi, reg_baris, reg_aturan, reg_meta
     - RLS enable + force pada keempat tabel, SEBELUM satu baris pun masuk
     - peran anon dicabut seluruhnya; pembacaan hanya untuk JWT jangka pendek
       terbitan Edge Function regulasi-sesi
     - pencarian isi pasal lewat reg.cari_isi(), semantik sama dengan
       pencarian lama: semua kata harus muncul sebagai substring

   Penjaga akses di sini adalah SALINAN aturan Cfg_Akses, bukan tafsir ulang:
     ADMIN                      -> semua
     ada aturan TOLAK yang cocok -> ditolak, TOLAK selalu menang
     regulasi INTERNAL           -> boleh, sama seperti hari ini
     regulasi TERBATAS           -> perlu aturan IZIN yang cocok
   Regulasi yang tidak dikenal diperlakukan sebagai TERBATAS (gagal-tertutup).

   Spreadsheet tetap sumber kebenaran. Arah tulis satu saja:
   Sheet -> Supabase. Web tidak pernah menulis ke tabel ini.

   Aman dijalankan ulang.
   ========================================================================== */

create extension if not exists pg_trgm with schema extensions;

/* ---------- 1. Skema penjaga ---------- */

create schema if not exists reg;

revoke all on schema reg from anon;
grant usage on schema reg to authenticated;

/* Klaim JWT dibaca dari request.jwt.claims, pola yang sama dengan skema yeh_rtl. */
create or replace function reg.klaim(k text) returns text
  language sql stable
  set search_path to 'pg_catalog', 'pg_temp'
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> k, '');
$$;

create or replace function reg.uid() returns text
  language sql stable
  set search_path to 'pg_catalog', 'pg_temp'
as $$ select lower(reg.klaim('sub')); $$;

create or replace function reg.peran() returns text
  language sql stable
  set search_path to 'pg_catalog', 'pg_temp'
as $$ select upper(reg.klaim('peran')); $$;

/* Kelompok pengguna, dari klaim "grup" berupa senarai JSON. Klaim yang bukan
   senarai diperlakukan sebagai kosong, tidak menggagalkan permintaan. */
create or replace function reg.grup() returns text[]
  language sql stable
  set search_path to 'pg_catalog', 'pg_temp'
as $$
  with j as (
    select coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'grup',
      '[]'::jsonb) as g
  )
  select coalesce(
    (select array_agg(lower(x))
       from j, jsonb_array_elements_text(j.g) as x
      where jsonb_typeof(j.g) = 'array'),
    '{}'::text[]);
$$;

/* ---------- 2. Tabel ---------- */

create table if not exists public.reg_meta (
  kunci      text primary key,
  nilai      text        not null default '',
  diperbarui timestamptz not null default now()
);
comment on table public.reg_meta is
  'Status cermin: rekonsiliasi terakhir, keep-alive, pemicu sumber terpasang. Dibaca panel Diagnosa.';

create table if not exists public.reg_regulasi (
  id_regulasi    text primary key,
  judul          text        not null default '',
  kelompok       text        not null default '',
  rev            text        not null default '',
  terbatas       boolean     not null default false,
  versi_default  text        not null default 'utuh',
  versi_tersedia jsonb       not null default '[]'::jsonb,
  jumlah_baris   integer     not null default 0,
  diperbarui     timestamptz not null default now()
);
comment on column public.reg_regulasi.rev is
  'Penanda revisi PER SHEET. Berubah hanya bila sheet sumbernya sendiri disunting.';

create table if not exists public.reg_baris (
  id_regulasi   text    not null
                references public.reg_regulasi(id_regulasi) on delete cascade,
  baris         integer not null,
  rev           text    not null default '',
  bab           text    not null default '',
  pasal         text    not null default '',
  ayat          text    not null default '',
  poin          text    not null default '',
  subpoin       text    not null default '',
  bab_berlaku   text    not null default '',
  pasal_berlaku text    not null default '',
  t             jsonb   not null default '{}'::jsonb,
  sama          boolean not null default false,
  teks_cari     text    not null default '',
  primary key (id_regulasi, baris)
);
comment on column public.reg_baris.rev is
  'Revisi sheet saat baris ini dicerminkan. Pendorong menyisipkan baris baru lebih dahulu, baru menghapus baris ber-rev lama — sehingga tidak ada jeda ketika regulasi kosong di cermin.';
comment on column public.reg_baris.sama is
  'TRUE bila naskah dasar identik dengan naskah berlaku. Bila TRUE, t tidak memuat kunci dasar dan web menurunkannya saat render.';
comment on column public.reg_baris.bab_berlaku is
  'BAB dan Pasal yang berlaku untuk baris ini, sudah diisi-turun saat pencerminan, supaya pencarian tidak perlu menelusuri baris di atasnya.';
comment on column public.reg_baris.teks_cari is
  'Naskah gabungan huruf kecil untuk pencarian substring. Berindeks trigram.';

create table if not exists public.reg_aturan (
  id_regulasi text not null,
  tipe_subjek text not null,
  id_subjek   text not null,
  efek        text not null,
  primary key (id_regulasi, tipe_subjek, id_subjek)
);
comment on table public.reg_aturan is
  'Cermin baris aktif Cfg_Akses. tipe_subjek USER atau GRUP; efek IZIN atau TOLAK. Hanya aturan eksplisit yang didaftar.';

/* Tidak ada indeks trigram pada teks_cari, dan itu disengaja. Diukur pada
   11.904 baris (ukuran pustaka sebenarnya): pemindaian berurutan 6,6 ms,
   dengan indeks GIN trigram 1,5 ms — tetapi planner tidak pernah memilih
   indeksnya karena tabel sejumlah itu lebih murah dipindai langsung. Indeksnya
   memakan 8 MB dan menambah beban tulis pada setiap rekonsiliasi, sementara
   keduanya jauh di bawah ambang 600 ms. Bila pustaka tumbuh beberapa kali
   lipat, hidupkan kembali dengan satu baris:
     create index reg_baris_cari_idx
       on public.reg_baris using gin (teks_cari extensions.gin_trgm_ops);
   Ekstensi pg_trgm sengaja tetap dipasang supaya baris itu langsung jalan. */
create index if not exists reg_aturan_subjek_idx
  on public.reg_aturan (tipe_subjek, id_subjek);
create index if not exists reg_baris_rev_idx
  on public.reg_baris (id_regulasi, rev);
create index if not exists reg_regulasi_kelompok_idx
  on public.reg_regulasi (kelompok);

/* ---------- 3. RLS: dinyalakan sebelum data masuk ---------- */

alter table public.reg_meta     enable row level security;
alter table public.reg_meta     force  row level security;
alter table public.reg_regulasi enable row level security;
alter table public.reg_regulasi force  row level security;
alter table public.reg_baris    enable row level security;
alter table public.reg_baris    force  row level security;
alter table public.reg_aturan   enable row level security;
alter table public.reg_aturan   force  row level security;

/* Peran anon tidak punya hak apa pun di sini. Kunci publik yang terbungkus di
   dalam berkas JavaScript karena itu tidak membuka satu baris pun. */
revoke all on public.reg_meta     from anon;
revoke all on public.reg_regulasi from anon;
revoke all on public.reg_baris    from anon;
revoke all on public.reg_aturan   from anon;

/* Pengguna yang sudah menukar kunci sesi hanya boleh MEMBACA. */
revoke all on public.reg_meta     from authenticated;
revoke all on public.reg_regulasi from authenticated;
revoke all on public.reg_baris    from authenticated;
revoke all on public.reg_aturan   from authenticated;
grant select on public.reg_meta     to authenticated;
grant select on public.reg_regulasi to authenticated;
grant select on public.reg_baris    to authenticated;
/* reg_aturan TIDAK diberikan ke authenticated: siapa boleh membaca apa bukan
   informasi yang perlu dilihat pengguna. Penjaga di bawah membacanya sendiri
   dengan hak pemilik fungsi. */

/* ---------- 4. Penjaga akses ---------- */

/* Satu keputusan untuk satu regulasi. Salinan yehAccess_ di Apps Script. */
create or replace function reg.boleh_baca(p_id text) returns boolean
  language sql stable security definer
  set search_path to 'pg_catalog', 'pg_temp'
as $$
  with u as (
    select reg.uid() as uid, reg.peran() as peran, reg.grup() as grup
  ), cocok as (
    select upper(a.efek) as efek
      from public.reg_aturan a, u
     where a.id_regulasi = p_id
       and ( (upper(a.tipe_subjek) = 'USER' and lower(a.id_subjek) = u.uid)
          or (upper(a.tipe_subjek) = 'GRUP' and lower(a.id_subjek) = any (u.grup)) )
  )
  select case
    when (select uid   from u) = ''      then false
    when (select peran from u) = 'ADMIN' then true
    when exists (select 1 from cocok where efek = 'TOLAK') then false
    when not coalesce(
           (select terbatas from public.reg_regulasi where id_regulasi = p_id),
           true)                         then true
    else exists (select 1 from cocok where efek = 'IZIN')
  end;
$$;

/* Daftar regulasi yang terlihat. Tanpa argumen dan STABLE, sehingga dihitung
   sekali per permintaan — bukan sekali per baris naskah. Itu yang menjaga
   pembacaan 11 ribu baris tetap cepat. */
create or replace function reg.regulasi_terlihat() returns text[]
  language sql stable security definer
  set search_path to 'pg_catalog', 'pg_temp'
as $$
  select coalesce(
    (select array_agg(r.id_regulasi)
       from public.reg_regulasi r
      where reg.boleh_baca(r.id_regulasi)),
    '{}'::text[]);
$$;

revoke all on function reg.klaim(text)          from anon;
revoke all on function reg.uid()                from anon;
revoke all on function reg.peran()              from anon;
revoke all on function reg.grup()               from anon;
revoke all on function reg.boleh_baca(text)     from anon;
revoke all on function reg.regulasi_terlihat()  from anon;
grant execute on function reg.boleh_baca(text)    to authenticated;
grant execute on function reg.regulasi_terlihat() to authenticated;

drop policy if exists reg_regulasi_baca on public.reg_regulasi;
create policy reg_regulasi_baca on public.reg_regulasi
  for select to authenticated
  using (id_regulasi = any (reg.regulasi_terlihat()));

drop policy if exists reg_baris_baca on public.reg_baris;
create policy reg_baris_baca on public.reg_baris
  for select to authenticated
  using (id_regulasi = any (reg.regulasi_terlihat()));

drop policy if exists reg_meta_baca on public.reg_meta;
create policy reg_meta_baca on public.reg_meta
  for select to authenticated
  using (reg.uid() <> '');

/* reg_aturan sengaja tanpa policy: tidak terbaca anon maupun authenticated. */

/* ---------- 5. Pencarian isi pasal ---------- */

/* Kutipan di sekitar kata pertama yang ditemukan, meniru perilaku lama:
   110 karakter sebelum, 340 karakter dibawa. */
create or replace function reg.kutipan(p_teks text, p_kata text) returns text
  language sql immutable
  set search_path to 'pg_catalog', 'pg_temp'
as $$
  with p as (
    select greatest(0,
      coalesce(nullif(position(lower(p_kata) in lower(p_teks)), 0), 1) - 1) as pos
  ), s as (
    select greatest(0, pos - 110) as mulai from p
  )
  select case when (select mulai from s) > 0 then '… ' else '' end
      || substr(p_teks, (select mulai from s) + 1, 340)
      || case when (select mulai from s) + 340 < length(p_teks) then ' …' else '' end;
$$;

/* Semua kata harus muncul sebagai substring, tidak peka huruf besar/kecil —
   sama dengan yehSearch_ dan pencarian lokal di app.js. Fungsi ini SECURITY
   INVOKER, jadi RLS tetap berlaku: regulasi yang tidak boleh dibaca pengguna
   tidak pernah ikut terpindai. */
create or replace function reg.cari_isi(
  p_q        text,
  p_kelompok text    default '',
  p_batas    integer default 120)
returns table (
  id_regulasi text, judul text, kelompok text, baris integer,
  bab text, pasal text, ayat text, poin text, kutipan text)
  language sql stable
  set search_path to 'pg_catalog', 'pg_temp'
as $$
  with k as (
    select array_remove(
             string_to_array(
               btrim(regexp_replace(lower(coalesce(p_q, '')), '\s+', ' ', 'g')), ' '),
             '') as w
  )
  select b.id_regulasi, r.judul, r.kelompok, b.baris,
         b.bab_berlaku, b.pasal_berlaku, b.ayat, b.poin,
         reg.kutipan(
           coalesce(nullif(b.t->>'utuh', ''), b.t->>'dasar', ''),
           (select w[1] from k))
    from public.reg_baris b
    join public.reg_regulasi r on r.id_regulasi = b.id_regulasi
   where cardinality((select w from k)) > 0
     and (p_kelompok = '' or p_kelompok is null or r.kelompok = p_kelompok)
     and b.teks_cari like '%' || (select w[1] from k) || '%'
     and (select bool_and(b.teks_cari like '%' || x || '%')
            from unnest((select w from k)) as x)
   order by r.kelompok, r.judul, b.baris
   limit greatest(1, least(200, coalesce(p_batas, 120)));
$$;

revoke all on function reg.kutipan(text, text)              from anon;
revoke all on function reg.cari_isi(text, text, integer)    from anon;
grant execute on function reg.cari_isi(text, text, integer) to authenticated;

/* ---------- 6. Baris status awal ---------- */

insert into public.reg_meta (kunci, nilai) values
  ('skema_versi',         '1.5.0'),
  ('cermin_terakhir',     ''),
  ('keep_alive_terakhir', ''),
  ('pemicu_sumber',       'TIDAK'),
  ('versi_kode',          '')
on conflict (kunci) do nothing;
