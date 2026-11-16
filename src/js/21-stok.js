/* ============ STOK ============ */
views.stok = () => {
  $('#main').innerHTML =
    `<div class="card"><div class="row" style="margin-bottom:12px"><h2 class="grow" style="margin:0">Stok barang</h2>
   <button class="btn pri" id="kulBtn">🛒 Daftar kulakan</button><button class="btn pri" id="inBtn">📥 Barang masuk</button><button class="btn ghost" id="opBtn">✅ Hitung ulang stok (opname)</button><button class="btn ghost" id="mvBtn">📜 Riwayat</button></div>
   <div class="row" style="margin-bottom:10px"><input id="sq" class="grow" placeholder="Cari barang…" style="max-width:520px"><select id="sf" style="max-width:240px"><option value="">Semua</option><option value="low">Stok menipis / habis</option><option value="neg">Stok minus</option></select></div>
   <div class="tablewrap"><table class="zebra"><thead><tr><th>Barang</th><th class="hide-m">Kategori</th><th class="num">Stok</th><th class="num">Batas</th><th class="num hide-m">Harga beli</th><th class="num hide-m">Nilai stok</th><th></th></tr></thead><tbody id="stb"></tbody></table></div></div>`;
  const draw = () => {
    const q = $('#sq').value,
      f = $('#sf').value;
    let l = q
      ? searchProducts(q, 100000)
      : S.products
          .filter(p => p.aktif !== false && !(p.dariDaftar && !Number(p.stok)))
          .sort((a, b) => a.nama.localeCompare(b.nama));
    if (f === 'low') l = l.filter(p => !p.dariDaftar && Number(p.stok) <= Number(p.minStok || 0));
    if (f === 'neg') l = l.filter(p => Number(p.stok) < 0);
    $('#stb').innerHTML =
      l
        .slice(0, 400)
        .map(
          p => `<tr><td><b>${esc(p.nama)}</b></td><td class="hide-m muted">${esc(p.kategori || '')}</td>
     <td class="num">${Number(p.stok) <= Number(p.minStok || 0) ? `<span class="badge bad">${rp(p.stok)}</span> <span class="muted" style="font-size:12px">${esc(p.satuan || '')}</span>` : fmtStok(p)}</td><td class="num">${rp(p.minStok || 0)}</td>
     <td class="num hide-m">${rp(p.hargaBeli)}</td><td class="num hide-m">${rp((p.hargaBeli || 0) * Math.max(0, p.stok || 0))}</td>
     <td class="right"><button class="btn sm ghost" data-in="${p.id}">+ Masuk</button> <button class="btn sm ghost" data-op="${p.id}">Sesuaikan</button></td></tr>`
        )
        .join('') || '<tr><td colspan="7" class="empty">Tidak ada data.</td></tr>';
    $$('[data-in]', $('#stb')).forEach(
      b => (b.onclick = () => stockDialog('masuk', [S.products.find(p => p.id === b.dataset.in)], draw))
    );
    $$('[data-op]', $('#stb')).forEach(
      b => (b.onclick = () => stockDialog('opname', [S.products.find(p => p.id === b.dataset.op)], draw))
    );
  };
  $('#sf').value = S._stokFilter || '';
  S._stokFilter = '';
  $('#sq').oninput = draw;
  $('#sf').onchange = draw;
  addScrollPad($('#stb').closest('.tablewrap'));
  $('#inBtn').onclick = () => stockDialog('masuk', [], draw);
  $('#kulBtn').onclick = kulakanDialog;
  $('#opBtn').onclick = () => stockDialog('opname', [], draw);
  $('#mvBtn').onclick = moveHistory;
  draw();
};
/** Barang masuk / hitung ulang stok.
 * initial: daftar produk, atau {p, qty, unit} (dari daftar kulakan).
 * opt.bayarKas: laci yang dipakai membayar (barang masuk), opt.catatan: catatan awal */
