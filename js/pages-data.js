/* =====================================================================
   HALAMAN DATA — Dashboard, Data Mahasiswa, Form, Detail, Daftar Cuti,
   Daftar Mengundurkan Diri, Riwayat Status
   Semua filter/cari/urut/paging dilakukan LOKAL (instan, tanpa server).
   ===================================================================== */
'use strict';

const optProdi = (sel, semua) => (semua ? '<option value="">' + semua + '</option>' : '<option value="">Pilih Program Studi</option>') +
  Object.keys(PRODI).map((k) => '<option value="' + k + '"' + (sel === k ? ' selected' : '') + '>' + esc(PRODI[k]) + ' (' + k + ')</option>').join('');
const optKelas = (sel, semua) => (semua ? '<option value="">' + semua + '</option>' : '<option value="">Pilih Kelas</option>') +
  KELAS.map((k) => '<option value="' + esc(k) + '"' + (sel === k ? ' selected' : '') + '>' + esc(KELAS_LABEL[k]) + '</option>').join('');
const optStatus = (sel) => '<option value="">Semua Status</option>' + STATUS.map((k) => '<option' + (sel === k ? ' selected' : '') + '>' + k + '</option>').join('');
function cariCocok(q, fields) { if (!q) return true; const s = fields.join(' ').toLowerCase(); return q.split(/\s+/).every((w) => s.includes(w)); }
function hitungStatus(list) {
  const c = { total: list.length, Aktif: 0, Cuti: 0, 'Mengundurkan Diri': 0 };
  list.forEach((m) => { if (c[m.status] !== undefined) c[m.status]++; });
  return c;
}
function mhsOfRiwayat(r) { return S.byId.get(r.mahasiswa_id) || S.mhs.find((m) => m.nim === r.nim) || null; }

