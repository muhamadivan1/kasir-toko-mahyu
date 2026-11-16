'use strict';
/* ============ UTIL ============ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
const rp = n => Math.round(Number(n) || 0).toLocaleString('id-ID');
const num = v => {
  if (typeof v === 'number') return v;
  v = String(v ?? '').replace(/[^\d,.-]/g, '');
  if (v.includes(',') && !v.includes('.')) v = v.replace(',', '.');
  else v = v.replace(/[.,](?=\d{3}(\D|$))/g, '');
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};
const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const pad = (n, l = 2) => String(n).padStart(l, '0');
const dkey = d => {
  d = new Date(d);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};
const tglJam = d => {
  d = new Date(d);
  return (
    pad(d.getDate()) +
    '/' +
    pad(d.getMonth() + 1) +
    '/' +
    d.getFullYear() +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  );
};
const tgl = d => {
  d = new Date(d);
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
};
function toast(msg, bad, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'on' + (bad ? ' bad' : '');
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = ''), ms);
}
function beep(ok = true) {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)();
    const o = a.createOscillator(),
      g = a.createGain();
    o.frequency.value = ok ? 1200 : 300;
    o.connect(g);
    g.connect(a.destination);
    g.gain.value = 0.08;
    o.start();
    setTimeout(
      () => {
        o.stop();
        a.close();
      },
      ok ? 90 : 300
    );
  } catch (e) {}
}
