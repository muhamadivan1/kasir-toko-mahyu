/* ============ KASIR ============ */
const cart = { items: [], customerId: '', namaBebas: '', tier: 'umum', diskon: 0, editOf: '', poinPakai: 0 };
/** Warna tetap: Umum biru, Warung merah. Kategori harga lain memakai warna cadangan. */
const TIER_WARNA = { umum: '#1d4e89', warung: '#c62828' };
const TIER_COLORS = ['#15803d', '#7e22ce', '#b45309', '#0e7490', '#4d5b6b'];
function tierColor(id) {
  if (TIER_WARNA[id]) return TIER_WARNA[id];
  const i = tiers()
    .filter(t => !TIER_WARNA[t.id])
    .findIndex(t => t.id === id);
  return i < 0 ? TIER_WARNA.umum : TIER_COLORS[i % TIER_COLORS.length];
}
/** Label kecil berwarna untuk kategori harga (Umum biru, Warung merah) */
function tierPill(id) {
  id = id || 'umum';
  return `<span class="tpill" style="--tc:${tierColor(id)}">${esc(tierName(id))}</span>`;
}
/** Nama pembeli di riwayat: nama yang diisi, atau keterangan tanpa nama sesuai kategori harganya */
function namaPembeli(s) {
  if (s.customerNama) return s.customerNama;
  return (s.tier || 'umum') === 'umum' ? 'Pembeli umum' : 'Tanpa nama';
}
function tierName(id) {
  return (tiers().find(t => t.id === id) || tiers()[0] || { nama: 'Umum' }).nama;
}
function custOf() {
  return S.customers.find(c => c.id === cart.customerId);
}
function matchCustomer(name) {
  const n = String(name || '')
    .trim()
    .toUpperCase();
  if (!n) return null;
  const a = S.customers.filter(c => c.aktif !== false);
  const d = n.replace(/\D/g, '');
  return (
    a.find(c => c.nama === n) ||
    a.find(c => c.kode && c.kode === n) ||
    (d.length >= 8 && d.length === n.replace(/[\s+-]/g, '').length
      ? a.find(c => c.telp && c.telp.replace(/\D/g, '').replace(/^62/, '0') === d.replace(/^62/, '0'))
      : null)
  );
}
/** Total keranjang. Layanan BRILink tidak kena diskon / poin, dan tarik tunai membuat total bisa minus
 * (artinya uang diberikan ke pelanggan). Poin member hanya dihitung dari belanja barang. */
