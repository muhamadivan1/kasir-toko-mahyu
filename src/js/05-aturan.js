/* ============ ATURAN TOKO: KATEGORI & HARGA WARUNG OTOMATIS ============
 * Aturan bisnis tanpa tampilan, dipakai oleh halaman Produk, Import, dan Pengaturan.
 */

/* ---- Kategori: penyatuan nama kategori (misal semua SIGARET ... menjadi ROKOK) ---- */
const DEF_CAT_RULES = [{ awalan: 'SIGARET', ke: 'ROKOK' }];
function catRules() {
  const st = settings();
  if (!Array.isArray(st.catRules)) st.catRules = DEF_CAT_RULES.map(r => ({ ...r }));
  return st.catRules;
}
/** Nama kategori setelah aturan penyatuan diterapkan, lalu diarahkan ke kategori standar kalau dikenali
 *  (dipakai juga saat import Fastmart, misal "SIGARET KRETEK MESIN" -> ROKOK, "SHAMPOO" -> SAMPO & PERAWATAN RAMBUT) */
function mapKategori(k) {
  k = String(k || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
  if (!k) return '';
  for (const r of catRules()) {
    if (r.sama ? k === r.sama : r.awalan && k.startsWith(r.awalan)) {
      k = r.ke;
      break;
    }
  }
  return kategoriStandar(k) || k;
}
/** Terapkan aturan kategori ke semua produk. Mengembalikan produk yang berubah. */
function terapkanAturanKategori() {
  const changed = [];
  for (const p of S.products) {
    const k = mapKategori(p.kategori);
    if (p.kategori && k !== p.kategori) {
      p.kategori = k;
      changed.push(p);
    }
  }
  return changed;
}

/* ---- Harga warung otomatis ----
 * Kalau harga warung kosong: harga warung = harga perorangan - selisih (default 500),
 * tetapi minimal untung `untungMin` (default 500) dari harga beli, dan tidak lebih mahal dari harga perorangan.
 * Harga yang diisi otomatis ditandai "perlu dicek" sampai pemilik menandainya benar.
 */
const DEF_AUTO_WARUNG = { aktif: true, selisih: 500, untungMin: 500 };
function autoWarung() {
  const st = settings();
  return withDefaults(st, 'autoWarung', DEF_AUTO_WARUNG);
}
function hasWarungTier() {
  return tiers().some(t => t.id === 'warung');
}
function hitungHargaWarung(umum, hargaBeli) {
  const A = autoWarung();
  umum = Number(umum) || 0;
  hargaBeli = Number(hargaBeli) || 0;
  if (!umum) return 0;
  let w = umum - (Number(A.selisih) || 0);
  if (hargaBeli > 0) w = Math.max(w, Math.ceil((hargaBeli + (Number(A.untungMin) || 0)) / 100) * 100);
  if (w <= 0) w = umum;
  return Math.min(w, umum);
}
/* ---- Harga beli perkiraan ----
 * Barang yang belum punya harga beli (modal) diberi perkiraan: harga warung - 500.
 * Disimpan sebagai p.hargaBeli, dan p.hbKira menyimpan angka perkiraannya. Selama p.hargaBeli === p.hbKira,
 * harga beli itu dianggap perkiraan: ikut berubah kalau harga warung diubah, dan tidak dipakai untuk menghitung
 * harga warung otomatis. Begitu harga beli diisi sendiri (form, barang masuk, import), angkanya jadi harga asli. */
const SELISIH_MODAL_KIRA = 500;
const hbPerkiraan = p => !!p && Number(p.hbKira) > 0 && Number(p.hbKira) === Number(p.hargaBeli);
/** harga beli yang benar-benar diisi (0 kalau kosong atau masih perkiraan) */
const hbAsli = p => (hbPerkiraan(p) ? 0 : Number(p && p.hargaBeli) || 0);
function hitungHbKira(p) {
  const h = (p && p.harga) || {};
  const w = Number(h.warung) || Number(h.umum) || 0;
  return w - SELISIH_MODAL_KIRA > 0 ? w - SELISIH_MODAL_KIRA : 0;
}
/** Isi harga beli kosong dengan perkiraan (harga warung - 500). true kalau harga beli berubah. */
function isiHargaBeliKosong(p) {
  if (!p || p.dariDaftar) return false;
  const lama = Number(p.hargaBeli) || 0;
  if (lama && !hbPerkiraan(p)) {
    delete p.hbKira; // harga beli asli
    return false;
  }
  const kira = hitungHbKira(p);
  if (kira) {
    p.hargaBeli = kira;
    p.hbKira = kira;
  } else {
    if (hbPerkiraan(p)) p.hargaBeli = 0;
    delete p.hbKira;
  }
  return (Number(p.hargaBeli) || 0) !== lama;
}
/** Isi harga warung yang masih kosong (satuan dasar & satuan lain). Mengembalikan jumlah harga yang diisi. */
function isiHargaWarungKosong(p) {
  if (!p || !autoWarung().aktif || !hasWarungTier()) return 0;
  let n = 0;
  p.harga = p.harga || {};
  if (!Number(p.harga.warung) && Number(p.harga.umum)) {
    p.harga.warung = hitungHargaWarung(p.harga.umum, hbAsli(p));
    p.autoWarung = true;
    n++;
  }
  for (const u of p.units || []) {
    u.harga = u.harga || {};
    if (!Number(u.harga.warung) && Number(u.harga.umum)) {
      u.harga.warung = hitungHargaWarung(
        u.harga.umum,
        Number(u.hargaBeli) || (hbPerkiraan(p) ? 0 : hbUnit(p, u.nama))
      );
      u.autoWarung = true;
      n++;
    }
  }
  return n;
}
function perluCekWarung(p) {
  return !!(p.autoWarung || (p.units || []).some(u => u.autoWarung));
}
function tandaiWarungBenar(p, unitName) {
  if (!unitName || unitName === p.satuan) delete p.autoWarung;
  for (const u of p.units || []) if (!unitName || u.nama === unitName) delete u.autoWarung;
}

/* ---- Revisi harga 13 Okt 2026 ----
 * Harga yang dulu diinput di kolom perorangan sebenarnya harga WARUNG.
 * Untuk harga yang belum punya harga warung sendiri (kosong / masih hasil otomatis):
 *   harga warung = harga di kolom perorangan, harga perorangan = harga warung + selisih (500).
 * Harga warung yang lebih mahal dari harga perorangan (salah isi) ditukar.
 */
function revisiSatuHarga(h, otomatis, selisih) {
  const umum = Number(h.umum) || 0,
    warung = Number(h.warung) || 0;
  if (!umum) return false;
  if (!warung || otomatis) {
    h.warung = umum;
    h.umum = umum + selisih;
    return true;
  }
  if (warung > umum) {
    h.warung = umum;
    h.umum = warung;
    return true;
  }
  return false;
}
/** Terapkan revisi ke satu produk (satuan dasar & satuan lain). Mengembalikan jumlah harga yang diubah. */
function revisiHargaProduk(p) {
  if (!hasWarungTier()) return 0;
  const selisih = Number(autoWarung().selisih) || 500;
  p.harga = p.harga || {};
  let n = revisiSatuHarga(p.harga, p.autoWarung, selisih) ? 1 : 0;
  for (const u of p.units || []) {
    u.harga = u.harga || {};
    if (revisiSatuHarga(u.harga, u.autoWarung, selisih)) n++;
    delete u.autoWarung;
  }
  delete p.autoWarung;
  if (n) p.revisiHarga = 1;
  return n;
}

/* ---- Pembaruan data sekali jalan (dijalankan saat aplikasi dibuka) ---- */
const LANGKAH_MIGRASI = [
  'rokok',
  'warung',
  'revisi500',
  'rapiNama',
  'prioGula',
  'uangPisah',
  'menu29',
  'kategori29',
  'barcode29',
  'daftar1000',
  'telur30',
  'utang31',
  'supplier31',
  'cetak31',
  'satuanBpom3',
  'satuan4',
  'modal9',
  'oto15',
  'baca15'
];
/** Barcode dari "List barcode 1000 Product" (github.com/wpangestu/list-barcode-product-indonesia) untuk barang
 *  toko yang belum punya barcode. Hanya yang merek, varian, dan ukurannya sama dengan nama di daftar itu. */
const BARCODE_DARI_DAFTAR = {
  'SAMPOERNA MILD MENTHOL HIJAU 16': '8999909076006', // SAMPOERNA A MILD MENTHOL 16
  'DJI SAM SOE SUPER PREMIUM 12': '8999909957565', // DJI SAM SOE SUPER PERMIUM 12
  'MY BABY TELON OIL PLUS 90 ML PCS': '8999908284907', // MY BABY MINYAK TELON PLUS 90
  'MY BABY POWDER SWEET FLORAL 100 GR PCS': '8999908208200', // MY BABY POWDER FLORAL 100GR
  'MY BABY POWDER SWEET FLORAL 150 GR PCS': '8999908053909', // MY BABY SWEET FLORAL 150G
  'MY BABY POWDER 50 GR BIRU': '8999908042408', // MY BABY POWDER 50 GR
  'MY BABY POWDER SOFT & GENTLE 150 GR PCS': '8999908042507', // MY BABY POWDER 150G
  'OSKADON 4 TABET STRIIP': '8999908039309', // OSKADON O S KEPALA 4TAB
  'VIT C IPI RASA JERUK VITAMIN C 50 MG PCS': '8999908005205', // VITAMIN C IPI 50TAB
  'VIT B COMPLEX IPI /PCS': '8999908005106' // VITAMIN B IPI 50TAB
};
async function runMigrations() {
  const st = settings();
  st.migrasi = st.migrasi || {};
  // jaga-jaga: simpan salinan lengkap data sebelum pembaruan merapikan apa pun
  const baru = LANGKAH_MIGRASI.filter(k => !st.migrasi[k]);
  if (baru.length && S.products.length) {
    S.meta.cadanganUpdate = { waktu: Date.now(), langkah: baru, data: snapshot() };
    await DB.put('meta', { id: 'cadanganUpdate', value: S.meta.cadanganUpdate });
  }
  const notes = [];
  const touched = new Map();
  const uangSudahAda = !!st.migrasi.uangPisah;
  if (!st.migrasi.rokok) {
    const ch = terapkanAturanKategori();
    ch.forEach(p => touched.set(p.id, p));
    if (ch.length)
      notes.push(`<b>${ch.length}</b> produk kategori SIGARET disatukan menjadi kategori <b>ROKOK</b>.`);
    st.migrasi.rokok = 1;
  }
  if (!st.migrasi.revisi500) {
    let n = 0;
    for (const p of S.products) {
      if (revisiHargaProduk(p)) {
        n++;
        touched.set(p.id, p);
      }
    }
    if (n)
      notes.push(
        `<b>${n}</b> produk direvisi: harga yang dulu diisi di kolom perorangan sekarang menjadi <b>harga warung</b>, dan <b>harga perorangan = harga warung + ${rp(autoWarung().selisih)}</b>.`
      );
    st.migrasi.revisi500 = 1;
  }
  if (!st.migrasi.warung) {
    let n = 0;
    for (const p of S.products) {
      const k = isiHargaWarungKosong(p);
      if (k) {
        n += k;
        touched.set(p.id, p);
      }
    }
    if (n)
      notes.push(
        `<b>${n}</b> harga warung yang masih kosong sudah diisi otomatis (harga perorangan − ${rp(autoWarung().selisih)}, untung minimal ${rp(autoWarung().untungMin)} dari harga beli).`
      );
    st.migrasi.warung = 1;
  }
  if (!st.migrasi.rapiNama) {
    const r = rapikanProduk();
    r.berubah.forEach(p => touched.set(p.id, p));
    if (r.ganti)
      notes.push(
        `<b>${r.ganti}</b> nama produk dirapikan: nama rokok tanpa BKS/PCS (satuannya tetap BKS), dan kata ANEKA dihapus.`
      );
    if (r.gabung)
      notes.push(
        `<b>${r.gabung}</b> rokok versi SLOP digabung ke produk bungkusnya sebagai satuan <b>SLOP</b> (1 SLOP = 10 BKS).`
      );
    st.migrasi.rapiNama = 1;
  }
  if (!st.migrasi.prioGula) {
    const K = prioritasConf().kata;
    ['beras', 'ketan', 'gula'].forEach(k => K.includes(k) || K.unshift(k));
    st.migrasi.prioGula = 1;
  }
  if (!st.migrasi.uangPisah) {
    // 22 Okt 2026: uang dipisah (Warung, BRILink, Material). Barang bangunan dikenali dari nama/kategori.
    let n = 0;
    for (const p of S.products) {
      if (p.kas === undefined && tebakMaterial(p)) {
        p.kas = 'material';
        n++;
        touched.set(p.id, p);
      }
    }
    if (S.products.length) {
      notes.push(
        `💰 <b>Uang sekarang dipisah</b>: Warung (barang warung + PojokBayar), BRILink, dan Material. Buka menu <b>💰 Uang</b> untuk buka/tutup kasir, catat pengeluaran, dan lihat laba bersih. <button class="btn sm ghost" data-note="uang">💰 Lihat</button>`
      );
      notes.push(
        `📲 Pulsa, paket data, token & tagihan listrik, e-wallet, tarik tunai, dan transfer BRILink bisa dicatat langsung di kasir (tombol <b>📲 PojokBayar</b> / <b>🏦 BRILink</b> atau tombol F8), sekalian dengan belanja barang.`
      );
      notes.push(
        n
          ? `🧱 <b>${n}</b> barang dikenali sebagai barang toko material, uangnya masuk ke laci Material. <button class="btn sm pri" data-note="material">Periksa daftarnya</button>`
          : `🧱 Tandai barang toko material (semen, pasir, dll) supaya uangnya masuk ke laci Material. <button class="btn sm pri" data-note="material">Pilih barang material</button>`
      );
      notes.push(
        '🛒 <b>Daftar kulakan</b> otomatis ada di menu Stok: jumlah belinya dihitung dari penjualan.'
      );
    }
    st.migrasi.uangPisah = 1;
  }
  if (!st.migrasi.menu29) {
    // 29 Okt 2026: menu layanan mengikuti aplikasi PojokBayar & BRILink, nama barang otomatis dari barcode
    if (S.products.length) {
      if (uangSudahAda)
        notes.push(
          `📲 Menu <b>PojokBayar</b> dan <b>🏦 BRILink</b> di kasir sekarang sama dengan menu di aplikasinya (Pulsa, Data, Listrik, PDAM, Tarik Tunai BRI, Transfer Bank Lain, BRIVA, BPJS, dll). Tekan tombolnya di samping keranjang.`
        );
      notes.push(
        `🔎 Scan barang yang <b>belum terdaftar</b>: namanya dicari otomatis (daftar barcode bawaan + internet), jadi tinggal isi harga lalu Enter.`
      );
    }
    st.migrasi.menu29 = 1;
  }
  if (!st.migrasi.kategori29) {
    // 29 Okt 2026: kategori disederhanakan jadi kategori warung yang jelas, semua barang dipilah dari namanya
    const aktif = () => S.products.filter(p => p.aktif !== false);
    const sebelum = new Set(
      aktif()
        .map(p => p.kategori)
        .filter(Boolean)
    ).size;
    const ch = rapikanKategori(S.products, true);
    ch.forEach(p => touched.set(p.id, p));
    // aturan penyatuan buatan sendiri ikut diarahkan ke kategori baru
    for (const r of catRules()) r.ke = kategoriStandar(r.ke) || r.ke;
    // tanda "harga direvisi 13 Okt" sudah tidak dipakai lagi
    for (const p of S.products)
      if (p.revisiHarga) {
        delete p.revisiHarga;
        touched.set(p.id, p);
      }
    if (ch.length) {
      const sesudah = new Set(
        aktif()
          .map(p => p.kategori)
          .filter(Boolean)
      ).size;
      const nLain = aktif().filter(p => p.kategori === KAT_LAIN).length;
      notes.push(
        `🗂️ <b>Kategori barang dirapikan</b>: dari ${sebelum} kategori menjadi ${sesudah} kategori yang jelas (Sembako, Mie, Bumbu Dapur, Snack, Kopi, Minuman, Susu, Rokok, Obat, Sabun, dll). <b>${ch.length}</b> barang dipindah ke kategori yang sesuai dengan namanya.${nLain ? ` Ada <b>${nLain}</b> barang yang jenisnya belum jelas, sementara di LAIN-LAIN. <button class="btn sm pri" data-note="kategori">Periksa</button>` : ''}`
      );
      notes.push(
        '🔎 Pilihan <b>filter di halaman Produk</b> diperbarui: ada jumlahnya, barang paling laku dan tidak laku 30 hari, dan barang yang belum ada kategorinya.'
      );
    }
    st.migrasi.kategori29 = 1;
  }
  if (!st.migrasi.barcode29) {
    // 29 Okt 2026: barcode yang cocok dari daftar barcode GitHub dipasang ke barang yang belum punya barcode
    const dapat = [];
    for (const [nama, kode] of Object.entries(BARCODE_DARI_DAFTAR)) {
      const p = S.products.find(x => x.aktif !== false && x.nama === nama);
      if (!p || p.barcode || findBarcode(kode, true)) continue;
      p.barcode = kode;
      dapat.push(p);
      touched.set(p.id, p);
    }
    if (dapat.length)
      notes.push(
        `🏷️ <b>${dapat.length}</b> barang yang belum punya barcode sekarang sudah punya, diambil dari daftar barcode bawaan (My Baby, Sampoerna Mild Menthol 16, Dji Sam Soe Super Premium, Oskadon, Vitamin IPI). Kalau saat di-scan malah muncul "Barcode belum terdaftar", buka bagian <b>Pasangkan barcode ini</b> lalu pilih barangnya.`
      );
    st.migrasi.barcode29 = 1;
  }
  if (!st.migrasi.daftar1000) {
    // 29 Okt 2026: semua barang di daftar barcode bawaan yang belum ada di toko ditambahkan sebagai produk tanpa harga
    // (instal baru tanpa data dilewati, bisa ditambahkan nanti dari Pengaturan > Data & Backup)
    const hasil = S.products.length ? produkDariDaftarBarcode() : { baru: [], pasang: [] };
    const baru = hasil.baru;
    terapkanDaftarBarcode(hasil).forEach(p => touched.set(p.id, p));
    if (baru.length)
      notes.push(
        `📥 <b>${baru.length}</b> barang dari daftar barcode (Domestos, Walls, Rinso, Lux, Molto, Sunlight, dll) ditambahkan ke Produk, lengkap dengan barcode dan kategorinya, tapi <b>belum ada harganya</b>. Saat di-scan di kasir, isi harganya sekali sambil cek apakah namanya sesuai dengan barangnya. <button class="btn sm ghost" data-note="daftar">Lihat daftarnya</button>`
      );
    st.migrasi.daftar1000 = 1;
  }
  if (!st.migrasi.telur30) {
    // 30 Okt 2026: telur termasuk barang yang sering dibeli
    const K = prioritasConf().kata;
    if (!K.includes('telur')) K.splice(Math.max(0, K.indexOf('beras') + 1), 0, 'telur');
    if (S.products.length)
      notes.push(
        '⌨️ <b>Tombol pintas baru</b>: F10 = kosongkan keranjang, F3 = ganti harga Umum/Warung, F1 = daftar semua tombol pintas. <b>Telur</b> sekarang ikut barang yang sering dibeli, dan bisa dicari dengan mengetik "telor" atau "endog". Uang pembeli kurang? Tetap bisa diselesaikan, struknya bertulisan KURANG.'
      );
    st.migrasi.telur30 = 1;
  }
  if (!st.migrasi.utang31) {
    // 31 Okt 2026: utang lama dibayar sekalian belanja, catat utang dari buku, label harga rak, QR hemat kertas
    if (S.products.length) {
      notes.push(
        '📒 <b>Utang lama</b>: pembeli ingat masih punya utang? Di kasir tekan <b>📒 Tambah utang lama</b>, jumlahnya ikut masuk total (misal belanja 95.000 + utang 5.000 = 100.000). Catatan utang dari buku bisa dipindah ke menu <b>Pelanggan → 📒 Catat utang</b>.'
      );
      notes.push(
        '🏷️ <b>Label harga rak</b> seperti di supermarket: Produk → centang barangnya → 🏷️ Cetak label → Label harga rak. Filter <b>Harga berubah 7 hari</b> membantu cetak ulang label yang harganya baru diganti.'
      );
      notes.push(
        '🧾 Struk tidak memakai QR lagi kalau uang bayarnya diisi (hemat kertas). Uang kurang statusnya <b>BELUM LUNAS</b>. Kotak harga dan uang sekarang hanya bisa diisi angka.'
      );
    }
    st.migrasi.utang31 = 1;
  }
  if (!st.migrasi.supplier31) {
    // 31 Okt 2026 (bagian 3): supplier & sales, utang toko, tagih utang lewat WA
    if (S.products.length) {
      notes.push(
        '🚚 Menu baru <b>Supplier</b>: catat sales dan jadwal datangnya, <b>utang toko ke supplier</b> (jatuh tempo + bayar dari laci), dan pesanan ke sales (kapan barang datang). Pengingatnya muncul di Beranda.'
      );
      notes.push(
        '💬 <b>Tagih utang lewat WhatsApp</b>: menu Pelanggan, tombol 💬 Tagih. Pesan tagihan sudah jadi (rincian + total), tinggal tekan Kirim di WhatsApp.'
      );
      notes.push(
        '📥 Barang masuk sekarang bisa dicatat sebagai <b>Utang ke supplier (bayar nanti)</b>. Tombol samping kasir dirapikan jadi 2 kolom sama lebar.'
      );
    }
    st.migrasi.supplier31 = 1;
  }
  if (!st.migrasi.cetak31) {
    // 31 Okt 2026 (bagian 4): semua transaksi bisa selesai & dicetak walau uangnya kurang
    if (S.products.length)
      notes.push(
        '🧾 <b>Semua transaksi bisa dicetak walau uangnya kurang</b>, termasuk belanja + bayar utang lama dan BRILink. Uang yang diterima melunasi utang lama dulu, kekurangannya jadi utang baru, dan struk menulis <b>SISA UTANG</b>. Bayar utang di menu Pelanggan sekarang ada <b>bukti bayar</b> yang bisa dicetak.'
      );
    st.migrasi.cetak31 = 1;
  }
  if (!st.migrasi.satuanBpom3) {
    // 3 Nov 2026: ganti satuan yang salah langsung dari keranjang, QR BPOM tidak ikut terbaca
    if (S.products.length) {
      notes.push(
        '✏️ <b>Satuan salah pilih?</b> Di keranjang kasir buka daftar satuannya, pilih <b>✏️ Ganti satuan</b>, lalu pilih yang benar (misal <b>RCG</b>). Harga dan stok tetap, hanya tulisan satuannya yang diganti. Riwayat penjualan barang itu ikut memakai satuan baru.'
      );
      notes.push(
        '⛔ <b>QR BPOM tidak lagi masuk ke kasir.</b> Kalau yang terscan QR BPOM (tulisan MD / ML + angka), kasir berbunyi dua kali, kolom scan berkedip merah, dan tidak ada barang yang masuk. Scan barcode garis-garis di kemasan.'
      );
    }
    st.migrasi.satuanBpom3 = 1;
  }
  if (!st.migrasi.satuan4) {
    // 4 Nov 2026: isi satuan yang benar. Renceng minuman sachet = 10 PCS, setengah renceng = 5 PCS.
    // Barang yang satuan dasarnya terlanjur jadi SETENGAH (1 PCS = 2 SETENGAH, 1 RCG = 20 SETENGAH) dibetulkan.
    const beres = [];
    for (const p of S.products) {
      const r = rencanaSatuan(p);
      if (!r) continue;
      const sebelum = teksIsiSatuan(p);
      await aturUlangSatuan(p, r.B, r.isi, r.k);
      beres.push(
        `<b>${esc(p.nama)}</b>: ${esc(teksIsiSatuan(p))} <span class="muted">(sebelumnya ${esc(sebelum)})</span>`
      );
    }
    if (beres.length)
      notes.push(
        `⚖️ <b>Isi satuan ${beres.length} barang dibetulkan</b>. Stok dan riwayat penjualannya ikut dihitung ulang:<ul style="margin:4px 0">${beres
          .slice(0, 15)
          .map(x => `<li>${x}</li>`)
          .join(
            ''
          )}${beres.length > 15 ? `<li>dan ${beres.length - 15} barang lain</li>` : ''}</ul>Sebaiknya stok barang ini dihitung sekali lagi di rak (menu Stok → ✅ Hitung ulang stok).`
      );
    if (S.products.length)
      notes.push(
        '🔽 <b>Pilihan satuan di keranjang</b> sekarang selalu berupa daftar dengan dua pilihan: <b>✏️ Ganti satuan</b> (salah pilih, misal PCS harusnya RCG) dan <b>➕ Tambah satuan</b> (satuan lain yang isinya beda, misal 1 RCG = 10 PCS atau 1 RCG = 2 SETENGAH). Waktu menambah satuan, hitungannya langsung ditulis, misal "Artinya: 1 SETENGAH = 5 PCS".'
      );
    st.migrasi.satuan4 = 1;
  }
  if (!st.migrasi.modal9) {
    // 9 Nov 2026: harga beli kosong diisi perkiraan (harga warung - 500), laba transaksi lama ikut dihitung ulang
    const diisi = new Set(),
      murah = [];
    for (const p of S.products) {
      if (p.dariDaftar || Number(p.hargaBeli)) continue;
      if (isiHargaBeliKosong(p)) {
        diisi.add(p.id);
        touched.set(p.id, p);
      } else if (p.aktif !== false && priceOf(p, 'umum')) murah.push(p);
    }
    let nItem = 0;
    for (const s of S.sales) {
      let u = false;
      for (const it of s.items || []) {
        if (it.manual || it.layanan || Number(it.hargaBeli) || !diisi.has(it.productId)) continue;
        const p = S.products.find(x => x.id === it.productId);
        const un = (p.units || []).find(x => x.nama === it.satuan);
        it.hargaBeli =
          un && Number(un.hargaBeli)
            ? Number(un.hargaBeli)
            : Math.round(p.hargaBeli * qtyDasar(p, { qty: 1, isi: it.isi, dasar: it.dasar }));
        it.hbKira = true;
        u = true;
        nItem++;
      }
      if (u) await DB.put('sales', s);
    }
    if (diisi.size)
      notes.push(
        `💰 <b>${diisi.size}</b> barang yang belum ada harga belinya sekarang diisi <b>perkiraan: harga warung − ${rp(SELISIH_MODAL_KIRA)}</b> (misal harga warung 5.000, harga beli 4.500). Laba transaksi yang sudah lewat untuk barang-barang ini (${nItem} baris) ikut dihitung ulang. Kalau tahu harga beli aslinya, isi di form produk atau saat Barang masuk, perkiraannya otomatis diganti.${
          murah.length
            ? ` <b>${murah.length}</b> barang harga warungnya ${rp(SELISIH_MODAL_KIRA)} atau kurang (misal ${murah
                .slice(0, 3)
                .map(p => esc(p.nama))
                .join(', ')}), harga belinya perlu diisi sendiri.`
            : ''
        }`
      );
    if (S.products.length) {
      notes.push(
        '🔎 <b>Salah ketik tetap ketemu</b>: di kasir, ketik "indomi gorng" atau "sampurna mild" tetap muncul barangnya di bagian <b>Mungkin maksudnya</b>, dan tetap ada pilihan <b>➕ Tambah produk baru</b> (bisa dipilih dengan panah ↓ lalu Enter).'
      );
      notes.push(
        '⛔ Kolom <b>nama pembeli</b> tidak bisa lagi kemasukan barcode atau QR BPOM yang terscan tidak sengaja. Nama yang sedang diketik tetap utuh. Kartu member tetap bisa di-scan.'
      );
    }
    st.migrasi.modal9 = 1;
  }
  if (!st.migrasi.oto15) {
    // 15 Nov 2026: buka & tutup kasir otomatis, backup harian tanpa klik, warna menu lebih jelas
    if (S.products.length) {
      notes.push(
        '⏰ <b>Buka dan tutup kasir sekarang otomatis</b>: buka jam <b>05.00</b>, tutup jam <b>21.00</b> setiap hari. Tidak ada lagi tombol yang harus ditekan saat aplikasi dibuka. Jamnya bisa diganti di Pengaturan → Uang.'
      );
      notes.push(
        '💾 <b>Backup otomatis tanpa klik</b>: sekali sehari file backup tersimpan sendiri di folder <b>Download</b>. Spanduk "Aktifkan backup" tidak muncul lagi.'
      );
      notes.push(
        '🎨 Menu yang sedang dibuka sekarang <b>putih dengan tulisan merah</b> (warna logo toko). Menu yang sedang ditunjuk mouse berwarna <b>merah</b>, dan tombol yang ditunjuk diberi bingkai merah, artinya itu yang akan ditekan.'
      );
    }
    st.migrasi.oto15 = 1;
  }
  if (!st.migrasi.baca15) {
    if (S.products.length)
      notes.push(
        '🔊 <b>Suara membacakan</b>: kasir bisa membacakan total belanja dan kembaliannya. Nyalakan atau matikan dengan tombol <b>🔇 / 🔊</b> di samping tombol 🎤 di halaman Kasir. Awalnya <b>mati</b>.'
      );
    st.migrasi.baca15 = 1;
  }
  if (touched.size) await DB.putMany('products', [...touched.values()]);
  await saveMeta('settings');
  return notes;
}

/* ---- Barang prioritas (sering dibeli rumah tangga) ----
 * Barang yang cocok dengan kata kunci (nama, alias, atau kategori) tampil paling atas saat dicari.
 * Semakin banyak kata kunci yang cocok, semakin atas (misal "kopi" + "good day").
 * Per produk bisa dipaksa: p.prioritas = true (selalu) atau false (tidak pernah).
 */
const DEF_PRIORITAS = {
  aktif: true,
  kata: [
    'gula',
    'ketan',
    'terigu',
    'aci',
    'tapioka',
    'minyak goreng',
    'beras',
    'telur',
    'rokok',
    'kopi',
    'mix',
    'coffeemix',
    'good day',
    'fresco',
    'luwak'
  ]
};
function prioritasConf() {
  return withDefaults(settings(), 'prioritas', DEF_PRIORITAS);
}
let _prioRegex = { key: '', list: [] };
function prioritasRegex() {
  const kata = prioritasConf().kata || [];
  const key = kata.join('|');
  if (_prioRegex.key !== key) {
    const list = kata
      .map(k => String(k).trim().toLowerCase())
      .filter(Boolean)
      .map(k => ({
        kata: k,
        rx: new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)')
      }));
    _prioRegex = { key, list };
  }
  return _prioRegex.list;
}
/** Kata kunci prioritas yang cocok dengan produk ini */
function prioritasCocok(p) {
  const teks = [p.nama, p.alias, p.kategori].filter(Boolean).join(' ').toLowerCase();
  return prioritasRegex()
    .filter(x => x.rx.test(teks))
    .map(x => x.kata);
}
/** Kata kunci "jenis barang" (cocok dengan nama kategori, misal kopi, gula, rokok) dibedakan dari kata kunci
 *  merek/varian (good day, fresco, mix). Hanya merek/varian yang menaikkan barang di atas sejenisnya,
 *  supaya "TOP KOPI GULA AREN" tidak ikut naik hanya karena mengandung kata "gula". */
