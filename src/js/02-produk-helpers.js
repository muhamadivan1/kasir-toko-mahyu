/* ============ PRODUK HELPERS ============ */
function priceOf(p, tier) {
  const pr = p.harga || {};
  const v = pr[tier];
  return v !== undefined && v !== null && v !== '' ? Number(v) : Number(pr.umum || 0);
}
const nbc = c => {
  c = String(c ?? '').trim();
  return /^\d+$/.test(c) ? c.replace(/^0+/, '') : c.toUpperCase();
};
function findBarcodeHit(code, includeInactive) {
  const k = nbc(code);
  if (!k) return null;
  for (const p of S.products) {
    if (!includeInactive && p.aktif === false) continue;
    if (nbc(p.barcode) === k || (p.barcode2 || []).some(b => nbc(b) === k)) return { p, unit: null };
    const u = (p.units || []).find(u => u.barcode && nbc(u.barcode) === k);
    if (u) return { p, unit: u.nama };
  }
  return null;
}
function findBarcode(code, includeInactive) {
  const h = findBarcodeHit(code, includeInactive);
  return h ? h.p : null;
}
function unitsOf(p) {
  return [
    { nama: p.satuan || 'PCS', isi: 1, base: true },
    ...(p.units || []).map(u => ({ ...u, isi: Number(u.isi) || 1 }))
  ];
}
function unitByName(p, n) {
  const l = unitsOf(p);
  return l.find(u => u.nama === n) || l[0];
}
function unitScanOf(p) {
  const n = p.unitScan;
  return n && unitsOf(p).some(u => u.nama === n) ? n : p.satuan || 'PCS';
}
function priceUnit(p, unitName, tier) {
  const u = unitByName(p, unitName);
  if (u.base) return priceOf(p, tier);
  const h = u.harga || {};
  return Number(h[tier]) || Number(h.umum) || Math.round(priceOf(p, tier) * u.isi);
}
function hbUnit(p, unitName) {
  const u = unitByName(p, unitName);
  if (u.base) return Number(p.hargaBeli) || 0;
  return Number(u.hargaBeli) || Math.round((Number(p.hargaBeli) || 0) * u.isi);
}
const r4 = x => Math.round(x * 10000) / 10000;
/* Jumlah stok (dalam satuan dasar SEKARANG) untuk satu baris transaksi */
function qtyDasar(p, it) {
  let q = (Number(it.qty) || 0) * (Number(it.isi) || 1);
  const d = it.dasar || p.satuanAwal;
  if (d && d !== p.satuan) {
    const u = (p.units || []).find(x => x.nama === d);
    if (u) q *= Number(u.isi) || 1;
  }
  return r4(q);
}
/* Satuan dasar selalu satuan terkecil: kalau ada satuan dengan isi < 1, pindahkan dasar ke satuan itu */
function rebaseToSmallest(p) {
  const us = (p.units || []).filter(u => Number(u.isi) > 0);
  const sm = us.reduce((a, u) => (Number(u.isi) < Number(a ? a.isi : 1) ? u : a), null);
  if (!sm || Number(sm.isi) >= 1) return false;
  let f = 1 / Number(sm.isi);
  if (Math.abs(f - Math.round(f)) < 0.01) f = Math.round(f);
  const old = {
    nama: p.satuan || 'PCS',
    isi: f,
    harga: { ...(p.harga || {}) },
    hargaBeli: Number(p.hargaBeli) || 0,
    barcode: ''
  };
  p.satuanAwal = p.satuanAwal || p.satuan;
  if (!p.unitScan) p.unitScan = p.satuan;
  p.satuan = sm.nama;
  p.harga = { ...(sm.harga || {}) };
  if (!p.harga.umum && old.harga.umum) p.harga.umum = Math.round(old.harga.umum / f);
  p.hargaBeli = Number(sm.hargaBeli) || (old.hargaBeli ? Math.round(old.hargaBeli / f) : 0);
  if (sm.barcode && nbc(sm.barcode) !== nbc(p.barcode))
    p.barcode2 = [...new Set([...(p.barcode2 || []), sm.barcode])];
  p.units = [old, ...us.filter(u => u !== sm).map(u => ({ ...u, isi: r4(Number(u.isi) * f) }))].sort(
    (a, b) => a.isi - b.isi
  );
  p.stok = r4((Number(p.stok) || 0) * f);
  p.minStok = r4((Number(p.minStok) || 0) * f);
  return true;
}
function fmtStok(p) {
  const s = Number(p.stok) || 0;
  const big = (p.units || []).filter(u => Number(u.isi) > 1).sort((a, b) => b.isi - a.isi)[0];
  let t = `${rp(s)} ${esc(p.satuan || '')}`;
  if (big && Math.abs(s) >= big.isi) {
    const n = Math.trunc(s / big.isi),
      r = r4(s - n * big.isi);
    t += ` <span class="muted" style="font-size:12px">(${rp(n)} ${esc(big.nama)}${r ? ` + ${rp(r)} ${esc(p.satuan)}` : ''})</span>`;
  }
  return t;
}
const fmtIsi = x => String(r4(x)).replace('.', ',');
/** Tambah satuan lain yang isinya beda (misal RCG isi 10, SETENGAH isi 5, DUS isi 40).
 *  Isinya boleh ditulis terhadap satuan mana saja yang sudah ada: "1 RCG = 2 SETENGAH" atau "1 SETENGAH = 5 PCS".
 *  Hasil hitungannya selalu ditampilkan dalam satuan dasar ("Artinya: 1 SETENGAH = 5 PCS") supaya tidak salah. */
