/* =====================================================================
   APP — boot instan dari cache perangkat, login (1 panggilan = data layar
   pertama), navigasi, sesi, mode gelap, status koneksi
   ===================================================================== */
'use strict';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
  { id: 'mahasiswa', label: 'Data Mahasiswa', icon: 'users' },
  { id: 'cuti', label: 'Daftar Cuti', icon: 'calendar-x', badge: 'Cuti' },
  { id: 'mundur', label: 'Daftar Mengundurkan Diri', icon: 'user-minus', badge: 'Mengundurkan Diri' },
  { section: 'Pengaturan', admin: true },
  { id: 'penomoran', label: 'Penomoran', icon: 'list-ordered', admin: true },
  { id: 'tampilan', label: 'Tampilan', icon: 'palette', admin: true },
  { id: 'pengguna', label: 'Akun Pengguna', icon: 'user-cog', admin: true },
  { id: 'migrasi', label: 'Migrasi Data', icon: 'database', admin: true }
];

const App = {
  shown: false,
  showLogin(msg, type) {
    this.shown = false;
    $('#app').hidden = true; $('#login').hidden = false; $('#splash').hidden = true;
    $$('.overlay, .drawer, .drawer-ov').forEach((x) => x.remove());
    const a = $('#login-alert');
    if (msg) { a.className = 'alert ' + (type || 'err'); a.innerHTML = ic(type === 'info' ? 'info' : 'circle-alert') + '<span>' + msg + '</span>'; a.hidden = false; }
    else a.hidden = true;
    setTimeout(() => { const u = $('#lg-user'); (u.value ? $('#lg-pass') : u).focus(); }, 50);
  },
  showApp() {
    $('#login').hidden = true; $('#splash').hidden = true; $('#app').hidden = false;
    $('#me-nama').textContent = S.me.nama; $('#me-peran').textContent = S.me.peran === 'Admin' ? 'Administrator' : 'Staf Akademik';
    if (!this.shown) {
      // Halaman dibuat ulang bila pengguna/peran berganti
      $('#content').innerHTML = '';
      this.buildNav();
      this.shown = true;
    }
    if (!location.hash || location.hash === '#' || location.hash === '#/') location.replace('#/dashboard'); else route();
    idle(() => loadXLSX().catch(() => {}), 4000);   // siapkan pustaka Excel saat idle
  },
  buildNav() {
    $('#nav').innerHTML = NAV.filter((n) => !n.admin || isAdmin()).map((n) => n.section
      ? '<div class="nav-label">' + esc(n.section) + '</div>'
      : '<a href="#/' + n.id + '" data-nav="' + n.id + '">' + ic(n.icon) + '<span class="lbl">' + esc(n.label) + '</span>' + (n.badge ? '<span class="nav-badge" data-badge="' + n.badge + '" hidden></span>' : '') + '</a>').join('');
    this.badges();
  },
  badges() {
    const c = hitungStatus(S.mhs);
    $$('[data-badge]').forEach((b) => { const n = c[b.dataset.badge] || 0; b.textContent = n > 999 ? '999+' : n; b.hidden = !n; });
  },
  async login(e) {
    e.preventDefault();
    const btn = $('#lg-btn'), u = $('#lg-user').value.trim(), p = $('#lg-pass').value;
    if (!u || !p) { this.showLogin('Username dan password wajib diisi.'); return; }
    if (!configOk()) return;
    setBusy(btn, true, 'Memeriksa…');
    const res = await api('login', { username: u, password: p }, { tries: 2 });
    setBusy(btn, false);
    if (!res.success) { this.showLogin(esc(res.message)); $('#lg-pass').select(); return; }
    $('#lg-pass').value = '';
    this.mulaiSesi(res.data);
  },
  mulaiSesi(d) {
    const ganti = !S.me || S.me.username !== d.me.username || S.me.peran !== d.me.peran;
    S.token = d.token; Store.set('token', S.token);
    S.me = d.me; Store.set('me', S.me);
    if (ganti) { this.shown = false; S.mhs = []; S.riwayat = []; S.byId = new Map(); S.pengguna = []; }
    if (d.me.wajibGanti) { $('#splash').hidden = true; this.forceChangePassword(); return; }
    State.applyBoot(d.boot);
    this.showApp();
    toast('Selamat datang, ' + S.me.nama + '.');
  },
  sessionExpired() {
    if ($('#login').hidden === false) return;
    S.token = ''; Store.del('token');
    this.showLogin('Sesi berakhir karena tidak aktif atau akun diubah admin. Silakan login kembali.', 'info');
    $('#lg-user').value = (S.me && S.me.username) || '';
  },
  forceChangePassword() {
    if ($('.overlay [data-wajib]')) return;
    const m = modal({
      title: 'Ganti Password Awal', dismissable: false,
      body: `<div data-wajib class="alert info" style="margin-bottom:16px">${ic('shield-check')}<span>Demi keamanan, ganti password awal sebelum menggunakan aplikasi.</span></div>` + formPasswordHtml(),
      foot: `<button class="btn btn-ghost" data-keluar>Keluar</button><button class="btn btn-primary" data-ok>${ic('save')} Simpan Password</button>`
    });
    $('[data-keluar]', m.el).onclick = () => { m.close(); App.logout(true); };
    bindFormPassword(m, (res) => { m.close(); App.mulaiSesi(res.data); });
  },
  async logout(tanpaKonfirmasi) {
    if (!tanpaKonfirmasi && !(await confirmDialog({ title: 'Keluar dari aplikasi?', message: 'Data yang tersimpan di perangkat ini untuk akun Anda akan dihapus.', ok: 'Keluar' }))) return;
    if (S.token) api('logout', {}, { tries: 1 });
    Store.del(userKey('boot')); Store.del('token'); Store.del('me');
    S.token = ''; S.me = null; S.mhs = []; S.riwayat = []; S.byId = new Map(); S.pengguna = []; S.ver = '';
    this.shown = false; $('#content').innerHTML = '';
    this.showLogin('Anda telah keluar.', 'info');
  },
  userMenu(btn) {
    const ada = $('.dropdown'); if (ada) { ada.remove(); return; }
    const dd = document.createElement('div'); dd.className = 'dropdown';
    dd.innerHTML = `<div style="padding:10px 12px 8px"><b>${esc(S.me.nama)}</b><div class="muted mono" style="font-size:13px">@${esc(S.me.username)}</div></div><hr>
      <button data-m="pw">${ic('key-round')} Ganti Password</button><button data-m="mode">${ic(document.documentElement.dataset.mode === 'dark' ? 'sun' : 'moon')} ${document.documentElement.dataset.mode === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</button>
      <button data-m="sync">${ic('refresh-cw')} Muat Ulang Data</button><hr><button data-m="out" style="color:#D92D20">${ic('log-out')} Keluar</button>`;
    document.body.appendChild(dd);
    const tutup = (e) => { if (!dd.contains(e.target) && !btn.contains(e.target)) { dd.remove(); document.removeEventListener('pointerdown', tutup); } };
    setTimeout(() => document.addEventListener('pointerdown', tutup), 0);
    dd.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      dd.remove();
      if (b.dataset.m === 'pw') gantiPassword();
      if (b.dataset.m === 'mode') toggleMode();
      if (b.dataset.m === 'sync') { const r = await refreshData(true); toast(r && r.success ? 'Data diperbarui dari server.' : (r && r.message) || 'Gagal memuat.', r && r.success ? 'ok' : 'err'); }
      if (b.dataset.m === 'out') App.logout();
    });
  }
};

