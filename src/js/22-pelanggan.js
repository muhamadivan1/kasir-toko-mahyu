/* ============ PELANGGAN & UTANG ============ */
function saldoUtang(cid) {
  const u = S.sales.filter(s => s.customerId === cid && !s.batal).reduce((a, s) => a + (s.utang || 0), 0);
  // catatan "utang dari buku" (jenis utang) menambah, pembayaran mengurangi
  const p = S.payments
    .filter(x => x.customerId === cid)
    .reduce((a, x) => a + (x.jenis === 'utang' ? -x.jumlah : x.jumlah), 0);
  return u - p;
}
/** Sisa utang pelanggan pada waktu t (dipakai untuk cetak ulang bukti bayar) */
function saldoUtangPada(cid, t) {
  const u = S.sales
    .filter(s => s.customerId === cid && !s.batal && s.waktu <= t)
    .reduce((a, s) => a + (s.utang || 0), 0);
  const p = S.payments
    .filter(x => x.customerId === cid && x.waktu <= t)
    .reduce((a, x) => a + (x.jenis === 'utang' ? -x.jumlah : x.jumlah), 0);
  return u - p;
}
/** Bukti bayar utang (struk) untuk satu pembayaran */
function cetakBuktiBayarUtang(c, p) {
  const sisa = p.sesudah !== undefined ? p.sesudah : saldoUtangPada(c.id, p.waktu);
  const sebelum = p.sebelum !== undefined ? p.sebelum : sisa + p.jumlah;
  printBukti({
    judul: 'BUKTI BAYAR UTANG',
    waktu: p.waktu,
    nama: c.nama + (c.kode ? ' (' + c.kode + ')' : ''),
    rows: [
      ['Utang sebelumnya', rp(Math.max(0, sebelum))],
      [`Dibayar (${p.metode === 'transfer' ? 'QRIS / transfer' : 'tunai'})`, rp(p.jumlah)],
      ['SISA UTANG', rp(Math.max(0, sisa)), true]
    ],
    sisa,
    catatan: p.catatan
  });
}
/** Utang yang belum lunas per catatan. Pembayaran dianggap melunasi utang yang paling lama dulu. */
function rincianUtang(cid) {
  const debit = [
    ...S.sales
      .filter(s => s.customerId === cid && !s.batal && (Number(s.utang) || 0) > 0)
      .map(s => ({ w: s.waktu, j: Number(s.utang), t: 'Belanja' + (s.no ? ' ' + s.no : '') })),
    ...S.payments
      .filter(p => p.customerId === cid && p.jenis === 'utang')
      .map(p => ({ w: p.waktu, j: Number(p.jumlah) || 0, t: p.catatan || 'Utang dicatat' }))
  ].sort((a, b) => a.w - b.w);
  let kredit = S.payments
    .filter(p => p.customerId === cid && p.jenis !== 'utang')
    .reduce((a, p) => a + (Number(p.jumlah) || 0), 0);
  const sisa = [];
  for (const d of debit) {
    const pakai = Math.min(kredit, d.j);
    kredit -= pakai;
    if (d.j - pakai > 0) sisa.push({ ...d, sisa: d.j - pakai, sebagian: pakai > 0 });
  }
  return sisa;
}
/** Utang paling lama yang belum lunas, dalam hari (0 kalau tidak punya utang) */
function umurUtang(cid) {
  const r = rincianUtang(cid);
  return r.length ? Math.floor((Date.now() - r[0].w) / 864e5) : 0;
}
const namaRapi = s =>
  String(s || '')
    .toLowerCase()
    .replace(/(^|[\s.(/-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
/** 081321685590 -> 0813-2168-5590 */
const hpRapi = t => {
  const d = String(t || '').replace(/\D/g, '');
  return d.length >= 10 ? d.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3') : String(t || '');
};
/** Isi pesan tagihan utang (bisa diubah sebelum dikirim) */
function teksTagihan(c) {
  const st = settings();
  const r = rincianUtang(c.id);
  const L = [
    `Assalamualaikum ${namaRapi(c.nama)},`,
    '',
    `Kami dari ${st.nama} mau mengingatkan catatan utang belanja:`
  ];
  const lama = r.length > 8 ? r.slice(0, r.length - 8) : [];
  if (lama.length) L.push(`Sebelum ${tgl(r[lama.length].w)}: Rp ${rp(lama.reduce((a, x) => a + x.sisa, 0))}`);
  r.slice(-8).forEach(x =>
    L.push(`${tgl(x.w)}: Rp ${rp(x.sisa)}${x.sebagian ? ' (sisa, sudah dicicil)' : ''}`)
  );
  L.push('', `Total sisa utang: Rp ${rp(saldoUtang(c.id))}`, '');
  L.push(
    'Pembayaran bisa langsung di toko. Kalau ada yang tidak sesuai, mohon dikabari ya.',
    'Terima kasih 🙏',
    ''
  );
  L.push(st.nama + (st.alamat ? ', ' + st.alamat : ''));
  const wa = st.orderWa || st.telp;
  if (wa) L.push('WA ' + hpRapi(wa));
  return L.join('\n');
}
/** Tagih utang lewat WhatsApp: membuka chat pelanggan dengan pesan yang sudah jadi */
function tagihDialog(c, after) {
  const st = settings();
  const s = saldoUtang(c.id);
  const waToko = st.orderWa || st.telp;
  const m = modal(
    `<h3>💬 Tagih utang lewat WhatsApp · ${esc(c.nama)}</h3>
   <p style="margin-top:0">Sisa utang: <b style="font-size:20px">Rp ${rp(s)}</b>${c.ditagih ? ` <span class="muted">· terakhir ditagih ${tgl(c.ditagih)}</span>` : ''}</p>
   <label>No. WhatsApp pelanggan</label><input id="tgHp" inputmode="tel" value="${esc(c.telp || '')}" placeholder="contoh: 0812xxxxxxxx">
   ${c.telp ? '' : '<div class="subhint">No. HP belum ada. Yang diisi di sini otomatis disimpan ke data pelanggan.</div>'}
   <label>Isi pesan (boleh diubah dulu)</label><textarea id="tgT" rows="13" style="font-size:15px;line-height:1.45">${esc(teksTagihan(c))}</textarea>
   <p class="hint">WhatsApp terbuka memakai akun yang sedang masuk di komputer / HP ini${waToko ? ` (pastikan itu WhatsApp toko <b>${esc(hpRapi(waToko))}</b>)` : ''}. Setelah terbuka, tinggal tekan <b>Kirim</b>.</p>
   <div class="row actbar"><button class="btn ghost" id="tgCopy">📋 Salin pesan</button><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn wa" id="tgGo">📲 Buka WhatsApp</button></div>`,
    { wide: true }
  );
  const simpanHp = async () => {
    const v = $('#tgHp', m).value.trim();
    if (v && v !== (c.telp || '')) {
      c.telp = v;
      await save('customers', c);
    }
  };
  $('#tgCopy', m).onclick = async () => {
    try {
      await navigator.clipboard.writeText($('#tgT', m).value);
      toast('Pesan disalin ✔ Tempel di WhatsApp');
    } catch (e) {
      $('#tgT', m).select();
      toast('Tekan Ctrl+C untuk menyalin', true);
    }
  };
  $('#tgGo', m).onclick = async () => {
    const no = waNumber($('#tgHp', m).value);
    if (!no) {
      toast('Isi No. WhatsApp pelanggan dulu', true);
      return $('#tgHp', m).focus();
    }
    await simpanHp();
    c.ditagih = Date.now();
    await save('customers', c);
    const w = window.open(
      'https://wa.me/' + no + '?text=' + encodeURIComponent($('#tgT', m).value),
      '_blank'
    );
    if (!w) return toast('Browser memblokir jendela baru. Pakai tombol Salin pesan.', true);
    m.close();
    toast('WhatsApp dibuka ✔ Tekan Kirim di WhatsApp');
    after ? after() : currentView === 'pelanggan' && render();
  };
  if (!c.telp) setTimeout(() => $('#tgHp', m).focus(), 40);
}
/* ---- POIN MEMBER (loyalty) ---- */
const DEF_LOY = { aktif: true, perRp: 10000, nilai: 100, minTukar: 10, tiers: ['umum'] };
function loy() {
  const st = settings();
  return withDefaults(st, 'loyalty', DEF_LOY);
}
function loyEligible(c) {
  const L = loy();
  return !!(L.aktif && c && (L.tiers || []).includes(c.tier || 'umum'));
}
function saldoPoin(cid) {
  if (!cid) return 0;
  const c = S.customers.find(x => x.id === cid);
  let s = 0;
  for (const x of S.sales)
    if (x.customerId === cid && !x.batal) s += (Number(x.poinDapat) || 0) - (Number(x.poinPakai) || 0);
  for (const l of (c && c.poinLog) || []) s += Number(l.jumlah) || 0;
  return s;
}
function newKode() {
  const st = settings();
  let k;
  do {
    st.memberSeq = (Number(st.memberSeq) || 0) + 1;
    k = 'M' + pad(st.memberSeq, 4);
  } while (S.customers.some(c => c.kode === k));
  return k;
}
async function ensureKode(c) {
  if (c.kode) return false;
  c.kode = newKode();
  await saveMeta('settings');
  return true;
}
function selectCustomer(c) {
  cart.customerId = c.id;
  cart.namaBebas = '';
  cart.poinPakai = 0;
  setTier(c.tier || 'umum');
  const ci = $('#custName');
  if (ci) ci.value = c.nama;
  drawCustHint();
  drawTotals();
}
function drawPoinBox() {
  const b = $('#poinBox');
  if (!b) return;
  const c = custOf();
  const L = loy();
  if (!L.aktif || !c) {
    b.innerHTML = '';
    return;
  }
  const sal = saldoPoin(c.id);
  if (!loyEligible(c)) {
    b.innerHTML = `<div class="poinbox off">⭐ Poin ${esc(c.nama)}: <b>${rp(sal)}</b><br><span style="font-size:12px">Harga ${esc(tierName(c.tier || 'umum'))} tidak mendapat poin.</span></div>`;
    return;
  }
  const t = cartTotal();
  const dapat = Math.floor(t.poinBase / L.perRp);
  b.innerHTML = `<div class="poinbox"><div class="row" style="justify-content:space-between;gap:6px"><span>⭐ Poin <b>${esc(c.nama)}</b>${c.kode ? ` <span class="muted" style="font-size:12px">${esc(c.kode)}</span>` : ''}</span><b style="font-size:20px">${rp(sal)}</b></div>
    <div style="font-size:13px">Transaksi ini dapat <b>+${rp(dapat)} poin</b>${sal > 0 ? ` · ${rp(sal)} poin = Rp ${rp(sal * L.nilai)}` : ''}</div>
    ${
      cart.poinPakai
        ? `<div class="row" style="margin-top:6px;justify-content:space-between"><span>Pakai <b>${rp(cart.poinPakai)}</b> poin = <b>-Rp ${rp(cart.poinPakai * L.nilai)}</b></span><button class="btn sm bad" id="poinBatal">Batal</button></div>`
        : `<div class="row" style="gap:6px;margin-top:6px;flex-wrap:nowrap">${sal >= L.minTukar ? `<button class="btn sm pri grow" id="poinPakai">💸 Potongan belanja</button>` : ''}${rewardsAktif().length ? `<button class="btn sm ghost grow" id="poinHadiah" style="background:#fff">🎁 Tukar hadiah</button>` : ''}</div>${sal < L.minTukar ? `<div class="muted" style="font-size:12px;margin-top:4px">Potongan bisa mulai ${rp(L.minTukar)} poin.</div>` : ''}`
    }</div>`;
  $('#poinPakai') && ($('#poinPakai').onclick = usePoinDialog);
  $('#poinHadiah') && ($('#poinHadiah').onclick = () => redeemDialog(c, drawTotals));
  $('#poinBatal') &&
    ($('#poinBatal').onclick = () => {
      cart.poinPakai = 0;
      drawTotals();
      focusScan();
    });
}
function usePoinDialog() {
  const c = custOf();
  if (!c) return;
  const L = loy();
  const sal = saldoPoin(c.id);
  const t = cartTotal();
  const maxByBelanja = Math.floor(Math.max(0, t.barang - t.diskon) / L.nilai);
  const mx = Math.max(0, Math.min(sal, maxByBelanja));
  if (mx < L.minTukar)
    return toast(
      sal < L.minTukar
        ? `Poin belum cukup (minimal ${L.minTukar})`
        : 'Belanjaan masih terlalu kecil untuk tukar poin',
      true
    );
  const m = modal(
    `<h3>🎁 Tukar poin · ${esc(c.nama)}</h3><p style="margin-top:0">Poin dimiliki: <b>${rp(sal)}</b> · 1 poin = Rp ${rp(L.nilai)}</p>
   <label>Jumlah poin yang dipakai (maks ${rp(mx)})</label><input id="pp" inputmode="numeric" value="${mx}" autofocus style="font-size:24px">
   <p style="font-size:18px">Potongan: <b id="ppv">Rp ${rp(mx * L.nilai)}</b></p>
   <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="ppok">Pakai poin</button></div>`,
    { onClose: focusScan }
  );
  const val = () => Math.floor(num($('#pp', m).value));
  $('#pp', m).oninput = () =>
    ($('#ppv', m).textContent = 'Rp ' + rp(Math.min(mx, Math.max(0, val())) * L.nilai));
  const ok = () => {
    const v = val();
    if (v < L.minTukar) return toast(`Minimal ${L.minTukar} poin`, true);
    if (v > mx) return toast(`Maksimal ${rp(mx)} poin`, true);
    cart.poinPakai = v;
    m.close();
    drawTotals();
  };
  $('#ppok', m).onclick = ok;
  $('#pp', m).onkeydown = e => {
    if (e.key === 'Enter') ok();
  };
}
function quickMember(nama) {
  const L = loy();
  const m = modal(
    `<h3>⭐ Daftarkan member</h3><p class="muted" style="margin-top:0">Member mendapat poin setiap belanja. Tidak perlu login, cukup nama (No. HP boleh dikosongkan).</p>
   <label>Nama *</label><input id="qmn" value="${esc(nama || '')}" autofocus><label>No. HP (opsional, bisa dipakai untuk mencari)</label><input id="qmh" inputmode="tel">
   <label>Kategori harga</label><select id="qmt">${tiers()
     .map(
       t =>
         `<option value="${t.id}" ${t.id === cart.tier ? 'selected' : ''}>${esc(t.nama)}${L.tiers.includes(t.id) ? ' ⭐' : ''}</option>`
     )
     .join('')}</select>
   <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="qmok">Daftarkan</button></div>`,
    { onClose: focusScan }
  );
  const ok = async () => {
    const n = $('#qmn', m).value.trim().toUpperCase();
    if (!n) return toast('Isi nama', true);
    if (matchCustomer(n)) return toast('Nama sudah terdaftar', true);
    const c = {
      id: uid(),
      nama: n,
      tier: $('#qmt', m).value,
      telp: $('#qmh', m).value.trim(),
      alamat: '',
      aktif: true
    };
    await ensureKode(c);
    await save('customers', c);
    const dl = $('#custList');
    if (dl) dl.insertAdjacentHTML('beforeend', `<option value="${esc(n)}">`);
    m.close();
    selectCustomer(c);
    toast(`Member ${n} terdaftar · ID ${c.kode}`);
  };
  $('#qmok', m).onclick = ok;
  $$('input', m).forEach(
    i =>
      (i.onkeydown = e => {
        if (e.key === 'Enter') ok();
      })
  );
}
function poinDialog(c) {
  const L = loy();
  const ev = [
    ...S.sales
      .filter(s => s.customerId === c.id && !s.batal && (s.poinDapat || s.poinPakai))
      .map(s => ({
        w: s.waktu,
        t: 'Belanja ' + s.no + ' (Rp ' + rp(s.total) + ')',
        d: (s.poinDapat || 0) - (s.poinPakai || 0)
      })),
    ...(c.poinLog || []).map(l => ({
      w: l.waktu,
      t: l.catatan || (l.jumlah > 0 ? 'Bonus' : 'Tukar hadiah'),
      d: l.jumlah
    }))
  ].sort((a, b) => b.w - a.w);
  const m = modal(
    `<h3>⭐ Poin · ${esc(c.nama)} <span class="muted" style="font-size:15px">${esc(c.kode || '')}</span></h3>
   <div class="row" style="gap:10px"><div class="stat grow"><div class="muted">Poin sekarang</div><div class="v">${rp(saldoPoin(c.id))}</div><div class="muted" style="font-size:12px">senilai Rp ${rp(saldoPoin(c.id) * L.nilai)}</div></div></div>
   <div class="row" style="margin:10px 0"><button class="btn pri" id="phad">🎁 Tukar hadiah</button><button class="btn ghost" id="pmin">➖ Kurangi poin</button><button class="btn ghost" id="pplus">➕ Tambah poin bonus</button><button class="btn ghost" id="pcard">🪪 Cetak kartu member</button></div>
   <div class="tablewrap" style="max-height:45vh"><table class="zebra"><thead><tr><th>Waktu</th><th>Keterangan</th><th class="num">Poin</th></tr></thead><tbody>${ev.map(e => `<tr><td>${tglJam(e.w)}</td><td>${esc(e.t)}</td><td class="num" style="color:${e.d < 0 ? 'var(--bad)' : 'var(--ok)'};font-weight:700">${e.d > 0 ? '+' : ''}${rp(e.d)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Belum ada poin.</td></tr>'}</tbody></table></div>
   <div class="right" style="margin-top:12px"><button class="btn ghost" data-close>Tutup</button></div>`,
    { wide: true }
  );
  const adj = sign => {
    const mm =
      modal(`<h3>${sign < 0 ? '➖ Kurangi poin' : '➕ Tambah poin bonus'}</h3><label>Jumlah poin</label><input id="aj" inputmode="numeric" autofocus><label>Keterangan</label><input id="ac" placeholder="${sign < 0 ? 'contoh: tukar 1 kg gula' : 'contoh: bonus lebaran'}">
     <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="aok">Simpan</button></div>`);
    $('#aok', mm).onclick = async () => {
      const j = Math.floor(num($('#aj', mm).value));
      if (!(j > 0)) return toast('Isi jumlah poin', true);
      if (sign < 0 && j > saldoPoin(c.id)) return toast('Poin tidak cukup', true);
      c.poinLog = [
        ...(c.poinLog || []),
        { waktu: Date.now(), jumlah: sign * j, catatan: $('#ac', mm).value.trim() }
      ];
      await save('customers', c);
      mm.remove();
      m.remove();
      toast('Poin diperbarui ✔');
      poinDialog(c);
      if (currentView === 'pelanggan') render();
    };
  };
  $('#phad', m).onclick = () => {
    m.remove();
    redeemDialog(c, () => {
      if (currentView === 'pelanggan') render();
      if (currentView === 'kasir') drawTotals();
    });
  };
  $('#pmin', m).onclick = () => adj(-1);
  $('#pplus', m).onclick = () => adj(1);
  $('#pcard', m).onclick = () => printMemberCard(c);
}
function printMemberCard(c) {
  const st = settings();
  const w = Number(st.lebarStruk) || 72;
  printHTML(
    `<div class="card"><div class="t">${esc(st.nama)}</div><div class="s">KARTU MEMBER</div><div class="n">${esc(c.nama)}</div><div class="bc">${barcodeSVG(c.kode, { height: 46, width: 2, fontSize: 16 })}</div><div class="s">Tunjukkan / scan kartu ini saat belanja untuk mengumpulkan poin</div></div><div style="height:10mm"></div>`,
    `@page{size:${w}mm auto;margin:0}body{margin:0;padding:3mm;width:${w}mm;box-sizing:border-box;font-family:Arial,sans-serif;color:#000;text-align:center}.card{border:1.5px solid #000;border-radius:3mm;padding:3mm}.t{font-size:16px;font-weight:800}.s{font-size:10px;margin:1mm 0}.n{font-size:15px;font-weight:700;margin:2mm 0}.bc svg{max-width:100%;height:auto}`
  );
}
views.pelanggan = () => {
  const L = loy();
  const q = (S._custQ || '').toLowerCase();
  let list = S.customers
    .slice()
    .sort((a, b) => saldoUtang(b.id) - saldoUtang(a.id) || a.nama.localeCompare(b.nama));
  if (q)
    list = list.filter(c => (c.nama + ' ' + (c.kode || '') + ' ' + (c.telp || '')).toLowerCase().includes(q));
  if (S._custUtang) list = list.filter(c => saldoUtang(c.id) > 0);
  $('#main').innerHTML =
    `<div class="card"><div class="row" style="margin-bottom:12px"><h2 class="grow" style="margin:0">Pelanggan, Member &amp; Utang</h2>${L.aktif ? '<button class="btn ghost" id="rwBtn">🎁 Daftar hadiah</button>' : ''}<button class="btn bad" id="utBtn">📒 Catat utang</button><button class="btn pri" id="addC">➕ Tambah pelanggan / member</button></div>
   <div class="stats"><div class="stat"><div class="muted">Total piutang (uang di luar)</div><div class="v">Rp ${rp(S.customers.reduce((a, c) => a + Math.max(0, saldoUtang(c.id)), 0))}</div></div><div class="stat"><div class="muted">Jumlah pelanggan</div><div class="v">${S.customers.length}</div></div>${L.aktif ? `<div class="stat"><div class="muted">Total poin member beredar</div><div class="v">${rp(S.customers.reduce((a, c) => a + Math.max(0, saldoPoin(c.id)), 0))}</div><div class="muted" style="font-size:12px">1 poin / Rp ${rp(L.perRp)} · 1 poin = Rp ${rp(L.nilai)}</div></div>` : ''}</div>
   <div class="row" style="margin-bottom:10px;gap:14px"><div style="position:relative;max-width:460px;flex:1 1 260px"><input id="cq" placeholder="Cari nama / ID member / No. HP…" value="${esc(S._custQ || '')}" style="padding-right:52px"><button id="cqX" class="clearx ${S._custQ ? '' : 'hide'}" type="button">✕</button></div><label class="chk" style="margin:0"><input type="checkbox" id="cUt" ${S._custUtang ? 'checked' : ''}> Hanya yang masih punya utang</label></div>
   <div class="tablewrap"><table class="zebra"><thead><tr><th>ID</th><th>Nama</th><th>Kategori harga</th><th class="hide-m">Telp / alamat</th>${L.aktif ? '<th class="num">Poin</th>' : ''}<th class="num">Utang</th><th></th></tr></thead><tbody>${
     list
       .map(c => {
         const s = saldoUtang(c.id);
         const pn = saldoPoin(c.id);
         return `<tr><td style="font-family:monospace">${esc(c.kode || '')}</td><td><b>${esc(c.nama)}</b></td><td>${esc((tiers().find(t => t.id === c.tier) || {}).nama || 'Umum')}${L.aktif && loyEligible(c) ? ' ⭐' : ''}</td><td class="hide-m muted">${esc([c.telp, c.alamat].filter(Boolean).join(' · '))}</td>${L.aktif ? `<td class="num">${pn ? `<b style="color:${pn < 0 ? 'var(--bad)' : '#8a5a00'}">${rp(pn)}</b>` : '<span class="muted">0</span>'}</td>` : ''}<td class="num">${s > 0 ? `<span class="badge bad" style="font-size:15px">Rp ${rp(s)}</span>${c.ditagih ? `<div class="muted" style="font-size:12px">ditagih ${tgl(c.ditagih)}</div>` : umurUtang(c.id) >= 14 ? `<div class="muted" style="font-size:12px">sejak ${umurUtang(c.id)} hari</div>` : ''}` : '<span class="muted">lunas</span>'}</td>
    <td class="right" style="white-space:nowrap">${L.aktif ? `<button class="btn sm ghost" data-pt="${c.id}">⭐ Poin</button> ` : ''}<button class="btn sm ghost" data-ut="${c.id}" title="Catat utang (misal dari buku catatan)">📒 +Utang</button> ${s > 0 ? `<button class="btn sm ghost wa" data-tg="${c.id}" title="Kirim pengingat utang lewat WhatsApp">💬 Tagih</button> ` : ''}<button class="btn sm ok" data-pay="${c.id}">Bayar utang</button> <button class="btn sm ghost" data-h="${c.id}">Riwayat</button> <button class="btn sm ghost" data-e="${c.id}">Ubah</button></td></tr>`;
       })
       .join('') || '<tr><td colspan="7" class="empty">Belum ada pelanggan.</td></tr>'
   }</tbody></table></div></div>`;
  $('#addC').onclick = () => editCustomer(null);
  $('#utBtn').onclick = () => catatUtangDialog(null);
  $('#cUt').onchange = e => {
    S._custUtang = e.target.checked;
    render();
  };
  $$('[data-ut]').forEach(
    b => (b.onclick = () => catatUtangDialog(S.customers.find(c => c.id === b.dataset.ut)))
  );
  $('#rwBtn') && ($('#rwBtn').onclick = rewardsDialog);
  const cq = $('#cq');
  cq.oninput = () => {
    S._custQ = cq.value;
    const pos = cq.selectionStart;
    render();
    const n = $('#cq');
    n.focus();
    n.setSelectionRange(pos, pos);
  };
  $('#cqX').onclick = () => {
    S._custQ = '';
    render();
  };
  $$('[data-e]').forEach(b => (b.onclick = () => editCustomer(S.customers.find(c => c.id === b.dataset.e))));
  $$('[data-pay]').forEach(b => (b.onclick = () => payDebt(S.customers.find(c => c.id === b.dataset.pay))));
  $$('[data-tg]').forEach(b => (b.onclick = () => tagihDialog(S.customers.find(c => c.id === b.dataset.tg))));
  $$('[data-h]').forEach(b => (b.onclick = () => custHistory(S.customers.find(c => c.id === b.dataset.h))));
  $$('[data-pt]').forEach(b => (b.onclick = () => poinDialog(S.customers.find(c => c.id === b.dataset.pt))));
  addScrollPad($('#main .tablewrap'));
};
/** Catat utang tanpa transaksi, misal memindahkan catatan dari buku utang. c = pelanggan (boleh kosong) */
function catatUtangDialog(c) {
  const pakaiMaterial = uangConf().material !== false;
  const m = modal(
    `<h3>📒 Catat utang</h3>
   <p class="muted" style="margin-top:0">Untuk utang yang tidak lewat kasir, misalnya memindahkan catatan dari buku utang. Utang dari belanja di kasir tercatat sendiri (bayar pakai Utang).</p>
   <label>Nama yang berutang *</label>${
     c
       ? `<input value="${esc(c.nama)}" disabled>`
       : `<input id="unNama" list="unList" placeholder="ketik nama, misal: BU ENTIN" autocomplete="off"><datalist id="unList">${S.customers
           .filter(x => x.aktif !== false)
           .map(x => `<option value="${esc(x.nama)}">`)
           .join('')}</datalist>`
   }
   ${c ? `<p class="muted" style="margin:6px 0 0">Utang sekarang: <b>Rp ${rp(saldoUtang(c.id))}</b></p>` : ''}
   <label>Jumlah utang *</label><input id="unJ" inputmode="numeric" class="bignum" ${c ? 'autofocus' : ''}>
   <label>Catatan</label><input id="unC" value="dari buku catatan" placeholder="misal: belanja 20 Okt">
   ${pakaiMaterial ? `<label>Utang untuk</label><select id="unK"><option value="warung">🏪 Warung</option><option value="material">🧱 Material</option></select>` : ''}
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="unOk">💾 Simpan (Enter)</button></div>`
  );
  if (!c) setTimeout(() => $('#unNama', m).focus(), 30);
  const ok = async () => {
    let cc = c;
    if (!cc) {
      const n = $('#unNama', m).value.trim().toUpperCase();
      if (!n) return toast('Isi nama yang berutang', true);
      cc = matchCustomer(n);
      if (!cc) {
        cc = { id: uid(), nama: n, tier: 'umum', telp: '', alamat: '', aktif: true };
        await ensureKode(cc);
        await save('customers', cc);
      }
    }
    const j = num($('#unJ', m).value);
    if (!j) return toast('Isi jumlah utangnya', true);
    await save('payments', {
      id: uid(),
      jenis: 'utang',
      customerId: cc.id,
      waktu: Date.now(),
      jumlah: j,
      kas: $('#unK', m) ? $('#unK', m).value : 'warung',
      catatan: $('#unC', m).value.trim()
    });
    m.close();
    render();
    toast(`Utang ${cc.nama} dicatat ✔ Total utang Rp ${rp(saldoUtang(cc.id))}`);
  };
  $('#unOk', m).onclick = ok;
  m.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT') {
      e.preventDefault();
      ok();
    }
  });
}
function editCustomer(c) {
  const isNew = !c;
  c = c ? { ...c } : { id: uid(), nama: '', tier: 'warung', telp: '', alamat: '', aktif: true };
  const m =
    modal(`<h3>${isNew ? 'Tambah' : 'Ubah'} pelanggan / member</h3>${c.kode ? `<p class="muted" style="margin:0">ID member: <b style="font-family:monospace;color:var(--ink)">${esc(c.kode)}</b></p>` : '<p class="muted" style="margin:0">ID member dibuat otomatis setelah disimpan.</p>'}<label>Nama *</label><input id="cn" value="${esc(c.nama)}" autofocus>
   <label>Kategori harga</label><select id="ct">${tiers()
     .map(t => `<option value="${t.id}" ${t.id === c.tier ? 'selected' : ''}>${esc(t.nama)}</option>`)
     .join('')}</select>
   <div class="grid2"><div><label>No. HP</label><input id="ch" value="${esc(c.telp || '')}" inputmode="tel"></div><div><label>Alamat</label><input id="ca" value="${esc(c.alamat || '')}"></div></div>
   <div class="row" style="margin-top:16px">${!isNew ? '<button class="btn bad" id="cdel">Hapus</button>' : ''}<span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="cok">Simpan</button></div>`);
  $('#cok', m).onclick = async () => {
    c.nama = $('#cn', m).value.trim().toUpperCase();
    if (!c.nama) return toast('Nama wajib diisi', true);
    c.tier = $('#ct', m).value;
    c.telp = $('#ch', m).value.trim();
    c.alamat = $('#ca', m).value.trim();
    const dup = S.customers.find(x => x.id !== c.id && x.nama === c.nama);
    if (dup) return toast('Nama sudah dipakai pelanggan lain', true);
    await ensureKode(c);
    await save('customers', c);
    m.close();
    render();
    toast('Tersimpan ✔ ID member ' + c.kode);
  };
  $$('input', m).forEach(
    i =>
      (i.onkeydown = e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          $('#cok', m).click();
        }
      })
  );
  $('#cdel') &&
    ($('#cdel', m).onclick = async () => {
      if (saldoUtang(c.id) > 0) return toast('Masih ada utang, tidak bisa dihapus', true);
      if (await confirmBox('Hapus pelanggan ' + c.nama + '?', 'Hapus', true)) {
        await remove('customers', c.id);
        m.close();
        render();
      }
    });
}
function payDebt(c) {
  const s = saldoUtang(c.id);
  // utang dipisah per laci (Warung / Material): pembayaran masuk ke laci yang sama
  const per = utangPerKas(c.id);
  const ks = kasAktif().filter(k => (per[k.id] || 0) > 0);
  let kas = ks.length ? ks[0].id : 'warung',
    metode = 'tunai';
  const m = modal(
    `<h3>Bayar utang · ${esc(c.nama)}</h3><p>Sisa utang: <b style="font-size:22px">Rp ${rp(s)}</b>${ks.length > 1 ? `<br><span class="muted">${ks.map(k => `${k.ikon} ${esc(k.nama)} Rp ${rp(per[k.id])}`).join(' · ')}</span>` : ''}</p>
   ${ks.length > 1 ? `<label>Bayar utang untuk</label><div class="kaspick">${ks.map(k => `<button type="button" data-pk="${k.id}" class="${k.id === kas ? 'on' : ''}" style="--kc:${k.warna}">${k.ikon} ${esc(k.nama)} · Rp ${rp(per[k.id])}</button>`).join('')}</div>` : ''}
   <label>Jumlah dibayar</label><input id="pj" inputmode="numeric" autofocus value="${s > 0 ? rp(ks.length > 1 ? per[kas] : s) : ''}" style="font-size:24px">
   <label>Dibayar dengan</label><div class="tabs2" style="margin:0"><button class="on" data-pm="tunai">💵 Tunai</button><button data-pm="non">📱 QRIS / transfer</button></div>
   <label>Catatan</label><input id="pn">
   <p class="muted" style="font-size:13px;margin:8px 0 0" id="pinfo"></p>
   <label class="chk"><input type="checkbox" id="pprn" ${S.meta.autoPrint !== false ? 'checked' : ''}> 🖨️ Cetak bukti bayar</label>
   <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-close>Batal</button><button class="btn ok" id="pok">Simpan pembayaran</button></div>`
  );
  const info = () =>
    ($('#pinfo', m).innerHTML =
      metode === 'tunai'
        ? `Uangnya dimasukkan ke laci <b>${esc(infoKas(kas).nama)}</b>.`
        : 'Uangnya masuk ke rekening / QRIS, tidak ke laci.');
  info();
  pasangPilihKas(m, k => {
    kas = k;
    $('#pj', m).value = rp(per[k] || 0);
    info();
  });
  $$('[data-pm]', m).forEach(
    b =>
      (b.onclick = () => {
        metode = b.dataset.pm;
        $$('[data-pm]', m).forEach(x => x.classList.toggle('on', x === b));
        info();
      })
  );
  $('#pok', m).onclick = async () => {
    const j = num($('#pj', m).value);
    if (!j) return toast('Isi jumlahnya', true);
    const sebelum = saldoUtang(c.id);
    const p = {
      id: uid(),
      customerId: c.id,
      waktu: Date.now(),
      jumlah: j,
      kas,
      metode: metode === 'tunai' ? 'tunai' : 'transfer',
      catatan: $('#pn', m).value.trim(),
      sebelum,
      sesudah: sebelum - j
    };
    await save('payments', p);
    if ($('#pprn', m).checked) cetakBuktiBayarUtang(c, p);
    m.close();
    render();
    toast('Pembayaran dicatat ✔ Sisa Rp ' + rp(saldoUtang(c.id)));
  };
}
function custHistory(c) {
  const ev = [
    ...S.sales
      .filter(s => s.customerId === c.id && !s.batal)
      .map(s => ({ w: s.waktu, t: `Belanja ${s.no}`, b: s.total, u: s.utang, cs: s.id })),
    ...S.payments
      .filter(p => p.customerId === c.id)
      .map(p =>
        p.jenis === 'utang'
          ? { w: p.waktu, t: 'Utang dicatat' + (p.catatan ? ' · ' + p.catatan : ''), b: 0, u: p.jumlah }
          : {
              w: p.waktu,
              t: 'Bayar utang' + (p.catatan ? ' · ' + p.catatan : ''),
              b: 0,
              u: -p.jumlah,
              cp: p.id
            }
      )
  ].sort((a, b) => b.w - a.w);
  const m = modal(
    `<h3>Riwayat · ${esc(c.nama)}</h3><div class="row" style="align-items:center"><p class="grow" style="margin:0">Sisa utang: <b>Rp ${rp(saldoUtang(c.id))}</b></p>${saldoUtang(c.id) > 0 ? `<button class="btn ghost wa" id="chTg">💬 Tagih lewat WA</button>` : ''}</div><div class="tablewrap" style="max-height:60vh"><table><thead><tr><th>Waktu</th><th>Keterangan</th><th class="num">Belanja</th><th class="num">Utang +/-</th><th></th></tr></thead><tbody>${ev.map(e => `<tr><td>${tglJam(e.w)}</td><td>${esc(e.t)}</td><td class="num">${e.b ? rp(e.b) : ''}</td><td class="num">${e.u ? (e.u > 0 ? '+' : '') + rp(e.u) : ''}</td><td class="right">${e.cs ? `<button class="btn sm ghost" data-cs="${e.cs}" title="Cetak ulang struk">🖨️</button>` : e.cp ? `<button class="btn sm ghost" data-cp="${e.cp}" title="Cetak bukti bayar">🖨️</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Belum ada.</td></tr>'}</tbody></table></div><div class="right" style="margin-top:12px"><button class="btn ghost" data-close>Tutup</button></div>`,
    { wide: true }
  );
  $('#chTg', m) &&
    ($('#chTg', m).onclick = () => {
      m.close();
      tagihDialog(c);
    });
  $$('[data-cs]', m).forEach(b => (b.onclick = () => printReceipt(S.sales.find(s => s.id === b.dataset.cs))));
  $$('[data-cp]', m).forEach(
    b =>
      (b.onclick = () =>
        cetakBuktiBayarUtang(
          c,
          S.payments.find(p => p.id === b.dataset.cp)
        ))
  );
}