function quickUnitDialog(p, done) {
  const base = p.satuan || 'PCS';
  const ada = unitsOf(p);
  const have = new Set(ada.map(u => u.nama));
  const opts = [
    ...new Set([
      ...SATUAN_LIST,
      ...S.products.flatMap(x => [x.satuan, ...(x.units || []).map(u => u.nama)]).filter(Boolean)
    ])
  ].filter(s => !have.has(s));
  const rcg = ada.find(u => RE_RCG.test(u.nama));
  const terbesar = [...ada].sort((a, b) => b.isi - a.isi)[0];
  const awal = RE_SETENGAH.test(opts[0] || '') && !rcg ? opts[1] : opts[0];
  const m = modal(
    `<h3>➕ Tambah satuan · ${esc(p.nama)}</h3>
   <p class="muted" style="margin-top:0">Satuan sekarang: <b>${ada.map(u => esc(u.nama) + (u.base ? '' : ` (isi ${fmtIsi(u.isi)} ${esc(base)})`)).join(', ')}</b>. Barcode tetap sama, nanti di kasir tinggal pilih satuannya.</p>
   <div class="grid2"><div><label>Satuan baru</label><select id="qn">${opts.map(s => `<option ${s === awal ? 'selected' : ''}>${esc(s)}</option>`).join('')}<option value="__new">➕ Satuan lain…</option></select></div>
   <div><label>Satuan baru ini…</label><select id="qd"><option value="besar">lebih BESAR (grosir)</option><option value="kecil">lebih KECIL (eceran)</option></select></div></div>
   <div class="unitrel" id="qrel"><label>Isinya</label><div class="row relrow" id="qrow"></div>
     <div id="qarti" class="satprev"></div><p class="muted" id="qcontoh" style="font-size:13px;margin:6px 0 0"></p></div>
   <h3 style="margin-top:14px">Harga per <span class="qnl"></span></h3>
   <div class="grid3"><div><label>Harga beli (modal)</label><input id="qhb" inputmode="numeric" placeholder="otomatis dihitung"></div>${tiers()
     .map(
       t =>
         `<div><label>Harga ${esc(t.nama)}</label><input data-qt="${t.id}" inputmode="numeric" placeholder="${t.id === 'umum' ? 'otomatis' : tierPlaceholder(t.id)}"></div>`
     )
     .join('')}</div>
   <label>Barcode khusus satuan ini (opsional, kosongkan kalau barcodenya sama)</label><input id="qbc">
   <label><input type="checkbox" id="qdef"> Saat barcode di-scan, langsung pakai satuan <span class="qnl"></span></label>
   <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="qok">Simpan satuan</button></div>`,
    { wide: true }
  );
  selectOrNew($('#qn', m), 'Nama satuan baru (misal: PCS, RCG, DUS):');
  const nm = () => ($('#qn', m).value === '__new' ? '?' : $('#qn', m).value);
  const refOpt = sel =>
    ada
      .map(
        u =>
          `<option value="${esc(u.nama)}" ${u.nama === sel ? 'selected' : ''}>${esc(u.nama)}${u.base ? '' : ` (${fmtIsi(u.isi)} ${esc(base)})`}</option>`
      )
      .join('');
  /** isi satuan baru dalam satuan dasar, dari pilihan di layar */
  const hitung = () => {
    const ref = unitByName(p, $('#qr', m).value);
    const v = num($('#qi', m).value);
    if (!(v > 0)) return 0;
    return r4($('#qd', m).value === 'besar' ? v * ref.isi : ref.isi / v);
  };
  const arti = () => {
    const n = nm(),
      isi = hitung();
    const a = $('#qarti', m);
    const ph = $('[data-qt=umum]', m);
    if (ph)
      ph.placeholder =
        isi > 0 && priceOf(p, 'umum') ? 'otomatis ' + rp(Math.round(priceOf(p, 'umum') * isi)) : 'otomatis';
    if (!isi) return (a.innerHTML = '<span class="muted">Isi angkanya dulu.</span>');
    const sama = ada.find(u => Math.abs(u.isi - isi) < 1e-6);
    let t =
      isi >= 1
        ? `Artinya: <b>1 ${esc(n)} = ${fmtIsi(isi)} ${esc(base)}</b>`
        : `Artinya: <b>1 ${esc(base)} = ${fmtIsi(1 / isi)} ${esc(n)}</b>. ${esc(n)} lebih kecil dari ${esc(base)}, stok nanti dihitung dalam ${esc(n)}.`;
    if (rcg && rcg.nama !== n && isi < rcg.isi && isi >= 1)
      t += `<br>1 ${esc(rcg.nama)} = ${fmtIsi(rcg.isi / isi)} ${esc(n)}`;
    if (sama) t += `<br><span class="warntxt">⚠️ Isinya sama dengan ${esc(sama.nama)}.</span>`;
    if (RE_SETENGAH.test(n) && rcg && Math.abs(isi - rcg.isi / 2) > 1e-6)
      t += `<br><span class="warntxt">⚠️ Setengah renceng seharusnya ${fmtIsi(rcg.isi / 2)} ${esc(base)} (setengah dari 1 ${esc(rcg.nama)} = ${fmtIsi(rcg.isi)} ${esc(base)}).</span>`;
    a.innerHTML = t;
  };
  const rel = (pakaiSaran = true) => {
    const n = nm();
    $$('.qnl', m).forEach(x => (x.textContent = n));
    let ref = $('#qr', m) ? $('#qr', m).value : base,
      qi = $('#qi', m) ? $('#qi', m).value : '';
    if (pakaiSaran) {
      // saran isi yang paling sering benar
      qi = '';
      if (RE_SETENGAH.test(n) && rcg) ($('#qd', m).value = 'kecil'), (ref = rcg.nama), (qi = '2');
      else if (RE_RCG.test(n) && /^(PCS|SACHET|SCT)$/.test(base)) {
        $('#qd', m).value = 'besar';
        ref = base;
        if (sachetMinum(p)) qi = '10';
      } else if (/^(PCS|SACHET|SCT|BTR|BUTIR)$/.test(n) || RE_SETENGAH.test(n)) {
        $('#qd', m).value = 'kecil';
        ref = terbesar.nama;
      } else ($('#qd', m).value = 'besar'), (ref = base);
    }
    const besar = $('#qd', m).value === 'besar';
    const inp = `<input id="qi" inputmode="decimal" style="width:100px;font-size:20px" placeholder="misal ${besar ? '10' : '2'}" value="${esc(qi)}">`;
    const sel = `<select id="qr" style="width:auto;font-size:18px;font-weight:700">${refOpt(ref)}</select>`;
    $('#qrow', m).innerHTML = besar
      ? `<span>1 ${esc(n)} =</span>${inp}${sel}`
      : `<span>1</span>${sel}<span>=</span>${inp}<span>${esc(n)}</span>`;
    $('#qcontoh', m).textContent = besar
      ? `Contoh: 1 RCG = 10 PCS, 1 DUS = 40 PCS.`
      : `Contoh: 1 RCG = 2 SETENGAH (setengah renceng), 1 RCG = 10 PCS.`;
    $('#qi', m).oninput = arti;
    $('#qr', m).onchange = arti;
    arti();
  };
  $('#qn', m).addEventListener('change', () => rel(true));
  $('#qd', m).onchange = () => rel(false);
  rel(true);
  m.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.id !== 'qbc') {
      e.preventDefault();
      $('#qok', m).click();
    }
  });
  $('#qok', m).onclick = async () => {
    const n = $('#qn', m).value;
    if (!n || n === '__new') return toast('Pilih satuan baru', true);
    if (have.has(n)) return toast('Satuan ' + n + ' sudah ada', true);
    if (!(num($('#qi', m).value) > 0)) return toast('Isi belum diisi', true);
    const isi = hitung();
    if (isi === 1) {
      // 1 PCS = 1 RCG artinya satuannya sama: yang dimaksud mengganti nama satuan, bukan menambah
      if (
        (p.units || []).length ||
        !(await confirmBox(
          `Isi 1 berarti satuannya sama saja. Ganti satuan ${base} jadi ${n} untuk barang ini? Harga dan stok tetap.`,
          'Ganti jadi ' + n
        ))
      )
        return (p.units || []).length ? toast(`Isinya sama dengan ${base}`, true) : undefined;
      await gantiNamaSatuan(p, base, n);
      m.close();
      toast(`Satuan diganti: ${base} → ${n} ✔`);
      done && done(n);
      return;
    }
    const sama = ada.find(u => Math.abs(u.isi - isi) < 1e-6);
    if (sama) return toast(`Isinya sama dengan ${sama.nama}. Periksa lagi angkanya.`, true);
    if (RE_SETENGAH.test(n) && rcg && Math.abs(isi - rcg.isi / 2) > 1e-6)
      if (
        !(await confirmBox(
          `Setengah renceng seharusnya ${fmtIsi(rcg.isi / 2)} ${base}, yang diisi ${fmtIsi(isi)} ${base}. Tetap simpan?`,
          'Tetap simpan'
        ))
      )
        return;
    const harga = {};
    $$('[data-qt]', m).forEach(i => {
      const x = num(i.value);
      if (x) harga[i.dataset.qt] = x;
    });
    if (!harga.umum) harga.umum = Math.round(priceOf(p, 'umum') * isi);
    if (!harga.umum) return toast('Isi harga Umum untuk ' + n, true);
    const bc = $('#qbc', m).value.trim();
    if (bc) {
      const o = findBarcode(bc, true);
      if (o && o.id !== p.id) return toast('Barcode sudah dipakai: ' + o.nama, true);
    }
    p.units = [
      ...(p.units || []),
      {
        nama: n,
        isi,
        harga,
        hargaBeli: num($('#qhb', m).value) || 0,
        barcode: bc && nbc(bc) !== nbc(p.barcode) ? bc : ''
      }
    ].sort((a, b) => a.isi - b.isi);
    if ($('#qdef', m).checked) p.unitScan = n;
    else if (!p.unitScan) p.unitScan = base;
    const rb = rebaseToSmallest(p);
    p.diubah = Date.now();
    await save('products', p);
    m.close();
    toast(
      rb
        ? `Satuan ${n} ditambahkan. Stok sekarang dihitung dalam ${p.satuan}.`
        : `Satuan ${n} ditambahkan: 1 ${n} = ${fmtIsi(isi)} ${base} ✔`
    );
    done && done(n);
  };
}
/* ============ ISI SATUAN YANG BENAR ============
 * Renceng minuman sachet (kopi mix, susu sachet, minuman serbuk) = 10 PCS, setengah renceng = 5 PCS.
 * Dulu, menambah "SETENGAH" sebagai satuan lebih KECIL dari PCS membuat hitungannya terbalik:
 * satuan dasar jadi SETENGAH, 1 PCS = 2 SETENGAH, 1 RCG = 20 SETENGAH. rencanaSatuan() mengenali
 * susunan seperti itu, aturUlangSatuan() membetulkannya (stok & riwayat ikut dihitung ulang). */
