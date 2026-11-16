/* ============ UBAH HARGA DARI KASIR ============
 * 1. Harga yang diketik di keranjang langsung tersimpan ke data produk (kategori harga & satuan yang
 *    sedang dipakai). Muncul catatan kecil dengan tombol "Hanya transaksi ini" untuk membatalkannya.
 * 2. Tombol ✏️ membuka form harga lengkap (harga beli, perorangan, warung) untuk satuan itu.
 * Semua perubahan langsung terlihat di halaman Produk karena memakai data yang sama.
 */
function hargaKasirDisimpan() {
  return settings().hargaKasirSimpan !== false;
}
/** Objek harga {umum, warung, ...} milik satuan tertentu */
function hargaObj(p, unitName) {
  const u = unitByName(p, unitName);
  const target = u.base ? p : (p.units || []).find(x => x.nama === u.nama);
  target.harga = target.harga || {};
  return target.harga;
}
function setHargaBeliUnit(p, unitName, nilai) {
  const u = unitByName(p, unitName);
  if (u.base) p.hargaBeli = nilai;
  else (p.units || []).find(x => x.nama === u.nama).hargaBeli = nilai;
}
/** Tandai harga sudah diatur pemilik (bukan hasil otomatis lagi) */
function hargaSudahDiatur(p, unitName) {
  tandaiWarungBenar(p, unitName);
  delete p.revisiHarga;
  delete p.dariDaftar;
  p.hargaDiubah = Date.now();
  p.diubah = Date.now();
}
/** Samakan harga di keranjang dengan data produk untuk produk & satuan ini */
function segarkanHargaKeranjang(p, unitName, kecuali) {
  cart.items.forEach((it, i) => {
    if (i === kecuali || it.productId !== p.id || (it.satuan || p.satuan) !== unitName) return;
    it.harga = priceUnit(p, unitName, cart.tier);
    it.hargaBeli = hbUnit(p, unitName);
  });
}

/* ---- 1. harga diketik langsung di keranjang ---- */
let notaHargaTimer;
async function hargaDiubahDiKeranjang(idx, nilai) {
  const it = cart.items[idx];
  if (!it) return;
  it.harga = nilai;
  const p = !it.manual && S.products.find(x => x.id === it.productId);
  const unit = p && (it.satuan || p.satuan);
  if (!p || !(nilai > 0) || !hargaKasirDisimpan() || nilai === priceUnit(p, unit, cart.tier)) return;
  const h = hargaObj(p, unit);
  const tier = cart.tier;
  const sebelum = h[tier];
  const tampilSebelum = priceUnit(p, unit, tier);
  h[tier] = nilai;
  hargaSudahDiatur(p, unit);
  await save('products', p);
  segarkanHargaKeranjang(p, unit, idx);
  const box = $('#priceNote');
  if (!box) return;
  box.innerHTML = `<span class="grow">💾 Harga <b>${esc(tierName(tier))}</b> ${esc(p.nama)} (${esc(unit)}): Rp ${rp(tampilSebelum)} → <b>Rp ${rp(nilai)}</b>, sudah tersimpan ke data produk.</span>
    <button class="btn sm ghost" id="pnUndo">↩ Hanya untuk transaksi ini</button><button class="btn sm ghost" id="pnEdit">✏️ Atur harga lain</button>`;
  box.classList.remove('hide');
  clearTimeout(notaHargaTimer);
  notaHargaTimer = setTimeout(() => box.classList.add('hide'), 20000);
  $('#pnUndo').onclick = async () => {
    if (sebelum === undefined) delete h[tier];
    else h[tier] = sebelum;
    await save('products', p);
    segarkanHargaKeranjang(p, unit, idx);
    box.classList.add('hide');
    drawCart();
    toast('Harga produk dikembalikan. Rp ' + rp(nilai) + ' hanya untuk transaksi ini.');
    focusScan();
  };
  $('#pnEdit').onclick = () => {
    box.classList.add('hide');
    ubahHargaDialog(p, unit);
  };
}

