/* ============ NAMA BARANG OTOMATIS DARI BARCODE ============
 * Barcode yang belum terdaftar dicari namanya, supaya pemilik toko tinggal isi harga:
 *   1. daftar barcode bawaan (src/data/barcode-indonesia.tsv, ikut tersimpan di aplikasi, jalan tanpa internet)
 *   2. internet, kalau ada sinyal: API Produk Indonesia, Open Food Facts, Open Beauty Facts, Open Products Facts
 * Hasilnya hanya nama (dan satuan). Harga tetap diisi sendiri. Setelah disimpan, barang itu jadi produk toko,
 * jadi scan berikutnya langsung masuk keranjang tanpa internet.
 */
let _barcodeLokal = null;
function barcodeLokal() {
  if (!_barcodeLokal) {
    _barcodeLokal = new Map();
    for (const line of String(window.BARCODE_LOKAL || '').split('\n')) {
      const i = line.indexOf('\t');
      if (i > 0) _barcodeLokal.set(nbc(line.slice(0, i)), line.slice(i + 1).trim());
    }
  }
  return _barcodeLokal;
}
function cariBarcodeLokal(code) {
  const n = barcodeLokal().get(nbc(code));
  return n ? { nama: n, sumber: 'daftar barcode bawaan' } : null;
}
/** Nama dari database luar dirapikan seperti nama produk toko: huruf besar, ukuran "85 GR", "200 ML" */
function rapikanNamaBarcode(n) {
  return String(n || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s*(G|GRAM|GRM|GR)\b\.?/g, '$1 GR')
    .replace(/(\d)\s*(ML|KG|L|LTR|LITER)\b\.?/g, '$1 $2')
    .trim()
    .slice(0, 90);
}
/** Kode 12 digit (UPC) dipanggil sebagai 13 digit di Open Food Facts */
const kode13 = c => (/^\d{12}$/.test(c) ? '0' + c : c);
function bacaOpenFacts(j) {
  if (!j || j.status !== 1 || !j.product) return null;
  const p = j.product;
  let nama = String(p.product_name_id || p.product_name || p.product_name_en || '').trim();
  if (!nama) return null;
  const merek = String(p.brands || '')
    .split(',')[0]
    .trim();
  if (merek && !nama.toLowerCase().includes(merek.toLowerCase())) nama = merek + ' ' + nama;
  const isi = String(p.quantity || '').trim();
  const rapat = s => s.toLowerCase().replace(/[\s.]/g, '');
  if (isi && isi.length <= 15 && !rapat(nama).includes(rapat(isi))) nama += ' ' + isi;
  return { nama: rapikanNamaBarcode(nama) };
}
const OPEN_FACTS_FIELDS = 'fields=product_name,product_name_id,product_name_en,brands,quantity';
const SUMBER_BARCODE = [
  {
    nama: 'API Produk Indonesia',
    url: c =>
      `https://api-products.alpha-projects.cloud/api/v1/products-barcode?barcode=${encodeURIComponent(c)}&generateBarcode=false`,
    baca: j => {
      const x = Array.isArray(j)
        ? j[0]
        : j && j.data && !j.name
          ? Array.isArray(j.data)
            ? j.data[0]
            : j.data
          : j;
      return x && x.name
        ? { nama: rapikanNamaBarcode(x.name), satuan: String(x.uom || '').toUpperCase() }
        : null;
    }
  },
  {
    nama: 'Open Food Facts',
    url: c => `https://world.openfoodfacts.org/api/v2/product/${kode13(c)}.json?${OPEN_FACTS_FIELDS}`,
    baca: bacaOpenFacts
  },
  {
    nama: 'Open Beauty Facts',
    url: c => `https://world.openbeautyfacts.org/api/v2/product/${kode13(c)}.json?${OPEN_FACTS_FIELDS}`,
    baca: bacaOpenFacts
  },
  {
    nama: 'Open Products Facts',
    url: c => `https://world.openproductsfacts.org/api/v2/product/${kode13(c)}.json?${OPEN_FACTS_FIELDS}`,
    baca: bacaOpenFacts
  }
];
async function ambilJSON(url, ms = 7000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } });
    return r.ok ? await r.json() : null;
  } finally {
    clearTimeout(t);
  }
}
function cariBarcodeAktif() {
  return settings().cariBarcode !== false;
}
/** Cari di semua sumber internet sekaligus. Hasil diambil dari sumber paling atas yang menemukan. */
function cariBarcodeOnline(code) {
  code = String(code || '').replace(/\D/g, '');
  if (!cariBarcodeAktif() || code.length < 8 || !navigator.onLine) return Promise.resolve(null);
  const hasil = new Array(SUMBER_BARCODE.length);
  return new Promise(resolve => {
    let selesai = false;
    const cek = () => {
      if (selesai) return;
      for (let i = 0; i < hasil.length; i++) {
        if (hasil[i] === undefined) return; // masih menunggu sumber yang lebih utama
        if (hasil[i]) {
          selesai = true;
          return resolve({ ...hasil[i], sumber: SUMBER_BARCODE[i].nama });
        }
      }
      selesai = true;
      resolve(null);
    };
    SUMBER_BARCODE.forEach((s, i) => {
      ambilJSON(s.url(code))
        .then(j => {
          try {
            hasil[i] = s.baca(j) || null;
          } catch (e) {
            hasil[i] = null;
          }
        })
        .catch(() => (hasil[i] = null))
        .finally(cek);
    });
  });
}
/** Daftar bawaan dulu (cepat, tanpa internet), lalu internet */
async function cariNamaBarcode(code) {
  return cariBarcodeLokal(code) || (await cariBarcodeOnline(code));
}
function linkGoogleBarcode(code) {
  return 'https://www.google.com/search?q=' + encodeURIComponent('barcode ' + code);
}
/** Tebakan kategori: dari nama barang (kopi, sabun, rokok, ...), kalau tidak dikenali ikut kategori
 *  produk toko yang namanya paling mirip */
