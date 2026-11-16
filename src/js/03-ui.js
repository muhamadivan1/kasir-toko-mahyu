/* ============ VIEW ROUTER ============ */
let currentView = 'kasir';
const views = {};
function go(v) {
  if (currentView !== v) scrollTo(0, 0);
  currentView = v;
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  render();
}
function render() {
  closeSuggest();
  $('#main').innerHTML = '';
  views[currentView]();
  if (hasMouse()) focusMain();
}
$('#nav').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) go(b.dataset.v);
});
setInterval(() => {
  $('#clock').textContent = new Date().toLocaleString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}, 1000);

/* ============ MODAL ============ */
function modal(html, { wide = false, onClose } = {}) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="box ${wide ? 'wide' : ''}">${html}</div>`;
  document.body.appendChild(m);
  const close = () => {
    m.remove();
    onClose && onClose();
  };
  m.addEventListener('mousedown', e => {
    if (e.target === m) close();
  });
  m.close = close;
  $$('[data-close]', m).forEach(b => (b.onclick = close));
  setTimeout(() => {
    const f = $('[autofocus]', m) || $('input,select', m);
    f && f.focus();
    f && f.select && f.select();
  }, 30);
  return m;
}
function addScrollPad(wrap) {
  if (!wrap || wrap.parentElement.classList.contains('spwrap')) return;
  const box = document.createElement('div');
  box.className = 'spwrap';
  wrap.parentElement.insertBefore(box, wrap);
  box.appendChild(wrap);
  const pad = document.createElement('div');
  pad.className = 'scrollpad';
  pad.innerHTML =
    '<button data-sp="top" title="Paling atas">⏫<small>atas</small></button><button data-sp="up" title="Naik">▲<small>naik</small></button><button data-sp="down" title="Turun">▼<small>turun</small></button><button data-sp="bot" title="Paling bawah">⏬<small>bawah</small></button>';
  box.appendChild(pad);
  const own = () => wrap.scrollHeight > wrap.clientHeight + 4;
  const sync = () => {
    const o = own();
    pad.classList.toggle('idle', !o);
  };
  try {
    const ro = new ResizeObserver(sync);
    ro.observe(wrap);
    const t = wrap.querySelector('table');
    t && ro.observe(t);
  } catch (e) {}
  wrap.addEventListener('scroll', sync, { passive: true });
  setTimeout(sync, 50);
  pad.addEventListener('click', e => {
    const b = e.target.closest('[data-sp]');
    if (!b) return;
    const d = b.dataset.sp;
    const el = own() ? wrap : null;
    const h = el ? el.clientHeight : innerHeight;
    const step = Math.max(120, h * 0.75);
    const opt =
      d === 'top'
        ? { top: 0 }
        : d === 'bot'
          ? { top: 1e9 }
          : { top: (el ? el.scrollTop : scrollY) + (d === 'up' ? -step : step) };
    (el || window).scrollTo({ ...opt, behavior: 'smooth' });
    setTimeout(() => {
      const i = $('#scan');
      if (currentView === 'kasir' && i && !$('.modal')) i.focus();
    }, 0);
  });
}
function confirmBox(msg, yes = 'Ya', danger = false) {
  return new Promise(res => {
    const m = modal(
      `<h3>${esc(msg)}</h3><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" data-no>Tidak</button><button class="btn ${danger ? 'bad' : 'pri'}" data-yes autofocus>${esc(yes)}</button></div>`,
      { onClose: () => res(false) }
    );
    $('[data-no]', m).onclick = () => {
      m.remove();
      res(false);
    };
    $('[data-yes]', m).onclick = () => {
      m.remove();
      res(true);
    };
  });
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const ms = $$('.modal');
    if (ms.length) {
      ms[ms.length - 1].close();
      e.preventDefault();
    }
  }
});

/* ---- Kotak uang / harga: hanya bisa diisi angka, otomatis diberi titik ribuan (25000 -> 25.000) ----
 * Berlaku untuk semua <input inputmode="numeric">, kecuali kotak nomor yang bukan uang
 * (nomor HP / ID pelanggan / token listrik / barcode), yang ditandai data-bukanuang. */
function kotakUang(el) {
  return !!(el && el.tagName === 'INPUT' && el.inputMode === 'numeric' && !el.hasAttribute('data-bukanuang'));
}
document.addEventListener(
  'beforeinput',
  e => {
    if (!kotakUang(e.target) || !e.data) return;
    // huruf / titik / koma yang diketik ditolak. Kalau ada angkanya (misal "19.000" ditempel), angkanya dipakai.
    if (e.inputType === 'insertText' && !/\d/.test(e.data)) e.preventDefault();
  },
  true
);
document.addEventListener(
  'input',
  e => {
    const el = e.target;
    if (!kotakUang(el)) return;
    const v = el.value;
    const pos = el.selectionStart ?? v.length;
    const kiri = v.slice(0, pos).replace(/\D/g, '').length;
    const d = v.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    const f = d ? Number(d).toLocaleString('id-ID') : '';
    if (f === v) return;
    el.value = f;
    // kursor tetap di belakang angka yang sama
    let i = 0,
      n = 0;
    while (i < f.length && n < kiri) if (/\d/.test(f[i++])) n++;
    try {
      el.setSelectionRange(i, i);
    } catch (err) {}
  },
  true
);