/* ---- 2. form harga lengkap ---- */
function ubahHargaDialog(p, unitName) {
  let unit = unitByName(p, unitName).nama;
  const A = autoWarung();
  const m = modal(
    `<h3>✏️ Ubah harga · ${esc(p.nama)}</h3>
   <p class="muted" style="margin-top:0">Langsung tersimpan ke data produk. Transaksi yang sudah lewat tidak berubah.</p>
   ${
     unitsOf(p).length > 1
       ? `<label>Satuan</label><select id="uhU" style="max-width:240px">${unitsOf(p)
           .map(u => `<option ${u.nama === unit ? 'selected' : ''}>${esc(u.nama)}</option>`)
           .join('')}</select>`
       : ''
   }
   <div id="uhF"></div>
   <div class="row actbar"><span class="grow muted" style="font-size:13px">Enter = simpan</span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="uhOk">💾 Simpan harga</button></div>`,
    { onClose: focusScan }
  );
  let ubahU = false,
    ubahW = false;
  const isi = () => {
    const h = hargaObj(p, unit);
    ubahU = ubahW = false;
    $('#uhF', m).innerHTML =
      `<div class="grid3" style="align-items:end"><div><label>Harga beli / ${esc(unit)}</label><input id="uhB" inputmode="numeric" value="${hbUnit(p, unit) ? rp(hbUnit(p, unit)) : ''}" placeholder="opsional"></div>${tiers()
        .map(
          t =>
            `<div><label style="color:${tierColor(t.id)};font-weight:700">Harga ${esc(t.nama)} / ${esc(unit)}</label><input data-uh="${t.id}" inputmode="numeric" value="${h[t.id] ? rp(h[t.id]) : ''}" ${t.id === tier0() ? 'autofocus' : ''}></div>`
        )
        .join('')}</div><div id="uhHint" class="autohint"></div>`;
    const u = $('[data-uh=umum]', m),
      w = $('[data-uh=warung]', m),
      hint = $('#uhHint', m);
    if (u && w && A.aktif) {
      u.addEventListener('input', () => {
        ubahU = true;
        if (ubahW) return;
        const v = hitungHargaWarung(num(u.value), num($('#uhB', m).value));
        w.value = v ? rp(v) : '';
        hint.textContent = v
          ? `⚙ Harga warung ikut diisi (perorangan − ${rp(A.selisih)}). Ganti kalau beda.`
          : '';
      });
      w.addEventListener('input', () => {
        ubahW = true;
        if (ubahU) return;
        const v = num(w.value);
        u.value = v ? rp(v + (Number(A.selisih) || 0)) : '';
        hint.textContent = v
          ? `⚙ Harga perorangan ikut diisi (warung + ${rp(A.selisih)}). Ganti kalau beda.`
          : '';
      });
    }
    setTimeout(() => {
      const f = $('[data-uh="' + tier0() + '"]', m) || $('[data-uh]', m);
      f && (f.focus(), f.select());
    }, 40);
  };
  const tier0 = () => (tiers().some(t => t.id === cart.tier) ? cart.tier : 'umum');
  isi();
  $('#uhU', m) &&
    ($('#uhU', m).onchange = e => {
      unit = e.target.value;
      isi();
    });
  const simpan = async () => {
    const baru = {};
    $$('[data-uh]', m).forEach(i => {
      const v = num(i.value);
      if (v) baru[i.dataset.uh] = v;
    });
    if (!baru.umum) return toast('Harga ' + tierName('umum') + ' wajib diisi', true);
    const h = hargaObj(p, unit);
    Object.keys(h).forEach(k => delete h[k]);
    Object.assign(h, baru);
    const hb = num($('#uhB', m).value);
    if (hb || $('#uhB', m).value.trim() === '') setHargaBeliUnit(p, unit, hb);
    hargaSudahDiatur(p, unit);
    await save('products', p);
    segarkanHargaKeranjang(p, unit, -1);
    m.close();
    if (currentView === 'kasir') drawCart();
    toast(`Harga ${p.nama} (${unit}) disimpan ✔ Halaman Produk ikut berubah.`);
  };
  $('#uhOk', m).onclick = simpan;
  m.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      simpan();
    }
  });
}
