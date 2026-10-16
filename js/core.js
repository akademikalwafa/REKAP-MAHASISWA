/* =====================================================================
   CORE — utilitas, penyimpanan perangkat, API (fetch PRO), state, router, UI
   Pola performa: gas-instant-ux-pro (SWR, timeout+retry, reqId, ukur ms)
   ===================================================================== */
'use strict';

const CFG = window.APP_CONFIG || {};
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
function idle(fn, ms) { if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: ms || 2000 }); else setTimeout(fn, ms || 200); }
function debounce(fn, ms) { let t; return function () { const a = arguments, self = this; clearTimeout(t); t = setTimeout(() => fn.apply(self, a), ms); }; }

// ---------------------------------------------------------------- Ikon (subset Lucide, inline SVG)
function ic(name, cls) {
  const b = (window.ICONS || {})[name];
  if (!b) { console.warn('Ikon hilang:', name); return ''; }
  return '<svg class="ic ' + (cls || '') + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + b + '</svg>';
}
function hydrateIcons(root) {
  $$('i[data-ic]', root).forEach((el) => {
    const t = document.createElement('template');
    t.innerHTML = ic(el.dataset.ic);
    const svg = t.content.firstChild;
    if (!svg) return;
    if (el.getAttribute('style')) svg.setAttribute('style', el.getAttribute('style'));
    el.replaceWith(svg);
  });
}