let _jenisCache = { key: '', set: new Set() };
/** Kata kunci bawaan yang selalu dianggap "jenis barang" (bukan merek), walau tidak sama dengan nama kategori */
const JENIS_BAWAAN = [
  'gula',
  'ketan',
  'terigu',
  'aci',
  'tapioka',
  'minyak goreng',
  'beras',
  'telur',
  'rokok',
  'kopi'
];
function kataJenisBarang() {
  const key =
    prioritasRegex()
      .map(x => x.kata)
      .join('|') +
    '#' +
    S.products.length;
  if (_jenisCache.key !== key) {
    const kat = [...new Set(S.products.map(p => String(p.kategori || '').toLowerCase()).filter(Boolean))];
    _jenisCache = {
      key,
      set: new Set(
        prioritasRegex()
          .filter(x => JENIS_BAWAAN.includes(x.kata) || kat.some(k => x.rx.test(k)))
          .map(x => x.kata)
      )
    };
  }
  return _jenisCache.set;
}
/** Jumlah kata kunci merek/varian yang cocok (untuk menaikkan Good Day, Fresco, dll di atas kopi lain) */
function prioritasEkstra(cocok) {
  const jenis = kataJenisBarang();
  return cocok.filter(k => !jenis.has(k)).length;
}
/** Kata yang dicari berhubungan dengan kata kunci: "gu" -> gula, "minyak" -> minyak goreng
 *  (huruf di tengah kata tidak dihitung, supaya "ig" tidak menaikkan "terigu") */
