// regulasi-sesi — menukar kunci sesi Apps Script menjadi JWT Supabase jangka pendek.
//
// Masuk  : POST { token: "<kunci sesi dari Apps Script>" }
// Keluar : { ok, data: { access_token, exp, pengguna } }
//
// Fungsi ini TIDAK memeriksa sandi dan TIDAK menyentuh Spreadsheet. Sandi tetap
// diurus Core_Auth.js. Di sini hanya tanda tangan kunci sesi yang diperiksa,
// lalu klaimnya disalin ke JWT yang dimengerti PostgREST dan RLS.
//
// JWT yang diterbitkan berumur PENDEK (15 menit) dan tidak pernah melebihi masa
// sesi Apps Script. Umur pendek itu yang membatasi berapa lama klaim peran dan
// kelompok boleh basi: pengguna yang dikeluarkan dari sebuah kelompok kehilangan
// aksesnya pada penukaran berikutnya, bukan setelah 8 jam.
//
// Dua rahasia wajib disetel di Edge Functions > Secrets:
//   REG_TOKEN_SECRET  sama persis dengan Script Properties di Apps Script
//   REG_JWT_SECRET    JWT Secret project (Settings > API > JWT Settings)
//
// Bila Diagnosa menunjukkan "Tukar kunci sesi" hijau tetapi "Baca cermin" merah,
// yang salah adalah REG_JWT_SECRET — tanda tangan kunci sesi sudah terbukti
// cocok, yang ditolak PostgREST adalah JWT-nya.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TOKEN_SECRET = Deno.env.get("REG_TOKEN_SECRET") ?? "";
const JWT_SECRET = Deno.env.get("REG_JWT_SECRET") ?? "";

/** Umur JWT. Sengaja pendek; lihat catatan di kepala berkas. */
const UMUR_JWT_DETIK = 15 * 60;

const enc = new TextEncoder();

const KEPALA = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function jawab(kode: number, isi: unknown): Response {
  return new Response(JSON.stringify(isi), { status: kode, headers: KEPALA });
}
function gagal(pesan: string, kode = 401): Response {
  return jawab(kode, { ok: false, success: false, message: pesan });
}

function b64urlKeBytes(s: string): Uint8Array {
  const p = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(p + "=".repeat((4 - (p.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesKeB64url(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function teksKeB64url(s: string): string {
  return bytesKeB64url(enc.encode(s));
}

async function hmac(rahasia: string, pesan: string): Promise<Uint8Array> {
  const kunci = await crypto.subtle.importKey(
    "raw", enc.encode(rahasia), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", kunci, enc.encode(pesan)));
}

/** Pembandingan waktu tetap; panjang yang berbeda langsung ditolak. */
function samaAman(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a[i] ^ b[i];
  return beda === 0;
}

/** Hanya menerima senarai teks; bentuk lain jadi senarai kosong, bukan galat. */
function senaraiTeks(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = String(x ?? "").trim();
    if (s) out.push(s);
    if (out.length >= 64) break;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: KEPALA });
  if (req.method !== "POST") return gagal("Hanya POST.", 405);
  if (!TOKEN_SECRET || !JWT_SECRET) {
    return gagal("Rahasia Edge Function belum disetel. Lihat PANDUAN langkah C.", 500);
  }

  let token = "";
  try {
    const body = await req.json();
    token = String((body && body.token) || "");
  } catch (_e) {
    return gagal("Isi permintaan bukan JSON yang valid.", 400);
  }
  if (!token) return gagal("Kunci sesi tidak disertakan.");

  // Bentuk kunci sesi Apps Script: <muatan b64url>.<tanda tangan b64url>
  const potong = token.split(".");
  if (potong.length !== 2) return gagal("Kunci sesi tidak dikenali.");
  const [muatanB64, tandaB64] = potong;

  let harap: Uint8Array;
  try {
    harap = await hmac(TOKEN_SECRET, muatanB64);
  } catch (_e) {
    return gagal("Tanda tangan kunci sesi tidak dapat diperiksa.", 500);
  }
  let diberi: Uint8Array;
  try {
    diberi = b64urlKeBytes(tandaB64);
  } catch (_e) {
    return gagal("Kunci sesi tidak dikenali.");
  }
  if (!samaAman(harap, diberi)) return gagal("Kunci sesi tidak sah.");

  let muatan: Record<string, unknown>;
  try {
    muatan = JSON.parse(new TextDecoder().decode(b64urlKeBytes(muatanB64)));
  } catch (_e) {
    return gagal("Muatan kunci sesi tidak terbaca.");
  }

  const sekarang = Math.floor(Date.now() / 1000);
  const sesiExp = Number(muatan.exp || 0);
  if (!sesiExp || sesiExp <= sekarang) {
    return gagal("Sesi berakhir. Silakan masuk kembali.");
  }

  const idPengguna = String(muatan.u || "");
  const peran = String(muatan.p || "");
  if (!idPengguna || !peran) return gagal("Muatan kunci sesi tidak lengkap.");

  // JWT berumur pendek, dan tidak pernah melebihi masa sesi Apps Script.
  const exp = Math.min(sesiExp, sekarang + UMUR_JWT_DETIK);

  const kepalaJwt = teksKeB64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const klaim = teksKeB64url(JSON.stringify({
    iss: "regulasi-sesi",
    aud: "authenticated",
    role: "authenticated",
    sub: idPengguna,
    peran: peran,
    grup: senaraiTeks(muatan.g),
    iat: sekarang,
    exp: exp,
  }));
  const isi = kepalaJwt + "." + klaim;
  const tanda = bytesKeB64url(await hmac(JWT_SECRET, isi));

  return jawab(200, {
    ok: true,
    success: true,
    data: {
      access_token: isi + "." + tanda,
      exp: exp,
      pengguna: {
        id: idPengguna,
        nama: String(muatan.n || ""),
        peran: peran,
      },
    },
  });
});
