/* ============ UANG TERPISAH (KAS) ============
 * Uang toko dipisah menjadi tiga laci:
 *   🏪 Warung   : barang warung + layanan PojokBayar (pulsa, paket data, token, tagihan, e-wallet)
 *   🏦 BRILink  : tarik tunai, transfer / setor tunai, bayar lewat BRILink
 *   🧱 Material : barang toko material (semen, pasir, besi, cat, dll)
 * Ada juga dua saldo non-tunai: 📲 Saldo PojokBayar (deposit, bagian Warung) dan 💳 Rekening BRILink.
 * Catatan uang (buka/tutup kasir, pengeluaran, pindah uang, samakan saldo) disimpan di store 'kas'.
 * Penjualan tidak disalin ke store 'kas': pembagian uangnya dihitung dari isi transaksi (rincianSale).
 */
const KAS = [
  { id: 'warung', nama: 'Warung', ikon: '🏪', warna: '#0f766e' },
  { id: 'brilink', nama: 'BRILink', ikon: '🏦', warna: '#00529c' },
  { id: 'material', nama: 'Material', ikon: '🧱', warna: '#a14a14' }
];
const SALDO = [
  { id: 'pb', nama: 'Saldo PojokBayar', ikon: '📲', warna: '#0f766e', kas: 'warung' },
  { id: 'rek', nama: 'Rekening BRILink', ikon: '💳', warna: '#00529c', kas: 'brilink' }
];
const DEF_UANG = {
  brilink: true,
  material: true,
  ingatBuka: true,
  hariKulakan: 7,
  otomatis: true, // buka & tutup kasir otomatis sesuai jam toko, tanpa klik
  jamBuka: '05:00',
  jamTutup: '21:00'
};
function uangConf() {
  const o = withDefaults(settings(), 'uang', DEF_UANG);
  if (!o.tarif || typeof o.tarif !== 'object') o.tarif = {};
  return o;
}
/** Laci yang dipakai toko (Warung selalu ada) */
function kasAktif() {
  const c = uangConf();
  return KAS.filter(k => k.id === 'warung' || c[k.id] !== false);
}
function saldoAktif() {
  return SALDO.filter(x => kasAktif().some(k => k.id === x.kas));
}
function isLaci(id) {
  return KAS.some(k => k.id === id);
}
function infoKas(id) {
  return KAS.find(k => k.id === id) || SALDO.find(k => k.id === id) || KAS[0];
}
function namaKas(id) {
  const k = infoKas(id);
  return k.ikon + ' ' + k.nama;
}
function kasPill(id, teks) {
  const k = infoKas(id);
  return `<span class="kpill" style="--kc:${k.warna}">${k.ikon} ${esc(teks || k.nama)}</span>`;
}

/* ---- barang toko material ---- */
const RE_MATERIAL =
  /\b(SEMEN|BATAKO|BATA|HEBEL|PAKU|BESI|BAJA RINGAN|KAWAT|BENDRAT|WIREMESH|PIPA|PARALON|KERAMIK|GRANIT|GENTENG|ASBES|SPANDEK|GALVALUM|SENG|HOLLOW|TRIPLEK|MULTIPLEK|GYPSUM|KALSIBOARD|GRC|KASO|RENG|BALOK|KUSEN|DEMPUL|PLAMIR|THINNER|TINER|MENI|MORTAR|ACIAN|AQUAPROOF|NO DROP|SIKA|KLOSET|TALANG|TOREN|ELBOW|SEKRUP|ENGSEL|GERGAJI|CANGKUL|SEKOP|LINGGIS|AMPLAS|TIGA RODA|HOLCIM|DYNAMIX|AVIAN|DULUX|MOWILEX|RUCIKA|WAVIN|CAT (TEMBOK|KAYU|BESI|GENTENG|DASAR|MINYAK))\b|^PASIR\b/;
