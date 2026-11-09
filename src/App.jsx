/*
 * Kerangka halaman. Dirender React SATU KALI dan tidak pernah dirender ulang:
 * komponen di berkas ini tidak punya state yang mengubah DOM-nya.
 *
 * Itu disengaja untuk tahap v1.6.0-a. Perender halaman lama (src/app.js) masih
 * memakai elemen di bawah lewat id — #content, #regList, #paneToc, #dlg,
 * #toast, dan seterusnya — serta memasang penangan peristiwa padanya. Bila
 * React merender ulang subpohon ini, penangan itu akan lepas. Tahap b dan c
 * memindahkan halaman satu per satu ke komponen, dan state baru boleh masuk
 * ke sini pada tahap itu, bukan sekarang.
 */
import React, { useEffect } from 'react';

const LOGO = 'assets/logo.png';

function Boot() {
  return (
    <div id="viewBoot" className="boot">
      <img src={LOGO} alt="" />
      <span className="spinner"></span>
    </div>
  );
}

function LayarMasuk() {
  return (
    <main id="viewLogin" className="auth" hidden>
      <div className="auth-card">
        <img className="auth-logo" src={LOGO} alt="Logo Yayasan Eka Harap" />
        <h1>Pusat Referensi Regulasi</h1>
        <p className="muted">Yayasan Eka Harap · khusus pegawai terdaftar</p>
        <form id="loginForm" noValidate>
          <label className="field">
            <span>User ID</span>
            <input name="userId" autoComplete="username" autoCapitalize="none" spellCheck="false" required />
          </label>
          <label className="field">
            <span>Sandi</span>
            <span className="pw">
              <input name="password" type="password" autoComplete="current-password" required />
              <button type="button" className="pw-toggle">Lihat</button>
            </span>
          </label>
          <p className="form-msg" id="loginMsg" role="alert"></p>
          <button className="btn primary block" type="submit">Masuk</button>
        </form>
        <p className="hint">Lupa sandi? Hubungi admin untuk diatur ulang.</p>
      </div>
    </main>
  );
}

function LayarGantiSandi() {
  return (
    <main id="viewChange" className="auth" hidden>
      <div className="auth-card" id="changeCard"></div>
    </main>
  );
}

function BilahAtas() {
  return (
    <header className="topbar" id="topbar">
      <button className="icon-btn hide-wide" id="btnDrawer" type="button" aria-label="Buka panel" data-icon="menu"></button>
      <div className="navbtns">
        <button className="icon-btn" id="btnBack" type="button" aria-label="Kembali" title="Kembali" data-icon="arrowLeft" disabled></button>
        <button className="icon-btn" id="btnFwd" type="button" aria-label="Maju" title="Maju" data-icon="arrowRight" disabled></button>
      </div>
      <a className="brand" href="#/">
        <img src={LOGO} alt="" />
        <span><strong>Pusat Referensi Regulasi</strong><small>Yayasan Eka Harap</small></span>
      </a>
      <form className="topsearch" id="searchForm" role="search">
        <span className="ts-icon" data-icon="search"></span>
        <input id="searchInput" type="search" placeholder="Cari isi pasal di semua regulasi…"
          aria-label="Cari isi pasal" enterKeyHint="search" autoComplete="off" />
        <button className="btn accent" type="submit">Cari</button>
      </form>
      <button className="icon-btn only-phone" id="btnSearchToggle" type="button" aria-label="Cari" data-icon="search"></button>
      <button className="user-btn" id="btnUser" type="button" aria-haspopup="menu">
        <span className="avatar" id="avatar"></span>
        <span className="user-name" id="userName"></span>
        <span className="chev" data-icon="chevDown"></span>
      </button>
    </header>
  );
}

function PanelSamping() {
  return (
    <aside className="sidebar" id="sidebar" aria-label="Panel samping">
      <nav className="side-nav">
        <a href="#/" data-nav="home" title="Beranda">
          <span className="ic" data-icon="home"></span><span className="lb">Beranda</span>
        </a>
        <a href="#/penanda" data-nav="marks" title="Penanda saya">
          <span className="ic" data-icon="star"></span><span className="lb">Penanda saya</span>
          <b className="count" id="markCount"></b>
        </a>
        <a href="#/admin" data-nav="admin" id="navAdmin" title="Panel Admin" hidden>
          <span className="ic" data-icon="settings"></span><span className="lb">Panel Admin</span>
        </a>
      </nav>
      <div className="side-tabs" role="tablist">
        <button type="button" role="tab" data-tab="regs" title="Daftar regulasi">
          <span className="ic" data-icon="book"></span><span className="lb">Regulasi</span>
        </button>
        <button type="button" role="tab" data-tab="toc" title="Daftar isi naskah">
          <span className="ic" data-icon="list"></span><span className="lb">Daftar isi</span>
        </button>
      </div>
      <div className="side-pane" id="paneRegs">
        <div className="pane-tools">
          <input id="filterInput" type="search" placeholder="Saring judul…" aria-label="Saring judul regulasi" />
          <button className="icon-btn sm" id="btnFoldAll" type="button" title="Lipat / buka semua kategori" data-icon="fold"></button>
        </div>
        <nav id="regList" className="reglist"></nav>
      </div>
      <div className="side-pane" id="paneToc" hidden></div>
      <div className="side-foot">
        <span className="lib-status" id="libStatus"></span>
        <button className="icon-btn sm hide-narrow" id="btnCollapse" type="button"
          title="Perkecil panel" aria-label="Perkecil panel" data-icon="chevLeft"></button>
      </div>
    </aside>
  );
}

function Aplikasi() {
  return (
    <div id="viewApp" hidden>
      <BilahAtas />
      <div className="shell" id="shell">
        <PanelSamping />
        <div className="scrim" id="scrim" hidden></div>
        <main className="content" id="content"></main>
      </div>
    </div>
  );
}

export default function App() {
  // Perender halaman lama dijalankan SESUDAH kerangka di atas berada di DOM.
  // useEffect berjalan setelah commit, jadi urutannya terjamin — dan karena
  // StrictMode tidak dipakai, ia berjalan sekali saja.
  useEffect(() => {
    let batal = false;
    import('./app.js').then(m => { if (!batal) m.init(); });
    return () => { batal = true; };
  }, []);

  return (
    <>
      <Boot />
      <LayarMasuk />
      <LayarGantiSandi />
      <Aplikasi />
      <dialog id="dlg" className="dlg"></dialog>
      <div id="toast" className="toast" role="status" hidden></div>
    </>
  );
}
