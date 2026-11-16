/* ============ PRODUK ============ */
let prodFilter = { q: '', kat: '', b: '', sel: new Set(), page: 1 };
/* Pilihan filter halaman Produk, dikelompokkan. Jumlahnya dihitung langsung, dan pilihan yang jumlahnya 0
 * tidak ditampilkan (kecuali sedang dipilih), jadi daftar ini selalu berisi hal yang memang ada di toko. */
const HARI_LAKU = 30;
// barang dari daftar barcode bawaan yang belum dicek (belum ada harga) punya filter sendiri,
// supaya tidak ikut memenuhi filter lain
const tokoSendiri = p => !p.dariDaftar;
const PROD_FILTERS = [
  { grup: '⚠️ Perlu diperbaiki' },
  {
    v: 'daftar',
    t: '📥 Dari daftar barcode, belum dicek (isi harga)',
    f: p => !!p.dariDaftar
  },
  { v: 'rugi', t: 'Harga jual di bawah modal (rugi)', f: p => isRugi(p) },
  { v: 'noh', t: 'Belum ada harga jual', f: p => tokoSendiri(p) && !priceOf(p, 'umum') },
  { v: 'nohb', t: 'Belum ada harga beli (modal)', f: p => tokoSendiri(p) && !Number(p.hargaBeli) },
  { v: 'hbkira', t: 'Harga beli masih perkiraan (warung − 500)', f: p => tokoSendiri(p) && hbPerkiraan(p) },
  { v: 'cekw', t: '⚙ Harga warung otomatis, belum dicek', f: p => perluCekWarung(p) },
  {
    v: 'nok',
    t: 'Belum ada kategori / masih LAIN-LAIN',
    f: p => tokoSendiri(p) && (!p.kategori || p.kategori === KAT_LAIN)
  },
  { v: 'nob', t: 'Belum ada barcode', f: p => !p.barcode },
  { v: 'isisat', t: '⚖️ Isi satuan belum benar (misal 1 RCG bukan 10 PCS)', f: p => !!rencanaSatuan(p) },
  { grup: '📈 Penjualan {hari} hari terakhir' },
  {
    v: 'laris',
    t: 'Paling laku (urut dari yang paling banyak)',
    f: (p, c) => (c.laku[p.id] || 0) > 0,
    urut: (a, b, c) => (c.laku[b.id] || 0) - (c.laku[a.id] || 0) || a.nama.localeCompare(b.nama)
  },
  { v: 'mati', t: 'Tidak laku sama sekali', f: (p, c) => tokoSendiri(p) && !(c.laku[p.id] > 0) },
  { grup: '🏷️ Jenis barang' },
  { v: 'prio', t: '⭐ Barang prioritas (paling atas saat dicari)', f: p => isPrioritas(p) },
  {
    v: 'material',
    t: '🧱 Barang material (uang Material)',
    f: p => kasProduk(p) === 'material',
    ada: () => uangConf().material !== false
  },
  {
    v: 'hargabaru',
    t: '🏷️ Harga berubah 7 hari (cetak ulang label rak)',
    f: p => Number(p.hargaDiubah) > Date.now() - 7 * 86400000
  },
  {
    v: 'baru',
    t: '🆕 Baru ditambahkan (7 hari)',
    f: p => tokoSendiri(p) && Number(p.dibuat) > Date.now() - 7 * 86400000
  },
  { v: 'off', t: '🚫 Nonaktif (disembunyikan dari kasir)', nonaktif: true }
];
/** Data penjualan untuk filter (hanya dihitung kalau filternya butuh, disimpan sampai ada penjualan baru) */
let _lakuFilter = { key: '', val: null };
function konteksFilterProduk(perluLaku) {
  if (!perluLaku) return { laku: {}, hari: HARI_LAKU };
  const key = S.sales.length + ':' + (S.versiData || 0) + ':' + dayStart(0);
  if (_lakuFilter.key !== key) _lakuFilter = { key, val: lakuPerProduk(HARI_LAKU) };
  return _lakuFilter.val;
}
const cocokKatFilter = (p, kat) => !kat || (kat === '__kosong' ? !p.kategori : p.kategori === kat);
function produkList() {
  const { q, kat, b } = prodFilter;
  const F = PROD_FILTERS.find(x => x.v && x.v === b);
  let list = S.products.filter(p => (F && F.nonaktif ? p.aktif === false : p.aktif !== false));
  if (q) {
    const ids = new Set(searchProducts(q, 100000).map(p => p.id));
    list = list.filter(p => ids.has(p.id));
  }
  if (kat) list = list.filter(p => cocokKatFilter(p, kat));
  const c = konteksFilterProduk(b === 'laris' || b === 'mati');
  if (F && F.f) list = list.filter(p => F.f(p, c));
  return list.sort(F && F.urut ? (x, y) => F.urut(x, y, c) : (x, y) => x.nama.localeCompare(y.nama));
}
/** <option> filter Produk, lengkap dengan jumlah barangnya (ikut kategori yang sedang dipilih) */
function opsiFilterProduk(pilih, kat) {
  const aktif = S.products.filter(p => p.aktif !== false && cocokKatFilter(p, kat));
  const c = konteksFilterProduk(true);
  let html = `<option value="">Semua barang (${rp(aktif.length)})</option>`,
    grup = '',
    isi = '';
  const tutup = () => {
    if (isi) html += `<optgroup label="${esc(grup)}">${isi}</optgroup>`;
    isi = '';
  };
  for (const F of PROD_FILTERS) {
    if (F.grup) {
      tutup();
      grup = F.grup.replace('{hari}', c.hari);
      continue;
    }
    if (F.ada && !F.ada()) continue;
    const n = F.nonaktif
      ? S.products.filter(p => p.aktif === false && cocokKatFilter(p, kat)).length
      : aktif.filter(p => F.f(p, c)).length;
    if (!n && F.v !== pilih) continue;
    isi += `<option value="${F.v}" ${F.v === pilih ? 'selected' : ''}>${esc(F.t)} (${rp(n)})</option>`;
  }
  tutup();
  return html;
}
/** <option> kategori untuk filter Produk: urutan rak warung, dengan ikon & jumlah barang */
function opsiKategoriFilter(pilih) {
  const n = new Map();
  for (const p of S.products)
    if (p.aktif !== false) n.set(p.kategori || '', (n.get(p.kategori || '') || 0) + 1);
  if (pilih && pilih !== '__kosong' && !n.has(pilih)) n.set(pilih, 0);
  const ada = [...n.keys()].filter(Boolean).sort(urutKategori);
  return (
    `<option value="">Semua kategori</option>` +
    ada
      .map(
        c =>
          `<option value="${esc(c)}" ${c === pilih ? 'selected' : ''}>${ikonKategori(c)} ${esc(c)} (${rp(n.get(c))})</option>`
      )
      .join('') +
    (n.get('')
      ? `<option value="__kosong" ${pilih === '__kosong' ? 'selected' : ''}>❔ Belum ada kategori (${rp(n.get(''))})</option>`
      : '')
  );
}
function produkPriceCell(p, t) {
  const v = Number((p.harga || {})[t.id]);
  if (!v) return '<span class="muted">-</span>';
  const hb = Number(p.hargaBeli) || 0;
  const txt = hb && v <= hb ? `<span class="badge bad" title="Tidak untung">${rp(v)}</span>` : rp(v);
  const auto =
    t.id === 'warung' && p.autoWarung
      ? '<span class="autow" title="Diisi otomatis, perlu dicek">⚙ perlu cek</span>'
      : '';
  return txt + auto;
}
function produkUnitsHTML(p) {
  const r = rencanaSatuan(p);
  const cek = r
    ? `<div class="pmeta"><span class="warntxt">⚠️ Isi satuan belum benar</span> · <a href="#" data-fixu="${p.id}">⚖️ Betulkan</a></div>`
    : '';
  return produkUnitsDasar(p) + cek;
}
function produkUnitsDasar(p) {
  if (!(p.units || []).length)
    return `<div class="pmeta muted">satuan: ${esc(p.satuan || 'PCS')} · <a href="#" data-gsu="${p.id}">✏️ ganti</a> · <a href="#" data-addu="${p.id}">+ tambah satuan</a></div>`;
  return `<div class="unitlist">${unitsOf(p)
    .map(
      u =>
        `<span class="uchip ${u.nama === unitScanOf(p) ? 'def' : ''}"><b>${esc(u.nama)}</b>${u.base ? ' <i>dasar</i>' : ` = ${String(r4(u.isi)).replace('.', ',')} ${esc(p.satuan)}`} · ${tiers()
          .map(t => rp(priceUnit(p, u.nama, t.id)))
          .join(
            ' / '
          )}${u.autoWarung ? ' <b class="autow-i" title="Harga warung otomatis, perlu dicek">⚙</b>' : ''}</span>`
    )
    .join('')}</div>`;
}
function produkRowHTML(p) {
  const low = Number(p.stok) <= Number(p.minStok || 0);
  return `<tr>
    <td class="c-cb"><input type="checkbox" data-s="${p.id}" ${prodFilter.sel.has(p.id) ? 'checked' : ''}></td>
    <td class="c-nm">${isPrioritas(p) ? '<span class="prio" title="Barang prioritas: tampil paling atas saat dicari">⭐</span> ' : ''}<b>${esc(p.nama)}</b>${p.kode ? ` <span class="kodebadge" title="Kode singkat">${esc(p.kode)}</span>` : ''}${kasProduk(p) === 'material' ? ' ' + kasPill('material') : ''}${p.alias && p.alias !== p.nama ? `<div class="pmeta muted">${esc(p.alias)}</div>` : ''}${produkUnitsHTML(p)}</td>
    <td class="c-kat hide-m">${p.kategori ? `<span class="kat">${ikonKategori(p.kategori)} ${esc(p.kategori)}</span>` : '<span class="muted">-</span>'}</td>
    <td class="c-bc">${p.barcode ? `<span class="bc">${esc(p.barcode)}</span>` : '<span class="badge warn">belum ada</span>'}</td>
    <td class="c-hb num hide-m muted">${p.hargaBeli ? rp(p.hargaBeli) : '-'}</td>
    ${tiers()
      .map(t => `<td class="c-hr num">${produkPriceCell(p, t)}</td>`)
      .join('')}
    <td class="c-st num">${low ? `<span class="badge bad">${rp(p.stok)}</span> <span class="muted" style="font-size:12px">${esc(p.satuan || '')}</span>` : fmtStok(p)}</td>
    <td class="c-act"><button class="btn sm ghost" data-e="${p.id}">Ubah</button></td></tr>`;
}
views.produk = () => {
  // datang dari Beranda / pemberitahuan: langsung pakai filter yang diminta, di semua kategori
  if (S._prodFilter) {
    Object.assign(prodFilter, { b: S._prodFilter, kat: '', q: '', page: 1 });
    S._prodFilter = '';
  }
  const nCek = S.products.filter(p => p.aktif !== false && perluCekWarung(p)).length;
  $('#main').innerHTML = `<div class="card">
   <div class="row" style="margin-bottom:12px"><h2 class="grow" style="margin:0">Produk <span class="muted" style="font-size:16px">(${S.products.filter(p => p.aktif !== false).length})</span></h2>
   <button class="btn pri" id="addP">➕ Tambah produk</button><button class="btn ghost" id="lblBtn">🏷️ Cetak label <span>(<span class="selN">0</span>)</span></button><button class="btn ghost" id="katBtn">🗂️ Ubah kategori <span>(<span class="selN">0</span>)</span></button><button class="btn ghost" id="genBtn">🔢 Buat barcode utk yg kosong</button><button class="btn ghost" id="offBtn"><span class="offLbl">🚫 Nonaktifkan</span> <span>(<span class="selN">0</span>)</span></button></div>
   ${nCek ? `<div class="banner row" style="gap:10px"><span class="grow">⚙ <b>${rp(nCek)}</b> produk punya harga warung yang diisi otomatis. Cek sebentar, kalau sudah benar tinggal tandai ✔.</span><button class="btn sm pri" id="cekW">Cek harga warung</button></div>` : ''}
   <div class="row filterbar"><div class="grow searchbox"><input id="pq" placeholder="Cari nama / alias / barcode…" value="${esc(prodFilter.q)}" autocomplete="off"><button id="pqX" class="clearx ${prodFilter.q ? '' : 'hide'}" type="button" title="Hapus">✕</button></div>
   <select id="pk" title="Kategori barang">${opsiKategoriFilter(prodFilter.kat)}</select>
   <select id="pb" title="Saring barang"></select>
   <select id="pper" title="Jumlah produk per halaman">${[10, 20, 50, 100, 0].map(n => `<option value="${n}" ${Number(settings().prodPer ?? 20) === n ? 'selected' : ''}>Tampilkan ${n || 'semua'}</option>`).join('')}</select></div>
   <div class="tablewrap"><table class="zebra ptable"><thead><tr><th class="c-cb"><input type="checkbox" id="selAll" title="Centang semua di halaman ini"></th><th class="c-nm">Nama produk</th><th class="c-kat hide-m">Kategori</th><th class="c-bc">Barcode</th><th class="c-hb num hide-m">Harga beli</th>${tiers()
     .map(t => `<th class="c-hr num">${esc(t.nama)}</th>`)
     .join(
       ''
     )}<th class="c-st num">Stok</th><th class="c-act"></th></tr></thead><tbody id="pt"></tbody></table></div><div class="pager" id="pgr"></div></div>`;
  const colCount = 7 + tiers().length;
  const syncSel = () => $$('.selN').forEach(x => (x.textContent = prodFilter.sel.size));
  $('#pb').innerHTML = opsiFilterProduk(prodFilter.b, prodFilter.kat);
  const draw = () => {
    const q = $('#pq').value.trim().toLowerCase(),
      k = $('#pk').value,
      b = $('#pb').value;
    if (prodFilter.q !== q || prodFilter.kat !== k || prodFilter.b !== b) prodFilter.page = 1;
    Object.assign(prodFilter, { q, kat: k, b });
    // jumlah di pilihan kategori & filter ikut diperbarui (misal setelah barang diubah)
    $('#pk').innerHTML = opsiKategoriFilter(k);
    $('#pb').innerHTML = opsiFilterProduk(b, k);
    $('.offLbl').textContent = b === 'off' ? '✅ Aktifkan lagi' : '🚫 Nonaktifkan';
    const list = produkList();
    const per = Number(settings().prodPer ?? 20);
    const pages = per ? Math.max(1, Math.ceil(list.length / per)) : 1;
    prodFilter.page = Math.min(Math.max(1, prodFilter.page || 1), pages);
    const from = per ? (prodFilter.page - 1) * per : 0;
    const shown = per ? list.slice(from, from + per) : list;
    const raw = $('#pq').value.trim();
    // salah ketik: tawarkan barang yang mirip sebelum tombol tambah produk
    const mirip = !shown.length && raw ? cariMirip(raw, [], 6) : [];
    $('#pt').innerHTML =
      shown.map(produkRowHTML).join('') ||
      `<tr><td colspan="${colCount}" class="empty">${raw ? `Produk “${esc(raw)}” belum ada.${mirip.length ? `<div class="miriplist"><div class="muted">🔎 Mungkin maksudnya:</div>${mirip.map(p => `<button class="btn ghost sm" data-mirip="${p.id}">${esc(p.nama)}</button>`).join('')}</div>` : '<br>'}<button class="btn pri" data-addq style="margin-top:10px">➕ Tambah produk “${esc(raw.toUpperCase())}”</button>` : 'Tidak ada produk.'}</td></tr>`;
    $$('[data-mirip]', $('#pt')).forEach(
      x =>
        (x.onclick = () => {
          const p = S.products.find(y => y.id === x.dataset.mirip);
          if (!p) return;
          $('#pq').value = p.nama;
          $('#pqX').classList.remove('hide');
          draw();
        })
    );
    $$('[data-e]', $('#pt')).forEach(
      x =>
        (x.onclick = () =>
          editProduct(
            S.products.find(p => p.id === x.dataset.e),
            null,
            draw
          ))
    );
    const addq = $('[data-addq]', $('#pt'));
    if (addq)
      addq.onclick = () =>
        editProduct(null, presetFrom(raw), p => {
          if (p) {
            $('#pq').value = p.nama;
            $('#pqX').classList.remove('hide');
          }
          draw();
        });
    $$('[data-fixu]', $('#pt')).forEach(
      x =>
        (x.onclick = e => {
          e.preventDefault();
          const p = S.products.find(y => y.id === x.dataset.fixu);
          p && betulkanSatuanDialog(p, draw);
        })
    );
    $$('[data-gsu]', $('#pt')).forEach(
      x =>
        (x.onclick = e => {
          e.preventDefault();
          const p = S.products.find(y => y.id === x.dataset.gsu);
          p && gantiSatuanDialog(p, p.satuan, draw);
        })
    );
    $$('[data-addu]', $('#pt')).forEach(
      x =>
        (x.onclick = e => {
          e.preventDefault();
          quickUnitDialog(
            S.products.find(p => p.id === x.dataset.addu),
            draw
          );
        })
    );
    $$('[data-s]', $('#pt')).forEach(
      x =>
        (x.onchange = () => {
          x.checked ? prodFilter.sel.add(x.dataset.s) : prodFilter.sel.delete(x.dataset.s);
          syncSel();
        })
    );
    $('#selAll').checked = shown.length > 0 && shown.every(p => prodFilter.sel.has(p.id));
    $('#selAll').onchange = e => {
      shown.forEach(p => (e.target.checked ? prodFilter.sel.add(p.id) : prodFilter.sel.delete(p.id)));
      draw();
    };
    syncSel();
    $('#pgr').innerHTML = list.length
      ? `<span class="muted">Menampilkan <b style="color:var(--ink)">${rp(from + 1)}–${rp(from + shown.length)}</b> dari <b style="color:var(--ink)">${rp(list.length)}</b> produk</span><span class="grow"></span>${pages > 1 ? `<button class="btn ghost" data-pg="1" ${prodFilter.page === 1 ? 'disabled' : ''}>⏮</button><button class="btn pri" data-pg="${prodFilter.page - 1}" ${prodFilter.page === 1 ? 'disabled' : ''}>◀ Sebelumnya</button><b style="font-size:17px;padding:0 6px">Hal ${prodFilter.page} / ${pages}</b><button class="btn pri" data-pg="${prodFilter.page + 1}" ${prodFilter.page === pages ? 'disabled' : ''}>Berikutnya ▶</button><button class="btn ghost" data-pg="${pages}" ${prodFilter.page === pages ? 'disabled' : ''}>⏭</button>` : ''}`
      : '';
    $$('[data-pg]', $('#pgr')).forEach(
      x =>
        (x.onclick = () => {
          prodFilter.page = +x.dataset.pg;
          draw();
          $('#pt').closest('.tablewrap').scrollTop = 0;
        })
    );
  };
  const selected = () => [...prodFilter.sel].map(id => S.products.find(p => p.id === id)).filter(Boolean);
  $('#pper').onchange = async () => {
    settings().prodPer = Number($('#pper').value);
    await saveMeta('settings');
    prodFilter.page = 1;
    draw();
  };
  addScrollPad($('#pt').closest('.tablewrap'));
  $('#pq').oninput = () => {
    $('#pqX').classList.toggle('hide', !$('#pq').value);
    draw();
  };
  $('#pqX').onclick = () => {
    $('#pq').value = '';
    $('#pqX').classList.add('hide');
    draw();
    $('#pq').focus();
  };
  $('#pq').onkeydown = e => {
    if (e.key === 'Escape' && $('#pq').value) {
      e.stopPropagation();
      $('#pqX').click();
    }
  };
  $('#pk').onchange = draw;
  $('#pb').onchange = draw;
  $('#cekW') && ($('#cekW').onclick = () => cekWarungDialog(render));
  $('#addP').onclick = () => editProduct(null, null, draw);
  $('#lblBtn').onclick = () => labelDialog(selected());
  $('#katBtn').onclick = () => bulkCategoryDialog(selected(), render);
  // sembunyikan banyak barang sekaligus (misal barang dari daftar barcode yang tidak dijual), atau aktifkan lagi
  $('#offBtn').onclick = async () => {
    const sel = selected();
    const aktifkan = prodFilter.b === 'off';
    if (!sel.length) return toast('Centang dulu barangnya', true);
    if (
      !(await confirmBox(
        aktifkan
          ? `Aktifkan lagi ${sel.length} barang?`
          : `Nonaktifkan ${sel.length} barang? Barangnya tidak muncul di kasir, tapi datanya tetap ada dan bisa diaktifkan lagi.`,
        aktifkan ? 'Aktifkan' : 'Nonaktifkan'
      ))
    )
      return;
    sel.forEach(p => {
      p.aktif = aktifkan;
      p.diubah = Date.now();
    });
    await DB.putMany('products', sel);
    markDirty();
    prodFilter.sel.clear();
    toast(`${sel.length} barang ${aktifkan ? 'diaktifkan lagi' : 'dinonaktifkan'} ✔`);
    draw();
  };
  $('#genBtn').onclick = async () => {
    const sel = selected().filter(p => !p.barcode);
    if (!sel.length) return toast('Centang dulu produk yang belum punya barcode', true);
    if (!(await confirmBox(`Buat barcode toko untuk ${sel.length} produk?`, 'Buat'))) return;
    for (const p of sel) p.barcode = await newBarcode();
    await DB.putMany('products', sel);
    markDirty();
    draw();
    toast('Barcode dibuat ✔ Sekarang bisa cetak label.');
  };
  draw();
};
/** Ubah kategori banyak produk sekaligus (produk yang dicentang) */
function bulkCategoryDialog(list, after) {
  if (!list.length) return toast('Centang dulu produk yang mau diubah kategorinya', true);
  const m = modal(
    `<h3>🗂️ Ubah kategori ${list.length} produk</h3>
   <p class="muted" style="margin-top:0">${list
     .slice(0, 6)
     .map(p => esc(p.nama))
     .join(', ')}${list.length > 6 ? ` dan ${list.length - 6} lainnya` : ''}</p>
   <label>Pindahkan ke kategori</label><select id="bk">${opsiKategori(list.every(p => p.kategori === list[0].kategori) ? list[0].kategori : '')}<option value="__new">➕ Kategori baru…</option></select>
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="bkok">Simpan</button></div>`
  );
  selectOrNew($('#bk', m), 'Nama kategori baru:');
  $('#bkok', m).onclick = async () => {
    const k = $('#bk', m).value;
    if (!k || k === '__new') return toast('Pilih kategori', true);
    list.forEach(p => {
      p.kategori = k.toUpperCase();
      p.diubah = Date.now();
    });
    await DB.putMany('products', list);
    markDirty();
    prodFilter.sel.clear();
    m.close();
    toast(`Kategori ${list.length} produk diubah ke ${k.toUpperCase()} ✔`);
    after && after();
  };
}
/** Daftar harga warung yang diisi otomatis: cek, ubah kalau perlu, lalu tandai benar */
function cekWarungDialog(after) {
  const rows = () =>
    S.products
      .filter(p => p.aktif !== false && perluCekWarung(p))
      .sort((a, b) => a.nama.localeCompare(b.nama))
      .flatMap(p =>
        unitsOf(p)
          .filter(u => (u.base ? p.autoWarung : (p.units.find(x => x.nama === u.nama) || {}).autoWarung))
          .map(u => ({ p, unit: u.nama, base: !!u.base }))
      );
  let page = 1,
    q = '';
  const PER = 40;
  const m = modal(
    `<h3>⚙ Cek harga warung otomatis</h3>
   <p class="muted" style="margin-top:0">Harga warung di bawah ini diisi otomatis: <b>harga perorangan − ${rp(autoWarung().selisih)}</b>, dengan <b>untung minimal ${rp(autoWarung().untungMin)}</b> dari harga beli. Kalau sudah benar tekan <b>✔</b>. Kalau belum, ketik harga yang benar lalu tekan <b>Enter</b> (langsung tersimpan dan ditandai benar).</p>
   <div class="row" style="margin-bottom:8px"><input id="cwq" class="grow" placeholder="Cari nama barang…" autocomplete="off" style="max-width:420px"><span class="grow"></span><button class="btn ok" id="cwAll">✔ Semua di halaman ini sudah benar</button></div>
   <div class="tablewrap" style="max-height:56vh"><table class="zebra cwtable"><thead><tr><th>Barang</th><th class="num">Harga beli</th><th class="num">Harga perorangan</th><th class="num">Harga warung</th><th class="num">Untung</th><th></th></tr></thead><tbody id="cwb"></tbody></table></div>
   <div class="row actbar"><span id="cwInfo" class="muted grow"></span><button class="btn ghost" id="cwPrev">◀</button><button class="btn ghost" id="cwNext">▶</button><button class="btn pri" data-close>Selesai</button></div>`,
    { wide: true, onClose: () => after && after() }
  );
  const priceOfRow = r => (r.base ? r.p.harga : r.p.units.find(u => u.nama === r.unit).harga);
  const saveRow = async (r, val) => {
    const h = priceOfRow(r);
    if (val && val !== h.warung) r.p.hargaDiubah = Date.now();
    if (val) h.warung = val;
    tandaiWarungBenar(r.p, r.base ? r.p.satuan : r.unit);
    r.p.diubah = Date.now();
    await save('products', r.p);
  };
  const draw = () => {
    let L = rows();
    if (q) L = L.filter(r => (r.p.nama + ' ' + (r.p.alias || '')).toLowerCase().includes(q));
    const pages = Math.max(1, Math.ceil(L.length / PER));
    page = Math.min(page, pages);
    const shown = L.slice((page - 1) * PER, page * PER);
    $('#cwInfo', m).textContent = L.length
      ? `${rp(L.length)} harga perlu dicek · halaman ${page}/${pages}`
      : 'Semua harga warung sudah dicek ✔';
    $('#cwb', m).innerHTML =
      shown
        .map((r, i) => {
          const h = priceOfRow(r);
          const hb = hbUnit(r.p, r.unit);
          const w = Number(h.warung) || 0;
          const untung = hb ? w - hb : null;
          return `<tr><td><b>${esc(r.p.nama)}</b><div class="pmeta muted">per ${esc(r.unit)}</div></td><td class="num">${hb ? rp(hb) : '<span class="badge warn">kosong</span>'}</td><td class="num">${rp(h.umum)}</td>
          <td class="num"><input data-cw="${i}" inputmode="numeric" value="${rp(w)}" class="cwin"></td>
          <td class="num">${untung === null ? '<span class="muted">?</span>' : `<span class="${untung < autoWarung().untungMin ? 'badge bad' : 'okc'}">${rp(untung)}</span>`}</td>
          <td class="right"><button class="btn sm ok" data-ok="${i}" title="Sudah benar">✔</button></td></tr>`;
        })
        .join('') || '<tr><td colspan="6" class="empty">Tidak ada yang perlu dicek 👍</td></tr>';
    $$('[data-ok]', m).forEach(
      b =>
        (b.onclick = async () => {
          const r = shown[+b.dataset.ok];
          await saveRow(r, num($(`[data-cw="${b.dataset.ok}"]`, m).value));
          draw();
        })
    );
    $$('[data-cw]', m).forEach(inp => {
      inp.onfocus = () => inp.select();
      inp.onkeydown = async e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const i = +inp.dataset.cw;
        const v = num(inp.value);
        if (!v) return toast('Isi harga warung', true);
        await saveRow(shown[i], v);
        draw();
        const next = $(`[data-cw="${i}"]`, m);
        next && next.focus();
      };
    });
    $('#cwPrev', m).disabled = page <= 1;
    $('#cwNext', m).disabled = page >= pages;
    $('#cwAll', m).onclick = async () => {
      if (!shown.length) return;
      if (!(await confirmBox(`Tandai ${shown.length} harga warung di halaman ini sudah benar?`, 'Ya, benar')))
        return;
      for (let i = 0; i < shown.length; i++) {
        const inp = $(`[data-cw="${i}"]`, m);
        await saveRow(shown[i], inp ? num(inp.value) : 0);
      }
      draw();
      toast('Ditandai benar ✔');
    };
  };
  $('#cwq', m).oninput = e => {
    q = e.target.value.trim().toLowerCase();
    page = 1;
    draw();
  };
  $('#cwPrev', m).onclick = () => {
    page--;
    draw();
  };
  $('#cwNext', m).onclick = () => {
    page++;
    draw();
  };
  draw();
}
const SATUAN_LIST = [
  'PCS',
  'RCG',
  'SETENGAH',
  'BKS',
  'BTL',
  'DUS',
  'KTN',
  'PAK',
  'PACK',
  'SLOP',
  'BOX',
  'LUSIN',
  'KG',
  'ONS',
  'LITER',
  'KLG',
  'SACHET',
  'STRIP',
  'POUCH',
  'TOPLES',
  'BAG',
  'IKAT'
];
function satuanOptions(cur) {
  const all = [
    ...new Set([
      ...SATUAN_LIST,
      ...S.products.flatMap(p => [p.satuan, ...(p.units || []).map(u => u.nama)]).filter(Boolean)
    ])
  ];
  return (
    all.map(s => `<option value="${esc(s)}" ${s === cur ? 'selected' : ''}>${esc(s)}</option>`).join('') +
    '<option value="__new">➕ Satuan lain…</option>'
  );
}
function selectOrNew(sel, label) {
  sel.addEventListener('change', async () => {
    if (sel.value !== '__new') return;
    const v = prompt(label);
    if (v && v.trim()) {
      const n = v.trim().toUpperCase();
      if (![...sel.options].some(o => o.value === n)) {
        const o = new Option(n, n);
        sel.insertBefore(o, sel.lastElementChild);
      }
      sel.value = n;
    } else sel.selectedIndex = 0;
  });
}
function tierPlaceholder(tierId) {
  if (tierId === 'umum') return '';
  return tierId === 'warung' && autoWarung().aktif ? 'kosong = otomatis' : 'kosong = sama dgn Umum';
}
/** Di form produk, harga perorangan & warung saling mengisi sampai salah satunya diketik sendiri:
 *  isi perorangan dulu -> warung = perorangan − 500 (untung minimal tetap dijaga)
 *  isi warung dulu     -> perorangan = warung + 500 */