const RE_KAT_MATERIAL = /MATERIAL|BANGUNAN|SEMEN|BESI|KERAMIK|BAJA|PIPA|PERKAKAS/;
/** Tebakan dari nama / kategori: barang ini termasuk barang toko material? */
function tebakMaterial(p) {
  return (
    RE_MATERIAL.test(String(p.nama || '').toUpperCase()) ||
    RE_KAT_MATERIAL.test(String(p.kategori || '').toUpperCase())
  );
}
/** Uang hasil penjualan barang ini masuk ke laci mana */
function kasProduk(p) {
  return p && p.kas === 'material' && uangConf().material !== false ? 'material' : 'warung';
}

/* ---- layanan digital (PojokBayar & BRILink) ----
 * Daftar layanan ada di 07-layanan-menu.js (namanya sama dengan menu di aplikasi PojokBayar & BRILink Mobile).
 * Transaksinya tetap dikerjakan di aplikasi PojokBayar / mesin BRILink seperti biasa.
 * Di kasir hanya dicatat, supaya uangnya masuk ke laci yang benar dan untungnya terhitung.
 * admin = untung toko (biaya yang ditarik dari pelanggan).
 * biaya = untuk PojokBayar: selisih harga modal di atas nominal, untuk BRILink: potongan dari bank.
 * Arah uang BRILink: masuk (pelanggan bayar: transfer, setor, tagihan), keluar (tarik tunai), jasa (cek saldo, dll).
 */
function layananAktif() {
  const ks = kasAktif().map(k => k.id);
  return Object.keys(LAYANAN).filter(j => !LAYANAN[j].lama && ks.includes(LAYANAN[j].kas));
}
/** Tarif bawaan (bisa diubah di Pengaturan → Uang & Layanan) */
function tarifLayanan(j) {
  const t = uangConf().tarif[j] || {};
  return { admin: t.admin ?? LAYANAN[j].admin ?? 0, biaya: t.biaya ?? 0 };
}
/** Arah uang satu layanan BRILink: 'masuk', 'keluar', atau 'jasa' */
function arahLayanan(L, pilihan) {
  if (!L || L.kas !== 'brilink') return 'masuk';
  if (L.arah === 'pilih') return pilihan === 'masuk' ? 'masuk' : 'keluar';
  return L.arah || 'masuk';
}
function arahBaris(it) {
  const d = it.lyn || {};
  if (d.arah) return d.arah;
  return arahLayanan(
    LAYANAN[it.layanan] || { kas: kasBaris(it), arah: it.layanan === 'tarik' ? 'keluar' : 'masuk' }
  );
}
/** Baris keranjang untuk satu layanan.
 * d = { nominal, admin, biaya, modal, jual, tujuan, ket, paket, token, arah }
 * harga = uang dari pelanggan (tarik tunai negatif: uang keluar), harga - hargaBeli = untung toko. */
