/* ============ HALAMAN PESAN PELANGGAN ============
 * Pelanggan membuka halaman ini di HP, menulis daftar belanja atau memilih barang, lalu mengirim
 * pesanan lewat WhatsApp. Dibuat supaya mudah untuk pembeli yang sudah sepuh:
 *  - harga Warung langsung terpilih (yang paling sering pesan lewat WA adalah warung)
 *  - kotak "Tulis daftar belanja" ada paling atas, di atas barang yang sering dibeli
 *  - tulisan & tombol besar, satuan ditulis kata (renceng, bungkus), tidak ada kotak isian bawaan browser
 *  - pesan WhatsApp rapi tanpa tanda-tanda aneh, satu barang satu baris: "2 renceng - NAMA BARANG"
 *    (baris ini juga yang dibaca kasir saat pesan ditempel di 📥 Pesanan)
 *
 * Sumber daftar barang: window.KATALOG_EMBED (file mandiri) atau katalog.json di folder yang sama.
 */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = s =>
    String(s ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const rp = n => Math.round(Number(n) || 0).toLocaleString('id-ID');
  const fq = BacaDaftar.fmtQty;
  const sat = u => BacaDaftar.namaSatuan(u);
  const root = document.getElementById('app');
  // logo toko = ikon tab (disisipkan saat build)
  const LOGO = ((document.querySelector('link[rel=icon]') || {}).href || '').startsWith('data:')
    ? document.querySelector('link[rel=icon]').href
    : '';
  const UNIT_SAMA = {
    PACK: ['PAK', 'PCK', 'PACK KECIL'],
    PAK: ['PACK', 'PCK', 'PACK KECIL'],
    DUS: ['KTN', 'BOX'],
    KTN: ['DUS', 'BOX'],
    BOX: ['DUS', 'KTN'],
    BKS: ['PCS'],
    SLOP: ['SLP'],
    SLP: ['SLOP'],
    LITER: ['LTR']
  };
  const IKON_HARGA = { umum: '👤', warung: '🏪' };
  const KET_HARGA = { umum: 'untuk dipakai sendiri', warung: 'untuk dijual lagi' };

  /* ---------- muat katalog ---------- */
  async function muatKatalog() {
    if (window.KATALOG_EMBED) return window.KATALOG_EMBED;
    try {
      const r = await fetch('katalog.json?t=' + Date.now(), { cache: 'no-store' });
      if (r.ok) {
        const k = await r.json();
        try {
          localStorage.setItem('pesan_katalog', JSON.stringify(k));
        } catch (e) {}
        return k;
      }
    } catch (e) {}
    try {
      return JSON.parse(localStorage.getItem('pesan_katalog') || 'null');
    } catch (e) {
      return null;
    }
  }
  function gagal(K) {
    const wa = K && K.toko && K.toko.wa;
    root.innerHTML = `<div class="gagal"><b>Daftar barang belum tersedia.</b><br>Silakan coba lagi nanti${wa ? `, atau langsung kirim pesanan lewat WhatsApp.<br><br><a class="btn wa" href="https://wa.me/${esc(wa)}">📲 Chat WhatsApp toko</a>` : '.'}</div>`;
  }

  /* ---------- aplikasi ---------- */
  function mulai(K) {
    const toko = K.toko || {};
    const TIERS = K.harga || [];
    const P = K.p.map(p => ({ ...p, kat: (K.kat || [])[p.k] || '' }));
    const byId = new Map(P.map(p => [p.i, p]));
    const idx = CariProduk.indeks(P, p => ({
      nama: p.n,
      alias: p.a,
      kategori: p.kat,
      populer: p.s,
      prioritas: p.f,
      prioritasEkstra: p.fx
    }));
    const angkaDiNama = BacaDaftar.pembantuAngka(idx, p => p.n);
    const populer = P.filter(p => p.s)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40);
    const DEF =
      (TIERS.some(t => t.id === K.hd) && K.hd) ||
      (TIERS.some(t => t.id === 'warung') && 'warung') ||
      (TIERS[0] ? TIERS[0].id : '');
    // harga warung tampil paling depan
    const TIERS_TAMPIL = TIERS.slice().sort((a, b) => (b.id === DEF) - (a.id === DEF));
    const KEY = 'pesan_v2_' + (toko.nama || '');
    let st = { tier: '', tierPilih: false, nama: '', hp: '', cat: '', ambil: 'ambil', items: [] };
    try {
      const x = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (x && Array.isArray(x.items)) st = Object.assign(st, x);
    } catch (e) {}
    const hParam = new URLSearchParams(location.search).get('h');
    if (hParam && TIERS.some(t => t.id === hParam)) st.tier = hParam;
    // pilihan harga hanya diingat kalau pembeli sendiri yang menekan tombolnya
    else if (!st.tierPilih || !TIERS.some(t => t.id === st.tier)) st.tier = DEF;
    st.items = st.items.filter(i => !i.i || byId.has(i.i));
    const view = { mode: 'awal', kat: 0, batas: 40, tulis: '' };
    let cocokan = [];

    const simpan = () => {
      try {
        localStorage.setItem(KEY, JSON.stringify(st));
      } catch (e) {}
    };
    const tIdx = () =>
      Math.max(
        0,
        TIERS.findIndex(t => t.id === st.tier)
      );
    const hargaUnit = (p, unit) => {
      if (!TIERS.length || !p) return 0;
      const u = p.u.find(x => x[0] === unit) || p.u[0];
      return Number(u[1 + tIdx()]) || Number(u[1]) || 0;
    };
    const itemOf = (i, u) => st.items.find(x => x.i === i && x.u === u);
    const total = () => st.items.reduce((t, x) => t + hargaUnit(byId.get(x.i), x.u) * x.q, 0);
    const tierNama = () => (TIERS[tIdx()] || {}).nama || '';

    /* ---------- kerangka ---------- */
    root.innerHTML = `<header class="hd"><div class="wrap">
      <div class="hd-nama">${LOGO ? `<img class="hd-logo" src="${LOGO}" alt="">` : '🛒 '}<span>${esc(toko.nama || 'Pesan Online')}</span></div>${toko.alamat ? `<div class="hd-sub">${esc(toko.alamat)}</div>` : ''}
      <div class="hd-cara"><div><span>1</span>Tulis / pilih barang</div><div><span>2</span>Tekan tombol hijau</div><div><span>3</span>Kirim di WhatsApp</div></div>
      ${
        TIERS.length > 1
          ? `<div class="seg" role="group" aria-label="Pilih harga">${TIERS_TAMPIL.map(t => `<button type="button" data-tier="${esc(t.id)}"><b>${IKON_HARGA[t.id] || '🏷️'} ${esc(t.nama)}</b><small>${KET_HARGA[t.id] ? 'harga ' + KET_HARGA[t.id] : 'harga ' + esc(t.nama.toLowerCase())}</small></button>`).join('')}</div>`
          : ''
      }</div></header>
      <div class="cariwrap"><div class="wrap">
        <div class="cari"><span class="ic">🔍</span><input id="q" type="search" placeholder="Ketik nama barang…" autocomplete="off" enterkeyhint="search"><button class="x" id="qx" type="button" hidden aria-label="Hapus pencarian">✕</button></div>
        <div class="chips" id="chips"></div></div></div>
      <main class="wrap list" id="list"></main>
      <div class="bar"><button id="barBtn" type="button"><span id="barTxt"></span><b>Lanjut kirim ➜</b></button></div>
      <section class="sheet" id="sheet" hidden></section><div id="dlg"></div><div id="toast" role="status"></div>`;

    let tt;
    function toast(m, bad) {
      const t = $('#toast');
      t.textContent = m;
      t.className = 'on' + (bad ? ' bad' : '');
      clearTimeout(tt);
      tt = setTimeout(() => (t.className = ''), 2200);
    }

    /* ---------- jendela kecil (pengganti prompt / confirm bawaan browser) ---------- */
    function dialog(html) {
      const d = $('#dlg');
      d.innerHTML = `<div class="dlg-bg"><div class="dlg" role="dialog">${html}</div></div>`;
      document.body.classList.add('kunci');
      const tutup = () => {
        d.innerHTML = '';
        document.body.classList.remove('kunci');
      };
      $('.dlg-bg', d).addEventListener('click', e => {
        if (e.target.classList.contains('dlg-bg')) tutup();
      });
      return { el: $('.dlg', d), tutup };
    }
    function tanya(pesan, ya) {
      return new Promise(res => {
        const g = dialog(
          `<p class="dlg-p">${pesan}</p><div class="dlg-b"><button class="btn lite" type="button" data-t>Tidak</button><button class="btn merah" type="button" data-y>${esc(ya)}</button></div>`
        );
        $('[data-t]', g.el).onclick = () => {
          g.tutup();
          res(false);
        };
        $('[data-y]', g.el).onclick = () => {
          g.tutup();
          res(true);
        };
      });
    }
    /** ubah jumlah dengan tombol besar. cb(jumlahBaru) dipanggil saat Simpan, cb(0) saat Hapus */
    function dialogJumlah(nama, unit, nilai, cb) {
      const g = dialog(
        `<h3>${esc(nama)}</h3><p class="dlg-p">Jumlah${unit ? ' (' + esc(sat(unit)) + ')' : ''}:</p>
        <div class="dlg-q"><button type="button" data-m aria-label="kurangi">−</button><input id="dq" inputmode="decimal" value="${fq(nilai)}" aria-label="jumlah"><button type="button" data-p aria-label="tambah">+</button></div>
        <div class="dlg-b"><button class="btn lite" type="button" data-batal>Batal</button><button class="btn wa" type="button" data-ok>✔ Simpan</button></div>
        <button class="btn hapus" type="button" data-hapus>🗑️ Hapus dari pesanan</button>`
      );
      const inp = $('#dq', g.el);
      const baca = () => BacaDaftar.angka(inp.value) || 0;
      $('[data-m]', g.el).onclick = () => (inp.value = fq(Math.max(0, baca() > 1 ? baca() - 1 : baca() / 2)));
      $('[data-p]', g.el).onclick = () => (inp.value = fq(baca() + 1));
      $('[data-batal]', g.el).onclick = g.tutup;
      $('[data-ok]', g.el).onclick = () => {
        g.tutup();
        cb(baca());
      };
      $('[data-hapus]', g.el).onclick = () => {
        g.tutup();
        cb(0);
      };
      inp.addEventListener('keydown', e => e.key === 'Enter' && $('[data-ok]', g.el).click());
    }

    /* ---------- pilihan harga ---------- */
    function drawTier() {
      $$('[data-tier]').forEach(b => {
        b.classList.toggle('on', b.dataset.tier === st.tier);
        b.setAttribute('aria-pressed', b.dataset.tier === st.tier);
      });
    }
    $$('[data-tier]').forEach(
      b =>
        (b.onclick = () => {
          st.tier = b.dataset.tier;
          st.tierPilih = true;
          simpan();
          drawTier();
          drawList();
          drawBar();
          toast('Harga ' + tierNama() + ' dipakai');
        })
    );

    /* ---------- kategori / chip ---------- */
    function drawChips() {
      const c = [`<button type="button" data-mode="awal">🏠 Awal</button>`];
      (K.kat || []).forEach((k, i) => {
        const ikon = (K.ki || [])[i];
        if (P.some(p => p.k === i))
          c.push(`<button type="button" data-kat="${i}">${ikon ? ikon + ' ' : ''}${esc(k)}</button>`);
      });
      $('#chips').innerHTML = c.join('');
      $$('#chips button').forEach(b => {
        b.classList.toggle(
          'on',
          !$('#q').value.trim() &&
            ((b.dataset.mode && view.mode === 'awal') ||
              (view.mode === 'kat' && b.dataset.kat !== undefined && +b.dataset.kat === view.kat))
        );
        b.onclick = () => bukaKategori(b.dataset.mode ? -1 : +b.dataset.kat);
      });
    }
    function bukaKategori(k) {
      $('#q').value = '';
      $('#qx').hidden = true;
      if (k < 0) view.mode = 'awal';
      else {
        view.mode = 'kat';
        view.kat = k;
      }
      view.batas = 40;
      drawChips();
      drawList();
      scrollTo({ top: 0 });
    }

    /* ---------- daftar barang ---------- */
    function unitHTML(p, j) {
      const u = p.u[j][0];
      const it = itemOf(p.i, u);
      const h = TIERS.length ? hargaUnit(p, u) : 0;
      if (it)
        return `<div class="step" data-u="${esc(u)}"><button data-dec type="button" aria-label="kurangi">−</button><button class="sq" data-set type="button"><b>${fq(it.q)} ${esc(sat(u))}</b>${h ? `<small>Rp ${rp(h * it.q)}</small>` : ''}</button><button data-inc type="button" aria-label="tambah">+</button></div>`;
      return `<button class="add" data-add="${esc(u)}" type="button">${h ? `<span class="hrg">Rp ${rp(h)}</span>` : ''}<span class="sat">+ 1 ${esc(sat(u))}</span></button>`;
    }
    function produkHTML(p) {
      return `<div class="it" data-i="${esc(p.i)}"><div class="it-nm"><b>${esc(p.n)}</b>${p.a && p.a !== p.n ? `<small>${esc(p.a)}</small>` : ''}</div><div class="it-u">${p.u.map((u, j) => unitHTML(p, j)).join('')}</div></div>`;
    }
    function gridKategori() {
      const ks = (K.kat || []).map((k, i) => [k, i]).filter(([, i]) => P.some(p => p.k === i));
      if (!ks.length) return '';
      return `<div class="judul">📂 Cari menurut jenis barang</div><div class="katgrid">${ks.map(([k, i]) => `<button type="button" data-kat="${i}"><span>${(K.ki || [])[i] || '📦'}</span>${esc(k)}</button>`).join('')}</div>`;
    }
    function tulisHTML() {
      return `<section class="tulis" aria-label="Tulis daftar belanja">
        <h2>📝 Tulis daftar belanja</h2>
        <p>Tulis seperti di kertas. <b>Satu baris satu barang</b>, beserta jumlahnya.</p>
        <textarea id="tl" rows="4" placeholder="contoh:&#10;gula 2 kg&#10;indomie goreng 1 dus&#10;kopi kapal api 2 renceng">${esc(view.tulis)}</textarea>
        <button class="btn biru" id="tlGo" type="button">🔎 Cari barangnya</button>
        <div id="tlRes"></div></section>`;
    }
    function drawList() {
      const q = $('#q').value.trim();
      const L = $('#list');
      let arr,
        judul = '',
        atas = '',
        bawah = '';
      if (q) {
        arr = CariProduk.cari(idx, q, 40);
        judul = arr.length ? `Hasil untuk “${esc(q)}”` : '';
        bawah = `<div class="free">${arr.length ? 'Barang yang dicari tidak ada di atas?' : `Barang “${esc(q)}” belum ada di daftar.`} Tetap bisa dipesan, nanti dicarikan.<button data-free type="button">+ Pesan “${esc(q)}”</button></div>`;
      } else if (view.mode === 'awal') {
        atas = tulisHTML();
        arr = populer;
        judul = populer.length ? '⭐ Atau pilih dari barang yang sering dibeli' : '';
        bawah = gridKategori();
      } else {
        arr = P.filter(p => p.k === view.kat);
        judul = `${(K.ki || [])[view.kat] || ''} ${esc((K.kat || [])[view.kat] || '')}`;
      }
      const shown = q || view.mode === 'awal' ? arr : arr.slice(0, view.batas);
      L.innerHTML =
        atas +
        (judul ? `<div class="judul">${judul}</div>` : '') +
        shown.map(produkHTML).join('') +
        (arr.length > shown.length
          ? `<button class="more" id="more" type="button">Tampilkan lebih banyak (${arr.length - shown.length} lagi)</button>`
          : '') +
        (!q && view.mode === 'kat' && !arr.length
          ? '<div class="kosong">Belum ada barang di sini.</div>'
          : '') +
        bawah;
      const more = $('#more');
      if (more)
        more.onclick = () => {
          view.batas += 40;
          drawList();
        };
      if (atas) pasangTulis();
    }
    function ubahQty(i, u, delta, nama) {
      let it = itemOf(i, u);
      if (!it) {
        it = { i, u, q: 0, n: nama };
        st.items.push(it);
      }
      it.q = Math.round((it.q + delta) * 100) / 100;
      if (it.q <= 0) st.items = st.items.filter(x => x !== it);
      simpan();
      drawBar();
    }
    $('#list').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.closest('.katgrid')) return bukaKategori(+b.dataset.kat);
      if (b.hasAttribute('data-free')) {
        const q = $('#q').value.trim();
        if (!q) return;
        const ex = st.items.find(x => !x.i && x.n.toLowerCase() === q.toLowerCase());
        if (ex) ex.q += 1;
        else st.items.push({ i: '', u: '', q: 1, n: q });
        simpan();
        drawBar();
        toast('✔ ' + q + ' masuk ke pesanan');
        $('#q').value = '';
        $('#qx').hidden = true;
        drawChips();
        drawList();
        return;
      }
      const row = b.closest('[data-i]');
      if (!row) return;
      const p = byId.get(row.dataset.i);
      if (!p) return;
      const stepEl = b.closest('[data-u]');
      const u = b.dataset.add || (stepEl && stepEl.dataset.u);
      const gambarUlang = () =>
        (row.querySelector('.it-u').innerHTML = p.u.map((x, j) => unitHTML(p, j)).join(''));
      if (b.hasAttribute('data-add')) {
        ubahQty(p.i, u, 1, p.n);
        toast('✔ 1 ' + sat(u) + ' ' + p.n);
      } else if (b.hasAttribute('data-inc')) ubahQty(p.i, u, 1, p.n);
      else if (b.hasAttribute('data-dec')) ubahQty(p.i, u, -1, p.n);
      else if (b.hasAttribute('data-set')) {
        const it = itemOf(p.i, u);
        return dialogJumlah(p.n, u, it ? it.q : 1, n => {
          ubahQty(p.i, u, n - (it ? it.q : 0), p.n);
          gambarUlang();
        });
      }
      gambarUlang();
    });

    /* ---------- pencarian ---------- */
    let ct;
    $('#q').addEventListener('input', () => {
      $('#qx').hidden = !$('#q').value;
      clearTimeout(ct);
      ct = setTimeout(() => {
        drawChips();
        drawList();
      }, 150);
    });
    $('#q').addEventListener('keydown', e => {
      if (e.key === 'Enter') $('#q').blur();
    });
    $('#qx').onclick = () => {
      $('#q').value = '';
      $('#qx').hidden = true;
      drawChips();
      drawList();
      $('#q').focus();
    };

    /* ---------- tulis daftar sekaligus ---------- */
    function pilihUnit(p, unit) {
      const names = p.u.map(u => u[0]);
      if (unit) {
        if (names.includes(unit)) return unit;
        for (const a of UNIT_SAMA[unit] || []) if (names.includes(a)) return a;
      }
      return names[0];
    }
    const punyaUnit = (p, unit) => p.u.some(u => u[0] === unit || (UNIT_SAMA[unit] || []).includes(u[0]));
    function cocokkan(b) {
      const T = b.teks.toUpperCase().replace(/\s+/g, ' ');
      const persis = P.find(p => p.n === T || (p.a && p.a.toUpperCase() === T));
      let r = persis
        ? [{ item: persis, skor: 99, cocok: 99 }]
        : CariProduk.cariSkor(idx, (b.kata ? b.kata + ' ' : '') + b.teks, 6);
      if (b.unit && !persis)
        r = r
          .map(h => {
            const uk = BacaDaftar.ukuran(h.item.n, b.qty, b.unit);
            return { ...h, uk, skor: h.skor + (punyaUnit(h.item, b.unit) ? 4 : 0) + (uk === 2 ? 6 : uk * 3) };
          })
          .sort((x, y) => y.skor - x.skor);
      // yakin hanya kalau katanya memang mirip (bukan sekadar barang laris)
      const p = r.length && r[0].skor >= 8 && r[0].cocok >= 7 ? r[0].item : null;
      const c = {
        ...b,
        hasil: r.slice(0, 4).map(h => h.item),
        pilih: p ? p.i : '',
        unitSel: p ? pilihUnit(p, b.unit) : '',
        ragu: !!p && r.length > 1 && r[0].skor - r[1].skor < 3,
        satuanHilang: ''
      };
      if (p && r[0].uk === 2) {
        // "telur 1/2 kg" -> TELUR AYAM 1/2 KG sebanyak 1
        c.qty = 1;
        c.unitSel = p.u[0][0];
      } else if (p && b.unit && !persis && !punyaUnit(p, b.unit)) {
        c.satuanHilang = b.kata || sat(b.unit);
        c.ragu = true;
      }
      return c;
    }
    function pasangTulis() {
      $('#tl').oninput = e => (view.tulis = e.target.value);
      $('#tlGo').onclick = () => {
        const d = BacaDaftar.baca(view.tulis, { angkaDiNama });
        cocokan = d.baris.map(cocokkan);
        if (!cocokan.length) {
          toast('Tulis dulu barangnya, satu baris satu barang', true);
          $('#tl').focus();
          return;
        }
        drawCocok();
        $('#tlRes').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      if (cocokan.length) drawCocok();
    }
    function drawCocok() {
      const box = $('#tlRes');
      if (!box) return;
      if (!cocokan.length) {
        box.innerHTML = '';
        return;
      }
      const ketemu = cocokan.filter(c => c.pilih).length;
      box.innerHTML =
        `<div class="ringkas">Ketemu <b>${ketemu}</b> dari <b>${cocokan.length}</b> barang.${ketemu < cocokan.length || cocokan.some(c => c.ragu) ? ' Cek yang berwarna <span class="t-oranye">oranye</span> atau <span class="t-merah">merah</span>.' : ''}</div>` +
        cocokan
          .map((c, k) => {
            const p = byId.get(c.pilih);
            const h = p && TIERS.length ? hargaUnit(p, c.unitSel) : 0;
            const ditulis = [fq(c.qty), c.kata, c.teks].filter(Boolean).join(' ');
            return `<div class="cocok ${p ? (c.ragu ? 'ragu' : 'pas') : 'tidak'}" data-k="${k}">
            <div class="asli">Anda tulis: <b>${esc(ditulis)}</b></div>
            <div class="pilih">${p ? (c.ragu ? '❓ ' : '✔ ') + esc(p.n) : '❔ Belum ketemu di daftar'}</div>
            ${c.satuanHilang ? `<div class="saran">Satuan “${esc(c.satuanHilang)}” tidak ada untuk barang ini, jadi dihitung per ${esc(sat(c.unitSel))}. Ubah jumlahnya kalau perlu.</div>` : c.ragu ? '<div class="saran">Mungkin maksudnya yang lain? Ketuk yang benar di bawah.</div>' : !p ? `<div class="saran">${c.hasil.length ? 'Ketuk barang yang benar di bawah, atau biarkan dipesan apa adanya (nanti dicarikan toko).' : 'Tetap dipesan apa adanya, nanti dicarikan toko.'}</div>` : ''}
            <div class="cq"><div class="step kecil"><button type="button" data-cm aria-label="kurangi">−</button><button type="button" class="sq" data-cs><b>${fq(c.qty)}${p ? ' ' + esc(sat(c.unitSel)) : c.unit ? ' ' + esc(sat(c.unit)) : ''}</b></button><button type="button" data-cp aria-label="tambah">+</button></div>${h ? `<span class="cq-h">Rp ${rp(h * c.qty)}</span>` : ''}</div>
            ${p && p.u.length > 1 ? `<div class="units">${p.u.map(u => `<button type="button" data-cu="${esc(u[0])}" class="${u[0] === c.unitSel ? 'on' : ''}">${esc(sat(u[0]))}${TIERS.length ? ` · Rp ${rp(hargaUnit(p, u[0]))}` : ''}</button>`).join('')}</div>` : ''}
            ${p && !c.ragu && !c.buka && c.hasil.length > 1 ? '<button type="button" class="ganti" data-buka>🔄 Bukan ini? Ganti barang</button>' : ''}
            ${c.hasil.length && (c.ragu || !p || c.buka) ? `<div class="alt">${c.hasil.map(x => `<button type="button" data-alt="${esc(x.i)}" class="${x.i === c.pilih ? 'on' : ''}">${esc(x.n)}</button>`).join('')}<button type="button" data-alt="" class="${c.pilih ? '' : 'on'}">✍️ apa adanya</button></div>` : ''}
            <button type="button" class="buang" data-buang>🗑️ Hapus baris ini</button></div>`;
          })
          .join('') +
        `<button class="btn wa" id="tlAdd" type="button">➕ Masukkan ${cocokan.length} barang ke pesanan</button>`;
      $$('[data-k]', box).forEach(row => {
        const k = +row.dataset.k;
        const c = cocokan[k];
        $$('[data-alt]', row).forEach(
          b =>
            (b.onclick = () => {
              c.pilih = b.dataset.alt;
              c.ragu = false;
              const p = byId.get(c.pilih);
              c.unitSel = p ? pilihUnit(p, c.unit) : '';
              drawCocok();
            })
        );
        $('[data-buka]', row) &&
          ($('[data-buka]', row).onclick = () => {
            c.buka = true;
            drawCocok();
          });
        $$('[data-cu]', row).forEach(
          b =>
            (b.onclick = () => {
              c.unitSel = b.dataset.cu;
              drawCocok();
            })
        );
        $('[data-cm]', row).onclick = () => {
          c.qty = c.qty > 1 ? Math.round((c.qty - 1) * 100) / 100 : c.qty;
          drawCocok();
        };
        $('[data-cp]', row).onclick = () => {
          c.qty = Math.round((c.qty + 1) * 100) / 100;
          drawCocok();
        };
        $('[data-cs]', row).onclick = () => {
          const p = byId.get(c.pilih);
          dialogJumlah(p ? p.n : c.teks, p ? c.unitSel : c.unit, c.qty, n => {
            if (n > 0) c.qty = n;
            else cocokan.splice(k, 1);
            drawCocok();
          });
        };
        $('[data-buang]', row).onclick = () => {
          cocokan.splice(k, 1);
          drawCocok();
        };
      });
      $('#tlAdd').onclick = () => {
        let n = 0;
        for (const c of cocokan) {
          const p = byId.get(c.pilih);
          if (p) ubahQty(p.i, c.unitSel, c.qty, p.n);
          else {
            st.items.push({ i: '', u: c.unit || '', q: c.qty, n: c.teks });
            simpan();
          }
          n++;
        }
        cocokan = [];
        view.tulis = '';
        drawBar();
        toast(`✔ ${n} barang masuk ke pesanan`);
        bukaSheet();
      };
    }

    /* ---------- bar bawah ---------- */
    function drawBar() {
      const n = st.items.length;
      const t = total();
      $('#barBtn').disabled = !n;
      $('#barTxt').innerHTML = n
        ? `🛒 ${n} barang${TIERS.length && t ? `<small>± Rp ${rp(t)} · harga ${esc(tierNama())}</small>` : ''}`
        : 'Belum ada barang dipilih';
    }
    $('#barBtn').onclick = () => bukaSheet();

    /* ---------- lembar pesanan & kirim ---------- */
    function b64url(s) {
      const bytes = new TextEncoder().encode(s);
      let bin = '';
      bytes.forEach(b => (bin += String.fromCharCode(b)));
      return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    /** data pesanan ringkas untuk link kasir: nama barang tidak ikut (kasir mencocokkan lewat kode barang) */
    function payload() {
      return b64url(
        JSON.stringify([
          2,
          st.nama,
          st.hp,
          st.cat,
          st.ambil === 'antar' ? 1 : 0,
          st.tier,
          st.items.map(x => (x.i ? [x.i, x.u, x.q] : ['', x.u || '', x.q, x.n]))
        ])
      );
    }
    function linkKasir() {
      const base = K.kasir || (location.protocol.startsWith('http') ? new URL('./', location.href).href : '');
      return base ? base.replace(/(index\.html)?$/, '') + '#pesan=' + payload() : '';
    }
    /** Pesan WhatsApp: rapi, satu barang satu baris, tanpa tanda bintang / garis / nomor urut */
    function teksWA() {
      const L = ['PESANAN ' + String(toko.nama || '').toUpperCase(), 'Nama: ' + st.nama];
      if (st.hp) L.push('No. HP: ' + st.hp);
      if (TIERS.length > 1) L.push('Harga: ' + tierNama());
      L.push(st.ambil === 'antar' ? 'Diantar' : 'Diambil ke toko');
      if (st.cat) L.push('Catatan: ' + st.cat.replace(/\s*\n\s*/g, ', '));
      L.push('');
      st.items.forEach(x =>
        L.push(`${fq(x.q)}${x.u ? ' ' + sat(x.u) : ''} - ${x.n}${x.i ? '' : ' (belum ada di daftar)'}`)
      );
      if (TIERS.length && total()) L.push('', 'Perkiraan total: Rp ' + rp(total()));
      const lk = linkKasir();
      if (lk) L.push('', 'Buka di kasir:', lk);
      return L.join('\n');
    }
    function bukaSheet() {
      const sh = $('#sheet');
      if (sh.hidden) {
        sh.hidden = false;
        document.body.classList.add('kunci');
        history.pushState({ sheet: 1 }, '');
      }
      drawSheet();
      sh.scrollTop = 0;
    }
    function tutupSheet(viaBack) {
      const sh = $('#sheet');
      if (sh.hidden) return;
      sh.hidden = true;
      document.body.classList.remove('kunci');
      if (!viaBack && history.state && history.state.sheet) history.back();
      drawList();
      drawBar();
    }
    addEventListener('popstate', () => tutupSheet(true));
    function drawSheet(terkirim) {
      const t = total();
      const teks = st.items.length && st.nama ? teksWA() : '';
      $('#sheet').innerHTML =
        `<div class="sh-hd"><button id="shBack" type="button">← Kembali</button><b>Pesanan Anda</b></div><div class="wrap">
       <div class="card"><h2>🛒 Barang yang dipesan (${st.items.length})</h2>${
         st.items
           .map(x => {
             const h = x.i && TIERS.length ? hargaUnit(byId.get(x.i), x.u) : 0;
             return `<div class="li" data-li="${st.items.indexOf(x)}"><div class="nm"><b>${esc(x.n)}</b><small>${x.i ? '' : 'belum ada di daftar, nanti dicarikan · '}${h ? `Rp ${rp(h)} / ${esc(sat(x.u))}` : esc(sat(x.u))}</small></div>
             <div class="step"><button data-dec type="button" aria-label="kurangi">−</button><button class="sq" data-set type="button"><b>${fq(x.q)}</b><small>${esc(sat(x.u))}</small></button><button data-inc type="button" aria-label="tambah">+</button></div></div>`;
           })
           .join('') || '<div class="kosong">Belum ada barang.</div>'
       }
       ${TIERS.length && t ? `<div class="tot"><span>Perkiraan total<small>harga ${esc(tierNama())}, total akhir dihitung toko</small></span><b>Rp ${rp(t)}</b></div>` : ''}
       <button class="btn lite" id="shAdd" type="button">➕ Tambah barang lain</button></div>
       <div class="card"><h2>👤 Data pemesan</h2>
        <label for="fNama">Nama Anda / nama warung <span class="wajib">(wajib)</span></label><input id="fNama" value="${esc(st.nama)}" placeholder="contoh: Toko Emih" autocomplete="name">
        <label for="fHp">No. HP (boleh kosong)</label><input id="fHp" value="${esc(st.hp)}" inputmode="tel" autocomplete="tel">
        <label>Barangnya mau</label><div class="seg2"><button type="button" data-ambil="ambil" class="${st.ambil !== 'antar' ? 'on' : ''}">🏪 Diambil ke toko</button><button type="button" data-ambil="antar" class="${st.ambil === 'antar' ? 'on' : ''}">🛵 Diantar</button></div>
        <label for="fCat">Catatan (alamat antar, jam ambil, dll)</label><textarea id="fCat" rows="2">${esc(st.cat)}</textarea></div>
       <div class="card ${terkirim ? 'done' : ''}" id="kirimBox">${
         terkirim
           ? `<h2>✔ WhatsApp sudah dibuka</h2><p class="besar">Sudah menekan tombol <b>Kirim ➤</b> di WhatsApp?</p>
              <button class="btn wa" id="kSudah" type="button">✔ Sudah terkirim</button><button class="btn" id="kWa2" type="button">📲 Buka WhatsApp lagi</button><button class="btn lite" id="kCopy" type="button">📋 Salin pesan (kirim manual)</button>`
           : `${toko.wa ? '<button class="btn wa besar" id="kWa" type="button">📲 Kirim pesanan lewat WhatsApp</button><p class="note">WhatsApp terbuka dengan pesan yang sudah jadi. Tinggal tekan tombol <b>Kirim ➤</b>.</p>' : ''}
              ${teks ? `<details class="intip"><summary>👁️ Lihat isi pesan</summary><pre>${esc(teks)}</pre></details>` : ''}
              <div class="kecil2"><button class="btn lite" id="kCopy" type="button">📋 Salin pesan</button><button class="btn lite" id="kQr" type="button">🔳 QR untuk kasir</button><button class="btn lite" id="kClr" type="button">🗑️ Kosongkan</button></div><div class="qrbox" id="qrBox"></div>`
       }</div><p class="foot">Daftar pesanan tersimpan di HP ini sampai dikirim.</p></div>`;
      $('#shBack').onclick = () => tutupSheet();
      $('#shAdd').onclick = () => tutupSheet();
      $$('[data-li]').forEach(row => {
        const x = st.items[+row.dataset.li];
        row.onclick = e => {
          const b = e.target.closest('button');
          if (!b) return;
          const selesai = () => {
            if (x.q <= 0) st.items = st.items.filter(y => y !== x);
            simpan();
            drawSheet();
            drawBar();
          };
          if (b.hasAttribute('data-inc')) x.q = Math.round((x.q + 1) * 100) / 100;
          else if (b.hasAttribute('data-dec')) x.q = Math.round((x.q - 1) * 100) / 100;
          else if (b.hasAttribute('data-set'))
            return dialogJumlah(x.n, x.u, x.q, n => {
              x.q = n;
              selesai();
            });
          selesai();
        };
      });
      const baca = () => {
        st.nama = $('#fNama').value.trim();
        st.hp = $('#fHp').value.trim();
        st.cat = $('#fCat').value.trim();
        simpan();
      };
      ['#fNama', '#fHp', '#fCat'].forEach(s => $(s).addEventListener('input', baca));
      ['#fNama', '#fHp', '#fCat'].forEach(s =>
        $(s).addEventListener('change', () => {
          const d = $('.intip pre');
          if (d && st.items.length && st.nama) d.textContent = teksWA();
        })
      );
      $$('[data-ambil]').forEach(
        b =>
          (b.onclick = () => {
            st.ambil = b.dataset.ambil;
            simpan();
            $$('[data-ambil]').forEach(x => x.classList.toggle('on', x === b));
            const d = $('.intip pre');
            if (d && st.items.length && st.nama) d.textContent = teksWA();
          })
      );
      const siap = () => {
        baca();
        if (!st.items.length) {
          toast('Daftar pesanan masih kosong', true);
          return false;
        }
        if (!st.nama) {
          toast('Isi nama dulu', true);
          $('#fNama').focus();
          $('#fNama').scrollIntoView({ behavior: 'smooth', block: 'center' });
          return false;
        }
        return true;
      };
      const salin = async () => {
        if (!siap()) return;
        try {
          await navigator.clipboard.writeText(teksWA());
          toast('Pesan disalin ✔ Tempel di WhatsApp');
        } catch (e) {
          const g = dialog(
            `<h3>Salin pesan ini</h3><textarea class="salin" rows="10" readonly>${esc(teksWA())}</textarea><div class="dlg-b"><button class="btn lite" type="button" data-batal>Tutup</button></div>`
          );
          $('textarea', g.el).select();
          $('[data-batal]', g.el).onclick = g.tutup;
        }
      };
      const kirimWA = () => {
        if (!siap()) return;
        const url = 'https://wa.me/' + toko.wa + '?text=' + encodeURIComponent(teksWA());
        const w = window.open(url, '_blank');
        if (!w) location.href = url;
        drawSheet(true);
      };
      $('#kCopy') && ($('#kCopy').onclick = salin);
      $('#kWa') && ($('#kWa').onclick = kirimWA);
      $('#kWa2') && ($('#kWa2').onclick = kirimWA);
      $('#kQr') &&
        ($('#kQr').onclick = () => {
          if (!siap()) return;
          const box = $('#qrBox');
          try {
            const qr = qrcode(0, 'L');
            qr.addData(linkKasir() || teksWA());
            qr.make();
            box.innerHTML = `<p class="note">Kalau sedang di toko, tunjukkan layar ini ke kasir untuk discan:</p><img alt="QR pesanan" src="${qr.createDataURL(4, 4)}">`;
            box.scrollIntoView({ behavior: 'smooth' });
          } catch (e) {
            box.innerHTML =
              '<p class="note">Pesanan terlalu panjang untuk QR. Kirim lewat WhatsApp saja.</p>';
          }
        });
      $('#kClr') &&
        ($('#kClr').onclick = async () => {
          if (st.items.length && !(await tanya('Kosongkan semua barang di daftar pesanan?', 'Ya, kosongkan')))
            return;
          st.items = [];
          simpan();
          drawSheet();
          drawBar();
        });
      $('#kSudah') &&
        ($('#kSudah').onclick = () => {
          st.items = [];
          st.cat = '';
          simpan();
          tutupSheet();
          toast('Terima kasih, pesanan diproses 🙏');
        });
    }

    drawTier();
    drawChips();
    drawList();
    drawBar();
  }

  muatKatalog().then(K => (K && Array.isArray(K.p) && K.p.length ? mulai(K) : gagal(K)));
})();