function cocokKataKunci(k, w) {
  return k.startsWith(w) || w.startsWith(k) || (w.length >= 4 && k.includes(w));
}
/** Nilai tambahan urutan pencarian.
 *  - kata yang dicari berhubungan dengan kata kunci prioritas (cari "minyak" -> "minyak goreng"): naik jauh
 *  - barang prioritas lain yang ikut cocok (cari "garam" -> rokok Gudang Garam): naik sedikit saja,
 *    supaya tidak mengalahkan barang yang namanya memang diawali kata itu (Garam Meja) */
function prioritasSkor(p, kataCari = []) {
  if (!prioritasConf().aktif || p.prioritas === false) return 0;
  const cocok = prioritasCocok(p);
  if (p.prioritas === true) return 30 + 5 * prioritasEkstra(cocok);
  if (!cocok.length) return 0;
  const nyambung = kataCari.some(w => w.length >= 2 && cocok.some(k => cocokKataKunci(k, w)));
  if (!nyambung) return 6;
  return 30 + 5 * prioritasEkstra(cocok);
}
function isPrioritas(p) {
  if (!prioritasConf().aktif || p.prioritas === false) return false;
  return p.prioritas === true || prioritasCocok(p).length > 0;
}

/* ---- Merapikan nama produk ----
 * Rokok: tanpa kata satuan di akhir (BKS / PCS / BATANG), tanpa awalan "ROKOK". Angka 12/16/20 (isi batang)
 *        tetap dipakai karena membedakan varian. Satuannya disimpan di kolom satuan (BKS), dan versi SLOP
 *        digabung sebagai satuan SLOP (1 SLOP = 10 BKS) dari produk yang sama.
 * Lainnya: awalan "ANEKA" dan kata "KEMASAN" dihapus.
 */
