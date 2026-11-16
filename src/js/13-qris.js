/* ============ QRIS ============ */
function crc16(str) {
  let c = 0xffff;
  for (let i = 0; i < str.length; i++) {
    c ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
  }
  return c.toString(16).toUpperCase().padStart(4, '0');
}
function tlvParse(str) {
  const out = [];
  let i = 0;
  while (i < str.length) {
    const t = str.substr(i, 2),
      l = parseInt(str.substr(i + 2, 2), 10);
    if (t.length < 2 || isNaN(l)) throw new Error('format QRIS tidak dikenali');
    const v = str.substr(i + 4, l);
    if (v.length !== l) throw new Error('panjang data QRIS tidak cocok');
    out.push([t, v]);
    i += 4 + l;
  }
  return out;
}
function qrisInfo(payload) {
  const p = String(payload || '').trim();
  if (!p.startsWith('000201')) throw new Error('Ini bukan kode QRIS (harus diawali 000201)');
  const f = Object.fromEntries(tlvParse(p));
  if (!f['63'] || p.slice(-4).toUpperCase() !== crc16(p.slice(0, -4)))
    throw new Error('Kode QRIS rusak / tidak lengkap (CRC tidak cocok). Coba foto ulang lebih jelas.');
  if (!/ID\.CO\.QRIS|QRIS/i.test(p)) throw new Error('QR ini bukan QRIS Indonesia');
  return {
    payload: p,
    nama: f['59'] || '',
    kota: f['60'] || '',
    dinamis: f['01'] === '12',
    adaNominal: !!f['54']
  };
}
function qrisDynamic(payload, amount) {
  const f = tlvParse(String(payload).trim()).filter(([t]) => t !== '63' && t !== '54');
  const o = f.map(([t, v]) => (t === '01' ? [t, '12'] : [t, v]));
  if (!o.some(([t]) => t === '01')) o.push(['01', '12']);
  o.push(['54', String(Math.round(amount))]);
  o.sort((a, b) => a[0].localeCompare(b[0]));
  const s = o.map(([t, v]) => t + String(v.length).padStart(2, '0') + v).join('') + '6304';
  return s + crc16(s);
}
function qrImg(text, cell = 6) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return `<img alt="QR" style="width:100%;height:auto;image-rendering:pixelated" src="${q.createDataURL(cell, 4)}">`;
}
async function decodeQRFromFile(file) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Gambar tidak bisa dibuka'));
    i.src = URL.createObjectURL(file);
  });
  if ('BarcodeDetector' in window) {
    try {
      const r = await new BarcodeDetector({ formats: ['qr_code'] }).detect(img);
      if (r.length) return r[0].rawValue;
    } catch (e) {}
  }
  for (const maxW of [1000, 1600, 700, 2200]) {
    const sc = Math.min(1, maxW / Math.max(img.width, img.height));
    const w = Math.round(img.width * sc),
      h = Math.round(img.height * sc);
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0, w, h);
    const r = jsQR(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
    if (r && r.data) return r.data;
  }
  throw new Error(
    'QR tidak terbaca. Pakai screenshot QRIS dari aplikasi bank, atau foto yang lurus & terang.'
  );
}
function qrisSetup() {
  const cur = settings().qris;
  const m = modal(`<h3>📱 Atur QRIS toko</h3>
   <p style="margin-top:0">Upload <b>foto atau screenshot QRIS toko</b> (QRIS statis dari stiker / aplikasi bank / merchant). Cukup sekali. Setelah itu aplikasi otomatis membuat QR dengan <b>nominal sesuai total belanja</b>.</p>
   <div class="row"><button class="btn pri" id="qUp">🖼️ Pilih foto QRIS</button><input type="file" id="qFile" accept="image/*" class="hide"></div>
   <details style="margin-top:10px"><summary class="muted" style="cursor:pointer">atau tempel kode teks QRIS</summary><textarea id="qTxt" rows="3" placeholder="000201010211..."></textarea><button class="btn ghost sm" id="qUse" style="margin-top:6px">Pakai kode ini</button></details>
   <div id="qRes" style="margin-top:12px"></div>
   <div class="row" style="justify-content:flex-end;margin-top:12px">${cur ? '<button class="btn bad" id="qDel">Hapus QRIS</button><span class="grow"></span>' : ''}<button class="btn ghost" data-close>Tutup</button><button class="btn ok hide" id="qSave">Simpan QRIS</button></div>`);
  let found = null;
  const show = async raw => {
    try {
      found = qrisInfo(raw);
      $('#qRes', m).innerHTML =
        `<div class="banner" style="background:#e9f7ef;border-color:#a8dcbc;color:#14532d">✔ QRIS terbaca: <b>${esc(found.nama)}</b>${found.kota ? ' · ' + esc(found.kota) : ''}${found.adaNominal ? '<br>⚠️ QR ini sudah berisi nominal tetap. Sebaiknya pakai QRIS statis (tanpa nominal).' : ''}</div>
        <p class="muted" style="font-size:13px">Contoh QR untuk tes Rp 1.000. Coba scan pakai e-wallet (jangan dibayar) untuk memastikan nama toko & nominal muncul benar:</p><div style="max-width:200px;margin:auto">${qrImg(qrisDynamic(found.payload, 1000), 5)}</div>`;
      $('#qSave', m).classList.remove('hide');
    } catch (e) {
      found = null;
      $('#qSave', m).classList.add('hide');
      $('#qRes', m).innerHTML =
        `<div class="banner" style="background:#fdecec;border-color:#f3b4b4;color:#7f1d1d">❌ ${esc(e.message)}</div>`;
    }
  };
  $('#qUp', m).onclick = () => $('#qFile', m).click();
  $('#qFile', m).onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    $('#qRes', m).innerHTML = '<p class="muted">Membaca QR…</p>';
    try {
      await show(await decodeQRFromFile(f));
    } catch (err) {
      $('#qRes', m).innerHTML =
        `<div class="banner" style="background:#fdecec;border-color:#f3b4b4;color:#7f1d1d">❌ ${esc(err.message)}</div>`;
    }
  };
  $('#qUse', m).onclick = () => show($('#qTxt', m).value);
  $('#qSave', m).onclick = async () => {
    if (!found) return;
    settings().qris = { payload: found.payload, nama: found.nama, kota: found.kota, dipasang: Date.now() };
    await saveMeta('settings');
    m.close();
    toast('QRIS tersimpan ✔');
    render();
  };
  $('#qDel') &&
    ($('#qDel', m).onclick = async () => {
      if (!(await confirmBox('Hapus QRIS toko?', 'Hapus', true))) return;
      delete settings().qris;
      await saveMeta('settings');
      m.close();
      render();
    });
}