function barisLayanan(j, d, lama) {
  const L = LAYANAN[j];
  const N = Math.round(num(d.nominal)),
    A = Math.round(num(d.admin)),
    B = Math.round(num(d.biaya));
  const it = {
    productId: lama ? lama.productId : 'lyn-' + uid(),
    manual: true,
    layanan: j,
    kas: L.kas,
    satuan: '',
    qty: 1
  };
  const lyn = { nominal: N, tujuan: String(d.tujuan || '').trim(), ket: String(d.ket || '').trim() };
  if (L.kas === 'brilink') {
    const arah = arahLayanan(L, d.arah);
    Object.assign(lyn, { admin: A, biaya: B, arah });
    if (arah === 'keluar') {
      it.harga = -(N - A);
      it.hargaBeli = -N + B;
    } else if (arah === 'jasa') {
      lyn.nominal = 0;
      it.harga = A;
      it.hargaBeli = B;
    } else {
      it.harga = N + A;
      it.hargaBeli = N + B;
    }
  } else {
    const modal = Math.round(num(d.modal)),
      jual = Math.round(num(d.jual));
    Object.assign(lyn, {
      modal,
      jual,
      paket: String(d.paket || '').trim(),
      token: String(d.token || '')
        .replace(/\s+/g, ' ')
        .trim()
    });
    it.harga = jual;
    it.hargaBeli = modal;
  }
  if (L.token && d.token) lyn.token = String(d.token).replace(/\s+/g, ' ').trim();
  it.lyn = lyn;
  it.nama = namaLayanan(j, lyn);
  return it;
}
/** Nama baris di keranjang & struk, contoh "PULSA 10.000", "TARIK TUNAI BRI 500.000", "TAGIHAN BPJS KESEHATAN" */
function namaLayanan(j, d) {
  const L = LAYANAN[j] || { nama: 'Layanan' };
  const up = s => String(s || '').toUpperCase();
  let s = L.cart || up(L.nama);
  if (d.ket && L.pilihan) s += ' ' + up(d.ket);
  if (L.form === 'paket' && d.paket) s += ' ' + up(d.paket);
  if (L.form === 'nominal' && d.nominal) s += ' ' + rp(d.nominal);
  return s.trim();
}
/** Keterangan singkat satu baris layanan (nomor tujuan, tagihan, admin) */
function detailLayanan(it) {
  const d = it.lyn || {};
  const L = LAYANAN[it.layanan] || {};
  const arah = arahBaris(it);
  const a = [];
  if (d.tujuan)
    a.push((L.awalan ?? (arah === 'keluar' ? 'a.n. ' : L.kas === 'brilink' ? '' : 'No. ')) + d.tujuan);
  if (L.form === 'tagihan' && d.nominal) a.push(labelNominal(L, arah).toLowerCase() + ' ' + rp(d.nominal));
  if (L.kas === 'brilink') a.push((arah === 'jasa' ? 'biaya jasa ' : 'admin ') + rp(d.admin));
  return a.join(' · ');
}
/** Label kolom angka utama di form layanan */
function labelNominal(L, arah) {
  if (L.labelNom) return L.labelNom;
  if (arah === 'keluar') return 'Uang yang ditarik';
  return L.form === 'tagihan' ? 'Jumlah tagihan' : 'Nominal';
}
function labaBaris(it) {
  const q = Number(it.qty) || 0;
  if (it.layanan && kasBaris(it) === 'brilink') {
    const d = it.lyn || {};
    return (Number(d.admin) || 0) - (Number(d.biaya) || 0);
  }
  return ((Number(it.harga) || 0) - (Number(it.hargaBeli) || 0)) * q;
}

/* ---- pembagian satu transaksi ke tiap laci ---- */
function kasBaris(it) {
  if (it.kas && isLaci(it.kas)) return it.kas;
  if (it.layanan) return (LAYANAN[it.layanan] || {}).kas || 'warung';
  if (it.manual) return 'warung';
  return kasProduk(S.products.find(p => p.id === it.productId));
}
let _rinci = new WeakMap();
/** Dipanggil kalau pembagian barang ke laci berubah (misal barang dipindah ke Material) */
function lupakanRincian() {
  _rinci = new WeakMap();
}
/** Per laci: uang (dari pelanggan), jual (pendapatan), modal, laba, tunai, non (QRIS/transfer), utang.
 * BRILink: jual = admin, modal = potongan bank, setor/tarik = nominal.
 * pb / rek = perubahan Saldo PojokBayar / Rekening BRILink karena transaksi ini. */
