/* =====================================================================
   HALAMAN PENGATURAN — Penomoran, Tampilan, Akun Pengguna,
   Impor Excel, Migrasi Database (khusus Admin)
   ===================================================================== */
'use strict';

const FORMAT_DEF = { CUTI: '{NO}.C/{KODE_PRODI}/STIS-AL-WAFA/{BULAN_ROMAWI}/{TAHUN}', MUNDUR: '{NO}/MR.ADMK/STIS-AL-WAFA/{BULAN_ROMAWI}/{TAHUN}' };

/** v1.1 — Counter efektif TAHUN INI, aturan yang sama dengan server: reset tahunan aktif + counter tercatat tahun lalu → 0. */
function ctrEfektif(key, jenis) {
  const c = S.nomor[key] || {}, base = S.nomor[jenis] || {};
  const n = +c.nomor_terakhir || 0, th = +c.tahun_terakhir || 0, y = +todayStr().slice(0, 4);
  const direset = !!(base.reset_tahunan && th && y > th && n > 0);
  return { n: direset ? 0 : n, asli: n, th, direset };
}

// =====================================================================
// PENGATURAN PENOMORAN SURAT
// =====================================================================
registerPage('penomoran', {
  admin: true, crumb: ['Pengaturan', 'Penomoran Surat'],
  template: () => `
    <div class="hero"><div class="deco">123</div>
      <div class="hero-row"><div class="eyebrow">${ic('settings')} Pengaturan Sistem</div>
        <button class="btn btn-primary hero-save" data-act="simpan">${ic('save')} Simpan Perubahan</button></div>
      <h1>Konfigurasi Penomoran Surat</h1>
      <p>Kelola format penomoran otomatis untuk Surat Cuti Akademik dan Surat Pengunduran Diri Mahasiswa. Pastikan struktur nomor urut dan variabel penomoran sesuai dengan standar tata naskah dinas akademik.</p>
    </div>
    <div class="grid g2 split">
      ${['CUTI', 'MUNDUR'].map((j) => `
      <div class="card card-pad" data-jenis="${j}">
        <div class="card-head" style="margin-bottom:24px">
          <div style="display:flex;gap:16px;align-items:center"><div class="icon-tile tint">${ic(j === 'CUTI' ? 'calendar-x' : 'user-minus')}</div>
            <div><h3 class="card-title" style="font-size:21px">${j === 'CUTI' ? 'Surat Cuti Akademik' : 'Surat Mengundurkan Diri'}</h3><p class="section-sub">${j === 'CUTI' ? 'Format penomoran otomatis per prodi' : 'Format penomoran administratif umum'}</p></div></div>
          <span class="pill gold">Aktif</span>
        </div>
        <div class="grid g2" style="gap:16px">
          <div class="counter-box"><label class="lbl-f" for="n-${j}-ctr">Counter Terakhir</label><input class="input" id="n-${j}-ctr" data-k="ctr" type="number" min="0" max="99999" inputmode="numeric"><span class="hint" data-ctr-hint>Nomor berikutnya = counter + 1</span></div>
          <div class="counter-box"><label class="lbl-f" for="n-${j}-dg">Jumlah Digit</label><select class="input" id="n-${j}-dg" data-k="digit">${[2, 3, 4, 5, 6].map((d) => `<option value="${d}">${d} (${pad(7, d)})</option>`).join('')}</select></div>
        </div>
        ${j === 'CUTI' ? `<div class="field mt-s"><label class="lbl-f" for="n-mode">Mode counter cuti</label>
          <select class="input" id="n-mode" data-k="mode"><option value="BERSAMA">Satu counter bersama untuk semua prodi (default PRD)</option><option value="PER_PRODI">Counter terpisah per prodi</option></select></div>
          <div class="grid g4 mt-s" data-perprodi style="gap:10px">${Object.keys(PRODI).map((p) => `<div class="counter-box" style="padding:12px"><label class="lbl-f" for="n-pp-${p}" style="font-size:13px">Counter ${p}</label><input class="input" id="n-pp-${p}" data-pp="${p}" type="number" min="0" inputmode="numeric" style="font-size:16px"></div>`).join('')}</div>` : ''}
        <label class="switch mt-s" style="margin-top:16px"><input type="checkbox" data-k="reset"><span class="tr"></span><span>Mulai dari 001 otomatis setiap tahun baru</span></label>
        <div class="mini">Nomor Surat Berikutnya <span class="pill gold" data-belum hidden>belum disimpan</span></div>
        <div class="nomor-preview" data-prev></div>
        <details class="mt-s"><summary class="btn-link" style="cursor:pointer">${ic('pencil')} Ubah format nomor</summary>
          <div class="field mt-s"><input class="input mono" data-k="format" spellcheck="false"><span class="hint">Variabel: <code>{NO}</code> nomor urut (wajib), <code>{KODE_PRODI}</code>, <code>{BULAN_ROMAWI}</code>, <code>{BULAN}</code>, <code>{TAHUN}</code>.</span></div>
        </details>
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;border-top:1px solid var(--line);margin-top:22px;padding-top:18px">
          <button class="btn-link danger" data-act="reset-counter" data-j="${j}">${ic('rotate-ccw')} Reset Counter</button>
          <span class="muted" style="font-size:14.5px" data-upd></span>
        </div>
      </div>`).join('')}
    </div>
    <div class="callout navy mt"><div class="icon-tile navy">${ic('lock')}</div><div>
      <h4>Catatan Sistem &amp; Pencegahan Nomor Ganda (LockService)</h4>
      <p>Sistem menggunakan protokol <code>LockService</code> Google Apps Script untuk melakukan antrean tulis pada database spreadsheet rekapitulasi. Hal ini mencegah terjadinya bentrok nomor surat ganda (duplikat) apabila terdapat dua admin yang menerbitkan surat secara bersamaan dalam detik yang sama. Nomor yang pernah terbit juga otomatis dilewati bila counter diturunkan manual.</p>
    </div></div>
    <div class="card table-card mt">
      <div class="card-pad" style="padding-bottom:18px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-end">
        <div><h2 class="section">Riwayat Perubahan Penomoran</h2><p class="section-sub">Log aktivitas perubahan format, reset, dan set manual counter surat</p></div>
        <button class="btn-link" data-act="ekspor-log">${ic('download')} Ekspor Log</button>
      </div>
      <div data-log></div>
    </div>
    <div class="save-bar" data-savebar>
      <span class="grow" data-save-status></span>
      <button class="btn btn-ghost" data-act="default">Kembali ke Default</button>
      <button class="btn btn-navy" data-act="simpan">${ic('save')} Simpan Perubahan</button>
    </div>`,
  mount(el) {
    const self = this;
    this.el = el;
    this.tbl = new Tabel($('[data-log]', el), {
      id: 'lognomor', pageSize: 10, empty: 'Belum ada perubahan penomoran.',
      cols: [
        { key: 'waktu', label: 'Waktu (WIB)', cls: 'nowrap', render: (r) => '<span class="mono">' + fmtWaktu(r.waktu) + '</span>' },
        { key: 'pengguna', label: 'Administrator', cls: 'nama', m: 'main' },
        { key: 'jenis', label: 'Jenis Surat', render: (r) => r._jenis },
        { key: 'detail', label: 'Aksi / Perubahan', m: 'wide', render: (r) => esc(r._aksi) },
        { key: 'ctr', label: 'Counter Baru', render: (r) => '<b class="mono" style="color:var(--sek-ink)">' + esc(r._ctr) + '</b>' }
      ]
    });
    el.addEventListener('input', () => self.preview(el));
    el.addEventListener('change', (e) => { if (e.target.id === 'n-mode') self.togglePP(el); self.preview(el); });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'simpan') self.simpan(el, b);
      if (b.dataset.act === 'default') self.isiDefault(el);
      if (b.dataset.act === 'reset-counter') self.resetCounter(b.dataset.j, b);
      if (b.dataset.act === 'ekspor-log') {
        exportXlsx('Log_Penomoran_' + stampFile() + '.xlsx', 'Log Penomoran', ['Waktu', 'Administrator', 'Jenis', 'Aksi', 'Counter'],
          this.logRows().map((r) => [fmtWaktu(r.waktu), r.pengguna, r._jenisTxt, r._aksi, r._ctr]), [20, 18, 16, 70, 10]).catch((x) => toast(x.message, 'err'));
      }
    });
  },
  // Input yang belum disimpan TIDAK ditimpa saat kembali ke halaman / data diperbarui
  show(el) { if (!el._filled || !this.isDirty()) this.isi(el); else this.tbl.setRows(this.logRows(), false); },
  onData(el) { if (!this.isDirty()) this.isi(el); else this.tbl.setRows(this.logRows(), false); },
  /** Nilai tersimpan di server, dalam bentuk yang sama dengan baca() */
  nilaiAsli() {
    const out = {};
    ['CUTI', 'MUNDUR'].forEach((j) => {
      const n = S.nomor[j] || {};
      out[j] = { nomor_terakhir: String(ctrEfektif(j, j).n), digit: n.digit || 3, format: (n.format || FORMAT_DEF[j]).trim(), reset_tahunan: !!n.reset_tahunan };
      if (j === 'CUTI') {
        out.CUTI.mode = n.mode === 'PER_PRODI' ? 'PER_PRODI' : 'BERSAMA';
        out.CUTI.per_prodi = {};
        Object.keys(PRODI).forEach((p) => { out.CUTI.per_prodi[p] = String(ctrEfektif('CUTI_' + p, 'CUTI').n); });
      }
    });
    return out;
  },
  isDirty() {
    if (!this.el || !this.el._filled) return false;
    const norm = (v) => JSON.stringify(v, (k, x) => (typeof x === 'number' ? String(x) : (typeof x === 'string' ? x.trim().replace(/^0+(?=\d)/, '') : x)));
    return norm(this.baca(this.el)) !== norm(this.nilaiAsli());
  },
  beforeLeave() {
    return new Promise((resolve) => {
      let selesai = false;
      const m = modal({
        title: 'Perubahan penomoran belum disimpan',
        body: '<p style="margin:0;color:var(--ink-2);line-height:1.6">Counter/format yang Anda ubah <b>belum tersimpan</b>, sehingga nomor surat berikutnya masih memakai pengaturan lama. Simpan sekarang?</p>',
        foot: '<button class="btn btn-ghost" data-tetap>Tetap di sini</button><button class="btn btn-soft" data-buang>Buang perubahan</button><button class="btn btn-primary" data-simpan-lanjut>' + ic('save') + ' Simpan &amp; lanjut</button>',
        onClose: () => { if (!selesai) resolve(false); }
      });
      $('[data-tetap]', m.el).onclick = () => m.close();
      $('[data-buang]', m.el).onclick = () => { selesai = true; m.close(); this.isi(this.el); resolve(true); };
      $('[data-simpan-lanjut]', m.el).onclick = async (e) => {
        const ok = await this.simpan(this.el, e.currentTarget);
        if (ok) { selesai = true; m.close(); resolve(true); }
      };
    });
  },
  isi(el) {
    el._filled = 1;
    ['CUTI', 'MUNDUR'].forEach((j) => {
      const n = S.nomor[j] || {}, card = $('[data-jenis="' + j + '"]', el);
      $('[data-k="ctr"]', card).value = ctrEfektif(j, j).n;
      $('[data-k="digit"]', card).value = n.digit || 3;
      $('[data-k="format"]', card).value = n.format || FORMAT_DEF[j];
      $('[data-k="reset"]', card).checked = !!n.reset_tahunan;
      $('[data-upd]', card).textContent = 'Update terakhir: ' + (n.diubah_pada ? fmtTgl(new Date(n.diubah_pada).toISOString().slice(0, 10)) + (n.diubah_oleh ? ' · ' + n.diubah_oleh : '') : '—');
      if (j === 'CUTI') {
        $('#n-mode', el).value = n.mode === 'PER_PRODI' ? 'PER_PRODI' : 'BERSAMA';
        Object.keys(PRODI).forEach((p) => { $('#n-pp-' + p, el).value = ctrEfektif('CUTI_' + p, 'CUTI').n; });
      }
    });
    this.togglePP(el); this.preview(el);
    this.tbl.setRows(this.logRows(), true);
  },
  logRows() {
    return (S.logNomor || []).map((r) => {
      let jenis = 'Umum', aksi = r.detail, ctr = '—', jt = 'Umum';
      if (r.aksi === 'TERBIT_SURAT') {
        const p = r.detail.split('|'); jenis = p[0]; aksi = 'Penerbitan surat baru (Auto Increment) · ' + (p[3] || ''); ctr = pad(p[2] || 0, (S.nomor[p[0]] || {}).digit || 3);
      } else if (r.aksi === 'RESET_COUNTER') {
        jenis = r.target === 'MUNDUR' ? 'MUNDUR' : 'CUTI'; aksi = 'Reset counter manual'; ctr = pad(0, (S.nomor[jenis] || {}).digit || 3);
      } else {
        const c = /Cuti/.test(r.detail), m = /Mengundurkan|MUNDUR/.test(r.detail);
        jenis = c && !m ? 'CUTI' : m && !c ? 'MUNDUR' : 'Umum';
        const mm = r.detail.match(/nomor terakhir: \S+ → (\d+)/) || r.detail.match(/→(\d+)/);
        if (mm) ctr = pad(mm[1], (S.nomor[jenis] || S.nomor.CUTI || {}).digit || 3);
        aksi = r.detail.length > 140 ? r.detail.slice(0, 140) + '…' : r.detail;
      }
      jt = jenis === 'CUTI' ? 'Surat Cuti' : jenis === 'MUNDUR' ? 'Surat Mundur' : 'Umum';
      const tag = '<span class="tag ' + (jenis === 'CUTI' ? 'cuti' : jenis === 'MUNDUR' ? 'mundur' : 'reset') + '">' + jt + '</span>';
      return Object.assign({}, r, { _jenis: tag, _jenisTxt: jt, _aksi: aksi, _ctr: ctr });
    });
  },
  togglePP(el) {
    const per = $('#n-mode', el).value === 'PER_PRODI', pp = $('[data-perprodi]', el);
    if (pp) pp.hidden = !per;
    // Mode per prodi: counter utama cuti tidak dipakai → nonaktifkan agar tidak membingungkan
    $('#n-CUTI-ctr', el).disabled = per;   // keterangan di bawah counter diisi oleh preview()
  },
  baca(el) {
    const out = {};
    ['CUTI', 'MUNDUR'].forEach((j) => {
      const card = $('[data-jenis="' + j + '"]', el);
      out[j] = { nomor_terakhir: $('[data-k="ctr"]', card).value, digit: +$('[data-k="digit"]', card).value, format: $('[data-k="format"]', card).value.trim(), reset_tahunan: $('[data-k="reset"]', card).checked };
      if (j === 'CUTI') {
        out.CUTI.mode = $('#n-mode', el).value;
        out.CUTI.per_prodi = {};
        Object.keys(PRODI).forEach((p) => { out.CUTI.per_prodi[p] = $('#n-pp-' + p, el).value; });
      }
    });
    return out;
  },
  preview(el) {
    const v = this.baca(el), now = todayStr(), kotor = this.isDirty();
    $$('[data-belum]', el).forEach((x) => { x.hidden = !kotor; });
    const st = $('[data-save-status]', el), bar = $('[data-savebar]', el);
    bar.classList.toggle('kotor', kotor);
    st.innerHTML = kotor ? '<span class="dot" style="background:var(--warn-ink)"></span> Ada perubahan yang <b>belum disimpan</b>' : '<span class="dot" style="background:var(--ok-ink)"></span> Semua pengaturan sudah tersimpan';
    // Sama persis dengan yang akan terbit setelah disimpan: counter yang tidak diubah + reset tahunan dicentang
    // + counter tercatat tahun lalu → mulai lagi dari 001. Counter yang diubah/disimpan berlaku untuk tahun ini.
    const y = +now.slice(0, 4);
    const lanjut = (key, jenis, val, resetLive) => {
      const e = ctrEfektif(key, jenis), n = +val || 0;
      return n === e.n && e.n === e.asli && resetLive && e.th && y > e.th ? 0 : n;
    };
    ['CUTI', 'MUNDUR'].forEach((j) => {
      const c = v[j], per = j === 'CUTI' && c.mode === 'PER_PRODI';
      const ctr = per ? Math.max(...Object.keys(c.per_prodi).map((p) => lanjut('CUTI_' + p, 'CUTI', c.per_prodi[p], c.reset_tahunan)))
        : lanjut(j, j, c.nomor_terakhir, c.reset_tahunan);
      const e = ctrEfektif(j, j), hint = $('[data-jenis="' + j + '"] [data-ctr-hint]', el);
      hint.textContent = per ? 'Mode per prodi aktif — isi counter tiap prodi di bawah.'
        : e.direset ? 'Tahun baru: counter ' + e.th + ' (' + e.asli + ') direset otomatis. Isi counter lalu Simpan bila ingin melanjutkan.'
        : 'Nomor berikutnya = counter + 1';
      const txt = formatNomor(c.format, (ctr || 0) + 1, c.digit, '', now);
      const html = esc(txt).replace(/\{KODE_PRODI\}/g, '<span class="v">{KODE_PRODI}</span>').replace('/' + ROMAWI[+now.slice(5, 7)] + '/', '/<span class="v">' + ROMAWI[+now.slice(5, 7)] + '</span>/');
      $('[data-jenis="' + j + '"] [data-prev]', el).innerHTML = '<span>' + html + '</span>' + ic('info');
    });
  },
  isiDefault(el) {
    ['CUTI', 'MUNDUR'].forEach((j) => {
      const card = $('[data-jenis="' + j + '"]', el);
      $('[data-k="digit"]', card).value = 3; $('[data-k="format"]', card).value = FORMAT_DEF[j]; $('[data-k="reset"]', card).checked = false;
    });
    $('#n-mode', el).value = 'BERSAMA';
    this.togglePP(el); this.preview(el);
    toast('Format, digit, dan mode dikembalikan ke default. Counter tidak diubah. Klik Simpan untuk menerapkan.', 'info');
  },
  async simpan(el, btn) {
    const v = this.baca(el);
    for (const j of ['CUTI', 'MUNDUR']) {
      if (v[j].format.indexOf('{NO}') === -1) { toast('Format ' + (j === 'CUTI' ? 'cuti' : 'mengundurkan diri') + ' wajib memuat {NO}.', 'err'); return; }
    }
    const turun = ['CUTI', 'MUNDUR'].filter((j) => +v[j].nomor_terakhir < ctrEfektif(j, j).n);
    if (turun.length && !(await confirmDialog({ title: 'Turunkan counter?', message: 'Counter ' + turun.map((j) => j === 'CUTI' ? 'cuti' : 'mengundurkan diri').join(' & ') + ' akan lebih kecil dari sebelumnya. Nomor yang sudah pernah terbit tetap dilewati otomatis sehingga tidak terjadi nomor ganda.', ok: 'Ya, simpan' }))) return;
    setBusy(btn, true, 'Menyimpan…');
    const res = await api('simpanPenomoran', v);
    setBusy(btn, false);
    if (!res.success) { toast(res.message, 'err'); return false; }
    S.nomor = res.data.nomor; S.logNomor = res.data.logNomor;
    this.isi(el);
    State.markStale(); State.changed();
    toast(res.message);
    return true;
  },
  async resetCounter(j, btn) {
    const ok = await confirmDialog({ title: 'Reset counter?', message: 'Counter <b>' + (j === 'CUTI' ? 'Surat Cuti' : 'Surat Mengundurkan Diri') + '</b> akan kembali ke 0 sehingga nomor berikutnya mulai dari 1. Tindakan tercatat di log.', ok: 'Reset Counter', danger: true });
    if (!ok) return;
    setBusy(btn, true, 'Mereset…');
    const res = await api('resetCounter', { jenis: j });
    setBusy(btn, false);
    if (!res.success) { toast(res.message, 'err'); return; }
    S.nomor = res.data.nomor; S.logNomor = res.data.logNomor;
    this.isi(this.el);
    State.markStale(); State.changed();
    toast(res.message);
  }
});

