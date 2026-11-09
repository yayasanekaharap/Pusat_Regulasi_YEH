/* ==========================================================================
   PUSAT REFERENSI REGULASI YEH — perbaikan jalur pencarian cermin
   Berkas 02. Jalankan SEKALI TEMPEL di SQL Editor Supabase, sesudah berkas 01.

   Sebab: berkas 01 menaruh fungsi pencarian di schema reg sebagai
   reg.cari_isi. PostgREST hanya menyajikan schema yang diekspos project —
   bawaannya hanya public — sehingga pemanggilan /rest/v1/rpc/cari_isi dari web
   dijawab 404 PGRST202 "no matches were found in the schema cache", dan
   pencarian lewat cermin tidak pernah berjalan. Ini tidak terlihat pada uji
   tampilan karena RPC-nya ditirukan di sana.

   Perbaikan: fungsinya dipindah ke public dengan nama berawalan reg_, mengikuti
   konvensi tabel. Tetap SECURITY INVOKER, jadi RLS tetap yang menjaga: hanya
   regulasi yang boleh dibaca pengguna yang ikut terpindai.

   Aman dijalankan ulang.
   ========================================================================== */

/* Kutipan tetap di schema reg: hanya dipakai di dalam, tidak lewat PostgREST. */

create or replace function public.reg_cari_isi(
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

comment on function public.reg_cari_isi(text, text, integer) is
  'Pencarian isi pasal untuk web. Semua kata harus muncul sebagai substring, sama dengan pencarian lokal di app.js. SECURITY INVOKER, jadi RLS tetap menyaring.';

/* PENTING: create function memberi EXECUTE kepada PUBLIC secara bawaan, dan
   mencabutnya dari anon saja TIDAK cukup — anon tetap mendapatkannya lewat
   PUBLIC. Jadi PUBLIC dicabut lebih dahulu, baru authenticated diberi. */
revoke all on function public.reg_cari_isi(text, text, integer) from public;
revoke all on function public.reg_cari_isi(text, text, integer) from anon;
grant execute on function public.reg_cari_isi(text, text, integer) to authenticated;

/* Salinan di schema reg dibuang supaya tidak ada dua versi yang bisa berbeda.
   Tidak ada policy atau fungsi lain yang memanggilnya. */
drop function if exists reg.cari_isi(text, text, integer);