function rincianSale(s) {
  if (_rinci.has(s)) return _rinci.get(s);
  const K = {};
  const g = k =>
    (K[k] = K[k] || {
      uang: 0,
      uangMasuk: 0,
      uangKeluar: 0,
      jual: 0,
      modal: 0,
      barang: 0,
      lynJual: 0,
      lynLaba: 0,
      nLyn: 0,
      tarik: 0,
      setor: 0,
      admin: 0,
      pot: 0,
      tunai: 0,
      non: 0,
      utang: 0,
      bayarUtang: 0,
      laba: 0,
      tanpaHB: false
    });
  let pb = 0,
    rek = 0;
  for (const it of s.items || []) {
    const k = kasBaris(it),
      r = g(k);
    const q = Number(it.qty) || 0,
      v = (Number(it.harga) || 0) * q,
      hb = (Number(it.hargaBeli) || 0) * q;
    r.uang += v;
    if (v >= 0) r.uangMasuk += v;
    else r.uangKeluar -= v;
    // utang lama yang dibayar sekalian belanja: uangnya masuk laci, tapi bukan penjualan
    if (it.utangLama) {
      r.bayarUtang += v;
      continue;
    }
    if (it.layanan) {
      const d = it.lyn || {};
      r.nLyn++;
      if (k === 'brilink') {
        const N = Number(d.nominal) || 0,
          A = Number(d.admin) || 0,
          B = Number(d.biaya) || 0;
        r.jual += A;
        r.modal += B;
        r.admin += A;
        const arah = arahBaris(it);
        if (arah === 'keluar') {
          r.tarik += N;
          rek += N - B;
        } else if (arah === 'jasa') rek -= B;
        else {
          r.setor += N;
          rek -= N + B;
        }
      } else {
        r.jual += v;
        r.modal += hb;
        r.lynJual += v;
        r.lynLaba += v - hb;
        pb -= hb;
      }
    } else {
      r.jual += v;
      r.modal += hb;
      r.barang += v;
      if (!it.manual && !Number(it.hargaBeli)) r.tanpaHB = true;
    }
  }
  // potongan (diskon + tukar poin) hanya mengurangi belanja, dibagi sebanding ke laci Warung / Material
  const dasar = Object.keys(K).filter(k => k !== 'brilink' && K[k].uang > 0);
  const totDasar = dasar.reduce((a, k) => a + K[k].uang, 0);
  let pot = Math.min(totDasar, (Number(s.diskon) || 0) + (Number(s.potonganPoin) || 0));
  if (pot > 0) {
    dasar.sort((a, b) => K[a].uang - K[b].uang);
    let sisa = pot;
    dasar.forEach((k, i) => {
      const x = i === dasar.length - 1 ? sisa : Math.round((pot * K[k].uang) / totDasar);
      K[k].pot = x;
      K[k].uang -= x;
      K[k].uangMasuk -= x;
      K[k].jual -= x;
      sisa -= x;
    });
  }
  // selisih pembulatan dari data lama masuk ke Warung
  const jumlah = Object.values(K).reduce((a, r) => a + r.uang, 0);
  if (s.total !== undefined && Math.round(jumlah) !== Math.round(s.total) && Object.keys(K).length) {
    const r = g(K.warung ? 'warung' : Object.keys(K)[0]);
    r.uang += s.total - jumlah;
  }
  // cara bayar: utang / uang kurang -> uang yang diterima dipakai untuk Warung dulu, sisanya Material
  if (s.metode === 'utang' || Number(s.kurang) > 0) {
    let dp = Number(s.bayar) || 0;
    for (const k of ['warung', 'material', 'brilink']) {
      if (!K[k]) continue;
      const x = Math.max(0, Math.min(dp, K[k].uang));
      K[k].tunai = x;
      K[k].utang = K[k].uang - x;
      dp -= x;
    }
  } else if (s.metode === 'qris' || s.metode === 'transfer') {
    for (const k in K) K[k].non = K[k].uang;
  } else {
    for (const k in K) K[k].tunai = K[k].uang;
  }
  for (const k in K) K[k].laba = K[k].jual - K[k].modal;
  const res = { kas: K, pb, rek };
  _rinci.set(s, res);
  return res;
}
/** Laci yang ikut dalam transaksi ini (urutan tetap) */
function kasDalamSale(s) {
  const K = rincianSale(s).kas;
  return KAS.map(k => k.id).filter(k => K[k]);
}
/** Penjualan Warung + Material dari satu transaksi (uang BRILink bukan penjualan) */
function penjualanSale(s) {
  const K = rincianSale(s).kas;
  return (K.warung ? K.warung.jual : 0) + (K.material ? K.material.jual : 0);
}
/** Contoh: "3 jenis barang · 1 layanan" */
function ringkasIsi(s) {
  const nl = (s.items || []).filter(i => i.layanan).length;
  const nu = (s.items || []).filter(i => i.utangLama).length;
  const nb = (s.items || []).length - nl - nu;
  return [nb ? nb + ' jenis barang' : '', nl ? nl + ' layanan' : '', nu ? 'bayar utang lama' : '']
    .filter(Boolean)
    .join(' · ');
}
/** Total transaksi untuk tabel. Minus = uang diberikan ke pelanggan (tarik tunai) */
function totalTeks(s) {
  return s.total < 0
    ? `<span class="negtxt" title="Uang diberikan ke pelanggan">−${rp(-s.total)}</span>`
    : rp(s.total);
}