// =====================================================================
// PENGATURAN TAMPILAN (tema warna global)
// =====================================================================
const PRESET_TEMA = [
  { nama: 'Al Wafa Classic', t: { primer: '#1E3A5F', sekunder: '#5B3E96', aksen: '#C9A74D', latar: '#F5F7FA', kartu: '#FFFFFF' } },
  { nama: 'Modern Navy', t: { primer: '#0F2440', sekunder: '#2F5AA8', aksen: '#E07B12', latar: '#F3F5F9', kartu: '#FFFFFF' } },
  { nama: 'Emerald Islamic', t: { primer: '#1B4D3E', sekunder: '#2E7D5B', aksen: '#D4AF37', latar: '#F3F7F4', kartu: '#FFFFFF' } }
];
const SLOT_TEMA = [
  ['primer', 'Warna Primer (Navy Kampus)', 'Digunakan untuk sidebar, header utama, dan tombol aksi', 'paintbrush'],
  ['sekunder', 'Warna Sekunder', 'Tombol utama, menu aktif, dan grafik', 'sliders-horizontal'],
  ['aksen', 'Warna Aksen / Emas', 'Digunakan untuk badge, highlight, dan elemen penting', 'star'],
  ['latar', 'Warna Latar Belakang (Canvas)', 'Background area kerja utama dashboard', 'image'],
  ['kartu', 'Warna Kartu & Kontainer', 'Background untuk panel dan tabel data', 'layout-grid']
];
registerPage('tampilan', {
  admin: true, crumb: ['Pengaturan', 'Tampilan'],
  template: () => `
    <div class="page-head">
      <div><div class="eyebrow">${ic('palette')} Pengaturan Tampilan &amp; Branding Institusi</div><h1>Kustomisasi Tema Warna</h1>
        <p>Sesuaikan palet warna antarmuka aplikasi Rekap STIS Al Wafa yang berlaku secara global untuk seluruh civitas akademika.</p></div>
      <div class="head-actions"><button class="btn btn-soft" data-act="default">${ic('rotate-ccw')} Kembalikan ke Default</button><button class="btn btn-primary" data-act="simpan">${ic('save')} Simpan Perubahan</button></div>
    </div>
    <div class="callout"><div class="icon-tile sek">${ic('info')}</div><div><h4>Status Penerapan Global</h4>
      <p>Pengaturan warna ini berlaku untuk semua pengguna (Admin dan Staf Akademik). Perubahan langsung terlihat pada pratinjau di samping, dan diterapkan ke seluruh aplikasi setelah disimpan. Mode gelap diatur masing-masing pengguna lewat ikon bulan di kanan atas.</p></div></div>
    <div class="grid g2 split mt" style="align-items:start">
      <div class="card card-pad">
        <h3 class="card-title" style="margin-bottom:22px">${ic('sliders-horizontal')} Palet Warna Utama Kampus</h3>
        ${SLOT_TEMA.map(([k, nm, ds, icn]) => `<div class="color-row"><div class="icon-tile" data-swatch="${k}" style="width:44px;height:44px">${ic(icn)}</div>
          <div class="meta"><b>${nm}</b><span>${ds}</span></div>
          <input class="input hex" data-hex="${k}" maxlength="7" aria-label="Kode warna ${nm}"><input type="color" data-color="${k}" aria-label="Pilih warna ${nm}"></div>`).join('')}
        <div class="field mt"><label for="t-ins">Nama Institusi</label><input class="input" id="t-ins" data-ins maxlength="80"></div>
        <div style="border-top:1px solid var(--line);margin-top:26px;padding-top:20px"><div class="mini" style="margin-top:0">Preset Cepat Tema Kampus</div>
          <div class="presets">${PRESET_TEMA.map((p, i) => `<button type="button" class="preset" data-preset="${i}"><span class="sw"><i style="background:${p.t.primer}"></i><i style="background:${p.t.aksen}"></i></span>${esc(p.nama)}</button>`).join('')}</div></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:12px"><h3 class="card-title">${ic('eye')} Pratinjau Langsung (Live Preview)</h3><span class="pill gold">Realtime Preview</span></div>
        <div class="preview-box" data-preview>
          <div class="pc"><div style="display:flex;align-items:center;gap:14px"><div class="icon-tile" style="background:var(--p-primer);color:#fff">${ic('graduation-cap')}</div>
            <div style="flex:1;min-width:0"><b style="display:block" data-pins>STIS Al Wafa Academic Dashboard</b><span style="font-size:13.5px;color:#555">Sistem Rekapitulasi Data Mahasiswa</span></div>
            <span class="pill" style="background:var(--p-aksen);color:#fff">Aktif</span></div>
            <div class="grid g2 mt-s" style="gap:12px"><div style="background:color-mix(in srgb,var(--p-sekunder) 6%,var(--p-kartu));padding:14px 16px;border-radius:10px"><span style="font-size:13.5px;color:#555">Total Mahasiswa</span><b style="display:block;font-size:22px" data-pv-total></b></div>
              <div style="background:color-mix(in srgb,var(--p-sekunder) 6%,var(--p-kartu));padding:14px 16px;border-radius:10px"><span style="font-size:13.5px;color:#555">Cuti Akademik</span><b style="display:block;font-size:22px" data-pv-cuti></b></div></div></div>
          <div class="pc" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><span class="initials" style="background:color-mix(in srgb,var(--p-sekunder) 18%,#fff);color:var(--p-sekunder);width:40px;height:40px">WA</span>
            <div style="flex:1;min-width:140px"><b style="display:block;font-size:14.5px">Contoh Komponen Tombol</b><span style="font-size:13px;color:#555">Tampilan tombol interaktif</span></div>
            <span class="btn btn-sm" style="background:var(--p-sekunder);color:#fff">Aksi Utama</span><span class="btn btn-sm" style="background:var(--p-primer);color:#fff">Simpan</span></div>
          <div class="pc" style="padding:0;overflow:hidden;display:flex;min-height:86px"><div style="width:30%;background:var(--p-primer);padding:12px;display:flex;flex-direction:column;gap:6px">
            <span style="height:8px;border-radius:4px;background:rgba(255,255,255,.3);width:70%"></span><span style="height:22px;border-radius:6px;background:var(--p-sekunder)"></span><span style="height:8px;border-radius:4px;background:rgba(255,255,255,.3);width:60%"></span></div>
            <div style="flex:1;background:var(--p-latar);padding:12px;display:flex;gap:8px"><span style="flex:1;background:var(--p-kartu);border-radius:8px"></span><span style="flex:1;background:var(--p-kartu);border-radius:8px;border-top:4px solid var(--p-aksen)"></span></div></div>
          <p style="font-style:italic;color:#666;font-size:13px;text-align:center;margin:18px 0 0">Pratinjau di atas merepresentasikan bagaimana warna akan diterapkan pada tata letak aplikasi setelah tombol 'Simpan Perubahan' ditekan.</p>
        </div>
      </div>
    </div>`,
  mount(el) {
    const self = this;
    el.addEventListener('input', (e) => {
      const k = e.target.dataset.hex || e.target.dataset.color;
      if (k) {
        let v = e.target.value.trim();
        if (e.target.dataset.hex) { if (v && v[0] !== '#') v = '#' + v; if (!/^#[0-9a-fA-F]{6}$/.test(v)) { e.target.classList.add('invalid'); return; } }
        e.target.classList.remove('invalid');
        self.t[k] = v.toUpperCase(); self.tampil(el, e.target);
      }
      if (e.target.dataset.ins !== undefined) { $('[data-pins]', el).textContent = (e.target.value || 'STIS Al Wafa') + ' Academic Dashboard'; }
    });
    el.addEventListener('click', async (e) => {
      const p = e.target.closest('[data-preset]');
      if (p) { self.t = Object.assign({}, PRESET_TEMA[+p.dataset.preset].t); self.tampil(el); return; }
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'default') { self.t = Object.assign({}, (S.setelan && S.setelan.temaDefault) || PRESET_TEMA[0].t); self.tampil(el); toast('Warna default dimuat ke pratinjau. Klik Simpan Perubahan untuk menerapkan.', 'info'); }
      if (b.dataset.act === 'simpan') {
        setBusy(b, true, 'Menyimpan…');
        const res = await api('simpanTema', { tema: self.t, institusi: $('[data-ins]', el).value.trim() });
        setBusy(b, false);
        if (!res.success) { toast(res.message, 'err'); return; }
        S.setelan = res.data.setelan; applyTheme(S.setelan.tema, S.setelan.institusi); State.markStale(); State.persistSoon();
        toast(res.message);
      }
    });
  },
  show(el) {
    this.t = Object.assign({}, (S.setelan && S.setelan.tema) || PRESET_TEMA[0].t);
    $('[data-ins]', el).value = (S.setelan && S.setelan.institusi) || 'STIS Al Wafa';
    $('[data-pins]', el).textContent = $('[data-ins]', el).value + ' Academic Dashboard';
    const c = hitungStatus(S.mhs);
    $('[data-pv-total]', el).textContent = fmtNum(c.total); $('[data-pv-cuti]', el).textContent = fmtNum(c.Cuti);
    this.tampil(el);
  },
  tampil(el, sumber) {
    const t = this.t, pv = $('[data-preview]', el);
    Object.keys(t).forEach((k) => {
      pv.style.setProperty('--p-' + k, t[k]);
      const hx = $('[data-hex="' + k + '"]', el), cl = $('[data-color="' + k + '"]', el), sw = $('[data-swatch="' + k + '"]', el);
      if (hx !== sumber) hx.value = t[k];
      if (cl !== sumber) cl.value = t[k].toLowerCase();
      sw.style.background = t[k];
      sw.style.color = ['latar', 'kartu'].includes(k) ? '#1E3A5F' : '#fff';
      sw.style.border = ['latar', 'kartu'].includes(k) ? '1px solid var(--line)' : '0';
    });
    $$('[data-preset]', el).forEach((b) => { const p = PRESET_TEMA[+b.dataset.preset].t; b.classList.toggle('on', Object.keys(p).every((k) => p[k].toUpperCase() === (t[k] || '').toUpperCase())); });
  }
});

// =====================================================================
// KELOLA AKUN PENGGUNA (maks 5 aktif)
// =====================================================================
const WARNA_AVATAR = ['var(--sekunder)', '#6B5B95', '#5E6B8C', '#8A7FB0', '#7C6A9E'];
registerPage('pengguna', {
  admin: true, crumb: ['Pengaturan', 'Akun Pengguna'],
  template: () => `
    <div class="page-head">
      <div><div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap"><span class="pill sek">${ic('shield-check')} RBAC &amp; Keamanan</span><span class="pill gray" data-batas></span></div>
        <h1>Kelola Akun Pengguna</h1><p>Manajemen akun civitas akademika, peran (Admin &amp; Staf), batasan maksimal akun, dan pengaturan kredensial.</p></div>
      <div class="head-actions"><button class="btn btn-primary" data-act="tambah">${ic('user-plus')} Tambah Pengguna Baru</button></div>
    </div>
    <div class="grid g3" style="align-items:start">
      <div class="card card-pad"><div style="display:flex;justify-content:space-between;gap:12px"><div><div class="mini" style="margin:0 0 6px">Kapasitas Akun</div>
        <div style="font-size:30px;font-weight:800" data-kap></div></div><div class="icon-tile tint">${ic('users')}</div></div>
        <div class="bar" style="height:8px"><i data-kap-bar></i></div><p class="muted" style="margin:10px 0 0;font-size:14px" data-kap-sisa></p></div>
      <div class="card card-pad" style="grid-column:span 2"><div class="mini" style="margin:0 0 10px">Hak Akses</div>
        <div class="grid g2" style="gap:12px;font-size:14.5px;color:var(--ink-2)">
          <div><span class="role Admin">Admin</span><p style="margin:8px 0 0">Semua fitur: kelola mahasiswa, ubah status &amp; unggah surat, impor Excel, penomoran, tampilan, akun, migrasi.</p></div>
          <div><span class="role Staf">Staf Akademik</span><p style="margin:8px 0 0">Lihat dashboard, daftar mahasiswa, daftar cuti &amp; mengundurkan diri, buka berkas surat, unduh Excel.</p></div>
        </div></div>
    </div>
    <div class="card table-card mt">
      <div class="card-pad" style="padding-bottom:16px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-end">
        <div><h2 class="section">Daftar Pengguna Sistem</h2><p class="section-sub">Kelola kredensial dan hak akses akun yang terdaftar.</p></div>
        <label class="search" style="min-width:min(300px,100%)">${ic('search')}<input class="input" data-q placeholder="Cari nama atau username…"></label>
      </div>
      <div data-tbl></div>
    </div>
    <div class="card table-card mt">
      <div class="card-pad" style="padding-bottom:16px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-end">
        <div><h2 class="section">Log Aktivitas</h2><p class="section-sub">Login, ubah status, hapus, impor, dan perubahan pengaturan.</p></div>
        <button class="btn btn-soft btn-sm" data-act="log">${ic('history')} Muat Log Aktivitas</button>
      </div>
      <div data-log hidden></div>
    </div>`,
  mount(el) {
    const self = this;
    this.q = '';
    this.tbl = new Tabel($('[data-tbl]', el), {
      id: 'user', pageSize: 10,
      cols: [
        { key: 'nama', label: 'Pengguna', m: 'main', render: (u, i) => `<div style="display:flex;gap:14px;align-items:center"><span class="initials" style="background:${u.aktif ? WARNA_AVATAR[i % WARNA_AVATAR.length] : '#B9B6C6'}">${esc(initials(u.nama))}</span><div><b>${esc(u.nama)}</b>${u.username === S.me.username ? ' <span class="muted" style="font-size:12.5px">(Anda)</span>' : ''}<div class="mono muted">@${esc(u.username)}</div></div></div>` },
        { key: 'peran', label: 'Peran', render: (u) => '<span class="role ' + esc(u.peran) + '">' + (u.peran === 'Admin' ? 'Administrator' : 'Staf Akademik') + '</span>' },
        { key: 'aktif', label: 'Status Akun', render: (u) => u.aktif ? '<span class="chip s-aktif"><span class="dot"></span>Aktif</span>' + (u.wajib_ganti ? '<div class="muted" style="font-size:12px;margin-top:4px">wajib ganti password</div>' : '') : '<span class="chip s-kembali"><span class="dot"></span>Nonaktif</span>' },
        { key: 'login_terakhir', label: 'Terakhir Login', render: (u) => esc(relWaktu(u.login_terakhir)) },
        { key: 'aksi', label: 'Aksi', cls: 'actions', thCls: 'num', render: (u) => `<button class="act" data-act="ubah" data-id="${u.id}" title="Ubah nama/peran" aria-label="Ubah">${ic('pencil')}</button>
          <button class="act" data-act="reset" data-id="${u.id}" title="Reset password" aria-label="Reset password">${ic('key-round')}</button>
          <button class="act" data-act="status" data-id="${u.id}" title="${u.aktif ? 'Nonaktifkan' : 'Aktifkan'}" aria-label="${u.aktif ? 'Nonaktifkan' : 'Aktifkan'}">${ic(u.aktif ? 'ban' : 'circle-check')}</button>
          <button class="act del" data-act="hapus" data-id="${u.id}" title="Hapus akun" aria-label="Hapus">${ic('trash-2')}</button>` }
      ],
      info: (a, b, t) => 'Menampilkan ' + fmtNum(t) + ' dari ' + (S.server.maksPengguna || 5) + ' kuota akun aktif maksimal'
    });
    $('[data-q]', el).addEventListener('input', debounce((e) => { self.q = e.target.value.trim().toLowerCase(); self.render(el); }, 150));
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const u = S.pengguna.find((x) => x.id === b.dataset.id);
      const a = b.dataset.act;
      if (a === 'tambah') self.formUser(null);
      if (a === 'ubah') self.formUser(u);
      if (a === 'reset') self.resetPw(u);
      if (a === 'status') self.toggle(u);
      if (a === 'hapus') self.hapus(u);
      if (a === 'log') self.muatLog(el, b);
    });
  },
  show(el) { this.render(el); },
  refresh(el) { this.render(el); },
  render(el) {
    const maks = S.server.maksPengguna || 5, aktif = S.pengguna.filter((u) => u.aktif).length;
    $('[data-batas]', el).textContent = 'Batas: ' + maks + ' Akun Aktif';
    $('[data-kap]', el).innerHTML = aktif + ' / ' + maks + ' <span style="font-size:16px;font-weight:500">Akun</span>';
    $('[data-kap-bar]', el).style.width = Math.min(100, (aktif / maks) * 100) + '%';
    $('[data-kap-sisa]', el).textContent = aktif >= maks ? 'Kuota penuh — nonaktifkan akun lain untuk menambah.' : (maks - aktif) + ' slot akun tersedia untuk pendaftaran baru.';
    this.tbl.setRows(S.pengguna.filter((u) => cariCocok(this.q, [u.nama.toLowerCase(), u.username])));
  },
  pakai(res) {
    if (!res.success) { toast(res.message, 'err'); return false; }
    S.pengguna = res.data.pengguna; State.markStale(); State.changed(); toast(res.message); return true;
  },
  genPw() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; let s = ''; const a = crypto.getRandomValues(new Uint32Array(10)); a.forEach((x) => { s += c[x % c.length]; }); return s.slice(0, 7) + (2 + (a[0] % 8)) + s.slice(7); },
  formUser(u) {
    const baru = !u;
    const m = modal({
      title: baru ? 'Tambah Pengguna Baru' : 'Ubah Akun ' + u.username,
      body: `<form class="form-grid" style="grid-template-columns:1fr" data-form novalidate>
        ${baru ? `<div class="field"><label>Username<span class="req">*</span></label><input class="input mono" name="username" autocapitalize="none" spellcheck="false" placeholder="mis. fatimah_staf" autocomplete="off"><span class="hint">3–30 karakter: huruf kecil, angka, titik, garis bawah.</span></div>` : ''}
        <div class="field"><label>Nama Lengkap<span class="req">*</span></label><input class="input" name="nama" value="${esc(u ? u.nama : '')}" autocomplete="off"></div>
        <div class="field"><label>Peran<span class="req">*</span></label><select class="input" name="peran"><option value="Staf"${u && u.peran === 'Staf' ? ' selected' : ''}>Staf Akademik (hanya lihat & unduh)</option><option value="Admin"${u && u.peran === 'Admin' ? ' selected' : ''}>Administrator (akses penuh)</option></select></div>
        ${baru ? `<div class="field"><label>Password Awal<span class="req">*</span></label><div class="pw-wrap"><input class="input mono" name="password" value="${this.genPw()}" autocomplete="new-password"><button type="button" class="icon-btn" data-gen title="Buat acak" aria-label="Buat password acak">${ic('refresh-cw')}</button></div><span class="hint">Min. 8 karakter berisi huruf &amp; angka. Pengguna wajib menggantinya saat login pertama.</span></div>` : ''}
        <div data-err></div></form>`,
      foot: `<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" data-ok>${ic('save')} Simpan</button>`
    });
    const f = $('[data-form]', m.el);
    const gen = $('[data-gen]', m.el); if (gen) gen.onclick = () => { f.password.value = this.genPw(); };
    const kirim = async () => {
      const btn = $('[data-ok]', m.el);
      const d = { id: u ? u.id : '', nama: f.nama.value.trim(), peran: f.peran.value };
      if (baru) { d.username = f.username.value.trim().toLowerCase(); d.password = f.password.value; }
      setBusy(btn, true, 'Menyimpan…');
      const res = await api('simpanPengguna', d);
      setBusy(btn, false);
      if (!res.success) { $('[data-err]', m.el).innerHTML = '<div class="alert err">' + ic('circle-alert') + esc(res.message) + '</div>'; return; }
      m.close(); this.pakai(res);
      if (baru) modal({ title: 'Akun dibuat', body: `<p style="margin-top:0">Berikan kredensial berikut kepada pengguna. Password wajib diganti saat login pertama.</p><div class="callout"><div><p>Username: <b class="mono">${esc(d.username)}</b><br>Password awal: <b class="mono">${esc(d.password)}</b></p></div></div>`, foot: '<button class="btn btn-primary" data-close>Selesai</button>' });
    };
    $('[data-ok]', m.el).onclick = kirim;
    f.addEventListener('submit', (e) => { e.preventDefault(); kirim(); });
  },
  resetPw(u) {
    const pw = this.genPw();
    const m = modal({
      title: 'Reset Password · ' + u.username,
      body: `<p style="margin-top:0;color:var(--ink-2)">Semua sesi <b>${esc(u.nama)}</b> akan dikeluarkan, dan pengguna wajib mengganti password ini saat login.</p>
        <div class="field"><label>Password baru</label><div class="pw-wrap"><input class="input mono" data-pw value="${pw}"><button type="button" class="icon-btn" data-gen aria-label="Buat acak">${ic('refresh-cw')}</button></div></div><div data-err class="mt-s"></div>`,
      foot: `<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" data-ok>${ic('key-round')} Reset Password</button>`
    });
    $('[data-gen]', m.el).onclick = () => { $('[data-pw]', m.el).value = this.genPw(); };
    $('[data-ok]', m.el).onclick = async (e) => {
      const btn = e.currentTarget, baru = $('[data-pw]', m.el).value;
      setBusy(btn, true, 'Mereset…');
      const res = await api('resetPassword', { id: u.id, baru });
      setBusy(btn, false);
      if (!res.success) { $('[data-err]', m.el).innerHTML = '<div class="alert err">' + esc(res.message) + '</div>'; return; }
      m.close(); this.pakai(res);
      modal({ title: 'Password direset', body: `<div class="callout"><div><p>Username: <b class="mono">${esc(u.username)}</b><br>Password baru: <b class="mono">${esc(baru)}</b></p></div></div>`, foot: '<button class="btn btn-primary" data-close>Selesai</button>' });
    };
  },
  async toggle(u) {
    const ok = await confirmDialog({ title: u.aktif ? 'Nonaktifkan akun?' : 'Aktifkan akun?', message: u.aktif ? 'Akun <b>' + esc(u.username) + '</b> tidak bisa login dan semua sesinya dikeluarkan.' : 'Akun <b>' + esc(u.username) + '</b> akan bisa login kembali (maks ' + (S.server.maksPengguna || 5) + ' akun aktif).', ok: u.aktif ? 'Nonaktifkan' : 'Aktifkan', danger: u.aktif });
    if (!ok) return;
    // Optimistic UI + rollback
    const prev = u.aktif; u.aktif = !prev; this.render($('.page[data-page="pengguna"]'));
    const res = await api('statusPengguna', { id: u.id, aktif: !prev });
    if (!res.success) { u.aktif = prev; this.render($('.page[data-page="pengguna"]')); toast(res.message, 'err'); return; }
    this.pakai(res);
  },
  async hapus(u) {
    const ok = await confirmDialog({ title: 'Hapus akun?', message: 'Akun <b>' + esc(u.username) + '</b> (' + esc(u.nama) + ') akan dihapus permanen.', ok: 'Hapus Akun', danger: true });
    if (!ok) return;
    this.pakai(await api('hapusPengguna', { id: u.id }));
  },
  async muatLog(el, btn) {
    setBusy(btn, true, 'Memuat…');
    const res = await api('logAktivitas', { limit: 300 });
    setBusy(btn, false);
    if (!res.success) { toast(res.message, 'err'); return; }
    const host = $('[data-log]', el); host.hidden = false;
    if (!this.logTbl) {
      this.logTbl = new Tabel(host, {
        id: 'log', pageSize: 10, empty: 'Belum ada log.',
        cols: [
          { key: 'waktu', label: 'Waktu', cls: 'nowrap', render: (r) => '<span class="mono">' + fmtWaktu(r.waktu) + '</span>' },
          { key: 'pengguna', label: 'Pengguna', cls: 'nama', m: 'main' },
          { key: 'aksi', label: 'Aksi', render: (r) => '<span class="tag reset">' + esc(r.aksi) + '</span>' },
          { key: 'detail', label: 'Detail', m: 'wide', render: (r) => esc(r.aksi === 'TERBIT_SURAT' ? r.detail.split('|')[3] : r.detail) }
        ]
      });
    }
    this.logTbl.setRows(res.data.log, true);
    btn.innerHTML = ic('refresh-cw') + ' Muat Ulang';
  }
});

