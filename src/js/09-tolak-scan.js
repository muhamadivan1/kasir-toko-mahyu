/* ============ TOLAK QR BPOM & KODE ASING ============
 * Kemasan makanan, obat, dan kosmetik sekarang punya QR BPOM. Isinya nomor izin edar (misal "MD 2245..."),
 * bukan barcode barang, tapi sering ikut terbaca scanner. Kode seperti itu ditolak di kolom scan kasir,
 * kolom barcode produk, dan kolom cari barang. Yang tetap jalan: barcode angka, kode singkat / barcode
 * huruf yang memang tersimpan di data barang, kartu member, dan QR / link pesanan pelanggan.
 *
 * Cara kerja:
 * 1. Isi kolom berpola nomor izin edar BPOM, bertuliskan BPOM, atau alamat situs -> langsung dikosongkan.
 *    Sisa ketikan scanner sesudahnya (dan Enter-nya) ikut dibuang, supaya tidak jadi pencarian aneh.
 * 2. Di kolom scan kasir: hasil scanner (ketikan super cepat) yang mengandung huruf dan tidak cocok
 *    dengan barang mana pun juga ditolak, misalnya QR promo atau QR lain di kemasan.
 */
// Awalan nomor izin edar BPOM: pangan MD/ML, obat DKL/DBL/GKL/..., obat tradisional TR/TI/TL,
// suplemen SD/SI/SL, kosmetik NA/NB/NC/ND/NE, kuasi QD/QL, diikuti minimal 9 angka.
const POLA_NIE =
  /(?:^|[^A-Z])(?:MD|ML|DKL|DBL|DTL|DKI|DTI|DBI|GKL|GBL|GTL|NA|NB|NC|ND|NE|TR|TI|TL|SD|SI|SL|CD|CL|QD|QL)\s*[-.:]?\s*\d{9,}/i;
const KOLOM_SCAN = '#scan,#fb,#qbc,[data-ub],#pq,#sq,#sd,#fpq,#kq,#scbq,#hq,[data-scan]';
/** 'bpom' | 'link' | '' */
function jenisKodeAsing(t) {
  t = String(t || '');
  if (!t.trim() || /TMPESAN1\||#pesan=/.test(t)) return '';
  if (/\bBPOM\b|POM\.GO\.ID/i.test(t) || POLA_NIE.test(t)) return 'bpom';
  if (/^\s*(?:https?:\/\/|www\.)/i.test(t)) return 'link';
  return '';
}
const PESAN_TOLAK = {
  bpom: '⛔ Itu QR BPOM, bukan barcode barang. Scan barcode garis-garis di kemasan.',
  link: '⛔ Itu QR alamat situs, bukan barcode barang. Scan barcode garis-garis di kemasan.',
  asing: '⛔ Kode ini bukan barcode barang. Scan barcode garis-garis di kemasan.'
};
let _tolakSampai = 0;
const sedangTolak = () => Date.now() < _tolakSampai;
/** Bunyi tolak: dua nada rendah (beda dengan bunyi barang masuk) */
function bunyiTolak() {
  beep(false);
  setTimeout(() => beep(false), 360);
}
function tolakKode(jenis, inp) {
  _tolakSampai = Date.now() + 500;
  if (inp) {
    inp.value = '';
    inp.classList.add('scantolak');
    clearTimeout(inp._tolakH);
    inp._tolakH = setTimeout(() => inp.classList.remove('scantolak'), 1600);
    if (inp.id === 'scan') {
      closeSuggest();
      const x = $('#scanX');
      x && x.classList.add('hide');
    }
  }
  bunyiTolak();
  toast(PESAN_TOLAK[jenis] || PESAN_TOLAK.asing, true, 5000);
}
const kolomScan = el => el instanceof HTMLInputElement && el.matches(KOLOM_SCAN);
// 1) penjaga isi kolom: dijalankan sebelum kolomnya sendiri bereaksi (fase capture)
document.addEventListener(
  'input',
  e => {
    const el = e.target;
    if (!kolomScan(el)) return;
    if (sedangTolak()) {
      // sisa kiriman scanner dari QR yang barusan ditolak
      el.value = '';
      _tolakSampai = Date.now() + 300;
      return;
    }
    const j = jenisKodeAsing(el.value);
    if (j) tolakKode(j, el);
  },
  true
);
document.addEventListener(
  'keydown',
  e => {
    const el = e.target;
    if (!kolomScan(el)) return;
    if (e.key === 'Enter' && sedangTolak()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      el.value = '';
      return;
    }
    // catat waktu tiap ketikan, untuk membedakan scanner (sangat cepat) dengan ketikan tangan
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (!el.value) el._ketik = [];
      (el._ketik = el._ketik || []).push(performance.now());
    }
  },
  true
);
/** true kalau isi kolom ini diketik oleh scanner: minimal 6 huruf/angka dengan jeda rata-rata di bawah 40 ms.
 *  Ketikan tangan paling cepat sekitar 80-150 ms per huruf. */