const RE_RCG = /^(RCG|RENCENG|RENTENG)$/;
const RE_SETENGAH = /^(SETENGAH|STENGAH|SETENGA|STGH|STNGH|1\/2|½)(\s*(RCG|RENCENG|RENTENG))?$/;
const RE_PCS = /^(PCS|SACHET|SCT|SASET)$/;
/** Minuman sachet (kopi, minuman serbuk, susu bubuk sachet): 1 renceng = 10 sachet */
const sachetMinum = p =>
  ['KOPI', 'MINUMAN', 'SUSU', 'KOPI INSTANT', 'SUSU BUBUK', 'MINUMAN SERBUK'].includes(
    String(p.kategori || '').toUpperCase()
  ) &&
  !/KENTAL|SKM|UHT|KOTAK|BOTOL|BTL|KALENG|GELAS|CUP|LITER|\bML\b/.test(String(p.nama || '').toUpperCase());
/** Tulisan isi satuan: "1 RCG = 10 PCS, 1 SETENGAH = 5 PCS" */
function teksIsiSatuan(p) {
  return (
    unitsOf(p)
      .filter(u => !u.base)
      .sort((a, b) => b.isi - a.isi)
      .map(u => `1 ${u.nama} = ${fmtIsi(u.isi)} ${p.satuan}`)
      .join(', ') || '1 satuan: ' + (p.satuan || 'PCS')
  );
}
/** Rencana pembetulan isi satuan, atau null kalau sudah benar.
 *  Hasil: { B: satuan dasar baru, isi: {nama: isi dalam B}, k: isi B dalam satuan dasar lama } */