function formPasswordHtml() {
  return `<form data-pwform class="form-grid" style="grid-template-columns:1fr" novalidate>
    <div class="field"><label>Password Lama</label><input class="input" type="password" name="lama" autocomplete="current-password"></div>
    <div class="field"><label>Password Baru</label><input class="input" type="password" name="baru" autocomplete="new-password"><span class="hint">Minimal 8 karakter, berisi huruf dan angka.</span></div>
    <div class="field"><label>Ulangi Password Baru</label><input class="input" type="password" name="ulang" autocomplete="new-password"></div>
    <div data-err></div></form>`;
}
function bindFormPassword(m, onOk) {
  const f = $('[data-pwform]', m.el), btn = $('[data-ok]', m.el), err = $('[data-err]', m.el);
  const kirim = async () => {
    const lama = f.lama.value, baru = f.baru.value;
    let msg = '';
    if (!lama || !baru) msg = 'Isi password lama dan password baru.';
    else if (baru.length < 8 || !/[A-Za-z]/.test(baru) || !/[0-9]/.test(baru)) msg = 'Password baru minimal 8 karakter berisi huruf dan angka.';
    else if (baru !== f.ulang.value) msg = 'Ulangi password baru tidak sama.';
    if (msg) { err.innerHTML = '<div class="alert err">' + ic('circle-alert') + esc(msg) + '</div>'; return; }
    setBusy(btn, true, 'Menyimpan…');
    const res = await api('gantiPassword', { lama, baru });
    setBusy(btn, false);
    if (!res.success) { err.innerHTML = '<div class="alert err">' + ic('circle-alert') + esc(res.message) + '</div>'; return; }
    toast(res.message);
    onOk(res);
  };
  btn.onclick = kirim;
  f.addEventListener('submit', (e) => { e.preventDefault(); kirim(); });
}
function gantiPassword() {
  const m = modal({ title: 'Ganti Password', body: formPasswordHtml(), foot: `<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" data-ok>${ic('save')} Simpan</button>` });
  bindFormPassword(m, (res) => { m.close(); S.token = res.data.token; Store.set('token', S.token); S.me = res.data.me; Store.set('me', S.me); });
}
function toggleMode() { setMode(document.documentElement.dataset.mode === 'dark' ? 'light' : 'dark'); }
function configOk() {
  if (!CFG.GAS_URL || /GANTI_DENGAN/.test(CFG.GAS_URL) || /GANTI_DENGAN/.test(CFG.API_KEY || '')) {
    App.showLogin('Konfigurasi belum diisi. Buka <b>js/config.js</b> lalu isi <b>GAS_URL</b> dan <b>API_KEY</b> sesuai panduan.');
    return false;
  }
  return true;
}