const NAMA_KHUSUS = {
  'ANEKA MINYAK GORENG KEMASAN CURAH': 'MINYAK GORENG CURAH 1 KG',
  'ANEKA TEPUNG ACI TAPIOKA KEMASAN 250 GR PCS': 'TEPUNG TAPIOKA ACI 250 GR',
  'ANEKA TEPUNG ACI TAPIOKA KEMASAN 1 KG PCS': 'TEPUNG TAPIOKA ACI 1 KG',
  'ANEKA KERUPUK KEMASAN PCK': 'KERUPUK UDANG MERAH'
};
const SATUAN_ROKOK_DI_NAMA = /\s+(BKS|PCS|PCK|BTG|BATANG)\.?$/;
const rapiSpasi = s =>
  String(s || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
function rapikanNama(nama, kategori) {
  let n = rapiSpasi(nama);
  if (NAMA_KHUSUS[n]) return NAMA_KHUSUS[n];
  if (/^ANEKA\s/.test(n))
    n = n
      .replace(/^ANEKA\s+/, '')
      .replace(/\bKEMASAN\b/g, '')
      .replace(/\bACI TAPIOKA\b/, 'TAPIOKA ACI')
      .replace(/\s+(PCS|PCK)$/, '');
  if (mapKategori(kategori) === 'ROKOK' && !/\s(SLOP|SLP)$/.test(n)) {
    n = n.replace(/^ROKOK\s+/, '');
    let lama;
    do {
      lama = n;
      n = n.replace(SATUAN_ROKOK_DI_NAMA, '');
    } while (n !== lama);
  }
  return rapiSpasi(n);
}
function rapikanAlias(alias, nama, kategori) {
  let a = rapiSpasi(alias).replace(/\s*\(1 BKS\)$/, '');
  a = rapikanNama(a, kategori);
  return a === nama ? '' : a;
}
/** Rapikan semua produk (aman dijalankan berulang). Mengembalikan produk yang berubah + jumlahnya. */
function rapikanProduk() {
  const berubah = new Map();
  let ganti = 0,
    gabung = 0;
  const aktif = () => S.products.filter(p => p.aktif !== false && !p.digabungKe);
  for (const p of aktif()) {
    const baru = rapikanNama(p.nama, p.kategori);
    if (baru && baru !== p.nama && !aktif().some(x => x !== p && x.nama === baru)) {
      p.namaLama = p.namaLama || p.nama;
      p.nama = baru;
      ganti++;
      berubah.set(p.id, p);
    }
    if (p.alias) {
      const a = rapikanAlias(p.alias, p.nama, p.kategori);
      if (a !== p.alias) {
        p.alias = a;
        berubah.set(p.id, p);
      }
    }
    if (p.kategori === 'ROKOK' && !(p.units || []).length && ['PCS', 'PCK'].includes(p.satuan)) {
      p.satuan = 'BKS';
      berubah.set(p.id, p);
    }
  }
  // rokok versi SLOP digabung ke produk bungkusnya sebagai satuan SLOP
  for (const s of aktif().filter(p => p.kategori === 'ROKOK' && /\s(SLOP|SLP)$/.test(p.nama))) {
    const namaDasar = s.nama.replace(/\s+(SLOP|SLP)$/, '');
    const b = aktif().find(x => x !== s && x.kategori === 'ROKOK' && x.nama === namaDasar);
    if (!b || unitsOf(b).some(u => u.nama === 'SLOP')) continue;
    const rasio = priceOf(s, 'umum') / (priceOf(b, 'umum') || 1);
    if (!(rasio >= 7.5 && rasio <= 12.5)) continue;
    b.units = [
      ...(b.units || []),
      {
        nama: 'SLOP',
        isi: 10,
        harga: { ...(s.harga || {}) },
        hargaBeli: Number(s.hargaBeli) || 0,
        barcode: s.barcode || ''
      }
    ];
    b.barcode2 = [...new Set([...(b.barcode2 || []), ...(s.barcode2 || [])])];
    b.stok = r4((Number(b.stok) || 0) + (Number(s.stok) || 0) * 10);
    if (!b.unitScan) b.unitScan = b.satuan;
    Object.assign(s, { aktif: false, barcode: '', barcode2: [], digabungKe: b.id, diubah: Date.now() });
    b.diubah = Date.now();
    berubah.set(b.id, b);
    berubah.set(s.id, s);
    gabung++;
  }
  return { berubah: [...berubah.values()], ganti, gabung };
}