function cartTotal() {
  let barang = 0,
    lyn = 0,
    bri = 0,
    utangLama = 0;
  for (const i of cart.items) {
    const v = i.harga * i.qty;
    if (i.utangLama) utangLama += v;
    else if (i.layanan && kasBaris(i) === 'brilink') bri += v;
    else if (i.layanan) lyn += v;
    else barang += v;
  }
  const potPoin = cart.customerId && cart.poinPakai ? cart.poinPakai * loy().nilai : 0;
  const diskon = Math.max(0, Math.min(Number(cart.diskon) || 0, barang + lyn));
  const belanja = Math.max(0, barang + lyn - diskon - potPoin);
  return {
    sub: barang + lyn + bri + utangLama,
    diskon,
    potPoin,
    total: belanja + bri + utangLama,
    utangLama,
    barang,
    poinBase: Math.max(0, barang - diskon - potPoin),
    adaBri: cart.items.some(i => i.layanan && kasBaris(i) === 'brilink')
  };
}
function cartItemFor(p, unitName, qty) {
  const u = unitByName(p, unitName);
  return {
    productId: p.id,
    nama: p.nama,
    satuan: u.nama,
    isi: u.isi,
    dasar: p.satuan,
    harga: priceUnit(p, u.nama, cart.tier),
    hargaBeli: hbUnit(p, u.nama),
    qty
  };
}
function addToCart(p, qty = 1, unitName) {
  const un = unitByName(p, unitName || unitScanOf(p)).nama;
  // barang yang belum ada harga jualnya (misal dari daftar barcode): isi harga dulu, supaya tidak terjual Rp 0
  if (!priceUnit(p, un, 'umum')) return isiHargaDialog(p, x => addToCart(x, qty));
  const ex = cart.items.find(i => i.productId === p.id && (i.satuan || p.satuan) === un);
  if (ex) ex.qty += qty;
  else cart.items.push(cartItemFor(p, un, qty));
  beep(true);
  drawCart(p.id, ex ? cart.items.indexOf(ex) : cart.items.length - 1);
  setTimeout(() => {
    const i = $('#scan'),
      x = $('#scanX');
    if (i && x) x.classList.toggle('hide', !i.value);
  }, 0);
}
/** Kosongkan keranjang (tombol Kosongkan / F10), ditanya dulu kalau ada isinya */
async function kosongkanKeranjang() {
  if ((!cart.items.length && !cart.editOf) || (await confirmBox('Kosongkan keranjang?', 'Kosongkan', true))) {
    resetCart();
    render();
  }
}
/** Ganti harga ke kategori harga berikutnya (Umum -> Warung -> ...), tombol F3 */
function gantiHargaBerikut() {
  const T = tiers();
  const i = T.findIndex(t => t.id === cart.tier);
  setTier(T[(i + 1) % T.length].id);
  toast('Harga ' + tierName(cart.tier));
  focusScan();
}
/** Daftar tombol pintas (F1) */
const TOMBOL_PINTAS = [
  ['F1', 'Daftar tombol pintas ini'],
  ['F2', 'Ke kolom scan / cari barang'],
  ['F3', 'Ganti harga Umum ↔ Warung'],
  ['F4', 'Riwayat transaksi'],
  ['F8', 'PojokBayar / BRILink'],
  ['F9', 'Tambah barang pakai suara'],
  ['F10', 'Kosongkan keranjang'],
  ['F12', 'Bayar'],
  ['Enter', 'Masukkan barang / simpan'],
  ['Esc', 'Tutup kotak / hapus ketikan']
];
function bantuanTombol() {
  if ($('.modal.pintas')) return;
  const m = modal(
    `<h3>⌨️ Tombol pintas kasir</h3>
   <div class="pintaslist">${TOMBOL_PINTAS.map(([k, t]) => `<div><kbd>${k}</kbd><span>${esc(t)}</span></div>`).join('')}</div>
   <div class="row actbar"><span class="grow"></span><button class="btn pri" data-close autofocus>Tutup</button></div>`
  );
  m.classList.add('pintas');
}
function setTier(t) {
  cart.tier = t;
  cart.items.forEach(i => {
    const p = S.products.find(x => x.id === i.productId);
    if (p) i.harga = priceUnit(p, i.satuan, t);
  });
  drawTier();
  drawCustHint();
  drawCart();
}
views.kasir = () => {
  // dengan backup harian otomatis, pengingat hanya muncul kalau backup macet lebih dari 3 hari
  const needBk =
    (!S.meta.backupHandle || !S._bkFileOk) &&
    (!S.meta.lastBackup || Date.now() - S.meta.lastBackup > (backupHarianAktif() ? 3 : 1) * 86400000) &&
    S.sales.length > 0;
  const editSale = cart.editOf ? S.sales.find(s => s.id === cart.editOf) : null;
  const ingatBuka =
    uangConf().ingatBuka &&
    !kasirOtoAktif() &&
    !bukaHariIni() &&
    S.meta.tundaBuka !== dkey(Date.now()) &&
    S.products.length > 0 &&
    !cart.items.length;
  $('#main').innerHTML = `
  ${ingatBuka ? `<div class="banner bukabanner">☀️ <b>Belum buka kasir hari ini.</b> Hitung dulu uang awal di laci, supaya nanti sore bisa dicocokkan. <button class="btn sm pri" id="bukaNow">☀️ Buka kasir</button><button class="btn sm ghost" id="bukaNanti">Nanti saja</button></div>` : ''}
  ${S._needBackupPerm && !backupHarianAktif() ? `<div class="banner">⚠️ Backup otomatis perlu izin lagi setelah browser dibuka ulang. <button class="btn sm pri" id="bkGrant">Aktifkan backup</button></div>` : ''}
  ${needBk ? `<div class="banner">💾 Sudah lebih dari ${backupHarianAktif() ? '3 hari' : 'sehari'} belum backup. <button class="btn sm pri" id="bkNow">Unduh backup sekarang</button> <span class="muted">atau aktifkan backup otomatis di Pengaturan.</span></div>` : ''}
  ${S.products.length === 0 ? `<div class="banner">👋 Belum ada produk. Buka <b>Pengaturan → Import</b> untuk memasukkan data dari Fastmart, atau tambah di menu <b>Produk</b>.</div>` : ''}
  ${cart.orderInfo ? `<div class="banner" style="background:#fff3dc">📥 Keranjang berisi <b>pesanan ${esc((cart.orderInfo.nama || 'pelanggan').toUpperCase())}</b>${cart.orderInfo.hp ? ' · HP ' + esc(cart.orderInfo.hp) : ''}${cart.orderInfo.catatan ? ` · 📝 <b>${esc(cart.orderInfo.catatan)}</b>` : ''}. Cek barangnya, lalu Bayar.</div>` : ''}
  ${editSale ? `<div class="banner" style="background:#eef4ff;border-color:#b9cdf0;color:#1d3a6b">✏️ Sedang <b>mengubah transaksi ${esc(editSale.no)}</b> (${tglJam(editSale.waktu)}). Transaksi lama baru dibatalkan setelah pembayaran yang baru selesai. <button class="btn sm bad" id="cancelEdit">Batal ubah</button></div>` : ''}
  <div id="kasir">
    <div class="card">
      <div class="tierbar" id="tierbar"><span class="tlabel">HARGA&nbsp;:</span>${tiers()
        .map(t => `<button data-tier="${t.id}" style="--tc:${tierColor(t.id)}">${esc(t.nama)}</button>`)
        .join('')}<span class="tkey hide-m" title="Tekan F3 untuk ganti harga">F3 = ganti</span></div>
      <div class="custrow">
        <div class="grow" style="position:relative"><input id="custName" list="custList" autocomplete="off" placeholder="👤 Nama pembeli (boleh dikosongkan)"><datalist id="custList">${S.customers
          .filter(c => c.aktif !== false)
          .sort((a, b) => a.nama.localeCompare(b.nama))
          .map(c => `<option value="${esc(c.nama)}">`)
          .join('')}</datalist></div>
      </div>
      <div id="custHint" class="muted" style="font-size:14px;margin:4px 2px 10px"></div>
      <div class="row" style="margin-bottom:10px">
        <div class="grow scanbox">
          <input id="scan" placeholder="🔍 Scan barcode atau ketik nama barang…" autocomplete="off" inputmode="search"><button id="scanX" class="hide" title="Hapus (Esc)" type="button">✕</button>
          <div id="suggest" class="hide"></div>
        </div>
        <button class="btn big ghost" id="micBtn" title="Tambah barang pakai suara (F9)">🎤</button>
        ${tombolBacaHTML()}
        <button class="btn big ghost" id="camBtn" title="Scan pakai kamera HP">📷</button>
      </div>
      <div id="micPanel"></div>
      <div class="tablewrap" style="max-height:calc(100vh - 380px)">
        <table id="cart"><thead><tr><th>Barang</th><th class="num">Harga</th><th>Jumlah</th><th class="num">Subtotal</th><th></th></tr></thead><tbody></tbody></table>
      </div>
      <div id="priceNote" class="pricenote hide"></div>
    </div>
    <div>
      <div class="totalbox" id="totalbox"><div class="row" style="justify-content:space-between"><span class="lbl" id="totLbl">TOTAL BELANJA</span><span class="tierpill" id="tierPill"></span></div><div class="amt" id="tot">0</div><div class="lbl" id="cnt"></div><div class="kassplit" id="kasSplit"></div><div class="lbl" id="custLbl" style="margin-top:4px;font-weight:600"></div></div>
      <div class="card" style="margin-top:12px">
        <label>Diskon (Rp)</label>
        <input id="disc" inputmode="numeric" value="${cart.diskon || ''}" placeholder="0">
        <div id="poinBox"></div>
        <button class="btn ok big" id="payBtn" style="width:100%;margin-top:14px">💵 BAYAR <span style="font-size:14px;opacity:.8">(F12)</span></button>
        ${layananAktif().length ? `<div class="row lyrow" style="margin-top:10px"><button class="btn lybtn grow" data-lytab="warung" style="--kc:${infoKas('warung').warna}">📲 PojokBayar</button>${uangConf().brilink !== false ? `<button class="btn lybtn grow" data-lytab="brilink" style="--kc:${infoKas('brilink').warna}">🏦 BRILink</button>` : ''}</div>` : ''}
        <div class="aksi2">
          <button class="btn ghost" id="manualBtn">✍️ Barang tanpa data</button>
          <button class="btn ghost" id="ulBtn" title="Pembeli ingat masih punya utang, dibayar sekalian">📒 Tambah utang lama</button>
          <button class="btn ghost" id="holdBtn">⏸️ Tunda</button>
          <button class="btn ghost" id="resumeBtn">▶ Lanjutkan (${(S.meta.held || []).length})</button>
          <button class="btn ghost" id="lastBtn" title="Cetak ulang struk terakhir">🖨️ Struk terakhir</button>
          <button class="btn bad" id="clearBtn">🗑️ Kosongkan<small class="fkey">tombol F10</small></button>
        </div>
        <button class="btn pri wfull" id="histBtn">🧾 Riwayat transaksi <span style="font-size:13px;opacity:.8">(F4)</span></button>
        <button class="btn wfull ordbtn" id="ordBtn">📥 Pesanan pelanggan <span id="ordBtnN" class="nbadge ${ordersPending().length ? '' : 'zero'}">${ordersPending().length}</span></button>
        <p class="muted pintasinfo">F1 = bantuan · F2 = kolom scan · F3 = ganti harga · F4 = riwayat · F8 = PojokBayar/BRILink · F9 = suara · F10 = kosongkan · F12 = bayar · Esc = tutup</p>
      </div>
    </div>
  </div>`;
  const c = custOf();
  $('#custName').value = c ? c.nama : cart.namaBebas || '';
  $('#bkGrant') && ($('#bkGrant').onclick = regrantBackup);
  $('#bukaNow') && ($('#bukaNow').onclick = () => bukaKasirDialog());
  $('#bukaNanti') &&
    ($('#bukaNanti').onclick = async () => {
      S.meta.tundaBuka = dkey(Date.now());
      await saveMeta('tundaBuka');
      render();
    });
  $$('[data-lytab]').forEach(b => (b.onclick = () => layananDialog('', {}, undefined, b.dataset.lytab)));
  $('#bkNow') &&
    ($('#bkNow').onclick = () => {
      downloadBackup();
      render();
    });
  $('#cancelEdit') &&
    ($('#cancelEdit').onclick = () => {
      resetCart();
      render();
      toast('Batal mengubah transaksi');
    });
  $$('#tierbar [data-tier]').forEach(
    b =>
      (b.onclick = () => {
        setTier(b.dataset.tier);
        focusScan();
      })
  );
  const ci = $('#custName');
  ci.oninput = applyCustName;
  ci.onchange = applyCustName;
  ci.onkeydown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyCustName();
      const c = custOf();
      if (c) ci.value = c.nama;
      focusScan();
    }
  };
  ci.onblur = () => {
    const c = custOf();
    if (c && ci.value.trim()) ci.value = c.nama;
  };
  $('#disc').oninput = e => {
    cart.diskon = num(e.target.value);
    drawTotals();
  };
  $('#disc').onkeydown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      focusScan();
    }
  };
  $('#payBtn').onclick = openPay;
  $('#clearBtn').onclick = kosongkanKeranjang;
  $('#manualBtn').onclick = () => manualItem('');
  $('#ulBtn').onclick = utangLamaDialog;
  $('#camBtn').onclick = cameraScan;
  $('#holdBtn').onclick = () => holdCart();
  $('#resumeBtn').onclick = resumeCart;
  $('#histBtn').onclick = historyDialog;
  $('#ordBtn').onclick = ordersDialog;
  $('#lastBtn').onclick = () => {
    const s = S.sales.filter(x => !x.batal).sort((a, b) => b.waktu - a.waktu)[0];
    s ? printReceipt(s) : toast('Belum ada transaksi', true);
  };
  const inp = $('#scan');
  const sx = $('#scanX');
  const syncX = () => sx.classList.toggle('hide', !inp.value);
  inp.addEventListener('input', () => {
    syncX();
    showSuggest(inp.value);
  });
  inp.addEventListener('keydown', scanKey);
  inp.addEventListener('paste', e => {
    const t = (e.clipboardData || window.clipboardData).getData('text');
    // pesanan ditempel: banyak baris, link/QR pesanan, atau daftar dipisah koma ("gula 2kg, minyak 1 liter, ...")
    const daftarKoma = t && /\d/.test(t) && t.split(/,(?!\d)|;/).filter(x => x.trim()).length >= 3;
    if (t && (/\n/.test(t.trim()) || /TMPESAN1\||#pesan=/.test(t) || daftarKoma)) {
      e.preventDefault();
      inp.value = '';
      closeSuggest();
      syncX();
      orderImport(t);
    }
  });
  sx.onclick = () => {
    inp.value = '';
    syncX();
    closeSuggest();
    inp.focus();
  };
  drawTier();
  drawCustHint();
  drawCart();
  focusScan();
  addScrollPad($('#cart').closest('.tablewrap'));
  $('#micBtn').onclick = toggleSuara;
  pasangTombolBaca();
  drawMic();
};
function applyCustName() {
  const ci = $('#custName');
  if (!ci) return;
  const v = ci.value.trim();
  const c = matchCustomer(v);
  const prev = cart.customerId;
  if (prev !== (c ? c.id : '')) cart.poinPakai = 0;
  if (c) {
    cart.customerId = c.id;
    cart.namaBebas = '';
    if (prev !== c.id) setTier(c.tier || 'umum');
    if (ci.value.trim().toUpperCase() !== c.nama && document.activeElement !== ci) ci.value = c.nama;
  } else {
    cart.customerId = '';
    cart.namaBebas = v.toUpperCase();
    if (prev) setTier('umum');
  }
  drawCustHint();
  drawTotals();
}
function drawCustHint() {
  const h = $('#custHint');
  if (!h) return;
  const c = custOf();
  if (c) {
    const u = saldoUtang(c.id);
    h.innerHTML = `<span style="color:var(--ok);font-weight:700">✔ Pelanggan terdaftar</span>${c.kode ? ` <span class="muted">(${esc(c.kode)})</span>` : ''} · harga <b style="color:${tierColor(c.tier || 'umum')}">${esc(tierName(c.tier || 'umum'))}</b>${u > 0 ? ` · <span style="color:var(--bad);font-weight:700">utang Rp ${rp(u)}</span>` : ''}`;
  } else if (cart.namaBebas) {
    h.innerHTML = `Pembeli <b>tidak terdaftar</b>. Namanya hanya dicetak di struk.${loy().aktif ? ` <button class="btn sm pri" id="regMember" type="button">⭐ Daftarkan jadi member</button>` : ''}`;
    $('#regMember') && ($('#regMember').onclick = () => quickMember(cart.namaBebas));
  } else h.innerHTML = `Boleh dikosongkan. Ketik nama / ID member / No. HP, atau scan kartu member.`;
  drawPoinBox();
}
function drawTier() {
  $$('#tierbar [data-tier]').forEach(b => b.classList.toggle('on', b.dataset.tier === cart.tier));
  const col = tierColor(cart.tier);
  const ct = $('#cart');
  if (ct) ct.style.setProperty('--tc', col); // garis kotak harga di keranjang ikut warna harga yang dipakai
  const tb = $('#totalbox');
  if (tb) tb.style.background = col;
  const pill = $('#tierPill');
  if (pill) pill.textContent = 'HARGA ' + tierName(cart.tier).toUpperCase();
}
function focusScan() {
  const i = $('#scan');
  if (i && !$('.modal')) i.focus();
}
let sugIdx = 0,
  sugList = [];
