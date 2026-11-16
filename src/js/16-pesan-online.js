/* ============ PESAN ONLINE: KATALOG, LINK PESANAN & PUBLIKASI ============
 * Alur:
 *  1. Kasir membuat katalog.json (daftar barang + harga yang boleh dilihat pelanggan).
 *  2. Katalog diunggah ke GitHub (otomatis lewat token, atau manual), Cloudflare Pages menayangkannya.
 *  3. Pelanggan membuka <situs>/pesan.html, memilih barang, mengirim pesan WhatsApp berisi link
 *     <situs>/#pesan=<data>. Kalau link itu diklik di komputer toko, kasir langsung membuka pesanannya.
 *  4. Kalau kasir sudah terbuka di tab lain, pesanan dikirim ke tab itu (BroadcastChannel).
 */

/* ---------- pengaturan ---------- */
const DEF_ONLINE = { url: '', tiers: ['umum', 'warung'], auto: false, lastPublish: 0, lastHash: '' };
function online() {
  const st = settings();
  return withDefaults(st, 'online', DEF_ONLINE);
}
/** Alamat situs, selalu diakhiri "/" (misal https://toko-mahyu.pages.dev/) */
function siteBase() {
  let u = String(online().url || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u.replace(/\/(index\.html|pesan\.html)?$/i, '') + '/';
}
/** Harga yang langsung terpilih di halaman pesan. Warung, karena yang paling sering pesan lewat WA adalah warung. */
function hargaAwalPesan() {
  const tl = online().tiers || [];
  return tl.includes('warung') ? 'warung' : tl[0] || 'umum';
}
function pesanLink(tier) {
  const b = siteBase();
  return b
    ? b + 'pesan.html' + (tier && tier !== hargaAwalPesan() ? '?h=' + encodeURIComponent(tier) : '')
    : '';
}
function waNumber(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d.length >= 10 ? d : '';
}
function tierPublik(t) {
  return t.id === 'umum' ? 'Perorangan' : t.nama;
}

/* ---------- katalog ---------- */
/** ID pendek (awalan unik minimal 8 karakter) supaya link pesanan tidak terlalu panjang */
function shortIds() {
  const ids = S.products.map(p => p.id);
  const map = new Map();
  for (const id of ids) {
    let n = 8;
    while (n < id.length && ids.some(o => o !== id && o.startsWith(id.slice(0, n)))) n++;
    map.set(id, id.slice(0, n));
  }
  return map;
}
/** Berapa kali tiap produk dibeli dalam 120 hari terakhir (untuk urutan "sering dibeli") */
function popularitas(hari = 120) {
  const dari = Date.now() - hari * 864e5;
  const c = {};
  for (const s of S.sales) {
    if (s.batal || s.waktu < dari) continue;
    for (const it of s.items) if (!it.manual) c[it.productId] = (c[it.productId] || 0) + 1;
  }
  return c;
}
function katalogData() {
  const st = settings();
  const O = online();
  const tl = tiers().filter(t => O.tiers.includes(t.id));
  const pop = popularitas();
  const sid = shortIds();
  const prods = S.products
    .filter(p => p.aktif !== false && priceOf(p, 'umum') > 0)
    .sort((a, b) => a.nama.localeCompare(b.nama));
  const kat = [...new Set(prods.map(p => p.kategori || KAT_LAIN))].sort(urutKategori);
  return {
    v: 1,
    toko: { nama: st.nama, alamat: st.alamat, wa: waNumber(st.orderWa || st.telp) },
    kasir: siteBase(),
    harga: tl.map(t => ({ id: t.id, nama: tierPublik(t) })),
    hd: hargaAwalPesan(),
    kat,
    ki: kat.map(ikonKategori),
    p: prods.map(p => {
      const def = unitScanOf(p);
      const us = unitsOf(p).sort((a, b) => (b.nama === def) - (a.nama === def));
      const o = {
        i: sid.get(p.id),
        n: p.nama,
        k: kat.indexOf(p.kategori || KAT_LAIN),
        u: us.map(u => [u.nama, ...tl.map(t => priceUnit(p, u.nama, t.id))])
      };
      if (p.alias && p.alias !== p.nama) o.a = p.alias;
      if (pop[p.id]) o.s = pop[p.id];
      if (isPrioritas(p)) {
        o.f = p.prioritas === true ? ['*'] : prioritasCocok(p);
        const ekstra = prioritasEkstra(prioritasCocok(p));
        if (ekstra) o.fx = ekstra;
      }
      return o;
    }),
    dibuat: new Date().toISOString()
  };
}
/** Sidik isi katalog (tanpa waktu & popularitas) untuk tahu apakah perlu diterbitkan ulang */
function katalogHash(k) {
  const s = JSON.stringify([k.toko, k.harga, k.kat, k.p.map(x => [x.i, x.n, x.a, x.k, x.u, x.f, x.fx])]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function katalogPerluUpdate() {
  return katalogHash(katalogData()) !== online().lastHash;
}
function downloadFile(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function downloadKatalog() {
  downloadFile('katalog.json', JSON.stringify(katalogData()), 'application/json');
  toast('katalog.json diunduh ✔ Unggah ke folder public di GitHub');
}
/** Halaman pesan mandiri (katalog ditanam di dalam file), bisa dibuka tanpa hosting */
function pesanStandaloneHTML() {
  if (!window.PESAN_TPL) throw new Error('Template halaman pesan tidak ada di aplikasi ini');
  const lib = (($('#lib-qr') || {}).textContent || '').replace(/<\/script/gi, '<\\/script');
  const k = JSON.stringify(katalogData()).replace(/</g, '\\u003c');
  return window.PESAN_TPL.replace('/*__QRGEN__*/', () => lib).replace(
    '/*__EMBED__*/',
    () => 'window.KATALOG_EMBED=' + k + ';'
  );
}
function previewPesanPage() {
  const w = window.open(
    URL.createObjectURL(new Blob([pesanStandaloneHTML()], { type: 'text/html' })),
    '_blank'
  );
  if (!w) toast('Popup diblokir browser. Izinkan popup untuk melihat contoh.', true);
}
function downloadPesanPage() {
  const nama = settings()
    .nama.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  downloadFile('pesan-' + nama + '.html', pesanStandaloneHTML(), 'text/html');
  toast('Halaman pesan diunduh ✔');
}

/* ---------- GitHub (untuk menerbitkan katalog otomatis) ---------- */
const DEF_GH = { owner: '', repo: '', branch: 'main', path: 'public/katalog.json', token: '' };
function ghConf() {
  return withDefaults(S.meta, 'ghConf', DEF_GH);
}
/** Disimpan terpisah, TIDAK ikut file backup (token rahasia) */
async function saveGhConf() {
  await DB.put('meta', { id: 'ghConf', value: S.meta.ghConf });
}
function b64utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function gh(method, path, body) {
  const r = await fetch('https://api.github.com' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + ghConf().token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try {
    data = await r.json();
  } catch (e) {}
  return { ok: r.ok, status: r.status, data };
}
function ghErr(r) {
  const msg = (r.data && r.data.message) || '';
  if (r.status === 401) return 'Token GitHub salah atau sudah kedaluwarsa. Buat token baru.';
  if (r.status === 403) return 'Token belum diberi izin "Contents: Read and write" untuk repo ini.';
  if (r.status === 404) return 'Repo / branch tidak ditemukan, atau token tidak diberi akses ke repo ini.';
  if (r.status === 409) return 'Versi file bentrok. Coba tekan lagi.';
  if (r.status === 422) return 'Ditolak GitHub: ' + msg;
  return 'GitHub error ' + r.status + (msg ? ': ' + msg : '');
}
function ghRepoPath() {
  const g = ghConf();
  return `/repos/${encodeURIComponent(g.owner.trim())}/${encodeURIComponent(g.repo.trim())}`;
}
function ghSiap() {
  const g = ghConf();
  return !!(g.owner && g.repo && g.token);
}
async function ghTest() {
  if (!ghSiap()) throw new Error('Isi pemilik repo, nama repo, dan token dulu');
  const r = await gh('GET', ghRepoPath());
  if (!r.ok) throw new Error(ghErr(r));
  if (r.data && r.data.permissions && !r.data.permissions.push)
    throw new Error('Token hanya bisa membaca. Beri izin "Contents: Read and write".');
  return r.data ? r.data.full_name + (r.data.private ? ' (privat)' : ' (publik)') : 'OK';
}
/** Terbitkan katalog ke GitHub. Mengembalikan jumlah produk. */
async function publishKatalog() {
  if (!ghSiap()) throw new Error('Pengaturan GitHub belum lengkap (Pengaturan → Pesan Online)');
  const g = ghConf();
  const k = katalogData();
  const url = ghRepoPath() + '/contents/' + g.path.split('/').map(encodeURIComponent).join('/');
  const cur = await gh('GET', url + '?ref=' + encodeURIComponent(g.branch));
  if (!cur.ok && cur.status !== 404) throw new Error(ghErr(cur));
  const body = {
    message: 'Perbarui katalog ' + tglJam(Date.now()),
    content: b64utf8(JSON.stringify(k)),
    branch: g.branch
  };
  if (cur.ok && cur.data && cur.data.sha) body.sha = cur.data.sha;
  const put = await gh('PUT', url, body);
  if (!put.ok) throw new Error(ghErr(put));
  const O = online();
  O.lastPublish = Date.now();
  O.lastHash = katalogHash(k);
  await saveMeta('settings');
  return k.p.length;
}
/** Terbitkan otomatis (kalau diaktifkan) paling sering tiap 2 jam, hanya kalau ada perubahan */
async function autoPublishTick() {
  const O = online();
  if (!O.auto || !ghSiap() || !navigator.onLine) return;
  if (Date.now() - (O.lastPublish || 0) < 2 * 3600e3) return;
  if (!katalogPerluUpdate()) return;
  try {
    await publishKatalog();
  } catch (e) {
    console.warn('Terbit otomatis gagal:', e.message);
  }
}
setInterval(autoPublishTick, 10 * 60e3);

/* ---------- link pesanan (#pesan=...) ---------- */
function b64urlDecodeUtf8(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
}
/** Baca data pesanan dari teks yang berisi link #pesan=... Mengembalikan null kalau tidak ada. */
function decodePesanLink(raw) {
  const m = String(raw || '').match(/#pesan=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const o = JSON.parse(b64urlDecodeUtf8(m[1]));
    // versi 2 (ringkas): [2, nama, hp, catatan, diantar 0/1, harga, [[id, satuan, jumlah] | ['', satuan, jumlah, nama]]]
    if (Array.isArray(o) && o[0] === 2 && Array.isArray(o[6]))
      return {
        nama: String(o[1] || ''),
        hp: String(o[2] || ''),
        catatan: [o[4] ? 'Diantar' : 'Diambil ke toko', o[3]].filter(Boolean).join(' · '),
        tier: String(o[5] || ''),
        lines: o[6].map(([pid, unit, qty, nama]) => ({
          pid: String(pid || ''),
          unit: String(unit || '').toUpperCase(),
          qty: Number(qty) || 1,
          teks: String(nama || ''),
          free: !pid
        }))
      };
    if (!o || !Array.isArray(o.i)) return null;
    return {
      nama: String(o.n || ''),
      hp: String(o.h || ''),
      catatan: [o.a, o.c].filter(Boolean).join(' · '),
      tier: String(o.t || ''),
      lines: o.i.map(([pid, unit, qty, nama]) => ({
        pid: String(pid || ''),
        unit: String(unit || '').toUpperCase(),
        qty: Number(qty) || 1,
        teks: String(nama || ''),
        free: !pid
      }))
    };
  } catch (e) {
    return null;
  }
}

/* ---------- serah-terima antar tab ---------- */
const TAB_ID = uid();
const kanal = 'BroadcastChannel' in window ? new BroadcastChannel('kasir-toko-mahyu') : null;
let tabUtama = true;
if (kanal)
  kanal.onmessage = e => {
    const d = e.data || {};
    if (d.t === 'ping' && tabUtama && S.products.length)
      kanal.postMessage({ t: 'pong', id: TAB_ID, to: d.id });
    if (d.t === 'order' && d.to === TAB_ID) {
      kanal.postMessage({ t: 'ack', to: d.id });
      terimaPesananLink(d.raw);
    }
  };
function tungguPesan(cocok, ms) {
  return new Promise(res => {
    const h = e => {
      if (cocok(e.data || {})) {
        kanal.removeEventListener('message', h);
        res(e.data);
      }
    };
    kanal.addEventListener('message', h);
    setTimeout(() => {
      kanal.removeEventListener('message', h);
      res(null);
    }, ms);
  });
}
async function kirimKeTabLain(raw) {
  if (!kanal) return false;
  const tunggu = tungguPesan(d => d.t === 'pong' && d.to === TAB_ID, 600);
  kanal.postMessage({ t: 'ping', id: TAB_ID });
  const pong = await tunggu;
  if (!pong) return false;
  const ack = tungguPesan(d => d.t === 'ack' && d.to === TAB_ID, 1500);
  kanal.postMessage({ t: 'order', to: pong.id, id: TAB_ID, raw });
  return !!(await ack);
}
/** Pesanan masuk lewat link. Kalau kasir sedang sibuk melayani, cukup disimpan ke daftar 📥. */
async function terimaPesananLink(raw) {
  beep(true);
  setTimeout(() => beep(true), 180);
  try {
    window.focus();
  } catch (e) {}
  const sibuk = $('.modal') || cart.items.length;
  if (sibuk) {
    const ord = await orderImport(raw, 'link', { simpanSaja: true });
    if (ord) toast(`📥 Pesanan baru dari ${ord.nama || 'pelanggan'} masuk ke daftar Pesanan`);
    return;
  }
  if (currentView !== 'kasir') go('kasir');
  orderImport(raw, 'link');
}
function layarPenuh(html) {
  const d = document.createElement('div');
  d.className = 'fullnote';
  d.innerHTML = `<div class="card">${html}</div>`;
  document.body.appendChild(d);
  return d;
}
/** Dipanggil saat aplikasi dibuka. true kalau alamat berisi link pesanan. */
async function bukaPesananDariLink() {
  const m = location.hash.match(/^#pesan=([A-Za-z0-9_-]+)/);
  if (!m) return false;
  const raw = '#pesan=' + m[1];
  history.replaceState(null, '', location.pathname + location.search);
  const info = decodePesanLink(raw);
  if (!info) {
    toast('Link pesanan rusak atau terpotong', true);
    return true;
  }
  if (!S.products.length) {
    const d = layarPenuh(`<h2>🛒 ${esc(settings().nama)}</h2>
      <p style="font-size:18px">Halaman ini adalah <b>aplikasi kasir toko</b>.</p>
      <p>Kalau Anda pelanggan: pesanan Anda <b>sudah terkirim lewat WhatsApp</b>. Tidak perlu membuka link ini. Terima kasih 🙏</p>
      <hr><p class="muted" style="font-size:14px">Untuk pemilik toko: data kasir di browser ini masih kosong. Buka link pesanan di komputer kasir, atau salin pesanannya lalu tempel di kasir (tombol 📥 Pesanan).</p>
      <div class="row"><button class="btn ghost" id="fnCopy">📋 Salin pesanan</button><button class="btn ghost" id="fnGo">Buka kasir kosong</button></div>`);
    $('#fnCopy', d).onclick = async () => {
      try {
        await navigator.clipboard.writeText(location.href.split('#')[0] + raw);
        toast('Pesanan disalin ✔');
      } catch (e) {
        prompt('Salin teks ini:', raw);
      }
    };
    $('#fnGo', d).onclick = () => d.remove();
    return true;
  }
  if (await kirimKeTabLain(raw)) {
    tabUtama = false;
    const d = layarPenuh(`<h2>✔ Pesanan ${esc(info.nama || '')} sudah masuk</h2>
      <p style="font-size:18px">Pesanan dikirim ke <b>kasir yang sudah terbuka di tab lain</b>. Tab ini boleh ditutup.</p>
      <div class="row"><button class="btn pri" id="fnClose">Tutup tab ini</button><button class="btn ghost" id="fnHere">Pakai kasir di tab ini saja</button></div>`);
    $('#fnClose', d).onclick = () => {
      window.close();
      setTimeout(() => toast('Tutup tab ini lewat tanda ✕ di atas', true), 300);
    };
    $('#fnHere', d).onclick = () => {
      tabUtama = true;
      d.remove();
    };
    return true;
  }
  terimaPesananLink(raw);
  return true;
}

/* ---------- bagikan link pesan ke pelanggan ---------- */
function shareOrderLinkDialog() {
  const O = online();
  const tl = tiers().filter(t => O.tiers.includes(t.id));
  if (!siteBase()) {
    const m = modal(
      `<h3>🔗 Link pesan untuk pelanggan</h3>
     <p style="margin-top:0">Supaya pelanggan bisa memesan dari HP lewat link, aplikasi ini perlu di-hosting dulu (gratis). Panduannya ada di file <b>PANDUAN HOSTING</b>. Setelah punya alamat situs, isi di <b>Pengaturan → Pesan Online</b>.</p>
     <p class="muted" style="font-size:14px">Sementara itu, Anda tetap bisa membuat <b>file halaman pesan</b> untuk dikirim ke pelanggan lewat WhatsApp (pelanggan membuka file itu di HP).</p>
     <div class="row actbar"><button class="btn ghost" id="slPrev">👁️ Lihat contoh</button><button class="btn ghost" id="slDl">⬇️ Unduh file halaman pesan</button><span class="grow"></span><button class="btn ghost" data-close>Tutup</button><button class="btn pri" id="slSet">⚙ Atur sekarang</button></div>`,
      { wide: true }
    );
    $('#slPrev', m).onclick = previewPesanPage;
    $('#slDl', m).onclick = downloadPesanPage;
    $('#slSet', m).onclick = () => {
      m.close();
      S._setTab = 'online';
      go('pengaturan');
    };
    return;
  }
  const awal = hargaAwalPesan();
  const rows = (tl.length ? tl : [{ id: 'umum', nama: 'Umum' }])
    .slice()
    .sort((a, b) => (b.id === awal) - (a.id === awal))
    .map(
      t => `<div class="linkrow"><div class="grow"><b>${t.id === 'umum' ? '👤 Untuk pembeli perorangan' : '🏪 Untuk ' + esc(t.nama.toLowerCase())}</b>${t.id === awal ? ' <span class="badge ok">link utama</span>' : ''}<div class="bc linktxt">${esc(pesanLink(t.id))}</div></div>
       <button class="btn sm ghost" data-copy="${esc(pesanLink(t.id))}">📋 Salin</button><button class="btn sm ghost" data-poster="${t.id}">🖨️ Poster QR</button></div>`
    )
    .join('');
  const m = modal(
    `<h3>🔗 Link pesan untuk pelanggan</h3>
   <p style="margin-top:0">Kirim link ini ke pelanggan (misal lewat status / grup WhatsApp). Pelanggan memilih barang, lalu pesanan dikirim ke WhatsApp toko. Klik link di pesan itu dari komputer kasir, pesanan langsung terbuka di kasir.</p>
   ${rows}
   ${katalogPerluUpdate() ? `<div class="banner" style="margin-top:10px">⚠ Ada perubahan barang/harga yang belum diterbitkan ke katalog online. <button class="btn sm pri" id="slPub">☁️ Perbarui sekarang</button></div>` : `<p class="muted" style="font-size:13px">Katalog online terakhir diperbarui: ${online().lastPublish ? tglJam(online().lastPublish) : '-'}</p>`}
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Tutup</button></div>`,
    { wide: true }
  );
  $$('[data-copy]', m).forEach(
    b =>
      (b.onclick = async () => {
        try {
          await navigator.clipboard.writeText(b.dataset.copy);
          toast('Link disalin ✔');
        } catch (e) {
          prompt('Salin link ini:', b.dataset.copy);
        }
      })
  );
  $$('[data-poster]', m).forEach(b => (b.onclick = () => printPosterPesan(b.dataset.poster)));
  $('#slPub', m) &&
    ($('#slPub', m).onclick = async e => {
      e.target.disabled = true;
      try {
        const n = await publishKatalog();
        toast(`Katalog online diperbarui ✔ (${n} barang). Situs berubah dalam 1–2 menit.`);
        m.close();
      } catch (err) {
        toast(err.message, true);
        e.target.disabled = false;
      }
    });
}
function printPosterPesan(tier) {
  const st = settings();
  const link = pesanLink(tier);
  if (!link) return toast('Isi alamat situs dulu di Pengaturan → Pesan Online', true);
  const w = Number(st.lebarStruk) || 72;
  printHTML(
    `<div class="c b big">${esc(st.nama)}</div><div class="c">${esc(st.alamat)}</div><div class="hr"></div>
    <div class="c b" style="font-size:16px">PESAN DARI RUMAH</div><div class="c">Scan QR ini dengan kamera HP,<br>pilih barang, kirim lewat WhatsApp</div>
    <div class="qr">${qrImg(link, 5)}</div><div class="c" style="font-size:9px;word-break:break-all">${esc(link)}</div>
    ${tier && tier !== 'umum' ? `<div class="c b">Harga ${esc(tierName(tier))}</div>` : ''}<div style="height:10mm"></div>`,
    `@page{size:${w}mm auto;margin:0}body{margin:0;padding:3mm;width:${w}mm;box-sizing:border-box;font-family:Arial,sans-serif;font-size:11px;color:#000}.c{text-align:center}.b{font-weight:700}.big{font-size:15px}.hr{border-top:1px dashed #000;margin:4px 0}.qr{width:46mm;margin:3mm auto}.qr img{width:100%;height:auto;image-rendering:pixelated}`
  );
}