function tebakKategori(nama) {
  const k = kategoriOtomatis({ nama });
  if (k) return k;
  const p = miripProduk(nama, 3).find(x => x.kategori && x.kategori !== KAT_LAIN);
  return p ? p.kategori : '';
}

/** Tambah barang baru dengan cepat: nama sudah terisi dari barcode, tinggal isi harga.
 * preset = { barcode, nama, satuan, sumber }. after(p) dipanggil setelah tersimpan. */
function tambahCepatDialog(preset, after) {
  const bc = String(preset.barcode || '').trim();
  const ada = bc && findBarcode(bc, true);
  if (ada) {
    toast(
      ada.aktif === false
        ? `Barcode ini milik produk nonaktif “${ada.nama}”. Aktifkan lagi di menu Produk.`
        : 'Barcode ini sudah dipakai: ' + ada.nama,
      true
    );
    return after && after(ada.aktif === false ? null : ada);
  }
  const nama = String(preset.nama || '').toUpperCase();
  const kat = tebakKategori(nama);
  const satuan = preset.satuan && /^[A-Z]{2,6}$/.test(preset.satuan) ? preset.satuan : satuanFromName(nama);
  const pakaiMaterial = uangConf().material !== false;
  let kasPilih = tebakMaterial({ nama, kategori: kat }) ? 'material' : 'warung';
  const m = modal(
    `<h3>➕ Barang baru</h3>
   <div class="foundbox ${nama ? '' : 'kosong'}">${bc ? `Barcode <b>${esc(bc)}</b>` : ''}${preset.sumber ? ` · nama dari <b>${esc(preset.sumber)}</b>, periksa sebentar` : nama ? '' : ' · nama belum ketemu, ketik sendiri'}</div>
   <label>Nama barang *</label><input id="fn" value="${esc(nama)}" autocomplete="off">
   <div class="grid3"><div><label>Harga beli (modal)</label><input id="fhb" inputmode="numeric" placeholder="boleh kosong"></div>
   ${tiers()
     .map(
       t =>
         `<div><label>Harga ${esc(t.nama)}${t.id === 'umum' ? ' *' : ''}</label><input data-bt="${t.id}" inputmode="numeric" class="${t.id === 'umum' ? 'bignum' : ''}" placeholder="${tierPlaceholder(t.id)}"></div>`
     )
     .join('')}</div><div id="fwHint" class="autohint"></div>
   <div class="grid3"><div><label>Satuan</label><select id="fs">${satuanOptions(satuan)}</select></div>
   <div><label>Kategori</label><select id="fk"><option value="">— pilih kategori —</option>${opsiKategori(kat)}<option value="__new">➕ Kategori baru…</option></select></div>
   <div><label>Stok sekarang</label><input id="fst" inputmode="decimal" value="0"></div></div>
   ${pakaiMaterial ? `<label>Uang penjualannya masuk ke</label><div class="kaspick">${['warung', 'material'].map(k => `<button type="button" data-fk="${k}" class="${k === kasPilih ? 'on' : ''}" style="--kc:${infoKas(k).warna}">${infoKas(k).ikon} Laci ${esc(infoKas(k).nama)}</button>`).join('')}</div>` : ''}
   <div class="row actbar"><button class="btn ghost" id="fFull">✏️ Isian lengkap…</button><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="fsave">💾 Simpan (Enter)</button></div>`,
    { wide: true }
  );
  selectOrNew($('#fk', m), 'Nama kategori baru:');
  selectOrNew($('#fs', m), 'Nama satuan baru (misal: RCG, DUS):');
  liveHargaFill(m, {});
  // kategori ikut ditebak dari nama yang diketik, sampai kategorinya dipilih sendiri
  let katManual = false;
  $('#fk', m).addEventListener('change', () => (katManual = true));
  $('#fn', m).addEventListener('input', () => {
    if (katManual) return;
    const k = tebakKategori($('#fn', m).value);
    if (k && [...$('#fk', m).options].some(o => o.value === k)) $('#fk', m).value = k;
  });
  $$('[data-fk]', m).forEach(
    b =>
      (b.onclick = () => {
        kasPilih = b.dataset.fk;
        $$('[data-fk]', m).forEach(x => x.classList.toggle('on', x === b));
      })
  );
  setTimeout(() => {
    const f = nama ? $('[data-bt=umum]', m) : $('#fn', m);
    f && f.focus();
  }, 40);
  // pencarian internet yang belum selesai: isi nama begitu ketemu (kalau belum diketik sendiri)
  preset.cari &&
    preset.cari.then(h => {
      if (!h || !m.isConnected || $('#fn', m).value.trim()) return;
      $('#fn', m).value = h.nama;
      $('.foundbox', m).innerHTML =
        `Barcode <b>${esc(bc)}</b> · nama dari <b>${esc(h.sumber)}</b>, periksa sebentar`;
      $('.foundbox', m).classList.remove('kosong');
      if (h.satuan && /^[A-Z]{2,6}$/.test(h.satuan) && $('#fs', m).value === 'PCS') {
        if (![...$('#fs', m).options].some(o => o.value === h.satuan))
          $('#fs', m).add(new Option(h.satuan, h.satuan), 0);
        $('#fs', m).value = h.satuan;
      }
      const k = tebakKategori(h.nama);
      if (k && !katManual && [...$('#fk', m).options].some(o => o.value === k)) $('#fk', m).value = k;
    });
  const simpan = async () => {
    const n = $('#fn', m).value.trim().toUpperCase();
    if (!n) {
      toast('Nama barang wajib diisi', true);
      return $('#fn', m).focus();
    }
    const harga = {};
    $$('[data-bt]', m).forEach(i => {
      const v = num(i.value);
      if (v) harga[i.dataset.bt] = v;
    });
    if (!harga.umum) {
      toast('Harga Umum / Perorangan wajib diisi', true);
      return $('[data-bt=umum]', m).focus();
    }
    const sat = $('#fs', m).value === '__new' ? 'PCS' : $('#fs', m).value || 'PCS';
    const p = {
      id: uid(),
      nama: n,
      alias: '',
      kategori: $('#fk', m).value === '__new' ? '' : $('#fk', m).value,
      satuan: sat,
      barcode: bc,
      harga,
      hargaBeli: num($('#fhb', m).value),
      stok: num($('#fst', m).value),
      minStok: 0,
      aktif: true,
      units: [],
      kas: pakaiMaterial ? kasPilih : 'warung',
      dibuat: Date.now(),
      hargaDiubah: Date.now(),
      diubah: Date.now()
    };
    await save('products', p);
    m.close();
    toast('Produk baru disimpan ✔');
    after && after(p);
  };
  $('#fsave', m).onclick = simpan;
  m.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT')
      return;
    e.preventDefault();
    simpan();
  });
  $('#fFull', m).onclick = () => {
    const n = $('#fn', m).value.trim().toUpperCase();
    m.remove();
    editProduct(null, { barcode: bc, nama: n, satuan: $('#fs', m).value || satuan }, after);
  };
}
/** Kotak "cari dulu": barang yang di-scan mungkin sudah ada di toko dengan nama lain (barcodenya belum ada).
 *  Langsung menampilkan barang toko yang namanya mirip, dan bisa diketik untuk mencari sendiri.
 *  opsi: { namaAwal, kecuali (id produk yang tidak ditampilkan), label tombol, pilih(p) }.
 *  Mengembalikan { inp, setNama(n) } untuk memperbarui saran saat nama barang baru ketemu. */
