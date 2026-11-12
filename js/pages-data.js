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
const optStatus = (sel) => '<option value="">Semua Status</option><option value="terdaftar"' + (sel === 'terdaftar' ? ' selected' : '') + '>Terdaftar (Aktif + Cuti)</option>' + STATUS.map((k) => '<option' + (sel === k ? ' selected' : '') + '>' + k + '</option>').join('');
/** v1.3 — mahasiswa terdaftar = Aktif + Cuti (dasar hitungan Total di dashboard; Mengundurkan Diri & Lulus tidak dihitung) */
const isTerdaftar = (m) => m.status === 'Aktif' || m.status === 'Cuti';
function cariCocok(q, fields) { if (!q) return true; const s = fields.join(' ').toLowerCase(); return q.split(/\s+/).every((w) => s.includes(w)); }
function hitungStatus(list) {
  const c = { total: list.length, Aktif: 0, Cuti: 0, 'Mengundurkan Diri': 0, Lulus: 0 };
  list.forEach((m) => { if (c[m.status] !== undefined) c[m.status]++; });
  return c;
}
function mhsOfRiwayat(r) { return S.byId.get(r.mahasiswa_id) || S.mhs.find((m) => m.nim === r.nim) || null; }

// =====================================================================
// DASHBOARD (v1.1) — kartu, filter cepat prodi, 4 grafik, 3 tabel rekap L/P
// v1.2 — kartu ke-5 "Lulus" + filter centang kelas (berlaku untuk seluruh dashboard).
// v1.3 — Total = mahasiswa terdaftar (Aktif + Cuti) di SELURUH dashboard; Mengundurkan Diri & Lulus
//        hanya informasi (tidak dijumlahkan). Tabel Prodi & Kelas dirinci per angkatan. Unduh Excel.
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
function donutSvg(seg, total, atas, bawah, label, luar) {
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
    <ul class="legend-list">${seg.filter((s) => s.n > 0 || s.selalu).map((s) => `<li data-tip="${esc(s.k)}: ${fmtNum(s.n)}"><i class="dot" style="background:${s.c}"></i><span>${esc(s.k)}</span><b>${fmtNum(s.n)}</b><em>${fmtPct(total ? (s.n / total) * 100 : 0)}</em></li>`).join('')}${
      luar && luar.length ? '<li class="legend-sep">Tidak dihitung dalam total</li>' + luar.map((s) => `<li class="luar" data-tip="${esc(s.k)}: ${fmtNum(s.n)} (tidak dihitung)"><i class="dot" style="background:${s.c}"></i><span>${esc(s.k)}</span><b>${fmtNum(s.n)}</b><em></em></li>`).join('') : ''}</ul>`;
}
/** Tabel silang bertingkat: baris × kelompok kolom, tiap kelompok L | P | Total, plus baris Total.
 *  v1.3 — dipecah menjadi xtabModel() (menghitung angka) dan xtabHtml() (menggambar tabel).
 *  Model yang sama dipakai unduhan Excel, sehingga isi Excel identik dengan dashboard.
 *  - baris boleh membawa filter sendiri (b.f), mis. "ES 2021" → { prodi: 'ES', tahun: 2021 }
 *  - o.luar = kelompok yang tampil sesudah Total tetapi TIDAK ikut dijumlahkan (Mengundurkan Diri, Lulus) */
function xtabModel(o) {
  // o: {judul, judulBaris, baris:[{k,label,f?,cls?}], kelompok:[{k,label}], list, kunciBaris(m), kunciKelompok(m),
  //     totalKelompok, labelTotalKelompok, filter, fBaris, fKelompok, drillOk, luar:{list, kelompok:[{k,label}]}}
  const grup = o.kelompok.map((g) => Object.assign({ jenis: 'isi' }, g))
    .concat(o.totalKelompok === false ? [] : [{ k: '*', label: o.labelTotalKelompok || 'Total', jenis: 'total' }])
    .concat(((o.luar && o.luar.kelompok) || []).map((g, i) => Object.assign({ jenis: 'luar', pertama: i === 0 }, g)));
  const sel = (b, g) => (g.jenis === 'luar' ? o.luar.list : o.list)
    .filter((m) => (b === '*' || o.kunciBaris(m) === b.k) && (g.k === '*' || o.kunciKelompok(m) === g.k));
  const sel3 = (b, g) => {
    const x = hitLP(sel(b, g));
    const f = Object.assign({}, o.filter || {});
    if (b !== '*') Object.assign(f, b.f || { [o.fBaris]: b.k });
    if (g.k !== '*') f[o.fKelompok] = g.k;
    const drill = (gd) => { const ff = Object.assign({}, f, gd ? { gender: gd } : {}); return !o.drillOk || o.drillOk(ff) ? ff : null; };
    return { L: x.L, P: x.P, T: x.T, X: x.X, fL: drill('L'), fP: drill('P'), fT: drill('') };
  };
  const rows = o.baris.map((b) => ({ label: b.label, cls: b.cls || '', cells: grup.map((g) => sel3(b, g)) }));
  const total = { label: 'Total', cells: grup.map((g) => sel3('*', g)) };
  const iTot = grup.findIndex((g) => g.jenis === 'total');
  return { judul: o.judul || '', judulBaris: o.judulBaris, grup, rows, total, tanpaGender: iTot > -1 ? total.cells[iTot].X : hitLP(o.list).X };
}
function xtabHtml(md) {
  const kls = (g) => (g.jenis === 'total' ? 'xt-gtot' : g.jenis === 'luar' ? 'xt-luar' + (g.pertama ? ' xt-luar1' : '') : '');
  const at = (ff) => (ff ? ` data-drill='${esc(JSON.stringify(ff))}'` : '');
  const td = (n, ff, cls) => `<td class="${cls || ''}${n ? '' : ' nol'}"${n ? at(ff) : ''}>${fmtNum(n)}</td>`;
  const sel3d = (x, g, tot) => {
    const sub = g.jenis === 'total' || tot ? 'sub' : '', lu = g.jenis === 'luar' ? ' luar' : '';
    return td(x.L, x.fL, sub + lu + (g.pertama ? ' luar1' : '')) + td(x.P, x.fP, sub + lu) + td(x.T, x.fT, 'tot' + lu);
  };
  const head = `<thead><tr><th rowspan="2" class="xt-row">${esc(md.judulBaris)}</th>${md.grup.map((g) => `<th colspan="3" class="xt-grp${kls(g) ? ' ' + kls(g) : ''}">${esc(g.label)}${g.jenis === 'luar' ? '<small>tidak dihitung</small>' : ''}</th>`).join('')}</tr>
    <tr>${md.grup.map((g) => `<th class="${kls(g)}">L</th><th class="${g.jenis === 'luar' ? 'xt-luar' : kls(g)}">P</th><th class="${g.jenis === 'luar' ? 'xt-luar' : kls(g)}">Total</th>`).join('')}</tr></thead>`;
  const body = md.rows.map((b) => `<tr${b.cls ? ` class="${b.cls}"` : ''}><th class="xt-row">${esc(b.label)}</th>${b.cells.map((x, i) => sel3d(x, md.grup[i])).join('')}</tr>`).join('');
  const totRow = `<tr class="xt-total"><th class="xt-row">Total</th>${md.total.cells.map((x, i) => sel3d(x, md.grup[i], true)).join('')}</tr>`;
  return `<div class="xt-wrap"><table class="xt">${head}<tbody>${body}</tbody><tfoot>${totRow}</tfoot></table></div>` +
    (md.tanpaGender ? `<p class="xt-note">${ic('info')}<span>Total memuat <b>${fmtNum(md.tanpaGender)}</b> mahasiswa yang jenis kelaminnya belum diisi (tidak masuk kolom L/P). Lengkapi lewat <a href="#/impor">Impor Excel → Perbarui data</a>.</span></p>` : '');
}
function xtab(o) { return xtabHtml(xtabModel(o)); }

registerPage('dashboard', {
  crumb: () => ['Dashboard', 'Data Mahasiswa ' + semesterLabel()],
  template: () => `
    <div class="grid kpi5" id="db-kpi"></div>
    <div class="card pf-bar mt">
      <div class="pf-row">
        <div><h3 class="card-title">Detail &amp; Filter Cepat Program Studi</h3><p class="section-sub" data-pf-info></p></div>
        <div class="pf-btns" role="group" aria-label="Filter program studi">
          <button type="button" data-pf="">Semua</button>${PRODI_KEYS.map((p) => `<button type="button" data-pf="${p}" title="${esc(PRODI[p])}">${p}<small data-pf-n="${p}"></small></button>`).join('')}
        </div>
      </div>
      <div class="kf-row">
        <div class="kf-head"><span class="kf-lbl">${ic('list-checks')} Filter Kelas</span><span class="kf-sub">Centang kelas yang ingin dihitung</span></div>
        <div class="kf-list" role="group" aria-label="Filter kelas">
          ${KELAS.map((k, i) => `<label class="kf"><input type="checkbox" data-kf="${i}"><span class="kf-box">${ic('check')}</span><span>${esc(k)}</span><small data-kf-n="${i}"></small></label>`).join('')}
          <span class="kf-aksi"><button type="button" class="btn-link" data-kf-aksi="semua">Semua</button><button type="button" class="btn-link" data-kf-aksi="kosong">Kosongkan</button></span>
        </div>
        <div class="kf-end"><div class="kf-sum" data-kf-sum aria-live="polite"></div>
          <button type="button" class="btn btn-primary kf-unduh" data-unduh-db>${ic('file-spreadsheet')} Unduh Excel</button></div>
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
        <div><h2 class="section">Aktivitas Terbaru</h2><p class="section-sub">Mutasi status: cuti, pengunduran diri, kelulusan, dan aktif kembali</p></div>
        <a href="#/riwayat" class="btn-link">Lihat Semua ${ic('arrow-right')}</a>
      </div>
      <div id="db-aktivitas"></div>
    </div>`,
  mount(el) {
    const self = this;
    this.prodi = Store.get(userKey('db:prodi'), '');
    // v1.2 — kelas yang TIDAK dicentang (dikecualikan); kosong = semua kelas dihitung
    this.kx = new Set((Store.get(userKey('db:kelas-x'), []) || []).filter((k) => KELAS.includes(k)));
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
    el.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-kf]');
      if (!cb) return;
      const k = KELAS[+cb.dataset.kf];
      if (cb.checked) self.kx.delete(k); else self.kx.add(k);
      self.setKelas(el);
    });
    el.addEventListener('click', (e) => {
      const ud = e.target.closest('[data-unduh-db]');
      if (ud) { unduhExcelDashboard(ud, self.ekspor); return; }
      const ka = e.target.closest('[data-kf-aksi]');
      if (ka) { self.kx = new Set(ka.dataset.kfAksi === 'kosong' ? KELAS : []); self.setKelas(el); return; }
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
  setKelas(el) { Store.set(userKey('db:kelas-x'), [...this.kx]); this.refresh(el); },
  show(el) { if (pageNeedsRender(el) || !el._done) this.refresh(el); el._done = 1; },
  refresh(el) {
    const pf = this.prodi, kx = this.kx;
    const dipilih = KELAS.filter((k) => !kx.has(k)), sebagian = kx.size > 0;
    const kelasOk = (x) => !sebagian || (KELAS.includes(x.kelas) && !kx.has(x.kelas));
    const prodiOk = (m) => !pf || m.prodi === pf;
    const dasarK = sebagian ? S.mhs.filter(kelasOk) : S.mhs;          // semua status, setelah filter kelas
    // v1.3 — dasar SELURUH hitungan: mahasiswa terdaftar (Aktif + Cuti)
    const semua = dasarK.filter(isTerdaftar);                          // terdaftar, semua prodi (grafik & tombol prodi)
    const list = pf ? semua.filter(prodiOk) : semua;                   // terdaftar, sesuai filter prodi & kelas
    const luar = dasarK.filter((m) => prodiOk(m) && (m.status === 'Mengundurkan Diri' || m.status === 'Lulus'));  // info, tidak dijumlahkan
    const c = hitungStatus(list), cl = hitungStatus(luar), tot = list.length, pct = (n) => (tot ? (n / tot) * 100 : 0);
    const lpAll = hitLP(list), lpAktif = hitLP(list.filter((m) => m.status === 'Aktif')), lpLulus = hitLP(luar.filter((m) => m.status === 'Lulus'));
    const namaKelas = dipilih.length <= 2 ? dipilih.map((k) => KELAS_PENDEK[k]).join(' + ') : dipilih.length + ' kelas';
    const lp = (x) => `<div class="lp"><span class="g-L-t">${ic('user')} L <b>${fmtNum(x.L)}</b></span><span class="g-P-t">${ic('user')} P <b>${fmtNum(x.P)}</b></span>${x.X ? `<span class="lp-x" data-tip="${fmtNum(x.X)} mahasiswa belum diisi jenis kelaminnya">${ic('circle-help')} <b>${fmtNum(x.X)}</b></span>` : ''}</div>`;
    const kpi = (icon, tile, lbl, val, cap, extra, deco, side) => `
      <div class="card kpi kpi2"><div class="top"><div class="icon-tile ${tile}">${ic(icon)}</div>${side ? `<span class="kpi-side">${ic(side)}</span>` : ''}</div>
      <div class="lbl">${lbl}</div><div class="val">${fmtNum(val)}</div>${extra || ''}<div class="foot">${cap}</div><div class="deco" style="background:${deco}"></div></div>`;
    const lingkup = (pf ? 'Prodi ' + PRODI[pf] : 'Seluruh angkatan') + (sebagian ? ' · ' + (dipilih.length ? namaKelas : 'tanpa kelas') : '');
    const capTotal = 'Aktif + Cuti · ' + esc(lingkup);
    const capLuar = 'Tidak dihitung dalam total';
    $('#db-kpi', el).innerHTML =
      kpi('users', 'sek', 'Total Mahasiswa', tot, capTotal, lp(lpAll), 'var(--sek-tint)') +
      kpi('user-check', 'k-aktif', 'Mahasiswa Aktif', c.Aktif, fmtPct(pct(c.Aktif)) + ' dari total', lp(lpAktif), 'color-mix(in srgb,var(--st-aktif) 12%,var(--kartu))', 'chart-column') +
      kpi('calendar-days', 'k-cuti', 'Mahasiswa Cuti', c.Cuti, fmtPct(pct(c.Cuti)) + ' dari total', '', 'color-mix(in srgb,var(--aksen) 18%,var(--kartu))', 'history') +
      kpi('user-minus', 'k-md', 'Mengundurkan Diri', cl['Mengundurkan Diri'], capLuar, '', 'var(--bad-bg)') +
      kpi('graduation-cap', 'k-lulus', 'Mahasiswa Lulus', cl.Lulus, capLuar, lp(lpLulus), 'color-mix(in srgb,var(--st-lulus) 12%,var(--kartu))');

    // Filter centang kelas (v1.2): jumlah per kelas mengikuti filter prodi (v1.3: hanya mahasiswa terdaftar)
    const dasarProdi = S.mhs.filter((m) => prodiOk(m) && isTerdaftar(m));
    KELAS.forEach((k, i) => {
      const cb = $('[data-kf="' + i + '"]', el); cb.checked = !kx.has(k);
      $('[data-kf-n="' + i + '"]', el).textContent = fmtNum(dasarProdi.filter((m) => m.kelas === k).length);
    });
    $('[data-kf-sum]', el).innerHTML = !dipilih.length ? ic('circle-alert') + ' Belum ada kelas yang dicentang.'
      : (sebagian ? '<b>' + esc(dipilih.map((k) => KELAS_PENDEK[k]).join(' + ')) + '</b>' : 'Semua kelas') + (pf ? ' · ' + pf : '') +
        ': <span class="big">' + fmtNum(tot) + '</span> mahasiswa <span class="kf-lp">L <b>' + fmtNum(lpAll.L) + '</b> · P <b>' + fmtNum(lpAll.P) + '</b>' + (lpAll.X ? ' · ? <b>' + fmtNum(lpAll.X) + '</b>' : '') + '</span>';

    // Panel filter cepat
    $$('[data-pf]', el).forEach((b) => b.classList.toggle('on', b.dataset.pf === pf));
    PRODI_KEYS.forEach((p) => { $('[data-pf-n="' + p + '"]', el).textContent = fmtNum(semua.filter((m) => m.prodi === p).length); });
    $('[data-pf-info]', el).textContent = (pf ? 'Menampilkan ' + PRODI[pf] + ' (' + pf + ') · klik lagi untuk semua prodi' : 'Menampilkan semua program studi · klik prodi untuk menyaring seluruh dashboard') +
      (sebagian ? ' · kelas: ' + (dipilih.length ? namaKelas : 'tidak ada') : '') + ' · Total = Aktif + Cuti';

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

    // Grafik 4 — status akademik (lingkaran = Aktif + Cuti; MD & Lulus hanya di legenda, tidak dihitung)
    $('#ch-status', el).innerHTML = donutSvg([
      { k: 'Aktif', n: c.Aktif, c: 'var(--st-aktif)', selalu: 1 }, { k: 'Cuti', n: c.Cuti, c: 'var(--st-cuti)', selalu: 1 }
    ], tot, fmtPct(pct(c.Aktif)), 'aktif', 'Status akademik', [
      { k: 'Mengundurkan Diri', n: cl['Mengundurkan Diri'], c: 'var(--st-md)' }, { k: 'Lulus', n: cl.Lulus, c: 'var(--st-lulus)' }
    ]);

    // Tabel rekap (header bertingkat L | P | Total) — klik angka untuk membuka daftarnya
    const prodiBaris = (pf ? [pf] : PRODI_KEYS).map((p) => ({ k: p, label: p }));
    const filterDasar = { status: 'terdaftar' };
    if (pf) filterDasar.prodi = pf;
    // Data Mahasiswa hanya bisa menyaring 1 kelas → bila >1 kelas dicentang, hanya sel berkelas yang bisa diklik
    if (sebagian && dipilih.length === 1) filterDasar.kelas = dipilih[0];
    const drillOk = sebagian && dipilih.length !== 1 ? (f) => !!f.kelas : null;
    // v1.3 — baris tabel Prodi & Kelas dirinci per angkatan: ES 2021, ES 2022, … (baris yang kosong tidak ditampilkan)
    const barisProdiTh = [];
    prodiBaris.forEach((p) => {
      let awal = true;
      tahun.forEach((t) => {
        if (!list.some((m) => m.prodi === p.k && +m.tahun_masuk === t)) return;
        barisProdiTh.push({ k: p.k + ' ' + t, label: p.k + ' ' + t, f: { prodi: p.k, tahun: t }, cls: awal && barisProdiTh.length ? 'xt-sep' : '' });
        awal = false;
      });
    });
    const tabel = [
      xtabModel({
        judul: 'Rekap Mahasiswa per Angkatan dan Program Studi',
        judulBaris: 'Angkatan', list, filter: filterDasar, drillOk, fBaris: 'tahun', fKelompok: 'prodi',
        baris: tahun.map((t) => ({ k: t, label: String(t) })), kunciBaris: (m) => +m.tahun_masuk,
        kelompok: prodiBaris, kunciKelompok: (m) => m.prodi, labelTotalKelompok: 'Total Angkatan', totalKelompok: !pf
      }),
      xtabModel({
        judul: 'Rekap Mahasiswa per Program Studi dan Status',
        judulBaris: 'Program Studi', list, filter: filterDasar, drillOk, fBaris: 'prodi', fKelompok: 'status',
        baris: prodiBaris, kunciBaris: (m) => m.prodi,
        kelompok: [{ k: 'Aktif', label: 'Aktif' }, { k: 'Cuti', label: 'Cuti' }], kunciKelompok: (m) => m.status,
        luar: { list: luar, kelompok: [{ k: 'Mengundurkan Diri', label: 'Mengundurkan Diri' }, { k: 'Lulus', label: 'Lulus' }] }
      }),
      xtabModel({
        judul: 'Rekap Mahasiswa per Program Studi dan Kelas',
        judulBaris: 'Program Studi', list, filter: filterDasar, drillOk, fKelompok: 'kelas',
        baris: barisProdiTh, kunciBaris: (m) => m.prodi + ' ' + (+m.tahun_masuk),
        kelompok: dipilih.map((k) => ({ k, label: k })), kunciKelompok: (m) => m.kelas
      })
    ];
    $('#tb-angkatan', el).innerHTML = xtabHtml(tabel[0]);
    $('#tb-status', el).innerHTML = xtabHtml(tabel[1]);
    $('#tb-kelas', el).innerHTML = xtabHtml(tabel[2]);
    $$('.xt-note', el).forEach((n, i) => { if (i) n.remove(); });     // catatan gender cukup sekali

    // v1.3 — bahan unduhan Excel: angka yang SAMA dengan yang sedang tampil
    this.ekspor = {
      lingkup, prodi: pf, kelas: sebagian ? dipilih : null,
      kpi: [
        { lbl: 'Total Mahasiswa', val: tot, lp: lpAll, cap: 'Aktif + Cuti · ' + lingkup, warna: 'sek' },
        { lbl: 'Mahasiswa Aktif', val: c.Aktif, lp: lpAktif, cap: fmtPct(pct(c.Aktif)) + ' dari total', warna: 'aktif' },
        { lbl: 'Mahasiswa Cuti', val: c.Cuti, cap: fmtPct(pct(c.Cuti)) + ' dari total', warna: 'cuti' },
        { lbl: 'Mengundurkan Diri', val: cl['Mengundurkan Diri'], cap: capLuar, warna: 'md' },
        { lbl: 'Mahasiswa Lulus', val: cl.Lulus, lp: lpLulus, cap: capLuar, warna: 'lulus' }
      ],
      grafik: { perTh, perP, pf, lpAll, tot, c, cl, pctAktif: pct(c.Aktif) },
      tabel
    };

    const akt = S.riwayat.filter((r) => (!pf || r.prodi === pf) && kelasOk(r)).sort((a, b) => b.waktu - a.waktu).slice(0, 5);
    this.tbl.setRows(akt, true);
  }
});

// =====================================================================
// v1.3 — UNDUH EXCEL DASHBOARD
// ExcelJS dimuat HANYA saat tombol diklik (tidak membebani buka/pindah halaman).
// Angka tabel diambil dari model yang SAMA dengan tampilan dashboard → isi Excel identik.
// =====================================================================
function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  return loadScript([
    'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
    'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
  ]).then(() => window.ExcelJS);
}
// Palet terang (Excel selalu berlatar putih, walau aplikasi sedang mode gelap)
const XL = {
  aktif: '#1F8A5B', cuti: '#C9A74D', md: '#C2410C', lulus: '#7C3AED', L: '#2563EB', P: '#E11D48', X: '#4A4F5C',
  ES: '#5B3E96', HES: '#0E8A63', PAI: '#C9A74D', IAT: '#2E6FD8', ink: '#1B1D24', ink2: '#474B57', muted: '#7B7F8C', garis: '#E3E1EC'
};
const isHex6 = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));
/** Campur warna hex dengan dasar (default putih): pct = persen warna asal. */
function campurHex(hex, pct, dasar) {
  const p = (h) => { h = String(h).replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0); };
  const a = p(hex), b = p(dasar || '#FFFFFF');
  return '#' + a.map((v, i) => Math.round(v * pct / 100 + b[i] * (1 - pct / 100)).toString(16).padStart(2, '0')).join('').toUpperCase();
}
const argb = (hex) => 'FF' + String(hex).replace('#', '').toUpperCase();

/** Gambar grafik dashboard ke kanvas (PNG) — tampilan mengikuti kartu grafik di dashboard. */
function gambarGrafikXL(jenis, d, W, H, sek) {
  const k = 2, cv = document.createElement('canvas');
  cv.width = W * k; cv.height = H * k;
  const g = cv.getContext('2d');
  g.scale(k, k);
  const font = (w, s) => w + ' ' + s + 'px "Public Sans", "Segoe UI", Arial, sans-serif';
  const kotak = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
  kotak(0.5, 0.5, W - 1, H - 1, 12); g.strokeStyle = XL.garis; g.lineWidth = 1; g.stroke();
  g.fillStyle = XL.ink; g.font = font(700, 14); g.textBaseline = 'top'; g.textAlign = 'left';
  // judul dibungkus ke 2 baris bila tidak muat
  const kata = d.judul.split(' '), bar = [''];
  kata.forEach((w) => { const coba = (bar[bar.length - 1] + ' ' + w).trim(); if (g.measureText(coba).width > W - 32 && bar[bar.length - 1]) bar.push(w); else bar[bar.length - 1] = coba; });
  bar.slice(0, 2).forEach((t, i) => g.fillText(t, 16, 14 + i * 18));
  if (jenis === 'batang') {
    const data = d.data, x0 = 18, x1 = W - 18, yb = H - 34, yt = bar.length > 1 ? 80 : 66;
    if (!data.length) { g.fillStyle = XL.muted; g.font = font(500, 12); g.fillText('Belum ada data.', 16, 60); return cv.toDataURL('image/png'); }
    const maks = Math.max(1, ...data.map((x) => x.n)), slot = (x1 - x0) / data.length, bw = Math.min(42, slot * 0.62);
    g.strokeStyle = XL.garis; g.beginPath(); g.moveTo(x0, yb + 0.5); g.lineTo(x1, yb + 0.5); g.stroke();
    data.forEach((x, i) => {
      const cx = x0 + slot * i + slot / 2, h = Math.max(x.n ? 2 : 0, (x.n / maks) * (yb - yt)), bx = cx - bw / 2, by = yb - h;
      g.globalAlpha = x.redup ? 0.32 : 1;
      g.fillStyle = x.c;
      if (h > 0) { const r = Math.min(4, h, bw / 2); g.beginPath(); g.moveTo(bx, yb); g.lineTo(bx, by + r); g.arcTo(bx, by, bx + r, by, r); g.lineTo(bx + bw - r, by); g.arcTo(bx + bw, by, bx + bw, by + r, r); g.lineTo(bx + bw, yb); g.closePath(); g.fill(); }
      g.globalAlpha = 1;
      g.fillStyle = XL.ink; g.font = font(700, 12); g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(fmtNum(x.n), cx, by - 4);
      g.fillStyle = XL.ink2; g.font = font(500, 12); g.textBaseline = 'top'; g.fillText(x.label, cx, yb + 8);
    });
  } else {
    const seg = d.seg.filter((s) => s.n > 0), tot = d.total, cx = W / 2, cy = 52 + 60, R = 52, tb = 20;
    g.lineWidth = tb; g.strokeStyle = '#ECEAF3'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    let a = -Math.PI / 2;
    seg.forEach((s) => {
      const sudut = tot ? (s.n / tot) * Math.PI * 2 : 0, celah = seg.length > 1 ? Math.min(0.03, sudut / 3) : 0;
      g.strokeStyle = s.c; g.beginPath(); g.arc(cx, cy, R, a + celah / 2, a + sudut - celah / 2); g.stroke(); a += sudut;
    });
    g.fillStyle = XL.ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.font = font(800, 18); g.fillText(d.atas, cx, cy + 4);
    g.fillStyle = XL.ink2; g.font = font(500, 10); g.fillText(d.bawah, cx, cy + 19);
    let y = cy + R + tb / 2 + 16;
    const baris = (s, pctTeks, redup) => {
      g.globalAlpha = redup ? 0.85 : 1;
      g.fillStyle = s.c; g.beginPath(); g.arc(22, y + 6, 4, 0, Math.PI * 2); g.fill();
      g.textBaseline = 'top'; g.textAlign = 'left'; g.font = font(500, 12); g.fillStyle = redup ? XL.muted : XL.ink2; g.fillText(s.k, 32, y);
      g.textAlign = 'right'; g.font = font(700, 12); g.fillStyle = redup ? XL.muted : XL.ink; g.fillText(fmtNum(s.n), W - 64, y);
      g.font = font(500, 12); g.fillStyle = XL.muted; g.fillText(pctTeks, W - 16, y);
      g.globalAlpha = 1; y += 18;
    };
    d.seg.filter((s) => s.n > 0 || s.selalu).forEach((s) => baris(s, fmtPct(tot ? (s.n / tot) * 100 : 0)));
    if (d.luar && d.luar.length) {
      y += 2; g.strokeStyle = XL.garis; g.lineWidth = 1; g.beginPath(); g.moveTo(16, y - 3); g.lineTo(W - 16, y - 3); g.stroke();
      g.fillStyle = XL.muted; g.font = font(600, 10); g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('TIDAK DIHITUNG DALAM TOTAL', 16, y + 1); y += 16;
      d.luar.forEach((s) => baris(s, '', true));
    }
  }
  return cv.toDataURL('image/png');
}

/** Bagi kolom (lebar karakter) menjadi n rentang bersebelahan yang lebarnya hampir sama → [[awal, akhir], …] (1-based) */
function bagiKolomXL(lebar, n) {
  const total = lebar.reduce((a, b) => a + b, 0), out = [];
  let mulai = 1, kum = 0;
  for (let i = 1; i <= lebar.length; i++) {
    kum += lebar[i - 1];
    const target = (total * (out.length + 1)) / n, sisaKol = lebar.length - i, sisaKartu = n - out.length - 1;
    if (out.length < n - 1 && (kum >= target - lebar[i - 1] / 2 || sisaKol === sisaKartu)) { out.push([mulai, i]); mulai = i + 1; }
  }
  out.push([mulai, lebar.length]);
  return out;
}

async function unduhExcelDashboard(btn, D) {
  if (!D) { toast('Dashboard belum siap.', 'err'); return; }
  setBusy(btn, true, 'Menyiapkan Excel…');
  try {
    const ExcelJS = await loadExcelJS();
    const tema = (S.setelan && S.setelan.tema) || {};
    const primer = isHex6(tema.primer) ? tema.primer : '#1E3A5F', sek = isHex6(tema.sekunder) ? tema.sekunder : '#5B3E96';
    const institusi = (S.setelan && S.setelan.institusi) || Store.get('institusi') || 'STIS Al Wafa';
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Rekap Mahasiswa ' + institusi; wb.created = new Date();
    const ws = wb.addWorksheet('Dashboard', {
      views: [{ showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
    });
    const nKol = Math.max(16, ...D.tabel.map((t) => 1 + t.grup.length * 3));
    const lebar = [17].concat(Array(nKol - 1).fill(7.4));
    ws.columns = lebar.map((w) => ({ width: w }));
    const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } });
    const garis = (hex, st) => ({ style: st || 'thin', color: { argb: argb(hex) } });
    const sel = (r, c, v, st) => {
      const x = ws.getCell(r, c); if (v !== undefined) x.value = v;
      if (st) Object.keys(st).forEach((k) => { if (st[k] !== undefined) x[k] = k === 'font' ? Object.assign({ name: 'Calibri', family: 2 }, st[k]) : st[k]; });
      return x;
    };
    const gabung = (r1, c1, r2, c2, v, st) => { if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2); return sel(r1, c1, v, st); };
    const bingkai = (r1, c1, r2, c2, hex) => { for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) ws.getCell(r, c).border = { top: garis(hex), left: garis(hex), bottom: garis(hex), right: garis(hex) }; };
    const waktu = new Date();
    const tglTeks = waktu.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + pad(waktu.getHours(), 2) + '.' + pad(waktu.getMinutes(), 2);

    // ---- Judul
    let r = 1;
    gabung(r, 1, r, nKol, 'REKAP DATA MAHASISWA ' + institusi.toUpperCase(), { font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }, fill: fill(primer), alignment: { vertical: 'middle', indent: 1 } });
    ws.getRow(r).height = 30; r++;
    gabung(r, 1, r, nKol, 'Dashboard · Data Mahasiswa ' + semesterLabel(), { font: { size: 11, color: { argb: 'FFFFFFFF' } }, fill: fill(campurHex(primer, 82)), alignment: { vertical: 'middle', indent: 1 } });
    ws.getRow(r).height = 20; r++;
    const filterTeks = 'Prodi: ' + (D.prodi ? PRODI[D.prodi] + ' (' + D.prodi + ')' : 'Semua') + '   ·   Kelas: ' + (D.kelas ? (D.kelas.length ? D.kelas.join(', ') : 'tidak ada') : 'Semua');
    gabung(r, 1, r, nKol, filterTeks + '   ·   Diunduh ' + tglTeks + (S.me && S.me.nama ? ' oleh ' + S.me.nama : ''), { font: { size: 9.5, color: { argb: argb(XL.ink2) } }, alignment: { vertical: 'middle', indent: 1 } });
    ws.getRow(r).height = 18; r++;
    gabung(r, 1, r, nKol, 'Total Mahasiswa = mahasiswa terdaftar (Aktif + Cuti). Mengundurkan Diri dan Lulus ditampilkan sebagai informasi dan tidak dihitung dalam total.', { font: { size: 9.5, italic: true, color: { argb: argb(XL.muted) } }, alignment: { vertical: 'middle', indent: 1 } });
    ws.getRow(r).height = 16; r += 2;

    // ---- Kartu ringkasan (5 kartu)
    const wKartu = { sek, aktif: XL.aktif, cuti: XL.cuti, md: XL.md, lulus: XL.lulus };
    const rk = r;
    bagiKolomXL(lebar, D.kpi.length).forEach(([c1, c2], i) => {
      const k = D.kpi[i], w = wKartu[k.warna] || sek, bg = campurHex(w, 7);
      const st = (extra) => Object.assign({ fill: fill(bg), alignment: { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true } }, extra);
      gabung(rk, c1, rk, c2, k.lbl.toUpperCase(), st({ font: { bold: true, size: 9, color: { argb: argb(XL.ink2) } } }));
      gabung(rk + 1, c1, rk + 1, c2, k.val, st({ font: { bold: true, size: 22, color: { argb: argb(XL.ink) } }, numFmt: '#,##0' }));
      gabung(rk + 2, c1, rk + 2, c2, k.lp ? 'L ' + fmtNum(k.lp.L) + '  ·  P ' + fmtNum(k.lp.P) + (k.lp.X ? '  ·  belum diisi ' + fmtNum(k.lp.X) : '') : '', st({ font: { size: 10, color: { argb: argb(XL.ink2) } } }));
      gabung(rk + 3, c1, rk + 3, c2, k.cap, st({ font: { size: 9, color: { argb: argb(XL.muted) } } }));
      for (let rr = rk; rr <= rk + 3; rr++) for (let cc = c1; cc <= c2; cc++) {
        const b = {};
        if (rr === rk) b.top = garis(w, 'thick');
        if (rr === rk + 3) b.bottom = garis(XL.garis);
        if (cc === c1) b.left = garis('#FFFFFF', 'medium');
        if (cc === c2) b.right = garis('#FFFFFF', 'medium');
        ws.getCell(rr, cc).border = b;
      }
    });
    ws.getRow(rk).height = 20; ws.getRow(rk + 1).height = 34; ws.getRow(rk + 2).height = 18; ws.getRow(rk + 3).height = 18;
    r = rk + 5;

    // ---- Grafik (gambar)
    const G = D.grafik, tinggi = 310;
    const grafik = [
      ['batang', { judul: 'Jumlah Mahasiswa per Angkatan', data: G.perTh.map(([t, n]) => ({ label: String(t), n, c: sek })) }],
      ['batang', { judul: 'Jumlah Mahasiswa per Program Studi', data: G.perP.map(([p, n]) => ({ label: p, n, c: XL[p] || sek, redup: G.pf && G.pf !== p })) }],
      ['donat', { judul: 'Komposisi Gender', total: G.tot, atas: fmtNum(G.tot), bawah: 'mahasiswa',
        seg: [{ k: 'Laki-laki', n: G.lpAll.L, c: XL.L, selalu: 1 }, { k: 'Perempuan', n: G.lpAll.P, c: XL.P, selalu: 1 }, { k: 'Belum diisi', n: G.lpAll.X, c: XL.X }] }],
      ['donat', { judul: 'Status Akademik', total: G.tot, atas: fmtPct(G.pctAktif), bawah: 'aktif',
        seg: [{ k: 'Aktif', n: G.c.Aktif, c: XL.aktif, selalu: 1 }, { k: 'Cuti', n: G.c.Cuti, c: XL.cuti, selalu: 1 }],
        luar: [{ k: 'Mengundurkan Diri', n: G.cl['Mengundurkan Diri'], c: XL.md }, { k: 'Lulus', n: G.cl.Lulus, c: XL.lulus }] }]
    ];
    const px = (w) => Math.round(w * 6.6 + 4);       // perkiraan aman lebar kolom → piksel (hindari gambar bertumpuk)
    bagiKolomXL(lebar, 4).forEach(([c1, c2], i) => {
      let w = 0; for (let c = c1; c <= c2; c++) w += px(lebar[c - 1]);
      w -= 14;
      const id = wb.addImage({ base64: gambarGrafikXL(grafik[i][0], grafik[i][1], w, tinggi, sek), extension: 'png' });
      ws.addImage(id, { tl: { col: c1 - 1, row: r - 1 }, ext: { width: w, height: tinggi }, editAs: 'oneCell' });
    });
    const barisGrafik = Math.ceil(tinggi / 20) + 1;
    for (let i = 0; i < barisGrafik; i++) ws.getRow(r + i).height = 15;
    r += barisGrafik + 1;

    // ---- Tabel rekap (header bertingkat, L | P | Total, baris Total) — sama persis dengan dashboard
    const tint = (pct) => campurHex(sek, pct);
    const abu = '#F3F3F6';
    let catatanGender = false;
    D.tabel.forEach((md) => {
      const nC = 1 + md.grup.length * 3, h1 = r + 1, h2 = r + 2;
      gabung(r, 1, r, nC, md.judul, { font: { bold: true, size: 12.5, color: { argb: argb(XL.ink) } }, alignment: { vertical: 'middle' } });
      ws.getRow(r).height = 22;
      gabung(h1, 1, h2, 1, md.judulBaris, { font: { bold: true, size: 10, color: { argb: argb(XL.ink) } }, fill: fill(tint(12)), alignment: { vertical: 'middle', horizontal: 'left', indent: 1 } });
      md.grup.forEach((g, i) => {
        const c0 = 2 + i * 3, luar = g.jenis === 'luar', tot = g.jenis === 'total';
        gabung(h1, c0, h1, c0 + 2, g.label + (luar ? ' (tidak dihitung)' : ''), {
          font: { bold: true, size: 10, color: { argb: argb(luar ? XL.muted : XL.ink) } }, fill: fill(luar ? abu : tint(tot ? 18 : 12)),
          alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
        });
        ['L', 'P', 'Total'].forEach((t, j) => sel(h2, c0 + j, t, {
          font: { bold: true, size: 9.5, color: { argb: argb(luar ? XL.muted : XL.ink2) } }, fill: fill(luar ? abu : tot ? tint(18) : tint(7)),
          alignment: { vertical: 'middle', horizontal: 'center' }
        }));
      });
      ws.getRow(h1).height = md.grup.some((g) => g.jenis === 'luar') ? 28 : 20; ws.getRow(h2).height = 18;
      let rr = h2 + 1;
      const tulisBaris = (row, akhir) => {
        sel(rr, 1, row.label, { font: { bold: true, size: 10, color: { argb: argb(XL.ink) } }, alignment: { vertical: 'middle', horizontal: 'left', indent: 1 }, fill: akhir ? fill(tint(10)) : undefined });
        row.cells.forEach((x, i) => {
          const g = md.grup[i], luar = g.jenis === 'luar';
          [x.L, x.P, x.T].forEach((n, j) => sel(rr, 2 + i * 3 + j, n, {
            numFmt: '#,##0', alignment: { vertical: 'middle', horizontal: 'center' },
            font: { size: 10, bold: j === 2 || akhir, color: { argb: argb(!n ? '#B4B7C2' : luar ? XL.muted : XL.ink) } },
            fill: akhir ? fill(tint(10)) : luar ? fill('#FAFAFB') : undefined
          }));
        });
        ws.getRow(rr).height = 18;
        rr++;
      };
      const sepRows = [];
      md.rows.forEach((row) => { if (row.cls === 'xt-sep') sepRows.push(rr); tulisBaris(row, false); });
      tulisBaris(md.total, true);
      // garis: tipis antarbaris, tebal pemisah kelompok, bingkai luar
      for (let a = h1; a < rr; a++) for (let c = 1; c <= nC; c++) {
        const x = ws.getCell(a, c), awalGrup = c > 1 && (c - 2) % 3 === 0, gi = Math.floor((c - 2) / 3), g = md.grup[gi];
        const b = {
          top: a === h1 ? garis('#CFCBDD') : sepRows.includes(a) ? garis('#BDB8CF', 'medium') : a === rr - 1 ? garis('#CFCBDD') : garis('#ECEAF2'),
          bottom: a === rr - 1 ? garis('#CFCBDD') : garis('#ECEAF2'),
          left: c === 1 ? garis('#CFCBDD') : awalGrup ? garis(g && g.pertama ? '#BDB8CF' : '#DAD7E5', g && g.pertama ? 'medium' : 'thin') : garis('#F1F0F5')
        };
        if (c === nC) b.right = garis('#CFCBDD'); else if (c === 1) b.right = garis('#DAD7E5');
        x.border = b;
      }
      r = rr;
      if (md.tanpaGender && !catatanGender) {
        catatanGender = true;
        gabung(r, 1, r, nC, 'Total memuat ' + fmtNum(md.tanpaGender) + ' mahasiswa yang jenis kelaminnya belum diisi (tidak masuk kolom L/P).', { font: { size: 9, italic: true, color: { argb: argb(XL.muted) } } });
        r++;
      }
      r += 2;
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Dashboard_Rekap_Mahasiswa_' + stampFile() + (D.prodi ? '_' + D.prodi : '') + (D.kelas ? '_' + (D.kelas.length ? D.kelas.map((k) => KELAS_PENDEK[k]).join('-') : 'tanpa-kelas') : '') + '.xlsx';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('Excel dashboard diunduh (sesuai filter yang tampil).');
  } catch (e) {
    toast(e.message || String(e), 'err', 'Gagal membuat Excel');
  } finally { setBusy(btn, false); }
}

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
    return S.mhs.filter((m) => (!f.prodi || m.prodi === f.prodi) && (!f.kelas || m.kelas === f.kelas) &&
      (!f.status || (f.status === 'terdaftar' ? isTerdaftar(m) : m.status === f.status)) &&
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
    const warnaS = (s) => s === 'Cuti' ? 'var(--st-cuti)' : s === 'Mengundurkan Diri' ? 'var(--st-md)' : s === 'Lulus' ? 'var(--st-lulus)' : 'var(--st-aktif)';
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
        ${m.status === 'Lulus' ? `<dt>Tanggal Wisuda</dt><dd>${fmtTgl(m.tanggal_status)}</dd>` : ''}
        ${JENIS[m.status] ? `<dt>Tanggal Status</dt><dd>${fmtTgl(m.tanggal_status)}</dd><dt>Nomor Surat</dt><dd class="mono">${esc(m.nomor_surat || '—')}</dd>
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
      if (['f-tgl'].includes(e.target.id)) { self.updatePreview(); const er = $('[data-err="tgl"]', el); if (er) er.textContent = ''; e.target.classList.remove('invalid'); }
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
    $('[data-status-sub]', el).textContent = m ? 'Status saat ini: ' + m.status + '. Mengubah ke Cuti / Mengundurkan Diri akan menerbitkan nomor surat otomatis; Lulus cukup tanggal wisuda.' : 'Tentukan status awal keaktifan mahasiswa.';
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
    if (s === 'Lulus') {
      // v1.2 — Lulus: cukup tanggal wisuda (tanpa nomor surat & tanpa berkas). Bisa dikoreksi walau status tetap Lulus.
      const cur = this.form.querySelector('#f-tgl');
      const tw = (cur && cur.dataset.st === 'Lulus' ? cur.value : '') || (o && o.status === 'Lulus' ? o.tanggal_status : '') || '';
      h += `<div class="form-grid"><div class="field"><label for="f-tgl">Tanggal Wisuda<span class="req">*</span></label>
            <input class="input" type="date" id="f-tgl" data-st="Lulus" value="${esc(tw)}"><span class="hint">Tidak menerbitkan nomor surat dan tidak perlu unggah berkas.</span><span class="err" data-err="tgl"></span></div></div>`;
    } else if (this.berubah()) {
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
    if (this.status === 'Lulus' && !(($('#f-tgl', this.el) || {}).value)) err.tgl = 'Tanggal wisuda wajib diisi.';
    if (this.upload && this.upload.state === 'error') err.berkas = 'Unggahan gagal: ' + this.upload.err + ' — pilih ulang berkas.';
    Object.keys(err).forEach((k) => { const e = $('[data-err="' + k + '"]', this.el); if (e) e.textContent = err[k]; const i = k === 'tgl' ? $('#f-tgl', this.el) : this.form[k]; if (i && i.classList) i.classList.add('invalid'); });
    if (!err.nim && !this.cekNim()) err.nim = 'dup';
    const first = Object.keys(err)[0];
    if (first) { const i = (first === 'tgl' ? $('#f-tgl', this.el) : this.form[first]) || $('[data-err="' + first + '"]', this.el); if (i && i.scrollIntoView) i.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (i && i.focus) i.focus({ preventScroll: true }); }
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
        tanggal_status: this.status === 'Lulus' ? (($('#f-tgl', this.el) || {}).value || '') : this.berubah() ? (($('#f-tgl', this.el) || {}).value || todayStr()) : '',
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
    <div class="page-head"><div><h1>Riwayat Status</h1><p>Seluruh mutasi status mahasiswa: cuti, mengundurkan diri, lulus, dan aktif kembali.</p></div></div>
    <div class="card"><div class="filters">
      <label class="search">${ic('search')}<input class="input" data-f="q" placeholder="Cari nama / NIM / nomor surat…"></label>
      <select class="input" data-f="jenis"><option value="">Semua Perubahan</option><option value="Cuti">Cuti</option><option value="Mengundurkan Diri">Mengundurkan Diri</option><option value="Lulus">Lulus</option><option value="Aktif">Aktif Kembali</option></select>
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