// ---------------------------------------------------------------- Data acuan (PRD)
const PRODI = { ES: 'Ekonomi Syariah', HES: 'Hukum Ekonomi Syariah', PAI: 'Pendidikan Agama Islam', IAT: "Ilmu Al Qur'an & Tafsir" };
const KELAS = ['Reguler', 'Hybrid', "Ma'had Aly Ikhwan", "Ma'had Aly Akhwat", 'Khusus'];
const KELAS_LABEL = { 'Reguler': 'Kelas Reguler', 'Hybrid': 'Kelas Hybrid', "Ma'had Aly Ikhwan": "Ma'had Aly (Ikhwan)", "Ma'had Aly Akhwat": "Ma'had Aly (Akhwat)", 'Khusus': 'Kelas Khusus' };
const KELAS_PENDEK = { 'Reguler': 'Reguler', 'Hybrid': 'Hybrid', "Ma'had Aly Ikhwan": 'Ikhwan', "Ma'had Aly Akhwat": 'Akhwat', 'Khusus': 'Khusus' };
const GENDER = { L: 'Laki-laki', P: 'Perempuan' };
/** Ma'had Aly Ikhwan = putra, Ma'had Aly Akhwat = putri (kelas lain tidak menentukan). */
const genderDariKelas = (k) => (k === "Ma'had Aly Ikhwan" ? 'L' : k === "Ma'had Aly Akhwat" ? 'P' : '');
const STATUS = ['Aktif', 'Cuti', 'Mengundurkan Diri'];
const JENIS = { 'Cuti': 'CUTI', 'Mengundurkan Diri': 'MUNDUR' };
const ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// Normalisasi (cermin dari backend — dipakai saat impor Excel)
function huruf(s) { return String(s === null || s === undefined ? '' : s).toLowerCase().replace(/[‘’`'’]/g, '').replace(/&/g, ' dan ').replace(/[^a-z0-9]+/g, ' ').trim(); }
function normProdi(v) {
  const s = huruf(v), k = s.replace(/\s+/g, '');
  if (!k) return '';
  if (PRODI[k.toUpperCase()]) return k.toUpperCase();
  if (k === 'iqt' || s.includes('tafsir') || s.includes('quran')) return 'IAT';
  if (s.includes('hukum') || s.includes('muamalah')) return 'HES';
  if (s.includes('agama') || s.includes('tarbiyah')) return 'PAI';
  if (s.includes('ekonomi')) return 'ES';
  return '';
}
function normKelas(v) {
  const s = huruf(v);
  if (!s) return '';
  if (s.includes('khusus')) return 'Khusus';
  if (/(hybrid|hibrid|hybird)/.test(s)) return 'Hybrid';
  if (/(reguler|regular)/.test(s) || s === 'reg') return 'Reguler';
  const mahad = /(mahad|ma had|aly|ali)/.test(s);
  if (s.includes('akhwat') || (mahad && /(putri|perempuan|wanita)/.test(s))) return "Ma'had Aly Akhwat";
  if (s.includes('ikhwan') || (mahad && /(putra|laki)/.test(s))) return "Ma'had Aly Ikhwan";
  return '';
}
function normGender(v) {
  const s = huruf(v);
  if (!s) return '';
  if (/^(l|lk|laki|laki laki|pria|putra|ikhwan|male|m)$/.test(s) || s.indexOf('laki') === 0) return 'L';
  if (/^(p|pr|perempuan|wanita|putri|akhwat|female|f|w)$/.test(s) || s.indexOf('perempuan') === 0) return 'P';
  return '';
}
function normStatus(v) {
  const s = huruf(v);
  if (!s) return '';
  if (s.includes('cuti')) return 'Cuti';
  if (/(undur|mundur|keluar|resign|drop|^md$|^do$)/.test(s)) return 'Mengundurkan Diri';
  if (s === 'aktif' || s === 'active' || s.indexOf('aktif') === 0) return 'Aktif';
  return '';
}
function normTgl(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return isNaN(v) ? '' : v.getFullYear() + '-' + pad(v.getMonth() + 1, 2) + '-' + pad(v.getDate(), 2);
  if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1, 2) + '-' + pad(d.getUTCDate(), 2); }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad(+m[2], 2) + '-' + pad(+m[3], 2);
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return m[3] + '-' + pad(+m[2], 2) + '-' + pad(+m[1], 2);
  return '';
}

// ---------------------------------------------------------------- Format tampilan (id-ID)
const pad = (n, d) => String(n).padStart(d, '0');
const NF = new Intl.NumberFormat('id-ID');
const fmtNum = (n) => NF.format(n || 0);
const fmtPct = (x) => (isFinite(x) ? x : 0).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function fmtTgl(s) { if (!s) return '—'; const [y, m, d] = String(s).split('-'); return +d + ' ' + BULAN[+m - 1] + ' ' + y; }
function fmtWaktu(ms) { if (!ms) return '—'; const d = new Date(ms); return pad(d.getDate(), 2) + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear() + ', ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2); }
function relWaktu(ms) {
  if (!ms) return 'Belum pernah';
  const d = new Date(ms), now = new Date();
  const jam = pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ' WIB';
  const hari = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 864e5);
  if (hari === 0) return 'Hari ini, ' + jam;
  if (hari === 1) return 'Kemarin, ' + jam;
  if (hari < 30) return hari + ' hari lalu';
  if (hari < 365) return Math.floor(hari / 30) + ' bulan lalu';
  return Math.floor(hari / 365) + ' tahun lalu';
}
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2); }
function tahunAkademik(tgl) {
  if (!tgl) return '';
  const y = +String(tgl).slice(0, 4), m = +String(tgl).slice(5, 7), mulai = CFG.TA_MULAI_BULAN || 8;
  return m >= mulai ? y + '/' + (y + 1) : (y - 1) + '/' + y;
}
function initials(nama) { return String(nama || '?').replace(/[^A-Za-z\s]/g, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'; }
function fmtUkuran(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }

// Nomor surat bisa patah di setiap "/" (tidak memotong di tengah kata)
const nomorHtml = (s) => s ? esc(s).replace(/\//g, '/<wbr>') : '—';
function kelasHtml(k) { return String(k || '').indexOf("Ma'had") === 0 ? '<span class="kls"><small>Ma\'had Aly</small>' + esc(KELAS_PENDEK[k] || k) + '</span>' : esc(k || '—'); }
// Chip
const chipGender = (g) => g ? '<span class="chip g-' + g + '" title="' + GENDER[g] + '">' + g + '</span>' : '<span class="muted" title="Belum diisi">—</span>';
const chipProdi = (p) => '<span class="chip ' + esc(p) + '" title="' + esc(PRODI[p] || p) + '">' + esc(p || '—') + '</span>';
function chipStatus(s, kembali) {
  if (kembali) return '<span class="chip s-kembali">Aktif Kembali</span>';
  const c = s === 'Aktif' ? 's-aktif' : s === 'Cuti' ? 's-cuti' : s === 'Mengundurkan Diri' ? 's-md' : 's-dihapus';
  return '<span class="chip ' + c + '"><span class="dot"></span>' + esc(s || '—') + '</span>';
}

// ---------------------------------------------------------------- Penyimpanan perangkat (namespace + versi skema)
const LS_PREFIX = 'rekap:v1:';
const Store = {
  get(k, d) { try { const v = localStorage.getItem(LS_PREFIX + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) {
    const s = JSON.stringify(v);
    try { localStorage.setItem(LS_PREFIX + k, s); }
    catch (e) {
      // Kuota penuh → buang cache milik user lain di perangkat ini, coba sekali lagi
      try {
        Object.keys(localStorage).filter((x) => x.indexOf(LS_PREFIX + 'u:') === 0 && x.indexOf(LS_PREFIX + userKey('')) !== 0).forEach((x) => localStorage.removeItem(x));
        localStorage.setItem(LS_PREFIX + k, s);
      } catch (e2) { /* tetap jalan tanpa cache */ }
    }
  },
  del(k) { try { localStorage.removeItem(LS_PREFIX + k); } catch (e) { /* abaikan */ } }
};
function userKey(k) { return 'u:' + ((S.me && S.me.username) || 'anon') + ':' + k; }

// ---------------------------------------------------------------- Ukur (Prinsip 0) — panggil Perf.table() di console
const Perf = {
  rows: [],
  add(action, total, server) {
    this.rows.push({ action, total, server: server == null ? null : server, net: server == null ? null : total - server, at: new Date().toLocaleTimeString() });
    if (this.rows.length > 200) this.rows.shift();
  },
  table() { console.table(this.rows.slice(-30)); }
};
window.Perf = Perf;

// ---------------------------------------------------------------- API PRO (timeout, retry, reqId, tunggu online)
const READ_ACTIONS = /^(bootstrap|info|ambilBerkas|logAktivitas|migrasiInfo|migrasiPindai)$/;
const TIMEOUT = { uploadBerkas: 180000, migrasiJalankan: 330000, migrasiPindai: 300000, migrasiInfo: 120000, imporMahasiswa: 180000, ambilBerkas: 120000 };
let inflight = 0;
function syncDot() { const d = $('#sync-dot'); if (d) d.classList.toggle('on', inflight > 0); }

async function apiOnce(action, data, timeout, reqId) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout), t0 = performance.now();
  inflight++; syncDot();
  try {
    const res = await fetch(CFG.GAS_URL, {
      method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },               // hindari CORS preflight
      body: JSON.stringify({ action, token: S.token || '', key: CFG.API_KEY || '', reqId, data: data || {} })
    });
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      Perf.add(action, Math.round(performance.now() - t0), j.ms);
      return j;
    } catch (e) {
      return { success: false, network: true, retryable: res.status >= 500 || res.status === 429, message: 'Server membalas HTTP ' + res.status + ' (bukan JSON). Periksa GAS_URL & deployment "Anyone".' };
    }
  } catch (err) {
    return { success: false, network: true, retryable: true, message: err.name === 'AbortError' ? 'Server terlalu lama merespons.' : 'Koneksi ke server terputus.' };
  } finally { clearTimeout(timer); inflight--; syncDot(); }
}

async function api(action, data, opt) {
  opt = opt || {};
  const isRead = READ_ACTIONS.test(action);
  const reqId = isRead ? '' : (opt.reqId || uid());
  const tries = opt.tries || (isRead ? 3 : 2);                  // tulis aman diulang karena reqId sama
  let res;
  for (let i = 0; i < tries; i++) {
    if (i) { await sleep(1200 * i); if (navigator.onLine === false) await waitOnline(15000); }
    const to = TIMEOUT[action] || (isRead ? (i ? 40000 : 25000) : 90000);
    res = await apiOnce(action, data, to, reqId);
    const busy = !res.success && res.data && res.data.code === 'BUSY';
    if (res.success || !(res.retryable || busy)) break;
  }
  if (res.token) { S.token = res.token; Store.set('token', S.token); }
  if (!res.success && res.data && res.data.code === 'AUTH' && action !== 'login') App.sessionExpired();
  if (!res.success && res.data && res.data.code === 'MUST_CHANGE') App.forceChangePassword();
  return res;
}
function waitOnline(ms) {
  return new Promise((r) => {
    if (navigator.onLine !== false) return r();
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); removeEventListener('online', done); r(); }
    addEventListener('online', done);
  });
}
function warmUpServer() {
  if (!CFG.GAS_URL || /GANTI_DENGAN/.test(CFG.GAS_URL)) return;
  fetch(CFG.GAS_URL + '?ping=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
}

// ---------------------------------------------------------------- STATE
const S = {
  token: '', me: null, ver: '', loadedAt: 0, rev: 0,
  mhs: [], byId: new Map(), riwayat: [], nomor: {}, setelan: null, logNomor: [], pengguna: [], server: {}
};
const Bus = {
  fns: {},
  on(ev, fn) { (this.fns[ev] = this.fns[ev] || []).push(fn); },
  emit(ev, x) { (this.fns[ev] || []).forEach((fn) => { try { fn(x); } catch (e) { console.error(e); } }); }
};
function decodeTable(t) {
  if (!t || !t.cols) return [];
  return t.rows.map((r) => { const o = {}; t.cols.forEach((c, i) => { o[c] = r[i]; }); return o; });
}
const State = {
  applyBoot(b, fromCache) {
    if (!b) return;
    if (b.me) S.me = b.me;
    if (b.mhs) { S.mhs = decodeTable(b.mhs); S.byId = new Map(S.mhs.map((m) => [m.id, m])); }
    if (b.riwayat) S.riwayat = decodeTable(b.riwayat);
    if (b.nomor) S.nomor = b.nomor;
    if (b.setelan) { S.setelan = b.setelan; applyTheme(b.setelan.tema, b.setelan.institusi); }
    if (b.logNomor) S.logNomor = b.logNomor;
    if (b.pengguna) S.pengguna = b.pengguna;
    if (b.server) S.server = b.server;
    if (b.ver) S.ver = b.ver;
    if (!fromCache) { S.loadedAt = Date.now(); this.persist(b); }
    this.changed();
  },
  persist(b) {
    // Simpan bentuk ringkas (kolom + baris) per user agar buka berikutnya instan
    const snap = b || this.snapshot();
    Store.set(userKey('boot'), { t: S.loadedAt || Date.now(), data: snap });
  },
  snapshot() {
    const cols = S.mhs.length ? Object.keys(S.mhs[0]) : ['id'];
    const rcols = S.riwayat.length ? Object.keys(S.riwayat[0]) : ['id'];
    return {
      me: S.me, ver: S.ver, nomor: S.nomor, setelan: S.setelan, logNomor: S.logNomor, pengguna: S.pengguna, server: S.server,
      mhs: { cols, rows: S.mhs.map((m) => cols.map((c) => m[c])) },
      riwayat: { cols: rcols, rows: S.riwayat.map((m) => rcols.map((c) => m[c])) }
    };
  },
  changed() { S.rev++; this.persistSoon(); Bus.emit('data'); },
  persistSoon: debounce(function () { if (S.me) State.persist(); }, 400),
  upsertMhs(m) {
    const i = S.mhs.findIndex((x) => x.id === m.id);
    if (i > -1) S.mhs[i] = m; else S.mhs.push(m);
    S.byId.set(m.id, m);
  },
  removeMhs(id) { S.mhs = S.mhs.filter((x) => x.id !== id); S.byId.delete(id); },
  addRiwayat(r) { if (r && !S.riwayat.some((x) => x.id === r.id)) S.riwayat.push(r); },
  replaceRiwayat(r) { const i = S.riwayat.findIndex((x) => x.id === r.id); if (i > -1) S.riwayat[i] = r; },
  markStale() { S.loadedAt = 0; }
};
const isAdmin = () => !!(S.me && S.me.peran === 'Admin');

/** SWR: segarkan data dari server di latar. Data lokal tetap tampil; render ulang hanya bila berubah. */
let refreshing = null;
function refreshData(force) {
  if (!S.token) return Promise.resolve();
  if (!force && Date.now() - S.loadedAt < (CFG.FRESH_MS || 60000)) return Promise.resolve();
  if (refreshing) return refreshing;
  refreshing = api('bootstrap', { ver: force ? '' : S.ver }).then((res) => {
    if (res.success) {
      if (res.data.unchanged) { S.loadedAt = Date.now(); }
      else if (res.data.wajibGanti) App.forceChangePassword();
      else State.applyBoot(res.data);
    }
    return res;
  }).finally(() => { refreshing = null; });
  return refreshing;
}

// ---------------------------------------------------------------- Tema & mode
function applyTheme(t, institusi) {
  if (!t) return;
  let el = $('#theme-vars');
  if (!el) { el = document.createElement('style'); el.id = 'theme-vars'; document.head.appendChild(el); }
  el.textContent = ':root{--primer:' + t.primer + ';--sekunder:' + t.sekunder + ';--aksen:' + t.aksen + ';--latar:' + t.latar + ';--kartu:' + t.kartu + '}';
  Store.set('tema', t);
  const meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', t.primer);
  if (institusi) {
    Store.set('institusi', institusi);
    $$('[data-institusi]').forEach((e) => { e.textContent = institusi; });
    $$('[data-institusi-upper]').forEach((e) => { e.textContent = 'Rekap ' + institusi; });
  }
}
function setMode(mode) {
  if (mode === 'dark') document.documentElement.setAttribute('data-mode', 'dark');
  else document.documentElement.removeAttribute('data-mode');
  Store.set('mode', mode);
  const b = $('#mode-btn'); if (b) b.innerHTML = ic(mode === 'dark' ? 'sun' : 'moon');
}

// ---------------------------------------------------------------- ROUTER (SPA hash, halaman tidak dibuang)
const Pages = {};
function registerPage(name, def) { Pages[name] = Object.assign({ admin: false, crumb: ['Dashboard', 'Overview'] }, def); }
function go(name, param) {
  const h = '#/' + name + (param ? '/' + encodeURIComponent(param) : '');
  if (location.hash === h) route(); else location.hash = h;
}
let currentPage = '';
function route() {
  if (!S.me) return;
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  let name = parts[0] || 'dashboard';
  let param = parts.slice(1).map(decodeURIComponent).join('/');
  if (!Pages[name]) { name = 'dashboard'; param = ''; }
  const def = Pages[name];
  if (def.admin && !isAdmin()) { toast('Halaman ini khusus Admin.', 'info'); name = 'dashboard'; param = ''; }
  // Halaman dengan perubahan belum disimpan → tanya dulu sebelum pindah
  const asal = Pages[currentPage];
  if (asal && currentPage !== name && asal.isDirty && !asal._lewati && asal.isDirty()) {
    const tujuan = location.hash;
    history.replaceState(null, '', '#/' + currentPage);
    asal.beforeLeave().then((lanjut) => { if (lanjut) { asal._lewati = true; location.hash = tujuan; } });
    return;
  }
  if (asal) asal._lewati = false;
  const host = $('#content');
  let el = host.querySelector('.page[data-page="' + name + '"]');
  const baru = !el;
  if (baru) {
    el = document.createElement('section');
    el.className = 'page'; el.dataset.page = name;
    el.innerHTML = Pages[name].template();
    hydrateIcons(el);
    host.appendChild(el);
    if (Pages[name].mount) Pages[name].mount(el);
  }
  $$('.page', host).forEach((p) => { p.hidden = p !== el; });
  if (currentPage !== name) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; window.scrollTo(0, 0); }
  currentPage = name;
  const nav = Pages[name].nav || name;
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
  const c = typeof Pages[name].crumb === 'function' ? Pages[name].crumb(param) : Pages[name].crumb;
  $('#crumb').innerHTML = esc(c[0]) + ' / <b>' + esc(c[1]) + '</b>';
  document.body.classList.remove('nav-open');
  Pages[name].show(el, param);
  el._rev = S.rev;
  refreshData(false);                                          // SWR: cek server di latar bila data > 60 dtk
}
// Data berubah → render ulang halaman yang sedang tampil saja (halaman lain menyusul saat dibuka)
Bus.on('data', () => {
  const el = $('#content .page:not([hidden])');
  if (!el || !Pages[el.dataset.page]) return;
  const p = Pages[el.dataset.page];
  if (p.onData) p.onData(el); else if (p.refresh) p.refresh(el);
  el._rev = S.rev;
});
function pageNeedsRender(el) { return el._rev !== S.rev; }

// ---------------------------------------------------------------- UI: toast, modal, konfirmasi, drawer, tooltip
function toast(msg, type, title) {
  type = type || 'ok';
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = ic(type === 'ok' ? 'circle-check' : type === 'err' ? 'circle-alert' : 'info') + '<div>' + (title ? '<b>' + esc(title) + '</b>' : '') + esc(msg) + '</div>';
  box.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .25s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 260); }, type === 'err' ? 6500 : 3800);
}
const modalStack = [];
function modal(o) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = '<div class="modal ' + (o.size || '') + '" role="dialog" aria-modal="true"><div class="modal-head"><h3>' + esc(o.title || '') + '</h3>' +
    (o.dismissable === false ? '' : '<button class="icon-btn" data-close aria-label="Tutup">' + ic('x') + '</button>') + '</div>' +
    '<div class="modal-body">' + (o.body || '') + '</div>' + (o.foot ? '<div class="modal-foot">' + o.foot + '</div>' : '') + '</div>';
  hydrateIcons(ov);
  const close = () => { ov.remove(); const i = modalStack.indexOf(api2); if (i > -1) modalStack.splice(i, 1); if (o.onClose) o.onClose(); };
  const api2 = { el: ov, close };
  if (o.dismissable !== false) {
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    ov.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  }
  document.body.appendChild(ov);
  modalStack.push(api2);
  const f = ov.querySelector('[autofocus], input, select, textarea, .modal-foot .btn-primary');
  if (f) f.focus({ preventScroll: true });          // fokus langsung — tidak merebut fokus saat pengguna sudah mengetik
  return api2;
}
function confirmDialog(o) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title: o.title || 'Konfirmasi', size: '',
      body: '<p style="margin:0;color:var(--ink-2);line-height:1.6">' + o.message + '</p>',
      foot: '<button class="btn btn-ghost" data-no>Batal</button><button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-yes>' + esc(o.ok || 'Ya, lanjutkan') + '</button>',
      onClose: () => { if (!done) resolve(false); }
    });
    m.el.querySelector('[data-no]').onclick = () => { m.close(); };
    m.el.querySelector('[data-yes]').onclick = () => { done = true; m.close(); resolve(true); };
    m.el.querySelector('[data-yes]').focus({ preventScroll: true });
  });
}
function drawer(o) {
  const ov = document.createElement('div'); ov.className = 'drawer-ov';
  const dr = document.createElement('aside'); dr.className = 'drawer'; dr.setAttribute('role', 'dialog');
  dr.innerHTML = '<div class="modal-head"><h3>' + esc(o.title || '') + '</h3><button class="icon-btn" data-close aria-label="Tutup">' + ic('x') + '</button></div><div class="modal-body">' + o.body + '</div>' + (o.foot ? '<div class="modal-foot">' + o.foot + '</div>' : '');
  const close = () => { ov.remove(); dr.remove(); const i = modalStack.indexOf(h); if (i > -1) modalStack.splice(i, 1); };
  const h = { el: dr, close };
  ov.onclick = close; dr.querySelector('[data-close]').onclick = close;
  document.body.append(ov, dr);
  modalStack.push(h);
  hydrateIcons(dr);
  return h;
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalStack.length) {
    const top = modalStack[modalStack.length - 1];
    if (!top.el.querySelector('.modal-head [data-close]') && !top.el.classList.contains('drawer')) return;
    top.close();
  }
});
(function tooltip() {
  let tipEl;
  const show = (t, x, y) => { tipEl = tipEl || $('#tip'); if (!tipEl) return; tipEl.textContent = t; tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px'; tipEl.hidden = false; };
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t) {
      const r = t.getBoundingClientRect();
      const x = Math.min(Math.max(e.clientX, 80), innerWidth - 80);
      show(t.dataset.tip, x, Math.max(r.top + 4, 40));
    } else if (tipEl && !tipEl.hidden) tipEl.hidden = true;
  });
  document.addEventListener('scroll', () => { if (tipEl) tipEl.hidden = true; }, true);
})();

function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) {
    btn.dataset.html = btn.innerHTML; btn.disabled = true;
    btn.innerHTML = ic('loader-circle', 'spin') + ' ' + esc(label || 'Memproses…');
  } else {
    btn.disabled = false;
    if (btn.dataset.html) btn.innerHTML = btn.dataset.html;
  }
}

// ---------------------------------------------------------------- Tabel generik (urut, paging, kartu di HP)
class Tabel {
  /**
   * opt.cols: [{key, label, sort:true|fn, render(row), cls, m:'main'|'wide'|'hide'}]
   * opt.empty, opt.pageSize, opt.rowAttr(row), opt.info(from,to,total)
   */
  constructor(host, opt) {
    this.host = host; this.opt = opt; this.rows = []; this.page = 1;
    this.size = Store.get('pagesize:' + (opt.id || ''), opt.pageSize || 10);
    this.sortKey = opt.sortKey || ''; this.sortDir = opt.sortDir || 1;
    host.innerHTML = '<div class="tbl-wrap"><table class="tbl responsive"><thead class="' + (opt.dark ? 'dark' : '') + '"><tr></tr></thead><tbody></tbody></table></div><div class="tbl-foot"><div class="info"></div><div class="pager"></div></div>';
    this.thead = host.querySelector('thead tr'); this.tbody = host.querySelector('tbody');
    this.info = host.querySelector('.info'); this.pager = host.querySelector('.pager');
    this.thead.innerHTML = opt.cols.map((c) => '<th class="' + (c.sort ? 'sortable ' : '') + (c.m === 'hide' ? 'c-hide-m ' : '') + (c.thCls || '') + '" data-k="' + c.key + '">' + esc(c.label) + (c.sort ? '<span class="sort">▲▼</span>' : '') + '</th>').join('');
    this.thead.addEventListener('click', (e) => {
      const th = e.target.closest('th.sortable'); if (!th) return;
      const k = th.dataset.k;
      if (this.sortKey === k) this.sortDir = -this.sortDir; else { this.sortKey = k; this.sortDir = 1; }
      this.render();
    });
    this.pager.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-p]'); if (!b || b.disabled) return;
      this.page = +b.dataset.p; this.render();
      this.host.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    this.pager.addEventListener('change', (e) => {
      if (e.target.matches('select')) { this.size = +e.target.value; Store.set('pagesize:' + (opt.id || ''), this.size); this.page = 1; this.render(); }
    });
  }
  setRows(rows, resetPage) { this.rows = rows; if (resetPage) this.page = 1; this.render(); }
  sorted() {
    if (!this.sortKey) return this.rows;
    const c = this.opt.cols.find((x) => x.key === this.sortKey);
    const get = typeof c.sort === 'function' ? c.sort : (r) => r[this.sortKey];
    const d = this.sortDir;
    return this.rows.slice().sort((a, b) => {
      const x = get(a), y = get(b);
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * d;
      return String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), 'id', { numeric: true }) * d;
    });
  }
  render() {
    const o = this.opt, rows = this.sorted(), total = rows.length;
    const pages = Math.max(1, Math.ceil(total / this.size));
    if (this.page > pages) this.page = pages;
    const from = (this.page - 1) * this.size, view = rows.slice(from, from + this.size);
    $$('th', this.thead).forEach((th) => {
      th.classList.toggle('sorted', th.dataset.k === this.sortKey);
      const s = th.querySelector('.sort'); if (s) s.textContent = th.dataset.k === this.sortKey ? (this.sortDir > 0 ? '▲' : '▼') : '▲▼';
    });
    if (!view.length) {
      this.tbody.innerHTML = '<tr><td colspan="' + o.cols.length + '"><div class="empty">' + ic('scan-search') + esc(o.empty || 'Belum ada data.') + '</div></td></tr>';
    } else {
      this.tbody.innerHTML = view.map((r, i) => '<tr ' + (o.rowAttr ? o.rowAttr(r) : '') + '>' + o.cols.map((c) =>
        '<td class="' + (c.cls || '') + (c.m ? ' c-' + (c.m === 'hide' ? 'hide-m' : c.m) : '') + '"' + (c.m === 'main' || c.key === 'aksi' ? '' : ' data-label="' + esc(c.label) + '"') + '>' +
        (c.render ? c.render(r, from + i) : esc(r[c.key])) + '</td>').join('') + '</tr>').join('');
    }
    this.info.innerHTML = o.info ? o.info(total ? from + 1 : 0, from + view.length, total) : 'Menampilkan <b>' + fmtNum(view.length) + '</b> dari <b>' + fmtNum(total) + '</b> data';
    this.pager.innerHTML = this.pagerHtml(pages);
  }
  pagerHtml(pages) {
    const p = this.page, btn = (n, lbl, dis, cur) => '<button type="button" data-p="' + n + '"' + (dis ? ' disabled' : '') + (cur ? ' class="cur"' : '') + ' aria-label="Halaman ' + n + '">' + lbl + '</button>';
    let h = btn(p - 1, ic('chevron-left'), p <= 1);
    const set = new Set([1, pages, p - 1, p, p + 1].filter((x) => x >= 1 && x <= pages));
    let prev = 0;
    [...set].sort((a, b) => a - b).forEach((n) => { if (n - prev > 1) h += '<span class="gap">…</span>'; h += btn(n, n, false, n === p); prev = n; });
    h += btn(p + 1, ic('chevron-right'), p >= pages);
    h += '<select aria-label="Baris per halaman">' + [10, 25, 50, 100].map((n) => '<option value="' + n + '"' + (n === this.size ? ' selected' : '') + '>' + n + ' / hlm</option>').join('') + '</select>';
    return h;
  }
}

// ---------------------------------------------------------------- Berkas & pustaka lazy
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Berkas tidak bisa dibaca.'));
    r.readAsDataURL(file);
  });
}
const _scripts = {};
function loadScript(urls) {
  const key = urls.join('|');
  if (_scripts[key]) return _scripts[key];
  _scripts[key] = (async () => {
    for (const u of urls) {
      try {
        await new Promise((res, rej) => { const s = document.createElement('script'); s.src = u; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
        return true;
      } catch (e) { /* coba CDN berikutnya */ }
    }
    delete _scripts[key];
    throw new Error('Pustaka gagal dimuat. Periksa koneksi internet.');
  })();
  return _scripts[key];
}
// SheetJS (baca & tulis Excel) — dimuat hanya saat dibutuhkan / saat idle
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return loadScript([
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.core.min.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.core.min.js'
  ]).then(() => window.XLSX);
}
async function exportXlsx(namaFile, namaSheet, header, rows, lebar) {
  const X = await loadXLSX();
  const ws = X.utils.aoa_to_sheet([header].concat(rows));
  ws['!cols'] = (lebar || header.map(() => 18)).map((w) => ({ wch: w }));
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, namaSheet.slice(0, 31));
  X.writeFile(wb, namaFile);
}
const stampFile = () => { const d = new Date(); return d.getFullYear() + pad(d.getMonth() + 1, 2) + pad(d.getDate(), 2); };

// ---------------------------------------------------------------- Penomoran (pratinjau di klien — tanpa menunggu server)
function formatNomor(tpl, n, digit, prodi, tgl) {
  const bulan = +String(tgl).slice(5, 7), tahun = String(tgl).slice(0, 4);
  return String(tpl || '').replace(/\{NO\}/g, pad(n, digit || 3)).replace(/\{KODE_PRODI\}/g, prodi || '{KODE_PRODI}')
    .replace(/\{BULAN_ROMAWI\}/g, ROMAWI[bulan] || '').replace(/\{BULAN\}/g, pad(bulan, 2)).replace(/\{TAHUN\}/g, tahun);
}
function kunciCounter(jenis, prodi) { return jenis === 'CUTI' && S.nomor.CUTI && S.nomor.CUTI.mode === 'PER_PRODI' ? 'CUTI_' + prodi : jenis; }
function previewNomor(status, prodi, tgl) {
  const jenis = JENIS[status];
  if (!jenis || !S.nomor[jenis]) return '';
  const base = S.nomor[jenis], ctr = S.nomor[kunciCounter(jenis, prodi)] || { nomor_terakhir: 0, tahun_terakhir: 0 };
  const y = +String(tgl).slice(0, 4);
  let n = ctr.nomor_terakhir || 0;
  if (base.reset_tahunan && ctr.tahun_terakhir && y > ctr.tahun_terakhir) n = 0;
  const used = new Set(S.riwayat.map((r) => r.nomor_surat).filter(Boolean));
  let nomor, g = 0;
  do { n++; nomor = formatNomor(base.format, n, base.digit, prodi, tgl); } while (used.has(nomor) && ++g < 5000);
  return nomor;
}

// ---------------------------------------------------------------- Berkas surat: buka lewat API (privat)
const berkasCache = new Map();
async function lihatBerkas(id, judul) {
  if (!id) { toast('Berkas surat belum tersedia untuk data ini.', 'info'); return; }
  const m = modal({ title: judul || 'Berkas Surat', size: 'lg', body: '<div class="skeleton" style="height:60vh"></div><p class="muted" style="text-align:center">Memuat berkas…</p>' });
  let f = berkasCache.get(id);
  if (!f) {
    const res = await api('ambilBerkas', { id });
    if (!res.success) { m.close(); toast(res.message, 'err'); return; }
    f = res.data;
    const bin = atob(f.data), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    f.url = URL.createObjectURL(new Blob([arr], { type: f.mime }));
    berkasCache.set(id, f);
  }
  if (!document.body.contains(m.el)) return;
  const isImg = /^image\//.test(f.mime);
  m.el.querySelector('.modal-body').innerHTML = (isImg ? '<img class="viewer-img" src="' + f.url + '" alt="Berkas surat">' : '<iframe class="viewer" src="' + f.url + '" title="Berkas surat"></iframe>') +
    '<div style="display:flex;gap:10px;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap"><span class="muted" style="font-size:13.5px">' + esc(f.nama) + '</span>' +
    '<span style="display:flex;gap:10px"><a class="btn btn-soft btn-sm" href="' + f.url + '" download="' + esc(f.nama) + '">' + ic('download') + ' Unduh</a>' +
    (isAdmin() ? '<a class="btn btn-ghost btn-sm" href="https://drive.google.com/file/d/' + esc(id) + '/view" target="_blank" rel="noopener">' + ic('external-link') + ' Buka di Drive</a>' : '') + '</span></div>';
}

// Tutup tab / muat ulang saat ada perubahan belum disimpan → browser meminta konfirmasi
window.addEventListener('beforeunload', (e) => {
  const p = Pages[currentPage];
  if (p && p.isDirty && p.isDirty()) { e.preventDefault(); e.returnValue = ''; }
});