function cariSudahAda(el, { namaAwal = '', kecuali = '', label = 'Pakai ini', pilih }) {
  el.classList.add('cariada');
  el.innerHTML = `<label>🔎 Cari dulu, mungkin barangnya sudah ada (ketik nama)</label>
   <input class="caridulu" placeholder="ketik nama barang, misal: telur, lifebuoy merah…" autocomplete="off">
   <div class="carihasil"></div>`;
  const inp = $('input', el),
    out = $('.carihasil', el);
  const tampil = (list, judul, kosong) => {
    list = list.filter(p => p.id !== kecuali && p.aktif !== false).slice(0, 6);
    out.innerHTML = list.length
      ? `<div class="carijudul">${judul}</div>` +
        list
          .map(
            p =>
              `<div class="carirow"><div class="grow"><b>${esc(p.nama)}</b><div class="muted">${p.barcode ? 'barcode ' + esc(p.barcode) : 'belum ada barcode'} · ${priceOf(p, 'umum') ? 'Rp ' + rp(priceOf(p, 'umum')) : 'belum ada harga'}</div></div><button class="btn sm pri" type="button" data-pakai="${p.id}">${esc(label)}</button></div>`
          )
          .join('')
      : kosong
        ? `<div class="carijudul">${kosong}</div>`
        : '';
    $$('[data-pakai]', out).forEach(
      b => (b.onclick = () => pilih(S.products.find(x => x.id === b.dataset.pakai)))
    );
  };
  const awal = () =>
    namaAwal
      ? tampil(
          miripProduk(namaAwal, 8, p => !p.dariDaftar && p.id !== kecuali),
          'Barang toko yang namanya mirip. Kalau salah satunya sama, tekan tombolnya:'
        )
      : (out.innerHTML = '');
  inp.oninput = () => {
    const q = inp.value.trim();
    if (!q) return awal();
    // hasil pencarian biasa, ditambah nama yang mirip (salah ketik merek: lifebouy = lifebuoy)
    const hasil = searchProducts(q, 12);
    for (const p of miripProduk(q, 8, x => !x.dariDaftar)) if (!hasil.includes(p)) hasil.push(p);
    tampil(hasil, 'Hasil pencarian:', `Tidak ada barang “${esc(q)}” di toko. Berarti ini barang baru.`);
  };
  awal();
  return {
    inp,
    setNama(n) {
      namaAwal = n;
      if (!inp.value.trim()) awal();
    }
  };
}
/** Pindahkan semua barcode barang a ke barang b, lalu a disembunyikan (digabung ke b) */
async function gabungBarcodeKe(a, b) {
  for (const k of [a.barcode, ...(a.barcode2 || [])].filter(Boolean)) {
    if (!b.barcode) b.barcode = k;
    else if (b.barcode !== k && !(b.barcode2 || []).includes(k)) b.barcode2 = [...(b.barcode2 || []), k];
  }
  Object.assign(a, { aktif: false, barcode: '', barcode2: [], digabungKe: b.id, diubah: Date.now() });
  b.diubah = Date.now();
  await DB.putMany('products', [a, b]);
  markDirty();
}

