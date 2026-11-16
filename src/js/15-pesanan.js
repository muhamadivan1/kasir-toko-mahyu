/* ============ PESANAN MASUK (dari WhatsApp / QR / link) ============
 * Teks pesanan dibaca oleh BacaDaftar (src/shared/daftar.js, sama dengan halaman pesan pelanggan),
 * lalu tiap baris dicocokkan ke barang toko dengan mesin cari CariProduk (src/shared/cari.js).
 */
const UNIT_SAME = {
  PAK: ['PACK', 'PCK', 'PACK KECIL'],
  PACK: ['PAK', 'PCK', 'PACK KECIL'],
  PCK: ['PACK', 'PAK'],
  KTN: ['DUS', 'BOX'],
  DUS: ['KTN', 'BOX'],
  BOX: ['DUS', 'KTN'],
  BKS: ['PCS'],
  SLOP: ['SLP'],
  SLP: ['SLOP'],
  LITER: ['LTR', 'L']
};
function parseQty(t) {
  t = String(t).trim();
  const f = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (f) return Number(f[1]) / Number(f[2]);
  return num(t);
}
/** Indeks pencarian barang toko untuk mencocokkan pesanan (disimpan sebentar supaya cepat) */
let _ixPesanan = null;
function indeksPesanan() {
  if (_ixPesanan && _ixPesanan.n === S.products.length && Date.now() - _ixPesanan.t < 10000)
    return _ixPesanan.ix;
  const pop = popularitasCache();
  const list = S.products.filter(p => p.aktif !== false && !p.dariDaftar);
  const ix = CariProduk.indeks(list, p => {
    const pr = isPrioritas(p);
    return {
      nama: p.nama,
      alias: p.alias,
      kategori: p.kategori,
      populer: pop[p.id] || 0,
      prioritas: pr ? (p.prioritas === true ? ['*'] : prioritasCocok(p)) : [],
      prioritasEkstra: pr ? prioritasEkstra(prioritasCocok(p)) || 0 : 0
    };
  });
  _ixPesanan = { ix, n: S.products.length, t: Date.now() };
  return ix;
}
/** Baca teks pesanan (WhatsApp, tulisan bebas, atau teks rapi dari halaman pesan) */
function bacaTeksPesanan(raw) {
  const ix = indeksPesanan();
  const d = BacaDaftar.baca(raw, { angkaDiNama: BacaDaftar.pembantuAngka(ix, p => p.nama) });
  const h = d.harga.toLowerCase();
  const t = h ? tiers().find(x => tierPublik(x).toLowerCase() === h || x.nama.toLowerCase() === h) : null;
  return {
    nama: d.nama,
    hp: d.hp,
    catatan: d.catatan,
    tier: t ? t.id : '',
    lines: d.baris.map(b => ({ qty: b.qty, unit: b.unit, kata: b.kata, teks: b.teks, free: b.bebas }))
  };
}
function parseOrderText(raw) {
  raw = String(raw || '').trim();
  const dariLink = decodePesanLink(raw);
  if (dariLink) {
    // link versi ringkas tidak membawa nama barang: ambil dari teks pesan yang ikut ditempel
    if (dariLink.lines.some(l => !l.teks)) {
      const t = bacaTeksPesanan(raw.replace(/\S*#pesan=\S*/g, ''));
      if (t.lines.length === dariLink.lines.length)
        dariLink.lines.forEach((l, i) => {
          if (!l.teks) l.teks = t.lines[i].teks;
        });
    }
    return dariLink;
  }
  const qr = raw.match(/TMPESAN1\|([^|]*)\|([^|]*)\|([^|]*)\|([\s\S]*)$/);
  if (qr) {
    const o = { nama: qr[1].trim(), hp: qr[2].trim(), catatan: qr[3].trim(), tier: '', lines: [] };
    qr[4]
      .split(';')
      .filter(x => x.trim())
      .forEach(x => {
        const [q, u, n, f] = x.split('*');
        o.lines.push({
          qty: parseQty(q) || 1,
          unit: (u || '').trim().toUpperCase(),
          teks: (n || '').trim(),
          free: f === 'F'
        });
      });
    return o;
  }
  return bacaTeksPesanan(raw);
}
function pickUnit(p, u) {
  if (!p) return '';
  const names = unitsOf(p).map(x => x.nama);
  if (u) {
    if (names.includes(u)) return u;
    for (const a of UNIT_SAME[u] || []) if (names.includes(a)) return a;
  }
  return unitScanOf(p);
}
/** "setengah renceng" (0,5 RCG) untuk barang yang punya satuan SETENGAH -> 1 SETENGAH (harganya harga setengah) */
function pakaiSetengah(r) {
  const p = r && r.pid && S.products.find(x => x.id === r.pid);
  if (!p || Math.abs(Number(r.qty) - 0.5) > 1e-9 || !RE_RCG.test(r.unitSel || '')) return r;
  const stg = unitsOf(p).find(u => RE_SETENGAH.test(u.nama));
  return stg ? { ...r, qty: 1, unitSel: stg.nama, minta: r.minta || '1/2 ' + r.unitSel } : r;
}
function punyaSatuan(p, u) {
  const names = unitsOf(p).map(x => x.nama);
  return names.includes(u) || (UNIT_SAME[u] || []).some(a => names.includes(a));
}
/** Barang dari link pesanan: dicocokkan langsung lewat ID produk (pasti tepat) */
function matchById(l) {
  const p =
    S.products.find(x => x.id === l.pid) ||
    (l.pid.length >= 6 ? S.products.find(x => x.id.startsWith(l.pid)) : null);
  if (p)
    return { ...l, teks: l.teks || p.nama, pid: p.id, unitSel: pickUnit(p, l.unit), st: 'ok', cands: [] };
  if (!l.teks)
    return {
      ...l,
      teks: 'Barang kode ' + l.pid,
      pid: '',
      unitSel: l.unit || '',
      st: 'tidak',
      cands: [],
      harga: ''
    };
  return matchLine({ ...l, pid: '' });
}
const normNama = s =>
  String(s || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
function matchLine(l) {
  // 1. nama persis (baris rapi dari halaman pesan): utamakan barang toko yang sudah ada harganya
  const T = normNama(l.teks);
  const persis = S.products
    .filter(x => x.aktif !== false && (normNama(x.nama) === T || (x.alias && normNama(x.alias) === T)))
    .sort((a, b) => !!a.dariDaftar - !!b.dariDaftar || (priceOf(b, 'umum') > 0) - (priceOf(a, 'umum') > 0));
  if (persis.length)
    return { ...l, pid: persis[0].id, unitSel: pickUnit(persis[0], l.unit), st: 'ok', cands: [] };
  // 2. mesin cari: yang punya satuan / ukuran sesuai pesanan diutamakan
  let r = CariProduk.cariSkor(indeksPesanan(), (l.kata ? l.kata + ' ' : '') + l.teks, 8);
  if (l.unit)
    r = r
      .map(h => {
        const uk = BacaDaftar.ukuran(h.item.nama, l.qty, l.unit);
        return { ...h, uk, skor: h.skor + (punyaSatuan(h.item, l.unit) ? 4 : 0) + (uk === 2 ? 6 : uk * 3) };
      })
      .sort((a, b) => b.skor - a.skor);
  if (r.length && r[0].skor >= 8 && r[0].cocok >= 7) {
    const p = r[0].item;
    // "telur 1/2 kg" -> barang TELUR AYAM 1/2 KG sebanyak 1
    if (r[0].uk === 2)
      return {
        ...l,
        minta: BacaDaftar.fmtQty(l.qty) + ' ' + BacaDaftar.namaSatuan(l.unit),
        qty: 1,
        pid: p.id,
        unit: unitScanOf(p),
        unitSel: unitScanOf(p),
        st: r.length === 1 || r[0].skor - r[1].skor >= 3 ? 'ok' : 'cek',
        cands: r.map(h => h.item.id)
      };
    const yakin = (r.length === 1 || r[0].skor - r[1].skor >= 3) && (!l.unit || punyaSatuan(p, l.unit));
    return {
      ...l,
      pid: p.id,
      unitSel: pickUnit(p, l.unit),
      st: yakin ? 'ok' : 'cek',
      cands: r.map(h => h.item.id)
    };
  }
  // 3. belum yakin: tampilkan pilihan yang mirip, kasir yang memilih
  const mr = [...new Set([...r.map(h => h.item), ...miripProduk(l.teks, 6, p => !p.dariDaftar)])].slice(0, 6);
  return {
    ...l,
    pid: '',
    unitSel: l.unit || '',
    st: mr.length ? 'pilih' : 'tidak',
    cands: mr.map(x => x.id),
    harga: ''
  };
}
function ordersPending() {
  return S.meta.orders || [];
}
async function saveOrders() {
  await saveMeta('orders');
  const b = $('#ordBtnN');
  if (b) {
    b.textContent = ordersPending().length;
    b.classList.toggle('zero', !ordersPending().length);
  }
}
function orderImport(raw, src, opts = {}) {
  const o = parseOrderText(raw);
  if (!o.lines.length) {
    toast('Tidak ada daftar barang yang terbaca', true);
    return;
  }
  const ord = {
    id: uid(),
    waktu: Date.now(),
    sumber: src || (/#pesan=/.test(raw) ? 'link' : /TMPESAN1\|/.test(raw) ? 'qr' : 'wa'),
    nama: o.nama,
    hp: o.hp,
    catatan: o.catatan,
    tier: o.tier || '',
    lines: o.lines.map(l => pakaiSetengah(l.pid ? matchById(l) : matchLine(l)))
  };
  if (opts.simpanSaja) return simpanPesananBaru(ord);
  orderReview(ord, true);
}
/** Simpan pesanan ke daftar 📥 tanpa membuka jendela (dipakai saat kasir sedang melayani) */
async function simpanPesananBaru(ord) {
  S.meta.orders = [...ordersPending().filter(x => x.id !== ord.id), ord];
  await saveOrders();
  return ord;
}
const SUMBER_LBL = { qr: 'QR', wa: 'WhatsApp', link: 'Link WhatsApp' };
function orderReview(ord, isNew) {
  const c = matchCustomer(ord.nama) || matchCustomer(ord.hp);
  const pOf = id => S.products.find(x => x.id === id);
  const pilihan = tiers().some(t => t.id === ord.tier) ? ord.tier : '';
  const tierAwal = c ? c.tier || 'umum' : pilihan || 'umum';
  const tierNote =
    pilihan && pilihan !== tierAwal
      ? `<div class="banner" style="margin:6px 0">Pelanggan memilih harga <b>${esc(tierName(pilihan))}</b>, tetapi terdaftar dengan harga <b>${esc(tierName(tierAwal))}</b>. Ganti pilihan harga di atas kalau perlu.</div>`
      : pilihan && !c && pilihan !== 'umum'
        ? `<div class="banner" style="margin:6px 0">Pelanggan belum terdaftar tetapi memilih harga <b>${esc(tierName(pilihan))}</b>. Pastikan memang warung langganan.</div>`
        : '';
  const m = modal(
    `<h3>📥 Pesanan (${SUMBER_LBL[ord.sumber] || 'WhatsApp'})${ord.nama ? ' · ' + esc(ord.nama.toUpperCase()) : ''}</h3>
   <div class="row ordinfo"><span class="grow">${c ? `<span class="badge ok">✔ pelanggan terdaftar${c.kode ? ' ' + esc(c.kode) : ''}</span>` : ord.nama ? '<span class="badge warn">belum terdaftar</span>' : '<span class="badge warn">tanpa nama</span>'}${ord.hp ? ` · HP ${esc(ord.hp)}` : ''}${ord.catatan ? `<br>📝 <b>${esc(ord.catatan)}</b>` : ''}</span>
   <label class="inl">Pakai harga <select id="orTier">${tiers()
     .map(t => `<option value="${t.id}" ${t.id === tierAwal ? 'selected' : ''}>${esc(t.nama)}</option>`)
     .join('')}</select></label></div>
   ${tierNote}
   <div class="tablewrap" style="max-height:52vh"><table class="zebra"><thead><tr><th></th><th>Pesanan</th><th>Barang di toko</th><th>Satuan</th><th class="num">Jumlah</th><th></th></tr></thead><tbody id="orb"></tbody></table></div>
   <p class="muted" style="font-size:13px;margin:8px 0 0">✔ cocok · 🟡 cek lagi (ada beberapa yang mirip) · 🔴 belum ketemu: pilih barangnya, atau isi harga untuk dijual tanpa data.</p>
   <div class="row actbar"><button class="btn ghost" id="orSave">💾 Simpan ke daftar pesanan</button><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn ok big" id="orCart">🛒 Masukkan ke keranjang</button></div>`,
    { wide: true, onClose: focusScan }
  );
  const L = ord.lines;
  const draw = () => {
    $('#orb', m).innerHTML =
      L.map((l, i) => {
        const p = pOf(l.pid);
        const ic = l.pid ? (l.st === 'cek' ? '🟡' : '✔') : '🔴';
        const opts = [...new Set([l.pid, ...(l.cands || [])].filter(Boolean))].map(pOf).filter(Boolean);
        const minta =
          l.minta || BacaDaftar.fmtQty(l.qty) + (l.unit ? ' ' + BacaDaftar.namaSatuan(l.unit) : '');
        const satuanBeda =
          p && l.unit && l.unitSel !== l.unit && !(UNIT_SAME[l.unit] || []).includes(l.unitSel);
        return `<tr><td style="font-size:20px">${ic}</td><td><b>${esc(l.teks)}</b><br><span class="muted" style="font-size:13px">diminta: ${esc(minta)}</span>${satuanBeda ? `<br><span class="badge warn">satuan ${esc(BacaDaftar.namaSatuan(l.unit))} tidak ada, cek jumlahnya</span>` : ''}${l.free ? '<br><span class="badge warn">tidak ada di daftar</span>' : ''}</td>
      <td><div class="row" style="gap:4px;flex-wrap:nowrap"><select data-ps="${i}" style="min-width:200px;max-width:340px"><option value="">${l.pid ? '—' : '— pilih barang —'}</option>${opts.map(p => `<option value="${p.id}" ${p.id === l.pid ? 'selected' : ''}>${esc(p.nama)}</option>`).join('')}<option value="__cari">🔍 cari barang lain…</option><option value="__baru">➕ tambah produk baru…</option></select></div>
        ${l.pid ? '' : `<div class="row" style="gap:4px;margin-top:4px;flex-wrap:nowrap"><span class="muted" style="font-size:12px;white-space:nowrap">atau jual tanpa data, harga:</span><input data-ph="${i}" inputmode="numeric" value="${l.harga ? rp(l.harga) : ''}" placeholder="Rp" style="width:110px;min-height:38px"></div>`}</td>
      <td>${
        p
          ? `<select data-pu="${i}" style="min-height:40px;width:auto">${unitsOf(p)
              .map(u => `<option ${u.nama === l.unitSel ? 'selected' : ''}>${esc(u.nama)}</option>`)
              .join('')}</select>`
          : '<span class="muted">-</span>'
      }</td>
      <td class="num"><input data-pq="${i}" inputmode="decimal" value="${String(l.qty).replace('.', ',')}" style="width:80px;text-align:center;min-height:40px"></td>
      <td><button class="btn sm bad" data-px="${i}">✕</button></td></tr>`;
      }).join('') || '<tr><td colspan="6" class="empty">Tidak ada barang.</td></tr>';
    $$('[data-ps]', m).forEach(
      s =>
        (s.onchange = () => {
          const i = +s.dataset.ps,
            l = L[i];
          if (s.value === '__cari') {
            s.value = l.pid || '';
            findPicker(l.teks, p => {
              l.pid = p.id;
              l.st = 'ok';
              l.unitSel = pickUnit(p, l.unit);
              l.cands = [...new Set([p.id, ...(l.cands || [])])];
              draw();
            });
            return;
          }
          if (s.value === '__baru') {
            s.value = l.pid || '';
            editProduct(null, presetFrom(l.teks), p => {
              if (p) {
                l.pid = p.id;
                l.st = 'ok';
                l.unitSel = pickUnit(p, l.unit);
                l.cands = [p.id, ...(l.cands || [])];
                draw();
              }
            });
            return;
          }
          l.pid = s.value;
          l.st = s.value ? 'ok' : l.cands.length ? 'pilih' : 'tidak';
          const p = pOf(l.pid);
          l.unitSel = pickUnit(p, l.unit);
          draw();
        })
    );
    $$('[data-pu]', m).forEach(s => (s.onchange = () => (L[+s.dataset.pu].unitSel = s.value)));
    $$('[data-pq]', m).forEach(
      x =>
        (x.onchange = () => {
          L[+x.dataset.pq].qty = parseQty(x.value) || 1;
        })
    );
    $$('[data-ph]', m).forEach(
      x =>
        (x.oninput = () => {
          L[+x.dataset.ph].harga = num(x.value);
        })
    );
    $$('[data-px]', m).forEach(
      b =>
        (b.onclick = () => {
          L.splice(+b.dataset.px, 1);
          draw();
        })
    );
  };
  draw();
  $('#orSave', m).onclick = async () => {
    S.meta.orders = ordersPending().filter(x => x.id !== ord.id);
    S.meta.orders.push(ord);
    await saveOrders();
    m.remove();
    focusScan();
    toast('Pesanan disimpan di daftar 📥');
  };
  $('#orCart', m).onclick = async () => {
    const bad = L.filter(l => !l.pid && !(l.harga > 0));
    if (bad.length) return toast(`${bad.length} barang belum dipilih / belum ada harganya`, true);
    if (cart.items.length) {
      if (
        !(await confirmBox(
          'Keranjang sekarang masih ada isinya. Tunda dulu lalu buka pesanan ini?',
          'Tunda & buka'
        ))
      )
        return;
      await holdCart(true);
    }
    const tierDipakai = $('#orTier', m).value;
    resetCart();
    if (c) cart.customerId = c.id;
    else cart.namaBebas = (ord.nama || '').toUpperCase();
    cart.tier = tierDipakai;
    for (const l of L) {
      const p = pOf(l.pid);
      if (p) {
        const ex = cart.items.find(i => i.productId === p.id && i.satuan === l.unitSel);
        if (ex) ex.qty += l.qty;
        else cart.items.push(cartItemFor(p, l.unitSel, l.qty));
      } else
        cart.items.push({
          productId: 'manual-' + uid(),
          manual: true,
          nama: l.teks.toUpperCase(),
          satuan: 'PCS',
          harga: l.harga,
          hargaBeli: 0,
          qty: l.qty
        });
    }
    cart.orderId = ord.id;
    cart.orderInfo = { nama: ord.nama, catatan: ord.catatan, hp: ord.hp };
    S.meta.orders = ordersPending().filter(x => x.id !== ord.id);
    S.meta.orders.push(ord);
    await saveOrders();
    $$('.modal').forEach(x => x.remove());
    go('kasir');
    toast('Pesanan masuk ke keranjang ✔ Cek lalu Bayar');
  };
}
function findPicker(q, done) {
  const m = modal(
    `<h3>🔍 Cari barang</h3><input id="fpq" value="${esc(q)}" autofocus><div id="fpl" style="max-height:50vh;overflow:auto;margin-top:6px"></div><div class="right" style="margin-top:10px"><button class="btn ghost" data-close>Tutup</button></div>`
  );
  const draw = () => {
    const v = $('#fpq', m).value;
    let r = searchProducts(v, 30);
    if (!r.length) r = miripProduk(v, 15);
    $('#fpl', m).innerHTML =
      r
        .map(
          p =>
            `<div class="row" style="padding:7px 0;border-bottom:1px solid var(--line);flex-wrap:nowrap"><div class="grow"><b>${esc(p.nama)}</b>${p.alias && p.alias !== p.nama ? `<br><span class="muted" style="font-size:13px">${esc(p.alias)}</span>` : ''}</div><span class="muted">Rp ${rp(priceUnit(p, unitScanOf(p), cart.tier))}</span><button class="btn sm pri" data-k="${p.id}">Pilih</button></div>`
        )
        .join('') || '<p class="muted">Tidak ada.</p>';
    $$('[data-k]', m).forEach(
      b =>
        (b.onclick = () => {
          const p = S.products.find(x => x.id === b.dataset.k);
          m.remove();
          done(p);
        })
    );
  };
  $('#fpq', m).oninput = draw;
  $('#fpq', m).onkeydown = e => {
    if (e.key === 'Enter') {
      const b = $('[data-k]', m);
      b && b.click();
    }
  };
  draw();
}
function ordersDialog() {
  const list = ordersPending()
    .slice()
    .sort((a, b) => b.waktu - a.waktu);
  const m = modal(
    `<h3>📥 Pesanan pelanggan</h3>
   <label>Tempel (Ctrl+V) pesan WhatsApp / daftar belanja di sini</label><textarea id="opaste" rows="6" placeholder="Salin pesan dari WhatsApp lalu tempel di sini. Contoh:&#10;Nama: Bu Ani&#10;gula 2 kg&#10;indomie goreng 1 dus, kopi kapal api 2 renceng&#10;telur sekilo&#10;Diantar" autofocus></textarea>
   <p class="hint" style="margin:4px 0 0">Bisa dari pesan rapi halaman pesan, atau pesan yang diketik sendiri oleh pembeli (dipisah baris atau koma). Sapaan seperti "punten", "assalamualaikum", "nuhun" dilewati otomatis.</p>
   <div class="row" style="margin-top:8px"><button class="btn pri grow" id="oread">📖 Baca pesanan</button><button class="btn ghost" id="ocontoh" title="Kirim ke pembeli supaya pesannya mudah dibaca kasir">📋 Contoh format untuk pembeli</button><button class="btn ghost" id="ogen">🔗 Link pesan untuk pelanggan</button></div>
   <h3 style="margin-top:18px">Daftar pesanan tersimpan (${list.length})</h3>
   <div style="max-height:36vh;overflow:auto">${list.map(o => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line);flex-wrap:nowrap"><div class="grow"><b>${esc((o.nama || 'Tanpa nama').toUpperCase())}</b> ${o.id === cart.orderId ? '<span class="badge">sedang di keranjang</span>' : '<span class="badge warn">baru</span>'}<br><span class="muted" style="font-size:13px">${tglJam(o.waktu)} · ${o.lines.length} barang · ${SUMBER_LBL[o.sumber] || 'WhatsApp'}${o.tier ? ' · harga ' + esc(tierName(o.tier)) : ''}${o.catatan ? ' · 📝 ' + esc(o.catatan) : ''}</span></div><button class="btn sm pri" data-ob="${o.id}">Buka</button><button class="btn sm bad" data-oh="${o.id}">Hapus</button></div>`).join('') || '<p class="muted">Belum ada pesanan tersimpan.</p>'}</div>
   <div class="right" style="margin-top:12px"><button class="btn ghost" data-close>Tutup</button></div>`,
    { wide: true, onClose: focusScan }
  );
  $('#oread', m).onclick = () => {
    const t = $('#opaste', m).value;
    if (!t.trim()) return toast('Tempel dulu pesannya', true);
    m.remove();
    orderImport(t);
  };
  $('#ogen', m).onclick = () => {
    m.remove();
    shareOrderLinkDialog();
  };
  $('#ocontoh', m).onclick = () => contohFormatDialog();
  $$('[data-ob]', m).forEach(
    b =>
      (b.onclick = () => {
        const o = ordersPending().find(x => x.id === b.dataset.ob);
        m.remove();
        o.lines = o.lines.map(l =>
          l.pid && S.products.some(p => p.id === l.pid) ? l : pakaiSetengah(matchLine(l))
        );
        orderReview(o, false);
      })
  );
  $$('[data-oh]', m).forEach(
    b =>
      (b.onclick = async () => {
        if (!(await confirmBox('Hapus pesanan ini?', 'Hapus', true))) return;
        S.meta.orders = ordersPending().filter(x => x.id !== b.dataset.oh);
        await saveOrders();
        m.remove();
        ordersDialog();
      })
  );
}
/** Contoh pesan WhatsApp untuk pembeli yang mengetik sendiri (tanpa halaman pesan) */
function contohFormatPesan() {
  const L = [
    'Cara pesan di ' + settings().nama + ' lewat WhatsApp:',
    'Tulis nama, lalu barang yang dibeli. Satu baris satu barang, tulis jumlahnya.',
    '',
    'Contoh:',
    'Nama: Bu Ani',
    'gula 2 kg',
    'indomie goreng 1 dus',
    'kopi kapal api 2 renceng',
    'telur 1 kg',
    'Diantar'
  ];
  const link = pesanLink();
  if (link) L.push('', 'Atau pesan lewat link ini (bisa lihat harga):', link);
  return L.join('\n');
}
function contohFormatDialog() {
  const t = contohFormatPesan();
  const m = modal(
    `<h3>📋 Contoh format pesan untuk pembeli</h3>
   <p style="margin-top:0">Kirim teks ini ke pembeli (misal lewat status atau grup WhatsApp). Pesan yang ditulis seperti contoh ini langsung terbaca rapi saat ditempel di 📥 Pesanan.</p>
   <textarea id="cfT" rows="12" readonly style="font-size:15px">${esc(t)}</textarea>
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Tutup</button><button class="btn pri" id="cfC">📋 Salin teks</button></div>`,
    { wide: true }
  );
  $('#cfC', m).onclick = async () => {
    try {
      await navigator.clipboard.writeText(t);
      toast('Contoh format disalin ✔ Tempel di WhatsApp');
    } catch (e) {
      $('#cfT', m).select();
      toast('Tekan Ctrl+C untuk menyalin', true);
    }
  };
}
function waNumber(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d.length >= 10 ? d : '';
}