// =====================================================================
// IMPOR EXCEL (F8) — baca di browser, validasi, pratinjau, kirim per 200 baris
// =====================================================================
const IMPOR_ALIAS = {
  nim: ['nim', 'no induk', 'nomor induk', 'nomor induk mahasiswa', 'npm'],
  nama: ['nama', 'nama lengkap', 'nama mahasiswa', 'nama mhs'],
  gender: ['gender', 'jenis kelamin', 'jk', 'l p', 'kelamin', 'sex'],
  prodi: ['prodi', 'program studi', 'kode prodi', 'jurusan'],
  kelas: ['kelas', 'program kelas', 'jenis kelas'],
  tahun_masuk: ['tahun masuk', 'angkatan', 'tahun angkatan', 'th masuk', 'tahun'],
  status: ['status', 'status mahasiswa'],
  tanggal_status: ['tanggal status', 'tgl status', 'tanggal cuti', 'tanggal surat', 'tanggal', 'tanggal wisuda', 'tgl wisuda', 'tanggal lulus'],
  nomor_surat: ['nomor surat', 'no surat', 'nomor sk'],
  catatan: ['catatan', 'keterangan', 'ket']
};
registerPage('impor', {
  admin: true, nav: 'mahasiswa', crumb: ['Data Mahasiswa', 'Impor Excel'],
  template: () => `
    <div class="page-head">
      <div><h1>Impor Data Mahasiswa</h1><p>Tambah banyak mahasiswa sekaligus, atau perbarui data yang sudah ada (mis. melengkapi jenis kelamin) dari Excel. Data diperiksa dulu di pratinjau sebelum disimpan.</p></div>
      <div class="head-actions"><a href="#/mahasiswa" class="btn btn-ghost">${ic('arrow-left')} Kembali</a><button class="btn btn-soft" data-act="templat">${ic('download')} Unduh Templat Excel</button></div>
    </div>
    <div class="steps"><span data-step="1" class="on"><i>1</i> Pilih berkas</span><span data-step="2"><i>2</i> Pratinjau &amp; validasi</span><span data-step="3"><i>3</i> Hasil</span></div>
    <div class="card card-pad" data-s1>
      <div class="field" style="margin-bottom:20px"><span class="lbl-f">Mode impor</span>
        <div class="seg" role="radiogroup" aria-label="Mode impor"><button type="button" data-mode="tambah" class="on">Tambah mahasiswa baru</button><button type="button" data-mode="perbarui">Perbarui data yang sudah ada (berdasarkan NIM)</button></div>
        <p class="hint" data-mode-hint style="margin:6px 0 0"></p>
      </div>
      <label class="drop" for="imp-file" style="padding:44px">${ic('file-spreadsheet')}<div class="t">Klik atau seret berkas Excel ke sini</div><div class="s">.xlsx, .xls, atau .csv · baris pertama berisi judul kolom</div></label>
      <input type="file" id="imp-file" accept=".xlsx,.xls,.csv" hidden>
      <div class="mt" data-info-tambah><div class="mini" style="margin-top:0">Kolom yang dikenali</div>
        <p class="muted" style="margin:0;line-height:1.7"><b>Wajib:</b> NIM, Nama Lengkap, Prodi (ES/HES/PAI/IAT atau nama lengkap), Kelas (Reguler/Hybrid/Ma'had Aly Ikhwan/Ma'had Aly Akhwat/Khusus), Tahun Masuk.<br>
        <b>Opsional:</b> Jenis Kelamin (L/P), Status (Aktif/Cuti/Mengundurkan Diri/Lulus — kosong = Aktif), Tanggal Status (untuk Lulus = tanggal wisuda), Nomor Surat (untuk data lama), Catatan.</p></div>
      <div class="mt" data-info-perbarui hidden><div class="mini" style="margin-top:0">Cara cepat melengkapi jenis kelamin</div>
        <ol class="list-plain" style="margin:0"><li>Klik <b>Unduh Data untuk Diperbarui</b> (berisi NIM, nama, jenis kelamin, prodi, kelas, angkatan).</li>
          <li>Isi kolom <b>Jenis Kelamin</b> dengan L atau P (kolom lain boleh dibiarkan).</li><li>Unggah kembali di sini. Hanya kolom yang terisi dan berbeda yang diperbarui; <b>status tidak diubah</b>.</li></ol>
        <button class="btn btn-soft btn-sm mt-s" data-act="unduh-perbarui">${ic('download')} Unduh Data untuk Diperbarui</button></div>
    </div>
    <div data-s2 hidden>
      <div class="stat-mini" data-stat></div>
      <div class="card table-card mt">
        <div class="card-pad" style="padding:18px 24px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
          <div><b data-fname></b><div class="muted" style="font-size:13.5px">Baris bermasalah dapat diperbaiki langsung di tabel atau dilewati (hapus centang).</div></div>
          <label class="switch"><input type="checkbox" data-hanya-err><span class="tr"></span><span>Hanya tampilkan yang bermasalah</span></label>
        </div>
        <div class="tbl-wrap"><table class="tbl compact"><thead data-prev-head></thead><tbody data-prev></tbody></table></div>
        <div class="tbl-foot"><div class="info" data-pinfo></div><div class="pager" data-ppager></div></div>
      </div>
      <div class="progress mt" data-prog hidden><i></i></div>
      <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:22px;flex-wrap:wrap">
        <button class="btn btn-ghost" data-act="ulang">Pilih berkas lain</button>
        <button class="btn btn-primary" data-act="kirim">${ic('upload')} <span data-kirim-lbl>Impor</span></button>
      </div>
    </div>
    <div class="card card-pad" data-s3 hidden></div>`,
  mount(el) {
    const self = this;
    this.rows = []; this.page = 1; this.mode = 'tambah';
    this.setMode(el, 'tambah');
    $('#imp-file', el).addEventListener('change', (e) => { if (e.target.files[0]) self.baca(el, e.target.files[0]); e.target.value = ''; });
    const drop = $('.drop', el);
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); if (e.dataTransfer.files[0]) self.baca(el, e.dataTransfer.files[0]); });
    $('[data-hanya-err]', el).addEventListener('change', () => { self.page = 1; self.renderPrev(el); });
    el.addEventListener('click', (e) => {
      const md = e.target.closest('[data-mode]');
      if (md) { self.setMode(el, md.dataset.mode); return; }
      const b = e.target.closest('[data-act]');
      if (b) {
        if (b.dataset.act === 'templat') self.templat(b);
        if (b.dataset.act === 'unduh-perbarui') self.unduhPerbarui(b);
        if (b.dataset.act === 'ulang') self.step(el, 1);
        if (b.dataset.act === 'kirim') self.kirim(el, b);
        if (b.dataset.act === 'laporan') self.laporan();
        return;
      }
      const p = e.target.closest('[data-pg]');
      if (p && !p.disabled) { self.page = +p.dataset.pg; self.renderPrev(el); }
    });
    // Edit langsung di tabel pratinjau → validasi ulang seketika
    $('[data-prev]', el).addEventListener('input', (e) => self.edit(el, e));
    $('[data-prev]', el).addEventListener('change', (e) => self.edit(el, e));
    idle(() => loadXLSX().catch(() => {}), 800);   // siapkan pustaka Excel
  },
  show() {},
  setMode(el, m) {
    this.mode = m;
    $$('[data-mode]', el).forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    $('[data-info-tambah]', el).hidden = m !== 'tambah';
    $('[data-info-perbarui]', el).hidden = m !== 'perbarui';
    $('[data-mode-hint]', el).textContent = m === 'tambah' ? 'NIM yang sudah terdaftar akan ditandai dan dilewati.' : 'Mencocokkan NIM yang sudah ada lalu memperbarui nama, jenis kelamin, prodi, kelas, angkatan, atau catatan.';
  },
  async unduhPerbarui(btn) {
    setBusy(btn, true, 'Menyiapkan…');
    try {
      const rows = S.mhs.slice().sort((a, b) => (a.gender ? 1 : 0) - (b.gender ? 1 : 0) || String(a.nim).localeCompare(String(b.nim)));
      await exportXlsx('Perbarui_Data_Mahasiswa_' + stampFile() + '.xlsx', 'Perbarui',
        ['NIM', 'Nama Lengkap', 'Jenis Kelamin', 'Prodi', 'Kelas', 'Tahun Masuk', 'Catatan'],
        rows.map((m) => [m.nim, m.nama, m.gender || '', m.prodi, m.kelas, m.tahun_masuk, m.catatan || '']), [13, 32, 14, 7, 20, 12, 30]);
      toast('Isi kolom Jenis Kelamin (L/P), lalu unggah kembali dengan mode Perbarui. Baris tanpa jenis kelamin ada di urutan atas.', 'info');
    } catch (e) { toast(e.message, 'err'); }
    setBusy(btn, false);
  },
  step(el, n) {
    $$('[data-step]', el).forEach((s) => s.classList.toggle('on', +s.dataset.step === n));
    $('[data-s1]', el).hidden = n !== 1; $('[data-s2]', el).hidden = n !== 2; $('[data-s3]', el).hidden = n !== 3;
  },
  async templat(btn) {
    setBusy(btn, true, 'Menyiapkan…');
    try {
      const X = await loadXLSX();
      const wb = X.utils.book_new();
      const ws = X.utils.aoa_to_sheet([
        ['NIM', 'Nama Lengkap', 'Jenis Kelamin', 'Prodi', 'Kelas', 'Tahun Masuk', 'Status', 'Tanggal Status', 'Nomor Surat', 'Catatan'],
        ['202501001', 'Contoh Nama Mahasiswa', 'L', 'ES', 'Reguler', 2025, 'Aktif', '', '', ''],
        ['202401017', 'Contoh Mahasiswa Cuti', 'P', 'HES', 'Khusus', 2024, 'Cuti', '2025-09-15', '045.C/HES/STIS-AL-WAFA/IX/2025', 'Data lama']
      ]);
      ws['!cols'] = [13, 30, 14, 8, 20, 12, 18, 15, 34, 24].map((w) => ({ wch: w }));
      const pt = X.utils.aoa_to_sheet([['Kolom', 'Nilai yang diterima'], ['Jenis Kelamin', 'L (laki-laki) atau P (perempuan). Ma\'had Aly Ikhwan otomatis L, Akhwat otomatis P'], ['Prodi', 'ES, HES, PAI, IAT (atau nama lengkap prodi)'], ['Kelas', "Reguler, Hybrid, Ma'had Aly Ikhwan, Ma'had Aly Akhwat, Khusus"], ['Status', 'Aktif, Cuti, Mengundurkan Diri, Lulus (kosong = Aktif)'], ['Tanggal Status', 'yyyy-mm-dd atau dd/mm/yyyy · untuk Lulus isi tanggal wisuda'], ['Catatan', 'Berkas surat untuk data lama diunggah dari menu Ubah Data setelah impor']]);
      pt['!cols'] = [{ wch: 16 }, { wch: 70 }];
      X.utils.book_append_sheet(wb, ws, 'Mahasiswa');
      X.utils.book_append_sheet(wb, pt, 'Petunjuk');
      X.writeFile(wb, 'Templat_Impor_Mahasiswa.xlsx');
    } catch (e) { toast(e.message, 'err'); }
    setBusy(btn, false);
  },
  async baca(el, file) {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { toast('Pilih berkas .xlsx, .xls, atau .csv.', 'err'); return; }
    try {
      const X = await loadXLSX();
      const wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = X.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
      // Cari baris judul kolom dalam 10 baris pertama
      let hi = -1, best = 0;
      aoa.slice(0, 10).forEach((r, i) => { const n = r.map(huruf).filter((h) => Object.values(IMPOR_ALIAS).some((a) => a.includes(h))).length; if (n > best) { best = n; hi = i; } });
      if (hi < 0 || best < 2) throw new Error('Judul kolom (NIM, Nama, …) tidak ditemukan di baris awal. Gunakan templat.');
      const h = aoa[hi].map(huruf), map = {};
      Object.keys(IMPOR_ALIAS).forEach((f) => { const i = h.findIndex((x) => IMPOR_ALIAS[f].includes(x)); if (i > -1) map[f] = i; });
      this.file = file.name;
      this.rows = aoa.slice(hi + 1).map((r, i) => {
        const o = { baris: hi + i + 2, ikut: true };
        Object.keys(IMPOR_ALIAS).forEach((f) => { const v = map[f] !== undefined ? r[map[f]] : ''; o[f] = v instanceof Date ? normTgl(v) : String(v === null || v === undefined ? '' : v).trim(); });
        o.prodi = normProdi(o.prodi) || o.prodi; o.kelas = normKelas(o.kelas) || o.kelas;
        o.gender = normGender(o.gender) || o.gender;
        if (this.mode === 'tambah' && !o.gender) o.gender = genderDariKelas(o.kelas);
        o.status = o.status ? (normStatus(o.status) || o.status) : (this.mode === 'tambah' ? 'Aktif' : '');
        if (o.tanggal_status) o.tanggal_status = normTgl(isNaN(+o.tanggal_status) ? o.tanggal_status : +o.tanggal_status) || o.tanggal_status;
        return o;
      }).filter((o) => o.nim || o.nama);
      if (!this.rows.length) throw new Error('Tidak ada baris data di bawah judul kolom.');
      this.validasiSemua();
      this.page = 1;
      $('[data-fname]', el).textContent = file.name + ' · ' + fmtNum(this.rows.length) + ' baris';
      this.step(el, 2); this.renderPrev(el);
    } catch (e) { toast(e.message, 'err', 'Berkas tidak bisa dibaca'); }
  },
  validasiSatu(o, nimFile) {
    if (this.mode === 'perbarui') return this.validasiPerbarui(o, nimFile);
    const e = [], maxTh = new Date().getFullYear() + 1;
    if (!o.nim) e.push('NIM kosong'); else if (!/^[0-9A-Za-z.\-/]{4,24}$/.test(o.nim)) e.push('format NIM');
    else if (S.mhs.some((m) => m.nim === o.nim)) e.push('NIM sudah terdaftar');
    else if (nimFile[o.nim] > 1) e.push('NIM ganda di berkas');
    if (!o.nama) e.push('nama kosong');
    if (!PRODI[o.prodi]) e.push(o.prodi ? 'prodi tidak dikenal' : 'prodi kosong');
    if (!KELAS.includes(o.kelas)) e.push(o.kelas ? 'kelas tidak dikenal' : 'kelas kosong');
    const th = parseInt(o.tahun_masuk, 10);
    if (!th) e.push('tahun masuk kosong'); else if (th < 1990 || th > maxTh) e.push('tahun tidak wajar');
    if (!STATUS.includes(o.status)) e.push('status tidak dikenal');
    if (o.tanggal_status && !normTgl(o.tanggal_status)) e.push('tanggal tidak valid');
    if (o.gender && !GENDER[o.gender]) e.push('jenis kelamin tidak dikenal');
    else if (o.gender && genderDariKelas(o.kelas) && genderDariKelas(o.kelas) !== o.gender) e.push(o.kelas + ' khusus ' + (genderDariKelas(o.kelas) === 'L' ? 'L' : 'P'));
    o.err = e;
  },
  /** Mode perbarui: NIM harus ada; hanya kolom terisi yang dibandingkan */
  validasiPerbarui(o, nimFile) {
    const e = [], m = S.mhs.find((x) => x.nim === o.nim), maxTh = new Date().getFullYear() + 1;
    o.ubah = [];
    if (!o.nim) e.push('NIM kosong');
    else if (!m) e.push('NIM tidak ditemukan');
    else if (nimFile[o.nim] > 1) e.push('NIM ganda di berkas');
    if (o.prodi && !PRODI[o.prodi]) e.push('prodi tidak dikenal');
    if (o.kelas && !KELAS.includes(o.kelas)) e.push('kelas tidak dikenal');
    if (o.gender && !GENDER[o.gender]) e.push('jenis kelamin tidak dikenal');
    const th = parseInt(o.tahun_masuk, 10);
    if (o.tahun_masuk && (!th || th < 1990 || th > maxTh)) e.push('tahun tidak wajar');
    if (m && !e.length) {
      const kelasAkhir = o.kelas || m.kelas, genderAkhir = o.gender || m.gender || genderDariKelas(kelasAkhir);
      if (genderAkhir && genderDariKelas(kelasAkhir) && genderDariKelas(kelasAkhir) !== genderAkhir) e.push(kelasAkhir + ' khusus ' + genderDariKelas(kelasAkhir));
      [['nama', 'nama'], ['gender', 'gender'], ['prodi', 'prodi'], ['kelas', 'kelas'], ['tahun_masuk', 'angkatan'], ['catatan', 'catatan']].forEach(([k, lbl]) => {
        if (o[k] !== '' && o[k] !== undefined && String(o[k]) !== String(m[k] || '')) o.ubah.push(lbl + ': ' + (m[k] || '—') + ' → ' + o[k]);
      });
    }
    o.err = e;
    o.sama = !e.length && !o.ubah.length;
  },
  validasiSemua() {
    const cnt = {};
    this.rows.forEach((o) => { if (o.nim && o.ikut) cnt[o.nim] = (cnt[o.nim] || 0) + 1; });
    this.rows.forEach((o) => this.validasiSatu(o, cnt));
  },
  edit(el, e) {
    const tr = e.target.closest('tr[data-i]'); if (!tr) return;
    const o = this.rows[+tr.dataset.i], k = e.target.dataset.k;
    if (k === 'ikut') o.ikut = e.target.checked; else if (k) o[k] = e.target.value.trim();
    if (e.type === 'change' || k === 'ikut') { this.validasiSemua(); this.renderPrev(el, true); }
  },
  renderPrev(el, keepFocus) {
    const hanyaErr = $('[data-hanya-err]', el).checked;
    const idx = this.rows.map((o, i) => i).filter((i) => !hanyaErr || this.rows[i].err.length);
    const per = 50, pages = Math.max(1, Math.ceil(idx.length / per));
    if (this.page > pages) this.page = pages;
    const view = idx.slice((this.page - 1) * per, this.page * per);
    const sel = (k, val, opts) => '<select class="input" data-k="' + k + '">' + (opts.includes(val) ? '' : '<option value="' + esc(val) + '" selected>' + esc(val || '—') + '</option>') + opts.map((x) => '<option' + (x === val ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select>';
    const perbarui = this.mode === 'perbarui';
    $('[data-prev-head]', el).innerHTML = perbarui
      ? '<tr><th>Ikut</th><th>Baris</th><th>NIM</th><th>Nama Lengkap</th><th>Gender</th><th>Prodi</th><th>Kelas</th><th>Tahun</th><th>Perubahan / Keterangan</th></tr>'
      : '<tr><th>Ikut</th><th>Baris</th><th>NIM</th><th>Nama Lengkap</th><th>Gender</th><th>Prodi</th><th>Kelas</th><th>Tahun</th><th>Status</th><th>Nomor Surat</th><th>Keterangan</th></tr>';
    const selG = (val) => '<select class="input" data-k="gender"><option value=""' + (val ? '' : ' selected') + '>—</option><option value="L"' + (val === 'L' ? ' selected' : '') + '>L</option><option value="P"' + (val === 'P' ? ' selected' : '') + '>P</option>' + (val && !GENDER[val] ? '<option selected>' + esc(val) + '</option>' : '') + '</select>';
    const html = view.map((i) => {
      const o = this.rows[i], bad = o.err.length && o.ikut;
      const inp = (k, w) => '<input class="input' + (k === 'nim' ? ' mono' : '') + '" data-k="' + k + '" value="' + esc(o[k]) + '" style="min-width:' + w + 'px">';
      const ket = o.err.length ? '<span class="reason">' + esc(o.err.join(', ')) + '</span>'
        : perbarui ? (o.sama ? '<span class="muted">Tidak ada perubahan</span>' : '<span style="color:var(--ok-ink)">' + ic('check') + ' ' + esc(o.ubah.join(' · ')) + '</span>')
        : '<span style="color:var(--ok-ink)">' + ic('check') + ' Siap</span>' + (o.gender ? '' : ' <span class="muted">(tanpa gender)</span>');
      const edit = o.err.length || perbarui;
      return '<tr data-i="' + i + '" class="' + (bad ? 'row-err' : '') + (o.ikut ? '' : ' row-skip') + '"><td><input type="checkbox" data-k="ikut"' + (o.ikut ? ' checked' : '') + ' aria-label="Ikut diproses"></td><td class="muted">' + o.baris + '</td>' +
        (perbarui
          ? '<td class="nim">' + esc(o.nim) + '</td><td class="nama">' + esc(o.nama || (S.mhs.find((m) => m.nim === o.nim) || {}).nama || '') + '</td><td>' + selG(o.gender) + '</td><td>' + (o.prodi ? chipProdi(o.prodi) : '<span class="muted">—</span>') + '</td><td>' + esc(o.kelas || '—') + '</td><td>' + esc(o.tahun_masuk || '—') + '</td>'
          : edit ? '<td>' + inp('nim', 110) + '</td><td>' + inp('nama', 170) + '</td><td>' + selG(o.gender) + '</td><td>' + sel('prodi', o.prodi, Object.keys(PRODI)) + '</td><td>' + sel('kelas', o.kelas, KELAS) + '</td><td>' + inp('tahun_masuk', 70) + '</td><td>' + sel('status', o.status, STATUS) + '</td><td>' + inp('nomor_surat', 150) + '</td>'
          : '<td class="nim">' + esc(o.nim) + '</td><td class="nama">' + esc(o.nama) + '</td><td>' + chipGender(o.gender) + '</td><td>' + chipProdi(o.prodi) + '</td><td>' + esc(o.kelas) + '</td><td>' + esc(o.tahun_masuk) + '</td><td>' + chipStatus(o.status) + '</td><td class="no-surat">' + esc(o.nomor_surat || '—') + '</td>') +
        '<td>' + ket + '</td></tr>';
    }).join('');
    const tb = $('[data-prev]', el);
    const act = keepFocus && document.activeElement && tb.contains(document.activeElement) ? [document.activeElement.closest('tr').dataset.i, document.activeElement.dataset.k] : null;
    tb.innerHTML = html || '<tr><td colspan="11"><div class="empty">' + ic('circle-check') + 'Tidak ada baris bermasalah.</div></td></tr>';
    if (act) { const f = tb.querySelector('tr[data-i="' + act[0] + '"] [data-k="' + act[1] + '"]'); if (f) f.focus(); }
    $('[data-pinfo]', el).textContent = 'Halaman ' + this.page + ' dari ' + pages + ' · ' + fmtNum(idx.length) + ' baris';
    $('[data-ppager]', el).innerHTML = '<button data-pg="' + (this.page - 1) + '"' + (this.page <= 1 ? ' disabled' : '') + ' aria-label="Sebelumnya">' + ic('chevron-left') + '</button><button class="cur">' + this.page + '</button><button data-pg="' + (this.page + 1) + '"' + (this.page >= pages ? ' disabled' : '') + ' aria-label="Berikutnya">' + ic('chevron-right') + '</button>';
    const valid = this.rows.filter((o) => o.ikut && !o.err.length && !o.sama).length, bermasalah = this.rows.filter((o) => o.ikut && o.err.length).length, lewati = this.rows.filter((o) => !o.ikut || o.sama).length;
    $('[data-stat]', el).innerHTML = `<div><b>${fmtNum(this.rows.length)}</b><span>Total baris</span></div><div><b style="color:var(--ok-ink)">${fmtNum(valid)}</b><span>${perbarui ? 'Akan diperbarui' : 'Siap diimpor'}</span></div><div><b style="color:var(--bad-ink)">${fmtNum(bermasalah)}</b><span>Bermasalah</span></div><div><b>${fmtNum(lewati)}</b><span>${perbarui ? 'Dilewati / tanpa perubahan' : 'Dilewati'}</span></div>`;
    $('[data-kirim-lbl]', el).textContent = (perbarui ? 'Perbarui ' : 'Impor ') + fmtNum(valid) + ' baris';
    $('[data-act="kirim"]', el).disabled = !valid;
  },
  async kirim(el, btn) {
    if (this.mode === 'perbarui') return this.kirimPerbarui(el, btn);
    const siap = this.rows.filter((o) => o.ikut && !o.err.length);
    const masalah = this.rows.filter((o) => o.ikut && o.err.length).length;
    if (masalah && !(await confirmDialog({ title: 'Lewati baris bermasalah?', message: fmtNum(masalah) + ' baris bermasalah akan dilewati. ' + fmtNum(siap.length) + ' baris valid akan diimpor.', ok: 'Lanjutkan Impor' }))) return;
    setBusy(btn, true, 'Mengimpor…');
    const prog = $('[data-prog]', el), bar = prog.querySelector('i'); prog.hidden = false; bar.style.width = '0';
    const hasil = { berhasil: [], gagal: [], counter: [] };
    const CH = 200;
    for (let i = 0; i < siap.length; i += CH) {
      const part = siap.slice(i, i + CH).map((o) => ({ baris: o.baris, nim: o.nim, nama: o.nama, gender: o.gender, prodi: o.prodi, kelas: o.kelas, tahun_masuk: o.tahun_masuk, status: o.status, tanggal_status: o.tanggal_status, nomor_surat: o.nomor_surat, catatan: o.catatan }));
      const res = await api('imporMahasiswa', { rows: part });
      if (!res.success) { part.forEach((p) => hasil.gagal.push({ baris: p.baris, nim: p.nim, alasan: res.message })); }
      else {
        res.data.berhasil.forEach((m) => State.upsertMhs(m));
        (res.data.riwayat || []).forEach((r) => State.addRiwayat(r));
        if (res.data.nomor) S.nomor = res.data.nomor;
        hasil.berhasil.push(...res.data.berhasil); hasil.gagal.push(...res.data.gagal); hasil.counter.push(...(res.data.counter || []));
        State.changed();
      }
      bar.style.width = Math.round(Math.min(1, (i + CH) / siap.length) * 100) + '%';
    }
    State.markStale();
    setBusy(btn, false); prog.hidden = true;
    this.hasil = hasil;
    const s3 = $('[data-s3]', el);
    s3.innerHTML = `<div style="display:flex;gap:16px;align-items:center;margin-bottom:22px"><div class="icon-tile ${hasil.gagal.length ? 'gold' : 'sek'}">${ic(hasil.gagal.length ? 'triangle-alert' : 'circle-check')}</div>
      <div><h2 class="section">Impor selesai</h2><p class="section-sub">${esc(this.file)}</p></div></div>
      <div class="stat-mini"><div><b style="color:var(--ok-ink)">${fmtNum(hasil.berhasil.length)}</b><span>Berhasil disimpan</span></div><div><b style="color:var(--bad-ink)">${fmtNum(hasil.gagal.length)}</b><span>Gagal di server</span></div>
      <div><b>${fmtNum(masalah)}</b><span>Dilewati (bermasalah)</span></div><div><b>${fmtNum(this.rows.filter((o) => !o.ikut).length)}</b><span>Dilewati (manual)</span></div></div>
      ${hasil.counter.length ? `<div class="callout mt"><div class="icon-tile sek">${ic('hash')}</div><div><h4>Counter surat disesuaikan</h4><p>Agar nomor baru tidak lebih kecil dari nomor surat lama: ${esc(hasil.counter.join(', '))}.</p></div></div>` : ''}
      ${hasil.gagal.length ? `<div class="mt"><div class="mini">Baris gagal</div><ul class="warn-list">${hasil.gagal.slice(0, 50).map((g) => `<li>Baris ${g.baris} · <span class="mono">${esc(g.nim)}</span> — ${esc(g.alasan)}</li>`).join('')}</ul></div>` : ''}
      <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:26px;flex-wrap:wrap">${hasil.gagal.length || masalah ? `<button class="btn btn-soft" data-act="laporan">${ic('download')} Unduh Laporan Gagal</button>` : ''}
      <button class="btn btn-ghost" data-act="ulang">Impor berkas lain</button><a class="btn btn-primary" href="#/mahasiswa">${ic('users')} Lihat Data Mahasiswa</a></div>`;
    this.step(el, 3);
    toast(fmtNum(hasil.berhasil.length) + ' mahasiswa berhasil diimpor.');
  },
  async kirimPerbarui(el, btn) {
    const siap = this.rows.filter((o) => o.ikut && !o.err.length && !o.sama);
    const masalah = this.rows.filter((o) => o.ikut && o.err.length).length;
    if (masalah && !(await confirmDialog({ title: 'Lewati baris bermasalah?', message: fmtNum(masalah) + ' baris bermasalah akan dilewati. ' + fmtNum(siap.length) + ' data akan diperbarui.', ok: 'Lanjutkan' }))) return;
    setBusy(btn, true, 'Memperbarui…');
    const prog = $('[data-prog]', el), bar = prog.querySelector('i'); prog.hidden = false; bar.style.width = '0';
    const hasil = { diperbarui: [], gagal: [], sama: 0 }, CH = 200;
    for (let i = 0; i < siap.length; i += CH) {
      const part = siap.slice(i, i + CH).map((o) => {
        const r = { baris: o.baris, nim: o.nim };
        ['nama', 'gender', 'prodi', 'kelas', 'tahun_masuk', 'catatan'].forEach((k) => { if (o[k] !== '' && o[k] !== undefined) r[k] = o[k]; });
        return r;
      });
      const res = await api('perbaruiMassal', { rows: part });
      if (!res.success) part.forEach((p) => hasil.gagal.push({ baris: p.baris, nim: p.nim, alasan: res.message }));
      else {
        res.data.diperbarui.forEach((m) => State.upsertMhs(m));
        hasil.diperbarui.push(...res.data.diperbarui); hasil.gagal.push(...res.data.gagal); hasil.sama += res.data.sama || 0;
        State.changed();
      }
      bar.style.width = Math.round(Math.min(1, (i + CH) / siap.length) * 100) + '%';
    }
    State.markStale();
    setBusy(btn, false); prog.hidden = true;
    this.hasil = { berhasil: hasil.diperbarui, gagal: hasil.gagal };
    const s3 = $('[data-s3]', el);
    s3.innerHTML = `<div style="display:flex;gap:16px;align-items:center;margin-bottom:22px"><div class="icon-tile ${hasil.gagal.length ? 'gold' : 'sek'}">${ic(hasil.gagal.length ? 'triangle-alert' : 'circle-check')}</div>
      <div><h2 class="section">Pembaruan selesai</h2><p class="section-sub">${esc(this.file)}</p></div></div>
      <div class="stat-mini"><div><b style="color:var(--ok-ink)">${fmtNum(hasil.diperbarui.length)}</b><span>Data diperbarui</span></div><div><b style="color:var(--bad-ink)">${fmtNum(hasil.gagal.length)}</b><span>Gagal di server</span></div>
      <div><b>${fmtNum(masalah)}</b><span>Dilewati (bermasalah)</span></div><div><b>${fmtNum(this.rows.filter((o) => o.sama).length + hasil.sama)}</b><span>Tanpa perubahan</span></div></div>
      ${hasil.gagal.length ? `<div class="mt"><div class="mini">Baris gagal</div><ul class="warn-list">${hasil.gagal.slice(0, 50).map((g) => `<li>Baris ${g.baris} · <span class="mono">${esc(g.nim)}</span> — ${esc(g.alasan)}</li>`).join('')}</ul></div>` : ''}
      <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:26px;flex-wrap:wrap">${hasil.gagal.length || masalah ? `<button class="btn btn-soft" data-act="laporan">${ic('download')} Unduh Laporan Gagal</button>` : ''}
      <button class="btn btn-ghost" data-act="ulang">Proses berkas lain</button><a class="btn btn-primary" href="#/dashboard">${ic('layout-dashboard')} Lihat Dashboard</a></div>`;
    this.step(el, 3);
    toast(fmtNum(hasil.diperbarui.length) + ' data mahasiswa diperbarui.');
  },
  laporan() {
    const bad = this.rows.filter((o) => o.ikut && o.err.length).map((o) => [o.baris, o.nim, o.nama, o.err.join(', ')]).concat(this.hasil.gagal.map((g) => [g.baris, g.nim, '', g.alasan]));
    exportXlsx('Laporan_Impor_Gagal_' + stampFile() + '.xlsx', 'Gagal', ['Baris', 'NIM', 'Nama', 'Alasan'], bad, [8, 14, 30, 60]).catch((e) => toast(e.message, 'err'));
  }
});