/* ---- uang kurang tanpa nama (transaksi tunai yang uangnya kurang) ---- */
/** Kekurangan transaksi ini yang belum diterima */
function sisaKurang(s) {
  if (!s || s.batal || !(Number(s.kurang) > 0)) return 0;
  const dibayar = S.payments.filter(p => p.saleId === s.id).reduce((a, p) => a + (Number(p.jumlah) || 0), 0);
  return Math.max(0, s.kurang - dibayar);
}
/** Transaksi yang kekurangannya belum diterima, terbaru dulu */
function daftarKurang() {
  return S.sales.filter(s => sisaKurang(s) > 0).sort((a, b) => b.waktu - a.waktu);
}
/** Catat kekurangan yang sudah dibayar. Uangnya masuk ke laci yang kurang (Warung dulu). */
async function terimaKurang(s, jumlah) {
  const K = rincianSale(s).kas;
  const sudah = {};
  for (const p of S.payments) if (p.saleId === s.id) sudah[p.kas] = (sudah[p.kas] || 0) + p.jumlah;
  let sisa = Math.min(jumlah, sisaKurang(s));
  for (const k of ['warung', 'material', 'brilink']) {
    if (!K[k] || sisa <= 0) continue;
    const x = Math.min(sisa, Math.max(0, (K[k].utang || 0) - (sudah[k] || 0)));
    if (!x) continue;
    await save('payments', {
      id: uid(),
      customerId: '',
      saleId: s.id,
      waktu: Date.now(),
      jumlah: x,
      kas: k,
      metode: 'tunai',
      catatan: 'Kekurangan transaksi ' + s.no
    });
    sisa -= x;
  }
}

/* ---- utang per laci ---- */
function utangPerKas(cid) {
  const u = {};
  for (const s of S.sales) {
    if (s.customerId !== cid || s.batal || !(s.utang > 0)) continue;
    const K = rincianSale(s).kas;
    for (const k in K) if (K[k].utang) u[k] = (u[k] || 0) + K[k].utang;
  }
  let lama = 0;
  for (const p of S.payments) {
    if (p.customerId !== cid) continue;
    // utang yang dicatat dari buku menambah utang, pembayaran mengurangi
    if (p.jenis === 'utang') u[p.kas || 'warung'] = (u[p.kas || 'warung'] || 0) + p.jumlah;
    else if (p.kas) u[p.kas] = (u[p.kas] || 0) - p.jumlah;
    else lama += Number(p.jumlah) || 0;
  }
  // pembayaran sebelum ada pemisahan uang: mengurangi utang Warung dulu, lalu Material
  for (const k of ['warung', 'material', 'brilink']) {
    if (lama <= 0) break;
    const x = Math.min(Math.max(0, u[k] || 0), lama);
    u[k] = (u[k] || 0) - x;
    lama -= x;
  }
  if (lama > 0) u.warung = (u.warung || 0) - lama;
  return u;
}

/* ---- catatan uang (store 'kas') ----
 * jenis: buka {kas, jumlah}           uang awal di laci saat buka kasir
 *        tutup {kas, seharusnya, dihitung, selisih, diambil, sisa}
 *        keluar {kas, jumlah, kategori, prive?, stok?, catatan}   pengeluaran
 *        masuk {kas, jumlah, catatan}  uang tambahan (modal dari rumah, dll)
 *        pindah {kas: dari, ke, jumlah, catatan}
 *        saldo {kas: 'pb'|'rek', jumlah, sebelum}   samakan saldo dengan aplikasi
 */
