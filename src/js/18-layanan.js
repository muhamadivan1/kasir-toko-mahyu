/* ============ LAYANAN DI KASIR (pulsa, token, tagihan, BRILink) ============
 * Layanan dicatat sebagai baris keranjang biasa, jadi bisa digabung dengan belanja barang
 * (misal beli rokok sekalian token listrik). Uangnya dibagi otomatis ke laci yang benar.
 */
/** "10rb" -> 10000, "50.000" -> 50000, "1jt" -> 1000000 */
function bacaNominal(t) {
  const m = String(t || '')
    .toLowerCase()
    .replace(/(\d)\.(?=\d{3})/g, '$1')
    .match(/(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta)?\b/);
  if (!m) return 0;
  let v = parseFloat(m[1].replace(',', '.'));
  if (/^(rb|ribu|k)$/.test(m[2] || '')) v *= 1000;
  else if (/^(jt|juta)$/.test(m[2] || '')) v *= 1e6;
  return Math.round(v);
}
/** Layanan yang cocok dengan ketikan di kolom scan, contoh:
 * "pulsa 10rb", "token 50rb", "dana 25rb", "bpjs", "tarik 500rb", "bri transfer", "bri" (layanan BRILink yang sering dipakai) */
function layananCocok(q) {
  let t = String(q || '')
    .toLowerCase()
    .trim()
    .replace(/^(isi|beli|bayar|mau|cek)\s+(?=[a-z])/, '');
  let kasF = '';
  const mk = t.match(/^(brilink|bri|pojokbayar|pojok|pb)\b\s*(.*)$/);
  if (mk) {
    kasF = mk[1].startsWith('p') ? 'warung' : 'brilink';
    t = mk[2];
  }
  const aktif = layananAktif();
  if (!t && kasF === 'brilink')
    return BRILINK_POPULER.filter(j => aktif.includes(j)).map(j => ({ jenis: j, ket: '', nominal: 0 }));
  const m = t.match(/^([a-z][a-z-]*)(.*)$/);
  if (!m) return [];
  const w = m[1].replace(/-/g, '');
  const nominal = bacaNominal(m[2]);
  const out = [];
  for (const j of urutanLayanan()) {
    const L = LAYANAN[j];
    if (!aktif.includes(j) || (kasF && L.kas !== kasF)) continue;
    const k = (L.kata || []).find(k => k.startsWith(w) && (w.length >= 4 || w === k));
    if (!k) continue;
    const ket = KATA_PILIHAN[k] && (L.pilihan || []).includes(KATA_PILIHAN[k]) ? KATA_PILIHAN[k] : '';
    out.push({ jenis: j, ket, nominal });
    if (out.length >= 6) break;
  }
  return out;
}
function namaAplikasi(kas) {
  return kas === 'brilink' ? 'BRILink' : 'PojokBayar';
}
function saranLayananHTML(x, i, act) {
  const L = LAYANAN[x.jenis];
  const k = infoKas(L.kas);
  return `<div data-i="${i}" class="lynsug ${act ? 'act' : ''}" style="--kc:${k.warna}"><span><span class="lynic">${L.ikon}</span> <b>${esc(L.nama)}${x.ket ? ' · ' + esc(x.ket) : ''}${x.nominal ? ' ' + rp(x.nominal) : ''}</b><br><span class="muted" style="font-size:13px">Menu ${namaAplikasi(L.kas)}, uangnya masuk laci ${esc(k.nama)}</span></span><span class="right">${kasPill(L.kas, namaAplikasi(L.kas))}</span></div>`;
}
/** Tombol menu: layanan biasa atau tombol yang membuka pilihan (Listrik → Token / Tagihan) */
function tombolMenu(x) {
  if (typeof x !== 'string') return { ...x, kas: LAYANAN[x.sub[0]].kas };
  const L = LAYANAN[x];
  return { id: x, jenis: x, nama: L.nama, ikon: L.ikon, kas: L.kas };
}
function cocokCariLayanan(L, q) {
  const n = (L.nama + ' ' + (L.cart || '') + ' ' + (L.pilihan || []).join(' ')).toLowerCase();
  return q.split(/\s+/).every(w => n.includes(w) || (L.kata || []).some(k => k.startsWith(w)));
}