function rencanaSatuan(p) {
  const us = unitsOf(p);
  const cari = re => us.find(u => re.test(u.nama));
  const rcg = cari(RE_RCG),
    pcs = cari(RE_PCS),
    stg = cari(RE_SETENGAH);
  if (!rcg || !pcs) return null;
  const k = pcs.isi;
  let r = r4(rcg.isi / k);
  if (sachetMinum(p)) r = 10;
  if (!(r > 1)) return null;
  const isi = {};
  us.forEach(u => (isi[u.nama] = r4(u.isi / k)));
  isi[pcs.nama] = 1;
  isi[rcg.nama] = r;
  if (stg) isi[stg.nama] = r4(r / 2);
  const beda = p.satuan !== pcs.nama || us.some(u => Math.abs(isi[u.nama] - u.isi) > 1e-6);
  return beda ? { B: pcs.nama, isi, k } : null;
}
/** Jendela "Betulkan isi satuan": tampilkan hitungan sekarang dan yang benar, lalu terapkan */
function betulkanSatuanDialog(p, done) {
  const r = rencanaSatuan(p);
  if (!r) return done && done();
  const sesudah = Object.keys(r.isi)
    .filter(n => n !== r.B)
    .sort((a, b) => r.isi[b] - r.isi[a])
    .map(n => `1 ${n} = ${fmtIsi(r.isi[n])} ${r.B}`)
    .join(', ');
  let selesai = false;
  const m = modal(
    `<h3>⚖️ Betulkan isi satuan · ${esc(p.nama)}</h3>
   <p style="margin:0 0 6px">Sekarang: <b class="warntxt">${esc(teksIsiSatuan(p))}</b></p>
   <p style="margin:0 0 10px">Seharusnya: <b style="color:var(--ok)">${esc(sesudah)}</b></p>
   <p class="muted" style="font-size:14px;margin:0">${sachetMinum(p) ? '1 renceng minuman sachet berisi 10 sachet (PCS). ' : ''}Setengah renceng = setengah dari 1 renceng. Stok diubah ke ${esc(r.B)}, riwayat penjualan ikut dihitung ulang. Harga yang sudah diketik tetap dipakai.</p>
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Nanti saja</button><button class="btn pri" id="bsOk" autofocus>✔ Betulkan</button></div>`,
    { onClose: () => !selesai && done && done() }
  );
  $('#bsOk', m).onclick = async () => {
    selesai = true;
    await aturUlangSatuan(p, r.B, r.isi, r.k);
    m.close();
    toast('Isi satuan dibetulkan: ' + teksIsiSatuan(p), false, 4000);
    done && done();
  };
}
/** Terapkan isi satuan baru. Stok diubah ke satuan dasar baru, riwayat penjualan & stok ikut diubah.
 *  Penjualan lama yang hitungan stoknya salah (misal 1 SETENGAH dulu dihitung 0,5 PCS, seharusnya 5 PCS)
 *  dibetulkan: selisihnya dikurangkan dari stok sekarang. */