function closeSuggest() {
  const s = $('#suggest');
  s && s.classList.add('hide');
  sugList = [];
}
/* ---- Pencarian tahan salah ketik ----
 * Kalau pencarian biasa (kata harus persis ada di nama) tidak menemukan atau hanya sedikit,
 * mesin CariProduk mencarikan yang mirip: "indomi gorng" -> INDOMIE GORENG, "sampurna mild" -> SAMPOERNA MILD.
 * Hasilnya tampil di bagian "Mungkin maksudnya", dan pilihan "Tambah produk baru" tetap ada. */
let _ixKasir = null;
function indeksKasir() {
  if (_ixKasir && _ixKasir.n === S.products.length && Date.now() - _ixKasir.t < 15000) return _ixKasir.ix;
  const pop = popularitasCache();
  const ix = CariProduk.indeks(
    S.products.filter(p => p.aktif !== false),
    p => ({
      nama: p.nama,
      alias: p.alias,
      kategori: p.kategori,
      populer: (pop[p.id] || 0) + (p.dariDaftar ? 0 : 1)
    })
  );
  _ixKasir = { ix, n: S.products.length, t: Date.now() };
  return ix;
}
/** Barang yang mirip dengan ketikan (mungkin salah ketik), selain yang sudah ditemukan */
function cariMirip(q, sudah = [], batas = 6) {
  q = String(q || '').trim();
  if (q.replace(/[^a-z]/gi, '').length < 3) return [];
  const ada = new Set(sudah.map(p => p.id));
  const ix = indeksKasir();
  const ambil = t =>
    CariProduk.cariSkor(ix, t, batas + ada.size)
      .map(h => h.item)
      .filter(p => !ada.has(p.id));
  let r = ambil(q);
  // satu kata sama sekali tidak ada ("rinso cair"): cari tanpa kata itu, mulai dari kata paling belakang
  const w = q.split(/\s+/);
  for (let k = w.length - 1; !r.length && w.length > 1 && k >= 0; k--) {
    const sisa = w.filter((_, j) => j !== k).join(' ');
    if (sisa.replace(/[^a-z]/gi, '').length >= 3) r = ambil(sisa);
  }
  return r.slice(0, batas);
}
function saranBarangHTML(p, i, act) {
  return `<div data-i="${i}" class="${act ? 'act' : ''}"><span>${isPrioritas(p) ? '<span class="prio" title="Barang prioritas">⭐</span> ' : ''}<b>${esc(p.nama)}</b>${p.kode ? ` <span class="kodebadge">${esc(p.kode)}</span>` : ''}${p.alias && p.alias !== p.nama ? `<br><span class="muted" style="font-size:13px">${esc(p.alias)}</span>` : ''}</span><span class="right">${priceOf(p, cart.tier) ? `<b>${rp(priceOf(p, cart.tier))}</b>` : '<span class="badge warn">isi harga</span>'} <span class="muted" style="font-size:12px">/${esc(p.satuan || 'PCS')}</span>${(p.units || []).length ? `<br><span class="muted" style="font-size:12px">${p.units.map(u => esc(u.nama) + ' ' + rp(priceUnit(p, u.nama, cart.tier))).join(' · ')}</span>` : ''}<br><span class="muted" style="font-size:13px">stok ${rp(p.stok)}</span></span></div>`;
}
function showSuggest(q) {
  const box = $('#suggest');
  const mm = q.match(/^\s*\d+(?:[.,]\d+)?\s*[*xX]\s*(.+)$/);
  const qn = (mm ? mm[1] : q).trim();
  sugIdx = 0;
  if (!qn || /^\d{6,}$/.test(qn) || /^M\d{4,}$/i.test(qn) || jenisKodeAsing(qn)) {
    sugList = [];
    box.classList.add('hide');
    return;
  }
  // layanan (pulsa, token, tarik tunai, ...) tampil paling atas kalau ketikannya cocok
  const ly = mm ? [] : layananCocok(qn).map(x => ({ __ly: x }));
  const dasar = searchProducts(qn, 25);
  const mirip = !ly.length && dasar.length < 5 ? cariMirip(qn, dasar, dasar.length ? 3 : 6) : [];
  const bisaTambah = qn.length >= 3 && !ly.length;
  sugList = [...ly, ...dasar, ...mirip, ...(bisaTambah ? [{ __add: true }] : [])];
  if (!sugList.length) {
    box.classList.add('hide');
    return;
  }
  const n1 = ly.length + dasar.length; // posisi barang "mungkin maksudnya" pertama
  box.innerHTML = sugList
    .map((x, i) => {
      if (x.__ly) return saranLayananHTML(x.__ly, i, i === 0);
      if (x.__add)
        return `<div data-i="${i}" data-add class="addrow${i === 0 ? ' act' : ''}"><span>${n1 + mirip.length ? (mirip.length ? 'Bukan semua itu?' : 'Tidak ada yang cocok?') : 'Barang tidak ditemukan.'} <b>➕ Tambah produk baru “${esc(qn.toUpperCase())}”</b></span><span class="muted" style="font-size:13px">${i === 0 ? 'Enter' : '↓ lalu Enter'}</span></div>`;
      return (
        (i === n1 && mirip.length
          ? `<div class="sughead">🔎 ${dasar.length ? 'Atau mungkin maksudnya' : 'Mungkin maksudnya'}:</div>`
          : '') + saranBarangHTML(x, i, i === 0)
      );
    })
    .join('');
  box.classList.remove('hide');
  $$('div[data-i]', box).forEach(
    d =>
      (d.onmousedown = e => {
        e.preventDefault();
        const x = sugList[+d.dataset.i];
        x && x.__add ? addFromScan(e) : pick(x);
      })
  );
}
function addFromScan(e) {
  e && e.preventDefault && e.preventDefault();
  const i = $('#scan');
  if (!i) return;
  const raw = i.value;
  const m2 = raw.match(/^\s*(\d+(?:[.,]\d+)?)\s*[*xX]\s*(.+)$/);
  i.value = '';
  closeSuggest();
  const x = $('#scanX');
  x && x.classList.add('hide');
  const q = (m2 ? m2[2] : raw).trim();
  if (!q) return;
  unknownName(q, m2 ? num(m2[1]) || 1 : 1);
}
function pick(p) {
  const i = $('#scan');
  i.value = '';
  closeSuggest();
  if (p && p.__ly) {
    const x = $('#scanX');
    x && x.classList.add('hide');
    return layananDialog(p.__ly.jenis, p.__ly);
  }
  addToCart(p);
  i.focus();
}
function scanKey(e) {
  const inp = e.target;
  const box = $('#suggest');
  if (e.key === 'Escape' && inp.value) {
    e.preventDefault();
    e.stopPropagation();
    inp.value = '';
    closeSuggest();
    const x = $('#scanX');
    x && x.classList.add('hide');
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!sugList.length) return;
    e.preventDefault();
    sugIdx = (sugIdx + (e.key === 'ArrowDown' ? 1 : -1) + sugList.length) % sugList.length;
    $$('div[data-i]', box).forEach((d, i) => d.classList.toggle('act', i === sugIdx));
    $$('div[data-i]', box)[sugIdx].scrollIntoView({ block: 'nearest' });
    return;
  }
  if (e.key !== 'Enter') return;
  e.preventDefault();
  let q = inp.value.trim();
  if (!q) return;
  if (/^TMPESAN1\|/.test(q) || /#pesan=/.test(q)) {
    inp.value = '';
    closeSuggest();
    orderImport(q, 'qr');
    return;
  }
  // format "3*kode" untuk jumlah
  let qty = 1;
  const mm = q.match(/^(\d+(?:[.,]\d+)?)\s*[*xX]\s*(.+)$/);
  if (mm) {
    qty = num(mm[1]) || 1;
    q = mm[2].trim();
  }
  if (/^M\d{4,}$/i.test(q)) {
    const mc = S.customers.find(c => c.aktif !== false && c.kode === q.toUpperCase());
    if (mc) {
      selectCustomer(mc);
      inp.value = '';
      closeSuggest();
      beep(true);
      toast('Member: ' + mc.nama + ' · ' + rp(saldoPoin(mc.id)) + ' poin');
      return;
    }
  }
  const hit = findBarcodeHit(q);
  if (hit) {
    addToCart(hit.p, qty, hit.unit);
    inp.value = '';
    closeSuggest();
    return;
  }
  const pk = findByKode(q);
  if (pk) {
    addToCart(pk, qty);
    inp.value = '';
    closeSuggest();
    return;
  }
  // QR BPOM / QR situs / kode huruf hasil scanner yang tidak dikenal: bukan barcode barang, jangan dicari
  const asing = jenisKodeAsing(q) || (/[A-Za-z]/.test(q) && dariScanner(inp) ? 'asing' : '');
  if (asing) return tolakKode(asing, inp);
  if (!box.classList.contains('hide') && sugList.length) {
    const x = sugList[sugIdx];
    if (x.__add) return addFromScan();
    if (x.__ly) return pick(x);
    addToCart(x, qty);
    inp.value = '';
    closeSuggest();
    return;
  }
  const ly = layananCocok(q);
  if (ly.length) {
    inp.value = '';
    closeSuggest();
    return ly.length === 1
      ? layananDialog(ly[0].jenis, ly[0])
      : layananDialog('', {}, undefined, LAYANAN[ly[0].jenis].kas);
  }
  const res = searchProducts(q);
  if (res.length === 1) {
    addToCart(res[0], qty);
    inp.value = '';
    return;
  }
  beep(false);
  inp.value = '';
  closeSuggest();
  const x_ = $('#scanX');
  x_ && x_.classList.add('hide');
  if (/^\d{6,}$/.test(q)) unknownBarcode(q);
  else unknownName(q, qty);
}
function drawCart(flashId, flashIdx) {
  if (flashIdx !== undefined) cart._last = flashIdx;
  else if (cart._last >= cart.items.length) cart._last = -1;
  const tb = $('#cart tbody');
  if (!tb) return;
  if (!cart.items.length) {
    tb.innerHTML = `<tr><td colspan="5" class="empty">Keranjang kosong.<br>Scan barcode atau ketik nama barang di atas.</td></tr>`;
  } else
    tb.innerHTML = cart.items
      .map((it, i) =>
        it.layanan
          ? barisLayananHTML(it, i, `${i === cart._last ? 'last' : ''} ${i === flashIdx ? 'flash' : ''}`)
          : `<tr class="${i === cart._last ? 'last' : ''} ${i === flashIdx ? 'flash' : ''}">
    <td><b>${esc(it.nama)}</b>${it.utangLama ? ' <span class="badge bad">utang lama</span>' : it.manual ? ' <span class="badge warn">manual</span>' : ''}${kasBaris(it) !== 'warung' ? ' ' + kasPill(kasBaris(it)) : ''}${(() => {
      const p = !it.manual && S.products.find(x => x.id === it.productId);
      if (!p) return '';
      const us = unitsOf(p);
      // daftar satuan + dua pilihan: Ganti (salah pilih, harga & stok tetap) dan Tambah (satuan lain, isi beda)
      const cur = it.satuan || p.satuan;
      return `<div style="margin-top:4px"><select class="unitsel" data-u="${i}" title="Pilih satuan, ganti, atau tambah satuan">${us.map(u => `<option value="${esc(u.nama)}" ${u.nama === cur ? 'selected' : ''}>${esc(u.nama)}${u.base ? '' : ` (isi ${fmtIsi(u.isi)} ${esc(p.satuan)})`}</option>`).join('')}<option disabled>──────────</option><option value="__ganti">✏️ Ganti satuan ${esc(cur)} (salah pilih)…</option><option value="__add">➕ Tambah satuan…</option></select></div>`;
    })()}</td>
    <td class="num"><div class="pricecell"><input class="price" data-i="${i}" inputmode="numeric" value="${rp(it.harga)}" title="${it.manual ? 'Harga untuk transaksi ini' : 'Ubah harga: langsung tersimpan ke data produk'}">${it.manual ? '' : `<button class="pedit" data-pe="${i}" type="button" title="Ubah harga beli, perorangan & warung">✏️</button>`}</div></td>
    <td>${it.utangLama ? '<div class="qty" style="justify-content:center"><b>1</b></div>' : `<div class="qty"><button data-m="${i}">−</button><input data-q="${i}" inputmode="decimal" value="${it.qty}"><button data-p="${i}">+</button></div>`}</td>
    <td class="num"><b>${rp(it.harga * it.qty)}</b></td>
    <td><button class="btn sm bad" data-d="${i}">✕</button></td></tr>`
      )
      .join('');
  $$('select.unitsel', tb).forEach(
    sel =>
      (sel.onchange = () => {
        const idx = +sel.dataset.u;
        const it = cart.items[idx];
        const p = S.products.find(x => x.id === it.productId);
        if (!p) return;
        if (sel.value === '__ganti') {
          const lama = it.satuan || p.satuan;
          sel.value = lama;
          gantiSatuanDialog(p, lama, () => {
            drawCart();
            focusScan();
          });
          return;
        }
        if (sel.value === '__add') {
          sel.value = it.satuan || p.satuan;
          quickUnitDialog(p, n => {
            const cur = cart.items[idx];
            if (cur && cur.productId === p.id) {
              cart.items[idx] = cartItemFor(p, n, cur.qty);
            }
            cart.items.forEach((x, j) => {
              if (x.productId === p.id && j !== idx) {
                const k = x.satuan;
                cart.items[j] = cartItemFor(p, k, x.qty);
              }
            });
            drawCart();
            focusScan();
          });
          return;
        }
        const nu = cartItemFor(p, sel.value, it.qty);
        const dup = cart.items.findIndex(
          (x, j) => j !== +sel.dataset.u && x.productId === p.id && x.satuan === nu.satuan
        );
        if (dup >= 0) {
          cart.items[dup].qty += it.qty;
          cart.items.splice(+sel.dataset.u, 1);
        } else cart.items[+sel.dataset.u] = nu;
        drawCart();
        focusScan();
      })
  );
  $$('[data-m]', tb).forEach(
    b =>
      (b.onclick = () => {
        const it = cart.items[b.dataset.m];
        it.qty = Math.max(0, +(it.qty - 1).toFixed(3));
        if (!it.qty) cart.items.splice(b.dataset.m, 1);
        drawCart();
      })
  );
  $$('[data-p]', tb).forEach(
    b =>
      (b.onclick = () => {
        cart.items[b.dataset.p].qty = +(cart.items[b.dataset.p].qty + 1).toFixed(3);
        drawCart();
      })
  );
  $$('[data-d]', tb).forEach(
    b =>
      (b.onclick = () => {
        cart.items.splice(b.dataset.d, 1);
        drawCart();
        focusScan();
      })
  );
  $$('[data-q]', tb).forEach(x => {
    x.onchange = () => {
      const v = num(x.value);
      if (v <= 0) cart.items.splice(x.dataset.q, 1);
      else cart.items[x.dataset.q].qty = v;
      drawCart();
      focusScan();
    };
    x.onkeydown = e => {
      if (e.key === 'Enter') x.blur();
    };
  });
  $$('[data-pe]', tb).forEach(
    b =>
      (b.onclick = () => {
        const it = cart.items[+b.dataset.pe];
        const p = it && S.products.find(x => x.id === it.productId);
        if (p) ubahHargaDialog(p, it.satuan || p.satuan);
      })
  );
  $$('[data-le]', tb).forEach(
    b =>
      (b.onclick = () => {
        const idx = +b.dataset.le;
        const it = cart.items[idx];
        if (it && it.layanan) layananDialog(it.layanan, {}, idx);
      })
  );
  $$('input.price', tb).forEach(x => {
    x.onfocus = () => x.select();
    x.onchange = async () => {
      await hargaDiubahDiKeranjang(+x.dataset.i, num(x.value));
      drawCart();
      focusScan();
    };
    x.onkeydown = e => {
      if (e.key === 'Enter') x.blur();
    };
  });
  if (flashIdx !== undefined && tb.children[flashIdx]) {
    const row = tb.children[flashIdx];
    requestAnimationFrame(() => {
      try {
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch (e) {
        row.scrollIntoView(false);
      }
    });
  }
  drawTotals();
}
function drawTotals() {
  const t = cartTotal();
  drawPoinBox();
  const keluar = t.total < 0;
  $('#tot') && ($('#tot').textContent = 'Rp ' + rp(Math.abs(t.total)));
  $('#totLbl') && ($('#totLbl').textContent = keluar ? 'BERIKAN KE PELANGGAN' : 'TOTAL BELANJA');
  $('#payBtn') &&
    ($('#payBtn').innerHTML = keluar
      ? '💵 BERIKAN UANG <span style="font-size:14px;opacity:.8">(F12)</span>'
      : '💵 BAYAR <span style="font-size:14px;opacity:.8">(F12)</span>');
  const tb = $('#totalbox');
  if (tb) tb.style.background = keluar ? infoKas('brilink').warna : tierColor(cart.tier);
  const brg = cart.items.filter(i => !i.layanan);
  const nLyn = cart.items.length - brg.length;
  const n = brg.reduce((s, i) => s + i.qty, 0);
  $('#cnt') &&
    ($('#cnt').textContent = [
      brg.length ? `${brg.length} jenis · ${rp(n)} barang` : '',
      nLyn ? `${nLyn} layanan` : '',
      t.diskon ? `diskon ${rp(t.diskon)}` : '',
      t.potPoin ? `poin -${rp(t.potPoin)}` : ''
    ]
      .filter(Boolean)
      .join(' · '));
  // kalau uangnya untuk lebih dari satu laci, tampilkan pembagiannya
  const ks = $('#kasSplit');
  if (ks) {
    const R = cart.items.length ? rincianKeranjang() : { kas: {} };
    const ids = KAS.map(k => k.id).filter(k => R.kas[k]);
    ks.innerHTML =
      ids.length > 1 || (ids.length === 1 && ids[0] !== 'warung')
        ? ids
            .map(
              k =>
                `<span>${infoKas(k).ikon} ${esc(infoKas(k).nama)} <b>${R.kas[k].uang < 0 ? '−' : ''}Rp ${rp(Math.abs(R.kas[k].uang))}</b></span>`
            )
            .join('')
        : '';
  }
}
function resetCart() {
  cart.items = [];
  cart.customerId = '';
  cart.namaBebas = '';
  cart.tier = 'umum';
  cart.diskon = 0;
  cart.editOf = '';
  cart.poinPakai = 0;
  cart._last = -1;
  cart.orderId = '';
  cart.orderInfo = null;
}
async function holdCart(silent) {
  if (!cart.items.length) return toast('Keranjang kosong', true);
  S.meta.held = S.meta.held || [];
  S.meta.held.push({ id: uid(), waktu: Date.now(), cart: JSON.parse(JSON.stringify(cart)) });
  await saveMeta('held');
  resetCart();
  if (silent !== true) {
    render();
    toast('Transaksi ditunda');
  }
}
function resumeCart() {
  const h = S.meta.held || [];
  if (!h.length) return toast('Tidak ada transaksi tertunda', true);
  const m = modal(
    `<h3>Transaksi tertunda</h3>${h
      .map((x, i) => {
        const c = S.customers.find(c => c.id === x.cart.customerId);
        return `<div class="row" style="border-bottom:1px solid var(--line);padding:8px 0"><div class="grow"><b>${c ? esc(c.nama) : esc(x.cart.namaBebas || 'Tanpa nama')}</b> ${tierPill(x.cart.tier)}<br><span class="muted">${tglJam(x.waktu)} · ${x.cart.items.length} barang · Rp ${rp(x.cart.items.reduce((s, i) => s + i.harga * i.qty, 0))}</span></div><button class="btn pri sm" data-r="${i}">Lanjutkan</button><button class="btn bad sm" data-x="${i}">Hapus</button></div>`;
      })
      .join(
        ''
      )}<div class="right" style="margin-top:12px"><button class="btn ghost" data-close>Tutup</button></div>`
  );
  $$('[data-r]', m).forEach(
    b =>
      (b.onclick = async () => {
        if (cart.items.length) {
          await holdCart();
        }
        const x = S.meta.held.splice(+b.dataset.r, 1)[0];
        resetCart();
        Object.assign(cart, x.cart);
        await saveMeta('held');
        m.remove();
        render();
      })
  );
  $$('[data-x]', m).forEach(
    b =>
      (b.onclick = async () => {
        S.meta.held.splice(+b.dataset.x, 1);
        await saveMeta('held');
        m.remove();
        render();
      })
  );
}
/** Utang lama yang dibayar sekalian belanja. Contoh: belanja 95.000, masih utang 5.000 -> total 100.000.
 *  Kalau pembelinya pelanggan yang utangnya tercatat di aplikasi, catatan utangnya ikut berkurang. */
function utangLamaDialog() {
  const c = custOf();
  const saldo = c ? Math.max(0, saldoUtang(c.id)) : 0;
  const ada = cart.items.find(i => i.utangLama);
  const pakaiMaterial = uangConf().material !== false;
  const m = modal(
    `<h3>📒 Tambah utang lama ke transaksi ini</h3>
   <p class="muted" style="margin-top:0">Pembeli ingat masih punya utang dan mau dibayar sekarang sekalian belanja. Jumlahnya ditambahkan ke total belanja.</p>
   ${
     c && saldo > 0
       ? `<div class="banner">Utang <b>${esc(c.nama)}</b> yang tercatat: <b>Rp ${rp(saldo)}</b>. Setelah dibayar, catatan utangnya ikut berkurang.</div>`
       : c
         ? `<p>${esc(c.nama)} tidak punya utang yang tercatat di aplikasi. Isi sesuai buku catatan utang.</p>`
         : '<p>Isi sesuai buku catatan utang.</p>'
   }
   <label>Jumlah utang lama yang dibayar sekarang</label><input id="ulJ" inputmode="numeric" class="bignum" value="${ada ? rp(ada.harga) : saldo ? rp(saldo) : ''}" autofocus>
   <label>Catatan (boleh kosong)</label><input id="ulN" value="${esc((ada && ada.catatan) || '')}" placeholder="misal: utang tanggal 20 Okt">
   ${pakaiMaterial ? `<label>Utang untuk</label><select id="ulK"><option value="warung">🏪 Warung</option><option value="material" ${ada && ada.kas === 'material' ? 'selected' : ''}>🧱 Material</option></select>` : ''}
   <div class="row actbar">${ada ? '<button class="btn bad" id="ulDel">Hapus dari transaksi</button>' : ''}<span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="ulOk">➕ Tambahkan (Enter)</button></div>`,
    { onClose: focusScan }
  );
  const ok = () => {
    const j = num($('#ulJ', m).value);
    if (!j) return toast('Isi jumlah utangnya', true);
    const it = {
      productId: 'utang-' + uid(),
      manual: true,
      utangLama: true,
      nama: 'BAYAR UTANG LAMA' + (c ? ' · ' + c.nama : ''),
      satuan: '',
      harga: j,
      hargaBeli: 0,
      qty: 1,
      kas: $('#ulK', m) ? $('#ulK', m).value : 'warung',
      catatan: $('#ulN', m).value.trim()
    };
    if (c && saldo > 0) it.customerId = c.id; // catatan utangnya ikut berkurang saat transaksi selesai
    if (ada) cart.items[cart.items.indexOf(ada)] = it;
    else cart.items.push(it);
    m.close();
    drawCart(null, cart.items.indexOf(it));
    toast(`Utang lama Rp ${rp(j)} ditambahkan ke total`);
  };
  $('#ulOk', m).onclick = ok;
  $('#ulDel', m) &&
    ($('#ulDel', m).onclick = () => {
      cart.items.splice(cart.items.indexOf(ada), 1);
      m.close();
      drawCart();
    });
  m.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT') {
      e.preventDefault();
      ok();
    }
  });
}
function manualItem(prefill) {
  const m = modal(
    `<h3>Barang tanpa data</h3><p class="muted" style="margin-top:0">Untuk barang yang belum terdaftar. Hanya dicatat di transaksi ini.</p>
  <label>Nama barang</label><input id="mn" value="${esc(prefill)}" autofocus>
  <div class="grid2"><div><label>Harga</label><input id="mh" inputmode="numeric"></div><div><label>Jumlah</label><input id="mq" inputmode="decimal" value="1"></div></div>
  ${uangConf().material !== false ? `<label>Uangnya masuk ke</label><select id="mk"><option value="warung">🏪 Laci Warung</option><option value="material" ${tebakMaterial({ nama: prefill }) ? 'selected' : ''}>🧱 Laci Material</option></select>` : ''}
  <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="mok">Tambah ke keranjang</button></div>`,
    { onClose: focusScan }
  );
  const ok = () => {
    const n = $('#mn', m).value.trim(),
      h = num($('#mh', m).value),
      q = num($('#mq', m).value) || 1;
    if (!n || !h) return toast('Isi nama dan harga', true);
    cart.items.push({
      productId: 'manual-' + uid(),
      manual: true,
      nama: n.toUpperCase(),
      satuan: 'PCS',
      harga: h,
      hargaBeli: 0,
      qty: q,
      kas: $('#mk', m) ? $('#mk', m).value : 'warung'
    });
    m.close();
    drawCart();
  };
  $('#mok', m).onclick = ok;
  $$('input', m).forEach(
    i =>
      (i.onkeydown = e => {
        if (e.key === 'Enter') ok();
      })
  );
}
/** Jarak ketik dua kata (berapa huruf yang beda / tertukar), untuk salah ketik merek: LIFEBOUY = LIFEBUOY */
function jarakEdit(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
/** Barang yang namanya mirip (kata yang sama, atau beda 1-2 huruf untuk kata panjang).
 *  saring(p) = syarat tambahan, misal hanya barang toko sendiri. */
function miripProduk(q, limit = 6, saring = null) {
  const ws = String(q)
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 3 && /[a-z]/.test(w)); // angka ukuran (250, 100ML) tidak dihitung mirip
  if (!ws.length) return [];
  const cocok = (h, toks, w) =>
    h.includes(w) ||
    (w.length >= 5 && toks.some(t => t.length >= 5 && t[0] === w[0] && jarakEdit(t, w) <= 2));
  return S.products
    .filter(p => p.aktif !== false && (!saring || saring(p)))
    .map(p => {
      const h = (p.nama + ' ' + (p.alias || '')).toLowerCase();
      const toks = h.split(/[^a-z0-9]+/);
      return [
        ws.reduce(
          (t, w, i) => t + (cocok(h, toks, w) ? w.length + (i === 0 ? 3 : 0) + (h.startsWith(w) ? 2 : 0) : 0),
          0
        ),
        p
      ];
    })
    .filter(x => x[0] > 0)
    .sort((a, b) => b[0] - a[0] || a[1].nama.localeCompare(b[1].nama))
    .slice(0, limit)
    .map(x => x[1]);
}
function presetFrom(q) {
  q = String(q).trim();
  return /^\d{6,}$/.test(q) ? { barcode: q } : { nama: q.toUpperCase() };
}
function unknownName(q, qty = 1) {
  const mirip = miripProduk(q);
  const m = modal(
    `<h3>🔎 Barang “${esc(q)}” belum ada</h3>
   <p class="muted" style="margin-top:0">Mau ditambahkan jadi produk baru? Setelah disimpan langsung masuk keranjang${qty !== 1 ? ` (${String(qty).replace('.', ',')}×)` : ''}.</p>
   <button class="btn pri big" id="unNew" style="width:100%" autofocus>➕ Tambah produk baru <span style="font-size:14px;opacity:.85">(Enter)</span></button>
   <div class="row" style="margin-top:8px"><button class="btn ghost grow" id="unMan">✍️ Jual tanpa data (sekali ini saja)</button><button class="btn ghost" data-close>Batal (Esc)</button></div>
   ${mirip.length ? `<h3 style="margin:16px 0 6px;font-size:16px">Atau mungkin maksudnya:</h3><div style="max-height:260px;overflow:auto">${mirip.map(p => `<div class="row" style="padding:7px 0;border-bottom:1px solid var(--line);flex-wrap:nowrap"><div class="grow"><b>${esc(p.nama)}</b>${p.alias && p.alias !== p.nama ? `<br><span class="muted" style="font-size:13px">${esc(p.alias)}</span>` : ''}</div><b style="white-space:nowrap">Rp ${rp(priceUnit(p, unitScanOf(p), cart.tier))}</b><button class="btn sm pri" data-pk="${p.id}">Pilih</button></div>`).join('')}</div>` : ''}`,
    { onClose: focusScan }
  );
  $('#unNew', m).onclick = () => {
    m.remove();
    editProduct(null, presetFrom(q), p => {
      if (p && currentView === 'kasir') {
        addToCart(p, qty);
        toast('Produk baru ditambahkan ke keranjang ✔');
      }
      focusScan();
    });
  };
  $('#unMan', m).onclick = () => {
    m.remove();
    manualItem(q);
  };
  $$('[data-pk]', m).forEach(
    b =>
      (b.onclick = () => {
        const p = S.products.find(x => x.id === b.dataset.pk);
        m.close();
        addToCart(p, qty);
      })
  );
}
/** Barcode belum terdaftar: cari namanya (daftar bawaan / internet), lalu tambah produk tinggal isi harga */
function unknownBarcode(code) {
  let hasil = cariBarcodeLokal(code);
  const m = modal(
    `<h3>Barcode belum terdaftar</h3><p style="margin-top:0">Kode <b>${esc(code)}</b> belum ada di daftar produk toko.</p>
  <div class="caribox" id="ubCari">${hasil ? hasilCariHTML(hasil, code) : '<span class="spin"></span> Mencari nama barang…'}</div>
  <div id="ubAda"></div>
  <button class="btn pri big" id="ubNew" style="width:100%;margin-top:10px"></button>
  <div class="row" style="margin-top:8px"><button class="btn ghost grow" id="ubMan">✍️ Jual tanpa data (sekali ini)</button><button class="btn ghost" data-close>Batal (Esc)</button></div>`,
    { onClose: focusScan }
  );
  // cari dulu: barangnya mungkin sudah ada di toko dengan nama lain (belum ada barcodenya)
  const ada = cariSudahAda($('#ubAda', m), {
    namaAwal: hasil ? hasil.nama : '',
    label: 'Pasangkan',
    pilih: async p => {
      if (p.barcode) p.barcode2 = [...(p.barcode2 || []), code];
      else p.barcode = code;
      p.diubah = Date.now();
      await save('products', p);
      m.close();
      addToCart(p);
      toast('Barcode dipasangkan ke ' + p.nama);
    }
  });
  ada.inp.placeholder = 'ketik nama barang yang di-scan… (kosong + Enter = tambah barang baru)';
  setTimeout(() => ada.inp.focus(), 30);
  ada.inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !ada.inp.value.trim()) {
      e.preventDefault();
      $('#ubNew', m).click();
    }
  });
  const tombol = () =>
    ($('#ubNew', m).innerHTML = hasil
      ? `➕ Tambah “${esc(hasil.nama)}”<small>tinggal isi harga (Enter)</small>`
      : '➕ Tambah produk baru <small>(Enter)</small>');
  tombol();
  const cari = hasil ? null : cariBarcodeOnline(code);
  cari &&
    cari.then(h => {
      if (!m.isConnected) return;
      hasil = h;
      $('#ubCari', m).innerHTML = hasilCariHTML(h, code);
      tombol();
      if (h) ada.setNama(h.nama);
    });
  $('#ubNew', m).onclick = () => {
    m.remove();
    tambahCepatDialog({ barcode: code, ...(hasil || {}), cari: hasil ? null : cari }, p => {
      if (p && currentView === 'kasir') addToCart(p);
      focusScan();
    });
  };
  $('#ubMan', m).onclick = () => {
    m.remove();
    manualItem(hasil ? hasil.nama : '');
  };
}
const METODE = { tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer', utang: 'Utang' };
function metodeBadge(m) {
  return m === 'utang'
    ? '<span class="badge bad">utang</span>'
    : m === 'qris'
      ? '<span class="badge">QRIS</span>'
      : m === 'transfer'
        ? '<span class="badge">transfer</span>'
        : '<span class="badge ok">tunai</span>';
}
function openPay() {
  if (!cart.items.length) return toast('Keranjang masih kosong', true);
  applyCustName();
  const t = cartTotal();
  if (t.total < 0) return bayarUangKeluar(t);
  bacakanTotal(t.total);
  const cust = custOf();
  const qris = settings().qris;
  const bri = t.adaBri;
  const adaUtangLama = t.utangLama > 0;
  const qs = [
    ...new Set([
      t.total,
      Math.ceil(t.total / 5000) * 5000,
      Math.ceil(t.total / 10000) * 10000,
      Math.ceil(t.total / 50000) * 50000,
      Math.ceil(t.total / 100000) * 100000
    ])
  ]
    .filter(v => v >= t.total)
    .slice(0, 4);
  const off = bri ? 'disabled title="Ada layanan BRILink, bayar tunai"' : '';
  const m = modal(
    `<h3>Pembayaran</h3>
    <div class="totalbox" style="background:${tierColor(cart.tier)}"><div class="row" style="justify-content:space-between"><span class="lbl">Total</span><span class="tierpill">HARGA ${esc(tierName(cart.tier).toUpperCase())}</span></div><div class="amt">Rp ${rp(t.total)}</div>${cust || cart.namaBebas ? `<div class="lbl">${esc(cust ? cust.nama : cart.namaBebas)}</div>` : ''}</div>
    <div class="tabs2" style="margin-top:12px"><button class="on" data-mt="tunai">💵 Tunai</button><button data-mt="qris" ${off}>📱 QRIS</button><button data-mt="transfer" ${off}>🏦 Transfer</button><button data-mt="utang" ${off}>📒 Utang</button></div>
    ${bri ? '<p class="muted" style="font-size:13px;margin:-4px 0 6px">Ada layanan BRILink, jadi pembayarannya tunai.</p>' : ''}
    <div id="cashPart"><label>Uang diterima</label><input id="paid" inputmode="numeric" style="font-size:26px;min-height:58px" autofocus>
    <div class="quick">${qs.map(v => `<button class="btn ghost" data-q="${v}">${v === t.total ? 'Uang pas' : rp(v)}</button>`).join('')}</div>
    <div class="row" style="font-size:22px;margin-top:6px"><span class="grow" id="chgLbl">Kembalian</span><b id="chg">0</b></div>
    <div id="kurangBox" class="kurangbox hide"></div></div>
    <div id="qrisPart" class="hide" style="text-align:center">${qris ? `<div id="qrImg" style="margin:6px auto;max-width:300px"></div><div style="font-weight:700">${esc(qris.nama)}</div><div style="font-size:28px;font-weight:800">Rp ${rp(t.total)}</div><p class="muted" style="font-size:13px;margin:6px 0 0">Minta pembeli scan. Nominal sudah otomatis terisi.<br><b>Cek dulu notifikasi uang masuk</b> di HP/aplikasi merchant sebelum tekan Selesai.</p>` : `<div class="banner">QRIS toko belum diatur. Buka <b>Pengaturan → QRIS</b>, lalu upload foto QRIS toko sekali saja.</div>`}</div>
    <div id="trfPart" class="hide"><p>Pembayaran lewat transfer bank / e-wallet. Pastikan uang sudah masuk sebelum menekan Selesai.</p></div>
    <div id="utangPart" class="hide">${cust ? `<p>Dicatat sebagai utang <b>${esc(cust.nama)}</b>. Saldo utang sekarang: <b>Rp ${rp(saldoUtang(cust.id))}</b></p>` : `<label>Nama yang berutang *</label><input id="uName" value="${esc(cart.namaBebas || '')}" placeholder="contoh: Toko Bunda"><p class="muted" style="font-size:13px;margin:4px 0 0">Nama ini akan otomatis didaftarkan sebagai pelanggan dengan harga <b>${esc(tierName(cart.tier))}</b>.</p>`}
      <label>Dibayar sebagian sekarang (boleh kosong)</label><input id="dp" inputmode="numeric" placeholder="0"></div>
    <div id="bagiBox"></div>
    <label><input type="checkbox" id="prn" ${S.meta.autoPrint !== false ? 'checked' : ''}> Cetak struk</label>
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-close>Kembali</button><button class="btn ok big" id="done">✔ Selesai (Enter)</button></div>`,
    { onClose: focusScan }
  );
  let metode = 'tunai';
  // petunjuk pembagian uang kalau belanjaan ini bukan (hanya) untuk laci Warung
  const R0 = rincianKeranjang();
  const perluBagi = Object.keys(R0.kas).length > 1 || !R0.kas.warung;
  const drawBagi = () => {
    if (!perluBagi) return;
    const bay = metode === 'utang' ? Math.min(t.total, num($('#dp', m).value)) : t.total;
    $('#bagiBox', m).innerHTML =
      metode === 'qris' || metode === 'transfer' ? '' : pembagianHTML(rincianKeranjang(metode, bay));
  };
  drawBagi();
  const upd = () => {
    const p = num($('#paid', m).value);
    const c = p - t.total;
    const kurang = p > 0 && c < 0;
    $('#chg', m).textContent = p ? (c < 0 ? 'Rp ' + rp(-c) : 'Rp ' + rp(c)) : '0';
    $('#chgLbl', m).textContent = kurang ? 'KURANG' : 'Kembalian';
    $('#chg', m).style.color = c < 0 ? 'var(--bad)' : 'var(--ok)';
    // uang kurang: transaksi tetap bisa diselesaikan, kekurangannya dicatat
    const kb = $('#kurangBox', m);
    if (kurang && !kb.dataset.on) {
      kb.dataset.on = 1;
      kb.innerHTML =
        (adaUtangLama
          ? '<div style="margin-bottom:6px">📒 Uang yang diterima dipakai melunasi <b>utang lama</b> dulu, sisanya untuk belanja. Kekurangannya jadi utang baru dan tercetak di struk.</div>'
          : '') +
        (cust
          ? `⚠️ <b>Uangnya kurang <span class="kurangN"></span>.</b> Tetap bisa diselesaikan, struknya bertulisan <b>KURANG</b>. Kekurangannya dicatat sebagai utang <b>${esc(cust.nama)}</b>.<div style="margin-top:6px">Utang ${esc(cust.nama)} setelah transaksi ini: <b class="sesudahN"></b></div>`
          : `⚠️ <b>Uangnya kurang <span class="kurangN"></span>.</b> Tetap bisa diselesaikan, struknya bertulisan <b>KURANG</b>.
             <label>Nama pembeli (boleh kosong)</label><input id="kName" value="${esc(cart.namaBebas || '')}" placeholder="kalau diisi, kekurangannya jadi utang orang ini">
             <div class="muted" style="font-size:13px;margin-top:4px">Kosong = dicatat sebagai kurang bayar di transaksi ini. Kalau nanti dibayar: Riwayat transaksi → Lihat → Terima kekurangan.</div>`);
    }
    kb.classList.toggle('hide', !kurang);
    $$('.kurangN', kb).forEach(x => (x.textContent = 'Rp ' + rp(-c)));
    if (cust && kurang) {
      // perkiraan utang setelah ini: utang lama yang ikut dibayar di sini dilunasi dulu, kekurangan jadi utang baru
      const saldo = Math.max(0, saldoUtang(cust.id));
      const ulIni = cart.items
        .filter(i => i.utangLama && i.customerId === cust.id)
        .reduce((a, i) => a + i.harga * i.qty, 0);
      $$('.sesudahN', kb).forEach(x => (x.textContent = 'Rp ' + rp(saldo - Math.min(ulIni, saldo) - c)));
    }
    $('#done', m).innerHTML = kurang ? `✔ Selesai, kurang Rp ${rp(-c)} (Enter)` : '✔ Selesai (Enter)';
  };
  $('#paid', m).oninput = upd;
  $('#dp', m).oninput = drawBagi;
  $$('[data-q]', m).forEach(
    b =>
      (b.onclick = () => {
        $('#paid', m).value = rp(b.dataset.q);
        upd();
        $('#done', m).focus();
      })
  );
  $$('[data-mt]', m).forEach(
    b =>
      (b.onclick = () => {
        if (b.disabled) return;
        metode = b.dataset.mt;
        $$('[data-mt]', m).forEach(x => x.classList.toggle('on', x === b));
        $('#cashPart', m).classList.toggle('hide', metode !== 'tunai');
        $('#qrisPart', m).classList.toggle('hide', metode !== 'qris');
        $('#trfPart', m).classList.toggle('hide', metode !== 'transfer');
        $('#utangPart', m).classList.toggle('hide', metode !== 'utang');
        if (metode === 'qris' && qris && !$('#qrImg', m).innerHTML) {
          try {
            $('#qrImg', m).innerHTML = qrImg(qrisDynamic(qris.payload, t.total), 8);
          } catch (e) {
            $('#qrImg', m).innerHTML = '<div class="banner">QRIS gagal dibuat: ' + esc(e.message) + '</div>';
          }
        }
        drawBagi();
        if (metode === 'utang') {
          const u = $('#uName', m);
          (u && !u.value ? u : $('#dp', m)).focus();
        } else $('#done', m).focus();
      })
  );
  let sibuk = false;
  // pelanggan untuk utang: yang sudah terdaftar, atau didaftarkan dari nama yang diketik
  const pelangganDariNama = async n => {
    let c = matchCustomer(n);
    if (!c) {
      c = { id: uid(), nama: n, tier: cart.tier, telp: '', alamat: '', aktif: true };
      await ensureKode(c);
      await save('customers', c);
      toast('Pelanggan baru didaftarkan: ' + n);
    }
    cart.customerId = c.id;
    cart.namaBebas = '';
    return c;
  };
  const done = async () => {
    if (sibuk) return;
    let bayar = t.total;
    let c = cust;
    let mt = metode;
    const extra = {};
    // struk tanpa QR kalau uang bayarnya diisi (lunas / uang pas / berapa pun), supaya hemat kertas.
    // QR tetap dicetak kalau uang bayarnya tidak diisi.
    if (
      mt === 'qris' ||
      mt === 'transfer' ||
      (mt === 'tunai' && $('#paid', m).value.trim()) ||
      (mt === 'utang' && $('#dp', m).value.trim())
    )
      extra.tanpaQR = true;
    if (mt === 'tunai') {
      bayar = num($('#paid', m).value) || t.total;
      if (bayar < t.total) {
        // uang kurang (termasuk ada BRILink / bayar utang lama): tetap selesai & tercetak.
        // Kalau ada nama jadi utang orang itu, kalau tidak dicatat sebagai kurang di transaksi ini.
        const n = c ? '' : (($('#kName', m) || {}).value || '').trim().toUpperCase();
        if (c || n) {
          if (!c) c = await pelangganDariNama(n);
          mt = 'utang';
          extra.kurangBayar = true;
        } else extra.kurang = t.total - bayar;
      }
    }
    if (mt === 'qris' && !qris) return toast('QRIS belum diatur di Pengaturan', true);
    if (mt === 'utang' && !extra.kurangBayar) {
      if (!c) {
        const n = ($('#uName', m).value || '').trim().toUpperCase();
        if (!n) return toast('Isi nama yang berutang', true);
        c = await pelangganDariNama(n);
      }
      bayar = Math.min(t.total, num($('#dp', m).value));
    }
    sibuk = true;
    const sale = await finishSale(mt, bayar, t, extra);
    S.meta.autoPrint = $('#prn', m).checked;
    saveMeta('autoPrint');
    m.remove();
    if ($('#prn', m).checked) printReceipt(sale);
    toast(
      extra.kurangBayar
        ? `Selesai ✔ Kurang Rp ${rp(t.total - bayar)} dicatat sebagai utang ${c.nama}`
        : extra.kurang
          ? `Selesai ✔ Uangnya kurang Rp ${rp(extra.kurang)}, sudah dicatat`
          : mt === 'utang'
            ? 'Tersimpan sebagai utang ✔'
            : mt === 'tunai'
              ? `Selesai ✔  Kembalian Rp ${rp(Math.max(0, bayar - t.total))}`
              : 'Selesai ✔ Dibayar via ' + METODE[mt]
    );
    render();
  };
  $('#done', m).onclick = done;
  m.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      done();
    }
  });
}
/** Total minus (tarik tunai lebih besar dari belanja): kasir memberikan uang ke pelanggan */
function bayarUangKeluar(t) {
  const cust = custOf();
  const m = modal(
    `<h3>💵 Berikan uang ke pelanggan</h3>
    <div class="totalbox" style="background:${infoKas('brilink').warna}"><span class="lbl">Uang yang diberikan</span><div class="amt">Rp ${rp(-t.total)}</div>${cust || cart.namaBebas ? `<div class="lbl">${esc(cust ? cust.nama : cart.namaBebas)}</div>` : ''}</div>
    ${pembagianHTML(rincianKeranjang('tunai', 0), true)}
    <label><input type="checkbox" id="prn" ${S.meta.autoPrint !== false ? 'checked' : ''}> Cetak struk</label>
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-close>Kembali</button><button class="btn ok big" id="done" autofocus>✔ Selesai (Enter)</button></div>`,
    { onClose: focusScan }
  );
  let sibuk = false;
  $('#done', m).onclick = async () => {
    if (sibuk) return;
    sibuk = true;
    const sale = await finishSale('tunai', 0, t);
    S.meta.autoPrint = $('#prn', m).checked;
    saveMeta('autoPrint');
    m.remove();
    if ($('#prn', m).checked) printReceipt(sale);
    toast(`Selesai ✔ Berikan Rp ${rp(-t.total)} ke pelanggan`);
    render();
  };
}
/** Transaksi dibatalkan / diubah: pembayaran utang lama di dalamnya ikut dihapus */
async function hapusBayarUtangDalam(s) {
  for (const p of S.payments.filter(x => x.saleId === s.id && x.dalamTransaksi))
    await remove('payments', p.id);
}
async function finishSale(metode, bayar, t, extra = {}) {
  const d = new Date();
  const cust = custOf();
  const old = cart.editOf ? S.sales.find(s => s.id === cart.editOf && !s.batal) : null;
  let no,
    waktu = d.getTime();
  if (old) {
    const base = old.no.replace(/-U\d+$/, '');
    let k = 1;
    while (S.sales.some(s => s.no === base + '-U' + k)) k++;
    no = base + '-U' + k;
    waktu = old.waktu;
  } else {
    const k = dkey(d);
    S.meta.saleSeq[k] = (S.meta.saleSeq[k] || 0) + 1;
    await saveMeta('saleSeq');
    no = k.replace(/-/g, '') + '-' + pad(S.meta.saleSeq[k], 4);
  }
  const sale = {
    id: uid(),
    no,
    waktu,
    customerId: cust ? cust.id : '',
    customerNama: cust ? cust.nama : cart.namaBebas || '',
    tier: cart.tier,
    // laci tiap baris ikut disimpan, supaya laporan lama tidak berubah kalau barang dipindah laci
    items: cart.items.map(i => ({ ...i, kas: kasBaris(i) })),
    subtotal: t.sub,
    diskon: t.diskon,
    total: t.total,
    metode,
    bayar,
    kembali: metode === 'tunai' ? Math.max(0, bayar - t.total) : 0,
    utang: metode === 'utang' ? Math.max(0, t.total - bayar) : 0,
    kasir: settings().kasir || ''
  };
  // uang kurang tanpa nama: kekurangannya dicatat di transaksi ini (bisa diterima nanti)
  if (extra.kurang > 0) sale.kurang = extra.kurang;
  // uang kurang dengan nama: dicatat sebagai utang pelanggan, struk bertulisan KURANG
  if (extra.kurangBayar) sale.kurangBayar = true;
  if (extra.tanpaQR) sale.tanpaQR = true;
  if (cust) {
    sale.customerKode = cust.kode || '';
    if (cart.poinPakai) {
      sale.poinPakai = cart.poinPakai;
      sale.potonganPoin = t.potPoin;
    }
    if (loyEligible(cust)) sale.poinDapat = Math.floor(t.poinBase / loy().perRp);
  }
  if (old) {
    sale.mengganti = old.no;
    sale.waktuUbah = d.getTime();
  }
  if (cart.orderId) {
    sale.dariPesanan = true;
    if (cart.orderInfo && cart.orderInfo.catatan) sale.catatan = cart.orderInfo.catatan;
    S.meta.orders = ordersPending().filter(x => x.id !== cart.orderId);
    await saveMeta('orders');
  }
  await save('sales', sale);
  bacakanSelesai(sale);
  // utang lama yang dibayar sekalian: catatan utang pelanggannya ikut berkurang
  // (uangnya sudah dihitung di transaksi ini, jadi ditandai "dalamTransaksi")
  if (old) await hapusBayarUtangDalam(old);
  for (const it of sale.items) {
    if (!it.utangLama || !it.customerId) continue;
    const sisa = saldoUtang(it.customerId);
    const j = Math.min(it.harga * it.qty, Math.max(0, sisa));
    if (j > 0)
      await save('payments', {
        id: uid(),
        customerId: it.customerId,
        saleId: sale.id,
        dalamTransaksi: true,
        waktu: d.getTime(),
        jumlah: j,
        kas: kasBaris(it),
        metode: metode === 'tunai' ? 'tunai' : 'transfer',
        catatan: 'Dibayar bersama transaksi ' + no + (it.catatan ? ' · ' + it.catatan : '')
      });
  }
  // sisa utang pelanggan setelah transaksi ini (dicetak di struk, tidak berubah saat cetak ulang)
  if (cust) {
    const sisaU = saldoUtang(cust.id);
    if (sale.utang > 0 || sale.items.some(i => i.utangLama) || sisaU > 0) {
      sale.sisaUtangSetelah = Math.max(0, sisaU);
      await save('sales', sale);
    }
  }
  const touched = new Map();
  if (old) {
    old.batal = true;
    old.waktuBatal = d.getTime();
    old.digantiOleh = no;
    await save('sales', old);
    for (const it of old.items) {
      if (it.manual) continue;
      const p = S.products.find(x => x.id === it.productId);
      if (p) {
        p.stok = r4((Number(p.stok) || 0) + qtyDasar(p, it));
        touched.set(p.id, p);
      }
    }
  }
  for (const it of sale.items) {
    if (it.manual) continue;
    const p = S.products.find(x => x.id === it.productId);
    if (p) {
      p.stok = r4((Number(p.stok) || 0) - qtyDasar(p, it));
      touched.set(p.id, p);
    }
  }
  if (touched.size) await DB.putMany('products', [...touched.values()]);
  if (cust && (sale.poinDapat || sale.poinPakai || saldoPoin(cust.id))) {
    sale.poinSaldo = saldoPoin(cust.id);
    await save('sales', sale);
  }
  resetCart();
  return sale;
}
/* ---- riwayat, duplikat & ubah transaksi ---- */
function historyDialog() {
  let range = 'today';
  const m = modal(
    `<h3>🧾 Riwayat transaksi</h3>
    <div class="tabs2">${[
      ['today', 'Hari ini'],
      ['yday', 'Kemarin'],
      ['7', '7 hari'],
      ['30', '30 hari'],
      ['all', 'Semua']
    ]
      .map(([k, l]) => `<button data-r="${k}" class="${k === range ? 'on' : ''}">${l}</button>`)
      .join('')}</div>
    <input id="hq" placeholder="Cari nama pembeli, nomor, atau nama barang…" autofocus>
    <div class="tablewrap" style="max-height:58vh;margin-top:8px"><table><thead><tr><th>Waktu</th><th>Pembeli</th><th>Harga</th><th>Bayar</th><th class="num">Total</th><th></th></tr></thead><tbody id="hl"></tbody></table></div>
    <div id="hsum" class="hsum"></div>
    <div class="right" style="margin-top:12px"><button class="btn ghost" data-close>Tutup</button></div>`,
    { wide: true, onClose: focusScan }
  );
  const draw = () => {
    const q = $('#hq', m).value.trim().toLowerCase();
    const from = { today: dayStart(0), yday: dayStart(-1), 7: dayStart(-6), 30: dayStart(-29), all: 0 }[
      range
    ];
    const to = range === 'yday' ? dayStart(0) : Infinity;
    let l = S.sales.filter(s => s.waktu >= from && s.waktu < to);
    if (q)
      l = l.filter(s =>
        (
          s.no +
          ' ' +
          (s.customerNama || '') +
          ' ' +
          tierName(s.tier || 'umum') +
          ' ' +
          s.items.map(i => i.nama).join(' ')
        )
          .toLowerCase()
          .includes(q)
      );
    l = l.sort((a, b) => (b.waktuUbah || b.waktu) - (a.waktuUbah || a.waktu)).slice(0, 300);
    $('#hl', m).innerHTML =
      l
        .map(
          s =>
            `<tr style="cursor:pointer;${s.batal ? 'opacity:.5' : ''}" data-s="${s.id}"><td>${tglJam(s.waktu)}<br><span class="muted" style="font-size:12px;font-family:monospace">${esc(s.no)}</span></td><td><b>${esc(namaPembeli(s))}</b> ${kasDalamSale(
              s
            )
              .filter(k => k !== 'warung')
              .map(k => kasPill(k))
              .join(
                ' '
              )}<br><span class="muted" style="font-size:13px">${ringkasIsi(s)}${s.batal ? ' · <b style="color:var(--bad)">' + (s.digantiOleh ? 'diubah' : 'dibatalkan') + '</b>' : ''}${!s.batal && sisaKurang(s) > 0 ? ` · <b style="color:var(--bad)">kurang Rp ${rp(sisaKurang(s))}</b>` : ''}</span></td><td>${tierPill(s.tier)}</td><td>${metodeBadge(s.metode)}</td><td class="num"><b>${totalTeks(s)}</b></td><td class="right"><button class="btn sm ghost">Lihat</button></td></tr>`
        )
        .join('') || '<tr><td colspan="6" class="empty">Tidak ada transaksi.</td></tr>';
    const sah = l.filter(s => !s.batal);
    const bri = sah.filter(s => rincianSale(s).kas.brilink);
    $('#hsum', m).innerHTML = sah.length
      ? tiers()
          .map(t => {
            const x = sah.filter(s => (s.tier || 'umum') === t.id && penjualanSale(s));
            return x.length
              ? `<span>${tierPill(t.id)} <b>${x.length}</b> transaksi · <b>Rp ${rp(x.reduce((a, s) => a + penjualanSale(s), 0))}</b></span>`
              : '';
          })
          .join('') +
        (bri.length
          ? `<span>${kasPill('brilink')} <b>${bri.length}</b> transaksi · admin <b>Rp ${rp(bri.reduce((a, s) => a + rincianSale(s).kas.brilink.admin, 0))}</b></span>`
          : '')
      : '';
    $$('[data-s]', m).forEach(
      r =>
        (r.onclick = () =>
          saleDetail(
            S.sales.find(s => s.id === r.dataset.s),
            draw
          ))
    );
  };
  $$('[data-r]', m).forEach(
    b =>
      (b.onclick = () => {
        range = b.dataset.r;
        $$('[data-r]', m).forEach(x => x.classList.toggle('on', x === b));
        draw();
      })
  );
  $('#hq', m).oninput = draw;
  draw();
}
async function loadSaleToCart(s, mode) {
  if (cart.items.length) {
    if (
      !(await confirmBox(
        'Keranjang sekarang masih ada isinya. Simpan sebagai "Tunda" dulu lalu lanjut?',
        'Tunda & lanjut'
      ))
    )
      return;
    await holdCart(true);
  }
  resetCart();
  const c = S.customers.find(x => x.id === s.customerId);
  cart.customerId = c ? c.id : '';
  cart.namaBebas = c ? '' : s.customerNama || '';
  cart.tier = tiers().some(t => t.id === s.tier) ? s.tier : 'umum';
  cart.items = s.items
    .filter(i => !(i.utangLama && mode === 'dup')) // utang lama tidak ikut diduplikat
    .map(i => {
      const p = S.products.find(x => x.id === i.productId);
      if (mode === 'dup' && p) return cartItemFor(p, i.satuan || p.satuan, i.qty);
      return { ...i, productId: i.manual && mode === 'dup' ? 'manual-' + uid() : i.productId };
    });
  if (mode === 'edit') {
    cart.diskon = s.diskon || 0;
    cart.editOf = s.id;
    cart.poinPakai = s.poinPakai || 0;
  }
  $$('.modal').forEach(x => x.remove());
  go('kasir');
  toast(
    mode === 'edit'
      ? 'Silakan ubah, lalu Bayar untuk menyimpan perubahan'
      : 'Transaksi diduplikat. Tambah/ubah barang lalu Bayar.'
  );
}
