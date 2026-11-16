/* ============ PENGATURAN ============
 * Halaman dibagi per tab. Setiap tab = satu fungsi pembuat tampilan di SET_PAGES.
 * Setiap kartu memakai pola yang sama: judul + keterangan, isian, lalu tombol di kanan bawah.
 */
const SET_TABS = [
  ['toko', '🏪', 'Toko & Struk'],
  ['harga', '🏷️', 'Harga & Kategori'],
  ['uang', '💰', 'Uang & Layanan'],
  ['member', '⭐', 'Member & Hadiah'],
  ['qris', '📱', 'QRIS'],
  ['online', '🛍️', 'Pesan Online'],
  ['data', '💾', 'Data & Backup'],
  ['ai', '🤖', 'Tanya AI']
];
views.pengaturan = () => {
  const tab = SET_TABS.some(t => t[0] === S._setTab) ? S._setTab : 'toko';
  $('#main').innerHTML = `<div class="setwrap"><nav class="setnav">${SET_TABS.map(
    ([id, ic, t]) =>
      `<button data-st="${id}" class="${id === tab ? 'on' : ''}"><span>${ic}</span>${t}</button>`
  ).join('')}</nav><section class="setbody" id="setBody"></section></div>`;
  $$('[data-st]').forEach(
    b =>
      (b.onclick = () => {
        S._setTab = b.dataset.st;
        render();
      })
  );
  SET_PAGES[tab]($('#setBody'));
};
/** Kerangka kartu pengaturan */
function scard(id, title, desc, body, foot = '') {
  return `<div class="scard" id="${id}"><div class="shead"><h3>${title}</h3>${desc ? `<p>${desc}</p>` : ''}</div><div class="sbody">${body}</div>${foot ? `<div class="sfoot">${foot}</div>` : ''}</div>`;
}
const chk = (id, on, text, attr = '') =>
  `<label class="chk"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${attr}> ${text}</label>`;