async function aturUlangSatuan(p, B, isiBaru, k) {
  const lama = JSON.parse(JSON.stringify(p));
  const data = {};
  unitsOf(lama).forEach(
    u =>
      (data[u.nama] = u.base
        ? { harga: { ...(lama.harga || {}) }, hargaBeli: Number(lama.hargaBeli) || 0, barcode: '' }
        : { harga: { ...(u.harga || {}) }, hargaBeli: Number(u.hargaBeli) || 0, barcode: u.barcode || '' })
  );
  const b = data[B];
  p.satuan = B;
  p.harga = { ...b.harga };
  p.hargaBeli = b.hargaBeli;
  if (b.barcode && nbc(b.barcode) !== nbc(p.barcode))
    p.barcode2 = [...new Set([...(p.barcode2 || []), b.barcode])];
  p.units = Object.keys(isiBaru)
    .filter(n => n !== B)
    .map(n => {
      const d = data[n] || { harga: {}, hargaBeli: 0, barcode: '' };
      const isiDulu = unitByName(lama, n).isi / k; // isi lama dalam satuan B
      const berubah = Math.abs(isiBaru[n] - isiDulu) > 1e-6;
      // harga yang dulu dihitung otomatis dari isi yang salah (harga B x isi lama) dibuang,
      // supaya dihitung ulang dari isi yang benar. Harga yang diketik sendiri tetap dipakai.
      const turunan = (x, y) => berubah && x > 0 && Math.abs(x - Math.round((Number(y) || 0) * isiDulu)) <= 1;
      const harga = {};
      Object.keys(d.harga).forEach(t => {
        if (!turunan(Number(d.harga[t]), b.harga[t])) harga[t] = d.harga[t];
      });
      const hargaBeli = turunan(d.hargaBeli, b.hargaBeli) ? 0 : d.hargaBeli;
      return { nama: n, isi: r4(isiBaru[n]), harga, hargaBeli, barcode: d.barcode };
    })
    .sort((x, y) => x.isi - y.isi);
  p.stok = r4((Number(lama.stok) || 0) / k);
  p.minStok = r4((Number(lama.minStok) || 0) / k);
  let koreksi = 0;
  const ubahItem = (it, hitungStok) => {
    if (!it || it.productId !== p.id || it.layanan || it.manual) return false;
    const dulu = qtyDasar(lama, it) / k; // jumlah yang dulu mengurangi stok, dalam B
    const n = isiBaru[it.satuan];
    const kini = n !== undefined ? r4((Number(it.qty) || 0) * n) : dulu;
    if (hitungStok) koreksi += kini - dulu;
    it.isi = n !== undefined ? n : r4(dulu / (Number(it.qty) || 1));
    it.dasar = B;
    return true;
  };
  for (const s of S.sales) {
    let u = false;
    (s.items || []).forEach(it => ubahItem(it, !s.batal) && (u = true));
    if (u) await save('sales', s);
  }
  p.stok = r4(p.stok - koreksi);
  if (k !== 1)
    for (const mv of S.moves) {
      if (mv.productId !== p.id) continue;
      ['qty', 'sebelum', 'sesudah'].forEach(f => mv[f] !== undefined && (mv[f] = r4(Number(mv[f]) / k)));
      await save('moves', mv);
    }
  if (typeof cart !== 'undefined' && cart.items) cart.items.forEach(it => ubahItem(it, false));
  let h = false;
  (S.meta.held || []).forEach(x =>
    ((x.cart && x.cart.items) || []).forEach(it => ubahItem(it, false) && (h = true))
  );
  if (h) await saveMeta('held');
  if (p.satuanAwal && !unitsOf(p).some(u => u.nama === p.satuanAwal)) p.satuanAwal = B;
  p.diubah = Date.now();
  await save('products', p);
  return { koreksi: r4(koreksi) };
}
/* ============ GANTI NAMA SATUAN ============
 * Untuk satuan yang salah pilih saat input produk (misal PCS padahal RCG).
 * Hanya NAMA satuannya yang diganti: 1 PCS menjadi 1 RCG, harga, stok, dan isi satuan lain tetap.
 * Riwayat transaksi, keranjang yang sedang dibuka / ditunda, dan hadiah poin ikut memakai nama baru,
 * supaya laporan dan struk cetak ulang tidak menulis satuan yang salah. */
const KATA_SATUAN =
  /(?:^|\s)(PCS|RCG|RENCENG|BKS|BTL|DUS|KTN|PAK|PACK|PCK|SLOP|SLP|BOX|LUSIN|KLG|SACHET|STRIP|POUCH|TOPLES|BAG|IKAT|SAK|LENTE|GALON|TABUNG)\.?\s*$/;