/** Barang sudah terdaftar tapi belum ada harga jualnya (misal dari daftar barcode bawaan): cek namanya, isi harga,
 *  lalu barang langsung masuk keranjang. Supaya barang tidak pernah terjual Rp 0. after(p) setelah tersimpan. */
function isiHargaDialog(p, after) {
  const dariDaftar = !!p.dariDaftar;
  const satuanBisa = !(p.units || []).length;
  const m = modal(
    `<h3>🏷️ Harga barang ini belum diisi</h3>
   <div class="foundbox">${p.barcode ? `Barcode <b>${esc(p.barcode)}</b>` : 'Belum ada harga jual'}${dariDaftar ? ' · dari daftar barcode bawaan (data lama), <b>cek apakah namanya sama dengan barangnya</b>' : ''}</div>
   <div id="ihAda"></div>
   <label>Nama barang</label><input id="fn" value="${esc(p.nama)}" autocomplete="off">
   <div class="grid3"><div><label>Harga beli (modal)</label><input id="fhb" inputmode="numeric" placeholder="boleh kosong"></div>
   ${tiers()
     .map(
       t =>
         `<div><label>Harga ${esc(t.nama)}${t.id === 'umum' ? ' *' : ''}</label><input data-bt="${t.id}" inputmode="numeric" class="${t.id === 'umum' ? 'bignum' : ''}" placeholder="${tierPlaceholder(t.id)}"></div>`
     )
     .join('')}</div><div id="fwHint" class="autohint"></div>
   <div class="grid2"><div><label>Kategori</label><select id="fk"><option value="">— pilih kategori —</option>${opsiKategori(p.kategori)}<option value="__new">➕ Kategori baru…</option></select></div>
   ${satuanBisa ? `<div><label>Satuan</label><select id="fs">${satuanOptions(p.satuan || 'PCS')}</select></div>` : ''}</div>
   <div class="row actbar">${dariDaftar ? '<button class="btn ghost" id="fOff">🚫 Tidak dijual di toko</button>' : ''}<span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="fsave">💾 Simpan &amp; masukkan (Enter)</button></div>`,
    { wide: true }
  );
  // barang ini mungkin sudah ada di toko dengan nama lain: pakai barang itu, barcodenya dipindah ke sana
  cariSudahAda($('#ihAda', m), {
    namaAwal: p.nama,
    kecuali: p.id,
    label: 'Pakai ini',
    pilih: async t => {
      await gabungBarcodeKe(p, t);
      m.close();
      toast(`Barcode dipasangkan ke ${t.nama} ✔`);
      after && after(t);
    }
  });
  selectOrNew($('#fk', m), 'Nama kategori baru:');
  satuanBisa && selectOrNew($('#fs', m), 'Nama satuan baru (misal: RCG, DUS):');
  liveHargaFill(m, {});
  setTimeout(() => {
    const f = $('[data-bt=umum]', m);
    f && f.focus();
  }, 40);
  const simpan = async () => {
    const n = $('#fn', m).value.trim().toUpperCase();
    if (!n) {
      toast('Nama barang wajib diisi', true);
      return $('#fn', m).focus();
    }
    const harga = {};
    $$('[data-bt]', m).forEach(i => {
      const v = num(i.value);
      if (v) harga[i.dataset.bt] = v;
    });
    if (!harga.umum) {
      toast('Harga Umum / Perorangan wajib diisi', true);
      return $('[data-bt=umum]', m).focus();
    }
    p.nama = n;
    p.harga = { ...(p.harga || {}), ...harga };
    const hb = num($('#fhb', m).value);
    if (hb) p.hargaBeli = hb;
    const k = $('#fk', m).value;
    if (k && k !== '__new') p.kategori = k;
    const s = satuanBisa ? $('#fs', m).value : '';
    if (s && s !== '__new') p.satuan = s;
    delete p.dariDaftar; // sudah dicek pemilik toko
    p.hargaDiubah = Date.now();
    p.diubah = Date.now();
    await save('products', p);
    m.close();
    toast('Harga tersimpan ✔');
    after && after(p);
  };
  $('#fsave', m).onclick = simpan;
  m.addEventListener('keydown', e => {
    if (
      e.key !== 'Enter' ||
      e.isComposing ||
      e.target.tagName === 'BUTTON' ||
      e.target.tagName === 'SELECT' ||
      e.target.classList.contains('caridulu')
    )
      return;
    e.preventDefault();
    simpan();
  });
  $('#fOff', m) &&
    ($('#fOff', m).onclick = async () => {
      p.aktif = false;
      p.diubah = Date.now();
      await save('products', p);
      m.close();
      toast(`${p.nama} disembunyikan (nonaktif). Bisa diaktifkan lagi di Produk.`);
    });
}

