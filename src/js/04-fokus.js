/* ============ FOKUS OTOMATIS ============
 * Kursor selalu siap di kolom utama tiap halaman (scan di Kasir, pencarian di halaman lain),
 * supaya kasir tidak perlu klik dulu sebelum scan / mengetik.
 * - Hanya untuk perangkat dengan mouse (PC/laptop). Di HP tidak dipaksa, karena keyboard layar akan muncul.
 * - Tidak mengganggu saat kursor sedang di kolom isian lain, saat ada jendela (modal) terbuka,
 *   atau saat pengguna sedang memblok teks.
 */
const FOCUS_TARGET = {
  kasir: '#scan',
  produk: '#pq',
  stok: '#sq',
  pelanggan: '#cq',
  ai: '#aiQ'
};
const NON_TEXT_INPUT = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image'];

function hasMouse() {
  try {
    return matchMedia('(pointer:fine)').matches;
  } catch (e) {
    return true;
  }
}
/** true kalau elemen ini tempat orang mengetik / memilih (jangan direbut fokusnya) */
function isTypingEl(el) {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable) return true;
  return el.tagName === 'INPUT' && !NON_TEXT_INPUT.includes(el.type);
}
function mainInput() {
  const sel = FOCUS_TARGET[currentView];
  return sel ? $(sel) : null;
}
/** Pindahkan kursor ke kolom utama halaman (kalau tidak ada modal) */
function focusMain() {
  if ($('.modal')) return;
  const i = mainInput();
  if (i && document.activeElement !== i) i.focus({ preventScroll: true });
}
function userSelectingText() {
  try {
    return String(getSelection() || '').length > 0;
  } catch (e) {
    return false;
  }
}
function refocusSoon(ms = 40) {
  setTimeout(() => {
    if (!isTypingEl(document.activeElement)) focusMain();
  }, ms);
}

// 1) Penjaga: tiap 0,4 detik pastikan kursor ada di kolom utama (misal setelah cetak struk / klik tombol)
setInterval(() => {
  if (!hasMouse() || document.hidden || $('.modal')) return;
  if (isTypingEl(document.activeElement) || userSelectingText()) return;
  focusMain();
}, 400);

// 2) Begitu jendela (modal) terakhir ditutup, langsung kembalikan kursor
new MutationObserver(muts => {
  const closed = muts.some(m => [...m.removedNodes].some(n => n.classList && n.classList.contains('modal')));
  if (closed && !$('.modal') && hasMouse()) refocusSoon();
}).observe(document.body, { childList: true });

// 3) Ketik huruf apa pun saat kursor tidak di kolom isian -> langsung masuk ke kolom utama
document.addEventListener(
  'keydown',
  e => {
    if ($('.modal') || e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1) return;
    if (isTypingEl(document.activeElement)) return;
    const i = mainInput();
    if (i) i.focus({ preventScroll: true });
  },
  true
);

// 4) Di Kasir: klik di area kosong / tombol -> kembali ke kolom scan
document.addEventListener('click', e => {
  if (currentView !== 'kasir') return;
  if (e.target.closest('input,select,textarea,details,summary,a')) return;
  setTimeout(() => {
    if (!$('.modal')) focusScan();
  }, 0);
});

// 5) Kembali ke aplikasi dari jendela lain (misal dari WhatsApp / dialog print)
window.addEventListener('focus', () => refocusSoon(60));