// =====================================================================
// DASHBOARD (v1.1) — 4 kartu, filter cepat prodi, 4 grafik, 3 tabel rekap L/P
// Semua dihitung LOKAL dari data perangkat → filter & render instan tanpa server.
// =====================================================================
const PRODI_KEYS = Object.keys(PRODI);
function semesterLabel() {
  const t = todayStr(), m = +t.slice(5, 7), mulai = CFG.TA_MULAI_BULAN || 8;
  return 'Semester ' + (((m - mulai + 12) % 12) < 6 ? 'Ganjil' : 'Genap') + ' ' + tahunAkademik(t);
}
/** Hitung L / P / Total (+ jumlah tanpa gender) */
function hitLP(list) {
  const o = { L: 0, P: 0, T: list.length, X: 0 };
  list.forEach((m) => { if (m.gender === 'L') o.L++; else if (m.gender === 'P') o.P++; else o.X++; });
  return o;
}
function donutSvg(seg, total, atas, bawah, label) {
  const R = 62, C = 2 * Math.PI * R, parts = seg.filter((s) => s.n > 0);
  let off = 0;
  const arcs = parts.map((s) => {
    const len = total ? (s.n / total) * C : 0, gap = parts.length > 1 ? Math.min(2.5, len / 2) : 0;
    const a = `<circle r="${R}" cx="80" cy="80" fill="none" stroke="${s.c}" stroke-width="24" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"><title>${esc(s.k)}: ${fmtNum(s.n)} (${fmtPct(total ? (s.n / total) * 100 : 0)})</title></circle>`;
    off += len; return a;
  }).join('');
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 160 160" role="img" aria-label="${esc(label)}">
      <circle r="${R}" cx="80" cy="80" fill="none" stroke="var(--line)" stroke-width="24"/>${arcs}
      <text x="80" y="76" text-anchor="middle" font-size="20" font-weight="800">${atas}</text>
      <text x="80" y="96" text-anchor="middle" font-size="11" style="fill:var(--ink-2)">${bawah}</text></svg></div>
    <ul class="legend-list">${seg.filter((s) => s.n > 0 || s.selalu).map((s) => `<li data-tip="${esc(s.k)}: ${fmtNum(s.n)}"><i class="dot" style="background:${s.c}"></i><span>${esc(s.k)}</span><b>${fmtNum(s.n)}</b><em>${fmtPct(total ? (s.n / total) * 100 : 0)}</em></li>`).join('')}</ul>`;
}
/** Tabel silang bertingkat: baris × kelompok kolom, tiap kelompok L | P | Total, plus baris Total. */
function xtab(o) {
  // o: {judulBaris, baris:[{k,label}], kelompok:[{k,label}], list, kunciBaris(m), kunciKelompok(m), totalKelompok:bool, klik:{}}
  const sel = (rk, gk) => o.list.filter((m) => (rk === '*' || o.kunciBaris(m) === rk) && (gk === '*' || o.kunciKelompok(m) === gk));
  const grup = o.kelompok.concat(o.totalKelompok === false ? [] : [{ k: '*', label: o.labelTotalKelompok || 'Total', total: true }]);
  const sel3 = (rk, g) => { const x = hitLP(sel(rk, g.k)); return x; };
  const sel3d = (x, rk, g, tot) => {
    const f = Object.assign({}, o.filter || {});
    if (rk !== '*') f[o.fBaris] = rk;
    if (g.k !== '*') f[o.fKelompok] = g.k;
    const at = (gd) => ` data-drill='${esc(JSON.stringify(Object.assign({}, f, gd ? { gender: gd } : {})))}'`;
    const td = (n, gd, cls) => `<td class="${cls || ''}${n ? '' : ' nol'}"${n ? at(gd) : ''}>${fmtNum(n)}</td>`;
    return td(x.L, 'L', g.total || tot ? 'sub' : '') + td(x.P, 'P', g.total || tot ? 'sub' : '') + td(x.T, '', 'tot');
  };
  let tanpaGender = 0;
  const head = `<thead><tr><th rowspan="2" class="xt-row">${esc(o.judulBaris)}</th>${grup.map((g) => `<th colspan="3" class="xt-grp${g.total ? ' xt-gtot' : ''}">${esc(g.label)}</th>`).join('')}</tr>
    <tr>${grup.map((g) => `<th class="${g.total ? 'xt-gtot' : ''}">L</th><th class="${g.total ? 'xt-gtot' : ''}">P</th><th class="${g.total ? 'xt-gtot' : ''}">Total</th>`).join('')}</tr></thead>`;
  const body = o.baris.map((b) => `<tr><th class="xt-row">${esc(b.label)}</th>${grup.map((g) => sel3d(sel3(b.k, g), b.k, g)).join('')}</tr>`).join('');
  const totRow = `<tr class="xt-total"><th class="xt-row">Total</th>${grup.map((g) => { const x = sel3('*', g); if (g.total) tanpaGender = x.X; return sel3d(x, '*', g, true); }).join('')}</tr>`;
  if (o.totalKelompok === false) tanpaGender = hitLP(o.list).X;
  return `<div class="xt-wrap"><table class="xt">${head}<tbody>${body}</tbody><tfoot>${totRow}</tfoot></table></div>` +
    (tanpaGender ? `<p class="xt-note">${ic('info')}<span>Total memuat <b>${fmtNum(tanpaGender)}</b> mahasiswa yang jenis kelaminnya belum diisi (tidak masuk kolom L/P). Lengkapi lewat <a href="#/impor">Impor Excel → Perbarui data</a>.</span></p>` : '');
}

registerPage('dashboard', {
  crumb: () => ['Dashboard', 'Data Mahasiswa ' + semesterLabel()],
  template: () => `
    <div class="grid g4" id="db-kpi"></div>
    <div class="card pf-bar mt">
      <div><h3 class="card-title">Detail &amp; Filter Cepat Program Studi</h3><p class="section-sub" data-pf-info></p></div>
      <div class="pf-btns" role="group" aria-label="Filter program studi">
        <button type="button" data-pf="">Semua</button>${PRODI_KEYS.map((p) => `<button type="button" data-pf="${p}" title="${esc(PRODI[p])}">${p}<small data-pf-n="${p}"></small></button>`).join('')}
      </div>
    </div>
    <div class="grid g4 charts4 mt">
      <div class="card chart-card"><div class="card-head"><h3 class="card-title">Jumlah Mahasiswa per Angkatan</h3><span class="muted">${ic('chart-column')}</span></div><div class="ch-body" id="ch-angkatan"></div></div>
      <div class="card chart-card"><div class="card-head"><h3 class="card-title">Jumlah Mahasiswa per Program Studi</h3><span class="muted">${ic('graduation-cap')}</span></div><div class="ch-body" id="ch-prodi"></div></div>
      <div class="card chart-card"><div class="card-head"><h3 class="card-title">Komposisi Gender</h3><span class="muted">${ic('users')}</span></div><div class="ch-body" id="ch-gender"></div></div>
      <div class="card chart-card"><div class="card-head"><h3 class="card-title">Status Akademik</h3><span class="muted">${ic('chart-pie')}</span></div><div class="ch-body" id="ch-status"></div></div>
    </div>
    <div class="rekap-grid mt">
      <div class="card rekap-card"><h3 class="card-title">Rekap Mahasiswa per Angkatan dan Program Studi</h3><div id="tb-angkatan"></div></div>
      <div class="card rekap-card"><h3 class="card-title">Rekap Mahasiswa per Program Studi dan Status</h3><div id="tb-status"></div></div>
    </div>
    <div class="card rekap-card mt"><h3 class="card-title">Rekap Mahasiswa per Program Studi dan Kelas</h3><div id="tb-kelas"></div></div>
    <div class="card table-card mt">
      <div class="card-pad" style="padding-bottom:18px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap">
        <div><h2 class="section">Aktivitas Terbaru</h2><p class="section-sub">Mutasi status, cuti, dan pengunduran diri mahasiswa</p></div>
        <a href="#/riwayat" class="btn-link">Lihat Semua ${ic('arrow-right')}</a>
      </div>
      <div id="db-aktivitas"></div>
    </div>`,
  mount(el) {
    const self = this;
    this.prodi = Store.get(userKey('db:prodi'), '');
    this.tbl = new Tabel($('#db-aktivitas', el), {
      id: 'db', pageSize: 5, dark: true, empty: 'Belum ada mutasi status.',
      cols: [
        { key: 'nama', label: 'Nama Mahasiswa', cls: 'nama', m: 'main' },
        { key: 'nim', label: 'NIM', cls: 'nim' },
        { key: 'status_baru', label: 'Status', render: (r) => chipStatus(r.status_baru, r.status_baru === 'Aktif' && !!r.status_lama) },
        { key: 'nomor_surat', label: 'Nomor Surat', cls: 'no-surat', m: 'wide', render: (r) => nomorHtml(r.nomor_surat) },
        { key: 'tanggal_status', label: 'Tanggal', cls: 'num nowrap', thCls: 'num', render: (r) => fmtTgl(r.tanggal_status) }
      ],
      rowAttr: (r) => 'class="clickable" data-mid="' + esc(r.mahasiswa_id) + '" data-nim="' + esc(r.nim) + '"',
      info: () => ''
    });
    el.querySelector('#db-aktivitas .tbl-foot').hidden = true;
    el.addEventListener('click', (e) => {
      const pf = e.target.closest('[data-pf]');
      if (pf) { self.setProdi(el, pf.dataset.pf === self.prodi ? '' : pf.dataset.pf); return; }
      const bar = e.target.closest('[data-prodi-bar]');
      if (bar) { self.setProdi(el, bar.dataset.prodiBar === self.prodi ? '' : bar.dataset.prodiBar); return; }
      const d = e.target.closest('[data-drill]');
      if (d) { bukaDaftarMahasiswa(JSON.parse(d.dataset.drill)); return; }
      const tr = e.target.closest('tr[data-nim]');
      if (tr) { const m = S.byId.get(tr.dataset.mid) || S.mhs.find((x) => x.nim === tr.dataset.nim); if (m) Detail.open(m.id); }
    });
  },
  setProdi(el, p) { this.prodi = p; Store.set(userKey('db:prodi'), p); this.refresh(el); },
  show(el) { if (pageNeedsRender(el) || !el._done) this.refresh(el); el._done = 1; },
  refresh(el) {
    const pf = this.prodi, semua = S.mhs, list = pf ? semua.filter((m) => m.prodi === pf) : semua;
    const c = hitungStatus(list), tot = c.total || 0, pct = (n) => (tot ? (n / tot) * 100 : 0);
    const lpAll = hitLP(list), lpAktif = hitLP(list.filter((m) => m.status === 'Aktif'));
    const lp = (x) => `<div class="lp"><span class="g-L-t">${ic('user')} L <b>${fmtNum(x.L)}</b></span><span class="g-P-t">${ic('user')} P <b>${fmtNum(x.P)}</b></span>${x.X ? `<span class="lp-x" data-tip="${fmtNum(x.X)} mahasiswa belum diisi jenis kelaminnya">${ic('circle-help')} <b>${fmtNum(x.X)}</b></span>` : ''}</div>`;
    const kpi = (icon, tile, lbl, val, cap, extra, deco, side) => `
      <div class="card kpi kpi2"><div class="top"><div class="icon-tile ${tile}">${ic(icon)}</div>${side ? `<span class="kpi-side">${ic(side)}</span>` : ''}</div>
      <div class="lbl">${lbl}</div><div class="val">${fmtNum(val)}</div>${extra || ''}<div class="foot">${cap}</div><div class="deco" style="background:${deco}"></div></div>`;
    $('#db-kpi', el).innerHTML =
      kpi('users', 'sek', 'Total Mahasiswa', tot, pf ? 'Prodi ' + esc(PRODI[pf]) : 'Seluruh angkatan', lp(lpAll), 'var(--sek-tint)') +
      kpi('user-check', 'k-aktif', 'Mahasiswa Aktif', c.Aktif, fmtPct(pct(c.Aktif)) + ' dari total', lp(lpAktif), 'color-mix(in srgb,var(--st-aktif) 12%,var(--kartu))', 'chart-column') +
      kpi('calendar-days', 'k-cuti', 'Mahasiswa Cuti', c.Cuti, fmtPct(pct(c.Cuti)) + ' dari total', '', 'color-mix(in srgb,var(--aksen) 18%,var(--kartu))', 'history') +
      kpi('user-minus', 'k-md', 'Mengundurkan Diri', c['Mengundurkan Diri'], fmtPct(pct(c['Mengundurkan Diri'])) + ' dari total', '', 'var(--bad-bg)');

    // Panel filter cepat
    $$('[data-pf]', el).forEach((b) => b.classList.toggle('on', b.dataset.pf === pf));
    PRODI_KEYS.forEach((p) => { $('[data-pf-n="' + p + '"]', el).textContent = fmtNum(semua.filter((m) => m.prodi === p).length); });
    $('[data-pf-info]', el).textContent = pf ? 'Menampilkan ' + PRODI[pf] + ' (' + pf + ') · klik lagi untuk semua prodi' : 'Menampilkan semua program studi · klik prodi untuk menyaring seluruh dashboard';

    // Grafik 1 — per angkatan (satu seri, satu warna)
    const tahun = [...new Set(list.map((m) => +m.tahun_masuk).filter(Boolean))].sort((a, b) => a - b);
    const perTh = tahun.map((t) => [t, list.filter((m) => +m.tahun_masuk === t).length]);
    const maxT = Math.max(1, ...perTh.map((x) => x[1]));
    $('#ch-angkatan', el).innerHTML = perTh.length ? '<div class="vbars">' + perTh.map(([t, n]) =>
      `<div class="vbar" data-tip="Angkatan ${t}: ${fmtNum(n)} mahasiswa"><span class="v">${fmtNum(n)}</span><span class="b" style="height:${(n / maxT) * 80}%"></span></div>`).join('') +
      '</div><div class="vlabels">' + perTh.map(([t]) => '<span>' + t + '</span>').join('') + '</div>' : '<div class="empty">Belum ada data.</div>';

    // Grafik 2 — per prodi (warna per prodi, prodi terpilih disorot; klik batang = filter)
    const perP = PRODI_KEYS.map((p) => [p, semua.filter((m) => m.prodi === p).length]);
    const maxP = Math.max(1, ...perP.map((x) => x[1]));
    $('#ch-prodi', el).innerHTML = '<div class="vbars">' + perP.map(([p, n]) =>
      `<div class="vbar${pf && pf !== p ? ' redup' : ''}" data-prodi-bar="${p}" style="cursor:pointer" data-tip="${esc(PRODI[p])}: ${fmtNum(n)} mahasiswa · klik untuk menyaring"><span class="v">${fmtNum(n)}</span><span class="b" style="height:${(n / maxP) * 80}%;background:var(--pr-${p})"></span></div>`).join('') +
      '</div><div class="vlabels">' + perP.map(([p]) => '<span>' + p + '</span>').join('') + '</div>';

    // Grafik 3 — komposisi gender
    $('#ch-gender', el).innerHTML = donutSvg([
      { k: 'Laki-laki', n: lpAll.L, c: 'var(--g-L)', selalu: 1 }, { k: 'Perempuan', n: lpAll.P, c: 'var(--g-P)', selalu: 1 },
      { k: 'Belum diisi', n: lpAll.X, c: 'var(--neutral-ink)' }
    ], tot, fmtNum(tot), 'mahasiswa', 'Komposisi gender');

    // Grafik 4 — status akademik
    $('#ch-status', el).innerHTML = donutSvg([
      { k: 'Aktif', n: c.Aktif, c: 'var(--st-aktif)', selalu: 1 }, { k: 'Cuti', n: c.Cuti, c: 'var(--st-cuti)', selalu: 1 },
      { k: 'Mengundurkan Diri', n: c['Mengundurkan Diri'], c: 'var(--st-md)', selalu: 1 }
    ], tot, fmtPct(pct(c.Aktif)), 'aktif', 'Status akademik');

    // Tabel rekap (header bertingkat L | P | Total) — klik angka untuk membuka daftarnya
    const prodiBaris = (pf ? [pf] : PRODI_KEYS).map((p) => ({ k: p, label: p }));
    const filterDasar = pf ? { prodi: pf } : {};
    $('#tb-angkatan', el).innerHTML = xtab({
      judulBaris: 'Angkatan', list, filter: filterDasar, fBaris: 'tahun', fKelompok: 'prodi',
      baris: tahun.map((t) => ({ k: t, label: String(t) })), kunciBaris: (m) => +m.tahun_masuk,
      kelompok: prodiBaris, kunciKelompok: (m) => m.prodi, labelTotalKelompok: 'Total Angkatan', totalKelompok: !pf
    });
    $('#tb-status', el).innerHTML = xtab({
      judulBaris: 'Program Studi', list, filter: filterDasar, fBaris: 'prodi', fKelompok: 'status',
      baris: prodiBaris, kunciBaris: (m) => m.prodi,
      kelompok: STATUS.map((s) => ({ k: s, label: s })), kunciKelompok: (m) => m.status
    });
    $('#tb-kelas', el).innerHTML = xtab({
      judulBaris: 'Program Studi', list, filter: filterDasar, fBaris: 'prodi', fKelompok: 'kelas',
      baris: prodiBaris, kunciBaris: (m) => m.prodi,
      kelompok: KELAS.map((k) => ({ k, label: k })), kunciKelompok: (m) => m.kelas
    });
    $$('.xt-note', el).forEach((n, i) => { if (i) n.remove(); });     // catatan gender cukup sekali

    const akt = S.riwayat.filter((r) => !pf || r.prodi === pf).sort((a, b) => b.waktu - a.waktu).slice(0, 5);
    this.tbl.setRows(akt, true);
  }
});

/** Buka Data Mahasiswa dengan filter tertentu (dari angka di tabel rekap dashboard). */
function bukaDaftarMahasiswa(f) {
  const isi = Object.assign({ q: '', prodi: '', kelas: '', status: '', tahun: '', gender: '' }, f);
  isi.tahun = isi.tahun ? String(isi.tahun) : '';
  Pages.mahasiswa.pending = isi;
  go('mahasiswa');
}

// =====================================================================
// DATA MAHASISWA
// =====================================================================
registerPage('mahasiswa', {
  crumb: ['Data Mahasiswa', 'Daftar'],
  template: () => `
    <div class="page-head">
      <div><h1>Data Mahasiswa</h1><p>Kelola data seluruh mahasiswa STIS Al Wafa secara terpusat.</p></div>
      <div class="head-actions">
        <a href="#/impor" class="btn btn-soft adm">${ic('file-up')} Impor Excel</a>
        <button class="btn btn-soft" data-act="unduh">${ic('download')} Unduh Excel</button>
        <a href="#/form" class="btn btn-primary adm">${ic('plus')} Tambah Mahasiswa</a>
      </div>
    </div>
    <div class="card">
      <div class="filters">
        <label class="search"><span class="sr-only">Cari</span>${ic('search')}<input class="input" data-f="q" placeholder="Cari nama atau NIM…" autocomplete="off"></label>
        <select class="input" data-f="prodi">${optProdi('', 'Semua Prodi')}</select>
        <select class="input" data-f="kelas">${optKelas('', 'Semua Kelas')}</select>
        <select class="input" data-f="gender"><option value="">Semua Gender</option><option value="L">Laki-laki (L)</option><option value="P">Perempuan (P)</option><option value="-">Belum diisi</option></select>
        <select class="input" data-f="status">${optStatus('')}</select>
        <select class="input" data-f="tahun"><option value="">Tahun Masuk</option></select>
        <button class="icon-btn" data-act="reset" title="Atur ulang filter" aria-label="Atur ulang filter">${ic('rotate-ccw')}</button>
      </div>
      <div class="filters-meta"><span data-count></span><button class="btn-link" data-act="simpan-filter">${ic('bookmark')} Simpan Filter</button></div>
    </div>
    <div class="card table-card mt" id="mhs-tbl"></div>`,
  mount(el) {
    const self = this;
    this.f = Object.assign({ q: '', prodi: '', kelas: '', status: '', tahun: '', gender: '' }, Store.get(userKey('filter:mhs'), {}));
    $$('.adm', el).forEach((a) => { a.hidden = !isAdmin(); });
    this.tbl = new Tabel($('#mhs-tbl', el), {
      id: 'mhs', pageSize: 10, sortKey: 'nim', empty: 'Tidak ada mahasiswa yang cocok dengan filter.',
      cols: [
        { key: 'no', label: 'No', render: (r, i) => i + 1, m: 'hide', cls: 'muted' },
        { key: 'nim', label: 'NIM', sort: true, cls: 'nim' },
        { key: 'nama', label: 'Nama Mahasiswa', sort: true, cls: 'nama', m: 'main' },
        { key: 'gender', label: 'Gender', sort: true, render: (r) => chipGender(r.gender) },
        { key: 'prodi', label: 'Prodi', sort: true, render: (r) => chipProdi(r.prodi) },
        { key: 'kelas', label: 'Kelas', sort: true, render: (r) => kelasHtml(r.kelas) },
        { key: 'tahun_masuk', label: 'Tahun', sort: true },
        { key: 'status', label: 'Status', sort: true, render: (r) => chipStatus(r.status) },
        { key: 'nomor_surat', label: 'Nomor Surat', cls: 'no-surat', m: 'wide', render: (r) => nomorHtml(r.nomor_surat) },
        { key: 'aksi', label: '', cls: 'actions', render: (r) => `<button class="act" data-act="lihat" data-id="${r.id}" title="Detail" aria-label="Detail">${ic('eye')}</button>` +
            (isAdmin() ? `<button class="act" data-act="ubah" data-id="${r.id}" title="Ubah" aria-label="Ubah">${ic('pencil')}</button><button class="act del" data-act="hapus" data-id="${r.id}" title="Hapus" aria-label="Hapus">${ic('trash-2')}</button>` : '') }
      ],
      rowAttr: (r) => 'class="clickable" data-row="' + r.id + '"',
      info: (a, b, t) => t ? 'Menampilkan ' + fmtNum(a) + '–' + fmtNum(b) + ' dari ' + fmtNum(t) + ' mahasiswa' : 'Tidak ada data'
    });
    const apply = () => { self.render(el, true); };
    $$('[data-f]', el).forEach((inp) => {
      inp.value = this.f[inp.dataset.f] || '';
      inp.addEventListener(inp.tagName === 'INPUT' ? 'input' : 'change', inp.tagName === 'INPUT' ? debounce(() => { self.f.q = inp.value.trim().toLowerCase(); apply(); }, 180) : () => { self.f[inp.dataset.f] = inp.value; apply(); });
    });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (b) {
        e.stopPropagation();
        const a = b.dataset.act, id = b.dataset.id;
        if (a === 'lihat') Detail.open(id);
        else if (a === 'ubah') go('form', id);
        else if (a === 'hapus') hapusMahasiswa(id);
        else if (a === 'reset') { self.f = { q: '', prodi: '', kelas: '', status: '', tahun: '', gender: '' }; $$('[data-f]', el).forEach((i) => { i.value = ''; }); apply(); }
        else if (a === 'simpan-filter') { Store.set(userKey('filter:mhs'), self.f); toast('Filter disimpan untuk kunjungan berikutnya.'); }
        else if (a === 'unduh') self.unduh(b);
        return;
      }
      const tr = e.target.closest('tr[data-row]');
      if (tr) Detail.open(tr.dataset.row);
    });
  },
  filtered() {
    const f = this.f;
    return S.mhs.filter((m) => (!f.prodi || m.prodi === f.prodi) && (!f.kelas || m.kelas === f.kelas) && (!f.status || m.status === f.status) &&
      (!f.gender || (f.gender === '-' ? !m.gender : m.gender === f.gender)) &&
      (!f.tahun || String(m.tahun_masuk) === f.tahun) && cariCocok(f.q, [m.nama.toLowerCase(), m.nim, (m.nomor_surat || '').toLowerCase()]));
  },
  show(el) {
    // Datang dari angka di tabel rekap dashboard → terapkan filternya
    if (this.pending) {
      this.f = this.pending; this.pending = null;
      $$('[data-f]', el).forEach((i) => { i.value = this.f[i.dataset.f] || ''; });
      this.render(el, true);
      const sel = $('[data-f="tahun"]', el); if (sel) sel.value = this.f.tahun || '';
      return;
    }
    this.render(el, false);
  },
  refresh(el) { this.render(el, false); },
  render(el, resetPage) {
    const tahun = [...new Set(S.mhs.map((m) => m.tahun_masuk).filter(Boolean))].sort((a, b) => b - a);
    const sel = $('[data-f="tahun"]', el);
    const want = '<option value="">Tahun Masuk</option>' + tahun.map((t) => '<option' + (String(t) === this.f.tahun ? ' selected' : '') + '>' + t + '</option>').join('');
    if (sel.innerHTML !== want) sel.innerHTML = want;
    const rows = this.filtered();
    $('[data-count]', el).innerHTML = 'Menampilkan <b>' + fmtNum(rows.length) + '</b> dari <b>' + fmtNum(S.mhs.length) + '</b> data';
    this.tbl.setRows(rows, resetPage);
  },
  async unduh(btn) {
    setBusy(btn, true, 'Menyiapkan…');
    try {
      const rows = this.tbl.sorted();
      await exportXlsx('Data_Mahasiswa_' + stampFile() + '.xlsx', 'Data Mahasiswa',
        ['No', 'NIM', 'Nama Lengkap', 'Jenis Kelamin', 'Prodi', 'Program Studi', 'Kelas', 'Tahun Masuk', 'Status', 'Tanggal Status', 'Nomor Surat', 'Catatan'],
        rows.map((m, i) => [i + 1, m.nim, m.nama, m.gender || '', m.prodi, PRODI[m.prodi] || '', m.kelas, m.tahun_masuk, m.status, m.tanggal_status, m.nomor_surat, m.catatan]),
        [5, 13, 32, 13, 7, 26, 20, 11, 18, 14, 34, 30]);
      toast(fmtNum(rows.length) + ' baris diunduh sesuai filter aktif.');
    } catch (e) { toast(e.message, 'err'); }
    setBusy(btn, false);
  }
});

async function hapusMahasiswa(id) {
  const m = S.byId.get(id);
  if (!m) return;
  const ok = await confirmDialog({ title: 'Hapus data mahasiswa?', message: 'Data <b>' + esc(m.nama) + '</b> (' + esc(m.nim) + ') akan dihapus permanen. Riwayat surat tetap tersimpan sebagai arsip. Tindakan ini tercatat di log.', ok: 'Hapus', danger: true });
  if (!ok) return;
  // Optimistic UI: hilang seketika, kembalikan bila server gagal
  const idx = S.mhs.indexOf(m);
  State.removeMhs(id); State.changed();
  Detail.closeAll();
  const res = await api('hapusMahasiswa', { id });
  if (!res.success) { S.mhs.splice(idx, 0, m); S.byId.set(m.id, m); State.changed(); toast(res.message, 'err', 'Gagal menghapus'); }
  else { toast(res.message); State.markStale(); }
}

// =====================================================================
// DETAIL MAHASISWA (drawer)
// =====================================================================
const Detail = {
  h: null,
  closeAll() { if (this.h) { this.h.close(); this.h = null; } },
  open(id) {
    const m = S.byId.get(id);
    if (!m) return;
    this.closeAll();
    const riw = S.riwayat.filter((r) => r.mahasiswa_id === m.id || r.nim === m.nim).sort((a, b) => b.waktu - a.waktu);
    const warnaS = (s) => s === 'Cuti' ? 'var(--st-cuti)' : s === 'Mengundurkan Diri' ? 'var(--st-md)' : 'var(--st-aktif)';
    const body = `
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:20px">
        <div class="initials" style="background:var(--sekunder);width:52px;height:52px;font-size:18px">${esc(initials(m.nama))}</div>
        <div style="min-width:0"><div style="font-size:19px;font-weight:800;line-height:1.3">${esc(m.nama)}</div><div class="nim mono" style="color:var(--sek-ink)">${esc(m.nim)}</div></div>
      </div>
      <dl class="dl">
        <dt>Status</dt><dd>${chipStatus(m.status)}</dd>
        <dt>Jenis Kelamin</dt><dd>${m.gender ? GENDER[m.gender] + ' (' + m.gender + ')' : '<span class="muted">Belum diisi</span>'}</dd>
        <dt>Program Studi</dt><dd>${esc(PRODI[m.prodi] || m.prodi)} (${esc(m.prodi)})</dd>
        <dt>Kelas</dt><dd>${esc(KELAS_LABEL[m.kelas] || m.kelas)}</dd>
        <dt>Tahun Masuk</dt><dd>${esc(m.tahun_masuk)}</dd>
        ${m.status !== 'Aktif' ? `<dt>Tanggal Status</dt><dd>${fmtTgl(m.tanggal_status)}</dd><dt>Nomor Surat</dt><dd class="mono">${esc(m.nomor_surat || '—')}</dd>
          <dt>Berkas Surat</dt><dd>${m.id_berkas ? `<button class="btn-link" data-berkas="${esc(m.id_berkas)}">${ic('file-text')} Lihat surat</button>` : '<span class="muted">Belum ada berkas</span>'}</dd>` : ''}
        ${m.catatan ? `<dt>Catatan</dt><dd style="font-weight:400;white-space:pre-wrap">${esc(m.catatan)}</dd>` : ''}
        <dt>Terakhir diubah</dt><dd style="font-weight:400">${fmtWaktu(m.diubah_pada)}${m.diubah_oleh ? ' · ' + esc(m.diubah_oleh) : ''}</dd>
      </dl>
      <h4 style="margin:28px 0 14px;font-size:16px">Riwayat Status</h4>
      ${riw.length ? '<ul class="timeline">' + riw.map((r) => `<li><span class="bullet" style="background:${warnaS(r.status_baru)}"></span>
        <div style="font-weight:700">${r.status_lama ? esc(r.status_lama) + ' → ' : ''}${esc(r.status_baru)}</div>
        <div class="when">${fmtTgl(r.tanggal_status)} · dicatat ${fmtWaktu(r.waktu)} oleh ${esc(r.oleh)}</div>
        ${r.nomor_surat ? `<div class="mono" style="margin-top:4px">${esc(r.nomor_surat)}</div>` : ''}
        ${r.id_berkas ? `<button class="btn-link" style="margin-top:4px;font-size:14px" data-berkas="${esc(r.id_berkas)}">${ic('paperclip')} Berkas surat</button>` : ''}</li>`).join('') + '</ul>'
        : '<p class="muted" style="margin:0">Belum ada perubahan status.</p>'}`;
    const foot = isAdmin() ? `<button class="btn btn-ghost" data-act="hapus" style="color:#D92D20">${ic('trash-2')} Hapus</button><button class="btn btn-primary" data-act="ubah">${ic('pencil')} Ubah Data / Status</button>` : '';
    this.h = drawer({ title: 'Detail Mahasiswa', body, foot });
    this.h.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-berkas]');
      if (b) { lihatBerkas(b.dataset.berkas, 'Surat · ' + m.nama); return; }
      const a = e.target.closest('[data-act]');
      if (a && a.dataset.act === 'ubah') { this.closeAll(); go('form', m.id); }
      if (a && a.dataset.act === 'hapus') hapusMahasiswa(m.id);
    });
  }
};

// =====================================================================
// FORM TAMBAH / UBAH MAHASISWA (+ ubah status, unggah surat, pratinjau nomor)
// =====================================================================
registerPage('form', {
  admin: true, nav: 'mahasiswa',
  crumb: (p) => ['Data Mahasiswa', p && p.split('/')[0] !== 'baru' ? 'Ubah Data' : 'Tambah Baru'],
  template: () => `
    <div class="page-head">
      <div><h1 data-judul>Tambah Mahasiswa Baru</h1><p data-sub>Daftarkan mahasiswa baru ke dalam sistem rekapitulasi akademik.</p></div>
      <button class="btn btn-tint" type="button" data-act="reset">${ic('rotate-ccw')} Reset Form</button>
    </div>
    <form id="mhs-form" novalidate>
      <div class="card form-section">
        <div class="sec-head"><div class="icon-tile">${ic('graduation-cap')}</div><div><h3>Data Mahasiswa</h3><p>Informasi akademik dasar mahasiswa.</p></div></div>
        <div class="form-grid">
          <div class="field"><label for="f-nim">NIM (Nomor Induk Mahasiswa)<span class="req">*</span></label><input class="input mono" id="f-nim" name="nim" placeholder="Contoh: 202501001" inputmode="numeric" autocomplete="off"><span class="err" data-err="nim"></span></div>
          <div class="field"><label for="f-nama">Nama Lengkap<span class="req">*</span></label><input class="input" id="f-nama" name="nama" placeholder="Nama lengkap sesuai ijazah" autocomplete="off"><span class="err" data-err="nama"></span></div>
          <div class="field"><label for="f-prodi">Program Studi<span class="req">*</span></label><select class="input" id="f-prodi" name="prodi">${optProdi('')}</select><span class="err" data-err="prodi"></span></div>
          <div class="field"><label for="f-kelas">Kelas<span class="req">*</span></label><select class="input" id="f-kelas" name="kelas">${optKelas('')}</select><span class="err" data-err="kelas"></span></div>
          <div class="field"><label for="f-tahun">Tahun Masuk<span class="req">*</span></label><input class="input" id="f-tahun" name="tahun_masuk" type="number" min="1990" max="2100" inputmode="numeric"><span class="err" data-err="tahun_masuk"></span></div>
          <div class="field"><label for="f-gender">Jenis Kelamin<span class="req">*</span></label><select class="input" id="f-gender" name="gender"><option value="">Pilih Jenis Kelamin</option><option value="L">Laki-laki (L)</option><option value="P">Perempuan (P)</option></select><span class="hint" data-gender-hint></span><span class="err" data-err="gender"></span></div>
        </div>
      </div>
      <div class="card form-section mt">
        <div class="sec-head"><div class="icon-tile">${ic('clipboard-list')}</div><div><h3>Status Mahasiswa &amp; Dokumen Pendukung</h3><p data-status-sub>Tentukan status awal keaktifan mahasiswa.</p></div></div>
        <div class="field"><span class="lbl-f">Status<span class="req">*</span></span>
          <div class="seg" role="radiogroup" aria-label="Status mahasiswa">${STATUS.map((s) => `<button type="button" role="radio" data-status="${s}">${s}</button>`).join('')}</div>
        </div>
        <div data-status-panel class="mt"></div>
      </div>
      <div class="card form-section mt">
        <div class="sec-head"><div class="icon-tile">${ic('pencil')}</div><div><h3>Catatan Tambahan (Opsional)</h3><p>Catatan khusus terkait akademik atau catatan administratif.</p></div></div>
        <textarea class="input" name="catatan" id="f-catatan" placeholder="Masukkan catatan khusus akademik jika diperlukan…"></textarea>
      </div>
      <div class="form-foot"><span class="grow" data-foot-info></span><button type="button" class="btn btn-ghost" data-act="batal">Batal</button><button type="submit" class="btn btn-navy" data-simpan>${ic('save')} Simpan Mahasiswa</button></div>
    </form>`,
  mount(el) {
    const self = this, form = $('#mhs-form', el);
    this.el = el; this.form = form;
    el.addEventListener('click', (e) => {
      const s = e.target.closest('[data-status]');
      if (s && !s.disabled) { self.setStatus(s.dataset.status); return; }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'batal') self.kembali();
      if (a.dataset.act === 'reset') self.fill(self.orig);
      if (a.dataset.act === 'hapus-berkas') { self.upload = null; self.renderPanel(); }
      if (a.dataset.act === 'ganti-berkas') { self.gantiBerkas = true; self.renderPanel(); }
      if (a.dataset.act === 'lihat-berkas') lihatBerkas(a.dataset.id, 'Surat · ' + (self.orig && self.orig.nama));
    });
    form.addEventListener('input', (e) => {
      if (e.target.name) { const er = $('[data-err="' + e.target.name + '"]', el); if (er) er.textContent = ''; e.target.classList.remove('invalid'); }
      if (e.target.id === 'f-nim') self.cekNim();
      if (['f-tgl'].includes(e.target.id)) self.updatePreview();
    });
    form.addEventListener('change', (e) => {
      if (['f-prodi', 'f-tgl'].includes(e.target.id)) self.updatePreview();
      if (e.target.id === 'f-file') self.pilihFile(e.target.files[0]);
      if (e.target.id === 'f-kelas') self.sesuaikanGender();
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); self.simpan(); });
    el.addEventListener('dragover', (e) => { const d = e.target.closest('.drop'); if (d) { e.preventDefault(); d.classList.add('drag'); } });
    el.addEventListener('dragleave', (e) => { const d = e.target.closest('.drop'); if (d) d.classList.remove('drag'); });
    el.addEventListener('drop', (e) => { const d = e.target.closest('.drop'); if (d) { e.preventDefault(); d.classList.remove('drag'); if (e.dataTransfer.files[0]) self.pilihFile(e.dataTransfer.files[0]); } });
  },
  show(el, param) {
    const [id, preset] = String(param || '').split('/');
    this.returnTo = this.prevHash || '#/mahasiswa';
    const m = id && id !== 'baru' ? S.byId.get(id) : null;
    if (id && id !== 'baru' && !m) { toast('Data mahasiswa tidak ditemukan (mungkin sudah dihapus).', 'err'); go('mahasiswa'); return; }
    this.orig = m ? Object.assign({}, m) : null;
    $('[data-judul]', el).textContent = m ? 'Ubah Data Mahasiswa' : 'Tambah Mahasiswa Baru';
    $('[data-sub]', el).textContent = m ? 'Perbarui data akademik atau ubah status ' + m.nama + '.' : 'Daftarkan mahasiswa baru ke dalam sistem rekapitulasi akademik.';
    $('[data-status-sub]', el).textContent = m ? 'Status saat ini: ' + m.status + '. Mengubah ke Cuti / Mengundurkan Diri akan menerbitkan nomor surat otomatis.' : 'Tentukan status awal keaktifan mahasiswa.';
    this.fill(this.orig, preset);
  },
  fill(m, preset) {
    const f = this.form;
    f.reset();
    $$('.err', this.el).forEach((x) => { x.textContent = ''; });
    $$('.invalid', this.el).forEach((x) => x.classList.remove('invalid'));
    f.nim.value = m ? m.nim : ''; f.nama.value = m ? m.nama : '';
    f.prodi.value = m ? m.prodi : ''; f.kelas.value = m ? m.kelas : '';
    f.gender.value = m ? m.gender || '' : '';
    this.sesuaikanGender();
    f.tahun_masuk.value = m ? m.tahun_masuk : new Date().getFullYear();
    f.catatan.value = m ? m.catatan || '' : '';
    this.upload = null; this.gantiBerkas = false; this.tgl = todayStr();
    this.setStatus(STATUS.includes(preset) ? preset : (m ? m.status : 'Aktif'));
    $('[data-foot-info]', this.el).textContent = m ? 'Terakhir diubah ' + fmtWaktu(m.diubah_pada) + (m.diubah_oleh ? ' oleh ' + m.diubah_oleh : '') : 'Kolom bertanda * wajib diisi.';
  },
  setStatus(s) {
    this.status = s;
    $$('[data-status]', this.el).forEach((b) => { b.classList.toggle('on', b.dataset.status === s); b.setAttribute('aria-checked', b.dataset.status === s); });
    this.renderPanel();
  },
  berubah() { return this.orig ? this.orig.status !== this.status : this.status !== 'Aktif'; },
  /** Ma'had Aly Ikhwan/Akhwat menentukan jenis kelamin secara otomatis. */
  sesuaikanGender() {
    const g = genderDariKelas(this.form.kelas.value), sel = this.form.gender, hint = $('[data-gender-hint]', this.el);
    if (g) { sel.value = g; const er = $('[data-err="gender"]', this.el); if (er) er.textContent = ''; sel.classList.remove('invalid'); }
    Array.from(sel.options).forEach((o) => { o.disabled = !!(g && o.value && o.value !== g); });
    if (hint) hint.textContent = g ? 'Otomatis dari kelas ' + this.form.kelas.value + '.' : (this.orig && !this.orig.gender ? 'Data lama belum memiliki jenis kelamin — mohon dilengkapi.' : '');
  },
  renderPanel() {
    const p = $('[data-status-panel]', this.el), s = this.status, o = this.orig, perlu = !!JENIS[s];
    const tglVal = (this.form.querySelector('#f-tgl') || {}).value || this.tgl || todayStr();
    let h = '';
    if (this.berubah()) {
      h += `<div class="form-grid"><div class="field"><label for="f-tgl">${perlu ? 'Tanggal ' + (s === 'Cuti' ? 'Cuti' : 'Mengundurkan Diri') : 'Tanggal Aktif Kembali'}<span class="req">*</span></label>
            <input class="input" type="date" id="f-tgl" value="${esc(tglVal)}"><span class="hint">${perlu ? 'Bulan &amp; tahun nomor surat diambil dari tanggal ini.' : 'Counter surat tidak berkurang saat mahasiswa aktif kembali.'}</span></div>`;
      if (perlu) h += `<div class="field"><span class="lbl-f">Pratinjau Nomor Surat</span><div class="nomor-preview"><span data-preview class="v"></span><span class="tag">pratinjau</span></div>
            <span class="hint">Nomor baru terpakai setelah disimpan — tidak ada nomor terlewat bila dibatalkan.</span></div>`;
      h += '</div>';
      if (perlu) h += '<div class="field mt"><span class="lbl-f">Unggah Surat ' + esc(s) + '<span class="req">*</span></span>' + this.uploadHtml() + '<span class="err" data-err="berkas"></span></div>';
    } else if (perlu && o) {
      h += `<div class="callout navy"><div class="icon-tile navy">${ic('file-text')}</div><div style="flex:1;min-width:0"><h4>Surat ${esc(s)} aktif</h4>
          <p><span class="mono">${esc(o.nomor_surat || 'Tanpa nomor')}</span> · ${fmtTgl(o.tanggal_status)}</p>
          <p style="margin-top:8px;display:flex;gap:16px;flex-wrap:wrap">${o.id_berkas ? `<button type="button" class="btn-link" data-act="lihat-berkas" data-id="${esc(o.id_berkas)}">${ic('eye')} Lihat surat</button>` : '<span>Belum ada berkas surat.</span>'}
          ${this.gantiBerkas ? '' : `<button type="button" class="btn-link" data-act="ganti-berkas">${ic('upload')} ${o.id_berkas ? 'Ganti berkas' : 'Unggah berkas'}</button>`}</p></div></div>`;
      if (this.gantiBerkas) h += '<div class="field mt"><span class="lbl-f">Berkas Surat Pengganti</span>' + this.uploadHtml() + '</div>';
    } else if (o && s === 'Aktif') {
      h += '<p class="muted" style="margin:0">Mahasiswa berstatus aktif. Pilih Cuti atau Mengundurkan Diri untuk menerbitkan surat.</p>';
    }
    p.innerHTML = h;
    hydrateIcons(p);
    this.updatePreview();
  },
  uploadHtml() {
    const u = this.upload;
    if (u) {
      const st = u.state === 'done' ? '<span style="color:var(--ok-ink)">' + ic('circle-check') + ' Terunggah</span>' : u.state === 'error' ? '<span style="color:var(--bad-ink)">' + esc(u.err) + '</span>' : 'Mengunggah…';
      return `<div class="file-row">${ic(u.file.type === 'application/pdf' ? 'file-text' : 'image')}<div style="flex:1;min-width:0"><div class="nm">${esc(u.file.name)}</div><div class="st">${fmtUkuran(u.file.size)} · ${st}</div>
        ${u.state === 'up' ? '<div class="progress indet" style="margin-top:6px"><i></i></div>' : ''}</div><button type="button" class="act" data-act="hapus-berkas" aria-label="Hapus berkas">${ic('x')}</button></div>`;
    }
    return `<label class="drop" for="f-file">${ic('cloud-upload')}<div class="t">Klik atau seret berkas surat ke sini</div><div class="s">PDF, JPG, atau PNG · maks ${S.server.maksBerkasMB || 10} MB · langsung diunggah saat dipilih</div></label>
      <input type="file" id="f-file" accept="application/pdf,image/jpeg,image/png" hidden>`;
  },
  async pilihFile(file) {
    if (!file) return;
    const okType = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type);
    const maks = (S.server.maksBerkasMB || 10) * 1048576;
    if (!okType) { toast('Format berkas harus PDF, JPG, atau PNG.', 'err'); return; }
    if (file.size > maks) { toast('Ukuran berkas melebihi ' + (S.server.maksBerkasMB || 10) + ' MB.', 'err'); return; }
    // Unggah di latar SEGERA setelah dipilih — saat admin selesai mengisi, berkas sudah di server
    const u = { file, state: 'up', id: '' };
    this.upload = u; this.renderPanel();
    u.promise = (async () => {
      try {
        const data = await fileToBase64(file);
        const res = await api('uploadBerkas', { nama: file.name, mime: file.type, data });
        if (!res.success) throw new Error(res.message);
        u.id = res.data.id; u.state = 'done';
      } catch (e) { u.state = 'error'; u.err = e.message; }
      if (this.upload === u) this.renderPanel();
      return u;
    })();
  },
  updatePreview() {
    const el = $('[data-preview]', this.el);
    if (!el) return;
    const prodi = this.form.prodi.value, tgl = ($('#f-tgl', this.el) || {}).value || todayStr();
    el.textContent = prodi ? previewNomor(this.status, prodi, tgl) : formatNomor(S.nomor[JENIS[this.status]] && S.nomor[JENIS[this.status]].format, (S.nomor[JENIS[this.status]] || {}).nomor_terakhir + 1 || 1, (S.nomor[JENIS[this.status]] || {}).digit, '', tgl) + '  ← pilih prodi';
  },
  cekNim() {
    const nim = this.form.nim.value.trim(), er = $('[data-err="nim"]', this.el);
    const dup = nim && S.mhs.find((m) => m.nim === nim && (!this.orig || m.id !== this.orig.id));
    er.textContent = dup ? 'NIM sudah terdaftar atas nama ' + dup.nama + '.' : '';
    this.form.nim.classList.toggle('invalid', !!dup);
    return !dup;
  },
  validasi() {
    const f = this.form, err = {};
    const nim = f.nim.value.trim().replace(/\s+/g, '');
    if (!nim) err.nim = 'NIM wajib diisi.'; else if (!/^[0-9A-Za-z.\-/]{4,24}$/.test(nim)) err.nim = 'Format NIM tidak valid.';
    if (!f.nama.value.trim()) err.nama = 'Nama lengkap wajib diisi.';
    if (!f.prodi.value) err.prodi = 'Pilih program studi.';
    if (!f.kelas.value) err.kelas = 'Pilih kelas.';
    if (!f.gender.value) err.gender = 'Pilih jenis kelamin.';
    else if (genderDariKelas(f.kelas.value) && genderDariKelas(f.kelas.value) !== f.gender.value) err.gender = f.kelas.value + ' khusus ' + (genderDariKelas(f.kelas.value) === 'L' ? 'laki-laki' : 'perempuan') + '.';
    const th = +f.tahun_masuk.value;
    if (!th) err.tahun_masuk = 'Tahun masuk wajib diisi.'; else if (th < 1990 || th > new Date().getFullYear() + 1) err.tahun_masuk = 'Tahun masuk tidak wajar.';
    if (this.berubah() && JENIS[this.status] && !this.upload) err.berkas = 'Unggah surat ' + this.status + ' terlebih dahulu (wajib).';
    if (this.upload && this.upload.state === 'error') err.berkas = 'Unggahan gagal: ' + this.upload.err + ' — pilih ulang berkas.';
    Object.keys(err).forEach((k) => { const e = $('[data-err="' + k + '"]', this.el); if (e) e.textContent = err[k]; const i = this.form[k]; if (i && i.classList) i.classList.add('invalid'); });
    if (!err.nim && !this.cekNim()) err.nim = 'dup';
    const first = Object.keys(err)[0];
    if (first) { const i = this.form[first] || $('[data-err="' + first + '"]', this.el); if (i && i.scrollIntoView) i.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (i && i.focus) i.focus({ preventScroll: true }); }
    return !first;
  },
  async simpan() {
    if (!this.validasi()) { toast('Periksa kembali isian yang ditandai.', 'err'); return; }
    const btn = $('[data-simpan]', this.el), f = this.form;
    setBusy(btn, true, this.upload && this.upload.state === 'up' ? 'Menunggu unggahan…' : 'Menyimpan…');
    try {
      if (this.upload && this.upload.state === 'up') await this.upload.promise;
      if (this.upload && this.upload.state === 'error') throw new Error('Unggahan berkas gagal: ' + this.upload.err);
      if (this.upload) setBusy(btn, false), setBusy(btn, true, JENIS[this.status] && this.berubah() ? 'Menerbitkan nomor…' : 'Menyimpan…');
      const payload = {
        id: this.orig ? this.orig.id : '', versi: this.orig ? this.orig.diubah_pada : '',
        nim: f.nim.value.trim(), nama: f.nama.value.trim(), prodi: f.prodi.value, kelas: f.kelas.value,
        tahun_masuk: +f.tahun_masuk.value, gender: f.gender.value, status: this.status, catatan: f.catatan.value.trim(),
        tanggal_status: this.berubah() ? (($('#f-tgl', this.el) || {}).value || todayStr()) : '',
        berkas_id: this.upload ? this.upload.id : ''
      };
      const res = await api('simpanMahasiswa', payload);
      if (!res.success) {
        if (res.data && res.data.code === 'DUP_NIM') { $('[data-err="nim"]', this.el).textContent = res.message; f.nim.classList.add('invalid'); }
        throw new Error(res.message);
      }
      const d = res.data;
      State.upsertMhs(d.mhs);
      if (d.riwayat) State.addRiwayat(d.riwayat);
      if (d.riwayatDiubah) State.replaceRiwayat(d.riwayatDiubah);
      if (d.nomor) S.nomor = d.nomor;
      if (d.logNomor) S.logNomor = d.logNomor;
      State.markStale(); State.changed();
      toast(res.message, 'ok', d.nomorSurat ? 'Nomor surat terbit' : '');
      this.orig = null;
      this.kembali();
    } catch (e) {
      toast(e.message, 'err', 'Gagal menyimpan');
    } finally { setBusy(btn, false); }
  },
  kembali() { location.hash = this.returnTo && this.returnTo.indexOf('#/form') !== 0 ? this.returnTo : '#/mahasiswa'; }
});
// Catat hash sebelumnya agar tombol Batal/Simpan kembali ke halaman asal
window.addEventListener('hashchange', (e) => { const old = (e.oldURL.split('#')[1] || ''); if (Pages.form && old.indexOf('/form') !== 0) Pages.form.prevHash = '#' + old; });

// Pilih mahasiswa untuk "Catat Cuti" / "Catat Pengunduran Diri"
function pilihMahasiswa(status) {
  const m = modal({
    title: status === 'Cuti' ? 'Catat Cuti Akademik' : 'Catat Pengunduran Diri', size: '',
    body: `<p class="muted" style="margin:0 0 14px">Cari mahasiswa berdasarkan nama atau NIM.</p>
      <label class="search">${ic('search')}<input class="input" data-q placeholder="Ketik nama atau NIM…" autofocus autocomplete="off"></label>
      <div data-hasil style="margin-top:14px;display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow:auto"></div>`
  });
  const hasil = $('[data-hasil]', m.el), q = $('[data-q]', m.el);
  const render = () => {
    const s = q.value.trim().toLowerCase();
    const list = S.mhs.filter((x) => x.status !== status && cariCocok(s, [x.nama.toLowerCase(), x.nim])).slice(0, 12);
    hasil.innerHTML = list.length ? list.map((x) => `<button class="btn btn-soft" style="justify-content:flex-start;text-align:left;height:auto;padding:12px 14px" data-id="${x.id}">
        <span class="initials" style="background:var(--sekunder);width:36px;height:36px;font-size:13px">${esc(initials(x.nama))}</span>
        <span style="flex:1;min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis">${esc(x.nama)}</b><span class="mono muted">${esc(x.nim)} · ${esc(x.prodi)} · ${esc(KELAS_PENDEK[x.kelas] || x.kelas)}</span></span>${chipStatus(x.status)}</button>`).join('')
      : '<div class="empty">' + ic('scan-search') + 'Tidak ditemukan.</div>';
  };
  q.addEventListener('input', debounce(render, 120));
  hasil.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) { m.close(); go('form', b.dataset.id + '/' + status); } });
  render();
}

// =====================================================================
// DAFTAR CUTI & DAFTAR MENGUNDURKAN DIRI (register surat dari Riwayat)
// =====================================================================
function daftarSuratPage(status) {
  const isCuti = status === 'Cuti';
  const key = isCuti ? 'cuti' : 'mundur';
  return {
    crumb: [isCuti ? 'Daftar Cuti' : 'Daftar Mengundurkan Diri', 'Register Surat'],
    template: () => `
      <div class="card status-card" data-head></div>
      <div class="card mt">
        <div class="filters">
          <label class="search"><span class="sr-only">Cari</span>${ic('search')}<input class="input" data-f="q" placeholder="Cari nama / NIM / nomor surat…" autocomplete="off"></label>
          <select class="input" data-f="prodi">${optProdi('', 'Semua Prodi')}</select>
          <select class="input" data-f="kelas">${optKelas('', 'Semua Kelas')}</select>
          <select class="input" data-f="ta"><option value="">Tahun Akademik</option></select>
          <select class="input" data-f="kini"><option value="masih">${isCuti ? 'Masih cuti' : 'Masih berstatus'}</option><option value="">Semua surat</option><option value="lepas">${isCuti ? 'Sudah aktif kembali' : 'Sudah berubah status'}</option></select>
          <button class="icon-btn" data-act="reset" title="Atur ulang filter" aria-label="Atur ulang filter">${ic('rotate-ccw')}</button>
        </div>
      </div>
      <div class="card table-card mt" data-tbl></div>`,
    mount(el) {
      const self = this;
      this.f = { q: '', prodi: '', kelas: '', ta: '', kini: 'masih' };
      this.tbl = new Tabel($('[data-tbl]', el), {
        id: key, pageSize: 10, sortKey: 'tanggal_status', sortDir: -1, empty: isCuti ? 'Belum ada data cuti yang cocok.' : 'Belum ada data mengundurkan diri yang cocok.',
        cols: [
          { key: 'no', label: 'No', render: (r, i) => i + 1, m: 'hide', cls: 'muted' },
          { key: 'nomor_surat', label: 'Nomor Surat', sort: true, m: 'wide', render: (r) => '<div class="no-surat">' + nomorHtml(r.nomor_surat) + '</div>' +
              (r.id_berkas ? `<button class="btn-link sm" data-berkas="${esc(r.id_berkas)}" data-nama="${esc(r.nama)}">${ic('eye')} Lihat surat</button>` : '<span class="muted" style="font-size:12.5px">Belum ada berkas</span>') },
          { key: 'nama', label: 'Mahasiswa', sort: true, m: 'main', render: (r) => '<b class="nama">' + esc(r.nama) + '</b><div class="nim">' + esc(r.nim) + '</div>' },
          { key: 'prodi', label: 'Prodi', sort: true, render: (r) => chipProdi(r.prodi) },
          { key: 'kelas', label: 'Kelas', sort: true, render: (r) => kelasHtml(r.kelas) },
          { key: 'tanggal_status', label: isCuti ? 'Tanggal Cuti' : 'Tanggal', sort: true, cls: 'nowrap', render: (r) => fmtTgl(r.tanggal_status) },
          { key: 'kini', label: 'Status Kini', render: (r) => r._kini === 'masih' ? '<span class="chip ' + (isCuti ? 's-cuti' : 's-md') + '"><span class="dot"></span>' + (isCuti ? 'Masih cuti' : 'Berlaku') + '</span>'
              : r._kini === 'hapus' ? chipStatus('Dihapus') : chipStatus(r._m ? r._m.status : '—', r._m && r._m.status === 'Aktif') },
          { key: 'aksi', label: '', cls: 'actions', render: (r) => isAdmin() && r._m ? `<button class="act boxed" data-act="ubah" data-id="${r._m.id}" title="Ubah data / status" aria-label="Ubah">${ic('pencil')}</button>` : '' }
        ],
        rowAttr: (r) => r._m ? 'class="clickable" data-row="' + r._m.id + '"' : '',
        info: (a, b, t) => 'Menampilkan <b>' + fmtNum(b - a + (t ? 1 : 0)) + '</b> dari <b>' + fmtNum(t) + '</b> data ' + (isCuti ? 'cuti' : 'mengundurkan diri')
      });
      $$('[data-f]', el).forEach((inp) => {
        inp.addEventListener(inp.tagName === 'INPUT' ? 'input' : 'change', debounce(() => { self.f[inp.dataset.f] = inp.tagName === 'INPUT' ? inp.value.trim().toLowerCase() : inp.value; self.render(el, true); }, inp.tagName === 'INPUT' ? 180 : 0));
      });
      el.addEventListener('click', (e) => {
        const bk = e.target.closest('[data-berkas]');
        if (bk) { e.stopPropagation(); lihatBerkas(bk.dataset.berkas, 'Surat · ' + bk.dataset.nama); return; }
        const b = e.target.closest('[data-act]');
        if (b) {
          e.stopPropagation();
          if (b.dataset.act === 'ubah') go('form', b.dataset.id);
          if (b.dataset.act === 'catat') pilihMahasiswa(status);
          if (b.dataset.act === 'unduh') self.unduh(b);
          if (b.dataset.act === 'reset') { self.f = { q: '', prodi: '', kelas: '', ta: '', kini: 'masih' }; $$('[data-f]', el).forEach((i) => { i.value = self.f[i.dataset.f]; }); self.render(el, true); }
          return;
        }
        const tr = e.target.closest('tr[data-row]');
        if (tr) Detail.open(tr.dataset.row);
      });
    },
    data() {
      return S.riwayat.filter((r) => r.status_baru === status).map((r) => {
        const m = mhsOfRiwayat(r);
        const kini = !m ? 'hapus' : (m.status === status && (m.nomor_surat || '') === (r.nomor_surat || '')) ? 'masih' : 'lepas';
        return Object.assign({}, r, { _m: m, _kini: kini, _ta: tahunAkademik(r.tanggal_status) });
      });
    },
    show(el) { this.render(el, false); },
    refresh(el) { this.render(el, false); },
    render(el, resetPage) {
      const all = this.data(), f = this.f;
      const tas = [...new Set(all.map((r) => r._ta).filter(Boolean))].sort().reverse();
      const sel = $('[data-f="ta"]', el), want = '<option value="">Tahun Akademik</option>' + tas.map((t) => '<option' + (t === f.ta ? ' selected' : '') + '>' + t + '</option>').join('');
      if (sel.innerHTML !== want) sel.innerHTML = want;
      const rows = all.filter((r) => (!f.prodi || r.prodi === f.prodi) && (!f.kelas || r.kelas === f.kelas) && (!f.ta || r._ta === f.ta) &&
        (!f.kini || r._kini === f.kini || (f.kini === 'lepas' && r._kini === 'hapus')) && cariCocok(f.q, [r.nama.toLowerCase(), r.nim, (r.nomor_surat || '').toLowerCase()]));
      this.tbl.setRows(rows, resetPage);
      this.head(el, all);
    },
    head(el, all) {
      // Surat terakhir = tanggal status paling baru (data migrasi lama tidak dianggap "terakhir")
      const terbit = all.filter((r) => r.nomor_surat).sort((a, b) => String(b.tanggal_status).localeCompare(String(a.tanggal_status)) || b.waktu - a.waktu);
      const last = terbit[0];
      const masih = all.filter((r) => r._kini === 'masih').length;
      const ta = tahunAkademik(todayStr());
      const totalTa = all.filter((r) => r._ta === ta).length;
      const base = S.nomor[JENIS[status]] || {}, dg = base.digit || 3;
      const counter = isCuti && base.mode === 'PER_PRODI'
        ? Object.keys(PRODI).map((p) => p + ' ' + pad((S.nomor['CUTI_' + p] || {}).nomor_terakhir || 0, dg)).join(' · ')
        : pad(base.nomor_terakhir || 0, dg);
      const actions = `<div class="head-actions"><button class="btn btn-soft" data-act="unduh">${ic('download')} Unduh Excel</button>${isAdmin() ? `<button class="btn btn-primary" data-act="catat">${ic(isCuti ? 'plus' : 'user-minus')} ${isCuti ? 'Catat Cuti' : 'Catat Pengunduran Diri'}</button>` : ''}</div>`;
      const h = isCuti
        ? `<div class="icon-tile sek">${ic('calendar-days')}</div><div class="grow"><div class="lbl">Status Penomoran Surat</div><span class="no">${last ? nomorHtml(last.nomor_surat) : 'Belum ada surat cuti'}</span></div>${actions}
           <div class="status-sub"><span>Sedang cuti saat ini: <b>${fmtNum(masih)} mahasiswa</b> · Surat T.A. ${ta}: <b>${fmtNum(totalTa)}</b></span><span>Counter terakhir: <b class="mono">${esc(counter)}</b></span></div>`
        : `<div class="grow"><div class="lbl red">${ic('circle-alert')} Status Nomor Dokumen Terakhir</div><div class="no big">${last ? nomorHtml(last.nomor_surat) : 'Belum ada surat'}</div></div>${actions}
           <div class="status-sub"><span>Total Mengundurkan Diri T.A. ${ta}: <b>${fmtNum(totalTa)} orang</b></span><span><span class="dot" style="background:var(--st-md)"></span> Update terakhir: ${last ? relWaktu(last.waktu) : '—'}</span></div>`;
      const box = $('[data-head]', el);
      if (box._h !== h) { box.innerHTML = h; box._h = h; }
    },
    async unduh(btn) {
      setBusy(btn, true, 'Menyiapkan…');
      try {
        const rows = this.tbl.sorted();
        await exportXlsx((isCuti ? 'Daftar_Cuti_' : 'Daftar_Mengundurkan_Diri_') + stampFile() + '.xlsx', isCuti ? 'Daftar Cuti' : 'Mengundurkan Diri',
          ['No', 'Nomor Surat', 'Nama Mahasiswa', 'NIM', 'Prodi', 'Kelas', 'Tanggal', 'Tahun Akademik', 'Status Kini', 'Tautan Berkas'],
          rows.map((r, i) => [i + 1, r.nomor_surat, r.nama, r.nim, r.prodi, r.kelas, r.tanggal_status, r._ta, r._kini === 'masih' ? status : r._kini === 'hapus' ? 'Data dihapus' : (r._m ? r._m.status : ''), r.link_berkas]),
          [5, 36, 30, 13, 7, 20, 12, 14, 18, 50]);
        toast(fmtNum(rows.length) + ' baris diunduh sesuai filter aktif.');
      } catch (e) { toast(e.message, 'err'); }
      setBusy(btn, false);
    }
  };
}
registerPage('cuti', daftarSuratPage('Cuti'));
registerPage('mundur', daftarSuratPage('Mengundurkan Diri'));

// =====================================================================
// RIWAYAT STATUS (semua mutasi) — dari "Lihat Semua" di dashboard
// =====================================================================
registerPage('riwayat', {
  crumb: ['Dashboard', 'Riwayat Status'], nav: 'dashboard',
  template: () => `
    <div class="page-head"><div><h1>Riwayat Status</h1><p>Seluruh mutasi status mahasiswa: cuti, mengundurkan diri, dan aktif kembali.</p></div></div>
    <div class="card"><div class="filters">
      <label class="search">${ic('search')}<input class="input" data-f="q" placeholder="Cari nama / NIM / nomor surat…"></label>
      <select class="input" data-f="jenis"><option value="">Semua Perubahan</option><option value="Cuti">Cuti</option><option value="Mengundurkan Diri">Mengundurkan Diri</option><option value="Aktif">Aktif Kembali</option></select>
      <select class="input" data-f="ta"><option value="">Tahun Akademik</option></select>
    </div></div>
    <div class="card table-card mt" data-tbl></div>`,
  mount(el) {
    const self = this;
    this.f = { q: '', jenis: '', ta: '' };
    this.tbl = new Tabel($('[data-tbl]', el), {
      id: 'riw', pageSize: 25, sortKey: 'waktu', sortDir: -1,
      cols: [
        { key: 'waktu', label: 'Dicatat', sort: true, cls: 'nowrap', render: (r) => fmtWaktu(r.waktu) },
        { key: 'nama', label: 'Nama Mahasiswa', sort: true, cls: 'nama', m: 'main' },
        { key: 'nim', label: 'NIM', sort: true, cls: 'nim' },
        { key: 'status_baru', label: 'Perubahan', render: (r) => (r.status_lama ? '<span class="muted">' + esc(r.status_lama) + ' →</span> ' : '') + chipStatus(r.status_baru, r.status_baru === 'Aktif' && !!r.status_lama) },
        { key: 'nomor_surat', label: 'Nomor Surat', cls: 'no-surat', m: 'wide', render: (r) => nomorHtml(r.nomor_surat) },
        { key: 'tanggal_status', label: 'Tanggal', sort: true, cls: 'nowrap', render: (r) => fmtTgl(r.tanggal_status) },
        { key: 'oleh', label: 'Oleh', render: (r) => esc(r.oleh) }
      ],
      rowAttr: (r) => 'class="clickable" data-nim="' + esc(r.nim) + '"'
    });
    $$('[data-f]', el).forEach((inp) => inp.addEventListener(inp.tagName === 'INPUT' ? 'input' : 'change', debounce(() => { self.f[inp.dataset.f] = inp.tagName === 'INPUT' ? inp.value.trim().toLowerCase() : inp.value; self.render(el, true); }, 150)));
    el.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-nim]'); if (tr) { const m = S.mhs.find((x) => x.nim === tr.dataset.nim); if (m) Detail.open(m.id); } });
  },
  show(el) { this.render(el, false); },
  refresh(el) { this.render(el, false); },
  render(el, reset) {
    const f = this.f;
    const tas = [...new Set(S.riwayat.map((r) => tahunAkademik(r.tanggal_status)).filter(Boolean))].sort().reverse();
    const sel = $('[data-f="ta"]', el), want = '<option value="">Tahun Akademik</option>' + tas.map((t) => '<option' + (t === f.ta ? ' selected' : '') + '>' + t + '</option>').join('');
    if (sel.innerHTML !== want) sel.innerHTML = want;
    this.tbl.setRows(S.riwayat.filter((r) => (!f.jenis || r.status_baru === f.jenis) && (!f.ta || tahunAkademik(r.tanggal_status) === f.ta) &&
      cariCocok(f.q, [r.nama.toLowerCase(), r.nim, (r.nomor_surat || '').toLowerCase()])), reset);
  }
});