/** Barang di daftar barcode bawaan yang belum ada di toko dijadikan produk tanpa harga (ditandai p.dariDaftar),
 *  supaya saat di-scan namanya sudah ada dan tinggal diisi harganya. Nama yang sama dengan barcode berbeda
 *  dijadikan satu produk (barcode lainnya jadi kode tambahan). Barang toko yang namanya persis sama
 *  hanya ditambah barcodenya. Tidak mengubah apa pun: hasilnya dipakai lewat terapkanDaftarBarcode(). */
function produkDariDaftarBarcode() {
  const ada = new Set();
  for (const p of S.products)
    for (const c of [p.barcode, ...(p.barcode2 || []), ...(p.units || []).map(u => u.barcode)])
      if (c) ada.add(nbc(c));
  const toko = new Map(S.products.filter(p => p.aktif !== false).map(p => [p.nama, p]));
  const byNama = new Map(),
    pasang = [];
  const now = Date.now();
  for (const line of String(window.BARCODE_LOKAL || '').split('\n')) {
    const i = line.indexOf('\t');
    if (i < 1) continue;
    const kode = line.slice(0, i).trim(),
      nama = katUp(line.slice(i + 1));
    if (!nama || ada.has(nbc(kode))) continue;
    ada.add(nbc(kode));
    const t = toko.get(nama);
    if (t) {
      pasang.push({ p: t, kode });
      continue;
    }
    const p = byNama.get(nama);
    if (p) {
      p.barcode2.push(kode);
      continue;
    }
    const kategori = kategoriOtomatis({ nama }) || KAT_LAIN;
    const s = satuanFromName(nama);
    byNama.set(nama, {
      id: uid(),
      nama,
      alias: '',
      kategori,
      satuan: kategori === 'ROKOK' ? (/\bSLOP\b/.test(nama) ? 'SLOP' : 'BKS') : s === 'KG' ? 'PCS' : s,
      barcode: kode,
      barcode2: [],
      harga: {},
      hargaBeli: 0,
      stok: 0,
      minStok: 0,
      aktif: true,
      units: [],
      dariDaftar: 1,
      diubah: now
    });
  }
  const baru = [...byNama.values()];
  baru.forEach(p => p.barcode2.length || delete p.barcode2);
  return { baru, pasang };
}
/** Masukkan hasil produkDariDaftarBarcode() ke data (belum disimpan ke database). Mengembalikan barang yang berubah. */
function terapkanDaftarBarcode({ baru, pasang }) {
  const ubah = new Set(baru);
  S.products.push(...baru);
  for (const { p, kode } of pasang) {
    if (!p.barcode) p.barcode = kode;
    else p.barcode2 = [...(p.barcode2 || []), kode];
    ubah.add(p);
  }
  return [...ubah];
}
/** Kotak status pencarian nama, dipakai di kasir & form produk */
function hasilCariHTML(h, code) {
  return h
    ? `✅ Ketemu: <b>${esc(h.nama)}</b> <span class="muted">(${esc(h.sumber)})</span>`
    : `❔ Nama barang untuk barcode ini belum ketemu${cariBarcodeAktif() && navigator.onLine ? '' : ' (pencarian internet mati / tidak ada sinyal)'}. Ketik namanya sendiri, atau <a href="${linkGoogleBarcode(code)}" target="_blank" rel="noopener">lihat di Google</a>.`;
}