function dariScanner(el) {
  const t = (el && el._ketik) || [];
  if (t.length < 6 || t.length < String(el.value || '').trim().length * 0.8) return false;
  const jeda = t
    .slice(1)
    .map((x, i) => x - t[i])
    .sort((a, b) => a - b);
  return jeda[Math.floor(jeda.length / 2)] < 40;
}

/* ---- Kolom nama pembeli: tidak menerima hasil scanner ----
 * Saat mengetik nama pembeli, scanner bisa tidak sengaja membaca barcode atau QR BPOM dan isinya masuk
 * ke kolom nama. Ketikan scanner dikenali dari kecepatannya: minimal 6 huruf/angka berturut-turut dengan
 * jeda di bawah 45 ms (tangan manusia sekitar 100 ms per huruf). Isinya dibuang, nama yang sedang diketik
 * dikembalikan, dan Enter dari scanner tidak dijalankan. Kartu member (M0001) tetap boleh di-scan. */
const KOLOM_NAMA = '#custName,#kName,#cn,#ch,#ca,[data-tanpascan]';
const kolomNama = el => el instanceof HTMLInputElement && el.matches(KOLOM_NAMA);
const kodeMember = t =>
  /^M\d{4,}$/i.test(t) && S.customers.some(c => c.aktif !== false && c.kode === t.toUpperCase());
function tolakDiNama(el) {
  const g = el._ketikCepat;
  el.value = g.awal;
  try {
    el.setSelectionRange(g.selS, g.selE);
  } catch (e) {}
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el._blokSampai = performance.now() + 400;
  el.classList.add('scantolak');
  clearTimeout(el._tolakH);
  el._tolakH = setTimeout(() => el.classList.remove('scantolak'), 1600);
  bunyiTolak();
  toast(
    '⛔ Hasil scan (barcode / QR BPOM) tidak masuk ke kolom nama. Untuk scan barang, klik dulu kolom scan.',
    true,
    5000
  );
}
function selesaiKetikCepat(el) {
  const g = el._ketikCepat;
  if (!g || g.status !== 'tunda') return false;
  g.status = '';
  if (kodeMember(g.teks)) return false; // kartu member: biarkan
  tolakDiNama(el);
  return true;
}
document.addEventListener(
  'keydown',
  e => {
    const el = e.target;
    if (!kolomNama(el)) return;
    const now = performance.now();
    const g = el._ketikCepat || (el._ketikCepat = { last: 0, n: 0, teks: '', awal: '', selS: 0, selE: 0 });
    if (el._blokSampai > now) {
      // sisa kiriman scanner (termasuk Enter) dari kode yang barusan ditolak
      if (e.key.length === 1 || e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        el._blokSampai = now + 300;
      }
      return;
    }
    if (e.key === 'Enter') {
      clearTimeout(g.h);
      if (selesaiKetikCepat(el)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      g.n = 0;
      return;
    }
    if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;
    if (now - g.last > 45) {
      // jeda panjang: awal ketikan baru, simpan isi kolom sebelum ketikan ini
      Object.assign(g, {
        n: 0,
        teks: '',
        awal: el.value,
        selS: el.selectionStart,
        selE: el.selectionEnd,
        status: ''
      });
    }
    g.last = now;
    g.n++;
    g.teks += e.key;
    if (g.n >= 6) {
      if (/^M\d*$/i.test(g.teks))
        g.status = 'tunda'; // mungkin kartu member: putuskan setelah selesai
      else {
        e.preventDefault();
        g.status = '';
        g.n = 0;
        tolakDiNama(el);
        return;
      }
    }
    clearTimeout(g.h);
    g.h = setTimeout(() => selesaiKetikCepat(el), 150);
  },
  true
);