const KATEGORI_KELUAR = [
  { id: 'kulakan', nama: 'Belanja barang dagangan', ikon: '🛒', stok: true },
  { id: 'listrik', nama: 'Listrik & air', ikon: '💡' },
  { id: 'plastik', nama: 'Plastik & kantong', ikon: '🛍️' },
  { id: 'ongkos', nama: 'Ongkos & bensin', ikon: '⛽' },
  { id: 'gaji', nama: 'Gaji / upah', ikon: '👷' },
  { id: 'iuran', nama: 'Iuran & sumbangan', ikon: '🤝' },
  { id: 'alat', nama: 'Perbaikan & peralatan', ikon: '🔧' },
  { id: 'pribadi', nama: 'Ambil untuk keperluan rumah', ikon: '🏠', prive: true },
  { id: 'lain', nama: 'Lainnya', ikon: '📝' }
];
function kategoriKeluar(id) {
  return KATEGORI_KELUAR.find(k => k.id === id) || KATEGORI_KELUAR[KATEGORI_KELUAR.length - 1];
}
async function catatUang(e) {
  const o = { id: uid(), waktu: Date.now(), ...e };
  await save('kas', o);
  return o;
}
/** Catatan terakhir yang menetapkan jumlah uang (buka / tutup / samakan saldo) */
function patokanUang(id, t = Infinity) {
  let best = null;
  for (const e of S.kas) {
    if (e.kas !== id || e.waktu > t) continue;
    const v = e.jenis === 'buka' || e.jenis === 'saldo' ? e.jumlah : e.jenis === 'tutup' ? e.sisa : undefined;
    if (v === undefined || v === null) continue;
    if (!best || e.waktu >= best.waktu) best = { waktu: e.waktu, nilai: Number(v) || 0, e };
  }
  return best;
}
/** Semua perubahan uang satu laci / saldo antara waktu a (tidak termasuk) sampai b */
function arusUang(id, a, b) {
  const r = {
    jual: 0,
    setor: 0,
    tarik: 0,
    utang: 0,
    keluar: 0,
    masuk: 0,
    pindahMasuk: 0,
    pindahKeluar: 0,
    layanan: 0,
    total: 0
  };
  const di = t => t > a && t <= b;
  for (const s of S.sales) {
    const t1 = s.waktuUbah || s.waktu;
    const f = (di(t1) ? 1 : 0) - (s.batal && di(s.waktuBatal || t1) ? 1 : 0);
    if (!f) continue;
    const R = rincianSale(s);
    if (id === 'pb') r.layanan += f * R.pb;
    else if (id === 'rek') r.layanan += f * R.rek;
    else {
      const x = R.kas[id];
      if (!x) continue;
      if (id === 'brilink' && (s.metode === 'tunai' || s.metode === 'utang')) {
        // uang kurang / sebagian utang: yang belum dibayar tidak ada di laci
        r.setor += f * (x.uangMasuk - (x.utang || 0));
        r.tarik += f * x.uangKeluar;
      } else {
        // utang lama yang dibayar sekalian belanja dihitung sebagai bayar utang, bukan penjualan.
        // Kalau uangnya kurang, uang yang diterima dipakai melunasi utang lama dulu.
        const bu = ['tunai', 'utang'].includes(s.metode || 'tunai')
          ? Math.min(x.bayarUtang || 0, Math.max(0, x.tunai || 0))
          : 0;
        r.jual += f * (x.tunai - bu);
        r.utang += f * bu;
      }
    }
  }
  if (isLaci(id))
    for (const p of S.payments) {
      if (!di(p.waktu) || (p.kas || 'warung') !== id || (p.metode || 'tunai') !== 'tunai') continue;
      // catatan utang dari buku bukan uang masuk, dan bayar utang di dalam transaksi sudah dihitung di transaksinya
      if (p.jenis === 'utang' || p.dalamTransaksi) continue;
      r.utang += Number(p.jumlah) || 0;
    }
  for (const e of S.kas) {
    if (!di(e.waktu)) continue;
    const j = Number(e.jumlah) || 0;
    if (e.jenis === 'keluar' && e.kas === id) r.keluar += j;
    else if (e.jenis === 'masuk' && e.kas === id) r.masuk += j;
    else if (e.jenis === 'pindah') {
      if (e.kas === id) r.pindahKeluar += j;
      if (e.ke === id) r.pindahMasuk += j;
    }
  }
  r.total =
    r.jual + r.setor - r.tarik + r.utang - r.keluar + r.masuk + r.pindahMasuk - r.pindahKeluar + r.layanan;
  return r;
}
/** Uang yang seharusnya ada sekarang: patokan terakhir + semua perubahan sesudahnya.
 * Laci tanpa patokan dihitung dari jam 00.00 hari ini. Saldo tanpa patokan = belum diketahui (null). */