/** Satuan yang tertulis di ujung nama barang ("KAPAL API MIX RCG" -> RCG), kalau berbeda dengan satuan barang.
 *  Ukuran ("6 PCS", "1 KG") tidak dihitung karena itu isi kemasan, bukan satuan jual. */
function saranSatuanDariNama(p) {
  const nm = String(p.nama || '').toUpperCase();
  const m = nm.match(KATA_SATUAN);
  if (!m || /\d$/.test(nm.slice(0, m.index).trimEnd())) return '';
  const s = m[1] === 'RENCENG' ? 'RCG' : m[1];
  return unitsOf(p).some(u => u.nama === s) ? '' : s;
}
/** Nama barang setelah satuan di ujungnya diganti: "... 23 GR PCS" -> "... 23 GR RCG" */
function namaDenganSatuan(nama, lama, baru) {
  const re = new RegExp('(\\s)' + lama.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.?\\s*$', 'i');
  return re.test(nama) ? nama.replace(re, '$1' + baru) : nama;
}
/** true kalau satuan di ujung nama sebaiknya ikut diganti (bukan ukuran seperti "MC 6 PCS") */
function namaIkutSatuan(nama, lama) {
  const re = new RegExp('(\\S+)\\s+' + lama.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.?\\s*$', 'i');
  const m = String(nama || '').match(re);
  return !!m && !/\d$/.test(m[1]);
}
async function gantiNamaSatuan(p, lama, baru, opt = {}) {
  baru = String(baru || '')
    .trim()
    .toUpperCase();
  if (!baru || baru === lama) return false;
  if (unitsOf(p).some(u => u.nama === baru)) {
    toast('Satuan ' + baru + ' sudah ada di barang ini', true);
    return false;
  }
  if ((p.satuan || 'PCS') === lama) p.satuan = baru;
  else {
    const u = (p.units || []).find(x => x.nama === lama);
    if (!u) return false;
    u.nama = baru;
  }
  if (p.unitScan === lama) p.unitScan = baru;
  if (p.satuanAwal === lama) p.satuanAwal = baru;
  if (opt.nama) p.nama = namaDenganSatuan(p.nama, lama, baru);
  p.diubah = Date.now();
  await save('products', p);
  await satuanRiwayat(p.id, lama, baru, opt.nama ? p.nama : '');
  return true;
}
/** Nama satuan lama -> baru di riwayat transaksi, keranjang, keranjang tunda, dan hadiah poin */
async function satuanRiwayat(pid, lama, baru, namaBaru) {
  const ganti = it => {
    if (!it || it.productId !== pid || it.layanan) return false;
    let u = false;
    if (it.satuan === lama) (it.satuan = baru), (u = true);
    if (it.dasar === lama) (it.dasar = baru), (u = true);
    return u;
  };
  for (const s of S.sales) {
    let u = false;
    (s.items || []).forEach(it => ganti(it) && (u = true));
    if (u) await save('sales', s);
  }
  if (typeof cart !== 'undefined' && cart.items)
    cart.items.forEach(it => {
      ganti(it);
      if (namaBaru && it.productId === pid && !it.manual && !it.layanan) it.nama = namaBaru;
    });
  let h = false;
  (S.meta.held || []).forEach(x => ((x.cart && x.cart.items) || []).forEach(it => ganti(it) && (h = true)));
  if (h) await saveMeta('held');
  let r = false;
  (S.meta.rewards || []).forEach(x => {
    if (x.pid === pid && x.satuan === lama) (x.satuan = baru), (r = true);
  });
  if (r) await saveMeta('rewards');
}
/** Pilihan satuan untuk tombol: yang paling sering dipakai di toko dulu */
function satuanSering(kecuali) {
  const n = {};
  S.products.forEach(x =>
    [x.satuan, ...(x.units || []).map(u => u.nama)].forEach(s => s && (n[s] = (n[s] || 0) + 1))
  );
  return [...new Set([...SATUAN_LIST, ...Object.keys(n)])]
    .filter(s => !kecuali.has(s))
    .sort((a, b) => (n[b] || 0) - (n[a] || 0) || SATUAN_LIST.indexOf(a) - SATUAN_LIST.indexOf(b));
}
/** Jendela ganti satuan (dari keranjang kasir atau halaman produk) */
function gantiSatuanDialog(p, lama, done) {
  lama = lama || p.satuan || 'PCS';
  const have = new Set(unitsOf(p).map(u => u.nama));
  const saran = (p.satuan || 'PCS') === lama ? saranSatuanDariNama(p) : '';
  const tombol = satuanSering(have).slice(0, 11);
  if (saran && !tombol.includes(saran)) tombol.unshift(saran);
  const satu = unitsOf(p).length === 1;
  const adaDiNama = namaDenganSatuan(p.nama, lama, '#') !== p.nama;
  const m = modal(
    `<h3>✏️ Ganti satuan · ${esc(p.nama)}</h3>
   <p style="margin:0 0 4px">Satuan sekarang: <b class="satlama">${esc(lama)}</b></p>
   <p class="muted" style="margin:0 0 10px;font-size:14px">Pilih satuan yang benar. <b>Harga dan stok tidak berubah</b>, hanya tulisan satuannya. Jadi 1 ${esc(lama)} menjadi 1 satuan baru.</p>
   ${saran ? `<p class="satsaran">💡 Di nama barang tertulis <b>${esc(saran)}</b></p>` : ''}
   <div class="haripick satpick">${tombol.map((s, i) => `<button type="button" data-sl="${esc(s)}" class="${s === saran ? 'on' : ''}" ${s === saran || (!saran && i === 0) ? 'autofocus' : ''}>${esc(s)}</button>`).join('')}<button type="button" data-sl="__lain">Lainnya…</button></div>
   <div id="gsLainW" class="hide" style="margin-top:8px"><label>Tulis satuannya</label><input id="gsLain" maxlength="12" placeholder="misal: TOPLES" autocomplete="off" style="text-transform:uppercase;max-width:240px"></div>
   ${adaDiNama ? `<label class="chk" style="margin-top:12px"><input type="checkbox" id="gsNama" ${namaIkutSatuan(p.nama, lama) ? 'checked' : ''}> <span>Ganti juga tulisan <b>${esc(lama)}</b> di ujung nama barang</span></label>` : ''}
   <div id="gsPrev" class="satprev"></div>
   ${satu ? `<p class="muted" style="font-size:13px;margin:12px 0 0">Barang ini juga dijual per satuan lain yang isinya beda (misal 1 DUS = 40 ${esc(lama)})? <a href="#" id="gsAdd">➕ Tambah satuan</a></p>` : ''}
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="gsOk">✔ Ganti satuan</button></div>`
  );
  let pilih = saran;
  const nilai = () => (pilih === '__lain' ? $('#gsLain', m).value.trim().toUpperCase() : pilih);
  const prev = () => {
    const b = nilai();
    const nm = $('#gsNama', m) && $('#gsNama', m).checked && b ? namaDenganSatuan(p.nama, lama, b) : p.nama;
    $('#gsPrev', m).innerHTML = b
      ? `Jadi: <b>${esc(nm)}</b><br>Harga <b>Rp ${rp(priceUnit(p, lama, typeof cart !== 'undefined' ? cart.tier : 'umum'))}</b> per <b>${esc(b)}</b>${(p.satuan || 'PCS') === lama ? ` · stok <b>${rp(p.stok)} ${esc(b)}</b>` : ''}`
      : '<span class="muted">Belum dipilih.</span>';
  };
  $$('[data-sl]', m).forEach(
    b =>
      (b.onclick = () => {
        pilih = b.dataset.sl;
        $$('[data-sl]', m).forEach(x => x.classList.toggle('on', x === b));
        $('#gsLainW', m).classList.toggle('hide', pilih !== '__lain');
        if (pilih === '__lain') $('#gsLain', m).focus();
        prev();
      })
  );
  $('#gsLain', m).oninput = prev;
  $('#gsNama', m) && ($('#gsNama', m).onchange = prev);
  $('#gsAdd', m) &&
    ($('#gsAdd', m).onclick = e => {
      e.preventDefault();
      m.close();
      quickUnitDialog(p, done);
    });
  m.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const chip = e.target.closest && e.target.closest('[data-sl]');
    if (chip && !chip.classList.contains('on')) return; // Enter pertama memilih tombol satuan itu
    if (e.target.closest && e.target.closest('#gsOk,[data-close],#gsAdd')) return;
    e.preventDefault();
    $('#gsOk', m).click();
  });
  $('#gsOk', m).onclick = async () => {
    const b = nilai();
    if (!b) return toast('Pilih satuan yang benar dulu', true);
    if (!/^[A-Z0-9 .\/-]{1,12}$/.test(b)) return toast('Nama satuan cukup huruf, misal RCG', true);
    if (have.has(b)) return toast('Satuan ' + b + ' sudah ada di barang ini', true);
    const ok = await gantiNamaSatuan(p, lama, b, { nama: !!($('#gsNama', m) && $('#gsNama', m).checked) });
    if (!ok) return;
    m.close();
    toast(`Satuan diganti: ${lama} → ${b} ✔`);
    done && done(b);
  };
  prev();
}
/** Singkatan otomatis dari huruf depan tiap kata, angka tetap utuh:
 *  GUDANG GARAM SURYA 16 -> huruf "ggs", lengkap "ggs16" */