function stockDialog(type, initial, after, opt = {}) {
  const rows = initial.map(x =>
    x && x.p ? { p: x.p, qty: x.qty ?? '', hb: '', unit: x.unit } : { p: x, qty: '', hb: '' }
  );
  const masuk = type === 'masuk';
  let bayarKas = masuk ? opt.bayarKas || '' : '';
  let bayarManual = false;
  const m = modal(
    `<h3>${type === 'masuk' ? '📥 Barang masuk (belanja/kiriman sales)' : '✅ Hitung ulang stok'}</h3>
   <p class="muted" style="margin-top:0">${type === 'masuk' ? 'Scan atau cari barang, isi jumlah yang datang. Harga beli boleh diisi kalau berubah.' : 'Isi jumlah barang yang benar-benar ada di rak/gudang.'}</p>
   <input id="sd" placeholder="Scan / cari barang…" autofocus><div id="sdl"></div>
   <div class="tablewrap" style="max-height:340px;margin-top:8px"><table><thead><tr><th>Barang</th><th class="num">Stok tercatat</th><th class="num">${type === 'masuk' ? 'Jumlah masuk' : 'Stok sebenarnya'}</th>${type === 'masuk' ? '<th class="num">Harga beli baru (per satuan dipilih)</th>' : ''}<th></th></tr></thead><tbody id="sdr"></tbody></table></div>
   <label>Catatan (misal: nama supplier / sales)</label><input id="sdn" value="${esc(opt.catatan || '')}">
   ${
     masuk
       ? `<div class="bayarbox"><label>Dibayar pakai uang</label><div class="kaspick">${[
           { id: '', ikon: '📝', label: 'Tidak dicatat', warna: '#6b7686' },
           ...kasAktif()
             .filter(k => k.id !== 'brilink')
             .map(k => ({ ...k, label: 'Laci ' + k.nama })),
           { id: 'utang', ikon: '📒', label: 'Utang ke supplier (bayar nanti)', warna: '#b3261e' }
         ]
           .map(
             k =>
               `<button type="button" data-bk="${k.id}" class="${k.id === bayarKas ? 'on' : ''}" style="--kc:${k.warna}">${k.ikon} ${esc(k.label)}</button>`
           )
           .join('')}</div>
       <div id="sdBayar" class="${bayarKas ? '' : 'hide'}"><div class="grid2"><div><label id="sdjL">${bayarKas === 'utang' ? 'Jumlah utang (Rp)' : 'Jumlah dibayar (Rp)'}</label><input id="sdj" inputmode="numeric"></div><div class="hint" style="align-self:end">Otomatis dari jumlah × harga beli. Ubah kalau berbeda dengan nota.</div></div>
       <div id="sdUtang" class="${bayarKas === 'utang' ? '' : 'hide'}"><div class="grid3"><div><label>Supplier / sales *</label><select id="sdSup">${opsiSupplier(opt.supplierId || '')}</select></div><div><label>No. nota (opsional)</label><input id="sdNo"></div><div><label>Jatuh tempo bayar</label><input type="date" id="sdJt" value="${jatuhTempoAwal(opt.supplierId || '', dkey(Date.now()))}"></div></div></div></div>
       ${opt.isiPesanan ? `<p class="hint">🗓️ Isi pesanan: ${esc(opt.isiPesanan.replace(/\n/g, ', '))}</p>` : ''}</div>`
       : ''
   }
   <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="sdok">Simpan</button></div>`,
    { wide: true }
  );
  const totalBeli = () =>
    rows.reduce((a, r) => {
      const q = num(r.qty);
      if (!q) return a;
      const u = r.unit || r.p.satuan;
      return a + q * (String(r.hb).trim() ? num(r.hb) : hbUnit(r.p, u));
    }, 0);
  const isiBayar = () => {
    if (!masuk || bayarManual || !$('#sdj', m)) return;
    const t = totalBeli();
    $('#sdj', m).value = t ? rp(t) : '';
  };
  if (masuk) {
    $$('[data-bk]', m).forEach(
      b =>
        (b.onclick = () => {
          bayarKas = b.dataset.bk;
          $$('[data-bk]', m).forEach(x => x.classList.toggle('on', x === b));
          $('#sdBayar', m).classList.toggle('hide', !bayarKas);
          $('#sdUtang', m).classList.toggle('hide', bayarKas !== 'utang');
          $('#sdjL', m).textContent = bayarKas === 'utang' ? 'Jumlah utang (Rp)' : 'Jumlah dibayar (Rp)';
          isiBayar();
        })
    );
    $('#sdj', m).oninput = () => (bayarManual = true);
    let jtManual = false;
    $('#sdJt', m).onchange = () => (jtManual = true);
    pasangPilihSupplier($('#sdSup', m), sid => {
      if (!jtManual) $('#sdJt', m).value = jatuhTempoAwal(sid, dkey(Date.now()));
    });
  }
  const drawRows = () => {
    $('#sdr', m).innerHTML =
      rows
        .map(
          (r, i) =>
            `<tr><td>${esc(r.p.nama)}</td><td class="num">${rp(r.p.stok)}</td><td class="num"><div class="row" style="justify-content:flex-end;gap:4px;flex-wrap:nowrap"><input data-q="${i}" value="${r.qty}" inputmode="decimal" style="width:90px">${
              unitsOf(r.p).length > 1
                ? `<select data-su="${i}" style="width:auto;min-height:40px;padding:4px">${unitsOf(r.p)
                    .map(
                      u =>
                        `<option value="${esc(u.nama)}" ${u.nama === (r.unit || r.p.satuan) ? 'selected' : ''}>${esc(u.nama)}${u.isi > 1 ? ' (' + u.isi + ')' : ''}</option>`
                    )
                    .join('')}</select>`
                : `<span class="muted" style="font-size:12px">${esc(r.p.satuan || '')}</span>`
            }</div></td>${type === 'masuk' ? `<td class="num"><input data-h="${i}" value="${r.hb}" placeholder="${rp(r.p.hargaBeli)}" inputmode="numeric" style="width:120px"></td>` : ''}<td><button class="btn sm bad" data-x="${i}">✕</button></td></tr>`
        )
        .join('') || '<tr><td colspan="5" class="empty">Belum ada barang.</td></tr>';
    $$('[data-q]', m).forEach(
      x =>
        (x.oninput = () => {
          rows[x.dataset.q].qty = x.value;
          isiBayar();
        })
    );
    $$('[data-su]', m).forEach(
      x =>
        (x.onchange = () => {
          rows[x.dataset.su].unit = x.value;
          isiBayar();
        })
    );
    $$('[data-h]', m).forEach(
      x =>
        (x.oninput = () => {
          rows[x.dataset.h].hb = x.value;
          isiBayar();
        })
    );
    $$('[data-x]', m).forEach(
      x =>
        (x.onclick = () => {
          rows.splice(x.dataset.x, 1);
          drawRows();
        })
    );
    isiBayar();
  };
  const addRow = p => {
    if (!rows.find(r => r.p.id === p.id)) rows.push({ p, qty: '', hb: '' });
    drawRows();
    $('#sdl', m).innerHTML = '';
    $('#sd', m).value = '';
    setTimeout(() => {
      const ins = $$('[data-q]', m);
      const idx = rows.findIndex(r => r.p.id === p.id);
      ins[idx] && ins[idx].focus();
    }, 20);
  };
  $('#sd', m).oninput = e => {
    const r = searchProducts(e.target.value, 10);
    $('#sdl', m).innerHTML = r
      .map(
        p =>
          `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="grow">${esc(p.nama)}</span><button class="btn sm pri" data-a="${p.id}">Pilih</button></div>`
      )
      .join('');
    $$('[data-a]', m).forEach(b => (b.onclick = () => addRow(S.products.find(p => p.id === b.dataset.a))));
  };
  $('#sd', m).onkeydown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = e.target.value.trim();
      if (!v) return;
      const p = findBarcode(v) || searchProducts(v, 2)[0];
      if (p) addRow(p);
      else
        confirmBox(`“${v}” belum ada di daftar produk. Tambah produk baru?`, '➕ Tambah produk').then(y => {
          if (y)
            editProduct(null, presetFrom(v), np => {
              if (np) addRow(np);
            });
        });
    }
  };
  drawRows();
  $('#sdok', m).onclick = async () => {
    const ok = rows.filter(r => String(r.qty).trim() !== '');
    if (!ok.length) return toast('Isi jumlahnya dulu', true);
    if (masuk && bayarKas === 'utang') {
      if (!$('#sdSup', m).value) return toast('Pilih supplier yang memberi utang', true);
      if (!(num($('#sdj', m).value) > 0)) return toast('Isi jumlah utangnya', true);
    }
    const note = $('#sdn', m).value.trim();
    const t = Date.now();
    for (const r of ok) {
      const isi = unitByName(r.p, r.unit || r.p.satuan).isi;
      const q = num(r.qty) * isi;
      const before = Number(r.p.stok) || 0;
      if (type === 'masuk') {
        r.p.stok = before + q;
        if (String(r.hb).trim()) r.p.hargaBeli = Math.round(num(r.hb) / isi);
      } else r.p.stok = q;
      await save('moves', {
        id: uid(),
        waktu: t,
        productId: r.p.id,
        nama: r.p.nama,
        jenis: type,
        qty: type === 'masuk' ? q : q - before,
        sebelum: before,
        sesudah: r.p.stok,
        catatan: note
      });
      await DB.put('products', r.p);
    }
    let bayar = 0;
    let nota = null;
    if (masuk && bayarKas === 'utang') {
      nota = {
        id: uid(),
        supplierId: $('#sdSup', m).value,
        waktu: t,
        noNota: $('#sdNo', m).value.trim(),
        total: num($('#sdj', m).value),
        jatuhTempo: $('#sdJt', m).value || '',
        catatan:
          note ||
          ok
            .map(r => r.p.nama)
            .slice(0, 3)
            .join(', ') + (ok.length > 3 ? ', …' : ''),
        bayar: []
      };
      daftarNota().push(nota);
      await saveMeta('notaSupplier');
    } else if (masuk && bayarKas) {
      bayar = num($('#sdj', m).value);
      if (bayar > 0)
        await catatUang({
          jenis: 'keluar',
          kas: bayarKas,
          jumlah: bayar,
          kategori: 'kulakan',
          stok: true,
          catatan:
            note ||
            'Barang masuk: ' +
              ok
                .map(r => r.p.nama)
                .slice(0, 3)
                .join(', ') +
              (ok.length > 3 ? ', …' : ''),
          waktu: t
        });
    }
    m.close();
    toast(
      nota
        ? `Stok diperbarui ✔ Utang ke ${namaSup(nota.supplierId)} Rp ${rp(nota.total)} dicatat`
        : bayar
          ? `Stok diperbarui ✔ Bayar Rp ${rp(bayar)} dari laci ${infoKas(bayarKas).nama}`
          : 'Stok diperbarui ✔'
    );
    after && after();
  };
}
function moveHistory() {
  const l = S.moves
    .slice()
    .sort((a, b) => b.waktu - a.waktu)
    .slice(0, 300);
  modal(
    `<h3>Riwayat stok</h3><div class="tablewrap" style="max-height:60vh"><table><thead><tr><th>Waktu</th><th>Barang</th><th>Jenis</th><th class="num">Perubahan</th><th class="num">Jadi</th><th>Catatan</th></tr></thead><tbody>${l.map(x => `<tr><td>${tglJam(x.waktu)}</td><td>${esc(x.nama)}</td><td>${x.jenis === 'masuk' ? '<span class="badge ok">masuk</span>' : x.jenis === 'hadiah' ? '<span class="badge">hadiah poin</span>' : '<span class="badge warn">opname</span>'}</td><td class="num">${x.qty > 0 ? '+' : ''}${rp(x.qty)}</td><td class="num">${rp(x.sesudah)}</td><td class="muted">${esc(x.catatan || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Belum ada riwayat.</td></tr>'}</tbody></table></div><div class="right" style="margin-top:12px"><button class="btn ghost" data-close>Tutup</button></div>`,
    { wide: true }
  );
}