function liveHargaFill(m, p) {
  const wInp = $('[data-bt=warung]', m),
    uInp = $('[data-bt=umum]', m),
    hbInp = $('#fhb', m),
    hint = $('#fwHint', m);
  if (!wInp || !uInp || !autoWarung().aktif) return;
  const A = autoWarung();
  let uSendiri = !!uInp.value,
    wSendiri = !!(wInp.value && !p.autoWarung);
  uInp.placeholder = 'atau isi harga warung dulu';
  const dariPerorangan = () => {
    if (wSendiri) return;
    const v = hitungHargaWarung(num(uInp.value), num(hbInp.value));
    wInp.value = v ? rp(v) : '';
    hint.innerHTML = v
      ? `⚙ Harga warung diisi otomatis (perorangan − ${rp(A.selisih)}, untung minimal ${rp(A.untungMin)}). Ganti kalau belum pas.`
      : '';
  };
  const dariWarung = () => {
    if (uSendiri) return;
    const w = num(wInp.value);
    uInp.value = w ? rp(w + (Number(A.selisih) || 0)) : '';
    hint.innerHTML = w
      ? `⚙ Harga perorangan diisi otomatis (warung + ${rp(A.selisih)}). Ganti kalau belum pas.`
      : '';
  };
  uInp.addEventListener('input', () => {
    uSendiri = !!uInp.value;
    dariPerorangan();
  });
  wInp.addEventListener('input', () => {
    wSendiri = !!wInp.value;
    dariWarung();
  });
  hbInp.addEventListener('input', dariPerorangan);
  if (uInp.value) dariPerorangan();
}
function editProduct(p, preset, after) {
  const isNew = !p;
  p = p
    ? JSON.parse(JSON.stringify(p))
    : {
        id: uid(),
        nama: '',
        alias: '',
        kategori: '',
        satuan: 'PCS',
        barcode: '',
        harga: {},
        hargaBeli: 0,
        stok: 0,
        minStok: 0,
        aktif: true,
        units: [],
        ...(preset || {})
      };
  const units = (p.units || []).map(u => ({ ...u, harga: { ...(u.harga || {}) } }));
  // barang tanpa kategori: kategorinya ditebak dari nama (tersimpan setelah tombol Simpan)
  const katKosong = !p.kategori;
  if (katKosong && p.nama) p.kategori = kategoriOtomatis(p);
  const m = modal(
    `<h3>${isNew ? 'Tambah produk' : 'Ubah produk'}</h3>
   <label>Nama produk *</label><input id="fn" value="${esc(p.nama)}" autofocus>
   <label>Nama lain / alias (istilah sehari-hari, boleh bahasa Sunda)</label><input id="fa" value="${esc(p.alias || '')}">
   <div class="grid2"><div><label>Kode singkat (opsional)</label><input id="fkd" value="${esc(p.kode || '')}" placeholder="contoh: IDG, GGS16" autocomplete="off" style="text-transform:uppercase"><div class="subhint">Ketik kode lalu Enter di kasir, barang langsung masuk.</div></div>
   <div><label>Singkatan otomatis</label><div class="autokode" id="fsk"></div><div class="subhint">Tanpa diisi pun barang bisa dicari dengan singkatan ini.</div></div></div>
   <label>Barcode</label><div class="row"><input id="fb" class="grow" value="${esc(p.barcode || '')}" placeholder="scan di sini, atau klik Buat"><button class="btn ghost" id="fcari" title="Cari nama barang dari barcode">🔎 Cari nama</button><button class="btn ghost" id="fgen">🔢 Buat</button></div><div id="fbHint" class="autohint"></div>
   ${(p.barcode2 || []).length ? `<div class="muted" style="font-size:13px;margin-top:4px">Kode tambahan: ${p.barcode2.map(esc).join(', ')}</div>` : ''}
   <div class="grid2"><div><label>Kategori</label><select id="fk"><option value="">— pilih kategori —</option>${opsiKategori(p.kategori)}<option value="__new">➕ Kategori baru…</option></select></div>
   <div><label>Satuan dasar (satuan terkecil yang dijual)</label><select id="fs">${satuanOptions(p.satuan || 'PCS')}</select></div></div>
   ${uangConf().material !== false ? `<label>Uang penjualannya masuk ke</label><div class="kaspick" id="fkas">${['warung', 'material'].map(k => `<button type="button" data-fk="${k}" style="--kc:${infoKas(k).warna}">${infoKas(k).ikon} Laci ${esc(infoKas(k).nama)}${k === 'material' ? ' (toko bangunan)' : ''}</button>`).join('')}</div>` : ''}
   <h3 style="margin-top:16px">Harga per <span id="baseLbl">${esc(p.satuan || 'PCS')}</span></h3>
   <div class="grid3"><div><label>Harga beli (modal)</label><input id="fhb" inputmode="numeric" value="${hbAsli(p) ? rp(p.hargaBeli) : ''}" placeholder="${hbPerkiraan(p) ? 'perkiraan ' + rp(p.hargaBeli) + ' (warung − 500)' : 'kosong = warung − 500'}"></div>
   ${tiers()
     .map(
       t =>
         `<div><label>Harga ${esc(t.nama)}${t.id === 'umum' ? ' *' : ''}</label><input data-bt="${t.id}" inputmode="numeric" value="${(p.harga || {})[t.id] ? rp(p.harga[t.id]) : ''}" placeholder="${tierPlaceholder(t.id)}"></div>`
     )
     .join('')}</div><div id="fwHint" class="autohint"></div>
   <div class="unitbox"><h3 style="margin:0 0 4px">Satuan lain <span class="muted" style="font-size:14px;font-weight:400">(opsional)</span></h3>
     <p class="muted" style="font-size:13px;margin:0 0 8px">Contoh Beng-Beng Drink: satuan dasar <b>PCS</b>, satuan lain <b>RCG isi 10</b>. Di kasir satuannya bisa diganti, stok tetap dihitung dalam satuan dasar.</p>
     <div id="uRows"></div>
     <div class="row" style="margin-top:8px"><button class="btn ghost sm" id="uAdd">➕ Tambah satuan</button><button class="btn ghost sm" id="uFrom">🔗 Gabungkan dari produk lain</button></div>
     <label>Saat barcode di-scan, pakai satuan</label><select id="fus" style="max-width:260px"></select></div>
   <div class="grid2"><div><label>Stok sekarang (dalam <span class="bLbl">${esc(p.satuan || 'PCS')}</span>)</label><input id="fst" inputmode="decimal" value="${p.stok ?? 0}"></div><div><label>Batas stok menipis</label><input id="fmn" inputmode="decimal" value="${p.minStok || 0}"></div></div>
   <label><input type="checkbox" id="fak" ${p.aktif !== false ? 'checked' : ''}> Produk aktif (tampil di kasir)</label>
   <label><input type="checkbox" id="fprio" ${isPrioritas(p) ? 'checked' : ''}> ⭐ Barang prioritas: tampil paling atas saat dicari <span class="muted" style="font-size:13px">${prioritasCocok(p).length ? '(otomatis dari kata kunci: ' + prioritasCocok(p).map(esc).join(', ') + ')' : ''}</span></label>
   <div class="row actbar">${!isNew ? `<button class="btn bad" id="fdel">Hapus</button>` : ''}<span class="grow muted" style="font-size:13px">Tekan <b>Enter</b> untuk menyimpan</span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="fsave">💾 Simpan (Enter)</button></div>`,
    { wide: true }
  );
  m.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing || e.shiftKey) return;
    const t = e.target;
    if (!t || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.tagName === 'A') return;
    if (t.id === 'fb' || t.matches('[data-ub]')) return;
    e.preventDefault();
    $('#fsave', m).click();
  });
  const drawSingkat = () => {
    const s = singkatanNama($('#fn', m).value);
    $('#fsk', m).innerHTML = s.huruf
      ? `<b>${esc(s.huruf.toUpperCase())}</b>${s.lengkap !== s.huruf ? ` atau <b>${esc(s.lengkap.toUpperCase())}</b>` : ''}`
      : '<span class="muted">-</span>';
  };
  $('#fn', m).addEventListener('input', drawSingkat);
  drawSingkat();
  // laci uang: barang baru ditebak dari nama (semen, pasir, besi -> Material), bisa diganti
  let kasPilih = isNew ? (tebakMaterial(p) ? 'material' : 'warung') : kasProduk(p),
    kasManual = !isNew;
  const drawKas = () => $$('[data-fk]', m).forEach(b => b.classList.toggle('on', b.dataset.fk === kasPilih));
  $$('[data-fk]', m).forEach(
    b =>
      (b.onclick = () => {
        kasPilih = b.dataset.fk;
        kasManual = true;
        drawKas();
      })
  );
  $('#fn', m).addEventListener('input', () => {
    if (kasManual) return;
    kasPilih = tebakMaterial({ nama: $('#fn', m).value, kategori: $('#fk', m).value })
      ? 'material'
      : 'warung';
    drawKas();
  });
  drawKas();
  selectOrNew($('#fk', m), 'Nama kategori baru:');
  // kategori ikut ditebak dari nama yang diketik, sampai kategorinya dipilih sendiri
  let katManual = !katKosong;
  const kasIkutKategori = () => {
    if (kasManual) return;
    kasPilih = tebakMaterial({ nama: $('#fn', m).value, kategori: $('#fk', m).value })
      ? 'material'
      : 'warung';
    drawKas();
  };
  $('#fk', m).addEventListener('change', () => {
    katManual = true;
    kasIkutKategori();
  });
  const tebakKat = () => {
    if (katManual) return;
    const k = kategoriOtomatis({ nama: $('#fn', m).value, alias: $('#fa', m).value });
    if (k && [...$('#fk', m).options].some(o => o.value === k)) $('#fk', m).value = k;
    kasIkutKategori();
  };
  $('#fn', m).addEventListener('input', tebakKat);
  $('#fa', m).addEventListener('input', tebakKat);
  selectOrNew($('#fs', m), 'Nama satuan baru (misal: RCG, DUS):');
  $('#fs', m).addEventListener('change', () => {
    const v = $('#fs', m).value;
    if (v !== '__new') {
      $('#baseLbl', m).textContent = v;
      $$('.bLbl', m).forEach(x => (x.textContent = v));
      drawUnits();
    }
  });
  const readUnits = () => {
    $$('[data-ur]', m).forEach(row => {
      const u = units[+row.dataset.ur];
      if (!u) return;
      u.nama = $('[data-un]', row).value;
      u._dir = $('[data-ud]', row).value;
      u._n = num($('[data-ui]', row).value);
      u.isi = u._n > 0 ? (u._dir === 'kecil' ? r4(1 / u._n) : u._n) : 0;
      u.hargaBeli = num($('[data-uhb]', row).value) || 0;
      u.barcode = $('[data-ub]', row).value.trim();
      u.harga = {};
      $$('[data-ut]', row).forEach(i => {
        const v = num(i.value);
        if (v) u.harga[i.dataset.ut] = v;
      });
    });
  };
  const drawUnits = () => {
    const base = $('#fs', m).value;
    $('#uRows', m).innerHTML =
      units
        .map(
          (u, i) => `<div class="urow" data-ur="${i}">
      <div class="row" style="align-items:flex-end;gap:8px"><div style="flex:1 1 120px"><label>Satuan</label><select data-un>${satuanOptions(u.nama || 'RCG')}</select></div>
      <div style="flex:2 1 260px"><label>Isinya</label><div class="row" style="gap:6px;flex-wrap:nowrap"><select data-ud style="flex:1 1 auto"><option value="besar" ${u._dir !== 'kecil' && !(u.isi > 0 && u.isi < 1) ? 'selected' : ''}>1 ${esc(u.nama || '?')} =</option><option value="kecil" ${u._dir === 'kecil' || (u.isi > 0 && u.isi < 1) ? 'selected' : ''}>1 ${esc(base)} =</option></select><input data-ui inputmode="decimal" style="width:90px" value="${u._n || (u.isi > 0 ? (u.isi < 1 ? r4(1 / u.isi) : u.isi) : '')}" placeholder="10"><span data-ul style="white-space:nowrap;font-weight:600">${u._dir === 'kecil' || (u.isi > 0 && u.isi < 1) ? esc(u.nama || '?') : esc(base)}</span></div></div>
      <div style="flex:2 1 200px"><label>Barcode khusus satuan ini (opsional)</label><input data-ub value="${esc(u.barcode || '')}" placeholder="kosongkan kalau sama"></div>
      <button class="btn sm bad" data-ux="${i}" title="Hapus satuan">✕</button></div>
      <div class="row" style="gap:8px"><div style="flex:1 1 130px"><label>Harga beli (modal) / ${esc(u.nama || '')}</label><input data-uhb inputmode="numeric" value="${u.hargaBeli ? rp(u.hargaBeli) : ''}" placeholder="opsional"></div>${tiers()
        .map(
          t =>
            `<div style="flex:1 1 130px"><label>Harga ${esc(t.nama)} / ${esc(u.nama || '')}</label><input data-ut="${t.id}" inputmode="numeric" value="${u.harga && u.harga[t.id] ? rp(u.harga[t.id]) : ''}" placeholder="${t.id === 'umum' ? 'wajib diisi' : tierPlaceholder(t.id)}"></div>`
        )
        .join('')}</div>
      ${u.mergeFrom ? `<div class="muted" style="font-size:12px;margin-top:4px">🔗 Digabung dari: ${esc((S.products.find(x => x.id === u.mergeFrom) || {}).nama || '')}</div>` : ''}</div>`
        )
        .join('') || '<div class="muted" style="font-size:14px">Belum ada satuan lain.</div>';
    $$('[data-un]', m).forEach(s => {
      selectOrNew(s, 'Nama satuan baru:');
      s.addEventListener('change', () => {
        if (s.value !== '__new') {
          readUnits();
          drawUnits();
        }
      });
    });
    $$('[data-ud]', m).forEach(
      s =>
        (s.onchange = () => {
          readUnits();
          drawUnits();
        })
    );
    const us = $('#fus', m);
    if (us) {
      const cur = us.value || p.unitScan || base;
      us.innerHTML = [base, ...units.map(u => u.nama).filter(n => n && n !== '__new')]
        .map(n => `<option ${n === cur ? 'selected' : ''}>${esc(n)}</option>`)
        .join('');
    }
    $$('[data-ux]', m).forEach(
      b =>
        (b.onclick = () => {
          readUnits();
          units.splice(+b.dataset.ux, 1);
          drawUnits();
        })
    );
  };
  drawUnits();
  liveHargaFill(m, p);
  $('#uAdd', m).onclick = () => {
    readUnits();
    const b = $('#fs', m).value;
    units.push({
      nama: b === 'PCS' ? 'RCG' : 'PCS',
      isi: 0,
      _dir: b === 'PCS' ? 'besar' : 'kecil',
      harga: {},
      barcode: ''
    });
    drawUnits();
  };
  $('#uFrom', m).onclick = () => {
    readUnits();
    const pm = modal(
      `<h3>Gabungkan dari produk lain</h3><p class="muted" style="margin-top:0">Pilih produk yang sebenarnya satuan lain dari barang ini (misal versi RCG / DUS / SLOP). Harga & barcodenya dipindahkan ke sini, lalu produk itu dinonaktifkan.</p><input id="mq" placeholder="cari nama produk…" autofocus><div id="ml" style="max-height:300px;overflow:auto"></div><div class="right" style="margin-top:10px"><button class="btn ghost" data-close>Tutup</button></div>`
    );
    $('#mq', pm).oninput = e => {
      const r = searchProducts(e.target.value, 15).filter(x => x.id !== p.id);
      $('#ml', pm).innerHTML = r
        .map(
          x =>
            `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)"><div class="grow"><b>${esc(x.nama)}</b><br><span class="muted" style="font-size:13px">${esc(x.satuan || '')} · Rp ${rp(priceOf(x, 'umum'))}${x.barcode ? ' · ' + esc(x.barcode) : ''}</span></div><button class="btn sm pri" data-pk="${x.id}">Pilih</button></div>`
        )
        .join('');
      $$('[data-pk]', pm).forEach(
        b =>
          (b.onclick = () => {
            const x = S.products.find(y => y.id === b.dataset.pk);
            units.push({
              nama: x.satuan && x.satuan !== $('#fs', m).value ? x.satuan : 'RCG',
              isi: 0,
              _dir: priceOf(x, 'umum') < priceOf(p, 'umum') ? 'kecil' : 'besar',
              harga: { ...(x.harga || {}) },
              hargaBeli: Number(x.hargaBeli) || 0,
              barcode: x.barcode || '',
              mergeFrom: x.id
            });
            pm.close();
            drawUnits();
            toast('Isi kolom "Isi" untuk satuan ini (misal 1 RCG = 10 PCS)');
          })
      );
    };
  };
  $('#fgen', m).onclick = async () => {
    if ($('#fb', m).value && !(await confirmBox('Ganti barcode yang sudah ada?', 'Ganti'))) return;
    $('#fb', m).value = await newBarcode();
  };
  // nama otomatis dari barcode (daftar bawaan / internet)
  const cariNama = async manual => {
    const bc = $('#fb', m).value.trim();
    const hint = $('#fbHint', m);
    if (!/^\d{6,14}$/.test(bc)) {
      if (manual) toast('Isi atau scan barcode angka dulu', true);
      return;
    }
    if (!manual && $('#fn', m).value.trim()) return;
    hint.innerHTML = '<span class="spin"></span> Mencari nama barang…';
    const h = await cariNamaBarcode(bc);
    if (!m.isConnected || $('#fb', m).value.trim() !== bc) return;
    if (h && (manual || !$('#fn', m).value.trim())) {
      $('#fn', m).value = h.nama;
      $('#fn', m).dispatchEvent(new Event('input'));
    }
    hint.innerHTML = h
      ? `✅ Nama diisi dari <b>${esc(h.sumber)}</b>. Periksa sebentar ya.`
      : hasilCariHTML(null, bc);
  };
  $('#fcari', m).onclick = () => cariNama(true);
  $('#fb', m).addEventListener('change', () => isNew && cariNama(false));
  if (isNew && p.barcode && !p.nama) cariNama(false);
  $('#fb', m).onkeydown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isNew && !$('#fn', m).value.trim()) cariNama(false);
      $('#fk', m).focus();
    }
  };
  $('#fsave', m).onclick = async () => {
    const satLama = isNew ? '' : (S.products.find(x => x.id === p.id) || {}).satuan || '';
    readUnits();
    const nama = $('#fn', m).value.trim().toUpperCase();
    if (!nama) return toast('Nama produk wajib diisi', true);
    const base = $('#fs', m).value === '__new' ? 'PCS' : $('#fs', m).value;
    const merged = units.filter(u => u.mergeFrom).map(u => u.mergeFrom);
    const bc = $('#fb', m).value.trim();
    if (bc) {
      const o = findBarcode(bc);
      if (o && o.id !== p.id && !merged.includes(o.id))
        return toast('Barcode sudah dipakai: ' + o.nama, true);
    }
    const seen = new Set([base]);
    for (const u of units) {
      if (!u.nama || u.nama === '__new') return toast('Pilih nama satuan lain', true);
      if (seen.has(u.nama)) return toast('Satuan ' + u.nama + ' dobel', true);
      seen.add(u.nama);
      if (!(u.isi > 0) || u._n === 1)
        return toast(`Isi satuan ${u.nama} belum benar (harus lebih dari 1)`, true);
      if (!(u.harga && u.harga.umum)) return toast(`Harga Umum untuk ${u.nama} belum diisi`, true);
      if (u.barcode) {
        const o = findBarcode(u.barcode);
        if (o && o.id !== p.id && !merged.includes(o.id))
          return toast('Barcode ' + u.barcode + ' sudah dipakai: ' + o.nama, true);
        if (nbc(u.barcode) === nbc(bc)) u.barcode = '';
      }
    }
    if (
      merged.length &&
      !(await confirmBox(
        `${merged.length} produk akan digabung ke sini dan dinonaktifkan (riwayat penjualannya tetap ada). Lanjut?`,
        'Gabungkan'
      ))
    )
      return;
    p.nama = nama;
    p.alias = $('#fa', m).value.trim().toUpperCase();
    const kode = $('#fkd', m).value.replace(/\s+/g, '').toUpperCase();
    if (kode) {
      if (!/[A-Z]/.test(kode))
        return toast('Kode singkat harus mengandung huruf (supaya tidak bentrok dengan barcode)', true);
      if (/^M\d{4,}$/.test(kode)) return toast('Kode seperti M0001 dipakai untuk ID member', true);
      const lain = S.products.find(x => x.id !== p.id && x.aktif !== false && x.kode === kode);
      if (lain) return toast('Kode ' + kode + ' sudah dipakai: ' + lain.nama, true);
    }
    p.kode = kode;
    p.barcode = bc;
    p.kategori = $('#fk', m).value === '__new' ? '' : $('#fk', m).value;
    p.satuan = base;
    p.hargaBeli = num($('#fhb', m).value);
    p.harga = {};
    $$('[data-bt]', m).forEach(i => {
      const v = num(i.value);
      if (v) p.harga[i.dataset.bt] = v;
    });
    if (!p.harga.umum) {
      toast('Harga Umum / Perorangan wajib diisi', true);
      const f = $('[data-bt=umum]', m);
      f && f.focus();
      return;
    }
    delete p.autoWarung; // harga sudah dilihat & disimpan pemilik
    delete p.revisiHarga;
    delete p.dariDaftar;
    p.stok = num($('#fst', m).value);
    p.minStok = num($('#fmn', m).value);
    p.aktif = $('#fak', m).checked;
    {
      // simpan pilihan prioritas hanya kalau berbeda dari hasil kata kunci
      delete p.prioritas;
      const ingin = $('#fprio', m).checked;
      if (ingin !== isPrioritas(p)) p.prioritas = ingin;
    }
    if ($('#fkas', m)) {
      if (p.kas !== kasPilih && !isNew) lupakanRincian();
      p.kas = kasPilih;
    }
    p.diubah = Date.now();
    if (isNew && !p.dibuat) p.dibuat = p.diubah;
    for (const u of units) {
      if (!u.mergeFrom) continue;
      const x = S.products.find(y => y.id === u.mergeFrom);
      if (!x) continue;
      p.stok = (Number(p.stok) || 0) + (Number(x.stok) || 0) * u.isi;
      p.barcode2 = [...new Set([...(p.barcode2 || []), ...(x.barcode2 || [])])];
      x.aktif = false;
      x.barcode = '';
      x.barcode2 = [];
      x.digabungKe = p.id;
      x.diubah = Date.now();
      await save('products', x);
    }
    p.units = units.map(u => ({
      nama: u.nama,
      isi: u.isi,
      harga: u.harga,
      hargaBeli: u.hargaBeli || 0,
      barcode: u.barcode || ''
    }));
    p.unitScan = $('#fus', m).value || base;
    const rb = rebaseToSmallest(p);
    if (rb) toast('Stok & harga dasar sekarang dihitung dalam ' + p.satuan);
    {
      // tanggal harga berubah, untuk filter "Harga berubah" (cetak ulang label rak)
      const asli = S.products.find(x => x.id === p.id);
      const jejak = x => JSON.stringify([x.harga, (x.units || []).map(u => [u.nama, u.harga])]);
      if (!asli || jejak(asli) !== jejak(p)) p.hargaDiubah = Date.now();
    }
    // satuan dasar diganti nama saja (PCS -> RCG, isi tetap): riwayat transaksi ikut memakai nama baru
    const gantiNama = satLama && !rb && p.satuan !== satLama && !unitsOf(p).some(u => u.nama === satLama);
    if (gantiNama && p.satuanAwal === satLama) p.satuanAwal = p.satuan;
    await save('products', p);
    if (gantiNama) await satuanRiwayat(p.id, satLama, p.satuan);
    m.close();
    toast('Produk disimpan ✔');
    if (rencanaSatuan(p)) betulkanSatuanDialog(p, () => after && after(p));
    else after && after(p);
  };
  $('#fdel') &&
    ($('#fdel', m).onclick = async () => {
      if (
        !(await confirmBox('Hapus produk ' + p.nama + '? Riwayat penjualan tetap tersimpan.', 'Hapus', true))
      )
        return;
      await remove('products', p.id);
      m.close();
      after && after();
    });
}
/** Cetak label: label harga rak (ditempel di rak, seperti supermarket) atau label barcode (stiker di barang) */
function labelDialog(list) {
  if (!list.length) return toast('Centang dulu produk yang mau dicetak labelnya', true);
  const st = settings();
  let jenis = st.labelJenis === 'barcode' ? 'barcode' : 'rak';
  const m = modal(
    `<h3>🏷️ Cetak label</h3>
   <div class="tabs2 lbltabs"><button type="button" data-lj="rak">🏷️ Label harga rak<small>ditempel di depan rak / tempat barang</small></button><button type="button" data-lj="barcode">🔢 Label barcode<small>stiker di barang, untuk di-scan</small></button></div>
   <div id="lbBody"></div>
   <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="lgo">🖨️ Cetak</button></div>`,
    { wide: true }
  );
  const nob = list.filter(p => !p.barcode);
  const noh = list.filter(p => !priceOf(p, 'umum'));
  const tabel = `<div class="tablewrap" style="max-height:260px"><table><thead><tr><th>Produk</th><th class="num">Harga Umum</th><th class="num">Jumlah label</th></tr></thead><tbody>${list.map(p => `<tr><td>${esc(p.nama)}<br><span class="muted" style="font-family:monospace">${esc(p.barcode || '-')}</span></td><td class="num">${priceOf(p, 'umum') ? rp(priceOf(p, 'umum')) : '<span class="badge warn">belum ada</span>'}</td><td class="num"><input data-l="${p.id}" value="1" inputmode="numeric" style="width:80px"></td></tr>`).join('')}</tbody></table></div>`;
  const isi = () => {
    $$('[data-lj]', m).forEach(b => b.classList.toggle('on', b.dataset.lj === jenis));
    $('#lbBody', m).innerHTML =
      jenis === 'rak'
        ? `${noh.length ? `<div class="banner">${noh.length} barang belum ada harganya, tidak ikut dicetak.</div>` : ''}${tabel}
     <div class="grid2"><div><label>Harga yang dicetak</label><select id="rkT">${tiers()
       .map(
         t =>
           `<option value="${t.id}" ${t.id === (st.rakTier || 'umum') ? 'selected' : ''}>Harga ${esc(t.nama)}</option>`
       )
       .join('')}</select></div>
     <div><label>Jenis kertas</label><select id="rkK"><option value="a4">Kertas A4 / HVS (3 kolom, 21 label per lembar)</option><option value="struk" ${st.rakKertas === 'struk' ? 'selected' : ''}>Printer struk (1 label per baris, digunting)</option></select></div></div>
     <label class="chk"><input type="checkbox" id="rkS" ${st.rakSatuan !== false ? 'checked' : ''}> Tampilkan juga harga satuan lain (misal RCG, DUS, SLOP)</label>
     <label class="chk"><input type="checkbox" id="rkW" ${st.rakWarung ? 'checked' : ''}> Tampilkan juga harga warung</label>
     <label class="chk"><input type="checkbox" id="rkD" ${st.rakTanggal !== false ? 'checked' : ''}> Cetak tanggal (supaya tahu label ini harga kapan)</label>
     <div class="muted" style="font-size:13px;margin-top:6px">Contoh:</div><div class="rakcontoh" id="rkPrev"></div>`
        : `${nob.length ? `<div class="banner">${nob.length} produk belum punya barcode. <button class="btn sm pri" id="lgen">Buatkan sekarang</button></div>` : ''}${tabel}
     <div class="grid2"><div><label>Tampilkan harga</label><select id="lpr"><option value="">Tidak</option>${tiers()
       .map(t => `<option value="${t.id}">Ya, harga ${esc(t.nama)}</option>`)
       .join('')}</select></div>
     <div><label>Jenis kertas</label><select id="lmode"><option value="thermal">Printer label/thermal (per label)</option><option value="a4">Kertas A4 / stiker (3 kolom)</option></select></div></div>
     <div class="grid2" id="lsz"><div><label>Lebar label (mm)</label><input id="lw" value="${st.labelW}"></div><div><label>Tinggi label (mm)</label><input id="lh" value="${st.labelH}"></div></div>`;
    if (jenis === 'rak') {
      const prev = () => {
        const p = list.find(x => priceOf(x, 'umum')) || list[0];
        $('#rkPrev', m).innerHTML = labelRakHTML({ p }, opsiRak());
      };
      ['#rkT', '#rkS', '#rkW', '#rkD'].forEach(id => ($(id, m).onchange = prev));
      prev();
    } else {
      $('#lmode', m).value = st.labelMode;
      const tg = () => $('#lsz', m).classList.toggle('hide', $('#lmode', m).value !== 'thermal');
      tg();
      $('#lmode', m).onchange = tg;
      $('#lgen', m) &&
        ($('#lgen', m).onclick = async () => {
          for (const p of nob) p.barcode = await newBarcode();
          await DB.putMany('products', nob);
          markDirty();
          m.close();
          labelDialog(list);
        });
    }
  };
  const opsiRak = () => ({
    tier: $('#rkT', m).value,
    kertas: $('#rkK', m).value,
    satuanLain: $('#rkS', m).checked,
    warung: $('#rkW', m).checked,
    tanggal: $('#rkD', m).checked
  });
  $$('[data-lj]', m).forEach(
    b =>
      (b.onclick = () => {
        jenis = b.dataset.lj;
        isi();
      })
  );
  isi();
  const jumlah = p => Math.max(0, Math.round(num(($(`[data-l="${p.id}"]`, m) || {}).value)));
  $('#lgo', m).onclick = async () => {
    st.labelJenis = jenis;
    if (jenis === 'rak') {
      const o = opsiRak();
      Object.assign(st, {
        rakTier: o.tier,
        rakKertas: o.kertas,
        rakSatuan: o.satuanLain,
        rakWarung: o.warung,
        rakTanggal: o.tanggal
      });
      await saveMeta('settings');
      const sel = list
        .filter(p => priceOf(p, o.tier) || priceOf(p, 'umum'))
        .map(p => ({ p, qty: jumlah(p) }));
      if (!sel.some(x => x.qty)) return toast('Tidak ada barang yang punya harga', true);
      return printLabelRak(sel, o);
    }
    st.labelMode = $('#lmode', m).value;
    st.labelW = num($('#lw', m).value) || 50;
    st.labelH = num($('#lh', m).value) || 30;
    await saveMeta('settings');
    const tier = $('#lpr', m).value;
    const sel = list.filter(p => p.barcode).map(p => ({ p, qty: jumlah(p), showPrice: !!tier, tier }));
    if (!sel.length) return toast('Tidak ada produk yang punya barcode', true);
    printLabels(sel);
  };
}
/** Pemberitahuan sekali setelah aplikasi diperbarui (misal kategori rokok disatukan, harga warung diisi) */
function showUpdateNotes(notes) {
  const adaCek = S.products.some(p => p.aktif !== false && perluCekWarung(p));
  const m = modal(
    `<h3>✨ Aplikasi sudah diperbarui</h3><ul class="notes">${notes.map(n => `<li>${n}</li>`).join('')}</ul>
   <p class="muted" style="font-size:14px">Pemberitahuan ini hanya muncul sekali. Semuanya tetap bisa diubah di menu Produk.</p>
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Nanti saja</button>${adaCek ? '<button class="btn pri" id="unCek">⚙ Cek harga warung sekarang</button>' : ''}</div>`
  );
  $$('[data-note]', m).forEach(
    b =>
      (b.onclick = () => {
        m.close();
        if (b.dataset.note === 'material') pilihMaterialDialog();
        if (b.dataset.note === 'uang') go('uang');
        if (b.dataset.note === 'daftar') {
          S._prodFilter = 'daftar';
          prodFilter.page = 1;
          go('produk');
        }
        if (b.dataset.note === 'kategori') {
          S._prodFilter = 'nok';
          prodFilter.page = 1;
          go('produk');
        }
      })
  );
  $('#unCek', m) &&
    ($('#unCek', m).onclick = () => {
      m.close();
      go('produk');
      cekWarungDialog(render);
    });
}