const _singkatCache = new Map();
function singkatanNama(nama) {
  let s = _singkatCache.get(nama);
  if (!s) {
    const kata = String(nama || '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    s = {
      huruf: kata
        .filter(w => !/^\d/.test(w))
        .map(w => w[0])
        .join(''),
      lengkap: kata.map(w => (/^\d/.test(w) ? w : w[0])).join('')
    };
    _singkatCache.set(nama, s);
  }
  return s;
}
/** Produk dengan kode singkat persis seperti yang diketik (untuk Enter di kasir) */
function findByKode(q) {
  const k = String(q || '')
    .trim()
    .toUpperCase();
  return k ? S.products.find(p => p.aktif !== false && p.kode && p.kode === k) : null;
}
/** Ejaan / bahasa sehari-hari (Sunda) yang berbeda dengan nama barang di toko.
 *  Ketik "telor" atau "endog" tetap ketemu TELUR, "tarigu" ketemu TERIGU, "uyah" ketemu GARAM. */
const SINONIM_CARI = {
  telor: ['telur'],
  telur: ['telor'],
  endog: ['telur', 'telor'],
  tarigu: ['terigu'],
  terigu: ['tarigu'],
  beas: ['beras'],
  beras: ['beas'],
  uyah: ['garam'],
  suuk: ['kacang'],
  bako: ['tembakau'],
  tembakau: ['bako'],
  aci: ['tapioka'],
  kanji: ['tapioka'],
  odol: ['pasta gigi'],
  migor: ['minyak goreng'],
  roko: ['rokok'],
  udud: ['rokok'],
  saos: ['saus'],
  saus: ['saos'],
  sampo: ['shampo', 'shp'],
  shampo: ['sampo'],
  tisu: ['tissue', 'tissu'],
  tissue: ['tisu'],
  pampers: ['pempers', 'popok'],
  pempers: ['pampers', 'popok'],
  popok: ['pampers', 'pempers'],
  krupuk: ['kerupuk'],
  kerupuk: ['krupuk'],
  vetsin: ['micin', 'pecin', 'sasa'],
  micin: ['pecin', 'sasa', 'vetsin'],
  pecin: ['micin', 'vetsin']
};
const variasiKata = w => [w, ...(SINONIM_CARI[w] || [])];
/** Pencarian kasir: nama, nama lain, barcode, kategori, kode singkat, dan singkatan otomatis */
function searchProducts(q, limit = 30) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  const satuKata = words.length === 1 && q.length >= 2;
  const pop = popularitasCache();
  const res = [];
  for (const p of S.products) {
    if (p.aktif === false) continue;
    const kode = (p.kode || '').toLowerCase();
    const hay = (
      p.nama +
      ' ' +
      (p.alias || '') +
      ' ' +
      kode +
      ' ' +
      (p.barcode || '') +
      ' ' +
      (p.barcode2 || []).join(' ') +
      ' ' +
      (p.kategori || '')
    ).toLowerCase();
    const cocokTeks = words.every(w => variasiKata(w).some(v => hay.includes(v)));
    const cocokKode = satuKata && !!kode && kode.startsWith(q);
    const sk = satuKata && /^[a-z]/.test(q) ? singkatanNama(p.nama) : null;
    const cocokSingkat = !!sk && (sk.huruf.startsWith(q) || sk.lengkap.startsWith(q));
    if (!(cocokTeks || cocokKode || cocokSingkat)) continue;
    let score = 0;
    if (nbc(p.barcode) === nbc(q)) score += 100;
    if (kode && kode === q) score += 120;
    else if (cocokKode) score += 40;
    if (cocokSingkat) score += sk.lengkap === q || sk.huruf === q ? 30 : q.length >= 3 ? 20 : 8;
    if (variasiKata(q).some(v => p.nama.toLowerCase().startsWith(v))) score += 10;
    if (words.length > 1) {
      // kata yang sama persis dengan kata di nama lebih atas: "telur 1 kg" -> TELUR AYAM 1 KG, bukan 1/2 KG
      const kataNama = new Set(p.nama.toLowerCase().split(/\s+/));
      score += 2 * words.filter(w => kataNama.has(w)).length;
    }
    if ((p.alias || '').toLowerCase().startsWith(q)) score += 8;
    score += prioritasSkor(p, words.flatMap(variasiKata)); // barang kebutuhan rumah tangga naik ke atas
    score += Math.min(6, Math.log2(1 + (pop[p.id] || 0))); // yang sering terjual sedikit lebih atas
    if (p.dariDaftar) score -= 40; // barang dari daftar barcode yang belum dicek di bawah barang toko sendiri
    res.push([score, p]);
  }
  res.sort((a, b) => b[0] - a[0] || a[1].nama.localeCompare(b[1].nama));
  return res.slice(0, limit).map(x => x[1]);
}
/** Jumlah transaksi per produk (120 hari terakhir), dihitung ulang hanya kalau ada penjualan baru */
let _popCache = { n: -1, map: {} };
function popularitasCache() {
  if (_popCache.n !== S.sales.length) _popCache = { n: S.sales.length, map: popularitas() };
  return _popCache.map;
}
function ean13check(d12) {
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(d12[i]) * (i % 2 ? 3 : 1);
  return (10 - (s % 10)) % 10;
}
async function newBarcode() {
  const st = settings();
  let code;
  do {
    const d12 = '20' + pad(st.barcodeSeq++, 10);
    code = d12 + ean13check(d12);
  } while (findBarcode(code));
  await saveMeta('settings');
  return code;
}
function satuanFromName(n) {
  const m = String(n)
    .toUpperCase()
    .trim()
    .match(/\b(RCG|PCS|BKS|BTL|KTN|SLOP|SLP|PACK|PCK|PAK|DUS|BOX|KG|KLG|STRIP|POUCH|BAG|LUSIN)\.?$/);
  return m ? m[1] : 'PCS';
}
function categories() {
  return [...new Set(S.products.map(p => p.kategori).filter(Boolean))].sort();
}