function posisiUang(id, t = Date.now()) {
  const pt = patokanUang(id, t);
  if (!pt && !isLaci(id)) return null;
  const dari = pt ? pt.waktu : Math.min(dayStart(0), t);
  const r = arusUang(id, dari, t);
  r.awal = pt ? pt.nilai : 0;
  r.patokan = pt;
  r.dari = dari;
  r.saldo = r.awal + r.total;
  return r;
}
function bukaHariIni(id) {
  const a = dayStart(0);
  return S.kas.some(e => e.jenis === 'buka' && e.waktu >= a && (!id || e.kas === id));
}
/* ---- Buka & tutup kasir otomatis ----
 * Orang tua tidak perlu menekan apa pun: kasir dibuka sendiri pada jam buka toko dan ditutup sendiri pada
 * jam tutup. Uang awal = uang menurut catatan saat itu, uang tutup = uang menurut catatan (tidak dihitung
 * ulang, jadi selisihnya 0). Karena jumlahnya sama dengan catatan, hitungan uang di laci tidak berubah.
 * Kalau aplikasi sedang tertutup pada jam tutup, penutupan dicatat saat aplikasi dibuka lagi, dengan waktu
 * dan jumlah uang pada jam tutup hari itu. Buka / tutup dengan menghitung uang tetap bisa dari menu Uang. */
const jamKeMenit = s => {
  const m = String(s || '').match(/^(\d{1,2})[:.](\d{2})$/);
  return m ? Math.min(23, +m[1]) * 60 + Math.min(59, +m[2]) : null;
};
const awalHari = t => new Date(t).setHours(0, 0, 0, 0);
function kasirOtoAktif() {
  const U = uangConf();
  const b = jamKeMenit(U.jamBuka),
    t = jamKeMenit(U.jamTutup);
  return U.otomatis !== false && b !== null && t !== null && t > b ? { buka: b, tutup: t } : null;
}
let _otoJalan = false;
/** Mengembalikan { buka: [...], tutup: [...] } catatan yang baru dibuat */
async function kasirOtomatis() {
  const J = kasirOtoAktif();
  const hasil = { buka: [], tutup: [] };
  if (!J || _otoJalan || !S.products.length) return hasil;
  _otoJalan = true;
  try {
    const now = Date.now();
    // 1) tutup laci yang masih terbuka dan sudah lewat jam tutupnya (hari ini atau hari-hari sebelumnya)
    for (const k of kasAktif()) {
      const pt = patokanUang(k.id);
      if (!pt || pt.e.jenis !== 'buka') continue;
      let t = awalHari(pt.waktu) + J.tutup * 60000;
      if (t <= pt.waktu) t = awalHari(pt.waktu) + 864e5 - 1000; // dibuka setelah jam tutup: tutup di akhir hari itu
      if (now < t) continue;
      const uang = Math.round(posisiUang(k.id, t).saldo);
      hasil.tutup.push(
        await catatUang({
          jenis: 'tutup',
          kas: k.id,
          waktu: t,
          seharusnya: uang,
          dihitung: uang,
          selisih: 0,
          diambil: 0,
          sisa: uang,
          otomatis: true,
          catatan: 'Tutup otomatis'
        })
      );
    }
    // 2) buka kasir hari ini, kalau sekarang di antara jam buka dan jam tutup
    const tB = dayStart(0) + J.buka * 60000,
      tT = dayStart(0) + J.tutup * 60000;
    if (now >= tB && now < tT)
      for (const k of kasAktif()) {
        if (bukaHariIni(k.id)) continue;
        hasil.buka.push(
          await catatUang({
            jenis: 'buka',
            kas: k.id,
            waktu: now,
            jumlah: Math.round(posisiUang(k.id, now).saldo),
            otomatis: true
          })
        );
      }
  } finally {
    _otoJalan = false;
  }
  return hasil;
}
/** Dipanggil saat aplikasi dibuka dan tiap setengah menit */
async function tikKasirOtomatis(diam) {
  let r;
  try {
    r = await kasirOtomatis();
  } catch (e) {
    console.warn(e);
    return;
  }
  if (!r.buka.length && !r.tutup.length) return;
  if (diam) return;
  toast(r.buka.length ? '☀️ Kasir dibuka otomatis' : '🌙 Kasir ditutup otomatis');
  // perbarui tampilan hanya kalau tidak mengganggu yang sedang diketik
  if (!$('.modal') && (currentView === 'uang' || currentView === 'beranda')) render();
}
/** Laci yang sudah dibuka hari ini tapi belum ditutup */
function belumTutup() {
  return kasAktif()
    .map(k => k.id)
    .filter(id => {
      const pt = patokanUang(id);
      return pt && pt.e.jenis === 'buka' && pt.waktu >= dayStart(0);
    });
}

