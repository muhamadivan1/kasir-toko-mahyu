/* ============ DAFTAR KULAKAN (belanja barang dagangan) ============
 * Disusun otomatis dari penjualan 30 hari terakhir:
 *   saran beli = rata-rata laku per hari × jumlah hari persediaan − stok sekarang
 * Barang yang stoknya sudah di bawah "batas stok menipis" juga ikut.
 * Pilihan & jumlah yang diubah disimpan (meta 'kulakan'), jadi daftar tetap ada sampai barangnya datang.
 */
function lakuPerProduk(hari = 30) {
  const dari = dayStart(-(hari - 1));
  const byId = new Map(S.products.map(p => [p.id, p]));
  const laku = {};
  let pertama = Infinity;
  for (const s of S.sales) {
    if (s.batal) continue;
    if (s.waktu < pertama) pertama = s.waktu;
    if (s.waktu < dari) continue;
    for (const it of s.items) {
      if (it.manual) continue;
      const p = byId.get(it.productId);
      if (p) laku[p.id] = (laku[p.id] || 0) + qtyDasar(p, it);
    }
  }
  // aplikasi yang baru dipakai beberapa hari: rata-rata dibagi hari yang sudah berjalan
  const jalan =
    pertama === Infinity
      ? 1
      : Math.max(1, Math.min(hari, Math.ceil((Date.now() - Math.max(pertama, dari)) / 86400000)));
  return { laku, hari: jalan };
}
/** Satuan beli yang wajar: satuan besar (DUS, RCG, SLOP) kalau sarannya minimal setengah isinya */
function satuanBeli(p, saranDasar) {
  const besar = (p.units || []).filter(u => Number(u.isi) > 1).sort((a, b) => b.isi - a.isi);
  for (const u of besar)
    if (saranDasar >= Number(u.isi) * 0.5)
      return { unit: u.nama, qty: Math.ceil(saranDasar / Number(u.isi)) };
  return { unit: p.satuan || 'PCS', qty: Math.max(1, Math.ceil(saranDasar)) };
}
function hitungKulakan(hariStok, ikutHabis) {
  const { laku, hari } = lakuPerProduk(30);
  const out = [];
  for (const p of S.products) {
    if (p.aktif === false) continue;
    if (p.dariDaftar && !laku[p.id]) continue; // dari daftar barcode, belum pernah dijual di toko
    const perHari = (laku[p.id] || 0) / hari;
    const stok = Number(p.stok) || 0,
      min = Number(p.minStok) || 0,
      ada = Math.max(0, stok);
    const butuh = Math.ceil(perHari * hariStok);
    const target = Math.max(perHari > 0 ? butuh : 0, min > 0 && stok <= min ? min * 2 : 0);
    let saran = target - ada;
    let alasan;
    if (saran > 0) {
      const cukup = perHari > 0 ? ada / perHari : null;
      alasan =
        stok < 0
          ? 'Stok tercatat minus (perlu dihitung ulang)'
          : stok === 0
            ? 'Habis'
            : cukup !== null && cukup < hariStok
              ? `Sisa ${rp(stok)} ${esc(p.satuan || '')}, cukup ± ${cukup < 1 ? 'kurang dari 1' : Math.floor(cukup)} hari`
              : `Di bawah batas menipis (${rp(min)})`;
    } else if (ikutHabis && stok <= 0 && !perHari) {
      saran = 1;
      alasan = stok < 0 ? 'Stok tercatat minus, belum laku di aplikasi' : 'Habis, belum laku di aplikasi';
    } else continue;
    out.push({
      p,
      perHari,
      stok,
      saran,
      alasan,
      cukup: perHari > 0 ? ada / perHari : null,
      ...satuanBeli(p, saran)
    });
  }
  return out.sort((a, b) => (a.cukup ?? 1e9) - (b.cukup ?? 1e9) || b.perHari - a.perHari);
}
function kulakanDialog() {
  S.meta.kulakan = S.meta.kulakan || {};
  const pil = S.meta.kulakan;
  const pakaiMaterial = kasAktif().some(k => k.id === 'material');
  let tab = 'semua',
    ikutHabis = false;
  let hari = Number(uangConf().hariKulakan) || 7;
  const m = modal(
    `<h3>🛒 Daftar kulakan</h3>
    <p class="muted" style="margin-top:0">Disusun dari penjualan 30 hari terakhir dan stok sekarang. Centang yang mau dibeli, ubah jumlahnya kalau perlu. Daftar ini tersimpan sampai barangnya datang.</p>
    <div class="row kulbar">${
      pakaiMaterial
        ? `<div class="tabs2" style="margin:0">${[
            ['semua', 'Semua'],
            ['warung', '🏪 Warung'],
            ['material', '🧱 Material']
          ]
            .map(([k, l]) => `<button data-kt="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`)
            .join('')}</div>`
        : ''
    }
      <label class="inl">Cukup untuk <input id="kh" inputmode="numeric" value="${hari}"> hari</label>
      <label class="inl"><input type="checkbox" id="kall"> + barang habis yang belum laku</label></div>
    <div style="position:relative"><input id="kq" placeholder="➕ Tambah barang lain ke daftar (ketik nama)…" autocomplete="off"><div id="kql" class="kql"></div></div>
    <div class="tablewrap" style="max-height:50vh;margin-top:8px"><table class="zebra kultab"><thead><tr><th></th><th>Barang</th><th class="num">Stok</th><th class="num">Laku/hari</th><th class="num">Beli</th><th class="num">Perkiraan</th></tr></thead><tbody id="kb"></tbody></table></div>
    <div class="row kulfoot"><span id="ksum" class="grow"></span><button class="btn ghost" id="kprn">🖨️ Cetak</button><button class="btn ghost" id="kwa">💬 WhatsApp</button><button class="btn pri" id="kdtg">✅ Barang sudah datang</button></div>`,
    { wide: true, onClose: focusMain }
  );
  const simpan = () => saveMeta('kulakan');
  let baris = [];
  const susun = () => {
    const hasil = hitungKulakan(hari, ikutHabis);
    const ada = new Set(hasil.map(x => x.p.id));
    for (const id of Object.keys(pil)) {
      if (ada.has(id) || !pil[id].tambah) continue;
      const p = S.products.find(x => x.id === id);
      if (!p) {
        delete pil[id];
        continue;
      }
      hasil.push({
        p,
        perHari: 0,
        stok: Number(p.stok) || 0,
        saran: 1,
        alasan: 'Ditambah sendiri',
        cukup: null,
        ...satuanBeli(p, 1)
      });
    }
    baris = hasil
      .filter(x => tab === 'semua' || kasProduk(x.p) === tab)
      .map(x => {
        const s = pil[x.p.id] || {};
        const unit = unitsOf(x.p).some(u => u.nama === s.unit) ? s.unit : x.unit;
        return { ...x, unit, qty: s.qty ?? x.qty, on: s.on ?? true };
      });
  };
  const draw = () => {
    $('#kb', m).innerHTML =
      baris
        .map((x, i) => {
          const p = x.p;
          const hb = hbUnit(p, x.unit);
          return `<tr class="${x.on ? '' : 'off'}"><td><input type="checkbox" data-on="${i}" ${x.on ? 'checked' : ''}></td>
          <td><b>${esc(p.nama)}</b> ${kasProduk(p) === 'material' ? kasPill('material') : ''}<div class="muted" style="font-size:13px">${x.alasan}</div></td>
          <td class="num">${fmtStok(p)}</td>
          <td class="num">${x.perHari ? (x.perHari >= 10 ? rp(x.perHari) : String(Math.round(x.perHari * 10) / 10).replace('.', ',')) : '-'}</td>
          <td class="num"><div class="row" style="gap:4px;flex-wrap:nowrap;justify-content:flex-end"><input data-qty="${i}" value="${String(x.qty).replace('.', ',')}" inputmode="decimal" style="width:64px;min-height:38px;padding:4px 6px;text-align:right">${
            unitsOf(p).length > 1
              ? `<select data-unit="${i}" style="width:auto;min-height:38px;padding:4px">${unitsOf(p)
                  .map(
                    u =>
                      `<option value="${esc(u.nama)}" ${u.nama === x.unit ? 'selected' : ''}>${esc(u.nama)}${u.isi > 1 ? ' (' + rp(u.isi) + ')' : ''}</option>`
                  )
                  .join('')}</select>`
              : `<span class="muted" style="font-size:13px">${esc(p.satuan || '')}</span>`
          }</div></td>
          <td class="num">${hb ? rp(num(x.qty) * hb) : '<span class="muted" title="Harga beli belum diisi">?</span>'}</td></tr>`;
        })
        .join('') ||
      '<tr><td colspan="6" class="empty">👍 Belum ada barang yang perlu dibeli.<br><span style="font-size:14px">Daftar dihitung dari penjualan di aplikasi ini. Barang lain bisa ditambah lewat kolom di atas.</span></td></tr>';
    const on = baris.filter(x => x.on && num(x.qty) > 0);
    const total = on.reduce((a, x) => a + num(x.qty) * hbUnit(x.p, x.unit), 0);
    const tanpa = on.filter(x => !hbUnit(x.p, x.unit)).length;
    $('#ksum', m).innerHTML =
      `<b>${on.length}</b> barang dicentang · perkiraan <b>Rp ${rp(total)}</b>${tanpa ? ` <span class="muted">(${tanpa} belum ada harga beli)</span>` : ''}`;
    $$('[data-on]', m).forEach(
      c =>
        (c.onchange = () => {
          const x = baris[+c.dataset.on];
          x.on = c.checked;
          pil[x.p.id] = { ...(pil[x.p.id] || {}), on: c.checked };
          simpan();
          draw();
        })
    );
    $$('[data-qty]', m).forEach(
      c =>
        (c.onchange = () => {
          const x = baris[+c.dataset.qty];
          x.qty = num(c.value);
          pil[x.p.id] = { ...(pil[x.p.id] || {}), qty: x.qty, unit: x.unit };
          simpan();
          draw();
        })
    );
    $$('[data-unit]', m).forEach(
      c =>
        (c.onchange = () => {
          const x = baris[+c.dataset.unit];
          x.unit = c.value;
          pil[x.p.id] = { ...(pil[x.p.id] || {}), qty: x.qty, unit: x.unit };
          simpan();
          draw();
        })
    );
  };
  const ulang = () => {
    susun();
    draw();
  };
  $$('[data-kt]', m).forEach(
    b =>
      (b.onclick = () => {
        tab = b.dataset.kt;
        $$('[data-kt]', m).forEach(x => x.classList.toggle('on', x === b));
        ulang();
      })
  );
  $('#kh', m).onchange = async () => {
    hari = Math.max(1, Math.round(num($('#kh', m).value)) || 7);
    $('#kh', m).value = hari;
    uangConf().hariKulakan = hari;
    await saveMeta('settings');
    ulang();
  };
  $('#kall', m).onchange = () => {
    ikutHabis = $('#kall', m).checked;
    ulang();
  };
  $('#kq', m).oninput = () => {
    const q = $('#kq', m).value.trim();
    const r = q ? searchProducts(q, 8) : [];
    $('#kql', m).innerHTML = r
      .map(
        p =>
          `<div class="row" data-ka="${p.id}"><span class="grow">${esc(p.nama)}</span><span class="muted" style="font-size:13px">stok ${rp(p.stok)}</span><button class="btn sm pri">Tambah</button></div>`
      )
      .join('');
    $$('[data-ka]', m).forEach(
      d =>
        (d.onclick = () => {
          pil[d.dataset.ka] = { ...(pil[d.dataset.ka] || {}), tambah: true, on: true };
          simpan();
          $('#kq', m).value = '';
          $('#kql', m).innerHTML = '';
          ulang();
        })
    );
  };
  const dipilih = () => baris.filter(x => x.on && num(x.qty) > 0);
  const teksDaftar = () =>
    dipilih()
      .map((x, i) => `${i + 1}. ${x.p.nama}: ${String(num(x.qty)).replace('.', ',')} ${x.unit}`)
      .join('\n');
  $('#kprn', m).onclick = () => {
    const l = dipilih();
    if (!l.length) return toast('Belum ada barang yang dicentang', true);
    const st = settings();
    const w = Number(st.lebarStruk) || 72;
    printHTML(
      `<div class="c"><div class="b big">DAFTAR BELANJA</div><div>${esc(st.nama)} · ${tgl(Date.now())}</div></div><div class="hr"></div>${l
        .map(
          x =>
            `<div class="r"><span>[ ] ${esc(x.p.nama)}</span><b>${String(num(x.qty)).replace('.', ',')} ${esc(x.unit)}</b></div>`
        )
        .join(
          ''
        )}<div class="hr"></div><div class="r"><span>Perkiraan</span><b>Rp ${rp(l.reduce((a, x) => a + num(x.qty) * hbUnit(x.p, x.unit), 0))}</b></div><div style="height:12mm"></div>`,
      `@page{size:${w}mm auto;margin:0}body{margin:0;padding:2mm 3mm;width:${w}mm;box-sizing:border-box;font-family:Arial,sans-serif;font-size:11px;color:#000}.c{text-align:center}.b{font-weight:700}.big{font-size:14px}.r{display:flex;justify-content:space-between;gap:6px;margin:1px 0}.hr{border-top:1px dashed #000;margin:4px 0}`
    );
  };
  $('#kwa', m).onclick = () => {
    if (!dipilih().length) return toast('Belum ada barang yang dicentang', true);
    // pilih sales tujuan (kalau ada yang punya No. HP), lalu catat sebagai pesanan supaya ada pengingat datang
    if (daftarSup().some(s => s.aktif !== false && waNumber(s.hp))) return pilihSalesDialog(teksDaftar());
    const t = `Daftar belanja ${settings().nama} (${tgl(Date.now())})\n${teksDaftar()}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
  };
  $('#kdtg', m).onclick = () => {
    const l = dipilih();
    if (!l.length) return toast('Centang dulu barang yang sudah datang', true);
    const kas = l.every(x => kasProduk(x.p) === 'material') ? 'material' : 'warung';
    stockDialog(
      'masuk',
      l.map(x => ({ p: x.p, qty: x.qty, unit: x.unit })),
      () => {
        l.forEach(x => delete pil[x.p.id]);
        simpan();
        ulang();
      },
      { bayarKas: kas, catatan: 'Kulakan ' + tgl(Date.now()) }
    );
  };
  ulang();
}
/** Jumlah barang laku yang perlu dibeli (untuk pengingat di Beranda).
 * Barang yang stoknya minus tidak dihitung di sini: stoknya belum akurat dan sudah punya pengingat sendiri. */
function jumlahPerluKulakan() {
  return hitungKulakan(Number(uangConf().hariKulakan) || 7, false).filter(x => x.perHari > 0 && x.stok >= 0)
    .length;
}