// =====================================================================
// MIGRASI DATABASE (gas-migrasi-database)
// =====================================================================
const PERAN_SHEET = ['Mahasiswa', 'Riwayat', 'Penomoran', 'Pengguna', 'Pengaturan', 'Log', 'Abaikan'];
const LABEL_FIELD = { nim: 'NIM', nama: 'Nama', gender: 'Jenis Kelamin', prodi: 'Prodi', kelas: 'Kelas', tahun_masuk: 'Tahun Masuk', status: 'Status', tanggal_status: 'Tanggal Status', nomor_surat: 'Nomor Surat', id_berkas: 'ID Berkas', link_berkas: 'Link Berkas', catatan: 'Catatan', id: 'ID' };
registerPage('migrasi', {
  admin: true, crumb: ['Pengaturan', 'Migrasi Data'],
  template: () => `
    <div class="page-head"><div><div class="eyebrow">${ic('database')} Modul Migrasi Database</div><h1>Migrasi Data dari Rekap Lama</h1>
      <p>Pindahkan data dari spreadsheet rekap manual atau dari app Rekap Mahasiswa versi sebelumnya — tanpa mengubah sumber, aman diulang, dan bisa diuji dulu (dry-run).</p></div></div>
    <div class="callout"><div class="icon-tile sek">${ic('shield-check')}</div><div><h4>Prinsip migrasi aman</h4>
      <p>Spreadsheet lama <b>hanya dibaca</b>. Kolom dikenali dari <b>nama judul kolom</b>, bukan urutannya. Menjalankan ulang tidak membuat data ganda (kunci: NIM). Data yang sudah Anda ubah di app ini <b>tidak ditimpa</b>. Gunakan akun Google yang sama dengan pemilik spreadsheet lama agar berkas Drive tetap terbaca.</p></div></div>
    <div class="card card-pad mt">
      <h3 class="card-title" style="margin-bottom:16px"><span class="pill sek">1</span> Hubungkan spreadsheet lama</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap"><input class="input" data-src placeholder="Tempel URL atau ID Google Spreadsheet lama" style="flex:1 1 320px"><button class="btn btn-navy" data-act="hubungkan">${ic('link-2')} Hubungkan</button></div>
    </div>
    <div data-s2 hidden>
      <div class="card card-pad mt">
        <h3 class="card-title" style="margin-bottom:6px"><span class="pill sek">2</span> Pilih sheet &amp; periksa pemetaan kolom</h3>
        <p class="section-sub" data-srcname style="margin-bottom:18px"></p>
        <div data-sheets></div>
      </div>
      <div class="card card-pad mt">
        <h3 class="card-title" style="margin-bottom:18px"><span class="pill sek">3</span> Opsi migrasi</h3>
        <div style="display:flex;flex-direction:column;gap:14px">
          <label class="switch"><input type="checkbox" data-o="delta" checked><span class="tr"></span><span><b>Delta sync</b> — perbarui data hasil migrasi sebelumnya bila berubah di sumber (data yang sudah diedit di app ini tetap dilindungi)</span></label>
          <label class="switch"><input type="checkbox" data-o="counter" checked><span class="tr"></span><span><b>Sesuaikan counter surat</b> — counter = maks(counter sekarang, nomor surat lama)</span></label>
          <label class="switch"><input type="checkbox" data-o="tema" checked><span class="tr"></span><span><b>Terapkan tema &amp; nama institusi lama</b> — hanya bila pengaturan di app ini masih bawaan</span></label>
          <label class="switch"><input type="checkbox" data-o="pengguna"><span class="tr"></span><span><b>Impor akun pengguna</b> — dari app versi lama (maks 5 aktif; kelebihan diimpor nonaktif)</span></label>
          <label class="switch"><input type="checkbox" data-o="log"><span class="tr"></span><span><b>Impor log aktivitas</b> — diurutkan ulang berdasarkan waktu</span></label>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px;flex-wrap:wrap">
          <button class="btn btn-soft" data-act="pindai">${ic('scan-search')} Pindai (Dry-run)</button>
          <button class="btn btn-primary" data-act="jalankan">${ic('database')} Jalankan Migrasi</button>
        </div>
      </div>
      <div class="card card-pad mt" data-hasil hidden></div>
    </div>
    <div class="card card-pad mt">
      <h3 class="card-title" style="margin-bottom:12px">${ic('list-checks')} Checklist cutover</h3>
      <ol class="list-plain"><li>Hubungkan spreadsheet lama → <b>Pindai</b> → periksa angka &amp; peringatan.</li><li><b>Jalankan Migrasi</b>, lalu cek Data Mahasiswa, Daftar Cuti, dan Penomoran.</li>
        <li>Uji login dengan satu akun Staf.</li><li>Tepat sebelum beralih penuh: <b>jalankan migrasi sekali lagi</b> (delta) untuk menangkap data terbaru.</li>
        <li>Umumkan alamat app baru; arsipkan spreadsheet/app lama (tetap aman, tidak diubah).</li></ol>
    </div>`,
  mount(el) {
    const self = this;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'hubungkan') self.hubungkan(el, b);
      if (b.dataset.act === 'pindai') self.jalankan(el, b, true);
      if (b.dataset.act === 'jalankan') self.jalankan(el, b, false);
      if (b.dataset.act === 'map') { const box = $('[data-mapbox="' + b.dataset.i + '"]', el); box.hidden = !box.hidden; }
    });
    el.addEventListener('change', (e) => {
      const t = e.target, i = t.dataset.i;
      if (i === undefined || !self.info) return;
      const sh = self.info.sheets[+i];
      if (t.dataset.use !== undefined) sh._pakai = t.checked;
      if (t.dataset.peran !== undefined) { sh.peran = t.value; sh._pakai = t.value !== 'Abaikan'; self.renderSheets(el); }
      if (t.dataset.field) { if (t.value) sh.map[t.dataset.field] = t.value; else delete sh.map[t.dataset.field]; self.renderSheets(el, +i); }
      if (t.dataset.kdef !== undefined) sh.kelas_default = t.value;
      if (t.dataset.pdef !== undefined) sh.prodi_default = t.value;
    });
  },
  show() {},
  async hubungkan(el, btn) {
    const src = $('[data-src]', el).value.trim();
    if (!src) { toast('Tempel URL atau ID spreadsheet lama.', 'err'); return; }
    setBusy(btn, true, 'Membaca…');
    const res = await api('migrasiInfo', { source: src });
    setBusy(btn, false);
    if (!res.success) { toast(res.message, 'err'); return; }
    this.info = res.data; this.src = src;
    this.info.sheets.forEach((s) => { s._pakai = s.peran !== 'Abaikan' && s.peran !== 'Log' && s.peran !== 'Pengguna'; });
    $('[data-srcname]', el).innerHTML = 'Sumber: <b>' + esc(this.info.source.nama) + '</b> · ' + this.info.sheets.length + ' sheet · zona waktu ' + esc(this.info.source.tz);
    $('[data-s2]', el).hidden = false; $('[data-hasil]', el).hidden = true;
    const adaApp = this.info.sheets.some((s) => s.peran === 'Pengguna');
    $('[data-o="pengguna"]', el).checked = adaApp;
    this.renderSheets(el);
    toast('Spreadsheet terhubung. Periksa pemetaan lalu klik Pindai.', 'info');
  },
  renderSheets(el, bukaMap) {
    const fields = this.info.fields;
    $('[data-sheets]', el).innerHTML = '<div class="tbl-wrap"><table class="tbl compact responsive"><thead><tr><th>Pakai</th><th>Sheet</th><th>Baris</th><th>Dikenali sebagai</th><th>Pemetaan kolom</th></tr></thead><tbody>' +
      this.info.sheets.map((s, i) => {
        const mhs = s.peran === 'Mahasiswa';
        const ringkas = mhs ? Object.keys(s.map).map((f) => '<span class="chip IAT" style="margin:2px">' + esc(LABEL_FIELD[f] || f) + ' ← ' + esc(s.map[f]) + '</span>').join('') : '<span class="muted">Skema app (otomatis)</span>';
        const kurang = mhs ? ['nim', 'nama', 'prodi', 'kelas'].filter((f) => !s.map[f] && !((f === 'kelas' && s.kelas_default) || (f === 'prodi' && s.prodi_default))) : [];
        return `<tr><td><input type="checkbox" data-use data-i="${i}" ${s._pakai ? 'checked' : ''} ${s.peran === 'Abaikan' ? 'disabled' : ''} aria-label="Pakai sheet"></td>
          <td class="nama c-main">${esc(s.nama)}${s.headerRow > 1 ? '<div class="muted" style="font-size:12.5px;font-weight:400">judul kolom di baris ' + s.headerRow + '</div>' : ''}</td>
          <td data-label="Baris">${fmtNum(s.baris)}</td>
          <td data-label="Dikenali sebagai"><select class="input" data-peran data-i="${i}">${PERAN_SHEET.map((p) => '<option' + (p === s.peran ? ' selected' : '') + '>' + p + '</option>').join('')}</select></td>
          <td data-label="Pemetaan" class="c-wide">${ringkas}${kurang.length ? '<div class="reason">Belum terpetakan: ' + kurang.map((f) => LABEL_FIELD[f]).join(', ') + '</div>' : ''}
            ${mhs ? `<div style="margin-top:6px"><button class="btn-link" data-act="map" data-i="${i}">${ic('sliders-horizontal')} Atur kolom</button></div>
            <div data-mapbox="${i}" ${bukaMap === i ? '' : 'hidden'} style="margin-top:12px"><div class="map-grid">${fields.map((f) => `<div class="field"><label>${esc(LABEL_FIELD[f] || f)}</label><select class="input" data-field="${f}" data-i="${i}"><option value="">— tidak ada —</option>${s.headers.map((h) => '<option' + (s.map[f] === h ? ' selected' : '') + '>' + esc(h) + '</option>').join('')}</select></div>`).join('')}
              <div class="field"><label>Kelas bila kolom kosong</label><select class="input" data-kdef data-i="${i}">${optKelas(s.kelas_default, '— tidak ada —')}</select></div>
              <div class="field"><label>Prodi bila kolom kosong</label><select class="input" data-pdef data-i="${i}">${optProdi(s.prodi_default, '— tidak ada —')}</select></div></div>
              ${s.contoh && s.contoh.length ? '<div class="mini">Contoh baris</div><div class="muted mono" style="font-size:12.5px">' + s.contoh.map((c) => esc(Object.values(c).filter(Boolean).join(' · '))).join('<br>') + '</div>' : ''}</div>` : ''}</td></tr>`;
      }).join('') + '</tbody></table></div>';
  },
  async jalankan(el, btn, dry) {
    if (!this.info) return;
    const sheets = this.info.sheets.filter((s) => s._pakai && s.peran !== 'Abaikan').map((s) => ({ nama: s.nama, peran: s.peran, headerRow: s.headerRow, map: s.map, kelas_default: s.kelas_default, prodi_default: s.prodi_default }));
    if (!sheets.length) { toast('Centang minimal satu sheet.', 'err'); return; }
    const opsi = {}; $$('[data-o]', el).forEach((c) => { opsi[c.dataset.o] = c.checked; });
    if (!dry && !(await confirmDialog({ title: 'Jalankan migrasi?', message: 'Data dari <b>' + esc(this.info.source.nama) + '</b> akan ditulis ke database app ini. Spreadsheet lama tidak diubah, dan migrasi aman dijalankan ulang (tanpa data ganda).', ok: 'Jalankan Migrasi' }))) return;
    setBusy(btn, true, dry ? 'Memindai…' : 'Memigrasi…');
    const res = await api(dry ? 'migrasiPindai' : 'migrasiJalankan', { source: this.src, sheets, opsi });
    setBusy(btn, false);
    if (!res.success) { toast(res.message, 'err', 'Migrasi gagal'); return; }
    this.tampilHasil(el, res.data);
    if (!dry) { toast('Migrasi selesai. Memuat ulang data…'); await refreshData(true); }
  },
  tampilHasil(el, r) {
    const box = $('[data-hasil]', el);
    const rows = Object.keys(r.report).map((k) => { const x = r.report[k]; return `<tr><td class="nama c-main">${k}</td><td data-label="Di sumber">${fmtNum(x.sumber || 0)}</td><td data-label="Ditambah"><b style="color:var(--ok-ink)">${fmtNum(x.ditambah)}</b>${x.sintesis ? ' <span class="muted">(' + x.sintesis + ' dari status)</span>' : ''}</td><td data-label="Diperbarui">${fmtNum(x.diperbarui)}</td><td data-label="Dilewati">${fmtNum(x.dilewati)}${x.dilindungi ? ' <span class="muted">(' + x.dilindungi + ' dilindungi)</span>' : ''}${x.tidakValid ? ' <span class="reason">(' + x.tidakValid + ' tidak valid)</span>' : ''}</td></tr>`; }).join('');
    box.innerHTML = `<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px"><h3 class="card-title">${ic(r.dryRun ? 'scan-search' : 'circle-check')} ${r.dryRun ? 'Hasil Pindai (belum ada yang ditulis)' : 'Migrasi selesai'}</h3><span class="pill ${r.dryRun ? 'gold' : 'sek'}">${r.dryRun ? 'Dry-run' : 'Tersimpan'}</span></div>
      <div class="tbl-wrap"><table class="tbl compact responsive"><thead><tr><th>Data</th><th>Di sumber</th><th>Ditambah</th><th>Diperbarui</th><th>Dilewati</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${r.counter && r.counter.length ? `<div class="callout mt"><div class="icon-tile sek">${ic('hash')}</div><div><h4>Counter surat ${r.dryRun ? 'akan' : 'telah'} disesuaikan</h4><p class="mono">${esc(r.counter.join(' · '))}</p></div></div>` : ''}
      ${r.warnings.length ? `<div class="mt"><div class="mini">Peringatan (${r.warnings.length})</div><ul class="warn-list">${r.warnings.map((w) => '<li>' + esc(w) + '</li>').join('')}</ul></div>` : '<p class="muted mt-s">Tidak ada peringatan.</p>'}
      ${r.dryRun ? '<p class="muted" style="margin-bottom:0">Bila angka sudah sesuai, klik <b>Jalankan Migrasi</b>.</p>' : ''}`;
    box.hidden = false;
    hydrateIcons(box);
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});