/* ---- rekap per laci untuk laporan & laba bersih ---- */
function rekapUang(a, b) {
  const R = {};
  const g = k =>
    (R[k] = R[k] || {
      trx: 0,
      jual: 0,
      modal: 0,
      laba: 0,
      barang: 0,
      lynJual: 0,
      lynLaba: 0,
      nLyn: 0,
      tarik: 0,
      setor: 0,
      admin: 0,
      tunai: 0,
      non: 0,
      utang: 0,
      bayarUtang: 0,
      biaya: 0,
      prive: 0,
      kulakan: 0,
      masuk: 0,
      bersih: 0,
      tanpaHB: false
    });
  KAS.forEach(k => g(k.id));
  let trx = 0;
  for (const s of S.sales) {
    if (s.batal || s.waktu < a || s.waktu >= b) continue;
    trx++;
    const X = rincianSale(s).kas;
    for (const k in X) {
      const r = g(k),
        x = X[k];
      r.trx++;
      for (const f of [
        'jual',
        'modal',
        'barang',
        'lynJual',
        'lynLaba',
        'nLyn',
        'tarik',
        'setor',
        'admin',
        'tunai',
        'non',
        'utang'
      ])
        r[f] += x[f] || 0;
      // utang lama yang dibayar sekalian belanja: dipindah dari "tunai / QRIS" ke "bayar utang"
      const nonTunai = s.metode === 'qris' || s.metode === 'transfer';
      const bu = Math.min(x.bayarUtang || 0, Math.max(0, (nonTunai ? x.non : x.tunai) || 0));
      if (bu) {
        r.bayarUtang += bu;
        if (nonTunai) r.non -= bu;
        else r.tunai -= bu;
      }
      if (x.tanpaHB) r.tanpaHB = true;
    }
  }
  for (const p of S.payments)
    if (p.waktu >= a && p.waktu < b && p.jenis !== 'utang' && !p.dalamTransaksi)
      g(p.kas || 'warung').bayarUtang += Number(p.jumlah) || 0;
  for (const e of S.kas) {
    if (e.waktu < a || e.waktu >= b || !isLaci(e.kas)) continue;
    const r = g(e.kas),
      j = Number(e.jumlah) || 0;
    if (e.jenis === 'keluar') r[e.prive ? 'prive' : e.stok ? 'kulakan' : 'biaya'] += j;
    else if (e.jenis === 'masuk') r.masuk += j;
  }
  const semua = g('semua');
  for (const k of KAS.map(x => x.id)) {
    const r = R[k];
    r.laba = r.jual - r.modal;
    r.bersih = r.laba - r.biaya;
    for (const f of Object.keys(semua)) if (typeof r[f] === 'number' && f !== 'trx') semua[f] += r[f];
    if (r.tanpaHB) semua.tanpaHB = true;
  }
  semua.trx = trx;
  // "penjualan" toko = barang + layanan PojokBayar + barang material (uang BRILink bukan penjualan)
  semua.penjualan = R.warung.jual + R.material.jual;
  return R;
}