const SET_PAGES = {
  /* ---------- Toko & Struk ---------- */
  toko(el) {
    const st = settings();
    el.innerHTML =
      scard(
        'cBaca',
        '🔊 Suara membacakan',
        'Kasir membacakan total belanja saat jendela bayar dibuka, lalu kembalian atau kekurangannya setelah transaksi selesai. Bisa juga dinyalakan / dimatikan dengan tombol 🔊 / 🔇 di halaman Kasir.',
        `${chk('bcOn', suaraBacaOn(), '🔊 Nyalakan suara membacakan')}
       <div class="grid2" style="max-width:420px"><div><label>Kecepatan bicara</label><select id="bcRate"><option value="0.8" ${st.bacakanCepat == 0.8 ? 'selected' : ''}>Pelan</option><option value="0.95" ${!st.bacakanCepat || st.bacakanCepat == 0.95 ? 'selected' : ''}>Biasa</option><option value="1.15" ${st.bacakanCepat == 1.15 ? 'selected' : ''}>Cepat</option></select></div></div>
       ${bisaBacakan() ? '' : '<p class="warntxt">Browser ini tidak punya suara. Pakai Google Chrome terbaru.</p>'}`,
        `<button class="btn ghost" id="bcTes">▶️ Coba suara</button><button class="btn pri" id="bcSave">💾 Simpan</button>`
      ) +
      scard(
        'cToko',
        '🏪 Info toko',
        'Muncul di bagian atas struk, label, dan halaman pesan pelanggan.',
        `<div class="grid2"><div><label>Nama toko</label><input id="sn" value="${esc(st.nama)}"></div><div><label>No. HP / WA (dicetak di struk)</label><input id="sh" value="${esc(st.telp)}" inputmode="tel"></div></div>
       <label>Alamat</label><input id="sa" value="${esc(st.alamat)}">`,
        `<button class="btn pri" id="ssave">💾 Simpan</button>`
      ) +
      scard(
        'cStruk',
        '🧾 Struk & kasir',
        'Atur kertas struk dan nama kasir yang dicetak.',
        `<div class="grid3"><div><label>Lebar kertas struk</label><select id="sw">${[58, 72, 80].map(w => `<option value="${w}" ${w == st.lebarStruk ? 'selected' : ''}>${w} mm</option>`).join('')}</select></div>
       <div><label>Nama kasir</label><input id="sk" value="${esc(st.kasir)}" placeholder="contoh: Bu Nina"></div>
       <div><label>Halaman pertama saat dibuka</label><select id="sp"><option value="kasir" ${st.halamanAwal !== 'beranda' ? 'selected' : ''}>Kasir</option><option value="beranda" ${st.halamanAwal === 'beranda' ? 'selected' : ''}>Beranda</option></select></div></div>
       <label>Pesan di bawah struk</label><input id="sf" value="${esc(st.footer)}">
       ${chk('shk', st.hargaKasirSimpan !== false, 'Harga yang diubah di keranjang kasir langsung tersimpan ke data produk (tetap bisa dipilih "hanya transaksi ini")')}`,
        `<button class="btn ghost" id="stest">🖨️ Tes cetak struk</button><button class="btn pri" id="ssave2">💾 Simpan</button>`
      ) +
      scard(
        'cBarcode',
        '🔎 Nama barang otomatis dari barcode',
        `Saat barcode belum terdaftar, nama barangnya dicari dulu di daftar bawaan (${rp(barcodeLokal().size)} barcode, tanpa internet), lalu di internet: ${SUMBER_BARCODE.map(x => x.nama).join(', ')}. Jadi tinggal isi harga. Tidak semua barang pasti ketemu.`,
        `${chk('scb', cariBarcodeAktif(), 'Cari juga di internet (butuh sinyal)')}
       <div class="row" style="margin-top:8px"><input id="scbq" data-bukanuang class="grow" placeholder="Coba: scan / ketik barcode di sini" inputmode="numeric" autocomplete="off"><button class="btn ghost" id="scbGo">🔎 Coba cari</button></div>
       <div id="scbHasil" class="autohint"></div>`,
        `<button class="btn pri" id="scbSave">💾 Simpan</button>`
      );
    const simpan = async () => {
      Object.assign(st, {
        nama: $('#sn').value.trim() || 'TOKO',
        alamat: $('#sa').value.trim(),
        telp: $('#sh').value.trim(),
        footer: $('#sf').value.trim(),
        lebarStruk: +$('#sw').value,
        kasir: $('#sk').value.trim(),
        halamanAwal: $('#sp').value,
        hargaKasirSimpan: $('#shk') ? $('#shk').checked : st.hargaKasirSimpan
      });
      await saveMeta('settings');
      brand();
      toast('Tersimpan ✔');
    };
    $('#ssave').onclick = simpan;
    $('#bcTes').onclick = () => {
      settings().bacakanCepat = Number($('#bcRate').value);
      bacakan('Totalnya ' + rupiahKata(25500) + '. Kembaliannya ' + rupiahKata(4500), true);
    };
    $('#bcSave').onclick = async () => {
      st.bacakan = $('#bcOn').checked;
      st.bacakanCepat = Number($('#bcRate').value);
      await saveMeta('settings');
      toast(st.bacakan ? '🔊 Suara membacakan NYALA ✔' : '🔇 Suara membacakan MATI ✔');
    };
    $('#ssave2').onclick = simpan;
    $('#scbSave').onclick = async () => {
      st.cariBarcode = $('#scb').checked;
      await saveMeta('settings');
      toast('Tersimpan ✔');
    };
    const cobaCari = async () => {
      const c = $('#scbq').value.trim();
      if (!/^\d{6,14}$/.test(c)) return toast('Isi barcode angka', true);
      const ada = findBarcode(c, true);
      if (ada)
        return ($('#scbHasil').innerHTML = `Barcode ini sudah jadi produk toko: <b>${esc(ada.nama)}</b>`);
      $('#scbHasil').innerHTML = '<span class="spin"></span> Mencari…';
      const h = await cariNamaBarcode(c);
      $('#scbHasil').innerHTML = hasilCariHTML(h, c);
    };
    $('#scbGo').onclick = cobaCari;
    $('#scbq').onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        cobaCari();
      }
    };
    $('#stest').onclick = () =>
      printReceipt({
        no: 'TES-0001',
        waktu: Date.now(),
        customerNama: '',
        items: [{ nama: 'CONTOH BARANG', qty: 2, harga: 3500 }],
        subtotal: 7000,
        diskon: 0,
        total: 7000,
        metode: 'tunai',
        bayar: 10000,
        kembali: 3000,
        kasir: $('#sk').value.trim()
      });
  },

  /* ---------- Harga & Kategori ---------- */
  harga(el) {
    const A = autoWarung();
    const PR = prioritasConf();
    const nCek = S.products.filter(p => p.aktif !== false && perluCekWarung(p)).length;
    const cats = categories()
      .sort(urutKategori)
      .map(c => [c, S.products.filter(p => p.aktif !== false && p.kategori === c).length]);
    const nUsul = usulanKategori(
      S.products.filter(p => p.aktif !== false),
      false
    ).length;
    el.innerHTML =
      scard(
        'cTier',
        '🏷️ Kategori harga',
        'Contoh: Umum/Perorangan, Warung, Grosir. Setiap pelanggan bisa diberi kategori harga sendiri.',
        `<div id="tl">${tiers()
          .map(
            t =>
              `<div class="row tierrow"><input data-tn="${t.id}" value="${esc(t.nama)}" class="grow"><span class="tact">${t.id !== 'umum' ? `<button class="btn sm bad" data-tx="${t.id}">Hapus</button>` : '<span class="badge">utama</span>'}</span></div>`
          )
          .join('')}</div>
       <div class="row tierrow"><input id="tnew" placeholder="Nama kategori harga baru…" class="grow"><span class="tact"><button class="btn sm ghost" id="tadd">➕ Tambah</button></span></div>`,
        `<button class="btn pri" id="tsave">💾 Simpan</button>`
      ) +
      scard(
        'cAutoW',
        '⚙ Harga warung otomatis',
        'Di form produk, isi salah satu harga saja: isi harga warung, harga perorangan otomatis = warung + selisih. Isi harga perorangan, harga warung otomatis = perorangan − selisih. Harga warung yang kosong di data lama diisi sendiri dan ditandai <b>perlu cek</b>.',
        `${chk('awA', A.aktif, 'Isi harga warung otomatis kalau kosong')}
       <div class="grid2"><div><label>Selisih harga perorangan dan warung (Rp)</label><input id="awS" inputmode="numeric" value="${rp(A.selisih)}"></div>
       <div><label>Untung minimal dari harga beli (Rp)</label><input id="awU" inputmode="numeric" value="${rp(A.untungMin)}"></div></div>
       <p class="hint" id="awEx"></p>`,
        `${nCek ? `<button class="btn ghost" id="awCek">🔎 Cek ${rp(nCek)} harga</button>` : ''}<button class="btn ghost" id="awFill">⚡ Isi yang kosong sekarang</button><button class="btn pri" id="awSave">💾 Simpan</button>`
      ) +
      scard(
        'cPrio',
        '⭐ Barang prioritas di pencarian',
        'Barang kebutuhan rumah tangga yang sering dibeli tampil paling atas saat dicari, di kasir maupun di halaman pesan pelanggan. Tulis satu kata kunci per baris. Kata kunci dicocokkan dengan nama, nama lain, dan kategori barang.',
        `${chk('prA', PR.aktif, 'Aktifkan barang prioritas')}
       <div class="grid2"><div><label>Kata kunci (satu per baris)</label><textarea id="prK" rows="8">${esc((PR.kata || []).join('\n'))}</textarea></div>
       <div><label>Hasilnya sekarang</label><div class="prioinfo" id="prInfo"></div></div></div>
       <p class="hint">Contoh: <b>kopi</b> + <b>good day</b> membuat Good Day lebih atas dari kopi lain. Per barang juga bisa diatur di Produk → Ubah → centang ⭐ Barang prioritas.</p>`,
        `<button class="btn ghost" id="prList">📋 Lihat daftar barangnya</button><button class="btn pri" id="prSave">💾 Simpan</button>`
      ) +
      scard(
        'cKat',
        '🗂️ Kategori produk',
        'Kategori dibuat sederhana seperti rak warung. Barang baru otomatis masuk kategori yang sesuai dari namanya (tetap bisa diganti). Di sini kategori bisa disatukan, dan aturan penyatuannya juga dipakai saat import dari Fastmart.',
        `<div class="row" style="margin-bottom:10px"><button class="btn ${nUsul ? 'pri' : 'ghost'}" id="kOto" type="button">🪄 Pilah otomatis${nUsul ? ` (${nUsul} barang)` : ''}</button><span class="hint" style="margin:0">Barang yang belum ada kategorinya atau masih di LAIN-LAIN dipindah ke kategori yang cocok dengan namanya. Kategori yang sudah dipilih sendiri tidak diubah.</span></div>
        <div class="katlist">${
          cats
            .map(
              ([c, n]) =>
                `<label class="chk katitem"><input type="checkbox" data-kc="${esc(c)}"> <span class="grow">${ikonKategori(c)} ${esc(c)}</span><span class="muted">${n}</span></label>`
            )
            .join('') || '<p class="muted">Belum ada kategori.</p>'
        }</div>
        <details class="katinfo"><summary>ℹ️ Isi tiap kategori</summary><ul>${KATEGORI_STANDAR.map(k => `<li>${k.ikon} <b>${esc(k.nama)}</b>: ${esc(k.isi)}</li>`).join('')}</ul></details>
       <div class="row" style="margin-top:10px"><input id="kNew" class="grow" placeholder="Nama kategori gabungan, misal ROKOK"><button class="btn pri" id="kMerge">🔗 Satukan yang dicentang</button></div>
       <div class="row" style="margin-top:10px"><button class="btn ghost" id="kRapi" type="button">🧹 Rapikan nama produk</button><span class="hint" style="margin:0">Nama rokok tanpa BKS/PCS, versi SLOP jadi satuan SLOP, kata ANEKA &amp; KEMASAN dihapus.</span></div>
       ${
         catRules().length
           ? `<label>Aturan penyatuan yang aktif</label><div>${catRules()
               .map(
                 (r, i) =>
                   `<span class="rulechip">${r.awalan ? `semua yang berawalan <b>${esc(r.awalan)}</b>` : `<b>${esc(r.sama)}</b>`} → <b>${esc(r.ke)}</b> <button data-kr="${i}" title="Hapus aturan">✕</button></span>`
               )
               .join('')}</div>`
           : ''
       }`
      );
    // kategori harga
    $('#tadd').onclick = async () => {
      const n = $('#tnew').value.trim();
      if (!n) return;
      S.meta.tiers.push({ id: 't' + Date.now().toString(36), nama: n });
      await saveMeta('tiers');
      render();
    };
    $$('[data-tx]').forEach(
      b =>
        (b.onclick = async () => {
          if (S.customers.some(c => c.tier === b.dataset.tx))
            return toast('Masih dipakai pelanggan. Ganti dulu kategorinya.', true);
          if (!(await confirmBox('Hapus kategori harga ini?', 'Hapus', true))) return;
          S.meta.tiers = S.meta.tiers.filter(t => t.id !== b.dataset.tx);
          await saveMeta('tiers');
          render();
        })
    );
    $('#tsave').onclick = async () => {
      $$('[data-tn]').forEach(i => {
        const t = S.meta.tiers.find(x => x.id === i.dataset.tn);
        if (t && i.value.trim()) t.nama = i.value.trim();
      });
      await saveMeta('tiers');
      toast('Kategori harga disimpan ✔');
    };
    // harga warung otomatis
    const awEx = () => {
      const s = num($('#awS').value),
        u = num($('#awU').value);
      const ex = (umum, hb) =>
        Math.min(umum, Math.max(umum - s, hb ? Math.ceil((hb + u) / 100) * 100 : 0)) || umum;
      $('#awEx').innerHTML =
        `Contoh: harga perorangan Rp 3.500, harga beli Rp 2.800 → warung <b>Rp ${rp(ex(3500, 2800))}</b>. Harga perorangan Rp 3.000, harga beli Rp 2.800 → warung <b>Rp ${rp(ex(3000, 2800))}</b> (tidak boleh lebih mahal dari perorangan).`;
    };
    awEx();
    $('#awS').oninput = awEx;
    $('#awU').oninput = awEx;
    const simpanAW = async () => {
      Object.assign(A, {
        aktif: $('#awA').checked,
        selisih: Math.max(0, num($('#awS').value)),
        untungMin: Math.max(0, num($('#awU').value))
      });
      await saveMeta('settings');
    };
    $('#awSave').onclick = async () => {
      await simpanAW();
      toast('Aturan harga warung disimpan ✔');
    };
    $('#awFill').onclick = async () => {
      await simpanAW();
      if (!A.aktif) return toast('Centang dulu "Isi harga warung otomatis"', true);
      const ch = S.products.filter(p => isiHargaWarungKosong(p) > 0);
      if (!ch.length) return toast('Tidak ada harga warung yang kosong 👍');
      await DB.putMany('products', ch);
      markDirty();
      toast(`${ch.length} produk diisi harga warungnya ✔ Silakan dicek`);
      render();
    };
    $('#awCek') && ($('#awCek').onclick = () => cekWarungDialog(render));
    // barang prioritas
    const prInfo = () => {
      const L = S.products.filter(p => p.aktif !== false && isPrioritas(p));
      $('#prInfo').innerHTML =
        `<b style="font-size:20px">${rp(L.length)}</b> barang prioritas<div class="pmeta muted">${L.slice(
          0,
          8
        )
          .map(p => esc(p.nama))
          .join(', ')}${L.length > 8 ? ', …' : ''}</div>`;
    };
    prInfo();
    const bacaPrio = () => {
      PR.aktif = $('#prA').checked;
      PR.kata = [
        ...new Set(
          $('#prK')
            .value.split(/\n|,/)
            .map(x => x.trim().toLowerCase())
            .filter(Boolean)
        )
      ];
    };
    let prTimer;
    $('#prK').oninput = () => {
      bacaPrio();
      prInfo();
      clearTimeout(prTimer);
      prTimer = setTimeout(() => saveMeta('settings'), 800);
    };
    $('#prA').onchange = () => {
      bacaPrio();
      prInfo();
      saveMeta('settings');
    };
    $('#prSave').onclick = async () => {
      bacaPrio();
      await saveMeta('settings');
      toast('Barang prioritas disimpan ✔');
    };
    $('#prList').onclick = async () => {
      bacaPrio();
      await saveMeta('settings');
      S._prodFilter = 'prio';
      prodFilter.page = 1;
      go('produk');
    };
    // kategori produk
    $('#kMerge').onclick = async () => {
      const pilih = $$('[data-kc]')
        .filter(x => x.checked)
        .map(x => x.dataset.kc);
      const ke = $('#kNew').value.trim().toUpperCase();
      if (!pilih.length) return toast('Centang kategori yang mau disatukan', true);
      if (!ke) return toast('Isi nama kategori gabungan', true);
      const kena = S.products.filter(p => pilih.includes(p.kategori));
      if (
        !(await confirmBox(
          `Satukan ${pilih.length} kategori (${kena.length} produk) menjadi ${ke}?`,
          'Satukan'
        ))
      )
        return;
      kena.forEach(p => (p.kategori = ke));
      const R = catRules();
      pilih.filter(k => k !== ke).forEach(k => R.push({ sama: k, ke }));
      await DB.putMany('products', kena);
      await saveMeta('settings');
      toast(`${kena.length} produk sekarang berkategori ${ke} ✔`);
      render();
    };
    $('#kOto').onclick = async () => {
      const u = usulanKategori(
        S.products.filter(p => p.aktif !== false),
        false
      );
      if (!u.length) return toast('Semua barang sudah punya kategori yang cocok 👍');
      const contoh = u
        .slice(0, 3)
        .map(x => `${x.p.nama} → ${x.ke}`)
        .join(', ');
      if (
        !(await confirmBox(
          `Pindahkan ${u.length} barang ke kategori yang cocok? Contoh: ${contoh}${u.length > 3 ? ', dan lainnya' : ''}.`,
          'Pindahkan'
        ))
      )
        return;
      const ch = rapikanKategori(
        u.map(x => x.p),
        false
      );
      ch.forEach(p => (p.diubah = Date.now()));
      await DB.putMany('products', ch);
      markDirty();
      toast(`${ch.length} barang dipindah ke kategori yang cocok ✔`);
      render();
    };
    $('#kRapi').onclick = async () => {
      const r = rapikanProduk();
      if (!r.berubah.length) return toast('Nama produk sudah rapi 👍');
      await DB.putMany('products', r.berubah);
      markDirty();
      toast(`${r.ganti} nama dirapikan${r.gabung ? `, ${r.gabung} SLOP digabung` : ''} ✔`);
      render();
    };
    $$('[data-kr]').forEach(
      b =>
        (b.onclick = async () => {
          catRules().splice(+b.dataset.kr, 1);
          await saveMeta('settings');
          render();
        })
    );
  },

  /* ---------- Uang & Layanan ---------- */
  uang(el) {
    const U = uangConf();
    const mat = S.products.filter(p => p.aktif !== false && kasProduk(p) === 'material');
    const jenis = urutanLayanan();
    const barisTarif = j => {
      const L = LAYANAN[j],
        t = tarifLayanan(j);
      return `<tr><td>${L.ikon} ${esc(L.nama)}</td><td class="num"><input data-ta="${j}" inputmode="numeric" value="${rp(t.admin)}"></td><td class="num"><input data-tb="${j}" inputmode="numeric" value="${t.biaya ? rp(t.biaya) : ''}" placeholder="0"></td></tr>`;
    };
    const tabelTarif = MENU_LAYANAN.filter(g => kasAktif().some(k => k.id === g.kas))
      .map(g =>
        g.bagian
          .map(
            b =>
              `<tr class="tarifgrup"><td colspan="3">${g.ikon} ${g.judul}${b.judul ? ' · ' + esc(b.judul) : ''}</td></tr>` +
              b.isi
                .flatMap(x => (typeof x === 'string' ? [x] : x.sub))
                .map(barisTarif)
                .join('')
          )
          .join('')
      )
      .join('');
    el.innerHTML =
      scard(
        'cUang',
        '💰 Uang terpisah',
        'Uang Warung (barang warung + PojokBayar), uang BRILink, dan uang Material dihitung sendiri-sendiri: masing-masing punya laci, buka/tutup kasir, pengeluaran, dan laba.',
        `${chk('uB', U.brilink !== false, '🏦 Pakai uang <b>BRILink</b> (tarik tunai, transfer / setor, bayar lewat BRILink)')}
       ${chk('uM', U.material !== false, '🧱 Pakai uang <b>Material</b> (barang toko bangunan: semen, pasir, besi, dll)')}
       ${chk('uO', U.otomatis !== false, '⏰ <b>Buka dan tutup kasir otomatis</b> sesuai jam toko (tidak perlu klik apa pun)')}
       <div class="grid2" style="max-width:420px;margin:2px 0 6px 30px"><div><label>Jam buka toko</label><input id="uJb" type="time" data-bukanuang value="${esc(U.jamBuka || '05:00')}"></div><div><label>Jam tutup toko</label><input id="uJt" type="time" data-bukanuang value="${esc(U.jamTutup || '21:00')}"></div></div>
       <p class="hint" style="margin:0 0 8px 30px">Uang awal dan uang tutup diambil dari catatan aplikasi, jadi tidak ada hitung uang. Kalau suatu hari ingin mencocokkan uang di laci, buka menu Uang lalu tekan Tutup kasir dan hitung seperti biasa.</p>
       ${chk('uI', U.ingatBuka !== false, '☀️ Ingatkan buka kasir setiap pagi di halaman Kasir (dipakai kalau buka otomatis dimatikan)')}`,
        `<button class="btn ghost" id="uGo">💰 Buka halaman Uang</button><button class="btn pri" id="uSave">💾 Simpan</button>`
      ) +
      (U.material !== false
        ? scard(
            'cMat',
            '🧱 Barang toko material',
            'Uang penjualan barang ini masuk ke laci Material. Bisa juga diatur satu per satu di Produk → Ubah.',
            `<p style="margin:0 0 6px"><b>${mat.length}</b> barang masuk uang Material${
              mat.length
                ? ': ' +
                  mat
                    .slice(0, 8)
                    .map(p => esc(p.nama))
                    .join(', ') +
                  (mat.length > 8 ? ', …' : '')
                : '.'
            }</p>`,
            `<button class="btn pri" id="uMat">🧱 Pilih barang material</button>`
          )
        : '') +
      scard(
        'cTarif',
        '📲 Tarif layanan',
        'Angka bawaan saat mencatat menu PojokBayar dan BRILink (urutannya sama dengan menu di aplikasinya). Ini hanya <b>contoh</b>, silakan sesuaikan dengan tarif toko. Saat mencatat tetap bisa diubah per transaksi.',
        `<div class="tablewrap" style="max-height:none"><table class="tariftab"><thead><tr><th>Layanan</th><th class="num">Admin / untung (Rp)</th><th class="num">Selisih modal / potongan bank (Rp)</th></tr></thead><tbody>${tabelTarif}</tbody></table></div>
       <p class="hint">PojokBayar: harga jual bawaan = nominal + admin, harga modal bawaan = nominal + selisih modal. BRILink: admin = untung toko, potongan bank = biaya yang dipotong dari rekening (kalau ada).</p>`,
        `<button class="btn pri" id="tfSave">💾 Simpan tarif</button>`
      ) +
      scard(
        'cKul',
        '🛒 Daftar kulakan',
        'Daftar belanja barang dibuat dari rata-rata penjualan 30 hari terakhir. Atur stok dianggap cukup untuk berapa hari.',
        `<div class="grid2"><div><label>Stok cukup untuk (hari)</label><input id="kuH" inputmode="numeric" value="${U.hariKulakan || 7}"></div></div>`,
        `<button class="btn ghost" id="kuOpen">🛒 Lihat daftar kulakan</button><button class="btn pri" id="kuSave">💾 Simpan</button>`
      );
    $('#uGo').onclick = () => go('uang');
    $('#uSave').onclick = async () => {
      U.brilink = $('#uB').checked;
      U.material = $('#uM').checked;
      U.ingatBuka = $('#uI').checked;
      const jb = jamKeMenit($('#uJb').value),
        jt = jamKeMenit($('#uJt').value);
      if ($('#uO').checked && (jb === null || jt === null || jt <= jb))
        return toast('Jam tutup harus lebih malam dari jam buka', true);
      U.otomatis = $('#uO').checked;
      if (jb !== null) U.jamBuka = $('#uJb').value;
      if (jt !== null) U.jamTutup = $('#uJt').value;
      await saveMeta('settings');
      await tikKasirOtomatis(true);
      lupakanRincian();
      toast('Tersimpan ✔');
      render();
    };
    $('#uMat') && ($('#uMat').onclick = () => pilihMaterialDialog(render));
    $('#tfSave').onclick = async () => {
      for (const j of jenis) {
        if (!$(`[data-ta="${j}"]`)) continue;
        const a = num($(`[data-ta="${j}"]`).value),
          b = num($(`[data-tb="${j}"]`).value);
        U.tarif[j] = { admin: a, biaya: b };
      }
      await saveMeta('settings');
      toast('Tarif layanan tersimpan ✔');
    };
    $('#kuSave').onclick = async () => {
      U.hariKulakan = Math.max(1, Math.round(num($('#kuH').value)) || 7);
      await saveMeta('settings');
      toast('Tersimpan ✔');
    };
    $('#kuOpen').onclick = kulakanDialog;
  },

  /* ---------- Member & Hadiah ---------- */
  member(el) {
    const L = loy();
    el.innerHTML =
      scard(
        'cLoy',
        '⭐ Aturan poin member',
        'Member mendapat poin setiap belanja. Poin bisa ditukar potongan belanja atau hadiah.',
        `${chk('lyA', L.aktif, 'Aktifkan poin member')}
       <div class="grid2"><div><label>Dapat 1 poin setiap belanja kelipatan (Rp)</label><input id="lyP" inputmode="numeric" value="${rp(L.perRp)}"></div><div><label>Nilai 1 poin saat ditukar potongan (Rp)</label><input id="lyN" inputmode="numeric" value="${rp(L.nilai)}"></div></div>
       <div class="grid2"><div><label>Minimal tukar potongan (poin)</label><input id="lyM" inputmode="numeric" value="${L.minTukar}"></div><div><label>Kategori harga yang dapat poin</label>${tiers()
         .map(t => chk('lyt_' + t.id, L.tiers.includes(t.id), esc(t.nama), `data-lyt="${t.id}"`))
         .join('')}</div></div>
       <p class="hint" id="lyEx"></p>`,
        `<button class="btn pri" id="lySave">💾 Simpan aturan poin</button>`
      ) +
      scard(
        'cRw',
        '🎁 Daftar hadiah',
        'Hadiah yang bisa ditukar member dengan poin. Penukaran dilakukan dari menu Pelanggan (tombol ⭐ Poin) atau dari kotak poin di Kasir.',
        `<div id="rwT">${rewardsTableHTML()}</div>`,
        `<button class="btn ghost" id="rwPrint">🖨️ Cetak daftar hadiah</button><button class="btn pri" id="rwAdd">➕ Tambah hadiah</button>`
      );
    const lyEx = () => {
      const p = num($('#lyP').value) || 10000,
        n = num($('#lyN').value) || 100;
      $('#lyEx').textContent =
        `Contoh: belanja Rp ${rp(p * 5)} dapat 5 poin. 100 poin = potongan Rp ${rp(100 * n)}. Nilai balik ke pembeli ± ${((n / p) * 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })}% dari belanja.`;
    };
    lyEx();
    $('#lyP').oninput = lyEx;
    $('#lyN').oninput = lyEx;
    $('#lySave').onclick = async () => {
      Object.assign(L, {
        aktif: $('#lyA').checked,
        perRp: Math.max(100, num($('#lyP').value) || 10000),
        nilai: Math.max(1, num($('#lyN').value) || 100),
        minTukar: Math.max(1, Math.floor(num($('#lyM').value)) || 1),
        tiers: $$('[data-lyt]')
          .filter(x => x.checked)
          .map(x => x.dataset.lyt)
      });
      await saveMeta('settings');
      toast('Aturan poin disimpan ✔');
    };
    const redraw = () => {
      $('#rwT').innerHTML = rewardsTableHTML();
      bindRewardsTable(el, redraw);
    };
    bindRewardsTable(el, redraw);
    $('#rwAdd').onclick = () => rewardEditDialog(null, redraw);
    $('#rwPrint').onclick = printRewardCatalog;
  },

  /* ---------- QRIS ---------- */
  qris(el) {
    const st = settings();
    el.innerHTML = scard(
      'cQris',
      '📱 QRIS toko',
      'Upload foto QRIS toko sekali. Saat pembayaran QRIS, aplikasi menampilkan QR dengan nominal sesuai total belanja.',
      st.qris
        ? `<p style="margin-top:0"><span class="badge ok">aktif</span> <b>${esc(st.qris.nama)}</b>${st.qris.kota ? ' · ' + esc(st.qris.kota) : ''}</p>
         <p class="hint">Uang masuk tetap dicek lewat notifikasi aplikasi merchant/bank sebelum transaksi diselesaikan.</p>
         ${chk('qstruk', st.qrisStruk !== false, 'Cetak QRIS di struk (struk utang: QR berisi nominal sisa utang)')}`
        : '<p class="muted" style="margin-top:0">Belum diatur.</p>',
      `<button class="btn pri" id="qset">${st.qris ? 'Ganti / hapus QRIS' : '📷 Atur QRIS toko'}</button>`
    );
    $('#qset').onclick = qrisSetup;
    $('#qstruk') &&
      ($('#qstruk').onchange = async e => {
        st.qrisStruk = e.target.checked;
        await saveMeta('settings');
        toast('Tersimpan ✔');
      });
  },

  /* ---------- Pesan Online & Hosting ---------- */
  online(el) {
    const st = settings();
    const O = online();
    const g = ghConf();
    const perlu = katalogPerluUpdate();
    el.innerHTML =
      scard(
        'cOnl',
        '🛍️ Link pesan pelanggan',
        'Pelanggan membuka link ini di HP, memilih barang (harga Perorangan atau Warung), lalu pesanan dikirim ke WhatsApp toko. Link di pesan WhatsApp itu langsung membuka pesanan di kasir.',
        `<div class="grid2"><div><label>Alamat situs (dari Cloudflare Pages)</label><input id="oUrl" value="${esc(O.url)}" placeholder="contoh: toko-mahyu.pages.dev"></div>
       <div><label>No. WhatsApp penerima pesanan</label><input id="oWa" value="${esc(st.orderWa || st.telp || '')}" inputmode="tel" placeholder="08xxxxxxxxxx"></div></div>
       <label>Pilihan harga yang bisa dilihat pelanggan</label><div class="row">${tiers()
         .map(t => chk('ot_' + t.id, O.tiers.includes(t.id), esc(tierPublik(t)), `data-ot="${t.id}"`))
         .join('')}</div>
       ${siteBase() ? `<p class="hint">Link pelanggan: <b class="bc">${esc(pesanLink())}</b> (harga ${esc(tierPublik(tiers().find(t => t.id === hargaAwalPesan()) || { id: 'umum' }))} langsung terpilih)</p>` : '<p class="hint">Belum punya alamat situs? Ikuti PANDUAN HOSTING (gratis, ±30 menit sekali saja).</p>'}`,
        `<button class="btn ghost" id="oPrev">👁️ Lihat contoh</button><button class="btn ghost" id="oShare" ${siteBase() ? '' : 'disabled'}>🔗 Salin link & poster QR</button><button class="btn pri" id="oSave">💾 Simpan</button>`
      ) +
      scard(
        'cKatOnl',
        '☁️ Katalog online',
        'Daftar barang & harga yang dilihat pelanggan. Perbarui setiap ada perubahan harga atau barang baru.',
        `<div class="statline">${perlu ? '<span class="badge warn">ada perubahan belum diterbitkan</span>' : '<span class="badge ok">sudah terbaru</span>'} <span class="muted">Terakhir diterbitkan: <b>${O.lastPublish ? tglJam(O.lastPublish) : 'belum pernah'}</b> · ${rp(S.products.filter(p => p.aktif !== false && priceOf(p, 'umum') > 0).length)} barang</span></div>
       ${chk('oAuto', O.auto, 'Terbitkan otomatis kalau ada perubahan (paling sering 2 jam sekali, butuh internet & GitHub terhubung)')}`,
        `<button class="btn ghost" id="oDlK">⬇️ Unduh katalog.json (unggah manual)</button><button class="btn pri" id="oPub" ${ghSiap() ? '' : 'disabled'}>☁️ Perbarui katalog online</button>`
      ) +
      scard(
        'cGh',
        '🔑 Hubungkan GitHub',
        'Supaya tombol <b>Perbarui katalog online</b> bisa bekerja dari sini. Token disimpan hanya di perangkat ini dan <b>tidak ikut</b> file backup.',
        `<div class="grid3"><div><label>Pemilik repo (username GitHub)</label><input id="gO" value="${esc(g.owner)}" placeholder="contoh: ivan-mahyu" autocomplete="off"></div>
       <div><label>Nama repo</label><input id="gR" value="${esc(g.repo)}" placeholder="contoh: kasir-toko-mahyu" autocomplete="off"></div>
       <div><label>Branch</label><input id="gB" value="${esc(g.branch)}"></div></div>
       <div class="grid2"><div><label>Lokasi file katalog di repo</label><input id="gP" value="${esc(g.path)}"></div>
       <div><label>Token (fine-grained, izin Contents: Read and write)</label><input id="gT" type="password" value="${esc(g.token)}" autocomplete="off" placeholder="github_pat_…"></div></div>`,
        `<button class="btn ghost" id="gTest">🔌 Tes koneksi</button><button class="btn pri" id="gSave">💾 Simpan</button>`
      ) +
      scard(
        'cMandiri',
        '📄 Tanpa hosting',
        'Belum hosting? Unduh file halaman pesan lalu kirim filenya ke pelanggan. Harga di file ini tidak ikut berubah, jadi buat ulang kalau harga berubah.',
        '',
        `<button class="btn ghost" id="oDlP">⬇️ Unduh file halaman pesan</button>`
      );
    const simpanOnline = async () => {
      O.url = $('#oUrl').value.trim();
      O.tiers = $$('[data-ot]')
        .filter(x => x.checked)
        .map(x => x.dataset.ot);
      O.auto = $('#oAuto').checked;
      st.orderWa = $('#oWa').value.trim();
      await saveMeta('settings');
    };
    $('#oSave').onclick = async () => {
      if ($('#oWa').value.trim() && !waNumber($('#oWa').value))
        return toast('No. WhatsApp belum benar', true);
      await simpanOnline();
      toast('Tersimpan ✔');
      render();
    };
    $('#oAuto').onchange = simpanOnline;
    $('#oPrev').onclick = async () => {
      await simpanOnline();
      previewPesanPage();
    };
    $('#oShare').onclick = shareOrderLinkDialog;
    $('#oDlK').onclick = async () => {
      await simpanOnline();
      downloadKatalog();
    };
    $('#oDlP').onclick = async () => {
      await simpanOnline();
      downloadPesanPage();
    };
    const bacaGh = () =>
      Object.assign(ghConf(), {
        owner: $('#gO').value.trim(),
        repo: $('#gR').value.trim(),
        branch: $('#gB').value.trim() || 'main',
        path: $('#gP').value.trim().replace(/^\/+/, '') || 'public/katalog.json',
        token: $('#gT').value.trim()
      });
    $('#gSave').onclick = async () => {
      bacaGh();
      await saveGhConf();
      toast('Pengaturan GitHub disimpan ✔');
      render();
    };
    $('#gTest').onclick = async e => {
      bacaGh();
      e.target.disabled = true;
      try {
        const r = await ghTest();
        await saveGhConf();
        toast('Terhubung ke ' + r + ' ✔');
        render();
      } catch (err) {
        toast(err.message, true);
      }
      e.target.disabled = false;
    };
    $('#oPub').onclick = async e => {
      await simpanOnline();
      e.target.disabled = true;
      e.target.textContent = '⏳ Mengunggah…';
      try {
        const n = await publishKatalog();
        toast(`Katalog online diperbarui ✔ (${n} barang). Situs berubah dalam 1–2 menit.`);
        render();
      } catch (err) {
        toast(err.message, true);
        e.target.disabled = false;
        e.target.textContent = '☁️ Perbarui katalog online';
      }
    };
  },

  /* ---------- Data & Backup ---------- */
  data(el) {
    const lb = S.meta.lastBackup;
    el.innerHTML =
      scard(
        'cBak',
        '💾 Backup data',
        'Semua data tersimpan di browser perangkat ini. Backup rutin supaya aman kalau komputer rusak atau browser dibersihkan.',
        `<p style="margin-top:0">${lb ? `Backup terakhir: <b>${tglJam(lb)}</b>` : '<b style="color:var(--bad)">Belum pernah backup.</b>'}</p>
       ${chk('bkU', backupHarianAktif(), '💾 <b>Backup harian otomatis ke folder Download</b> (tanpa klik dan tanpa izin, 1 file per hari)')}
       <p class="hint" style="margin:0 0 10px 30px">Nama filenya <b>backup-kasir-toko-mahyu-(tanggal).json</b>. Dibuat sendiri saat aplikasi dipakai, hanya kalau ada data yang berubah. File yang sudah lama boleh dihapus sesekali, sisakan beberapa yang terbaru.</p>
       <p>Backup ke satu file pilihan: ${S.meta.backupHandle ? (S._bkFileOk ? `<span class="badge ok">aktif</span> ke file <b>${esc(S.meta.backupHandle.name)}</b>` : `<span class="badge warn">menunggu izin browser</span> file <b>${esc(S.meta.backupHandle.name)}</b> <button class="btn sm ghost" id="bkIzin">Izinkan lagi</button>`) : '<span class="badge">tidak dipakai</span>'}</p>
       ${S.meta.backupHandle && !S._bkFileOk ? `<p class="hint">Browser meminta izin ini lagi setiap dibuka ulang, dan aplikasi tidak bisa mengizinkannya sendiri. Kalau di jendela izin ada pilihan <b>Izinkan di setiap kunjungan</b>, pilih itu supaya tidak ditanya lagi. Selama belum diizinkan, backup harian ke folder Download yang jalan.</p>` : ''}
       <p class="hint">Tips: simpan file backup otomatis di folder Google Drive/OneDrive di PC supaya ikut tersimpan online. Untuk pindah data ke HP atau ke alamat situs baru: Unduh backup di sini, lalu Pulihkan di tempat baru.</p>
       <input type="file" id="bfile" accept=".json" class="hide">`,
        `<button class="btn ghost" id="brs">⬆️ Pulihkan dari backup</button><button class="btn ghost" id="bdl">⬇️ Unduh backup</button><button class="btn pri" id="bauto">⚡ ${S.meta.backupHandle ? 'Ganti file pilihan' : 'Backup ke satu file pilihan'}</button>`
      ) +
      (S.meta.cadanganUpdate
        ? scard(
            'cCad',
            '🛟 Salinan otomatis sebelum pembaruan',
            `Dibuat <b>${tglJam(S.meta.cadanganUpdate.waktu)}</b>, tepat sebelum versi baru merapikan data (nama produk, kategori, satuan SLOP, harga otomatis). Harga yang sudah Anda ubah sendiri tidak disentuh pembaruan. Salinan ini hanya untuk jaga-jaga.`,
            '',
            `<button class="btn ghost" id="cadDl">⬇️ Unduh salinan</button><button class="btn bad" id="cadBack">↩ Kembalikan data ke salinan ini</button>`
          )
        : '') +
      scard(
        'cImp',
        '📥 Import & export produk',
        'Masukkan produk dari file export <b>Fastmart</b> (data_product .xlsx). Produk lama diperbarui, produk baru ditambahkan. Stok produk lama tidak diubah. Barang dari <b>daftar barcode bawaan</b> (997 barang) juga bisa dimasukkan sekaligus: barcode dan kategorinya sudah ada, harganya diisi saat barangnya di-scan.',
        '<input type="file" id="ifile" accept=".xlsx,.xls,.csv" class="hide">',
        `<button class="btn ghost" id="iex">⬇️ Export produk ke Excel</button><button class="btn ghost" id="idf">📥 Tambah barang dari daftar barcode</button><button class="btn pri" id="ifm">📂 Pilih file Fastmart (.xlsx)</button>`
      ) +
      scard(
        'cWipe',
        '⚠️ Hapus data',
        'Menghapus semua produk, penjualan, pelanggan, dan utang di perangkat ini. File backup diunduh otomatis sebelum dihapus.',
        '',
        `<button class="btn bad" id="wipe">🗑️ Hapus semua data di perangkat ini</button>`
      );
    if (S.meta.cadanganUpdate) {
      const c = S.meta.cadanganUpdate;
      $('#cadDl').onclick = () =>
        downloadFile(
          'salinan-sebelum-pembaruan-' + dkey(c.waktu) + '.json',
          JSON.stringify(c.data),
          'application/json'
        );
      $('#cadBack').onclick = async () => {
        if (
          !(await confirmBox(
            `Kembalikan SEMUA data ke keadaan ${tglJam(c.waktu)}? Transaksi setelah waktu itu akan hilang.`,
            'Kembalikan',
            true
          ))
        )
          return;
        const o = JSON.parse(JSON.stringify(c.data));
        const sm = o.meta.find(x => x.id === 'settings');
        if (sm) sm.value.migrasi = { ...settings().migrasi }; // supaya perapian tidak jalan lagi
        await restore(o);
      };
    }
    $('#bauto').onclick = pickBackupFile;
    $('#bkU').onchange = async () => {
      settings().backupUnduh = $('#bkU').checked;
      await saveMeta('settings');
      siapkanBackupHarian();
      toast($('#bkU').checked ? 'Backup harian otomatis aktif ✔' : 'Backup harian otomatis dimatikan');
      render();
    };
    $('#bkIzin') && ($('#bkIzin').onclick = regrantBackup);
    $('#bdl').onclick = () => {
      downloadBackup();
      render();
    };
    $('#brs').onclick = () => $('#bfile').click();
    $('#bfile').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const o = JSON.parse(await f.text());
        if (
          !(await confirmBox(
            `Pulihkan backup tanggal ${tglJam(o.dibuat)}? Data di perangkat ini akan DIGANTI.`,
            'Pulihkan',
            true
          ))
        )
          return;
        await restore(o);
      } catch (err) {
        toast(err.message, true);
      }
    };
    $('#ifm').onclick = () => $('#ifile').click();
    $('#ifile').onchange = async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f) importFastmart(f);
    };
    $('#iex').onclick = exportProducts;
    $('#idf').onclick = async () => {
      const hasil = produkDariDaftarBarcode();
      if (!hasil.baru.length && !hasil.pasang.length)
        return toast('Semua barang di daftar barcode bawaan sudah ada di Produk 👍');
      if (
        !(await confirmBox(
          `Tambahkan ${hasil.baru.length} barang dari daftar barcode bawaan ke Produk? Barcode dan kategorinya sudah ada, harganya diisi saat barangnya di-scan.`,
          'Tambahkan'
        ))
      )
        return;
      const ubah = terapkanDaftarBarcode(hasil);
      await DB.putMany('products', ubah);
      markDirty();
      toast(`${hasil.baru.length} barang ditambahkan ✔ Lihat di Produk, filter "Dari daftar barcode".`);
      S._prodFilter = 'daftar';
      go('produk');
    };
    $('#wipe').onclick = () => {
      const m = modal(
        `<h3>Hapus semua data?</h3><p>Semua produk, penjualan, pelanggan dan utang di perangkat ini akan hilang. Ketik <b>HAPUS</b> untuk lanjut.</p><input id="wc" autofocus><div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn bad" id="wok">Hapus semua</button></div>`
      );
      $('#wok', m).onclick = async () => {
        if ($('#wc', m).value !== 'HAPUS') return toast('Ketik HAPUS', true);
        downloadBackup();
        for (const s of STORES) await DB.clear(s);
        location.reload();
      };
    };
  },

  /* ---------- Tanya AI ---------- */
  ai(el) {
    el.innerHTML = scard(
      'cAi',
      '🤖 Tanya AI',
      'Asisten untuk bertanya soal penjualan, stok, dan utang. Butuh internet &amp; API key (Gemini, Claude, OpenAI, atau OpenRouter). API key disimpan hanya di perangkat ini.',
      aiReady()
        ? `<p style="margin-top:0"><span class="badge ok">aktif</span> ${esc(AI_PROVIDERS[aiConf().provider].nama)} · <span class="bc">${esc(aiConf().model)}</span></p>`
        : '<p class="muted" style="margin-top:0">Belum diatur.</p>',
      `<button class="btn pri" id="aiset2">${aiReady() ? 'Ubah pengaturan AI' : '⚙ Atur AI'}</button>`
    );
    $('#aiset2').onclick = aiKeyDialog;
  }
};
async function importFastmart(file) {
  let rows;
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  } catch (e) {
    return toast('File tidak bisa dibaca: ' + e.message, true);
  }
  const hi = rows.findIndex(r => r.some(c => String(c).trim().toUpperCase() === 'NAMA PRODUK'));
  if (hi < 0) return toast('Kolom "NAMA PRODUK" tidak ditemukan di file', true);
  const H = rows[hi].map(h => String(h).trim().toUpperCase());
  const col = n => H.indexOf(n);
  const hasBc = col('BARCODE') >= 0 || col('SKU') >= 0;
  const m =
    modal(`<h3>Import dari ${esc(file.name)}</h3><p style="margin-top:0">Ditemukan <b>${rows.length - hi - 1}</b> baris produk${hasBc ? ' <b>beserta barcode</b>' : ''}.</p>
    <label><input type="checkbox" id="oNew" checked> Tambahkan produk yang belum ada</label>
    ${hasBc ? '<label><input type="checkbox" id="oBc" checked> Isi barcode produk dari file</label>' : ''}
    <label><input type="checkbox" id="oPr"> Timpa harga produk lama dengan harga dari file</label>
    <p class="muted" style="font-size:13px">Biarkan kotak terakhir kosong kalau harga di aplikasi ini sudah pernah diubah, supaya tidak tertimpa harga lama dari Fastmart. Stok produk lama tidak pernah diubah oleh import.</p>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="oGo">Mulai import</button></div>`);
  $('#oGo', m).onclick = async () => {
    const opt = {
      add: $('#oNew', m).checked,
      bc: !!($('#oBc', m) && $('#oBc', m).checked),
      price: $('#oPr', m).checked
    };
    m.remove();
    try {
      await doImport(rows, hi, H, col, opt);
    } catch (e) {
      toast('Gagal import: ' + e.message, true);
    }
  };
}
async function doImport(rows, hi, H, col, opt) {
  const cId = col('PRODUCT ID'),
    cK = col('KATEGORI'),
    cN = col('NAMA PRODUK'),
    cA = col('NAMA ALIAS'),
    cS = col('STOCK'),
    cB = col('HARGA BELI'),
    cD = col('HARGA DEFAULT'),
    cW = col('WARUNG');
  const cBc = col('BARCODE') >= 0 ? col('BARCODE') : col('SKU'),
    cKl = col('KODE LAIN');
  const clean = v =>
    String(v ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  let add = 0,
    upd = 0,
    dup = 0,
    skip = 0,
    bcSet = 0,
    bcAlt = 0,
    bcClash = [],
    autoW = 0;
  const seen = new Set();
  const changed = new Map();
  const addAlt = (p, code) => {
    code = String(code).trim();
    if (!code || nbc(code) === nbc(p.barcode) || (p.barcode2 || []).some(b => nbc(b) === nbc(code)))
      return false;
    const o = findBarcode(code, true);
    if (o && o.id !== p.id) {
      bcClash.push(`${code} (${p.nama} ↔ ${o.nama})`);
      return false;
    }
    p.barcode2 = [...(p.barcode2 || []), code];
    return true;
  };
  for (const r of rows.slice(hi + 1)) {
    const namaAsli = clean(r[cN]);
    const nama = rapikanNama(namaAsli, cK >= 0 ? r[cK] : '');
    if (!nama) continue;
    const fid = cId >= 0 ? String(r[cId] || '').trim() : '';
    if (seen.has(nama)) {
      dup++;
      continue;
    }
    seen.add(nama);
    const al = cA >= 0 ? clean(r[cA]) : '';
    let p =
      S.products.find(x => fid && x.fastmartId === fid) ||
      S.products.find(x => x.nama === nama) ||
      S.products.find(x => x.namaLama && x.namaLama === namaAsli) ||
      (al && al !== nama ? S.products.find(x => x.nama === al || x.alias === al) : null);
    const isNew = !p;
    if (isNew && !opt.add) {
      skip++;
      continue;
    }
    if (!isNew && p.digabungKe) {
      skip++;
      continue;
    }
    if (isNew)
      p = { id: uid(), nama, harga: {}, stok: 0, minStok: 0, aktif: true, barcode: '', dibuat: Date.now() };
    p.nama = nama;
    if (fid) p.fastmartId = fid;
    if (al && al !== nama) p.alias = al;
    else p.alias = p.alias || '';
    // kategori: barang baru / yang belum rapi ditebak dari nama, kategori yang sudah diatur tidak ditimpa
    if (isNew || !p.kategori || !isKategoriStandar(p.kategori)) {
      const dariFile = cK >= 0 && r[cK] ? mapKategori(r[cK]) : '';
      if (isNew && p.kas === undefined && tebakMaterial({ nama, kategori: dariFile })) p.kas = 'material';
      const k = kategoriOtomatis({ ...p, kategori: dariFile }) || dariFile;
      if (k) p.kategori = k;
    }
    p.satuan = p.satuan || satuanFromName(nama);
    if (isNew || opt.price) {
      // harga di file = harga satuan asli (Fastmart). Kalau satuan dasar sudah diubah (misal RCG -> PCS), simpan ke satuan aslinya.
      const asal =
        !isNew && p.satuanAwal && p.satuanAwal !== p.satuan
          ? (p.units || []).find(u => u.nama === p.satuanAwal)
          : null;
      const tgt = asal || p;
      tgt.harga = tgt.harga || {};
      if (cB >= 0 && String(r[cB]).trim() !== '') tgt.hargaBeli = num(r[cB]);
      if (cD >= 0 && String(r[cD]).trim() !== '') tgt.harga.umum = num(r[cD]);
      if (cW >= 0 && num(r[cW])) {
        if (!S.meta.tiers.find(t => t.id === 'warung')) {
          S.meta.tiers.push({ id: 'warung', nama: 'Warung' });
          await saveMeta('tiers');
        }
        tgt.harga.warung = num(r[cW]);
        delete tgt.autoWarung;
      } else if (tgt.autoWarung) delete tgt.harga.warung; // hitung ulang dari harga baru

      if (isNew && cS >= 0) p.stok = num(r[cS]);
    }
    if (opt.bc) {
      const bc = cBc >= 0 ? String(r[cBc] ?? '').trim() : '';
      if (bc) {
        const o = findBarcode(bc, true);
        if (o && o.id !== p.id) bcClash.push(`${bc} (${p.nama} ↔ ${o.nama})`);
        else if (!p.barcode) {
          p.barcode = bc;
          bcSet++;
        } else if (addAlt(p, bc)) bcAlt++;
      }
      if (cKl >= 0)
        String(r[cKl] ?? '')
          .split(/[,;]/)
          .forEach(k => {
            if (addAlt(p, k)) bcAlt++;
          });
    }
    p.diubah = Date.now();
    autoW += isiHargaWarungKosong(p);
    if (p.kas === undefined && tebakMaterial(p)) p.kas = 'material'; // barang bangunan -> uang Material
    if (isNew) {
      S.products.push(p);
      add++;
    } else upd++;
    changed.set(p.id, p);
  }
  rapikanProduk().berubah.forEach(p => changed.set(p.id, p));
  await DB.putMany('products', [...changed.values()]);
  markDirty();
  const tanpa = S.products.filter(p => p.aktif !== false && !p.barcode).length;
  modal(`<h3>Import selesai ✔</h3><p>➕ <b>${add}</b> produk baru<br>🔄 <b>${upd}</b> produk diperbarui${opt.price ? '' : ' (harga lama tidak diubah)'}<br>
   ${opt.bc ? `🏷️ <b>${bcSet}</b> barcode diisi${bcAlt ? `, <b>${bcAlt}</b> kode tambahan disimpan` : ''}<br>` : ''}
   ${autoW ? `⚙ <b>${autoW}</b> harga warung kosong diisi otomatis (perlu dicek di menu Produk)<br>` : ''}
   ${dup ? `⏭️ ${dup} baris nama ganda dilewati<br>` : ''}${skip ? `⏭️ ${skip} produk baru tidak ditambahkan<br>` : ''}</p>
   ${bcClash.length ? `<div class="banner">⚠️ ${bcClash.length} barcode dilewati karena sudah dipakai produk lain:<br><span style="font-size:13px">${bcClash.slice(0, 8).map(esc).join('<br>')}${bcClash.length > 8 ? '<br>…' : ''}</span></div>` : ''}
   <p class="muted">Masih ada <b>${tanpa}</b> produk tanpa barcode. Untuk barang berbarcode pabrik: scan di kasir lalu pilih "Pasangkan". Untuk barang curah/kemasan sendiri: buat barcode toko di menu Produk lalu cetak labelnya.</p><div class="right"><button class="btn pri" data-close>OK</button></div>`);
}
function exportProducts() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      S.products.map(p => {
        const o = {
          Barcode: p.barcode || '',
          Kode: p.kode || '',
          Nama: p.nama,
          Alias: p.alias || '',
          Kategori: p.kategori || '',
          Satuan: p.satuan || '',
          HargaBeli: p.hargaBeli || 0
        };
        tiers().forEach(t => (o['Harga ' + t.nama] = (p.harga || {})[t.id] || ''));
        o.Stok = p.stok;
        o.Aktif = p.aktif !== false ? 'Ya' : 'Tidak';
        return o;
      })
    ),
    'Produk'
  );
  XLSX.writeFile(wb, 'produk-toko-mahyu-' + dkey(Date.now()) + '.xlsx');
}
function brand() {
  $('#brandName').innerHTML = esc(settings().nama) + '<small>Kasir</small>';
  document.title = 'Kasir ' + settings().nama;
}
