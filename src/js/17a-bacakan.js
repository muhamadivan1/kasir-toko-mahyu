/* ============ SUARA MEMBACAKAN ============
 * Kasir membacakan total belanja saat jendela bayar dibuka, lalu kembalian (atau kekurangannya)
 * setelah transaksi selesai, supaya tidak perlu membaca layar. Bisa dinyalakan / dimatikan dengan
 * tombol 🔊 di samping kolom scan (atau di Pengaturan → Toko & Struk). Memakai suara bawaan
 * komputer / HP (Web Speech API, bahasa Indonesia), jadi tetap jalan tanpa internet kalau suaranya ada.
 */
const SATUAN_KATA = [
  '',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
  'sepuluh',
  'sebelas'
];
/** 25500 -> "dua puluh lima ribu lima ratus" */
function terbilang(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n < 12) return SATUAN_KATA[n] || 'nol';
  if (n < 20) return terbilang(n - 10) + ' belas';
  if (n < 100) return (terbilang(Math.floor(n / 10)) + ' puluh ' + (n % 10 ? terbilang(n % 10) : '')).trim();
  if (n < 200) return ('seratus ' + (n % 100 ? terbilang(n % 100) : '')).trim();
  if (n < 1000)
    return (terbilang(Math.floor(n / 100)) + ' ratus ' + (n % 100 ? terbilang(n % 100) : '')).trim();
  if (n < 2000) return ('seribu ' + (n % 1000 ? terbilang(n % 1000) : '')).trim();
  const besar = [
    [1e12, 'triliun'],
    [1e9, 'miliar'],
    [1e6, 'juta'],
    [1e3, 'ribu']
  ];
  for (const [v, k] of besar)
    if (n >= v)
      return (terbilang(Math.floor(n / v)) + ' ' + k + ' ' + (n % v ? terbilang(n % v) : '')).trim();
  return '';
}
const suaraBacaOn = () => settings().bacakan === true;
const bisaBacakan = () => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
let _suaraId = null;
function pilihSuaraId() {
  if (_suaraId !== null) return _suaraId;
  try {
    const v = speechSynthesis.getVoices();
    _suaraId = v.find(x => /^id(-|_|$)/i.test(x.lang)) || v.find(x => /indones/i.test(x.name)) || false;
  } catch (e) {
    _suaraId = false;
  }
  return _suaraId;
}
if (bisaBacakan()) speechSynthesis.onvoiceschanged = () => (_suaraId = null);
/** Bacakan kalimat (kalimat sebelumnya yang belum selesai dihentikan) */
function bacakan(teks, paksa) {
  if ((!suaraBacaOn() && !paksa) || !bisaBacakan() || !teks) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(teks);
    u.lang = 'id-ID';
    const v = pilihSuaraId();
    if (v) u.voice = v;
    u.rate = Number(settings().bacakanCepat) || 0.95;
    speechSynthesis.speak(u);
  } catch (e) {}
}
const rupiahKata = n => terbilang(n) + ' rupiah';
function bacakanTotal(total) {
  bacakan('Totalnya ' + rupiahKata(total));
}
function bacakanSelesai(sale) {
  if (!sale) return;
  const kurang = Number(sale.kurang) || (sale.kurangBayar ? Number(sale.utang) || 0 : 0);
  if (kurang > 0) return bacakan('Uangnya kurang ' + rupiahKata(kurang));
  if (sale.metode === 'tunai' && Number(sale.kembali) > 0)
    return bacakan('Kembaliannya ' + rupiahKata(sale.kembali));
  if (sale.metode === 'tunai') return bacakan('Uangnya pas. Terima kasih');
  bacakan('Terima kasih');
}
function tombolBacaHTML() {
  return `<button class="btn big ghost ${suaraBacaOn() ? 'bacaon' : ''}" id="bacaBtn" type="button" title="Suara membacakan total dan kembalian: ${suaraBacaOn() ? 'NYALA' : 'MATI'} (tekan untuk ${suaraBacaOn() ? 'mematikan' : 'menyalakan'})">${suaraBacaOn() ? '🔊' : '🔇'}</button>`;
}
async function setBacakan(on) {
  settings().bacakan = !!on;
  await saveMeta('settings');
  const b = $('#bacaBtn');
  if (b) b.outerHTML = tombolBacaHTML();
  pasangTombolBaca();
  if (on && !bisaBacakan()) return toast('Browser ini tidak punya suara. Pakai Google Chrome terbaru.', true);
  toast(on ? '🔊 Suara membacakan total NYALA' : '🔇 Suara membacakan total MATI');
  if (on) bacakan('Suara kasir menyala', true);
}
function pasangTombolBaca() {
  const b = $('#bacaBtn');
  if (b) b.onclick = () => setBacakan(!suaraBacaOn());
}