// ---------------------------------------------------------------- BOOT
function boot() {
  hydrateIcons(document);
  setMode(Store.get('mode', document.documentElement.dataset.mode === 'dark' ? 'dark' : 'light'));
  $$('[data-year]').forEach((e) => { e.textContent = new Date().getFullYear(); });
  const ins = Store.get('institusi'); if (ins) applyTheme(Store.get('tema'), ins);

  // Event global (delegasi)
  $('#login-form').addEventListener('submit', (e) => App.login(e));
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle-pw]');
    if (t) { const i = $('#' + t.dataset.togglePw); i.type = i.type === 'password' ? 'text' : 'password'; t.innerHTML = ic(i.type === 'password' ? 'eye' : 'eye-off'); return; }
    const a = e.target.closest('[data-act]');
    if (!a || !a.closest('.topbar, .sidebar, .scrim')) return;
    const act = a.dataset.act;
    if (act === 'open-nav') document.body.classList.add('nav-open');
    if (act === 'close-nav') document.body.classList.remove('nav-open');
    if (act === 'logout') App.logout();
    if (act === 'toggle-mode') toggleMode();
    if (act === 'user-menu') App.userMenu(a);
  });
  window.addEventListener('hashchange', route);
  Bus.on('data', () => App.badges());

  // Koneksi & kembali dari latar belakang
  const net = () => { $('#offline').hidden = navigator.onLine !== false; };
  addEventListener('online', () => { net(); refreshData(false); });
  addEventListener('offline', net); net();
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 120000) warmUpServer();
    if (S.token) refreshData(false);
  });

  warmUpServer();                                               // panaskan server GAS sejak detik pertama
  if (!configOk()) { $('#splash').hidden = true; return; }

  // Tema login dari server (latar belakang) — tampilan awal pakai cache
  fetch(CFG.GAS_URL + '?action=info', { cache: 'no-store', redirect: 'follow' }).then((r) => r.json()).then((j) => {
    if (j && j.success && j.data) applyTheme(j.data.tema, j.data.institusi);
  }).catch(() => {});

  S.token = Store.get('token', '');
  S.me = Store.get('me', null);
  if (!S.token || !S.me) { App.showLogin(); return; }
  if (S.me.wajibGanti) { $('#splash').hidden = true; App.forceChangePassword(); return; }

  const cache = Store.get(userKey('boot'), null);
  if (cache && cache.data) {
    // Tampil SEKETIKA dari data perangkat; server dicek di latar (SWR)
    State.applyBoot(cache.data, true);
    S.loadedAt = cache.t || 0;
    App.showApp();
    refreshData(false);
    return;
  }
  // Belum ada cache: satu panggilan bootstrap
  refreshData(true).then((res) => {
    if (res && res.success && S.mhs) { if (!App.shown && S.token) App.showApp(); }
    else if (res && !res.success && !(res.data && res.data.code === 'AUTH')) {
      $('#splash').innerHTML = '<div class="box"><div class="brand-logo">W</div><p>' + esc(res.message || 'Gagal memuat data.') + '</p><button class="btn btn-primary" onclick="location.reload()">' + ic('refresh-cw') + ' Coba lagi</button></div>';
    }
  });
}
document.addEventListener('DOMContentLoaded', boot);