/** Jendela layanan, tampilannya mengikuti menu aplikasi PojokBayar & BRILink Mobile.
 * jenis kosong = pilih menu dulu. awal = { ket, nominal } dari ketikan / suara.
 * idx = baris keranjang yang sedang diubah. tabAwal = 'warung' (PojokBayar) / 'brilink'. */
function layananDialog(jenis, awal = {}, idx, tabAwal) {
  if (!layananAktif().length) return toast('Layanan belum diaktifkan di Pengaturan → Uang & Layanan', true);
  const lama = idx !== undefined ? cart.items[idx] : null;
  const menus = MENU_LAYANAN.filter(g => kasAktif().some(k => k.id === g.kas));
  let tab = tabAwal || S._lyTab || 'warung';
  if (!menus.some(g => g.kas === tab)) tab = menus[0].kas;
  const m = modal('<div id="lyBox"></div>', { wide: true, onClose: focusScan });
  const box = $('#lyBox', m);
  const tutupBtn = () => $$('[data-x]', box).forEach(b => (b.onclick = () => m.close()));
  const tileHTML = t =>
    `<button class="lytile" data-t="${t.id}" style="--kc:${infoKas(t.kas).warna}"><span>${t.ikon}</span>${esc(t.nama)}${t.sub ? ' ›' : ''}</button>`;
  const semuaTombol = {};
  menus.forEach(g =>
    g.bagian.forEach(b => b.isi.forEach(x => (semuaTombol[tombolMenu(x).id] = tombolMenu(x))))
  );
  const bukaTombol = id => {
    const t = semuaTombol[id] || (LAYANAN[id] && tombolMenu(id));
    if (!t) return;
    if (t.sub) pilihSub(t);
    else isiForm(t.jenis, {});
  };
  const pilihJenis = () => {
    S._lyTab = tab;
    box.innerHTML = `<h3>📲 Catat PojokBayar &amp; BRILink</h3>
      <p class="muted" style="margin-top:0">Kerjakan transaksinya di aplikasi seperti biasa, lalu pilih menu yang sama di sini. Uangnya otomatis masuk ke laci yang benar.</p>
      ${menus.length > 1 ? `<div class="lytabs">${menus.map(g => `<button data-tab="${g.kas}" class="${g.kas === tab ? 'on' : ''}" style="--kc:${infoKas(g.kas).warna}">${g.ikon} ${g.judul}<small>uang ${esc(infoKas(g.kas).nama)}</small></button>`).join('')}</div>` : ''}
      <input id="lyCari" placeholder="🔍 Cari menu… (contoh: pln, bpjs, tarik, dana)" autocomplete="off">
      <div id="lyMenu"></div>
      <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-x>Tutup (Esc)</button></div>`;
    tutupBtn();
    const drawMenu = () => {
      const q = $('#lyCari', box).value.trim().toLowerCase();
      let html;
      if (q) {
        const hits = layananAktif().filter(j => cocokCariLayanan(LAYANAN[j], q));
        html = hits.length
          ? `<div class="lygrid">${hits.map(j => tileHTML({ ...tombolMenu(j), nama: LAYANAN[j].nama + (menus.length > 1 ? ' · ' + namaAplikasi(LAYANAN[j].kas) : '') })).join('')}</div>`
          : '<div class="empty">Menu tidak ketemu.</div>';
      } else {
        const g = menus.find(x => x.kas === tab);
        html = g.bagian
          .map(
            b =>
              `${b.judul ? `<h3 class="lyhead">${esc(b.judul)}</h3>` : ''}<div class="lygrid">${b.isi.map(x => tileHTML(tombolMenu(x))).join('')}</div>`
          )
          .join('');
      }
      $('#lyMenu', box).innerHTML = html;
      $$('[data-t]', box).forEach(b => (b.onclick = () => bukaTombol(b.dataset.t)));
    };
    $$('[data-tab]', box).forEach(
      b =>
        (b.onclick = () => {
          tab = b.dataset.tab;
          pilihJenis();
        })
    );
    $('#lyCari', box).oninput = drawMenu;
    $('#lyCari', box).onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const t = $('[data-t]', box);
        t && t.click();
      }
    };
    drawMenu();
    setTimeout(() => {
      const f = $('[data-t]', box);
      f && f.focus();
    }, 30);
  };
  const pilihSub = t => {
    box.innerHTML = `<h3>${t.ikon} ${esc(t.nama)} <span class="muted" style="font-size:15px">· ${namaAplikasi(t.kas)}</span></h3>
      <div class="lysub">${t.sub
        .map(
          j =>
            `<button class="lytile besar" data-j="${j}" style="--kc:${infoKas(t.kas).warna}"><span>${LAYANAN[j].ikon}</span>${esc(LAYANAN[j].nama)}<small>${esc(LAYANAN[j].ket || '')}</small></button>`
        )
        .join('')}</div>
      <div class="row actbar"><button class="btn ghost" id="lyBack">← Menu</button><span class="grow"></span><button class="btn ghost" data-x>Batal</button></div>`;
    tutupBtn();
    $('#lyBack', box).onclick = pilihJenis;
    $$('[data-j]', box).forEach(b => (b.onclick = () => isiForm(b.dataset.j, {})));
    setTimeout(() => $('[data-j]', box).focus(), 30);
  };
  const isiForm = (j, a) => {
    const L = LAYANAN[j];
    const tr = tarifLayanan(j);
    const bri = L.kas === 'brilink';
    const d0 = lama && lama.layanan === j ? { ...lama.lyn } : {};
    const v = {
      ket: a.ket || d0.ket || (L.pilihan ? L.pilihan[0] : ''),
      tujuan: d0.tujuan || '',
      nominal: a.nominal || d0.nominal || 0,
      admin: d0.admin ?? tr.admin,
      biaya: d0.biaya ?? tr.biaya,
      modal: d0.modal ?? 0,
      jual: d0.jual ?? 0,
      paket: d0.paket || '',
      token: d0.token || '',
      arah: d0.arah || (L.arah === 'pilih' ? 'keluar' : L.arah)
    };
    const jasa = L.form === 'jasa';
    const pakaiNominal = !jasa && (L.form !== 'paket' || bri);
    const labelNom = () => labelNominal(L, bri ? arahLayanan(L, v.arah) : 'masuk');
    box.innerHTML = `<h3>${L.ikon} ${esc(L.nama)} <span class="muted" style="font-size:15px">· ${namaAplikasi(L.kas)}</span> ${kasPill(L.kas)}</h3>
     ${L.arah === 'pilih' ? `<label>Arah uang</label><div class="chips"><button type="button" class="chip ${v.arah === 'keluar' ? 'on' : ''}" data-arah="keluar">💵 Uang diberikan ke pelanggan (pencairan)</button><button type="button" class="chip ${v.arah === 'masuk' ? 'on' : ''}" data-arah="masuk">💰 Pelanggan membayar</button></div>` : ''}
     ${L.pilihan ? `<label>Pilih</label><div class="chips" id="lyKet">${L.pilihan.map(p => `<button type="button" class="chip ${p === v.ket ? 'on' : ''}" data-k="${esc(p)}">${esc(p)}</button>`).join('')}</div>` : ''}
     <label>${esc(L.tujuan || 'Nomor tujuan')}</label><input id="lyTuj" data-bukanuang value="${esc(v.tujuan)}" autocomplete="off" ${/HP|meter|ID|nomor|No\./i.test(L.tujuan || '') && !/nama|bank|rekening/i.test(L.tujuan || '') ? 'inputmode="numeric"' : ''}>
     ${L.form === 'paket' && !bri ? `<label>Nama paket / produk <span class="muted">(contoh: ${esc(L.contohPaket || 'nama paket')})</span></label><input id="lyPkt" value="${esc(v.paket)}" autocomplete="off">` : ''}
     ${pakaiNominal ? `<label id="lyNomLbl">${esc(labelNom())}</label><input id="lyNom" class="bignum" inputmode="numeric" value="${v.nominal ? rp(v.nominal) : ''}" autocomplete="off">${L.form === 'nominal' && L.nominal ? `<div class="chips">${L.nominal.map(n => `<button type="button" class="chip" data-n="${n}">${rp(n)}</button>`).join('')}</div>` : ''}` : ''}
     ${
       bri
         ? `<div class="grid2"><div><label>${jasa ? 'Biaya jasa (untung toko)' : 'Biaya admin (untung toko)'}</label><input id="lyAdm" inputmode="numeric" value="${rp(v.admin)}"></div><div><label>Potongan dari bank (kalau ada)</label><input id="lyBia" inputmode="numeric" value="${v.biaya ? rp(v.biaya) : ''}" placeholder="0"></div></div>`
         : `<div class="grid2"><div><label>Harga modal (saldo PojokBayar yang terpotong)</label><input id="lyMod" inputmode="numeric" value="${v.modal ? rp(v.modal) : ''}"></div><div><label>Harga jual ke pembeli</label><input id="lyJual" class="bignum" inputmode="numeric" value="${v.jual ? rp(v.jual) : ''}"></div></div>`
     }
     <div class="lyinfo" id="lyInfo"></div>
     ${L.token ? `<label>Nomor token (boleh diisi setelah token keluar, ikut dicetak di struk)</label><input id="lyTok" data-bukanuang value="${esc(v.token)}" inputmode="numeric" autocomplete="off">` : ''}
     <div class="row actbar">${lama ? '' : '<button class="btn ghost" id="lyBack">← Menu</button>'}<span class="grow"></span><button class="btn ghost" data-x>Batal</button><button class="btn pri" id="lyOk">${lama ? '💾 Simpan perubahan' : '➕ Masukkan ke keranjang'} (Enter)</button></div>`;
    tutupBtn();
    $('#lyBack', box) &&
      ($('#lyBack', box).onclick = () => {
        tab = L.kas;
        pilihJenis();
      });
    const f = id => $(id, box);
    let modalManual = !!lama,
      jualManual = !!lama;
    const hitung = () => {
      const N = f('#lyNom') ? num(f('#lyNom').value) : 0;
      $$('[data-n]', box).forEach(x => x.classList.toggle('on', +x.dataset.n === N));
      if (!bri) {
        if (!modalManual && f('#lyMod')) f('#lyMod').value = N ? rp(N + tr.biaya) : '';
        const M = num(f('#lyMod').value);
        if (!jualManual) f('#lyJual').value = N ? rp(N + tr.admin) : M ? rp(M + tr.admin) : '';
        const J = num(f('#lyJual').value);
        const u = J - M;
        f('#lyInfo').innerHTML =
          J && M
            ? `Pembeli bayar <b class="lybig">Rp ${rp(J)}</b> · untung <b style="color:${u > 0 ? 'var(--ok)' : 'var(--bad)'}">Rp ${rp(u)}</b>`
            : `<span class="muted">${L.form === 'paket' ? 'Isi harga modal dari PojokBayar' : 'Isi nominal / harga'}</span>`;
        return;
      }
      const A = num(f('#lyAdm').value),
        B = num(f('#lyBia').value);
      const arah = arahLayanan(L, v.arah);
      if (f('#lyNomLbl')) f('#lyNomLbl').textContent = labelNom();
      f('#lyInfo').innerHTML =
        arah === 'jasa'
          ? A
            ? `Pelanggan membayar biaya jasa <b class="lybig">Rp ${rp(A)}</b> · untung Rp ${rp(A - B)}`
            : '<span class="muted">Kalau gratis, tidak perlu dicatat.</span>'
          : !N
            ? `<span class="muted">Isi ${esc(labelNom().toLowerCase())}</span>`
            : arah === 'keluar'
              ? `Berikan ke pelanggan <b class="lybig">Rp ${rp(N - A)}</b> <span class="muted">(${rp(N)}${A ? ' dipotong admin ' + rp(A) : ''})</span>${A ? `<br><span class="muted" style="font-size:13px">Kalau admin dibayar terpisah: berikan Rp ${rp(N)}, terima admin Rp ${rp(A)}. Untung Rp ${rp(A - B)}.</span>` : ''}`
              : `Pelanggan membayar <b class="lybig">Rp ${rp(N + A)}</b> <span class="muted">(${rp(N)}${A ? ' + admin ' + rp(A) : ''})${A ? ' · untung Rp ' + rp(A - B) : ''}</span>`;
    };
    $$('[data-k]', box).forEach(
      b =>
        (b.onclick = () => {
          v.ket = b.dataset.k;
          $$('[data-k]', box).forEach(x => x.classList.toggle('on', x === b));
          (f('#lyTuj').value ? f('#lyNom') || f('#lyPkt') || f('#lyAdm') : f('#lyTuj')).focus();
        })
    );
    $$('[data-arah]', box).forEach(
      b =>
        (b.onclick = () => {
          v.arah = b.dataset.arah;
          $$('[data-arah]', box).forEach(x => x.classList.toggle('on', x === b));
          hitung();
        })
    );
    $$('[data-n]', box).forEach(
      b =>
        (b.onclick = () => {
          f('#lyNom').value = rp(b.dataset.n);
          hitung();
          (f('#lyTuj').value || arahLayanan(L, v.arah) === 'keluar' ? f('#lyOk') : f('#lyTuj')).focus();
        })
    );
    f('#lyNom') && (f('#lyNom').oninput = hitung);
    f('#lyMod') &&
      (f('#lyMod').oninput = () => {
        modalManual = true;
        hitung();
      });
    f('#lyJual') &&
      (f('#lyJual').oninput = () => {
        jualManual = true;
        hitung();
      });
    f('#lyAdm') && (f('#lyAdm').oninput = hitung);
    f('#lyBia') && (f('#lyBia').oninput = hitung);
    $$('input', box).forEach(i => (i.onfocus = () => i.select && i.select()));
    hitung();
    const ok = () => {
      const N = f('#lyNom') ? num(f('#lyNom').value) : 0;
      if (pakaiNominal && !(N > 0)) {
        toast(labelNom() + ' belum diisi', true);
        return f('#lyNom').focus();
      }
      const d = {
        nominal: N,
        tujuan: f('#lyTuj').value,
        ket: L.pilihan ? v.ket : '',
        paket: f('#lyPkt') ? f('#lyPkt').value : '',
        token: f('#lyTok') ? f('#lyTok').value : '',
        arah: v.arah
      };
      if (bri) {
        d.admin = num(f('#lyAdm').value);
        d.biaya = num(f('#lyBia').value);
        const arah = arahLayanan(L, v.arah);
        if (arah === 'keluar' && d.admin >= N) return toast('Admin lebih besar dari uang yang ditarik', true);
        if (arah === 'jasa' && !(d.admin > 0)) return toast('Biaya jasanya Rp 0, tidak perlu dicatat', true);
      } else {
        d.modal = num(f('#lyMod').value);
        d.jual = num(f('#lyJual').value);
        if (L.form === 'paket' && !d.modal) {
          toast('Isi harga modal dari PojokBayar', true);
          return f('#lyMod').focus();
        }
        if (!(d.jual > 0)) {
          toast('Harga jual belum diisi', true);
          return f('#lyJual').focus();
        }
      }
      const it = barisLayanan(j, d, lama);
      let pos;
      if (lama) {
        pos = cart.items.indexOf(lama);
        if (pos < 0) pos = cart.items.push(it) - 1;
        else cart.items[pos] = it;
      } else pos = cart.items.push(it) - 1;
      S._lyTab = L.kas;
      m.close();
      beep(true);
      drawCart(null, pos);
      toast(it.nama + (lama ? ' diubah' : ' masuk keranjang'));
    };
    f('#lyOk').onclick = ok;
    box.onkeydown = e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        ok();
      }
    };
    setTimeout(() => {
      // tarik tunai: nama pelanggan boleh kosong, jadi langsung ke nominal
      const keluar = bri && arahLayanan(L, v.arah) === 'keluar';
      const first = jasa
        ? f('#lyAdm')
        : keluar
          ? v.nominal
            ? f('#lyOk')
            : f('#lyNom')
          : !v.tujuan
            ? f('#lyTuj')
            : pakaiNominal && !v.nominal
              ? f('#lyNom')
              : f('#lyOk');
      first && first.focus();
    }, 30);
  };
  if (jenis && LAYANAN[jenis]) isiForm(jenis, awal);
  else pilihJenis();
}
/** Baris layanan di tabel keranjang */
function barisLayananHTML(it, i, cls) {
  const L = LAYANAN[it.layanan] || { ikon: '🧾' };
  const k = kasBaris(it);
  const neg = it.harga < 0;
  const det = detailLayanan(it);
  const tok = it.lyn && it.lyn.token ? `<div class="lyndet"><b>Token:</b> ${esc(it.lyn.token)}</div>` : '';
  return `<tr class="${cls} lynrow" style="--kc:${infoKas(k).warna}">
    <td><span class="lynic">${L.ikon}</span> <b>${esc(it.nama)}</b> ${kasPill(k)}${det ? `<div class="lyndet">${esc(det)}</div>` : ''}${tok}</td>
    <td class="num"><div class="pricecell"><span class="lynharga ${neg ? 'neg' : ''}">${neg ? '−' : ''}${rp(Math.abs(it.harga))}</span><button class="pedit" data-le="${i}" type="button" title="Ubah layanan ini">✏️</button></div></td>
    <td class="muted" style="text-align:center">${neg ? 'diberikan' : '1×'}</td>
    <td class="num"><b class="${neg ? 'negtxt' : ''}">${neg ? '−' : ''}${rp(Math.abs(it.harga * it.qty))}</b></td>
    <td><button class="btn sm bad" data-d="${i}">✕</button></td></tr>`;
}
/** Pembagian uang keranjang ke tiap laci (memakai aturan yang sama dengan transaksi tersimpan) */
function rincianKeranjang(metode = 'tunai', bayar) {
  const t = cartTotal();
  return rincianSale({
    items: cart.items,
    diskon: t.diskon,
    potonganPoin: t.potPoin,
    total: t.total,
    metode,
    bayar: bayar ?? t.total
  });
}
/** Petunjuk pembagian uang ke laci, untuk jendela bayar & struk */
function pembagianHTML(R, besar) {
  const ks = KAS.map(k => k.id).filter(k => R.kas[k] && Math.round(R.kas[k].tunai));
  if (!ks.length) return '';
  return `<div class="bagi ${besar ? 'besar' : ''}"><div class="bagih">💡 Pembagian uang ke laci</div>${ks
    .map(k => {
      const v = R.kas[k].tunai;
      return `<div class="bagir" style="--kc:${infoKas(k).warna}"><span>${v >= 0 ? 'Masukkan ke' : 'Ambil dari'} laci <b>${esc(infoKas(k).nama)}</b></span><b>Rp ${rp(Math.abs(v))}</b></div>`;
    })
    .join('')}</div>`;
}
